# cell-fleet

**Wave 67 (task 67-c1).** A Cloudflare Workers experiment that *cellularizes
both function and learning*: the fleet's decomposition work is done by a
population of Durable-Object "cells" whose genomes (weight vectors) are
changed by the work they do, divide when they thrive, and die when they
starve or fail. The biology is a mapping, not a metaphor-in-prose — every
structure below is a concrete Worker primitive, running on the **local
workerd runtime** (`wrangler dev --local`; real Durable Objects, real KV,
real alarms).

> **Deployed: NO — by honest constraint.** No Cloudflare account or API token
> exists in this container (all credential material lost; receipted in
> `receipts/W67-CELL-FLEET.md`). Nothing here needs the edge: local workerd
> is the same runtime the fleet's live `quilt-organ-workers` run on, minus
> DNS. Receipted platform substitution: **Workers Queues are not used** —
> signaling is DO-to-DO fetch + KV.

Prior art: `../quilt-organ-workers/` (three live workers; KV organ store,
judge relay, cron watcher). This experiment extends **that repo's
inventive-uses backlog item 2 — "organ-boot-bridge (Durable Object 'nesting'
coordinator)": a DO that hands an incoming agent a boot ticket so two lanes
can nest around the SAME saved state without racing** — from ONE coordinator
DO to a whole tissue of heritable coordinator cells: the boot ticket becomes
a mitosis seed, the nesting registry becomes the lineage registry.

## THE CELL ↔ WORKER MAPPING

| biological structure | Worker primitive | FUNCTION-cellularization (doing decomposition work) | LEARNING-cellularization (changing the genome) |
|---|---|---|---|
| **nucleus** | Durable Object class `Cell` (one instance per cell, SQLite-backed storage) | persists the genome that produces every answer; survives isolate death between requests | applies the delta-rule update inside `/assimilate`; append-only hash-chained receipt ledger of every learning event |
| **genome** | weight vector `w[8]` + bias `b` in DO storage, content-addressed by `genomeHash` (16-hex) | 8 morphogen channels — `part, gate, layer, seal, hole, receipt, idea, organ` (the fleet's atlas/dialect vocabulary) — weight how a task transcribes into parts | the genome **is** the learned parameter set; mutated (gaussian) on mitosis, buried on apoptosis |
| **membrane transport** | KV namespace `CELL_MATRIX` | each tick a cell exocytoses its state row `cell:{id}` (id, gen, parent, tasks, tick) — what the tissue knows from outside | the same row carries `genomeHash` + affinity (`rewardEMA`) — affinity is extracellular signal, readable without touching the nucleus |
| **cell cycle** | DO alarm re-armed every `TICK_MS` (3 s here) | metabolic tick: consolidate, publish membrane row | the tick **decides**: affinity EMA < `APOPTOSIS_BELOW` after `MIN_TASKS` → **apoptose**; EMA ≥ `MITOSIS_ABOVE` **and** `MITOSIS_LOAD` tasks since last division **and** population < `CAP` → **mitose** |
| **ribosome** | the Worker isolate serving one HTTP request | `translate()`: genome × morphogen signal → a decomposition answer (parts, kept facets, dropped facets); pure, transient, stores **nothing** | the same isolate *grades* the answer with the environment rubric (coverage/shrink/uniqueness → reward 0..1) and posts the selection signal to the nucleus; the isolate dies with the behavior, the learning doesn't |
| **mitosis** | DO→DO fetch: parent `Cell` → `env.CELL.get(idFromName(child))` → child `/init`; Tissue DO records the lineage edge | tissue capacity grows with demand (carrying capacity `CAP`) | child genome = parent genome + gaussian noise (`MUT_SIGMA`) — clonal variation / affinity maturation made literal; `lineage:{child} → parent` recorded transactionally in the Tissue DO |
| **apoptosis** | alarm decision → exocytose **full receipt ledger** to KV `grave:{id}` → `storage.deleteAll()` → deregister | frees capacity; population is pruned by starvation (`STARVE_TICKS` taskless ticks) | failure is pruned: low affinity (reward EMA below `APOPTOSIS_BELOW` after `MIN_TASKS`) or nutrient starvation; the ledger survives in the membrane — **receipts never die** |
| **tissue / stem-cell niche** | Durable Object class `Tissue` (single registry instance) | seeds founder cells on first task, routes every task least-recently-served, re-seeds a founder on total extinction (receipted `RESEED`) | holds the lineage registry (who descended from whom) — no genomes; heredity stays in the nuclei |
| **signaling** | DO→DO fetch (Worker→Tissue, Tissue→Cell, Cell→Tissue, Cell→Cell) + KV membrane | synchronous task routing | synchronous selection signals (a reward must not be silently dropped — why Queues were rejected, receipted) |
| **receipts** | per-cell hash-chained ledger, organ-dialect law: `hash = sha256(canon({seq,op,prev}))`, `prev` chains to `GENESIS` | every task, heartbeat, mitosis, apoptosis is receipted | `/tissue` **re-derives every chain** (self-verification) and reports `ok` per live cell; buried ledgers carry their tip hash into the grave row |

## The cell model

**Function.** A task is `{concept: {name, facets[], layerHint?, gates?[]}}`.
The ribosome derives an 8-dim morphogen vector from the concept (deterministic
hash chemistry in `src/lib.js`), reads the genome out of the nucleus
(`/transcribe`), and computes each facet's affinity `a = σ(w·s_f + b)`.
Facets with `a ≥ KEEP_TAU` are kept; kept facets are chunked into at most
`MAX_PARTS` balanced parts. The answer is parts + kept/dropped — a
decomposition of the concept, weighted by the genome.

**Learning.** The environment rubric scores the answer 0..1:
`0.6·coverage (unique facets kept / unique facets) + 0.25·shrink (parts
smaller than the whole) + 0.15·uniqueness (no duplicate parts)`. The nucleus
then applies the delta rule per facet receptor — `w += η·(target − a)·s_f`
(target 1 for a first-occurrence facet, 0 for a duplicate) and
`b += η·(reward − affinity)` globally — then re-hashes the genome and appends
a `TASK` receipt. Repeated exposure to the fleet's concept corpus (the
quilt-organ-workers vocabulary) drives affinity upward: in the receipted run,
mean reward went **0.634 → 0.991** over 60 tasks.

