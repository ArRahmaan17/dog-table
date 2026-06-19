import { ThemeManager } from "./theme-manager.js";
import { TableState } from "./TableState.js";
import { DataEngine } from "./DataEngine.js";
import { EventBinder } from "./EventBinder.js";
import { VirtualScroller } from "./VirtualScroller.js";
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
      filterDebounce: 250,
      fetchDebounce: 0,
      theme: "default",
      classNames: {},
      remote: null,
      optimisticUpdates: false,
      groupBy: null,
      groupLabel: null,
      rowKey: null,
      rowDetail: null,
      create: null,
      persistence: null,
      persistenceKey: null,
      urlState: false,
      selectable: false,
      filterRow: false,
      paginationGuard: false,
      virtualScroll: false,
      dataWorker: false,
      lazyColumns: false,
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
    this.rowLookup = new Map();
    this.rowLookupDataRef = null;
    this.columnLookup = new Map();
    this.highlightTimeoutId = null;
    this.syncStatusTimeoutId = null;
    this.toastTimeoutId = null;
    this._pendingUpdate = false;
    this._fetchPromise = null;
    this._fetchRequestKey = null;
    this._fetchSequence = 0;
    this._activeFetchSequence = 0;
    this._updatePromise = null;
    this._queuedSkipFetch = true;
    this._debouncedFetchPromise = null;
    this._resolveDebouncedFetch = null;
    this._rejectDebouncedFetch = null;
    this.tableRenderer = new TableRenderer(this);
    this.paginationRenderer = new PaginationRenderer(this);
    this.metaRenderer = new MetaRenderer(this);
    this.dataEngine = new DataEngine(this);
    this._pipelineCache = this.dataEngine.cache;
    this.virtualScroller = new VirtualScroller(this);
    this.eventBinder = new EventBinder(this);
    this.boundHandlers = this.eventBinder.boundHandlers;
    this.rebuildColumnLookup();
    this.plugins = new PluginManager(this);
    this.plugins.initialize();
    this.tableState.normalizeConstraints();

    if (this.options.fetchDebounce > 0) {
      this._debouncedFetch = debounce(() => {
        const resolve = this._resolveDebouncedFetch;
        const reject = this._rejectDebouncedFetch;

        this._debouncedFetchPromise = null;
        this._resolveDebouncedFetch = null;
        this._rejectDebouncedFetch = null;

        this._executeFetch().then(resolve, reject);
      }, this.options.fetchDebounce);
    }
  }

  init() {
    this.renderStructure();
    this.bindEvents();
    this.setupVirtualScroll();
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

  isCursorPagination() {
    return this.options.remote?.pagination === "cursor";
  }

  hasRowDetail() {
    return (
      this.options.rowDetail &&
      typeof this.options.rowDetail.render === "function"
    );
  }

  getVisibleColumnCount() {
    return (
      this.getVisibleColumns().length +
      (this.hasRowDetail() ? 1 : 0) +
      (this.options.selectable ? 1 : 0)
    );
  }

  getVisibleColumns() {
    return this.state.columns.filter((column) => column.visible !== false);
  }

  loadState() {
    this.persistence.load();
    this.tableState.normalizeConstraints();
  }

  saveState() {
    this.persistence.save();
    this.urlState.scheduleSave();
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

  getVirtualScrollConfig() {
    if (!this.options.virtualScroll) {
      return null;
    }

    return this.options.virtualScroll === true
      ? {}
      : typeof this.options.virtualScroll === "object"
        ? this.options.virtualScroll
        : null;
  }

  setupVirtualScroll() {
    const config = this.getVirtualScrollConfig();

    this.virtualScroller.disable();

    if (config) {
      this.virtualScroller.enable(config);
    }
  }

  normalizeStateConstraints() {
    this.tableState.normalizeConstraints();
  }

  rebuildColumnLookup() {
    this.columnLookup.clear();

    this.state.columns.forEach((column) => {
      if (column.key != null) {
        this.columnLookup.set(String(column.key), column);
      }

      if (column.accessor != null) {
        this.columnLookup.set(String(column.accessor), column);
      }
    });
  }

  getColumn(columnKey) {
    return this.columnLookup.get(String(columnKey));
  }

  getColumnByField(field) {
    return this.getColumn(field);
  }

  resetRowLookup() {
    this.rowLookup.clear();
    this.rowLookupDataRef = null;
  }

  rebuildRowLookup() {
    this.rowLookup.clear();

    this.state.rawData.forEach((row) => {
      this.rowLookup.set(this.getRowId(row), row);
    });

    this.rowLookupDataRef = this.state.rawData;
  }

  getRowById(rowId) {
    if (this.rowLookupDataRef !== this.state.rawData) {
      this.rebuildRowLookup();
    }

    return this.rowLookup.get(String(rowId)) || null;
  }

  rememberQueryPagination(overrides = {}) {
    if (!this.isRemote() || !this.isPaginationEnabled()) {
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
    if (!this.isRemote() || !this.isPaginationEnabled()) {
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
    const column = this.getColumn(columnKey);

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

    const column = this.getColumn(sortKey);

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
    if (this.isCursorPagination()) {
      const nextPage = this.clampPage(pageNumber);
      let cursor = this.state.cursorHistory[nextPage];

      if (nextPage > this.state.currentPage) {
        cursor = this.state.nextCursor;
      } else if (nextPage < this.state.currentPage) {
        cursor = this.state.cursorHistory[nextPage] ?? this.state.prevCursor;
      }

      if (nextPage !== 1 && !cursor) {
        return;
      }

      this.state.cursorHistory[this.state.currentPage] = this.state.cursor;

      if (this.tableState.setCursorPage(nextPage, cursor)) {
        this.saveState();
        this.update();
      }

      return;
    }

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

  setFilters(filters = {}) {
    if (this.isRemote()) {
      this.rememberQueryPagination();
    }

    if (!this.tableState.setFilters(filters)) {
      return;
    }

    this.restoreQueryPagination();
    this.saveState();
    this.dataEngine.reset();
    this.update();
  }

  setFilter(field, value) {
    this.setFilters({
      ...this.state.filters,
      [field]: value,
    });
  }

  clearFilters() {
    if (this.tableState.clearFilters()) {
      this.saveState();
      this.dataEngine.reset();
      this.update();
    }
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
    this.resetRowLookup();
    this.dataEngine.reset();
    this.update();
  }

  addRow(row, { position = "start", skipRender = false } = {}) {
    if (!row || typeof row !== "object") {
      return null;
    }

    if (position === "end") {
      this.state.rawData.push(row);
    } else {
      this.state.rawData.unshift(row);
    }

    this.state.totalItems += 1;
    this.state.error = null;
    this.resetRowLookup();
    this.dataEngine.reset();

    if (!skipRender) {
      this.update({ skipFetch: true });
    }

    return row;
  }

  updateRow(rowId, patch, { skipRender = false } = {}) {
    const row = this.getRowById(rowId);

    if (!row || !patch || typeof patch !== "object") {
      return null;
    }

    Object.assign(row, patch);
    this.dataEngine.reset();

    if (!skipRender) {
      this.update({ skipFetch: true });
    }

    return row;
  }

  removeRow(rowId, { skipRender = false } = {}) {
    const id = String(rowId);
    const index = this.state.rawData.findIndex(
      (row) => this.getRowId(row) === id
    );

    if (index < 0) {
      return null;
    }

    const [removed] = this.state.rawData.splice(index, 1);
    this.state.selectedRows.delete(id);
    this.state.expandedRowIds.delete(id);
    this.state.totalItems = Math.max(0, this.state.totalItems - 1);
    this.resetRowLookup();
    this.dataEngine.reset();

    if (!skipRender) {
      this.update({ skipFetch: true });
    }

    return removed;
  }

  setColumns(columns) {
    this.tableState.setColumns(columns);
    this.rebuildColumnLookup();
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
    this.setupVirtualScroll();
    this.update({ skipFetch: true });
  }

  setLanguage(language) {
    this.options.language = {
      ...this.options.language,
      ...language,
    };
    this.renderStructure();
    this.bindEvents();
    this.setupVirtualScroll();
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
    const column = this.getColumn(columnKey);
    const nextVisible =
      typeof isVisible === "boolean" ? isVisible : !(column?.visible !== false);

    if (this.tableState.setColumnVisibility(columnKey, nextVisible)) {
      this.saveState();
      this.update({ skipFetch: true });
    }
  }

  showColumn(columnKey) {
    this.toggleColumnVisibility(columnKey, true);
  }

  hideColumn(columnKey) {
    this.toggleColumnVisibility(columnKey, false);
  }

  toggleColumn(columnKey) {
    this.toggleColumnVisibility(columnKey);
  }

  saveView(name) {
    return this.persistence.saveView(name);
  }

  loadView(name) {
    if (this.persistence.loadView(name)) {
      this.restoreQueryPagination();
      this.saveState();
      this.update();
      return true;
    }

    return false;
  }

  deleteView(name) {
    return this.persistence.deleteView(name);
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

    return this.normalizeProcessedData(processed);
  }

  async getProcessedDataAsync() {
    const processed = await this.dataEngine.processAsync(this.state);

    return this.normalizeProcessedData(processed);
  }

  normalizeProcessedData(processed) {
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
    if (this.virtualScroller.enabled && displayRows.length > 0) {
      this.virtualScroller.render(displayRows);
      return;
    }

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

    const requestKey = this.remoteAdapter.getRequestKey(this.state, {
      includePagination: this.isPaginationEnabled(),
    });

    if (this._fetchPromise && this._fetchRequestKey === requestKey) {
      return this._fetchPromise;
    }

    const fetchSequence = this._fetchSequence + 1;
    this._fetchSequence = fetchSequence;
    this._activeFetchSequence = fetchSequence;
    this._fetchRequestKey = requestKey;

    const fetchPromise = this._doFetch(fetchSequence).finally(() => {
      if (this._fetchPromise === fetchPromise) {
        this._fetchPromise = null;
        this._fetchRequestKey = null;
      }
    });

    this._fetchPromise = fetchPromise;

    return fetchPromise;
  }

  async _doFetch(fetchSequence = this._activeFetchSequence) {
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

      if (fetchSequence !== this._activeFetchSequence) {
        return;
      }

      this.tableState.setRemoteData(payload);
      this.resetRowLookup();
      this.dataEngine.reset();

      const totalPages = this.isPaginationEnabled()
        ? Math.max(1, Math.ceil(this.state.totalItems / this.state.pageSize))
        : 1;
      if (this.state.currentPage > totalPages && totalPages > 0) {
        this.tableState.syncCurrentPage(totalPages);
        return this._doFetch(fetchSequence);
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

      if (error.name === "AbortError" || fetchSequence !== this._activeFetchSequence) {
        return;
      }

      this.tableState.setError(error);
      this.live.handleFetchError(error);

      if (typeof this.options.hooks.onFetchError === "function") {
        this.options.hooks.onFetchError(error);
      }
    } finally {
      if (fetchSequence === this._activeFetchSequence) {
        this.setLoading(false);
      }
    }
  }

  fetchData() {
    if (!this.isRemote()) {
      return;
    }

    if (this._debouncedFetch) {
      if (!this._debouncedFetchPromise) {
        this._debouncedFetchPromise = new Promise((resolve, reject) => {
          this._resolveDebouncedFetch = resolve;
          this._rejectDebouncedFetch = reject;
        });
      }

      this._debouncedFetch();
      return this._debouncedFetchPromise;
    }

    return this._executeFetch();
  }

  fetchNow() {
    const resolve = this._resolveDebouncedFetch;
    const reject = this._rejectDebouncedFetch;

    if (this._debouncedFetch) {
      this._debouncedFetch.cancel();
    }

    this._debouncedFetchPromise = null;
    this._resolveDebouncedFetch = null;
    this._rejectDebouncedFetch = null;

    return this._executeFetch().then(
      (result) => {
        if (resolve) {
          resolve(result);
        }
        return result;
      },
      (error) => {
        if (reject) {
          reject(error);
        }
        throw error;
      }
    );
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
    this._queuedSkipFetch = this._updatePromise
      ? this._queuedSkipFetch && skipFetch
      : skipFetch;

    if (!this._updatePromise) {
      this._pendingUpdate = true;

      this._updatePromise = new Promise((resolve) => {
        requestAnimationFrame(async () => {
          const queuedSkipFetch = this._queuedSkipFetch;

          this._queuedSkipFetch = true;

          try {
            await this._runUpdate({ skipFetch: queuedSkipFetch });
          } finally {
            this._pendingUpdate = false;
            this._updatePromise = null;
            resolve();
          }
        });
      });
    }

    return this._updatePromise;
  }

  async _runUpdate({ skipFetch = false } = {}) {
    if (this.isRemote() && !skipFetch) {
      await this.fetchData();
    }

    const processed = await this.getProcessedDataAsync();

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
    this.rememberQueryPagination({
      totalItems: processed.totalItems,
      totalPages: processed.totalPages,
    });
    this.renderToast();
    this.create.updateUI();
    this.live.updateUI();
    this.emitHooks(processed);
  }

  updateSync({ skipFetch = false } = {}) {
    if (this._updatePromise) {
      return this._updatePromise;
    }

    this._pendingUpdate = true;

    this._updatePromise = this._runUpdate({ skipFetch }).finally(() => {
      this._pendingUpdate = false;
      this._updatePromise = null;
    });

    return this._updatePromise;
  }

  destroy() {
    this.eventBinder.unbind();
    this.remoteAdapter.abort();
    this.virtualScroller.destroy();
    this.dataEngine.destroy();
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
