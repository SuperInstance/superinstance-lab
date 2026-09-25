# The quilt portfolio — playtest → tools → games → quant → arena

Everything here was built on `SuperInstance/quilt` (a reactive cell runtime)
during an extended play-test engagement. The thread through all of it:
**rules as cells, effects as value pushes, learning as visible cell updates,
and every important decision booked into a tamper-evident receipt chain.**

## Projects

| project | what it is | entry point |
|---------|-----------|-------------|
| `quilt-playtest/` | the engine investigation: 12 playtest patches (cumulative diff), 11-probe dissent ledger, E2–E10 experiments, findings report PDF | `README.md`, `patches/playtest-patches.diff` |
| `quilt-tools/` | 10 production-style tools in 10 realms (fleet pager, ledger seal, ocean recall, triage desk, budget tide, …), 75/75 checks green | `README.md`, `index.html` |
| `quilt-arcade/` | 5 spreadsheet games (tictactoe, reversi, connect4, gomoku, texas hold'em) with rules-as-cells, visible learning loops, browser viewers; 55/55 checks green | `README.md`, `run_all.mjs`, per-game `index.html` |
| `quilt-quant/` | **the trading desk as a spreadsheet**: backtest-as-cells, walk-forward honesty (S6), gated self-improvement (S7), witness receipts (S8); 15/15 checks green vs an independent reference stack | `README.md`, `node quant/play.mjs`, `quant/index.html` |
| `quilt-quant/lab/` | **E11, the sim-first agent lab**: the sheet IS the agent — M1–M8 doctrine, waveform perception, entanglement veto, moth-entropy learning with pruning; 19/19 green, live QRNG + GLM | `lab/README.md`, `node lab/play.mjs` |
| `quilt-arena/` | **E12, the perception arena**: four rival agent-minds play minesweeper-duel and hearts-trio while inferring each other's formulas under a rationed moth-quantum budget, with craftmind-style script-writer revisions; 23/23 green, live championship on real quantum entropy | `README.md`, `node arena/play.mjs` |

## The one-paragraph story

The engine was probed, patched (12 patches, all verified against the 36-test
upstream suite), and then stretched across domains to find out what the
spreadsheet abstraction can absorb. Games proved the template (rules-as-cells,
flip cascades, learning loops). Hold'em proved hidden information is a formula,
not a hole. **quilt-quant proves the same cells can price a market**: every
indicator and risk clause is a cell, one value push re-prices the whole desk,
a trainer cell improves the strategy only through an out-of-sample gate, and
every promotion is a receipt in an fnv1a64 chain. **quilt-quant/lab turns the
desk into a single agentic mind** — simulation-first, signal-as-confirmation,
understanding pruned by participation. And **quilt-arena points the minds at
each other**: formula-inference games under a quantum perception budget, where
rival sheets infer each other's formulas, buy true stochastic perception only
when their doctrine says so, and rewrite their own scripts between sets. No
engine changes were needed for any of the later projects — the abstraction held.

## Reproduce

```
cd quilt-arcade && node run_all.mjs          # 5 games, 55/55
cd quilt-quant  && node quant/play.mjs       # the desk, 15/15 + learning curve
cd quilt-quant  && node lab/play.mjs         # the sim-first lab, 19/19
cd quilt-arena  && node arena/play.mjs       # the perception arena, 23/23 (offline)
MOTH_OFFLINE=0 REAL_LLM=1 node arena/play.mjs  # live championship (cached replay ships in repo)
```

Each project is self-contained (vendored engine, no install beyond `yaml`,
which is vendored in `node_modules/`).
