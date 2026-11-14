#!/usr/bin/env node
// Sampled audit: verify ledger entries against the extracted source lines.
//
// For a deterministic sample of callables the audit re-reads the source span and
// checks that every recorded parameter, return expression, throw expression, call,
// literal and write actually occurs inside that span, and that the span starts with
// the declaration. For non-callable segments it checks the category against the
// literal text of the lines. Any mismatch is reported and makes the run fail.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const MODULE_ROOT = process.env.OC_MODULES || "/tmp/oc-modules/index";
const SRC = path.join(MODULE_ROOT, "src");
const ledger = JSON.parse(fs.readFileSync(path.join(HERE, "function-ledger.json"), "utf8"));

// deterministic LCG so the sample is reproducible
let seed = 1337;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const cache = new Map();
function linesOf(mod) {
  if (!cache.has(mod)) {
    let text = "";
    try { text = fs.readFileSync(path.join(SRC, mod), "utf8"); } catch { /* absent */ }
    cache.set(mod, text.split("\n"));
  }
  return cache.get(mod);
}

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

function sample(list, n) {
  const out = [];
  const used = new Set();
  const want = Math.min(n, list.length);
  while (out.length < want) {
    const i = Math.floor(rand() * list.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(list[i]);
  }
  return out;
}

// ---- callables ----
const callables = ledger.entities;
const stubModules = new Set(["index__dup3.ts", "index__dup4.ts", "index__dup5.ts", "cli/cmd/tui/util/clipboard.ts"]);
const mandatory = callables.filter((e) => stubModules.has(e.module));
const picked = [...mandatory, ...sample(callables, 300)];
let checkedCalls = 0, checkedText = 0;

for (const e of picked) {
  const src = linesOf(e.module);
  const span = src.slice(e.startLine - 1, e.endLine).join("\n");
  const flat = norm(span);
  const where = `${e.module}:${e.startLine}-${e.endLine}`;
  check(e.startLine >= 1 && e.endLine >= e.startLine, `${where}: bad range`);
  check(e.endLine <= src.length, `${where}: end beyond file (${src.length})`);
  if (e.name) {
    const head = norm(src.slice(e.startLine - 1, Math.min(e.endLine, e.startLine + 1)).join(" "));
    check(flat.includes(e.name) || head.includes(e.name), `${where}: name ${e.name} not in span head`);
  }
  for (const r of e.returns) {
    if (r === "(bare return)") { check(/return[\s;}]/.test(flat), `${where}: bare return not found`); continue; }
    const probe = norm(r).slice(0, 40);
    check(flat.includes(probe), `${where}: return expr not found: ${probe}`);
    checkedText++;
  }
  for (const t of e.throws) {
    const probe = norm(t).slice(0, 40);
    check(flat.includes(probe), `${where}: throw expr not found: ${probe}`);
    checkedText++;
  }
  for (const c of e.calls) {
    const probe = norm(c).slice(0, 32);
    check(flat.includes(probe), `${where}: call not found in span: ${probe}`);
    checkedCalls++;
  }
  for (const l of e.literals) {
    const probe = norm(l).slice(0, 24);
    check(flat.includes(probe), `${where}: literal not found: ${probe}`);
    checkedText++;
  }
  for (const w of e.writes) {
    const probe = norm(w).slice(0, 28);
    check(flat.includes(probe), `${where}: write target not found: ${probe}`);
    checkedText++;
  }
  for (const p of e.paramDetail) {
    if (!p.name || p.name.length < 2) continue;
    const bare = p.name.split(/[=: ]/)[0];
    if (!/^[A-Za-z_$][\w$]*$/.test(bare)) continue;
    check(flat.includes(bare), `${where}: param ${bare} not present in signature/body`);
  }
  check(e.controlFlow.returns >= e.returns.filter((r) => r !== "(bare return)").length, `${where}: return count < recorded returns`);
  check(e.controlFlow.throws >= e.throws.length, `${where}: throw count < recorded throws`);
}

