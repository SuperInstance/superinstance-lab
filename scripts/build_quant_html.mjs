// Build the single-file index.html for quilt-quant:
//   bun bundles viewer.mjs (engine + sheet + UI) into one ESM script inlined
//   into a minimal HTML shell — zero external requests, runs from file://.
//
//   node scripts/build_quant_html.mjs   (requires bun on PATH)

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'download', 'quilt-quant');
const tmp = mkdtempSync(join(tmpdir(), 'qq-build-'));
const out = join(tmp, 'quant.js');
execFileSync('bun', ['build', join(root, 'quant', 'viewer.mjs'), '--bundle', '--format=esm', '--target=browser', '--outfile', out],
  { stdio: 'pipe' });
const js = readFileSync(out, 'utf8');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quilt Quant — the trading desk as a spreadsheet</title>
<style>
  body { margin: 0; background: #e9e2d2; display: flex; flex-direction: column; align-items: center; padding: 26px 14px; }
  #app { width: min(1240px, 100%); }
  .qq-foot2 { text-align: center; color: #8a7f6a; font: 12px ui-monospace, Menlo, monospace; padding: 10px 0 4px; }
</style>
</head>
<body>
<div id="app"></div>
<div class="qq-foot2">quilt-quant · every indicator is a cell · every risk rule is a clause · every promotion is a receipt</div>
<script type="module">
${js}
</script>
</body>
</html>
`;
writeFileSync(join(root, 'quant', 'index.html'), html);
console.log(`built quant/index.html (${(html.length / 1024).toFixed(0)} KB)`);
rmSync(tmp, { recursive: true, force: true });
