# Dog Table

Lightweight vanilla JavaScript data table with:

- constructor-based initialization
- theme presets with overridable class maps
- sorting
- search filtering
- debounced search input
- pagination
- remote data loading with abortable `fetch()`
- row grouping
- expandable row detail panels
- column render callbacks
- custom filter and sort accessors per column
- lifecycle hooks
- public API methods for data and state updates

## Installation

```bash
npm install dog-table
```

## Usage

### In a browser (ES Modules)

```html
<link rel="stylesheet" href="https://unpkg.com/dog-table/src/data-table.css" />
<div id="app"></div>
<script type="module">
  import { DataTable } from "https://unpkg.com/dog-table/src/data-table.js";

  const table = new DataTable("#app", {
    // ... config
  });
  table.init();
</script>
```

### With a Bundler (Vite, Webpack, etc.)

```js
import { DataTable } from 'dog-table';
import 'dog-table/css';

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

## Remote Data

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

When `remote` is enabled, page changes, search, and sorting trigger `fetch()` requests. Previous in-flight requests are cancelled with `AbortController` so rapid interaction does not render stale results.

## Grouping and Row Detail

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

Grouping inserts separator rows inside `<tbody>`, and row detail renders lazily only after the user expands a row. Sortable headers also support keyboard activation via `Enter` and `Space`.

## Themes

- `theme: "default"` uses the bundled stylesheet in [src/data-table.css](/home/mann/Development/dog-table/src/data-table.css:1)
- `theme: "bootstrap"` maps table elements to Bootstrap-friendly class names
- `theme: "tailwind"` maps table elements to Tailwind-style utility classes
- `classNames` lets you append or override specific theme slots

Bootstrap and Tailwind presets only provide class mappings. You still need to load the actual framework CSS in your app.

## Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `data` | `Array<object>` | `[]` | Raw row data. |
| `columns` | `Array<object>` | `[]` | Column definitions. |
| `pageSize` | `number` | `5` | Number of rows per page. |
| `searchable` | `boolean` | `true` | Show or hide the built-in search input. |
| `searchDebounce` | `number` | `250` | Delay in milliseconds before search triggers an update. |
| `searchPlaceholder` | `string` | `"Search..."` | Placeholder text for the search input. |
| `emptyStateText` | `string` | `"No data to display."` | Message shown when the data source is empty. |
| `noResultsText` | `string` | `"No matching rows"` | Message shown when search returns no rows. |
| `loadingText` | `string` | `"Loading data..."` | Message shown while remote data is loading. |
| `errorText` | `string` | `"Something went wrong while loading data."` | Fallback message for remote fetch errors. |
| `initialSort` | `object \| null` | `null` | Initial sort config like `{ key, direction }`. |
| `theme` | `string \| object` | `"default"` | Theme preset name or custom theme map. |
| `classNames` | `object` | `{}` | Additional class mappings merged into the active theme. |
| `remote` | `object \| null` | `null` | Enables server-side data loading through `fetch()`. |
| `groupBy` | `string \| function \| null` | `null` | Groups processed rows before rendering. |
| `groupLabel` | `function \| null` | `null` | Custom label builder for each group header row. |
| `rowKey` | `string \| function \| null` | `null` | Stable identifier used for row detail expansion state. |
| `rowDetail` | `object \| null` | `null` | Enables expandable detail rows with lazy content rendering. |
| `hooks` | `object` | `{}` | Event callbacks for table lifecycle updates. |

## Column Definition

Each column object supports:

- `key`: property name to read from each row
- `label`: header text, defaults to `key`
- `sortable`: set to `false` to disable sorting for that column
- `searchable`: set to `false` to exclude a column from built-in search
- `sortValue(value, row)`: map cell data before sorting
- `filter({ value, row, query })`: custom per-column search matcher
- `render(value, row)`: custom cell formatter, may return text or a DOM `Node`

## Remote Config

`remote` supports:

- `url`: endpoint to request
- `method`: HTTP method, defaults to `GET`
- `headers`: optional request headers
- `queryParams`: rename generated query keys for `page`, `pageSize`, `sort`, `order`, and `search`
- `buildQuery(params, state)`: final chance to customize the query string
- `dataKey`: payload property containing rows when not using `mapResponse`
- `totalKey`: payload property containing total row count when not using `mapResponse`
- `mapResponse(payload, state)`: transform any API response into `{ rows, totalItems }`

## Row Detail Config

`rowDetail` supports:

- `render(row, helpers)`: required function to build the detail content
- `toggleLabel(row, expanded)`: optional function for the detail button label

`helpers` includes `expand()`, `collapse()`, and `toggle()` methods for the active row.

## Hooks

- `onInit(state)`: runs after the table is initialized
- `onLoadingChange(isLoading)`: runs when loading state changes
- `onFetchStart(state)`: runs right before a remote request starts
- `onFetchSuccess(payload)`: runs after a successful remote response
- `onFetchError(error)`: runs when a remote request fails
- `onRowToggle({ rowId, expanded })`: runs when a detail row is expanded or collapsed
- `onPageChange(page)`: runs when the current page changes
- `onSortChange({ sortKey, sortDirection })`: runs when sorting changes
- `onSearchChange(query)`: runs when the search query changes
- `onUpdate(payload)`: runs after each render with processed table metadata
- `onDestroy()`: runs when `destroy()` is called

## Public API

- `init()`: render the table and bind events
- `setData(data)`: replace table rows and re-render
- `setColumns(columns)`: replace column definitions and re-render
- `setSearch(query)`: update the search filter
- `clearSearch()`: clear the search filter
- `setPage(pageNumber)`: jump to a specific page
- `setPageSize(pageSize)`: update pagination size
- `setSort(sortKey, direction)`: programmatically change sorting
- `clearSort()`: remove active sorting
- `toggleRowDetail(rowId)`: expand or collapse a row detail panel
- `expandRowDetail(rowId)`: expand a specific row detail panel
- `collapseRowDetail(rowId)`: collapse a specific row detail panel
- `setTheme(theme, classNames?)`: swap the active theme mapping and re-render
- `getProcessedData()`: return the current filtered, sorted, paginated result
- `getState()`: return a shallow copy of current internal state
- `reset()`: clear search, sort, and return to page 1
- `destroy()`: remove event listeners and clear the container

## Demo

Open [demo/index.html](./demo/index.html) in a browser for the gallery.

Additional examples:

- [demo/basic.html](./demo/basic.html): local data, sorting, search, pagination, and formatted cells
- [demo/custom-cells.html](./demo/custom-cells.html): DOM-node rendering, custom filters, and richer cell content
- [demo/themes.html](./demo/themes.html): live theme switching across `default`, `bootstrap`, and `tailwind`
- [demo/remote.html](./demo/remote.html): mocked remote API with loading, abortable fetch requests, and server-side pagination
- [demo/grouping-detail.html](./demo/grouping-detail.html): grouped rows plus lazily rendered expandable detail panels
