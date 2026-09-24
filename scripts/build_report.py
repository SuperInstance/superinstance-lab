#!/usr/bin/env python3
"""Quilt play-test report - body PDF (ReportLab, TOC via TocDocTemplate + multiBuild)."""
import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                Table, TableStyle, Image, KeepTogether, CondPageBreak)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from PIL import Image as PILImage

PDF_SKILL_DIR = '/home/z/my-project/skills/pdf'
sys.path.insert(0, os.path.join(PDF_SKILL_DIR, 'scripts'))
from pdf import install_font_fallback

FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                   italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')
install_font_fallback()

# -- palette.cascade output (auto-generated, do not hand-edit) --
PAGE_BG       = colors.HexColor('#f1f0ee')
SECTION_BG    = colors.HexColor('#ecebea')
CARD_BG       = colors.HexColor('#e9e7e2')
TABLE_STRIPE  = colors.HexColor('#edece9')
HEADER_FILL   = colors.HexColor('#504a36')
COVER_BLOCK   = colors.HexColor('#797052')
BORDER        = colors.HexColor('#d0cdc2')
ICON          = colors.HexColor('#927f45')
ACCENT        = colors.HexColor('#866f2c')
ACCENT_2      = colors.HexColor('#4895ae')
TEXT_PRIMARY  = colors.HexColor('#1e1d1b')
TEXT_MUTED    = colors.HexColor('#8c8982')
SEM_SUCCESS   = colors.HexColor('#497d5a')
SEM_WARNING   = colors.HexColor('#a7894d')
SEM_ERROR     = colors.HexColor('#aa4e46')
SEM_INFO      = colors.HexColor('#526d89')

OUT_DIR = '/home/z/my-project/download/quilt-playtest'
OUT_PDF = os.path.join(OUT_DIR, 'quilt-playtest-report.pdf')

MARGIN = 0.9 * inch
PAGE_W, PAGE_H = A4
AVAIL_W = PAGE_W - 2 * MARGIN
H1_ORPHAN = (PAGE_H - 2 * MARGIN) * 0.18

# -- styles --
h1 = ParagraphStyle('H1x', fontName='FreeSerif', fontSize=20, leading=26,
                    textColor=HEADER_FILL, spaceBefore=18, spaceAfter=10)
h2 = ParagraphStyle('H2x', fontName='FreeSerif', fontSize=14.5, leading=20,
                    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=6)
body = ParagraphStyle('Bodyx', fontName='FreeSerif', fontSize=10.5, leading=16.5,
                      textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=8)
bullet = ParagraphStyle('Bulletx', parent=body, alignment=TA_LEFT, leftIndent=16,
                        bulletIndent=4, spaceAfter=5)
quote = ParagraphStyle('Quotex', parent=body, fontName='FreeSerif-Italic',
                       leftIndent=24, textColor=HEADER_FILL, spaceBefore=6, spaceAfter=10)
caption = ParagraphStyle('Captionx', fontName='FreeSerif', fontSize=8.5, leading=12,
                         textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=6)
code = ParagraphStyle('Codex', fontName='DejaVuSans', fontSize=8, leading=11.5,
                      textColor=TEXT_PRIMARY, backColor=CARD_BG, leftIndent=8,
                      borderPadding=6, spaceBefore=6, spaceAfter=8)
th = ParagraphStyle('THx', fontName='FreeSerif', fontSize=9.5, leading=13,
                    textColor=colors.white, alignment=TA_LEFT)
td = ParagraphStyle('TDx', fontName='FreeSerif', fontSize=9, leading=13,
                    textColor=TEXT_PRIMARY, alignment=TA_LEFT)
stat_style = ParagraphStyle('StatBig', fontName='FreeSerif', fontSize=20, leading=24,
                            textColor=ACCENT, alignment=TA_CENTER)
label_style = ParagraphStyle('StatLabel', fontName='FreeSerif', fontSize=8, leading=11,
                             textColor=TEXT_MUTED, alignment=TA_CENTER)

