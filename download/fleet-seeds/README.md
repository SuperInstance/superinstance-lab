# fleet-seeds — the intake lane for new experiment repos

> Every seed file becomes a repo. Every repo becomes a receipted experiment.

## The protocol

1. Drop seed files (`seed1.md` … `seedN.md`) into this directory.
2. For each seed: `node seedbox.mjs seed1.md "repo-slug"`
   - emits `./<repo-slug>/` with: README.md (seed embedded verbatim + experiment
     charter header), package.json, a GitHub Actions CI that runs the smoke
     suite on every push, a `smoke.mjs` placeholder with a real check, and a
     first git commit.
3. Each spawned repo gets its own lane: the seed's question is turned into a
   receipted experiment (house style: paired arms, decision rules receipted
   BEFORE the run, honest negative verdicts welcome), run, committed, pushed.

## Why a box for it

The fleet's hardest-won lesson is that *starting* is where quality dies: a
question with no scaffold becomes a script with no receipt, becomes a claim
with no number. The seedbox makes the starting state rigorous by default —
CI on the first commit, a smoke check before any code, the seed itself
versioned as the charter of record.

## Status

- Waiting on seed files. The upload that carried them did not land
  (upload/ empty, nothing on disk, nothing in the account's recent repos).
- The box is built and tested (`node seedbox.mjs --selftest`).
- When the seeds arrive: spawn one repo per seed, one lane per repo.
