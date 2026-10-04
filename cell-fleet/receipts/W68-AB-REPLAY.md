

---
# W68 A/B REPLAY — 2026-10-04T17:11:47Z

Pre-registered decision rules (fixed in `scripts/w68_ab_replay.mjs` BEFORE the runs):

- **R1 (primary)**: mean reward of tasks 51-60; **B wins iff last10(B) > last10(A) + 0.02**
- **R2**: B final live population >= 2 (no extinction)
- **R3**: B mitosis >= 1 (robustness gate must not freeze the lineage)
- **R4**: honest-negative clause — if B fails R1, the chemistry is REJECTED at this corpus scale; no rerun tuning

| metric | arm A (lrs, no gate) | arm B (fee, robust gate) |
|---|---|---|
| first-10 mean reward | 0.6799 | 0.7678 |
| last-10 mean reward (R1) | 0.9898 | 0.9898 |
| all-task mean reward | 0.9399 | 0.9535 |
| tasks ok / failed | 60/0 | 60/0 |
| genome hash changes | 60 | 60 |
| final population (R2) | 8 | 8 |
| max generation | 3 | 3 |
| mitosis events (R3) | 20 | 19 |
| apoptosis events | 14 | 12 |
| graves: starvation | 13 | 12 |
| graves: low-affinity | 1 | 0 |
| lineage edges | 20 | 19 |
| trickle feeds | 34 | 33 |

## Verdict (pre-registered rules, applied mechanically)

- R1: last10 B=0.9898 vs A=0.9898 (margin needed +0.02) → **FAIL**
- R2: population B=8 → **PASS**
- R3: mitosis B=19 → **PASS**

**VERDICT: REJECTED (R4 honest-negative stands)**

## Reading (receipted, no spin)

- Fee-admission concentrates food: arm A starved 13 cells, arm B starved 12 (low-affinity deaths A=1, B=0). Concentration is SUPPOSED to raise starvation deaths while raising mean reward — that is selection, not a bug; the pre-registered rules judge it on reward + persistence, not on death counts.
- Robustness gate: B ran 19 mitoses across 3 generations (A: 20 across 3). The gate did not freeze the lineage.
- 68-d's claim under test (Q9): mutation noise σ_m≈2.3× landscape contrast σ_c ⇒ selection should favor robust plateaus. At this corpus scale the A/B does NOT support the gated chemistry (R4).

Artifacts: `scripts/w68-ab-armA.json`, `scripts/w68-ab-armB.json` (full per-task streams), wrangler logs at `/tmp/w68_wrangler_{A,B}.log`, tissue snapshots `/tmp/w68_tissue_{A,B}.json`.

Chemistry knobs live in `wrangler.toml` [vars] (defaults = baseline); arms were overridden at the runtime surface via `wrangler dev --var`, so the committed defaults stay wave-67-compatible.
