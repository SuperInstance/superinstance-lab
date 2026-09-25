// QUILT-QUANT VIEWER — the trading desk on a shared screen.
//
// Everything you see is a cell read: the tape, the indicator glass, the
// position shading, the metrics strip, the walk-forward badge, the champion
// card, the receipt ledger. Every button press is a value push: nudge a
// parameter and the whole desk re-prices; run the trainer and watch the
// champion move through the S7 gate with witness receipts.

import { QuiltEngine } from '../engine/index.js';
import { buildSheet } from './sheet.mjs';

const engine = new QuiltEngine('view-quant', { eager: true });
engine.loadSheet(buildSheet());
window.__engine = engine;

const get = async (id) => { try { return (await engine.get(id)).data; } catch { return undefined; } };
const call = async (id, input) => { try { return (await engine.call(id, input)).data; } catch (e) { return { error: String(e) }; } };

const PARAM_DEFS = [
  { id: 'p.fast', label: 'sma_fast', step: 1, min: 2, max: 60, tip: 'S2 — fast window' },
  { id: 'p.slow', label: 'sma_slow', step: 1, min: 4, max: 160, tip: 'S2 — slow window' },
  { id: 'p.rsi_len', label: 'rsi_len', step: 1, min: 2, max: 40, tip: 'S2 — RSI period' },
  { id: 'p.rsi_max', label: 'rsi_max', step: 1, min: 50, max: 95, tip: 'S3 — overbought gate' },
  { id: 'p.rsi_buy', label: 'rsi_buy', step: 1, min: 10, max: 45, tip: 'S3 — reversion entry' },
  { id: 'p.rsi_sell', label: 'rsi_sell', step: 1, min: 50, max: 90, tip: 'S3 — reversion exit' },
  { id: 'p.fee_bps', label: 'fee_bps', step: 1, min: 0, max: 50, tip: 'S4 — cost per change' },
  { id: 'p.wf_pct', label: 'wf_pct', step: 5, min: 30, max: 85, tip: 'S6 — fit window share' },
];
const RULE_IDS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

let state = null;
let trainerBusy = false;

async function snapshot() {
  const bt = await call('bt.run');        // the re-price (fresh program pull)
  const wf = await call('wf.report');
  const bnh = await call('bnh.run');
  const art = await get('art.equity');
  const chain = await get('ai.chaincheck');
  const closes = await get('mkt.closes');
  const f = await get('ind.sma_fast'), s = await get('ind.sma_slow'), r = await get('ind.rsi');
  const pos = await get('sig.pos');
  const params = {};
  for (const d of PARAM_DEFS) params[d.id] = await get(d.id);
  const strategy = await get('p.strategy');
  const met = {};
  for (const m of ['met.ret', 'met.cagr', 'met.sharpe', 'met.maxdd', 'met.trades', 'met.winrate', 'met.pf', 'met.exposure', 'met.wf', 'met.bnh_ret']) met[m.replaceAll('.', '_')] = await get(m);
  const champion = await get('desk.champion');
  const flash = await get('desk.flash');
  const ledger = (await get('ai.ledger')) ?? [];
  const events = (await get('log.events')) ?? [];
  const rules = [];
  for (const id of RULE_IDS) {
    rules.push({ id, law: (await get(`rule.${id}.law`)) ?? '',
      verdict: await get(`rule.${id}.verdict`) });
  }
  const bnhEquity = bnh?.equity ?? null;
  return { bt, wf, bnh, bnhEquity, art, chain, closes, f, s, r, pos, params, strategy, met, champion, flash, ledger, events, rules,
    key: JSON.stringify(params) + ':' + String(bt?.metrics?.sharpe) + ':' + ledger.length + ':' + champion?.gen };
}

// ── canvases ─────────────────────────────────────────────────────────────────
function setupCanvas(cv, h) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth;
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.height = h + 'px';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
function linePath(ctx, arr, x0, x1, y0, y1, lo, hi) {
  const n = arr.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = x0 + (i / (n - 1)) * (x1 - x0);
    const y = y1 - ((arr[i] - lo) / ((hi - lo) || 1)) * (y1 - y0);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}
