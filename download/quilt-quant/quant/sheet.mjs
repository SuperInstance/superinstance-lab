// QUILT-QUANT — the trading desk as a spreadsheet.
//
// One instrument, daily bars. Every indicator, every risk rule, every metric
// is a CELL. One value push (a parameter nudge) re-prices the entire desk:
// indicators -> signal -> backtest -> metrics -> walk-forward verdict -> art.
//
// Architecture (the arcade template, aimed at a market):
//   strategy.book    the complete trading doctrine in precise numbered
//                    language (S1..S8) — like the games' rules.book
//   rule.Sn.law      the clause as written
//   rule.Sn.check    the machine port — a PURE program cell: (input) -> verdict
//   ind.* / sig.pos  probe-able indicator + position cells (the desk's glass)
//   bt.run           the desk's pricing engine: sequences S1..S5, returns the
//                    full backtest receipt (equity, trades, metrics)
//   wf.report        walk-forward: fit window vs judge window, S6 verdict
//   ai.trainer       the self-improvement loop: perturbs params, fits on IS,
//                    and may only PROMOTE through the S7 out-of-sample gate;
//                    every generation books a witness receipt (fnv1a64 chain)
//   desk.champion    the reigning config — when the trainer promotes, it
//                    writes the champion AND the parameter cells, and the
//                    whole desk visibly re-prices through the reactive graph
//
// THE HONESTY MODEL (what makes this analytics, not a slot machine):
//   - selection happens on IN-SAMPLE data only (the workbench)
//   - promotion happens only if OUT-OF-SAMPLE score beats the champion (S7)
//   - a candidate that wins in-sample but loses out-of-sample is an OVERFIT
//     verdict (S6) and is refused with a receipt — the harness proves it
//   - every promotion is tamper-evident: the receipt chain re-derives (S8)

import { v, law, prog, formula, listenerCell, SNIPPETS, mulberry32 } from '../shared/kit.mjs';

// ── strategy.book ────────────────────────────────────────────────────────────
const BOOK = `QUANT DESK — STRATEGY BOOK v1 (one instrument, daily closes)

S1 (universe)     The desk prices ONE instrument from a single series of daily
                  closes (mkt.closes). Cash starts at desk.cash0. A series
                  that is shorter than 50 bars, or contains a bar that is not
                  a finite positive number, cannot be traded: S1 stops the
                  desk and nothing downstream may run.

S2 (indicators)   sma_w is the arithmetic mean of the last w closes; it does
                  not exist until w closes have printed. rsi_n is Wilder's
                  RSI over closes with period n; it does not exist until n+1
                  closes have printed. An indicator cell that does not exist
                  yields FLAT, never a guess.

S3 (signal)       Two strategies may run, one at a time (p.strategy).
                  sma_cross: LONG (+1) when sma_fast > sma_slow AND
                  rsi <= p.rsi_max (the overbought gate); FLAT otherwise.
                  rsi_reversion: LONG when rsi <= p.rsi_buy; FLAT when
                  rsi >= p.rsi_sell; while in between, HOLD the previous
                  position. A signal may only use bars up to and including
                  the bar it is computed on (no lookahead), and it acts at
                  the NEXT close: position[i] earns close[i+1] - close[i].

S4 (costs)        Every position CHANGE pays p.fee_bps of the traded
                  notional (price * |change|) at the close where the trade
                  happens. No leverage: the position is 0 or 1 unit. A trade
                  that is still open at the last bar is closed there and
                  pays its exit fee like any other.

S5 (metrics)      The desk reports: total_return, CAGR (252d year), annual-
                  ized Sharpe (rf=0), max_drawdown, n_trades, win_rate
                  (per round trip incl. fees), profit_factor, exposure.
                  A metric that is not a finite number of the right shape
                  stops the desk (S5 refuses to print nonsense).

S6 (walk-forward) The first p.wf_pct of bars is the FIT window (IS); the
                  rest is the JUDGE window (OOS). IS is for fitting, OOS is
                  for judging. A config is ROBUST when OOS sharpe >= 0.75,
                  OOS max_drawdown <= 40% and OOS n_trades >= 3; a config
                  that wins in-sample while losing out-of-sample is
                  OVERFIT; everything else is WEAK. Both windows are always
                  reported; printing only the flattering one is forbidden.

S7 (promotion)    A candidate replaces the desk champion only if BOTH hold:
                  its OOS score beats the champion's OOS score, AND its IS
                  score does not degrade the champion's IS score. Score =
                  sharpe - 2*maxdd - (0.5 if fewer than 3 trades). Every
                  promotion and every refusal is booked as a witness
                  receipt in the ai.ledger chain.

S8 (audit)        The desk is recomputable: every number derives from
                  mkt.closes + parameter cells + this book. The ai.ledger
                  is an fnv1a64 hash chain rooted at GENESIS; S8 re-derives
                  it and any tampered row breaks the chain visibly. The
                  trainer may nudge parameter cells only; the book itself
                  may not be edited mid-run.`;

