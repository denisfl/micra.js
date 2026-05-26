/* Micra docs syntax highlighter
 * Self-contained, ~3 kB gzipped. Highlights HTML, JS, and HTML/JS mixed
 * snippets. Micra directives (data-*, @event, :bind) get the accent color —
 * the library's visual signature.
 *
 * Runs after DOMContentLoaded, walks every <pre><code>, replaces innerHTML.
 */
(function () {
  "use strict";

  const escapeHtml = (s) =>
    s.replace(/[&<>"']/g, (c) =>
      c === "&"
        ? "&amp;"
        : c === "<"
          ? "&lt;"
          : c === ">"
            ? "&gt;"
            : c === '"'
              ? "&quot;"
              : "&#39;",
    );

  const JS_KEYWORDS =
    /\b(?:const|let|var|function|if|else|for|while|return|async|await|class|new|this|import|export|from|of|in|try|catch|throw|null|undefined|true|false|void|typeof|instanceof|do|switch|case|break|continue|finally|default|extends|super|static|get|set|yield)\b/y;

  const span = (cls, text) =>
    `<span class="hl-${cls}">${escapeHtml(text)}</span>`;

  // Match a sticky regex at position i in src; returns the match text or null.
  const tryMatch = (src, i, re) => {
    re.lastIndex = i;
    const m = re.exec(src);
    return m && m.index === i ? m[0] : null;
  };

  function highlight(src) {
    let out = "";
    let i = 0;
    let inTag = false;

    while (i < src.length) {
      // HTML comment <!-- ... -->
      if (!inTag && src.startsWith("<!--", i)) {
        const end = src.indexOf("-->", i + 4);
        const close = end === -1 ? src.length : end + 3;
        out += span("comment", src.slice(i, close));
        i = close;
        continue;
      }

      // Enter tag: < or </ followed by tag name
      if (!inTag) {
        const tag = tryMatch(src, i, /<\/?[a-zA-Z][a-zA-Z0-9-]*/y);
        if (tag) {
          out += span("tag", tag);
          i += tag.length;
          inTag = true;
          continue;
        }
      }

      if (inTag) {
        // Close tag: > or />
        if (src[i] === ">") {
          out += span("tag", ">");
          i++;
          inTag = false;
          continue;
        }
        if (src[i] === "/" && src[i + 1] === ">") {
          out += span("tag", "/>");
          i += 2;
          inTag = false;
          continue;
        }
        // Micra-special attribute (data-*, @event, :bind) — accent color
        const spec = tryMatch(
          src,
          i,
          /(?:data-[a-zA-Z-]+|@[a-zA-Z.-]+|:[a-zA-Z-]+)(?=\s*=|\s|\/?>)/y,
        );
        if (spec) {
          out += span("directive", spec);
          i += spec.length;
          continue;
        }
        // Generic attribute name
        const attr = tryMatch(src, i, /[a-zA-Z-]+(?=\s*=|\s|\/?>)/y);
        if (attr) {
          out += span("attr", attr);
          i += attr.length;
          continue;
        }
        // String inside tag
        const dq = tryMatch(src, i, /"[^"]*"/y);
        if (dq) {
          out += span("string", dq);
          i += dq.length;
          continue;
        }
        const sq = tryMatch(src, i, /'[^']*'/y);
        if (sq) {
          out += span("string", sq);
          i += sq.length;
          continue;
        }
        // Everything else inside tag (=, whitespace, garbage)
        out += escapeHtml(src[i]);
        i++;
        continue;
      }

      // === Outside tag: apply JS-ish rules ===
      // Block comment /* ... */
      if (src[i] === "/" && src[i + 1] === "*") {
        const end = src.indexOf("*/", i + 2);
        const close = end === -1 ? src.length : end + 2;
        out += span("comment", src.slice(i, close));
        i = close;
        continue;
      }
      // Line comment //
      if (src[i] === "/" && src[i + 1] === "/") {
        const end = src.indexOf("\n", i);
        const close = end === -1 ? src.length : end;
        out += span("comment", src.slice(i, close));
        i = close;
        continue;
      }
      // Strings
      const jsdq = tryMatch(src, i, /"(?:[^"\\]|\\.)*"/y);
      if (jsdq) {
        out += span("string", jsdq);
        i += jsdq.length;
        continue;
      }
      const jssq = tryMatch(src, i, /'(?:[^'\\]|\\.)*'/y);
      if (jssq) {
        out += span("string", jssq);
        i += jssq.length;
        continue;
      }
      const tpl = tryMatch(src, i, /`[^`]*`/y);
      if (tpl) {
        out += span("string", tpl);
        i += tpl.length;
        continue;
      }
      // Number
      const num = tryMatch(src, i, /\b\d+(?:\.\d+)?\b/y);
      if (num) {
        out += span("number", num);
        i += num.length;
        continue;
      }
      // Keyword
      const kw = tryMatch(src, i, JS_KEYWORDS);
      if (kw) {
        out += span("kw", kw);
        i += kw.length;
        continue;
      }
      // Function call: identifier followed by (
      const fn = tryMatch(src, i, /[a-zA-Z_$][\w$]*(?=\s*\()/y);
      if (fn) {
        out += span("fn", fn);
        i += fn.length;
        continue;
      }
      // Property access .ident
      if (src[i] === ".") {
        const prop = tryMatch(src, i, /\.[a-zA-Z_$][\w$]*/y);
        if (prop) {
          out += "." + span("prop", prop.slice(1));
          i += prop.length;
          continue;
        }
      }
      // Default: pass through
      out += escapeHtml(src[i]);
      i++;
    }

    return out;
  }

  function run() {
    document.querySelectorAll("pre code").forEach((el) => {
      if (el.dataset.hl === "done") return;
      el.innerHTML = highlight(el.textContent);
      el.dataset.hl = "done";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

  // Expose for components that re-render code blocks
  window.MicraHighlight = { run, highlight };
})();
