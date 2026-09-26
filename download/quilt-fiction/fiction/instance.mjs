// quilt-fiction/fiction/instance.mjs — THE INSTANCE (seed4 §2, §3.1).
// =============================================================================
// ARCHITECTURE (receipted choice): instances ARE SHEETS. Each instance is one
// vendored @quilt/core QuiltEngine (copied verbatim from quilt-quant/engine/,
// see engine/PROVENANCE.md) holding the 8 primitive cells + local state cells
// + reactive formula cells. The tick (§3.1) is a 10-step procedure that reads
// and writes the sheet THROUGH the engine — no state lives outside cells, so
// a checkpoint is a cell dump and a replay is byte-identical by construction.
//
//   8 primitives : zin (delta inbox)     zout (delta outbox)
//                  jepa (peer prediction) doubleentry (ledger γ/η)
//                  vibe (position/velocity) gc (memory consolidation)
//                  murmur (broadcast listener) graph (believed topology, β₁)
//   local state  : clock, rng, reputation, believed_peers, budget (C = 1.585)
//   formulas     : conservation_ok, headroom, beta1  (the SHEET refuses —
//                  conservation is a cell property, not a harness if-statement)
//
// THE TICK — seed4 §3.1 implemented EXACTLY (10 steps; the seed lists 9 and
// the 10th is GC, the memory-consolidation primitive; receipted order below):
//   1. read Z_in deltas        6. Murmur broadcast (one Delta, all believed peers)
//   2. JEPA predict peers      7. Graph adjust (beliefs += lr*(confirm - belief))
//   3. DoubleEntry record      8. Reputation update (hold α=0.05 / violate β=0.5)
//   4. conservation check      9. GC consolidate (trim histories)
//   5. Vibe update            10. clock++
//   VIOLATION at 4 => refuse the tick: STALL — no broadcast, clock frozen
//   (receipted: the refused tick processes nothing — fire-and-forget transport
//   has no redelivery, so a stall drops that tick's inbox; that is the bite).
//
// PHYSICS (receipted hole-fill — the seed's §2.3 double-entry law "every
// transaction has two sides, and the two sides balance" is made literal):
// genesis assigns each instance ONE out-lane (its contribution flows to a
// fixed peer) and ONE in-lane. eta_j(t) = the gamma it received from its
// in-lane feeder — the two ledger sides are the SAME integer. The lanes are
// genesis physics, not broadcast: the wire reveals them only through the
// gamma→eta flow correlation, which is exactly what the JEPA learns, what the
// believed edges encode, and what the renderer infers. The ring IS the quilt.

import { QuiltEngine } from '../engine/index.js';
import {
  BUDGET, SCALE, REP_SCALE, GAMMA_MIN, GAMMA_SPAN, JITTER, XCHECK_TOL,
  makeDelta, verifyDelta, rngStep, hashSeed, pearson,
} from './delta.mjs';
import { applyReputation, REP_INIT } from './reputation.mjs';

export const K_AGING = 20;        // silent ticks before a peer is aged out (receipted)
export const LR_EDGE = 0.1;       // believed_edges learning rate (seed4 §3.6)
export const CONFIRM_R = 0.6;     // JEPA flow-model confirmation bar (r, one-sided)
export const CONFIRM_WINDOW = 12; // trailing observations per pair statistic
export const PRIOR_BELIEF = 2500; // 0.25 — edges ABSENT until confirmed (roster gives names, not structure)
export const PRESENT_AT = 5000;   // belief >= 0.5 => edge present in the believed topology
export const OBS_KEEP = 24;       // GC: per-peer observation window
export const LEDGER_KEEP = 50;    // GC: ledger history window

const pairKey = (a, b) => `${a}|${b}`;

