"""Scan the public build for any real client name/street/phone/code from the private pack.
Usage: python tools/check_leaks.py <private-pack-dir> [paths to scan...]  (exit 1 on leak)"""
import glob, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
src = sys.argv[1]
scan = sys.argv[2:] or ["app/public/docs", "app/src", "README.md", "docs"]
COMMON = set("""moscow pullman client door code lane court street lock then the and press button unlocked arrival key will
leave home use sop projects deep cleans task list pot ceramic for first visit call let show after that keypad provided landlord
none back enter through should not inside shed rope hidden behind painting their side steps out town spare under front doorstep
second yard giving garage access bottom next driveway open when you arrive top oval ave blvd drive road way van main with
apartment there attached available sill just household info lot off use parking particular shares clients idaho wash
buddha place don""".split())
# first names already published in the public testimonials on gistcleaning.com
PUBLIC_OK = {"Sarah", "Jessica", "Jericho", "Dustin", "Sipes"}
names, codes, phones = set(), set(), set()
for p in glob.glob(src + "/**/*.md", recursive=True):
    if "Client SOP" not in p and "PROJECTS" not in p:
        continue
    md = open(p, encoding="utf-8").read()
    for ln in re.findall(r"^\*\*(?:Name|Address|Contact|Door Access):\*\*(.*)$", md, re.M):
        names.update(w for w in re.findall(r"[A-Z][A-Za-z'\-]{2,}", ln) if w.lower() not in COMMON and w not in PUBLIC_OK)
        codes.update(re.findall(r"\d{4,}", ln))
    names.update(w for w in re.findall(r"[A-Z][a-z]{2,}", os.path.relpath(p, src)) if w.lower() not in COMMON)
leaks = []
files = []
for s in scan:
    files += [s] if os.path.isfile(s) else [f for f in glob.glob(s + "/**/*", recursive=True) if os.path.isfile(f) and f.endswith((".md", ".txt", ".json", ".ts", ".tsx", ".html"))]
for f in files:
    t = open(f, encoding="utf-8", errors="ignore").read()
    for n in names:
        if re.search(r"(?<![A-Za-z])" + re.escape(n) + r"(?![a-z])", t):
            leaks.append((n, f))
    for c in codes:
        if re.search(r"(?<!\d)" + c + r"(?!\d)", t):
            leaks.append(("code/phone " + c, f))
for n, f in sorted(set(leaks)):
    print("LEAK?", n, "->", f)
print(f"scanned {len(files)} files for {len(names)} names and {len(codes)} numbers; {len(set(leaks))} hits")
sys.exit(1 if leaks else 0)
