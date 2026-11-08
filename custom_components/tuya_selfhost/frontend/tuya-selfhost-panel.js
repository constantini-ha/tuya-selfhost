import { t } from "./i18n.js";

const LAYOUT_GET = "tuya_selfhost/layout/get";
const LAYOUT_SET = "tuya_selfhost/layout/set";
const LAYOUT_SUB = "tuya_selfhost/layout/subscribe";

const ICONS = [
  "mdi:power", "mdi:snowflake", "mdi:snowflake-melt", "mdi:fan",
  "mdi:water-percent", "mdi:thermometer-plus", "mdi:thermometer-minus",
  "mdi:chevron-up", "mdi:chevron-down", "mdi:volume-plus", "mdi:volume-minus",
  "mdi:volume-off", "mdi:play-pause", "mdi:television", "mdi:lightbulb",
  "mdi:air-conditioner", "mdi:fan-speed-1", "mdi:fan-speed-2", "mdi:fan-speed-3",
  "mdi:dots-horizontal", "mdi:arrow-left", "mdi:arrow-right", "mdi:remote",
];

const STYLE = `
:host { display:block; background:var(--primary-background-color); min-height:100vh }
.bar { display:flex; align-items:center; gap:14px; height:64px; padding:0 16px;
  background:var(--app-header-background-color, var(--primary-color));
  color:var(--app-header-text-color, var(--text-primary-color)) }
.bar h1 { flex:1; margin:0; font-size:20px; font-weight:400 }
.bar button.menu { border:none; background:transparent; color:inherit; cursor:pointer;
  padding:8px; border-radius:50%; display:flex; line-height:0 }
.bar button.menu:hover { background:rgba(127,127,127,.18) }
button.icon { border:none; background:transparent; color:var(--secondary-text-color);
  cursor:pointer; padding:6px; border-radius:50%; display:flex; --mdc-icon-size:22px }
button.icon:hover { background:rgba(127,127,127,.18) }
.wrap { padding:16px; max-width:920px; margin:0 auto }
ha-card { margin-bottom:16px; overflow:hidden }
.pad { padding:16px }
.row { display:flex; align-items:center; gap:12px; flex-wrap:wrap }
.grow { flex:1; min-width:120px }
.muted { color:var(--secondary-text-color); font-size:.85em }
.pill { font-size:.72em; padding:3px 9px; border-radius:999px;
  background:var(--secondary-background-color); color:var(--secondary-text-color) }
.pill.on { background:var(--primary-color); color:var(--text-primary-color) }
.dev { display:flex; align-items:center; gap:14px; padding:16px;
  border-top:1px solid var(--divider-color) }
.dev:first-of-type { border-top:none }
.dev ha-icon { --mdc-icon-size:26px; color:var(--state-icon-color, var(--primary-text-color)) }
button.act { border:none; border-radius:9px; padding:9px 14px; cursor:pointer; font:inherit;
  background:var(--primary-color); color:var(--text-primary-color) }
button.act.ghost { background:transparent; color:var(--primary-color) }
button.act.warn { background:var(--error-color,#db4437); color:#fff }
button.act:disabled { opacity:.45; cursor:default }
input, select { padding:9px; border-radius:9px; font:inherit; border:1px solid var(--divider-color);
  background:var(--card-background-color); color:var(--primary-text-color) }

/* the remote itself */
.remote { width:300px; margin:8px auto 0; border-radius:34px; padding:22px 20px 26px;
  background:linear-gradient(170deg,#2B3040,#171A23); box-shadow:0 18px 38px rgba(0,0,0,.42);
  border:1px solid rgba(255,255,255,.07) }
.remote .brand { display:flex; align-items:center; justify-content:space-between;
  color:#8E97AC; font-size:11px; letter-spacing:.14em; text-transform:uppercase;
  margin-bottom:14px }
.remote .screen { background:#0E1016; border-radius:14px; padding:12px 14px; margin-bottom:18px;
  color:#9FE8FF; font-family:ui-monospace,Menlo,monospace; font-size:13px; min-height:19px;
  box-shadow:inset 0 2px 8px rgba(0,0,0,.6) }
.keys { display:grid; gap:12px; justify-items:center }
.keyslot { position:relative; width:100% }
.key { width:100%; aspect-ratio:1; display:flex; flex-direction:column; align-items:center;
  justify-content:center; gap:4px; border:none; border-radius:50%; cursor:pointer;
  background:linear-gradient(180deg,#3B4256,#272C3A); color:#E8ECF6; font:inherit; font-size:10px;
  box-shadow:0 3px 0 #171A23, 0 6px 10px rgba(0,0,0,.35) }
.key:active { transform:translateY(3px); box-shadow:0 0 0 #171A23, 0 2px 6px rgba(0,0,0,.4) }
.key ha-icon { --mdc-icon-size:24px }
.key.blank { background:rgba(255,255,255,.04); box-shadow:none; border:1px dashed rgba(255,255,255,.18);
  color:#6B728C }
.key.untaught { background:linear-gradient(180deg,#3B4256,#272C3A); opacity:.55 }
.key span { max-width:92%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.tools { display:flex; justify-content:center; gap:1px; margin-top:3px }
.tools button { border:none; background:transparent; color:#7D879C; cursor:pointer;
  font:inherit; font-size:11px; padding:1px 3px }
.tiles { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; padding:4px 0 }
.tilewrap { text-align:center }
.tile { width:100%; aspect-ratio:2/3; border-radius:18px; cursor:pointer; padding:0 0 14px;
  display:flex; align-items:flex-end; justify-content:center;
  border:1px solid var(--divider-color); transition:all .18s;
  background:linear-gradient(180deg, var(--secondary-background-color), var(--card-background-color)) }
.tile[aria-pressed="true"] { border-color:transparent;
  background:linear-gradient(180deg, var(--primary-color), var(--primary-color));
  box-shadow:0 8px 20px color-mix(in srgb, var(--primary-color) 45%, transparent) }
.tile:active { transform:scale(.97) }
.tile:disabled { opacity:.4; cursor:default }
.rocker { width:44%; height:6px; border-radius:999px; background:var(--secondary-text-color); opacity:.55 }
.tile[aria-pressed="true"] .rocker { background:var(--text-primary-color); opacity:.9 }
.tilename { margin-top:8px; font-size:.86em; color:var(--primary-text-color) }
.actions { display:flex; justify-content:space-around; gap:8px; padding:16px 8px 4px;
  border-top:1px solid var(--divider-color); margin-top:16px }
.action { display:flex; flex-direction:column; align-items:center; gap:6px; border:none;
  background:transparent; cursor:pointer; font:inherit; font-size:.78em;
  color:var(--secondary-text-color); padding:4px 10px }
.action .circle { width:46px; height:46px; border-radius:50%; display:flex; align-items:center;
  justify-content:center; background:var(--secondary-background-color) }
.action ha-icon { --mdc-icon-size:22px }
.ent { display:flex; align-items:center; gap:12px; padding:9px 0 }
.ent + .ent { border-top:1px solid var(--divider-color) }
.ent .name { font-size:.95em }
.ent .eid { font-size:.72em; color:var(--secondary-text-color) }
.toggle { width:46px; height:26px; border-radius:999px; border:none; cursor:pointer; padding:0;
  background:var(--divider-color); position:relative; transition:background .18s; flex:none }
.toggle .knob { position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%;
  background:#fff; transition:transform .18s; box-shadow:0 1px 3px rgba(0,0,0,.4) }
.toggle[aria-checked="true"] { background:var(--primary-color) }
.toggle[aria-checked="true"] .knob { transform:translateX(20px) }
.toggle:disabled { opacity:.4; cursor:default }
.banner { margin:14px 0 0; padding:12px 14px; border-radius:10px; font-size:13px;
  background:var(--primary-color); color:var(--text-primary-color) }
.banner button { margin:10px 6px 0 0 }
.tabs { display:flex; gap:4px; padding:0 8px; border-bottom:1px solid var(--divider-color);
  overflow-x:auto }
.tab { appearance:none; border:0; background:none; cursor:pointer; font:inherit; font-size:14px;
  padding:14px 12px; color:var(--secondary-text-color); border-bottom:2px solid transparent;
  white-space:nowrap }
.tab[aria-selected="true"] { color:var(--primary-color); border-bottom-color:var(--primary-color) }
.block { padding:16px; border-bottom:1px solid var(--divider-color) }
.block:last-child { border-bottom:0 }
.block h3 { margin:0 0 6px; font-size:15px; font-weight:500 }
.net { display:flex; align-items:center; gap:12px; padding:10px 0;
  border-bottom:1px solid var(--divider-color) }
.net:last-child { border-bottom:0 }
.mono { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12.5px }
pre.mono { margin:0; padding:12px; border-radius:10px; overflow:auto; max-height:260px;
  background:var(--code-editor-background-color,rgba(127,127,127,.12)) }
a.link { color:var(--primary-color); text-decoration:none; font-size:14px }
a.link:hover { text-decoration:underline }
ol.steps { margin:8px 0 0; padding-left:20px; font-size:13.5px; line-height:1.7;
  color:var(--secondary-text-color) }
`;

class TuyaSelfhostPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._open = null;      // entry_id of the device being viewed
    this._remote = null;    // id of the remote being edited
    this._busy = null;
    this._confirm = null;
    this._flash = null;
    this._screen = "";
    this._editing = false;
    this._ready = false;
    this._config = null;     // active panel-settings tab, null when closed
  }

  _t(key, vars) {
    return t(this._hass, key, vars);
  }

  set narrow(value) {
    this._narrow = value;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._ready) {
      this._ready = true;
      this._boot();
      return;
    }
    // Follow the device the user is looking at, so a toggle lands visibly.
    if (this._open && !this._remote) {
      const signature = this._signature();
      if (signature !== this._signature_shown) this._render();
    }
  }

  _signature() {
    return (this._byEntry[this._open] || [])
      .map((e) => (this._hass.states[e.entity_id] || {}).state)
      .join("|");
  }

  async _boot() {
    const [entries, registry] = await Promise.all([
      this._hass.callWS({ type: "config_entries/get", domain: "tuya_selfhost" }),
      this._hass.callWS({ type: "config/entity_registry/list" }),
    ]);
    this._entries = entries || [];
    this._byEntry = {};
    for (const item of registry) {
      if (item.platform !== "tuya_selfhost" || !item.config_entry_id) continue;
      (this._byEntry[item.config_entry_id] ||= []).push(item);
    }
    this._layouts = {};
    for (const entry of this._entries) {
      const remote = this._remoteOf(entry);
      if (!remote) continue;
      const stored = await this._hass.callWS({ type: LAYOUT_GET, key: remote });
      this._layouts[remote] = (stored && stored.controls) || [];
    }
    this._render();
    this._watch();
  }

  async _watch() {
    // Another screen — a phone, a second tab — can change the layouts. Without
    // this the panel keeps what it read at boot and writes that back on save.
    if (this._unwatch) return;
    try {
      this._unwatch = await this._hass.connection.subscribeMessage(
        () => this._reload(),
        { type: LAYOUT_SUB }
      );
    } catch (err) {
      this._unwatch = null;
    }
  }

  async _reload() {
    if (this._saving) return;
    for (const entry of this._entries || []) {
      const remote = this._remoteOf(entry);
      if (!remote) continue;
      const stored = await this._hass.callWS({ type: LAYOUT_GET, key: remote });
      this._layouts[remote] = (stored && stored.controls) || [];
    }
    this._render();
  }

  disconnectedCallback() {
    if (this._unwatch) {
      this._unwatch();
      this._unwatch = null;
    }
  }

  // ---------- data helpers ----------

  _remoteOf(entry) {
    const found = (this._byEntry[entry.entry_id] || []).find((e) =>
      e.entity_id.startsWith("remote.")
    );
    return found ? found.entity_id : null;
  }

  _entry() {
    return this._entries.find((e) => e.entry_id === this._open);
  }

  _controls(remote) {
    return this._layouts[remote] || [];
  }

  _control() {
    const remote = this._remoteOf(this._entry());
    return this._controls(remote).find((c) => c.id === this._remote);
  }

  async _save(remote) {
    this._saving = true;
    try {
      await this._write(remote);
    } finally {
      this._saving = false;
    }
  }

  async _write(remote) {
    await this._hass.callWS({
      type: LAYOUT_SET,
      key: remote,
      layout: { controls: this._layouts[remote] },
    });
  }

  _stateOf(entityId) {
    const s = this._hass.states[entityId];
    return s ? s.state : "—";
  }

  // ---------- actions ----------

  async _addControl(remote, name) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    this._layouts[remote].push({
      id: `${slug}_${Date.now().toString(36)}`,
      name,
      device: slug || "controle",
      columns: 3,
      buttons: [],
    });
    await this._save(remote);
    this._render();
  }

  async _removeControl(remote, id) {
    this._layouts[remote] = this._controls(remote).filter((c) => c.id !== id);
    if (this._remote === id) this._remote = null;
    await this._save(remote);
    this._render();
  }

  async _addButton(name, icon) {
    const control = this._control();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    control.buttons.push({
      command: `${slug || "btn"}_${Date.now().toString(36)}`,
      name,
      icon,
      taught: false,
    });
    await this._save(this._remoteOf(this._entry()));
    this._render();
  }

  async _moveButton(index, delta) {
    const list = this._control().buttons;
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    [list[index], list[to]] = [list[to], list[index]];
    await this._save(this._remoteOf(this._entry()));
    this._render();
  }

  async _deleteButton(index) {
    const control = this._control();
    const [gone] = control.buttons.splice(index, 1);
    await this._save(this._remoteOf(this._entry()));
    this._hass
      .callService("remote", "delete_command", {
        entity_id: this._remoteOf(this._entry()),
        device: control.device,
        command: gone.command,
      })
      .catch(() => {});
    this._render();
  }

  async _learn(index) {
    const control = this._control();
    const button = control.buttons[index];
    this._busy = this._t("learning", { name: button.name });
    this._render();
    try {
      await this._hass.callService("remote", "learn_command", {
        entity_id: this._remoteOf(this._entry()),
        device: control.device,
        command: button.command,
      });
      button.taught = true;
      await this._save(this._remoteOf(this._entry()));
      this._busy = null;
      this._confirm = index;
    } catch (err) {
      this._busy = null;
      this._flash = this._t("nothing_captured", { err: err.message || err });
    }
    this._render();
  }

  async _press(index) {
    const control = this._control();
    const button = control.buttons[index];
    this._screen = button.name;
    this._render();
    try {
      await this._hass.callService("remote", "send_command", {
        entity_id: this._remoteOf(this._entry()),
        device: control.device,
        command: button.command,
      });
    } catch (err) {
      this._flash = this._t("send_failed", { err: err.message || err });
      this._render();
    }
  }

  async _discard(index) {
    const control = this._control();
    const button = control.buttons[index];
    await this._hass.callService("remote", "delete_command", {
      entity_id: this._remoteOf(this._entry()),
      device: control.device,
      command: button.command,
    });
    button.taught = false;
    await this._save(this._remoteOf(this._entry()));
    this._confirm = null;
    this._flash = this._t("discarded");
    this._render();
  }

  async _deviceToDashboard() {
    const entry = this._entry();
    const config = await this._hass.callWS({ type: "lovelace/config", url_path: null });
    const card = {
      type: "custom:tuya-selfhost-device-card",
      entry_id: entry.entry_id,
      title: entry.title,
    };
    const view = config.views[0];
    if (view.sections) view.sections.push({ type: "grid", cards: [card] });
    else (view.cards ||= []).push(card);
    await this._hass.callWS({ type: "lovelace/config/save", url_path: null, config });
    this._flash = this._t("sent_to_dashboard", { name: entry.title });
    this._render();
  }

  async _toDashboard() {
    const control = this._control();
    const config = await this._hass.callWS({ type: "lovelace/config", url_path: null });
    const card = {
      type: "custom:tuya-selfhost-remote-card",
      entity: this._remoteOf(this._entry()),
      control: control.id,
      title: control.name,
    };
    const view = config.views[0];
    if (view.sections) view.sections.push({ type: "grid", cards: [card] });
    else (view.cards ||= []).push(card);
    await this._hass.callWS({ type: "lovelace/config/save", url_path: null, config });
    this._flash = this._t("sent_to_dashboard", { name: control.name });
    this._render();
  }

  // ---------- rendering ----------

  _render() {
    const root = document.createElement("div");
    const bar = document.createElement("div");
    bar.className = "bar";
    const menu = document.createElement("button");
    menu.className = "menu";
    menu.title = "Menu";
    menu.innerHTML = `<ha-icon icon="mdi:menu"></ha-icon>`;
    // Our own header replaces Home Assistant's, so it has to carry the way back
    // to the sidebar as well.
    menu.addEventListener("click", () =>
      this.dispatchEvent(
        new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })
      )
    );
    const title = document.createElement("h1");
    title.textContent = "Tuya Selfhost";
    const gear = document.createElement("button");
    gear.className = "menu";
    gear.style.marginLeft = "auto";
    gear.title = this._t("settings");
    gear.innerHTML = `<ha-icon icon="mdi:cog-outline"></ha-icon>`;
    gear.addEventListener("click", () => {
      this._config = this._config ? null : "add";
      this._open = null;
      this._remote = null;
      this._render();
    });
    bar.append(menu, title, gear);
    root.appendChild(bar);

    const wrap = document.createElement("div");
    wrap.className = "wrap";
    root.appendChild(wrap);

    if (this._flash) {
      const f = document.createElement("div");
      f.className = "banner";
      f.textContent = this._flash;
      wrap.appendChild(f);
      this._flash = null;
    }

    if (this._config) {
      wrap.appendChild(this._renderSettings());
      this._paint(root);
      return;
    }

    if (!this._entries || !this._entries.length) {
      wrap.innerHTML += `<ha-card><div class="pad">${this._t("no_devices")}</div></ha-card>`;
    } else if (this._remote) {
      wrap.appendChild(this._renderRemote());
    } else if (this._open) {
      this._signature_shown = this._signature();
      wrap.appendChild(this._renderDevice());
    } else {
      wrap.appendChild(this._renderList());
    }
    this._paint(root);
  }

  _navigate(path) {
    history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  async _copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const area = document.createElement("textarea");
      area.value = text;
      this.shadowRoot.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    this._flash = label;
    this._render();
  }

  async _loadReport() {
    this._report = "loading";
    try {
      const result = await this._hass.callService(
        "tuya_selfhost", "network_report", {}, undefined, false, true
      );
      this._report = (result && result.response && result.response.devices) || [];
    } catch (err) {
      this._report = [];
    }
    this._render();
  }

  async _alexaLoad() {
    this._alexa = "loading";
    try {
      const result = await this._hass.callService(
        "tuya_selfhost", "alexa_config", {}, undefined, false, true
      );
      this._alexa = (result && result.response) || null;
    } catch (err) {
      this._alexa = null;
    }
    this._render();
  }

  async _announceKeys() {
    try {
      const result = await this._hass.callService(
        "tuya_selfhost", "alexa_announce", {}, undefined, false, true
      );
      const answer = (result && result.response) || {};
      if (!answer.entity_count) this._flash = this._t("keys_none");
      else if (answer.sent) this._flash = this._t("keys_sent", { n: answer.entity_count });
      else this._flash = this._t("keys_not_sent");
    } catch (err) {
      this._flash = this._t("keys_not_sent");
    }
    this._render();
  }

  _renderSettings() {
    const card = document.createElement("ha-card");
    card.header = this._t("settings_title");

    const back = document.createElement("button");
    back.className = "act ghost";
    back.style.margin = "0 8px 8px";
    back.textContent = this._t("back_devices");
    back.addEventListener("click", () => {
      this._config = null;
      this._render();
    });
    card.appendChild(back);

    const tabs = document.createElement("div");
    tabs.className = "tabs";
    for (const [id, key] of [
      ["add", "tab_add"],
      ["network", "tab_network"],
      ["alexa", "tab_alexa"],
    ]) {
      const tab = document.createElement("button");
      tab.className = "tab";
      tab.setAttribute("aria-selected", String(this._config === id));
      tab.textContent = this._t(key);
      tab.addEventListener("click", () => {
        this._config = id;
        this._render();
      });
      tabs.appendChild(tab);
    }
    card.appendChild(tabs);

    if (this._config === "network") card.appendChild(this._tabNetwork());
    else if (this._config === "alexa") card.appendChild(this._tabAlexa());
    else card.appendChild(this._tabAdd());
    return card;
  }

  _tabAdd() {
    const box = document.createElement("div");
    const intro = document.createElement("div");
    intro.className = "block";
    intro.innerHTML = `<div class="muted">${this._t("add_intro")}</div>`;
    box.appendChild(intro);

    const start = document.createElement("div");
    start.className = "block";
    start.innerHTML = `<h3>${this._t("add_cloud")}</h3>
      <div class="muted">${this._t("add_cloud_text")}</div>
      <h3 style="margin-top:16px">${this._t("add_local")}</h3>
      <div class="muted">${this._t("add_local_text")}</div>
      <div class="muted" style="margin-top:14px">${this._t("add_which")}</div>`;
    const go = document.createElement("button");
    go.className = "act";
    go.style.marginTop = "14px";
    go.textContent = this._t("open_flow");
    go.addEventListener("click", () =>
      this._navigate("/config/integrations/dashboard/add?domain=tuya_selfhost")
    );
    start.appendChild(go);
    box.appendChild(start);

    const list = document.createElement("div");
    list.className = "block";
    list.innerHTML = `<h3>${this._t("manage_entries")}</h3>
      <div class="muted">${this._t("devices_count", {
        n: (this._entries || []).length,
      })}</div>`;
    const open = document.createElement("button");
    open.className = "act ghost";
    open.style.marginTop = "10px";
    open.textContent = this._t("manage_link");
    open.addEventListener("click", () =>
      this._navigate("/config/integrations/integration/tuya_selfhost")
    );
    list.appendChild(open);
    box.appendChild(list);
    return box;
  }

  _tabNetwork() {
    const box = document.createElement("div");
    const head = document.createElement("div");
    head.className = "block";
    head.innerHTML = `<h3>${this._t("network_title")}</h3>
      <div class="muted">${this._t("network_intro")}</div>`;
    box.appendChild(head);

    if (this._report === undefined) {
      this._report = "loading";
      setTimeout(() => this._loadReport(), 0);
    }
    const body = document.createElement("div");
    body.className = "block";
    if (this._report === "loading" || this._report === undefined) {
      body.innerHTML = `<div class="muted">${this._t("loading")}</div>`;
      box.appendChild(body);
      return box;
    }

    for (const device of this._report) {
      const row = document.createElement("div");
      row.className = "net";
      const pill = device.block_recommended ? "on" : "";
      row.innerHTML = `
        <div class="grow">
          <div>${device.name}</div>
          <div class="muted mono">${device.host || "—"} · ${
            device.mac || this._t("no_mac")
          }</div>
        </div>
        <span class="pill ${pill}">${
          device.block_recommended ? this._t("block_yes") : this._t("block_no")
        }</span>`;
      body.appendChild(row);
    }
    box.appendChild(body);

    const foot = document.createElement("div");
    foot.className = "block";
    foot.innerHTML = `<div class="muted">${this._t("mac_hint")}</div>`;
    const macs = this._report
      .filter((d) => d.block_recommended && d.mac)
      .map((d) => `${d.mac}  ${d.name}`)
      .join("\n");
    const copy = document.createElement("button");
    copy.className = "act";
    copy.style.margin = "10px 8px 0 0";
    copy.textContent = this._t("copy_macs");
    copy.disabled = !macs;
    copy.addEventListener("click", () => this._copy(macs, this._t("copied")));
    const again = document.createElement("button");
    again.className = "act ghost";
    again.textContent = this._t("refresh");
    again.addEventListener("click", () => {
      this._report = undefined;
      this._render();
    });
    foot.append(copy, again);
    box.appendChild(foot);
    return box;
  }

  _tabAlexa() {
    const box = document.createElement("div");
    const head = document.createElement("div");
    head.className = "block";
    head.innerHTML = `<div class="muted">${this._t("alexa_intro")}</div>
      <ol class="steps">${["alexa_s1", "alexa_s2", "alexa_s3", "alexa_s4", "alexa_s5"]
        .map((k) => `<li>${this._t(k)}</li>`)
        .join("")}</ol>`;
    box.appendChild(head);

    if (this._alexa === undefined) {
      this._alexa = "loading";
      setTimeout(() => this._alexaLoad(), 0);
    }
    const body = document.createElement("div");
    body.className = "block";
    if (this._alexa === "loading" || this._alexa === undefined) {
      body.innerHTML = `<div class="muted">${this._t("loading")}</div>`;
      box.appendChild(body);
      return box;
    }
    const yaml = (this._alexa && this._alexa.yaml) || "";
    body.innerHTML = `<h3>${this._t("alexa_yaml")}</h3>
      <div class="muted" style="margin-bottom:10px">${this._t("alexa_count", {
        n: (this._alexa && this._alexa.entity_count) || 0,
      })}</div>
      <pre class="mono">${yaml.replace(/</g, "&lt;")}</pre>`;
    const copy = document.createElement("button");
    copy.className = "act";
    copy.style.marginTop = "10px";
    copy.textContent = this._t("copy_yaml");
    copy.addEventListener("click", () => this._copy(yaml, this._t("copied")));
    body.appendChild(copy);
    box.appendChild(body);

    const keys = document.createElement("div");
    keys.className = "block";
    keys.innerHTML = `<h3>${this._t("keys_title")}</h3>
      <div class="muted">${this._t("keys_text")}</div>`;
    const send = document.createElement("button");
    send.className = "act";
    send.style.marginTop = "10px";
    send.textContent = this._t("send_keys");
    send.addEventListener("click", () => this._announceKeys());
    keys.appendChild(send);
    box.appendChild(keys);

    const guide = document.createElement("div");
    guide.className = "block";
    guide.innerHTML = `<h3>${this._t("guide_title")}</h3>
      <a class="link" href="${this._t("guide_url")}" target="_blank" rel="noreferrer">${this._t(
        "guide_link"
      )}</a>`;
    box.appendChild(guide);
    return box;
  }

  _renderList() {
    const card = document.createElement("ha-card");
    card.header = this._t("devices");
    for (const entry of this._entries) {
      const entities = this._byEntry[entry.entry_id] || [];
      const remote = this._remoteOf(entry);
      const row = document.createElement("div");
      row.className = "dev";
      const controls = remote ? this._controls(remote).length : 0;
      row.innerHTML = `
        <ha-icon icon="${remote ? "mdi:remote" : "mdi:power-socket-eu"}"></ha-icon>
        <div class="grow">
          <div>${entry.title}</div>
          <div class="muted">${this._t("entities", { n: entities.length })}${
            remote
              ? " · " + this._t(controls === 1 ? "control" : "controls", { n: controls })
              : ""
          }</div>
        </div>
        ${remote ? `<span class="pill on">${this._t("emitter")}</span>` : ""}`;
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        this._open = entry.entry_id;
        this._settings = false;
        this._config = null;
        this._render();
      });
      row.insertAdjacentHTML(
        "beforeend",
        '<ha-icon icon="mdi:chevron-right" style="--mdc-icon-size:22px;opacity:.5"></ha-icon>'
      );
      card.appendChild(row);
    }
    return card;
  }

  _renderDevice() {
    const entry = this._entry();
    const remote = this._remoteOf(entry);
    const card = document.createElement("ha-card");
    card.header = entry.title;

    const head = document.createElement("div");
    head.className = "pad row";
    const back = document.createElement("button");
    back.className = "act ghost";
    back.textContent = this._t(this._settings ? "back" : "back_devices");
    back.addEventListener("click", () => {
      if (this._settings) this._settings = false;
      else this._open = null;
      this._render();
    });
    head.appendChild(back);
    head.appendChild(Object.assign(document.createElement("span"), { className: "grow" }));
    if (!this._settings) {
      const cog = document.createElement("button");
      cog.className = "icon";
      cog.title = this._t("settings");
      cog.innerHTML = `<ha-icon icon="mdi:cog-outline"></ha-icon>`;
      cog.addEventListener("click", () => {
        this._settings = true;
        this._render();
      });
      head.appendChild(cog);
    }
    card.appendChild(head);

    const entities = this._byEntry[entry.entry_id] || [];
    const gangs = entities.filter((e) => e.entity_id.startsWith("switch."));
    const rest = entities.filter((e) => !e.entity_id.startsWith("switch."));

    if (this._settings) {
      const list = document.createElement("div");
      list.className = "pad";
      const title = document.createElement("div");
      title.className = "muted";
      title.style.marginBottom = "4px";
      title.textContent = this._t("settings");
      list.appendChild(title);
      for (const item of this._sorted(rest.length ? rest : entities)) {
        list.appendChild(this._entityRow(item));
      }
      card.appendChild(list);
      return card;
    }

    if (gangs.length) {
      const grid = document.createElement("div");
      grid.className = "pad tiles";
      grid.style.gridTemplateColumns = "repeat(3, 1fr)";
      for (const item of gangs) {
        const state = this._hass.states[item.entity_id];
        const on = state && state.state === "on";
        const wrap = document.createElement("div");
        wrap.className = "tilewrap";
        const tile = document.createElement("button");
        tile.className = "tile";
        tile.setAttribute("aria-pressed", on ? "true" : "false");
        tile.disabled = !state || state.state === "unavailable";
        tile.innerHTML = '<span class="rocker"></span>';
        tile.addEventListener("click", () =>
          this._hass.callService("homeassistant", "toggle", { entity_id: item.entity_id })
        );
        const name = document.createElement("div");
        name.className = "tilename";
        name.textContent = this._friendly(item.entity_id).replace(entry.title, "").trim() ||
          this._friendly(item.entity_id);
        wrap.append(tile, name);
        grid.appendChild(wrap);
      }
      card.appendChild(grid);
    }

    const actions = document.createElement("div");
    actions.className = "actions";
    const action = (icon, label, fn) => {
      const b = document.createElement("button");
      b.className = "action";
      b.innerHTML = `<span class="circle"><ha-icon icon="${icon}"></ha-icon></span><span>${label}</span>`;
      b.addEventListener("click", fn);
      return b;
    };
    if (gangs.length) {
      const ids = gangs.map((e) => e.entity_id);
      actions.append(
        action("mdi:flash", this._t("all_on"), () =>
          this._hass.callService("homeassistant", "turn_on", { entity_id: ids })
        ),
        action("mdi:flash-off", this._t("all_off"), () =>
          this._hass.callService("homeassistant", "turn_off", { entity_id: ids })
        )
      );
    }
    if (gangs.length) {
      actions.append(
        action("mdi:view-dashboard-outline", this._t("to_dashboard"), () => this._deviceToDashboard())
      );
    }
    if (actions.children.length) card.appendChild(actions);

    if (remote) {
      const section = document.createElement("div");
      section.className = "pad";
      section.style.borderTop = "1px solid var(--divider-color)";
      section.innerHTML = `<div class="muted" style="margin-bottom:10px">${this._t("remote_controls")}</div>`;
      for (const control of this._controls(remote)) {
        const taught = control.buttons.filter((b) => b.taught).length;
        const row = document.createElement("div");
        row.className = "row";
        row.style.padding = "6px 0";
        row.innerHTML = `<ha-icon icon="mdi:remote-tv"></ha-icon>
          <div class="grow"><div>${control.name}</div>
          <div class="muted">${this._t("buttons_taught", { n: control.buttons.length, t: taught })}</div></div>`;
        row.style.cursor = "pointer";
        row.addEventListener("click", (ev) => {
          if (ev.target.closest("button")) return;
          if (this._confirmControl === control.id) return;
          this._remote = control.id;
          this._render();
        });
        const open = document.createElement("button");
        open.className = "act";
        open.textContent = this._t("open");
        open.addEventListener("click", () => {
          this._remote = control.id;
          this._render();
        });
        const del = document.createElement("button");
        del.className = "act ghost";
        if (this._confirmControl === control.id) {
          del.className = "act warn";
          del.textContent = this._t("yes");
          del.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this._confirmControl = null;
            this._removeControl(remote, control.id);
          });
          const cancel = document.createElement("button");
          cancel.className = "act ghost";
          cancel.textContent = this._t("no");
          cancel.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this._confirmControl = null;
            this._render();
          });
          row.querySelector(".grow").innerHTML =
            `<div class="muted">${this._t("confirm_delete_control", { name: control.name })}</div>`;
          row.append(del, cancel);
        } else {
          del.textContent = this._t("delete");
          del.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this._confirmControl = control.id;
            this._render();
          });
          row.append(open, del);
        }
        section.appendChild(row);
      }
      const form = document.createElement("div");
      form.className = "row";
      form.style.marginTop = "10px";
      const name = document.createElement("input");
      name.className = "grow";
      name.placeholder = this._t("new_control");
      const add = document.createElement("button");
      add.className = "act";
      add.textContent = this._t("create_control");
      add.addEventListener("click", () => {
        if (name.value.trim()) this._addControl(remote, name.value.trim());
      });
      form.append(name, add);
      section.appendChild(form);
      card.appendChild(section);
    }
    return card;
  }

  _sorted(entities) {
    const rank = (id) => {
      const domain = id.split(".")[0];
      if (["switch", "light", "fan", "climate", "cover", "lock", "humidifier", "siren"].includes(domain)) return 0;
      if (["button", "scene", "select", "number"].includes(domain)) return 1;
      return 2;
    };
    return [...entities].sort(
      (a, b) => rank(a.entity_id) - rank(b.entity_id) || a.entity_id.localeCompare(b.entity_id)
    );
  }

  _friendly(entityId) {
    const state = this._hass.states[entityId];
    return (state && state.attributes && state.attributes.friendly_name) || entityId;
  }

  _entityRow(item) {
    const id = item.entity_id;
    const domain = id.split(".")[0];
    const state = this._hass.states[id];
    const row = document.createElement("div");
    row.className = "ent";
    const label = document.createElement("div");
    label.className = "grow";
    label.innerHTML = `<div class="name">${this._friendly(id)}</div><div class="eid">${id}</div>`;
    row.appendChild(label);

    const TOGGLEABLE = ["switch", "light", "fan", "humidifier", "siren", "input_boolean"];
    if (TOGGLEABLE.includes(domain)) {
      const on = state && state.state === "on";
      const toggle = document.createElement("button");
      toggle.className = "toggle";
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-checked", on ? "true" : "false");
      toggle.title = on ? "Desligar" : "Ligar";
      toggle.disabled = !state || state.state === "unavailable";
      toggle.innerHTML = '<span class="knob"></span>';
      toggle.addEventListener("click", () =>
        this._hass.callService("homeassistant", "toggle", { entity_id: id })
      );
      row.appendChild(toggle);
    } else if (domain === "button" || domain === "scene") {
      const press = document.createElement("button");
      press.className = "act ghost";
      press.textContent = "Acionar";
      press.addEventListener("click", () =>
        this._hass.callService(domain, domain === "button" ? "press" : "turn_on", {
          entity_id: id,
        })
      );
      row.appendChild(press);
    } else if (domain === "select" && state) {
      const select = document.createElement("select");
      for (const option of state.attributes.options || []) {
        const o = document.createElement("option");
        o.value = o.textContent = option;
        o.selected = option === state.state;
        select.appendChild(o);
      }
      select.addEventListener("change", () =>
        this._hass.callService("select", "select_option", {
          entity_id: id,
          option: select.value,
        })
      );
      row.appendChild(select);
    } else if (domain === "lock" && state) {
      const locked = state.state === "locked";
      const act = document.createElement("button");
      act.className = "act ghost";
      act.textContent = locked ? "Destrancar" : "Trancar";
      act.addEventListener("click", () =>
        this._hass.callService("lock", locked ? "unlock" : "lock", { entity_id: id })
      );
      row.appendChild(act);
    } else {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = state ? state.state : "—";
      row.appendChild(pill);
    }
    return row;
  }

  _renderRemote() {
    const control = this._control();
    const card = document.createElement("ha-card");

    const head = document.createElement("div");
    head.className = "pad row";
    const back = document.createElement("button");
    back.className = "act ghost";
    back.textContent = this._t("back");
    back.addEventListener("click", () => {
      this._remote = null;
      this._confirm = null;
      this._render();
    });
    const edit = document.createElement("button");
    edit.className = this._editing ? "act" : "act ghost";
    edit.textContent = this._t(this._editing ? "done" : "edit");
    edit.addEventListener("click", () => {
      this._editing = !this._editing;
      this._render();
    });
    head.append(back, Object.assign(document.createElement("span"), { className: "grow" }), edit);
    card.appendChild(head);

    // the remote body
    const body = document.createElement("div");
    body.className = "remote";
    body.innerHTML = `<div class="brand"><span>${control.name}</span><ha-icon icon="mdi:signal-variant" style="--mdc-icon-size:14px"></ha-icon></div>
      <div class="screen">${this._screen || "pronto"}</div>`;

    const keys = document.createElement("div");
    keys.className = "keys";
    keys.style.gridTemplateColumns = `repeat(${control.columns || 3}, 1fr)`;
    control.buttons.forEach((button, index) => {
      const slot = document.createElement("div");
      slot.className = "keyslot";
      const key = document.createElement("button");
      key.className = button.taught ? "key" : "key untaught";
      key.title = button.taught ? "Tocar para enviar" : "Tocar para aprender";
      key.innerHTML = `<ha-icon icon="${button.icon}"></ha-icon><span>${button.name}</span>`;
      key.addEventListener("click", () =>
        button.taught ? this._press(index) : this._learn(index)
      );
      slot.appendChild(key);

      if (!this._editing) {
        keys.appendChild(slot);
        return;
      }
      const tools = document.createElement("div");
      tools.className = "tools";
      const mk = (label, title, fn) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.title = title;
        b.addEventListener("click", fn);
        return b;
      };
      tools.append(
        mk("←", "", () => this._moveButton(index, -1)),
        mk("→", "", () => this._moveButton(index, 1)),
        mk("⟳", this._t("edit"), () => this._learn(index)),
        mk("✕", this._t("delete"), () => {
          this._confirmButton = index;
          this._render();
        })
      );
      slot.appendChild(tools);
      keys.appendChild(slot);
    });
    body.appendChild(keys);
    card.appendChild(body);

    if (this._busy) {
      const b = document.createElement("div");
      b.className = "banner";
      b.style.margin = "16px";
      b.textContent = this._busy;
      card.appendChild(b);
    }

    if (this._confirmButton !== null && this._confirmButton !== undefined) {
      const index = this._confirmButton;
      const button = control.buttons[index];
      const box = document.createElement("div");
      box.className = "banner";
      box.style.margin = "16px";
      box.innerHTML = `<div>${this._t("confirm_delete_button", { name: button.name })}</div>`;
      const sim = document.createElement("button");
      sim.className = "act warn";
      sim.textContent = this._t("yes");
      sim.addEventListener("click", () => {
        this._confirmButton = null;
        this._deleteButton(index);
      });
      const nao = document.createElement("button");
      nao.className = "act ghost";
      nao.style.color = "inherit";
      nao.textContent = this._t("no");
      nao.addEventListener("click", () => {
        this._confirmButton = null;
        this._render();
      });
      box.append(sim, nao);
      card.appendChild(box);
    }

    if (this._confirm !== null && this._confirm !== undefined) {
      const index = this._confirm;
      const box = document.createElement("div");
      box.className = "banner";
      box.style.margin = "16px";
      box.innerHTML = `<div>${this._t("captured")}</div>`;
      const test = document.createElement("button");
      test.className = "act ghost";
      test.style.color = "inherit";
      test.textContent = this._t("test");
      test.addEventListener("click", () => this._press(index));
      const keep = document.createElement("button");
      keep.className = "act";
      keep.textContent = this._t("keep");
      keep.addEventListener("click", () => {
        this._confirm = null;
        this._render();
      });
      const drop = document.createElement("button");
      drop.className = "act warn";
      drop.textContent = this._t("discard");
      drop.addEventListener("click", () => this._discard(index));
      box.append(test, keep, drop);
      card.appendChild(box);
    }

    const actions = document.createElement("div");
    actions.className = "pad row";
    const dash = document.createElement("button");
    dash.className = "act";
    dash.textContent = this._t("add_to_dashboard");
    dash.disabled = !control.buttons.some((b) => b.taught);
    dash.addEventListener("click", () => this._toDashboard());
    actions.append(dash);
    if (this._editing) {
      const columns = document.createElement("select");
      for (const n of [2, 3, 4]) {
        const o = document.createElement("option");
        o.value = String(n);
        o.textContent = this._t("columns", { n });
        o.selected = (control.columns || 3) === n;
        columns.appendChild(o);
      }
      columns.addEventListener("change", async () => {
        control.columns = Number(columns.value);
        await this._save(this._remoteOf(this._entry()));
        this._render();
      });
      actions.append(columns);
    }
    card.appendChild(actions);

    if (this._editing) card.appendChild(this._powerPair(control));

    if (!this._editing) {
      const hint = document.createElement("div");
      hint.className = "pad muted";
      hint.textContent = this._t(
        control.buttons.some((b) => !b.taught) ? "hint_untaught" : "hint_taught"
      );
      card.appendChild(hint);
      return card;
    }

    const form = document.createElement("div");
    form.className = "pad row";
    const name = document.createElement("input");
    name.className = "grow";
    name.placeholder = this._t("button_name");
    const icon = document.createElement("select");
    for (const i of ICONS) {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = i.replace("mdi:", "");
      icon.appendChild(o);
    }
    const add = document.createElement("button");
    add.className = "act";
    add.textContent = this._t("add_button");
    add.addEventListener("click", () => {
      if (name.value.trim()) this._addButton(name.value.trim(), icon.value);
    });
    form.append(name, icon, add);
    card.appendChild(form);

    const tip = document.createElement("div");
    tip.className = "pad muted";
    tip.textContent = this._t("hint_edit");
    card.appendChild(tip);
    return card;
  }

  _powerPair(control) {
    const box = document.createElement("div");
    box.className = "pad";
    box.style.borderTop = "1px solid var(--divider-color)";
    box.innerHTML = `<div style="font-size:15px;margin-bottom:4px">${this._t("power_pair")}</div>
      <div class="muted" style="margin-bottom:10px">${this._t("power_help")}</div>`;

    const row = document.createElement("div");
    row.className = "row";
    const power = control.power || {};
    for (const [side, label] of [["on", "power_on"], ["off", "power_off"]]) {
      const wrap = document.createElement("div");
      wrap.className = "grow";
      wrap.innerHTML = `<div class="muted" style="margin-bottom:4px">${this._t(label)}</div>`;
      const pick = document.createElement("select");
      pick.style.width = "100%";
      const none = document.createElement("option");
      none.value = "";
      none.textContent = this._t("power_none");
      none.selected = !power[side];
      pick.appendChild(none);
      for (const key of control.buttons) {
        const o = document.createElement("option");
        o.value = key.command;
        o.textContent = key.name;
        o.selected = power[side] === key.command;
        pick.appendChild(o);
      }
      pick.addEventListener("change", async () => {
        const next = { ...(control.power || {}) };
        if (pick.value) next[side] = pick.value;
        else delete next[side];
        if (next.on || next.off) control.power = next;
        else delete control.power;
        await this._save(this._remoteOf(this._entry()));
        this._render();
      });
      wrap.appendChild(pick);
      row.appendChild(wrap);
    }
    box.appendChild(row);
    return box;
  }

  _paint(root) {
    const style = document.createElement("style");
    style.textContent = STYLE;
    this.shadowRoot.innerHTML = "";
    this.shadowRoot.append(style, root);
  }
}

customElements.define("tuya-selfhost-panel", TuyaSelfhostPanel);
