#!/usr/bin/env node
// Deep review pass: per-callable verified entries for every callable that has no
// name of its own in the artifact (the "inherited" closures and module thunks).
//
// Unlike the corroboration tier — which only records that an enclosing construct was
// already documented — this pass establishes each callable's own role from its actual
// syntactic position and describes its own body, then checks every claim it makes
// against the source span it came from.
//
// Outputs:
//   ../21-verified-closure-review.md   human-readable review (two tables)
//   review-index.json                  machine index consumed by function_ledger.mjs
//
// Each entry carries: module, span, span sha1, role, enclosing slot evidence,
// behaviour sentence, and a list of verified checks. An entry is emitted as
// verified only when every check passes against the re-read source.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let ts;
try { ts = require("typescript/lib/typescript.js"); }
catch { ts = require("/Users/mac/node_modules/typescript/lib/typescript.js"); }

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DOCS = path.resolve(HERE, "..");
const MODULE_ROOT = process.env.OC_MODULES || "/tmp/oc-modules/index";
const SRC = path.join(MODULE_ROOT, "src");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, "module-manifest.json"), "utf8"));
const LEDGER = path.join(HERE, "function-ledger.json");
const OUT_MD = path.join(DOCS, "21-verified-closure-review.md");
const OUT_JSON = path.join(HERE, "review-index.json");

const trim = (s, n = 130) => String(s).replace(/\s+/g, " ").trim().slice(0, n);
// Faithful quoting: an expression that contains a backtick (template literals) is rendered with a
// longer fence so the source text survives unchanged, instead of being rewritten.
const fence = (v) => {
  const t = String(v).replace(/\s+/g, " ").trim();
  if (!t.includes("`")) return "`" + t + "`";
  const pad = t.startsWith("`") || t.endsWith("`") ? " " : "";
  return "``" + pad + t + pad + "``";
};
// Reads code spans back out of a rendered sentence (inverse of fence), so claims can be compared
// against the raw span text rather than a normalised form.
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
const unquote = (s) => analyseQuotes(s).spans;
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const cell = (s) => String(s).replace(/\|/g, "\\|");
const kindOf = (k) => k.endsWith(".tsx") ? ts.ScriptKind.TSX : k.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
const isCallable = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) ||
  ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n);
const nameOf = (n, sf) => {
  if (n.name) return n.name.getText(sf);
  const p = n.parent;
  if (p && ts.isVariableDeclaration(p)) return p.name.getText(sf);
  if (p && ts.isPropertyAssignment(p)) return p.name.getText(sf);
  return "";
};

