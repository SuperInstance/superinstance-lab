// quilt-fiction/experiments/smoke_ef1.mjs — E-F1's own smoke (separate from the seedbox smoke.mjs,
// which stays untouched with its 3-check contract). Verifies the E-F1 machinery, verdicts, receipt
// chain discipline (decision rules before results), paired-worlds identity, and replay determinism.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  C_SCALED, ALPHA, ALPHA_SYMMETRIC, BETA, REP_INIT, EXCLUDE_BELOW,
  conservationVerdict, repHold, repViolate, isExcluded,
  makeDelta, verifyDelta, tamperDelta, ownTick, makeInstance,
  runAll, runMixedWorld, verifyChain,
} from './e_f1_deltas.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name); } };

// 1. Conservation boundary exact at the scaled integers (quilt-dba-consistent C = 1585)
ok(conservationVerdict(1000, 585).verdict === 'ok' && conservationVerdict(1000, 586).verdict === 'refuse',
  `boundary: gamma+eta 1585 ok / 1586 refuse (C = log2(3) x 1000 = ${C_SCALED})`);
ok(conservationVerdict(0, C_SCALED).verdict === 'ok' && conservationVerdict(C_SCALED, 0).verdict === 'ok',
  'boundary commutes: 0+1585 and 1585+0 both pass');

// 2. seed4 §4.3 reputation semantics exact (reference impl lines 4324-4329): init 0.5,
//    hold += 0.01*(1-rep), violate -= 0.05*rep — penalties weigh MORE than rewards (beta > alpha)
ok(repHold(REP_INIT) === 505000 && repViolate(REP_INIT) === 475000,
  `reputation rules exact: hold +${repHold(REP_INIT) - REP_INIT} vs violate -${REP_INIT - repViolate(REP_INIT)} at rep 0.5 (alpha=${ALPHA}, beta=${BETA}, beta>alpha)`);
ok(REP_INIT - repViolate(REP_INIT) > repHold(REP_INIT) - REP_INIT,
  'direction: a violating delta moves reputation more than a compliant delta (seed4 §4.3 "β > α")');
ok(isExcluded(EXCLUDE_BELOW - 1) && !isExcluded(EXCLUDE_BELOW),
  `exclusion threshold strict: below ${EXCLUDE_BELOW} (0.1) excludes, at it does not (§4.4 "e.g., 0.1")`);

// 3. §3.4 step 1 — delta integrity: checksum verifies, tampering breaks it
const d = makeDelta({ from: 'A', tick: 1, gamma_delta: 300, eta_delta: 200, z_out_action: 'contribute', jepa_surprise: 100, vibe_position: 1, vibe_velocity: 1 });
ok(verifyDelta(d) && !verifyDelta(tamperDelta(d, 'gamma_delta', 301)) && !verifyDelta(tamperDelta(d, 'eta_delta', 199)),
  'delta checksum: verifies untampered, breaks on any field tamper (fnv1a64 over canonical JSON)');

// 4. §4.1 refusal semantics — the disciplined sheet refuses its own breaching tick: stays in
//    place, no broadcast, clock frozen; the undisciplined variant broadcasts (the seed's
//    adversarial-deception hole, lines 768-780 — the violator flavor R2/R3 detect)
const inst = makeInstance('A', 1);
const before = inst.cells.clock;
const refused = ownTick(inst, 1200, 600, { disciplined: true, counterparty: 'B' });
ok(refused.refused === true && refused.broadcast === null && inst.cells.clock === before && inst.cells.zout.refused_ticks === 1 && inst.cells.doubleentry.entries.length === 0,
  '§4.1 stall: breaching tick refused — no broadcast, ledger untouched, clock frozen');
const undisciplined = ownTick(inst, 1200, 600, { disciplined: false, counterparty: 'B' });
ok(undisciplined.broadcast !== null && undisciplined.broadcast.gamma_delta + undisciplined.broadcast.eta_delta > C_SCALED,
  'discipline-off instance broadcasts the breach on the wire (detectable by B\'s §4.2 check)');

