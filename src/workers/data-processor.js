function getValue(row, column) {
  const key = column.accessor || column.key;
  return row?.[key];
}

function compareValues(leftValue, rightValue, direction) {
  if (typeof leftValue === "number" && typeof rightValue === "number") {
    return direction === "asc"
      ? leftValue - rightValue
      : rightValue - leftValue;
  }

  const comparison = String(leftValue ?? "").localeCompare(
    String(rightValue ?? ""),
    undefined,
    { numeric: true, sensitivity: "base" }
  );

  return direction === "asc" ? comparison : -comparison;
}

function toPositiveInteger(value, fallback = 1) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const integer = Math.floor(numeric);
  return integer >= 1 ? integer : fallback;
}

function clampPage(pageNumber, guard) {
  let nextPage = toPositiveInteger(pageNumber, 1);

  if (guard) {
    nextPage = Math.min(nextPage, guard.maxPage);
  }

  return nextPage;
}

function processRows(payload) {
  const {
    rawData,
    columns,
    searchQuery,
    sortKey,
    sortDirection,
    currentPage,
    pageSize,
    paginationEnabled,
    guard,
  } = payload;

  let indexes = rawData.map((_, index) => index);

  if (searchQuery) {
    indexes = indexes.filter((rowIndex) => {
      const row = rawData[rowIndex];

      return columns.some((column) => {
        if (column.searchable === false) {
          return false;
        }

        return String(getValue(row, column) ?? "")
          .toLowerCase()
          .includes(searchQuery);
      });
    });
  }

  if (sortKey) {
    const sortColumn =
      columns.find((column) => column.key === sortKey) || { key: sortKey };

    indexes = [...indexes].sort((leftIndex, rightIndex) =>
      compareValues(
        getValue(rawData[leftIndex], sortColumn),
        getValue(rawData[rightIndex], sortColumn),
        sortDirection
      )
    );
  }

  const totalItems = indexes.length;
  const rawTotalPages = paginationEnabled
    ? Math.max(1, Math.ceil(totalItems / pageSize))
    : 1;
  const totalPages = paginationEnabled && guard
    ? Math.min(rawTotalPages, guard.maxPage)
    : rawTotalPages;
  const page = paginationEnabled
    ? Math.min(Math.max(1, clampPage(currentPage, guard)), totalPages)
    : 1;
  const start = (page - 1) * pageSize;
  const rowIndexes = paginationEnabled
    ? indexes.slice(start, start + pageSize)
    : indexes;

  return {
    rowIndexes,
    filteredIndexes: indexes,
    totalItems,
    totalPages,
    currentPage: page,
    pageSize,
    startIndex: totalItems === 0 ? 0 : paginationEnabled ? start + 1 : 1,
    endIndex: paginationEnabled
      ? Math.min(start + pageSize, totalItems)
      : totalItems,
  };
}

self.addEventListener("message", (event) => {
  const { id, ...payload } = event.data || {};

  try {
    self.postMessage({
      id,
      result: processRows(payload),
    });
  } catch (error) {
    self.postMessage({
      id,
      error: error?.message || "Unable to process rows.",
    });
  }
});
