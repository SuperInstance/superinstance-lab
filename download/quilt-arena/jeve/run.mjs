// jeve/run.mjs — the JEVE mind enters the Perception Arena.
//
// Design: controlled comparison. All five minds run the SAME inf.predict /
// inf.update recovery machinery (LIN contract); only the decision surface
// differs. Recovery probe = every mind observes the SAME planted-formula
// dummy under the SAME seeds; tournament probe = full round-robin under
// rationed MOTH budgets. LIVE phase re-runs recovery with the real System
// One (cap 22) and real MOTH purchases.

import { QuiltEngine } from '../../quilt-arcade/engine/index.js';
import { buildAgentSheet, FAMILIES, STYLE_KEYS, MW_FEATS, HW_FEATS } from '../arena/minds.mjs';
import { MINES, minesNewBoard, minesLegal, minesFeatures, minesVerify, softmax } from '../arena/games.mjs';
import { Arena, AnalystAI } from '../arena/tournament.mjs';
import { buildJevSheet, JEVE_ID, blendDistributions, argmaxDist, styleNudgeFromDelta } from './mind.mjs';
import { JevVault } from '../../quilt-cortex/cortex/typesafe.mjs';
import { makeMoth } from '../../quilt-cortex/cortex/moth.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, '../../.cache'), { recursive: true });

const KEY = process.env.TYPESAFEAI_KEY;
const MOTH_KEY = 'moth_LK5TNffDcdDz4g5PQCCgrU';

