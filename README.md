# Dog Table

Lightweight vanilla JavaScript data table for apps that need a clean API, remote data support, and useful built-in behaviors without pulling in a full framework.

## Why Dog Table?

Dog Table is built around a straightforward constructor API and a modular internal architecture. It gives you the essentials out of the box:

- Sorting, filtering, and debounced search
- Pagination for local or remote data
- Abortable remote fetching with `fetch()`
- Row grouping and expandable detail panels
- State persistence via URL or storage
- Multi-selection and bulk actions
- CSV export
- Inline editing
- Formatter helpers for money, date, and number values
- Theme presets with overridable class maps
- Auto-refresh with adaptive backoff and live status
- Lifecycle hooks and public API methods

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Guides](#guides)
- [Configuration Reference](#configuration-reference)
- [API Reference](#api-reference)
- [Demos](#demos)

---

## Installation

```bash
npm install dog-table
```

---

## Quick Start

### Browser (ES Modules)

```html
<link rel="stylesheet" href="https://unpkg.com/dog-table/src/data-table.css" />
<div id="app"></div>
<script type="module">
  import { DataTable } from "https://unpkg.com/dog-table/src/data-table.js";

  const table = new DataTable("#app", {
    data: [
      { id: 1, name: "Mochi", age: 3, status: "ready" },
      { id: 2, name: "Pepper", age: 5, status: "pending" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "age", label: "Age", type: "number" },
      { key: "status", label: "Status" },
    ],
  });

  table.init();
</script>
```

### Bundlers (Vite, Webpack, and others)

```js
import { DataTable } from "dog-table";
import "dog-table/css";

const table = new DataTable("#app", {
  data: [
    { name: "Mochi", age: 3, status: "ready" },
    { name: "Pepper", age: 5, status: "pending" },
  ],
  columns: [
    { key: "name", label: "Name" },
    { key: "age", label: "Age" },
    { key: "status", label: "Status" },
  ],
});

table.init();
```

---

## Core Concepts

### Local Data

Pass `data` and `columns` to render a client-side table with built-in sorting, search, and pagination.

### Remote Data

Pass a `remote` config to fetch server data. Page changes, search updates, and sorting will trigger new requests automatically.

### Columns

Columns control how values are read, formatted, searched, sorted, and rendered.

### Hooks

Hooks let you tap into lifecycle events such as fetch start, fetch success, selection changes, and rerenders.

---

## Guides

### Remote Data

```js
const table = new DataTable("#app", {
  columns: [
    { key: "name", label: "Name" },
    { key: "age", label: "Age" },
  ],
  remote: {
    url: "/api/dogs",
    queryParams: {
      page: "page",
      pageSize: "limit",
      sort: "sort",
      order: "order",
      search: "q",
    },
    mapResponse(payload) {
      return {
        rows: payload.items,
        totalItems: payload.total,
      };
    },
  },
});

table.init();
```

When `remote` is enabled, Dog Table cancels previous in-flight requests with `AbortController` so rapid interactions do not render stale responses.

### Grouping and Row Detail

```js
const table = new DataTable("#app", {
  rowKey: "id",
  groupBy: "region",
  groupLabel(region, rows) {
    return `${region} Region - ${rows.length} dogs`;
  },
  rowDetail: {
    toggleLabel(row, expanded) {
      return expanded ? `Hide ${row.name}` : `About ${row.name}`;
    },
    render(row) {
      return `${row.name} is fostered by ${row.foster}`;
    },
  },
  columns: [
    { key: "name", label: "Name" },
    { key: "region", label: "Region" },
    { key: "foster", label: "Foster" },
  ],
});
```

Grouping inserts separator rows inside `<tbody>`, and detail content is only rendered when a row is expanded.

### Themes

- `theme: "default"` uses the bundled stylesheet in [src/data-table.css](/home/mann/Development/dog-table/src/data-table.css:1)
- `theme: "bootstrap"` maps table elements to Bootstrap-friendly class names
- `theme: "tailwind"` maps table elements to Tailwind-style utility classes
- `classNames` lets you append or override individual theme slots

Bootstrap and Tailwind presets only provide class mappings. You still need to load the framework CSS in your app.

### Localization

Use the `language` object to translate or customize the UI text:

```js
const table = new DataTable("#app", {
  language: {
    search: "Search",
    searchPlaceholder: "Search...",
    emptyState: "No data to display.",
    noResults: "No matching rows",
    loading: "Loading data...",
    error: "Something went wrong while loading data.",
    next: "Next",
    previous: "Prev",
    showing: "Showing {start}-{end} of {total}",
    page: "Page {page} of {total}",
    details: "Details",
    showDetails: "Show details",
    hideDetails: "Hide details",
    ungrouped: "Ungrouped",
  },
});
```

Placeholders like `{start}`, `{end}`, `{total}`, and `{page}` are replaced automatically.

Predefined locales are available as imports:

```js
import { es } from "dog-table/locale/es";

const table = new DataTable("#app", { language: es });
```

Available locales: `en`, `es`, `fr`, `de`, `zh-CN`, `id`.

### State Persistence

Keep page, search, and sort state synchronized with the URL or browser storage:

```js
const table = new DataTable("#app", {
  persistence: "url", // or "local" / "session"
  persistenceKey: "user-table",
});
```

Using `"url"` makes filtered and sorted views shareable via query string.

---

## Configuration Reference

### Table Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `data` | `Array<object>` | `[]` | Raw row data. |
| `columns` | `Array<object>` | `[]` | Column definitions. |
| `pageSize` | `number` | `5` | Number of rows per page. |
| `searchable` | `boolean` | `true` | Show or hide the built-in search input. |
| `searchDebounce` | `number` | `250` | Delay in milliseconds before search triggers an update. |
| `autoRefresh` | `number \| null` | `null` | Base polling interval for remote data. Identical API responses back off the next refresh up to `4x`, reset when the payload changes, and pause while the page is hidden. |
| `language` | `object` | `{...}` | Custom text for all UI elements. |
| `initialSort` | `object \| null` | `null` | Initial sort config such as `{ key, direction }`. |
| `theme` | `string \| object` | `"default"` | Theme preset name or custom theme map. |
| `classNames` | `object` | `{}` | Additional class mappings merged into the active theme. |
| `remote` | `object \| null` | `null` | Enables server-side data loading through `fetch()`. |
| `groupBy` | `string \| function \| null` | `null` | Groups processed rows before rendering. |
| `groupLabel` | `function \| null` | `null` | Custom label builder for each group header row. |
| `rowKey` | `string \| function \| null` | `null` | Stable identifier used for row detail expansion state. |
| `rowDetail` | `object \| null` | `null` | Enables expandable detail rows with lazy content rendering. |
| `persistence` | `string \| null` | `null` | Sync state with `"url"`, `"local"`, or `"session"`. |
| `persistenceKey` | `string \| null` | `null` | Unique key for storage or URL prefix. |
| `selectable` | `boolean` | `false` | Enable row selection with checkboxes. |
| `hooks` | `object` | `{}` | Event callbacks for table lifecycle updates. |

### Column Definition

Each column object supports:

- `accessor`: property name to read from each row, preferred over `key`
- `key`: legacy property name for data retrieval
- `label`: header text, defaults to `accessor`
- `type`: automatic formatting type such as `"money"`, `"datetime"`, or `"number"`
- `format`: options object passed to the `Intl` formatter
- `currency`: currency code for `"money"` columns, for example `"USD"` or `"IDR"`
- `locale`: locale override for this column, for example `"id-ID"`
- `editable`: set to `true` to enable inline editing
- `sortable`: set to `false` to disable sorting for the column
- `searchable`: set to `false` to exclude the column from built-in search
- `sortValue(value, row)`: map cell data before sorting
- `filter({ value, row, query })`: custom per-column search matcher
- `render(value, row)`: custom cell renderer
- `visible`: set to `false` to hide the column by default

### Remote Config

The `remote` object supports:

- `url`: endpoint to request
- `method`: HTTP method, defaults to `GET`
- `headers`: optional request headers
- `queryParams`: rename generated query keys for `page`, `pageSize`, `sort`, `order`, and `search`
- `buildQuery(params, state)`: final chance to customize the query string
- `dataKey`: payload property containing rows when not using `mapResponse`
- `totalKey`: payload property containing total row count when not using `mapResponse`
- `mapResponse(payload, state)`: transform any API response into `{ rows, totalItems }`

### Row Detail Config

The `rowDetail` object supports:

- `render(row, helpers)`: required function that builds the detail content
- `toggleLabel(row, expanded)`: optional function for the detail button label

`helpers` includes `expand()`, `collapse()`, and `toggle()` methods for the active row.

### Hooks

- `onInit(state)`: runs after the table is initialized
- `onLoadingChange(isLoading)`: runs when loading state changes
- `onFetchStart(state)`: runs right before a remote request starts
- `onFetchSuccess(payload)`: runs after a successful remote response
- `onFetchError(error)`: runs when a remote request fails
- `onBeforeRefresh()`: runs right before an auto-refresh polling request
- `onDataUpdated(rawData)`: runs whenever the underlying data changes through fetch or edit
- `onRowToggle({ rowId, expanded })`: runs when a detail row is expanded or collapsed
- `onPageChange(page)`: runs when the current page changes
- `onSortChange({ sortKey, sortDirection })`: runs when sorting changes
- `onSearchChange(query)`: runs when the search query changes
- `onCellSave(id, field, value)`: triggered when an inline edit is saved
- `onSelectionChange(selectedData)`: triggered when row selection changes
- `onUpdate(payload)`: runs after each render with processed table metadata
- `onDestroy()`: runs when `destroy()` is called

---

## API Reference

### Public API

- `init()`: render the table and bind events
- `setData(data)`: replace table rows and re-render
- `setColumns(columns)`: replace column definitions and re-render
- `setSearch(query)`: update the search filter
- `clearSearch()`: clear the search filter
- `setPage(pageNumber)`: jump to a specific page
- `setPageSize(pageSize)`: update pagination size
- `setSort(sortKey, direction)`: programmatically change sorting
- `clearSort()`: remove active sorting
- `setLanguage(language)`: update UI text dynamically
- `toggleRowDetail(rowId)`: expand or collapse a row detail panel
- `expandRowDetail(rowId)`: expand a specific row detail panel
- `collapseRowDetail(rowId)`: collapse a specific row detail panel
- `getSelectedData()`: return the array of currently selected rows
- `selectAll(checked)`: select or deselect all visible rows
- `toggleRowSelection(rowId, checked)`: toggle selection for a specific row
- `toggleColumnVisibility(key, visible)`: show or hide a column
- `exportCSV(filename?)`: download the current data as a CSV file
- `setTheme(theme, classNames?)`: swap the active theme mapping
- `getProcessedData()`: return the current filtered, sorted, and paginated result
- `getState()`: return a shallow copy of current internal state
- `reset()`: clear search, sort, and return to page `1`
- `destroy()`: remove event listeners and clear the container

---

## Demos

Open [demo/index.html](./demo/index.html) in a browser to browse the gallery.

Additional examples:

- [demo/basic.html](./demo/basic.html): local data, sorting, search, pagination, and formatted cells
- [demo/custom-cells.html](./demo/custom-cells.html): DOM-node rendering, custom filters, and richer cell content
- [demo/themes.html](./demo/themes.html): live theme switching across `default`, `bootstrap`, and `tailwind`
- [demo/remote.html](./demo/remote.html): mocked remote API with loading, abortable requests, and server-side pagination
- [demo/grouping-detail.html](./demo/grouping-detail.html): grouped rows plus lazily rendered expandable detail panels
- [demo/localization.html](./demo/localization.html): translated and customized table labels
- [demo/live-sync.html](./demo/live-sync.html): adaptive auto-refresh with live status and timeout backoff

---

## License

MIT
