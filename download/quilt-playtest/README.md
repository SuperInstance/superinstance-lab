# Quilt Play-Test Deliverables

Extensive play-testing of https://github.com/SuperInstance/quilt (v0.3.0).
Everything here runs against a **patched engine** — see `patches/playtest-patches.diff`
(727 lines of PR-ready fixes + comments, all 36 upstream tests still passing).

## Quick start

```bash
cd /home/z/my-project/quilt-playtest   # the play-tested clone (already patched + built)
node <script>.mjs                      # any file below
```

## The demos (all verified working)

| File | What it proves |
|---|---|
| `e7_probes.mjs` | 11-probe adversarial suite: reactive semantics, per-tenant memoization, 900-deep chains, 5000-fanout in ~3ms, cycle behavior, NaN flow. **9/11 pass** (2 documented gaps). |
| `e2_reactive_basics.mjs` | From-scratch reactive app: sensors → formulas → edge-triggered listener → pager program, with dashboard subscriptions. |
| `e2b_examples_e2e.mjs` | The repo's own example fleet driven end-to-end: boat-autopilot off-course alert, weather dangerous alert, self-tuning anomaly escalation (EWMA baseline), task-scheduler overdue alert, tracing. |
| `e3_gesture_ekg.mjs` | **Novel**: CellEKG — the repo's Gesture differential-geometry math wired to live engine subscriptions. Classifies cell motion (drifting / oscillating / stuck) and caught a cooling-loop fault a threshold alarm cannot see. |
| `e4_federation.mjs` | **Novel**: the missing QuiltEngine → SDK adapter (`adaptEngine()`, ~20 lines). Three engines (edge/server/cloud) linked via `LocalCellTransport` + `CellRouter`: cross-instance reads, rollups, remote alert handles, `quilt://` URIs. |
| `e6_multitenant.mjs` | **Novel**: ONE sheet as a multi-tenant backend. Caller-context memoization gives per-tenant isolated caches (`f:cap.answer\|i:acme\|t:premium`), tier-gated routing blocks the free tier before it reaches the "model". |
| `e5_llm_cells.mjs` | **Flagship — the spreadsheet that thinks.** Real GLM calls (via z-ai-web-dev-sdk as the missing AI provider) inside `kind: 'ai'` cells. Three support tickets scored 1/10, 10/10, 7/10; escalation gate drafted a reply only for the outage; 7 real LLM calls total. Needs network. |

## Engine patches contributed (in `patches/playtest-patches.diff`)

1. **Listener `watch` wiring** — watch lists were never added to the dependency graph, so *every listener in every example sheet was dead code*. (`engine.ts`, loadSheet + register)
2. **Value-cell stale read** — `get()` on a value cell returned the *definition's* value, so `set()` was invisible to `get()` (but visible to formulas!). Classic stale-read asymmetry. (`engine.ts`)
3. **Eager reactive mode** (`options.eager`) — stale formulas recompute during propagation; listeners observe real prev→current transitions, making edge-triggered conditions (`prev !== "red" && current === "red"`) possible at all. (`engine.ts`)
4. **Propagation cycle guard** — `set`/`push` on a cyclic sheet recursed forever; now guarded by a visited set. (`engine.ts`)
5. **Fresh event contexts for listener actions** — actions were memoized after their first fire (state machines ran once) and couldn't see the event; now each fire gets a unique context carrying `caller.metadata.{changed,prev,current}`. (`listener.ts`)
6. **Router context passthrough + `contains` sugar fix** — delegation kept per-tenant cache isolation; `caller.identity.tags contains "x"` no longer compiles to an out-of-scope bare `tags`. (`router.ts`, `context.ts`)
7. **Effectful cache invalidation** — program/router cells now invalidate when declared upstream cells change (an LLM workflow used to serve its first result forever). (`engine.ts`)

## Example-sheet fixes (also in the diff)

- `weather-monitor`: io action cells → program cells (io actions are silent no-ops); fixed a `=is_comfortable == false` condition whose leading `=` made it silently unfireable.
- `task-scheduler`: `any_overdue` program → formula (derived boolean state must be pure to be watched); io → program.
- `sensor-anomaly`: redesigned as a *working* push-driven loop — EWMA state in a value cell updated by listener→program→`runtime.set`, z-score + escalation as formulas, edge-triggered escalation listener with a real action.

## Known gaps left open (documented, not patched)

- `contextKey` excludes `input` — same context + different input returns the memoized first answer. Workaround: vary `ctx.row` per request.
- NaN flows through the pure graph with `status: "ready"`.
- Formulas read effectful cells' *last* value; undeclared `runtime.get` deps are invisible to invalidation.
- Program cells execute via `new AsyncFunction` — no sandboxing (documented in-repo, real for multi-tenant use).
- `get()` on an idle cyclic sheet still stack-overflows (pull path).
