# Dog Table v1.5.1

[![npm version](https://img.shields.io/npm/v/dog-table)](https://www.npmjs.com/package/dog-table)
[![license](https://img.shields.io/npm/l/dog-table)](./LICENSE)
[![demo site](https://img.shields.io/badge/demo/live-0f766e)](https://arrahmaan17.github.io/dog-table/)

Dog Table is a lightweight vanilla JavaScript data table library for projects that want a clean API, useful built-in features, and no framework lock-in. It supports local data, remote fetching, inline editing, create workflows, selection, formatting, grouping, localization, and live sync in one package.

**v1.5.1** adds performance optimizations: request debouncing, request deduplication, memoized display rows, precomputed sort keys, rAF-batched renders, DOM diffing, optimized HTML escaping, CSS content-visibility for groups, virtual scrolling support, and Map/Set lookup optimizations. It also fixes a critical live-sync bug where the table would get stuck on the loading skeleton when the response data was identical.

Current constructor: `new DogTable(container, options)`.
Backward compatibility: `DataTable` is still exported as an alias.

## Quick Start

### Install

```bash
npm install dog-table
```

### Use with a bundler

```js
import { DogTable } from "dog-table";
import "dog-table/css";

const table = new DogTable("#app", {
  data: [
    { id: 1, name: "Mochi", age: 3, status: "Ready" },
    { id: 2, name: "Pepper", age: 5, status: "Pending" },
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "age", label: "Age", type: "number" },
    { key: "status", label: "Status" },
  ],
});

table.init();
```

### Use in the browser

```html
<link rel="stylesheet" href="https://unpkg.com/dog-table/dist/data-table.css" />
<div id="app"></div>
<script type="module">
  import { DogTable } from "https://unpkg.com/dog-table/dist/data-table.js";

  const table = new DogTable("#app", {
    data: [
      { id: 1, name: "Mochi", age: 3, status: "Ready" },
      { id: 2, name: "Pepper", age: 5, status: "Pending" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "age", label: "Age" },
      { key: "status", label: "Status" },
    ],
  });

  table.init();
</script>
```

## Features

- Client-side sorting, search, and pagination
- Optional pagination disablement for full-table rendering
- Remote data loading with abortable requests
- Remote query caching with shared dataset aliasing and per-query pagination state
- Modular core with dedicated state, data, rendering, event, and remote layers
- Inline editing with optional authenticated update requests
- **Premium Create Workflow:** Built-in modal with glassmorphism UI, horizontal row layouts, field validation, and local or remote submit flows
- Grouped rows and expandable detail panels
- Selection, CSV export, and state persistence
- **Smart Selection:** Indeterminate state support and multi-page "Select All" for local datasets
- `Intl`-powered formatting for money, dates, and numbers
- Optional pagination guardrails for max page and page-size bounds
- Theme presets for default, Bootstrap, and Tailwind-style class maps
- Localization support with bundled locale files
- Auto-refresh with adaptive backoff and live status UI
- **Optimized Performance:** Memoized data pipeline, `Intl` caching, and throttled persistence for smooth handling of large datasets

## Internal Architecture

`DogTable` remains the public controller, but refactors the implementation into focused modules:

- `src/core/DogTable.js`: orchestration and public API
- `src/core/TableState.js`: state mutation and pagination constraints
- `src/core/DataEngine.js`: filtering, sorting, pagination, and cache
- `src/core/EventBinder.js`: DOM event binding and teardown
- `src/data/RemoteAdapter.js`: remote fetch adapter
- `src/renderers/`: table, pagination, and meta UI renderers
- `src/plugin/PluginManager.js`: plugin bootstrapping for persistence, selection, export, formatting, editor, live, and create workflows

The public constructor and methods stay the same: `new DogTable(container, options)`.

## Examples

### 1. Basic Local Table

```js
const table = new DogTable("#app", {
  data: [
    { id: 1, name: "Mochi", breed: "Shiba Inu", age: 3, status: "Ready" },
    { id: 2, name: "Pepper", breed: "Border Collie", age: 5, status: "Pending" },
  ],
  columns: [
    { key: "name", label: "Name", sortable: true },
    { key: "breed", label: "Breed", sortable: true },
    { key: "age", label: "Age", type: "number", sortable: true },
    { key: "status", label: "Status" },
  ],
  pageSize: 5,
  searchable: true,
  pagination: true,
});

table.init();
```

### 2. Remote Data with API

```js
const table = new DogTable("#app", {
  remote: {
    url: "https://api.example.com/dogs",
    dataKey: "results",
    totalKey: "count",
    headers: { Authorization: "Bearer YOUR_TOKEN" },
    queryParams: {
      page: "page",
      pageSize: "limit",
      sort: "sort_by",
      order: "order",
      search: "q",
    },
  },
  columns: [
    { key: "name", label: "Name", sortable: true },
    { key: "breed", label: "Breed", sortable: true },
    { key: "age", label: "Age", type: "number" },
    { key: "status", label: "Status" },
  ],
  pageSize: 10,
});

table.init();
```

### 3. Inline Editing

```js
const table = new DogTable("#app", {
  data: [
    { id: 1, name: "Mochi", age: 3, status: "Ready" },
    { id: 2, name: "Pepper", age: 5, status: "Pending" },
  ],
  columns: [
    { key: "name", label: "Name", editable: true },
    { key: "age", label: "Age", type: "number", editable: true },
    { key: "status", label: "Status", editable: true },
  ],
  remote: {
    url: "https://api.example.com/dogs",
    update: {
      url: "https://api.example.com/dogs/{id}",
      method: "PUT",
      headers: { Authorization: "Bearer YOUR_TOKEN" },
      buildBody: (context) => JSON.stringify({ [context.field]: context.value }),
      mapResponse: (payload) => payload.data,
    },
  },
  hooks: {
    onUpdateSuccess: ({ rowId, field, value, row }) => {
      console.log(`Row ${rowId}: ${field} updated to ${value}`, row);
    },
  },
});

table.init();
```

### 4. Create New Records

```js
const table = new DogTable("#app", {
  data: [],
  columns: [
    { key: "name", label: "Name", required: true },
    { key: "breed", label: "Breed", required: true },
    { key: "age", label: "Age", type: "number", required: true },
    {
      key: "status",
      label: "Status",
      inputType: "select",
      options: ["Ready", "Pending", "Adopted"],
      defaultValue: "Ready",
    },
  ],
  create: {
    triggerLabel: "Add Dog",
    title: "Register New Dog",
    submitLabel: "Save Dog",
    initialValues: { status: "Ready" },
    remote: {
      url: "https://api.example.com/dogs",
      method: "POST",
      headers: { Authorization: "Bearer YOUR_TOKEN" },
      buildBody: (context) => JSON.stringify(context.data),
      mapResponse: (payload) => payload.data,
    },
    refetchAfterSubmit: true,
  },
});

table.init();
```

### 5. Row Selection & CSV Export

```js
const table = new DogTable("#app", {
  data: [
    { id: 1, name: "Mochi", breed: "Shiba Inu", age: 3 },
    { id: 2, name: "Pepper", breed: "Border Collie", age: 5 },
    { id: 3, name: "Buddy", breed: "Golden Retriever", age: 2 },
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "breed", label: "Breed" },
    { key: "age", label: "Age", type: "number" },
  ],
  selectable: true,
  rowKey: "id",
  hooks: {
    onSelectionChange: (selectedData) => {
      console.log("Selected rows:", selectedData);
    },
  },
});

table.init();

// API usage
table.getSelectedData();
table.exportCSV("dogs-export.csv");
```

### 6. Data Formatting (Money, Dates, Numbers)

```js
const table = new DogTable("#app", {
  data: [
    { id: 1, name: "Mochi", price: 1500.50, birthDate: "2021-03-15", weight: 12.5 },
  ],
  columns: [
    { key: "name", label: "Name" },
    {
      key: "price",
      label: "Price",
      type: "currency",
      currency: "USD",
      formatOptions: { minimumFractionDigits: 2 },
    },
    {
      key: "birthDate",
      label: "Birth Date",
      type: "date",
      formatOptions: { year: "numeric", month: "long", day: "numeric" },
    },
    {
      key: "weight",
      label: "Weight (kg)",
      type: "number",
      formatOptions: { minimumFractionDigits: 1 },
    },
  ],
});

table.init();
```

### 7. Grouped Rows

```js
const table = new DogTable("#app", {
  data: [
    { id: 1, name: "Mochi", breed: "Shiba Inu", category: "Small", age: 3 },
    { id: 2, name: "Pepper", breed: "Border Collie", category: "Medium", age: 5 },
    { id: 3, name: "Buddy", breed: "Golden Retriever", category: "Large", age: 2 },
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "breed", label: "Breed" },
    { key: "category", label: "Category" },
    { key: "age", label: "Age", type: "number" },
  ],
  groupBy: "category",
  groupLabel: (value, rows) => `${value} Dogs (${rows.length})`,
  initialSort: { key: "category", direction: "asc" },
});

table.init();
```

### 8. Expandable Row Details

```js
const table = new DogTable("#app", {
  data: [
    {
      id: 1,
      name: "Mochi",
      breed: "Shiba Inu",
      age: 3,
      description: "A loyal and spirited Shiba Inu.",
      owner: "John Doe",
    },
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "breed", label: "Breed" },
    { key: "age", label: "Age", type: "number" },
  ],
  rowDetail: {
    render: (row) => `
      <div class="dog-details">
        <p><strong>Description:</strong> ${row.description}</p>
        <p><strong>Owner:</strong> ${row.owner}</p>
      </div>
    `,
    toggleLabel: (row, isExpanded) => isExpanded ? "Hide Details" : "Show Details",
  },
});

table.init();

// Programmatic control
table.expandRowDetail(1);
table.collapseRowDetail(1);
```

### 9. State Persistence & Live Sync

```js
const table = new DogTable("#app", {
  remote: {
    url: "https://api.example.com/dogs",
    dataKey: "results",
    totalKey: "count",
  },
  columns: [
    { key: "name", label: "Name", sortable: true },
    { key: "breed", label: "Breed", sortable: true },
    { key: "age", label: "Age", type: "number" },
    { key: "status", label: "Status" },
  ],
  persistence: "local",
  persistenceKey: "my-dog-table",
  autoRefresh: 5000,
  hooks: {
    onBeforeRefresh: () => console.log("Refreshing data..."),
  },
});

table.init();

// Live sync controls
table.live.start();
table.live.stop();
table.live.toggle();
```

### 10. Custom Rendering, Sorting & Hooks

```js
const table = new DogTable("#app", {
  data: [
    { id: 1, name: "Mochi", breed: "Shiba Inu", age: 3, score: 85 },
    { id: 2, name: "Pepper", breed: "Border Collie", age: 5, score: 92 },
  ],
  columns: [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (value, row) => `<a href="/dogs/${row.id}">${value}</a>`,
    },
    {
      key: "age",
      label: "Age",
      sortable: true,
      sortValue: (value) => value * 7,
      render: (value) => `${value} years`,
    },
    {
      key: "score",
      label: "Score",
      sortable: true,
      render: (value) => `<div class="progress"><span>${value}%</span></div>`,
    },
  ],
  initialSort: { key: "score", direction: "desc" },
  searchDebounce: 300,
  theme: "default",
  paginationGuard: { maxPage: 50, minPageSize: 5, maxPageSize: 100 },
  hooks: {
    onInit: (state) => console.log("Table initialized", state),
    onUpdate: (processed) => console.log("Table updated", processed),
    onPageChange: (page) => console.log("Page:", page),
    onSortChange: ({ sortKey, sortDirection }) => console.log(`Sort: ${sortKey} (${sortDirection})`),
    onSearchChange: (query) => console.log("Search:", query),
    onFetchStart: () => console.log("Fetching..."),
    onFetchSuccess: (payload) => console.log("Loaded:", payload),
    onFetchError: (error) => console.error("Fetch failed:", error),
    onLoadingChange: (isLoading) => console.log("Loading:", isLoading),
    onDataUpdated: (rawData) => console.log("Data updated:", rawData.length, "rows"),
    onDestroy: () => console.log("Table destroyed"),
  },
});

table.init();

// Programmatic API
table.setPage(2);
table.setSearch("Mochi");
table.setSort("age", "asc");
table.setPageSize(10);
table.clearSearch();
table.clearSort();
table.reset();
table.setData(newData);
table.setColumns(newColumns);
table.setTheme("bootstrap");
table.destroy();
```

## Optional Pagination Guardrails

Use `paginationGuard` when you want to cap pagination and page size.

- `paginationGuard: true` enables defaults:
  - `maxPage: 25`
  - `minPageSize: 1`
  - `maxPageSize: 100`
- `paginationGuard: false` (default) keeps behavior unrestricted.
- You can pass an object to override the defaults.

```js
const table = new DogTable("#app", {
  data,
  pageSize: 10,
  paginationGuard: {
    maxPage: 25,
    minPageSize: 1,
    maxPageSize: 100,
  },
  columns: [
    { key: "name", label: "Name" },
    { key: "status", label: "Status" },
  ],
});
```

## Disable Pagination

Pagination stays enabled by default for backward compatibility. Set `pagination: false` to render all available rows and hide the pagination controls.

If you also pass `paginationGuard`, DogTable ignores it and prints a `console.warn`, because guardrails only apply when pagination is active.

```js
const table = new DogTable("#app", {
  data,
  pagination: false,
  columns: [
    { key: "name", label: "Name" },
    { key: "status", label: "Status" },
  ],
});
```

## Package Entry Points

- `dog-table` -> `dist/data-table.js`
- `dog-table/min` -> `dist/data-table.min.js`
- `dog-table/css` -> `dist/data-table.css`
- `dog-table/css/min` -> `dist/data-table.min.css`
- `dog-table/locale/*` -> `dist/locale/*.js`
- `dog-table/plugin/*` -> `dist/plugin/*.js`
- `dog-table/utils` -> `dist/utils/index.js`

Minified assets are generated by the build and published from `dist/`, not committed in `src/`.

## Localization

Use bundled locale files for i18n support.

```js
import { DogTable } from "dog-table";
import { de } from "dog-table/locale/de";

const table = new DogTable("#app", {
  data: [...],
  columns: [...],
  language: de,
});

table.init();
```

**Available locales:** `en`, `de`, `es`, `fr`, `id`, `zh-CN`

**Custom language override:**

```js
language: {
  search: "Suche",
  searchPlaceholder: "Suchbegriff eingeben...",
  emptyState: "Keine Daten vorhanden.",
  noResults: "Keine Ergebnisse gefunden",
  loading: "Daten werden geladen...",
  next: "Weiter",
  previous: "Zurück",
  showing: "Zeige {start}-{end} von {total}",
  page: "Seite {page} von {total}",
}
```

## Themes

Switch between built-in theme presets.

```js
theme: "default"     // Default theme
theme: "bootstrap"   // Bootstrap classes
theme: "tailwind"    // Tailwind classes
```

**Custom class overrides:**

```js
theme: "default",
classNames: {
  table: "my-custom-table",
  header: "my-custom-header",
  body: "my-custom-body",
}
```

## Utility Functions

Access built-in utilities.

```js
import { debounce, escapeHtml } from "dog-table/utils";

const debouncedSearch = debounce((query) => {
  console.log("Searching:", query);
}, 300);

const safe = escapeHtml("<script>alert('xss')</script>");
```

## Demos

- Demo gallery: [index.html](./index.html)
- Hosted demos: https://arrahmaan17.github.io/dog-table/
- Query cache guide: [demo/query-cache.html](./demo/query-cache.html)
- Example files: [`demo/`](./demo/basic.html)

## Documentation

- Full examples & API reference: [wiki/Examples.md](./wiki/Examples.md)
- Wiki home: [wiki/Home.md](./wiki/Home.md)
- Getting started: [wiki/Getting-Started.md](./wiki/Getting-Started.md)
- Configuration reference: [wiki/Configuration-Reference.md](./wiki/Configuration-Reference.md)
- API reference: [wiki/API-Reference.md](./wiki/API-Reference.md)
- Guides and examples: [wiki/Guides-and-Examples.md](./wiki/Guides-and-Examples.md)
- FAQ and troubleshooting: [wiki/FAQ-and-Troubleshooting.md](./wiki/FAQ-and-Troubleshooting.md)
- Architecture: [wiki/Architecture.md](./wiki/Architecture.md)
- Contributing: [wiki/Contributing.md](./wiki/Contributing.md)

## Contributing

Contributions are welcome. Open an issue for bugs or feature ideas, and use the contribution guide in [wiki/Contributing.md](./wiki/Contributing.md) before sending a pull request.

## License

MIT. See [LICENSE](./LICENSE).
