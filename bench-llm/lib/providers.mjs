/**
 * lib/providers.mjs — REST callers for the three providers. No SDKs.
 *
 * Each provider takes { system, user, model } and returns the raw text of
 * the model's reply. Keys come from env; a missing key disables the model
 * (the runner skips it with a notice).
 */

const T = 120_000 // per-request timeout, ms

async function post(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(T),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

export const providers = {
  claude: {
    model: process.env.BENCH_MODEL_CLAUDE ?? 'claude-sonnet-4-6',
    enabled: () => !!process.env.ANTHROPIC_API_KEY,
    async generate({ system, user, model }) {
      const j = await post(
        'https://api.anthropic.com/v1/messages',
        {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        {
          model,
          max_tokens: 8192,
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: user }],
        },
      )
      return j.content.map(b => b.text ?? '').join('')
    },
  },

  gpt: {
    model: process.env.BENCH_MODEL_GPT ?? 'gpt-5.1',
    enabled: () => !!process.env.OPENAI_API_KEY,
    async generate({ system, user, model }) {
      const j = await post(
        'https://api.openai.com/v1/chat/completions',
        { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        {
          model,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: user },
          ],
        },
      )
      return j.choices[0].message.content ?? ''
    },
  },

  gemini: {
    model: process.env.BENCH_MODEL_GEMINI ?? 'gemini-2.5-flash',
    enabled: () => !!process.env.GEMINI_API_KEY,
    async generate({ system, user, model }) {
      const j = await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { 'x-goog-api-key': process.env.GEMINI_API_KEY },
        {
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents: [{ role: 'user', parts: [{ text: user }] }],
        },
      )
      return (j.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('')
    },
  },

  // Local open-weights models via ollama — zero cost, no API key.
  // Pick the model with BENCH_MODEL_OLLAMA (anything from `ollama list`).
  ollama: {
    model: process.env.BENCH_MODEL_OLLAMA ?? 'qwen2.5-coder:14b',
    host: process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434',
    enabled: () => true, // reachability is checked by preflight()
    async preflight() {
      try {
        const res = await fetch(`${this.host}/api/tags`, { signal: AbortSignal.timeout(2000) })
        if (!res.ok) return `ollama server responded ${res.status}`
        const tags = await res.json()
        const names = (tags.models ?? []).map(m => m.name)
        if (!names.includes(this.model))
          return `model "${this.model}" not pulled (have: ${names.join(', ') || 'none'})`
        return null
      } catch {
        return `ollama not reachable at ${this.host} — is it running?`
      }
    },
    async generate({ system, user, model }) {
      const res = await fetch(`${this.host}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: user },
          ],
        }),
        signal: AbortSignal.timeout(600_000), // local 14B models are slow
      })
      if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`)
      const j = await res.json()
      return j.message?.content ?? ''
    },
  },
}
