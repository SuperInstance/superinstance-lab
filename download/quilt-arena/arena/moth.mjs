// E12 — THE MOTH VAULT.
//
// Perception as a rationed resource. The arena does not let agents call the
// quantum API freely: every true-stochastic draw comes from a VAULT of
// packets, each packet = one moth-quantum job. The vault enforces:
//   1. disk cache  — (engine,params) -> result, so re-runs are byte-identical
//                    replays with ZERO new API calls (deterministic science);
//   2. live cap    — at most MAX_LIVE real jobs per run (the user monitors the
//                    key on their dashboard; the arena stays a polite guest);
//   3. fallback    — if live is unreachable, synthetic packets, every draw
//                    flagged mock:true (honest labeling, E11 doctrine);
//   4. journal     — every packet fetch and every agent debit is receipted.
//
// Agent-facing surface is SMALL on purpose: the vault hands out floats in
// [0,1). What an agent BUYS with them (exploration noise, particle
// resampling, mixed-strategy mixing) is the agent's own doctrine — that is
// the perception economy the tournament measures.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const HERE = dirname(import.meta.url);
const API = 'https://api.mothquantum.com/api/v1';
const KEY_PATHS = [
  join(HERE, 'moth_key.env'),
  '/home/z/my-project/scripts/quilt-lab/moth_key.env',
];

export function loadKey() {
  if (process.env.MOTH_KEY) return process.env.MOTH_KEY;
  for (const f of KEY_PATHS) {
    if (existsSync(f)) {
      const m = readFileSync(f, 'utf8').match(/MOTH_KEY\s*=\s*(\S+)/);
      if (m) return m[1];
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

async function call(method, path, body, key, timeoutMs = 30000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 400) }; }
    return { status: res.status, ms: Date.now() - t0, data };
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, data: { error: String((e && e.message) || e) } };
  } finally { clearTimeout(t); }
}

async function runJob(engine, params, key, { timeoutMs = 90000, pollMs = 1500 } = {}) {
  const sub = await call('POST', `/engines/${engine}/process`, { params }, key);
  if (sub.status === 0) return { ok: false, stage: 'submit', error: 'unreachable: ' + sub.data.error };
  if (sub.status === 401 || sub.status === 403) return { ok: false, stage: 'submit', error: `auth ${sub.status}` };
  if (sub.status !== 200 && sub.status !== 202) return { ok: false, stage: 'submit', error: `HTTP ${sub.status}`, meta: sub.data };
  const jobId = sub.data && sub.data.job_id;
  if (!jobId) return { ok: false, stage: 'submit', error: 'no job_id', meta: sub.data };
  const t0 = Date.now();
  let st = null;
  while (Date.now() - t0 < timeoutMs) {
    await sleep(pollMs);
    const s = await call('GET', `/jobs/${jobId}/status`, null, key, 15000);
    st = s.data && s.data.status;
    if (st === 'completed' || st === 'failed' || st === 'cancelled') break;
  }
  if (st !== 'completed') return { ok: false, stage: 'poll', error: `job ${jobId} status=${st}` };
  const r = await call('GET', `/jobs/${jobId}/result`, null, key, 30000);
  const out = r.data || {};
  return {
    ok: true, jobId, latencyMs: Date.now() - t0,
    result: out.result !== undefined ? out.result : null,
    outputs: out.outputs !== undefined ? out.outputs : null,
  };
}

// ── the vault ────────────────────────────────────────────────────────────────

export const MAX_LIVE = 14; // hard cap on real API jobs per run

export class MothVault {
  // cachePath persists (engine,params)->{result} so replays are identical.
  // ns namespaces the cache: OFF packets must never satisfy LIVE tags (a
  // synthetic packet cached under the same tag would silently shadow a real
  // quantum read — the gravest sin this vault knows).
  constructor({ key = null, cachePath = null, live = true, seed = 20260925, journal = [], ns = 'OFF' } = {}) {
    this.key = key;
    this.cachePath = cachePath;
    this.liveCap = live;
    this.liveUsed = 0;
    this.seed = seed >>> 0;
    this.ns = ns;
    this.journal = journal; // shared receipt list
    this.cache = {};
    if (cachePath && existsSync(cachePath)) {
      try { this.cache = JSON.parse(readFileSync(cachePath, 'utf8')); } catch { this.cache = {}; }
    }
  }

