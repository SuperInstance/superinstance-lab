# The Decomposition Atlas (wave-66)

> Principal directive: *study the other works pushed recently to superinstance;
> dog-food the team on what others have done, in and out of superinstance; slowly,
> over many rounds, decompose ideas into elementary parts in spreadsheet logic,
> with jevs finding gates through the layers of logic; keep timestamped ledgers;
> level an EXOJ of how to do it again without them.*

This directory is the wave-66 answer. Every sibling work the fleet has pushed —
and the external research it leaned on — is decomposed into **elementary parts**
rendered as **spreadsheet logic** (rows = parts, columns = attributes), organized
into **five canonical layers** that a JEV gate-sweep walks, all recorded in
**timestamped ledgers**, and finally compiled into an **EXOJ kit** that re-runs
the whole method with zero agents.

## Layout

```
corpus.json        the registry of studied works (families, paths, one-line essences)
parts/<family>/    one decomposition JSON per work (ideas + parts + sheet + layer_logic)
receipts/          append-only timestamped JSONL ledgers, one per lane + sweep
gates/             gate-map from the JEV sweep over decomposition layers
../decomposition-atlas.xlsx   the compiled spreadsheet (per-work sheets, gates, ledger)
```

## The five canonical layers ("layers of logic")

| # | layer | question it answers |
|---|-------|---------------------|
| 0 | substrate | what irreducible representation does the work stand on? |
| 1 | mechanism | what transforms state, and from what to what? |
| 2 | policy | what decides, admits, prices, or refuses? |
| 3 | interface | what does the outside touch (wires, tools, sheets)? |
| 4 | evidence | what proves it ran, and what makes tampering loud? |

## Gate vocabulary (what the jevs sweep)

`precondition | invariant | postcondition | budget | seal | admission | conservation`

A **gate** is any pass/fail condition a part asserts before, during, or after it
acts. The gate sweep (wave-66 round 2) walks layers 0→4 per work and asks the
jev machinery for a soft judgment (γ/η/Δ emit, never collapsed) on every gate,
with explicit observation only at layer boundaries — the ExoJ law.

## Doctrine (inherited, not optional)

- Decision rules before the run; honest negatives are crown jewels.
- Elementary = cannot be split further without changing meaning.
- Every claim carries `evidence` (file + line) from the studied repo.
- Ledgers are append-only; nothing is ever rewritten.
- The final kit (`exoj/atlas.mjs`) must reproduce rounds 1–2 with **no agents**.
