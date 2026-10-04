#!/usr/bin/env python3
# ============================================================================
# wave-68 JEV NATIVE GATE — the native transport is BACK.
#
# History: wave-67 ran a transport-swapped JEV (protocol verbatim, judge=GLM)
# because TYPESAFEAI_KEY was lost. The key was returned by the principal and
# lives ONLY in /home/z/my-project/.env.keys (gitignored, chmod 600). This
# script restores the NATIVE transport: judge = typesafe.ai JEV via
# POST https://api.typesafe.ai/v1/systemone, Authorization: Bearer.
#
# PROTOCOL FIDELITY LAW: the question set, wire schema, and parsing are
# VERBATIM from quilt-jev-toolkit/jev_client.py canon_gate():
#     is_canon : noul("Is this canon-worthy? (high doctrinal signal, novel, foundational)")
#     depth    : score("Rate the doctrinal depth", ["trivial","useful","deep","frontier"])
#     domain   : choice("Which domain?", {biology, cs, philosophy, engineering, doctrine})
#     canon_p  = answers["is_canon"]["noul"]; depth = answers["depth"]["score"];
#     domain   = answers["domain"]["choice"]
# Transport swap documented: jev_client.py talks to the API directly with
# urllib + Bearer — that IS the native transport, and it is what we use here.
# The only deviations (both receipted in the run output, neither touches the
# protocol): (1) artifacts are chunked at 12,000 chars per the task directive
# (canon_gate's own convenience helper truncates at 4,000; ask() takes
# arbitrary state — chunking scales state size, not protocol); (2) a second
# native judge, jev-preview (from GET /v1/models), is added as a within-family
# ensemble member — same protocol, same questions, different model id.
#
# ENSEMBLE: the same 5 artifacts also go through the wave-67 GLM lens judges
# (skeptic/engineer/teacher via z-ai CLI — transport code reused verbatim from
# scripts/w67_jev_gate.py judge()) so native vs GLM can be compared
# side-by-side against wave-67's receipted values.
#
# KEY DISCIPLINE: TYPESAFEAI_KEY is read from env (or parsed from .env.keys by
# the caller's export). It is NEVER printed, never written to any file, never
# embedded in error strings (incident-law scrubber below). Receipts refer to
# it masked as KEY[:12] + "..." (apikey_221741...).
# ============================================================================
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = "/home/z/my-project"
BASE = "https://api.typesafe.ai"
CHUNK = 12000          # task directive: chunk huge artifacts to ~8-12k chars
TS = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

# ----------------------------- key handling ---------------------------------
KEY = os.environ.get("TYPESAFEAI_KEY", "")
if not KEY:
    # same runtime-read discipline as push_all.sh: env first, .env.keys fallback
    ek = os.path.join(ROOT, ".env.keys")
    if os.path.exists(ek):
        for line in open(ek):
            if line.startswith("TYPESAFEAI_KEY="):
                KEY = line.split("=", 1)[1].strip()
                break
if not KEY:
    print("FATAL: TYPESAFEAI_KEY not available (env or .env.keys)"); sys.exit(1)
MASK = KEY[:12] + "..."  # the ONLY permitted representation of the key

KEY_PAT = re.compile(r"(apikey_[A-Za-z0-9_\-]{8,}|sk-[A-Za-z0-9_\-]{20,})")
def scrub(s):
    return KEY_PAT.sub("[KEY-REDACTED]", str(s))

# ----------------------------- artifacts ------------------------------------
def exoj_wave69_section():
    """(d) exoj/README.md — the Wave-69 section ONLY (task directive)."""
    lines = open(os.path.join(ROOT, "exoj/README.md")).read().splitlines()
    out, inside = [], False
    for ln in lines:
        if ln.startswith("## Wave-69"):
            inside = True
            continue
        if inside and ln.startswith("## "):
            break
        if inside:
            out.append(ln)
    while out and (not out[-1].strip() or set(out[-1].strip()) <= {"-"}):
        out.pop()
    return "\n".join(out).strip()

