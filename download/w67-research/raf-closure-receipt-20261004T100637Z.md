# RAF-Closure Receipt — wave-67 (20261004T100637Z)

**Nugget source (R1):** Kauffman/Hordijk autocatalytic-set (RAF) theory —
closure + catalysis as the signature of life-like computation.

**Mapping:** part = reaction (inputs→outputs); food = layer-0 outputs;
catalyst = another part producing one of its inputs; RAF closure = the
self-sustaining decomposition chemistry of the atlas corpus.

## Headline numbers (bracketed experiment)
- corpus chemistry: **528 parts** / 29 works
- raw free-text token overlaps (v1): **4 of 656 consumed tokens produced by any part** — the corpus has NO shared chemistry as written (finding F1)
- GLM canonicalization: 1210 raw tokens -> 1044 slugs -> ~90-concept mega vocabulary; 588 IO references fused, 687 left work-private (universal-solvent guard: unknown-collapsed slugs kept private)
- food set STRICT 66 elementary tokens | +45 shared environmental nutrients (NUTRIENT run)
- RAF closure STRICT: 63/528 (11.9%)
- **RAF closure NUTRIENT (primary): 141/528 (26.7%)**
- holes: NO_CATALYST_NO_GATE=324 (islands — consume only private tokens nobody produces),
  BLOCKED_PRODUCER=29 (supplier exists but is itself unclosable),
  NO_PRODUCER=34, IMPORT_ADJACENT=0

## Per-work closure
| work | closed/total | % |
|---|---|---|
| quilt-murmur | 4/28 | 14% |
| exoj | 17/26 | 65% |
| jev-garden | 8/26 | 31% |
| quilt-jev-toolkit | 13/25 | 52% |
| jeviter | 12/24 | 50% |
| quilt-upstream | 4/24 | 17% |
| qthe | 10/22 | 45% |
| crab-traps | 2/22 | 9% |
| quilt-qcells | 8/21 | 38% |
| quilt-organ-workers | 8/20 | 40% |
| jev-quilt | 3/20 | 15% |
| superinstance-site | 2/19 | 11% |
| quilt-jepa | 5/18 | 28% |
| quilt-pincher | 2/18 | 11% |
| external-scouts | 0/17 | 0% |
| fleet-seeds | 8/16 | 50% |
| breakthrough-prospector | 4/16 | 25% |
| craftmind-study | 2/16 | 12% |
| si-fleet | 2/16 | 12% |
| quilt-mcp-receipts | 6/16 | 38% |
| quilt-dba | 4/15 | 27% |
| quilt-quant | 1/14 | 7% |
| quilt-raw | 4/14 | 29% |
| quilt-codespace | 0/14 | 0% |
| quilt-research-canons | 1/14 | 7% |
| MicroMoth-quilt | 5/13 | 38% |
| cot-quilt | 2/12 | 17% |
| quilt-atlas | 1/12 | 8% |
| moth-research | 3/10 | 30% |

## Interpretation (wave-67 lens)
1. F2 (the headline): the 29 works form NEAR-DISJOINT METABOLISMS. Even after
   model-assisted vocabulary fusion, only 27% of parts join a
   self-sustaining closure; 324 parts are islands whose inputs reference
   work-private tokens nobody produces. Decomposition knowledge does NOT yet
   self-sustain across works — each work digests privately.
2. F3 (the wave-66 tie): GATE-AS-CATALYST — the atlas's own 401 recorded gates
   behaved as catalysts and lifted closure 11.7% -> 26.7% under the nutrient
   food set. The gate ontology and autocatalysis are the same object seen
   from two fields. Wave-66's "holes" (127 gateless parts) are exactly this
   model's uncatalyzed reactions.
3. F4 (the queue): ZERO import-adjacent holes survived at fusion granularity —
   cross-work integration will not emerge from vocabulary alignment alone;
   it needs deliberate INTERFACE PARTS (explicit cells whose output IS another
   work's input). That is a design directive for wave-68, not a deficiency.
4. F5 (sensitivity): closure is bracketed [11.9% strict, 26.7% nutrient] —
   the environment (prompts, configs, keys as shared nutrients) matters as
   much as the corpus's own production.
5. F6 (method): LLM-assisted chemistry needs a universal-solvent guard —
   fusing unmappable tokens to one 'unknown' would fake closure; keep them
   private. Honest model-in-the-loop chemistry.

Artifacts: `raf-closure-20261004T100637Z.csv` (row-per-part spreadsheet logic),
this receipt. Sim source: `scripts/w67_rafsim.py` — rerunnable without any
agent (the exoj property), deterministic given the atlas data.
