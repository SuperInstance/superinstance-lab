// probe 2: the desk discipline — pull pricing cells after any set, THEN formulas
import { QuiltEngine } from '/home/z/my-project/download/quilt-quant/engine/index.js';
import { buildSheet } from '/home/z/my-project/download/quilt-quant/quant/sheet.mjs';

const engine = new QuiltEngine('quant-probe2', { eager: true });
engine.loadSheet(buildSheet());
const get = async (id) => (await engine.get(id)).data;

// the SNAPSHOT DISCIPLINE (what the viewer + harness will do every time)
async function snapshot() {
  const bt = await get('bt.run');        // pricing engine (fresh by patch-12)
  const bnh = await get('bnh.run');      // control group
  const wf = await get('wf.report');     // walk-forward
  const art = await get('art.equity');   // glass
  const met = {
    ret: await get('met.ret'), sharpe: await get('met.sharpe'), maxdd: await get('met.maxdd'),
    trades: await get('met.trades'), wf: await get('met.wf'), bnh_ret: await get('met.bnh_ret'),
  };
  return { bt, bnh, wf, art, met };
}

let s = await snapshot();
console.log('1) initial: sharpe', s.met.sharpe?.toFixed(4), '| wf', s.met.wf, '| bnh_ret', s.met.bnh_ret?.toFixed(4));
console.log('   art.desk:', s.art.desk?.slice(0, 40));
console.log('   consistency: met.sharpe === bt.metrics.sharpe ?', s.met.sharpe === s.bt.metrics.sharpe);

// nudge: ONE value push re-prices the whole desk
await engine.set('p.fast', 21);
s = await snapshot();
console.log('2) after p.fast 8→21: sharpe', s.met.sharpe?.toFixed(4), '| trades', s.met.trades, '| bt.params.fast', s.bt.params.fast);
console.log('   consistency:', s.met.sharpe === s.bt.metrics.sharpe, '| ret changed:', s.met.ret !== 0.0056);

// strategy switch
await engine.set('p.strategy', 'rsi_reversion');
s = await snapshot();
console.log('3) rsi_reversion: sharpe', s.met.sharpe?.toFixed(4), '| trades', s.met.trades, '| strategy', s.bt.strategy);

// trainer: promotion must re-price the desk through the reactive graph
await engine.set('p.strategy', 'sma_cross');
await engine.set('p.fast', 8);
s = await snapshot();
const beforeOOS = s.wf.oos_m.sharpe;
const t = await engine.call('ai.trainer', { gens: 20, seed: 11 });
s = await snapshot();
console.log('4) trainer gens=20 kept=' + t.data.kept, '| champion oos_score', t.data.champion.oos_score?.toFixed(3));
console.log('   desk now: strategy', s.bt.strategy, 'fast', s.bt.params.fast, 'slow', s.bt.params.slow, '| oos.sharpe', s.wf.oos_m.sharpe?.toFixed(2), '(was', beforeOOS?.toFixed(2) + ')');
console.log('   wf verdict:', s.met.wf, '|', s.wf.why?.slice(0, 90));
console.log('   flash:', (await get('desk.flash')).text?.slice(0, 110));
const led = await get('ai.ledger');
console.log('   ledger:', led.length, 'rows; kinds:', led.map(r => r.kind[0].toUpperCase()).join(''));
console.log('   chain:', (await get('ai.chaincheck')).ok);
