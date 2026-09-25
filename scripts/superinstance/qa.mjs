// qa.mjs — playtest the showcase: console errors, interactions, screenshots
import { createRequire } from 'module';
const require = createRequire('/home/z/my-project/');
const { chromium } = require('playwright');

const URL = 'file:///home/z/my-project/download/superinstance/index.html';
const SHOTS = '/home/z/my-project/download/superinstance/images';
const errors = [];
let step = '';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
page.on('console', m => { if (m.type() === 'error') errors.push(`[${step}] console: ${m.text()}`); });
page.on('pageerror', e => errors.push(`[${step}] pageerror: ${e.message}`));

await page.goto(URL); step = 'load';
await page.waitForTimeout(2600);
await page.screenshot({ path: `${SHOTS}/qa-hero.png` });

// hero canvas is animating?
step = 'hero';
const heroPix = await page.evaluate(() => {
  const c = document.getElementById('heroFx');
  const d1 = c.getContext('2d').getImageData(0, 0, c.width, c.height).data.slice(0, 4000).join(',');
  return d1;
});
await page.waitForTimeout(700);
const heroPix2 = await page.evaluate(() => {
  const c = document.getElementById('heroFx');
  return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.slice(0, 4000).join(',');
});
console.log('hero canvas animating:', heroPix !== heroPix2 ? 'YES' : 'NO');

// OCEAN
step = 'ocean';
await page.locator('#p-ocean').scrollIntoViewIfNeeded();
await page.waitForTimeout(1800);
await page.click('#oceanDrop');
await page.waitForTimeout(900);
const oceanLines = await page.locator('#oceanLog .ln').count();
const oceanGauge = await page.textContent('#oceanGauge');
console.log('ocean log lines:', oceanLines, '| gauge:', oceanGauge.trim());
await page.locator('#p-ocean').screenshot({ path: `${SHOTS}/demo-ocean.png` });

// REVERSI — must self-play
step = 'reversi';
await page.locator('#p-reversi').scrollIntoViewIfNeeded();
await page.waitForTimeout(5000);
const revLines = await page.locator('#revLog .ln').count();
const scoreB = await page.textContent('#revScoreB');
const discs = await page.locator('#reversiBoard .disc').count();
console.log('reversi log lines:', revLines, '| TIDE score:', scoreB, '| discs on board:', discs);
await page.locator('#p-reversi').screenshot({ path: `${SHOTS}/demo-reversi.png` });

// DESK — bars must flow, entries need confirmation + quantum
step = 'desk';
await page.locator('#p-desk').scrollIntoViewIfNeeded();
await page.waitForTimeout(9000);
const deskLines = await page.locator('#deskLog .ln').count();
const kEq = await page.textContent('#kEq');
const trades = await page.textContent('#kTrades');
const moth = await page.textContent('#mothUsed');
const pos = await page.textContent('#deskPos');
console.log('desk log lines:', deskLines, '| equity:', kEq, '| trades:', trades, '| moth:', moth, '| position:', pos.trim());
await page.locator('#p-desk').screenshot({ path: `${SHOTS}/demo-desk.png` });

// HOLDEM — advance streets, fade the cards
step = 'holdem';
await page.locator('#p-holdem').scrollIntoViewIfNeeded();
console.log('heNext count:', await page.locator('#heNext').count());
for (let k = 0; k < 4; k++) {
  await page.click('#heNext');
  await page.waitForTimeout(350);
  const st = await page.textContent('#streetTag');
  const dis = await page.locator('#heNext').isDisabled();
  const obs = await page.textContent('#shObs');
  const heL = await page.locator('#heLog .ln').count();
  console.log(`click ${k + 1}: street=${st} disabled=${dis} obs=${obs} heLog=${heL}`);
  if (dis) break;
}
const readText = await page.textContent('#readBox');
const shapeObs = await page.textContent('#shObs');
await page.locator('#focusSlider').evaluate(el => { el.value = 8; el.dispatchEvent(new Event('input')); });
await page.waitForTimeout(600);
const holeOpacity = await page.locator('#holeA').evaluate(el => getComputedStyle(el).opacity);
console.log('holdem observations:', shapeObs, '| hole opacity after fade:', holeOpacity);
console.log('read:', readText.slice(0, 120));
await page.locator('#p-holdem').screenshot({ path: `${SHOTS}/demo-holdem.png` });
await page.click('#heAuto'); // leave auto running
step = 'rest';
await page.locator('#landscape').scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await page.locator('#landscape').screenshot({ path: `${SHOTS}/qa-landscape.png` });
await page.locator('#ecosystem').scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await page.locator('#ecosystem').screenshot({ path: `${SHOTS}/qa-ecosystem.png` });
await page.locator('#manifesto').scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await page.locator('#manifesto').screenshot({ path: `${SHOTS}/qa-manifesto.png` });

// full page (tall) — disable animations for stability
await page.evaluate(() => document.querySelectorAll('.reveal').forEach(el => el.classList.add('in')));
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOTS}/qa-fullpage.png`, fullPage: true });

console.log('\n==== RESULT ====');
if (errors.length) { console.log('ERRORS:'); errors.forEach(e => console.log(' -', e)); }
else console.log('ZERO console/page errors');
await browser.close();
