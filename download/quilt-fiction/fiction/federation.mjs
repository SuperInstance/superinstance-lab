// quilt-fiction/fiction/federation.mjs — genesis, the wall clock, metrics.
// =============================================================================
// BOOTSTRAP HOLE-FILL (the seed's biggest gap): genesis roster — all N
// instances are created knowing the full peer list ('roster:genesis', the
// minimal non-guess) plus the conservation budget and the reputation priors.
// The seed fixes no liveness mechanism for SILENT peers; receipted here:
// receivers AGE OUT peers silent for K=20 receiver-ticks (a stalled instance
// cannot broadcast — that is the bite — so the QUILT forgets it, not the
// other way around; no heartbeat violates the no-ack fire-and-forget law).
//
// GENESIS PHYSICS (receipted): each instance gets one out-lane and one in-lane
// (ring permutation). The seed's double-entry law "the two sides balance" is
// literal: eta_j(t) = gamma_feeder(t-1). The lanes are NOT broadcast — the
// wire reveals them only through the gamma→eta flow correlation, which the
// JEPA learns, the believed edges encode, and the renderer re-infers. That
// common visible structure is what makes EPISTEMIC ERROR (believed-union vs
// renderer-inferred edges) a meaningful, declinable metric.
//
// DETERMINISM: ids sorted everywhere, drains frozen at wall-tick boundaries,
// all state in cells (checkpoint = cell dump + bus log + book => byte-identical
// replay). No wall-clock values enter any state or receipt row.

import { FederationBus } from './bus.mjs';
import { Instance } from './instance.mjs';
import { renderQuilt } from './renderer.mjs';
import { hashSeed } from './delta.mjs';

export const ids = (n) => Array.from({ length: n }, (_, i) => `i${String(i).padStart(2, '0')}`);
const pairKey = (a, b) => `${a}|${b}`;

export function genesis({ seed = 0, n = 10, violator = null, scope = null, rendererWindow = 40 }) {
  const roster = ids(n);
  const bus = new FederationBus();
  const instances = roster.map((id, i) => new Instance({
    id,
    index: i,
    seed: hashSeed(seed, 'quilt-fiction', 'instance', id),
    bus,
    peers: roster,
    outLane: roster[(i + 1) % n],           // my contribution flows here (ring)
    inLane: roster[(i - 1 + n) % n],        // my draw arrives from here (ring)
    options: {
      violator: violator && violator.id === id
        ? { startTick: violator.startTick, hidden: violator.hidden, breakGate: true }
        : null,
    },
  }));
  const byId = new Map(instances.map((x) => [x.id, x]));
  const book = {
    wall_ticks: 0, broadcasts: 0, refused_ticks: 0,
    exclusions: [], detected_violations: 0, aging_events: 0, aging_events_by: {},
    per: Object.fromEntries(roster.map((id) => [id, { ticks: 0, broadcasts: 0, refused: 0 }])),
    checkpoints: [],
  };
  return {
    roster, bus, instances, byId, book,
    config: { seed, n, violator, scope: scope ?? roster, rendererWindow },
  };
}

// One wall tick: freeze drains, tick every instance in id order.
async function wallTick(fed) {
  const inboxes = fed.bus.drainAll();
  for (const inst of fed.instances) {
    const res = await inst.tick(inboxes[inst.id] ?? [], fed.book.wall_ticks);
    const p = fed.book.per[inst.id];
    p.ticks++;
    if (res.refused) { fed.book.refused_ticks++; p.refused++; }
    else if (res.delta) { fed.book.broadcasts++; p.broadcasts++; }
  }
  fed.book.wall_ticks++;
}

// Checkpoint: agreement over the scope, epistemic error vs the renderer.
// The renderer sees the PUBLIC log only (no addressing — §5.1).
async function measure(fed, scope) {
  const t = fed.book.wall_ticks;
  const w = fed.config.rendererWindow;
  const lo = Math.max(0, t - w), hi = Math.max(-1, t - 1);
  const envelopes = fed.bus.publicWindow(lo, hi);
  const doc = renderQuilt({ roster: fed.roster, envelopes, fromTick: lo, toTick: hi, scope });
  const inferred = new Set(doc.edges.map((e) => `${e.from}>${e.to}`));

  const scopeSet = new Set(scope);
  const beliefs = new Map(); // instId -> edges map (live cell reads)
  for (const inst of fed.instances) {
    if (scopeSet.has(inst.id)) beliefs.set(inst.id, await inst.data('graph').then((g) => g.edges));
  }
  const B = new Set();
  let totalPairs = 0, matching = 0;
  for (const a of scope) {
    for (const b of scope) {
      if (a === b) continue;
      totalPairs++;
      const flags = [...beliefs.keys()].map((id) => {
        const e = beliefs.get(id)[pairKey(a, b)];
        return e ? e.belief >= 5000 : false;
      });
      if (flags.every((f) => f === flags[0])) matching++;
      if (flags.some((f) => f)) B.add(`${a}>${b}`);
    }
  }
  let inter = 0;
  for (const k of B) if (inferred.has(k)) inter++;
  const union = new Set([...B, ...inferred]).size;
  const cp = {
    tick: t,
    scope: [...scope],
    agreement: totalPairs ? matching / totalPairs : 1,
    epistemic_error: union ? (union - inter) / union : 0,
    believed_union: B.size,
    inferred_edges: inferred.size,
    renderer_clusters: doc.clusters.length,
    exclusions: fed.book.exclusions.length,
  };
  fed.book.checkpoints.push(cp);
  return cp;
}

