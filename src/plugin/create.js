import { requestJson } from "../core/request.js";
import { escapeHtml } from "../utils/index.js";

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

function normalizeFieldKey(column) {
  return column.accessor || column.key;
}

export class CreatePlugin {
  constructor(table) {
    this.table = table;
    this.isOpen = false;
    this.isSaving = false;
    this.values = {};
    this.errors = {};
    this.formError = "";
  }

  init() {
    this.resetForm();
    this.updateUI();
  }

  isEnabled() {
    return Boolean(this.table.options.create);
  }

  getConfig() {
    return this.table.options.create || {};
  }

  getRemoteConfig() {
    const config = this.getConfig();
    return config.remote || this.table.options.remote?.create || null;
  }

  getCreateColumns() {
    return this.table.state.columns.filter((column) => {
      const key = normalizeFieldKey(column);
      return Boolean(key) && column.createable !== false;
    });
  }

  resetForm() {
    const initialValues = this.getConfig().initialValues || {};

    this.values = this.getCreateColumns().reduce((result, column) => {
      const key = normalizeFieldKey(column);
      result[key] =
        initialValues[key] ??
        column.defaultValue ??
        (column.inputType === "checkbox" ? false : "");
      return result;
    }, {});
    this.errors = {};
    this.formError = "";
  }

  open() {
    if (!this.isEnabled()) {
      return;
    }

    this.isOpen = true;
    this.resetForm();
    this.updateUI();

    window.setTimeout(() => {
      const firstField = this.table.container.querySelector("[data-create-field]");
      if (firstField) {
        firstField.focus();
      }
    }, 0);
  }

  close() {
    this.isOpen = false;
    this.isSaving = false;
    this.formError = "";
    this.errors = {};
    this.updateUI();
  }

  handleFieldInput(input) {
    const field = input.name;

    if (!field) {
      return;
    }

    this.values[field] =
      input.type === "checkbox" ? input.checked : input.value ?? "";

    if (this.errors[field]) {
      delete this.errors[field];
      this.updateUI();
    }
  }

  resolveInputType(column) {
    if (column.inputType) {
      return column.inputType;
    }

    if (column.type === "number" || column.type === "money") {
      return "number";
    }

    if (column.type === "datetime") {
      return "datetime-local";
    }

    return "text";
  }

  normalizeValue(column, value) {
    if (typeof column.parseInput === "function") {
      return column.parseInput(value, {
        column,
        values: { ...this.values },
        table: this.table,
      });
    }

    const inputType = this.resolveInputType(column);

    if (inputType === "checkbox") {
      return Boolean(value);
    }

    if (inputType === "number" && value !== "") {
      return Number(value);
    }

    return value;
  }

  validateField(column, rawValue) {
    const key = normalizeFieldKey(column);
    const value = rawValue ?? this.values[key];

    if (column.required && isBlank(value)) {
      return `${column.label || key} is required.`;
    }

    if (this.resolveInputType(column) === "email" && !isBlank(value)) {
      const email = String(value).trim();
      if (!email.includes("@")) {
        return `${column.label || key} must contain @.`;
      }
    }

    if (typeof column.validate === "function") {
      return column.validate(value, {
        column,
        values: { ...this.values },
        table: this.table,
      });
    }

    return "";
  }

  validate() {
    const nextErrors = {};

    this.getCreateColumns().forEach((column) => {
      const key = normalizeFieldKey(column);
      const message = this.validateField(column, this.values[key]);

      if (message) {
        nextErrors[key] = message;
      }
    });

    this.errors = nextErrors;

    return Object.keys(nextErrors).length === 0;
  }

  buildRecord() {
    return this.getCreateColumns().reduce((record, column) => {
      const key = normalizeFieldKey(column);
      record[key] = this.normalizeValue(column, this.values[key]);
      return record;
    }, {});
  }

