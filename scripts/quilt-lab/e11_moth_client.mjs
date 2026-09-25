// E11 — moth-quantum API client (job-based: submit -> poll -> result)
// Docs: https://docs.mothquantum.com/docs/intro   API: https://api.mothquantum.com/api/v1
// Key: env MOTH_KEY, or ./moth_key.env (MOTH_KEY=moth_...). NEVER commit the key.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const API = 'https://api.mothquantum.com/api/v1';

export function loadKey() {
  if (process.env.MOTH_KEY) return process.env.MOTH_KEY;
  const f = join(HERE, 'moth_key.env');
  if (existsSync(f)) {
    const m = readFileSync(f, 'utf8').match(/MOTH_KEY\s*=\s*(\S+)/);
    if (m) return m[1];
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
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    const ms = Date.now() - t0;
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 400) }; }
    return { status: res.status, ms, data };
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, data: { error: String(e && e.message || e) } };
  } finally { clearTimeout(t); }
}

// submit job -> poll -> { ok, result, outputs, meta }
export async function runJob(engine, params, key, { timeoutMs = 90000, pollMs = 1500, label = engine } = {}) {
  const sub = await call('POST', `/engines/${engine}/process`, { params }, key);
  if (sub.status === 0) return { ok: false, stage: 'submit', error: 'unreachable:' + sub.data.error, meta: sub };
  if (sub.status === 401 || sub.status === 403) return { ok: false, stage: 'submit', error: `auth ${sub.status}`, meta: sub.data };
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
  if (st !== 'completed') return { ok: false, stage: 'poll', error: `job ${jobId} status=${st}`, meta: st };

  const r = await call('GET', `/jobs/${jobId}/result`, null, key, 30000);
  const out = r.data || {};
  return {
    ok: true,
    jobId,
    latencyMs: Date.now() - t0,
    submitMs: sub.ms,
    result: out.result !== undefined ? out.result : null,
    outputs: out.outputs !== undefined ? out.outputs : null,
  };
}

// ---------------- probe ----------------
export async function probe(opts = {}) {
  const key = loadKey();
  const log = (...a) => console.log(...a);
  const report = { me: null, engines: 0, coin: null, qpixl: null, graph: null };

  log('── 1. GET /me (identity check — this is the call you can watch on the dashboard)');
  const me = await call('GET', '/me', null, key, 15000);
  report.me = me;
  log(`   HTTP ${me.status} in ${me.ms}ms →`, JSON.stringify(me.data).slice(0, 220));
  if (me.status !== 200) return { ok: false, report, error: 'auth failed — key invalid or revoked' };

  log('── 2. GET /engines (catalog)');
  const en = await call('GET', '/engines', null, key, 15000);
  const list = (en.data && en.data.data) || en.data || [];
  const ids = Array.isArray(list) ? list.map((e) => e.engine_id || e.id) : [];
  report.engines = ids.length;
  log(`   HTTP ${en.status}, ${ids.length} visible engines:`, ids.slice(0, 20).join(', '));

  log('── 3. POST coin-toss-v1 (true quantum entropy, 32 shots, emu)');
  const coin = await runJob('coin-toss-v1', { mode: 'emu', shots: 32 }, key);
  report.coin = coin;
  if (coin.ok) log(`   ✓ job ${coin.jobId} → ${JSON.stringify(coin.result).slice(0, 160)} (poll ${coin.latencyMs}ms)`);
  else log('   ✗', coin.error, JSON.stringify(coin.meta || {}).slice(0, 200));

  await sleep(1200);

  log('── 4. POST qpixl-v1 (numbers-as-waveform: encode 16 amplitudes as qubit angles, decode in one measurement)');
  const wave = [];
  for (let i = 0; i < 16; i++) wave.push(Math.round((0.5 + 0.45 * Math.sin((i / 16) * Math.PI * 2 * 2)) * 1000) / 1000);
  const qp = await runJob('qpixl-v1', {
    values: wave, machine: 'aer', mode: 'emu', shots: 1024,
    discretize: 0, dynamic_range: 'none', allow_high_shots: false,
  }, key);
  report.qpixl = qp;
  if (qp.ok) {
    const r = qp.result || {};
    const decoded = r.decoded || r.values || r.output || r;
    log(`   ✓ job ${qp.jobId} → keys: ${Object.keys(r).join(',')}`);
    log(`   sent [${wave.slice(0, 6).map((x) => x.toFixed(2)).join(' ')} …] got ${JSON.stringify(decoded).slice(0, 180)}`);
  } else log('   ✗', qp.error, JSON.stringify(qp.meta || {}).slice(0, 300));

  await sleep(1200);

  log('── 5. POST graph-v1 (quantum graph state: 4 qubits, custom couplings → tomography + counts)');
  const gp = await runJob('graph-v1', {
    mode: 'emu', num_qubits: 4, shots: 512,
    coupling_map: [[0, 1], [1, 2], [2, 3], [0, 3]],
  }, key);
  report.graph = gp;
  if (gp.ok) {
    const r = gp.result || {};
    log(`   ✓ job ${gp.jobId} → keys: ${Object.keys(r).join(',')}`);
    log(`   ${JSON.stringify(r).slice(0, 400)}`);
  } else log('   ✗', gp.error, JSON.stringify(gp.meta || {}).slice(0, 300));

  return { ok: true, report };
}

// CLI: node e11_moth_client.mjs probe
if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2] || 'probe';
  if (cmd === 'probe') {
    probe().then((r) => {
      console.log('\nPROBE', r.ok ? 'OK' : 'FAILED ' + (r.error || ''));
      process.exit(r.ok ? 0 : 1);
    });
  } else if (cmd === 'coin') {
    const n = Number(process.argv[3] || 64);
    runJob('coin-toss-v1', { mode: 'emu', shots: n }, loadKey()).then((r) => {
      console.log(JSON.stringify(r, null, 2).slice(0, 800));
    });
  } else console.log('usage: node e11_moth_client.mjs [probe|coin shots]');
}
