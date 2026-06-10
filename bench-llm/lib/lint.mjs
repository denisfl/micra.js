/**
 * lib/lint.mjs — anti-pattern flags on the generated source.
 *
 * Secondary metric: a generation can PASS behaviorally and still be
 * unidiomatic. "Idiomatic rate" = passes with zero flags. Flags mirror the
 * anti-pattern list in PROMPT.md / docs/llm-guide.md.
 */

const RULES = [
  {
    id: 'innerHTML-render',
    why: 'list/content rendered via innerHTML instead of data-each/data-text',
    test: src => /\.innerHTML\s*=/.test(stripMicraBundle(src)),
  },
  {
    id: 'manual-dom-query-render',
    why: 'getElementById/querySelector used to write component output',
    test: src =>
      /(getElementById|querySelector(All)?)\s*\([^)]*\)\s*(\.\w+\s*=|\.append|\.appendChild|\.insertAdjacent)/.test(
        stripMicraBundle(src),
      ),
  },
  {
    id: 'addEventListener-in-method',
    why: 'manual addEventListener in component code (leaks past destroy)',
    // crude: any addEventListener that is NOT document-level boilerplate
    test: src => {
      const s = stripMicraBundle(src)
      const all = [...s.matchAll(/(\w+)\s*\.addEventListener\s*\(/g)].map(m => m[1])
      return all.some(target => target !== 'document' && target !== 'window')
    },
  },
  {
    id: 'derived-state-field',
    why: 'derived value computed from another state field and stored back into state',
    // assigning a computation of state.Y into a DIFFERENT state.X —
    // `items = items.map(...)` (same key) is the legit replace pattern
    test: src =>
      /this\.state\.(\w+)\s*=\s*this\.state\.(?!\1\b)\w+\.(length|filter|map|some|reduce)\b/.test(
        stripMicraBundle(src),
      ),
  },
  {
    id: 'key-modifier',
    why: '@keydown.enter style modifiers are not supported',
    test: src => /@key(down|up|press)\.\w+/.test(src),
  },
  {
    id: 'manual-rerender',
    why: 'manual re-render call after mutation',
    test: src => /this\.(renderList|refresh|update)\s*\(\)/.test(stripMicraBundle(src)),
  },
  {
    id: 'unpkg-cdn',
    why: 'unpkg.com is CSP-blocked in AI sandboxes',
    test: (_src, meta) => (meta.cdnUrls ?? []).some(u => u.includes('unpkg.com')),
  },
  {
    id: 'nested-state-write',
    why: 'nested path write is invisible to the shallow proxy',
    test: src => /this\.state\.\w+\.\w+\s*=(?!=)/.test(stripMicraBundle(src)),
  },
]

/** The injected micra bundle itself contains innerHTML etc. — exclude it.
 *  It is identified by the data-harness-bundle marker extract.mjs sets at
 *  injection time, so banner/minifier changes can't break the strip. */
function stripMicraBundle(src) {
  return src.replace(/<script data-harness-bundle>[\s\S]*?<\/script>/, '')
}

export function lint(source, meta = {}) {
  return RULES.filter(r => {
    try { return r.test(source, meta) } catch { return false }
  }).map(r => r.id)
}
