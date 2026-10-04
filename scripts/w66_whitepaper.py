#!/usr/bin/env python3
# w66_whitepaper.py — wave-66 round 5: "The Decomposition Atlas" white paper.
# Body via ReportLab (TocDocTemplate + multiBuild), cover via html2poster.js,
# merged via pypdf. Palette: Template 07 Crystal Blue body subset (fixed by
# typesetting/cover.md — not hand-picked). English document -> FreeSerif.
import os, sys, json, hashlib

PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
sys.path.insert(0, os.path.join(PDF_SKILL_DIR, "scripts"))

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT, TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                Table, TableStyle, Image, KeepTogether, CondPageBreak,
                                HRFlowable)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily, stringWidth

# ---------- fonts (allowed set only) ----------
FONT_DIR = "/usr/share/fonts"
pdfmetrics.registerFont(TTFont("NotoSerifSC", f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf"))
pdfmetrics.registerFont(TTFont("NotoSerifSC-Bold", f"{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf"))
pdfmetrics.registerFont(TTFont("SarasaMonoSC", f"{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif", f"{FONT_DIR}/truetype/freefont/FreeSerif.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Bold", f"{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-Italic", f"{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf"))
pdfmetrics.registerFont(TTFont("FreeSerif-BoldItalic", f"{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuSans", f"{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf"))
registerFontFamily("NotoSerifSC", normal="NotoSerifSC", bold="NotoSerifSC-Bold")
registerFontFamily("FreeSerif", normal="FreeSerif", bold="FreeSerif-Bold",
                   italic="FreeSerif-Italic", boldItalic="FreeSerif-BoldItalic")
registerFontFamily("DejaVuSans", normal="DejaVuSans", bold="DejaVuSans")
from pdf import install_font_fallback
install_font_fallback()

# ---------- Template 07 Crystal Blue body palette (typesetting/cover.md) ----------
PAGE_BG      = colors.HexColor("#f5f8fc")   # XL
SECTION_BG   = colors.HexColor("#edf2f9")   # XL
CARD_BG      = colors.HexColor("#e4ecf5")   # L
TABLE_STRIPE = colors.HexColor("#eef3fa")   # L
HEADER_FILL  = colors.HexColor("#1a4a7a")   # M
BORDER       = colors.HexColor("#c0d0e2")   # S
ACCENT       = colors.HexColor("#2d7ab3")   # XS
TEXT_PRIMARY = colors.HexColor("#142840")
TEXT_MUTED   = colors.HexColor("#5a7a96")
TABLE_HEADER_COLOR, TABLE_HEADER_TEXT = HEADER_FILL, colors.white
TABLE_ROW_EVEN, TABLE_ROW_ODD = colors.white, TABLE_STRIPE

ATLAS = "/home/z/my-project/download/decomposition-atlas"
SCRIPTS = "/home/z/my-project/scripts"
gm = json.load(open(f"{ATLAS}/gates/gate-map.json"))
tot = gm["totals"]

# ---------- charts (matplotlib, charts.md rules) ----------
import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
fm.fontManager.addfont(f"{FONT_DIR}/truetype/dejavu/DejaVuSans.ttf")
import matplotlib.pyplot as plt
plt.rcParams["font.sans-serif"] = ["DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

ACC_HEX, HDR_HEX, MUT_HEX = "#2d7ab3", "#1a4a7a", "#5a7a96"

def style_ax(ax):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#c0d0e2")
    ax.spines["bottom"].set_color("#c0d0e2")
    ax.tick_params(colors=MUT_HEX, labelsize=10)

# fig 1: gate kinds, horizontal bar (labels > 10 latin chars -> horizontal)
gk = sorted(tot["gate_kind_histogram"].items(), key=lambda kv: kv[1])
fig, ax = plt.subplots(figsize=(7.4, 3.1), dpi=200, constrained_layout=True)
bars = ax.barh([k for k, _ in gk], [v for _, v in gk], color=ACC_HEX, height=0.62)
for b, (_, v) in zip(bars, gk):
    ax.text(b.get_width() + 1.2, b.get_y() + b.get_height() / 2, str(v),
            va="center", ha="left", fontsize=10, color="#142840")
ax.set_xlim(0, max(v for _, v in gk) * 1.12)
ax.grid(False)
style_ax(ax)
ax.set_xlabel("gates swept", fontsize=10, color=MUT_HEX)
fig.savefig(f"{SCRIPTS}/w66_fig1_gatekinds.png")
plt.close(fig)

# fig 2: per-family OPEN vs HOLE stacked horizontal bar
fam_order = ["substrate", "garden", "swarm", "organ", "labs", "meta"]
agg = {}
for w in gm["works"]:
    a = agg.setdefault(w["family"], [0, 0])
    a[0] += w["verdicts"]["OPEN"]; a[1] += w["verdicts"]["HOLE"]
fams = [f for f in fam_order if f in agg]
opens = [agg[f][0] for f in fams]; holes = [agg[f][1] for f in fams]
fig, ax = plt.subplots(figsize=(7.4, 3.0), dpi=200, constrained_layout=True)
b1 = ax.barh(fams, opens, color=ACC_HEX, height=0.6, label="OPEN (concrete gates)")
b2 = ax.barh(fams, holes, left=opens, color=HDR_HEX, height=0.6, label="HOLES (observed)")
for i, f in enumerate(fams):
    ax.text(opens[i] / 2, i, str(opens[i]), va="center", ha="center", fontsize=9.5,
            color="white")
    if holes[i] > 0:
        ax.text(opens[i] + holes[i] / 2, i, str(holes[i]), va="center", ha="center",
                fontsize=9.5, color="white")
ax.legend(loc="lower right", frameon=False, fontsize=9.5,
          bbox_to_anchor=(1.0, -0.02), handlelength=1.2)
ax.set_xlim(0, max(o + h for o, h in zip(opens, holes)) * 1.14)
ax.grid(False)
style_ax(ax)
ax.set_xlabel("parts", fontsize=10, color=MUT_HEX)
fig.savefig(f"{SCRIPTS}/w66_fig2_families.png")
plt.close(fig)

# ---------- document geometry ----------
LM = RM = 0.9 * inch
TM, BM = 0.85 * inch, 0.9 * inch
AVAIL = A4[0] - LM - RM
AVAIL_H = A4[1] - TM - BM
H1_THRESHOLD = AVAIL_H * 0.25

# ---------- styles ----------
body = ParagraphStyle("Body", fontName="FreeSerif", fontSize=10.5, leading=17,
                      alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=10)
h1s = ParagraphStyle("H1", fontName="FreeSerif", fontSize=20, leading=25,
                     textColor=HEADER_FILL, spaceBefore=0, spaceAfter=4)
h2s = ParagraphStyle("H2", fontName="FreeSerif", fontSize=14.5, leading=19,
                     textColor=HEADER_FILL, spaceBefore=14, spaceAfter=8)
cap = ParagraphStyle("Caption", fontName="FreeSerif", fontSize=8.5, leading=12,
                     alignment=TA_CENTER, textColor=TEXT_MUTED)
quote = ParagraphStyle("Quote", fontName="FreeSerif-Italic", fontSize=11, leading=17,
                       leftIndent=24, textColor=TEXT_MUTED, spaceBefore=6, spaceAfter=10)
code_style = ParagraphStyle("Code", fontName="DejaVuSans", fontSize=8.5, leading=12.5,
                            textColor=TEXT_PRIMARY, backColor=SECTION_BG,
                            borderPadding=6, leftIndent=8, spaceBefore=6, spaceAfter=10)
toc_h = ParagraphStyle("TOCTitle", fontName="FreeSerif", fontSize=18, leading=24,
                       textColor=HEADER_FILL, spaceAfter=14)
th = ParagraphStyle("TH", fontName="FreeSerif", fontSize=9.5, leading=12.5,
                    textColor=colors.white, alignment=TA_CENTER)
tdl = ParagraphStyle("TDL", fontName="FreeSerif", fontSize=9, leading=12.5,
                     textColor=TEXT_PRIMARY, alignment=TA_LEFT)
tdc = ParagraphStyle("TDC", fontName="FreeSerif", fontSize=9, leading=12.5,
                     textColor=TEXT_PRIMARY, alignment=TA_CENTER)
stat_style = ParagraphStyle("StatBig", fontName="FreeSerif", fontSize=19, leading=23,
                            textColor=ACCENT, alignment=TA_CENTER)
label_style = ParagraphStyle("StatLabel", fontName="FreeSerif", fontSize=8, leading=11,
                             textColor=TEXT_MUTED, alignment=TA_CENTER)

# ---------- helpers ----------
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, "bookmark_name"):
            level = getattr(flowable, "bookmark_level", 0)
            text = getattr(flowable, "bookmark_text", "")
            key = getattr(flowable, "bookmark_key", "")
            self.notify("TOCEntry", (level, text, self.page, key))

def add_heading(text, style, level=0):
    key = "h_" + hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def h1_block(num, title, first_para):
    hp = add_heading("%d  %s" % (num, title), h1s, level=0)
    rule = HRFlowable(width="100%", color=ACCENT, thickness=1.2, spaceBefore=2, spaceAfter=12)
    return [CondPageBreak(H1_THRESHOLD), KeepTogether([hp, rule, Paragraph(first_para, body)])]

def h2_block(num, title, first_el):
    hp = add_heading("%s  %s" % (num, title), h2s, level=1)
    return [KeepTogether([hp, first_el])]

def styled_table(header, rows, ratios, aligns=None):
    widths = [r * AVAIL * 0.98 for r in ratios]
    assert sum(widths) <= AVAIL + 0.5
    data = [[Paragraph("<b>%s</b>" % c, th) for c in header]]
    for row in rows:
        cells = []
        for j, c in enumerate(row):
            st = tdc if (aligns and aligns[j] == "c") else tdl
            cells.append(Paragraph(str(c), st))
        data.append(cells)
    t = Table(data, colWidths=widths, hAlign="CENTER", repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        style.append(("BACKGROUND", (0, i), (-1, i), TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD))
    t.setStyle(TableStyle(style))
    return t

def callout_row(items):
    cells, w = [], AVAIL * 0.96 / len(items)
    for n, l in items:
        inner = Table([[Paragraph("<b>%s</b>" % n, stat_style)], [Paragraph(l, label_style)]],
                      colWidths=[w - 12])
        inner.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), CARD_BG),
            ("BOX", (0, 0), (-1, -1), 0.8, ACCENT),
            ("TOPPADDING", (0, 0), (-1, 0), 8), ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
            ("TOPPADDING", (0, 1), (-1, 1), 2), ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        cells.append(inner)
    outer = Table([cells], colWidths=[w] * len(items), hAlign="CENTER")
    outer.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                               ("LEFTPADDING", (0, 0), (-1, -1), 4),
                               ("RIGHTPADDING", (0, 0), (-1, -1), 4)]))
    return outer

