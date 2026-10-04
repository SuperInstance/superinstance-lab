# W68 JEV Native Receipt — transport restored, judge-family calibration shock

- **Run**: 2026-10-04T16:39:14Z (completed; the lane agent died after the run but
  before receipting — results salvaged verbatim from `/tmp/w68_jev_results.json`,
  full JSON preserved at `scripts/w68-research/w68_jev_results.json`)
- **Transport**: NATIVE — `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer`,
  key from `.env.keys` only (masked here as `apikey_22174...`, never written to any
  tracked file). Liveness probe: 283 ms, model served `jev-1.13.0`.
- **Protocol fidelity**: question set, wire schema, parsing VERBATIM from
  `quilt-jev-toolkit/jev_client.py canon_gate()` (`is_canon` noul / `depth` score
  trivial-useful-deep-frontier / `domain` choice). Deviations (protocol-neutral,
  receipted in the script header): 12,000-char chunking; second native judge
  `jev-preview` as within-family ensemble member.
- **Ensemble**: same 5 artifacts through the wave-67 GLM lens judges
  (skeptic/engineer/teacher), transport reused verbatim from `scripts/w67_jev_gate.py`.
- **Call accounting**: 5 artifacts × (2 native + 3 GLM) = 25 judge calls, 0 failures,
  0 HTTP errors, 0 rate-limit hits (0.4 s native / 0.5 s GLM spacing).

## Ensemble table (native canon oracle vs GLM lens vs wave-67 GLM receipt)

| artifact | jev-latest | jev-preview | native mean | GLM mean p/d | w67 (GLM) | dissent |
|---|---|---|---|---|---|---|
| raf-closure-receipt | 0.45 | 0.48 | **0.465** | 0.80 / 2.0 | 0.82 / 2.3 | YES |
| cell-fleet-readme | 0.43 | 0.44 | **0.435** | 0.867 / 2.33 | 0.82 / 2.3 | YES |
| nugget-ledger | 0.55 | 0.54 | **0.545** | 0.85 / 2.0 | 0.77 / 2.0 | YES |
| exoj-wave69 (README section) | 0.46 | 0.45 | **0.455** | 0.667 / 1.67 | (new) | YES |
| push-all-sh (the push exoj) | 0.11 | 0.12 | **0.115** | 0.567 / 1.67 | 0.63 / 1.7 (kin) | YES |

## The meta-finding: the native oracle is MORE discriminating than the GLM stand-in

1. **Separation of "canon" from "good"**: the native judge demotes `push-all.sh`
   (0.115) — an excellent production script is NOT canon (transferable doctrine).
   The GLM/engineer lens scored it 0.7 for exactly the virtues ("production-level
   CI/CD design") that make it NOT canon. Wave-67's transport-swapped gate
   conflated engineering quality with canon-worthiness; the native protocol does
   not. **All wave-67 canon_p values should be re-baselined against the native
   oracle before they are used as gate evidence.**
2. **Native ranking**: nugget-ledger (0.545) > raf-closure (0.465) > exoj-wave69
   (0.455) > cell-fleet-readme (0.435) ≫ push-all-sh (0.115). Findings-led
   artifacts still rank highest (consistent with wave-67), but the whole prose
   family sits mid-field — the canon bar is higher than the fleet thought.
3. **Dissent structure**: every artifact shows a ≥0.15 gap. GLM's most generous
   lens per artifact quotes the artifact's strongest virtue; the native judge
   prices the same text as mid-canon. Sharpest example: raf-closure-receipt —
   GLM/engineer 0.85 ("novel application of autocatalytic set theory… actionable
   design insights") vs native 0.465. Both see the same text; the disagreement is
   about what "canon" MEANS. The fleet now has two judge families whose deltas
   are themselves a measurement instrument.

## Wave-68 consequences (leveled)

- Keep BOTH judges: native = canon gate (strict), GLM-lens = quality review
  (generous). Their delta per artifact is a new scalar the fleet can track over
  time (canon-quality gap).
- Re-run the wave-66 atlas gate-map ranking under the native oracle when keys
  allow bulk re-judging; expected effect: gate weights shift toward the
  nugget/ledger family, away from run receipts and operational scripts.

## Fidelity / security receipts

- Key material: never printed, never written to tracked files; error paths run
  through the scrubber (`apikey_/sk-` patterns → `[KEY-REDACTED]`).
- Chunking receipts: 5 artifacts, 12k chunks — per-chunk verdicts in the JSON;
  aggregation = unweighted mean over chunks (jev_client.py has no chunk rule;
  documented as a transport-layer convention).
- `jev-preview` model id served without error — within-family ensemble is live.
