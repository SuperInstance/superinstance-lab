#!/bin/bash
# wave-67 chemistry canonicalization — resumable per-chunk driver.
# Each chunk = one z-ai chat call; outputs persisted per chunk; skips done chunks.
set -u
ROOT=/home/z/my-project
D=/tmp/canonchunks
mkdir -p $D
python3 - << 'PYEOF'
import json, glob
parts = []
for f in sorted(glob.glob("/home/z/my-project/exoj/atlas-data/parts/*/*.json")):
    d = json.load(open(f))
    for p in d.get("parts", []):
        for io in ("inputs", "outputs"):
            for t in p.get(io, []):
                if isinstance(t, str) and t.strip():
                    parts.append(t.strip())
toks = sorted(set(parts))
chunks = [toks[i:i+80] for i in range(0, len(toks), 80)]
for i, ch in enumerate(chunks):
    json.dump(ch, open(f"/tmp/canonchunks/in_{i:02d}.json", "w"))
print(f"{len(toks)} tokens -> {len(chunks)} chunk inputs")
PYEOF

SYS='You are a chemistry normalizer for a decomposition atlas. Each item is a free-text input/output token from some system part. Map each to ONE canonical concept slug: lowercase snake_case, singular, generic (e.g. "user prompt", "prompt text", "3 orthographic candidate answers" -> prompt; "seal verdict", "verdict string" -> verdict; "canonical string", "canonical strings, hashes" -> canonical_string). Respond with ONLY a JSON object mapping EVERY input token verbatim to its slug. No commentary.'

for f in $D/in_*.json; do
  i=$(basename "$f" .json)
  out="$D/out_$i.json"
  [ -s "$out" ] && { echo "skip $i (done)"; continue; }
  P="Map these 80 tokens to canonical slugs as JSON: $(cat $f)"
  if z-ai chat -p "$P" -s "$SYS" -o "$D/raw_$i.json" >/dev/null 2>&1; then
    python3 -c "
import json, re, sys
try:
    r = json.load(open('$D/raw_$i.json'))
    txt = (r.get('choices') or [{}])[0].get('message', {}).get('content') or r.get('content') or ''
    m = re.search(r'\{.*\}', txt, re.S)
    d = json.loads(m.group(0))
    d = {k: str(v).strip().lower().replace(' ','_')[:48] for k,v in d.items()}
    json.dump(d, open('$out','w'))
    print('$i mapped', len(d))
except Exception as e:
    print('$i PARSE_FAIL', e); sys.exit(1)
" || rm -f "$D/raw_$i.json"
  else
    echo "$i CALL_FAIL"
  fi
  sleep 2
done
echo "=== chunk loop complete: $(ls $D/out_*.json 2>/dev/null | wc -l) mapped ==="
