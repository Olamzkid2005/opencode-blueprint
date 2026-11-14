#!/usr/bin/env python3
import os, re, json, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("OC_MODULES", "/tmp/oc-modules/index")
MANIFEST = os.environ.get("OC_MANIFEST", os.path.join(HERE, "module-manifest.json"))
STATE = os.environ.get("OC_STATE", os.path.join(HERE, "coverage3.json"))
DOCS = os.path.realpath(os.path.join(HERE, ".."))

if os.path.isdir(os.path.join(ROOT, "src")):
    mods = []
    for dirpath, _, filenames in os.walk(os.path.join(ROOT, "src")):
        for fn in sorted(filenames):
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, ROOT)
            mods.append({"path": rel, "key": rel[4:], "lines": sum(1 for _ in open(full, "rb"))})
    mods.sort(key=lambda m: m["path"])
else:
    # Checked-in manifest for reproducibility when the ephemeral extracted tree is absent.
    mods = json.load(open(MANIFEST))
    mods.sort(key=lambda m: m["path"])
keys = [m["key"] for m in mods]
bykey = set(keys)
bycanon = collections.defaultdict(list)
bybase = collections.defaultdict(list)
for k in keys:
    c = re.sub(r"__dup\d+", "", k)
    bycanon[c].append(k)
    if c not in bybase[c.rsplit("/", 1)[-1]]:
        bybase[c.rsplit("/", 1)[-1]].append(c)


def resolve(tok, context):
    k = tok[4:] if tok.startswith("src/") else tok.lstrip("./")
    if k in bykey:
        return [k]
    if "/" not in k:
        # a bare filename is trusted when unique after collapsing __dupN variants;
        # when several modules share the basename, the surrounding text must name
        # one of their directories (e.g. "`provider.ts:839+`" under a "Provider registry"
        # heading) or the hit is dropped rather than guessed.
        names = bybase.get(k, [])
        if len(names) == 1:
            return list(bycanon[names[0]])
        narrowed = [c for c in names
                    if any(part and part in context for part in c.split("/")[:-1])]
        if len(narrowed) == 1:
            return list(bycanon[narrowed[0]])
        return []
    canon = re.sub(r"__dup\d+", "", k)
    if canon in bykey:
        return [canon]
    cands = [c for c in bycanon.get(canon, [])]
    if len(cands) == 1:
        return cands
    # suffix match on canonical form
    suf = [c for c in bycanon if c == canon or c.endswith("/" + canon)]
    out = []
    for s in suf:
        out.extend(bycanon[s])
    if len(out) == 1:
        return out
    pool = out if out else bybase.get(canon.rsplit("/", 1)[-1], [])
    pool = [c for c in pool if c.rsplit("/", 1)[-1] == canon.rsplit("/", 1)[-1]]
    if len(pool) == 1:
        return bycanon[pool[0]]
    narrowed = [c for c in pool if any(part in context for part in c.split("/")[:-1])]
    if len(narrowed) == 1:
        return bycanon[narrowed[0]]
    return []          # ambiguous: do not guess


docs = [(fn.split("-")[0], fn) for fn in sorted(os.listdir(DOCS))
        if fn.endswith(".md") and not fn.startswith(("12-", "17-", "19-", "20-", "21-", "22-", "23-", "24-"))]
TOKEN = re.compile(r"[A-Za-z0-9_,.@\-/{}]*\.(?:tsx?|json|js|sql|txt)")
H2 = re.compile(r"^##\s+(.*)$")

hits = collections.defaultdict(list)
for num, fn in docs:
    lines = open(os.path.join(DOCS, fn), encoding="utf-8").read().splitlines()
    h2 = ""
    for i, line in enumerate(lines):
        m = H2.match(line)
        if m:
            h2 = m.group(1).strip()
        context = " ".join(lines[max(0, i - 2):i + 3])
        for tok in TOKEN.findall(line):
            tok = tok.strip("`()[]<>,")
            if "{" in tok:
                pre, rest = tok.split("{", 1)
                if "}" in rest:
                    body, post = rest.split("}", 1)
                    toks = [pre + p.strip() + post for p in body.split(",")]
                else:
                    toks = [tok]
            else:
                toks = [tok]
            for t in toks:
                for k in resolve(t, context):
                    hits[k].append((num, h2))

print("modules", len(mods), "matched", len(hits))
un = [m for m in mods if m["key"] not in hits]
print("unmatched", len(un))
json.dump({"mods": mods, "hits": {k: sorted(v) for k, v in hits.items()}},
          open(STATE, "w"), indent=1)
for m in un:
    print(m["key"], m["lines"])
