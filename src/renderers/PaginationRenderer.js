import { escapeHtml } from "../utils/index.js";

export class PaginationRenderer {
  constructor(table) {
    this.table = table;
  }

  getVisiblePageNumbers(currentPage, totalPages) {
    const pages = new Set([
      1,
      totalPages,
      currentPage - 1,
      currentPage,
      currentPage + 1,
    ]);

    return [...pages]
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((left, right) => left - right);
  }

  render(processed) {
    const { elements, theme, options } = this.table;

    if (!elements.pagination) {
      return;
    }

    if (!this.table.isPaginationEnabled()) {
      elements.pagination.innerHTML = "";
      elements.pagination.hidden = true;
      return;
    }

    elements.pagination.hidden = false;
    const prevDisabled = processed.currentPage <= 1;
    const nextDisabled = processed.currentPage >= processed.totalPages;
    const pageNumbers = this.getVisiblePageNumbers(
      processed.currentPage,
      processed.totalPages
    );
    const numberedButtons = pageNumbers
      .map((page, index) => {
        const previous = pageNumbers[index - 1];
        const gap =
          previous && page - previous > 1
            ? `<span class="${theme.get("paginationGap")}">…</span>`
            : "";
        const button = `
          <button
            type="button"
            class="${[
              theme.get("paginationPage"),
              page === processed.currentPage
                ? theme.get("paginationPageActive")
                : "",
            ]
              .filter(Boolean)
              .join(" ")}"
            data-page="${page}"
            aria-current="${page === processed.currentPage ? "page" : "false"}"
          >
            ${page}
          </button>
        `;

        return `${gap}${button}`;
      })
      .join("");

    elements.pagination.innerHTML = `
      <button
        type="button"
        class="${theme.get("button")}"
        data-page="${processed.currentPage - 1}"
        ${prevDisabled ? "disabled" : ""}
      >
        ${escapeHtml(options.language.previous)}
      </button>
      <div class="${theme.get("paginationPages")}">${numberedButtons}</div>
      <span class="${theme.get("paginationStatus")}">
        ${escapeHtml(
          options.language.page
            .replace("{page}", processed.currentPage)
            .replace("{total}", processed.totalPages)
        )}
      </span>
      <button
        type="button"
        class="${theme.get("button")}"
        data-page="${processed.currentPage + 1}"
        ${nextDisabled ? "disabled" : ""}
      >
        ${escapeHtml(options.language.next)}
      </button>
    `;
  }
}
