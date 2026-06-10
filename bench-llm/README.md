# bench-llm — LLM correctness harness

Measures how often LLMs generate *working* Micra.js components, with and
without prepared context. Methodology: see [PLAN.md](./PLAN.md).

## Usage

```bash
# 1. Validate the assertion scripts against hand-written golden solutions
node bench-llm/evaluate.mjs --golden          # must print 10/10 pass

# 2a. Free path — local open-weights models via ollama (no API key):
ollama pull qwen2.5-coder:14b
node bench-llm/run.mjs --models ollama        # BENCH_MODEL_OLLAMA picks the model

# 2b. Hosted models (each enabled by its key):
export ANTHROPIC_API_KEY=...                  # enables claude
export OPENAI_API_KEY=...                     # enables gpt
export GEMINI_API_KEY=...                     # enables gemini
node bench-llm/run.mjs                        # full matrix: 10×3×N×5

# Smoke run (cheap):
node bench-llm/run.mjs --models ollama --tasks 1 --conditions bare --trials 1

# 3. Evaluate everything under runs/ and write results (NO key needed)
node bench-llm/evaluate.mjs                   # → results.json + results.md
```

Generation is resumable — existing files under `runs/` are skipped. Model
ids are overridable via `BENCH_MODEL_CLAUDE`, `BENCH_MODEL_GPT`,
`BENCH_MODEL_GEMINI`, `BENCH_MODEL_OLLAMA` (+ `OLLAMA_HOST`).

## Reproducibility model

`runs/` is **gitignored and local-only** — raw generations are data, not
code, and don't belong in the library's git history. Only the aggregated
`results.md` (the tables) is committed.

Instead of auditing someone else's dataset, you reproduce it yourself:

- generation costs nothing via local ollama models (no account, no key);
- hosted models run with *your* keys;
- evaluation is deterministic and keyless — same raw outputs always
  produce the same verdicts;
- published numbers always state the exact model ids, conditions, and
  trial counts needed to repeat them.

`BENCH_RUNS_DIR` points the tools at any directory if you keep datasets
outside the checkout.

Got interesting numbers (a hosted model, a new open model)? Open a GitHub
issue with your `results.md` — happy to link notable results from the
README. Please don't edit raw run files by hand before evaluating; that
defeats the point.

## Layout

```
bench-llm/
  PLAN.md           methodology (the contract this code implements)
  run.mjs           generation runner (calls provider APIs, saves raw output)
  evaluate.mjs      verdicts + idiom lint + aggregate tables
  tasks.mjs         10 task prompts + assertion scripts
  lib/providers.mjs anthropic / openai / gemini REST callers (no SDKs)
  lib/extract.mjs   HTML extraction from raw responses + CDN detection/rewrite
  lib/loadPage.mjs  happy-dom page loader (fetch mock, error capture)
  lib/lint.mjs      anti-pattern flags (secondary "idiomatic rate" metric)
  golden/           hand-written correct solutions — validate the assertions
  runs/             raw generations (committed for reproducibility)
```

## Verdicts

`pass` · `fail-runtime` (JS error on load) · `fail-behavior` (loads, asserts
red) · `fail-framework` (generated React/Vue/Alpine instead) · `unparseable`
(no extractable HTML document).
