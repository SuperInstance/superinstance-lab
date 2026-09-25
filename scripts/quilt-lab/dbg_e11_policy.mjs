// dbg — why does the baseline policy never fire?
import { QuiltEngine } from '/home/z/my-project/download/quilt-quant/engine/index.js';
import { buildSheet } from '/home/z/my-project/download/quilt-quant/lab/sheet.mjs';

const refSma = (c, w) => { const out = Array(c.length).fill(null); const pre = [0];
  for (let i = 0; i < c.length; i++) pre.push(pre[i] + c[i]);
  for (let i = w - 1; i < c.length; i++) out[i] = (pre[i + 1] - pre[i + 1 - w]) / w; return out; };
const refRsi = (c, n) => { const out = Array(c.length).fill(null); const d = [];
  for (let i = 1; i < c.length; i++) d.push(c[i] - c[i - 1]);
  let ag = 0, al = 0; for (let i = 0; i < n; i++) { ag += Math.max(d[i], 0); al += Math.max(-d[i], 0); }
  ag /= n; al /= n; out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = n; i < d.length; i++) { ag = (ag * (n - 1) + Math.max(d[i], 0)) / n; al = (al * (n - 1) + Math.max(-d[i], 0)) / n; out[i + 1] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } return out; };
const refMomz = (c, n, zw) => { const mm = Array(c.length).fill(null);
  for (let i = n; i < c.length; i++) mm[i] = c[i] / c[i - n] - 1;
  const out = Array(c.length).fill(null);
  for (let i = n + zw - 1; i < c.length; i++) { const win = mm.slice(i - zw + 1, i + 1);
    const m = win.reduce((a, b) => a + b, 0) / zw;
    const sd = Math.sqrt(win.reduce((a, b) => a + (b - m) ** 2, 0) / zw);
    out[i] = sd > 1e-12 ? (mm[i] - m) / sd : 0; } return out; };
const refPolicy = (i, c, f, s, r, m, w, wave) => {
  if (f[i] == null || s[i] == null || r[i] == null || m[i] == null) return { side: 'FLAT', block: 'none', strength: 0, trendVote: 0, cycleVote: 0 };
  const gap = f[i] / s[i] - 1;
  const tUp = gap > w.trend_gap && m[i] > w.mom_min;
  const tDn = gap < -w.trend_gap && m[i] < -w.mom_min;
  const trendDir = tUp ? 1 : tDn ? -1 : 0;
  const sinGate = 0.30 + w.spec_gate * 0.5;
  const sp = Math.sin(2 * Math.PI * (i + 1) / wave.p_star + wave.phase);
  const cUp = r[i] <= w.rsi_lo && sp < -sinGate;
  const cDn = r[i] >= w.rsi_hi && sp > sinGate;
  const cycleDir = cUp ? 1 : cDn ? -1 : 0;
  if (trendDir !== 0 && cycleDir !== 0 && trendDir !== cycleDir) return { side: trendDir > 0 ? 'LONG' : 'SHORT', block: 'conflict', strength: 0.5, trendVote: 1, cycleVote: 1 };
  if (trendDir !== 0) return { side: trendDir > 0 ? 'LONG' : 'SHORT', block: cycleDir !== 0 ? 'trend+cycle' : 'trend', strength: cycleDir !== 0 ? 1 : 0.5, trendVote: 1, cycleVote: cycleDir !== 0 ? 1 : 0 };
  if (cycleDir !== 0) return { side: cycleDir > 0 ? 'LONG' : 'SHORT', block: 'cycle', strength: 0.5, trendVote: 0, cycleVote: 1 };
  return { side: 'FLAT', block: 'none', strength: 0, trendVote: 0, cycleVote: 0 };
};

const e = new QuiltEngine('dbg', { eager: true });
e.loadSheet(buildSheet());
const call = async (id, input) => (await e.call(id, input)).data;
const c = (await e.get('mkt.ohlcv')).data.c;
const spec = await call('wave.spectrum');
const f = refSma(c, 10), s2 = refSma(c, 30), r = refRsi(c, 14), m = refMomz(c, 20, 30);
const w = { mom_min: 0.55, trend_gap: 0.008, rsi_lo: 40, rsi_hi: 60, spec_gate: 0.75 };
const wave = { p_star: spec.p_star, phase: spec.phase, regime: 'CYCLE' };
let trend = 0, cycle = 0, flat = 0, rsimin = 0, spGate = 0, both = 0;
const sinGate = 0.30 + w.spec_gate * 0.5;
let spLowAndRsi = 0, gapBig = 0, momBig = 0, gapBigMomBig = 0;
for (let i = 31; i < c.length; i++) {
  if (r[i] != null && r[i] <= w.rsi_lo) rsimin++;
  const sp = Math.sin(2 * Math.PI * (i + 1) / spec.p_star + spec.phase);
  if (sp < -sinGate) spGate++;
  if (r[i] != null && r[i] <= w.rsi_lo && sp < -sinGate) spLowAndRsi++;
  const gap = f[i] / s2[i] - 1;
  if (gap > w.trend_gap) gapBig++;
  if (m[i] != null && m[i] > w.mom_min) momBig++;
  if (gap > w.trend_gap && m[i] != null && m[i] > w.mom_min) gapBigMomBig++;
  const p = refPolicy(i, c, f, s2, r, m, w, wave);
  if (p.side === 'FLAT') flat++; else if (p.block.includes('trend')) trend++; else cycle++;
  if (p.trendVote && p.cycleVote) both++;
}
console.log({ p_star: spec.p_star, bars: c.length - 31, trend, cycle, flat, both, rsimin, spGate, spLowAndRsi, gapBig, momBig, gapBigMomBig, amp: spec.amp.toFixed(4), phase: spec.phase.toFixed(3), ratio: spec.ratio.toFixed(1), r2: spec.r2.toFixed(3) });
