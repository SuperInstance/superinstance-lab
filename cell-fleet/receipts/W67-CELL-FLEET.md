# receipts/W67-CELL-FLEET.md — cell-fleet tissue reports (wave 67, task 67-c1)

Appended per run by scripts/simulate.mjs — append-only, nothing deleted.
Runtime: LOCAL workerd via `wrangler dev --local` (wrangler 4.147.0).
Deployed: **NO** — no Cloudflare account or API token exists in this container
(all credential material lost; receipted honestly). The experiment runs on the
same runtime the fleet's live workers run on, minus the edge.

## Run 2026-10-04T09:21:40.796Z

- runtime=workerd local (wrangler dev --local, wrangler v4.147.0); deployed=**NO** (no credentials — see header receipt)
- tasks: 60/60 ok (0 failures), 20 with duplicate-facet input
- reward trajectory: first-10 avg 0.634 → last-10 avg 0.991 (overall avg 0.932)
- genome-hash changes (learning events): 60

### Tissue report

| metric | value |
|---|---|
| population (live cells) | 7 |
| generations | 3 |
| mitosis events | 18 |
| apoptosis events | 13 (causes: low-affinity=1, starvation=12) |
| graves (apoptotic bodies in KV) | 13 |
| lineage edges | 18 |
| mean affinity (live cells, EMA) | 0.9926 |
| best affinity (live cells, EMA) | 1 |
| receipts (live ledgers + buried) | 245 (35 live + 210 buried) |

### Affinity / population trajectory

| after | population | maxGen | meanAffinity | mitosis | apoptosis | graves |
|---|---|---|---|---|---|---|
| 10 | 3 | 0 | 0.4681 | 0 | 0 | 0 |
| 20 | 3 | 1 | 0.9418 | 3 | 1 | 1 |
| 30 | 7 | 1 | 0.9782 | 7 | 1 | 1 |
| 40 | 10 | 1 | 0.9822 | 8 | 1 | 1 |
| 50 | 10 | 1 | 0.9856 | 8 | 1 | 1 |
| 60 | 10 | 1 | 0.9888 | 8 | 1 | 1 |
| poll+0s | 10 | 1 | 0.9888 | 8 | 1 | 1 |
| poll+2s | 10 | 1 | 0.9888 | 8 | 1 | 1 |
| poll+4s | 10 | 1 | 0.9893 | 8 | 1 | 1 |
| poll+6s | 10 | 1 | 0.9887 | 8 | 1 | 1 |
| poll+8s | 10 | 1 | 0.9887 | 8 | 1 | 1 |
| poll+10s | 10 | 1 | 0.9889 | 8 | 1 | 1 |
| poll+12s | 10 | 1 | 0.9883 | 8 | 1 | 1 |
| poll+14s | 8 | 1 | 0.9875 | 9 | 3 | 3 |
| poll+16s | 8 | 1 | 0.9881 | 12 | 3 | 3 |
| poll+18s | 9 | 2 | 0.9866 | 12 | 6 | 6 |
| poll+20s | 8 | 2 | 0.9893 | 13 | 7 | 7 |
| poll+22s | 8 | 2 | 0.9893 | 13 | 7 | 7 |
| poll+25s | 7 | 2 | 0.9872 | 15 | 9 | 9 |
| poll+27s | 8 | 2 | 0.9899 | 16 | 10 | 10 |
| poll+29s | 8 | 2 | 0.9899 | 16 | 10 | 10 |
| poll+31s | 8 | 2 | 0.9908 | 16 | 11 | 11 |
| poll+33s | 7 | 2 | 0.9936 | 16 | 12 | 12 |
| poll+35s | 7 | 2 | 0.9936 | 16 | 12 | 12 |
| poll+37s | 7 | 2 | 0.9928 | 16 | 12 | 12 |
| poll+39s | 7 | 2 | 0.9941 | 16 | 12 | 12 |
| poll+41s | 7 | 2 | 0.9941 | 16 | 12 | 12 |
| poll+43s | 7 | 2 | 0.9938 | 16 | 12 | 12 |
| poll+45s | 7 | 2 | 0.9944 | 16 | 12 | 12 |
| poll+47s | 7 | 2 | 0.9944 | 16 | 12 | 12 |
| poll+49s | 7 | 2 | 0.9944 | 16 | 12 | 12 |
| poll+51s | 7 | 2 | 0.9943 | 16 | 12 | 12 |
| poll+53s | 7 | 2 | 0.9943 | 16 | 12 | 12 |
| poll+55s | 7 | 2 | 0.9936 | 16 | 12 | 12 |
| poll+57s | 7 | 2 | 0.9932 | 16 | 12 | 12 |
| poll+59s | 7 | 2 | 0.9932 | 16 | 12 | 12 |
| poll+61s | 7 | 2 | 0.9923 | 17 | 12 | 12 |
| poll+63s | 7 | 3 | 0.9926 | 18 | 13 | 13 |