function drawPrice(st) {
  const cv = document.getElementById('cv-price');
  const { ctx, w, h } = setupCanvas(cv, 250);
  const pad = { l: 46, r: 10, t: 12, b: 18 };
  const closes = st.closes, f = st.f, s = st.s, pos = st.pos;
  let lo = Infinity, hi = -Infinity;
  for (const v of closes) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const X = (i) => pad.l + (i / (closes.length - 1)) * (w - pad.l - pad.r);
  const Y = (v) => (h - pad.b) - ((v - lo) / ((hi - lo) || 1)) * (h - pad.t - pad.b);
  ctx.clearRect(0, 0, w, h);
  // position shading (S3 as scenery)
  for (let i = 0; i < pos.length; i++) {
    if (pos[i] === 1) { ctx.fillStyle = 'rgba(46,125,50,0.10)'; ctx.fillRect(X(i), pad.t, Math.max(1, (w - pad.l - pad.r) / closes.length), h - pad.t - pad.b); }
  }
  // grid
  ctx.strokeStyle = '#e3dac5'; ctx.fillStyle = '#8a7f6a'; ctx.font = '10px ui-monospace,Menlo,monospace';
  for (let g = 0; g <= 4; g++) {
    const v = lo + ((hi - lo) * g) / 4, y = Y(v);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillText(v.toFixed(0), 6, y + 3);
  }
  // sma overlays
  if (f) { ctx.strokeStyle = '#3a8fa0'; ctx.lineWidth = 1.2; linePath(ctx, f.map(v => v ?? lo), X(0), X(closes.length - 1), Y(lo), Y(hi), lo, hi); ctx.stroke(); }
  if (s) { ctx.strokeStyle = '#8a5aa0'; ctx.lineWidth = 1.2; linePath(ctx, s.map(v => v ?? lo), X(0), X(closes.length - 1), Y(lo), Y(hi), lo, hi); ctx.stroke(); }
  // price
  ctx.strokeStyle = '#2b2620'; ctx.lineWidth = 1.4;
  linePath(ctx, closes, X(0), X(closes.length - 1), Y(lo), Y(hi), lo, hi); ctx.stroke();
  // trade markers
  ctx.fillStyle = '#2e7d32';
  for (const t of st.bt?.trades ?? []) {
    ctx.beginPath(); ctx.moveTo(X(t.entry), Y(closes[t.entry]) + 4); ctx.lineTo(X(t.entry) - 4, Y(closes[t.entry]) + 11); ctx.lineTo(X(t.entry) + 4, Y(closes[t.entry]) + 11); ctx.fill();
    ctx.fillStyle = '#b3402e';
    ctx.beginPath(); ctx.moveTo(X(t.exit), Y(closes[t.exit]) - 4); ctx.lineTo(X(t.exit) - 4, Y(closes[t.exit]) - 11); ctx.lineTo(X(t.exit) + 4, Y(closes[t.exit]) - 11); ctx.fill();
    ctx.fillStyle = '#2e7d32';
  }
  // regime bands legend
  ctx.fillStyle = '#8a7f6a'; ctx.font = '10px ui-monospace,Menlo,monospace';
  ctx.fillText('tape · sma_fast · sma_slow · shaded = long (S3) · ▲ entry ▼ exit', pad.l, h - 5);
}
function drawEquity(st) {
  const cv = document.getElementById('cv-equity');
  const { ctx, w, h } = setupCanvas(cv, 130);
  const pad = { l: 46, r: 10, t: 8, b: 14 };
  const eq = st.bt?.equity, be = st.bnhEquity;
  ctx.clearRect(0, 0, w, h);
  if (!eq || !be) return;
  const all = [...eq, ...be];
  let lo = Math.min(...all), hi = Math.max(...all);
  const X = (i) => pad.l + (i / (eq.length - 1)) * (w - pad.l - pad.r);
  const Y = (v) => (h - pad.b) - ((v - lo) / ((hi - lo) || 1)) * (h - pad.t - pad.b);
  ctx.strokeStyle = '#e3dac5'; ctx.fillStyle = '#8a7f6a'; ctx.font = '10px ui-monospace,Menlo,monospace';
  for (let g = 0; g <= 3; g++) { const v = lo + ((hi - lo) * g) / 3, y = Y(v); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.fillText(v.toFixed(0), 6, y + 3); }
  ctx.strokeStyle = '#b99b4e'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
  linePath(ctx, be, X(0), X(eq.length - 1), Y(lo), Y(hi), lo, hi); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 1.6;
  linePath(ctx, eq, X(0), X(eq.length - 1), Y(lo), Y(hi), lo, hi); ctx.stroke();
  ctx.fillStyle = '#8a7f6a'; ctx.fillText('equity — desk (green) vs buy & hold (dashed) · 10k start', pad.l, h - 3);
}
function drawDD(st) {
  const cv = document.getElementById('cv-dd');
  const { ctx, w, h } = setupCanvas(cv, 62);
  const pad = { l: 46, r: 10, t: 6, b: 10 };
  const eq = st.bt?.equity;
  ctx.clearRect(0, 0, w, h);
  if (!eq) return;
  const dd = []; let peak = eq[0];
  for (const x of eq) { peak = Math.max(peak, x); dd.push((peak - x) / peak); }
  const maxdd = Math.max(...dd, 0.01);
  const X = (i) => pad.l + (i / (eq.length - 1)) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (v / maxdd) * (h - pad.t - pad.b);
  ctx.beginPath(); ctx.moveTo(X(0), pad.t);
  for (let i = 0; i < dd.length; i++) ctx.lineTo(X(i), Y(dd[i]));
  ctx.lineTo(X(dd.length - 1), pad.t); ctx.closePath();
  ctx.fillStyle = 'rgba(179,64,46,0.25)'; ctx.fill();
  ctx.strokeStyle = '#b3402e'; ctx.lineWidth = 1;
  ctx.beginPath(); for (let i = 0; i < dd.length; i++) { const x = X(i), y = Y(dd[i]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
  ctx.fillStyle = '#8a7f6a'; ctx.font = '10px ui-monospace,Menlo,monospace';
  ctx.fillText(`drawdown · max ${(100 * (st.bt?.metrics?.maxdd ?? 0)).toFixed(1)}%`, pad.l, h - 1);
}

// ── render ───────────────────────────────────────────────────────────────────
const fmtPct = (x) => (x == null ? '—' : (100 * x).toFixed(1) + '%');
const fmtN = (x, d = 2) => (x == null ? '—' : Number(x).toFixed(d));

function render(st) {
  // badges
  const wfBadge = document.getElementById('wf-badge');
  wfBadge.textContent = 'S6 ' + (st.met.met_wf ?? '—');
  wfBadge.className = 'qq-badge ' + ({ ROBUST: 'ok', OVERFIT: 'bad', WEAK: 'meh' }[st.met.met_wf] ?? 'meh');
  const chainBadge = document.getElementById('chain-badge');
  chainBadge.textContent = st.chain?.ok ? `S8 sealed · ${st.chain.len} receipts` : 'S8 TAMPERED';
  chainBadge.className = 'qq-badge ' + (st.chain?.ok ? 'ok' : 'bad');
  // bubble
  const bubble = document.getElementById('bubble');
  const btBad = st.bt && st.bt.ok === false;
  const promoted = st.flash?.kind === 'promote';
  bubble.className = 'qq-bubble ' + (btBad ? 'bad' : promoted ? 'win' : '');
  bubble.innerHTML = st.flash?.text
    ? `<b>${btBad ? 'REFUSED · ' + st.bt.rule : promoted ? 'PROMOTED' : 'DESK'}</b> — ${st.flash.text}`
    : '<b>DESK</b> ready.';
  // book
  const book = document.getElementById('book');
  book.innerHTML = st.rules.map(r2 => {
    const fired = r2.verdict?.fired === true;
    const fresh = r2.verdict != null;
    return `<div class="qq-clause ${fired ? 'fired' : fresh ? 'ran' : ''}" title="${(r2.verdict?.why ?? '').replace(/"/g, '&quot;')}">
      <span class="qq-cid">${r2.id}</span> ${r2.law}</div>`;
  }).join('');
  // params
  const plist = document.getElementById('params');
  plist.innerHTML = PARAM_DEFS.map(d => {
    const val = st.params[d.id];
    return `<div class="qq-param" title="${d.tip}">
      <span class="qq-pid">${d.id}</span>
      <button data-nudge="${d.id}" data-dir="-1">−</button>
      <span class="qq-pval">${val}</span>
      <button data-nudge="${d.id}" data-dir="1">+</button>
    </div>`;
  }).join('');
  for (const b of plist.querySelectorAll('button')) b.onclick = () => nudge(b.dataset.nudge, Number(b.dataset.dir));
  // strategy switch
  for (const b of document.querySelectorAll('[data-strategy]')) {
    b.classList.toggle('on', b.dataset.strategy === st.strategy);
    b.onclick = async () => { await engine.set('p.strategy', b.dataset.strategy); refresh(); };
  }
  // metrics strip
  const M = st.met;
  document.getElementById('metrics').innerHTML = [
    ['met.ret', 'return', fmtPct(M.met_ret)], ['met.cagr', 'CAGR', fmtPct(M.met_cagr)],
    ['met.sharpe', 'sharpe', fmtN(M.met_sharpe)], ['met.maxdd', 'max dd', fmtPct(M.met_maxdd)],
    ['met.trades', 'trades', M.met_trades ?? '—'], ['met.winrate', 'win rate', fmtPct(M.met_winrate)],
    ['met.pf', 'profit factor', fmtN(M.met_pf)], ['met.exposure', 'exposure', fmtPct(M.met_exposure)],
    ['met.bnh_ret', 'b&h return', fmtPct(M.met_bnh_ret)],
  ].map(([id, label, val]) => `<div class="qq-met" id="${id}"><span>${label}</span><b>${val}</b></div>`).join('');
  // champion card
  const c = st.champion ?? {};
  document.getElementById('champion').innerHTML =
    `<div class="qq-champ-gen">gen ${c.gen ?? 0} · ${c.strategy ?? '—'}</div>
     <div class="qq-champ-params">fast ${c.params?.fast} · slow ${c.params?.slow} · rsi_len ${c.params?.rsi_len} · rsi_max ${c.params?.rsi_max}</div>
     <div class="qq-champ-scores"><span>IS ${c.is_score == null ? '—' : c.is_score.toFixed(3)}</span><span>OOS ${c.oos_score == null ? '—' : c.oos_score.toFixed(3)}</span></div>`;
  // wf detail
  const wf = st.wf ?? {};
  document.getElementById('wf-detail').innerHTML = wf.ok
    ? `FIT ${wf.isN} bars — sharpe ${fmtN(wf.is_m?.sharpe)} · dd ${fmtPct(wf.is_m?.maxdd)} · ${wf.is_m?.n_trades} trades<br>
       JUDGE ${wf.oosN} bars — sharpe ${fmtN(wf.oos_m?.sharpe)} · dd ${fmtPct(wf.oos_m?.maxdd)} · ${wf.oos_m?.n_trades} trades<br>
       <i>${wf.why ?? ''}</i>`
    : '—';
  // ledger
  const led = [...st.ledger].reverse().slice(0, 12);
  document.getElementById('ledger').innerHTML = led.map(r2 => `
    <tr class="${r2.kind}">
      <td>${r2.seq}</td><td>${r2.gen}</td><td>${r2.kind}${r2.wb_moved ? '·wb' : ''}</td>
      <td>${r2.strategy ?? '—'}</td><td>${r2.params ? r2.params.fast + '/' + r2.params.slow : '—'}</td>
      <td>${r2.is_score == null ? '—' : r2.is_score.toFixed(3)}</td>
      <td>${r2.oos_score == null ? '—' : r2.oos_score.toFixed(3)}</td>
      <td>${r2.verdict ?? ''}</td><td class="qq-hash" title="${r2.why ?? ''}">${(r2.row_hash ?? '').slice(0, 8)}</td>
    </tr>`).join('');
  // events
  document.getElementById('events').innerHTML = [...st.events].reverse().slice(0, 8)
    .map(e => `<div>· ${e.text}</div>`).join('');
  // sparkline glass (the cells themselves)
  const art = st.art ?? {};
  document.getElementById('glass').innerHTML = art.ok
    ? `<div><span class="qq-glass-label">art.equity.desk</span><span class="qq-spark">${art.desk}</span></div>
       <div><span class="qq-glass-label">art.equity.bnh&nbsp;</span><span class="qq-spark dim">${art.bnh}</span></div>
       <div><span class="qq-glass-label">art.equity.dd&nbsp;&nbsp;</span><span class="qq-spark bad">${art.dd}</span></div>`
    : 'pull bt.run to light the glass';
  drawPrice(st); drawEquity(st); drawDD(st);
}

async function refresh() {
  state = await snapshot();
  render(state);
}

async function nudge(id, dir) {
  const def = PARAM_DEFS.find(d => d.id === id);
  const cur = Number(await get(id));
  const next = Math.max(def.min, Math.min(def.max, cur + dir * def.step));
  if (next === cur) return;
  await engine.set(id, next);
  refresh();
}

async function runTrainer() {
  if (trainerBusy) return;
  trainerBusy = true;
  const btn = document.getElementById('btn-train');
  const gens = Number(document.getElementById('trainer-gens').value) || 24;
  const seed = Number(document.getElementById('trainer-seed').value) || (1 + Math.floor(Math.random() * 1e6));
  btn.textContent = `training ${gens} gens…`; btn.disabled = true;
  try {
    const t = await call('ai.trainer', { gens, seed });
    document.getElementById('trainer-result').textContent = t?.ok
      ? `${t.tried} candidates · ${t.kept} promotions · champion OOS ${t.champion.oos_score?.toFixed(3)}`
      : 'trainer refused';
    await refresh();
    const card = document.getElementById('champion-card');
    card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 1600);
  } finally {
    btn.textContent = 'RUN THE TRAINER'; btn.disabled = false; trainerBusy = false;
  }
}

async function resetDesk() {
  for (const [id, v] of Object.entries({ 'p.strategy': 'sma_cross', 'p.fast': 8, 'p.slow': 34, 'p.rsi_len': 14, 'p.rsi_max': 72, 'p.rsi_buy': 30, 'p.rsi_sell': 64, 'p.fee_bps': 2, 'p.wf_pct': 70 })) await engine.set(id, v);
  await engine.set('ai.ledger', []);
  await engine.set('desk.champion', { gen: 0, strategy: 'sma_cross', params: { fast: 8, slow: 34, rsi_len: 14, rsi_max: 72, rsi_buy: 30, rsi_sell: 64 }, is_score: null, oos_score: null, verdict: '—' });
  await engine.set('desk.prev_champ', null);
  await engine.set('desk.flash', { kind: '', text: 'desk reset — nudge a parameter or run the trainer.', ts: Date.now() });
  refresh();
}

// ── mount ─────────────────────────────────────────────────────────────────────
function mount(root) {
  root.innerHTML = `
  <style>${CSS}</style>
  <div class="qq-root">
    <header class="qq-head">
      <div>
        <div class="qq-brand">quilt·quant</div>
        <div class="qq-tag">the trading desk as a spreadsheet — every rule is a cell, every promotion is a receipt</div>
      </div>
      <div class="qq-badges">
        <span id="wf-badge" class="qq-badge meh">S6 —</span>
        <span id="chain-badge" class="qq-badge ok">S8 —</span>
      </div>
    </header>
    <div id="bubble" class="qq-bubble">pricing the desk…</div>
    <div class="qq-cols">
      <aside class="qq-col-left">
        <h3>strategy.book</h3>
        <div id="book" class="qq-book"></div>
      </aside>
      <main class="qq-col-mid">
        <canvas id="cv-price"></canvas>
        <canvas id="cv-equity"></canvas>
        <canvas id="cv-dd"></canvas>
        <div id="glass" class="qq-glass"></div>
      </main>
      <aside class="qq-col-right">
        <h3>parameter cells <span class="qq-hint">(push a value — the desk re-prices)</span></h3>
        <div class="qq-strategies">
          <button data-strategy="sma_cross">sma_cross</button>
          <button data-strategy="rsi_reversion">rsi_reversion</button>
        </div>
        <div id="params" class="qq-params"></div>
        <h3>metrics (S5)</h3>
        <div id="metrics" class="qq-metrics"></div>
        <div id="champion-card" class="qq-champ">
          <h3>desk.champion (S7)</h3>
          <div id="champion"></div>
        </div>
        <div class="qq-trainer">
          <h3>ai.trainer — the gated loop</h3>
          <div class="qq-trainer-row">
            <label>gens <input id="trainer-gens" value="24" size="3"></label>
            <label>seed <input id="trainer-seed" value="11" size="6"></label>
          </div>
          <button id="btn-train" class="qq-run">RUN THE TRAINER</button>
          <button id="btn-reset" class="qq-reset">reset desk</button>
          <div id="trainer-result" class="qq-trainer-result"></div>
          <div id="wf-detail" class="qq-wf-detail"></div>
        </div>
      </aside>
    </div>
    <div class="qq-bottom">
      <div class="qq-ledger-wrap">
        <h3>ai.ledger — witness receipts (fnv1a64 chain, newest first)</h3>
        <table class="qq-ledger">
          <thead><tr><th>seq</th><th>gen</th><th>kind</th><th>strategy</th><th>f/s</th><th>IS</th><th>OOS</th><th>verdict</th><th>hash</th></tr></thead>
          <tbody id="ledger"></tbody>
        </table>
      </div>
      <div class="qq-events-wrap">
        <h3>log.events</h3>
        <div id="events" class="qq-events"></div>
      </div>
    </div>
    <footer class="qq-foot">quilt-quant · fit on IS, judged on OOS (S6) · promotion only through the gate (S7) · every receipt re-derives (S8)</footer>
  </div>`;
  document.getElementById('btn-train').onclick = runTrainer;
  document.getElementById('btn-reset').onclick = resetDesk;
  refresh();
}

const CSS = `
.qq-root { font: 13px/1.45 ui-monospace, Menlo, monospace; color: #2b2620; }
.qq-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; }
.qq-brand { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
.qq-tag { color: #8a7f6a; margin-top: 2px; }
.qq-badges { display: flex; gap: 8px; }
.qq-badge { padding: 3px 10px; border-radius: 12px; font-size: 11px; border: 1px solid; }
.qq-badge.ok { color: #2e7d32; border-color: #2e7d32; background: #e7f0e7; }
.qq-badge.bad { color: #b3402e; border-color: #b3402e; background: #f5e4e0; }
.qq-badge.meh { color: #a8752a; border-color: #a8752a; background: #f5ecd9; }
.qq-bubble { border: 1px solid #d8cfba; border-left: 4px solid #a8752a; background: #f6f1e5; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; }
.qq-bubble.bad { border-left-color: #b3402e; background: #f7e8e4; }
.qq-bubble.win { border-left-color: #2e7d32; background: #e9f2e9; }
.qq-cols { display: grid; grid-template-columns: 250px 1fr 300px; gap: 12px; align-items: start; }
.qq-col-left, .qq-col-right { background: #f6f1e5; border: 1px solid #d8cfba; border-radius: 8px; padding: 10px; }
.qq-col-left h3, .qq-col-right h3, .qq-ledger-wrap h3, .qq-events-wrap h3 { margin: 2px 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #8a7f6a; }
.qq-hint { text-transform: none; letter-spacing: 0; }
.qq-book { max-height: 560px; overflow-y: auto; }
.qq-clause { font-size: 11px; line-height: 1.5; padding: 6px 7px; border: 1px solid transparent; border-radius: 5px; margin-bottom: 5px; color: #4a4438; }
.qq-clause.ran { background: #eef0e4; border-color: #d8cfba; }
.qq-clause.fired { background: #f7e0da; border-color: #b3402e; }
.qq-cid { font-weight: 700; color: #34597d; margin-right: 4px; }
canvas { width: 100%; display: block; background: #fbf8f0; border: 1px solid #d8cfba; border-radius: 8px; margin-bottom: 8px; }
.qq-glass { font-size: 11px; line-height: 1.7; color: #4a4438; background: #f6f1e5; border: 1px dashed #d8cfba; border-radius: 6px; padding: 6px 9px; white-space: nowrap; overflow: hidden; }
.qq-glass-label { color: #8a7f6a; display: inline-block; width: 118px; }
.qq-spark { letter-spacing: -1px; }
.qq-spark.dim { color: #b99b4e; }
.qq-spark.bad { color: #b3402e; }
.qq-strategies { display: flex; gap: 6px; margin-bottom: 8px; }
.qq-strategies button { flex: 1; font: 11px ui-monospace, Menlo, monospace; padding: 5px 4px; border: 1px solid #d8cfba; background: #fbf8f0; border-radius: 5px; cursor: pointer; color: #4a4438; }
.qq-strategies button.on { background: #2b2620; color: #f6f1e5; border-color: #2b2620; }
.qq-param { display: grid; grid-template-columns: 84px 24px 1fr 24px; gap: 4px; align-items: center; margin-bottom: 4px; }
.qq-pid { color: #34597d; font-size: 11px; }
.qq-pval { text-align: right; font-weight: 700; background: #fbf8f0; border: 1px solid #d8cfba; border-radius: 4px; padding: 2px 8px; }
.qq-param button { font: 13px ui-monospace; border: 1px solid #d8cfba; background: #fbf8f0; border-radius: 4px; cursor: pointer; }
.qq-param button:hover { background: #e7dfcc; }
.qq-metrics { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
.qq-met { background: #fbf8f0; border: 1px solid #d8cfba; border-radius: 5px; padding: 5px 7px; }
.qq-met span { display: block; font-size: 9px; text-transform: uppercase; color: #8a7f6a; }
.qq-met b { font-size: 13px; }
.qq-champ { background: #eef0e4; border: 1px solid #c8bfa8; border-radius: 8px; padding: 8px 10px; margin-top: 10px; transition: box-shadow .3s; }
.qq-champ.flash { box-shadow: 0 0 0 3px #2e7d32; }
.qq-champ-gen { font-weight: 700; }
.qq-champ-params { color: #4a4438; font-size: 11px; margin: 2px 0; }
.qq-champ-scores { display: flex; gap: 14px; font-weight: 700; color: #2e7d32; }
.qq-trainer { margin-top: 10px; background: #f6f1e5; border: 1px solid #d8cfba; border-radius: 8px; padding: 8px 10px; }
.qq-trainer-row { display: flex; gap: 10px; margin-bottom: 6px; }
.qq-trainer input { font: 12px ui-monospace; width: 70px; border: 1px solid #d8cfba; border-radius: 4px; padding: 2px 5px; background: #fbf8f0; }
.qq-run { width: 100%; font: 700 12px ui-monospace; padding: 7px; background: #2e7d32; color: #fff; border: 0; border-radius: 6px; cursor: pointer; }
.qq-run:disabled { opacity: .6; }
.qq-reset { width: 100%; margin-top: 5px; font: 11px ui-monospace; padding: 5px; background: #fbf8f0; border: 1px solid #d8cfba; border-radius: 6px; cursor: pointer; color: #4a4438; }
.qq-trainer-result { margin-top: 6px; font-size: 11px; color: #2e7d32; min-height: 14px; }
.qq-wf-detail { margin-top: 6px; font-size: 10px; line-height: 1.6; color: #4a4438; }
.qq-bottom { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-top: 12px; }
.qq-ledger-wrap, .qq-events-wrap { background: #f6f1e5; border: 1px solid #d8cfba; border-radius: 8px; padding: 10px; }
.qq-ledger { width: 100%; border-collapse: collapse; font-size: 11px; }
.qq-ledger th { text-align: left; color: #8a7f6a; font-weight: 400; border-bottom: 1px solid #d8cfba; padding: 2px 6px; }
.qq-ledger td { padding: 3px 6px; border-bottom: 1px solid #eee5d2; }
.qq-ledger tr.promote td { background: #e7f0e7; }
.qq-ledger tr.refuse td { color: #7a4438; }
.qq-hash { color: #8a7f6a; }
.qq-events { font-size: 11px; max-height: 180px; overflow-y: auto; color: #4a4438; }
.qq-foot { text-align: center; color: #8a7f6a; font-size: 11px; padding: 14px 0 4px; }
`;

mount(document.getElementById('app'));
