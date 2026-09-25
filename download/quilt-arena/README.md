# E12 — THE PERCEPTION ARENA

**Competitive formula-inference games under a rationed MOTH budget.** Four
agent-minds (each one a reactive quilt sheet) play two games that reduce to
formulas — a minesweeper duel and a hearts trio — while trying to infer each
other's formulas from observed moves. True quantum entropy from moth-quantum
is not a free utility: it is a **budget** each mind rations across a set of
games, and *when* to buy perception is part of the strategy.

Status: **23/23 harness checks green**, live run on the user's moth-quantum
key (8 real jobs: 1 coin-toss probe, 6 championship entropy packets, 2 graph
tomography reads) and 4 real GLM script-writer calls, all cached and
receipted. Offline replay: byte-identical.

```
node arena/play.mjs                 # full offline run (synthetic entropy, flagged)
MOTH_OFFLINE=0 node arena/play.mjs  # live championship on real quantum entropy
REAL_LLM=1 node arena/play.mjs      # ...and real GLM script-writer letters
node arena/smoke.mjs                # 30-second smoke of the core loop
```

---

## 1. The doctrine (and where it lives in the sheet)

> *"To beat a player at Texas Hold'em, you have to realize — your 2 cards are
> minor. The rest of the cards are the other player's and you have the flop,
> turn, and river to develop an understanding of the shape of their
> decision-making. The more your cards can fade into the environment as part
> of the game, the more you are playing the players."*

| doctrine | mechanism in the arena |
|---|---|
| *Your own cards are minor* | each mind's 14 game-weights derive from just **5 style cells** (greed / fear / curiosity / social / patience) through formula cells; the game feeds everyone the same mechanical odds (`winp` is computed by the referee and handed to all seats alike) |
| *The rest of the cards are the other player's* | every observer runs `inf.predict` before every opponent move and `inf.update` after — opponents are modeled in a shared public **feature language**, never as black boxes |
| *Flop/turn/river = developing shape* | per-opponent **shape cells** (aggression, tolerance, moon-sniff, margin waveform) accumulate street by street; a **spectral shift alarm** (Goertzel over the move-margin stream) fires when their decision shape changes |
| *Play the players, not the odds* | MASK builds a model of what opponents believe about **it** (`inf.self`) and pays a predictability penalty; the minesweeper `avoid` feature reads the opponent **as a sensor** over the hidden board |
| *Perception is the scarce resource* | moth-quantum packets are **budgeted per set**; each family has a different spend doctrine; the vault journals every purchase and namespaces synthetic vs live entropy |

## 2. The two games (reducible to formulas, public feature language)

**G1 MOTHRA — minesweeper duel.** 7×7, 9 mines, alternate reveals; safe +1,
mine −3. Features per cell: `adj`/`adjSum` (local mine pressure from revealed
numbers), `front`, `info` (gain), `dens` (mechanical prior), `center`,
**`avoid`** — how often the *opponent* had this cell available and chose
something else. An opponent that knows the board is a distributed sensor; `w_avoid = 1.5·social` is the cell where reading-the-other becomes a weight.

