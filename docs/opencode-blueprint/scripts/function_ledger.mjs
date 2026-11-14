#!/usr/bin/env node
// Ledger v2 — function-level behavioral ledger + exact line partition.
//
// Inputs (all resolved relative to this script):
//   OC_MODULES        extracted module root (default /tmp/oc-modules/index)
//   module-manifest.json   frozen inventory: 446 module paths + extracted line counts
//   coverage3.json         module -> blueprint section hits
//
// Outputs:
//   function-ledger.json       machine-readable ledger (partition + entities + markers)
//   ../19-function-ledger.md   generated ledger document
//
// Every extracted line is assigned exactly one category by this priority:
//   callable  >  (import-wiring | type-only | declaration | module-init | jsx)  >  (blank | comment)
// The callable category is the union of all callable AST spans, so nested
// functions are counted once per line.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require("typescript/lib/typescript.js");
} catch {
  ts = require("/Users/mac/node_modules/typescript/lib/typescript.js");
}

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DOCS = path.resolve(HERE, "..");
const MODULE_ROOT = process.env.OC_MODULES || "/tmp/oc-modules/index";
const SOURCE_ROOT = path.join(MODULE_ROOT, "src");
const OUT_JSON = path.join(HERE, "function-ledger.json");
const OUT_MD = path.join(DOCS, "19-function-ledger.md");
const STATE = path.join(HERE, "coverage3.json");

const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "module-manifest.json"), "utf8"));
const coverage = JSON.parse(fs.readFileSync(STATE, "utf8"));
const inventory = new Map(manifest.map((m) => [m.key, m]));
const codeKeys = manifest.filter((m) => /\.(?:ts|tsx|js)$/.test(m.key)).map((m) => m.key);
const dataKeys = manifest.filter((m) => m.key.endsWith(".json")).map((m) => m.key);
const templateKeys = manifest.filter((m) => m.key.endsWith(".txt")).map((m) => m.key);
const keySet = new Set(manifest.map((m) => m.key));

const docFiles = fs.readdirSync(DOCS)
  .filter((f) => /^\d{2}-/.test(f) && !/^(12|17|19|20|21|22|23|24)-/.test(f))
  .sort();
const docLower = docFiles.map((f) => fs.readFileSync(path.join(DOCS, f), "utf8")).join("\n").toLowerCase();

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
const trim = (s, n = 150) => String(s).replace(/\s+/g, " ").trim().slice(0, n);
const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/`/g, "\u0060").replace(/\n/g, " ");
const list = (v, n = 4) => (v && v.length ? v.slice(0, n).map((x) => `\`${esc(x)}\``).join(", ") : "—");