def fit_image(path, max_w, max_h):
    img = Image(path)
    ow, oh = img.drawWidth, img.drawHeight
    ratio = min(max_w / ow if ow > max_w else 1.0, max_h / oh if oh > max_h else 1.0)
    img.drawWidth, img.drawHeight = ow * ratio, oh * ratio
    return img

def figure(path, caption_text, max_h=250):
    return [Spacer(1, 24), fit_image(path, AVAIL * 0.96, max_h), Spacer(1, 8),
            Paragraph(caption_text, cap), Spacer(1, 24)]

def table_block(tbl, caption_text):
    return [Spacer(1, 18), tbl, Spacer(1, 6), Paragraph(caption_text, cap), Spacer(1, 18)]

def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont("FreeSerif", 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(LM, A4[1] - 0.55 * inch, "The Decomposition Atlas — Wave-66 White Paper")
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(1.2)
    canvas.line(LM, A4[1] - 0.62 * inch, A4[0] - RM, A4[1] - 0.62 * inch)
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(LM, 0.62 * inch, A4[0] - RM, 0.62 * inch)
    canvas.setFont("FreeSerif", 7.5)
    canvas.drawString(LM, 0.45 * inch, "SuperInstance Fleet")
    num = "i" if doc.page == 1 else str(doc.page - 1)
    canvas.drawRightString(A4[0] - RM, 0.45 * inch, num)
    canvas.restoreState()

# ---------- story ----------
story = []
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle("TOC0", fontName="FreeSerif", fontSize=11.5, leading=20, leftIndent=14,
                   firstLineIndent=-14, textColor=TEXT_PRIMARY),
    ParagraphStyle("TOC1", fontName="FreeSerif", fontSize=10, leading=16, leftIndent=34,
                   firstLineIndent=-14, textColor=TEXT_MUTED),
]
story.append(Paragraph("<b>Table of Contents</b>", toc_h))
story.append(toc)
story.append(PageBreak())

