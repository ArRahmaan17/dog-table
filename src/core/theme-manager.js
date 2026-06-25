const baseTheme = {
  shell: "dt-shell",
  toolbar: "dt-toolbar",
  search: "dt-search",
  searchLabel: "dt-search__label",
  searchInput: "dt-search__input",
  meta: "dt-meta",
  tableWrap: "dt-table-wrap",
  table: "dt-table",
  thead: "dt-thead",
  tbody: "dt-tbody",
  headerCell: "dt-header-cell",
  sortableHeader: "is-sortable",
  bodyRow: "dt-row",
  bodyCell: "dt-cell",
  groupRow: "dt-group-row",
  groupCell: "dt-group-cell",
  detailToggleCell: "dt-detail-toggle-cell",
  detailToggle: "dt-detail-toggle",
  detailRow: "dt-detail-row",
  detailCell: "dt-detail-cell",
  emptyCell: "dt-empty",
  loadingCell: "dt-loading",
  pagination: "dt-pagination",
  paginationPages: "dt-pagination__pages",
  paginationPage: "dt-pagination__page",
  paginationPageActive: "is-active",
  paginationGap: "dt-pagination__gap",
  paginationStatus: "dt-pagination__status",
  button: "dt-button",
  skeleton: "dt-skeleton",
};

const presets = {
  default: {
    ...baseTheme,
    shell: "dt-shell dt-theme-light",
  },
  light: {
    ...baseTheme,
    shell: "dt-shell dt-theme-light",
  },
  dark: {
    ...baseTheme,
    shell: "dt-shell dt-theme-dark",
  },
  bootstrap: {
    ...baseTheme,
    shell: "dt-shell card shadow-sm",
    toolbar: "dt-toolbar d-flex flex-wrap justify-content-between align-items-end gap-3",
    search: "dt-search",
    searchLabel: "dt-search__label form-label",
    searchInput: "dt-search__input form-control",
    meta: "dt-meta text-muted",
    tableWrap: "dt-table-wrap table-responsive",
    table: "dt-table table table-hover mb-0",
    headerCell: "dt-header-cell",
    groupCell: "dt-group-cell fw-semibold bg-light-subtle",
    detailToggle: "dt-detail-toggle btn btn-light btn-sm",
    detailCell: "dt-detail-cell bg-body-tertiary",
    pagination: "dt-pagination d-flex flex-wrap align-items-center justify-content-between gap-2",
    paginationPage: "dt-pagination__page btn btn-light btn-sm",
    paginationPageActive: "is-active btn-primary text-white",
    button: "dt-button btn btn-info btn-sm text-white",
    skeleton: "dt-skeleton placeholder col-12",
  },
  tailwind: {
    ...baseTheme,
    shell: "dt-shell rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50",
    toolbar: "dt-toolbar mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
    search: "dt-search grid gap-1.5",
    searchLabel: "dt-search__label text-xs font-semibold uppercase tracking-[0.2em] text-slate-500",
    searchInput:
      "dt-search__input w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-800 outline-none",
    meta: "dt-meta text-sm text-slate-500",
    tableWrap: "dt-table-wrap overflow-x-auto",
    table: "dt-table min-w-full border-collapse",
    headerCell: "dt-header-cell bg-slate-100 text-slate-700",
    groupCell: "dt-group-cell bg-slate-100 font-semibold text-slate-700",
    detailToggle:
      "dt-detail-toggle rounded-full bg-slate-200 px-3 py-1 text-slate-900",
    detailCell: "dt-detail-cell bg-slate-50 text-slate-700",
    pagination:
      "dt-pagination mt-4 flex flex-wrap items-center justify-between gap-3",
    paginationPages: "dt-pagination__pages flex items-center gap-2",
    paginationPage:
      "dt-pagination__page min-w-10 rounded-full bg-slate-200 px-3 py-2 text-slate-900",
    paginationPageActive:
      "is-active bg-slate-900 text-white",
    button:
      "dt-button rounded-full bg-cyan-700 px-4 py-2 text-white disabled:opacity-50",
    skeleton: "dt-skeleton animate-pulse bg-slate-200",
  },
};

const storageThemeKeys = ["dog-table-theme", "dogTableTheme", "theme"];

function appendClassNames(...sources) {
  const tokens = [];
  const seen = new Set();

  sources.forEach((source) => {
    if (!source || typeof source !== "string") {
      return;
    }

    source.split(/\s+/).forEach((token) => {
      if (!token || seen.has(token)) {
        return;
      }

      seen.add(token);
      tokens.push(token);
    });
  });

  return tokens.join(" ");
}

function prependClassNames(base, override) {
  return appendClassNames(override, base);
}

function resolveTheme(theme) {
  if (typeof theme === "string") {
    const normalizedTheme = normalizeThemeName(theme);
    return presets[normalizedTheme] || presets.default;
  }

  if (!theme || typeof theme !== "object") {
    return presets.default;
  }

  return {
    ...baseTheme,
    ...theme,
  };
}

function normalizeThemeName(theme) {
  if (typeof theme !== "string") {
    return "";
  }

  return theme.trim().replace(/^["']|["']$/g, "").toLowerCase();
}

function readThemeFromStorage(storage) {
  if (!storage) {
    return null;
  }

  try {
    for (const key of storageThemeKeys) {
      const value = normalizeThemeName(storage.getItem(key));

      if (value === "light" || value === "dark") {
        return value;
      }
    }
  } catch (_error) {
    return null;
  }

  return null;
}

function getStorage(storageName) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window[storageName] || null;
  } catch (_error) {
    return null;
  }
}

function resolveStoredTheme() {
  return (
    readThemeFromStorage(getStorage("localStorage")) ||
    readThemeFromStorage(getStorage("sessionStorage"))
  );
}

function mergeTheme(theme, overrides = {}) {
  if (!overrides || Object.keys(overrides).length === 0) {
    return { ...theme };
  }

  const merged = {};

  Object.keys(theme).forEach((key) => {
    merged[key] = prependClassNames(theme[key], overrides[key]);
  });

  Object.keys(overrides).forEach((key) => {
    if (!(key in merged)) {
      merged[key] = appendClassNames(overrides[key]);
    }
  });

  return merged;
}

export class ThemeManager {
  constructor(theme = "default", overrides = {}) {
    const preset = resolveTheme(theme);

    this.theme = mergeTheme(preset || presets.default, overrides);
    this._primaryCache = {};
  }

  get(key) {
    return this.theme[key] || "";
  }

  getSelector(key) {
    const primary = this.getPrimary(key);
    return primary ? `.${primary}` : "";
  }

  getPrimary(key) {
    if (this._primaryCache[key] !== undefined) {
      return this._primaryCache[key];
    }
    const val = this.get(key);
    this._primaryCache[key] = val ? val.split(" ")[0] : "";
    return this._primaryCache[key];
  }
}

export { presets as themePresets, resolveStoredTheme };