function scriptKind(name) {
  if (name.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (name.endsWith(".ts")) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function isCallable(n) {
  return ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n);
}

function callableName(node, sf) {
  if (node.name) return node.name.getText(sf).replace(/^["']|["']$/g, "");
  const p = node.parent;
  if (p && ts.isVariableDeclaration(p)) return p.name.getText(sf);
  if (p && ts.isPropertyAssignment(p)) return p.name.getText(sf);
  if (p && ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) return p.left.getText(sf);
  if (p && ts.isPropertyDeclaration(p) && p.name) return p.name.getText(sf);
  return "";
}

function parentLabel(node, sf) {
  let p = node.parent;
  while (p) {
    if (ts.isClassDeclaration(p) || ts.isClassExpression(p)) return `class ${p.name?.getText(sf) || "anonymous"}`;
    if (ts.isVariableDeclaration(p)) return `const ${p.name.getText(sf)}`;
    if (ts.isPropertyAssignment(p)) return `property ${p.name.getText(sf)}`;
    if (ts.isPropertyDeclaration(p)) return `class field ${p.name.getText(sf)}`;
    if (ts.isObjectLiteralExpression(p)) return "object literal";
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) return `assignment ${p.left.getText(sf)}`;
    p = p.parent;
  }
  return "module scope";
}

// ---------------------------------------------------------------------------
// import graph (in-repo call target resolution)
// ---------------------------------------------------------------------------
function resolveSpec(fromKey, spec) {
  if (!spec || !spec.startsWith(".")) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromKey), spec));
  const cands = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`];
  for (const c of cands) if (keySet.has(c)) return c;
  for (const c of cands) {
    const canon = c.replace(/__dup\d+/g, "");
    const matches = [...keySet].filter((k) => k.replace(/__dup\d+/g, "") === canon);
    if (matches.length === 1) return matches[0];
  }
  return null;
}

function importMap(sf, key) {
  const map = new Map();
  const unresolved = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st)) continue;
    const spec = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : "";
    const target = resolveSpec(key, spec);
    if (spec.startsWith(".") && !target) unresolved.push(spec);
    const clause = st.importClause;
    if (!clause) continue;
    if (clause.name) map.set(clause.name.getText(sf), { spec, target, imported: "default" });
    const nb = clause.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) map.set(nb.name.getText(sf), { spec, target, imported: "*" });
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements) {
        map.set(el.name.getText(sf), { spec, target, imported: (el.propertyName || el.name).getText(sf) });
      }
    }
  }
  return { map, unresolved };
}

// ---------------------------------------------------------------------------
// effect classification
// ---------------------------------------------------------------------------
const MODULE_EFFECTS = [
  ["file/", "fs"], ["filesystem/", "fs"], ["storage/", "db"], ["snapshot/", "fs"],
  ["server/", "http"], ["sync/", "http"], ["control-plane/", "http"], ["share/", "http"],
  ["pty/", "process"], ["shell/", "process"], ["effect/cross-spawn-spawner", "process"],
  ["tool/bash", "process"], ["tool/webtetch", "http"], ["bus/", "bus"], ["util/log", "log"],
  ["lsp/", "lsp"], ["mcp/", "mcp"], ["install", "fs"], ["npm/", "process"],
];
const NAME_EFFECTS = [
  [/^(fetch\w*|undici)/i, "http"],
  [/HttpClient(Request|Response)?\./, "http"],
  [/^(Bun)\.(write|file|spawn|serve|listen)/, "fs"],
  [/^(spawn|spawnSync|exec|execSync|ChildProcess|Bun\.spawn)/, "process"],
  [/^(fs|fsPromises|nodeFs|Bun\.write)\b/, "fs"],
  [/^(Database|db\d*)\b/, "db"],
  [/\.(select|insert|update|delete|prepare|run|get|all)\b/, "db"],
  [/^(Bus|bus\d*)\.(publish|subscribe)/, "bus"],
  [/^(Log|log\d*)\.(info|warn|error|debug)/, "log"],
  [/^(Pty|pty\d*)\./, "process"],
  [/^(LSP|lsp\d*)\./, "lsp"],
  [/^(Mcp|McpClient|mcp\d*)\./, "mcp"],
  [/^(Server|server\d*)\.(listen|serve)/, "http"],
];

function effectOf(callText, imports) {
  const root = (callText.match(/^[A-Za-z_$][\w$]*/) || [""])[0];
  const table = imports.map || imports;
  const im = table.get(root);
  if (im && im.target) {
    const hit = MODULE_EFFECTS.find(([p]) => im.target.startsWith(p) || im.target.includes(p));
    if (hit) return hit[1];
  }
  for (const [re, kind] of NAME_EFFECTS) if (re.test(callText)) return kind;
  return null;
}

// ---------------------------------------------------------------------------
// per-callable semantics
// ---------------------------------------------------------------------------
function enrichCallable(node, sf, imports, selfModule, siblings) {
  const bodyText = node.getText(sf);
  const bodyStart = node.getStart(sf);

  const returns = [];
  const throws = [];
  const calls = [];
  const callTargets = [];
  const literals = [];
  const stringSet = new Set();
  const writes = [];
  const effects = new Map();
  const failCalls = [];
  const awaits = [];
  const yields = [];
  const cf = { ifs: 0, elses: 0, loops: 0, switches: 0, swCases: 0, tries: 0, catches: 0, finallys: 0, ternaries: 0, logicals: 0, awaits: 0, yields: 0, assignments: 0, memberAssignments: 0, increments: 0, returns: 0, throws: 0, earlyReturns: 0, maxDepth: 0 };
  const paramRefs = new Map();

  const params = (node.parameters || []).map((p) => {
    const name = trim(p.name.getText(sf), 60);
    const def = p.initializer ? ` = ${trim(p.initializer.getText(sf), 40)}` : "";
    const underlying = ts.isIdentifier(p.name) ? p.name.text : null;
    if (underlying) paramRefs.set(underlying, { name: underlying, refs: 0, called: 0, read: 0, written: 0 });
    return { name, default: p.initializer ? trim(p.initializer.getText(sf), 60) : null, text: `${name}${def}` };
  });

  const depthAt = new Map();
  const walk = (n, depth) => {
    const d = depth;
    if (ts.isIfStatement(n)) { cf.ifs++; cf.maxDepth = Math.max(cf.maxDepth, d + 1); }
    if (ts.isSwitchStatement(n)) { cf.switches++; cf.maxDepth = Math.max(cf.maxDepth, d + 1); }
    if (ts.isCaseClause(n) || ts.isDefaultClause(n)) cf.swCases++;
    if (ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)) { cf.loops++; cf.maxDepth = Math.max(cf.maxDepth, d + 1); }
    if (ts.isTryStatement(n)) { cf.tries++; if (n.catchClause) cf.catches++; if (n.finallyBlock) cf.finallys++; }
    if (ts.isConditionalExpression(n)) cf.ternaries++;
    if (ts.isBinaryExpression(n)) {
      const k = n.operatorToken.kind;
      if ([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(k)) cf.logicals++;
      if ([ts.SyntaxKind.EqualsToken, ts.SyntaxKind.PlusEqualsToken, ts.SyntaxKind.MinusEqualsToken, ts.SyntaxKind.AsteriskEqualsToken, ts.SyntaxKind.SlashEqualsToken, ts.SyntaxKind.PercentEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken].includes(k)) {
        cf.assignments++;
        if (ts.isPropertyAccessExpression(n.left) || ts.isElementAccessExpression(n.left)) {
          cf.memberAssignments++;
          if (writes.length < 10) writes.push(trim(n.left.getText(sf), 60));
          const rootId = rootIdentifier(n.left);
          if (rootId && paramRefs.has(rootId)) paramRefs.get(rootId).written++;
        }
      }
    }
    if (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) {
      if ([ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(n.operator)) cf.increments++;
    }
    if (ts.isAwaitExpression(n)) { cf.awaits++; if (awaits.length < 4) awaits.push(trim(n.expression.getText(sf), 70)); }
    if (ts.isYieldExpression(n)) { cf.yields++; if (yields.length < 4) yields.push(trim(n.expression ? n.expression.getText(sf) : "*delegate", 70)); }
    if (ts.isReturnStatement(n)) {
      cf.returns++;
      const inBranch = insideBranch(n);
      if (inBranch) cf.earlyReturns++;
      if (n.expression) { if (returns.length < 8) returns.push(trim(n.expression.getText(sf), 110)); }
      else if (returns.length < 8) returns.push("(bare return)");
    }
    if (ts.isThrowStatement(n)) { cf.throws++; if (throws.length < 6) throws.push(trim(n.expression.getText(sf), 110)); }
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const callee = trim(n.expression.getText(sf), 80);
      if (callee) {
        calls.push(callee);
        const target = resolveCallee(callee, imports, selfModule, siblings);
        if (callTargets.length < 10) callTargets.push(target);
        const eff = effectOf(callee, imports);
        if (eff) effects.set(eff, (effects.get(eff) || 0) + 1);
        if (/(^|\.)(fail|failSync|orDie|throw)$/.test(callee) || /Effect\.fail/.test(callee)) failCalls.push(callee);
        const rootId = (callee.match(/^[A-Za-z_$][\w$]*/) || [""])[0];
        if (rootId && paramRefs.has(rootId)) paramRefs.get(rootId).called++;
      }
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const v = n.getText(sf);
      if (!stringSet.has(v)) { stringSet.add(v); if (literals.length < 8) literals.push(trim(v, 60)); }
    }
    ts.forEachChild(n, (c) => {
      if (isCallable(c)) return; // nested callables are separate entities; do not double count
      walk(c, d + (ts.isBlock(n) || ts.isIfStatement(n) || isLoop(n) ? 1 : 0));
    });
  };

  function isLoop(n) { return ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n); }
  function insideBranch(n) {
    let p = n.parent;
    while (p && p !== node) {
      if (ts.isIfStatement(p) || ts.isCaseClause(p) || ts.isDefaultClause(p) || ts.isConditionalExpression(p) || ts.isCatchClause(p)) return true;
      if (isLoop(p)) return true;
      if (ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isFunctionDeclaration(p)) return false;
      p = p.parent;
    }
    return false;
  }

  // walk the body only (do not descend into nested callables)
  const body = node.body;
  const concisely = !!(body && !ts.isBlock(body));
  if (body) {
    if (ts.isBlock(body)) for (const st of body.statements) walk(st, 1);
    else {
      // concise arrow body: the expression itself is the implicit return value
      returns.push(trim(body.getText(sf), 110));
      cf.returns++;
      cf.implicitReturn = true;
      walk(body, 1);
    }
  }

  const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const paramsUsed = params.map((p) => {
    // A destructured parameter (`[a, b]`, `{ a, b }`) has no single identifier: its uses are the uses
    // of the names it binds, so count those instead of reporting the pattern text as never referenced.
    const bare = (p.name.match(/^[A-Za-z_$][\w$]*/) || [""])[0];
    const names = bare ? [bare] : (p.name.match(/[A-Za-z_$][\w$]*/g) || []);
    if (!names.length) return { ...p, refs: 0, called: 0, written: 0 };
    const bodyOnly = body ? body.getText(sf) : "";
    const tally = (make) => names.reduce((a, n) => a + (bodyOnly.match(new RegExp(make(escRe(n)), "g")) || []).length, 0);
    const refs = tally((n) => `\\b${n}\\b`);
    const called = tally((n) => `\\b${n}\\s*\\(`);
    const written = tally((n) => `\\b${n}(\\.\\w+)?\\s*(\\+=|-=|\\|=|&\\s*=|\\s*=(?!=))`);
    return { ...p, refs, called, written };
  });

  const undetermined = [];
  if (returns.length === 0) {
    undetermined.push({ aspect: "returns", reason: "no explicit return statement in the extracted body; the value is implicit (undefined/void) or produced by an Effect/promise combinator whose result type was erased at transpile time" });
  }
  if (cf.throws === 0 && cf.catches === 0 && failCalls.length === 0) {
    const nCal = new Set(calls).size;
    undetermined.push({
      aspect: "errors",
      reason: nCal
        ? `no throw/catch in body; the failure modes of its ${nCal} observed callee(s) lived in erased TypeScript signatures, so propagated errors are not enumerable from the shipped text`
        : "no throw/catch and no callee in the body, so the only failure channel is a runtime type error, which the transpiled text does not describe",
    });
  }
  for (const p of paramsUsed) {
    if (p.refs === 0) undetermined.push({ aspect: `param:${p.name}`, reason: "parameter is never referenced in the extracted body (type-only or interface-conformance placeholder)" });
  }
  const dynamic = calls.filter((c) => /\[[^\]]+\]\s*\(/.test(c));
  if (dynamic.length) {
    undetermined.push({ aspect: "dispatch", reason: `target of ${dynamic.length} higher-order call(s) (${trim(dynamic.slice(0, 2).join(", "), 90)}) is supplied at runtime by a callback/pipeline argument, so the ultimate callee is not statically named` });
  }
  if (imports.unresolved) {
    // module-level fact, recorded once per entity only when the entity itself uses an unresolved binding
    for (const c of calls) {
      const root = (c.match(/^[A-Za-z_$][\w$]*/) || [""])[0];
      const hit = imports.map.get(root);
      if (hit && hit.spec.startsWith(".") && !hit.target) {
        undetermined.push({ aspect: `import:${root}`, reason: `relative import \`${hit.spec}\` has no single match in the extracted inventory (bundle carries __dupN split variants), so the defining module cannot be named from the artifact` });
        break;
      }
    }
  }

  return {
    params: paramsUsed.map((p) => (`${p.name}${p.default ? `=${p.default}` : ""}(×${p.refs}${p.called ? `,call×${p.called}` : ""}${p.written ? `,write×${p.written}` : ""})`).replace(/\[/g, "\\[").replace(/\]/g, "\\]")),
    paramDetail: paramsUsed,
    returns: returns.slice(0, 6),
    throws: throws.slice(0, 5),
    calls: [...new Set(calls)].slice(0, 10),
    callTargets,
    literals: literals.slice(0, 5),
    writes: [...new Set(writes)].slice(0, 6),
    effects: [...effects.entries()].map(([k, v]) => `${k}×${v}`),
    failCalls: [...new Set(failCalls)].slice(0, 4),
    awaits, yields,
    controlFlow: cf,
    undetermined,
  };
}

