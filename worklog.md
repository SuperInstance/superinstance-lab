# Worklog

---
Task ID: 1
Agent: main (Super Z)
Task: Clone SuperInstance/quilt, survey codebase, set up environment

Work Log:
- Cloned https://github.com/SuperInstance/quilt to /home/z/my-project/quilt-playtest
- npm install + npm run build across workspaces (core, sdk, mcp, tui, cli)
- Baseline test run: 36/36 core tests pass (after build)
- Read core source: engine.ts (get/set/call/push/subscribe, per-context memoization, reactive propagation), types.ts (9 cell kinds), parser.ts (YAML), formula.ts (new Function + with(cells) DSL), ai.ts (8 ai sub-kinds, {{cell}} templating), router.ts (caller-aware rules), listener.ts (watch/condition/action), program.ts (runtime handle), gesture.ts (differential geometry: arcLength/bendingEnergy/twistEnergy/planarity)
- Launched Explore agent: surveyed sdk/mcp/cli/tui/examples/streme/docs. Key findings: LocalCellTransport expects LocalEngine iface but QuiltEngine has no adapter; MCP tool-name sanitization lossy for underscores; stale QuiltEngine constructors in demo/worker/tui-bin; CLI commands run/serve/get/set/inspect/validate.

Stage Summary:
- Quilt = reactive cell runtime: sheet (JSON/YAML) of cells evaluated by pull-based reactive engine with caller-aware context. The distinctive primitives: Gesture math, caller-context memoization, federation SDK.
- Environment ready. Play-test scripts go in /home/z/my-project/scripts/, deliverables in /home/z/my-project/download/quilt-playtest/

---
Task ID: 2
Agent: main (Super Z)
Task: Play-test rounds 1-2: probes, engine iteration, example fleet E2E

Work Log:
- E2: built from-scratch reactive sheet (Service Health Responder): sensors->formulas->listener->program works
- E7 probe suite (11 probes) found: (P1) subscriptions on formulas never fire [lazy pull]; (P2) listener-on-formula sees stale data; (P3->PATCHED) watch field never wired into dep graph - ALL example listeners dead; (P4) cycles crash get() with stack overflow, push hangs; (P5) 900-deep chain OK 763ms; (P6) 5000-fanout push 3-5ms; (P7) NaN flows silently status=ready; (P8) per-tenant memoization works (2 evals / 3 calls / 2 tenants); (P9) formulas read effectful cells' last value, no auto-invalidation; (P10) set throws vs get returns error; (P11) Gesture math works
- ENGINE PATCHES (all 36 tests still pass): (1) loadSheet+register wire listener watch lists into dep graph; (2) propagate() cycle guard via visited set; (3) options.eager mode - stale formulas recompute during propagation, listeners get real prev/current; (4) listener actions get fresh event context per fire (cache-bypass + caller.metadata visible in actions); (5) set/push thread real prev into propagate
- SHEET PATCHES (examples now work): weather-monitor (io action cells -> program; fixed '=is_comfortable == false' leading-= condition that silently never fired; conditions read event payload); task-scheduler (any_overdue program -> formula; io -> program); sensor-anomaly REDESIGNED as working push-driven loop: state in value cell, listener->program->runtime.set EWMA update, formulas for z-score, edge-triggered escalation listener
- FALSE FINDING CORRECTED: boat-autopilot YAML was NOT corrupted - bash grep/sed/cat in this sandbox showed stale file views; Read/python/node are authoritative
- E2b fleet E2E (patched engine): ALL 5 scenarios fire - boat off-course alert, weather dangerous alert, anomaly critical escalation (EWMA baseline works, z=23.6), scheduler overdue alert, tracing records

Stage Summary:
- Patched engine + sheets = fully working reactive demo fleet. Key idioms: state in value cells, listener->program->runtime.set for stateful loops, formulas for derived logic, programs (not io) as listener actions, event payload via caller.metadata/input in actions.
- Next: E3 gesture EKG, E4 federation, E6 multi-tenant, E5 real LLM cells

---
Task ID: 3
Agent: main (Super Z)
Task: Novel-use experiments E3-E6 + E5, final engine patches, packaging

