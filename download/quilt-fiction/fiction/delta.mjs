// quilt-fiction/fiction/delta.mjs — THE DELTA: the only observable (seed4 §3.2).
// =============================================================================
// SCHEMA RECONCILIATION (receipted hole-fill): seed4 carries TWO delta
// variants — §3.2's wire Delta {from, tick, gamma_delta, eta_delta,
// z_out_action, jepa_surprise, vibe_position, vibe_velocity, checksum} and
// §2.3's LedgerEntry {tick, gamma_delta, eta_delta, counterparty, reason}.
// Reconciled to ONE: the WIRE carries exactly the §3.2 shape below; the
// counterparty/reason fields stay PRIVATE in the double-entry ledger (they are
// bookkeeping, not observable surface — §2.3: "the ledger is the visible
// surface", §5.1 lists only the §3.2 fields as visible). One schema on the
// wire, the ledger keeps its double-entry anatomy internally.
//
// DETERMINISM (house rule): every state-bearing float is an INTEGER scaled by
// SCALE=10000 (flows, vibe, surprise). The checksum is fnv1a64 over canonical
// JSON (recursively sorted keys), checksum field excluded.

import { fnv1a64 } from './receipts.mjs';

export const SCALE = 10000;           // fixed-point scale for flow/vibe/surprise
export const REP_SCALE = 1000000;     // fixed-point scale for reputation
export const BUDGET = 15850;          // conservation budget C = 1.585 (seed4) scaled
export const GAMMA_MIN = 3000;        // honest contribution draw: [3000, 7000]
export const GAMMA_SPAN = 4000;
export const JITTER = 100;            // honest velocity jitter bound (0.01)
export const XCHECK_TOL = 500;        // cross-check tolerance (0.05) — 5x jitter

// canonical JSON: recursively sorted keys, arrays in order. Deterministic.
export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') {
    if (value === undefined) return 'null';
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`canonicalJSON: non-finite number ${value}`);
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(value[k])).join(',') + '}';
}

export function deltaChecksum(delta) {
  const { checksum, ...rest } = delta;
  return fnv1a64(canonicalJSON(rest));
}

export function makeDelta({ from, tick, gamma_delta, eta_delta, z_out_action, jepa_surprise, vibe_position, vibe_velocity }) {
  for (const [k, v] of Object.entries({ tick, gamma_delta, eta_delta, z_out_action, jepa_surprise, vibe_position, vibe_velocity })) {
    if (!Number.isSafeInteger(v)) throw new Error(`makeDelta: ${k} must be a safe integer, got ${v}`);
  }
  const delta = { from, tick, gamma_delta, eta_delta, z_out_action, jepa_surprise, vibe_position, vibe_velocity, checksum: '' };
  delta.checksum = deltaChecksum(delta);
  return delta;
}

export function verifyDelta(delta) {
  if (!delta || typeof delta !== 'object') return false;
  if (typeof delta.checksum !== 'string') return false;
  try { return delta.checksum === deltaChecksum(delta); } catch { return false; }
}

// Tamper helper (smoke uses it): flip a field, checksum breaks.
export function tamperDelta(delta, field, value) {
  return { ...delta, [field]: value };
}

// Deterministic rng: mulberry32 as a PURE step — same seed, same quilt.
// Returns [value01, nextState]; callers persist nextState in the rng cell.
export function rngStep(state) {
  let a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [r, a];
}

export function hashSeed(...parts) {
  // fnv1a64 over the parts, truncated to 32 bits for mulberry32.
  return Number(BigInt(fnv1a64(parts)) & 0xffffffffn) >>> 0;
}

// Pearson correlation over paired samples. Deterministic plain-float math.
export function pearson(xs, ys) {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return 0;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}
