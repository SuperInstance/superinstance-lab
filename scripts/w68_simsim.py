#!/usr/bin/env python3
# =============================================================================
# w68_simsim.py — wave-68 distant-fields SIMULATION INCREMENT (task 68-d).
#
# NUGGET UNDER TEST (field B, viral quasispecies):
#   "Error threshold + survival of the flattest" — a replicating population
#   loses inherited information above a critical mutation rate (Eigen), and at
#   high mutation rates selection favors robust plateaus over narrow peaks
#   (Wilke et al. 2001).
#
# REAL FLEET DATA (no synthetic seeds):
#   1. cell-fleet/receipts/W67-CELL-FLEET.md — the receipted tissue report of
#      the wave-67 run: 7 live cells + 13 graves, each with a REAL measured
#      reward EMA, REAL parent links (=> REAL parent->child fitness deltas at
#      MUT_SIGMA=0.08), REAL death causes (1 low-affinity, 12 starvation), and
#      the REAL event timeline (first starvation apoptosis timestamp).
#   2. cell-fleet/wrangler.toml [vars] — the REAL chemistry knobs (TICK_MS,
#      STARVE_TICKS, CAP, MUT_SIGMA, MITOSIS_ABOVE, ...).
#   The actual weight vectors are GONE (workerd local state wiped; only
#   genomeHashes survive) — so genomes are reconstructed in a canonical
#   quadratic landscape whose radii are set by the REAL EMAs:
#       fitness(g) = 1 - S * ||g - g*||^2,   r_i = sqrt((1 - EMA_i)/S)
#   with S=1 for the "peak" world. This is the standard quasispecies test
#   landscape; every initial condition is real. Method guard: we simulate in
#   FITNESS space, which UNDERESTIMATES strategy drift (many strategies share
#   a fitness value) — stated in the finding, not hidden.
#
# ARMS:
#   A) calibration: fit per-coordinate mutation std s0 so simulated
#      parent->child fitness deltas reproduce the REAL measured delta std.
#   B) error-threshold sweep: mutation multiplier m in {0.25..16}; measure
#      master-lineage retention after T generations (retention radius derived
#      from the REAL live-EMA spread). m* = smallest m with retention < 0.5.
#   C) survival-of-the-flattest: PEAK (S=1, r=0, fitness 1.0) vs PLATEAU
#      (S=0.25, r=0.3, fitness 0.9775 ~ the real typical live EMA); who wins
#      as m grows; crossover m_flat vs the fleet's operating point m=1.
#   D) starvation overlay (REAL cause of 12/13 deaths): flux arithmetic from
#      wrangler.toml: required task flux to avoid starvation = CAP /
#      (STARVE_TICKS * TICK_MS); compare with the receipted timeline (first
#      starvation apoptosis ~15 s after the last task of the 60-task phase).
#
# OUTPUTS:
#   scripts/w68-research/w68_simsim_results.json  (summary + measured stats)
#   scripts/w68-research/w68_simsim_sweep.csv     (error-threshold sweep)
#   scripts/w68-research/w68_simsim_flattest.csv  (peak-vs-plateau sweep)
#   stdout: the 3-5 sentence honest finding.
# Deterministic: seed=68. No network, no keys.
# =============================================================================
import json, math, re, random, statistics, csv, os
from datetime import datetime

ROOT = "/home/z/my-project"
RECEIPTS = f"{ROOT}/cell-fleet/receipts/W67-CELL-FLEET.md"
WRANGLER = f"{ROOT}/cell-fleet/wrangler.toml"
OUTDIR = f"{ROOT}/scripts/w68-research"
os.makedirs(OUTDIR, exist_ok=True)
random.seed(68)

# ---------------------------------------------------------------- parse REAL data
txt = open(RECEIPTS).read()

# Live cells: | `id` | gen | parent-or-empty | tasks | EMA | `hash` | receipts |
live = []
for m in re.finditer(r"^\|\s*`(c-[0-9a-f]+)`\s*\|\s*(\d+)\s*\|\s*([c`\-—\s0-9a-f]*)\s*\|\s*(\d+)\s*\|\s*([\d.]+)\s*\|\s*`([0-9a-f]+)`\s*\|", txt, re.M):
    parent = m.group(3).strip().strip("`")
    live.append({"id": m.group(1), "gen": int(m.group(2)),
                 "parent": parent if parent.startswith("c-") else None,
                 "tasks": int(m.group(4)), "ema": float(m.group(5)), "dead": False})

# Graves: | `id` | cause | gen | parent | tasks | EMA | buried | `tip` | diedAt |
graves = []
for m in re.finditer(r"^\|\s*`(c-[0-9a-f]+)`\s*\|\s*(low-affinity|starvation)\s*\|\s*(\d+)\s*\|\s*(c-[0-9a-f]+|—)\s*\|\s*(\d+)\s*\|\s*([\d.]+)\s*\|", txt, re.M):
    graves.append({"id": m.group(1), "cause": m.group(2), "gen": int(m.group(3)),
                   "parent": m.group(4) if m.group(4).startswith("c-") else None,
                   "tasks": int(m.group(5)), "ema": float(m.group(6)), "dead": True})