# -- TOC machinery --
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def heading(text, style, level=0):
    key = 'h_' + hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph(f'<a name="{key}"/><b>{text}</b>', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def H1(story, text):
    story.append(CondPageBreak(H1_ORPHAN))
    story.append(heading(text, h1, 0))

def H2(story, text):
    story.append(CondPageBreak(H1_ORPHAN * 0.6))
    story.append(heading(text, h2, 1))

def P(story, text):
    story.append(Paragraph(text, body))

def B(story, text):
    story.append(Paragraph(f'•  {text}', bullet))

def callout_row(story, stats):
    """Row of stat callout boxes. stats = [(big, label), ...]"""
    n = len(stats)
    w = min(150, (AVAIL_W - (n - 1) * 12) / n)
    cells = []
    for big, lab in stats:
        inner = Table([[Paragraph(f'<b>{big}</b>', stat_style)],
                       [Paragraph(lab, label_style)]], colWidths=[w])
        inner.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
            ('BOX', (0, 0), (-1, -1), 1, ACCENT),
            ('TOPPADDING', (0, 0), (-1, 0), 8), ('BOTTOMPADDING', (0, 0), (-1, 0), 0),
            ('TOPPADDING', (0, 1), (-1, 1), 1), ('BOTTOMPADDING', (0, 1), (-1, 1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        cells.append(inner)
    outer = Table([cells], colWidths=[w + 12] * n, hAlign='CENTER')
    outer.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                               ('LEFTPADDING', (0, 0), (-1, -1), 0),
                               ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    story.append(Spacer(1, 8))
    story.append(outer)
    story.append(Spacer(1, 10))

def make_table(story, header, rows, ratios, title=None):
    data = [[Paragraph(f'<b>{c}</b>', th) for c in header]]
    for r in rows:
        data.append([Paragraph(str(c), td) for c in r])
    widths = [x * AVAIL_W for x in ratios]
    t = Table(data, colWidths=widths, hAlign='CENTER', repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, 0), 0.8, HEADER_FILL),
        ('LINEBELOW', (0, -1), (-1, -1), 0.6, BORDER),
        ('LINEABOVE', (0, 0), (-1, 0), 0.6, BORDER),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style))
    story.append(Spacer(1, 10))
    if title:
        story.append(Paragraph(title, caption))
    story.append(t)
    story.append(Spacer(1, 12))

def embed_image(path, max_width=None, max_height=None):
    if max_width is None: max_width = AVAIL_W
    if max_height is None: max_height = PAGE_H * 0.32
    pil = PILImage.open(path)
    ow, oh = pil.size
    ratio = min(max_width / ow if ow > max_width else 1.0,
                max_height / oh if oh > max_height else 1.0)
    return Image(path, width=ow * ratio, height=oh * ratio)

def footer_canvas(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BORDER); canvas.setLineWidth(0.6)
    canvas.line(MARGIN, PAGE_H - MARGIN + 14, PAGE_W - MARGIN, PAGE_H - MARGIN + 14)
    canvas.setFont('FreeSerif', 7.5); canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, PAGE_H - MARGIN + 18, 'Quilt Play-Test Report - SuperInstance/quilt v0.3.0')
    canvas.setFont('FreeSerif', 7.5)
    canvas.drawString(MARGIN, MARGIN - 24, 'Prepared by Super Z (Z.ai) - multi-agent play-test')
    canvas.drawRightString(PAGE_W - MARGIN, MARGIN - 24, f'page {doc.page}')
    canvas.restoreState()

doc = TocDocTemplate(OUT_PDF, pagesize=A4,
                     leftMargin=MARGIN, rightMargin=MARGIN,
                     topMargin=MARGIN + 8, bottomMargin=MARGIN,
                     title='Quilt Play-Test Report: Finding the Real Value of a Reactive Cellular Runtime',
                     author='Z.ai', creator='Z.ai',
                     subject='Extensive play-test and iteration of SuperInstance/quilt')

story = []

# ---- TOC page ----
toc_title = ParagraphStyle('TocTitle', fontName='FreeSerif', fontSize=18, leading=24,
                           textColor=HEADER_FILL, spaceAfter=14)
story.append(Paragraph('<b>Table of Contents</b>', toc_title))
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle('TOC0', fontName='FreeSerif', fontSize=11, leading=18, leftIndent=6),
    ParagraphStyle('TOC1', fontName='FreeSerif', fontSize=9.5, leading=15, leftIndent=24,
                   textColor=TEXT_MUTED),
]
story.append(toc)
story.append(PageBreak())

