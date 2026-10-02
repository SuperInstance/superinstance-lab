// wave-63 keeper fold: JEPA-R9 registry row (append-only), lessons L13-L15, validation.
// Fleet law: append-only, never rewrite existing lines.
import fs from 'node:fs';

const LODE = '/home/z/my-project/fleet-seeds/lode';
const reg = `${LODE}/registry.jsonl`;
const les = `${LODE}/lessons.jsonl`;

const beforeReg = fs.readFileSync(reg, 'utf8');
const beforeLes = fs.readFileSync(les, 'utf8');

const row = {
  set_id: 'JEPA-R9',
  repo: 'SuperInstance/quilt-jepa',
  commit: 'e52a1fb',
  predictions: 3,
  verdict: 'PARTIAL',
  verdict_commit: 'e52a1fb',
  registration_ref: 'quilt-jepa registration-v9.json (sealed 84de8046, mtime 1790900000000, commit d5640de, pushed pre-run; verified fail-closed at every run startup) + registration-coverage-v3.json (sealed 2c58e798, fixedMs 1791000000000) + receipts/coverage-v3.json (sha256 597b958a, byte-identical re-run proven); instrument chain v1->v2->v3 per the COV2 registered upgrade path',
  brier: null,
  ts: '2026-10-02T00:45:00Z',
  notes: 'scorecard 22/25 (3 NEW claims + carried). SAT9 PASS 13/13: third switch from the registered second-switch END state (no weight reset) — rho20_3 = 0.9553466155442152 in [rho20_2 = 0.955013877487518, 1) with increment COLLAPSED 0.023848 -> 0.000333 (71x smaller): the saturation curve is FLAT — the plasticity re-balancing is bought once at switch 1 and HELD through switches 2 and 3; |Wc|-room composition persists (end-3 9.3807 < control 17.6794). CURE9 FAIL 15/16 (honest, on the registered ordering-reversal branch): the 2e-4 arm re-binds bit-exact everywhere and the advantage holds at BOTH depths (20k 0.6841500024733943 bit-exact, 75k 0.550745 < 1) but the dose ORDERING REVERSES at 75k — ratio(2e-4,75000) = 0.5507446127932 < ratio(3e-4,75000) = 0.5980059011717661 despite LARGER |Wc| (8.6917 vs 6.4436): the |Wc|-room law is DEPTH-FRAGILE on the cured side; dose decision DEFERRED to round 10 with the reversal as the priced question (depth-ladder ordering measurement registered in the round-10 agenda). DIP9 FAIL 4/13 (honest): the lr-0.2 dip is WINDOW-FRAGILE — local-min shape dies at BOTH 0.5x (site not below left neighbor) and 2x (site becomes local MAX) W scalings; dipmags -0.010440/-0.019046 vs 1x 0.073635; what generalizes is the monotone RECOVERY along W (0.6045 -> 0.2537 -> 0.1621); the dip law NARROWS to the registered W(lr) window with domain boundaries on both sides. R4 determinism crown NINE rounds deep: probe==run==twin==r4..r9, receipt reproduced BYTE-IDENTICAL (sha256 bc411f66) by an independent fresh full execution; all receipted anchors bit-exact (run4 29/29, run5 92/92, design6 101/101, run6 105/105, run7 92/92+105/105+87/87, run8 92/92+105/105+87/87+71/71, design8 3/3, design9 9/9). Round-9 executed through TWO backend result-return deaths (63-b sealed+pushed registration; 63-b-r completed run+verdict; 63-b-r2 wrote the v3 instrument + sealed) — staged-resume law exercised end-to-end, zero data lost, resume receipt 02c5389 preserves mid-run staging bytes (5c2e3661).',
};

const lessons = [
  { id: 'L13', ts: '2026-10-02T00:45:00Z', cls: 'result-return-deadline', claim: 'Long-running subagents can complete ALL their work and still die on the backend result-return deadline (observed 4x in wave 63: 63-a, 63-b, 63-b-r, 63-d). The staged-resume law converts these into zero lost work: (1) commit mid-run staging + receipts to the repo BEFORE returning (resume receipt commits like quilt-jepa 02c5389), (2) on resume, AUDIT the on-disk state and reuse — never redo, never trust without re-verification. Fleet-wide implication: keepers should check disk state for uncommitted lane artifacts after ANY subagent dispatch failure before relaunching from scratch, and resume prompts must carry the verified on-disk inventory.', evidence: 'quilt-jepa 02c5389 + e52a1fb chain; cot-quilt 0f360b9 (4 reused calls vs 23 fresh); breakthrough-prospector f0034fd' },
  { id: 'L14', ts: '2026-10-02T00:45:00Z', cls: 'inherited-gate-arithmetic-bug', claim: 'Pass-line arithmetic copied across experiment slices propagates silently: e6_slice1.mjs computed M >= 0.05*baseline where the registration required M >= 1.05*baseline; slice-2 inherited the line and it fired a false PASS promoting an arm with cost rule PAID. Cure that held: the registration is the single source of truth — re-derive every gate from it, never copy from the prior runner; on catch, preserve the voided receipt verbatim (decide.buggy-gate-draft.json), repair the runner, prove measurement invariance (per-arm tables identical under both), and flag the defective line in the prior slice for future lanes.', evidence: 'breakthrough-prospector f0034fd (slice-2 repair #2); defective line flagged in e6_slice1.mjs' },
  { id: 'L15', ts: '2026-10-02T00:45:00Z', cls: 'schema-dialect-drift', claim: 'Two lanes building on the same concept in one wave produced two dialects of the organ manifest schema: quilt-jev-toolkit quilt.organ.manifest/v1 vs quilt-organ-workers quilt.organ.v1 (cross-checked canonicalization matched, so the mismatch was caught and receipted rather than silent). Protocol hygiene rule: before N>=2 independent implementations of a shared schema go live, the schema string and canonical-JSON dialect are registered in ONE place and both implementations validate against a shared fixture; unify the dialects at v1 before external uploaders multiply.', evidence: 'cot-quilt 0f360b9 upload receipt (1e10ff02, bootable:true) + quilt-organ-workers 2caa24d' },
];

fs.appendFileSync(reg, JSON.stringify(row) + '\n');
for (const l of lessons) fs.appendFileSync(les, JSON.stringify(l) + '\n');

// validate: parse every line
for (const [p, before] of [[reg, beforeReg], [les, beforeLes]]) {
  const after = fs.readFileSync(p, 'utf8');
  if (!after.startsWith(before)) throw new Error(`${p} is not append-only!`);
  after.trim().split('\n').forEach((line, i) => {
    try { JSON.parse(line); } catch (e) { throw new Error(`${p} line ${i + 1} invalid JSON: ${e.message}`); }
  });
  console.log(`${p}: append-only OK, all lines valid JSON, now ${after.trim().split('\n').length} rows`);
}
console.log('FOLD COMPLETE: registry 14->15 (JEPA-R9 PARTIAL), lessons 12->15 (L13-L15)');
