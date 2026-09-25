// E12 — THE TOURNAMENT DRIVER. The world the minds live in.
//
//   decide()    two-step spend protocol: the mind RUNS deterministic; if its
//               policy asks for perception (spend=1) and budget remains, the
//               driver buys ONE vault packet (a real moth-quantum job, cached
//               forever) and re-runs the same pure script with true entropy
//               in hand. A MOTH call is a purchase, receipted.
//   playMines() G1 duel + playHearts() G2 trio — everyone predicts everyone
//               before each move (perception is universal); after each move
//               every observer's inf.update fits what the mover just did.
//   Phases:     A mechanical (inference off, budget 0) → B perception on
//               (budget rotates 0/2/4) → C script-writer (craftmind revise
//               between sets + analyst letter A-E) ending in a LIVE
//               championship set on the real quantum API + entanglement
//               reads around the convergence arc.

import { QuiltEngine } from '../engine/index.js';
import { mulberry32 } from '../shared/kit.mjs';
import {
  MINES, HRANKS, HDECK, rankOf, suitOf, ptsOf,
  minesNewBoard, minesLegal, minesFeatures, minesScore, minesVerify,
  heartsDeal, heartsLegal, heartsWinp, heartsFeats, heartsVerify, clamp,
} from './games.mjs';
import { buildAgentSheet, FAMILIES, STYLE_KEYS, MW_FEATS, HW_FEATS } from './minds.mjs';

const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const TRIOS = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];

// ── the analyst (letter fence A–E, mock or real GLM) ─────────────────────────
export class AnalystAI {
  constructor({ mock = true, realFromSetNo = Infinity } = {}) {
    this.mock = mock; this.realFromSetNo = realFromSetNo; this.zai = null; this.calls = 0; this.realCalls = 0;
  }
  async init() {
    if (!this.mock && !this.zai) {
      const { default: ZAI } = await import('z-ai-web-dev-sdk');
      this.zai = await ZAI.create();
    }
    return this;
  }
  async call(digest) {
    this.calls++;
    const wantReal = !this.mock && (digest.setNo ?? 0) >= this.realFromSetNo;
    if (wantReal) {
      try {
        const prompt = [
          'You are the script-writer for a competitive agent arena. Reply with ONE letter only.',
          'A stay course | B raise exploration | C concentrate on the strongest style',
          'D imitate the set leader | E prune the least-used styles',
          `Digest: lost=${digest.lost} margin=${digest.margin?.toFixed?.(2)} acc=${digest.acc?.toFixed?.(2)} spendRatio=${digest.spendRatio?.toFixed?.(2)} setNo=${digest.setNo}`,
        ].join('\n');
        const completion = await this.zai.chat.completions.create({
          messages: [{ role: 'user', content: prompt }], thinking: { type: 'disabled' },
        });
        const txt = (completion.choices[0]?.message?.content ?? '').trim();
        const m = /[ABCDE]/.exec(txt);
        if (m) { this.realCalls++; return { letter: m[0], mock: false }; }
      } catch { /* fall through to doctrine */ }
    }
    // state-reactive deterministic doctrine (labeled mock everywhere)
    let letter = 'A';
    if ((digest.acc ?? 1) < 0.35 && digest.leaderStyle) letter = 'D';
    else if (digest.lost) letter = 'C';
    else if ((digest.spendRatio ?? 0) > 0.85 && digest.setNo > 0) letter = 'B';
    else if (digest.setNo % 2 === 1) letter = 'B';
    return { letter, mock: true };
  }
}

// ── the arena ────────────────────────────────────────────────────────────────
export class Arena {
  constructor({ vault, analyst, ledger = [] } = {}) {
    this.vault = vault;
    this.analyst = analyst;
    this.ledger = ledger; // shared receipt list (decision rows)
    this.engines = {};
    this.spendSeq = 0;
    this.styleCache = {};
  }

  async boot() {
    for (let i = 0; i < 4; i++) {
      const aid = `p${i}`;
      const e = new QuiltEngine(`arena-${aid}`, { eager: false });
      await e.loadSheet(buildAgentSheet(aid, FAMILIES[i]));
      this.engines[aid] = e;
    }
  }

  // driver-side read helpers
  async cell(aid, id) { return (await this.engines[aid].get(id)).data; }

  // cells fail SILENTLY ({status:'error'}) if you let them — E12's own
  // engine lesson: every program-cell call goes through here and THROWS.
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

