// w66_gatesweep.mjs — wave-66 round 2: the jevs walk the layers of logic.
//
// For every decomposition part in the atlas (29 works), the gate (if any) is
// judged by the ExoJ field: soft deformations (never collapsed) for concrete
// gates; explicit, recorded, LOCAL observation only at holes (missing gates,
// missing layers) — the ExoJ law: collapse is where the truth was.
//
// DECISION RULES — pre-registered here, receipted BEFORE the sweep runs:
//   R1 OPEN  : gate non-empty AND gate_kind non-null
//              -> jevEmit(g=0.75, e=0.25, d=0.50) tag "gate:<part_id>"
//   R2 SOFT  : gate non-empty AND gate_kind null
//              -> jevEmit(g=0.50, e=0.50, d=0.50)
//   R3 HOLE  : gate empty/null
//              -> observe(definite d=0.20)  [explicit local collapse]
//   R4 SEAL  : gate_kind in {seal, conservation}
//              -> extra reinforcing emit (g=0.85, e=0.15, d=0.50)
//   R5 LAYERHOLE: work missing any layer 0..4
//              -> observe at that layer's cell after the walk
//   R6 THIN  : work has < 5 gated parts
//              -> warning emit (g=0.35, e=0.65, d=0.50)
//
// Geometry: works sorted (family, work); index i -> column q=(i%7)-3;
// layer L -> r=L-2; field radius 6 (max hex dist 5 <= 6). Policy 'ledger'
// (the naturality fix established in exoj e_x1/e_x2).
import { ExoJ, GENESIS } from '/home/z/my-project/exoj/core.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const ATLAS = '/home/z/my-project/download/decomposition-atlas';
const corpus = JSON.parse(readFileSync(`${ATLAS}/corpus.json`, 'utf8'));
const works = corpus.works.slice().sort((a, b) => a.family.localeCompare(b.family) || a.work.localeCompare(b.work));

const ts = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const receiptRows = [];
const receipt = (work, event, detail) => {
  receiptRows.push({ ts: ts(), lane: '66-g', work, event, detail });
  console.log(`[receipt] ${work} ${event}: ${detail}`);
};

// ---- pre-registration FIRST (doctrine: decision rules before the run) ----
const RULES = {
  R1_OPEN: 'gate non-empty AND gate_kind non-null -> emit(g=0.75,e=0.25,d=0.50)',
  R2_SOFT: 'gate non-empty AND gate_kind null -> emit(g=0.50,e=0.50,d=0.50)',
  R3_HOLE: 'gate empty/null -> observe(d=0.20) explicit local collapse',
  R4_SEAL: 'gate_kind in {seal,conservation} -> extra emit(g=0.85,e=0.15,d=0.50)',
  R5_LAYERHOLE: 'work missing any layer 0..4 -> observe at that layer cell',
  R6_THIN: 'work with <5 gated parts -> warning emit(g=0.35,e=0.65,d=0.50)',
  geometry: 'work i -> q=(i%7)-3 ; layer L -> r=L-2 ; radius 6 ; policy ledger',
  backend: 'atlas-sweep (deterministic structural judgment; no LLM, no network)',
};
receipt('PRE-REGISTER', 'rules', JSON.stringify(RULES));

const field = new ExoJ('atlas-gatesweep', 6, 'ledger');
field.attend('keeper');
field.attend('jev-sweep');

const BACKEND = 'atlas-sweep';
const gateKindHist = {};
const layerHist = [0, 0, 0, 0, 0];
const workReports = [];
let totParts = 0, totGated = 0, totOpen = 0, totSoft = 0, totHole = 0;

