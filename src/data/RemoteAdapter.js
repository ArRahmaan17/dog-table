import { DataFetcher } from "../core/data-fetcher.js";

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export class RemoteAdapter {
  constructor(config) {
    this.fetcher = config ? new DataFetcher(config) : null;
    this.dataCache = new Map();
    this.requestCache = new Map();
    this.queryCache = new Map();
  }

  isEnabled() {
    return Boolean(this.fetcher);
  }

  getQueryKey(state) {
    if (!this.fetcher) {
      return "";
    }

    return this.fetcher.buildUrl(state, { includePagination: false });
  }

  getRequestKey(state) {
    if (!this.fetcher) {
      return "";
    }

    return this.fetcher.buildUrl(state);
  }

  getPagination(state) {
    const queryKey = this.getQueryKey(state);
    return this.queryCache.get(queryKey)?.pagination || null;
  }

  savePagination(state, pagination) {
    const queryKey = this.getQueryKey(state);
    const existing = this.queryCache.get(queryKey) || {};

    this.queryCache.set(queryKey, {
      ...existing,
      pagination: {
        ...existing.pagination,
        ...pagination,
      },
    });
  }

  aliasRows(rows) {
    const dataHash = stableSerialize(rows);

    if (!this.dataCache.has(dataHash)) {
      this.dataCache.set(dataHash, rows);
    }

    return {
      dataHash,
      rows: this.dataCache.get(dataHash),
    };
  }

  rememberResult(state, payload) {
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const { dataHash, rows: aliasedRows } = this.aliasRows(rows);
    const requestKey = this.getRequestKey(state);
    const queryKey = this.getQueryKey(state);
    const existing = this.queryCache.get(queryKey) || {};

    this.requestCache.set(requestKey, {
      dataRef: dataHash,
      queryKey,
    });

    this.queryCache.set(queryKey, {
      ...existing,
      dataRef: dataHash,
      requestKey,
    });

    return {
      ...(payload || {}),
      rows: aliasedRows,
      dataRef: dataHash,
      queryKey,
      requestKey,
    };
  }

  async fetch(state) {
    if (!this.fetcher) {
      return null;
    }

    const payload = await this.fetcher.fetch(state);
    return this.rememberResult(state, payload);
  }

  abort() {
    if (this.fetcher) {
      this.fetcher.abort();
    }
  }
}
