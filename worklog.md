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

---
Task ID: 9
Agent: main (Super Z)
Task: Add Texas Hold'em (non-grid, hidden-info + ML strategy cells) to quilt-arcade; playtest, polish, document agent UX; package everything into a single zip

Work Log:
- Verified quilt-arcade state (previous session's Task 8): fixed missing `yaml` dep for vendored engine, 43/43 grid-game checks confirmed green
- Built games/holdem/: sheet.mjs (124 cells) + cards.mjs (inline code templates) — 10-clause rulebook C1-C10 (deck/blinds/holes/streets/betting/table-stakes/showdown/ranking/rebuy/PROJECTION), pure checkers, deal.hand + action.arbiter (sequencer), one-push input surface (action.request), match.step routing via seats.cfg (fish | learn | human)
- PRIVACY MODEL per user spec: hole.pN = agent's own view; proj.pN + table.public render through rule.C10.check — "??" until view/reveal (showdown auto or explicit reveal.show "call to show"); uncontested fold-wins never reveal; 2 humans on a shared screen see identical projections (documented in rulebook)
- ML loop per user spec: strategy weights as SEPARATE visible cells (W.pN.aggro/tight/bluff/sticky/adapt), ai.equity Monte-Carlo cell (60 rollouts), ai.decide with inline reasoning strings, learn.update per-hand nudges with reason tags + fnv1a64 receipts; frozen fish = control group
- play.mjs: INDEPENDENT brute-force 21-combo evaluator (agrees on 200 random 7-card hands), chip-conservation + pot.audit asserts EVERY action, blind-rotation check, showdown winners re-derived by reference, C10 gate tests, human-seat flow test, 150-hand learning run (per-25-hand blocks)
- BUGS FOUND & FIXED (all by referee-vs-reference):
  (a) eval7 two-pair kicker wrong on three-pair boards (kicker must be best remaining rank)
  (b) new_match/deal.hand wrote cells that did not exist for seat 0 (W.p0.frozen, om.p0, hand.log.p0, ai.thoughts.p0) -> threw
  (c) harness conservation baseline forgot blinds move stacks->pot
  (d) ENGINE PATCH 12: state-blind call/get caches FROZE the sheet — repeated (caller,input) (fish call seq:1 after reset) served stale arbiter verdict forever; fix: effectful cells (program/router/ai/api) re-evaluate by default, memoization opt-in via `memo: true`; mirrored in quilt-playtest/packages/core/src (engine.ts/types.ts), ai cache test updated to new semantics
  (e) C5 short-shove normalization overpaid (pay: stack instead of owed call) + C6 applied raise cap to calls; both fixed, C6 law text reworded
- RESULTS: holdem 12/12 green in ~1.9s; learning story real — fish 100->81 while combined learners 205->868 over 150 hands; theta1.aggro 0.6->2.5 (clamp), theta1.sticky 0.2->-0.54; receipts chains verify
- VIEWER: games/holdem/viewer.mjs (custom poker-table UI reusing qa-* language: seats, community, referee bubble, rulebook flash, cell ledger, agent-thoughts panel, theta bars + nudge feed); bundled single-file index.html (181KB) via build_arcade_html.mjs; run_all.mjs now 5 games
- BROWSER QA (agent-browser): projections masked live (view 1: proj0/proj2 = "?? ??", proj1 = own cards), human action bar (Fold/Call/Raise/all-in) works, showdown reveal fires, CVC self-play advances gens + stacks drift, ZERO console errors; screenshots qa_holdem_human.png + qa_holdem_cvc.png
- DOCS: README.md (5 games, 55/55), PATTERNS.md Pattern 6 "Hidden information is a formula, not a hole" + patch-12 lesson, experiments/agent_ux_field_notes.md (decision-trace format, nudge telemetry, observed curves, 6 design guidance points), engine/PROVENANCE.md patch 12
- Patch diff regenerated: quilt-playtest/patches/playtest-patches.diff = fdfed69 -> patched (8 files, patches 1-12); core suite 36/36 green; arcade 55/55 green

Stage Summary:
- quilt-arcade now 5 games / 55 checks green: 4 grid + 1 non-grid (holdem) covering hidden-info-as-formula, watchable per-hand strategy refinement, and honest control-group measurement
- Engine now carries 12 playtest patches (upstream still unpatched); patch 12 (fresh-by-default effectful evaluation) is the newest and was found by the holdem sheet itself
- Agent UX documented end-to-end (thoughts -> nudges -> receipts -> curves) in agent_ux_field_notes.md
- Single zip of all projects assembled at download/quilt-portfolio-2026-09-25.zip (1.7MB, 5 projects + worklog; verified self-contained by extracting and re-running the scoreboard: 55/55)

---
Task ID: 10
Agent: main (Super Z)
Task: quilt-quant — the trading desk as a spreadsheet (backtesting + self-improving strategies as cells); rebuild the single portfolio zip

Work Log:
- Built download/quilt-quant/ on the arcade's vendored engine (patches 1-12, ZERO further engine changes): 67 cells
- Architecture: strategy.book S1-S8 (precise clause language) -> rule.Sn.check pure cells; ind.sma_fast/slow + ind.rsi + sig.pos probe-able cells; bt.run pricing engine sequences S1->S5 and PUBLISHES bt.last receipt; wf.report publishes wf.last + S6 walk-forward verdict (ROBUST/OVERFIT/WEAK); bnh.run buy&hold control; art.equity unicode sparklines; ai.trainer hill-climbs params (seeded, deterministic), promotes ONLY through rule.S7 gate (OOS score beats champion AND IS does not degrade), books fnv1a64 receipts (seed/promote/refuse + wb_moved); desk.champion + p.* write-back re-prices the whole sheet (the visible cascade); champion.push listener flashes promotions
- KEY ENGINE LESSON (documented): formulas-over-programs go stale after a set (P2 family) — fixed spreadsheet-natively: pricing cells publish receipts into value cells, formulas read published receipts. No engine patch needed.
- quant/play.mjs: INDEPENDENT reference stack (prefix-sum SMA, delta-array RSI, settlement-accounting backtest, two-pass Sharpe) + 15 checks: S1 refusals, indicator/signal agreement, no-lookahead tape mutation, HAND-COMPUTED 60-bar 50bps fee tape (every number on paper — caught the virtual-exit-fee inconsistency: liquidation fee now paid in the equity path; also caught S2 correctly refusing slow=3), 4-config agreement incl. fee storm, WF split integrity + S6 vocabulary, S7 unit + LIVE OVERFIT TRAP (wins IS/loses OOS -> refuse receipt, champion untouched) + LIVE PROMOTION, 24-gen run (OOS 0.677 -> 1.304, WEAK -> ROBUST, promotions monotone), chain verify + tamper break, byte-identical determinism, one-nudge re-price, bnh control. RESULT: 15/15 green in ~130ms
- quant/viewer.mjs + bun bundle -> single-file quant/index.html (165KB): tape/SMA/long-shading/trade markers canvas, equity vs bnh, drawdown, book clause flash, metric cells, champion card, +/- nudge buttons (value push re-prices live), RUN THE TRAINER, receipt ledger with promote highlight, sparkline glass; agent-browser QA: nudge re-priced sharpe 0.89->0.88 live, trainer ran 24 candidates/2 promotions to OOS 1.241 ROBUST, ZERO console errors; 2 QA screenshots in experiments/
- experiments/llm_strategist.mjs: letter-coded menu fence (A-E from desk state) -> decode -> ai.trainer force_cand -> same S2-S7 gate; mock state-reactive doctrine shows flip-refused / faster-crossover PROMOTED / hold tie-refused, chain sealed; --real flag for z-ai with 15/30/45s backoff
- Docs: README.md (architecture diagram, book clauses, 15-check table, honest limits), PROVENANCE.md (engine lineage), experiments/build_notes.md (agent UX: the stale formula lesson, the hand-audit catches, receipts speaking the gate's language, determinism-by-design)
- download/README.md rewritten as portfolio index; worklog updated; quilt-portfolio-2026-09-25.zip REBUILT including quilt-quant + updated README/worklog, verified by extraction + re-run

Stage Summary:
- quilt-quant delivers the user's ask: advanced backtest analytics as child's play (one value push re-prices everything) + self-improving strategies with watchable, gated, receipted learning
- The arcade template absorbed a market domain with zero engine changes — strongest evidence yet of the template's generality
- Portfolio now: playtest (12 patches) + tools (75/75) + arcade (55/55) + quant (15/15) in a single verified zip

---
Task ID: 11
Agent: main (Super Z)
Task: E11 sim-first agent lab — rebuild backtest logic agent-centric with simulation-first thinking, signal-as-confirmation, distributed understanding with pruning; wire the real moth-quantum API (user key) + real GLM analyst

Work Log:
- Deep research pass: catalogued standard spreadsheet simulation practice (row-smeared IF() backtests, RAND()+data-table Monte Carlo, Solver/@RISK bolt-ons) and its five structural limits (strategy not an object, randomness as column, optimization outside the sheet, no firing, opaque provenance) -> the human is the agent. Designed the inversion: the sheet IS the agent.
- moth-quantum research: docs + MicroMoth/quantum-audio clones; found the API (api.mothquantum.com/api/v1, bearer, job flow) and the engine catalog. LIVE probe with the user's key: GET /me 200; coin-toss-v1 (real QRNG); qpixl-v1 (numbers-as-waveform: amplitudes encoded as qubit angles, decoded in one measurement — decode noise = true quantum sampling randomness); graph-v1 (custom couplings -> exact tomography + counts + edge_agreement_score).
- Built download/quilt-quant/lab/ on the arcade/quant template (vendored engine, patches 1-12, ZERO further engine changes): 61 cells. mind.book M1-M8 (sense/waveform/propose/SIMULATE/confirm/act/learn/PRUNE) with 1:1 pure rule.Mn.check ports; wave.spectrum (Goertzel 8-64 + resonance projection + trend R2); 10 visible belief cells; edge-triggered two-block policy (trend, cycle-at-price-trough, conflict block); sim.run publishes hashed receipt (P2 publish lesson); sig.confirm gate with dd-halt/overtrade/vol/resonance/ENTANGLEMENT VETO (|ZZ|>=0.82 between mom+rev features refuses CONFLICT proposals); met.* formulas over the receipt; learn.step (moth-entropy 2-weight perturbation, least-tried coverage pick, accept-iff-strictly-better, participation ledger, M8 dormancy tries>=7 && maxd<0.02); ai.digest + ai.analyst (letter fence A-E, patch-8 options); moth.* cells with in-sheet journal; offline mode flags every synthetic read mock:true.
- ENGINE LESSONS (documented in lab/README): (a) program-cell code is an AsyncFunction BODY (input/caller/runtime/clamp/abs/min/max are engine params) — arrow-expression wrappers silently return the function; (b) g(id) helpers that unwrap .data must never be double-unwrapped ((await g(x)).data -> undefined — poisoned weights silently); (c) program cells must be engine.call()ed from the driver (get only sees evaluated cache); (d) RESONANCE PHASE LESSON: gating entries on the return-wave trough buys mid-plunge — price troughs sit at the price-wave (-cos) minimum; the fix flipped economics from sharpe -3 to +3 on the same tape — sim-first surfaces epistemics; (e) verifyChain needs a fieldsOf that strips row_hash.
- Reference stack (independent, exported from play.mjs): prefix-sum SMA, delta-array Wilder RSI, cash+units settlement accounting (invest frac of CURRENT equity — first version leaked 50x leverage via frac*price cash identity), independent DFT. Cross-checks sheet world to 1e-9 on ret/sharpe/dd/exposure + full trade sequence; no-lookahead probe (truncated-tape policy replay per entry).
- PLAYTEST FIXES via referee-vs-reference: level->edge-triggered policy (overtrade brake was slamming 128/131 proposals); brake 6->8 aligned across gateLite/M5/refSim; absolute (not relative) learning spans so bounded knobs can travel; naive-but-active prior (score landscape probed by 150-config grid over the REAL sheet world to confirm a good basin exists); P2 = 13 recovered via non-adjacent peak picking.
- LIVE RUNS (user's key, on their dashboard): coin-toss 64 shots; qpixl waveform reads -> drift -> confidence discount + entropy pool; graph-v1 tomography read before/after learning: ZZ(mom,rev) = -0.937 at the naive prior -> -0.028 after pruning (the entanglement dissolves as the agent simplifies). Real GLM analyst call via lab/analyst_live.mjs: answered "C" in 291ms, inside the letter fence (mock fallback labeled everywhere, 15/30/45s backoff).
- RESULTS: 19/19 harness checks green (live, 61s). Arc: score -1.268 -> +2.61 (best run), sharpe -1.20 -> +2.62, maxDD 3.2% -> 0.3%, free weights 10 -> 8 (mom_min, rsi_hi pruned from participation data; analyst-forced prune also exercised). Run variance across quantum-seeded runs documented honestly (0.74/2.42/2.61). Chart: lab/outputs/e11_results.png (equity re-pricing + learning curve with prune markers).
- Docs: lab/README.md (deep-research comparison table, architecture, cell map, phase lesson, moth integration, pruning doctrine, honest limits); quilt-quant/README.md now presents desk + lab archetypes.

---
Task ID: 12
Agent: main (Super Z)
Task: E12 Perception Arena — competitive formula-inference games under a rationed moth-quantum budget; craftmind script-writer loop; study lucineer/craftmind forks

Work Log:
- CraftMind research (Explore agent): lucineer's 5 craftmind repos + clones of researcher/herding/ranch. Extracted 5 transferable patterns: scripts as hypothesis-bearing versioned artifacts; writer/runner split (LLM authors offline, deterministic engine runs live); pulse = telemetry -> periodic evaluation -> insight -> adjustment; falsifiable-experiment harness; distillation + meta-learning. Clones in /home/z/my-project/craftmind-study/.
- Built download/quilt-arena/ on the vendored patched engine (ZERO engine changes): arena/games.mjs (G1 MOTHRA minesweeper duel 7x7/9mines + G2 WEAVER hearts trio 27-card, public normalized feature language, independent validators), arena/minds.mjs (4 rival minds as ~43-cell sheets: LIN softmax-SGD / WAVE Goertzel spectral analyst / BAYES particle posterior / MASK adversarial self-model mixer; 5 style cells -> 14 derived weight formulas; inf.p0-p3 opponent models; shift-alarm listener lamp), arena/tournament.mjs (game loops, universal predict+fit, two-step MOTH purchase protocol, sets with rotating budgets 0/2/4, script-writer revise with analyst letter fence A-E), arena/moth.mjs (the VAULT: disk-cached qpixl packets, OFF/LIVE namespaces, MAX_LIVE=14 cap, journal, graph-v1 entanglement meter).
- E12 DISCOVERIES (novel ML methods born from failures, all documented in README section 5): (a) EVOLUTIONARY GRADIENT ENSEMBLE — a particle filter can only select among its prior (likelihood reweighting never moves weights; BAYES probe stuck at 0.23 acc despite cos 0.99); giving every particle its own gradient step at its own learning rate then selecting over tracking quality lifted recovery to 0.56; (b) FEATURE CONDITIONING — a 13-scale pts feature let a 0.06 weight swing argmax harder than a 2.0 weight on adj; normalizing features to [0,1] lifted ALL families (MASK 0.41->0.70); (c) SILENT CELL ERRORS — engine.call returns {status:'error'} instead of throwing; one duplicated BASE interpolation silently disabled every inf.update (acc stuck at 0.00 was the only symptom); the driver's callCell now throws; (d) opponent-as-sensor (avoid feature = reading the player IS reading the board); (e) namespaced entropy caches (synthetic packet must never shadow a quantum read).
- PLAYTEST: arena/play.mjs 23/23 green LIVE (45.7s), 20/20 offline. Independent probes: planted-formula recovery per family (acc vs 2x chance + cosine >= 0.99), planted spectral period, referee tamper catches, budget ledger, receipt chains, byte-identical replay on fresh arena, adversarial analyst fence. Chart: arena/outputs/e12_results.png (standings/recovery/economy/novelty panels).
- LIVE RUN on the user's moth key (their dashboard): coin-toss probe 40H/24T real; 6 championship entropy packets bought by real agent policy triggers; 2 graph-v1 tomography reads of arena telemetry (acc x alarm ZZ 0.018 -> 0.466 across the convergence arc, reported as measured); 4 REAL GLM script-writer letters (B/B/A/B, all inside the fence; one 429 absorbed by doctrine fallback). All jobs cached under LIVE namespace — replay burns zero calls.
- Fix during live wiring: championship packets initially went through the bulk vault (0 live) — runSet now accepts a vault override; graph tomography parser fixed against the REAL response shape (tomography.relationships["a,b"].ZZ, verified by raw dump); poisoned null-zz cache entries purged.
- Docs: quilt-arena/README.md (doctrine mapped to mechanisms, family table, vault economics, discoveries, honest limits incl. craftmind lineage from lucineer forks); download/README.md updated (portfolio now playtest + tools + arcade + quant + lab + arena).

Stage Summary:
- quilt-arena delivers the user's phase-8 ask: MOTH-driven novel ML through competitive iterative experimentation (4 families forced apart by a novelty rule every revision), minesweeper+hearts reduced to formulas with opponents inferred in a shared feature language, and an explicit perception economy (MOTH calls per set with family-distinct spend doctrines)
- The strongest single find is the evolutionary gradient ensemble (selection + gradient offspring); the strongest engineering find is the silent-cell-error lesson
- Portfolio: playtest (12 patches) + tools (75/75) + arcade (55/55) + quant (15/15) + lab (19/19) + arena (23/23)
