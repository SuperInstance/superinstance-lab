# Wave-67 Nugget Ledger — Distant Fields → Organic Decomposition
**Timestamp:** 2026-10-04T10:06Z · **Method:** web-search rounds (5 fields) → nugget extraction → mapping to fleet systems → simulation (RAF closure on the atlas's real 528 parts) → findings F1–F6 → novel question queue.

---

## Round 1 — Autocatalytic sets / adjacent possible (Kauffman, Hordijk)
**Sources:** Hordijk 2018 (Canterbury, "modeling self-sustaining reaction networks"), Hordijk 2022 (RAF arising in combinatorial models), Filisetti 2011 (stochastic emergence of autocatalytic cycles), Complexity Explorer "A Cooperative Origin of Life".
**Nuggets:**
- RAF = reflexively autocatalytic + food-generated: every reaction catalyzed by a member; every member derivable from food ∪ set outputs.
- Autocatalytic sets exist computationally and arise in stochastic models — closure is the signature of life-like computation, not a tree.
**Mapping:** atlas part = reaction (inputs→outputs); layer-0 outputs = food; sibling part producing an input = catalyst; **the atlas's own `gate` field = the catalyst record** (F3: gate-as-catalyst lifted closure 11.7%→26.7%).
**Simulated:** yes — `scripts/w67_rafsim.py`, receipts `raf-closure-receipt-20261004T100637Z.md`.

## Round 2 — Physarum / slime-mold computing (Adamatzky and successors)
**Sources:** Adamatzky Physarum Machines (alphaxiv), bioRxiv 2026-05-12 adaptive transport network model, ACM 2025-09-27 human–slime-mold co-fabrication, Emerald 2024 phase-field adaptive networks.
**Nuggets:**
- Flow-reinforced veins: transport thickens where flow is high, prunes where silent (Poiseuille-based re-derivation, 2026 model).
- A single cell solves network-design problems without a coordinator.
**Mapping:** cell-fleet's KV membrane (`cell:{id}` marks) = the vein substrate; task traffic should REINFORCE routing weights and decay without flow — lineage specialization as vein growth. NOT yet simulated (queue Q2).

## Round 3 — Immune affinity maturation / clonal selection
**Sources:** biorxiv 2026-08-04 (fitness cost of therapeutic resistance; preexisting resistant mutants), power-system LSTM+clonal-selection 2025, LLM-IDS negative-selection survey, SynChain 2026.
**Nuggets:**
- Clonal selection + hypermutation = learning without a brain (already the cell-fleet genome update: 60 tasks, affinity 0.634→0.991, 18 mitoses, 13 apoptoses — simulated THIS WAVE).
- **Negative selection**: detectors trained to match NOT-self flag anomalies — reward-free anomaly detection.
- Resistant-mutant dynamics: specialists that survive selection carry fitness costs elsewhere.
**Mapping:** cell-fleet already implements clonal selection; Q3 = negative-selection detector cells (a lineage trained on "good decomposition receipts" that flags anomalous parts WITHOUT a reward signal).

## Round 4 — Stigmergy in LLM multi-agent systems
**Sources:** LessWrong/GreaterWrong 2026-03-15 ("Emergent stigmergic coordination in AI agents?"), ResearchGate 2025-12-02 (autonomous normative multi-agent systems), CIR3 transactive reasoning 2025, Schraudner (stigmergic MAS × IoT).
**Nuggets:**
- Coordination through environment-mediated marks is EMERGING in LLM fleets without being designed.
- **Normative layer**: marks that prescribe (not just inform) let norms self-organize without a coordinator.
**Mapping:** fleet receipts + KV membrane marks = stigmergic trail (already); Q4 = norm-marks ("this pattern failed 3×") written into the membrane, biasing downstream cells with no coordinator in the loop.

## Round 5 — Waddington landscape / canalization
**Sources:** biorxiv 2026-03-06 (latent thermodynamic model of cell differentiation), arXiv 2026-06-22 (geometric coherence of single-cell CRISPR perturbations), raju.ai "Geometric Stability as the Missing Axis" (canalization as evaluation axis), Frontiers 2026 (scGPT/Geneformer zero-shot critique).
**Nuggets:**
- Differentiation = descent on an energy landscape; valleys = stable fates; canalization = robustness of fate under perturbation.
- **Geometric stability / directional coherence** as an evaluation axis: measure the coherence of responses to perturbation, not just the response quality.
**Mapping:** cell-fleet lineages = differentiation trajectories over genome-space; Q5 = measure whether mutated genomes land in the same strategy valley (canalization) — degeneracy vs expertise, measurable from mitosis genealogy + task outcomes. NOT yet simulated (queue).

---

## Findings (from the RAF simulation, F1–F6)
- **F1** — the 29-work corpus has NO shared chemistry as written: 4 of 656 consumed input tokens are produced by any part.
- **F2** — works form near-disjoint metabolisms: after GLM mega-fusion, closure NUTRIENT = **141/528 (26.7%)**; 324 parts are islands consuming only private tokens.
- **F3** — **gate-as-catalyst**: the atlas's 401 recorded gates behave as catalysts; closure 11.7%→26.7%. Wave-66's gate ontology = wave-67's autocatalysis (same object, two fields).
- **F4** — zero import-adjacent holes at fusion granularity: cross-work integration needs deliberate INTERFACE PARTS (cells whose output IS another work's input) — wave-68 design directive.
- **F5** — closure bracket [11.9% strict, 26.7% nutrient]: shared environmental nutrients (prompts, configs, keys) matter as much as internal production.
- **F6** — method guard: never fuse unmappable tokens into one shared "unknown" (universal solvent fakes closure); keep them work-private.

## Novel question queue (growing, not closing)
- **Q1 (RAF/wave-68):** if we add explicit interface parts between the top-8 works, what closure fraction does the simulation predict? (Cheap: rerun rafsim with synthetic interface cells.)
- **Q2 (Physarum/cell-fleet):** does flow-reinforced routing grow specialist lineages ("veins") and prune rare ones? Needs task-traffic stats in the tissue report.
- **Q3 (immune/cell-fleet):** can negative-selection detector cells flag anomalous decompositions with no reward signal at all?
- **Q4 (stigmergy/fleet):** do norm-marks in the KV membrane bias downstream cells measurably (A/B: with vs without norm layer)?
- **Q5 (Waddington/cell-fleet):** is the lineage canalized — do mutated genomes land in the same strategy valley? Measurable from existing mitosis genealogy.
- **Q6 (chemistry-first decomposition):** if parts are REQUIRED to name IO in the canonical vocabulary at write time (chemistry-first law), does per-work closure rise? Testable on wave-68's decompositions.

## Artifacts
- `scripts/w67_rafsim.py` — RAF simulator v5 (rerunnable, deterministic, no agent needed)
- `scripts/w67_canon_chunks.sh` + `scripts/w67_megafuse.py` + `scripts/w67-research/chem-canonical.json` — the model-assisted chemistry (1210 tokens, 2 passes, receipted)
- `download/w67-research/raf-closure-20261004T100637Z.csv` — row-per-part spreadsheet logic (528 rows: status, catalysts, missing inputs, gate)
- `download/w67-research/raf-closure-receipt-20261004T100637Z.md` — the receipt of record
- `/home/z/my-project/cell-fleet/` — the affinity-maturation simulation (workerd local)
