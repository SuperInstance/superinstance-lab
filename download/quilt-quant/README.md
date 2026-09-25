# quilt-quant — the trading desk as a spreadsheet

**TWO archetypes now live here.**

1. **`quant/` — the desk** (below): a human-operated trading desk as a
   spreadsheet. Push a value, the whole desk re-prices. The trainer improves
   strategies through an out-of-sample gate.
2. **`lab/` — the sim-first agent lab** (the new one): *no human in the
   loop at all.* A closed-loop agent whose architecture IS the simulation:
   perception → belief → proposal → **simulation** → confirmation (with a
   quantum entanglement veto) → action → learning → **pruning** → receipts.
   Wired to the live moth-quantum API (true quantum entropy, waveform
   round-trips, graph-state tomography) and to a fenced GLM analyst.
   **The value is not in one trade — it is that every belief, veto and
   receipt is a cell, and the decision process gets simpler over time.**

   ```
   cd lab && node play.mjs        # 19/19 checks, live moth, ~60s
   open lab/outputs/e11_results.png
   ```
   Full write-up: **[lab/README.md](lab/README.md)**.

---

**Back-test trading strategies like it's child's play.** One instrument, one
tape, and a desk where every indicator, every risk rule, and every metric is a
CELL. Push one value and the whole desk re-prices: indicators → signal →
backtest → metrics → walk-forward verdict → the glass. Run the trainer and
watch a strategy improve itself — honestly — through an out-of-sample
promotion gate with tamper-evident receipts.

This is the quilt-arcade template (rules-as-cells, value-push cascades,
learning loops, witness chains) aimed at a market instead of a board. It runs
on the same vendored patched engine (patches 1–12) with **zero further engine
changes**.

```
node quant/play.mjs        # 15/15 checks, ~130ms, prints the learning curve
open quant/index.html      # the desk, live in a browser (single file, no server)
```

---

## The desk in one push

```
p.fast ──set──▶ ind.sma_fast ──▶ sig.pos ──▶ bt.run ──publish──▶ bt.last
p.slow ──set──▶ ind.sma_slow ──┘             │                     │
p.rsi_* ─set──▶ ind.rsi ──────┘              ├─ S1 universe check  ├─▶ met.* (formulas)
                                             ├─ S2 params check    ├─▶ art.equity (glass)
                                             ├─ S3 signal audit    └─▶ desk re-priced
                                             ├─ S4 costs
                                             ├─ S5 metric sanity
                                             └─▶ trades, metrics, equity
wf.report ──▶ S6 walk-forward verdict (ROBUST / OVERFIT / WEAK)
ai.trainer ─▶ S7 promotion gate ─▶ desk.champion + p.* cells ─▶ THE CASCADE
ai.ledger  ─▶ S8 fnv1a64 receipt chain, re-derived on demand
```

## The strategy book (S1–S8)

Like the arcade's rulebooks, the desk's doctrine lives as precise numbered
clauses (`strategy.book`, `rule.Sn.law`), each ported 1:1 to a pure checker
cell (`rule.Sn.check`) that the pricing engine sequences. The clauses:

- **S1 universe** — one instrument, daily closes; a bad bar stops the desk.
- **S2 indicators** — sma_w needs w closes, Wilder rsi_n needs n+1; a missing
  indicator means FLAT, never a guess; parameters must be tradeable.
- **S3 signal** — `sma_cross`: LONG when sma_fast > sma_slow AND rsi ≤ rsi_max;
  `rsi_reversion`: LONG ≤ rsi_buy, FLAT ≥ rsi_sell, HOLD between. No lookahead
  (position[i] may only see bars ≤ i) and it acts at the next close.
- **S4 costs** — every position change pays fee_bps of notional; no leverage;
  a trade open at the last bar closes there and the desk pays the liquidation
  fee in the equity path too (trades and equity always tell the same story).
- **S5 metrics** — return, CAGR, annualized Sharpe, max drawdown, n_trades,
  win rate, profit factor, exposure — or refuse to print nonsense.
- **S6 walk-forward** — first wf_pct of bars are the FIT window (IS), the rest
  the JUDGE window (OOS). ROBUST: OOS sharpe ≥ 0.75, dd ≤ 40%, ≥ 3 trades.
  Wins IS + loses OOS = **OVERFIT**. Both windows always reported.
- **S7 promotion** — a candidate replaces the champion only if its OOS score
  beats the champion's AND its IS score does not degrade
  (score = sharpe − 2·maxdd − 0.5·(trades<3)). Every decision books a receipt.
- **S8 audit** — the ledger is an fnv1a64 chain rooted at GENESIS; S8
  re-derives it; one flipped byte breaks it visibly.

