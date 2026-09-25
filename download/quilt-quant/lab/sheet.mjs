// E11 — THE SIM-FIRST AGENT LAB.
//
// Not a desk with a trainer bolted on — a closed-loop agent where the
// SIMULATION IS THE ARCHITECTURE. Perception → belief → proposal →
// SIMULATION → confirmation → action → learning → PRUNING → receipt.
// Nothing acts without passing the world (M4); nothing is confirmed without
// the rails (M5); nothing stays in the search space that never mattered (M8).
//
//   mind.book         the agent's doctrine in precise numbered clauses (M1..M8)
//   rule.Mn.law/.check  1:1 ports — every clause is a pure, probe-able cell
//   mkt.ohlcv         the tape (the ONLY input, M1)
//   wave.*            numbers as waveform readings: Goertzel spectrum,
//                     resonance phase, regime — discounted by the quantum
//                     waveform channel quality (moth.wave drift)
//   w.*               the agent's BELIEFS as visible value cells (10 knobs)
//   w.state           participation memory: tries / wins / maxΔ per weight,
//                     dormant set, champion — "less need for weights not
//                     involved over time" lives here
//   sig.proposal      M3: the mind proposes (two blocks: trend, cycle;
//                     conflict block where they disagree)
//   sim.run           M4: the world — full backtest of the CURRENT beliefs;
//                     publishes sim.last receipt (formulas read the receipt)
//   sig.confirm       M5: signal as confirmation — dd-halt, overtrade brake,
//                     vol stress, resonance agreement, ENTANGLEMENT VETO
//                     (quantum ZZ correlation between conflicting features)
//   met.*             the analytics as formulas over the published receipt
//   learn.step        M7+M8: moth-entropy multi-scale perturbation, accept
//                     only on score improvement, participation ledger,
//                     dormancy — every step a witness receipt
//   moth.*            true quantum entropy + waveform + graph-state reads,
//                     journaled in-sheet (every API call receipted)
//   ai.digest/ai.analyst  the LLM analyst reads the DISTRIBUTED state through
//                     a letter-coded fence (A–E) — patch-8 carries options
//
// The value is not in one trade. It is that every belief, every perception,
// every veto and every receipt is a CELL — understanding is distributed
// across the graph, and the graph gets simpler over time.

import { v, law, prog, formula, listenerCell, SNIPPETS, mulberry32 } from '../shared/kit.mjs';
import { SRC_MATH, SRC_WAVE, SRC_POLICY, SRC_GATE_L, SRC_SPARK } from './policy.src.mjs';

// ── doctrine book ────────────────────────────────────────────────────────────
const BOOK = `SIM-FIRST AGENT — DOCTRINE v1 (one tape, closed loop)

M1 (sense)     The agent reads ONE tape: mkt.ohlcv (daily closes/highs/lows,
               240 bars). A tape shorter than 60 bars, or containing a bar
               that is not a finite positive number, cannot be traded: M1
               halts the agent and nothing downstream may act.

M2 (waveform)  Before any belief, the tape is read AS A WAVEFORM: Goertzel
               power at periods 8..64 over the returns, the dominant period
               P*, the resonance phase at P*, and trend strength (R2 of the
               log-price regression). Regime = TREND if R2 >= 0.5, else
               CYCLE if the spectral peak ratio >= 0.22, else CHOP.
               Confidence is discounted by the quantum waveform channel
               quality (moth.wave drift — the measured noise of the same
               returns encoded as qubit angles and read back).

M3 (propose)   Proposals come only from belief cells (w.*) and perception, and
               are EDGE-TRIGGERED: a block votes only on a fresh crossing
               (absent on the previous bar) — a signal is an event, not a
               held state. TREND block: sma-gap beyond w.trend_gap AND
               momentum-z beyond w.mom_min. CYCLE block: rsi beyond
               w.rsi_lo/w.rsi_hi AND the PRICE WAVE of the dominant period
               inside the gate w.spec_gate opens (trough for longs, crest
               for shorts — the integrated return-wave, not its slope). When the blocks disagree, the proposal is
               a CONFLICT block at strength 0.5 — exactly the case the
               entanglement read (M5) judges. Every proposal carries its
               reason.

M4 (simulate)  NO proposal becomes an action without passing the world.
               sim.run replays the CURRENT beliefs across the whole tape —
               entries at close, stops/targets at close, 6bps fee on every
               position change, no leverage, no lookahead (bar i sees only
               bars <= i). The world publishes a receipt (sim.last); the
               analytics read the receipt; the receipt carries a hash.

M5 (confirm)   Signal as confirmation, not as trigger. The gate refuses a
               proposal when: open drawdown > 12% (dd-halt); more than 7
               position changes in the last 20 bars (overtrade brake); vol-z
               beyond w.vol_cap; a CYCLE entry without the resonance phase
               behind it; a trend SHORT against TREND_UP at strength < 0.8;
               or an ENTANGLEMENT VETO — when the quantum graph read reports
               |ZZ| >= 0.82 between momentum and mean-reversion features, a
               CONFLICT proposal is refused: the two signals are locked, not
               independent. Every verdict lists its checks.

M6 (act)       Only confirmed signals move the position, at the next close.
               Every position change pays fee 6bps of notional. |pos| <= 1.
               Exits: stop at w.stop_atr x ATR, target at w.tp_atr x ATR,
               cycle-expiry after 3 x P* bars.

M7 (learn)     After each round, the learning loop perturbs two weights of
               the active set using TRUE QUANTUM ENTROPY (moth.pool — qpixl
               measurement shot noise, journaled), re-runs the world, and
               accepts only if the score strictly improves
               (score = sharpe - 2 x maxdd - 0.5 x [trades < 4]).
               Refusals are receipts, not losses.

M8 (prune)     A weight that, across 7+ tries, never moves the score by at
               least 0.02 is DORMANT: frozen at its value, removed from the
               search. The policy still reads it; the agent stops CARRYING
               it. The decision process gets simpler over time. Pruning is
               receipted; the meta-knob w.step_scale is exempt.`;