# ===== 1. The Directive =====
story += h1_block(1, "The Directive",
    "In October 2026 the fleet's principal issued wave-66 with a single, dense instruction: "
    "go further than the waves before it; study the other works pushed recently to SuperInstance, "
    "because they can help the fleet go much further; dog-food the team on what others have done, "
    "both inside and outside the instance, and do it slowly over many rounds; decompose ideas into "
    "elementary parts in spreadsheet logic with the help of jevs finding gates through the layers of "
    "logic as the works grow and evolve; keep timestamped ledgers so the fleet understands more and "
    "more as the works break down how they operate; and level an EXOJ of how to do it again without "
    "the agents. This white paper is the closing receipt of that instruction, and every claim in it "
    "carries a pointer into the ledgers where the proof lives.")
story.append(Paragraph(
    "The instruction contains four distinct demands that previous waves had only partially addressed. "
    "First, the corpus of study was to be the fleet's own sibling works — the twenty-nine repositories "
    "and research streams that SuperInstance has pushed — rather than fresh territory. Second, the "
    "decomposition had to land in spreadsheet logic: elementary parts as rows, attributes as columns, "
    "gates and failure modes as cells, so that any reader can sort, filter, and audit the fleet's "
    "machinery the way an auditor reads a ledger. Third, judgment itself was to be delegated to the "
    "jev machinery the fleet had already built — soft, non-collapsing evaluation with explicit "
    "observation reserved for holes. Fourth, and most unusually, the wave had to finish by destroying "
    "its own dependency on agents: the method must survive as an executable that a fresh instance can "
    "run with no subagent fleet at all.", body))
