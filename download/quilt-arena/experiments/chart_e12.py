#!/usr/bin/env python3
# E12 results chart — four panels from the arena's own receipts.
import json, sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.font_manager as fm
for p in ['/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
    try: fm.fontManager.addfont(p)
    except Exception: pass
import matplotlib.pyplot as plt
plt.rcParams['font.sans-serif'] = ['Noto Sans SC', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / 'arena' / 'outputs'
S = json.load(open(OUT / 'summary.json'))

FAMILIES = S['families']
COLORS = {'LIN': '#2563eb', 'WAVE': '#7c3aed', 'BAYES': '#0d9488', 'MASK': '#d97706'}
phases = S['phases']
sets = [p['setNo'] for p in phases]

fig, axs = plt.subplots(2, 2, figsize=(13.5, 9.5), constrained_layout=True)
fig.suptitle('E12 — The Perception Arena: formula-inference games under a MOTH budget',
             fontsize=15, fontweight='bold')

# ── panel 1: standings across sets ──
ax = axs[0][0]
for i, f in enumerate(FAMILIES):
    ys = [p['margins'][f'p{i}'] for p in phases]
    ax.plot(sets, ys, marker='o', ms=4, lw=1.8, color=COLORS[f], label=f)
tags = [('A' if p['tag'] == 'A' else ('B' if p['tag'].startswith('B') else ('C' if p['tag'].startswith('C') else 'LIVE'))) for p in phases]
budgets = [p['budget'] for p in phases]
for x, t, b in zip(sets, tags, budgets):
    ax.annotate(f'{t}:{b}', (x, ax.get_ylim()[0]), ha='center', fontsize=7, color='#666')
ax.set_title('Set margins by family (phase:budget annotated)')
ax.set_xlabel('set'); ax.set_ylabel('cumulative-style margin (per set)')
ax.legend(frameon=False, fontsize=8, loc='upper left', bbox_to_anchor=(0.0, 1.0))
ax.grid(alpha=0.25)

# ── panel 2: planted-formula recovery (H1) ──
ax = axs[0][1]
accs = [S['probe'][f]['acc'] for f in FAMILIES]
cos = [S['probe'][f]['cos'] for f in FAMILIES]
bars = ax.bar(FAMILIES, accs, color=[COLORS[f] for f in FAMILIES], alpha=0.85)
ax.axhline(1/6, color='#dc2626', ls='--', lw=1.2, label='chance (1/6 candidates)')
ax.axhline(2/6, color='#f59e0b', ls=':', lw=1.2, label='harness bar (2× chance)')
for b, c in zip(bars, cos):
    ax.text(b.get_x() + b.get_width()/2, b.get_height() + 0.012, f'cos={c:.2f}', ha='center', fontsize=8, color='#333')
ax.set_ylim(0, 0.85)
ax.set_title('H1 — planted-formula recovery by inf.update (60 post-warmup predictions)')
ax.legend(frameon=False, fontsize=8)
ax.grid(alpha=0.25, axis='y')

# ── panel 3: the perception economy ──
ax = axs[1][0]
w = 0.2
for i, f in enumerate(FAMILIES):
    xs = [p['setNo'] + (i - 1.5) * w for p in phases]
    ys = [p['spent'][f'p{i}'] for p in phases]
    ax.bar(xs, ys, width=w, color=COLORS[f], label=f, alpha=0.85)
ax.set_xticks(sets); ax.set_xticklabels([f"s{s}\n{t}" for s, t in zip(sets, tags)], fontsize=8)
ax.set_title('MOTH packets spent per set (budget rotates 0/2/4/2/2/2/2; championship = live quantum)')
ax.set_ylabel('packets bought')
ax.legend(frameon=False, fontsize=8, ncol=4, loc='upper right')
ax.grid(alpha=0.25, axis='y')

# ── panel 4: the craftmind pulse — novelty per revision ──
ax = axs[1][1]
for i, f in enumerate(FAMILIES):
    xs, ys = [], []
    for p in phases:
        r = (p.get('revisions') or {}).get(f'p{i}')
        if r: xs.append(p['setNo']); ys.append(r['novelty'])
    if xs: ax.plot(xs, ys, marker='s', ms=4, lw=1.6, color=COLORS[f], label=f)
ax.set_title('Script-writer pulse — novelty distance stamped per revision (rule: > 0 always)')
ax.set_xlabel('set'); ax.set_ylabel('L1 style distance from previous version')
ax.legend(frameon=False, fontsize=8, loc='upper right')
ax.grid(alpha=0.25)

fig.savefig(OUT / 'e12_results.png', dpi=150)
print('wrote', OUT / 'e12_results.png')