### Lineage tree (parent → child; † = apoptosis, buried in KV `grave:{id}`)

```
c-6897ab8d3c8072f5 [gen 0, †low-affinity, ema 0.5916]
c-c5d0e981e5182ee2 [gen 0, †starvation, ema 0.9853]
c-581944c840f9c8dc [gen 1, †starvation, ema 0.9864]
c-0ac9d1ad0e352bf5 [gen 1, †starvation, ema 0.9924]
c-1f52c1219de51149 [gen 2, ema 0.9862, tasks 4]
c-7f1d3bdca20dfe80 [gen 3, ema 1, tasks 1]
c-4f4b8683c007c17b
c-1c0b92495f5c1136 [gen 2, ema 0.994, tasks 3]
c-ed7ea43483b99a9d [gen 1, †starvation, ema 0.9963]
c-86c98fb08da0c58e [gen 1, †starvation, ema 0.9813]
c-749e1f1168a703bc [gen 2, †starvation, ema 0.9976]
c-d8b707397d2c52c8 [gen 1, ema 0.9894, tasks 3]
c-2fb3e7b6263e7f96 [gen 0, †starvation, ema 0.981]
c-eaa62b91105b7c69 [gen 1, †starvation, ema 0.9948]
c-3a8464fc061390dc [gen 1, †starvation, ema 0.9913]
c-9a35b206c9cb6d83 [gen 2, ema 0.9895, tasks 3]
c-8f65bc19262a8cfd [gen 2, ema 0.995, tasks 3]
c-a07bcf70cd3b272d [gen 1, †starvation, ema 0.9972]
c-4bb98bf7fe195e61 [gen 2, †starvation, ema 0.975]
c-edbc6e3c79943958 [gen 1, †starvation, ema 0.9813]
c-de2792c400ee4648 [gen 1, ema 0.9943, tasks 3]
```

### Live cells

| cell | gen | parent | tasks | rewardEMA | genomeHash | ledger receipts |
|---|---|---|---|---|---|---|
| `c-d8b707397d2c52c8` | 1 | c-c5d0e981e5182ee2 | 3 | 0.9894 | `665d64e4b21a36a7` | 6 (ok=true) |
| `c-de2792c400ee4648` | 1 | c-2fb3e7b6263e7f96 | 3 | 0.9943 | `dbf9e09445887a06` | 5 (ok=true) |
| `c-1c0b92495f5c1136` | 2 | c-0ac9d1ad0e352bf5 | 3 | 0.994 | `b2adc3e64f92383c` | 5 (ok=true) |
| `c-1f52c1219de51149` | 2 | c-0ac9d1ad0e352bf5 | 4 | 0.9862 | `6cd29af601b1474e` | 8 (ok=true) |
| `c-8f65bc19262a8cfd` | 2 | c-3a8464fc061390dc | 3 | 0.995 | `e6d01a400c183a05` | 5 (ok=true) |
| `c-9a35b206c9cb6d83` | 2 | c-3a8464fc061390dc | 3 | 0.9895 | `78b8c14961831caa` | 5 (ok=true) |
| `c-7f1d3bdca20dfe80` | 3 | c-1f52c1219de51149 | 1 | 1 | `b95f27b9264ec399` | 1 (ok=true) |

### Graves (apoptotic bodies — receipts never deleted, exocytosed to KV)

