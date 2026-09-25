// Build single-file index.html for each quilt-arcade game:
//   bun bundles viewer.mjs (engine + sheet + driver + UI) into one ESM script,
//   which is inlined into a minimal HTML shell — zero external requests, so it
//   runs from file:// with a double-click.
//
//   node scripts/build_arcade_html.mjs   (requires bun on PATH)

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'download', 'quilt-arcade');
const games = ['tictactoe', 'reversi', 'connect4', 'gomoku', 'holdem'];
const titles = {
  tictactoe: 'Quilt Arcade — TicTacToe (the template game)',
  reversi: 'Quilt Arcade — Reversi (rules-as-cells + learning loop)',
  connect4: 'Quilt Arcade — Connect Four (gravity + threats as cells)',
  gomoku: 'Quilt Arcade — Gomoku (patterns + learning loop)',
  holdem: "Quilt Arcade — Texas Hold'em (hidden info + ML strategy cells)",
};

const tmp = mkdtempSync(join(tmpdir(), 'qa-build-'));
for (const game of games) {
  const entry = join(root, 'games', game, 'viewer.mjs');
  const out = join(tmp, game + '.js');
  execFileSync('bun', ['build', entry, '--bundle', '--format=esm', '--target=browser', '--outfile', out],
    { stdio: 'pipe' });
  const js = readFileSync(out, 'utf8');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titles[game]}</title>
<style>
  body { margin: 0; background: #e9e2d2; display: flex; flex-direction: column; align-items: center; padding: 26px 14px; }
  #app { width: min(1180px, 100%); }
  .qa-foot { text-align: center; color: #8a7f6a; font: 12px ui-monospace, Menlo, monospace; padding: 14px 0 4px; }
</style>
</head>
<body>
<div id="app"></div>
<div class="qa-foot">quilt-arcade · every rule is a cell · every verdict is a cell write · every learned weight is a cell value</div>
<script type="module">
${js}
</script>
</body>
</html>
`;
  writeFileSync(join(root, 'games', game, 'index.html'), html);
  console.log(`built games/${game}/index.html (${(html.length / 1024).toFixed(0)} KB)`);
}
rmSync(tmp, { recursive: true, force: true });
console.log('done.');
