// quilt-fiction/fiction/reputation.mjs — trust from observable deltas only
// (seed4 §4.3/4.4). No declarations, no identities, no central authority.
// =============================================================================
// CONSTANTS (receipted hole-fill — seed4 says "typically β > α" but fixes no
// values): ALPHA = 0.05 (hold reward), BETA = 0.5 (violation punishment,
// 10x the reward — the asymmetry IS the enforcement), EXCLUDE_BELOW = 0.1
// (seed4 §4.4's example threshold), REP_SCALE = 10^6 fixed-point (integer
// state-bearing, house determinism rule).
//
//   hold:      R += round(ALPHA * (REP_SCALE - R))
//   violation: R  = round(R * (1 - BETA))
//
// Exclusion is LOCAL: each instance applies it to its own believed_peers only.
// There is no global ban. Exclusion affects the FUTURE only: deltas accepted
// before the exclusion stay in the observer history and the receiver's ledgers
// (receipted: "exclusion only affects future").

import { REP_SCALE } from './delta.mjs';

export const ALPHA = 0.05;
export const BETA = 0.5;
export const EXCLUDE_BELOW = 100000; // 0.1 * REP_SCALE
export const REP_INIT = 500000;      // 0.5 prior trust for genesis roster peers

export function repHold(R) {
  return R + Math.round(ALPHA * (REP_SCALE - R));
}

export function repViolate(R) {
  return Math.round(R * (1 - BETA));
}

export function isExcluded(R) {
  return R < EXCLUDE_BELOW;
}

// A pure decision helper: given the current reputation map and believed peer
// list, apply this tick's verdicts ({peer, violated}) and return the updated
// map plus the peers that crossed the exclusion threshold THIS tick.
export function applyReputation(reputation, verdicts, believedPeers) {
  const rep = { ...reputation };
  const newlyExcluded = [];
  for (const { peer, violated } of verdicts) {
    const R = rep[peer] ?? REP_INIT;
    const next = violated ? repViolate(R) : repHold(R);
    rep[peer] = next;
    if (isExcluded(next) && believedPeers.includes(peer) && R >= EXCLUDE_BELOW) {
      newlyExcluded.push(peer);
    }
  }
  return { rep, newlyExcluded };
}
