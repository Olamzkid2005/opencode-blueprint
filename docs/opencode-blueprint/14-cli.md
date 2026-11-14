# 14 — The CLI (`src/cli/**`, 5,649 lines outside the TUI)

<!-- toc -->
## Contents

- [1. Command inventory (verified from the modules)](#1-command-inventory-verified-from-the-modules)
- [2. `run` — the non-interactive path (`cmd/run.ts`)](#2-run--the-non-interactive-path-cmdrunts)
  - [2.1 Options](#21-options)
  - [2.2 Message assembly (verified oddities)](#22-message-assembly-verified-oddities)
  - [2.3 Session selection and permissions](#23-session-selection-and-permissions)
  - [2.4 Event loop and output](#24-event-loop-and-output)
  - [2.5 Two execution modes](#25-two-execution-modes)
  - [2.6 Agent validation before prompting](#26-agent-validation-before-prompting)
- [3. `serve` and `web`](#3-serve-and-web)
- [4. `generate`](#4-generate)
- [5. `stats` — reporting over the event-sourced store](#5-stats--reporting-over-the-event-sourced-store)
- [6. `uninstall` — the most careful command in the codebase](#6-uninstall--the-most-careful-command-in-the-codebase)
- [7. `agent create` / `agent list`](#7-agent-create--agent-list)
- [8. `providers login` — three different auth mechanisms in one handler](#8-providers-login--three-different-auth-mechanisms-in-one-handler)
- [9. `mcp auth` — resuming a pending OAuth transport](#9-mcp-auth--resuming-a-pending-oauth-transport)
- [10. `plugin <module>` — shared install logic with the TUI](#10-plugin-module--shared-install-logic-with-the-tui)
- [11. `github` — the CI agent (1,238 lines)](#11-github--the-ci-agent-1238-lines)
  - [11.1 `install`](#111-install)
  - [11.2 `run`](#112-run)
- [12. `export` / `import`](#12-export--import)
- [13. `db` and `debug`](#13-db-and-debug)
- [14. CLI-wide patterns](#14-cli-wide-patterns)

<!-- /toc -->

The CLI is a yargs program. Every command is a plain object created by the identity helper
`cmd(input)` (`cli/cmd/cmd.ts`), which exists only to give yargs configs a type — there is no base class, no
plugin system, no shared registration function.

---

## 1. Command inventory (verified from the modules)

| Command | File | Notes |
|---|---|---|
| `$0 [project]` (TUI) | `cmd/tui/thread.ts` | default command; see 13 |
| `run [message..]` | `cmd/run.ts` (537) | one-shot agent run, text or `--format json` |
| `serve` | `cmd/serve.ts` (16) | headless HTTP server |
| `web` | `cmd/web.ts` (56) | server + open browser, prints LAN URLs |
| `generate` | `cmd/generate.ts` (37) | prints the OpenAPI document with `x-codeSamples` |
| `export [sessionID]` | `cmd/export.ts` (73) | JSON snapshot of a session to stdout |
| `import <file>` | `cmd/import.ts` (143) | JSON file or share URL |
| `session` | `cmd/session.ts` (134) | `delete <id>`, `list` |
| `stats` | `cmd/stats.ts` (288) | token/cost aggregates over the SQLite DB |
| `models [provider]` | `cmd/models.ts` (69) | `--verbose`, `--refresh` |
| `agent` | `cmd/agent.ts` (205) | `create`, `list` |
| `providers` | `cmd/providers.ts` (428) | `list`, `login [url]`, `logout` |
| `mcp` | `cmd/mcp.ts` (638) | `list`, `auth [name]` (+ its `list`/`logout`) |
| `github` | `cmd/github.ts` (1,238) | `install`, `run` — the CI agent |
| `plugin <module>` | `cmd/plug.ts` (173) | install + patch config |
| `upgrade [target]` | `cmd/upgrade.ts` (65) | delegates to `Installation` |
| `uninstall` | `cmd/uninstall.ts` (282) | removes data/cache/config/state + shell PATH |
| `account` | `cmd/account.ts` (192) | `login <url>`, `logout`, `switch`, `orgs`, `open`, `console` |
| `db` | `cmd/db.ts` (109) | interactive sqlite3 shell, `path`, `migrate` |
| `acp` | `cmd/acp.ts` (56) | agent-client protocol over stdio |
| `pr` | `cmd/pr.ts` (101) | pull-request helper |
| `debug …` | `cmd/debug/*` | `agent, file, ripgrep, lsp, snapshot, scrap, skill, config` |

## 2. `run` — the non-interactive path (`cmd/run.ts`)

### 2.1 Options

`--command`, `--continue/-c`, `--session/-s`, `--fork`, `--share`, `--model/-m`, `--agent`, `--format default|json`,
`--file/-f` (array), `--title`, `--attach <url>`, `--password/-p`, `--thinking`.

### 2.2 Message assembly (verified oddities)

```js
let message = [...args.message, ...args["--"] || []]
  .map(a => a.includes(" ") ? `"${a.replace(/"/g, '\\"')}"` : a).join(" ");
if (!process.stdin.isTTY) message += `\n` + await Bun.stdin.text();
if (message.trim().length === 0 && !args.command) → "You must provide a message or a command", exit 1
if (args.fork && !args.continue && !args.session) → error, exit 1
```

[verified] Arguments containing spaces are **re-quoted** before joining — an attempt to preserve the user's
shell-quoting intent through yargs. `--` passthrough args are appended after positional ones.

`--file` resolves against cwd, errors with `File not found: …` + exit 1, and assigns mime
`application/x-directory` for directories, else `text/plain` (attachments are not sniffed).

### 2.3 Session selection and permissions

```js
rules = [{permission:"question",action:"deny",pattern:"*"},
         {permission:"plan_enter",…}, {permission:"plan_exit",…}]
session(sdk):
  baseID = args.continue ? (await sdk.session.list()).data?.find(s => !s.parentID)?.id : args.session
  if (baseID && args.fork) return (await sdk.session.fork({sessionID: baseID})).data?.id
  if (baseID) return baseID
  return (await sdk.session.create({title: title(), permission: rules})).data?.id
```

[verified] A non-interactive run **denies the question and plan tools by construction** — there is nobody to answer.
`--continue` picks the most recent **root** session (`!s.parentID`), not the most recent overall.

`title()`: `--title ""` means "derive from message" (`message.slice(0,50) + (…"..."`), while a non-empty title is
used verbatim; no `--title` leaves the session's default timestamp title.

`share(sdk, sessionID)` only runs when `config.share === "auto" || OPENCODE_AUTO_SHARE || --share`, and prints a
`!`-prefixed error if sharing is disabled.

### 2.4 Event loop and output

```js
const events = await sdk.event.subscribe();
for await (const event of events.stream) {
  message.updated (assistant) → print "> agent · model" once
  message.part.updated:
    tool completed/error → emit("tool_use") or print inline/block rendering
    task running        → print once per part.id (toggles map)
    step-start/finish   → emit("step_start"/"step_finish")
    text with time.end  → emit("text") or print (TTY: spaced block, non-TTY: raw + EOL)
    reasoning (--thinking) → "Thinking: …" dim italic when TTY
  session.error → accumulate message, emit("error")
  session.status idle for this session → break
  permission.asked → print "auto-rejecting" and reply "reject"
}
```

Each tool has a bespoke **CLI renderer** in the same file: `bash` (block with output), `edit` (block with diff),
`read` (single line with `[offset=…]`), `glob`/`grep` (with match counts), `write`, `webfetch` (`%`), `codesearch`
(`◇`), `websearch` (`◈`), `task` (icon by status: `✗` error, `•` running, `✓` done), `skill`, `todowrite`
(`[x]`/`[ ]` list), `list`, `fallback` (`⚙ tool <json input>`).

[verified] `emit(type, data)` writes `{type, timestamp, sessionID, ...data}` as one JSON line when
`--format json`, and returns `true` so each branch can `continue` past human formatting. That makes
`opencode run --format json` a stable machine interface over the same event stream the TUI consumes.

### 2.5 Two execution modes

- `--attach <url>` (`cli/cmd/tui/attach.ts`, 74 lines): builds `createOpencodeClient({baseUrl, directory, headers})` with Basic auth from
  `--password ?? OPENCODE_SERVER_PASSWORD` and username `OPENCODE_SERVER_USERNAME ?? "opencode"`.
- otherwise: `bootstrap(cwd, …)` → `createOpencodeClient({baseUrl:"http://opencode.internal", fetch: r => Server.Default().fetch(r)})`.

**`bootstrap` (`cli/bootstrap.ts`)** is the whole in-process lifecycle:

```js
Instance.provide({directory, init: InstanceBootstrap, fn: async () => { try { return await cb() } finally { await Instance.dispose() } }})
```

So every non-server CLI command constructs a full instance (services + finalizers) and disposes it — which is why
one-shot commands clean up MCP children, LSP clients and DB handles.

### 2.6 Agent validation before prompting

`--agent` is validated **twice over**: with `--attach` it calls `sdk.app.agents()` and warns+falls back on
"not found" or "is a subagent"; locally it calls `Agent.get()`. Both paths print a warning and fall back rather than
failing the run — except `--attach` where a failed agent list also falls back with a warning.

## 3. `serve` and `web`

`serve` prints **"Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured."** when unset, then
`Server.listen(opts)`, logs the URL, and `await new Promise(() => {})` (never resolves) — the process lives until
killed.

`web` adds: logo, `0.0.0.0` handling that enumerates `networkInterfaces()` IPv4 non-internal addresses **skipping
`172.*`** (docker/vm bridges), mDNS URL line, and `open()` of the localhost URL. `OPENCODE_DISABLE_EMBEDDED_WEB_UI`
gates the embedded UI asset.

`network.ts` resolves options with a strict precedence and a subtle default:

```js
port     = --port ? args.port : config.server.port ?? args.port
hostname = --hostname ? args.hostname : (mdns && !config.server.hostname ? "0.0.0.0" : config.server.hostname ?? args.hostname)
mdns     = --mdns ? args.mdns : config.server.mdns ?? args.mdns
cors     = [...config.server.cors ?? [], ...(args.cors ?? [])]
```

[verified] `--mdns` **implicitly widens the bind to `0.0.0.0`** unless a hostname is configured — a convenience with
a security consequence (see 10 §6). CORS from config and CLI are *concatenated*, not overridden.

## 4. `generate`

Fetches `Server.openapi()`, injects into every operation an `x-codeSamples` entry:

```js
operation["x-codeSamples"] = [{ lang:"js", source: `import { createOpencodeClient } from "@opencode-ai/sdk\n\nconst client = createOpencodeClient()\nawait client.${operationId}({ ... })` }]
```

then streams `JSON.stringify(specs, null, 2)` to stdout (with a callback-based write + promise, so exit code reflects
EPIPE). [verified] Note the **unterminated import string** (`"@opencode-ai/sdk` with no closing quote) — a real
string bug preserved in the shipped sample.

## 5. `stats` — reporting over the event-sourced store

```js
getAllSessions() → db.select().from(SessionTable).all() → Session.fromRow
cutoff = days === undefined ? 0 : days === 0 ? startOfToday : now - days*86400000
filter by session.time.updated >= cutoff   // NOT message timestamps
projectFilter: "" → current project; "<id>" → that project; undefined → all
```

Then, in **batches of 20 sessions**, it loads `Session.messages({sessionID})` and accumulates:

- `cost` = Σ assistant `info.cost`; per-model `messages`, `tokens`, `cost`;
- tokens: `input/output/reasoning/cache.read/cache.write`, with **model-level output = output + reasoning**
  (a different accounting from `Session.getUsage`, which keeps them separate);
- `toolUsage` = count of `part.type === "tool"` by `part.tool`;
- per-session totals are collected for the median (`medianTokensPerSession`).

[verified] Sessions with `> 1000` entries print "Large dataset detected (…). This may take a while…" — a manual
progress hint because the loop is O(sessions × messages) with no SQL aggregation. Dashboard-style numbers are
computed client-side in the CLI.

## 6. `uninstall` — the most careful command in the codebase

```js
collectRemovalTargets: data(keep-data), cache(always), config(keep-config), state(always)
shellConfig = method === "curl" ? getShellConfigFile() : null
binary      = method === "curl" ? process.execPath : null
```

- `showRemovalSummary` prints each directory that **exists**, with `getDirectorySize` (recursive walk) formatted
  B/KB/MB/GB, a `(keeping)` dimmed marker, the binary, the shell config, and — for package installs — the exact
  uninstall command (`npm uninstall -g opencode-ai`, `brew uninstall opencode`, …).
- Requires confirmation (`ke2`) unless `--force`; `--dry-run` stops after the summary.
- `getShellConfigFile()` searches a per-shell candidate list (`fish/zsh/bash/ash/sh`, including XDG variants) for a
  file containing `# opencode` or `.opencode/bin`.
- `cleanShellConfig` removes only the block: the `# opencode` line, the following line if it contains
  `.opencode/bin` or `fish_add_path`, any `export PATH=…opencode/bin` / `fish_add_path …opencode` line, and trailing
  blank lines.
- For `curl` installs it **does not delete the running binary**; it prints `rm "<path>"` (and `rmdir` when the dir
  contains `.opencode`) so the user finishes the job.
- choco's "not running from an elevated command shell" is special-cased into a warning.

[inferred] This is the command most likely to be run by a frustrated user, so it is the one place where the code
optimises for *legibility and reversibility* over brevity: every destructive action is enumerated first, sized, and
confirmed.

## 7. `agent create` / `agent list`

`create` is a multi-step prompt flow with a **fully non-interactive mode** when `--path`, `--description`,
`--mode` and `--tools` are all supplied (`isFullyNonInteractive`), which suppresses all UI and prints the file path.

Verified sequence: location (project `.opencode/agent` vs `Global.Path.config/agent`) → description →
`Agent.generate({description, model})` (an LLM call returning `{identifier, whenToUse, systemPrompt}`, see 09 §3) →
tool multi-select (default all `AVAILABLE_TOOLS`) → mode (`all|primary|subagent`, default `all`) → write:

```js
frontmatter = { description: generated.whenToUse, mode }
if (Object.keys(tools).length) frontmatter.tools = tools      // only disabled tools are listed, as false
content = gray-matter.stringify(generated.systemPrompt, frontmatter)
filePath = join(targetPath, `${generated.identifier}.md`)     // refuses if it exists
```

[verified] Disabled tools are written as `tools: {x: false}` (sparse), matching the `tools → permission` rewrite in
the config loader. `list` sorts native agents first, then by name, and prints the full permission ruleset as JSON —
the fastest way to see the effective policy.

## 8. `providers login` — three different auth mechanisms in one handler

1. **URL / well-known**: `GET <url>/.well-known/opencode` → run `wellknown.auth.command` as a subprocess, capture
   stdout as the token → `Auth.set(url, {type:"wellknown", key: wellknown.auth.env, token})`.
   [inferred] this is enterprise SSO: the vendor provides the CLI command that prints a token.
2. **Model list**: `ModelsDev.refresh(true)` then filter by `enabled_providers`/`disabled_providers`, sorted by a
   hardcoded `priority` map (`opencode:0, openai:1, github-copilot:2, google:3, anthropic:4, openrouter:5, vercel:6`),
   with hints ("recommended", "ChatGPT Plus/Pro or API key") and plugin-provided providers appended (`hint:"plugin"`).
3. `--provider` accepts **id or display name** (`byID ?? byName`, case-insensitive on label); unknown →
   `Unknown provider "x"` + exit 1.

`logout` removes credentials; `list` shows configured/available providers.

## 9. `mcp auth` — resuming a pending OAuth transport

Verified flow (matches the server-side design in 09 §2.2):

```js
oauthServers = config.mcp entries that are remote && oauth !== false
if none → prints an example config block
if no name → select from list annotated with MCP.getAuthStatus(name) icon/text
status === "authenticated" → confirm re-auth; "expired" → warn and continue
spinner "Starting OAuth flow..."
Bus.subscribe(MCP.BrowserOpenFailed, evt => { if (evt.properties.mcpName === serverName) print URL, keep waiting })
status = await MCP.authenticate(serverName)
  connected → success
  needs_client_registration → prints the exact config JSON with clientId/clientSecret placeholders
  failed → prints error
```

[verified] Because the failed transport was cached in `pendingOAuthTransports`, `authenticate` completes *that*
transport — the browser-open failure is surfaced as a bus event rather than an error, so headless environments get a
copy-pasteable URL.

## 10. `plugin <module>` — shared install logic with the TUI

`createPlugTask(input, dep)` takes an **injectable dependency object** (`spinner`, `log`, `resolve`, `readText`,
`write`, `exists`, `files`, `global`) with `defaultPlugDeps` as the CLI implementation. That is the same
`installPlugin`/`readPluginManifest`/`patchPluginConfig` trio the TUI runtime uses (13 §12.3), which is why the two
install paths cannot drift.

Error handling is unusually specific: on `Process.RunFailedError` it extracts lines starting with `error:` from
stderr and surfaces the first, and recognises `No version matching` with the advice "This package depends on a
version that is not available in your npm registry."

## 11. `github` — the CI agent (1,238 lines)

### 11.1 `install`

Reads `git remote get-url origin` → `parseGitHubRemote` regex
`/^(?:(?:https?|ssh):\/\/)?(?:git@)?github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/` (fails with "Could not find git
repository…" if not a GitHub repo), installs the GitHub App, prompts provider (priority `opencode,anthropic,openai,google`)
and model, writes `.github/workflows/opencode.yml`, and prints next steps — including the exact secret names from
`ModelsDev[provider].env`, and an OIDC note for `amazon-bedrock`.

### 11.2 `run`

```js
isMock = args.token || args.event            // local testing without Actions
context = isMock ? JSON.parse(args.event) : github.context
SUPPORTED = issue_comment|pull_request_review_comment|issues|pull_request|schedule|workflow_dispatch
```

- **Auth**: `USE_GITHUB_TOKEN` → use `GITHUB_TOKEN` directly; else `getOidcToken()` → `exchangeForAppToken(token)`.
  [verified] App-token exchange by default; PAT only as a fallback.
- **Authorisation**: for user events, `assertPermissions()` queries the API for the actor's permission and requires
  `admin` or `write` — "User X does not have write permissions" otherwise. Then `addReaction("eyes")`.
- **Session**: `Session.create({permission:[{permission:"question",action:"deny",pattern:"*"}]})` (no human present);
  `subscribeSessionEvents()` streams tool/text output to the Actions log.
- **Sharing**: skipped when `SHARE === false`; **skipped implicitly for private repos** unless sharing was explicitly
  requested (`if (!share && repoData.data.private) return`). [inferred] privacy default.
- **Repo events** (`schedule`, `workflow_dispatch`): `checkoutNewBranch("schedule"|"dispatch")` → `chat()` →
  `branchIsDirty(head, branch)`; if the agent switched branches itself, "Agent managed its own branch, skipping
  infrastructure push/PR"; if dirty, `summarize()` (≤40 chars via a second LLM call, fallback `Fix issue: <title>`) →
  `pushToNewBranch` → `createPR(...)`.
- **PR events**: fetch PR, and only proceed when head repo === base repo (forks are not auto-modified).
- `chat(message, files)` calls `SessionPrompt.prompt` with text + base64 `data:` file parts carrying
  `source.text.{value,start,end}`; `ContextOverflowError` becomes a structured `PROMPT_TOO_LARGE:` error listing each
  file's estimated KB. If the response has no text parts, it re-prompts with `tools: {"*": false}` asking for a
  1–2 sentence summary — [verified] a fallback for agents that only used tools.
- Commits are attributed: `git commit -m summary -m "Co-authored-by: <actor> <actor@users.noreply.github.com>"`.

[inferred] The `github` command is effectively a second front-end (like the TUI) that happens to run on a CI runner:
it uses the same `Session`, `SessionPrompt`, `Bus`, `Git` services directly instead of the SDK, because it must
control branches and PRs anyway.

## 12. `export` / `import`

`export` (73): optional session id, otherwise an interactive `maxItems: 10` picker over `Session.list()` sorted by
`time.updated DESC` with `hint = "<local date> • <id tail>"`; writes
`{info, messages:[{info, parts}]}` as pretty JSON to stdout. Cancellation throws `UI.CancelledError`.

`import` (143): accepts a path or a **share URL**, so a shared session can be re-imported locally.

## 13. `db` and `debug`

- `db` opens an **interactive sqlite3 shell** (`$0 [query]`), or runs a single query with an output format; `db path`
  prints `Database.Path`; `db migrate` runs the legacy JSON→SQLite import (`storage/json-migration.ts`).

The `debug` group (`cli/cmd/debug/*`, 10 modules) is a support toolset: every subcommand bootstraps an instance
(`bootstrap(process.cwd(), …)`) and then prints the service's own return value. The remaining debug modules —
`cli/cmd/debug/file.ts` (`search <query>`, `read <path>`, `status`, `list <path>`, `tree [dir]`),
`cli/cmd/debug/ripgrep.ts` (`rg tree|files|search`, with `--query`, `--glob`, `--limit` — `tree` is
`Ripgrep.tree(cwd, limit)`), `cli/cmd/debug/lsp.ts` (diagnostics/symbols), `cli/cmd/debug/snapshot.ts`
(track/patch/diff), `cli/cmd/debug/skill.ts`, `cli/cmd/debug/config.ts`, `cli/cmd/debug/scrap.ts` and
`cli/cmd/debug/index.ts` — each prints the service's raw return as JSON. Verified tree:

```
debug
├── config            Config.get() as JSON          (the merged chain, after every source)
├── paths             Global.Path key/value pairs    (data, config, cache, state)
├── agent <name>      agent config + per-tool enablement, or execute one tool
├── skill             Skill.all() as JSON
├── scrap             Project.list() as JSON         ("list all known projects")
├── lsp               ├── diagnostics <file>
│                     ├── symbols <query>
│                     └── document-symbols <uri>
├── rg                ├── tree [--limit n]
│                     ├── files [--query --glob --limit]
│                     └── search <pattern> [--glob… --limit]
├── file              ├── read <path>  ├── status  ├── list <path>
│                     ├── search <query>
│                     └── tree [dir]                (Ripgrep.tree, limit 200)
├── snapshot          ├── track  ├── patch <hash>  └── diff <hash>
└── wait              sleeps 24 h (keeps an instance alive for attaching a debugger)
```

Behaviour worth recording, because these commands are the tool of last resort:

- **`debug agent` executes a tool** (`cli/cmd/debug/agent.ts`). With `--tool <id>` and `--params '<json>'` it resolves the tool through
  `ToolRegistry.tools(model, agent)`, refuses if `Permission.disabled(...)` excludes it, builds a throwaway session
  (title `Debug tool run (<agent>)`) and a synthetic assistant message, then runs `tool.execute(...)` with a context
  whose `ask()` **enforces the ruleset instead of prompting** — a `deny` throws `Permission.DeniedError`. So the
  command can only do what the agent is already allowed to do, which is the right default for a debugging entry
  point that bypasses the UI.
- `--params` accepts JSON **or a JavaScript object literal**, evaluated with `new Function('return (' + input + ')')()`
  when `JSON.parse` fails, and rejects arrays/non-objects. That is arbitrary code execution inside your own CLI
  process, gated only by your own invocation — acceptable for a debug flag, worth knowing when reviewing.
- **`debug lsp diagnostics` sleeps 1000 ms** after `LSP.touchFile(file, true)` before reading diagnostics. There is
  no readiness signal; the sleep is the synchronisation. (Same pattern as the TUI's initial LSP wait.)
- `debug rg tree/files/search` use `Ripgrep.*` directly, so they exercise the *downloaded* binary rather than the
  `grep` tool's wrapper — the fastest way to tell whether rg extraction works on a machine.
- `debug snapshot track|patch|diff` call the snapshot service directly, which is how a support case about reverts
  gets a concrete hash to inspect.
- `debug scrap` and `debug paths` do not bootstrap an instance: they read the project table and `Global.Path`
  respectively, so they work in a directory that is not a project.
- Every handler writes to `process.stdout`/`stderr` with the platform `EOL` and `JSON.stringify(…, null, 2)`; several
  use `console.log`, which is the one inconsistency in the group.

[inferred] The `debug` namespace is deliberately literal: each command prints exactly the subsystem state that the
corresponding service computes, with no formatting ambition. `debug config` in particular is the only supported way
to see the *post-merge* configuration, which makes it the first command to ask for in any config bug report.

## 14. CLI-wide patterns

| Pattern | Evidence |
|---|---|
| Every command is a plain object | `cmd(input){}` identity helper in `cmd.ts` |
| Two execution backends | `--attach` (HTTP) vs `bootstrap` (in-process `Server.Default().fetch`) |
| Progress via spinner + `UI.Style` constants | `ui.ts` ANSI palette, `spinner` from `ui/spinner.ts` |
| Errors go to stderr with `!` prefix | `UI.error`, `T7.error` |
| Exit codes: 1 for user error, 0 otherwise | `process.exit(1)` after validation failures |
| Interactive prompts are cancellable | `Vu(x)` checks cancellation, throws `UI.CancelledError` |
| Output is machine-readable where it matters | `run --format json`, `export`, `generate`, `models --verbose` |
