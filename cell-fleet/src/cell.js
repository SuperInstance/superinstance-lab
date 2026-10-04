/**
 * cell-fleet — Cell Durable Object: the cell NUCLEUS
 *
 * One DO instance per cell. Holds the persistent genome (weight vector over
 * the 8 morphogen channels + bias), the metabolic state (reward EMA, task
 * counts, idle ticks) and an append-only hash-chained receipt ledger that
 * follows the fleet's organ-dialect law:
 *   receipts[i].hash == sha256hex(canonicalJSON({seq, op, prev}))
 *   receipts[0].prev == "GENESIS", receipts[i].prev == receipts[i-1].hash
 *
 * The CELL CYCLE runs on a DO alarm (env.TICK_MS, ~3 s in the experiment):
 * every metabolic tick the cell
 *   1. exocytoses its state to the KV membrane (namespace CELL_MATRIX,
 *      key `cell:{id}`) — genome hash + reward average become extracellular,
 *   2. decides:
 *        APOPTOSIS  — reward EMA below APOPTOSIS_BELOW after MIN_TASKS tasks
 *                     (affinity failure), or STARVE_TICKS consecutive
 *                     taskless ticks (nutrient starvation);
 *        MITOSIS    — reward EMA >= MITOSIS_ABOVE and MITOSIS_LOAD tasks
 *                     handled since the last division and population under
 *                     the tissue carrying capacity CAP: seeds a new cell
 *                     whose genome is a MUTATED copy (gaussian noise, clonal
 *                     selection / affinity maturation made literal);
 *   3. re-arms the alarm.
 *
 * Apoptosis deletes the nucleus state (storage.deleteAll) — but ONLY after
 * the full receipt ledger is exocytosed into the KV membrane as an apoptotic
 * body (`grave:{id}`). Fleet norm "never delete receipts" holds: the ledger
 * survives in the membrane after the nucleus is gone.
 *
 * Signaling substrate: DO-to-DO fetch (Tissue ↔ Cell) + KV. NOT Workers
 * Queues — receipted in receipts/W67-CELL-FLEET.md (no Cloudflare account or
 * credentials exist in this container, and synchronous signaling fits
 * selection dynamics: a selection signal must not be silently dropped).
 *
 * Learning: /assimilate applies the perceptron-like delta rule
 *   w += ETA * (target - a) * s    per facet receptor
 *   b += ETA * (reward - A)        global bias toward observed reward
 * with targets set by the environment (facet covered = 1, duplicate
 * occurrence = 0). The update happens HERE in the nucleus (heritable), while
 * the behavior that earned the reward was produced by the transient ribosome
 * (the Worker isolate) — function cellularized in the isolate, learning
 * cellularized in the nucleus.
 */

import { canonicalJSON, sha256hex, genomeHash, mutateGenome, hex16 } from "./lib.js";

const num = (env, key, dflt) => {
  const v = env[key];
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : dflt;
};

export class Cell {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  /* ---------------- config ---------------- */

  cfg() {
    return {
      TICK_MS: num(this.env, "TICK_MS", 3000),
      ETA: num(this.env, "ETA", 0.15),
      EMA_ALPHA: num(this.env, "EMA_ALPHA", 0.35),
      APOPTOSIS_BELOW: num(this.env, "APOPTOSIS_BELOW", 0.72),
      MITOSIS_ABOVE: num(this.env, "MITOSIS_ABOVE", 0.85),
      MIN_TASKS: num(this.env, "MIN_TASKS", 4),
      MITOSIS_LOAD: num(this.env, "MITOSIS_LOAD", 4),
      STARVE_TICKS: num(this.env, "STARVE_TICKS", 5),
      CAP: num(this.env, "CAP", 10),
      MUT_SIGMA: num(this.env, "MUT_SIGMA", 0.08),
      HEARTBEAT_EVERY: num(this.env, "HEARTBEAT_EVERY", 5),
    };
  }

  async tissueStub() {
    return this.env.TISSUE.get(this.env.TISSUE.idFromName("tissue"));
  }

  /* ---------------- genesis ---------------- */

