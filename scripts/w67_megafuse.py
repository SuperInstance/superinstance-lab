#!/usr/bin/env python3
# wave-67 pass-2 mega-concept fusion: 1044 GLM slugs -> <=60 fixed mega-concepts.
import json, subprocess, re, os
from collections import Counter

ROOT = "/home/z/my-project"
slugs = sorted(set(json.load(open(f"{ROOT}/scripts/w67-research/chem-canonical.json"))["map"].values()))
print(len(slugs), "distinct slugs to fuse")

VOCAB = ["prompt","query","response","answer","verdict","score","receipt","hash",
"canonical_string","state","cell","genome","sheet","row","column","seed","artifact",
"bundle","organ","id","payload","byte","json","schema","coordinates","distance",
"amplitude","probability","weight","threshold","token","embedding","text","document",
"image","audio","video","key","secret","url","http_request","http_response","error",
"log","timestamp","config","parameter","option","flag","command","script","function",
"class","module","test","fixture","node","edge","graph","queue","worker","task","job",
"event","message","signal","buffer","cache","index","table","database","file","directory",
"path","blob","stream","time","clock","counter","accumulator","bitmask","lattice","matrix",
"vector","scalar","boolean","void","unknown"]

sys_prompt = ("You are a strict concept fuser. Map every input slug to the SINGLE closest "
              "mega-concept from the allowed vocabulary; when nothing fits use unknown. "
              "Output ONLY the JSON mapping object mapping each input slug verbatim. "
              "Output compact JSON: no spaces, no newlines inside the object.")
mega = {}
CH = 350
for ci in range(0, len(slugs), CH):
    chunk = slugs[ci:ci+CH]
    user_prompt = ("Fuse these %d concept slugs into mega-concepts. Allowed vocabulary: %s. "
                   "INPUT SLUGS: %s" % (len(chunk), json.dumps(VOCAB), json.dumps(chunk)))
    subprocess.run(["z-ai","chat","-p",user_prompt,"-s",sys_prompt,"-o","/tmp/mega_raw.json"],
                   capture_output=True, text=True, timeout=300, cwd=ROOT)
    resp = json.load(open("/tmp/mega_raw.json"))
    txt = (resp.get("choices") or [{}])[0].get("message", {}).get("content", "")
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        print(f"chunk {ci//CH}: UNPARSEABLE (finish={(resp.get('choices') or [{}])[0].get('finish_reason')}); skipped"); continue
    part = json.loads(m.group(0))
    mega.update(part)
    print(f"chunk {ci//CH}: +{len(part)} (finish={(resp.get('choices') or [{}])[0].get('finish_reason')})")
# validate: every slug mapped, values in vocab (else unknown)
bad = {k: v for k, v in mega.items() if v not in VOCAB}
for k in bad: mega[k] = "unknown"
for s in slugs: mega.setdefault(s, "unknown")
print("mega map entries:", len(mega), "| off-vocab fixed:", len(bad))
print("distribution:", Counter(mega.values()).most_common(12))
json.dump(mega, open("/tmp/mega_map.json", "w"))
print("mega map -> /tmp/mega_map.json")
