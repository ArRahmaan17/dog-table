export class DataFetcher {
  constructor(config) {
    this.config = config;
    this.controller = null;
  }

  buildUrl(state) {
    const baseUrl = new URL(this.config.url, window.location.href);
    const params = new URLSearchParams(baseUrl.search);
    const queryKeys = {
      page: "page",
      pageSize: "pageSize",
      sort: "sort",
      order: "order",
      search: "search",
      ...(this.config.queryParams || {}),
    };

    params.set(queryKeys.page, state.currentPage);
    params.set(queryKeys.pageSize, state.pageSize);

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

  async fetch(state) {
    if (this.controller) {
      this.controller.abort();
    }

    this.controller = new AbortController();

    const response = await fetch(this.buildUrl(state), {
      method: this.config.method || "GET",
      headers: this.config.headers,
      signal: this.controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = await response.json();

    if (typeof this.config.mapResponse === "function") {
      return this.config.mapResponse(payload, state);
    }

    const dataKey = this.config.dataKey || "data";
    const totalKey = this.config.totalKey || "total";

    return {
      rows: Array.isArray(payload[dataKey]) ? payload[dataKey] : [],
      totalItems: Number(payload[totalKey]) || 0,
    };
  }

  abort() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }
}
