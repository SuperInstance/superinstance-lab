#!/usr/bin/env bash
# wave-50 lane 50-c: idle-compute experiment — run the garden's selftest
# inside a GitHub Codespace (the fleet's own harness path, adapted for the
# repo-scoped create endpoint). Receipts to scripts/codespace_garden.log
set -u
export GH_TOKEN=$(grep '^GITHUB_TOKEN=' /home/z/my-project/.env | cut -d= -f2)
export PATH=$HOME/bin:$PATH
CS=vigilant-broccoli-695vx5pwg9q5frppv
echo "[poll] waiting for $CS to leave Provisioning..." 
for i in $(seq 1 36); do
  STATE=$(gh api "user/codespaces/$CS" --jq .state 2>/dev/null || echo unknown)
  echo "[poll $i] state=$STATE"
  [ "$STATE" = "Running" ] || [ "$STATE" = "Shutdown" ] && break
  sleep 10
done
if [ "$STATE" != "Running" ]; then
  echo "[verdict] codespace never reached Running (state=$STATE) — honest receipt, deleting"
  gh api -X DELETE "user/codespaces/$CS" 2>/dev/null || true
  exit 1
fi
echo "[exec] running garden selftest inside codespace..."
gh codespace ssh -c "$CS" -- "git clone --depth 1 https://github.com/SuperInstance/jev-garden.git /tmp/jev-garden && cd /tmp/jev-garden && node tests/selftest.mjs 2>&1 | tail -3 && node smoke.mjs 2>&1 | tail -2 && node experiments/e_g5_determinism.mjs 2>&1 | tail -4" 2>&1 | tee /home/z/my-project/scripts/codespace_exec_output.txt | tail -20
echo "[cleanup] deleting codespace $CS"
gh api -X DELETE "user/codespaces/$CS" 2>/dev/null || true
echo "[done]"
