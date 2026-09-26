// quilt-fiction/fiction/bus.mjs — the delta transport (seed4 §3.3).
// =============================================================================
// ADAPTED from quilt-murmur/murmur/bus.mjs (copied-then-rebuilt, receipted):
// kept — the ambient provenance LOG ("every murmur ever whispered", snapshot-
// per-entry so downstream mutation cannot age history), the envelope pattern,
// and the GAUNTLET fail-fast discipline (non-finite values are loud throws at
// the boundary, 22-c). Replaced — murmur's belief layer (log-odds pooling,
// trust weights, ttl evaporation) is NOT transport and does not belong here:
// receivers do their own trust via reputation (fiction/reputation.mjs).
//
// Transport semantics (seed4 §3.3): FIRE AND FORGET. publish() returns the
// delivery count; there are no acks, no retries, no delivery guarantee beyond
// the in-process synchronous handoff. The log is the observer's window (§5.1):
// publicLog() strips the `to` addressing — the observer sees the deltas and
// their sources, never the addressing, so LOCAL exclusion is invisible to the
// renderer except through its physical consequence (flow collapse).

export class FederationBus {
  constructor() {
    this.log = [];            // every envelope ever published (provenance)
    this.pending = new Map(); // recipient id -> [{from, delta}] — transit buffer
    this.deliveries = 0;      // total point-to-point deliveries (fire-and-forget)
    this.publications = 0;    // total publish() calls (one broadcast = one call)
  }

  // envelope = { from, to: [ids], delta } — one Delta broadcast to all
  // believed peers of the sender (seed4 §3.3: keyed by the instance's ID).
  publish(envelope) {
    const { from, to, delta } = envelope;
    if (!from || !Array.isArray(to) || !delta) throw new Error('publish: envelope needs from, to[], delta');
    if (!Number.isSafeInteger(delta.tick)) throw new Error('publish: delta.tick must be an integer');
    // GAUNTLET discipline (22-c): non-finite numerics are loud throws.
    for (const k of ['gamma_delta', 'eta_delta', 'jepa_surprise', 'vibe_position', 'vibe_velocity']) {
      if (!Number.isFinite(delta[k])) throw new Error(`publish: delta.${k} must be finite, got ${delta[k]}`);
    }
    this.log.push({ from, to: [...to], delta: { ...delta } }); // snapshot: log never ages
    let n = 0;
    for (const id of to) {
      if (!this.pending.has(id)) this.pending.set(id, []);
      this.pending.get(id).push({ from, delta: { ...delta } });
      n++;
    }
    this.deliveries += n;
    this.publications += 1;
    return n; // fire-and-forget: the count is telemetry, not an ack
  }

  // Drain the recipient's transit buffer (called once per tick by the tick
  // driver). The buffer is wire, not memory: emptied on read.
  drain(id) {
    const out = this.pending.get(id) ?? [];
    this.pending.set(id, []);
    return out;
  }

  // Freeze-and-drain ALL buffers at a wall-tick boundary: recipients see
  // exactly the deltas published in previous wall ticks (no same-tick leaks,
  // deterministic regardless of instance tick order).
  drainAll() {
    const out = {};
    for (const [id, buf] of this.pending) out[id] = buf;
    this.pending = new Map();
    return out;
  }

  // Observer view (§5.1): sources + deltas only. No addressing.
  publicLog() {
    return this.log.map(({ from, delta }) => ({ from, delta: { ...delta } }));
  }

  // Windowed observer view: deltas whose sender tick is in [lo, hi].
  publicWindow(lo, hi) {
    return this.publicLog().filter((e) => e.delta.tick >= lo && e.delta.tick <= hi);
  }
}
