import { ThemeManager } from "./theme-manager.js";
import { TableState } from "./TableState.js";
import { DataEngine } from "./DataEngine.js";
import { EventBinder } from "./EventBinder.js";
import { RemoteAdapter } from "../data/RemoteAdapter.js";
import { TableRenderer } from "../renderers/TableRenderer.js";
import { PaginationRenderer } from "../renderers/PaginationRenderer.js";
import { MetaRenderer } from "../renderers/MetaRenderer.js";
import { PluginManager } from "../plugin/PluginManager.js";
import { debounce } from "../utils/index.js";

const DEFAULT_PAGE_SIZE = 5;

export class DogTable {
  constructor(container, options = {}) {
    this.container =
      typeof container === "string"
        ? document.querySelector(container)
        : container;

    if (!this.container) {
      throw new Error("DogTable container was not found.");
    }

    this.options = {
      data: [],
      columns: [],
      pagination: true,
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
        createTrigger: "New Record",
        createTitle: "Create New Record",
        createDescription: "Add a new row and sync it to your data source.",
        createSubmit: "Save Record",
        createSaving: "Saving...",
        createCancel: "Cancel",
        createSuccess: "New record added successfully.",
        createError: "Unable to save this record.",
        createValidationError: "Please correct the highlighted fields.",
        updateSuccess: "Row updated successfully.",
        updateError: "Unable to update this row.",
        syncSaving: "Saving",
        syncSaved: "Saved",
        syncFailed: "Sync Failed",
        ...(options.language || {}),
      },
      initialSort: null,
      searchDebounce: 250,
      fetchDebounce: 0,
      theme: "default",
      classNames: {},
      remote: null,
      groupBy: null,
      groupLabel: null,
      rowKey: null,
      rowDetail: null,
      create: null,
      persistence: null,
      persistenceKey: null,
      selectable: false,
      paginationGuard: false,
      hooks: {},
      ...options,
    };

    if (this.options.pagination === false && this.options.paginationGuard) {
      console.warn(
        "DogTable: `paginationGuard` is ignored when `pagination` is false."
      );
    }

    const initialSort =
      this.options.initialSort &&
      typeof this.options.initialSort === "object" &&
      this.options.initialSort.key
        ? this.options.initialSort
        : null;

    this.tableState = new TableState(this.options, initialSort);
    this.state = this.tableState.state;
    this.elements = {};
    this.lastEmittedPage = null;
    this.lastSearchQuery = null;
    this.lastSortState = null;
    this.theme = new ThemeManager(this.options.theme, this.options.classNames);
    this.remoteAdapter = new RemoteAdapter(this.options.remote);
    this.fetcher = this.remoteAdapter.fetcher;
    this.rowIds = new WeakMap();
    this.rowIdCounter = 0;
    this.highlightTimeoutId = null;
    this.syncStatusTimeoutId = null;
    this.toastTimeoutId = null;
    this._pendingUpdate = false;
    this._fetchPromise = null;
    this.tableRenderer = new TableRenderer(this);
    this.paginationRenderer = new PaginationRenderer(this);
    this.metaRenderer = new MetaRenderer(this);
    this.dataEngine = new DataEngine(this);
    this._pipelineCache = this.dataEngine.cache;
    this.eventBinder = new EventBinder(this);
    this.boundHandlers = this.eventBinder.boundHandlers;
    this.plugins = new PluginManager(this);
    this.plugins.initialize();
    this.tableState.normalizeConstraints();

