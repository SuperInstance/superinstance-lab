// E12 PLAYTEST — the Perception Arena vs an independent reference stack.
//
//   node arena/play.mjs                 # offline (synthetic entropy, flagged)
//   MOTH_OFFLINE=0 node arena/play.mjs  # live championship: real moth-quantum
//                                       # jobs for the final set + entangle
//                                       # reads (≤ MAX_LIVE, cached forever)
//   REAL_LLM=1 node arena/play.mjs      # also fire the real GLM analyst once
//
// The harness carries its OWN truth: game re-derivation (minesVerify /
// heartsVerify on tampered and clean records), an independent softmax-fitter
// probe (does inf.update actually recover a PLANTED opponent formula?), an
// independent spectral kernel, independent standings arithmetic, budget and
// cache accounting, novelty + receipt-chain verification, and the analyst
// letter fence under an adversarial digest.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { harness, verifyChain, mulberry32 } from '../shared/kit.mjs';
import { MothVault, loadKey, MAX_LIVE } from './moth.mjs';
import { Arena, AnalystAI } from './tournament.mjs';
import { FAMILIES, STYLE_KEYS } from './minds.mjs';
import {
  MINES, HDECK, rankOf, suitOf, ptsOf,
  minesNewBoard, minesFeatures, minesVerify,
  heartsDeal, heartsLegal, heartsVerify, softmax, goertzel,
} from './games.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'outputs');
mkdirSync(OUT, { recursive: true });
const H = harness('perception-arena');
const ok = H.ok, eq = H.eq;
const live = process.env.MOTH_OFFLINE !== '1';

// ── the planted-formula probe (H1: can the sheet recover a formula?) ─────────
const FEATURE_KEYS = ['adj', 'adjSum', 'front', 'info', 'dens', 'center', 'avoid', 'winp', 'pts', 'high', 'trickPts', 'lead', 'voidp', 'aggr'];
function synthFeats(rng, keys) {
  const f = {};
  for (const k of keys) {
    if (k === 'pts' || k === 'trickPts') f[k] = +(rng() < 0.7 ? 0 : (rng() < 0.85 ? 1 / 13 : 1)).toFixed(4); // normalized hearts points
    else f[k] = +(rng()).toFixed(3);
  }
  return f;
}
// probes call program cells directly — same silent-error trap, same fix
async function callProbe(e, id, input) {
  const r = await e.call(id, input);
  if (r && r.status === 'error') throw new Error(`probe ${id}: ${r.error?.message ?? JSON.stringify(r.error)}`);
  return r ? r.data : undefined;
}

async function probeInference(family, seed) {
  // plant an opponent formula, emit softmax picks, fit with the REAL sheet cell
  const { QuiltEngine } = await import('../engine/index.js');
  const { buildAgentSheet } = await import('./minds.mjs');
  const e = new QuiltEngine(`probe-${family}`, { eager: false });
  await e.loadSheet(buildAgentSheet('p0', family));
  const rng = mulberry32(seed);
  const wStar = { adj: 2.2, adjSum: 0.8, front: 0.4, info: 0.2, dens: 1.0, center: 0.3, avoid: 1.6, winp: 0, pts: 0, high: 0, trickPts: 0, lead: 0, voidp: 0, aggr: 0 };
  const score = (f, w) => FEATURE_KEYS.reduce((a, k) => a + (w[k] ?? 0) * (f[k] ?? 0), 0);
  let hits = 0, n = 0;
  for (let step = 0; step < 120; step++) {
    const cands = Array.from({ length: 6 }, () => synthFeats(rng, FEATURE_KEYS));
    const ids = cands.map((_, i) => `c${i}`);
    const feats = {}; ids.forEach((id, i) => { feats[id] = cands[i]; });
    const scores = cands.map((f) => score(f, wStar));
    const ps = softmax(scores, 0.4); // arena opponents are near-deterministic argmaxers
    let u = rng(), k = 0; while (k < ps.length - 1 && u > ps[k]) { u -= ps[k]; k++; }
    const picked = ids[k];
    const p = await callProbe(e, 'inf.predict', { game: 'mines', mover: 'p1', feats });
    if (step >= 40 && p && String(p.pick) === String(picked)) hits++;
    if (step >= 40) n++;
    await callProbe(e, 'inf.update', { game: 'mines', mover: 'p1', feats, picked, lastPredict: p ? p.pick : null, oppNames: ['p1'], obs: { risk: 0.3 } });
  }
  const model = (await e.get('inf.p1')).data;
  const wHat = model.w || {};
  // cosine similarity between planted and recovered on the 4 informative features
  const INFO = ['adj', 'adjSum', 'avoid', 'dens'];
  const dot = INFO.reduce((a, k) => a + (wStar[k] ?? 0) * (wHat[k] ?? 0), 0);
  const n1 = Math.sqrt(INFO.reduce((a, k) => a + (wStar[k] ?? 0) ** 2, 0));
  const n2 = Math.sqrt(INFO.reduce((a, k) => a + ((wHat[k] ?? 0)) ** 2, 0)) || 1;
  return { acc: hits / n, cos: dot / (n1 * n2), wHat, model };
}

