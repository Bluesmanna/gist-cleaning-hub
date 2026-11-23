"""Build the GIST Cleaning Hub document library from the private pack.

Usage:
    python tools/build_docs.py <private-pack-dir> [--pack-json <out.json>]

<private-pack-dir> is the folder of real Google Drive exports (one .md/.docx/.pdf/.txt
per doc, folders mirroring Drive). It is NOT in this public repo.

What it writes (inside this repo):
    app/public/docs/<slug>.md|.txt|.docx|.pdf   downloadable files
    app/src/data/docs.generated.json            index + markdown used by the in-app reader

Company documents (general SOP, handbooks, agreement templates) are published as-is.
Client SOPs and project task lists contain client names, phone numbers, addresses and
door codes, so they are PSEUDONYMIZED: names swapped for Palouse plant names, phones
replaced with 208-555-01xx, addresses replaced, door codes / key locations removed.
The task structure (the useful part) is kept intact.

--pack-json also writes a single JSON "private pack" (real docs, base64 originals) that
the app can import on a device via Documents > Import private pack.
"""
import base64, json, os, re, shutil, subprocess, sys, tempfile

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_FILES = os.path.join(ROOT, "app", "public", "docs")
OUT_INDEX = os.path.join(ROOT, "app", "src", "data", "docs.generated.json")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

FAKE_SURNAMES = ["Aspen", "Birchwood", "Camas", "Dogwood", "Elderberry", "Fernhill", "Goldenrod",
                 "Hawthorne", "Ironwood", "Juniper", "Kinnikinnick", "Larchmont", "Mallow", "Ninebark",
                 "Oakley", "Ponderosa", "Quaking", "Rosehip", "Serviceberry", "Tamarack", "Umber",
                 "Vetch", "Willowby", "Yarrow", "Zinnia", "Bitterroot", "Chokecherry", "Huckleberry",
                 "Lupine", "Snowberry", "Thimbleberry", "Wapato"]
FAKE_FIRST = ["Alex", "Blair", "Casey", "Dana", "Emerson", "Frankie", "Gray", "Harper", "Indy", "Jordan",
              "Kai", "Logan", "Morgan", "Noel", "Oakley", "Parker", "Quinn", "Riley", "Sage", "Taylor",
              "Umi", "Vale", "Wren", "Avery", "Rowan", "Skyler", "Jamie", "Robin", "Reese", "Shay"]
FAKE_STREETS = ["Lilac Ln", "Paradise Ridge Rd", "Prairie Ct", "Coyote Ave", "Orchard Dr", "Granary Way",
                "Meadow Ct", "Bluebunch St", "Palouse View Dr", "Kamiak Ct", "Combine Rd", "Silo St",
                "Syringa Way", "Bluebird Ln", "Harvest Dr", "Hilltop Ct", "Rolling Hills Dr", "Steptoe Pl"]
STOP = {"Household", "LAST", "NAME", "HERE", "SOP", "TASK", "LIST", "Client"}
# Real names that must not appear in this public file live in <private-pack-dir>/build_config.json:
#   {"stop_words": [...extra words to ignore...], "nested_folders": [...client folders holding several homes...]}
NESTED = set()

