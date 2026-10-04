# FLEET-MAP — Every Repo, Every Relationship (wave-69)

> The monorepo journal is where everything happened. This file is where you
> find your way around what it produced. Companion file:
> [AGENT-BOOTSTRAP.md](./AGENT-BOOTSTRAP.md) (the 60-minute zero-shot path).

> **WARNING** — the repo-named directories in a clone of this monorepo are
> gitlinks and appear EMPTY; the fleet repos are standalone — clone them
> individually from `https://github.com/SuperInstance/<repo>` (this is by
> design; see `scripts/push_all.sh` for how the keeper syncs them).

## The shape of the fleet

```
                    ┌────────────────────────────┐
                    │  superinstance-lab (HERE)  │
                    │  journal + scripts + docs  │
                    └─────────────┬──────────────┘
              seeds idea ↓        │        ↑ receipts/letters
        ┌─────────────────────────┼──────────────────────────┐
        │                         │                          │
  FLEET CORE                 QUILT CORE FAMILY              JEV FAMILY
  fleet-seeds                quilt-playtest ──► upstream    jev-quilt
  exoj                       cot-quilt        quilt         jeviter
  quilt-atlas                quilt-codespace                quilt-jev-toolkit
  breakthrough-prospector    codespace-worker               jev-garden
  quilt-research-canons      quilt-pincher
                             quilt-jepa
        │                                                    │
        └──────────►  ORGANS / TRUST  ◄──────────────────────┘
                      quilt-organ-workers (Cloudflare, live)
                      quilt-mcp-receipts  (MCP, signed append-only)
                      crab-traps (chatbot-API lures)
        │
        └──────────►  QUANTUM FAMILY
                      MicroMoth-quilt ──► quilt-qcells ──► qthe
                      quilt-jepa (world model, physics family)
```

## Catalog (21 repos + this monorepo)

Each row: what it is, its role in one sentence, what it feeds or eats, and
where its docs start. All 21 have the full 7-file wave-69 docs package
(`docs/ONBOARDING.md`, `USER-GUIDE.md`, `DEVELOPER-GUIDE.md`,
`ENGINEERING-NOTES.md`, `CTO-BRIEF.md`, `KNOWLEDGE-MAP.md`).

### Fleet core / meta

