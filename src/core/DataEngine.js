export class DataEngine {
  constructor(table) {
    this.table = table;
    this.cache = {
      rawData: null,
      filtered: null,
      sorted: null,
      searchQuery: null,
      sortKey: null,
      sortDirection: null,
    };
    this._displayRowsCache = null;
    this._displayRowsRows = null;
    this._displayRowsGroupBy = null;
    this._displayRowsGroupLabel = null;
    this._displayRowsUngroupedLabel = null;
  }

  reset() {
    this.cache.rawData = null;
    this.cache.filtered = null;
    this.cache.sorted = null;
    this.cache.searchQuery = null;
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

  filterRows(state) {
    const { rawData, columns, searchQuery } = state;

    if (
      this.cache.rawData === rawData &&
      this.cache.searchQuery === searchQuery &&
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

    this.cache.rawData = rawData;
    this.cache.searchQuery = searchQuery;
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
}
