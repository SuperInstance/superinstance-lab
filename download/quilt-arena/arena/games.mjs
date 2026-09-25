// E12 — THE GAMES. Two duels reduced to formulas, played against unknown
// formulas. The game layer here is deliberately MECHANICAL (odds are public
// table stakes — computed by the referee and handed to every agent alike).
// The edge lives one layer up: reading the OTHER players' formulas from the
// moves they make. That is the poker doctrine: "your 2 cards are minor. the
// rest of the cards are the other player's ... the more your cards can fade
// into the environment as part of the game, the more you are playing the
// players."
//
//   G1 MOTHRA  — minesweeper duel. 7x7, 9 mines, alternate reveals.
//                Safe +1, mine −3. Your own risk formula is minor; the
//                opponent's AVOIDANCE pattern is a distributed sensor over
//                the hidden mines.
//   G2 WEAVER  — hearts trio. 27 cards (ranks 5..A × ♡/♠/♢), Q♠ 13, hearts
//                1 each, lowest total wins. Trick stream = flop/turn/river:
//                a developing picture of the shape of their decision-making.
//
// Every feature is PUBLIC and reconstructable by any seat (no peeking).
// Independent validators re-derive scores/winner from the raw record so the
// harness can referee the referee.

export const MINES = { W: 7, H: 7, MINES: 9, SAFE_PTS: 1, MINE_PTS: -3 };
export const HRANKS = '6789TJQKA'; // 9 ranks × 3 suits = 27 cards, 9 per hand
export const HDECK = ['H', 'S', 'D'].flatMap((s) => [...HRANKS].map((r) => s + r));

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ── G1 MOTHRA (minesweeper duel) ─────────────────────────────────────────────

export function minesNewBoard(rng) {
  const N = MINES.W * MINES.H;
  const mines = new Set();
  while (mines.size < MINES.MINES) mines.add(Math.floor(rng() * N));
  const num = new Array(N).fill(0);
  const nbrs = (i) => {
    const r = Math.floor(i / MINES.W), c = i % MINES.W, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < MINES.H && cc >= 0 && cc < MINES.W) out.push(rr * MINES.W + cc);
    }
    return out;
  };
  for (const m of mines) for (const n of nbrs(m)) num[n]++;
  return { mines: [...mines], num, nbrsOf: nbrs };
}

export function minesLegal(revealed) {
  const out = [];
  for (let i = 0; i < MINES.W * MINES.H; i++) if (!revealed[i]) out.push(i);
  return out;
}

// Public features for seat `seat` (the mover). All inputs are public state.
export function minesFeatures(board, revealed, history, seat) {
  const legal = minesLegal(revealed);
  const remainingSafe = legal.filter((i) => !board.mines.includes(i)).length;
  const remainingMines = MINES.MINES - revealed.filter((_, i) => revealed[i] && board.mines.includes(i)).length;
  const dens = remainingMines / legal.length;
  // opponent-avoidance sensor: how often the OPPONENT had this cell available
  // and chose something else (normalized by their alternatives).
  const oppTurns = history.filter((h) => h.mover !== seat);
  const avoid = new Map(legal.map((i) => [i, 0]));
  for (const t of oppTurns) {
    for (const i of t.legal) if (i !== t.picked && avoid.has(i)) avoid.set(i, (avoid.get(i) ?? 0) + 1 / t.legal.length);
  }
  const cx = (MINES.W - 1) / 2, cy = (MINES.H - 1) / 2;
  const feats = {};
  for (const i of legal) {
    const rn = board.nbrsOf(i).filter((n) => revealed[n]);
    let adj = 0, adjSum = 0;
    for (const n of rn) {
      const mineN = board.nbrsOf(n).filter((m) => revealed[m] && board.mines.includes(m)).length;
      const unknown = board.nbrsOf(n).filter((m) => !revealed[m]).length;
      const missing = board.num[n] - mineN;
      if (unknown > 0) { const p = Math.max(0, missing) / unknown; adj = Math.max(adj, p); adjSum += p; }
    }
    const r = Math.floor(i / MINES.W), c = i % MINES.W;
    feats[i] = {
      adj: +adj.toFixed(4), adjSum: +adjSum.toFixed(4),
      front: rn.length ? 1 : 0,
      info: board.nbrsOf(i).filter((n) => !revealed[n]).length,
      dens: +dens.toFixed(4), center: +(1 - (Math.abs(r - cy) + Math.abs(c - cx)) / (cx + cy)).toFixed(4),
      avoid: +clamp(oppTurns.length ? (avoid.get(i) ?? 0) / oppTurns.length : 0, 0, 1).toFixed(4),
    };
  }
  return feats;
}

