export class DataEngine {
  constructor(table) {
    this.table = table;
    this.cache = {
      rawData: null,
      filtered: null,
      sorted: null,
      searchQuery: null,
      filters: null,
      sortKey: null,
      sortDirection: null,
    };
    this._displayRowsCache = null;
    this._displayRowsRows = null;
    this._displayRowsGroupBy = null;
    this._displayRowsGroupLabel = null;
    this._displayRowsUngroupedLabel = null;
    this.worker = null;
    this.workerRequestId = 0;
    this.workerCallbacks = new Map();
  }

  reset() {
    this.cache.rawData = null;
    this.cache.filtered = null;
    this.cache.sorted = null;
    this.cache.searchQuery = null;
    this.cache.filters = null;
    this.cache.sortKey = null;
    this.cache.sortDirection = null;
    this._displayRowsCache = null;
    this._displayRowsRows = null;
    this._displayRowsGroupBy = null;
    this._displayRowsGroupLabel = null;
    this._displayRowsUngroupedLabel = null;
  }

  isRemote() {
    return this.table.isRemote();
  }

  getWorkerConfig() {
    const config = this.table.options.dataWorker;

    if (!config) {
      return null;
    }

    return config === true ? {} : typeof config === "object" ? config : null;
  }

  canUseWorker(state) {
    const config = this.getWorkerConfig();

    if (
      !config ||
      this.isRemote() ||
      typeof Worker === "undefined" ||
      typeof this.table.options.groupBy === "function"
    ) {
      return false;
    }

    if (state.filters && Object.keys(state.filters).length > 0) {
      return false;
    }

    const threshold = Number.isFinite(config.threshold)
      ? config.threshold
      : 1000;

    if (state.rawData.length < threshold) {
      return false;
    }

    return !state.columns.some(
      (column) =>
        typeof column.filter === "function" ||
        typeof column.sortValue === "function"
    );
  }

  getAggregateValue(rows, field, operation) {
    const values = rows
      .map((row) => row?.[field])
      .filter((value) => value != null && value !== "");

    if (operation === "count") {
      return values.length;
    }

    const numbers = values
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (numbers.length === 0) {
      return 0;
    }

    if (operation === "avg") {
      return numbers.reduce((total, value) => total + value, 0) / numbers.length;
    }

    if (operation === "min") {
      return Math.min(...numbers);
    }

    if (operation === "max") {
      return Math.max(...numbers);
    }

    return numbers.reduce((total, value) => total + value, 0);
  }

  computeAggregates(rows, config) {
    if (!config || typeof config !== "object") {
      return {};
    }

    return Object.entries(config).reduce((result, [field, operation]) => {
      result[field] = this.getAggregateValue(rows, field, operation);
      return result;
    }, {});
  }

  formatAggregateSummary(aggregates = {}) {
    return Object.entries(aggregates)
      .map(([field, value]) => `${field}: ${value}`)
      .join(" · ");
  }

  ensureWorker() {
    if (this.worker) {
      return this.worker;
    }

    this.worker = new Worker(
      new URL("../workers/data-processor.js", import.meta.url),
      { type: "module" }
    );

    this.worker.addEventListener("message", (event) => {
      const { id, result, error } = event.data || {};
      const callbacks = this.workerCallbacks.get(id);

      if (!callbacks) {
        return;
      }

      this.workerCallbacks.delete(id);

      if (error) {
        callbacks.reject(new Error(error));
      } else {
        callbacks.resolve(result);
      }
    });

    this.worker.addEventListener("error", (error) => {
      this.workerCallbacks.forEach((callbacks) => {
        callbacks.reject(error);
      });
      this.workerCallbacks.clear();
    });

    return this.worker;
  }

  async processAsync(state) {
    if (!this.canUseWorker(state)) {
      return this.process(state);
    }

    try {
      return await this.processWithWorker(state);
    } catch {
      return this.process(state);
    }
  }