export class Instance {
  constructor({ id, index, seed, bus, peers, outLane, inLane, options = {} }) {
    this.id = id;
    this.index = index;
    this.bus = bus;
    this.outLane = outLane; // my contribution flows here
    this.inLane = inLane;   // my draw arrives from here
    this.options = options; // {violator:{startTick,hidden}, forceOverspend, muted}
    this.engine = new QuiltEngine(`fiction:${id}`, { eager: true });
    const cells = [];
    const v = (id2, value, description) => cells.push({ id: id2, kind: 'value', value, description });
    v('zin', { last_seen: {}, stats: { accepted: 0, dropped: 0, wire_violation: 0, aged_out: 0 } }, 'Z_in: delta inbox + acceptance verdicts');
    v('zout', { delta: null, at: null, refused: false }, 'Z_out: last broadcast delta');
    v('jepa', { obs: {}, models: {}, predictions: {}, surprise_last: 0 }, 'JEPA: peer observation + flow-model predictions');
    v('doubleentry', { gamma_total: 0, eta_total: 0, planned_gamma: 0, planned_eta: 0, history: [] }, 'DoubleEntry: γ/η ledger (two sides balance)');
    v('vibe', { position: 0, velocity: 0 }, 'Vibe: developmental position/velocity');
    v('gc', { consolidations: 0, pruned_obs: 0, pruned_ledger: 0, events: [] }, 'GC: memory consolidation + event log');
    v('murmur', { sent_count: 0, last_sent_tick: null, last_refused_tick: null }, 'Murmur: broadcast listener');
    v('graph', { edges: {}, edge_count: 0 }, 'Graph: believed topology (per ordered pair)');
    v('clock', 0, 'logical clock');
    v('rng', seed >>> 0, 'deterministic rng state');
    v('reputation', Object.fromEntries(peers.filter((p) => p !== id).map((p) => [p, REP_INIT])), 'reputation map (per peer)');
    v('believed_peers', peers.filter((p) => p !== id).sort(), 'genesis roster belief (receipted roster:genesis)');
    v('budget', BUDGET, 'conservation budget C = 1.585');
    cells.push({ id: 'conservation_ok', kind: 'formula', expr: 'doubleentry.planned_gamma + doubleentry.planned_eta <= budget', description: 'γ+η ≤ C — the sheet itself refuses' });
    cells.push({ id: 'headroom', kind: 'formula', expr: 'budget - (doubleentry.planned_gamma + doubleentry.planned_eta)', description: 'C − (γ+η)' });
    cells.push({ id: 'beta1', kind: 'formula', expr: 'graph.edge_count - believed_peers.length', description: 'β₁ = E − V + C (single-component belief)' });
    this.CELL_IDS = cells.map((c) => c.id);
    this.engine.loadSheet({ cells });
  }

  async data(cell) { return (await this.engine.get(cell)).data; }
  async dump() {
    const out = {};
    for (const id of this.CELL_IDS) out[id] = await this.data(id);
    return out;
  }

