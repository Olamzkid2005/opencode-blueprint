# Coverage pipeline scripts (`docs/opencode-blueprint/scripts/`)

The Python scripts are stdlib-only; the Node scripts use the TypeScript parser from `node_modules`. The module inventory and coverage state are checked in with them; no `/tmp` coverage script or state is required.

## Run

From `docs/opencode-blueprint/`:

```sh
python3 scripts/coverage3.py
python3 scripts/gen_index.py
node scripts/helper_atlas.mjs
node scripts/function_ledger.mjs
node scripts/deep_review.mjs
node scripts/function_ledger.mjs
node scripts/recount.mjs
node scripts/payload_dump.mjs
node scripts/dep_manifest.mjs
node scripts/type_surface.mjs
python3 scripts/gen_toc.py
python3 audit-area-anchors.py
python3 scripts/audit.py
node scripts/audit_ledger.mjs
node scripts/audit_new_docs.mjs
node scripts/audit_docs.mjs
```

From `docs/opencode-blueprint/scripts/`, the equivalent commands are:

```sh
python3 coverage3.py
python3 gen_index.py
python3 ../audit-area-anchors.py
python3 audit.py
node helper_atlas.mjs
node function_ledger.mjs
node deep_review.mjs
node function_ledger.mjs
node recount.mjs
node audit_ledger.mjs
```

The function ledger is regenerated with `node scripts/function_ledger.mjs` from `docs/opencode-blueprint/` (run `node function_ledger.mjs` on the line above if running from `scripts/`). It parses all 379 TypeScript/TSX/JS modules under `OC_MODULES` (default `/tmp/oc-modules/index`) with the TypeScript compiler API and writes the checked-in function ledger (`scripts/function-ledger.json` and `19-function-ledger.md`). It reports inventory coverage separately from AST parse coverage and exact-name blueprint evidence. Exclude generated `19` from ledger regeneration evidence, just as `12` and `17` are excluded from the inventory scan.

Both routes must report:

```text
Counter({'cited': 446}) total lines 69935
area rows: 0   strong: 0   dir-only: 0   unsupported: 0
0 suspects of 446
```

and, for the Ledger v2 stage:

```text
lineAccountedPercent: 100            behavioural 99.996 (3 blank/comment lines)
callableLines: 59615                 = 85.24% of 69,935
RECOUNT OK: partition reconciles per module and globally; callable union independently reproduced.
AUDIT OK: sampled ledger entries match the extracted source spans.
```

## Inputs

- `coverage3.py` scans the blueprint documents for module tokens and writes `coverage3.json` beside itself.
- If `OC_MODULES/src/` exists, it derives paths and line counts from that extracted tree. If it does not, it uses the checked-in `module-manifest.json`, so the saved pipeline reproduces without the ephemeral extraction.
- `gen_index.py` consumes `coverage3.json` and generates `17-module-index.md`. It owns the later `RULES`, `MANUAL`, and `WHERE_OVERRIDE` data; do not edit `17-module-index.md` by hand.
- `module-manifest.json` is the frozen inventory of all 446 module paths and extracted line counts, totaling **69,935**.
- `audit.py` and `sec.py` verify that each cited module stem occurs in its cited section. They resolve the blueprint documents relative to this folder and therefore work from either directory above.

## Ledger v2 (`19-function-ledger.md`)

`function_ledger.mjs` classifies **every** extracted line into exactly one category and asserts
the result (it throws if a module or the global total fails to reconcile):

| Category | Claimed by |
|---|---|
| `callable` | any callable AST span (nested functions counted once) |
| `module-init` | module-scope executable statement (init call, top-level await, IIFE, control statement) |
| `declaration` | `var/const/let` binding without a callable initialiser, class fields, enums |
| `import-wiring` | `import` / `export` declarations |
| `template` | the 34 `.txt` prompt/description payloads |
| `data` | the 33 `.json` theme/config payloads |
| `blank` / `comment` | whitespace-only and comment-only lines |
| `type-only` / `jsx` / `residual` | present as categories; all three are empty in this bundle (interfaces are erased, no module-scope JSX) |

Each callable additionally carries code-grounded semantics — parameters with observed reference/call/write
counts (closure-aware, computed over the body text), return expressions (including concise-arrow implicit
returns), control-flow counts, state writes, classified effects (fs/db/http/process/bus/log/lsp/mcp), calls
resolved through the extracted import graph to `in-repo module#symbol` / `external package#symbol` /
`local:symbol` / `global:symbol`, throws and Effect failures — plus a per-function list of the aspects the
transpiled artifact cannot settle, each with its specific reason.

`recount.mjs` is an independent second implementation: it re-derives the callable line union through
`node.getChildren()` (rather than `forEachChild`), counts blank/comment lines textually, and cross-checks
every module row, the global category sum, and that segments + callable lines equal 69,935 exactly.

`audit_ledger.mjs` samples 300 callables (plus every callable in the four splitter stubs) and 240 segments
with a fixed LCG seed, then re-reads the source spans and verifies that every recorded parameter, return,
throw, call, literal and write actually occurs in that span, and that each segment's category matches the
literal text of its lines. Any mismatch fails the run.

