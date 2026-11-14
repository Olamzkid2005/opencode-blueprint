#!/usr/bin/env python3
"""Audit the area (◐) rows of 17-module-index.md against the sections they cite.

An area row is a claim of the form "this module's directory/file family is discussed in
`NN` §X".  This script checks that claim mechanically: it parses every ◐ row, extracts the
cited section from the numbered document, and looks for evidence that the section is really
about that module.  Evidence is any of:

  own   the module's basename or stem appears in the section (e.g. "dialog-session-list")
  sib   a sibling module from the same directory appears (finds "family" coverage)
  dir   a parent directory path appears as `dir` or dir/ (directory-level coverage)
  sym   an API symbol the label claims appears (`Filesystem.resolve`, `Flock`, `SessionID`…)
  head  the section heading names the module or one of its directories

A row is reported as UNSUPPORTED when a cited anchor has none of these, or when the anchor
has no section number at all (a doc-level "`04` — session engine" guess, which is exactly the
failure mode this script exists to catch).

Usage (run from anywhere):

    python3 docs/opencode-blueprint/audit-area-anchors.py          # summary, exit 1 on failure
    python3 docs/opencode-blueprint/audit-area-anchors.py -v       # also list directory-only rows
    python3 docs/opencode-blueprint/audit-area-anchors.py --index /tmp/index.md --docs DIR

Exit status is 0 when every row is supported, 1 otherwise, so it can gate a regeneration.

Notes:
  - "· named only in `07`'s module list" annotations emitted by gen_index.py are stripped
    before parsing; the bare doc reference in them is a note, not an anchor.
  - A "dir-only" row is supported but weak: the section names the directory, not the module.
    It is listed only with -v.
  - If a label claims an API symbol at all (a backticked token with punctuation or a Capitalised
    identifier), at least one cited section must contain that symbol. Family-level evidence (a sibling
    file or the directory name) is not enough to validate a symbol claim.
  - Requires only the standard library.
"""

import argparse
import collections
import os
import re
import sys

ROW = re.compile(r"^\| `([^`]+)` \| ([\d,]+) \| ◐ \| (.*?) \|$")
ANY_ROW = re.compile(r"^\| `([^`]+)` \|", re.M)
ANCHOR = re.compile(r"`(\d+)`(?:\s*§([\d.]+))?")
ANNOTATION = re.compile(r"\s*·\s*named only in .*$")
HEADING = re.compile(r"^(#{2,4}) (\d+(?:\.\d+)*)\.?\s")
EXT = re.compile(r"\.(tsx?|txt|json|md|js)$")


def stem(name):
    return EXT.sub("", re.sub(r"__dup\d+", "", name))


def section(doc_path, number, max_chars=5000):
    """Return the text of section `number` (and its subsections) from a numbered doc."""
    if not os.path.exists(doc_path):
        return ""
    lines = open(doc_path, errors="replace").read().split("\n")
    level = None
    out = []
    for line in lines:
        match = HEADING.match(line)
        if level is None:
            if match and match.group(2) == number:
                level = len(match.group(1))
                out.append(line)
            continue
        heading = re.match(r"^(#{2,4}) ", line)
        if heading and len(heading.group(1)) <= level:
            break
        out.append(line)
    return "\n".join(out)[:max_chars]


def doc_files(docs_dir):
    return sorted(
        os.path.join(docs_dir, name)
        for name in os.listdir(docs_dir)
        if re.match(r"^\d\d-.*\.md$", name)
    )


def find_doc(docs, num):
    for path in docs:
        if os.path.basename(path).startswith(num + "-"):
            return path
    return None


def siblings(index_text):
    tree = collections.defaultdict(list)
    for path in ANY_ROW.findall(index_text):
        directory = path.rsplit("/", 1)[0] if "/" in path else ""
        tree[directory].append(path.rsplit("/", 1)[-1])
    return tree


def classify(path, label, docs, tree):
    """Return [(doc, section, kinds)] for every anchor in the label."""
    directory = path.rsplit("/", 1)[0] if "/" in path else ""
    base = stem(path.rsplit("/", 1)[-1])
    sibs = [stem(s) for s in tree.get(directory, []) if stem(s) != base and len(stem(s)) > 3]
    segs = (
        ["/".join(directory.split("/")[i:]) for i in range(len(directory.split("/")))]
        if directory
        else []
    )
    syms = {
        token
        for token in re.findall(r"`([^`]+)`", label)
        if re.search(r"[._()/]", token) or (token[:1].isupper() and len(token) > 3)
    }

    results = []
    for num, sec in ANCHOR.findall(ANNOTATION.sub("", label)):
        if not sec:
            results.append((num, "", "doc-level"))
            continue
        doc = find_doc(docs, num)
        text = section(doc, sec) if doc else ""
        low, head = text.lower(), text.split("\n")[0].lower()
        kinds = [
            kind
            for kind, hit in (
                ("own", base.lower() in low),
                ("sib", any(s.lower() in low for s in sibs)),
                ("dir", any(f"{s.lower()}/" in low or f"`{s.lower()}`" in low for s in segs)),
                ("sym", any(s.lower() in low for s in syms)),
                ("head", base.lower() in head or any(s.lower() in head for s in segs)),
            )
            if hit
        ]
        results.append((num, sec, "+".join(kinds) or "NONE"))
    return results, syms


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--docs", default=here, help="directory holding 00-..-18-*.md (default: script dir)")
    parser.add_argument("--index", default=None, help="index file (default: <docs>/17-module-index.md)")
    parser.add_argument("-v", "--verbose", action="store_true", help="also list directory-only rows")
    args = parser.parse_args()

    index_path = args.index or os.path.join(args.docs, "17-module-index.md")
    if not os.path.exists(index_path):
        sys.exit(f"audit-area-anchors: no such index: {index_path}")

    index_text = open(index_path, errors="replace").read()
    rows = [m for m in (ROW.match(line) for line in index_text.split("\n")) if m]
    docs = doc_files(args.docs)
    tree = siblings(index_text)

    counts = collections.Counter()
    unsupported, dir_only = [], []
    for match in rows:
        path, _lines, label = match.groups()
        results, syms = classify(path, label, docs, tree)
        bad = [r for r in results if r[2] in ("NONE", "doc-level")]
        if syms and not bad and not any("sym" in r[2].split("+") for r in results):
            bad = [("symbol", "", "NONE")]
        if bad:
            counts["unsupported"] += 1
            unsupported.append((path, label, results))
            continue
        if all(set(r[2].split("+")) == {"dir"} for r in results):
            counts["dir-only"] += 1
            dir_only.append((path, label, results))
        else:
            counts["strong"] += 1

    print(f"area rows: {len(rows)}   strong: {counts['strong']}   "
          f"dir-only: {counts['dir-only']}   unsupported: {counts['unsupported']}")

    if args.verbose:
        for path, label, results in dir_only:
            print(f"  dir-only  {path}\n            {label}  {results}")

    for path, label, results in unsupported:
        print(f"\nUNSUPPORTED  {path}")
        print(f"             cited: {label}")
        print(f"             verdict: {results}")

    sys.exit(1 if unsupported else 0)


if __name__ == "__main__":
    main()
