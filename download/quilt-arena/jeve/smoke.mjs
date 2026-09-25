// quick smoke: boot JEVE sheet, probe steps, mock seam, tiny 2-seat set piece
import { QuiltEngine } from '../engine/index.js';
import { buildJeveSheet, buildSeamState, buildSeamQuestions, seamAnswerToTeachInput, HYPS } from './mind.mjs';
import { JevVault } from '../../quilt-cortex/cortex/typesafe.mjs';
import { mulberry32, verifyChain } from '../shared/kit.mjs';
import { Arena5 } from './arena5.mjs';
import { AnalystAI } from '../arena/tournament.mjs';

const e = new QuiltEngine('smoke-jeve', { eager: false });
await e.loadSheet(buildJeveSheet('p0'));
console.log('cells:', e.cells.size);
console.log('mw.avoid =', (await e.get('mw.avoid')).data, ' st.social =', (await e.get('st.social')).data);

async function callProbe(id, input) {
  const r = await e.call(id, input);
  if (r && r.status === 'error') throw new Error(`${id}: ${r.error?.message ?? JSON.stringify(r.error)}`);
  return r ? r.data : undefined;
}

// 3 probe steps + one seam
const FEATURE_KEYS = ['adj', 'adjSum', 'front', 'info', 'dens', 'center', 'avoid', 'winp', 'pts', 'high', 'trickPts', 'lead', 'voidp', 'aggr'];
const WSTAR = { adj: 2.2, adjSum: 0.8, front: 0.4, info: 0.2, dens: 1.0, center: 0.3, avoid: 1.6 };
const rng = mulberry32(3000);
const sc = (f, w) => FEATURE_KEYS.reduce((a, k) => a + (w[k] ?? 0) * (f[k] ?? 0), 0);
for (let step = 0; step < 3; step++) {
  const cands = Array.from({ length: 6 }, () => Object.fromEntries(FEATURE_KEYS.map((k) => [k, +rng().toFixed(3)])));
  const ids = cands.map((_, i) => `c${i}`);
  const feats = {}; ids.forEach((id, i) => { feats[id] = cands[i]; });
  const scores = cands.map((f) => sc(f, WSTAR));
  const m = Math.max(...scores);
  const ps = scores.map((s) => Math.exp((s - m) / 0.4));
  const z = ps.reduce((a, b) => a + b, 0);
  const pDist = ps.map((x) => x / z);
  let u = rng(), k = 0; while (k < 5 && u > pDist[k]) { u -= pDist[k]; k++; }
  const picked = ids[k];
  const pred = await callProbe('inf.predict', { game: 'mines', mover: 'p1', feats });
  await callProbe('inf.update', { game: 'mines', mover: 'p1', feats, picked, lastPredict: pred?.pick, oppNames: ['p1'], obs: { risk: 0.3 } });
  console.log(`step ${step}: predicted ${pred?.pick} actual ${picked} top-hyp ${(await e.get('inf.p1')).data && Object.entries((await e.get('inf.p1')).data.post).sort((a, b) => b[1] - a[1])[0].map((x, i) => i ? x.toFixed(3) : x).join('=')}`);
}
const model = (await e.get('inf.p1')).data;
console.log('model keys:', Object.keys(model).join(','), 'n=', model.n, 'H=', model.H);
console.log('m.w =', JSON.stringify(Object.fromEntries(Object.entries(model.w).filter(([k]) => ['adj', 'adjSum', 'avoid', 'dens'].includes(k)).map(([k, v]) => [k, +v.toFixed(2)]))));

const jev = new JevVault({ key: null, ns: 'OFF', cap: 24, cachePath: null, journal: [] });
const state = buildSeamState({ aid: 'p0', scriptV: 1, setNo: 'smoke', budgetN: 0, letter: 'P', focal: 'p1', model, styles: { greed: 0.12, fear: 0.18, curiosity: 0.22, social: 0.24, patience: 0.05 }, spendRatio: 0, mothLeft: 0 });
const questions = buildSeamQuestions({ focal: 'p1', model, mothLeft: 0 });
console.log('state chars:', state.length, '| questions:', Object.keys(questions).join(','));
const t0 = Date.now();
const { answers, source, mock } = await jev.decide(state, questions, { tag: 'smoke' });
console.log('decide:', source, 'mock=' + mock, 'ms=', Date.now() - t0);
console.log('family dist:', JSON.stringify(answers.family.probabilities));
console.log('fit_H2:', JSON.stringify(answers.fit_H2));
console.log('drift:', answers.drift?.noul, 'explore:', answers.explore?.noul);
const tin = seamAnswerToTeachInput(answers);
const res = await callProbe('jev.teach', { mover: 'p1', ...tin, source, mock });
console.log('teach: mae=', res.mae, 'lam=', res.lam, 'tv=', res.tv, 'flipped=', res.flipped, 'beta=', res.beta);
console.log('post after teach:', JSON.stringify(res.post));
console.log('jev.explore now:', (await e.get('jev.explore')).data, 'calls:', (await e.get('jev.calls')).data);
const chain = (await e.get('jev.chain')).data;
console.log('jev.chain verifies:', JSON.stringify(verifyChain(chain, (r) => ({ seq: r.seq, mover: r.mover, v: r.v, dist: r.dist, mae: r.mae, lam: r.lam, drift: r.drift, explore: r.explore, source: r.source, mock: r.mock, prev_hash: r.prev_hash }))));

// tiny set piece: boot a 5-seat arena and play ONE mines duel + check styles
const arena = new Arena5({ vault: { packet: async () => ({ floats: Array.from({ length: 32 }, (_, i) => (i * 37 % 100) / 100), mock: true, source: 'smoke' }) }, analyst: new AnalystAI({ mock: true }), ledger: [], jev, seamPoints: ['end'] });
await arena.boot();
const budget = { left: { p0: 0, p1: 0, p2: 0, p3: 0, p4: 0 }, spent: {}, setNo: 99 };
const rec = await arena.playMines(['p0', 'p4'], mulberry32(7), budget, { learn: true, firstMove: 'first' });
console.log('duel p0 vs p4:', rec.scoreA, rec.scoreB, 'turns:', rec.turns.length);
console.log('SMOKE OK');