// ── deterministic market (hidden truth: cycles at 41 & 13 bars) ─────────────
function buildMarket(N = 240, seed = 20260925) {
  const rnd = mulberry32(seed);
  const gauss = () => {
    let u = 0, v2 = 0;
    while (u === 0) u = rnd();
    while (v2 === 0) v2 = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v2);
  };
  const c = [], h = [], l = [], vv = [];
  let logp = 0;
  for (let t = 0; t < N; t++) {
    const drift = t < 80 ? 0.0011 : t < 140 ? -0.0016 : t < 190 ? 0.0 : 0.0009;
    const r = drift + 0.013 * Math.sin(2 * Math.PI * t / 41 + 0.9)
      + 0.007 * Math.sin(2 * Math.PI * t / 13 + 2.2) + gauss() * 0.008;
    logp += r;
    const px = 100 * Math.exp(logp);
    c.push(px);
    h.push(px * (1 + Math.abs(gauss()) * 0.005 + 0.0015));
    l.push(px * (1 - Math.abs(gauss()) * 0.005 - 0.0015));
    vv.push(Math.round(1e6 * (1 + 40 * Math.abs(r))));
  }
  return { c, h, l, v: vv };
}

// ── rule.Mn.check code strings (pure ports) ─────────────────────────────────
const CHK_M1 = `
{
  const c = input.c || [];
  if (c.length < 60) return { ok: false, halt: true, reason: 'tape shorter than 60 bars: ' + c.length };
  for (let i = 0; i < c.length; i++) {
    if (!Number.isFinite(c[i]) || c[i] <= 0) return { ok: false, halt: true, reason: 'bar ' + i + ' not finite positive' };
  }
  return { ok: true, halt: false, bars: c.length };
}`;

const CHK_M2 = `
{
  const w = input.wave || {};
  const okP = Number.isFinite(w.p_star) && w.p_star >= 8 && w.p_star <= 64;
  const okR = Number.isFinite(w.ratio) && w.ratio >= 0;
  const okC = w.regime === 'TREND_UP' || w.regime === 'TREND_DOWN' || w.regime === 'CYCLE' || w.regime === 'CHOP';
  const okF = w.conf == null || (Number.isFinite(w.conf) && w.conf >= 0 && w.conf <= 1);
  return { ok: okP && okR && okC && okF, reason: !okP ? 'p_star out of band' : !okR ? 'ratio invalid' : !okC ? 'regime not in enum' : !okF ? 'confidence out of [0,1]' : 'waveform read valid' };
}`;

const CHK_M3 = `
{
  const p = input.proposal || {};
  const okS = p.side === 'LONG' || p.side === 'SHORT' || p.side === 'FLAT';
  const okB = ['trend', 'cycle', 'trend+cycle', 'conflict', 'none'].indexOf(p.block) >= 0;
  const okSt = Number.isFinite(p.strength) && p.strength >= 0 && p.strength <= 1;
  const okR = typeof p.reason === 'string' && p.reason.length > 0;
  return { ok: okS && okB && okSt && okR, reason: !okS ? 'side not in enum' : !okB ? 'block not in enum' : !okSt ? 'strength out of [0,1]' : !okR ? 'a proposal must carry its reason (M3)' : 'proposal valid' };
}`;

const CHK_M4 = SNIPPETS.witness + `
{
  const rc = input.receipt || {};
  if (rc.halt) return { ok: false, reason: 'world halted: ' + (rc.reason || '?') };
  const eq = rc.equity || [];
  const mt = rc.metrics || {};
  if (!eq.length || eq.length !== (rc.n_bars || eq.length)) return { ok: false, reason: 'equity length mismatch' };
  if (!(mt.maxdd >= 0 && mt.maxdd <= 1)) return { ok: false, reason: 'maxdd out of [0,1]' };
  const expect = fnv1a64(canon({ n: rc.n_bars, ret: rc.ret_seal, sharpe: rc.sharpe_seal, dd: rc.dd_seal, k: (rc.trades || []).length }));
  if (expect !== rc.published_hash) return { ok: false, reason: 'published hash does not re-derive (M4 integrity)' };
  return { ok: true, reason: 'receipt intact', n_trades: mt.n_trades, sharpe: mt.sharpe, maxdd: mt.maxdd };
}`;

