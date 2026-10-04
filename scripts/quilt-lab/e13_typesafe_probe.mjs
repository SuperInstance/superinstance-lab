// e13: probe the TypeSafe System One API with the user's key.
// TINY budget: 2 calls max. Verifies wire format + calibrated probabilities.
const KEY = process.env.TYPESAFEAI_KEY;
const BASE = 'https://api.typesafe.ai';

async function call(body) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/v1/systemone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const text = await res.text();
  console.log(`HTTP ${res.status} in ${ms}ms`);
  try { return { status: res.status, ms, json: JSON.parse(text) }; }
  catch { return { status: res.status, ms, raw: text.slice(0, 600) }; }
}

// Probe 1: single noul (cheapest possible)
console.log('--- probe 1: noul ---');
const p1 = await call({
  model: 'jev-latest',
  state: 'A poker agent holds ace-king suited on the button. One limper before it. Blinds 10/20. Stack 1000.',
  questions: { raise: { type: 'noul', instructions: 'Should the agent raise preflop in this spot?' } },
});
console.log(JSON.stringify(p1.json ?? p1.raw, null, 2));

// Probe 2: batch — one call, THREE typed questions at once (the System One claim)
console.log('--- probe 2: batch choice+score+noul ---');
const p2 = await call({
  model: 'jev-latest',
  state: 'Heads-up hold\'em. Board: Ks 7d 2c. Opponent led out small on the flop after flat-calling preflop from the big blind. Our hand: Ac Kd. Pot 240, we hold 900, opponent covers.',
  questions: {
    action: {
      type: 'choice',
      instructions: 'Pick the best action on this flop.',
      criteria: { check: 'give up, pot control', bet_small: 'small stab for info and protection', bet_big: 'charge draws and value hands', fold: 'release the hand' },
    },
    aggression: {
      type: 'score',
      instructions: 'How aggressive is this line given the state?',
      criteria: ['very passive', 'passive', 'neutral', 'aggressive', 'very aggressive'],
    },
    opp_strong: {
      type: 'noul',
      instructions: 'Given the small lead bet, does the opponent likely hold top-pair strength or better?',
    },
  },
});
console.log(JSON.stringify(p2.json ?? p2.raw, null, 2));
