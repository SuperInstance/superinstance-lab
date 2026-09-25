# quilt-cortex

**The tri-nervous system for quilt sheets.** Three providers, one decision spine, every judgment booked:

| Layer | Provider | Role | Speed | Cost |
|---|---|---|---|---|
| System One | **TypeSafe Jev** (`jev-1.13.0`) | one-pass typed decisions with calibrated probabilities | ~750 ms/batch | tokens |
| System Two | **GLM** (z-ai) | slow narrative review — bought ONLY by doubt | seconds | more tokens |
| Quantum | **MOTHquantum** (`qpixl-v1`, `graph-v1`) | true entropy for ties; certification of declared couplings | ~1–3 s/job | moth calls |

Born from the jev-quilt canon (five laws), the E11/E11 lab lessons, and the E12 arena economy — see `experiments/` for the falsifiable studies.

---

## The Chord (the decision spine)

```
        ┌──────────────────────────────────────────────────────┐
        │  1. PROPOSE — ONE System One call, N typed questions  │
        │     action choice + pressure score + bluff noul …     │
        │     → full calibrated distribution, 0 extra calls     │
        ├──────────────────────────────────────────────────────┤
        │  2. GATE — viability floors (jev-quilt law 5)         │
        │     p_max ≥ 0.55  → fast-accept      (0 extra tokens) │
        │     0.35–0.55     → flagged          (proceed, noted) │
        │     p_max < 0.35  → escalated → System Two reviews    │
        ├──────────────────────────────────────────────────────┤
        │  3. TIE-BREAK — top-2 within ε → MOTH packet picks    │
        │     weighted by the distribution itself (true entropy)│
        ├──────────────────────────────────────────────────────┤
        │  4. BOOK — fnv1a64 witness row: dist, gate, calib,    │
        │     tokens, sources. Chain verifies; tamper breaks it │
        └──────────────────────────────────────────────────────┘
```

**Attention by uncertainty**: expensive thought is spent exactly where the fast mind is unsure. Mechanical odds never touch tokens (computed locally by the sheet). In the live hold'em run, 23/43 real decisions were fast-accepts — System Two cost nothing.

**Calibration delta** (the novel teaching signal): the sheet holds its own opinion distribution; jev returns a calibrated one; the per-option delta `jev_p − own_p` is a continuous gradient the sheet can feel. Weights drift toward calibrated judgment — and only from the LIVE voice (mock-judgment learning is forbidden by code and asserted by harness).

## Library

- `cortex/typesafe.mjs` — `JevVault`: one-pass batch decisions, disk cache, OFF/LIVE namespaces (a synthetic answer never shadows a real one), hard live-call caps, 429 backoff, deterministic labeled mock. `calibrationDelta()`. `makeEngine()` → quilt `ai` cells speak `jev.batch / jev.choice / jev.score / jev.noul` (patch-8 passthrough; objects ride as JSON strings).
- `cortex/chord.mjs` — `makeChord()` → `chordVerdict()`: the spine above. `offlineReviewer()` labeled stand-in for System Two.
- `cortex/moth.mjs` — wraps the arena MothVault (shared cache/journal/caps) + `weightedQuantumPick()`.
- `cortex/glm.mjs` — System Two adapter: 15/30/45 s backoff, refuses honestly, degrades labeled.
- `cortex/receipts.mjs` — fnv1a64 witness chains: `sealChain`, `verifyChain` (tamper pins the exact row).
- `cortex/cells.mjs` — jev-flavored cell sugar + `jevAIRouter` (mix GLM and Jev cells in one sheet).

Wire protocol (live-verified 2026-09-25): `POST api.typesafe.ai/v1/systemone` `{model, state, questions:{name:{type: noul|choice|score, instructions, criteria}}}` → `{answers:{name:{choice|noul|score, confidence?, probabilities?}}, usage}`. One call answered 3 typed questions in 753 ms / 82 output tokens.

## What the games taught the APIs (experiments)

### Hold'em — the chord seat (`experiments/holdem_chord/`)
Real sheet, real arbiter (C1–C10), zero sheet edits — the chord seat sat in `seats.cfg` as `'human'`. **14/14 checks green.** 24 live System One calls (4 questions each), 833 ms mean, real qpixl tie-breaks. Calibration-delta teaching moved the visible weight cells (aggro 0.50→0.95, sticky 0.30→0.05). Honest: 24 teaching hands = a taste, not a curriculum — frozen-weight match ended 98 vs 98. Full numbers: `experiments/holdem_chord/FINDINGS.md`.

### Perception Arena — the JEVE mind (`../../quilt-arena/jeve/`)
A **fifth rival mind** with the SAME recovery machinery as the other four (controlled comparison) but a System One decision surface: doubt-gated one-pass consults, sheet⊗jev soft-posterior blending, worth-gated MOTH purchases, and the script-writer revision as ONE batch (family/drift/explore → the A–E letter doctrine). **11/11 checks green.** Recovery acc 0.828 (2nd of 5) while consulting on ~17% of moves; live leg improved tracking (cos 0.6254→0.6332) on 22 real calls. Full numbers: `../../quilt-arena/jeve/FINDINGS.md`.

### e16 — The Wiring Oracle (`experiments/e16_entangle.mjs`)
Can quantum tomography DECIDE a sheet's LINK topology (jev-quilt law 2, made physical)? Falsifiable, five wirings, same tape (planted non-linear truth `cyc×vol`), same head: **classical correlation selector won decisively** (test acc 0.899 vs oracle 0.613). The instrument lesson, earned across 4 iterations and 2 self-caught bugs:

> **The entanglement meter certifies wirings, it does not discover them.** graph-v1 returns the couplings of the state you *declare* — measured ZZ ≈ f(your Bloch vectors × your requested coupling). Averaged telemetry collapses it to ~0; saturated amplitudes pin it to 1.0; single-bar reads rank the *state*, not the *dataset*. Quantum's correct role: tamper-evident certification of declared coupling structure — a checksum over the sheet's declared LINK edges, not a search engine over them.

## Budget doctrine (the keys are monitored)

Every vault carries: hard live caps (JevVault `cap`, MothVault `MAX_LIVE=14`), disk caches under `.cache/` (replays cost zero), OFF/LIVE namespaces, and labeled degradation (mock results are ALWAYS `mock:true`). Spent on the user's keys this task: ~27 typesafe calls + ~5 moth jobs — every one journaled.

## Honest limits

- Calibration MAE is per-decision disagreement, not a stationary learning curve (the prior moves as the weights do). Freeze-per-block metrics are the next instrument.
- The offline `offlineReviewer` System Two is a hash-picked stand-in; the GLM seam is wired (`makeGlm`) but live System Two review is untested end-to-end here (E11 covered live GLM).
- One-pass batching wins tokens, not omniscience: jev sees the state string the sheet composed — garbage state, calibrated garbage.
- Engine patches: **zero new**. The entire tri-provider spine ran on the arcade's patched engine (patches 1–12) — the strongest template-generality result yet.

## Run it

```bash
node smoke.mjs                                   # 11/11 offline spine checks
node smoke_live.mjs                              # 1 live chord verdict (cached after)
node experiments/holdem_chord/play.mjs           # 14/14 — offline 120 + live 24 + compare 120 hands
node ../../quilt-arena/jeve/run.mjs              # 11/11 — recovery + tournament + live + revision
node experiments/e16_entangle.mjs                # 7/7 — the wiring oracle study
```
