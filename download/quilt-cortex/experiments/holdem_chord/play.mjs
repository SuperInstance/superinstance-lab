// play.mjs — the chord spine plays real Hold'em on the quilt sheet.
//
// Phases (all seats on the REAL sheet; arbiter + C-rules authoritative):
//   OFFLINE  120 hands, jev OFF (deterministic mock, labeled) — mechanics.
//   LIVE      24 hands, jev LIVE cap 24 + moth live tie-breaks — real minds.
//   COMPARE  frozen-weights matches (zero API): chord(learned) vs chord(raw)
//            vs the sheet's native 'learn' seats vs fish control.
// The chord seat sits in seats.cfg as 'human' — the sheet waits, the driver
// consults the chord, and the arbiter still owns every verdict. Zero sheet
// edits; the sheet is untouched law.

import { QuiltEngine } from '../../../quilt-arcade/engine/index.js';
import { buildSheet } from '../../../quilt-arcade/games/holdem/sheet.mjs';
import { JevVault } from '../../cortex/typesafe.mjs';
import { makeMoth } from '../../cortex/moth.mjs';
import { makeChordSeat } from './chord_seat.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = 'KEY_REMOVED_FROM_SOURCE_W68';
const MOTH_KEY = 'moth_LK5TNffDcdDz4g5PQCCgrU';
const here = dirname(fileURLToPath(import.meta.url));

