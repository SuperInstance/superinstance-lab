// E12 — THE MINDS. Four rival agent-families, each a SHEET (the mind is the
// graph, not a function). They share one public feature language (the games
// module computes it) and one style architecture, and differ in HOW they
// learn, WHEN they spend perception, and WHAT they think the opponent is:
//
//   LIN   linear online learner      — softmax-SGD on opponent features;
//                                      spends when its own prediction error
//                                      runs hot (recovery spend).
//   WAVE  spectral analyst           — reads the opponent's move-margin
//                                      stream AS A WAVEFORM (Goertzel); a
//                                      spectral shift is a strategy change;
//                                      spends only to confirm shifts.
//   BAYES particle posterior         — 12 hypothesis-opponents, likelihood
//                                      weighted; spends when the posterior
//                                      collapses (ESS < 4) to resample.
//   MASK adversarial mixer           — models what opponents believe about
//                                      IT, pays a predictability penalty,
//                                      buys entropy to stay unexploitable.
//
// The craftmind pattern lives in learn.revise: between sets every agent
// rewrites its own script (style mutations + analyst letter A-E), stamps a
// version + hypothesis + fnv1a64 receipt, and must be measurably DIFFERENT
// (novelty rule). The runner (act.choose) stays deterministic.
//
// STYLE ARCHITECTURE — 5 style cells (greed/fear/curiosity/social/patience)
// derive ALL 14 game weights through formula cells. Understanding is
// distributed across relationships: the writer touches 5 cells, 14 weights
// re-derive, both games re-price. Over a tournament, styles that nothing
// uses decay to zero — "less need for weights not involved over time".

import { v, law, prog, formula, listenerCell } from '../shared/kit.mjs';

export const FAMILIES = ['LIN', 'WAVE', 'BAYES', 'MASK'];
export const STYLE_KEYS = ['greed', 'fear', 'curiosity', 'social', 'patience'];
export const MW_FEATS = ['adj', 'adjSum', 'front', 'info', 'dens', 'center', 'avoid'];
export const HW_FEATS = ['winp', 'pts', 'high', 'trickPts', 'lead', 'voidp', 'aggr'];

export const INIT_STYLE = {
  LIN:   { greed: 0.10, fear: 0.20, curiosity: 0.10, social: 0.20, patience: 0.10 },
  WAVE:  { greed: 0.00, fear: 0.30, curiosity: 0.05, social: 0.10, patience: 0.30 },
  BAYES: { greed: 0.20, fear: 0.10, curiosity: 0.30, social: 0.15, patience: 0.00 },
  MASK:  { greed: 0.15, fear: 0.00, curiosity: 0.20, social: 0.30, patience: -0.10 },
};
const NEUTRAL_W = () => Object.fromEntries([...MW_FEATS, ...HW_FEATS].map((k) => [k, 0.05]));

// ── shared program-cell prelude (new Function scope: inline everything) ─────
const BASE = `
  const gv = async (id) => (await runtime.get(id)).data;
  const featScore = (f, w) => { let s = 0; for (const k in f) s += (w[k] ?? 0) * f[k]; return s; };
  const softmax = (xs, t) => { t = t || 1; const m = Math.max(...xs);
    const ex = xs.map((x) => Math.exp((x - m) / Math.max(1e-6, t)));
    const z = ex.reduce((a, b) => a + b, 0); return ex.map((e) => e / z); };
  const ewma = (old, x, a) => (old == null ? x : a * x + (1 - a) * old);
  const fnv1a64 = (s) => { let h = 0xcbf29ce484222325n;
    const p = 0x100000001b3n, m = 0xffffffffffffffffn;
    for (let i = 0; i < s.length; i++) { h ^= BigInt(s.charCodeAt(i)); h = (h * p) & m; }
    return h.toString(16).padStart(16, '0'); };
  const canon = (row) => { const s = {}; for (const k of Object.keys(row).sort()) s[k] = row[k];
    return JSON.stringify(s); };
  const goertzel = (x, k) => { const N = x.length; if (N < 4) return 0;
    const w = (2 * Math.PI * k) / N, cw = Math.cos(w), c2 = 2 * cw;
    let s1 = 0, s2 = 0; for (const v of x) { const s = v + c2 * s1 - s2; s2 = s1; s1 = s; }
    return Math.max(0, s1 * s1 + s2 * s2 - c2 * s1 * s2) / N; };
  const hashRng = (seed) => { let a = (seed ?? 7) >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
`;