**G2 WEAVER — hearts trio.** 27 cards (ranks 6..A × ♡/♠/♢), Q♠ 13, hearts 1
each, lowest total wins. Features per legal card: `winp` (exact
hypergeometric trick-winning odds — public table stakes), `pts` (normalized),
`high`, `trickPts`, `lead`, `voidp`, `aggr` (the *shape* of the field, from
the agent's own opponent-model cells). The trick stream is the flop/turn/river:
each play either confirms or reshapes the model of who they are.

All features are **normalized to [0,1]** (see §5 — the conditioning lesson).

## 3. The four minds (each one a sheet)

Built by `arena/minds.mjs`; ~43 cells per mind. Shared skeleton:
`id.*` identity · 3 doctrine laws · **5 style cells** → 14 derived weight
formulas (`mw.*`, `hw.*`) · `inf.p0..p3` opponent models + `inf.self` ·
`pulse.prederr`, `pulse.shift` (the listener `watch.shift` flashes a lamp on
alarms) · `moth.left/pack/ledger` · `act.choose` / `inf.predict` /
`inf.update` / `learn.revise` program cells · `scr.chain` versioned script
receipts.

| family | how it learns | when it spends MOTH | identity |
|---|---|---|---|
| **LIN** (p0) | softmax-SGD on each opponent's feature vector | prediction-error EWMA hot, or quantum tie-break when the top-2 margin is thin | frequentist, reactive |
| **WAVE** (p1) | same fit, plus the opponent's move-margin stream read **as a waveform** — dominant Goertzel period tracked; a spectral shift sets the alarm | **only after alarms** (confirmation spend) | spectral analyst |
| **BAYES** (p2) | **evolutionary gradient ensemble**: 20 hypothesis-opponents, each with its own learning rate, likelihood-weighted, resampled + roughened (see §5 — this is a method born in this arena) | posterior collapse (ESS < 5) → quantum resampling of hypotheses | Bayesian ensemble |
| **MASK** (p3) | models what each opponent believes about **it**, pays a predictability penalty on candidates the field sees coming, mixes with entropy ε tuned to its measured predictability | high-stakes decisions or when predictability runs high | adversarial mixer |

### The style architecture (distributed understanding, phase-7 style)

The script-writer never touches 14 weights. It moves **5 style cells**; the
14 game-weights re-derive through formula cells; both games re-price. This is
"understanding distributed through cell relationships": a revision is a small
gesture with a large, visible, causal ripple. `participation` (feature
engagement, written by every choose) feeds `learn.revise`; styles nothing
uses decay toward zero — *less need for weights not involved over time*.

### The craftmind loop (script-writers, not nudgers)

Between sets, every mind runs `learn.revise` — the craftmind pattern from the
lucineer/craftmind study (scripts as **versioned, hypothesis-bearing
artifacts**; writer separated from deterministic runner; telemetry pulse →
insight → adjustment):

1. the harness builds a digest (won/lost, margin, model accuracy,
   participation, spend ratio, leader's styles);
2. the **analyst** (deterministic doctrine, or a real GLM call under a strict
   letter fence) returns **A** stay / **B** explore / **C** concentrate /
   **D** imitate the leader / **E** prune;
3. styles mutate, `script.v` bumps, a hypothesis line is written, and a
   fnv1a64 receipt chain (`scr.chain`) seals the version;
4. the **novelty rule** is enforced by the harness: every version must
   measurably differ (`novelty.dist > 0`); a stay-course letter still forces
   a minimal divergence nudge — the arena's mandate is that minds never stop
   becoming different from what they were.

## 4. The perception economy (moth-quantum as a budget)

`arena/moth.mjs` is a **vault**, not a client:

- **two-step purchase** — `act.choose` runs deterministic; if its spend policy
  asks and `moth.left > 0`, the driver buys one packet (one qpixl job whose
  decode noise yields 32 true-random floats), receipts it in the mind's
  `moth.ledger`, and re-runs the same pure script with entropy in hand;
- **cache-namespaced determinism** — packets are cached on disk under an
  `OFF`/`LIVE` namespace; replays are byte-identical and burn zero API calls,
  and a synthetic packet can never shadow a real quantum read;
- **live cap** — at most 14 real jobs per run; this run used 8;
- **entanglement meter** — `graph-v1` tomography with the arena's telemetry
  (mean accuracy, alarm level, social style) encoded as Bloch-Z targets and
  hypothesized ZZ couplings, read before and after the live championship.

## 5. Novel methods found (discovered by the experimentation itself)

1. **The evolutionary gradient ensemble.** A particle filter can only *select*
   among its prior — likelihood reweighting never moves a weight, so a prior
   that does not contain the true opponent formula stays blind forever (the
   probe exposed this: cos ≈ 0.99 direction, 0.23 argmax accuracy). The fix
   that worked: give **every particle its own gradient step at its own fixed
   learning rate**, then let the posterior select over *tracking quality* and
   resampling breed the best rates. Pure selection and pure gradient are each
   strictly weaker than their offspring: BAYES recovery went 0.23 → 0.56.
2. **Feature conditioning poisons inference.** A 13-scale `pts` feature lets
   a 0.06 learned weight swing an argmax harder than a 2.0 weight on `adj`.
   Normalizing every feature to [0,1] lifted *all four families* (LIN 0.46 →
   0.59, MASK 0.41 → 0.70, WAVE 0.40 → 0.68). The feature language is part of
   the learning system.
3. **Cells fail silently; drivers must not.** `engine.call` reports program
   errors as `{status:'error'}` data instead of throwing — one duplicated
   helper declaration (`BASE` interpolated twice) silently disabled every
   `inf.update` in the first tournament (accuracy stuck at 0.00 everywhere
   was the only symptom). The arena's `callCell` wrapper now throws on error
   status. *In a reactive spreadsheet, telemetry for the machinery itself is
   not optional.*
4. **Opponent-as-sensor.** The minesweeper `avoid` feature turns an opponent's
   picks into distributed measurements of the hidden board — inference about
   *the player* and inference about *the world* become the same computation.
5. **Namespaced entropy.** A cache that serves "the same perceptual request"
   must still distinguish synthetic from quantum provenance — otherwise an
   offline packet silently impersonates a quantum read. Determinism and
   honesty are both cache-design problems.

## 6. Results (this run — all receipted in `arena/outputs/`)

- **Harness:** 23/23 checks green (referees re-derived and tamper-caught,
  planted-formula recovery above 2× chance for all four families with
  cosine ≥ 0.99, spectral kernel finds the planted period, budgets never
  overspent, receipts chains verify, deterministic replay, analyst fence
  holds under adversarial digests, MASK self-model alive with 324
  observations).
- **Live quantum:** probe 40H/24T (64 shots, mock=false); 6 championship
  packets spent by real policy triggers; tomography ZZ on the
  (accuracy × alarm) edge **0.018 → 0.466** across the convergence arc —
  reported as measured: the 4-qubit regime is a meter, not an oracle, and the
  arena does not pretend otherwise (agreement 0.333 at both reads).
- **Script-writers:** 4 real GLM letters during the championship revisions
  (B, B, A, B — all inside the A–E fence; one 429 storm absorbed by the
  doctrine fallback without breaking the run).
- **Tournament:** MASK (p3) took every set — but the interesting number is
  not the champion, it is the *probe table* (all four families recover a
  planted formula), the **style decay** (`p1.greed`, `p2.patience`,
  `p3.fear` → 0: weights retiring as understanding distributes), and the
  **diversity meter** (mean pairwise style distance 0.94 — the novelty
  pressure held the field apart even under imitation pressure).

`arena/outputs/e12_results.png` — four panels: standings by set with
phase/budget annotations, planted-formula recovery vs chance, the perception
economy (who bought perception when), and the craftmind pulse (novelty per
stamped revision).

## 7. Artifacts

| path | what |
|---|---|
| `arena/games.mjs` | both referees + public feature language + independent validators |
| `arena/minds.mjs` | the four minds (style architecture + family program cells) |
| `arena/tournament.mjs` | the world: game loops, two-step purchase, sets, script-writer, analyst |
| `arena/moth.mjs` | the vault: cache, namespaces, live cap, journal |
| `arena/play.mjs` | the 23-check harness |
| `arena/outputs/` | `summary.json`, `round_ledger.jsonl`, `moth_journal.json`, `moth_cache.json`, `e12_results.png` |
| `experiments/chart_e12.py` | regenerates the chart from receipts |

## 8. Lineage and honest limits

**Lineage.** Vendored quilt engine, patches 1–12 (see `engine/PROVENANCE.md`);
the M1–M8 sim-first doctrine of E11 (`quilt-quant/lab`) is the direct
ancestor — the arena generalizes "the sheet is the mind" from one mind facing
a market to many minds facing each other. The script-writer loop adapts the
craftmind architecture studied in the lucineer account forks
(`craftmind-researcher`'s hypothesis→experiment→distill pipeline,
`craftmind-herding`'s versioned scripts with embedded stats and telemetry
pulse) — with the writer now operating on **cells** instead of files.

**Honest limits.** One live run — quantum-seeded runs vary, and the shipped
cache freezes exactly this one; the entanglement meter is 4 qubits and
hypothesis-encoded, a curiosity gauge rather than an oracle; MASK's arena
dominance may reflect the small field (4 minds, 7 sets) more than the method;
hearts is a reduced 27-card game without passing, and the legal-move
abstraction hands observers the mover's action space (public in poker terms,
a leak in hearts terms — documented, not hidden); the GLM analyst sees a
digest, not the sheet; and "novelty" is enforced as parameter divergence, not
guaranteed conceptual originality. The point of the arena is that all of
these limits are themselves visible, receipted cells waiting to be revised.
