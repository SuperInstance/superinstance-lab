// chord_seat.mjs — the chord spine plugged into the holdem sheet as a seat.
//
// Doctrine mapping (quilt-cortex/chord.mjs):
//   - mechanical odds (equity, pot odds) are computed LOCALLY — zero tokens
//   - ONE typesafe batch call per decision: action choice + pressure score +
//     bluff noul + opp_strong noul (the one-pass System One surface)
//   - the chord gates: fast-accept / flagged / escalated / tie-broken
//   - calibration delta (jev dist - own dist) nudges VISIBLE weight cells
//   - every hand books a witness row (fnv1a64 chain)

import { makeChord, offlineReviewer } from '../../cortex/chord.mjs';
import { calibrationDelta } from '../../cortex/typesafe.mjs';
import { fnv1a64, sealChain, verifyChain } from '../../cortex/receipts.mjs';

// ── local evaluator (independent, compact — mechanical odds cost 0 tokens) ──
const RANKS = '23456789TJQKA';
function score5(cards) {
  const vals = cards.map(c => RANKS.indexOf(c[0]) + 2);
  const flush = cards.every(c => c[1] === cards[0][1]);
  const distinct = [...new Set(vals)].sort((x, y) => y - x);
  let straight = 0;
  if (distinct.length === 5) {
    if (distinct[0] - distinct[4] === 4) straight = distinct[0];
    else if (distinct[0] === 14 && distinct[1] === 5) straight = 5;
  }
  const cnt = {}; vals.forEach(v => { cnt[v] = (cnt[v] || 0) + 1; });
  const groups = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a);
  if (flush && straight) return [8, straight];
  if (cnt[groups[0]] === 4) return [7, groups[0], groups[1]];
  if (cnt[groups[0]] === 3 && cnt[groups[1]] === 2) return [6, groups[0], groups[1]];
  if (flush) return [5, ...groups];
  if (straight) return [4, straight];
  if (cnt[groups[0]] === 3) return [3, groups[0], groups[1], groups[2]];
  if (cnt[groups[0]] === 2 && cnt[groups[1]] === 2) return [2, groups[0], groups[1], groups[2]];
  if (cnt[groups[0]] === 2) return [1, groups[0], groups[1], groups[2], groups[3]];
  return [0, ...groups];
}
const C5 = [];
for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) for (let c = b + 1; c < 7; c++)
  for (let d = c + 1; d < 7; d++) for (let e = d + 1; e < 7; e++) C5.push([a, b, c, d, e]);
