// Recovers the type surface the artifact actually still carries: class shapes, runtime validators
// (zod / Effect Schema constructs) and the literal domains they constrain. Writes 24-type-surface.md.
//
// This is deliberately NOT called "type declarations": the bundle is transpiled, so TypeScript
// annotations and .d.ts files do not exist in it (0 of 446 modules ship one). What survives is the
// runtime schema layer and the class shapes, both of which encode real types, plus declared arity.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "/Users/mac/node_modules/typescript/lib/typescript.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(HERE, "..");
const MODULE_ROOT = process.env.OC_MODULES || "/tmp/oc-modules/index";
const SRC = path.join(MODULE_ROOT, "src");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, "module-manifest.json"), "utf8"));
const OUT_MD = path.join(DOCS, "24-type-surface.md");
const OUT_JSON = path.join(HERE, "type-surface.json");

const kindFor = (k) => k.endsWith(".tsx") ? ts.ScriptKind.TSX : k.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
const trim = (s, n = 120) => String(s).replace(/\s+/g, " ").trim().slice(0, n);
const cell = (s) => String(s).replace(/\|/g, "\\|");

// The transpiler renamed the schema namespaces; these are the aliases that actually appear in the bundle.
const SCHEMA_NS = new Set(["z", "zod", "zod_default", "zod_v4_default", "v4_default", "exports_external",
  "exports_zod", "exports_z", "zod_external", "Schema", "exports_Schema", "schema_default"]);
const CTORS = new Set(["object", "strictObject", "looseObject", "enum", "nativeEnum", "union", "literal", "string",
  "number", "boolean", "array", "record", "tuple", "discriminatedUnion", "intersection", "nullable", "optional",
  "coerce", "lazy", "partial", "Struct", "Class", "TaggedClass", "Union", "Literal", "Record", "Array", "Tuple",
  "suspend", "String", "Number", "Boolean", "filter"]);

const keysOf = (node, sf) => {
  if (!node) return "";
  if (ts.isObjectLiteralExpression(node)) {
    const keys = node.properties.map((p) => (p.name ? p.name.getText(sf) : "…"));
    return "keys " + keys.slice(0, 12).join(", ") + (keys.length > 12 ? `, … (${keys.length})` : "");
  }
  if (ts.isArrayLiteralExpression(node)) {
    const vals = node.elements.map((e) => trim(e.getText(sf), 40));
    return "of " + vals.slice(0, 12).join(", ") + (vals.length > 12 ? `, … (${vals.length})` : "");
  }
  if (ts.isStringLiteral(node)) return `"${node.text}"`;
  return "";
};

const schemaItems = [];
const classItems = [];
const modules = [];
let linesWithTypes = 0;

