// E14 — THE FIVE-SEAT DRIVER. A faithful 5-seat port of arena/tournament.mjs's
// semantics (two-step MOTH purchase, universal predict+fit, margins
// arithmetic, craftmind revise loop) extended to the fifth family JEVE.
//
// Why a port and not the Arena class itself: tournament.mjs hard-codes the
// 4-seat field (PAIRS/TRIOS over p0..p3, budget loop over FAMILIES). We do
// NOT edit arena core files — we import its pieces (games referees, family
// sheets, analyst, moth vault) and re-drive them here with seats p0..p4.
// Fixes reported rather than patched in the core:
//   (a) buildAgentSheet only pre-creates inf.p0..p3 — a five-seat field needs
//       inf.p4 in the four legacy sheets (engine.set THROWS on unknown ids),
//       so we append the missing model cell at boot time here.

import { QuiltEngine } from '../engine/index.js';
import { mulberry32, v } from '../shared/kit.mjs';
import {
  MINES, rankOf, suitOf, ptsOf,
  minesNewBoard, minesLegal, minesFeatures, minesScore, minesVerify,
  heartsDeal, heartsLegal, heartsFeats, heartsVerify,
} from '../arena/games.mjs';
import { buildAgentSheet, FAMILIES, STYLE_KEYS, MW_FEATS, HW_FEATS } from '../arena/minds.mjs';
import { buildJeveSheet, JEVE, HKEYS, buildSeamState, buildSeamQuestions, seamAnswerToTeachInput } from './mind.mjs';

export const FAMILIES5 = [...FAMILIES, JEVE];
const SEATS = ['p0', 'p1', 'p2', 'p3', 'p4'];
const PAIRS = [];
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) PAIRS.push([i, j]);
const TRIOS = [];
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) for (let k = j + 1; k < 5; k++) TRIOS.push([i, j, k]);

const NEUTRAL_W = () => Object.fromEntries([...MW_FEATS, ...HW_FEATS].map((k) => [k, 0.05]));
const familyOf = (aid) => FAMILIES5[Number(aid[1])];

// ── the arena ────────────────────────────────────────────────────────────────
export class Arena5 {
  constructor({ vault, analyst, ledger = [], jev = null, seamPoints = ['end'] } = {}) {
    this.vault = vault;
    this.analyst = analyst;
    this.ledger = ledger;
    this.jev = jev;            // JevVault (OFF mock or LIVE) — the seam's voice
    this.seamPoints = seamPoints; // which phase boundaries fire the seam
    this.engines = {};
    this.spendSeq = 0;
    this.seams = [];           // every seam batch: {setNo, point, source, mock, res}
    this.gate = null;          // JEVE explore-gate telemetry (per set)
  }

  async boot() {
    for (let i = 0; i < 5; i++) {
      const aid = `p${i}`;
      const e = new QuiltEngine(`arena5-${aid}`, { eager: false });
      let sheet;
      if (i < 4) {
        sheet = buildAgentSheet(aid, FAMILIES[i]);
        // five-seat fix (reported, not patched in the core): legacy sheets
        // model only p0..p3; give them a neutral inf.p4 cell.
        sheet.cells.push(v('inf.p4', { w: NEUTRAL_W(), hits: 0, n: 0, acc: null, margin: [], alarm: 0, ess: null, tol: null, aggr: null, moon: null, particles: null, spec: null }, 'model of p4 (JEVE seat) — appended for the five-seat field'));
      } else {
        sheet = buildJeveSheet(aid);
      }
      await e.loadSheet(sheet);
      this.engines[aid] = e;
    }
  }

  async cell(aid, id) { return (await this.engines[aid].get(id)).data; }

  // cells fail SILENTLY ({status:'error'}) — E12's own lesson; we throw.
  async callCell(aid, id, input) {
    const r = await this.engines[aid].call(id, input);
    if (r && r.status === 'error') {
      throw new Error(`${aid}.${id} failed: ${r.error?.message ?? JSON.stringify(r.error)}`);
    }
    return r ? r.data : undefined;
  }

  async styles(aid) {
    const out = {};
    for (const k of STYLE_KEYS) out[k] = (await this.cell(aid, `st.${k}`)) ?? 0;
    return out;
  }