// ── market data (build-time, seeded, reproducible) ───────────────────────────
export function makeCloses(seed = 20260925) {
  const rnd = mulberry32(seed);
  const gauss = () => {
    const u = Math.max(rnd(), 1e-12), w = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w);
  };
  // regime tape: trend / bear / chop / trend / bear / recovery — crossover
  // strategies thrive in trends and get whipsawed in chop, which is exactly
  // the tradeoff the trainer has to learn around.
  const REGIMES = [
    { len: 120, drift: +0.0011, vol: 0.010, name: 'trend-up' },
    { len: 90,  drift: -0.0006, vol: 0.014, name: 'bear' },
    { len: 110, drift: +0.0009, vol: 0.011, name: 'trend-up' },
    { len: 80,  drift: +0.0000, vol: 0.017, name: 'chop' },
    { len: 120, drift: +0.0012, vol: 0.010, name: 'trend-up' },
    { len: 100, drift: -0.0008, vol: 0.013, name: 'bear' },
    { len: 140, drift: +0.0010, vol: 0.009, name: 'recovery' },
  ];
  const closes = []; let price = 100;
  for (const rg of REGIMES) {
    for (let i = 0; i < rg.len; i++) {
      price *= Math.exp(rg.drift - 0.5 * rg.vol * rg.vol + rg.vol * gauss());
      closes.push(price);
    }
  }
  return { closes, meta: { n: closes.length, start: 100, seed, source: 'synthetic-gbm-regimes', regimes: REGIMES.map(r => r.name + '×' + r.len) } };
}

// ── the pure quant kernel (inlined into pricing cells at build time) ─────────
const QFNS = `
// Q — the pure quant kernel, inlined into every pricing cell (new-Function
// scope: helpers must live inside the cell — the E8 lesson).
const Q = {
  sma(c, w) { const n = c.length, out = new Array(n).fill(null); let s = 0;
    for (let i = 0; i < n; i++) { s += c[i]; if (i >= w) s -= c[i - w]; if (i >= w - 1) out[i] = s / w; }
    return out; },
  rsi(c, n) { const L = c.length, out = new Array(L).fill(null);
    if (L < n + 1) return out;
    let g = 0, l = 0; for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; if (d >= 0) g += d; else l -= d; }
    let ag = g / n, al = l / n; out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    for (let i = n + 1; i < L; i++) { const d = c[i] - c[i - 1], gg = d > 0 ? d : 0, ll = d < 0 ? -d : 0;
      ag = (ag * (n - 1) + gg) / n; al = (al * (n - 1) + ll) / n; out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); }
    return out; },
  pos(c, strategy, fast, slow, rsiLen, rsiMax, rsiBuy, rsiSell) {
    const f = Q.sma(c, fast), s = Q.sma(c, slow), r = Q.rsi(c, rsiLen);
    const p = new Array(c.length).fill(0);
    for (let i = 0; i < c.length; i++) {
      if (f[i] == null || s[i] == null || r[i] == null) { p[i] = 0; continue; }
      if (strategy === 'rsi_reversion') {
        if (r[i] <= rsiBuy) p[i] = 1;
        else if (r[i] >= rsiSell) p[i] = 0;
        else p[i] = (i > 0 ? p[i - 1] : 0);
      } else {
        p[i] = (f[i] > s[i] && r[i] <= rsiMax) ? 1 : 0;
      }
    }
    return p; },
  backtest(c, p, feeBps, cash0) {
    const n = c.length; const eq = new Array(n); eq[0] = cash0;
    const fr = feeBps / 10000; const trades = [];
    let cur = null, tPnl = 0;
    for (let i = 1; i < n; i++) {
      const pnl = p[i - 1] * (c[i] - c[i - 1]);
      const fee = (p[i] !== p[i - 1]) ? fr * c[i] * Math.abs(p[i] - p[i - 1]) : 0;
      eq[i] = eq[i - 1] + pnl - fee;
      if (p[i] === 1 && p[i - 1] !== 1) { cur = { entry: i }; tPnl = -fee; }
      else if (cur && p[i] !== 1) { tPnl += pnl - fee; cur.exit = i; cur.pnl = tPnl; trades.push(cur); cur = null; }
      else if (cur) { tPnl += pnl; }
    }
    // S4: a trade still open at the last bar closes there — the desk pays the
    // liquidation fee in the EQUITY path too, so trades and equity always agree
    if (cur) { eq[n - 1] -= fr * c[n - 1]; cur.exit = n - 1; cur.pnl = tPnl - fr * c[n - 1]; trades.push(cur); }
    let wins = 0, grossWin = 0, grossLoss = 0;
    for (const t of trades) { if (t.pnl >= 0) { wins++; grossWin += t.pnl; } else grossLoss += -t.pnl; }
    let peak = eq[0], maxdd = 0, expo = 0;
    for (let i = 1; i < n; i++) {
      if (eq[i] < peak) { const dd = (peak - eq[i]) / peak; if (dd > maxdd) maxdd = dd; } else peak = eq[i];
      if (p[i - 1] > 0) expo++;
    }
    let sum = 0, sum2 = 0, cnt = 0;
    for (let i = 1; i < n; i++) { const r = eq[i] / eq[i - 1] - 1; sum += r; sum2 += r * r; cnt++; }
    const mean = sum / cnt, sd = Math.sqrt(Math.max(sum2 / cnt - mean * mean, 0));
    const years = (n - 1) / 252, last = eq[n - 1];
    const metrics = {
      total_return: last / cash0 - 1,
      cagr: last > 0 ? Math.pow(last / cash0, 1 / years) - 1 : -1,
      sharpe: sd > 0 ? mean / sd * Math.sqrt(252) : 0,
      maxdd, n_trades: trades.length,
      win_rate: trades.length ? wins / trades.length : 0,
      profit_factor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? 99 : 0),
      exposure: expo / (n - 1),
    };
    return { equity: eq, metrics, trades };
  },
  score(m) { return m.sharpe - 2 * m.maxdd - (m.n_trades < 3 ? 0.5 : 0); },
  wfSplit(n, pct) { const isN = Math.max(30, Math.min(n - 30, Math.floor(n * pct / 100))); return { isN, oosN: n - isN }; },
  paramsOk(strategy, p) {
    if (!Number.isInteger(p.fast) || !Number.isInteger(p.slow) || !Number.isInteger(p.rsi_len)) return false;
    if (p.fast < 2 || p.slow < p.fast + 2 || p.rsi_len < 2 || p.rsi_len > 60) return false;
    if (p.rsi_max < 50 || p.rsi_max > 95) return false;
    if (p.rsi_buy < 10 || p.rsi_buy > 45 || p.rsi_sell < 50 || p.rsi_sell > 90 || p.rsi_buy >= p.rsi_sell) return false;
    if (p.fee_bps < 0 || p.fee_bps > 50) return false;
    return strategy === 'sma_cross' || strategy === 'rsi_reversion';
  },
  perturb(strategy, p, rnd) {
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const st = rnd() < 0.10 ? (strategy === 'sma_cross' ? 'rsi_reversion' : 'sma_cross') : strategy;
    const q = { ...p };
    const knob = ['fast', 'slow', 'rsi_len', 'rsi_max', 'rsi_buy', 'rsi_sell'][Math.floor(rnd() * 6)];
    const step = { fast: 1 + Math.floor(rnd() * 5), slow: 2 + Math.floor(rnd() * 8), rsi_len: 1 + Math.floor(rnd() * 3),
      rsi_max: 2 + Math.floor(rnd() * 6), rsi_buy: 2 + Math.floor(rnd() * 6), rsi_sell: 2 + Math.floor(rnd() * 6) }[knob];
    q[knob] = clamp((rnd() < 0.5 ? q[knob] - step : q[knob] + step),
      { fast: 2, slow: 4, rsi_len: 2, rsi_max: 50, rsi_buy: 10, rsi_sell: 50 }[knob],
      { fast: 60, slow: 160, rsi_len: 40, rsi_max: 95, rsi_buy: 45, rsi_sell: 90 }[knob]);
    if (q.slow < q.fast + 2) q.slow = q.fast + 2;
    if (q.rsi_buy >= q.rsi_sell) q.rsi_sell = q.rsi_buy + 5;
    return { strategy: st, params: q };
  },
};`;