function best7(cards7) {
  let best = null;
  for (const combo of C5) {
    const t = score5(combo.map(i => cards7[i]));
    if (!best || cmpT(t, best) > 0) best = t;
  }
  return best;
}
function cmpT(t1, t2) {
  for (let i = 0; i < Math.max(t1.length, t2.length); i++) {
    const x = t1[i] ?? -1, y = t2[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
}

function chen(hole) {
  const r = c => RANKS.indexOf(c[0]) + 2;
  const [a, b] = hole.map(r);
  const hi = Math.max(a, b), lo = Math.min(a, b);
  let pts = { 14: 10, 13: 8, 12: 7, 11: 6 }[hi] ?? hi / 2;
  if (a === b) { pts = Math.max(5, pts * 2); return Math.min(20, pts); }
  if (hole[0][1] === hole[1][1]) pts += 2;
  if (hi - lo === 1) pts -= 1;
  else if (hi - lo === 2) pts -= 2;
  else if (hi - lo === 3) pts -= 4;
  else if (hi - lo >= 4) pts -= 5;
  return Math.max(0, pts);
}

// Monte-Carlo equity vs 2 random hands, ~120 rollouts (cheap, local)
function equity(hole, comm, deck0) {
  const used = new Set([...hole, ...comm.filter(Boolean)]);
  const deck = deck0.filter(c => !used.has(c));
  const need = 5 - comm.filter(Boolean).length;
  const n = need === 0 ? 200 : 120;
  let win = 0;
  for (let i = 0; i < n; i++) {
    const d = deck.slice();
    for (let j = d.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [d[j], d[k]] = [d[k], d[j]]; }
    const o1 = [d[0], d[1]], o2 = [d[2], d[3]];
    const fill = d.slice(4, 4 + need);
    const full = [...hole, ...comm.filter(Boolean), ...fill];
    const board = full.slice(2);
    const mine = best7([...hole, ...board]);
    const s1 = best7([...o1, ...board]);
    const s2 = best7([...o2, ...board]);
    const m = Math.max(cmpT(mine, s1), cmpT(mine, s2));
    if (m > 0) win += 1; else if (m === 0) win += 0.5;
  }
  return win / n;
}

// ── the seat ─────────────────────────────────────────────────────────────────
export function makeChordSeat({ jev, moth = null, live = false, journal = [], weights = { aggro: 0.5, tight: 0.5, bluff: 0.3, sticky: 0.3 }, lr = 0.06 } = {}) {
  const chord = makeChord({ jev, moth, glm: offlineReviewer(), chain: [], journal });
  const stats = { decisions: 0, gates: {}, live: 0, mock: 0, tokens: { input: 0, output: 0 }, latencies: [], refusals: 0 };
  const chain = chord.chain;
  let lastOwnDist = null, lastMae = null;

  function ownPrior({ eq, toCall, pot, w }) {
    // softmax over logit priors scaled by visible weight cells
    const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
    const foldL = 3.2 * Math.max(0, potOdds - eq) * (0.5 + w.tight);
    const callL = 2.2 * (eq - potOdds + 0.08) * (0.5 + w.sticky) + (toCall === 0 ? 1.2 : 0);
    const raiseL = 3.0 * (eq - 0.5) * (0.4 + w.aggro) + (toCall === 0 ? 0.4 : 0) + 0.5 * w.aggro;
    const raw = { fold: Math.exp(foldL), call: Math.exp(callL), raise: Math.exp(raiseL) };
    const s = raw.fold + raw.call + raw.raise;
    return { fold: raw.fold / s, call: raw.call / s, raise: raw.raise / s, eq, potOdds };
  }

  async function act({ seat, legal, hole, comm, stacks, bets, folded, oppAggro = 0.5, handNo, push }) {
    const { to_call: toCall } = legal;
    const pot = legal.pot ?? 0;
    const w = weights;
    const prior = ownPrior({ eq: legal.__eq ?? 0.5, toCall, pot, w });
    if (legal.__eq === undefined) { /* caller supplies equity via legal.__eq */ }
    const street = ['preflop', 'flop', 'turn', 'river'][Math.min(3, comm.filter(Boolean).length === 0 ? 0 : comm.filter(Boolean).length === 5 ? 3 : comm.filter(Boolean).length - 2)];
    lastOwnDist = { fold: prior.fold, call: prior.call, raise: prior.raise };

    const state =
      `Hand ${handNo}, ${street}. Seats: 3 (you are seat ${seat}). ` +
      `Your hole: ${hole.join(' ')}. Community: ${comm.filter(Boolean).join(' ') || '(none)'}. ` +
      `Pot ${pot}. You face ${toCall > 0 ? `a bet of ${toCall} to call` : 'no bet (may check)'}; your stack ${stacks[seat]}. ` +
      `Bets so far: ${bets.join('/')}. Folded: ${folded.map((f, i) => f ? `P${i}` : null).filter(Boolean).join(',') || 'none'}. ` +
      `Opponent aggression observed (0-1): ${oppAggro.toFixed(2)}. Your equity estimate: ${prior.eq.toFixed(2)} vs pot odds ${prior.potOdds.toFixed(2)}. ` +
      `Your current policy weights: aggro ${w.aggro.toFixed(2)}, tight ${w.tight.toFixed(2)}, bluff ${w.bluff.toFixed(2)}, sticky ${w.sticky.toFixed(2)}.`;

    const row = await chord.chordVerdict({
      state,
      instructions: 'Choose your action: fold, call (or check if no bet), or raise.',
      criteria: {
        fold: 'release the hand; equity too thin for the price',
        call: 'see the next street cheaply or check behind',
        raise: 'build the pot with strong equity or take it with pressure',
      },
      extra: {
        pressure: { type: 'score', instructions: 'How much pressure should this line apply?', criteria: ['max passive', 'passive', 'neutral', 'aggressive', 'max aggressive'] },
        bluff: { type: 'noul', instructions: 'Given how the opponents have been responding, is now a profitable bluff/pressure spot?' },
        opp_strong: { type: 'noul', instructions: 'Does the betting so far suggest an opponent holds top-pair strength or better?' },
      },
      ownDist: lastOwnDist,
      tag: `hand:${handNo}:act:${stats.decisions}`,
    });

    stats.decisions++;
    stats.gates[row.gate] = (stats.gates[row.gate] || 0) + 1;
    if (row.source === 'live') stats.live++; else stats.mock++;
    stats.tokens.input += row.tokens?.input_tokens || 0;
    stats.tokens.output += row.tokens?.output_tokens || 0;
    stats.latencies.push(row.latency_ms);
    lastMae = row.calib?.mae ?? null;

    // calibration-delta learning: visible weight cells drift toward jev's judgment
    if (row.calib && row.source === 'live' && !row.mock) {
      const d = row.calib.delta;
      weights.aggro = clamp(weights.aggro + lr * ((d.raise ?? 0) - (d.call ?? 0)) * 2);
      weights.tight = clamp(weights.tight + lr * (d.fold ?? 0) * 2);
      weights.sticky = clamp(weights.sticky + lr * (d.call ?? 0) * 2);
      const bl = row.answers?.bluff?.noul;
      if (typeof bl === 'number') weights.bluff = clamp(weights.bluff + lr * (bl - weights.bluff));
    }

    // map choice to a legal action
    let action = row.choice === 'raise' ? 'raise' : row.choice === 'fold' ? 'fold' : 'call';
    const opts = legal.options || [];
    if (action === 'raise' && toCall >= stacks[seat]) action = 'call';
    if (action === 'raise' && !opts.includes('raise') && opts.length) {
      if (opts.includes('call')) action = 'call'; else action = opts[0];
    }
    let amount;
    if (action === 'raise') {
      const pr = row.answers?.pressure?.score ?? 2;
      const frac = 0.4 + 0.35 * (Math.max(0, Math.min(4, pr)) / 4);
      const curBet = Math.max(...bets);
      amount = Math.round(curBet + Math.max(20, pot * frac));
      amount = Math.min(amount, stacks[seat] + bets[seat]);
    }
    const v = await push({ seat, action, ...(amount !== undefined ? { amount } : {}) });
    if (v && v.ok === false) {
      stats.refusals++;
      const v2 = await push({ seat, action: toCall > 0 ? 'call' : 'call' });
      if (v2 && v2.ok === false) await push({ seat, action: 'fold' });
    }

    chain.push({
      seq: chain.length + 1, kind: 'hand', handNo, seat, street,
      choice: row.choice, p: row.p, gate: row.gate, mae: lastMae,
      eq: +prior.eq.toFixed(3), toCall, pot,
      source: row.source, mock: row.mock, tokens: row.tokens,
      at: new Date().toISOString(),
    });
    sealChain(chain);
    return { row, prior, action };
  }

  return {
    act, chain, stats, weights, chord,
    verify: () => verifyChain(chain),
    equity, chen,
  };
}

function clamp(x, lo = 0.05, hi = 0.95) { return Math.max(lo, Math.min(hi, x)); }
