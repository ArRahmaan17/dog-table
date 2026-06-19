export const features = [
  {
    title: "State and views",
    text: "Columns can start hidden, be shown or hidden at runtime, persist as named views, and optionally sync search, sort, page, filters, and visibility into the URL.",
    code: "table.saveView('ops'); table.loadView('ops')",
  },
  {
    title: "Structured filters",
    text: "Global search remains unchanged. Field filters live in state, render through filterRow, run locally, and serialize into remote query parameters.",
    code: "table.setFilters({ status: 'active' })",
  },
  {
    title: "Remote workflows",
    text: "Remote mode supports page or cursor pagination, request dedupe, aborts, authenticated create/update requests, optimistic updates, and local snapshot mutations.",
    code: "remote: { pagination: 'cursor' }",
  },
  {
    title: "Layout controls",
    text: "Sticky headers, left sticky columns, resize handles, and header drag reorder are all opt-in and stored in table state for persistence.",
    code: "stickyColumns: ['id'], resizableColumns: true",
  },
  {
    title: "Aggregates",
    text: "Footer aggregates compute from filtered local rows or from remote mapped response metadata. Group rows can show local group aggregate summaries.",
    code: "footerAggregates: { amount: 'sum' }",
  },
  {
    title: "Events and plugins",
    text: "The event API emits state, row, and fetch events. Plugins can be registered globally with DogTable.use or per instance through plugins.",
    code: "table.on('state:change', handler)",
  },
];

export const options = [
  ["data", "Local row array copied into table state."],
  ["columns", "Column definitions using key or accessor, plus label, type, hidden, editable, render, format, filters, and create metadata."],
  ["remote", "Remote fetch configuration with url, method, headers, credentials, query params, mapResponse, cursor pagination, create, and update."],
  ["pagination / pageSize", "Local and remote pagination controls. pagination: false renders the whole current dataset."],
  ["searchable / searchDebounce", "Search toolbar and debounce timing for global search."],
  ["filterRow / filterDebounce", "Header filters backed by table.setFilters."],
  ["persistence / persistenceKey", "Local, session, or URL persistence for the serializable table state."],
  ["urlState", "Readable query-string sync for search, page, pageSize, sort, hidden columns, and filters."],
  ["stickyHeader / stickyColumns", "CSS sticky layout for headers and selected left columns."],
  ["resizableColumns / columnReorder", "Header resize handles and drag-to-reorder columns."],
  ["footerAggregates / groupAggregates", "sum, avg, min, max, and count aggregate rendering."],
  ["optimisticUpdates", "Apply create/edit mutations before remote completion and revert on failure."],
  ["plugins", "Per-instance plugins with install(table) and optional destroy(table)."],
];

export const methods = [
  "init()",
  "update()",
  "fetchNow()",
  "setData(rows)",
  "setColumns(columns)",
  "setSearch(query)",
  "setFilters(filters)",
  "clearFilters()",
  "showColumn(key)",
  "hideColumn(key)",
  "toggleColumn(key)",
  "saveView(name)",
  "loadView(name)",
  "deleteView(name)",
  "addRow(row)",
  "updateRow(id, patch)",
  "removeRow(id)",
  "exportCSV(filename)",
  "on(event, fn)",
  "off(event, fn)",
  "destroy()",
];

export const events = [
  "state:change",
  "row:add",
  "row:update",
  "row:remove",
  "fetch:start",
  "fetch:success",
  "fetch:error",
];
