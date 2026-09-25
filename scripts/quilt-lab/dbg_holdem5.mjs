// debug 5: reproduce the C6 cap refusal inside the learning loop
import { QuiltEngine } from '/home/z/my-project/download/quilt-arcade/engine/index.js';
import { buildSheet } from '/home/z/my-project/download/quilt-arcade/games/holdem/sheet.mjs';
import { mulberry32 } from '/home/z/my-project/download/quilt-arcade/shared/kit.mjs';

const engine = new QuiltEngine('dbg-holdem5', { eager: true });
engine.loadSheet(buildSheet());
const get = async (id) => (await engine.get(id)).data;

await engine.call('new_match');
outer:
for (let h = 1; h <= 150; h++) {
  const seed = 10000 + h * 17;
  await engine.call('deal.hand', { seed });
  const rng = mulberry32(seed * 7919 + 13);
  for (let i = 0; i < 300; i++) {
    if ((await get('hand.phase')) !== 'play') break;
    const step = (await engine.call('match.step', { seed: 1 + Math.floor(rng() * 1e9), log: true })).data;
    if (step?.wait) break;
    if (step?.ok === false) {
      console.log(`HAND ${h} action ${i}: REFUSED`, JSON.stringify(step));
      console.log('  street', await get('street.current'), 'cap', await get('allin.cap'));
      console.log('  bets', [await get('bets.p0'), await get('bets.p1'), await get('bets.p2')],
        'stacks', [await get('stacks.p0'), await get('stacks.p1'), await get('stacks.p2')]);
      console.log('  C5 verdict', JSON.stringify(await get('rule.C5.verdict')));
      console.log('  C6 verdict', JSON.stringify(await get('rule.C6.verdict')));
      break outer;
    }
  }
  for (const seat of [1, 2]) await engine.call('learn.update', { seat });
}
console.log('done');
