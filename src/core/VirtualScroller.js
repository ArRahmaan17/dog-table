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
    this.displayRows = [];
    this.maxHeight = 600;
    this._boundScroll = this._onScroll.bind(this);
    this._boundResize = this._onResize.bind(this);
  }

  enable({ rowHeight = 48, bufferSize = 5, maxHeight = 600 } = {}) {
    this.enabled = true;
    this.rowHeight = rowHeight;
    this.bufferSize = bufferSize;
    this.maxHeight = maxHeight;

    const wrap = this.table.elements.tableWrap;
    if (wrap) {
      wrap.style.overflowY = "auto";
      wrap.style.maxHeight =
        typeof maxHeight === "number" ? `${maxHeight}px` : String(maxHeight);
      wrap.addEventListener("scroll", this._boundScroll);
    }

    window.addEventListener("resize", this._boundResize);
    this._measureViewport();
  }

  disable() {
    this.enabled = false;
    this.displayRows = [];
    this.totalRows = 0;
    this.startIndex = 0;
    this.endIndex = 0;

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
      this.viewportHeight =
        wrap.clientHeight ||
        (typeof this.maxHeight === "number" ? this.maxHeight : this.rowHeight);
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
    if (!this.enabled) {
      return;
    }

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
    const displayRows = this.displayRows;

    if (!displayRows || displayRows.length === 0) {
      elements.tbody.innerHTML = "";
      return;
    }

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
        const groupRow = this.table.tableRenderer._createGroupRow(item, theme);
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
        tr.dataset.rowId = rowId;
      }

      this.table.tableRenderer._buildRowContent(
        tr,
        item,
        state,
        theme,
        options,
        formatter
      );

      elements.tbody.appendChild(tr);

      if (this.table.hasRowDetail() && state.expandedRowIds.has(rowId)) {
        const detailRow = this.table.tableRenderer._createDetailRow(
          row,
          rowId,
          theme
        );
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

  render(displayRows = []) {
    if (!this.enabled) {
      return;
    }

    this.displayRows = displayRows;
    this.totalRows = displayRows.length;
    this._measureViewport();
    this.startIndex = Math.max(
      0,
      Math.floor(this.scrollTop / this.rowHeight) - this.bufferSize
    );
    this.endIndex = Math.min(
      this.totalRows,
      this.startIndex +
        Math.ceil(this.viewportHeight / this.rowHeight) +
        this.bufferSize * 2
    );

    this._renderVisibleRows();
    this._updateSpacer();
  }
}