// derived-weight lookup: feature -> mapping cell id
const MWCELL = Object.fromEntries(MW_FEATS.map((f) => [f, `mw.${f}`]));
const HWCELL = Object.fromEntries(HW_FEATS.map((f) => [f, `hw.${f}`]));
const WMAP = `${JSON.stringify({ mines: MWCELL, hearts: HWCELL })}`;

const READ_W = `
  const wmap = ${WMAP};
  const readW = async (game) => {
    const w = {};
    for (const f in wmap[game]) { const c = await gv(wmap[game][f]); w[f] = c ?? 0; }
    return w;
  };
`;

// ── act.choose ───────────────────────────────────────────────────────────────
const CHOOSE_HEAD = `${BASE}${READ_W}
  const game = input.game;
  const feats = input.feats, ids = Object.keys(feats);
  const w = await readW(game);
  const models = {};
  for (const o of input.opp) models[o] = (await gv('inf.' + o)) || {};
`;
const CHOOSE_TAIL = `
  {
    const p = (await gv('participation')) || {};
    for (const id of ids) for (const k in feats[id]) p[k] = (p[k] || 0) + Math.abs(feats[id][k]) * 0.001 + 0.0001;
    await runtime.set('participation', p);
  }
  return { pick, spend, think };
`;

function chooseCode(family) {
  if (family === 'LIN') return `${CHOOSE_HEAD}
  const entries = ids.map((id) => ({ id, s: featScore(feats[id], w) })).sort((a, b) => b.s - a.s);
  const margin = entries[0].s - (entries[1] ? entries[1].s : 0);
  let pick = entries[0].id, spend = 0;
  let think = 'argmax m=' + margin.toFixed(3);
  const cur = await gv('st.curiosity');
  if (margin < 0.12 * (0.5 + cur) && input.mothLeft > 0) {
    spend = 1;
    if (input.pack && input.pack.length >= 2) {
      const T = 0.35 + input.pack[0] * 0.7;
      const top = entries.slice(0, Math.min(3, entries.length));
      const ps = softmax(top.map((e) => e.s), T);
      let acc = 0, k = 0; const u = input.pack[1];
      while (k < ps.length - 1 && acc + ps[k] < u) { acc += ps[k]; k++; }
      pick = top[k].id;
      think = 'quantum tie-break: margin ' + margin.toFixed(3) + ', T=' + T.toFixed(2);
    }
  }
  ${CHOOSE_TAIL}`;

  if (family === 'WAVE') return `${CHOOSE_HEAD}
  const entries = ids.map((id) => ({ id, s: featScore(feats[id], w) })).sort((a, b) => b.s - a.s);
  const alarm = Math.max(0, ...input.opp.map((o) => models[o]?.alarm ?? 0));
  if (alarm > 0.5) for (const e of entries) e.s += ((input.pack ? input.pack[ids.indexOf(e.id) % input.pack.length] : 0.5) - 0.5) * 0.9;
  entries.sort((a, b) => b.s - a.s);
  let pick = entries[0].id, spend = 0;
  let think = 'wave-argmax alarm=' + alarm.toFixed(2);
  if (alarm > 0.5 && input.mothLeft > 0) {
    spend = 1;
    if (input.pack) think += ' → quantum re-read after spectral shift';
  }
  ${CHOOSE_TAIL}`;

  if (family === 'BAYES') return `${CHOOSE_HEAD}
  let ess = null; let parts = [];
  for (const o of input.opp) { const m = models[o]; if (m && m.particles) { parts = parts.concat(m.particles);
    const ps = m.particles.map((p) => Math.exp(p.logp)); const z = ps.reduce((a, b) => a + b, 0) || 1;
    ess = ess == null ? 1 / ps.reduce((a, x) => a + (x / z) * (x / z), 0) : Math.min(ess, 1 / ps.reduce((a, x) => a + (x / z) * (x / z), 0)); } }
  if (!parts.length) { const w0 = NEUTRAL(); parts = [{ w: w0, logp: 0 }]; }
  function NEUTRAL(){ const o={}; for (const k of Object.keys(w)) o[k]=0.05; return o; }
  let meanW = {};
  // posterior-top-K mean (see inf.predict: full mean blurs with prior noise)
  const ranked = parts.slice().sort((a, b) => b.logp - a.logp).slice(0, 5);
  { const ps5 = ranked.map((p) => Math.exp(p.logp - ranked[0].logp)); const z5 = ps5.reduce((a, b) => a + b, 0) || 1;
    ranked.forEach((p, i) => { for (const k in w) meanW[k] = (meanW[k] || 0) + (ps5[i] / z5) * (p.w[k] ?? 0); }); }
  const entries = ids.map((id) => ({ id, s: featScore(feats[id], meanW) })).sort((a, b) => b.s - a.s);
  let pick = entries[0].id, spend = 0;
  let think = 'posterior-mean ess=' + (ess == null ? 'n/a' : ess.toFixed(1));
  if (ess != null && ess < 5 && input.mothLeft > 0) {
    spend = 1;
    if (input.pack && input.pack.length >= 2) {
      // quantum resample: pick 2 hypothesis opponents by entropy, choose their consensus
      const ps = parts.map((p) => Math.exp(p.logp)); const z = ps.reduce((a, b) => a + b, 0) || 1;
      const pick1 = () => { let u = input.pack[0] * z, i = 0; while (i < parts.length - 1 && u > ps[i]) { u -= ps[i]; i++; } return parts[i]; };
      const pick2 = () => { let u = input.pack[1] * z, i = 0; while (i < parts.length - 1 && u > ps[i]) { u -= ps[i]; i++; } return parts[i]; };
      const a1 = pick1(), a2 = pick2();
      const s1 = ids.map((id) => ({ id, s: featScore(feats[id], a1.w) })).sort((x, y) => y.s - x.s).slice(0, 3).map((e) => e.id);
      const s2 = ids.map((id) => ({ id, s: featScore(feats[id], a2.w) })).sort((x, y) => y.s - x.s).slice(0, 3).map((e) => e.id);
      const both = s1.filter((x) => s2.includes(x));
      const poolIds = both.length ? both : s1;
      pick = poolIds.map((id) => ({ id, s: featScore(feats[id], meanW) })).sort((x, y) => y.s - x.s)[0].id;
      think = 'quantum resample: ess=' + ess.toFixed(1) + ' consensus=' + (both.length ? 'yes' : 'no');
    }
  }
  ${CHOOSE_TAIL}`;

  // MASK
  return `${CHOOSE_HEAD}
  const self = (await gv('inf.self')) || {};
  const entries = ids.map((id) => ({ id, s: featScore(feats[id], w) }));
  // predictability penalty: how well do opponents model ME on this candidate?
  let predHit = 0, pn = 0;
  for (const o of input.opp) {
    const sm = self[o]; if (!sm || !sm.w) continue;
    const sc = ids.map((id) => ({ id, s: featScore(feats[id], sm.w) }));
    const mx = Math.max(...sc.map((e) => e.s));
    const ps = softmax(sc.map((e) => e.s), 0.8);
    sc.forEach((e, i) => { e.p = ps[i]; });
    predHit += sm.hits / Math.max(1, sm.n); pn++;
    for (const e of entries) e.s -= 1.2 * (sc.find((x) => x.id === e.id).p) * (input.stake || 1) * (sm.hits / Math.max(1, sm.n));
  }
  entries.sort((a, b) => b.s - a.s);
  let pick = entries[0].id, spend = 0;
  const pred = pn ? predHit / pn : 0.25;
  const eps = clamp(0.08 + (pred - 0.25) * 1.5, 0.08, 0.45);
  let think = 'mask ε=' + eps.toFixed(2) + ' pred=' + pred.toFixed(2);
  if (input.mothLeft > 0 && (pred > 0.34 || (input.stake || 0) > 1.5)) {
    spend = 1;
    if (input.pack && input.pack.length >= 2) {
      if (input.pack[0] < eps) {
        const ps = softmax(entries.map((e) => e.s), 0.5 + input.pack[1]);
        let acc = 0, k = 0; const u = input.pack[2] ?? 0.5;
        while (k < ps.length - 1 && acc + ps[k] < u) { acc += ps[k]; k++; }
        pick = entries[k].id; think += ' → quantum mix';
      } else think += ' → held the line';
    }
  }
  ${CHOOSE_TAIL}`;
}

