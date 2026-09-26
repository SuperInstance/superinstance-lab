/* ============ DEMO 01 — Ocean-as-a-Sheet ============ */
(function () {
  const COLS = 24, ROWS = 14, N = COLS * ROWS;
  const cv = document.getElementById('oceanCanvas');
  const ctx = cv.getContext('2d');
  const log = makeLog(document.getElementById('oceanLog'), 'ocean', { ignore: ['tide.gauge'] });
  const CW = cv.width / COLS, CH = cv.height / ROWS;

  const S = new Sheet('ocean');
  let h = new Float32Array(N), hp = new Float32Array(N);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) S.cell(`h.${x}.${y}`, 0, { silent: true });
  const GX = 12, GY = 7;
  S.def('tide.gauge', [`h.${GX}.${GY}`], v => v);
  let lastSurge = 0;
  S.watch('tide.gauge', (o, v) => {
    const now = performance.now();
    if (Math.abs(v) > 0.55 && now - lastSurge > 1400) {
      lastSurge = now;
      log(`<b>listener</b> · <span class="sig">tide.gauge |h| ${Math.abs(v).toFixed(2)} crossed the surge line → foam lit</span>`);
    }
  });

  const idx = (x, y) => y * COLS + x;
  function drop(x, y, amp) {
    h[idx(x, y)] += amp; hp[idx(x, y)] -= amp * 0.45;
    log(`stone dropped at (${x},${y}) · amp ${amp.toFixed(1)}`);
  }
  document.getElementById('oceanDrop').onclick = () =>
    drop(2 + Math.floor(Math.random() * (COLS - 4)), 2 + Math.floor(Math.random() * (ROWS - 4)), 1.4 * (Math.random() > .5 ? 1 : -1));

  let frame = 0, playing = true, tempo = 70, lastLog = 0, acc = 0, lastT = 0;
  function tick() {
    // damped wave: h′ = (Σhₙ)/2 − h_prev, neighbors from the CURRENT field,
    // inertia term from the PREVIOUS field — plus hard clamps so it can never blow up
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const l = h[idx(Math.max(x - 1, 0), y)], r = h[idx(Math.min(x + 1, COLS - 1), y)];
      const u = h[idx(x, Math.max(y - 1, 0))], d = h[idx(x, Math.min(y + 1, ROWS - 1))];
      let nh = ((l + r + u + d) / 2 - hp[idx(x, y)]) * 0.99;
      if (nh > 3) nh = 3; else if (nh < -3) nh = -3;
      hp[idx(x, y)] = nh;
    }
    const t = h; h = hp; hp = t;
    // engine cells follow the field (silent — 336 events/frame would drown the console)
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const c = S.cells.get(`h.${x}.${y}`); c.value = h[idx(x, y)];
    }
    // the gauge re-evaluates through the engine for real
    const g = S.cells.get('tide.gauge'); g.stale = true; S.get('tide.gauge');
    frame++;
    if (frame % 80 === 0) drop(1 + Math.floor(Math.random() * (COLS - 2)), 1 + Math.floor(Math.random() * (ROWS - 2)), (Math.random() - 0.5) * 3.2);
    if (frame - lastLog > 36) {
      lastLog = frame;
      let m = 0; for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(h[i]));
      log(`wave.tick · max|h| ${m.toFixed(2)} · ${N} cells updated`);
    }
    render();
  }
  function render() {
    ctx.fillStyle = '#070d18'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const v = h[idx(x, y)], a = Math.min(1, Math.abs(v) / 0.55);
      const px = x * CW, py = y * CH;
      if (Math.abs(v) > 0.55) ctx.fillStyle = `rgba(214,255,247,${0.3 + Math.min(0.7, (Math.abs(v) - 0.55) * 1.4)})`;
      else if (v >= 0) ctx.fillStyle = `rgba(63,224,197,${a * 0.72})`;
      else ctx.fillStyle = `rgba(46,108,190,${a * 0.66})`;
      ctx.beginPath(); ctx.roundRect(px + 1, py + 1, CW - 2, CH - 2, 3.5); ctx.fill();
      if (x === GX && y === GY) {
        ctx.strokeStyle = 'rgba(255,122,107,.85)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.roundRect(px + 1, py + 1, CW - 2, CH - 2, 3.5); ctx.stroke();
      }
    }
  }
  function loop(t) {
    const dt = Math.min(90, t - lastT || 16); lastT = t;
    if (playing) { acc += dt; if (acc >= tempo) { acc = 0; tick(); } }
    requestAnimationFrame(loop);
  }
  const playBtn = document.getElementById('oceanPlay');
  playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? '⏸ flowing' : '▶ flow'; playBtn.classList.toggle('on', playing); };
  document.getElementById('oceanSpeed').oninput = e => { tempo = [120, 95, 70, 52, 38][e.target.value - 1]; };
  setInterval(() => { const g = S.get('tide.gauge'); if (typeof g === 'number') document.getElementById('oceanGauge').textContent = `h = ${g.toFixed(2)} · cell D7`; }, 120);
  drop(6, 4, 1.6); drop(18, 9, -1.3);
  requestAnimationFrame(loop);
})();

