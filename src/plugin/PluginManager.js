import { PersistencePlugin } from "./persistence.js";
import { SelectionPlugin } from "./selection.js";
import { ExportPlugin } from "./export.js";
import { FormatterPlugin } from "./formatter.js";
import { EditorPlugin } from "./editor.js";
import { LivePlugin } from "./live.js";
import { CreatePlugin } from "./create.js";

export class PluginManager {
  constructor(table) {
    this.table = table;
  }

  initialize() {
    this.table.persistence = new PersistencePlugin(this.table);
    this.table.selection = new SelectionPlugin(this.table);
    this.table.exporter = new ExportPlugin(this.table);
    this.table.formatter = new FormatterPlugin(this.table);
    this.table.editor = new EditorPlugin(this.table);
    this.table.live = new LivePlugin(this.table);
    this.table.create = new CreatePlugin(this.table);

    if (this.table.options.persistence) {
      this.table.persistence.load();
    }
  }

  initRuntime() {
    this.table.create.init();
    this.table.live.init();
  }

  destroy() {
    this.table.live.stop();

    if (typeof this.table.live.destroy === "function") {
      this.table.live.destroy();
    }
  }
}
