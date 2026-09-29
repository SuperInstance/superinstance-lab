#!/bin/bash
# wave-56 recovery pass 2: fix quilt-jepa remote, preserve playtest local line, hard-sync, clone missing
set -u
cd /home/z/my-project
set -a; source .env; set +a

echo "=== quilt-jepa: re-attach origin ==="
cd quilt-jepa
git remote add origin "https://github.com/SuperInstance/quilt-jepa.git" 2>/dev/null
git fetch -q "https://x-access-token:${GITHUB_TOKEN}@github.com/SuperInstance/quilt-jepa.git" "refs/heads/*:refs/remotes/origin/*" 2>/dev/null
git remote set-url origin "https://github.com/SuperInstance/quilt-jepa.git"
if git rev-parse -q --verify origin/main >/dev/null; then
  git merge-base --is-ancestor HEAD origin/main && ANCESTOR=yes || ANCESTOR=no
  echo "local 6896b77 ancestor of origin/main: $ANCESTOR"
  git clean -fdq; git reset --hard -q origin/main
  echo "quilt-jepa now $(git rev-parse --short HEAD) dirty=$(git status --porcelain | wc -l | tr -d ' ')"
else
  echo "quilt-jepa FETCH_FAILED"
fi
cd ..

echo "=== quilt-playtest: backup + sync ==="
cd quilt-playtest
git branch -f backup/local-c694291 main
git clean -fdq; git reset --hard -q origin/main
echo "quilt-playtest now $(git rev-parse --short HEAD) (backup branch backup/local-c694291 holds old line)"
cd ..

echo "=== hard-sync local_only=0 repos ==="
for r in fleet-seeds jev-garden qthe exoj crab-traps quilt-codespace codespace-worker MicroMoth-quilt quilt-qcells; do
  git -C "$r" clean -fdq
  git -C "$r" reset --hard -q origin/main
  echo "$r -> $(git -C $r rev-parse --short origin/main) dirty=$(git -C $r status --porcelain | wc -l | tr -d ' ')"
done

echo "=== clone missing ==="
for r in breakthrough-prospector quilt-research-canons quilt-atlas; do
  if [ ! -d "$r/.git" ]; then
    git clone -q "https://github.com/SuperInstance/${r}.git" && echo "cloned $r @ $(git -C $r rev-parse --short HEAD)" || echo "CLONE_FAILED $r"
  else
    echo "exists $r"
  fi
done