## Corroboration ladder (`19` §8)

`helper_atlas.mjs` writes `20-internal-helper-atlas.md`: a behavioral entry for every *nameable*
callable that `00`–`18` never mentions. `function_ledger.mjs` then assigns each callable exactly one tier:

| Tier | Earned by |
|---|---|
| `verbatim` | the name occurs as a whole word in `00`–`18` |
| `demangled` | the name minus its numeric de-duplication suffix occurs in `00`–`18` |
| `atlas` | a per-function row in `20` (generated documentation, counted separately for that reason) |
| `inherited` | anonymous closure inside a corroborated named callable |
| `module-documented` | nameless module wrapper/`__esm` thunk whose module prose covers it |
| `unmentioned` | named, documented nowhere — must be 0 |

The literal name-match metric cannot reach 100%: 4,248 of the 7,451 callables have an empty name in the
extracted bundle (anonymous callbacks, JSX props, `__esm` thunk bodies), so the ceiling is
3,203/7,451 = 42.99%, and every nameable callable now sits at that ceiling. 100% is reached only by the
"documented, any tier" figure, which the ledger reports separately rather than conflating with name matching.
`coverage3.py` excludes `19` and `20` from its module-token scan so the curated labels in `17` stay stable.
`audit_ledger.mjs` re-verifies the tiers against the documents (120 samples per name-bearing tier) and fails
if any name in the `verbatim`/`demangled` tiers is absent from `00`–`18`, or if any `atlas` name lacks its row.

## Deep review (`21-verified-closure-review.md`)

`deep_review.mjs` is the per-callable pass over the 4,248 callables that carry **no name of their own**
(the closures the ladder previously covered only by inheritance, plus the `__esm` module thunks). For each
one it establishes the real syntactic slot from the AST — argument #n of a named callee, JSX prop, object
property, array element, IIFE callee, class constructor, module thunk — and describes that callable's own
body: parameters, return expressions, control flow, direct calls, member writes, and (for thunks) the
ordered `init_*()` dependency list. It then re-reads the span and verifies every claim it made: span bounds,
the slot evidence in the text between the parent and the callable, a sha1 of the span, and every quoted
expression — parsed back out of the sentence exactly as it will be rendered, with longer fences when the
source itself contains a backtick, so a claim is never rewritten on its way into the document. A row is emitted as verified only when all
checks pass; the script exits non-zero otherwise.

`review-index.json` carries the same entries for `function_ledger.mjs`, which promotes the matched callables
from `inherited` / `module-documented` to `reviewed-closure` / `reviewed-thunk` and asserts that nothing is
left unmatched (`reviewMissing` must be 0). `audit_ledger.mjs` independently re-samples 200 entries, re-computes
the span sha1, confirms the row exists in `21`, and parses the quoted expressions back out of the
`review-index.json` sentence to require each one in the raw span text (a substituted or invented claim
fails; this was verified by corrupting a template-literal claim in both the index and the document).

Run order matters: `helper_atlas.mjs` → `function_ledger.mjs` → `deep_review.mjs` → `function_ledger.mjs`,
because the review consumes the tier assignment and the ledger then consumes the review.

## Literal content, dependencies and types (`22`–`24`)

Three scripts close the gaps that prose cannot: payloads, versions, and the type surface.

- `payload_dump.mjs` emits every `.txt`/`.json` module into `22-verbatim-payloads.md` unchanged, inside a fence
  longer than any backtick run it contains, with bytes, line count and sha1. `payloads.json` carries the index.
- `dep_manifest.mjs` reads the artifact's Bun install tree (`__up__/node_modules/.bun/<package>@<version>`) and
  writes `23-dependency-manifest.md`: the exact resolved version of every package, the multi-version packages, the
  runtime/builtin specifiers actually used, and a one-line install command.
- `type_surface.mjs` extracts what transpilation left behind into `24-type-surface.md`: class declarations with
  fields/methods/arity, and every runtime validator (zod, Effect `Schema`, `Schema.Class`, `$type`) with the
  literal domain it constrains. It states plainly that no `.d.ts` or static annotation exists in the artifact.

`audit_new_docs.mjs` re-reads the source for all three: payload sha1 and exact text, store directory and version
per package, and the source line behind every class and validator row. Any drift fails the run.

## Table of contents and structure (`gen_toc.py`, `audit_docs.mjs`)

`gen_toc.py` writes a marker-delimited `Contents` block into every document (`<!-- toc -->` … `<!-- /toc -->`),
listing each H2 and H3 with its GitHub anchor. It is idempotent and must run **after** the generators, because
they rewrite their documents without it.

`audit_docs.mjs` then checks the whole set structurally: heading anchors are unique and every TOC line matches a
heading exactly (text, nesting and anchor); every table is rectangular with a valid separator row; every internal
link resolves to an existing file and an existing anchor; and the totals stated in `19`, `21`, `22`, `23` and `24`
reconcile with the sidecar JSON their generators wrote. It fails the run on the first inconsistency.

`19` §8.2 lists, per callable, the 35 name occurrences that the superseded substring rule counted and the strict
rule does not, so the 2,356 → 2,321 delta is visible in the document rather than only in the generator.
