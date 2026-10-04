/**
 * cell-fleet — shared cell chemistry (pure functions, no I/O)
 *
 * Wave 67 of the SuperInstance fleet. Extends quilt-organ-workers (README
 * backlog item 2, "organ-boot-bridge DO nesting") from ONE coordinator DO to a
 * whole cellular tissue: Durable Objects as cell nuclei, KV as membrane
 * transport / extracellular matrix, DO alarms as the cell cycle, and each
 * Worker isolate request as a transient RIBOSOME translating genome into
 * behavior.
 *
 * This module holds the deterministic chemistry both the isolate (ribosome)
 * and the nucleus (Cell DO) agree on:
 *   - canonicalJSON / sha256hex   — the fleet's receipt law (byte-equal with
 *     quilt-jev-toolkit canonicalJson: key-sorted, no whitespace, fail-closed)
 *   - CHANNELS                    — 8 morphogen channels, fleet vocabulary
 *     (the decomposition-atlas / organ-dialect nouns: part, gate, layer, seal,
 *     hole, receipt, idea, organ)
 *   - signalFromTask / facetSignal— task → 8-dim morphogen vector (membrane
 *     receptors); facet vectors are hash-derived from the facet STRING so a
 *     genome's learned response to a facet persists across tasks
 *   - translate()                 — the ribosome: genome × signal → behavior
 *     (a decomposition answer), pure and stateless, executed in the Worker
 *     isolate per request and never stored
 *   - rubric()                    — the environment's fitness function
 *     (selection pressure): coverage / shrinkage / uniqueness → reward 0..1
 *   - mutate()                    — gaussian genome mutation for mitosis
 *
 * No secrets, no network, no keys — pure chemistry.
 */

export const CHANNELS = ["part", "gate", "layer", "seal", "hole", "receipt", "idea", "organ"];

export const RIBOSOME_DEFAULTS = {
  MAX_PARTS: 6,      // a decomposition never splits finer than this
  KEEP_TAU: 0.5,     // facet kept iff per-facet affinity >= tau
};

export const RUBRIC_WEIGHTS = { coverage: 0.6, shrink: 0.25, uniqueness: 0.15 };

/* ------------------------------------------------------------------ *
 * canonical JSON + hashing — the fleet's receipt law, fail-closed
 * ------------------------------------------------------------------ */

function canon(v, path) {
  if (v === null) return "null";
  const t = typeof v;
  if (t === "string") return JSON.stringify(v);
  if (t === "number") {
    if (!Number.isFinite(v)) throw new Error(`canonicalJSON: non-finite number at ${path}`);
    return JSON.stringify(v);
  }
  if (t === "boolean") return v ? "true" : "false";
  if (t === "bigint" || t === "function" || t === "symbol" || t === "undefined") {
    throw new Error(`canonicalJSON: ${t} not allowed at ${path}`);
  }
  if (Array.isArray(v)) return "[" + v.map((x, i) => canon(x, `${path}[${i}]`)).join(",") + "]";
  if (t === "object") {
    const keys = Object.keys(v).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canon(v[k], `${path}.${k}`)).join(",") + "}";
  }
  throw new Error(`canonicalJSON: unsupported type ${t} at ${path}`);
}

export function canonicalJSON(value) {
  return canon(value, "$");
}