COMPANY = {
    "Standard Operating Procedures - General": ("sop-general", "Standard Operating Procedures — General", "SOPs", "Company-wide procedures every Residential Cleaning Technician follows in all homes: client resources, breaks, supplies, products and surfaces."),
    "HANDBOOK_ Residential Cleaning Tech": ("handbook-rct", "Employee Handbook — Residential Cleaning Tech", "Handbooks", "Welcome, job duties, supplies, scheduling, pay & timekeeping, conduct, safety, client communication, inclusivity and discipline for regular RCTs."),
    "HANDBOOK_ Substitute Residential Cleaning Tech": ("handbook-subrct", "Employee Handbook — Substitute Residential Cleaning Tech", "Handbooks", "The handbook for substitute / project RCTs (different supplies, scheduling and communication sections)."),
    "EMPLOYMENT AGREEMENT_ RCT": ("agreement-rct", "Employment Agreement — Residential Cleaning Tech (template)", "Agreements", "Template employment agreement for regular Residential Cleaning Technicians."),
    "EMPLOYMENT AGREEMENT_ SubRCT": ("agreement-subrct", "Employment Agreement — Substitute RCT (template)", "Agreements", "Template employment agreement for substitute / project technicians."),
    "EMPLOYMENT AGREEMENT_ AssistMgr": ("agreement-assistmgr", "Employment Agreement — Assistant Manager (template)", "Agreements", "Template employment agreement for the Assistant Manager role."),
}


def words(s):
    s = s.replace("\\+", " ").replace("\\", " ")
    return [w for w in re.findall(r"[A-Z][A-Za-z'\-]+", s) if w not in STOP]


def field(md, name):
    m = re.search(r"^\*\*" + re.escape(name) + r":\*\*(.*)$", md, re.M)
    return m.group(1).strip() if m else ""


GLOBAL_MAP = {}
SURNAME_N = [0]


def plan_names(md, stem, idx):
    """Pass 1: assign fakes for this doc's surnames (globally consistent) and first names."""
    header = re.search(r"^## \*\*(.+?)\*\*", md, re.M)
    header = header.group(1) if header else ""
    surnames = set(words(header.replace("Household", ""))) | set(words(stem.replace("SOP - ", "").replace("TASK LIST_ ", "")))
    for s in sorted(surnames):
        if s not in GLOBAL_MAP:
            GLOBAL_MAP[s] = FAKE_SURNAMES[SURNAME_N[0] % len(FAKE_SURNAMES)]
            SURNAME_N[0] += 1
    firsts = [w for w in words(field(md, "Name")) if w not in surnames]
    local = {}
    for i, f in enumerate(firsts):
        local[f] = FAKE_FIRST[(idx * 3 + i) % len(FAKE_FIRST)]
    for k in list(local):
        if "-" in k:
            for part in k.split("-"):
                local.setdefault(part, local[k].split("-")[0])
    addr = field(md, "Address")
    m = re.match(r"\s*\d+\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*?)\s+(St|Street|Ln|Lane|Ct|Court|Ave|Avenue|Rd|Road|Dr|Drive|Way|Pl|Place|Blvd)(?![a-z])", addr)
    if m and m.group(1) not in ("N", "S", "E", "W"):
        core = re.sub(r"^(N|S|E|W)\s+", "", m.group(1))
        GLOBAL_MAP.setdefault(core, FAKE_STREETS[len(GLOBAL_MAP) % len(FAKE_STREETS)].split()[0])
    return local


def pseudonymize(md, stem, idx, street_no, local):
    mapping = dict(GLOBAL_MAP)
    mapping.update(local)
    out = md
    for real in sorted(mapping, key=len, reverse=True):
        out = re.sub(r"(?<![A-Za-z])" + re.escape(real) + r"(?![a-z])", mapping[real], out)
    # contact / phones
    n = [0]
    def phone(_m):
        n[0] += 1
        return f"208-555-01{(idx * 3 + n[0]) % 100:02d}"
    out = re.sub(r"\(?\b\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", phone, out)
    out = re.sub(r"[\w.+-]+@[\w-]+\.[\w.]+", "client@example.com", out)
    # address
    out = re.sub(r"^(\*\*Address:\*\*).*$", lambda m: f"{m.group(1)} {street_no} {FAKE_STREETS[idx % len(FAKE_STREETS)]}, Moscow, ID (demo address)  ", out, flags=re.M)
    # security
    def door(m):
        v = m.group(2)
        if re.search(r"\d|key|code|hidden|under|behind|pot", v, re.I):
            return f"{m.group(1)} Keypad code **0000#** *(demo — real access details are only in the private pack)*  "
        return m.group(0)
    out = re.sub(r"^(\*\*Door Access:\*\*)(.*)$", door, out, flags=re.M)
    out = re.sub(r"^(\*\*Locking Protocol:\*\*)(.*)$", lambda m: m.group(1) + re.sub(r"\d{3,}", "0000", m.group(2)), out, flags=re.M)
    out = re.sub(r"(?i)(code|combo|passcode)(\W{0,6})\d{3,8}", r"\1\g<2>0000", out)
    return out, mapping


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", **kw)
    if r.returncode:
        raise SystemExit(f"FAILED {cmd[0]}: {r.stderr[-400:]}")


