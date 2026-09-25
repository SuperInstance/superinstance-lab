// One REAL z-ai analyst call through the sheet's letter fence (A–E).
// The digest is the DISTRIBUTED state of the lab; the fence is in the adapter.
//   node lab/analyst_live.mjs
import { QuiltEngine } from '../engine/index.js';
import { buildSheet } from './sheet.mjs';
import { AnalystAI } from './play.mjs';

const adapter = new AnalystAI({ mock: false });
await adapter.init();
const engine = new QuiltEngine('lab-analyst-live', { eager: true, ai: adapter });
engine.loadSheet(buildSheet());
await engine.call('sim.run');
const digest = (await engine.call('ai.digest')).data;
console.log('digest  :', digest);
const t0 = Date.now();
const out = (await engine.call('ai.analyst')).data;
console.log(`analyst (${Date.now() - t0}ms):`, JSON.stringify(out));
if (out && out.letter) {
  const meanings = { A: 'keep course', B: 'exploit (shrink steps)', C: 'explore (widen steps)', D: 'prune least useful weight', E: 're-tune stops/targets' };
  console.log('verdict :', out.letter, '—', meanings[out.letter]);
} else {
  console.log('refused — receipted as a refusal, the sheet hears a refusal, not a stack trace');
}
process.exit(0);
