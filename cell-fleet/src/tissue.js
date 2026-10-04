/**
 * cell-fleet — Tissue Durable Object: the coordinator / registry
 *
 * The quilt-organ-workers README backlog item 2 ("organ-boot-bridge — a
 * Durable Object that hands an incoming agent a boot ticket ... so two lanes
 * can nest around the SAME saved state without racing") generalized: the
 * Tissue DO is the tissue-level coordinator that
 *   - seeds the founder cells on first request (stem-cell niche),
 *   - routes each incoming decomposition task to a live cell
 *     (least-recently-served, random tiebreak — resource sharing),
 *   - keeps the lineage registry: every mitosis registers parent→child,
 *     every apoptosis deregisters (the genealogy of the tissue),
 *   - re-seeds a founder if the population ever hits zero (immigration),
 *     receipted as a RESEED event.
 *
 * It holds NO genomes — heredity lives in the Cell DOs (nuclei); the Tissue
 * only knows who is alive, who descended from whom, and who was served when.
 * This is the same division of authority as organ-boot-bridge: coordinator
 * state (tickets/registry) in the DO, payload state (organs/genomes) outside.
 *
 * Signaling substrate: DO-to-DO fetch (Worker→Tissue, Tissue→Cell,
 * Cell→Tissue) + KV CELL_MATRIX. NOT Workers Queues — receipted (no
 * credentials in this container; queues would add an async lossy hop to
 * selection signals, which must arrive to count).
 */

import { randomGenome, hex16 } from "./lib.js";

const num = (env, key, dflt) => {
  const v = env[key];
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : dflt;
};

export class Tissue {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async cfg() {
    return {
      FOUNDER_N: num(this.env, "FOUNDER_N", 3),
      FOUNDER_RADIUS: num(this.env, "FOUNDER_RADIUS", 0.55),
    };
  }

  async reg() {
    return (
      (await this.state.storage.get("reg")) || {
        foundersCreated: false,
        cells: {},      // id -> {joinedAt, generation, parent, lastServed, served}
        lineage: {},    // childId -> {parent, at}
        events: [],     // {at, type, cellId, note}
      }
    );
  }

  async saveReg(reg) {
    if (reg.events.length > 400) reg.events = reg.events.slice(-400);
    await this.state.storage.put("reg", reg);
  }

  async event(reg, type, cellId, note = null) {
    reg.events.push({ at: new Date().toISOString(), type, cellId, note });
  }

  async cellStub(cellId) {
    return this.env.CELL.get(this.env.CELL.idFromName(cellId));
  }

  async foundOne(reg, opts = {}) {
    const c = await this.cfg();
    const generation = opts.generation ?? 0;
    const parent = opts.parent ?? null;
    const cellId = "c-" + hex16();
    let genome = randomGenome(c.FOUNDER_RADIUS);
    // Population variance includes low-affinity clones: when enabled, the
    // FIRST founder is seeded inverted (a "senescent genotype"). Learning
    // cannot rescue it within MIN_TASKS, so the affinity-failure apoptosis
    // route is exercised every run, not just the starvation route.
    if (opts.senescent) {
      genome = { w: genome.w.map((x) => -1.2 * Math.abs(x) - 0.1), b: -0.8 };
    }
    const stub = await this.cellStub(cellId);
    const res = await stub.fetch("https://cell/init", {
      method: "POST",
      body: JSON.stringify({ id: cellId, genome, generation, parent }),
    });
    if (!res.ok) throw new Error("founder init failed: " + res.status);
    reg.cells[cellId] = { joinedAt: new Date().toISOString(), generation, parent, lastServed: 0, served: 0 };
    if (parent) reg.lineage[cellId] = { parent, at: new Date().toISOString() };
    await this.event(
      reg,
      parent === null ? "FOUNDER" : "MITOSIS",
      cellId,
      parent ? `parent=${parent}` : opts.senescent ? "stem-cell niche (senescent genotype)" : "stem-cell niche"
    );
    return cellId;
  }

  async ensureFounders(reg) {
    if (reg.foundersCreated) return;
    const c = await this.cfg();
    for (let i = 0; i < c.FOUNDER_N; i++) {
      await this.foundOne(reg, { senescent: i === 0 && num(this.env, "SENESCENT_FOUNDER", 1) === 1 });
    }
    reg.foundersCreated = true;
    await this.saveReg(reg);
  }

  async route() {
    const reg = await this.reg();
    await this.ensureFounders(reg);
    let live = Object.keys(reg.cells);
    if (live.length === 0) {
      // total extinction → immigration from the stem-cell niche (receipted)
      await this.foundOne(reg);
      await this.event(reg, "RESEED", null, "population hit zero; founder re-seeded");
      live = Object.keys(reg.cells);
      await this.saveReg(reg);
    }
    // least-recently-served with random tiebreak (resource sharing)
    let best = null;
    let bestKey = Infinity;
    const ties = [];
    for (const id of live) {
      const k = reg.cells[id].lastServed || 0;
      if (k < bestKey) {
        bestKey = k;
        ties.length = 0;
        ties.push(id);
      } else if (k === bestKey) {
        ties.push(id);
      }
    }
    best = ties[Math.floor(Math.random() * ties.length)];
    reg.cells[best].lastServed = Date.now();
    reg.cells[best].served = (reg.cells[best].served || 0) + 1;
    await this.saveReg(reg);
    return { cellId: best, generation: reg.cells[best].generation, population: live.length };
  }

  async register(payload) {
    const reg = await this.reg();
    if (!reg.cells[payload.cellId]) {
      reg.cells[payload.cellId] = {
        joinedAt: new Date().toISOString(),
        generation: payload.generation ?? 1,
        parent: payload.parent ?? null,
        lastServed: 0,
        served: 0,
      };
      reg.lineage[payload.cellId] = { parent: payload.parent ?? null, at: new Date().toISOString() };
      await this.event(reg, "MITOSIS", payload.cellId, `parent=${payload.parent}`);
      await this.saveReg(reg);
    }
    return { ok: true };
  }

  async deregister(payload) {
    const reg = await this.reg();
    if (reg.cells[payload.cellId]) {
      delete reg.cells[payload.cellId];
      await this.event(reg, "APOPTOSY", payload.cellId, `cause=${payload.cause}`);
      await this.saveReg(reg);
    }
    return { ok: true };
  }

  async headcount() {
    const reg = await this.reg();
    return { count: Object.keys(reg.cells).length };
  }

  async stateFull() {
    const reg = await this.reg();
    return {
      foundersCreated: reg.foundersCreated,
      cells: reg.cells,
      lineage: reg.lineage,
      events: reg.events.slice(-60),
      population: Object.keys(reg.cells).length,
    };
  }

  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/route" && request.method === "POST") return this.json(await this.route());
      if (url.pathname === "/register" && request.method === "POST") return this.json(await this.register(await request.json()));
      if (url.pathname === "/deregister" && request.method === "POST") return this.json(await this.deregister(await request.json()));
      if (url.pathname === "/headcount") return this.json(await this.headcount());
      if (url.pathname === "/state") return this.json(await this.stateFull());
      return this.json({ error: "unknown tissue route", path: url.pathname }, 404);
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
