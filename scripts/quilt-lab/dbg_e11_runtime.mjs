// dbg3 — eval the REAL composed sim.run body with a logging runtime stub
import { QuiltEngine } from '/home/z/my-project/download/quilt-quant/engine/index.js';
import { buildSheet } from '/home/z/my-project/download/quilt-quant/lab/sheet.mjs';

const e = new QuiltEngine('dbg3', { eager: true });
const sheet = buildSheet();
e.loadSheet(sheet);
const def = sheet.cells.find((c) => c.id === 'sim.run');
const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;

// first evaluate the perception cells in the REAL engine so caches are warm
await e.call('wave.spectrum');
await e.call('wave.regime');
await e.set('moth.entangle', { features: {}, edges: [], agreement: null, dominant: null, job_id: null, mock: true });

const log = [];
const runtime = {
  get: async (id) => {
    const env = await e.get(id);
    log.push(['get', id, JSON.stringify(env).slice(0, 60)]);
    return env;
  },
  set: async (id, v) => { log.push(['set', id, JSON.stringify(v).slice(0, 40)]); return e.set(id, v); },
  call: async (id, input) => {
    const out = await e.call(id, input);
    log.push(['call', id, JSON.stringify(out).slice(0, 80)]);
    return out;
  },
};
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const fn = new AsyncFunction('input', 'caller', 'runtime', 'clamp', 'abs', 'min', 'max', def.code);
try {
  const out = await fn({}, {}, runtime, clamp, Math.abs, Math.min, Math.max);
  console.log('RESULT metrics:', JSON.stringify(out && out.metrics).slice(0, 220));
  console.log('RESULT n_bars:', out && out.n_bars, 'trades:', out && out.trades.length);
} catch (err) {
  console.log('CELL THREW:', err.message);
}
console.log('--- runtime log (unique ids, first value preview) ---');
const seen = new Set();
for (const [kind, id, prev] of log) {
  const k = kind + id;
  if (seen.has(k)) continue;
  seen.add(k);
  console.log(kind, id, '→', prev);
}
if (log.length === 0) console.log('(runtime never touched)');

// ── isolate: run ONLY the policy walk with the same SRC strings ──
const { SRC_MATH, SRC_WAVE, SRC_POLICY } = await import('/home/z/my-project/download/quilt-quant/lab/policy.src.mjs');
const walkBody = `
${SRC_MATH}
${SRC_WAVE}
${SRC_POLICY}
const c = input.c;
const f = sma(c, 10), s = sma(c, 30), r = rsi(c, 14), m = momz(c, 20, 30);
const wave = input.wave;
const w = input.w;
let proposals = 0, trendN = 0, cycleN = 0, firstProps = [];
for (let i = 31; i < c.length; i++) {
  const prop = policyAt(i, c, f, s, r, m, w, wave);
  if (prop.side !== 'FLAT') { proposals++; if (prop.block.includes('trend')) trendN++; else cycleN++; if (firstProps.length < 5) firstProps.push({i, side: prop.side, block: prop.block}); }
}
return { proposals, trendN, cycleN, firstProps, p_star: wave.p_star, phase: wave.phase };
`;
const specReal = (await e.call('wave.spectrum')).data;
const rgReal = (await e.call('wave.regime')).data;
const walkFn = new AsyncFunction('input', walkBody);
const wr = await walkFn({
  c: (await e.get('mkt.ohlcv')).data.c,
  wave: { p_star: specReal.p_star, phase: specReal.phase, regime: rgReal.regime },
  w: { mom_min: 0.55, trend_gap: 0.008, rsi_lo: 40, rsi_hi: 60, size: 0.25, spec_gate: 0.75 },
});
console.log('POLICY WALK (isolated, real data):', JSON.stringify(wr));
