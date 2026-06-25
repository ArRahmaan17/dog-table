import { debounce } from "../utils/index.js";

function readSort(value) {
  if (!value) {
    return {};
  }

  const [key, direction] = String(value).split(":");
  return {
    sortKey: key || null,
    sortDirection: direction === "desc" ? "desc" : "asc",
  };
}

function writeSort(state) {
  return state.sortKey ? `${state.sortKey}:${state.sortDirection || "asc"}` : "";
}

export class UrlStatePlugin {
  constructor(table) {
    this.table = table;
    this.debouncedSave = debounce(() => this.save(), 150);
  }

  isEnabled() {
    return this.table.options.urlState === true;
  }

  load() {
    if (!this.isEnabled() || typeof window === "undefined") {
      return false;
    }

    const params = new URLSearchParams(window.location.search);
    const visibility = {};
    const filters = {};

    params.getAll("hidden").forEach((key) => {
      visibility[key] = false;
    });

    params.forEach((value, key) => {
      if (key.startsWith("filter.")) {
        filters[key.slice(7)] = value;
      }
    });

    const snapshot = {
      searchQuery: params.get("search") || undefined,
      currentPage: params.get("page") || undefined,
      pageSize: params.get("pageSize") || undefined,
      ...readSort(params.get("sort")),
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      columnVisibility:
        Object.keys(visibility).length > 0 ? visibility : undefined,
    };

    return this.table.tableState.restoreSnapshot(snapshot);
  }

  save() {
    if (!this.isEnabled() || typeof window === "undefined") {
      return;
    }

    const { state } = this.table;
    const url = new URL(window.location.href);

    if (state.searchQuery) {
      url.searchParams.set("search", state.searchQuery);
    } else {
      url.searchParams.delete("search");
    }

    url.searchParams.set("page", state.currentPage);
    url.searchParams.set("pageSize", state.pageSize);

    const sort = writeSort(state);
    if (sort) {
      url.searchParams.set("sort", sort);
    } else {
      url.searchParams.delete("sort");
    }

    url.searchParams.delete("hidden");
    [...url.searchParams.keys()]
      .filter((key) => key.startsWith("filter."))
      .forEach((key) => url.searchParams.delete(key));

    Object.entries(state.columnVisibility || {}).forEach(([key, isVisible]) => {
      if (!isVisible) {
        url.searchParams.append("hidden", key);
      }
    });

    Object.entries(state.filters || {}).forEach(([key, value]) => {
      if (value != null && String(value) !== "") {
        url.searchParams.set(`filter.${key}`, value);
      }
    });

    window.history.replaceState({}, "", url);
  }

  scheduleSave() {
    if (this.isEnabled()) {
      this.debouncedSave();
    }
  }

  destroy() {
    if (this.debouncedSave?.cancel) {
      this.debouncedSave.cancel();
    }
  }
}
