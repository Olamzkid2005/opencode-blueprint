# 10 — Security and reliability

<!-- toc -->
## Contents

- [1. Trust model (as actually implemented)](#1-trust-model-as-actually-implemented)
- [2. The permission gate, precisely](#2-the-permission-gate-precisely)
  - [2.1 The four "always" scopes are much broader than they look](#21-the-four-always-scopes-are-much-broader-than-they-look)
  - [2.2 Where the gate is *not*](#22-where-the-gate-is-not)
  - [2.3 Agent default rulesets (`agent/agent.ts`) — fail-closed by construction](#23-agent-default-rulesets-agentagentts--fail-closed-by-construction)
- [3. Filesystem safety](#3-filesystem-safety)
  - [3.1 Read-before-write (`src/file/time.ts`)](#31-read-before-write-srcfiletimets)
  - [3.2 External directory boundary](#32-external-directory-boundary)
  - [3.3 Binary and size guards](#33-binary-and-size-guards)
  - [3.4 Truncation spool (`tool/truncate.ts`)](#34-truncation-spool-tooltruncatets)
- [4. Credentials and secrets](#4-credentials-and-secrets)
  - [4.1 Share secrets](#41-share-secrets)
- [5. Process and code execution](#5-process-and-code-execution)
- [6. HTTP surface](#6-http-surface)
- [7. Reliability mechanisms (verified)](#7-reliability-mechanisms-verified)
  - [7.1 Failure containment philosophy](#71-failure-containment-philosophy)
- [8. Known weaknesses (verified or strongly implied)](#8-known-weaknesses-verified-or-strongly-implied)

<!-- /toc -->

Everything here is grounded in the files cited; inferences are labelled.

---

## 1. Trust model (as actually implemented)

| Boundary | Mechanism | Where |
|---|---|---|
| Model → filesystem | per-tool `ctx.ask()` + `Permission.evaluate` (default **ask**) | `tool/*.ts`, `permission/*` |
| Agent → outside project | `assertExternalDirectory` → `external_directory` permission on `<parentDir>/*` | `tool/external-directory.ts` |
| Local HTTP clients → server | optional HTTP Basic via `OPENCODE_SERVER_PASSWORD` | `server/`, `worker.js` `getAuthorizationHeader()` |
| Plugin/MCP → process | **no sandbox**; plugins are trusted code | `plugin/index.ts`, `mcp/index.ts` |
| Provider credentials | `auth.json` (mode `0600`), injected into SDK options only | `auth/index.ts` |
| Shared session → public web | secret-based share API, opt-in | `share/share-next.ts` |
| Network egress | `webfetch` only, permission-gated, 5 MB cap | `tool/webfetch.ts` |

## 2. The permission gate, precisely

```js
evaluate(permission, pattern, ...rulesets) =
  rules.flat().findLast(r => Wildcard.match(permission, r.permission) && Wildcard.match(pattern, r.pattern))
  ?? {action:"ask", permission, pattern:"*"}
```

Verified properties:

- **fail-closed default** (`ask`);
- **last rule wins**, so a ruleset is a small policy language where later entries are more specific;
- `deny` anywhere **short-circuits the whole call** and throws `DeniedError` listing the matching rules;
- `ask` is coalesced: one prompt for all patterns of one tool call;
- "always" answers are persisted per **project** (`permission` table, `project_id` PK) as `approved` rules and
  re-evaluated with the same `findLast`, so an "always" cannot override a later `deny` added by config.

### 2.1 The four "always" scopes are much broader than they look

```js
read:      always: ["*"]          // tool/read.ts
webfetch:  always: [params.url]   // tool/webfetch.ts  → pattern is the URL itself
write:     always: ["*"]          // tool/write.ts
task:      always: ["*"]          // tool/task.ts
```

[verified] Choosing "always allow" for `read`/`write`/`task` creates a rule with pattern `*`, i.e. **all future
reads/writes/subagents in that project**. For `webfetch` the stored pattern is the exact URL string, so a second
fetch of a *different* URL asks again.

[inferred] This is a UX trade (nobody wants to approve every read) with a real security consequence: the first
"always" click collapses a per-path control into a blanket one. A finer-grained "always for this directory" is not
implemented.

### 2.2 Where the gate is *not*

`Tool.define` does **not** call `permission.ask` centrally — each tool does it. Verified consequence: plugin tools
(`fromPlugin`) and MCP tools never pass through `Permission`; they are whatever the plugin/server does. MCP tools
in particular execute with the user's full privileges and are gated only by the client's own consent model.

**This is the single most important security fact in this document.**

### 2.3 Agent default rulesets (`agent/agent.ts`) — fail-closed by construction

```js
defaults = fromConfig({
  "*": "allow",
  doom_loop: "ask",
  external_directory: { "*": "ask", ...whitelistedDirs.map(d => [d, "allow"]) },
  question: "deny", plan_enter: "deny", plan_exit: "deny",
  read: { "*": "allow", "*.env": "ask", "*.env.*": "ask", "*.env.example": "allow" }
});
```

- `explore` starts with `"*": "deny"` and allowlists grep/glob/list/bash/webfetch/websearch/codesearch/read —
  a textbook default-deny subagent.
- `plan` denies `edit` everywhere except `.opencode/plans/*.md` (project) and the plans dir under
  `Global.Path.data`.
- `compaction`, `title`, `summary` deny `*` entirely — these agents cannot act.
- `general` denies `todowrite` (so a subagent cannot rewrite the parent's todo list).
- After merging, every agent without an explicit `external_directory: Truncate.GLOB → deny` gets
  `Truncate.GLOB → allow`, so the truncation spool directory is readable without prompting.

[verified] `*.env.example` is explicitly allowed while `*.env`/`*.env.*` ask — a deliberate carve-out for template
files. Note the glob is on the *pattern*, matched against the absolute path the tool passes, so the `.env`
protection depends on the filename ending exactly that way (`config.env.local` matches `*.env.*`).

## 3. Filesystem safety

### 3.1 Read-before-write (`src/file/time.ts`)

```js
assert(sessionID, filepath):
  if (OPENCODE_DISABLE_FILETIME_CHECK) return;
  const t = reads[sessionID]?.[filepath];
  if (!t) throw new Error("You must read file … before overwriting it. Use the Read tool first");
  const next = stamp(filepath);                      // {read: now, mtime, size}
  if (next.mtime !== t.mtime || next.size !== t.size)
    throw new Error(`File ${filepath} has been modified since it was last read. … Please read the file again`);
```

This is the guard that prevents the classic agent failure "I edited a file from stale context and clobbered your
work". It is **per session** (`reads: Map<sessionID, Map<path, stamp>>`) and compares `mtime` + `size`.
`withLock(filepath, fn)` returns a per-path `Semaphore(1)` — so concurrent tools in one instance serialise on the
same file.

[inferred] The check is advisory, not a lock: between `assert` and `write` another process could still modify the
file (TOCTOU). It defends against stale *model* context, not against concurrent external editors.

### 3.2 External directory boundary

```js
if (Instance.containsPath(full)) return;
const dir = kind === "directory" ? full : path.dirname(full);
await ctx.ask({ permission:"external_directory", patterns:[join(dir,"*").replaceAll("\\","/")], always:[same], … });
```

[verified] The pattern is normalised to forward slashes, and `always` stores the *directory glob*, so approving once
approves that directory tree. Every path-taking tool that touches the FS calls this (`read`, `write`, `edit`, list…),
and `bypassCwdCheck` is an internal escape hatch (`ctx.extra`), not user-configurable.

### 3.3 Binary and size guards

`read`: extension blacklist (zip/exe/wasm/…), then a 4 KB sample — NUL byte ⇒ binary, >30 % non-printable ⇒ binary;
`MAX_LINE_LENGTH 2000`, `MAX_BYTES 50 KB`, `DEFAULT_READ_LIMIT 2000`; directories are listed, not read; images/PDF
are returned as `data:` attachments instead of text.

`webfetch`: `http(s)` only, 5 MB limit checked **twice** (header and actual `byteLength`), timeout capped at 120 s,
custom UA with a Cloudflare-challenge retry using `User-Agent: opencode`.

[inferred] The Chrome-UA-plus-retry is an anti-bot workaround, not a security control; but combined with the size cap
it bounds the damage a hostile page can do (no parsing beyond HTMLRewriter/turndown, both in-process).

### 3.4 Truncation spool (`tool/truncate.ts`)

`MAX_LINES 2000`, `MAX_BYTES 50 KB`, `direction: "head"|"tail"`, full text written to
`TRUNCATION_DIR/tool_<id>`, `RETENTION = 7 days`, cleanup hourly (forked, delayed 1 minute, errors logged).

The hint injected into the model's context is **conditional on the agent having a `task` tool**:

- with task: "Use the Task tool to have explore agent process this file … Do NOT read the full file yourself".
- without: "Use Grep … or Read with offset/limit".

[inferred] That conditional is a context-budget optimisation expressed as prompt text: subagents are the cheap
route to a large file, and the tool tells the model which capability it actually has.

## 4. Credentials and secrets

- `auth.json` in `Global.Path.data`, written with mode `384` (**0o600**). Entries are schema-decoded with
  `decodeUnknownOption`, so an unrecognised shape is *dropped* rather than trusted.
- Key normalisation on write: trailing `/` stripped, and both `key` and `key/` variants deleted before writing —
  [inferred] a fix for duplicate entries created by URL-form provider ids.
- `Auth.get` is used by `LLM.stream` only to decide `isOpenaiOauth` and by provider SDK construction; **tokens are
  never written into session rows, parts or events**.
- `wellknown` auth entries set `process.env[key] = token` — an explicit, documented case of pushing a secret into
  the environment (used for provider keys that SDKs read from env).
- Console/account tokens are likewise pushed to `OPENCODE_CONSOLE_TOKEN` via `Env.set` when an org is active.
- Plugin context builds a Basic header **in memory** for the in-process client.

[verified] Secrets therefore exist in: `auth.json`, the process environment, and provider SDK instances. They are
not in the DB (except the *share* secret, which is a share authorisation token, not a credential).

### 4.1 Share secrets

`session_share.secret` is stored **plaintext in SQLite** and sent in the POST body on every sync. [inferred] Anyone
with read access to the local DB (or the share URL + secret) can write to that share. Sharing also uploads full
session content — messages, parts, diffs — to `opncd.ai` (or the enterprise URL), which is the single largest data
egress in the product and is opt-in (`/share` or `share:"auto"`).

## 5. Process and code execution

- **Plugins** are arbitrary code by design: loaded via `PluginLoader`, executed in-process, given `Bun.$`, the SDK
  client and the project. `OPENCODE_PURE` skips *external* plugins; internal ones (auth) still load.
- **MCP local servers** are spawned as child processes with `{...process.env, ...mcp.environment}` and
  `cwd: Instance.directory`. On dispose, `pgrep -P` walks descendants and SIGTERMs them.
- **LSP servers** are spawned the same way; `OPENCODE_DISABLE_LSP_DOWNLOAD` prevents runtime downloads.
- **ripgrep** is downloaded when not bundled (`file/ripgrep.ts` typed errors `DownloadFailedError`,
  `UnsupportedPlatformError`, `ExtractionFailedError`).

[inferred] Downloading and executing binaries (ripgrep, LSP servers) at runtime is a supply-chain surface that the
code acknowledges but does not verify (no checksum/signature check is visible in the modules read). If a checksum
exists it is in the vendor layer [undetermined].

## 6. HTTP surface

- Basic auth is attached by the **worker** (`getAuthorizationHeader()`), not by `Bun.serve`, and applies to the RPC
  `fetch` path; the plugin client replicates the same header construction.
- CORS is opt-in via `listen({cors})`; the default configuration does not add a permissive origin.
- mDNS is published only for non-loopback hostnames, and unpublished on stop.
- `idleTimeout: 0` intentionally keeps long-lived SSE connections open — the trade-off is that a dead client can
  hold a socket indefinitely (no heartbeat is visible in the extracted `server/event.ts` client route
  [undetermined] — proof of impossibility: the server-side SSE accept path is vendor JavaScript in
  the bundled worker serving `Server.Default()`, not a separate module in this artifact, so the
  heartbeat policy cannot be observed from the client code read here).
- `experimental` routes exist for unstable APIs.

## 7. Reliability mechanisms (verified)

| Mechanism | Behaviour |
|---|---|
| Retry | `2000·2^(attempt-1)` capped at 30 s, honours `retry-after-ms`/`retry-after`; 4 attempts default, 2 for titles |
| Stream guard | `wrapSSE` races `reader.read()` against a timer, aborts + cancels on timeout |
| Turn isolation | `BusyError` refuses a concurrent turn instead of queueing |
| Disposal | `Instance.disposeAll()` runs every `addFinalizer`: MCP children SIGTERM'd, LSP `shutdown()`, share scope closed, pending permission `Deferred`s failed with `RejectedError` |
| LSP | `broken` set blacklists a server after one spawn/init failure |
| MCP | non-throwing read paths; stale-notification guard re-checks client identity after an await |
| Share | 1 s debounce + Map coalescing; flush failures logged, never surfaced |
| DB | WAL, `busy_timeout 5000`, `wal_checkpoint(PASSIVE)` on open, FK cascades for session→message→part |
| Config | infinite TTL cache + `SIGUSR2` invalidation |
| Truncation | 7-day retention, hourly cleanup |
| Cache | `CACHE_VERSION` mismatch wipes the cache directory |
| Doom loop | 3 identical tool calls → `doom_loop` permission (default `ask`) |

### 7.1 Failure containment philosophy

Three distinct policies are used deliberately:

1. **Fail the turn** — provider errors after retries, invalid params, `DeniedError`.
2. **Stop the loop cleanly** — permission/question rejection: `ctx.blocked = ctx.shouldBreak` (config
   `experimental.continue_loop_on_deny` flips to "let the model try again").
3. **Degrade and continue** — MCP unavailable, LSP broken, share flush failed, plugin config hook failed,
   truncation cleanup failed, project diff failed, session removal unshare failed.

[inferred] The split follows blast radius: anything that corrupts the transcript's meaning fails; anything that is
a *capability* (an integration) degrades, because losing a capability should not lose the conversation.

## 8. Known weaknesses (verified or strongly implied)

1. **No central permission enforcement** for plugin/MCP tools (§2.2).
2. **`always:["*"]`** on read/write/task converts a one-off approval into a project-wide blanket (§2.1).
3. **Shell parsing is heuristic.** `bash.ts` extracts patterns via tree-sitter, but `dynamic()` returns true for
   `$(`, `${`, backticks and (in PowerShell) `$` — such commands cannot be path-matched, so an approval for
   `cat file` does not constrain `cat $(echo /etc/passwd)`. Permission patterns are therefore advisory for
   obfuscated commands. [inferred] Mitigation is the `bash` permission itself, not the derived pattern.
4. **Share secret at rest** in plaintext SQLite; full transcript egress.
5. **Plugins execute with full privileges** and can publish fake session errors (`Session.Event.Error`).
6. **No client-disconnect watchdog** for in-flight turns — an abandoned session keeps spending tokens until
   cancelled (documented in 07 §5).
7. **`OPENCODE_PERMISSION`** env JSON is merged last and can silently widen permissions for every project run in
   that environment.
8. **TOCTOU** on `FileTime.assert` (§3.1).
9. **Single-writer SQLite** — with `busy_timeout` 5 s, a long write transaction (e.g. huge part) can make another
   writer fail.
10. **Migration bundling** means a downgrade is unsupported: an older binary seeing a newer schema runs its own
    (older) migration list and does not know about added columns [inferred from the code shape].
11. **Downloaded tooling is not integrity-checked.** Both the ripgrep binary (`file/ripgrep.ts`) and the
    auto-installed LSP servers (`lsp/server.ts`, e.g. clangd) are fetched over HTTPS from GitHub/HashiCorp, written
    to `Global.Path.bin`, extracted and `chmod 0755`ed with **no hash or signature verification anywhere** in either
    module (`18` §3.1). HTTPS + release-API pinning is the whole supply-chain control; a compromised release asset
    is executed on the next read of a matching file type.
12. **MCP stdio servers inherit the full environment** (`env: {...process.env, ...mcp.environment}`), so any secret
    present in the shell that launched opencode is readable by every configured local MCP server.
