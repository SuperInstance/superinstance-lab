// wave-63 probe c: canonical shapes. Doubles as the REGISTERED wave-63 moth
// channel-health probe (per wave-62 close receipt) + typesafe battery sanity.
import fs from 'node:fs';
const env = Object.fromEntries(
  fs.readFileSync('/home/z/my-project/.env.keys', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')) , l.slice(l.indexOf('=') + 1)])
);
const out = [];
const rec = (n, ok, d) => out.push(`${n}\t${ok ? 'OK' : 'FAIL'}\t${d}`);
const H = k => ({ Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' });

// typesafe systemone — questions as OBJECT (probe_tokens.mjs shape)
try {
  const t0 = Date.now();
  const r = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST', headers: H(env.TYPESAFE_API_KEY),
    body: JSON.stringify({
      model: 'jev-latest',
      state: { battery: 'wave63-channel-health-probe', topic: 'one-line sanity state; full corpus follows in engine runs' },
      questions: {
        p_ok: { type: 'noul', instructions: 'p = probability that the fleet API channels are healthy enough for wave-63 lanes to proceed without channel-outage aborts in the next 6 hours.' }
      }
    })
  });
  const v = await r.json().catch(() => ({}));
  rec('typesafe', r.ok, `${Date.now() - t0}ms HTTP ${r.status} model=${v.model || '?'} usage=${JSON.stringify(v.usage || {}).slice(0, 90)} answers=${v.answers ? Object.keys(v.answers).join(',') : '?'}`);
} catch (e) { rec('typesafe', false, String(e).slice(0, 140)); }

// moth comet via /engines/comet-qrng-v1/process — THE registered channel-health probe
try {
  const t0 = Date.now();
  const params = { mode: 'emu', num_qubits: 12, shots: 4096, output_bytes: 512, include_raw_counts: true, bell_witness: true };
  const r = await fetch('https://api.mothquantum.com/api/v1/engines/comet-qrng-v1/process', {
    method: 'POST', headers: H(env.MOTHQUANTUM_API_KEY),
    body: JSON.stringify({ params })
  });
  const v = await r.json().catch(() => ({}));
  const jobId = v.id || v.job_id || null;
  rec('moth-submit', r.ok || r.status === 202, `${Date.now() - t0}ms HTTP ${r.status} job=${jobId}`);
  fs.writeFileSync('/home/z/my-project/scripts/probe63_moth_job.json', JSON.stringify({ jobId, http: r.status, body: v }, null, 2));
} catch (e) { rec('moth-submit', false, String(e).slice(0, 140)); }

fs.appendFileSync('/home/z/my-project/scripts/probe63.log', out.join('\n') + '\n');
console.log(out.join('\n'));
