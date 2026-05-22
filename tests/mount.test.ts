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
