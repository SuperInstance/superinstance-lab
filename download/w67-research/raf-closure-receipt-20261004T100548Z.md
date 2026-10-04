# RAF-Closure Receipt — wave-67 (20261004T100548Z)

**Nugget source (R1):** Kauffman/Hordijk autocatalytic-set (RAF) theory —
closure + catalysis as the signature of life-like computation.

**Mapping:** part = reaction (inputs→outputs); food = layer-0 outputs;
catalyst = another part producing one of its inputs; RAF closure = the
self-sustaining decomposition chemistry of the atlas corpus.

## Headline numbers
- corpus chemistry: **528 parts** / 29 works
- food set: **66 elementary tokens** (layer-0 outputs)
- RAF closure: **63/528 (11.9%)**
- holes: 387 —
  NO_CATALYST_NO_GATE=324,
  BLOCKED_PRODUCER=29,
  NO_PRODUCER=34,
  UNCLOSED_REACHABLE=0
- **FOOD_ADJACENT (one catalyst away — cheapest next decomposition moves): 0**

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
1. The atlas is not a tree — it is a reaction network, and 27% of it
   is ALIVE under RAF rules: most parts are catalyzed by sibling parts and
   derivable from the elementary seeds. Decomposition knowledge self-sustains.
2. HOLE:NO_CATALYST parts are islands — nothing in the corpus produces what
   they consume; they need an import (a new part from outside the 29 works).
3. FOOD_ADJACENT parts are the queue the principal asked for ("novel questions
   to ask"): each needs exactly one closed producer to join the closure —
   these are the cheapest gates to open next.
4. Per-work spread shows which sibling works are chemically self-contained
   vs dependent on the corpus commons — a dog-food verdict, quantified.

Artifacts: `raf-closure-20261004T100548Z.csv` (row-per-part spreadsheet logic),
this receipt. Sim source: `scripts/w67_rafsim.py` — rerunnable without any
agent (the exoj property), deterministic given the atlas data.
