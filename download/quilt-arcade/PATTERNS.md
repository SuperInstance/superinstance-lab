# PATTERNS — how these games are built (and how to port yours)

Four working games live in this folder, all built from the same five patterns
on top of the quilt reactive cell engine. Read `games/tictactoe/sheet.mjs`
first — it is the whole architecture in ~40 cells. Everything else is scale.

---

## Pattern 1 — Laws, Checkers, Effects (the game-mechanics cell)

The user-facing idea: *one cell holds the rules in precise natural language,
and that language is ported 1:1 into machine-checkable cells.* The sheet
makes the port itself inspectable.

```
rules.book          value cell — the complete ruleset, numbered clauses (R1..R6)
rule.R3.law         value cell — the clause quoted verbatim from the book
rule.R3.check       program cell — THE MACHINE PORT. Pure: (input) -> {fired, why, ...}
rule.R3.verdict     value cell — record of its last evaluation
```

Contract for checkers:
- **Pure.** Grid/state comes in through `input`; no `runtime.get` of state.
  (Pure checkers are directly callable — `engine.call('rule.R3.check', {grid, r, c, player})`
  is a legitimate research probe, and the harnesses use it that way.)
- **Opinionated text.** The `why` string is written for the bubble UI:
  *"Placing at A1 brackets no enemy line in any of the 8 directions (R3 needs
  own...enemy...own with no gaps), so the placement is illegal."*
- **Rich verdicts.** A checker returns what the referee needs to ACT: R3
  returns the exact flip list with ray names; R4 (connect-four) returns the
  winning squares. The bubble, the animation, and the ledger all read these.

## Pattern 2 — The arbiter is a sequencer, not a knower

`move.arbiter` knows **no rules**. It only:
1. runs the checkers in clause order via `runtime.call`,
2. refuses on the first violation (storing the verdict for the bubble),
3. applies the effects the checkers computed (writes board cells one by one —
   that write order IS the flip cascade),
4. keeps the ledger (`rules.verdict`, `log.events`, `match.seq`).

Two hard rules learned by playtesting:
- **`match.seq` is owned by the arbiter.** It bumps it on acceptance and its
  DUP guard (`seq <= last → refuse, change nothing`) makes every request a
  distinct capability. Drivers must NOT pre-increment it (a stale-seq loop
  cost us an hour — see git history of `play.mjs`).
- **`runtime.call` returns a CellValue** — take `.data`. Miss it once and the
  whole sheet reads "undefined". The harnesses catch this class instantly.

## Pattern 3 — Push-of-a-value input surface

The entire human/AI input surface is ONE value cell:

```
UI/driver -> engine.set('move.request', {r, c, player, seq})
          -> listener move.push (watch: move.request)
          -> move.dispatch (trampoline, idempotent per seq)
          -> move.arbiter -> rule cells -> board cells + ledger
```

One write cascades through the whole sheet — the flips, the score formulas,
the threat advisories, the pass logic. The viewer just diffs snapshots; the
*sheet* did the work. AI plies enter through the same door (`match.step`
computes a move, then calls the arbiter — never a private back door).

## Pattern 4 — Learning loops as cells (watchable, receipitable)

```
ai.weights         value cell — the policy vector θ (plain numbers, visible)
ai.features        program cell — feature vector of a candidate (pure)
ai.choose          program cell — argmax(θ·f) with seeded tie-break
ai.move_log        value cell — θ-relevant features of each learner move
learn.update       program cell — averaged perceptron: θᵢ += α·result·fᵢ
learn.receipts     value cell — fnv1a64 hash chain: one receipt per generation
```

Design notes that made learning *honest and visible*:
- **The control group is the learner's own frozen generation-1 policy**
  (`ai.fixed_weights`). "Did generation N beat generation 1?" is a question
  the data can actually answer; "is 62% good?" is not.
- **Train/eval split inside the harness**: the per-generation curve is
  telemetry; the verdict comes from a held-out block (60 games vs frozen θ₀).
- **Give missed opportunities a gradient.** The naive move-level perceptron
  only sees moves made. Gomoku adds `tookFive` / `missedFive` features
  (was a winning square available this turn? did you take it?) — that's how
  the learner discovers blocking at all.
- **Witness receipts.** Every generation pins `{seq, result, theta_hash,
  win_rate10, prev_hash}` into an fnv1a64 chain; the harness re-derives it
  from GENESIS. Tamper with your learning curve and the chain breaks.

Measured results (see `experiments/learning_curves.md`): reversi discovers
corners (θ.corner 0 → 4.8), connect-four discovers offense AND threat denial
(θ.mine3 0 → 7.9, θ.theirs3 0 → −7.2; held-out 72%), gomoku discovers the
five-square (θ.tookFive 0 → 1.6; held-out 78%).

## Pattern 5 — Referee-validates-everything (including the model)

`match.step` (AI ply) and human pushes converge on the same arbiter — the AI
cannot move outside the rules even if its policy is broken. This extends to
LLMs: `experiments/llm_advisor.mjs` wires an `ai.llm` cell as an advisor with
the System One doctrine:
- the position becomes a **letter-coded menu** (`A = D3`, `B = C4`, ...) — the
  model can only point at a letter, never invent a move,
- the adapter decodes; invalid letters (`BANANA`) are refused,
- the arbiter still verifies the suggestion through the rule cells,
- provider down / rate-limited → the sheet degrades to the heuristic and
  **says so** (`source: 'heuristic-fallback'`), because the engine's ai cells
  return unusable values rather than throwing — treat both as refusal.

Run it: `node experiments/llm_advisor.mjs` (mock, deterministic) or
`node experiments/llm_advisor.mjs --real` (z-ai, backoff-guarded).

---

## Porting a new game (checkers / go / chess / …)

1. Copy `games/tictactoe/sheet.mjs`. Write `rules.book` in precise numbered
   clauses — this is the design step; if a clause is vague the checker will
   expose it.
2. One checker per clause. Keep them pure; pass `grid` in `input`.
3. Write the arbiter as a sequencer; give effects in checker verdicts.
4. Add `ai.features`/`ai.choose`/`learn.*` if the game has a learnable policy
   (ask: "what did I fail to see when I lost?" — that's your feature).
5. Copy any `play.mjs`, write an INDEPENDENT reference implementation for the
   win/legality math, and cross-check whole-board equality every ply. Every
   bug found in this arcade was caught by exactly that referee-vs-reference
   disagreement.

## Engine facts the hard way (playtest patches in engine/PROVENANCE.md)

- program cells run in a `new Function` scope — helpers are inlined at sheet
  build time (`${RV}` interpolation in the sheets); there is no shared scope.
- `runtime.call(id, input)` → CellValue; `.data` is yours. Distinct inputs are
  distinct memo entries (patch 10) — thread a `seq`/nonce through state-dependent
  calls to make memoization work FOR you.
- watch-triggered listeners need the playtest patches (upstream `watch` lists
  are dead code); eager mode gives listeners true prev/current transitions.
- `loadSheet` REPLACES the sheet. To extend a loaded sheet, `engine.register(def)`
  per cell (the LLM advisor overlay does this).
