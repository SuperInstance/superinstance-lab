// wave-63 endpoint health probe — 8 channels, minimal spend, receipts to stdout.
// Token discipline: keys loaded from /home/z/my-project/.env.keys (chmod 600, gitignored).
// Every result printed as NAME\tOK/FAIL\tDETAIL (never echoes a key).
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('/home/z/my-project/.env.keys', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);

const out = [];
function rec(name, ok, detail) { out.push(`${name}\t${ok ? 'OK' : 'FAIL'}\t${detail}`); }

async function j(name, url, opts, pick) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, opts);
    const ms = Date.now() - t0;
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      rec(name, false, `HTTP ${r.status} in ${ms}ms ${body.slice(0, 160).replace(/\s+/g, ' ')}`);
      return null;
    }
    const v = await r.json().catch(() => ({}));
    rec(name, true, `${ms}ms ${pick ? pick(v) : ''}`.trim());
    return v;
  } catch (e) {
    rec(name, false, `${Date.now() - t0}ms ${String(e).slice(0, 160)}`);
    return null;
  }
}

const H = k => ({ Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });

// 1. GitHub
await j('github', 'https://api.github.com/user', {
  headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'quilt-fleet-w63' }
}, v => `login=${v.login}`);

// 2. typesafe.ai — 1-token battery call (priormaker jev-1.13.0 shape from fleet lanes)
await j('typesafe', 'https://api.typesafe.ai/v1/chat/completions', {
  method: 'POST', headers: H(env.TYPESAFE_API_KEY),
  body: JSON.stringify({ model: 'jev-1.13.0', messages: [{ role: 'user', content: 'reply OK' }], max_tokens: 8 })
}, v => `model=${v.model || '?'} usage=${v.usage ? (v.usage.prompt_tokens + '+' + v.usage.completion_tokens) : '?'}`);

// 3. DeepSeek (NEW key)
await j('deepseek', 'https://api.deepseek.com/models', { headers: H(env.DEEPSEEK_API_KEY) },
  v => `models=${(v.data || []).map(m => m.id).slice(0, 6).join(',')}`);

// 4. deepinfra
await j('deepinfra', 'https://api.deepinfra.com/v1/openai/models', { headers: H(env.DEEPINFRA_API_KEY) },
  v => `n=${(v.data || []).length}`);

// 5. Groq
await j('groq', 'https://api.groq.com/openai/v1/models', { headers: H(env.GROQ_API_KEY) },
  v => `n=${(v.data || []).length}`);

// 6. Kimi (allegro plan; platform.kimi.ai docs — try moonshot endpoint)
const kim = await j('kimi-moonshot', 'https://api.moonshot.ai/v1/models', { headers: H(env.KIMI_API_KEY) },
  v => `n=${(v.data || []).length}`);
if (!kim) await j('kimi-alt', 'https://api.kimi.com/v1/models', { headers: H(env.KIMI_API_KEY) }, v => `n=${(v.data || []).length}`);

// 7. mothquantum — comet QRNG channel-health job (the registered wave-63 probe)
const mq = await j('mothquantum-submit', 'https://api.mothquantum.com/v1/jobs', {
  method: 'POST', headers: H(env.MOTHQUANTUM_API_KEY),
  body: JSON.stringify({ type: 'comet', bits: 256 })
}, v => `job=${v.id || v.job_id || '?'}`);
if (mq) {
  const id = mq.id || mq.job_id;
  if (id) await j('mothquantum-poll', `https://api.mothquantum.com/v1/jobs/${id}`, { headers: H(env.MOTHQUANTUM_API_KEY) },
    v => `status=${v.status || '?'}`);
}

// 8. Cloudflare
await j('cloudflare', 'https://api.cloudflare.com/client/v4/user/tokens/verify', {
  headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` }
}, v => `status=${v.result && v.result.status}`);

fs.writeFileSync('/home/z/my-project/scripts/probe63.log', out.join('\n') + '\n');
console.log(out.join('\n'));
