#!/usr/bin/env node
// Independent recount of the Ledger v2 partition.
//
// This is deliberately a *second implementation*: it re-reads the extracted tree,
// rebuilds the callable line union through a different traversal (`node.getChildren()`),
// counts blank/comment lines textually, and then cross-checks the checked-in ledger.
// It does not import anything from function_ledger.mjs.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let ts;
try { ts = require("typescript/lib/typescript.js"); }
catch { ts = require("/Users/mac/node_modules/typescript/lib/typescript.js"); }

const HERE = path.dirname(new URL(import.meta.url).pathname);
const MODULE_ROOT = process.env.OC_MODULES || "/tmp/oc-modules/index";
const SRC = path.join(MODULE_ROOT, "src");
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "module-manifest.json"), "utf8"));
const ledger = JSON.parse(fs.readFileSync(path.join(HERE, "function-ledger.json"), "utf8"));

const CALLABLE_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration, ts.SyntaxKind.FunctionExpression, ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration, ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor,
]);

let total = 0, callableUnion = 0, blank = 0, comment = 0;
const perModule = new Map();

for (const m of manifest) {
  total += m.lines;
  const key = m.key;
  if (!/\.(ts|tsx|js)$/.test(key)) continue;
  const file = path.join(SRC, key);
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
  const kind = key.endsWith(".tsx") ? ts.ScriptKind.TSX : key.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const marks = new Uint8Array(m.lines + 2);

  // independent traversal: getChildren() instead of forEachChild
  const walk = (node) => {
    if (CALLABLE_KINDS.has(node.kind)) {
      const s = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const e = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      for (let i = s; i <= e; i++) marks[i] = 1;
    }
    for (const c of node.getChildren(sf)) walk(c);
  };
  walk(sf);

  let mine = 0;
  const srcLines = text.split("\n").slice(0, m.lines);
  for (let i = 1; i <= m.lines; i++) {
    if (marks[i]) { mine++; continue; }
    const t = (srcLines[i - 1] ?? "").trim();
    if (!t) blank++;
    else if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) comment++;
  }
  callableUnion += mine;
  perModule.set(key, mine);
}

const problems = [];
if (total !== ledger.totals.inventoryLines) problems.push(`total ${total} != ledger ${ledger.totals.inventoryLines}`);
if (callableUnion !== ledger.totals.callableLines) problems.push(`callable union ${callableUnion} != ledger ${ledger.totals.callableLines}`);
for (const [k, v] of perModule) {
  const row = ledger.modules.find((x) => x.module === k);
  if (!row) { problems.push(`module missing from ledger: ${k}`); continue; }
  const sum = Object.values(row.counts).reduce((a, b) => a + b, 0);
  if (sum !== row.lines) problems.push(`${k}: category sum ${sum} != lines ${row.lines}`);
  if ((row.counts.callable || 0) !== v) problems.push(`${k}: callable ${row.counts.callable || 0} != recount ${v}`);
}
const globalSum = Object.values(ledger.categories).reduce((a, b) => a + b, 0);
if (globalSum !== total) problems.push(`global category sum ${globalSum} != ${total}`);

// segment integrity
let segLines = 0;
for (const s of ledger.segments) {
  segLines += s.lines;
  if (s.category === "callable") problems.push(`segment marked callable: ${s.module}:${s.start}`);
  if (s.end - s.start + 1 !== s.lines) problems.push(`segment length mismatch ${s.module}:${s.start}`);
}
if (segLines + callableUnion !== total) problems.push(`segments ${segLines} + callable ${callableUnion} != ${total}`);

console.log(JSON.stringify({
  modules: manifest.length,
  totalLines: total,
  callableUnion,
  nonCallableLines: total - callableUnion,
  blankByTextRule: blank,
  commentByTextRule: comment,
  segmentLines: segLines,
  segments: ledger.segments.length,
  problems: problems.length,
}, null, 2));
if (problems.length) {
  console.error(problems.slice(0, 40).join("\n"));
  process.exit(1);
}
console.log("RECOUNT OK: partition reconciles per module and globally; callable union independently reproduced.");