// 5. Full run — the four receipts + the paired-arms verdict
const s1 = runAll();
const v = s1.verdicts;
ok(v.R1_valid_delta_applies === 'PASS', `R1 valid delta applies (both ledgers conserved post-apply, mirror balances): ${v.R1_valid_delta_applies}`);
ok(v.R2_violating_delta_refused === 'PASS', `R2 violating delta refused (ledger unchanged, rep -= 5% exactly): ${v.R2_violating_delta_refused}`);
ok(v.R3_repeated_violator_excluded === 'PASS', `R3 repeated violator locally excluded (k = ${s1.results.R3.numbers.violations_to_exclude_k} = closed-form): ${v.R3_repeated_violator_excluded}`);
ok(v.R4_honest_reporter_recovery === 'no-recovery-under-seed-semantics', `R4 recovery under seed-literal exclusion: ${v.R4_honest_reporter_recovery} (channel severed, rep frozen at ${s1.results.R4.numbers.literal_arm_channel_severed.rep_frozen_at}; counterfactual m=${s1.results.R4.numbers.counterfactual_arm_channel_kept_open.m_to_cross_exclusion_threshold})`);
ok(s1.results.R5.verdict === 'asymmetry-load-bearing' && s1.results.R5.numbers.paired_worlds_identical_streams,
  `R5 paired arms: ${s1.results.R5.verdict} — W ${s1.results.R5.numbers.W_excluded_in} lat ${JSON.stringify(s1.results.R5.numbers.W_latencies_with_never_as_301)} vs S ${s1.results.R5.numbers.S_excluded_in} lat ${JSON.stringify(s1.results.R5.numbers.S_latencies_with_never_as_301)} (original-rule bucket: ${s1.results.R5.verdict_original_rule}, amended rule disclosed in-chain)`);

// 6. Exclusion is LOCAL only (§4.4) — no global ban exists anywhere in the system
ok(s1.results.R3.numbers.A_still_believes_edge_to_B === true && s1.results.R3.numbers.B_believed_peers_after === 0,
  'local exclusion: B severed A, A still believes the edge to B — no global ban component exists');

// 7. Paired-worlds identity, re-proven independently of the summary (doctrine #1)
const wStream = runMixedWorld('F1PX', ALPHA).stream;
const sStream = runMixedWorld('F1PX', ALPHA_SYMMETRIC).stream;
ok(JSON.stringify(wStream) === JSON.stringify(sStream) && wStream.length === 300,
  'paired worlds identical: alpha is the ONLY difference between arms (300-delta stream byte-equal)');

// 8. Receipt chain: decision rules sealed BEFORE results (seq order), chain verifies from file
const rows = readFileSync(join(HERE, 'outputs', 'receipts_e_f1.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const seqs = rows.map((r) => r.seq);
const rulesIdx = rows.findIndex((r) => r.kind === 'decision_rules');
const firstResultIdx = rows.findIndex((r) => r.kind.startsWith('result_'));
ok(seqs.every((q, i) => q === i + 1) && rulesIdx === 1 && firstResultIdx === 2,
  'receipt discipline: charter (seq 1) then decision_rules (seq 2) then results — rules sealed before any number');
ok(verifyChain(rows).ok && rows[rows.length - 1].kind === 'chain_verify' && rows[rows.length - 1].row_hash === s1.chain.tip,
  `chain verifies from the re-read file: ${rows.length} links, tip ${s1.chain.tip}`);
ok(!!rows[rulesIdx].rules.R5_AMENDED,
  'R5 rule amendment is receipted inside the chain (disclosed before the final run), not post-hoc prose');

// 9. Replay determinism — a second full run produces a byte-identical summary
const s2 = runAll();
ok(JSON.stringify(s2) === JSON.stringify(s1),
  `replay byte-identical (summary + chain tip ${s2.chain.tip} stable across runs)`);

console.log(fail === 0 ? `SMOKE EF1 OK (${pass}/${pass + fail} checks)` : `SMOKE EF1 FAILED (${fail} of ${pass + fail} checks)`);
process.exit(fail === 0 ? 0 : 1);
