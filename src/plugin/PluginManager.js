import { PersistencePlugin } from "./persistence.js";
import { SelectionPlugin } from "./selection.js";
import { ExportPlugin } from "./export.js";
import { FormatterPlugin } from "./formatter.js";
import { EditorPlugin } from "./editor.js";
import { LivePlugin } from "./live.js";
import { CreatePlugin } from "./create.js";
import { UrlStatePlugin } from "./url-state.js";

export class PluginManager {
  constructor(table) {
    this.table = table;
    this.installedPlugins = [];
  }

  getCustomPlugins() {
    const globalPlugins =
      typeof this.table.constructor.getGlobalPlugins === "function"
        ? this.table.constructor.getGlobalPlugins()
        : [];
    const instancePlugins = Array.isArray(this.table.options.plugins)
      ? this.table.options.plugins
      : [];

    return [...globalPlugins, ...instancePlugins];
  }

  installCustomPlugins() {
    this.getCustomPlugins().forEach((plugin) => {
      if (!plugin) {
        return;
      }

      if (typeof plugin === "function") {
        plugin(this.table);
        this.installedPlugins.push(plugin);
        return;
      }

      if (typeof plugin.install === "function") {
        plugin.install(this.table);
        this.installedPlugins.push(plugin);
      }
    });
  }

  initialize() {
    this.table.persistence = new PersistencePlugin(this.table);
    this.table.selection = new SelectionPlugin(this.table);
    this.table.exporter = new ExportPlugin(this.table);
    this.table.formatter = new FormatterPlugin(this.table);
    this.table.editor = new EditorPlugin(this.table);
    this.table.live = new LivePlugin(this.table);
    this.table.create = new CreatePlugin(this.table);
    this.table.urlState = new UrlStatePlugin(this.table);

    if (this.table.options.persistence) {
      this.table.persistence.load();
    }

    this.table.urlState.load();
    this.installCustomPlugins();
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

    if (typeof this.table.urlState.destroy === "function") {
      this.table.urlState.destroy();
    }

    this.installedPlugins.forEach((plugin) => {
      if (plugin && typeof plugin.destroy === "function") {
        plugin.destroy(this.table);
      }
    });
    this.installedPlugins = [];
  }
}