  async init(payload) {
    const c = this.cfg();
    const existing = await this.state.storage.get("genome");
    if (existing) {
      const meta = await this.state.storage.get("meta");
      return { ok: true, id: meta.id, alreadyBorn: true, genomeHash: existing.genomeHash };
    }
    const id = payload.id || "c-" + hex16();
    const genome = {
      w: payload.genome.w,
      b: payload.genome.b,
      genomeHash: await genomeHash(payload.genome),
      generation: payload.generation ?? 0,
      parent: payload.parent ?? null,
      bornAt: new Date().toISOString(),
    };
    const meta = {
      id,
      alive: true,
      tasksHandled: 0,
      tasksSinceDivision: 0,
      rewardEMA: null,
      rewardN: 0,
      servedSinceTick: false,
      idleTicks: 0,
      tickCount: 0,
      mitosisCount: 0,
      children: [],
    };
    await this.state.storage.put("genome", genome);
    await this.state.storage.put("meta", meta);
    await this.state.storage.put("seq", 0); // next receipt seq; receipts[0].prev = "GENESIS"
    await this.state.storage.setAlarm(Date.now() + c.TICK_MS);
    return { ok: true, id, genomeHash: genome.genomeHash, generation: genome.generation };
  }

  async requireSelf() {
    const genome = await this.state.storage.get("genome");
    const meta = await this.state.storage.get("meta");
    if (!genome || !meta) throw new Error("cell not initialized (no nucleus)");
    return { genome, meta };
  }

  /* ---------------- receipts (organ-dialect chain law) ---------------- */

  async appendReceipt(op) {
    const seq = (await this.state.storage.get("seq")) ?? 0;
    const prev = seq === 0 ? "GENESIS" : (await this.state.storage.get("tip")) || "GENESIS";
    const receipt = { seq, op, prev, hash: null };
    receipt.hash = (await sha256hex(canonicalJSON({ seq, op, prev }))).slice(0, 64);
    await this.state.storage.put(`r:${seq}`, receipt);
    await this.state.storage.put("seq", seq + 1);
    await this.state.storage.put("tip", receipt.hash);
    return receipt;
  }

  async ledgerSummary() {
    const seq = (await this.state.storage.get("seq")) ?? 0;
    const rows = await this.state.storage.list({ prefix: "r:" });
    let prev = "GENESIS";
    let ok = true;
    for (let i = 0; i < seq; i++) {
      const r = rows.get(`r:${i}`);
      if (!r) {
        ok = false;
        break;
      }
      const expect = (await sha256hex(canonicalJSON({ seq: r.seq, op: r.op, prev: r.prev }))).slice(0, 64);
      if (r.prev !== prev || r.seq !== i || r.hash !== expect) {
        ok = false;
        break;
      }
      prev = r.hash;
    }
    return { count: seq, tip: seq === 0 ? "GENESIS" : (await this.state.storage.get("tip")), ok };
  }

  /* ---------------- ribosome interface ---------------- */

  // transcribe: the isolate's ribosome reads the genome (mRNA out). No state
  // is written here — transcription is read-only heredity.
  async transcribe() {
    const { genome, meta } = await this.requireSelf();
    return {
      cellId: meta.id,
      alive: meta.alive,
      generation: genome.generation,
      parent: genome.parent,
      w: genome.w,
      b: genome.b,
      genomeHash: genome.genomeHash,
      tasksHandled: meta.tasksHandled,
      rewardEMA: meta.rewardEMA,
      rewardN: meta.rewardN,
      tickCount: meta.tickCount,
    };
  }

  // assimilate: selection signal (reward + per-facet targets) updates the
  // genome by the delta rule; a TASK receipt is appended to the ledger.
  async assimilate(payload) {
    const c = this.cfg();
    const { genome, meta } = await this.requireSelf();
    const before = genome.genomeHash;

    for (const u of payload.facetUpdates || []) {
      for (let i = 0; i < genome.w.length; i++) {
        genome.w[i] += c.ETA * (u.target - u.a) * u.s[i];
        genome.w[i] = Math.max(-2, Math.min(2, genome.w[i]));
      }
    }
    if (payload.global && Number.isFinite(payload.global.affinity)) {
      genome.b += c.ETA * (payload.reward - payload.global.affinity);
      genome.b = Math.max(-2, Math.min(2, genome.b));
    }
    genome.genomeHash = await genomeHash(genome);
    await this.state.storage.put("genome", genome);

    meta.tasksHandled++;
    meta.tasksSinceDivision++;
    meta.rewardN++;
    meta.rewardEMA =
      meta.rewardEMA === null ? payload.reward : c.EMA_ALPHA * payload.reward + (1 - c.EMA_ALPHA) * meta.rewardEMA;
    meta.servedSinceTick = true;
    meta.lastReward = payload.reward;
    await this.state.storage.put("meta", meta);

    await this.appendReceipt({
      type: "TASK",
      cell: meta.id,
      task: payload.taskName,
      affinity: payload.answer?.affinity,
      nParts: payload.answer?.parts?.length,
      kept: payload.answer?.keptCount,
      dropped: payload.answer?.dropped?.length,
      reward: payload.reward,
      rubric: payload.rubric,
      genomeHashBefore: before,
      genomeHashAfter: genome.genomeHash,
      at: new Date().toISOString(),
    });

    return {
      ok: true,
      cellId: meta.id,
      genomeHash: genome.genomeHash,
      genomeHashBefore: before,
      rewardEMA: Number(meta.rewardEMA.toFixed(4)),
      tasksHandled: meta.tasksHandled,
    };
  }