| cell | cause | gen | parent | tasks | EMA | buried receipts | tip | diedAt |
|---|---|---|---|---|---|---|---|---|
| `c-6897ab8d3c8072f5` | low-affinity | 0 | — | 4 | 0.5916 | 5 | `faa4872f2129` | 2026-10-04T09:21:46.881Z |
| `c-581944c840f9c8dc` | starvation | 1 | c-c5d0e981e5182ee2 | 5 | 0.9864 | 15 | `e8c1d12e88fb` | 2026-10-04T09:22:34.967Z |
| `c-ed7ea43483b99a9d` | starvation | 1 | c-c5d0e981e5182ee2 | 4 | 0.9963 | 12 | `613546ffcbf9` | 2026-10-04T09:22:34.975Z |
| `c-c5d0e981e5182ee2` | starvation | 0 | — | 11 | 0.9853 | 29 | `db4547d71592` | 2026-10-04T09:22:38.033Z |
| `c-eaa62b91105b7c69` | starvation | 1 | c-2fb3e7b6263e7f96 | 7 | 0.9948 | 23 | `99a57311d899` | 2026-10-04T09:22:38.034Z |
| `c-edbc6e3c79943958` | starvation | 1 | c-2fb3e7b6263e7f96 | 4 | 0.9813 | 12 | `ccfdb104e64b` | 2026-10-04T09:22:38.035Z |
| `c-86c98fb08da0c58e` | starvation | 1 | c-c5d0e981e5182ee2 | 4 | 0.9813 | 12 | `03349363bd98` | 2026-10-04T09:22:41.044Z |
| `c-0ac9d1ad0e352bf5` | starvation | 1 | c-c5d0e981e5182ee2 | 5 | 0.9924 | 17 | `f5b098f62375` | 2026-10-04T09:22:44.002Z |
| `c-a07bcf70cd3b272d` | starvation | 1 | c-2fb3e7b6263e7f96 | 5 | 0.9972 | 18 | `632cae6ffe8e` | 2026-10-04T09:22:44.049Z |
| `c-2fb3e7b6263e7f96` | starvation | 0 | — | 12 | 0.981 | 35 | `0ddeae8f483b` | 2026-10-04T09:22:47.070Z |
| `c-3a8464fc061390dc` | starvation | 1 | c-2fb3e7b6263e7f96 | 6 | 0.9913 | 22 | `23241d92ff7c` | 2026-10-04T09:22:50.081Z |
| `c-4bb98bf7fe195e61` | starvation | 2 | c-a07bcf70cd3b272d | 1 | 0.975 | 3 | `15d2995a71b5` | 2026-10-04T09:22:53.051Z |
| `c-749e1f1168a703bc` | starvation | 2 | c-86c98fb08da0c58e | 3 | 0.9976 | 7 | `b46477a922df` | 2026-10-04T09:23:23.097Z |

### Tissue events (last 24 of 34)

| at | event | cell | note |
|---|---|---|---|
| 2026-10-04T09:21:58.933Z | MITOSIS | c-edbc6e3c79943958 | parent=c-2fb3e7b6263e7f96 |
| 2026-10-04T09:22:01.931Z | MITOSIS | c-86c98fb08da0c58e | parent=c-c5d0e981e5182ee2 |
| 2026-10-04T09:22:34.970Z | APOPTOSY | c-581944c840f9c8dc | cause=starvation |
| 2026-10-04T09:22:34.983Z | MITOSIS | c-1f52c1219de51149 | parent=c-0ac9d1ad0e352bf5 |
| 2026-10-04T09:22:34.983Z | APOPTOSY | c-ed7ea43483b99a9d | cause=starvation |
| 2026-10-04T09:22:35.021Z | MITOSIS | c-749e1f1168a703bc | parent=c-86c98fb08da0c58e |
| 2026-10-04T09:22:35.021Z | MITOSIS | c-d8b707397d2c52c8 | parent=c-c5d0e981e5182ee2 |
| 2026-10-04T09:22:35.022Z | MITOSIS | c-4bb98bf7fe195e61 | parent=c-a07bcf70cd3b272d |
| 2026-10-04T09:22:38.045Z | APOPTOSY | c-edbc6e3c79943958 | cause=starvation |
| 2026-10-04T09:22:38.045Z | APOPTOSY | c-c5d0e981e5182ee2 | cause=starvation |
| 2026-10-04T09:22:38.047Z | APOPTOSY | c-eaa62b91105b7c69 | cause=starvation |
| 2026-10-04T09:22:40.996Z | MITOSIS | c-1c0b92495f5c1136 | parent=c-0ac9d1ad0e352bf5 |
| 2026-10-04T09:22:41.051Z | APOPTOSY | c-86c98fb08da0c58e | cause=starvation |
| 2026-10-04T09:22:44.004Z | APOPTOSY | c-0ac9d1ad0e352bf5 | cause=starvation |
| 2026-10-04T09:22:44.052Z | APOPTOSY | c-a07bcf70cd3b272d | cause=starvation |
| 2026-10-04T09:22:44.063Z | MITOSIS | c-9a35b206c9cb6d83 | parent=c-3a8464fc061390dc |
| 2026-10-04T09:22:44.063Z | MITOSIS | c-de2792c400ee4648 | parent=c-2fb3e7b6263e7f96 |
| 2026-10-04T09:22:47.076Z | MITOSIS | c-8f65bc19262a8cfd | parent=c-3a8464fc061390dc |
| 2026-10-04T09:22:47.077Z | APOPTOSY | c-2fb3e7b6263e7f96 | cause=starvation |
| 2026-10-04T09:22:50.083Z | APOPTOSY | c-3a8464fc061390dc | cause=starvation |
| 2026-10-04T09:22:53.055Z | APOPTOSY | c-4bb98bf7fe195e61 | cause=starvation |
| 2026-10-04T09:23:20.050Z | MITOSIS | c-7f1d3bdca20dfe80 | parent=c-1f52c1219de51149 |
| 2026-10-04T09:23:23.063Z | MITOSIS | c-4f4b8683c007c17b | parent=c-1f52c1219de51149 |
| 2026-10-04T09:23:23.099Z | APOPTOSY | c-749e1f1168a703bc | cause=starvation |

