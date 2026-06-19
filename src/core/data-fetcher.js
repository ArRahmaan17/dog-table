import { requestJson } from "./request.js";

export class DataFetcher {
  constructor(config) {
    this.config = config;
    this.controller = null;
    this.timeoutId = null;
    this.baseUrl = new URL(this.config.url, window.location.href);
    this.timeout = Number.isFinite(config.fetchTimeout) && config.fetchTimeout > 0
      ? config.fetchTimeout
      : 15000;
  }

  buildUrl(state, { includePagination = true } = {}) {
    const baseUrl = new URL(this.baseUrl.toString());
    const params = new URLSearchParams(baseUrl.search);
    const queryKeys = {
      page: "page",
      pageSize: "pageSize",
      sort: "sort",
      order: "order",
      search: "search",
      ...(this.config.queryParams || {}),
    };

    if (includePagination && this.config.pagination === "cursor") {
      params.delete(queryKeys.page);
      params.set(queryKeys.pageSize, state.pageSize);

      const cursorKey = this.config.cursorParam || "cursor";
      if (state.cursor) {
        params.set(cursorKey, state.cursor);
      } else {
        params.delete(cursorKey);
      }
    } else if (includePagination) {
      params.set(queryKeys.page, state.currentPage);
      params.set(queryKeys.pageSize, state.pageSize);
    } else {
      params.delete(queryKeys.page);
      params.delete(queryKeys.pageSize);
    }

    if (state.sortKey) {
      params.set(queryKeys.sort, state.sortKey);
      params.set(queryKeys.order, state.sortDirection);
    } else {
      params.delete(queryKeys.sort);
      params.delete(queryKeys.order);
    }

    if (state.searchQuery) {
      params.set(queryKeys.search, state.searchQuery);
    } else {
      params.delete(queryKeys.search);
    }

    const filters = state.filters || {};
    const filterParams =
      typeof this.config.filterParams === "function"
        ? this.config.filterParams(filters, state)
        : filters;

    if (filterParams instanceof URLSearchParams) {
      filterParams.forEach((value, key) => {
        params.set(key, value);
      });
    } else if (filterParams && typeof filterParams === "object") {
      Object.entries(filterParams).forEach(([key, value]) => {
        if (value == null || String(value) === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
    }

    if (typeof this.config.buildQuery === "function") {
      const nextParams = this.config.buildQuery(params, state);
      if (nextParams instanceof URLSearchParams) {
        baseUrl.search = nextParams.toString();
        return baseUrl.toString();
      }
    }

    baseUrl.search = params.toString();
    return baseUrl.toString();
  }

  async fetch(state, { includePagination = true } = {}) {
    if (this.controller) {
      this.controller.abort();
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.controller = new AbortController();

    const timeoutError = new Error(`Request timed out after ${this.timeout}ms`);
    timeoutError.name = "TimeoutError";
    timeoutError.status = 408;

    const timeoutPromise = new Promise((_, reject) => {
      this.timeoutId = setTimeout(() => {
        this.timeoutId = null;
        this.controller.abort(timeoutError);
        reject(timeoutError);
      }, this.timeout);
    });

    const fetchPromise = requestJson({
      url: this.buildUrl(state, { includePagination }),
      method: this.config.method || "GET",
      headers: this.config.headers,
      credentials: this.config.credentials,
      signal: this.controller.signal,
      requireHeaders: this.config.requireHeaders ?? false,
    }, {
      action: "fetch",
      state,
    });

    const { payload } = await Promise.race([fetchPromise, timeoutPromise]);

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (typeof this.config.mapResponse === "function") {
      const mapped = this.config.mapResponse(payload, state);

      return {
        ...(mapped || {}),
        rawPayload: payload,
      };
    }

    const dataKey = this.config.dataKey || "data";
    const totalKey = this.config.totalKey || "total";

    return {
      rows: Array.isArray(payload[dataKey]) ? payload[dataKey] : [],
      totalItems: Number(payload[totalKey]) || 0,
      rawPayload: payload,
    };
  }

  abort() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }
}
