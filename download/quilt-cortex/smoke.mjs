// smoke.mjs — offline playtest of the full cortex spine (zero live calls).
// Verifies: jev vault mock path + namespaces, one-pass batch, ai-cell bridge,
// chord gates (fast-accept / flagged / escalated / tie-broken), calibration
// delta, witness chain integrity.

import { JevVault, calibrationDelta } from './cortex/typesafe.mjs';
import { makeChord, offlineReviewer } from './cortex/chord.mjs';
import { makeMoth } from './cortex/moth.mjs';
import { jevBatchCell, jevChoiceCell } from './cortex/cells.mjs';
import { verifyChain } from './cortex/receipts.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHECKS = [];
function check(name, ok, detail = '') {
  CHECKS.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const tmp = mkdtempSync(join(tmpdir(), 'cortex-smoke-'));

// ---- 1. vault mock path + batch ---------------------------------------------
const journal = [];
const jev = new JevVault({ key: null, ns: 'OFF', cap: 0, journal, cachePath: join(tmp, 'jev.json') });
const q = {
  action: { type: 'choice', instructions: 'best action on this flop?', criteria: { check: 'pot control', bet_small: 'stab', bet_big: 'charge', fold: 'give up' } },
  aggro: { type: 'score', instructions: 'how aggressive?', criteria: ['passive', 'neutral', 'aggressive'] },
  strong: { type: 'noul', instructions: 'does opp have top pair?' },
};
const r1 = await jev.decide('Board Ks 7d 2c, opp led small.', q, { tag: 'smoke-batch' });
check('mock batch answers all 3 questions', r1.answers.action && r1.answers.aggro && r1.answers.strong, `sources=${r1.source} mock=${r1.mock}`);
const r2 = await jev.decide('Board Ks 7d 2c, opp led small.', q, { tag: 'smoke-batch' });
check('cache hit on identical payload', r2.source === 'cache');
check('deterministic mock', JSON.stringify(r1.answers) === JSON.stringify(r2.answers));

// ---- 2. ai-cell bridge --------------------------------------------------------
const engine = jev.makeEngine();
const cell = jevBatchCell({ id: 'decide', state: 'Board Ks 7d 2c, opp led small.', questions: q, tag: 'smoke-cell' });
const batchVal = await engine.call(cell);
check('bridge: jev.batch returns answers map', batchVal && batchVal.action && batchVal.aggro && batchVal.strong);
const cell2 = jevChoiceCell({ id: 'pick', state: 's', instructions: 'pick one', criteria: { a: 'x', b: 'y' } });
const choiceVal = await engine.call(cell2);
check('bridge: jev.choice sugar returns single answer', choiceVal && choiceVal.choice && choiceVal.probabilities);

// ---- 3. chord gates -----------------------------------------------------------
const moth = await makeMoth({ live: false, journal });
const chord = makeChord({ jev, moth, glm: offlineReviewer(), chain: [], journal });
// force distributions: craft states so mock hash lands in each gate band
const gates = new Set();
for (let i = 0; i < 40; i++) {
  const row = await chord.chordVerdict({
    state: `gate probe ${i} ${'x'.repeat(i % 7)}`,
    instructions: 'choose', criteria: { alpha: 'a', beta: 'b', gamma: 'g' },
    tag: `gate-${i}`, ownDist: { alpha: 0.5, beta: 0.3, gamma: 0.2 },
  });
  gates.add(row.gate);
  if (!row.dist || !row.choice) { check(`chord row ${i} well-formed`, false); break; }
}
check('chord exercises multiple gate paths', gates.size >= 2, `gates seen: ${[...gates].join(', ')}`);
check('chord booked rows with calibration', chord.chain.length === 40 && chord.chain.every(r => r.calib && r.state_hash));

// ---- 4. calibration delta ------------------------------------------------------
const cd = calibrationDelta({ check: 0.4, bet: 0.6 }, { check: 0.7, bet: 0.3 });
check('calibration delta math', cd.delta.check === 0.3 && cd.delta.bet === -0.3 && cd.mae === 0.3);

// ---- 5. witness chain ----------------------------------------------------------
const v = verifyChain(chord.chain);
check('witness chain verifies', v.ok, `links=${v.links}`);
// tamper
chord.chain[10].choice = 'TAMPERED';
const v2 = verifyChain(chord.chain);
check('tamper detected at exact row', !v2.ok && v2.at === 11, JSON.stringify(v2));

// ---- 6. namespace separation ----------------------------------------------------
const live = new JevVault({ key: 'k', ns: 'LIVE', cap: 0 });
const a1 = await live.decide('same state', { x: { type: 'noul', instructions: 'same q' } }, { tag: 'ns' });
check('LIVE vault with no key degrades to mock', a1.mock === true);

rmSync(tmp, { recursive: true, force: true });
const pass = CHECKS.filter(c => c.ok).length;
console.log(`\n${pass}/${CHECKS.length} green`);
process.exit(pass === CHECKS.length ? 0 : 1);
