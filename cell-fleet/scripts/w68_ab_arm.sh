#!/bin/bash
# ============================================================================
# w68_ab_arm.sh — run ONE arm of the wave-68 A/B in the FOREGROUND (bounded).
# House lesson (receipted wave-67-r and re-learned wave-68): long background
# jobs die silently in this sandbox — every stage must be a foreground call.
#
# Usage: bash scripts/w68_ab_arm.sh A 8791 --var ADMISSION:lrs --var ROBUST_GATE:0
# ============================================================================
set -u
cd /home/z/my-project/cell-fleet
LETTER=${1:?arm letter}
PORT=${2:?port}
shift 2

echo "=== ARM $LETTER (port $PORT, vars: $*) ==="
rm -rf .wrangler/state

CI=true WRANGLER_SEND_METRICS=false npx wrangler dev --local --port "$PORT" "$@" \
    > "/tmp/w68_wrangler_${LETTER}.log" 2>&1 &
WPID=$!
trap 'kill $WPID 2>/dev/null; sleep 1; pkill -f "workerd" 2>/dev/null; true' EXIT

# health wait (bounded, foreground)
HEALTHY=0
for i in $(seq 1 60); do
  if curl -s -o /dev/null -m 2 "http://127.0.0.1:$PORT/health"; then HEALTHY=1; break; fi
  sleep 1
done
if [ "$HEALTHY" != "1" ]; then
  echo "FATAL: workerd arm $LETTER not healthy in 60s; log tail:"; tail -20 "/tmp/w68_wrangler_${LETTER}.log"
  exit 1
fi
echo "  workerd healthy (waited ${i}s)"

CELL_BASE="http://127.0.0.1:$PORT" node scripts/w68_ab_replay.mjs --arm "$LETTER"
RC=$?
curl -s "http://127.0.0.1:$PORT/tissue" > "/tmp/w68_tissue_${LETTER}.json" 2>/dev/null
kill $WPID 2>/dev/null; sleep 1; pkill -f "workerd" 2>/dev/null
trap - EXIT
echo "=== ARM $LETTER done (rc=$RC) ==="
exit $RC
