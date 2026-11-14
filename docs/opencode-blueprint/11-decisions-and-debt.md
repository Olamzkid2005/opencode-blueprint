# 11 — Engineering decisions, trade-offs and technical debt

<!-- toc -->
## Contents

- [1. The seven decisions that shape everything](#1-the-seven-decisions-that-shape-everything)
  - [D1. One binary, everything embedded](#d1-one-binary-everything-embedded)
  - [D2. Effect as the service substrate](#d2-effect-as-the-service-substrate)
  - [D3. Per-directory instances, not per-process projects](#d3-per-directory-instances-not-per-process-projects)
  - [D4. Messages as parts + event stream + SQLite projection](#d4-messages-as-parts--event-stream--sqlite-projection)
  - [D5. Git as the undo engine (`src/snapshot`)](#d5-git-as-the-undo-engine-srcsnapshot)
  - [D6. Prompt text as versioned assets next to code](#d6-prompt-text-as-versioned-assets-next-to-code)
  - [D7. Fail closed on permissions, degrade on capabilities](#d7-fail-closed-on-permissions-degrade-on-capabilities)
- [2. Secondary decisions worth knowing](#2-secondary-decisions-worth-knowing)
  - [2.1 Session prompt reminders (`session/prompt/plan.txt` 28, `max-steps.txt` 17, `build-switch.txt` 7)](#21-session-prompt-reminders-sessionpromptplantxt-28-max-stepstxt-17-build-switchtxt-7)
- [3. Technical debt, concretely](#3-technical-debt-concretely)
  - [3.1 Verified duplication and boilerplate](#31-verified-duplication-and-boilerplate)
  - [3.2 Inconsistencies found in code](#32-inconsistencies-found-in-code)
  - [3.3 Structural weaknesses](#33-structural-weaknesses)
  - [3.4 Things the bundle suggests are unfinished](#34-things-the-bundle-suggests-are-unfinished)
- [4. Coverage log — what was actually read](#4-coverage-log--what-was-actually-read)
  - [4.1 Method caveat](#41-method-caveat)
- [5. If you were to change one thing](#5-if-you-were-to-change-one-thing)

<!-- /toc -->

This document collects the *why* behind the design, then the debt the code itself reveals. Each claim is tagged;
decisions are stated as what the code implements, and rationale is marked [inferred] where it is my reading rather
than something the code says.

---

## 1. The seven decisions that shape everything

### D1. One binary, everything embedded

**What:** `Bun.build --compile` produces a 130 MB Mach-O containing the server, TUI, worker and 4 JS modules
(see doc 01). Dependencies are resolved at build time; the model catalogue is a 1.76 MB literal
(`provider/models-snapshot.js`); DB migrations are bundled SQL strings; the web UI is a generated JS module.

**Why [inferred]:** zero-install distribution and no runtime resolution failures. The product is installed by
`curl | bash`, brew, choco, scoop (all branches exist in `installation/index.ts`).

**Trade-off [verified consequences]:** 130 MB download; a cache wipe on `CACHE_VERSION` bump; catalogue updates
require a release; downgrades are hazardous (bundled migrations only move forward).

### D2. Effect as the service substrate

**What:** every service is `class Service extends ServiceMap.Service()("@opencode/X")` + `Layer.effect` + a
`makeRuntime` "legacy" wrapper exposing `X.method()` promise APIs, plus `InstanceState` for per-directory state.

**Why [inferred]:** the codebase needs cancellation, resource finalizers and structured concurrency across tools,
streams, subprocesses and DB writes. Effect gives all three with a typed dependency graph. The dual API
(`X.method()` vs `yield* X.Service`) lets UI/CLI code stay plain `async/await` while core logic composes effects.

**Trade-off:** two calling conventions; stack traces traverse Effect internals; contributors must learn Effect; the
`runPromise3((svc) => …)` wrappers are pure boilerplate (~15 lines per service, repeated in every module).

### D3. Per-directory instances, not per-process projects

**What:** `InstanceState` is a `ScopedCache` keyed by directory; each entry builds its own Provider, Agent, Skill,
LSP, MCP, Tool registry, Permission state and finalizers.

**Why [inferred]:** the same process serves the TUI, remote HTTP clients and plugins, possibly for several
directories (workspaces). Per-directory scoping makes "project config, project tools, project LSP" natural and
disposal correct.

**Trade-off:** no sharing (every directory re-reads config, re-connects MCP), and `Auth`/`Global` config are
deliberately *not* scoped — an inconsistency you must know about when debugging "why is my provider config stale".

### D4. Messages as parts + event stream + SQLite projection

**What:** `message.data`/`part.data` JSON columns; writes go through `SyncEvent.run` → projectors → DB and a bus
publish; reads go straight to SQLite. Deltas are published but not persisted.

**Why [inferred]:** a single ordered part list reconstructs a turn (tool calls, steps, patches, compaction),
one event type drives every UI, and streaming text avoids per-token DB writes.

**Trade-off:** no querying inside parts; part schema evolution is code-only; the event log (`event`,
`event_sequence`) exists but the read path does not use it [verified: reads are direct selects].

### D5. Git as the undo engine (`src/snapshot`)

**What:** a separate `GIT_DIR`/`GIT_WORK_TREE` pair; `write-tree` at step start, `diff --cached --name-only` at step
finish, `read-tree` + `checkout-index -a -f` to revert.

**Why [inferred]:** correct, fast, battle-tested revert of arbitrary file changes without a bespoke VCS, and it
works even when the project is not a git repo (OpenCode brings its own index).

**Trade-off:** requires git on PATH; reverting is all-or-nothing at the tree level; snapshots are invisible to the
user's own git index (separate dir) which is good for isolation but means `git status` and OpenCode can disagree
about "current state".

### D6. Prompt text as versioned assets next to code

**What:** one `.txt` per tool (`bash.txt`, `edit.txt`, …), per-model system prompts
(`prompt/{anthropic,beast,gpt,gemini,kimi,codex,trinity,explore,compaction,summary,title,generate}.txt`), and
`SystemPrompt.provider(model)` selecting by **substring** of `model.api.id`.

**Why [inferred]:** prompt changes are the most frequent code change in an agent; keeping them out of `.ts` lets
non-code review, diffing and per-model tuning.

**Trade-off:** string matching on model IDs (`includes("gpt-4")`, `includes("codex")`, `includes("claude")`,
`toLowerCase().includes("trinity")`) is brittle — a new model ID silently falls through to `default.txt`.

### D7. Fail closed on permissions, degrade on capabilities

**What:** unknown/absent rules → `ask`; `deny` short-circuits; agent `explore` is `*: deny` + allowlist; but MCP,
LSP, share, plugins all swallow errors and continue.

**Why [inferred]:** the model is untrusted; integrations are merely unreliable.

**Trade-off:** see 10 §8 — plugin/MCP tools bypass the permission system entirely, so "fail closed" is a property
of *builtin* tools, not of the system.

---

## 2. Secondary decisions worth knowing

| Decision | Evidence | Trade-off |
|---|---|---|
| IDs are ordered (`MessageID.ascending`, `PartID.ascending`, `SessionID.descending`) | `Binary.search` in `tui/context/sync.tsx` relies on sorted ids | ids leak creation time; no UUID privacy |
| `SessionStatus` stores `idle` as absence | `status.ts:set` deletes on idle | map stays small; "idle" has no timestamp |
| Prune before compact | `compaction.prune` (20k/40k) vs `process` | cheap trim first; summarisation is the expensive fallback |
| Compaction uses a fixed template with `## Goal/Instructions/Discoveries/Accomplished` | `compaction.ts` | the summary becomes a stable interface for the next agent; less flexible |
| `read` returns `data:` URIs for images/PDF | `tool/read.ts` | no file upload path needed; base64 inflates context |
| `write` runs the formatter after writing | `Format.file(filepath)` | files stay formatted; surprising side effect for users with strict formatters |
| `write`/`edit` return LSP diagnostics (20/file, 5 other files) | `tool/write.ts` | the model self-corrects; noisy on large projects |
| Batch tool caps at 25 calls, rejects `batch`-in-`batch`, refuses MCP/external tools | `tool/batch.ts` | prevents recursion and partial external side effects; also a hard limit the model cannot reason about |
| LiteLLM proxy gets a `_noop` tool | `session/llm.ts` | works around proxies that reject tool-less requests after tool history |
| OpenAI OAuth puts the system prompt in `instructions` and **skips** max output tokens | `session/llm.ts` | required by that API shape; means no cap for those users |
| `experimental_repairToolCall` lowercases a mis-cased tool name, else routes to `invalid` | `session/llm.ts` | recovers cheap model errors; silently changes the call's intent |
| Copilot `gpt-5+` uses the Responses API | `provider.ts:shouldUseCopilotResponsesApi` | hardcoded capability, not discoverable |
| Project instructions are the first name found, not a merge | `instruction.ts` `FILES` order + `break` | one `AGENTS.md` anywhere disables `CLAUDE.md`/`CONTEXT.md`; `04` §9 |
| Instruction files are re-read every step with no size cap | `instruction.system()` per step | always current, but unbounded prompt cost; `04` §9.5 |

---

### 2.1 Session prompt reminders (`session/prompt/plan.txt` 28, `max-steps.txt` 17, `build-switch.txt` 7)

- `plan.txt` is the plan-mode `<system-reminder>`: "CRITICAL: Plan mode ACTIVE — READ-ONLY phase…
  Any modification attempt is a critical violation. ZERO exceptions." plus the delegate/researches-and-ask
  workflow.
- `max-steps.txt` is injected when the step budget hits: tools disabled, text-only response, the strict
  4-item response list.
- `build-switch.txt` is the 5-line `<system-reminder>` injected when the build agent takes over after
  plan-exit: "You are no longer in read-only mode…"

## 3. Technical debt, concretely

### 3.1 Verified duplication and boilerplate

1. **`makeRuntime` wrappers.** Every service repeats the same 10–20 line pattern to expose promise APIs. There is
   no decorator/codegen. Adding a method means editing three places (impl, service object, wrapper).
2. **`index__dup2.ts` … `index__dup6.ts`** exist as split artifacts of repeated `// src/index.ts` markers in the
   bundle — a reminder that module paths in the bundle are *not* unique; the splitter had to disambiguate. [This is
   an artefact of extraction, not a product bug.]
3. **Legacy compat shims never removed**: `mode` → `agent` rewrite, `tools` → `permission` rewrite, legacy
   `config.json` → `opencode.json`, legacy plugin export shapes, `Storage` JSON import path, two share API shapes
   (`/api/share` vs `/api/shares`).
4. **Two client conventions** (`X.method()` promise vs Effect service) with no lint rule enforcing where each is
   appropriate.

### 3.2 Inconsistencies found in code

- MCP tool naming: `client_tool` in `tools()` but `client:item` in `fetchFromClient` (prompts/resources).
- `Session.remove` is not transactional: children first, unshare best-effort, failures only logged — a failed
  child delete can leave orphans (FK CASCADE should prevent rows, but the unshare side effect is lost).
- `bash` PowerShell branch: `envValue()` contains a `if (true) return process.env[key];` dead branch (the
  case-insensitive lookup is unreachable) — evidence of a disabled compatibility path.
- `SystemPrompt.environment` interpolates `Platform: ${"darwin"}` and a bogus `` `${project.vcs, ""}` `` template —
  the build-time platform is baked in; the `directories` block emits nothing useful. This is verified dead/incorrect
  text in the prompt (a comma-expression inside a template literal).
- `read` always calls `ctx.ask({permission:"read", always:["*"]})` even though the default agent rule is `allow` —
  harmless (evaluate returns allow) but it means a user who sets `read: ask` gets a prompt on every read.
- `webfetch` stores `always:[params.url]` while every other tool stores `["*"]` — inconsistent scope semantics for
  "always".
- `SessionStatus.list()` returns `new Map(InstanceState.get(...))` — a shallow copy; callers mutating a status
  object mutate the store (status objects are small and replaced wholesale, so it is latent, not active).
- `Agent.generate` special-cases OpenAI OAuth with `streamObject` + `providerOptions{store:false}` while other
  providers use `generateObject` — a vendor workaround embedded in a generic method.

### 3.3 Structural weaknesses

1. **Model-ID string matching** everywhere (system prompt selection, Copilot Responses API, small-model priority,
   `claude` tool-id scrubbing). Every new model family needs edits in several places with no central registry.
2. **Prompt/policy coupling**: `Truncate.output` changes its instructions based on whether the agent has `task`;
   compaction's prompt is an interface. These are real contracts with no tests visible in the bundle.
3. **Compaction and pruning are heuristics with magic numbers** (20k/40k, `PRUNE_PROTECTED_TOOLS=["skill"]`,
   `1e6` cost divisor, 200k long-context threshold). None are configurable except by disabling.
4. **`doom_loop` detection** compares the last three tool calls; an agent legitimately repeating a read/format loop
   triggers an `ask` (default), which stops the turn by default. No per-tool opt-out.
5. **Single-writer SQLite** with a 5 s busy timeout is the concurrency ceiling. When the TUI and a remote client
   both drive turns in different sessions, contention is resolved by timeout, not by a queue.
6. **No client-disconnect cancellation** for in-flight turns (see 07 §5) — wasted spend.
7. **The event log is a dormant capability.** `SyncEvent` allocates a per-aggregate sequence on every write and
   `replay()` enforces strict contiguity, but `event`/`event_sequence` rows are only inserted under
   `OPENCODE_EXPERIMENTAL_WORKSPACES` (15 §6.2). With the flag on there is no retention policy in
   `sync/event.sql.ts` — the log grows without bound and nothing prunes it.
8. **`InstanceState` cache never evicts** except on `disposeAll()`; a long-lived server with many directories grows
   one full service graph per directory.
9. **Config errors are fatal at load** (`Config.JsonError` throws) with no "continue with partial config" mode,
   so one typo in `opencode.jsonc` can block startup [verified from `parseConfig`].
10. **`OPENCODE_SKIP_MIGRATIONS`** silently replaces every migration with `select 1` — a foot-gun if set in an
    environment file (schema drift with no warning beyond the log line).

### 3.4 Things the bundle suggests are unfinished

- `experimental` route group and `experimental.*` flags (`WORKSPACES`, `PLAN_MODE`, `LSP_TOOL`, `OXFMT`, `MARKDOWN`)
  gate partially built features; `control-plane/` (workspace CRUD + workspace.sql) has a schema and routes but the
  feature is behind `OPENCODE_EXPERIMENTAL_WORKSPACES`.
- `acp/agent.ts` is only 4 lines in the bundle because it is the alias module; the implementation is
  `src/acp/agent__dup2.ts` (1,470 lines). Its event bridge, permission queue and tool-state mapping are documented
  in `16` §7.
- `GitLabWorkflowLanguageModel` special-casing in `LLM.stream` (systemPrompt/toolExecutor patched onto the model
  instance) indicates an integration deep enough to require mutating a language model object.

---

## 4. Coverage log — what was actually read

Per-file mapping for all 446 modules: `17-module-index.md`. The table below is the reading-depth view; that
one is the file-by-file view, including the 3 modules no document discusses (splitter duplicates of `index.ts`).

| Depth | Modules |
|---|---|
| **Line-by-line** | `session/{index,prompt,processor,compaction,status,retry,llm,system,instruction}.ts`, `agent/agent.ts`, `plugin/index.ts`, `skill/index.ts`, `command/index.ts`, `auth/index.ts`, `share/share-next.ts`, `mcp/index.ts` (1–470), `lsp/index.ts` (1–200), `config/config.ts` (700–1010), `storage/db.ts`, `global/index.ts`, `tool/{tool,registry,bash,edit,read,write,task,batch,plan,invalid,webfetch,truncate,external-directory}.ts`, `file/{time,index,ripgrep,watcher}.ts`, `permission/{index,evaluate}.ts`, `bus/index.ts`, `provider/provider.ts` (state, getModel, getLanguage, stream), `provider/transform.ts`, `server/server.ts`, `worker.js` rpc surface, `effect/{instance-state,runner}.ts`, `snapshot/index.ts`, `pty/index.ts`, `sync/index.ts`, `shell/shell.ts`, `installation/index.ts`, `format/index.ts`, `question/index.ts`, `account/index.ts`, `patch/index.ts` (apply/verify), `worktree/index.ts` (create/boot/candidate) |
| **Line-by-line (UI/CLI)** | `tui/thread.ts`, `tui/app.tsx` (boot + provider tree + App), `tui/context/{sync,local,keybind,theme}.tsx`, `tui/routes/session/{index.tsx 1–900 + rendering, permission.tsx, question.tsx}`, `tui/component/prompt/{index.tsx, autocomplete.tsx}`, `tui/plugin/{runtime.ts, api.tsx}`, `tui/feature-plugins/system/plugins.tsx`, `cli/{bootstrap,network}.ts`, `cli/cmd/{cmd,run,serve,web,generate,export,uninstall,stats,mcp,plug,agent,providers,github}.ts` |
| **Structural (symbols + key paths)** | `tui/component/dialog-*`, `tui/feature-plugins/home/**`, `tui/util/*`, `cli/cmd/{session,models,import,upgrade,account,db,pr,acp}.ts`, `file/index.ts` (read/list paths), `control-plane/workspace.ts`, `git/*`, `npm/*`, `util/*` |
| **Line-by-line, second pass (`16`)** | `session/prompt.ts` (all 1,589 lines), `session/{message-v2,revert,summary,projectors}.ts`, `project/{instance,bootstrap}.ts`, `acp/{agent__dup2,session}.ts`, `tool/{grep,skill,lsp,websearch}.ts`, `control-plane/sse.ts`, `file/protected.ts`, `snapshot/index.ts` (`revert` + batching), `config/config.ts` (managed config + `Info` schema) |
| **Area-anchor audit (all 192 ◐ rows)** | `audit-area-anchors.py` — basename/stem, sibling file, directory path, API symbol and heading match against the cited section: 190 strong, 2 directory-only (`control-plane/adaptors/*` → `15` §12), 0 unsupported |
| **Line-by-line, sixth pass (`04` §9)** | `session/instruction.ts` (all 197 lines: `FILES`/`globalFiles`, `systemPaths`, `system`, `find`, `resolve`, `extract`), plus its call sites `tool/read.ts:209` and `session/prompt.ts:1276` |
| **Line-by-line, fifth pass (`02` §8, `05` §9)** | all 20 `util/*` modules (492 lines: `context` AsyncLocalStorage, `timeout`/`abort`, `effect-http-client` retry, `token` estimate, `which`, `hash`, `lazy`, `queue`, `effect-zod`, `update-schema`, `schema`, `fn`, `error`, `locale`, `format`, `record`, `archive`, `defer`, `iife`); all 20 `provider/sdk/copilot/**` modules (2,879 lines: the vendored OpenAI-compatible chat + responses SDK) |
| **Line-by-line, fourth pass (`18`)** | `config/config.ts` (all 1,137 lines: remaining schemas, the real merge order, `$schema` injection, write paths, cache), `git/index.ts`, `lsp/{index,client,server}.ts` (the 37-server table and install ladder), `mcp/index.ts` (all 633 lines), `format/index.ts`, `cli/cmd/{session,pr}.ts` |
| **Line-by-line, third pass** | `format/formatter.ts` (all 26 builtin entries, gates and argv), `project/{project,state,vcs}.ts` + `project.sql.ts` (`fromDirectory` identity derivation, `.git/opencode` cache), `tui/ui/{dialog,dialog-select__dup2,toast,spinner}.tsx`, `tui/feature-plugins/sidebar/*` (6 plugins: context, mcp, lsp, todo, files, footer), `cli/cmd/debug/*` (10 modules incl. the `agent --tool` executor) |
| **Not read (vendor)** | 3,291 vendor segments (`node_modules/**`): AI SDK, Effect, Solid, drizzle, tree-sitter, turndown, etc. Only their *usage* is documented. |
| **Undetermined** | vendor internals only (`node_modules/**`). The open question from earlier passes — whether LSP/ripgrep downloads are checksum-verified — is now answered: **they are not** (`10` §8.11). |

### 4.1 Method caveat

The code read is the **Bun-bundled** form: type annotations are stripped, `import` statements are replaced by
`init_*()` calls, and cross-module references appear as `exports_X` globals. Function bodies, control flow,
constants and strings are faithful; type-level design (interfaces, generics, discriminated unions) is
**reconstructed** from usage and from zod schemas, and is marked [inferred] when it matters.

---

## 5. If you were to change one thing

In order of leverage, for an engineer taking this over:

1. **Centralise permission enforcement in `Tool.define`** (make `ctx.ask` mandatory for FS/network/exec tools, and
   route MCP tools through it). Today the guarantee is per-tool discipline.
2. **Replace model-ID substring checks with a capability table** in `provider/transform.ts` + `SystemPrompt`, keyed
   by `sdkKey` and explicit model metadata.
3. **Make the event log authoritative or delete it** — currently it exists, is written, and is not read.
4. **Add an eviction policy to `InstanceState`** and a retention policy to `event`.
5. **Extract the `makeRuntime` boilerplate** into a helper so a new service is one file, not three edits.
