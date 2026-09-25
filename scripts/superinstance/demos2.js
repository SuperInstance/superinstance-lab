/* ============ DEMO 03 — Hold'em: playing the players ============ */
(function () {
  const log = makeLog(document.getElementById('heLog'), 'holdem', { ignore: ['opp.stats', 'shape.opp'] });
  const S = new Sheet('holdem');
  const rnd = mulberry(777);
  const SUITS = ['♠', '♥', '♦', '♣'], RED = { '♥': 1, '♦': 1 };
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const STREETS = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];

  S.cell('hand', 1, { silent: true });
  S.cell('street', 0, { silent: true });
  S.cell('board', [], { silent: true });
  S.cell('pot', 40, { silent: true });
  S.cell('opp.stats', { n: 0, checks: 0, calls: 0, bets: 0, raises: 0, folds: 0, sizes: [] }, { silent: true });
  // ── shape: the FORMULA that turns raw actions into a decision silhouette
  S.def('shape.opp', ['opp.stats'], st => {
    if (!st.n) return null;
    const loose = (st.checks + st.calls) / st.n;
    const aggr = (st.bets + st.raises) / st.n;
    let decep = 0;
    if (st.sizes.length >= 3) {
      const mean = st.sizes.reduce((a, b) => a + b, 0) / st.sizes.length;
      const varr = st.sizes.reduce((a, b) => a + (b - mean) * (b - mean), 0) / st.sizes.length;
      decep = Math.min(1, Math.sqrt(varr) / 0.38);
    }
    return { loose, aggr, deception: decep, n: st.n };
  });

  // OPP's hidden persona — drifts a little every hand (they are adapting too)
  const persona = { loose: 0.35 + rnd() * 0.4, aggr: 0.3 + rnd() * 0.5, bluff: rnd() * 0.5, strength: rnd() };
  let auto = null;
  const $ = id => document.getElementById(id);

  function cardGlyph(c) {
    const el = document.createElement('span');
    el.className = 'mcard' + (RED[c.s] ? ' red' : '');
    el.textContent = c.r + c.s;
    return el;
  }
  function hiddenCard() { const el = document.createElement('span'); el.className = 'mcard hidden'; el.textContent = '·'; return el; }
  function drawBoard() {
    const b = S.get('board'), el = $('community');
    el.innerHTML = '';
    for (let i = 0; i < 5; i++) el.appendChild(b[i] ? cardGlyph(b[i]) : hiddenCard());
  }
  function drawHole() {
    const f = +$('focusSlider').value / 100;
    $('holeA').style.opacity = $('holeB').style.opacity = (0.1 + 0.9 * f).toFixed(2);
    $('fadePct').textContent = f > 0.7 ? 'watching them' : f > 0.35 ? 'soft focus' : 'faded into the environment';
    $('fadePct').style.color = f <= 0.35 ? 'var(--tide)' : 'var(--dim)';
  }
  $('focusSlider').oninput = drawHole;

  // ── the read: a LISTENER speaking the shape out loud
  S.watch('shape.opp', (o, sh) => {
    if (!sh) return;
    drawRadar(sh);
    $('shLoose').textContent = sh.loose.toFixed(2);
    $('shAggr').textContent = sh.aggr.toFixed(2);
    $('shDecep').textContent = sh.deception.toFixed(2);
    $('shObs').textContent = sh.n;
    const street = S.get('street');
    if (street < 1) return;
    let kind, exploit;
    if (sh.aggr > 0.62 && sh.loose > 0.45) { kind = 'aggressive-loose'; exploit = 'let them do the betting; call down lighter and keep raises for when the shape says strength.'; }
    else if (sh.aggr > 0.62) { kind = 'tight-aggressive'; exploit = 'their bets mean it — fold the marginal, trap with monsters.'; }
    else if (sh.loose > 0.55) { kind = 'passive-loose'; exploit = 'they arrive, they rarely fire — value-bet thinner, bluff less.'; }
    else { kind = 'tight-passive'; exploit = 'a folding machine — pressure every pot and print the difference.'; }
    const conf = sh.n >= 8 ? `Read (n=${sh.n}): ` : sh.n >= 4 ? 'Provisional read: ' : 'Early glimpse: ';
    const dec = sh.deception > 0.6 ? ` Sizing is all over the place — deception ${sh.deception.toFixed(2)}, so don't trust the bet amount, trust the frequency.` : '';
    $('readBox').innerHTML = `${conf}OPP's shape is <b>${kind}</b> — aggression ${sh.aggr.toFixed(2)}, looseness ${sh.loose.toFixed(2)}. Exploit: ${exploit}${dec}`;
  });

  function drawRadar(sh) {
    const cv = $('shapeRadar'), ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, cx = W * 0.5, cy = H * 0.55, R = Math.min(W, H) * 0.36;
    ctx.clearRect(0, 0, W, H);
    const ang = i => -Math.PI / 2 + i * 2 * Math.PI / 3;
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    for (let r = 1; r <= 4; r++) {
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) { const a = ang(i), x = cx + Math.cos(a) * R * r / 4, y = cy + Math.sin(a) * R * r / 4; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(138,150,173,.9)'; ctx.font = '10px monospace';
    ctx.fillText('loose', cx - 14, cy - R - 8);
    ctx.fillText('aggr', cx + R * 0.72, cy + R * 0.78);
    ctx.fillText('decep', cx - R - 24, cy + R * 0.78);
    if (!sh) return;
    const vals = [sh.loose, sh.aggr, sh.deception];
    ctx.beginPath();
    vals.forEach((v, i) => { const a = ang(i), x = cx + Math.cos(a) * R * v, y = cy + Math.sin(a) * R * v; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
    ctx.fillStyle = 'rgba(63,224,197,.22)'; ctx.fill();
    ctx.strokeStyle = '#3FE0C5'; ctx.lineWidth = 1.6; ctx.stroke();
    vals.forEach((v, i) => { const a = ang(i); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v, 2.6, 0, 7); ctx.fillStyle = '#3FE0C5'; ctx.fill(); });
  }

  // ── hand progression
  function oppAct(streetName) {
    const st = S.get('street'), board = S.get('board');
    const wet = board.length >= 3 ? (new Set(board.map(c => c.s)).size >= 3 ? 0.15 : -0.1) : 0;
    const p = persona;
    const strength = Math.min(1, Math.max(0, p.strength + wet + (rnd() - 0.5) * 0.5));
    // copy-then-mutate: mutating the cell's own object then spreading it would
    // deep-equal the cell and silently skip recompute (the aliasing trap)
    const prev = S.get('opp.stats');
    const stt = { n: prev.n, checks: prev.checks, calls: prev.calls, bets: prev.bets,
      raises: prev.raises, folds: prev.folds, sizes: prev.sizes.slice() };
    const pot = S.get('pot');
    let line = '';
    const r = rnd();
    if (r < 0.12 + (1 - p.aggr) * 0.25 && strength < 0.45) { // fold
      stt.n++; stt.folds++;
      line = `<span class="sig">OPP folds to pressure on the ${streetName.toLowerCase()} · pot +${pot} — the fold is data too</span>`;
      S.cell('opp.stats', stt, { silent: true });
      S.cell('pot', 0, { silent: true });
      $('readBox').innerHTML = `<b>Won without a showdown.</b> ${streetName === 'PREFLOP' ? 'They folded pre —' : 'A fold on the ' + streetName.toLowerCase() + ' —'} folds are the cheapest reads in poker. Every action above fed the shape formula.`;
      advance(true);
      return;
    }
    if (r < 0.12 + (1 - p.aggr) * 0.25 + p.aggr * 0.45 * strength + p.bluff * 0.15) { // bet/raise
      const size = [0.33, 0.66, 1.0][Math.floor(rnd() * 3)];
      const amt = Math.round(pot * size);
      stt.n++; stt.bets++; stt.sizes.push(size);
      S.cell('pot', pot + amt, { silent: true });
      line = `OPP <b>bets</b> ${amt} <span style="color:var(--dim)">(${size === 0.33 ? '⅓' : size === 0.66 ? '⅔' : 'pot-sized'} on the ${streetName.toLowerCase()})</span> · board ${boardText()}`;
    } else if (r < 0.8) { // call
      stt.n++; stt.calls++;
      S.cell('pot', pot + 40, { silent: true });
      line = `OPP <b>calls</b> 40 on the ${streetName.toLowerCase()} · pot ${S.get('pot')}`;
    } else { // check
      stt.n++; stt.checks++;
      line = `OPP <b>checks</b> on the ${streetName.toLowerCase()} · pot ${S.get('pot')}`;
    }
    S.cell('opp.stats', stt, { silent: true });
    log(line);
    log(`shape · loose ${(S.get('shape.opp') || { loose: 0 }).loose.toFixed(2)} · aggr ${(S.get('shape.opp') || { aggr: 0 }).aggr.toFixed(2)} · obs ${stt.n}`);
    advance(false);
  }
  function boardText() { return S.get('board').map(c => c.r + c.s).join(' ') || '—'; }
  function advance(folded) {
    const st = S.get('street');
    if (folded) { setStreet(4); endHand('fold'); return; }
    if (st >= 3) { setStreet(4); endHand('showdown'); return; }
    setStreet(st + 1);
  }
  function setStreet(v) {
    S.cell('street', v, { silent: true });
    $('streetTag').textContent = STREETS[v];
    const b = S.get('board');
    if (v >= 1 && b.length < 3) {
      b.push({ r: RANKS[Math.floor(rnd() * 13)], s: SUITS[Math.floor(rnd() * 4)] });
      b.push({ r: RANKS[Math.floor(rnd() * 13)], s: SUITS[Math.floor(rnd() * 4)] });
      b.push({ r: RANKS[Math.floor(rnd() * 13)], s: SUITS[Math.floor(rnd() * 4)] });
    } else if (v === 2 && b.length === 3) b.push({ r: RANKS[Math.floor(rnd() * 13)], s: SUITS[Math.floor(rnd() * 4)] });
    else if (v === 3 && b.length === 4) b.push({ r: RANKS[Math.floor(rnd() * 13)], s: SUITS[Math.floor(rnd() * 4)] });
    S.cell('board', b, { silent: true });
    drawBoard();
  }
  function endHand(how) {
    const sh = S.get('shape.opp');
    if (how === 'showdown') {
      const won = persona.strength < 0.5;
      log(`<span class="sig">showdown · ${won ? 'your read held — OPP\'s line never matched a strong hand' : 'OPP tabled the goods — but the read was still correct: they played it exactly like the shape predicted'}</span>`);
      if (won) S.cell('pot', 0, { silent: true });
    }
    log(`hand ${S.get('hand')} closed · ${sh ? `final shape: loose ${sh.loose.toFixed(2)} aggr ${sh.aggr.toFixed(2)} decep ${sh.deception.toFixed(2)} (n=${sh.n})` : 'no reads'}`);
    $('heNext').disabled = true;
  }
  function newHand(first) {
    const h = first ? 1 : S.get('hand') + 1;
    persona.loose = Math.min(0.9, Math.max(0.1, persona.loose + (rnd() - 0.5) * 0.14));
    persona.aggr = Math.min(0.9, Math.max(0.1, persona.aggr + (rnd() - 0.5) * 0.14));
    persona.bluff = Math.min(0.8, Math.max(0, persona.bluff + (rnd() - 0.5) * 0.12));
    persona.strength = rnd();
    S.cell('hand', h, { silent: true });
    S.cell('street', 0, { silent: true });
    S.cell('board', [], { silent: true });
    S.cell('pot', 40, { silent: true });
    S.cell('opp.stats', { n: 0, checks: 0, calls: 0, bets: 0, raises: 0, folds: 0, sizes: [] }, { silent: true });
    $('streetTag').textContent = 'PREFLOP'; $('heNext').disabled = false;
    drawBoard(); drawRadar(null);
    $('shLoose').textContent = $('shAggr').textContent = $('shDecep').textContent = '–';
    $('shObs').textContent = '0';
    $('readBox').innerHTML = `Hand ${h}. OPP limps. No shape yet — <b>the flop is where decision-making starts to have a silhouette.</b>`;
    log(`hand ${h} · blinds 20/40 · OPP's persona drifted (they're adapting too)`);
    if (first) log(`your A♥ 9♠ barely matter — <b>the rest of the deck is in OPP's hands and on the board</b>`);
  }
  $('heNext').onclick = () => oppAct(STREETS[Math.min(3, S.get('street'))]);
  $('heHand').onclick = () => { newHand(false); };
  $('heAuto').onclick = function () {
    if (auto) { clearInterval(auto); auto = null; this.textContent = '▶ auto'; this.classList.remove('on'); return; }
    this.textContent = '⏸ auto'; this.classList.add('on');
    auto = setInterval(() => {
      const st = S.get('street');
      if (st >= 4) newHand(false); else oppAct(STREETS[Math.min(3, st)]);
    }, 1900);
  };
  newHand(true); drawHole();
})();

/* ============ DEMO 04 — The signal desk ============ */
(function () {
  const log = makeLog(document.getElementById('deskLog'), 'desk',
    { ignore: ['px', 'ema12', 'ema26', 'sigHist', 'position', 'i', 'moth.used', 'trades', 'confirm', 'signal'] });
  const S = new Sheet('desk');
  const rnd = mulberry(4242);
  const BARS = 260, BUDGET = 24;
  const $ = id => document.getElementById(id);

  // ── synthetic tape: regimes shift, volatility clusters, no peeking ahead
  let px = [], seed = 4242;
  function makeTape() {
    const r = mulberry(seed);
    px = []; let p = 100, drift = 0.0004, vol = 0.011;
    for (let i = 0; i < BARS; i++) {
      if (i % 55 === 27) drift = (r() - 0.42) * 0.0035;
      if (i % 37 === 11) vol = 0.006 + r() * 0.014;
      p *= 1 + drift + (r() - 0.5) * 2 * vol;
      px.push(p);
    }
  }
  makeTape();
  // mock quantum draws — in the real lab these are moth-quantum QRNG reads (cached, metered)
  const qrnd = mulberry(99001);
  const quantum = Array.from({ length: 40 }, () => qrnd());

  S.cell('moth.used', 0, { silent: true });
  S.cell('moth.budget', BUDGET, { silent: true });
  S.cell('trades', 0, { silent: true });
  S.cell('position', 'flat', { silent: true });
  S.def('signal', ['ema12', 'ema26'], (f, s) => (f > s ? 'long' : 'flat'));
  S.def('confirm', ['sigHist'], h => h.length >= 2 && h[h.length - 1] === 'long' && h[h.length - 2] === 'long');

  let i = 0, eq = 1, eqSeries = [], bnhSeries = [], entryPx = 0, dd = 0, peak = 1;
  let path = [], e12 = null, e26 = null, hist = [];
  let requireQuantum = true, playing = true, marker = [], done = false, qPtr = 0;
  const k = 2 / (12 + 1), k2 = 2 / (26 + 1);

  // ── the doctrine listeners: a signal PROPOSES, confirmation + quantum disposition
  S.watch('signal', (o, sig) => {
    if (o === undefined || sig === o) return;
    if (sig === 'long' && S.get('position') === 'flat' && !done) {
      if (!S.get('confirm')) { log(`signal <b>long</b> proposed · <span style="color:var(--dim)">confirm gate not satisfied yet — standing by</span>`); return; }
      if (requireQuantum) {
        const used = S.get('moth.used');
        if (used >= BUDGET) { log(`<span class="amber">moth.budget exhausted — perception unavailable, entry refused</span>`); return; }
        const draw = quantum[qPtr++ % quantum.length];
        S.cell('moth.used', used + 1, { silent: true });
        if (draw < 0.32) { log(`quantum dice <b class="violet">${draw.toFixed(2)}</b> &lt; gate 0.32 · <span class="sig">entry refused — the tape argued back (call #${used + 1})</span>`); return; }
        log(`quantum dice <b class="violet">${draw.toFixed(2)}</b> ≥ gate · <b class="violet">entry validated (call #${used + 1} of ${BUDGET})</b>`);
      }
      S.cell('position', 'long', { silent: true });
      entryPx = px[i];
      marker.push({ i, type: 'in' });
      log(`<span style="color:var(--tide)">ENTRY @ ${px[i].toFixed(2)} · signal confirmed, quantum OK</span>`);
    } else if (sig === 'flat' && S.get('position') === 'long' && !done) {
      const pnl = px[i] / entryPx - 1;
      S.cell('position', 'flat', { silent: true });
      S.cell('trades', S.get('trades') + 1, { silent: true });
      marker.push({ i, type: 'out', pnl });
      log(`<span class="sig">EXIT @ ${px[i].toFixed(2)} · trade ${pnl >= 0 ? '+' : ''}${(pnl * 100).toFixed(1)}%</span>`);
    }
  });

  function step() {
    if (i >= BARS) { if (!done) { done = true; finish(); } return; }
    const p = px[i];
    e12 = e12 === null ? p : p * k + e12 * (1 - k);
    e26 = e26 === null ? p : p * k2 + e26 * (1 - k2);
    // publish the confirmation state BEFORE the signal flips, so the doctrine
    // listener always judges a proposal against a fresh confirm cell
    const sig = e12 > e26 ? 'long' : 'flat';
    hist.push(sig); if (hist.length > 3) hist.shift();
    S.cell('sigHist', hist.slice(), { silent: true });
    S.cell('px', p, { silent: true });
    S.cell('ema12', e12, { silent: true });
    S.cell('ema26', e26, { silent: true });
    if (S.get('position') === 'long' && i > 0) eq *= p / px[i - 1];
    eqSeries.push(eq); bnhSeries.push(px[i] / px[0]);
    peak = Math.max(peak, eq); dd = Math.max(dd, 1 - eq / peak);
    path.push(p);
    i++;
    render();
    updateCells();
  }
  function finish() {
    const t = S.get('trades'), u = S.get('moth.used');
    log(`<span class="amber">tape complete · strategy ${eq.toFixed(3)} vs buy&amp;hold ${(px[BARS - 1] / px[0]).toFixed(3)} · ${t} trades · ${u} perception calls spent</span>`);
    log(`re-tape for a fresh regime — the desk never sees the same tape twice`);
  }
  function updateCells() {
    $('deskPos').textContent = S.get('position') === 'long' ? `LONG @ ${entryPx.toFixed(2)}` : 'flat';
    $('deskPos').style.color = S.get('position') === 'long' ? 'var(--tide)' : 'var(--muted)';
    const u = S.get('moth.used');
    $('mothUsed').textContent = `${u} / ${BUDGET}`;
    $('mothFill').style.width = (u / BUDGET * 100).toFixed(1) + '%';
    $('mothInsight').textContent = u ? `${(S.get('trades') / u).toFixed(2)} trades/call` : '–';
    $('kEq').textContent = eq.toFixed(3);
    $('kBnh').textContent = (px[Math.max(0, i - 1)] / px[0]).toFixed(3);
    $('kDd').textContent = (dd * 100).toFixed(1) + '%';
    $('kTrades').textContent = S.get('trades');
  }
  function render() {
    const cv = $('deskCanvas'), ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, split = H * 0.66;
    ctx.fillStyle = '#070d18'; ctx.fillRect(0, 0, W, H);
    const n = Math.max(2, path.length);
    const mn = Math.min(...path.slice(0, n)), mx = Math.max(...path.slice(0, n));
    const pad = (mx - mn) * 0.1 || 1;
    const X = j => j / (BARS - 1) * (W - 20) + 10;
    const Y = v => split - 14 - (v - mn + pad) / (mx - mn + 2 * pad) * (split - 34);
    // position shading
    let inPos = false;
    for (let j = 0; j < n; j++) {
      const want = marker.some(mk => mk.i === j && mk.type === 'in');
      const out = marker.some(mk => mk.i === j && mk.type === 'out');
      if (want) inPos = true;
      if (inPos) { ctx.fillStyle = 'rgba(63,224,197,.06)'; ctx.fillRect(X(j), 8, X(j + 1 || BARS - 1) - X(j) + 1, split - 22); }
      if (out) inPos = false;
    }
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    for (let g = 1; g < 4; g++) { ctx.beginPath(); ctx.moveTo(10, split * g / 4); ctx.lineTo(W - 10, split * g / 4); ctx.stroke(); }
    const line = (arr, color, w, dash) => {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash || []);
      for (let j = 0; j < n; j++) { const v = arr === 'px' ? path[j] : arr === 'f' ? e12s[j] : e26s[j]; j ? ctx.lineTo(X(j), Y(v)) : ctx.moveTo(X(j), Y(v)); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    // price + emas (recompute series locally for drawing)
    const e12s = [], e26s = []; let a = null, b2 = null;
    for (let j = 0; j < n; j++) {
      a = a === null ? path[j] : path[j] * k + a * (1 - k);
      b2 = b2 === null ? path[j] : path[j] * k2 + b2 * (1 - k2);
      e12s.push(a); e26s.push(b2);
    }
    line('px', 'rgba(200,212,232,.75)', 1.3);
    line('f', '#3FE0C5', 1.6);
    line('s', '#9D8CFF', 1.6);
    // markers
    for (const mk of marker) {
      if (mk.i >= n) continue;
      const x = X(mk.i), y = Y(path[mk.i]);
      ctx.fillStyle = mk.type === 'in' ? '#3FE0C5' : '#FF7A6B';
      ctx.beginPath();
      if (mk.type === 'in') { ctx.moveTo(x, y - 12); ctx.lineTo(x - 5, y - 4); ctx.lineTo(x + 5, y - 4); }
      else { ctx.moveTo(x, y + 12); ctx.lineTo(x - 5, y + 4); ctx.lineTo(x + 5, y + 4); }
      ctx.closePath(); ctx.fill();
    }
    // equity panel
    const eTop = split + 16, eH = H - eTop - 12;
    const all = [...eqSeries, ...bnhSeries];
    const emn = Math.min(...all), emx = Math.max(...all), espan = (emx - emn) || 0.1;
    const EY = v => eTop + eH - (v - emn) / espan * eH;
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(10, eTop); ctx.lineTo(W - 10, eTop); ctx.stroke();
    ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(138,150,173,.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); for (let j = 0; j < bnhSeries.length; j++) j ? ctx.lineTo(X(j), EY(bnhSeries[j])) : ctx.moveTo(X(j), EY(bnhSeries[j])); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#3FE0C5'; ctx.lineWidth = 1.8;
    ctx.beginPath(); for (let j = 0; j < eqSeries.length; j++) j ? ctx.lineTo(X(j), EY(eqSeries[j])) : ctx.moveTo(X(j), EY(eqSeries[j])); ctx.stroke();
    ctx.fillStyle = 'rgba(138,150,173,.8)'; ctx.font = '10px monospace';
    ctx.fillText('EQUITY (aqua) vs BUY&HOLD (dim)', 14, eTop + 13);
    ctx.fillStyle = 'rgba(255,196,107,.85)';
    ctx.fillText(`DD ${(dd * 100).toFixed(1)}%`, W - 66, eTop + 13);
  }
  $('deskRun').onclick = function () {
    playing = !playing;
    this.textContent = playing ? '⏸ running' : '▶ run';
    this.classList.toggle('on', playing);
  };
  $('deskRetape').onclick = () => {
    seed = 1000 + Math.floor(Math.random() * 100000); makeTape();
    i = 0; eq = 1; eqSeries = []; bnhSeries = []; dd = 0; peak = 1; path = [];
    e12 = e26 = null; hist = []; marker = []; done = false; qPtr = 0;
    S.cell('position', 'flat', { silent: true }); S.cell('trades', 0, { silent: true });
    log(`re-taped (seed ${seed}) · all cells repriced, position flat, budget kept`);
    render(); updateCells();
  };
  $('deskQuantum').onclick = function () {
    requireQuantum = !requireQuantum;
    this.textContent = requireQuantum ? 'spend a call' : 'calls: skipped';
    this.classList.toggle('amber', requireQuantum);
    log(`doctrine · entries ${requireQuantum ? '<b class="violet">require a quantum validation call</b>' : 'skip validation — <span class="amber">perception is free, for worse</span>'}`);
  };
  setInterval(() => { if (playing && !done) step(); }, 70);
  render(); updateCells();
  log(`desk online · tape ${BARS} bars · signal proposes, <b>confirm</b> disposes, quantum validates`);
})();