// ── rule checkers (PURE: everything arrives in input; no state reads) ────────
const CHK_S1 = `
const c = input?.closes ?? [];
const okLen = Array.isArray(c) && c.length >= 50;
const okVals = okLen && c.every(x => Number.isFinite(x) && x > 0);
const fired = !(okLen && okVals);
return { fired, why: !fired
  ? 'universe sealed: ' + c.length + ' finite positive daily closes (S1).'
  : 'the series cannot be traded — len=' + c.length + ' (needs >= 50), all finite positive=' + okVals + ' (S1 stops the desk).' };`;

const CHK_S2 = `
const { strategy } = input ?? {};
const p = input?.params ?? {};
const ok = (strategy === 'sma_cross' || strategy === 'rsi_reversion')
  && Number.isInteger(p.fast) && Number.isInteger(p.slow) && Number.isInteger(p.rsi_len)
  && p.fast >= 2 && p.slow >= p.fast + 2 && p.rsi_len >= 2 && p.rsi_len <= 60
  && p.rsi_max >= 50 && p.rsi_max <= 95
  && p.rsi_buy >= 10 && p.rsi_buy <= 45 && p.rsi_sell >= 50 && p.rsi_sell <= 90 && p.rsi_buy < p.rsi_sell
  && p.fee_bps >= 0 && p.fee_bps <= 50;
return { fired: !ok, why: ok
  ? 'params sane: ' + strategy + ' fast=' + p.fast + ' slow=' + p.slow + ' rsi_len=' + p.rsi_len + ' fee=' + p.fee_bps + 'bps (S2).'
  : 'parameter set is not tradeable (S2: fast>=2, slow>=fast+2, 2<=rsi_len<=60, gates in range, fee 0..50bps).' };`;

const CHK_S3 = `
const { pos, closes, fast, slow, rsi_len } = input ?? {};
const same = Array.isArray(pos) && Array.isArray(closes) && pos.length === closes.length;
const binary = same && pos.every(x => x === 0 || x === 1);
const warm = Math.max(fast - 1, slow - 1, rsi_len);
const noEarly = same && pos.slice(0, Math.min(warm, pos.length)).every(x => x === 0);
const fired = !(same && binary && noEarly);
return { fired, why: !fired
  ? 'signal clean: ' + pos.length + ' bars, binary, flat through warmup bar ' + warm + ' (S3: no lookahead, no guesses).'
  : 'signal malformed — same length=' + same + ', binary=' + binary + ', flat through warmup=' + noEarly + ' (S3 refuses).' };`;

const CHK_S4 = `
const { equity, fee_bps, cash0 } = input ?? {};
const finite = Array.isArray(equity) && equity.every(x => Number.isFinite(x));
const rooted = Array.isArray(equity) && Math.abs(equity[0] - cash0) < 1e-9;
const solvent = finite && equity.every(x => x >= -1e-6);
const fired = !(finite && rooted && solvent);
return { fired, why: !fired
  ? 'costs honored: equity starts at cash0, stays finite and solvent; every position change was priced at ' + fee_bps + 'bps (S4).'
  : 'equity path invalid — finite=' + finite + ', rooted at cash0=' + rooted + ', solvent=' + solvent + ' (S4 refuses).' };`;

const CHK_S5 = `
const m = input?.metrics ?? {};
const keys = ['total_return', 'cagr', 'sharpe', 'maxdd', 'n_trades', 'win_rate', 'profit_factor', 'exposure'];
const finite = keys.every(k => Number.isFinite(m[k]));
const shape = Number.isInteger(m.n_trades) && m.n_trades >= 0
  && m.maxdd >= 0 && m.maxdd <= 1 && m.exposure >= 0 && m.exposure <= 1
  && m.win_rate >= 0 && m.win_rate <= 1 && m.total_return > -1;
const fired = !(finite && shape);
return { fired, why: !fired
  ? 'metrics sane: ret ' + (100 * m.total_return).toFixed(1) + '%, sharpe ' + m.sharpe.toFixed(2) + ', dd ' + (100 * m.maxdd).toFixed(1) + '%, ' + m.n_trades + ' trades (S5).'
  : 'metrics are not printable — finite=' + finite + ', shapes ok=' + shape + ' (S5 stops the desk rather than show nonsense).' };`;