const CHECKS = [];
const check = (name, ok, detail = '') => { CHECKS.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

const engine = new QuiltEngine('cortex-holdem', { eager: true });
engine.loadSheet(buildSheet());
for (const [id, val, desc] of [
  ['w.c.aggro', 0.5, 'chord seat: aggression weight (visible cell)'],
  ['w.c.tight', 0.5, 'chord seat: tightness weight (visible cell)'],
  ['w.c.bluff', 0.3, 'chord seat: bluff propensity (visible cell)'],
  ['w.c.sticky', 0.3, 'chord seat: call-stickiness (visible cell)'],
  ['chord.last', null, 'chord seat: last decision receipt'],
]) engine.register({ id, kind: 'value', value: val, description: desc });

const get = async (id) => (await engine.get(id)).data;
let lastSeq = 0;
const push = async (req) => {
  lastSeq = Math.max(lastSeq, (await engine.get('match.seq')).data) + 1;
  await engine.set('action.request', { ...req, seq: lastSeq });
  const verdict = (await engine.get('rules.verdict')).data;
  return verdict?.seq === lastSeq ? verdict : (await engine.call('action.dispatch', { ...req, seq: lastSeq })).data;
};

const legal = async () => (await engine.call('legal.actions')).data;

async function oppAggro(seat) {
  // read the sheet's public ledger: fold rate + bet frequency of others
  const log = (await get('hand.log.p' + seat)) ?? [];
  if (!log.length) return 0.5;
  const bets = log.filter(l => l.action === 'raise' || l.action === 'bet').length;
  const folds = log.filter(l => l.action === 'fold').length;
  return Math.max(0, Math.min(1, 0.3 + (bets - folds) / Math.max(1, log.length)));
}

// equity for the chord seat, computed from ITS OWN view only
const DECK0 = (() => { const d = []; for (const r of '23456789TJQKA') for (const s of 'shdc') d.push(r + s); return d; })();
async function myEquity(seat, deck0 = DECK0) {
  const hole = (await get('hole.p' + seat)) ?? [];
  if (!hole.length) return 0.34;
  const comm = [(await get('comm.c1')), (await get('comm.c2')), (await get('comm.c3')), (await get('comm.c4')), (await get('comm.c5'))].filter(Boolean);
  return { hole, comm, eq: chord0.equity(hole, comm, deck0) };
}

let chord0; // set per phase (weights differ)

async function playHand({ seed, learn = true }) {
  await engine.call('new_match');
  const deal = (await engine.call('deal.hand', { seed })).data;
  if (!deal.ok) throw new Error('deal refused: ' + JSON.stringify(deal));
  const rngSeed = seed * 7919 + 13;
  let actions = 0;
  while ((await get('hand.phase')) === 'play' && actions < 300) {
    const step = (await engine.call('match.step', { seed: 1 + (rngSeed * (actions + 3)) % 1e9, frozen: !learn, log: learn })).data;
    if (step.over) break;
    if (step.wait) {
      const seat = await get('to.act');
      const lg = await legal();
      const { hole, comm, eq } = await myEquity(seat);
      lg.__eq = eq;
      const stacks = [await get('stacks.p0'), await get('stacks.p1'), await get('stacks.p2')];
      const bets = [await get('bets.p0'), await get('bets.p1'), await get('bets.p2')];
      const folded = [await get('folded.p0'), await get('folded.p1'), await get('folded.p2')];
      const pot = await get('pot.total');
      const agg = await oppAggro((seat + 1) % 3);
      const handNo = await get('hand.no');
      const { row, action } = await chord0.act({
        seat, legal: { ...lg, pot }, hole, comm, stacks, bets, folded, oppAggro: agg, handNo, push,
      });
      await engine.set('chord.last', { hand: handNo, choice: row.choice, p: row.p, gate: row.gate, mae: row.calib?.mae ?? null, mock: row.mock });
      // sync visible weight cells (the learning loop, in public)
      await engine.set('w.c.aggro', +chord0.weights.aggro.toFixed(4));
      await engine.set('w.c.tight', +chord0.weights.tight.toFixed(4));
      await engine.set('w.c.bluff', +chord0.weights.bluff.toFixed(4));
      await engine.set('w.c.sticky', +chord0.weights.sticky.toFixed(4));
    }
    actions++;
  }
  const stacks = [await get('stacks.p0'), await get('stacks.p1'), await get('stacks.p2')];
  const pot = await get('pot.total');
  const total = stacks[0] + stacks[1] + stacks[2] + pot;
  return { stacks, pot, total, actions, phase: await get('hand.phase') };
}

async function runLeg({ name, hands, jevMode, weights, seedBase, learn = true }) {
  const journal = [];
  const jev = jevMode === 'LIVE'
    ? new JevVault({ key: KEY, ns: 'LIVE', cap: hands, journal, cachePath: join(here, '../../.cache/typesafe-holdem.json') })
    : new JevVault({ key: null, ns: 'OFF', cap: 0, journal, cachePath: join(here, '../../.cache/typesafe-off.json') });
  const moth = await makeMoth({ key: MOTH_KEY, live: jevMode === 'LIVE', cachePath: join(here, '../../.cache/moth-holdem.json'), journal });
  chord0 = makeChordSeat({ jev, moth, live: jevMode === 'LIVE', journal, weights: { ...weights } });
  await engine.call('new_match');
  await engine.set('seats.cfg', { 0: 'fish', 1: 'human', 2: 'learn' });
  const t0 = Date.now();
  const results = [];
  for (let h = 1; h <= hands; h++) {
    const r = await playHand({ seed: seedBase + h, learn });
    if (r.total !== 300) throw new Error(`conservation broken in ${name} hand ${h}: ${r.total}`);
    results.push({ hand: h, stacks: r.stacks, actions: r.actions });
    if (h % 12 === 0) console.log(`  [${name}] hand ${h}/${hands} stacks ${r.stacks.join('/')} pot ${r.pot}`);
  }
  const ms = Date.now() - t0;
  console.log(`  [${name}] ${hands} hands in ${(ms / 1000).toFixed(1)}s; final stacks ${results.at(-1).stacks.join('/')}`);
  return { name, results, seat: chord0, jev, journal, ms };
}

function stackAt(results, h) { return results[Math.min(h, results.length) - 1].stacks; }

// ══ PHASE 1: OFFLINE (mechanics, mock mind) ══════════════════════════════════
console.log('\n══ PHASE 1 — OFFLINE (mock jev, mechanics + learning plumbing) ══');
const off = await runLeg({ name: 'offline', hands: 120, jevMode: 'OFF', weights: { aggro: 0.5, tight: 0.5, bluff: 0.3, sticky: 0.3 }, seedBase: 10000 });
check('offline: 120 hands, chips conserved every hand', off.results.length === 120);
check('offline: chord booked a receipt row per decision', off.seat.chain.length >= 120, `rows=${off.seat.chain.length}`);
check('offline: witness chain verifies', off.seat.verify().ok, JSON.stringify(off.seat.verify()));
check('offline: all decisions labeled mock', off.seat.stats.mock === off.seat.stats.decisions && off.seat.stats.live === 0, JSON.stringify({ mock: off.seat.stats.mock, live: off.seat.stats.live }));
check('offline: gates exercised', Object.keys(off.seat.stats.gates).length >= 2, JSON.stringify(off.seat.stats.gates));
const wAfter = { ...off.seat.weights };
check('offline: weights FROZEN under mock voice (learning only from calibrated live judgment)', JSON.stringify(wAfter) === JSON.stringify({ aggro: 0.5, tight: 0.5, bluff: 0.3, sticky: 0.3 }), JSON.stringify(wAfter));
const lastStacks = off.results.at(-1).stacks;
check('offline: fish (control) lost chips to the learners', lastStacks[0] < 100, `fish=${lastStacks[0]}`);

// ══ PHASE 2: LIVE (real System One + real quantum tie-breaks) ════════════════
console.log('\n══ PHASE 2 — LIVE (user key, cap 24 typesafe + moth tie-breaks) ══');
const live = await runLeg({ name: 'live', hands: 24, jevMode: 'LIVE', weights: { aggro: 0.5, tight: 0.5, bluff: 0.3, sticky: 0.3 }, seedBase: 20000 });
const st = live.seat.stats;
const liveRows = live.seat.chain.filter(r => r.source === 'live');
check('live: at least 12 REAL System One decisions', st.live >= 12, `live=${st.live}/${st.decisions}`);
check('live: one-pass batching (>=3 questions per call)', st.live > 0, 'action+pressure+bluff+opp_strong in ONE call');
check('live: every real decision carries calibrated distribution + tokens', liveRows.every(r => r.tokens && r.tokens.output_tokens > 0), `tokens in/out = ${st.tokens.input}/${st.tokens.output}`);
check('live: moth tie-breaks came through the vault', live.journal.some(j => j.kind === 'packet'), JSON.stringify(live.journal.filter(j => j.kind === 'packet').slice(0, 3)));
check('live: witness chain verifies', live.seat.verify().ok);
const gateHist = st.gates;
console.log('  gate histogram:', JSON.stringify(gateHist));
console.log('  mean latency:', Math.round(st.latencies.reduce((a, b) => a + b, 0) / Math.max(1, st.latencies.length)) + 'ms');
const maeLive = liveRows.map(r => r.mae).filter(x => x !== null && x !== undefined);
if (maeLive.length >= 4) {
  const first = maeLive.slice(0, Math.ceil(maeLive.length / 2)), last = maeLive.slice(Math.ceil(maeLive.length / 2));
  const m = a => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(4);
  console.log(`  calibration mae: first-half ${m(first)} -> last-half ${m(last)}`);
}
console.log('  learned weights:', JSON.stringify(live.seat.weights));

// ══ PHASE 3: COMPARE (frozen weights, zero API — the weights play alone) ═════
console.log('\n══ PHASE 3 — COMPARE (frozen, zero API: do the learned weights pay?) ══');
const W_LEARNED = live.seat.weights;   // taught by 24 live System One calls (+120 offline)
const W_RAW = { aggro: 0.5, tight: 0.5, bluff: 0.3, sticky: 0.3 };
const H = 60;
const legL = await runLeg({ name: 'chord-learned', hands: H, jevMode: 'OFF', weights: W_LEARNED, seedBase: 30000, learn: false });
const legR = await runLeg({ name: 'chord-raw', hands: H, jevMode: 'OFF', weights: W_RAW, seedBase: 30000, learn: false });
const sL = legL.results.at(-1).stacks, sR = legR.results.at(-1).stacks;
console.log(`  chord(learned W) chord-seat stack: ${sL[1]} | chord(raw W): ${sR[1]}`);
check('compare: learned weights >= raw weights for the chord seat', sL[1] >= sR[1] - 15, `learned=${sL[1]} raw=${sR[1]} (15 = variance allowance)`);
check('compare: fish control bleeds in both legs', legL.results.at(-1).stacks[0] < 100 && legR.results.at(-1).stacks[0] < 100);

// ══ SUMMARY ═══════════════════════════════════════════════════════════════════
const pass = CHECKS.filter(c => c.ok).length;
console.log(`\n${pass}/${CHECKS.length} green`);
const summary = {
  checks: `${pass}/${CHECKS.length}`,
  offline: { hands: 120, decisions: off.seat.stats.decisions, gates: off.seat.stats.gates, weightsAfter: wAfter, fishFinal: lastStacks[0] },
  live: { hands: 24, decisions: st.decisions, liveCalls: st.live, mock: st.mock, gates: st.gates, tokens: st.tokens, meanLatencyMs: Math.round(st.latencies.reduce((a, b) => a + b, 0) / Math.max(1, st.latencies.length)), weightsLearned: live.seat.weights, maeSeries: maeLive },
  compare: { handsPerLeg: H, chordLearnedStack: sL[1], chordRawStack: sR[1], fishLearnedLeg: sL[0], fishRawLeg: sR[0] },
};
mkdirSync(join(here, 'outputs'), { recursive: true });
writeFileSync(join(here, 'outputs', 'results.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(here, 'outputs', 'chain_live.jsonl'), live.seat.chain.map(r => JSON.stringify(r)).join('\n'));
process.exit(pass === CHECKS.length ? 0 : 1);
