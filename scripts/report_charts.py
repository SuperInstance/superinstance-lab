#!/usr/bin/env python3
"""Charts for the Quilt play-test report (English labels, palette-derived colors)."""
import matplotlib
matplotlib.use('Agg')
import matplotlib.font_manager as fm
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
import matplotlib.pyplot as plt
plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# palette.cascade colors
ACCENT   = '#866f2c'
ACCENT_2 = '#4895ae'
HEADER   = '#504a36'
ICON     = '#927f45'
BORDER   = '#d0cdc2'
TEXTP    = '#1e1d1b'
MUTED    = '#8c8982'
SEM_ERR  = '#aa4e46'
SEM_OK   = '#497d5a'

OUT = '/home/z/my-project/download/quilt-playtest'

# ── Chart 1: Cell EKG — sensor series with gesture-detected phases ──
series = []
# phase 1: drift 40->58
series += list(range(40, 60, 2))
# phase 2: oscillation ±6 around 58
v = 64
for i in range(12):
    series.append(64 if i % 2 == 0 else 52)
# phase 3: step decline
series += [40, 34, 28, 22, 18, 15]
# phase 4: stuck
series += [15] * 6

transitions = [(len(list(range(40, 60, 2))), 'drifting'),
               (len(list(range(40, 60, 2))) + 12 + 1, 'oscillating'),
               (len(series) - 6, 'stuck')]

fig, ax = plt.subplots(figsize=(8.6, 3.4), dpi=200, constrained_layout=True)
ax.plot(series, color=ACCENT_2, lw=2.0, zorder=3)
# phase shading
ax.axvspan(0, 10, color='#f1f0ee', zorder=1)
ax.axvspan(10, 22, color='#e9e7e2', zorder=1)
ax.axvspan(22, 28, color='#ecebea', zorder=1)
ax.axvspan(28, len(series), color='#f1f0ee', zorder=1)
ax.text(5, 70, 'drift', ha='center', fontsize=9, color=HEADER)
ax.text(16, 70, 'cooling-loop fault (hunting)', ha='center', fontsize=9, color=SEM_ERR)
ax.text(25, 70, 'step change', ha='center', fontsize=9, color=HEADER)
ax.text(31, 70, 'settled', ha='center', fontsize=9, color=HEADER)
for x, label in transitions:
    ax.axvline(x, color=ICON, lw=1.2, ls='--', alpha=0.8, zorder=2)
    ax.annotate(f'EKG: {label}', xy=(x, 12), fontsize=8, color=SEM_OK,
                ha='right', rotation=0,
                xytext=(x - 0.4, 8 + 6 * (transitions.index((x, label)) % 2)))
ax.axhline(80, color=MUTED, lw=1, ls=':')
ax.text(1, 81.5, 'naive threshold alarm (80C) - never crossed', fontsize=8, color=MUTED)
ax.set_xlabel('reading #', fontsize=9, color=TEXTP)
ax.set_ylabel('plant.temp (C)', fontsize=9, color=TEXTP)
ax.set_ylim(0, 78)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.grid(True, ls='--', alpha=0.2)
fig.savefig(f'{OUT}/chart-ekg.png')
plt.close(fig)

# ── Chart 2: LLM triage results ──
tickets = ['Ticket 1\n(pricing typo)', 'Ticket 2\n(prod outage)', 'Ticket 3\n(refund frustration)']
urgency = [1, 10, 7]
labels = ['positive 0.90', 'negative 0.98', 'negative 0.99']
escalated = [False, True, False]

fig, ax = plt.subplots(figsize=(7.6, 3.4), dpi=200, constrained_layout=True)
colors_bar = [SEM_OK if e else ACCENT_2 for e in escalated]
bars = ax.bar(tickets, urgency, color=colors_bar, width=0.55, zorder=3)
ax.axhline(8, color=SEM_ERR, lw=1.4, ls='--', zorder=2)
ax.text(2.42, 8.25, 'escalation gate (>= 8)', fontsize=8.5, color=SEM_ERR, ha='right')
for b, u, lab, e in zip(bars, urgency, labels, escalated):
    ax.text(b.get_x() + b.get_width() / 2, u + 0.35, f'{u}/10',
            ha='center', fontsize=10, color=TEXTP, fontweight='bold')
    ax.text(b.get_x() + b.get_width() / 2, u + 1.55, lab,
            ha='center', fontsize=8, color=MUTED)
ax.set_ylim(0, 12.5)
ax.set_ylabel('LLM-scored urgency (1-10)', fontsize=9, color=TEXTP)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.grid(True, axis='y', ls='--', alpha=0.2)
fig.savefig(f'{OUT}/chart-triage.png')
plt.close(fig)

print('charts written')