### Verification bar (this run)

| check | verdict |
|---|---|
| workerd boots + /health 200 | PASS |
| ≥30 tasks executed, reward ∈ [0,1] | PASS (60) |
| learning: genome hash changed ≥5× | PASS (60) |
| ≥1 mitosis | PASS (18) |
| ≥1 apoptosis | PASS (13) |
| ≥3 generations | PASS (3) |
| population ≥2 at close | PASS (7) |
| lineage edges valid | PASS |
| receipt chains self-verify | PASS |
| buried ledgers intact (no CHAIN_BROKEN) | PASS |
| affinity maturation (best EMA ≥0.8) | PASS (1) |

### Platform notes (receipted this run)

- Workers Queues NOT used: live CF docs state Queues is available on Free and
  Paid plans, but this container has NO account/token (nothing remote is
  possible), and selection signals must arrive synchronously — DO-to-DO fetch
  + KV CELL_MATRIX is the signaling substrate instead.
- DO alarms fire locally in workerd (the cell cycle ran end-to-end above);
  KV list/put/get/delete all exercised via the membrane.
- No keys, no .env: this script reads no secrets and needs none.

---

## Wave-67 close-out (task 67-c1, appended by the lane agent 2026-10-04T09:2xZ)

### Verification bar — mission items

| # | mission verification item | verdict | evidence |
|---|---|---|---|
| 1 | workerd starts locally in this container | **PASS** | `wrangler dev --local --port 8787` headless (CI=true, WRANGLER_SEND_METRICS=false), wrangler 4.147.0 / workerd; `/health` 200; local DO (Cell, Tissue) + KV (CELL_MATRIX) bindings live |
| 2 | simulate.mjs drives 30+ tasks with ≥1 mitosis AND ≥1 apoptosis across generations | **PASS** | 60 tasks, 18 mitoses, 13 apoptoses (low-affinity=1, starvation=12), 3 generations, final population 7 — all asserts green (run 2026-10-04T09:21:40.796Z above) |
| 3 | receipt contains tissue report table + runtime/deployed statement | **PASS** | tissue report, trajectory, lineage tree, graves, events + "runtime=workerd local … deployed=**NO**" in the header and per-run line |
| 4 | all asserts green | **PASS** | 11/11 PASS in the run's verification-bar table; `node scripts/simulate.mjs` exit 0 ("ALL GREEN") |

### Tissue report numbers (receipted run)