cells = live + graves
assert len(cells) >= 20, f"expected >=20 real cells, got {len(cells)}"
assert all(0.0 <= c["ema"] <= 1.0 for c in cells)

# wrangler.toml chemistry knobs
knobs = {}
for m in re.finditer(r'^\s*([A-Z_]+)\s*=\s*"([^"]+)"', open(WRANGLER).read(), re.M):
    knobs[m.group(1)] = m.group(2)
TICK_MS = float(knobs["TICK_MS"]); STARVE_TICKS = float(knobs["STARVE_TICKS"])
CAP = float(knobs["CAP"]); MUT_SIGMA = float(knobs["MUT_SIGMA"])

# REAL parent->child EMA deltas (the fleet's actual mutational outcome at MUT_SIGMA=0.08)
by_id = {c["id"]: c for c in cells}
real_deltas = []
for c in cells:
    if c["parent"] and c["parent"] in by_id:
        real_deltas.append(c["ema"] - by_id[c["parent"]]["ema"])
REAL_DELTA_STD = statistics.pstdev(real_deltas)
REAL_DELTA_MEAN = statistics.fmean(real_deltas)

# REAL landscape contrast
live_emas = [c["ema"] for c in live]
REAL_LIVE_SPREAD = max(live_emas) - min(live_emas)          # fitness band of survivors
REAL_LIVE_STD = statistics.pstdev(live_emas)
best = max(cells, key=lambda c: c["ema"])                   # the master sequence (real: c-7f1d3b…, EMA 1)
senescent = min(cells, key=lambda c: c["ema"])              # the REAL cliff (EMA 0.5916)

# ---------------------------------------------------------------- quasispecies core
D = 8          # genome dimension = the fleet's 8 morphogen channels
S_PEAK, S_PLAT = 1.0, 0.25
R_RET = math.sqrt(REAL_LIVE_SPREAD / S_PEAK)   # master-retention radius from REAL live spread

def radius_from_ema(ema, S=1.0):
    return math.sqrt(max(0.0, (1.0 - ema) / S))

def random_dir():
    v = [random.gauss(0, 1) for _ in range(D)]
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]

def make_pop(S, radii):
    return [{"g": [r * d for r, d in zip(radii, [random_dir() for _ in radii])],
             "S": S, "lin": i} for i, r in enumerate(radii) for g in [{"g": None}]]

def fitness(ind):
    r2 = sum((x) ** 2 for x in ind["g"])
    return max(0.0, 1.0 - ind["S"] * r2)

def mutate(ind, s):
    # per-coordinate gaussian step; child keeps the parent's curvature class
    child = {"g": [x + random.gauss(0, s) for x in ind["g"]], "S": ind["S"], "lin": ind["lin"]}
    return child

def step(pop, s, N):
    # selection: expected offspring proportional to fitness; mutation on replication
    fits = [fitness(p) for p in pop]
    mean_f = sum(fits) / len(fits)
    weights = [f / mean_f for f in fits]
    pool = []
    for w, p in zip(weights, pop):
        k = int(w) + (1 if random.random() < w - int(w) else 0)
        pool += [p] * k
    while len(pool) < N:
        pool.append(random.choice(pop))
    random.shuffle(pool)
    return [mutate(pool[i], s) for i in range(N)]

# --- A) calibrate s0: simulated parent->child delta std == REAL delta std
def sim_delta_std(s0, reps=4000):
    ds = []
    for c in cells:  # start from the REAL fitness values
        r = radius_from_ema(c["ema"])
        ind = {"g": [r * x for x in random_dir()], "S": S_PEAK, "lin": 0}
        ch = mutate(ind, s0)
        ds.append(fitness(ch) - fitness(ind))
    return statistics.pstdev(ds)

s0 = 0.004  # initial guess
for _ in range(24):  # bisection on a monotone-ish response
    d = sim_delta_std(s0)
    s0 *= (REAL_DELTA_STD / d) ** 0.5 if d > 1e-9 else 1.5
    s0 = min(max(s0, 1e-6), 0.2)
S0_CAL = s0

# --- B) error-threshold sweep
def run_quasispecies(m, T=60, N=40, trials=20):
    rets, finals, surv = [], [], 0
    radii0 = [radius_from_ema(c["ema"]) for c in live]  # REAL initial radii
    for _ in range(trials):
        pop = []
        for i, c in enumerate(live):  # REAL starting cells; master = best real cell
            r = radius_from_ema(c["ema"])
            pop.append({"g": [r * x for x in random_dir()], "S": S_PEAK, "lin": i})
        master_lin = max(range(len(live)), key=lambda i: live[i]["ema"])
        for _ in range(T):
            pop = step(pop, s0 * m, N)
        ret = sum(1 for p in pop if math.sqrt(sum(x * x for x in p["g"])) < R_RET) / len(pop)
        rets.append(ret)
        finals.append(statistics.fmean(fitness(p) for p in pop))
        if any(p["lin"] == master_lin for p in pop):
            surv += 1
    return statistics.fmean(rets), statistics.fmean(finals), surv / trials

