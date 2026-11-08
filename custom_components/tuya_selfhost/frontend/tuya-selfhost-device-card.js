const STYLE = `
  .pad { padding:16px }
  .tiles { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; padding:4px 16px 0 }
  .tilewrap { text-align:center }
  .tile { width:100%; aspect-ratio:2/3; border-radius:18px; cursor:pointer; padding:0 0 14px;
    display:flex; align-items:flex-end; justify-content:center; transition:all .18s;
    border:1px solid var(--divider-color);
    background:linear-gradient(180deg, var(--secondary-background-color), var(--card-background-color)) }
  .tile[aria-pressed="true"] { border-color:transparent;
    background:linear-gradient(180deg, var(--primary-color), var(--primary-color));
    box-shadow:0 8px 20px color-mix(in srgb, var(--primary-color) 45%, transparent) }
  .tile:active { transform:scale(.97) }
  .tile:disabled { opacity:.4; cursor:default }
  .rocker { width:44%; height:6px; border-radius:999px; background:var(--secondary-text-color); opacity:.55 }
  .tile[aria-pressed="true"] .rocker { background:var(--text-primary-color); opacity:.9 }
  .tilename { margin-top:8px; font-size:.86em; color:var(--primary-text-color) }
  .actions { display:flex; justify-content:space-around; gap:8px; padding:16px 8px 10px }
  .action { display:flex; flex-direction:column; align-items:center; gap:6px; border:none;
    background:transparent; cursor:pointer; font:inherit; font-size:.78em;
    color:var(--secondary-text-color); padding:4px 10px }
  .action .circle { width:44px; height:44px; border-radius:50%; display:flex; align-items:center;
    justify-content:center; background:var(--secondary-background-color) }
  .action ha-icon { --mdc-icon-size:21px }
  .empty { padding:16px; color:var(--secondary-text-color) }
`;

class TuyaSelfhostDeviceCard extends HTMLElement {
  setConfig(config) {
    if (!config || (!config.entry_id && !config.entities)) {
      throw new Error("Informe 'entry_id' do aparelho ou uma lista 'entities'");
    }
    this._config = config;
    this._gangs = null;
    this._loaded = false;
    this.innerHTML = "";
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._loaded) {
      this._loaded = true;
      this._load();
      return;
    }
    const signature = this._signature();
    if (signature !== this._shown) this._render();
  }

  _signature() {
    return (this._gangs || [])
      .map((id) => (this._hass.states[id] || {}).state)
      .join("|");
  }

  async _load() {
    if (this._config.entities) {
      this._gangs = this._config.entities;
    } else {
      try {
        const registry = await this._hass.callWS({ type: "config/entity_registry/list" });
        this._gangs = registry
          .filter(
            (e) =>
              e.config_entry_id === this._config.entry_id &&
              e.entity_id.startsWith("switch.") &&
              !e.disabled_by &&
              !e.hidden_by
          )
          .map((e) => e.entity_id);
      } catch (err) {
        this._error = err.message || String(err);
        this._gangs = [];
      }
    }
    this._render();
  }

  _name(entityId) {
    const state = this._hass.states[entityId];
    const full = (state && state.attributes.friendly_name) || entityId;
    const title = this._config.title;
    return (title ? full.replace(title, "").trim() : full) || full;
  }

  _render() {
    this._shown = this._signature();
    const card = document.createElement("ha-card");
    if (this._config.title) card.header = this._config.title;

    if (this._error) {
      card.innerHTML = `<div class="empty">Não consegui ler o aparelho: ${this._error}</div>`;
    } else if (!this._gangs || !this._gangs.length) {
      card.innerHTML = `<div class="empty">Este aparelho não tem teclas para mostrar.</div>`;
    } else {
      const grid = document.createElement("div");
      grid.className = "tiles";
      for (const id of this._gangs) {
        const state = this._hass.states[id];
        const on = state && state.state === "on";
        const wrap = document.createElement("div");
        wrap.className = "tilewrap";
        const tile = document.createElement("button");
        tile.className = "tile";
        tile.setAttribute("aria-pressed", on ? "true" : "false");
        tile.disabled = !state || state.state === "unavailable";
        tile.innerHTML = '<span class="rocker"></span>';
        tile.addEventListener("click", () =>
          this._hass.callService("homeassistant", "toggle", { entity_id: id })
        );
        const name = document.createElement("div");
        name.className = "tilename";
        name.textContent = this._name(id);
        wrap.append(tile, name);
        grid.appendChild(wrap);
      }
      card.appendChild(grid);

      const actions = document.createElement("div");
      actions.className = "actions";
      const action = (icon, label, fn) => {
        const b = document.createElement("button");
        b.className = "action";
        b.innerHTML = `<span class="circle"><ha-icon icon="${icon}"></ha-icon></span><span>${label}</span>`;
        b.addEventListener("click", fn);
        return b;
      };
      actions.append(
        action("mdi:flash", "Ligar tudo", () =>
          this._hass.callService("homeassistant", "turn_on", { entity_id: this._gangs })
        ),
        action("mdi:flash-off", "Desligar tudo", () =>
          this._hass.callService("homeassistant", "turn_off", { entity_id: this._gangs })
        ),
        action("mdi:cog-outline", "Abrir", () => {
          history.pushState(null, "", "/tuya-selfhost");
          window.dispatchEvent(new CustomEvent("location-changed"));
        })
      );
      card.appendChild(actions);
    }

    const style = document.createElement("style");
    style.textContent = STYLE;
    this.innerHTML = "";
    this.append(style, card);
  }

  getCardSize() {
    return 2 + Math.ceil(((this._gangs || []).length || 1) / 3) * 2;
  }
}

customElements.define("tuya-selfhost-device-card", TuyaSelfhostDeviceCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "tuya-selfhost-device-card",
  name: "Aparelho Tuya Selfhost",
  description: "As teclas de um interruptor, desenhadas como teclas",
});
