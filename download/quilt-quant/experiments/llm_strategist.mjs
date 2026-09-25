// LLM STRATEGIST — "nudges on the strategy ai loop", through the fence.
//
// The trainer's perturbation knob is fine for hill-climbing, but the user's
// hand (or a model's judgment) should be able to propose a SPECIFIC nudge.
// This experiment wires a letter-coded menu (the E9 protocol: models answer
// A–E, never free-form parameters) into the desk's gated pipeline:
//
//   desk state -> menu -> [LLM picks a letter] -> decode -> candidate params
//   -> ai.trainer {force_cand} -> S2 -> IS fit -> S6 verdict -> S7 gate
//   -> receipt (promote | refuse)
//
// The fence is structural: the model cannot inject parameters, only CHOOSE a
// direction; the desk then does its own arithmetic and its own gating. A bad
// pick costs one refuse receipt, not the desk.
//
//   node experiments/llm_strategist.mjs          (mock model, offline, green)
//   node experiments/llm_strategist.mjs --real   (z-ai GLM, backoff on 429)

import { QuiltEngine } from '../engine/index.js';
import { buildSheet } from '../quant/sheet.mjs';
import { mulberry32 } from '../shared/kit.mjs';

const engine = new QuiltEngine('quant-strategist', { eager: true });
engine.loadSheet(buildSheet());
const get = async (id) => (await engine.get(id)).data;
const call = async (id, input) => (await engine.call(id, input)).data;

// ── the menu is derived FROM the desk (so the model reasons over real state) ─
async function buildMenu() {
  const wf = await get('wf.report');
  const P = { strategy: await get('p.strategy'), fast: await get('p.fast'), slow: await get('p.slow'),
    rsi_len: await get('p.rsi_len'), rsi_max: await get('p.rsi_max'), rsi_buy: await get('p.rsi_buy'),
    rsi_sell: await get('p.rsi_sell') };
  const oos = wf?.oos_m ?? {};
  return {
    state: { strategy: P.strategy, fast: P.fast, slow: P.slow, rsi_max: P.rsi_max,
      oos_sharpe: +(oos.sharpe ?? 0).toFixed(2), verdict: wf?.verdict ?? '—' },
    items: [
      { letter: 'A', name: 'faster crossover', effect: `fast ${P.fast} -> ${Math.max(2, P.fast - 3)}`,
        decode: (p) => ({ ...p, fast: Math.max(2, p.fast - 3) }) },
      { letter: 'B', name: 'slower crossover', effect: `slow ${P.slow} -> ${P.slow + 6}`,
        decode: (p) => ({ ...p, slow: p.slow + 6 }) },
      { letter: 'C', name: 'relax the overbought gate', effect: `rsi_max ${P.rsi_max} -> ${Math.min(95, P.rsi_max + 5)}`,
        decode: (p) => ({ ...p, rsi_max: Math.min(95, p.rsi_max + 5) }) },
      { letter: 'D', name: 'flip strategy', effect: `${P.strategy} -> ${P.strategy === 'sma_cross' ? 'rsi_reversion' : 'sma_cross'}`,
        decode: (p) => ({ ...p, strategy: p.strategy === 'sma_cross' ? 'rsi_reversion' : 'sma_cross' }) },
      { letter: 'E', name: 'hold the line', effect: 'no change — keep the champion and deepen the search',
        decode: (p) => ({ ...p }) },
    ],
    params: P,
  };
}

const menuPrompt = (m) => `You are the strategist of an algorithmic trading desk.
Current config: ${JSON.stringify(m.state)}
Recent out-of-sample sharpe: ${m.state.oos_sharpe} (verdict ${m.state.verdict}).
Choose the single best next nudge:
${m.items.map(i => `  ${i.letter}. ${i.name} (${i.effect})`).join('\n')}
Answer with ONE letter only.`;

