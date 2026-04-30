import { escapeHtml } from "../utils/index.js";

export class MetaRenderer {
  constructor(table) {
    this.table = table;
  }

  renderLoading() {
    const { elements, theme, options, state } = this.table;
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
    elements.pagination.innerHTML = "";
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
    elements.pagination.innerHTML = "";
  }

  renderMeta(processed) {
    const { elements, options, state } = this.table;

    if (processed.totalItems === 0) {
      elements.meta.textContent = state.searchQuery
        ? options.language.noResults
        : options.language.emptyState;
      return;
    }

    elements.meta.textContent = options.language.showing
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