// ── inf.predict ──────────────────────────────────────────────────────────────
function predictCode(family) {
  const core = family === 'BAYES' ? `
  function NEUT(){ const o={}; for (const k in input.feats[Object.keys(input.feats)[0]]) o[k]=0.05; return o; }
  const m = (await gv('inf.' + input.mover)) || {};
  const parts = m.particles || [{ w: NEUT(), logp: 0 }];
  // posterior-top-K hypothesis mean: the full mean blurs prediction with
  // prior noise on features the data never spoke about (E12 lesson)
  const ranked = parts.slice().sort((a, b) => b.logp - a.logp).slice(0, 5);
  const ps = ranked.map((p) => Math.exp(p.logp - ranked[0].logp)); const z = ps.reduce((a, b) => a + b, 0) || 1;
  const meanW = {}; for (const p of ranked) for (const k in p.w || {}) meanW[k] = (meanW[k] || 0) + (Math.exp(p.logp - ranked[0].logp) / z) * (p.w[k] ?? 0);
  const ids = Object.keys(input.feats);
  const entries = ids.map((id) => ({ id, s: featScore(input.feats[id], meanW) })).sort((a, b) => b.s - a.s);
  return { pick: entries[0].id };` : `
  function NEUT(){ const o={}; for (const k in input.feats[Object.keys(input.feats)[0]]) o[k]=0.05; return o; }
  const m = (await gv('inf.' + input.mover)) || {};
  const w = m.w || NEUT();
  const ids = Object.keys(input.feats);
  const entries = ids.map((id) => ({ id, s: featScore(input.feats[id], w) })).sort((a, b) => b.s - a.s);
  return { pick: entries[0].id };`;
  return `${BASE}${core}`;
}