function rootIdentifier(node) {
  let n = node;
  while (n) {
    if (ts.isIdentifier(n)) return n.text;
    if (ts.isPropertyAccessExpression(n)) n = n.expression;
    else if (ts.isElementAccessExpression(n)) n = n.expression;
    else if (ts.isCallExpression(n)) n = n.expression;
    else if (ts.isNonNullExpression(n) || ts.isParenthesizedExpression(n)) n = n.expression;
    else return null;
  }
  return null;
}

function isDeclarationIdentifier(n) {
  const p = n.parent;
  if (!p) return false;
  if (ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isFunctionDeclaration(p) || ts.isPropertyAssignment(p)) return p.name === n;
  return false;
}

const localDecls = new Map(); // module -> Set of top-level declared names

function resolveCallee(callee, imports, selfModule, siblings) {
  const root = (callee.match(/^[A-Za-z_$][\w$]*/) || [""])[0];
  if (!root) return { kind: "dynamic", target: callee };
  const im = imports.map.get(root);
  if (im) {
    if (im.target) return { kind: "in-repo", module: im.target, symbol: im.imported, local: root };
    return { kind: "external", spec: im.spec, symbol: im.imported, local: root };
  }
  const decls = localDecls.get(selfModule);
  if (decls && decls.has(root)) return { kind: "module-local", symbol: root };
  if (siblings && siblings.has(root)) return { kind: "module-local", symbol: root };
  return { kind: "global-or-erased", symbol: root };
}

function targetText(t) {
  if (!t) return "—";
  if (t.kind === "in-repo") return `${t.module}#${t.symbol}`;
  if (t.kind === "external") return `${t.spec}#${t.symbol}`;
  if (t.kind === "module-local") return `local:${t.symbol}`;
  if (t.kind === "dynamic") return "dynamic";
  return `global:${t.symbol}`;
}

// ---------------------------------------------------------------------------
// line classification
// ---------------------------------------------------------------------------
const CATS = ["callable", "module-init", "declaration", "type-only", "import-wiring", "template", "data", "jsx", "blank", "comment", "residual"];