story.append(Paragraph(
    "The order of operations followed the instruction's own cadence — slowly, over many rounds. Round "
    "one dispatched six parallel lanes across six families of works; round two swept the resulting "
    "decompositions with the jev gate machinery; round three compiled the spreadsheet atlas; round "
    "four leveled the EXOJ kit inside the exoj repository; round five produced this document. Each "
    "round appended timestamped receipts to append-only ledgers before the next round began, so the "
    "wave's own history is auditable in the same style as the works it studied. Nothing in this paper "
    "rests on memory: every number is re-derivable from the committed artifacts.", body))
story.append(Spacer(1, 6))
story.append(callout_row([
    ("29", "WORKS STUDIED"), ("528", "ELEMENTARY PARTS"),
    ("401", "GATES SWEPT"), ("127", "HOLES OBSERVED")]))
story.append(Spacer(1, 12))

# ===== 2. The Corpus =====
story += h1_block(2, "The Corpus: Twenty-Nine Works",
    "Wave-66 studied every substantial work the instance had pushed, organized into six families that "
    "reflect how the fleet actually divides its concerns. The substrate family holds the representation "
    "layer — qthe's one-byte ternary hyper-embedding, quilt-jepa's predictive world model in a cell "
    "mesh, jev-quilt's typed decision-surface cells, and quilt-qcells' receipt ledgers where the ledger "
    "itself is the quantum circuit. The garden family holds the growth machinery: the living jev-garden "
    "training system, the jeviter weave lifecycle, exoj's non-collapsing reasoning surface, and the "
    "fleet-seeds seedbox that spawns charter-bound repositories. The swarm family carries multi-agent "
    "trust: quilt-murmur's gossip economy, the quilt-pincher reflex organism, and crab-traps' "
    "tamper-evident lures.")
story.append(Paragraph(
    "The organ family is the fleet's evidence infrastructure — three live Cloudflare workers, the "
    "quilt-jev-toolkit organ protocol with signed checkpoints and partial custody, the MCP receipt "
    "chain that exposes the fleet's ledgers to any agent on the account, and the research canons that "
    "bind sprint lineage to pre-registered predictions. The labs family drives the substrate through "
    "real domains: a quant trading lab, a database-style vault lane with exact rewind, raw quilt "
    "primitives, a chain-of-thought pipeline, two moth quantum-randomness efforts, and supporting "
    "research. The meta family completes the corpus with the account's public site, its fleet "
    "infrastructure, and — deliberately — the works outside the instance that shaped it: the upstream "
    "quilt repository with its hundred-essay corpus, and five external research streams from V-JEPA 2 "
    "to hyperdimensional computing that the fleet's scouts had receipted months earlier.", body))