// ── inf.update ───────────────────────────────────────────────────────────────
function updateCode(family) {
  const sgd = `
  const ETA = 0.15;
  function NEUT(){ const o={}; for (const k in (input.feats[Object.keys(input.feats)[0]] || {})) o[k]=0.05; return o; }
  const m = (await gv('inf.' + input.mover)) || { w: NEUT(), hits: 0, n: 0, margin: [], alarm: 0, tol: null, aggr: null, moon: null };
  const ids = Object.keys(input.feats);
  const w = m.w || NEUT();
  const scores = ids.map((id) => featScore(input.feats[id], w));
  const ps = softmax(scores, 1);
  const pickedIdx = ids.indexOf(String(input.picked));
  if (pickedIdx >= 0) {
    const fP = input.feats[input.picked];
    for (const k in fP) {
      let ef = 0; ids.forEach((id, i) => { ef += ps[i] * input.feats[id][k]; });
      w[k] = (w[k] ?? 0) + ETA * (fP[k] - ef);
    }
  }
  m.w = w;
  const hit = input.lastPredict != null && String(input.lastPredict) === String(input.picked);
  m.hits = (m.hits || 0) + (hit ? 1 : 0); m.n = (m.n || 0) + 1; m.acc = m.hits / m.n;
  const sorted = scores.slice().sort((a, b) => b - a);
  const margin = sorted[0] - (sorted[1] ?? 0);
  m.margin = (m.margin || []).concat([margin]).slice(-24);
`;
  const shape = `
  if (game === 'mines') { const r = input.obs && input.obs.risk != null ? input.obs.risk : margin; m.tol = ewma(m.tol, r, 0.25); }
  else { if (input.obs) { if (input.obs.won) m.aggr = ewma(m.aggr, input.obs.couldDuck ? 1 : 0.4, 0.3);
         else m.aggr = ewma(m.aggr ?? 0.5, 0, 0.1);
         if (input.obs.tookPts) m.moon = ewma(m.moon, input.obs.pts >= 2 ? 1 : 0.3, 0.25); else m.moon = ewma(m.moon ?? 0, 0, 0.08); } }
`;
  const wave = `
  if (m.margin.length >= 8 && m.margin.length % 4 === 0) {
    const win = m.margin.slice(-16);
    let bestK = 1, bestP = -1; const pw = {};
    for (let k = 1; k <= 6; k++) { const p = goertzel(win, k); pw[k] = p; if (p > bestP) { bestP = p; bestK = k; } }
    m.spec = m.spec || { k: bestK, power: bestP };
    if (bestK !== m.spec.k && bestP > m.spec.power * 1.35) m.alarm = 1;
    else m.alarm = (m.alarm || 0) * 0.7;
    m.spec = { k: bestK, power: bestP };
  } else m.alarm = (m.alarm || 0) * 0.9;
`;
  const bayes = `
  m.particles = m.particles || Array.from({ length: 20 }, (_, i) => {
    const r = hashRng(1000 + i * 17); const o = {};
    for (const k in w) o[k] = 0.05 + (r() - 0.5) * 0.24;
    return { w: o, logp: Math.log(1 / 20), i, eta: 0.06 + 0.022 * i };
  });
  if (pickedIdx >= 0) for (const p of m.particles) {
    const sc = ids.map((id) => featScore(input.feats[id], p.w));
    const pp = softmax(sc, 0.5); // likelihood temp near the arena's argmax regime
    p.logp += Math.log(Math.max(1e-9, pp[pickedIdx]));
    // E12 NOVEL METHOD — evolutionary gradient ensemble: a particle filter
    // can only SELECT among its prior (likelihood reweighting never moves a
    // weight, so a prior that does not contain the true formula stays blind).
    // Give every particle its own gradient step at its own learning rate;
    // the posterior then selects over TRACKING QUALITY, and resampling
    // breeds the best-tracking rates. Pure selection + pure gradient is
    // strictly weaker than their offspring.
    const fP2 = input.feats[input.picked];
    for (const k in fP2) { let ef2 = 0; ids.forEach((id, i) => { ef2 += pp[i] * input.feats[id][k]; });
      p.w[k] = (p.w[k] ?? 0) + p.eta * (fP2[k] - ef2); }
  }
  { const mx = Math.max(...m.particles.map((p) => p.logp));
    const ps = m.particles.map((p) => Math.exp(p.logp - mx));
    const z = ps.reduce((a, b) => a + b, 0);
    const ws = ps.map((x) => x / z);
    m.ess = 1 / ws.reduce((a, x) => a + x * x, 0);
    if (m.ess < 10 && !input.pack) { // multinomial refresh + roughening
      // (path degeneracy: without jitter, an early-lucky particle keeps the
      // crown even after the data moved on — the E12 filter lesson)
      const r = hashRng((m.n || 0) * 131 + 7);
      const cum = []; let acc = 0; for (const x of ws) { acc += x; cum.push(acc); }
      const ne = m.particles.map(() => { const u = r() * acc; let i = 0; while (i < cum.length - 1 && cum[i] < u) i++; return JSON.parse(JSON.stringify(m.particles[Math.min(i, m.particles.length - 1)])); });
      for (const p of ne) { p.logp = Math.log(1 / ne.length);
        for (const k in p.w) p.w[k] = p.w[k] + (r() - 0.5) * 0.06; }
      m.particles = ne; m.ess = ne.length; m.resampledHash = true;
    }
  }
`;
  // MASK also maintains its self-model (what opponents believe about ME).
  // A selfRun call handles ONLY that (early return): inf.<self-id> does not
  // exist as a cell, and the self-model is not an opponent model.
  const selfEarly = family === 'MASK' ? `
  if (input.selfRun) {
    const self = (await gv('inf.self')) || {};
    for (const row of input.aboutSelf || []) {
      const fAll = row.featsAll || {};
      const ids2 = Object.keys(fAll);
      if (!ids2.length) continue;
      const sm = self[row.by] || { w: null, hits: 0, n: 0 };
      if (!sm.w) { sm.w = {}; for (const k in fAll[ids2[0]]) sm.w[k] = 0.05; }
      const ETA2 = 0.12;
      const sc = ids2.map((id) => featScore(fAll[id], sm.w));
      const pp = softmax(sc, 1);
      const pi = ids2.indexOf(String(row.actual));
      if (pi >= 0) { const fP = fAll[row.actual];
        for (const k in fP) { let ef = 0; ids2.forEach((id, i) => { ef += pp[i] * fAll[id][k]; });
          sm.w[k] = (sm.w[k] ?? 0) + ETA2 * (fP[k] - ef); } }
      sm.hits = (sm.hits || 0) + (String(row.predicted) === String(row.actual) ? 1 : 0);
      sm.n = (sm.n || 0) + 1;
      self[row.by] = sm;
    }
    await runtime.set('inf.self', self);
    return { self: true };
  }
` : '';
  let body;
  if (family === 'BAYES') body = `${BASE}${selfEarly}${sgd}${shape}${bayes}`;
  else if (family === 'WAVE') body = `${BASE}${selfEarly}${sgd}${shape}${wave}`;
  else body = `${BASE}${selfEarly}${sgd}${shape}`;
  body += `
  await runtime.set('inf.' + input.mover, m);
  let shift = 0;
  for (const o of input.oppNames) {
    const a = o === input.mover ? (m.alarm || 0) : (((await gv('inf.' + o)) || {}).alarm || 0);
    if (a > shift) shift = a;
  }
  await runtime.set('pulse.shift', shift);
  await runtime.set('pulse.prederr', ewma((await gv('pulse.prederr')), hit ? 0 : 1, 0.2));
  return { hit, margin, acc: m.acc, ess: m.ess ?? null, alarm: m.alarm || 0 };
`;
  return `
  const game = input.game;
  ${body}`;
}

