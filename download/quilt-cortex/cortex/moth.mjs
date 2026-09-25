// quilt-cortex/moth.mjs — quantum entropy + entanglement meter for the cortex.
// Wraps the arena vault (same portfolio tree) so experiments share ONE cache,
// ONE journal, ONE cap. If the arena tree is missing, a tiny local fallback
// vault (synthetic packets only, loudly flagged) keeps offline tests honest.

let arenaUrl = null;
try {
  // relative sibling import — both dirs always ship together in the portfolio
  arenaUrl = new URL('../../quilt-arena/arena/moth.mjs', import.meta.url).href;
  await import(arenaUrl); // probe only; real import happens in makeMoth
} catch { arenaUrl = null; }

export async function makeMoth({ key = null, cachePath = null, live = true, journal = [], ns = null } = {}) {
  if (arenaUrl) {
    const mod = await import(arenaUrl);
    const vault = new mod.MothVault({
      key,
      cachePath,
      live,
      journal,
      ns: ns || (live ? 'LIVE' : 'OFF'),
    });
    return vault;
  }
  // ---- fallback: synthetic-only vault, same surface --------------------------
  const { mulberry32 } = await import('./typesafe.mjs');
  const cache = cachePath && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  return {
    liveUsed: 0,
    journal,
    async packet(tag) {
      const rng = mulberry32(20260925 ^ [...String(tag)].reduce((a, c) => a + c.charCodeAt(0), 7));
      const floats = Array.from({ length: 32 }, () => rng());
      this.journal.push({ kind: 'packet', tag, source: 'synthetic-fallback', mock: true });
      return { floats, mock: true, source: 'synthetic-fallback' };
    },
    persist() { if (cachePath) writeFileSync(cachePath, JSON.stringify(cache)); },
  };
}

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// weightedQuantumPick — one packet, one pick. Uses the first float as the
// uniform draw over a cumulative distribution built from `weights`. True
// quantum noise offline-degrades to labeled synthetic (never silent).
export function weightedQuantumPick(floats, weights) {
  const entries = Object.entries(weights);
  if (!entries.length) throw new Error('weightedQuantumPick: no weights');
  const total = entries.reduce((a, [, w]) => a + Math.max(0, w), 0);
  if (total <= 0) return entries[0][0];
  const u = floats[0] * total;
  let acc = 0;
  for (const [k, w] of entries) {
    acc += Math.max(0, w);
    if (u <= acc) return k;
  }
  return entries[entries.length - 1][0];
}
