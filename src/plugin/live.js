export class LivePlugin {
  constructor(table) {
    this.table = table;
    this.intervalId = null;
    this.active = !!this.table.options.autoRefresh;
  }

  init() {
    if (this.active) {
      this.start();
    }
  }

  start() {
    const ms = this.table.options.autoRefresh;
    if (!ms || !this.table.isRemote()) return;

    this.stop();
    this.active = true;
    this.intervalId = setInterval(() => {
      if (this.active && !this.table.state.loading) {
        if (typeof this.table.options.hooks.onBeforeRefresh === "function") {
          this.table.options.hooks.onBeforeRefresh();
        }
        this.table.update();
      }
    }, ms);

    this.updateUI();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.active = false;
    this.updateUI();
  }

  toggle() {
    if (this.active) this.stop();
    else this.start();
  }

  updateUI() {
    const container = this.table.container.querySelector(".dt-live-status");
    if (container) {
      container.innerHTML = this.render();
    }
  }

  render() {
    const active = this.active;
    const label = active ? "Live" : "Paused";
    const className = active ? "is-active" : "is-paused";

    return `
      <button type="button" class="dt-live-button ${className}" data-live-toggle>
        <span class="dt-live-dot"></span>
        <span class="dt-live-label">${label}</span>
      </button>
    `;
  }
}
