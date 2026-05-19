export class VirtualScroller {
  constructor(table) {
    this.table = table;
    this.enabled = false;
    this.rowHeight = 48;
    this.bufferSize = 5;
    this.scrollTop = 0;
    this.viewportHeight = 0;
    this.totalRows = 0;
    this.startIndex = 0;
    this.endIndex = 0;
    this._boundScroll = this._onScroll.bind(this);
    this._boundResize = this._onResize.bind(this);
  }

  enable({ rowHeight = 48, bufferSize = 5 } = {}) {
    this.enabled = true;
    this.rowHeight = rowHeight;
    this.bufferSize = bufferSize;

    const wrap = this.table.elements.tableWrap;
    if (wrap) {
      wrap.style.overflowY = "auto";
      wrap.style.maxHeight = "600px";
      wrap.addEventListener("scroll", this._boundScroll);
    }

    window.addEventListener("resize", this._boundResize);
    this._measureViewport();
  }

  disable() {
    this.enabled = false;

    const wrap = this.table.elements.tableWrap;
    if (wrap) {
      wrap.style.overflowY = "";
      wrap.style.maxHeight = "";
      wrap.removeEventListener("scroll", this._boundScroll);
    }

    window.removeEventListener("resize", this._boundResize);
  }

  destroy() {
    this.disable();
  }

  _measureViewport() {
    const wrap = this.table.elements.tableWrap;
    if (wrap) {
      this.viewportHeight = wrap.clientHeight;
    }
  }

  _onScroll() {
    const wrap = this.table.elements.tableWrap;
    if (!wrap) return;

    this.scrollTop = wrap.scrollTop;
    this._calculateVisibleRange();
    this._updateSpacer();
  }

  _onResize() {
    this._measureViewport();
    this._calculateVisibleRange();
    this._updateSpacer();
  }

  _calculateVisibleRange() {
    const visibleCount = Math.ceil(this.viewportHeight / this.rowHeight);
    const start = Math.max(0, Math.floor(this.scrollTop / this.rowHeight) - this.bufferSize);
    const end = Math.min(this.totalRows, start + visibleCount + this.bufferSize * 2);

    if (this.startIndex !== start || this.endIndex !== end) {
      this.startIndex = start;
      this.endIndex = end;
      this._renderVisibleRows();
    }
  }

  _updateSpacer() {
    const spacer = this.table.elements.tbody.querySelector(".dt-virtual-spacer-top");
    const bottomSpacer = this.table.elements.tbody.querySelector(".dt-virtual-spacer-bottom");

    if (spacer) {
      spacer.style.height = `${this.startIndex * this.rowHeight}px`;
    }

    if (bottomSpacer) {
      const remaining = (this.totalRows - this.endIndex) * this.rowHeight;
      bottomSpacer.style.height = `${Math.max(0, remaining)}px`;
    }
  }

  _renderVisibleRows() {
    const { elements, state, theme, options, formatter } = this.table;
    const displayRows = this.table.getProcessedData().displayRows;

    if (!displayRows || displayRows.length === 0) return;

    this.totalRows = displayRows.length;

    const visibleRows = displayRows.slice(this.startIndex, this.endIndex);

    elements.tbody.innerHTML = "";

    const topSpacer = document.createElement("tr");
    topSpacer.className = "dt-virtual-spacer-top";
    topSpacer.style.height = `${this.startIndex * this.rowHeight}px`;

    const td = document.createElement("td");
    td.colSpan = this.table.getVisibleColumnCount();
    topSpacer.appendChild(td);
    elements.tbody.appendChild(topSpacer);

    visibleRows.forEach((item) => {
      if (item.type === "group") {
        const groupRow = document.createElement("tr");
        groupRow.className = theme.get("groupRow");

        const groupCell = document.createElement("td");
        groupCell.className = theme.get("groupCell");
        groupCell.colSpan = this.table.getVisibleColumnCount();
        groupCell.textContent = item.label;

        groupRow.appendChild(groupCell);
        elements.tbody.appendChild(groupRow);
        return;
      }

      const { row, rowId } = item;
      const tr = document.createElement("tr");
      tr.className = theme.get("bodyRow");
      tr.dataset.rowId = rowId;
      tr.style.height = `${this.rowHeight}px`;

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

      elements.tbody.appendChild(tr);

      if (this.table.hasRowDetail() && state.expandedRowIds.has(rowId)) {
        const detailRow = document.createElement("tr");
        detailRow.className = theme.get("detailRow");

        const detailCell = document.createElement("td");
        detailCell.className = theme.get("detailCell");
        detailCell.colSpan = this.table.getVisibleColumnCount();
        detailCell.id = `dt-detail-${rowId}`;

        const detailContent = this.table.tableRenderer.renderDetailContent(row, rowId);

        if (detailContent instanceof Node) {
          detailCell.appendChild(detailContent);
        } else if (detailContent != null) {
          detailCell.textContent = String(detailContent);
        }

        detailRow.appendChild(detailCell);
        elements.tbody.appendChild(detailRow);
      }
    });

    const bottomSpacer = document.createElement("tr");
    bottomSpacer.className = "dt-virtual-spacer-bottom";
    const remaining = (this.totalRows - this.endIndex) * this.rowHeight;
    bottomSpacer.style.height = `${Math.max(0, remaining)}px`;

    const bottomTd = document.createElement("td");
    bottomTd.colSpan = this.table.getVisibleColumnCount();
    bottomSpacer.appendChild(bottomTd);
    elements.tbody.appendChild(bottomSpacer);
  }

  setTotalRows(count) {
    this.totalRows = count;
    this._updateSpacer();
  }
}