corpus_tbl = styled_table(
    ["family", "works", "what it holds"],
    [
        ["substrate", "4", "qthe, quilt-jepa, jev-quilt, quilt-qcells — the representation layer judgment stands on"],
        ["garden", "4", "jev-garden, jeviter, exoj, fleet-seeds — growth, lifecycle, idle-time compilation"],
        ["swarm", "3", "quilt-murmur, quilt-pincher, crab-traps — trust, gossip, reflexes, tamper traps"],
        ["organ", "4", "organ workers, jev-toolkit, mcp-receipts, research-canons — receipts and tamper evidence"],
        ["labs", "6", "quant, dba, raw, cot-quilt, MicroMoth, moth-research — applied domains driving the substrate"],
        ["meta", "8", "site, si-fleet, atlas, codespace, prospector, craftmind, upstream essays, external scouts"],
    ],
    [0.14, 0.09, 0.77], aligns=["l", "c", "l"])
story += table_block(corpus_tbl, "Table 1 — The wave-66 corpus: 29 works across 6 families.")
story.append(Paragraph(
    "Dog-fooding was mandatory before decomposition: each lane ran the cheapest honest verification a "
    "work offers — its smoke test or selftest — under a strict no-network, no-key, under-ninety-seconds "
    "law. Most works passed under their own discipline: jev-garden 30/30, jeviter 85/85, quilt-quant "
    "17/17 offline, quilt-jev-toolkit 44/44, the qcells tamper sweep 4254/4254. The verdicts that were "
    "not green were receipted rather than hidden, and several of those honest negatives became findings "
    "in their own right — a workspace whose normalized file timestamps break mtime-bound seals, a repo "
    "root smoke broken by a moved export while its canonical experiment stays green, an import manifest "
    "staled by later receipts doing exactly its job by failing loudly.", body))

# ===== 3. The Method =====
story += h1_block(3, "The Method: Spreadsheet Logic on Five Layers",
    "Every work was decomposed by one binding schema, written before any decomposition began. Each "
    "elementary part is a row with a stable identifier, a layer, a one-sentence essence, declared "
    "inputs and outputs, a gate, a gate kind, a failure mode, an elementarity flag, and — the law that "
    "keeps the atlas honest — a file-and-line evidence pointer into the studied repository that the "
    "decomposing lane actually read. Elementary means the part cannot be split further without "
    "changing its meaning; if a lane could not evidence a part, the part did not enter the atlas. "
    "Alongside parts, each work contributes its two to five core ideas mapped to the parts that "
    "express them, and a sheet block re-rendering the work as quilt cells in the fleet's own "
    "nine-kind cell vocabulary, so the atlas doubles as a migration sketch into the shared substrate.")
story.append(Paragraph(
    "The five canonical layers are the wave's answer to the principal's phrase 'layers of logic'. They "
    "order every work's internals from the ground up, and because the ordering is shared across all "
    "twenty-nine works, the atlas can compare a quantum ledger's policy layer with a gossip economy's "
    "policy layer directly. A gate is any pass-or-fail condition a part asserts before, during, or "
    "after it acts; the vocabulary is fixed so the gate sweep can treat a seal in an organ protocol "
    "and an admission control in a swarm protocol as the same kind of thing.", body))
layers_tbl = styled_table(
    ["layer", "name", "the question it answers"],
    [
        ["0", "substrate", "what irreducible representation does the work stand on?"],
        ["1", "mechanism", "what transforms state, and from what to what?"],
        ["2", "policy", "what decides, admits, prices, or refuses?"],
        ["3", "interface", "what does the outside touch — wires, tools, sheets?"],
        ["4", "evidence", "what proves it ran, and what makes tampering loud?"],
    ],
    [0.10, 0.18, 0.72], aligns=["c", "l", "l"])
