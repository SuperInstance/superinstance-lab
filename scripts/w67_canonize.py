#!/usr/bin/env python3
# ============================================================================
# wave-67 CHEMISTRY CANONICALIZER — "other models helping"
# Finding F1 (w67_rafsim.py raw run): 656 input tokens vs 557 output tokens
# across the 29-work atlas, only 4 exact overlaps -> the corpus has no shared
# chemistry; each work names its IO in private vocabulary.
# Fix: GLM maps every free-text IO token to a canonical concept slug.
# Output: canonical dictionary + merged chemistry, for RAF re-run (v2).
# ============================================================================
import json, glob, os, sys, time, re, shlex
from collections import defaultdict

ROOT = "/home/z/my-project"
OUT = f"{ROOT}/scripts/w67-research/chem-canonical.json"

# ---- harvest tokens ---------------------------------------------------------
parts = []
for f in sorted(glob.glob(f"{ROOT}/exoj/atlas-data/parts/*/*.json")):
    d = json.load(open(f))
    for p in d.get("parts", []):
        p["_work"] = d.get("work")
        parts.append(p)

tokens = {}   # raw token -> {"io": set, "parts": [...]}
for p in parts:
    for io in ("inputs", "outputs"):
        for t in p.get(io, []):
            if isinstance(t, str) and t.strip():
                t = t.strip()
                e = tokens.setdefault(t, {"io": set(), "parts": []})
                e["io"].add(io); e["parts"].append(p["part_id"])
print(f"harvested {len(tokens)} distinct raw IO tokens from {len(parts)} parts")

# ---- deterministic pre-normalization (cheap wins before the model) ----------
def preslug(t):
    s = t.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s[:48]

# ---- LLM canonicalization in chunks ----------------------------------------
import asyncio
zai_mod = None
async def get_zai():
    global zai_mod
    if zai_mod is None:
        from z_ai_web_dev_sdk import ZAI   # python sdk? fallback below
    return None

# Use the z-ai chat CLI (proven in this container; SDK is bun-global, not node-resolvable)
SYS = ("You are a chemistry normalizer for a decomposition atlas. Each item is a free-text "
       "input/output token from some system part. Map each to ONE canonical concept slug: "
       "lowercase snake_case, singular, generic (e.g. 'user prompt', 'prompt text', "
       "'3 orthographic candidate answers' -> prompt; 'seal verdict', 'verdict string' -> verdict; "
       "'canonical string', 'canonical strings, hashes' -> canonical_string). "
       "Respond with ONLY a JSON object mapping EVERY input token verbatim to its slug. No commentary.")

def run_chunk(chunk_tokens, i):
    fin, fout = f"/tmp/canon_in_{i}.json", f"/tmp/canon_out_{i}.json"
    json.dump(chunk_tokens, open(fin, "w"))
    prompt = "Map these " + str(len(chunk_tokens)) + " tokens to canonical slugs as JSON: " + open(fin).read()
    for attempt in range(3):
        rc = os.system(f"z-ai chat -p {shlex.quote(prompt)} -s {shlex.quote(SYS)} -o {fout} >/tmp/canon_err_{i}.log 2>&1")
        if rc == 0 and os.path.exists(fout):
            try:
                resp = json.load(open(fout))
                txt = resp.get("content") or resp.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
                m = re.search(r"\{.*\}", txt, re.S)
                if m:
                    d = json.loads(m.group(0))
                    return {k: str(v).strip().lower().replace(" ", "_")[:48] for k, v in d.items()}
            except Exception as e:
                print(f"  chunk {i} parse fail: {e}", file=sys.stderr)
        print(f"  chunk {i} attempt {attempt+1} failed; retrying...", file=sys.stderr)
        time.sleep(4)
    return {}

items = sorted(tokens.keys())
CHUNK = 80
chunks = [items[i:i+CHUNK] for i in range(0, len(items), CHUNK)]
print(f"canon {len(items)} tokens in {len(chunks)} chunks via GLM")

canon_map = {}
for i, ch in enumerate(chunks):
    m = run_chunk(ch, i)
    canon_map.update(m)
    covered = sum(1 for t in ch if t in canon_map)
    print(f"  chunk {i+1}/{len(chunks)}: {covered}/{len(ch)} mapped")

json.dump({"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "n_raw_tokens": len(tokens), "map": canon_map,
           "raw_token_meta": {t: {"io": sorted(v["io"]), "parts": sorted(set(v["parts"]))} for t, v in tokens.items()}},
          open(OUT, "w"), indent=1)
miss = [t for t in items if t not in canon_map]
print(f"canonical dictionary -> {OUT}  (unmapped: {len(miss)})")
for t in miss[:10]: print("  UNMAPPED:", t[:80])
