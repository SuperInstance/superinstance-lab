#!/bin/bash
# wave-67 pre-push secret audit — scans tracked content AND all history of every
# repo under /home/z/my-project for high-signal credential patterns.
# Output discipline: repo, path, pattern-name, and a 6-char fingerprint only.
# Never prints a full secret value.
set -u
ROOT=/home/z/my-project
AUDIT=/home/z/my-project/scripts/w67_secret_audit.py

# Pattern set: name -> extended regex (PCRE via grep -P not portable; use egrep-safe alternations)
PATTERNS='github_pat_[A-Za-z0-9_]{20,}
ghp_[A-Za-z0-9]{20,}
gho_[A-Za-z0-9]{20,}
ghs_[A-Za-z0-9]{20,}
apikey_[A-Za-z0-9_]{20,}
sk-[A-Za-z0-9]{20,}
sk-proj-[A-Za-z0-9_-]{20,}
AKIA[0-9A-Z]{16}
xox[bpars]-[A-Za-z0-9-]{10,}
-----BEGIN [A-Z ]*PRIVATE KEY
cf_[A-Za-z0-9_-]{30,}
eyJhbGciOiJIUzI1NiIs[A-Za-z0-9_-]{20,}
postgres(ql)?://[^[:space:]]+:[^[:space:]]+@
mysql://[^[:space:]]+:[^[:space:]]+@
mongodb(\+srv)?://[^[:space:]]+:[^[:space:]]+@
(DATABASE_URL|GITHUB_TOKEN|CLOUDFLARE_API_TOKEN|DEEPINFRA_KEY|DEEPINFRA_API_KEY|WORKER_UPLOAD_TOKEN|MOTH_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)=[^$<[:space:]][A-Za-z0-9_/.+-]{8,}'

echo "repo | path | pattern | fingerprint"
for repo in "$ROOT" "$ROOT"/*/ "$ROOT"/*/*/; do
  [ -d "$repo/.git" ] || continue
  RNAME=${repo#$ROOT/}; RNAME=${RNAME:-main-monorepo}
  # all blobs in history (complete audit, not just HEAD)
  git -C "$repo" rev-list --all --objects 2>/dev/null | \
  while read -r oid path; do
    [ -n "$path" ] || continue
    case "$path" in *w67_secret_audit.sh) continue;; esac  # skip self (contains the pattern literals)
    content=$(git -C "$repo" cat-file blob "$oid" 2>/dev/null | head -c 400000)
    [ -z "$content" ] && continue
    while IFS= read -r pat; do
      [ -z "$pat" ] && continue
      hit=$(printf '%s' "$content" | grep -m1 -oE "$pat" 2>/dev/null)
      if [ -n "$hit" ]; then
        fp=$(printf '%s' "$hit" | cut -c1-6)
        echo "$RNAME | $path | ${pat:0:28} | $fp..."
      fi
    done <<< "$PATTERNS"
  done
done | sort -u
echo "=== AUDIT SWEEP COMPLETE ==="
