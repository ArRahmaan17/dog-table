import { debounce } from "../utils/index.js";

export class EventBinder {
  constructor(table) {
    this.table = table;
    this.boundHandlers = {};
    this.debouncedSearch = null;
    this.debouncedFilter = null;
  }

  bind() {
    this.unbind();

    const { elements, state, container } = this.table;

    this.boundHandlers.onHeadClick = (event) => {
      if (
        event.target.closest("[data-filter-field]") ||
        event.target.closest("[data-resize-handle]")
      ) {
        return;
      }

      const header = event.target.closest("th[data-column]");

      if (!header || header.dataset.sortable === "false" || state.loading) {
        return;
      }

      this.table.toggleSort(header.dataset.column);
    };

    this.boundHandlers.onHeadKeydown = (event) => {
      if (
        event.target.closest("[data-filter-field]") ||
        event.target.closest("[data-resize-handle]")
      ) {
        return;
      }

      const header = event.target.closest("th[data-column]");

      if (
        !header ||
        header.dataset.sortable === "false" ||
        state.loading ||
        (event.key !== "Enter" && event.key !== " ")
      ) {
        return;
      }

      event.preventDefault();
      this.table.toggleSort(header.dataset.column);
    };

    this.boundHandlers.onPaginationClick = (event) => {
      const button = event.target.closest("button[data-page]");

      if (!button || button.disabled || state.loading) {
        return;
      }

      this.table.setPage(Number(button.dataset.page));
    };

    this.boundHandlers.onBulkCheck = (event) => {
      const checkbox = event.target.closest("input[data-bulk-checkbox]");

      if (checkbox) {
        this.table.selection.selectAll(checkbox.checked);
      }
    };

    this.boundHandlers.onRowCheck = (event) => {
      const checkbox = event.target.closest("input[data-row-checkbox]");

      if (checkbox) {
        this.table.selection.toggleRow(
          checkbox.dataset.rowCheckbox,
          checkbox.checked
        );
      }
    };

    this.boundHandlers.onBodyClick = (event) => {
      const target = event.target;
      const detailButton = target.closest("button[data-detail-toggle]");

      if (detailButton && !state.loading) {
        this.table.toggleRowDetail(detailButton.dataset.detailToggle);
        return;
      }

      const td = target.closest("td[data-field]");

      if (!td) {
        return;
      }

      const rowId = td.closest("tr")?.dataset.rowId;
      const field = td.dataset.field;
      const column = this.table.getColumnByField(field);

      if (!column?.editable || !rowId) {
        return;
      }

      const row = this.table.getRowById(rowId);
      this.table.editor.startEditing(td, rowId, field, row ? row[field] : "", row);
    };

    this.boundHandlers.onLiveToggle = (event) => {
      if (event.target.closest("[data-live-toggle]")) {
        this.table.live.toggle();
      }
    };

    this.boundHandlers.onCreateClick = (event) => {
      if (event.target.closest("[data-create-open]")) {
        this.table.create.open();
        return;
      }

      if (
        event.target.closest("[data-create-close]") ||
        event.target.matches("[data-create-backdrop]")
      ) {
        this.table.create.close();
      }
    };

    this.boundHandlers.onCreateInput = (event) => {
      const input = event.target.closest("[data-create-field]");

      if (input) {
        this.table.create.handleFieldInput(input);
      }
    };

    this.boundHandlers.onCreateSubmit = (event) => {
      const form = event.target.closest("[data-create-form]");

      if (!form) {
        return;
      }

      event.preventDefault();
      this.table.create.submit();
    };

    elements.thead.addEventListener("click", this.boundHandlers.onHeadClick);
    elements.thead.addEventListener("keydown", this.boundHandlers.onHeadKeydown);
    elements.thead.addEventListener("change", this.boundHandlers.onBulkCheck);

    if (this.table.options.resizableColumns) {
      this.boundHandlers.onColumnResizeStart = (event) => {
        const handle = event.target.closest("[data-resize-handle]");
        const header = handle?.closest("th[data-column]");

        if (!handle || !header) {
          return;
        }

        event.preventDefault();
        const startX = event.clientX;
        const startWidth = header.offsetWidth;
        const columnKey = header.dataset.column;
        let frame = null;

        this.boundHandlers.onColumnResizeMove = (moveEvent) => {
          const width = Math.max(40, startWidth + moveEvent.clientX - startX);

          if (frame) {
            cancelAnimationFrame(frame);
          }

          frame = requestAnimationFrame(() => {
            header.style.width = `${width}px`;
            header.style.minWidth = `${width}px`;
          });
        };

        this.boundHandlers.onColumnResizeEnd = (upEvent) => {
          const width = Math.max(40, startWidth + upEvent.clientX - startX);

          document.removeEventListener("mousemove", this.boundHandlers.onColumnResizeMove);
          document.removeEventListener("mouseup", this.boundHandlers.onColumnResizeEnd);
          this.table.setColumnWidth(columnKey, width);
        };

        document.addEventListener("mousemove", this.boundHandlers.onColumnResizeMove);
        document.addEventListener("mouseup", this.boundHandlers.onColumnResizeEnd);
      };

      elements.thead.addEventListener(
        "mousedown",
        this.boundHandlers.onColumnResizeStart
      );
    }

    if (this.table.options.columnReorder) {
      this.boundHandlers.onColumnDragStart = (event) => {
        const header = event.target.closest("th[data-column]");

        if (!header || event.target.closest("[data-filter-field], [data-resize-handle]")) {
          event.preventDefault();
          return;
        }

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", header.dataset.column);
      };

      this.boundHandlers.onColumnDragOver = (event) => {
        if (event.target.closest("th[data-column]")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      };

      this.boundHandlers.onColumnDrop = (event) => {
        const header = event.target.closest("th[data-column]");
        const source = event.dataTransfer.getData("text/plain");

        if (!header || !source) {
          return;
        }

        event.preventDefault();
        this.table.moveColumn(source, header.dataset.column);
      };

      elements.thead.addEventListener("dragstart", this.boundHandlers.onColumnDragStart);
      elements.thead.addEventListener("dragover", this.boundHandlers.onColumnDragOver);
      elements.thead.addEventListener("drop", this.boundHandlers.onColumnDrop);
    }

    if (this.table.options.filterRow) {
      const handleFilter = (input) => {
        this.table.setFilter(input.dataset.filterField, input.value);
      };

      this.debouncedFilter =
        this.table.options.filterDebounce > 0
          ? debounce(handleFilter, this.table.options.filterDebounce)
          : handleFilter;

      this.boundHandlers.onFilterInput = (event) => {
        const input = event.target.closest("input[data-filter-field]");

        if (input) {
          this.debouncedFilter(input);
        }
      };

      this.boundHandlers.onFilterChange = (event) => {
        const input = event.target.closest("select[data-filter-field], input[type='date'][data-filter-field]");

        if (input) {
          handleFilter(input);
        }
      };

      elements.thead.addEventListener("input", this.boundHandlers.onFilterInput);
      elements.thead.addEventListener("change", this.boundHandlers.onFilterChange);
    }

    elements.tbody.addEventListener("change", this.boundHandlers.onRowCheck);
    elements.tbody.addEventListener("click", this.boundHandlers.onBodyClick);
    elements.pagination.addEventListener(
      "click",
      this.boundHandlers.onPaginationClick
    );
    container.addEventListener("click", this.boundHandlers.onLiveToggle);
    container.addEventListener("click", this.boundHandlers.onCreateClick);
    container.addEventListener("input", this.boundHandlers.onCreateInput);
    container.addEventListener("submit", this.boundHandlers.onCreateSubmit);

    if (this.table.options.searchable && elements.searchInput) {
      const handleSearch = (value) => {
        this.table.setSearch(value);
      };

      this.debouncedSearch =
        this.table.options.searchDebounce > 0
          ? debounce(handleSearch, this.table.options.searchDebounce)
          : handleSearch;

      this.boundHandlers.onSearchInput = (event) => {
        this.debouncedSearch(event.target.value);
      };

      elements.searchInput.addEventListener(
        "input",
        this.boundHandlers.onSearchInput
      );
    }
  }

  unbind() {
    const { elements, container } = this.table;

    if (elements.thead && this.boundHandlers.onHeadClick) {
      elements.thead.removeEventListener("click", this.boundHandlers.onHeadClick);
    }

    if (elements.thead && this.boundHandlers.onHeadKeydown) {
      elements.thead.removeEventListener("keydown", this.boundHandlers.onHeadKeydown);
    }

    if (elements.thead && this.boundHandlers.onBulkCheck) {
      elements.thead.removeEventListener("change", this.boundHandlers.onBulkCheck);
    }

    if (elements.tbody && this.boundHandlers.onRowCheck) {
      elements.tbody.removeEventListener("change", this.boundHandlers.onRowCheck);
    }

    if (elements.tbody && this.boundHandlers.onBodyClick) {
      elements.tbody.removeEventListener("click", this.boundHandlers.onBodyClick);
    }

    if (elements.pagination && this.boundHandlers.onPaginationClick) {
      elements.pagination.removeEventListener(
        "click",
        this.boundHandlers.onPaginationClick
      );
    }

    if (elements.searchInput && this.boundHandlers.onSearchInput) {
      elements.searchInput.removeEventListener(
        "input",
        this.boundHandlers.onSearchInput
      );
    }

    if (elements.thead && this.boundHandlers.onFilterInput) {
      elements.thead.removeEventListener("input", this.boundHandlers.onFilterInput);
    }

    if (elements.thead && this.boundHandlers.onFilterChange) {
      elements.thead.removeEventListener("change", this.boundHandlers.onFilterChange);
    }

    if (elements.thead && this.boundHandlers.onColumnResizeStart) {
      elements.thead.removeEventListener(
        "mousedown",
        this.boundHandlers.onColumnResizeStart
      );
    }

    if (this.boundHandlers.onColumnResizeMove) {
      document.removeEventListener("mousemove", this.boundHandlers.onColumnResizeMove);
    }

    if (this.boundHandlers.onColumnResizeEnd) {
      document.removeEventListener("mouseup", this.boundHandlers.onColumnResizeEnd);
    }

    if (elements.thead && this.boundHandlers.onColumnDragStart) {
      elements.thead.removeEventListener("dragstart", this.boundHandlers.onColumnDragStart);
    }

    if (elements.thead && this.boundHandlers.onColumnDragOver) {
      elements.thead.removeEventListener("dragover", this.boundHandlers.onColumnDragOver);
    }

    if (elements.thead && this.boundHandlers.onColumnDrop) {
      elements.thead.removeEventListener("drop", this.boundHandlers.onColumnDrop);
    }

    if (container && this.boundHandlers.onLiveToggle) {
      container.removeEventListener("click", this.boundHandlers.onLiveToggle);
    }

    if (container && this.boundHandlers.onCreateClick) {
      container.removeEventListener("click", this.boundHandlers.onCreateClick);
    }

    if (container && this.boundHandlers.onCreateInput) {
      container.removeEventListener("input", this.boundHandlers.onCreateInput);
    }

    if (container && this.boundHandlers.onCreateSubmit) {
      container.removeEventListener("submit", this.boundHandlers.onCreateSubmit);
    }

    if (this.debouncedSearch && typeof this.debouncedSearch.cancel === "function") {
      this.debouncedSearch.cancel();
    }

    if (this.debouncedFilter && typeof this.debouncedFilter.cancel === "function") {
      this.debouncedFilter.cancel();
    }

    this.debouncedSearch = null;
    this.debouncedFilter = null;
  }
}
