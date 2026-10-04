/**
 * cell-fleet — Cloudflare Worker entry: cellularizes BOTH function and learning
 *
 * Wave 67 (task 67-c1). Runs in LOCAL workerd only (`wrangler dev --local`):
 * no Cloudflare account, no API tokens exist in this container (receipted in
 * receipts/W67-CELL-FLEET.md). deployed=NO by honest constraint, and the
 * experiment is built so nothing in it needs the edge.
 *
 * THE CELL ↔ WORKER MAPPING (function cellularization | learning cellularization):
 *   Durable Object class "Cell"      nucleus: persistent genome + metabolism
 *   Durable Object class "Tissue"    coordinator/registry (lineage, routing)
 *   KV namespace CELL_MATRIX         membrane transport / extracellular matrix
 *   DO alarm (every TICK_MS)         cell cycle: metabolic tick → divide / die
 *   Worker isolate request           transient RIBOSOME: translates the genome
 *                                    into behavior (a decomposition answer)
 *                                    per request and stores nothing
 *   DO-to-DO fetch + KV              signaling substrate (synaptic/morphogen)
 *   delta rule in the nucleus        affinity maturation (learning)
 *   mitosis with gaussian mutation   clonal selection / variation (evolution)
 *
 * TASK FLOW (one POST /task):
 *   1. Tissue /route            → picks a live cell (least-recently-served)
 *   2. Cell  /transcribe        → genome out of the nucleus (mRNA)
 *   3. THIS ISOLATE translates  → ribosome: genome × morphogen signals →
 *                                 decomposition answer (parts, kept, dropped)
 *   4. THIS ISOLATE grades      → the environment's rubric (coverage /
 *                                 shrinkage / uniqueness) → reward 0..1
 *   5. Cell  /assimilate        → selection signal enters the nucleus:
 *                                 delta-rule genome update + ledger receipt
 *   The behavior lived in the isolate and died with it; the learning stays
 *   in the nucleus. Ribosome transient, genome persistent.
 *
 * TISSUE STATE (GET /tissue): assembled from the Tissue DO registry (lineage)
 * + the KV membrane (`cell:*` rows published each tick, `grave:*` apoptotic
 * bodies, `stat:*` counters) + per-cell ledger self-verification.
 *
 * Extends quilt-organ-workers (README backlog item 2, organ-boot-bridge DO
 * nesting): one coordinator DO → a population of heritable coordinator cells.
 */

import { Tissue } from "./tissue.js";
import { Cell } from "./cell.js";
import { translate, rubric, hex8 } from "./lib.js";

const CORS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), { status, headers: CORS });

async function tissueStub(env) {
  return env.TISSUE.get(env.TISSUE.idFromName("tissue"));
}

async function cellStub(env, cellId) {
  return env.CELL.get(env.CELL.idFromName(cellId));
}

/* ------------------------------------------------------------------ */

async function handleTask(env, body) {
  const concept = body?.concept;
  if (!concept || typeof concept.name !== "string" || !Array.isArray(concept.facets)) {
    return { status: 400, body: { error: "body.concept must be {name, facets[], layerHint?, gates?[]}" } };
  }
  const taskId = "t-" + hex8();

  // 1. route: which cell handles this task
  const tissue = await tissueStub(env);
  const routed = await (await tissue.fetch("https://tissue/route", { method: "POST" })).json();
  if (!routed.cellId) return { status: 503, body: { error: "no live cells", routed } };

  // 2. transcribe: genome out of the nucleus
  const cell = await cellStub(env, routed.cellId);
  const trRes = await cell.fetch("https://cell/transcribe");
  if (!trRes.ok) return { status: 502, body: { error: "cell transcribe failed", status: trRes.status } };
  const tr = await trRes.json();
  const genomeHashBefore = tr.genomeHash;

  // 3. RIBOSOME: translate genome → behavior (pure, transient, this isolate)
  const { answer, facetUpdates } = await translate({ w: tr.w, b: tr.b }, concept);

  // 4. the environment grades: rubric → selection signal (reward 0..1)
  const graded = rubric(answer, concept);

  // 5. assimilate: selection signal enters the nucleus (learning)
  const asRes = await cell.fetch("https://cell/assimilate", {
    method: "POST",
    body: JSON.stringify({
      taskName: concept.name,
      answer,
      reward: graded.reward,
      rubric: graded.detail,
      facetUpdates,
      global: { affinity: answer.affinity },
    }),
  });
  if (!asRes.ok) return { status: 502, body: { error: "cell assimilate failed", status: asRes.status } };
  const as = await asRes.json();

  return {
    status: 200,
    body: {
      taskId,
      cellId: routed.cellId,
      generation: tr.generation,
      answer,
      reward: graded.reward,
      rubric: graded.detail,
      genomeHashBefore,
      genomeHashAfter: as.genomeHash,
      learned: genomeHashBefore !== as.genomeHash,
      rewardEMA: as.rewardEMA,
      tasksHandled: as.tasksHandled,
    },
  };
}

