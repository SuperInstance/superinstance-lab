// wave-63 probe fix: typesafe systemone + moth api/v1 + groq retry
import fs from 'node:fs';
const env = Object.fromEntries(
  fs.readFileSync('/home/z/my-project/.env.keys', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const out = [];
const rec = (n, ok, d) => out.push(`${n}\t${ok ? 'OK' : 'FAIL'}\t${d}`);
const H = k => ({ Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });

// typesafe systemone (canonical shape from lode engine)
try {
  const t0 = Date.now();
  const r = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST', headers: H(env.TYPESAFE_API_KEY),
    body: JSON.stringify({ model: 'jev-latest', state: 'probe wave63 channel-health', questions: [{ id: 'q1', text: 'Reply with the single word OK.' }] })
  });
  const v = await r.json().catch(() => ({}));
  rec('typesafe', r.ok, `${Date.now() - t0}ms HTTP ${r.status} model=${v.model || '?'} usage=${v.usage ? JSON.stringify(v.usage).slice(0, 80) : '?'}`);
} catch (e) { rec('typesafe', false, String(e).slice(0, 140)); }

// moth comet job via /api/v1 (shape from moth-seal.mjs)
let jobId = null;
try {
  const t0 = Date.now();
  const r = await fetch('https://api.mothquantum.com/api/v1/jobs', {
    method: 'POST', headers: H(env.MOTHQUANTUM_API_KEY),
    body: JSON.stringify({ params: { type: 'comet', bits: 256 } })
  });
  const v = await r.json().catch(() => ({}));
  jobId = v.id || v.job_id || null;
  rec('moth-submit', r.ok, `${Date.now() - t0}ms HTTP ${r.status} job=${jobId} keys=${Object.keys(v).slice(0, 6).join(',')}`);
} catch (e) { rec('moth-submit', false, String(e).slice(0, 140)); }
if (jobId) {
  for (let i = 0; i < 6; i++) {
    await new Promise(s => setTimeout(s, 3000));
    try {
      const r = await fetch(`https://api.mothquantum.com/api/v1/jobs/${jobId}/status`, { headers: H(env.MOTHQUANTUM_API_KEY) });
      const v = await r.json().catch(() => ({}));
      rec('moth-poll', r.ok, `HTTP ${r.status} status=${v.status || JSON.stringify(v).slice(0, 100)}`);
      if (['completed', 'done', 'complete', 'error', 'failed'].includes(String(v.status))) break;
    } catch (e) { rec('moth-poll', false, String(e).slice(0, 140)); break; }
  }
}

// groq retry with chat completion
try {
  const t0 = Date.now();
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: H(env.GROQ_API_KEY),
    body: JSON.stringify({ model: 'openai/gpt-oss-20b', messages: [{ role: 'user', content: 'reply OK' }], max_tokens: 8 })
  });
  const v = await r.json().catch(() => ({}));
  rec('groq-chat', r.ok, `${Date.now() - t0}ms HTTP ${r.status} ${r.ok ? 'choice=' + (v.choices?.[0]?.message?.content || '').slice(0, 20) : JSON.stringify(v).slice(0, 120)}`);
} catch (e) { rec('groq-chat', false, String(e).slice(0, 140)); }

fs.appendFileSync('/home/z/my-project/scripts/probe63.log', out.join('\n') + '\n');
console.log(out.join('\n'));