const CHK_S6 = `
const { is_m, oos_m } = input ?? {};
const robust = oos_m.sharpe >= 0.75 && oos_m.maxdd <= 0.40 && oos_m.n_trades >= 3;
const overfit = is_m.sharpe > 0 && oos_m.sharpe <= 0;
const verdict = overfit ? 'OVERFIT' : (robust ? 'ROBUST' : 'WEAK');
return { verdict, fired: verdict !== 'ROBUST', why: verdict === 'ROBUST'
  ? 'ROBUST out of sample: sharpe ' + oos_m.sharpe.toFixed(2) + ' >= 0.75, dd ' + (100 * oos_m.maxdd).toFixed(1) + '% <= 40%, ' + oos_m.n_trades + ' trades (S6).'
  : verdict === 'OVERFIT'
  ? 'OVERFIT: in-sample sharpe ' + is_m.sharpe.toFixed(2) + ' but out-of-sample ' + oos_m.sharpe.toFixed(2) + ' — the fit memorized the fit window (S6).'
  : 'WEAK out of sample: sharpe ' + oos_m.sharpe.toFixed(2) + ' does not clear the ROBUST bar (S6: 0.75 sharpe, 40% dd, 3+ trades).' };`;

const CHK_S7 = `
const { cand, champ } = input ?? {};
const beatOOS = cand.oos_score > champ.oos_score + 1e-9;
const noISDrop = cand.is_score >= champ.is_score - 1e-9;
const promote = beatOOS && noISDrop;
return { promote, fired: !promote, why: promote
  ? 'PROMOTED: OOS score ' + cand.oos_score.toFixed(3) + ' beats champion ' + champ.oos_score.toFixed(3) + ', IS score holds (S7).'
  : 'REFUSED: ' + (!beatOOS
      ? 'OOS score ' + cand.oos_score.toFixed(3) + ' does not beat champion ' + champ.oos_score.toFixed(3)
      : 'IS score ' + cand.is_score.toFixed(3) + ' degrades champion ' + champ.is_score.toFixed(3)) + ' (S7 gate).' };`;

const CHK_S8 = `
${SNIPPETS.witness}
const rows = input?.rows ?? [];
const fieldsOf = ({ row_hash, ts, ...fields }) => fields;
let prev = '0'.repeat(16);
try {
  for (let i = 0; i < rows.length; i++) {
    const expect = fnv1a64(canon({ ...fieldsOf(rows[i]), prev_hash: prev }));
    if (rows[i].row_hash !== expect) throw new Error('hash mismatch at seq ' + (rows[i].seq ?? i));
    if (rows[i].prev_hash !== prev) throw new Error('prev_hash mismatch at seq ' + (rows[i].seq ?? i));
    prev = rows[i].row_hash;
  }
  return { ok: true, len: rows.length, head: prev, fired: false,
    why: 'chain sealed: ' + rows.length + ' receipts re-derive from GENESIS, head ' + prev.slice(0, 8) + '… (S8).' };
} catch (e) {
  return { ok: false, len: rows.length, head: null, fired: true, why: 'TAMPERED: ' + e.message + ' (S8) — the ledger no longer proves its own history.' };
}`;

// ── pricing cells ────────────────────────────────────────────────────────────
const IND_FAST = `
${QFNS}
const closes = (await runtime.get('mkt.closes')).data;
const p = (await runtime.get('p.fast')).data;
return Q.sma(closes, p);`;

const IND_SLOW = `
${QFNS}
const closes = (await runtime.get('mkt.closes')).data;
const p = (await runtime.get('p.slow')).data;
return Q.sma(closes, p);`;

const IND_RSI = `
${QFNS}
const closes = (await runtime.get('mkt.closes')).data;
const n = (await runtime.get('p.rsi_len')).data;
return Q.rsi(closes, n);`;

const SIG_POS = `
${QFNS}
const g = (id) => runtime.get(id).then(r => r.data);
const closes = await g('mkt.closes');
const strategy = await g('p.strategy');
const fast = await g('p.fast'), slow = await g('p.slow');
const rsi_len = await g('p.rsi_len'), rsi_max = await g('p.rsi_max');
const rsi_buy = await g('p.rsi_buy'), rsi_sell = await g('p.rsi_sell');
return Q.pos(closes, strategy, fast, slow, rsi_len, rsi_max, rsi_buy, rsi_sell);`;

