// QUILT-QUANT PLAYTEST — the desk vs an independent reference implementation.
//
// The harness carries its OWN quant stack, written separately from the sheet's
// Q kernel: prefix-sum SMAs (the sheet windows), a delta-array Wilder RSI (the
// sheet smooths inline), a settlement-accounting backtest (the sheet recurses
// daily PnL), two-pass Sharpe (the sheet uses the sum/sum2 shortcut). If the
// desk and the reference disagree, one of them is wrong — and the check says
// which. On top of the cross-checks sit the honest-market tests: a hand-
// computed 60-bar tape with fee arithmetic done on paper, a no-lookahead probe
// that mutates the tape, the OVERFIT trap (a candidate that wins in-sample and
// loses out-of-sample must be refused by S7 with a receipt), the promotion
// gate, the witness chain, tamper detection, and trainer determinism.
//
//   node quant/play.mjs

import { QuiltEngine } from '../engine/index.js';
import { mulberry32, harness, verifyChain } from '../shared/kit.mjs';
import { buildSheet } from './sheet.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const H = harness('quant');
const engine = new QuiltEngine('quant-desk', { eager: true });
engine.loadSheet(buildSheet());
console.log(`  cells: ${buildSheet().cells.length}`);

const get = async (id) => (await engine.get(id)).data;
const call = async (id, input) => (await engine.call(id, input)).data;
const closeTo = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