PDF_CSS = """body{font-family:Georgia,serif;max-width:7in;margin:0 auto;font-size:11pt;line-height:1.45;color:#222}
h1,h2,h3,h4{font-family:Arial,sans-serif;color:#4D7393}h1{font-size:18pt}h2{font-size:15pt}h3{font-size:12.5pt}h4{font-size:11.5pt}
ul{padding-left:1.3em}li{margin:.1em 0}.banner{font:9pt Arial;color:#666;border-bottom:1px solid #ccc;padding-bottom:4px;margin-bottom:12px}"""


def md_to_docx_pdf(md_path, stem_out, title, banner):
    run(["pandoc", md_path, "-f", "gfm", "-o", stem_out + ".docx", "--metadata", f"title={title}"])
    with tempfile.TemporaryDirectory() as td:
        body = subprocess.run(["pandoc", md_path, "-f", "gfm", "-t", "html"], capture_output=True, text=True, encoding="utf-8").stdout
        html = f"<!doctype html><meta charset=utf-8><title>{title}</title><style>{PDF_CSS}</style><div class=banner>{banner}</div>{body}"
        hp = os.path.join(td, "doc.html")
        open(hp, "w", encoding="utf-8").write(html)
        run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={stem_out}.pdf", "file:///" + hp.replace("\\", "/")])


def plain(md):
    t = re.sub(r"\\([+\-#~*.\[\]()_])", r"\1", md)
    t = re.sub(r"~~(.*?)~~", r"\1", t)
    t = re.sub(r"\*\*\*|\*\*|(?<!\w)\*(?!\s)|(?<!\s)\*(?!\w)", "", t)
    t = re.sub(r"^#+\s*", "", t, flags=re.M)
    t = t.replace("- [ ]", "[ ]").replace("- [x]", "[x]")
    return t