  persist() {
    if (this.cachePath) writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 1));
  }

  hashOf(engine, params) {
    const s = JSON.stringify([engine, params]);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return (h >>> 0).toString(36);
  }

  // One packet of true entropy: 32 floats in [0,1). qpixl encodes a probe
  // waveform as qubit angles and decodes in ONE measurement; the decode noise
  // (finite shots) IS the quantum sampling randomness we harvest (E11 idiom).
  // Offline: a seeded PRNG fabricates the packet, flagged mock:true.
  async packet(tag) {
    const probe = Array.from({ length: 32 }, (_, i) => 0.1 + 0.8 * ((i * 37) % 100) / 100);
    const params = {
      values: probe, machine: 'aer', mode: 'emu', shots: 2048,
      discretize: 0, dynamic_range: 'none', allow_high_shots: false,
    };
    const h = this.hashOf(`qpixl-v1:${this.ns}:${tag}`, params);
    if (this.cache[h]) {
      this.journal.push({ kind: 'packet', tag, h, source: 'cache', mock: this.cache[h].mock });
      return { floats: this.cache[h].floats, mock: this.cache[h].mock, source: 'cache' };
    }
    let floats = null, mock = true, source = 'synthetic', jobId = null;
    if (this.key && this.liveCap && this.liveUsed < MAX_LIVE) {
      const r = await runJob('qpixl-v1', params, this.key);
      if (r.ok && Array.isArray(r.result.output)) {
        const got = r.result.output;
        floats = got.slice(0, 32).map((g, i) => clamp(0.5 + (g - probe[i]) * 25, 0, 0.999999));
        mock = false; source = 'live'; jobId = r.jobId; this.liveUsed++;
      }
    }
    if (!floats) {
      // deterministic synthetic fallback (mulberry32), FLAGGED
      let a = (this.seed ^ Math.imul(h.split('').reduce((x, c) => x + c.charCodeAt(0), 7), 2654435761)) >>> 0;
      floats = Array.from({ length: 32 }, () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
    }
    this.cache[h] = { floats, mock, job_id: jobId };
    this.persist();
    this.journal.push({ kind: 'packet', tag, h, source, mock, job_id: jobId });
    return { floats, mock, source };
  }

  // connectivity probe + perceptual read for the record (1 live job when live)
  async probe() {
    const params = { mode: 'emu', shots: 64 };
    const h = this.hashOf(`coin-toss-v1:${this.ns}:probe`, params);
    if (this.cache[h]) return { ...(this.cache[h]), source: 'cache' };
    if (this.key && this.liveCap && this.liveUsed < MAX_LIVE) {
      const r = await runJob('coin-toss-v1', params, this.key);
      if (r.ok) {
        const rec = { heads: r.result.heads, tails: r.result.tails, shots: r.result.shots, job_id: r.jobId, mock: false };
        this.cache[h] = rec; this.persist(); this.liveUsed++;
        this.journal.push({ kind: 'probe', source: 'live', ...rec });
        return rec;
      }
    }
    const rec = { heads: 33, tails: 31, shots: 64, job_id: null, mock: true };
    this.cache[h] = rec; this.persist();
    this.journal.push({ kind: 'probe', source: 'synthetic', ...rec });
    return rec;
  }

  // graph-v1 tomography read — the entanglement meter. features: name->x in
  // [-1,1] mapped to Bloch Z; edges: [{qubits:[a,b], zz: target}].
  async entangle(features, edges, tag) {
    const names = Object.keys(features);
    const operations = names.map((n, i) => ({ type: 'bloch', qubit: i, paulis: { Z: +features[n].toFixed(4) } }));
    for (const e of edges) operations.push({ type: 'relationship', qubits: e.qubits, paulis: { ZZ: e.zz } });
    const params = { mode: 'emu', num_qubits: names.length, shots: 1024, operations };
    const h = this.hashOf(`graph-v1:${this.ns}:${tag}`, params);
    if (this.cache[h]) return { ...(this.cache[h]), source: 'cache' };
    let rec = null;
    if (this.key && this.liveCap && this.liveUsed < MAX_LIVE) {
      const r = await runJob('graph-v1', params, this.key);
      if (r.ok) {
        const out = r.result.output || {};
        // real shape (verified live): out.tomography.relationships["a,b"].ZZ
        const rel = (out.tomography && out.tomography.relationships) || {};
        const zz = {};
        for (const e of edges) {
          const k = `${names[e.qubits[0]]}x${names[e.qubits[1]]}`;
          const rk = `${e.qubits[0]},${e.qubits[1]}`;
          zz[k] = rel[rk] ? rel[rk].ZZ : null;
        }
        rec = { zz, agreement: out.edge_agreement_score ?? null, dominant: out.dominant_bitstring ?? null, job_id: r.jobId, mock: false };
        this.cache[h] = rec; this.persist(); this.liveUsed++;
        this.journal.push({ kind: 'entangle', tag, source: 'live', job_id: r.jobId });
        return rec;
      }
    }
    // pseudo-tomography fallback (E11 doctrine: flagged, plausible)
    const zz = {};
    for (const e of edges) zz[`${names[e.qubits[0]]}x${names[e.qubits[1]]}`] = clamp(e.zz + (Math.sin(h.charCodeAt(0) + e.qubits[0] * 3) * 0.08), -1, 1);
    rec = { zz, agreement: 0.5 + 0.3 * Math.sin(h.charCodeAt(1)), dominant: null, job_id: null, mock: true };
    this.cache[h] = rec; this.persist();
    this.journal.push({ kind: 'entangle', tag, source: 'synthetic' });
    return rec;
  }
}
