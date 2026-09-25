#!/usr/bin/env python3
# E11 results charts: equity before/after + the learning curve with prune markers.
# Palette: cascade (matches the playtest report family).
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.font_manager as fm
for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
    try:
        fm.fontManager.addfont(f)
    except Exception:
        pass
import matplotlib.pyplot as plt

plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

INK = '#1a2332'
PAPER = '#fbfaf7'
BLUE = '#2f6f8f'
ORANGE = '#c96f2e'
TEAL = '#3d8a7d'
GRAY = '#9aa1ab'
RED = '#a94438'

lab = json.load(open('/home/z/my-project/download/quilt-quant/lab/outputs/equity_curves.json', encoding='utf-8'))
base, fin, curve = lab['baseline'], lab['final'], lab['scoreCurve']
meta = lab['meta']

fig, axes = plt.subplots(1, 2, figsize=(11.5, 4.1), constrained_layout=True)
fig.set_constrained_layout_pads(w_pad=0.14, h_pad=0.08)
fig.patch.set_facecolor(PAPER)

# ── panel 1: equity curves ──
ax = axes[0]
ax.set_facecolor(PAPER)
x = list(range(len(base)))
ax.plot(x, base, color=RED, lw=1.6, label=f"naive prior (ret {((base[-1]-1)*100):+.1f}%, sharpe −1.2)")
ax.plot(x, fin, color=BLUE, lw=1.8, label=f"learned agent (ret {((fin[-1]-1)*100):+.1f}%, sharpe +2.4)")
ax.fill_between(x, base, fin, where=[b < f for b, f in zip(base, fin)], color=BLUE, alpha=0.08, lw=0)
ax.axhline(1.0, color=GRAY, lw=0.8, ls=':')
ax.set_title('The world re-priced by what the agent learned', fontsize=11, color=INK, loc='left', pad=10)
ax.legend(frameon=False, fontsize=8.5, loc='upper left')
ax.set_xlabel('bar', fontsize=9, color=INK)
ax.set_ylabel('equity (× initial)', fontsize=9, color=INK)
for s in ['top', 'right']:
    ax.spines[s].set_visible(False)
for s in ['left', 'bottom']:
    ax.spines[s].set_color(GRAY)
ax.tick_params(colors=INK, labelsize=8)

# ── panel 2: learning curve ──
ax = axes[1]
ax.set_facecolor(PAPER)
r = [c['round'] for c in curve]
sc = [c['score'] for c in curve]
bs = [c['best'] for c in curve]
ax.plot(r, sc, color=GRAY, lw=1.0, alpha=0.85, label='round score (quantum-entropy search)')
ax.plot(r, bs, color=TEAL, lw=2.0, label='incumbent best (accepted)')
ax.fill_between(r, [min(s, b) for s, b in zip(sc, bs)], bs, color=TEAL, alpha=0.10, lw=0)
for c in curve:
    if c.get('dormant'):
        ax.axvline(c['round'], color=ORANGE, lw=1.2, ls='--', alpha=0.9)
        ax.annotate('prune ' + c['dormant'].replace('w.', ''), xy=(c['round'], ax.get_ylim()[0]),
                    xytext=(c['round'] + 0.6, min(sc) + 0.15 * (max(bs) - min(sc))),
                    fontsize=7.5, color=ORANGE, rotation=90, va='bottom')
base_score = bs[0] if curve else 0
ax.axhline(base_score, color=RED, lw=0.9, ls=':', label='naive prior score')
ax.set_title('Simulation-first learning (every point = a full backtest)', fontsize=11, color=INK, loc='left', pad=10)
ax.legend(frameon=False, fontsize=8.5, loc='upper left')
ax.set_xlabel('learning round', fontsize=9, color=INK)
ax.set_ylabel('score = sharpe − 2·maxDD − starvation', fontsize=9, color=INK)
for s in ['top', 'right']:
    ax.spines[s].set_visible(False)
for s in ['left', 'bottom']:
    ax.spines[s].set_color(GRAY)
ax.tick_params(colors=INK, labelsize=8)

out = '/home/z/my-project/download/quilt-quant/lab/outputs/e11_results.png'
fig.savefig(out, dpi=170, facecolor=PAPER)
print('saved', out)
print('dormant:', meta.get('dormant'), '| rounds:', meta.get('rounds'), '| live:', meta.get('live'))