def clean_md(md):
    # Google's export leaves stray "\+" escapes and empty headings; tidy for display.
    md = re.sub(r"^#+\s*$", "", md, flags=re.M)
    md = md.replace("\\+", "+").replace("\\-", "-").replace("\\#", "#").replace("\\~", "~").replace("\\&", "&")
    return re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    src = os.path.abspath(sys.argv[1])
    pack_json = sys.argv[sys.argv.index("--pack-json") + 1] if "--pack-json" in sys.argv else None
    cfg_path = os.path.join(src, "build_config.json")
    if os.path.exists(cfg_path):
        cfg = json.load(open(cfg_path, encoding="utf-8"))
        STOP.update(cfg.get("stop_words", []))
        NESTED.update(cfg.get("nested_folders", []))
    os.makedirs(OUT_FILES, exist_ok=True)
    os.makedirs(os.path.dirname(OUT_INDEX), exist_ok=True)
    mds = []
    for d, _, fs in os.walk(src):
        for f in fs:
            if f.endswith(".md") and not f.lower().startswith("readme"):
                mds.append(os.path.join(d, f))
    mds.sort(key=lambda p: p.lower())
    index, pack, report = [], [], {}
    locals_ = {}
    ci = 0
    for p in mds:
        rel = os.path.relpath(p, src).replace("\\", "/")[:-3]
        if os.path.basename(rel) in COMPANY:
            continue
        st = rel.split("/")[-2] + "/" + rel.split("/")[-1] if any(n in rel for n in NESTED) else os.path.basename(rel)
        locals_[p] = plan_names(open(p, encoding="utf-8").read(), st, ci)
        ci += 1
    client_i = 0
    for p in mds:
        rel = os.path.relpath(p, src).replace("\\", "/")[:-3]
        stem = rel.split("/")[-2] + "/" + rel.split("/")[-1] if any(n in rel for n in NESTED) else os.path.basename(rel)
        real_md = open(p, encoding="utf-8").read()
        base_src = p[:-3]
        entry = {"path": rel, "md": clean_md(real_md),
                     "docx": base64.b64encode(open(base_src + ".docx", "rb").read()).decode() if os.path.exists(base_src + ".docx") else None,
                     "pdf": base64.b64encode(open(base_src + ".pdf", "rb").read()).decode() if os.path.exists(base_src + ".pdf") else None}
        pack.append(entry)
        key = os.path.basename(rel)
        if key in COMPANY:
            slug, title, cat, summary = COMPANY[key]
            entry["slug"] = slug
            for ext in ("md", "txt", "docx", "pdf"):
                if os.path.exists(f"{base_src}.{ext}"):
                    shutil.copyfile(f"{base_src}.{ext}", os.path.join(OUT_FILES, f"{slug}.{ext}"))
            md = clean_md(real_md)
            open(os.path.join(OUT_FILES, f"{slug}.md"), "w", encoding="utf-8").write(md)
            index.append({"slug": slug, "title": title, "category": cat, "summary": summary, "pseudonymized": False, "source": rel, "md": md})
            print("company", slug)
            continue
        is_project = "PROJECTS" in rel
        md, mapping = pseudonymize(real_md, stem, client_i, 100 + client_i * 37, locals_[p])
        md = clean_md(md)
        hh = re.search(r"^## \*\*(.+?)\*\*", md, re.M)
        hh = hh.group(1).replace("+", "&").strip() if hh else f"Client {client_i + 1}"
        if "(LAST NAME HERE)" in hh:
            hh = mapping.get(next(iter(words(field(real_md, 'Name'))[1:]), ""), "Client") + " Household"
            md = md.replace("(LAST NAME HERE) Household", hh)
        slug = ("project-" if is_project else "sop-client-") + slugify(hh.replace("Household", ""))
        title = ("Project Task List — " if is_project else "Client SOP — ") + hh
        entry["slug"] = slug
        freq = re.sub(r"\s+", " ", field(md, "Frequency")) or field(md, "Estimated Duration + Schedule")[:60]
        dur = field(md, "Expected/Average Duration")
        summary = (f"{freq}; about {dur}." if dur else freq) or "Client procedures"
        mdp = os.path.join(OUT_FILES, f"{slug}.md")
        open(mdp, "w", encoding="utf-8").write(md)
        open(os.path.join(OUT_FILES, f"{slug}.txt"), "w", encoding="utf-8").write(plain(md))
        md_to_docx_pdf(mdp, os.path.join(OUT_FILES, slug), title, "GIST Cleaning — pseudonymized demo copy (names, contact info, addresses and access codes replaced)")
        index.append({"slug": slug, "title": title, "category": "Project Task Lists" if is_project else "Client SOPs",
                      "summary": summary.strip(), "pseudonymized": True, "source": f"private:{client_i}", "md": md})
        report[slug] = sorted(set(mapping.values()))
        client_i += 1
        print("client ", slug)
    json.dump(index, open(OUT_INDEX, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    if pack_json:
        json.dump({"format": "gist-private-pack", "version": 1, "docs": pack}, open(pack_json, "w", encoding="utf-8"))
        print("pack ->", pack_json, os.path.getsize(pack_json) // 1024, "KB")
    print(len(index), "docs indexed")


if __name__ == "__main__":
    main()