# ============================ Chapter 1 ============================
H1(story, '1. Executive Summary')
P(story, 'This report documents an extensive, adversarial play-test of the open-source repository '
         '<b>SuperInstance/quilt</b>, a reactive cellular runtime pitched as "a spreadsheet that thinks, '
         'a database that reacts, a control plane that is a single file." Rather than only reading the code, '
         'we did what the runtime asks of its users: we built live sheets, pushed sensor streams into them, '
         'wired listeners to actions, federated engines across instances, and connected real large-language-model '
         'calls into cells. Every claim in this report is backed by a runnable experiment, and all experiments '
         'ship with this report as working artifacts.')
P(story, 'The headline conclusion is a story of two halves. The core model of Quilt is genuinely distinctive: '
         'nine cell kinds evaluated over a dependency graph, caller-context routing, and per-context memoization '
         'add up to a programming model we have not seen elsewhere. At the same time, systematic probing revealed '
         'that the reactive wiring was substantially disconnected in the shipped v0.3.0 code: listener cells never '
         'fired because their watch lists were never wired into the graph, set() was invisible to get() on value '
         'cells, and several of the repository\'s own example sheets contained conditions that could never fire. '
         'None of these are design flaws; they are integration bugs between good ideas, and all of them are fixable.')
P(story, 'We did not stop at filing findings. We patched the engine, rebuilt the example fleet, and re-ran '
         'everything until the entire reactive story worked end to end, including the flagship scenario: a '
         'support-ticket triage sheet in which real GLM model calls score urgency and draft replies, with an '
         'escalation gate that kept the cheap ticket reply-free. The result is a PR-ready patch set (727 lines, '
         '36 of 36 upstream tests still passing) plus five working demonstrations of where the real value of '
         'Quilt lies.')
callout_row(story, [
    ('7', 'engine patches contributed'),
    ('36 / 36', 'upstream tests still green'),
    ('9 / 11', 'adversarial probes passing'),
    ('5', 'working novel demos shipped'),
    ('7', 'real LLM calls in the triage demo'),
])

# ============================ Chapter 2 ============================
H1(story, '2. What Quilt Is')
P(story, 'Quilt models an entire software system as a <b>sheet</b>: a JSON or YAML document of <b>cells</b>, '
         'each addressed by a stable id such as "compass.heading" rather than a spreadsheet coordinate. A cell is '
         'a tagged union of nine kinds, and the kind alone determines evaluation semantics: value and formula '
         'cells are pure and pull-based; sensor and io cells are push-based value holders; api, program, router '
         'and ai cells are effectful, memoized capabilities that only compute when explicitly called; and listener '
         'cells fire actions when watched cells change. One engine evaluates the graph, tracks dependencies, '
         'propagates invalidation, and exposes a universal API of get, set, call, push and subscribe.')
P(story, 'Two ideas distinguish Quilt from the crowd of reactive frameworks. First, every call carries a '
         '<b>CallerContext</b> (row, column, identity, tags, trace) that flows down the dependency graph, so the '
         'same cell can route differently per tenant, per device, or per user tier, and its results are memoized '
         'per context. Second, the repository experiments boldly at the edges: a differential-geometry module '
         '(Gesture) that reads value histories as paths through state space, a federated SDK for addressing cells '
         'across engines with quilt:// URIs, an MCP server exposing cells as agent tools, and YAML sheets that '
         'round-trip through a CLI. The 25-repo ecosystem story around these primitives is ambitious, but the '
         'five packages in this repository (core, sdk, mcp, tui, cli) are the substance.')
make_table(story,
    ['Kind', 'Trigger', 'Pure', 'Evaluation', 'Our verdict'],
    [
        ['value', 'never', 'yes', 'static, stored', 'the state holders; set() drives the graph'],
        ['formula', 'pull', 'yes', 'expression DSL over ids', 'the workhorse; auto-tracks deps'],
        ['sensor / io', 'push', 'no', 'external adapters push data', 'the entry point for live streams'],
        ['api / program / ai', 'call', 'no', 'async, memoized per context', 'the capabilities; LLM cells shine here'],
        ['router', 'call', 'no', 'first matching rule wins', 'policy-as-data; reads caller context'],
        ['listener', 'dep change', 'no', 'condition + action', 'the reactive glue; needed repair'],
    ],
    [0.14, 0.10, 0.07, 0.30, 0.39],
    'Table 1. The nine cell kinds and how they behaved under play-testing.')

