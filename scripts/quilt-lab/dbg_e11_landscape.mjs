// dbg7 — landscape probe: is there a good basin for the learner to find?
import { buildSheet } from '/home/z/my-project/download/quilt-quant/lab/sheet.mjs';

// local copies (same as play.mjs reference)
const refSma = (c, w) => { const out = Array(c.length).fill(null); const pre = [0];
  for (let i = 0; i < c.length; i++) pre.push(pre[i] + c[i]);
  for (let i = w - 1; i < c.length; i++) out[i] = (pre[i + 1] - pre[i + 1 - w]) / w; return out; };
const refRsi = (c, n) => { const out = Array(c.length).fill(null); const d = [];
  for (let i = 1; i < c.length; i++) d.push(c[i] - c[i - 1]);
  let ag = 0, al = 0; for (let i = 0; i < n; i++) { ag += Math.max(d[i], 0); al += Math.max(-d[i], 0); }
  ag /= n; al /= n; out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = n; i < d.length; i++) { ag = (ag * (n - 1) + Math.max(d[i], 0)) / n; al = (al * (n - 1) + Math.max(-d[i], 0)) / n; out[i + 1] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } return out; };
const refAtr = (h, l, c, n) => { const out = Array(c.length).fill(null);
  const tr = (i) => Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
  const ts = []; for (let i = 1; i < c.length; i++) ts.push(tr(i));
  let a = 0; for (let i = 0; i < n; i++) a += ts[i]; a /= n; out[n] = a;
  for (let i = n; i < ts.length; i++) { a = (a * (n - 1) + ts[i]) / n; out[i + 1] = a; } return out; };
const refMomz = (c, n, zw) => { const mm = Array(c.length).fill(null);
  for (let i = n; i < c.length; i++) mm[i] = c[i] / c[i - n] - 1;
  const out = Array(c.length).fill(null);
  for (let i = n + zw - 1; i < c.length; i++) { const win = mm.slice(i - zw + 1, i + 1);
    const m = win.reduce((a, b) => a + b, 0) / zw;
    const sd = Math.sqrt(win.reduce((a, b) => a + (b - m) ** 2, 0) / zw);
    out[i] = sd > 1e-12 ? (mm[i] - m) / sd : 0; } return out; };
const refVolz = (h, l, c, n, zw) => { const a = refAtr(h, l, c, n); const dd = Array(c.length).fill(null);
  for (let i = 1; i < c.length; i++) if (a[i] != null && a[i - 1] != null && a[i - 1] > 0) dd[i] = a[i] / a[i - 1] - 1;
  const out = Array(c.length).fill(null);
  for (let i = n + zw; i < c.length; i++) { const win = []; let good = true;
    for (let k = 0; k < zw; k++) { if (dd[i - k] == null) { good = false; break; } win.push(dd[i - k]); }
    if (!good) continue; const m = win.reduce((x, y) => x + y, 0) / zw;
    const sd = Math.sqrt(win.reduce((x, y) => x + (y - m) ** 2, 0) / zw);
    out[i] = sd > 1e-12 ? (dd[i] - m) / sd : 0; } return out; };

const sheet = buildSheet();
const ohlcv = sheet.cells.find((c) => c.id === 'mkt.ohlcv').value;
const c = ohlcv.c, h = ohlcv.h, l = ohlcv.l, N = c.length;
const f = refSma(c, 10), s2 = refSma(c, 30), r = refRsi(c, 14), a = refAtr(h, l, c, 14), m = refMomz(c, 20, 30), vz = refVolz(h, l, c, 14, 20);
const FEE = 0.0006;

