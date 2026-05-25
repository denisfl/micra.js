((window.fetch = (t) => {
  const e =
    {
      "/api/users": [
        { id: 1, name: "Alice Chen", role: "Admin" },
        { id: 2, name: "Bob Smith", role: "Member" },
        { id: 3, name: "Carol White", role: "Viewer" },
      ],
    }[t] ?? [];
  if (t === "/api/missing") {
    return Promise.resolve({
      ok: !1,
      status: 404,
      statusText: "Not Found",
      headers: { get: () => "application/json" },
      json: () => Promise.resolve({ error: "Resource not found" }),
      text: () => Promise.resolve('{"error":"Resource not found"}'),
    });
  }
  return Promise.resolve({
    ok: !0,
    headers: { get: () => "application/json" },
    json: () => Promise.resolve(e),
    text: () => Promise.resolve(JSON.stringify(e)),
  });
}),
  Micra.define("counter-demo", {
    state: { count: 0 },
    inc() {
      this.state.count++;
    },
    dec() {
      this.state.count--;
    },
  }),
  Micra.define("reactive-demo", { state: { name: "" } }),
  Micra.define("text-html-demo", {
    state: {
      rich: !1,
      message: "Plain text keeps <strong>tags</strong> literal.",
      markup: "<strong>Rendered HTML</strong> with <em>data-html</em>.",
    },
    toggle() {
      ((this.state.rich = !this.state.rich),
        (this.state.message = this.state.rich
          ? "Now it says: <em>still plain text</em>."
          : "Plain text keeps <strong>tags</strong> literal."),
        (this.state.markup = this.state.rich
          ? '<span style="color: var(--success)">HTML can render styled markup.</span>'
          : "<strong>Rendered HTML</strong> with <em>data-html</em>."));
    },
  }),
  Micra.define("if-demo", {
    state: { open: !0 },
    toggle() {
      this.state.open = !this.state.open;
    },
  }),
  Micra.define("show-demo", {
    state: { visible: !0 },
    toggle() {
      this.state.visible = !this.state.visible;
    },
  }),
  Micra.define("bind-demo", { state: { color: "#2563eb" } }),
  Micra.define("class-demo", {
    state: { tab: "overview" },
    select(t) {
      this.state.tab = t.currentTarget.dataset.tab || "overview";
    },
  }),
  Micra.define("bus-sender", {
    state: { sent: 0 },
    ping() {
      (this.state.sent++,
        Micra.emit("docs:ping", {
          count: this.state.sent,
          at: new Date().toLocaleTimeString(),
        }));
    },
  }),
  Micra.define("bus-receiver", {
    state: { count: 0, last: "Waiting for an event\u2026", unsubscribed: !1 },
    onCreate() {
      this.__sub = this.on("docs:ping", (t) => {
        if (!this.state.unsubscribed) {
          (this.state.count++,
            (this.state.last = "Received ping #" + t.count + " at " + t.at));
        }
      });
    },
    unsubscribe() {
      ((this.state.unsubscribed = !0),
        this.__sub && this.__sub(),
        Micra.emit("docs:ping", {
          count: this.state.count,
          at: new Date().toLocaleTimeString(),
        }));
    },
  }),
  Micra.define("fetch-demo", {
    state: { loading: !1, loaded: !1, users: [] },
    async load() {
      if (!this.state.loading) {
        this.state.loading = !0;
        try {
          ((this.state.users = await this.fetch("/api/users")),
            (this.state.loaded = !0));
        } finally {
          this.state.loading = !1;
        }
      }
    },
  }),
  Micra.define("fetch-error-demo", {
    state: { status: null, message: "" },
    async try404() {
      try {
        await this.fetch("/api/missing");
      } catch (t) {
        ((this.state.status = t.status), (this.state.message = t.message));
      }
    },
    async tryUsers() {
      const t = await this.fetch("/api/users");
      ((this.state.status = 200),
        (this.state.message = "Got " + t.length + " users"));
    },
  }),
  Micra.define("each-demo", {
    state: {
      newItem: "",
      nextId: 3,
      items: [
        { id: 1, text: "Read the docs", done: !1 },
        { id: 2, text: "Build something fun", done: !0 },
      ],
    },
    add(t) {
      if (t && t.type === "keydown" && t.key !== "Enter") return;
      const e = this.state.newItem.trim();
      e &&
        ((this.state.items = [
          ...this.state.items,
          { id: this.state.nextId, text: e, done: !1 },
        ]),
        this.state.nextId++,
        (this.state.newItem = ""));
    },
    toggle(t) {
      const e = Number(t.currentTarget.closest("[data-id]")?.dataset.id);
      this.state.items = this.state.items.map((s) =>
        s.id === e ? { ...s, done: !s.done } : s,
      );
    },
    remove(t) {
      const e = Number(t.currentTarget.dataset.id);
      this.state.items = this.state.items.filter((s) => s.id !== e);
    },
    doneCount() {
      return this.state.items.filter((t) => t.done).length;
    },
  }),
  Micra.define("expr-demo", {
    state: { qty: 1 },
    inc() {
      this.state.qty++;
    },
    dec() {
      this.state.qty > 1 && this.state.qty--;
    },
    formatPrice(t) {
      return "$" + t.toFixed(2);
    },
    stockMessage(t) {
      return t > 10 ? "\u26a0 Low stock!" : "\u2713 In stock";
    },
  }),
  Micra.define("each-no-key-demo", {
    state: { nextId: 1, items: [] },
    add() {
      const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"],
        t = names[Math.floor(Math.random() * names.length)];
      ((this.state.items = [
        ...this.state.items,
        { id: this.state.nextId, text: t },
      ]),
        this.state.nextId++);
    },
    shuffle() {
      this.state.items = [...this.state.items].sort(() => Math.random() - 0.5);
    },
    remove(t) {
      const e = Number(t.currentTarget.dataset.id);
      this.state.items = this.state.items.filter((s) => s.id !== e);
    },
  }),
  Micra.define("ref-demo", {
    state: { values: [42, 68, 29, 81] },
    onCreate() {
      this.draw();
    },
    draw() {
      const t = this.refs.canvas;
      if (!t) return;
      const e = t.getContext("2d");
      if (!e) return;
      const s = ["Q1", "Q2", "Q3", "Q4"],
        i = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626"],
        a = 22,
        h = Math.max(...this.state.values, 1),
        l =
          (t.width - a * (this.state.values.length + 1)) /
          this.state.values.length;
      (e.clearRect(0, 0, t.width, t.height),
        (e.fillStyle = "#f5f4f0"),
        e.fillRect(0, 0, t.width, t.height),
        this.state.values.forEach((r, n) => {
          const d = ((t.height - 46) * r) / h,
            o = a + n * (l + a),
            c = t.height - d - 24;
          ((e.fillStyle = i[n]),
            e.fillRect(o, c, l, d),
            (e.fillStyle = "#333"),
            (e.font =
              '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'),
            e.fillText(String(r), o + 8, c - 8),
            e.fillText(s[n], o + 8, t.height - 8));
        }));
    },
    randomize() {
      ((this.state.values = this.state.values.map((t) => {
        const e = t + Math.round((Math.random() - 0.5) * 28);
        return Math.max(18, Math.min(90, e));
      })),
        this.draw());
    },
  }),
  Micra.define("event-demo", {
    state: {
      clicks: 0,
      name: "",
      submitted: "No form submission yet.",
      draft: "",
      lastCommit: "Press Enter in the field below.",
    },
    increment() {
      this.state.clicks++;
    },
    submit() {
      const t = this.state.name.trim() || "friend";
      ((this.state.submitted =
        "Submitted without a full page reload for " + t + "."),
        (this.state.name = ""));
    },
    commit(t) {
      if (t.key !== "Enter") return;
      const e = this.state.draft.trim();
      e &&
        ((this.state.lastCommit =
          "Saved \u201C" + e + "\u201D from @keydown.enter."),
        (this.state.draft = ""));
    },
  }));
