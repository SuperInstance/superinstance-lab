// build.mjs — assemble the single-file SuperInstance showcase
// run: node /home/z/my-project/scripts/superinstance/build.mjs
import fs from 'fs';
import path from 'path';

const SRC = '/home/z/my-project/scripts/superinstance';
const IMG = '/home/z/my-project/download/superinstance/images';
const OUT = '/home/z/my-project/download/superinstance/index.html';

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(path.join(IMG, f)).toString('base64');

let css = read('css.css');
let body = read('body.html');
const engine = read('engine.js');
const demos1 = read('demos1.js');
const demos2 = read('demos2.js');
const chrome = read('chrome.js');

// embed the quilt art into the ecosystem banner + hero backdrop
body = body.replace('@@QUILT_ART@@', b64('quilt-art.png'));
body = body.replace('<header id="top">', '<header id="top" style="background-image:url(' + b64('hero-art.png') + ');background-size:cover;background-position:center 30%">');

const favicon = 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync('/home/z/my-project/download/superinstance/brand/favicon.svg', 'utf8'));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:title" content="SuperInstance — cells that watch back">
<meta property="og:description" content="A reactive cell runtime where cells watch each other, act on what they see, learn in public, and book every decision into a receipt chain.">
<title>SuperInstance — cells that watch back</title>
<link rel="icon" href="${favicon}">
<style>
${css}
header::before{content:'';position:absolute;inset:0;z-index:1;pointer-events:none;
  background:linear-gradient(rgba(7,11,20,.42),rgba(7,11,20,.86) 62%,var(--ink))}
</style>
</head>
<body>
${body}
<script>
${engine}
</script>
<script>
${demos1}
</script>
<script>
${demos2}
</script>
<script>
${chrome}
</script>
</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log(`built ${OUT} (${(html.length / 1024).toFixed(0)}KB)`);
