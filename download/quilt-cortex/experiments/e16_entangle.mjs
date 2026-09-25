// e16_entangle.mjs — THE WIRING ORACLE.
//
// Question (jev-quilt law 2 × quantum): a sheet declares its LINK edges —
// but WHO decides the wiring? Hypothesis: MOTH graph-v1 tomography, prepared
// from the sheet's own feature telemetry, produces a ZZ ranking whose top
// pairs, wired in as interaction cells, beat BOTH classical correlation
// selection AND the anti-oracle (lowest-ZZ pairs) on held-out prediction.
//
// Falsifiable design, four wirings on the same tape, same head, same seeds:
//   BASE      5 features only
//   ORACLE    + top-3 |ZZ| pairs      (quantum wiring oracle)
//   CLASSICAL + top-3 |Pearson| pairs (the classical selector control)
//   ANTI      + bottom-3 |ZZ| pairs   (the anti-oracle control)
//   RANDOM    + 3 seeded-random pairs (chance floor)
// Budget: 2 live graph-v1 calls (probe + retest for ranking stability),
// disk-cached, everything else deterministic local compute.

import { makeMoth } from '../cortex/moth.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOTH_KEY = 'moth_LK5TNffDcdDz4g5PQCCgrU';
const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, '../../.cache'), { recursive: true });

// ── deterministic tape with a PLANTED interaction truth ──────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260925);
const N = 400;
const price = [100];
for (let t = 1; t < N; t++) price.push(price[t - 1] * (1 + (rng() - 0.5) * 0.02));
const z = (arr, t, w) => {
  const win = arr.slice(Math.max(0, t - w), t + 1);
  const m = win.reduce((a, b) => a + b, 0) / win.length;
  const sd = Math.sqrt(win.reduce((a, b) => a + (b - m) ** 2, 0) / win.length) || 1e-9;
  return (arr[t] - m) / sd;
};
const ret = price.map((p, t) => (t ? (p - price[t - 1]) / price[t - 1] : 0));
const absRet = ret.map(Math.abs);
const FEATS = ['mom', 'rev', 'vol', 'cyc', 'level'];
const F = {};
for (let t = 0; t < N; t++) {
  F.mom = F.mom || []; F.mom.push(Math.tanh(z(ret, t, 5)));
  F.rev = F.rev || []; F.rev.push(-Math.tanh(z(ret, t, 3)));
  F.vol = F.vol || []; F.vol.push(Math.tanh(z(absRet, t, 12)));
  F.cyc = F.cyc || []; F.cyc.push(Math.sin((t / 7) * 2 * Math.PI + 0.3));
  F.level = F.level || []; F.level.push(Math.tanh(z(price, t, 30)));
}
// TRUTH v2: next-bar up/down = 0.8*mom + 0.5*cyc + 1.5*cyc*vol + noise.
// cyc is a deterministic phase and vol an |ret| EWMA — genuinely orthogonal
// bases — so cyc*vol is a REAL non-linear term no linear head can absorb
// (v1's mom*rev was collinear with its own bases: a selector-free game).
const y = [];
for (let t = 0; t < N - 1; t++) {
  const s = 0.8 * F.mom[t] + 0.5 * F.cyc[t] + 1.5 * (F.cyc[t] * F.vol[t]) + (rng() - 0.5) * 0.8;
  y.push(s > 0 ? 1 : 0);
}
const TB = 280; // train bars, last 119 held out

// ── the quantum wiring oracle (2 live calls, cached) ─────────────────────────
const journal = [];
const moth = await makeMoth({ key: MOTH_KEY, live: true, cachePath: join(here, '../../.cache/moth-e16.json'), journal });
function meanFeatureVector(t0, t1) {
  // DECISION-TIME encoding: the sheet prepares its CURRENT state, not its
  // history mean (v1's 280-bar mean collapsed Bloch Z to ~0 → ZZ ~ 0.02).
  // t0 here is the single "now" bar; t1 unused.
  // tame the Bloch polarization: raw tanh z-scores (±0.9) saturate every
  // relationship ZZ to ~1.0 — the meter reads correlation OF the prepared
  // state, so spread must be preserved, not clipped to the sphere edge
  const v = {};
  for (const f of FEATS) v[f] = Math.max(-0.9, Math.min(0.9, +F[f][t0].toFixed(4))) * 0.6;
  return v;
}
const NOW_TRAIN = TB - 1, NOW_TEST = N - 2;
const pairs = [];
for (let i = 0; i < FEATS.length; i++) for (let j = i + 1; j < FEATS.length; j++) pairs.push([i, j]);
const edges = pairs.map(([a, b]) => ({ qubits: [a, b], zz: 0.3 })); // WEAK probe: v2's 0.8 pinned every measured ZZ to ~1.0 (the meter verifies declared couplings — strong probes saturate)