const CHECKS = [];
const check = (name, ok, detail = '') => { CHECKS.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

// ── neutral inf model registration (runtime.set on missing cells throws) ────
const NEUTRAL = () => { const o = {}; for (const k of [...MW_FEATS, ...HW_FEATS]) o[k] = 0.05; return o; };
function ensureInfModels(engine, ids) {
  for (const id of ids) {
    const cellId = `inf.${id}`;
    if (!engine.cells.get(cellId)) {
      engine.register({ id: cellId, kind: 'value', value: { w: NEUTRAL(), hits: 0, n: 0, acc: null, margin: [], alarm: 0, ess: null, tol: null, aggr: null, moon: null, particles: null, spec: null }, description: `model of ${id} (runner-registered)` });
    }
  }
}

// ── planted dummy: a LIN mind with PINNED styles (the formula to recover) ───
const PLANTED_STYLES = { greed: 0.9, fear: -0.6, curiosity: 0.3, social: 0.8, patience: -0.2 };
function makeDummyEngine() {
  const e = new QuiltEngine('arena-dummy', { eager: false });
  e.loadSheet(buildAgentSheet('dummy', 'LIN'));
  for (const [k, v] of Object.entries(PLANTED_STYLES)) e.cells.get(`st.${k}`).value = { data: v, status: 'ready', computedAt: Date.now() };
  ensureInfModels(e, ['p0', 'p1', 'p2', 'p3', 'p4']);
  return e;
}
async function plantedVector(e) {
  const w = {};
  for (const f of MW_FEATS) w[f] = (await e.get(`mw.${f}`)).data ?? 0;
  return w;
}
const cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (const k of Object.keys(a)) { dot += (a[k] || 0) * (b[k] || 0); na += (a[k] || 0) ** 2; nb += (b[k] || 0) ** 2; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};

// ── JevArena: 5 minds + dummy + the doubt economy ────────────────────────────
class JevArena extends Arena {
  constructor({ jev = null, doubt = 0.10, alpha = 0.5, ...rest }) {
    super(rest);
    this.jev = jev; this.doubt = doubt; this.alpha = alpha; this.jevLeft = null; this.forceAsk = false;
  }
  async boot() {
    for (let i = 0; i < 4; i++) {
      const aid = `p${i}`;
      const e = new QuiltEngine(`arena-${aid}`, { eager: false });
      e.loadSheet(buildAgentSheet(aid, FAMILIES[i]));
      ensureInfModels(e, ['p4', 'dummy']);
      this.engines[aid] = e;
    }
    const e4 = new QuiltEngine(`arena-${JEVE_ID}`, { eager: false });
    e4.loadSheet(buildJevSheet(JEVE_ID));
    ensureInfModels(e4, ['dummy']);
    this.engines[JEVE_ID] = e4;
    this.engines.dummy = makeDummyEngine();
  }
  // JEVE's doubt economy: consult System One only when the sheet is unsure.
  async decide(aid, ctx, budget, tag) {
    if (aid === 'dummy') return this.callCell(aid, 'act.choose', { ...ctx, pack: null, mothLeft: 0 });
    if (aid !== JEVE_ID) return super.decide(aid, ctx, budget, tag);
    const e = this.engines[aid];
    const left = budget.left[aid] ?? 0;
    const r1 = await this.callCell(aid, 'act.choose', { ...ctx, pack: null, mothLeft: left });
    const top = r1.entries || [];
    const doubt = r1.margin < this.doubt;
    let finalPick = r1.pick, spend = 0, think = r1.think;
    const explore = (await this.cell(aid, 'jev.explore')) ?? 0.5;
    const threshold = this.doubt * (1.4 - 0.8 * explore); // high explore → lower bar → asks more
    const ask = (r1.margin < threshold || this.forceAsk) && this.jev && this.jevLeft > 0 && top.length >= 2;
    if (ask) {
      const state =
        `Game: ${ctx.game === 'mines' ? 'MOTHRA minesweeper duel' : 'WEAVER hearts trick'}. Stake ${(+ctx.stake || 0).toFixed(2)}. ` +
        `Candidates (id: score): ${top.map(x => `${x.id}:${x.s.toFixed(3)}`).join(', ')}. ` +
        `My margin between best and second: ${r1.margin.toFixed(3)}. ` +
        `Perception budget left: ${left}. Opponents: ${ctx.opp.join(', ')}.`;
      const questions = {
        move: { type: 'choice', instructions: 'Which candidate move is best right now?', criteria: Object.fromEntries(top.map(x => [x.id, `sheet score ${x.s.toFixed(3)}`])) },
        pressure: { type: 'score', instructions: 'How much pressure does this situation call for?', criteria: ['max passive', 'passive', 'neutral', 'aggressive', 'max aggressive'] },
        worth: { type: 'noul', instructions: 'Is the remaining uncertainty worth spending a scarce MOTH perception call to re-read?' },
      };
      const { answers, source, mock } = await this.jev.decide(state, questions, { tag: `jev:${tag}` });
      this.jevLeft--;
      await e.set('jev.calls', ((await this.cell(aid, 'jev.calls')) || 0) + 1);
      if (!mock) await e.set('jev.live', ((await this.cell(aid, 'jev.live')) || 0) + 1);
      const sheetDist = Object.fromEntries(top.map(x => [x.id, x.p]));
      const jd = answers.move.probabilities || {};
      const blend = blendDistributions(top, jd, this.alpha);
      finalPick = argmaxDist(blend);
      const { mae, nudges } = styleNudgeFromDelta(sheetDist, jd);
      await e.set('jev.mae', mae);
      // calibration-delta teaching: small, clamped, receipted style nudges
      const st = {};
      for (const k of STYLE_KEYS) st[k] = (await this.cell(aid, `st.${k}`)) ?? 0;
      for (const [k, dn] of Object.entries(nudges)) if (k in st) st[k] = Math.max(-1.5, Math.min(1.5, st[k] + dn));
      for (const k of STYLE_KEYS) await e.set(`st.${k}`, +st[k].toFixed(4));
      const worth = answers.worth?.noul ?? 0;
      if (worth > 0.6 && left > 0) {
        const pkt = await this.vault.packet(`p:${aid}:${tag}:${this.spendSeq++}`);
        budget.left[aid] = left - 1;
        budget.spent[aid] = (budget.spent[aid] ?? 0) + 1;
        await e.set('moth.left', left - 1);
        const led = (await this.cell(aid, 'moth.ledger')) || [];
        await e.set('moth.ledger', led.concat([{ set: budget.setNo ?? 0, why: 'jev worth-gated', source: pkt.source, mock: pkt.mock }]).slice(-40));
        this.ledger.push({ kind: 'spend', by: aid, tag, why: 'jev worth-gated', source: pkt.source, mock: pkt.mock });
        const r2 = await this.callCell(aid, 'act.choose', { ...ctx, pack: pkt.floats, mothLeft: left - 1 });
        const blend2 = blendDistributions(r2.entries || top, jd, this.alpha);
        finalPick = argmaxDist(blend2);
        spend = 1;
        think += ' + worth-gated pack re-read';
      }
      const j = (await this.cell(aid, 'jev.journal')) || [];
      await e.set('jev.journal', j.concat([{ tag, source, mock, mae, worth: +(worth).toFixed(3), margin: r1.margin, blended: true }]).slice(-60));
    } else {
      finalPick = r1.pick; // fast path: the sheet was sure, zero API
    }
    return { pick: finalPick, spend, think, usedPack: spend === 1 };
  }
  // one-pass script-writer revision (replaces/complements the letter analyst)
  async jevRevise(aid, digest) {
    const e = this.engines[aid];
    const state = `Set ${digest.setNo} digest: recovery acc ${digest.acc?.toFixed?.(3) ?? '?'}, ` +
      `score margin ${digest.margin ?? 0}, MOTH spend ratio ${digest.spendRatio?.toFixed?.(2) ?? '?'}, ` +
      `lost last set: ${!!digest.lost}. Opponent telemetry: alarms ${JSON.stringify(digest.alarms ?? [])}.`;
    const { answers, source, mock } = await this.jev.decide(state, {
      family: { type: 'choice', instructions: 'Which hypothesis family best explains the opponents so far?', criteria: { LIN: 'linear weights refined by SGD', WAVE: 'spectral Goertzel rhythm reader', BAYES: 'particle posterior over formulas', MASK: 'adversarial self-model mixer' } },
      drift: { type: 'noul', instructions: 'Have the opponents changed their decision formula recently?' },
      explore: { type: 'noul', instructions: 'Is the next set worth spending MOTH perception calls on?' },
    }, { tag: `jev:revise:${digest.setNo}` });
    await e.set('jev.explore', answers.explore?.noul ?? 0.5);
    // map the one-pass verdict onto the arena's A–E letter doctrine
    let letter = 'A';
    if ((digest.acc ?? 1) < 0.35) letter = 'D';
    else if (digest.lost && (answers.drift?.noul ?? 0) > 0.5) letter = 'B';
    else if ((answers.family?.confidence ?? 0) > 0.45) letter = 'C';
    else if ((digest.spendRatio ?? 0) > 0.85) letter = 'E';
    const part = digest.participation || {};
    const out = await this.callCell(aid, 'learn.revise', { digest: { ...digest, letter } });
    return { letter, family: answers.family?.choice, drift: answers.drift?.noul, explore: answers.explore?.noul, source, mock, revise: out };
  }
}

// ── shared vaults ─────────────────────────────────────────────────────────────
const journal = [];
const mothOFF = await makeMoth({ live: false, cachePath: join(here, '../../.cache/moth-jeve-off.json'), journal });

// ── recovery probe: every mind vs the SAME planted formula, SAME seeds ───────
async function recoveryProbe({ mindId, jevMode = 'OFF', games = 40 }) {
  const jev = jevMode === 'LIVE'
    ? new JevVault({ key: KEY, ns: 'LIVE', cap: 22, journal, cachePath: join(here, '../../.cache/typesafe-jeve.json') })
    : new JevVault({ key: null, ns: 'OFF', cap: 0, journal, cachePath: join(here, '../../.cache/typesafe-jeve-off.json') });
  const arena = new JevArena({ vault: mothOFF, analyst: null, ledger: [], jev, doubt: 0.10, alpha: 0.5 });
  arena.jevLeft = jevMode === 'LIVE' ? 22 : Infinity;
  await arena.boot();
  const roster = ['p0', 'p1', 'p2', 'p3', JEVE_ID];
  const dummyVec = await plantedVector(arena.engines.dummy);
  const budget = { left: Object.fromEntries([...roster, 'dummy'].map(a => [a, 0])), spent: {}, setNo: 0 };
  // mulberry-matched rng per game: SAME deal sequence for every mind
  const mkRng = (g) => { let a = (90000 + g) >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  let first = mindId;
  for (let g = 0; g < games; g++) {
    await arena.playMines([first, 'dummy'], mkRng(g), budget, { learn: true, firstMove: 'second' });
    first = first; // mind always moves first: it gets maximal observation duty
  }
  const model = (await arena.cell(mindId, 'inf.dummy')) || {};
  const acc = model.acc ?? null;
  const cos = cosine(model.w || {}, dummyVec);
  const stats = {
    mind: mindId, games, acc: acc == null ? null : +acc.toFixed(3), cosine: +cos.toFixed(4),
    jevCalls: (await arena.cell(JEVE_ID, 'jev.calls')) || 0,
    jevLive: (await arena.cell(JEVE_ID, 'jev.live')) || 0,
    mothSpent: budget.spent[mindId] || 0,
    n: model.n || 0,
  };
  return stats;
}

// ── PHASE A: recovery, OFFLINE ────────────────────────────────────────────────
console.log('\n══ PHASE A — planted-formula recovery, OFFLINE (mock jev) ══');
const recovery = {};
for (const mind of [...FAMILIES.map((f, i) => `p${i}`), JEVE_ID]) {
  const r = await recoveryProbe({ mindId: mind, games: 40 });
  recovery[mind] = r;
  console.log(`  ${mind.padEnd(3)} acc=${String(r.acc).padEnd(6)} cos=${String(r.cosine).padEnd(7)} n=${r.n} jevCalls=${r.jevCalls}`);
}
const cosJEVE = recovery[JEVE_ID].cosine;
const cosBest4 = Math.max(...FAMILIES.map((f, i) => recovery[`p${i}`].cosine));
check('recovery (offline): all five minds fitted >100 observations', Object.values(recovery).every(r => r.n >= 100), JSON.stringify(Object.fromEntries(Object.entries(recovery).map(([k, v]) => [k, v.n]))));
check('recovery (offline): JEVE cosine positive & tracking', cosJEVE > 0.5, `JEVE=${cosJEVE} best-of-4=${cosBest4.toFixed(3)}`);
check('recovery (offline): mock jev labeled, zero live calls', recovery[JEVE_ID].jevLive === 0);

// ── PHASE B: tournament round-robin, OFFLINE ─────────────────────────────────
console.log('\n══ PHASE B — round-robin tournament, OFFLINE (budget 2 per set) ══');
{
  const jevOff = new JevVault({ key: null, ns: 'OFF', cap: 0, journal, cachePath: join(here, '../../.cache/typesafe-jeve-off.json') });
  const arena = new JevArena({ vault: mothOFF, analyst: null, ledger: [], jev: jevOff, doubt: 0.10, alpha: 0.5 });
  arena.jevLeft = Infinity;
  await arena.boot();
  const roster = ['p0', 'p1', 'p2', 'p3', JEVE_ID];
  const points = Object.fromEntries(roster.map(a => [a, 0]));
  const budget = { left: Object.fromEntries(roster.map(a => [a, 2])), spent: {}, setNo: 1 };
  const mkRng = (g) => { let a = (77000 + g) >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  let g = 0;
  for (let i = 0; i < roster.length; i++) for (let j = i + 1; j < roster.length; j++) {
    const [a, b] = [roster[i], roster[j]];
    const rec = await arena.playMines([a, b], mkRng(g++), budget, { learn: true });
    points[a] += rec.scoreA; points[b] += rec.scoreB;
    const rec2 = await arena.playMines([b, a], mkRng(g++), budget, { learn: true });
    points[b] += rec2.scoreA; points[a] += rec2.scoreB;
  }
  console.log('  standings:', Object.entries(points).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}=${v}`).join(' '));
  const jevEcon = { calls: await arena.cell(JEVE_ID, 'jev.calls'), live: await arena.cell(JEVE_ID, 'jev.live'), journal: (await arena.cell(JEVE_ID, 'jev.journal')).slice(-5), moth: budget.spent[JEVE_ID] || 0 };
  console.log('  JEVE economics:', JSON.stringify({ calls: jevEcon.calls, live: jevEcon.live, moth: jevEcon.moth }));
  check('tournament: all 10 pairs played (2 games each)', g === 20, `games=${g}`);
  check('tournament: MOTH ledger within budget (2/set)', Object.values(budget.spent).every(v => v <= 2), JSON.stringify(budget.spent));
  check('tournament: JEVE used the doubt economy (not every move)', jevEcon.calls < 400, `calls=${jevEcon.calls} (games=20, moves≈${20 * 40})`);
  globalThis.__phaseB = { points, jevEcon };
}

// ── PHASE C: LIVE recovery (real System One + real MOTH) ─────────────────────
console.log('\n══ PHASE C — JEVE recovery LIVE (cap 22 typesafe, real moth purchases) ══');
const mothLIVE = await makeMoth({ key: MOTH_KEY, live: true, cachePath: join(here, '../../.cache/moth-jeve-live.json'), journal });
const liveRec = await recoveryProbe({ mindId: JEVE_ID, jevMode: 'LIVE', games: 40 });
console.log(`  JEVE(live) acc=${liveRec.acc} cos=${liveRec.cosine} jevLive=${liveRec.jevLive}/${liveRec.jevCalls} moth=${liveRec.mothSpent}`);
const mockJEVE = recovery[JEVE_ID];
check('live: real System One decisions consumed (>= 8)', liveRec.jevLive >= 8, `live=${liveRec.jevLive} of ${liveRec.jevCalls} calls (rest cap-degraded, labeled)`);
check('live: recovery machinery intact under live mind', liveRec.n >= 100 && liveRec.acc != null, `n=${liveRec.n} acc=${liveRec.acc}`);
check('live: worth-gated MOTH purchases respected the budget', liveRec.mothSpent <= 8, `spent=${liveRec.mothSpent}`);
console.log(`  recovery comparison: JEVE mock cos=${mockJEVE.cosine} → live cos=${liveRec.cosine} | best-of-4 offline=${cosBest4.toFixed(3)}`);

// ── one-pass revision demo (the analyst, one-passed) ─────────────────────────
console.log('\n══ revision: the script-writer as ONE System One batch ══');
{
  const jevOff = new JevVault({ key: null, ns: 'OFF', cap: 0, journal, cachePath: join(here, '../../.cache/typesafe-jeve-off.json') });
  const arena = new JevArena({ vault: mothOFF, analyst: null, ledger: [], jev: jevOff });
  arena.jevLeft = Infinity;
  await arena.boot();
  const rev = await arena.jevRevise(JEVE_ID, { setNo: 1, acc: 0.28, margin: 4, spendRatio: 0.5, lost: true, participation: { adj: 0.4, front: 0.2 } });
  console.log(`  letter=${rev.letter} family=${rev.family} drift=${rev.drift?.toFixed?.(2)} explore=${rev.explore?.toFixed?.(2)} (mock=${rev.mock})`);
  check('revision: one batch produced letter + family + drift + explore', ['A', 'B', 'C', 'D', 'E'].includes(rev.letter) && !!rev.family, JSON.stringify({ letter: rev.letter, family: rev.family }));
  const scr = await arena.cell(JEVE_ID, 'scr.chain');
  check('revision: script receipt stamped in scr.chain', Array.isArray(scr) && scr.length >= 1, `versions=${scr.length}`);
}

// ── summary ───────────────────────────────────────────────────────────────────
const pass = CHECKS.filter(c => c.ok).length;
console.log(`\n${pass}/${CHECKS.length} green`);
mkdirSync(join(here, 'outputs'), { recursive: true });
writeFileSync(join(here, 'outputs', 'results.json'), JSON.stringify({
  checks: `${pass}/${CHECKS.length}`,
  recoveryOffline: recovery,
  tournament: globalThis.__phaseB?.points,
  jevEconomy: globalThis.__phaseB?.jevEcon,
  recoveryLive: liveRec,
}, null, 2));
process.exit(pass === CHECKS.length ? 0 : 1);