## The self-improving loop (the part that wows)

`ai.trainer` runs generations of: **propose → fit on IS → judge on OOS → gate**.

- The *workbench* adopts any candidate that improves the IS score (fitting is
  free).
- The *champion* only changes through S7: out-of-sample must beat the reigning
  score. The workbench moving is `wb_moved`; the gate speaking is
  `promote`/`refuse`. Different decisions, different fields, one receipt.
- At the end the trainer writes the champion AND the parameter cells — the
  reactive graph re-prices the whole desk in front of you.

Measured on the synthetic regime tape (760 bars: trend/bear/chop/bear/
recovery, seeded and reproducible), a 24-generation run lifts the desk from
**OOS score 0.68 (WEAK) to 1.30 (ROBUST)** with 2 promotions out of 24
candidates — the refused 22 are receipts, not losses. The harness proves the
promotions are monotone in OOS score, the OVERFIT trap is refused (a candidate
that wins IS and loses OOS, found independently by the reference stack), and
the same seed replays byte-identically.

## The independent reference (why you can trust the numbers)

`quant/play.mjs` carries its own quant stack, written separately from the
sheet's kernel: prefix-sum SMAs (the sheet windows), a delta-array Wilder RSI
(the sheet smooths inline), a settlement-accounting backtest (the sheet
recurses daily PnL), two-pass Sharpe (the sheet uses sum/sum2). 15 checks:

| # | check |
|---|-------|
| 1 | S1 refuses NaN / short tapes |
| 2 | indicators agree with the reference stack (every bar) |
| 3 | signal agrees with the reference state machine; S3 audits structure |
| 4 | no lookahead: mutating bar 400 (or the last bar) cannot move the past |
| 5 | HAND-COMPUTED 60-bar tape at 50bps — every fee and equity point done on paper |
| 6 | backtest ≡ settlement-accounting reference, 4 configs incl. a fee storm |
| 7 | walk-forward split integrity + reference agreement + S6 verdict vocabulary |
| 8 | S7 unit: beats-OOS-but-drops-IS refused; beats-both promoted |
| 9 | THE OVERFIT TRAP: wins IS / loses OOS → refuse receipt, champion untouched |
| 10 | LIVE PROMOTION: candidate beats both windows → desk re-priced |
| 11 | full 24-generation run: OOS improves, promotions monotone |
| 12 | witness chain re-derives; one flipped byte breaks it |
| 13 | determinism: same seed → byte-identical receipts |
| 14 | one nudge re-prices every cell (snapshot discipline) |
| 15 | buy & hold control group priced and compared |

## The viewer

`quant/index.html` (single file, ~165 KB, runs from `file://`): the tape with
SMA overlays, long shading and trade markers; equity vs buy & hold; drawdown;
the strategy book with clause flash; live metric cells; the champion card;
parameter cells with +/− nudge buttons (every click is a value push); a
RUN THE TRAINER button; the receipt ledger with the promote rows highlighted;
and the `art.equity` unicode sparkline glass — the cells themselves rendered.

## The LLM strategist seam

`experiments/llm_strategist.mjs` wires a model into the loop through the
letter-coded fence (the E9 protocol): the desk state builds a menu (faster /
slower / relax gate / flip strategy / hold), the model answers ONE letter, the
letter decodes to a candidate, and the candidate goes through the same
S2→S6→S7 gate as everything else. A bad pick costs one refuse receipt, not the
desk. Mock model (state-reactive doctrine) is offline-green; `--real` uses
z-ai GLM with 15/30/45s backoff.

## Layout

```
engine/          vendored patched core (arcade lineage, patches 1–12, 36/36 upstream tests)
shared/kit.mjs   harness, witness chain, cell builders, snippet interpolation
quant/sheet.mjs  the desk: 67 cells (book, checks, indicators, pricing, WF, trainer, ledger)
quant/play.mjs   the independent reference + 15-check harness
quant/viewer.mjs the browser desk (bundled to quant/index.html)
experiments/     captured run output, quant.json (curve), llm_strategist, build_notes.md
```

## Honest limits

- One synthetic instrument, long-only 0/1 positions, no margin, no slippage
  model beyond fees. The tape is GBM-with-regimes — designed so trends reward
  crossovers and chop punishes them; it is not a claim about real markets.
- The trainer is a seeded hill-climber with a strategy-flip move, not a
  gradient method; 24 generations explores ~24 points of a ~7-dimensional
  space. The point is the HONEST GATE, not the optimizer's power.
- Walk-forward with one split is the floor of honesty, not the ceiling
  (k-fold purged CV would be the next rung; the sheet's S6 cell is where it
  would live).
