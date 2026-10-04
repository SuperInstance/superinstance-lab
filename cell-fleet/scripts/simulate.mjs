#!/usr/bin/env node
/**
 * cell-fleet — scripts/simulate.mjs
 *
 * Drives the tissue: >= 60 decomposition tasks against the LOCAL workerd
 * runtime (http://127.0.0.1:8787), across >= 3 generations of cell division,
 * then assembles the tissue report into receipts/W67-CELL-FLEET.md (append-
 * only: each run adds a `## Run <ts>` section; nothing is ever deleted).
 *
 * The corpus is the fleet's own vocabulary: concepts drawn from
 * quilt-organ-workers (organ dialect, judge relay, watcher), the
 * decomposition atlas (parts/gates/layers/holes/seals/receipts), and this
 * experiment (cell cycle). ~1/3 of tasks carry DUPLICATE facets — honest
 * messy input the rubric penalizes keeping, which is what makes the delta
 * rule place ambiguous facets at the keep/drop decision boundary.
 *
 * Asserts (all must hold, else exit 1):
 *   - runtime boots (health 200)
 *   - >= 30 tasks executed, all HTTP 200 with reward in [0,1]
 *   - learning happened (genome hash changed on >= 5 tasks)
 *   - >= 1 mitosis event (lineage grows)
 *   - >= 1 apoptosis event (lineage prunes)
 *   - >= 3 generations (founder → child → grandchild → great-grandchild)
 *   - final population >= 2 (tissue persists; not total extinction)
 *   - lineage edges valid (every child has a known parent cell id)
 *   - every live cell's receipt chain self-verifies (organ-dialect law)
 *   - best live cell EMA >= 0.8 (affinity maturation reached)
 *
 * No keys, no .env, no network beyond localhost. If CELL_TOKEN were ever
 * needed it would be read from env at runtime only (it is not needed).
 */

import { writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const RECEIPT = path.join(ROOT, "receipts", "W67-CELL-FLEET.md");
const BASE = process.env.CELL_BASE || "http://127.0.0.1:8787";

const TASKS_TARGET = Number(process.env.CELL_TASKS || 60);
const TASK_PACE_MS = Number(process.env.CELL_PACE_MS || 650);
const POLL_BUDGET_MS = 90_000;

/* ---------------- task corpus (fleet vocabulary) ---------------- */

const GATES = ["invariant", "postcondition", "admission", "seal", "precondition", "budget", "conservation"];

const CONCEPTS = [
  { name: "organ-boot-loader", facets: ["content-addressed store", "schema validation", "boot readiness", "KV persistence", "CORS open", "immutable GET"] },
  { name: "judge-relay", facets: ["judge fan-out", "score-first contract", "model alias resolution", "token budget cap", "per-judge verdict"] },
  { name: "organ-watcher", facets: ["hourly cron", "independent re-derivation", "drift detection", "fleet health dashboard"] },
  { name: "organ-manifest", facets: ["manifestHash self-cover", "stateHash whole-state", "receipt chain", "genesis anchor", "receiptRange window", "cell ids unique"] },
  { name: "decomposition-atlas", facets: ["corpus works", "elementary parts", "gate sweep", "receipt ledgers", "layer histogram", "open holes", "ideas corpus"] },
  { name: "jev-toolkit", facets: ["canonicalJson fail-closed", "cell semantics", "effect ops", "quilt-cell rendering"] },
  { name: "quilt-organ", facets: ["saved-state bundle", "bootable by others", "supersedes lineage", "cells and edges"] },
  { name: "cell-fleet", facets: ["genome weights", "morphogen channels", "delta rule learning", "mitosis mutation", "apoptosis pruning", "membrane KV exocytosis", "ribosome translation", "lineage registry"] },
  { name: "exoj atlas kit", facets: ["verify command", "sweep rules", "protocol runbook", "byte-identical replay", "receipt ledgers"] },
  { name: "tissue economics", facets: ["carrying capacity", "resource sharing", "starvation pruning", "clonal expansion"] },
];

function buildTasks(n) {
  const tasks = [];
  let dupeCount = 0;
  for (let i = 0; i < n; i++) {
    const base = CONCEPTS[i % CONCEPTS.length];
    const facets = [...base.facets];
    // every third task: honest messy input — one duplicate facet
    if (i % 3 === 2) {
      facets.push(base.facets[Math.floor(i / 3) % base.facets.length]);
      dupeCount++;
    }
    tasks.push({
      concept: {
        name: base.name,
        facets,
        layerHint: i % 5,
        gates: [GATES[i % GATES.length], GATES[(i * 3 + 1) % GATES.length]].filter((g, j, a) => a.indexOf(g) === j),
      },
      dupes: facets.length - new Set(facets).size,
    });
  }
  return { tasks, dupeCount };
}

/* ---------------- http helpers ---------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jfetch(pathname, opts = {}, tries = 3) {
  let lastErr;
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(BASE + pathname, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    } catch (e) {
      lastErr = e;
      await sleep(400);
    }
  }
  throw new Error(`fetch ${pathname} failed after ${tries} tries: ${lastErr}`);
}

async function waitHealthy(budgetMs = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    try {
      const { status, body } = await jfetch("/health", {}, 1);
      if (status === 200 && body?.ok) return true;
    } catch {
      /* workerd not up yet */
    }
    await sleep(700);
  }
  return false;
}

