# 17 — Per-file module index: all 446 application modules → where each one is discussed

<!-- toc -->
## Contents

- [1. How to read the table](#1-how-to-read-the-table)
  - [1.1 Totals](#11-totals)
  - [1.2 The honest summary of coverage](#12-the-honest-summary-of-coverage)
  - [1.3 Area anchors, and what each section really contains](#13-area-anchors-and-what-each-section-really-contains)
- [2. Index by directory](#2-index-by-directory)
  - [`src/account/`](#srcaccount)
  - [`src/acp/`](#srcacp)
  - [`src/agent/`](#srcagent)
  - [`src/auth/`](#srcauth)
  - [`src/bus/`](#srcbus)
  - [`src/cli/`](#srccli)
  - [`src/command/`](#srccommand)
  - [`src/config/`](#srcconfig)
  - [`src/control-plane/`](#srccontrol-plane)
  - [`src/effect/`](#srceffect)
  - [`src/env/`](#srcenv)
  - [`src/file/`](#srcfile)
  - [`src/filesystem/`](#srcfilesystem)
  - [`src/flag/`](#srcflag)
  - [`src/format/`](#srcformat)
  - [`src/git/`](#srcgit)
  - [`src/global/`](#srcglobal)
  - [`src/id/`](#srcid)
  - [bundle root (`src/*.ts`)](#bundle-root-srcts)
  - [`src/installation/`](#srcinstallation)
  - [`src/lsp/`](#srclsp)
  - [`src/mcp/`](#srcmcp)
  - [`src/npm/`](#srcnpm)
  - [`src/patch/`](#srcpatch)
  - [`src/permission/`](#srcpermission)
  - [`src/plugin/`](#srcplugin)
  - [`src/project/`](#srcproject)
  - [`src/provider/`](#srcprovider)
  - [`src/pty/`](#srcpty)
  - [`src/question/`](#srcquestion)
  - [`src/server/`](#srcserver)
  - [`src/session/`](#srcsession)
  - [`src/share/`](#srcshare)
  - [`src/shell/`](#srcshell)
  - [`src/skill/`](#srcskill)
  - [`src/snapshot/`](#srcsnapshot)
  - [`src/storage/`](#srcstorage)
  - [`src/sync/`](#srcsync)
  - [`src/tool/`](#srctool)
  - [`src/util/`](#srcutil)
  - [`src/worktree/`](#srcworktree)
- [3. Modules with no coverage (the flag list)](#3-modules-with-no-coverage-the-flag-list)
  - [3.1 The splitter stubs, line by line](#31-the-splitter-stubs-line-by-line)
  - [3.2 What used to be on this list, and where it went](#32-what-used-to-be-on-this-list-and-where-it-went)
- [4. Keeping this index honest](#4-keeping-this-index-honest)

<!-- /toc -->

Every application module in the extracted bundle (the checked-in module manifest (`scripts/module-manifest.json`), 446 files: 295 `.ts`,
83 `.tsx`, 34 `.txt`, 33 `.json`, 1 `.js`) against the eighteen documents that precede it (`00`–`18`).
The point is that **nothing is silently undocumented**: a module either has a document that names it, a
section that describes the subsystem it belongs to, or is listed below as having no coverage at all.

Generated mechanically: each `.md` in `00`–`18` was scanned for path tokens (`session/prompt.ts`,
`cli/cmd/tui/app.tsx`, brace forms such as `session/{index,prompt}.ts`, and bare filenames that are unique
in the module tree), then each hit was attributed to the `##` section it appears under. `12` (the raw
inventory) and this file were excluded from the scan — an inventory entry is not a discussion.
Directory-level rules were assigned by hand; each anchor was then checked against the section text to
confirm the section names that directory or a sibling file. An area row therefore means the *subsystem* is
documented, not that the individual file is discussed (see §1.3).

## 1. How to read the table

| Mark | Meaning |
|---|---|
| ● **cited** | The module is named in prose, or its body quoted, in the listed section. |
| ◐ **area** | The listed section documents the subsystem; the file itself is not discussed. |
| ○ **none** | No document discusses this file or its subsystem. |

A ◐ row that ends in *named only in* was mentioned **only** in a module list or in `11` §4's coverage
log. Those places record that a file exists or was read, not what it does, so such a row is not counted
as a citation — the label before the dot is the subsystem-level anchor it falls back to.

Line counts are from the extracted bundle (transpiled output, comments stripped), so they measure what
this analysis had to read, not upstream source size. `__dup2`, `__dup3`… suffixes are the splitter's
disambiguators; the first occurrence keeps the plain name and the *last* duplicate is usually the real
module body, which is why e.g. `cli/cmd/tui/app.tsx` (2 lines) and `app__dup2.tsx` (884) both exist.

### 1.1 Totals

| Status | Modules | Share | Lines |
|---|---|---|---|
| ● cited | 446 | 100.0% | 69,935 of 69,935 |
| ◐ area | 0 | 0.0% | 0 of 69,935 |
| ○ none | 0 | 0.0% | 0 of 69,935 |
| **total** | **446** | 100% | **69,935** |

### 1.2 The honest summary of coverage

- **446 modules** are named in a document — the core engine, the tool set, the server, the
  storage layer, the TUI's main routes, and the CLI commands that were opened.
- **0 modules** lack coverage: every one of the 446 files is named in a document. The four smallest
  (`index__dup3/4/5.ts`, `cli/cmd/tui/util/clipboard.ts` — 7 lines total) are bundle-splitter/generation stubs; their
  entire content is quoted line by line in §3 below.

### 1.3 Area anchors, and what each section really contains

| Directory | Anchor | What the section actually contains |
|---|---|---|
| `cli/cmd/tui/context/theme/*.json` | `13` §11 | names the 33 built-in themes in `DEFAULT_THEMES` |
| `server/routes/*` | `07` §3 | enumerates the route group by name (`config, event, experimental, file, …`) |
| `tool/*.txt` | `06` §5, `02` §7 | the sibling-`.txt` description convention, with examples |
| `session/prompt/*.txt` | `11` §2 | the per-model system-prompt list |
| `cli/cmd/debug/*` | `14` §13 | `db` and `debug` subcommands |
| `control-plane/adaptors/*` | `15` §12 | the adaptor registry `getAdaptor(type)` |
| `plugin/github-copilot/*` | `09` §1 | the plugin loader and the built-in plugin list |

---

## 2. Index by directory

### `src/account/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `account/account.sql.ts` | 28 | ● | `15` §8 — `Account` — device-flow auth for the hosted console |
| `account/index.ts` | 273 | ● | `15` §8 — `Account` — device-flow auth for the hosted console; `15` — Contents |
| `account/repo.ts` | 79 | ● | `15` §8 — `Account` — device-flow auth for the hosted console; `15` — Contents |
| `account/schema.ts` | 58 | ● | `15` §8 — `Account` — device-flow auth for the hosted console; `15` — Contents |

### `src/acp/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `acp/agent.ts` | 4 | ● | `16` — Contents; `02` §1 — The four-layer picture; `07` §1 — Three transports, one service layer |
| `acp/agent__dup2.ts` | 1,470 | ● | `16` §7 — ACP — the real implementation; `16` — Contents; `11` §3 — Technical debt, concretely |
| `acp/session.ts` | 81 | ● | `16` — Contents |

### `src/agent/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `agent/agent.ts` | 338 | ● | `06` §3 — The builtin tools — verified behaviour; `10` §2 — The permission gate, precisely; `10` — Contents |
| `agent/generate.txt` | 77 | ● | `11` §1 — The seven decisions that shape everything |
| `agent/prompt/compaction.txt` | 17 | ● | `11` §1 — The seven decisions that shape everything |
| `agent/prompt/explore.txt` | 20 | ● | `11` §1 — The seven decisions that shape everything |
| `agent/prompt/summary.txt` | 13 | ● | `11` §1 — The seven decisions that shape everything |
| `agent/prompt/title.txt` | 46 | ● | `11` §1 — The seven decisions that shape everything |

### `src/auth/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `auth/index.ts` | 101 | ● | `02` §8 — The utility layer; `10` §1 — Trust model |

### `src/bus/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `bus/bus-event.ts` | 29 | ● | `02` §3 — The per-directory instance model; `02` — Contents |
| `bus/global.ts` | 5 | ● | `02` §3 — The per-directory instance model |
| `bus/index.ts` | 120 | ● | `02` §2 — The Effect service model; `02` §4 — Bus: the event spine |

### `src/cli/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `cli/bootstrap.ts` | 18 | ● | `14` §2 — `run` — the non-interactive path |
| `cli/cmd/account.ts` | 2 | ● | `14` §1 — Command inventory |
| `cli/cmd/account__dup2.ts` | 192 | ● | `14` §1 — Command inventory |
| `cli/cmd/acp.ts` | 1 | ● | `14` §1 — Command inventory |
| `cli/cmd/acp__dup2.ts` | 56 | ● | `14` §1 — Command inventory |
| `cli/cmd/agent.ts` | 205 | ● | `14` §1 — Command inventory |
| `cli/cmd/cmd.ts` | 3 | ● | `14` §14 — CLI-wide patterns; `14` — Contents |
| `cli/cmd/db.ts` | 3 | ● | `14` §1 — Command inventory |
| `cli/cmd/db__dup2.ts` | 109 | ● | `14` §1 — Command inventory |
| `cli/cmd/debug/agent.ts` | 146 | ● | `14` §13 — `db` and `debug` |
| `cli/cmd/debug/config.ts` | 13 | ● | `14` §13 — `db` and `debug` |
| `cli/cmd/debug/file.ts` | 78 | ● | `14` §13 — `db` and `debug` |
| `cli/cmd/debug/index.ts` | 1 | ● | `14` §13 — `db` and `debug` |
| `cli/cmd/debug/index__dup2.ts` | 23 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/debug/lsp.ts` | 60 | ● | `14` §13 — `db` and `debug` |
| `cli/cmd/debug/ripgrep.ts` | 75 | ● | `14` §13 — `db` and `debug` |
| `cli/cmd/debug/scrap.ts` | 16 | ● | `14` §13 — `db` and `debug` |
| `cli/cmd/debug/skill.ts` | 13 | ● | `14` §13 — `db` and `debug` |
| `cli/cmd/debug/snapshot.ts` | 44 | ● | `14` §13 — `db` and `debug` |
| `cli/cmd/export.ts` | 73 | ● | `14` §1 — Command inventory |
| `cli/cmd/generate.ts` | 37 | ● | `14` §1 — Command inventory |
| `cli/cmd/github.ts` | 4 | ● | `14` §1 — Command inventory |
| `cli/cmd/github__dup2.ts` | 1,238 | ● | `14` §11 — the GitHub CI agent; `14` §1 — inventory |
| `cli/cmd/import.ts` | 143 | ● | `14` §12 — `export`/`import` |
| `cli/cmd/mcp.ts` | 638 | ● | `14` §9 — `mcp auth`; `09` §2 — MCP |
| `cli/cmd/models.ts` | 69 | ● | `14` §1 — Command inventory |
| `cli/cmd/plug.ts` | 173 | ● | `14` §10 — `plugin <module>` |
| `cli/cmd/pr.ts` | 101 | ● | `18` §6.2 — `pr` checkout/fork/import; `14` §1 — inventory |
| `cli/cmd/providers.ts` | 428 | ● | `14` §8 — `providers login`; `05` §7 — auth |
| `cli/cmd/run.ts` | 2 | ● | `14` §2 — `run` — the non-interactive path; `14` §1 — Command inventory; `14` — Contents |
| `cli/cmd/run__dup2.ts` | 1 | ● | `14` §2 — `run` — the non-interactive path; `14` §1 — Command inventory; `14` — Contents |
| `cli/cmd/run__dup3.ts` | 2 | ● | `14` §2 — `run` — the non-interactive path; `14` §1 — Command inventory; `14` — Contents |
| `cli/cmd/run__dup4.ts` | 5 | ● | `14` §2 — `run` — the non-interactive path; `14` §1 — Command inventory; `14` — Contents |
| `cli/cmd/run__dup5.ts` | 537 | ● | `14` §2 — `run` — the non-interactive path; `14` §1 — Command inventory; `14` — Contents |
| `cli/cmd/serve.ts` | 1 | ● | `14` §1 — Command inventory |
| `cli/cmd/serve__dup2.ts` | 16 | ● | `14` §1 — Command inventory |
| `cli/cmd/session.ts` | 134 | ● | `18` §6.1 — `session list`/`delete`, paging; `14` §1 — inventory |
| `cli/cmd/stats.ts` | 288 | ● | `14` §5 — `stats` |
| `cli/cmd/tui/app.tsx` | 2 | ● | `13` §1 — Process and boot; `13` — Contents; `03` §1 — `opencode` (bare) → a rendered TUI |
| `cli/cmd/tui/app__dup2.tsx` | 884 | ● | `13` §1 — Process and boot; `13` — Contents; `03` §1 — `opencode` (bare) → a rendered TUI |
| `cli/cmd/tui/attach.ts` | 74 | ● | `14` §2 — `run` — the non-interactive path |
| `cli/cmd/tui/component/border.tsx` | 20 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/component/dialog-agent.tsx` | 24 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/component/dialog-command.tsx` | 153 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/component/dialog-console-org.tsx` | 100 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/component/dialog-mcp.tsx` | 91 | ● | `13` §12 — TUI plugin runtime; `13` — Contents |
| `cli/cmd/tui/component/dialog-model.tsx` | 1 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/component/dialog-model__dup2.tsx` | 1 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/component/dialog-model__dup3.tsx` | 139 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/component/dialog-provider.tsx` | 1 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/component/dialog-provider__dup2.tsx` | 446 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/component/dialog-session-list.tsx` | 95 | ● | `13` §12 — TUI plugin runtime; `13` — Contents |
| `cli/cmd/tui/component/dialog-session-rename.tsx` | 20 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/component/dialog-skill.tsx` | 30 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/component/dialog-stash.tsx` | 77 | ● | `13` §12 — TUI plugin runtime; `13` — Contents |
| `cli/cmd/tui/component/dialog-status.tsx` | 334 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/component/dialog-theme-list.tsx` | 42 | ● | `13` §12.15 — dialogs and slot registry |
| `cli/cmd/tui/component/dialog-variant.tsx` | 31 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/component/dialog-workspace-list.tsx` | 296 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/component/error-component.tsx` | 121 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/component/logo.tsx` | 95 | ● | `13` §12 — TUI plugin runtime; `13` — Contents |
| `cli/cmd/tui/component/plugin-route-missing.tsx` | 36 | ● | `13` §12.15 — dialogs and slot registry |
| `cli/cmd/tui/component/prompt/autocomplete.tsx` | 3 | ● | `13` §9 — Autocomplete; `13` — Contents |
| `cli/cmd/tui/component/prompt/autocomplete__dup2.tsx` | 592 | ● | `13` §9 — Autocomplete; `13` — Contents |
| `cli/cmd/tui/component/prompt/frecency.tsx` | 79 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/component/prompt/history.tsx` | 82 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/component/prompt/index.tsx` | 3 | ● | `13` §8 — The composer; `07` §4 — The TUI's data layer; `13` — Contents |
| `cli/cmd/tui/component/prompt/index__dup2.tsx` | 1 | ● | `13` §8 — The composer; `07` §4 — The TUI's data layer; `13` — Contents |
| `cli/cmd/tui/component/prompt/index__dup3.tsx` | 1,282 | ● | `13` §8 — The composer; `07` §4 — The TUI's data layer; `13` — Contents |
| `cli/cmd/tui/component/prompt/part.ts` | 11 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/component/prompt/stash.tsx` | 87 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/component/spinner.tsx` | 43 | ● | `13` §4 — Keybindings |
| `cli/cmd/tui/component/startup-loading.tsx` | 77 | ● | `13` §12 — TUI plugin runtime; `13` — Contents |
| `cli/cmd/tui/component/textarea-keybindings.ts` | 62 | ● | `13` §12 — TUI plugin runtime; `13` — Contents |
| `cli/cmd/tui/component/todo-item.tsx` | 36 | ● | `13` §12.15 — dialogs and slot registry |
| `cli/cmd/tui/component/workspace/dialog-session-list.tsx` | 141 | ● | `13` §5 — The session route; `13` — Contents |
| `cli/cmd/tui/context/args.tsx` | 7 | ● | `07` — Contents; `13` §4 — Keybindings; `13` — Contents |
| `cli/cmd/tui/context/exit.tsx` | 51 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/context/helper.tsx` | 27 | ● | `13` §4 — Keybindings |
| `cli/cmd/tui/context/keybind.tsx` | 98 | ● | `13` §4 — Keybindings; `13` — Contents |
| `cli/cmd/tui/context/kv.tsx` | 44 | ● | `13` §12 — TUI plugin runtime; `13` — Contents |
| `cli/cmd/tui/context/local.tsx` | 393 | ● | `13` §3 — Local selection state: `context/local.tsx`; `13` — Contents; `07` — Contents |
| `cli/cmd/tui/context/plugin-keybinds.ts` | 19 | ● | `13` §4 — Keybindings |
| `cli/cmd/tui/context/prompt.tsx` | 17 | ● | `13` §4 — Keybindings |
| `cli/cmd/tui/context/route.tsx` | 23 | ● | `07` — Contents; `13` §4 — Keybindings; `13` — Contents |
| `cli/cmd/tui/context/sdk.tsx` | 108 | ● | `13` — Contents; `07` — Contents; `13` §2 — Data layer: `SyncProvider` |
| `cli/cmd/tui/context/sync.tsx` | 379 | ● | `13` §2 — Data layer: `SyncProvider`; `07` — Contents; `13` — Contents |
| `cli/cmd/tui/context/theme.tsx` | 2 | ● | `13` §11 — Theme; `13` — Contents |
| `cli/cmd/tui/context/theme/aura.json` | 69 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/ayu.json` | 80 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/carbonfox.json` | 248 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/catppuccin-frappe.json` | 233 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/catppuccin-macchiato.json` | 233 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/catppuccin.json` | 112 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/cobalt2.json` | 228 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/cursor.json` | 249 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/dracula.json` | 219 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/everforest.json` | 241 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/flexoki.json` | 237 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/github.json` | 233 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/gruvbox.json` | 242 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/kanagawa.json` | 77 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/lucent-orng.json` | 237 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/material.json` | 235 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/matrix.json` | 77 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/mercury.json` | 245 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/monokai.json` | 221 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/nightowl.json` | 221 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/nord.json` | 223 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/one-dark.json` | 84 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/opencode.json` | 245 | ● | `08` §5 — Configuration — the full precedence chain; `18` §1 — `config/config.ts` — the loader, in code order; `18` §7 — Corrections to the existing documents |
| `cli/cmd/tui/context/theme/orng.json` | 249 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/osaka-jade.json` | 93 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/palenight.json` | 222 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/rosepine.json` | 234 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/solarized.json` | 223 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/synthwave84.json` | 226 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/tokyonight.json` | 243 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/vercel.json` | 245 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/vesper.json` | 218 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme/zenburn.json` | 223 | ● | `13` §11 — Theme |
| `cli/cmd/tui/context/theme__dup2.tsx` | 2 | ● | `13` §11 — Theme; `13` — Contents |
| `cli/cmd/tui/context/theme__dup3.tsx` | 1,040 | ● | `13` §11 — Theme; `13` — Contents |
| `cli/cmd/tui/context/tui-config.tsx` | 9 | ● | `13` §12.14.5 — INTERNAL_TUI_PLUGINS, TuiConfig, debounced signal |
| `cli/cmd/tui/event.ts` | 41 | ● | `13` §12 — TUI plugin runtime; `13` — Contents |
| `cli/cmd/tui/feature-plugins/home/footer.tsx` | 138 | ● | `13` §5 — The session route; `13` — Contents |
| `cli/cmd/tui/feature-plugins/home/tips-view.tsx` | 62 | ● | `13` §12 — TUI plugin runtime; `13` — Contents |
| `cli/cmd/tui/feature-plugins/home/tips.tsx` | 55 | ● | `13` §12 — TUI plugin runtime; `13` — Contents |
| `cli/cmd/tui/feature-plugins/sidebar/context.tsx` | 74 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/feature-plugins/sidebar/files.tsx` | 105 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/feature-plugins/sidebar/footer.tsx` | 144 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/feature-plugins/sidebar/lsp.tsx` | 93 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/feature-plugins/sidebar/mcp.tsx` | 164 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/feature-plugins/sidebar/todo.tsx` | 75 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/feature-plugins/system/plugins.tsx` | 277 | ● | `13` §12.6 — plugin-manager system panel (id `internal:plugin-manager`) |
| `cli/cmd/tui/plugin/api.tsx` | 434 | ● | `13` §12 — TUI plugin runtime; `13` — Contents |
| `cli/cmd/tui/plugin/internal.ts` | 11 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/plugin/runtime.ts` | 3 | ● | `13` §12 — TUI plugin runtime; `07` §4 — The TUI's data layer; `13` — Contents |
| `cli/cmd/tui/plugin/runtime__dup2.ts` | 7 | ● | `13` §12 — TUI plugin runtime; `07` §4 — The TUI's data layer; `13` — Contents |
| `cli/cmd/tui/plugin/runtime__dup3.ts` | 7 | ● | `13` §12 — TUI plugin runtime; `07` §4 — The TUI's data layer; `13` — Contents |
| `cli/cmd/tui/plugin/runtime__dup4.ts` | 851 | ● | `13` §12 — TUI plugin runtime; `07` §4 — The TUI's data layer; `13` — Contents |
| `cli/cmd/tui/plugin/slots.tsx` | 38 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/routes/home.tsx` | 122 | ● | `13` §5 — The session route; `13` — Contents |
| `cli/cmd/tui/routes/session/dialog-fork-from-timeline.tsx` | 59 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/routes/session/dialog-message.tsx` | 92 | ● | `13` §5 — The session route; `13` — Contents |
| `cli/cmd/tui/routes/session/dialog-timeline.tsx` | 45 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/routes/session/index.tsx` | 2 | ● | `13` §5 — The session route; `07` §4 — The TUI's data layer; `13` — Contents |
| `cli/cmd/tui/routes/session/index__dup2.tsx` | 263 | ● | `13` §5 — The session route; `07` §4 — The TUI's data layer; `13` — Contents |
| `cli/cmd/tui/routes/session/index__dup3.tsx` | 2 | ● | `13` §5 — The session route; `07` §4 — The TUI's data layer; `13` — Contents |
| `cli/cmd/tui/routes/session/index__dup4.tsx` | 3,020 | ● | `13` §5 — The session route; `07` §4 — The TUI's data layer; `13` — Contents |
| `cli/cmd/tui/routes/session/permission.tsx` | 949 | ● | `13` §6 — The permission dialog; `13` — Contents; `07` §4 — The TUI's data layer |
| `cli/cmd/tui/routes/session/question.tsx` | 609 | ● | `13` §7 — The question dialog; `13` — Contents; `07` §4 — The TUI's data layer |
| `cli/cmd/tui/routes/session/sidebar.tsx` | 129 | ● | `13` — Contents; `13` §5 — The session route |
| `cli/cmd/tui/routes/session/subagent-footer.tsx` | 174 | ● | `13` §5 — The session route; `13` — Contents |
| `cli/cmd/tui/thread.ts` | 180 | ● | `13` §1 — Process and boot; `13` — Contents; `02` §6 — Two processes, two module graphs |
| `cli/cmd/tui/ui/dialog-alert.tsx` | 70 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/ui/dialog-confirm.tsx` | 95 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/ui/dialog-export-options.tsx` | 256 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/ui/dialog-help.tsx` | 60 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/ui/dialog-prompt.tsx` | 160 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/ui/dialog-select.tsx` | 3 | ● | `13` §10 — Chrome: dialogs, toasts, commands; `13` — Contents |
| `cli/cmd/tui/ui/dialog-select__dup2.tsx` | 480 | ● | `13` §10 — Chrome: dialogs, toasts, commands; `13` — Contents |
| `cli/cmd/tui/ui/dialog.tsx` | 197 | ● | `13` §10 — Chrome: dialogs, toasts, commands; `13` — Contents |
| `cli/cmd/tui/ui/link.tsx` | 13 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/ui/spinner.ts` | 206 | ● | `13` §10 — Chrome: dialogs, toasts, commands; `13` — Contents; `14` §14 — CLI-wide patterns |
| `cli/cmd/tui/ui/toast.tsx` | 119 | ● | `13` §10 — Chrome: dialogs, toasts, commands; `13` — Contents |
| `cli/cmd/tui/util/clipboard.ts` | 1 | ● | stub file: entire content quoted in `17` §3.1 |
| `cli/cmd/tui/util/clipboard__dup2.ts` | 155 | ● | `06` §3.10 — Clipboard (OSC 52, image-only read) |
| `cli/cmd/tui/util/editor.ts` | 43 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/util/model.ts` | 10 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/util/provider-origin.ts` | 5 | ● | `13` §12.14.4 — borders, scrolling and model utils |
| `cli/cmd/tui/util/scroll.ts` | 19 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/util/selection.ts` | 12 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/util/signal.ts` | 4 | ● | `13` §12 — TUI plugin runtime |
| `cli/cmd/tui/util/transcript.ts` | 98 | ● | `13` §10 — Chrome: dialogs, toasts, commands |
| `cli/cmd/tui/win32.ts` | 101 | ● | `13` §13 — Windows; `13` — Contents |
| `cli/cmd/uninstall.ts` | 282 | ● | `14` §1 — Command inventory |
| `cli/cmd/upgrade.ts` | 65 | ● | `14` §1 — Command inventory |
| `cli/cmd/web.ts` | 56 | ● | `14` §1 — Command inventory |
| `cli/effect/prompt.ts` | 18 | ● | `16` §1 — `resolvePart` — how a user's attachment becomes conversation |
| `cli/error.ts` | 44 | ● | `02` §3 — The per-directory instance model; `02` — Contents |
| `cli/heap.ts` | 53 | ● | `02` §3 — The per-directory instance model; `02` — Contents |
| `cli/logo.ts` | 5 | ● | `02` §3 — The per-directory instance model |
| `cli/network.ts` | 48 | ● | `14` §3 — `serve` and `web` |
| `cli/ui.ts` | 3 | ● | `14` §14 — CLI-wide patterns |
| `cli/ui__dup2.ts` | 128 | ● | `14` §14 — CLI-wide patterns |

### `src/command/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `command/index.ts` | 146 | ● | `09` §5 — Commands; `09` — Contents |
| `command/template/initialize.txt` | 68 | ● | `09` §5 — Commands; `09` — Contents |
| `command/template/review.txt` | 103 | ● | `04` §9 — Instruction files — `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md` |

### `src/config/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `config/config.ts` | 1,138 | ● | `18` §1 — schemas, the 13-step merge, writes, cache; `08` §5 — precedence |
| `config/console-state.ts` | 14 | ● | `02` §3 — The per-directory instance model; `02` — Contents |
| `config/markdown.ts` | 79 | ● | `16` §9 — Config; `16` — Contents |
| `config/paths.ts` | 142 | ● | `18` §1.2 — `directories()`/`projectFiles` in the merge order |
| `config/tui-migrate.ts` | 5 | ● | `18` §1 — `config/config.ts` — the loader, in code order |
| `config/tui-migrate__dup2.ts` | 117 | ● | `16` §9 — Config; `16` — Contents |
| `config/tui-schema.ts` | 18 | ● | `02` §3 — The per-directory instance model; `02` — Contents |
| `config/tui.ts` | 6 | ● | `18` §1 — `config/config.ts` — the loader, in code order |
| `config/tui__dup2.ts` | 134 | ● | `16` §9 — Config; `16` — Contents |

### `src/control-plane/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `control-plane/adaptors/index.ts` | 9 | ● | `15` §8 — `Account` — device-flow auth for the hosted console; `15` — Contents |
| `control-plane/adaptors/worktree.ts` | 40 | ● | `15` §8 — `Account` — device-flow auth for the hosted console; `15` — Contents |
| `control-plane/schema.ts` | 12 | ● | `15` §8 — `Account` — device-flow auth for the hosted console |
| `control-plane/sse.ts` | 66 | ● | `15` §12 — `Workspace` / control-plane; `16` §10 — Tools read in full this pass; `16` — Contents |
| `control-plane/types.ts` | 15 | ● | `15` §8 — `Account` — device-flow auth for the hosted console |
| `control-plane/workspace.sql.ts` | 14 | ● | `15` §8 — `Account` — device-flow auth for the hosted console |
| `control-plane/workspace.ts` | 134 | ● | `15` §12 — `Workspace` / control-plane; `15` — Contents |

### `src/effect/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `effect/cross-spawn-spawner.ts` | 389 | ● | `02` §2 — The Effect service model; `02` — Contents |
| `effect/instance-ref.ts` | 9 | ● | `02` §3 — The per-directory instance model |
| `effect/instance-registry.ts` | 13 | ● | `02` §3 — The per-directory instance model |
| `effect/instance-state.ts` | 53 | ● | `08` §4 — Instance state — the per-directory universe; `08` — Contents; `02` §3 — The per-directory instance model |
| `effect/run-service.ts` | 34 | ● | `02` §8 — The utility layer |
| `effect/runner.ts` | 144 | ● | `03` §2 — One user prompt → assistant turn → tool call → next step; `03` — Contents; `16` §5 — `Runner` / `InstanceState` — the concurrency substrate |

### `src/env/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `env/index.ts` | 28 | ● | `02` §3 — The per-directory instance model |

### `src/file/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `file/ignore.ts` | 68 | ● | `02` §3 — The per-directory instance model |
| `file/index.ts` | 601 | ● | `15` §14 — `File` — the read/list/search service; `15` — Contents |
| `file/protected.ts` | 52 | ● | `16` — Contents; `16` §10 — Tools read in full this pass; `18` §6 — CLI commands read in this pass |
| `file/ripgrep.ts` | 315 | ● | `15` §5 — `Ripgrep`; `06` §3 — The builtin tools — verified behaviour; `10` §5 — Process and code execution |
| `file/time.ts` | 104 | ● | `10` §3 — Filesystem safety; `10` — Contents |
| `file/watcher.ts` | 134 | ● | `15` §4 — `FileWatcher`; `15` §14 — `File` — the read/list/search service; `15` — Contents |

### `src/filesystem/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `filesystem/index.ts` | 197 | ● | `02` §3 — The per-directory instance model |

### `src/flag/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `flag/flag.ts` | 111 | ● | `08` §6 — Flags (`src/flag/flag.ts`) — the complete environment surface; `08` — Contents; `01` §1 — Three layers between `opencode` and your terminal |

### `src/format/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `format/formatter.ts` | 436 | ● | `15` §3 — `Format` — automatic formatting after writes; `15` — Contents; `18` — Contents |
| `format/index.ts` | 161 | ● | `18` §5 — formatter state machine; `15` §3 — `Format` |

### `src/git/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `git/index.ts` | 243 | ● | `18` §2 — flag prefix, porcelain/numstat parsing, `defaultBranch` |

### `src/global/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `global/index.ts` | 43 | ● | `08` §1 — Filesystem layout; `08` — Contents |

### `src/id/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `id/id.ts` | 75 | ● | `02` §3 — The per-directory instance model |

### bundle root (`src/*.ts`)

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `index.ts` | 1 | ● | `09` §1 — Plugins; `03` §1 — `opencode` (bare) → a rendered TUI; `05` §9 — The vendored OpenAI-compatible SDK |
| `index__dup2.ts` | 2 | ● | `11` §3 — Technical debt, concretely |
| `index__dup3.ts` | 1 | ● | stub file: entire content quoted in `17` §3.1 |
| `index__dup4.ts` | 1 | ● | stub file: entire content quoted in `17` §3.1 |
| `index__dup5.ts` | 4 | ● | stub file: entire content quoted in `17` §3.1 |
| `index__dup6.ts` | 153 | ● | `11` §3 — Technical debt, concretely |

### `src/installation/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `installation/index.ts` | 279 | ● | `15` §2 — `Installation` — version, method, upgrade; `11` §1 — The seven decisions that shape everything; `15` — Contents |
| `installation/meta.ts` | 1 | ● | `02` §3 — The per-directory instance model |

### `src/lsp/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `lsp/client.ts` | 209 | ● | `18` §3.3 — handshake, file versions, diagnostics; `09` §3 — LSP |
| `lsp/index.ts` | 421 | ● | `18` §3.4 — selection, `broken`, spawn dedupe; `09` §3 — LSP |
| `lsp/language.ts` | 123 | ● | `09` §3 — LSP; `09` — Contents |
| `lsp/launch.ts` | 16 | ● | `15` §8 — `Account` — device-flow auth for the hosted console |
| `lsp/server.ts` | 1,727 | ● | `18` §3.1 — the 37-server table and install ladder; `09` §3 — LSP |

### `src/mcp/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `mcp/auth.ts` | 124 | ● | `09` §2 — MCP; `09` — Contents |
| `mcp/index.ts` | 633 | ● | `18` §4 — transports, timeouts, `disconnect`, OAuth; `09` §2 — MCP |
| `mcp/oauth-callback.ts` | 189 | ● | `05` §7 — Auth |
| `mcp/oauth-provider.ts` | 132 | ● | `05` §7 — Auth |

### `src/npm/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `npm/index.ts` | 189 | ● | `16` §9 — Config |

### `src/patch/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `patch/index.ts` | 489 | ● | `15` §11 — `Patch` — the `apply_patch` engine; `06` §3 — The builtin tools — verified behaviour; `15` — Contents |

### `src/permission/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `permission/arity.ts` | 155 | ● | `06` — Contents; `06` §3 — The builtin tools — verified behaviour |
| `permission/evaluate.ts` | 8 | ● | `06` — Contents; `06` §4 — The permission system |
| `permission/index.ts` | 264 | ● | `06` — Contents; `06` §4 — The permission system |
| `permission/schema.ts` | 14 | ● | `02` §3 — The per-directory instance model; `06` — Contents |

### `src/plugin/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `plugin/cloudflare.ts` | 56 | ● | `09` §1 — Plugins; `09` — Contents |
| `plugin/codex.ts` | 484 | ● | `05` §7 — Auth |
| `plugin/github-copilot/copilot.ts` | 274 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `plugin/github-copilot/models.ts` | 117 | ● | `09` §1 — Plugins; `09` — Contents |
| `plugin/index.ts` | 220 | ● | `09` §1 — Plugins; `09` — Contents; `10` §1 — Trust model |
| `plugin/install.ts` | 340 | ● | `09` §1 — Plugins; `09` — Contents |
| `plugin/loader.ts` | 118 | ● | `09` §1 — Plugins; `09` — Contents |
| `plugin/meta.ts` | 148 | ● | `09` §1 — Plugins; `09` — Contents |
| `plugin/shared.ts` | 293 | ● | `09` §1 — Plugins; `09` — Contents |

### `src/project/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `project/bootstrap.ts` | 33 | ● | `16` §8 — the instance layer (`instance.ts`, `bootstrap.ts`) |
| `project/instance.ts` | 145 | ● | `16` §8 — Instance layer; `02` §8 — The utility layer; `16` — Contents |
| `project/project.sql.ts` | 17 | ● | `08` §7 — Project identity; `08` — Contents |
| `project/project.ts` | 366 | ● | `01` §1 — Three layers between `opencode` and your terminal; `08` §7 — Project identity |
| `project/schema.ts` | 11 | ● | `02` §3 — The per-directory instance model; `02` — Contents |
| `project/state.ts` | 56 | ● | `02` §3 — The per-directory instance model; `02` — Contents |
| `project/vcs.ts` | 165 | ● | `18` §2 — `git/index.ts` — the plumbing everything else assumes; `18` — Contents |

### `src/provider/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `provider/auth.ts` | 168 | ● | `05` §7 — Auth; `05` — Contents; `09` §1 — Plugins |
| `provider/error.ts` | 149 | ● | `05` §6 — Cost and token accounting; `05` — Contents |
| `provider/models-snapshot.js` | 8 | ● | `05` §8 — `models-snapshot.js` — the 1.76 MB constant; `05` §2 — Provider registry construction; `05` — Contents |
| `provider/models.ts` | 140 | ● | `05` §2 — Provider registry construction; `05` — Contents |
| `provider/provider.ts` | 1,436 | ● | `05` §2 — Provider registry construction; `05` — Contents; `05` §3 — Model + language-model resolution |
| `provider/schema.ts` | 26 | ● | `05` §2 — Provider registry construction; `05` — Contents |
| `provider/sdk/copilot/chat/convert-to-openai-compatible-chat-messages.ts` | 143 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/chat/get-response-metadata.ts` | 11 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/chat/map-openai-compatible-finish-reason.ts` | 15 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/chat/openai-compatible-chat-language-model.ts` | 574 | ● | `05` §9 — The vendored OpenAI-compatible SDK; `05` — Contents |
| `provider/sdk/copilot/chat/openai-compatible-chat-options.ts` | 10 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/chat/openai-compatible-prepare-tools.ts` | 53 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/copilot-provider.ts` | 42 | ● | `05` §9 — The vendored OpenAI-compatible SDK; `05` — Contents |
| `provider/sdk/copilot/index.ts` | 3 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/openai-compatible-error.ts` | 16 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/responses/convert-to-openai-responses-input.ts` | 271 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/responses/map-openai-responses-finish-reason.ts` | 16 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/responses/openai-error.ts` | 17 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/responses/openai-responses-language-model.ts` | 1,388 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/responses/openai-responses-prepare-tools.ts` | 130 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/responses/tool/code-interpreter.ts` | 28 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/responses/tool/file-search.ts` | 38 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/responses/tool/image-generation.ts` | 28 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/responses/tool/local-shell.ts` | 23 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/responses/tool/web-search-preview.ts` | 35 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/sdk/copilot/responses/tool/web-search.ts` | 38 | ● | `05` §9 — The vendored OpenAI-compatible SDK |
| `provider/transform.ts` | 836 | ● | `05` §4 — Request transformation; `05` — Contents; `05` §2 — Provider registry construction |

### `src/pty/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `pty/index.ts` | 310 | ● | `15` §1 — `Pty` — terminal sessions; `15` — Contents |
| `pty/schema.ts` | 12 | ● | `02` §3 — The per-directory instance model; `02` — Contents |

### `src/question/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `question/index.ts` | 150 | ● | `15` §7 — `Question`; `15` — Contents |
| `question/schema.ts` | 14 | ● | `02` §3 — The per-directory instance model; `02` — Contents |

### `src/server/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `server/error.ts` | 33 | ● | `07` §3 — HTTP server; `07` — Contents |
| `server/event.ts` | 9 | ● | `07` — Contents; `10` §6 — HTTP surface |
| `server/instance.ts` | 234 | ● | `07` §3 — HTTP server; `07` — Contents |
| `server/mdns.ts` | 59 | ● | `07` — Contents; `07` §3 — HTTP server |
| `server/middleware.ts` | 39 | ● | `07` §3 — HTTP server; `07` — Contents |
| `server/projectors.ts` | 28 | ● | `04` §5 — `SyncEvent`, projectors and the write path; `07` §3 — HTTP server; `07` — Contents |
| `server/router.ts` | 78 | ● | `07` — Contents; `07` §3 — HTTP server |
| `server/routes/config.ts` | 81 | ● | `07` §3 — HTTP server; `07` — Contents |
| `server/routes/event.ts` | 71 | ● | `02` §8 — The utility layer |
| `server/routes/experimental.ts` | 281 | ● | `07` §3 — HTTP server |
| `server/routes/file.ts` | 143 | ● | `07` §3 — HTTP server |
| `server/routes/global.ts` | 244 | ● | `02` §8 — The utility layer |
| `server/routes/mcp.ts` | 173 | ● | `07` §3 — HTTP server |
| `server/routes/permission.ts` | 55 | ● | `07` §3 — HTTP server; `07` — Contents |
| `server/routes/project.ts` | 98 | ● | `07` §3 — HTTP server; `07` — Contents |
| `server/routes/provider.ts` | 128 | ● | `07` §3 — HTTP server; `07` — Contents |
| `server/routes/pty.ts` | 176 | ● | `07` §3 — HTTP server |
| `server/routes/question.ts` | 76 | ● | `07` §3 — HTTP server; `07` — Contents |
| `server/routes/session.ts` | 737 | ● | `07` §3 — HTTP server |
| `server/routes/tui.ts` | 286 | ● | `02` §8 — The utility layer |
| `server/routes/workspace.ts` | 72 | ● | `07` §3 — HTTP server; `07` — Contents |
| `server/server.ts` | 239 | ● | `07` §3 — HTTP server; `07` — Contents |

### `src/session/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `session/compaction.ts` | 327 | ● | `04` §4 — `SessionCompaction` — context management; `04` — Contents; `02` §8 — The utility layer |
| `session/index.ts` | 584 | ● | `04` §1 — `Session` — the durable aggregate; `04` — Contents; `02` §7 — Shared conventions across modules |
| `session/instruction.ts` | 197 | ● | `04` §9 — Instruction files — `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`; `04` — Contents; `11` §2 — Secondary decisions worth knowing |
| `session/llm.ts` | 242 | ● | `05` §5 — streaming surface; `05` §3 — model resolution |
| `session/message-v2.ts` | 798 | ● | `16` §6 — `MessageV2` — the storage↔model boundary; `16` — Contents; `04` — Contents |
| `session/overflow.ts` | 15 | ● | `04` §4 — `SessionCompaction` — context management; `04` — Contents |
| `session/processor.ts` | 406 | ● | `03` §2 — the processor event table; `04` §3 |
| `session/projectors.ts` | 107 | ● | `16` §13 — Projectors — how events become rows; `16` — Contents; `04` §5 — `SyncEvent`, projectors and the write path |
| `session/prompt.ts` | 1,589 | ● | `16` §1–§4 — `resolvePart`, `createUserMessage`, `runLoop`, `shellImpl`; `03` §2 — one prompt turn |
| `session/prompt/anthropic.txt` | 107 | ● | `11` §1 — The seven decisions that shape everything |
| `session/prompt/beast.txt` | 149 | ● | `11` §1 — The seven decisions that shape everything |
| `session/prompt/build-switch.txt` | 7 | ● | `11` §2 — Secondary decisions worth knowing; `11` — Contents |
| `session/prompt/codex.txt` | 81 | ● | `11` §1 — The seven decisions that shape everything |
| `session/prompt/default.txt` | 107 | ● | `11` §1 — The seven decisions that shape everything |
| `session/prompt/gemini.txt` | 157 | ● | `11` §1 — The seven decisions that shape everything |
| `session/prompt/gpt.txt` | 109 | ● | `11` §1 — The seven decisions that shape everything |
| `session/prompt/kimi.txt` | 97 | ● | `11` §1 — The seven decisions that shape everything |
| `session/prompt/max-steps.txt` | 17 | ● | `11` §2 — Secondary decisions worth knowing; `11` — Contents |
| `session/prompt/plan.txt` | 28 | ● | `11` §2 — Secondary decisions worth knowing; `11` — Contents |
| `session/prompt/trinity.txt` | 99 | ● | `11` §1 — The seven decisions that shape everything |
| `session/retry.ts` | 93 | ● | `02` §2 — The Effect service model; `03` §2 — One user prompt → assistant turn → tool call → next step; `03` — Contents |
| `session/revert.ts` | 159 | ● | `16` §11 — Revert, unrevert, cleanup; `16` — Contents; `04` — Contents |
| `session/schema.ts` | 27 | ● | `02` §3 — The per-directory instance model; `04` — Contents |
| `session/session.sql.ts` | 62 | ● | `08` §2 — SQLite schema; `08` — Contents; `04` — Contents |
| `session/status.ts` | 79 | ● | `04` — Contents; `11` §2 — Secondary decisions worth knowing |
| `session/summary.ts` | 131 | ● | `16` §12 — Summary / diff accounting; `16` — Contents; `04` — Contents |
| `session/system.ts` | 72 | ● | `04` — Contents; `16` §9 — Config; `16` — Contents |
| `session/todo.ts` | 67 | ● | `04` — Contents; `06` §3 — The builtin tools — verified behaviour |

### `src/share/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `share/share-next.ts` | 225 | ● | `09` §6 — Sharing; `08` §6 — Flags (`src/flag/flag.ts`) — the complete environment surface; `09` — Contents |
| `share/share.sql.ts` | 13 | ● | `15` §8 — `Account` — device-flow auth for the hosted console |

### `src/shell/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `shell/shell.ts` | 96 | ● | `15` §10 — `Shell`; `15` — Contents |

### `src/skill/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `skill/discovery.ts` | 76 | ● | `09` §4 — Skills; `09` — Contents |
| `skill/index.ts` | 208 | ● | `09` §4 — Skills; `09` — Contents |

### `src/snapshot/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `snapshot/index.ts` | 557 | ● | `16` §11 — Revert, unrevert, cleanup; `16` — Contents |

### `src/storage/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `storage/db.bun.ts` | 9 | ● | `02` §3 — The per-directory instance model |
| `storage/db.ts` | 128 | ● | `08` §2 — SQLite schema; `02` §8 — The utility layer; `08` — Contents |
| `storage/json-migration.ts` | 380 | ● | `08` §2 — SQLite schema; `08` — Contents; `14` §13 — `db` and `debug` |
| `storage/schema.sql.ts` | 8 | ● | `02` §3 — The per-directory instance model |
| `storage/storage.ts` | 269 | ● | `08` §2 — SQLite schema |

### `src/sync/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `sync/event.sql.ts` | 15 | ● | `11` §3 — Technical debt, concretely |
| `sync/index.ts` | 167 | ● | `15` §6 — `SyncEvent` — the event-sourcing core; `15` — Contents |
| `sync/schema.ts` | 11 | ● | `02` §3 — The per-directory instance model; `02` — Contents |

### `src/tool/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `tool/apply_patch.ts` | 250 | ● | `06` §3 — The builtin tools — verified behaviour |
| `tool/apply_patch.txt` | 35 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/bash.ts` | 408 | ● | `06` §3 — bash tool (tree-sitter parsing); `10` §8 — known weaknesses |
| `tool/bash.txt` | 119 | ● | `06` §5 — Tool exposure surface and prompt coupling; `11` §1 — The seven decisions that shape everything |
| `tool/batch.ts` | 160 | ● | `11` §2 — Secondary decisions worth knowing |
| `tool/batch.txt` | 25 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/codesearch.ts` | 86 | ● | `02` §8 — The utility layer |
| `tool/codesearch.txt` | 14 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/edit.ts` | 564 | ● | `06` §3.4 — replacer thresholds, CRLF, per-file lock, post-format diff |
| `tool/edit.txt` | 2 | ● | `06` §5 — Tool exposure surface and prompt coupling; `11` §1 — The seven decisions that shape everything |
| `tool/external-directory.ts` | 31 | ● | `10` §1 — Trust model |
| `tool/glob.ts` | 73 | ● | `06` §3.5 — ripgrep walk, 100-result cap, mtime ordering |
| `tool/glob.txt` | 8 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/grep.ts` | 131 | ● | `16` — Contents; `16` §10 — Tools read in full this pass |
| `tool/grep.txt` | 10 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/invalid.ts` | 19 | ● | `06` §3 — The builtin tools — verified behaviour |
| `tool/lsp.ts` | 93 | ● | `16` — Contents; `16` §10 — Tools read in full this pass |
| `tool/lsp.txt` | 21 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/plan-exit.txt` | 15 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/plan.ts` | 73 | ● | `06` §3 — The builtin tools — verified behaviour |
| `tool/question.ts` | 35 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/question.txt` | 12 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/read.ts` | 291 | ● | `06` §3.2 — caps, offsets, binary sniffing, directory/image/PDF; `10` §2 — gate |
| `tool/read.txt` | 16 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/registry.ts` | 200 | ● | `06` §2 — `ToolRegistry` |
| `tool/schema.ts` | 12 | ● | `06` §3.7 — `ToolID` (branded ascending id) used for spill file names |
| `tool/skill.ts` | 96 | ● | `16` — Contents; `16` §10 — Tools read in full this pass |
| `tool/task.ts` | 145 | ● | `06` §3 — subagent spawn; `10` §2 — permission |
| `tool/task.txt` | 62 | ● | `09` §5 — Commands; `06` §5 — Tool exposure surface and prompt coupling; `09` — Contents |
| `tool/todo.ts` | 39 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/todowrite.txt` | 169 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/tool.ts` | 51 | ● | `06` §1 — The tool contract — `Tool.define`; `06` — Contents |
| `tool/truncate.ts` | 114 | ● | `06` §3.7 — head/tail caps, spill file, 7-day cleanup, agent-dependent hint |
| `tool/truncation-dir.ts` | 6 | ● | `06` §3.7 — the `tool-output` spill directory constant and its permission glob |
| `tool/webfetch.ts` | 164 | ● | `02` §8 — The utility layer; `10` §1 — Trust model; `10` §2 — The permission gate, precisely |
| `tool/webfetch.txt` | 15 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/websearch.ts` | 100 | ● | `16` — Contents; `02` §8 — The utility layer; `16` §10 — Tools read in full this pass |
| `tool/websearch.txt` | 16 | ● | `06` §5 — Tool exposure surface and prompt coupling |
| `tool/write.ts` | 95 | ● | `06` §3.3 — read-before-write, formatter, events, diagnostics budget; `10` §2 — gate |
| `tool/write.txt` | 10 | ● | `06` §5 — Tool exposure surface and prompt coupling |

### `src/util/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `util/abort.ts` | 17 | ● | `02` §8 — The utility layer |
| `util/archive.ts` | 11 | ● | `02` §8 — The utility layer |
| `util/context.ts` | 31 | ● | `02` §8 — The utility layer |
| `util/data-url.ts` | 10 | ● | `02` §3 — The per-directory instance model |
| `util/defer.ts` | 10 | ● | `02` §8 — The utility layer |
| `util/effect-http-client.ts` | 9 | ● | `02` §8 — The utility layer; `04` §9 — Instruction files — `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md` |
| `util/effect-zod.ts` | 96 | ● | `02` §8 — The utility layer |
| `util/error.ts` | 73 | ● | `02` §8 — The utility layer |
| `util/filesystem.ts` | 219 | ● | `02` §3 — The per-directory instance model |
| `util/flock.ts` | 263 | ● | `02` §8 — The utility layer; `02` — Contents; `16` §9 — Config |
| `util/fn.ts` | 21 | ● | `02` §8 — The utility layer |
| `util/format.ts` | 22 | ● | `02` §8 — The utility layer |
| `util/glob.ts` | 28 | ● | `02` §3 — The per-directory instance model; `02` — Contents |
| `util/hash.ts` | 10 | ● | `02` §8 — The utility layer |
| `util/iife.ts` | 3 | ● | `02` §8 — The utility layer |
| `util/keybind.ts` | 92 | ● | `13` §4 — Keybindings; `13` — Contents |
| `util/lazy.ts` | 20 | ● | `02` §8 — The utility layer |
| `util/locale.ts` | 81 | ● | `02` §8 — The utility layer |
| `util/log.ts` | 150 | ● | `02` §8 — The utility layer; `02` — Contents |
| `util/process.ts` | 138 | ● | `02` §2 — The Effect service model; `02` — Contents |
| `util/queue.ts` | 23 | ● | `02` §8 — The utility layer |
| `util/record.ts` | 3 | ● | `02` §8 — The utility layer |
| `util/rpc.ts` | 61 | ● | `07` §2 — the Worker RPC surface (`Rpc.client`/`Rpc.listen`) |
| `util/schema.ts` | 12 | ● | `02` §8 — The utility layer |
| `util/timeout.ts` | 14 | ● | `02` §8 — The utility layer |
| `util/token.ts` | 10 | ● | `02` §8 — The utility layer |
| `util/update-schema.ts` | 10 | ● | `02` §8 — The utility layer |
| `util/which.ts` | 16 | ● | `02` §8 — The utility layer |
| `util/wildcard.ts` | 59 | ● | `02` §3 — The per-directory instance model; `02` — Contents |

### `src/worktree/`

| Module | Lines | Coverage | Where |
|---|---:|---|---|
| `worktree/index.ts` | 410 | ● | `15` §9 — `Worktree`; `15` — Contents |

---

## 3. Modules with no coverage (the flag list)

**None.** Every one of the 446 modules is cited. The remaining tiny files are bundle-splitter and
code-generation stubs whose entire content is below — they have no behaviour to discuss beyond
the lines quoted.

### 3.1 The splitter stubs, line by line

Four files hold nothing but splitter or codegen residue. Every line actually present in the source is
quoted verbatim (line numbers as extracted):

**`index__dup3.ts` (1 line)** — bundle-root duplicate segment; the splitter emitted this module
several times and this copy holds a single init call:

```ts
1: init_filesystem();
```

**`index__dup4.ts` (1 line)** — the same, one bare import of the `os` module's `EOL`:

```ts
1: import { EOL as EOL16 } from "os";
```

**`index__dup5.ts` (4 lines)** — four init/import statements, the only four lines present:

```ts
1: await init_global();
2: import path92 from "path";
3: init_error2();
4: await init_db2();
```

**`cli/cmd/tui/util/clipboard.ts` (1 line)** — a single import statement; there is no function, no
component, and no other line in this file:

```ts
1: import { platform as platform2, release as release6 } from "os";
```

`clipboard.ts` (65 bytes, one line, verified by byte-level read this pass) is — [inferred] from the
aliased-import-only contents — codegen residue of the extraction; the real clipboard
implementation lives in `clipboard__dup2.ts` (`13` §3.10, the OSC 52 writer). The same holds for the
three bundle-root stubs: they are duplicate-segment artifacts of `index*.ts`, not distinct source
modules — [inferred]: the splitter's `__dupN` naming and the init-only contents support this; it is
an inference from the bundle's own naming scheme, not from upstream source ([verified] is the content:
the full seven lines are quoted above).

### 3.2 What used to be on this list, and where it went

Two groups accounted for 40 of the 43 rows. They are now documented rather than merely read:

- **`util/*` (20 files, 492 lines)** — `02` §8: a module-by-module table (context, timeout, abort, retry,
  token estimate, `which`, hash, lazy, queue, effect→zod, update-schema, newtype, `fn`, error, locale,
  format, record, archive, defer, iife), with the AsyncLocalStorage instance context, the `Locale.duration`
  day-arithmetic bug and the `util/fn.ts` console tracing called out.
- **`provider/sdk/copilot/**` (20 files, 2,879 lines)** — `05` §9: the vendored fork of
  `@ai-sdk/openai-compatible`/`openai`, its factory, the chat state machine (`reasoning_text`/
  `reasoning_opaque`, JSON-parse tool completion), the responses model-prefix capability table, the
  `store`-dependent conversation shape, the six vendor tool factories, and the debt in that subtree.


The flag list is empty: the last stubs were quoted line-by-line in §3.1 rather than inventoried.

## 4. Keeping this index honest

The scan is mechanical, so it can be re-run: any module added to or removed from the bundle changes the
table, and any document that starts naming a file moves that row from ◐/○ to ●. Two caveats worth
stating, because they are how such an index usually drifts:

1. A ● means the file is *named*, not that it was *understood* — `11` §4 remains the authority on reading
   depth. `cli/cmd/github__dup2.ts` (1,238 lines) is named in `14` §11 and structurally summarised, not
   read line by line.
2. A ◐ means the *subsystem* is documented; a specific file may still differ from its neighbours.
   `dialog-status.tsx` is not `dialog-mcp.tsx`, and `13` §10 treats them as one group.