/* ------------------------------------------------------------------ */

async function handleTissue(env) {
  const tissue = await tissueStub(env);
  const st = await (await tissue.fetch("https://tissue/state")).json();

  // membrane reads: live rows published each tick + apoptotic bodies + stats
  const liveRows = [];
  let done = false;
  let cursor;
  while (!done) {
    const page = await env.CELL_MATRIX.list({ prefix: "cell:", cursor });
    for (const k of page.keys) {
      const v = await env.CELL_MATRIX.get(k.name);
      if (v) liveRows.push(JSON.parse(v));
    }
    done = page.list_complete;
    cursor = page.cursor;
  }
  const graves = [];
  done = false;
  cursor = undefined;
  while (!done) {
    const page = await env.CELL_MATRIX.list({ prefix: "grave:", cursor });
    for (const k of page.keys) {
      const v = await env.CELL_MATRIX.get(k.name);
      if (v) {
        const g = JSON.parse(v);
        graves.push({
          id: g.id, cause: g.cause, generation: g.generation, parent: g.parent,
          tasks: g.tasks, rewardEMA: g.rewardEMA, mitosisCount: g.mitosisCount,
          children: g.children, bornAt: g.bornAt, diedAt: g.diedAt,
          ledgerCount: g.ledgerCount, ledgerTip: g.ledgerTip,
        });
      }
    }
    done = page.list_complete;
    cursor = page.cursor;
  }
  // NOTE on counts: mitosis/apoptosis are reported from AUTHORITATIVE stores
  // — the Tissue DO registry (transactional storage: lineage edges) and the
  // KV grave rows (unique keys, race-free). The KV `stat:*` counters were
  // removed: concurrent read-modify-write on one KV key loses updates
  // (no CAS in KV) — receipted as a platform finding.
  // (stateFull() exposes `lineage` as a child→{parent,at} map; edges are
  // derived here. Defensive defaults keep /tissue answerable during genesis.)
  const lineageEdges = Object.entries(st.lineage || {}).map(([child, l]) => ({
    child,
    parent: l.parent,
    at: l.at,
  }));
  const statMitosis = lineageEdges.length;
  const statApoptosis = graves.length;

  // per-cell ledger self-verification (receipt-chain law, re-derived here)
  const ledgers = {};
  for (const row of liveRows) {
    try {
      const c = await cellStub(env, row.id);
      ledgers[row.id] = await (await c.fetch("https://cell/ledger-summary")).json();
    } catch (e) {
      ledgers[row.id] = { error: String(e) };
    }
  }

  const cells = liveRows
    .map((r) => ({
      id: r.id,
      generation: r.generation,
      parent: r.parent,
      genomeHash: r.genomeHash,
      rewardEMA: r.rewardEMA,
      rewardN: r.rewardN,
      tasks: r.tasks,
      mitosisCount: r.mitosisCount,
      tick: r.tick,
      at: r.at,
      ledger: ledgers[r.id] || null,
    }))
    .sort((a, b) => (a.generation - b.generation) || a.id.localeCompare(b.id));

  const emas = cells.filter((c) => typeof c.rewardEMA === "number").map((c) => c.rewardEMA);
  const meanAffinity = emas.length ? Number((emas.reduce((a, b) => a + b, 0) / emas.length).toFixed(4)) : null;
  const maxGeneration = Math.max(0, ...cells.map((c) => c.generation), ...graves.map((g) => g.generation));

  // receipts never die: live ledgers + apoptotic bodies
  const receiptsLive = cells.reduce((a, c) => a + (c.ledger?.count || 0), 0);
  const receiptsBuried = graves.reduce((a, g) => a + (g.ledgerCount || 0), 0);

  return {
    runtime: "workerd-local",
    deployed: false,
    population: cells.length,
    maxGeneration,
    meanAffinity,
    mitosis: statMitosis,
    apoptosis: statApoptosis,
    graves: graves.length,
    receipts: { live: receiptsLive, buried: receiptsBuried, total: receiptsLive + receiptsBuried },
    lineage: st.lineage || {},
    lineageEdges,
    events: st.events || [],
    cells,
    gravesDetail: graves.sort((a, b) => String(a.diedAt).localeCompare(String(b.diedAt))),
    generatedAt: new Date().toISOString(),
  };
}

