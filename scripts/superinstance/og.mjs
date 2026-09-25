// og.mjs — export brand images: OG social card (1200x630) + positioning map PNG
import { createRequire } from 'module';
const require = createRequire('/home/z/my-project/');
const { chromium } = require('playwright');
import fs from 'fs';

const IMG = '/home/z/my-project/download/superinstance/images';
const heroArt = fs.readFileSync(`${IMG}/hero-art.png`).toString('base64');

const favicon = 'PASTE';
const browser = await chromium.launch();

// ---- OG card 1200x630 ----
const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0}
  body{width:1200px;height:630px;overflow:hidden;position:relative;
    font-family:-apple-system,'Segoe UI',Inter,Roboto,Arial,sans-serif;background:#070B14;color:#E8EDF7}
  .bg{position:absolute;inset:0;background:url(data:image/png;base64,${heroArt}) center/cover;opacity:.9}
  .veil{position:absolute;inset:0;background:linear-gradient(100deg,rgba(7,11,20,.94) 30%,rgba(7,11,20,.55) 62%,rgba(7,11,20,.28))}
  .wrap{position:absolute;inset:0;padding:64px 70px;display:flex;flex-direction:column}
  .logo{display:flex;align-items:center;gap:14px;font-size:26px;letter-spacing:-.5px}
  .logo b{font-weight:800}.logo span{font-weight:300;color:#8A96AD}
  .mark{width:40px;height:40px}
  h1{font-size:74px;line-height:1.03;letter-spacing:-3px;font-weight:800;margin-top:74px;max-width:820px}
  h1 em{font-style:normal;color:#3FE0C5}
  .sub{margin-top:22px;font-size:21px;color:#8A96AD;max-width:640px;line-height:1.5}
  .sub b{color:#E8EDF7}
  .stats{margin-top:auto;display:flex;gap:38px;font-size:15px;color:#8A96AD;letter-spacing:.3px}
  .stats b{color:#3FE0C5;font-family:ui-monospace,monospace;font-weight:600}
</style></head><body>
  <div class="bg"></div><div class="veil"></div>
  <div class="wrap">
    <div class="logo">
      <svg class="mark" viewBox="0 0 96 96" fill="none"><rect x="8" y="8" width="36" height="36" rx="9" fill="#fff" fill-opacity=".05" stroke="#fff" stroke-opacity=".2" stroke-width="3"/><rect x="52" y="8" width="36" height="36" rx="9" fill="#fff" fill-opacity=".05" stroke="#fff" stroke-opacity=".2" stroke-width="3"/><rect x="8" y="52" width="36" height="36" rx="9" fill="#fff" fill-opacity=".05" stroke="#fff" stroke-opacity=".2" stroke-width="3"/><circle cx="70" cy="70" r="26" fill="#3FE0C5" opacity=".2"/><rect x="52" y="52" width="36" height="36" rx="9" fill="#3FE0C5"/><circle cx="70" cy="70" r="5" fill="#052A26"/></svg>
      <span><b>super</b><span>instance</span></span>
    </div>
    <h1>The spreadsheet<br>grew <em>senses.</em></h1>
    <div class="sub">Cells that <b>watch each other, act, learn in public,</b> and book every decision into a receipt chain. Four of those sheets are alive in the showcase.</div>
    <div class="stats">
      <span><b>6</b> living projects</span><span><b>187✓</b> green checks</span>
      <span><b>12</b> engine patches</span><span><b>36/36</b> upstream tests kept</span>
    </div>
  </div>
</body></html>`;

const p1 = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await p1.setContent(ogHtml);
await p1.screenshot({ path: `${IMG}/og-card.png` });
console.log('og-card.png done');

// ---- positioning map PNG (standalone, light-share size) ----
const mapSvg = fs.readFileSync('/home/z/my-project/scripts/superinstance/map.svg', 'utf8');
const mapHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0}
  body{width:1560px;background:#0D1524;font-family:-apple-system,'Segoe UI',Inter,Roboto,Arial,sans-serif;
    padding:56px 64px;box-sizing:border-box;color:#E8EDF7}
  .t{font-size:34px;font-weight:800;letter-spacing:-1px}
  .s{font-size:17px;color:#8A96AD;margin:10px 0 34px}
  .card{background:#0A1120;border:1px solid rgba(255,255,255,.09);border-radius:18px;padding:30px}
  svg{width:100%;height:auto;display:block}
</style></head><body>
  <div class="t">Where SuperInstance sits</div>
  <div class="s">static compute → a living field · humans drive → cells act on their own — scored qualitatively, September 2026</div>
  <div class="card">${mapSvg}</div>
</body></html>`;
const p2 = await browser.newPage({ viewport: { width: 1560, height: 1000 }, deviceScaleFactor: 2 });
await p2.setContent(mapHtml);
await p2.screenshot({ path: `${IMG}/positioning-map.png`, fullPage: true });
console.log('positioning-map.png done');

await browser.close();