# (name, kind, value): kind "path" = read file; kind "inline" = body given directly
ARTIFACTS = [
    ("raf-closure-receipt", "path",   f"{ROOT}/download/w67-research/raf-closure-receipt-20261004T100637Z.md"),
    ("cell-fleet-readme",   "path",   f"{ROOT}/cell-fleet/README.md"),
    ("nugget-ledger",       "path",   f"{ROOT}/download/w67-research/nugget-ledger.md"),
    ("exoj-wave69",         "inline", exoj_wave69_section()),  # README wave-69 section ONLY
    ("push-all-sh",         "path",   f"{ROOT}/scripts/push_all.sh"),
]

# wave-67 receipted values (download/w67-research/jev-gate-receipt-2026-10-04T100818Z.md)
# for the side-by-side. push-mirror-readme is the closest wave-67 kin of
# push_all.sh (both are the push exoj) — flagged as related-not-identical.
W67 = {
    "raf-closure-receipt": (0.82, 2.3),
    "cell-fleet-readme":   (0.82, 2.3),
    "nugget-ledger":       (0.77, 2.0),
    "exoj-wave69":         None,          # new artifact this wave
    "push-all-sh":         (0.63, 1.7, "push-mirror-readme"),  # kin, not same file
}

# ----------------------------- native transport ------------------------------
def _hdr():
    # VERBATIM auth shape from jev_client.py _hdr() (Bearer; UA honored)
    return {"Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            "User-Agent": "quilt-jev-toolkit/1.0"}

def native_ask(state, questions, model="jev-latest", timeout=60):
    """VERBATIM jev_client.ask(): POST {model, state, questions} -> parsed JSON."""
    payload = {"state": state, "model": model, "questions": questions}
    data = json.dumps(payload).encode()
    req = urllib.request.Request(BASE + "/v1/systemone", data=data,
                                 method="POST", headers=_hdr())
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=timeout) as r:
        out = json.loads(r.read().decode())
    out["_latency_ms"] = round((time.time() - t0) * 1000)
    return out

# VERBATIM canon_gate question set (jev_client.py lines 87-106)
def canon_questions():
    return {
        "is_canon": {"type": "noul",
                     "instructions": "Is this canon-worthy? (high doctrinal signal, novel, foundational)"},
        "depth": {"type": "score",
                  "instructions": "Rate the doctrinal depth",
                  "criteria": ["trivial", "useful", "deep", "frontier"]},
        "domain": {"type": "choice",
                   "instructions": "Which domain?",
                   "criteria": {"biology": "biological / cellular",
                                "cs": "computer science",
                                "philosophy": "philosophy / metaphysics",
                                "engineering": "engineering practice",
                                "doctrine": "quilt doctrine"}},
    }

def native_canon_gate(text, model):
    """canon_gate over chunked text; protocol identical, chunking receipted."""
    chunks = [text[i:i + CHUNK] for i in range(0, len(text), CHUNK)] or [text]
    per_chunk, errs = [], []
    for ci, ch in enumerate(chunks):
        try:
            r = native_ask(ch, canon_questions(), model=model)
            a = r["answers"]
            per_chunk.append({
                "chunk": ci, "chars": len(ch),
                "canon_p": a["is_canon"]["noul"],
                "depth": a["depth"]["score"],
                "depth_legend": a["depth"].get("legend"),
                "domain": a["domain"]["choice"],
                "domain_probabilities": a["domain"].get("probabilities"),
                "model_served": r.get("model"),
                "usage": r.get("usage"),
                "latency_ms": r["_latency_ms"],
            })
        except urllib.error.HTTPError as e:
            errs.append(scrub(f"chunk{ci} HTTP {e.code}: {e.read().decode()[:160]}"))
        except Exception as e:
            errs.append(scrub(f"chunk{ci} {type(e).__name__}: {e}"))
        time.sleep(0.4)  # politeness; no rate-limit errors observed at probe scale
    if not per_chunk:
        return {"error": "; ".join(errs) or "no chunks judged"}
    n = len(per_chunk)
    agg = {
        "model": model,
        "chunks": per_chunk,
        "errors": errs,
        "canon_p": round(sum(c["canon_p"] for c in per_chunk) / n, 4),
        "depth": round(sum(c["depth"] for c in per_chunk) / n, 3),
        "domain": per_chunk[0]["domain"] if n == 1 else
                  max({c["domain"] for c in per_chunk}, key=lambda d: sum(x["domain"] == d for x in per_chunk)),
        "usage_in": sum((c["usage"] or {}).get("input_tokens", 0) for c in per_chunk),
        "usage_out": sum((c["usage"] or {}).get("output_tokens", 0) for c in per_chunk),
        "latency_ms": sum(c["latency_ms"] for c in per_chunk),
    }
    return agg