// ── learn.revise (the script-writer) ─────────────────────────────────────────
function reviseCode() {
  return `${BASE}
  const d = input.digest || {};
  const st = {}; for (const k of ${JSON.stringify(STYLE_KEYS)}) st[k] = (await gv('st.' + k)) ?? 0;
  const before = JSON.parse(JSON.stringify(st));
  const part = d.participation || {};
  const ranked = Object.entries(part).sort((a, b) => b[1] - a[1]);
  const topStyleByUse = ranked.length ? ranked[0][0] : 'social';
  // game outcomes move the style dials
  if (d.lost && (d.margin ?? 0) > 3) { st.fear = (st.fear ?? 0) + 0.10; st.greed = (st.greed ?? 0) - 0.10; }
  if (d.won) { st[topStyleByUse in st ? topStyleByUse : 'social'] = (st[topStyleByUse in st ? topStyleByUse : 'social'] ?? 0) + 0.08; }
  if ((d.acc ?? 1) < 0.40) st.social = (st.social ?? 0) + 0.15;      // read them harder
  if ((d.spendRatio ?? 0) > 0.9) st.curiosity = (st.curiosity ?? 0) - 0.05; // perception was scarce — adapt
  // analyst letter doctrine (A stay, B explore, C concentrate, D imitate, E prune)
  const letter = d.letter || 'A';
  let note = 'letter ' + letter;
  if (letter === 'B') st.curiosity = (st.curiosity ?? 0) + 0.15;
  if (letter === 'C') { let bk = 'greed', bv = -9; for (const k in st) if (Math.abs(st[k]) > bv) { bv = Math.abs(st[k]); bk = k; }
    st[bk] = (st[bk] ?? 0) + 0.12; for (const k in st) if (k !== bk) st[k] = (st[k] ?? 0) - 0.04; note += ' concentrated ' + bk; }
  if (letter === 'D' && d.leaderStyle) { const ls = d.leaderStyle;
    const keys = Object.keys(st).sort((a, b) => Math.abs((ls[b] ?? 0) - st[b]) - Math.abs((ls[a] ?? 0) - st[a])).slice(0, 2);
    for (const k of keys) st[k] = (st[k] ?? 0) + 0.2 * ((ls[k] ?? 0) - st[k]); note += ' imitated ' + keys.join('+'); }
  if (letter === 'E' && ranked.length) { const dead = ranked.slice(-2).map((x) => x[0]).filter((k) => k in st);
    for (const k of dead) { st[k] = 0; } note += ' pruned ' + dead.join('+'); }
  for (const k in st) st[k] = clamp(st[k], -1.5, 1.5);
  let novel = 0; for (const k in st) novel += Math.abs(st[k] - before[k]);
  if (letter !== 'A') novel += 0.25;
  if (novel <= 0.001) { // the arena's mandate: EVERY script version must differ
    st.curiosity = clamp((st.curiosity ?? 0) + 0.05, -1.5, 1.5);
    novel = 0.05; note += ' +forced divergence';
  }
  for (const k in st) await runtime.set('st.' + k, +st[k].toFixed(4));
  const v = ((await gv('script.v')) | 0) + 1;
  await runtime.set('script.v', v);
  await runtime.set('novelty.dist', +novel.toFixed(4));
  const hyp = input.family + ' v' + v + ' [' + note + '] Δ=' + novel.toFixed(2) + ' acc=' + (d.acc ?? 0).toFixed(2);
  await runtime.set('hypothesis', hyp);
  const chain = (await gv('scr.chain')) || [];
  const prev = chain.length ? chain[chain.length - 1].row_hash : '0'.repeat(16);
  const row = { v, note, styles: st, novelty: +novel.toFixed(4), prev_hash: prev };
  row.row_hash = fnv1a64(canon(row));
  chain.push(row);
  await runtime.set('scr.chain', chain);
  return { v, novelty: +novel.toFixed(4), note, hyp, hash: row.row_hash };
`;
}

