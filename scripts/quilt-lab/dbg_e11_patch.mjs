import { QuiltEngine } from '/home/z/my-project/download/quilt-quant/engine/index.js';
import { buildSheet } from '/home/z/my-project/download/quilt-quant/lab/sheet.mjs';

const e = new QuiltEngine('dbg4', { eager: true });
const sheet = buildSheet();
e.loadSheet(sheet);
const def = JSON.parse(JSON.stringify(sheet.cells.find((c) => c.id === 'sim.run')));
await e.call('wave.spectrum'); await e.call('wave.regime');
await e.set('moth.entangle', { features: {}, edges: [], agreement: null, dominant: null, job_id: null, mock: true });

def.code = def.code.replace(
  "const spec = await g('wave.spectrum');",
  "globalThis.__PROBE.push({ at: 'afterW', keys: Object.keys(w), mom_min: w.mom_min, cursorType: typeof w });\n  const spec = await g('wave.spectrum');"
);
def.code = "globalThis.__PROBE = [];\n" + def.code;

const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const runtime = {
  get: async (id) => e.get(id),
  set: async (id, v) => e.set(id, v),
  call: async (id, input) => e.call(id, input),
};
const fn = new AsyncFunction('input', 'caller', 'runtime', 'clamp', 'abs', 'min', 'max', def.code);
const out = await fn({}, {}, runtime, clamp, Math.abs, Math.min, Math.max);
console.log("trades:", out.metrics.n_trades, "gate_refusals:", out.metrics.gate_refusals); console.log("PROBE:", JSON.stringify(globalThis.__PROBE, null, 1));
