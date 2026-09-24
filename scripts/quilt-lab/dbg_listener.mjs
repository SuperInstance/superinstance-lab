import { QuiltEngine } from '/home/z/my-project/quilt-playtest/packages/core/dist/index.js';

const e = new QuiltEngine('dbg');
e.loadSheet({ id: 'dbg', cells: [
  { id: 's', kind: 'sensor', default: 1 },
  { id: 'alert', kind: 'listener', watch: ['s'], condition: 'caller.metadata.current > 10', action: 'action' },
  { id: 'action', kind: 'program', code: `return { fired: !!input, changed: input?.changed ?? null };` },
]});

console.log('before push, action cell:', e.getCell('action').value);
await e.push('s', 50);
console.log('after push, sensor value:', JSON.stringify(e.getCell('s').value.data));
console.log('after push, action value :', JSON.stringify(e.getCell('action').value));
const v = await e.get('action');
console.log('get(action)              :', JSON.stringify(v.data), v.status);

// variant: no condition at all
const e2 = new QuiltEngine('dbg2');
e2.loadSheet({ id: 'dbg2', cells: [
  { id: 's', kind: 'sensor', default: 1 },
  { id: 'alert', kind: 'listener', watch: ['s'], action: 'action' },
  { id: 'action', kind: 'program', code: `return { fired: !!input, changed: input?.changed ?? null };` },
]});
await e2.push('s', 50);
console.log('\nno-condition variant, action value:', JSON.stringify(e2.getCell('action').value));

// variant: watch a plain VALUE cell, use engine.set
const e3 = new QuiltEngine('dbg3');
e3.loadSheet({ id: 'dbg3', cells: [
  { id: 'v', kind: 'value', value: 1 },
  { id: 'alert', kind: 'listener', watch: ['v'], action: 'action' },
  { id: 'action', kind: 'program', code: `return { fired: !!input, changed: input?.changed ?? null };` },
]});
await e3.set('v', 50);
console.log('set-on-value variant, action value:', JSON.stringify(e3.getCell('action').value));

// variant: THE WORKAROUND — declare deps: [watched] alongside watch:
const e4 = new QuiltEngine('dbg4');
e4.loadSheet({ id: 'dbg4', cells: [
  { id: 'v', kind: 'value', value: 1 },
  { id: 'alert', kind: 'listener', watch: ['v'], deps: ['v'], condition: 'caller.metadata.current > 10', action: 'action' },
  { id: 'action', kind: 'program', code: `return { fired: !!input, changed: input?.changed ?? null };` },
]});
await e4.set('v', 50);
console.log('WORKAROUND (deps: [watched]) variant:', JSON.stringify(e4.getCell('action').value));
