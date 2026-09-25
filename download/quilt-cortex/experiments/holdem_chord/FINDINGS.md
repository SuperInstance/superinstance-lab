# FINDINGS — Hold'em Chord Spine (Task 14-4)

**Setup**: the chord seat sat in `seats.cfg` as `'human'` — the sheet waited, the driver consulted the chord, and the sheet's own arbiter (C1–C10) still owned every verdict. Zero sheet edits. Mechanical odds (Monte-Carlo equity, pot odds, Chen preflop) were computed **locally — zero tokens** — per the doctrine that odds are mechanical and judgment is not.

## Headline numbers

| Metric | Value |
|---|---|
| Real System One calls | **24** (cap respected; 43 decisions total, 19 degraded to labeled mock after cap) |
| Questions per call | **4** (action choice + pressure score + bluff noul + opp_strong noul) — the one-pass batching win |
| Mean latency | 833 ms per batch call |
| Tokens | 14,361 in / 2,088 out |
| Gate histogram (live) | fast-accept 23 · flagged 19 · escalated 1 |
| MOTH tie-breaks | real qpixl packets (job_ids logged, disk-cached, replay = free) |
| Witness chain | 402 offline + live rows, `verifyChain` green, tamper-break tested in cortex smoke |
| Chip conservation | 300 chips, every hand, every phase |

## What the calibration delta actually did

24 live hands of teaching moved the visible weight cells: **aggro 0.50 → 0.95 (clamp), tight 0.50 → 0.33, sticky 0.30 → 0.05 (clamp), bluff unchanged 0.30**. The System One mind, looking at the same spots, consistently wanted more pressure and less passive calling than the heuristic prior — and the delta rule pushed the weights there hard.

**Honest caveats (read before quoting this):**
- Calibration MAE **rose** across the live leg (0.133 → 0.267 first-half vs last-half). MAE here measures disagreement per decision, not model error — as the weights moved toward jev's positions, the *prior* moved too, so consecutive MAEs are not a stationary learning curve. A stationary metric (freeze the prior per block) is the right next instrument.
- 60 frozen hands with learned weights vs raw weights: **98 vs 98** — no measurable stack edge. 24 teaching hands is a taste, not a curriculum. The template ( Arbiter, receipts, gates, batch) is validated; the *learning signal's* edge needs hundreds of calibrated calls, which is a budget question, not an architecture question.
- The table itself plays tight small-ball (fish 100 → 98 over 120 hands), so weight deltas of this size barely dent the trajectory. A looser table or heads-up format would sharpen the signal.

## Doctrine moments

- **"Weights only learn from calibrated judgment, never from the mock voice"** — enforced in code (`row.source === 'live'` guard) and asserted by the harness (offline legs leave weights byte-identical).
- **Gate economy worked live**: 23 of 43 live decisions were fast-accepts — the fast mind was *sure* and System Two cost nothing. One genuine escalation. Zero GLM tokens were spent in the entire run (offline reviewer stood in for System Two; the seam accepts a live GLM via `makeGlm`).
- **Tie-break by quantum**: when jev's top-2 sat within ε, the MOTH vault packet (real qpixl job) picked the direction, weighted by the distribution itself — receipted, mock-labeled when synthetic.

## Bugs / lessons

1. Conservation constant was 300, not 3000 (stacks are 100/seat with C9 rebuys) — harness caught it on hand 1, as harnesses should.
2. The mock-voice freeze check initially asserted the WRONG doctrine (weights *should* move offline). The code was right; the check was wrong. Lesson: write checks from the doctrine statement, not from "something should happen".
3. `legal.actions` returns `{seat, to_call, options}` — the single cleanest read-model for a driver-side decisionist. Recommended for any future seat type.

## Files

- `chord_seat.mjs` — seat module (state composition, one-pass batch, gates, delta learning, receipts)
- `play.mjs` — 14-check harness (offline 120 hands / live 24 / compare 2×60 frozen)
- `outputs/results.json`, `outputs/chain_live.jsonl` — machine-readable results + live witness chain
- Cache: `.cache/typesafe-holdem.json`, `.cache/moth-holdem.json` — replays cost zero calls