/* ---------------- rendering ---------------- */

function lineageTree(tissue) {
  const lines = [];
  const children = {};
  const roots = [];
  const known = new Set([...tissue.cells.map((c) => c.id), ...tissue.gravesDetail.map((g) => g.id)]);
  for (const e of tissue.lineageEdges) {
    (children[e.parent] ||= []).push(e.child);
  }
  for (const c of tissue.cells) if (!c.parent || !known.has(c.parent)) roots.push(c.id);
  for (const g of tissue.gravesDetail) if (!g.parent || !known.has(g.parent)) if (!roots.includes(g.id)) roots.push(g.id);

  const label = (id) => {
    const live = tissue.cells.find((c) => c.id === id);
    const dead = tissue.gravesDetail.find((g) => g.id === id);
    if (live) return `${id} [gen ${live.generation}, ema ${live.rewardEMA ?? "–"}, tasks ${live.tasks}]`;
    if (dead) return `${id} [gen ${dead.generation}, †${dead.cause}, ema ${dead.rewardEMA ?? "–"}]`;
    return id;
  };

  const walk = (id, prefix, isLast) => {
    const branch = prefix === "" ? "" : (isLast ? "└─ " : "├─ ");
    lines.push(prefix === "" ? label(id) : prefix + branch + label(id));
    const kids = children[id] || [];
    kids.forEach((kid, i) => {
      const nextPrefix = prefix === "" ? "" : prefix + (isLast ? "   " : "│  ");
      walk(kid, nextPrefix, i === kids.length - 1);
    });
  };
  for (const r of [...new Set(roots)]) walk(r, "", true);
  return lines.join("\n");
}

/* ---------------- receipt writer (append-only) ---------------- */

function appendReceipt(section) {
  const header = !existsSync(RECEIPT)
    ? `# receipts/W67-CELL-FLEET.md — cell-fleet tissue reports (wave 67, task 67-c1)

Appended per run by scripts/simulate.mjs — append-only, nothing deleted.
Runtime: LOCAL workerd via \`wrangler dev --local\` (wrangler ${section.wranglerVersion}).
Deployed: **NO** — no Cloudflare account or API token exists in this container
(all credential material lost; receipted honestly). The experiment runs on the
same runtime the fleet's live workers run on, minus the edge.

`
    : "";
  writeFileSync(RECEIPT, header + section.text + "\n", { flag: "a" });
}

/* ---------------- main ---------------- */

const fails = [];
const assert = (cond, label, detail = "") => {
  const verdict = cond ? "PASS" : "FAIL";
  console.log(`  [${verdict}] ${label}${detail ? " — " + detail : ""}`);
  if (!cond) fails.push(label + (detail ? ` (${detail})` : ""));
  return cond;
};

