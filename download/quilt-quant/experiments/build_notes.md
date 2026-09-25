# Build notes — what the desk taught its builder

This is the agent UX record for quilt-quant: what broke, what the reactive
engine taught, and which honest-numbers discipline caught which bug. It exists
because the user asked for the process of building and learning to be
documented, not just the artifact.

## 1. Formula-over-program goes stale (the P2 family, met in production)

The first desk had metric cells as formulas reading `bt.run` (a program cell)
directly. Result: after `engine.set('p.fast', 21)`, `met.sharpe` still showed
the fast=8 value. Root cause: programs re-evaluate lazily on pull, while
formulas eagerly recompute during propagation — against the program's LAST
computed value. The upstream probe suite called this P2; here it showed up as
a desk that refused to re-price.

**The fix is the spreadsheet-native pattern**: pricing cells PUBLISH their
receipts into value cells (`bt.last`, `wf.last`, `bnh.last`), and every derived
formula reads the published receipt. Set-propagation then recomputes formulas
against fresh data, always. The desk rule: a formula may read a program's
published receipt, never the program's live internals.

The viewer and harness share the discipline: after any value push, pull the
pricing cells (that IS the re-price), then read everything else.

## 2. The hand-computed tape caught a real accounting bug

My own hand audit of a 10-bar fee example found it: a trade still open at the
last bar paid a "virtual exit fee" in its trade PnL, but the equity path never
paid it. `sum(trade pnl) != equity change` — the ledger and the equity told
two different stories. The desk now charges the liquidation fee in the equity
path too (S4's clause says exactly that), and the harness asserts the
consistency invariant on every config it tests.

The same hand exercise caught a second one: I wanted `fast=2, slow=3`, but the
sheet's own S2 clause (`slow >= fast + 2`) correctly refused it. The desk's
doctrine beat the builder's convenience — exactly what the doctrine is for.

## 3. Warmup is a contract between three cells

S3's audit originally expected flat positions through `max(slow-1, rsi_len+1)`
while the signal cell only requires all three indicators to exist —
`max(fast-1, slow-1, rsi_len)`. A legitimate signal would have been refused as
"malformed". Lesson: when a clause (natural language) is ported to a checker
(machine), the checker must be derived from the MACHINE's actual warmup, not
the builder's memory of it. The clause text now names the same maximum.

## 4. Receipts speak the gate's language

The first trainer booked refusals that the workbench adopted in-sample as
`kind: 'fit'` — which made the OVERFIT trap look like a success story in the
ledger. Rebuilt: every non-promotion is a `refuse` receipt (the gate's
verdict), with `wb_moved` as a separate field (the workbench's decision). Two
decisions, two fields, one row. The learning curve print now shows `·wb` marks
on refused-but-adopted candidates.

## 5. The deterministic trainer made determinism a test

Because the trainer uses a seeded RNG and a logical receipt chain (wall-clock
`ts` lives OUTSIDE the hash), two runs with the same seed produce
byte-identical receipt streams — and the harness proves it. This is only
possible because `canon()` excludes `ts`; a receipt chain that hashes wall
clock cannot be re-derived on a rerun. Keep time OUT of the proof, IN the
display.

## 6. Browser reality: key mismatches are the runtime's favorite bug

The viewer's first render showed all metrics as "—" while the charts were
perfect. The snapshot collected `met.ret`; the renderer read `met_ret`. The
desk was correct the whole time — the transcription layer between cells and
pixels was not. Two-minute fix, and a reminder that the playtest harness
cannot catch UI-layer transcription bugs; only pointing a browser at the
bundle does.

## 7. What the engine did NOT need

Zero engine changes. The desk runs on the arcade's vendored engine (patches
1–12) untouched: value push drives everything, program cells inline their own
pure kernels (the E8 lesson, applied via build-time snippet interpolation),
listener cells watch the champion seat, formula cells derive from published
receipts. The spreadsheet abstraction absorbed a new domain (markets) without
a single patch — which is the strongest evidence yet that the arcade template
generalizes.
