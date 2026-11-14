# 05 — Providers, models and the LLM layer

<!-- toc -->
## Contents

- [1. The problem this layer solves](#1-the-problem-this-layer-solves)
- [2. Provider registry construction (`provider.ts:839+`) — [verified]](#2-provider-registry-construction-providerts839--verified)
  - [2.1 Bundled SDK map](#21-bundled-sdk-map)
  - [2.2 `sdkKey` — normalisation to a canonical family (`transform.ts`)](#22-sdkkey--normalisation-to-a-canonical-family-transformts)
  - [2.2.1 Branded provider ids (`provider/schema.ts`, 26 lines)](#221-branded-provider-ids-providerschemats-26-lines)
  - [2.3 `provider/models.ts` (140 lines) — models.dev fetch, cache and the fallback ladder](#23-providermodelsts-140-lines--modelsdev-fetch-cache-and-the-fallback-ladder)
- [3. Model + language-model resolution](#3-model--language-model-resolution)
  - [3.1 `getModel(providerID, modelID)` (provider.ts:1240)](#31-getmodelproviderid-modelid-providerts1240)
  - [3.2 `getLanguage(model)` (provider.ts:1258)](#32-getlanguagemodel-providerts1258)
  - [3.3 `getSmallModel(providerID)` — cheap-model policy](#33-getsmallmodelproviderid--cheap-model-policy)
  - [3.4 `defaultModel()` and `Provider.sort`](#34-defaultmodel-and-providersort)
- [4. Request transformation (`transform.ts`)](#4-request-transformation-transformts)
- [5. Streaming surface (`src/session/llm.ts`)](#5-streaming-surface-srcsessionllmts)
- [6. Cost and token accounting (`Session.getUsage`)](#6-cost-and-token-accounting-sessiongetusage)
  - [6.1 The error taxonomy (`provider/error.ts`, 149 lines)](#61-the-error-taxonomy-providererrorts-149-lines)
- [7. Auth (`src/provider/auth.ts`, `src/mcp/*oauth*`)](#7-auth-srcproviderauthts-srcmcpoauth)
- [8. `models-snapshot.js` — the 1.76 MB constant](#8-models-snapshotjs--the-176-mb-constant)
- [9. The vendored OpenAI-compatible SDK (`src/provider/sdk/copilot/**`, 20 files, 2,879 lines) — [verified]](#9-the-vendored-openai-compatible-sdk-srcprovidersdkcopilot-20-files-2879-lines--verified)
  - [9.1 Factory (`copilot-provider.ts`, 42 lines)](#91-factory-copilot-providerts-42-lines)
  - [9.2 Chat model (`chat/openai-compatible-chat-language-model.ts`, 574 lines)](#92-chat-model-chatopenai-compatible-chat-language-modelts-574-lines)
  - [9.3 Responses model (`responses/*` — five files, 1,822 lines, plus `responses/tool/*` at 190)](#93-responses-model-responses--five-files-1822-lines-plus-responsestool-at-190)
  - [9.4 File inventory (all 20 modules)](#94-file-inventory-all-20-modules)
  - [9.5 Debt in this subtree](#95-debt-in-this-subtree)

<!-- /toc -->

Modules: `src/provider/{provider,transform,models,models-snapshot.js,auth,sdk/…}.ts`, `src/session/llm.ts`, `src/plugin/{codex,github-copilot/*}.ts`

---

## 1. The problem this layer solves

The agent must talk to Anthropic, OpenAI, Google, Bedrock, Vertex, Azure, OpenRouter, xAI, GitHub Copilot, local
OpenAI-compatible servers, and user-declared providers — with different auth, different wire formats, different
capability sets (tools, reasoning, images, PDF), and different pricing. This layer is the adapter ring that
normalises all of that into one `LanguageModelV2`-style streaming interface (AI SDK v5).

## 2. Provider registry construction (`provider.ts:839+`) — [verified]

`Provider.layer` builds a **per-instance** state object via `InstanceState.make` containing:

```js
{ providers: {}, languages: Map, modelLoaders: {}, varsLoaders: {},
  sdk: Map, discoveryLoaders: {}, … }
```

Construction order (each step explains a design decision):

1. **`ModelsDev.get()`** — a bundled catalogue (`src/provider/models-snapshot.js`, 1.76 MB, 9 "lines": one giant
   JSON literal) provides the baseline of known providers/models. This is why the binary can name 100s of models
   with no network call and works offline on first run.
2. **`database = i4(modelsDev, fromModelsDevProvider)`** — converts the catalogue into the internal provider shape.
3. **Config providers merged over the catalogue** with a recursive merge `D2(existing, provider)`:
   `name`, `env`, `options`, `models`. Config always wins, catalogue fills gaps.
4. **Per-model resolution** with an explicit precedence chain — visibly *catalogue → existing → user config →
   hardcoded default*:

```js
api: {
  id:  model.id ?? existingModel?.api.id ?? modelID,
  npm: model.provider?.npm ?? provider.npm ?? existingModel?.api.npm
        ?? modelsDev[providerID]?.npm ?? "@ai-sdk/openai-compatible",
  url: model.provider?.api ?? provider?.api ?? existingModel?.api.url ?? modelsDev[providerID]?.api
}
```

`npm` is the key field: it names the SDK package that will be loaded. Defaulting to
`@ai-sdk/openai-compatible` is the "any OpenAI-shaped server works" escape hatch.

5. **Capabilities** are resolved field-by-field with `?? false/true` defaults, including per-modality
   input/output (`text, audio, image, video, pdf`) derived from `model.modalities`.
6. **Costs** carry `input`, `output`, `cache.read`, `cache.write`, plus the optional
   `experimentalOver200K` variant used later by `Session.getUsage`.
7. **`enabled_providers` / `disabled_providers`** in config act as an allow/deny list (`isProviderAllowed`), with
   allowlist taking precedence.
8. **Plugins contribute providers** (`plugin.list()` is consulted before config), which is how
   `@opencode` / Copilot / Codex providers appear without being in the catalogue.

### 2.1 Bundled SDK map

```js
const BUNDLED_PROVIDERS = {
  "@ai-sdk/amazon-bedrock": createAmazonBedrock,
  "@ai-sdk/anthropic": createAnthropic,
  "@ai-sdk/azure": createAzure,
  "@ai-sdk/google": createGoogleGenerativeAI,
  "@ai-sdk/google-vertex": createVertex2,
  "@ai-sdk/google-vertex/anthropic": createVertexAnthropic2,
  "@ai-sdk/openai": createOpenAI,
  "@ai-sdk/openai-compatible": createOpenAICompatible,
  "@openrouter/ai-sdk-provider": createOpenRouter,
  "@ai-sdk/xai": createXai, …
};
```

[inferred] Bundling the factory functions (rather than resolving them at runtime by package name) removes a
network/`node_modules` dependency at startup at the cost of binary size — consistent with the offline-first
choice made for the model catalogue.

### 2.2 `sdkKey` — normalisation to a canonical family (`transform.ts`)

```js
"@ai-sdk/github-copilot" → "copilot"
"@ai-sdk/azure"          → "azure"
"@ai-sdk/openai"         → "openai"
"@ai-sdk/amazon-bedrock" → "bedrock"
"@ai-sdk/anthropic" | "@ai-sdk/google-vertex/anthropic" → "anthropic"
"@ai-sdk/google-vertex"  → "vertex"
"@ai-sdk/google"         → "google"
"@ai-sdk/gateway"        → "gateway"
"@openrouter/ai-sdk-provider" → "openrouter"
```

Everything quirk-specific later keys off this family, not off package names — one place to add a package.

### 2.2.1 Branded provider ids (`provider/schema.ts`, 26 lines)

`ProviderID` is a branded string with built-in constants — `opencode`, `anthropic`, `openai`, `google`,
`google-vertex`, `github-copilot`, `amazon-bedrock`, `azure`, `openrouter`, `mistral`, `gitlab` — and `ModelID`
the bare branded string. Both builders take a zod schema of the same shape.

### 2.3 `provider/models.ts` (140 lines) — models.dev fetch, cache and the fallback ladder

`ModelsDev` is the module that actually downloads the model catalogue — and "actually" matters, because the
download is six layers deep in fallbacks:

1. `OPENCODE_MODELS_PATH` (a file path override), read on every access;
2. the on-disk cache at `<Global.Path.cache>/models.json` (or `models-<sha1(source)>.json` when
   `OPENCODE_MODELS_URL` is overridden) — used when it exists (the read catch just continues, so a corrupt cache
   is refetched, not an error);
3. the **bundled `models-snapshot.js`** (1.76 MB, §8) — a snapshot baked into the build, used when there is no
   cache and no network access yet;
4. `OPENCODE_DISABLE_MODELS_FETCH` → `{}` (offline installs get an empty catalogue rather than failing);
5. a network fetch under the `models-dev:<filepath>` Flock — double-checked inside the lock, because two
   open processes must not stampede the cache file; the fetched text is written to the cache path, and the
   parsed payload returned.

The refresh side has a 5-minute freshness TTL (`Date.now() - stat.mtimeMs < 5 * 60 * 1000`) and an hourly
background `setInterval` (unref'd so it never keeps the process alive). A fetch does not update the in-memory
cache; `refresh()` writes through `Filesystem.write` and resets the lazy `Data` promise, and write failures are
logged (`"Failed to write models cache"`). So the catalogue is refreshed exactly hourly, TTL-gated, and only
when a write succeeds.

`ModelsDev.Model` (data per model): `id, name, family, release_date, attachment, reasoning, temperature,
tool_call, interleaved` (either `true` or `{field: "reasoning_content" | "reasoning_details"}`, `.strict()`),
`cost` (input/output, optional cache tiers, `context_over_200k` tier), `limit` (context, optional input, output),
`modalities`, `experimental`, `status` (alpha|beta|deprecated), plus `options`, `headers`, `provider`, and
`variants`. `ModelsDev.Provider`: `api?, name, env[], id, npm?, models`.

## 3. Model + language-model resolution

### 3.1 `getModel(providerID, modelID)` (provider.ts:1240)

Throws `Provider.ModelNotFoundError` with **fuzzysort suggestions** when either the provider or the model is
unknown:

```js
const matches = fuzzysort.go(providerID, available, { limit: 3, threshold: -1e4 });
throw new Provider.ModelNotFoundError({ providerID, modelID, suggestions: matches.map(m => m.target) });
```

[inferred] A named model in config will be typo'd eventually; returning "did you mean" candidates turns a dead
end into a fixable error. The threshold `-1e4` is deliberately permissive — it prefers *some* suggestion over none.

### 3.2 `getLanguage(model)` (provider.ts:1258)

Memoised per `providerID/modelID` in `s5.models`. Two paths:

- **E2E override** — if `OPENCODE_E2E_LLM_URL` is set, *every* provider is replaced by an
  `createOpenAICompatible({ name: providerID, apiKey: "test-key", baseURL: url })` pointing at that URL. This is
  the test harness hook: the entire app can be driven against a fake LLM.
- **Normal** — `resolveSDK(model, s5)` then `modelLoaders[providerID]?.(sdk, model.api.id, {...provider.options, ...model.options})`
  or `sdk.languageModel(model.api.id)`. `NoSuchModelError` is translated into `Provider.ModelNotFoundError`.

The `modelLoaders` / `varsLoaders` seams are how plugins (Copilot, Codex) supply non-standard SDKs without
forking the provider layer.

### 3.3 `getSmallModel(providerID)` — cheap-model policy

```js
if (cfg.small_model) return getModel(parseModel(cfg.small_model));
let priority = ["claude-haiku-4-5","claude-haiku-4.5","3-5-haiku","3.5-haiku",
                "gemini-3-flash","gemini-2.5-flash","gpt-5-nano"];
if (providerID.startsWith("opencode"))       priority = ["gpt-5-nano"];
if (providerID.startsWith("github-copilot")) priority = ["gpt-5-mini","claude-haiku-4.5", ...priority];
```

Used for titles/summaries. The configured `small_model` wins unconditionally; otherwise a **substring match**
against the priority list picks the first available model. [inferred] String containment rather than exact IDs is
deliberate: model IDs churn (`claude-haiku-4-5-20251001`), so a prefix/fragment survives renames.

Bedrock gets a special case inside the loop: for each candidate it prefers a `global.` cross-region inference
profile, then a region-prefixed one (`us.`/`eu.` derived from `provider.options.region`), before the plain ID —
because Bedrock model IDs encode the inference region and the "same" model is a different ID there.

### 3.4 `defaultModel()` and `Provider.sort`

```js
const priority = ["gpt-5", "claude-sonnet-4", "big-pickle", "gemini-3-pro"];
function sort(models) {
  return sortBy(models,
    [m => priority.findIndex(f => m.id.includes(f)), "desc"],
    [m => m.id.includes("latest") ? 0 : 1, "asc"],
    [m => m.id, "desc"]);
}
```

[verified] The **selection order for "which model should I default to" is a hardcoded preference list compiled into
the binary**, and `` `big-pickle` `` appears in it — an internal/unreleased model name present in shipped code.
The same `sort` decides the order models appear in pickers, so a product decision about model quality is expressed
as a sort key over substring matches.

## 4. Request transformation (`transform.ts`)

`ProviderTransform` is where provider quirks are absorbed **before** the SDK sees the request:

- `OUTPUT_TOKEN_MAX = Flag.OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX || 32000` — a hard cap applied to
  `maxOutputTokens`, overridable for experiments.
- `normalizeMessages(msgs, model, options)`:
  - **Anthropic/Bedrock**: drop messages whose content is `""`, drop empty text/reasoning parts, drop messages
    that become empty. [inferred] Anthropic rejects empty content blocks; doing this centrally avoids per-call
    guards.
  - **Any model whose `api.id` contains `claude`**: rewrite `toolCallId` with `/^[^a-zA-Z0-9_-]/ → "_"` scrubbing.
    [inferred] Tool-call IDs originating from other providers (or from OpenCode's own `PartID`s) can contain
    characters Claude tool-use validation rejects.
- `mimeToModality(mime)` maps `image/`, `audio/`, `video/`, `application/pdf` to the capability keys.
- `variants(model)` synthesises model variants (e.g. reasoning-effort presets) which are then merged with
  user-declared `model.variants`.

[inferred] Putting every quirk in one module (rather than in each provider factory) is the pragmatic choice for a
project that supports ~15 SDKs with a small team: one place to debug "why does provider X reject my payload".

## 5. Streaming surface (`src/session/llm.ts`)

`LLM.stream(...)` is what `SessionProcessor` consumes. It normalises the AI SDK stream into the event union seen
by the processor (`start`, `text-delta`, `reasoning-delta`, `tool-input-*`, `tool-call`, `tool-result`,
`tool-error`, `start-step`, `finish-step`, `finish`, `error`).

Notable parameters visible at call sites: `agent`, `user`, `system`, `tools`, `model`, `abort` (AbortSignal),
`sessionID`, `retries`, `small`, and `toolChoice: "required"` for structured output.

Two reliability features live around this layer:

- **SSE idle timeout** (`wrapSSE` in provider.ts): if a stream has `content-type: text/event-stream` and a
  positive timeout is configured, each `reader.read()` is raced against a timer; on expiry it aborts the
  controller *and* cancels the reader, producing a deterministic "SSE read timed out" error instead of a hung
  turn.
- **`shouldUseCopilotResponsesApi(modelID)`**: `gpt-<n>` with `n >= 5` and not `gpt-5-mini` uses the Responses
  API shape for Copilot. Hardcoded because the capability is not discoverable from the model catalogue.

## 6. Cost and token accounting (`Session.getUsage`)

```js
inputTokens, outputTokens, reasoningTokens, cachedInputTokens
cacheWrite = metadata.anthropic.cacheCreationInputTokens
          ?? metadata.vertex.cacheCreationInputTokens
          ?? metadata.bedrock.usage.cacheWriteInputTokens
          ?? metadata.venice.usage.cacheCreationInputTokens ?? 0
adjustedInput = input - cacheRead - cacheWrite
tokens = { total, input: adjustedInput, output: output - reasoning,
           reasoning, cache: { write, read } }
cost = Σ (tokens.x * price.x / 1e6)   // Decimal arithmetic
```

Three decisions worth flagging:

1. **Cache accounting is provider-specific** — four different metadata shapes are probed in order because each
   vendor reports cache writes differently. This is the clearest example in the codebase of "normalise at the
   boundary, once".
2. **`Decimal`**, not floats, for cost. A long session accumulates thousands of micro-charges; binary float
   drift is visible in a total the user pays for.
3. **Reasoning tokens are billed as output** (`tokens.reasoning * cost.output`), and `output` is *reduced* by
   reasoning so `input + output + reasoning + cache` does not double count. Whether this matches every vendor's
   billing semantics is [undetermined] — proof of impossibility: this bundle's client code can only
   state the local formula; each vendor's billing policy (what it actually charges for reasoning tokens)
   is server-side in the vendor's systems and is not present in this artifact.

`experimentalOver200K` on a model's cost switches the entire price table when
`tokens.input + tokens.cache.read > 200000` — i.e. the discount applies to the whole request, not marginally.
[inferred] That matches how Anthropic prices long-context requests.

### 6.1 The error taxonomy (`provider/error.ts`, 149 lines)

This module is what turns a provider failure into a decision (retry? compact?). It has three parts:

- **Overflow detection.** `isOverflow()` matches **nineteen provider phrasings** of "your prompt is too long"
  (`prompt is too long`, `exceeds the context window`, `maximum context length is \d+ tokens`,
  `input token count … exceeds the maximum`, `model_context_window_exceeded`, …, brands pinned by a fingerprint
  regex each). The numeric fallback catches those without a body: `/^4(00|13)\s*(status code)?\s*\(no body\)/i`
  — a 400/413 whose message is just its status text.
- **Message synthesis.** `message(providerID, err)` has a cascade worth reading because it's a UX decision, not a
  string join: empty message → the raw response body → the HTTP `STATUS_CODES` text → `"Unknown error"`. If the
  message *is* the status text and the body is JSON, it appends `body.message || body.error ||
  body.error.message`. If the body is HTML, 401/403 get prose: `"Unauthorized: request was blocked by a gateway
  or proxy. Your authentication token may be missing or expired — try running opencode auth login …"` and a
  `Forbidden` twin pointing at account/provider settings. The generic case appends the raw body.
- **Classification.** `parseStreamError` (mid-stream OpenAI error payloads) maps four codes to typed,
  *non-retryable* errors: `context_length_exceeded` → `context_overflow`; `insufficient_quota` → `api_error`
  ("Quota exceeded. Check your plan and billing details."); `usage_not_included` → `api_error` ("To use Codex with
  your ChatGPT plan, upgrade to Plus: https://chatgpt.com/explore/plus."); `invalid_prompt` → `api_error` with
  the provider's message. `parseAPICallError` treats overflow (pattern match, status 413, or the code itself)
  as `{type: "context_overflow"}`, which is the compaction trigger in `16` §1 — otherwise
  `{type: "api_error", …, isRetryable}`.

- **The retryability matrix has one provider carve-out.** For `providerID.startsWith("openai")`,
  `isOpenAiErrorRetryable` forces 404 into retryable (the OpenAI-compatible SDK marks some 404s as retryable
  because a model that doesn't exist yet can appear); for everyone else the error's own `isRetryable` is
  trusted. That asymmetry is why an OpenAI user sees "model not found" retried while an Anthropic user gets the
  error immediately.

## 7. Auth (`src/provider/auth.ts`, `src/mcp/*oauth*`)

- Auth is stored per provider ID and read through `auth.get(id)` with `Effect.orDie` in the provider dep object —
  i.e. a missing credential is a *programming* error at that layer, surfaced earlier by the UI.
- Provider auth supports API keys and OAuth. The shared OAuth machinery (`oauth-provider.ts`,
  `oauth-callback.ts`) is used by both MCP servers and providers, with a local callback listener.
- Copilot (`plugin/github-copilot/*`) and Codex (`plugin/codex.ts`) are implemented as plugins rather than
  built-in providers, which keeps their token refresh logic isolated.

**Security note [verified]:** credentials are read from the auth store, never from the model config, and are
injected into SDK options at construction. They are not written into session rows or events; the TUI's provider
list shows connection *state*, not secrets.

## 8. `models-snapshot.js` — the 1.76 MB constant

A single module exporting a JSON blob of the model catalogue. It is the largest application module by far and
exists so that:
- start-up makes no network request,
- `opencode models` works offline,
- unknown model IDs still resolve to sensible defaults.

[inferred] Trade-off: every catalogue update requires a release. The live-refresh path (if any) is not visible in
the entry bundle [undetermined].

---

## 9. The vendored OpenAI-compatible SDK (`src/provider/sdk/copilot/**`, 20 files, 2,879 lines) — [verified]

> Module map: `provider/sdk/copilot/{index,copilot-provider,openai-compatible-error}.ts`, `…/chat/*` (six files),
> `…/responses/*` (five files), `…/responses/tool/*` (six files). Every one is described in §9.4.

This is not a shim around an installed package: it is a **fork of `@ai-sdk/openai-compatible` (chat) and
`@ai-sdk/openai` (responses) committed as application source**, with Copilot-specific fields added. `index.ts` is a
three-line re-export of `copilot-provider.ts`; everything else is the fork. It exists because the Copilot API
returns reasoning as `reasoning_text` + `reasoning_opaque` (neither is in the OpenAI schema), exposes vendor-side
tools (`web_search`, `file_search`, `code_interpreter`, `image_generation`, `local_shell`, `computer_use`) and
needs per-model request shaping that the upstream package does not implement. Its `VERSION13 = "0.1.0"` is the
tell that it is a vendored snapshot, not a maintained fork.

`provider/provider.ts` picks it up through the `modelLoaders` seam (§2):
`shouldUseCopilotResponsesApi(modelID)` — `/^gpt-(\d+)/` with `n >= 5` and not `gpt-5-mini` — selects
`sdk.responses`, and **everything else, including `o*` models, gets `sdk.chat`**.

### 9.1 Factory (`copilot-provider.ts`, 42 lines)

```js
openaiCompatible = createOpenaiCompatible()          // module-level singleton, no options
  baseURL = withoutTrailingSlash(options.baseURL ?? "https://api.openai.com/v1")
  headers = {Authorization: `Bearer ${apiKey}`, ...options.headers}
  getHeaders = () => withUserAgentSuffix(headers, `ai-sdk/openai-compatible/0.1.0`)
  provider(modelId)          -> chat model          // callable provider, like upstream
  provider.chat / .responses -> chat / responses model
  provider.languageModel     -> chat model          // the only place the default is chat
```

Provider strings are `` `${name ?? "openai-compatible"}.chat` `` / `.responses`; `providerOptionsName` is the part
before the dot, so `copilot.chat` reads `providerOptions.copilot`. The real base URL and `fetch` are injected by the plugin's auth loader
(`plugin/github-copilot/copilot.ts`: `baseURL = base(enterpriseUrl)` plus a `fetch` wrapper that inspects the
request body — last-message role, presence of image parts — to set Copilot's agent/vision headers). The literal
`api.openai.com` default here is therefore unreachable in practice and misleading as documentation.

### 9.2 Chat model (`chat/openai-compatible-chat-language-model.ts`, 574 lines)

`getArgs` maps the AI-SDK call into an OpenAI chat body: `max_tokens`, `temperature`, `top_p`,
`frequency_penalty`, `presence_penalty`, `stop`, `seed`, `messages`, `tools`, `tool_choice`, plus
`reasoning_effort`, `verbosity`, `thinking_budget` (Copilot extensions). Notably:

- **Unknown provider options are splatted into the body verbatim**: every key of `providerOptions[<name>]` not in
  `openaiCompatibleProviderOptions.shape` (`user`, `reasoningEffort`, `textVerbosity`, `thinking_budget`) is copied
  through. That is how Copilot-only fields reach the API without a schema change — and also how a typo becomes a
  silently-sent parameter.
- Warnings instead of errors for `topK` and for a JSON `responseFormat` with a schema when
  `supportsStructuredOutputs` is false (then `response_format` degrades to `json_object`).
- **Reasoning is a Copilot-only channel**: `message.reasoning_text` becomes a `reasoning` content part, and
  `message.reasoning_opaque` is attached as `providerMetadata.copilot.reasoningOpaque` on *every* emitted part
  (text, reasoning and tool-call alike).

Streaming (`doStream`) is a hand-written state machine. Fixed ids `reasoning-0` / `txt-0` mean **one reasoning
block and one text block per response**; a second `reasoning_opaque` in the same stream throws
`InvalidResponseDataError("Multiple reasoning_opaque values received in a single response…")`. Tool calls are keyed
by `delta.tool_calls[].index`, accumulated by string concatenation, and emitted as soon as
`isParsableJson(arguments)` is true — i.e. **a tool call is considered complete when its JSON happens to parse**,
not when the provider says so. `flush` force-closes any unfinished calls.

### 9.3 Responses model (`responses/*` — five files, 1,822 lines, plus `responses/tool/*` at 190)

`getResponsesModelConfig(modelId)` is a **hardcoded prefix table**, not a capability lookup:

| Prefix | `isReasoningModel` | `systemMessageMode` | Provides |
|---|---|---|---|
| `gpt-5-chat*` | false | `system` | — |
| `o1-mini*`, `o1-preview*` | true | **`remove`** (system messages dropped, warning emitted) | priority |
| other `o*`, `gpt-5*`, `codex-*`, `computer-use*` | true | `developer` | flex + priority |
| everything else | false | `system` | — |

Consequences encoded there: reasoning models have `temperature`/`top_p` **stripped with a warning**; non-reasoning
models warn if `reasoningEffort`/`reasoningSummary` are set; `service_tier` is deleted with a warning when the model
lacks flex/priority support; `truncation: "auto"` is only sent for models that require it. `include` is assembled
dynamically — logprobs, `web_search_call.action.sources`, `code_interpreter_call.outputs` — so the response
contains the fields the model layer needs to parse.

**`store` changes the meaning of the conversation.** With `store` (default `true`) tool results and reasoning are
sent back as `item_reference` ids (`{type:"item_reference", id: <call_id>}`); with `store: false` reasoning is
re-sent as full `summary`/`encrypted_content` items and **tool results are dropped entirely** with a warning
(`Results for OpenAI tool … are not sent to the API when store is false`). A stateless deployment therefore loses
tool-result context on the second turn.

Input conversion (`convert-to-openai-responses-input.ts`) is where history is reassembled:

- images → `input_image` (`image_url` for a data URL or URL; `file_id` when the string starts with a configured
  `fileIdPrefixes` entry); `application/pdf` → `input_file` (URL, `file_id`, or base64 `file_data` with a synthetic
  `part-N.pdf` filename); any other media type throws `UnsupportedFunctionalityError`.
- assistant text → `output_text` with `itemId` passthrough; `tool-call` → `function_call` (or `local_shell_call`
  when that tool is present and the call is named `local_shell`); provider-executed calls are skipped.
- reasoning parts without an `itemId` are dropped with a warning — Copilot reasoning cannot be replayed unless the
  item id was captured.
- `tool-approval-response` parts become `mcp_approval_response` (deduplicated by `approvalId`), and an
  `execution-denied` output that carries an `approvalId` is skipped rather than sent as a function output.

`prepare-responses-tools.ts` maps function tools to `{type:"function", strict}` and six provider tools to their
vendor shapes (`file_search` with vector-store ids and comparison/compound filters, `web_search`,
`web_search_preview`, `code_interpreter` with container ids, `image_generation` with a strictly validated option
set, `local_shell`). `toolChoice` for those names becomes `{type:"<tool>"}` instead of a function reference.

Response parsing (`doGenerate`) turns each output item into content parts; vendor-executed tools are emitted as a
**tool-call immediately followed by its tool-result** (`providerExecuted: true`), `url_citation`/`file_citation`
annotations become `source` parts, and an `error` field in a 200 response is re-thrown as a non-retryable
`APICallError` with `statusCode: 400`. The stream variant keeps one `ongoingToolCalls[output_index]` map and
synthesises code-interpreter JSON by hand (`delta: '{"containerId":"…","code":"'` … `'"}'`) so the emitted
`tool-call` parses.

### 9.4 File inventory (all 20 modules)

Every module in the subtree, with what it actually contains — this is the whole shim, not a sample:

| File | Lines | Contents |
|---|---:|---|
| `provider/sdk/copilot/index.ts` | 3 | `init_copilot()` re-export only. |
| `provider/sdk/copilot/copilot-provider.ts` | 42 | `createOpenaiCompatible()` factory + the module-level `openaiCompatible` singleton (§9.1). |
| `provider/sdk/copilot/openai-compatible-error.ts` | 16 | `{error:{message,type,param,code}}` zod schema and the default error structure used by the chat model. |
| `provider/sdk/copilot/chat/openai-compatible-chat-language-model.ts` | 574 | The chat `LanguageModelV3`: `getArgs`, `doGenerate`, `doStream`, the SSE chunk schema, usage schema (§9.2). |
| `provider/sdk/copilot/chat/convert-to-openai-compatible-chat-messages.ts` | 143 | Prompt → `messages[]`: system passthrough, single-text user flattening, image → `image_url`, assistant `reasoning_text`/`reasoning_opaque`/`tool_calls`, tool outputs → role `tool` (skips approval responses). |
| `provider/sdk/copilot/chat/openai-compatible-prepare-tools.ts` | 53 | Functions-only tool mapping (provider tools warned as unsupported) and `tool_choice` translation. |
| `provider/sdk/copilot/chat/openai-compatible-chat-options.ts` | 10 | `providerOptions` schema: `user`, `reasoningEffort`, `textVerbosity`, `thinking_budget`. |
| `provider/sdk/copilot/chat/map-openai-compatible-finish-reason.ts` | 15 | `stop\|length\|content_filter\|function_call\|tool_calls\|other` → AI-SDK finish reasons. |
| `provider/sdk/copilot/chat/get-response-metadata.ts` | 11 | `{id, model, created}` → `{id, modelId, timestamp}`. |
| `provider/sdk/copilot/responses/openai-responses-language-model.ts` | 1,388 | The responses model: `getArgs` + model-prefix capability table + `doGenerate` + the `doStream` item state machine + all chunk schemas + `openaiResponsesProviderOptionsSchema` (§9.3). |
| `provider/sdk/copilot/responses/convert-to-openai-responses-input.ts` | 271 | History → `input[]` items: `system\|developer\|remove` modes, `input_image`/`input_file`, `function_call`, `local_shell_call`, `item_reference`, reasoning items, `mcp_approval_response`, `function_call_output`. |
| `provider/sdk/copilot/responses/openai-responses-prepare-tools.ts` | 130 | `function` tools (with `strict`) + the six vendor tools, and `tool_choice` translation (incl. `{type:"<vendor tool>"}`). |
| `provider/sdk/copilot/responses/openai-error.ts` | 17 | A second copy of the error schema plus `createJsonErrorResponseHandler` for the responses path. |
| `provider/sdk/copilot/responses/map-openai-responses-finish-reason.ts` | 16 | `incomplete_details.reason` + `hasFunctionCall` → unified finish reason. |
| `provider/sdk/copilot/responses/tool/web-search.ts` | 38 | `openai.web_search` tool factory: `filters.allowedDomains`, `searchContextSize`, `userLocation`, and a `search\|open_page\|find` action schema. |
| `provider/sdk/copilot/responses/tool/web-search-preview.ts` | 35 | The same shape for the legacy `openai.web_search_preview` tool. |
| `provider/sdk/copilot/responses/tool/file-search.ts` | 38 | `openai.file_search`: vector-store ids, `max_num_results`, ranking, recursive comparison/compound filter schemas, output schema (`queries`, `results[].fileId/filename/score/text`). |
| `provider/sdk/copilot/responses/tool/code-interpreter.ts` | 28 | `openai.code_interpreter`: `{code, containerId}` input, `outputs[{type:logs\|image}]` output, `container: string \| {fileIds}` args. |
| `provider/sdk/copilot/responses/tool/image-generation.ts` | 28 | `openai.image_generation`: strict args (`background`, `inputFidelity`, `inputImageMask`, `quality`, `size`, `partialImages` ≤ 3, `outputCompression` 0–100, `outputFormat`). |
| `provider/sdk/copilot/responses/tool/local-shell.ts` | 23 | `openai.local_shell`: `action{type:"exec", command[], timeoutMs, user, workingDirectory, env}`, output `{output}`. |

Three of the six tool factories (`web_search`, `web_search_preview`, `file_search`) use `createProviderToolFactory`
and three (`code_interpreter`, `image_generation`, `local_shell`) use `createProviderToolFactoryWithOutputSchema` —
the split is only about whether opencode wants to parse the tool's result.

### 9.5 Debt in this subtree

1. **1,388 lines of model logic keyed on string prefixes.** `getResponsesModelConfig` and
   `shouldUseCopilotResponsesApi` both guess capability from the model name; a new Copilot model is wrong until
   the code changes.
2. **`reasoning_opaque` is single-shot by construction** (one fixed `reasoning-0` id, throw on a second value), so
   multi-block thinking on a provider that emits it piecewise is unsupported rather than degraded.
3. **Tool-call completion is a JSON-parse heuristic** in the chat path; on the responses path it is a real
   `output_item.done`. The two paths disagree on the same concept.
4. **`store: false` silently loses tool results**, and the warning is the only signal.
5. **Two identical error schemas** (`openai-compatible-error.ts`, `responses/openai-error.ts`) and two copies of
   the usage schema; nothing prevents them from drifting.
6. **The vendor tool factories are registered but unused by opencode's own tools** — they exist so a Copilot model
   can call them server-side; `computer_use` and `image_generation` results arrive as `providerExecuted` parts that
   `toModelMessages` must simply pass through.
