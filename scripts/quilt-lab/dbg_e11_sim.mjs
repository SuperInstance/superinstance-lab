// dbg2 — replicate sim.run's exact body outside the engine
import { SNIPPETS } from '/home/z/my-project/download/quilt-quant/shared/kit.mjs';
import { SRC_MATH, SRC_WAVE, SRC_POLICY, SRC_GATE_L } from '/home/z/my-project/download/quilt-quant/lab/policy.src.mjs';
import { buildSheet } from '/home/z/my-project/download/quilt-quant/lab/sheet.mjs';

const sheet = buildSheet();
const cells = Object.fromEntries(sheet.cells.map((c) => [c.id, c]));
const valueOf = (id) => (cells[id] && cells[id].value !== undefined ? cells[id].value : undefined);

const body = `
${SNIPPETS.witness}
${SRC_MATH}
${SRC_WAVE}
${SRC_POLICY}
${SRC_GATE_L}
const ohlcv = valueOf('mkt.ohlcv');
const spec = valueOf('wave.spectrum') || { p_star: 41, phase: 0.8, ratio: 7.6 };
const rg = { regime: 'CYCLE' };
const entangle = { edges: [] };
const c = ohlcv.c, h = ohlcv.h, l = ohlcv.l;
const N = c.length;
const w = {};
for (const id of ['w.mom_min', 'w.trend_gap', 'w.rsi_lo', 'w.rsi_hi', 'w.stop_atr', 'w.tp_atr', 'w.size', 'w.spec_gate', 'w.vol_cap']) w[id.slice(2)] = valueOf(id);
const wave = { p_star: spec.p_star, phase: spec.phase, ratio: spec.ratio, regime: rg.regime };
let entConflict = false, entNote = '';
const f = sma(c, 10), s = sma(c, 30), r = rsi(c, 14), a = atr(h, l, c, 14), m = momz(c, 20, 30), vz = volz(h, l, c, 14, 20);
let pos = 0, eq = 1, peak = 1, maxdd = 0, ddNow = 0;
let entry = 0, entryAtr = 0, openBar = -1, entryEq = 1;
const equity = [1], trades = [], changes = [], events = [];
const fee = 0.0006;
let refusals = 0, ddHalts = 0, heldBars = 0, proposals = 0, vetoes = {};
const barRet = [];
for (let i = 31; i < N; i++) {
  if (pos !== 0) {
    const ret = c[i] / c[i - 1] - 1;
    eq *= (1 + pos * ret);
    barRet.push(pos * ret);
    heldBars += 1;
  } else barRet.push(0);
  peak = Math.max(peak, eq);
  ddNow = 1 - eq / peak;
  if (ddNow > maxdd) maxdd = ddNow;
  if (pos !== 0) {
    const dir = Math.sign(pos);
    const stopPx = entry - dir * w.stop_atr * entryAtr;
    const tpPx = entry + dir * w.tp_atr * entryAtr;
    let exit = null;
    if (dir > 0 && c[i] <= stopPx) exit = 'stop';
    if (dir < 0 && c[i] >= stopPx) exit = 'stop';
    if (!exit && dir > 0 && c[i] >= tpPx) exit = 'take-profit';
    if (!exit && dir < 0 && c[i] <= tpPx) exit = 'take-profit';
    if (!exit && i - openBar > 3 * wave.p_star) exit = 'cycle-expiry';
    if (exit) {
      eq *= (1 - fee * Math.abs(pos));
      events.push({ i, from: pos, to: 0, fee: fee * Math.abs(pos) });
      trades.push({ i_in: openBar, i_out: i, side: dir > 0 ? 'LONG' : 'SHORT', pnl: eq / entryEq - 1, reason: exit });
      pos = 0; changes.push(i);
    }
  }
  if (pos === 0) {
    const prop = policyAt(i, c, f, s, r, m, w, wave);
    if (prop.side !== 'FLAT') {
      proposals++;
      const veto = gateLite(i, prop, { ddNow, changes, pos: 0 }, vz, w, wave, { conflict: entConflict, note: entNote });
      if (veto) { refusals += 1; vetoes[veto.split(':')[0]] = (vetoes[veto.split(':')[0]] || 0) + 1; }
      else {
        const dir = prop.side === 'LONG' ? 1 : -1;
        eq *= (1 - fee * w.size);
        events.push({ i, from: 0, to: dir * w.size, fee: fee * w.size });
        pos = dir * w.size; entry = c[i]; entryAtr = a[i]; openBar = i; entryEq = eq;
        changes.push(i);
      }
    }
  }
  equity.push(eq);
}
return { trades: trades.length, proposals, refusals, vetoes, w, wave, ret: +(equity[equity.length - 1] - 1).toFixed(4) };
`;

const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
const fn = new AsyncFunction('valueOf', body);
fn(valueOf).then((r) => console.log(JSON.stringify(r, null, 1).slice(0, 900))).catch((e) => console.log('ERR', e.message));
