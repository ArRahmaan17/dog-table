export class LivePlugin {
  constructor(table) {
    this.table = table;
    this.timerId = null;
    this.active = !!this.table.options.autoRefresh;
    this.baseInterval = this.resolveBaseInterval();
    this.currentInterval = this.baseInterval;
    this.maxInterval = this.baseInterval ? this.baseInterval * 4 : 0;
    this.lastResponseSignature = null;
    this.unchangedCount = 0;
    this.boundVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  init() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.boundVisibilityChange);
    }

    if (this.active) {
      this.start();
    }
  }

  resolveBaseInterval() {
    const value = Number(this.table.options.autoRefresh);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  isDocumentHidden() {
    return typeof document !== "undefined" && document.hidden;
  }

  handleVisibilityChange() {
    if (!this.active) {
      return;
    }

    if (this.isDocumentHidden()) {
      this.clearTimer();
      this.updateUI();
      return;
    }

    this.scheduleNext(this.currentInterval || this.baseInterval);
    this.updateUI();
  }

  start() {
    if (!this.baseInterval || !this.table.isRemote()) return;

    this.clearTimer();
    this.active = true;

    if (!this.isDocumentHidden()) {
      this.scheduleNext(this.currentInterval || this.baseInterval);
    }

    this.updateUI();
  }

  stop() {
    this.clearTimer();
    this.active = false;
    this.updateUI();
  }

  destroy() {
    this.clearTimer();

    if (typeof document !== "undefined") {
      document.removeEventListener(
        "visibilitychange",
        this.boundVisibilityChange
      );
    }
  }

  toggle() {
    if (this.active) this.stop();
    else this.start();
  }

  clearTimer() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  scheduleNext(delay = this.baseInterval) {
    if (!this.active || !this.baseInterval || this.isDocumentHidden()) {
      this.clearTimer();
      return;
    }

    this.clearTimer();
    this.timerId = window.setTimeout(async () => {
      this.timerId = null;

      if (!this.active || this.isDocumentHidden() || this.table.state.loading) {
        this.scheduleNext(this.currentInterval || this.baseInterval);
        return;
      }

      if (typeof this.table.options.hooks.onBeforeRefresh === "function") {
        this.table.options.hooks.onBeforeRefresh();
      }

      await this.table.update();

      if (this.active && !this.isDocumentHidden()) {
        this.scheduleNext(this.currentInterval || this.baseInterval);
      }
    }, delay);
  }

  createSignature(payload) {
    const source = payload?.rawPayload ?? payload;

    try {
      return JSON.stringify(source);
    } catch {
      return String(source);
    }
  }

  handleFetchSuccess(payload) {
    if (!this.active || !this.baseInterval) {
      return;
    }

    const nextSignature = this.createSignature(payload);

    if (this.lastResponseSignature == null || this.lastResponseSignature !== nextSignature) {
      this.lastResponseSignature = nextSignature;
      this.unchangedCount = 0;
      this.currentInterval = this.baseInterval;
    } else {
      this.unchangedCount += 1;
      this.currentInterval = Math.min(
        this.baseInterval * 2 ** this.unchangedCount,
        this.maxInterval
      );
    }

    this.updateUI();
  }

  handleFetchError() {
    if (!this.active || !this.baseInterval) {
      return;
    }

    this.updateUI();
  }

  updateUI() {
    const container = this.table.container.querySelector(".dt-live-status");
    if (container) {
      container.innerHTML = this.render();
    }
  }

  render() {
    const syncStatus = this.table.state.syncStatus;
    const shouldRenderLiveControl = this.baseInterval && this.table.isRemote();

    if (syncStatus?.state) {
      const className = {
        saving: "is-syncing",
        success: "is-success",
        error: "is-error",
      }[syncStatus.state] || "is-paused";

      return `
        <button
          type="button"
          class="dt-live-button ${className}"
          title="${syncStatus.title || syncStatus.label || "Sync status"}"
        >
          <span class="dt-live-dot"></span>
          <span class="dt-live-label">${syncStatus.label || "Sync"}</span>
        </button>
      `;
    }

    if (!shouldRenderLiveControl) {
      return "";
    }

    const isHidden = this.isDocumentHidden();
    const active = this.active && !isHidden;
    const label = this.active ? (isHidden ? "Auto Paused" : "Live") : "Paused";
    const className = active ? "is-active" : "is-paused";

    return `
      <button
        type="button"
        class="dt-live-button ${className}"
        data-live-toggle
        title="Refresh every ${this.currentInterval || this.baseInterval}ms"
      >
        <span class="dt-live-dot"></span>
        <span class="dt-live-label">${label}</span>
      </button>
    `;
  }
}
