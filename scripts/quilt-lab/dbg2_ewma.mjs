// dbg2 — instrument the sensor-anomaly EWMA loop
import { QuiltEngine, parseSheet } from '/home/z/my-project/quilt-playtest/packages/core/dist/index.js';
import { readFileSync } from 'node:fs';

const sheet = parseSheet(readFileSync('/home/z/my-project/quilt-playtest/examples/sensor-anomaly/sheet.yaml', 'utf8'));
const e = new QuiltEngine(sheet.id, { eager: true, tracing: true });
e.loadSheet(sheet);

// spy on every subscription
for (const id of ['sensor.temp', 'ewma.value', 'ewma.update', 'surprise.z_score', 'surprise.should_escalate', 'alert.emit']) {
  e.subscribe(id, (v, prev) => console.log(`[sub] ${id}: ${JSON.stringify(prev.data)} -> ${JSON.stringify(v.data)} (${v.status})`));
}

console.log('--- push 20 ---');
await e.push('sensor.temp', 20);
console.log('ewma.value after:', (await e.get('ewma.value')).data);
console.log('ewma.update cell status:', e.getCell('ewma.update').value.status, 'err:', JSON.stringify(e.getCell('ewma.update').value.error ?? null));
console.log('ewma.updater cell deps:', [...e.getCell('ewma.updater').dependencies], 'dependents-of-sensor.temp:', [...e.getCell('sensor.temp').dependents]);
console.log('traces:', e.getTraces().map(t => t.cellId));