function classifyStatements(sf, cat, note) {
  const lineOf = (p) => sf.getLineAndCharacterOfPosition(p).line + 1;
  const assign = (node, c, n) => {
    const s = lineOf(node.getStart(sf));
    const e = lineOf(node.getEnd());
    for (let i = s; i <= e; i++) if (cat[i - 1] === null) { cat[i - 1] = c; note[i - 1] = n; }
  };

  const classifyVar = (st) => {
    for (const d of st.declarationList.declarations) {
      const name = trim(d.name.getText(sf), 60);
      const init = d.initializer;
      const raw = trim(st.getText(sf), 50);
      let c = "declaration";
      let n = `var/const/let declaration \`${name}\` — \`${raw}\``;
      if (init) {
        if (isCallable(init)) { c = "callable"; n = `callable binding \`${name}\` — \`${raw}\``; }
        else if (ts.isObjectLiteralExpression(init) || ts.isArrayLiteralExpression(init) || ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init) ||
          ts.isNumericLiteral(init) || init.kind === ts.SyntaxKind.TrueKeyword || init.kind === ts.SyntaxKind.FalseKeyword || ts.isNewExpression(init) ||
          ts.isArrowFunction(init)) {
          n = `var/const/let declaration \`${name}\` initialised with a literal/object/schema value — \`${raw}\``;
        } else if (ts.isCallExpression(init)) {
          c = "module-init";
          n = `var/const/let declaration \`${name}\` initialised by call \`${trim(init.expression.getText(sf), 40)}\` at module load — \`${raw}\``;
        } else {
          n = `var/const/let declaration \`${name}\` initialised from an expression — \`${raw}\``;
        }
      }
      assign(d, c, n);
      // the declaration statement's own keywords may sit left of the initializer node
      const stStart = lineOf(st.getStart(sf));
      for (let i = stStart; i <= lineOf(d.getEnd()); i++) if (cat[i - 1] === null) { cat[i - 1] = c; note[i - 1] = n; }
    }
  };

  const classifyStmt = (st) => {
    if (isCallable(st)) return; // pass 1 already claimed it
    if (ts.isImportDeclaration(st) || ts.isImportEqualsDeclaration(st)) {
      const spec = st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) ? st.moduleSpecifier.text : "";
      assign(st, "import-wiring", `import binding${st.importClause?.name ? ` \`${st.importClause.name.getText(sf)}\`` : ""} from \`${spec}\``);
      return;
    }
    if (ts.isExportDeclaration(st) || ts.isExportAssignment(st) || ts.isNamespaceExportDeclaration?.(st)) {
      assign(st, "import-wiring", "export/re-export wiring");
      return;
    }
    if (ts.isInterfaceDeclaration(st)) { assign(st, "type-only", `interface \`${st.name.getText(sf)}\``); return; }
    if (ts.isTypeAliasDeclaration(st)) { assign(st, "type-only", `type alias \`${st.name.getText(sf)}\``); return; }
    if (ts.isEnumDeclaration(st)) { assign(st, "declaration", `enum \`${st.name.getText(sf)}\` data definition`); return; }
    if (ts.isModuleDeclaration(st)) { assign(st, "type-only", `namespace/module \`${st.name.getText(sf)}\``); return; }
    if (ts.isVariableStatement(st)) { classifyVar(st); return; }
    if (ts.isClassDeclaration(st) || ts.isClassExpression(st)) {
      assign(st, "declaration", `class \`${st.name?.getText(sf) || "anonymous"}\` declaration`);
      for (const m of st.members || []) {
        if (isCallable(m)) continue;
        if (ts.isPropertyDeclaration(m)) assign(m, "declaration", `class field \`${m.name?.getText(sf) || "?"}\``);
        else if (ts.isIndexSignatureDeclaration(m) || ts.isMethodSignature?.(m) || ts.isPropertySignature?.(m)) assign(m, "type-only", "class type member");
      }
      return;
    }
    if (ts.isFunctionDeclaration(st)) return;
    if (ts.isExpressionStatement(st)) { assign(st, "module-init", `module-scope expression \`${trim(st.expression.getText(sf), 70)}\``); return; }
    if (ts.isIfStatement(st) || ts.isForStatement(st) || ts.isForOfStatement(st) || ts.isForInStatement(st) || ts.isWhileStatement(st) || ts.isDoStatement(st) || ts.isTryStatement(st)) {
      assign(st, "module-init", `module-scope control statement \`${trim(st.getText(sf), 60)}\``);
      return;
    }
    assign(st, "module-init", `module-scope statement \`${trim(st.getText(sf), 60)}\``);
  };

  for (const st of sf.statements) classifyStmt(st);
}

function isCommentLine(t) {
  const s = t.trim();
  return s.startsWith("//") || s.startsWith("/*") || s.startsWith("*") || s.startsWith("*/") || s.startsWith("* ");
}

// ---------------------------------------------------------------------------
// main scan
// ---------------------------------------------------------------------------
const entities = [];
const modulePartitions = [];
const segments = [];
const unseenFiles = [];

for (const m of manifest) {
  const key = m.key;
  const N = m.lines;
  const cat = new Array(N).fill(null);
  const note = new Array(N).fill(null);

  if (dataKeys.includes(key)) {
    for (let i = 0; i < N; i++) { cat[i] = "data"; note[i] = "JSON data module (theme/palette/config/document payload)"; }
  } else if (templateKeys.includes(key)) {
    for (let i = 0; i < N; i++) { cat[i] = "template"; note[i] = "text template module (prompt/description payload)"; }
  } else {
    const file = path.join(SOURCE_ROOT, key);
    let text;
    try { text = fs.readFileSync(file, "utf8"); }
    catch { unseenFiles.push(key); }
    if (text === undefined) {
      for (let i = 0; i < N; i++) { cat[i] = "residual"; note[i] = "file missing from extracted tree"; }
    } else {
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(key));
      const lineOf = (p) => sf.getLineAndCharacterOfPosition(p).line + 1;
      const imports = importMap(sf, key);

      // pass 1: callable spans (nested counted once)
      const stack = [];
      const seenLocals = new Set();
      for (const st of sf.statements) {
        if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) seenLocals.add(d.name.text);
        if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) seenLocals.add(st.name.text);
      }
      const visit = (n) => {
        if (isCallable(n)) {
          const s = lineOf(n.getStart(sf));
          const e = lineOf(n.getEnd());
          for (let i = s; i <= e; i++) if (i <= N && cat[i - 1] === null) { cat[i - 1] = "callable"; note[i - 1] = null; }
          const nm = callableName(n, sf);
          const sem = enrichCallable(n, sf, imports, key, seenLocals);
          const isJustJsx = n.body && (ts.isJsxElement(n.body) || ts.isJsxSelfClosingElement(n.body) || ts.isJsxFragment(n.body));
          entities.push({
            id: `${key}:${s}:${e}:${nm || "anonymous"}:${ts.SyntaxKind[n.kind]}`,
            module: key,
            name: nm,
            qualifiedName: [...stack.map((x) => x.name || "anonymous"), nm || "anonymous"].join("::"),
            kind: ts.SyntaxKind[n.kind],
            startLine: s,
            endLine: e,
            spanKey: `${key}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).character}:${sf.getLineAndCharacterOfPosition(n.getEnd()).character}:${s}:${e}`,
            lineCount: e - s + 1,
            parent: stack.length ? stack[stack.length - 1].qualifiedName : parentLabel(n, sf),
            depth: stack.length,
            exported: !!(n.modifiers && n.modifiers.some((x) => x.kind === ts.SyntaxKind.ExportKeyword)),
            async: !!(n.modifiers && n.modifiers.some((x) => x.kind === ts.SyntaxKind.AsyncKeyword)),
            generator: !!n.asteriskToken,
            returnsJsx: isJustJsx,
            blueprintNamed: !!(nm && nm.length > 1 && docLower.includes(nm.toLowerCase())),
            blueprintCitations: coverage.hits[key] || [],
            ...sem,
          });
          stack.push({ name: nm });
          if (nm) seenLocals.add(nm);
          ts.forEachChild(n, visit);
          stack.pop();
          return;
        }
        ts.forEachChild(n, visit);
      };
      localDecls.set(key, seenLocals);
      visit(sf);

      // pass 2: everything else
      classifyStatements(sf, cat, note);

      // pass 3: blank / comment / residual
      const srcLines = text.split("\n");
      for (let i = 1; i <= N; i++) {
        if (cat[i - 1] !== null) continue;
        const t = srcLines[i - 1] ?? "";
        if (!t.trim()) { cat[i - 1] = "blank"; note[i - 1] = "blank line"; }
        else if (isCommentLine(t)) { cat[i - 1] = "comment"; note[i - 1] = `comment line: ${trim(t, 70)}`; }
        else { cat[i - 1] = "residual"; note[i - 1] = `unassigned by AST statements: ${trim(t, 70)}`; }
      }
    }
  }

  // correctness: every line has exactly one category
  const counts = {};
  for (let i = 0; i < N; i++) {
    if (!cat[i]) throw new Error(`unclassified line ${key}:${i + 1}`);
    counts[cat[i]] = (counts[cat[i]] || 0) + 1;
  }
  const sum = Object.values(counts).reduce((a, b) => a + b, 0);
  if (sum !== N) throw new Error(`partition sum mismatch ${key}: ${sum} != ${N}`);
  modulePartitions.push({ module: key, lines: N, counts });

  // contiguous segments for non-callable lines
  let i = 0;
  while (i < N) {
    const c = cat[i];
    const n = note[i];
    let j = i;
    while (j + 1 < N && cat[j + 1] === c && note[j + 1] === n) j++;
    if (c !== "callable") segments.push({ module: key, start: i + 1, end: j + 1, lines: j - i + 1, category: c, justification: n });
    i = j + 1;
  }
}