// Serialize the whole federation (cells + bus + book) — the replay checkpoint.
async function snapshot(fed, config) {
  return {
    v: 1,
    config,
    tick: fed.book.wall_ticks,
    instances: await Promise.all(fed.instances.map(async (x) => ({
      id: x.id, options: JSON.parse(JSON.stringify(x.options)), outLane: x.outLane, inLane: x.inLane,
      cells: await x.dump(),
    }))),
    bus: { log: JSON.parse(JSON.stringify(fed.bus.log)), publications: fed.bus.publications, deliveries: fed.bus.deliveries },
    book: JSON.parse(JSON.stringify(fed.book)),
  };
}

export async function restore(snap) {
  const fed = genesis({
    seed: snap.config.seed, n: snap.config.n, violator: snap.config.violator,
    scope: snap.config.scope, rendererWindow: snap.config.rendererWindow,
  });
  for (const s of snap.instances) {
    const inst = fed.byId.get(s.id);
    inst.outLane = s.outLane; inst.inLane = s.inLane; inst.options = s.options;
    for (const [cell, value] of Object.entries(s.cells)) await inst.engine.set(cell, value);
  }
  fed.bus.log = snap.bus.log.map((x) => ({ ...x }));
  fed.bus.publications = snap.bus.publications;
  fed.bus.deliveries = snap.bus.deliveries;
  fed.book = JSON.parse(JSON.stringify(snap.book));
  return fed;
}

// ===========================================================================
// runFederation — the whole arc. Deterministic given (seed, config).
// ===========================================================================
export async function runFederation(cfg = {}) {
  const {
    seed = 0, n = 10, ticks = 240, checkpointEvery = 20, checkpointAt = null,
    violator = null, withdraw = null, scope = null, rendererWindow = 40,
    snap = null,
  } = cfg;
  const config = { seed, n, ticks, checkpointEvery, violator, withdraw, scope: scope ?? ids(n), rendererWindow };
  let fed;
  let startTick = 0;
  if (snap) {
    fed = await restore(snap);
    startTick = fed.book.wall_ticks;
  } else {
    fed = genesis({ seed, n, violator, scope: config.scope, rendererWindow });
  }
  const mutedAt = withdraw ? withdraw.atTick : Infinity;
  const mutedIds = new Set(withdraw ? withdraw.ids : []);

  for (let t = startTick; t < ticks; t++) {
    if (t === mutedAt) {
      for (const id of mutedIds) if (fed.byId.has(id)) fed.byId.get(id).options.muted = true;
    }
    await wallTick(fed);
    if ((t + 1) % checkpointEvery === 0 || t === ticks - 1) {
      // exact-tick event capture from the instances' own gc event logs
      const seen = fed.book._seen_events ?? (fed.book._seen_events = {});
      for (const inst of fed.instances) {
        const gc = await inst.data('gc');
        for (const ev of gc.events ?? []) {
          const k = `${ev.type}:${inst.id}:${ev.peer}:${ev.tick}`;
          if (seen[k]) continue;
          seen[k] = 1;
          if (ev.type === 'exclusion') fed.book.exclusions.push({ by: inst.id, peer: ev.peer, tick: ev.tick });
          if (ev.type === 'aging') { fed.book.aging_events++; fed.book.aging_events_by[inst.id] = (fed.book.aging_events_by[inst.id] ?? 0) + 1; }
        }
      }
      // cumulative violation verdicts: sum the instances' own counters
      let viol = 0;
      for (const inst of fed.instances) viol += (await inst.data('zin')).stats.violation_verdicts ?? 0;
      fed.book.detected_violations = viol;
      await measure(fed, config.scope);
    }
    if (checkpointAt !== null && t + 1 === checkpointAt) {
      return { fed, snapshotState: await snapshot(fed, config), done: false };
    }
  }
  return { fed, snapshotState: null, done: true };
}

// Consensus verdict (seed4 §7.2) over a scope: Agreement (pairwise belief
// consistency >= 0.8), Conservation (zero unrefused violations AND zero
// detected conservation violations), Completeness (no scope member aged out
// of a scope member's view), Liveness (every scope member ticks >= 1 per 10
// wall ticks).
export function consensusVerdict(fed, scope, { requireAgreement = 0.8 } = {}) {
  const cp = fed.book.checkpoints[fed.book.checkpoints.length - 1];
  const minRatio = Math.min(...scope.map((id) => (fed.book.wall_ticks ? fed.book.per[id].ticks / fed.book.wall_ticks : 0)));
  const scopeSet = new Set(scope);
  const agingInScope = (fed.book.aging_events_by ?? {});
  let agingTotal = 0;
  for (const [by, count] of Object.entries(agingInScope)) if (scopeSet.has(by)) agingTotal += count;
  return {
    agreement: cp.agreement,
    agreement_ok: cp.agreement >= requireAgreement,
    refused_ticks: fed.book.refused_ticks,
    detected_violations: fed.book.detected_violations,
    conservation_ok: fed.book.refused_ticks === 0 && fed.book.detected_violations === 0,
    liveness_min_ratio: minRatio,
    liveness_ok: minRatio >= 0.1,
    aging_events_in_scope: agingTotal,
    completeness_ok: agingTotal === 0,
    epistemic_error_final: cp.epistemic_error,
    checkpoints: fed.book.checkpoints,
    exclusions: fed.book.exclusions,
    exists: cp.agreement >= requireAgreement
      && fed.book.refused_ticks === 0 && fed.book.detected_violations === 0
      && agingTotal === 0 && minRatio >= 0.1,
  };
}
