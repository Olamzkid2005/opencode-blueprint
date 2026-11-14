// Structural audit of the document set (docs 00�24):
//   · heading anchors unique, and each document's TOC matches its headings exactly
//   · every table is rectangular (same cell count per row, valid separator row)
//   · every internal link resolves to a file that exists and an anchor that exists
//   · the stated totals in 19/21/22/23/24 reconcile with the sidecar JSON the generators wrote
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(HERE, "..");
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };

const files = fs.readdirSync(DOCS).filter((f) => /^[0-2][0-9]-.*\.md$/.test(f)).sort();
check(files.length === 25, `expected 25 documents (00-24), found ${files.length}`);

function slug(text, seen) {
  let t = text.replace(/`+/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim().toLowerCase();
  t = [...t].filter((ch) => /[\p{L}\p{N} _-]/u.test(ch)).join("");
  t = t.replace(/ /g, "-");
  const n = seen.get(t) || 0;
  seen.set(t, n + 1);
  return n === 0 ? t : `${t}-${n}`;
}

function parseDoc(text) {
  const lines = text.split("\n");
  const headings = [];
  const seen = new Map();
  const tables = [];
  const fenced = [];
  let fence = null;
  let table = null;
  lines.forEach((line, i) => {
    const fm = line.match(/^(`{3,})/);
    if (fm) {
      if (!fence) fence = fm[1];
      else if (line.startsWith(fence)) fence = null;
      fenced.push(i);
      if (table) { tables.push(table); table = null; }
      return;
    }
    if (fence) return;
    const hm = line.match(/^(#{1,3}) (.*)$/);
    if (hm) {
      const level = hm[1].length;
      const txt = hm[2].trim();
      headings.push({ level, text: txt, anchor: slug(txt, seen), line: i });
      if (table) { tables.push(table); table = null; }
      return;
    }
    if (line.startsWith("|")) {
      if (!table) table = { start: i + 1, rows: [] };
      table.rows.push(line);
    } else if (table) { tables.push(table); table = null; }
  });
  if (table) tables.push(table);
  return { lines, headings, tables, fenced };
}

// cells: split on pipes that are neither escaped nor inside a code span
// GFM: a pipe separates cells unless it is backslash-escaped — code spans do not protect it.
function cellCount(row) {
  let count = 0;
  for (let i = 0; i < row.length; i++) {
    if (row[i] === "\\") { i++; continue; }
    if (row[i] === "|") count++;
  }
  return count - 1; // leading and trailing pipes do not delimit cells
}

const docs = new Map();
for (const f of files) docs.set(f, parseDoc(fs.readFileSync(path.join(DOCS, f), "utf8")));

// ---------------------------------------------------------------- headings / TOC
for (const [f, d] of docs) {
  const anchors = d.headings.filter((h) => h.level > 1).map((h) => h.anchor);
  check(new Set(anchors).size === anchors.length, `${f}: duplicate heading anchor`);

  const lines = d.lines;
  const s = lines.indexOf("<!-- toc -->");
  const e = lines.indexOf("<!-- /toc -->");
  check(s >= 0 && e > s, `${f}: no TOC block`);
  if (s < 0 || e < s) continue;

  const expected = d.headings.filter((h) => h.level === 2 || h.level === 3)
    .filter((h) => h.text !== "Contents")
    .map((h) => `${h.level === 3 ? "  " : ""}- [${h.text}](#${h.anchor})`);
  const actual = lines.slice(s + 1, e).filter((l) => /^\s*- \[/.test(l));
  check(actual.length === expected.length, `${f}: TOC has ${actual.length} entries, headings require ${expected.length}`);
  for (let i = 0; i < Math.min(actual.length, expected.length); i++) {
    check(actual[i] === expected[i], `${f}: TOC entry ${i + 1} is "${actual[i]}" but heading is "${expected[i]}"`);
  }
  check(lines[s + 1] === "## Contents", `${f}: TOC block does not start with the Contents heading`);
}

// ---------------------------------------------------------------- tables
for (const [f, d] of docs) {
  for (const t of d.tables) {
    check(t.rows.length >= 2, `${f}:${t.start}: table has fewer than two rows`);
    const n = cellCount(t.rows[0]);
    check(n > 0, `${f}:${t.start}: table header has no cells`);
    for (const [i, row] of t.rows.entries()) {
      check(cellCount(row) === n, `${f}:${t.start + i}: ${cellCount(row)} cells, header has ${n}`);
    }
    const sep = t.rows[1] || "";
    const sepCells = sep.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    check(sepCells.every((c) => /^:?-{2,}:?$/.test(c)), `${f}:${t.start + 1}: malformed separator row`);
  }
}

// ---------------------------------------------------------------- internal links
const anchorSet = (f) => new Set((docs.get(f)?.headings || []).map((h) => h.anchor));
for (const [f, d] of docs) {
  d.lines.forEach((line, i) => {
    if (d.fenced.includes(i)) return;
    // ignore bracket/paren sequences that sit inside inline code spans
    const codeMask = new Array(line.length).fill(false);
    {
      let i = 0;
      while (i < line.length) {
        if (line[i] !== "`") { i++; continue; }
        let n = 0;
        while (line[i + n] === "`") n++;
        const close = line.indexOf("`".repeat(n), i + n);
        if (close < 0) break;
        for (let j = i; j < close + n; j++) codeMask[j] = true;
        i = close + n;
      }
    }
    for (const m of line.matchAll(/(?<!\\)\[((?:\\.|[^\]\\])*)\]\(([^)\s]+)\)/g)) {
      if (codeMask[m.index]) continue;
      const target = m[2];
      if (/^[a-z]+:/i.test(target)) continue; // http(s), mailto
      const [file, anchor] = target.split("#");
      if (!file) {
        check(anchorSet(f).has(anchor), `${f}:${i + 1}: link to missing anchor #${anchor}`);
        continue;
      }
      const resolved = path.join(DOCS, file);
      check(fs.existsSync(resolved), `${f}:${i + 1}: link to missing file ${file}`);
      if (anchor && file.endsWith(".md") && docs.has(file)) {
        check(anchorSet(file).has(anchor), `${f}:${i + 1}: ${file} has no anchor #${anchor}`);
      }
    }
  });
}