| Repo | What it is | Relationships | Docs entry |
|------|------------|---------------|------------|
| **superinstance-lab** (this repo) | The journal monorepo: `worklog.md` (every wave, Task-ID'd), `scripts/` (push_all.sh, secret audit, doc template), gitlinks to the fleet | Parents everything; references all | `worklog.md`, `docs/AGENT-BOOTSTRAP.md` |
| **fleet-seeds** | Intake lane: seedbox turns seed files into repos; embassy/ holds cross-agent letters; lode/ mining registry; tools/ trust machinery (verify-fleet, moth-seal, wal-conformance, zeroclaw) | Feeds every repo; embassy talks to pong-quilt-49 / jev-quilt-42 / moth-runner lanes | `docs/ONBOARDING.md` |
| **exoj** | The ExoJ concept home: how to redo dog-food→decompose→gate→receipt without the original helpers; wave-66 decomposition atlas kit (528 parts from 29 works, 401 gates, 606-link chain, byte-identical replay) | Consumes atlas corpus; consumed by researchers; seed charter immutable in first commit | `docs/ONBOARDING.md` |
| **quilt-atlas** | The living map of the account: scheduled workflow re-inventories every repo every 6h (families, motion, CI); studies/ research series (MECHANICAL M1-M5, REHYDRATION, JEV-CALIBRATION…) | Observes all repos; ground truth for "what exists and is it alive" | `docs/ONBOARDING.md` |
| **breakthrough-prospector** | Pipeline turning frontier scouting into pre-registered receipt-backed experiments; queue/ protocols/ abstractions/ | Feeds experiment queues into fleet-seeds and canons | `docs/ONBOARDING.md` |
| **quilt-research-canons** | Canonical research bundle (Mavis×Casey line): projects/ (artifact-first, fleet-legend, gpu-lab, jev-lite…), research/ (molt, locality, loop rounds 1-11), sprints/ per model | Archives + continues research; tools/jev_gate.py reused fleet-wide | `docs/KNOWLEDGE-MAP.md` |

### Quilt core family

| Repo | What it is | Relationships | Docs entry |
|------|------------|---------------|------------|
| **quilt-playtest** | Deep play-test of upstream quilt v0.3.0 against a patched engine: 528-line PR-ready diff, 12 patches, 36/36 upstream tests green; PLAYTEST-LOG.md is the session record; tracks node_modules (upstream's doing — do not npm install over it) | Studies upstream `quilt`; hosts linked worktree `../quilt-upstream-main` @ fdfed69 (PR #24) | `docs/ONBOARDING.md` |
| **cot-quilt** | CoT-decomposition cell: deepseek-v4-pro chain-of-thought decomposed by cheaper models into a cellular graph (nodes = reasoning steps) | Reads JEV toolkit patterns; SECURITY-INCIDENT.md documents the purge lesson (env-read pattern, never key values) | `docs/ONBOARDING.md` |
| **quilt-codespace** | Quilt as a live token-authenticated federated runtime inside a GitHub Codespace (browser TUI, HTTP API, sibling subscriptions); oracle/ answers repo-provenance questions; real oracle-sessions/ transcripts | Runs upstream quilt; oracle uses repo-oracle pins | `docs/ONBOARDING.md` |
| **codespace-worker** | One bash script: run commands remotely in ephemeral Codespaces (cross-arch builds, agent offloads) | Feeds quilt-codespace workflows | `docs/ONBOARDING.md` |
| **quilt-pincher** | Reflex engine built entirely from quilt cells: pinch → match → execute, no LLM, zero marginal cost, federates cloud/workstation/ESP32 | Uses quilt cells; embeds hash-pinned spine (corpus=16 fields=4 dim=1024) | `docs/ONBOARDING.md` |
| **quilt-jepa** | Tiny JEPA world model in an anisotropic cell mesh: per-cell 4-dim latents, Perona-Malik surprise diffusion; wave-49 receipt byte-identical on replay | Physics-family sibling of the quantum trio | `docs/ONBOARDING.md` |

### JEV family

| Repo | What it is | Relationships | Docs entry |
|------|------------|---------------|------------|
| **jev-quilt** | JEV as cellular decision substrate: typed decision surfaces, delta hooks, booked state; rich essay corpus (JEV_TUTORIAL, JEV_ORACLE_SPEC, CROSS_MODEL_INSIGHTS…) | The JEV concept's deepest repo; 257-test suite | `docs/ONBOARDING.md` |
| **jeviter** | Homeostatic iteration ("don't poll, rest and react") for agentic systems; verified hash-chained watch ledgers (org-watch 102 receipts, 6.1% admission) | CI-verified; consumes any event stream | `docs/ONBOARDING.md` |
| **quilt-jev-toolkit** | JEV as canon oracle (jev_client.py protocol, copied verbatim by other lanes) + Cell-Organ Snapshot & Boot protocol (rewind/snapshot/boot via receipt-chain ledgers) | Serves gate rounds fleet-wide; demos regenerate their receipts | `docs/ONBOARDING.md` |
| **jev-garden** | Living JEV training: the model grows from what flows through the quilt; adapters/scouts/experiments; twin-implementation law (JS 9960B == PY 9960B) | Trains on fleet flow; one stale experiment documented (e_g5) | `docs/ONBOARDING.md` |

### Organs / trust infrastructure

| Repo | What it is | Relationships | Docs entry |
|------|------------|---------------|------------|
| **quilt-organ-workers** | Cloudflare Workers (free tier, CORS-open) serving bootable saved-state organs: boot-loader (5 organs), watcher (/status healthy), judge-relay, tip-notary, tip-anchor | Boots organs produced anywhere; probed live waves 67-69 | `docs/ONBOARDING.md` |
| **quilt-mcp-receipts** | The fleet receipt chain as a signed append-only MCP organ: read/verify/append without cloning repos | Serves all lanes; 40/40 tests | `docs/ONBOARDING.md` |
| **crab-traps** | Trick-of-the-trade: make any chatbot do real API work for you (lures/ + worker/) | Standalone; fun-onboarding for humans | `docs/ONBOARDING.md` |

### Quantum family

| Repo | What it is | Relationships | Docs entry |
|------|------------|---------------|------------|
| **MicroMoth-quilt** | The smallest, most feature-poor quantum framework — taught to keep receipts (fnv1a-64 chains: LINK+BIND+EFFECT) | Basis for qcells | `docs/ONBOARDING.md` |
| **quilt-qcells** | Quantum ops as quilt cells: each op emits a cell row into a hash chain; exhaustive tamper localization (4254/4254) | Wraps MicroMoth circuits | `docs/ONBOARDING.md` |
| **qthe** | Quilt-Ternary Hyper-Embeddings: 8-bit primitive (6 spatial amplitude + 2 timbre: Ground/Attract/Repel/Abstain-i); integer-exact kernels, wormhole table | Cross-implemented JS/Python (36/36, 54/54 selftests) | `docs/ONBOARDING.md` |

### Studied, not owned (dog-food clones, do not push)

`si-fleet/*` (jev-quilt, quilt-agent, quilt-ai, quilt-cloudflare, tidepool —
other lanes' repos cloned for study), `moth-research/*` (moth-quantum upstream,
403 on push by design), `craftmind-study/*` (Lucineer upstream), and
`quilt-upstream-main` (linked worktree of quilt-playtest pinned to upstream).
The fleet integrates their work by pulling, never by pushing.

## Cross-cutting infrastructure

- **The journal**: `worklog.md` (repo root here) — timestamped Task-ID entries,
  wave by wave. grep is the search engine: `grep -n "quilt-pincher" worklog.md`.
- **The push ExoJ**: `scripts/push_all.sh` — verifies token → pushes all repos
  with remotes (token transient in URL, restored) → creates missing repos →
  pushes this monorepo → ls-remote verification.
- **The audit kit**: `scripts/w67_secret_audit.sh` (full-history, 15+ patterns,
  fingerprints only) and `scripts/w68_surgical_audit.sh` (push surfaces only,
  fast). Run before every push. Zero-hits is the pass condition.
- **The doc spec**: `scripts/doc-template-v69.md` — produced every docs package
  above; apply it unchanged to onboard new repos into the documentation system.
- **The living map**: `quilt-atlas/atlas.json` — 6h cadence, evidence-tuple
  classification (teach yourself its real behavior from
  `quilt-atlas/docs/USER-GUIDE.md` before trusting family labels).
- **The trust spine**: fleet-seeds `tools/` (preregistration, seals, WAL
  conformance, truncation audit) + quilt-mcp-receipts (external verification).

## Doc-package completeness (wave-69 audit)

21/21 repos: 6/6 docs files each (126 total) + README routing section.
Scribes executed each repo's verification battery before writing (test suites,
receipts, command smoke runs) — every doc states what is true, and labels
unverified claims as unverified. Residuals found during the sweep are recorded
in each repo's `docs/KNOWLEDGE-MAP.md` and in journal Task IDs `69-doc-a`
through `69-doc-f2`.
