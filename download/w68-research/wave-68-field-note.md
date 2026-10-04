# Wave-68 Field Note — the lab goes public

*Status: whitepaper-in-waiting. This note is the render-ready source for the
next whitepaper PDF session (wave-66 established the format; wave-68 closes
with receipts + this note per wave-67 precedent).*

## 1. The Push Wave

For two waves the fleet's standing honest negative was "everything push-ready,
nothing pushed — no live credential exists in-container." Wave-68 opened with
the principal dropping live material into the channel. The push exoj
(`scripts/push_all.sh`) had been waiting for exactly this: one command, token
transient in URLs, never persisted.

What actually happened was richer than a push. The remote census revealed the
superinstance is a **shared user account where other agents keep working**:
21 of 31 fleet repos were behind remote — ~560 commits of other agents' work
absorbed by fast-forward (never clobbered), one true divergence (exoj: our
atlas-kit commit vs their wave-69 GAN work) resolved by rebase with
keep-both conflict stitches, and cot-quilt rejected at push because the
remote carried the *pre-purge* history with the sk- incident — our force-push
completed the very "scrub-at-choke-point" that the remote's own
SECURITY-INCIDENT commit had called for. The lab journal landed as
`SuperInstance/superinstance-lab`; the EXOJ kit landed on
`SuperInstance/exoj` at c50575c, riding on top of others' wave-69 work.

The deepest integration finding came from the recon lane: the fleet now has
its first *finished, tested interface part* — exoj's `sxc1` envelope
(float-free bodies, pre-registered five-layer fail-closed verify, sticky
scars that survive rewind) — and a measured defect of record: the café
canary hash has **forked** (FNV-1a-64 over UTF-8 bytes vs UTF-16 code units
across repos). Unify before joining any two chains.

## 2. Distant fields → the fleet's own law candidate

Three new fields (no overlap with wave-67's five): bacterial quorum sensing +
conjugative plasmids (lateral learning channel; the AI-2-mimic spoofing
warning), viral quasispecies (survival-of-the-flattest), bitcoin mempool fee
markets (admission gates under a capacity ceiling). The round's spine was a
quasispecies replay over the *real* receipted cell-fleet tissue — and it
returned a number the fleet had been misreading: **mutation noise (σ≈0.0097)
is 2.3× the live landscape contrast (σ≈0.0043)**. Wave-67's celebrated
0.634→0.991 maturation was per-cell learning + neutral drift, not selection.
Law candidate leveled: `σ_mutation ≤ 0.5·σ_contrast` (currently violated
~4.6×). Novel questions Q7–Q11 written into
`download/w68-research/nugget-ledger-w68.md`.

## 3. The JEV calibration shock

The native transport (`api.typesafe.ai/v1/systemone`, jev-1.13.0) came back
hot — 25/25 judge calls across 5 artifacts and two judge families, zero
errors. The result re-prices the fleet's own gate evidence: the native canon
oracle scores everything lower (0.115–0.545) than the GLM lens family
(0.567–0.867), and it separates **canon from good**: the push exoj — an
excellent production script — gets 0.115 from the native judge and 0.7 from
GLM/engineer for exactly the virtues that make it *not* canon. Wave-67's
transport-swapped values conflated the two. Leveled: keep both families;
their per-artifact delta (the canon-quality gap) is a new trackable scalar;
re-baseline wave-66's gate-map ranking under the native oracle before using
it as evidence.

## 4. The A/B: a pre-registered honest negative

The two sharpest nuggets became chemistry and went to trial on real workerd:
robustness-gated mitosis (survival-of-the-flattest) and fee-priority
admission (mempool market on the KV membrane). Rules R1–R4 were written into
the driver **before** either arm ran; arm A replicated wave-67's receipt
nearly exactly (0.680→0.990, 13+1 deaths, 20 mitoses); arm B matured faster
(first-10 +0.088), killed nobody by low-affinity, didn't freeze — and the
verdict is **REJECTED per R1 as written**, because the primary metric (last-10
mean) saturates at 0.9898 on both arms. The receipt refuses to spin this: the
letter of the pre-registered rule stands, the ceiling-effect analysis stands
beside it, and wave-69's A/B must run a non-saturating corpus with its rules
written first. Amending the metric after seeing these numbers would be
p-hacking, and the fleet does not do that.

## 5. The incident

The same audit sweep that hardens also exposes. The new `apikey_` pattern —
added the day the typesafe key family arrived — caught the **old** wave-63-era
key hardcoded in four tracked files, invisible to every previous audit, pushed
to the public lab repo with the push wave, and served for ~40 minutes.
Remediation followed the wave-67 playbook at speed: worktree scrub committed
first, filter-repo `--replace-text` across full history (after re-learning
that background jobs die silently here, and that /tmp files evaporate between
tool calls — atomic chains only), gc, force-push-with-lease, and the local
ghost objects in cot-quilt (leak-bearing blobs surviving under a stale
remote-tracking ref) purged. The live key never touched git. Laws leveled:
every new credential family gets its audit pattern the same day it arrives;
mirror bundles are re-cut after any history rewrite; remote-tracking refs are
part of the leak surface.

## 6. Wave-69 queue (written where it belongs)

1. Interface parts first: adopt `sxc1` as the cell-fleet membrane packet
   format; unify the café canary hash (UTF-8 vs UTF-16 fork) before any
   cross-repo chain join.
2. Re-run the wave-66 atlas gate-map under the native canon oracle.
3. Q7: quorum-gated irreversible acts (mitosis at CAP, reseed) from
   receipt-verified membrane rows — replay the 60-task stream; falsified if
   quorum gating raises starvation.
4. Q9 (amended): robustness-gated mitosis on a NON-saturating corpus, rules
   pre-registered, headroom guard in the primary metric.
5. Plasmid channel: publish one morphogen channel's weights to KV as
   `plasmid:{channel}:{hash}` with a carrying penalty and donor credit.
6. Detector cells (Q3): the canons' mutation-verified gate assay ("flip one
   claim byte, expect RED") as a negative-selection organ — most fleet gates
   fail it today; fail-open CI is a byte-identical template across 117 repos.
7. The wave-68 whitepaper PDF, rendered from this note.
