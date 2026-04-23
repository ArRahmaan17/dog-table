import { requestJson } from "../core/request.js";

export class EditorPlugin {
  constructor(table) {
    this.table = table;
    this.editing = null;
  }

  getRemoteConfig() {
    return this.table.options.remote?.update || null;
  }

  async submitRemoteUpdate(row, rowId, field, value) {
    const config = this.getRemoteConfig();

    if (!config?.url) {
      throw new Error(
        "Update requests require `remote.update.url` when authenticated PUT sync is enabled."
      );
    }

    const context = {
      action: "update",
      row,
      rowId,
      field,
      value,
      data: {
        id: rowId,
        field,
        value,
        row: {
          ...row,
          [field]: value,
        },
      },
      table: this.table,
    };
    const { payload } = await requestJson(
      {
        url: config.url,
        method: config.method || "PUT",
        headers: config.headers,
        credentials: config.credentials,
        buildBody: config.buildBody,
        requireHeaders: config.requireHeaders,
      },
      context
    );

    if (typeof config.mapResponse === "function") {
      return config.mapResponse(payload, context);
    }

    if (payload && typeof payload === "object") {
      return payload.data || payload.row || payload.item || payload;
    }

    return null;
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
      const row = this.table.state.rawData.find(
        (r) => this.table.getRowId(r) === rowId
      );

      if (save && newValue !== String(value)) {
        const previousValue = row ? row[field] : value;

        try {
          this.table.setSyncStatus({
            state: "saving",
            label: this.table.options.language.syncSaving || "Saving",
            title: `Updating ${field}.`,
          });

          if (row && this.getRemoteConfig()) {
            const updatedRow = await this.submitRemoteUpdate(
              row,
              rowId,
              field,
              newValue
            );

            if (updatedRow && typeof updatedRow === "object") {
              Object.assign(row, updatedRow);
            } else {
              row[field] = newValue;
            }
          } else if (row) {
            row[field] = newValue;
          }

          if (typeof this.table.options.onCellSave === "function") {
            const callbackResult = await this.table.options.onCellSave(
              rowId,
              field,
              newValue,
              row
            );

            if (row && callbackResult && typeof callbackResult === "object") {
              Object.assign(row, callbackResult);
            }
          }

          if (typeof this.table.options.hooks.onDataUpdated === "function") {
            this.table.options.hooks.onDataUpdated(this.table.state.rawData);
          }

          if (typeof this.table.options.hooks.onUpdateSuccess === "function") {
            this.table.options.hooks.onUpdateSuccess({
              rowId,
              field,
              value: newValue,
              row,
            });
          }

          this.table.highlightRow(rowId);
          this.table.showToast(
            this.table.options.language.updateSuccess ||
              "Row updated successfully.",
            "success"
          );
          this.table.setSyncStatus({
            state: "success",
            label: this.table.options.language.syncSaved || "Saved",
            title: `Updated ${field}.`,
          });
          this.table.update({ skipFetch: true });
        } catch (error) {
          if (row) {
            row[field] = previousValue;
          }

          td.innerHTML = originalContent;
          this.table.showToast(
            error?.message ||
              this.table.options.language.updateError ||
              "Unable to update this row.",
            "error"
          );
          this.table.setSyncStatus({
            state: "error",
            label: this.table.options.language.syncFailed || "Sync Failed",
            title:
              error?.message ||
              this.table.options.language.updateError ||
              "Unable to update this row.",
          });

          if (typeof this.table.options.hooks.onUpdateError === "function") {
            this.table.options.hooks.onUpdateError(error);
          }
        }
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
