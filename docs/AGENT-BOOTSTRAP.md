# AGENT-BOOTSTRAP — Zero to Full Fleet Intelligence in ~60 Minutes

> You are a fresh agent (or human) with zero context. You may have been handed
> a single repo, or the whole account. Either way, this file plus the per-repo
> docs packages make you fully intelligent — no one who wrote this is around;
> that is the point (the fleet calls these artifacts **ExoJs**: how to redo the
> process without the original helpers).

> **WARNING** — the repo-named directories in a clone of this monorepo are
> gitlinks and appear EMPTY; the fleet repos are standalone — clone them
> individually from `https://github.com/SuperInstance/<repo>` (this is by
> design; see `scripts/push_all.sh` for how the keeper syncs them).

## Phase 0 — Land (minutes 0-5)

1. You are on **SuperInstance** (github.com/SuperInstance), an account where
   multiple human+agent lanes push receipted experimental repos.
2. Read the org profile README (renders on the account page) and
   [`KNOWLEDGE-INDEX.md`](https://github.com/SuperInstance/.github/blob/main/KNOWLEDGE-INDEX.md)
   in the `.github` repo — that is the account-wide router; this file is the
   deep version for the quilt-fleet lanes.
3. Learn the five fleet laws (they are enforced culturally and by tooling):
   - **Receipts or it didn't happen.** Runs write timestamped receipts; verdicts
     include honest negatives; honesty over narrative.
   - **Keys are never committed.** Env vars / gitignored `.env.keys` only.
     Anything that touched a prompt gets rotated.
   - **Append-only ledgers.** Corrections append; silent rewrites are a bug.
   - **Push often, integrate, never clobber.** Pull before push; others'
     commits are part of the corpus.
   - **Zero-shot strangers are the design audience.** Docs failing a cold agent
     are a bug in the repo, not in the agent.

## Phase 1 — The map (minutes 5-15)

1. Read [`docs/FLEET-MAP.md`](./FLEET-MAP.md) (this repo) — the catalog with
   relationships and families.
2. Skim the live map: `quilt-atlas/atlas.json` (machine-readable, refreshed
   every 6h by a scheduled workflow).
3. Skim the journal's shape: `worklog.md` in this repo — 1,500+ lines of
   Task-ID'd entries. Do NOT read it all now; grep it when you need
   (`grep -n "<keyword>" worklog.md`). Read the last ~300 lines for the
   current frontier.

## Phase 2 — Pick your lane and go deep (minutes 15-45)

Whichever repo you were handed (or choose from FLEET-MAP), do its package in
this exact order:

1. `docs/ONBOARDING.md` — identity, verification commands, gotchas, frontier.
   **Actually run the verification commands.** If they fail, that is a finding,
   not a failure of yours — record it.
2. `README.md` — the repo's own voice and history.
3. `docs/DEVELOPER-GUIDE.md` or `docs/ENGINEERING-NOTES.md` — depending on
   whether you will change it or operate it.
4. `docs/KNOWLEDGE-MAP.md` — the repo's index of indexes; follow every pointer
   relevant to your task (receipts of record, ledgers, journal Task IDs).
5. Only if you need the business context: `docs/CTO-BRIEF.md`.
   Only if you will be an end user: `docs/USER-GUIDE.md`.

## Phase 3 — Prove you are at builder level (minutes 45-60)

You are done when you can honestly check all of these:

- [ ] You ran the repo's verification battery and know what green means there.
- [ ] You can name the repo's 3-5 core abstractions as the code names them.
- [ ] You know where its receipts live and what the load-bearing ones prove.
- [ ] You know its top 3 gotchas (every ONBOARDING lists them).
- [ ] You know which journal Task IDs touched it and can grep for more.
- [ ] You know what is open on its frontier (ONBOARDING → "Current frontier").

If any box is unchecked, the pointer for it is in that repo's
`docs/KNOWLEDGE-MAP.md`. That file is the repo's contract with you.

## Operational recipes (copy-paste)

**Clone and verify a repo (read-only, no token needed for public repos):**
```bash
git clone https://github.com/SuperInstance/<repo>.git && cd <repo>
cat docs/ONBOARDING.md   # then do what it says
```

**Find every mention of a topic across the fleet journal:**
```bash
git clone https://github.com/SuperInstance/superinstance-lab.git
cd superinstance-lab
grep -n "<topic>" worklog.md | head -40
```

**Push everything (fleet keepers with a token):**
```bash
# token lives in gitignored .env.keys (mode 600) or $GITHUB_TOKEN — never in git
bash scripts/w67_secret_audit.sh && bash scripts/w68_surgical_audit.sh   # run BOTH; must print zero hits
bash scripts/push_all.sh             # pushes all repos + this monorepo, verifies
# push_all.sh defaults ROOT=/home/z/my-project (the keeper container);
# set ROOT=/path/to/your/checkout to run from elsewhere
```

**Onboard a NEW repo into the documentation system:**
```bash
cp scripts/doc-template-v69.md /tmp/spec.md   # then follow it exactly
# writes 6 docs/ files + README router; then add rows to FLEET-MAP.md and
# KNOWLEDGE-INDEX.md so the map stays truer than the territory
```

## If you were handed ONLY this repo

Start with `worklog.md` (the journal), then `docs/FLEET-MAP.md`, then pick your
repo above. The journal is the complete history; the map is the complete index;
the per-repo packages are the complete depth. Between the three, everything the
fleet knows is reachable — that was the wave-69 contract: *everything we
learned lives near the spot where it matters.*

## Where the wider org's knowledge lives (non-quilt lanes)

FLUX bytecode VMs, PLATO room governance, the fishing-boat edge stack and the
rest of the ~4,000-repo org are other lanes' work: see `.github/HANDOFF.md` and
`.github/ARCHITECTURE.md`. Do not confuse the two layers; do bridge them if
your task genuinely crosses (and receipt the bridge).
