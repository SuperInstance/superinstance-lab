#!/usr/bin/env node
// ============================================================================
// w68_ab_replay.mjs — the wave-68 A/B falsification driver (cell-fleet)
//
// Tests 68-d's two sharpest claims against the REAL workerd tissue, one arm
// per invocation (the bash orchestrator w68_ab_run.sh starts a FRESH workerd
// with wiped state for each arm — clean genesis, fair comparison):
//
//   Arm A (--arm A): wave-67 baseline chemistry — ADMISSION=lrs,
//                    ROBUST_GATE=0, fees not sent (fee=0).
//   Arm B (--arm B): w68 chemistry — ADMISSION=fee, ROBUST_GATE=1; every
//                    task carries a deterministic fee ((i*37)%100)/100.
//
// The task corpus is byte-identical to scripts/simulate.mjs's buildTasks()
// (deterministic, index-driven — no RNG). Same 60 tasks, same order, same
// trickle shape. Only the chemistry differs.
//
// PRE-REGISTERED DECISION RULES (written BEFORE any result was seen — house
// law "decision rules before the run"; the orchestrator receipts them):
//   R1 (primary): mean reward of tasks 51-60; B wins iff B > A + 0.02.
//   R2: B must not go extinct — final live population >= 2.
//   R3: the robustness gate must not freeze the lineage — B mitosis >= 1.
//   R4 (honest-negative clause): if B fails R1, the finding is receipted as
//       "fee+robustness chemistry REJECTED at this corpus scale" — no rerun
//       tuning, no knob fiddling, the negative stands as the round's result.
//
// Usage: CELL_BASE=http://127.0.0.1:8791 node scripts/w68_ab_replay.mjs --arm A
// Output: scripts/w68-ab-arm<X>.json (full metrics; orchestrator compares).
// ============================================================================
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE = process.env.CELL_BASE || "http://127.0.0.1:8787";
const ARM = (process.argv.find((a) => a === "--arm") ? process.argv[process.argv.indexOf("--arm") + 1] : "A").toUpperCase();
if (!["A", "B"].includes(ARM)) { console.error("arm must be A or B"); process.exit(2); }

const TASKS_TARGET = Number(process.env.CELL_TASKS || 60);
const TASK_PACE_MS = Number(process.env.CELL_PACE_MS || 650);
const POLL_BUDGET_MS = 90_000;
const FEE_MODE = ARM === "B";
const feeOf = (i) => FEE_MODE ? ((i * 37) % 100) / 100 : 0;   // deterministic, receipted

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jfetch(pathname, opts = {}, tries = 3) {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(BASE + pathname, { ...opts, headers: { "content-type": "application/json", ...(opts.headers || {}) } });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    } catch (e) {
      if (t === tries - 1) throw e;
      await sleep(400);
    }
  }
}

async function waitHealthy(budgetMs = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    try {
      const { status } = await jfetch("/health", {}, 1);
      if (status === 200) return true;
    } catch { /* not up yet */ }
    await sleep(700);
  }
  return false;
}

/* ---- task corpus: BYTE-COPIED from scripts/simulate.mjs buildTasks() ---- */
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
    const c = CONCEPTS[i % CONCEPTS.length];
    const gates = [GATES[i % GATES.length]];
    if (i % 3 === 2) {
      dupeCount++;
      tasks.push({
        concept: {
          name: c.name + ` #${Math.floor(i / CONCEPTS.length)}`,
          facets: [...c.facets, c.facets[0]], // honest messy input: one duplicate facet
          gates: [GATES[i % GATES.length], GATES[(i * 3 + 1) % GATES.length]].filter((g, j, a) => a.indexOf(g) === j),
        },
      });
    } else {
      tasks.push({ concept: { name: c.name + ` #${Math.floor(i / CONCEPTS.length)}`, facets: [...c.facets], gates } });
    }
  }
  return { tasks, dupeCount };
}

/* ------------------------------- main ------------------------------------- */
const runAt = new Date().toISOString();
console.log(`w68 A/B arm ${ARM} → ${BASE} (fees: ${FEE_MODE ? "ON" : "off"})`);
const healthy = await waitHealthy();
if (!healthy) { console.error("FATAL: workerd not healthy on " + BASE); process.exit(2); }
console.log("  [PASS] workerd healthy");