# ----------------------------- GLM transport (wave-67 verbatim) --------------
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

def glm_judge(text, lens):
    """Transport code reused VERBATIM from scripts/w67_jev_gate.py judge()."""
    sys_prompt = LENSES[lens] + " " + SYSTEM
    r = subprocess.run(["z-ai", "chat", "-p", text[:CHUNK], "-s", sys_prompt,
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
        return {"error": scrub(str(e))[:200]}

# ----------------------------- run -------------------------------------------
results = {"ts": TS, "mask": MASK, "chunk_limit": CHUNK, "artifacts": {}}

for name, kind, src in ARTIFACTS:
    if kind == "inline":
        text, text_note = src, "inline-section (exoj/README.md '## Wave-69' only)"
    elif os.path.exists(src):
        text = open(src).read()
        text_note = f"{len(text)} chars from {os.path.relpath(src, ROOT)}"
    else:
        results["artifacts"][name] = {"error": "MISSING", "path": src}
        continue
    if len(text) < 200:
        results["artifacts"][name] = {"error": "TOO_SHORT", "source": text_note}
        continue

    print(f"\n=== {name} ({len(text)} chars) ===", flush=True)
    entry = {"source": text_note, "n_chunks": (len(text) + CHUNK - 1) // CHUNK}

    # native: jev-latest (protocol default) + jev-preview (bonus within-family judge)
    for model in ("jev-latest", "jev-preview"):
        v = native_canon_gate(text, model)
        entry[f"native_{model}"] = v
        if "error" not in v:
            print(f"  native {model}: canon_p={v['canon_p']} depth={v['depth']} "
                  f"domain={v['domain']} usage={v['usage_in']}/{v['usage_out']} "
                  f"({v['latency_ms']}ms, {len(v['errors'])} err)", flush=True)
        else:
            print(f"  native {model}: ERROR {v['error'][:160]}", flush=True)

    # GLM ensemble (3 lens-persona judges — wave-67 transport, sequential: the
    # z-ai function rate-limits parallel calls, receipted in wave-67-r)
    glm = {}
    for lens in LENSES:
        glm[lens] = glm_judge(text, lens)
        time.sleep(0.5)
    ok = [v for v in glm.values() if "is_canon_noul" in v]
    entry["glm"] = glm
    if ok:
        entry["glm_canon_p"] = round(sum(v["is_canon_noul"] for v in ok) / len(ok), 4)
        entry["glm_depth"] = round(sum(v["depth"] for v in ok) / len(ok), 3)
        entry["glm_domains"] = sorted({v.get("domain", "?") for v in ok})
        entry["glm_ok"] = f"{len(ok)}/3"
        print(f"  glm: canon_p={entry['glm_canon_p']} depth={entry['glm_depth']} "
              f"domains={entry['glm_domains']} ({entry['glm_ok']} judges)", flush=True)
    else:
        entry["glm_canon_p"] = entry["glm_depth"] = None
        print("  glm: ALL JUDGES FAILED", flush=True)

    results["artifacts"][name] = entry

# ----------------------------- ensemble analysis -----------------------------
# disagreement rule: |native_mean - glm_mean| >= 0.15 on canon_p, or depth gap >= 1
DISSENT_P = 0.15
DISSENT_D = 1.0
comparison = {}
for name, entry in results["artifacts"].items():
    if "error" in entry and "native_jev-latest" not in entry:
        comparison[name] = {"error": entry["error"]}
        continue
    nl = entry.get("native_jev-latest", {})
    np_ = entry.get("native_jev-preview", {})
    native_p = round(((nl.get("canon_p", 0) + np_.get("canon_p", 0)) / 2), 4) \
        if "error" not in nl and "error" not in np_ else (nl.get("canon_p") if "error" not in nl else None)
    native_d = round(((nl.get("depth", 0) + np_.get("depth", 0)) / 2), 3) \
        if "error" not in nl and "error" not in np_ else (nl.get("depth") if "error" not in nl else None)
    gp, gd = entry.get("glm_canon_p"), entry.get("glm_depth")
    w67v = W67.get(name)
    row = {
        "native_p": native_p, "native_d": native_d,
        "latest_p": nl.get("canon_p") if "error" not in nl else None,
        "latest_d": nl.get("depth") if "error" not in nl else None,
        "preview_p": np_.get("canon_p") if "error" not in np_ else None,
        "preview_d": np_.get("depth") if "error" not in np_ else None,
        "glm_p": gp, "glm_d": gd,
        "w67": ({"p": w67v[0], "d": w67v[1], "kin": w67v[2]} if w67v and len(w67v) == 3
                else ({"p": w67v[0], "d": w67v[1]} if w67v else None)),
    }
    if native_p is not None and gp is not None:
        row["gap_p"] = round(abs(native_p - gp), 4)
        row["gap_d"] = round(abs((native_d or 0) - gd), 3)
        row["disagree"] = bool(row["gap_p"] >= DISSENT_P or row["gap_d"] >= DISSENT_D)
        # sharp dissent: the GLM lens verdict farthest from the native canon_p
        if row["disagree"]:
            best, bestd = None, -1
            for lens, v in entry["glm"].items():
                if "is_canon_noul" not in v:
                    continue
                d = abs(v["is_canon_noul"] - native_p)
                if d > bestd:
                    best, bestd = (lens, v), d
            if best:
                row["dissent"] = {"lens": best[0],
                                  "glm_p": best[1]["is_canon_noul"],
                                  "glm_depth": best[1]["depth"],
                                  "reason": best[1].get("reason", "")[:300]}
    comparison[name] = row

results["comparison"] = comparison
results["disagreement_rule"] = f"|native_p - glm_p| >= {DISSENT_P} or |native_d - glm_d| >= {DISSENT_D}"

with open("/tmp/w68_jev_results.json", "w") as f:
    json.dump(results, f, indent=2)

# ----------------------------- console summary -------------------------------
print("\n=== ENSEMBLE TABLE (native-typesafe vs GLM vs wave-67) ===")
hdr = (f"{'artifact':22s} {'nat-latest':>10s} {'nat-prev':>9s} {'native':>7s} "
       f"{'GLM':>6s} {'GLMd':>5s} {'w67':>12s} {'disagree':>8s}")
print(hdr)
for name, r in comparison.items():
    if "error" in r:
        print(f"{name:22s} ERROR {r['error'][:40]}"); continue
    f2 = lambda x: f"{x:.2f}" if isinstance(x, (int, float)) else "n/a"
    w67s = f"{r['w67']['p']:.2f}/{r['w67']['d']:.1f}" + (f" ({r['w67']['kin'][:7]})" if r['w67'].get('kin') else "") if r["w67"] else "new"
    print(f"{name:22s} {f2(r['latest_p']):>10s} {f2(r['preview_p']):>9s} "
          f"{f2(r['native_p']):>7s} {f2(r['glm_p']):>6s} {f2(r['glm_d']):>5s} "
          f"{w67s:>12s} {str(r.get('disagree','-')):>8s}")

print("\n=== DISSENTS (one sharp GLM dissent per disagreeing artifact) ===")
for name, r in comparison.items():
    if r.get("dissent"):
        d = r["dissent"]
        print(f"[{name}] native_p={r['native_p']} vs GLM/{d['lens']}_p={d['glm_p']}: \"{d['reason']}\"")

print(f"\nresults -> /tmp/w68_jev_results.json")