const CHK_M5 = SNIPPETS.witness + `
{
  const p = input.proposal || {};
  const sim = input.sim || {};
  const ent = input.entangle || {};
  const spec = input.spectrum || {};
  const rg = input.regime || {};
  const w = input.weights || {};
  const checks = [];
  const add = (name, pass, note) => checks.push({ name, pass: !!pass, note: note || '' });
  const mt = sim.metrics || {};
  const isEntry = p.side && p.side !== 'FLAT';
  // M4 integrity first
  const m4 = { ok: true };
  if (sim.published_hash) {
    const expect = fnv1a64(canon({ n: sim.n_bars, ret: sim.ret_seal, sharpe: sim.sharpe_seal, dd: sim.dd_seal, k: (sim.trades || []).length }));
    m4.ok = expect === sim.published_hash;
  }
  add('m4_receipt', m4.ok, m4.ok ? 'published hash re-derives' : 'world receipt failed integrity');
  let veto = m4.ok ? null : 'world receipt failed integrity';
  if (isEntry) {
    const ddOk = (mt.dd_now == null ? 0 : mt.dd_now) <= 0.12;
    add('dd_halt', ddOk, ddOk ? 'open dd ' + ((mt.dd_now || 0) * 100).toFixed(1) + '%' : 'dd-halt: ' + ((mt.dd_now || 0) * 100).toFixed(1) + '% > 12%');
    if (!ddOk) veto = veto || 'dd-halt: open drawdown above 12%';
    const otOk = (mt.recent_changes == null ? 0 : mt.recent_changes) < 8;
    add('overtrade_brake', otOk, otOk ? 'changes(20b)=' + (mt.recent_changes || 0) : 'overtrade brake: ' + (mt.recent_changes || 0) + ' in 20 bars');
    if (!otOk) veto = veto || 'overtrade brake';
    const vz = mt.volz_last == null ? 0 : mt.volz_last;
    const volOk = vz <= w.vol_cap;
    add('vol_stress', volOk, 'volz ' + vz.toFixed(2) + ' <= cap ' + w.vol_cap);
    if (!volOk) veto = veto || 'vol stress: volz ' + vz.toFixed(2) + ' > cap';
    const expOk = Math.abs((mt.pos_now || 0) + (p.side === 'LONG' ? w.size : -w.size)) <= 1.0001;
    add('exposure_cap', expOk, '|pos| <= 1');
    if (!expOk) veto = veto || 'exposure cap';
    if (p.block === 'conflict' || p.block.indexOf('trend') >= 0) {
      const waveOk = !(p.block.indexOf('trend') >= 0 && p.side === 'SHORT' && rg.regime === 'TREND_UP' && p.strength < 0.8);
      add('wave_agreement', waveOk, 'regime ' + rg.regime);
      if (!waveOk) veto = veto || 'wave disagrees: short against TREND_UP';
    }
    if (p.block === 'cycle' || p.block === 'trend+cycle') {
      const tau = 0.35 + w.spec_gate * 0.55;
      const pw = -Math.cos(2 * Math.PI * (spec.n_bars) / spec.p_star + spec.phase);
      const resOk = p.side === 'LONG' ? pw < -tau : pw > tau;
      add('resonance', resOk, 'pricewave ' + pw.toFixed(2) + ' at P*=' + spec.p_star);
      if (!resOk) veto = veto || 'resonance: phase not behind the entry';
    }
    let entConflict = null;
    for (const e of (ent.edges || [])) {
      if (e.a === 'mom' && e.b === 'rev' && Math.abs(e.zz) >= 0.82) entConflict = 'ZZ(mom,rev)=' + e.zz.toFixed(2);
    }
    if (p.block === 'conflict') {
      add('entangle_veto', !entConflict, entConflict || ('ZZ(mom,rev)=' + ((ent.edges || []).find((e) => e.a === 'mom' && e.b === 'rev') || { zz: 0 }).zz.toFixed(2) + ' below 0.82'));
      if (entConflict) veto = veto || 'entangle veto: momentum and reversion are locked (' + entConflict + '), conflict is structural';
    } else add('entangle_veto', true, 'not a conflict proposal');
  } else {
    add('no_entry_no_rails', true, 'FLAT proposal — rails not engaged');
  }
  return { confirmed: !veto, checks, veto_reason: veto, lamp: veto ? '✗ VETO ' + veto : '✓ CONFIRMED ' + p.side + ' [' + p.block + ']' };
}`;

const CHK_M6 = `
{
  const evs = input.events || [];
  for (const e of evs) {
    if (Math.abs(e.to) > 1.0001) return { ok: false, reason: 'M6 violated at bar ' + e.i + ': |pos| > 1 (no leverage)' };
    if (!(e.fee >= 0)) return { ok: false, reason: 'M6 violated at bar ' + e.i + ': fee missing' };
  }
  return { ok: true, changes: evs.length, reason: 'every change paid its fee, no leverage' };
}`;

const CHK_M7 = `
{
  const score = input.score, best = input.best;
  if (best == null) return { accept: true, reason: 'no incumbent — first champion' };
  return { accept: score > best + 1e-9, reason: score > best + 1e-9 ? 'strictly better: ' + score.toFixed(4) + ' > ' + best.toFixed(4) : 'not better: ' + score.toFixed(4) + ' <= ' + best.toFixed(4) };
}`;

