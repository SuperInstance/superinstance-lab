#!/usr/bin/env python3
# ============================================================================
# wave-68 probe — is the NATIVE typesafe.ai transport alive again?
# The key (TYPESAFEAI_KEY) lives ONLY in /home/z/my-project/.env.keys and is
# loaded into the environment by the caller; it is NEVER printed, logged, or
# written to any artifact. Every receipt line refers to it masked as the
# first 12 chars + "..." (per the task law: apikey_221741...).
#
# Probe plan (budget-conscious, every attempt receipted with status code):
#   A) GET  /v1/models        auth=Authorization: Bearer     -> model list
#   B) POST /v1/systemone     auth=Bearer, minimal noul      -> wire shape
#   C) POST /v1/systemone     batch noul+score+choice        -> all 3 types
#   (fallback if 401/403 on Bearer: retry with x-api-key header)
#
# Wire knowledge (receipted priors):
#   - quilt-jev-toolkit/jev_client.py: BASE=https://api.typesafe.ai,
#     POST /v1/systemone {model,state,questions}, model "jev-latest",
#     answers {name:{type:noul,noul:0..1}|{type:choice,...}|{type:score,...}},
#     usage {input_tokens,output_tokens}
#   - cot-quilt/scripts/clients.mjs: same shape, model "jev-1.13.0",
#     "wire shape proven by jev-garden P-G6 + wave-48 r8 calibration battery"
#   - cot-quilt/runs/2026-10-01-run1/state/judge_typesafe.json: 4-noul answers
#     + usage + model jev-1.13.0 (historical output shape)
# ============================================================================
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

BASE = "https://api.typesafe.ai"
KEY = os.environ.get("TYPESAFEAI_KEY", "")
if not KEY:
    print("FATAL: TYPESAFEAI_KEY not in environment"); sys.exit(1)

MASK = KEY[:12] + "..."  # the ONLY permitted representation

# incident-law scrubber (cot-quilt/scripts/clients.mjs): no credential-shaped
# substring may survive into any printed line or receipt
KEY_PAT = re.compile(r"(apikey_[A-Za-z0-9_\-]{8,}|sk-[A-Za-z0-9_\-]{20,})")
def scrub(s):
    return KEY_PAT.sub("[KEY-REDACTED]", str(s))

LOG = []  # probe log rows: (id, method, path, auth_shape, status, ms, note)

def call(pid, method, path, body=None, auth="bearer", timeout=30):
    headers = {"Content-Type": "application/json",
               "User-Agent": "quilt-jev-toolkit/1.0 (w68-native-probe)"}
    if auth == "bearer":
        headers["Authorization"] = f"Bearer {KEY}"
    elif auth == "x-api-key":
        headers["x-api-key"] = KEY
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    t0 = time.time()
    status, text = None, ""
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            status = r.status
            text = r.read().decode()
    except urllib.error.HTTPError as e:
        status = e.code
        try:
            text = e.read().decode()
        except Exception:
            text = "<no body>"
    except Exception as e:
        text = f"<transport error: {type(e).__name__}: {scrub(e)}>"
    ms = round((time.time() - t0) * 1000)
    try:
        js = json.loads(text)
    except Exception:
        js = None
    LOG.append({"probe": pid, "method": method, "path": path,
                "auth": "Authorization: Bearer" if auth == "bearer" else "x-api-key",
                "status": status, "ms": ms,
                "note": scrub((js and json.dumps(js)[:200]) or text[:200])})
    print(f"[{pid}] {method} {path} auth={auth} -> HTTP {status} in {ms}ms")
    return status, js, text

# ---- A: model list ----------------------------------------------------------
st, js, _ = call("A1", "GET", "/v1/models", auth="bearer")
if st in (401, 403):
    # auth-shape fallback demanded by the task: x-api-key instead of Bearer
    st, js, _ = call("A2", "GET", "/v1/models", auth="x-api-key")
models = None
if st == 200 and js is not None:
    ids = [m.get("id", m) if isinstance(m, dict) else m for m in (js.get("data") or js.get("models") or [])]
    models = ids or js
    print("    models:", json.dumps(models))

# ---- B: minimal noul (the cheapest live-signature call; protocol = jev_client.__main__) ----
st, js, _ = call("B1", "POST", "/v1/systemone",
                 body={"model": "jev-latest",
                       "state": "Quilt cells form communities that grow and die like organisms.",
                       "questions": {"is_canon": {"type": "noul",
                                                  "instructions": "Is this canon-worthy?"}}},
                 auth="bearer", timeout=60)
if st in (401, 403):
    st, js, _ = call("B2", "POST", "/v1/systemone",
                     body={"model": "jev-latest",
                           "state": "Quilt cells form communities that grow and die like organisms.",
                           "questions": {"is_canon": {"type": "noul",
                                                      "instructions": "Is this canon-worthy?"}}},
                     auth="x-api-key", timeout=60)
if js is not None:
    print("    B body:", scrub(json.dumps(js))[:600])

# ---- C: batch choice+score+noul (all three question types in ONE call) ------
st, js, _ = call("C1", "POST", "/v1/systemone",
                 body={"model": "jev-latest",
                       "state": "Heads-up hold'em. Board: Ks 7d 2c. Opponent led out small on the "
                                "flop after flat-calling preflop from the big blind. Our hand: Ac Kd. "
                                "Pot 240, we hold 900, opponent covers.",
                       "questions": {
                           "action": {"type": "choice",
                                      "instructions": "Pick the best action on this flop.",
                                      "criteria": {"check": "give up, pot control",
                                                   "bet_small": "small stab for info and protection",
                                                   "bet_big": "charge draws and value hands",
                                                   "fold": "release the hand"}},
                           "aggression": {"type": "score",
                                          "instructions": "How aggressive is this line given the state?",
                                          "criteria": ["very passive", "passive", "neutral",
                                                       "aggressive", "very aggressive"]},
                           "opp_strong": {"type": "noul",
                                          "instructions": "Given the small lead bet, does the opponent "
                                                          "likely hold top-pair strength or better?"}}},
                 auth="bearer", timeout=60)
if js is not None:
    print("    C body:", scrub(json.dumps(js))[:800])

# ---- probe log (masked, receipt-ready) --------------------------------------
print("\n=== PROBE LOG (key masked as %s) ===" % MASK)
for row in LOG:
    print(json.dumps(row))

# persist a sanitized probe log for the receipt builder
with open("/tmp/w68_probe_log.json", "w") as f:
    json.dump({"mask": MASK, "models": models, "log": LOG}, f, indent=2)
print("sanitized probe log -> /tmp/w68_probe_log.json")
