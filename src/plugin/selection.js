export class SelectionPlugin {
  constructor(table) {
    this.table = table;
    this.table.state.selectedRows = new Set();
  }

  getSelectedData() {
    const selectedIds = this.table.state.selectedRows;
    return this.table.state.rawData.filter((row) =>
      selectedIds.has(this.table.getRowId(row))
    );
  }

  toggleRow(rowId, isSelected) {
    if (isSelected) {
      this.table.state.selectedRows.add(rowId);
    } else {
      this.table.state.selectedRows.delete(rowId);
    }

    this.emitChange();
    this.table.update({ skipFetch: true });
  }

  selectAll(isSelected) {
    // When local, select all matching (filtered) rows across all pages.
    // When remote, we only have access to the current page's rows.
    const rows =
      !this.table.isRemote() && this.table._pipelineCache.filtered
        ? this.table._pipelineCache.filtered
        : this.table.getProcessedData().rows;

    rows.forEach((row) => {
      const id = this.table.getRowId(row);
      if (isSelected) {
        this.table.state.selectedRows.add(id);
      } else {
        this.table.state.selectedRows.delete(id);
      }
    });

    this.emitChange();
    this.table.update({ skipFetch: true });
  }

  emitChange() {
    if (typeof this.table.options.hooks.onSelectionChange === "function") {
      this.table.options.hooks.onSelectionChange(this.getSelectedData());
    }
  }

  isAllSelected(rows) {
    if (!rows || rows.length === 0) return false;
    return rows.every((row) =>
      this.table.state.selectedRows.has(this.table.getRowId(row))
    );
  }

  isSomeSelected(rows) {
    if (!rows || rows.length === 0) return false;
    return rows.some((row) =>
      this.table.state.selectedRows.has(this.table.getRowId(row))
    );
  }
}
