// wave-64 keeper fold: JEPA-R10 registry row (15->16), lesson L16, append-only validated.
import fs from 'node:fs';
const LODE = '/home/z/my-project/fleet-seeds/lode';
const reg = `${LODE}/registry.jsonl`, les = `${LODE}/lessons.jsonl`;
const beforeReg = fs.readFileSync(reg, 'utf8'), beforeLes = fs.readFileSync(les, 'utf8');

const row = {
  set_id: 'JEPA-R10', repo: 'SuperInstance/quilt-jepa', commit: 'a47762a', predictions: 3,
  verdict: 'FAIL', verdict_commit: 'a47762a',
  registration_ref: 'registration-v10.json (sealed 4802bc85, commit aee0335, pushed pre-run) + receipts/design10.json + probe10.mjs; coverage instruments v1/v2/v3 untouched history per the v10 registration',
  brier: null, ts: '2026-10-02T02:30:00Z',
  notes: 'scorecard 22/28 — all 25 carried claims re-bind bit-exact; all 3 NEW claims honest FAILs on pre-priced branches, zero threshold surgery. DOSE10 FAIL 16/17: the |Wc| ordering gap across the depth ladder is a HUMP not a descent (+0.01974→+0.03072→+0.03197→+0.02817→−0.04726; strictly-decreasing leg fails; pooled Spearman 0.9152; |Wc| gap grows 1.3606→2.2481 while ordering inverts) — |Wc|-room is DEPTH-REFUTED as a single-factor law; dose decision DEFERRED (fired branch: curve not lawful-monotone), wd 3e-4 REMAINS longevity main dose, wd 2e-4 candidate-only, ordering mechanism re-priced as multi-factor for round 11. SAT10 FAIL 20/21 — one leg only: inc4 0.016733193739495222 > inc3 0.0003327380566972016 (50.3x, priced EXPANDING-STEPS) BUT the plateau HELD (rho20_4 0.9720798092837104 in [0.9553466155442152, 1)) AND the different-probe-world E-cascade SURVIVED (rho20_4^E 0.9815072297359018 < 1.0) — the trivial-world-artifact branch is REFUTED: the plasticity plateau is not a readout artifact. DIP10 FAIL 12/17: the W-domain is FRAGMENTED, not an interval — localMin islands {0.55-0.65} u {0.95-1.1}, low_flips 2 > 1, 1x is an isolated survivor, death clean at 1.75. R4 determinism crown INTACT AT TEN ROUNDS (byte-identical twins 8a3daa00, sha-chain to run9 row ff60c211/7a20e613/30657dbe/34ec241a/c972511d, zero mismatches). Executed through three result-return deaths (64-b sealed registration; 64-b-r generated run10.mjs + wrote the receipt of record + a disclosed defect skeleton receipt; 64-b-r3 scored from the receipt with ZERO re-execution) — receipt-of-record-first resume (L16) exercised.'
};
const lesson = { id: 'L16', ts: '2026-10-02T02:30:00Z', cls: 'receipt-of-record-first',
  claim: 'Refinement of L13: when a lane dies after the receipt-of-record is written, the resume is a READING exercise, not a re-execution. Check (a) the receipt exists, (b) its chain re-derives from GENESIS, (c) its verdict fields are structurally complete — only re-run if structurally incomplete. 63-b-r2 proved byte-identical re-runs are possible; 64-b-r3 proved the cheaper law: zero re-execution, every number verbatim from the receipt. The determinism crown makes receipt-first SAFE — that is what it is for.',
  evidence: 'quilt-jepa a47762a (64-b-r3 scored 22/28 from run10.json with zero re-execution); contrast 63-b-r2 (byte-identical re-run as proof)' };

fs.appendFileSync(reg, JSON.stringify(row) + '\n');
fs.appendFileSync(les, JSON.stringify(lesson) + '\n');
for (const [p, before] of [[reg, beforeReg], [les, beforeLes]]) {
  const after = fs.readFileSync(p, 'utf8');
  if (!after.startsWith(before)) throw new Error(`${p} not append-only`);
  after.trim().split('\n').forEach((l, i) => { try { JSON.parse(l); } catch (e) { throw new Error(`${p}:${i + 1} invalid`); } });
  console.log(`${p}: OK, ${after.trim().split('\n').length} rows`);
}
console.log('FOLD: registry 15->16 (JEPA-R10 FAIL honest), lessons 15->16 (L16)');
