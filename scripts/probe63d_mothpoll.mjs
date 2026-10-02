// poll moth channel-health job to completion
import fs from 'node:fs';
const env = Object.fromEntries(
  fs.readFileSync('/home/z/my-project/.env.keys', 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const { jobId } = JSON.parse(fs.readFileSync('/home/z/my-project/scripts/probe63_moth_job.json', 'utf8'));
if (!jobId) { console.log('NO JOB ID'); process.exit(1); }
for (let i = 0; i < 20; i++) {
  await new Promise(s => setTimeout(s, 5000));
  try {
    const r = await fetch(`https://api.mothquantum.com/api/v1/jobs/${jobId}/status`, { headers: { Authorization: `Bearer ${env.MOTHQUANTUM_API_KEY}` } });
    const v = await r.json().catch(() => ({}));
    const st = v.status || JSON.stringify(v).slice(0, 120);
    console.log(`poll#${i} HTTP ${r.status} status=${st}`);
    if (['completed', 'COMPLETE', 'done', 'success', 'error', 'failed', 'FAILED'].includes(String(st))) {
      if (['completed', 'COMPLETE', 'done', 'success'].includes(String(st))) {
        const r2 = await fetch(`https://api.mothquantum.com/api/v1/jobs/${jobId}/result`, { headers: { Authorization: `Bearer ${env.MOTHQUANTUM_API_KEY}` } });
        const v2 = await r2.json().catch(() => ({}));
        fs.writeFileSync('/home/z/my-project/scripts/probe63_moth_result.json', JSON.stringify(v2, null, 2));
        const kb = v2 && v2.result ? JSON.stringify(v2.result).length : 0;
        console.log(`RESULT FETCHED HTTP ${r2.status} bytes=${kb} topKeys=${Object.keys(v2).slice(0, 10).join(',')}`);
        const cert = v2.cert || v2.certification || null;
        console.log(`cert=${cert ? 'PRESENT' : 'ABSENT'} ${cert && cert.entropy_report ? 'entropy_report=YES' : ''}`);
      }
      break;
    }
  } catch (e) { console.log(`poll#${i} ERR ${String(e).slice(0, 120)}`); }
}
