#!/usr/bin/env python3
# w66_build_xlsx.py — wave-66 round 3: compile the Decomposition Atlas workbook.
# Sheets: Atlas | Corpus | Parts | Gates | Ideas | Cells | Ledger | Sweep | Review
# Design: templates/base.py tokens (borderless-first, B2 origin, 3-color discipline).
import sys, os, json, glob

XLSX_SKILL_DIR = "/home/z/my-project/skills/xlsx"
for sub in [XLSX_SKILL_DIR, os.path.join(XLSX_SKILL_DIR, "templates")]:
    if sub not in sys.path:
        sys.path.insert(0, sub)
from base import *  # design tokens + style factories (single source of truth)
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, Reference

ATLAS = "/home/z/my-project/download/decomposition-atlas"
OUT = "/home/z/my-project/download/decomposition-atlas.xlsx"

corpus = json.load(open(f"{ATLAS}/corpus.json"))
gate_map = json.load(open(f"{ATLAS}/gates/gate-map.json"))
works = corpus["works"]
gm_by_work = {w["work"]: w for w in gate_map["works"]}
totals = gate_map["totals"]

# ---------- load all part files ----------
docs = {}
for w in works:
    p = f"{ATLAS}/parts/{w['family']}/{w['work']}.json"
    docs[w["work"]] = json.load(open(p))

all_parts = []   # (work, family, part)
all_ideas = []
all_cells = []
for w in works:
    d = docs[w["work"]]
    for p in d["parts"]:
        all_parts.append((w["work"], w["family"], p))
    for i in d["ideas"]:
        all_ideas.append((w["work"], i))
    for c in d["sheet"]["cells"]:
        all_cells.append((w["work"], c))

gated_rows = [(wk, fam, p) for (wk, fam, p) in all_parts if (p.get("gate") or "").strip()]

# receipts ledger
ledger = []
for f in sorted(glob.glob(f"{ATLAS}/receipts/*.jsonl")):
    src = os.path.basename(f)
    for line in open(f):
        line = line.strip()
        if not line:
            continue
        r = json.loads(line)
        ledger.append((r.get("ts", ""), src, r.get("lane", ""), r.get("work", ""), r.get("event", ""), r.get("detail", "")))

LAYER_NAMES = {0: "substrate", 1: "mechanism", 2: "policy", 3: "interface", 4: "evidence"}

def safe_text(v):
    """Text cell writer guard: never let text start with '=' (formula trap)."""
    if isinstance(v, str) and v.startswith("="):
        return "'" + v
    return v

def write_table(ws, title, headers, rows, widths=None, wrap_cols=(), num_cols=(), freeze="C5"):
    """Standard atlas table: B2 title, row-4 headers, data from row 5, base.py styling."""
    last_col = len(headers) + 1
    setup_sheet(ws, title=title, last_col=last_col)
    for ci, h in enumerate(headers, start=2):
        ws.cell(row=4, column=ci, value=h)
    style_header_row(ws, row_num=4, col_start=2, col_end=last_col)
    for ri, row in enumerate(rows):
        rn = 5 + ri
        for ci, v in enumerate(row, start=2):
            ws.cell(row=rn, column=ci, value=safe_text(v))
        style_data_row(ws, row_num=rn, col_start=2, col_end=last_col, row_index=ri)
        for ci in num_cols:
            ws.cell(row=rn, column=ci).alignment = align_number()
            ws.cell(row=rn, column=ci).number_format = FORMATS["integer"]
    if widths:
        for ci, w in enumerate(widths, start=2):
            ws.column_dimensions[get_column_letter(ci)].width = w
    else:
        auto_fit_columns(ws, min_width=8, max_width=36, header_row=4, data_start_row=5)
    for ci in wrap_cols:
        letter = get_column_letter(ci)
        for rn in range(5, 5 + len(rows)):
            ws[f"{letter}{rn}"].alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
    ws.freeze_panes = freeze
    return 5 + len(rows)  # first free row

wb = Workbook()

