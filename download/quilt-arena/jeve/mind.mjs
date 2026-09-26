// jeve/mind.mjs — the FIFTH rival mind: JEVE.
//
// Controlled-comparison design: JEVE's sheet is the LIN-family contract
// (same styles, same 14 derived weights, same inf.predict/inf.update
// opponent models, same learn.revise script-writer) — so recovery accuracy
// measures the DECISION SURFACE, not different plumbing. What changes:
//
//   1. act.choose never spends on its own; it publishes its candidate
//      scores + margin (the sheet's own "opinion distribution").
//   2. The driver consults the TypeSafe System One ONE-PASS only when the
//      sheet is DOUBT-THIN (margin below threshold) — attention by
//      uncertainty. One batch = move choice + pressure score + worth noul
//      (the MOTH purchase gate, replacing the fixed budget reflex).
//   3. The final pick blends the sheet softmax with jev's calibrated
//      distribution (soft posterior, never a hard argmax override).
//   4. The calibration delta nudges style cells (rate-limited, receipted)
//      — the mind literally learns toward calibrated judgment.
//   5. The per-SET revision is ONE jev batch (family/drift/explore) mapped
//      onto the arena's A–E letter doctrine — the analyst, one-passed.

import { buildAgentCells, FAMILIES, STYLE_KEYS, MW_FEATS, HW_FEATS } from '../arena/minds.mjs';

export const JEVE_ID = 'p4';

// ── JEVE act.choose: score + publish, never self-spend ───────────────────────
const JEV_CHOOSE = `
  const gv = async (id) => (await runtime.get(id)).data;
  const featScore = (f, w) => { let s = 0; for (const k in f) s += (w[k] ?? 0) * f[k]; return s; };
  const softmax = (xs, t) => { t = t || 1; const m = Math.max(...xs);
    const ex = xs.map((x) => Math.exp((x - m) / Math.max(1e-6, t)));
    const z = ex.reduce((a, b) => a + b, 0); return ex.map((e) => e / z); };
  const wmap = { mines: { adj: 'mw.adj', adjSum: 'mw.adjSum', front: 'mw.front', info: 'mw.info', dens: 'mw.dens', center: 'mw.center', avoid: 'mw.avoid' },
                 hearts: { winp: 'hw.winp', pts: 'hw.pts', high: 'hw.high', trickPts: 'hw.trickPts', lead: 'hw.lead', voidp: 'hw.voidp', aggr: 'hw.aggr' } };
  const readW = async (game) => { const w = {}; for (const f in wmap[game]) { const c = await gv(wmap[game][f]); w[f] = c ?? 0; } return w; };
  const game = input.game;
  const feats = input.feats, ids = Object.keys(feats);
  const w = await readW(game);
  const entries = ids.map((id) => ({ id, s: featScore(feats[id], w) })).sort((a, b) => b.s - a.s);
  const margin = entries[0].s - (entries[1] ? entries[1].s : 0);
  const cur = (await gv('st.curiosity')) ?? 0;
  const temp = 0.35 + Math.max(0, Math.min(1, (cur + 1) / 2)) * 0.5;
  const top = entries.slice(0, Math.min(6, entries.length));
  const probs = softmax(top.map((e) => e.s), temp);
  // JEVE never spends by itself — the driver owns the doubt economy.
  // Publish the opinion distribution so the driver can blend with System One.
  return {
    pick: entries[0].id, spend: 0,
    think: 'jeve argmax m=' + margin.toFixed(3) + ' T=' + temp.toFixed(2) + ' (awaiting doubt consult)',
    entries: top.map((e, i) => ({ id: String(e.id), s: +e.s.toFixed(4), p: +probs[i].toFixed(4) })),
    margin: +margin.toFixed(4), temp,
  };
`;

export function buildJevCells(aid = JEVE_ID) {
  // LIN contract as the base (identical inf.* machinery for fair comparison)
  const cells = buildAgentCells(aid, 'LIN');
  // swap the decision surface
  const i = cells.findIndex((c) => c.id === 'act.choose');
  cells[i] = { id: 'act.choose', kind: 'program', code: JEV_CHOOSE, description: 'JEVE: score + publish opinion distribution (driver owns the doubt economy)' };
  // System One bookkeeping cells (visible, receipted)
  cells.push({ id: 'jev.calls', kind: 'value', value: 0, description: 'System One one-pass calls consumed (live+mock)' });
  cells.push({ id: 'jev.live', kind: 'value', value: 0, description: 'live System One calls consumed' });
  cells.push({ id: 'jev.mae', kind: 'value', value: null, description: 'last calibration MAE (sheet opinion vs jev distribution)' });
  cells.push({ id: 'jev.journal', kind: 'value', value: [], description: 'System One receipts: {tag, gate, blend, mae, mock}' });
  cells.push({ id: 'jev.explore', kind: 'value', value: null, description: 'per-set explore noul (gates MOTH purchases)' });
  return cells;
}

export function buildJevSheet(aid = JEVE_ID) {
  return { id: aid, title: `JEVE mind (${aid}) — System One decision surface`, cells: buildJevCells(aid) };
}

// ── driver-side blending helpers (pure, testable) ────────────────────────────
export function blendDistributions(sheetEntries, jevDist, alpha = 0.5) {
  const out = {};
  const ids = new Set([...sheetEntries.map(e => e.id), ...Object.keys(jevDist || {})]);
  for (const id of ids) {
    const sp = sheetEntries.find(e => e.id === id)?.p ?? 0;
    const jp = jevDist[id] ?? 0;
    out[id] = alpha * jp + (1 - alpha) * sp;
  }
  const z = Object.values(out).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(out)) out[k] = +(out[k] / z).toFixed(4);
  return out;
}

export function argmaxDist(dist) {
  return Object.entries(dist).sort((a, b) => b[1] - a[1])[0][0];
}

// calibration delta between sheet opinion and jev distribution → style nudges.
// jev wanting MORE variance across options = curiosity; jev favoring "avoid"
// features = fear; jev top pick matching social-weighted score = social.
export function styleNudgeFromDelta(sheetDist, jevDist, lr = 0.04) {
  const keys = new Set([...Object.keys(sheetDist), ...Object.keys(jevDist)]);
  let dAbs = 0, sheetSpread = 0, jevSpread = 0;
  const sv = Object.values(sheetDist), jv = Object.values(jevDist);
  const spread = (v) => Math.max(...v) - Math.min(...v) / Math.max(1e-9, v.length);
  sheetSpread = Math.max(...sv) - Math.min(...sv);
  jevSpread = Math.max(...jv) - Math.min(...jv);
  for (const k of keys) dAbs += Math.abs((jevDist[k] || 0) - (sheetDist[k] || 0));
  const mae = dAbs / Math.max(1, keys.size);
  return {
    mae: +mae.toFixed(4),
    nudges: {
      curiosity: +lr * (jevSpread - sheetSpread) * 4,   // jev sharper → curious less, jev flatter → explore more
      fear: +lr * mae * 2,                              // disagreement is information → respect danger a bit more
      social: +lr * ((jevDist['avoid'] ?? 0) - (sheetDist['avoid'] ?? 0)) * 6,
    },
  };
}
