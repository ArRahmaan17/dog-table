import { escapeHtml } from "../utils/index.js";

export class TableRenderer {
  constructor(table) {
    this.table = table;
  }

  renderStructure() {
    const { container, theme, options, state } = this.table;

    container.innerHTML = `
      <div class="${theme.get("shell")}">
        <div class="${theme.get("toolbar")}">
          <label class="${theme.get("search")}">
            <span class="${theme.get("searchLabel")}">${escapeHtml(
              options.language.search
            )}</span>
            <input
              class="${theme.get("searchInput")}"
              type="search"
              placeholder="${escapeHtml(options.language.searchPlaceholder)}"
              value="${escapeHtml(state.searchQuery)}"
              aria-label="${escapeHtml(options.language.search)}"
            />
          </label>
          <div class="dt-toolbar-actions">
            <div class="dt-create-entry"></div>
            <div class="${theme.get("meta")}" aria-live="polite"></div>
            <div class="dt-live-status"></div>
          </div>
        </div>
        <div class="${theme.get("tableWrap")}">
          <table class="${theme.get("table")}">
            <thead class="${theme.get("thead")}"></thead>
            <tbody class="${theme.get("tbody")}"></tbody>
          </table>
        </div>
        <div class="${theme.get("pagination")}" aria-label="Pagination controls"></div>
        <div class="dt-modal-region"></div>
        <div class="dt-toast-region" aria-live="polite"></div>
      </div>
    `;

    this.table.elements.search = container.querySelector(theme.getSelector("search"));
    this.table.elements.searchInput = container.querySelector("input[type='search']");
    this.table.elements.meta = container.querySelector(theme.getSelector("meta"));
    this.table.elements.thead = container.querySelector("thead");
    this.table.elements.tbody = container.querySelector("tbody");
    this.table.elements.pagination = container.querySelector(
      "[aria-label='Pagination controls']"
    );
    this.table.elements.modalRegion = container.querySelector(".dt-modal-region");
    this.table.elements.toastRegion = container.querySelector(".dt-toast-region");

    if (!options.searchable && this.table.elements.search) {
      this.table.elements.search.hidden = true;
    }
  }

  renderHeader(rows = []) {
    const { options, state, theme, elements } = this.table;
    const isAllSelected = options.selectable && this.table.isAllSelected(rows);
    const headers = state.columns
      .filter((column) => column.visible !== false)
      .map((column) => {
        const isSorted = state.sortKey === column.key;
        const direction = isSorted ? state.sortDirection : "none";
        const sortable = column.sortable !== false;
        const label = escapeHtml(column.label ?? column.key);
        const indicator =
          direction === "asc" ? " ▲" : direction === "desc" ? " ▼" : "";

        return `
          <th
            scope="col"
            data-column="${escapeHtml(column.key)}"
            data-sortable="${sortable}"
            aria-sort="${direction}"
            ${sortable ? 'tabindex="0"' : ""}
            class="${[
              theme.get("headerCell"),
              sortable ? theme.get("sortableHeader") : "",
            ]
              .filter(Boolean)
              .join(" ")}"
          >
            <span>${label}${indicator}</span>
          </th>
        `;
      })
      .join("");

    const detailHeader = this.table.hasRowDetail()
      ? `<th scope="col" class="${theme.get("headerCell")}">${escapeHtml(
          options.language.details
        )}</th>`
      : "";

    const selectionHeader = options.selectable
      ? `<th scope="col" class="${theme.get("headerCell")}">
           <input type="checkbox" data-bulk-checkbox ${
             isAllSelected ? "checked" : ""
           } aria-label="Select all rows" />
         </th>`
      : "";

    elements.thead.innerHTML = `<tr>${selectionHeader}${detailHeader}${headers}</tr>`;

    if (options.selectable) {
      const bulk = elements.thead.querySelector("input[data-bulk-checkbox]");
      if (bulk) {
        const isSome = this.table.isSomeSelected(rows);
        const isAll = this.table.isAllSelected(rows);
        bulk.indeterminate = isSome && !isAll;
      }
    }
  }