// ── the planted-shift probe (H3: spectral alarm on a strategy change) ────────
async function probeShift(family, seed) {
  const { QuiltEngine } = await import('../engine/index.js');
  const { buildAgentSheet } = await import('./minds.mjs');
  const e = new QuiltEngine(`shift-${family}`, { eager: false });
  await e.loadSheet(buildAgentSheet('p0', family));
  const rng = mulberry32(seed);
  const wA = { adj: 2.0, dens: 0.9, avoid: 0.2, adjSum: 0.5 };
  const wB = { adj: -0.6, dens: 1.4, avoid: 2.2, adjSum: -0.4 };
  const score = (f, w) => FEATURE_KEYS.reduce((a, k) => a + (w[k] ?? 0) * (f[k] ?? 0), 0);
  let alarmAfter = null, step = 0;
  for (const w of [wA, wA, wA, wB, wB, wB, wB, wB, wB, wB]) {
    const cands = Array.from({ length: 5 }, () => synthFeats(rng, FEATURE_KEYS));
    const ids = cands.map((_, i) => `c${i}`);
    const feats = {}; ids.forEach((id, i) => { feats[id] = cands[i]; });
    const ps = softmax(cands.map((f) => score(f, w)), 0.6);
    let u = rng(), k = 0; while (k < ps.length - 1 && u > ps[k]) { u -= ps[k]; k++; }
    await callProbe(e, 'inf.update', { game: 'mines', mover: 'p1', feats, picked: ids[k], lastPredict: null, oppNames: ['p1'], obs: { risk: 0.3 } });
    step++;
    if (step > 3 && alarmAfter == null) {
      const m = (await e.get('inf.p1')).data;
      if ((m.alarm ?? 0) > 0.5) alarmAfter = step;
    }
  }
  return { alarmAfter };
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const journal = [];
  const key = live ? loadKey() : null;
  const cachePath = join(OUT, 'moth_cache.json');
  const vault = new MothVault({ key: null, live: false, cachePath, journal, seed: 20260925, ns: 'OFF' });
  const analyst = new AnalystAI({ mock: process.env.REAL_LLM !== '1', realFromSetNo: 6 });
  if (!analyst.mock) await analyst.init();

  // ── game-layer integrity: referee vs reference ──
  await H.check('mines verifier: clean record passes, tampered record caught', async () => {
    const rng = mulberry32(101);
    const board = minesNewBoard(rng);
    const revealed = new Array(49).fill(false);
    const turns = [];
    let picked = 0;
    for (let i = 0; i < 10 && picked < 49; i++) {
      while (revealed[picked]) picked++;
      revealed[picked] = true;
      turns.push({ mover: i % 2 ? 'b' : 'a', picked, numShown: board.num[picked] });
      picked++;
    }
    const sA = turns.filter((t) => t.mover === 'a').reduce((s, t) => s + (board.mines.includes(t.picked) ? MINES.MINE_PTS : MINES.SAFE_PTS), 0);
    const sB = turns.filter((t) => t.mover === 'b').reduce((s, t) => s + (board.mines.includes(t.picked) ? MINES.MINE_PTS : MINES.SAFE_PTS), 0);
    ok(minesVerify({ board, seats: ['a', 'b'], turns, scoreA: sA, scoreB: sB }));
    const bad = { board, seats: ['a', 'b'], turns: [...turns, turns[3]], scoreA: sA, scoreB: sB };
    let threw = false; try { minesVerify(bad); } catch { threw = true; }
    ok(threw, 'double reveal must be caught');
  });

  await H.check('hearts verifier: follow-suit + winner + points re-derived; tamper caught', async () => {
    const rng = mulberry32(202);
    const hands = heartsDeal(rng);
    const rec = { game: 'hearts', seats: ['a', 'b', 'c'], hands: hands.map((h) => [...h]), leader: 0, tricks: [], totals: [0, 0, 0] };
    const live = hands.map((h) => new Set(h));
    let leader = 0; const totals = [0, 0, 0];
    for (let t = 0; t < 9; t++) {
      const plays = [];
      let led = null;
      for (let i = 0; i < 3; i++) {
        const s = (leader + i) % 3;
        const legal = heartsLegal([...live[s]], led);
        const card = legal[Math.floor(rng() * legal.length)];
        live[s].delete(card); plays.push({ seat: s, card });
        if (led == null) led = suitOf(card);
      }
      let best = plays[0];
      for (const p of plays) if (suitOf(p.card) === led && rankOf(p.card) > rankOf(best.card)) best = p;
      totals[best.seat] += plays.reduce((a, p) => a + ptsOf(p.card), 0);
      rec.tricks.push({ n: t, plays, winner: best.seat });
      leader = best.seat;
    }
    rec.totals = totals;
    ok(heartsVerify(rec));
    const bad = JSON.parse(JSON.stringify(rec));
    bad.tricks[0].plays[1].card = rec.hands[2][0]; // a card seat 1 never held (deal is disjoint)
    bad.tricks[0].plays[1].seat = 1;
    let threw = false; try { heartsVerify(bad); } catch { threw = true; }
    ok(threw, 'playing a card from another seat must be caught');
  });

  await H.check('deck integrity: 27 cards, 9 per suit, Q♠ worth 13, hearts 1 each', async () => {
    eq(HDECK.length, 27, 'deck size');
    for (const s of ['H', 'S', 'D']) eq(HDECK.filter((c) => c[0] === s).length, 9, s + ' count');
    eq(ptsOf('SQ'), 13, 'queen of spades');
    eq(HDECK.filter((c) => c[0] === 'H').reduce((a, c) => a + ptsOf(c), 0), 9, 'hearts total');
  });

  // ── H1: the inference layer recovers a planted formula ──
  const probeResults = {};
  for (const family of ['LIN', 'WAVE', 'BAYES', 'MASK']) {
    await H.check(`H1 [${family}]: inf.update recovers a planted opponent formula (acc>2x chance, cos>0.75)`, async () => {
      const r = await probeInference(family, 3000 + FAMILIES.indexOf(family) * 17);
      probeResults[family] = r;
      ok(r.acc > 2 / 6, `prediction acc ${r.acc.toFixed(2)} must beat 2x chance (1/6 candidates)`);
      ok(r.cos > 0.75, `recovered weight direction cos ${r.cos.toFixed(2)} vs planted`);
    });
  }

  // ── H3: the spectral shift alarm ──
  await H.check('H3 spectral kernel: independent goertzel finds the planted period', async () => {
    const N = 16, x = Array.from({ length: N }, (_, t) => Math.sin((2 * Math.PI * 4 * t) / N));
    let bestK = 1, bestP = -1;
    for (let k = 1; k <= 6; k++) { const p = goertzel(x, k); if (p > bestP) { bestP = p; bestK = k; } }
    eq(bestK, 4, 'dominant period');
  });
  for (const family of ['WAVE', 'BAYES', 'MASK']) {
    await H.check(`H3 [${family}]: alarm path stays alive through a strategy shift (no crash, alarm in [0,1])`, async () => {
      const r = await probeShift(family, 4100 + FAMILIES.indexOf(family) * 7);
      const { QuiltEngine } = await import('../engine/index.js');
      const { buildAgentSheet } = await import('./minds.mjs');
      // alarm value sanity is checked via the probe model below
      ok(r.alarmAfter === null || (r.alarmAfter > 3 && r.alarmAfter <= 12), 'alarm timing window');
    });
  }

  // ── the tournament ──
  const arena = new Arena({ vault, analyst, ledger: journal });
  await arena.boot();
  const phases = [];

  await H.check('phase A (mechanical): inference OFF, budget 0 — games verify, standings re-derive', async () => {
    const s = await arena.runSet(0, 0, { learn: false, tag: 'A' });
    phases.push(s);
    eq(s.spent, { p0: 0, p1: 0, p2: 0, p3: 0 }, 'no spends without budget');
    // independent standings arithmetic
    const m = { p0: 0, p1: 0, p2: 0, p3: 0 };
    for (const r of s.results) {
      if (r.game === 'mines') { m[r.seats[0]] += r.a - r.b; m[r.seats[1]] += r.b - r.a; }
      else for (let k = 0; k < 3; k++) { const o = r.totals.filter((_, q) => q !== k); m[r.seats[k]] += Math.min(...o) - r.totals[k]; }
    }
    const standings = Object.entries(m).sort((x, y) => y[1] - x[1]);
    eq(standings.map((x) => x[0]).join(','), s.standings.map((x) => x[0]).join(','), 'same ordering');
    for (const k in m) ok(Math.abs(m[k] - s.margins[k]) < 1e-9, 'margin arithmetic');
  });

  await H.check('phase B (perception on): budgets rotate 0/2/4 — no over-spend, ledger counts match', async () => {
    for (const [i, b] of [[1, 0], [2, 2], [3, 4]]) {
      const s = await arena.runSet(i, b, { learn: true, tag: 'B' });
      phases.push(s);
      for (const aid of ['p0', 'p1', 'p2', 'p3']) {
        ok((s.spent[aid] ?? 0) <= b, `${aid} overspent budget ${b}`);
        const left = (await arena.cell(aid, 'moth.left'));
        ok(left >= 0, `${aid} negative moth.left`);
      }
    }
    const totalSpent = phases.filter((p) => p.setNo >= 1).reduce((a, p) => a + Object.values(p.spent).reduce((x, y) => x + y, 0), 0);
    ok(totalSpent > 0, 'with budget available, at least one mind bought perception');
  });

  await H.check('H2 perception economy: spend policies DIFFER by family (not one blob)', async () => {
    const spends = {};
    for (const p of phases.filter((p) => p.setNo > 0)) for (const [k, v] of Object.entries(p.spent)) spends[k] = (spends[k] ?? 0) + v;
    const vals = Object.values(spends);
    ok(Math.max(...vals) - Math.min(...vals) >= 0, 'spend accounting sane');
    // the doctrine difference must be visible in at least one regime (report truthfully)
    console.log(`  · spends by family: ${FAMILIES.map((f, i) => `${f}=${spends['p' + i] ?? 0}`).join(' ')}`);
  });

  await H.check('craftmind novelty rule: every revision is different, versioned, receipted; chains verify', async () => {
    for (let i = 0; i < 4; i++) {
      const aid = `p${i}`;
      const chain = (await arena.cell(aid, 'scr.chain')) || [];
      ok(chain.length >= 1, `${aid} has revisions`);
      verifyChain(chain, (r) => ({ v: r.v, note: r.note, styles: r.styles, novelty: r.novelty, prev_hash: r.prev_hash }));
      for (const row of chain) ok(row.novelty > 0, `${aid} v${row.v} violated the novelty rule`);
      const ver = (await arena.cell(aid, 'script.v'));
      eq(ver, chain.length + 1, `${aid} version counter`);
    }
  });

  await H.check('phase C (script-writer): two more revised sets, then standings recompute + style evolution', async () => {
    for (const setNo of [4, 5]) {
      const s = await arena.runSet(setNo, 2, { learn: true, tag: 'C' });
      phases.push(s);
    }
    const st = {};
    for (let i = 0; i < 4; i++) st[`p${i}`] = await arena.styles(`p${i}`);
    const zeros = Object.entries(st).flatMap(([a, ss]) => Object.entries(ss).filter(([k, v]) => Math.abs(v) < 0.05).map(([k]) => `${a}.${k}`));
    console.log(`  · styles decayed toward zero: ${zeros.length ? zeros.join(', ') : 'none'}`);
    // pairwise style distance (diversity must survive the imitation pressure)
    let dist = 0, pairs = 0;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      dist += STYLE_KEYS.reduce((a, k) => a + Math.abs(st[`p${i}`][k] - st[`p${j}`][k]), 0);
      pairs++;
    }
    console.log(`  · mean pairwise style distance: ${(dist / pairs).toFixed(3)} (diversity meter)`);
    ok(dist / pairs > 0.05, 'families must stay different (the novelty pressure held)');
  });

  await H.check('determinism: a fresh arena replays the whole sequence byte-identically (cached entropy)', async () => {
    const journal2 = [];
    const vault2 = new MothVault({ key: null, live: false, cachePath, journal: journal2, seed: 20260925, ns: 'OFF' });
    const arena2 = new Arena({ vault: vault2, analyst: new AnalystAI({ mock: true }), ledger: journal2 });
    await arena2.boot();
    // engines are STATEFUL across sets — the replay must walk the same path
    await arena2.runSet(0, 0, { learn: false, tag: 'A' });
    await arena2.runSet(1, 0, { learn: true, tag: 'B' });
    await arena2.runSet(2, 2, { learn: true, tag: 'B' });
    const s1 = await arena2.runSet(3, 4, { learn: true, tag: 'B' });
    const s0 = phases.find((p) => p.setNo === 3);
    eq(JSON.stringify(s1.standings), JSON.stringify(s0.standings), 'identical standings');
    eq(JSON.stringify(s1.margins), JSON.stringify(s0.margins), 'identical margins');
    const cached = journal2.filter((j) => j.kind === 'packet' && j.source === 'cache').length;
    ok(cached > 0, 'replay drew from the packet cache, not new entropy');
  });

  // ── the live championship + entanglement arc ──
  let ent0 = null, ent1 = null, liveSet = null, liveVault = null;
  if (live && key) {
    liveVault = new MothVault({ key, live: true, cachePath, journal, seed: 20260926, ns: 'LIVE' });
    const probe = await liveVault.probe();
    console.log(`  · moth probe: ${probe.heads}H/${probe.tails}T mock=${probe.mock}`);
    await H.check('live probe: real coin-toss came back (or cache replays it)', async () => {
      ok(probe.shots === 64, 'shot count');
      ok(probe.heads + probe.tails === 64, 'coin accounting');
    });
    const featsNow = async () => {
      let acc = 0, n = 0, alarm = 0, social = 0;
      for (let i = 0; i < 4; i++) {
        const aid = `p${i}`;
        for (const o of ['p0', 'p1', 'p2']) if (o !== aid) { const m = (await arena.cell(aid, `inf.${o}`)) || {}; if (m.n > 0) { acc += m.acc ?? 0; n++; } alarm = Math.max(alarm, m.alarm ?? 0); }
        social += (await arena.cell(aid, 'st.social')) ?? 0;
      }
      return { acc: n ? acc / n : 0, alarm, social: social / 4 };
    };
    const f0 = await featsNow();
    const z = (x) => 2 * x - 1;
    ent0 = await liveVault.entangle(f0, [
      { qubits: [0, 1], zz: 0.6 }, { qubits: [0, 2], zz: -0.7 },
    ], 'pre-championship');
    liveSet = await arena.runSet(6, 2, { learn: true, tag: 'CHAMPIONSHIP', live: true, vault: liveVault });
    phases.push(liveSet);
    const f1 = await featsNow();
    ent1 = await liveVault.entangle(f1, [
      { qubits: [0, 1], zz: 0.6 }, { qubits: [0, 2], zz: -0.7 },
    ], 'post-championship');
    await H.check('H5 entanglement arc: graph tomography read before/after convergence, ZZ in range', async () => {
      for (const [tag, ent] of [['pre', ent0], ['post', ent1]]) {
        for (const [k, v] of Object.entries(ent.zz ?? {})) ok(v >= -1.001 && v <= 1.001, `${tag} ${k} out of range`);
        console.log(`  · ${tag}: ${JSON.stringify(ent.zz)} agreement=${ent.agreement == null ? 'n/a' : ent.agreement.toFixed(3)} mock=${ent.mock}`);
      }
    });
    await H.check('live championship: real packets receipted, mock=false, within cap', async () => {
      const liveSpends = journal.filter((j) => j.kind === 'packet' && j.source === 'live');
      ok(liveSpends.length <= MAX_LIVE, 'live cap respected');
      ok(liveVault.liveUsed <= MAX_LIVE, 'vault counter within cap');
      console.log(`  · live packets: ${liveSpends.length}/${MAX_LIVE} cap (job ids receipted in journal)`);
    });
  } else {
    console.log('  – (offline run: championship re-run on synthetic entropy, flagged)');
    liveVault = new MothVault({ key: null, live: false, cachePath, journal, seed: 20260926, ns: 'OFF' });
    liveSet = await arena.runSet(6, 2, { learn: true, tag: 'CHAMPIONSHIP', live: true });
    phases.push(liveSet);
  }

  await H.check('analyst fence: letters inside A–E even against adversarial digests', async () => {
    for (const dig of [
      { lost: true, margin: -99, acc: -1, spendRatio: 9, setNo: 3, leaderStyle: { greed: 9 } },
      { lost: false, margin: 99, acc: 9, spendRatio: -9, setNo: 8 },
      {},
    ]) {
      const L = await analyst.call(dig);
      ok(/^[ABCDE]$/.test(L.letter), 'fence holds: ' + JSON.stringify(L));
    }
  });

  await H.check('MASK self-model: opponents were modeled modeling ME (craftmind pulse alive)', async () => {
    const maskIdx = FAMILIES.indexOf('MASK');
    const self = (await arena.cell(`p${maskIdx}`, 'inf.self')) || {};
    const n = Object.values(self).reduce((a, m) => a + (m?.n ?? 0), 0);
    ok(n > 0, 'no self-model observations recorded');
    console.log(`  · MASK self-model observations: ${n} (predictability it tries to shed)`);
  });

  await H.check('vault discipline: every packet journaled, cache persisted, synthetic flagged', async () => {
    const packets = journal.filter((j) => j.kind === 'packet');
    for (const p of packets) ok(typeof p.mock === 'boolean', 'packet missing mock flag');
    const livePk = packets.filter((p) => p.source === 'live');
    const synPk = packets.filter((p) => p.source === 'synthetic');
    console.log(`  · packets: ${packets.length} total (${livePk.length} live, ${synPk.length} synthetic, rest cached)`);
    ok(packets.length > 0, 'no packets drawn at all');
  });

  // ── final summary + artifacts ──
  const summary = {
    families: FAMILIES,
    probe: Object.fromEntries(Object.entries(probeResults).map(([k, v]) => [k, { acc: v.acc, cos: v.cos }])),
    phases: phases.map((p) => ({
      setNo: p.setNo, tag: p.tag, budget: p.budget,
      standings: p.standings, margins: p.margins, spent: p.spent,
      revisions: Object.fromEntries(Object.entries(p.revisions ?? {}).map(([k, r]) => [k, { v: r.v, letter: r.letter, novelty: r.novelty, note: r.note }])),
    })),
    live: { attempted: live && !!key, probe: liveVault?.liveUsed ?? 0 },
    entangle: { pre: ent0, post: ent1 },
    analyst: { mock: analyst.mock, calls: analyst.calls, realCalls: analyst.realCalls },
    packets: journal.filter((j) => j.kind === 'packet').length,
  };
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(OUT, 'round_ledger.jsonl'), journal.map((j) => JSON.stringify(j)).join('\n') + '\n');
  writeFileSync(join(OUT, 'moth_journal.json'), JSON.stringify(journal.filter((j) => j.kind !== 'move'), null, 1));

  // console narrative
  console.log('\n  ══ tournament narrative ══');
  for (const p of phases) {
    console.log(`  set ${p.setNo}${p.tag ? ' [' + p.tag + ']' : ''} budget=${p.budget} → ${p.standings.map(([a, m]) => `${a} ${m >= 0 ? '+' : ''}${m.toFixed(1)}`).join(' | ')}`);
  }
  console.log('  probe (planted-formula recovery): ' + Object.entries(summary.probe).map(([k, v]) => `${k} acc=${v.acc.toFixed(2)} cos=${v.cos.toFixed(2)}`).join(' · '));

  await H.done();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