// ── INDEPENDENT reference stack (do not share code with the sheet) ───────────
const refSMA = (c, w) => {
  const out = new Array(c.length).fill(null);
  const pre = [0];
  for (let i = 0; i < c.length; i++) pre.push(pre[i] + c[i]);
  for (let i = w - 1; i < c.length; i++) out[i] = (pre[i + 1] - pre[i + 1 - w]) / w;
  return out;
};
const refRSI = (c, n) => {
  const out = new Array(c.length).fill(null);
  const d = [];
  for (let i = 1; i < c.length; i++) d.push(c[i] - c[i - 1]);
  if (d.length < n) return out;
  const gains = d.map(x => (x > 0 ? x : 0)), losses = d.map(x => (x < 0 ? -x : 0));
  let ag = 0, al = 0;
  for (let i = 0; i < n; i++) { ag += gains[i]; al += losses[i]; }
  ag /= n; al /= n;
  out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = n; i < d.length; i++) {
    ag = (ag * (n - 1) + gains[i]) / n;
    al = (al * (n - 1) + losses[i]) / n;
    out[i + 1] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
};
const refPositions = (c, strategy, fast, slow, rsiLen, rsiMax, rsiBuy, rsiSell) => {
  const f = refSMA(c, fast), s = refSMA(c, slow), r = refRSI(c, rsiLen);
  const p = [];
  let held = 0;
  for (let i = 0; i < c.length; i++) {
    if (f[i] == null || s[i] == null || r[i] == null) { p.push(0); held = 0; continue; }
    if (strategy === 'rsi_reversion') {
      if (r[i] <= rsiBuy) held = 1;
      else if (r[i] >= rsiSell) held = 0;
      p.push(held);
    } else {
      p.push((f[i] > s[i] && r[i] <= rsiMax) ? 1 : 0);
    }
  }
  return p;
};
// settlement-accounting backtest: a margin account that settles price changes
// daily and pays fees out of cash — a different derivation of the same spec.
const refBacktest = (c, pos, feeBps, cash0) => {
  const n = c.length, fr = feeBps / 10000;
  const eq = new Array(n); eq[0] = cash0;
  const trades = []; let open = null;
  for (let i = 1; i < n; i++) {
    const dP = c[i] - c[i - 1];
    let flow = pos[i - 1] * dP;
    if (open) open.pnl += pos[i - 1] * dP;
    if (pos[i] !== pos[i - 1]) {
      const fee = fr * c[i] * Math.abs(pos[i] - pos[i - 1]);
      flow -= fee;
      if (pos[i] === 1) open = { entry: i, pnl: -fee };
      else { open.pnl -= fee; open.exit = i; trades.push(open); open = null; }
    }
    eq[i] = eq[i - 1] + flow;
  }
  if (open) { // S4: liquidate at the last close; the fee hits the equity path
    const liq = fr * c[n - 1];
    eq[n - 1] -= liq;
    open.pnl -= liq; open.exit = n - 1; trades.push(open);
  }
  // two-pass Sharpe + drawdown series (different numerics than the sheet)
  const rets = [];
  for (let i = 1; i < n; i++) rets.push(eq[i] / eq[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rets.length);
  let peak = eq[0], maxdd = 0, expo = 0;
  const dd = eq.map((x, i) => { peak = Math.max(peak, x); return (peak - x) / peak; });
  maxdd = Math.max(...dd);
  for (let i = 1; i < n; i++) if (pos[i - 1] > 0) expo++;
  let wins = 0, gw = 0, gl = 0;
  for (const t of trades) { if (t.pnl >= 0) { wins++; gw += t.pnl; } else gl += -t.pnl; }
  const years = (n - 1) / 252, last = eq[n - 1];
  return {
    equity: eq, trades,
    metrics: {
      total_return: last / cash0 - 1,
      cagr: last > 0 ? Math.pow(last / cash0, 1 / years) - 1 : -1,
      sharpe: sd > 0 ? (mean / sd) * Math.sqrt(252) : 0,
      maxdd, n_trades: trades.length,
      win_rate: trades.length ? wins / trades.length : 0,
      profit_factor: gl > 0 ? gw / gl : (gw > 0 ? 99 : 0),
      exposure: expo / (n - 1),
    },
  };
};
const refSplit = (n, pct) => ({ isN: Math.max(30, Math.min(n - 30, Math.floor(n * pct / 100))) });
const refScore = (m) => m.sharpe - 2 * m.maxdd - (m.n_trades < 3 ? 0.5 : 0);

// ── desk helpers ──────────────────────────────────────────────────────────────
const ORIG = await get('mkt.closes');
const DEFAULTS = { strategy: 'sma_cross', fast: 8, slow: 34, rsi_len: 14, rsi_max: 72, rsi_buy: 30, rsi_sell: 64, fee_bps: 2, wf_pct: 70 };
async function resetDesk() {
  await engine.set('mkt.closes', ORIG);
  for (const k of Object.keys(DEFAULTS)) await engine.set('p.' + k, DEFAULTS[k]);
  await engine.set('ai.ledger', []);
  await engine.set('desk.champion', { gen: 0, strategy: 'sma_cross', params: { fast: 8, slow: 34, rsi_len: 14, rsi_max: 72, rsi_buy: 30, rsi_sell: 64 }, is_score: null, oos_score: null, verdict: '—' });
  await engine.set('desk.prev_champ', null);
  await engine.set('log.events', []);
}
async function deskParams() {
  const g = (k) => get('p.' + k);
  return { strategy: await g('strategy'), fast: await g('fast'), slow: await g('slow'), rsi_len: await g('rsi_len'),
    rsi_max: await g('rsi_max'), rsi_buy: await g('rsi_buy'), rsi_sell: await g('rsi_sell'), fee_bps: await g('fee_bps'), wf_pct: await g('wf_pct') };
}
const stripTs = ({ ts, ...rest }) => rest;
const chainFieldsOf = ({ row_hash, ts, ...fields }) => fields;

// ── section: the tape ─────────────────────────────────────────────────────────
console.log('\n── THE TAPE ────────────────────────────────────────────────');
const meta = await get('mkt.meta');
const bnhRef = refBacktest(ORIG, ORIG.map(() => 1), 0, 10000);
console.log(`  ${meta.n} synthetic daily bars (seed ${meta.seed}), regimes: ${meta.regimes.join(', ')}`);
console.log(`  buy & hold: ret ${(100 * bnhRef.metrics.total_return).toFixed(1)}%, sharpe ${bnhRef.metrics.sharpe.toFixed(2)}, dd ${(100 * bnhRef.metrics.maxdd).toFixed(1)}%`);

// ── checks ────────────────────────────────────────────────────────────────────
console.log('\n── CHECKS ──────────────────────────────────────────────────');

await H.check('S1 stops the desk on an untradeable series (NaN / short)', async () => {
  const bad = await call('rule.S1.check', { closes: [100, NaN, 102] });
  H.ok(bad.fired === true, 'NaN tape must fire S1');
  const short = await call('rule.S1.check', { closes: ORIG.slice(0, 49) });
  H.ok(short.fired === true, '49 bars must fire S1 (< 50)');
  const good = await call('rule.S1.check', { closes: ORIG });
  H.ok(good.fired === false, 'the real tape passes S1');
});

await H.check('indicators agree with the reference stack (SMA prefix-sum, delta-array RSI)', async () => {
  const P = await deskParams();
  const f = await get('ind.sma_fast'), s = await get('ind.sma_slow'), r = await get('ind.rsi');
  const rf = refSMA(ORIG, P.fast), rs = refSMA(ORIG, P.slow), rr = refRSI(ORIG, P.rsi_len);
  for (let i = 0; i < ORIG.length; i++) {
    H.ok((f[i] == null) === (rf[i] == null) && (f[i] == null || closeTo(f[i], rf[i], 1e-9)), `sma_fast[${i}]`);
    H.ok((s[i] == null) === (rs[i] == null) && (s[i] == null || closeTo(s[i], rs[i], 1e-9)), `sma_slow[${i}]`);
    H.ok((r[i] == null) === (rr[i] == null) && (r[i] == null || closeTo(r[i], rr[i], 1e-9)), `rsi[${i}]`);
  }
});

await H.check('signal agrees with the reference state machine; S3 audits structure', async () => {
  await resetDesk();
  const pos = await get('sig.pos');
  const P = await deskParams();
  const ref = refPositions(ORIG, P.strategy, P.fast, P.slow, P.rsi_len, P.rsi_max, P.rsi_buy, P.rsi_sell);
  H.eq(pos, ref, 'positions');
  const audit = await call('rule.S3.check', { pos, closes: ORIG, fast: P.fast, slow: P.slow, rsi_len: P.rsi_len });
  H.ok(audit.fired === false, 'real signal passes S3: ' + audit.why);
  const corrupted = ref.slice(); corrupted[1] = 1; // a long before any indicator exists
  const bad = await call('rule.S3.check', { pos: corrupted, closes: ORIG, fast: P.fast, slow: P.slow, rsi_len: P.rsi_len });
  H.ok(bad.fired === true, 'warmup long must fire S3');
});

await H.check('no lookahead: mutating bar 400 cannot move anything before it', async () => {
  // probe A: the last bar only touches itself
  await resetDesk();
  const b2 = await get('sig.pos');
  const m2 = ORIG.slice(); m2[ORIG.length - 1] = m2[ORIG.length - 1] * 1.2;
  await engine.set('mkt.closes', m2);
  const a2 = await get('sig.pos');
  for (let j = 0; j < ORIG.length - 1; j++) H.ok(a2[j] === b2[j], `pos[${j}] moved on the last bar`);
  // probe B: bar 400
  await resetDesk();
  const before = await get('sig.pos');
  const bt0 = await call('bt.run');
  const mutated = ORIG.slice(); mutated[400] = mutated[400] * 1.5;
  await engine.set('mkt.closes', mutated);
  const after = await get('sig.pos');
  for (let j = 0; j < 400; j++) H.ok(after[j] === before[j], `pos[${j}] moved on a future bar`);
  const bt = await call('bt.run');
  for (let j = 0; j < 400; j++) H.ok(closeTo(bt.equity[j], bt0.equity[j], 1e-12), `equity[${j}] moved on a future bar`);
  await resetDesk();
});

await H.check('HAND-COMPUTED tape: 60 bars, 50bps fee — every number done on paper', async () => {
  await resetDesk();
  // 10-bar segment + 50 flat bars (S1 needs >= 50). sma_cross fast=2 slow=4
  // (S2: slow >= fast+2), rsi_len=2 rsi_max=95, fee=0.5% of notional. By hand:
  // one long, entry bar 3 (sma2 102 > sma4 100.75), exit bar 6 (sma2 102 <
  // sma4 103). Fees 0.515 + 0.505.
  const seg = [100, 99, 101, 103, 105, 103, 101, 99, 97, 95];
  const tape = [...seg, ...new Array(50).fill(95)];
  await engine.set('mkt.closes', tape);
  await engine.set('p.fast', 2); await engine.set('p.slow', 4);
  await engine.set('p.rsi_len', 2); await engine.set('p.rsi_max', 95);
  await engine.set('p.fee_bps', 50);
  const bt = await call('bt.run');
  H.ok(bt.ok === true, 'desk refuses the hand tape: ' + (bt.text ?? '?'));
  const pos = await get('sig.pos');
  H.eq(pos.slice(0, 10), [0, 0, 0, 1, 1, 1, 0, 0, 0, 0], 'hand positions');
  H.eq(bt.trades.length, 1, 'one round trip');
  H.eq(bt.trades[0].entry, 3); H.eq(bt.trades[0].exit, 6);
  H.ok(closeTo(bt.trades[0].pnl, -3.02, 1e-9), `trade pnl (sell 101 - buy 103 - 0.515 - 0.505), got ${bt.trades[0].pnl}`);
  H.ok(closeTo(bt.equity[3], 9999.485, 1e-9), `equity[3] after entry fee, got ${bt.equity[3]}`);
  H.ok(closeTo(bt.equity[6], 9996.98, 1e-9), `equity[6] after exit fee, got ${bt.equity[6]}`);
  H.ok(closeTo(bt.equity[59], 9996.98, 1e-9), `equity[59] flat after exit, got ${bt.equity[59]}`);
  H.ok(closeTo(bt.metrics.total_return, -0.000302, 1e-9), 'total return');
  H.ok(closeTo(bt.metrics.maxdd, (10001.485 - 9996.98) / 10001.485, 1e-9), `max drawdown (peak 10001.485 → trough 9996.98), got ${bt.metrics.maxdd}`);
  H.eq(bt.metrics.win_rate, 0); H.eq(bt.metrics.n_trades, 1);
  H.ok(closeTo(bt.metrics.profit_factor, 0, 1e-12), 'profit factor with no wins');
  // the paper ledger and the equity path must tell the SAME story
  H.ok(closeTo(bt.trades.reduce((a, t) => a + t.pnl, 0), bt.equity[59] - 10000, 1e-9), 'sum(trade pnl) != equity change');
});

await H.check('backtest agrees with settlement-accounting reference on the real tape (3 configs)', async () => {
  await resetDesk();
  for (const cfg of [
    { label: 'default sma_cross', set: {} },
    { label: 'fast=21', set: { fast: 21 } },
    { label: 'rsi_reversion', set: { strategy: 'rsi_reversion' } },
    { label: 'fee storm 50bps', set: { fee_bps: 50 } },
  ]) {
    await resetDesk();
    for (const [k, v2] of Object.entries(cfg.set)) await engine.set('p.' + k, v2);
    const P = await deskParams();
    const bt = await call('bt.run');
    const pos = refPositions(ORIG, P.strategy, P.fast, P.slow, P.rsi_len, P.rsi_max, P.rsi_buy, P.rsi_sell);
    const ref = refBacktest(ORIG, pos, P.fee_bps, 10000);
    for (let i = 0; i < ORIG.length; i++) H.ok(closeTo(bt.equity[i], ref.equity[i], 1e-9), `${cfg.label}: equity[${i}] ${bt.equity[i]} vs ${ref.equity[i]}`);
    for (const k of Object.keys(ref.metrics)) H.ok(closeTo(bt.metrics[k], ref.metrics[k], 1e-8), `${cfg.label}: metric ${k}`);
    H.eq(bt.trades.length, ref.trades.length, `${cfg.label}: trade count`);
    for (let t = 0; t < ref.trades.length; t++) H.ok(closeTo(bt.trades[t].pnl, ref.trades[t].pnl, 1e-8), `${cfg.label}: trade ${t} pnl`);
    H.ok(closeTo(bt.trades.reduce((a, t) => a + t.pnl, 0), bt.equity[ORIG.length - 1] - 10000, 1e-9), `${cfg.label}: ledger vs equity`);
  }
  await resetDesk();
});

await H.check('walk-forward: split integrity, reference agreement, S6 verdicts', async () => {
  await resetDesk();
  const P = await deskParams();
  const wf = await call('wf.report');
  const { isN } = refSplit(ORIG.length, P.wf_pct);
  H.eq(wf.isN, isN, 'IS size'); H.eq(wf.oosN, ORIG.length - isN, 'OOS size');
  H.ok(wf.isN + wf.oosN === ORIG.length, 'windows tile the tape');
  const posAll = refPositions(ORIG, P.strategy, P.fast, P.slow, P.rsi_len, P.rsi_max, P.rsi_buy, P.rsi_sell);
  const refIS = refBacktest(ORIG.slice(0, isN), posAll.slice(0, isN), P.fee_bps, 10000);
  const refOOS = refBacktest(ORIG.slice(isN), posAll.slice(isN), P.fee_bps, 10000);
  for (const k of Object.keys(refIS.metrics)) {
    H.ok(closeTo(wf.is_m[k], refIS.metrics[k], 1e-8), `IS metric ${k}`);
    H.ok(closeTo(wf.oos_m[k], refOOS.metrics[k], 1e-8), `OOS metric ${k}`);
  }
  H.ok(['ROBUST', 'OVERFIT', 'WEAK'].includes(wf.verdict), 'verdict vocabulary');
  // S6 unit: memorization is caught
  H.eq((await call('rule.S6.check', { is_m: { sharpe: 2.0, maxdd: 0.1, n_trades: 20 }, oos_m: { sharpe: -0.2, maxdd: 0.3, n_trades: 20 } })).verdict, 'OVERFIT');
  H.eq((await call('rule.S6.check', { is_m: { sharpe: 0.4, maxdd: 0.1, n_trades: 20 }, oos_m: { sharpe: 1.1, maxdd: 0.05, n_trades: 20 } })).verdict, 'ROBUST');
  H.eq((await call('rule.S6.check', { is_m: { sharpe: -0.5, maxdd: 0.1, n_trades: 2 }, oos_m: { sharpe: 0.2, maxdd: 0.5, n_trades: 1 } })).verdict, 'WEAK');
});

await H.check('S7 promotion gate: beats-OOS-but-drops-IS is refused, beats-both is promoted', async () => {
  const champ = { is_score: 1.0, oos_score: 1.0 };
  const r1 = await call('rule.S7.check', { cand: { is_score: 1.4, oos_score: 0.9 }, champ });
  H.ok(r1.promote === false, 'OOS regression must refuse');
  const r2 = await call('rule.S7.check', { cand: { is_score: 0.8, oos_score: 1.4 }, champ });
  H.ok(r2.promote === false, 'IS degradation must refuse even with a better OOS');
  const r3 = await call('rule.S7.check', { cand: { is_score: 1.1, oos_score: 1.2 }, champ });
  H.ok(r3.promote === true, 'beats both must promote');
});

await H.check('THE OVERFIT TRAP: a candidate that wins IS and loses OOS is refused, champion untouched', async () => {
  await resetDesk();
  // find such a candidate with the REFERENCE stack (never the sheet's own code)
  const P = await deskParams();
  const { isN } = refSplit(ORIG.length, P.wf_pct);
  const IS = ORIG.slice(0, isN), OOS = ORIG.slice(isN);
  const refEval = (strategy, prm) => {
    const isM = refBacktest(IS, refPositions(IS, strategy, prm.fast, prm.slow, prm.rsi_len, prm.rsi_max, prm.rsi_buy, prm.rsi_sell), P.fee_bps, 10000).metrics;
    const oosM = refBacktest(OOS, refPositions(OOS, strategy, prm.fast, prm.slow, prm.rsi_len, prm.rsi_max, prm.rsi_buy, prm.rsi_sell), P.fee_bps, 10000).metrics;
    return { is_score: refScore(isM), oos_score: refScore(oosM), oos_sharpe: oosM.sharpe };
  };
  const seed = refEval(P.strategy, P);
  const rnd = mulberry32(42);
  let trap = null;
  for (let tries = 0; tries < 500 && !trap; tries++) {
    const fast = 2 + Math.floor(rnd() * 50);
    const cand = { strategy: rnd() < 0.5 ? 'sma_cross' : 'rsi_reversion', fast, slow: fast + 2 + Math.floor(rnd() * 60),
      rsi_len: 2 + Math.floor(rnd() * 20), rsi_max: 50 + Math.floor(rnd() * 45), rsi_buy: 10 + Math.floor(rnd() * 35),
      rsi_sell: 50 + Math.floor(rnd() * 40) };
    if (cand.rsi_buy >= cand.rsi_sell) continue;
    const ev = refEval(cand.strategy, cand);
    if (ev.is_score > seed.is_score && ev.oos_score < seed.oos_score && ev.oos_sharpe <= 0) trap = cand;
  }
  H.ok(trap != null, 'no overfit candidate found — tape too easy');
  const t = await call('ai.trainer', { gens: 1, seed: 5, force_cand: { strategy: trap.strategy, params: trap } });
  H.eq(t.tried, 1, 'only the forced candidate ran');
  H.eq(t.kept, 0, 'nothing promoted');
  const champ = await get('desk.champion');
  H.ok(closeTo(champ.oos_score, seed.oos_score, 1e-9), 'champion oos_score changed on a refused candidate');
  H.eq(champ.params.fast, DEFAULTS.fast, 'champion params changed on a refused candidate');
  const led = await get('ai.ledger');
  const last = led[led.length - 1];
  H.eq(last.kind, 'refuse', 'the trap must leave a refuse receipt');
  H.eq(last.verdict, 'OVERFIT', `trap verdict should be OVERFIT, got ${last.verdict}`);
  H.eq(last.wb_moved, true, 'the workbench did adopt the fit in-sample (that is what makes it an overfit trap)');
  H.ok(last.why.includes('S7'), 'refusal cites the gate');
});

await H.check('LIVE PROMOTION: a candidate that beats both windows takes the desk and re-prices it', async () => {
  // continue from the OVERFIT trap state: champion == desk defaults (seeded)
  const P = await deskParams();
  const { isN } = refSplit(ORIG.length, P.wf_pct);
  const IS = ORIG.slice(0, isN), OOS = ORIG.slice(isN);
  const refEval = (strategy, prm) => {
    const isM = refBacktest(IS, refPositions(IS, strategy, prm.fast, prm.slow, prm.rsi_len, prm.rsi_max, prm.rsi_buy, prm.rsi_sell), P.fee_bps, 10000).metrics;
    const oosM = refBacktest(OOS, refPositions(OOS, strategy, prm.fast, prm.slow, prm.rsi_len, prm.rsi_max, prm.rsi_buy, prm.rsi_sell), P.fee_bps, 10000).metrics;
    return { is_score: refScore(isM), oos_score: refScore(oosM) };
  };
  const seed = refEval(P.strategy, P);
  const rnd = mulberry32(77);
  let hero = null;
  for (let tries = 0; tries < 800 && !hero; tries++) {
    const fast = 2 + Math.floor(rnd() * 50);
    const cand = { strategy: 'sma_cross', fast, slow: fast + 2 + Math.floor(rnd() * 80),
      rsi_len: 2 + Math.floor(rnd() * 30), rsi_max: 50 + Math.floor(rnd() * 45), rsi_buy: 10 + Math.floor(rnd() * 35),
      rsi_sell: 50 + Math.floor(rnd() * 40) };
    if (cand.rsi_buy >= cand.rsi_sell) continue;
    const ev = refEval(cand.strategy, cand);
    if (ev.oos_score > seed.oos_score + 0.05 && ev.is_score >= seed.is_score - 1e-9) hero = { ...cand, ev };
  }
  H.ok(hero != null, 'no promotable candidate found');
  const t = await call('ai.trainer', { gens: 1, seed: 6, force_cand: { strategy: hero.strategy, params: hero } });
  H.eq(t.kept, 1, 'promoted');
  const champ = await get('desk.champion');
  H.eq(champ.params.fast, hero.fast, 'champion took the candidate fast');
  H.eq(champ.params.slow, hero.slow, 'champion took the candidate slow');
  H.eq(champ.strategy, hero.strategy, 'champion took the strategy');
  // the DESK re-priced through the reactive graph: bt.last == candidate params
  const bt = await call('bt.run');
  H.eq(bt.params.fast, hero.fast, 'desk re-priced to the champion');
  H.eq(bt.strategy, hero.strategy, 'desk runs the champion strategy');
  const led = await get('ai.ledger');
  H.eq(led[led.length - 1].kind, 'promote', 'promotion receipt booked');
});

await H.check('FULL TRAINING RUN: 24 generations, OOS improves, promotions are monotone', async () => {
  await resetDesk();
  const t = await call('ai.trainer', { gens: 24, seed: 11 });
  H.ok(t.ok === true, 'trainer ok');
  H.eq(t.tried, 24, 'every generation proposed a candidate');
  H.ok(t.kept >= 1, 'at least one promotion');
  const led = await get('ai.ledger');
  H.eq(led.length, 25, 'seed + 24 generation receipts');
  let champOOS = null;
  for (const r of led) {
    if (r.kind === 'seed') { champOOS = r.oos_score; continue; }
    if (r.kind === 'promote') {
      H.ok(r.oos_score > champOOS, `promotion at gen ${r.gen} did not beat the reigning OOS score`);
      champOOS = r.oos_score;
    }
  }
  const champ = await get('desk.champion');
  H.ok(champ.oos_score >= led[0].oos_score, 'final champion must not be worse than the seeded desk');
  for (const id of ['rule.S6.verdict', 'rule.S7.verdict']) H.ok((await get(id)) != null, `${id} never written`);
  const log = await get('log.events');
  H.ok(log.some(e => e.kind === 'trainer'), 'trainer logged its summary');
  console.log(`    curve: ${led.filter(r => r.kind === 'promote').length} promotions, champion OOS ${champ.oos_score.toFixed(3)} (desk seeded at ${led[0].oos_score.toFixed(3)}), verdict ${champ.verdict}`);
});

await H.check('WITNESS CHAIN: re-derives from GENESIS; one flipped byte breaks it', async () => {
  const led = await get('ai.ledger');
  const head = verifyChain(led.map(stripTs), chainFieldsOf);
  H.ok(head === led[led.length - 1].row_hash, 'kit re-derivation disagrees with the stored head');
  const cc = await call('ai.chaincheck');
  H.ok(cc.ok === true && cc.len === led.length, 'S8 in-sheet verdict');
  const tampered = JSON.parse(JSON.stringify(led));
  tampered[3].oos_score = tampered[3].oos_score + 0.001;
  const v8 = await call('rule.S8.check', { rows: tampered.map(stripTs) });
  H.ok(v8.ok === false && v8.fired === true, 'tampered row must break the chain');
  let threw = false;
  try { verifyChain(tampered.map(stripTs), chainFieldsOf); } catch { threw = true; }
  H.ok(threw, 'kit verifyChain must throw on tamper');
});

await H.check('DETERMINISM: same seed, same 24 generations, byte-identical receipts', async () => {
  const run1 = (await get('ai.ledger')).map(stripTs);
  await resetDesk();
  await call('ai.trainer', { gens: 24, seed: 11 });
  const run2 = (await get('ai.ledger')).map(stripTs);
  H.eq(JSON.stringify(run1), JSON.stringify(run2), 'receipt streams diverged');
});

await H.check('ONE NUDGE RE-PRICES THE DESK: p.fast push flows through every cell', async () => {
  await resetDesk();
  await call('bt.run'); await call('wf.report'); await call('bnh.run');
  const before = { sharpe: await get('met.sharpe'), wf: await get('met.wf'), art: await get('art.equity') };
  await engine.set('p.fast', 21);
  const bt = await call('bt.run');          // the re-price
  const wf = await call('wf.report');
  await call('bnh.run');
  const P = await deskParams();
  const ref = refBacktest(ORIG, refPositions(ORIG, P.strategy, P.fast, P.slow, P.rsi_len, P.rsi_max, P.rsi_buy, P.rsi_sell), P.fee_bps, 10000);
  for (let i = 0; i < ORIG.length; i += 97) H.ok(closeTo(bt.equity[i], ref.equity[i], 1e-9), `equity[${i}] after nudge`);
  const after = { sharpe: await get('met.sharpe'), wf: await get('met.wf'), art: await get('art.equity') };
  H.ok(closeTo(after.sharpe, bt.metrics.sharpe, 1e-12), 'met.sharpe is not the fresh receipt');
  H.ok(closeTo(after.sharpe, ref.metrics.sharpe, 1e-8), 'met.sharpe disagrees with the reference');
  H.ok(after.sharpe !== before.sharpe, 'nudge changed nothing');
  H.eq(wf.params.fast, 21, 'walk-forward did not follow the nudge');
  H.ok(after.art.ok === true && after.art.desk.length > 10, 'the glass went dark');
  H.ok(after.art.desk !== before.art.desk, 'sparkline did not move');
  H.ok((await get('met.maxdd')) != null && (await get('met.trades')) != null, 'metric cells missing');
});

await H.check('BUY & HOLD control group is priced and beaten-or-explained', async () => {
  await resetDesk();
  const bnh = await call('bnh.run');
  const ref = refBacktest(ORIG, ORIG.map(() => 1), 0, 10000);
  for (const k of Object.keys(ref.metrics)) H.ok(closeTo(bnh.metrics[k], ref.metrics[k], 1e-8), `bnh metric ${k}`);
  H.ok(closeTo(await get('met.bnh_ret'), bnh.metrics.total_return, 1e-12), 'met.bnh_ret is not the fresh receipt');
  H.ok(bnh.metrics.total_return > 0, 'informational: the tape itself loses money — control group still priced');
});

const { pass, fail } = await H.done();

// ── section: the learning curve — a final demo run, rebuilt from receipts ────
console.log('\n── LEARNING CURVE (a fresh 24-generation run, replayed from receipts) ──');
await resetDesk();
await call('ai.trainer', { gens: 24, seed: 11 });
await call('wf.report');   // the desk re-prices after promotion — judge the champion
const led = await get('ai.ledger');
for (const r of led) {
  if (r.kind === 'refuse' && r.gen % 4 !== 0) continue;
  const p = r.params ?? {};
  const wb = r.wb_moved ? '·wb' : '   ';
  console.log(`  gen ${String(r.gen).padStart(2)}  ${r.kind.padEnd(7)}${wb}  ${String(r.strategy ?? '—').padEnd(14)}  f/s ${String(p.fast ?? '—').padStart(3)}/${String(p.slow ?? '—').padEnd(3)}  IS ${r.is_score == null ? '    —  ' : r.is_score.toFixed(3).padStart(6)}  OOS ${r.oos_score == null ? '    —  ' : r.oos_score.toFixed(3).padStart(6)}  ${r.verdict ?? ''}`);
}
const champ = await get('desk.champion');
console.log(`\n  champion: gen ${champ.gen} — ${champ.strategy} fast=${champ.params.fast} slow=${champ.params.slow} rsi_max=${champ.params.rsi_max}`);
console.log(`  OOS score ${champ.oos_score?.toFixed(3)} — ${await get('met.wf')} out of sample`);

// ── emit artifacts ────────────────────────────────────────────────────────────
const sheet = buildSheet();
mkdirSync(join(here, '..', 'experiments'), { recursive: true });
writeFileSync(join(here, 'quant.sheet.json'), JSON.stringify(sheet, null, 1));
const promotes = led.filter(r => r.kind === 'promote' || r.kind === 'seed');
writeFileSync(join(here, '..', 'experiments', 'quant.json'), JSON.stringify({
  built: '2026-09-25', seed: meta.seed, bars: meta.n, cells: sheet.cells.length,
  checks: { pass, fail },
  tape: { bnh: bnhRef.metrics },
  champion: champ,
  promotions: promotes.length,
  curve: led.map(r => ({ seq: r.seq, gen: r.gen, kind: r.kind, wb_moved: r.wb_moved, strategy: r.strategy, params: r.params, is_score: r.is_score, oos_score: r.oos_score, verdict: r.verdict, row_hash: r.row_hash })),
  wf: await get('wf.last'),
}, null, 1));
console.log(`\n  (emitted quant.sheet.json — ${sheet.cells.length} cells; experiments/quant.json)`);
if (fail) process.exitCode = 1;
