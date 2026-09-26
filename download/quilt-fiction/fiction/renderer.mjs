// quilt-fiction/fiction/renderer.mjs — THE RENDERING ENGINE (seed4 §5–6).
// =============================================================================
// The observer's tool. It sees ONLY the public delta log (sources + deltas —
// never addressing, never beliefs, never ledgers). The quilt is inferred, not
// observed (§6.1): preprocess → correlate → cluster → infer → topology.
//
// Pipeline (§6.2, receipted instantiation):
//   1. Preprocess   align deltas per source on SENDER ticks, de-scale.
//   2. Correlation  the conservation-flow channel: for each ordered pair
//                   (a,b), correlate γ_a(s) with η_b(s+1) over the window —
//                   a contribution PRECEDES (and, in a balanced double entry,
//                   equals) the draw it funds. Lag-1, one-sided.
//   3. Clustering   weakly connected components over the inferred edges.
//   4. Graph        edge (a→b) iff n >= MIN_TICKS matched ticks and r >= R_EDGE.
//   5. Topology     V (active sources), E, components, β₁ = E − V + C.
//
// DETERMINISM (§9.3): pure function of (roster, envelopes, window, params) —
// the same log renders byte-identically in-process or as a separate process
// (CLI at the bottom). Scalability note (§8.2): the window keeps the working
// set bounded; streaming sketches are future work, receipted as a hole.

const R_EDGE = 0.6;     // one-sided flow-correlation bar (receipted)
const MIN_TICKS = 12;   // minimum matched ticks to test a pair (receipted)
const SCALE = 10000;    // de-scale for the human-readable document

function pearson(xs, ys) {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return 0;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null; // constant series: no evidence either way
  return sxy / Math.sqrt(sxx * syy);
}

export function renderQuilt({ roster, envelopes, fromTick, toTick, scope = null, rEdge = R_EDGE, minTicks = MIN_TICKS }) {
  const scopeSet = new Set(scope ?? roster);
  // 1. preprocess: per-source series on sender ticks, within the window
  const series = new Map(); // id -> Map(tick -> delta)
  for (const id of roster) series.set(id, new Map());
  for (const { from, delta } of envelopes) {
    if (!series.has(from)) continue;
    if (delta.tick < fromTick || delta.tick > toTick) continue;
    series.get(from).set(delta.tick, delta);
  }
  const active = roster.filter((id) => series.get(id).size > 0 && scopeSet.has(id));

  // 2+4. correlate + infer: directed flow edges (a→b): γ_a(s) vs η_b(s+1)
  const edges = [];
  const ids = roster.filter((id) => scopeSet.has(id));
  for (let i = 0; i < ids.length; i++) {
    for (let j = 0; j < ids.length; j++) {
      if (i === j) continue;
      const a = ids[i], b = ids[j];
      const ga = series.get(a), eb = series.get(b);
      // deterministic order: rebuild from sorted ticks
      const ticks = [...ga.keys()].sort((x, y) => x - y);
      const xs = [], ys = [];
      for (const tick of ticks) {
        const d2 = eb.get(tick + 1);
        if (d2) { xs.push(ga.get(tick).gamma_delta); ys.push(d2.eta_delta); }
      }
      if (xs.length < minTicks) continue;
      const r = pearson(xs, ys);
      if (r === null || r < rEdge) continue;
      edges.push({ from: a, to: b, r: Math.round(r * 10000) / 10000, n: xs.length });
    }
  }
  edges.sort((x, y) => (x.from === y.from ? (x.to < y.to ? -1 : 1) : x.from < y.from ? -1 : 1));

  // 3. clusters: weakly connected components over the undirected shadow
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const e of edges) parent.set(find(e.from), find(e.to));
  const clustersMap = new Map();
  for (const id of ids) {
    const root = find(id);
    if (!clustersMap.has(root)) clustersMap.set(root, []);
    clustersMap.get(root).push(id);
  }
  const clusters = [...clustersMap.values()].map((c) => c.sort()).sort((a, b) => (a[0] < b[0] ? -1 : 1));

  // 5. topology invariants
  const V = active.length;
  const E = edges.length;
  const C = clusters.length;
  const degrees = Object.fromEntries(active.map((id) => [id, edges.filter((e) => e.from === id || e.to === id).length]));

  return {
    document: 'QuiltDocument',
    generated_by: 'quilt-fiction/renderer (observer-side; sees the public delta log only)',
    window: { from: fromTick, to: toTick },
    scope: [...scopeSet].sort(),
    instances: roster.map((id) => ({
      id,
      deltas_in_window: series.get(id).size,
      last_tick: series.get(id).size ? Math.max(...series.get(id).keys()) : null,
      active: active.includes(id),
    })),
    edges,
    clusters,
    topology: { V, E, components: C, beta1: E - V + C, degree_distribution: degrees },
    timestamp: toTick,
  };
}

// CLI: node fiction/renderer.mjs <input.json> <output.json>
// input = { roster, envelopes: [{from, delta}], fromTick, toTick, scope? }
// Runs in a SEPARATE PROCESS (receipted: observer-side isolation) and must
// produce byte-identical output to the in-process render of the same input.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('renderer.mjs')) {
  const [inp, outp] = process.argv.slice(2);
  if (inp && outp) {
    const { readFileSync, writeFileSync } = await import('node:fs');
    const input = JSON.parse(readFileSync(inp, 'utf8'));
    const doc = renderQuilt(input);
    const { canonicalJSON } = await import('./delta.mjs');
    writeFileSync(outp, canonicalJSON(doc) + '\n');
    console.log(`renderer: wrote ${outp} (V=${doc.topology.V} E=${doc.topology.E} clusters=${doc.clusters.length} beta1=${doc.topology.beta1})`);
  }
}
