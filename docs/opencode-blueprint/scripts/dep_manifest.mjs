// The artifact ships a Bun install tree at __up__/node_modules/.bun, whose directory names encode
// <package>@<version>. That is the only place versions exist (no package.json, no lockfile), so this
// script reads them and produces the exact dependency manifest. Writes 23-dependency-manifest.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "/Users/mac/node_modules/typescript/lib/typescript.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(HERE, "..");
const MODULE_ROOT = process.env.OC_MODULES || "/tmp/oc-modules/index";
const SRC = path.join(MODULE_ROOT, "src");
const STORE = path.join(MODULE_ROOT, "__up__/node_modules/.bun");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, "module-manifest.json"), "utf8"));
const OUT_MD = path.join(DOCS, "23-dependency-manifest.md");
const OUT_JSON = path.join(HERE, "deps.json");

const BUILTINS = new Set(["fs", "path", "os", "crypto", "util", "events", "stream", "child_process", "http",
  "https", "net", "url", "zlib", "tty", "assert", "buffer", "readline", "worker_threads", "module", "timers",
  "dns", "querystring", "perf_hooks", "vm", "async_hooks", "v8", "process"]);
const builtinName = (spec) => {
  const bare = spec.replace(/^node:/, "");
  const head = bare.split("/")[0];
  return BUILTINS.has(bare) ? bare : BUILTINS.has(head) ? head : null;
};

// "zod@3.25.76" | "@ai-sdk+openai@3.0.48+d6123d32214422cb" | "is-extglob@2.1.1"
function parseStoreName(entry) {
  let s = entry;
  let scope = "";
  if (s.startsWith("@")) {
    const firstPlus = s.indexOf("+");
    if (firstPlus < 0) return null;
    scope = s.slice(0, firstPlus).replace("+", "/");
    s = s.slice(firstPlus + 1);
  }
  const at = s.lastIndexOf("@");
  if (at <= 0) return null;
  const name = s.slice(0, at);
  let version = s.slice(at + 1);
  const plus = version.indexOf("+");
  let peerHash = "";
  if (plus >= 0) { peerHash = version.slice(plus + 1); version = version.slice(0, plus); }
  return { package: scope ? `${scope}/${name}` : name, version, peerHash };
}

const walk = (dir) => {
  let files = 0, bytes = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) {
        files++;
        try { bytes += fs.statSync(p).size; } catch { /* ignore */ }
      }
    }
  }
  return { files, bytes };
};

let entries = [];
try { entries = fs.readdirSync(STORE, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); }
catch { console.error(`no Bun store at ${STORE}`); process.exit(1); }

const pkgs = [];
const failures = [];
for (const entry of entries.sort()) {
  const parsed = parseStoreName(entry);
  if (!parsed) { failures.push(`unparsable store entry: ${entry}`); continue; }
  const size = walk(path.join(STORE, entry));
  pkgs.push({ ...parsed, store: entry, files: size.files, bytes: size.bytes });
}
if (failures.length) { console.error(failures.slice(0, 10)); process.exit(1); }

// duplicate package names mean several resolved versions of the same package
const byName = new Map();
for (const p of pkgs) {
  if (!byName.has(p.package)) byName.set(p.package, []);
  byName.get(p.package).push(p);
}
const multi = [...byName.entries()].filter(([, v]) => v.length > 1)
  .map(([name, v]) => ({ name, versions: v.map((x) => x.version).sort() }))
  .sort((a, b) => a.name.localeCompare(b.name));

