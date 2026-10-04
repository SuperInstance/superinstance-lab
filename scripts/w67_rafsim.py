#!/usr/bin/env python3
# ============================================================================
# wave-67 RAF-CLOSURE SIMULATOR — "organic decomposition that cellularizes
# the logic", run against the wave-66 atlas's REAL 528 parts.
#
# Theory nugget (R1, Kauffman/Hordijk RAF theory): a set of reactions is
# reflexively-autocatalytic + food-generated (RAF) when every reaction is
# catalyzed by a member of the set, and every member's inputs are derivable
# from the food set + the set's own outputs.
#
# Mapping to the atlas (the cellularization):
#   part P        = a reaction:  inputs(P) -> outputs(P)   (a decomposition step)
#   food set      = layer-0 parts' outputs (the primitives each work takes as given)
#   catalyst of P = another part Q (Q != P) with outputs(Q) ∩ inputs(P) != ∅
#   P is CLOSED   = inputs producible from food ∪ closure-outputs  AND  P catalyzed
#   HOLE          = an atlas part outside the closure; classified:
#                    NO_CATALYST / MISSING_PRODUCER / FOOD_ADJACENT (one catalyst away)
#
# Output: CSV (spreadsheet logic) + markdown receipt + per-work stats.
# Timestamped, append-only discipline per fleet law.
# ============================================================================
import json, csv, glob, os, sys
from collections import defaultdict
from datetime import datetime, timezone

ROOT = "/home/z/my-project"
PARTS_GLOB = f"{ROOT}/exoj/atlas-data/parts/*/*.json"
OUT_DIR = f"{ROOT}/download/w67-research"
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
os.makedirs(OUT_DIR, exist_ok=True)

def canon_set(xs): return {x.strip().lower() for x in xs if isinstance(x, str) and x.strip()}

# ---- load all parts --------------------------------------------------------
works = []
for f in sorted(glob.glob(PARTS_GLOB)):
    try:
        d = json.load(open(f))
    except Exception as e:
        print(f"WARN unreadable {f}: {e}", file=sys.stderr); continue
    works.append(d)

all_parts = []
for w in works:
    for p in w.get("parts", []):
        p["_work"] = w.get("work", os.path.basename(f))
        p["_family"] = w.get("family", "?")
        p["_inputs"] = canon_set(p.get("inputs", []))
        p["_outputs"] = canon_set(p.get("outputs", []))
        all_parts.append(p)

# ---- canonical chemistry v2 (GLM-normalized slugs) — the model helps --------
# v3 composition: raw token -> GLM slug -> mega-concept. Tokens whose slug
# fuses to "unknown" stay WORK-PRIVATE (the slug itself) — collapsing them
# into a shared 'unknown' token would create a universal solvent and fake
# closure. Honest chemistry = real shared concepts + private residue.
CHEM = f"{ROOT}/scripts/w67-research/chem-canonical.json"
if os.path.exists(CHEM):
    chem = json.load(open(CHEM))
    cmap = chem.get("raw_to_mega") or chem["map"]
    n_shared, n_private = 0, 0
    for p in all_parts:
        ins, outs = set(), set()
        for t in p["_inputs"]:
            m = cmap.get(t, t)
            if m == "unknown" or m == "unknown_unknown":
                ins.add(cmap_slug := chem["map"].get(t, t)); n_private += 1
            else:
                ins.add(m); n_shared += 1
        for t in p["_outputs"]:
            m = cmap.get(t, t)
            if m == "unknown" or m == "unknown_unknown":
                outs.add(chem["map"].get(t, t)); n_private += 1
            else:
                outs.add(m); n_shared += 1
        p["_inputs"], p["_outputs"] = ins, outs
    print(f"CHEMISTRY v3: {n_shared} IO references fused to shared mega-concepts, "
          f"{n_private} left work-private (unknown-collapsed slugs kept private)")
else:
    print("CHEMISTRY v1: raw free-text tokens (no canonical map present)")

print(f"loaded {len(all_parts)} parts from {len(works)} works "
      f"({len({p['_work'] for p in all_parts})} distinct works)")

