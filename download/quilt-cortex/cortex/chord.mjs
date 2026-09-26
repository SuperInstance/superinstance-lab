// quilt-cortex/chord.mjs — THE CHORD: the three-layer decision spine.
//
// Doctrine (born from jev-quilt's five laws + E11/E12 field lessons):
//   1. PROPOSE in one pass    — System One (typesafe) answers ALL decision
//      questions in a single parallel call with calibrated distributions.
//   2. ESCALATE BY DOUBT      — viability is a floor (jev law 5). Confident
//      verdicts cost ZERO extra tokens; only doubt buys deep thought
//      (System Two / GLM reviews, seeing the full distribution).
//   3. TIE-BREAK WITH QUANTUM — when two options sit within ε, the choice
//      is informationally dead: let true entropy (MOTH packet, weighted by
//      the distribution itself) break it. Receipted, measured, labeled.
//   4. BOOK EVERYTHING        — every chord books a witness row (fnv1a64
//      chain): state_hash, distribution, gate path, latency, tokens, sources.
//
// This is the "attention by uncertainty" economy: expensive thought is spent
// exactly where the fast mind is unsure. Mechanical odds never touch tokens.

import { fnv1a64, sealChain } from './receipts.mjs';
import { weightedQuantumPick } from './moth.mjs';

export const DEFAULT_FLOORS = {
  accept: 0.55,   // p_max >= accept → fast accept, no System Two
  doubt: 0.35,    // p_max <  doubt  → mandatory System Two review
  gap: 0.05,      // top-2 within gap → quantum tie-break
};

function rank(dist) {
  return Object.entries(dist).sort((a, b) => b[1] - a[1]);
}

export function makeChord({ jev, moth = null, glm = null, chain = [], floors = {}, journal = [] } = {}) {
  const F = { ...DEFAULT_FLOORS, ...floors };
  let seq = chain.length;

  async function chordVerdict({
    state, instructions, criteria, tag = null, extra = {},
    ownDist = null, model = 'jev-latest',
  }) {
    const t0 = Date.now();
    const questions = {
      action: { type: 'choice', instructions, criteria },
      ...extra,
    };
    const { answers, usage, source, mock, model: modelGot } =
      await jev.decide(state, questions, { model, tag });

    const dist = answers.action.probabilities;
    const ranked = rank(dist);
    const [top, pTop] = ranked[0];
    const second = ranked[1];
    const gap = second ? pTop - second[1] : 1;

    // ---- GATE (viability floor) -------------------------------------------
    let gate, sysTwo = null, tiebreak = null;
    if (pTop >= F.accept) {
      gate = 'fast-accept';
    } else if (pTop < F.doubt) {
      gate = 'escalated';
      if (glm) {
        sysTwo = await glm.review({ state, distribution: dist, instructions, criteria });
        if (sysTwo.choice && dist[sysTwo.choice] !== undefined && sysTwo.choice !== top) {
          gate = 'overruled'; // System Two may reorder — receipt shows the chord, not a dictatorship
        }
      }
    } else {
      gate = 'flagged'; // proceed, but the receipt carries the hesitation
    }

    // ---- QUANTUM TIE-BREAK --------------------------------------------------
    let finalChoice = gate === 'overruled' && sysTwo?.choice ? sysTwo.choice : top;
    if (second && gap < F.gap && moth) {
      const pkt = await moth.packet(tag ? `chord:${tag}` : 'chord:tie');
      tiebreak = {
        tied: [top, second[0]], gap: +gap.toFixed(4),
        pick: weightedQuantumPick(pkt.floats, { [top]: pTop, [second[0]]: second[1] }),
        mock: pkt.mock,
      };
      if (tiebreak.pick !== finalChoice) gate = 'tie-broken';
      finalChoice = tiebreak.pick;
    }

    // ---- CALIBRATION DELTA (the learning signal) ---------------------------
    let calib = null;
    if (ownDist) {
      const keys = new Set([...Object.keys(ownDist), ...Object.keys(dist)]);
      const delta = {};
      for (const k of keys) delta[k] = +(((dist[k] || 0) - (ownDist[k] || 0)).toFixed(4));
      const mae = Object.values(delta).reduce((a, b) => a + Math.abs(b), 0) / Math.max(1, keys.size);
      calib = { delta, mae: +mae.toFixed(4) };
    }

    // ---- BOOK THE ROW -------------------------------------------------------
    const row = {
      seq: ++seq, kind: 'chord', tag,
      state_hash: fnv1a64(state).slice(0, 10),
      dist, choice: finalChoice, p: pTop, gate,
      sysTwo: sysTwo ? { choice: sysTwo.choice, why: sysTwo.why?.slice(0, 160), source: sysTwo.source } : null,
      tiebreak,
      calib,
      latency_ms: Date.now() - t0,
      tokens: usage, source, mock, model: modelGot,
      at: new Date().toISOString(),
    };
    chain.push(row);
    sealChain(chain);
    journal.push({ kind: 'chord', tag, gate, choice: finalChoice, source });
    return row;
  }

  return { chordVerdict, chain, floors: F, get seq() { return seq; } };
}

// Convenience: build a GLM System-Two reviewer with graceful offline fallback.
// glm is injected by experiments (z-ai sdk lives in quilt-lab's node_modules);
// without it the reviewer is a deterministic hash-picked stance, LABELED mock.
export function offlineReviewer(seed = 7) {
  return {
    source: 'offline-heuristic', mock: true,
    async review({ state, distribution }) {
      const ranked = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
      // deterministic "second thought": pick the runner-up if the state hash is even-ish
      const h = parseInt(fnv1a64(state).slice(2, 8), 16) % 100;
      const pick = h % 3 === 0 && ranked[1] ? ranked[1][0] : ranked[0][0];
      return { choice: pick, why: `offline reviewer (hash ${h}%3) — labeled stand-in for System Two`, source: this.source, mock: true, seed };
    },
  };
}