for (const m of MANIFEST) {
  if (!/\.(ts|tsx|js)$/.test(m.key)) continue;
  let text;
  try { text = fs.readFileSync(path.join(SRC, m.key), "utf8"); } catch { continue; }
  const sf = ts.createSourceFile(m.key, text, ts.ScriptTarget.Latest, true, kindFor(m.key));
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const srcLines = text.split("\n");
  const localClasses = [];
  const localSchemas = [];
  const touched = new Set();

  const targetName = (n) => {
    let p = n.parent;
    while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p))) p = p.parent;
    if (!p) return "";
    if (ts.isVariableDeclaration(p)) return p.name.getText(sf);
    if (ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p)) return p.name.getText(sf);
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken) return trim(p.left.getText(sf), 40);
    if (ts.isExportAssignment(p)) return "export default";
    return "";
  };

  const visit = (n) => {
    if (ts.isClassDeclaration(n) || ts.isClassExpression(n)) {
      const name = n.name ? n.name.getText(sf) : "(anonymous class)";
      const heritage = n.heritageClauses && n.heritageClauses.length ? trim(n.heritageClauses.map((h) => h.getText(sf)).join(" "), 60) : "";
      const fields = [], methods = [], accessors = [];
      for (const member of n.members) {
        if (ts.isPropertyDeclaration(member) && member.name) { fields.push(member.name.getText(sf)); touched.add(lineOf(member.getStart(sf))); }
        else if (ts.isMethodDeclaration(member) && member.name) { methods.push(`${member.name.getText(sf)}/${member.parameters.length}`); touched.add(lineOf(member.getStart(sf))); }
        else if ((ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) && member.name) { accessors.push(member.name.getText(sf)); touched.add(lineOf(member.getStart(sf))); }
      }
      localClasses.push({ name, heritage, fields, methods, accessors, line: lineOf(n.getStart(sf)) });
      touched.add(lineOf(n.getStart(sf)));
    }
    if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const calleeText = trim(callee.getText(sf), 80);
      const line = lineOf(n.getStart(sf));
      // Effect Schema class: `Schema.Class("Name")({ field: ..., })`
      if (ts.isCallExpression(callee)) {
        const inner = callee.expression.getText(sf);
        const mm = inner.match(/^([A-Za-z_$][\w$]*)\.Class$/);
        if (mm && SCHEMA_NS.has(mm[1]) && callee.arguments[0] && ts.isStringLiteral(callee.arguments[0])) {
          localSchemas.push({ ctor: `${mm[1]}.Class`, target: callee.arguments[0].text, detail: trim(keysOf(n.arguments[0], sf), 160), line });
          touched.add(line);
        }
      } else {
        const mm = calleeText.match(/^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/);
        if (mm && SCHEMA_NS.has(mm[1]) && CTORS.has(mm[2])) {
          localSchemas.push({ ctor: `${mm[1]}.${mm[2]}`, target: targetName(n), detail: trim(keysOf(n.arguments[0], sf), 160), line });
          touched.add(line);
        } else if (/\.\$type$/.test(calleeText)) {
          localSchemas.push({ ctor: calleeText, target: targetName(n), detail: "type argument erased", line });
          touched.add(line);
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);

  if (localClasses.length || localSchemas.length) {
    modules.push({ module: m.key, classes: localClasses.length, schemas: localSchemas.length, lines: touched.size });
    linesWithTypes += touched.size;
    for (const c of localClasses) classItems.push({ module: m.key, ...c });
    for (const s of localSchemas) schemaItems.push({ module: m.key, ...s });
    for (const c of localClasses) {
      if (!/class\b/.test(srcLines[c.line - 1] || "")) throw new Error(`${m.key}:${c.line}: class not found on its line`);
    }
    for (const s of localSchemas) {
      const tail = s.ctor.split(".").pop();
      if (!(srcLines[s.line - 1] || "").includes(tail)) throw new Error(`${m.key}:${s.line}: ${s.ctor} not found on its line`);
    }
  }
}

const members = classItems.reduce((a, c) => a + c.fields.length + c.methods.length + c.accessors.length, 0);
const out = [];
out.push("# 24 — Type surface recovered from the artifact");
out.push("");
out.push("Generated by `scripts/type_surface.mjs`. This document is **not** a set of TypeScript declarations,");
out.push("because the artifact contains none: Bun transpiles every module, erasing annotations, interfaces and");
out.push("generics, and the bundle ships no `.d.ts` files (`0` of `446` modules). Claiming otherwise would invent");
out.push("information the source does not contain.");
out.push("");
out.push("What does survive is the part of the type system that runs: **runtime validators** (zod schemas,");
out.push("`$type()` annotations, Effect `Schema` values and `Schema.Class` definitions), which constrain the same");
out.push("shapes the static types described, and the **declared shape of every class** (fields, methods, arity).");
out.push("Both are checked against the source line they come from, so a rebuild gets the real external contract for");
out.push("validated data and the real member list for every class — while static-only detail stays unrecoverable.");
out.push("");
out.push(`Recovered: **${classItems.length}** classes · **${schemaItems.length}** validator constructs · **${members}** class members · ` +
  `across **${modules.length}** modules (${(100 * modules.length / 446).toFixed(1)}% of 446) touching **${linesWithTypes}** source lines ` +
  `(${(100 * linesWithTypes / 69935).toFixed(2)}% of 69,935)`);
out.push("");
out.push("## 1. Classes");
out.push("");
out.push("| Module | Line | Class | Extends | Fields | Methods (arity) | Accessors |");
out.push("|---|---:|---|---|---:|---|---|");
for (const c of classItems) {
  out.push(`| \`${c.module}\` | ${c.line} | \`${cell(c.name)}\` | ${c.heritage ? `\`${cell(c.heritage)}\`` : "—"} | ${c.fields.length ? c.fields.map((f) => `\`${cell(f)}\``).join(", ") : "—"} | ${c.methods.length ? c.methods.map((x) => `\`${cell(x)}\``).join(", ") : "—"} | ${c.accessors.length ? c.accessors.map((a) => `\`${cell(a)}\``).join(", ") : "—"} |`);
}
out.push("");
out.push("## 2. Runtime validators");
out.push("");
out.push("Every zod / Effect-Schema / `$type()` construct, with its binding and the literal domain it carries.");
out.push("`Schema.Class` rows record the schema's declared name and its field keys — these are the closest thing to a");
out.push("type declaration the artifact still contains.");
out.push("");
out.push("| Module | Line | Construct | Binding | Domain |");
out.push("|---|---:|---|---|---|");
for (const s of schemaItems) {
  out.push(`| \`${s.module}\` | ${s.line} | \`${cell(s.ctor)}\` | ${s.target ? `\`${cell(s.target)}\`` : "—"} | ${s.detail ? cell(s.detail) : "—"} |`);
}
out.push("");
out.push("## 3. Per-module totals");
out.push("");
out.push("| Module | Classes | Validator constructs | Lines touched |");
out.push("|---|---:|---:|---:|");
for (const r of modules) out.push(`| \`${r.module}\` | ${r.classes} | ${r.schemas} | ${r.lines} |`);
out.push("");
out.push("## 4. What remains unrecoverable");
out.push("");
out.push("- **Static annotations.** Parameter, return and property types were erased; only arity and the runtime");
out.push("  validators remain. `19` records declared arity for all 7,451 callables.");
out.push("- **Interfaces and type aliases.** They do not exist in the output at all — the ledger's `type-only` line");
out.push("  category is 0 for exactly this reason.");
out.push("- **Generic parameters.** Type arguments are gone; a rebuild must re-derive them from usage.");
out.push("- **Compile-time-only unions.** Where a union is not expressed as a runtime validator, it leaves no trace.");
out.push(`- **Class member types.** ${classItems.length} classes list their members and arity, but not member types.`);

fs.writeFileSync(OUT_MD, out.join("\n") + "\n");
fs.writeFileSync(OUT_JSON, JSON.stringify({
  generated: "type_surface.mjs",
  totals: { classes: classItems.length, validators: schemaItems.length, members, modules: modules.length, linesTouched: linesWithTypes, dtsFiles: 0 },
  classes: classItems,
  validators: schemaItems,
}, null, 1));

console.log(JSON.stringify({ classes: classItems.length, validators: schemaItems.length, members, modules: modules.length, linesTouched: linesWithTypes }, null, 2));
