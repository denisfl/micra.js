# Examples

Real, interactive apps built on Micra.js — **one HTML file each, no build step**.
Each page loads Micra from the jsDelivr CDN and mounts on `Micra.start()`; open
any file in a browser and it just runs.

Browse them live at **[micrajs.dev/examples](https://micrajs.dev/examples)**
(each demo also runs standalone at `micrajs.dev/demos/<name>`).

| Demo | What it shows |
| --- | --- |
| [`admin.html`](./admin.html) | Users table with search, filters, sorting and pagination; slide-over create/edit forms with validation; delete confirmation; dashboard, customers and settings views; light/dark themes. |
| [`dashboard.html`](./dashboard.html) | KPI cards, a 7/30/90-day period switcher and an inline bar chart that all recompute from one piece of state, plus a recent-activity feed. |
| [`sales.html`](./sales.html) | A full sales pipeline board (AmoCRM-style): move deals across stages, search and filter by owner, add a deal inline, open a card for its activity log. Columns and cards are a nested `data-each`; forecast and totals are derived methods. |
| [`planner.html`](./planner.html) | A month calendar with events per day, category filters, month navigation and an agenda panel to add/delete events. Each cell renders its events through a nested `data-each`. |
| [`store.html`](./store.html) | Product grid with category filters and live search, plus a reactive cart total. |
| [`restaurant.html`](./restaurant.html) | A menu by category with an order builder: add dishes, adjust quantities, and the running total updates live. |
| [`pastry.html`](./pastry.html) | A bakery storefront plus a custom-cake builder where the price recomputes live as you choose size, sponge, filling and extras. |
| [`realestate.html`](./realestate.html) | Filter homes by a price-range slider and bedroom count, save favorites, and the result count updates instantly — a keyed grid with no manual DOM. |
| [`autoservice.html`](./autoservice.html) | A repair-shop estimate builder: enter the vehicle, toggle services, and watch parts, labor (hours × rate), tax and total recompute. |
| [`software.html`](./software.html) | A SaaS pricing page that quotes in real time: pick a plan, drag the seats slider, toggle monthly/annual and add-ons; per-month and billed-today figures recompute, including annual savings. |
| [`construction.html`](./construction.html) | A project dashboard with phases, progress bars and budget-vs-spent; nudging a phase updates overall completion, phases-done count and budget health. |
| [`booking.html`](./booking.html) | Pick a service, a day and a time slot, then fill a validated form to confirm. Taken slots are disabled and the summary updates as you go. |

All examples are MIT-licensed — copy any file into your project as a starting point.
For the directive reference and recipes, see the [docs](https://micrajs.dev/docs).
