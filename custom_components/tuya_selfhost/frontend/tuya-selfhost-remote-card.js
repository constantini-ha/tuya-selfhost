import { t, tn } from "./i18n.js";

const LAYOUT_GET = "tuya_selfhost/layout/get";

const STYLE = `
  .grid { display: grid; gap: 8px; padding: 0 16px 16px; }
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
      throw new Error("Informe a entidade do blaster em 'entity'");
    }
    this._config = config;
    this._control = null;
    this._loaded = false;
    this.innerHTML = "";
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._loaded) {
      this._loaded = true;
      this._load();
    }
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
    } catch (err) {
      this._error = err.message || String(err);
    }
    this._render();
  }

  _render() {
    const control = this._control;
    const card = document.createElement("ha-card");
    card.header =
      this._config.title || (control && control.name) || t(this.hass, "control_fallback");

    if (this._error) {
      card.innerHTML = `<div class="empty">Não consegui ler o controle: ${this._error}</div>`;
    } else if (!control || !(control.buttons || []).length) {
      card.innerHTML =
        `<div class="empty">Nenhum botão ainda. Monte o controle em
         <b>Controles Tuya</b>, na barra lateral.</div>`;
    } else {
      const grid = document.createElement("div");
      grid.className = "grid";
      grid.style.gridTemplateColumns = `repeat(${control.columns || 3}, 1fr)`;
      control.buttons.forEach((button) => {
        const key = document.createElement("button");
        key.className = "key";
        key.innerHTML =
          `<ha-icon icon="${button.icon || "mdi:remote"}"></ha-icon><span>${button.name}</span>`;
        key.addEventListener("click", () => this._send(control, button, key));
        grid.appendChild(key);
      });
      card.appendChild(grid);
    }

    const style = document.createElement("style");
    style.textContent = STYLE;
    this.innerHTML = "";
    this.appendChild(style);
    this.appendChild(card);
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
      this._toast(`Falhou: ${err.message || err}`);
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
    const buttons = (this._control && this._control.buttons) || [];
    const columns = (this._control && this._control.columns) || 3;
    return 1 + Math.ceil(buttons.length / columns);
  }
}

customElements.define("tuya-selfhost-remote-card", TuyaSelfhostRemoteCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "tuya-selfhost-remote-card",
  name: tn("card_name"),
  description: tn("card_desc"),
});
