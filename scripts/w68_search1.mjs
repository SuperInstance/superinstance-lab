// w68_search1.mjs — wave-68 distant-fields search round (task 68-d).
//
// TRANSPORT NOTE (receipted): the task brief suggested z-ai-web-dev-sdk via
// `import ZAI from 'z-ai-web-dev-sdk'`, but /home/z/my-project has NO
// node_modules/package.json (verified 2026-10-04) — the SDK is not installed.
// Wave-67's working pattern (scripts/w67_canon_chunks.sh, w67_jev_gate.py)
// drives the same SDK through the `z-ai` CLI
// (`z-ai function -n web_search -a '<json>' -o <file>`). We keep that
// transport, wrapped in a Node driver so the round is scripted and resumable.
//
// RATE-LIMIT LESSON (wave-67 receipted): do NOT fire parallel search calls.
// execFileSync = one call in flight at a time; sleep between calls; retry
// once on failure after a longer sleep.
//
// Fields chosen for wave-68 (all NEW vs wave-67's five: RAF/autocatalytic,
// Physarum, immune affinity maturation, stigmergy, Waddington):
//   A. bacterial quorum sensing + plasmid-mediated horizontal gene transfer
//      (density-gated collective action; lateral learning channel)
//   B. viral quasispecies: error thresholds + survival-of-the-flattest
//      (mutation-rate budget for a mutating cell fleet)
//   C. bitcoin mempool fee markets / mechanism design under congestion
//      (admission gates, replace-by-fee, child-pays-for-parent)
//
// Output: scripts/w68-research/w68_field_A.json / _B.json / _C.json
//         + w68_search_index.json (manifest: query -> file -> hit count).

import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project";
const OUT = path.join(ROOT, "scripts", "w68-research");
mkdirSync(OUT, { recursive: true });

const SLEEP_MS = 2600;   // between sequential calls (rate-limit courtesy)
const RETRY_SLEEP_MS = 6000;

const FIELDS = [
  {
    slug: "A",
    name: "quorum sensing + horizontal gene transfer",
    queries: [
      "bacterial quorum sensing autoinducer threshold collective behavior 2025 2026 research",
      "horizontal gene transfer plasmid conjugation population dynamics 2025 2026",
      "quorum sensing synthetic biology engineered microbial communication 2026",
    ],
  },
  {
    slug: "B",
    name: "viral quasispecies error threshold",
    queries: [
      "viral quasispecies error threshold mutation rate 2025 2026",
      "survival of the flattest robustness fitness landscape quasispecies 2025",
      "Eigen paradox RNA virus mutation selection balance genomics 2026",
    ],
  },
  {
    slug: "C",
    name: "mempool fee market under congestion",
    queries: [
      "bitcoin mempool fee market mechanism design congestion 2025 2026",
      "transaction fee markets priority queuing mechanism design research 2025",
      "replace-by-fee child-pays-for-parent mempool economics 2025",
    ],
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// One web_search via the z-ai CLI. Returns parsed result object or throws.
function webSearch(query, num) {
  const argsJson = JSON.stringify({ query, num });
  const out = path.join(OUT, `.tmp_w68_last_search.json`);
  execFileSync("z-ai", ["function", "-n", "web_search", "-a", argsJson, "-o", out], {
    cwd: ROOT,
    timeout: 120_000,
    stdio: ["ignore", "pipe", "pipe"], // keep stdout clean, capture errors
  });
  if (!existsSync(out)) throw new Error("no output file from z-ai function");
  const parsed = JSON.parse(readFileSync(out, "utf8"));
  return parsed;
}

async function searchWithRetry(query, num) {
  try {
    return webSearch(query, num);
  } catch (e) {
    console.error(`  ! first attempt failed (${String(e).slice(0, 120)}); retrying once after sleep`);
    await sleep(RETRY_SLEEP_MS);
    return webSearch(query, num); // second attempt throws if it fails again
  }
}

function extractHits(parsed) {
  // z-ai web_search has returned both {result: [...]} and bare [...]; handle both.
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.result)) return parsed.result;
  if (Array.isArray(parsed?.results)) return parsed.results;
  if (Array.isArray(parsed?.data)) return parsed.data;
  return [];
}

async function main() {
  const index = { date: new Date().toISOString(), transport: "z-ai CLI web_search (sdk absent)", fields: [] };
  for (const f of FIELDS) {
    const perField = { slug: f.slug, name: f.name, queries: [] };
    for (const q of f.queries) {
      process.stdout.write(`[${f.slug}] searching: ${q}\n`);
      let parsed = null;
      try {
        parsed = await searchWithRetry(q, 10);
      } catch (e) {
        console.error(`  !! BOTH attempts failed for: ${q} — recording failure, continuing`);
        perField.queries.push({ query: q, error: String(e).slice(0, 300), hits: [] });
        continue;
      }
      const hits = extractHits(parsed).map((h) => ({
        title: h?.title ?? h?.name ?? "",
        url: h?.url ?? h?.link ?? "",
        snippet: (h?.snippet ?? h?.content ?? h?.description ?? "").toString().slice(0, 600),
        date: h?.date ?? h?.published ?? "",
      }));
      perField.queries.push({ query: q, n: hits.length, hits });
      console.log(`  -> ${hits.length} hits`);
      await sleep(SLEEP_MS);
    }
    const file = path.join(OUT, `w68_field_${f.slug}.json`);
    writeFileSync(file, JSON.stringify(perField, null, 2));
    index.fields.push({ slug: f.slug, name: f.name, file, queries: perField.queries.length });
  }
  const idxFile = path.join(OUT, "w68_search_index.json");
  writeFileSync(idxFile, JSON.stringify(index, null, 2));
  console.log(`\nDONE. index -> ${idxFile}`);
  for (const f of index.fields) {
    console.log(`  field ${f.slug} (${f.name}): ${f.queries} queries -> ${f.file}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