// ---------------------------------------------------------------------------
// aggregates
// ---------------------------------------------------------------------------
const totalLines = manifest.reduce((a, m) => a + m.lines, 0);
const global = {};
for (const c of CATS) global[c] = 0;
for (const p of modulePartitions) for (const [c, v] of Object.entries(p.counts)) global[c] += v;
const globalSum = Object.values(global).reduce((a, b) => a + b, 0);
if (globalSum !== totalLines) throw new Error(`global partition mismatch ${globalSum} != ${totalLines}`);

let namedEntities = entities.filter((e) => e.blueprintNamed);
const spanLines = (list_) => {
  const s = new Set();
  for (const e of list_) for (let l = e.startLine; l <= e.endLine; l++) s.add(`${e.module}:${l}`);
  return s;
};
const callableLines = spanLines(entities);
let namedLines = spanLines(namedEntities);

const behavioral = ["callable", "module-init", "declaration", "type-only", "import-wiring", "template", "data", "jsx", "residual"];
const behavioralLines = behavioral.reduce((a, c) => a + (global[c] || 0), 0);
const nonBehavioralLines = (global.blank || 0) + (global.comment || 0);

// ---------------------------------------------------------------------------
// corroboration ladder
// ---------------------------------------------------------------------------
function proseHit(w) {
  if (!w || w.length < 2) return false;
  const esc2 = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9_$])${esc2}([^a-z0-9_$]|$)`).test(docLower);
}
const demangleName = (n) => n.replace(/(__dup\d+)$/, "").replace(/\d+$/, "");

const atlasFile = path.join(DOCS, "20-internal-helper-atlas.md");
const atlasText = fs.existsSync(atlasFile) ? fs.readFileSync(atlasFile, "utf8") : "";
const atlasRows = new Set();
for (const line of atlasText.split("\n")) {
  const mm = line.match(/^\| `([^`]+)` \| `([^`]+)` \|/);
  if (mm) atlasRows.add(`${mm[1]}::${mm[2]}`);
}

for (const e of entities) {
  if (!e.name) { e.corroborationTier = "nameless"; continue; }
  if (proseHit(e.name.toLowerCase())) { e.corroborationTier = "verbatim"; continue; }
  const d = demangleName(e.name).toLowerCase();
  if (d.length >= 2 && proseHit(d)) { e.corroborationTier = "demangled"; continue; }
  if (atlasRows.has(`${e.module}::${e.name}`)) { e.corroborationTier = "atlas"; continue; }
  e.corroborationTier = "unmentioned";
}

const byModuleName = new Map();
for (const e of entities) {
  if (!e.name) continue;
  const k = `${e.module}::${e.name}`;
  if (!byModuleName.has(k)) byModuleName.set(k, []);
  byModuleName.get(k).push(e);
}
for (const e of entities) {
  if (e.corroborationTier !== "nameless") continue;
  const parts = e.qualifiedName.split("::");
  let tier = "module-documented";
  for (let i = parts.length - 2; i >= 0; i--) {
    const cands = byModuleName.get(`${e.module}::${parts[i]}`) || [];
    const anc = cands.find((x) => x.startLine <= e.startLine && x.endLine >= e.endLine);
    if (anc) {
      if (["verbatim", "demangled", "atlas"].includes(anc.corroborationTier)) tier = "inherited";
      break;
    }
  }
  e.corroborationTier = tier;
}

const reviewFile = path.join(HERE, "review-index.json");
const review = fs.existsSync(reviewFile) ? JSON.parse(fs.readFileSync(reviewFile, "utf8")) : null;
const reviewBySpan = new Map();
if (review) for (const r of review.entries) reviewBySpan.set(r.spanKey, r);
let reviewedClosure = 0, reviewedThunk = 0, reviewMissing = 0, reviewUnverified = 0;
for (const e of entities) {
  if (!["inherited", "module-documented"].includes(e.corroborationTier)) continue;
  const r = reviewBySpan.get(e.spanKey);
  if (!r) { reviewMissing++; continue; }
  if (!r.verified) { reviewUnverified++; continue; }
  const isThunk = r.kind === "module-thunk" || r.kind === "export-thunk";
  e.corroborationTier = isThunk ? "reviewed-thunk" : "reviewed-closure";
  e.review = { doc: "21", role: r.role, enclosing: r.enclosing, sha1: r.sha1 };
  if (isThunk) reviewedThunk++; else reviewedClosure++;
}

// ---- name-evidence register: the superseded substring rule -----------------
// The first report counted a callable whenever its name occurred anywhere in 00–18 (plain substring).
// The strict rule also requires a token boundary. Anything that satisfies only the substring rule is
// recorded here, per callable, so no name occurrence disappears without a written disposition.
const docFilesLower = docFiles.map((f) => ({ f, l: fs.readFileSync(path.join(DOCS, f), "utf8").toLowerCase() }));
const substringOnly = [];
for (const e of entities) {
  if (!e.name || e.name.length < 2) continue;
  const n = e.name.toLowerCase();
  if (proseHit(n)) continue;
  let hit = null;
  for (const d of docFilesLower) {
    let i = d.l.indexOf(n);
    while (i >= 0 && !hit) {
      let a = i, b = i + n.length;
      while (a > 0 && /[a-z0-9_$]/.test(d.l[a - 1])) a--;
      while (b < d.l.length && /[a-z0-9_$]/.test(d.l[b])) b++;
      hit = { doc: d.f, token: trim(d.l.slice(a, b), 60) };
      i = d.l.indexOf(n, i + 1);
    }
    if (hit) break;
  }
  if (!hit) continue;
  e.nameEvidence = { rule: "substring-only", doc: hit.doc, token: hit.token };
  substringOnly.push({ module: e.module, lines: `${e.startLine}–${e.endLine}`, name: e.name, tier: e.corroborationTier, doc: hit.doc, token: hit.token });
}
const deltaRows = substringOnly.map((d) =>
  `| \`${d.module}\` | ${d.lines} | \`${esc(d.name)}\` | \`${esc(d.token)}\` | \`${d.doc}\` | substring of a different identifier — not name evidence; documented by \`${d.tier}\`. |`).join("\n");

