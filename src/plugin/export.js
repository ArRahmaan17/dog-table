export class ExportPlugin {
  constructor(table) {
    this.table = table;
  }

  toCSV(filename = "table-export.csv") {
    const columns = this.table.state.columns.filter((c) => c.visible !== false);
    const headers = columns
      .map((c) => `"${(c.label || c.key).replace(/"/g, '""')}"`)
      .join(",");

    const rows = this.table.state.rawData
      .map((row) => {
        return columns
          .map((c) => {
            let value = row[c.key];
            if (typeof c.render === "function") {
              const rendered = c.render(value, row);
              if (rendered instanceof Node) {
                value = rendered.textContent;
              } else {
                value = rendered;
              }
            }
            return `"${String(value ?? "").replace(/"/g, '""')}"`;
          })
          .join(",");
      })
      .join("\n");

    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    link.click();
    URL.revokeObjectURL(url);
  }
}
