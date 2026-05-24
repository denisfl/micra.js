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
});