# ============================ Chapter 3 ============================
H1(story, '3. How We Play-Tested')
P(story, 'We ran the play-test as a closed loop: probe, patch, rebuild, re-run, in the same session, on a clone '
         'of the repository with its own test suite as the safety net. Three instruments did the work. First, an '
         '<b>adversarial probe suite</b> of eleven experiments designed to attack the reactive guarantees '
         'themselves: subscription visibility, listener firing, dependency cycles, deep chains, wide fan-out, '
         'NaN propagation, and per-tenant cache isolation. Second, an <b>example-fleet harness</b> that loads the '
         'repository\'s own YAML sheets (boat-autopilot, weather-monitor, sensor-anomaly, task-scheduler) and '
         'drives them through their alert paths exactly as a production harness would, using push and set plus '
         'subscriptions. Third, a set of <b>novel-use demos</b> built to answer the question the README raises '
         'but does not answer: what is this actually good for once it works?')
P(story, 'Every engine patch was followed by a full rebuild and re-run of the 36 upstream tests, the probe suite, '
         'and the fleet harness. The probe suite ended at nine of eleven passing, with the two remaining failures '
         'deliberately left as documented semantic gaps rather than patches: NaN flows through the pure graph '
         'silently, and formulas that depend on effectful cells read their last evaluated value without any '
         'invalidation signal. We believe both deserve design discussion upstream before code changes.')
P(story, 'The novel demos were deliberately chosen to stress different value claims: a <b>Cell EKG</b> that wires '
         'the Gesture math to live subscriptions; a <b>federation bridge</b> that supplies the missing adapter '
         'between the engine and the SDK; a <b>multi-tenant gateway</b> that turns one sheet into a whole backend; '
         'and an <b>LLM triage sheet</b> that connects a real model provider to the ai cell kind. Together they '
         'cover the runtime\'s three layers: pure reactivity, distribution, and intelligence.')

# ============================ Chapter 4 ============================
H1(story, '4. Findings: Where the Runtime Broke')
P(story, 'The probe suite and fleet harness surfaced seven defects serious enough to patch and two semantic '
         'gaps we documented instead. What follows is the evidence trail. The most important finding came first '
         'and set the tone for the whole exercise: within minutes of building a from-scratch sheet, a dashboard '
         'subscription on a formula cell caught nothing, and a listener watching a threshold formula never fired. '
         'Tracing those two symptoms to their roots exposed the disconnects below.')

H2(story, '4.1 Listener cells were dead code as shipped')
P(story, 'The engine\'s loadSheet builds dependency edges from each cell\'s declared deps field and, for formula '
         'and ai cells, by scanning expressions for known ids. The listener\'s watch list is a separate field and '
         'was simply never wired into the graph. Propagation walks dependents, so a listener with no incoming '
         'edge is never reached and fireListener is never called. Every example sheet in the repository declares '
         'listeners with watch but without deps, which means the entire alerting layer of the shipped examples '
         'was inert. The fix is two loops in loadSheet and register that call addDep for each watched id; after '
         'it, the flagship boat-autopilot sheet fired its off-course alert on the first push, producing '
         '"Off course by 85 degrees" exactly as its description promises.')

H2(story, '4.2 set() was invisible to get() on value cells')
P(story, 'evaluateValue returned cell.def.value, the static value from the sheet definition, while engine.set '
         'writes the live cell.value. Downstream formulas read the live value and recomputed correctly, but any '
         'direct read of the cell itself served the original definition forever. In our federation demo the cloud '
         'roll-up cell reported 0 after being set to 30; cell inspection showed data 30 while get() returned 0. '
         'Since loadSheet already seeds cell.value from def.value, the fix is for get() on a value cell to return '
         'the live value. This is the classic stale-read asymmetry that unit tests miss when they only assert on '
         'downstream formulas.')

