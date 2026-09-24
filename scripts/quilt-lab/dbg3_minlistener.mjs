// dbg3 — minimal listener repro variants
import { QuiltEngine } from '/home/z/my-project/quilt-playtest/packages/core/dist/index.js';

// A: sensor + listener (push) — like P3
const a = new QuiltEngine('a', { eager: true });
a.loadSheet({ id: 'a', cells: [
  { id: 's', kind: 'sensor', default: 1 },
  { id: 'L', kind: 'listener', watch: ['s'], action: 'act' },
  { id: 'act', kind: 'program', code: `return { ran: true, input };` },
]});
await a.push('s', 50);
console.log('A sensor+listener:', JSON.stringify(a.getCell('act').value.data));

// B: same but listener id is dotted lowercase like ewma.updater
const b = new QuiltEngine('b', { eager: true });
b.loadSheet({ id: 'b', cells: [
  { id: 's', kind: 'sensor', default: 1 },
  { id: 'ewma.updater', kind: 'listener', watch: ['s'], action: 'ewma.update' },
  { id: 'ewma.update', kind: 'program', code: `return { ran: true, input };` },
]});
await b.push('s', 50);
console.log('B dotted ids      :', JSON.stringify(b.getCell('ewma.update').value.data));

// C: listener defined BEFORE the program it calls (order in anomaly sheet: updater, then update)
const c = new QuiltEngine('c', { eager: true });
c.loadSheet({ id: 'c', cells: [
  { id: 's', kind: 'sensor', default: 1 },
  { id: 'ewma.updater', kind: 'listener', watch: ['s'], action: 'ewma.update' },
  { id: 'ewma.update', kind: 'program', code: `globalThis.__ran = (globalThis.__ran||0)+1; return { ran: globalThis.__ran };` },
]});
console.log('C pre-check deps  :', [...c.getCell('ewma.updater').dependencies], 'kind:', c.getCell('ewma.updater').def.kind);
await c.push('s', 50);
console.log('C order variant   :', JSON.stringify(c.getCell('ewma.update').value.data));

// D: listener with deps: declared like the workaround (bypassing my patch)
const d = new QuiltEngine('d', { eager: true });
d.loadSheet({ id: 'd', cells: [
  { id: 's', kind: 'sensor', default: 1 },
  { id: 'L', kind: 'listener', watch: ['s'], deps: ['s'], action: 'act' },
  { id: 'act', kind: 'program', code: `return { ran: true };` },
]});
await d.push('s', 50);
console.log('D explicit deps   :', JSON.stringify(d.getCell('act').value.data));