**Cycle.** Every `TICK_MS`, each nucleus: exocytoses its membrane row →
checks apoptosis (low affinity / starvation) → checks mitosis (affinity +
load + carrying capacity) → re-arms its alarm. Thresholds live in
`wrangler.toml [vars]` — tuning is config, receipted, never hidden.

## Endpoints

| route | behavior |
|---|---|
| `GET /` | service index (mapping + endpoints) |
| `GET /health` | liveness |
| `POST /task` | `{concept:{name, facets[], layerHint?, gates?[]}}` → routed to a live cell; ribosome translates, rubric grades, nucleus learns; returns answer, reward, rubric detail, genome hashes before/after, `learned` flag |
| `GET /tissue` | tissue report: population, generations, lineage tree/edges, affinity (mean/best), mitosis & apoptosis counters, graves, per-cell ledger self-verification |
| `GET /cell/{id}` | one cell: genome, EMA, ledger tail |

## Run it (local only)

```bash
cd cell-fleet
npm install                      # wrangler 4.x (node_modules gitignored)
npx wrangler dev --local --port 8787 &   # headless-safe with CI=true
node scripts/simulate.mjs        # 60 tasks → asserts → appends tissue report to receipts/
```

Simulator knobs (env, never hardcoded secrets): `CELL_BASE` (default
`http://127.0.0.1:8787`), `CELL_TASKS` (default 60), `CELL_PACE_MS` (default
650). Chemistry knobs live in `wrangler.toml [vars]`.

## Files

| file | role |
|---|---|
| `src/index.js` | Worker entry (the ribosome host) + exports DO classes |
| `src/cell.js` | `Cell` DO — nucleus: genome, metabolism, alarm cycle, mitosis, apoptosis, receipt ledger |
| `src/tissue.js` | `Tissue` DO — founder niche, routing, lineage registry |
| `src/lib.js` | pure chemistry: canonical JSON/hash law, morphogen signals, translate, rubric, mutation |
| `scripts/simulate.mjs` | drives 60 tasks, asserts the verification bar, appends the tissue report |
| `receipts/W67-CELL-FLEET.md` | append-only run receipts (tissue reports + verification bar) |
| `wrangler.toml` | bindings: DO `CELL`/`TISSUE`, KV `CELL_MATRIX` (local placeholder id), `[vars]` chemistry |

## Honest receipts

- **deployed=NO**: no Cloudflare account/API token in this container (all
  credential material lost). `wrangler.toml` KV id is a local placeholder.
- **Queues not used**: signaling is DO-to-DO fetch + KV (receipted above).
- Local workerd state lives under `.wrangler/state` (gitignored); wiping it
  resets genesis. `wrangler dev --local` runs headless with `CI=true`.
- No keys anywhere: scripts read config from env only; nothing to leak.