  // ── the two-step perception purchase (verbatim semantics from the arena) ──
  async decide(aid, ctx, budget, tag) {
    const e = this.engines[aid];
    let left = budget.left[aid] ?? 0;
    let r = await this.callCell(aid, 'act.choose', { ...ctx, pack: null, mothLeft: left });
    if (this.gate && aid === 'p4') {
      this.gate.decisions++;
      if (r?.gate) this.gate.gateOpen++;
      if (r?.spend && left <= 0) this.gate.budgetBlocked++;
    }
    if (r && r.spend && left > 0) {
      const pkt = await this.vault.packet(`p:${aid}:${tag}:${this.spendSeq++}`);
      left -= 1;
      budget.left[aid] = left;
      budget.spent[aid] = (budget.spent[aid] ?? 0) + 1;
      if (this.gate && aid === 'p4') this.gate.bought++;
      await e.set('moth.left', left);
      await e.set('moth.pack', pkt.floats);
      const led = (await this.cell(aid, 'moth.ledger')) || [];
      led.push({ set: budget.setNo ?? 0, why: String(r.think || '').slice(0, 90), source: pkt.source, mock: pkt.mock });
      await e.set('moth.ledger', led.slice(-40));
      this.ledger.push({ kind: 'spend', by: aid, tag, why: String(r.think || '').slice(0, 90), source: pkt.source, mock: pkt.mock });
      const r2 = await this.callCell(aid, 'act.choose', { ...ctx, pack: pkt.floats, mothLeft: left });
      if (r2) r = { ...r2, usedPack: true };
    }
    return r;
  }

  // ── the jev-revision seam: ONE typesafe batch per revise step ───────────────
  async jevSeam(aid, { setNo, budgetN, letter, budget, tag, point }) {
    if (!this.jev) return null;
    // focal opponent = the one we have the most observations of
    let focal = null, bestN = 0;
    for (const o of SEATS) {
      if (o === aid) continue;
      const m = (await this.cell(aid, `inf.${o}`)) || {};
      if ((m.n ?? 0) > bestN) { bestN = m.n; focal = o; }
    }
    if (!focal) return null;
    const model = (await this.cell(aid, `inf.${focal}`)) || {};
    if (!model.n) return null;
    const scriptV = await this.cell(aid, 'script.v');
    const styles = await this.styles(aid);
    const state = buildSeamState({
      aid, scriptV, setNo, budgetN, letter, focal, model, styles,
      spendRatio: (budget.spent[aid] ?? 0) / Math.max(1, budgetN),
      mothLeft: budget.left[aid] ?? 0,
    });
    const questions = buildSeamQuestions({ focal, model, mothLeft: budget.left[aid] ?? 0 });
    const { answers, usage, source, mock } =
      await this.jev.decide(state, questions, { tag: tag || `seam:${aid}:s${setNo}:${point}` });
    const teachIn = seamAnswerToTeachInput(answers);
    const res = await this.callCell(aid, 'jev.teach', { mover: focal, ...teachIn, source, mock });
    this.ledger.push({
      kind: 'jev_seam', by: aid, setNo, point, focal, source, mock,
      mae: res.mae, lam: res.lam, flipped: res.flipped, tv: res.tv,
      beforeTop: res.beforeTop, afterTop: res.afterTop, dist: res.post,
    });
    this.seams.push({ setNo, point, focal, source, mock, usage, tag, res });
    return res;
  }

  // ── G1 MOTHRA (minesweeper duel) ────────────────────────────────────────────
  async playMines(seats, rng, budget, opts = {}) {
    const [a, b] = seats;
    const board = minesNewBoard(rng);
    const revealed = new Array(49).fill(false);
    const history = [];
    const rec = { game: 'mines', board, seats, turns: [], score: 0 };
    const scores = { [a]: 0, [b]: 0 };
    let mover = opts.firstMove === 'second' ? b : a;
    let guard = 0;
    while (minesLegal(revealed).length > 0 && guard++ < 60) {
      const legal = minesLegal(revealed);
      const feats = minesFeatures(board, revealed, history, mover);
      const oppName = mover === a ? b : a;
      let pred = null;
      if (opts.learn) {
        const p = await this.callCell(oppName, 'inf.predict', { game: 'mines', mover, feats });
        pred = p ? p.pick : null;
      }
      const ctx = { game: 'mines', feats, opp: [oppName], stake: 1 + Math.max(0, ...Object.values(feats).map((f) => f.adj)) };
      const d = await this.decide(mover, ctx, budget, `mines-${history.length}`);
      const pick = Number(d.pick);
      if (!legal.includes(pick)) throw new Error(`${mover} illegal mines pick ${pick}`);
      const mine = board.mines.includes(pick);
      revealed[pick] = true;
      scores[mover] += mine ? MINES.MINE_PTS : MINES.SAFE_PTS;
      history.push({ mover, legal, picked: pick });
      rec.turns.push({ mover, picked: pick, numShown: board.num[pick], mine, spend: d.spend || 0, think: String(d.think || '').slice(0, 80) });
      this.ledger.push({ kind: 'move', game: 'mines', mover, pick, mine, pred, spend: d.spend || 0, think: String(d.think || '').slice(0, 60) });
      if (opts.learn) {
        await this.callCell(oppName, 'inf.update', {
          game: 'mines', mover, feats, picked: pick, lastPredict: pred, oppNames: [mover],
          obs: { risk: (feats[pick]?.adj ?? 0) + (feats[pick]?.adjSum ?? 0) },
        });
      }
      mover = mover === a ? b : a;
    }
    rec.scoreA = scores[a]; rec.scoreB = scores[b]; rec.score = scores[seats[0]];
    minesVerify(rec);
    return rec;
  }

