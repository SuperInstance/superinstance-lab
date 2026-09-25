// gen_art.mjs — SuperInstance brand art via z-ai image generation
// run: cd /home/z/my-project/scripts/quilt-lab && node ../superinstance/gen_art.mjs
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const OUT = '/home/z/my-project/download/superinstance/images';
fs.mkdirSync(OUT, { recursive: true });

const JOBS = [
  {
    name: 'hero-art.png',
    size: '1440x720',
    prompt:
      'Dark deep-navy night ocean rendered as a vast grid of glowing geometric cells, ' +
      'bioluminescent aqua tide lines flowing between the cells like circuit traces, ' +
      'a few scattered coral-orange pulse points where cells light up, one soft violet shimmer region in the distance, ' +
      'cinematic ultra-wide composition, elegant minimal digital art, subtle film grain, high quality, detailed',
  },
  {
    name: 'quilt-art.png',
    size: '1344x768',
    prompt:
      'A quilt of nine softly glowing interface patches floating above a dark night ocean, ' +
      'each patch a tiny living dashboard of grid cells with aqua and warm amber highlights, ' +
      'threads of aqua light stitching the patches together like seams, deep navy background, ' +
      'elegant minimal digital art, cinematic lighting, high quality, detailed',
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gen(zai, job, attempt = 1) {
  try {
    const res = await zai.images.generations.create({ prompt: job.prompt, size: job.size });
    const b64 = res?.data?.[0]?.base64;
    if (!b64) throw new Error('no base64 in response');
    const buf = Buffer.from(b64, 'base64');
    fs.writeFileSync(`${OUT}/${job.name}`, buf);
    console.log(`ok ${job.name} ${(buf.length / 1024).toFixed(0)}KB`);
  } catch (e) {
    console.error(`attempt ${attempt} failed for ${job.name}: ${e.message}`);
    if (attempt < 3) {
      await sleep(attempt * 5000);
      return gen(zai, job, attempt + 1);
    }
    console.error(`GIVING UP on ${job.name}`);
  }
}

const zai = await ZAI.create();
for (const job of JOBS) {
  await gen(zai, job);
  await sleep(2000);
}