  async submitRemote(record) {
    const config = this.getRemoteConfig();

    if (!config?.url) {
      throw new Error(
        "Create requests require `create.remote.url` or `remote.create.url`."
      );
    }

    const context = {
      action: "create",
      data: record,
      table: this.table,
      values: { ...this.values },
      columns: [...this.getCreateColumns()],
    };
    const { payload } = await requestJson(
      {
        url: config.url,
        method: config.method || "POST",
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

    return record;
  }

  async handleSuccess(createdRow) {
    const config = this.getConfig();
    const row = createdRow && typeof createdRow === "object" ? createdRow : {};
    const nextRow = { ...this.buildRecord(), ...row };
    const shouldRefetch =
      this.table.isRemote() && (config.refetchAfterSubmit ?? true);

    if (shouldRefetch) {
      this.table.state.currentPage = 1;
      await this.table.update();
    } else {
      this.table.state.rawData = [nextRow, ...this.table.state.rawData];
      this.table.state.totalItems = this.table.state.rawData.length;
      this.table.state.currentPage = 1;
      this.table.state.error = null;
      this.table.update({ skipFetch: true });
    }

    const createdRowId = this.table.getRowId(nextRow);
    this.table.highlightRow(createdRowId);
    this.table.showToast(
      this.table.options.language.createSuccess || "New record added successfully.",
      "success"
    );
    this.table.setSyncStatus({
      state: "success",
      label: this.table.options.language.syncSaved || "Saved",
      title: "Latest create request completed successfully.",
    });

    if (typeof this.table.options.hooks.onCreateSuccess === "function") {
      this.table.options.hooks.onCreateSuccess(nextRow);
    }

    if (typeof this.table.options.hooks.onDataUpdated === "function") {
      this.table.options.hooks.onDataUpdated(this.table.state.rawData);
    }

    this.close();
  }

  async submit() {
    if (!this.validate()) {
      this.formError =
        this.table.options.language.createValidationError ||
        "Please correct the highlighted fields.";
      this.updateUI();
      return;
    }

    const record = this.buildRecord();
    const config = this.getConfig();

    this.isSaving = true;
    this.formError = "";
    this.table.setSyncStatus({
      state: "saving",
      label: this.table.options.language.syncSaving || "Saving",
      title: "Create request in progress.",
    });
    this.updateUI();

    try {
      const remoteConfig = this.getRemoteConfig();
      const createdRow =
        typeof config.onSubmit === "function"
          ? await config.onSubmit(record, {
              table: this.table,
              values: { ...this.values },
              columns: [...this.getCreateColumns()],
            })
          : remoteConfig?.url
            ? await this.submitRemote(record)
            : record;

      await this.handleSuccess(createdRow);
    } catch (error) {
      this.formError =
        error?.message ||
        this.table.options.language.createError ||
        "Unable to save this record.";
      this.table.showToast(this.formError, "error");
      this.table.setSyncStatus({
        state: "error",
        label: this.table.options.language.syncFailed || "Sync Failed",
        title: this.formError,
      });

      if (typeof this.table.options.hooks.onCreateError === "function") {
        this.table.options.hooks.onCreateError(error);
      }
    } finally {
      this.isSaving = false;
      this.updateUI();
    }
  }

  renderTrigger() {
    if (!this.isEnabled()) {
      return "";
    }

    return `
      <button
        type="button"
        class="dt-create-trigger"
        data-create-open
      >
        ${escapeHtml(
          this.getConfig().triggerLabel ||
            this.table.options.language.createTrigger ||
            "New Record"
        )}
      </button>
    `;
  }

  renderField(column) {
    const key = normalizeFieldKey(column);
    const inputType = this.resolveInputType(column);
    const label = column.label || key;
    const value = this.values[key];
    const error = this.errors[key];
    const required = Boolean(column.required);
    const placeholder = column.placeholder || `Enter ${label.toLowerCase()}`;

    if (inputType === "checkbox") {
      return `
        <label class="dt-create-field dt-create-field--checkbox">
          <input
            type="checkbox"
            name="${escapeHtml(key)}"
            data-create-field
            ${value ? "checked" : ""}
          />
          <span>${escapeHtml(label)}</span>
        </label>
      `;
    }

    if (Array.isArray(column.options) && column.options.length > 0) {
      const options = column.options
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
              ${String(value ?? "") === String(optionValue ?? "") ? "selected" : ""}
            >
              ${escapeHtml(optionLabel ?? "")}
            </option>
          `;
        })
        .join("");

      return `
        <label class="dt-create-field">
          <span class="dt-create-label">
            ${escapeHtml(label)}${required ? ' <span aria-hidden="true">*</span>' : ""}
          </span>
          <select
            class="dt-create-input${error ? " is-invalid" : ""}"
            name="${escapeHtml(key)}"
            ${required ? "required" : ""}
            data-create-field
            aria-invalid="${error ? "true" : "false"}"
          >
            <option value="">${escapeHtml(
              column.placeholder || `Select ${label.toLowerCase()}`
            )}</option>
            ${options}
          </select>
          ${
            error
              ? `<span class="dt-create-error">${escapeHtml(error)}</span>`
              : ""
          }
        </label>
      `;
    }

    return `
      <label class="dt-create-field">
        <span class="dt-create-label">
          ${escapeHtml(label)}${required ? ' <span aria-hidden="true">*</span>' : ""}
        </span>
        <input
          class="dt-create-input${error ? " is-invalid" : ""}"
          type="${escapeHtml(inputType)}"
          name="${escapeHtml(key)}"
          value="${escapeHtml(value ?? "")}"
          placeholder="${escapeHtml(placeholder)}"
          ${required ? "required" : ""}
          data-create-field
          aria-invalid="${error ? "true" : "false"}"
        />
        ${
          error
            ? `<span class="dt-create-error">${escapeHtml(error)}</span>`
            : ""
        }
      </label>
    `;
  }

  renderModal() {
    if (!this.isEnabled() || !this.isOpen) {
      return "";
    }

    const title =
      this.getConfig().title ||
      this.table.options.language.createTitle ||
      "Create New Record";
    const description =
      this.getConfig().description ||
      this.table.options.language.createDescription ||
      "Add a new row and sync it to your data source.";
    const submitLabel = this.isSaving
      ? this.table.options.language.createSaving || "Saving..."
      : this.getConfig().submitLabel ||
        this.table.options.language.createSubmit ||
        "Save Record";

    return `
      <div class="dt-create-modal-backdrop" data-create-backdrop>
        <div
          class="dt-create-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dt-create-title"
        >
          <div class="dt-create-modal__header">
            <div>
              <h2 id="dt-create-title" class="dt-create-modal__title">${escapeHtml(
                title
              )}</h2>
              <p class="dt-create-modal__description">${escapeHtml(
                description
              )}</p>
            </div>
            <button
              type="button"
              class="dt-create-close"
              data-create-close
              aria-label="${escapeHtml(
                this.table.options.language.createCancel || "Close create form"
              )}"
            >
              ×
            </button>
          </div>
          <form class="dt-create-form" data-create-form>
            <div class="dt-create-grid">
              ${this.getCreateColumns()
                .map((column) => this.renderField(column))
                .join("")}
            </div>
            ${
              this.formError
                ? `<div class="dt-create-form-error">${escapeHtml(
                    this.formError
                  )}</div>`
                : ""
            }
            <div class="dt-create-actions">
              <button
                type="button"
                class="dt-create-cancel"
                data-create-close
                ${this.isSaving ? "disabled" : ""}
              >
                ${escapeHtml(
                  this.table.options.language.createCancel || "Cancel"
                )}
              </button>
              <button
                type="submit"
                class="dt-create-submit"
                ${this.isSaving ? "disabled" : ""}
              >
                ${escapeHtml(submitLabel)}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  updateUI() {
    const triggerContainer = this.table.container.querySelector(".dt-create-entry");
    const modalContainer = this.table.container.querySelector(".dt-modal-region");

    if (triggerContainer) {
      triggerContainer.innerHTML = this.renderTrigger();
    }

    if (modalContainer) {
      modalContainer.innerHTML = this.renderModal();
    }
  }
}
