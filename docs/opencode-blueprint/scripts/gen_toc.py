#!/usr/bin/env python3
"""Inserts (or refreshes) a marker-delimited table of contents in every blueprint document.

The block lists every H2 and H3 heading, in document order, with GitHub's anchor slug. It is
idempotent: the previous block between the markers is replaced, so regenerating never drifts.
"""
import glob
import os
import re
import sys

DOCS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
START = "<!-- toc -->"
END = "<!-- /toc -->"


def slug(text, seen):
    t = re.sub(r"`+", "", text)
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)
    t = t.strip().lower()
    t = "".join(ch for ch in t if ch.isalnum() or ch in " -_")
    t = t.replace(" ", "-")
    n = seen.get(t, 0)
    seen[t] = n + 1
    return t if n == 0 else f"{t}-{n}"


def scan(lines):
    """Headings outside fenced code blocks, with their anchors."""
    out, seen, fence = [], {}, None
    for i, line in enumerate(lines):
        m = re.match(r"^(`{3,})", line)
        if m:
            if fence is None:
                fence = m.group(1)
            elif line.startswith(fence):
                fence = None
            continue
        if fence is not None:
            continue
        hm = re.match(r"^(#{1,3}) (.*)$", line)
        if hm:
            level = len(hm.group(1))
            text = hm.group(2).strip()
            out.append({"level": level, "text": text, "anchor": slug(text, seen), "line": i})
    return out


def build(headings):
    entries = [h for h in headings if h["level"] in (2, 3) and h["text"] != "Contents"]
    body = [START, "## Contents", ""]
    for h in entries:
        indent = "" if h["level"] == 2 else "  "
        body.append(f"{indent}- [{h['text']}](#{h['anchor']})")
    body += ["", END]
    return body


def refresh(path):
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().split("\n")

    # drop an existing block
    if START in lines and END in lines:
        a, b = lines.index(START), lines.index(END)
        lines = lines[:a] + lines[b + 1:]
        # collapse the blank line the block used to sit next to
        while a < len(lines) and a > 0 and lines[a] == "" and lines[a - 1] == "":
            del lines[a]

    headings = scan(lines)
    if not any(h["level"] == 2 for h in headings):
        return None
    block = build(headings)

    h1 = next((i for i, l in enumerate(lines) if l.startswith("# ")), None)
    if h1 is None:
        return None
    insert_at = h1 + 1
    while insert_at < len(lines) and lines[insert_at].strip() == "":
        insert_at += 1
    new = lines[:insert_at] + block + [""] + lines[insert_at:]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(new))
    return len([h for h in headings if h["level"] in (2, 3)])


def main():
    files = sorted(glob.glob(os.path.join(DOCS, "[0-2][0-9]-*.md")))
    if not files:
        sys.exit("gen_toc: no documents found")
    total = 0
    for f in files:
        n = refresh(f)
        if n is None:
            print(f"skip (no H2): {os.path.basename(f)}")
            continue
        total += n
    print(f"toc: {len(files)} documents, {total} entries")


if __name__ == "__main__":
    main()
