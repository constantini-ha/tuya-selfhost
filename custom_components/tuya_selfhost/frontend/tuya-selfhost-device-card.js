import { t, tn } from "./i18n.js";

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
  .head { display:flex; align-items:center; gap:14px; padding:16px; cursor:pointer }
  .head .glyph { width:46px; height:46px; border-radius:12px; flex:none; display:flex;
    align-items:center; justify-content:center; background:var(--secondary-background-color) }
  .head .glyph ha-icon { --mdc-icon-size:26px; color:var(--state-icon-color, var(--primary-text-color)) }
  .head .grow { flex:1; min-width:0 }
  .head .name { font-size:1.02em; color:var(--primary-text-color) }
  .head .sub { font-size:.8em; color:var(--secondary-text-color) }
  .head .chev { color:var(--secondary-text-color); transition:transform .2s }
  .head .chev.open { transform:rotate(180deg) }
  .quick { display:flex; gap:8px; flex:none }
  .power { width:38px; height:38px; border-radius:50%; border:none; cursor:pointer; display:flex;
    align-items:center; justify-content:center; background:var(--secondary-background-color);
    color:var(--secondary-text-color) }
    .power.on { background:var(--primary-color); color:var(--text-primary-color) }
  .power.small { width:30px; height:30px }
  .power.small ha-icon { --mdc-icon-size:16px }
  .power ha-icon { --mdc-icon-size:19px }
  .body { border-top:1px solid var(--divider-color) }
  .gangs { display:flex; gap:2px; padding:0 10px 14px }
  .gang { flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:5px;
    border:none; background:transparent; cursor:pointer; font:inherit; padding:2px }
  .gang .dot { width:34px; height:34px; border-radius:50%; display:flex; align-items:center;
    justify-content:center; transition:all .18s }
  .gang .dot ha-icon { --mdc-icon-size:19px }
  .gang .lbl { font-size:.7em; line-height:1.15; max-width:100%; overflow:hidden;
    text-overflow:ellipsis; white-space:nowrap; color:var(--primary-text-color) }
  .gang .st { font-size:.64em; color:var(--secondary-text-color) }
  .gang.off .lbl, .gang.off .st { opacity:.55 }
