# Dog Table v1.5.1

[![npm version](https://img.shields.io/npm/v/dog-table)](https://www.npmjs.com/package/dog-table)
[![license](https://img.shields.io/npm/l/dog-table)](./LICENSE)

Dog Table is a framework-free JavaScript data table with local data, remote data, search, sorting, pagination, filtering, inline editing, create flows, persistence, layout controls, aggregates, events, and plugins.

The public constructor is `new DogTable(container, options)`. `DataTable` remains exported as a backward-compatible alias.

## Install

```bash
npm install dog-table
```

```js
import { DogTable } from "dog-table";
import "dog-table/css";

const table = new DogTable("#app", {
  data: [
    { id: 1, name: "Mochi", status: "active", amount: 120 },
    { id: 2, name: "Pepper", status: "review", amount: 220 },
  ],
  columns: [
    { key: "id", label: "ID", hidden: true },
    { key: "name", label: "Name", editable: true },
    {
      key: "status",
      label: "Status",
      filterType: "select",
      filterOptions: ["active", "review"],
    },
    { key: "amount", label: "Amount", type: "money" },
  ],
  filterRow: true,
  footerAggregates: { amount: "sum" },
});

table.init();
```

## Current Features

- Local search, structured filters, sort, pagination, grouping, detail rows, selection, and CSV export.
- Remote fetching with aborts, request dedupe, page pagination, cursor pagination, custom query serialization, and mapped responses.
- Inline editing and create workflows with optional authenticated remote requests and `optimisticUpdates`.
- State persistence through local storage, session storage, URL-style persistence, named views, and opt-in readable URL state sync.
- Column visibility, sticky headers, sticky left columns, column resizing, and drag reordering.
- Footer and group aggregates: `sum`, `avg`, `min`, `max`, and `count`.
- Standard events: `state:change`, `row:add`, `row:update`, `row:remove`, `fetch:start`, `fetch:success`, and `fetch:error`.
- Global and per-instance plugins with `install(table)` and optional `destroy(table)`.

## Common Options

```js
const table = new DogTable("#app", {
  data: rows,
  columns,
  pageSize: 25,
  searchable: true,
  filterRow: true,
  persistence: "local",
  persistenceKey: "orders-table",
  urlState: true,
  stickyHeader: true,
  stickyColumns: ["id"],
  resizableColumns: true,
  columnReorder: true,
  footerAggregates: {
    amount: "sum",
    orders: "count",
  },
});
```

## Remote Data

```js
const table = new DogTable("#app", {
  remote: {
    url: "/api/orders",
    dataKey: "items",
    totalKey: "total",
    queryParams: {
      page: "page",
      pageSize: "limit",
      search: "q",
      sort: "sort",
      order: "direction",
    },
    filterParams(filters) {
      return filters;
    },
  },
  columns,
});
```

Cursor APIs can use `remote.pagination = "cursor"` and return cursors from `mapResponse`:

```js
remote: {
  url: "/api/orders",
  pagination: "cursor",
  cursorParam: "cursor",
  mapResponse(payload) {
    return {
      rows: payload.items,
      nextCursor: payload.nextCursor,
      prevCursor: payload.prevCursor,
      aggregates: payload.aggregates,
    };
  },
}
```

## Runtime API

```js
table.setSearch("mochi");
table.setFilters({ status: "active" });
table.clearFilters();

table.showColumn("email");
table.hideColumn("id");
table.toggleColumn("status");

table.saveView("default");
table.loadView("default");
table.deleteView("default");

table.addRow({ id: 3, name: "Nori" });
table.updateRow(3, { status: "active" });
table.removeRow(3);

table.on("state:change", ({ state, processed }) => {
  console.log(state.currentPage, processed.totalItems);
});
```

## Plugins

```js
const AuditPlugin = {
  install(table) {
    this.unsubscribe = table.on("row:update", ({ rowId }) => {
      console.log("updated", rowId);
    });
  },
  destroy() {
    this.unsubscribe?.();
  },
};

DogTable.use(AuditPlugin);

new DogTable("#app", {
  data,
  columns,
  plugins: [AuditPlugin],
}).init();
```

## Documentation App

The old `demo/` folder has been replaced by a Svelte + Tailwind documentation app in `docs/`.

```bash
npm run docs:dev
npm run docs:build
```

## Build

```bash
npm run build
npm test
```

The package build copies `src/` to `dist/` and writes minified JS/CSS entry files.