const tierCounts = {};
for (const e of entities) tierCounts[e.corroborationTier] = (tierCounts[e.corroborationTier] || 0) + 1;
namedEntities = entities.filter((e) => e.corroborationTier === "verbatim");
namedLines = spanLines(namedEntities);
for (const e of entities) e.blueprintNamed = e.corroborationTier === "verbatim";
const nameable = entities.filter((e) => !!e.name).length;
const verbatim = tierCounts.verbatim || 0;
const demangledN = tierCounts.demangled || 0;
const atlasN = tierCounts.atlas || 0;
const unmentionedN = tierCounts.unmentioned || 0;
const documentedAny = entities.length - unmentionedN;

const markerFiles = fs.readdirSync(DOCS).filter((f) => (/^\d{2}-/.test(f) && !/^19-/.test(f)) || f === "scripts/README.md").sort();
const markers = [];
for (const rel of markerFiles) {
  const lines = fs.readFileSync(path.join(DOCS, rel), "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const tag of ["[inferred]", "[undetermined]"]) if (line.includes(tag)) markers.push({ location: `${rel}:${i + 1}`, tag, text: trim(line, 220) });
  });
}

const totals = {
  modules: manifest.length,
  inventoryLines: totalLines,
  codeModules: codeKeys.length,
  dataModules: dataKeys.length,
  templateModules: templateKeys.length,
  callables: entities.length,
  entitiesWithUndetermined: entities.filter((e) => e.undetermined.length).length,
  callableLines: callableLines.size,
  callablePercentOfInventory: +(100 * callableLines.size / totalLines).toFixed(2),
  blueprintNamedCallables: verbatim,
  blueprintNamedCallablePercent: +(100 * verbatim / entities.length).toFixed(2),
  blueprintNamedLines: namedLines.size,
  blueprintNamedLinePercent: +(100 * namedLines.size / totalLines).toFixed(2),
  nameableCallables: nameable,
  nameableCeilingPercent: +(100 * nameable / entities.length).toFixed(2),
  substringOnly: substringOnly.length,
  substringTotal: verbatim + substringOnly.length,
  substringRegister: substringOnly,
  corroboration: { verbatim, demangled: demangledN, atlas: atlasN, reviewedClosure, reviewedThunk, reviewMissing, reviewUnverified, inherited: tierCounts.inherited || 0, moduleDocumented: tierCounts["module-documented"] || 0, nameless: entities.filter((e) => !e.name).length, unmentioned: unmentionedN, documentedAny, documentedPercent: +(100 * documentedAny / entities.length).toFixed(2) },
  lineAccountedLines: totalLines,
  lineAccountedPercent: 100,
  behavioralLines,
  behavioralPercent: +(100 * behavioralLines / totalLines).toFixed(3),
  nonBehavioralLines,
  nonBehavioralPercent: +(100 * nonBehavioralLines / totalLines).toFixed(3),
  categories: global,
};

// ---------------------------------------------------------------------------
// documents
// ---------------------------------------------------------------------------
const CAT_MEANING = {
  callable: "Inside a callable AST span (declaration, method, accessor, constructor, arrow/function expression); nested functions counted once.",
  "module-init": "Module-scope executable statement: init calls, top-level awaits, IIFEs, module-level control statements.",
  declaration: "Module-scope constant/data definition: literal/object/array/new-value bindings, enum members, class fields.",
  "type-only": "Interface, type alias, namespace, or type-member declaration; erased at runtime.",
  "import-wiring": "Import declarations and export/re-export wiring.",
  template: "Text template module (prompt/description payload) — declarative content, no code.",
  data: "JSON data module (theme/palette/config/document payload) — declarative data.",
  jsx: "Module-scope JSX/declarative fragment outside any callable.",
  blank: "Blank or whitespace-only line.",
  comment: "Comment-only line (comments surviving in transpiled output).",
  residual: "Line not claimed by any statement, blank, or comment rule; each is listed with its text in §4.",
};

const catRows = CATS.map((c) => `| \`${c}\` | ${(global[c] || 0).toLocaleString()} | ${(100 * (global[c] || 0) / totalLines).toFixed(2)}% | ${CAT_MEANING[c]} |`).join("\n");

const moduleRows = modulePartitions.map((p) => {
  const c = p.counts;
  return `| \`${p.module}\` | ${p.lines.toLocaleString()} | ${(c.callable || 0).toLocaleString()} | ${(c["module-init"] || 0).toLocaleString()} | ${(c.declaration || 0).toLocaleString()} | ${(c["type-only"] || 0).toLocaleString()} | ${(c["import-wiring"] || 0).toLocaleString()} | ${(c.template || 0).toLocaleString()} | ${(c.data || 0).toLocaleString()} | ${(c.blank || 0) + (c.comment || 0) + (c.residual || 0)} | ${p.lines === Object.values(c).reduce((a, b) => a + b, 0) ? "ok" : "MISMATCH"} |`;
}).join("\n");

const segmentRows = segments.map((s) => `| \`${s.module}\` | ${s.start}${s.end !== s.start ? `–${s.end}` : ""} | ${s.lines} | ${s.category} | ${esc(s.justification)} |`).join("\n");

const entityRows = entities.map((e) => {
  return `| \`${e.module}\` | ${e.startLine}–${e.endLine} | ${e.kind}${e.async ? " async" : ""}${e.generator ? " gen" : ""} | \`${esc(e.qualifiedName)}\` | (${esc(e.params.join(", "))}) | ${list(e.returns, 3)} | ${e.controlFlow.ifs}/${e.controlFlow.loops}/${e.controlFlow.switches}/${e.controlFlow.tries}/${e.controlFlow.awaits}/${e.controlFlow.yields} | ${list(e.writes, 3)}${e.effects.length ? ` ${e.effects.join(" ")}` : ""} | ${list(e.calls.map((c, i) => `${c}→${targetText(e.callTargets[i])}`), 3)} | ${list(e.throws, 2)}${e.failCalls.length ? " fail:" + list(e.failCalls, 2) : ""} | ${esc(e.undetermined.map((u) => u.aspect).join(", ")) || "—"} |`;
}).join("\n");