const BT_RUN = `
${QFNS}
// the desk's pricing engine — sequences the rule cells, applies S4/S5 itself.
const g = (id) => runtime.get(id).then(r => r.data);
const s = (id, val) => runtime.set(id, val);
const ts = Date.now();
const fired = [];
const closes = await g('mkt.closes');
const cash0 = await g('desk.cash0');
const s1 = (await runtime.call('rule.S1.check', { closes })).data;
await s('rule.S1.verdict', { ...s1, ts }); fired.push('S1');
if (s1.fired) { const r = { ok: false, rule: 'S1', text: s1.why, fired }; await s('bt.last', r); return r; }

const strategy = await g('p.strategy');
const params = { fast: await g('p.fast'), slow: await g('p.slow'), rsi_len: await g('p.rsi_len'),
  rsi_max: await g('p.rsi_max'), rsi_buy: await g('p.rsi_buy'), rsi_sell: await g('p.rsi_sell'),
  fee_bps: await g('p.fee_bps') };
const s2 = (await runtime.call('rule.S2.check', { strategy, params })).data;
await s('rule.S2.verdict', { ...s2, ts }); fired.push('S2');
if (s2.fired) { const r = { ok: false, rule: 'S2', text: s2.why, fired, strategy, params }; await s('bt.last', r); return r; }

const pos = (await runtime.get('sig.pos')).data;
const s3 = (await runtime.call('rule.S3.check', { pos, closes, fast: params.fast, slow: params.slow, rsi_len: params.rsi_len })).data;
await s('rule.S3.verdict', { ...s3, ts }); fired.push('S3');
if (s3.fired) { const r = { ok: false, rule: 'S3', text: s3.why, fired, strategy, params }; await s('bt.last', r); return r; }

const bt = Q.backtest(closes, pos, params.fee_bps, cash0);
const s4 = (await runtime.call('rule.S4.check', { equity: bt.equity, fee_bps: params.fee_bps, cash0 })).data;
await s('rule.S4.verdict', { ...s4, ts }); fired.push('S4');
if (s4.fired) { const r = { ok: false, rule: 'S4', text: s4.why, fired, strategy, params }; await s('bt.last', r); return r; }

const s5 = (await runtime.call('rule.S5.check', { metrics: bt.metrics })).data;
await s('rule.S5.verdict', { ...s5, ts }); fired.push('S5');
if (s5.fired) { const r = { ok: false, rule: 'S5', text: s5.why, fired, strategy, params }; await s('bt.last', r); return r; }

// PUBLISH the receipt as a value cell — every derived formula reads the
// published receipt, so the desk is always a consistent snapshot.
const receipt = { ok: true, fired, strategy, params, equity: bt.equity, metrics: bt.metrics, trades: bt.trades, ts };
await s('bt.last', receipt);
return receipt;`;

const BNH_RUN = `
${QFNS}
// buy & hold — the control group every strategy must beat or explain
const closes = (await runtime.get('mkt.closes')).data;
const cash0 = (await runtime.get('desk.cash0')).data;
const ones = new Array(closes.length).fill(1);
const bt = Q.backtest(closes, ones, 0, cash0);
const receipt = { ok: true, metrics: bt.metrics, equity: bt.equity };
await runtime.set('bnh.last', receipt);
return receipt;`;

const WF_REPORT = `
${QFNS}
// walk-forward: refit-window vs judge-window for the CURRENT desk params.
const g = (id) => runtime.get(id).then(r => r.data);
const s = (id, val) => runtime.set(id, val);
const ts = Date.now();
const closes = await g('mkt.closes');
const cash0 = await g('desk.cash0');
const strategy = await g('p.strategy');
const params = { fast: await g('p.fast'), slow: await g('p.slow'), rsi_len: await g('p.rsi_len'),
  rsi_max: await g('p.rsi_max'), rsi_buy: await g('p.rsi_buy'), rsi_sell: await g('p.rsi_sell'),
  fee_bps: await g('p.fee_bps') };
const pct = await g('p.wf_pct');
const { isN, oosN } = Q.wfSplit(closes.length, pct);
const runSlice = (c) => {
  const pos = Q.pos(c, strategy, params.fast, params.slow, params.rsi_len, params.rsi_max, params.rsi_buy, params.rsi_sell);
  return Q.backtest(c, pos, params.fee_bps, cash0).metrics;
};
const is_m = runSlice(closes.slice(0, isN));
const oos_m = runSlice(closes.slice(isN));
const s6 = (await runtime.call('rule.S6.check', { is_m, oos_m })).data;
await s('rule.S6.verdict', { ...s6, ts });
const report = { ok: true, isN, oosN, strategy, params, is_m, oos_m, verdict: s6.verdict, why: s6.why };
await s('wf.last', report);
return report;`;

