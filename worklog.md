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
