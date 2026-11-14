# 16 — Deep dive: the prompt engine, the message model, the instance layer

<!-- toc -->
## Contents

- [1. `resolvePart` — how a user's attachment becomes conversation (`prompt.ts` 816–1063)](#1-resolvepart--how-a-users-attachment-becomes-conversation-promptts-8161063)
  - [1.1 MCP resource parts (`source.type === "resource"`)](#11-mcp-resource-parts-sourcetype--resource)
  - [1.2 `data:` URLs](#12-data-urls)
  - [1.3 `file:` URLs — the emulation core](#13-file-urls--the-emulation-core)
  - [1.4 `agent` parts](#14-agent-parts)
  - [1.5 Validation is advisory](#15-validation-is-advisory)
- [2. `createUserMessage` — model/variant resolution (`prompt.ts` ~735–800)](#2-createusermessage--modelvariant-resolution-promptts-735800)
- [3. `runLoop` — the turn state machine (`prompt.ts` 1110–1345)](#3-runloop--the-turn-state-machine-promptts-11101345)
  - [3.1 Exit test](#31-exit-test)
  - [3.2 The task stack](#32-the-task-stack)
  - [3.3 Step budget](#33-step-budget)
  - [3.4 Mid-run user messages are rewritten](#34-mid-run-user-messages-are-rewritten)
  - [3.5 System prompt assembly order](#35-system-prompt-assembly-order)
  - [3.6 Structured output (`format.type === "json_schema"`)](#36-structured-output-formattype--json_schema)
  - [3.7 Interruption](#37-interruption)
  - [3.8 Post-loop](#38-post-loop)
- [4. `shellImpl` — the `!command` path (`prompt.ts` 627–780)](#4-shellimpl--the-command-path-promptts-627780)
- [5. `Runner` / `InstanceState` — the concurrency substrate](#5-runner--instancestate--the-concurrency-substrate)
- [6. `MessageV2` — the storage↔model boundary (`message-v2.ts`)](#6-messagev2--the-storagemodel-boundary-message-v2ts)
  - [6.1 The part union (14 kinds)](#61-the-part-union-14-kinds)
  - [6.2 Cursor paging](#62-cursor-paging)
  - [6.3 `toModelMessagesEffect` — the translation to AI-SDK messages](#63-tomodelmessageseffect--the-translation-to-ai-sdk-messages)
- [7. ACP — the real implementation (`acp/agent__dup2.ts`, 1,470 lines)](#7-acp--the-real-implementation-acpagent__dup2ts-1470-lines)
- [8. Instance layer (`project/instance.ts`, `bootstrap.ts`)](#8-instance-layer-projectinstancets-bootstrapts)
- [9. Config (formerly [undetermined] — now [verified])](#9-config-formerly-undetermined--now-verified)
  - [9.1 Managed configuration (enterprise)](#91-managed-configuration-enterprise)
  - [9.2 Merge semantics](#92-merge-semantics)
  - [9.3 Plugin dependency installation](#93-plugin-dependency-installation)
  - [9.3.1 The cross-process lock (`util/flock.ts`, 263 lines)](#931-the-cross-process-lock-utilflockts-263-lines)
  - [9.3.3 The TUI config chain and its migration (`config/tui__dup2.ts` 134, `config/tui-migrate__dup2.ts` 117)](#933-the-tui-config-chain-and-its-migration-configtui__dup2ts-134-configtui-migrate__dup2ts-117)
  - [9.4 Markdown loaders](#94-markdown-loaders)
  - [9.4.1 Markdown config (`config/markdown.ts`, 79 lines)](#941-markdown-config-configmarkdownts-79-lines)
  - [9.4.2 The system prompt assembly (`session/system.ts`, 72 lines)](#942-the-system-prompt-assembly-sessionsystemts-72-lines)
  - [9.5 `Config.Info` is `.strict()`](#95-configinfo-is-strict)
- [10. Tools read in full this pass](#10-tools-read-in-full-this-pass)
  - [10.1 `grep` (`tool/grep.ts`)](#101-grep-toolgrepts)
  - [10.2 `skill` (`tool/skill.ts`)](#102-skill-toolskillts)
  - [10.3 `lsp` (`tool/lsp.ts`)](#103-lsp-toollspts)
  - [10.4 `websearch` (`tool/websearch.ts`)](#104-websearch-toolwebsearchts)
  - [10.5 `file/protected.ts` — evidence of compile-time platform folding](#105-fileprotectedts--evidence-of-compile-time-platform-folding)
  - [10.6 `control-plane/sse.ts`](#106-control-planessets)
- [11. Revert, unrevert, cleanup (`session/revert.ts`)](#11-revert-unrevert-cleanup-sessionrevertts)
- [12. Summary / diff accounting (`session/summary.ts`)](#12-summary--diff-accounting-sessionsummaryts)
- [13. Projectors — how events become rows (`session/projectors.ts`)](#13-projectors--how-events-become-rows-sessionprojectorsts)
- [14. What this pass changed in the earlier conclusions](#14-what-this-pass-changed-in-the-earlier-conclusions)
- [15. New debt introduced by this pass](#15-new-debt-introduced-by-this-pass)

<!-- /toc -->

This document exists because the earlier documents (03, 04) described the turn loop at the level of
*contracts* — what `SessionPrompt.loop` does, what a `MessageV2.Part` is — while only about a third of
`session/prompt.ts` and none of `message-v2.ts`'s body had actually been read end-to-end. This pass reads
whole bodies and records what the code does at line level, including the ordering hazards, the emulation
tricks, and the places where a comment-quality intention is detectable from structure rather than prose.

Files read in full for this document:

| File | Lines | Read |
|---|---|---|
| `src/session/prompt.ts` | 1,589 | 1–1,589 (full) |
| `src/session/message-v2.ts` | 798 | 1–648 (schema, cursor, hydrate, model mapping), 649–798 (paging/stream) |
| `src/session/revert.ts` | 159 | full |
| `src/session/summary.ts` | 131 | full |
| `src/session/projectors.ts` | 107 | full |
| `src/project/instance.ts` | 145 | full |
| `src/project/bootstrap.ts` | 33 | full |
| `src/config/config.ts` | 1,138 | 1–230 (managed config, markdown loaders), 600–700 (`Info` schema) |
| `src/acp/{agent__dup2,session,agent}.ts` | 1,470 / 81 / 4 | 1–190 + event/state structures |
| `src/tool/{grep,skill,lsp,websearch}.ts` | 131 / 96 / 93 / 100 | full |
| `src/control-plane/sse.ts` | 66 | full |
| `src/file/protected.ts` | 52 | full |
| `src/snapshot/index.ts` | ~550 | `revert` body + batching |

**Correction to `11-decisions-and-debt.md` §3.4:** it says ACP is a four-line re-export whose internals are
undetermined. `src/acp/agent.ts` is 4 lines *because it is the alias module*; the implementation lives in
`src/acp/agent__dup2.ts` and is **1,470 lines**. §7 below documents it.

---

## 1. `resolvePart` — how a user's attachment becomes conversation (`prompt.ts` 816–1063)

`createUserMessage` accepts a `parts` array from the client (TUI, HTTP, ACP) and calls `resolvePart` on each
element with `concurrency: "unbounded"`. Nothing in a user message is "just data": every part is expanded
into one or more *synthetic text parts* plus, usually, the original part. That is the single most important
structural fact about this file — **the model never sees a `file` part dangling on its own; it sees a
fabricated transcript of the tool call that would have produced that content.**

### 1.1 MCP resource parts (`source.type === "resource"`)

```js
pieces = [ {type:"text", synthetic:true, text:`Reading MCP resource: ${part.filename} (${uri})`} ]
exit = mcp.readResource(clientName, uri)      // Effect.exit, failure tolerated
contents -> for each: {text} pushed verbatim; {blob} pushed as `[Binary content: ${mime}]`
pieces.push(part)                              // the original file part follows
```

Failure does not throw: the error is logged, `Session.Event.Error` is *not* published here (unlike the file
branch), and the part is replaced by `Failed to read MCP resource ${filename}: ${message}`. Rationale
[inferred]: an MCP server is a third-party process; its availability must not be able to make a prompt
un-submittable.

### 1.2 `data:` URLs

`text/plain` data URLs are decoded and inlined as a text part — but only after a
`Called the Read tool with the following input: {"filePath": ...}` preamble, i.e. pasted text is presented to
the model as if the model had read a file. Any other mime type under `data:` falls through the `switch` and
returns the part untouched (so images stay as file parts, which `toModelMessages` later turns into media).

### 1.3 `file:` URLs — the emulation core

The file branch is the densest logic in the module:

1. **Directory detection**: `if (fsys.isDir(filepath)) part.mime = "application/x-directory"`.
2. **`text/plain` → actually execute the Read tool.**
   - If the URL carries `?start=&end=` and `start === end`, it calls `lsp.documentSymbol(filePathURI)` and
     scans the symbol list for a symbol whose `range.start.line === start`; on a hit it expands the request to
     `range.start.line … range.end.line`. This is the "click a symbol in the TUI, attach it" path: the client
     only knows a line number, and the server upgrades it to the symbol's full range by asking the language
     server. Failure is swallowed (`catch(() => succeed([]))`) and the single line is used.
   - It then builds `{filePath, offset, limit}` (offset is `max(start,1)`, limit is `end-(offset-1)`) and runs
     `registry.named.read.init()` → `tool.execute(args, ctx)` with a **fake context**:
     `extra:{bypassCwdCheck:true, model}`, `abort: new AbortController().signal`, `ask: async () => {}`,
     `metadata: async () => {}`, `messages: []`.
   - `ask: () => {}` means **the Read tool's own permission check is a no-op on this path**. The permission
     decision for the whole turn was already taken when the user submitted the message; re-asking for a read
     the user just requested would be noise. (`bypassCwdCheck` likewise exists only for this caller.)
   - On success the tool's `output` becomes a synthetic text part; its `attachments` (if any) become synthetic
     file parts; otherwise the original part is appended. On failure: `Session.Event.Error` is published,
     and a `Read tool failed to read ...` text part is inserted — the prompt still proceeds.
3. **Directory** → runs the Read tool with only `{filePath}` and inlines its listing output.
4. **Any other mime** (images, PDFs): `filetime.read(sessionID, filepath)` is recorded (so a later Write can
   prove the model "saw" the file's mtime), then the bytes are read and re-emitted as a
   `data:${mime};base64,...` file part. `readFile` failure is `die` — this branch is the only one that cannot
   degrade gracefully, because a media part with no bytes is meaningless.

### 1.4 `agent` parts

```js
perm = Permission.evaluate("task", part.name, ag.permission)
hint = perm.action === "deny" ? " . Invoked by user; guaranteed to exist." : ""
return [part, {type:"text", synthetic:true,
  text: " Use the above message and context to generate a prompt and call the task tool with subagent: " + name + hint}]
```

The `hint` is an instruction to the model: if the *current* agent's permission table denies `task` for this
subagent, the appended sentence tells the model the invocation is nonetheless authorised. This is a
deliberate hole in the delegation permission model and it is recorded as debt in §9.

### 1.5 Validation is advisory

After the plugin hook `chat.message` runs (which may mutate `info` and `parts` in place), both the message and
each part are `safeParse`d and **failures are only logged**, then the objects are persisted anyway
(`sessions.updateMessage` / `updatePart`). So a plugin can write a schema-invalid message into storage; the
type system is not enforced at the storage boundary. [verified]

---

## 2. `createUserMessage` — model/variant resolution (`prompt.ts` ~735–800)

```js
agentName = input.agent || agents.defaultAgent()
model     = input.model ?? ag.model ?? lastModel(sessionID)     // three-level fallback
same      = ag.model && model.providerID===ag.model.providerID && model.modelID===ag.model.modelID
full      = !input.variant && ag.variant && same ? provider.getModel(...).catch(()=>undefined) : undefined
variant   = input.variant ?? (ag.variant && full?.variants?.[ag.variant] ? ag.variant : undefined)
```

Two subtleties:

- An agent's `variant` (e.g. a reasoning-effort preset) only applies if the agent's own configured model is
  the one actually being used. If the user overrides the model, the agent's variant is silently dropped —
  because variants are properties of a *model*, not of an agent, and applying "high effort" to a model that
  does not have that variant would either error or be ignored by the provider.
- Even when the agent's model matches, the variant is applied only if the fetched model object *has* that
  variant key. So a stale config `variant: "max"` on a model that dropped it degrades to no variant instead
  of failing the prompt.

A finalizer is registered immediately after the message id exists:

```js
Effect.addFinalizer(() => InstanceState.withALS(() => instruction.clear(info.id)))
```

`Instruction` keeps per-message attachment state (files that were added to the system prompt for this
message); `clear` runs on scope exit so that a long-lived process does not accumulate instruction state keyed
by the ids of dead messages. The `withALS` wrapper is required because the finalizer runs outside the request's
async-local storage frame.

`prompt()` then turns `input.tools` (a deprecated `Record<string,boolean>`) into permission rows:

```js
for (const [tool, enabled] of Object.entries(input.tools ?? {}))
  permissions.push({permission: tool, action: enabled ? "allow" : "deny", pattern: "*"})
if (permissions.length) { session.permission = permissions; sessions.setPermission(...) }
```

Note the shape: a *replacement* array assigned to `session.permission`, not a merge. Passing `tools` therefore
**overwrites** any permission table the session had, including user-configured `ask` rules. That is why the
field is marked `@deprecated` in the zod schema ("tools and permissions have been merged, you can set
permissions on the session itself now") — but the behaviour is still live.

`noReply: true` returns the freshly persisted user message without entering `loop`. This is the primitive the
TUI uses to attach context or to queue a message without generating a reply.

---

## 3. `runLoop` — the turn state machine (`prompt.ts` 1110–1345)

### 3.1 Exit test

```js
if (lastAssistant?.finish && !["tool-calls"].includes(lastAssistant.finish)
    && !hasToolCalls && lastUser.id < lastAssistant.id) break
```

Three conjuncts, each doing distinct work:

- `finish` must be set **and** not be `"tool-calls"`;
- `!hasToolCalls`: a *part-level* check, because a provider can report `finish: "stop"` while the last
  assistant message still contains tool parts (notably when an error truncated a stream after a tool call was
  emitted). Without this, the loop would exit and abandon a tool call.
- `lastUser.id < lastAssistant.id`: message ids are ULIDs (monotonic), so this is a cheap "the assistant turn
  is after the user turn" causality check, guarding against a stale assistant message from before a revert.

### 3.2 The task stack

Walking messages backwards, the loop accumulates `compaction` and `subtask` parts into `tasks` **only while no
finished assistant message has been seen**, then pops *one* task per iteration (`tasks.pop()` — LIFO over a
reverse scan, i.e. the oldest pending task wins). Order of dispatch:

1. `subtask` → `handleSubtask` → `continue` (no new assistant message at this level).
2. `compaction` → `compaction.process(...)`; a `"stop"` result breaks the loop, anything else continues.
3. overflow check on `lastFinished`: if `summary !== true` and `compaction.isOverflow({tokens, model})`, a
   compaction is *created* (a synthetic compaction part) and the loop continues — i.e. overflow is handled by
   re-entering the loop with a new task, not by an in-step branch.
4. otherwise a normal assistant turn.

The consequence of the LIFO/one-per-iteration design is that a queued subtask is executed at the *top* of the
loop, before the model is called again, and `step` still increments for it — so a run of queued subtasks
consumes the agent's `steps` budget. [verified by structure; consequence inferred]

### 3.3 Step budget

```js
maxSteps = agent.steps ?? Infinity
isLastStep = step >= maxSteps
```

When `isLastStep`, the request is sent with one extra appended message:
`{role:"assistant", content: max_steps_default}` — a canned assistant utterance (the "max steps reached"
text) passed as *conversation history*, so the model continues from a state in which it has just said "I am
out of steps". This is a prompt-engineering workaround for providers that refuse to stop when told via system
prompt, and it costs one extra message slot in the context. [inferred rationale, verified mechanism]

### 3.4 Mid-run user messages are rewritten

```js
if (step > 1 && lastFinished) for messages after lastFinished:
   text parts (not ignored, not synthetic, non-empty) are wrapped:
   <system-reminder>
   The user sent the following message:
   …
   Please address this message and continue with your tasks.
   </system-reminder>
```

The wrapper exists so the model does not mistake an interjection for a new task boundary. The condition
`m5.info.role !== "user" || m5.info.id <= lastFinished.id` skips everything already answered.

### 3.5 System prompt assembly order

```js
const [skills, env, instructions, modelMsgs] = Effect.all([...])
const system = [...env, ...(skills ? [skills] : []), ...instructions]
if (format.type === "json_schema") system.push(STRUCTURED_OUTPUT_SYSTEM_PROMPT)
```

Environment first, then the skills catalogue, then instruction files — i.e. **the most specific, user-authored
content is last**, which is the position models weight most heavily and the position that survives truncation
by prefix-summarisation. The structured-output contract is appended last of all because it is a hard
constraint.

### 3.6 Structured output (`format.type === "json_schema"`)

- A `StructuredOutput` tool is injected with the caller's schema; `onSuccess` stores the parsed value in a
  closure variable `structured`.
- `toolChoice` is forced to `"required"` so the model must call *some* tool — and since the only reason to
  call a tool in that mode is structured output, it must call this one.
- After `process()`: if `structured !== undefined`, it is written onto `handle2.message.structured`, `finish`
  is defaulted to `"stop"`, and the loop **breaks** regardless of the model's own finish reason.
- If the message finished without error but nothing was structured, a `StructuredOutputError`
  (`{message, retries:0}`) is attached and the loop breaks — so a malformed structured turn is a terminal,
  surfaced error, not a silent retry. (`retryCount` exists in `OutputFormatJsonSchema` with default `2`, but
  this code path never increments it. [verified])

### 3.7 Interruption

```js
Effect.onExit(gen(...), (exit) => {
  if (hasInterruptsOnly(exit.cause)) yield* handle2.abort()
  yield* InstanceState.withALS(() => instruction.clear(handle2.message.id))
})
```

Only a *pure* interrupt (no real defect mixed in) triggers `abort()`; a genuine failure leaves the processor's
state to be closed by the layer teardown. `instruction.clear` runs in both cases.

### 3.8 Post-loop

`compaction.prune({sessionID})` is forked (fire-and-forget) into the run scope, and the return value is
`lastAssistant(sessionID)` — a re-scan of the stream, not the message object built in this loop. So the caller
sees exactly what storage sees.

---

## 4. `shellImpl` — the `!command` path (`prompt.ts` 627–780)

This is a separate mini-turn, not a tool call. Per shell:

| Shell | Args | Notes |
|---|---|---|
| `zsh` | `-l -c` | saves `$PWD`, sources `~/.zshenv` then `${ZDOTDIR:-$HOME}/.zshrc`, `cd` back, `eval '<cmd>'` |
| `bash` | `-l -c` | `shopt -s expand_aliases`, sources `~/.bashrc`, `cd` back, `eval '<cmd>'` |
| `fish`, `nu` | `-c` | plain |
| `cmd` | `/c` | |
| `powershell`, `pwsh` | `-NoProfile -Command` | |
| `""` (unknown) | `-c` | fallback |

Verified details:

- `cwd` taken from `InstanceState.context.directory`, `env` from the `shell.env` plugin hook plus `TERM: "dumb"`
  (so tools that would emit colour/ANSI do not), `stdin: "ignore"`, `forceKillAfter: "3 seconds"`.
- The `cd "$__oc_cwd"` dance exists because login shells (`-l`) change directory to `$HOME` on some systems;
  the code restores the caller's cwd *after* sourcing rc files but *before* evaluating the command, so rc
  aliases and PATH survive while the working directory is correct.
- The command is embedded with `JSON.stringify(input.command)` inside a single-quoted `eval` — quoting, not
  escaping, and the whole `eval` is deliberate: without it, `&&`, pipes and aliases in the saved rc file would
  behave differently from a real interactive shell.
- Output streams into `part.state.metadata.output` via `Effect.runFork(sessions.updatePart(part))` per chunk —
  every chunk schedules an async DB write, unawaited, so the TUI can show live output. Ordering is preserved
  only by the storage layer, not by this loop. [verified]
- On interrupt, `aborted = true` and the finishing block appends
  `<metadata>\nUser aborted the command\n</metadata>` to the output, then still marks the part `completed`
  (not `error`). An aborted shell command is therefore indistinguishable from a completed one to any consumer
  that reads only the part status.
- `finish` is `Effect.uninterruptible`, so the "write the final state" step cannot itself be cancelled. This is
  the correct primitive: the whole point is that an interrupted command still leaves a persisted part.
- A synthetic user message `"The following tool was executed by the user"` precedes the assistant tool part,
  mirroring how `resolvePart` frames user-supplied content, and `session.revert` is cleaned up first so a
  dangling revert cannot be applied to a shell turn.

`shell` and `loop` differ in exactly one place: `runner.startShell(...)` vs `runner.ensureRunning(...)`
(§5). The `Runner` therefore has to model "a shell is running" as a distinct state from "a model turn is
running", which is why `ShellThenRun` exists.

---

## 5. `Runner` / `InstanceState` — the concurrency substrate

Restating with the line-level detail that matters (from `src/effect/runner.ts`, 144 lines, and
`src/effect/instance-state.ts`, 53 lines):

```
states: Idle | Running | Shell | ShellThenRun
ensureRunning(effect): if Shell -> queue as ShellThenRun; if Running -> return existing fiber/deferred
startShell(effect):    if Running -> refuse/queue;  if Idle -> Shell
cancel():              wait 100ms, then fiber.interrupt()
```

- **One turn at a time per session**, enforced by the runner rather than by a DB lock. This is why
  `assertNotBusy` (used by `revert`) exists as a separate cheap check for the *HTTP* surface: the runner
  throws, but callers want a clean 4xx before doing work.
- The 100 ms grace before interrupt is what makes the TUI's "Esc" feel like a cancellation rather than a
  crash: in-flight stream chunks can land and be persisted.
- `ShellThenRun` encodes the user-visible ordering rule that `!cmd` followed immediately by a prompt must not
  interleave — the prompt waits for the shell, it does not race it.
- `InstanceState` is a `ScopedCache` keyed by `InstanceState.directory`. Every service that keeps per-project
  state (LSP clients, watchers, snapshot git repo, formatters) is a function of that key, so the "instance" is
  effectively a *process-wide map from directory to lazily-initialised service graph*, with `registerDisposer`
  for teardown.

---

## 6. `MessageV2` — the storage↔model boundary (`message-v2.ts`)

### 6.1 The part union (14 kinds)

`text`, `reasoning`, `file`, `snapshot`, `patch`, `agent`, `compaction`, `subtask`, `retry`, `step-start`,
`step-finish`, `tool`, plus the message kinds `user`/`assistant`. Notably:

- `text` has `synthetic` and `ignored` flags. `ignored` is honoured by `toModelMessages` (dropped from the
  request); `synthetic` is not — synthetic text *is* sent, which is exactly how §1's fabricated read transcripts
  reach the model.
- `step-start`/`step-finish` carry a `snapshot` hash; they are the only reason `SessionSummary.computeDiff`
  can work without asking the LLM anything.
- `tool` parts carry the full `ToolState` union (`pending|running|completed|error`) with timings, and
  `completed.time.compacted` — a flag that later rewrites the output to `[Old tool result content cleared]`
  at request-build time.

### 6.2 Cursor paging

`cursor = base64url(JSON.stringify({id, time}))`; `older(row)` is the keyset predicate
`time_created < row.time OR (time_created = row.time AND id < row.id)`. `page()` selects `limit+1` rows,
descending on `(time_created, id)`, to decide `hasMore`. Keyset paging on a composite key is used instead of
`OFFSET` because messages are appended constantly by other sessions and `OFFSET` would skip/duplicate.

Empty result set → a `SessionTable` existence query, so a *missing session* is distinguishable from an
*empty session* (`NotFoundError` vs an empty page).

`hydrate(rows)` does one `inArray(PartTable.message_id, ids)` query and groups in memory — one extra query per
page, never N+1.

### 6.3 `toModelMessagesEffect` — the translation to AI-SDK messages

This is where most of the "why does my provider behave differently" behaviour lives.

**a. Provider metadata is model-scoped.** Every part is emitted with
`...(differentModel ? {} : {providerMetadata: part.metadata})`, where `differentModel` compares the *current*
request's model against the message's stored `providerID/modelID`. Replaying a cached reasoning signature or
encrypted content into a different model is invalid, so metadata is dropped wholesale on model switch.

**b. Tool media relocation.** `supportsMediaInToolResults` is a hardcoded allow-list:

```js
@ai-sdk/anthropic            -> true
@ai-sdk/openai               -> true
@ai-sdk/amazon-bedrock       -> true
@ai-sdk/google-vertex/anthropic -> true
@ai-sdk/google               -> id.includes("gemini-3") && !id.includes("gemini-2")
default                      -> false
```

When false, media attachments inside a tool result are removed from the tool output and collected into
`media[]`; after the assistant message is emitted, a **synthetic user message** is appended:

```
"Attached image(s) from tool result:"
+ file parts (data URLs)
```

So on a non-supporting provider, a screenshot returned by a tool arrives as if the *user* pasted it one turn
later. Note the `gemini-3` vs `gemini-2` string test: `includes("gemini-3") && !includes("gemini-2")` — a
model id containing both strings would be treated as unsupported.

**c. Tool output shapes.** `toModelOutput` normalises: string → `{type:"text"}`, object → `{type:"content"}` with
text + data-URL media, otherwise `{type:"json"}`.

**d. Interrupted tools are rewritten as errors.** `pending`/`running` parts become
`state:"output-error", errorText:"[Tool execution was interrupted]"`. A resumed conversation therefore contains
a *synthetic failure* for the abandoned call instead of an unanswered tool call (which most providers reject).

**e. Errored assistant messages are skipped**, except aborted messages that still have content
(`AbortedError` with any non-`step-start`/`step-start`-only part is kept) — a partially-streamed answer that the
user aborted is preserved as history; an outright failure is erased.

**f. Compaction and subtask parts become literal questions.** A `compaction` part emits
`"What did we do so far?"`; a `subtask` part emits `"The following tool was executed by the user"`. Both are
*canned user utterances* that give the surrounding synthetic text something to be an answer to.

**g. Empty turns are dropped**: messages with `parts.length === 0` are skipped, and the final
`convertToModelMessages` call filters any message whose only part is `step-start`.

---

## 7. ACP — the real implementation (`acp/agent__dup2.ts`, 1,470 lines)

ACP ("Agent Client Protocol") makes opencode a *server* for editor clients (Zed and friends). Shape:

```
ACP.init({sdk}) -> {create(connection, fullConfig) -> new Agent(connection, config)}
Agent fields: connection, config, sdk, sessionManager, eventAbort, eventStarted,
              bashSnapshots: Map, toolStarts: Set, permissionQueues: Map
permissionOptions = [once/allow_once, always/allow_always, reject/reject_once]
```

**Event bridge.** The agent subscribes to `sdk.global.event()` in a `while(true)` loop guarded by an
`AbortController`, and translates each opencode event into an ACP `sessionUpdate`. `eventStarted` makes the
subscription idempotent. Every handler is wrapped in `.catch(log)`: a single malformed event cannot kill the
bridge.

`handleEvent` cases:

- `permission.asked` → chained through `permissionQueues[sessionID]` so two permission prompts for one session
  are asked **serially** (a `Promise` chain kept in a Map, deleted in `finally` when it is the tail). The tool
  call is presented with `kind: toToolKind(permission.permission)` and `locations: toLocations(...)`.
  If the client errors or answers anything other than `selected`, the request is **replied `"reject"`** — a
  transport failure fails closed.
  For `edit` permissions that are not rejected, the agent *also* pushes the new content to the client via
  `connection.writeTextFile({path, content})`, computing it with `getNewContent(currentContent, diff)` — the
  editor shows the edit as a real file change rather than a tool notification.
- `message.part.updated` / `message.part.delta` → per-tool-state mapping into ACP tool-call updates
  (`pending`/`running`/`completed`/`error` branches at lines ~201/204/253/321 and ~655/658/686/753 — two
  parallel mapping sites, one for the full part and one for deltas).
- bash snapshots and `toolStarts` exist to pair `tool_call`/`tool_call_update` notifications correctly.

`sendUsageUpdate` computes `used = input + cache.read`, sums `cost` over all assistant messages, and fetches
`model.limit.context` from `sdk.config.providers()` — falling back to `null` (and sending nothing) if the
provider list cannot be fetched. The cost currency is hardcoded `"USD"`.

`ACPSessionManager` (81 lines) is a Map of `{id, cwd, mcpServers, createdAt, model, variant, modeId}` around
`sdk.session.{create,get}`; `get` throws `RequestError.invalidParams` for an unknown session — i.e. ACP
validates session existence *in process memory*, so a restart of the ACP host loses the mapping even though the
sessions persist in SQLite. [verified mechanism; user-visible consequence inferred]

---

## 8. Instance layer (`project/instance.ts`, `bootstrap.ts`)

```js
cache: Map<resolvedDirectory, Promise<Context>>
Instance.provide({directory, init, fn}):
   dir = Filesystem.resolve(directory)
   existing ??= track(dir, boot({directory: dir, init}))
   return context.provide(await existing, fn)
boot(): ctx = input.project && input.worktree ? {...} : await Project.fromDirectory(dir) -> {project, sandbox}
        await context.provide(ctx, input.init)
```

Points worth recording:

- `Project.fromDirectory` returns `{project, sandbox}`, and **`sandbox` becomes `worktree`**. So "worktree" in
  this codebase is not necessarily a git worktree — it is whatever sandbox directory the project resolved to,
  and `worktree === "/"` is an explicit "no sandbox" sentinel (checked in `containsPath`).
- `track()` attaches a rejection handler that removes the cache entry **only if it is still the same promise** —
  the classic guard against a slow failed boot evicting a newer successful one.
- `reload()` disposes `State` + instance, deletes the cache entry, re-boots, then emits
  `server.instance.disposed` with `{directory}`. `disposeAll()` likewise re-checks identity before disposing
  each entry and is memoised in `disposal.all` (cleared in `finally`), so concurrent shutdowns share one pass.
- `containsPath` accepts the directory *or* the worktree, which is how a file outside the cwd but inside the git
  root (or the sandbox) is still "inside the project".
- `bind(fn)` captures the current context and re-provides it — used to hand long-lived callbacks (watchers,
  LSP handlers, plugin hooks) a stable instance reference.
- `Instance.state(init, dispose)` = `State.create(() => Instance.directory, ...)`: per-directory lazy state, the
  building block of every per-project cache.

`InstanceBootstrap()` order (verified): `Plugin.init` → `ShareNext.init` → `Format.init` → `LSP.init` →
`File.init` → `FileWatcher.init` → `Vcs.init` → `Snapshot.init`, then subscribes to `Command.Event.Executed` and,
when the command name is `Command.Default.INIT` (`/init`), calls `Project.setInitialized(project.id)`. Plugin
loading is first because later initialisers may be replaced by plugins; snapshot is last because it depends on
git and on the worktree being known.

---

## 9. Config (formerly [undetermined] — now [verified])

Every item previously flagged [undetermined] in this section was researched in the §9 pass from source;
the verdicts (managed config paths, `OPENCODE_TEST_MANAGED_CONFIG_DIR`, keybinds/plan, `.strict()` objects,
config dirs) are below. Anything that remains unresolvable says so, with the proof, at its claim site.

### 9.1 Managed configuration (enterprise)

- `systemManagedConfigDir()`: macOS `/Library/Application Support/opencode`, Windows
  `%ProgramData%\opencode`, else `/etc/opencode`. Overridable with `OPENCODE_TEST_MANAGED_CONFIG_DIR`
  (test-only hook, but honoured in the production build).
- On macOS, `readManagedPreferences()` looks for `ai.opencode.managed.plist` in
  `/Library/Managed Preferences/<user>/` then `/Library/Managed Preferences/`, converts it with
  `plutil -convert json -o -` (a subprocess, `nothrow`), and strips the metadata keys
  `PayloadDisplayName, PayloadIdentifier, PayloadType, PayloadUUID, PayloadVersion, _manualProfile` before
  parsing the remainder as ordinary config with source `mobileconfig:<path>`.
  Consequence: an MDM profile can set any config key, and its values enter the normal precedence chain with a
  distinct source label so the UI can attribute them. A failed `plutil` logs a warning and is skipped — managed
  policy is *not* allowed to break startup.

### 9.2 Merge semantics

`mergeConfigConcatArrays` = deep merge, except `instructions` which is unioned **with `Set` dedupe** and
promoted to an array. Everything else (arrays included) takes the later source wholesale. That asymmetry is the
only "additive" list in config.

### 9.3 Plugin dependency installation

`installDependencies(dir, {signal, waitTick})`: no-op if the directory is not writable; otherwise takes a
`Flock` named `config-install:<resolved dir>` (so two opencode processes cannot both `npm install` the same
plugin dir), writes `package.json` with `"@opencode-ai/plugin": <version or "*">` (`"*"` when
`Installation.isLocal()`), and on first run writes a `.gitignore` containing
`node_modules, package.json, package-lock.json, bun.lock, .gitignore`. So the plugin directory is deliberately
self-ignoring: the generated `package.json` is not meant to be committed.

### 9.3.1 The cross-process lock (`util/flock.ts`, 263 lines)

`Flock.acquire(key, opts?) → {release, [Symbol.asyncDispose]}` is the mutex behind the `config-install:` and
`plug-config:` locks above. Defaults are `{staleMs: 60_000, timeoutMs: 5 minutes, baseDelayMs: 100,
maxDelayMs: 2_000}`, with exponential backoff (`delay = min(maxDelay, delay * 1.7)`) jittered ±30%, and an
`onWait({key, attempt, delay, waited})` callback so the CLI can print "waiting". `withLock` is the same lock used
as an `await using` guard.

Every lock is a **directory** at `Global.Path.state/locks/<Hash.fast(key)>.lock` (mkdir-based mutual exclusion —
an EEXIST from `mkdir` is the actual primitive), and its contents are the protocol:

- `meta.json` owns `{token, pid, hostname, createdAt}`, and `heartbeat` is an empty file whose **mtime** is the
  liveness clock. Ownership is token-only: `release()` re-reads `meta.json` and refuses with
  `"Refusing to release: lock is compromised (metadata missing|invalid)"` or `"…token mismatch (not the owner)"`
  rather than deleting someone else's lock.
- `stale()` already exists: if the heartbeat's mtime is older than `staleMs` it is stale; the fallback order is
  heartbeat → meta → the lock dir itself, so *some* mtime always exists to judge by. The heartbeat itself is
  refreshed at `max(100, staleMs / 3)` with an unref'd timer so it never keeps the process alive.
- Fresh acquisition writes `heartbeat` and `meta.json` with `flag: "wx"` (fail-if-exists). If either appears
  between `mkdir` and write, the whole dir is deleted and the acquisition **throws**
  `"Lock acquired but <file> already existed (possible compromise)"` instead of stealing.
  [inferred] The conservative failure is deliberate: if a file the winner did not create appeared inside its "empty"
  lock directory, the directory was not empty and the lock was not exclusive — better to fail loudly. So the winner's first write is exclusive and the loser retries.
- Taking over a stale lock is mediated by a **conductor directory** `…​.lock.breaker` (`mkdir …​.breaker`, mode
  0700 — the same mode as the lock dir). Only one process may *steal* one lock at a time; a stale breaker is
  itself stale-reclaimed, and the stolen lock dir is deleted and recreated inside a `try/finally` that always
  removes the breaker. Double-checked `stale()` inside and outside the breaker makes stealing safe.

#### 9.3.2 `npm` — the Arborist acquisition layer (`npm/index.ts`, 189 lines)

All npm installs, for plugins and for binaries, go through this module, which is four functions over
`@npmcli/arborist` and the `Flock` mutex. State lives at `Global.Path.cache/packages/<pkg>`; `Npm.add` takes the
`npm-install:<resolved dir>` lock, and cache hits short-circuit it:

```js
tree = await arborist.loadVirtual().catch(() => {})
if (tree?.edgesOut.first) return resolveEntryPoint(first.name, first.path)   // installed already
await arborist.reify({ add: [pkg], save: true, saveType: "prod" }).catch(→ InstallFailedError)
```

The Arborist is constructed with `{binLinks: true, progress: false, savePrefix: "", ignoreScripts: true}` — no
postinstall scripts ever run (an install that ran arbitrary lifecycle scripts would be a trust problem,
especially since the *same* machinery installs plugins). Entrypoints are resolved with `import.meta.resolve`
(`Bun` branch passes the package name plus dir, otherwise just the dir), and an unresolvable entrypoint is
`undefined`, not an error — resolution is best-effort at this layer. `InstallFailedError` is a `NamedError` with
`{pkg}`.

`Npm.install(dir)` (whole-directory mode, for the plugin dependency bootstrap): takes `npm-install:<dir>`
*unresolved*, reifies when `node_modules` is missing, and otherwise compares `package.json`'s four dependency
buckets against the lockfile root (`packages[""]`) — **any declared dependency not in the lock triggers a
reify**; everything declared and locked means "dependencies in sync" and the install is skipped. Note the lock
comparison only needs *presence*, not versions, so the check is cheap but shallow.

`Npm.which(pkg)` finds a package's `.bin` entry: one file → it; several → consulted `package.json`'s `bin`
(string → the unscoped name; object → sole key or the unscoped name if present else the first key). If none
exists it deletes `package-lock.json` and calls `add` once, then re-reads — the reinstall path is the lockfile
delete, not a force flag.

`Npm.outdated(pkg, cachedVersion)`: fetches `https://registry.npmjs.org/<pkg>`; on network failure or a missing
`dist-tags.latest` it logs `"Failed to resolve latest version, using cached"` and returns `false` (stale = keep
using). A version string containing whitespace or any of `^~*xX<>|=` is treated as a range
(`!semver.satisfies(latest, range)`), otherwise an exact comparison (`semver.lt(cached, latest)`). Failures are
warnings, never exceptions — the retry policy is "try again next time".

[verified] In this build `sanitize()` is the identity function: its deny-list is `undefined`, and the filter is
guarded by `if (!illegal) return pkg`. Directory paths therefore keep the package's `@` and `/` verbatim.

### 9.3.3 The TUI config chain and its migration (`config/tui__dup2.ts` 134, `config/tui-migrate__dup2.ts` 117)

`TuiConfig` is a parallel config chain for the *TUI's* own settings, with the same layering as `Config` —
global tui files → custom `OPENCODE_TUI_CONFIG` → project tui files → each `.opencode` dir (and `OPENCODE_CONFIG_DIR`)
→ the managed dir. Three things differ from the server config chain:

- **Legacy unwrap.** `normalize4(raw)` flattens a top-level `tui` record into the root (`{...tui, ...rest}`, so
  outer keys win) — the old shape where TUI options nested inside the server config. A non-record `tui` is dropped
  entirely.
- **Plugin origins are tracked, not just specs.** Each merged file's `plugin` array is deduped through
  `Config.deduplicatePluginOrigins` with `{spec, scope, source: file}`, where scope is `"local"` iff
  `Instance.containsPath(file)` — the same provenance the plugin resolver needs to install into the right directory.
- **Keybinds are parsed and plugins are resolved**, not just validated: `Config.Keybinds.parse` turns the merged
  keybind record into actions, and each plugin spec is rewritten through `Config.resolvePluginSpec` (relative to
  its own config file). Failure of any file is a warning + `{}`, never a throw — TUI config cannot break boot.
  Plugin dependencies are started per `.opencode` dir (deduped) as deferred promises awaited by
  `waitForDependencies()`.

The migration (`migrateTuiConfig`) runs once per load, *before* the project files are collected, and the file
list is recomputed afterwards so freshly-written files join the chain. It scans every opencode config file
(project, global, directories, `OPENCODE_CONFIG`, managed — deduped), and for each:

1. Pulls out legacy keys: `theme` validated against `TuiInfo.shape.theme`, `keybinds` (record, loose),
   and `tui` — itself stripped to only `scroll_speed`, `scroll_acceleration`, `diff_style` (the only keys the
   legacy schema kept).
2. If none are present, skip. If a sibling `tui.json` already exists, skip — migration never clobbers an
   existing file.
3. Otherwise write the sibling `tui.json` (`$schema: "https://opencode.ai/tui.json"` first, then the extracted
   fields, 2-space JSON).
4. Only after that write succeeds, back up the original to `<file>.tui-migration.bak` (only if not already
   backed up) and strip the three legacy keys from the *original* config via jsonc-parser
   `modify` (formatting preserved). Each failure is a warning and leaves both files untouched — the write and
   strip are sequenced so the user can always roll back from the `.bak`.

Everything a user who just upgraded hits: an old `opencode.json` with a `theme` key becomes an untouched original
(no `tui.json` if one existed, no overwrite) or a stripped original plus a new `tui.json`, with the legacy
settings now loading from the TUI chain instead. [verified] from `migrateTuiConfig`/`opencodeFiles`/
`backupAndStripLegacy`.

### 9.4 Markdown loaders

`loadCommand(dir)` / `loadAgent(dir)` glob `{command,commands}/**/*.md` and `{agent,agents}/**/*.md`
(`dot:true, symlink:true`), parse front-matter with `ConfigMarkdown.parse`, and derive the name by stripping
the *first* matching path segment among `/.opencode/command/`, `/.opencode/commands/`, `/command/`,
`/commands/` (agents analogous) plus the extension; fallback is the basename. Front-matter becomes the config,
file body becomes `template` (commands) or `prompt` (agents). A `FrontmatterError` publishes a
`Session.Event.Error` and skips the file; a *schema* failure throws `Config.InvalidError` and aborts load —
parse errors are tolerant, semantic errors are not.

### 9.4.1 Markdown config (`config/markdown.ts`, 79 lines)

`ConfigMarkdown.parse(file)` reads the command/agent markdown (gray-matter front-matter). Its regexes are the
custom-command grammar: `FILE_REGEX = /(?<![\w`])@(\.?[^\s`,.]*(?:\.[^\s`,.]+)*)/g` (an `@`-reference, not
preceded by a word char or backtick) and `SHELL_REGEX = /!`([^`]+)`/g` (`!` backtick shell interpolation). The
parse has a **fallback sanitisation** path: when gray-matter throws, `fallbackSanitization` rewrites frontmatter
roughly — preserving comments/blank lines/indented lines, and when a value contains a colon but isn't a
quoted/scalar/folded scalar, it converts the line to a block-quoted `|-` form. If that also fails, a
`ConfigMarkdown.FrontmatterError(path, message)` NamedError is thrown. [verified] from `parse10`/
`fallbackSanitization` bodies — the fallback only ever converts "contains a colon" lines to block scalars.

### 9.4.2 The system prompt assembly (`session/system.ts`, 72 lines)

`SystemPrompt.provider(model)` picks the persona prompt by substring on the API id — `gpt-4|o1|o3` → *beast*,
`gpt` → *gpt* (or *codex* when the id also contains *codex*), `gemini-` → *gemini*, `claude` → *anthropic*,
`trinity`/`kimi` (case-insensitive) → their own, anything else → *default*. `SystemPrompt.environment(model)`
builds the env block: the current model, working directory, worktree root, git-repo yes/no, and **the
baked-in platform word** — this binary has `"${"darwin"}"` in the template, so the platform was substituted
at bundle time for the darwin-x64-baseline build [inferred]; upstream source would read `process.platform`.
`SystemPrompt.skills(agent)` returns the skill intro (available skills formatted verbosely) unless the `skill`
permission is off for the agent.

### 9.5 `Config.Info` is `.strict()`

Unknown keys are a hard error, not a warning. Enumerated keys (verified at `config.ts:600-699`):

`$schema, logLevel, server, command, skills, watcher{ignore}, snapshot, plugin, share(manual|auto|disabled),
autoshare(dep), autoupdate(bool|"notify"), disabled_providers, enabled_providers, model, small_model,
default_agent, username, mode(dep), agent{plan,build,general,explore,title,summary,compaction, *},
provider, mcp, formatter(false|map), lsp(false|map), instructions, layout(dep), permission, tools,
enterprise{url}, compaction{auto,prune,reserved}, experimental{disable_paste_summary, batch_tool,
openTelemetry, primary_tools, continue_loop_on_deny, mcp_timeout}`

Two things this schema encodes that prose docs usually miss:

- `tools` still exists alongside `permission`, and per §2 it is converted into a *full* permission replacement.
- `experimental.continue_loop_on_deny` and `experimental.primary_tools` are config-level switches for behaviour
  implemented in the tool wrapper/agent resolver, not in config itself.
- `lsp` has a cross-field `refine`: a custom server id that is not one of the built-in `LSPServer` ids **must**
  declare `extensions`, error text `"For custom LSP servers, 'extensions' array is required."`

---

## 10. Tools read in full this pass

### 10.1 `grep` (`tool/grep.ts`)

`rg -nH --hidden --no-messages --field-match-separator=| --regexp <pat> [--glob <include>] <path>`
(`-H` forces filenames so the `|` split is unambiguous). Exit codes: `1` → "No files found"; `2` with empty
stdout → also "no files"; `2` with output → results **plus** a trailing `(Some paths were inaccessible and
skipped)`; anything else → throw. Results are **sorted by file mtime descending** (most recently touched file
first) and capped at **100** with `(Results truncated: showing 100 of N matches (N-100 hidden). Consider using a
more specific path or pattern.)`. Each line text is clipped to `MAX_LINE_LENGTH = 2000`.
`filesystem.stat` failures silently drop matches (a file deleted mid-search). Permission:
`ctx.ask({permission:"grep", patterns:[pattern], always:["*"]})` — note `always:["*"]`, so "always allow" for grep
is global.

### 10.2 `skill` (`tool/skill.ts`)

Description is generated per-agent from `Skill.available(agent)`; if empty, the tool still exists and says so.
On execute: `Skill.get(name)` → `ctx.ask({permission:"skill", patterns:[name], always:[name]})` — "always" is
scoped to *that skill name only*, unlike grep. Output block:

```
<skill_content name="...">
# Skill: <name>
<content>
Base directory for this skill: file:///.../
<skill_files> (up to 10 non-SKILL.md files, "sampled")
```

The file list is produced by `Ripgrep.files({cwd: dir, follow:false, hidden:true})` and truncated at 10 — so a
skill with 200 resources advertises 10, chosen by ripgrep's traversal order, not by relevance.

### 10.3 `lsp` (`tool/lsp.ts`)

Nine operations, 1-based `line`/`character` in the schema converted to 0-based positions. Preconditions throw
distinct messages: unknown file → `File not found: <path>`; `LSP.hasClients(file)` false →
`"No LSP server available for this file type."`. `LSP.touchFile(file, true)` before querying, so a file the
editor never opened still gets an open document. `workspaceSymbol` is called with `""` — it lists *all* symbols
rather than taking a query, a limitation of the tool surface, not of LSP. Empty result →
`No results found for <op>`; otherwise pretty-printed JSON.

### 10.4 `websearch` (`tool/websearch.ts`)

Hardcoded third-party MCP endpoint `https://mcp.exa.ai/mcp`, JSON-RPC 2.0 `tools/call` for `web_search_exa`,
`accept: application/json, text/event-stream`, 25 s timeout composed with the tool abort via `abortAfterAny`.
Response is parsed by scanning for `data: ` lines and reading `result.content[0].text` — i.e. it consumes an SSE
body with a string scan, not with the `sse.ts` parser. No API key, no config key: the endpoint is fixed. This is
the most opinionated external dependency in the tool set and it is not user-configurable.

### 10.5 `file/protected.ts` — evidence of compile-time platform folding

```js
function names() { if (true) return new Set(DARWIN_HOME); if (false) ; return new Set; }
function paths() { if (true) return [...DARWIN_HOME…, ...DARWIN_LIBRARY…, ...DARWIN_ROOT]; … return []; }
```

The `if (true) / if (false)` pairs are what remains after the bundler folded a `process.platform` switch for a
**darwin** target: only the macOS branch survived, the other branches were replaced by unreachable code.
The protected set is therefore, in this binary: `~/Music, ~/Pictures, ~/Movies, ~/Downloads, ~/Desktop,
~/Documents, ~/Public, ~/Applications, ~/Library`, the sensitive `~/Library` subtrees
(`Application Support/AddressBook`, `Calendars`, `Mail`, `Messages`, `Safari`, `Cookies`,
`Application Support/com.apple.TCC`, `PersonalizationPortrait`, `Metadata/CoreSpotlight`, `Suggestions`), and
the root paths `/.DocumentRevisions-V100, /.Spotlight-V100, /.Trashes, /.fseventsd`.
Reading a Linux build of the same version would yield a different set from the same code — a useful reminder
that this document describes *this artifact*.

### 10.6 `control-plane/sse.ts`

A from-scratch SSE client: normalises `\r\n`/`\r` to `\n`, splits on blank lines, accumulates `data:` (joined
with `\n`), tracks `id:` as `lastEventId` and `retry:` as the reconnect delay (default 1000). Non-JSON payloads
are *not* dropped: they are delivered as `{type:"sse.message", properties:{data, id, retry}}`. `AbortSignal`
cancels the reader and the listener is removed in `finally`, with `reader.releaseLock()`.

---

## 11. Revert, unrevert, cleanup (`session/revert.ts`)

Three-phase design, and the phases are separate because they happen at different times:

1. **`revert({sessionID, messageID, partID})`** — refuses when the session is busy
   (`SessionPrompt.assertNotBusy`). It walks all messages; before the revert point it keeps parts; at the point
   it records `rev = {messageID, partID}` and continues; after the point it collects **every `patch` part** and
   drops everything else. Then:
   - `rev.snapshot = session.revert?.snapshot ?? snap.track()` (re-using an existing revert's snapshot so a
     second revert does not lose the original state);
   - if a revert already existed, `snap.restore(existing.snapshot)` first — unrevert-then-revert semantics;
   - `snap.revert(patches)` to undo file changes;
   - `rev.diff = snap.diff(rev.snapshot)`;
   - writes `session_diff` to storage, publishes `Session.Event.Diff`, and stores
     `{revert: rev, summary: {additions, deletions, files}}` on the session.

   Two granularities: with `partID` the revert is *part-level*, but only if the message already contains a
   `text` or `tool` part — `partID = remaining.some(p => ["text","tool"].includes(p.type)) ? input.partID : undefined`.
   Otherwise it degrades to a message-level revert. And when the matched message is not a user message,
   `rev.messageID` becomes `lastUser.id` — reverting an assistant reply means "go back to the user turn that
   produced it".
   `snap.revert` itself (in `snapshot/index.ts`) is `git checkout <hash> -- <file>` per file, batched in runs of
   ≤100 with a path-clash guard (a file and its parent directory are never in the same batch). If checkout
   fails *and* `git ls-tree <hash> -- <rel>` shows the file did not exist at that snapshot, the file is
   **deleted** — that is how "revert a created file" is implemented without a git working-tree reset.

2. **`unrevert`** — restores `session.revert.snapshot` and clears the revert marker. No message deletion: the
   conversation still contains everything.

3. **`cleanup(session)`** — runs at the *start of the next prompt* (called from `prompt()`, `runLoop`'s shell
   path and `shellImpl`). It deletes every message after the revert point (emitting `MessageV2.Event.Removed`)
   and, for a part-level revert, truncates the target message at the part index (emitting `PartRemoved` per
   part), then `clearRevert`.

The split exists because the user must be able to *see* the reverted conversation and the diff before it is
destroyed: `revert` is reversible, `cleanup` is not, and the only thing that triggers the destructive step is
sending the next message.

## 12. Summary / diff accounting (`session/summary.ts`)

- `computeDiff({messages})`: `from` = snapshot of the **first** `step-start` part found; `to` = snapshot of the
  **last** `step-finish` part. If either is missing → `[]`. It calls `snapshot.diffFull(from, to)`, so the diff
  is a pure git-tree diff between two tracked snapshots — the LLM summary and the file diff are independent
  facts.
- `summarize({sessionID, messageID})` is called at `step === 1` (forked, ignored) and stores
  `{additions, deletions, files}` on the session plus a per-message `summary.diffs` for the user message and all
  assistant messages with `parentID === messageID`. It is declared as
  `(input) => void runPromise(...).catch(() => {})` — **fully fire-and-forget**; a summary failure is invisible
  by design, because a summary must never break a turn.
- `diff({sessionID})` reads `session_diff` from storage and repairs git's **C-style quoted paths**:
  `unquoteGitPath` decodes `\ooo` octal escapes, `\n \r \t \b \f \v \\ \"`, and returns bytes as UTF-8 via
  `Buffer.from(bytes).toString()`. If any path changed it *rewrites* the stored diff — a one-time migration
  performed lazily on read.
  Why it exists: `core.quotePath` (git's default) escapes non-ASCII filenames, so diffs of files with non-ASCII
  names can be stored as `"\303\251t\303\251.txt"`. The snapshot engine now passes
  `-c core.quotepath=false` on name-listing commands (it keeps two arg sets, `cfg` and
  `quote = [...cfg, "-c", "core.quotepath=false"]`), so new entries are already raw; the repair function is
  therefore a lazy migration for diffs written before that flag existed, and it rewrites storage on first read.
  `18` §7.4.

## 13. Projectors — how events become rows (`session/projectors.ts`)

The SQLite projection layer is a set of `SyncEvent.project(Event, (db, data) => ...)` handlers:

| Event | SQL |
|---|---|
| `Session.Created` | `insert(SessionTable).values(toRow(info))` |
| `Session.Updated` | `update ... set toPartialRow(info) ... returning()`; missing row → `NotFoundError` |
| `Session.Deleted` | `delete` |
| `Message.Updated` | `insert ... onConflictDoUpdate(id, {data})` |
| `Message.Removed` | `delete where id AND session_id` |
| `Part.Updated` | `insert ... onConflictDoUpdate(id, {data})` |
| `Part.Removed` | `delete where id AND session_id` |

Two contracts encoded here:

- **`grab(obj, field, cb)`** throws if a field is present-but-`undefined`:
  `"Session update failure: pass \`null\` to clear a field instead of \`undefined\`"`. Because
  `toPartialRow` filters out `undefined` values, "not mentioned" and "set to null" are semantically different —
  a partial update can never accidentally null a column, and clearing requires an explicit `null`. This is a
  small, high-value invariant for an event-sourced projection.
- **`foreign(err)`** detects `SQLITE_CONSTRAINT_FOREIGNKEY` / `"FOREIGN KEY constraint failed"` and downgrades it
  to `log.warn("ignored late message update")`. A part or message event that arrives for a session already
  deleted (or a message removed by a revert) is *expected* on a bus with no ordering guarantee, so the projector
  tolerates exactly this error class and rethrows everything else.
- The `data` column stores the whole message/part minus `id`/`sessionID`/(`messageID`) — so schema evolution is
  a JSON-shape concern, not a migration concern, for message bodies.

---

## 14. What this pass changed in the earlier conclusions

| Earlier claim | Status after this pass |
|---|---|
| ACP is "a 4-line re-export", internals undetermined (`11` §3.4) | **Wrong.** 1,470 lines in `acp/agent__dup2.ts`; §7 above. |
| "Tool results are passed through to the model" (`05`) | Incomplete. Media is relocated into a synthetic user message unless the tool-result path supports it — `@ai-sdk/{anthropic,openai,amazon-bedrock,google-vertex/anthropic}` plus `@ai-sdk/google` **only** for `gemini-3*` ids (5 checks, one conditional); interrupted calls are rewritten to `output-error`; compacted outputs become a placeholder string. |
| "Revert deletes messages" (`04`) | Incomplete. `revert` is non-destructive and part-granular; deletion happens in `cleanup` at the next prompt; file restoration is per-file `git checkout` with delete-if-absent. |
| "`tools` is deprecated, ignored" (`08`) | **Wrong.** It is converted into a full permission *replacement*. |
| "Config unknown keys warn" | **Wrong.** `Config.Info` is `.strict()`; unknown keys fail validation. |
| "`websearch` is provider-agnostic" (`06`) | **Wrong.** Fixed Exa MCP endpoint, no key, no config. |
| "`sse.ts` unread" (`15` §12) | Read; it is a generic SSE client with non-JSON fallback events. |
| "Protected paths are platform-dependent" (`10`) | Confirmed *and* explained: the bundle has the darwin branch folded in (`if (true)/if (false)`), so this binary's protected set is macOS-only. |

## 15. New debt introduced by this pass

1. **`resolvePart` fabricates tool call transcripts.** `Called the Read tool with the following input: ...` is
   injected into the transcript for content the model did *not* fetch. It works, but it makes the conversation
   lie about its own history, and it means a future change to the Read tool's output format silently changes
   how attachments are described in every past session.
2. **`ask: async () => {}`** on the emulated Read path (and `bypassCwdCheck`) is an undocumented permission
   bypass whose safety depends entirely on the outer turn having been authorised.
3. **User-supplied `agent` parts append "guaranteed to exist"** even when the agent's permission table denies
   `task`. The delegation check is advisory in exactly the case where it matters most.
4. **Synthetic parts are sent; `synthetic` is not filtered by `toModelMessages`.** The flag is UI metadata only.
5. **`include("gemini-3") && !include("gemini-2")`** is a substring test standing in for a model capability
   table, in a function that also hardcodes five npm package names. Any new SDK family requires a code change.
6. **`aborted` shell commands are persisted as `completed`**, with the abort recorded only as
   `<metadata>` text inside the output string.
7. **Two parallel ACP part-mapping sites** (`message.part.updated` and `message.part.delta`) with duplicated
   pending/running/completed/error branches — a maintenance trap already visible in the line numbers.
8. **`StructuredOutputError.retries` is always 0** while `OutputFormatJsonSchema.retryCount` defaults to 2; the
   retry budget is declared but never used.
9. **`Config.Info.strict()` + deprecated fields** (`autoshare`, `mode`, `layout`, `tools`) means deprecated
   configuration is both accepted and rejected-by-typo, with no migration path other than a validation error.
10. **Fire-and-forget writes in `shellImpl`** (`Effect.runFork(sessions.updatePart(part))` per chunk) can
    interleave with the final `finish` write; correctness relies on the storage layer's serialisation, not on
    this code.
