# LLM Correctness Benchmark — methodology

**Claim under test:** giving an LLM Micra's prepared context (`llms.txt` /
`PROMPT.md`) measurably raises the share of *working, idiomatic* generated
components versus asking bare.

This is the flagship launch artifact: nobody in the niche publishes a
reproducible "how well do LLMs generate code for my library" study. The
honesty guards below are what make it citable instead of promo.

## 1. Design

### Tasks (10, fixed prompts)

Each task is phrased the way a real user asks — no hints about directives:

| # | Task | Pass criteria (automated) |
|---|------|---------------------------|
| 1 | Counter with +/− and reset | clicks change rendered count; reset → 0 |
| 2 | Todo: add / toggle / delete + "N left" | add via input+Enter or button; toggle flips class/checkbox; counter correct |
| 3 | Filterable list (All/Active/Done) | filter buttons change visible rows; counts correct |
| 4 | Search with 300 ms debounce | typing doesn't fire per-keystroke; results update after pause |
| 5 | Form with validation + submit state | invalid blocks submit; error shown; loading state toggles |
| 6 | Modal opened from another component | open via bus/event from a separate `data-component`; backdrop click closes |
| 7 | Tabs (3 panes) | clicking tab switches visible pane; active class follows |
| 8 | Sortable data table | clicking column header re-sorts rows |
| 9 | Fetch with loading / error states | loading shown during fetch; error path renders message (mocked fetch) |
| 10 | Three independent dropdowns on one page | instances don't share state; outside click closes |

### Conditions (3)

| Condition | Context given to the model |
|-----------|---------------------------|
| `bare` | task prompt only + "use Micra.js" |
| `llms` | task prompt + contents of `llms.txt` (~6 KB) |
| `prompt` | task prompt + contents of `PROMPT.md` (~14 KB) |

### Models (start with 3)

Claude Sonnet (current), GPT (current default tier), Gemini (current
default tier). Each via official API, default temperature. Add open-weights
later if the harness is cheap to re-run.

### Trials

N = 5 per task × condition × model
→ 10 × 3 × 3 × 5 = **450 generations** (≈ $10–25 at current API prices).

## 2. Evaluation harness

1. **Extract** the HTML document from the model response (first fenced
   block or full-document heuristic). No manual fixing — if it can't be
   extracted mechanically, it fails as `unparseable`.
2. **Rewrite CDN** to the local `dist/micra.min.js` (so results measure
   code quality, not network) — but **record** the URL the model chose
   (unpkg vs jsDelivr is itself a metric).
3. **Load** in happy-dom (same env as the unit tests); run the per-task
   assertion script (plain DOM queries + dispatched events).
4. **Verdict** per generation:
   - `pass` — assertions green
   - `fail-runtime` — JS error on load
   - `fail-behavior` — loads, assertions red
   - `fail-framework` — generated React/Vue/Alpine instead of Micra
   - `unparseable`
5. **Idiom lint** (secondary metric, runs on passes too): regex/AST flags
   for `getElementById|querySelector` writes, `innerHTML =`, `addEventListener`
   inside methods, derived state fields, `@keydown.enter`, unpkg URL.
   → "idiomatic rate" = passes with zero flags.

## 3. Honesty guards (non-negotiable for credibility)

- **All 450 raw generations are committed** to the repo (`bench-llm/runs/`),
  with the exact prompts, model IDs, and dates. Anyone can re-judge.
- Report **variance across the 5 trials**, not just the mean.
- Disclose plainly: the context files were written by Micra's author; the
  claim is "prepared context helps", not "Micra beats X".
- **Alpine control group** (phase 2): run the same 10 tasks bare for
  Alpine.js. Expected result: bare-Alpine beats bare-Micra (more training
  data) — publishing that unflattering number is what buys trust, and it
  motivates the whole llms.txt approach for *any* young library.
- Negative results stay in. If `prompt` doesn't beat `llms`, say so.

## 4. Deliverables

1. `bench-llm/` harness (runner + per-task assertions + lint) — re-runnable
   with one command and an API key.
2. Results table + failure taxonomy on the site (`site/bench-llm/` page,
   same visual language as the perf bench).
3. Write-up (EN, dev.to/blog): "We measured how well LLMs write code for a
   3-week-old framework" — the launch article.

## 5. Effort

| Step | Estimate |
|------|----------|
| Harness + assertions for 10 tasks | 1 day |
| Runs (3 models × API) + triage | 0.5 day |
| Site page + write-up | 1 day |

## 6. Out of scope (v1)

- Agentic / multi-turn repair loops (single-shot only — that's the honest
  baseline; "with self-repair" can be phase 3).
- Open-weights models, fine-tuning, RAG variants.
- Cursor/Copilot in-IDE flows (not reproducible via API).
