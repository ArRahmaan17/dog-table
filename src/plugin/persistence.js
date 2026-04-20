export class PersistencePlugin {
  constructor(table) {
    this.table = table;
  }

  load() {
    if (!this.table.options.persistence) return;
    const key =
      this.table.options.persistenceKey || `dt-${this.table.container.id || "state"}`;
    let saved = null;

    try {
      if (this.table.options.persistence === "local") {
        saved = JSON.parse(localStorage.getItem(key));
      } else if (this.table.options.persistence === "session") {
        saved = JSON.parse(sessionStorage.getItem(key));
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
      console.warn("DataTable Persistence: Failed to load state", e);
    }

    if (saved) {
      if (saved.searchQuery !== undefined)
        this.table.state.searchQuery = saved.searchQuery;
      if (saved.currentPage !== undefined)
        this.table.state.currentPage = saved.currentPage;
      if (saved.sortKey !== undefined) this.table.state.sortKey = saved.sortKey;
      if (saved.sortDirection !== undefined)
        this.table.state.sortDirection = saved.sortDirection;
      if (saved.pageSize !== undefined) this.table.state.pageSize = saved.pageSize;
    }
  }

  save() {
    if (!this.table.options.persistence) return;
    const key =
      this.table.options.persistenceKey || `dt-${this.table.container.id || "state"}`;
    const toSave = {
      searchQuery: this.table.state.searchQuery,
      currentPage: this.table.state.currentPage,
      sortKey: this.table.state.sortKey,
      sortDirection: this.table.state.sortDirection,
      pageSize: this.table.state.pageSize,
    };

    if (this.table.options.persistence === "local") {
      localStorage.setItem(key, JSON.stringify(toSave));
    } else if (this.table.options.persistence === "session") {
      sessionStorage.setItem(key, JSON.stringify(toSave));
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
}
