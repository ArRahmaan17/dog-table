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
    const currentPage = processed.currentPage ?? 1;
    const totalPages = processed.totalPages ?? 1;
    const prevDisabled = currentPage <= 1;
    const nextDisabled = currentPage >= totalPages;
    const pageNumbers = this.getVisiblePageNumbers(currentPage, totalPages);
    const pageTemplate = options.language?.page || "Page {page} of {total}";
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
              page === currentPage
                ? theme.get("paginationPageActive")
                : "",
            ]
              .filter(Boolean)
              .join(" ")}"
            data-page="${page}"
            aria-current="${page === currentPage ? "page" : "false"}"
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
        data-page="${currentPage - 1}"
        ${prevDisabled ? "disabled" : ""}
      >
        ${escapeHtml(options.language?.previous || "Prev")}
      </button>
      <div class="${theme.get("paginationPages")}">${numberedButtons}</div>
      <span class="${theme.get("paginationStatus")}">
        ${escapeHtml(
          pageTemplate
            .replace("{page}", currentPage)
            .replace("{total}", totalPages)
        )}
      </span>
      <button
        type="button"
        class="${theme.get("button")}"
        data-page="${currentPage + 1}"
        ${nextDisabled ? "disabled" : ""}
      >
        ${escapeHtml(options.language?.next || "Next")}
      </button>
    `;
  }
}