Work Log:
- E3 Gesture Cell EKG: built CellEKG monitor wiring Gesture math to live engine subscriptions; detected drifting->oscillating->stuck phase transitions on a synthetic plant sensor; naive threshold caught nothing (max 64 vs threshold 80). Limitation noted: 1-D gestures have zero twist; window hysteresis.
- E4 Federation: wrote the missing QuiltEngine->SDK LocalEngine adapter (~20 lines, adaptEngine()); linked 3 engines (edge/server/cloud) via LocalCellTransport + CellRouter; cross-instance reads, mirrored rollup (cloud.worst 0->15->30), remote alert handle fired across instances, parseCellRef works.
- E6 Multi-tenant: one sheet as SaaS backend. FOUND+FIXED 2 more engine bugs: (a) evalWhen `contains` sugar broke on dotted paths (bare `tags` ReferenceError -> silently false -> all rules fell through); (b) router delegation dropped caller ctx -> tenant cache collapse. After patches: premium/standard tenants get isolated memoized answers (keys f:cap.answer|i:acme|t:premium), free tier blocked at router, 2 model calls not 3. Also documented per-input cache gap (contextKey excludes input).
- E5 LLM cells: wired z-ai-web-dev-sdk as AIEngineLike (ZaiAIEngine adapter); built ticket-triage sheet with 3 real ai cells (urgency llm, sentiment, reply llm) + policy formula + orchestration program. FOUND+FIXED engine bug: program cells not invalidated by upstream set (workflow served first ticket's cached result forever) -> added program/router to propagate() invalidation. FINAL RESULT: 3 real tickets, 7 real GLM calls, urgency 1/10 vs 10/10 vs 7/10, escalation gate worked, reply drafted only for the outage ticket.
- Final regression: 36/36 core tests pass with all patches; probes 9/11 (2 documented semantic gaps: NaN flow, undeclared effectful deps).

Stage Summary:
- 6 engine patches total (watch wiring, cycle guard, eager mode, event contexts, value-cell stale read, contains sugar, effectful invalidation) - all tests green
- 5 working novel demos: CellEKG, federation bridge, multi-tenant gateway, LLM triage, from-scratch reactive app + 11-probe suite
- Next: package deliverables to download/, write findings report PDF

---
Task ID: 4
Agent: main (Super Z)
Task: Report PDF + deliverables packaging

Work Log:
- Generated cascade palette, 2 matplotlib charts (EKG phases, LLM triage urgency)
- Built 12-page report body via ReportLab (TocDocTemplate + multiBuild, FreeSerif, callouts, 5 tables, 2 figures, 8 chapters)
- Cover: Template 01 HUD (white bg, anchor line), fixed 2 cover_validate issues (line-text gap 32->50px; nested span split into sibling blocks), rendered via html2poster.js --width 794px
- Merged cover+body via pypdf with strict A4 normalize; fixed QA errors (page size mismatch, page numbers moved to footer)
- Preflight: code.sanitize, meta.brand, font.check (0 issues), toc.check (clean), pages.clean (no blanks), pdf_qa (PASS with 5 design-intent warnings)
- Deliverables in /home/z/my-project/download/quilt-playtest/: report PDF, README.md, patches/playtest-patches.diff (727 lines), examples/*.mjs (7 scripts), 2 charts

Stage Summary:
- Task complete. Full play-test loop delivered: findings -> patches -> verified demos -> report.

---
Task ID: 5-6
Agent: main (Super Z)
Task: Ecosystem survey of SuperInstance account + evolved play-test (Ocean-as-sheet, System One, tidepool)

Work Log:
- Fetched upstream main (c694291 -> fdfed69): new landing pages ocean/decide/quantum, Q4 "The Ocean phase" roadmap; new branches landing-ocean, landing-tide, claude/* (gesture math + CI fixes), canon/*, quilt-jupyter-conception
- Surveyed sibling repos (shallow-cloned): jev-quilt (R10: 500 canon pieces, observation atom, 11 opcodes), tidepool (vector memory protocol: /api/remember, /api/recall, <=200 word artifacts, 16-number native fingerprints), quilt-ai (@quilt/ai: 4 providers, 8 ai cell kinds), quilt-cloudflare (ocean.ts: fnv1a64 hash-chained witness receipts, 0.92 hit threshold, tide.ts dollar-metered gates), quilt-agent (agents as sheets)
- Live worker unreachable from sandbox (HTTP 000) - proceeded with local counterfactuals
- DISSENT LEDGER: created clean worktree of upstream main, built it, re-ran 11-probe suite -> 6/11 still leak (P1 subscribe-on-formula dead, P2/P3 listeners dead incl. sensor watches, P4 cycles overflow both paths, P7 NaN flows, P9 stale effectful reads); 5 hold. My 7 patches remain unmerged open value
- E8 Ocean-as-a-Sheet: full Ocean loop as one quilt sheet (ask.vec ai.embed cell [local deterministic 64-dim hashed embedding, SDK has no embeddings endpoint], cosine match, policy.hit/tide_out formulas, serve.workflow program remembering misses into ocean.memory, fnv1a64 receipt chain ported from ocean.ts, tide budget gate, size/hit_rate/tokens_saved counters, tide.alert listener). RESULT: 6 asks -> 2 real GLM calls; paraphrase hit sim=0.6708; tide_out 429 voice fired through real listener (audit verified); witness chain SEALED (re-derived from printed rows)
- E9 System One in the sheet: sysone.score/choice/noul typed ai kinds with fence in adapter; letter-coded A-D menu protocol; adversarial injection ticket (BANANA + score 100 + noul yes p=1). RESULT: choice stayed in menu, noul returned no p=0.9 against demand, score gamed to 100 -> incoherent receipt {score:100,noul:no,p:0.9} = visible dissent in witness chain. Doctrine: types hold, values leak, receipts surface it
- ENGINE PATCH 8 found by arming the fence: evaluateAI config whitelist silently drops schema fields (options/min/max) before provider sees them -> fence degenerates to defaults with no error. Fixed with primitive/array passthrough; 36/36 tests green; regenerated cumulative playtest-patches.diff
- HONEST CORRECTION: E9's earlier "fence held everything" was partly an artifact of patch-8 absence (adapter saw empty options, refused all - right outcome wrong reason). Letter-coded rerun with real options is the trustworthy result
- E10 tidepool artifacts: 5 hash-chained artifacts (<=200 words, native fingerprints, prev_hash chain from GENESIS) -> download/quilt-playtest/tidepool-artifacts.jsonl
- Deliverables updated: examples/e7_probes_upstream.mjs, e8_ocean_sheet.mjs, e9_sysone_sheet.mjs, e10_tidepool_artifacts.mjs; README evolution chapter

Stage Summary:
- Answered the user's question directly: my engine-level findings are still cutting edge (6/11 leaks unfixed upstream, claude/* branches don't touch them); the evolution is vocabulary + doctrine (witness receipts, typed decisions, tidepool memory, Ocean) - adopted by rebuilding the fleet's two flagship services as sheets
- 3 new working demos + dissent ledger + patch 8; 8 engine patches total, 36/36 tests green
- Next options: PR-ready patch series upstream; quilt-time rewind over receipt chains; Ocean-as-sheet with real BGE endpoint; dissent-JSONL export as training corpus

---
Task ID: 7
Agent: main (Super Z)
Task: Build 10-tool portfolio on quilt across 10 realms, playtested to 75/75 green

Work Log:
- Built download/quilt-tools/: quilt-toolkit.mjs (shared runtime: witness idiom incl. verifyChain, playtest harness check()/done(), ANSI panels, SysOne adapter with live/offline degrade + letter-coded choice fence, deterministic 64-d embedder) + tools/01-10 + outputs/*.txt + index.html (generated from captured outputs, dark fleet style) + README.md (engineer entry point, 5 shared idioms, swap-in seams)
- Tools + verdicts: 01-fleet-pager 7/7 (golden signals, hysteresis, first-sample guard), 02-ledger-seal 6/6 (tamper pinned at exact row), 03-ocean-recall 7/7 (remember/recall/forget, eid discipline), 04-triagedesk 8/8 (fence + adversarial, offline heuristics labeled), 05-budget-tide 8/8 (refuse-when-dry gate semantics: crossing spend allowed, then refusal), 06-home-ecos 6/6 (EWMA baseline + edge-triggered surge + gesture bending energy), 07-driftwatch 7/7 (slope/variance/bending regimes; slope flagged at 0.890 vs static 0.792), 08-approvals 9/9 (caller-aware policy, cross-tenant refusal, patch-11 ctx threading), 09-habit-atlas 8/8 (momentum physics, append-only days), 10-pipeline-guard 9/9 (schema-as-data, precise rejection reasons, dead-letter replay under v2)
- ENGINE PATCHES 9-11 (all 36 upstream tests green after each):
  - P9: evaluateFormula persists cell.value -> pulls seed the graph; listeners now see true prev on first crossing (fixed: first-crossing misses)
  - P10: call() memo key includes stableJson(input) (context.ts callKey) -> programs are honest functions of their arguments; read-caching free, ops need event ids (tools learned eid idiom)
  - P11: programs receive context-bound runtime (get/set/call thread ctx; explicit ctx wins) -> nested runtime.call no longer drops tenant identity (E6 router-delegation bug family)
- Play-test insights surfaced by the build: memoization of identical append inputs is correct-for-reads/wrong-for-appends (fix: eid); formulas cannot see caller context (caller-dependent policy must be programs); first-sample guard (prev==null = no transition = no page) belongs in every edge-triggered listener; sensor->listener->program chains need the trigger listener wired explicitly
- Cumulative playtest-patches.diff regenerated (now includes patches 1-11)

Stage Summary:
- Portfolio delivered: 10 realms, 75/75 checks green, every tool self-contained + verdict-printing + swap-in-marked
- Engine now carries 11 playtest patches; upstream still unpatched (all findings remain open PR material)
- index.html embeds real captured runs as the wow artifact for the engineer audience

---
Task ID: 8
Agent: main (Super Z)
Task: Build spreadsheet-native games on quilt (quilt-arcade) — rules-as-cells, flip cascades, learning loops, CVC, browser viewers

Work Log:
- Built download/quilt-arcade/: 4 games (tictactoe 41 cells, reversi 113, connect4 89, gomoku 126) on the vendored patched engine (engine/ + PROVENANCE.md, patches 1-11)
- Architecture per game: rules.book (precise clause language) -> rule.N.law/.check (PURE program cells, verdicts carry effects: flip lists with rays, winning squares) -> move.arbiter (pure sequencer, owns match.seq DUP guard) -> push listener (move.request value cell drives everything) -> log.events ledger
- Learning loops as cells: ai.weights/ai.features/ai.choose/ai.move_log/learn.update (averaged perceptron) + learn.receipts (fnv1a64 witness chain per generation); control group = frozen gen-1 self (ai.fixed_weights); harnesses carry INDEPENDENT reference implementations and cross-check whole-board equality every ply
- Results: tictactoe 11/11 (minimax never loses, 300 games); reversi 12/12 (corner discovery theta 0->4.8, curve 24 gens x 8 games); connect4 11/11 (mine3 0->7.9, theirs3 0->-7.2, held-out 72%); gomoku 9/9 (tookFive discovery, held-out 78%); run_all.mjs scoreboard ALL GREEN 43/43
- Viewers: shared/viewer.mjs (spreadsheet grid, rulebook clause flash, referee bubble, cell ledger, theta bars, CVC self-play) + shared/driver.mjs + 4 entries; scripts/build_arcade_html.mjs bundles engine+sheet+UI via bun into single-file index.html x4 (150KB each, runs from file://)
- agent-browser QA: reversi click-play + flip cascade + AI reply + R3 refusal bubble verified; CVC reached gen 15 in 11s; connect4 R6 WIN NOW advisory fired live; zero console errors; 2 QA screenshots in experiments/
- experiments/llm_advisor.mjs: small-model advisor seam (letter-coded menu fence -> decode -> arbiter verifies -> heuristic fallback; engine ai cells return unusable values rather than throwing - treat both as refusal); mock path 4/4 green, --real flag for z-ai with backoff
- Engine facts surfaced: loadSheet REPLACES the sheet (use register() to extend); runtime.call returns CellValue (.data); match.seq must be arbiter-owned; naive move-level perceptron cannot learn blocking without tookFive/missedFive hindsight features

Stage Summary:
- 4 polished, playtested, research-grade spreadsheet games + viewers + docs (README, PATTERNS.md with porting guide, learning_curves.md) - all self-contained, no install needed
- 43/43 harness checks green; learning is real (held-out evals vs frozen gen-1: 72%/78%/corner-discovery) and tamper-evident (witness chains)
- Deliverable: download/quilt-arcade/