  /* ---------------- the cell cycle (DO alarm = metabolic tick) ---------------- */

  async alarm() {
    const c = this.cfg();
    const meta = await this.state.storage.get("meta");
    if (!meta || !meta.alive) return; // dead cells have no metabolism
    const genome = await this.state.storage.get("genome");
    let tickCount = meta.tickCount + 1;

    // 1. membrane exocytosis: publish state to the KV extracellular matrix
    const rewardEMA = meta.rewardEMA === null ? null : Number(meta.rewardEMA.toFixed(4));
    await this.env.CELL_MATRIX.put(
      `cell:${meta.id}`,
      canonicalJSON({
        id: meta.id,
        status: "live",
        genomeHash: genome.genomeHash,
        generation: genome.generation,
        parent: genome.parent,
        rewardEMA,
        rewardN: meta.rewardN,
        tasks: meta.tasksHandled,
        mitosisCount: meta.mitosisCount,
        tick: tickCount,
        at: new Date().toISOString(),
      })
    );

    // idle accounting (starvation)
    if (meta.servedSinceTick) {
      meta.idleTicks = 0;
      meta.servedSinceTick = false;
    } else {
      meta.idleTicks = (meta.idleTicks || 0) + 1;
    }
    meta.tickCount = tickCount;

    // 2. decisions
    let cause = null;
    if (meta.rewardN >= c.MIN_TASKS && meta.rewardEMA !== null && meta.rewardEMA < c.APOPTOSIS_BELOW) {
      cause = "low-affinity";
    } else if (meta.idleTicks >= c.STARVE_TICKS) {
      cause = "starvation";
    }

    if (cause) {
      await this.apoptose(cause);
      return; // no re-arm: a dead cell has no next tick
    }

    // mitosis
    let divided = null;
    if (
      meta.rewardN >= c.MIN_TASKS &&
      meta.rewardEMA !== null &&
      meta.rewardEMA >= c.MITOSIS_ABOVE &&
      meta.tasksSinceDivision >= c.MITOSIS_LOAD
    ) {
      try {
        const tissue = await this.tissueStub();
        const headcount = await tissue.fetch("https://tissue/headcount");
        const { count } = await headcount.json();
        if (count < c.CAP) {
          divided = await this.mitose(tissue);
        } else {
          await this.appendReceipt({
            type: "QUORUM_BLOCK",
            cell: meta.id,
            population: count,
            cap: c.CAP,
            at: new Date().toISOString(),
          });
        }
      } catch (e) {
        await this.appendReceipt({ type: "MITOSIS_ERROR", cell: meta.id, error: String(e), at: new Date().toISOString() });
      }
    }

    // heartbeat receipt every N ticks keeps the ledger alive without flooding
    if (tickCount % c.HEARTBEAT_EVERY === 0 && !divided) {
      await this.appendReceipt({
        type: "HEARTBEAT",
        cell: meta.id,
        tick: tickCount,
        rewardEMA,
        idleTicks: meta.idleTicks,
        tasks: meta.tasksHandled,
        at: new Date().toISOString(),
      });
    }

    await this.state.storage.put("meta", meta);
    // 3. re-arm the cycle
    await this.state.storage.setAlarm(Date.now() + c.TICK_MS);
  }

