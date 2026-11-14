# 18 — Third deep pass: config loader, git plumbing, the LSP table, MCP transports, CLI commands

<!-- toc -->
## Contents

- [1. `config/config.ts` — the loader, in code order](#1-configconfigts--the-loader-in-code-order)
  - [1.1 Schemas that were missing from doc 08](#11-schemas-that-were-missing-from-doc-08)
  - [1.2 Load order (verified against `loadInstanceState`)](#12-load-order-verified-against-loadinstancestate)
  - [1.3 Side effects that happen on *read*](#13-side-effects-that-happen-on-read)
  - [1.4 Error surfaces](#14-error-surfaces)
  - [1.5 Writes](#15-writes)
  - [1.6 Cache and invalidation](#16-cache-and-invalidation)
- [2. `git/index.ts` — the plumbing everything else assumes](#2-gitindexts--the-plumbing-everything-else-assumes)
  - [2.1 `Vcs` (`project/vcs.ts`, 165 lines) — branch tracking and two diff modes](#21-vcs-projectvcsts-165-lines--branch-tracking-and-two-diff-modes)
- [3. LSP — the builtin table and the client](#3-lsp--the-builtin-table-and-the-client)
  - [3.1 The table: 37 servers (`lsp/server.ts`, 1,727 lines)](#31-the-table-37-servers-lspserverts-1727-lines)
  - [3.2 `spawn` is where "initialization" is defined](#32-spawn-is-where-initialization-is-defined)
  - [3.3 Client (`lsp/client.ts`, 209 lines)](#33-client-lspclientts-209-lines)
  - [3.4 `index.ts` selection details](#34-indexts-selection-details)
- [4. MCP — the parts doc 09 summarised](#4-mcp--the-parts-doc-09-summarised)
  - [4.1 `create()` is a two-phase gate](#41-create-is-a-two-phase-gate)
  - [4.2 `tools()` re-derives per-call timeouts from live config](#42-tools-re-derives-per-call-timeouts-from-live-config)
  - [4.3 Timeout defaults, actually](#43-timeout-defaults-actually)
  - [4.4 Reconnect/replace semantics](#44-reconnectreplace-semantics)
  - [4.5 OAuth flow, concretely](#45-oauth-flow-concretely)
- [5. `format/index.ts` — the state machine (formatter table itself was already complete)](#5-formatindexts--the-state-machine-formatter-table-itself-was-already-complete)
- [6. CLI commands read in this pass](#6-cli-commands-read-in-this-pass)
  - [6.1 `cli/cmd/session.ts` (134)](#61-clicmdsessionts-134)
  - [6.2 `cli/cmd/pr.ts` (101)](#62-clicmdprts-101)
  - [6.3 `cli/cmd/debug/*`](#63-clicmddebug)
- [7. Corrections to the existing documents](#7-corrections-to-the-existing-documents)
  - [7.1 `08` §5 step 2 — global config is not "the first existing file" (fixed)](#71-08-5-step-2--global-config-is-not-the-first-existing-file-fixed)
  - [7.2 `08` §5.3 — comment preservation only applies to `.jsonc` (fixed)](#72-08-53--comment-preservation-only-applies-to-jsonc-fixed)
  - [7.3 `08` §5.4 — caching is per instance, and `invalidate` takes `wait` (fixed)](#73-08-54--caching-is-per-instance-and-invalidate-takes-wait-fixed)
  - [7.4 `16` §12 — why `unquoteGitPath` exists (refined)](#74-16-12--why-unquotegitpath-exists-refined)
  - [7.5 `09` §2 — add the timeout-default inconsistency](#75-09-2--add-the-timeout-default-inconsistency)
  - [7.6 `09` §3 — add the table and the install ladder](#76-09-3--add-the-table-and-the-install-ladder)
- [8. Debt and oddities found in this pass](#8-debt-and-oddities-found-in-this-pass)

<!-- /toc -->

Doc 16 ended with a list of what had not been read. This pass closes most of it by reading whole bodies again
rather than symbol-grepping:

| Area | Module(s) | Lines read |
|---|---|---|
| Config schemas + loader | `config/config.ts` | 231–599 (all remaining schemas), 700–1,137 (the loader, writes, cache) |
| Config path resolution | `config/paths.ts` | `projectFiles` / `directories` semantics |
| Git plumbing | `git/index.ts` | full (243) |
| LSP builtin table | `lsp/server.ts` | all 1,727 lines: every one of the 37 entries, its root resolver, install path and argv |
| LSP lifecycle | `lsp/index.ts` (1–421), `lsp/client.ts` (209) | full |
| MCP transports/lifecycle | `mcp/index.ts` | 1–633 (all) |
| Format service state | `format/index.ts` | full (161) — `formatter.ts` was already complete in `15` §3.1 |
| CLI commands | `cli/cmd/{session,pr}.ts`, `cli/cmd/debug/*` | full |

Where this contradicts an earlier document, §7 lists the correction and the document has already been fixed.

---

## 1. `config/config.ts` — the loader, in code order

### 1.1 Schemas that were missing from doc 08

These matter because they *are* the public config surface and several encode behaviour nothing else documents.

**`Config.McpLocal` / `McpRemote`** — both `.strict()`, discriminated on `type`:
`local{command[], environment?, enabled?, timeout?}` / `remote{url, enabled?, headers?, oauth?: OAuth|false, timeout?}`.
Both timeout fields carry the description *"Defaults to 5000 (5 seconds)"* — **the code default is 30,000 ms**
(`MCP.DEFAULT_TIMEOUT = 30000` in `mcp/index.ts`). The descriptions are wrong; see §4.3.

`oauth: false` is a three-state field: absent means "auto-detect and try OAuth", an object supplies
`clientId`/`clientSecret`/`scope`, `false` disables OAuth entirely (and makes `supportsOAuth()` return false).

**`Config.Permission`** — a `preprocess` → validate → `transform` pipeline, not a plain object:

```js
preprocess(val) = isPlainObject(val) ? {__originalKeys: Object.keys(val), ...val} : val
object: {__originalKeys?, read, edit, glob, grep, list, bash, task, external_directory?, todowrite?,
         question?, webfetch?, websearch?, codesearch?, lsp?, doom_loop?, skill?}
        .catchall(PermissionRule).or(PermissionAction)
transform(x) = typeof x === "string" ? {"*": x} : {only the keys the user actually wrote}
```

Two behaviours fall out:

- A bare string (`"permission": "ask"`) becomes `{"*": "ask"}` — one wildcard rule for every tool.
- `__originalKeys` exists so the *transform* can drop every key the user did not write. Without it, zod's
  object would materialise the optional keys as `undefined` entries, and `Config.update`/`updateGlobal` (which
  serialise the resolved object back to disk) would grow the user's file with `"todowrite": null`-style noise on
  every save. It is a **round-trip-fidelity** hack, and it is why `permission` is the only config section that
  needs one.
- Note the shape asymmetry: `read/edit/glob/grep/list/bash/task/external_directory/lsp/skill` accept
  `PermissionRule` = action **or** `{pattern: action}` map; `todowrite/question/webfetch/websearch/codesearch/
  doom_loop` accept only a bare action. So `webfetch` cannot be pattern-scoped via config, while `bash` can.

**`Config.Agent`** — `.catchall(zod.any())` plus a transform that:

1. collects every unknown key into `options` (so plugin-defined agent fields survive validation);
2. converts the deprecated `tools: {name: bool}` map into `permission`, with
   `write|edit|patch|multiedit` **all collapsing into `edit`**;
3. applies `permission` *after* `tools`, so an explicit `permission` wins;
4. maps deprecated `maxSteps` → `steps`.

`variant` is documented in-line as *"applies only when using the agent's configured model"* — which is exactly
what `createUserMessage` implements (`16` §2). `color` accepts `#rrggbb` or one of seven theme roles.

**`Config.Keybinds`** — 90+ keys, every one `.optional().default(...)`, `.strict()`. The defaults are the real
keymap (e.g. `app_exit: "ctrl+c,ctrl+d,<leader>q"`, `input_newline: "shift+return,ctrl+return,alt+return,ctrl+j"`,
`messages_page_up: "pageup,ctrl+alt+b"`). Because defaults are attached at the schema level, an unset key is
materialised *with its default* during parsing — so a config file never needs to list keymaps, but the resolved
config always contains all of them.

**`Config.Server`** `{port, hostname, mdns, mdnsDomain, cors?}` (`.strict()`), **`Config.Skills`**
`{paths?, urls?}` (URL skill fetching is a real feature: `.well-known/skills/`), **`Config.Command`**
`{template, description?, agent?, model?, subtask?}` (no name — the name is the record key).

**`Config.Provider`** = `ModelsDev.Provider.partial()` extended with `whitelist[]`, `blacklist[]`,
`models{...variants{disabled?, ...}}`, and `options{apiKey, baseURL, enterpriseUrl, setCacheKey, timeout?:
number|false, chunkTimeout?, ...any}` (`.strict()` on the outer object). `timeout: false` disables the request
timeout entirely; `chunkTimeout` is the SSE inter-chunk watchdog — both are per-provider, and neither appears in
doc 05.

### 1.2 Load order (verified against `loadInstanceState`)

`Config.get()` is `InstanceState.use(state, s => s.config)`, so everything below runs **once per instance** and is
thrown away when the instance is disposed.

| # | Source | Scope | Notes |
|---|---|---|---|
| 1 | auth records of type `wellknown` | global | `process.env[key] = token`, `GET <url>/.well-known/opencode`, merge `wellknown.config`. **A non-OK response throws** — a broken well-known endpoint fails config load, not just that source. |
| 2 | global files | global | `config.json`, then `opencode.json`, then `opencode.jsonc` — **all three are loaded and deep-merged** (jsonc wins). Then the legacy TOML migration (§1.3). |
| 3 | `OPENCODE_CONFIG` | global | explicit path |
| 4 | project files | local | `ConfigPaths.projectFiles`, skipped with `OPENCODE_DISABLE_PROJECT_CONFIG` |
| 5 | config directories | per-dir | see below |
| 6 | `OPENCODE_CONFIG_CONTENT` | local | inline JSON |
| 7 | active account config | global | `GET <account.url>/api/config`; providers recorded in `consoleManagedProviders`; errors logged at `debug` |
| 8 | managed dir | global | `<managedDir>/{opencode.json,opencode.jsonc}` |
| 9 | managed preferences | — | macOS plist, merged without a scope label |
| 10 | `mode` → `agent` | — | each legacy mode becomes `mode: "primary"` |
| 11 | `OPENCODE_PERMISSION` | — | `deepMerge(permission, JSON.parse(env))` |
| 12 | `tools` → `permission` | — | same collapse as in `Agent`; `deepMerge(perms, permission)` so an explicit `permission` still wins |
| 13 | defaults | — | `username` from `os.userInfo()`, `autoshare:true` → `share:"auto"`, `OPENCODE_DISABLE_AUTOCOMPACT` → `compaction.auto=false`, `OPENCODE_DISABLE_PRUNE` → `compaction.prune=false` |

Step 5, per directory — `ConfigPaths.directories(directory, worktree)` returns
`[Global.Path.config, ...FS.up(".opencode") from cwd to worktree, ~/.opencode, (OPENCODE_CONFIG_DIR)]`, which is
then passed through a one-argument array helper before the loop: `for (const dir of i2(directories))`.

[verified] `i2` is remeda's **`unique`**, not a sort or a reverse. The alias is defined in the bundle outside
`src/**`, which is why it was previously undetermined; extracting the string table of the 1.3.17 build
(`opencode-darwin-x64-baseline`) and reading the entry chunk gives
`function i2(...e2) { return y2(a2, e2) }` from
`node_modules/.bun/remeda@2.26.0/node_modules/remeda/dist/chunk-QJLMYOTX.js`, where `y2` is remeda's `purry`
shim (`chunk-LFJW7BOT.js`) and `a2` builds a stateful predicate:
`(t) => seen.has(t) ? <stop sentinel> : (seen.add(t), {done:false, hasNext:true, next:t})`. The adjacent chunk
`chunk-7ZI6JRPB.js` is the same predicate over a projection — [inferred] remeda's `uniqueBy`. The region around
`config.ts` in the string table reproduces the extracted module verbatim (`directories3`, `dir2`, `log11` all
match), so the alias resolves to this definition and not to a same-named local.

So the directory list is **de-duplicated with the first occurrence winning, order otherwise preserved** — no
reordering, and a directory that appears twice is visited at its first position only. The realistic duplicates
are `OPENCODE_CONFIG_DIR === Global.Path.config` (already first in the list) and `~/.opencode` reached both by
the `FS.up` walk and by the fixed entry, so the guard is belt-and-braces rather than load-bearing for precedence.

The same alias appears at every other dedupe site in the tree: `config/tui.ts` (twice, the same directory list;
the body lives in the `tui__dup2.ts` split segment), `config/tui-migrate.ts` (`i2(input.directories)` and
`i2(files)` before probing existence; body in `tui-migrate__dup2.ts`), and
`provider/transform.ts:180` (`i2([...system, ...final])`, where the `Set` compares message objects by reference,
so it removes only a message that appears in both lists).

The loop body, per directory in that order:

```js
if (dir.endsWith(".opencode") || dir === OPENCODE_CONFIG_DIR) {
  merge(load(opencode.json), load(opencode.jsonc));
}
installDependencies(dir)                     // background, collected in `deps`, failures only logged
result.command  = merge(result.command ?? {}, loadCommand(dir))   // {command,commands}/**/*.md
result.agent    = merge(result.agent, loadAgent(dir))             // {agent,agents}/**/*.md
result.agent    = merge(result.agent, loadMode(dir))              // {mode,modes}/*.md → mode:"primary"
track(dir, loadPlugin(dir))                                       // {plugin,plugins}/*.{ts,js} as file:// URLs
```

So markdown/plugin discovery happens for **every** directory in the list, including `~/.config/opencode` and
`~/.opencode`, not only for directories whose name is `.opencode`. `Config.waitForDependencies()` awaits the
collected `deps`.

### 1.3 Side effects that happen on *read*

Three things mutate state while loading a config, which is worth knowing before debugging "why did my file change":

1. **`$schema` injection.** If a file parses successfully and has no `$schema`, the loader sets it in memory *and
   rewrites the file on disk* with a textual insertion (`original.replace(/^\s*\{/, '{\n  "$schema": ...')`),
   swallowing any write error. Every `opencode.json` you have ever run opencode in has been edited this way.
2. **Legacy TUI keys are deleted.** `theme`, `keybinds` and `tui` at the top level are removed with
   `log.warn("tui keys in opencode config are deprecated; move them to tui.json")`. They are not migrated — they are
   dropped from the merged config (the TUI reads `tui.json` separately).
3. **Plugin path specs are resolved to `file://` URLs** relative to the config file's directory
   (`resolvePluginSpec`, with `resolvePathPluginTarget` following a package entry if the spec is a directory), and
   `plugin_origins` records `{spec, source, scope}` per plugin.

`deduplicatePluginOrigins` walks the accumulated list **in reverse**, keeps the *last* occurrence of each
plugin name (file URLs compared by URL, package specs by parsed package name), then reverses back. So a plugin
declared in both the global config and a project config is loaded once, with the project's origin recorded.

`scope(source)` classifies a source as `local` when it is `OPENCODE_CONFIG_CONTENT` or a path inside the instance,
and `global` for `http(s)` URLs and everything else.

### 1.4 Error surfaces

| Error | Raised when | Payload |
|---|---|---|
| `Config.JsonError` | JSONC parse errors | `{path, message}` where message embeds the whole file plus `"code at line L, column C"`, the offending line and a caret |
| `Config.InvalidError` | zod validation failure | `{path, issues}` |
| `Config.ConfigDirectoryTypoError` | a misspelled config directory | `{path, dir, suggestion}` |

`readManagedPreferences` never throws: a failed `plutil` conversion logs a warning and the profile is skipped.

### 1.5 Writes

- **`Config.update(patch)`** writes `<instance.directory>/config.json` — not `opencode.json` — as
  `deepMerge(writable(existing), writable(patch))`, pretty-printed, then calls `Instance.dispose()` so the next read
  re-runs the whole chain. `writable()` strips `plugin_origins`.
- **`Config.updateGlobal(patch)`** targets `globalConfigFile()` = first existing of
  `~/.config/opencode/{opencode.jsonc,opencode.json,config.json}` (defaulting to the jsonc path). If that file ends
  in `.jsonc`, the patch is applied with `jsonc-parser.modify` per key (comments and formatting survive, `undefined`
  values are skipped); **otherwise the file is rewritten wholesale from the merged object** — a `.json`/`config.json`
  target loses comments and formatting. Then `invalidate(false)`.
- Both write paths are the only place where the "resolved config" is serialised back, which is why the
  `__originalKeys` trick in §1.1 and `writable()` exist.

### 1.6 Cache and invalidation

```js
[global, invalidate] = Effect.cachedInvalidateWithTTL(loadGlobal().pipe(orElseSucceed(() => ({}))), Duration.infinity)
getGlobal() = yield* global
invalidate(wait) = { yield* invalidate; task = Instance.disposeAll(); if (wait) await task;
                     emit GlobalBus {directory:"global", payload:{type: Disposed}} }
```

- The **global** file set is cached per *process* with an infinite TTL; the **per-instance** merge is cached per
  instance (`InstanceState`) and dies with it.
- `loadGlobal` is the only source that fails soft (`orElseSucceed({})` + an error log). Everything from step 1
  onward runs inside `loadInstanceState`, where step 1's `wellknown` failure is *not* caught.
- `invalidate(wait=false)` disposes all instances and emits `server.instance.disposed` with
  `directory: "global"`; `wait=true` blocks until disposal finishes. That is what the `SIGUSR2` / TUI reload path
  uses.

---

## 2. `git/index.ts` — the plumbing everything else assumes

Every git call goes through one `run()` that prepends a fixed argv prefix:

```
git --no-optional-locks
    -c core.autocrlf=false  -c core.fsmonitor=false  -c core.longpaths=true
    -c core.symlinks=true   -c core.quotepath=false   <args…>
```

Why each flag is there (verified by what breaks without it):

- `--no-optional-locks` — `git status` otherwise writes `.git/index.lock` opportunistically; opencode runs status
  constantly (VCS panel, snapshot, session summary) and must not contend with the user's own git.
- `core.autocrlf=false` — diffs and `show` output must be byte-identical to the file on disk, or snapshot hashes
  disagree between platforms.
- `core.fsmonitor=false` — a user's fsmonitor daemon is a hidden dependency and can return stale status.
- `core.longpaths` / `core.symlinks` — Windows and symlinked repos.
- `core.quotepath=false` — filenames are emitted raw (UTF-8) instead of C-quoted, so no unescaping is needed
  downstream. This is the flag whose *absence* explains `unquoteGitPath` in `16` §12 (see §7.4).

API surface (all `Effect`-wrapped, `catch → {exitCode:1, stderr}` so a missing git binary yields failures rather
than throws):

| Function | Command | Output |
|---|---|---|
| `branch(cwd)` | `symbolic-ref --quiet --short HEAD` | branch name or `undefined` on detached HEAD |
| `prefix(cwd)` | `rev-parse --show-prefix` | path from repo root to cwd (used to prefix `show`) |
| `defaultBranch(cwd)` | remote HEAD → `init.defaultBranch` → `main` → `master` | `{name, ref}` or `undefined` |
| `hasHead`, `mergeBase` | `rev-parse --verify HEAD`, `merge-base a b` | boolean / sha |
| `show(cwd, ref, file, prefix)` | `show <ref>:<prefix><file>` | `""` if missing, on non-zero exit, **or if the blob contains NUL** (binary) |
| `status(cwd)` | `status --porcelain=v1 --untracked-files=all --no-renames -z -- .` | `[{file, code, status}]` |
| `diff(cwd, ref)` | `diff --no-ext-diff --no-renames --name-status -z ref -- .` | same shape |
| `stats(cwd, ref)` | `diff … --numstat -z ref -- .` | `[{file, additions, deletions}]` |

Details that matter:

- **`--no-renames` everywhere.** Rename detection costs a full-content comparison and makes the before/after pair
  ambiguous for a diff viewer; a rename is reported as delete+add.
- **`-z` + split on `\0`** for all list outputs, so a filename containing `\n` or `\t` cannot corrupt parsing. The
  `diff` parser consumes NUL-separated tokens pairwise (code, file).
- `kind(code)` maps porcelain/diff codes to three states: `??` → `added`; anything containing `U` → `modified`
  (conflicts are edits); `A` without `D` → `added`; `D` without `A` → `deleted`; else `modified`. A rename
  (`R`) would map to `modified`, which is unreachable because of `--no-renames`.
- `status`/`diff`/`stats` all pass `-- .`, so they describe **the current working directory subtree**, not the whole
  repo — the same command run from a subdirectory reports only that subdirectory.
- `defaultBranch` prefers `refs/remotes/<primary>/HEAD` (the remote's default), falls back to the local
  `init.defaultBranch` **only if that branch exists locally**, then `main`, then `master`, else `undefined`.
  `primary()` prefers `origin`, then a single remote, then `upstream`, then the first alphabetically.

### 2.1 `Vcs` (`project/vcs.ts`, 165 lines) — branch tracking and two diff modes

`Vcs` is the cached bookkeeping layer over the `Git` plumbing above. It caches `{current, root}` (the branch and
the default branch) and **learns about branch switches from the file watcher**, not polling: it subscribes to
`FileWatcher.Event.Updated` filtered to events whose file `endsWith("HEAD")`, re-reads `git.branch()`, and
publishes `Vcs.Event.BranchUpdated` (with a `"branch changed"` log) only when the name actually differs [verified].
So `Vcs.branch()` and `Vcs.defaultBranch()` on the hot path are cache reads with no git call, and the cache stays
fresh because `.git/HEAD` is a watched file.

`Vcs.diff(mode)` ([`mode` ∈ `"git"`, `"branch"`]) returns `Snapshot.FileDiff`-style rows with `before`/`after`
content filled in:

- `"git"` mode (working-tree changes): `git.status` + `git.stats(HEAD)` concurrently; `before` = `git show HEAD:<file>`
  (empty for `added`), `after` = the worktree file read as UTF-8 — and a NUL byte in the buffer makes the content
  `""` (binary is treated as unavailable, not an error).
- `"branch"` mode (changes vs the default branch): the empty-unless case matters — if the current branch *is* the
  default branch the answer is `[]` (short-circuit before any git call), as it is when there is no `root` or no
  merge base. Otherwise `git.mergeBase(dir, root.ref)` gives the comparison ref and `compare` runs `git.diff`,
  `git.stats` and `git.status` in parallel, merging the untracked (`code === "??"`) entries into the diff list.
- `additions`/`deletions` come from numstat when present, otherwise from line counts (`count4` strips one
  trailing newline before splitting, so a file ending in `\n` counts its lines, not lines+1). Rows are
  concurrency-8 produced and sorted by file name.

[verified] Non-git projects short-circuit to `[]` before any git invocation, and the HEAD of a fresh project
without any commit is handled by `git.hasHead(dir)` checking before defaulting to ref `"HEAD"`.

---

## 3. LSP — the builtin table and the client

### 3.1 The table: 37 servers (`lsp/server.ts`, 1,727 lines)

Each entry is `{id, extensions[], root(file) → dir|undefined, spawn(root) → {process, initialization?}}`.
Every row below was read from the body, not inferred from the id. Root resolution comes in three shapes:

- `NearestRoot(include[], exclude[])` — walk up from the file to `Instance.directory`; if any `exclude` entry is
  found **first, return `undefined`** (the file belongs to another toolchain); otherwise the directory of the
  nearest `include`, else `Instance.directory`.
- A constant root: `async () => Instance.directory` (`bash`, `dockerfile`).
- A bespoke resolver for monorepos and multi-root toolchains: gradle/maven (`jdtls`, `kotlin-ls`), cargo
  workspaces (`rust`), `flake.nix` **with a worktree fallback** (`nixd`), and `prisma`'s exclusion of any
  directory that also holds a `package.json`.

The **argv** column matters as much as the paths: three servers do not launch a dedicated language server
(`ruby-lsp` runs `rubocop --lsp`, `gleam` runs `gleam lsp`, `julials` runs a Julia `-e` expression), and one
(`clojure-lsp`) has had its install branch compiled out.

| id | extensions | root strategy | how it is obtained | argv / initialization |
|---|---|---|---|---|
| `deno` | ts, tsx, js, jsx, mjs | nearest dir with `deno.json(c)`; **`undefined` if there is none — it does *not* fall back to the instance dir** | `which(deno)` | `lsp` |
| `typescript` | ts, tsx, js, jsx, mjs, cjs, mts, cts | `NearestRoot(lockfiles, exclude deno.json(c))`, falling back to `Instance.directory` | **both** `typescript/lib/tsserver.js` (resolved from the instance dir) **and** `Npm.which("typescript-language-server")`, else no server | `--stdio`; `initialization.tsserver.path` |
| `vue` | .vue | lockfiles | `which("vue-language-server")` → `Npm.which("@vue/language-server")` | `--stdio` |
| `eslint` | ts…cts, .vue | lockfiles | needs `eslint` resolvable in the project; otherwise downloads the **main-branch zip** of `microsoft/vscode-eslint` and **builds it** (`npm install`, `npm run compile`) into `bin/vscode-eslint` | `node …/eslintServer.js --stdio` |
| `oxlint` | ts…cts, .vue, .astro, .svelte | `.oxlintrc.json` + lockfiles + `package.json` | `node_modules/.bin/{oxlint,oxc_language_server}` walking up to the worktree, then `PATH`; probes `oxlint --help` for `--lsp` | `--lsp`, else no args |
| `biome` | ts…cts, json(c), vue, astro, svelte, css, graphql, html | `biome.json(c)` + lockfiles | `node_modules/.bin/biome` → `PATH` → `Module.resolve("biome")` → `Npm.which("biome")` | `lsp-proxy --stdio` |
| `gopls` | .go | `go.work` first, else `go.mod`/`go.sum` | `which("gopls")`, else `go install golang.org/x/tools/gopls@latest` with `GOBIN=bin` (requires `go`) | — |
| `ruby-lsp` | .rb, .rake, .gemspec, .ru | `Gemfile` | **the binary is `rubocop`**: `which("rubocop")`, else `gem install rubocop --bindir bin` | `--lsp` |
| `ty` | .py, .pyi | pyproject.toml, ty.toml, setup.py/cfg, requirements.txt, Pipfile, pyrightconfig.json | **returns immediately unless `OPENCODE_EXPERIMENTAL_LSP_TY` is set**; `which("ty")`, then `$VIRTUAL_ENV`/`.venv`/`venv` `bin/ty`; no download | `server`; `pythonPath` |
| `pyright` | .py, .pyi | same minus `ty.toml` | `which("pyright-langserver")` → `Npm.which("pyright")` | `--stdio`; `pythonPath` |
| `elixir-ls` | .ex, .exs | `mix.exs`, `mix.lock` | `which("elixir-ls")`, else **master zip built with mix** (`deps.get`, `compile`, `elixir_ls.release2 -o release`); requires `elixir` | `elixir-ls-master/release/language_server.sh` |
| `zls` | .zig, .zon | `build.zig` | `which("zls")`, else releases API; **arch/os hardcoded to `x64`/`darwin`** → `zls-x86_64-macos.tar.xz`, `tar -xf`, `chmod 0755` | — |
| `csharp` | .cs | `.slnx`, `.sln`, `.csproj`, `global.json` | `which("csharp-ls")`, else `dotnet tool install csharp-ls --tool-path bin` | — |
| `fsharp` | .fs, .fsi, .fsx, .fsscript | same (`.fsproj`) | `which("fsautocomplete")`, else `dotnet tool install fsautocomplete --tool-path bin` | — |
| `sourcekit-lsp` | .swift, .objc | `Package.swift`, `*.xcodeproj`, `*.xcworkspace` | `which("sourcekit-lsp")`, else `xcrun --find sourcekit-lsp` | — |
| `rust` | .rs | nearest `Cargo.toml`/`Cargo.lock`, then **walks up looking for `[workspace]`** in `Cargo.toml`, stopping at the worktree | `which("rust-analyzer")` **only — there is no install path** | — |
| `clangd` | c, cpp, cc, cxx, h, hpp, hh, hxx | `compile_commands.json`, `compile_flags.txt`, `.clangd`, `CMakeLists.txt`, `Makefile` | `PATH` → `bin/clangd` → `bin/clangd_*/bin/clangd` → releases API where the asset name must contain **both** the platform token (`darwin: "mac"`) **and** the release tag; `.zip` then `.tar.xz`; `chmod 0755`, `rm` + symlink `bin/clangd` | `--background-index --clang-tidy` |
| `svelte` | .svelte | lockfiles | `which("svelteserver")` → `Npm.which("svelte-language-server")` | `--stdio` |
| `astro` | .astro | lockfiles | needs local `typescript/lib/tsserver.js` (its `tsdk`); `which("astro-ls")` → `Npm.which("@astrojs/language-server")` | `--stdio`; `initialization.typescript.tsdk` |
| `jdtls` | .java | project markers (excluding gradle markers) → `gradlew` → `settings.gradle` | requires **Java ≥ 21**, parsed from `java -version`; else downloads the Eclipse snapshot `tar.gz` | `-jar <launcher> -configuration config_mac -data <mktemp>`, four `-Declipse.*`/`-Dlog.level` props, `--add-modules`, two `--add-opens` |
| `kotlin-ls` | .kt, .kts | `settings.gradle(.kts)` → `gradlew` → `build.gradle(.kts)` → `pom.xml` | version from GitHub `Kotlin/kotlin-lsp` latest, archive from **`download-cdn.jetbrains.com/kotlin-lsp/<version>/`**, name `…-mac-x64.zip` | `kotlin-lsp.sh --stdio` |
| `yaml-ls` | .yaml, .yml | lockfiles | `which("yaml-language-server")` → `Npm.which` | `--stdio` |
| `lua-ls` | .lua | `.luarc.json(c)`, `.luacheckrc`, `.stylua.toml`/`stylua.toml`, `selene.toml`/`.yml` | `which("lua-language-server")` → releases API `tar.gz`, unpacked into `bin/lua-language-server-<arch>-<platform>/` | — |
| `php intelephense` | .php | `composer.json`, `composer.lock`, `.php-version` | `which("intelephense")` → `Npm.which` | `--stdio`; `telemetry.enabled = false` |
| `prisma` | .prisma | `NearestRoot([schema.prisma, prisma/schema.prisma, prisma], exclude [package.json])` — a `prisma/` dir behind a `package.json` is deliberately skipped | `which("prisma")` only | `language-server` |
| `dart` | .dart | `pubspec.yaml`, `analysis_options.yaml` | `which("dart")` | `language-server --lsp` |
| `ocaml-lsp` | .ml, .mli | `dune-project`, `dune-workspace`, `.merlin`, `opam` | `which("ocamllsp")` | — |
| `bash` | .sh, .bash, .zsh, .ksh | constant `Instance.directory` | `which("bash-language-server")` → `Npm.which` | `start` |
| `terraform` | .tf, .tfvars | `.terraform.lock.hcl`, `terraform.tfstate`, `*.tf` | `which("terraform-ls")` → HashiCorp releases API (`builds[]` matched on os/arch) | `serve`; `experimentalFeatures` |
| `texlab` | .tex, .bib | `.latexmkrc`, `latexmkrc`, `.texlabroot`, `texlabroot` | `which("texlab")` → GitHub releases, `texlab-x86_64-macos.tar.gz` | — |
| `dockerfile` | `.dockerfile` **and the bare filename `Dockerfile`** | constant instance dir | `which("docker-langserver")` → `Npm.which("dockerfile-language-server-nodejs")` | `--stdio` |
| `gleam` | .gleam | `gleam.toml` | `which("gleam")` | `lsp` |
| `clojure-lsp` | .clj, .cljs, .cljc, .edn | `deps.edn`, `project.clj`, `shadow-cljs.edn`, `bb.edn`, `build.boot` | `which("clojure-lsp")` **only — the install branch is compiled out (`if (!bin && false) {}`)** | `listen` |
| `nixd` | .nix | `flake.nix` root if it is not the instance dir, else **the worktree** if it differs from the directory, else the directory | `which("nixd")` | — |
| `tinymist` | .typ, .typc | `typst.toml` | `which("tinymist")` → GitHub releases, `tinymist-x86_64-apple-darwin.tar.gz`, `tar --strip-components=1` | — |
| `haskell-language-server` | .hs, .lhs | `stack.yaml`, `cabal.project`, `hie.yaml`, `*.cabal` | `which("haskell-language-server-wrapper")` | `--lsp` |
| `julials` | .jl | `Project.toml`, `Manifest.toml`, `*.jl` | `which("julia")` — there is no `julia-ls` binary; the server is a Julia expression | `--startup-file=no --history-file=no -e "using LanguageServer; runserver()"` |

Four things this table shows:

1. **`deno` shadows `typescript` by exclusion, not by priority.** `Typescript.root` passes
   `["deno.json","deno.jsonc"]` as *exclude* patterns, so in a Deno project the TS server resolves to `undefined`
   and the Deno server wins. `getClients` iterates `Object.values(servers)` in insertion order and spawns **every**
   server that matches, so without the exclusion a `.ts` file would get two clients.
2. **There is no single install ladder — there are four mechanisms, and twelve servers cannot install themselves
   at all.** Counted from the table: 10 servers resolve through `Npm.which` (which installs into
   `Global.Path.cache/packages/<pkg>` when the bin is missing),
   4 through a package manager (`go install`, `gem install`, `dotnet tool install` ×2), 10 through a direct
   download (eslint, elixir-ls, zls, clangd, jdtls, kotlin-ls, lua-ls, terraform, texlab, tinymist), 1 through
   `xcrun`, and **12 are `which`-only** (deno, oxlint, ty, rust, prisma, dart, ocaml, gleam, clojure-lsp, nixd,
   haskell-language-server, julials) — they log a hint and return `undefined`. `OPENCODE_DISABLE_LSP_DOWNLOAD`
   gates only the `Npm.which` and download paths.
3. **Two servers build during install.** `eslint` runs `npm install && npm run compile` and `elixir-ls` runs
   `mix deps.get && mix compile && mix elixir_ls.release2` in `Global.Path.bin`. A first edit of a `.ex` file can
   therefore start an Erlang build; both are behind the disable flag but not behind any confirmation prompt.
4. **Platform is baked in at build time.** Most downloaders contain `const platform = "darwin"; const arch = "x64";`
   (plus dead `"win32"` / `"arm64"` branches and `const isWindows = false`), so this x86_64 binary fetches
   `*-mac-x64`/`*_x86_64` assets regardless of the host CPU. On an arm64 Mac that means Rosetta-translated servers
   or a download failure when no universal asset exists.

### 3.2 `spawn` is where "initialization" is defined

Each server decides its own args and `initialization` object (`clangd: --background-index --clang-tidy`,
`typescript: {tsserver:{path}}`, `astro: {typescript:{tsdk}}`, `intelephense` disables telemetry, `terraform`
enables two `experimentalFeatures`; `gopls`, `rust`, `zls` and most others pass no flags at all). That object is
then used **twice** by the
client: as `initializationOptions` in `initialize`, and as the settings payload in
`workspace/didChangeConfiguration` — so one field configures the server both at handshake and afterwards.

### 3.3 Client (`lsp/client.ts`, 209 lines)

- Transport is `vscode-jsonrpc` over the child's stdio (`StreamMessageReader/Writer`), not LSP's own package — one
  fewer dependency, and the notification names are plain strings.
- Handshake: `initialize` with `rootUri`, `processId`, `workspaceFolders: [{name:"workspace", uri: root}]`,
  `initializationOptions`, and capabilities `{window.workDoneProgress, workspace.configuration,
  workspace.didChangeWatchedFiles.dynamicRegistration, textDocument.synchronization{didOpen, didChange},
  textDocument.publishDiagnostics.versionSupport}`. The request is bounded by **45 s** (`withTimeout(…, 45000)`), and
  a timeout is wrapped in `LSPClient.InitializeError{serverID}`.
- It answers four server→client requests so servers do not hang: `window/workDoneProgress/create` → `null`,
  `workspace/configuration` → `[initialization ?? {}]`, `client/registerCapability`/`unregisterCapability` → `void`,
  `workspace/workspaceFolders` → the single root folder.
- **File versioning is manual.** `notify.open(path)` keeps `files[path] = version`; first call sends
  `textDocument/didOpen` (version 0, languageId from `LANGUAGE_EXTENSIONS[ext] ?? "plaintext"`) preceded by
  `workspace/didChangeWatchedFiles{type:1}`; later calls send `didChangeWatchedFiles{type:2}` then
  `textDocument/didChange` with the **whole file text** as the single content change and version+1. There is no
  incremental sync and no `didClose` — opencode never tells a server a file was closed, so server memory grows with
  every file touched in a long session. [verified: no didClose anywhere in the module]
- **Diagnostics are event-driven with a debounce.** `publishDiagnostics` writes `Map<path, Diagnostic[]>` and
  publishes `lsp.client.diagnostics{serverID, path}`; `waitForDiagnostics(path)` resolves when that event fires for
  the path+server and **150 ms** pass without another one (`DIAGNOSTICS_DEBOUNCE_MS`), capped at **3 s** overall,
  error swallowed. That 3 s cap is why `debug lsp diagnostics` also sleeps 1 s (`14` §13) — belt and braces.
- `shutdown()` = `connection.end()` → `dispose()` → `Process.stop(child)`.

### 3.4 `index.ts` selection details

- `cfg.lsp === false` → no servers; else the builtin table keyed by `id`, then `filterExperimentalServers`
  (`OPENCODE_EXPERIMENTAL_LSP_TY` deletes `pyright`, otherwise deletes `ty` — exactly one Python server exists).
- A config entry for a **new** id must supply `extensions` (enforced by the `.refine` in `Config.Info`, `16` §9.5);
  its `root` defaults to `async () => Instance.directory`, and its `spawn` is replaced wholesale by
  `spawn(cmd[0], cmd.slice(1), {cwd: root, env: {...process.env, ...item.env}})`.
- `getClients(file)` returns `[]` for a path outside the instance, spawns at most one client per
  `(root, serverID)`, coalesces concurrent spawns through `spawning: Map<key, Promise>`, and permanently records
  failures in `broken: Set<key>`.
- `hasClients(file)` re-implements the same match loop **without spawning**, which is what the `lsp` tool calls
  before reporting "No LSP server available for this file type."
- `workspaceSymbol` filters to `[Class, Function, Method, Interface, Variable, Constant, Struct, Enum]` and caps at
  **10** results across all clients.
- `definition`/`references`/`implementation`/`documentSymbol`/`hover`/call-hierarchy all swallow per-client errors
  with `.catch(() => [])`, so a broken server contributes nothing instead of failing the tool call.

---

## 4. MCP — the parts doc 09 summarised

`09` §2 already documents the transport ladder, the auth state machine, tool bridging and process hygiene
correctly. Reading `mcp/index.ts` end to end adds:

### 4.1 `create()` is a two-phase gate

```
create(key, cfg):
  enabled === false                → {status:{status:"disabled"}}
  connectRemote | connectLocal     → {client, status}
  no client                        → {status}                     (failed/needs_auth/needs_client_registration)
  defs(key, client, cfg.timeout)   → listTools with timeout
  listTools failed                 → close client, {status:"failed", error:"Failed to get tools"}
  else                             → {mcpClient, status, defs}
```

A server that connects but cannot list tools is **abandoned**, not kept in a half-usable state — the tool surface is
the only reason the client exists.

### 4.2 `tools()` re-derives per-call timeouts from live config

```js
const entry = isMcpConfigured(cfg.mcp[clientName]) ? cfg.mcp[clientName] : undefined;
const timeout = entry?.timeout ?? cfg.experimental?.mcp_timeout;      // ← note: no DEFAULT_TIMEOUT fallback
result[`${sanitize(clientName)}_${sanitize(tool.name)}`] = convertMcpTool(tool, client, timeout);
```

So the *connection* timeout falls back to 30 000 ms, but the *per-tool-call* timeout falls back to
`experimental.mcp_timeout` (which may be `undefined`, passing through to the SDK's own behaviour). Two different
defaults for the same knob, in the same module.

### 4.3 Timeout defaults, actually

| Context | Value |
|---|---|
| `MCP.DEFAULT_TIMEOUT` (connect, `listTools` when unspecified) | **30 000 ms** |
| `Config.McpLocal/McpRemote.timeout` description | "Defaults to 5000 (5 seconds)" — **wrong** |
| `experimental.mcp_timeout` | unset unless configured |
| per-tool call | `entry.timeout ?? experimental.mcp_timeout` (no constant) |

### 4.4 Reconnect/replace semantics

`createAndStore` **always closes the previous client before installing the new one** (`closeClient` then
`clients[name] = ...`), and deletes `defs[name]` inside `closeClient`. So `MCP.add`/`connect` are
"replace", not "add". `disconnect` closes, deletes the client, and sets status `disabled` — which `status()`
will report as `disabled` even though the config still has the server enabled: the report is *runtime* state, not
config state, and only a new instance (config reload) will reconnect it.

`watch()` installs a `ToolListChangedNotificationSchema` handler that re-lists and publishes `mcp.tools.changed`,
guarded by two identity checks (client still current, status still connected) around the await — documented in
`09`, verified again here.

### 4.5 OAuth flow, concretely

`startAuth(name)` → `McpOAuthCallback.ensureRunning()` (a local HTTP listener), 32 random bytes hex as `state`,
`auth.updateOAuthState`, build `McpOAuthProvider`, connect a `StreamableHTTPClientTransport`; **the interesting
part** is that the connect is expected to *fail* with `UnauthorizedError`, and the redirect URL captured by
`onRedirect` is returned as `authorizationUrl` while the transport is stashed in `pendingOAuthTransports`.
`authenticate()` opens the browser (a 500 ms grace before treating a still-running browser process as success,
`exit != 0` → failure, failure → publish `mcp.browser.open.failed` and let the user copy the URL), waits for the
callback, then **compares the returned state with the stored one and throws "OAuth state mismatch - potential CSRF
attack"** on mismatch, clearing the stored state either way. `finishAuth` calls `transport.finishAuth(code)`, clears
the PKCE verifier, and re-runs `createAndStore`.

---

## 5. `format/index.ts` — the state machine (formatter table itself was already complete)

- `state` is created per instance: builtins into `formatters[name]`, then config entries merged with
  `{extensions: [], ...item}` and `enabled: async () => info3.command ?? false`. Consequence: a config entry for an
  **existing** formatter replaces `extensions` with `[]` unless it re-declares them, and its `enabled()` becomes
  "is a command configured" — the builtin probe is gone.
- `getCommand(item)` caches `false` *and* the command array (`commands[item.name]`), so a formatter that was absent
  at first check is never re-probed for the life of the instance. A newly installed binary requires an instance
  reload.
- `getFormatter(ext)` filters by `extensions.includes(ext)`, resolves each and returns **all** enabled ones — a file
  can be formatted repeatedly, in `Object.values` order (the builtin table's declaration order), with no
  mutual-exclusion logic at all. `biome` and `prettier` both enabled means both run.
- `formatFile` spawns with `cwd: InstanceState.directory` (not the worktree), `env: item.environment,
  extendEnv: true`; `$FILE` is replaced by plain string substitution in every argv element; a non-zero exit logs
  `failed` and continues to the next formatter.
- `Format.status()` probes **every** formatter (`isEnabled` per entry), which is why the TUI formatter list can be
  slow on a cold cache: it runs all the probes (`which`, `package.json` scan, `air --help`, `uv format --help`).

---

## 6. CLI commands read in this pass

### 6.1 `cli/cmd/session.ts` (134)

- `session delete <id>` validates existence with `Session.get` (exit 1 with a red error if missing), then
  `Session.remove`, then prints a success line using `UI.Style` constants.
- `session list` takes `--max-count/-n` and `--format table|json`:
  - `Session.list({roots: true, limit})` — roots only, so child/subagent sessions never appear.
  - Table: column widths `max(20, longest id)` and `max(25, longest title)`, header underlined with `─`, title
    truncated via `Locale.truncate`, time via `Locale.todayTimeOrDateTime` (time for today, date otherwise).
  - **Paging:** only when `stdout.isTTY && !maxCount && format === "table"` — it spawns a pager and writes the
    table into stdin. On darwin `pagerCmd()` is hardcoded `["less", "-R", "-S"]` (the platform branch was folded at
    build time exactly like `file/protected.ts`, `16` §10.5); the dead Windows branch would have resolved a bundled
    `less.exe` next to git bash, then fallen back to `cmd /c more`.
  - JSON output is a stable projection (`id,title,updated,created,projectId,directory`), not the raw session object
    — deliberate, since the raw object carries `revert`, `share`, `permission` and token data.

### 6.2 `cli/cmd/pr.ts` (101)

`pr <number>` is the only command that shells out to a *different* tool (`gh`) and then re-executes opencode:

1. `Instance.provide(cwd)` then refuse unless `Instance.project.vcs === "git"`.
2. `gh pr checkout <n> --branch pr/<n> --force` — the local branch name is always `pr/<n>`, force-updated.
3. `gh pr view <n> --json headRepository,headRepositoryOwner,isCrossRepository,headRefName,body`.
4. **Cross-repository PRs**: if the head repo is a fork, add a remote named after the *fork owner* (skip if present)
   and `git branch --set-upstream-to=<owner>/<headRefName> pr/<n>` so pushes go to the fork, not upstream.
5. **Session import from the PR body**: a regex for `https://opncd.ai/s/<id>`; if found it runs
   `opencode import <url>` as a subprocess and scrapes `Imported session: <id>` from stdout with a second regex.
6. Finally spawns `opencode [-s <sessionId>]` with inherited stdio and propagates a non-zero exit as a thrown error.

Two fragilities worth recording: the import round-trip parses **human-readable stdout** of its own CLI, and the
`opencode` binary is invoked by bare name from `PATH` (not `process.execPath`), so a different installed version can
be launched than the one running the command.

### 6.3 `cli/cmd/debug/*`

Already documented in `14` §13 from the same read; nothing new. The one detail worth adding there was the tool
context's `ask()` which *enforces* rather than prompts — that is in `14` §13 now.

---

## 7. Corrections to the existing documents

### 7.1 `08` §5 step 2 — global config is not "the first existing file" (fixed)

The document said the global source is "the first existing of `opencode.jsonc`, `opencode.json`, `config.json`" and
mentioned a "legacy `config.json` → `opencode.json` rewrite". The code loads **all three** and deep-merges them in
the order `config.json` → `opencode.json` → `opencode.jsonc` (jsonc wins), and the legacy migration is a **TOML**
file literally named `config` in the config dir: it is imported (`import(..., {with:{type:"toml"}})`, its
`provider`+`model` collapsed into `model: "provider/model"`), merged **under** the file sources, written out as
`config.json`, and then unlinked. The "first existing" logic belongs to `globalConfigFile()`, which is only used to
choose the *write* target of `updateGlobal`.

### 7.2 `08` §5.3 — comment preservation only applies to `.jsonc` (fixed)

`patchJsonc` is used only when the write target ends in `.jsonc`. Otherwise `updateGlobal` re-serialises the whole
merged object with `JSON.stringify(…, null, 2)`, and `Config.update` always writes `config.json` the same way.

### 7.3 `08` §5.4 — caching is per instance, and `invalidate` takes `wait` (fixed)

The global file layer is process-wide with an infinite TTL; the merged config is per instance. `invalidate(wait)`
clears the global cache, disposes **all** instances, and emits `server.instance.disposed{directory:"global"}`;
`wait=true` awaits disposal. The document's `invalidate(clearDeps)` signature and its "read once per process"
claim were both wrong.

### 7.4 `16` §12 — why `unquoteGitPath` exists (refined)

`16` explained it as git's default `core.quotePath`. True, but incomplete: the snapshot engine already passes
`-c core.quotepath=false` on every name-listing command (`Snapshot` keeps two arg sets, `cfg` and
`quote = [...cfg, "-c", "core.quotepath=false"]`), so **newly written** `session_diff` entries cannot be quoted. The
unquoting in `session/summary.ts` therefore repairs diffs persisted by an earlier build (it rewrites storage when a
path changes) — a lazy migration, not a live requirement. [verified: two arg sets + rewrite-on-read; inferred:
that the flag was added after the diffs were first written]

### 7.5 `09` §2 — add the timeout-default inconsistency

`09` correctly states the 30 000 ms connect timeout. It did not note that (a) the config schema's own description
says 5 000 ms, and (b) per-tool-call timeouts do **not** use the constant — they use
`entry.timeout ?? experimental.mcp_timeout`. See §4.3.

### 7.6 `09` §3 — add the table and the install ladder

`09` §3 described selection, lazy spawning and `broken` accurately but treated the server table as opaque. §3.1
above lists all 37 with root strategies and how each binary is obtained, and §3.1's `deno`-excludes-`typescript`
rule is a genuine correction of the implicit "one server per language" assumption.

---

## 8. Debt and oddities found in this pass

1. **Config load writes to the user's files.** `$schema` injection rewrites `opencode.json` on read. Any tool that
   merely *opens* a project edits its config once. It is idempotent and small, but it is a write on a read path.
2. **A broken `wellknown` endpoint fails config load.** Step 1 throws on a non-OK HTTP response, unlike every other
   remote source (account config, global load) which degrades. One unreachable org URL blocks startup.
3. **Two permission shapes.** Per-pattern rules are only possible for 9 of 15 permission keys; the rest accept a
   bare action. The asymmetry is invisible in the docs and surfaces only as a zod error.
4. **`__originalKeys` is load-bearing for writes.** Removing that preprocess would silently bloat every
   `Config.update`-written file with defaulted keys.
5. **`session list` pager is darwin-only in this build** (`if (true) return ["less", ...]`), so on the platform the
   binary actually targets, a missing `less` produces a spawn failure rather than the intended `more` fallback.
6. **No `textDocument/didClose`.** Every file the agent reads stays open in every LSP server for the life of the
   instance — server-side memory grows monotonically with the number of touched files.
7. **Formatting has no ordering or exclusivity.** With `biome` and `prettier` both enabled, both run over the same
   file in table order; with a config override that omits `extensions`, the formatter silently stops matching.
8. **`Formats.status()` probes everything**, running `air --help` and `uv format --help` subprocesses just to render
   a list.
9. **`pr` parses its own CLI's stdout** (`Imported session: <id>`) and invokes `opencode` from `PATH`, so the
   child process may not be the binary the user is running.
10. **The LSP installers log something other than what they do.** `elixir-ls` announces "downloading elixir-ls
    from GitHub releases" and then fetches `archive/refs/heads/master.zip`, building it with `mix` — a master
    build, not a release, on every fresh machine.
11. **`clojure-lsp` can never install.** Its install branch is `if (!bin && false) {}` — the condition was
    compiled out, so the server is dead on a machine without `clojure-lsp` on `PATH`, and the log line claims it
    should be installed.
12. **MCP timeouts disagree three ways** (schema description 5 s, connect 30 s, per-call "whatever
    `experimental.mcp_timeout` is"), and `tools()` silently drops servers whose defs went missing.
