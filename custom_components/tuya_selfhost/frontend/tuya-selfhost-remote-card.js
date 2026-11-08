import { t, tn } from "./i18n.js";

const LAYOUT_GET = "tuya_selfhost/layout/get";
const LAYOUT_ENTITIES = "tuya_selfhost/layout/entities";
const LAYOUT_SUB = "tuya_selfhost/layout/subscribe";

const STYLE = `
  .head { display: flex; align-items: center; gap: 14px; padding: 16px; }
  .head ha-icon { --mdc-icon-size: 26px; color: var(--state-icon-color, var(--primary-text-color)); }
  .head .grow { flex: 1; min-width: 0; }
  .head .name { font-size: 1.05em; }
  .head .state { color: var(--secondary-text-color); font-size: .85em; }
  .power {
    display: flex; align-items: center; justify-content: center;
    width: 42px; height: 42px; border: none; border-radius: 50%; cursor: pointer;
    background: rgba(127,127,127,.18); color: var(--primary-text-color);
  }
  .power[aria-pressed="true"] { background: var(--primary-color); color: var(--text-primary-color); }
  .power ha-icon { --mdc-icon-size: 22px; color: inherit; }
  .grid { display: grid; gap: 8px; padding: 0 16px 16px; }
  .grid.under { border-top: 1px solid var(--divider-color); padding-top: 16px; }
  .key {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 6px; padding: 14px 6px; min-height: 76px; cursor: pointer;
    border: none; border-radius: 12px; color: var(--primary-text-color);
    background: var(--ha-card-background, var(--card-background-color));
    box-shadow: var(--ha-card-box-shadow, 0 1px 3px rgba(0,0,0,.2));
    font: inherit; font-size: .9em; text-align: center;
  }
  .key:active { transform: scale(.96); }
  .key ha-icon { --mdc-icon-size: 26px; color: var(--state-icon-color, var(--primary-text-color)); }
  .key.sent { background: var(--primary-color); color: var(--text-primary-color); }
  .key.sent ha-icon { color: var(--text-primary-color); }
  .empty { padding: 0 16px 16px; color: var(--secondary-text-color); }
`;

class TuyaSelfhostRemoteCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error(tn("card_needs_entity"));
    }
    this._config = config;
    this._control = null;
    this._entities = {};
    this._loaded = false;
    this.innerHTML = "";
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (!this._loaded) {
      this._loaded = true;
      this._load();
      return;
    }
    // The power switch carries a state, so the card has to follow it.
    if (!first && this._powerId) {
      const now = hass.states[this._powerId];
      if (now && now.state !== this._powerShown) this._render();
    }
  }

  _t(key, vars) {
    return t(this._hass, key, vars);
  }

  async _load() {
    try {
      const stored = await this._hass.callWS({
        type: LAYOUT_GET,
        key: this._config.entity,
      });
      const controls = (stored && stored.controls) || [];
      this._control = this._config.control
        ? controls.find((c) => c.id === this._config.control)
        : controls[0];
      const map = await this._hass.callWS({
        type: LAYOUT_ENTITIES,
        key: this._config.entity,
      });
      this._entities = (this._control && map[this._control.id]) || {};
    } catch (err) {
      this._error = err.message || String(err);
    }
    this._render();
    this._watch();
  }

  async _watch() {
    // A key taught on a phone should show up here without a reload.
    if (this._unwatch) return;
    try {
      this._unwatch = await this._hass.connection.subscribeMessage(
        () => this._load(),
        { type: LAYOUT_SUB }
      );
    } catch (err) {
      this._unwatch = null;
    }
  }

  disconnectedCallback() {
    if (this._unwatch) {
      this._unwatch();
      this._unwatch = null;
    }
  }

  _render() {
    const control = this._control;
    const card = document.createElement("ha-card");
    const power = (control && control.power) || {};
    const paired = new Set([power.on, power.off].filter(Boolean));
    this._powerId = this._entities.power || null;
    const state = this._powerId ? this._hass.states[this._powerId] : null;
    this._powerShown = state ? state.state : null;

    if (state) {
      card.appendChild(this._renderHead(control, state));
    } else {
      card.header =
        this._config.title ||
        (control && control.name) ||
        this._t("control_fallback");
    }

    const loose = control
      ? control.buttons.filter((b) => !paired.has(b.command))
      : [];

    if (this._error) {
      const box = document.createElement("div");
      box.className = "empty";
      box.textContent = this._t("card_read_failed", { err: this._error });
      card.appendChild(box);
    } else if (!control || (!loose.length && !state)) {
      const box = document.createElement("div");
      box.className = "empty";
      box.textContent = this._t("card_empty");
      card.appendChild(box);
    } else if (loose.length) {
      const grid = document.createElement("div");
      grid.className = state ? "grid under" : "grid";
      grid.style.gridTemplateColumns = `repeat(${control.columns || 3}, 1fr)`;
      for (const button of loose) {
        const key = document.createElement("button");
        key.className = "key";
        key.innerHTML = `<ha-icon icon="${
          button.icon || "mdi:remote"
        }"></ha-icon><span>${button.name}</span>`;
        key.addEventListener("click", () => this._send(control, button, key));
        grid.appendChild(key);
      }
      card.appendChild(grid);
    }

    const style = document.createElement("style");
    style.textContent = STYLE;
    this.innerHTML = "";
    this.appendChild(style);
    this.appendChild(card);
  }

  _renderHead(control, state) {
    const on = state.state === "on";
    const head = document.createElement("div");
    head.className = "head";
    head.innerHTML = `<ha-icon icon="${
      state.attributes.icon || "mdi:power"
    }"></ha-icon>
      <div class="grow">
        <div class="name">${this._config.title || control.name}</div>
        <div class="state">${this._t(on ? "on" : "off")}${
          state.attributes.assumed_state ? ` · ${this._t("assumed")}` : ""
        }</div>
      </div>`;
    const button = document.createElement("button");
    button.className = "power";
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.innerHTML = `<ha-icon icon="mdi:power"></ha-icon>`;
    button.addEventListener("click", () =>
      this._hass.callService("switch", on ? "turn_off" : "turn_on", {
        entity_id: this._powerId,
      })
    );
    head.appendChild(button);
    return head;
  }

  async _send(control, button, key) {
    key.classList.add("sent");
    setTimeout(() => key.classList.remove("sent"), 350);
    try {
      await this._hass.callService("remote", "send_command", {
        entity_id: this._config.entity,
        device: control.device,
        command: button.command,
      });
    } catch (err) {
      this._toast(this._t("card_send_failed", { err: err.message || err }));
    }
  }

  _toast(message) {
    this.dispatchEvent(
      new CustomEvent("hass-notification", {
        detail: { message },
        bubbles: true,
        composed: true,
      })
    );
  }

  getCardSize() {
    const control = this._control;
    const power = (control && control.power) || {};
    const paired = new Set([power.on, power.off].filter(Boolean));
    const loose = control
      ? control.buttons.filter((b) => !paired.has(b.command)).length
      : 0;
    const columns = (control && control.columns) || 3;
    return 1 + Math.ceil(loose / columns);
  }
}

customElements.define("tuya-selfhost-remote-card", TuyaSelfhostRemoteCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "tuya-selfhost-remote-card",
  name: tn("card_name"),
  description: tn("card_desc"),
});
