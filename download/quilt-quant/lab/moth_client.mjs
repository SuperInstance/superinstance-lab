// E11 — moth-quantum API client (job-based: submit -> poll -> result)
// Docs: https://docs.mothquantum.com/docs/intro   API: https://api.mothquantum.com/api/v1
// Key: env MOTH_KEY, or scripts/quilt-lab/moth_key.env. NEVER commit the key.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const HERE = dirname(import.meta.url);
const API = 'https://api.mothquantum.com/api/v1';
const KEY_PATHS = [join(HERE, 'moth_key.env'), '/home/z/my-project/scripts/quilt-lab/moth_key.env'];

export function loadKey() {
  if (process.env.MOTH_KEY) return process.env.MOTH_KEY;
  for (const f of KEY_PATHS) {
    if (existsSync(f)) {
      const m = readFileSync(f, 'utf8').match(/MOTH_KEY\s*=\s*(\S+)/);
      if (m) return m[1];
    }
  }
  throw new Error('No moth key: set MOTH_KEY env or create moth_key.env');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    const ms = Date.now() - t0;
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 400) }; }
    return { status: res.status, ms, data };
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, data: { error: String((e && e.message) || e) } };
  } finally { clearTimeout(t); }
}

// submit -> poll -> { ok, jobId, result, outputs, latencyMs } | { ok:false, stage, error }
export async function runJob(engine, params, key, { timeoutMs = 90000, pollMs = 1500 } = {}) {
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

// ---- high-level reads used by the lab -------------------------------------
// coin-toss-v1: {mode,shots} -> {output, heads, tails, shots}
export async function quantumCoin(shots, key) {
  const r = await runJob('coin-toss-v1', { mode: 'emu', shots }, key);
  if (!r.ok) return r;
  return { ok: true, jobId: r.jobId, ms: r.latencyMs, heads: r.result.heads, tails: r.result.tails, shots: r.result.shots };
}

// qpixl-v1: numbers-as-waveform. values are encoded as qubit angles and
// decoded in a single measurement. The decode noise (finite shots) is true
// quantum sampling randomness — the lab harvests it as an entropy pool.
export async function waveformRead(values, shots, key) {
  const r = await runJob('qpixl-v1', {
    values, machine: 'aer', mode: 'emu', shots,
    discretize: 0, dynamic_range: 'none', allow_high_shots: false,
  }, key);
  if (!r.ok) return r;
  const got = Array.isArray(r.result.output) ? r.result.output : null;
  if (!got) return { ok: false, stage: 'shape', error: 'qpixl output not an array: ' + JSON.stringify(r.result).slice(0, 120) };
  return { ok: true, jobId: r.jobId, ms: r.latencyMs, sent: values, got };
}

// graph-v1: quantum graph state. bloch targets set per-qubit Pauli
// expectations; relationship ops set per-edge ZZ targets on coupled pairs.
// Returns exact tomography + sampled counts + edge_agreement_score.
export async function entangleRead(numQubits, couplingMap, operations, shots, key) {
  const r = await runJob('graph-v1', {
    mode: 'emu', num_qubits: numQubits, shots,
    ...(couplingMap ? { coupling_map: couplingMap } : {}),
    ...(operations ? { operations } : {}),
  }, key);
  if (!r.ok) return r;
  const out = r.result.output || {};
  return {
    ok: true, jobId: r.jobId, ms: r.latencyMs,
    tomography: out.tomography || null,
    measurements: out.measurements || [],
    dominant: out.dominant_bitstring || null,
    agreement: out.edge_agreement_score ?? null,
    coupling_map: out.coupling_map || couplingMap || [],
  };
}
