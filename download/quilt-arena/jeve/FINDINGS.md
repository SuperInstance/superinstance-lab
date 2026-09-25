# FINDINGS — JEVE in the Perception Arena (Task 14-5)

**Design**: controlled comparison. JEVE (`p4`) runs the same LIN-contract sheet as the four families — identical `inf.predict`/`inf.update` recovery machinery, same styles → 14 derived weights, same `learn.revise` script-writer — so every accuracy difference is attributable to the **decision surface**, not plumbing. The surface: doubt-gated System One consults, sheet⊗jev soft-posterior blending, worth-gated MOTH purchases, one-pass revisions.

## Headline numbers

| Probe | Result |
|---|---|
| Planted-formula recovery (40 mines games, 1000 obs, matched seeds) | p3/MASK acc **0.837** cos 0.637 · **JEVE acc 0.828** cos 0.625 · p1 0.816 · p0 0.815 · p2/BAYES 0.804, cos **0.701** |
| Round-robin (10 pairs × 2 games, budget 2/set) | p3=140 · p2=60 · **JEVE=52** · p0=24 · p1=−16 |
| Doubt economy | JEVE consulted on **136 / ~800 moves (~17%)** — 0 accuracy penalty visible |
| LIVE recovery (22 real typesafe calls, cap respected) | acc 0.822, cos **0.6254 → 0.6332** (mock → live) |
| MOTH worth-gate | 2 purchases in tournament, 0 in live recovery (the noul said don't) |
| One-pass revision | 1 batch → letter D + family LIN + drift 0.24 + explore 0.87, receipt stamped |

## What the one-pass actually bought

1. **The analyst, one-passed.** The arena's GLM letter-fence (one call, one letter, no calibration) becomes ONE typesafe batch returning family posterior + drift probability + explore probability. The letter mapping stayed compatible with `learn.revise`, so the craftmind script-writer loop absorbed the System One verdict without touching arena core.
2. **Soft posterior, not argmax.** jev's move distribution is BLENDED (`α=0.5`) with the sheet's softmax — a hard override would have discarded the sheet's own fitted knowledge; the blend keeps both minds honest and receipted.
3. **Perception became a judgment call.** Instead of a fixed spend reflex (`margin < 0.12 → buy`), the `worth` noul gates MOTH purchases. In the live recovery leg it correctly bought **nothing** — the uncertainty wasn't worth a scarce call. That is the perception-per-call economy the arena was built to measure.

## Honest caveats

- JEVE did **not** dominate. MASK (p3) still leads recovery acc and the tournament; BAYES (p2) still holds the best weight cosine. 24-ish live calls is far too few to claim the System One surface *wins* — the claim it earns is **competitive parity at ~17% of the consult rate, with calibration receipts the others don't have**.
- The mock voice participates in offline blending (labeled). Only live deltas teach (style nudges guarded on `source === 'live'`).
- `jev.explore` modulates the doubt threshold (explore high → ask more) — one set of evidence, worth iterating.
- Spearman-style rank stability of ZZ probes (e16) was weak (ρ≈0.44) — do not trust quantum ranking across states; see cortex README.

## Engineering notes

- `runtime.set` on a missing cell **throws** — observers need pre-registered `inf.p4`/`inf.dummy` value cells (`ensureInfModels`). The error surfaces as arbiter-clean but would have killed every cross-observation at first update.
- The Arena subclass overrode `boot()` (5 engines + planted dummy) and `decide()` (JEVE branch); `playMines`/`playHearts` untouched — the arena's universal loops absorbed a fifth mind with zero core edits.
- Caches: `.cache/typesafe-jeve{,-off}.json`, `.cache/moth-jeve{-live}.json` — replays cost zero calls.

## Files

- `mind.mjs` — JEVE sheet (LIN contract + System One surface) + blending/teaching helpers
- `run.mjs` — recovery probe, round-robin, live leg, one-pass revision demo (11 checks)
- `outputs/results.json` — machine-readable everything
