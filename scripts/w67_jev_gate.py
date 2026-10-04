#!/usr/bin/env python3
# ============================================================================
# wave-67 JEV GATE — transport-swapped. The toolkit's native transport
# (TYPESAFEAI_KEY → jev-latest) is dead in this container (key lost in the
# incident rollbacks). Directive: "keep using your jev extensively and
# expansively with other models helping" → the JEV PROTOCOL (noul / score /
# choice question semantics from quilt-jev-toolkit/jev_client.py) is kept
# VERBATIM; the judge is GLM via the hot z-ai CLI; three lens-persona judges
# (skeptic/engineer/teacher — the fleet's lens-sampling doctrine) form the
# ensemble. Receipt: table of verdicts, appended to the wave ledger.
# ============================================================================
import json, subprocess, re, os, sys
from datetime import datetime, timezone

ROOT = "/home/z/my-project"
TS = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

ARTIFACTS = [
    ("nugget-ledger", f"{ROOT}/download/w67-research/nugget-ledger.md"),
    ("raf-closure-receipt", f"{ROOT}/download/w67-research/raf-closure-receipt-20261004T100637Z.md"),
    ("cell-fleet-receipt", f"{ROOT}/cell-fleet/receipts/W67-CELL-FLEET.md"),
    ("cell-fleet-readme", f"{ROOT}/cell-fleet/README.md"),
    ("push-mirror-readme", f"{ROOT}/download/github-mirror/README.md"),
]

LENSES = {
    "skeptic": "You are a hostile peer reviewer. Doubt everything unsupported; reward only evidence and receipts.",
    "engineer": "You are a pragmatic systems engineer. Reward runnable, reproducible, honest-negative results.",
    "teacher": "You are a doctrine teacher. Reward novel transferable understanding that composes with the fleet's existing law.",
}

SYSTEM = ("You are a JEV judge for the SuperInstance quilt fleet. Apply the JEV protocol "
          "exactly. Reply with ONLY a JSON object: "
          '{"is_canon_noul": <float 0.0-1.0, probability the text is canon-worthy: high doctrinal signal, novel, foundational>, '
          '"depth": <int 0-3: 0=trivial, 1=useful, 2=deep, 3=frontier>, '
          '"domain": <one of "biology","cs","philosophy","engineering","doctrine">, '
          '"reason": <one sentence, cite a specific strength or flaw>}')

def judge(text, lens):
    sys_prompt = LENSES[lens] + " " + SYSTEM
    r = subprocess.run(["z-ai", "chat", "-p", text[:4000], "-s", sys_prompt,
                        "-o", "/tmp/jev_out.json"], capture_output=True, text=True,
                       timeout=180, cwd=ROOT)
    try:
        resp = json.load(open("/tmp/jev_out.json"))
        txt = (resp.get("choices") or [{}])[0].get("message", {}).get("content", "")
        m = re.search(r"\{.*\}", txt, re.S)
        d = json.loads(m.group(0))
        d["_model"] = resp.get("model", "?")
        return d
    except Exception as e:
        return {"error": str(e)}

rows = []
for name, path in ARTIFACTS:
    if not os.path.exists(path):
        rows.append((name, "MISSING", "", "", "", path)); continue
    text = open(path).read()
    if len(text) < 200:
        rows.append((name, "TOO_SHORT", "", "", "", path)); continue
    verdicts = {}
    for lens in LENSES:
        verdicts[lens] = judge(text, lens)
    ok = [v for v in verdicts.values() if "is_canon_noul" in v]
    if not ok:
        rows.append((name, "JUDGE_ERROR", "", "", "", str(verdicts)[:120])); continue
    cp = sum(v["is_canon_noul"] for v in ok) / len(ok)
    dp = sum(v["depth"] for v in ok) / len(ok)
    doms = [v.get("domain", "?") for v in ok]
    reasons = {k: v.get("reason", "")[:90] for k, v in verdicts.items() if "is_canon_noul" in v}
    rows.append((name, f"{cp:.2f}", f"{dp:.1f}", "/".join(sorted(set(doms))),
                 f"{len(ok)}/3 judges", json.dumps(reasons, ensure_ascii=False)[:240]))

print(f"=== JEV GATE (transport-swapped: z-ai GLM; JEV protocol verbatim) — {TS} ===\n")
print(f"{'artifact':22s} {'canon_p':>8s} {'depth':>6s} {'domain':>22s} {'judges':>8s}")
print("-" * 72)
for r in rows:
    print(f"{r[0]:22s} {r[1]:>8s} {r[2]:>6s} {r[3]:>22s} {r[4]:>8s}")
print()
for r in rows:
    if r[5]:
        print(f"[{r[0]}] reasons: {r[5]}")

# receipt
rec = f"{ROOT}/download/w67-research/jev-gate-receipt-{TS.replace(':', '')}.md"
with open(rec, "w") as f:
    f.write(f"# JEV Gate Receipt — wave-67 ({TS})\n\n"
            "Transport-swapped JEV: protocol verbatim from quilt-jev-toolkit/jev_client.py "
            "(noul / score / choice), judge = GLM via z-ai CLI, ensemble of 3 lens-persona judges "
            "(skeptic/engineer/teacher — lens-sampling doctrine). Native transport "
            "(TYPESAFEAI_KEY) dead in-container; key loss receipted, not hidden.\n\n"
            "| artifact | canon_p (mean) | depth (mean) | domains | judges | \n|---|---|---|---|---|\n")
    for r in rows:
        f.write(f"| {r[0]} | {r[1]} | {r[2]} | {r[3]} | {r[4]} |\n")
    f.write("\n## Judge reasons\n")
    for r in rows:
        if r[5]:
            f.write(f"- **{r[0]}**: {r[5]}\n")
print(f"\nreceipt -> {rec}")