H2(story, '4.3 Silent failure modes everywhere')
P(story, 'Three separate mechanisms swallow errors and leave sheet authors with no signal. evalWhen compiles '
         'conditions with new Function inside a try/catch that returns false on any throw, so the weather '
         'monitor\'s condition "=is_comfortable == false" (a leading equals sign copied from formula style) was a '
         'guaranteed SyntaxError evaluated on every fire and never surfaced. The contains sugar rewrote '
         '"caller.identity.tags contains \'free\'" into an expression referencing a bare variable tags that does '
         'not exist in scope, again silently false, which made every tenant in our multi-tenant demo fall through '
         'to the catch-all rule. And a listener with a missing or io-cell action "fires" into the void: io cells '
         'are push-only holders, so calling one as an action is a silent no-op. We fixed the contains rewrite and '
         'the example sheets; we recommend upstream also log or raise on unparseable conditions.')

H2(story, '4.4 Memoization semantics: powerful, then leaky')
P(story, 'The per-context cache is the runtime\'s best idea and its most surprising liability. On the positive '
         'side, after our router-context fix, one program cell served two tenants with isolated cached results '
         '(keys f:cap.answer|i:acme|t:premium and |i:globex|t:standard) and a third tenant was blocked at the '
         'router without ever reaching the model. On the liability side, three gaps emerged. contextKey excludes '
         'input, so the same context with a different request body returns the first request\'s memoized answer. '
         'Listener-triggered program actions were cached after their first fire because the listener always '
         'called with an identical empty context, so our EWMA state machine ran exactly once until we gave each '
         'fire a fresh event context. And program and router cells were not invalidated when declared upstream '
         'cells changed, so an LLM workflow cell served its first ticket\'s result forever; we added both kinds '
         'to the invalidation set.')

H2(story, '4.5 Cycles, NaN, and the pull-path cliff')
P(story, 'A two-cell dependency cycle crashed engine.get() with a stack overflow in refreshDeps and hung '
         'engine.set() propagation. We added a visited-set guard to propagation; the pull path on an idle cyclic '
         'sheet still overflows and deserves a load-time cycle check. Meanwhile the pure graph happily propagates '
         'NaN with status ready (a formula over an unpushed sensor yields NaN silently), which contradicts the '
         'typed-runtime ambition and should be a validation concern. On the performance side, the news is good: '
         'a push fans out to 5,000 formula dependents in 3 to 5 milliseconds, and a 900-deep chain evaluates in '
         'about 760 milliseconds, though profiling suggests most of that budget is spent recompiling expression '
         'strings with new Function on every evaluation; a compiled-function cache would be a cheap win.')
make_table(story,
    ['#', 'Probe', 'Before patches', 'After patches'],
    [
        ['P1', 'subscription on formula fires on input change', 'no (lazy pull)', 'yes (eager mode)'],
        ['P2', 'listener on threshold formula fires on push', 'no (stale data)', 'yes'],
        ['P3', 'listener on sensor fires with event payload', 'no (no edge)', 'yes'],
        ['P4', 'cycle a-b-a behavior', 'stack overflow / hang', 'push guarded; idle get still overflows'],
        ['P5', '900-deep formula chain', 'evaluates in ~760 ms', 'unchanged (documented)'],
        ['P6', 'push fan-out to 5,000 formulas', '3-5 ms', 'unchanged'],
        ['P7', 'NaN guard on missing sensor', 'NaN with status ready', 'documented gap'],
        ['P8', 'per-tenant memoization (3 calls, 2 tenants)', 'works (2 evaluations)', 'works'],
        ['P9', 'formula sees re-evaluated program', 'stale NaN', 'fixed via invalidation + declared deps'],
        ['P10', 'set vs get error asymmetry', 'documented behavior', 'unchanged'],
        ['P11', 'Gesture math sanity', 'works', 'works'],
    ],
    [0.06, 0.36, 0.28, 0.30],
    'Table 2. The eleven-probe adversarial suite, before and after.')

# ============================ Chapter 5 ============================
H1(story, '5. Iterating: The Patch Set We Contributed')
P(story, 'All fixes live in one reviewable diff (727 lines including comments and example-sheet rewrites) with '
         'each hunk annotated with the play-test finding that motivated it. Every patch was validated against the '
         'upstream test suite after the change, and the full example fleet plus all five demos were re-run end to '
         'end. We consider the first three patches blocking for anyone who wants to use listeners at all, and the '
         'remaining four as correctness and robustness hardening that the reactive model deserves.')
