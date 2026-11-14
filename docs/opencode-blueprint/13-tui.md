# 13 — The TUI (18,159 lines across `src/cli/cmd/tui/**`)

<!-- toc -->
## Contents

- [1. Process and boot (`thread.ts` → `app.tsx`)](#1-process-and-boot-threadts--apptsx)
  - [1.1 `TuiThreadCommand` (`thread.ts:53`)](#11-tuithreadcommand-threadts53)
  - [1.2 Provider tree (`app.tsx:84 tui()`)](#12-provider-tree-apptsx84-tui)
  - [1.3 `App` (`app.tsx:207`) — routing and plugin runtime](#13-app-apptsx207--routing-and-plugin-runtime)
- [2. Data layer: `SyncProvider` (`context/sync.tsx`, 379 lines)](#2-data-layer-syncprovider-contextsynctsx-379-lines)
  - [2.1 `SDKProvider` (`context/sdk.tsx`, 108 lines) — SSE throttle and workspace pinning](#21-sdkprovider-contextsdktsx-108-lines--sse-throttle-and-workspace-pinning)
- [3. Local selection state: `context/local.tsx` (393 lines)](#3-local-selection-state-contextlocaltsx-393-lines)
  - [3.1 Agent selection](#31-agent-selection)
  - [3.2 Model selection and persistence](#32-model-selection-and-persistence)
- [4. Keybindings (`context/keybind.tsx`, 98 lines)](#4-keybindings-contextkeybindtsx-98-lines)
  - [2.2 `createSimpleContext`, args, route, prompt-ref and plugin-keybinds](#22-createsimplecontext-args-route-prompt-ref-and-plugin-keybinds)
  - [4.1 `Keybind` — parse, match, print (`util/keybind.ts`, 92 lines)](#41-keybind--parse-match-print-utilkeybindts-92-lines)
- [5. The session route (`routes/session/index.tsx`, 3,020 lines)](#5-the-session-route-routessessionindextsx-3020-lines)
  - [5.1 Memo graph at the top (lines 10–185)](#51-memo-graph-at-the-top-lines-10185)
  - [5.2 Navigation helpers](#52-navigation-helpers)
  - [5.3 The command registry (lines 218–819)](#53-the-command-registry-lines-218819)
  - [5.4 Message rendering](#54-message-rendering)
  - [5.5 Revert view (819–900)](#55-revert-view-819900)
  - [5.6 The sidebar (`routes/session/sidebar.tsx`, 129 lines) — a plugin-slot shell](#56-the-sidebar-routessessionsidebartsx-129-lines--a-plugin-slot-shell)
  - [5.7 The subagent footer (`routes/session/subagent-footer.tsx`, 174 lines)](#57-the-subagent-footer-routessessionsubagent-footertsx-174-lines)
  - [5.8 The session-list dialog (`component/workspace/dialog-session-list.tsx`, 141 lines)](#58-the-session-list-dialog-componentworkspacedialog-session-listtsx-141-lines)
  - [12.7 The home footer (`feature-plugins/home/footer.tsx`, 138 lines)](#127-the-home-footer-feature-pluginshomefootertsx-138-lines)
  - [5.9 The home route (`routes/home.tsx`, 122 lines)](#59-the-home-route-routeshometsx-122-lines)
  - [5.10 The message-actions dialog (`routes/session/dialog-message.tsx`, 92 lines)](#510-the-message-actions-dialog-routessessiondialog-messagetsx-92-lines)
- [6. The permission dialog (`routes/session/permission.tsx`, 949 lines)](#6-the-permission-dialog-routessessionpermissiontsx-949-lines)
- [7. The question dialog (`routes/session/question.tsx`, 609 lines)](#7-the-question-dialog-routessessionquestiontsx-609-lines)
- [8. The composer (`component/prompt/index.tsx`, 1,282 lines)](#8-the-composer-componentpromptindextsx-1282-lines)
  - [8.1 Structure](#81-structure)
  - [8.2 Virtual text via extmarks](#82-virtual-text-via-extmarks)
  - [8.3 Submit (`submit()`, line 477) — the whole send path](#83-submit-submit-line-477--the-whole-send-path)
  - [8.4 Interrupt](#84-interrupt)
  - [8.5 Other verified behaviours](#85-other-verified-behaviours)
- [9. Autocomplete (`component/prompt/autocomplete.tsx`, 592 lines)](#9-autocomplete-componentpromptautocompletetsx-592-lines)
- [10. Chrome: dialogs, toasts, commands](#10-chrome-dialogs-toasts-commands)
  - [10.1 `ui/dialog.tsx` (197) — the modal mechanism, in full](#101-uidialogtsx-197--the-modal-mechanism-in-full)
  - [10.2 `ui/dialog-select__dup2.tsx` (479) — the generic picker](#102-uidialog-select__dup2tsx-479--the-generic-picker)
  - [10.3 `ui/toast.tsx` (119) and `ui/spinner.ts` (206)](#103-uitoasttsx-119-and-uispinnerts-206)
  - [10.4 The sidebar is a plugin set, not a component (`feature-plugins/sidebar/*`)](#104-the-sidebar-is-a-plugin-set-not-a-component-feature-pluginssidebar)
- [11. Theme (`context/theme.tsx`, 1,040 lines)](#11-theme-contextthemetsx-1040-lines)
  - [11.1 The 33 theme files — schema, token set and palette sizes](#111-the-33-theme-files--schema-token-set-and-palette-sizes)
- [12. TUI plugin runtime (`plugin/runtime.ts`, 851 lines; `plugin/api.tsx`, 433)](#12-tui-plugin-runtime-pluginruntimets-851-lines-pluginapitsx-433)
  - [12.1 Scopes with bounded cleanup](#121-scopes-with-bounded-cleanup)
  - [12.2 Enable/disable with two persistence layers](#122-enabledisable-with-two-persistence-layers)
  - [12.3 Install and patch flow (`installPluginBySpec`)](#123-install-and-patch-flow-installpluginbyspec)
  - [12.4 Loading](#124-loading)
  - [12.5 Plugin API surface (`plugin/api.tsx` + `pluginApi`)](#125-plugin-api-surface-pluginapitsx--pluginapi)
  - [12.6 The plugin-manager system panel (`feature-plugins/system/plugins.tsx`, sources the runtime rows above)](#126-the-plugin-manager-system-panel-feature-pluginssystempluginstsx-sources-the-runtime-rows-above)
  - [12.8 The MCP dialog (`component/dialog-mcp.tsx`, 91 lines)](#128-the-mcp-dialog-componentdialog-mcptsx-91-lines)
  - [12.9 Prompt stash, history and frecency](#129-prompt-stash-history-and-frecency)
  - [12.10 Logo, startup loading (`component/logo.tsx` 95, `component/startup-loading.tsx` 77)](#1210-logo-startup-loading-componentlogotsx-95-componentstartup-loadingtsx-77)
  - [12.11 KV state, exit orchestration and small utils](#1211-kv-state-exit-orchestration-and-small-utils)
  - [12.12 Textarea keybindings (`component/textarea-keybindings.ts`, 62 lines)](#1212-textarea-keybindings-componenttextarea-keybindingsts-62-lines)
  - [12.13 Home tips (`feature-plugins/home/tips.tsx` 55, `tips-view.tsx` 62)](#1213-home-tips-feature-pluginshometipstsx-55-tips-viewtsx-62)
  - [12.14 The stash dialog (`component/dialog-stash.tsx`, 77 lines)](#1214-the-stash-dialog-componentdialog-stashtsx-77-lines)
  - [12.14.1 `TuiEvent` (`cli/cmd/tui/event.ts`, 41 lines) — the TUI-internal bus events](#12141-tuievent-clicmdtuieventts-41-lines--the-tui-internal-bus-events)
  - [12.14.2 Root-session list (`component/dialog-session-list.tsx`, 95 lines) and the fork dialog](#12142-root-session-list-componentdialog-session-listtsx-95-lines-and-the-fork-dialog)
  - [12.14.3 Agent, variant and skill pickers](#12143-agent-variant-and-skill-pickers)
  - [12.14.4 Session rename, borders, scrolling, selection, and model utils](#12144-session-rename-borders-scrolling-selection-and-model-utils)
  - [12.14.5 `INTERNAL_TUI_PLUGINS`, TuiConfig context, `createDebouncedSignal`](#12145-internal_tui_plugins-tuiconfig-context-createdebouncedsignal)
  - [12.15 Theme picker, todo item, missing-route view and slot registry](#1215-theme-picker-todo-item-missing-route-view-and-slot-registry)
- [13. Windows (`win32.ts`, 101 lines)](#13-windows-win32ts-101-lines)
- [14. What the TUI does *not* do](#14-what-the-tui-does-not-do)

<!-- /toc -->

The TUI is a full Solid-based terminal application rendered through `@opentui` primitives
(`box`, `text`, `scrollbox`, `diff`, `textarea`, `extmark`). It is **not** a view over a local model
— every mutation is an SDK call, every read is the `SyncProvider` store.

This document is based on reading: `app.tsx` (884), `thread.ts` (180), `context/{sync,local,keybind,theme,sdk,args,route,kv}.tsx`,
`routes/session/{index.tsx 3020, permission.tsx 949, question.tsx 609, sidebar.tsx}`, `component/prompt/{index.tsx 1282, autocomplete.tsx 592}`,
`component/dialog-*`, `ui/{dialog,dialog-select,toast,spinner}`, `plugin/{runtime.ts 851, api.tsx 433}`,
`feature-plugins/**`, `win32.ts`, `util/*`.

---

## 1. Process and boot (`thread.ts` → `app.tsx`)

### 1.1 `TuiThreadCommand` (`thread.ts:53`)

Yargs command is `"$0 [project]"` with `--model/-m`, `--continue/-c`, `--session/-s`, `--fork`, `--prompt`,
`--agent`, plus network options. Handler, in verified order:

```js
win32InstallCtrlCGuard();  win32DisableProcessedInput();
if (args.fork && !args.continue && !args.session) → error, exitCode 1
const next = args.project ? resolve(project) : resolve(cwd)
process.chdir(next)                         // Fails → "Failed to change directory to " + next
const worker = new Worker(await target(), { env: filtered(process.env) })
worker.onerror = e => Log.Default.error(e)
const client = Rpc.client(worker)
process.on("uncaughtException"|"unhandledRejection", err) ; process.on("SIGUSR2", reload)
const stop = async () => { … await withTimeout(client.call("shutdown"), 5000); worker.terminate() }
const prompt = await input(args.prompt)     // stdin piped text + arg
const config = await Instance.provide({directory: cwd, fn: () => TuiConfig.get()})
const transport = external ? {url: (await client.call("server", network)).url}
                           : {url: "http://opencode.internal", fetch: createWorkerFetch(client), events: createEventSource(client)}
setTimeout(() => client.call("checkUpgrade", {directory: cwd}).catch(() => {}), 1000).unref?.()
await tui({url, onSnapshot, config, directory, fetch, events, args})
finally → stop()
```

Verified decisions:

- **`process.chdir` happens in the UI thread before the worker spawns**, so the worker inherits the directory as
  its cwd; `Instance.provide({directory: cwd})` then constructs the config for that path.
- **The external/local transport switch** is `--port | --hostname | --mdns | mdns | port !== 0 | hostname !== "127.0.0.1"`.
  If external, the worker starts a real `Bun.serve` and the UI talks HTTP to it; otherwise RPC carries `fetch` and
  events (`createWorkerFetch` marshals `Request` → `{url, method, headers, body}` → `Response`, losing streaming
  bodies [verified: `body: await request.text()`]).
- **`--fork` guard**: forking requires a target session, checked before anything expensive happens.
- **`SIGUSR2` → `client.call("reload")`** — the UI keeps running while the worker reloads config.
- **`onSnapshot`** writes a V8 heap snapshot in the UI thread *and* asks the worker for its own
  (`client.call("snapshot")`) — both returned to the caller for bug reports.
- **stdin piping**: `input()` concatenates piped stdin with `--prompt`, so `echo "fix tests" | opencode` works.

### 1.2 Provider tree (`app.tsx:84 tui()`)

```
ErrorBoundary → ErrorComponent(fallback)
 ArgsProvider → ExitProvider → KVProvider → ToastProvider → RouteProvider → TuiConfigProvider
   → SDKProvider → SyncProvider → ThemeProvider → LocalProvider → KeybindProvider
     → PromptStashProvider → DialogProvider → CommandProvider → FrecencyProvider
       → PromptHistoryProvider → PromptRefProvider → App
```

[verified] The order is a dependency order, and it is effectively the component architecture:
transport (`SDK`) → data (`Sync`) → presentation policy (`Theme`, `Local` selection state) → input (`Keybind`) →
composer state (`Stash`, `History`, `Frecency`, `PromptRef`) → chrome (`Dialog`, `Command`).

`tui()` also does: `getTerminalBackgroundColor()` (to pick light/dark), `createCliRenderer(rendererConfig(config))`,
`TuiPluginRuntime.dispose()` on `beforeExit` (so plugin cleanup runs on exit paths, including errors).

### 1.3 `App` (`app.tsx:207`) — routing and plugin runtime

- `routes = new Map<name, Array<{render}>>` + `routeRev` signal; `routeView(name)` returns `routes.get(name)?.at(-1)?.render`
  — **a stack per route name, last wins**. This is how a plugin can override an existing route (e.g. replace the
  home screen) without forking the app.
- `createTuiApi({...})` builds the plugin-facing API and `TuiPluginRuntime.init(api)` is awaited before `ready`.
- Copy-on-select: unless `OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT`, `ctrl+c` with an active selection copies
  via `Selection.copy` and swallows the event; `escape` clears the selection.

## 2. Data layer: `SyncProvider` (`context/sync.tsx`, 379 lines)

Already documented in `07` §4.2 for mechanics. Additions verified here:

- Store shape includes both `provider` and `provider_next`, `console_state`, `session_status`, `session_diff`,
  `mcp_resource`, `workspaceList` — everything the UI renders comes from this one store.
- `Binary.search(collection, id, x => x.id)` + `reconcile(...)`/`produce(...)` for ordered inserts (see 07).
- Components never call `session.messages()`; they read `sync.data.message[sessionID]` and `sync.data.part[messageID]`.

**Consequence [inferred]:** the UI can render a session that is being streamed by another process (remote server)
with zero code differences, because it never holds authoritative state.

### 2.1 `SDKProvider` (`context/sdk.tsx`, 108 lines) — SSE throttle and workspace pinning

`useSDK()` returns the API client plus the event emitter the data layer lives on. Two mechanics:

- **16 ms event coalescing.** SSE events aren't emitted as they arrive: `handleEvent` queues them and flushes in a
  `batch()` either immediately (if ≥16 ms elapsed since the last flush) or after a 16 ms timer — so at most one
  render batch per frame even at flood rates, matching the TUI's render pipeline. On SSE end, the queue is flushed
  before the reconnect loop starts over.
- **Workspace pinning.** The client is created with `experimental_workspaceID` baked in; `setWorkspace(next)`
  recreates the whole client and re-establishes the SSE only when events aren't injected via props. So switching
  workspace means a fresh transport — you cannot accidentally send a request for the old workspace on the new
  client. Cleanup aborts the root AbortController, the SSE controller, and the flush timer.

## 3. Local selection state: `context/local.tsx` (393 lines)

This is the "what am I about to send" state, distinct from session data.

### 3.1 Agent selection

```js
agents = sync.agent.filter(a => a.mode !== "subagent" && !a.hidden)
visibleAgents = sync.agent.filter(a => !a.hidden)
current() = agents.find(a => a.name === store.current) ?? agents[0]
set(name) → if unknown: toast "Agent not found: X" (no throw)
move(dir) → wraps around
color(name) → agent.color as "#rrggbb" → RGBA.fromHex ; else theme[color] ; else palette[index % 7]
```

[verified] `color()` has a **stable fallback palette** (`secondary, accent, success, warning, primary, error, info`)
indexed by position in `visibleAgents` — so agent colours stay consistent within a session but shift if agents are
added/removed. It also means colour is presentation-only and never persisted.

### 3.2 Model selection and persistence

```js
filePath = path.join(Global.Path.state, "model.json")
save() → if (!ready) { pending = true; return }   // write-after-load guard
readJson(filePath).then(x => {recent, favorite, variant}).finally(() => { ready = true; if (pending) save() })
```

- The store is `{ready, model, recent, favorite, variant}` persisted to `~/.local/state/opencode/model.json`.
- The `pending` flag prevents clobbering the file with an empty store when a save happens before the read resolves.
  [inferred] classic load/race bug fix; the flag is the whole mechanism.
- `fallbackModel` prefers `--model` if `isModelValid` (provider exists in `sync.provider` and `models[modelID]` is
  present), i.e. **CLI model is validated against the live catalogue** and silently ignored if unknown.

## 4. Keybindings (`context/keybind.tsx`, 98 lines)

A leader-key state machine, not a static map:

```js
leader(active):
  if active: setStore("leader", true); focus = renderer.currentFocusedRenderable; focus?.blur();
             timeout = setTimeout(() => { if (!leader) return; leader(false); focus?.focus() }, 2000)
  else: if (focus && !renderer.currentFocusedRenderable) focus.focus(); setStore("leader", false)
```

- **Leader times out after 2 s** and restores focus to the previously focused renderable.
- `parse(evt)`: `\x1F` (Ctrl-_) is remapped to `ctrl+_` — [inferred] a terminal quirk workaround.
- `match(key, evt)` reads `keybinds()[key] ?? Keybind.parse(key)`, so **every bind has a textual fallback**:
  config can override any binding, and an unconfigured bind still works.
- `print(key)` renders the first binding and substitutes `<leader>` with the configured leader key — this is why
  help text is always accurate to the user's config.
- Bindings are parsed through `Keybind.parse` from `TuiConfig`, memoised.

Command IDs observed as keybinds: `session_share`, `session_rename`, `session_timeline`, `session_fork`,
`session_compact`, `session_unshare`, `messages_undo`, `messages_redo`, `sidebar_toggle`, `messages_toggle_conceal`,
`display_thinking`, `tool_details`, `scrollbar_toggle`, `messages_page_up/down/line_up/line_down/half_page_up`,
`input_submit`, `input_paste`, `session_interrupt`, `editor_open`, `history_previous/next`, `app_exit`.

### 2.2 `createSimpleContext`, args, route, prompt-ref and plugin-keybinds

`helper.tsx` (27) is the factory behind every TUI context: `createSimpleContext({name, init})` — the provider
renders children only when the init result's `ready` is `undefined || true` (the KV gate) and throws
`<name> context must be used within a context provider` outside one.
`context/args.tsx` (7) just passes through props; `context/route.tsx` (23) builds `{data, navigate}` from
`OPENCODE_ROUTE` (already-JSON, parsed at boot) defaulting to `{type: "home"}`; `context/prompt.tsx` (17)
holds the mutable composer ref behind a getter/setter pair, and `plugin-keybinds.ts` (19) freezes the merged
defaults+overrides map, `txt()` normalising blank/non-string overrides to the default, and `match`/`print`
delegating to the base keybind. `component/spinner.tsx` (43): 10 braille frames at an 80 ms interval, gated by
the `animations_enabled` KV flag — off shows the static `⋯` glyph in the same colour.

### 4.1 `Keybind` — parse, match, print (`util/keybind.ts`, 92 lines)

`Keybind.parse(str)` splits on commas into combos, rewrites `<leader>` → `leader+`, lowercases, and maps
tokens: `ctrl`, `alt|meta|option` → meta, `super`, `shift`, `leader`, `esc` → `escape`, else the final token is the
key name; `"none"` parses to `[]`. `Keybind.match(a, b)` deep-compares via `k2` with `super` defaulting to
`false` on both sides (so an unmodulated super never matches an explicit one). `Keybind.toString()` re-joins in
the order `ctrl + alt + super + shift + name`, maps `delete` → `del`, and prefixes `<leader>`. `fromParsedKey`
rewrites a space name to `space` and carries a `leader` flag.

## 5. The session route (`routes/session/index.tsx`, 3,020 lines)

### 5.1 Memo graph at the top (lines 10–185)

```js
session       = sync.session.get(route.sessionID)
children      = (subagent list)
messages      = sync.data.message[sessionID] ?? []
permissions   = sync.data.permission[sessionID] ?? []
questions     = sync.data.question[sessionID] ?? []
visible       = !session()?.parentID && permissions().length===0 && questions().length===0
disabled      = permissions().length > 0 || questions().length > 0     // composer disabled
pending       = (optimistic/pending message id)
lastAssistant = …
wide          = dimensions().width > 120
sidebarVisible= … (auto/hide + width)
contentWidth  = width - (sidebarVisible ? 42 : 0) - 4
```

[verified] **A permission or question request disables the composer for the whole session** — approvals block input
at the route level, not at the SDK level. `contentWidth` hardcodes 42 columns for the sidebar; the layout is
arithmetic, not flexbox-only.

### 5.2 Navigation helpers

- `findNextVisibleMessage(direction)`, `scrollToMessage(direction, dialog)`, `toBottom()`
- `moveFirstChild()` / `moveChild(direction)` / `childSessionHandler(fn)` — subagent navigation: a session with
  `parentID` renders differently and can be left with a child-aware keybind.
- `bind(renderable)` wires scroll acceleration from `tuiConfig`.

### 5.3 The command registry (lines 218–819)

`command.register(() => [ … ])` returns an array of command descriptors with a uniform shape:

```js
{ title, value, keybind?, category, slash?: {name, aliases?}, enabled?, hidden?, disabled?, onSelect(dialog) }
```

Verified commands and what each actually does:

| value | Effect |
|---|---|
| `session.share` | copies existing URL, else `kv.get("share_consent")` gate → `DialogConfirm` → `sdk.client.session.share` → copy URL; disabled when `config.share === "disabled"` |
| `session.rename` | `dialog.replace(DialogSessionRename)` |
| `session.timeline` / `session.fork` | dialog with `onMove(messageID)` that scrolls by `child.y - scroll.y - 1`; fork version also has `setPrompt` |
| `session.compact` | requires a selected model (else warning toast "Connect a provider to summarize this session"), calls `session.summarize({sessionID, modelID, providerID})`; slash alias `summarize` |
| `session.unshare` | only enabled when a share URL exists |
| `session.undo` | aborts a running turn first (`session_status !== idle`), finds the last user message before any existing revert point, `session.revert(...)`, **and restores the message text + file parts into the composer** |
| `session.redo` | finds the next user message after the revert point; if none, `session.unrevert` and clear the composer |
| toggles | `sidebar`, `conceal`, `timestamps`, `thinking`, `details`, `scrollbar`, `generic tool output` — all local signal toggles except the sidebar's persisted `kv` value |
| scrolling | `page up/down`, `line up/down` (disabled), `half page` — all `scroll.scrollBy(...)` in units of `scroll.height` |

[verified] **Undo is implemented as: revert + refill the prompt**, which is why `/undo` feels like "take that back
and let me edit it" rather than "delete the message". Redo re-applies the revert marker one message forward.

### 5.4 Message rendering

- `UserMessage` (1233): picks the **first non-synthetic text part**, plus all `file` parts; colour comes from
  `local.agent.color(message.agent)`; `metadataVisible = queued() || showTimestamps()`; a `compaction` part changes
  the rendering (compaction markers are visible to the user, not hidden).
- `AssistantMessage` (1408): looks up the model display name, computes `final` and `duration`, subscribes to keybinds
  for per-message actions.
- `ReasoningPart` (1584) / `TextPart` (1630): streaming-aware; `TextPart` reads `part.time.end` to decide
  "still streaming" vs "done".
- **`ToolPart` (1703)** is the dispatch table:

```js
const toolprops = {
  metadata: state.status === "pending" ? {} : state.metadata ?? {},
  input: state.input ?? {},
  output: state.status === "completed" ? state.output : undefined,
  permission: sync.data.permission[sessionID]?.find(p => p.tool?.callID === part.callID),
  tool, part
};
<Switch> bash→Bash, glob→Glob, read→Read, grep→Grep, list→List, webfetch→WebFetch,
         codesearch→CodeSearch, websearch→WebSearch, write→Write, edit→Edit, task→Task,
         apply_patch→…, default→GenericTool </>
```

Each tool has a bespoke renderer (diff view for `edit`/`write`, syntax-highlighted output for `read`, task card for
`task`). `shouldHide()` hides completed tools unless `showDetails()` is on — the "tool details" toggle is a filter
inside `ToolPart`, not a route.

`GenericTool` (1858) collapses unknown/MCP tools to `maxLines = 3` with an overflow indicator — [verified] the
fallback is intentionally lossy so a chatty MCP tool cannot flood the transcript.

### 5.5 Revert view (819–900)

```js
revertMessageID, revertDiffFiles, revertRevertedMessages, revert
```

The route computes what to grey out from `session.revert` plus the per-step diffs in `step-finish` parts — the UI
mirror of `SessionRevert` in the backend (see 04 §8).

### 5.6 The sidebar (`routes/session/sidebar.tsx`, 129 lines) — a plugin-slot shell

The sidebar directory: `Sidebar({sessionID, overlay})` is a fixed **width-42 box** (`flexGrow` scrollbox, 100%
height, 1/1/2/2 padding, `backgroundPanel` background) containing exactly three plugin slots:

| Slot | Mode | Default content |
|---|---|---|
| `sidebar_title` | `single_winner` | session title bold + share URL in `textMuted` when set |
| `sidebar_content` | (default stacking) | *nothing built in* — filled by the `context` feature plugin (Context section: branch, worktree, todos…) |
| `sidebar_footer` | `single_winner` | `• OpenCode {Installation.VERSION}` — `•`+`Open` in `success`, `Code` in `text`, version in `textMuted` |

[verified] The built-in sidebar owns no content of its own: the title and footer are only *default children* of
their slots, so any plugin can replace them through `single_winner`. That is a different design from the footer
slot in the home screen (which stacks several `single_winner` names) — the sidebar's three slots are the honest
answer to "how does the context panel appear on the right", and `context` (§13 feature plugins) is the only
content producer.

The scrollbox gets `scrollAcceleration` from the TUI config and a scrollbar styled `background`/`borderActive`,
and the whole sidebar is `position: absolute` when `overlay` is set (over the transcript) else `relative`.

### 5.7 The subagent footer (`routes/session/subagent-footer.tsx`, 174 lines)

Shown at the bottom of a subagent session (one with a `parentID`), the footer renders:

- **Label** — derived by parsing the child's title for `@<word> subagent` and title-casing the word
  (`Explore` from `@explore subagent`), fallback `"Subagent"`.
- **Position** — siblings are the sessions sharing the same `parentID`, sorted by `time.created`; the footer shows
  `(index of total)` (the index is 1-based). Without a `parentID` there is no position, only the label.
- **Usage** — tokens summed from the *latest* assistant message with output tokens
  (`input + output + reasoning + cache.read + cache.write`), shown both as a count and as a percentage of the
  model's `limit.context`, plus the session's total cost rendered with `Intl.NumberFormat` USD (only when > 0),
  joined by ` · `. The whole usage line hides when the figure is zero (e.g. before the first assistant turn).
- **Navigation** — `Parent <keybind>` (`session_parent`), `Prev <keybind>` (`session_child_cycle_reverse`),
  `Next <keybind>` (`session_child_cycle`), each mouse-hoverable (hover background changes) and triggered via
  the command dialog. The footer itself is a `backgroundPanel` box with a left border in `theme.border`, 1/1/2/1
  padding.

### 5.8 The session-list dialog (`component/workspace/dialog-session-list.tsx`, 141 lines)

`DialogSessionList({workspaceID?, localOnly?})` is the session switcher, with three data sources depending on
props: search results (debounced 150 ms, `session.list({search, limit: 30})`), a server listing when a
`workspaceID` is given (`session.list({roots: true})`), or the sync cache (filtered to `!workspaceID` for
`localOnly`). Rules, all verified:

- **No subagents**: sessions with a `parentID` are excluded; `roots: true` in the API call is the same filter
  server-side.
- **Date grouping** as the select category ("Today" for today, else the date string), latest-updated-first;
  each option shows the session title and `Locale.time(updated)` in the footer; **busy sessions get a Spinner
  gutter** from `session_status`.
- **Two-step delete**: the first `session_delete` press arms the row — the title becomes
  `Press <key> again to confirm` and the background goes `error` — the second press actually calls
  `sdk.client.session.delete` and updates state locally (cache filter or resource mutation); movement disarms.
  A failure toasts `"Failed to delete session"`.
- `skipFilter` is true when the search is server-side (`!localOnly`), and initial selection is the current
  route's session.
- Rename replaces the dialog with `DialogSessionRename`. The dialog sizes itself to `large` on mount.

### 12.7 The home footer (`feature-plugins/home/footer.tsx`, 138 lines)

Plugin `"internal:home-footer"` registers the `home_footer` slot (order 100) with three items:
`Directory` (`~` (home) : `branch`, textMuted, so `~/work/main`); `Mcp` (`⊙ N` — dot color is `error` when any
server failed, `success` when at least one connected, `textMuted` otherwise, then `MCP` and a muted
`/status`; the whole item is absent when no MCP servers are known); and right-aligned `Version`
(`app.version`, textMuted).

### 5.9 The home route (`routes/home.tsx`, 122 lines)

The home screen is also a plugin-slot shell: `home_logo` (mode `replace`, default `Logo`), `home_prompt`
(mode `replace`, default `Prompt` with `placeholder2` — normal set `["Fix a TODO in the codebase", "What is the
tech stack of this project?", "Fix broken tests"]`; shell set `["ls -la", "git status", "pwd"]` — plus a nested
`home_prompt_right` slot), then `home_bottom` (stacked) and `home_footer` (`single_winner`, the internal home
footer §12.7). Initial-prompt handling is one-shot: a module-level `once` flag means the initial prompt is fed
into the prompt ref **only once** across route mounts — and independently, `createEffect` submits the prompt when
sync *and* the model are ready, the input still equals the CLI arg, and it hasn't already sent (a per-component
`sent` flag). `Toast` renders a persistent toast area at the bottom. The prompt area is capped at width 75.

### 5.10 The message-actions dialog (`routes/session/dialog-message.tsx`, 92 lines)

Three options over a message: Revert (calls `session.revert` and, when a `setPrompt` is supplied, loads the
message's *non-synthetic* text parts and file parts into the composer — this is the "undo back to here and edit"
path); Copy (joins the non-synthetic text parts and writes them through `Clipboard.copy`, which also OSC 52s
them to the host terminal); and Fork (creates a fork and navigates to it with the message's text/file parts as the
`initialPrompt` —
the `initialPrompt` duplicates the same reduce as Revert, just with unstripped file parts).

## 6. The permission dialog (`routes/session/permission.tsx`, 949 lines)

- `normalizePath(input)`: cwd-relative if inside cwd, `~/…` if inside home, else absolute. `filetype(input)` maps
  extensions through `LANGUAGE_EXTENSIONS` and collapses `typescriptreact|javascriptreact|javascript` to
  `typescript` for syntax highlighting.
- `EditBody`: renders `metadata.diff` through the terminal `diff` primitive with `view: "split"` when width > 120
  and `diff_style !== "stacked"`, otherwise unified; "No diff provided" fallback.
- `PermissionPrompt` has a **two-stage store**: `stage: "permission" | "always" | "reject"`.
  - options: `once: "Allow once"`, `always: "Allow always"`, `reject: "Reject"`, `escapeKey: "reject"`, `fullscreen: true`.
  - `always` → second stage showing the exact patterns it will persist (and special-cases the single `"*"`
    pattern, i.e. "this allows everything").
  - `reject` on a **subagent session** (`session.parentID`) goes to a `RejectPrompt` where the user can type
    *why*, which reaches the model as `CorrectedError{feedback}`.
  - replies are `sdk.client.permission.reply({reply: "once"|"always"|"reject", requestID})`.

[verified] The UI is the only place `CorrectedError` originates, and it is only offered for subagents — a deliberate
scope limit (correcting the parent agent's request is done by editing the prompt instead).

## 7. The question dialog (`routes/session/question.tsx`, 609 lines)

- `single = questions.length === 1 && questions[0].multiple !== true`; `tabs = single ? 1 : questions.length + 1`
  (the extra tab is the **confirm** tab).
- State: `{tab, answers: string[][], custom: string[], selected, editing}`.
- `pick` sets `answers[tab] = [answer]`; for `single()` it **immediately replies** (`answers: [[answer]]`), otherwise
  it advances to the next tab. `toggle` handles `multiple: true`.
- `other` = `custom !== false && selected === options.length` — the implicit "type your own" option, entered by
  `editing`.
- `submit()` sends all tabs' answers; `reject()` sends `question.reject`.
- Keyboard handler returns early when `dialog.stack.length > 0` and while `editing`.

## 8. The composer (`component/prompt/index.tsx`, 1,282 lines)

### 8.1 Structure

`Prompt` holds a `store` of `{placeholder, prompt:{input, parts}, mode: "normal"|"shell", extmarkToPartIndex, interrupt}`
plus refs to the `textarea`, autocomplete and anchor. It registers commands (`prompt.clear`, `prompt.submit`,
`prompt.paste`, `session.interrupt`, `prompt.editor`, `prompt.skills`, `prompt.stash`, `prompt.stash.pop`,
`prompt.stash.list`).

### 8.2 Virtual text via extmarks

Attachments (files, agents, pasted text) are **virtual extmarks** in the text buffer:

```js
input.insertText(virtualText + " ");
const extmarkId = input.extmarks.create({start, end, virtual: true, styleId})
store.extmarkToPartIndex.set(extmarkId, parts.length)
```

On submit, extmarks are converted back into real text:

```js
const allExtmarks = input.extmarks.getAllForTypeId(promptPartTypeId).sort((a,b) => b.start - a.start)  // reverse
for (const extmark of allExtmarks) { const part = parts[extmarkToPartIndex.get(extmark.id)];
  if (part?.type === "text" && part.text) inputText = before + part.text + after }
```

[verified] Sorting **descending by start offset** is what keeps earlier offsets valid while splicing.

### 8.3 Submit (`submit()`, line 477) — the whole send path

```js
if (disabled || autocomplete?.visible || !input) return
trimmed = input.trim()
if (trimmed === "exit" | "quit" | ":q") → exit()          // shell-like affordance
selectedModel = local.model.current(); if (!selectedModel) → toast + provider dialog
sessionID = props.sessionID ?? (await sdk.client.session.create({workspaceID})).data.id
inputText = extmark-substituted text
if (mode === "shell")            sdk.client.session.shell({sessionID, agent, model, command: inputText})
else if (starts with "/" and command name is known)
                                 sdk.client.session.command({sessionID, command, arguments, agent, model:"pid/mid", messageID, variant, parts: fileParts})
else                             sdk.client.session.prompt({sessionID, ...selectedModel, messageID, agent, model, variant,
                                                          parts:[{id: PartID.ascending(), type:"text", text}, ...nonTextParts]})
history.append({...prompt, mode}); clear extmarks/store; onSubmit?.()
if (!props.sessionID) setTimeout(() => route.navigate({type:"session", sessionID}), 50)
```

Verified details worth calling out:

1. **`messageID` is generated client-side** (`MessageID.ascending()`) and sent with the request — the UI owns the
   id of the message it is about to create, which is what makes optimistic insert/reconcile work.
2. **The `/command` branch only fires if the command name exists in `sync.data.command`**; otherwise a leading `/`
   is sent as literal text. So an unknown slash command is not an error.
3. **Slash argument parsing is line-based**: the first line is split on spaces for `command` + args, and the rest of
   the input is appended to `arguments` with a newline. Arguments therefore keep their formatting.
4. **Only `file` parts are forwarded for slash commands** (`nonTextParts.filter(x => x.type === "file")`), while
   ordinary prompts forward all non-text parts — verified asymmetry.
5. **Shell mode** sends the raw line to `session.shell` and resets `mode` to `normal`; it does not clear on failure.
6. **`props.sessionID == null` ⇒ a new session is created on first submit**, and navigation is deferred by 50 ms
   (`setTimeout`) — a pragmatic "let the create event land first" race fix.

### 8.4 Interrupt

```js
if (mode === "shell") { mode = "normal"; return }     // first esc leaves shell mode
interrupt++; reset after 5000ms
if (interrupt >= 2) sdk.client.session.abort(sessionID)
```

**Double-Escape within 5 s aborts the turn**, single Escape leaves shell mode — a two-stage interrupt that avoids
accidental aborts [inferred: mirrors editor muscle memory].

### 8.5 Other verified behaviours

- `usage`: context usage computed as `input+output+reasoning+cache.read+cache.write` of the last assistant message
  with non-zero output, divided by `model.limit.context` → `"12,345 (6%)"`, plus total `cost` formatted with
  `Intl.NumberFormat("en-US", {style:"currency", currency:"USD"})`. **The percentage uses total tokens against the
  context limit**, not just input.
- On session change, the composer **adopts the agent/model/variant of the last user message** (only if that agent
  is a primary agent) — this is how "continue this session" resumes with the right model.
- `prompt.editor` opens `$EDITOR` through `Editor.open({value, renderer})`, then **re-locates every virtual part by
  searching for its virtual text** (`content.indexOf(virtualText)`), dropping parts the user deleted and updating
  `start/end` for the rest.
- `TuiEvent.PromptAppend` lets any part of the app (including plugins) append text into the composer.
- Paste of an image goes through `pasteImage` and becomes a file part, not text.
- History entries store `{prompt, mode}`; `history.move(direction, plainText)` is triggered only at buffer
  boundaries (cursor at 0 with `history_previous`, or at end with `history_next`) or on the first/last visual row.
- `promptModelWarning()` opens `DialogProvider` automatically when `sync.provider.length === 0` — a first-run path.

## 9. Autocomplete (`component/prompt/autocomplete.tsx`, 592 lines)

Verified parsing rules:

```js
extractLineRange("src/a.ts#12-30") → {lineRange:{baseName:"src/a.ts", startLine:12, endLine:30}, baseQuery:"src/a.ts"}
  // "#12-" → startLine 12, endLine undefined ; "#30" alone is not a range
  // endLine only accepted if startLine < endLine
```

- The popup is positioned by polling `props.anchor()` every **50 ms** while visible and bumping a `positionTick`
  when `{x,y,width}` changes — [inferred] the textarea does not emit layout events, so polling is the cheap fix.
- Insertion kinds observed: `file` (with line range), `agent` (`type: "agent"` at 262), plus command/skill entries
  fed from the same registry the dialog uses.
- `store.input` records whether the last interaction was `keyboard` or mouse, so hover does not steal selection.

## 10. Chrome: dialogs, toasts, commands

- `ui/dialog.tsx` (197): a **stack** (`dialog.stack`), with `replace(render)` and `clear()`; every route checks
  `dialog.stack.length > 0` before handling keys, which is the modal mechanism.
- `ui/dialog-select.tsx` (479): generic fuzzy list with sections, `maxItems`, `hint`, keyboard navigation.
- `component/dialog-command.tsx` (153): registry of `Command` objects with `slash` metadata; `useCommandDialog()`
  is the same registry used by the composer's `/` menu and by `SlashCommand` handling.
- `ui/toast.tsx` (119): `toast.show({message, variant: "success"|"error"|"warning"|"info", duration})`.
- `ui/spinner.ts` (206): used by CLI commands (`spinner.start/stop(msg, code)`).
- `component/dialog-provider.tsx` (446), `dialog-model.tsx` (139), `dialog-session-list.tsx` (95),
  `dialog-export-options.tsx` (256), `dialog-workspace-list.tsx` (296), `dialog-console-org.tsx` (100),
  `dialog-status.tsx` (334) — each is a thin form over SDK calls; `dialog-export-options` is the only one with
  file-writing logic (export transcript to markdown/JSON, and it is where `util/transcript.ts` is used).
- `component/error-component.tsx` (121) — the `ErrorBoundary` fallback: shows the error, offers reset/exit and
  `onBeforeExit` (which disposes the plugin runtime).

### 10.1 `ui/dialog.tsx` (197) — the modal mechanism, in full

The `Dialog` component is a full-screen `position:"absolute"`, `zIndex:3000` box with a dimming `RGBA(0,0,0,150)`
overlay and a centred child card whose width is fixed by `size`: `xlarge` 116, `large` 88, everything else 60
columns, clamped to `dimensions().width - 2`. Vertical placement is `paddingTop = height / 4`, so dialogs sit above
the optical centre rather than dead-centre.

`DialogProvider` owns a store `{stack, size}` and exposes `replace(element, onClose)`, `clear()`, `stack`, `size`,
`setSize`:

- `replace` **is the only way to open a dialog** — it closes every existing entry (calling their `onClose`) and
  installs a one-element stack. There is deliberately no `push`: opencode has no stacked-modal interaction, so the
  stack is really "the current dialog", and `stack.length > 0` is the predicate every route uses before consuming
  keys.
- On the first `replace`, the currently focused renderable is `blur()`ed and remembered; `refocus()` walks the
  render tree 1 ms later to check the node still exists before refocusing it. That delay and the existence walk are
  why closing a dialog does not crash when the focused component was destroyed while the dialog was open.
- Keyboard: a provider-level handler consumes `escape` and `ctrl+c` **only when the stack is non-empty**, calls the
  top entry's `onClose`, pops it, and `preventDefault`/`stopPropagation`s. If the user has an active text selection
  (`renderer.getSelection()`), the first `escape` clears the selection instead of closing — copying text out of a
dialog is not sabotaged by the dialog's own dismiss key.
- Mouse: the overlay's `onMouseDown` records whether a selection existed; `onMouseUp` closes only if no selection
  was being made. The inner card stops propagation so clicks inside never dismiss.
- Selection copy is wired into `DialogProvider`, not each dialog: right-click (or mouse-up, depending on
  `OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT`) calls `Selection.copy(renderer, toast)`, which is how "select text,
  get it on the clipboard, get a toast" works uniformly.

Companions built on the same primitive: `dialog-alert.tsx` (70), `dialog-confirm.tsx` (95), `dialog-prompt.tsx`
(160, single-line text input), `dialog-help.tsx` (60, keybind cheatsheet), `dialog-export-options.tsx` (256, the only
one that writes files — markdown/JSON transcript export via `util/transcript.ts`), `link.tsx` (13).

### 10.2 `ui/dialog-select__dup2.tsx` (479) — the generic picker

One component backs the model picker, session list, theme list, command palette and every other list. Verified
mechanics:

- State is `{selected, filter, input}` where `input` records whether the last move came from `keyboard` or `mouse`
  (so hover does not fight the cursor).
- Filtering is **fuzzysort** over the keys `["title", "category"]` with `scoreFn = r => r[0].score*2 + r[1].score` —
  a title match outranks a category match. `skipFilter` and `disabled` options are honoured; `flat` collapses the
  grouping once a filter is typed, because category headers stop being useful when the list is short.
- Grouping is a stable group-by on `category ?? ""`; row height is `min(rows, floor(terminalHeight/2) - 6)`, and
  the list auto-centres the selection with `scrollBy(y - floor(height/2))`, clamping at the ends.
- `props.current` seeds the initial selection by comparing option `value`s through an internal equality helper
  (`k2` in the bundle), which is how the model picker opens with the active model highlighted.
- `move(direction)` wraps around both ends — an arrow key at the bottom jumps to the top.
- `keybind` filtering drops disabled and unbound entries, so the footer hints always match what the list can do.

### 10.3 `ui/toast.tsx` (119) and `ui/spinner.ts` (206)

`Toast`: a single-toast store (`currentToast`), not a queue — a new toast replaces the visible one and cancels the
previous timer. `show()` parses its input through `TuiEvent.ToastShow.properties` (so a plugin cannot inject arbitrary
fields into the theme lookup `theme[variant]`), and the timer is `.unref()`ed so a pending toast never keeps the
process alive. Rendering is `position:absolute; top:2; right:2`, `border: ["left","right"]` with
`SplitBorder.customBorderChars`, `maxWidth: min(60, width-6)`, word-wrapped, with an optional bold title.

`spinner.ts` is not a spinner component — it is a **knight-rider scanner generator**: `createFrames()` precomputes
`width + holdEnd + (width-1) + holdStart` frames (default `width 8`, `holdEnd 9`, `holdStart 30`, i.e. 44 frames per
cycle), each frame a string of `width` characters (`diamonds` style uses `⬥ ◆ ⬩ ⬪` for the trail and `·` for the
background; the fallback style uses `■`/`⬝`), and `createColors()` returns a per-character colour function with the
same geometry. Trail colours are derived from one bright colour (`deriveTrailColors`: full alpha at the head,
1.15× brightness at index 1, then `0.65^(i-1)` alpha) and the inactive colour from `deriveInactiveColor(factor
0.2)`. Fading is applied per frame from the hold/move progress. The result is a fixed-cost animation: everything is
computed once, then indexed by frame — no per-frame allocation in the render loop.

### 10.4 The sidebar is a plugin set, not a component (`feature-plugins/sidebar/*`)

The sidebar is assembled from six internal TUI plugins, each registering into the `sidebar_content` or
`sidebar_footer` slot with an explicit `order`. They are ordinary plugins (same `slots.register` API a third-party
plugin uses), which is why any of them can be replaced by a user plugin with a lower `order`.

| Module | id | order | Slot | Shows |
|---|---|---:|---|---|
| `sidebar/context.tsx` (74) | `internal:sidebar-context` | 100 | `sidebar_content` | `Context <n> tokens`, `<p>% used`, `$<cost> spent` |
| `sidebar/mcp.tsx` (164) | `internal:sidebar-mcp` | 200 | `sidebar_content` | MCP servers with a status dot; collapsed header appends `(<n> active, <m> errors)` |
| `sidebar/lsp.tsx` (93) | `internal:sidebar-lsp` | 300 | `sidebar_content` | LSP clients `id root`, dot green when `connected`; empty-state text distinguishes `lsp: false` from "activate as files are read" |
| `sidebar/todo.tsx` (75) | `internal:sidebar-todo` | 400 | `sidebar_content` | todo list; hidden entirely when nothing is pending |
| `sidebar/files.tsx` (105) | `internal:sidebar-files` | 500 | `sidebar_content` | modified files with `+n`/`-n` counts from the session diff |
| `sidebar/footer.tsx` (144) | `internal:sidebar-footer` | 100 | `sidebar_footer` | `~/path:branch • OpenCode <version>`, plus a dismissible "Getting started" card |

Shared conventions across the five content panels, all verified in each file:

- Data comes **only** from `props.api.state.*` (`session.messages`, `session.todo`, `session.diff`, `state.lsp()`,
  `state.mcp()`, `state.provider`), never from a direct service call — the sidebar is a pure function of the sync
  store, so it updates from server events without its own polling.
- Every panel with a list uses the same collapse rule: a `▼`/`▶` chevron appears only when `length > 2`, clicking the
  header toggles, and `length <= 2 || open()` decides whether the body renders. Short lists are never collapsible
  because a chevron for two rows is noise.
- Cost and context are computed from the **last assistant message with `tokens.output > 0`**, summing
  `input + output + reasoning + cache.read + cache.write` and dividing by `model.limit.context`; `percent` is `null`
  (rendered as 0) when the model has no declared limit. `spent` sums `cost` over assistant messages using
  `Intl.NumberFormat('en-US', {style:'currency', currency:'USD'})` — USD regardless of provider currency.
- The footer's path is `state.path.directory || process.cwd()` with `Global.Path.home` replaced by `~`, branch
  appended after `:`, then split at the last `/` into a muted parent and a highlighted leaf.
- The "Getting started" card is shown only when no provider has a non-free model **and** the kv flag
  `dismissed_getting_started` is unset; dismissing writes that kv key. This is the one place the TUI advertises
  `/connect`.

## 11. Theme (`context/theme.tsx`, 1,040 lines)

- 33 built-in themes in `DEFAULT_THEMES` (`aura, ayu, catppuccin{,-frappe,-macchiato}, cobalt2, cursor, dracula,
  everforest, flexoki, github, gruvbox, kanagawa, material, matrix, mercury, monokai, nightowl, nord, one-dark,
  osaka-jade, opencode, orng, lucent-orng, palenight, rosepine, solarized, synthwave84, tokyonight, vesper, vercel,
  zenburn, carbonfox`), merged with `pluginThemes` and `customThemes`, plus an optional `system` entry.
- `selectedForeground(theme, bg)`: if the theme defines `selectedListItemText` use it; if `background.a === 0`
  (transparent terminal), compute perceived luminance `0.299r + 0.587g + 0.114b` and pick black/white; else use the
  theme background.
  [verified] This is the only contrast-aware logic in the codebase — it exists because terminals may be
  transparent and a fixed `selectedListItemText` would be unreadable.
- `syntax().getStyleId("extmark.file"|"extmark.agent"|"extmark.paste")` — extmark styling is part of the theme
  contract, so a theme can restyle attachments.


### 11.1 The 33 theme files — schema, token set and palette sizes

Every file in `context/theme/` is a JS object literal (despite the `.json` extension) with the same shape:

```js
var <name>_default = {
  $schema: "https://opencode.ai/theme.json",
  defs: { <palette name>: "<hex>", … },        // indirection: palette entries
  theme: { <token>: "<def name>" | { dark: "<def name>", light: "<def name>" }, … }
};
```

`theme` tokens never contain raw hexes — they reference `defs` entries, and the interesting tokens are objects with
separate `dark` and `light` variants (e.g. `primary: {dark: "darkStep9", light: "lightStep9"}` in `opencode.json`).
`mercury.json` is the exception in style: its palette uses Tailwind-style quoted names (`"purple-800"`, …) instead of
step names. The **token set is otherwise uniform**: 50 tokens present in every theme, and 2 newer ones
(`backgroundMenu`, `selectedListItemText`) that only `opencode.json` has (and `selectedListItemText` alone in
`orng.json`) — which is precisely why `selectedForeground` has the transparent-terminal fallback documented above:
most themes don't define it.

| File | Palette entries (`defs`) | Dark background |
|---|---|---|
| `aura.json` | 12 | #0f0f0f |
| `ayu.json` | 23 | #0B0E14 |
| `carbonfox.json` | 41 | - |
| `catppuccin-frappe.json` | 26 | - |
| `catppuccin-macchiato.json` | 26 | - |
| `catppuccin.json` | 52 | - |
| `cobalt2.json` | 21 | - |
| `cursor.json` | 42 | #181818 |
| `dracula.json` | 12 | - |
| `everforest.json` | 34 | #2d353b |
| `flexoki.json` | 30 | - |
| `github.json` | 26 | #0d1117 |
| `gruvbox.json` | 35 | #282828 |
| `kanagawa.json` | 20 | - |
| `lucent-orng.json` | 22 | - |
| `material.json` | 28 | #263238 |
| `matrix.json` | 20 | - |
| `mercury.json` | 38 | - |
| `monokai.json` | 14 | - |
| `nightowl.json` | 14 | - |
| `nord.json` | 16 | - |
| `one-dark.json` | 24 | #282c34 |
| `opencode.json` | 38 | #0a0a0a |
| `orng.json` | 38 | #0a0a0a |
| `osaka-jade.json` | 33 | #111c18 |
| `palenight.json` | 15 | - |
| `rosepine.json` | 27 | - |
| `solarized.json` | 16 | - |
| `synthwave84.json` | 19 | - |
| `tokyonight.json` | 36 | #1a1b26 |
| `vercel.json` | 38 | - |
| `vesper.json` | 11 | - |
| `zenburn.json` | 16 | - |

That is the level at which these files differ: the token contract is fixed, and each theme is a palette. Restyling or
porting a theme is therefore changing `defs` only.

## 12. TUI plugin runtime (`plugin/runtime.ts`, 851 lines; `plugin/api.tsx`, 433)

### 12.1 Scopes with bounded cleanup

```js
createPluginScope(load, id) → {lifecycle:{signal, onDispose}, track(fn), dispose()}
dispose(): abort signal; run cleanups in REVERSE order; global deadline DISPOSE_TIMEOUT_MS;
           timeout → fail("timed out cleaning up tui plugin", {path, id, timeout})
```

`track(fn)` returns an unsubscribe that runs `fn` once; `onDispose` pushes and returns a remover that deletes the
entry. [verified] Reverse-order cleanup + a per-plugin deadline is the whole isolation story for third-party UI code.

### 12.2 Enable/disable with two persistence layers

```js
pluginEnabledState = { ...config.plugin_enabled (booleans only), ...kv[KV_KEY] }
writePluginEnabledState(api, id, enabled) → kv.set(KV_KEY, {...kv.get(KV_KEY, {}), [id]: enabled})
```

- `listPluginStatus` reports `{id, source, spec, target, enabled, active}`; `active` means a scope exists.
- Activation/disactivation is idempotent and persisted (`persist` flag distinguishes initial load from user action).

### 12.3 Install and patch flow (`installPluginBySpec`)

1. install the package; read `package.json` **manifest targets** — failure codes `manifest_no_targets`
   ("does not expose plugin entrypoints or oc-themes") and unreadable manifest produce user-facing messages.
2. `patchPluginConfig({spec, targets, global, vcs, worktree, directory})` writes the spec into the right config file;
   `invalid_json` is reported with **line and column**.
3. If a `tui` target exists, the spec (plus `opts`) is queued in `state.pending` with `scope: global|local` and
   `source = patched file ?? config ?? tui.json`.

[verified] TUI plugins are declared by their own `package.json` targets, and installing one *edits the user's config*
— that is the "npm module + config entry" model also used by `opencode plugin`.

### 12.4 Loading

`TuiPluginRuntime.init(api)`:
- refuses a second init with a different cwd (`expected=… got=…`);
- builds `slots = setupSlots(api)`, then inside `Instance.provide({directory: cwd})`:
  - `INTERNAL_TUI_PLUGINS` are added first (this is how the built-in **plugin manager**, sidebar sections,
    home footer and tips are themselves plugins — see `feature-plugins/**`);
  - external plugins come from `config.plugin_origins`, skipped entirely under `OPENCODE_PURE`;
  - `resolveExternalPlugins(records, () => TuiConfig.waitForDependencies())` — the same dependency-wait as the
    server plugin loader;
  - initial enabled state is applied, then every enabled plugin is activated.
- `dispose()` awaits the load promise, deactivates in reverse order.

### 12.5 Plugin API surface (`plugin/api.tsx` + `pluginApi`)

`pluginApi(runtime, plugin, scope, base)` returns an object with `command` (`register`, `trigger`, `show`),
`route` (`register`, `navigate`, `current`), `slots`, `ui` (`DialogPrompt`, `toast`, `DialogSelect`, …), `theme`,
`plugins` (`install`, `list`, `activate`, `deactivate`), `kv`, `sdk`, `sync`. Everything registered is wrapped in
`scope.track(...)`, so deactivating a plugin removes its commands, routes and slots.

**Feature plugins shipped in-tree** (all under `tui/feature-plugins/`): `home/{footer,tips,tips-view}`,
`sidebar/{context,files,footer,lsp,mcp,todo}`, `system/plugins` (the plugin manager dialog, with `space`/`shift+i`/`tab`
bindings and an install form that toggles global scope with Tab).

[inferred] Dogfooding the plugin API for built-in chrome is the strongest evidence that the API is expressive enough
for real UI: if it were not, the sidebar would have been written natively.

### 12.6 The plugin-manager system panel (`feature-plugins/system/plugins.tsx`, sources the runtime rows above)

The TUI registers a built-in plugin with id `"internal:plugin-manager"` — permanently non-toggleable
(`disabled: item.id === id10`) — exposing two `System`-category commands: `plugins.list` (keybind
`plugin_manager`) and `plugins.install`. The list is a `DialogSelect` whose rows are the runtime's plugins
sorted **external first, then by id (localeCompare)**; each row shows id, category Internal/External, a
description (`spec` for npm, the file path for `file://` specs, "Built-in"/"Built-in plugin" for internal at
terminal widths below/above 120), and a footer state (`disabled`, `active`, `inactive`). Space toggles a plugin
via `api.plugins.activate/deactivate` (reentrancy-locked while the promise resolves); `shift+i` opens the install
prompt. The dialog size adapts to the terminal: ≥128 cols `xlarge`, ≥96 `large`, else `medium`.

The install dialog is the runtime's UI:

- A `DialogPrompt` whose description shows the scope, toggled between `local` and `global` with the `tab` key
  (default local), busy text `"Installing plugin..."`, empty input rejected with
  `"Plugin package name is required"`.
- `api.plugins.install(spec, {global})` failure: the backend's `message` is toasted, and if the failure is
  `missing` a second info toast says `"Check npm registry/auth settings and try again."`. Success toasts
  `"Installed <spec> (<scope>: <dir>)"`.
- If the installed package has no TUI target, an info toast explains `"Package has no TUI target to load in
  this app."`. If it has one, `api.plugins.add(spec)` loads it immediately; load failure gives a warning toast
  `"Installed plugin, but runtime load failed. See console/logs; restart TUI to retry."`, and success
  `"Loaded <spec> in current session."` — so a **successful install does not require a restart**.

### 12.8 The MCP dialog (`component/dialog-mcp.tsx`, 91 lines)

Rows come from `sync8.data.mcp` (name → status): `title` = description shows the status string (`failed` when
failed), footer = `Status`: `⋯ Loading` while toggling, `✓ Enabled` (`success` bold) when `local2.mcp.isEnabled(name)`,
`○ Disabled` otherwise. Space toggles via `local2.mcp.toggle(name)` (reentrancy-blocked by the `loading` signal),
then refreshes the *whole* status map through `sdk.client.mcp.status()` and writes it back into sync. `onSelect`
is a no-op — selection *is* the toggle.

### 12.9 Prompt stash, history and frecency

Three JSONL/context pairs share one shape — a `createSimpleContext` Provider holding a store, persisted to
`<Global.Path.state>`:

- **History** (`prompt/history.tsx`, 82): `prompt-history.jsonl`, bounded at **50** entries. `append(item)` pushes
  a structured clone, resets navigation to 0, and either appends or rewrites (on trim). `move(direction, input)`
  navigates: out of range, or when the current input is non-empty and differs, it refuses; index 0 returns an
  empty prompt. That is the up-arrow history, with the guard "don't overwrite what the user typed".
- **Stash** (`prompt/stash.tsx`, 87): `prompt-stash.jsonl`, also **50**. `push(entry)` stamps
  `timestamp: Date.now()`; `pop()` returns-and-rewrites; `remove(index)`.
- **Frecency** (`prompt/frecency.tsx`, 79): `frecency.jsonl`, bounded at **1000** paths, deduped by path
  keeping the latest, sorted by `lastOpen` desc. File ranking score is `frequency / (1 + daysSince)`.

All three tolerate corrupt JSONL lines (skip and keep going), rewrite the whole file when trimming, and only ever
`appendFile` on the steady path — the identical persistence idiom in three contexts is why they're grouped here.

### 12.10 Logo, startup loading (`component/logo.tsx` 95, `component/startup-loading.tsx` 77)

`Logo` (the `home_logo` slot's default) renders the ASCII logo in two columns — `logo.left` in `textMuted`,
`logo.right` in `text` bold — with three shadow markers in the art: `_` renders a space on a shadow background
(`tint(theme.background, fg, 0.25)`), `^` renders `▀` (U+2580) with the shadow **as the background**, `~`
renders `▀` with the shadow **as the foreground** — so shadow pixels are painted by both the bg and the fg of
the half-block. `StartupLoading` shows `"Loading plugins..."` until ready, then `"Finishing startup..."`, and
has two anti-flash guards: a **500 ms** delay before first showing, and a **3000 ms** minimum-hold once shown
(computed from the first-show timestamp). Timers are unref'd and cleared on cleanup.

### 12.11 KV state, exit orchestration and small utils

- **KV** (`context/kv.tsx`, 44): a JSON-file local storage at `<state>/kv.json`. `ready` flips in the
  `finally` of the initial load (even on failure), `signal(name, default)` lazily defaults a key,
  `get/set` proxy the Solid store, and **every `set` rewrites the whole file** (`Filesystem.writeJson`). The
  dialog-session-list's session memory is `useKV()`.
- **Exit** (`context/exit.tsx`, 51): the single exit funnel. `exit(reason?)` is idempotent through a single
  `task` promise; it runs `onBeforeExit`, clears the terminal title, `renderer.destroy()`, flushes the Win32
  input buffer, prints the formatted reason (via `FormatError`) to stderr, prints the echoed message to stdout,
  then `onExit`. It also `.on("SIGHUP")`-traps as an exit trigger. `message.set(v)` returns a restore
  function and `message.clear()` wipes, so consumers can checkpoint.
- **DialogTimeline** (`routes/session/dialog-timeline.tsx`, 45): user messages only, titles from the first
  non-synthetic, non-ignored text part with `
`→` `, **newest-first** (built old→new then `reverse()`), footer
  `Locale.time(created)`, selecting opens `DialogMessage` (the actions of 13 §5.10) instead of navigating.
- **Editor** (`cli/cmd/tui/util/editor.ts`, 43): VISUAL→EDITOR (`shell: false`, `VISUAL`/`EDITOR` split on space
  into argv head) → tmpfile `<tmpdir>/<Date.now()>.md` → `renderer.suspend()` → spawn with `/inherit` stdio → on
  exit reads the file, clears/resumes/requests-render, and *deletes the tmpfile* via a deferred `rm`
  (`force: true`; the write-side scope trap is also there).

### 12.12 Textarea keybindings (`component/textarea-keybindings.ts`, 62 lines)

`useTextareaKeybindings()` builds the composer key table: `{name: "return", action: "submit"}` and
`{name: "return", meta: true, action: "newline"}` are defaults, then 35 `TEXTAREA_ACTIONS` (moves, selections,
word ops, deletes, undo/redo) are expanded from the config — each config key is `input_<action>` with hyphens
turned into underscores, and each binding becomes `{name, ctrl|meta|shift|super, action}`. Config-free actions
yield `[]` (so a missing `input_word_forward` binding silently means no word-forward), which is why the two
returns live outside that machinery.

### 12.13 Home tips (`feature-plugins/home/tips.tsx` 55, `tips-view.tsx` 62)

`internal:home-tips` registers the `tips.toggle` command (keybind `tips_toggle`, hidden off the home route) and
the `home_bottom` slot (order 100): the tips only show when `session.count() > 0` and `tips_hidden` is false. `Tips` picks `TIPS[Math.floor(Math.random() * TIPS.length)]` per render
(86 entries), parses `{highlight}…{/highlight}` spans, and renders `● Tip` in `theme.warning` with the highlight
in `text` (rest textMuted). The theme tip computes its count from `Object.keys(DEFAULT_THEMES).length` (33).

### 12.14 The stash dialog (`component/dialog-stash.tsx`, 77 lines)

Same two-step delete as the session list, with rows newest-first (`.toReversed()`), preview = first line
`Locale.truncate(..., 50)`, description = relative time (`just now` <60s, `Xm ago`, `Xh`, `Xd`, else
`Locale.datetime`), and a `~N lines` footer when the input is multi-line. Deleting goes through
`stash.remove(index)` after arming.

### 12.14.1 `TuiEvent` (`cli/cmd/tui/event.ts`, 41 lines) — the TUI-internal bus events

`event.ts` defines four internal bus events: `tui.prompt.append` (`{text}`), `tui.command.execute`
(`{command}` — a 17-literal enum of session/prompt/agent commands plus a free string), `tui.toast.show`
(`{title?, message, variant: info|success|warning|error, duration?}` with duration defaulting to 5,000 ms when
omitted), and `tui.session.select` (`{sessionID}` — navigates). These cross the internal server boundary
forever: a headless server hits them through the SSE stream like any other bus event.

### 12.14.2 Root-session list (`component/dialog-session-list.tsx`, 95 lines) and the fork dialog

The **non-workspace** list (`DialogSessionList`, 95): search-backed (`sdk.client.session.list({search,
limit: 30})`, 150-ms debounce, `skipFilter: true`), **root sessions only** (`parentID === undefined`), sorted
by updated descending into *Today / date* categories, footer = `Locale.time(updated)`, a live working spinner
in the gutter for sessions whose `session_status` is `busy`, the same two-step `delete`, `session_rename` via
`DialogSessionRename`, and the current session preselected.

`DialogForkFromTimeline` (`routes/session/dialog-fork-from-timeline.tsx`, 59) is the timeline dialog's twin (rows = user messages' first non-synthetic/
non-ignored text part, newline-flattened, time footer), but selecting calls
`sdk.client.session.fork({sessionID, messageID})`, rebuilds the message's text/file parts into an
`initialPrompt`, navigates to the fork, and clears the dialog.

### 12.14.3 Agent, variant and skill pickers

- **DialogAgent** (`component/dialog-agent.tsx`, 24): rows from `local.agent.list()`; native agents render
  description `"native"`, custom ones their description; selecting calls `local.agent.set(value)`.
- **DialogVariant** (`component/dialog-variant.tsx`, 31): `Default` + `local.model.variant.list()` (flat);
  selecting sets the variant (`Default` sets it `undefined`), computed `current` from
  `local.model.variant.selected()`.
- **DialogSkill** (`component/dialog-skill.tsx`, 30): the Skills dialog ("Search skills...", large) —
  names padded to the longest name, descriptions whitespace-collapsed, category `"Skills"`, selecting calls
  `props2.onSelect(name)` and clears.

### 12.14.4 Session rename, borders, scrolling, selection, and model utils

- **DialogSessionRename** (`component/dialog-session-rename.tsx`, 20): a `DialogPrompt` pre-filled with
  `sync.session.get(id).title`; confirm calls `sdk.client.session.update({sessionID, title})` and closes;
  cancel just closes.
- **Borders** (`component/border.tsx`, 20): `EmptyBorder` renders no border characters at all (every field
  `""` except `horizontal: " "`) and `SplitBorder` = `["left", "right"]` with only `vertical: "│"` —
  the row/column separators used in the session chrome.
- **Scroll** (`cli/cmd/tui/util/scroll.ts`, 19): `getScrollAcceleration(tuiConfig)` — when
  `scroll_acceleration.enabled`, returns `MacOSScrollAccel` (external); when `scroll_speed` is set, a
  `CustomSpeedScroll(n)` that ticks `n` each frame; **default speed 3**. Selection copy
  (`util/selection.ts`, 12): `Selection.copy` grabs the renderer's selected text, copies via Clipboard, toasts
  `"Copied to clipboard"` (info) or the error, and clears the selection; returns whether anything was copied.
- **Model utils** (`cli/cmd/tui/util/model.ts`, 10): `getModel(list, providerID, modelID)` over a Map or an
  array lookup; `getModelName` falls back to the raw id. **Provider origin** (`util/provider-origin.ts`, 5):
  console-managed providers get a ` ⌂` (U+2302) suffix — `consoleManagedProviderLabel` handles Set or Array
  membership.
- **Prompt part** (`component/prompt/part.ts`, 11): `strip(part)` drops `id`/`messageID`/`sessionID`;
  `assign(part)` mints a fresh `PartID.ascending()` — the copy primitives the fork/undo flows reuse.

### 12.14.5 `INTERNAL_TUI_PLUGINS`, TuiConfig context, `createDebouncedSignal`

`cli/cmd/tui/plugin/internal.ts` (11) lists the nine built-in TUI plugins in load order — footer, tips, context,
mcp, lsp, todo, files, the second footer, plugins. `context/tui-config.tsx` (9) is the pass-through context
holding `props.config`. `cli/cmd/tui/util/signal.ts` (4) is `createDebouncedSignal(value, ms)` — the
150-ms search debounce the session list uses (§12.14.2). `cli/cmd/debug/index__dup2.ts` (23) is the `debug`
parent (the yargs parent for the tree in 14 §13, including a `wait` that sleeps 24 h for attaching a debugger).

### 12.15 Theme picker, todo item, missing-route view and slot registry

- **DialogThemeList** (`component/dialog-theme-list.tsx`, 42): the theme list sorted case-insensitively (`localeCompare` with
  `sensitivity: "base"`), and it **previews live** — moving and filtering applies the theme immediately
  (`onFilter` with an empty query restores the originally-selected theme), and cancelling reverts to the
  initial theme via `onCleanup` unless the selection was confirmed with Enter.
- **TodoItem** (`component/todo-item.tsx`, 36): checkbox state (`✓` completed, `•` in_progress, blank pending), `in_progress` items
  render in `theme.warning`, everything else in `theme.textMuted`, text wraps as word.
- **PluginRouteMissing** (`component/plugin-route-missing.tsx`, 36): the 404 page for unknown plugin routes — `"Unknown plugin route: <id>"` in
  `theme.warning` with a `go home` button (bg `backgroundElement`, fg `text`) wired to `props2.onHome`.
- **Slots** (`plugin/slots.tsx`, 38): `setupSlots(api)` builds the Solid slot registry; `isHostSlotPlugin`
  requires a record with a string `id` and a record `slots`; an invalid plugin yields an empty disposer and
  the slot views stay empty. Plugin errors are `console.error`'d with `[tui.slot]` + phase/source.

## 13. Windows (`win32.ts`, 101 lines)

`load()` lazily imports a native binding; `win32DisableProcessedInput()` / `win32FlushInputBuffer()` disable console
input processing; `win32InstallCtrlCGuard()` installs a handler so Ctrl-C is delivered as a key, not a signal.
Called from `thread.ts` and `tui()`. [verified] No-op on non-Windows (`if (false)`-stripped branches at build time).

## 14. What the TUI does *not* do

- No agent logic, no tool execution, no model calls — all via SDK (verified by the absence of core imports besides
  `Instance`, `Provider.parseModel`, `SessionID`/`MessageID`/`PartID`, `TuiConfig`, `Global`, `Filesystem`).
- No optimistic message insertion except the `pending` marker: the transcript is whatever `sync` says.
- No retry logic for HTTP: failures become toasts.

[inferred] The TUI is therefore the thinnest possible layer that still feels instant — it is a **projection of the
event stream plus a composer**. Everything else it appears to "do" (undo, compact, share, fork) is a one-line SDK
call with a confirmation dialog in front of it.