export async function sha256hex(str) {
  const bytes = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function genomeHash(genome) {
  return (await sha256hex(canonicalJSON({ w: genome.w, b: genome.b }))).slice(0, 16);
}

export function hex16() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hex8() {
  const a = new Uint8Array(4);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------------ *
 * morphogen signals — membrane receptors (deterministic from input)
 * ------------------------------------------------------------------ */

const clamp01 = (x) => Math.max(0, Math.min(1, x));

async function taskSealBit(name) {
  const h = await sha256hex("seal:" + name);
  return parseInt(h.slice(0, 2), 16) / 255;
}

/**
 * Task → 8-dim morphogen vector. Deterministic per concept so the same
 * concept always yields the same stimulus (fair selection).
 */
export async function signalFromTask(concept) {
  const facets = Array.isArray(concept.facets) ? concept.facets : [];
  const unique = new Set(facets);
  const dupes = facets.length - unique.size;
  const nameWords = String(concept.name || "").split(/\s+/).filter(Boolean).length;
  const facetWords = [...unique].join(" ").split(/\s+/).filter(Boolean).length;
  const gates = Array.isArray(concept.gates) ? concept.gates : [];
  const v = {};
  v.part = clamp01(facets.length / 8);
  v.gate = clamp01(gates.length / 4);
  v.layer = clamp01((Number.isFinite(concept.layerHint) ? concept.layerHint : 2) / 4);
  v.seal = await taskSealBit(String(concept.name || ""));
  v.hole = clamp01(dupes / 2);
  v.receipt = clamp01(String(concept.name || "").length / 24);
  v.idea = clamp01(facetWords / 16);
  v.organ = clamp01(JSON.stringify(concept).length / 512);
  return CHANNELS.map((c) => v[c]);
}

/**
 * Facet string → 8-dim receptor vector, blended with the task vector so a
 * genome generalizes within a task family while still learning per-facet
 * affinities that persist across tasks.
 */
export async function facetSignal(facet, taskVec) {
  const h = await sha256hex("morphogen:" + facet);
  const raw = [];
  for (let i = 0; i < 8; i++) raw.push(parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255);
  return CHANNELS.map((_, i) => 0.5 * raw[i] + 0.5 * taskVec[i]);
}

/* ------------------------------------------------------------------ *
 * the ribosome — genome × signal → behavior (transient, per request)
 * ------------------------------------------------------------------ */

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const dot = (a, b) => a.reduce((acc, x, i) => acc + x * b[i], 0);

export function balancedChunks(items, n) {
  const count = Math.max(1, Math.min(n, Math.max(1, items.length)));
  const parts = [];
  let idx = 0;
  for (let p = 0; p < count; p++) {
    const size = Math.floor((items.length - idx) / (count - p));
    parts.push({ id: "p" + p, facets: items.slice(idx, idx + size) });
    idx += size;
  }
  return parts;
}

/**
 * Translate a genome into a decomposition answer for a concept.
 * Runs in the Worker isolate (the transient ribosome). Pure: reads the
 * genome, writes nothing — behavior from heredity, per request.
 */
export async function translate(genome, concept, opts = {}) {
  const { MAX_PARTS, KEEP_TAU } = { ...RIBOSOME_DEFAULTS, ...opts };
  const s = await signalFromTask(concept);
  const A = sigmoid(dot(genome.w, s) + genome.b);
  const nReq = Math.max(1, Math.min(MAX_PARTS, Math.round(1 + A * (MAX_PARTS - 1))));

  const facets = Array.isArray(concept.facets) ? concept.facets : [];
  const scored = [];
  const seenOnce = new Set();
  for (const f of facets) {
    const sf = await facetSignal(f, s);
    const a = sigmoid(dot(genome.w, sf) + genome.b);
    const keep = a >= KEEP_TAU;
    // selection targets for the delta rule: first occurrence of a facet
    // SHOULD be covered (target 1); duplicate occurrences SHOULD be dropped
    // (target 0) — the environment's honest answer to messy input.
    const target = seenOnce.has(f) ? 0 : 1;
    seenOnce.add(f);
    scored.push({ facet: f, s: sf, a, keep, target });
  }

  const kept = scored.filter((x) => x.keep).map((x) => x.facet);
  const parts = balancedChunks(kept, nReq);
  const answer = {
    affinity: Number(A.toFixed(4)),
    nPartsRequested: nReq,
    keptCount: kept.length,
    dropped: scored.filter((x) => !x.keep).map((x) => ({ facet: x.facet, affinity: Number(x.a.toFixed(3)) })),
    parts,
  };
  const facetUpdates = scored.map((x) => ({ facet: x.facet, a: x.a, target: x.target, s: x.s }));
  return { answer, facetUpdates, taskVec: s, globalTarget: null /* set from reward by the caller */ };
}

/* ------------------------------------------------------------------ *
 * the rubric — environment-side fitness (selection pressure)
 * ------------------------------------------------------------------ */

export function rubric(answer, concept) {
  const facets = Array.isArray(concept.facets) ? concept.facets : [];
  const F = facets.length;
  const U = new Set(facets).size;
  const keptList = answer.parts.flatMap((p) => p.facets);
  const uniqueKept = new Set(keptList).size;
  const coverage = U === 0 ? 1 : uniqueKept / U;

  let shrink;
  if (answer.parts.length === 0) {
    shrink = 0;
  } else {
    shrink =
      answer.parts.reduce((acc, p) => {
        const sz = p.facets.length;
        if (F <= 1) return acc + (sz < F ? 1 : 0);
        return acc + clamp01((F - sz) / (F - 1));
      }, 0) / answer.parts.length;
  }

  const seen = new Set();
  let uniqueParts = 0;
  for (const p of answer.parts) {
    const key = p.facets.length === 0 ? "∅" : [...p.facets].sort().join("|");
    if (!seen.has(key)) {
      seen.add(key);
      uniqueParts++;
    }
  }
  const uniqueness = answer.parts.length === 0 ? 0 : uniqueParts / answer.parts.length;

  const reward = clamp01(
    RUBRIC_WEIGHTS.coverage * coverage +
      RUBRIC_WEIGHTS.shrink * shrink +
      RUBRIC_WEIGHTS.uniqueness * uniqueness
  );

  return {
    reward: Number(reward.toFixed(4)),
    detail: {
      coverage: Number(coverage.toFixed(3)),
      shrink: Number(shrink.toFixed(3)),
      uniqueness: Number(uniqueness.toFixed(3)),
      F,
      U,
      keptCount: keptList.length,
      uniqueKept,
      parts: answer.parts.length,
      weights: RUBRIC_WEIGHTS,
    },
  };
}

/* ------------------------------------------------------------------ *
 * mitosis — gaussian mutation (clonal variation)
 * ------------------------------------------------------------------ */

function gaussians(n, sigma) {
  // workerd: crypto.getRandomValues requires an INTEGER-typed view
  // (Float64Array throws TypeMismatchError) — draw uint32s, map to (0,1).
  const out = [];
  const buf = new Uint32Array(n * 2);
  crypto.getRandomValues(buf);
  for (let i = 0; i < n; i++) {
    const u1 = Math.max((buf[i * 2] + 0.5) / 4294967296, 1e-12);
    const u2 = (buf[i * 2 + 1] + 0.5) / 4294967296;
    out.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma);
  }
  return out;
}

export function mutateGenome(genome, sigma = 0.08) {
  const noise = gaussians(genome.w.length + 1, sigma);
  const w = genome.w.map((x, i) => Math.max(-2, Math.min(2, x + noise[i])));
  const b = Math.max(-2, Math.min(2, genome.b + noise[genome.w.length]));
  return { w, b };
}

export function randomGenome(radius = 0.55) {
  const vals = gaussians(9, radius);
  return { w: vals.slice(0, 8).map((x) => Math.max(-2, Math.min(2, x))), b: Math.max(-2, Math.min(2, vals[8] / 2)) };
}

export const round = (x, n = 3) => Number(x.toFixed(n));
