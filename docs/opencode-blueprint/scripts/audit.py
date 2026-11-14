import re,sys,os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sec import sec
DOCS=os.path.realpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
rows=[l.rstrip('\n') for l in open(os.path.join(DOCS, '17-module-index.md'))]
bad=[]
for l in rows:
    m=re.match(r'^\| `([^`]+)` \| ([\d,]+) \| ([●◐]) \| (.*?) \|$',l)
    if not m: continue
    path,lines,st,where=m.groups()
    if st!='●': continue
    base=re.sub(r'__dup\d+','',path.rsplit('/',1)[-1])
    stem=base.rsplit('.',1)[0]
    toks=set(re.findall(r'`(\d+)`(?:\s+§([\d.]+)| \(intro\))',where))
    # also capture 18 §3.1 style
    labels=re.findall(r'`(\d+)`[^;|]*?(?:§([\d.]+)|\(intro\))',where)
    ok=False;checked=[]
    for doc,num in toks:
        try: t=sec(doc,num or '1',200)
        except Exception: t=''
        checked.append(doc+':'+(num or 'intro')+' len'+str(len(t)))
        if stem.lower() in t.lower() or (len(stem)>3 and stem.lower() in t.lower()): ok=True
    if not ok and toks:
        bad.append((path,lines,where,checked))
print(len(bad),"suspects of",sum(1 for l in rows if re.match(r'^\| `[^`]+` \| [\d,]+ \| ●',l)))
for b in bad[:60]:
    print('|',b[0],b[1],'|',b[2][:110],'|',','.join(b[3])[:90])
