import { escapeHtml } from "../utils/index.js";

export class MetaRenderer {
  constructor(table) {
    this.table = table;
  }

  renderLoading() {
    const { elements, theme, options, state } = this.table;
    console.log("[MetaRenderer.renderLoading] rendering skeleton - pageSize:", state.pageSize, "cols:", this.table.getVisibleColumnCount());
    console.log("[MetaRenderer.renderLoading] clearing _rowNodes cache before tbody.innerHTML overwrite");
    if (this.table.tableRenderer) {
      this.table.tableRenderer.clearRowCache();
    }
    const rowsCount = state.pageSize;
    const colsCount = this.table.getVisibleColumnCount();
    let rowsHtml = "";

    for (let rowIndex = 0; rowIndex < rowsCount; rowIndex += 1) {
      let colsHtml = "";

      for (let colIndex = 0; colIndex < colsCount; colIndex += 1) {
        colsHtml += `
          <td class="${theme.get("bodyCell")}">
            <div class="${theme.get("skeleton")}"></div>
          </td>
        `;
      }

      rowsHtml += `<tr class="${theme.get("bodyRow")}">${colsHtml}</tr>`;
    }

    elements.tbody.innerHTML = rowsHtml;
    elements.meta.textContent = options.language.loading;
    if (elements.pagination) {
      elements.pagination.innerHTML = "";
    }
  }

  renderError() {
    const { elements, theme, options, state } = this.table;

    elements.tbody.innerHTML = `
      <tr>
        <td colspan="${this.table.getVisibleColumnCount()}" class="${theme.get(
          "emptyCell"
        )}">
          ${escapeHtml(state.error?.message || options.language.error)}
        </td>
      </tr>
    `;
    elements.meta.textContent = options.language.error;
    if (elements.pagination) {
      elements.pagination.innerHTML = "";
    }
  }

  renderMeta(processed) {
    const { elements, options, state } = this.table;
    const showingTemplate = options.language?.showing || "Showing {start}-{end} of {total}";

    if (!processed || processed.totalItems === 0) {
      elements.meta.textContent = state.searchQuery
        ? options.language?.noResults || "No matching rows"
        : options.language?.emptyState || "No data to display.";
      return;
    }

    elements.meta.textContent = showingTemplate
      .replace("{start}", processed.startIndex)
      .replace("{end}", processed.endIndex)
      .replace("{total}", processed.totalItems);
  }

  renderToast() {
    const { elements, state } = this.table;

    if (!elements.toastRegion) {
      return;
    }

    if (!state.toast?.message) {
      elements.toastRegion.innerHTML = "";
      return;
    }

    elements.toastRegion.innerHTML = `
      <div class="dt-toast dt-toast--${escapeHtml(state.toast.type || "info")}">
        ${escapeHtml(state.toast.message)}
      </div>
    `;
  }
}
