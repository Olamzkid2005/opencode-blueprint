# 07 — Server, transport and the TUI's data layer

<!-- toc -->
## Contents

- [1. Three transports, one service layer](#1-three-transports-one-service-layer)
- [2. Worker RPC surface (`worker.js`) — [verified]](#2-worker-rpc-surface-workerjs--verified)
- [3. HTTP server (`src/server/server.ts`)](#3-http-server-srcserverserverts)
  - [3.1 Routes](#31-routes)
  - [3.2 Concurrency and lifecycle endpoints](#32-concurrency-and-lifecycle-endpoints)
  - [3.3 Session and experimental route files, route by route](#33-session-and-experimental-route-files-route-by-route)
  - [3.4 The instance routes: mounting order and the web-UI catch-all](#34-the-instance-routes-mounting-order-and-the-web-ui-catch-all)
  - [3.5 MCP and file routes](#35-mcp-and-file-routes)
  - [3.6 Provider routes (`server/routes/provider.ts`, 128)](#36-provider-routes-serverroutesproviderts-128)
  - [3.7 Project and config route families (`server/routes/project.ts` 98, `server/routes/config.ts` 81)](#37-project-and-config-route-families-serverroutesprojectts-98-serverroutesconfigts-81)
  - [3.8 The workspace router (`server/router.ts`, 78 lines)](#38-the-workspace-router-serverrouterts-78-lines)
  - [3.9 Question, permission and workspace route families (`question.ts` 76, `permission.ts` 55, `workspace.ts` 72)](#39-question-permission-and-workspace-route-families-questionts-76-permissionts-55-workspacets-72)
  - [3.10 mDNS publication (`server/mdns.ts`, 59 lines)](#310-mdns-publication-servermdnsts-59-lines)
- [4. The TUI's data layer](#4-the-tuis-data-layer)
  - [4.1 `SDKProvider` — one client, two shapes](#41-sdkprovider--one-client-two-shapes)
  - [4.2 `SyncProvider` — a normalised client store (`context/sync.tsx`)](#42-syncprovider--a-normalised-client-store-contextsynctsx)
  - [4.3 Rendered surfaces bound to this store](#43-rendered-surfaces-bound-to-this-store)
- [5. Failure modes at the transport layer](#5-failure-modes-at-the-transport-layer)

<!-- /toc -->

Modules: `src/server/{server,router,middleware,event,error,mdns,instance,projectors}.ts`,
`src/server/routes/*.ts`, `src/util/rpc.ts`, `src/cli/cmd/tui/{thread,worker}.ts`,
`src/cli/cmd/tui/context/{sdk,sync,route,args,local}.tsx`

---

## 1. Three transports, one service layer

| Transport | Used by | Endpoint | Notes |
|---|---|---|---|
| **RPC over Worker** | default `opencode` (TUI) | `Rpc.client(worker)` / `Rpc.listen(rpc)` | no TCP port; `fetch` and events tunnelled as RPC calls |
| **HTTP + SSE** | `opencode serve`, remote TUI, web UI, SDK users | `Bun.serve` on `--hostname:--port` | OpenAPI 3.1.1 generated from routes; `idleTimeout: 0` |
| **stdio JSON-RPC** | ACP clients (editors) | `src/acp/agent.ts` | exposes sessions/prompts as agent-client protocol |

The TUI decides between RPC and HTTP at startup (`thread.ts`): any of `--port`, `--hostname`, `--mdns`, a
non-zero port, or a non-loopback hostname switches to HTTP.

## 2. Worker RPC surface (`worker.js`) — [verified]

```js
export const rpc = {
  async fetch({url, method, headers, body}) {
    const h = {...headers};
    const auth = getAuthorizationHeader();                    // Basic auth from OPENCODE_SERVER_PASSWORD
    if (auth && !h["authorization"] && !h["Authorization"]) h["Authorization"] = auth;
    const res = await Server.Default().fetch(new Request(url, {method, headers: h, body}));
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: await res.text() };
  },
  snapshot(),                                   // writeHeapSnapshot
  async server({port, hostname, mdns, cors}),   // lazily Server.listen; stops an existing one first
  async checkUpgrade({directory}),
  async reload()  { await Config.invalidate(true); },          // SIGUSR2 → config hot reload
  async setWorkspace({workspaceID}) { startEventStream({directory, workspaceID}); },
  async shutdown() { /* abort events, Instance.disposeAll, stop server */ }
};
Rpc.listen(rpc);
```

Design consequences:

- **The worker owns the server.** The UI thread never constructs one. `shutdown` disposes *all* instances
  (`Instance.disposeAll()`), which runs every service finalizer — the orderly teardown path.
- **Events flow twice.** `GlobalBus.on("event") → Rpc.emit("global.event")` carries cross-instance events, while
  `startEventStream` subscribes to the instance bus (`Bus.subscribeAll`) and emits `"event"` per instance, with a
  250 ms reconnect loop and `server.connected` synthesised at stream start.
- **`reload` is config-only**: `Config.invalidate(true)` clears the config cache; the next access re-reads files.
  Tool/agent/plugin changes therefore apply without restarting the process (but loaded plugins are not unloaded).

## 3. HTTP server (`src/server/server.ts`)

```js
function listen(opts) {
  Server.url = new URL(`http://${opts.hostname}:${opts.port}`);
  const app = Server.ControlPlaneRoutes({cors: opts.cors});
  const args = { hostname: opts.hostname, idleTimeout: 0, fetch: app.fetch, websocket };
  const tryServe = port => { try { return Bun.serve({...args, port}); } catch { return; } };
  const server = opts.port === 0 ? (tryServe(4096) ?? tryServe(0)) : tryServe(opts.port);
  if (!server) throw new Error(`Failed to start server on port ${opts.port}`);
  const shouldPublishMDNS = opts.mdns && server.port &&
      !["127.0.0.1","localhost","::1"].includes(opts.hostname);
  if (shouldPublishMDNS) MDNS.publish(server.port, opts.mdnsDomain);
  else if (opts.mdns) log.warn("mDNS enabled but hostname is loopback; skipping mDNS publish");
  const originalStop = server.stop.bind(server);
  server.stop = async close => { if (shouldPublishMDNS) MDNS.unpublish(); return originalStop(close); };
  return server;
}
```

Verified decisions:

- **Preferred port 4096** when `--port 0` is requested, falling back to an ephemeral port. Stable-by-default makes
  bookmarks/extensions survive restarts; the fallback keeps it working when 4096 is taken.
- **`idleTimeout: 0`** — Bun would otherwise cut silent connections; a turn waiting on a 10-minute tool call is
  silent by design.
- **mDNS is only advertised for non-loopback binds**, and the stop path is wrapped so unpublish cannot be
  forgotten. Warn-and-skip (rather than error) when someone asks for mDNS on loopback is the pragmatic choice.
- **CORS is opt-in** (`opts.cors`), not `*` by default.

### 3.1 Routes

`src/server/routes/` contains `config, event, experimental, file, global, mcp, permission, project, provider,
pty, question, session, tui, workspace`. Each exports a function that registers paths on the router and declares
zod schemas; `Server.openapi()` runs `generateSpecs(app, {openapi:"3.1.1", info:{title:"opencode"}})` over the
same registrations.

[inferred] Declaring the API once and generating both the handler binding and the OpenAPI document is what keeps
the SDK (`sdks/`, generated) and the server from drifting.

`middleware.ts` provides the shared concerns: instance binding per request, error mapping (`server/error.ts`),
and CORS. `event.ts` implements the SSE endpoint that serialises bus events; `projectors.ts` projects events into
database rows for the server-side case.

### 3.2 Concurrency and lifecycle endpoints

- `Session.BusyError` surfaces through the error middleware as a 4xx — the correct answer to "start a turn while
  one is running" is a refusal, not a queue.
- `runtime/routes/pty.ts` exposes a PTY WebSocket, backed by `librust_pty` (the embedded dylib) — the same
  mechanism the TUI's terminal panes use.
- `experimental` routes are the unstable surface (`workspace`, TUI/plugin APIs); they are namespaced deliberately
  so breaking them is not a semver event for the stable API.

### 3.3 Session and experimental route files, route by route

`server/routes/session.ts` (737 lines) is a single Hono chain generated declaratively: every route pairs
`describeRoute` (OpenAPI metadata) with `validator2` zod validation, and every handler is a thin delegation to the
corresponding `Session*` service, so the API surface is exactly the service layer plus validation. The inventory
(operation ids are the stable identifiers the SDK is generated from):

| Method + path | operationId | Delegates to |
|---|---|---|
| `GET /` `GET /status` `GET /:sessionID` `GET /:sessionID/children` `GET /:sessionID/todo` | `session.list/status/get/children/todo` | `Session.list/get/children`, `SessionStatus.list()`, `Todo.get()` |
| `POST /` `DELETE /:sessionID` `PATCH /:sessionID` | `session.create/delete/update` | `Session.create/remove`; update patches only `title` and `time.archived` |
| `POST /:sessionID/init` `POST /:sessionID/fork` `POST /:sessionID/abort` | `session.init/fork/abort` | `Session.initialize/fork`, `SessionPrompt.cancel()` |
| `POST /:sessionID/share` `DELETE /:sessionID/share` | `session.share/unshare` | `Session.share/unshare` |
| `GET /:sessionID/diff` (query `messageID`) | `session.diff` | `SessionSummary.diff()` |
| `POST /:sessionID/summarize` (provider/model + optional `auto`) | `session.summarize` | runs `SessionRevert.cleanup`, derives the agent from the newest user message, then `SessionCompaction.create` + `SessionPrompt.loop` synchronously |
| `GET /:sessionID/message`, `GET /:sessionID/message/:messageID` | `session.messages/message` | `MessageV2.page()` / `Session.messages()` |
| `DELETE /:sessionID/message/:messageID` | `session.deleteMessage` | `SessionPrompt.assertNotBusy` first, then `Session.removeMessage` (no file revert) |
| `DELETE /:sessionID/message/:messageID/part/:partID`, `PATCH …` | `part.delete/update` | `Session.removePart/updatePart`; the PATCH body must echo the three ids exactly or it throws `Part mismatch: …` |
| `POST /:sessionID/message` | `session.prompt` | streams one JSON body via `SessionPrompt.prompt()` |
| `POST /:sessionID/prompt_async` | `session.prompt_async` | fire-and-forget `SessionPrompt.prompt()`; failures are published as `Session.Event.Error` on the bus, and the response is 204 |
| `POST /:sessionID/command`, `POST /:sessionID/shell` | `session.command/shell` | `SessionPrompt.command/shell` |
| `POST /:sessionID/revert`, `POST /:sessionID/unrevert` | `session.revert/unrevert` | `SessionRevert.revert/unrevert` |
| `POST /:sessionID/permissions/:permissionID` `{response}` | `permission.respond` (deprecated) | `Permission.reply()` |

The non-obvious behaviours, all [verified] from the handler bodies:

- `GET /:sessionID/message` without `limit` returns the whole log; with `limit`, it paginates through
  `MessageV2.page({limit, before})` and sets `Link: <url>; rel="next"` plus `X-Next-Cursor` headers. The cursor is
  validated by decoding it, and `before` without `limit` fails: "before requires limit".
- `POST /summarize` is synchronous and self-contained: the agent used for compaction is found by scanning backwards
  for the latest user message (falling back to `Agent.defaultAgent()`), so the caller only supplies provider + model.
- `prompt_async` 204s immediately and reports errors out-of-band via `Session.Event.Error` — the exact escape
  hatch that makes `POST /message`'s streaming body optional.
- The deprecated `permission.respond` still exists, so the request/reply channel reachable without the client
  WebSocket is real (see `06` §4.3).

`server/routes/experimental.ts` (281 lines, operation ids prefixed `experimental.`/`tool.`) is the unstable surface:

| Route | Behaviour |
|---|---|
| `GET /console`, `GET /console/orgs`, `POST /console/switch` | The active Console org and provider set; orgs across logged-in accounts; persisting a new active org |
| `GET /tool/ids`, `GET /tool`, `GET /resource` | All tool ids; per-(provider, model) tool list with parameters converted by `zodToJsonSchema3` when they are zod schemas; every MCP resource from connected servers |
| `GET /session` | Cross-project session list via `Session.listGlobal` (archived excluded by default), with `limit ?? 100` and the `x-next-cursor` = last item's `time.updated` trick |
| `POST /worktree`, `GET /worktree`, `DELETE /worktree`, `POST /worktree/reset` | Create/list/delete/reset git worktrees (create runs configured startup scripts; reset targets the primary default branch) |
| (nested) `route("/workspace", WorkspaceRoutes())` | workspace routes are mounted here, so worktree and workspace state live under the same router |

[verified] The `x-next-cursor` scheme above reuses an *updated-timestamp cursor*, not a message id — the same
convention as `/session` in this file and a different one from `MessageV2.page`'s opaque cursor. Two paging
conventions coexist in the API.

### 3.4 The instance routes: mounting order and the web-UI catch-all

`server/instance.ts` (234 lines) is `InstanceRoutes(app)` — the composition root that mounts every route domain
and adds the ambient endpoints. The mount order is fixed and meaningful:

```
/project  /pty  /config  /experimental  /session  /permission  /question  /provider
/  (FileRoutes)  /  (EventRoutes)  /mcp  /tui
```

then the instance's own endpoints and finally the catch-all:

| Endpoint | Behaviour |
|---|---|
| `POST /instance/dispose` | `Instance.dispose()` (releases the instance's resources) |
| `GET /path` | `{home, state, config}` from `Global.Path` + `{worktree, directory}` from `Instance` — the exact paths the TUI needs to bootstrap state |
| `GET /vcs`, `GET /vcs/diff` (`mode` query) | `{branch, default_branch}` and the diff against the default branch |
| `GET /command`, `GET /agent`, `GET /skill`, `GET /lsp`, `GET /formatter` | plain listings: `Command.list()`, `Agent.list()`, `Skill.all()`, `LSP.status()`, `Format.status()` |
| `.all("/*")` | the web-UI catch-all (below) |

The catch-all is the interesting part — it has two modes, selected by a lazy promise:

- **Embedded UI.** `embeddedUIPromise` resolves a build-time generated asset map (`opencode_web_ui_gen`) of
  pathname → file content, loaded from `Bun.file`. The `OPENCODE_DISABLE_EMBEDDED_WEB_UI` flag forces the map
  to `null`. A matching file is served with its content type, and HTML responses get a static
  `Content-Security-Policy` (`DEFAULT_CSP`): `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'`.
- **Hosted proxy + dynamic CSP.** If the module is absent, requests are proxied to
  `https://app.opencode.ai/<path>` with the `host` header rewritten. For HTML responses the inline
  `<script id="oc-theme-preload-script">` block is extracted from the *actual fetched body*, hashed
  (`sha256`, base64), and the CSP gains `script-src … 'sha256-<hash>'` — the hash is computed from the served
  content rather than hard-coded, so the preload script can change without the CSP changing.

[verified] The catch-all is mounted last: `FileRoutes()` and `EventRoutes()` are mounted at `/` *before* it, so
their exact paths must win over `/*` at registration time — no domain route after the catch-all can exist.

### 3.5 MCP and file routes

`server/routes/mcp.ts` (173) exposes the MCP lifecycle and its OAuth:

| Route | Behaviour |
|---|---|
| `GET /` `POST /` | `MCP.status()` (a record of `MCP.Status`); dynamic add via `MCP.add(name, config)` |
| `POST /:name/auth` | returns `{authorizationUrl}` from `MCP.startAuth`, but first `MCP.supportsOAuth` — a non-OAuth server is a 400 with `MCP server <name> does not support OAuth` |
| `POST /:name/auth/callback` | `{code}` → `MCP.finishAuth(name, code)` → status |
| `POST /:name/auth/authenticate` | the blocking variant: start and wait for the callback in one request |
| `DELETE /:name/auth` | `MCP.removeAuth(name)` → `{success: true}` |
| `POST /:name/connect`, `POST /:name/disconnect` | `MCP.connect/disconnect` |

The `/file` family (`server/routes/file.ts`, 143, mounted at `/`) mirrors the `File` service exactly and adds
**a stub that is still shipped**: `GET /find/symbol` validates a `query` parameter and always returns `[]` —
symbol search is announced by the schema (`LSP.Symbol`) but is not implemented at the route layer.

| Route | Behaviour |
|---|---|
| `GET /find` (`pattern`) | `Ripgrep.search({cwd: Instance.directory, pattern, limit: 10})` — **hard-coded limit of 10** regardless of the query |
| `GET /find/file` | `{query, dirs?: "true"\|"false", type?, limit?: 1–200}` → `File.search` with `dirs !== "false"` and a default limit of 10 |
| `GET /file` (`path`), `GET /file/content` (`path`), `GET /file/status` | `File.list`, `File.read`, `File.status` pass-through |

[verified] The `dirs` parameter is a **string enum `"true"|"false"`**, not a boolean, and it maps to
`dirs !== "false"` — so the presence of any other value means "true".

### 3.6 Provider routes (`server/routes/provider.ts`, 128)

`GET /` is the interesting one: it returns `{all, default, connected}` where `all` is `ModelsDev.get()`
filtered by `disabled_providers`/`enabled_providers` from config, transformed through
`Provider.fromModelsDevProvider`, and — critically — `Object.assign(filtered, connected)` so the *connected*
provider set (what the user actually has credentials for) wins over the catalogue. `default` is a per-provider
record of `Provider.sort(models)[0].id` (the most preferred model of each provider). `GET /auth` is
`ProviderAuth.methods()`. POST `/:providerID/oauth/authorize` (body: `{method (index), inputs?}`, returns a
`ProviderAuth.Authorization` with the URL) and `POST /:providerID/oauth/callback` (body `{method, code?}`, returns
`true`) — the model-requested OAuth flows of §5 (auth) exposed over HTTP.

### 3.7 Project and config route families (`server/routes/project.ts` 98, `server/routes/config.ts` 81)

`GET /project` → `Project.list()`; `GET /project/current` → `Instance.project` (the ambient project, no lookup).
`POST /project/git/init` runs `Project.initGit({directory, project})` and, **if the id/vcs/worktree changed**,
calls `Instance.reload({directory, worktree: directory, project: next, init: InstanceBootstrap})` — the route
re-bootstraps the live instance. `PATCH /project/:projectID` is `Project.update` with `Project.UpdateInput`.

`GET /config` returns the merged config. `PATCH /config` validates the body **as a full `Config.Info`** (no
partial patching at the route layer) and returns the passed config after `Config.update`. `GET /config/providers`
returns `{providers, default}` — the same `Provider.sort` model pick as the provider routes.

### 3.8 The workspace router (`server/router.ts`, 78 lines)

`WorkspaceRouterMiddleware` is how `?workspace=` and `x-opencode-directory` routing works:

- Directory comes from the `directory` query, then the `x-opencode-directory` header, then `process.cwd()`,
  URI-decoded and `Filesystem.resolve`d — traversal never escapes resolution.
- No `workspace` param, or a `worktree`-type workspace: run `Instance.provide({directory, init:
  InstanceBootstrap, fn: routes().fetch})` — the request is handled locally against that instance.
- Otherwise `local(method, path)` consults a two-rule table: `GET /session` is **local** (the existence/list
  endpoints never leave the machine) while `/session/status` always **forwards** to the workspace adaptor
  (status is liveness of the workspace, not of the local process). The forward preserves method/headers/body
  (arrayBuffer for non-GET/HEAD) and the original AbortSignal, and strips the `x-opencode-workspace` header so
  the downstream server doesn't re-route.

### 3.9 Question, permission and workspace route families (`question.ts` 76, `permission.ts` 55, `workspace.ts` 72)

The question router: `GET /` → all pending `Question.Request`s across sessions; `POST /:requestID/reply` with a
validated `Question.Reply` (the `answers` array); `POST /:requestID/reject`. The permission router adds the
general-purpose `POST /permission/:requestID/reply` (`{reply: Permission.Reply, message?}` — note the
session-scoped deprecated duplicate at `/session/:sessionID/permissions/:permissionID` does *not* carry a message)
and `GET /permission` (pending requests). The workspace family is `experimental.workspace.*`:
`POST /` (the create body omits `projectID` — the current instance's project id is injected server-side),
`GET /` (for the current project), `DELETE /:id`.

### 3.10 mDNS publication (`server/mdns.ts`, 59 lines)

`MDNS.publish(port, domain?)` advertises the HTTP server via Bonjour (mDNS): service `opencode-<port>` of
type `http` on host `opencode.local` (or the given domain) with TXT `path: "/"`. It is idempotent per port
(publishing the same port is a no-op; a different port unpublishes first), and each service gets `up`
(info `mDNS service published`) and `error` handlers. Failures log `mDNS publish failed` and reset the
singleton (no retry in this layer — startup then leaves the service unpublished). `unpublish()` calls
`unpublishAll` + `destroy` and logs `"mDNS service unpublished"`.

## 4. The TUI's data layer

### 4.1 `SDKProvider` — one client, two shapes

```js
// thread.ts, internal transport
url: "http://opencode.internal",
fetch: createWorkerFetch(client),      // Request → Rpc.call("fetch") → Response
events: createEventSource(client)      // { on: handler => client.on("event", handler), setWorkspace }
```

So the SDK believes it is talking to an HTTP origin; the transport is a function. [inferred] This is what lets the
TUI, the web UI and a remote client share one SDK without conditionals in feature code.

### 4.2 `SyncProvider` — a normalised client store (`context/sync.tsx`)

A Solid `createStore` with a fixed top-level shape:

```js
provider_next, console_state, provider_auth, config, status, agent, permission, question,
command, provider, provider_default, session, session_status, session_diff, todo,
message, part, lsp, mcp, mcp_resource, formatter, vcs, path{state,config,worktree,directory}, workspaceList
```

Keyed sub-maps hold entities (`message[sessionID]`, `part[messageID]`, `permission[sessionID]`, …). Every bus
event is reduced with `reconcile(...)` (structural, key-based merge) or `produce(draft => …)` (mutation), and
**inserts are located with `Binary.search`** rather than `findIndex`:

```js
case "permission.asked": {
  const requests = store.permission[sessionID];
  if (!requests) { setStore("permission", sessionID, [request]); break; }
  const match = Binary.search(requests, request.id, r => r.id);
  if (match.found) { setStore("permission", sessionID, match.index, reconcile(request)); break; }
  setStore("permission", sessionID, produce(draft => { draft.splice(match.index, 0, request); }));
}
```

Verified implications:

- **Ordered-by-ID collections.** `Binary.search` on `id` is only correct because IDs are ordered
  (`MessageID.ascending`, `PermissionID` monotonic), which is why ids are generated rather than random UUIDv4.
- **Idempotent event application.** `reconcile` on an existing entity and insert-at-position on a new one make
  replayed or duplicated events harmless — necessary because the stream can reconnect (`server.connected`).
- **No per-feature fetching for state the bus carries.** Components read `useSync()`; only mutations go through
  the SDK. That is the "single store, many views" pattern.

### 4.3 Rendered surfaces bound to this store

- `routes/session/index.tsx` (3,021 lines) — the conversation view: messages/parts rendering, streaming text,
  tool cards, diffs.
- `component/prompt/index.tsx` (1,283 lines) — the composer: autocomplete, history, frecency, stash, file
  attachments, slash commands.
- `routes/session/permission.tsx` (950) / `question.tsx` (610) — the blocking dialogs that answer
  `permission.asked` / `question.asked`.
- `plugin/runtime.ts` (851) — the TUI plugin host (routes, slots, commands contributed at runtime).

[verified] The TUI is a *view* over the event stream plus a command surface; it does not implement agent logic.
Any behaviour it appears to own (cancellation, model switch, session fork) is an SDK call.

## 5. Failure modes at the transport layer

| Failure | Handling (verified) |
|---|---|
| Worker throws on load | `worker.onerror` → `Log.Default.error` |
| RPC `fetch` fails | promise rejects; SDK surfaces an API error; retry policy applies only to model calls |
| Event stream breaks | `startEventStream` reconnects every 250 ms until aborted; `server.connected` re-syncs clients |
| Server port busy | try 4096 → random → throw `Failed to start server on port <n>` |
| Client disconnects mid-turn | turn continues in the worker (it is not tied to the request); state is in SQLite and the event stream |
| `SIGUSR2` | config reload without process restart |
| Shutdown | `shutdown` RPC → abort streams → `Instance.disposeAll()` → stop server → `worker.terminate()` |

[inferred] The "turn survives client disconnect" property is a direct consequence of the worker owning execution:
the HTTP request that started a prompt returns an id, and progress arrives on the event stream. It also means an
abandoned turn keeps consuming tokens unless cancelled — there is no client-disconnect watchdog in the code.