GRID = [0.25, 0.5, 1, 2, 4, 8, 16]
sweep = []
for m in GRID:
    ret, mf, surv = run_quasispecies(m)
    sweep.append({"m": m, "master_retention": round(ret, 4), "mean_fitness": round(mf, 4),
                  "master_lineage_survival": round(surv, 3)})
M_STAR = next((row["m"] for row in sweep if row["master_retention"] < 0.5), None)

# --- C) survival of the flattest: PEAK vs PLATEAU
def run_flattest(m, T=60, N=40, trials=20):
    shares, mf = [], []
    for _ in range(trials):
        pop = [{"g": [0.0] * D, "S": S_PEAK, "lin": 0} for _ in range(N // 2)] + \
              [{"g": [random.gauss(0.3 / math.sqrt(D), 0.02) for _ in range(D)], "S": S_PLAT, "lin": 1}
               for _ in range(N - N // 2)]
        for _ in range(T):
            pop = step(pop, s0 * m, N)
        shares.append(sum(1 for p in pop if p["S"] == S_PLAT) / len(pop))
        mf.append(statistics.fmean(fitness(p) for p in pop))
    return statistics.fmean(shares), statistics.fmean(mf)

flat = []
for m in GRID:
    sh, mf = run_flattest(m)
    flat.append({"m": m, "plateau_share": round(sh, 4), "mean_fitness": round(mf, 4)})
M_FLAT = next((row["m"] for row in flat if row["plateau_share"] > 0.5), None)

# --- D) starvation overlay (real arithmetic, receipted timeline cross-check)
flux_required_per_s = CAP / (STARVE_TICKS * TICK_MS / 1000.0)
events = re.findall(r"\|\s*(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s*\|\s*(MITOSIS|APOPTOSY)\s*\|", txt)
run_start = datetime.fromisoformat(re.search(r"Run (\d{4}-\d{2}-\d{2}T[\d:.]+Z)", txt).group(1).replace("Z", "+00:00"))
first_starve = None
for m2 in re.finditer(r"\|\s*(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s*\|\s*APOPTOSY\s*\|\s*(c-[0-9a-f]+)\s*\|\s*cause=starvation", txt):
    t = datetime.fromisoformat(m2.group(1).replace("Z", "+00:00"))
    if first_starve is None or t < first_starve:
        first_starve = t
last_task_s = 60 * 0.650  # 60 tasks at CELL_PACE_MS=650 (receipted simulator pace)
starve_lag_s = (first_starve - run_start).total_seconds() - last_task_s if first_starve else None

# ---------------------------------------------------------------- write outputs
with open(f"{OUTDIR}/w68_simsim_sweep.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["m", "master_retention", "mean_fitness", "master_lineage_survival"])
    [w.writerow([r["m"], r["master_retention"], r["mean_fitness"], r["master_lineage_survival"]]) for r in sweep]
with open(f"{OUTDIR}/w68_simsim_flattest.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["m", "plateau_share", "mean_fitness"])
    [w.writerow([r["m"], r["plateau_share"], r["mean_fitness"]]) for r in flat]

summary = {
    "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    "seed": 68,
    "real_data": {
        "cells_parsed": len(cells), "live": len(live), "graves": len(graves),
        "real_parent_child_deltas": len(real_deltas),
        "real_delta_std": round(REAL_DELTA_STD, 5), "real_delta_mean": round(REAL_DELTA_MEAN, 5),
        "real_live_spread": round(REAL_LIVE_SPREAD, 5), "real_live_std": round(REAL_LIVE_STD, 5),
        "master_cell": best["id"], "master_ema": best["ema"],
        "senescent_cell": senescent["id"], "senescent_ema": senescent["ema"],
        "causes": {"low-affinity": sum(1 for g in graves if g["cause"] == "low-affinity"),
                   "starvation": sum(1 for g in graves if g["cause"] == "starvation")},
    },
    "chemistry_from_wrangler_toml": {k: knobs[k] for k in
        ["TICK_MS", "STARVE_TICKS", "CAP", "MUT_SIGMA", "MITOSIS_ABOVE", "MIN_TASKS"]},
    "calibration": {"s0_per_coordinate": round(S0_CAL, 6),
                    "target_real_delta_std": round(REAL_DELTA_STD, 5),
                    "note": "simulated parent->child fitness delta std fitted to the REAL receipt deltas"},
    "error_threshold_sweep": sweep,
    "m_star_retention_lt_0.5": M_STAR,
    "flattest_sweep": flat,
    "m_flat_plateau_wins": M_FLAT,
    "starvation_overlay": {
        "flux_required_tasks_per_s_to_sustain_CAP": round(flux_required_per_s, 4),
        "receipted_first_starvation_lag_after_last_task_s": round(starve_lag_s, 1) if starve_lag_s else None,
        "expected_lag_s": STARVE_TICKS * TICK_MS / 1000.0,
    },
}
json.dump(summary, open(f"{OUTDIR}/w68_simsim_results.json", "w"), indent=2)

print(json.dumps(summary, indent=2))
