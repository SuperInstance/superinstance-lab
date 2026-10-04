# DRILL-4 — Cold-landing on github.com/SuperInstance (external zero-shot simulation)

Date: 2026-10-04 · Agent: cold, no prior project knowledge · Workspace: playtest-external/drill-4/

## Path executed
1. Cloned `.github` (public, no token) → read `profile/README.md` (org landing page, v4, 2026-08-24).
2. Found router at `.github/KNOWLEDGE-INDEX.md` (repo root; pointed to by profile "start here" section).
3. Cloned/fetched referenced targets: `superinstance-lab`, `quilt-atlas`, `fleet-seeds`, `exoj`,
   `quilt-pincher`, `cot-quilt` (fresh clones per AGENT-BOOTSTRAP recipe), raw checks on
   `quilt-playtest`, `MicroMoth-quilt`, `quilt-research-canons`, `SuperInstance/SuperInstance`, `AI-Writings`.
4. Followed KNOWLEDGE-INDEX §4 "Fresh agent, any lane": §0 → worklog tail → lane repo
   ONBOARDING → KNOWLEDGE-MAP → ran verification batteries.
5. Ran FLEET-MAP/AGENT-BOOTSTRAP clone-and-verify recipes on two repos. Both green.

## Verification results (claims tested)
| Claim (source) | Result |
|---|---|
| worklog.md 1,500+ lines, Task IDs like `68-a` (INDEX §1) | ✅ 1,599 lines; Task IDs 1,2,66,68-a,69 seen |
| quilt-atlas atlas.json + studies/ + 6h cron (INDEX §1/§5) | ✅ 604KB JSON, 5,168 repos, 7 families; `cron: '17 */6 * * *'` |
| Every quilt-fleet repo has 7-file docs package (INDEX §3) | ✅ exoj, fleet-seeds, pincher, cot-quilt (local); playtest + MicroMoth (raw 200) |
| fleet-seeds embassy/ rounds 34-45 (INDEX §1) | ✅ round-34…43 dirs + wave logs 36-45 |
| scripts/push_all.sh, w67_secret_audit.sh, doc-template-v69.md (INDEX §5) | ✅ all exist; push_all matches its token-discipline description |
| pincher: 35/35 tests, 13 suites, typecheck clean, spine hash | ✅ exact match `51b6d1e1…99483 (corpus=16 fields=4 dim=1024)` |
| cot-quilt: keyscan CLEAN; graph 49 nodes/104 edges; receipts parse | ✅ all green, exit 0 |
| Keys law: .env.keys gitignored, absent from clone | ✅ .gitignore line 6; no .env.keys in clone |
| JOURNAL + HANDOFF pointers (INDEX header) | ✅ both exist with wave-69 / wide-org content |

## Broken pointers (5)
1. profile/README.md → `SuperInstance/SuperInstance/blob/main/GOOD_FIRST_ISSUES.md` → **404** (explicit contributor invite)
2. profile/README.md → `.../THE_HERMIT_CRAB_AND_THE_WORKING_DOG.md` → **404**
3. profile/README.md → `.../THE_EGG_AND_THE_ORGANISM.md` → **404**
4. profile/README.md → `AI-Writings/blob/master/ON_THE_12V_BOAT.md` → **404** (file lives on `main`)
5. `.github/README.md` (v2) → root `HERMIT_CRAB_MANIFESTO.md`, `ORG_MAP.md`, `RUST_PORT_QUEUE.md` → **404** (live at `docs/v2/`; profile README's docs/v2 links are correct — the two READMEs point at opposite generations)

## Gaps / traps
- **Gitlink trap**: superinstance-lab contains 37 gitlink dirs named for fleet repos, all EMPTY,
  no `.gitmodules` — a cold agent exploring the monorepo finds nothing and no doc warns.
- Repo-count drift: 4,357 (profile v4) vs ~4,098 (README/HANDOFF) vs 5,168 (atlas.json ground truth).
- Worklog tail is jargon-dense (FB1/FB2/FB3, lode, WAL, seals) with partial glossary (§0 covers quilt/JEV/ExoJ/receipt only).
- push_all.sh hardcodes `ROOT=/home/z/my-project` (original container path) — not portable.
- Minor drift: KNOWLEDGE-INDEX says tail 300 lines; AGENT-BOOTSTRAP says ~200. Audit script naming drifts (w67 vs w68_surgical).

## Scores
- LANDING-CLARITY 4/5 — identity/culture land hard, first action concrete; metaphor density + 3 dead culture/contributor links.
- INDEX-ACCURACY 4/5 — the router's own pointers 12+/12 verified; breakage lives in the two org READMEs it chains from.
- PATH-COMPLETABILITY 4/5 — 60-min path actually completable; both verification batteries green; gitlink trap + jargon cliff cost time.
- OVERALL: **PASS** (with cracks).

## 3 best features
1. Verified-by-execution docs: ONBOARDING batteries pass byte-identically; gotchas disclose stubs honestly.
2. Layered router: profile → KNOWLEDGE-INDEX → FLEET-MAP → 7-file package → KNOWLEDGE-MAP; laws + "docs failing a cold agent are a bug in the repo."
3. Journal + receipts + atlas: grep-first state discovery, machine-readable ground truth on 6h cron, no humans needed.