const lifecycleDefinition = {
  state: { stamp: "", status: "Waiting for hooks\u2026" },
  onCreate() {
    const t = new Date().toLocaleTimeString();
    ((this.state.stamp = t),
      (this.state.status = "Created by onCreate() in a microtask."),
      window.LifecycleDemo.log("onCreate \u2192 " + t));
  },
  onDestroy() {
    window.LifecycleDemo.log(
      "onDestroy \u2192 " + new Date().toLocaleTimeString(),
    );
  },
};
(Micra.define("lifecycle-demo", lifecycleDefinition),
  (window.LifecycleDemo = {
    instance: null,
    mount() {
      const t = document.getElementById("lifecycle-host");
      t &&
        (this.instance && this.destroy(),
        (t.innerHTML = [
          '<div id="lifecycle-target" class="mounted-card">',
          "  <h4>Mounted with Micra.mount()</h4>",
          '  <p>Created at <strong data-text="stamp"></strong></p>',
          '  <p class="hint" data-text="status"></p>',
          "</div>",
        ].join("")),
        (this.instance = Micra.mount(
          document.getElementById("lifecycle-target"),
          lifecycleDefinition,
        )));
    },
    destroy() {
      const t = document.getElementById("lifecycle-host");
      if (!this.instance) {
        this.log("Nothing to destroy.");
        return;
      }
      (this.instance.destroy(),
        (this.instance = null),
        t &&
          (t.innerHTML =
            '<div class="mount-placeholder">Component destroyed. Mount again.</div>'));
    },
    log(t) {
      const e = document.getElementById("lifecycle-log");
      if (!e) return;
      const s = document.createElement("div");
      for (
        s.className = "log-item", s.textContent = t, e.prepend(s);
        e.children.length > 4;
      )
        e.removeChild(e.lastChild);
    },
  }),
  Micra.define("multi-dropdown", {
    state: {
      open: !1,
      selectedLabel: "",
      options: [],
    },
    onCreate() {
      this.state.label = this.prop("label", "Choose\u2026");
      this._event = this.prop("event", "");
      const t = this.prop("kind", "category"),
        e = {
          category: [
            { label: "All categories", value: "all" },
            { label: "Design", value: "Design" },
            { label: "Development", value: "Development" },
            { label: "Marketing", value: "Marketing" },
          ],
          "status-filter": [
            { label: "All statuses", value: "all" },
            { label: "Active", value: "Active" },
            { label: "Completed", value: "Completed" },
            { label: "On Hold", value: "On Hold" },
          ],
          priority: [
            { label: "All priorities", value: "all" },
            { label: "High", value: "High" },
            { label: "Medium", value: "Medium" },
            { label: "Low", value: "Low" },
          ],
        };
      ((this.state.options = e[t] || e.category),
        (this.outside = (s) => {
          this.$el.contains(s.target) || (this.state.open = !1);
        }),
        document.addEventListener("click", this.outside));
    },
    onDestroy() {
      document.removeEventListener("click", this.outside);
    },
    toggle() {
      this.state.open = !this.state.open;
    },
    select(t) {
      const e = t.currentTarget.dataset.value || "",
        s = this.state.options.find((i) => i.value === e);
      ((this.state.selectedLabel = s ? s.label : e),
        (this.state.open = !1),
        this._event && Micra.emit(this._event, e));
    },
  }));