// ---------------------------------------------------------------- stated totals
const ledger = JSON.parse(fs.readFileSync(path.join(HERE, "function-ledger.json"), "utf8"));
const review = JSON.parse(fs.readFileSync(path.join(HERE, "review-index.json"), "utf8"));
const payloads = JSON.parse(fs.readFileSync(path.join(HERE, "payloads.json"), "utf8"));
const deps = JSON.parse(fs.readFileSync(path.join(HERE, "deps.json"), "utf8"));
const types = JSON.parse(fs.readFileSync(path.join(HERE, "type-surface.json"), "utf8"));

const md19 = docs.get("19-function-ledger.md");
check(!!md19, "doc 19 missing");
if (md19) {
  check(md19.lines.some((l) => l.startsWith(`| Documented, any tier | ${ledger.entities.length} / ${ledger.entities.length}`)),
    "doc 19: documented-any-tier row does not match the ledger");
  check(md19.lines.some((l) => l.startsWith(`| Prose-corroborated (00–18, exact name) | ${ledger.totals.corroboration.verbatim} / ${ledger.entities.length}`)),
    "doc 19: verbatim row does not match the ledger");
  const reg = md19.lines.filter((l) => l.includes("substring of a different identifier")).length;
  check(reg === ledger.totals.substringOnly, `doc 19: ${reg} register rows, ledger has ${ledger.totals.substringOnly}`);
  check(md19.lines.some((l) => l.includes("### 8.2 Substring-only occurrences")), "doc 19: §8.2 heading missing");
  check(md19.lines.some((l) => l.includes(`| Literal-name, reported substring rule (superseded) | ${ledger.totals.substringTotal} /`)),
    "doc 19: superseded-rule row does not match the ledger");
}

const md21 = docs.get("21-verified-closure-review.md");
if (md21) {
  const stated = `Entries: **${review.totals.entries}** (${review.totals.closures} closures, ${review.totals.thunks} module thunks)`;
  check(md21.lines.some((l) => l.startsWith(stated)), `doc 21: header does not state "${stated}"`);
  const sectionAt = md21.lines.findIndex((l) => l.startsWith("## 2. Closures"));
  const closureRows = md21.lines.slice(sectionAt).filter((l) => /^\| `[^`]+` \| \d+–\d+ \| .* \| (yes|\*\*NO\*\*) \|$/.test(l)).length;
  const thunkRows = md21.lines.slice(0, sectionAt).filter((l) => /^\| `[^`]+` \| \d+–\d+ \| `[0-9a-f]{12}` \|/.test(l)).length;
  check(closureRows === review.totals.closures, `doc 21: ${closureRows} closure rows, index has ${review.totals.closures}`);
  check(thunkRows === review.totals.thunks, `doc 21: ${thunkRows} thunk rows, index has ${review.totals.thunks}`);
  check(closureRows + thunkRows === review.totals.entries, `doc 21: ${closureRows} + ${thunkRows} != ${review.totals.entries}`);
  check(review.totals.closures + review.totals.thunks === review.totals.entries, "review index: closures + thunks != entries");
}

const md22 = docs.get("22-verbatim-payloads.md");
if (md22) {
  check(md22.lines.some((l) => l.startsWith(`Payloads: **${payloads.totals.payloads}**`)), "doc 22: payload total does not match");
  const heads = md22.lines.filter((l) => l.startsWith("### `")).length;
  check(heads === payloads.totals.payloads, `doc 22: ${heads} payload headings, index has ${payloads.totals.payloads}`);
}

const md23 = docs.get("23-dependency-manifest.md");
if (md23) {
  check(md23.lines.some((l) => l.startsWith(`Packages: **${deps.totals.storeEntries}**`)), "doc 23: package total does not match");
  const rows = md23.lines.filter((l) => /^\| `[^`]+` \| `[^`]+` \| /.test(l)).length;
  check(rows >= deps.totals.storeEntries, `doc 23: ${rows} package rows, index has ${deps.totals.storeEntries}`);
}

const md24 = docs.get("24-type-surface.md");
if (md24) {
  check(md24.lines.some((l) => l.startsWith(`Recovered: **${types.totals.classes}** classes`)), "doc 24: class total does not match");
  const validators = md24.lines.filter((l) => /^\| `[^`]+` \| \d+ \| `[^`]+` \|/.test(l)).length;
  check(validators === types.totals.classes + types.totals.validators,
    `doc 24: ${validators} class/validator rows, index has ${types.totals.classes + types.totals.validators}`);
}

// ---------------------------------------------------------------- report
console.log(JSON.stringify({
  documents: files.length,
  headings: [...docs.values()].reduce((a, d) => a + d.headings.length, 0),
  tocEntries: [...docs.values()].reduce((a, d) => a + d.lines.filter((l) => /^\s*- \[/.test(l)).length, 0),
  tables: [...docs.values()].reduce((a, d) => a + d.tables.length, 0),
  failures: failures.length,
}, null, 2));
if (failures.length) {
  console.error(failures.slice(0, 25).join("\n"));
  process.exit(1);
}
console.log("DOCS OK: heading/TOC structure matches, tables are rectangular, internal links resolve, stated totals reconcile.");
