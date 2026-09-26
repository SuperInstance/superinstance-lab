// smoke_live.mjs — ONE live chord verdict (1 typesafe call, 0 moth calls).
import { JevVault } from './cortex/typesafe.mjs';
import { makeChord, offlineReviewer } from './cortex/chord.mjs';
import { makeMoth } from './cortex/moth.mjs';
import { verifyChain } from './cortex/receipts.mjs';

const KEY = 'KEY_REMOVED_FROM_SOURCE_W68';
const journal = [];
const jev = new JevVault({ key: KEY, ns: 'LIVE', cap: 1, journal, cachePath: new URL('.cache/typesafe-LIVE.json', import.meta.url).pathname });
const moth = await makeMoth({ live: false, journal });
const chord = makeChord({ jev, moth, glm: offlineReviewer(), journal });

const row = await chord.chordVerdict({
  state: "Heads-up. Board Ks 7d 2c. Opponent (loose-aggressive, has bluffed twice this session) led out small on the flop after flat-calling preflop. We hold Ac Kd (top pair, top kicker). Pot 240, we both have 900 behind.",
  instructions: 'Pick the best action on this flop.',
  criteria: { check: 'pot control against a likely draw-heavy range', bet_small: 'info stab, keep marginal hands in', bet_big: 'charge draws and worse kings', fold: 'give up now' },
  tag: 'chord-live-1', ownDist: { check: 0.3, bet_small: 0.35, bet_big: 0.3, fold: 0.05 },
});

console.log('choice:', row.choice, 'p:', row.p, 'gate:', row.gate, 'tiebreak:', row.tiebreak ? JSON.stringify(row.tiebreak) : '-', 'source:', row.source, 'latency:', row.latency_ms + 'ms', 'tokens:', JSON.stringify(row.tokens));
console.log('dist:', JSON.stringify(row.dist));
console.log('calibration mae vs our weights:', row.calib.mae, JSON.stringify(row.calib.delta));
console.log('chain verify:', JSON.stringify(verifyChain(chord.chain)));
console.log('journal:', journal.map(j => j.kind + ':' + (j.source || j.gate || '')).join(' | '));
jev.persist();