  // ===========================================================================
  // THE TICK (seed4 §3.1, 10 steps, exact)
  // ===========================================================================
  async tick(inbox, wallTick) {
    const e = this.engine;
    // ---- reads (one pass) --------------------------------------------------
    const clock = await this.data('clock');
    const budget = await this.data('budget');
    let peers = [...(await this.data('believed_peers'))];
    const zin = await this.data('zin');
    const jepa = await this.data('jepa');
    const ledger = await this.data('doubleentry');
    const vibe = await this.data('vibe');
    const gc = await this.data('gc');
    const murmur = await this.data('murmur');
    const graph = await this.data('graph');
    const reputation = await this.data('reputation');
    let rngState = await this.data('rng');
    const rng01 = () => { const [r, s] = rngStep(rngState); rngState = s; return r; };

    // ---- STEP 1: read Z_in — verify integrity, drop non-believed senders ---
    const last_seen = { ...zin.last_seen };
    const stats = { ...zin.stats };
    const accepted = [];
    const heard = []; // for reputation (incl. wire-violating deltas)
    const wireViolations = [];
    for (const { from, delta } of inbox) {
      if (!verifyDelta(delta)) { stats.dropped++; continue; }              // integrity (§3.4.1)
      if (!peers.includes(from)) { stats.dropped++; continue; }            // local exclusion/aging: future only
      if (delta.gamma_delta + delta.eta_delta > budget) {                  // peer conservation (§4.2)
        stats.wire_violation++; wireViolations.push({ peer: from, why: 'wire' }); heard.push(delta); continue;
      }
      stats.accepted++;
      accepted.push(delta); heard.push(delta);
      last_seen[from] = clock;
    }
    // aging (receipted hole-fill K=20): silent peers leave the consensus view
    const aged = peers.filter((p) => clock - (last_seen[p] ?? 0) >= K_AGING);
    if (aged.length) {
      peers = peers.filter((p) => !aged.includes(p));
      for (const p of aged) {
        delete last_seen[p]; this._prunePairs(graph, p); stats.aged_out++;
        if (gc.events.length < 256) gc.events.push({ type: 'aging', peer: p, tick: clock });
      }
    }

    // ---- STEP 2: JEPA — ingest observations, predict peers (§3.4.3, §3.5) --
    jepa.predictions = {};
    let surpriseSum = 0, surpriseN = 0;
    for (const d of accepted) {
      const hist = jepa.obs[d.from] ?? (jepa.obs[d.from] = []);
      const prev = hist[hist.length - 1];
      if (prev) { surpriseSum += Math.abs(d.eta_delta - prev.eta) + Math.abs(d.gamma_delta - prev.gamma); surpriseN++; }
      hist.push({ tick: d.tick, gamma: d.gamma_delta, eta: d.eta_delta, action: d.z_out_action, velocity: d.vibe_velocity });
    }
    for (const p of peers) {
      const hist = jepa.obs[p] ?? [];
      const last = hist[hist.length - 1];
      if (!last) continue; // no observation yet — no prediction (honest idle)
      // PredictedDelta {gamma_delta, eta_delta, z_out_action, confidence}.
      // The flow model: my best feeder hypothesis for p predicts p's eta from
      // the feeder's gamma (receipted adaptation of §3.5 — the predictable
      // structure in this quilt IS the conservation flow).
      let bestR = -2, bestFeeder = null;
      for (const k of Object.keys(jepa.models)) {
        const [a, b] = k.split('|');
        if (b === p && jepa.models[k].r > bestR) { bestR = jepa.models[k].r; bestFeeder = a; }
      }
      const conf = Math.max(bestR > 0 ? bestR : 0, Math.min(1, hist.length / 10));
      jepa.predictions[p] = {
        gamma_delta: last.gamma,
        eta_delta: bestFeeder ? this._lastGamma(jepa, ledger, this.id, bestFeeder) : last.eta,
        z_out_action: last.action,
        confidence: Math.round(conf * SCALE),
      };
    }
    jepa.surprise_last = surpriseN ? Math.round(surpriseSum / surpriseN) : 0;

    // ---- STEP 3: DoubleEntry record (§3.1.3) -------------------------------
    let gamma = GAMMA_MIN + Math.round(GAMMA_SPAN * rng01());
    if (this.options.forceOverspend) gamma = budget; // smoke hook: exercise the refusal path
    const inflow = this._inflow(jepa, ledger);       // the two sides balance: η_j(t) = γ_feeder(t-1)
    const isViolating = this.options.violator && wallTick >= this.options.violator.startTick;
    const etaTrue = inflow + (isViolating ? this.options.violator.hidden : 0);
    ledger.planned_gamma = gamma;
    ledger.planned_eta = etaTrue;
    ledger.gamma_total += gamma;
    ledger.eta_total += etaTrue;
    ledger.history.push({ tick: clock, gamma_delta: gamma, eta_delta: etaTrue, counterparty: this.outLane, reason: 'tick' });
    await e.set('doubleentry', ledger); // propagate → formulas recompute (eager)

    // ---- STEP 4: conservation check — the SHEET refuses (§4.1) -------------
    const ok = (await e.get('conservation_ok')).data;
    if (!ok && !(this.options.violator && this.options.violator.breakGate)) {
      // STALL: no broadcast, clock frozen, nothing processed (receipted).
      await e.set('zin', { ...zin, last_seen, stats: { ...stats, dropped: stats.dropped + inbox.length - accepted.length - wireViolations.length } });
      await e.set('zout', { delta: null, at: clock, refused: true });
      await e.set('murmur', { ...murmur, last_refused_tick: clock });
      return { refused: true, delta: null };
    }

    // ---- STEP 5: Vibe update (§3.1.5) --------------------------------------
    const jitter = Math.round(JITTER * (2 * rng01() - 1));
    vibe.velocity = vibe.velocity + (etaTrue - gamma) + jitter;
    vibe.position += vibe.velocity;

    // ---- STEP 6: Murmur broadcast — one Delta to all believed peers (§3.3) -
    const etaWire = isViolating ? inflow : etaTrue; // the violator lies on the wire
    const delta = makeDelta({
      from: this.id, tick: clock,
      gamma_delta: gamma, eta_delta: etaWire,
      z_out_action: Math.floor(rng01() * 8),
      jepa_surprise: jepa.surprise_last,
      vibe_position: vibe.position, vibe_velocity: vibe.velocity,
    });
    let broadcast = 0;
    if (!this.options.muted) {
      broadcast = this.bus.publish({ from: this.id, to: [...peers], delta }); // fire and forget
    }
    await e.set('zout', { delta, at: clock, refused: false });
    await e.set('murmur', { ...murmur, sent_count: murmur.sent_count + (this.options.muted ? 0 : 1), last_sent_tick: this.options.muted ? murmur.last_sent_tick : clock });

    // ---- STEP 7: Graph adjust — beliefs += lr*(confirm - belief) (§3.6) ----
    const heardIds = [...new Set(accepted.map((d) => d.from))];
    const observable = [...new Set([this.id, ...heardIds])].sort();
    for (const a of observable) {
      for (const b of observable) {
        if (a === b) continue;
        if (!this._pairHasFreshData(jepa, ledger, a, b)) continue;
        const { r, meanErr, n } = this._flowStat(jepa, ledger, a, b);
        const key = pairKey(a, b);
        jepa.models[key] = { r, n, mean_err: meanErr };
        const confirm = r >= CONFIRM_R && meanErr <= XCHECK_TOL ? 1 : 0;
        const prev = graph.edges[key]?.belief ?? PRIOR_BELIEF;
        graph.edges[key] = { belief: prev + Math.round(((confirm ? SCALE : 0) - prev) * LR_EDGE), r, n };
      }
    }
    for (const p of [...aged]) this._prunePairs(graph, p); // aged peers leave the belief graph
    graph.edge_count = Object.values(graph.edges).filter((x) => x.belief >= PRESENT_AT).length;

    // ---- STEP 8: Reputation update (§4.2–4.4) ------------------------------
    const verdicts = [];
    const gmapOwn = new Map(ledger.history.map((h) => [h.tick, h.gamma_delta]));
    for (const d of heard) {
      let violated = wireViolations.some((w) => w.peer === d.from);
      const hist = jepa.obs[d.from] ?? [];
      if (!violated && hist.length >= 2) {
        const prev = hist[hist.length - 2]; // the observation BEFORE this delta
        if (Math.abs(d.vibe_velocity - (prev.velocity + (d.eta_delta - d.gamma_delta))) > XCHECK_TOL) {
          violated = true; // velocity cross-check: actions imply more than the wire admits
        }
      }
      if (!violated && d.from === this.outLane) {
        const myFeed = gmapOwn.get(d.tick - 1); // my γ that fed this peer last tick
        if (myFeed !== undefined && Math.abs(d.eta_delta - myFeed) > XCHECK_TOL) {
          violated = true; // balance check: the two sides of MY transaction must match
        }
      }
      verdicts.push({ peer: d.from, violated });
      if (violated) stats.violation_verdicts++;
    }
    const { rep, newlyExcluded } = applyReputation(reputation, verdicts, peers);
    for (const p of newlyExcluded) {
      peers = peers.filter((x) => x !== p);
      this._prunePairs(graph, p); // §4.4: remove edges to the excluded peer
      if (gc.events.length < 256) gc.events.push({ type: 'exclusion', peer: p, tick: clock });
    }

    // ---- STEP 9: GC consolidate --------------------------------------------
    for (const p of Object.keys(jepa.obs)) {
      if (jepa.obs[p].length > OBS_KEEP) { gc.pruned_obs += jepa.obs[p].length - OBS_KEEP; jepa.obs[p] = jepa.obs[p].slice(-OBS_KEEP); }
    }
    if (ledger.history.length > LEDGER_KEEP) { gc.pruned_ledger += ledger.history.length - LEDGER_KEEP; ledger.history = ledger.history.slice(-LEDGER_KEEP); }
    gc.consolidations++;

    // ---- STEP 10: clock++ ---------------------------------------------------
    await e.set('zin', { last_seen, stats });
    await e.set('jepa', jepa);
    await e.set('vibe', vibe);
    await e.set('graph', graph);
    await e.set('reputation', rep);
    await e.set('believed_peers', peers);
    await e.set('gc', gc);
    await e.set('rng', rngState);
    await e.set('clock', clock + 1);
    return { refused: false, delta: this.options.muted ? null : delta, broadcast };
  }

