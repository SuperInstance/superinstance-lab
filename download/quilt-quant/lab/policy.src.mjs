// E11 — POLICY SOURCES: one source of truth for every piece of math that
// appears inside program cells. Program cells execute in a new-Function scope
// (the E8 lesson): helpers must be INLINE in each cell's code. Rather than
// copy-pasting (and risking divergence between the desk and the world), the
// sheet interpolates these strings at BUILD time — same audited source,
// wired into every cell that needs it. This is "typesafe at the seams".
//
//   SRC_MATH    sma / rsi (Wilder) / atr / zscore / momz / volz / clamp
//   SRC_WAVE    Goertzel spectrum + resonance projection + trend R2
//   SRC_POLICY  policyAt(i,...) — M3: the two-block proposal (per-bar)
//   SRC_GATE_L  gateLite(...) — M5 rails inside the simulation loop
//   SRC_SPARK   unicode sparkline (glass)

export const SRC_MATH = `
// NOTE: program cells are compiled as AsyncFunction('input','caller','runtime',
// clamp','abs','min','max', BODY) — the engine already provides clamp/abs/min/
// max as parameters, so this source must NOT redeclare those names.
const sma = (c, w) => { const o = new Array(c.length).fill(null); let s = 0;
  for (let i = 0; i < c.length; i++) { s += c[i]; if (i >= w) s -= c[i - w]; if (i >= w - 1) o[i] = s / w; } return o; };
const rsi = (c, n) => { const o = new Array(c.length).fill(null); if (c.length < n + 1) return o;
  let ag = 0, al = 0;
  for (let i = 1; i <= n; i++) { const d = c[i] - c[i - 1]; ag += Math.max(d, 0); al += Math.max(-d, 0); }
  ag /= n; al /= n; o[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = n + 1; i < c.length; i++) { const d = c[i] - c[i - 1];
    ag = (ag * (n - 1) + Math.max(d, 0)) / n; al = (al * (n - 1) + Math.max(-d, 0)) / n;
    o[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al); } return o; };
const atr = (h, l, c, n) => { const o = new Array(c.length).fill(null); if (c.length < n + 1) return o;
  const tr = (i) => Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
  let a = 0; for (let i = 1; i <= n; i++) a += tr(i); a /= n; o[n] = a;
  for (let i = n + 1; i < c.length; i++) { a = (a * (n - 1) + tr(i)) / n; o[i] = a; } return o; };
const momz = (c, n, zw) => { const o = new Array(c.length).fill(null);
  for (let i = n + zw - 1; i < c.length; i++) {
    let m = 0; for (let k = 0; k < zw; k++) m += c[i - k] / c[i - k - n] - 1; m /= zw;
    let v = 0; for (let k = 0; k < zw; k++) { const d = c[i - k] / c[i - k - n] - 1; v += (d - m) * (d - m); }
    v = Math.sqrt(v / zw);
    o[i] = v > 1e-12 ? (c[i] / c[i - n] - 1 - m) / v : 0; } return o; };
const volz = (h, l, c, n, zw) => { const a = atr(h, l, c, n); const o = new Array(c.length).fill(null);
  for (let i = n + zw; i < c.length; i++) {
    if (a[i] == null || a[i - 1] == null || a[i - 1] <= 0) continue;
    const d = a[i] / a[i - 1] - 1; const win = [];
    for (let k = 0; k < zw; k++) { if (a[i - k] == null || a[i - k - 1] == null || a[i - k - 1] <= 0) { win.length = 0; break; } win.push(a[i - k] / a[i - k - 1] - 1); }
    if (win.length < zw) continue;
    let m = 0; for (const x of win) m += x; m /= zw;
    let v = 0; for (const x of win) v += (x - m) * (x - m); v = Math.sqrt(v / zw);
    o[i] = v > 1e-12 ? (d - m) / v : 0; } return o; };
`;

