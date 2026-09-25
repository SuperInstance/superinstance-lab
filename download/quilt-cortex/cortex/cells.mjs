// quilt-cortex/cells.mjs — jev-flavored quilt cells.
// Sugar that emits ai-cell definitions the vendored engine + patch-8 will
// pass through to the JevEngine bridge (makeEngine in typesafe.mjs).
// Rule to remember: patch-8 forwards primitives and arrays of primitives —
// objects ride as JSON strings (questions_json / options_json / rubric_json).

export function jevChoiceCell({ id, state, instructions, criteria, watch = [], tag = null }) {
  return {
    id, kind: 'ai', ai_kind: 'jev.choice',
    prompt: state, instructions, options_json: JSON.stringify(criteria),
    ...(tag ? { tag } : {}), ...(watch.length ? { watch } : {}),
  };
}

export function jevScoreCell({ id, state, instructions, rubric, watch = [], tag = null }) {
  return {
    id, kind: 'ai', ai_kind: 'jev.score',
    prompt: state, instructions, rubric,
    ...(tag ? { tag } : {}), ...(watch.length ? { watch } : {}),
  };
}

export function jevNoulCell({ id, state, instructions, watch = [], tag = null }) {
  return {
    id, kind: 'ai', ai_kind: 'jev.noul',
    prompt: state, instructions,
    ...(tag ? { tag } : {}), ...(watch.length ? { watch } : {}),
  };
}

// The one-pass decision surface: ONE cell = N typed questions = ONE call.
export function jevBatchCell({ id, state, questions, watch = [], tag = null }) {
  return {
    id, kind: 'ai', ai_kind: 'jev.batch',
    prompt: state, questions_json: JSON.stringify(questions),
    ...(tag ? { tag } : {}), ...(watch.length ? { watch } : {}),
  };
}

// Wire the bridge into a QuiltEngine: engine options.ai becomes the jev
// engine (or a router that delegates jev.* kinds to jev and others to a
// fallback engine — used when a sheet mixes GLM and Jev cells).
export function jevAIRouter(jevEngine, fallbackEngine) {
  return {
    name: 'jev-router',
    async call(config, ctx) {
      const kind = String(config?.ai_kind || '');
      if (kind.startsWith('jev.')) return jevEngine.call(config, ctx);
      if (!fallbackEngine) throw new Error(`jev-router: no fallback for ${kind}`);
      return fallbackEngine.call(config, ctx);
    },
  };
}
