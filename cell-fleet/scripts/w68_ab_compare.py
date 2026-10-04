#!/usr/bin/env python3
# ============================================================================
# w68_ab_compare.py — applies the PRE-REGISTERED decision rules (R1-R4) to the
# two arm JSONs and appends the timestamped receipt to receipts/W68-AB-REPLAY.md.
# Rules were fixed in w68_ab_replay.mjs BEFORE any run (house law). This script
# never tunes anything; it reads, judges, receipts.
# ============================================================================
import json
import os
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TS = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
RECEIPT = os.path.join(ROOT, "receipts", "W68-AB-REPLAY.md")


def load(arm):
    p = os.path.join(ROOT, "scripts", f"w68-ab-arm{arm}.json")
    if not os.path.exists(p):
        return None
    with open(p) as f:
        return json.load(f)


a = load("A")
b = load("B")
if not a or not b:
    print("FATAL: missing arm JSON(s); aborting without receipt")
    raise SystemExit(1)

lines = []
lines.append(f"\n\n---\n# W68 A/B REPLAY — {TS}\n")
lines.append("Pre-registered decision rules (fixed in `scripts/w68_ab_replay.mjs` BEFORE the runs):\n")
lines.append("- **R1 (primary)**: mean reward of tasks 51-60; **B wins iff last10(B) > last10(A) + 0.02**")
lines.append("- **R2**: B final live population >= 2 (no extinction)")
lines.append("- **R3**: B mitosis >= 1 (robustness gate must not freeze the lineage)")
lines.append("- **R4**: honest-negative clause — if B fails R1, the chemistry is REJECTED at this corpus scale; no rerun tuning\n")
lines.append(f"| metric | arm A (lrs, no gate) | arm B (fee, robust gate) |")
lines.append("|---|---|---|")
rows = [
    ("first-10 mean reward", a["reward"]["first10"], b["reward"]["first10"]),
    ("last-10 mean reward (R1)", a["reward"]["last10"], b["reward"]["last10"]),
    ("all-task mean reward", a["reward"]["all"], b["reward"]["all"]),
    ("tasks ok / failed", f"{a['taskStats']['ok']}/{a['taskStats']['failures']}", f"{b['taskStats']['ok']}/{b['taskStats']['failures']}"),
    ("genome hash changes", a["taskStats"]["hashChanges"], b["taskStats"]["hashChanges"]),
    ("final population (R2)", a["tissue"]["population"], b["tissue"]["population"]),
    ("max generation", a["tissue"]["maxGeneration"], b["tissue"]["maxGeneration"]),
    ("mitosis events (R3)", a["tissue"]["mitosis"], b["tissue"]["mitosis"]),
    ("apoptosis events", a["tissue"]["apoptosis"], b["tissue"]["apoptosis"]),
    ("graves: starvation", a["tissue"]["causeSplit"].get("starvation", 0), b["tissue"]["causeSplit"].get("starvation", 0)),
    ("graves: low-affinity", a["tissue"]["causeSplit"].get("low-affinity", 0), b["tissue"]["causeSplit"].get("low-affinity", 0)),
    ("lineage edges", a["tissue"]["lineageEdges"], b["tissue"]["lineageEdges"]),
    ("trickle feeds", a["corpus"]["trickleFeeds"], b["corpus"]["trickleFeeds"]),
]
for name, va, vb in rows:
    lines.append(f"| {name} | {va} | {vb} |")

# --- apply the rules ---
last10_a, last10_b = a["reward"]["last10"], b["reward"]["last10"]
r1 = (last10_b is not None) and (last10_a is not None) and (last10_b > last10_a + 0.02)
r2 = (b["tissue"]["population"] or 0) >= 2
r3 = (b["tissue"]["mitosis"] or 0) >= 1
verdict = "PASS" if (r1 and r2 and r3) else "REJECTED (R4 honest-negative stands)"

lines.append("\n## Verdict (pre-registered rules, applied mechanically)\n")
lines.append(f"- R1: last10 B={last10_b} vs A={last10_a} (margin needed +0.02) → **{'PASS' if r1 else 'FAIL'}**")
lines.append(f"- R2: population B={b['tissue']['population']} → **{'PASS' if r2 else 'FAIL'}**")
lines.append(f"- R3: mitosis B={b['tissue']['mitosis']} → **{'PASS' if r3 else 'FAIL'}**")
lines.append(f"\n**VERDICT: {verdict}**\n")

# --- honest reading ---
sa = a["tissue"]["causeSplit"]; sb = b["tissue"]["causeSplit"]
lines.append("## Reading (receipted, no spin)\n")
lines.append(
    f"- Fee-admission concentrates food: arm A starved {sa.get('starvation', 0)} cells, "
    f"arm B starved {sb.get('starvation', 0)} (low-affinity deaths A={sa.get('low-affinity', 0)}, B={sb.get('low-affinity', 0)}). "
    "Concentration is SUPPOSED to raise starvation deaths while raising mean reward — that is selection, "
    "not a bug; the pre-registered rules judge it on reward + persistence, not on death counts."
)
lines.append(
    f"- Robustness gate: B ran {b['tissue']['mitosis']} mitoses across {b['tissue']['maxGeneration']} generations "
    f"(A: {a['tissue']['mitosis']} across {a['tissue']['maxGeneration']}). "
    + ("The gate did not freeze the lineage." if r3 else "The gate DID freeze the lineage — R3 fail.")
)
lines.append(
    f"- 68-d's claim under test (Q9): mutation noise σ_m≈2.3× landscape contrast σ_c ⇒ selection should favor "
    f"robust plateaus. {'The A/B SUPPORTS gating on robustness for this corpus.' if r1 else 'At this corpus scale the A/B does NOT support the gated chemistry (R4).'}"
)
lines.append("\nArtifacts: `scripts/w68-ab-armA.json`, `scripts/w68-ab-armB.json` (full per-task streams), "
             "wrangler logs at `/tmp/w68_wrangler_{A,B}.log`, tissue snapshots `/tmp/w68_tissue_{A,B}.json`.\n")
lines.append("Chemistry knobs live in `wrangler.toml` [vars] (defaults = baseline); arms were overridden at the "
             "runtime surface via `wrangler dev --var`, so the committed defaults stay wave-67-compatible.\n")

with open(RECEIPT, "a") as f:
    f.write("\n".join(lines))

print("\n".join(lines[:30]))
print(f"\nreceipt -> {RECEIPT}")