const CHK_M8 = `
{
  const p = input.part || { tries: 0, wins: 0, maxd: 0 };
  if (input.meta) return { dormant: false, sens: p.maxd || 0, reason: 'meta-knob exempt from pruning' };
  const dormant = p.tries >= 7 && (p.maxd || 0) < 0.02;
  return { dormant, sens: p.maxd || 0, reason: dormant ? 'tries ' + p.tries + ', max score delta ' + (p.maxd || 0).toFixed(4) + ' < 0.02 — the agent stops carrying it' : 'still participating (tries ' + p.tries + ', maxd ' + (p.maxd || 0).toFixed(4) + ')' };
}`;

export function buildSheet() {
  const cells = [];
  const push = (x) => cells.push(x);
  const mkt = buildMarket();

  // ── doctrine ──
  push(v('mind.book', BOOK, 'the agent doctrine: simulate first, confirm, learn, prune'));
  const LAWS = [
    ['M1', 'sense', 'one tape, finite positive closes, >= 60 bars or halt', 'port: rule.M1.check + sim.run'],
    ['M2', 'waveform', 'spectrum + resonance + regime before any belief; confidence discounted by the quantum channel drift', 'port: rule.M2.check + wave.*'],
    ['M3', 'propose', 'beliefs + perception only; trend, cycle, or conflict block; every proposal carries its reason', 'port: rule.M3.check + sig.proposal'],
    ['M4', 'simulate', 'no action without the world; receipt published with hash; no lookahead; fees on changes', 'port: rule.M4.check + sim.run'],
    ['M5', 'confirm', 'dd-halt 12%, overtrade 8/20, vol cap, resonance agreement, entanglement veto |ZZ| >= 0.82', 'port: rule.M5.check + sig.confirm'],
    ['M6', 'act', 'confirmed signals only, at close, 6bps per change, |pos| <= 1, stops/targets/expiry', 'port: rule.M6.check + sim.run'],
    ['M7', 'learn', 'moth entropy perturbs two active weights; accept only strictly better score; receipt every step', 'port: rule.M7.check + learn.step'],
    ['M8', 'prune', '7+ tries and max score delta < 0.02 -> dormant (frozen, out of search); meta-knob exempt', 'port: rule.M8.check + learn.step'],
  ];
  for (const [n, name, text, port] of LAWS) {
    push(law('rule.' + n + '.law', 'M' + n.slice(1) + ' (' + name + ') ' + text + '  [' + port + ']', 'doctrine clause ' + n));
  }

  // ── M1..M8 machine ports (pure) ──
  push(prog('rule.M1.check', CHK_M1, 'M1 port: tape validity (pure)'));
  push(prog('rule.M2.check', CHK_M2, 'M2 port: waveform read schema (pure)'));
  push(prog('rule.M3.check', CHK_M3, 'M3 port: proposal structure (pure)'));
  push(prog('rule.M4.check', CHK_M4, 'M4 port: world receipt integrity (pure)'));
  push(prog('rule.M5.check', CHK_M5, 'M5 port: the confirmation gate (pure)'));
  push(prog('rule.M6.check', CHK_M6, 'M6 port: execution legality (pure)'));
  push(prog('rule.M7.check', CHK_M7, 'M7 port: accept iff strictly better (pure)'));
  push(prog('rule.M8.check', CHK_M8, 'M8 port: dormancy verdict (pure)'));

  // ── the tape ──
  push(v('mkt.ohlcv', mkt, 'the ONLY input (M1): 240 daily bars, seeded + reproducible'));
  push(v('mkt.truth', { P1: 41, P2: 13, regimes: ['bull 0-79', 'bear 80-139', 'chop 140-189', 'recovery 190-239'] }, 'hidden truth for the demo — policy cells never read this'));

  // ── perception: numbers as waveform readings ──
  push(prog('wave.spectrum', `
{
  const ohlcv = (await runtime.get('mkt.ohlcv')).data;
  ${SRC_WAVE}
  return readWave(ohlcv.c);
}`, 'M2: Goertzel spectrum 8..64, resonance projection, trend R2'));
  push(prog('wave.regime', `
{
  const spec = (await runtime.get('wave.spectrum')).data;
  const mw = (await runtime.get('moth.wave')).data;
  const drift = mw && mw.drift != null ? mw.drift : 0;
  let regime, conf;
  if (spec.r2 >= 0.5) { regime = spec.slope > 0 ? 'TREND_UP' : 'TREND_DOWN'; conf = spec.r2; }
  else if (spec.ratio >= 0.22) { regime = 'CYCLE'; conf = Math.min(1, spec.ratio / 3); }
  else { regime = 'CHOP'; conf = 0.35; }
  conf = conf * (1 - Math.min(drift * 2.5, 0.35));
  return { regime, conf, drift, p_star: spec.p_star, ratio: spec.ratio, r2: spec.r2, slope: spec.slope };
}`, 'M2: regime + confidence, discounted by the quantum waveform channel'));
  const IND = [
    ['ind.smaf', 'const c = ohlcv.c; return sma(c, 10);', 'fast SMA(10) — the TREND block eye'],
    ['ind.smas', 'const c = ohlcv.c; return sma(c, 30);', 'slow SMA(30) — the TREND block anchor'],
    ['ind.rsi', 'const c = ohlcv.c; return rsi(c, 14);', 'Wilder RSI(14) — the CYCLE block eye'],
    ['ind.atr', 'const o = ohlcv; return atr(o.h, o.l, o.c, 14);', 'ATR(14) — stop/target unit'],
    ['ind.momz', 'const c = ohlcv.c; return momz(c, 20, 30);', 'momentum z-score (20/30) — trend vote'],
    ['ind.volz', 'const o = ohlcv; return volz(o.h, o.l, o.c, 14, 20);', 'vol-stress z (ATR change) — the risk eye'],
  ];
  for (const [id, body, d] of IND) {
    push(prog(id, `
{
  const ohlcv = (await runtime.get('mkt.ohlcv')).data;
  ${SRC_MATH}
  ${body}
}`, d));
  }

  // ── beliefs: visible weight cells ──
  const WEIGHTS = [
    ['w.mom_min', 0.35, 'TREND vote needs |momz| beyond this'],
    ['w.trend_gap', 0.004, 'TREND vote needs sma gap beyond this fraction'],
    ['w.rsi_lo', 38, 'CYCLE long vote: RSI at or below'],
    ['w.rsi_hi', 62, 'CYCLE short vote: RSI at or above'],
    ['w.stop_atr', 1.8, 'stop distance in ATR units'],
    ['w.tp_atr', 2.2, 'target distance in ATR units'],
    ['w.size', 0.35, 'position fraction per entry (<= 1)'],
    ['w.spec_gate', 0.15, 'resonance phase window strictness (0..1)'],
    ['w.step_scale', 1.0, 'meta-knob: exploration step size multiplier'],
    ['w.vol_cap', 2.2, 'refuse entries when vol-z beyond this'],
  ];
  for (const [id, val, d] of WEIGHTS) push(v(id, val, d + ' — belief cell (M3/M5); learning may rewrite (M7), freezing may hide it from search (M8)'));
  push(v('w.state', {
    part: {}, dormant: {}, best_score: null, champion: {}, rounds: 0,
    meta_exempt: ['w.step_scale'],
  }, 'participation memory: tries/wins/maxΔ per weight, dormant set, champion — M8 lives here'));

  // ── the mind proposes ──
  push(prog('sig.proposal', `
{
  const g = (id) => runtime.get(id).then((r) => r.data);
  const ohlcv = await g('mkt.ohlcv');
  ${SRC_MATH}
  ${SRC_WAVE}
  ${SRC_POLICY}
  const c = ohlcv.c;
  const f = sma(c, 10), s = sma(c, 30), r = rsi(c, 14), m = momz(c, 20, 30);
  const spec = await g('wave.spectrum');
  const rg = await g('wave.regime');
  const w = {};
  for (const id of ['w.mom_min', 'w.trend_gap', 'w.rsi_lo', 'w.rsi_hi', 'w.size', 'w.spec_gate']) w[id.slice(2)] = await g(id);
  const wave = { p_star: spec.p_star, phase: spec.phase, regime: rg.regime };
  const i = c.length - 1;
  const prop = policyAt(i, c, f, s, r, m, w, wave);
  const m3 = (await runtime.call('rule.M3.check', { proposal: prop })).data;
  return { ...prop, i, regime: rg.regime, conf: rg.conf, p_star: spec.p_star, m3_ok: m3.ok };
}`, 'M3: the mind proposes — trend / cycle / conflict block, with its reason'));

  // ── the world ──
  push(prog('sim.run', `
{
  const g = (id) => runtime.get(id).then((r) => r.data);
  ${SNIPPETS.witness}
  const ohlcv = await g('mkt.ohlcv');
  const m1 = (await runtime.call('rule.M1.check', { c: ohlcv.c })).data;
  if (!m1.ok) return { halt: true, reason: m1.reason };
  ${SRC_MATH}
  ${SRC_WAVE}
  ${SRC_POLICY}
  ${SRC_GATE_L}
  const c = ohlcv.c, h = ohlcv.h, l = ohlcv.l;
  const N = c.length;
  const w = {};
  for (const id of ['w.mom_min', 'w.trend_gap', 'w.rsi_lo', 'w.rsi_hi', 'w.stop_atr', 'w.tp_atr', 'w.size', 'w.spec_gate', 'w.vol_cap']) w[id.slice(2)] = await g(id);
  const spec = await g('wave.spectrum');
  const rg = await g('wave.regime');
  const entangle = await g('moth.entangle');
  const wave = { p_star: spec.p_star, phase: spec.phase, ratio: spec.ratio, regime: rg.regime };
  let entConflict = false, entNote = '';
  for (const e of (entangle.edges || [])) {
    if (e.a === 'mom' && e.b === 'rev' && Math.abs(e.zz) >= 0.82) { entConflict = true; entNote = 'ZZ(mom,rev)=' + e.zz.toFixed(2); }
  }
  const f = sma(c, 10), s = sma(c, 30), r = rsi(c, 14), a = atr(h, l, c, 14), m = momz(c, 20, 30), vz = volz(h, l, c, 14, 20);
  let pos = 0, eq = 1, peak = 1, maxdd = 0, ddNow = 0;
  let entry = 0, entryAtr = 0, openBar = -1, entryEq = 1;
  const equity = [1], trades = [], changes = [], events = [];
  const fee = 0.0006;
  let refusals = 0, ddHalts = 0, heldBars = 0;
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
        const veto = gateLite(i, prop, { ddNow, changes, pos: 0 }, vz, w, wave, { conflict: entConflict, note: entNote });
        if (veto) {
          refusals += 1;
          if (veto.indexOf('dd-halt') === 0) ddHalts += 1;
        } else {
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
  const m6 = (await runtime.call('rule.M6.check', { events })).data;
  const retTotal = eq - 1;
  let mean = 0; for (const x of barRet) mean += x; mean /= barRet.length;
  let va = 0; for (const x of barRet) va += (x - mean) * (x - mean); va = Math.sqrt(va / barRet.length);
  const sharpe = va > 1e-12 ? (mean / va) * Math.sqrt(252) : 0;
  const wins = trades.filter((t) => t.pnl > 0).length;
  const metrics = {
    total_return: retTotal, sharpe, maxdd,
    win_rate: trades.length ? wins / trades.length : 0,
    n_trades: trades.length, exposure: heldBars / (N - 31),
    dd_now: ddNow, recent_changes: changes.filter((b) => b >= N - 20).length,
    volz_last: vz[N - 1] == null ? 0 : vz[N - 1], pos_now: pos,
    gate_refusals: refusals, dd_halts: ddHalts,
    score: sharpe - 2 * maxdd - (trades.length < 3 ? 0.5 : 0),
  };
  const receipt = {
    halt: false, n_bars: equity.length, equity, trades, metrics,
    params: w, wave: { p_star: wave.p_star, regime: wave.regime },
    m6_ok: m6.ok, m6_note: m6.reason,
    ret_seal: +retTotal.toFixed(6), sharpe_seal: +sharpe.toFixed(6), dd_seal: +maxdd.toFixed(6),
  };
  receipt.published_hash = fnv1a64(canon({ n: receipt.n_bars, ret: receipt.ret_seal, sharpe: receipt.sharpe_seal, dd: receipt.dd_seal, k: receipt.trades.length }));
  await runtime.set('sim.last', receipt);
  return receipt;
}`, 'M4: the world — backtest of the CURRENT beliefs; publishes sim.last'));

  push(v('sim.last', null, 'the world\u2019s published receipt (M4) — metrics formulas read THIS, not the program'));

  // ── the gate confirms ──
  push(prog('sig.confirm', `
{
  const g = (id) => runtime.get(id).then((r) => r.data);
  const proposal = await g('sig.proposal');
  const sim = await g('sim.last');
  const entangle = await g('moth.entangle');
  const spec = await g('wave.spectrum');
  const rg = await g('wave.regime');
  if (!sim || sim.halt) return { confirmed: false, veto_reason: 'world halted or unpublished', checks: [], lamp: '✗ NO WORLD' };
  const weights = {};
  for (const id of ['w.mom_min', 'w.trend_gap', 'w.rsi_lo', 'w.rsi_hi', 'w.stop_atr', 'w.tp_atr', 'w.size', 'w.spec_gate', 'w.vol_cap']) weights[id.slice(2)] = await g(id);
  const verdict = (await runtime.call('rule.M5.check', {
    proposal, sim, entangle, weights,
    spectrum: { p_star: spec.p_star, phase: spec.phase, n_bars: (await g('mkt.ohlcv')).c.length },
    regime: rg,
  })).data;
  return { ...verdict, proposal: { side: proposal.side, block: proposal.block, strength: proposal.strength, reason: proposal.reason }, dd_now: sim.metrics.dd_now };
}`, 'M5: signal as confirmation — every rail, every verdict, in the open'));
  push(v('sig.lamp', '· flat', 'the gate lamp — what the audience watches'));
  push(prog('gate.announce', `
{
  const v2 = (await runtime.get('sig.confirm')).data;
  const lamp = v2 && v2.confirmed
    ? '✓ CONFIRMED ' + v2.proposal.side + ' [' + v2.proposal.block + '] s=' + v2.proposal.strength.toFixed(2)
    : (v2 && v2.veto_reason ? '✗ VETO ' + v2.veto_reason : '· flat');
  await runtime.set('sig.lamp', lamp);
  return { lamp };
}`, 'writes the gate lamp (listener action)', ['sig.confirm']));
  push(listenerCell('lamp.gate', ['sig.confirm'], 'gate.announce', null,
    'watches the gate — a verdict lights the lamp'));

  // ── analytics over the published receipt ──
  push(formula('met.ret', 'sim.last && !sim.last.halt ? sim.last.metrics.total_return : null', 'total return (M4 receipt)'));
  push(formula('met.sharpe', 'sim.last && !sim.last.halt ? sim.last.metrics.sharpe : null', 'annualized Sharpe'));
  push(formula('met.maxdd', 'sim.last && !sim.last.halt ? sim.last.metrics.maxdd : null', 'max drawdown'));
  push(formula('met.win', 'sim.last && !sim.last.halt ? sim.last.metrics.win_rate : null', 'win rate'));
  push(formula('met.trades', 'sim.last && !sim.last.halt ? sim.last.metrics.n_trades : null', 'closed trades'));
  push(formula('met.score', 'sim.last && !sim.last.halt ? sim.last.metrics.sharpe - 2 * sim.last.metrics.maxdd - (sim.last.metrics.n_trades < 3 ? 0.5 : 0) : null', 'the M7 objective: sharpe - 2dd - starvation'));

  // ── moth layer: true quantum entropy + waveform + entanglement reads ──
  push(v('moth.pool', [], 'true quantum entropy floats [0,1) — qpixl measurement shot noise, harvested by the driver'));
  push(v('moth.cursor', 0, 'entropy consumption cursor (learn.step takes 4 per round)'));
  push(v('moth.wave', { sent: [], got: [], drift: 0, job_id: null, mock: true }, 'numbers-as-waveform: the return series encoded as qubit angles, read back — drift discounts M2 confidence'));
  push(v('moth.entangle', { features: {}, edges: [], agreement: null, dominant: null, job_id: null, mock: true }, 'quantum graph-state read: feature qubits + hypothesized ZZ couplings — the M5 entanglement veto reads THIS'));
  push(v('moth.journal', [], 'every moth API call, receipted in-sheet'));

  // ── learning + pruning ──
  push(prog('learn.step', `
{
  const g = (id) => runtime.get(id).then((r) => r.data);
  const s = (id, val) => runtime.set(id, val);
  ${SNIPPETS.witness}
  ${SRC_MATH}
  const W = ['w.mom_min', 'w.trend_gap', 'w.rsi_lo', 'w.rsi_hi', 'w.stop_atr', 'w.tp_atr', 'w.size', 'w.spec_gate', 'w.step_scale', 'w.vol_cap'];
  // ABSOLUTE step spans (scaled by w.step_scale): a bounded 0..1 knob cannot
  // travel on relative nudges — the search moves in absolute units.
  const SPAN = { 'w.mom_min': 0.09, 'w.trend_gap': 0.0025, 'w.rsi_lo': 2.6, 'w.rsi_hi': 2.6, 'w.stop_atr': 0.28, 'w.tp_atr': 0.34, 'w.size': 0.06, 'w.spec_gate': 0.12, 'w.step_scale': 0.15, 'w.vol_cap': 0.28 };
  const LO = { 'w.mom_min': 0.10, 'w.trend_gap': 0.0005, 'w.rsi_lo': 15, 'w.rsi_hi': 52, 'w.stop_atr': 0.8, 'w.tp_atr': 1.0, 'w.size': 0.05, 'w.spec_gate': 0.0, 'w.step_scale': 0.25, 'w.vol_cap': 0.8 };
  const HI = { 'w.mom_min': 1.5, 'w.trend_gap': 0.03, 'w.rsi_lo': 48, 'w.rsi_hi': 85, 'w.stop_atr': 4.0, 'w.tp_atr': 6.0, 'w.size': 0.9, 'w.spec_gate': 1.0, 'w.step_scale': 3.0, 'w.vol_cap': 4.0 };
  const state = await g('w.state');
  const pool = await g('moth.pool');
  const cursor = (await g('moth.cursor')) | 0;
  if (pool.length - cursor < 4) return { need_entropy: true, left: pool.length - cursor };
  await s('moth.cursor', cursor + 4);
  const fl = pool.slice(cursor, cursor + 4);
  const search = W.filter((x) => !state.dormant[x]);
  if (search.length === 0) return { done: true, note: 'all weights dormant — the agent is fully simplified' };
  // pick 1: least-tried non-meta weight (coverage guarantee — dormancy must
  // emerge from DATA, not from luck); pick 2: moth-random. fl[0] reserved.
  const unrest = search.filter((x) => state.meta_exempt.indexOf(x) < 0);
  const p1 = unrest.length
    ? unrest.reduce((a, b) => (((state.part[a] || { tries: 0 }).tries) <= ((state.part[b] || { tries: 0 }).tries) ? a : b))
    : search[0];
  const rest = search.filter((x) => x !== p1);
  const p2 = rest.length ? rest[Math.min(rest.length - 1, Math.floor(fl[1] * rest.length))] : p1;
  const picks = p2 === p1 ? [p1] : [p1, p2];
  const incumbent = {};
  for (let k = 0; k < picks.length; k++) {
    const id = picks[k];
    const cur = await g(id);
    const u = fl[2 + k];
    const span = SPAN[id] * await g('w.step_scale');
    let nv = cur + (u - 0.5) * 2 * span;
    nv = clamp(nv, LO[id], HI[id]);
    if (id === 'w.rsi_lo') nv = Math.min(nv, await g('w.rsi_hi') - 2);
    if (id === 'w.rsi_hi') nv = Math.max(nv, await g('w.rsi_lo') + 2);
    incumbent[id] = cur;
    await s(id, nv);
  }
  const sim = (await runtime.call('sim.run', {})).data;
  const rows = await g('ledger.rows');
  const prev = rows.length ? rows[rows.length - 1].row_hash : GENESIS_PREV;
  const baseScore = state.best_score; // sensitivity is measured vs the PRE-step incumbent
  let verdict = { accept: false, reason: 'world halted' };
  let score = baseScore == null ? 0 : baseScore;
  if (!sim.halt) {
    const mt = sim.metrics;
    score = mt.sharpe - 2 * mt.maxdd - (mt.n_trades < 3 ? 0.5 : 0);
    verdict = (await runtime.call('rule.M7.check', { score, best: baseScore })).data;
  }
  let dormantNew = null;
  if (verdict.accept) {
    state.best_score = score;
    for (const id of W) state.champion[id] = await g(id);
  } else {
    for (const id of picks) await s(id, incumbent[id]);
    await runtime.call('sim.run', {});
  }
  for (const id of picks) {
    if (state.meta_exempt.indexOf(id) >= 0) continue;
    const p = state.part[id] || { tries: 0, wins: 0, maxd: 0 };
    p.tries += 1;
    if (verdict.accept) p.wins += 1;
    p.maxd = Math.max(p.maxd, Math.abs(score - (baseScore == null ? 0 : baseScore)));
    state.part[id] = p;
    const v8 = (await runtime.call('rule.M8.check', { part: p, meta: state.meta_exempt.indexOf(id) >= 0 })).data;
    if (v8.dormant && !state.dormant[id]) { state.dormant[id] = true; dormantNew = id; }
  }
  state.rounds += 1;
  const row = {
    seq: rows.length + 1, prev_hash: prev,
    kind: verdict.accept ? 'accept' : 'refuse', moved: picks,
    score: +score.toFixed(4), best: +(state.best_score == null ? 0 : state.best_score).toFixed(4),
    dormant: dormantNew,
  };
  row.row_hash = fnv1a64(canon(row));
  rows.push(row);
  await s('w.state', state);
  await s('ledger.rows', rows);
  return { accept: verdict.accept, score, best: state.best_score, moved: picks, dormant_new: dormantNew, left: pool.length - cursor - 4, note: verdict.reason };
}`, 'M7+M8: moth-entropy perturbation, accept iff strictly better, participation, dormancy'));

  push(v('ledger.rows', [], 'the learning ledger — fnv1a64 chain, one row per round'));

  // ── the LLM analyst reads the DISTRIBUTED state ──
  push(prog('ai.digest', `
{
  const g = (id) => runtime.get(id).then((r) => r.data);
  const rg = await g('wave.regime');
  const spec = await g('wave.spectrum');
  const sim = await g('sim.last');
  const state = await g('w.state');
  const ent = await g('moth.entangle');
  const pool = await g('moth.pool');
  const cursor = (await g('moth.cursor')) | 0;
  const W = ['w.mom_min', 'w.trend_gap', 'w.rsi_lo', 'w.rsi_hi', 'w.stop_atr', 'w.tp_atr', 'w.size', 'w.spec_gate', 'w.vol_cap'];
  const parts = [];
  for (const id of W) parts.push(id.slice(2) + '=' + (+await g(id)).toFixed(3));
  const dorm = Object.keys(state.dormant).filter((k) => state.dormant[k]);
  const mt = sim && sim.metrics ? sim.metrics : null;
  const score = mt ? (mt.sharpe - 2 * mt.maxdd - (mt.n_trades < 3 ? 0.5 : 0)) : null;
  const edge = (ent.edges || []).find((e) => e.a === 'mom' && e.b === 'rev');
  return 'REGIME=' + rg.regime + ' conf=' + (rg.conf == null ? 0 : rg.conf).toFixed(2)
    + ' P*=' + spec.p_star + ' ratio=' + spec.ratio.toFixed(1)
    + ' | score=' + (score == null ? 'n/a' : score.toFixed(3))
    + ' best=' + (state.best_score == null ? 'n/a' : state.best_score.toFixed(3))
    + ' rounds=' + state.rounds
    + ' | dormant=' + (dorm.length ? dorm.join(',') : 'none')
    + ' | ZZ(mom,rev)=' + (edge ? edge.zz.toFixed(2) : 'n/a')
    + ' agreement=' + (ent.agreement == null ? 'n/a' : ent.agreement.toFixed(2))
    + ' | entropy_left=' + (pool.length - cursor)
    + ' | ' + parts.join(' ');
}`, 'the distributed state, compressed for the analyst (≤ 600 chars)'));
  push({
    id: 'ai.analyst', kind: 'ai', ai_kind: 'zai.choice', provider: 'zai',
    system: 'You are the analyst on a simulation-first trading agent. The agent learns by perturbing its belief cells and keeping only strict improvements. Advise with ONE letter only: A = keep course. B = exploit (shrink exploration steps). C = explore (widen exploration steps). D = prune the least useful weight. E = re-tune stop/target distances. No other text, no punctuation.',
    input: '{{ai.digest}}', options: ['A', 'B', 'C', 'D', 'E'], temperature: 0.2, max_words: 8,
    description: 'letter-coded analyst — the fence is in the provider adapter; patch-8 carries options through',
  });

  // ── glass ──
  push(prog('art.equity', `
{
  const sim = (await runtime.get('sim.last')).data;
  if (!sim || sim.halt) return 'no world';
  ${SRC_SPARK}
  const mt = sim.metrics;
  return spark(sim.equity, 72) + '  ret ' + (mt.total_return * 100).toFixed(1) + '%  sharpe ' + mt.sharpe.toFixed(2) + '  dd ' + (mt.maxdd * 100).toFixed(1) + '%  trades ' + mt.n_trades;
}`, 'the glass: equity sparkline of the published world'));

  return {
    id: 'sim-first-agent-lab',
    title: 'The Sim-First Agent Lab — backtest as the architecture, not the report',
    cells,
  };
}