  renderDetailContent(row, rowId) {
    if (!this.table.hasRowDetail()) {
      return null;
    }

    return this.table.options.rowDetail.render(row, {
      rowId,
      collapse: () => this.table.collapseRowDetail(rowId),
      expand: () => this.table.expandRowDetail(rowId),
      toggle: () => this.table.toggleRowDetail(rowId),
    });
  }

  renderBody(displayRows) {
    const { elements, state, theme, options, formatter } = this.table;

    if (displayRows.length === 0) {
      elements.tbody.innerHTML = `
        <tr>
          <td colspan="${this.table.getVisibleColumnCount()}" class="${theme.get(
            "emptyCell"
          )}">
            ${escapeHtml(
              state.searchQuery
                ? options.language.noResults
                : options.language.emptyState
            )}
          </td>
        </tr>
      `;
      return;
    }

    elements.tbody.innerHTML = "";

    const fragment = document.createDocumentFragment();

    displayRows.forEach((item) => {
      if (item.type === "group") {
        const groupRow = document.createElement("tr");
        groupRow.className = theme.get("groupRow");

        const groupCell = document.createElement("td");
        groupCell.className = theme.get("groupCell");
        groupCell.colSpan = this.table.getVisibleColumnCount();
        groupCell.textContent = item.label;

        groupRow.appendChild(groupCell);
        fragment.appendChild(groupRow);
        return;
      }

      const { row, rowId } = item;
      const tr = document.createElement("tr");
      tr.className = theme.get("bodyRow");
      tr.dataset.rowId = rowId;

      if (state.highlightedRowId === rowId) {
        tr.classList.add("dt-row--highlight");
      }

      if (this.table.hasRowDetail()) {
        const detailToggleCell = document.createElement("td");
        detailToggleCell.className = theme.get("detailToggleCell");

        const detailButton = document.createElement("button");
        detailButton.type = "button";
        detailButton.className = theme.get("detailToggle");
        detailButton.dataset.detailToggle = rowId;
        detailButton.setAttribute(
          "aria-expanded",
          state.expandedRowIds.has(rowId) ? "true" : "false"
        );
        detailButton.setAttribute("aria-controls", `dt-detail-${rowId}`);
        detailButton.textContent = this.table.getRowDetailLabel(
          row,
          state.expandedRowIds.has(rowId)
        );

        detailToggleCell.appendChild(detailButton);
        tr.appendChild(detailToggleCell);
      }

      if (options.selectable) {
        const selectionCell = document.createElement("td");
        selectionCell.className = theme.get("bodyCell");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.rowCheckbox = rowId;
        checkbox.checked = state.selectedRows.has(rowId);
        checkbox.setAttribute("aria-label", `Select row ${rowId}`);

        selectionCell.appendChild(checkbox);
        tr.appendChild(selectionCell);
      }

      state.columns.forEach((column) => {
        if (column.visible === false) {
          return;
        }

        const td = document.createElement("td");
        td.className = theme.get("bodyCell");
        const key = column.accessor || column.key;
        td.dataset.field = key;

        if (column.editable) {
          td.classList.add("dt-editable");
        }

        const value = row[key];
        const formatted = formatter.format(value, column, row);
        const hasCustomRenderer = typeof column.render === "function";
        const rendered = hasCustomRenderer ? column.render(formatted, row) : formatted;

        if (rendered instanceof Node) {
          td.appendChild(rendered);
        } else if (hasCustomRenderer && typeof rendered === "string") {
          td.innerHTML = rendered;
        } else if (rendered != null) {
          td.textContent = String(rendered);
        }

        tr.appendChild(td);
      });

      fragment.appendChild(tr);

      if (this.table.hasRowDetail() && state.expandedRowIds.has(rowId)) {
        const detailRow = document.createElement("tr");
        detailRow.className = theme.get("detailRow");

        const detailCell = document.createElement("td");
        detailCell.className = theme.get("detailCell");
        detailCell.colSpan = this.table.getVisibleColumnCount();
        detailCell.id = `dt-detail-${rowId}`;

        const detailContent = this.renderDetailContent(row, rowId);

        if (detailContent instanceof Node) {
          detailCell.appendChild(detailContent);
        } else if (detailContent != null) {
          detailCell.textContent = String(detailContent);
        }

        detailRow.appendChild(detailCell);
        fragment.appendChild(detailRow);
      }
    });

    elements.tbody.appendChild(fragment);
  }
}