const mockTasks = [
  {
    id: 1,
    name: "Redesign dashboard",
    category: "Design",
    categoryBadge: "badge-purple",
    status: "Active",
    statusBadge: "badge-green",
    priority: "High",
    priorityBadge: "badge-red",
  },
  {
    id: 2,
    name: "Fix login bug",
    category: "Development",
    categoryBadge: "badge-blue",
    status: "Completed",
    statusBadge: "badge-blue",
    priority: "High",
    priorityBadge: "badge-red",
  },
  {
    id: 3,
    name: "Write blog post",
    category: "Marketing",
    categoryBadge: "badge-green",
    status: "Active",
    statusBadge: "badge-green",
    priority: "Medium",
    priorityBadge: "badge-yellow",
  },
  {
    id: 4,
    name: "Update icon set",
    category: "Design",
    categoryBadge: "badge-purple",
    status: "Completed",
    statusBadge: "badge-blue",
    priority: "Low",
    priorityBadge: "badge-gray",
  },
  {
    id: 5,
    name: "API rate limiting",
    category: "Development",
    categoryBadge: "badge-blue",
    status: "Active",
    statusBadge: "badge-green",
    priority: "High",
    priorityBadge: "badge-red",
  },
  {
    id: 6,
    name: "SEO audit",
    category: "Marketing",
    categoryBadge: "badge-green",
    status: "On Hold",
    statusBadge: "badge-yellow",
    priority: "Medium",
    priorityBadge: "badge-yellow",
  },
  {
    id: 7,
    name: "User testing",
    category: "Design",
    categoryBadge: "badge-purple",
    status: "Active",
    statusBadge: "badge-green",
    priority: "Medium",
    priorityBadge: "badge-yellow",
  },
  {
    id: 8,
    name: "Database backup",
    category: "Development",
    categoryBadge: "badge-blue",
    status: "Completed",
    statusBadge: "badge-blue",
    priority: "Low",
    priorityBadge: "badge-gray",
  },
  {
    id: 9,
    name: "Email campaign",
    category: "Marketing",
    categoryBadge: "badge-green",
    status: "On Hold",
    statusBadge: "badge-yellow",
    priority: "High",
    priorityBadge: "badge-red",
  },
  {
    id: 10,
    name: "Mobile responsive",
    category: "Design",
    categoryBadge: "badge-purple",
    status: "Active",
    statusBadge: "badge-green",
    priority: "High",
    priorityBadge: "badge-red",
  },
];
Micra.define("filter-table", {
  state: {
    all: [],
    filtered: [],
    category: "all",
    status: "all",
    priority: "all",
  },
  onCreate() {
    ((this.state.all = [...mockTasks]),
      (this.state.filtered = [...mockTasks]),
      this.on("filter:category", (t) => {
        ((this.state.category = t), this._apply());
      }),
      this.on("filter:status", (t) => {
        ((this.state.status = t), this._apply());
      }),
      this.on("filter:priority", (t) => {
        ((this.state.priority = t), this._apply());
      }));
  },
  _apply() {
    let t = this.state.all;
    (this.state.category !== "all" &&
      (t = t.filter((e) => e.category === this.state.category)),
      this.state.status !== "all" &&
        (t = t.filter((e) => e.status === this.state.status)),
      this.state.priority !== "all" &&
        (t = t.filter((e) => e.priority === this.state.priority)),
      (this.state.filtered = t));
  },
});
const navLinks = Array.from(document.querySelectorAll(".sidebar-nav a")),
  sections = Array.from(document.querySelectorAll(".doc-section")),
  setActiveLink = (t) => {
    navLinks.forEach((e) => {
      e.classList.toggle("active", e.getAttribute("href") === "#" + t);
    });
  },
  observer = new IntersectionObserver(
    (t) => {
      const e = t
        .filter((s) => s.isIntersecting)
        .sort((s, i) => i.intersectionRatio - s.intersectionRatio)[0];
      e && setActiveLink(e.target.id);
    },
    { rootMargin: "-18% 0px -60% 0px", threshold: [0.15, 0.35, 0.6] },
  );
(sections.forEach((t) => observer.observe(t)),
  window.location.hash && setActiveLink(window.location.hash.slice(1)),
  Micra.start());