story += table_block(layers_tbl, "Table 2 — The five canonical layers of logic.")
story.append(Paragraph(
    "Two doctrinal rules governed every lane. Decision rules came before runs: the sweep's verdict "
    "rules were receipted into the ledger before the sweep executed, never after. And honest negatives "
    "were crown jewels: a gate the lanes could not find, a test that could not run, a mechanism the "
    "docs oversell — all of these were recorded as first-class rows, because the wave's purpose was "
    "not to flatter the fleet's output but to understand it part by part.", body))

# ===== 4. The Gate Sweep =====
story += h1_block(4, "The Gate Sweep: the Jevas Walk the Layers",
    "With five hundred twenty-eight parts decomposed, the wave let the jevs do what the principal "
    "asked of them: find the gates through the layers of logic. The sweep is an ExoJ field — the "
    "fleet's non-collapsing reasoning surface, running the ledger conservation policy that earlier "
    "experiments established as the naturality fix. Each work occupies a column of a hex lattice; its "
    "five layers are rows. Walking every work from layer zero to layer four, the sweep reads each "
    "part's gate and applies six rules that were receipted before the run began:")
story.append(Paragraph(
    "R1 — a part with a non-empty gate and a known gate kind is OPEN, and receives a soft deformation "
    "of gamma 0.75, eta 0.25, delta 0.50: high confidence mass, low possibility mass, creativity held "
    "in the creative band. R2 — a gate with no kind is SOFT, judged at 0.50/0.50/0.50. R3 — a part "
    "with no gate at all is a HOLE, and the only collapse in the entire system happens there: an "
    "explicit, recorded, local observation at delta 0.20. R4 — seal and conservation gates receive a "
    "second reinforcing emission. R5 — a work missing an entire layer is itself a hole, observed at "
    "that layer's cell. R6 — a work with fewer than five gated parts earns a thinness warning. The "
    "field is the proof object: 606 content-addressed links, verified from genesis.", code_style))
story += figure(f"{SCRIPTS}/w66_fig1_gatekinds.png",
    "Figure 1 — Gate kinds across the atlas: 401 swept gates by kind.")
story.append(Paragraph(
    "The verdict: 401 of 528 parts carry concrete gates — 75.9 percent of the fleet's decomposed "
    "logic is guarded — and every one of them resolved OPEN, meaning no lane wrote a gate it could "
    "not classify. The 127 holes are the wave's most useful yield: unguarded parts are not defects "
    "to hide but the next round's work queue, and they concentrate exactly where the fleet's "
    "documentation lives rather than where its mechanisms live. Invariants dominate the gate-kind "
    "histogram at one hundred, followed by postconditions and admission controls; conservation laws "
    "and budgets are fewer but load-bearing, appearing at the substrate and policy layers of the "
    "most tamper-resistant works.", body))
story.append(Paragraph(
    "Because the field never collapses except at holes, each work closes with a prob_open reading — "
    "the fraction of its judged logic still held open. That number is a live meter of how much of a "
    "work remains unobserved after the sweep, and it is recomputed byte-identically by the kit in "
    "chapter six. The field itself is dunnable: saved as an ExoJ shell, reloadable, re-verifiable, "
    "and content-addressed end to end, so the wave's judgment is itself part of the evidence layer "
    "it studies.", body))

# ===== 5. Findings =====
story += h1_block(5, "Findings",
    "The atlas's first finding is a convergence: across six families that grew largely independently, "
    "the same four moves recur at the same layers. Every family independently arrived at an "
    "irreducible typed row or cell as its substrate; every family hash-chains its evidence append-"
    "only; every family refuses fail-closed with named errors rather than failing silent; and every "
    "family preserves its honest failures — a recorded erratum, a refuted ensemble, an unsealed-"
    "opcode hole — as load-bearing parts of its evidence layer. The fleet did not decree this "
    "convergence; the atlas is the first instrument able to see it, because the atlas is the first "
    "artifact that renders all twenty-nine works in one schema.")
