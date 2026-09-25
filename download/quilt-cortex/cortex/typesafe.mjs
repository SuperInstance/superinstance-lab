// quilt-cortex/typesafe.mjs — the TypeSafe "System One" client.
//
// Wire protocol (LIVE-VERIFIED 2026-09-25, jev-1.13.0):
//   POST {base}/v1/systemone   Authorization: Bearer <key>
//   body: { model, state, questions: { name: {type, instructions, criteria?} } }
//     type: 'noul' (yes/no, returns continuous p) | 'choice' (criteria dict →
//     distribution) | 'score' (rubric levels → continuous score + per-level p)
//   response: { model, answers: { name: { type, choice|noul|score, confidence?,
//     probabilities? } }, usage: { input_tokens, output_tokens } }
//   ONE call answers N typed questions in a single parallel pass (753ms / 3 q's
//   measured). That is the whole point: System One is a batch primitive.
//
// Vault idioms (mirror arena/moth.mjs): disk cache keyed by payload hash,
// OFF/LIVE namespaces (a synthetic answer must never shadow a real one),
// hard live-call cap, receipt journal, deterministic mock flagged mock:true.
// The user monitors both keys — the cap is a promise, not a suggestion.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fnv1a64 } from './receipts.mjs';

const BASE = (globalThis.__TYPESAFE_BASE__ || 'https://api.typesafe.ai').replace(/\/$/, '');

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class JevVault {
  constructor({ key = null, cachePath = null, ns = 'OFF', cap = 25, journal = [], seed = 20260925 } = {}) {
    this.key = key;
    this.cachePath = cachePath;
    this.ns = ns;                 // 'OFF' | 'LIVE' — never cross the streams
    this.cap = cap;               // hard cap on REAL calls per run
    this.liveUsed = 0;
    this.journal = journal;       // shared receipt list
    this.seed = seed >>> 0;
    this.tokens = { input: 0, output: 0 };
    this.cache = {};
    if (cachePath && existsSync(cachePath)) {
      try { this.cache = JSON.parse(readFileSync(cachePath, 'utf8')); } catch { this.cache = {}; }
    }
  }

  persist() {
    if (!this.cachePath) return;
    mkdirSync(dirname(this.cachePath), { recursive: true });
    writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 1));
  }

  hashOf(state, questions, model) {
    return fnv1a64([this.ns, model, state, questions]).slice(2, 14); // b62 compact
  }

  // ---- deterministic mock (the OFF voice) ----------------------------------
  // Hash-seeded distributions with a light keyword prior so offline tests get
  // *stable, inspectable* judgments. Always flagged mock:true. Never cached
  // under a LIVE tag (namespace separation).
  mockAnswers(state, questions) {
    const answers = {};
    for (const [name, q] of Object.entries(questions)) {
      const rng = mulberry32(this.seed ^ parseInt(fnv1a64([name, q.instructions, state]).slice(2, 10), 16));
      if (q.type === 'choice') {
        const keys = Object.keys(q.criteria || { a: 'a', b: 'b' });
        const raw = keys.map(() => 0.15 + rng() * 0.7);
        const sum = raw.reduce((a, b) => a + b, 0);
        const probabilities = {};
        keys.forEach((k, i) => { probabilities[k] = +(raw[i] / sum).toFixed(4); });
        const choice = keys.reduce((a, b) => (probabilities[a] >= probabilities[b] ? a : b));
        answers[name] = { type: 'choice', choice, confidence: probabilities[choice], probabilities };
      } else if (q.type === 'score') {
        const levels = q.criteria || ['low', 'medium', 'high'];
        const n = levels.length;
        const pick = Math.min(n - 1, Math.floor(rng() * n));
        const probabilities = {};
        for (let i = 0; i < n; i++) probabilities[String(i)] = i === pick ? 0.4 + rng() * 0.2 : 0.6 * rng() / Math.max(1, n - 1);
        const s = Object.values(probabilities).reduce((a, b) => a + b, 0);
        for (const k of Object.keys(probabilities)) probabilities[k] = +(probabilities[k] / s).toFixed(4);
        answers[name] = { type: 'score', score: pick, confidence: probabilities[String(pick)], probabilities };
      } else {
        answers[name] = { type: 'noul', noul: +(0.05 + rng() * 0.9).toFixed(4) };
      }
    }
    return answers;
  }

  // ---- the one-pass batch decision -----------------------------------------
  async decide(state, questions, { model = 'jev-latest', tag = null, force = false } = {}) {
    if (!state || typeof state !== 'string') throw new Error('jev.decide: state must be a string');
    const names = Object.keys(questions || {});
    if (!names.length) throw new Error('jev.decide: questions map is empty');
    const h = this.hashOf(state, questions, model);
    if (!force && this.cache[h]) {
      const hit = this.cache[h];
      this.journal.push({ kind: 'jev', tag, h, source: 'cache', mock: hit.__mock, q: names.length });
      return { answers: hit.answers, usage: hit.usage || { input_tokens: 0, output_tokens: 0 }, model: hit.model, source: 'cache', mock: hit.__mock };
    }
    let answers = null, usage = null, modelGot = model, source = 'mock', mock = true;
    if (this.key && this.ns === 'LIVE' && this.liveUsed < this.cap) {
      try {
        const body = {
          model,
          state,
          questions: Object.fromEntries(names.map(n => {
            const q = questions[n];
            const qq = { type: String(q.type || 'noul').toLowerCase(), instructions: q.instructions || q.question || '' };
            if (qq.type === 'choice') qq.criteria = q.criteria || q.options || {};
            if (qq.type === 'score') qq.criteria = q.criteria || q.rubric || ['low', 'medium', 'high'];
            return [n, qq];
          })),
        };
        const res = await fetch(`${BASE}/v1/systemone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` },
          body: JSON.stringify(body),
        });
        if (res.status === 429) {
          for (const wait of [15000, 30000, 45000]) {
            await new Promise(r => setTimeout(r, wait));
            const r2 = await fetch(`${BASE}/v1/systemone`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` },
              body: JSON.stringify(body),
            });
            if (r2.ok) { res = r2; break; }
            if (r2.status !== 429) { res = r2; break; }
          }
        }
        if (res.ok) {
          const payload = await res.json();
          answers = payload.answers || {};
          usage = payload.usage || { input_tokens: 0, output_tokens: 0 };
          modelGot = payload.model || model;
          source = 'live'; mock = false; this.liveUsed++;
          this.tokens.input += usage.input_tokens || 0;
          this.tokens.output += usage.output_tokens || 0;
        } else {
          const errText = await res.text().catch(() => '');
          this.journal.push({ kind: 'jev_error', tag, status: res.status, why: errText.slice(0, 200) });
        }
      } catch (e) {
        this.journal.push({ kind: 'jev_error', tag, why: String(e).slice(0, 200) });
      }
    } else if (this.key && this.ns === 'LIVE' && this.liveUsed >= this.cap) {
      this.journal.push({ kind: 'jev_budget', tag, cap: this.cap });
    }
    if (!answers) {
      answers = this.mockAnswers(state, questions);
      source = 'mock';
    }
    this.cache[h] = { answers, usage, model: modelGot, __mock: mock, __ns: this.ns, at: new Date().toISOString() };
    this.journal.push({ kind: 'jev', tag, h, source, mock, q: names.length, tokens: usage });
    return { answers, usage: usage || { input_tokens: 0, output_tokens: 0 }, model: modelGot, source, mock };
  }

  // ---- the AIEngineLike bridge (quilt ai cells speak jev) -------------------
  // Cell surface (patch-8 passthrough carries strings/arrays/numbers):
  //   { kind:'ai', ai_kind:'jev.batch',  state:'...', questions_json:'{...}', tag:'...' }
  //   { kind:'ai', ai_kind:'jev.choice', state:'...', instructions:'...', options_json:'{...}' }
  //   { kind:'ai', ai_kind:'jev.score',  state:'...', instructions:'...', rubric:['a','b'] }
  //   { kind:'ai', ai_kind:'jev.noul',   state:'...', instructions:'...' }
  // Batch returns the full answers map (N decisions, one call). Sugar returns
  // the single answer object.
  makeEngine() {
    const vault = this;
    return {
      name: `jev-engine(${vault.ns})`,
      async call(config) {
        const state = String(config.prompt || config.state || config.input || '');
        const tag = config.tag || null;
        let questions;
        if (config.ai_kind === 'jev.batch' || config.questions_json) {
          questions = typeof config.questions_json === 'string' ? JSON.parse(config.questions_json) : config.questions_json;
        } else if (config.ai_kind === 'jev.choice') {
          const criteria = typeof config.options_json === 'string' ? JSON.parse(config.options_json) : (config.options_json || config.criteria || {});
          questions = { q: { type: 'choice', instructions: config.instructions || config.system || '', criteria } };
        } else if (config.ai_kind === 'jev.score') {
          const rubric = typeof config.rubric === 'string' ? JSON.parse(config.rubric) : (config.rubric || ['low', 'medium', 'high']);
          questions = { q: { type: 'score', instructions: config.instructions || config.system || '', criteria: rubric } };
        } else if (config.ai_kind === 'jev.noul') {
          questions = { q: { type: 'noul', instructions: config.instructions || config.system || '' } };
        } else {
          throw new Error(`jev-engine: unsupported ai_kind ${config.ai_kind}`);
        }
        const { answers } = await vault.decide(state, questions, { model: config.model || 'jev-latest', tag });
        if (config.ai_kind === 'jev.batch') return answers;
        return answers.q;
      },
    };
  }
}

// ---- calibration delta ------------------------------------------------------
// The novel teaching signal: the agent holds its own distribution (from its
// weight cells); jev returns a calibrated one. The DELTA is the gradient the
// sheet can actually feel — per option, jev_p - own_p. Mean |delta| is the
// agent's calibration error; sign tells it which way to push weights.
export function calibrationDelta(ownDist, jevDist) {
  const keys = new Set([...Object.keys(ownDist || {}), ...Object.keys(jevDist || {})]);
  const delta = {};
  for (const k of keys) delta[k] = +(((jevDist[k] || 0) - (ownDist[k] || 0)).toFixed(4));
  const mae = Object.values(delta).reduce((a, b) => a + Math.abs(b), 0) / Math.max(1, keys.size);
  return { delta, mae: +mae.toFixed(4) };
}
