import re, glob, sys, os

DOCS = os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

def sec(doc, num, maxlines=30):
    f = glob.glob(os.path.join(DOCS, doc + "-*.md"))[0]
    lines = open(f).read().split("\n")
    out = []
    lvl = None
    n = 0
    for l in lines:
        m = re.match(r"^(#{2,4}) (\d+(?:\.\d+)*)\.?\s", l)
        if lvl is None:
            if m and m.group(2) == num:
                lvl = len(m.group(1))
                out.append(l)
            continue
        hm = re.match(r"^(#{2,4}) ", l)
        if hm and len(hm.group(1)) <= lvl:
            break
        out.append(l)
        n += 1
        if n > maxlines:
            break
    return "\n".join(out)

if __name__ == "__main__":
    for arg in sys.argv[1:]:
        doc, num = arg.split(":")
        print("=" * 18, arg)
        print(sec(doc, num))