for (let i = 0; i < works.length; i++) {
  const w = works[i];
  const f = `${ATLAS}/parts/${w.family}/${w.work}.json`;
  if (!existsSync(f)) { receipt(w.work, 'negative', 'decomposition file missing'); continue; }
  const d = JSON.parse(readFileSync(f, 'utf8'));
  const q = (i % 7) - 3;
  const v = { OPEN: 0, SOFT: 0, HOLE: 0, seal_reinforce: 0 };
  const layerSeen = [false, false, false, false, false];
  const verdicts = [];
  totParts += d.parts.length;

  for (const L of [0, 1, 2, 3, 4]) {
    const parts = d.parts.filter(p => p.layer === L);
    if (parts.length) layerSeen[L] = true;
    for (const p of parts) {
      layerHist[L] += 1;
      const kk = p.gate_kind && String(p.gate_kind).trim();
      if (kk) gateKindHist[kk] = (gateKindHist[kk] || 0) + 1;
      const hasGate = p.gate && String(p.gate).trim().length > 0;
      let verdict;
      if (hasGate && kk) {
        verdict = 'OPEN'; v.OPEN += 1; totGated += 1; totOpen += 1;
        field.jevEmit(q, L - 2, 0.75, 0.25, 0.50, { tag: `gate:${p.part_id}`, backend: BACKEND });
        if (kk === 'seal' || kk === 'conservation') {
          v.seal_reinforce += 1;
          field.jevEmit(q, L - 2, 0.85, 0.15, 0.50, { tag: `seal:${p.part_id}`, backend: BACKEND });
        }
      } else if (hasGate && !kk) {
        verdict = 'SOFT'; v.SOFT += 1; totGated += 1; totSoft += 1;
        field.jevEmit(q, L - 2, 0.50, 0.50, 0.50, { tag: `soft:${p.part_id}`, backend: BACKEND });
      } else {
        verdict = 'HOLE'; v.HOLE += 1; totHole += 1;
        field.observe(q, L - 2, 0.20);
      }
      verdicts.push({ part_id: p.part_id, layer: L, verdict });
    }
  }

  // R5 layer holes
  const missingLayers = [];
  for (let L = 0; L < 5; L++) if (!layerSeen[L]) { missingLayers.push(L); field.observe(q, L - 2, 0.20); }
  // R6 thin guard
  if (v.OPEN + v.SOFT < 5) field.jevEmit(q, 0, 0.35, 0.65, 0.50, { tag: `thin:${w.work}`, backend: BACKEND });

  const s = field.sense();
  const cov = layerSeen.map(b => (b ? 1 : 0));
  const fmCount = d.parts.filter(p => p.failure_mode).length;
  workReports.push({
    work: w.work, family: w.family, q,
    verdicts: v, layer_coverage: cov, missing_layers: missingLayers,
    failure_mode_parts: fmCount,
    smoke: d.smoke ? d.smoke.verdict : 'unknown',
    sense_at_close: { prob_open: Math.round(s.prob_open * 1e4) / 1e4, zone: Math.round(s.zone * 1e4) / 1e4, active: s.active },
  });
  receipt(w.work, 'swept',
    `parts=${d.parts.length} OPEN=${v.OPEN} SOFT=${v.SOFT} HOLE=${v.HOLE} seal2x=${v.seal_reinforce} missingLayers=[${missingLayers}] fm=${fmCount}`);
}

// ---- close the field, verify, persist ----
const sense = field.sense();
const verify = field.verifyChain();
mkdirSync(`${ATLAS}/gates`, { recursive: true });
field.save(`${ATLAS}/gates/sweep_field.json`);

const gateMap = {
  format: 'atlas-gatesweep-v1',
  date: ts(),
  rules_pre_registered: RULES,
  field: { name: field.name, policy: field.policy, radius: field.radius, genesis: GENESIS },
  totals: {
    works: works.length, parts: totParts, gated: totGated,
    OPEN: totOpen, SOFT: totSoft, HOLE: totHole,
    gated_pct: Math.round((100 * totGated) / totParts * 10) / 10,
    gate_kind_histogram: gateKindHist,
    layer_histogram: layerHist,
    deformations: sense.deformations, observations: sense.observations,
    prob_open: Math.round(sense.prob_open * 1e4) / 1e4,
    zone: Math.round(sense.zone * 1e4) / 1e4,
    chain_tip: field.chain_tip,
    chain_verify: verify,
  },
  works: workReports,
};
writeFileSync(`${ATLAS}/gates/gate-map.json`, JSON.stringify(gateMap, null, 2));

receipt('POST-RUN', 'aggregate', JSON.stringify(gateMap.totals));
receipt('POST-RUN', 'verify', `chain ok=${verify.ok} links=${verify.links} tip=${verify.tip}`);
writeFileSync(`${ATLAS}/receipts/gatesweep-66-g.jsonl`, receiptRows.map(r => JSON.stringify(r)).join('\n') + '\n');

// console summary
console.log('\n=== GATE SWEEP SUMMARY ===');
for (const wr of workReports) {
  console.log(`${wr.work.padEnd(24)} ${wr.family.padEnd(9)} O/S/H=${wr.verdicts.OPEN}/${wr.verdicts.SOFT}/${wr.verdicts.HOLE} cov=${wr.layer_coverage.join('')} prob_open=${wr.sense_at_close.prob_open} smoke=${wr.smoke}`);
}
console.log('totals:', JSON.stringify(gateMap.totals, null, 2));
if (!verify.ok) { console.error('CHAIN VERIFY FAILED'); process.exit(1); }
