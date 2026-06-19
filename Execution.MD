# Execution Tracker

Compared against `PLAN.md` and the current source code.

## PLAN.md Phase Status

### Phase 1 (Quick Wins)

1. Request Debouncing (#4) - Done
   - `DogTable` exposes `fetchDebounce`, creates `_debouncedFetch`, and provides `fetchNow()`.

2. Request Deduplication (#5) - Done
   - `DogTable` tracks the active request key so identical in-flight fetches share work while different request keys can supersede stale work.
   - `RemoteAdapter` keeps a `pendingRequests` map keyed by request URL and returns the existing promise for identical in-flight requests.

3. Memoize `buildDisplayRows()` (#8) - Done
   - Memoization exists in `DataEngine`.
   - Cache reuse is scoped to the current displayed row sequence plus grouping inputs, so local pagination cannot reuse stale display rows when the current page changes.
   - `demo/pagination-guard.html` includes a local cache check for this behavior.

4. Precompute Sort Keys (#11) - Done
   - `sortRows()` maps rows to `{ row, sortValue }` before sorting.

5. `requestAnimationFrame` Batched Renders (#9) - Done
   - `update()` batches work behind one shared `requestAnimationFrame` promise.
   - Repeated callers reuse the scheduled update promise instead of polling frame-to-frame.
   - `updateSync()` remains available for immediate render compatibility, but now shares any active update promise.

### Phase 2 (Medium Effort, High Impact)

6. DOM Diffing (#2) - Done
   - `TableRenderer` keeps keyed nodes for group rows, data rows, and detail rows.
   - Unchanged row order updates in place; order or expansion changes rebuild through a `DocumentFragment`.

7. Optimize `escapeHtml()` (#6) - Done
   - `escapeHtml()` already uses a single regex replacement map.
   - Further caching is optional, not required for this phase.

8. CSS `content-visibility` (#10) - Done
   - `.dt-group-row` uses `content-visibility: auto` and `contain-intrinsic-size` for grouped rows.

### Phase 3 (Major Refactors)

9. Virtual Scrolling (#1) - Done
   - `virtualScroll` is opt-in and delegates processed display rows to `VirtualScroller`.
   - `TableRenderer.renderStructure()` now assigns `elements.tableWrap` for scroll handling.

10. Web Workers (#3) - Done
    - `dataWorker` is opt-in for eligible large local datasets.
    - Worker processing returns row indexes so main-thread row object references remain stable.

11. Lazy Column Rendering (#7) - Done
    - `lazyColumns` is opt-in and adds browser-native lazy painting hints to table header/body cells.

### Phase 4 (Nice to Have)

12. Map/Set Optimization (#12) - Done
    - `selectedRows` and `expandedRowIds` already use `Set`.
    - `DogTable` now caches column lookups and row-id lookups with `Map`.
    - Editable-cell lookup uses `getColumnByField()` and `getRowById()` instead of repeated array scans.

## Phase 2 Cache + Pagination Status

The cache/pagination principle below is mostly implemented:

- `RemoteAdapter` separates `dataCache`, `requestCache`, and `queryCache`.
- `queryCache` stores pagination per query through `savePagination()`.
- `rememberQueryPagination()` and `restoreQueryPagination()` preserve query-specific pagination across remote search/sort/page-size changes.

Remaining issues:

- `requestCache` is currently write-only.
- Cache maps are unbounded, so long-lived live-sync or remote sessions can grow memory indefinitely.
- `stableSerialize(rows)` deeply serializes every remote response, which can become expensive for large payloads.
- Pagination integrity depends on `rememberQueryPagination()` being called after render; add focused regression coverage for identical data returned by different queries with different pages/page sizes.

---

# Phase 2: Caching + Pagination (Revised Plan)

## 1. Core Principle

Separate **data** from **pagination state** at all times:

* **Data layer** → can be reused, shared, or aliased
* **Pagination layer** → must remain independent per query

Never mix or couple these two.

---

## 2. Cache Optimization (Data Layer)

### Goal

Avoid duplicating identical datasets in memory.

### Rule

If two queries return **deeply equal data**:

* Store dataset once as a **base cache**
* Other queries should **reference (alias)** this dataset
* Do NOT clone or duplicate data

### Example

```js
Query A → dataHash: "abc123"
Query B → dataHash: "abc123"

Result:
cache.data["abc123"] = dataset
cache.query["A"].dataRef = "abc123"
cache.query["B"].dataRef = "abc123"
```

---

## 3. Pagination Integrity (State Layer)

### Critical Rule

Pagination must ALWAYS exist per query—even if data is shared.

Each query must store its own:

* `page`
* `pageSize`
* `totalItems`
* `totalPages`

### Important

Never reuse or share pagination between queries.

### Example

```js
cache.query["A"].pagination = { page: 1, pageSize: 10, totalItems: 100 }
cache.query["B"].pagination = { page: 2, pageSize: 20, totalItems: 100 }
```

Even if both use the same dataset → pagination stays different.

---

## 4. Separation of Concerns (Strict)

| Concern    | Behavior           |
| ---------- | ------------------ |
| Data       | Shared / aliased   |
| Pagination | Isolated per query |

Think of it like:

* Data = **read-only shared resource**
* Pagination = **query-specific UI state**

---

## 5. Expected Behavior

Users must ALWAYS be able to:

* Navigate pages normally
* Change page size
* See correct totals
* Switch between queries without losing state

This must work even when:

* Data is reused
* Cache aliasing is active

---

## 6. Anti-Bug Rule (Critical)

### Problem to prevent:

> “Pagination disappears after identical results are cached”

### Root Cause:

Pagination tied to dataset instead of query.

### Fix:

* Never derive pagination from cached data
* Never skip pagination initialization
* Never overwrite pagination when aliasing data

---

## 7. Safe Implementation Pattern

### Data Cache

```js
cache.data[dataHash] = dataset
```

### Query Cache

```js
cache.query[queryKey] = {
  dataRef: dataHash,
  pagination: {
    page,
    pageSize,
    totalItems,
    totalPages
  }
}
```

---

## 8. Guardrails (Must Enforce)

* ❌ Do NOT remove pagination when data is reused

* ❌ Do NOT share pagination across queries

* ❌ Do NOT assume identical data = identical pagination

* ❌ Do NOT skip pagination initialization

* ✅ ALWAYS attach pagination to queryKey

* ✅ ALWAYS preserve pagination state

* ✅ ALWAYS allow independent page navigation

---

## 9. Mental Model

If you remember one thing:

> **Same data ≠ same user view**

Two queries can show the same dataset but still behave differently due to pagination.