# ================= 1. Atlas (overview) =================
ws = wb.active
ws.title = "Atlas"
setup_sheet(ws, title="The Decomposition Atlas — wave-66", last_col=5)
overview = [
    ("What this is", "Every sibling work pushed to SuperInstance (and the external research it leaned on), decomposed into elementary parts as spreadsheet logic."),
    ("Method", "5 canonical layers (substrate/mechanism/policy/interface/evidence); each part carries a gate, a failure mode, and file:line evidence; jevs swept the gates (soft emits; observation only at holes)."),
    ("Corpus", f"{totals['works']} works across 6 families (substrate, garden, swarm, organ, labs, meta)"),
    ("Elementary parts", totals["parts"]),
    ("Gated parts", f"{totals['gated']} ({totals['gated_pct']}%)"),
    ("Gate holes (observed)", totals["HOLE"]),
    ("Gate kinds", ", ".join(f"{k}:{v}" for k, v in sorted(totals["gate_kind_histogram"].items(), key=lambda kv: -kv[1]))),
    ("Sweep field", f"exoj policy=ledger, deformations={totals['deformations']}, observations={totals['observations']}, prob_open={totals['prob_open']}"),
    ("Chain of record", f"{totals['chain_verify']['links']} links, verify ok={totals['chain_verify']['ok']}, tip {totals['chain_tip'][:16]}…"),
    ("Doctrine", "Elementary = cannot be split further without changing meaning. Decision rules before the run. Honest negatives are crown jewels. Ledgers append-only."),
]
r = 4
ws.cell(row=r, column=2, value="field"); ws.cell(row=r, column=3, value="value")
style_header_row(ws, row_num=r, col_start=2, col_end=3)
for i, (k, v) in enumerate(overview):
    rn = r + 1 + i
    ws.cell(row=rn, column=2, value=k)
    ws.cell(row=rn, column=3, value=safe_text(v))
    style_data_row(ws, row_num=rn, col_start=2, col_end=3, row_index=i)
    ws.cell(row=rn, column=3).alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
ws.column_dimensions["B"].width = 22
ws.column_dimensions["C"].width = 100

# five-layer legend block
r2 = r + len(overview) + 3
ws.cell(row=r2, column=2, value="The five layers of logic")
ws.cell(row=r2, column=2).font = font_subheader()
layers_tbl = [
    (0, "substrate", "what irreducible representation does the work stand on?"),
    (1, "mechanism", "what transforms state, and from what to what?"),
    (2, "policy", "what decides, admits, prices, or refuses?"),
    (3, "interface", "what does the outside touch (wires, tools, sheets)?"),
    (4, "evidence", "what proves it ran, and what makes tampering loud?"),
]
for i, (ln, nm, q) in enumerate(layers_tbl):
    rn = r2 + 1 + i
    ws.cell(row=rn, column=2, value=ln)
    ws.cell(row=rn, column=3, value=nm)
    ws.cell(row=rn, column=4, value=q)
    style_data_row(ws, row_num=rn, col_start=2, col_end=4, row_index=i)
ws.column_dimensions["D"].width = 60
ws.sheet_view.showGridLines = False

# ================= 2. Corpus =================
ws = wb.create_sheet("Corpus")
rows = []
for w in works:
    d = docs[w["work"]]; g = gm_by_work.get(w["work"])
    rows.append([
        w["work"], w["family"], w["path"], d.get("head", "no-git"),
        d["smoke"]["verdict"], d["smoke"].get("notes", "")[:160], d["essence"],
        None, None, None, None, None, None, None, None, None,  # formula cols filled below
        g["sense_at_close"]["prob_open"] if g else None,
    ])
hdr = ["work", "family", "repo_path", "head", "smoke_verdict", "smoke_notes", "essence",
       "parts", "gates", "holes", "L0", "L1", "L2", "L3", "L4", "ideas", "prob_open"]
free = write_table(ws, "Corpus — the studied works", hdr, rows,
                   widths=[20, 10, 34, 10, 26, 40, 48, 8, 8, 8, 6, 6, 6, 6, 6, 8, 10],
                   num_cols=(8, 9, 10, 11, 12, 13, 14, 15, 16, 17), freeze="C5")
last = 4 + len(rows)
for ri in range(5, last + 1):
    ws.cell(row=ri, column=9).value = f"=COUNTIF(Parts!B5:B{4+len(all_parts)},B{ri})"                       # parts
    ws.cell(row=ri, column=10).value = f'=COUNTIFS(Parts!B5:B{4+len(all_parts)},B{ri},Parts!K5:K{4+len(all_parts)},"<>")'  # gates
    ws.cell(row=ri, column=11).value = f"=I{ri}-J{ri}"                                                      # holes
    for L in range(5):
        ws.cell(row=ri, column=12 + L).value = f"=COUNTIFS(Parts!B5:B{4+len(all_parts)},B{ri},Parts!E5:E{4+len(all_parts)},{L})"
    ws.cell(row=ri, column=17).value = f"=COUNTIF(Ideas!B5:B{4+len(all_ideas)},B{ri})"                      # ideas
