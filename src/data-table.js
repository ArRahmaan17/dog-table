import { DataFetcher } from "./data-fetcher.js";
import { ThemeManager } from "./theme-manager.js";

const DEFAULT_PAGE_SIZE = 5;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function debounce(callback, wait) {
  let timeoutId = null;

  const debounced = (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

export class DataTable {
  constructor(container, options = {}) {
    this.container =
      typeof container === "string"
        ? document.querySelector(container)
        : container;

    if (!this.container) {
      throw new Error("DataTable container was not found.");
    }

    this.options = {
      data: [],
      columns: [],
      pageSize: DEFAULT_PAGE_SIZE,
      searchable: true,
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
        ...(options.language || {}),
      },
      initialSort: null,
      searchDebounce: 250,
      theme: "default",
      classNames: {},
      remote: null,
      groupBy: null,
      groupLabel: null,
      rowKey: null,
      rowDetail: null,
      persistence: null,
      persistenceKey: null,
      selectable: false,
      hooks: {},
      ...options,
    };

    const initialSort =
      this.options.initialSort &&
      typeof this.options.initialSort === "object" &&
      this.options.initialSort.key
        ? this.options.initialSort
        : null;

    this.state = {
      rawData: Array.isArray(this.options.data) ? [...this.options.data] : [],
      columns: Array.isArray(this.options.columns)
        ? [...this.options.columns]
        : [],
      selectedRows: new Set(),
      searchQuery: "",
      sortKey: initialSort ? initialSort.key : null,
      sortDirection:
        initialSort && initialSort.direction === "desc" ? "desc" : "asc",
      currentPage: 1,
      pageSize: Number(this.options.pageSize) || DEFAULT_PAGE_SIZE,
      totalItems: Array.isArray(this.options.data) ? this.options.data.length : 0,
      loading: false,
      error: null,
      expandedRowIds: new Set(),
    };

    this.elements = {};
    this.lastEmittedPage = null;
    this.lastSearchQuery = null;
    this.lastSortState = null;
    this.boundHandlers = {};
    this.theme = new ThemeManager(this.options.theme, this.options.classNames);
    this.fetcher = this.options.remote ? new DataFetcher(this.options.remote) : null;
    this.debouncedSearch = null;
    this.rowIds = new WeakMap();
    this.rowIdCounter = 0;

    if (this.options.persistence) {
      this.loadState();
    }
  }

  init() {
    this.renderStructure();
    this.bindEvents();
    this.update();

    if (typeof this.options.hooks.onInit === "function") {
      this.options.hooks.onInit(this.getState());
    }

    return this;
  }

  hasRowDetail() {
    return (
      this.options.rowDetail &&
      typeof this.options.rowDetail.render === "function"
    );
  }

  getVisibleColumnCount() {
    return (
      this.state.columns.length +
      (this.hasRowDetail() ? 1 : 0) +
      (this.options.selectable ? 1 : 0)
    );
  }

  loadState() {
    if (!this.options.persistence) return;
    const key = this.options.persistenceKey || `dt-${this.container.id || "state"}`;
    let saved = null;

    try {
      if (this.options.persistence === "local") {
        saved = JSON.parse(localStorage.getItem(key));
      } else if (this.options.persistence === "session") {
        saved = JSON.parse(sessionStorage.getItem(key));
      } else if (this.options.persistence === "url") {
        const params = new URLSearchParams(window.location.search);
        saved = {
          searchQuery: params.get(`${key}-q`) || "",
          currentPage: Number(params.get(`${key}-p`)) || 1,
          sortKey: params.get(`${key}-sk`),
          sortDirection: params.get(`${key}-sd`) || "asc",
          pageSize: Number(params.get(`${key}-ps`)) || undefined,
        };
      }
    } catch (e) {
      console.warn("DataTable: Failed to load state", e);
    }

    if (saved) {
      if (saved.searchQuery !== undefined) this.state.searchQuery = saved.searchQuery;
      if (saved.currentPage !== undefined) this.state.currentPage = saved.currentPage;
      if (saved.sortKey !== undefined) this.state.sortKey = saved.sortKey;
      if (saved.sortDirection !== undefined) this.state.sortDirection = saved.sortDirection;
      if (saved.pageSize !== undefined) this.state.pageSize = saved.pageSize;
    }
  }

  saveState() {
    if (!this.options.persistence) return;
    const key = this.options.persistenceKey || `dt-${this.container.id || "state"}`;
    const toSave = {
      searchQuery: this.state.searchQuery,
      currentPage: this.state.currentPage,
      sortKey: this.state.sortKey,
      sortDirection: this.state.sortDirection,
      pageSize: this.state.pageSize,
    };

    if (this.options.persistence === "local") {
      localStorage.setItem(key, JSON.stringify(toSave));
    } else if (this.options.persistence === "session") {
      sessionStorage.setItem(key, JSON.stringify(toSave));
    } else if (this.options.persistence === "url") {
      const url = new URL(window.location);
      if (toSave.searchQuery) url.searchParams.set(`${key}-q`, toSave.searchQuery);
      else url.searchParams.delete(`${key}-q`);

      url.searchParams.set(`${key}-p`, toSave.currentPage);

      if (toSave.sortKey) {
        url.searchParams.set(`${key}-sk`, toSave.sortKey);
        url.searchParams.set(`${key}-sd`, toSave.sortDirection);
      } else {
        url.searchParams.delete(`${key}-sk`);
        url.searchParams.delete(`${key}-sd`);
      }

      url.searchParams.set(`${key}-ps`, toSave.pageSize);
      window.history.replaceState({}, "", url);
    }
  }

  getRowId(row) {
    if (typeof this.options.rowKey === "function") {
      return String(this.options.rowKey(row));
    }

    if (typeof this.options.rowKey === "string" && row?.[this.options.rowKey] != null) {
      return String(row[this.options.rowKey]);
    }

    if (row?.id != null) {
      return String(row.id);
    }

    if (!this.rowIds.has(row)) {
      this.rowIdCounter += 1;
      this.rowIds.set(row, `row-${this.rowIdCounter}`);
    }

    return this.rowIds.get(row);
  }

  getGroupValue(row) {
    if (!this.options.groupBy) {
      return null;
    }

    if (typeof this.options.groupBy === "function") {
      return this.options.groupBy(row);
    }

    return row?.[this.options.groupBy];
  }

  getGroupLabel(groupValue, rows) {
    if (typeof this.options.groupLabel === "function") {
      return this.options.groupLabel(groupValue, rows);
    }

    return `${groupValue ?? this.options.language.ungrouped} (${rows.length})`;
  }

  getRowDetailLabel(row, isExpanded) {
    if (typeof this.options.rowDetail?.toggleLabel === "function") {
      return this.options.rowDetail.toggleLabel(row, isExpanded);
    }

    return isExpanded
      ? this.options.language.hideDetails
      : this.options.language.showDetails;
  }

  buildDisplayRows(rows) {
    if (!this.options.groupBy) {
      return rows.map((row) => ({
        type: "row",
        row,
        rowId: this.getRowId(row),
      }));
    }

    const groups = new Map();

    rows.forEach((row) => {
      const groupValue = this.getGroupValue(row);
      const groupKey = String(groupValue ?? "");

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          value: groupValue ?? this.options.language.ungrouped,
          rows: [],
        });
      }

      groups.get(groupKey).rows.push(row);
    });

    const displayRows = [];

    groups.forEach((group) => {
      displayRows.push({
        type: "group",
        groupValue: group.value,
        label: this.getGroupLabel(group.value, group.rows),
        count: group.rows.length,
      });

      group.rows.forEach((row) => {
        displayRows.push({
          type: "row",
          row,
          rowId: this.getRowId(row),
          groupValue: group.value,
        });
      });
    });

    return displayRows;
  }

  renderStructure() {
    this.container.innerHTML = `
      <div class="${this.theme.get("shell")}">
        <div class="${this.theme.get("toolbar")}">
          <label class="${this.theme.get("search")}">
            <span class="${this.theme.get("searchLabel")}">${escapeHtml(
              this.options.language.search
            )}</span>
            <input
              class="${this.theme.get("searchInput")}"
              type="search"
              placeholder="${escapeHtml(this.options.language.searchPlaceholder)}"
              value="${escapeHtml(this.state.searchQuery)}"
              aria-label="${escapeHtml(this.options.language.search)}"
            />
          </label>
          <div class="${this.theme.get("meta")}" aria-live="polite"></div>
        </div>
        <div class="${this.theme.get("tableWrap")}">
          <table class="${this.theme.get("table")}">
            <thead class="${this.theme.get("thead")}"></thead>
            <tbody class="${this.theme.get("tbody")}"></tbody>
          </table>
        </div>
        <div class="${this.theme.get("pagination")}" aria-label="Pagination controls"></div>
      </div>
    `;

    this.elements.search = this.container.querySelector(
      `.${this.theme.get("search").split(" ")[0]}`
    );
    this.elements.searchInput = this.container.querySelector("input[type='search']");
    this.elements.meta = this.container.querySelector(
      `.${this.theme.get("meta").split(" ")[0]}`
    );
    this.elements.thead = this.container.querySelector("thead");
    this.elements.tbody = this.container.querySelector("tbody");
    this.elements.pagination = this.container.querySelector(
      "[aria-label='Pagination controls']"
    );

    if (!this.options.searchable && this.elements.search) {
      this.elements.search.hidden = true;
    }
  }

  bindEvents() {
    this.boundHandlers.onHeadClick = (event) => {
      const header = event.target.closest("th[data-column]");

      if (!header || header.dataset.sortable === "false" || this.state.loading) {
        return;
      }

      this.toggleSort(header.dataset.column);
    };

    this.boundHandlers.onHeadKeydown = (event) => {
      const header = event.target.closest("th[data-column]");

      if (
        !header ||
        header.dataset.sortable === "false" ||
        this.state.loading ||
        (event.key !== "Enter" && event.key !== " ")
      ) {
        return;
      }

      event.preventDefault();
      this.toggleSort(header.dataset.column);
    };

    this.boundHandlers.onPaginationClick = (event) => {
      const button = event.target.closest("button[data-page]");

      if (!button || button.disabled || this.state.loading) {
        return;
      }

      this.setPage(Number(button.dataset.page));
    };

    this.boundHandlers.onBulkCheck = (event) => {
      const checkbox = event.target.closest("input[data-bulk-checkbox]");
      if (!checkbox) return;
      this.selectAll(checkbox.checked);
    };

    this.boundHandlers.onRowCheck = (event) => {
      const checkbox = event.target.closest("input[data-row-checkbox]");
      if (!checkbox) return;
      this.toggleRowSelection(checkbox.dataset.rowCheckbox, checkbox.checked);
    };

    this.elements.thead.addEventListener("click", this.boundHandlers.onHeadClick);
    this.elements.thead.addEventListener("change", this.boundHandlers.onBulkCheck);
    this.elements.tbody.addEventListener("change", this.boundHandlers.onRowCheck);
    this.elements.tbody.addEventListener("click", this.boundHandlers.onBodyClick);
    this.elements.pagination.addEventListener(
      "click",
      this.boundHandlers.onPaginationClick
    );

    if (this.options.searchable) {
      const handleSearch = (value) => {
        this.setSearch(value);
      };

      this.debouncedSearch =
        this.options.searchDebounce > 0
          ? debounce(handleSearch, this.options.searchDebounce)
          : handleSearch;

      this.boundHandlers.onSearchInput = (event) => {
        this.debouncedSearch(event.target.value);
      };

      this.elements.searchInput.addEventListener(
        "input",
        this.boundHandlers.onSearchInput
      );
    }
  }

  isRemote() {
    return Boolean(this.fetcher);
  }

  toggleSort(columnKey) {
    const column = this.state.columns.find((item) => item.key === columnKey);

    if (!column || column.sortable === false) {
      return;
    }

    if (this.state.sortKey === columnKey) {
      this.state.sortDirection =
        this.state.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.state.sortKey = columnKey;
      this.state.sortDirection = "asc";
    }

    this.state.currentPage = 1;
    this.update();
  }

  setSort(sortKey, direction = "asc") {
    if (!sortKey) {
      this.clearSort();
      return;
    }

    const column = this.state.columns.find((item) => item.key === sortKey);

    if (!column || column.sortable === false) {
      return;
    }

    this.state.sortKey = sortKey;
    this.state.sortDirection = direction === "desc" ? "desc" : "asc";
    this.state.currentPage = 1;
    this.saveState();
    this.update();
  }

  clearSort() {
    this.state.sortKey = null;
    this.state.sortDirection = "asc";
    this.state.currentPage = 1;
    this.saveState();
    this.update();
  }

  toggleRowDetail(rowId) {
    if (!this.hasRowDetail()) {
      return;
    }

    if (this.state.expandedRowIds.has(rowId)) {
      this.state.expandedRowIds.delete(rowId);
    } else {
      this.state.expandedRowIds.add(rowId);
    }

    if (typeof this.options.hooks.onRowToggle === "function") {
      this.options.hooks.onRowToggle({
        rowId,
        expanded: this.state.expandedRowIds.has(rowId),
      });
    }

    this.update({ skipFetch: true });
  }

  expandRowDetail(rowId) {
    if (!this.state.expandedRowIds.has(rowId)) {
      this.toggleRowDetail(rowId);
    }
  }

  collapseRowDetail(rowId) {
    if (this.state.expandedRowIds.has(rowId)) {
      this.toggleRowDetail(rowId);
    }
  }

  setPage(pageNumber) {
    this.state.currentPage = Number(pageNumber) || 1;
    this.saveState();
    this.update();
  }

  setSearch(query) {
    this.state.searchQuery = String(query ?? "").trim().toLowerCase();
    this.state.currentPage = 1;

    if (this.elements.searchInput) {
      this.elements.searchInput.value = query ?? "";
    }

    this.saveState();
    this.update();
  }

  clearSearch() {
    this.setSearch("");
  }

  setPageSize(pageSize) {
    const nextPageSize = Number(pageSize) || DEFAULT_PAGE_SIZE;

    this.state.pageSize = Math.max(1, nextPageSize);
    this.state.currentPage = 1;
    this.saveState();
    this.update();
  }

  setData(data) {
    this.state.rawData = Array.isArray(data) ? [...data] : [];
    this.state.totalItems = this.state.rawData.length;
    this.state.error = null;
    this.state.currentPage = 1;
    this.state.expandedRowIds.clear();
    this.update();
  }

  setColumns(columns) {
    this.state.columns = Array.isArray(columns) ? [...columns] : [];
    this.state.currentPage = 1;
    this.update();
  }

  setTheme(theme, classNames = {}) {
    this.theme = new ThemeManager(theme, classNames);
    this.renderStructure();
    this.bindEvents();
    this.update({ skipFetch: true });
  }

  setLanguage(language) {
    this.options.language = {
      ...this.options.language,
      ...language,
    };
    this.renderStructure();
    this.bindEvents();
    this.update({ skipFetch: true });
  }

  reset() {
    this.state.searchQuery = "";
    this.state.sortKey = null;
    this.state.sortDirection = "asc";
    this.state.currentPage = 1;
    this.state.error = null;
    this.state.expandedRowIds.clear();

    if (this.elements.searchInput) {
      this.elements.searchInput.value = "";
    }

    this.update();
  }

  getState() {
    return {
      ...this.state,
      rawData: [...this.state.rawData],
      columns: [...this.state.columns],
      expandedRowIds: [...this.state.expandedRowIds],
      selectedRows: [...this.state.selectedRows],
    };
  }

  getSelectedData() {
    const selectedIds = this.state.selectedRows;
    return this.state.rawData.filter((row) => selectedIds.has(this.getRowId(row)));
  }

  toggleRowSelection(rowId, isSelected) {
    if (isSelected) {
      this.state.selectedRows.add(rowId);
    } else {
      this.state.selectedRows.delete(rowId);
    }

    if (typeof this.options.hooks.onSelectionChange === "function") {
      this.options.hooks.onSelectionChange(this.getSelectedData());
    }

    this.update({ skipFetch: true });
  }

  selectAll(isSelected) {
    const processed = this.getProcessedData();
    processed.rows.forEach((row) => {
      const id = this.getRowId(row);
      if (isSelected) {
        this.state.selectedRows.add(id);
      } else {
        this.state.selectedRows.delete(id);
      }
    });

    if (typeof this.options.hooks.onSelectionChange === "function") {
      this.options.hooks.onSelectionChange(this.getSelectedData());
    }

    this.update({ skipFetch: true });
  }

  toggleColumnVisibility(columnKey, isVisible) {
    const column = this.state.columns.find((c) => c.key === columnKey);
    if (column) {
      column.visible = isVisible;
      this.update({ skipFetch: true });
    }
  }

  exportCSV(filename = "table-export.csv") {
    const columns = this.state.columns.filter((c) => c.visible !== false);
    const headers = columns
      .map((c) => `"${(c.label || c.key).replace(/"/g, '""')}"`)
      .join(",");

    const rows = this.state.rawData
      .map((row) => {
        return columns
          .map((c) => {
            let value = row[c.key];
            if (typeof c.render === "function") {
              const rendered = c.render(value, row);
              if (rendered instanceof Node) {
                value = rendered.textContent;
              } else {
                value = rendered;
              }
            }
            return `"${String(value ?? "").replace(/"/g, '""')}"`;
          })
          .join(",");
      })
      .join("\n");

    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    link.click();
    URL.revokeObjectURL(url);
  }

  setLoading(isLoading) {
    this.state.loading = isLoading;

    if (typeof this.options.hooks.onLoadingChange === "function") {
      this.options.hooks.onLoadingChange(isLoading);
    }
  }

  getProcessedData() {
    const {
      rawData,
      columns,
      searchQuery,
      sortKey,
      sortDirection,
      currentPage,
      pageSize,
    } = this.state;

    let processed = [...rawData];

    if (!this.isRemote() && searchQuery) {
      processed = processed.filter((row) =>
        columns.some((column) => {
          if (column.searchable === false) {
            return false;
          }

          if (typeof column.filter === "function") {
            return column.filter({
              value: row[column.key],
              row,
              query: searchQuery,
            });
          }

          const value = row[column.key];
          return String(value ?? "").toLowerCase().includes(searchQuery);
        })
      );
    }

    if (!this.isRemote() && sortKey) {
      processed.sort((left, right) => {
        const sortColumn = columns.find((column) => column.key === sortKey);
        const leftValue =
          sortColumn && typeof sortColumn.sortValue === "function"
            ? sortColumn.sortValue(left[sortKey], left)
            : left[sortKey];
        const rightValue =
          sortColumn && typeof sortColumn.sortValue === "function"
            ? sortColumn.sortValue(right[sortKey], right)
            : right[sortKey];

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
    }

    const totalItems = this.isRemote() ? this.state.totalItems : processed.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    const paginated = this.isRemote()
      ? processed
      : processed.slice(start, start + pageSize);
    const displayRows = this.buildDisplayRows(paginated);

    if (safePage !== currentPage) {
      this.state.currentPage = safePage;
    }

    return {
      rows: paginated,
      displayRows,
      totalItems,
      totalPages,
      currentPage: safePage,
      pageSize,
      startIndex: totalItems === 0 ? 0 : start + 1,
      endIndex: this.isRemote()
        ? Math.min(start + paginated.length, totalItems)
        : Math.min(start + pageSize, totalItems),
    };
  }

  isAllSelected(rows) {
    if (!rows || rows.length === 0) return false;
    return rows.every((row) => this.state.selectedRows.has(this.getRowId(row)));
  }

  renderHeader(rows = []) {
    const isAllSelected = this.options.selectable && this.isAllSelected(rows);
    const headers = this.state.columns
      .filter((column) => column.visible !== false)
      .map((column) => {
        const isSorted = this.state.sortKey === column.key;
        const direction = isSorted ? this.state.sortDirection : "none";
        const sortable = column.sortable !== false;
        const label = escapeHtml(column.label ?? column.key);
        const indicator =
          direction === "asc" ? " ▲" : direction === "desc" ? " ▼" : "";

        return `
          <th
            scope="col"
            data-column="${escapeHtml(column.key)}"
            data-sortable="${sortable}"
            aria-sort="${direction}"
            ${sortable ? 'tabindex="0"' : ""}
            class="${[
              this.theme.get("headerCell"),
              sortable ? this.theme.get("sortableHeader") : "",
            ]
              .filter(Boolean)
              .join(" ")}"
          >
            <span>${label}${indicator}</span>
          </th>
        `;
      })
      .join("");

    const detailHeader = this.hasRowDetail()
      ? `<th scope="col" class="${this.theme.get("headerCell")}">${escapeHtml(
          this.options.language.details
        )}</th>`
      : "";

    const selectionHeader = this.options.selectable
      ? `<th scope="col" class="${this.theme.get("headerCell")}">
           <input type="checkbox" data-bulk-checkbox ${
             isAllSelected ? "checked" : ""
           } aria-label="Select all rows" />
         </th>`
      : "";

    this.elements.thead.innerHTML = `<tr>${selectionHeader}${detailHeader}${headers}</tr>`;
  }

  renderLoading() {
    const rowsCount = this.state.pageSize;
    const colsCount = this.getVisibleColumnCount();
    let rowsHtml = "";

    for (let i = 0; i < rowsCount; i++) {
      let colsHtml = "";
      for (let j = 0; j < colsCount; j++) {
        colsHtml += `
          <td class="${this.theme.get("bodyCell")}">
            <div class="${this.theme.get("skeleton")}"></div>
          </td>
        `;
      }
      rowsHtml += `<tr class="${this.theme.get("bodyRow")}">${colsHtml}</tr>`;
    }

    this.elements.tbody.innerHTML = rowsHtml;
    this.elements.meta.textContent = this.options.language.loading;
    this.elements.pagination.innerHTML = "";
  }

  renderError() {
    this.elements.tbody.innerHTML = `
      <tr>
        <td colspan="${this.getVisibleColumnCount()}" class="${this.theme.get("emptyCell")}">
          ${escapeHtml(this.state.error?.message || this.options.language.error)}
        </td>
      </tr>
    `;
    this.elements.meta.textContent = this.options.language.error;
    this.elements.pagination.innerHTML = "";
  }

  renderDetailContent(row, rowId) {
    if (!this.hasRowDetail()) {
      return null;
    }

    return this.options.rowDetail.render(row, {
      rowId,
      collapse: () => this.collapseRowDetail(rowId),
      expand: () => this.expandRowDetail(rowId),
      toggle: () => this.toggleRowDetail(rowId),
    });
  }

  renderBody(displayRows) {
    if (displayRows.length === 0) {
      this.elements.tbody.innerHTML = `
        <tr>
          <td colspan="${this.getVisibleColumnCount()}" class="${this.theme.get("emptyCell")}">
            ${escapeHtml(
              this.state.searchQuery
                ? this.options.language.noResults
                : this.options.language.emptyState
            )}
          </td>
        </tr>
      `;
      return;
    }

    this.elements.tbody.innerHTML = "";

    const fragment = document.createDocumentFragment();

    displayRows.forEach((item) => {
      if (item.type === "group") {
        const groupRow = document.createElement("tr");
        groupRow.className = this.theme.get("groupRow");

        const groupCell = document.createElement("td");
        groupCell.className = this.theme.get("groupCell");
        groupCell.colSpan = this.getVisibleColumnCount();
        groupCell.textContent = item.label;

        groupRow.appendChild(groupCell);
        fragment.appendChild(groupRow);
        return;
      }

      const { row, rowId } = item;
      const tr = document.createElement("tr");
      tr.className = this.theme.get("bodyRow");
      tr.dataset.rowId = rowId;

      if (this.hasRowDetail()) {
        const detailToggleCell = document.createElement("td");
        detailToggleCell.className = this.theme.get("detailToggleCell");

        const detailButton = document.createElement("button");
        detailButton.type = "button";
        detailButton.className = this.theme.get("detailToggle");
        detailButton.dataset.detailToggle = rowId;
        detailButton.setAttribute(
          "aria-expanded",
          this.state.expandedRowIds.has(rowId) ? "true" : "false"
        );
        detailButton.setAttribute("aria-controls", `dt-detail-${rowId}`);
        detailButton.textContent = this.getRowDetailLabel(
          row,
          this.state.expandedRowIds.has(rowId)
        );

        detailToggleCell.appendChild(detailButton);
        tr.appendChild(detailToggleCell);
      }

      if (this.options.selectable) {
        const selectionCell = document.createElement("td");
        selectionCell.className = this.theme.get("bodyCell");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.rowCheckbox = rowId;
        checkbox.checked = this.state.selectedRows.has(rowId);
        checkbox.setAttribute("aria-label", `Select row ${rowId}`);

        selectionCell.appendChild(checkbox);
        tr.appendChild(selectionCell);
      }

      this.state.columns.forEach((column) => {
        if (column.visible === false) return;

        const td = document.createElement("td");
        td.className = this.theme.get("bodyCell");
        const value = row[column.key];
        const rendered =
          typeof column.render === "function" ? column.render(value, row) : value;

        if (rendered instanceof Node) {
          td.appendChild(rendered);
        } else if (rendered != null) {
          td.textContent = String(rendered);
        }

        tr.appendChild(td);
      });

      fragment.appendChild(tr);

      if (this.hasRowDetail() && this.state.expandedRowIds.has(rowId)) {
        const detailRow = document.createElement("tr");
        detailRow.className = this.theme.get("detailRow");

        const detailCell = document.createElement("td");
        detailCell.className = this.theme.get("detailCell");
        detailCell.colSpan = this.getVisibleColumnCount();
        detailCell.id = `dt-detail-${rowId}`;

        const detailContent = this.renderDetailContent(row, rowId);

        if (detailContent instanceof Node) {
          detailCell.appendChild(detailContent);
        } else if (detailContent != null) {
          detailCell.textContent = String(detailContent);
        }

        detailRow.appendChild(detailCell);
        fragment.appendChild(detailRow);
      }
    });

    this.elements.tbody.appendChild(fragment);
  }

  renderMeta(processed) {
    if (processed.totalItems === 0) {
      this.elements.meta.textContent = this.state.searchQuery
        ? this.options.language.noResults
        : this.options.language.emptyState;
      return;
    }

    this.elements.meta.textContent = this.options.language.showing
      .replace("{start}", processed.startIndex)
      .replace("{end}", processed.endIndex)
      .replace("{total}", processed.totalItems);
  }

  getVisiblePageNumbers(currentPage, totalPages) {
    const pages = new Set([
      1,
      totalPages,
      currentPage - 1,
      currentPage,
      currentPage + 1,
    ]);

    return [...pages]
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((left, right) => left - right);
  }

  renderPagination(processed) {
    const prevDisabled = processed.currentPage <= 1;
    const nextDisabled = processed.currentPage >= processed.totalPages;
    const pageNumbers = this.getVisiblePageNumbers(
      processed.currentPage,
      processed.totalPages
    );
    const numberedButtons = pageNumbers
      .map((page, index) => {
        const previous = pageNumbers[index - 1];
        const gap =
          previous && page - previous > 1
            ? `<span class="${this.theme.get("paginationGap")}">…</span>`
            : "";
        const button = `
          <button
            type="button"
            class="${[
              this.theme.get("paginationPage"),
              page === processed.currentPage
                ? this.theme.get("paginationPageActive")
                : "",
            ]
              .filter(Boolean)
              .join(" ")}"
            data-page="${page}"
            aria-current="${page === processed.currentPage ? "page" : "false"}"
          >
            ${page}
          </button>
        `;

        return `${gap}${button}`;
      })
      .join("");

    this.elements.pagination.innerHTML = `
      <button
        type="button"
        class="${this.theme.get("button")}"
        data-page="${processed.currentPage - 1}"
        ${prevDisabled ? "disabled" : ""}
      >
        ${escapeHtml(this.options.language.previous)}
      </button>
      <div class="${this.theme.get("paginationPages")}">${numberedButtons}</div>
      <span class="${this.theme.get("paginationStatus")}">
        ${escapeHtml(
          this.options.language.page
            .replace("{page}", processed.currentPage)
            .replace("{total}", processed.totalPages)
        )}
      </span>
      <button
        type="button"
        class="${this.theme.get("button")}"
        data-page="${processed.currentPage + 1}"
        ${nextDisabled ? "disabled" : ""}
      >
        ${escapeHtml(this.options.language.next)}
      </button>
    `;
  }

  async fetchData() {
    if (!this.fetcher) {
      return;
    }

    this.setLoading(true);
    this.state.error = null;
    this.renderHeader(this.getProcessedData().rows);
    this.renderLoading();

    if (typeof this.options.hooks.onFetchStart === "function") {
      this.options.hooks.onFetchStart(this.getState());
    }

    try {
      const payload = await this.fetcher.fetch(this.state);

      this.state.rawData = Array.isArray(payload.rows) ? payload.rows : [];
      this.state.totalItems = Number(payload.totalItems) || 0;
      this.state.error = null;
      this.state.expandedRowIds.clear();

      if (typeof this.options.hooks.onFetchSuccess === "function") {
        this.options.hooks.onFetchSuccess(payload);
      }
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      this.state.error = error;

      if (typeof this.options.hooks.onFetchError === "function") {
        this.options.hooks.onFetchError(error);
      }
    } finally {
      this.setLoading(false);
    }
  }

  emitHooks(processed) {
    if (
      typeof this.options.hooks.onPageChange === "function" &&
      this.lastEmittedPage !== processed.currentPage
    ) {
      this.options.hooks.onPageChange(processed.currentPage);
      this.lastEmittedPage = processed.currentPage;
    }

    if (typeof this.options.hooks.onSortChange === "function") {
      const sortState = {
        sortKey: this.state.sortKey,
        sortDirection: this.state.sortDirection,
      };

      if (
        !this.lastSortState ||
        this.lastSortState.sortKey !== sortState.sortKey ||
        this.lastSortState.sortDirection !== sortState.sortDirection
      ) {
        this.options.hooks.onSortChange(sortState);
        this.lastSortState = sortState;
      }
    }

    if (
      typeof this.options.hooks.onSearchChange === "function" &&
      this.lastSearchQuery !== this.state.searchQuery
    ) {
      this.options.hooks.onSearchChange(this.state.searchQuery);
      this.lastSearchQuery = this.state.searchQuery;
    }

    if (typeof this.options.hooks.onUpdate === "function") {
      this.options.hooks.onUpdate({
        ...processed,
        loading: this.state.loading,
        error: this.state.error,
        searchQuery: this.state.searchQuery,
        sortKey: this.state.sortKey,
        sortDirection: this.state.sortDirection,
        expandedRowIds: [...this.state.expandedRowIds],
      });
    }
  }

  async update({ skipFetch = false } = {}) {
    if (this.isRemote() && !skipFetch) {
      await this.fetchData();
    }

    const processed = this.getProcessedData();

    this.renderHeader(processed.rows);

    if (this.state.error) {
      this.renderError();
      return;
    }

    if (this.state.loading) {
      this.renderLoading();
      return;
    }

    this.saveState();
    this.renderBody(processed.displayRows);
    this.renderMeta(processed);
    this.renderPagination(processed);
    this.emitHooks(processed);
  }

  destroy() {
    if (this.elements.thead && this.boundHandlers.onHeadClick) {
      this.elements.thead.removeEventListener(
        "click",
        this.boundHandlers.onHeadClick
      );
    }

    if (this.elements.thead && this.boundHandlers.onHeadKeydown) {
      this.elements.thead.removeEventListener(
        "keydown",
        this.boundHandlers.onHeadKeydown
      );
    }

    if (this.elements.tbody && this.boundHandlers.onBodyClick) {
      this.elements.tbody.removeEventListener(
        "click",
        this.boundHandlers.onBodyClick
      );
    }

    if (this.elements.pagination && this.boundHandlers.onPaginationClick) {
      this.elements.pagination.removeEventListener(
        "click",
        this.boundHandlers.onPaginationClick
      );
    }

    if (this.elements.searchInput && this.boundHandlers.onSearchInput) {
      this.elements.searchInput.removeEventListener(
        "input",
        this.boundHandlers.onSearchInput
      );
    }

    if (this.debouncedSearch && typeof this.debouncedSearch.cancel === "function") {
      this.debouncedSearch.cancel();
    }

    if (this.fetcher) {
      this.fetcher.abort();
    }

    this.container.innerHTML = "";
    this.elements = {};
    this.boundHandlers = {};

    if (typeof this.options.hooks.onDestroy === "function") {
      this.options.hooks.onDestroy();
    }
  }
}
