// debug: replicate the exact learning loop (hand + learn.update) and catch the hang
import { QuiltEngine } from '/home/z/my-project/download/quilt-arcade/engine/index.js';
import { buildSheet } from '/home/z/my-project/download/quilt-arcade/games/holdem/sheet.mjs';
import { mulberry32 } from '/home/z/my-project/download/quilt-arcade/shared/kit.mjs';

const engine = new QuiltEngine('dbg-holdem3', { eager: true });
engine.loadSheet(buildSheet());
const get = async (id) => (await engine.get(id)).data;

await engine.call('new_match');
let bad = null;
for (let h = 1; h <= 150 && !bad; h++) {
  const seed = 10000 + h * 17;
  await engine.call('deal.hand', { seed });
  const rng = mulberry32(seed * 7919 + 13);
  for (let i = 0; i < 300; i++) {
    if ((await get('hand.phase')) !== 'play') break;
    const step = (await engine.call('match.step', { seed: 1 + Math.floor(rng() * 1e9), log: true })).data;
    if (step?.wait) break;
    if (i === 299 && (await get('hand.phase')) === 'play') bad = { h, seed };
  }
  for (const seat of [1, 2]) await engine.call('learn.update', { seat });
  if (h % 25 === 0) {
    const s = [await get('stacks.p0'), await get('stacks.p1'), await get('stacks.p2')];
    console.log('hands', h, 'stacks', s.join('/'), 'W1.aggro', await get('W.p1.aggro'));
  }
}
if (!bad) { console.log('ALL TERMINATE (with learning)'); process.exit(0); }
console.log('NON-TERMINATING at hand', bad.h, 'seed', bad.seed);
await engine.call('new_match');
await engine.call('deal.hand', { seed: bad.seed });
const rng = mulberry32(bad.seed * 7919 + 13);
const tail = [];
for (let i = 0; i < 300; i++) {
  if ((await get('hand.phase')) !== 'play') { console.log('ended at', i); break; }
  const street = await get('street.current');
  const toAct = await get('to.act');
  const pending = await get('pending.list');
  const bets = [await get('bets.p0'), await get('bets.p1'), await get('bets.p2')];
  const stacks = [await get('stacks.p0'), await get('stacks.p1'), await get('stacks.p2')];
  const allin = [await get('allin.p0'), await get('allin.p1'), await get('allin.p2')];
  const step = (await engine.call('match.step', { seed: 1 + Math.floor(rng() * 1e9), log: true })).data;
  tail.push(`#${i} ${street} P${toAct} pend=[${pending}] bets=[${bets}] stk=[${stacks}] allin=[${allin}] -> ${JSON.stringify(step)?.slice(0, 100)} | after pend=[${await get('pending.list')}] to.act=${await get('to.act')}`);
}
for (const t of tail.slice(-30)) console.log(t);