// runtime specifiers, from the AST (the bundler rewrote package imports, so only these survive)
const kindFor = (k) => k.endsWith(".tsx") ? ts.ScriptKind.TSX : k.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
const runtime = new Map();
for (const m of MANIFEST) {
  if (!/\.(ts|tsx|js)$/.test(m.key)) continue;
  let text;
  try { text = fs.readFileSync(path.join(SRC, m.key), "utf8"); } catch { continue; }
  const sf = ts.createSourceFile(m.key, text, ts.ScriptTarget.Latest, true, kindFor(m.key));
  const add = (spec) => {
    const kind = spec.startsWith("bun:") ? "bun-runtime" : builtinName(spec) ? "node-builtin" : null;
    if (!kind) return;
    if (!runtime.has(spec)) runtime.set(spec, { specifier: spec, kind, modules: new Set(), count: 0 });
    runtime.get(spec).modules.add(m.key);
    runtime.get(spec).count++;
  };
  const visit = (n) => {
    if (ts.isImportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) add(n.moduleSpecifier.text);
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const isReq = ts.isIdentifier(c) && c.text === "require";
      const isImp = c.kind === ts.SyntaxKind.ImportKeyword;
      if ((isReq || isImp) && n.arguments.length && ts.isStringLiteral(n.arguments[0])) add(n.arguments[0].text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const runtimeRows = [...runtime.values()].sort((a, b) => a.specifier.localeCompare(b.specifier));
const totalFiles = pkgs.reduce((a, p) => a + p.files, 0);
const totalBytes = pkgs.reduce((a, p) => a + p.bytes, 0);

const out = [];
out.push("# 23 — Dependency manifest");
out.push("");
out.push("Generated by `scripts/dep_manifest.mjs`. The artifact carries no `package.json` and no lockfile, but it");
out.push("carries the installed tree: `__up__/node_modules/.bun/<package>@<version>` is Bun's store layout, so every");
out.push("**exact resolved version** is recoverable from the directory name. This is the full installed closure, not");
out.push("just the direct dependencies.");
out.push("");
out.push(`Packages: **${pkgs.length}** store entries, **${byName.size}** distinct names · files: **${totalFiles.toLocaleString()}** · bytes: **${totalBytes.toLocaleString()}** · runtime specifiers: **${runtimeRows.length}**`);
out.push("");
out.push("## 1. What the source can and cannot tell you");
out.push("");
out.push("The bundle was produced by a bundler, so `src` contains **no import statements at all** — package imports");
out.push("were folded into module initialisers. Attribution (which package a given module uses) is therefore not");
out.push("recoverable from `src`. The store, however, is complete: the versions below are exact, because Bun encodes");
out.push("them in the path. Together they give a rebuild the precise install set; they do not give the mapping from");
out.push("module to package, and they do not give dependency ranges, peer constraints or scripts.");
out.push("");
out.push("## 2. Installed packages (exact versions)");
out.push("");
out.push("Packages that resolve to more than one version appear once per version, distinguished by the peer hash Bun");
out.push("appends to the store name.");
out.push("");
out.push("| Package | Version | Peer hash | Files | Bytes |");
out.push("|---|---|---|---:|---:|");
for (const p of pkgs) out.push(`| \`${p.package}\` | \`${p.version}\` | ${p.peerHash ? `\`${p.peerHash.slice(0, 12)}\`` : "—"} | ${p.files} | ${p.bytes} |`);
out.push("");
out.push("## 3. Packages with several resolved versions");
out.push("");
if (multi.length === 0) out.push("None: every package name resolves to a single version in this tree.");
else {
  out.push("| Package | Versions |");
  out.push("|---|---|");
  for (const m of multi) out.push(`| \`${m.name}\` | ${m.versions.map((v) => `\`${v}\``).join(", ")} |`);
}
out.push("");
out.push("## 4. Runtime and builtins used by the source");
out.push("");
out.push("| Specifier | Kind | Modules | Import sites |");
out.push("|---|---|---:|---:|");
for (const r of runtimeRows) out.push(`| \`${r.specifier}\` | ${r.kind} | ${r.modules.size} | ${r.count} |`);
out.push("");
out.push("## 5. Install set");
out.push("");
out.push("Exact install command for the full closure (one entry per resolved version; peer-hash variants collapse to the");
out.push("same version string):");
out.push("");
const pins = [...new Set(pkgs.map((p) => `${p.package}@${p.version}`))].sort();
out.push("```sh");
out.push("bun add " + pins.join(" "));
out.push("```");
out.push("");
out.push("`bun:*` specifiers are runtime APIs and are not installed.");
out.push("");
out.push("## 6. Still open");
out.push("");
out.push("- **Module → package attribution.** Not present in the artifact; the bundler removed the edges.");
out.push("- **Dependency ranges and peer constraints.** The installed tree pins one resolution; the declared ranges are gone.");
out.push("- **Package API semantics.** Which versions are *compatible* with this bundle's behaviour is unverified; only the");
out.push("  exact installed set is known.");

fs.writeFileSync(OUT_MD, out.join("\n") + "\n");
fs.writeFileSync(OUT_JSON, JSON.stringify({
  generated: "dep_manifest.mjs",
  totals: { storeEntries: pkgs.length, distinctPackages: byName.size, files: totalFiles, bytes: totalBytes, runtimeSpecifiers: runtimeRows.length, multiVersion: multi.length },
  packages: pkgs.map((p) => ({ package: p.package, version: p.version, peerHash: p.peerHash, store: p.store, files: p.files, bytes: p.bytes })),
  runtime: runtimeRows.map((r) => ({ specifier: r.specifier, kind: r.kind, modules: [...r.modules].sort(), count: r.count })),
}, null, 1));

console.log(JSON.stringify({ storeEntries: pkgs.length, distinctPackages: byName.size, files: totalFiles, bytes: totalBytes, runtimeSpecifiers: runtimeRows.length, multiVersion: multi.length }, null, 2));
