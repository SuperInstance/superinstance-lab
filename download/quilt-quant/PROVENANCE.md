# Engine provenance

`engine/` is the **patched quilt core** copied verbatim from `quilt-arcade/engine/`
(assembled from `SuperInstance/quilt` upstream `fdfed69` + playtest patches 1–12,
all verified against the 36-test upstream suite — see
`quilt-playtest/patches/playtest-patches.diff` for the cumulative diff).

The two patches this desk leans on hardest:

- **Patch: effectful invalidation** — program cells are invalidated by upstream
  `set`, so nudging `p.fast` genuinely re-runs the backtest desk (E5 finding).
- **Patch: fresh-by-default effectful evaluation** (found by the hold'em sheet) —
  program/router/ai cells re-evaluate unless `memo: true`, so the same call with
  the same input can evolve state (the trainer ledger moves).

No engine modifications were made while building quilt-quant. If a quant check
fails, it is the sheet's fault, not the engine's — and that is the point of the
harness.
