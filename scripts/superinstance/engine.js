/* ============ mini quilt — the reactive engine powering this page ============
   Same semantics as the full runtime, small enough to read in one coffee:
   value cells, formulas with declared dependencies, listeners that fire on
   change (including formulas that recompute mid-cascade), and an event bus
   every console in this page listens to. */
const Bus = {
  fns: new Set(),
  pulses: 0,
  emit(ev) { this.pulses++; for (const f of this.fns) f(ev); },
  on(f) { this.fns.add(f); return () => this.fns.delete(f); }
};
function sameV(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameV(x, b[i]));
  if (typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => sameV(a[k], b[k]));
  }
  return false;
}
class Sheet {
  constructor(name) {
    this.name = name; this.cells = new Map(); this.watchers = [];
    this.depth = 0; this.dead = false; this._changed = new Map();
  }
  cell(id, value, opts = {}) {
    let c = this.cells.get(id);
    if (!c) { c = { id, kind: 'value', deps: [], fn: null, value }; this.cells.set(id, c); }
    else if (c.kind === 'formula') throw new Error(`cell ${id} is a formula`);
    this._set(c, value, !!opts.silent);
    return c;
  }
  def(id, deps, fn) {
    const c = { id, kind: 'formula', deps: deps.slice(), fn, value: undefined, stale: true };
    this.cells.set(id, c);
    this._eval(c);
    return c;
  }
  watch(target, fn) { this.watchers.push({ target, fn }); }
  get(id) {
    const c = this.cells.get(id);
    if (!c) return undefined;
    if (c.kind === 'formula' && c.stale) this._eval(c);
    return c.value;
  }
  _eval(c) {
    c.stale = false;
    let nv;
    try { nv = c.fn(...c.deps.map(d => this.get(d))); }
    catch (e) { nv = { __error: String(e && e.message || e) }; }
    this._set(c, nv, false);
  }
  _set(c, v, silent) {
    if (sameV(c.value, v)) return;
    const old = c.value; c.value = v;
    if (!silent) Bus.emit({ sheet: this.name, id: c.id, kind: c.kind, old, v });
    if (this.dead) return;
    if (this.depth > 60) {
      this.dead = true;
      Bus.emit({ sheet: this.name, id: 'engine', kind: 'error', old: null, v: 'cascade too deep — cycle guard tripped' });
      return;
    }
    if (!this._changed.has(c.id)) this._changed.set(c.id, [old, v]);
    else this._changed.get(c.id)[1] = v;
    this.depth++;
    for (const [, dc] of this.cells)
      if (dc.kind === 'formula' && !dc.stale && dc.deps.includes(c.id)) { dc.stale = true; this._eval(dc); }
    this.depth--;
    if (this.depth === 0 && !this.dead && this._changed.size) {
      const changed = [...this._changed.entries()];
      this._changed.clear();
      for (const [id, [o, v]] of changed)
        for (const w of this.watchers)
          if (w.target === id) {
            try { w.fn(o, v); }
            catch (e) { Bus.emit({ sheet: this.name, id: id + ':watch', kind: 'error', old: null, v: String(e && e.message || e) }); }
          }
    }
  }
}
/* deterministic PRNG so every reload replays honestly */
function mulberry(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
/* console factory — returns a print() for custom lines; engine traffic auto-streams */
function makeLog(el, sheetName, opts = {}) {
  const { max = 24, ignore = [] } = opts;
  const lines = [];
  const ts = () => new Date().toISOString().slice(14, 19);
  const push = (cls, html) => {
    lines.push(`<div class="ln ${cls}"><span class="t">${ts()}</span> ${html}</div>`);
    while (lines.length > max) lines.shift();
    el.innerHTML = lines.join('');
  };
  Bus.on(ev => {
    if (ev.sheet !== sheetName || ignore.includes(ev.id)) return;
    if (ev.kind === 'error') return push('sig', `⚠ <b>${ev.id}</b> ${ev.v}`);
    const v = typeof ev.v === 'object' && ev.v !== null ? (ev.v.__error ? `⚠ ${ev.v.__error}` : compact(ev.v)) : fmtV(ev.v);
    const o = typeof ev.old === 'object' && ev.old !== null ? '' : fmtV(ev.old) + ' → ';
    push('', `<b>${ev.id}</b> ${o}${v}`);
  });
  return (html) => push('', html);
}
function fmtV(v) {
  if (typeof v === 'number') return Math.abs(v) >= 1000 ? v.toFixed(0) : (Math.round(v * 100) / 100).toString();
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v === undefined) return '–';
  if (v === null) return '∅';
  return String(v);
}
function compact(v) {
  if (Array.isArray(v)) return `[${v.length}]`;
  const ks = Object.keys(v);
  return `{${ks.slice(0, 3).join(',')}}${ks.length > 3 ? '…' : ''}`;
}
