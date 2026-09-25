// debug 4: instrument the frozen loop — match.seq, pot, log growth per action
import { QuiltEngine } from '/home/z/my-project/download/quilt-arcade/engine/index.js';
import { buildSheet } from '/home/z/my-project/download/quilt-arcade/games/holdem/sheet.mjs';
import { mulberry32 } from '/home/z/my-project/download/quilt-arcade/shared/kit.mjs';

const engine = new QuiltEngine('dbg-holdem4', { eager: true });
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
}
console.log('bad:', JSON.stringify(bad));
await engine.call('new_match');
const seed = bad.seed;
const deal = (await engine.call('deal.hand', { seed })).data;
console.log('deal ok:', deal.ok, 'hand', deal.hand);
const rng = mulberry32(seed * 7919 + 13);
for (let i = 0; i < 8; i++) {
  if ((await get('hand.phase')) !== 'play') break;
  const before = {
    seq: await get('match.seq'), pot: await get('pot.total'),
    bets: [await get('bets.p0'), await get('bets.p1'), await get('bets.p2')],
    stacks: [await get('stacks.p0'), await get('stacks.p1'), await get('stacks.p2')],
    logLen: ((await get('log.events')) ?? []).length,
    toAct: await get('to.act'),
  };
  const step = (await engine.call('match.step', { seed: 1 + Math.floor(rng() * 1e9), log: true })).data;
  const after = {
    seq: await get('match.seq'), pot: await get('pot.total'),
    bets: [await get('bets.p0'), await get('bets.p1'), await get('bets.p2')],
    stacks: [await get('stacks.p0'), await get('stacks.p1'), await get('stacks.p2')],
    logLen: ((await get('log.events')) ?? []).length,
    toAct: await get('to.act'),
  };
  console.log(`#${i} BEFORE ${JSON.stringify(before)}`);
  console.log(`     STEP   ${JSON.stringify(step)?.slice(0, 120)}`);
  console.log(`     AFTER  ${JSON.stringify(after)}`);
}
