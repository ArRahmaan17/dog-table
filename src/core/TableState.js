const DEFAULT_PAGE_SIZE = 5;

export class TableState {
  constructor(options, initialSort) {
    this.options = options;
    this.state = {
      rawData: Array.isArray(options.data) ? [...options.data] : [],
      columns: Array.isArray(options.columns) ? [...options.columns] : [],
      selectedRows: new Set(),
      searchQuery: "",
      sortKey: initialSort ? initialSort.key : null,
      sortDirection:
        initialSort && initialSort.direction === "desc" ? "desc" : "asc",
      currentPage: 1,
      pageSize: this.clampPageSize(options.pageSize),
      totalItems: Array.isArray(options.data) ? options.data.length : 0,
      loading: false,
      error: null,
      expandedRowIds: new Set(),
      syncStatus: null,
      highlightedRowId: null,
      toast: null,
    };
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
  }

  setPage(pageNumber) {
    const nextPage = this.clampPage(pageNumber);
    if (this.state.currentPage === nextPage) {
      return false;
    }

    this.state.currentPage = nextPage;
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
    this.state.columns = Array.isArray(columns) ? [...columns] : [];
    this.state.currentPage = 1;
  }

  setRemoteData(payload) {
    this.state.rawData = Array.isArray(payload?.rows) ? payload.rows : [];
    this.state.totalItems = Number(payload?.totalItems) || 0;
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
    this.state.sortKey = null;
    this.state.sortDirection = "asc";
    this.state.currentPage = 1;
    this.state.error = null;
    this.state.expandedRowIds.clear();
  }
}