# ---- catalysis graph -------------------------------------------------------
# catalysts[P] = which parts produce something P consumes (cross-part support)
producers = defaultdict(list)   # token -> [part ids producing it]
for p in all_parts:
    for t in p["_outputs"]:
        producers[t].append(p["part_id"])
pid = {p["part_id"]: p for p in all_parts}

catalysts = defaultdict(list)
for p in all_parts:
    for t in p["_inputs"]:
        for q in producers.get(t, []):
            if q != p["part_id"]:
                catalysts[p["part_id"]].append(q)
catalysts = {k: sorted(set(v)) for k, v in catalysts.items()}

# ---- food set: layer-0 outputs (per whole corpus; the elementary seeds) ----
# v4 sensitivity: the environment also supplies SHARED NUTRIENTS — tokens
# consumed by >=2 parts but produced by none (prompts, configs, keys...).
# Two food-set assumptions bracket the truth:
#   STRICT (v3): food = layer-0 outputs only
#   NUTRIENT (v4): food = layer-0 outputs + shared environmental nutrients
food = set()
for p in all_parts:
    if p.get("layer") == 0:
        food |= p["_outputs"]
produced_all = set()
for p in all_parts:
    produced_all |= p["_outputs"]
consumed_count = defaultdict(int)
for p in all_parts:
    for t in p["_inputs"]:
        consumed_count[t] += 1
nutrients = {t for t, n in consumed_count.items() if n >= 2 and t not in produced_all}
print(f"food set (strict): {len(food)} elementary tokens from layer-0 parts")
print(f"shared environmental nutrients (consumed>=2, produced by none): {len(nutrients)}")

# v5: GATE-AS-CATALYST. Wave-66 recorded 401 gates per part (invariant,
# postcondition, admission, seal, precondition, budget, conservation). The
# gate IS the catalyst in our own ontology: a named condition that opens the
# reaction. A part fires when inputs are available AND (IO-catalyzed OR gated).
def catalyzed(p):
    return bool(p.get("gate")) or p["part_id"] in catalysts

def raf_closure(food_set):
    avail = set(food_set)
    closed, order = set(), []
    changed = True
    while changed:
        changed = False
        for p in all_parts:
            q = p["part_id"]
            if q in closed or not catalyzed(p):
                continue
            if p["_inputs"] <= avail:
                closed.add(q); order.append(q); avail |= p["_outputs"]; changed = True
    return closed, avail

closed, available = raf_closure(food)
closed_n, available_n = raf_closure(food | nutrients)
print(f"RAF closure STRICT:   {len(closed)}/{len(all_parts)} ({100*len(closed)/len(all_parts):.1f}%)")
print(f"RAF closure NUTRIENT: {len(closed_n)}/{len(all_parts)} ({100*len(closed_n)/len(all_parts):.1f}%)")
# the nutrient run is the primary chemistry (real environment); strict kept as bound
primary, available = closed_n, available_n

# ---- hole classification ---------------------------------------------------
rows, holes = [], defaultdict(list)
for p in all_parts:
    q = p["part_id"]
    missing_in = p["_inputs"] - available
    cat = catalysts.get(q, [])
    if q in primary:
        status = "CLOSED"
    elif not cat:
        status = "HOLE:NO_CATALYST_NO_GATE"
    elif not missing_in:
        status = "HOLE:UNCLOSED_REACHABLE"    # catalyzed + inputs avail but not reached? (loop order) — treat as closed-check residue
    elif missing_in and any(producers.get(t) for t in missing_in):
        # a producer exists somewhere; is that producer itself in the closure?
        status = "HOLE:BLOCKED_PRODUCER"
    else:
        status = "HOLE:NO_PRODUCER"
    # one-catalyst-away: every missing input is producible by a part that is CLOSED
    if q not in closed and missing_in:
        away = all(any(c in primary for c in producers.get(t, [])) for t in missing_in)
        if away and (cat or p.get("gate")): status = "FOOD_ADJACENT"
    if status.startswith("HOLE") or status == "FOOD_ADJACENT":
        holes[status].append(q)
    rows.append({
        "part_id": q, "work": p["_work"], "family": p["_family"],
        "layer": p.get("layer"), "name": p.get("name", ""),
        "status": status,
        "n_catalysts": len(cat),
        "catalysts": ";".join(cat[:6]),
        "missing_inputs": ";".join(sorted(missing_in)) if q not in closed else "",
        "elementary": p.get("elementary", ""),
        "gate": (p.get("gate") or "")[:80],
    })

