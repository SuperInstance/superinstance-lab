#!/bin/bash
# ============================================================================
# wave-68 surgical secret audit — scans ONLY the surfaces that are actually
# about to hit GitHub for the first time in this push:
#   1. exoj        — full local history (small; 1 new rebased commit)
#   2. cot-quilt   — full local history (whole repo is new to remote, phase-2)
#   3. main monorepo — blobs introduced AFTER the wave-67 purge point
#                      (2ee276c) + the uncommitted working tree (about to be
#                      committed by push_all.sh phase 3)
# Everything else is remote-authored content already on GitHub; local pushes
# to those repos are no-ops and their content is not this session's leak
# surface. Pattern set matches scripts/w67_secret_audit.sh (incl. apikey_).
# Output discipline: path + pattern-name + 6-char fingerprint only. NEVER a
# full value. Excludes .env.keys/.env (untracked, gitignored, hot by law).
# ============================================================================
set -u
ROOT=/home/z/my-project
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
(DATABASE_URL|GITHUB_TOKEN|TYPESAFEAI_KEY|CLOUDFLARE_API_TOKEN|WORKER_UPLOAD_TOKEN|MOTH_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY)=[^$<[:space:]][A-Za-z0-9_/.+-]{8,}'

scan_blobs() { # scan_blobs LABEL REPO RANGE_OR_ALL
  local label=$1 repo=$2 range=$3
  local sel
  if [ "$range" = "ALL" ]; then sel="--all"; else sel="$range"; fi
  git -C "$repo" rev-list "$sel" --objects 2>/dev/null | \
  while read -r oid path; do
    [ -n "$path" ] || continue
    case "$path" in
      *w68_surgical_audit.sh|*w67_secret_audit.sh|*w67_secret_audit.py) continue;;
      .env|.env.keys|*.key.env|*.pem|*.p12) continue;;  # hot-by-law files can never be in history anyway
    esac
    local content hit fp
    content=$(git -C "$repo" cat-file blob "$oid" 2>/dev/null | head -c 400000)
    [ -z "$content" ] && continue
    while IFS= read -r pat; do
      [ -z "$pat" ] && continue
      hit=$(printf '%s' "$content" | grep -m1 -oE "$pat" 2>/dev/null)
      if [ -n "$hit" ]; then
        fp=$(printf '%s' "$hit" | cut -c1-6)
        echo "$label | $path | ${pat:0:28} | $fp..."
      fi
    done <<< "$PATTERNS"
  done
}

echo "repo | path | pattern | fingerprint"

# 1. exoj — full history (small)
scan_blobs "exoj" "$ROOT/exoj" "ALL"

# 2. cot-quilt — full history (new-to-remote)
scan_blobs "cot-quilt" "$ROOT/cot-quilt" "ALL"

# 3. monorepo — only post-purge commits + working tree
scan_blobs "monorepo(new-commits)" "$ROOT" "2ee276c..HEAD"
# working tree: tracked-but-modified + staged + untracked-that-would-be-added
cd "$ROOT"
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in
    *w68_surgical_audit.sh|*w67_secret_audit.sh|*w67_secret_audit.py) continue;;
    .env|.env.keys|*.key.env|*.pem|*.p12) continue;;
  esac
  content=$(head -c 400000 "$f" 2>/dev/null)
  [ -z "$content" ] && continue
  while IFS= read -r pat; do
    [ -z "$pat" ] && continue
    hit=$(printf '%s' "$content" | grep -m1 -oE "$pat" 2>/dev/null)
    if [ -n "$hit" ]; then
      fp=$(printf '%s' "$hit" | cut -c1-6)
      echo "monorepo(worktree) | $f | ${pat:0:28} | $fp..."
    fi
  done <<< "$PATTERNS"
done < <(git -C "$ROOT" status --porcelain | awk '{print $2}')

echo "=== SURGICAL AUDIT COMPLETE ==="