- population **7** live cells (carrying capacity CAP=10 enforced) · generations **0→3**
- lineage tree: 2 surviving founder lines (c-2fb3e7…, c-c5d0e9…) plus the senescent founder line pruned at gen 0; deepest edge gen2→gen3 (`c-1f52c1219de51149 → c-7f1d3bdca20dfe80`)
- affinity trajectory (mean reward EMA of live tissue): 0.4681 (task 10) → 0.9418 (task 20) → 0.9888 (task 60) → **0.9926** close; per-task reward first-10 avg **0.634** → last-10 avg **0.991**
- mitosis **18** · apoptosis **13** (causes: low-affinity **1** = the inverted senescent founder, EMA 0.5916 < 0.72; starvation **12** = nutrient-limited trickle phase) · receipts **245** (35 live + 210 buried), every chain self-verified, no CHAIN_BROKEN graves

### Environment receipts (honest negatives + provenance)

- **No Cloudflare credentials exist** in this container (account/token material
  all lost — same finding as the wave-66 push probe). Nothing remote was
  attempted or possible; `deployed=NO` everywhere. KV namespace id is a local
  placeholder; on a real deploy you would `wrangler kv namespace create`.
- **Prior partial lane state inherited and fixed** (this directory existed with
  un-receipted work from an earlier 67-c1 attempt that died before any receipt):
  its `wrangler.toml` had a fatal TOML typo (`[igrations]]` → `[[migrations]]`),
  `receipts/` was empty, and no README existed. The one code bug found this wave:
  `GET /tissue` 500'd on every call (`st.lineageEdges` — the Tissue DO's
  `stateFull()` exposes `lineage`, not `lineageEdges`); fixed by deriving edges
  from `st.lineage` with defensive defaults. The stale un-receipted dev state
  (`.wrangler/state`) was wiped before the receipted run so the report above is
  a clean genesis, not a continuation.
- **Queues NOT used** (Workers Paid / account prerequisite; also a poor fit for
  selection signals, which must arrive synchronously to count): mitosis is
  DO→DO fetch (`env.CELL` namespace stub from inside the parent nucleus → child
  `/init`), lineage + membrane signaling via the Tissue DO and KV CELL_MATRIX.
- Platform limits hit (local runtime): KV has no CAS — `stat:*` read-modify-write
  counters were removed in favor of authoritative stores (Tissue registry +
  unique-key grave rows), receipted in code; KV list is eventually consistent in
  production (local is immediate); a cell born in a tick publishes its first
  membrane row on its NEXT tick, so a just-born cell can briefly appear in the
  lineage tree without a live-row label — cosmetic, honest.
- Secrets discipline: no keys anywhere; the simulator reads only env knobs
  (`CELL_BASE`, `CELL_TASKS`, `CELL_PACE_MS`); zero external network calls —
  localhost only.

### Addendum — unscripted post-run ecology (observed live, receipted)

The dev server kept running after the receipted run closed. With the
nutrient stream gone, the tissue starved to **total extinction** (population
0; mitosis 21, apoptosis 24, receipts 262 by 09:26Z) — every death a
`STARVE_TICKS` starvation, every ledger buried intact in KV `grave:*`.
The next single task triggered the stem-cell niche: events
`FOUNDER c-d50e0624a5074db3 (stem-cell niche)` + `RESEED (population hit
zero; founder re-seeded)` at 2026-06-…09:26:08Z — the recovery path from
src/tissue.js fired exactly as designed, and the founder's first membrane
row appeared on its first tick (population 1). Full lifecycle observed:
genesis → maturation → mitosis → carrying-capacity churn → starvation
extinction → reseed. This addendum was NOT part of the scripted run; it is
recorded because it happened.

**CORRECTION (same session, appended — append-only, no silent edits):** the
paragraph above over-claimed. Observed facts, from the live tissue state:
the reseeded founder `c-d50e0624a5074db3` received exactly one task (the
probe), was fed nothing afterwards, starved at its 6th tick
(`APOPTOSY cause=starvation`, 09:26:26Z — 18 s after birth), and lies in
`grave:c-d50e0624a5074db3` with its ledger intact (graves now 25, lineage
edges 21). Population was **0 at every observed instant** — the founder's
membrane row lived only between its first tick and its death, and no probe
landed inside that window. So the receipted end state is: empty live
membrane + full grave record + RESEED path proven to FIRE (event logged,
founder constructed, fed once) — reseed-to-survival under continued load
remains demonstrated by the main run's trajectory, not by this probe.
Honesty over narrative.
