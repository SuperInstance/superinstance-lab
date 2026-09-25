// smoke: boot arena, play one mines duel + one hearts trio (offline, learn on)
import { Arena, AnalystAI } from './tournament.mjs';
import { MothVault } from './moth.mjs';

const vault = new MothVault({ key: null, live: false, cachePath: null });
const arena = new Arena({ vault, analyst: new AnalystAI({ mock: true }) });
await arena.boot();
console.log('booted 4 minds');

const { mulberry32 } = await import('../shared/kit.mjs');
const rng = mulberry32(7);

const budget = { left: { p0: 2, p1: 2, p2: 2, p3: 2 }, spent: {}, setNo: 0 };
const mrec = await arena.playMines(['p0', 'p1'], rng, budget, { learn: true });
console.log('mines ok: scoreA', mrec.scoreA, 'scoreB', mrec.scoreB, 'turns', mrec.turns.length);

const hrec = await arena.playHearts(['p0', 'p1', 'p2'], rng, budget, { learn: true });
console.log('hearts ok: totals', hrec.totals.join('/'), 'tricks', hrec.tricks.length);

const set = await arena.runSet(1, 2, { learn: true });
console.log('set ok: standings', set.standings.map(([a, m]) => `${a}:${m.toFixed(1)}`).join(' '),
  'spent', JSON.stringify(set.spent), 'revisions', Object.keys(set.revisions).length);
console.log('sample revision p0:', JSON.stringify(set.revisions.p0).slice(0, 160));