fam_tbl = styled_table(
    ["family", "parts", "gates", "holes", "gated %", "reading"],
    [
        ["substrate", "81", "74", "7", "91%", "representation guarded to the bit; bijections and bounds sealed"],
        ["garden", "92", "89", "3", "97%", "lifecycle law: promotion, discard, and observation all gated"],
        ["swarm", "68", "49", "19", "72%", "economics guarded; reflex wiring carries the holes"],
        ["organ", "75", "69", "6", "92%", "the tamper-evidence core: 26 named fail-closed codes in one work alone"],
        ["labs", "78", "65", "13", "83%", "applied discipline holds under real domains; docs lag mechanisms"],
        ["meta", "134", "55", "79", "41%", "prose and positioning: the logic lives in text, not gates — the wave's queue"],
    ],
    [0.13, 0.09, 0.09, 0.09, 0.11, 0.49], aligns=["l", "c", "c", "c", "c", "l"])
story += table_block(fam_tbl, "Table 3 — Sweep results by family: parts, gated parts, observed holes.")
story += figure(f"{SCRIPTS}/w66_fig2_families.png",
    "Figure 2 — OPEN gates versus observed holes per family; the meta family is the work queue.")
story.append(Paragraph(
    "The second finding is the shape of the hole distribution. The organ and garden families are "
    "gate-dense — the organ family's toolkit alone carries a twenty-six-code fail-closed law with "
    "file-and-line evidence for every code — while the meta family is hole-dense, at forty-one "
    "percent gated. That is not an indictment: a positioning site and an essay corpus are prose, "
    "and prose resists gates by nature. But it tells the fleet precisely where the next wave's "
    "decomposition effort pays: turning the account's public claims into testable, gatable parts, "
    "or consciously marking them as out of scope.", body))
story.append(Paragraph(
    "The third finding is operational. The dog-food round surfaced environment-level traps that no "
    "single repo could have seen alone: workspace file mtimes normalized to one value, which breaks "
    "every mtime-bound seal the fleet uses and argues for content-hash seals going forward; a "
    "node-version quirk where an explicit test-directory invocation fails while package-script "
    "invocation passes; two repos whose own scripts rewrite their output artifacts mid-run, which "
    "the lanes handled by restoring committed state and receipting the incident. Each of these was "
    "receipted with its evidence, and each is a candidate gate for a future fleet-standard smoke "
    "harness.", body))

# ===== 6. The EXOJ Kit =====
story += h1_block(6, "The EXOJ Kit: Doing It Again Without Them",
    "The wave's final demand was the uncommon one: level an EXOJ of how to do it again without the "
    "agents. The exoj repository now carries the atlas kit — atlas.mjs, a zero-dependency executable "
    "with four verbs. Verify re-checks the bundled artifact of record in six checks, from corpus "
    "integrity through referential integrity of every idea-to-part and cell-to-part reference to the "
    "606-link chain of the saved judgment field. Sweep re-runs the gate walk from the pre-registered "
    "rules, which live in the module itself so they can never silently drift. Csv emits the whole "
    "spreadsheet logic — corpus, parts, gates, ideas, cells — for any spreadsheet tool. Protocol "
    "prints the seven-move runbook, from registry to seal, for a fresh instance with no fleet.")
story.append(Paragraph("node atlas.mjs verify      # artifact of record: 6 checks<br/>"
    "node atlas.mjs sweep      # pre-registered gate walk, exoj policy=ledger<br/>"
    "node atlas.mjs csv        # corpus / parts / gates / ideas / cells as CSV<br/>"
    "node atlas.mjs protocol   # the seven moves, start to seal<br/>"
    "node experiments/e_x8_atlas_gatesweep.mjs   # replay == artifact of record", code_style))
story.append(Paragraph(
    "The claim that the kit reproduces the wave is itself receipted as experiment E-X8, and its "
    "result is the strongest number in this paper: the kit's replay lands on the byte-identical "
    "chain tip as the live sweep — 13463fd0, six hundred six links — with all twenty-nine per-work "
    "verdict maps and both histograms exactly equal, and a second replay run proving determinism. "
    "Offline, keyless, agent-free, the wave re-runs itself from its own bones. The experiment also "
    "caught its own harness bug during development — the kit's command-line interface executed on "
    "import under ESM, silently ending the replay with a usage message — which is exactly the class "
    "of failure the kit exists to make loud rather than silent.", body))
