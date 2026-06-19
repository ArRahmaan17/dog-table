# Dog Table - Performance Improvement Plan

This document outlines performance optimizations for the Dog Table vanilla JavaScript library, organized by impact and implementation complexity.

---

## Execution Status

### Phase 1 (Quick Wins) - Done

- Request Debouncing (#4)
- Request Deduplication (#5)
- Memoize `buildDisplayRows()` (#8)
- Precompute Sort Keys (#11)
- `requestAnimationFrame` Batched Renders (#9)

### Phase 2 (Medium Effort, High Impact) - Done

- DOM Diffing (#2)
- Optimize `escapeHtml()` (#6)
- CSS `content-visibility` (#10)

### Phase 3 (Major Refactors) - Done

- Virtual Scrolling (#1)
- Web Workers (#3)
- Lazy Column Rendering (#7)

### Phase 4 (Nice to Have) - Done

- Map/Set Optimization (#12)

### Remaining

- None

---

## High Impact

### 1. Virtual Scrolling / Row Virtualization

**Problem:** Currently renders all rows on the current page via `innerHTML`/`DocumentFragment`. For large page sizes (100+ rows), this causes slow renders and high memory usage.

**Solution:** Only render visible rows plus a small buffer above and below the viewport. Recycle DOM nodes instead of recreating them every `update()` cycle.

**Files to modify:**
- `src/renderers/TableRenderer.js` - Replace full tbody rendering with virtual viewport
- `src/core/DataEngine.js` - Add viewport-aware row slicing
- `src/core/DogTable.js` - Add scroll event listener and viewport calculations

**Implementation approach:**
- Calculate visible row count from container height and row height
- Render only visible rows + buffer (e.g., 5 rows above/below)
- Use spacer elements to maintain correct scroll height
- On scroll, update which rows are rendered
- Reuse existing DOM nodes by updating content instead of recreating

**Estimated effort:** High (significant architectural change)

---

### 2. DOM Diffing Instead of Full Re-render

**Problem:** `TableRenderer.js` rebuilds the entire tbody on every update via `innerHTML`. DOM nodes are recreated each cycle, causing unnecessary layout thrashing and losing scroll position.

**Solution:** Implement a simple keyed diff to only update changed rows/cells. Preserves scroll position and avoids unnecessary DOM operations.

**Files to modify:**
- `src/renderers/TableRenderer.js` - Add diff algorithm for body rendering
- `src/core/DogTable.js` - Pass row keys for diffing

**Implementation approach:**
- Assign stable keys to each row (use `rowKey` option)
- On update, compare new displayRows with current DOM rows
- Only add, remove, or update rows that changed
- Use `textContent` updates for cell changes instead of `innerHTML`
- Batch DOM mutations using `DocumentFragment`

**Estimated effort:** Medium

---

### 3. Web Workers for Data Processing

**Problem:** `DataEngine.js` filtering, sorting, and pagination slicing run on the main thread. For datasets >10k rows, this blocks the UI and causes jank.

**Solution:** Move heavy data processing to a Web Worker to keep the UI responsive.

**Files to modify:**
- `src/core/DataEngine.js` - Add worker communication layer
- `src/workers/data-processor.js` (new) - Worker script for filtering/sorting

**Implementation approach:**
- Create a worker that receives rawData, columns, searchQuery, sortKey, sortDirection
- Worker performs filtering, sorting, and pagination slicing
- Post processed results back to main thread
- Show loading state while worker processes
- Fallback to main thread for small datasets (<1000 rows)
- Use `Transferable` objects for zero-copy data transfer when possible

**Estimated effort:** Medium-High

---

## Medium Impact

### 4. Request Debouncing for Remote Mode

**Problem:** Search input is debounced (250ms), but remote fetches are not. Rapid page changes or filter toggles trigger unnecessary network requests.

**Solution:** Add configurable debounce to `fetchData()` in remote mode.

**Files to modify:**
- `src/core/DogTable.js` - Add debounce wrapper to `fetchData()`
- `src/utils/index.js` - Reuse existing `debounce()` utility

**Implementation approach:**
- Add `fetchDebounce` option (default: 0 for backward compatibility)
- Wrap `fetchData()` calls with debounce when in remote mode
- Provide `table.fetchNow()` to bypass debounce when needed
- Ensure abort controller cancels debounced requests properly

**Estimated effort:** Low

---

### 5. Request Deduplication

**Problem:** Multiple simultaneous `update()` calls trigger multiple fetches. Previous ones are aborted via `AbortController`, but this is still wasteful.

**Solution:** Track in-flight requests and return existing promises instead of creating new ones.

**Files to modify:**
- `src/core/DogTable.js` - Track pending fetch promises
- `src/data/RemoteAdapter.js` - Add request deduplication cache

**Implementation approach:**
- Store a Map of pending fetch promises keyed by request URL/state
- When `fetchData()` is called, check if identical request is in-flight
- If yes, return the existing promise
- If no, create new request and store in Map
- Remove from Map when request completes or fails

**Estimated effort:** Low

---

### 6. Optimize escapeHtml() for Hot Paths

**Problem:** `escapeHtml()` is called for every cell in every render cycle. The current implementation uses multiple string replacements which can be slow for large tables.

**Solution:** Use a faster implementation or cache escaped values.

**Files to modify:**
- `src/utils/index.js` - Optimize `escapeHtml()` function
- `src/renderers/TableRenderer.js` - Consider caching escaped values

**Implementation approaches (choose one):**
- Use a single regex with alternation: `str.replace(/[&<>"']/g, m => escapeMap[m])`
- Cache escaped values per row/cell when data hasn't changed
- Use `textContent` assignment instead of HTML escaping where possible

**Estimated effort:** Low

---

### 7. Column Visibility / Lazy Column Rendering

**Problem:** All columns are rendered regardless of visibility, including off-screen columns in wide tables.

**Solution:** Render only visible columns initially. Defer off-screen columns using `IntersectionObserver`.

**Files to modify:**
- `src/renderers/TableRenderer.js` - Add lazy column rendering
- `src/core/DogTable.js` - Add IntersectionObserver setup

**Implementation approach:**
- Detect which columns are visible in viewport
- Render visible columns immediately
- Use `IntersectionObserver` to load off-screen columns when they scroll into view
- Add placeholder content for unloaded columns

**Estimated effort:** Medium

---

## Low Impact / Nice to Have

### 8. Memoize buildDisplayRows() in DataEngine

**Problem:** `buildDisplayRows()` rebuilds display row wrappers every cycle, even when `rawData` hasn't changed.

**Solution:** Cache based on `rawData` reference equality.

**Files to modify:**
- `src/core/DataEngine.js` - Add memoization for `buildDisplayRows()`

**Implementation approach:**
- Store last `rawData` reference and cached `displayRows`
- Only rebuild when `rawData` reference changes
- Add cache invalidation when grouping configuration changes

**Estimated effort:** Low

---

### 9. Use requestAnimationFrame for Batched Renders

**Problem:** Multiple `update()` calls in quick succession cause multiple renders per frame, leading to layout thrashing.

**Solution:** Queue multiple `update()` calls and render once per animation frame.

**Files to modify:**
- `src/core/DogTable.js` - Add rAF-based render queue

**Implementation approach:**
- Track pending update flag
- On `update()`, if already pending, skip
- Use `requestAnimationFrame` to schedule next render
- Process all queued state changes in single render

**Estimated effort:** Low

---

### 10. CSS content-visibility: auto for Row Groups

**Problem:** Browser renders all row groups even when off-screen.

**Solution:** Apply `content-visibility: auto` to grouped sections to let browser skip off-screen rendering natively.

**Files to modify:**
- `src/data-table.css` - Add `content-visibility: auto` to group containers
- `src/renderers/TableRenderer.js` - Add estimated height for groups

**Implementation approach:**
- Add `content-visibility: auto` CSS property to group wrapper elements
- Set `contain-intrinsic-size` to estimated group height
- Browser will skip rendering off-screen groups

**Estimated effort:** Low

---

### 11. Precompute Sort Keys

**Problem:** During sorting, `sortValue` or property access is called for each comparison, resulting in O(n log n) property accesses.

**Solution:** Extract and cache sort values per row before sorting, instead of accessing object properties during each comparison.

**Files to modify:**
- `src/core/DataEngine.js` - Precompute sort values in `sortRows()`

**Implementation approach:**
- Before sorting, map each row to `{ row, sortValue }`
- Sort the mapped array using precomputed values
- Extract rows from sorted mapped array
- Reduces property access from O(n log n) to O(n)

**Estimated effort:** Low

---

### 12. Use Map/Set for Large Dataset Lookups

**Problem:** Selection plugin and grouping logic may do linear scans through arrays for lookups.

**Solution:** Switch to `Set` for O(1) lookups where applicable.

**Files to modify:**
- `src/plugin/selection.js` - Already uses Set for `selectedRows` (good)
- `src/core/DataEngine.js` - Consider Set for grouping lookups

**Implementation approach:**
- Review all array `.find()`, `.includes()`, `.filter()` patterns
- Replace with `Map`/`Set` lookups where doing repeated searches
- Already done for `selectedRows` and `expandedRowIds` in `TableState`

**Estimated effort:** Low

---

## Priority Recommendation

**Phase 1 (Quick Wins):**
1. Request Debouncing (#4)
2. Request Deduplication (#5)
3. Memoize buildDisplayRows() (#8)
4. Precompute Sort Keys (#11)
5. requestAnimationFrame Batched Renders (#9)

**Phase 2 (Medium Effort, High Impact):**
6. DOM Diffing (#2)
7. Optimize escapeHtml() (#6)
8. CSS content-visibility (#10)

**Phase 3 (Major Refactors):**
9. Virtual Scrolling (#1)
10. Web Workers (#3)
11. Lazy Column Rendering (#7)

**Phase 4 (Nice to Have):**
12. Map/Set Optimization (#12)
