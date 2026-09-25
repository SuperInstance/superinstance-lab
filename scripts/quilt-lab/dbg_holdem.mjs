// debug: play one holdem hand verbosely
import { QuiltEngine } from '/home/z/my-project/download/quilt-arcade/engine/index.js';
import { buildSheet } from '/home/z/my-project/download/quilt-arcade/games/holdem/sheet.mjs';
import { mulberry32 } from '/home/z/my-project/download/quilt-arcade/shared/kit.mjs';

const engine = new QuiltEngine('dbg-holdem', { eager: true });
engine.loadSheet(buildSheet());
const get = async (id) => (await engine.get(id)).data;

await engine.call('new_match');
const deal = (await engine.call('deal.hand', { seed: 101 })).data;
console.log('deal:', JSON.stringify(deal).slice(0, 200));
const rng = mulberry32(101 * 7919 + 13);
for (let i = 0; i < 60; i++) {
  const phase = await get('hand.phase');
  if (phase !== 'play') { console.log('PHASE', phase); break; }
  const street = await get('street.current');
  const toAct = await get('to.act');
  const pending = await get('pending.list');
  const bets = [await get('bets.p0'), await get('bets.p1'), await get('bets.p2')];
  const stacks = [await get('stacks.p0'), await get('stacks.p1'), await get('stacks.p2')];
  const step = (await engine.call('match.step', { seed: 1 + Math.floor(rng() * 1e9), log: true })).data;
  const bets2 = [await get('bets.p0'), await get('bets.p1'), await get('bets.p2')];
  const pending2 = await get('pending.list');
  console.log(`#${i} ${street} P${toAct} pending=[${pending}] bets=[${bets}] stk=[${stacks}] -> ${JSON.stringify(step).slice(0, 110)} | after: bets=[${bets2}] pending=[${pending2}] to.act=${await get('to.act')}`);
  if (step?.wait) { console.log('WAIT'); break; }
}
