# The quilt portfolio — playtest → tools → games → quant

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

## The one-paragraph story

The engine was probed, patched (12 patches, all verified against the 36-test
upstream suite), and then stretched across domains to find out what the
spreadsheet abstraction can absorb. Games proved the template (rules-as-cells,
flip cascades, learning loops). Hold'em proved hidden information is a formula,
not a hole. **quilt-quant proves the same cells can price a market**: every
indicator and risk clause is a cell, one value push re-prices the whole desk,
a trainer cell improves the strategy only through an out-of-sample gate, and
every promotion is a receipt in an fnv1a64 chain. No engine changes were
needed for any of the three later projects — the abstraction held.

## Reproduce

```
cd quilt-arcade && node run_all.mjs          # 5 games, 55/55
cd quilt-quant  && node quant/play.mjs       # the desk, 15/15 + learning curve
```

Each project is self-contained (vendored engine, no install beyond `yaml`,
which is vendored in `node_modules/`).
