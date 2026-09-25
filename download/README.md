# SuperInstance — the quilt portfolio

**The spreadsheet grew senses.** Everything here was built on
[`SuperInstance/quilt`](https://github.com/SuperInstance/quilt) — a reactive
cell runtime — during an extended play-test engagement. The thread through all
of it: **rules as cells, effects as value pushes, learning as visible cell
updates, and every important decision booked into a tamper-evident receipt
chain.**

<table><tr><td>

> **Start here → [`superinstance/index.html`](superinstance/index.html)** — the
> flagship showcase. Four sheets *running live in the page* (a tide field, a
> self-playing reversi with visible learning, a hold'em opponent-shape reader,
> a signal desk with a rationed quantum budget), the honest landscape table vs
> the big players, the ecosystem quilt, and the brand kit in
> [`superinstance/brand/`](superinstance/brand/).

</td></tr></table>

## The portfolio — one abstraction, six patches

| project | what it is | entry point |
|---------|-----------|-------------|
| `superinstance/` | **the front door**: brand identity + live showcase + competitive positioning + playtest log | `index.html` (open in any browser, offline) |
| `quilt-playtest/` | the engine investigation: 12 playtest patches (cumulative diff), 11-probe dissent ledger, E2–E10 experiments, findings report PDF | `README.md`, `patches/playtest-patches.diff` |
| `quilt-tools/` | 10 production-style tools in 10 realms (fleet pager, ledger seal, ocean recall, triage desk, budget tide, …) | `index.html`, `README.md` |
| `quilt-arcade/` | 5 spreadsheet games (tictactoe, reversi, connect4, gomoku, texas hold'em) — rules-as-cells, visible learning loops, browser viewers | `run_all.mjs`, per-game `index.html` |
| `quilt-quant/` | **the trading desk as a spreadsheet**: backtest-as-cells, walk-forward honesty (S6), gated self-improvement (S7), witness receipts (S8) | `node quant/play.mjs`, `quant/index.html` |
| `quilt-quant/lab/` | **E11, the sim-first agent lab**: the sheet IS the agent — M1–M8 doctrine, waveform perception, entanglement veto, moth-entropy learning with pruning | `node lab/play.mjs` |
| `quilt-arena/` | **E12, the perception arena**: four rival agent-minds play minesweeper-duel and hearts-trio while inferring each other's formulas under a rationed moth-quantum budget | `node arena/play.mjs` |
| `quilt-cortex/` | **the tri-nervous system**: TypeSafe System One one-pass typed decisions + GLM System Two + MOTH quantum, fused into the Chord decision spine; played on the games (hold'em chord seat, arena JEVE mind, the e16 wiring-oracle study) | `node smoke.mjs`, `README.md` |

**Scoreboard: 230 green checks** across tools 75 · arcade 55 · quant 15 ·
lab 19 · arena 23 · cortex 14 + 11 smoke + 11 arena-jeve + 7 e16 — plus 36/36
upstream engine tests kept green through 12 playtest patches. **Zero new
engine patches in the last three projects**: the template absorbed a trading
desk, an agent lab, a perception arena, and a tri-provider AI substrate as
pure sheets.

## The one-paragraph story

The engine was probed, patched, and then stretched across domains to find out
what the spreadsheet abstraction can absorb. Games proved the template (rules
as cells, flip cascades, learning loops). Hold'em proved hidden information is
a formula, not a hole. **quilt-quant proves the same cells can price a
market** — one value push re-prices the whole desk, and the trainer improves
the strategy only through an out-of-sample gate. **quilt-quant/lab turns the
desk into a single agentic mind** — simulation-first, signal-as-confirmation,
understanding pruned by participation. **quilt-arena points the minds at each
other** — formula-inference games under a quantum perception budget, where
rival sheets buy true stochastic perception only when their doctrine says so.
**quilt-cortex gives every mind a nervous system** — System One judges in one
pass, System Two is bought only by doubt, quantum breaks ties and certifies
wiring — the chord spine, played to green on the games themselves. And
**superinstance makes it a thing**: a brand, a front door, and four live
proofs you can open in a browser tab.

## Reproduce

```
cd quilt-arcade && node run_all.mjs             # 5 games, 55/55
cd quilt-quant  && node quant/play.mjs          # the desk, 15/15
cd quilt-quant  && node lab/play.mjs            # the sim-first lab, 19/19
cd quilt-arena  && node arena/play.mjs          # the perception arena, 23/23
cd quilt-cortex && node smoke.mjs               # the chord spine, 11/11
cd quilt-cortex && node experiments/holdem_chord/play.mjs   # chord plays hold'em, 14/14
cd quilt-arena  && node jeve/run.mjs            # the JEVE mind, 11/11
cd quilt-cortex && node experiments/e16_entangle.mjs        # the wiring oracle, 7/7
open superinstance/index.html                   # the showcase — just open it
```

Each project is self-contained (vendored engine, no install beyond `yaml`,
which is vendored in `node_modules/`).