`;

// One colour per key, like the vendor app, so a six gang switch is readable at a glance.
const CORES = ["#3B9EFF", "#34C759", "#FF8A3D", "#FFCC33", "#C77DFF", "#FF5D8F"];

class TuyaSelfhostDeviceCard extends HTMLElement {
  setConfig(config) {
    if (!config || (!config.entry_id && !config.entities)) {
      throw new Error("Informe 'entry_id' do aparelho ou uma lista 'entities'");
    }
    this._config = config;
    this._gangs = null;
    this._expanded = config.expanded === true;
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
              // A remote's power pair lives on its own card, not among the gangs.
              !e.entity_id.startsWith("switch.tuya_remote_") &&
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

  _area() {
    const first = (this._gangs || [])[0];
    const entities = this._hass.entities || {};
    const areas = this._hass.areas || {};
    const devices = this._hass.devices || {};
    const entry = first ? entities[first] : null;
    const areaId = entry
      ? entry.area_id || (devices[entry.device_id] || {}).area_id
      : null;
    return areaId && areas[areaId] ? areas[areaId].name : null;
  }

  _summary() {
    const states = (this._gangs || []).map((id) => (this._hass.states[id] || {}).state);
    if (!states.length) return "";
    if (states.every((s) => s === "unavailable")) return t(this.hass, "offline");
    const on = states.filter((s) => s === "on").length;
    if (!on) return t(this.hass, "all_off_state");
    return on === states.length
      ? t(this.hass, "all_on_state")
      : t(this.hass, "some_on", { n: on, total: states.length });
  }

  _render() {
    this._shown = this._signature();
    const card = document.createElement("ha-card");

    if (this._error) {
      card.innerHTML = `<div class="empty">Não consegui ler o aparelho: ${this._error}</div>`;
    } else if (!this._gangs || !this._gangs.length) {
      card.innerHTML = `<div class="empty">Este aparelho não tem teclas para mostrar.</div>`;
    } else {
      const head = document.createElement("div");
      head.className = "head";
      const area = this._area();
      head.innerHTML = `
        <span class="glyph"><ha-icon icon="${this._config.icon || "mdi:light-switch"}"></ha-icon></span>
        <span class="grow">
          <div class="name">${this._config.title || "Aparelho"}</div>
          <div class="sub">${[area, this._summary()].filter(Boolean).join(" · ")}</div>
        </span>`;
      const quick = document.createElement("div");
      quick.className = "quick";
      const anyOn = this._gangs.some((id) => (this._hass.states[id] || {}).state === "on");
      const power = (icon, on, fn, title) => {
        const b = document.createElement("button");
        b.className = on ? "power on" : "power";
        b.title = title;
        b.innerHTML = `<ha-icon icon="${icon}"></ha-icon>`;
        b.addEventListener("click", (ev) => {
          ev.stopPropagation();
          fn();
        });
        return b;
      };
      const geral = power("mdi:power", anyOn, () =>
        this._hass.callService("homeassistant", anyOn ? "turn_off" : "turn_on", {
          entity_id: this._gangs,
        }),
        anyOn ? t(this.hass, "all_off") : t(this.hass, "all_on")
      );
      // with a key of its own per gang, the all-at-once button is a secondary action
      if (this._gangs.length > 1) geral.classList.add("small");
      quick.append(geral);
      const chev = document.createElement("ha-icon");
      chev.setAttribute("icon", "mdi:chevron-down");
      chev.className = this._expanded ? "chev open" : "chev";
      head.append(quick, chev);
      head.addEventListener("click", () => {
        this._expanded = !this._expanded;
        this._render();
      });
      card.appendChild(head);

      if (this._gangs.length > 1) {
        const row = document.createElement("div");
        row.className = "gangs";
        this._gangs.forEach((id, index) => {
          const st = this._hass.states[id];
          const on = st && st.state === "on";
          const cor = CORES[index % CORES.length];
          const b = document.createElement("button");
          b.className = on ? "gang" : "gang off";
          b.title = this._name(id);
          b.innerHTML = `
            <span class="dot"><ha-icon icon="mdi:power"></ha-icon></span>
            <span class="lbl">${this._name(id)}</span>
            <span class="st">${on ? "Ligado" : st && st.state === "unavailable" ? "—" : "Desligado"}</span>`;
          const dot = b.querySelector(".dot");
          dot.style.color = cor;
          dot.style.opacity = on ? "1" : "0.42";
          dot.style.background = on
            ? `color-mix(in srgb, ${cor} 24%, transparent)`
            : `color-mix(in srgb, ${cor} 10%, transparent)`;
          dot.style.boxShadow = on
            ? `0 0 0 2px color-mix(in srgb, ${cor} 55%, transparent)`
            : "none";
          b.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this._hass.callService("homeassistant", "toggle", { entity_id: id });
          });
          row.appendChild(b);
        });
        card.appendChild(row);
      }

      if (!this._expanded) {
        const style = document.createElement("style");
        style.textContent = STYLE;
        this.innerHTML = "";
        this.append(style, card);
        return;
      }

      const body = document.createElement("div");
      body.className = "body";
      card.appendChild(body);

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
      body.appendChild(grid);

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
        action("mdi:flash", t(this.hass, "all_on"), () =>
          this._hass.callService("homeassistant", "turn_on", { entity_id: this._gangs })
        ),
        action("mdi:flash-off", t(this.hass, "all_off"), () =>
          this._hass.callService("homeassistant", "turn_off", { entity_id: this._gangs })
        ),
        action("mdi:cog-outline", t(this.hass, "settings"), () => {
          history.pushState(null, "", "/tuya-selfhost");
          window.dispatchEvent(new CustomEvent("location-changed"));
        })
      );
      body.appendChild(actions);
    }

    const style = document.createElement("style");
    style.textContent = STYLE;
    this.innerHTML = "";
    this.append(style, card);
  }

  getCardSize() {
    if (!this._expanded) return 2;
    return 2 + Math.ceil(((this._gangs || []).length || 1) / 3) * 2;
  }
}

customElements.define("tuya-selfhost-device-card", TuyaSelfhostDeviceCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "tuya-selfhost-device-card",
  name: tn("device_card_name"),
  description: tn("device_card_desc"),
});
