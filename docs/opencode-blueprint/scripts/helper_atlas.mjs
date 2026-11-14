#!/usr/bin/env node
// Generates ../20-internal-helper-atlas.md — behavioral documentation for every
// NAMEABLE callable that the prior prose (00–18) never mentions.
//
// This is deliberately a separate pass over the extracted tree: it re-parses each
// module and describes each helper from its own signature, returns, throws, calls,
// effects and control flow. It does not read function-ledger.json, so the atlas is
// not a restatement of a verdict it is later used to support.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let ts;
try { ts = require("typescript/lib/typescript.js"); }
catch { ts = require("/Users/mac/node_modules/typescript/lib/typescript.js"); }

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DOCS = path.resolve(HERE, "..");
const MODULE_ROOT = process.env.OC_MODULES || "/tmp/oc-modules/index";
const SRC = path.join(MODULE_ROOT, "src");
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "module-manifest.json"), "utf8"));
const OUT = path.join(DOCS, "20-internal-helper-atlas.md");

const priorDocs = fs.readdirSync(DOCS)
  .filter((f) => /^\d{2}-/.test(f) && !/^(12|17|19|20|21|22|23|24)-/.test(f))
  .sort();
const prior = priorDocs.map((f) => fs.readFileSync(path.join(DOCS, f), "utf8")).join("\n").toLowerCase();
const escapeRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (w) => w.length > 1 && new RegExp(`(^|[^a-z0-9_$])${escapeRe(w)}([^a-z0-9_$]|$)`).test(prior);
const demangle = (n) => n.replace(/(__dup\d+)$/, "").replace(/\d+$/, "");

const trim = (s, n = 120) => String(s).replace(/\s+/g, " ").trim().slice(0, n);
const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

function kindOf(name) {
  if (name.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (name.endsWith(".ts")) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}
const isCallable = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) ||
  ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n);

function nameOf(n, sf) {
  if (n.name) return n.name.getText(sf).replace(/^["']|["']$/g, "");
  const p = n.parent;
  if (p && ts.isVariableDeclaration(p)) return p.name.getText(sf);
  if (p && ts.isPropertyAssignment(p)) return p.name.getText(sf);
  if (p && ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) return p.left.getText(sf);
  return "";
}

function describe(node, sf) {
  const lines = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const endLine = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
  const params = (node.parameters || []).map((p) => trim(p.name.getText(sf), 40));
  const returns = [], throws = [], calls = new Set(), writes = new Set();
  let ifs = 0, loops = 0, tries = 0, awaits = 0, yields = 0;
  const visit = (n) => {
    if (ts.isIfStatement(n)) ifs++;
    if (ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)) loops++;
    if (ts.isTryStatement(n)) tries++;
    if (ts.isAwaitExpression(n)) awaits++;
    if (ts.isYieldExpression(n)) yields++;
    if (ts.isReturnStatement(n) && n.expression && returns.length < 3) returns.push(trim(n.expression.getText(sf), 90));
    if (ts.isThrowStatement(n) && throws.length < 2) throws.push(trim(n.expression.getText(sf), 90));
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const t = trim(n.expression.getText(sf), 70);
      if (t && calls.size < 8) calls.add(t);
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      (ts.isPropertyAccessExpression(n.left) || ts.isElementAccessExpression(n.left)) && writes.size < 4) {
      writes.add(trim(n.left.getText(sf), 50));
    }
    ts.forEachChild(n, (c) => { if (!isCallable(c)) visit(c); });
  };
  const body = node.body;
  if (body) {
    if (ts.isBlock(body)) for (const st of body.statements) visit(st);
    else { returns.unshift(trim(body.getText(sf), 90)); visit(body); }
  }
  const asyncKw = !!(node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) || awaits > 0;
  const flow = [ifs && `${ifs} branch${ifs > 1 ? "es" : ""}`, loops && `${loops} loop${loops > 1 ? "s" : ""}`,
    tries && "try/catch", awaits && `${awaits} await${awaits > 1 ? "s" : ""}`, yields && `${yields} yield${yields > 1 ? "s" : ""}`,
    node.asteriskToken && "generator"].filter(Boolean).join(", ") || "straight-line";
  const behavior = [
    `Takes ${params.length ? `(${params.join(", ")})` : "no arguments"}.`,
    returns.length ? `Returns ${returns.map((r) => `\`${r}\``).join(" / ")}.` : "Has no explicit return value.",
    throws.length ? `Throws ${throws.map((t) => `\`${t}\``).join(" / ")}.` : "",
    `Control flow: ${flow}.`,
    calls.size ? `Calls ${[...calls].map((c) => `\`${c}\``).join(", ")}.` : "",
    writes.size ? `Writes ${[...writes].map((w) => `\`${w}\``).join(", ")}.` : "",
    asyncKw ? "Asynchronous." : "",
  ].filter(Boolean).join(" ");
  return { lines: `${lines}–${endLine}`, params, behavior, calls: [...calls], effects: writes.size };
}

const groups = new Map();
let documented = 0;
for (const m of manifest) {
  if (!/\.(ts|tsx|js)$/.test(m.key)) continue;
  let text;
  try { text = fs.readFileSync(path.join(SRC, m.key), "utf8"); } catch { continue; }
  const sf = ts.createSourceFile(m.key, text, ts.ScriptTarget.Latest, true, kindOf(m.key));
  const rows = [];
  const visit = (n) => {
    if (isCallable(n)) {
      const nm = nameOf(n, sf);
      if (nm && !mentions(nm.toLowerCase()) && !mentions(demangle(nm).toLowerCase())) {
        rows.push({ name: nm, ...describe(n, sf) });
      }
      ts.forEachChild(n, visit);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (rows.length) {
    groups.set(m.key, rows);
    documented += rows.length;
  }
}

const out = [];
out.push("# 20 — Internal helper atlas");
out.push("");
out.push("Generated by `scripts/helper_atlas.mjs` from the extracted module tree. It documents every **nameable**");
out.push("callable that the analysis prose in `00`–`18` never mentions, so that no named function in the bundle is");
out.push("left without a behavioral description. Each entry is derived only from that function's own extracted");
out.push("signature and body: parameters, return expressions, throw expressions, control flow, direct calls and");
out.push("member writes. Nothing here is inferred from runtime behaviour.");
out.push("");
out.push("This is **generated documentation, not independent prior prose**. The ledger (`19` §8) reports it as a");
out.push("separate corroboration tier for exactly that reason.");
out.push("");
out.push(`Coverage: **${documented} named callables** in **${groups.size} modules** that the earlier documents did not name.`);
out.push("");
out.push("## Entries");
out.push("");
out.push("| Module | Callable | Lines | Behavioural description from the extracted body |");
out.push("|---|---|---|---|");
for (const [mod, rows] of [...groups.entries()].sort()) {
  for (const r of rows) {
    out.push(`| \`${mod}\` | \`${r.name}\` | ${r.lines} | ${cell(r.behavior)} |`);
  }
}
out.push("");
fs.writeFileSync(OUT, out.join("\n") + "\n");
console.log(JSON.stringify({ modules: groups.size, documented, file: OUT }, null, 2));
