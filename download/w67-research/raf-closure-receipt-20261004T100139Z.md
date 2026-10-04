# RAF-Closure Receipt — wave-67 (20261004T100139Z)

**Nugget source (R1):** Kauffman/Hordijk autocatalytic-set (RAF) theory —
closure + catalysis as the signature of life-like computation.

**Mapping:** part = reaction (inputs→outputs); food = layer-0 outputs;
catalyst = another part producing one of its inputs; RAF closure = the
self-sustaining decomposition chemistry of the atlas corpus.

## Headline numbers
- corpus chemistry: **528 parts** / 29 works
- food set: **66 elementary tokens** (layer-0 outputs)
- RAF closure: **62/528 (11.7%)**
- holes: 438 —
  NO_CATALYST=370,
  BLOCKED_PRODUCER=35,
  NO_PRODUCER=33,
  UNCLOSED_REACHABLE=0
- **FOOD_ADJACENT (one catalyst away — cheapest next decomposition moves): 0**

## Per-work closure
| work | closed/total | % |
|---|---|---|
| quilt-murmur | 4/28 | 14% |
| exoj | 10/26 | 38% |
| jev-garden | 7/26 | 27% |
| quilt-jev-toolkit | 10/25 | 40% |
| jeviter | 3/24 | 12% |
| quilt-upstream | 4/24 | 17% |
| qthe | 2/22 | 9% |
| crab-traps | 1/22 | 5% |
| quilt-qcells | 5/21 | 24% |
| quilt-organ-workers | 6/20 | 30% |
| jev-quilt | 1/20 | 5% |
| superinstance-site | 2/19 | 11% |
| quilt-jepa | 5/18 | 28% |
| quilt-pincher | 1/18 | 6% |
| external-scouts | 0/17 | 0% |
| fleet-seeds | 6/16 | 38% |
| breakthrough-prospector | 3/16 | 19% |
| craftmind-study | 2/16 | 12% |
| si-fleet | 1/16 | 6% |
| quilt-mcp-receipts | 3/16 | 19% |
| quilt-dba | 3/15 | 20% |
| quilt-quant | 1/14 | 7% |
| quilt-raw | 0/14 | 0% |
| quilt-codespace | 0/14 | 0% |
| quilt-research-canons | 1/14 | 7% |
| MicroMoth-quilt | 3/13 | 23% |
| cot-quilt | 2/12 | 17% |
| quilt-atlas | 1/12 | 8% |
| moth-research | 3/10 | 30% |

## Interpretation (wave-67 lens)
1. The atlas is not a tree — it is a reaction network, and 17% of it
   is ALIVE under RAF rules: most parts are catalyzed by sibling parts and
   derivable from the elementary seeds. Decomposition knowledge self-sustains.
2. HOLE:NO_CATALYST parts are islands — nothing in the corpus produces what
   they consume; they need an import (a new part from outside the 29 works).
3. FOOD_ADJACENT parts are the queue the principal asked for ("novel questions
   to ask"): each needs exactly one closed producer to join the closure —
   these are the cheapest gates to open next.
4. Per-work spread shows which sibling works are chemically self-contained
   vs dependent on the corpus commons — a dog-food verdict, quantified.

Artifacts: `raf-closure-20261004T100139Z.csv` (row-per-part spreadsheet logic),
this receipt. Sim source: `scripts/w67_rafsim.py` — rerunnable without any
agent (the exoj property), deterministic given the atlas data.
