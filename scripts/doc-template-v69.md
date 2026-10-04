# WAVE-69 DOC TEMPLATE — THE FULL-KNOWLEDGE PACKAGE (v1)

You are writing documentation so that ANY future agent or human — zero-shot, no
context, anywhere on Earth — can clone a SuperInstance repo and reach FULL
working intelligence at the level of the agents who built it.

## THE FLEET CONTEXT (shared vocabulary — reuse these terms correctly)

- **SuperInstance** = the GitHub account (github.com/SuperInstance) where many
  human+agent lanes push receipted experimental repos. ~300 repos, multiple
  agents pushing daily.
- **Quilt** = reactive cell runtime (SuperInstance/quilt): a sheet of typed
  cells evaluated by a pull-based reactive engine; caller-aware memoization;
  formulas with a `with(cells)` DSL; listeners (watch/condition/action).
- **Cells / cellular thinking** = decomposing ideas and systems into elementary,
  independently-operating parts ("spreadsheet logic"), then finding the GATES
  (decision points / doors between layers of logic).
- **JEV** = judge/evaluator-verifier helper model ("judge") used to find gates
  through layers of logic; used extensively with OTHER models (GLM, DeepSeek,
  TypeSafe.ai). A JEV gate = scored verdict artifact on whether an artifact
  passes a quality bar.
- **Receipts** = timestamped, append-only records of what was run and what
  happened. The fleet's honesty law: claims ride on receipts; no receipt, no
  claim. Receipt ledgers are often hash-chained.
- **Waves** = numbered work sessions (wave-63 … wave-69), each with a task ID
  (e.g. 68-a) and an entry in the monorepo journal
  (SuperInstance/superinstance-lab → worklog.md at repo root).
- **ExoJ** = an artifact that lets a future agent redo a full process WITHOUT
  the original helpers: the "how to do it again from scratch" document.
- **Stone standard** = a stranger should be able to verify what the fleet claims
  from the artifacts alone.
- **Dog-food** = study/run other agents' works (in and out of SuperInstance)
  and record what you learn.
- **Seed / seedbox** = fleet-seeds intake: a seed file becomes a repo becomes a
  receipted experiment.
- **Organ** = a saved-state bundle bootable by others (quilt-organ concept,
  served via Cloudflare Workers in quilt-organ-workers).

## THE PACKAGE — 7 files per repo

Write these into `docs/` of your assigned repo (create `docs/` if missing;
NEVER delete or rewrite existing docs — you are adding a layer):

1. `docs/ONBOARDING.md` — the zero-shot agent entry point
2. `docs/USER-GUIDE.md` — for end users of the repo's capability
3. `docs/DEVELOPER-GUIDE.md` — for developers extending the code
4. `docs/ENGINEERING-NOTES.md` — for engineers operating/reviewing the system
5. `docs/CTO-BRIEF.md` — for executives deciding investment
6. `docs/KNOWLEDGE-MAP.md` — the index of ALL deeper knowledge for this repo
7. Append a `## Documentation` section to the repo `README.md` (if not already
   present) that routes each audience tier to the right file. Do not remove any
   existing README content; append at the end.

## FILE SKELETONS (fill every section; no placeholders, no "TODO")

### docs/ONBOARDING.md
```markdown
# <repo> — Agent Onboarding
> Zero-shot entry point. Clone → competent in ~10 minutes.

## Identity (2 sentences)
<what this repo is, in plain language>

## Why it exists (the fleet problem it solves)
<3-5 sentences, name the wave(s) that built it>

## Verify it works (exact commands)
```bash
<the exact commands a fresh clone needs; if deps are needed, list them;
 if something CANNOT run without external credentials, say so explicitly
 and point at the receipt that proves it ran>
```

## Reading order (paths, not vibes)
1. `<path>` — <what you learn from it>
2. ...

## The things that will bite you (gotchas)
- <specific, real gotchas found during play-testing — engine quirks, env
  assumptions, non-obvious invariants>

## Where deeper knowledge lives
- Knowledge map: [docs/KNOWLEDGE-MAP.md](./KNOWLEDGE-MAP.md)
- Fleet journal: SuperInstance/superinstance-lab → worklog.md (grep '<repo>')
- <receipts/, ledgers, related repos — with one line each on what they hold>

## Current frontier (what is open right now)
<the honest open questions / next queue, with pointers>
```

