// Benchmark scenarios — abstract definitions.
//
// Each scenario describes what to measure in library-agnostic terms.
// Adapters in adapters/<lib>.adapter.js implement these for each library.
//
// Iteration counts kept small so the full matrix completes in ~30s even
// when a slow library accumulates state across iters (Alpine in particular).
// Median of 5-7 is stable enough for "X is faster than Y" claims.

export const SCENARIOS = [
  {
    id: 'mount-100',
    label: 'Mount 100 components',
    description: '100 elements with 3 reactive bindings each. Measures wire-up cost.',
    iters: 7,
  },
  {
    id: 'mount-1000',
    label: 'Mount 1000 components',
    description: '1000 elements with 3 reactive bindings each. Tests scaling.',
    iters: 3,
  },
  {
    id: 'list-1000-first',
    label: 'First render — 1000 items (keyed)',
    description: 'Render a 1000-row list of {id, name, value} from empty.',
    iters: 5,
  },
  {
    id: 'list-1000-update',
    label: 'Update 5 rows in 1000',
    description: 'Mutate every 200th row in a 1000-row list. Measures keyed-diff hit rate.',
    iters: 7,
  },
  {
    id: 'list-1000-swap',
    label: 'Swap first and last of 1000',
    description: 'Move row[0] ↔ row[999]. Two real keyed moves.',
    iters: 7,
  },
  {
    id: 'state-writes',
    label: '10,000 state writes',
    description: 'Increment a counter 10k times, await the next render.',
    iters: 5,
  },
  {
    id: 'unmount-1000',
    label: 'Unmount 1000 components',
    description: 'Tear down 1000 mounted components. Measures cleanup speed.',
    iters: 3,
  },
]
