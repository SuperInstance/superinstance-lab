# QUILT ARCADE — spreadsheet-native games on the quilt engine

Four complete games where **the cells are the game**: the board is 9–64 value
cells, every rule is a quoted clause in `rules.book` ported 1:1 into a
first-class checker cell, a pure-sequencer referee applies the effects, and
one pushed value (`move.request`) cascades through the whole sheet — flips,
threat advisories, passes, scoring, and the learning loop.

Everything here is playtested (43/43 harness checks + real-browser QA) and
self-contained: the patched engine is vendored in `engine/`, and each game
ships a **single-file `index.html`** that runs from a double-click. No
install, no network, no build step for use.

```
quilt-arcade/
├── games/
│   ├── tictactoe/   index.html · play.mjs · sheet.mjs   ← START HERE (the ~40-cell template)
│   ├── reversi/     index.html · play.mjs · sheet.mjs   ← flagship (64-cell board, flip cascade)
│   ├── connect4/    index.html · play.mjs · sheet.mjs   ← gravity + threat advisories
│   └── gomoku/      index.html · play.mjs · sheet.mjs   ← pattern law + tookFive/missedFive gradient
├── experiments/
│   ├── reversi.json / connect4.json / gomoku.json     learning curves (real runs)
│   ├── learning_curves.md                             aggregated honest results
│   ├── llm_advisor.mjs / llm_advisor.json             small-model advisor seam (mock default, --real)
│   └── qa_reversi.png / qa_connect4.png               browser-QA captures
├── shared/          kit.mjs (harness/RNG/witness) · driver.mjs · viewer.mjs
├── engine/          vendored @quilt/core dist + patches 1–11 (see PROVENANCE.md)
├── run_all.mjs      scoreboard: node run_all.mjs
├── PATTERNS.md      the five reusable patterns + porting guide  ← read second
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
4. Headless proof: `node run_all.mjs` → 43/43 checks across the four games.

## What each game proves

| game | cells | the demonstration |
|---|---|---|
| tictactoe | 41 | the whole Laws→Checkers→Effects architecture in one readable file; perfect-play minimax never loses (300-game assert) |
| reversi | 113 | sandwich law as a checker returning the exact flip list; pass/end/score as clauses; engine board ≡ independent reference on every ply; corner discovery (θ: 0 → 4.8) |
| connect4 | 89 | gravity named by a rule cell; WIN NOW / MUST BLOCK advisories; learner discovers offense (0 → 7.9) and threat denial (0 → −7.2); held-out 72% vs its own gen-1 |
| gomoku | 126 | five-in-line named by the rule; `tookFive`/`missedFive` features give missed blocks a gradient; held-out 78% vs gen-1 |

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
  call-input memoization, eager mode, …) are documented in
  `engine/PROVENANCE.md` with the cumulative diff in the companion
  `quilt-playtest` deliverable. Upstream still lacks them — 6/11 probe
  leaks remain open there.

## Commands

```bash
node run_all.mjs                          # full scoreboard (43 checks)
node games/reversi/play.mjs               # one game's harness (verbose: __verbose=1)
node experiments/llm_advisor.mjs          # advisor seam, mock provider
node experiments/llm_advisor.mjs --real   # advisor seam, real z-ai calls (rate-limit guarded)
open games/reversi/index.html             # the spreadsheet, playable
```