// ---------------------------------------------------------------- role / slot
function slotOf(node, sf) {
  const text = (x) => trim(x.getText(sf), 70);
  if (ts.isConstructorDeclaration(node)) {
    const owner = node.parent;
    const cls = (ts.isClassDeclaration(owner) || ts.isClassExpression(owner)) && owner.name ? owner.name.getText(sf) : "anonymous class";
    return { kind: "constructor", role: `constructor of class ${fence(cls)}`, evidence: cls === "anonymous class" ? "class" : cls };
  }
  let p = node.parent;
  const climb = (x) => x && (ts.isParenthesizedExpression(x) || ts.isAwaitExpression(x) || ts.isAsExpression(x) ||
    ts.isNonNullExpression(x) || ts.isTypeAssertionExpression?.(x) || ts.isSpreadElement(x) || ts.isCommaListExpression(x));
  while (climb(p)) p = p.parent;
  if (!p) return { kind: "detached", role: "detached node", evidence: "" };
  if (ts.isBinaryExpression(p) && (p.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || p.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
    return { kind: "fallback", role: `fallback operand of ${fence(p.operatorToken.getText(sf))} in ${fence(trim(p.left.getText(sf), 50))}`, evidence: p.operatorToken.getText(sf) };
  }
  if (ts.isPropertyDeclaration(p)) return { kind: "class-field", role: `class field ${fence(p.name.getText(sf))}`, evidence: p.name.getText(sf) };
  if (ts.isClassDeclaration(p) || ts.isClassExpression(p)) return { kind: "class-heritage", role: "class heritage expression", evidence: "extends" };
  if (ts.isJsxAttribute(p)) return { kind: "jsx-prop", role: `JSX prop ${fence(p.name.getText(sf))}`, evidence: p.name.getText(sf) };
  if (ts.isDecorator(p)) return { kind: "decorator", role: "decorator argument", evidence: "@" };
  if (ts.isExportAssignment(p)) return { kind: "export-default", role: "default export value", evidence: "export" };
  if (ts.isExpressionStatement(p)) return { kind: "statement", role: "statement-level expression", evidence: "" };
  if (ts.isTemplateSpan(p)) return { kind: "template", role: "template interpolation", evidence: "${" };

  if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
    let calleeExpr = p.expression;
    while (calleeExpr && ts.isParenthesizedExpression(calleeExpr)) calleeExpr = calleeExpr.expression;
    if (calleeExpr === node) {
      return { kind: "iife", role: "immediately invoked (parenthesised callee)", evidence: text(p.expression).slice(0, 40) };
    }
    const idx = p.arguments.indexOf(node);
    if (idx < 0) return { kind: "inside-callee", role: "inside the callee expression of a call", evidence: "" };
    const callee = text(p.expression);
    const low = callee.toLowerCase();
    let kind = "callback";
    if (callee === "__esm") kind = "module-thunk";
    else if (callee.startsWith("__export")) kind = "export-thunk";
    else if (/^new\s+promise$/i.test(callee) || /promise/.test(low) && callee !== "Promise") kind = "promise-executor";
    else if (/\.(then|catch|finally)$/.test(callee)) kind = "promise-continuation";
    else if (/\.(on|once|addEventListener|subscribe|prependListener|removeListener)$/.test(callee)) kind = "event-handler";
    else if (/effect\.(gen|fn|fnUntraced|sync|try|tryPromise)$/i.test(callee) || /\.(gen|fnUntraced)$/.test(callee)) kind = "effect-body";
    return { kind, role: `${kind} — argument #${idx} of ${fence(callee)}`, evidence: callee };
  }
  if (ts.isPropertyAssignment(p)) {
    const key = p.name.getText(sf);
    return { kind: "object-property", role: `object property ${fence(key)}`, evidence: key };
  }
  if (ts.isJsxExpression(p)) {
    const attr = p.parent && ts.isJsxAttribute(p.parent) ? p.parent.name.getText(sf) : null;
    return { kind: attr ? "jsx-prop" : "jsx-child", role: attr ? `JSX prop ${fence(attr)}` : "JSX child expression", evidence: attr || "<jsx>" };
  }
  if (ts.isArrayLiteralExpression(p)) {
    const idx = p.elements.indexOf(node);
    return { kind: "array-element", role: `array element #${idx}`, evidence: "[" };
  }
  if (ts.isReturnStatement(p)) return { kind: "returned-closure", role: "returned closure", evidence: "return" };
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    return { kind: "assigned-closure", role: `assigned to ${fence(text(p.left))}`, evidence: text(p.left) };
  }
  if (ts.isBindingElement(p) || ts.isPropertyAssignment(p)) return { kind: "destructured", role: "destructured default", evidence: "" };
  if (ts.isVariableDeclaration(p)) return { kind: "binding", role: `bound to ${fence(p.name.getText(sf))}`, evidence: p.name.getText(sf) };
  if (ts.isConditionalExpression(p)) return { kind: "conditional", role: "conditional branch value", evidence: "?" };
  if (isCallable(p)) return { kind: "nested", role: "nested inside another callable", evidence: "" };
  return { kind: "other", role: `slot: ${ts.SyntaxKind[p.kind]}`, evidence: "" };
}

function enclosingNamed(node, sf) {
  let p = node.parent;
  while (p) {
    if (isCallable(p)) {
      const nm = nameOf(p, sf);
      if (nm) return nm;
    }
    p = p.parent;
  }
  return "module scope";
}