export const SRC_WAVE = `
// M2 — read the tape as a waveform: Goertzel power at periods 8..64 over the
// return series, top peaks, resonance projection at the dominant period,
// and trend strength (R2 of the log-price regression).
const readWave = (c) => {
  const N = c.length; const r = [];
  for (let t = 1; t < N; t++) r.push(c[t] / c[t - 1] - 1);
  let mean = 0; for (const x of r) mean += x; mean /= r.length;
  const P = [];
  for (let p = 8; p <= 64; p++) {
    let re = 0, im = 0;
    for (let t = 0; t < r.length; t++) {
      const ang = 2 * Math.PI * (t + 1) / p;
      re += (r[t] - mean) * Math.cos(ang); im -= (r[t] - mean) * Math.sin(ang);
    }
    P.push({ p, power: (re * re + im * im) / r.length });
  }
  const sorted = [...P].sort((a, b) => b.power - a.power);
  // greedy non-adjacent peak picking: neighbors of a peak are its leakage
  const peaks = [];
  for (const cand of sorted) {
    if (peaks.every((q) => Math.abs(q.p - cand.p) > 4)) peaks.push(cand);
    if (peaks.length >= 3) break;
  }
  let mp = 0; for (const x of P) mp += x.power; mp /= P.length;
  const ratio = peaks[0].power / (mp || 1e-12);
  const pStar = peaks[0].p;
  // resonance: project detrended returns on sin/cos at P*
  let sa = 0, ca = 0;
  for (let t = 0; t < r.length; t++) {
    const ang = 2 * Math.PI * (t + 1) / pStar;
    sa += (r[t] - mean) * Math.sin(ang); ca += (r[t] - mean) * Math.cos(ang);
  }
  sa *= 2 / r.length; ca *= 2 / r.length;
  const amp = Math.hypot(sa, ca); const phase = Math.atan2(ca, sa);
  // trend strength over the last min(120, N) bars
  const L = Math.min(120, N); const ys = [];
  for (let i = N - L; i < N; i++) ys.push(Math.log(c[i]));
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < L; i++) { sx += i; sy += ys[i]; sxx += i * i; sxy += i * ys[i]; syy += ys[i] * ys[i]; }
  const cov = sxy / L - (sx / L) * (sy / L);
  const vx = sxx / L - (sx / L) * (sx / L);
  const vy = syy / L - (sy / L) * (sy / L);
  const slope = vx > 0 ? cov / vx : 0;
  const r2 = vx > 0 && vy > 0 ? (cov * cov) / (vx * vy) : 0;
  return { p_star: pStar, ratio, amp, phase, slope, r2, peaks };
};
const sinphaseAt = (wave, i) => Math.sin(2 * Math.PI * (i + 1) / wave.p_star + wave.phase);
// price-wave: returns r ~ amp*sin(theta) integrate to price ~ -amp*(p/2pi)*cos(theta).
// Trough of PRICE is at theta ~ 0 (pricewave = -1), crest at theta ~ pi (+1).
const pricewaveAt = (wave, i) => -Math.cos(2 * Math.PI * (i + 1) / wave.p_star + wave.phase);
// spec_gate maps to a strictness threshold on the price wave (0.35 .. 0.9)
const pwGate = (w) => 0.35 + w.spec_gate * 0.55;
`;