  async mitose(tissue) {
    const c = this.cfg();
    const { genome, meta } = await this.requireSelf();
    const childId = "c-" + hex16();
    const childGenome = mutateGenome(genome, c.MUT_SIGMA);
    const childHash = await genomeHash(childGenome);

    const childIdObj = this.env.CELL.idFromName(childId);
    const child = this.env.CELL.get(childIdObj);
    const initRes = await child.fetch("https://cell/init", {
      method: "POST",
      body: JSON.stringify({ id: childId, genome: childGenome, generation: genome.generation + 1, parent: meta.id }),
    });
    if (!initRes.ok) throw new Error("child init failed: " + initRes.status);

    meta.mitosisCount++;
    meta.tasksSinceDivision = 0;
    meta.children.push(childId);
    await this.state.storage.put("meta", meta);

    await this.appendReceipt({
      type: "MITOSIS",
      cell: meta.id,
      child: childId,
      childGenomeHash: childHash,
      generation: genome.generation + 1,
      mutSigma: c.MUT_SIGMA,
      at: new Date().toISOString(),
    });

    await tissue.fetch("https://tissue/register", {
      method: "POST",
      body: JSON.stringify({ cellId: childId, parent: meta.id, generation: genome.generation + 1 }),
    });

    return { child: childId, childGenomeHash: childHash };
  }

  async apoptose(cause) {
    const { genome, meta } = await this.requireSelf();
    const summary = await this.ledgerSummary();

    // apoptotic body: the FULL receipt ledger is exocytosed to the membrane
    // before the nucleus is deleted — fleet norm "never delete receipts".
    const rows = await this.state.storage.list({ prefix: "r:" });
    const ledger = [...rows.values()];

    await this.appendReceipt({
      type: "APOPTOSY",
      cell: meta.id,
      cause,
      generation: genome.generation,
      tasks: meta.tasksHandled,
      rewardEMA: meta.rewardEMA,
      mitosisCount: meta.mitosisCount,
      children: meta.children,
      at: new Date().toISOString(),
    });
    const finalRows = await this.state.storage.list({ prefix: "r:" });
    const finalLedger = [...finalRows.values()];

    await this.env.CELL_MATRIX.put(
      `grave:${meta.id}`,
      canonicalJSON({
        id: meta.id,
        status: "dead",
        cause,
        generation: genome.generation,
        parent: genome.parent,
        children: meta.children,
        genomeHashFinal: genome.genomeHash,
        rewardEMA: meta.rewardEMA === null ? null : Number(meta.rewardEMA.toFixed(4)),
        tasks: meta.tasksHandled,
        mitosisCount: meta.mitosisCount,
        bornAt: genome.bornAt,
        diedAt: new Date().toISOString(),
        ledgerCount: finalLedger.length,
        ledgerTip: summary.ok ? finalLedger[finalLedger.length - 1]?.hash ?? "GENESIS" : "CHAIN_BROKEN",
        ledger: finalLedger,
      })
    );

    await this.env.CELL_MATRIX.delete(`cell:${meta.id}`);

    try {
      const tissue = await this.tissueStub();
      await tissue.fetch("https://tissue/deregister", {
        method: "POST",
        body: JSON.stringify({ cellId: meta.id, cause }),
      });
    } catch {
      /* tissue may be unreachable during teardown; the grave row is the record */
    }

    meta.alive = false;
    await this.state.storage.put("meta", meta);
    // delete nucleus state (the spec's "delete state + log receipt"): genome +
    // ledger leave the runtime; both were already mirrored to the grave row.
    await this.state.storage.deleteAll();
    await this.state.storage.put("meta", meta);
  }

  /* ---------------- introspection ---------------- */

  async ledgerTail() {
    const seq = (await this.state.storage.get("seq")) ?? 0;
    const rows = await this.state.storage.list({ prefix: "r:" });
    const all = [...rows.values()].sort((a, b) => a.seq - b.seq);
    return { count: seq, tail: all.slice(-5) };
  }

  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/init" && request.method === "POST") {
        return this.json(await this.init(await request.json()));
      }
      if (url.pathname === "/transcribe") {
        return this.json(await this.transcribe());
      }
      if (url.pathname === "/assimilate" && request.method === "POST") {
        return this.json(await this.assimilate(await request.json()));
      }
      if (url.pathname === "/ledger-summary") {
        return this.json(await this.ledgerSummary());
      }
      if (url.pathname === "/ledger-tail") {
        return this.json(await this.ledgerTail());
      }
      return this.json({ error: "unknown cell route", path: url.pathname }, 404);
    } catch (e) {
      return this.json({ error: String(e), path: url.pathname }, 500);
    }
  }

  json(obj, status = 200) {
    return new Response(JSON.stringify(obj, null, 2), {
      status,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  }
}