const { tasks, dupeCount } = buildTasks(TASKS_TARGET);
const rewards = [];
const perTask = [];
let hashChanges = 0, taskFailures = 0, admissions = { lrs: 0, fee: 0, other: 0 };

for (let i = 0; i < tasks.length; i++) {
  const t = tasks[i];
  try {
    const { status, body } = await jfetch("/task", { method: "POST", body: JSON.stringify({ concept: t.concept, fee: feeOf(i) }) });
    const ok = status === 200 && typeof body.reward === "number" && body.reward >= 0 && body.reward <= 1;
    if (ok) {
      rewards.push(body.reward);
      if (body.learned) hashChanges++;
      const adm = body.routed?.admission || (FEE_MODE ? "fee" : "lrs");
      admissions[adm] = (admissions[adm] || 0) + 1;
      perTask.push({ i, fee: feeOf(i), cellId: body.cellId, generation: body.generation, reward: body.reward, learned: !!body.learned });
    } else {
      taskFailures++;
      perTask.push({ i, fee: feeOf(i), error: body.error || status });
    }
  } catch (e) {
    taskFailures++;
    perTask.push({ i, fee: feeOf(i), error: String(e) });
  }
  process.stdout.write(`\r  arm ${ARM} task ${String(i + 1).padStart(3)}/${tasks.length} ok=${rewards.length} hashChanges=${hashChanges} fail=${taskFailures}   `);
  await sleep(TASK_PACE_MS);
}
console.log();

// ---- nutrient trickle poll (same shape as simulate.mjs: 2s cadence, feed
// ---- rotation continues the fee sequence) --------------------------------
const pollT0 = Date.now();
let tissue = null, trickleFeeds = 0;
while (Date.now() - pollT0 < POLL_BUDGET_MS) {
  const { body: tis } = await jfetch("/tissue");
  tissue = tis;
  if (tis.maxGeneration >= 3 && tis.mitosis >= 1 && tis.apoptosis >= 1) break;
  await jfetch("/task", { method: "POST", body: JSON.stringify({ concept: tasks[trickleFeeds % tasks.length].concept, fee: feeOf(TASKS_TARGET + trickleFeeds) }) });
  trickleFeeds++;
  await sleep(2000);
}
const finalTis = (await jfetch("/tissue")).body ?? tissue;

// graves by cause (starvation vs low-affinity split — the wave-67 12/13 riddle)
const causeSplit = {};
for (const g of finalTis.gravesDetail || []) causeSplit[g.cause] = (causeSplit[g.cause] || 0) + 1;

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const first10 = mean(rewards.slice(0, 10));
const last10 = mean(rewards.slice(-10));

const metrics = {
  arm: ARM, runAt, base: BASE, feeMode: FEE_MODE,
  corpus: { tasks: tasks.length, dupeCount, trickleFeeds },
  admissions,
  taskStats: { ok: rewards.length, failures: taskFailures, hashChanges },
  reward: { first10: Number(first10?.toFixed(4)), last10: Number(last10?.toFixed(4)), all: Number(mean(rewards)?.toFixed(4)) },
  tissue: {
    population: finalTis.population, maxGeneration: finalTis.maxGeneration,
    meanAffinity: finalTis.meanAffinity, bestAffinity: finalTis.bestAffinity ?? null,
    mitosis: finalTis.mitosis, apoptosis: finalTis.apoptosis, graves: finalTis.graves,
    causeSplit, lineageEdges: (finalTis.lineageEdges || []).length,
  },
  preRegisteredRules: {
    R1: "B wins iff last10(B) > last10(A) + 0.02",
    R2: "B final population >= 2",
    R3: "B mitosis >= 1",
    R4: "if B fails R1 the negative stands, no rerun tuning",
  },
  perTask,
};
const out = path.join(ROOT, "scripts", `w68-ab-arm${ARM}.json`);
writeFileSync(out, JSON.stringify(metrics, null, 2));
console.log(`\n  arm ${ARM}: first10=${metrics.reward.first10} last10=${metrics.reward.last10} all=${metrics.reward.all}`);
console.log(`  tissue: pop=${finalTis.population} gen=${finalTis.maxGeneration} mitosis=${finalTis.mitosis} apoptosis=${finalTis.apoptosis} causeSplit=${JSON.stringify(causeSplit)}`);
console.log(`  -> ${out}`);