  // ---- helpers --------------------------------------------------------------
  _inflow(jepa, ledger) {
    // η_j = latest accepted γ from my in-lane feeder (the two sides balance).
    const hist = jepa.obs[this.inLane];
    if (!hist || !hist.length) return 0;
    return hist[hist.length - 1].gamma;
  }
  _lastGamma(jepa, ledger, selfId, peerId) {
    if (peerId === selfId) {
      return ledger.history.length ? ledger.history[ledger.history.length - 1].gamma_delta : 0;
    }
    const hist = jepa.obs[peerId];
    return hist && hist.length ? hist[hist.length - 1].gamma : 0;
  }
  _seriesGamma(jepa, ledger, selfId, a) {
    if (a === selfId) return ledger.history.map((h) => ({ tick: h.tick, v: h.gamma_delta }));
    return (jepa.obs[a] ?? []).map((o) => ({ tick: o.tick, v: o.gamma }));
  }
  _seriesEta(jepa, ledger, selfId, b) {
    if (b === selfId) return ledger.history.map((h) => ({ tick: h.tick, v: h.eta_delta }));
    return (jepa.obs[b] ?? []).map((o) => ({ tick: o.tick, v: o.eta }));
  }
  _pairHasFreshData(jepa, ledger, a, b) {
    return this._flowStat(jepa, ledger, a, b).n >= CONFIRM_WINDOW;
  }
  // Flow statistic for pair (a→b): corr(γ_a(s), η_b(s+1)) over the trailing
  // CONFIRM_WINDOW aligned sender-ticks. THE transaction channel: a's
  // contribution precedes (and equals) b's draw — conservation flow.
  _flowStat(jepa, ledger, a, b) {
    const gs = this._seriesGamma(jepa, ledger, this.id, a);
    const es = this._seriesEta(jepa, ledger, this.id, b);
    const gmap = new Map(gs.map((x) => [x.tick, x.v]));
    const pts = [];
    for (const e of es) { const g = gmap.get(e.tick - 1); if (g !== undefined) pts.push([g, e.v]); }
    const w = pts.slice(-CONFIRM_WINDOW);
    const xs = w.map((p) => p[0]), ys = w.map((p) => p[1]);
    const n = w.length;
    if (n === 0) return { r: 0, meanErr: Infinity, n: 0 };
    let err = 0;
    for (let i = 0; i < n; i++) err += Math.abs(xs[i] - ys[i]);
    return { r: pearson(xs, ys), meanErr: Math.round(err / n), n };
  }
  _prunePairs(graph, peer) {
    for (const k of Object.keys(graph.edges)) {
      const [a, b] = k.split('|');
      if (a === peer || b === peer) delete graph.edges[k];
    }
  }
}