for ri in range(5, last + 1):
    ws.cell(row=ri, column=17).value = None
# ideas count needs Ideas sheet to exist; write as live formula AFTER Ideas is built (deferred fill below)

# ================= 3. Parts =================
ws = wb.create_sheet("Parts")
rows = []
for (wk, fam, p) in all_parts:
    rows.append([
        wk, fam, p["part_id"], p["layer"], LAYER_NAMES.get(p["layer"], str(p["layer"])),
        p["name"], p["essence"],
        ", ".join(p.get("inputs") or []), ", ".join(p.get("outputs") or []),
        p.get("gate") or "", p.get("gate_kind") or "",
        p.get("failure_mode") or "",
        "yes" if p.get("elementary") else "no", p.get("evidence") or "",
    ])
hdr = ["work", "family", "part_id", "layer", "layer_name", "name", "essence",
       "inputs", "outputs", "gate", "gate_kind", "failure_mode", "elementary", "evidence"]
write_table(ws, f"Elementary parts ({len(rows)} rows — spreadsheet logic)", hdr, rows,
            widths=[19, 10, 16, 7, 11, 26, 48, 22, 22, 46, 13, 34, 10, 30],
            wrap_cols=(7, 8, 9, 10, 11, 12, 13, 14), num_cols=(5,), freeze="D5")

# ================= 4. Gates =================
ws = wb.create_sheet("Gates")
rows = []
for (wk, fam, p) in gated_rows:
    rows.append([wk, p["part_id"], p["layer"], LAYER_NAMES.get(p["layer"], "?"),
                 p.get("gate_kind") or "", "OPEN" if p.get("gate_kind") else "SOFT", p["gate"]])
hdr = ["work", "part_id", "layer", "layer_name", "gate_kind", "sweep_verdict", "gate"]
write_table(ws, f"Gates the jevs swept ({len(rows)} gates, rules pre-registered)", hdr, rows,
            widths=[19, 16, 7, 11, 13, 13, 70], wrap_cols=(7,), num_cols=(4,), freeze="D5")

# ================= 5. Ideas =================
ws = wb.create_sheet("Ideas")
rows = []
for (wk, i) in all_ideas:
    rows.append([wk, i["id"], i["name"], i["statement"], ", ".join(i.get("parts") or [])])
hdr = ["work", "idea_id", "name", "statement", "decomposed_into_parts"]
write_table(ws, f"Core ideas, decomposed ({len(rows)} ideas)", hdr, rows,
            widths=[19, 13, 30, 70, 40], wrap_cols=(4, 5), freeze="D5")

# ================= 6. Cells =================
ws = wb.create_sheet("Cells")
rows = []
for (wk, c) in all_cells:
    rows.append([wk, c["id"], c.get("kind", ""), c.get("expr", ""),
                 ", ".join(c.get("deps") or []), c.get("maps_to_part", "")])
hdr = ["work", "cell_id", "kind", "expr", "deps", "maps_to_part"]
write_table(ws, f"Each work re-rendered as quilt cells ({len(rows)} cells)", hdr, rows,
            widths=[19, 18, 10, 52, 24, 16], wrap_cols=(4, 5), freeze="D5")

# ================= 7. Ledger =================
ws = wb.create_sheet("Ledger")
rows = [(ts, src, lane, wk, ev, det) for (ts, src, lane, wk, ev, det) in ledger]
hdr = ["ts", "source", "lane", "work", "event", "detail"]
write_table(ws, f"Timestamped ledgers (append-only; {len(rows)} rows)", hdr, rows,
            widths=[22, 24, 8, 22, 14, 80], wrap_cols=(6,), freeze="C5")

