# QUILT ARCADE — spreadsheet-native games on the quilt engine

Five complete games where **the cells are the game**: the board (or the deck)
is value cells, every rule is a quoted clause in `rules.book` ported 1:1 into a
first-class checker cell, a pure-sequencer referee applies the effects, and
one pushed value (`move.request` / `action.request`) cascades through the whole
sheet — flips, card reveals, threat advisories, passes, betting, scoring, and
the learning loop. Four perfect-information grid games plus **Texas Hold'em**,
which adds hidden information (privacy as a formula over cells) and a
strategy-weight learning loop you can watch refine in the open.

Everything here is playtested (**55/55** harness checks + real-browser QA) and
self-contained: the patched engine is vendored in `engine/`, and each game
ships a **single-file `index.html`** that runs from a double-click. No
install, no network, no build step for use.

```
quilt-arcade/
├── games/
│   ├── tictactoe/   index.html · play.mjs · sheet.mjs   ← START HERE (the ~40-cell template)
│   ├── reversi/     index.html · play.mjs · sheet.mjs   ← flagship grid game (64-cell board, flip cascade)
│   ├── connect4/    index.html · play.mjs · sheet.mjs   ← gravity + threat advisories
│   ├── gomoku/      index.html · play.mjs · sheet.mjs   ← pattern law + tookFive/missedFive gradient
│   └── holdem/      index.html · play.mjs · sheet.mjs · cards.mjs   ← non-grid: hidden info + ML weights
├── experiments/
│   ├── reversi.json / connect4.json / gomoku.json / holdem.json   learning curves (real runs)
│   ├── learning_curves.md                                         aggregated honest results
│   ├── agent_ux_field_notes.md                                    the agents' process, documented
│   ├── llm_advisor.mjs / llm_advisor.json                         small-model advisor seam (mock default, --real)
│   └── qa_*.png                                                   browser-QA captures (incl. holdem table)
├── shared/          kit.mjs (harness/RNG/witness) · driver.mjs · viewer.mjs
├── engine/          vendored @quilt/core dist + patches 1–12 (see PROVENANCE.md)
├── run_all.mjs      scoreboard: node run_all.mjs
├── PATTERNS.md      the six reusable patterns + porting guide  ← read second
└── README.md        this file
```

## 60-second tour

1. **Open `games/reversi/index.html`.** Click `D3`. Watch the R3 rule bubble
   ("brackets 1 enemy disc along S — all convert to BLACK"), the flip cascade
   animate, the AI reply, the rulebook clauses flash as they fire.
2. Click an illegal square — the referee refuses in context (red bubble, the
   exact clause, the square named).
3. Switch to **AI ↔ AI**: self-play with learning on. The generation counter
   ticks, the θ bars drift — corner weight climbing is corner discovery,
   live.
4. **Open `games/holdem/index.html`.** You are seat P1. Your cards render;
   the two AI seats render `?? ??` — that masking is `rule.C10.check`, a
   formula over cells, not a private channel. Fold/check/call/raise with the
   buttons; at showdown every projection flips open. Then switch to
   **AI ↔ AI**: the fish bleeds while the learners' weight bars (aggro,
   sticky, …) drift hand by hand — two opponents getting harder in front of
   you. `show ▤` is the explicit call-to-show.
5. Headless proof: `node run_all.mjs` → 55/55 checks across the five games.

## What each game proves

| game | cells | the demonstration |
|---|---|---|
| tictactoe | 41 | the whole Laws→Checkers→Effects architecture in one readable file; perfect-play minimax never loses (300-game assert) |
| reversi | 113 | sandwich law as a checker returning the exact flip list; pass/end/score as clauses; engine board ≡ independent reference on every ply; corner discovery (θ: 0 → 4.8) |
| connect4 | 89 | gravity named by a rule cell; WIN NOW / MUST BLOCK advisories; learner discovers offense (0 → 7.9) and threat denial (0 → −7.2); held-out 72% vs its own gen-1 |
| gomoku | 126 | five-in-line named by the rule; `tookFive`/`missedFive` features give missed blocks a gradient; held-out 78% vs gen-1 |
| holdem | 124 | **non-grid**: 10 clauses C1–C10 (deck, blinds, streets, betting, table stakes, showdown, ranking, rebuy, projection); Monte-Carlo equity cell; strategy weights as separate cells (`W.p1.aggro`…) nudged per hand with reason-tagged receipts; hole cards hidden by a formula (`rule.C10.check`) until the show; independent brute-force evaluator agrees on 200 hands; chip conservation asserted every action |

## Honest notes

- The "AI" is a linear policy over hand-built features (plus a perfect
  minimax for tictactoe) — deliberately simple, so the *learning dynamics*
  are inspectable and the referee/reference cross-check is airtight. The
  seam for a real small-model advisor is implemented and fenced
  (`experiments/llm_advisor.mjs`); the learning loops themselves need no
  model at all.
- "GAN" in spirit: two policies, self-play, visible weight drift per
  generation. Formally it's an averaged-perceptron loop with witness
  receipts — the receipts make the curves tamper-evident, which matters
  more for research than the branding.
- All engine patches used here (listener watch wiring, program invalidation,
  call-input memoization, **fresh-by-default effectful evaluation (12)**, eager
  mode, …) are documented in `engine/PROVENANCE.md` with the cumulative diff in
  the companion `quilt-playtest` deliverable. Upstream still lacks them — 6/11
  probe leaks remain open there.

## Commands

```bash
node run_all.mjs                          # full scoreboard (55 checks)
node games/holdem/play.mjs                # one game's harness (verbose: globalThis.__verbose)
node experiments/llm_advisor.mjs          # advisor seam, mock provider
node experiments/llm_advisor.mjs --real   # advisor seam, real z-ai calls (rate-limit guarded)
open games/reversi/index.html             # the spreadsheet, playable
open games/holdem/index.html              # the poker table, playable
```