// ---- segments ----
const segPicked = sample(ledger.segments, 240);
for (const s of segPicked) {
  const src = linesOf(s.module);
  const span = src.slice(s.start - 1, s.end);
  const where = `${s.module}:${s.start}-${s.end}`;
  const firstText = (span[0] || "").trim();
  if (s.category === "blank") check(span.every((l) => !l.trim()), `${where}: blank segment has content`);
  if (s.category === "comment") check(firstText.startsWith("//") || firstText.startsWith("/*") || firstText.startsWith("*"), `${where}: comment segment does not start with a comment`);
  if (s.category === "data") check(s.module.endsWith(".json") && span.length === s.lines, `${where}: data segment not a json payload`);
  if (s.category === "template") check(s.module.endsWith(".txt"), `${where}: template segment not a .txt payload`);
  if (s.category === "import-wiring") check(/\b(import|export)\b/.test(span.join("\n")), `${where}: import-wiring segment lacks import/export`);
  if (s.category === "module-init" || s.category === "declaration") {
    // the justification quotes the enclosing AST statement; it must occur in the module text.
    const moduleText = norm(linesOf(s.module).join("\n"));
    const snippets = [...String(s.justification || "").matchAll(/`([^`]+)`/g)].map((m) => norm(m[1]).slice(0, 30)).filter((x) => x.length >= 3);
    const quotedOk = snippets.some((sn) => moduleText.includes(sn));
    // closing punctuation of a multi-line module-scope statement is also acceptable
    const punctuationOk = span.every((l) => /^[\s)\]};,]+$/.test(l));
    check(quotedOk || punctuationOk, `${where}: ${s.category} segment neither matches its quoted statement nor is closing punctuation of one`);
  }
}


// ---- corroboration ladder ----
const docsDir = path.resolve(HERE, "..");
const priorFiles = fs.readdirSync(docsDir).filter((f) => /^\d{2}-/.test(f) && !/^(12|17|19|20|21|22|23|24)-/.test(f));
const priorText = priorFiles.map((f) => fs.readFileSync(path.join(docsDir, f), "utf8")).join("\n").toLowerCase();
const atlasText = fs.readFileSync(path.join(docsDir, "20-internal-helper-atlas.md"), "utf8");
const whole = (w) => new RegExp(`(^|[^a-z0-9_$])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_$]|$)`).test(priorText);
const demangle = (n) => n.replace(/(__dup\d+)$/, "").replace(/\d+$/, "").toLowerCase();

const tierCounts = {};
for (const e of ledger.entities) tierCounts[e.corroborationTier] = (tierCounts[e.corroborationTier] || 0) + 1;
const tierSum = Object.values(tierCounts).reduce((x, y) => x + y, 0);
check(tierSum === ledger.entities.length, `tier counts ${tierSum} != entities ${ledger.entities.length}`);
check(!tierCounts.unmentioned, `unmentioned callables remain: ${tierCounts.unmentioned || 0}`);

const verbatimSample = sample(ledger.entities.filter((e) => e.corroborationTier === "verbatim"), 120);
for (const e of verbatimSample) check(whole(e.name.toLowerCase()), `verbatim tier but name not in 00-18: ${e.module}:${e.name}`);

const demSample = sample(ledger.entities.filter((e) => e.corroborationTier === "demangled"), 120);
for (const e of demSample) check(whole(demangle(e.name)), `demangled tier but base name not in 00-18: ${e.module}:${e.name}`);

const atlasSample = sample(ledger.entities.filter((e) => e.corroborationTier === "atlas"), 120);
for (const e of atlasSample) check(atlasText.includes(`| \`${e.module}\` | \`${e.name}\` |`), `atlas tier but no atlas row: ${e.module}:${e.name}`);

const namelessCount = ledger.entities.filter((e) => !e.name).length;


// ---- deep review (doc 21) verification ----
const reviewIdx = JSON.parse(fs.readFileSync(path.join(HERE, "review-index.json"), "utf8"));
const reviewedEntities = ledger.entities.filter((e) => String(e.corroborationTier).startsWith("reviewed-"));
check(reviewIdx.entries.length === reviewedEntities.length, `review entries ${reviewIdx.entries.length} != reviewed tier entities ${reviewedEntities.length}`);
check(reviewIdx.totals.verified === reviewIdx.entries.length, `unverified review entries: ${reviewIdx.entries.length - reviewIdx.totals.verified}`);
const md21 = fs.readFileSync(path.join(docsDir, "21-verified-closure-review.md"), "utf8");

// Same code-span parser as the generator: reads the quoted expressions back out of the rendered
// sentence, so they are compared with the raw span text rather than a substituted form.
function analyseQuotes(s) {
  const spans = [];
  let i = 0, balanced = true;
  while (i < s.length) {
    if (s[i] !== "`") { i++; continue; }
    let n = 0;
    while (s[i + n] === "`") n++;
    const close = s.indexOf("`".repeat(n), i + n);
    if (close < 0) { balanced = false; break; }
    let content = s.slice(i + n, close);
    if (content.startsWith(" ") && content.endsWith(" ") && content.trim()) content = content.slice(1, -1);
    spans.push(content);
    i = close + n;
  }
  return { spans, balanced };
}
const cellEsc = (s) => String(s).replace(/\|/g, "\\|");