async function handleCell(env, id) {
  const cell = await cellStub(env, id);
  const trRes = await cell.fetch("https://cell/transcribe");
  if (!trRes.ok) return { status: 404, body: { error: "no such cell", id } };
  const tr = await trRes.json();
  const tail = await (await cell.fetch("https://cell/ledger-tail")).json();
  return { status: 200, body: { ...tr, ledger: tail } };
}

/* ------------------------------------------------------------------ */

export { Tissue, Cell };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      if (url.pathname === "/" && request.method === "GET") {
        return json({
          service: "cell-fleet",
          dialect: "cell-fleet/v1",
          wave: "67 (task 67-c1)",
          runtime: "workerd-local (wrangler dev --local); deployed=NO — no Cloudflare credentials exist in this container (receipted)",
          extends: "quilt-organ-workers README backlog item 2: organ-boot-bridge DO nesting → a population of heritable cells",
          mapping: {
            "Durable Object Cell": "cell nucleus (persistent genome + metabolism + receipt ledger)",
            "Durable Object Tissue": "tissue coordinator (routing + lineage registry)",
            "KV CELL_MATRIX": "membrane transport / extracellular matrix (state exocytosed each tick; apoptotic bodies)",
            "DO alarm": "cell cycle (metabolic tick: consolidate, divide, die)",
            "Worker isolate request": "transient ribosome (genome → behavior per request)",
            "DO-to-DO fetch + KV": "signaling substrate (NOT queues — receipted)",
          },
          endpoints: {
            "GET /": "this index",
            "GET /health": "liveness",
            "POST /task": "{concept:{name, facets[], layerHint?, gates?[]}} → cell handles a decomposition request; answer graded by rubric; genome learns",
            "GET /tissue": "population, lineage tree, affinity, mitosis/apoptosis counters, ledger self-verification",
            "GET /cell/{id}": "one cell: genome hash, EMA, ledger tail",
          },
        });
      }

      if (url.pathname === "/health" && request.method === "GET") {
        return json({ ok: true, runtime: "workerd-local", time: new Date().toISOString() });
      }

      if (url.pathname === "/task" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        const r = await handleTask(env, body);
        return json(r.body, r.status);
      }

      if (url.pathname === "/tissue" && request.method === "GET") {
        return json(await handleTissue(env));
      }

      if (url.pathname.startsWith("/cell/") && request.method === "GET") {
        const id = url.pathname.slice("/cell/".length);
        const r = await handleCell(env, id);
        return json(r.body, r.status);
      }

      return json({ error: "not found", path: url.pathname }, 404);
    } catch (e) {
      return json({ error: String(e), stack: e?.stack }, 500);
    }
  },
};
