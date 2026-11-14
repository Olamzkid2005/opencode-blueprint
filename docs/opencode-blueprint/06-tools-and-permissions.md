# 06 — Tools and the permission system

<!-- toc -->
## Contents

- [1. The tool contract — `Tool.define` (`src/tool/tool.ts`)](#1-the-tool-contract--tooldefine-srctooltoolts)
- [2. `ToolRegistry` (`src/tool/registry.ts`)](#2-toolregistry-srctoolregistryts)
  - [2.1 Composition](#21-composition)
  - [2.2 Resolution order and filtering](#22-resolution-order-and-filtering)
- [3. The builtin tools — verified behaviour](#3-the-builtin-tools--verified-behaviour)
  - [3.1 Why `edit` has nine replacers — [inferred]](#31-why-edit-has-nine-replacers--inferred)
  - [3.2 `read` — windows, caps and content types (`src/tool/read.ts`, 291 lines)](#32-read--windows-caps-and-content-types-srctoolreadts-291-lines)
  - [3.3 `write` — formatter, events and diagnostics (`src/tool/write.ts`, 95 lines)](#33-write--formatter-events-and-diagnostics-srctoolwritets-95-lines)
  - [3.4 `edit` — replacers, line endings, lock (`src/tool/edit.ts`, 564 lines)](#34-edit--replacers-line-endings-lock-srctooleditts-564-lines)
  - [3.5 `glob` — ripgrep, cap, mtime order (`src/tool/glob.ts`, 73 lines)](#35-glob--ripgrep-cap-mtime-order-srctoolglobts-73-lines)
  - [3.6 The gate sequence these four share](#36-the-gate-sequence-these-four-share)
  - [3.7 Output truncation and the spill directory (`tool/truncate.ts` 114, `tool/truncation-dir.ts` 6,](#37-output-truncation-and-the-spill-directory-tooltruncatets-114-tooltruncation-dirts-6)
  - [3.8 `apply_patch` — Codex-format patching end to end](#38-apply_patch--codex-format-patching-end-to-end)
  - [3.9 The command-arity table (`permission/arity.ts`, 155 lines)](#39-the-command-arity-table-permissionarityts-155-lines)
  - [3.10 Clipboard (`cli/cmd/tui/util/clipboard__dup2.ts`, 155 lines)](#310-clipboard-clicmdtuiutilclipboard__dup2ts-155-lines)
- [4. The permission system](#4-the-permission-system)
  - [4.1 Data model (`src/permission/index.ts`)](#41-data-model-srcpermissionindexts)
  - [4.2 Evaluation — four lines that decide everything (`evaluate.ts`)](#42-evaluation--four-lines-that-decide-everything-evaluatets)
  - [4.3 The ask flow](#43-the-ask-flow)
  - [4.4 Integration with the turn](#44-integration-with-the-turn)
  - [4.5 What is *not* guarded](#45-what-is-not-guarded)
- [5. Tool exposure surface and prompt coupling](#5-tool-exposure-surface-and-prompt-coupling)
  - [5.1 The `.txt` descriptions (per-file)](#51-the-txt-descriptions-per-file)
- [6. Adding a tool — the contract in one page](#6-adding-a-tool--the-contract-in-one-page)

<!-- /toc -->

Modules: `src/tool/*.ts` (18 tools + one `.txt` prompt each), `src/tool/registry.ts`, `src/tool/tool.ts`,
`src/permission/{index,evaluate,arity,schema}.ts`

---

## 1. The tool contract — `Tool.define` (`src/tool/tool.ts`)

Every tool, builtin or user-supplied, is produced by one wrapper:

```js
function wrap2(id, init) {
  return async (initCtx) => {
    const toolInfo = init instanceof Function ? await init(initCtx) : { ...init };
    const execute2 = toolInfo.execute;
    toolInfo.execute = async (args, ctx) => {
      try { toolInfo.parameters.parse(args); }               // (1) validate
      catch (error) {
        if (error instanceof ZodError && toolInfo.formatValidationError)
          throw new Error(toolInfo.formatValidationError(error), { cause: error });
        throw new Error(`The ${id} tool was called with invalid arguments: ${error}.
Please rewrite the input so it satisfies the expected schema.`, { cause: error });
      }
      const result = await execute2(args, ctx);              // (2) run
      if (result.metadata.truncated !== undefined) return result;
      const truncated = await Truncate.output(result.output, {}, initCtx?.agent);  // (3) cap
      return { ...result, output: truncated.content,
               metadata: { ...result.metadata, truncated: truncated.truncated,
                           ...(truncated.truncated && { outputPath: truncated.outputPath }) } };
    };
    return toolInfo;
  };
}
```

Verified responsibilities, in order:

1. **Schema validation with a model-readable error.** The thrown message explicitly instructs
   "Please rewrite the input so it satisfies the expected schema" — the error text is *prompt engineering*, not
   just diagnostics, because it is fed back to the model as the tool result.
2. **`init` may be async and is called per session/agent** (`initCtx.agent`) so a tool can vary its behaviour by
   agent (e.g. different prompt text or limits).
3. **Uniform truncation.** Unless a tool already declares `metadata.truncated`, output is capped by
   `Truncate.output` (2000 lines / 50 KB), which returns `{content, truncated, outputPath}` — the full output is
   spilled to `Global.Path.data/tool-output/<tool id>` and the path is handed to the model. The limits are fixed;
   only the *hint* varies by agent (whether it may delegate to the `task` tool). Details and the cleanup schedule
   are in §3.7.

Two entry points exist: `Tool.define(id, def)` (sync init) and `Tool.defineEffect(id, effect)` (Effect-returning
init). Plugin tools bypass `define` and are adapted in the registry (`fromPlugin`) with the same validate → run →
truncate sequence, plus `directory`/`worktree` injected into the context.

## 2. `ToolRegistry` (`src/tool/registry.ts`)

### 2.1 Composition

```js
const state = InstanceState.make(Effect.gen(function* (ctx) {
  const custom = [];
  // (a) user tools:  {tool,tools}/*.{js,ts} in every config directory
  const dirs = yield* config.directories();
  const matches = dirs.flatMap(dir => Glob.scanSync("{tool,tools}/*.{js,ts}", {cwd: dir, absolute: true, dot: true, symlink: true}));
  if (matches.length) yield* config.waitForDependencies();
  for (const match of matches) { … custom.push(fromPlugin(`${namespace}_${id}`, def)); }
  // (b) plugin tools
  for (const p of yield* plugin.list()) for (const [id, def] of Object.entries(p.tool ?? {})) custom.push(fromPlugin(id, def));
  return { custom };
}));
```

Then a fixed set of builtins is materialised through `Effect.isEffect(x) ? x : Effect.succeed(x)`:

`invalid`, `question`, `bash`, `read`, `glob`, `grep`, `edit`, `write`, `task`, `webfetch`, `todo`,
`websearch`, `codesearch`, `skill`, `apply_patch`, `lsp`, `batch`, `plan`.

Verified consequences:

- **Per-directory registry.** Tool discovery is inside `InstanceState.make`, so tools differ per project directory
  — you can have project-local tools.
- **`waitForDependencies()` before importing user tools**: the loader waits for plugin/config dependency
  installation, because a local tool may `import` a package that is not installed yet.
- **`batch`** exists as a tool that executes several other tools in one call — a token-efficiency decision made at
  the schema level rather than by the model.
- **`invalid`** is a real registered tool: it is what the registry substitutes when a requested tool is unknown,
  so the model gets a structured "no such tool" instead of a protocol error.

### 2.2 Resolution order and filtering

`ToolRegistry.all(custom)` merges builtins with custom tools and filters by config/agent (disabled tools,
agent-scoped lists) and by `lastUser.tools` overrides carried on the message. Because the prompt loop passes
`tools: lastUser.tools` (from `SessionPrompt.resolveTools`), a single session can enable/disable tools per turn.

## 3. The builtin tools — verified behaviour

| Tool | Key implementation facts |
|---|---|
| **`bash`** | Parses the command with **tree-sitter-bash** (`commands2`, `parts3`, `source`) to extract command names and file arguments — this is how it can produce permission patterns (`git *`, `/path`, …) *before* execution. Handles PowerShell separately (`expand3` understands `$env:`, `${env:}`, `$HOME/$PWD/$PSHOME`, `Filesystem::` provider prefixes), expands `~`, strips quotes, and derives a `prefix` up to the first glob metacharacter. Dynamic constructs (`$(…)`, backticks, `$VAR`) make a path non-resolvable and therefore non-pattern-able. |
| **`edit`** | Nine layered replacers, tried in order, each yielding candidate spans: `SimpleReplacer`, `LineTrimmedReplacer`, `BlockAnchorReplacer`, `WhitespaceNormalizedReplacer`, `IndentationFlexibleReplacer`, `EscapeNormalizedReplacer`, `TrimmedBoundaryReplacer`, `ContextAwareReplacer`, `MultiOccurrenceReplacer`. A candidate is accepted only if it occurs **exactly once** (`indexOf === lastIndexOf`) unless `replaceAll`. Rejects `oldString === newString`. Normalises/detects/preserves CRLF. `trimDiff` removes common indentation from reported diffs; `levenshtein2` provides a similarity measure for the not-found diagnostic. Post-write hooks and the read-before-write guard are in §3.4. |
| **`read`** | Line-windowed reads with three hard caps, binary sniffing, `data:` URIs for images/PDF, and a directory-listing mode — §3.2 |
| **`write`** | Full-file write: read-before-write assertion for existing files, `edit` permission carrying the diff, formatter, watcher event, LSP diagnostics (20/file + 5 other files) — §3.3 |
| **`glob`** | Ripgrep file walk, first **100** results kept, sorted by mtime descending — §3.5 |
| **`grep`** | Backed by `Ripgrep` (`src/file/ripgrep.ts`), which *downloads* a platform ripgrep binary when none is bundled and raises typed errors (`DownloadFailedError`, `UnsupportedPlatformError`, `ExtractionFailedError`). |
| **`codesearch`** | Structural/code search over the repo (distinct from text `grep`). |
| **`webfetch` / `websearch`** | Network tools; both are permission-gated and truncation-capped. |
| **`task`** | Spawns a **subagent** as a child session; the `subtask` part carries `agent`, `description`, `model`, `prompt`, and the parent loop pops it from the task queue and calls `handleSubtask`. |
| **`todo`** (`todowrite`) | Maintains a task list as session state (`src/session/todo.ts`), surfaced in the TUI sidebar. |
| **`skill`** | Loads a skill body from `src/skill/*`; `PRUNE_PROTECTED_TOOLS = ["skill"]` in compaction means its output is never pruned. |
| **`apply_patch`** | Applies a multi-file patch (the Codex-style `*** Begin Patch` format) with its own parser in `src/patch/index.ts`. |
| **`lsp`** | Queries language servers through `src/lsp/*` (definitions, references, diagnostics, symbols). |
| **`question`** | Blocks the agent on a user question; rejection raises `Question.RejectedError`, which the processor treats like a permission rejection (stops the loop rather than failing the turn). |
| **`invalid`** (`tool/invalid.ts` 19) | A built-in error tool (`"Do not use"`) that returns *"The arguments provided to the tool are invalid: `<error>`"* — the endpoint for calls the model shaped wrongly. |
| **`plan`** (`plan_exit`, `tool/plan.ts` 73) | Terminates plan mode: asks (`Question.ask`) *"Plan at <relative path> is complete. Would you like to switch to the build agent and start implementing?"* with header `Build Agent`, and on Yes inserts a synthetic user message ("The plan at <path> has been approved, you can now edit files. Execute the plan", `synthetic: true`, agent `build`, model = the last user message model or Provider default), which is the plan→build switch `SessionPrompt.insertReminders` relays. |

### 3.1 Why `edit` has nine replacers — [inferred]

The model must express an edit as an exact string match. Every wrapper/fence/indentation drift in a model's output
would otherwise produce a failed edit. The cascade trades a little CPU (and some ambiguity) for a much higher
first-try success rate, while the "must be unique" rule prevents silently editing the wrong occurrence. The
`levenshtein2` measure exists to make the failure message actionable ("closest match") rather than "not found".

### 3.2 `read` — windows, caps and content types (`src/tool/read.ts`, 291 lines)

Three independent caps apply to text output, and all three are per call:

```js
DEFAULT_READ_LIMIT = 2000          // lines, unless params.limit
MAX_LINE_LENGTH    = 2000          // chars per line; longer lines get "... (line truncated to 2000 chars)"
MAX_BYTES          = 50 * 1024     // bytes of assembled text, checked before each line is added
```

`offset` is 1-indexed and coerced from a string; `offset < 1` fails with `offset must be greater than or equal to 1`
before anything is read. The reader is a `readline` stream over `createReadStream(..., "utf8")`, so it never loads the
whole file: it skips `offset - 1` lines, keeps up to `limit`, and keeps *draining* the stream after the limit (unless
the byte cap stops it) so it can report the true line count and offer a continuation offset. Consequences worth knowing:

- A single 10 MB single-line file yields **one** line truncated to 2,000 chars + suffix — the byte budget never sees
  the rest.
- The 50 KB check happens **before** each line is appended, so the assembled text never exceeds the cap; the loop then
  stops with `cut = true` and the footer switches from "Showing lines a–b of N" to "Output capped at 50 KB. Showing
  lines a–b".
- `offset` past EOF fails with `Offset <n> is out of range for this file (<count> lines)` — except the empty-file
  `offset=1` case, which succeeds with zero lines.

The order of operations, which explains a few odd behaviours:

1. absolutise against `Instance.directory` (relative paths are accepted here even though the schema says "absolute");
2. `assertExternalDirectory(ctx, filepath, {kind})` — outside the worktree this raises an `external_directory`
   permission request for `<parentDir>/*`;
3. `ctx.ask({permission:"read", patterns:[filepath], always:["*"]})` — note this happens **before** the existence
   check, so reading a nonexistent path still prompts, and "always" is granted as `*`, i.e. one approval covers every
   path for the session rule set;
4. `stat` → missing file: fuzzy suggestions (`readDirectory(dirname)` filtered by case-insensitive substring either
   way, first 3) in the `File not found: … Did you mean one of these?` error;
5. directory → listing mode: entries sorted with `localeCompare`, directories (and symlinks whose target stats as a
   directory) get a trailing `/`, the same `offset`/`limit` window applies, and truncation reports
   `Use 'offset' parameter to read beyond entry <offset + sliced.length>`;
6. `instruction.resolve(...)` — the `AGENTS.md` injection described in `04` §9.3 — then MIME dispatch:
   `image/*` except `image/svg+xml` and `image/vnd.fastbidsheet`, or `application/pdf`, returned as a
   `data:<mime>;base64,…` attachment with output `"Image read successfully"` / `"PDF read successfully"`;
7. plain text → binary detection, then the line window.

Binary detection is extension-first (`.zip .tar .gz .exe .dll .so .class .jar .war .7z .doc .docx .xls .xlsx .ppt
.pptx .odt .ods .odp .bin .dat .obj .o .a .lib .wasm .pyc .pyo` → rejected outright), then a 4 KB sample: any NUL byte
means binary; otherwise binary is **>30 % of the sample being control bytes other than TAB/LF/VT/FF/CR**
(`b < 9 || (b > 13 && b < 32)`). Bytes ≥ 0x80 — i.e. all UTF-8 multibyte and Latin-1 text — are *not* counted as
non-printable, so the test catches control-character garbage, not simply "high bytes". A text file with a `.dat`
extension is still unreadable because the extension check runs first, and a UTF-16 file is caught by the NUL rule.

Successful text output is `<path>…</path>`, `<type>file</type>`, `<content>` with `N: line` prefixes, and a footer
(`End of file - total N lines`, `Showing lines a-b of N. Use offset=c to continue.`, or the 50 KB variant). Side
effects at the end: `warm()` forks `LSP.touchFile(filepath, false)` in the tool's scope (so the language server sees
the file without blocking the reply) and records `FileTime.read(sessionID, filepath)` — which is what later makes
`write`/`edit` legal. Loaded instruction files are appended inside `<system-reminder>` and recorded in
`metadata.loaded`.

### 3.3 `write` — formatter, events and diagnostics (`src/tool/write.ts`, 95 lines)

[verified] Sequence, in order:

```
resolve path (relative → Instance.directory)
assertExternalDirectory(ctx, filepath)              // external_directory gate, kind defaults to "file"
exists?  → read old content;  FileTime.assert(sessionID, filepath)   // only if it exists
diff = trimDiff(createTwoFilesPatch(path, path, old, new))
ctx.ask({ permission: "edit", patterns: [relative(worktree, path)], always: ["*"], metadata: { filepath, diff } })
Filesystem.write(filepath, content)
Format.file(filepath)                               // formatter hook; failures are the formatter's problem
Bus.publish(File.Edited, {file})
Bus.publish(FileWatcher.Event.Updated, {file, event: exists ? "change" : "add"})
FileTime.read(sessionID, filepath)                  // re-stamp so a following write is allowed
LSP.touchFile(filepath, true)                       // wait:true
diagnostics = LSP.diagnostics()
```

Three things are easy to get wrong when reading this:

- **The read-before-write rule is skippable.** `FileTime.assert` is only called when the file already exists, so a new
  file needs no prior read. For an existing file it throws `You must read file <p> before overwriting it. Use the Read
  tool first`, and if mtime/size changed since that read it throws `File <p> has been modified since it was last read`
  with both timestamps. `OPENCODE_DISABLE_FILETIME_CHECK` turns the whole guard off.
- **There is no per-file lock.** `edit` wraps its work in `FileTime.withLock`; `write` does not, so two concurrent
  writes to the same path are ordered only by the event loop.
- **Diagnostics are not scoped to the written file.** It walks *every* entry of `LSP.diagnostics()`, takes severity-1
  issues only, caps each file at `MAX_DIAGNOSTICS_PER_FILE2 = 20` (with `... and N more`), and additionally emits up to
  `MAX_PROJECT_DIAGNOSTICS_FILES = 5` *other* files under "LSP errors detected in other files". The written file itself
  is matched by normalised path, so the message says "in this file" for it and "in other files" for the rest. A
  project full of pre-existing type errors therefore pollutes every successful write.

`metadata` carries `{diagnostics, filepath, exists}` — the whole diagnostics map, not just the reported slice.

### 3.4 `edit` — replacers, line endings, lock (`src/tool/edit.ts`, 564 lines)

The nine-replacer cascade is in the table above; the numbers behind it are:

| Replacer | Trigger / threshold |
|---|---|
| `SimpleReplacer` | exact substring only |
| `LineTrimmedReplacer` | per-line `trim()` equality over a sliding window |
| `BlockAnchorReplacer` | first+last line anchors, needs ≥3 lines; a single candidate skips the ambiguity check because the threshold is `0` (the similarity test cannot fail), while multiple candidates need `>= 0.3` (mean Levenshtein similarity over inner lines) |
| `WhitespaceNormalizedReplacer` | `\s+` collapsed to one space, per line and per block, then a regex built from the words |
| `IndentationFlexibleReplacer` | common indentation stripped from both sides |
| `EscapeNormalizedReplacer` | `\n \t \r ' " ` \\ $` unescaped in the search string |
| `TrimmedBoundaryReplacer` | `oldString.trim()` as the match |
| `ContextAwareReplacer` | first/last line anchors, **≥50 %** of inner non-empty lines equal, same block length |
| `MultiOccurrenceReplacer` | yields the same `oldString` once per occurrence; with `replaceAll` the first accepted candidate is replaced everywhere |

`replace5` accepts the first candidate that occurs exactly once (`indexOf === lastIndexOf`) unless `replaceAll` is set;
if a candidate exists but is ambiguous it keeps trying later replacers, and only at the end does it distinguish
`Could not find oldString in the file` from `Found multiple matches for oldString`. Identical strings are rejected
before any of this (`No changes to apply: oldString and newString are identical.`).

Line endings: `detectLineEnding` returns `\r\n` if the file contains any CRLF, otherwise `\n`; both `oldString` and
`newString` are normalised to `\n` and then converted to the file's ending, so a model that sends `\n` into a CRLF file
still matches, and the file's ending is preserved.

The execute path is materially different from `write`:

1. `FileTime.withLock(filepath, …)` — a per-path semaphore, so edits to the same file serialise;
2. `oldString === ""` is a **create** path: write `newString`, format, publish events, stamp `FileTime.read`, and
   return early (no existence check, no `FileTime.assert`);
3. otherwise `stat` (missing → `File <p> not found`; directory → `Path is a directory, not a file`), then
   `FileTime.assert` (same read-before-write + mtime/size guard as §3.3);
4. read, replace, diff, `ask({permission:"edit", metadata:{filepath, diff}})`, write, `Format.file`, publish
   `File.Edited` + watcher `change`, then **re-read the file** and regenerate the diff — so the diff the user sees and
   the diff in `metadata` include whatever the formatter changed;
5. `ctx.metadata({diff, filediff, diagnostics: {}})`; `filediff.additions/deletions` are counted with `diffLines`
   over before/after, so they also reflect formatting;
6. `LSP.touchFile(filepath, true)` then `LSP.diagnostics()`, but unlike `write` it reports **only this file's**
   severity-1 issues, capped at 20.

### 3.5 `glob` — ripgrep, cap, mtime order (`src/tool/glob.ts`, 73 lines)

Order is unusual: the permission request comes **first**, keyed on the *pattern* (`permission:"glob"`, `patterns:
[pattern]`, `always:["*"]`, `metadata:{pattern, path}`), and only then is `path` resolved (`Instance.directory` default,
relative resolved against it) and `assertExternalDirectory(..., {kind:"directory"})` called. So an outside-worktree
search prompts twice: once for the glob and once for the directory.

Results come from `Ripgrep.files({cwd, glob:[pattern], signal: ctx.abort})`, are collected until `limit = 100`, then
sorted by `mtime` **descending** — a hardcoded recency bias, not alphabetical or path order. Output is one absolute
path per line; empty → `No files found`; truncated → a blank line and
`(Results are truncated: showing first 100 results. Consider using a more specific path or pattern.)`. `metadata` is
`{count, truncated}`, and the title is the path relative to the worktree. `ctx.abort` is passed to ripgrep, so a
cancelled turn stops the walk rather than finishing it in the background.

### 3.6 The gate sequence these four share

Reading the four modules side by side, the ordering is consistent but not uniform:

| Step | `read` | `write` | `edit` | `glob` |
|---|---|---|---|---|
| external-directory gate | before ask | before ask | before ask | **after** ask |
| permission name | `read` | `edit` | `edit` | `glob` |
| pattern | absolute filepath | path relative to worktree | path relative to worktree | the glob pattern |
| existence check | after ask | after ask | after ask | — |
| `FileTime.assert` | no | only if exists | yes (not on create) | no |
| per-file lock | no | **no** | yes | no |
| writes `FileTime.read` | yes (at end) | yes | yes | no |
| formatter | no | yes | yes | no |
| LSP touch | `false`, forked | `true`, awaited | `true`, awaited | no |
| diagnostics reported | no | 20 in this file, 20 in each of up to 5 other files | 20, this file only | no |

Two asymmetries are worth calling out because they are behavioural, not stylistic: `write` has no per-file lock
(`edit` serialises through `FileTime.withLock`), and only `write` reports diagnostics from files it did not touch. Both
are documented as-is rather than as intent.

### 3.7 Output truncation and the spill directory (`tool/truncate.ts` 114, `tool/truncation-dir.ts` 6,
`tool/schema.ts` 12)

`truncation-dir.ts` exists solely to define one constant:

```js
TRUNCATION_DIR = path.join(Global.Path.data, "tool-output")   // $XDG_DATA_HOME/opencode/tool-output
Truncate.DIR   = TRUNCATION_DIR
Truncate.GLOB  = path.join(TRUNCATION_DIR, "*")
```

`tool/schema.ts` is the ID type used for the files in that directory: `ToolID` is a branded string with
`make`, `ascending` (`Identifier.ascending("tool", …)`, producing `tool_<timestamp><random>`) and `zod`, built on the
shared `Identifier`/`withStatics` pattern from `02` §7. Its only consumer is `truncate.ts:81` — the **file name** of a
spilled output — which is why the cleanup job can filter on the `tool_` prefix and sort by ID timestamp.

`Truncate.output(text, options, agent)`:

- limits `MAX_LINES = 2000`, `MAX_BYTES = 50 KB`, `direction: "head" | "tail"` (default `"head"`); callers may
  override all three, but none in this tree does;
- fast path: `lines.length <= maxLines && totalBytes <= maxBytes` → returned unchanged with `truncated: false`, and
  **no file is written**;
- otherwise it keeps the head (or tail), accumulating lines until one of the caps would be exceeded. The removed
  amount is reported in **bytes** when the byte cap is what stopped it and in **lines** otherwise, so the marker is
  either `...N bytes truncated...` or `...N lines truncated...`;
- it writes the **complete** original text to `<TRUNCATION_DIR>/<ToolID.ascending()>` (`ensureDir` + `writeFileString`,
  both `orDie`), then returns `{content, truncated: true, outputPath}`;
- the hint appended to the content depends on the agent: `hasTaskTool` evaluates
  `evaluate("task", "*", agent.permission)` and, when the result is not `deny`, tells the model to have the explore
  agent Grep/Read the saved file and *not* read it itself; otherwise it suggests `Grep` or `Read` with
  `offset`/`limit`. This is the only place the agent changes truncation behaviour — the numbers never do.

Retention: on layer construction the service forks a scoped loop that runs `cleanup()` after a 1-minute delay, then
every hour. `cleanup` lists `TRUNCATION_DIR`, keeps only names starting with `tool_`, parses the timestamp out of each
ID, and deletes anything older than `RETENTION = 7 days`; listing and deletion failures are swallowed (deletion via
`catch(() => void)`), and only the loop itself logs (`truncation cleanup failed` with a pretty-printed cause). Because
the loop is forked scoped, spill files are only pruned while some opencode process is alive.

Three call sites, and one opt-out:

| Caller | What is truncated |
|---|---|
| `Tool.define`/`defineEffect` wrapper (§1) | every builtin that does not set `metadata.truncated` — bash, task, webfetch, … |
| `fromPlugin` in `registry.ts` | plugin tools, whose result is a bare string, rewritten to `{title:"", output, metadata:{truncated, outputPath}}` |
| MCP adapter in `session/prompt.ts` | MCP content parts joined into text; non-text resources become `data:` attachments instead |

`read` and `grep` set `metadata.truncated` themselves, so the wrapper leaves them alone — that is why `read` has its
own 2000-line / 2000-char / 50 KB logic (§3.2) and `grep` its own match cap, and why neither produces a spill file.

Reading the files back is frictionless by construction: `agent/agent.ts` adds
`external_directory: { [Truncate.GLOB]: "allow" }` to every agent's default ruleset (alongside the skill directories),
and only skips that merge when the agent explicitly declares a `deny` rule for that exact glob. So the path handed to
the model can be `read` without an external-directory prompt, while an explicit deny still wins.

### 3.8 `apply_patch` — Codex-format patching end to end

`src/tool/apply_patch.ts` (250 lines) is the last of the four file-writing tools: `Tool.define("apply_patch",
{parameters: {patchText: string}})`, where `patchText` follows the Codex/Glama plugin format (`*** Begin Patch`,
`*** Add File:`, `*** Update File:`, `*** Delete File:`). The whole call is split into a **planning phase** and a
**writing phase**, exactly like `edit`'s two-phase flow, but bigger:

1. **Parse** — `Patch.parsePatch(patchText)` gives the hunk list; a parse error or zero hunks aborts with
   `apply_patch verification failed: …`. An empty `Begin/End Patch` body is special-cased as
   `"patch rejected: empty patch"` before the generic no-hunks error — the empty patch is rejected *as a policy*, not
   as a parse failure.
2. **Plan** — every hunk is turned into a `fileChange` *without writing anything*: `add` (mkdir + write, additions/
   deletions counted from `diffLines`), `update` (requires the target file to exist and not be a directory, then
   `Patch.deriveNewContentsFromChunks`), `move` (an update with `move_path`), `delete` (content read now so the
   deletion diff/line count exist — `contentToDelete.split("\n").length`, trailing newline included — can be computed).
3. **Ask once** — `ctx.ask({permission: "edit", patterns: <all worktree-relative paths>, always: ["*"], metadata:
   {filepath: <comma-joined>, diff: <totalDiff>, files: [...]}})` — the same ask shape as `edit` but with the
   unified diff of *every* planned change in the metadata. A decline aborts the entire patch; there is no per-file
   partial application.
4. **Write** — per change: `add`/`update` do `mkdir -p` of the dirname then a plain `writeFile`; `move` writes the
   destination and **unlinks the old path**; `delete` unlinks. Events are recorded as `add`/`change`/`unlink` and
   published after all changes (so the watcher sees one batch, not interleaved churn), and each surviving target is
   then run through `Format.file`, which records the edits for the same LSP/project-diagnostic hooks `write` uses.
5. **Report** — `output = "Success. Updated the following files:\nA|M|D <relpath>\n…"` and per-file diagnostics:
   `LSP.diagnostics()` (the *whole* project diagnostic map, not scoped to the touched files), filtered to
   `severity === 1` (errors) and limited to `MAX_DIAGNOSTICS_PER_FILE3 = 20` per file, each rendered as a
   `<diagnostics file="…">` block appended to the output. `title`, `metadata` and `output` all carry the same diff/
   diagnostics payload.

Differences worth knowing: `apply_patch` never calls `File.status`; its diagnostics come from `LSP.diagnostics()`
instead. It is the only one of the four writing tools that can move files, and the only one whose permission ask
carries every file's diff in the metadata.

### 3.9 The command-arity table (`permission/arity.ts`, 155 lines)

The `bash` permission patterns (§3 row, §4) are not "the first word of the command" — they're shaped by a
**command-arity table** of ~124 entries, because the useful granularity is `npm run` (3), not `npm` (2), and
`git remote` (3), not `git` (unknown). `BashArity.prefix(tokens)` walks candidate prefixes from *longest to
shortest*, joining with single spaces and looking each up in `ARITY`; the first hit wins, and the prefix is the
table's arity count of tokens. A command that isn't in the table at all yields **just the first token**. So:

- `cat foo bar` → prefix `cat` → the rememberable pattern is `cat *`
- `git remote add x` → prefix `git remote` → `git remote *`
- `ls -la` → arity 1 → `ls *` (not `ls -la *`)

The table has four families: one-operand shell builtins/builtins-compat (`cat, cd, chmod, cp, echo, ls, rm, touch,
…` all 1); two-token families (`bazel, brew, cargo, cdk, deno, …` all 2, plus matches with `2` like
`terraform: 2`, `systemctl: 2`); three-token subcommands (`aws, az, bun run, bun x, cargo add, cargo run, consul
kv, deno task, docker {builder, compose, container, image, network, volume}, npm {exec, init, run, view},
kubectl {kustomize, rollout}, eksctl create, git {config, remote, stash}, …` all 3). The lookup being
longest-first means the more specific entry always wins over its own command (`bun run` beats `bun` for
`bun run dev`).

The consumer is in `tool/bash.ts`: `scan5.always.add(BashArity.prefix(tokens).join(" ") + " *")` — the
"always allow this *kind* of command" suggestion the user sees in the permission dialog (§4) is *exactly* this
arity-prefixed wildcard, not a full glob over the whole command line.

### 3.10 Clipboard (`cli/cmd/tui/util/clipboard__dup2.ts`, 155 lines)

Clipboard is OS detection + an OSC 52 announcement, not a single clipboard API:

- **Copy** always writes an OSC 52 sequence (`ESC ] 52 ; c ; <base64> BEL`) when stdout is a TTY — so a
  host terminal receives the copy even if the local mechanism fails — wrapped for tmux/screen passthrough when
  `TMUX` or `STY` is set (`ESC P tmux; ESC <seq> ESC \`). Then a native mechanism copies (the first hit in this
  order): **Windows/WSL → PowerShell** (`System.Windows.Forms.Clipboard`), **Wayland → `wl-copy`** (if
  `WAYLAND_DISPLAY` and in PATH), **X11 → `xclip`** (if present), **`xsel`** (if present), **PowerShell**
  (fallback), and finally the `clipboardy` npm package. The native write always follows the OSC 52 write, which is
  why the terminal paste works even for headless/remote sessions.
- **Read is image-only** and deliberately small: on darwin it screenshots the clipboard *image* via
  `osascript`'s AppleScript clipboard image export to a tmpfile (`$TMPDIR/opencode-clipboard.png`), reads the
  bytes back as base64 `image/png`, and unlinks the tmpfile in a `finally` (the catch is empty by design). On
  win32/WSL the same image is read through PowerShell's `System.Windows.Forms.Clipboard.GetImage()` →
  `System.Drawing.Imaging.ImageFormat.Png` → base64. **There is no text read path** — this module exposes
  `copy` and the image `read`, nothing for text.

## 4. The permission system



### 4.1 Data model (`src/permission/index.ts`)

```ts
Action  = "allow" | "deny" | "ask"
Rule    = { permission: string, pattern: string, action: Action }
Ruleset = Rule[]
Request = { id, sessionID, permission, patterns: string[], metadata, always: string[], tool?: {messageID, callID} }
Reply   = "once" | "always" | "reject"
```

### 4.2 Evaluation — four lines that decide everything (`evaluate.ts`)

```js
function evaluate2(permission, pattern, ...rulesets) {
  const rules = rulesets.flat();
  const match = rules.findLast(rule =>
    Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern));
  return match ?? { action: "ask", permission, pattern: "*" };
}
```

Verified semantics:

- **Last match wins** (`findLast`), so later/more specific rules override earlier ones; layering order is the
  policy language.
- **Both axes are wildcards**: the permission name *and* the pattern (`Wildcard.match` supports `*`).
- **Default is `ask`**, never `allow`. Fail-closed by construction.

### 4.3 The ask flow

`Permission.layer` keeps per-instance state `{ pending: Map<id, Deferred>, approved: Rule[] }`, where `approved`
is loaded from the `permission` table for the project (so "always allow" survives restarts).

```js
const ask = Effect.fn("Permission.ask")(function* (input) {
  const { approved, pending } = yield* InstanceState.get(state);
  const { ruleset, ...request } = input;
  let needsAsk = false;
  for (const pattern of request.patterns) {
    const rule = evaluate(request.permission, pattern, ruleset, approved);
    if (rule.action === "deny")
      return yield* new DeniedError({ ruleset: ruleset.filter(r => Wildcard.match(request.permission, r.permission)) });
    if (rule.action === "ask") needsAsk = true;
  }
  …
});
```

Notable design points:

- **Any `deny` short-circuits immediately** with `DeniedError`, carrying only the *relevant* rules in the message
  so the model is told exactly which rule blocked it.
- **`ask` is sticky**: if any pattern needs asking, the whole call is asked as one request listing all patterns —
  the user answers once per tool call, not once per path.
- Pending requests are `Deferred`s in a map, and the layer's `addFinalizer` **fails every pending request with
  `RejectedError`** on instance disposal. That is the guarantee that a disposed project cannot leave the agent
  waiting forever.
- Three error types encode *why* it was refused: `RejectedError` (user said no), `CorrectedError{feedback}` (user
  said no **with** guidance), `DeniedError{ruleset}` (policy, no human involved).

### 4.4 Integration with the turn

- `SessionProcessor` treats `Permission.RejectedError` and `Question.RejectedError` as **blocking**: it sets
  `ctx.blocked = ctx.shouldBreak` instead of marking a hard error, so the loop ends cleanly and the transcript
  stays coherent.
- `config.experimental.continue_loop_on_deny === true` flips that default, letting the model see the rejection and
  try another approach.
- `doom_loop` is itself a permission: three identical tool calls raise `permission: "doom_loop"` with
  `patterns: [toolName]` and `always: [toolName]`.

### 4.5 What is *not* guarded

[verified] Permissions are evaluated per tool call by the tool's own `ask` invocation; there is no central
choke point in `Tool.define`. A plugin tool that never calls `permission.ask` is not gated. The builtin tools do
call it — verified for `bash`, `read`, `write`, `edit`, `glob` and `webfetch` (§3.2–§3.5) — but the security invariant
is per-tool discipline, not enforced
architecture. This is the most important security observation in this document; see `10-security-and-reliability.md`.

## 5. Tool exposure surface and prompt coupling

Each builtin ships a sibling `.txt` (`bash.txt`, `edit.txt`, …) that is injected as the tool description. That is
a deliberate split: prompt text is versioned next to the implementation, and the description can be long without
bloating the code. `plan-exit.txt`, `todowrite.txt` etc. confirm the convention.

---

### 5.1 The `.txt` descriptions (per-file)

Each `tool/*.txt` is the `description` text returned to the model (verified constants) — worth quoting the
load-bearing ones:

- `bash.txt` (119): OS/shell banner (`${os}`, `${shell}`), `workdir` parameter, "AVOID `cd <dir> && <cmd>`".
- `batch.txt` (25): "USING THE BATCH TOOL WILL MAKE THE USER HAPPY"; **1–25 calls per batch**, parallel,
  ordering NOT guaranteed, partial failures don't stop others, no nesting, "2–5x efficiency gain".
- `apply_patch.txt` (35): the `*** Begin Patch … *** End Patch` envelope, three headers
  (Add/Delete/Update File), `+` prefixing rule.
- `lsp.txt` (21): the nine operations (goToDefinition, findReferences, hover, documentSymbol, workspaceSymbol,
  goToImplementation, prepareCallHierarchy, incoming/outgoingCalls), 1-based line/character.
- `websearch.txt` (16): Exa AI, live crawling modes (`fallback`/`preferred`), search types
  (`auto`/`fast`/`deep`), and "The current year is `{{year}}`" — the model must use the current year.
- `question.txt` (12): `custom` default-on typing, "Multiple"/"Recommended" annotations, `custom: false` in
  plan-exit.
- `edit.txt` (2), `glob.txt` (8), `grep.txt` (10), `write.txt` (10), `read.txt` (16), `task.txt` (62),
  `todowrite.txt` (169), `plan-exit.txt` (15), `codesearch.txt` (14), `webfetch.txt` (15): each a two-to-few
  hundred-word usage summary verified per file (the larger ones read in §3 above).

`tool/question.ts` (35) itself wraps `Question.Service.ask` — the `custom:true` field is omitted from the
parameters so the model can't set it, and the output formats answers as `"q"="a, b"` joined with commas and an
"Unanswered" fallback. `tool/todo.ts` (39) is `Tool.defineEffect("todowrite")`: parameters `todos: Todo.Info[]`,
a permission ask with pattern/always `*`, `Todo.update({sessionID, todos})` as an Effect, title `<open> todos`,
and the JSON of the list as output.

## 6. Adding a tool — the contract in one page

```js
// .opencode/tool/hello.js  (project-local, discovered by the registry glob)
export default {
  description: "Say hello",
  parameters: z.object({ name: z.string() }),
  async execute(args, ctx) {           // ctx: sessionID, agent, directory, worktree, abort…
    await Permission.ask({ permission: "hello", patterns: [args.name], ruleset: ctx.agent.permission });
    return { title: "hello", output: `Hello ${args.name}`, metadata: {} };
  }
};
```

The registry will expose it as `hello` (file name) or `hello_<export>` when a module exports several tools, wrap
it with validation and truncation, and include it in `resolveTools` unless disabled by config or agent scope.