  processWithWorker(state) {
    const worker = this.ensureWorker();
    const id = this.workerRequestId + 1;
    const paginationEnabled = this.table.isPaginationEnabled();
    const guard = this.table.tableState.getPaginationGuardConfig();

    this.workerRequestId = id;

    return new Promise((resolve, reject) => {
      this.workerCallbacks.set(id, {
        resolve: (result) => {
          const rows = result.rowIndexes.map((index) => state.rawData[index]);
          const filteredRows = result.filteredIndexes.map(
            (index) => state.rawData[index]
          );

          resolve({
            rows,
            filteredRows,
            displayRows: this.buildDisplayRows(rows),
            totalItems: result.totalItems,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            pageSize: result.pageSize,
            startIndex: result.startIndex,
            endIndex: result.endIndex,
          });
        },
        reject,
      });

      worker.postMessage({
        id,
        rawData: state.rawData,
        columns: state.columns.map((column) => ({
          key: column.key,
          accessor: column.accessor,
          searchable: column.searchable,
        })),
        searchQuery: state.searchQuery,
        sortKey: state.sortKey,
        sortDirection: state.sortDirection,
        currentPage: state.currentPage,
        pageSize: state.pageSize,
        paginationEnabled,
        guard,
      });
    });
  }

  filterRows(state) {
    const { rawData, columns, searchQuery, filters } = state;
    const filterKey = JSON.stringify(filters || {});

    if (
      this.cache.rawData === rawData &&
      this.cache.searchQuery === searchQuery &&
      this.cache.filters === filterKey &&
      this.cache.filtered
    ) {
      return this.cache.filtered;
    }

    let filtered = [...rawData];

    if (!this.isRemote() && searchQuery) {
      filtered = filtered.filter((row) =>
        columns.some((column) => {
          if (column.searchable === false) {
            return false;
          }

          const key = column.accessor || column.key;

          if (typeof column.filter === "function") {
            return column.filter({
              value: row[key],
              row,
              query: searchQuery,
            });
          }

          const value = row[key];
          return String(value ?? "").toLowerCase().includes(searchQuery);
        })
      );
    }

    if (!this.isRemote() && filters && Object.keys(filters).length > 0) {
      filtered = filtered.filter((row) =>
        Object.entries(filters).every(([field, query]) => {
          const column =
            columns.find(
              (item) => item.key === field || item.accessor === field
            ) || { key: field };
          const key = column.accessor || column.key || field;
          const value = row[key];

          if (typeof column.filterValue === "function") {
            return column.filterValue({
              value,
              row,
              field,
              query,
              filters,
            });
          }

          if (value == null) {
            return false;
          }

          if (column.filterType === "select" || column.filterType === "date") {
            return String(value) === String(query);
          }

          return String(value)
            .toLowerCase()
            .includes(String(query).toLowerCase());
        })
      );
    }

    this.cache.rawData = rawData;
    this.cache.searchQuery = searchQuery;
    this.cache.filters = filterKey;
    this.cache.filtered = filtered;
    this.cache.sorted = null;

    return filtered;
  }

  sortRows(state, filteredRows) {
    const { columns, sortKey, sortDirection } = state;

    if (
      this.cache.filtered === filteredRows &&
      this.cache.sortKey === sortKey &&
      this.cache.sortDirection === sortDirection &&
      this.cache.sorted
    ) {
      return this.cache.sorted;
    }

    const sorted = [...filteredRows];

    if (!this.isRemote() && sortKey) {
      const sortColumn = columns.find((column) => column.key === sortKey);
      const hasCustomSortValue = typeof sortColumn?.sortValue === "function";

      const mapped = sorted.map((row) => {
        const value = row[sortKey];
        return {
          row,
          sortValue: hasCustomSortValue
            ? sortColumn.sortValue(value, row)
            : value,
        };
      });

      mapped.sort((a, b) => {
        const leftValue = a.sortValue;
        const rightValue = b.sortValue;

        if (typeof leftValue === "number" && typeof rightValue === "number") {
          return sortDirection === "asc"
            ? leftValue - rightValue
            : rightValue - leftValue;
        }

        const comparison = String(leftValue ?? "").localeCompare(
          String(rightValue ?? ""),
          undefined,
          { numeric: true, sensitivity: "base" }
        );

        return sortDirection === "asc" ? comparison : -comparison;
      });

      for (let i = 0; i < mapped.length; i++) {
        sorted[i] = mapped[i].row;
      }
    }

    this.cache.filtered = filteredRows;
    this.cache.sortKey = sortKey;
    this.cache.sortDirection = sortDirection;
    this.cache.sorted = sorted;

    return sorted;
  }