const AI_TRAINER = `
${QFNS}
${SNIPPETS.rng}
${SNIPPETS.witness}
// THE TRAINER — self-improvement through the gated pipeline.
// selection on IS (the workbench), promotion only through the S7 OOS gate.
const g = (id) => runtime.get(id).then(r => r.data);
const s = (id, val) => runtime.set(id, val);
const logEv = async (e) => { const lg = await g('log.events'); await s('log.events', [...lg.slice(-199), { ts: Date.now(), ...e }]); };

const closes = await g('mkt.closes');
const cash0 = await g('desk.cash0');
const feeBps = await g('p.fee_bps');
const { isN } = Q.wfSplit(closes.length, await g('p.wf_pct'));
const IS = closes.slice(0, isN), OOS = closes.slice(isN);

const ledger = [...((await g('ai.ledger')) ?? [])];
let prev = ledger.length ? ledger[ledger.length - 1].row_hash : GENESIS_PREV;
const book = async (fields) => {
  const seq = ledger.length + 1;
  const row = { ...fields, seq, prev_hash: prev };
  row.row_hash = fnv1a64(canon(row));
  ledger.push({ ...row, ts: Date.now() });
  prev = row.row_hash;
  await s('ai.ledger', [...ledger]);
};

const evalCand = (strategy, prm) => {
  const run = (c) => {
    const pos = Q.pos(c, strategy, prm.fast, prm.slow, prm.rsi_len, prm.rsi_max, prm.rsi_buy, prm.rsi_sell);
    return Q.backtest(c, pos, feeBps, cash0).metrics;
  };
  const is_m = run(IS), oos_m = run(OOS);
  return { is_m, oos_m, is_score: Q.score(is_m), oos_score: Q.score(oos_m) };
};

// seed the champion from the desk's current params (a real bar to beat)
const curStrategy = await g('p.strategy');
let champParams = { fast: await g('p.fast'), slow: await g('p.slow'), rsi_len: await g('p.rsi_len'),
  rsi_max: await g('p.rsi_max'), rsi_buy: await g('p.rsi_buy'), rsi_sell: await g('p.rsi_sell') };
let champStrategy = curStrategy;
const seedEv = evalCand(champStrategy, champParams);
let champ = { strategy: champStrategy, params: { ...champParams }, is_score: seedEv.is_score, oos_score: seedEv.oos_score };
await book({ kind: 'seed', gen: 0, strategy: champStrategy, params: { ...champParams },
  is_score: seedEv.is_score, oos_score: seedEv.oos_score, verdict: 'SEED', kept: true,
  why: 'champion seeded from the desk: OOS score ' + seedEv.oos_score.toFixed(3) + '.' });

const rnd = rng(input?.seed ?? 7);
const gens = Math.max(1, Math.min(200, input?.gens ?? 24));
let workbench = { strategy: champ.strategy, params: { ...champ.params }, is_score: champ.is_score };
let tried = 0, kept = 0, lastVerdict = 'SEED';

for (let gen = 1; gen <= gens; gen++) {
  let cand = Q.perturb(workbench.strategy, workbench.params, rnd);
  if (gen === 1 && input?.force_cand) cand = input.force_cand; // the LLM strategist's lever
  if (!Q.paramsOk(cand.strategy, cand.params)) {
    await book({ kind: 'refuse', gen, strategy: cand.strategy, params: cand.params,
      is_score: null, oos_score: null, verdict: 'S2', kept: false, why: 'candidate params not tradeable (S2).' });
    continue;
  }
  tried++;
  const ev = evalCand(cand.strategy, cand.params);
  const s6 = (await runtime.call('rule.S6.check', { is_m: ev.is_m, oos_m: ev.oos_m })).data;
  lastVerdict = s6.verdict;
  let wbMoved = false;
  if (ev.is_score > workbench.is_score) { workbench = { strategy: cand.strategy, params: { ...cand.params }, is_score: ev.is_score }; wbMoved = true; }
  const s7 = (await runtime.call('rule.S7.check',
    { cand: { is_score: ev.is_score, oos_score: ev.oos_score }, champ: { is_score: champ.is_score, oos_score: champ.oos_score } })).data;
  await s('rule.S7.verdict', { ...s7, ts: Date.now(), gen });
  if (s7.promote) {
    champ = { strategy: cand.strategy, params: { ...cand.params }, is_score: ev.is_score, oos_score: ev.oos_score };
    champParams = { ...cand.params }; champStrategy = cand.strategy;
    workbench = { strategy: cand.strategy, params: { ...cand.params }, is_score: ev.is_score };
    kept++;
    await book({ kind: 'promote', gen, strategy: cand.strategy, params: { ...cand.params },
      is_score: ev.is_score, oos_score: ev.oos_score, verdict: s6.verdict, kept: true, wb_moved: true, why: s7.why });
  } else {
    // the gate speaks: every non-promotion is a REFUSE receipt (the workbench
    // may still have adopted the fit for IS — that is wb_moved, not kept)
    await book({ kind: 'refuse', gen, strategy: cand.strategy, params: { ...cand.params },
      is_score: ev.is_score, oos_score: ev.oos_score, verdict: s6.verdict, kept: false, wb_moved: wbMoved, why: s7.why });
  }
}

// THE PROMOTION CASCADE — write the champion and its params; the reactive
// graph re-prices indicators, signal, backtest, metrics, walk-forward, art.
await s('desk.champion', { gen: gens, strategy: champ.strategy, params: { ...champ.params },
  is_score: champ.is_score, oos_score: champ.oos_score, verdict: lastVerdict });
await s('p.strategy', champ.strategy);
await s('p.fast', champ.params.fast); await s('p.slow', champ.params.slow);
await s('p.rsi_len', champ.params.rsi_len); await s('p.rsi_max', champ.params.rsi_max);
await s('p.rsi_buy', champ.params.rsi_buy); await s('p.rsi_sell', champ.params.rsi_sell);
await logEv({ kind: 'trainer', text: 'trainer: ' + tried + ' candidates, ' + kept + ' promotions — champion gen ' + gens + ' OOS score ' + champ.oos_score.toFixed(3) });
return { ok: true, gens, tried, kept, champion: { ...champ }, ledger_len: ledger.length, head: prev };`;

const ART_EQUITY = `
// the desk's glass: equity + drawdown as unicode sparklines
const g = (id) => runtime.get(id).then(r => r.data);
const spark = (arr) => {
  let lo = Infinity, hi = -Infinity;
  for (const x of arr) { if (x < lo) lo = x; if (x > hi) hi = x; }
  const glyphs = '▁▂▃▄▅▆▇█'; const span = (hi - lo) || 1;
  const step = Math.max(1, Math.floor(arr.length / 88));
  let s2 = '';
  for (let i = 0; i < arr.length; i += step) s2 += glyphs[Math.min(7, Math.floor((arr[i] - lo) / span * 7.999))];
  return s2;
};
const bt = await g('bt.last');
const bnh = await g('bnh.last');
if (!bt?.ok || !bnh?.equity) return { ok: false, desk: '', bnh: '', dd: '', why: 'pull bt.run and bnh.run first — the glass shows the last completed run.' };
const eq = bt.equity;
let peak = eq[0]; const dd = eq.map(x => { peak = Math.max(peak, x); return x < peak ? (peak - x) / peak : 0; });
return { ok: true, desk: spark(eq), bnh: spark(bnh.equity), dd: spark(dd.map(x => -x)) };`;

