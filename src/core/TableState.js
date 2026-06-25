const DEFAULT_PAGE_SIZE = 5;

function normalizeColumns(columns) {
  return Array.isArray(columns)
    ? columns.map((column) => ({
        ...column,
        visible: column.hidden === true ? false : column.visible,
      }))
    : [];
}

export class TableState {
  constructor(options, initialSort) {
    this.options = options;
    this.state = {
      rawData: Array.isArray(options.data) ? [...options.data] : [],
      columns: normalizeColumns(options.columns),
      columnVisibility: {},
      columnWidths: {},
      columnOrder: [],
      selectedRows: new Set(),
      searchQuery: "",
      filters: {},
      sortKey: initialSort ? initialSort.key : null,
      sortDirection:
        initialSort && initialSort.direction === "desc" ? "desc" : "asc",
      currentPage: 1,
      pageSize: this.clampPageSize(options.pageSize),
      totalItems: Array.isArray(options.data) ? options.data.length : 0,
      cursor: null,
      nextCursor: null,
      prevCursor: null,
      cursorHistory: { 1: null },
      aggregates: {},
      loading: false,
      error: null,
      expandedRowIds: new Set(),
      syncStatus: null,
      highlightedRowId: null,
      toast: null,
      views: {},
    };

    this.syncColumnVisibility();
    this.syncColumnOrder();
  }

  toPositiveInteger(value, fallback = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }

    const integer = Math.floor(numeric);
    return integer >= 1 ? integer : fallback;
  }

  getPaginationGuardConfig() {
    if (this.options.pagination === false) {
      return null;
    }

    const guard = this.options.paginationGuard;

    if (!guard) {
      return null;
    }

    const source = guard === true ? {} : typeof guard === "object" ? guard : {};
    const minPageSize = this.toPositiveInteger(source.minPageSize, 1);
    const maxPageSize = Math.max(
      minPageSize,
      this.toPositiveInteger(source.maxPageSize, 100)
    );
    const maxPage = this.toPositiveInteger(source.maxPage, 25);

    return {
      minPageSize,
      maxPageSize,
      maxPage,
    };
  }

  clampPage(pageNumber) {
    let nextPage = this.toPositiveInteger(pageNumber, 1);
    const guard = this.getPaginationGuardConfig();

    if (guard) {
      nextPage = Math.min(nextPage, guard.maxPage);
    }

    return nextPage;
  }

  clampPageSize(pageSize) {
    const fallback = this.toPositiveInteger(this.options.pageSize, DEFAULT_PAGE_SIZE);
    let nextPageSize = this.toPositiveInteger(pageSize, fallback);
    const guard = this.getPaginationGuardConfig();

    if (guard) {
      nextPageSize = Math.max(guard.minPageSize, nextPageSize);
      nextPageSize = Math.min(guard.maxPageSize, nextPageSize);
    }

    return nextPageSize;
  }

  normalizeConstraints() {
    this.state.pageSize = this.clampPageSize(this.state.pageSize);
    this.state.currentPage = this.clampPage(this.state.currentPage);
    this.syncColumnVisibility();
    this.syncColumnOrder();
  }

  syncColumnOrder() {
    this.state.columnOrder = this.state.columns
      .map((column) => column.key || column.accessor)
      .filter((key) => key != null)
      .map(String);
  }

  syncColumnVisibility() {
    this.state.columnVisibility = this.state.columns.reduce((visibility, column) => {
      const key = column.key || column.accessor;

      if (key != null) {
        visibility[String(key)] = column.visible !== false;
      }

      return visibility;
    }, {});
  }

  setPage(pageNumber) {
    const nextPage = this.clampPage(pageNumber);
    if (this.state.currentPage === nextPage) {
      return false;
    }

    this.state.currentPage = nextPage;
    return true;
  }

  setCursorPage(pageNumber, cursor) {
    const nextPage = this.clampPage(pageNumber);

    if (this.state.currentPage === nextPage && this.state.cursor === cursor) {
      return false;
    }

    this.state.currentPage = nextPage;
    this.state.cursor = cursor ?? null;
    this.state.cursorHistory[nextPage] = cursor ?? null;
    return true;
  }

  syncCurrentPage(pageNumber) {
    const nextPage = this.clampPage(pageNumber);
    if (this.state.currentPage === nextPage) {
      return false;
    }

    this.state.currentPage = nextPage;
    return true;
  }

  setSearch(query) {
    const trimmed = String(query ?? "").trim().toLowerCase();
    if (this.state.searchQuery === trimmed) {
      return false;
    }

    this.state.searchQuery = trimmed;
    this.state.currentPage = 1;
    return true;
  }

  setFilters(filters = {}) {
    const nextFilters = Object.entries(filters || {}).reduce((result, [key, value]) => {
      if (value == null || String(value) === "") {
        return result;
      }

      result[key] = value;
      return result;
    }, {});

    if (JSON.stringify(this.state.filters) === JSON.stringify(nextFilters)) {
      return false;
    }

    this.state.filters = nextFilters;
    this.state.currentPage = 1;
    return true;
  }

  clearFilters() {
    return this.setFilters({});
  }

  setSort(sortKey, direction = "asc") {
    const nextDirection = direction === "desc" ? "desc" : "asc";

    if (
      this.state.sortKey === sortKey &&
      this.state.sortDirection === nextDirection
    ) {
      return false;
    }

    this.state.sortKey = sortKey;
    this.state.sortDirection = nextDirection;
    this.state.currentPage = 1;
    return true;
  }

  clearSort() {
    return this.setSort(null, "asc");
  }

  toggleSort(columnKey) {
    if (this.state.sortKey === columnKey) {
      return this.setSort(
        columnKey,
        this.state.sortDirection === "asc" ? "desc" : "asc"
      );
    }

    return this.setSort(columnKey, "asc");
  }

  toggleRowDetail(rowId) {
    if (this.state.expandedRowIds.has(rowId)) {
      this.state.expandedRowIds.delete(rowId);
    } else {
      this.state.expandedRowIds.add(rowId);
    }

    return this.state.expandedRowIds.has(rowId);
  }

  setPageSize(pageSize) {
    const nextPageSize = this.clampPageSize(pageSize);
    if (this.state.pageSize === nextPageSize) {
      return false;
    }

    this.state.pageSize = nextPageSize;
    this.state.currentPage = 1;
    return true;
  }

  setData(data) {
    this.state.rawData = Array.isArray(data) ? [...data] : [];
    this.state.totalItems = this.state.rawData.length;
    this.state.error = null;
    this.state.currentPage = 1;
    this.state.expandedRowIds.clear();
  }

  setColumns(columns) {
    this.state.columns = normalizeColumns(columns);
    this.syncColumnVisibility();
    this.syncColumnOrder();
    this.state.currentPage = 1;
  }

  setColumnWidth(columnKey, width) {
    const key = String(columnKey);
    const nextWidth = Math.max(40, Math.floor(Number(width) || 0));

    if (!this.state.columns.some((column) => String(column.key || column.accessor) === key)) {
      return false;
    }

    if (this.state.columnWidths[key] === nextWidth) {
      return false;
    }

    this.state.columnWidths = {
      ...this.state.columnWidths,
      [key]: nextWidth,
    };
    return true;
  }

  setColumnOrder(order) {
    if (!Array.isArray(order)) {
      return false;
    }

    const known = new Map(
      this.state.columns.map((column) => [
        String(column.key || column.accessor),
        column,
      ])
    );
    const nextColumns = [];
    const used = new Set();

    order.forEach((key) => {
      const id = String(key);
      const column = known.get(id);

      if (column && !used.has(id)) {
        nextColumns.push(column);
        used.add(id);
      }
    });

    this.state.columns.forEach((column) => {
      const id = String(column.key || column.accessor);
      if (!used.has(id)) {
        nextColumns.push(column);
      }
    });

    const nextOrder = nextColumns.map((column) => String(column.key || column.accessor));

    if (JSON.stringify(nextOrder) === JSON.stringify(this.state.columnOrder)) {
      return false;
    }

    this.state.columns = nextColumns;
    this.state.columnOrder = nextOrder;
    return true;
  }

  moveColumn(columnKey, beforeColumnKey) {
    const order = [...this.state.columnOrder];
    const fromIndex = order.indexOf(String(columnKey));
    const toIndex = order.indexOf(String(beforeColumnKey));

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return false;
    }

    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    return this.setColumnOrder(order);
  }

  setColumnVisibility(columnKey, isVisible) {
    const key = String(columnKey);
    const column = this.state.columns.find(
      (item) => String(item.key || item.accessor) === key
    );

    if (!column) {
      return false;
    }

    const nextVisible = Boolean(isVisible);

    if (column.visible !== false === nextVisible) {
      return false;
    }

    column.visible = nextVisible;
    this.syncColumnVisibility();
    return true;
  }

  setColumnVisibilityMap(visibility = {}) {
    let changed = false;

    this.state.columns.forEach((column) => {
      const key = column.key || column.accessor;

      if (key == null || visibility[key] === undefined) {
        return;
      }

      const nextVisible = Boolean(visibility[key]);
      if ((column.visible !== false) !== nextVisible) {
        column.visible = nextVisible;
        changed = true;
      }
    });

    this.syncColumnVisibility();
    return changed;
  }

  createSnapshot() {
    return {
      searchQuery: this.state.searchQuery,
      sortKey: this.state.sortKey,
      sortDirection: this.state.sortDirection,
      currentPage: this.state.currentPage,
      pageSize: this.state.pageSize,
      filters: { ...this.state.filters },
      columnVisibility: { ...this.state.columnVisibility },
      columnWidths: { ...this.state.columnWidths },
      columnOrder: [...this.state.columnOrder],
    };
  }

  restoreSnapshot(snapshot = {}) {
    if (!snapshot || typeof snapshot !== "object") {
      return false;
    }

    let changed = false;

    if (snapshot.searchQuery !== undefined) {
      const nextSearch = String(snapshot.searchQuery || "").trim().toLowerCase();
      changed = changed || this.state.searchQuery !== nextSearch;
      this.state.searchQuery = nextSearch;
    }

    if (snapshot.sortKey !== undefined) {
      changed = changed || this.state.sortKey !== snapshot.sortKey;
      this.state.sortKey = snapshot.sortKey || null;
    }

    if (snapshot.sortDirection !== undefined) {
      const nextDirection = snapshot.sortDirection === "desc" ? "desc" : "asc";
      changed = changed || this.state.sortDirection !== nextDirection;
      this.state.sortDirection = nextDirection;
    }

    if (snapshot.pageSize !== undefined) {
      const nextPageSize = this.clampPageSize(snapshot.pageSize);
      changed = changed || this.state.pageSize !== nextPageSize;
      this.state.pageSize = nextPageSize;
    }

    if (snapshot.filters && typeof snapshot.filters === "object") {
      changed = this.setFilters(snapshot.filters) || changed;
    }

    if (snapshot.currentPage !== undefined) {
      const nextPage = this.clampPage(snapshot.currentPage);
      changed = changed || this.state.currentPage !== nextPage;
      this.state.currentPage = nextPage;
    }

    if (snapshot.columnVisibility && typeof snapshot.columnVisibility === "object") {
      changed = this.setColumnVisibilityMap(snapshot.columnVisibility) || changed;
    }

    if (snapshot.columnWidths && typeof snapshot.columnWidths === "object") {
      Object.entries(snapshot.columnWidths).forEach(([key, width]) => {
        changed = this.setColumnWidth(key, width) || changed;
      });
    }

    if (Array.isArray(snapshot.columnOrder)) {
      changed = this.setColumnOrder(snapshot.columnOrder) || changed;
    }

    return changed;
  }

  setRemoteData(payload) {
    this.state.rawData = Array.isArray(payload?.rows) ? payload.rows : [];
    this.state.totalItems =
      Number(payload?.totalItems ?? payload?.total) || this.state.rawData.length;
    this.state.nextCursor = payload?.nextCursor ?? null;
    this.state.prevCursor = payload?.prevCursor ?? null;
    this.state.aggregates =
      payload?.aggregates && typeof payload.aggregates === "object"
        ? payload.aggregates
        : {};
    this.state.error = null;
    this.state.expandedRowIds.clear();
  }

  setError(error) {
    this.state.error = error;
  }

  setLoading(isLoading) {
    this.state.loading = Boolean(isLoading);
  }

  reset() {
    this.state.searchQuery = "";
    this.state.filters = {};
    this.state.sortKey = null;
    this.state.sortDirection = "asc";
    this.state.currentPage = 1;
    this.state.error = null;
    this.state.expandedRowIds.clear();
  }
}