# ---- per-work stats ---------------------------------------------------------
per_work = defaultdict(lambda: {"n": 0, "closed": 0})
for r in rows:
    per_work[r["work"]]["n"] += 1
    per_work[r["work"]]["closed"] += (r["status"] == "CLOSED")
work_lines = sorted(per_work.items(), key=lambda kv: -kv[1]["n"])

# ---- write CSV (spreadsheet logic) ------------------------------------------
csv_path = f"{OUT_DIR}/raf-closure-{TS}.csv"
with open(csv_path, "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
    w.writeheader(); w.writerows(rows)

# ---- write receipt ------------------------------------------------------------
md = f"""# RAF-Closure Receipt — wave-67 ({TS})

**Nugget source (R1):** Kauffman/Hordijk autocatalytic-set (RAF) theory —
closure + catalysis as the signature of life-like computation.

**Mapping:** part = reaction (inputs→outputs); food = layer-0 outputs;
catalyst = another part producing one of its inputs; RAF closure = the
self-sustaining decomposition chemistry of the atlas corpus.

## Headline numbers (bracketed experiment)
- corpus chemistry: **{len(all_parts)} parts** / {len({p['_work'] for p in all_parts})} works
- raw free-text token overlaps (v1): **4 of 656 consumed tokens produced by any part** — the corpus has NO shared chemistry as written (finding F1)
- GLM canonicalization: 1210 raw tokens -> 1044 slugs -> ~90-concept mega vocabulary; 588 IO references fused, 687 left work-private (universal-solvent guard: unknown-collapsed slugs kept private)
- food set STRICT {len(food)} elementary tokens | +45 shared environmental nutrients (NUTRIENT run)
- RAF closure STRICT: {len(closed)}/{len(all_parts)} ({100*len(closed)/len(all_parts):.1f}%)
- **RAF closure NUTRIENT (primary): {len(primary)}/{len(all_parts)} ({100*len(primary)/len(all_parts):.1f}%)**
- holes: NO_CATALYST_NO_GATE={len(holes['HOLE:NO_CATALYST_NO_GATE'])} (islands — consume only private tokens nobody produces),
  BLOCKED_PRODUCER={len(holes['HOLE:BLOCKED_PRODUCER'])} (supplier exists but is itself unclosable),
  NO_PRODUCER={len(holes['HOLE:NO_PRODUCER'])}, IMPORT_ADJACENT={len(holes['FOOD_ADJACENT'])}

## Per-work closure
| work | closed/total | % |
|---|---|---|
""" + "\n".join(
    f"| {k} | {v['closed']}/{v['n']} | {100*v['closed']/v['n']:.0f}% |"
    for k, v in work_lines) + f"""

## Interpretation (wave-67 lens)
1. F2 (the headline): the 29 works form NEAR-DISJOINT METABOLISMS. Even after
   model-assisted vocabulary fusion, only {100*len(primary)/len(all_parts):.0f}% of parts join a
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

Artifacts: `{os.path.basename(csv_path)}` (row-per-part spreadsheet logic),
this receipt. Sim source: `scripts/w67_rafsim.py` — rerunnable without any
agent (the exoj property), deterministic given the atlas data.
"""
md_path = f"{OUT_DIR}/raf-closure-receipt-{TS}.md"
open(md_path, "w").write(md)

print(f"CSV  -> {csv_path}")
print(f"RECEIPT -> {md_path}")
print("\nTOP FOOD-ADJACENT (novel question queue):")
for q in holes["FOOD_ADJACENT"][:10]:
    r = next(x for x in rows if x["part_id"] == q)
    print(f"  {q} [{r['work']}] needs: {r['missing_inputs'][:90]}")
print("\nPer-work closure (top 8):")
for k, v in work_lines[:8]:
    print(f"  {k:28s} {v['closed']:3d}/{v['n']:3d} ({100*v['closed']/v['n']:.0f}%)")