const reviewSample = sample(reviewIdx.entries, 200);
let reviewChecks = 0;
for (const r of reviewSample) {
  const src = linesOf(r.module);
  const span = src.slice(r.start - 1, r.end).join("\n");
  const flat = norm(span);
  const sha = crypto.createHash("sha1").update(span).digest("hex").slice(0, 12);
  check(sha === r.sha1, `${r.module}:${r.start}-${r.end}: span sha1 ${sha} != recorded ${r.sha1}`);
  check(md21.includes(r.module) && md21.includes(`${r.start}–${r.end}`), `${r.module}:${r.start}-${r.end}: row missing from doc 21`);
  // the quoted expressions must be byte-faithful to the source span: parse them back out of the
  // rendered sentence and require each one to occur in the raw (whitespace-normalised) span text
  const parsed = analyseQuotes(String(r.behavior));
  check(parsed.balanced, `${r.module}:${r.start}: unbalanced code span in the rendered sentence`);
  for (const sn of parsed.spans) {
    const claim = norm(sn);
    check(flat.includes(claim), `${r.module}:${r.start}: quoted claim absent from raw span: ${claim.slice(0, 80)}`);
    reviewChecks++;
  }
  // and the row in the document must carry exactly that sentence
  if (r.kind !== "module-thunk" && r.kind !== "export-thunk") {
    // several callables can share a line range, so look for any row with this prefix that carries
    // exactly this sentence (the span key, not the line range, is the identity)
    const prefix = `| \`${r.module}\` | ${r.start}\u2013${r.end} |`;
    const rows = md21.split("\n").filter((l) => l.startsWith(prefix));
    check(rows.length > 0, `${r.module}:${r.start}-${r.end}: closure row missing from doc 21`);
    check(rows.some((l) => l.includes(cellEsc(r.behavior))), `${r.module}:${r.start}-${r.end}: doc row text differs from review-index behaviour`);
  }
}

// ---- tier arithmetic: every entity exactly once, name evidence and review evidence disjoint ----
const tierMap = {};
for (const e of ledger.entities) tierMap[e.corroborationTier] = (tierMap[e.corroborationTier] || 0) + 1;
const tierTotal = Object.values(tierMap).reduce((x, y) => x + y, 0);
check(tierTotal === ledger.entities.length, `tier counts sum to ${tierTotal}, not ${ledger.entities.length}`);
const NAME_TIERS = new Set(["verbatim", "demangled", "atlas"]);
const REVIEW_TIERS = new Set(["reviewed-closure", "reviewed-thunk"]);
check(!ledger.entities.some((e) => NAME_TIERS.has(e.corroborationTier) && REVIEW_TIERS.has(e.corroborationTier)),
  "an entity is counted as both name evidence and review evidence");
const nameTierCount = ledger.entities.filter((e) => NAME_TIERS.has(e.corroborationTier)).length;
const reviewTierCount = ledger.entities.filter((e) => REVIEW_TIERS.has(e.corroborationTier)).length;
check(nameTierCount + reviewTierCount + (tierMap.unmentioned || 0) === ledger.entities.length,
  `name ${nameTierCount} + review ${reviewTierCount} + unmentioned ${tierMap.unmentioned || 0} != ${ledger.entities.length}`);
const spanKeys = new Set(ledger.entities.map((e) => e.spanKey));
check(spanKeys.size === ledger.entities.length, `${ledger.entities.length - spanKeys.size} entities share a span key`);

// ---- 8.2 register: the 2,356 -> 2,321 delta, per callable ----
check(ledger.totals.substringOnly === 35, `substring-only register has ${ledger.totals.substringOnly} rows, expected 35`);
check(ledger.totals.corroboration.verbatim + ledger.totals.substringOnly === 2356,
  `verbatim ${ledger.totals.corroboration.verbatim} + substring-only ${ledger.totals.substringOnly} != 2356`);
const md19 = fs.readFileSync(path.join(docsDir, "19-function-ledger.md"), "utf8");
for (const r of ledger.totals.substringRegister || []) {
  check(md19.includes(`| \`${r.module}\` | ${r.lines} | \`${r.name}\` | \`${r.token}\` |`),
    `${r.module}:${r.lines} ${r.name}: register row missing from doc 19 §8.2`);
}

// ---- stubs: all seven lines must be present and categorised ----
const stubReport = [];
for (const mod of stubModules) {
  const rows = ledger.segments.filter((s) => s.module === mod);
  const total = rows.reduce((a, s) => a + s.lines, 0);
  stubReport.push({ module: mod, lines: total, categories: [...new Set(rows.map((s) => s.category))] });
  check(total === (ledger.modules.find((m) => m.module === mod)?.lines || 0), `${mod}: stub segments do not cover every line`);
}

console.log(JSON.stringify({
  corroborationTiers: tierCounts,
  namelessCallables: namelessCount,
  tiers: tierMap,
  nameTierEntities: nameTierCount,
  reviewTierEntities: reviewTierCount,
  substringOnly: ledger.totals.substringOnly,
  reviewEntries: reviewIdx.entries.length,
  reviewSamplesChecked: reviewSample.length,
  reviewClaimChecks: reviewChecks,
  sampledCallables: picked.length,
  sampledSegments: segPicked.length,
  verifiedCallText: checkedCalls,
  verifiedReturnThrowLiteralWrite: checkedText,
  stubs: stubReport,
  failures: fails.length,
}, null, 2));
if (fails.length) {
  console.error(fails.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("AUDIT OK: sampled ledger entries match the extracted source spans.");
