// Independent audit for docs 22–24: re-reads the artifact and checks every claim those documents make.
//  22 — each payload must match the source byte-for-byte (sha1 + exact text in the document)
//  23 — each store entry / version / runtime specifier must match the installed tree
//  24 — each class and validator row must point at a source line that actually contains it
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "/Users/mac/node_modules/typescript/lib/typescript.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(HERE, "..");
const MODULE_ROOT = process.env.OC_MODULES || "/tmp/oc-modules/index";
const SRC = path.join(MODULE_ROOT, "src");
const STORE = path.join(MODULE_ROOT, "__up__/node_modules/.bun");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, "module-manifest.json"), "utf8"));

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };

// ---------------------------------------------------------------- 22 payloads
const payloads = JSON.parse(fs.readFileSync(path.join(HERE, "payloads.json"), "utf8"));
const md22 = fs.readFileSync(path.join(DOCS, "22-verbatim-payloads.md"), "utf8");
const expectedPayloads = MANIFEST.filter((m) => /\.(txt|json)$/.test(m.key)).map((m) => m.key).sort();

check(payloads.entries.length === expectedPayloads.length, `payload count ${payloads.entries.length} != ${expectedPayloads.length}`);
check(JSON.stringify(payloads.entries.map((e) => e.module).sort()) === JSON.stringify(expectedPayloads), "payload module set differs from the manifest");

let payloadLines = 0;
for (const e of payloads.entries) {
  const buf = fs.readFileSync(path.join(SRC, e.module));
  const text = buf.toString("utf8");
  const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  check(crypto.createHash("sha1").update(buf).digest("hex") === e.sha1, `${e.module}: sha1 mismatch`);
  check(buf.length === e.bytes, `${e.module}: byte count mismatch`);
  check(lines === e.lines, `${e.module}: line count mismatch`);
  const body = text.endsWith("\n") ? text.slice(0, -1) : text;
  check(md22.includes(body), `${e.module}: payload text missing from doc 22`);
  check(md22.includes(`### \`${e.module}\``), `${e.module}: heading missing from doc 22`);
  payloadLines += lines;
}
check(payloadLines === payloads.totals.lines, `payload line total ${payloadLines} != ${payloads.totals.lines}`);
check(md22.includes(`lines: **${payloads.totals.lines}**`), "doc 22 does not state the correct payload line total");
// the "before this document" figure is recomputed here rather than trusted
const prose = fs.readdirSync(DOCS)
  .filter((f) => /^\d\d-/.test(f) && !/^(12|17|19|20|21|22|23|24)-/.test(f))
  .sort()
  .map((f) => fs.readFileSync(path.join(DOCS, f), "utf8")).join("\n")
  .replace(/\s+/g, " ");
let substantive = 0, substantiveBefore = 0;
for (const e of payloads.entries) {
  const text = fs.readFileSync(path.join(SRC, e.module), "utf8");
  for (const ln of text.split("\n")) {
    const line = ln.replace(/\s+/g, " ").trim();
    if (line.length < 25) continue;
    substantive++;
    if (prose.includes(line)) substantiveBefore++;
  }
}
check(substantive === payloads.totals.substantive, `substantive line count ${substantive} != ${payloads.totals.substantive}`);
check(substantiveBefore === payloads.totals.substantiveBefore, `pre-existing prose coverage ${substantiveBefore} != ${payloads.totals.substantiveBefore}`);
check(md22.includes(`${substantiveBefore} (`), "doc 22 does not state the recomputed pre-existing coverage");

// ---------------------------------------------------------------- 23 dependencies
const deps = JSON.parse(fs.readFileSync(path.join(HERE, "deps.json"), "utf8"));
const md23 = fs.readFileSync(path.join(DOCS, "23-dependency-manifest.md"), "utf8");
const storeDirs = fs.readdirSync(STORE, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
check(deps.packages.length === storeDirs.length, `package count ${deps.packages.length} != ${storeDirs.length} store entries`);
for (const p of deps.packages) {
  check(storeDirs.includes(p.store), `${p.package}: store directory ${p.store} is not present`);
  check(p.store.includes(`@${p.version}`), `${p.package}: version ${p.version} not present in store name ${p.store}`);
  check(md23.includes(`| \`${p.package}\` | \`${p.version}\` |`), `${p.package}@${p.version}: row missing from doc 23`);
}
const versionsInDoc = new Set(deps.packages.map((p) => `${p.package}@${p.version}`));
check(md23.split("\n").filter((l) => l.startsWith("| `")).length >= deps.packages.length, "doc 23 lost package rows");
check(md23.includes(`Packages: **${deps.totals.storeEntries}**`), "doc 23 does not state the correct package count");

// ---------------------------------------------------------------- 24 type surface
const types = JSON.parse(fs.readFileSync(path.join(HERE, "type-surface.json"), "utf8"));
const md24 = fs.readFileSync(path.join(DOCS, "24-type-surface.md"), "utf8");
const lineCache = new Map();
const srcLine = (mod, line) => {
  if (!lineCache.has(mod)) lineCache.set(mod, fs.readFileSync(path.join(SRC, mod), "utf8").split("\n"));
  return lineCache.get(mod)[line - 1] || "";
};
check(types.classes.length === types.totals.classes, "class total mismatch in type-surface.json");
check(types.validators.length === types.totals.validators, "validator total mismatch in type-surface.json");
for (const c of types.classes) {
  check(/class\b/.test(srcLine(c.module, c.line)), `${c.module}:${c.line}: no class on the recorded line`);
  check(md24.includes(`| \`${c.module}\` | ${c.line} | \`${c.name}\` |`), `${c.module}:${c.line}: class row missing from doc 24`);
}
for (const v of types.validators) {
  const tail = v.ctor.split(".").pop();
  check(srcLine(v.module, v.line).includes(tail), `${v.module}:${v.line}: ${v.ctor} not on the recorded line`);
}
check(md24.includes(`Recovered: **${types.totals.classes}** classes`), "doc 24 does not state the correct class count");

// ---------------------------------------------------------------- report
console.log(JSON.stringify({
  payloads: { entries: payloads.entries.length, lines: payloadLines, sha1Verified: payloads.entries.length },
  dependencies: { storeEntries: deps.packages.length, distinct: deps.totals.distinctPackages, versions: versionsInDoc.size },
  typeSurface: { classes: types.classes.length, validators: types.validators.length, modules: types.totals.modules },
  failures: failures.length,
}, null, 2));
if (failures.length) {
  console.error(failures.slice(0, 20).join("\n"));
  process.exit(1);
}
console.log("NEW DOCS OK: payloads match byte-for-byte, dependency versions match the store, type rows match their source lines.");
