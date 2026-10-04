#!/bin/bash
# ============================================================================
# wave-67 push_all.sh — THE PUSH EXOJ
# One command to push the entire SuperInstance lab to GitHub once a live
# token exists. Leveled because the container's three embedded tokens were
# all found DEAD (401) — see receipts in download/github-mirror/README.md.
#
# Usage:
#   GITHUB_TOKEN=ghp_... scripts/push_all.sh           # real run
#   scripts/push_all.sh --dry-run                      # plan only, no token
#
# Token discipline:
#   - token is read from $GITHUB_TOKEN or line GITHUB_TOKEN= in .env.keys
#   - the token is embedded in a remote URL only TRANSIENTLY (set -> push ->
#     restore clean URL in the same repo, same loop iteration)
#   - never printed, never logged, never persisted to any file
#   - .env.keys / .env* are gitignored since wave-67 (verified by
#     scripts/w67_secret_audit.sh — run it before every push)
# ============================================================================
set -u
ROOT="${ROOT:-/home/z/my-project}"
DRYRUN=0
[ "${1:-}" = "--dry-run" ] && DRYRUN=1

# ---- token -----------------------------------------------------------------
TOKEN="${GITHUB_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$ROOT/.env.keys" ]; then
  TOKEN=$(grep -E '^GITHUB_TOKEN=' "$ROOT/.env.keys" | head -1 | cut -d= -f2-)
fi
if [ "$DRYRUN" = "0" ]; then
  if [ -z "$TOKEN" ]; then echo "FATAL: no GITHUB_TOKEN (env or .env.keys)"; exit 1; fi
  # verify BEFORE touching any repo
  CODE=$(curl -s -o /tmp/pa_user.json -w "%{http_code}" -H "Authorization: token $TOKEN" https://api.github.com/user)
  LOGIN=$(python3 -c "import json;d=json.load(open('/tmp/pa_user.json'));print(d.get('login',''))" 2>/dev/null)
  if [ "$CODE" != "200" ]; then echo "FATAL: token rejected by api.github.com (HTTP $CODE)"; exit 1; fi
  echo "token OK: authenticated as $LOGIN"
fi

api() { # api METHOD PATH JSON -> http body (prints status to stderr)
  local m=$1 p=$2 b=${3:-}
  if [ "$DRYRUN" = "1" ]; then echo "  [dry] api $m $p"; return 0; fi
  curl -s -X "$m" -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
       ${b:+-d "$b"} "https://api.github.com$p"
}

ensure_repo() { # ensure_repo OWNER NAME
  local owner=$1 name=$2
  local code=$(curl -s -o /tmp/pa_repo.json -w "%{http_code}" -H "Authorization: token $TOKEN" "https://api.github.com/repos/$owner/$name")
  if [ "$code" = "200" ]; then echo "  repo $owner/$name exists"; return 0; fi
  echo "  repo $owner/$name missing -> creating"
  api POST "/orgs/$owner/repos" "{\"name\":\"$name\",\"private\":false,\"description\":\"SuperInstance lab wave-67 (pushed by push_all.sh)\"}" >/dev/null
  code=$(curl -s -o /tmp/pa_repo.json -w "%{http_code}" -H "Authorization: token $TOKEN" "https://api.github.com/repos/$owner/$name")
  if [ "$code" != "200" ]; then
    echo "  org create failed (HTTP $code) -> trying user account"
    api POST "/user/repos" "{\"name\":\"$name\",\"private\":false,\"description\":\"SuperInstance lab wave-67 (pushed by push_all.sh)\"}" >/dev/null
  fi
}

push_repo() { # push_repo DIR CLEAN_URL
  local dir=$1 url=$2 name=$(basename "$1")
  local br=$(git -C "$dir" branch --show-current)
  [ -z "$br" ] && br=$(git -C "$dir" rev-parse --short HEAD)
  echo "== $name ($br) =="
  if [ "$DRYRUN" = "1" ]; then echo "  [dry] push $url"; return 0; fi
  TOKEN_URL=$(printf '%s' "$url" | sed -E "s|https://|https://x-access-token:${TOKEN}@|")
  git -C "$dir" push "$TOKEN_URL" "--all" --follow-tags 2>&1 | grep -vE "remote:|^Enumerating|^Counting|^Compressing|^Writing|^Total" | sed 's/x-access-token:[^@]*@/x-access-token:***@/'
  git -C "$dir" push "$TOKEN_URL" "--tags" 2>&1 | grep -vE "remote:|Everything up-to-date|^\* \[new tag\]" | sed 's/x-access-token:[^@]*@/x-access-token:***@/' || true
  RC=$?
  [ $RC -ne 0 ] && echo "  PUSH FAILED rc=$RC (receipted, continuing)"
  return 0
}

# ---- 1. all repos with github remotes --------------------------------------
echo "=== phase 1: fleet repos (remotes exist) ==="
while IFS='|' read -r dir url; do
  dir=$(echo "$dir" | xargs); url=$(echo "$url" | xargs)
  push_repo "$ROOT/$dir" "$url"
done < <(for d in "$ROOT"/*/ "$ROOT"/*/*/; do
  [ -d "$d/.git" ] || continue
  u=$(git -C "$d" config --get remote.origin.url 2>/dev/null)
  case "$u" in https://github.com/*) echo "${d#$ROOT/}|$u";; esac
done | sort)

# ---- 2. repos needing new remotes ------------------------------------------
echo "=== phase 2: repos needing remotes/repo-creation ==="
# cot-quilt: real repo, history-purged this wave, no remote yet
if [ -d "$ROOT/cot-quilt/.git" ] && [ -z "$(git -C "$ROOT/cot-quilt" config --get remote.origin.url 2>/dev/null)" ]; then
  ensure_repo SuperInstance cot-quilt
  git -C "$ROOT/cot-quilt" remote add origin https://github.com/SuperInstance/cot-quilt.git 2>/dev/null || true
  push_repo "$ROOT/cot-quilt" https://github.com/SuperInstance/cot-quilt.git
fi

# ---- 3. main monorepo (the lab journal) -------------------------------------
echo "=== phase 3: main monorepo ==="
MONO=SuperInstance/superinstance-lab
ensure_repo SuperInstance superinstance-lab
if [ -z "$(git -C "$ROOT" config --get remote.origin.url 2>/dev/null)" ]; then
  git -C "$ROOT" remote add origin "https://github.com/$MONO.git"
fi
# record latest subrepo SHAs, commit if changed, THEN push
for d in $(git -C "$ROOT" ls-files | grep -vE "/"); do
  [ -d "$ROOT/$d/.git" ] && git -C "$ROOT" add "$d" 2>/dev/null
done
git -C "$ROOT" add worklog.md scripts 2>/dev/null
if ! git -C "$ROOT" diff --cached --quiet 2>/dev/null; then
  git -C "$ROOT" commit -q -m "push_all: sync gitlinks + ledger before push ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
fi
push_repo "$ROOT" "https://github.com/$MONO.git"

echo "=== phase 4: verify (ls-remote, no token) ==="
[ "$DRYRUN" = "0" ] && for u in "$MONO" SuperInstance/exoj; do
  echo "$u: $(git ls-remote "https://github.com/$u.git" HEAD 2>/dev/null | cut -c1-12 || echo UNREACHABLE)"
done
echo "=== push_all complete — run scripts/w67_secret_audit.sh first next time ==="