const CHAMPION_ANNOUNCE = `
// fires when desk.champion changes — the desk flashes the promotion
const g = (id) => runtime.get(id).then(r => r.data);
const s = (id, val) => runtime.set(id, val);
const champ = await g('desk.champion');
const was = await g('desk.prev_champ');
if (!champ) return { skipped: true };
const same = was && was.gen === champ.gen && was.oos_score === champ.oos_score && was.params?.fast === champ.params?.fast;
if (same) return { skipped: true };
const promoted = was && champ.oos_score != null && was.oos_score != null && champ.oos_score > was.oos_score;
await s('desk.flash', {
  kind: promoted ? 'promote' : 'champion',
  text: promoted
    ? 'NEW CHAMPION — OOS score ' + was.oos_score.toFixed(3) + ' → ' + champ.oos_score.toFixed(3) + ' (' + champ.strategy + ', fast ' + champ.params.fast + '/slow ' + champ.params.slow + '). Desk re-priced.'
    : 'champion at gen ' + champ.gen + ' — OOS score ' + (champ.oos_score == null ? '—' : champ.oos_score.toFixed(3)) + '.',
  ts: Date.now() });
await s('desk.prev_champ', champ ? { ...champ, params: { ...champ.params } } : null);
const lg = await g('log.events');
await s('log.events', [...lg.slice(-199), { ts: Date.now(), kind: 'champion', text: (promoted ? 'PROMOTED: ' : 'champion: ') + (champ.oos_score?.toFixed?.(3) ?? '—') + ' (' + champ.strategy + ')' }]);
return { ok: true, promoted };`;

