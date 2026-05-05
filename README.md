# Dog Table

[![npm version](https://img.shields.io/npm/v/dog-table)](https://www.npmjs.com/package/dog-table)
[![license](https://img.shields.io/npm/l/dog-table)](./LICENSE)
[![demo site](https://img.shields.io/badge/demo-live-0f766e)](https://arrahmaan17.github.io/dog-table/)

Dog Table is a lightweight vanilla JavaScript data table library for projects that want a clean API, useful built-in features, and no framework lock-in. It supports local data, remote fetching, inline editing, create workflows, selection, formatting, grouping, localization, and live sync in one package.

The README is the fast path. If you want deeper setup guides, API details, troubleshooting, or architecture notes, use the wiki pages in [`wiki/`](./wiki/Home.md).

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

`DogTable` remains the public controller, but  refactors the implementation into focused modules:

- `src/core/DogTable.js`: orchestration and public API
- `src/core/TableState.js`: state mutation and pagination constraints
- `src/core/DataEngine.js`: filtering, sorting, pagination, and cache
- `src/core/EventBinder.js`: DOM event binding and teardown
- `src/data/RemoteAdapter.js`: remote fetch adapter
- `src/renderers/`: table, pagination, and meta UI renderers
- `src/plugin/PluginManager.js`: plugin bootstrapping for persistence, selection, export, formatting, editor, live, and create workflows

The public constructor and methods stay the same: `new DogTable(container, options)`.

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

## Demos

- Demo gallery: [index.html](./index.html)
- Hosted demos: https://arrahmaan17.github.io/dog-table/
- Example files: [`demo/`](./demo/basic.html)

## Documentation

- Latest docs (v2, `DogTable`): [docs.html](./docs.html)
- Legacy docs (v1, `DataTable`): [docs-v1.html](./docs-v1.html)
- Query cache guide: [query-cache.html](./query-cache.html)
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