console.log('══ quantum wiring oracle — graph-v1 probe (train-time state) ══');
const probe = await moth.entangle(meanFeatureVector(NOW_TRAIN), edges, 'e16v4-probe');
console.log('  source:', probe.mock ? 'MOCK (flagged)' : `LIVE job ${probe.job_id}`);
const zzPairs = Object.entries(probe.zz).map(([k, v]) => ({ pair: k.split('x'), zz: v == null ? 0 : v }))
  .sort((a, b) => Math.abs(b.zz) - Math.abs(a.zz));
console.log('  ZZ ranking:', zzPairs.map(p => `${p.pair.join('×')}=${p.zz.toFixed(3)}`).join('  '));

console.log('══ retest (test-time state) — ranking stability ══');
const retest = await moth.entangle(meanFeatureVector(NOW_TEST), edges, 'e16v4-retest');
const retestRank = Object.fromEntries(Object.entries(retest.zz).map(([k, v]) => [k, v == null ? 0 : Math.abs(v)]));
const probeRank = Object.fromEntries(zzPairs.map((p, i) => [p.pair.join('x'), i]));
let spearmanNum = 0, nPairs = 0;
const retestList = Object.entries(retestRank).sort((a, b) => b[1] - a[1]).map(([k], i) => [k, i]);
for (const [k, j] of retestList) {
  const pi = probeRank[k] ?? nPairs;
  spearmanNum += (pi - j) ** 2; nPairs++;
}
const rho = 1 - (6 * spearmanNum) / (nPairs * (nPairs * nPairs - 1));
console.log(`  rank correlation (Spearman proxy): ${rho.toFixed(3)} (mock=${retest.mock})`);

// ── wiring selectors ──────────────────────────────────────────────────────────
const top3 = zzPairs.slice(0, 3).map(p => p.pair);
const bot3 = zzPairs.slice(-3).map(p => p.pair);
// classical selector: |Pearson| between product terms and the label (train only)
const pearson = (xs, ys) => {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sx += (xs[i] - mx) ** 2; sy += (ys[i] - my) ** 2; }
  return sxy / (Math.sqrt(sx * sy) || 1e-9);
};
const corrPairs = pairs.map(([a, b]) => {
  const prod = [];
  for (let t = 0; t < TB; t++) prod.push(F[FEATS[a]][t] * F[FEATS[b]][t]);
  return { pair: [FEATS[a], FEATS[b]], c: Math.abs(pearson(prod, y.slice(0, TB))) };
}).sort((a, b) => b.c - a.c);
const topClassical = corrPairs.slice(0, 3).map(p => p.pair);
const rngSel = mulberry32(7);
const randomPairs = [...pairs].sort(() => rngSel() - 0.5).slice(0, 3).map(([a, b]) => [FEATS[a], FEATS[b]]);
console.log('  oracle wiring:    ', top3.map(p => p.join('×')).join(', '));
console.log('  classical wiring: ', topClassical.map(p => p.join('×')).join(', '));
console.log('  anti wiring:      ', bot3.map(p => p.join('×')).join(', '));