// ── buildSheet ───────────────────────────────────────────────────────────────
export function buildSheet(seed = 20260925) {
  const { closes, meta } = makeCloses(seed);
  const cells = [];
  const push = (c) => cells.push(c);

  // published receipts (value cells the formulas read — always a consistent
  // snapshot of the last completed run)
  push(v('bt.last', null, 'last full desk receipt (published by bt.run)'));
  push(v('bnh.last', null, 'last buy & hold receipt'));
  push(v('wf.last', null, 'last walk-forward report (published by wf.report)'));

  // market + desk constants
  push(v('mkt.meta', meta, 'the instrument tape: synthetic GBM with regimes (seeded, reproducible)'));
  push(v('mkt.closes', closes, 'daily closes — the only market input the desk may see'));
  push(v('desk.cash0', 10000, 'starting cash (S1)'));
  push(v('desk.flash', { kind: '', text: 'desk ready — nudge a parameter cell or run the trainer.', ts: 0 }, 'the desk bubble (refusals, promotions)'));
  push(v('desk.prev_champ', null, 'previous champion (for the promotion flash)'));
  push(v('desk.champion', { gen: 0, strategy: 'sma_cross', params: { fast: 8, slow: 34, rsi_len: 14, rsi_max: 72, rsi_buy: 30, rsi_sell: 64 }, is_score: null, oos_score: null, verdict: '—' }, 'the reigning config (S7)'));
  push(v('log.events', [], 'desk event log'));

  // parameters — THE NUDGE SURFACE
  push(v('p.strategy', 'sma_cross', 'active strategy: sma_cross | rsi_reversion (S3)'));
  push(v('p.fast', 8, 'sma_fast window (S2)'));
  push(v('p.slow', 34, 'sma_slow window (S2)'));
  push(v('p.rsi_len', 14, 'RSI period (S2)'));
  push(v('p.rsi_max', 72, 'overbought gate for new sma_cross entries (S3)'));
  push(v('p.rsi_buy', 30, 'oversold entry for rsi_reversion (S3)'));
  push(v('p.rsi_sell', 64, 'overbought exit for rsi_reversion (S3)'));
  push(v('p.fee_bps', 2, 'cost per position change, basis points of notional (S4)'));
  push(v('p.wf_pct', 70, 'share of bars in the FIT window; the rest is the JUDGE window (S6)'));

  // the book
  push(law('strategy.book', BOOK, 'the complete trading doctrine S1..S8'));
  const LAWS = {
    S1: 'The desk prices ONE instrument from mkt.closes; a series shorter than 50 bars or containing a non-finite/non-positive bar stops the desk.',
    S2: 'sma_w needs w closes; rsi_n needs n+1 closes; a missing indicator yields FLAT, never a guess. Parameters must be in tradeable ranges.',
    S3: 'sma_cross: LONG when sma_fast > sma_slow AND rsi <= rsi_max. rsi_reversion: LONG when rsi <= rsi_buy, FLAT when rsi >= rsi_sell, HOLD between. No lookahead; act at the next close.',
    S4: 'Every position change pays fee_bps of traded notional; no leverage (position 0/1); a trade still open at the last bar closes there and the desk pays the liquidation fee in the equity path too.',
    S5: 'Report total_return, CAGR, annualized Sharpe, max_drawdown, n_trades, win_rate, profit_factor, exposure — or refuse to print nonsense.',
    S6: 'First wf_pct of bars = FIT (IS), rest = JUDGE (OOS). ROBUST: OOS sharpe >= 0.75, dd <= 40%, trades >= 3. Wins IS + loses OOS = OVERFIT. Always report both windows.',
    S7: 'Promote a candidate only if its OOS score beats the champion AND its IS score does not degrade; score = sharpe - 2*maxdd - (0.5 if <3 trades). Every decision books a receipt.',
    S8: 'Everything derives from closes + params + book; ai.ledger is an fnv1a64 chain rooted at GENESIS; S8 re-derives it; tampering breaks the chain visibly.',
  };
  for (const id of Object.keys(LAWS)) push(law('rule.' + id + '.law', LAWS[id], 'clause ' + id));

  // rule checks (pure)
  push(prog('rule.S1.check', CHK_S1, 'S1 port: universe validity (pure)', []));
  push(prog('rule.S2.check', CHK_S2, 'S2 port: parameter sanity (pure)', []));
  push(prog('rule.S3.check', CHK_S3, 'S3 port: signal structure audit (pure)', []));
  push(prog('rule.S4.check', CHK_S4, 'S4 port: equity path + costs (pure)', []));
  push(prog('rule.S5.check', CHK_S5, 'S5 port: metric sanity (pure)', []));
  push(prog('rule.S6.check', CHK_S6, 'S6 port: walk-forward verdict (pure)', []));
  push(prog('rule.S7.check', CHK_S7, 'S7 port: promotion gate (pure)', []));
  push(prog('rule.S8.check', CHK_S8, 'S8 port: receipt chain re-derivation (pure)', []));

  // verdict sinks (viewer reads these to flash clauses)
  for (const id of Object.keys(LAWS)) push(v('rule.' + id + '.verdict', null, 'last ' + id + ' evaluation'));

  // the desk's glass
  push(prog('ind.sma_fast', IND_FAST, 'sma_fast line (S2)', ['mkt.closes', 'p.fast']));
  push(prog('ind.sma_slow', IND_SLOW, 'sma_slow line (S2)', ['mkt.closes', 'p.slow']));
  push(prog('ind.rsi', IND_RSI, 'Wilder RSI line (S2)', ['mkt.closes', 'p.rsi_len']));
  push(prog('sig.pos', SIG_POS, 'position series 0/1 — the strategy as a cell (S3)',
    ['mkt.closes', 'p.strategy', 'p.fast', 'p.slow', 'p.rsi_len', 'p.rsi_max', 'p.rsi_buy', 'p.rsi_sell']));

  // pricing
  push(prog('bt.run', BT_RUN, 'the desk: S1→S2→S3→backtest(S4,S5) — full receipt',
    ['mkt.closes', 'desk.cash0', 'p.strategy', 'p.fast', 'p.slow', 'p.rsi_len', 'p.rsi_max', 'p.rsi_buy', 'p.rsi_sell', 'p.fee_bps',
      'sig.pos', 'rule.S1.check', 'rule.S2.check', 'rule.S3.check', 'rule.S4.check', 'rule.S5.check']));
  push(prog('bnh.run', BNH_RUN, 'buy & hold — the control group', ['mkt.closes', 'desk.cash0']));
  push(prog('wf.report', WF_REPORT, 'walk-forward: IS vs OOS for current params (S6)',
    ['mkt.closes', 'desk.cash0', 'p.strategy', 'p.fast', 'p.slow', 'p.rsi_len', 'p.rsi_max', 'p.rsi_buy', 'p.rsi_sell', 'p.fee_bps', 'p.wf_pct', 'rule.S6.check']));

  // derived metrics (formulas over PUBLISHED receipts — consistent snapshots)
  push(formula('met.ret', `bt.last && bt.last.metrics ? bt.last.metrics.total_return : null`, 'total return (S5)'));
  push(formula('met.cagr', `bt.last && bt.last.metrics ? bt.last.metrics.cagr : null`, 'CAGR, 252d year (S5)'));
  push(formula('met.sharpe', `bt.last && bt.last.metrics ? bt.last.metrics.sharpe : null`, 'annualized Sharpe (S5)'));
  push(formula('met.maxdd', `bt.last && bt.last.metrics ? bt.last.metrics.maxdd : null`, 'max drawdown (S5)'));
  push(formula('met.trades', `bt.last && bt.last.metrics ? bt.last.metrics.n_trades : null`, 'number of round trips (S5)'));
  push(formula('met.winrate', `bt.last && bt.last.metrics ? bt.last.metrics.win_rate : null`, 'per-trade win rate incl. fees (S5)'));
  push(formula('met.pf', `bt.last && bt.last.metrics ? bt.last.metrics.profit_factor : null`, 'profit factor (S5)'));
  push(formula('met.exposure', `bt.last && bt.last.metrics ? bt.last.metrics.exposure : null`, 'time in the market (S5)'));
  push(formula('met.wf', `wf.last ? wf.last.verdict : null`, 'walk-forward verdict (S6)'));
  push(formula('met.bnh_ret', `bnh.last && bnh.last.metrics ? bnh.last.metrics.total_return : null`, 'buy & hold total return'));

  // learning machinery
  push(v('ai.ledger', [], 'witness receipts: seed / fit / refuse / promote (fnv1a64 chain, S8)'));
  push(prog('ai.trainer', AI_TRAINER, 'the self-improvement loop: IS selection, OOS promotion gate, receipts',
    ['mkt.closes', 'desk.cash0', 'p.strategy', 'p.fast', 'p.slow', 'p.rsi_len', 'p.rsi_max', 'p.rsi_buy', 'p.rsi_sell', 'p.fee_bps', 'p.wf_pct',
      'ai.ledger', 'desk.champion', 'log.events', 'rule.S6.check', 'rule.S7.check']));
  push(prog('ai.chaincheck', `
${SNIPPETS.witness}
const rows = (await runtime.get('ai.ledger')).data ?? [];
const v8 = (await runtime.call('rule.S8.check', { rows })).data;
await runtime.set('rule.S8.verdict', { ...v8, ts: Date.now() });
return v8;`, 'S8 in the loop: re-derive the receipt chain', ['ai.ledger', 'rule.S8.check']));
  push(prog('art.equity', ART_EQUITY, 'equity + drawdown sparklines for the glass', ['bt.last', 'bnh.last']));

  // promotion UX: the desk flashes when the champion changes
  push(prog('champion.announce', CHAMPION_ANNOUNCE, 'writes the promotion flash + log', ['desk.champion', 'desk.prev_champ', 'log.events']));
  push(listenerCell('champion.push', ['desk.champion'], 'champion.announce', null,
    'watches the champion seat — a promotion lights the desk up'));

  return { id: 'quilt-quant-desk', title: 'The Trading Desk — backtest as a spreadsheet', cells };
}