ex8_tbl = styled_table(
    ["E-X8 check", "result"],
    [
        ["R2 kit self-verification", "PASS — 6/6 (corpus, parts, refs, artifact totals, field chain, ledgers)"],
        ["R1 replay totals", "PASS — parts 528 / gated 401 / OPEN 401 / SOFT 0 / HOLE 127, equal"],
        ["R1 per-work verdict maps", "PASS — 29/29 works agree on OPEN/SOFT/HOLE and seal reinforcement"],
        ["R1 histograms", "PASS — gate-kind and layer histograms identical"],
        ["R1 chain tip", "PASS — byte-identical 13463fd0… (606 links)"],
        ["R3 determinism", "PASS — two kit runs land on the same chain tip"],
    ],
    [0.34, 0.66], aligns=["l", "l"])
story += table_block(ex8_tbl, "Table 4 — E-X8: the kit replays the wave without agents.")
moves_tbl = styled_table(
    ["move", "act", "leaves behind"],
    [
        ["1", "REGISTRY — corpus.json of every work worth studying, in and out of the instance", "the map"],
        ["2", "DECOMPOSE — elementary parts per the binding schema, smoke-verdict first", "parts / family / work.json"],
        ["3", "PREREGISTER — sweep rules receipted before any judgment", "rules row, chained"],
        ["4", "SWEEP — the jev walk: soft emits for gates, observation at holes", "gate-map + field shell"],
        ["5", "READ THE MAP — gated percentage, hole queue, prob_open per work", "the next round's queue"],
        ["6", "COMPILE — spreadsheet logic for humans, with live cross-checks", "atlas workbook / CSVs"],
        ["7", "SEAL — verify, commit, append-only, hand the bones to the next instance", "the kit itself"],
    ],
    [0.08, 0.55, 0.37], aligns=["c", "l", "l"])
story += table_block(moves_tbl, "Table 5 — The seven moves of the decomposition protocol.")
story.append(Paragraph(
    "One honesty note belongs in the closing chapter rather than a footnote: this container holds no "
    "GitHub credential material, so the kit's commit — a993ed6, the artifact of record — is verified "
    "local only, and the push is receipted as pending rather than claimed. The fleet's push discipline "
    "requires remote-equals-local verification, and that step will complete wherever a token exists; "
    "nothing about the kit or the atlas depends on it. The deeper point the wave leaves behind is "
    "the one the principal asked for: the method now has an exoj. The next instance does not inherit "
    "a story about how wave-66 was made — it inherits an executable that makes wave-66 again, and a "
    "ledger that proves the two are indistinguishable.", body))

# ---------- build ----------
BODY_PDF = f"{SCRIPTS}/w66_body.pdf"
doc = TocDocTemplate(BODY_PDF, pagesize=A4,
                     leftMargin=LM, rightMargin=RM, topMargin=TM, bottomMargin=BM,
                     title="The Decomposition Atlas — Wave-66 White Paper",
                     author="Z.ai", creator="Z.ai",
                     subject="How SuperInstance decomposed 29 works into spreadsheet logic, swept their gates with jevs, and leveled an EXOJ to do it again without agents")
doc.multiBuild(story, onFirstPage=on_page, onLaterPages=on_page)
print("body built:", BODY_PDF)

# ---------- merge cover ----------
from pypdf import PdfReader, PdfWriter
A4_W, A4_H = 595.28, 841.89

def normalize(page):
    w, h = float(page.mediabox.width), float(page.mediabox.height)
    if abs(w - A4_W) > 0.5 or abs(h - A4_H) > 0.5:
        page.scale_to(A4_W, A4_H)
    return page

writer = PdfWriter()
writer.add_page(normalize(PdfReader(f"{SCRIPTS}/w66_cover.pdf").pages[0]))
for p in PdfReader(BODY_PDF).pages:
    writer.add_page(normalize(p))
writer.add_metadata({"/Title": "The Decomposition Atlas — Wave-66 White Paper",
                     "/Author": "Z.ai", "/Creator": "Z.ai",
                     "/Subject": "Wave-66: decomposition atlas, jev gate sweep, EXOJ kit"})
FINAL = "/home/z/my-project/download/decomposition-atlas-whitepaper.pdf"
with open(FINAL, "wb") as f:
    writer.write(f)
print("final:", FINAL, "pages:", len(writer.pages))