  // ── G2 WEAVER (hearts trio) ─────────────────────────────────────────────────
  async aggrMeanFor(aid, oppNames) {
    let s = 0, n = 0;
    for (const o of oppNames) {
      const m = (await this.cell(aid, `inf.${o}`)) || {};
      if (m.aggr != null) { s += m.aggr; n++; }
    }
    return n ? s / n : 0.5;
  }

  async playHearts(seats, rng, budget, opts = {}) {
    const hands = heartsDeal(rng);
    const playedAll = new Set();
    const voidEv = [new Set(), new Set(), new Set()];
    const rec = { game: 'hearts', seats, hands: hands.map((h) => [...h]), leader: 0, tricks: [], totals: [0, 0, 0] };
    const totals = [0, 0, 0];
    let leader = 0;
    const povFeats = (povIdx, candidates, led, tp, aggrMean) => {
      const seen = new Set([...hands[povIdx], ...playedAll]);
      const i1 = (povIdx + 1) % 3, i2 = (povIdx + 2) % 3;
      const oppCounts = [[i1, hands[i1].length], [i2, hands[i2].length]];
      return heartsFeats(candidates, led, tp, seen, playedAll, voidEv, oppCounts, aggrMean);
    };
    for (let t = 0; t < 9; t++) {
      let ledSuit = null;
      const plays = [];
      for (let i = 0; i < 3; i++) {
        const s = (leader + i) % 3;
        const mover = seats[s];
        const legal = heartsLegal(hands[s], ledSuit);
        const tp = plays.reduce((a2, p) => a2 + ptsOf(p.card), 0);
        const oppNames = seats.filter((x) => x !== mover);
        const aggrMean = await this.aggrMeanFor(mover, oppNames);
        const moverFeats = povFeats(s, legal, ledSuit, tp, aggrMean);
        const preds = {};
        if (opts.learn) {
          for (const so of [0, 1, 2]) {
            if (so === s) continue;
            const obs = seats[so];
            const ofeats = povFeats(so, legal, ledSuit, tp, aggrMean);
            const p = await this.callCell(obs, 'inf.predict', { game: 'hearts', mover, feats: ofeats });
            preds[obs] = { pick: p ? p.pick : null, feats: ofeats };
          }
        }
        const d = await this.decide(mover, { game: 'hearts', feats: moverFeats, opp: oppNames, stake: tp }, budget, `hearts-t${t}-s${s}`);
        const card = String(d.pick);
        if (!legal.includes(card)) throw new Error(`${mover} illegal hearts play ${card} legal=${legal.join(',')}`);
        plays.push({ seat: s, mover, card, preds, spend: d.spend || 0, think: String(d.think || '').slice(0, 60) });
        hands[s].splice(hands[s].indexOf(card), 1);
        playedAll.add(card);
        if (ledSuit == null) ledSuit = suitOf(card);
        else if (suitOf(card) !== ledSuit) voidEv[s].add(ledSuit);
        this.ledger.push({ kind: 'move', game: 'hearts', trick: t, mover, card, spend: d.spend || 0, think: String(d.think || '').slice(0, 60) });
      }
      const led = suitOf(plays[0].card);
      let best = plays[0];
      for (const p of plays) if (suitOf(p.card) === led && rankOf(p.card) > rankOf(best.card)) best = p;
      const tPts = plays.reduce((a2, p) => a2 + ptsOf(p.card), 0);
      totals[best.seat] += tPts;
      rec.tricks.push({ n: t, plays: plays.map((p) => ({ seat: p.seat, card: p.card })), winner: best.seat });
      leader = best.seat;
      if (opts.learn) {
        for (const p of plays) {
          const won = best.seat === p.seat;
          const obsFlags = {
            won,
            couldDuck: suitOf(p.card) === led && hands[p.seat].some((c) => suitOf(c) === led && rankOf(c) < rankOf(p.card)),
            tookPts: won && tPts > 0,
            pts: ptsOf(p.card),
          };
          const aboutSelf = [];
          for (const obsName of Object.keys(p.preds)) {
            const row = p.preds[obsName];
            if (familyOf(p.mover) === 'MASK') {
              aboutSelf.push({ by: obsName, predicted: row.pick, actual: p.card, featsAll: row.feats });
            }
            await this.callCell(obsName, 'inf.update', {
              game: 'hearts', mover: p.mover, feats: row.feats, picked: p.card,
              lastPredict: row.pick, oppNames: [p.mover], obs: obsFlags,
            });
          }
          if (aboutSelf.length) {
            await this.callCell(p.mover, 'inf.update', {
              game: 'hearts', mover: p.mover, feats: {}, picked: p.card, lastPredict: null,
              oppNames: [p.mover], obs: obsFlags, aboutSelf, selfRun: true,
            });
          }
        }
      }
    }
    rec.totals = totals;
    heartsVerify(rec);
    return rec;
  }