/* ============ DEMO 02 — Reversi, self-playing ============ */
(function () {
  const log = makeLog(document.getElementById('revLog'), 'reversi',
    { ignore: ['pick', 'score.tide', 'score.terra', 'tide.wpos', 'board'] });
  const S = new Sheet('reversi');
  const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  const name = i => 'abcdefgh'[i % 8] + (Math.floor(i / 8) + 1);
  const ix = (x, y) => y * 8 + x;

  function freshBoard() { const b = new Array(64).fill(0); b[ix(3,3)] = 2; b[ix(4,4)] = 2; b[ix(3,4)] = 1; b[ix(4,3)] = 1; return b; }
  const START_W = (() => {
    const w = new Array(64).fill(6);
    [[0,0],[7,0],[0,7],[7,7]].forEach(([x,y]) => w[ix(x,y)] = 42);
    for (let i = 1; i < 7; i++) { w[ix(i,0)] = 14; w[ix(i,7)] = 14; w[ix(0,i)] = 14; w[ix(7,i)] = 14; }
    [[1,1],[6,1],[1,6],[6,6]].forEach(([x,y]) => w[ix(x,y)] = 1);
    [[1,0],[0,1],[6,0],[7,1],[0,6],[1,7],[6,7],[7,6]].forEach(([x,y]) => w[ix(x,y)] = 2);
    return w;
  })();

  // ── the agents' weights are plain value cells — visible, editable, improvable
  S.cell('tide.wpos', START_W.slice(), { silent: true });
  S.cell('terra.wmob', { flips: 2.2, mobility: 1.5, jitter: 1.2 }, { silent: true });
  S.cell('board', freshBoard(), { silent: true });
  S.cell('turn', 1, { silent: true });
  S.cell('seq', 0, { silent: true });
  S.def('score.tide', ['board'], b => b.reduce((a, v) => a + (v === 1 ? 1 : 0), 0));
  S.def('score.terra', ['board'], b => b.reduce((a, v) => a + (v === 2 ? 1 : 0), 0));

  function flipsFor(b, i, who) {
    if (b[i] !== 0) return null;
    const x = i % 8, y = Math.floor(i / 8), opp = 3 - who, out = [];
    for (const [dx, dy] of DIRS) {
      const line = []; let cx = x + dx, cy = y + dy;
      while (cx >= 0 && cx < 8 && cy >= 0 && cy < 8 && b[ix(cx, cy)] === opp) { line.push(ix(cx, cy)); cx += dx; cy += dy; }
      if (line.length && cx >= 0 && cx < 8 && cy >= 0 && cy < 8 && b[ix(cx, cy)] === who) out.push(...line);
    }
    return out.length ? out : null;
  }
  function legals(b, who) { const L = []; for (let i = 0; i < 64; i++) { const f = flipsFor(b, i, who); if (f) L.push({ i, flips: f }); } return L; }
  const CORNERS = [0, 7, 56, 63];

  // ── pick: the FORMULA the whole game hangs on — re-evaluates on every board/turn/weight change
  const rnd = mulberry(20260925);
  S.def('pick', ['board', 'turn', 'tide.wpos', 'terra.wmob'], (b, turn, wpos, wmob) => {
    const seq = S.get('seq') + 1;
    const mine = legals(b, turn);
    if (!mine.length) {
      const theirs = legals(b, 3 - turn);
      if (!theirs.length) {
        const t = b.reduce((a, v) => a + (v === 1 ? 1 : 0), 0), r = b.reduce((a, v) => a + (v === 2 ? 1 : 0), 0);
        return { type: 'end', tide: t, terra: r };
      }
      return { type: 'pass', who: turn, seq };
    }
    let best = null, bestS = -1e9;
    for (const m of mine) {
      let s;
      if (turn === 1) s = wpos[m.i] * 0.9 + m.flips.length * 2 + (CORNERS.includes(m.i) ? 24 : 0) + rnd() * 1.1;
      else {
        const nb = b.slice(); nb[m.i] = 2; m.flips.forEach(f => nb[f] = 2);
        s = m.flips.length * wmob.flips + (8 - legals(nb, 1).length) * wmob.mobility + rnd() * wmob.jitter;
      }
      if (s > bestS) { bestS = s; best = m; }
    }
    return { type: 'move', i: best.i, flips: best.flips, who: turn, seq };
  });

  // ── apply-move: the LISTENER that makes the sheet play itself
  let appliedSeq = 0, games = 0, paused = false, pending = null, lastIdx = -1, schedToken = 0, endLock = false, lastResult = '—';
  const delay = () => 700 / +document.getElementById('revSpeed').value;
  S.watch('pick', (o, pick) => {
    if (paused) { pending = pick; return; }
    schedule(pick);
  });
  function schedule(pick) {
    if (!pick || endLock) return;
    if (pick.type === 'move' && pick.seq > appliedSeq) {
      const tk = ++schedToken;
      setTimeout(() => { if (tk === schedToken && !paused) apply(pick); }, delay());
    } else if (pick.type === 'pass') {
      const tk = ++schedToken;
      log(`pass — ${pick.who === 1 ? 'TIDE' : 'TERRA'} has no move`);
      setTimeout(() => {
        if (tk === schedToken && !paused) { appliedSeq = Math.max(appliedSeq, pick.seq); S.cell('turn', 3 - pick.who, { silent: true }); }
      }, delay());
    } else if (pick.type === 'end') {
      const tk = ++schedToken;
      setTimeout(() => { if (tk === schedToken && !paused) endGame(pick); }, delay() + 250);
    }
  }
  function apply(pick) {
    appliedSeq = pick.seq;
    const b = S.get('board').slice();
    b[pick.i] = pick.who; pick.flips.forEach(f => b[f] = pick.who);
    lastIdx = pick.i;
    S.cell('board', b, { silent: true });
    S.cell('seq', pick.seq, { silent: true });
    log(`<b>${pick.who === 1 ? 'TIDE' : 'TERRA'}</b> ${name(pick.i)} · flips ${pick.flips.length} · ${S.get('score.tide')}:${S.get('score.terra')}`);
    let next = 3 - pick.who;
    if (!legals(b, next).length) next = pick.who;
    S.cell('turn', next, { silent: true });
    render();
  }
  function endGame(pick) {
    if (endLock) return;
    endLock = true;
    games++;
    lastResult = `${pick.tide} — ${pick.terra}`;
    const tideWon = pick.tide > pick.terra;
    // ── the learning loop: TIDE's weight cells drift toward whatever the winner occupied
    const w = S.get('tide.wpos').slice(), b = S.get('board');
    const winner = tideWon ? 1 : 2;
    for (let i = 0; i < 64; i++) {
      w[i] = w[i] * 0.985 + (b[i] === winner ? 1.1 : b[i] === 3 - winner ? -0.5 : 0);
      w[i] = Math.max(0.5, Math.min(60, w[i]));
    }
    S.cell('tide.wpos', w, { silent: true });
    const wm = { ...S.get('terra.wmob') };
    if (!tideWon) wm.flips = Math.min(4, wm.flips + 0.08); else wm.mobility = Math.min(2.6, wm.mobility + 0.08);
    S.cell('terra.wmob', wm, { silent: true });
    drawWeights();
    log(`<span class="sig">GAME ${games} · TIDE ${pick.tide} — ${pick.terra} TERRA · the loser's weight cells absorb the lesson</span>`);
    setTimeout(() => {
      S.cell('board', freshBoard(), { silent: true });
      S.cell('turn', 1, { silent: true });
      S.cell('seq', 0, { silent: true });
      appliedSeq = 0; lastIdx = -1; endLock = false;
      log(`new deal · weights drifted, board reset`);
      render();
    }, 1600);
  }
  document.getElementById('revPause').onclick = function () {
    paused = !paused;
    this.textContent = paused ? '▶ playing' : '⏸ playing';
    this.classList.toggle('on', !paused);
    if (!paused && pending) { const p = pending; pending = null; schedule(p); }
  };

  // ── rendering
  const boardEl = document.getElementById('reversiBoard');
  const squares = [];
  for (let i = 0; i < 64; i++) { const d = document.createElement('div'); d.className = 'sq'; boardEl.appendChild(d); squares.push(d); }
  function render() {
    const b = S.get('board'), turn = S.get('turn');
    const legal = legals(b, turn).map(m => m.i);
    for (let i = 0; i < 64; i++) {
      const sq = squares[i], v = b[i];
      sq.className = 'sq' + (legal.includes(i) ? ' legal' : '') + (i === lastIdx ? ' last' : '');
      let disc = sq.querySelector('.disc');
      if (v && !disc) { disc = document.createElement('div'); sq.appendChild(disc); }
      if (!v && disc) disc.remove();
      if (v) disc.className = 'disc ' + (v === 1 ? 'B' : 'W');
    }
    document.getElementById('revScoreB').textContent = S.get('score.tide');
    document.getElementById('revScoreW').textContent = S.get('score.terra');
    document.getElementById('revTurnTag').textContent = (turn === 1 ? 'TIDE' : 'TERRA') + ' to move';
    document.getElementById('revGames').textContent = `games played: ${games} · last result ${lastResult}`;
  }
  const wcv = document.getElementById('revWeights'), wctx = wcv.getContext('2d');
  function drawWeights() {
    const w = S.get('tide.wpos');
    let mn = 1e9, mx = -1e9; w.forEach(v => { mn = Math.min(mn, v); mx = Math.max(mx, v); });
    const span = Math.max(1e-6, mx - mn), cell = wcv.width / 8;
    wctx.fillStyle = '#0a1120'; wctx.fillRect(0, 0, wcv.width, wcv.height);
    for (let i = 0; i < 64; i++) {
      const t = (w[i] - mn) / span;
      wctx.fillStyle = `rgba(${Math.round(20 + t * 43)},${Math.round(30 + t * 194)},${Math.round(46 + t * 151)},${0.25 + t * 0.75})`;
      wctx.beginPath();
      wctx.roundRect((i % 8) * cell + 1.5, Math.floor(i / 8) * cell + 1.5, cell - 3, cell - 3, 4);
      wctx.fill();
    }
  }
  drawWeights(); render();
  log(`sheet online · <b>pick</b> formula watching board + 2 weight maps · listener applies every move`);
  // the initial pick was evaluated before this listener existed — kick the chain alive
  schedule(S.get('pick'));
})();
