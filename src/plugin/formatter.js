export class FormatterPlugin {
  constructor(table) {
    this.table = table;
  }

  resolveFormatOptions(column) {
    if (column?.formatOptions && typeof column.formatOptions === "object") {
      return column.formatOptions;
    }

    if (column?.format && typeof column.format === "object") {
      return column.format;
    }

    return {};
  }

  resolveImagePayload(value) {
    if (typeof value === "string") {
      return { src: value, alt: "" };
    }

    if (value && typeof value === "object") {
      const src = value.src || value.url || "";
      const alt = value.alt || "";
      return { src, alt };
    }

    return { src: "", alt: "" };
  }

  createImageNode(value, column, row) {
    const payload = this.resolveImagePayload(value);
    const src = String(payload.src || "").trim();

    if (!src) return "";

    const img = document.createElement("img");
    img.src = src;

    const dynamicAlt =
      typeof column.imageAlt === "function"
        ? column.imageAlt(value, row)
        : column.imageAlt;
    const alt = dynamicAlt ?? payload.alt ?? column.label ?? "image";
    img.alt = String(alt || "");

    const width = Number(column.imageWidth || column.width || 40);
    const height = Number(column.imageHeight || column.height || width);

    img.width = Number.isFinite(width) && width > 0 ? width : 40;
    img.height = Number.isFinite(height) && height > 0 ? height : img.width;
    img.loading = "lazy";
    img.decoding = "async";

    if (column.imageClassName) {
      img.className = column.imageClassName;
    }

    if (column.imageFit) {
      img.style.objectFit = column.imageFit;
    } else {
      img.style.objectFit = "cover";
    }

    if (column.imageRadius) {
      img.style.borderRadius = column.imageRadius;
    } else {
      img.style.borderRadius = "999px";
    }

    return img;
  }

  format(value, column, row) {
    if (value == null) return "";

    if (typeof column.format === "function") {
      return column.format(value, row);
    }

    const type = column.type;
    const locale = column.locale || this.table.options.locale || "en-US";
    const formatOptions = this.resolveFormatOptions(column);

    if (type === "money" || type === "currency") {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: column.currency || "USD",
        ...formatOptions,
      }).format(value);
    }

    if (type === "datetime" || type === "date") {
      const parsedDate = new Date(value);
      if (Number.isNaN(parsedDate.getTime())) {
        return value;
      }

      return new Intl.DateTimeFormat(locale, Object.keys(formatOptions).length ? formatOptions : {
        dateStyle: "medium"
      }).format(parsedDate);
    }

    if (type === "number") {
      return new Intl.NumberFormat(locale, formatOptions).format(value);
    }

    if (
      type === "image" ||
      type === "img" ||
      type === "avatar" ||
      type === "picture"
    ) {
      return this.createImageNode(value, column, row);
    }

    return value;
  }
}