make_table(story,
    ['#', 'Patch', 'File', 'Effect'],
    [
        ['1', 'wire listener watch lists into the dependency graph', 'engine.ts', 'listeners actually fire; the example fleet lights up'],
        ['2', 'value cells: get() returns live value, not def value', 'engine.ts', 'set() becomes visible to readers; no stale reads'],
        ['3', 'eager mode option: recompute stale formulas during propagation', 'engine.ts', 'subscribers and listeners observe real transitions'],
        ['4', 'propagation cycle guard (visited set)', 'engine.ts', 'push on cyclic sheets no longer hangs'],
        ['5', 'fresh event context per listener fire', 'listener.ts', 'actions run every fire and can read the event payload'],
        ['6', 'router passes caller context; contains sugar fixed', 'router.ts, context.ts', 'per-tenant cache isolation; tier rules match'],
        ['7', 'program and router caches invalidated by upstream changes', 'engine.ts', 'workflows see new inputs instead of first-run results'],
    ],
    [0.05, 0.37, 0.17, 0.41],
    'Table 3. The seven engine patches, all validated against 36/36 upstream tests.')
P(story, 'Three example sheets were repaired in the same spirit. The weather monitor\'s io-cell actions became '
         'program cells (io actions are silent no-ops) and its leading-equals condition was corrected; the task '
         'scheduler\'s any_overdue aggregation moved from a program cell to a formula, because derived boolean '
         'state must be pure and auto-tracked to be watchable; and the sensor-anomaly sheet was redesigned into a '
         'push-driven loop that actually works: an EWMA baseline held in a value cell, updated by a '
         'listener-to-program step through runtime.set, with z-score and escalation as formulas and an '
         'edge-triggered escalation listener. That redesign doubles as the canonical recipe we recommend for '
         'stateful reactive loops in Quilt.')

# ============================ Chapter 6 ============================
H1(story, '6. Working Examples')
P(story, 'This chapter is the deliverable the exercise was really about: five demonstrations, each answering a '
         'different "what is this good for" question with a running artifact. Every demo ships as a single '
         'runnable script in the accompanying package, and each was executed to completion during the session. '
         'Together they cover the three layers of the runtime: pure reactivity, distribution, and intelligence.')

H2(story, '6.1 The spreadsheet that thinks (flagship)')
P(story, 'The repository defines an ai cell kind with eight sub-kinds and template interpolation of upstream '
         'cells, but ships no working provider in-repo, so its own demo\'s ai cell errors out at runtime. We wired '
         'the z-ai-web-dev-sdk into the engine\'s AIEngineLike interface (a small adapter class), then built a '
         'support-ticket triage sheet: ticket text flows into ai.urgency and ai.sentiment cells (real GLM calls), '
         'a policy formula compares urgency against an escalation threshold, and an orchestrated workflow program '
         'pulls it all together, calling ai.reply only for escalated tickets. Because set() on the ticket cell '
         'invalidates dependent ai caches, each new ticket produces fresh model calls with no manual cache '
         'management. Three real tickets produced urgency scores of 1, 10, and 7 out of 10; the production-outage '
         'ticket escalated and received a drafted, empathetic reply; the pricing-typo ticket never reached the '
         'reply model. Seven real LLM calls in total, each one a cell evaluation.')
story.append(Spacer(1, 14))
story.append(embed_image(os.path.join(OUT_DIR, 'chart-triage.png'), max_height=230))
story.append(Paragraph('Figure 1. Real GLM calls inside the reactive graph: per-ticket urgency, sentiment, and the escalation gate.',
                       caption))
story.append(Spacer(1, 12))

H2(story, '6.2 Cell EKG: gesture math as runtime observability')
P(story, 'The Gesture module, which computes arc length, bending energy, twist, and planarity over value '
         'trajectories, is the most distinctive mathematics in the repository, and nothing in the runtime uses '
         'it. Our Cell EKG attaches to any engine through subscriptions, maintains sliding windows of numeric '
         'cells, and classifies each cell\'s motion: drifting, oscillating, regime-shifting, or stuck. Driven by a '
         'synthetic plant sensor that moves through four phases, the monitor flagged the drift onset, caught the '
         'cooling-loop oscillation at the moment the loop began hunting (bending energy 0 to 2), and registered '
         'the settle. A naive threshold alarm at 80 degrees never fired at all because the fault never took the '
         'temperature past 64. That is the pitch in one sentence: alarms on how values move, not on what they '
         'are. The honest caveats: one-dimensional gestures have zero twist, so regime-shift detection needs '
         'vector cells, and the sliding window adds hysteresis to phase exits.')
