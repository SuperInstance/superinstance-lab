#!/bin/bash
# ============================================================================
# w68_ab_run.sh — orchestrates the wave-68 cell-fleet A/B falsification
#
#   Arm A (baseline): fresh workerd, ADMISSION=lrs,  ROBUST_GATE=0, no fees
#   Arm B (w68):      fresh workerd, ADMISSION=fee,  ROBUST_GATE=1, fees ON
#
# Each arm gets CLEAN GENESIS: .wrangler state wiped between arms. Same task
# corpus (byte-copied from simulate.mjs), same order, same trickle shape.
# Only the chemistry differs. Pre-registered decision rules are embedded in
# the driver (R1-R4) and copied into the receipt BEFORE the comparison.
# ============================================================================
set -u
cd /home/z/my-project/cell-fleet
PIDS=""

cleanup() {
  for p in $PIDS; do kill "$p" 2>/dev/null; done
  sleep 1
  pkill -f "wrangler dev" 2>/dev/null
  return 0
}
trap cleanup EXIT

wait_port() { # wait_port PORT TIMEOUT_S
  local port=$1 t0=$2_end; t0=$2; local end=$((SECONDS + t0))
  while [ $SECONDS -lt $end ]; do
    if curl -s -o /dev/null -m 2 "http://127.0.0.1:$port/health"; then return 0; fi
    sleep 1
  done
  return 1
}

run_arm() { # run_arm LETTER PORT VARARGS...
  local letter=$1 port=$2; shift 2
  echo "=== ARM $letter (port $port, vars: $*) ==="
  rm -rf .wrangler/state
  CI=true WRANGLER_SEND_METRICS=false npx wrangler dev --local --port "$port" "$@" \
      > "/tmp/w68_wrangler_${letter}.log" 2>&1 &
  PIDS="$PIDS $!"
  if ! wait_port "$port" 90; then
    echo "  FATAL: workerd arm $letter failed to become healthy"; tail -20 "/tmp/w68_wrangler_${letter}.log"; return 1
  fi
  echo "  workerd healthy"
  CELL_BASE="http://127.0.0.1:$port" node scripts/w68_ab_replay.mjs --arm "$letter"
  local rc=$?
  echo "  driver rc=$rc"
  curl -s "http://127.0.0.1:$port/tissue" > "/tmp/w68_tissue_${letter}.json" 2>/dev/null
  return $rc
}

run_arm A 8791 --var ADMISSION:lrs --var ROBUST_GATE:0
RC_A=$?
run_arm B 8792 --var ADMISSION:fee --var ROBUST_GATE:1
RC_B=$?
cleanup

echo "=== arms done (A rc=$RC_A, B rc=$RC_B) — comparing ==="
python3 scripts/w68_ab_compare.py
