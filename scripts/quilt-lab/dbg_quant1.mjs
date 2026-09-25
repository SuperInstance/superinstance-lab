// quick probe: does the desk sheet load, price, and reprice through the DSL?
import { QuiltEngine } from '/home/z/my-project/download/quilt-quant/engine/index.js';
import { buildSheet } from '/home/z/my-project/download/quilt-quant/quant/sheet.mjs';

const sheet = buildSheet();
console.log('cells:', sheet.cells.length);
const engine = new QuiltEngine('quant-probe', { eager: true });
engine.loadSheet(sheet);

const get = async (id) => (await engine.get(id)).data;

const bt = await get('bt.run');
console.log('bt.ok:', bt?.ok, '| fired:', bt?.fired?.join(','));
console.log('metrics:', JSON.stringify(bt?.metrics, (k, v2) => (typeof v2 === 'number' ? +v2.toFixed(4) : v2)));
console.log('trades:', bt?.trades?.length, 'first:', JSON.stringify(bt?.trades?.[0]));

console.log('met.sharpe formula:', await get('met.sharpe'));
console.log('met.wf formula:', await get('met.wf'));
console.log('met.bnh_ret formula:', await get('met.bnh_ret'));

const wf = await get('wf.report');
console.log('wf:', wf?.verdict, 'isN', wf?.isN, 'oosN', wf?.oosN, '| is.sharpe', wf?.is_m?.sharpe?.toFixed(2), 'oos.sharpe', wf?.oos_m?.sharpe?.toFixed(2));

const art = await get('art.equity');
console.log('art.desk:', art?.desk?.slice(0, 44));
console.log('art.dd  :', art?.dd?.slice(0, 44));

// the nudge: one value push must re-price the desk
const before = await get('met.sharpe');
await engine.set('p.fast', 21);
const after = await get('met.sharpe');
console.log('nudge p.fast 8→21: sharpe', before?.toFixed(3), '→', after?.toFixed(3));
const bt2 = await get('bt.run');
console.log('bt.params after nudge:', JSON.stringify(bt2?.params));

// trainer smoke
const t = await engine.call('ai.trainer', { gens: 6, seed: 7 });
console.log('trainer:', JSON.stringify(t.data ?? t, (k, v2) => (typeof v2 === 'number' ? +v2.toFixed(3) : v2)).slice(0, 400));
const ledger = await get('ai.ledger');
console.log('ledger rows:', ledger.length, 'kinds:', ledger.map(r => r.kind).join(','));
const chain = await get('ai.chaincheck');
console.log('chain:', JSON.stringify(chain));
console.log('desk.flash:', (await get('desk.flash'))?.text);