function sim(w, wave) {
  let cash = 1, frac = 0, entryEq = 1, entry = 0, entryAtr = 0, openBar = -1;
  const equity = [1], trades = [], changes = [], rets = [];
  let peak = 1, maxdd = 0, held = 0;
  const voteT = (j) => { if (f[j] == null || s2[j] == null || m[j] == null) return 0;
    const gp = f[j] / s2[j] - 1;
    return (gp > w.trend_gap && m[j] > w.mom_min) ? 1 : (gp < -w.trend_gap && m[j] < -w.mom_min) ? -1 : 0; };
  const voteC = (j) => { if (r[j] == null) return 0;
    const sg = 0.30 + w.spec_gate * 0.5;
    const sp = Math.sin(2 * Math.PI * (j + 1) / wave.p_star + wave.phase);
    return (r[j] <= w.rsi_lo && sp < -sg) ? 1 : (r[j] >= w.rsi_hi && sp > sg) ? -1 : 0; };
  for (let i = 31; i < N; i++) {
    let eq = cash + frac * c[i];
    rets.push(frac !== 0 ? frac * (c[i] / c[i - 1] - 1) : 0);
    if (frac !== 0) held += 1;
    peak = Math.max(peak, eq);
    const ddNow = 1 - eq / peak;
    if (ddNow > maxdd) maxdd = ddNow;
    if (frac !== 0) {
      const dir = Math.sign(frac);
      const stopPx = entry - dir * w.stop_atr * entryAtr;
      const tpPx = entry + dir * w.tp_atr * entryAtr;
      let reason = null;
      if (dir > 0 ? c[i] <= stopPx : c[i] >= stopPx) reason = 'stop';
      else if (dir > 0 ? c[i] >= tpPx : c[i] <= tpPx) reason = 'take-profit';
      else if (i - openBar > 3 * wave.p_star) reason = 'cycle-expiry';
      if (reason) { const ef = eq * (1 - FEE * Math.abs(frac)); trades.push({ pnl: ef / entryEq - 1 }); eq = ef; frac = 0; changes.push(i); }
    }
    if (frac === 0) {
      const t0 = voteT(i), t1 = voteT(i - 1), c0 = voteC(i), c1 = voteC(i - 1);
      const tN = t0 !== 0 && t0 !== t1, cN = c0 !== 0 && c0 !== c1;
      const side = tN ? (t0 > 0 ? 'LONG' : 'SHORT') : cN ? (c0 > 0 ? 'LONG' : 'SHORT') : null;
      if (side) {
        const veto = (ddNow > 0.12) || (changes.slice(-20).length >= 6) || (vz[i] != null && vz[i] > w.vol_cap) ||
          (cN && !tN ? false : false);
        if (!veto) {
          const dir = side === 'LONG' ? 1 : -1;
          const ef = eq * (1 - FEE * w.size);
          entryEq = ef; frac = dir * w.size; entry = c[i]; entryAtr = a[i]; openBar = i; eq = ef; changes.push(i);
        }
      }
    }
    cash = eq - frac * c[i];
    equity.push(eq);
  }
  const mean = rets.reduce((x, y) => x + y, 0) / rets.length;
  const va = Math.sqrt(rets.reduce((x, y) => x + (y - mean) ** 2, 0) / rets.length);
  const sharpe = va > 1e-12 ? (mean / va) * Math.sqrt(252) : 0;
  const wins = trades.filter((t) => t.pnl > 0).length;
  return {
    ret: +(equity[equity.length - 1] - 1).toFixed(4), sharpe: +sharpe.toFixed(3), dd: +maxdd.toFixed(4),
    trades: trades.length, win: trades.length ? +(wins / trades.length).toFixed(2) : 0,
    score: +(sharpe - 2 * maxdd - (trades.length < 4 ? 0.5 : 0)).toFixed(3),
  };
}

const wave = { p_star: 41, phase: 0.8001, regime: 'CYCLE' };
const configs = {
  'baseline (current sheet)': { mom_min: 0.55, trend_gap: 0.008, rsi_lo: 40, rsi_hi: 60, stop_atr: 1.6, tp_atr: 2.0, size: 0.25, spec_gate: 0.75, vol_cap: 1.6 },
  'looser gate': { mom_min: 0.45, trend_gap: 0.006, rsi_lo: 44, rsi_hi: 56, stop_atr: 2.0, tp_atr: 2.4, size: 0.3, spec_gate: 0.45, vol_cap: 2.2 },
  'resonance-tuned': { mom_min: 0.4, trend_gap: 0.004, rsi_lo: 46, rsi_hi: 54, stop_atr: 2.6, tp_atr: 3.2, size: 0.4, spec_gate: 0.55, vol_cap: 2.5 },
  'tight resonance': { mom_min: 0.35, trend_gap: 0.003, rsi_lo: 48, rsi_hi: 52, stop_atr: 3.0, tp_atr: 3.6, size: 0.45, spec_gate: 0.6, vol_cap: 3.0 },
  'wide-open': { mom_min: 0.3, trend_gap: 0.002, rsi_lo: 50, rsi_hi: 50, stop_atr: 3.5, tp_atr: 4.0, size: 0.5, spec_gate: 0.2, vol_cap: 4.0 },
  'no-cycle (trend only)': { mom_min: 0.5, trend_gap: 0.01, rsi_lo: 10, rsi_hi: 90, stop_atr: 2.0, tp_atr: 3.0, size: 0.3, spec_gate: 0.5, vol_cap: 2.0 },
};
for (const [name, w] of Object.entries(configs)) console.log(name.padEnd(24), JSON.stringify(sim(w, wave)));