# ================= 8. Sweep =================
ws = wb.create_sheet("Sweep")
setup_sheet(ws, title="JEV gate sweep — pre-registered rules, aggregates, per-work verdicts", last_col=9)
ws.sheet_view.showGridLines = False
r = 4
ws.cell(row=r, column=2, value="rule"); ws.cell(row=r, column=3, value="decision (receipted before the run)")
style_header_row(ws, row_num=r, col_start=2, col_end=3)
rules = [
    ("R1 OPEN", "gate non-empty AND gate_kind non-null -> emit(g=0.75, e=0.25, d=0.50)"),
    ("R2 SOFT", "gate non-empty AND gate_kind null -> emit(g=0.50, e=0.50, d=0.50)"),
    ("R3 HOLE", "gate empty/null -> observe(d=0.20): explicit, recorded, LOCAL collapse"),
    ("R4 SEAL", "gate_kind seal|conservation -> extra reinforcing emit(g=0.85, e=0.15, d=0.50)"),
    ("R5 LAYERHOLE", "work missing any layer 0-4 -> observe at that layer's cell"),
    ("R6 THIN", "work with <5 gated parts -> warning emit(g=0.35, e=0.65, d=0.50)"),
    ("geometry", "work i -> q=(i%7)-3 ; layer L -> r=L-2 ; radius 6 ; exoj policy=ledger"),
    ("backend", "atlas-sweep: deterministic structural judgment; no LLM, no network"),
]
for i, (k, v) in enumerate(rules):
    rn = r + 1 + i
    ws.cell(row=rn, column=2, value=k); ws.cell(row=rn, column=3, value=v)
    style_data_row(ws, row_num=rn, col_start=2, col_end=3, row_index=i)

# aggregates block (VALUES — chart-safe; Review cross-checks with live formulas)
r = r + len(rules) + 3
ws.cell(row=r, column=2, value="gate_kind histogram (atlas totals)"); ws.cell(row=r, column=2).font = font_subheader()
hk_start = r + 1
ws.cell(row=hk_start, column=2, value="gate_kind"); ws.cell(row=hk_start, column=3, value="count")
style_header_row(ws, row_num=hk_start, col_start=2, col_end=3)
hk_items = sorted(totals["gate_kind_histogram"].items(), key=lambda kv: -kv[1])
for i, (k, v) in enumerate(hk_items):
    rn = hk_start + 1 + i
    ws.cell(row=rn, column=2, value=k); ws.cell(row=rn, column=3, value=v)
    style_data_row(ws, row_num=rn, col_start=2, col_end=3, row_index=i)
    ws.cell(row=rn, column=3).alignment = align_number()
hk_end = hk_start + len(hk_items)

r = hk_end + 3
ws.cell(row=r, column=2, value="layer histogram"); ws.cell(row=r, column=2).font = font_subheader()
lh_start = r + 1
ws.cell(row=lh_start, column=2, value="layer"); ws.cell(row=lh_start, column=3, value="parts")
style_header_row(ws, row_num=lh_start, col_start=2, col_end=3)
for L in range(5):
    rn = lh_start + 1 + L
    ws.cell(row=rn, column=2, value=f"{L} {LAYER_NAMES[L]}")
    ws.cell(row=rn, column=3, value=totals["layer_histogram"][L])
    style_data_row(ws, row_num=rn, col_start=2, col_end=3, row_index=L)
    ws.cell(row=rn, column=3).alignment = align_number()
lh_end = lh_start + 5

r = lh_end + 3
ws.cell(row=r, column=2, value="chain of record"); ws.cell(row=r, column=2).font = font_subheader()
chain_rows = [
    ("deformations", totals["deformations"]), ("observations (collapses)", totals["observations"]),
    ("prob_open at close", totals["prob_open"]), ("zone at close", totals["zone"]),
    ("chain links", totals["chain_verify"]["links"]), ("chain verify ok", str(totals["chain_verify"]["ok"])),
    ("chain tip", totals["chain_tip"]),
]
for i, (k, v) in enumerate(chain_rows):
    rn = r + 1 + i
    ws.cell(row=rn, column=2, value=k); ws.cell(row=rn, column=3, value=v)
    style_data_row(ws, row_num=rn, col_start=2, col_end=3, row_index=i)
chain_end = r + len(chain_rows)

# per-work sweep table (right side: cols E..L)
pr = 4
for ci, h in enumerate(["work", "family", "OPEN", "SOFT", "HOLE", "missing_layers", "fm_parts", "prob_open", "smoke"], start=5):
    ws.cell(row=pr, column=ci, value=h)