// ── logistic heads (same optimization for every wiring) ───────────────────────
function featRow(t, wiring) {
  const base = FEATS.map(f => F[f][t]);
  const inter = wiring.map(([a, b]) => F[a][t] * F[b][t]);
  return [...base, ...inter];
}
function fitLogistic(wiring, t0, t1, epochs = 1500, lr = 0.25, l2 = 0.003) {
  const dim = FEATS.length + wiring.length;
  const w = new Array(dim + 1).fill(0); // w[0]=bias, w[1..dim]=weights
  for (let e = 0; e < epochs; e++) {
    const g = new Array(dim + 1).fill(0); // v3 bug: g was one short — g[dim]=undefined poisoned the last feature weight with NaN
    for (let t = t0; t < t1; t++) {
      const x = featRow(t, wiring);
      let s = w[0];
      for (let i = 0; i < x.length; i++) s += w[i + 1] * x[i];
      const p = 1 / (1 + Math.exp(-s));
      const err = (y[t] - p);
      for (let i = 0; i < x.length; i++) g[i + 1] += err * x[i];
      g[0] += err;
    }
    for (let i = 0; i <= dim; i++) w[i] += lr * (g[i] / (t1 - t0)) - l2 * w[i] * (i > 0 ? 1 : 0);
  }
  return w;
}
function evalWiring(wiring, w, t0, t1) {
  let correct = 0, loss = 0, n = 0;
  for (let t = t0; t < t1; t++) {
    if (y[t] === undefined) continue; // last bar has no next-bar label
    const x = featRow(t, wiring);
    let s = w[0];
    for (let i = 0; i < x.length; i++) s += w[i + 1] * x[i];
    const p = Math.min(1 - 1e-9, Math.max(1e-9, 1 / (1 + Math.exp(-s))));
    correct += ((p > 0.5 ? 1 : 0) === y[t]) ? 1 : 0;
    loss -= y[t] * Math.log(p) + (1 - y[t]) * Math.log(1 - p);
    n++;
  }
  return { acc: +(correct / n).toFixed(4), logloss: +(loss / n).toFixed(4), n };
}

const wirings = {
  BASE: [],
  ORACLE: top3,
  CLASSICAL: topClassical,
  ANTI: bot3,
  RANDOM: randomPairs,
};
console.log('\n══ held-out prediction (train 0..279, test 280..398) ══');
const results = {};
for (const [name, wiring] of Object.entries(wirings)) {
  const w = fitLogistic(wiring, 0, TB);
  const tr = evalWiring(wiring, w, 0, TB);
  const te = evalWiring(wiring, w, TB, N - 1);
  results[name] = { wiring: wiring.map(p => p.join('×')), train: tr, test: te };
  console.log(`  ${name.padEnd(9)} test acc=${te.acc} logloss=${te.logloss}   (train acc=${tr.acc})`);
}
const oracleBeatAnti = results.ORACLE.test.acc > results.ANTI.test.acc;
const oracleBeatClassical = results.ORACLE.test.acc >= results.CLASSICAL.test.acc;
console.log(`\n  oracle > anti-oracle: ${oracleBeatAnti} | oracle >= classical: ${oracleBeatClassical}`);

// ── CHECKS (mechanism-level, honest) ─────────────────────────────────────────
const CHECKS = [];
const check = (name, ok, detail = '') => { CHECKS.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
check('probe returned a full 10-pair ZZ matrix', Object.keys(probe.zz).length === 10, JSON.stringify(probe.zz).slice(0, 160));
check('all |ZZ| <= 1 (physical)', Object.values(probe.zz).every(v => v == null || Math.abs(v) <= 1));
check('retest returned a full 10-pair ZZ matrix', Object.keys(retest.zz).length === 10);
check('probe source labeled (live or mock)', typeof probe.mock === 'boolean', `mock=${probe.mock}`);
check('oracle wiring differs from anti wiring (non-degenerate ranking)', JSON.stringify(top3) !== JSON.stringify(bot3));
check('held-out evaluated on identical bars for all wirings', Object.values(results).every(r => r.test.n === N - 1 - TB));
check('BASE beats chance on held-out (sanity: tape has signal)', results.BASE.test.acc > 0.5, `acc=${results.BASE.test.acc}`);

const pass = CHECKS.filter(c => c.ok).length;
console.log(`\n${pass}/${CHECKS.length} green | oracle-vs-anti=${oracleBeatAnti} oracle-vs-classical=${oracleBeatClassical}`);
mkdirSync(join(here, 'outputs'), { recursive: true });
writeFileSync(join(here, 'outputs', 'results.json'), JSON.stringify({
  checks: `${pass}/${CHECKS.length}`, zzRanking: zzPairs, retest: { rho, mock: retest.mock },
  wirings: results, oracleBeatAnti, oracleBeatClassical, probeMock: probe.mock,
}, null, 2));
process.exit(pass === CHECKS.length ? 0 : 1);