story.append(Spacer(1, 14))
story.append(embed_image(os.path.join(OUT_DIR, 'chart-ekg.png'), max_height=230))
story.append(Paragraph('Figure 2. The Cell EKG detecting motion-phase transitions that a threshold alarm cannot see.', caption))
story.append(Spacer(1, 12))

H2(story, '6.3 One sheet as a multi-tenant backend')
P(story, 'A single sheet defined one capability cell, one router with tier rules, and nothing else, then served '
         'three simulated tenants. The premium and standard tenants received isolated, memoized answers from the '
         'same cell (distinct per-context cache keys), the free tier was rejected at the router with a '
         'quota-exceeded payload before reaching the capability, and the model was invoked exactly twice for '
         'three sessions. This is the caller-context memoization idea doing exactly what the README promises, '
         'and it is the demo we would put in front of any backend engineer. The caveat from Section 4.4 applies: '
         'requests that differ only in body need distinct context (today, a row value per request id) until '
         'per-input cache keys land.')

H2(story, '6.4 Federation: three engines, one graph')
P(story, 'The SDK ships LocalCellTransport and CellRouter for addressing cells across engine instances with '
         'quilt:// URIs, but its documented compatibility with QuiltEngine does not exist in code: the SDK expects '
         'a LocalEngine interface the engine does not implement. We wrote the missing adapter, twenty lines that '
         'map getCell, setCell and subscribe onto engine.get, engine.set or push, and engine.subscribe, then '
         'linked edge, server, and cloud engines. Steering the edge boat propagated rudder commands through a '
         'server-side mirror into a cloud worst-case roll-up (0, 15, 30 degrees as the steering hardened), and a '
         'remote alert handle resolved across instances fired when we shoved the compass 170 degrees off course. '
         'The adapter is included in the deliverables and, we would argue, belongs in the SDK.')

H2(story, '6.5 From-scratch reactive app and the repaired fleet')
P(story, 'Finally, the baseline: a nine-cell service-health sheet built from nothing in one file (sensors, '
         'formulas, an edge-triggered pager listener, a program action, and a filtered dashboard subscription), '
         'and the repository\'s own example fleet driven through every alert path. After the patches, all five '
         'scenarios fire: the boat goes off course, the weather turns dangerous, the anomaly loop escalates on a '
         'self-tuned baseline, the scheduler flags overdue tasks, and the trace ring records every evaluation '
         'with durations. A sheet author following today\'s documentation gets all of this for free once the '
         'patch set lands.')
make_table(story,
    ['Demo', 'Lines', 'Novel use', 'Status'],
    [
        ['e5_llm_cells.mjs', '~150', 'real GLM cells in a reactive sheet', 'verified, 7 real model calls'],
        ['e3_gesture_ekg.mjs', '~110', 'gesture math as cell observability', 'verified, 3 phase transitions'],
        ['e6_multitenant.mjs', '~90', 'one sheet, per-tenant memoized gateway', 'verified, cache keys isolated'],
        ['e4_federation.mjs', '~120', 'missing engine-SDK adapter, 3 engines', 'verified, rollup + remote alerts'],
        ['e2_reactive_basics.mjs', '~60', 'from-scratch reactive app', 'verified, green-amber-red paging'],
        ['e7_probes.mjs', '~180', 'adversarial semantics suite', '9 / 11 passing'],
    ],
    [0.24, 0.09, 0.42, 0.25],
    'Table 4. The shipped demo package (all runnable against the patched clone).')

# ============================ Chapter 7 ============================
H1(story, '7. Where the Real Value Is')
P(story, 'Stripped of the 25-repo framing, play-testing suggests Quilt\'s real value concentrates in five places, '
         'ranked here by how quickly they turned into working software once the wiring was fixed. First, the '
         '<b>caller-context model</b>: position, identity, and tags flowing through the graph with per-context '
         'memoization is a genuinely rare primitive that turns one sheet into a policy-aware, multi-tenant '
         'gateway. Second, <b>ai cells as reactive citizens</b>: once a provider is wired, LLM calls become '
         'cache-invalidating, dependency-tracked cells inside a graph, and the triage demo shows how compelling '
         'that is; we know of no spreadsheet-like runtime where a model call is just another cell with freshness '
         'semantics. Third, the <b>push-pull-call triad</b>: sensors stream in, formulas stay pure and lazy, '
         'effectful cells stay explicit, and listeners bridge them; after our patches this triad behaves exactly '
         'as the documentation describes.')
