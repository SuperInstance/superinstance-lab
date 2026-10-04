// w68_search2.mjs — supplemental round for gaps found in round 1 (receipted):
//   B1: "survival of the flattest" returned junk hits -> rephrase.
//   B2: lethal mutagenesis / error catastrophe fresher sources.
//   A1: plasmid cost/transfer trade-off fresher sources.
// Same discipline: sequential (execFileSync), sleep between calls, retry once.
// Merges into the existing per-field JSON files under "supplement".
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project";
const OUT = path.join(ROOT, "scripts", "w68-research");
const SLEEP_MS = 2600, RETRY_SLEEP_MS = 6000;

const JOBS = [
  { file: "w68_field_B.json", tag: "survival-of-flattest-rephrase",
    query: "mutational robustness flat fitness landscapes RNA viruses selection 2025 2026" },
  { file: "w68_field_B.json", tag: "lethal-mutagenesis",
    query: "lethal mutagenesis error catastrophe antiviral strategy 2025 2026" },
  { file: "w68_field_A.json", tag: "plasmid-cost-tradeoff",
    query: "plasmid fitness cost conjugation rate trade-off biofilm transfer 2025" },
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function webSearch(query, num) {
  const argsJson = JSON.stringify({ query, num });
  const out = path.join(OUT, ".tmp_w68_last_search.json");
  execFileSync("z-ai", ["function", "-n", "web_search", "-a", argsJson, "-o", out],
    { cwd: ROOT, timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] });
  if (!existsSync(out)) throw new Error("no output file from z-ai function");
  return JSON.parse(readFileSync(out, "utf8"));
}

function extractHits(parsed) {
  if (Array.isArray(parsed)) return parsed;
  for (const k of ["result", "results", "data"]) if (Array.isArray(parsed?.[k])) return parsed[k];
  return [];
}

async function main() {
  for (const job of JOBS) {
    const file = path.join(OUT, job.file);
    const doc = JSON.parse(readFileSync(file, "utf8"));
    process.stdout.write(`[${job.tag}] searching: ${job.query}\n`);
    let parsed;
    try { parsed = webSearch(job.query, 10); }
    catch (e) {
      console.error(`  ! retrying once (${String(e).slice(0, 100)})`);
      await sleep(RETRY_SLEEP_MS);
      try { parsed = webSearch(job.query, 10); }
      catch (e2) { console.error(`  !! failed twice, skipping: ${job.tag}`); doc.supplement ??= []; doc.supplement.push({ tag: job.tag, query: job.query, error: String(e2).slice(0, 200), hits: [] }); writeFileSync(file, JSON.stringify(doc, null, 2)); continue; }
    }
    const hits = extractHits(parsed).map((h) => ({
      title: h?.title ?? h?.name ?? "",
      url: h?.url ?? h?.link ?? "",
      snippet: (h?.snippet ?? h?.content ?? h?.description ?? "").toString().slice(0, 600),
      date: h?.date ?? h?.published ?? "",
    }));
    doc.supplement ??= [];
    doc.supplement.push({ tag: job.tag, query: job.query, n: hits.length, hits });
    writeFileSync(file, JSON.stringify(doc, null, 2));
    console.log(`  -> ${hits.length} hits -> merged into ${job.file}`);
    await sleep(SLEEP_MS);
  }
  console.log("SUPPLEMENTAL ROUND DONE");
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