export function minesScore(board, revealed) {
  let s = 0;
  for (let i = 0; i < MINES.W * MINES.H; i++) {
    if (!revealed[i]) continue;
    s += board.mines.includes(i) ? MINES.MINE_PTS : MINES.SAFE_PTS;
  }
  return s;
}

// Independent re-derivation of a full game record.
export function minesVerify(rec) {
  const board = rec.board, revealed = new Set();
  const sOf = {};
  for (const t of rec.turns) {
    if (revealed.has(t.picked)) throw new Error(`cell ${t.picked} revealed twice`);
    if (t.picked < 0 || t.picked >= 49) throw new Error(`cell ${t.picked} out of range`);
    revealed.add(t.picked);
    if (board.mines.includes(t.picked)) sOf[t.mover] = (sOf[t.mover] ?? 0) + MINES.MINE_PTS; else {
      sOf[t.mover] = (sOf[t.mover] ?? 0) + MINES.SAFE_PTS;
      if (board.num[t.picked] !== t.numShown) throw new Error(`number mismatch at ${t.picked}`);
    }
  }
  if ((sOf[rec.seats[0]] ?? 0) !== rec.scoreA) throw new Error(`scoreA mismatch: re-derived ${sOf[rec.seats[0]] ?? 0}, record ${rec.scoreA}`);
  if ((sOf[rec.seats[1]] ?? 0) !== rec.scoreB) throw new Error(`scoreB mismatch: re-derived ${sOf[rec.seats[1]] ?? 0}, record ${rec.scoreB}`);
  return true;
}

// ── G2 WEAVER (hearts trio, reduced) ─────────────────────────────────────────

export const rankOf = (c) => HRANKS.indexOf(c[1]);
export const suitOf = (c) => c[0];
export const ptsOf = (c) => (c === 'SQ' ? 13 : c[0] === 'H' ? 1 : 0);