P(story, 'Fourth, the <b>Gesture mathematics</b>: unusual, well-tested, and practically useful the moment it is '
         'wired to subscriptions, as the EKG demo demonstrates; as an observability layer for fleets of sheets it '
         'is a differentiator no mainstream tool offers. Fifth, the <b>auditable sheet format</b>: YAML sheets '
         'that are diffable, reviewable, and executable make the control-plane story real, and the CLI\'s run, '
         'inspect and validate commands already give a decent developer loop. The honest counterpart list: silent '
         'condition failures must become loud, per-input memoization is needed for API-shaped workloads, NaN '
         'guarding belongs in the pure layer, cycles need load-time detection, program cells need a sandboxing '
         'story before multi-tenant use, and the repo-internal drift (stale constructor calls in shipped demos, '
         'docs referencing a setApiExecutor that does not exist, MCP tool names that mangle underscores) should '
         'be swept before the next release.')
make_table(story,
    ['Value claim', 'Evidence from play-test', 'Verdict'],
    [
        ['Caller-context memoization', 'per-tenant isolated caches; tier gating at the router', 'real and distinctive'],
        ['AI cells as first-class cells', '7 real LLM calls; invalidation made workflows fresh', 'real once a provider is wired'],
        ['Reactive push/pull/call triad', 'fleet alerts fire end-to-end after patches', 'real after patch set'],
        ['Gesture observability', 'EKG caught oscillation invisible to thresholds', 'real; needs wiring + vector cases'],
        ['Sheet-as-control-plane', 'YAML diffable; CLI loop works', 'real, needs polish'],
        ['25-repo ecosystem scale', 'not testable in this exercise', 'unproven; focus on core first'],
    ],
    [0.28, 0.47, 0.25],
    'Table 5. Value assessment with the evidence that backs each verdict.')

# ============================ Chapter 8 ============================
H1(story, '8. Recommendations')
P(story, 'The recommendations fall into three groups: land the fixes, close the semantic gaps, and point the '
         'marketing at what actually works. We would prioritize as follows.')
B(story, '<b>Land the patch set.</b> Seven patches, 727 lines, all upstream tests green. The first three '
         '(listener wiring, value-cell stale read, event contexts) restore the documented behavior of the '
         'runtime; without them the reactive story does not function as written.')
B(story, '<b>Make failures loud.</b> evalWhen should log or raise on unparseable conditions; listener cells with '
         'no action or an io action should warn at load; a lint pass over example sheets should assert every '
         'listener can fire. Silent falseness cost us more debugging time than every other finding combined.')
B(story, '<b>Close the memoization gaps deliberately.</b> Add an input dimension to contextKey (or an explicit '
         'no-cache call option) for API-shaped cells, and document the vary-row workaround until then.')
B(story, '<b>Validate at load.</b> Detect dependency cycles when a sheet loads, reject NaN-producing sensor '
         'references or flag NaN in status, and type-check router rules against the caller context shape.')
B(story, '<b>Ship the missing glue as first-party code.</b> The engine-SDK adapter from the federation demo, the '
         'z-ai (or generic OpenAI-compatible) AIEngine adapter from the triage demo, and a compiled-formula cache '
         'are each small, high-leverage additions.')
B(story, '<b>Lead with the demos that worked.</b> The multi-tenant gateway and the LLM triage sheet are '
         'one-page, visceral demonstrations of the value proposition; the Cell EKG is the one nobody else can '
         'copy. Put those three on the landing page and let the ecosystem story catch up.')
P(story, 'Quilt\'s own README says the point is not the 25 repos but the one model. Our play-test agrees with the '
         'sentiment and adds a condition: the one model only demonstrates its value when its wiring is connected. '
         'After this exercise it is, the tests prove it, and the five demos show what the model can do.')

doc.multiBuild(story, onFirstPage=footer_canvas, onLaterPages=footer_canvas)
print('body built:', OUT_PDF)