  // ── a SET = 10 mines duels + 10 hearts trios (full round-robin, 5 seats) ────
  async runSet(setNo, budgetN, { learn = true, tag = '', live = false, vault = null } = {}) {
    const savedVault = this.vault;
    if (vault) this.vault = vault;
    try {
      return await this.runSetInner(setNo, budgetN, { learn, tag, live });
    } finally {
      this.vault = savedVault;
    }
  }

  async runSetInner(setNo, budgetN, { learn = true, tag = '', live = false } = {}) {
    const rng = mulberry32(0xe12 + setNo * 777 + (live ? 555 : 0));
    const budget = { left: {}, spent: {}, setNo };
    for (const aid of SEATS) { budget.left[aid] = budgetN; budget.spent[aid] = 0; await this.engines[aid].set('moth.left', budgetN); }
    this.gate = { decisions: 0, gateOpen: 0, bought: 0, budgetBlocked: 0 };
    const results = [];
    for (const [i, j] of PAIRS) {
      const firstMove = rng() < 0.5 ? 'first' : 'second';
      const rec = await this.playMines([`p${i}`, `p${j}`], rng, budget, { learn, firstMove });
      results.push({ game: 'mines', seats: [`p${i}`, `p${j}`], a: rec.scoreA, b: rec.scoreB });
    }
    if (learn && this.seamPoints.includes('mines')) {
      await this.jevSeam('p4', { setNo, budgetN, letter: 'M', budget, tag: `${tag || ''}mines-block`.trim(), point: 'mines' });
    }
    for (const trio of TRIOS) {
      const rec = await this.playHearts(trio.map((i) => `p${i}`), rng, budget, { learn });
      results.push({ game: 'hearts', seats: trio.map((i) => `p${i}`), totals: rec.totals });
    }
    if (learn && this.seamPoints.includes('hearts')) {
      await this.jevSeam('p4', { setNo, budgetN, letter: 'H', budget, tag: `${tag || ''}hearts-block`.trim(), point: 'hearts' });
    }
    // margins per agent (identical arithmetic to the arena)
    const margins = Object.fromEntries(SEATS.map((s) => [s, 0]));
    for (const r of results) {
      if (r.game === 'mines') {
        margins[r.seats[0]] += r.a - r.b; margins[r.seats[1]] += r.b - r.a;
      } else {
        for (let k = 0; k < 3; k++) {
          const others = r.totals.filter((_, q) => q !== k);
          margins[r.seats[k]] += (Math.min(...others) - r.totals[k]);
        }
      }
    }
    const standings = Object.entries(margins).sort((x, y) => y[1] - x[1]);
    const winner = standings[0][0];
    // craftmind phase: letters + revise for everyone; the seam teaches first
    const revisions = {};
    const gateStats = { ...this.gate };
    if (learn) {
      const winnerStyles = await this.styles(winner);
      for (const aid of SEATS) {
        const models = [];
        for (const o of SEATS) if (o !== aid) models.push((await this.cell(aid, `inf.${o}`)) || {});
        const withN = models.filter((m) => m.n > 0);
        const acc = withN.reduce((a, m) => a + (m.acc ?? 0), 0) / Math.max(1, withN.length);
        const part = (await this.cell(aid, 'participation')) || {};
        const dig = {
          setNo, won: aid === winner, margin: margins[aid] / 10,
          acc, participation: part, spendRatio: (budget.spent[aid] ?? 0) / Math.max(1, budgetN),
          leaderStyle: aid === winner ? null : winnerStyles,
        };
        const L = await this.analyst.call(dig);
        if (aid === 'p4' && this.seamPoints.includes('end')) {
          await this.jevSeam(aid, { setNo, budgetN, letter: L.letter, budget, tag: `${tag || ''}end`.trim(), point: 'end' });
        }
        const rev = await this.callCell(aid, 'learn.revise', { digest: { ...dig, letter: L.letter }, family: familyOf(aid) });
        revisions[aid] = { ...rev, letter: L.letter, letterMock: L.mock };
        this.ledger.push({ kind: 'revise', by: aid, setNo, letter: L.letter, novelty: rev.novelty, v: rev.v, note: rev.note });
      }
    }
    return { setNo, tag: tag + (live ? ':LIVE' : ''), budget: budgetN, standings, margins, spent: budget.spent, results, revisions, gateStats };
  }
}
