# Micra.js — Documentation Rules

Load this when writing or editing Micra documentation.

---

## Tone of voice

- **Direct.** No marketing fluff. No "powerful", "flexible", "robust".
- **Minimal.** One sentence per idea. Cut filler words.
- **Code-first.** Show the code before explaining it. The explanation annotates the code, not the reverse.
- **Honest about limits.** If something only works shallow, say so. If a footgun exists, document it.
- **Present tense.** "Micra wraps state in a Proxy" not "Micra will wrap state in a Proxy".

---

## Page structure template

Every docs page follows this order:

```
# Topic Name

One-sentence description of what this is and when you'd reach for it.

## [Sub-topic or "Usage"]

Short paragraph: the mental model. What problem does this solve.

```html / ts
minimal code example
```

Annotations: one line per non-obvious detail.

⚠️ Callout for footguns or constraints (italic or blockquote, not bold header).

## [More Sub-topics as needed]

## API

| | |
|---|---|
| parameter | what it does |

(Only if the topic has a formal API surface.)
```

---

## Code example rules

- **Minimal.** The smallest snippet that demonstrates the concept.
- **Real.** Use domain-relevant names (`user`, `items`, `loading`, `count`) not `foo`/`bar`/`example`.
- **Self-contained.** The reader should be able to copy-paste and run it.
- **No comments explaining obvious things.** `// increment count` next to `this.state.count++` is noise.
- **Show the HTML and JS together** when both are needed to understand the feature.
- **Show the anti-pattern only if the mistake is common.** Don't show what not to do for obvious things.

---

## Directive page template

For documenting a new directive `data-foo`:

```md
## `data-foo`

One sentence: what it does.

```html
<element data-foo="expression">...</element>
```

Output / effect: describe what changes in the DOM.

[Optional: special syntax if not obvious]

[Optional: ⚠️ constraint or footgun]
```

---

## Pattern page template

For documenting a UI pattern (dropdown, toast, tabs, etc.):

```md
# [Pattern Name]

What it is. When to use it.

## HTML

```html
[the markup]
```

## JS

```ts
Micra.define('pattern-name', {
  state: { ... },
  // methods
})
```

## How it works

2-3 sentences explaining the key mechanism. Not a line-by-line walkthrough.

## Variations

[If the pattern has meaningful variations]
```

---

## What belongs in a hint / callout

Use a callout (in docs.html: `<span class="hint">`) for:
- Constraints that will bite users (shallow proxy, top-level keys only)
- Performance notes (directive cache, keyed diff)
- SSR compatibility notes
- Anything that contradicts expectations from other frameworks

Do NOT use callouts for:
- Restating what the code already shows
- General encouragement
- Optional nice-to-haves

---

## docs.html specific rules

Each section in docs.html has this structure:
```html
<section id="topic-slug" class="doc-section">
  <h2>Section Title</h2>
  <p>
    Description with <span class="inline-code">code refs</span>.
    <br>
    <span class="hint">Callout for non-obvious behavior.</span>
    <a href="github docs link" class="hint" style="display:inline-block;margin-top:6px">
      Read more in the docs →
    </a>
  </p>
  <div class="example">
    <div class="example-preview">
      <!-- live demo HTML with data-component -->
    </div>
    <div class="example-code">
      <pre><code><!-- code shown to the reader --></code></pre>
    </div>
  </div>
</section>
```

The sidebar nav entry:
```html
<a href="#topic-slug"><span class="dot"></span>Section Title</a>
```

---

## LLM prompt rules (for generating Micra examples or docs)

When asked to generate a Micra component:
1. Start from the HTML structure — what does the user see?
2. Define state: only what changes.
3. Define methods: only what mutates state or calls external APIs.
4. Use `onCreate` for setup (fetch data, attach outside listeners).
5. Use `onDestroy` for cleanup (remove listeners, cancel timers).
6. Keep state flat. No nested reactive objects.
7. Use `this.prop()` for server-configured values, not hardcoded state defaults.
8. Use `this.on()` for cross-component communication, not direct method calls.

When asked to document a concept:
1. Write the code example first.
2. Write one sentence describing what it does.
3. Add a callout only if there's a real footgun.
4. Link to the relevant docs page.
