# superinstance — the front door

**The spreadsheet grew senses.** This folder is the brand and the flagship
demonstration for everything the quilt engagement produced: a single
self-contained HTML showcase where four sheets are *literally alive*, plus the
identity kit that makes SuperInstance look like a thing, not a repo.

## Open `index.html`

One file, zero dependencies, works offline. Inside:

| # | live demo | what proves |
|---|-----------|-------------|
| 01 | **Ocean-as-a-Sheet** — 336 value cells, damped wave formula, a tide-gauge listener that lights the foam | reactivity as physics |
| 02 | **Reversi, self-playing** — TIDE (positional weights) vs TERRA (mobility), `pick` formula + apply-move listener, loser's weight cells drift after every game | the sheet plays itself, and the learning loop is watchable |
| 03 | **Hold'em — playing the players** — pot odds cost 0 tokens (a formula), `shape.opp` reads OPP's decisions into looseness/aggression/deception, a listener speaks the read, and a focus slider fades your own cards into the environment | the odds are mechanical; the players are the game |
| 04 | **The signal desk** — EMA-cross tape where a signal is only a *proposal*, a confirmation cell is the gate, and entries can require a draw from a rationed (mocked) quantum budget | simulation-first, perception costs something |

Plus: the honest **landscape table** (Excel+Copilot, Google Sheets, Airtable,
Notion, Observable, Bloomberg Terminal, Hex/Deepnote — and where the big
players genuinely still win), a positioning map, the six-patch ecosystem quilt,
and the manifesto.

The page runs on a ~120-line embedded reactive engine (`value` / `formula`
with declared deps / `watch` listeners / cascade cycle-guard) — the same
semantics as the full quilt runtime, small enough to read with your coffee.
Every console in the page streams real engine events.

## Brand kit (`brand/`)

- `mark.svg` — "the watching cell": a quilt of four cells, three quiet, one
  lit and pulsing. The smallest honest diagram of the idea.
- `logo.svg` — horizontal lockup. `favicon.svg` — 64px tile.
- `README.md` — palette ("deep tide": ink / tide / signal / budget / quantum),
  type, motion rules. Accents are bound to meanings, never decoration.

## Images (`images/`)

- `hero-art.png`, `quilt-art.png` — generated brand art (night-ocean-of-cells,
  stitched quilt of living patches).
- `og-card.png` — 1200×630 social card.
- `positioning-map.png` — the landscape 2×2, standalone.
- `demo-*.png`, `qa-*.png` — real screenshots captured by the automated
  playtest (see below).

## Playtest log — what iterating actually caught

The QA harness (`scripts/superinstance/qa.mjs`) drives the page in headless
Chromium: console/page errors, canvas-animation assertions, real clicks, and
per-demo screenshots. Four rounds, each one caught something real:

| round | finding | fix |
|-------|---------|-----|
| v1 | **Ocean blew up** — gauge read `-7.2e+34`. The wave recursion used the *current* field as its inertia term (wrong two-step scheme), and unclamped resonance + repeated drops compounded | correct `(Σhₙ)/2 − h_prev` scheme, damping 0.99, hard ±3 clamp |
| v1 | **Reversi never moved** — the initial `pick` was evaluated *before* its listener existed; nothing ever re-triggered the chain | kick the chain: `schedule(S.get('pick'))` after wiring |
| v2 | **Hold'em shape froze at n=0** — the classic aliasing trap: `stt.n++` mutated the cell's own object, then spread that same mutated object back in; new value deep-equalled the current one → recompute silently skipped | copy-then-mutate: fresh object from `prev`, mutate the copy, then set |
| v2 | **Consoles unreadable** — 24 flex rows in a fixed-height column; flex-shrink squashed every line into overlap | `flex: 0 0 auto` on log lines |
| v3 | **Ocean looked dead between drops** — render gain too low for decayed waves | render gain 0.55, ambient drop every 80 frames |

Final state: **zero console/page errors**, hero canvas verified animating,
reversi self-plays to 63 discs, hold'em observations climb street by street
with composed reads, desk trades with a metered quantum budget.

## Why this makes SuperInstance "a thing"

Every other spreadsheet company ships screenshots and asks for trust.
The front door here asks for nothing: the cells are running before you
scroll, the learning loop is visible, the receipts are the story, and the
comparison with the big players is scored honestly — including the columns
where they win today.