  // ── the two-step perception purchase ───────────────────────────────────────
  async decide(aid, ctx, budget, tag) {
    const e = this.engines[aid];
    let left = budget.left[aid] ?? 0;
    let r = await this.callCell(aid, 'act.choose', { ...ctx, pack: null, mothLeft: left });
    if (r && r.spend && left > 0) {
      const pkt = await this.vault.packet(`p:${aid}:${tag}:${this.spendSeq++}`);
      left -= 1;
      budget.left[aid] = left;
      budget.spent[aid] = (budget.spent[aid] ?? 0) + 1;
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

  // ── G1 MOTHRA ──────────────────────────────────────────────────────────────
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
      // universal perception: the other mind predicts this move
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
      // the observer fits the mover's formula
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

  // ── G2 WEAVER ──────────────────────────────────────────────────────────────
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
    const voidEv = [new Set(), new Set(), new Set()]; // keyed by trio seat index
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
        const tp = plays.reduce((a, p) => a + ptsOf(p.card), 0);
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
      // resolve the trick
      const led = suitOf(plays[0].card);
      let best = plays[0];
      for (const p of plays) if (suitOf(p.card) === led && rankOf(p.card) > rankOf(best.card)) best = p;
      const tPts = plays.reduce((a, p) => a + ptsOf(p.card), 0);
      totals[best.seat] += tPts;
      rec.tricks.push({ n: t, plays: plays.map((p) => ({ seat: p.seat, card: p.card })), winner: best.seat });
      leader = best.seat;
      // every observer fits every mover play, now that the outcome is known
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
            if (FAMILIES[Number(p.mover[1])] === 'MASK') {
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

  // ── a SET = 6 mines duels + 4 hearts trios, one budget regime ───────────────
  async runSet(setNo, budgetN, { learn = true, tag = '', live = false, vault = null } = {}) {
    const savedVault = this.vault;
    if (vault) this.vault = vault; // championship sets buy perception elsewhere
    try {
      return await this.runSetInner(setNo, budgetN, { learn, tag, live });
    } finally {
      this.vault = savedVault;
    }
  }

  async runSetInner(setNo, budgetN, { learn = true, tag = '', live = false } = {}) {
    const rng = mulberry32(0xe12 + setNo * 777 + (live ? 555 : 0));
    const budget = { left: {}, spent: {}, setNo };
    for (const f of FAMILIES) { const aid = `p${FAMILIES.indexOf(f)}`; budget.left[aid] = budgetN; budget.spent[aid] = 0; await this.engines[aid].set('moth.left', budgetN); }
    const results = [];
    for (const [i, j] of PAIRS) {
      const firstMove = rng() < 0.5 ? 'first' : 'second';
      const rec = await this.playMines([`p${i}`, `p${j}`], rng, budget, { learn, firstMove });
      results.push({ game: 'mines', seats: [`p${i}`, `p${j}`], a: rec.scoreA, b: rec.scoreB });
    }
    for (const trio of TRIOS) {
      const rec = await this.playHearts(trio.map((i) => `p${i}`), rng, budget, { learn });
      results.push({ game: 'hearts', seats: trio.map((i) => `p${i}`), totals: rec.totals });
    }
    // margins per agent
    const margins = { p0: 0, p1: 0, p2: 0, p3: 0 };
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
    // script-writer phase (craftmind): revise every script, receipt, letters
    const revisions = {};
    if (learn) {
      const winnerStyles = await this.styles(winner);
      for (let i = 0; i < 4; i++) {
        const aid = `p${i}`;
        const models = [];
        for (const o of ['p0', 'p1', 'p2', 'p3']) if (o !== aid) models.push((await this.cell(aid, `inf.${o}`)) || {});
        const acc = models.filter((m) => m.n > 0).reduce((a, m) => a + (m.acc ?? 0), 0) / Math.max(1, models.filter((m) => m.n > 0).length);
        const part = (await this.cell(aid, 'participation')) || {};
        const dig = {
          setNo, won: aid === winner, margin: margins[aid] / 10,
          acc, participation: part, spendRatio: (budget.spent[aid] ?? 0) / Math.max(1, budgetN),
          leaderStyle: aid === winner ? null : winnerStyles,
        };
        const L = await this.analyst.call(dig);
        const rev = await this.callCell(aid, 'learn.revise', { digest: { ...dig, letter: L.letter }, family: FAMILIES[i] });
        revisions[aid] = { ...rev, letter: L.letter, letterMock: L.mock };
        this.ledger.push({ kind: 'revise', by: aid, setNo, letter: L.letter, novelty: rev.novelty, v: rev.v, note: rev.note });
      }
    }
    return { setNo, tag: tag + (live ? ':LIVE' : ''), budget: budgetN, standings, margins, spent: budget.spent, results, revisions };
  }
}

function trickPlaysFor(plays) { return plays.map((p) => ({ seat: p.seat, card: p.card })); }
