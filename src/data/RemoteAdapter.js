import { DataFetcher } from "../core/data-fetcher.js";

export class RemoteAdapter {
  constructor(config) {
    this.fetcher = config ? new DataFetcher(config) : null;
  }

  isEnabled() {
    return Boolean(this.fetcher);
  }

  async fetch(state) {
    if (!this.fetcher) {
      return null;
    }

    return this.fetcher.fetch(state);
  }

  abort() {
    if (this.fetcher) {
      this.fetcher.abort();
    }
  }
}