// ── sheet assembly ───────────────────────────────────────────────────────────
export function buildAgentCells(aid, family) {
  const cells = [];
  const push = (c) => cells.push(c);
  push(v('id.name', aid, 'agent seat id'));
  push(v('id.family', family, 'method family (the HOW of learning)'));
  push(v('script.v', 1, 'script version — bumped by learn.revise (craftmind pattern)'));
  push(v('hypothesis', `${family} v1: baseline doctrine, untested`, 'the theory this script version is testing'));
  push(v('novelty.dist', 0, 'L1 distance from previous script version (novelty rule)'));
  push(law('doctrine.1', `${family}: see family table in README — how this mind learns`, 'family doctrine'));
  push(law('doctrine.2', 'perception is rationed: moth.left is the whole budget for a set', 'economy law'));
  push(law('doctrine.3', 'every script revision is receipted; the runner stays deterministic', 'craftmind law'));
  const ini = INIT_STYLE[family];
  for (const k of STYLE_KEYS) push(v(`st.${k}`, ini[k], `style: ${k} (drives 14 derived weights)`));
  // mines mapping
  push(formula('mw.adj', '2*st.fear + 1*st.patience', 'mines: avoid locally-doomed cells'));
  push(formula('mw.adjSum', '0.8*st.fear', 'mines: cumulative local pressure'));
  push(formula('mw.front', '0.5 + 0.5*st.curiosity', 'mines: prefer frontier cells'));
  push(formula('mw.info', '1.2*st.curiosity', 'mines: value information gain'));
  push(formula('mw.dens', '1.0*st.fear', 'mines: respect global density'));
  push(formula('mw.center', '0.4*st.patience - 0.2*st.greed', 'mines: center bias'));
  push(formula('mw.avoid', '1.5*st.social', 'mines: OPPONENT AS SENSOR — read their avoidance'));
  // hearts mapping
  push(formula('hw.winp', '1.0 + 1.2*st.greed', 'hearts: want tricks when greedy'));
  push(formula('hw.pts', '-(1.5*st.fear + 0.8*st.patience)', 'hearts: avoid penalty cards'));
  push(formula('hw.high', '-0.6*st.patience', 'hearts: shed high cards when impatient'));
  push(formula('hw.trickPts', '1.0*st.greed - 0.5*st.fear', 'hearts: contest big tricks'));
  push(formula('hw.lead', '0.5*st.curiosity', 'hearts: lead when curious'));
  push(formula('hw.voidp', '0.9*st.curiosity + 0.4*st.social', 'hearts: hunt voids'));
  push(formula('hw.aggr', '-0.8*st.social + 0.5*st.fear', 'hearts: duck under aggression'));
  // opponent models (one per POSSIBLE opponent seat — all four, minus self)
  for (const o of ['p0', 'p1', 'p2', 'p3']) {
    if (o === aid) continue;
    push(v(`inf.${o}`, { w: NEUTRAL_W(), hits: 0, n: 0, acc: null, margin: [], alarm: 0, ess: null, tol: null, aggr: null, moon: null, particles: null, spec: null }, `model of ${o}: fitted weights in the shared feature language + shape + alarm`));
  }
  push(v('inf.self', {}, 'MASK only: what each opponent seems to believe about ME'));
  push(v('pulse.prederr', 0.5, 'EWMA of my prediction misses (perception telemetry)'));
  push(v('pulse.shift', 0, 'max opponent spectral-shift alarm (the lamp watches this)'));
  push(v('moth.left', 0, 'MOTH budget left this set (the driver rations it)'));
  push(v('moth.pack', [], 'current entropy packet from the vault (driver-loaded, 32 true-random floats)'));
  push(v('moth.ledger', [], 'every perception purchase: {set, seq, why, source}'));
  push(v('participation', {}, 'cumulative feature engagement — what understanding actually uses'));
  push(v('scr.chain', [], 'script receipts (version, hypothesis, hash chain)'));
  push(v('lamp.log', [], 'shift-alarm flashes receipted here by the listener'));
  push(prog('act.choose', chooseCode(family), 'the deterministic script-runner (perception spend policy inside)', []));
  push(prog('inf.predict', predictCode(family), 'predict a mover pick under my current model of them', []));
  push(prog('inf.update', updateCode(family), 'family-specific fit after observing a mover pick', []));
  push(prog('learn.revise', reviseCode(), 'craftmind script-writer: mutate styles, stamp version+receipt', []));
  push(prog('lamp.shift', `${BASE}
  if ((input.current ?? 0) > 0.5) {
    const log = (await gv('lamp.log')) || [];
    log.push({ t: Date.now(), alarm: input.current });
    await runtime.set('lamp.log', log.slice(-20));
  }
  return { flashed: (input.current ?? 0) > 0.5 };`, 'listener action: flash on opponent spectral shift', []));
  push(listenerCell('watch.shift', ['pulse.shift'], 'lamp.shift', null, 'flash when an opponent strategy shift is detected'));
  return cells;
}

export function buildAgentSheet(aid, family) {
  return {
    id: aid,
    title: `perception arena — ${aid} (${family})`,
    cells: buildAgentCells(aid, family),
  };
}