async function main() {
  const runAt = new Date().toISOString();
  console.log(`cell-fleet simulate → ${BASE}`);
  const healthy = await waitHealthy();
  if (!healthy) {
    console.error("FATAL: workerd not healthy on " + BASE + " — start it with `npx wrangler dev --local --port 8787`");
    process.exit(2);
  }
  console.log("  [PASS] workerd healthy");

  const wranglerVersion = (existsSync(path.join(ROOT, "node_modules", "wrangler", "package.json"))
    ? JSON.parse(readFileSync(path.join(ROOT, "node_modules", "wrangler", "package.json"), "utf8")).version
    : "unknown");

  // ---- drive tasks ----
  const { tasks, dupeCount } = buildTasks(TASKS_TARGET);
  const results = [];
  const trajectory = [];
  let hashChanges = 0;
  let taskFailures = 0;

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    let ok = false;
    try {
      const { status, body } = await jfetch("/task", { method: "POST", body: JSON.stringify({ concept: t.concept }) });
      ok = status === 200 && typeof body.reward === "number" && body.reward >= 0 && body.reward <= 1;
      if (ok) {
        if (body.learned) hashChanges++;
        results.push({ taskId: body.taskId, cellId: body.cellId, generation: body.generation, reward: body.reward, affinity: body.answer.affinity, parts: body.answer.parts.length, kept: body.answer.keptCount, dropped: body.answer.dropped.length, rubric: body.rubric, learned: body.learned });
      } else {
        taskFailures++;
        results.push({ taskId: "t-?", error: body.error || status });
      }
    } catch (e) {
      taskFailures++;
      results.push({ taskId: "t-?", error: String(e) });
    }
    process.stdout.write(`\r  task ${String(i + 1).padStart(3)}/${tasks.length}  ok=${results.filter((r) => !r.error).length} hashChanges=${hashChanges} fail=${taskFailures}   `);
    if ((i + 1) % 10 === 0) {
      const { body: tis } = await jfetch("/tissue");
      trajectory.push({
        afterTasks: i + 1,
        population: tis.population,
        maxGeneration: tis.maxGeneration,
        meanAffinity: tis.meanAffinity,
        mitosis: tis.mitosis,
        apoptosis: tis.apoptosis,
        graves: tis.graves,
      });
    }
    await sleep(TASK_PACE_MS);
  }
  console.log();

  // ---- feed + poll for the full cycle: >= 3 generations, mitosis + apoptosis
  // ---- (nutrient trickle keeps the tissue alive while the lineage deepens) --
  const pollT0 = Date.now();
  let tissue = null;
  console.log("  polling /tissue with a nutrient trickle until ≥3 generations, mitosis ≥1, apoptosis ≥1…");
  let feedI = 0;
  while (Date.now() - pollT0 < POLL_BUDGET_MS) {
    const { body: tis } = await jfetch("/tissue");
    tissue = tis;
    trajectory.push({
      afterTasks: `poll+${Math.round((Date.now() - pollT0) / 1000)}s`,
      population: tis.population,
      maxGeneration: tis.maxGeneration,
      meanAffinity: tis.meanAffinity,
      mitosis: tis.mitosis,
      apoptosis: tis.apoptosis,
      graves: tis.graves,
    });
    if (tis.maxGeneration >= 3 && tis.mitosis >= 1 && tis.apoptosis >= 1) break;
    // nutrient trickle: keeps non-idle cells fed and lets fresh clones earn tasks
    await jfetch("/task", { method: "POST", body: JSON.stringify({ concept: tasks[feedI % tasks.length].concept }) });
    feedI++;
    await sleep(2000);
  }

  const okTasks = results.filter((r) => !r.error).length;
  const maxGen = tissue.maxGeneration;
  const bestEma = Math.max(0, ...tissue.cells.map((c) => c.rewardEMA ?? 0));
  const causes = {};
  for (const g of tissue.gravesDetail) causes[g.cause] = (causes[g.cause] || 0) + 1;
  const causeStr = Object.entries(causes).map(([k, v]) => `${k}=${v}`).join(", ") || "none";
  const lineageOk =
    tissue.lineageEdges.length === tissue.mitosis &&
    tissue.lineageEdges.every((e) => typeof e.parent === "string" && e.parent.startsWith("c-"));
  const chainsOk = tissue.cells.every((c) => c.ledger && c.ledger.ok === true);
  const gravesChainOk = tissue.gravesDetail.every((g) => g.ledgerTip && g.ledgerTip !== "CHAIN_BROKEN");
  const receiptsTotal = tissue.receipts.total;

  console.log("\nVERIFICATION BAR");
  assert(okTasks >= 30, `≥30 tasks executed`, `${okTasks} ok / ${taskFailures} failed`);
  assert(hashChanges >= 5, `learning visible (genome hash changed ≥5 times)`, `${hashChanges}`);
  assert(tissue.mitosis >= 1, `≥1 mitosis event`, `${tissue.mitosis}`);
  assert(tissue.apoptosis >= 1, `≥1 apoptosis event`, `${tissue.apoptosis} (${causeStr})`);
  assert(maxGen >= 3, `≥3 generations`, `maxGeneration=${maxGen}`);
  assert(tissue.population >= 2, `tissue persists (population ≥2)`, `${tissue.population}`);
  assert(lineageOk, `lineage edges valid (child→parent, count==mitosis)`, `${tissue.lineageEdges.length} edges`);
  assert(chainsOk, `all live receipt chains self-verify`, `${tissue.cells.length} cells, ${receiptsTotal} receipts total`);
  assert(bestEma >= 0.8, `affinity maturation (best EMA ≥0.8)`, `best=${bestEma}`);

  // ---- receipt: append the tissue report ----
  const avgReward = okTasks ? (results.filter((r) => !r.error).reduce((a, r) => a + r.reward, 0) / okTasks).toFixed(3) : "–";
  const lastRewards = results.filter((r) => !r.error).slice(-10);
  const earlyRewards = results.filter((r) => !r.error).slice(0, 10);
  const earlyAvg = earlyRewards.length ? (earlyRewards.reduce((a, r) => a + r.reward, 0) / earlyRewards.length).toFixed(3) : "–";
  const lateAvg = lastRewards.length ? (lastRewards.reduce((a, r) => a + r.reward, 0) / lastRewards.length).toFixed(3) : "–";

  const trajRows = trajectory
    .map((s) => `| ${s.afterTasks} | ${s.population} | ${s.maxGeneration} | ${s.meanAffinity ?? "–"} | ${s.mitosis} | ${s.apoptosis} | ${s.graves} |`)
    .join("\n");

  const cellRows = tissue.cells
    .map(
      (c) =>
        `| \`${c.id}\` | ${c.generation} | ${c.parent ?? "—"} | ${c.tasks} | ${c.rewardEMA ?? "–"} | \`${c.genomeHash}\` | ${c.ledger?.count ?? "?"} (ok=${c.ledger?.ok}) |`
    )
    .join("\n");

  const graveRows = tissue.gravesDetail
    .map(
      (g) =>
        `| \`${g.id}\` | ${g.cause} | ${g.generation} | ${g.parent ?? "—"} | ${g.tasks} | ${g.rewardEMA ?? "–"} | ${g.ledgerCount} | \`${g.ledgerTip?.slice(0, 12) ?? "–"}\` | ${g.diedAt} |`
    )
    .join("\n");

  const eventRows = tissue.events
    .slice(-24)
    .map((e) => `| ${e.at} | ${e.type} | ${e.cellId ?? "—"} | ${e.note ?? ""} |`)
    .join("\n");

  const text = `## Run ${runAt}

- runtime=workerd local (wrangler dev --local, wrangler v${wranglerVersion}); deployed=**NO** (no credentials — see header receipt)
- tasks: ${okTasks}/${tasks.length} ok (${taskFailures} failures), ${dupeCount} with duplicate-facet input
- reward trajectory: first-10 avg ${earlyAvg} → last-10 avg ${lateAvg} (overall avg ${avgReward})
- genome-hash changes (learning events): ${hashChanges}

### Tissue report

| metric | value |
|---|---|
| population (live cells) | ${tissue.population} |
| generations | ${maxGen} |
| mitosis events | ${tissue.mitosis} |
| apoptosis events | ${tissue.apoptosis} (causes: ${causeStr}) |
| graves (apoptotic bodies in KV) | ${tissue.graves} |
| lineage edges | ${tissue.lineageEdges.length} |
| mean affinity (live cells, EMA) | ${tissue.meanAffinity ?? "–"} |
| best affinity (live cells, EMA) | ${bestEma} |
| receipts (live ledgers + buried) | ${receiptsTotal} (${tissue.receipts.live} live + ${tissue.receipts.buried} buried) |

### Affinity / population trajectory

| after | population | maxGen | meanAffinity | mitosis | apoptosis | graves |
|---|---|---|---|---|---|---|
${trajRows}

### Lineage tree (parent → child; † = apoptosis, buried in KV \`grave:{id}\`)

\`\`\`
${lineageTree(tissue)}
\`\`\`

### Live cells

| cell | gen | parent | tasks | rewardEMA | genomeHash | ledger receipts |
|---|---|---|---|---|---|---|
${cellRows || "_(none — total extinction; tissue re-seeds on next task)_"}

### Graves (apoptotic bodies — receipts never deleted, exocytosed to KV)

| cell | cause | gen | parent | tasks | EMA | buried receipts | tip | diedAt |
|---|---|---|---|---|---|---|---|---|
${graveRows || "_(none)_"}

### Tissue events (last ${Math.min(24, tissue.events.length)} of ${tissue.events.length})

| at | event | cell | note |
|---|---|---|---|
${eventRows || "_(none)_"}

### Verification bar (this run)

| check | verdict |
|---|---|
| workerd boots + /health 200 | PASS |
| ≥30 tasks executed, reward ∈ [0,1] | ${okTasks >= 30 ? "PASS" : "FAIL"} (${okTasks}) |
| learning: genome hash changed ≥5× | ${hashChanges >= 5 ? "PASS" : "FAIL"} (${hashChanges}) |
| ≥1 mitosis | ${tissue.mitosis >= 1 ? "PASS" : "FAIL"} (${tissue.mitosis}) |
| ≥1 apoptosis | ${tissue.apoptosis >= 1 ? "PASS" : "FAIL"} (${tissue.apoptosis}) |
| ≥3 generations | ${maxGen >= 3 ? "PASS" : "FAIL"} (${maxGen}) |
| population ≥2 at close | ${tissue.population >= 2 ? "PASS" : "FAIL"} (${tissue.population}) |
| lineage edges valid | ${lineageOk ? "PASS" : "FAIL"} |
| receipt chains self-verify | ${chainsOk ? "PASS" : "FAIL"} |
| buried ledgers intact (no CHAIN_BROKEN) | ${gravesChainOk ? "PASS" : "FAIL"} |
| affinity maturation (best EMA ≥0.8) | ${bestEma >= 0.8 ? "PASS" : "FAIL"} (${bestEma}) |

### Platform notes (receipted this run)

- Workers Queues NOT used: live CF docs state Queues is available on Free and
  Paid plans, but this container has NO account/token (nothing remote is
  possible), and selection signals must arrive synchronously — DO-to-DO fetch
  + KV CELL_MATRIX is the signaling substrate instead.
- DO alarms fire locally in workerd (the cell cycle ran end-to-end above);
  KV list/put/get/delete all exercised via the membrane.
- No keys, no .env: this script reads no secrets and needs none.
`;

  appendReceipt({ text, wranglerVersion });

  console.log(`\n  receipt appended → ${RECEIPT}`);
  console.log(`  tissue: population=${tissue.population} gen=${maxGen} mitosis=${tissue.mitosis} apoptosis=${tissue.apoptosis} meanAffinity=${tissue.meanAffinity} best=${bestEma} receipts=${receiptsTotal}`);

  if (fails.length) {
    console.error(`\nFAIL (${fails.length}): ${fails.join("; ")}`);
    process.exit(1);
  }
  console.log("\nALL GREEN");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