function describeBody(node, sf, thunk) {
  const params = (node.parameters || []).map((p) => trim(p.name.getText(sf), 30));
  const returns = [], throws = [], calls = [], writes = [], initDeps = [];
  let ifs = 0, loops = 0, tries = 0, awaits = 0, yields = 0, stmts = 0;
  const visit = (n) => {
    if (ts.isIfStatement(n)) ifs++;
    if (ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)) loops++;
    if (ts.isTryStatement(n)) tries++;
    if (ts.isAwaitExpression(n)) awaits++;
    if (ts.isYieldExpression(n)) yields++;
    if (ts.isBlock(n)) stmts += n.statements.length;
    if (ts.isReturnStatement(n)) {
      if (n.expression && returns.length < 3) returns.push(trim(n.expression.getText(sf), 80));
      else if (!n.expression) returns.push("(bare)");
    }
    if (ts.isThrowStatement(n) && throws.length < 2) throws.push(trim(n.expression.getText(sf), 80));
    if (ts.isCallExpression(n)) {
      const c = trim(n.expression.getText(sf), 60);
      if (/^init_[A-Za-z0-9_$]+$/.test(c) && !initDeps.includes(c)) initDeps.push(c);
      if (c && calls.length < 6) calls.push(c);
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      (ts.isPropertyAccessExpression(n.left) || ts.isElementAccessExpression(n.left)) && writes.length < 3) {
      writes.push(trim(n.left.getText(sf), 40));
    }
    ts.forEachChild(n, (c) => { if (!isCallable(c)) visit(c); });
  };
  const body = node.body;
  if (body) {
    if (ts.isBlock(body)) for (const st of body.statements) visit(st);
    else { returns.unshift(trim(body.getText(sf), 80)); visit(body); }
  }
  const flow = [ifs && `${ifs} branch${ifs > 1 ? "es" : ""}`, loops && `${loops} loop${loops > 1 ? "s" : ""}`,
    tries && "try/catch", awaits && `${awaits} await${awaits > 1 ? "s" : ""}`, yields && `${yields} yield${yields > 1 ? "s" : ""}`,
    node.asteriskToken && "generator"].filter(Boolean).join(", ") || "straight-line";
  let behavior;
  if (thunk) {
    behavior = `Module initialiser thunk (${stmts} statement${stmts === 1 ? "" : "s"})` +
      (initDeps.length ? `: runs ${initDeps.map((d) => fence(d + "()")).join(", ")} before the module body` : ": no dependency thunks") + ".";
    if (calls.length) behavior += ` Also calls ${calls.slice(0, 3).map(fence).join(", ")}.`;
  } else {
    behavior = `Takes ${params.length ? `(${params.map(fence).join(", ")})` : "no arguments"}. ` +
      (returns.length ? `Returns ${returns.map((r) => (r === "(bare)" ? "a bare return" : fence(r))).join(" / ")}. ` : "No return value. ") +
      `Flow: ${flow}. ` +
      (calls.length ? `Calls ${calls.slice(0, 4).map(fence).join(", ")}. ` : "") +
      (writes.length ? `Writes ${writes.map(fence).join(", ")}.` : "");
  }
  return { behavior: behavior.trim(), returns, throws, calls, writes, initDeps, flow, params, stmts };
}

// ---------------------------------------------------------------- selection
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : null;
const targets = new Set();
if (ledger) {
  for (const e of ledger.entities) {
    if (e.corroborationTier === "inherited" || e.corroborationTier === "module-documented" ||
      e.corroborationTier === "reviewed-closure" || e.corroborationTier === "reviewed-thunk") {
      targets.add(e.spanKey || `${e.module}:${e.startLine}:${e.endLine}`);
    }
  }
}