  hasDisplayRowsCache(rows, groupBy, groupLabel, ungroupedLabel) {
    if (
      !this._displayRowsCache ||
      !this._displayRowsRows ||
      this._displayRowsGroupBy !== groupBy ||
      this._displayRowsGroupLabel !== groupLabel ||
      this._displayRowsUngroupedLabel !== ungroupedLabel ||
      this._displayRowsRows.length !== rows.length
    ) {
      return false;
    }

    for (let i = 0; i < rows.length; i += 1) {
      if (this._displayRowsRows[i] !== rows[i]) {
        return false;
      }
    }

    return true;
  }

  buildDisplayRows(rows) {
    const groupBy = this.table.options.groupBy;
    const groupLabel = this.table.options.groupLabel;
    const ungroupedLabel = this.table.options.language.ungrouped;

    if (this.hasDisplayRowsCache(rows, groupBy, groupLabel, ungroupedLabel)) {
      return this._displayRowsCache;
    }

    let result;

    if (!this.table.options.groupBy) {
      result = rows.map((row) => ({
        type: "row",
        row,
        rowId: this.table.getRowId(row),
      }));
    } else {
      const groups = new Map();

      rows.forEach((row) => {
        const groupValue = this.table.getGroupValue(row);
        const groupKey = String(groupValue ?? "");

        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            value: groupValue ?? this.table.options.language.ungrouped,
            rows: [],
          });
        }

        groups.get(groupKey).rows.push(row);
      });

      result = [];

      groups.forEach((group) => {
        result.push({
          type: "group",
          groupValue: group.value,
          label: this.table.getGroupLabel(group.value, group.rows),
          count: group.rows.length,
          aggregates: this.computeAggregates(
            group.rows,
            this.table.options.groupAggregates
          ),
        });

        group.rows.forEach((row) => {
          result.push({
            type: "row",
            row,
            rowId: this.table.getRowId(row),
            groupValue: group.value,
          });
        });
      });
    }

    this._displayRowsCache = result;
    this._displayRowsRows = rows.slice();
    this._displayRowsGroupBy = groupBy;
    this._displayRowsGroupLabel = groupLabel;
    this._displayRowsUngroupedLabel = ungroupedLabel;

    return result;
  }

  process(state) {
    const paginationEnabled = this.table.isPaginationEnabled();
    const filteredRows = this.filterRows(state);
    const sortedRows = this.sortRows(state, filteredRows);
    const totalItems = this.isRemote() ? state.totalItems : sortedRows.length;
    const guard = this.table.tableState.getPaginationGuardConfig();
    const rawTotalPages = paginationEnabled
      ? Math.max(1, Math.ceil(totalItems / state.pageSize))
      : 1;
    const totalPages = paginationEnabled && guard
      ? Math.min(rawTotalPages, guard.maxPage)
      : rawTotalPages;
    const currentPage = paginationEnabled
      ? Math.min(
          Math.max(1, this.table.tableState.clampPage(state.currentPage)),
          totalPages
        )
      : 1;
    const start = (currentPage - 1) * state.pageSize;
    const rows = this.isRemote() || !paginationEnabled
      ? sortedRows
      : sortedRows.slice(start, start + state.pageSize);

    return {
      rows,
      filteredRows,
      displayRows: this.buildDisplayRows(rows),
      aggregates: this.isRemote()
        ? state.aggregates || {}
        : this.computeAggregates(filteredRows, this.table.options.footerAggregates),
      totalItems,
      totalPages,
      currentPage,
      pageSize: state.pageSize,
      startIndex: totalItems === 0 ? 0 : paginationEnabled ? start + 1 : 1,
      endIndex: this.isRemote()
        ? Math.min(start + rows.length, totalItems)
        : paginationEnabled
          ? Math.min(start + state.pageSize, totalItems)
          : totalItems,
    };
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.workerCallbacks.forEach((callbacks) => {
      callbacks.reject(new Error("DataEngine worker was destroyed."));
    });
    this.workerCallbacks.clear();
  }
}
