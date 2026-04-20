export class EditorPlugin {
  constructor(table) {
    this.table = table;
    this.editing = null;
  }

  startEditing(td, rowId, field, value) {
    if (this.editing) return;

    const originalContent = td.innerHTML;
    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.className = "dt-editor-input";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";

    td.innerHTML = "";
    td.appendChild(input);
    input.focus();

    const finish = async (save) => {
      if (!this.editing) return;
      const newValue = input.value;
      this.editing = null;

      if (save && newValue !== String(value)) {
        // Update local state
        const row = this.table.state.rawData.find(
          (r) => this.table.getRowId(r) === rowId
        );
        if (row) {
          row[field] = newValue;
        }

        // Trigger callback
        if (typeof this.table.options.onCellSave === "function") {
          try {
            await this.table.options.onCellSave(rowId, field, newValue);
          } catch (e) {
            console.error("DataTable: onCellSave failed", e);
            // Optional: Rollback logic could go here
          }
        }

        if (typeof this.table.options.hooks.onDataUpdated === "function") {
          this.table.options.hooks.onDataUpdated(this.table.state.rawData);
        }

        this.table.update({ skipFetch: true });
      } else {
        td.innerHTML = originalContent;
      }
    };

    input.onblur = () => finish(true);
    input.onkeydown = (e) => {
      if (e.key === "Enter") finish(true);
      if (e.key === "Escape") finish(false);
    };

    this.editing = { td, rowId, field };
  }
}
