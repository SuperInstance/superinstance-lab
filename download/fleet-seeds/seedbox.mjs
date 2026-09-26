#!/usr/bin/env node
// seedbox — turn a seed markdown file into a rigorous experiment repo skeleton.
// Usage: node seedbox.mjs <seed.md> <repo-slug>
//        node seedbox.mjs --selftest   (spawns a demo repo in .selftest/, runs its smoke, cleans up)
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const CHARTER = (slug, seed) => `# ${slug}

> Spawned by the fleet seedbox. The seed below is the charter of record —
> it is versioned in this repo's first commit and never edited afterward.
> Every experiment here must carry its decision rules as receipts dated
> BEFORE the run that produced the numbers.

## Charter (the seed, verbatim)

${seed}

## Lane doctrine (inherited, not optional)

1. **Paired arms, identical worlds** — arms differ only in the mechanism under
   test; the truth stream, confounders, and reward streams are shared.
2. **Decision rules before the run** — the exact verdict rule is written into
   the receipt chain before the full run executes; no post-hoc verdicts.
3. **Counterfactual measurement** — effects are measured against the same pool
   with the mechanism zeroed, never against a different world.
4. **Honest negatives** — a defense that fails, fails loudly, with the
   mechanism computed from telemetry, not drafted in advance.
5. **Replayable** — \`node smoke.mjs\` green on every commit; CI runs it.

## First lane (fill in)

- [ ] Turn the charter's question into one experiment with named arms.
- [ ] Receipt the decision rules.
- [ ] Run, write outputs/, verify the chain, commit.
`;

const CI = `name: smoke
on: [push, workflow_dispatch]
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: node smoke.mjs
`;

const SMOKE = `// smoke.mjs — the repo's first receipt. Replace checks with real ones as the
// experiment grows; the count in the final line is the contract CI enforces.
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  \\u2713 ' + name); } else { fail++; console.log('  \\u2717 ' + name); } };

// 1. determinism: the hash of nothing is known
ok(createHash('sha256').update('').digest('hex').startsWith('e3b0c442'), 'sha256 of empty string is the known digest');
// 2. entropy source available (the experiment will need randomness)
ok(randomBytes(8).length === 8, 'randomBytes yields 8 bytes');
// 3. charter present (the seed is versioned)
ok(existsSync(new URL('./README.md', import.meta.url)), 'charter README.md exists');

console.log(fail === 0 ? \`SMOKE OK (\${pass}/\${pass + fail} checks)\` : \`SMOKE FAILED (\${fail} of \${pass + fail} checks)\`);
process.exit(fail === 0 ? 0 : 1);
`;

const GITIGNORE = 'node_modules/\noutputs/.cache/\n.DS_Store\n';

function spawn(seedPath, slug) {
  const seed = readFileSync(seedPath, 'utf8');
  const dir = join(process.cwd(), slug);
  if (existsSync(dir)) throw new Error(`${dir} already exists — pick another slug`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'README.md'), CHARTER(slug, seed.trim() + '\n'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: slug, version: '0.1.0', type: 'module', scripts: { smoke: 'node smoke.mjs' }, license: 'MIT' }, null, 2) + '\n');
  mkdirSync(join(dir, '.github/workflows'), { recursive: true });
  writeFileSync(join(dir, '.github/workflows/smoke.yml'), CI);
  writeFileSync(join(dir, 'smoke.mjs'), SMOKE);
  writeFileSync(join(dir, '.gitignore'), GITIGNORE);
  mkdirSync(join(dir, 'outputs'), { recursive: true });
  const git = (c) => execSync(c, { cwd: dir, stdio: 'pipe' });
  git('git init -q');
  git('git add -A');
  git('git -c user.name="fleet-seedbox" -c user.email="fleet@seedbox" commit -qm "seed: charter committed verbatim — the question is the first receipt"');
  console.log(`spawned ${dir} (1 commit) — next: open the lane, receipt the decision rules, run.`);
}

function selftest() {
  const demoSeed = '# selftest seed\n\nDoes the seedbox produce a repo whose smoke passes?\n';
  const dir = '.selftest';
  rmSync(dir, { recursive: true, force: true });
  writeFileSync('.selftest-seed.md', demoSeed);
  spawn('.selftest-seed.md', dir);
  const out = execSync('node smoke.mjs', { cwd: dir, encoding: 'utf8' });
  console.log(out.trim().split('\n').pop());
  const commits = execSync('git rev-list --count HEAD', { cwd: dir, encoding: 'utf8' }).trim();
  console.log(`selftest: ${commits} commit(s), smoke green -> ${out.includes('SMOKE OK') ? 'PASS' : 'FAIL'}`);
  rmSync(dir, { recursive: true, force: true });
  rmSync('.selftest-seed.md', { force: true });
}

const [a, b] = process.argv.slice(2);
if (a === '--selftest') selftest();
else if (a && b) spawn(a, b);
else { console.error('usage: node seedbox.mjs <seed.md> <repo-slug>  |  node seedbox.mjs --selftest'); process.exit(1); }