export function heartsDeal(rng) {
  const deck = [...HDECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return [deck.slice(0, 9), deck.slice(9, 18), deck.slice(18, 27)];
}

export function heartsLegal(hand, ledSuit) {
  if (!ledSuit) return [...hand];
  const follow = hand.filter((c) => suitOf(c) === ledSuit);
  return follow.length ? follow : [...hand];
}

// Mechanical trick-winning probability — public table stakes. Hypergeometric:
// P(no unseen higher-of-suit card lands in an opponent hand), with known-void
// evidence restricting that opponent. Choice-to-duck is deliberately NOT
// modeled here: odds are mechanical; reading choices is the agents' job.
export function heartsWinp(card, seen, playedAll, voidEvidence, oppCounts, ledSuit) {
  const s = suitOf(card), r = rankOf(card);
  let unseen = HDECK.filter((c) => !seen.has(c) && !playedAll.has(c));
  const h = unseen.filter((c) => suitOf(c) === s && rankOf(c) > r).length;
  if (h === 0) return 1;
  const U = unseen.length;
  let noBeat = 1;
  let pool = U;
  for (const [p, n] of oppCounts) {
    if (n <= 0) continue;
    const knownVoid = (voidEvidence[p] ?? new Set()).has(s);
    if (knownVoid) continue; // this opponent cannot hold any suit-s card
    // P(this opponent holds none of the h higher cards out of `pool`)
    const C = (a, b) => { if (b < 0 || b > a) return 0; let x = 1; for (let i = 0; i < b; i++) x = (x * (a - i)) / (i + 1); return x; };
    const pHold = 1 - C(pool - h, n) / C(pool, n);
    noBeat *= (1 - pHold);
    pool -= n;
  }
  return clamp(noBeat, 0, 1);
}

// POV feature map for a candidate set. `seen`/`oppCounts`/`voidEvidence` are
// computed FROM A SEAT'S POINT OF VIEW by the driver — the mover knows their
// own hand, observers see the same legal set through their own unseen pool
// (that asymmetry is exactly what inference has to overcome).
// All features normalized to [0,1]: the E12 conditioning lesson — a 13-scale
// pts feature lets a 0.06 weight swing an argmax harder than a 2.0 weight on
// adj, which poisons every learner's decision space.
export function heartsFeats(candidates, ledSuit, trickPts, seen, playedAll, voidEvidence, oppCounts, aggrMean = 0.5) {
  const feats = {};
  for (const c of candidates) {
    feats[c] = {
      winp: +heartsWinp(c, seen, playedAll, voidEvidence, oppCounts, ledSuit).toFixed(4),
      pts: +(ptsOf(c) / 13).toFixed(4),
      high: +(rankOf(c) / 8).toFixed(4),
      trickPts: +(trickPts / 22).toFixed(4),
      lead: ledSuit ? 0 : 1,
      voidp: ledSuit ? 0 : +(Object.keys(voidEvidence).filter((k) => voidEvidence[k].size > 0).length / 2).toFixed(4),
      aggr: +Number(aggrMean).toFixed(4),
    };
  }
  return feats;
}

export function heartsVerify(rec) {
  // replay: follow-suit legality, trick winner, points, deal disjointness
  const all = [...rec.hands[0], ...rec.hands[1], ...rec.hands[2]];
  if (new Set(all).size !== 27) throw new Error('deal not 27 distinct cards');
  const hands = rec.hands.map((h) => new Set(h));
  let leader = rec.leader, totals = [0, 0, 0];
  for (const trick of rec.tricks) {
    if (trick.plays.length !== 3) throw new Error('trick does not have 3 plays');
    const led = suitOf(trick.plays[0].card);
    for (let i = 0; i < 3; i++) {
      const p = trick.plays[i], seat = (leader + i) % 3;
      if (p.seat !== seat) throw new Error(`seat rotation broken at trick ${trick.n}`);
      if (!hands[seat].has(p.card)) throw new Error(`seat ${seat} played card they do not hold`);
      if (i > 0 && suitOf(p.card) !== led && hands[seat].has([...hands[seat]].find((c) => suitOf(c) === led))) {
        throw new Error(`seat ${seat} failed to follow suit`);
      }
      hands[seat].delete(p.card);
    }
    let best = trick.plays[0];
    for (const p of trick.plays) if (suitOf(p.card) === led && rankOf(p.card) > rankOf(best.card)) best = p;
    if (best.seat !== trick.winner) throw new Error(`trick ${trick.n} winner mismatch`);
    totals[trick.winner] += trick.plays.reduce((a, p) => a + ptsOf(p.card), 0);
    leader = trick.winner;
  }
  for (let i = 0; i < 3; i++) if (totals[i] !== rec.totals[i]) throw new Error(`total mismatch seat ${i}`);
  return true;
}

// ── shared math ──────────────────────────────────────────────────────────────

export function softmax(scores, temp = 1) {
  const m = Math.max(...scores);
  const ex = scores.map((s) => Math.exp((s - m) / Math.max(1e-6, temp)));
  const z = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / z);
}

export function goertzel(x, k) {
  // k = cycles over the window (frequency = k / N)
  const N = x.length;
  if (N < 4) return 0;
  const w = (2 * Math.PI * k) / N, cw = Math.cos(w), coeff = 2 * cw;
  let s1 = 0, s2 = 0;
  for (const v of x) { const s = v + coeff * s1 - s2; s2 = s1; s1 = s; }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return Math.max(0, power) / N;
}
