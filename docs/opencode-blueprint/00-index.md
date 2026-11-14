# OpenCode 1.3.17 — Technical Blueprint

<!-- toc -->
## Contents

- [1. What was analyzed (provenance)](#1-what-was-analyzed-provenance)
- [2. How to read this document set](#2-how-to-read-this-document-set)
- [3. Confidence legend](#3-confidence-legend)
- [4. Method and reproducibility](#4-method-and-reproducibility)

<!-- /toc -->

A reverse-engineered, source-level analysis of **the code that actually ships inside the installed
`opencode` binary** (`opencode-ai@1.3.17`, `/$bunfs/root/src/index.js`), not of the upstream repository.

---

## 1. What was analyzed (provenance)

| Artefact | Detail |
|---|---|
| Installed launcher | `/usr/local/lib/node_modules/opencode-ai/bin/opencode` (Node wrapper, spawns the payload) |
| Payload | `.../bin/.opencode` — `Mach-O 64-bit executable x86_64`, 130,697,792 bytes |
| Runtime | Bun standalone executable (`bun build --compile`), exec argv `--user-agent=opencode/1.3.17 --use-system-ca --` |
| Bun payload | starts at byte `65,380,360`; 64,585,314 bytes; **555 embedded modules**, trailer `\n---- Bun! ----\n` at `129,965,706` |
| Extracted JS | 4 modules: `src/index.js` (22.41 MB / 581,934 lines), `src/cli/cmd/tui/worker.js` (15.79 MB / 399,547 lines), `@opentui/core/parser.worker.js` (162.7 KB), `opencode-web-ui.gen.js` (137.3 KB) |
| Split into modules | 3,737 marker-delimited segments → **446 application modules** (`src/**`, 4.28 MB) + 3,291 vendor modules (`../../node_modules/**`) |

Everything below cites **module paths from the extracted bundle** (`src/session/processor.ts`, …) and, where
useful, bundle line numbers in the extracted `index.js`. Bun preserves the original TypeScript/ESM paths as
comments before each module, which is what makes module-level attribution possible.

> The bundle is *transpiled output*: type annotations are gone, names are de-duplicated with numeric suffixes
> (`create2`, `log11`, `path57`), and `const`/`let` are lowered to `var`. Code shown in this document is quoted
> verbatim from the extracted modules; where a name was mangled, the original intent is identified from call
> sites and string literals, never guessed silently.

## 2. How to read this document set

| File | Contents |
|---|---|
| `01-bundle-anatomy.md` | How the binary and bundle are structured; how to re-extract and re-split it |
| `02-architecture.md` | Layering, the Effect service model, the per-directory instance model, dependency graph, the utility layer (`util/*`, §8) |
| `03-execution-flows.md` | End-to-end traces: CLI→TUI startup, one prompt turn, one tool call, one HTTP request |
| `04-session-engine.md` | `Session`, `MessageV2`, `SessionProcessor`, compaction, retry, status, summary, revert |
| `05-providers-and-llm.md` | Provider registry, SDK juggling, model resolution, streaming, transforms, cost, and the vendored Copilot/OpenAI-compatible SDK (§9) |
| `06-tools-and-permissions.md` | `Tool.define` contract, registry, each builtin tool, permission algebra |
| `07-server-and-transport.md` | Bun.serve, route table, SSE, worker RPC transport, TUI store synchronisation |
| `08-storage-and-config.md` | Filesystem layout, SQLite schema and migrations, instance state, the full config precedence chain, every env flag |
| `09-integrations.md` | Plugins and their hooks, MCP transports/auth/lifecycle, LSP, skills, commands, sharing |
| `10-security-and-reliability.md` | Trust boundaries, permission algebra in practice, secret handling, failure containment, known weaknesses |
| `11-decisions-and-debt.md` | The seven decisions that shape the design, secondary trade-offs, verified debt, and the coverage log |
| `12-appendix-module-inventory.md` | Every application module with byte size, line count and bundle line range |
| `13-tui.md` | The terminal UI: process/worker boot, provider tree, store, keybinds, session route, permission/question dialogs, composer, autocomplete, theme, TUI plugin runtime |
| `14-cli.md` | Every CLI command, with the `run` event loop, `serve`/`web`, `generate`, `stats`, `uninstall`, `agent create`, `providers login`, `mcp auth`, `plugin`, the GitHub CI agent |
| `15-runtime-services.md` | pty, installation, format, file watcher, ripgrep, SyncEvent (event sourcing), question, account device-flow auth, worktree, shell, patch, workspace |
| `16-deep-dive-prompt-messages-instance.md` | Second, line-level pass: `resolvePart` attachment emulation, variant resolution, the full turn state machine and step budget, `shellImpl`, `MessageV2` schema/cursor/`toModelMessages` media relocation, the real 1,470-line ACP agent, the instance/bootstrap layer, managed (MDM) config, `Config.Info`, `grep`/`skill`/`lsp`/`websearch`, SSE, revert/unrevert/cleanup, summary diff accounting, projectors |
| `17-module-index.md` | Every one of the 446 application modules mapped to the document and section that discusses it, with an explicit flag list for the ones nothing documents |
| `18-third-pass-config-git-lsp-mcp-cli.md` | Third, line-level pass over what `16` still listed as unread: every remaining `Config.Info` schema, the real 13-step config merge order, the three write-on-read side effects, `git/index.ts` (flag prefix and why), the 37-server LSP table with root strategies and install ladder, the LSP client lifecycle (45 s init, manual file versions, 150 ms/3 s diagnostics), MCP `create`/timeout/`disconnect`/OAuth semantics, `format/index.ts` state, `session`/`pr` commands, and the corrections this pass forced on `08`, `09`, `10`, `11` and `16` |
| `19-function-ledger.md` | Ledger v2 (**§8.2** lists per callable the 35 substring-only name hits behind the 2,356 → 2,321 delta): every one of the 69,935 lines partitioned exactly once (callable / module-init / declaration / import-wiring / template / data / blank / comment), all 7,451 callables with parameters, returns, control flow, writes, resolved call targets, throws and per-function undetermined aspects, the residual-marker register, the separated inventory / AST / line-accounted / prose-corroborated metrics, and the corroboration ladder (§8) whose `reviewed-closure` / `reviewed-thunk` tiers are the per-callable entries in `21` |
| `20-internal-helper-atlas.md` | Generated behavioral atlas of the 561 nameable callables that `00`–`18` never mention: signature, returns, throws, control flow, direct calls and writes taken from each function's own body |
| `21-verified-closure-review.md` | Per-callable review of the 4,248 callables that have no name of their own: actual syntactic slot (callback of a named callee, JSX prop, object property, IIFE, class constructor, `__esm` module thunk), own-body behaviour, and the verification checks that each claim passed against its source span |
| `22-verbatim-payloads.md` | All 67 non-code payloads (34 `.txt`, 33 `.json`; 8,516 lines) reproduced byte-for-byte, with per-file sha1 and a re-verifying audit — the literal prompts, descriptions, themes and config data that prose cannot reconstruct |
| `23-dependency-manifest.md` | The complete installed dependency closure with exact versions (483 Bun store entries, 451 distinct packages), recovered from the artifact's own store layout, plus the runtime/builtin specifiers and the install command |
| `24-type-surface.md` | The type surface that survives transpilation: 89 class shapes with members and arity, 2,073 runtime validators (zod / Effect `Schema` / `$type`) with their literal domains, and an explicit list of what was erased |

Reading depth is documented per module in `11-decisions-and-debt.md` §4: some modules were read line by line,
others only structurally (symbols + key call paths). The distinction is stated rather than blurred.

## 3. Confidence legend

Every non-trivial claim is tagged:

- **[verified]** — read directly in the extracted code, quoted or precisely paraphrased.
- **[inferred]** — a conclusion drawn from several verified facts (e.g. "this exists to avoid X"); the
  reasoning is stated so it can be challenged.
- **[undetermined]** — cannot be answered from the shipped code alone (e.g. server-side share endpoints,
  build-time configuration that was baked in and removed).

`19-function-ledger.md` is the audit ledger for the residual markers: every remaining `[inferred]` and `[undetermined]` occurrence is listed with the claim, its evidence, and, where the artifact genuinely cannot recover the fact, an itemized impossibility proof.

`19-function-ledger.md` contains an auditable function-ledger register for the remaining `[inferred]` and
`[undetermined]` markers: each marker is classified as behaviorally evidence-backed author-intent uncertainty or as genuinely impossible to recover from the extracted artifact, with the limiting artifact named.

## 4. Method and reproducibility

```bash
# 1. Locate the payload the launcher spawns
ls -l /usr/local/lib/node_modules/opencode-ai/bin/.opencode

# 2. Confirm it is a Bun standalone binary
python3 - <<'PY'
data=open('/usr/local/lib/node_modules/opencode-ai/bin/.opencode','rb').read()
t=b"\n---- Bun! ----\n"; i=data.find(t)
while i!=-1: print(i); i=data.find(t,i+1)
PY

# 3. List and extract embedded modules (Bun 1.3.x 52-byte module records)
npx -y unbunjs list    /usr/local/lib/node_modules/opencode-ai/bin/.opencode
npx -y unbunjs extract /usr/local/lib/node_modules/opencode-ai/bin/.opencode ./out

# 4. Re-split the 22 MB entry bundle into per-module files on the // src/... markers
python3 /tmp/split_modules.py ./out/src/index.js ./modules/index

# 5. After regenerating `17-module-index.md`, re-check every area (◐) anchor
python3 audit-area-anchors.py          # -v also lists directory-only rows; exits 1 on a bad anchor
```

`audit-area-anchors.py` (in this directory, standard library only) re-derives nothing: for each ◐ row it reads the
cited `NN` §X and requires the section to name the module's basename/stem, a sibling file from the same directory,
a parent directory path, a claimed API symbol, or the module in its heading. An anchor that is only a document
number (`04` — session engine) fails, which is the point: those are guesses, not citations.

Limitations of static extraction, stated plainly:

- Extraction recovers **text**, not original formatting; comments that Bun stripped are gone.
- Modules with `../` paths (vendor packages) were written under a `__up__` path segment to stay inside the
  output directory; one module (`@opentui/core/parser.worker.js`) failed to extract because of the traversal
  in its recorded path and was skipped.
- Dead-code elimination happened at build time: modules that exist upstream but are unused in this build are
  absent here. Absence in this bundle is **not** evidence of absence upstream.
- The document describes behaviour of *this* binary. Anything gated on runtime configuration (env vars, config
  files, provider credentials) is described as code paths that exist, not as behaviour you will observe.
