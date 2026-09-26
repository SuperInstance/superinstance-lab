// quilt-cortex/glm.mjs — System Two (slow, narrative, expensive) adapter.
// z-ai-web-dev-sdk lives in scripts/quilt-lab/node_modules (bun-installed).
// 429 doctrine: 15/30/45s backoff, then offline degrade — always labeled.

const SDK_PATHS = [
  'z-ai-web-dev-sdk',
  '/home/z/my-project/scripts/quilt-lab/node_modules/z-ai-web-dev-sdk/dist/index.js',
  '/home/z/my-project/scripts/quilt-lab/node_modules/z-ai-web-dev-sdk/dist/index.mjs',
];

let ZAI = null;
async function sdk() {
  if (ZAI) return ZAI;
  for (const p of SDK_PATHS) {
    try { const m = await import(p); ZAI = m.default ?? m; return ZAI; } catch { /* try next */ }
  }
  throw new Error('z-ai-web-dev-sdk not importable from cortex');
}

export async function makeGlm({ live = true, cooldownMs = 2000 } = {}) {
  let lastCall = 0;
  async function chat(messages, { maxTokens = 300, temperature = 0.7 } = {}) {
    const Z = await sdk();
    const client = await Z.create();
    const wait = cooldownMs - (Date.now() - lastCall);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastCall = Date.now();
    for (const backoff of [0, 15000, 30000, 45000]) {
      if (backoff) await new Promise(r => setTimeout(r, backoff));
      try {
        const res = await client.chat.completions.create({
          messages, thinking: { type: 'disabled' }, max_tokens: maxTokens, temperature,
        });
        return { text: res.choices?.[0]?.message?.content ?? '', source: 'live' };
      } catch (e) {
        const msg = String(e);
        if (msg.includes('429') || msg.toLowerCase().includes('rate')) continue;
        throw e;
      }
    }
    return { text: '', source: 'refused' }; // caller degrades — cortex never lies
  }

  return {
    name: 'glm-system-two',
    live,
    async review({ state, distribution, instructions, criteria }) {
      if (!live) return offline({ state, distribution, instructions });
      const distText = Object.entries(distribution)
        .sort((a, b) => b[1] - a[1]).map(([k, p]) => `${k}: ${(p * 100).toFixed(0)}%`).join(', ');
      const optText = Object.entries(criteria || {}).map(([k, v]) => `- ${k}: ${v}`).join('\n');
      try {
        const { text, source } = await chat([
          { role: 'system', content: 'You are the deliberate second opinion in a decision chord. The fast mind already answered; you only speak when it doubted. Answer in <=80 words: pick one option and give one concrete reason.' },
          { role: 'user', content: `SITUATION:\n${state}\n\nOPTIONS:\n${optText}\n\nFAST MIND DISTRIBUTION: ${distText}\nQUESTION: ${instructions}\n\nIf the fast mind's top pick is wrong, name the better option exactly as spelled in OPTIONS, else reaffirm it. End with "PICK: <option>".` },
        ], { maxTokens: 200 });
        const pick = text.match(/PICK:\s*([a-z_]+)/i)?.[1]?.toLowerCase() ?? null;
        if (!pick || !(pick in distribution)) {
          return { choice: null, why: text.slice(0, 160) || '(empty)', source: source === 'refused' ? 'refused' : 'live-unparsed' };
        }
        return { choice: pick, why: text.slice(0, 200), source };
      } catch (e) {
        return { choice: null, why: `glm unavailable: ${String(e).slice(0, 120)}`, source: 'offline-error' };
      }
    },
  };
}

import { fnv1a64 } from './receipts.mjs';
function offline({ state, distribution }) {
  const ranked = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  const h = parseInt(fnv1a64(state).slice(2, 8), 16) % 100;
  const pick = h % 3 === 0 && ranked[1] ? ranked[1][0] : ranked[0][0];
  return { choice: pick, why: `offline reviewer (hash ${h}%3) — labeled stand-in for System Two`, source: 'offline-heuristic' };
}