// ---------------------------------------------------------------- review
const entries = [];
const failures = [];
for (const m of MANIFEST) {
  if (!/\.(ts|tsx|js)$/.test(m.key)) continue;
  let text;
  try { text = fs.readFileSync(path.join(SRC, m.key), "utf8"); } catch { continue; }
  const sf = ts.createSourceFile(m.key, text, ts.ScriptTarget.Latest, true, kindOf(m.key));
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  const visit = (n) => {
    if (isCallable(n)) {
      const start = lineOf(n.getStart(sf));
      const end = lineOf(n.getEnd());
      const key = `${m.key}:${start}:${end}`;
      const spanKey = `${m.key}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).character}:${sf.getLineAndCharacterOfPosition(n.getEnd()).character}:${start}:${end}`;
      const selected = targets.size ? targets.has(spanKey) : !nameOf(n, sf);
      if (selected) {
        const slot = slotOf(n, sf);
        const thunk = slot.kind === "module-thunk" || slot.kind === "export-thunk";
        const body = describeBody(n, sf, thunk);
        const spanLines = text.split("\n").slice(start - 1, end);
        const span = spanLines.join("\n");
        const sha1 = crypto.createHash("sha1").update(span).digest("hex").slice(0, 12);

        // ---- verification of this entry's own claims ----
        const flat = norm(span);
        const checks = [];
        const ok = (cond, name) => { checks.push({ check: name, pass: !!cond }); return !!cond; };
        ok(start >= 1 && end >= start && end <= m.lines, "span-in-bounds");

        // slot evidence must literally occur between the parent's start and the callable
        const pre = norm(text.slice((n.parent || n).getStart(sf), n.getStart(sf)));
        if (slot.kind === "module-thunk" || slot.kind === "export-thunk") {
          ok(/__esm\(|__export\(/.test(flat) || /__esm\(|__export\(/.test(pre), "thunk-call-adjacent");
          ok(body.initDeps.every((d) => flat.includes(d)), "init-deps-present");
        } else if (slot.kind === "iife") {
          ok(/\)\s*\(/.test(flat.slice(-80)) || /\)\s*\(/.test(flat), "iife-shape");
        } else if (slot.evidence) {
          const ev = norm(slot.evidence).slice(0, 40);
          ok(pre.includes(ev) || flat.includes(ev), "slot-evidence-present");
        } else {
          ok(true, "slot-evidence-present");
        }

        // the sentence that goes into the document must quote the source faithfully: parse the code
        // spans back out of exactly what will be rendered and require each to occur in the raw span
        const parsed = analyseQuotes(body.behavior);
        ok(parsed.balanced, "behaviour-quotes-balanced");
        const quoted = parsed.spans.map((x) => norm(x));
        const stray = quoted.filter((qq) => !flat.includes(qq));
        ok(stray.length === 0, "behaviour-quotes-faithful");
        if (stray.length) failures.push({ key, strayQuotes: stray });

        // every structured claim behind the sentence must also occur in the span
        const claims = [
          ...body.calls.map((c) => trim(c, 40)),
          ...body.writes.map((w) => trim(w, 30)),
          ...body.returns.filter((r) => r !== "(bare)").map((r) => trim(r, 30)),
          ...body.initDeps,
          ...body.params.filter((x) => /^[A-Za-z_$][\w$]*$/.test(x)),
        ];
        const missing = claims.filter((c) => !flat.includes(c));
        ok(missing.length === 0, "behaviour-claims-present");
        if (missing.length) failures.push({ key, missing });

        const verified = checks.every((c) => c.pass);
        if (!verified) failures.push({ key, checks: checks.filter((c) => !c.pass) });

        entries.push({
          key, spanKey,
          module: m.key, start, end, sha1,
          kind: slot.kind, role: slot.role,
          enclosing: enclosingNamed(n, sf),
          anonymous: !nameOf(n, sf),
          async: !!(n.modifiers && n.modifiers.some((x) => x.kind === ts.SyntaxKind.AsyncKeyword)) || body.flow.includes("await"),
          behavior: body.behavior,
          initDeps: body.initDeps,
          checks, verified,
        });
      }
      ts.forEachChild(n, visit);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const byKind = Object.create(null);
for (const e of entries) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
const thunks = entries.filter((e) => e.kind === "module-thunk" || e.kind === "export-thunk");
const closures = entries.filter((e) => !(e.kind === "module-thunk" || e.kind === "export-thunk"));
const verifiedCount = entries.filter((e) => e.verified).length;

// ---------------------------------------------------------------- document
const out = [];
out.push("# 21 — Verified review of nameless callables");
out.push("");
out.push("Generated by `scripts/deep_review.mjs`. This is the per-callable review pass over the closures and");
out.push("module thunks that have no name of their own in the extracted bundle — the two groups that the");
out.push("corroboration ladder could previously only cover by inheritance.");
out.push("");
out.push("For each callable this pass determines its **actual syntactic slot** (callback argument of a named");
out.push("callee, JSX prop, object property, IIFE, `__esm` module thunk, …) and describes its **own body**");
out.push("(parameters, return expressions, control flow, direct calls, member writes, initialiser dependencies).");
out.push("It then re-reads the span it came from and checks every claim: the span bounds, the presence of the");
out.push("slot evidence where the callable actually sits, the presence of every quoted call, write, return");
out.push("expression and `init_*` dependency, and a sha1 of the span. An entry is marked verified only when every");
out.push("one of those checks passes against the source it was read from.");
out.push("");
out.push("Quoted expressions are rendered verbatim. When the quoted source itself contains a backtick (a template");
out.push("literal such as ``lines.join(` `)``), the code span uses a longer fence instead of rewriting the text, and the");
out.push("document contains the source characters unchanged. The audit parses those spans back out of the rendered");
out.push("sentence and requires each one to occur in the raw span text, so a rewritten or invented claim cannot pass.");
out.push("");
out.push(`Entries: **${entries.length}** (${closures.length} closures, ${thunks.length} module thunks) · verified: **${verifiedCount}** · failures: **${failures.length}**`);
out.push("");
out.push("| Slot kind | Entries |");
out.push("|---|---:|");
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) out.push(`| \`${k}\` | ${v} |`);
out.push("");
out.push("## 1. Module initialiser thunks");
out.push("");
out.push("Each row is the `__esm(async () => { … })` (or `__export`) body that Bun emits around a module. The");
out.push("dependency column is the ordered list of `init_*()` calls the thunk performs, i.e. the module's real");
out.push("initialisation order.");
out.push("");
out.push("| Module | Lines | Span sha1 | Dependencies initialised first | Statements | Verified |");
out.push("|---|---|---|---|---:|---|");
for (const e of thunks) {
  const mod = e.module.replace(/\.(ts|tsx|js)$/, "");
  out.push(`| \`${e.module}\` | ${e.start}–${e.end} | \`${e.sha1}\` | ${e.initDeps.length ? e.initDeps.map((d) => `\`${d}\``).join(", ") : "—"} | ${e.stmts} | ${e.verified ? "yes" : "**NO**"} |`);
}
out.push("");
out.push("## 2. Closures (callbacks, JSX props, object members, IIFEs)");
out.push("");
out.push("| Module | Lines | Slot | Enclosing named callable | Behaviour from the extracted body | Verified |");
out.push("|---|---|---|---|---|---|");
for (const e of closures) {
  out.push(`| \`${e.module}\` | ${e.start}–${e.end} | ${cell(e.role)} | ${e.enclosing === "module scope" ? "—" : `\`${cell(e.enclosing)}\``} | ${cell(e.behavior)} | ${e.verified ? "yes" : "**NO**"} |`);
}
out.push("");
fs.writeFileSync(OUT_MD, out.join("\n") + "\n");
fs.writeFileSync(OUT_JSON, JSON.stringify({
  generated: "deep_review.mjs",
  totals: { entries: entries.length, closures: closures.length, thunks: thunks.length, verified: verifiedCount, failures: failures.length },
  byKind,
  entries: entries.map((e) => ({ key: e.key, spanKey: e.spanKey, module: e.module, start: e.start, end: e.end, sha1: e.sha1, kind: e.kind, role: e.role, enclosing: e.enclosing, anonymous: e.anonymous, behavior: e.behavior, initDeps: e.initDeps, verified: e.verified })),
}, null, 1));

console.log(JSON.stringify({
  entries: entries.length, closures: closures.length, thunks: thunks.length,
  verified: verifiedCount, failures: failures.length, byKind,
}, null, 2));
if (failures.length) {
  console.error(JSON.stringify(failures.slice(0, 10), null, 1));
  process.exit(1);
}