// ── models: mock (deterministic state-reactive) and real (z-ai, backoff) ─────
const MOCK_PICKS = [];
const mockModel = async (prompt) => {
  const verdict = /verdict (\w+)/.exec(prompt)?.[1];
  const oos = Number(/oos_sharpe":([\d.-]+)/.exec(prompt)?.[1] ?? 0);
  // honest state-reactive doctrine: an overfit desk slows down, a weak one
  // flips approach, a mediocre one sharpens entry, a strong one holds the line
  const pick = verdict === 'OVERFIT' ? 'B' : verdict === 'WEAK' ? 'D' : (oos >= 1.2 ? 'E' : 'A');
  MOCK_PICKS.push({ verdict, oos, pick });
  return pick;
};

const zai = { picked: 0, refused: 0 };
async function realModel(prompt) {
  const { default: ZAI } = await import('z-ai-web-dev-sdk');
  const backoffs = [15000, 30000, 45000];
  for (let attempt = 0; ; attempt++) {
    try {
      const z = await ZAI.create();
      const r = await z.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        thinking: { type: 'disabled' },
      });
      return (r?.choices?.[0]?.message?.content ?? '').trim().slice(0, 8);
    } catch (e) {
      if (attempt >= backoffs.length) { zai.refused++; return { __refused: String(e?.message ?? e) }; }
      console.log(`    (llm busy — backing off ${backoffs[attempt] / 1000}s)`);
      await new Promise(res => setTimeout(res, backoffs[attempt]));
    }
  }
}

// ── the fence: letter -> decode -> trainer (S2..S7 gate the rest) ────────────
async function strategistTurn(model, tag) {
  const menu = await buildMenu();
  await call('wf.report');
  const raw = await model(menuPrompt(menu));
  const letter = String(typeof raw === 'string' ? raw : raw?.__refused ? '' : raw).trim()[0]?.toUpperCase() ?? '?';
  const item = menu.items.find(i => i.letter === letter);
  if (!item) {
    console.log(`  [${tag}] model said "${raw}" — OUTSIDE THE MENU. Refused, nothing happened.`);
    return { refused: true };
  }
  const cand = { strategy: menu.params.strategy === 'sma_cross' && item.letter !== 'D' ? 'sma_cross' : (item.letter === 'D' ? (menu.params.strategy === 'sma_cross' ? 'rsi_reversion' : 'sma_cross') : menu.params.strategy), params: item.decode(menu.params) };
  if (item.letter !== 'D') cand.strategy = menu.params.strategy;
  const t = await call('ai.trainer', { gens: 1, seed: 99, force_cand: { strategy: cand.strategy, params: cand.params } });
  const led = (await get('ai.ledger'));
  const row = led[led.length - 1];
  console.log(`  [${tag}] picked ${item.letter} (${item.name}) -> ${row.kind.toUpperCase()} ${row.verdict} · OOS ${row.oos_score?.toFixed?.(3) ?? '—'}`);
  console.log(`        desk: ${row.why}`);
  return { letter, kind: row.kind, verdict: row.verdict, oos: row.oos_score };
}

// ── run: four turns with the mock (offline), one with the real model on --real
const REAL = process.argv.includes('--real');
console.log('LLM STRATEGIST — letter-coded nudges through the S2→S7 pipeline\n');
let out = { turns: [], real: false };
{
  const seq = ['cold desk', 'after first promotion', 'after second promotion', 'deep in the run'];
  for (let i = 0; i < 4; i++) {
    if (i === 0) await call('ai.trainer', { gens: 3, seed: 21 }); // give the desk a champion to defend
    if (i === 1) await call('ai.trainer', { gens: 5, seed: 22 });
    if (i === 2) await call('ai.trainer', { gens: 5, seed: 23 });
    const t = await strategistTurn(REAL ? realModel : mockModel, seq[i] ?? 'turn ' + i);
    out.turns.push(t);
  }
}
const led = await get('ai.ledger');
const chain = await get('ai.chaincheck');
console.log(`\nledger: ${led.length} receipts, chain ${chain.ok ? 'SEALED' : 'BROKEN'} (head ${chain.head?.slice(0, 8)})`);
console.log(`strategist picks (mock): ${MOCK_PICKS.map(p => p.pick).join(' ')}`);
out.real = REAL; out.chain = chain; out.picks = MOCK_PICKS;
process.stdout.write('\n' + JSON.stringify(out) + '\n');
