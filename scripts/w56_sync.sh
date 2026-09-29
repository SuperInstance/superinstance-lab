#!/bin/bash
# wave-56 repo sync after incident #5 rollback — remote is source of truth.
# Token discipline: embed token for fetch, scrub immediately; never print it.
set -u
cd /home/z/my-project
set -a; source .env; set +a
REPOS="fleet-seeds quilt-jepa jev-garden qthe exoj crab-traps quilt-codespace codespace-worker MicroMoth-quilt quilt-playtest quilt-qcells"
for r in $REPOS; do
  if [ ! -d "$r/.git" ]; then echo "SKIP $r (no .git)"; continue; fi
  git -C "$r" remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/SuperInstance/${r}.git"
  git -C "$r" fetch -q origin 2>/dev/null
  RC=$?
  git -C "$r" remote set-url origin "https://github.com/SuperInstance/${r}.git"
  if [ $RC -ne 0 ]; then echo "$r FETCH_FAILED"; continue; fi
  OB=$(git -C "$r" rev-parse --short origin/main 2>/dev/null || echo NONE)
  LO=$(git -C "$r" rev-parse --short HEAD)
  ONLY=$(git -C "$r" log --oneline origin/main..HEAD 2>/dev/null | wc -l | tr -d ' ')
  DIRT=$(git -C "$r" status --porcelain | wc -l | tr -d ' ')
  echo "$r local=$LO origin/main=$OB local_only=$ONLY dirty=$DIRT"
done