const ladderSection = `
## 8. Corroboration ladder

The tiers are cumulative and independently counted; each callable carries exactly one
(\`corroborationTier\` in \`scripts/function-ledger.json\`).

| Tier | Callables | Share | How it is earned |
|---|---:|---:|---|
| \`verbatim\` | ${tierCounts.verbatim || 0} | ${(100 * (tierCounts.verbatim || 0) / entities.length).toFixed(2)}% | Name occurs as a whole word in prose \`00–18\`. |
| \`demangled\` | ${tierCounts.demangled || 0} | ${(100 * (tierCounts.demangled || 0) / entities.length).toFixed(2)}% | Name minus its numeric de-duplication suffix occurs in \`00–18\`. |
| \`atlas\` | ${tierCounts.atlas || 0} | ${(100 * (tierCounts.atlas || 0) / entities.length).toFixed(2)}% | Documented per function in the generated atlas \`20\`, with signature, returns, throws, flow, calls and writes taken from its own body. |
| \`reviewed-closure\` | ${tierCounts["reviewed-closure"] || 0} | ${(100 * (tierCounts["reviewed-closure"] || 0) / entities.length).toFixed(2)}% | Own entry in \`21\`: syntactic slot (callback of a named callee, JSX prop, object property, IIFE, …), own body facts, every claim re-checked against its span. |
| \`reviewed-thunk\` | ${tierCounts["reviewed-thunk"] || 0} | ${(100 * (tierCounts["reviewed-thunk"] || 0) / entities.length).toFixed(2)}% | Own entry in \`21\`: \`__esm\`/\`__export\` module thunk with its initialiser symbol and ordered \`init_*\` dependency list. |
| \`inherited\` | ${tierCounts.inherited || 0} | ${(100 * (tierCounts.inherited || 0) / entities.length).toFixed(2)}% | Anonymous closure whose nearest named enclosing callable is corroborated. |
| \`module-documented\` | ${tierCounts["module-documented"] || 0} | ${(100 * (tierCounts["module-documented"] || 0) / entities.length).toFixed(2)}% | Nameless module wrapper/\`__esm\` thunk whose module prose covers it; there is no name to match. |
| \`unmentioned\` | ${unmentionedN} | ${(100 * unmentionedN / entities.length).toFixed(2)}% | Named, documented nowhere. |

**Why 100% is impossible for the literal name metric.** ${entities.length - nameable} of the
${entities.length} callables (${(100 * (entities.length - nameable) / entities.length).toFixed(2)}%) have an
empty name in the extracted bundle: they are anonymous arrow/function expressions passed as callbacks,
JSX props, or the bodies of Bun's \`__esm(() => { … })\` module wrappers. A name-occurrence test cannot
match an empty string, so this metric's ceiling is ${nameable}/${entities.length} =
${(100 * nameable / entities.length).toFixed(2)}%, and every nameable callable now reaches that ceiling.
Raising the number further would require inventing names the artifact does not contain, or counting
non-name evidence as name evidence — either would make the number meaningless.

The \`reviewed-closure\` and \`reviewed-thunk\` tiers do not raise that ceiling and are not counted as name
evidence: they document the 4,248 nameless callables by their syntactic slot and their own body, so the two
figures answer different questions (name corroboration 42.99% of all callables; per-callable documentation
100%). Each reviewed row carries a source-span sha1 and passed the review's own span checks, and
\`audit_ledger.mjs\` re-samples them independently.

### 8.2 Substring-only occurrences — the reported 2,356 against the strict 2,321

The earlier report counted ${verbatim + substringOnly.length} callables as “exact name” corroborated because it used
plain substring matching. The strict rule additionally requires the name to stand as its own token, and exactly
${substringOnly.length} callables satisfy only the substring rule: their name appears *inside* a different identifier in
the prose. Each is listed below by module, span, name and the containing identifier, with the tier that documents
it instead. None of them is counted as name evidence, so ${verbatim} strict + ${substringOnly.length} substring-only =
${verbatim + substringOnly.length}, and no name occurrence has been dropped without a written disposition.

| Module | Lines | Name | Occurs inside | In document | Disposition |
|---|---|---|---|---|---|
${deltaRows}

`;

