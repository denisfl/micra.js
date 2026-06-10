# LLM correctness results

_150 generations evaluated 2026-06-10_

## Pass rate (model × condition)

| model | bare | llms | prompt |
|---|---|---|---|
| ollama--qwen2.5-coder_14b | 0% | 16% | 34% |

## Idiomatic rate (pass AND zero lint flags)

| model | bare | llms | prompt |
|---|---|---|---|
| ollama--qwen2.5-coder_14b | 0% | 16% | 34% |

## Failure taxonomy

| verdict | count |
|---|---|
| fail-framework | 38 |
| fail-runtime | 16 |
| pass | 25 |
| fail-behavior | 71 |

## CDN choice (when the model loaded Micra from a URL)

| host | count |
|---|---|
| unpkg.com | 4 |
| cdn.jsdelivr.net | 107 |
| x | 4 |
