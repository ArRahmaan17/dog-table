export class FormatterPlugin {
  constructor(table) {
    this.table = table;
  }

  format(value, column, row) {
    if (value == null) return "";

    const type = column.type;
    const locale = column.locale || this.table.options.locale || "en-US";

    if (type === "money" || type === "currency") {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: column.currency || "USD",
        ...column.format,
      }).format(value);
    }

    if (type === "datetime" || type === "date") {
      return new Intl.DateTimeFormat(locale, column.format || {
        dateStyle: "medium"
      }).format(new Date(value));
    }

    if (type === "number") {
      return new Intl.NumberFormat(locale, column.format).format(value);
    }

    return value;
  }
}
