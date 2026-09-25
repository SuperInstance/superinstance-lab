// dbg6 — clean: single probe right after the weight loop, + full get log
import { QuiltEngine } from '/home/z/my-project/download/quilt-quant/engine/index.js';
import { buildSheet } from '/home/z/my-project/download/quilt-quant/lab/sheet.mjs';

const e = new QuiltEngine('dbg6', { eager: true });
const sheet = buildSheet();
e.loadSheet(sheet);
const def = sheet.cells.find((c) => c.id === 'sim.run');

await e.call('wave.spectrum');
await e.call('wave.regime');
await e.set('moth.entangle', { features: {}, edges: [], agreement: null, dominant: null, job_id: null, mock: true });

const log = [];
const runtime = {
  get: async (id) => { const env = await e.get(id); log.push([id, JSON.stringify(env.data)?.slice(0, 30)]); return env; },
  set: async (id, v) => e.set(id, v),
  call: async (id, input) => e.call(id, input),
};
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const code = def.code.replace(
  "const spec = await g('wave.spectrum');",
  "globalThis.__P = { afterW: { keys: Object.keys(w), mom_min: w.mom_min, trend_gap: w.trend_gap } };\n  const spec = await g('wave.spectrum');"
);
console.log('replace worked:', code !== def.code);
const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
const fn = new AsyncFunction('input', 'caller', 'runtime', 'clamp', 'abs', 'min', 'max', code);
const out = await fn({}, {}, runtime, clamp, Math.abs, Math.min, Math.max);
console.log('trades:', out.metrics.n_trades, 'refusals:', out.metrics.gate_refusals);
console.log('afterW probe:', JSON.stringify(globalThis.__P));
console.log('--- weight gets seen ---');
for (const [id, prev] of log) if (id.startsWith('w.')) console.log(id, '→', prev);