style_header_row(ws, row_num=pr, col_start=5, col_end=13)
for i, w in enumerate(gm_by_work.values()):
    rn = pr + 1 + i
    vals = [w["work"], w["family"], w["verdicts"]["OPEN"], w["verdicts"]["SOFT"], w["verdicts"]["HOLE"],
            ",".join(str(x) for x in w["missing_layers"]) or "—", w["failure_mode_parts"],
            w["sense_at_close"]["prob_open"], w["smoke"]]
    for ci, v in enumerate(vals, start=5):
        ws.cell(row=rn, column=ci, value=safe_text(v))
    style_data_row(ws, row_num=rn, col_start=5, col_end=13, row_index=i)
    for ci in (7, 8, 9, 12):
        ws.cell(row=rn, column=ci).alignment = align_number()
    ws.cell(row=rn, column=12).number_format = "0.0000"
pw_end = pr + len(gm_by_work)

# native bar chart: gate_kind histogram (single series -> PRIMARY)
chart = BarChart(); chart.type = "bar"
chart.title = make_chart_title("Gate kinds across the atlas", 14)
chart.x_axis.title = None; chart.y_axis.title = make_chart_title("gates", 10, bold=False, axis=True)
data = Reference(ws, min_col=3, min_row=hk_start, max_col=3, max_row=hk_end)
cats = Reference(ws, min_col=2, min_row=hk_start + 1, max_row=hk_end)
chart.add_data(data, titles_from_data=True); chart.set_categories(cats)
chart.shape = 4; chart.width = 16; chart.height = 9
chart.legend = None
from openpyxl.chart.series import SeriesLabel
from openpyxl.drawing.fill import PatternFillProperties
s = chart.series[0]
s.graphicalProperties.solidFill = PRIMARY
ws.add_chart(chart, f"E{pw_end + 3}")
ws.column_dimensions["B"].width = 20; ws.column_dimensions["C"].width = 74
for cl in "DEFGHIJKLM":
    ws.column_dimensions[cl].width = 16

# ================= 9. Review (last sheet, amber tab) =================
ws = wb.create_sheet("Review")
ws.sheet_properties.tabColor = "FFC000"
setup_sheet(ws, title="Review — live cross-checks", last_col=5)
np_, ng, ni, nc, nl = len(all_parts), len(gated_rows), len(all_ideas), len(all_cells), len(ledger)
last_parts = 4 + np_; last_gates = 4 + ng
checks = [
    ("Parts row count", np_, f"=COUNTA(Parts!C5:C{last_parts})"),
    ("Gates row count = gated parts", ng, f'=COUNTIFS(Parts!B5:B{last_parts},"<>",Parts!K5:K{last_parts},"<>")'),
    ("Gate-kind histogram sum", ng, f"=SUM(Sweep!C{hk_start + 1}:C{hk_end})"),
    ("Layer histogram sum", np_, f"=SUM(Sweep!C{lh_start + 1}:C{lh_end})"),
    ("Ideas row count", ni, f"=COUNTA(Ideas!C5:C{4 + ni})"),
    ("Cells row count", nc, f"=COUNTA(Cells!C5:C{4 + nc})"),
    ("Ledger row count", nl, f"=COUNTA(Ledger!B5:B{4 + nl})"),
    ("Corpus works rows", len(works), "=COUNTA(Corpus!B5:B33)"),
]
ws.cell(row=4, column=2, value="check"); ws.cell(row=4, column=3, value="expected")
ws.cell(row=4, column=4, value="actual"); ws.cell(row=4, column=5, value="status")
style_header_row(ws, row_num=4, col_start=2, col_end=5)
for i, (name, exp, actual) in enumerate(checks):
    rn = 5 + i
    ws.cell(row=rn, column=2, value=name)
    ws.cell(row=rn, column=3, value=exp)
    ws.cell(row=rn, column=4, value=actual)
    ws.cell(row=rn, column=5, value=f'=IF(C{rn}=D{rn},"PASS","FAIL")')
    style_data_row(ws, row_num=rn, col_start=2, col_end=5, row_index=i)
    ws.cell(row=rn, column=3).alignment = align_number()
    ws.cell(row=rn, column=4).alignment = align_number()
ws.column_dimensions["B"].width = 34
ws.column_dimensions["C"].width = 14; ws.column_dimensions["D"].width = 14
ws.column_dimensions["E"].width = 10
ws.sheet_view.showGridLines = False

wb.properties.creator = "Z.ai"
wb.properties.title = "The Decomposition Atlas — wave-66"
wb.save(OUT)
print(f"saved {OUT}")
print(f"rows: parts={np_} gates={ng} ideas={ni} cells={nc} ledger={nl} works={len(works)}")
