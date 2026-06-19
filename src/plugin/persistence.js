import { debounce } from "../utils/index.js";

export class PersistencePlugin {
  constructor(table) {
    this.table = table;
    this.debouncedSave = debounce(() => this._save(), 250);
  }

  getKey(suffix = "") {
    const key =
      this.table.options.persistenceKey || `dt-${this.table.container.id || "state"}`;

    return suffix ? `${key}:${suffix}` : key;
  }

  getStorage() {
    if (this.table.options.persistence === "local") {
      return localStorage;
    }

    if (this.table.options.persistence === "session") {
      return sessionStorage;
    }

    return null;
  }

  getSerializableState() {
    return this.table.tableState.createSnapshot();
  }

  load() {
    if (!this.table.options.persistence) return;
    const key = this.getKey();
    let saved = null;

    try {
      const storage = this.getStorage();

      if (storage) {
        saved = JSON.parse(storage.getItem(key));
      } else if (this.table.options.persistence === "url") {
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
      console.warn("DogTable Persistence: Failed to load state", e);
    }

    if (saved) {
      this.table.tableState.restoreSnapshot(saved);
    }
  }

  save() {
    if (!this.table.options.persistence) return;
    const key = this.getKey();
    const toSave = this.getSerializableState();
    const storage = this.getStorage();

    if (storage) {
      storage.setItem(key, JSON.stringify(toSave));
    } else if (this.table.options.persistence === "url") {
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

  saveView(name) {
    const viewName = String(name || "").trim();

    if (!viewName) {
      return false;
    }

    const snapshot = this.getSerializableState();
    const storage = this.getStorage();

    if (storage) {
      storage.setItem(this.getKey(`view:${viewName}`), JSON.stringify(snapshot));
    } else {
      this.table.state.views[viewName] = snapshot;
    }

    return true;
  }

  loadView(name) {
    const viewName = String(name || "").trim();

    if (!viewName) {
      return false;
    }

    const storage = this.getStorage();
    let snapshot = this.table.state.views[viewName] || null;

    if (storage) {
      try {
        snapshot = JSON.parse(storage.getItem(this.getKey(`view:${viewName}`)));
      } catch (error) {
        console.warn("DogTable Persistence: Failed to load view", error);
      }
    }

    if (!snapshot) {
      return false;
    }

    return this.table.tableState.restoreSnapshot(snapshot);
  }

  deleteView(name) {
    const viewName = String(name || "").trim();

    if (!viewName) {
      return false;
    }

    const storage = this.getStorage();

    if (storage) {
      storage.removeItem(this.getKey(`view:${viewName}`));
    } else {
      delete this.table.state.views[viewName];
    }

    return true;
  }
}