### docs/USER-GUIDE.md
Sections: **What you get** / **Install** (exact) / **First success in 5 minutes**
(runnable example with expected output) / **Everyday usage** (the 3-6 most
common tasks, each with a command block) / **Troubleshooting** (table: symptom →
cause → fix) / **FAQ** (≥4 real questions). Write for a smart user who has
never seen the fleet.

### docs/DEVELOPER-GUIDE.md
Sections: **Code layout** (file-by-file map of the important paths) /
**Core concepts** (the 3-6 abstractions, named as the code names them) /
**How to extend** (step-by-step: add an X, add a Y — with code snippets drawn
from the actual repo) / **Testing** (how to run the suite; what green means) /
**Conventions** (naming, receipt discipline, commit style used in history) /
**Gotchas for editors** (what breaks when you touch what).

### docs/ENGINEERING-NOTES.md
Sections: **Architecture** (components + data flow; include an ASCII diagram) /
**Invariants** (the properties that must never break, and where they are
enforced) / **Failure modes & blast radius** (what fails how, what contains it)
/ **Performance & cost envelope** (measured numbers where receipts exist; label
estimates clearly) / **Operations** (how it is run: local, CI, workers;
credentials model — env vars, never committed) / **Design decisions & why**
(the 3-6 real decisions with the tradeoff, citing receipts where they exist).

### docs/CTO-BRIEF.md
Sections: **One-paragraph value statement** / **What it does & for whom** /
**Maturity assessment** (honest stage: prototype / working / hardened — with
the evidence) / **Risks** (technical, operational, security — each with
mitigation status) / **Cost profile** (compute/services, free-tier posture) /
**Strategic options** (invest / maintain / harvest-learnings / retire — with
the reasoning) / **Integration surface** (what it plugs into in the fleet).
Keep it under ~120 lines. Executives read this in 5 minutes.

### docs/KNOWLEDGE-MAP.md
The index of indexes. Sections:
- **In this repo** — bullet map of every meaningful directory/file cluster
  (receipts, ledgers, experiments, assets) with one line each.
- **Pre-existing docs** — list ALL docs that already existed before wave-69
  (README, DESIGN.md, essays, etc.) with one line each on what they hold.
- **In the fleet** — related repos with the relationship stated
  (uses / used-by / sibling / upstream / downstream).
- **In the journal** — SuperInstance/superinstance-lab → worklog.md: the
  specific Task IDs and waves that touched this repo (grep '<repo>' worklog.md
  and cite the Task IDs you found).
- **Receipts of record** — the load-bearing receipt files and what they prove.
- **How to search further** — the exact grep/commands that surface more
  (e.g. `grep -rn "gate" receipts/`).

## QUALITY BARS (violating any of these = rework)

1. **Depth**: every section carries real content — a section header followed by
   1-2 lines is forbidden. Prose sections ≥3 sentences. This is a documentation
   LEGACY, not a stub.
2. **Truth**: every claim about behavior must come from the repo (read the
   code/README/receipts) or from the worklog. If you cannot verify, write
   "unverified" next to the claim. NEVER invent numbers.
3. **Runnable**: every command block must be literally correct for a fresh
   clone (check package.json / pyproject / scripts before writing commands).
   If execution requires credentials the reader won't have, say so in the block.
4. **No secrets**: never include any token, key, or credential value. Refer to
   them as env var NAMES only (GITHUB_TOKEN, TYPESAFEAI_KEY). If you ever see
   a real-looking secret in repo content, DO NOT copy it into docs; flag it in
   your final report instead.
5. **No git**: do NOT run git commit/push. Do NOT touch files outside your
   assigned repos except appending your worklog entry (below).
6. **Language**: English, direct, technically dense but readable. No emoji.
7. **Honesty**: state residuals (what does not work, what is unverified) in the
   open. The fleet's law: honesty over narrative.

## WORKLOG PROTOCOL (mandatory)

After finishing ALL your repos, append ONE entry to the shared journal with
bash (append-only, do not rewrite the file):

    cat >> /home/z/my-project/worklog.md << 'W69EOF'

    ---
    Task ID: <your task id, e.g. 69-doc-a>
    Agent: general-purpose (wave-69 doc scribe)
    Task: <one-line: which repos you documented>

    Work Log:
    - <concrete steps: what you read, what you wrote, notable findings>

    Stage Summary:
    - <files written, quality bars met, residuals found>

    W69EOF

Your final report back must list: every file written (path), any secrets or
broken-run findings, and any repo where docs could not be verified.