    if (this.options.fetchDebounce > 0) {
      this._debouncedFetch = debounce(() => {
        this._executeFetch();
      }, this.options.fetchDebounce);
    }
  }

  init() {
    this.renderStructure();
    this.bindEvents();
    this.plugins.initRuntime();
    this.update();

    if (typeof this.options.hooks.onInit === "function") {
      this.options.hooks.onInit(this.getState());
    }

    return this;
  }

  renderStructure() {
    this.tableRenderer.renderStructure();
  }

  bindEvents() {
    this.eventBinder.bind();
    this.boundHandlers = this.eventBinder.boundHandlers;
  }

  isRemote() {
    return this.remoteAdapter.isEnabled();
  }

  hasRowDetail() {
    return (
      this.options.rowDetail &&
      typeof this.options.rowDetail.render === "function"
    );
  }

  getVisibleColumnCount() {
    return (
      this.state.columns.filter((column) => column.visible !== false).length +
      (this.hasRowDetail() ? 1 : 0) +
      (this.options.selectable ? 1 : 0)
    );
  }

  loadState() {
    this.persistence.load();
    this.tableState.normalizeConstraints();
  }

  saveState() {
    this.persistence.save();
  }

  toPositiveInteger(value, fallback = 1) {
    return this.tableState.toPositiveInteger(value, fallback);
  }

  getPaginationGuardConfig() {
    return this.tableState.getPaginationGuardConfig();
  }

  clampPage(pageNumber) {
    return this.tableState.clampPage(pageNumber);
  }

  clampPageSize(pageSize) {
    return this.tableState.clampPageSize(pageSize);
  }

  isPaginationEnabled() {
    return this.options.pagination !== false;
  }

  normalizeStateConstraints() {
    this.tableState.normalizeConstraints();
  }

  rememberQueryPagination(overrides = {}) {
    if (!this.isRemote()) {
      return;
    }

    const totalItems = Number.isFinite(overrides.totalItems)
      ? overrides.totalItems
      : this.state.totalItems;
    const rawTotalPages = Math.max(
      1,
      Math.ceil(Math.max(0, totalItems) / Math.max(1, this.state.pageSize))
    );
    const guard = this.getPaginationGuardConfig();
    const totalPages = Number.isFinite(overrides.totalPages)
      ? overrides.totalPages
      : guard
        ? Math.min(rawTotalPages, guard.maxPage)
        : rawTotalPages;

    this.remoteAdapter.savePagination(this.state, {
      page: this.state.currentPage,
      pageSize: this.state.pageSize,
      totalItems,
      totalPages,
    });
  }

  restoreQueryPagination() {
    if (!this.isRemote()) {
      return false;
    }

    const pagination = this.remoteAdapter.getPagination(this.state);

    if (!pagination) {
      this.rememberQueryPagination();
      return false;
    }

    if (pagination.pageSize != null) {
      this.state.pageSize = this.clampPageSize(pagination.pageSize);
    }

    if (pagination.page != null) {
      this.state.currentPage = this.clampPage(pagination.page);
    }

    if (pagination.totalItems != null) {
      this.state.totalItems = Number(pagination.totalItems) || 0;
    }

    return true;
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

  toggleSort(columnKey) {
    const column = this.state.columns.find((item) => item.key === columnKey);

    if (!column || column.sortable === false) {
      return;
    }

    if (this.tableState.toggleSort(columnKey)) {
      this.update();
    }
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

    if (this.isRemote()) {
      this.rememberQueryPagination();
    }

    if (this.tableState.setSort(sortKey, direction)) {
      this.restoreQueryPagination();
      this.saveState();
      this.update();
    }
  }

  clearSort() {
    if (this.isRemote()) {
      this.rememberQueryPagination();
    }

    if (this.tableState.clearSort()) {
      this.restoreQueryPagination();
      this.saveState();
      this.update();
    }
  }

  toggleRowDetail(rowId) {
    if (!this.hasRowDetail()) {
      return;
    }

    const expanded = this.tableState.toggleRowDetail(rowId);

    if (typeof this.options.hooks.onRowToggle === "function") {
      this.options.hooks.onRowToggle({
        rowId,
        expanded,
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
    if (this.tableState.setPage(pageNumber)) {
      this.rememberQueryPagination();
      this.saveState();
      this.update();
    }
  }

  setSearch(query) {
    if (this.isRemote()) {
      this.rememberQueryPagination();
    }

    if (!this.tableState.setSearch(query)) {
      return;
    }

    this.restoreQueryPagination();

    if (this.elements.searchInput) {
      this.elements.searchInput.value = query ?? "";
    }

    this.saveState();
    this.update();
  }

  clearSearch() {
    this.setSearch("");
  }

  openCreateModal() {
    this.create.open();
  }

  setPageSize(pageSize) {
    if (this.tableState.setPageSize(pageSize)) {
      this.rememberQueryPagination();
      this.saveState();
      this.update();
    }
  }

  setData(data) {
    this.tableState.setData(data);
    this.dataEngine.reset();
    this.update();
  }

  setColumns(columns) {
    this.tableState.setColumns(columns);
    this.dataEngine.reset();
    this.update();
  }

  setTheme(theme, classNames = {}) {
    this.theme = new ThemeManager(theme, classNames);
    this.tableRenderer = new TableRenderer(this);
    this.paginationRenderer = new PaginationRenderer(this);
    this.metaRenderer = new MetaRenderer(this);
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
    if (this.isRemote()) {
      this.rememberQueryPagination();
    }

    this.tableState.reset();

    if (this.elements.searchInput) {
      this.elements.searchInput.value = "";
    }

    this.update();
  }

  getState() {
    return {
      ...this.state,
      rawData: this.state.rawData,
      columns: this.state.columns,
      expandedRowIds: [...this.state.expandedRowIds],
      selectedRows: [...this.state.selectedRows],
    };
  }

  setSyncStatus(status, { autoClearMs } = {}) {
    this.state.syncStatus = status ? { ...status } : null;

    if (this.syncStatusTimeoutId) {
      clearTimeout(this.syncStatusTimeoutId);
      this.syncStatusTimeoutId = null;
    }

    if (status && autoClearMs !== 0) {
      const timeout = autoClearMs ?? (status.state === "saving" ? 0 : 2600);

      if (timeout > 0) {
        this.syncStatusTimeoutId = window.setTimeout(() => {
          this.state.syncStatus = null;
          this.live.updateUI();
        }, timeout);
      }
    }

    this.live.updateUI();
  }

  highlightRow(rowId, duration = 2600) {
    this.state.highlightedRowId = rowId ? String(rowId) : null;

    if (this.highlightTimeoutId) {
      clearTimeout(this.highlightTimeoutId);
      this.highlightTimeoutId = null;
    }

    if (this.state.highlightedRowId) {
      this.highlightTimeoutId = window.setTimeout(() => {
        this.state.highlightedRowId = null;
        this.update({ skipFetch: true });
      }, duration);
    }

    this.update({ skipFetch: true });
  }

  renderToast() {
    this.metaRenderer.renderToast();
  }

  showToast(message, type = "info", duration = 2600) {
    this.state.toast = {
      message: String(message || ""),
      type,
    };

    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }

    this.renderToast();

    if (duration > 0) {
      this.toastTimeoutId = window.setTimeout(() => {
        this.state.toast = null;
        this.renderToast();
      }, duration);
    }
  }

  getSelectedData() {
    return this.selection.getSelectedData();
  }

  toggleRowSelection(rowId, isSelected) {
    this.selection.toggleRow(rowId, isSelected);
  }

  selectAll(isSelected) {
    this.selection.selectAll(isSelected);
  }

  toggleColumnVisibility(columnKey, isVisible) {
    const column = this.state.columns.find((item) => item.key === columnKey);

    if (column) {
      column.visible = isVisible;
      this.update({ skipFetch: true });
    }
  }

  exportCSV(filename) {
    this.exporter.toCSV(filename);
  }

  setLoading(isLoading) {
    this.tableState.setLoading(isLoading);

    if (typeof this.options.hooks.onLoadingChange === "function") {
      this.options.hooks.onLoadingChange(isLoading);
    }
  }

  getProcessedData() {
    const processed = this.dataEngine.process(this.state);

    if (!processed || typeof processed !== "object") {
      return {
        rows: [],
        filteredRows: [],
        displayRows: [],
        totalItems: 0,
        totalPages: 1,
        currentPage: 1,
        pageSize: this.state.pageSize ?? 5,
        startIndex: 0,
        endIndex: 0,
      };
    }

    if (processed.currentPage !== this.state.currentPage) {
      this.tableState.syncCurrentPage(processed.currentPage);
    }

    return processed;
  }

  isAllSelected(rows) {
    return this.selection.isAllSelected(rows);
  }

  isSomeSelected(rows) {
    return this.selection.isSomeSelected(rows);
  }

  renderHeader(rows = []) {
    this.tableRenderer.renderHeader(rows);
  }

  renderLoading() {
    this.metaRenderer.renderLoading();
  }

  renderError() {
    this.metaRenderer.renderError();
  }

  renderBody(displayRows) {
    this.tableRenderer.renderBody(displayRows);
  }

  renderMeta(processed) {
    this.metaRenderer.renderMeta(processed);
  }

  renderPagination(processed) {
    this.paginationRenderer.render(processed);
  }

  async _executeFetch() {
    if (!this.isRemote()) {
      return;
    }

    if (this._fetchPromise) {
      return this._fetchPromise;
    }

    this._fetchPromise = this._doFetch().finally(() => {
      this._fetchPromise = null;
    });

    return this._fetchPromise;
  }

  async _doFetch() {
    this.setLoading(true);
    this.tableState.setError(null);
    this.renderLoading();

    if (typeof this.options.hooks.onFetchStart === "function") {
      this.options.hooks.onFetchStart(this.getState());
    }

    try {
      const payload = await this.remoteAdapter.fetch(this.state, {
        includePagination: this.isPaginationEnabled(),
      });

      this.tableState.setRemoteData(payload);
      this.dataEngine.reset();

      const totalPages = this.isPaginationEnabled()
        ? Math.max(1, Math.ceil(this.state.totalItems / this.state.pageSize))
        : 1;
      if (this.state.currentPage > totalPages && totalPages > 0) {
        this.tableState.syncCurrentPage(totalPages);
        return this._doFetch();
      }

      this.live.handleFetchSuccess(payload);

      if (typeof this.options.hooks.onFetchSuccess === "function") {
        this.options.hooks.onFetchSuccess(payload);
      }

      if (typeof this.options.hooks.onDataUpdated === "function") {
        this.options.hooks.onDataUpdated(this.state.rawData);
      }
    } catch (error) {
      this.dataEngine.reset();

      if (error.name === "AbortError") {
        return;
      }

      this.tableState.setError(error);
      this.live.handleFetchError(error);

      if (typeof this.options.hooks.onFetchError === "function") {
        this.options.hooks.onFetchError(error);
      }
    } finally {
      this.setLoading(false);
    }
  }

  fetchData() {
    if (!this.isRemote()) {
      return;
    }

    if (this._debouncedFetch) {
      this._debouncedFetch();
    } else {
      return this._executeFetch();
    }
  }

  fetchNow() {
    if (this._debouncedFetch) {
      this._debouncedFetch.cancel();
    }
    return this._executeFetch();
  }

  emitHooks(processed) {
    if (!processed || typeof processed !== "object") {
      return;
    }

    const rows = Array.isArray(processed.rows) ? processed.rows : [];
    const filteredRows = Array.isArray(processed.filteredRows) ? processed.filteredRows : [];
    const displayRows = Array.isArray(processed.displayRows) ? processed.displayRows : [];

    if (
      typeof this.options.hooks.onPageChange === "function" &&
      this.lastEmittedPage !== processed.currentPage
    ) {
      this.options.hooks.onPageChange(processed.currentPage ?? 1);
      this.lastEmittedPage = processed.currentPage ?? 1;
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
        rows,
        filteredRows,
        displayRows,
        totalItems: processed.totalItems ?? 0,
        totalPages: processed.totalPages ?? 1,
        currentPage: processed.currentPage ?? 1,
        pageSize: processed.pageSize ?? 5,
        startIndex: processed.startIndex ?? 0,
        endIndex: processed.endIndex ?? 0,
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
    if (this._pendingUpdate) {
      return new Promise((resolve) => {
        const check = () => {
          if (!this._pendingUpdate) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      });
    }

    this._pendingUpdate = true;

    return new Promise((resolve) => {
      requestAnimationFrame(async () => {
        if (this.isRemote() && !skipFetch) {
          await this.fetchData();
        }

        const processed = this.getProcessedData();

        this.renderHeader(processed.rows);

        if (this.state.error) {
          this.renderError();
          this._pendingUpdate = false;
          resolve();
          return;
        }

        if (this.state.loading) {
          this.renderLoading();
          this._pendingUpdate = false;
          resolve();
          return;
        }

        this.saveState();
        this.renderBody(processed.displayRows);
        this.renderMeta(processed);
        this.renderPagination(processed);
        this.rememberQueryPagination({
          totalItems: processed.totalItems,
          totalPages: processed.totalPages,
        });
        this.renderToast();
        this.create.updateUI();
        this.live.updateUI();
        this.emitHooks(processed);
        this._pendingUpdate = false;
        resolve();
      });
    });
  }

  updateSync({ skipFetch = false } = {}) {
    if (this._pendingUpdate) {
      return;
    }

    this._pendingUpdate = true;

    const runUpdate = async () => {
      if (this.isRemote() && !skipFetch) {
        await this.fetchData();
      }

      const processed = this.getProcessedData();

      this.renderHeader(processed.rows);

      if (this.state.error) {
        this.renderError();
        this._pendingUpdate = false;
        return;
      }

      if (this.state.loading) {
        this.renderLoading();
        this._pendingUpdate = false;
        return;
      }

      this.saveState();
      this.renderBody(processed.displayRows);
      this.renderMeta(processed);
      this.renderPagination(processed);
      this.rememberQueryPagination({
        totalItems: processed.totalItems,
        totalPages: processed.totalPages,
      });
      this.renderToast();
      this.create.updateUI();
      this.live.updateUI();
      this.emitHooks(processed);
      this._pendingUpdate = false;
    };

    runUpdate();
  }

  destroy() {
    this.eventBinder.unbind();
    this.remoteAdapter.abort();
    this.plugins.destroy();

    if (this.highlightTimeoutId) {
      clearTimeout(this.highlightTimeoutId);
    }

    if (this.syncStatusTimeoutId) {
      clearTimeout(this.syncStatusTimeoutId);
    }

    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }

    this.container.innerHTML = "";
    this.elements = {};
    this.boundHandlers = {};

    if (typeof this.options.hooks.onDestroy === "function") {
      this.options.hooks.onDestroy();
    }
  }
}

export { DogTable as DataTable };