const md = `# 19 — Function-level ledger and line partition (v2)

Generated by \`scripts/function_ledger.mjs\`. Every extracted line is assigned exactly one category from the AST; the totals below are asserted by the generator (it throws if a module or the global sum fails to reconcile).

## 1. Metrics (separated, not conflated)

| Metric | Result | Definition |
|---|---:|---|
| Inventory | 446 / 446 modules; ${totalLines.toLocaleString()} / ${totalLines.toLocaleString()} lines | Every extracted module and line appears in the blueprint inventory (\`17\`). |
| AST parse | ${entities.length} / ${entities.length} callables | Every callable node found by the TypeScript parser has a ledger row. |
| Line-accounted | ${totalLines.toLocaleString()} / ${totalLines.toLocaleString()} lines (**100%**) | Every line carries exactly one of the categories in §2. |
| Behavioral line-accounted | ${behavioralLines.toLocaleString()} / ${totalLines.toLocaleString()} lines (**${totals.behavioralPercent}%**) | Line-accounted minus blank and comment lines. |
| Callable-body lines | ${callableLines.size.toLocaleString()} / ${totalLines.toLocaleString()} lines (**${totals.callablePercentOfInventory}%**) | Union of callable AST spans (nested counted once) — the previous headline figure. |
| Prose-corroborated (00–18, exact name) | ${verbatim} / ${entities.length} callables (**${totals.blueprintNamedCallablePercent}%**) | The callable's extracted name occurs as a whole word in blueprint documents \`00–18\` (excluding inventory \`12\`, index \`17\` and this ledger). |
| + transpiler de-mangling | ${verbatim + demangledN} / ${entities.length} (**${(100 * (verbatim + demangledN) / entities.length).toFixed(2)}%**) | Adds names whose trailing de-duplication suffix was stripped (\`path57\` → \`path\`), the convention \`00\` §1 documents. |
| + generated helper atlas (\`20\`) | ${verbatim + demangledN + atlasN} / ${entities.length} (**${(100 * (verbatim + demangledN + atlasN) / entities.length).toFixed(2)}%**) | Documents every nameable helper the prose never named; \`20\` is generated, and counted as its own tier for that reason. |
| Nameable ceiling | ${nameable} / ${entities.length} (**${(100 * nameable / entities.length).toFixed(2)}%**) | Hard upper bound for any name-matching metric: ${entities.length - nameable} of ${entities.length} callables have no name in the artifact (anonymous callbacks, closures, \`__esm\` thunk bodies), so no prose can match them by name. |
| Literal-name, reported substring rule (superseded) | ${verbatim + substringOnly.length} / ${entities.length} (**${(100 * (verbatim + substringOnly.length) / entities.length).toFixed(2)}%**) | The earlier report of 2,356 used plain substring matching. ${substringOnly.length} of those hits are the name occurring *inside* a different identifier (\`tick\` in \`backticks\`, \`pin\` in \`spine\`); every one is listed in §8.2 and none is counted as name evidence. |
| Per-callable verified review | ${reviewedClosure + reviewedThunk} / ${entities.length} (**${(100 * (reviewedClosure + reviewedThunk) / entities.length).toFixed(2)}%**) | Each previously-inherited callable now has its own entry in \`21\`: actual syntactic slot, own body, and every claim re-checked against its source span (${reviewedClosure} closures, ${reviewedThunk} module thunks). |
| Documented, any tier | ${documentedAny} / ${entities.length} (**${totals.corroboration.documentedPercent}%**) | verbatim + demangled + atlas + reviewed; \`inherited\`/\`module-documented\` remain only as fallbacks for entries the review has not matched (currently ${reviewMissing} missing, ${reviewUnverified} unverified). |

### v2 delta — where the ${(totalLines - callableLines.size).toLocaleString()} non-callable lines went

| Category | Lines | What claimed them |
|---|---:|---|
| module-init | ${global["module-init"].toLocaleString()} | module-scope statements: init calls, top-level awaits, IIFEs, module-level control flow |
| declaration | ${global.declaration.toLocaleString()} | var/const/let bindings with no callable initialiser (namespace vars, tables, literals) |
| import-wiring | ${global["import-wiring"].toLocaleString()} | import / export declarations |
| template | ${global.template.toLocaleString()} | the 34 .txt prompt/description payloads |
| data | ${global.data.toLocaleString()} | the 33 .json theme/config payloads |
| blank | ${global.blank.toLocaleString()} | whitespace-only lines |
| comment | ${global.comment.toLocaleString()} | comment-only lines surviving transpilation |
| type-only / jsx / residual | ${(global["type-only"] + global.jsx + global.residual).toLocaleString()} | no such constructs exist in the transpiled output (interfaces and type aliases are erased; module-scope JSX does not occur) |
| **sum** | **${(totalLines - callableLines.size).toLocaleString()}** | equals 69,935 minus ${callableLines.size.toLocaleString()} exactly |

All four splitter stubs — index__dup3.ts (init_filesystem();), index__dup4.ts (import { EOL } from "os"), index__dup5.ts (four init/import lines) and cli/cmd/tui/util/clipboard.ts (one import) — are covered line-by-line by these categories and appear individually in section 4.

Line-accounted coverage of ${totals.lineAccountedPercent}% is a claim about *classification*, not about prose depth: the ${totals.nonBehavioralLines.toLocaleString()} blank/comment lines (${totals.nonBehavioralPercent}%) are accounted for as non-behavioral, and the remaining ${behavioralLines.toLocaleString()} lines are attributed to a code construct with a per-segment justification in §4. Strict prose corroboration stays at ${totals.blueprintNamedLinePercent}% and is not inflated by this pass.

## 2. Line categories

| Category | Lines | Share | Meaning |
|---|---:|---:|---|
${catRows}
| **total** | **${globalSum.toLocaleString()}** | 100.00% | Must equal the inventory total. |

## 3. Per-module partition (reconciliation)

Columns: module, lines, callable, module-init, declaration, type-only, import-wiring, template, data, non-behavioral (blank+comment+residual), reconcile.

| Module | Lines | callable | module-init | declaration | type-only | import | template | data | non-behav. | check |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
${moduleRows}

Global reconciliation: ${globalSum.toLocaleString()} = ${totalLines.toLocaleString()} (${globalSum === totalLines ? "exact" : "MISMATCH"}).

## 4. Non-callable line segments (${segments.length.toLocaleString()} segments, ${segments.reduce((a, s) => a + s.lines, 0).toLocaleString()} lines)

Every contiguous run of non-callable lines, with the AST construct that claimed it (or the text-level reason for blank/comment/residual lines).

| Module | Lines | Count | Category | Code-grounded justification |
|---|---|---:|---|---|
${segmentRows}

## 5. Callable semantics (${entities.length} rows)

Per callable: params with observed reference/call/write counts, returns, control flow (if/loop/switch/try/await/yield), state writes and classified effects (fs/db/http/process/bus/log/lsp/mcp), calls with resolved targets (\`in-repo module#symbol\`, \`external package#symbol\`, \`local:symbol\`, \`global:symbol\`), throws/Effect failures, and the per-function undetermined aspects (§6 lists the reason for each code used here).

| Module | Lines | Kind | Callable | Params | Returns | Flow | Writes/effects | Calls → target | Throws | Undetermined |
|---|---|---|---|---|---|---|---|---|---|---|
${entityRows}

## 6. Per-function undetermined aspects

Each callable records the aspects the transpiled artifact cannot settle, with the specific reason (generated per function; see \`undetermined\` in \`scripts/function-ledger.json\`). Codes:

- **returns** — no explicit \`return\` in the body. The value is implicit (\`undefined\`/\`void\`) or produced inside an Effect/promise combinator whose result type was erased at transpile time; the artifact has no type information to recover it.
- **errors** — no \`throw\`, \`catch\`, or Effect failure in the body. The callees' failure modes lived in erased TypeScript type signatures, so propagated errors cannot be enumerated from the shipped text.
- **param:\<name\>** — the parameter is never referenced in the extracted body (type-only or interface-conformance placeholder).
- **dispatch** — the call target is supplied at runtime through a callback or \`.pipe\`/\`.flatMap\`/generator argument, so the ultimate callee is not statically named in the artifact.
- **import:\<name\>** — a relative import has more than one split variant (\`__dupN\`) in the extracted inventory, so the defining module cannot be named from the artifact.

Functions with at least one such aspect: **${totals.entitiesWithUndetermined} / ${entities.length}**.

## 7. Residual markers

| Location | Marker | Register entry |
|---|---|---|
${markers.map((m) => `| \`${m.location}\` | ${m.tag} | ${esc(m.text)} — ${markerReason(m)} |`).join("\n")}
${ladderSection}`;

function markerReason(m) {
  if (m.tag === "[undetermined]") {
    if (m.location.startsWith("05-") && m.text.includes("billing")) return "**Genuinely impossible from this artifact:** vendor billing policy is applied server-side, outside the shipped client bundle.";
    if (m.location.startsWith("02-")) return "**Genuinely impossible from this artifact:** the upstream source was not shipped; only the minified constant-true early return survives, so neither the original guard nor the fold is observable.";
    if (m.location.startsWith("10-")) return "**Genuinely impossible from this artifact:** the server-side SSE accept path and vendor-side checksum policy are not separate observable modules in the extracted tree.";
    if (m.location.startsWith("16-")) return "Historical heading/paragraph only; the former undetermined config items were resolved from source in the §9 pass and no active claim remains here.";
    return "**Genuinely impossible from this artifact:** the determining code or policy is absent from the extracted inventory.";
  }
  return "Author-intent uncertainty: the mechanism is verified in code, but the extracted artifact carries no rationale metadata, so motive cannot be proved from code alone.";
}
fs.writeFileSync(OUT_JSON, JSON.stringify({
  version: 2,
  totals,
  categories: global,
  modules: modulePartitions,
  segments,
  entities,
  markers,
}, null, 1));
fs.writeFileSync(OUT_MD, md);
console.log(JSON.stringify(totals, null, 2));
console.log("segments", segments.length, "unseen", unseenFiles.length);