export const SRC_POLICY = `
// M3 — the two-block proposal. The TREND block fires on sma-gap x momentum;
// the CYCLE block fires on rsi extremes aligned with the resonance phase of
// the dominant spectral period. Proposals are EDGE-TRIGGERED: a block votes
// only on a FRESH crossing (the vote was absent on the previous bar), never
// as a held state — a signal is an event, not a condition. Dormant weights
// are read at their frozen value (M8 removes them from the SEARCH, never
// from the policy). When the blocks disagree, the proposal is a CONFLICT
// block at strength 0.5 — exactly the case the entanglement read (M5) judges.
const policyAt = (i, c, f, s, r, m, w, wave) => {
  const voteT = (j) => {
    if (f[j] == null || s[j] == null || m[j] == null) return 0;
    const gp = f[j] / s[j] - 1;
    if (gp > w.trend_gap && m[j] > w.mom_min) return 1;
    if (gp < -w.trend_gap && m[j] < -w.mom_min) return -1;
    return 0;
  };
  const voteC = (j) => {
    if (r[j] == null) return 0;
    const tau = pwGate(w);
    const pw = pricewaveAt(wave, j);
    if (r[j] <= w.rsi_lo && pw < -tau) return 1;   // rsi extreme at a PRICE TROUGH
    if (r[j] >= w.rsi_hi && pw > tau) return -1;   // rsi extreme at a PRICE CREST
    return 0;
  };
  if (f[i] == null || s[i] == null || r[i] == null || m[i] == null)
    return { side: 'FLAT', strength: 0, block: 'none', reason: 'indicators warming up', trendVote: 0, cycleVote: 0 };
  const t0 = voteT(i), t1 = voteT(i - 1);
  const c0 = voteC(i), c1 = voteC(i - 1);
  const trendVote = t0 !== 0 && t0 !== t1 ? 1 : 0;
  const cycleVote = c0 !== 0 && c0 !== c1 ? 1 : 0;
  const trendDir = t0, cycleDir = c0;
  let side, block, strength;
  if (trendVote && cycleVote && trendDir !== cycleDir) {
    side = trendDir > 0 ? 'LONG' : 'SHORT'; block = 'conflict'; strength = 0.5;
  } else if (trendVote) {
    side = trendDir > 0 ? 'LONG' : 'SHORT'; block = cycleVote ? 'trend+cycle' : 'trend'; strength = cycleVote ? 1 : 0.5;
  } else if (cycleVote) {
    side = cycleDir > 0 ? 'LONG' : 'SHORT'; block = 'cycle'; strength = 0.5;
  } else {
    return { side: 'FLAT', strength: 0, block: 'none', reason: 'no fresh crossing', trendVote: 0, cycleVote: 0 };
  }
  const gap = f[i] / s[i] - 1;
  const sp = sinphaseAt(wave, i);
  const reason = 'gap ' + (gap * 100).toFixed(2) + '% momz ' + (m[i] == null ? 'n/a' : m[i].toFixed(2))
    + ' | rsi ' + (r[i] == null ? 'n/a' : r[i].toFixed(1)) + ' sinphase ' + sp.toFixed(2) + ' (P*=' + wave.p_star + ')';
  return { side, strength, block, reason, trendVote, cycleVote };
};
`;

export const SRC_GATE_L = `
// M5 rails, per-bar, inside the world. Returns null (allowed) or a veto note.
const gateLite = (i, prop, st, vz, w, wave, ent) => {
  if (prop.side === 'FLAT') return null;
  if (st.ddNow > 0.12) return 'dd-halt: drawdown ' + (st.ddNow * 100).toFixed(1) + '% > 12%';
  if (st.changes.slice(-20).length >= 8) return 'overtrade brake: ' + st.changes.slice(-20).length + ' changes in 20 bars';
  if (vz[i] != null && vz[i] > w.vol_cap) return 'vol stress: volz ' + vz[i].toFixed(2) + ' > cap ' + w.vol_cap.toFixed(2);
  if (prop.block.indexOf('trend') >= 0 && prop.side === 'SHORT'
      && (wave.regime === 'TREND_UP') && prop.strength < 0.8) return 'wave disagrees: short against TREND_UP';
  if (prop.block.indexOf('cycle') >= 0) {
    const tau = pwGate(w);
    const pw = pricewaveAt(wave, i);
    if (prop.side === 'LONG' && pw >= -tau) return 'resonance: no trough at P*=' + wave.p_star;
    if (prop.side === 'SHORT' && pw <= tau) return 'resonance: no crest at P*=' + wave.p_star;
  }
  if (prop.block === 'conflict' && ent && ent.conflict) return 'entangle veto: ' + ent.note;
  if (Math.abs(st.pos + (prop.side === 'LONG' ? w.size : -w.size)) > 1.0001) return 'exposure cap';
  return null;
};
`;

export const SRC_SPARK = `
const spark = (arr, w) => {
  const blocks = '\\u2581\\u2582\\u2583\\u2584\\u2585\\u2586\\u2587\\u2588';
  const width = w || 64; const step = Math.max(1, Math.floor(arr.length / width));
  const out = [];
  for (let i = 0; i < arr.length; i += step) {
    const seg = arr.slice(i, i + step); let m = 0;
    for (const x of seg) m += x; out.push(m / seg.length);
  }
  let lo = Infinity, hi = -Infinity;
  for (const x of out) { if (x < lo) lo = x; if (x > hi) hi = x; }
  const rg = hi - lo || 1;
  return out.map((x) => blocks[Math.min(7, Math.floor(((x - lo) / rg) * 7.999))]).join('');
};
`;
