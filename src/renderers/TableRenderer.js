import { escapeHtml } from "../utils/index.js";

export class TableRenderer {
  constructor(table) {
    this.table = table;
    this._rowNodes = new Map();
    this._rowOrder = [];
  }

  clearRowCache() {
    this._rowNodes.clear();
    this._rowOrder = [];
  }

  renderStructure() {
    const { container, theme, options, state } = this.table;
    const tableClass = [
      theme.get("table"),
      options.stickyHeader ? "dt-sticky-header" : "",
      options.resizableColumns ? "dt-resizable-table" : "",
      options.columnReorder ? "dt-reorderable-table" : "",
    ]
      .filter(Boolean)
      .join(" ");

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
          <table class="${tableClass}">
            <thead class="${theme.get("thead")}"></thead>
            <tbody class="${theme.get("tbody")}"></tbody>
          </table>
        </div>
        <div
          class="${theme.get("pagination")}"
          aria-label="Pagination controls"
          ${this.table.isPaginationEnabled() ? "" : "hidden"}
        ></div>
        <div class="dt-modal-region"></div>
        <div class="dt-toast-region" aria-live="polite"></div>
      </div>
    `;

    this.table.elements.search = container.querySelector(theme.getSelector("search"));
    this.table.elements.searchInput = container.querySelector("input[type='search']");
    this.table.elements.meta = container.querySelector(theme.getSelector("meta"));
    this.table.elements.tableWrap = container.querySelector(
      theme.getSelector("tableWrap")
    );
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
    const visibleColumns = this.table.getVisibleColumns();
    const headers = visibleColumns
      .map((column, index) => {
        const isSorted = state.sortKey === column.key;
        const direction = isSorted ? state.sortDirection : "none";
        const sortable = column.sortable !== false;
        const label = escapeHtml(column.label ?? column.key);
        const indicator =
          direction === "asc" ? " ▲" : direction === "desc" ? " ▼" : "";
        const style = this.getColumnStyle(column, index);
        const draggable = options.columnReorder ? 'draggable="true"' : "";
        const filter = options.filterRow
          ? this.renderFilterControl(column)
          : "";
        const resizeHandle = options.resizableColumns
          ? '<span class="dt-column-resize" data-resize-handle aria-hidden="true"></span>'
          : "";

        return `
          <th
            scope="col"
            data-column="${escapeHtml(column.key)}"
            data-sortable="${sortable}"
            aria-sort="${direction}"
            ${sortable ? 'tabindex="0"' : ""}
            ${draggable}
            ${style ? `style="${style}"` : ""}
            class="${[
              theme.get("headerCell"),
              sortable ? theme.get("sortableHeader") : "",
              options.lazyColumns ? "dt-lazy-column" : "",
              this.isStickyColumn(column) ? "dt-sticky-column" : "",
            ]
              .filter(Boolean)
              .join(" ")}"
          >
            <span>${label}${indicator}</span>
            ${filter}
            ${resizeHandle}
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

  renderFilterControl(column) {
    const key = column.accessor || column.key;

    if (!key || column.filterable === false) {
      return "";
    }

    const value = this.table.state.filters?.[key] ?? "";
    const label = column.label || key;
    const filterType = column.filterType || "text";

    if (filterType === "select") {
      const options = (column.filterOptions || column.options || [])
        .map((option) => {
          const optionValue =
            option && typeof option === "object" ? option.value : option;
          const optionLabel =
            option && typeof option === "object"
              ? option.label ?? optionValue
              : option;

          return `
            <option
              value="${escapeHtml(optionValue ?? "")}"
              ${String(value) === String(optionValue ?? "") ? "selected" : ""}
            >
              ${escapeHtml(optionLabel ?? "")}
            </option>
          `;
        })
        .join("");

      return `
        <select
          class="dt-filter-control"
          data-filter-field="${escapeHtml(key)}"
          aria-label="Filter ${escapeHtml(label)}"
        >
          <option value=""></option>
          ${options}
        </select>
      `;
    }

    const type = filterType === "date" ? "date" : "text";

    return `
      <input
        class="dt-filter-control"
        type="${type}"
        value="${escapeHtml(value)}"
        data-filter-field="${escapeHtml(key)}"
        placeholder="${escapeHtml(column.filterPlaceholder || "")}"
        aria-label="Filter ${escapeHtml(label)}"
      />
    `;
  }

  isStickyColumn(column) {
    const stickyColumns = this.table.options.stickyColumns;
    const key = column.accessor || column.key;

    return Array.isArray(stickyColumns) && stickyColumns.map(String).includes(String(key));
  }

  getColumnWidth(column) {
    const key = column.accessor || column.key;
    return this.table.state.columnWidths[key] || column.width || null;
  }

  getStickyOffset(columnIndex) {
    let offset = 0;
    const columns = this.table.getVisibleColumns();

    for (let index = 0; index < columnIndex; index += 1) {
      const column = columns[index];

      if (this.isStickyColumn(column)) {
        offset += Number(this.getColumnWidth(column)) || 160;
      }
    }

    return offset;
  }

  getColumnStyle(column, columnIndex) {
    const declarations = [];
    const width = this.getColumnWidth(column);

    if (width) {
      declarations.push(`width:${Number(width)}px`);
      declarations.push(`min-width:${Number(width)}px`);
    }

    if (this.isStickyColumn(column)) {
      declarations.push(`left:${this.getStickyOffset(columnIndex)}px`);
    }

    return declarations.join(";");
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
      this._rowNodes.clear();
      this._rowOrder = [];
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

    const newRowIds = new Set();
    const nextOrder = [];
    let needsFullRebuild = false;

    displayRows.forEach((item, index) => {
      if (item.type === "group") {
        const groupKey = this._getGroupKey(item, index);
        newRowIds.add(groupKey);
        nextOrder.push(groupKey);

        const groupRow = this._rowNodes.get(groupKey);
        if (!groupRow || !groupRow.parentNode) {
          needsFullRebuild = true;
          return;
        }

        this._updateGroupRow(groupRow, item, theme);
        return;
      }

      const { row, rowId } = item;
      newRowIds.add(rowId);
      nextOrder.push(rowId);

      let tr = this._rowNodes.get(rowId);

      if (!tr || !tr.parentNode) {
        needsFullRebuild = true;
        return;
      }

      this._updateRowContent(tr, item, state, theme, options, formatter);

      if (this.table.hasRowDetail() && state.expandedRowIds.has(rowId)) {
        const detailKey = this._getDetailKey(rowId);
        const detailRow = this._rowNodes.get(detailKey);

        newRowIds.add(detailKey);
        nextOrder.push(detailKey);

        if (!detailRow || !detailRow.parentNode) {
          needsFullRebuild = true;
          return;
        }

        this._updateDetailRow(detailRow, row, rowId, theme);
      }
    });

    if (!needsFullRebuild && !this._hasSameRowOrder(nextOrder)) {
      needsFullRebuild = true;
    }

    if (needsFullRebuild || this._rowNodes.size === 0) {
      const nextRowNodes = new Map();
      const fragment = document.createDocumentFragment();

      elements.tbody.innerHTML = "";

      displayRows.forEach((item, index) => {
        if (item.type === "group") {
          const groupKey = this._getGroupKey(item, index);
          const groupRow = this._createGroupRow(item, theme);

          fragment.appendChild(groupRow);
          nextRowNodes.set(groupKey, groupRow);
          return;
        }

        const { row, rowId } = item;
        const tr = document.createElement("tr");
        tr.className = theme.get("bodyRow");
        tr.dataset.rowId = rowId;

        if (state.highlightedRowId === rowId) {
          tr.classList.add("dt-row--highlight");
        }

        this._buildRowContent(tr, item, state, theme, options, formatter);

        fragment.appendChild(tr);
        nextRowNodes.set(rowId, tr);

        if (this.table.hasRowDetail() && state.expandedRowIds.has(rowId)) {
          const detailKey = this._getDetailKey(rowId);
          const detailRow = this._createDetailRow(row, rowId, theme);

          fragment.appendChild(detailRow);
          nextRowNodes.set(detailKey, detailRow);
        }
      });

      elements.tbody.appendChild(fragment);
      this._rowNodes = nextRowNodes;
    }

    const removedKeys = [...this._rowNodes.keys()].filter(
      (key) => !newRowIds.has(key)
    );
    removedKeys.forEach((key) => {
      const node = this._rowNodes.get(key);
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
      this._rowNodes.delete(key);
    });

    this._rowOrder = nextOrder;
  }

  _getGroupKey(item, index) {
    return `group-${item.groupValue}-${index}`;
  }

  _getDetailKey(rowId) {
    return `detail-${rowId}`;
  }

  _hasSameRowOrder(nextOrder) {
    return (
      this._rowOrder.length === nextOrder.length &&
      this._rowOrder.every((key, index) => key === nextOrder[index])
    );
  }

  _createGroupRow(item, theme) {
    const groupRow = document.createElement("tr");
    groupRow.className = theme.get("groupRow");

    const groupCell = document.createElement("td");
    groupCell.className = theme.get("groupCell");
    groupCell.colSpan = this.table.getVisibleColumnCount();
    groupCell.textContent = item.label;

    groupRow.appendChild(groupCell);
    return groupRow;
  }

  _updateGroupRow(groupRow, item, theme) {
    groupRow.className = theme.get("groupRow");

    const groupCell = groupRow.firstElementChild;
    if (groupCell) {
      groupCell.className = theme.get("groupCell");
      groupCell.colSpan = this.table.getVisibleColumnCount();
      groupCell.textContent = item.label;
    }
  }

  _createDetailRow(row, rowId, theme) {
    const detailRow = document.createElement("tr");
    detailRow.className = theme.get("detailRow");

    const detailCell = document.createElement("td");
    detailCell.className = theme.get("detailCell");
    detailCell.colSpan = this.table.getVisibleColumnCount();
    detailCell.id = `dt-detail-${rowId}`;

    detailRow.appendChild(detailCell);
    this._updateDetailRow(detailRow, row, rowId, theme);

    return detailRow;
  }

  _updateDetailRow(detailRow, row, rowId, theme) {
    detailRow.className = theme.get("detailRow");

    const detailCell = detailRow.firstElementChild;
    if (!detailCell) {
      return;
    }

    detailCell.className = theme.get("detailCell");
    detailCell.colSpan = this.table.getVisibleColumnCount();
    detailCell.id = `dt-detail-${rowId}`;
    detailCell.innerHTML = "";

    const detailContent = this.renderDetailContent(row, rowId);

    if (detailContent instanceof Node) {
      detailCell.appendChild(detailContent);
    } else if (detailContent != null) {
      detailCell.textContent = String(detailContent);
    }
  }

  _buildRowContent(tr, item, state, theme, options, formatter) {
    const { row, rowId } = item;

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

    this.table.getVisibleColumns().forEach((column, index) => {
      const td = document.createElement("td");
      td.className = [
        theme.get("bodyCell"),
        options.lazyColumns ? "dt-lazy-column" : "",
        this.isStickyColumn(column) ? "dt-sticky-column" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const key = column.accessor || column.key;
      td.dataset.field = key;
      td.style.cssText = this.getColumnStyle(column, index);

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
  }

  _updateRowContent(tr, item, state, theme, options, formatter) {
    const { row, rowId } = item;

    tr.dataset.rowId = rowId;

    if (state.highlightedRowId === rowId) {
      tr.classList.add("dt-row--highlight");
    } else {
      tr.classList.remove("dt-row--highlight");
    }

    let cellIndex = 0;
    const cells = tr.children;

    if (this.table.hasRowDetail()) {
      const detailToggleCell = cells[cellIndex++];
      if (detailToggleCell) {
        const detailButton = detailToggleCell.querySelector("button");
        if (detailButton) {
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
        }
      }
    }

    if (options.selectable) {
      const selectionCell = cells[cellIndex++];
      if (selectionCell) {
        const checkbox = selectionCell.querySelector("input");
        if (checkbox) {
          checkbox.dataset.rowCheckbox = rowId;
          checkbox.checked = state.selectedRows.has(rowId);
          checkbox.setAttribute("aria-label", `Select row ${rowId}`);
        }
      }
    }

    this.table.getVisibleColumns().forEach((column, index) => {
      const td = cells[cellIndex++];
      if (!td) return;

      const key = column.accessor || column.key;
      td.className = [
        theme.get("bodyCell"),
        options.lazyColumns ? "dt-lazy-column" : "",
        this.isStickyColumn(column) ? "dt-sticky-column" : "",
      ]
        .filter(Boolean)
        .join(" ");
      td.dataset.field = key;
      td.style.cssText = this.getColumnStyle(column, index);

      if (column.editable) {
        td.classList.add("dt-editable");
      } else {
        td.classList.remove("dt-editable");
      }

      const value = row[key];
      const formatted = formatter.format(value, column, row);
      const hasCustomRenderer = typeof column.render === "function";
      const rendered = hasCustomRenderer ? column.render(formatted, row) : formatted;

      if (rendered instanceof Node) {
        td.innerHTML = "";
        td.appendChild(rendered);
      } else if (hasCustomRenderer && typeof rendered === "string") {
        td.innerHTML = rendered;
      } else if (rendered != null) {
        td.textContent = String(rendered);
      } else {
        td.textContent = "";
      }
    });
  }
}
