/**
 * tests/mount.test.ts — Mount / Start / Lifecycle tests (sections 6 & 9)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "../src/core/mount";
import { define, registry, instances } from "../src/core/registry";
import { start } from "../src/core/start";

// Reset registry + instances between tests
beforeEach(() => {
  (registry() as Map<string, unknown>).clear();
  (instances() as Map<HTMLElement, unknown>).clear();
  document.body.innerHTML = "";
});

// ── 6.1 mount() ───────────────────────────────────────────────────────────────

describe("6.1 mount()", () => {
  it("mounts component and returns instance", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const inst = mount(el, { state: { count: 0 } });
    expect(inst).not.toBeNull();
    expect(inst!.$el).toBe(el);
  });

  it("repeated mount returns same instance", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const a = mount(el, { state: { count: 0 } });
    const b = mount(el, { state: { count: 0 } });
    expect(a).toBe(b);
  });

  it("returns null for unknown selector", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const inst = mount("#does-not-exist", {});
    expect(inst).toBeNull();
    warnSpy.mockRestore();
  });

  it("state is reactive — mutation triggers render", async () => {
    const el = document.createElement("div");
    const child = document.createElement("span");
    child.setAttribute("data-text", "count");
    el.appendChild(child);
    document.body.appendChild(el);

    const inst = mount(el, { state: { count: 0 } })!;
    expect(child.textContent).toBe("0");

    inst.state.count = 42;
    await Promise.resolve();
    expect(child.textContent).toBe("42");
  });

  it("methods are accessible via instance", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const inst = mount(el, {
      state: { count: 0 },
      increment() {
        this.state.count++;
      },
    }) as Record<string, unknown>;
    expect(typeof inst["increment"]).toBe("function");
  });

  it("prop() reads data-* attribute with auto-cast", () => {
    const el = document.createElement("div");
    el.dataset["page"] = "3";
    el.dataset["active"] = "true";
    document.body.appendChild(el);
    const inst = mount(el, { state: {} })!;
    expect(inst.prop("page", 1)).toBe(3);
    expect(inst.prop("active", false)).toBe(true);
    expect(inst.prop("missing", "default")).toBe("default");
  });
});

// ── 6.2 start() ───────────────────────────────────────────────────────────────

describe("6.2 start()", () => {
  it("auto-mounts [data-component] elements", () => {
    document.body.innerHTML = '<div data-component="widget"></div>';
    define("widget", { state: {} });
    start();
    const el = document.querySelector<HTMLElement>("[data-component]")!;
    expect(instances().has(el)).toBe(true);
  });

  it("repeated start() does not re-mount", () => {
    document.body.innerHTML = '<div data-component="widget"></div>';
    const onCreate = vi.fn();
    define("widget", { state: {}, onCreate });
    start();
    start();
    // onCreate is async (microtask) so flush
    expect(instances().size).toBe(1);
  });

  it("warns when component name not registered", () => {
    document.body.innerHTML = '<div data-component="unknown"></div>';
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    start();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("mounts only within given subtree", () => {
    document.body.innerHTML = `
      <div id="a"><div data-component="widget"></div></div>
      <div id="b"><div data-component="widget"></div></div>
    `;
    define("widget", { state: {} });
    start(document.getElementById("a")!);
    expect(instances().size).toBe(1);
  });
});

// ── 6.3 Lifecycle ─────────────────────────────────────────────────────────────

describe("6.3 Lifecycle", () => {
  it("onCreate called once (in microtask)", async () => {
    const onCreate = vi.fn();
    const el = document.createElement("div");
    document.body.appendChild(el);
    mount(el, { state: {}, onCreate });
    expect(onCreate).not.toHaveBeenCalled(); // not yet — it's async
    await Promise.resolve();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("onDestroy called on destroy()", () => {
    const onDestroy = vi.fn();
    const el = document.createElement("div");
    document.body.appendChild(el);
    const inst = mount(el, { state: {}, onDestroy })!;
    inst.destroy();
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it("destroy() removes instance from registry", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const inst = mount(el, { state: {} })!;
    expect(instances().has(el)).toBe(true);
    inst.destroy();
    expect(instances().has(el)).toBe(false);
  });

  it("destroy() removes data-on click listeners", () => {
    const handler = vi.fn();
    const el = document.createElement("div");
    el.innerHTML = '<button data-on="click:handle">x</button>';
    document.body.appendChild(el);

    const inst = mount(el, { state: {}, handle: handler })!;
    const btn = el.querySelector("button")!;
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);

    inst.destroy();
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1); // no second call
  });

  it("destroy() removes @event click listeners", () => {
    const handler = vi.fn();
    const el = document.createElement("div");
    el.innerHTML = '<button @click="handle">x</button>';
    document.body.appendChild(el);

    const inst = mount(el, { state: {}, handle: handler })!;
    const btn = el.querySelector("button")!;
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);

    inst.destroy();
    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("destroy() removes data-model input listener", async () => {
    const el = document.createElement("div");
    el.innerHTML = '<input data-model="q">';
    document.body.appendChild(el);

    const inst = mount(el, { state: { q: "" } })!;
    const input = el.querySelector("input")!;
    input.value = "a";
    input.dispatchEvent(new Event("input"));
    expect(inst.state.q).toBe("a");

    inst.destroy();
    input.value = "b";
    input.dispatchEvent(new Event("input"));
    // listener gone — state.q does not advance
    expect(inst.state.q).toBe("a");
  });

  it("destroy() blocks scheduled re-renders", async () => {
    const el = document.createElement("div");
    const span = document.createElement("span");
    span.setAttribute("data-text", "count");
    el.appendChild(span);
    document.body.appendChild(el);

    const inst = mount(el, { state: { count: 0 } })!;
    expect(span.textContent).toBe("0");

    inst.state.count = 5;
    inst.destroy();
    await Promise.resolve();
    // Scheduled render fires after destroy — must be a no-op
    expect(span.textContent).toBe("0");
  });

  it("instance method called from a directive expression has `this` bound", () => {
    const el = document.createElement("div");
    const span = document.createElement("span");
    span.setAttribute("data-text", "summary()");
    el.appendChild(span);
    document.body.appendChild(el);

    mount(el, {
      state: { items: [1, 2, 3] },
      summary() {
        // If `this` is not bound, `this.state` throws → silent undefined.
        return `count=${(this.state.items as number[]).length}`;
      },
    });

    expect(span.textContent).toBe("count=3");
  });

  it("re-entrant render() inside a method is dropped with a warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const el = document.createElement("div");
    const span = document.createElement("span");
    span.setAttribute("data-text", "reentry()");
    el.appendChild(span);
    document.body.appendChild(el);

    // Method calls captured render synchronously during the initial render.
    // `this` is not bound when calling from a `with()` scope, so we close over
    // the instance reference instead.
    let captured: { render: () => void } | null = null;
    const inst = mount(el, {
      state: { x: 1 },
      reentry() {
        captured?.render();
        return "";
      },
    })!;
    captured = inst;

    // Initial render already ran with captured=null. Force another render to
    // trigger the re-entry path now that captured points at the instance.
    inst.render();

    const reentryWarns = warnSpy.mock.calls.filter(c =>
      String(c[0]).includes("re-entry"),
    );
    expect(reentryWarns.length).toBeGreaterThanOrEqual(1);
    warnSpy.mockRestore();
  });

  it("destroy() is idempotent", () => {
    const onDestroy = vi.fn();
    const el = document.createElement("div");
    document.body.appendChild(el);
    const inst = mount(el, { state: {}, onDestroy })!;
    inst.destroy();
    inst.destroy();
    expect(onDestroy).toHaveBeenCalledTimes(1);
  });

  it("destroy() then re-mount on same DOM rebinds listeners", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const el = document.createElement("div");
    el.innerHTML = '<button data-on="click:handle">x</button>';
    document.body.appendChild(el);

    const inst1 = mount(el, { state: {}, handle: handler1 })!;
    el.querySelector("button")!.click();
    expect(handler1).toHaveBeenCalledTimes(1);
    inst1.destroy();

    const inst2 = mount(el, { state: {}, handle: handler2 })!;
    expect(inst2).not.toBe(inst1);
    el.querySelector("button")!.click();
    expect(handler1).toHaveBeenCalledTimes(1); // no leak from old instance
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("destroy() then re-mount rebinds @event listeners on keyed each rows", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const el = document.createElement("div");
    el.innerHTML = `
      <template data-each="items" data-key="id">
        <button @click="handle" data-text="item.name"></button>
      </template>
    `;
    document.body.appendChild(el);

    const items = [{ id: 1, name: "A" }];
    const inst1 = mount(el, { state: { items }, handle: handler1 })!;
    el.querySelector("button")!.click();
    expect(handler1).toHaveBeenCalledTimes(1);
    inst1.destroy();

    const inst2 = mount(el, { state: { items }, handle: handler2 })!;
    expect(inst2).not.toBe(inst1);
    el.querySelector("button")!.click();
    expect(handler1).toHaveBeenCalledTimes(1); // no leak from old instance
    expect(handler2).toHaveBeenCalledTimes(1); // new instance is wired up
  });

  it("destroy() unsubscribes all bus subscriptions", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const handler = vi.fn();
    const inst = mount(el, {
      state: {},
      onCreate() {
        this.on("test:event", handler);
      },
    })!;
    await Promise.resolve(); // flush onCreate

    inst.destroy();
    // After destroy, emitting should NOT call handler
    const { emit } = await import("../src/core/bus");
    emit("test:event", "payload");
    expect(handler).not.toHaveBeenCalled();
  });
});

// ── 9. SSR-friendly behavior ──────────────────────────────────────────────────

describe("9. SSR-friendly", () => {
  it("start() can be called multiple times safely", () => {
    document.body.innerHTML = '<div data-component="widget"></div>';
    define("widget", { state: { x: 1 } });
    start();
    start();
    start();
    expect(instances().size).toBe(1);
  });

  it("mount() on existing SSR DOM applies directives correctly", () => {
    const el = document.createElement("div");
    const span = document.createElement("span");
    span.setAttribute("data-text", "title");
    el.appendChild(span);
    document.body.appendChild(el);

    mount(el, { state: { title: "Hello SSR" } });
    expect(span.textContent).toBe("Hello SSR");
  });

  it("prop() reads SSR data-attributes for initial state", () => {
    const el = document.createElement("div");
    el.dataset["perPage"] = "25";
    el.dataset["currentPage"] = "2";
    document.body.appendChild(el);

    const inst = mount(el, {
      state: { page: 1, perPage: 10 },
      onCreate() {
        this.state.page = this.prop("currentPage", 1);
        this.state.perPage = this.prop("perPage", 10);
      },
    })!;
    expect(inst.prop("perPage", 10)).toBe(25);
    expect(inst.prop("currentPage", 1)).toBe(2);
  });

  // ── Hydration contract ────────────────────────────────────────────────────
  // These tests pin the visible behavior during the synchronous mount() call.
  // The contract is intentionally simple: initial render uses the state
  // literal — server-rendered DOM that already matches it doesn't change;
  // anything else is overwritten so the state stays the source of truth.

  it("data-text: SSR text matching state is preserved on mount", () => {
    // No-flicker case — server rendered "Hello SSR", state literal matches.
    const el = document.createElement("div");
    const span = document.createElement("span");
    span.setAttribute("data-text", "title");
    span.textContent = "Hello SSR";
    el.appendChild(span);
    document.body.appendChild(el);

    mount(el, { state: { title: "Hello SSR" } });
    expect(span.textContent).toBe("Hello SSR");
  });

  it("data-text: SSR text different from state is overwritten on mount", () => {
    // State-wins case — server pre-rendered a stale value.
    const el = document.createElement("div");
    const span = document.createElement("span");
    span.setAttribute("data-text", "title");
    span.textContent = "Stale value";
    el.appendChild(span);
    document.body.appendChild(el);

    mount(el, { state: { title: "Fresh value" } });
    expect(span.textContent).toBe("Fresh value");
  });

  it("data-bind: SSR attribute matching state stays after mount", () => {
    const el = document.createElement("div");
    const a = document.createElement("a");
    a.setAttribute("data-bind", "href:url");
    a.setAttribute("href", "/users/42");
    el.appendChild(a);
    document.body.appendChild(el);

    mount(el, { state: { url: "/users/42" } });
    expect(a.getAttribute("href")).toBe("/users/42");
  });

  it("data-bind: SSR attribute different from state is overwritten", () => {
    const el = document.createElement("div");
    const a = document.createElement("a");
    a.setAttribute("data-bind", "href:url");
    a.setAttribute("href", "/users/1");
    el.appendChild(a);
    document.body.appendChild(el);

    mount(el, { state: { url: "/users/42" } });
    expect(a.getAttribute("href")).toBe("/users/42");
  });

  it("data-if=false at mount: SSR-rendered element is detached", () => {
    // Server rendered the element visible, state says it should be gone.
    const el = document.createElement("div");
    const banner = document.createElement("p");
    banner.setAttribute("data-if", "show");
    banner.textContent = "Banner";
    el.appendChild(banner);
    document.body.appendChild(el);

    mount(el, { state: { show: false } });
    // data-if true-unmount: parent no longer contains the element after mount.
    expect(el.contains(banner)).toBe(false);
  });

  it("data-show=false at mount: SSR-rendered element is hidden via style", () => {
    const el = document.createElement("div");
    const banner = document.createElement("p");
    banner.setAttribute("data-show", "show");
    banner.textContent = "Banner";
    el.appendChild(banner);
    document.body.appendChild(el);

    mount(el, { state: { show: false } });
    // data-show keeps element in DOM but flips display.
    expect(el.contains(banner)).toBe(true);
    expect(banner.style.display).toBe("none");
  });

  it("two-stage hydration: initial render uses state literal, onCreate may trigger a second render", async () => {
    // This pins the documented contract: if you initialize state from
    // props inside onCreate, there are TWO renders — the initial render
    // uses the literal state, then onCreate runs in a microtask and may
    // mutate state, triggering a second render. Tests that rely on
    // post-onCreate state must await a microtask.
    const el = document.createElement("div");
    el.dataset["page"] = "42";
    const span = document.createElement("span");
    span.setAttribute("data-text", "page");
    el.appendChild(span);
    document.body.appendChild(el);

    const inst = mount(el, {
      state: { page: 1 },
      onCreate() {
        this.state.page = this.prop("page", 1);
      },
    })!;

    // Stage 1: synchronous initial render — DOM reflects the literal state,
    // NOT the prop yet. Server-rendered text would flicker here if it
    // initially showed "42".
    expect(span.textContent).toBe("1");
    expect(inst.state.page).toBe(1);

    // Stage 2: onCreate fires in a microtask, mutates state, schedules a render.
    await Promise.resolve(); // flush onCreate
    await Promise.resolve(); // flush scheduled render
    expect(span.textContent).toBe("42");
    expect(inst.state.page).toBe(42);
  });

  it("no-flicker hydration: state literal seeded with the server value avoids the second render", async () => {
    // The canonical no-flicker pattern: the server inlines the initial
    // state directly into the definition's state literal (via an SSR
    // template), so the synchronous mount-time render already matches the
    // server-rendered DOM. No onCreate prop read, no second render.
    const el = document.createElement("div");
    const span = document.createElement("span");
    span.setAttribute("data-text", "page");
    span.textContent = "42";
    el.appendChild(span);
    document.body.appendChild(el);

    mount(el, { state: { page: 42 } });
    // Synchronously after mount, the DOM still says "42" — no overwrite.
    expect(span.textContent).toBe("42");
    // And a microtask later, still "42" — no second render queued.
    await Promise.resolve();
    expect(span.textContent).toBe("42");
  });
});
