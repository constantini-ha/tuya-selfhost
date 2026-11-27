import { LANGUAGES, t } from "./i18n.js";
import { REMOTE_CSS, acOf, acSignature, renderAc } from "./ac.js";
import { OUTLET_CSS, OUTLET_KINDS, deviceKind, keyOwnName, kindGlyph, loadOutletKinds, outletGlyph, outletKind,
  outletNames, saveOutletKinds } from "./outlets.js";

import { SCENE_CSS, SceneMethods } from "./scenes.js";
import { AUTO_CSS, AutomationMethods } from "./automations.js";
import { readActions, sameKeys, within, writeActions } from "./shortcuts.js";

const LAYOUT_GET = "tuya_selfhost/layout/get";
const LAYOUT_SET = "tuya_selfhost/layout/set";
const LAYOUT_SUB = "tuya_selfhost/layout/subscribe";
const CLOUD_STATUS = "tuya_selfhost/cloud/status";
const CLOUD_QR = "tuya_selfhost/cloud/qr";
const CLOUD_LOGIN = "tuya_selfhost/cloud/login";
const CLOUD_LOGOUT = "tuya_selfhost/cloud/logout";
const CLOUD_DEVICES = "tuya_selfhost/cloud/devices";
const CLOUD_ADD = "tuya_selfhost/cloud/add";
const ZHA_DEVICES = "zha/devices";
const RENAME = "tuya_selfhost/rename";
const PRESSES = "tuya_selfhost/presses";
const PRESS_WORDS = {
  remote_button_short_press: "press_short",
  remote_button_double_press: "press_double",
  remote_button_triple_press: "press_triple",
  remote_button_long_press: "press_long",
};

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
.bar .barpill { display:flex; align-items:center; gap:6px; min-height:36px; padding:0 14px 0 10px;
  border-radius:18px; cursor:pointer; font:inherit; font-size:14px; color:inherit;
  background:transparent; border:1px solid color-mix(in srgb, currentColor 30%, transparent);
  --mdc-icon-size:20px }
.bar .barpill[aria-pressed="true"] { background:var(--primary-color); border-color:transparent;
  color:var(--text-primary-color) }
.tilename.can { display:inline-flex; align-items:center; gap:4px; border:none; background:none;
  font:inherit; font-size:.86em; cursor:pointer; padding:4px 2px; --mdc-icon-size:14px }
.tilename.can ha-icon { color:var(--secondary-text-color) }
.devname .tilename.can { font-size:inherit; padding:0; text-align:left; color:inherit; --mdc-icon-size:20px }
.devname input.rename { margin:0; font-size:20px; text-align:left }
input.rename { width:100%; box-sizing:border-box; margin-top:6px; font-size:16px; text-align:center }
.kindrow input.rename { text-align:left; margin:0 0 2px }
button.icon { border:none; background:transparent; color:var(--secondary-text-color);
  cursor:pointer; padding:6px; border-radius:50%; display:flex; --mdc-icon-size:22px }
button.icon:hover { background:rgba(127,127,127,.18) }
.icons { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px }
.iconpick { width:44px; height:44px; border-radius:12px; cursor:pointer; display:flex;
  align-items:center; justify-content:center; --mdc-icon-size:22px; font:inherit;
  border:1px solid var(--divider-color); background:transparent; color:var(--primary-text-color) }
.iconpick[aria-pressed="true"] { background:var(--primary-color); border-color:var(--primary-color);
  color:var(--text-primary-color) }
.wrap { padding:16px; max-width:920px; margin:0 auto }
ha-card { margin-bottom:16px; overflow:hidden }
.pad { padding:16px }
.row { display:flex; align-items:center; gap:12px; flex-wrap:wrap }
.grow { flex:1; min-width:120px }
.muted { color:var(--secondary-text-color); font-size:.85em }
.pill { font-size:.72em; padding:3px 9px; border-radius:999px;
  background:var(--secondary-background-color); color:var(--secondary-text-color) }
.pill.on { background:var(--primary-color); color:var(--text-primary-color) }
.pill.good { background:var(--success-color,#43a047); color:#fff }
.pill.warn { background:var(--warning-color,#ffa726); color:#111 }
.pill.bad { background:var(--error-color,#db4437); color:#fff }
.net .advice { margin-top:3px }
.qr { display:flex; justify-content:center; padding:8px 0 4px }
.qr svg { border-radius:10px }
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

${REMOTE_CSS}
.tools { display:flex; justify-content:center; gap:1px; margin-top:3px }
.tools button { border:none; background:transparent; color:#7D879C; cursor:pointer;
  font:inherit; font-size:11px; padding:1px 3px }
.tiles { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; padding:4px 0 }
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
.tilename { margin-top:8px; font-size:.86em; color:var(--primary-text-color);
  overflow-wrap:anywhere }
${OUTLET_CSS}
${SCENE_CSS}
${AUTO_CSS}
.kindrow { padding:10px 0 }
.kindrow + .kindrow { border-top:1px solid var(--divider-color) }
.iconpick .face { width:22px; height:22px; --mdc-icon-size:22px }
.dev .face { width:26px; height:26px;
  color:var(--state-icon-color, var(--primary-text-color)) }
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
.autorow { padding:10px 0 }
.autorow + .autorow { border-top:1px solid var(--divider-color) }
.autorow .acts { display:flex; align-items:center; justify-content:flex-end; gap:8px;
  margin-top:6px }
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
.subtabs { display:flex; gap:8px; padding:14px 16px 2px; overflow-x:auto; scrollbar-width:none }
.subtabs::-webkit-scrollbar { display:none }
.subtab { display:flex; align-items:center; gap:6px; flex:none; min-height:38px; padding:0 14px 0 10px;
  border-radius:19px; cursor:pointer; font:inherit; font-size:14px; background:transparent;
  color:var(--primary-text-color); border:1px solid var(--divider-color); --mdc-icon-size:18px }
.subtab[aria-selected="true"] { background:var(--primary-color); border-color:transparent;
  color:var(--text-primary-color) }
.block { padding:16px; border-bottom:1px solid var(--divider-color) }
.blockhead { display:flex; align-items:center; justify-content:space-between; gap:8px }
.blockhead h3 { margin:0 }
.acct { display:flex; align-items:center; gap:12px; padding:12px 0;
  border-top:1px solid var(--divider-color) }
.acct:first-of-type { border-top:none }
.acct .grow { flex:1; min-width:0 }
.acct .nm { overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.acct button.act { flex:none }
.acct button.act[disabled] { opacity:.5; cursor:default }
.waiting { display:flex; flex-direction:column; align-items:center; gap:8px; padding:22px 0 10px;
  color:var(--secondary-text-color); font-size:.85em }
.waiting img { width:56px; height:56px }
.block:last-child { border-bottom:0 }
.block h3 { margin:0 0 6px; font-size:15px; font-weight:500 }
.net { display:flex; align-items:center; gap:12px; padding:10px 0;
  border-bottom:1px solid var(--divider-color) }
.net:last-child { border-bottom:0 }
.mono { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12.5px }
button.copyable { font:inherit; color:inherit; background:none; border:0; cursor:pointer;
  padding:4px 5px; margin:-4px -5px; border-radius:6px; -webkit-tap-highlight-color:transparent;
  text-decoration:underline dotted color-mix(in srgb, currentColor 45%, transparent);
  text-underline-offset:3px; transition:color .15s, background-color .15s, transform .1s }
@media (hover:hover) {
  button.copyable:hover { color:var(--primary-color); background:rgba(127,127,127,.12) } }
button.copyable:active { transform:scale(.96); background:rgba(127,127,127,.2) }
button.copyable:focus-visible { outline:2px solid var(--primary-color); outline-offset:1px }
pre.mono { margin:0; padding:12px; border-radius:10px; overflow:auto; max-height:260px;
  background:var(--code-editor-background-color,rgba(127,127,127,.12)) }
a.link { color:var(--primary-color); text-decoration:none; font-size:14px }
a.link:hover { text-decoration:underline }
details.setup summary { cursor:pointer; font-size:15px; font-weight:500 }
ol.steps { margin:8px 0 0; padding-left:20px; font-size:13.5px; line-height:1.7;
  color:var(--secondary-text-color) }
`;

function* cardsIn(node) {
  if (Array.isArray(node)) for (const item of node) yield* cardsIn(item);
  else if (node && typeof node === "object") {
    if (typeof node.type === "string") yield node;
    for (const value of Object.values(node)) yield* cardsIn(value);
  }
}

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
    this._scene = null;      // scene being created or edited
    this._auto = null;       // automation being created or edited
    this._scenes = false;    // the scenes screen is open
    this._renaming = null;   // entity_id of the key whose name is being typed
  }

  // Home Assistant rejects with an Error, a {code, message}, or {error: {code: 3}} when the link drops.
  _errText(err) {
    if (!err) return "";
    if (typeof err === "string") return err;
    if (this._lost(err)) return this._t("connection_lost");
    const inner = err.error || err;
    return inner.message || err.message || String(inner.code || err);
  }

  _lost(err) {
    return err === 3 || !!(err && (err.code === 3 || (err.error && err.error.code === 3)));
  }

  _whenBack(fn) {
    const conn = this._hass.connection;
    const again = () => {
      conn.removeEventListener("ready", again);
      fn();
    };
    conn.addEventListener("ready", again);
    if (conn.connected) again();
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
    // A redraw would throw away the automation being built.
    if (this._auto) return;
    if (this._scenes && !this._scene) {
      // A scene saved here, or anywhere else, shows up without a reload.
      if (this._scenesShown() !== this._scenes_shown) this._render();
      return;
    }
    // A redraw would throw away the name being typed.
    if (this._renaming) return;
    // Follow the device the user is looking at, so a toggle lands visibly.
    if (this._open && !this._remote) {
      const signature = this._signature();
      if (signature !== this._signature_shown) this._render();
    }
    if (this._remote && !this._editing && !this._busy && this._acSignature() !== this._ac_shown)
      this._render();
  }

  _scenesShown() {
    return this._scenesSignature() + "#" + this._autosSignature();
  }

  _acOf(control) {
    if (!control || !this._hass) return null;
    return acOf(this._hass, control.id);
  }

  _acSignature() {
    let control = null;
    try {
      control = this._control();
    } catch (err) {
      return "";
    }
    return acSignature(this._acOf(control));
  }

  _renderAc(state) {
    return renderAc(this._hass, state);
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
    this._index(registry);
    this._layouts = {};
    for (const entry of this._entries) {
      const remote = this._remoteOf(entry);
      if (!remote) continue;
      const stored = await this._hass.callWS({ type: LAYOUT_GET, key: remote });
      this._layouts[remote] = (stored && stored.controls) || [];
    }
    this._kinds = await loadOutletKinds(this._hass);
    await this._loadZigbee();
    this._loadAutomations();
    await this._cloudStatus();
    this._render();
    this._watch();
    this._watchEntries();
  }

  _index(registry) {
    this._registry = new Map(registry.map((item) => [item.entity_id, item]));
    const zigbee = Object.entries(this._byEntry || {}).filter(([id]) => id.startsWith("zha:"));
    this._byEntry = Object.fromEntries(zigbee);
    for (const item of registry) {
      if (item.platform !== "tuya_selfhost" || !item.config_entry_id) continue;
      // A disabled or hidden entity never gets a state, so it has nothing to show.
      if (item.disabled_by || item.hidden_by) continue;
      (this._byEntry[item.config_entry_id] ||= []).push(item);
    }
  }

  // A device added or removed anywhere (this tab, the form, another screen) shows up here.
  async _watchEntries() {
    if (this._unentries) return;
    const later = () => {
      clearTimeout(this._entriesTimer);
      this._entriesTimer = setTimeout(() => this._refreshEntries(), 1500);
    };
    try {
      const conn = this._hass.connection;
      const offEntries = await conn.subscribeMessage(
        (changes) => {
          if ((changes || []).some((c) => c.type && c.entry && c.entry.domain === "tuya_selfhost")) later();
        },
        { type: "config_entries/subscribe" }
      );
      const offRegistry = await conn.subscribeEvents((event) => {
        if (["create", "remove"].includes(event.data && event.data.action)) later();
      }, "entity_registry_updated");
      this._unentries = () => {
        offEntries();
        offRegistry();
      };
    } catch (err) {
      this._unentries = null;
    }
  }

  async _refreshEntries() {
    let entries;
    let registry;
    try {
      [entries, registry] = await Promise.all([
        this._hass.callWS({ type: "config_entries/get", domain: "tuya_selfhost" }),
        this._hass.callWS({ type: "config/entity_registry/list" }),
      ]);
    } catch (err) {
      return;
    }
    this._entries = entries || [];
    this._index(registry);
    await this._loadZigbee();
    for (const entry of this._entries) {
      const remote = this._remoteOf(entry);
      if (!remote || this._layouts[remote]) continue;
      const stored = await this._hass.callWS({ type: LAYOUT_GET, key: remote });
      this._layouts[remote] = (stored && stored.controls) || [];
    }
    // The network report and the account list are read again the next time they are drawn.
    if (this._report !== "loading") this._report = undefined;
    if (this._account && !this._account.loading && !this._account.adding) this._account = null;
    // A redraw would throw away an automation, a scene or a name being typed.
    if (this._auto || this._scene || this._renaming) return;
    this._render();
  }

  connectedCallback() {
    this._onLocation = () => this._showNotices();
    window.addEventListener("location-changed", this._onLocation);
    this._showNotices();
    if (!this._ready) return;
    this._watch();
    this._watchEntries();
    this._refreshEntries();
  }

  // HA has no address for its notifications: a tapped notice lands here and opens them like the bell.
  _showNotices() {
    if (!new URLSearchParams(location.search).has("notifications")) return;
    history.replaceState(history.state, "", location.pathname);
    this.dispatchEvent(new CustomEvent("hass-show-notifications", { bubbles: true, composed: true }));
  }

  async _loadZigbee() {
    // Zigbee devices belong to Home Assistant's own integration, but they are
    // devices in this house like any other, so they belong in this list too.
    try {
      const devices = await this._hass.callWS({ type: ZHA_DEVICES });
      // Built aside: a redraw while this is read must not find the device gone.
      const found = [];
      for (const device of devices || []) {
        if (device.active_coordinator) continue;
        const id = "zha:" + device.ieee;
        found.push({
          entry_id: id,
          title: device.user_given_name || device.name,
          zha: device,
        });
        // The registry row carries the key's own name, and lets it be renamed.
        this._byEntry[id] = (device.entities || []).map(
          (e) => (this._registry && this._registry.get(e.entity_id)) || { entity_id: e.entity_id }
        );
      }
      this._zigbee = found;
      this._noZigbee = false;
      this._zigbeeDown = null;
    } catch (err) {
      this._zigbee = [];
      this._zigbeeDown = await this._zhaTrouble();
      this._noZigbee = !this._zigbeeDown;
    }
  }

  // A ZHA entry that failed to start (stick unplugged or hung) is not a house without Zigbee.
  async _zhaTrouble() {
    try {
      const entries = await this._hass.callWS({ type: "config_entries/get", domain: "zha" });
      const entry = (entries || []).find((e) => e.state !== "loaded" && e.state !== "not_loaded");
      return entry ? { entry_id: entry.entry_id, reason: entry.reason || entry.state } : null;
    } catch (err) {
      return null;
    }
  }

  async _restartZigbee(button) {
    button.disabled = true;
    try {
      await this._hass.callApi(
        "POST",
        `config/config_entries/entry/${this._zigbeeDown.entry_id}/reload`
      );
    } catch (err) {
      // The entry's new state below tells whether it came back.
    }
    await this._loadZigbee();
    this._render();
  }

  _zigbeeDownBlock() {
    const block = document.createElement("div");
    block.className = "block";
    block.innerHTML = `<h3></h3><div class="muted"></div>
      <div class="muted" style="margin-top:6px;font-family:var(--code-font-family,monospace);font-size:12px;word-break:break-all"></div>`;
    block.querySelector("h3").textContent = this._t("zigbee_down");
    const [help, reason] = block.querySelectorAll(".muted");
    help.textContent = this._t("zigbee_down_help");
    reason.textContent = this._zigbeeDown.reason;
    const again = document.createElement("button");
    again.className = "act";
    again.style.marginTop = "12px";
    again.textContent = this._t("zigbee_down_retry");
    again.addEventListener("click", () => this._restartZigbee(again));
    block.appendChild(again);
    return block;
  }

  async _loadAutomations() {
    const ids = Object.keys(this._hass.states)
      .filter((id) => id.startsWith("automation."))
      .sort();
    const key = ids.join("|");
    if (key === this._autosKey) return;
    this._autosKey = key;
    const loaded = await Promise.all(
      ids.map((id) =>
        this._hass
          .callWS({ type: "automation/config", entity_id: id })
          .then((reply) => ({ entity_id: id, config: (reply && reply.config) || {} }))
          .catch(() => null)
      )
    );
    this._autos = loaded.filter(Boolean).map((auto) => {
      const triggers = auto.config.triggers || auto.config.trigger || [];
      return { ...auto, triggers, text: JSON.stringify(triggers).toLowerCase() };
    });
    this._render();
  }

  _gangsOf(entry) {
    return (this._byEntry[entry.entry_id] || []).filter(
      (e) =>
        e.entity_id.startsWith("switch.") &&
        !e.entity_id.startsWith("switch.tuya_remote_") &&
        // A key on the wall has no category; a setting like overcharge does.
        !e.entity_category
    );
  }

  _pressLabel(command) {
    return PRESS_WORDS[command] ? this._t(PRESS_WORDS[command]) : null;
  }

  // A name the panel wrote ends in " · <press>" in its maker's language: where that starts, or -1.
  _pressTail(alias, label) {
    for (const key of Object.values(PRESS_WORDS)) {
      const mine = this._t(key);
      if (!label.includes(mine)) continue;
      for (const language of LANGUAGES) {
        const tail = " \u00b7 " + label.split(mine).join(t({ language }, key));
        if (alias.endsWith(tail)) return alias.length - tail.length;
      }
    }
    const tail = " \u00b7 " + label;
    return alias.endsWith(tail) ? alias.length - tail.length : -1;
  }

  // The shortcut's name with its press in the language of whoever is looking.
  _aliasText(entry, auto) {
    const alias = auto.config.alias || auto.entity_id;
    const press = auto.triggers.length === 1 && this._triggerName(entry, auto.triggers[0]);
    const cut = press ? this._pressTail(alias, press) : -1;
    return cut < 0 ? alias : alias.slice(0, cut) + " \u00b7 " + press;
  }

  // What a device sets off, not what acts on it: only the triggers are searched.
  _automationsFor(entry) {
    const keys = [];
    if (entry.zha) keys.push(entry.zha.ieee, entry.zha.device_reg_id);
    for (const item of this._byEntry[entry.entry_id] || []) keys.push(item.entity_id);
    return (this._autos || []).filter((auto) =>
      keys.some((key) => key && auto.text.includes(String(key).toLowerCase()))
    );
  }

  _pressOf(entry, auto) {
    for (const trigger of auto.triggers || []) {
      const label = this._triggerName(entry, trigger, false);
      if (label) return label;
    }
    return null;
  }

  // The row wears what the device is: its type first (a fence energizer), a socket only
  // when its keys are sockets.
  _deviceGlyph(entry) {
    const gangs = this._gangsOf(entry);
    const typed = deviceKind(this._hass, entry.entry_id, gangs[0] && gangs[0].entity_id);
    if (typed) return `<ha-icon icon="${typed.icon}"></ha-icon>`;
    const plugs = gangs.some((item) => {
      const state = this._hass.states[item.entity_id];
      const kind = outletKind(this._kinds, item.entity_id,
        state && state.attributes.device_class);
      return (OUTLET_KINDS.find((k) => k.id === kind) || {}).plug;
    });
    return plugs
      ? kindGlyph(this._hass, OUTLET_KINDS.find((k) => k.socket))
      : '<ha-icon icon="mdi:light-switch"></ha-icon>';
  }

  // A device whose keys are all sockets may be hiding a USB port, and only the
  // house knows. Say so once, until someone marks one of them.
  _needsKinds(entry) {
    const gangs = this._gangsOf(entry);
    if (gangs.length < 2) return false;
    if (gangs.some((item) => (this._kinds || {})[item.entity_id])) return false;
    return gangs.every(
      (item) =>
        ((this._hass.states[item.entity_id] || { attributes: {} }).attributes
          .device_class) === "outlet"
    );
  }

  _keyNames(entry, gangs) {
    return outletNames(
      gangs.map((item) => ({
        entity_id: item.entity_id,
        named: !!item.name,
        fallback: this._shortName(item.entity_id, entry.title),
        deviceClass: (this._hass.states[item.entity_id] || { attributes: {} })
          .attributes.device_class,
      })),
      this._kinds,
      (key) => this._t(key)
    );
  }

  // The name lives in the entity registry and is the one spoken first, so dashboards and voice get it too.
  async _renameKey(entry, item, text) {
    const name = text.trim() || null;
    this._renaming = null;
    if (name === (item.name || null)) {
      // Later, so the tap that took the focus away still lands on what it aimed at.
      setTimeout(() => this._render(), 150);
      return;
    }
    const before = this._friendly(item.entity_id);
    try {
      const answer = await this._hass.callWS({
        type: RENAME, entity_id: item.entity_id, name,
      });
      item.name = name;
      this._flash = this._renamedText(answer);
      // The state carries the old name until Home Assistant writes it again.
      for (let tries = 0; tries < 10 && this._friendly(item.entity_id) === before; tries += 1) {
        await new Promise((done) => setTimeout(done, 150));
      }
    } catch (err) {
      this._flash = this._t("rename_failed", { err: this._errText(err) });
    }
    this._render();
  }

  // A Zigbee device falls back to its own name; a Wi-Fi device has no other, so empty keeps it.
  async _renameDevice(entry, text) {
    const name = text.trim() || null;
    this._renaming = null;
    const current = entry.zha ? entry.zha.user_given_name || null : entry.title;
    if (name === current || (!name && !entry.zha)) {
      setTimeout(() => this._render(), 150);
      return;
    }
    try {
      const target = entry.zha
        ? { device_id: entry.zha.device_reg_id }
        : { entry_id: entry.entry_id };
      const answer = await this._hass.callWS({ type: RENAME, ...target, name });
      this._flash = this._renamedText(answer);
      if (entry.zha) await this._loadZigbee();
      else entry.title = name;
    } catch (err) {
      this._flash = this._t("rename_failed", { err: this._errText(err) });
    }
    this._render();
  }

  _renamedText(answer) {
    if (!answer || !answer.exposed) return null;
    if ((answer.pinned || []).length) return this._t("rename_pinned");
    return this._t(answer.alexa ? "rename_alexa" : "keys_not_sent");
  }

  _deviceNameInput(entry) {
    const input = document.createElement("input");
    input.className = "rename";
    input.value = entry.zha ? entry.zha.user_given_name || "" : entry.title;
    input.placeholder = entry.zha ? entry.zha.name : entry.title;
    input.maxLength = 60;
    input.enterKeyHint = "done";
    input.setAttribute("aria-label", this._t("rename_device"));
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      if (save) this._renameDevice(entry, input.value);
      else {
        this._renaming = null;
        this._render();
      }
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") finish(true);
      if (event.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
    return input;
  }

  // ha-card styles a slotted .card-header like its own, and its own takes only text.
  _deviceTitle(entry) {
    const head = document.createElement("h1");
    head.className = "card-header devname";
    if (this._renaming === entry.entry_id) {
      const input = this._deviceNameInput(entry);
      head.appendChild(input);
      setTimeout(() => input.focus(), 0);
      return head;
    }
    const button = document.createElement("button");
    button.className = "tilename can";
    button.title = this._t("rename_device");
    button.innerHTML = `<span></span><ha-icon icon="mdi:pencil-outline"></ha-icon>`;
    button.querySelector("span").textContent = entry.title;
    button.addEventListener("click", () => {
      this._renaming = entry.entry_id;
      this._render();
    });
    head.appendChild(button);
    return head;
  }

  _renameInput(entry, item, shown) {
    const input = document.createElement("input");
    input.className = "rename";
    input.value = item.name ? shown : "";
    input.placeholder = shown;
    input.maxLength = 40;
    input.enterKeyHint = "done";
    input.setAttribute("aria-label", this._t("rename_key"));
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      if (save) this._renameKey(entry, item, input.value);
      else {
        this._renaming = null;
        this._render();
      }
    };
    input.addEventListener("focus", () => { this._renaming = item.entity_id; });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") finish(true);
      if (event.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
    return input;
  }

  _kindsBlock(entry, gangs) {
    if (!gangs.length) return null;
    const box = document.createElement("div");
    box.className = "pad";
    box.style.borderTop = "1px solid var(--divider-color)";
    const head = document.createElement("div");
    head.textContent = this._t("outlet_kinds");
    const hint = document.createElement("div");
    hint.className = "muted";
    hint.style.margin = "4px 0 6px";
    hint.textContent = this._t("outlet_kinds_hint");
    box.append(head, hint);

    const names = this._keyNames(entry, gangs);
    for (const item of gangs) {
      const row = document.createElement("div");
      row.className = "kindrow";
      const name = this._renameInput(entry, item, names[item.entity_id]);
      const picker = document.createElement("div");
      picker.className = "icons";
      const state = this._hass.states[item.entity_id];
      const current = outletKind(this._kinds, item.entity_id,
        state && state.attributes.device_class, keyOwnName(this._hass, item.entity_id));
      for (const kind of OUTLET_KINDS) {
        const pick = document.createElement("button");
        pick.className = "iconpick";
        pick.setAttribute("aria-pressed", String(current === kind.id));
        pick.title = this._t(kind.label);
        pick.innerHTML = kindGlyph(this._hass, kind,
          '<span class="rocker" style="width:22px"></span>');
        pick.addEventListener("click", () => this._setKind(item.entity_id, kind.id));
        picker.appendChild(pick);
      }
      row.append(name, picker);
      box.appendChild(row);
    }
    return box;
  }

  async _setKind(entityId, kind) {
    this._kinds = { ...(this._kinds || {}), [entityId]: kind };
    this._render();
    this._saving = true;
    try {
      await saveOutletKinds(this._hass, this._kinds);
    } finally {
      this._saving = false;
    }
  }

  // ---------- shortcuts made from a press ----------

  // What ZHA calls each press of this device (any model), fetched once per device.
  _pressesOf(entry) {
    const id = entry.zha && entry.zha.device_reg_id;
    if (!id) return [];
    this._presses = this._presses || {};
    if (!(id in this._presses)) {
      this._presses[id] = [];
      this._hass
        .callWS({ type: PRESSES, device_id: id })
        .then((presses) => {
          this._presses[id] = presses || [];
          this._render();
        })
        .catch(() => {});
      this._loadPressWords();
    }
    return this._presses[id];
  }

  async _loadPressWords() {
    if (this._zhaWords !== undefined) return;
    this._zhaWords = null;
    try {
      this._zhaWords = await this._hass.loadBackendTranslation("device_automation", "zha");
      this._render();
    } catch (err) {
      this._zhaWords = null;
    }
  }

  // The press an event or a saved trigger stands for, matched the way ZHA's logbook does.
  _pressFor(entry, data) {
    const { device_ieee: _ieee, device_id: _id, unique_id: _unique, ...fields } = data || {};
    if (!Object.keys(fields).length) return null;
    return (
      this._pressesOf(entry).find(
        (press) => within(press.data, fields) || within(fields, press.data)
      ) || null
    );
  }

  _pressWords(entry, press) {
    const zha = (key, vars) => (this._zhaWords && this._zhaWords(key, vars)) || "";
    const sub =
      zha("component.zha.device_automation.trigger_subtype." + press.subtype) ||
      press.subtype.replace(/_/g, " ");
    const kind =
      this._pressLabel(press.type) ||
      zha("component.zha.device_automation.trigger_type." + press.type, { subtype: sub }) ||
      press.type.replace(/_/g, " ");
    const buttons = new Set(this._pressesOf(entry).map((item) => item.subtype));
    return buttons.size > 1 ? sub + ", " + kind : kind;
  }

  // A trigger's press in words; a command ZHA does not name shows raw only when asked.
  _triggerName(entry, trigger, raw = true) {
    if ((trigger.trigger || trigger.platform) === "device" && trigger.domain === "zha")
      return this._pressWords(entry, trigger);
    if (trigger.event_type !== "zha_event") return null;
    const data = trigger.event_data || {};
    const press = this._pressFor(entry, data);
    if (press) return this._pressWords(entry, press);
    return this._pressLabel(data.command) || (raw && data.command) || null;
  }

  _startShortcut(entry) {
    this._pressesOf(entry);
    this._newAuto = { entry_id: entry.entry_id, trigger: null, error: null,
                      target: null, keys: [], act: "toggle", retry: 0 };
    this._render();
    this._listenPress(entry);
  }

  // One press can speak twice (an attribute report, a quirk's own command and its
  // remote_button_* twin): collect for a moment, then keep the one ZHA names.
  async _listenPress(entry) {
    this._stopPress();
    const draft = this._newAuto;
    draft.error = null;
    draft.heard = [];
    try {
      this._unpress = await this._hass.connection.subscribeEvents((event) => {
        const data = (event && event.data) || {};
        if (!this._newAuto || this._newAuto.trigger) return;
        if (data.device_ieee !== entry.zha.ieee) return;
        this._newAuto.heard.push(data);
        clearTimeout(this._pressPick);
        this._pressPick = setTimeout(() => this._pickPress(entry), 700);
      }, "zha_event");
    } catch (err) {
      draft.error = this._errText(err);
      this._render();
      return;
    }
    this._pressTimer = setTimeout(() => {
      this._stopPress();
      if (this._newAuto && !this._newAuto.trigger) {
        this._newAuto.error = this._t("press_none");
        this._render();
      }
    }, 30000);
  }

  _pickPress(entry) {
    const draft = this._newAuto;
    if (!draft || draft.trigger || !draft.heard.length) return;
    const heard = draft.heard;
    const press = heard.map((data) => this._pressFor(entry, data)).find(Boolean);
    let match;
    if (press) {
      // The very fields ZHA's own trigger for this press listens to, button included.
      match = { ...press.data };
    } else {
      const best =
        heard.find((data) => String(data.command || "").startsWith("remote_button_")) ||
        // A button can report its on/off attribute along with the press; the command is the press.
        heard.find((data) => data.command && data.command !== "attribute_updated") ||
        heard[0];
      match = { command: best.command };
      // A quirk that only speaks press_type says which press in the params.
      if (best.params && Object.keys(best.params).length && !String(best.command).startsWith("remote_button_"))
        match.params = best.params;
    }
    draft.trigger = {
      trigger: "event",
      event_type: "zha_event",
      event_data: { device_ieee: entry.zha.ieee, ...match },
    };
    this._stopPress();
    this._render();
  }

  _stopPress() {
    clearTimeout(this._pressTimer);
    clearTimeout(this._pressPick);
    if (this._unpress) {
      this._unpress();
      this._unpress = null;
    }
  }

  _cancelShortcut() {
    this._stopPress();
    this._newAuto = null;
    this._render();
  }

  // One press that switches keys of one device fits the form; anything richer is Home Assistant's.
  _shortcutOf(entry, auto) {
    if (auto.triggers.length !== 1 || !this._triggerName(entry, auto.triggers[0])) return null;
    const read = readActions(auto.config.actions || auto.config.action);
    if (!read) return null;
    const target = this._shortcutTargets().find((item) =>
      read.keys.every((id) => item.gangs.some((gang) => gang.entity_id === id))
    );
    if (!target) return null;
    return { ...read, trigger: auto.triggers[0], target: target.id };
  }

  _editShortcut(entry, auto) {
    const shortcut = entry.zha && this._shortcutOf(entry, auto);
    if (!shortcut) {
      this._navigate("/config/automation/edit/" + auto.config.id);
      return;
    }
    this._stopPress();
    this._newAuto = { ...shortcut, entry_id: entry.entry_id, edit: auto,
                      was: { act: shortcut.act, keys: shortcut.keys,
                             press: this._triggerName(entry, shortcut.trigger) },
                      error: null, heard: [] };
    this._render();
  }

  _relisten(entry) {
    this._newAuto.trigger = null;
    this._newAuto.relearn = true;
    this._render();
    this._listenPress(entry);
  }

  _shortcutTargets() {
    const all = [...(this._entries || []), ...(this._zigbee || [])];
    return all
      .map((entry) => ({ id: entry.entry_id, title: entry.title, gangs: this._gangsOf(entry) }))
      .filter((target) => target.gangs.length);
  }

  async _makeShortcut(entry) {
    const draft = this._newAuto;
    if (!draft || !draft.trigger || !draft.keys.length) return;
    const press = this._triggerName(entry, draft.trigger);
    const saved = draft.edit && draft.edit.config;
    const kept = saved && draft.was.act === draft.act && sameKeys(draft.was.keys, draft.keys);
    // Untouched, the saved steps stay exactly as they were, whoever wrote them.
    const actions = kept ? saved.actions || saved.action : writeActions(draft);
    let config;
    if (saved) {
      const { trigger: _old, action: _older, ...rest } = saved;
      const alias = saved.alias || "";
      const cut = draft.relearn ? this._pressTail(alias, draft.was.press) : -1;
      config = {
        ...rest,
        alias: cut < 0 ? saved.alias : alias.slice(0, cut) + " \u00b7 " + press,
        triggers: [draft.trigger],
        actions,
      };
    } else {
      config = {
        alias: entry.title + " · " + press,
        description: this._t("auto_made_here"),
        triggers: [draft.trigger],
        conditions: [],
        actions,
        mode: "single",
      };
    }
    try {
      await this._hass.callApi("POST", "config/automation/config/" + (saved ? saved.id : Date.now()), config);
      this._newAuto = null;
      this._flash = this._t(saved ? "shortcut_updated" : "shortcut_saved");
      this._refreshAutomations();
    } catch (err) {
      draft.error = this._t("shortcut_failed", { err: this._errText(err) });
      this._render();
    }
  }

  async _removeAuto(auto) {
    this._confirmAuto = null;
    if (!auto.config.id) return;
    try {
      await this._hass.callApi("DELETE", "config/automation/config/" + auto.config.id);
      this._refreshAutomations();
    } catch (err) {
      this._flash = this._t("shortcut_failed", { err: this._errText(err) });
      this._render();
    }
  }

  // Home Assistant takes a moment to turn a saved config into an entity.
  _refreshAutomations() {
    this._render();
    for (const wait of [200, 1500, 4000])
      setTimeout(() => {
        this._autosKey = null;
        this._loadAutomations();
      }, wait);
  }

  _shortcutForm(entry) {
    const draft = this._newAuto;
    const box = document.createElement("div");
    box.style.marginTop = "12px";

    const cancel = document.createElement("button");
    cancel.className = "act ghost";
    cancel.textContent = this._t("no");
    cancel.addEventListener("click", () => this._cancelShortcut());

    if (!draft.trigger) {
      const text = document.createElement("div");
      text.className = "muted";
      text.style.marginBottom = "10px";
      text.textContent = draft.error || this._t("press_now");
      box.append(text);
      if (draft.error) {
        const again = document.createElement("button");
        again.className = "act";
        again.style.marginRight = "8px";
        again.textContent = this._t("press_again");
        again.addEventListener("click", () => this._listenPress(entry));
        box.appendChild(again);
      }
      box.appendChild(cancel);
      return box;
    }

    const heard = document.createElement("div");
    heard.className = "row";
    const got = document.createElement("div");
    got.className = "muted grow";
    got.textContent = this._t(draft.edit && !draft.relearn ? "press_is" : "press_got", {
      press: this._triggerName(entry, draft.trigger),
    });
    const relisten = document.createElement("button");
    relisten.className = "act ghost";
    relisten.textContent = this._t("press_again");
    relisten.addEventListener("click", () => this._relisten(entry));
    heard.append(got, relisten);
    box.appendChild(heard);

    const targets = this._shortcutTargets();
    if (!draft.target && targets.length) draft.target = targets[0].id;
    const picked = targets.find((target) => target.id === draft.target);

    const pickers = document.createElement("div");
    pickers.className = "row";
    pickers.style.marginTop = "10px";
    const where = document.createElement("select");
    where.className = "grow";
    for (const target of targets) {
      const option = document.createElement("option");
      option.value = target.id;
      option.textContent = target.title;
      option.selected = target.id === draft.target;
      where.appendChild(option);
    }
    where.addEventListener("change", () => {
      draft.target = where.value;
      draft.keys = [];
      this._render();
    });
    const what = document.createElement("select");
    for (const [value, key] of [["toggle", "act_toggle"], ["turn_on", "act_on"], ["turn_off", "act_off"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = this._t(key);
      option.selected = value === draft.act;
      what.appendChild(option);
    }
    what.addEventListener("change", () => {
      draft.act = what.value;
    });
    pickers.append(where, what);
    box.appendChild(pickers);

    const gangs = picked ? picked.gangs : [];
    // A device with one key leaves nothing to choose.
    if (gangs.length === 1) draft.keys = [gangs[0].entity_id];
    const keys = document.createElement("div");
    keys.style.marginTop = "6px";
    for (const gang of gangs.length > 1 ? gangs : []) {
      const name = this._shortName(gang.entity_id, picked.title);
      keys.appendChild(
        this._check(name, draft.keys.includes(gang.entity_id), (on) => {
          draft.keys = on
            ? [...draft.keys, gang.entity_id]
            : draft.keys.filter((id) => id !== gang.entity_id);
          make.disabled = !draft.keys.length;
        })
      );
    }
    if (gangs.length > 1) box.appendChild(keys);

    if (draft.error) {
      const failed = document.createElement("div");
      failed.className = "muted";
      failed.style.marginTop = "10px";
      failed.textContent = draft.error;
      box.appendChild(failed);
    }

    const foot = document.createElement("div");
    foot.className = "row";
    foot.style.marginTop = "12px";
    const make = document.createElement("button");
    make.className = "act";
    make.textContent = this._t(draft.edit ? "save" : "create_shortcut");
    make.disabled = !draft.keys.length;
    make.addEventListener("click", () => this._makeShortcut(entry));
    foot.append(make, cancel);
    box.appendChild(foot);
    return box;
  }

  _ago(iso) {
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const format = new Intl.RelativeTimeFormat(this._hass.language || "en", {
      numeric: "auto",
    });
    const units = [
      ["year", 31536000],
      ["month", 2592000],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
    ];
    for (const [unit, seconds] of units)
      if (Math.abs(diff) >= seconds) return format.format(Math.round(diff / seconds), unit);
    return format.format(Math.round(diff), "second");
  }

  // A device with keys only earns this block when it really sets something
  // off; one without keys gets it anyway, or its page would be empty.
  _automationBlock(entry, always) {
    const autos = this._automationsFor(entry);
    if (!autos.length && !always) return null;
    const box = document.createElement("div");
    box.className = "pad";
    box.style.borderTop = "1px solid var(--divider-color)";
    const title = document.createElement("div");
    title.className = "muted";
    title.style.marginBottom = "4px";
    title.textContent = this._t("does_what");
    box.appendChild(title);

    if (!autos.length) {
      const text = document.createElement("div");
      text.className = "muted";
      text.style.margin = "6px 0 10px";
      text.textContent = this._t("does_nothing");
      box.appendChild(text);
    }

    const drafting = this._newAuto && this._newAuto.entry_id === entry.entry_id ? this._newAuto : null;
    for (const auto of autos) {
      const state = this._hass.states[auto.entity_id];
      const on = state && state.state === "on";
      const when = state && state.attributes.last_triggered;
      const row = document.createElement("div");
      row.className = "autorow";
      const label = document.createElement("div");
      const name = document.createElement("div");
      name.className = "name";
      const facts = document.createElement("div");
      facts.className = "eid";
      label.append(name, facts);
      const acts = document.createElement("div");
      acts.className = "acts";
      row.append(label, acts);

      if (drafting && drafting.edit && drafting.edit.entity_id === auto.entity_id) {
        name.textContent = this._aliasText(entry, auto);
        row.replaceChildren(name, this._shortcutForm(entry));
        box.appendChild(row);
        continue;
      }

      if (this._confirmAuto === auto.entity_id) {
        name.className = "muted";
        name.textContent = this._t("confirm_delete_auto", {
          name: this._aliasText(entry, auto),
        });
        const yes = document.createElement("button");
        yes.className = "act warn";
        yes.textContent = this._t("yes");
        yes.addEventListener("click", () => this._removeAuto(auto));
        const no = document.createElement("button");
        no.className = "act ghost";
        no.textContent = this._t("no");
        no.addEventListener("click", () => {
          this._confirmAuto = null;
          this._render();
        });
        acts.append(yes, no);
        box.appendChild(row);
        continue;
      }

      name.textContent = this._aliasText(entry, auto);
      facts.textContent = [
        this._pressOf(entry, auto),
        when ? this._t("last_run", { when: this._ago(when) }) : this._t("never_run"),
      ]
        .filter(Boolean)
        .join(" \u00b7 ");

      const run = document.createElement("button");
      run.className = "act ghost";
      run.textContent = this._t("activate");
      run.disabled = !on;
      run.addEventListener("click", () =>
        this._hass.callService("automation", "trigger", { entity_id: auto.entity_id })
      );
      const toggle = document.createElement("button");
      toggle.className = "toggle";
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-checked", on ? "true" : "false");
      toggle.title = this._t(on ? "auto_disable" : "auto_enable");
      toggle.innerHTML = '<span class="knob"></span>';
      toggle.addEventListener("click", () =>
        this._hass.callService("automation", "toggle", { entity_id: auto.entity_id })
      );
      acts.append(run, toggle);
      if (auto.config.id) {
        const edit = document.createElement("button");
        edit.className = "act ghost";
        edit.textContent = this._t("edit");
        edit.addEventListener("click", () => this._editShortcut(entry, auto));
        acts.appendChild(edit);
        const del = document.createElement("button");
        del.className = "act ghost";
        del.textContent = this._t("delete");
        del.addEventListener("click", () => {
          this._confirmAuto = auto.entity_id;
          this._render();
        });
        acts.appendChild(del);
      }
      box.appendChild(row);
    }

    // Only a Zigbee device announces its presses, so only it can be learnt.
    if (entry.zha && drafting) {
      if (!drafting.edit) box.appendChild(this._shortcutForm(entry));
    } else if (entry.zha) {
      const make = document.createElement("button");
      make.className = "act";
      make.style.marginTop = "10px";
      make.textContent = this._t("new_shortcut");
      make.addEventListener("click", () => this._startShortcut(entry));
      box.appendChild(make);
    } else if (!autos.length) {
      const open = document.createElement("button");
      open.className = "act ghost";
      open.textContent = this._t("make_automation");
      open.addEventListener("click", () => this._navigate("/config/automation/edit/new"));
      box.appendChild(open);
    }
    return box;
  }

  async _cloudStatus() {
    try {
      this._cloud = await this._hass.callWS({ type: CLOUD_STATUS });
    } catch (err) {
      this._cloud = { authenticated: false };
    }
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
    this._kinds = await loadOutletKinds(this._hass);
    this._render();
  }

  disconnectedCallback() {
    window.removeEventListener("location-changed", this._onLocation);
    if (this._unwatch) {
      this._unwatch();
      this._unwatch = null;
    }
    if (this._unentries) {
      this._unentries();
      this._unentries = null;
    }
    clearTimeout(this._entriesTimer);
    clearTimeout(this._loginTimer);
    clearTimeout(this._pairTimer);
    this._stopPress();
  }

  // ---------- data helpers ----------

  _remoteOf(entry) {
    const found = (this._byEntry[entry.entry_id] || []).find((e) =>
      e.entity_id.startsWith("remote.")
    );
    return found ? found.entity_id : null;
  }

  _entry() {
    if (this._open && this._open.startsWith("zha:"))
      return (this._zigbee || []).find((d) => d.entry_id === this._open);
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
      this._flash = this._t("nothing_captured", { err: this._errText(err) });
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
      this._flash = this._t("send_failed", { err: this._errText(err) });
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

  // Adds a card once: `same` tells whether a card already on the dashboard is this one.
  async _cardToDashboard(card, same) {
    let config = null;
    try {
      config = await this._hass.callWS({ type: "lovelace/config", url_path: null });
    } catch (err) {
      config = null;
    }
    if (!config || !Array.isArray(config.views) || !config.views.length) {
      this._flash = this._t("dashboard_auto");
    } else if ([...cardsIn(config.views)].some((other) => other.type === card.type && same(other))) {
      this._flash = this._t("already_on_dashboard", { name: card.title });
    } else {
      const view = config.views[0];
      if (view.sections) view.sections.push({ type: "grid", cards: [card] });
      else (view.cards ||= []).push(card);
      await this._hass.callWS({ type: "lovelace/config/save", url_path: null, config });
      this._flash = this._t("sent_to_dashboard", { name: card.title });
    }
    this._render();
  }

  async _deviceToDashboard() {
    const entry = this._entry();
    const type = "custom:tuya-selfhost-device-card";
    if (!entry.zha) {
      await this._cardToDashboard(
        { type, entry_id: entry.entry_id, title: entry.title },
        (other) => other.entry_id === entry.entry_id
      );
      return;
    }
    const entities = (this._byEntry[entry.entry_id] || [])
      .map((e) => e.entity_id)
      .filter((id) => id.startsWith("switch.") || id.startsWith("light."));
    await this._cardToDashboard(
      { type, entities, title: entry.title },
      (other) => Array.isArray(other.entities) && entities.every((id) => other.entities.includes(id))
    );
  }

  async _toDashboard() {
    const control = this._control();
    const entity = this._remoteOf(this._entry());
    await this._cardToDashboard(
      { type: "custom:tuya-selfhost-remote-card", entity, control: control.id, title: control.name },
      (other) => other.entity === entity && other.control === control.id
    );
  }

  // ---------- Tuya account ----------

  async _cloudQr(userCode, remember = true) {
    this._login = { busy: true, user_code: userCode };
    this._render();
    try {
      const result = await this._hass.callWS({
        type: CLOUD_QR,
        user_code: userCode,
        remember,
      });
      this._login = result.error
        ? { failed: result.error, user_code: userCode }
        : { rows: result.rows, tries: 0, user_code: userCode };
      if (this._login.rows) this._pollLogin();
    } catch (err) {
      this._login = { failed: this._errText(err), user_code: userCode };
    }
    this._render();
  }

  _pollLogin() {
    clearTimeout(this._loginTimer);
    this._loginTimer = setTimeout(async () => {
      if (!this._login || !this._login.rows) return;
      let result = {};
      try {
        result = await this._hass.callWS({ type: CLOUD_LOGIN });
      } catch (err) {
        result = {};
      }
      if (result.ok) {
        this._login = null;
        this._account = null;
        await this._cloudStatus();
        this._flash = this._t("cloud_done");
        this._render();
        return;
      }
      this._login.tries += 1;
      // Tuya's code lasts a few minutes; after that only a new one gets you in.
      if (this._login.tries > 40) {
        this._login = { expired: true, user_code: this._login.user_code };
        this._render();
        return;
      }
      this._pollLogin();
    }, 4000);
  }

  async _cloudLogout() {
    clearTimeout(this._loginTimer);
    try {
      await this._hass.callWS({ type: CLOUD_LOGOUT });
    } catch (err) {
      /* the account is gone either way as far as this panel is concerned */
    }
    this._login = null;
    this._account = null;
    await this._cloudStatus();
    this._render();
  }

  async _loadAccount(fresh = false) {
    this._account = { loading: true };
    if (fresh) this._render();
    try {
      const answer = await this._hass.callWS({ type: CLOUD_DEVICES, fresh });
      this._account = { devices: answer.devices || [] };
    } catch (err) {
      // Home Assistant restarting: the list comes once it is back.
      if (this._lost(err)) {
        this._whenBack(() => this._loadAccount());
        return;
      }
      this._account = { devices: [], error: this._errText(err) };
    }
    this._render();
  }

  // The whole set-up runs on the server with the form's own defaults; the key stays there.
  async _addAccount(device) {
    this._account = { ...this._account, adding: device.key };
    this._render();
    let answer;
    try {
      answer = await this._hass.callWS({ type: CLOUD_ADD, key: device.key });
    } catch (err) {
      // The set-up may still finish on the server, so the screen is read again once it is back.
      if (this._lost(err)) {
        this._whenBack(async () => {
          this._account = null;
          await this._boot();
        });
        return;
      }
      answer = { ok: false, reason: this._errText(err) };
    }
    if (answer.ok) {
      this._flash = this._t("account_added", { name: answer.title || device.name });
      this._account = null;
      await this._boot();
      return;
    }
    const known = {
      connection: "account_fail_connection",
      already_configured: "account_fail_exists",
      already_in_progress: "account_fail_busy",
      not_supported: "account_fail_unsupported",
    }[answer.reason];
    this._flash = this._t("account_failed", {
      name: device.name,
      err: known ? this._t(known) : answer.reason,
    });
    this._account = { ...this._account, adding: null };
    this._render();
  }

  _accountBlock() {
    const block = document.createElement("div");
    block.className = "block";
    const head = document.createElement("div");
    head.className = "blockhead";
    head.innerHTML = `<h3></h3>`;
    head.querySelector("h3").textContent = this._t("account_devices");
    const again = document.createElement("button");
    again.className = "act ghost";
    again.textContent = this._t("account_refresh");
    again.disabled = !!(this._account && (this._account.loading || this._account.adding));
    again.addEventListener("click", () => this._loadAccount(true));
    head.appendChild(again);
    block.appendChild(head);

    if (!this._account) this._loadAccount();
    const account = this._account;
    const note = (text) => {
      const line = document.createElement("div");
      line.className = "muted";
      line.style.marginTop = "10px";
      line.textContent = text;
      block.appendChild(line);
    };
    if (account.loading) {
      const wait = document.createElement("div");
      wait.className = "waiting";
      const logo = document.createElement("img");
      logo.src = "/static/images/home-assistant-logo-loading.svg";
      logo.alt = "";
      logo.addEventListener("error", () => logo.remove());
      const text = document.createElement("span");
      text.textContent = this._t("account_loading");
      wait.append(logo, text);
      block.appendChild(wait);
      return block;
    }
    if (account.error) note(this._t("account_list_failed", { err: account.error }));
    else if (!account.devices.length) note(this._t("account_none"));
    const list = document.createElement("div");
    list.style.marginTop = "6px";
    for (const device of account.devices) {
      const row = document.createElement("div");
      row.className = "acct";
      const text = document.createElement("div");
      text.className = "grow";
      text.innerHTML = `<div class="nm"></div><div class="muted nm"></div>`;
      text.firstChild.textContent = device.name;
      text.lastChild.textContent = [
        device.product,
        device.online ? "" : this._t("account_offline"),
      ].filter(Boolean).join(" · ");
      row.appendChild(text);
      if (device.blocked) {
        const why = document.createElement("span");
        why.className = "muted";
        why.textContent = this._t(`account_${device.blocked}`);
        row.appendChild(why);
      } else {
        const add = document.createElement("button");
        add.className = "act";
        add.textContent = account.adding === device.key
          ? this._t("account_adding")
          : this._t("account_add");
        add.disabled = !!account.adding;
        add.addEventListener("click", () => this._addAccount(device));
        row.appendChild(add);
      }
      list.appendChild(row);
    }
    block.appendChild(list);
    return block;
  }

  _qrSquare(rows) {
    const size = rows.length;
    let path = "";
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if (rows[y][x] === "1") path += `M${x} ${y}h1v1h-1z`;
    const wrap = document.createElement("div");
    wrap.className = "qr";
    // Always dark on white: a scanner needs the contrast, whatever the theme.
    wrap.innerHTML = `<svg viewBox="-2 -2 ${size + 4} ${size + 4}" width="212" height="212"
      shape-rendering="crispEdges" role="img"><rect x="-2" y="-2" width="${size + 4}"
      height="${size + 4}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
    return wrap;
  }

  _loginBox(explain) {
    const box = document.createElement("div");
    const login = this._login || {};

    if (this._cloud && this._cloud.authenticated && !login.rows) {
      box.innerHTML = `<div class="muted">${this._t("cloud_connected")}</div>`;
      const out = document.createElement("button");
      out.className = "act ghost";
      out.style.marginTop = "10px";
      out.textContent = this._t("cloud_logout");
      out.addEventListener("click", () => this._cloudLogout());
      box.appendChild(out);
      return box;
    }

    if (login.busy) {
      box.innerHTML = `<div class="muted">${this._t("cloud_asking")}</div>`;
      return box;
    }

    if (login.rows) {
      box.appendChild(this._qrSquare(login.rows));
      box.insertAdjacentHTML(
        "beforeend",
        `<div class="muted">${this._t("cloud_scan")}</div>
         <div class="muted" style="margin-top:6px">${this._t("cloud_waiting")}</div>`
      );
      const cancel = document.createElement("button");
      cancel.className = "act ghost";
      cancel.style.marginTop = "10px";
      cancel.textContent = this._t("cloud_cancel");
      cancel.addEventListener("click", () => {
        clearTimeout(this._loginTimer);
        this._login = null;
        this._render();
      });
      box.appendChild(cancel);
      return box;
    }

    box.innerHTML = explain ? `<div class="muted">${this._t("cloud_why")}</div>` : "";
    if (login.expired || login.failed) {
      const problem = document.createElement("div");
      problem.className = "muted";
      problem.style.marginTop = "8px";
      problem.textContent = login.expired
        ? this._t("cloud_expired")
        : this._t("cloud_failed", { err: login.failed });
      box.appendChild(problem);
    }
    const field = document.createElement("div");
    field.className = "row";
    field.style.marginTop = "12px";
    const input = document.createElement("input");
    input.className = "grow";
    input.placeholder = this._t("cloud_user_code");
    input.value = login.user_code || (this._cloud && this._cloud.user_code) || "";
    const go = document.createElement("button");
    go.className = "act";
    go.textContent = this._t("cloud_enter");
    const start = () => {
      const code = input.value.trim();
      if (code) this._cloudQr(code, keep.checked);
    };
    go.addEventListener("click", start);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") start();
    });
    field.append(input, go);
    box.appendChild(field);
    const remember = document.createElement("label");
    remember.className = "muted";
    remember.style.cssText =
      "display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer";
    const keep = document.createElement("input");
    keep.type = "checkbox";
    keep.checked = true;
    keep.style.accentColor = "var(--primary-color)";
    remember.append(keep, this._t("cloud_remember"));
    box.appendChild(remember);
    box.insertAdjacentHTML(
      "beforeend",
      `<div class="muted" style="margin-top:8px">${this._t("cloud_where")}</div>`
    );
    // The user code lives in the app, and only a phone can have it installed.
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      // A page cannot ask which app is installed, so both are offered.
      const apps = document.createElement("div");
      apps.style.cssText = "display:flex;gap:20px;margin-top:10px";
      for (const [scheme, label] of [
        ["smartlife://", "cloud_open_smartlife"],
        ["tuyasmart://", "cloud_open_tuya"],
      ]) {
        const open = document.createElement("a");
        open.className = "link";
        open.href = scheme;
        // The Home Assistant app only hands a link to iOS when it asks for a new window.
        open.target = "_blank";
        open.rel = "noreferrer";
        open.style.padding = "6px 0";
        open.textContent = this._t(label);
        apps.appendChild(open);
      }
      box.appendChild(apps);
    }
    return box;
  }

  // ---------- Zigbee ----------

  async _permit() {
    try {
      await this._hass.callService("zha", "permit", { duration: 120 });
    } catch (err) {
      this._flash = this._t("zigbee_failed", { err: this._errText(err) });
      this._render();
      return;
    }
    const joins = await this._zigbeeJoins();
    this._pairing = {
      left: 120,
      found: [],
      before: new Set((this._zigbee || []).map((d) => d.entry_id)),
      // Server time, so a phone with a wrong clock still tells new joins apart.
      since: joins ? joins.now : null,
      waiting: [],
    };
    this._render();
    this._pairTick();
  }

  async _zigbeeJoins() {
    try {
      return await this._hass.callWS({ type: "tuya_selfhost/zigbee/joins" });
    } catch (err) {
      return null;
    }
  }

  // Joined during this window but not listed yet: their interview is still going.
  _waitingJoins(joins) {
    if (!joins || this._pairing.since == null) return [];
    const listed = new Set((this._zigbee || []).map((d) => d.zha.ieee));
    return joins.joins.filter(
      (join) => join.at >= this._pairing.since && join.stage !== "done" && !listed.has(join.ieee)
    );
  }

  _pairTick() {
    clearTimeout(this._pairTimer);
    this._pairTimer = setTimeout(async () => {
      if (!this._pairing) return;
      this._pairing.left -= 5;
      await this._loadZigbee();
      if (!this._pairing) return;
      this._pairing.waiting = this._waitingJoins(await this._zigbeeJoins());
      for (const device of this._zigbee) {
        if (
          !this._pairing.before.has(device.entry_id) &&
          !this._pairing.found.includes(device.title)
        )
          this._pairing.found.push(device.title);
      }
      if (this._pairing.left > 0) {
        this._render();
        this._pairTick();
        return;
      }
      const found = this._pairing.found;
      const waiting = this._pairing.waiting.length;
      this._pairing = null;
      this._flash = found.length
        ? this._t("zigbee_joined", { names: found.join(", ") })
        : this._t(waiting ? "zigbee_unfinished" : "zigbee_none");
      this._render();
    }, 5000);
  }

  async _stopPermit() {
    clearTimeout(this._pairTimer);
    const found = (this._pairing && this._pairing.found) || [];
    this._pairing = null;
    try {
      await this._hass.callService("zha", "permit", { duration: 0 });
    } catch (err) {
      /* the window closes on its own anyway */
    }
    if (found.length) this._flash = this._t("zigbee_joined", { names: found.join(", ") });
    this._render();
  }

  async _zigbeeRemove(device) {
    try {
      await this._hass.callService("zha", "remove", { ieee: device.zha.ieee });
      this._flash = this._t("zigbee_removed", { name: device.title });
    } catch (err) {
      this._flash = this._t("zigbee_failed", { err: this._errText(err) });
    }
    this._confirmZigbee = null;
    await this._loadZigbee();
    this._render();
  }

  _batteryOf(device) {
    for (const item of this._byEntry[device.entry_id] || []) {
      const state = this._hass.states[item.entity_id];
      if (state && state.attributes.device_class === "battery") {
        const value = Number(state.state);
        if (!isNaN(value)) return Math.round(value);
      }
    }
    return null;
  }

  _zigbeeGone(device) {
    const box = document.createElement("div");
    box.className = "pad";
    box.style.paddingTop = "0";
    const pill = document.createElement("span");
    pill.className = "pill bad";
    pill.textContent = this._t("zigbee_gone");
    const stamp = device.zha.last_seen;
    // ZHA sends UTC without a zone; read bare, the browser would take it as local.
    const seen = stamp ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(stamp) ? stamp : stamp + "Z") : null;
    const lines = document.createElement("div");
    lines.className = "muted";
    lines.style.marginTop = "8px";
    lines.textContent = [
      seen && !isNaN(seen)
        ? this._t("zigbee_gone_since", {
            when: seen.toLocaleString(this._hass.language, { dateStyle: "short", timeStyle: "short" }),
          })
        : "",
      this._t("zigbee_gone_help"),
    ]
      .filter(Boolean)
      .join(" ");
    box.append(pill, lines);
    return box;
  }

  _zigbeeFacts(device) {
    const info = device.zha;
    const facts = [];
    if (info.model) facts.push(info.model);
    if (info.lqi !== null && info.lqi !== undefined)
      facts.push(this._t("zigbee_signal", { n: Math.round((Number(info.lqi) / 255) * 100) }));
    const battery = this._batteryOf(device);
    if (battery !== null) facts.push(this._t("zigbee_battery", { n: battery }));
    return facts.join(" · ");
  }

  // ---------- rendering ----------

  _render() {
    const root = document.createElement("div");
    const bar = document.createElement("div");
    bar.className = "bar";
    const menu = document.createElement("button");
    menu.className = "menu";
    menu.title = this._t("devices");
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
    gear.title = this._t("settings");
    gear.innerHTML = `<ha-icon icon="mdi:cog-outline"></ha-icon>`;
    gear.addEventListener("click", () => {
      this._config = this._config ? null : "add";
      this._open = null;
      this._remote = null;
      this._scene = null;
      this._auto = null;
      this._scenes = false;
      this._renaming = null;
      this._render();
    });
    const scenes = document.createElement("button");
    scenes.className = "barpill";
    scenes.setAttribute("aria-pressed", String(this._scenes));
    scenes.innerHTML = `<ha-icon icon="mdi:play-circle-outline"></ha-icon><span></span>`;
    scenes.querySelector("span").textContent = this._t("scenes");
    scenes.addEventListener("click", () => {
      this._scenes = !this._scenes;
      this._scene = null;
      this._auto = null;
      this._config = null;
      this._open = null;
      this._remote = null;
      this._renaming = null;
      this._render();
    });
    bar.append(menu, title, scenes, gear);
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

    if (this._auto) {
      wrap.appendChild(this._renderAuto());
    } else if (this._scene) {
      wrap.appendChild(this._renderScene());
    } else if (this._scenes) {
      this._scenes_shown = this._scenesShown();
      wrap.append(this._renderScenes(), this._renderAutomations());
    } else if (!(this._entries || []).length && !(this._zigbee || []).length) {
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
    this.dispatchEvent(new CustomEvent("hass-notification", {
      // Same id: the next copy rewrites the open toast instead of stacking another.
      detail: { message: label, id: "tuya-selfhost-copy" }, bubbles: true, composed: true,
    }));
  }

  async _loadReport() {
    this._report = "loading";
    this._render();
    try {
      const result = await this._hass.callService(
        "tuya_selfhost",
        "network_report",
        {},
        undefined,
        false,
        true
      );
      const answer = (result && result.response) || {};
      this._report = answer.devices || [];
      this._radios = answer.bluetooth || { available: false, radios: [] };
    } catch (err) {
      this._report = [];
      this._radios = { available: false, radios: [] };
    }
    this._render();
  }

  // Whether it answers us here. Whether it still reaches the internet is a
  // question only Tuya can answer, and it is not worth an account to ask.
  _netStatus(device) {
    return device.local ? ["net_here", "good"] : ["net_silent", "bad"];
  }

  // Only the exceptions earn a line of their own; for the rest the pill says it,
  // and eleven copies of the same sentence are harder to read than none.
  _netAdvice(device) {
    if (!device.local) return "net_silent_help";
    if (device.role === "gateway") return "net_keep_online";
    if (device.role === "sub-device") return "net_via_gateway";
    return null;
  }

  async _alexaLoad() {
    this._alexa = "loading";
    const [config, status] = await Promise.all([
      this._hass
        .callService("tuya_selfhost", "alexa_config", {}, undefined, false, true)
        .then((result) => (result && result.response) || null)
        .catch(() => null),
      this._hass.callWS({ type: "tuya_selfhost/alexa/status" }).catch(() => null),
    ]);
    this._alexa = { ...(config || {}), status };
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

    if (this._config === "network") card.appendChild(this._tabNetworks());
    else if (this._config === "alexa") card.appendChild(this._tabAlexa());
    else card.appendChild(this._tabAdd());
    return card;
  }

  _tabAdd() {
    const box = document.createElement("div");
    if (this._cloud && this._cloud.authenticated) box.appendChild(this._accountBlock());
    const cloud = document.createElement("div");
    cloud.className = "block";
    cloud.innerHTML = `<h3>${this._t("add_cloud")}</h3>`;
    const signIn = this._loginBox(false);
    signIn.style.marginTop = "12px";
    cloud.appendChild(signIn);
    box.appendChild(cloud);

    const manual = document.createElement("div");
    manual.className = "block";
    manual.innerHTML = `<h3>${this._t("add_local")}</h3>`;
    const go = document.createElement("button");
    go.className = "act";
    go.style.marginTop = "12px";
    go.textContent = this._t("open_flow");
    go.addEventListener("click", () =>
      this._navigate("/config/integrations/dashboard/add?domain=tuya_selfhost")
    );
    manual.appendChild(go);
    box.appendChild(manual);

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

  // Every way a device reaches this house, one sub-tab each.
  _tabNetworks() {
    const box = document.createElement("div");
    const kind = this._net || "wifi";
    const pick = document.createElement("div");
    pick.className = "subtabs";
    pick.setAttribute("role", "tablist");
    for (const [id, icon, key] of [
      ["wifi", "mdi:wifi", "net_wifi"],
      ["ble", "mdi:bluetooth", "net_bluetooth"],
      ["zigbee", "mdi:zigbee", "tab_zigbee"],
    ]) {
      const tab = document.createElement("button");
      tab.className = "subtab";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(kind === id));
      tab.innerHTML = `<ha-icon icon="${icon}"></ha-icon><span></span>`;
      tab.querySelector("span").textContent = this._t(key);
      tab.addEventListener("click", () => {
        this._net = id;
        this._render();
      });
      pick.appendChild(tab);
    }
    box.appendChild(pick);
    box.appendChild(
      kind === "zigbee" ? this._tabZigbee() : kind === "ble" ? this._tabBluetooth() : this._tabNetwork()
    );
    return box;
  }

  _signal(rssi) {
    if (rssi >= -70) return ["ble_strong", "good"];
    if (rssi >= -85) return ["ble_fair", "warn"];
    return ["ble_weak", "bad"];
  }

  _tabBluetooth() {
    const box = document.createElement("div");
    const head = document.createElement("div");
    head.className = "block";
    head.innerHTML = `<h3></h3><div class="muted"></div>`;
    head.querySelector("h3").textContent = this._t("ble_title");
    head.querySelector(".muted").textContent = this._t("ble_intro");
    box.appendChild(head);

    if (this._report === undefined) {
      setTimeout(() => this._loadReport(), 0);
      this._report = "loading";
    }
    const body = document.createElement("div");
    body.className = "block";
    box.appendChild(body);
    if (this._report === "loading") {
      body.innerHTML = `<div class="muted">${this._t("loading")}</div>`;
      return box;
    }
    const report = this._radios || { available: false, radios: [] };
    if (!report.radios.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = this._t(report.available ? "ble_none" : "ble_off");
      body.appendChild(empty);
    }
    for (const radio of report.radios) {
      const row = document.createElement("div");
      row.className = "net";
      row.innerHTML = `<div class="grow"><div class="name"></div>
        <div class="muted mono"></div><div class="muted advice"></div></div>`;
      row.querySelector(".name").textContent = radio.name || this._t("ble_unknown");
      row.querySelector(".mono").textContent = (radio.address || "—") +
        (radio.in_range ? " · " + radio.rssi + " dBm" : "") +
        (!radio.name && radio.advertised ? " · " + radio.advertised : "");
      const advice = row.querySelector(".advice");
      if (radio.reserve) advice.textContent = this._t(radio.ready ? "ble_reserve" : "ble_reserve_waiting");
      else if (!radio.name) advice.textContent = this._t("ble_unknown_help");
      else if (!radio.in_range) advice.textContent = this._t("ble_unheard_help");
      else advice.remove();
      const [label, tone] = radio.in_range
        ? this._signal(radio.rssi)
        : [radio.reserve ? "ble_away" : "ble_unheard", ""];
      const pill = document.createElement("span");
      pill.className = "pill " + tone;
      pill.textContent = this._t(label);
      row.appendChild(pill);
      body.appendChild(row);
    }

    const foot = document.createElement("div");
    foot.className = "block";
    const again = document.createElement("button");
    again.className = "act ghost";
    again.textContent = this._t("refresh");
    again.addEventListener("click", () => this._loadReport());
    foot.appendChild(again);
    box.appendChild(foot);
    return box;
  }

  _copyable(value) {
    return value
      ? `<button class="copyable" data-copy="${value}" aria-label="${
        this._t("copy_value", { value })}">${value}</button>`
      : "";
  }

  _tabNetwork() {
    const box = document.createElement("div");
    const head = document.createElement("div");
    head.className = "block";
    head.innerHTML = `<h3>${this._t("network_title")}</h3>
      <div class="muted">${this._t("network_intro")}</div>`;
    box.appendChild(head);

    if (this._report === undefined) {
      setTimeout(() => this._loadReport(), 0);
      this._report = "loading";
    }
    const body = document.createElement("div");
    body.className = "block";
    if (this._report === "loading") {
      body.innerHTML = `<div class="muted">${this._t("loading")}</div>`;
      box.appendChild(body);
      return box;
    }

    for (const device of this._report) {
      const [label, tone] = this._netStatus(device);
      const advice = this._netAdvice(device);
      const row = document.createElement("div");
      row.className = "net";
      row.innerHTML = `
        <div class="grow">
          <div>${device.name}</div>
          <div class="muted mono">${this._copyable(device.host) || "—"} · ${
            this._copyable(device.mac) || this._t("no_mac")
          }</div>
          ${
            advice
              ? `<div class="muted advice">${this._t(advice)}</div>`
              : ""
          }
        </div>
        <span class="pill ${tone}">${this._t(label)}</span>`;
      row.querySelectorAll("button.copyable").forEach((button) =>
        button.addEventListener("click", () => this._copy(button.dataset.copy,
          this._t("copied_value", { value: button.dataset.copy }))));
      body.appendChild(row);
    }
    box.appendChild(body);

    const foot = document.createElement("div");
    foot.className = "block";
    foot.innerHTML = `<div class="muted">${this._t("mac_hint")}</div>`;

    const again = document.createElement("button");
    again.className = "act ghost";
    again.style.marginTop = "10px";
    again.textContent = this._t("refresh");
    again.addEventListener("click", () => this._loadReport());

    foot.append(again);
    box.appendChild(foot);
    return box;
  }

  _tabZigbee() {
    const box = document.createElement("div");
    const head = document.createElement("div");
    head.className = "block";
    head.innerHTML = `<h3>${this._t("zigbee_title")}</h3>
      <div class="muted">${this._t("zigbee_intro")}</div>`;
    box.appendChild(head);

    if (this._zigbeeDown) {
      box.appendChild(this._zigbeeDownBlock());
      return box;
    }
    if (this._noZigbee) {
      box.insertAdjacentHTML(
        "beforeend",
        `<div class="block"><div class="muted">${this._t("zigbee_absent")}</div></div>`
      );
      return box;
    }

    const add = document.createElement("div");
    add.className = "block";
    if (this._pairing) {
      add.innerHTML = `<h3>${this._t("zigbee_open")}</h3>
        <div class="muted">${this._t("zigbee_open_help")}</div>
        <div class="muted" style="margin-top:6px">${this._t("zigbee_left", {
          n: this._pairing.left,
        })}</div>`;
      if (this._pairing.found.length)
        add.insertAdjacentHTML(
          "beforeend",
          `<div class="muted" style="margin-top:6px">${this._t("zigbee_joined", {
            names: this._pairing.found.join(", "),
          })}</div>`
        );
      for (const join of this._pairing.waiting) {
        const line = document.createElement("div");
        line.className = "net";
        line.innerHTML = `<div class="grow"><div></div><div class="muted"></div></div>
          <span class="pill warn"></span>`;
        line.querySelector(".grow > div").textContent = join.model
          ? this._t("zigbee_joining_model", { model: join.model })
          : this._t("zigbee_joining");
        line.querySelector(".muted").textContent = this._t("zigbee_keep_awake");
        line.querySelector(".pill").textContent = this._t("zigbee_interview");
        add.appendChild(line);
      }
      const stop = document.createElement("button");
      stop.className = "act ghost";
      stop.style.marginTop = "10px";
      stop.textContent = this._t("zigbee_stop");
      stop.addEventListener("click", () => this._stopPermit());
      add.appendChild(stop);
    } else {
      add.innerHTML = `<h3>${this._t("zigbee_add")}</h3>
        <div class="muted">${this._t("zigbee_add_help")}</div>`;
      const go = document.createElement("button");
      go.className = "act";
      go.style.marginTop = "12px";
      go.textContent = this._t("zigbee_open_btn");
      go.addEventListener("click", () => this._permit());
      add.appendChild(go);
    }
    box.appendChild(add);

    const list = document.createElement("div");
    list.className = "block";
    list.innerHTML = `<h3>${this._t("zigbee_devices")}</h3>`;
    if (!(this._zigbee || []).length)
      list.insertAdjacentHTML(
        "beforeend",
        `<div class="muted">${this._t("zigbee_empty")}</div>`
      );
    for (const device of this._zigbee || []) {
      const row = document.createElement("div");
      row.className = "net";
      if (this._confirmZigbee === device.entry_id) {
        row.innerHTML = `<div class="grow"><div class="muted">${this._t(
          "zigbee_remove_confirm",
          { name: device.title }
        )}</div></div>`;
        const yes = document.createElement("button");
        yes.className = "act warn";
        yes.textContent = this._t("yes");
        yes.addEventListener("click", () => this._zigbeeRemove(device));
        const no = document.createElement("button");
        no.className = "act ghost";
        no.textContent = this._t("no");
        no.addEventListener("click", () => {
          this._confirmZigbee = null;
          this._render();
        });
        row.append(yes, no);
      } else {
        const gone = device.zha.available === false;
        row.innerHTML = `<div class="grow">
            <div>${device.title}</div>
            <div class="muted">${this._zigbeeFacts(device)}</div>
          </div>
          <span class="pill ${gone ? "bad" : "good"}">${this._t(
            gone ? "zigbee_gone" : "zigbee_here"
          )}</span>`;
        const del = document.createElement("button");
        del.className = "act ghost";
        del.textContent = this._t("zigbee_remove");
        del.addEventListener("click", () => {
          this._confirmZigbee = device.entry_id;
          this._render();
        });
        row.appendChild(del);
      }
      list.appendChild(row);
    }
    box.appendChild(list);

    const foot = document.createElement("div");
    foot.className = "block";
    foot.innerHTML = `<div class="muted">${this._t("zigbee_deeper")}</div>`;
    const open = document.createElement("button");
    open.className = "act ghost";
    open.style.marginTop = "10px";
    open.textContent = this._t("zigbee_open_ha");
    open.addEventListener("click", () => this._navigate("/config/zha/dashboard"));
    foot.appendChild(open);
    box.appendChild(foot);
    return box;
  }

  _when(iso) {
    const when = new Date(iso);
    if (isNaN(when)) return iso;
    const lang =
      (this._hass && this._hass.locale && this._hass.locale.language) ||
      navigator.language;
    return when.toLocaleString(lang, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  _tabAlexa() {
    const box = document.createElement("div");
    if (this._alexa === undefined) {
      this._alexa = "loading";
      setTimeout(() => this._alexaLoad(), 0);
    }
    if (this._alexa === "loading" || this._alexa === undefined) {
      const wait = document.createElement("div");
      wait.className = "block";
      wait.innerHTML = `<div class="muted">${this._t("loading")}</div>`;
      box.appendChild(wait);
      return box;
    }
    const status = this._alexa.status;
    if (status) box.appendChild(this._alexaStatus(status));

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

    const setup = document.createElement("details");
    setup.className = "block setup";
    // Open by default only while there is nothing to look at above.
    setup.open = !status || !status.skill;
    const yaml = this._alexa.yaml || "";
    setup.innerHTML = `<summary>${this._t("alexa_setup")}</summary>
      <div class="muted" style="margin-top:10px">${this._t("alexa_intro")}</div>
      <ol class="steps">${["alexa_s1", "alexa_s2", "alexa_s3", "alexa_s4", "alexa_s5"]
        .map((k) => `<li>${this._t(k)}</li>`)
        .join("")}</ol>
      <h3 style="margin-top:16px">${this._t("alexa_yaml")}</h3>
      <div class="muted" style="margin-bottom:10px">${this._t("alexa_yaml_hint")}</div>
      <pre class="mono">${yaml.replace(/</g, "&lt;")}</pre>`;
    const copy = document.createElement("button");
    copy.className = "act";
    copy.style.marginTop = "10px";
    copy.textContent = this._t("copy_yaml");
    copy.addEventListener("click", () => this._copy(yaml, this._t("copied")));
    setup.appendChild(copy);
    const guide = document.createElement("div");
    guide.style.marginTop = "14px";
    guide.innerHTML = `<a class="link" href="${this._t("guide_url")}" target="_blank" rel="noreferrer">${this._t(
      "guide_link"
    )}</a>`;
    setup.appendChild(guide);
    box.appendChild(setup);
    return box;
  }

  _alexaStatus(status) {
    const when = (iso) =>
      new Date(iso).toLocaleString(this._hass.language, { dateStyle: "short", timeStyle: "short" });
    const skill = status.skill;
    const link = status.link;
    const rows = [];
    rows.push({
      title: this._t("alexa_lambda"),
      value: status.base_url,
      text: status.base_url ? this._t("alexa_lambda_hint") : this._t("alexa_lambda_none"),
      pill: status.base_url ? null : ["warn", "alexa_no_url"],
    });
    rows.push({
      title: this._t("alexa_skill"),
      text: skill
        ? this._t("alexa_skill_on", { locale: skill.locale || "—", n: skill.exposed ?? "—" })
        : this._t("alexa_skill_off"),
      pill: skill ? ["good", "alexa_ready"] : ["bad", "alexa_missing"],
    });
    rows.push({
      title: this._t("alexa_link"),
      text: link
        ? this._t("alexa_link_on", {
            when: when(link.linked_at),
            user: link.user,
            region: this._t(`alexa_region_${link.region}`),
            used: when(link.used_at),
          })
        : this._t("alexa_link_off"),
      pill: link ? ["good", "alexa_linked"] : ["bad", "alexa_unlinked"],
    });
    if (skill) {
      const report = skill.reporting
        ? ["good", "alexa_report_on", "alexa_report_on_text"]
        : skill.can_report
          ? ["warn", "alexa_report_wait", "alexa_report_wait_text"]
          : ["bad", "alexa_report_off", "alexa_report_off_text"];
      rows.push({
        title: this._t("alexa_report"),
        text: this._t(report[2], {
          region: skill.events_region ? this._t(`alexa_region_${skill.events_region}`) : "—",
        }),
        pill: [report[0], report[1]],
      });
    }
    const block = document.createElement("div");
    block.className = "block";
    block.innerHTML = `<h3>${this._t("alexa_status")}</h3>`;
    for (const row of rows) {
      const line = document.createElement("div");
      line.className = "net";
      const grow = document.createElement("div");
      grow.className = "grow";
      const title = document.createElement("div");
      title.textContent = row.title;
      grow.appendChild(title);
      if (row.value) {
        const value = document.createElement("button");
        value.className = "copyable mono";
        value.textContent = row.value;
        value.setAttribute("aria-label", this._t("copy_value", { value: row.value }));
        value.addEventListener("click", () => this._copy(row.value, this._t("copied")));
        const holder = document.createElement("div");
        holder.style.margin = "4px 0 2px";
        holder.appendChild(value);
        grow.appendChild(holder);
      }
      const text = document.createElement("div");
      text.className = "muted";
      text.textContent = row.text;
      grow.appendChild(text);
      line.appendChild(grow);
      if (row.pill) {
        const pill = document.createElement("span");
        pill.className = `pill ${row.pill[0]}`;
        pill.textContent = this._t(row.pill[1]);
        line.appendChild(pill);
      }
      block.appendChild(line);
    }
    return block;
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
        ${
          remote
            ? '<ha-icon icon="mdi:remote"></ha-icon>'
            : this._deviceGlyph(entry)
        }
        <div class="grow">
          <div>${entry.title}</div>
          <div class="muted">${this._t("entities", { n: entities.length })}${
            remote
              ? " · " + this._t(controls === 1 ? "control" : "controls", { n: controls })
              : ""
          }</div>
        </div>
        ${remote ? `<span class="pill on">${this._t("emitter")}</span>` : ""}
        ${
          this._needsKinds(entry)
            ? `<span class="pill">${this._t("mark_keys")}</span>`
            : ""
        }`;
      row.style.cursor = "pointer";
      const mark = this._needsKinds(entry);
      row.addEventListener("click", () => {
        this._open = entry.entry_id;
        // A strip just added has keys nobody has told apart yet: start there.
        this._settings = mark;
        this._config = null;
        this._render();
      });
      row.insertAdjacentHTML(
        "beforeend",
        '<ha-icon icon="mdi:chevron-right" style="--mdc-icon-size:22px;opacity:.5"></ha-icon>'
      );
      card.appendChild(row);
    }
    for (const device of this._zigbee || []) {
      const entities = this._byEntry[device.entry_id] || [];
      const gone = device.zha.available === false;
      const row = document.createElement("div");
      row.className = "dev";
      row.innerHTML = `
        <ha-icon icon="mdi:zigbee"></ha-icon>
        <div class="grow">
          <div>${device.title}</div>
          <div class="muted">${this._t("entities", { n: entities.length })}</div>
        </div>
        <span class="pill${gone ? " bad" : ""}">${this._t(gone ? "zigbee_gone" : "zigbee_pill")}</span>`;
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        this._open = device.entry_id;
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
    if (this._zigbeeDown) {
      const row = document.createElement("div");
      row.className = "dev";
      row.innerHTML = `<ha-icon icon="mdi:zigbee"></ha-icon>
        <div class="grow"><div></div><div class="muted"></div></div>
        <span class="pill bad"></span>
        <ha-icon icon="mdi:chevron-right" style="--mdc-icon-size:22px;opacity:.5"></ha-icon>`;
      row.querySelector(".grow div").textContent = this._t("zigbee_down");
      row.querySelector(".grow .muted").textContent = this._t("zigbee_down_short");
      row.querySelector(".pill").textContent = this._t("zigbee_gone");
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        this._config = "network";
        this._net = "zigbee";
        this._render();
      });
      card.appendChild(row);
    }
    return card;
  }

  _renderDevice() {
    this._loadAutomations();
    const entry = this._entry();
    const remote = this._remoteOf(entry);
    const card = document.createElement("ha-card");
    if (this._isAdmin()) card.appendChild(this._deviceTitle(entry));
    else card.header = entry.title;

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

    if (entry.zha) {
      const facts = document.createElement("div");
      facts.className = "pad muted";
      facts.style.paddingTop = "0";
      facts.textContent = this._zigbeeFacts(entry);
      card.appendChild(facts);
      if (entry.zha.available === false) card.appendChild(this._zigbeeGone(entry));
    }

    const entities = this._byEntry[entry.entry_id] || [];
    const gangs = this._gangsOf(entry);
    const taken = new Set(gangs.map((e) => e.entity_id));
    const rest = entities.filter((e) => !taken.has(e.entity_id));

    if (this._settings) {
      const list = document.createElement("div");
      list.className = "pad";
      const title = document.createElement("div");
      title.className = "muted";
      title.style.marginBottom = "4px";
      title.textContent = this._t("settings");
      list.appendChild(title);
      for (const item of this._sorted(rest.length ? rest : entities)) {
        list.appendChild(this._entityRow(item, entry.title));
      }
      card.appendChild(list);
      const kinds = this._kindsBlock(entry, gangs);
      if (kinds) card.appendChild(kinds);
      return card;
    }

    // An emitter's page is a list of its remotes: everything you do to one of
    // them lives inside it, so nothing else belongs out here.
    if (gangs.length && !remote) {
      const grid = document.createElement("div");
      grid.className = "pad tiles";
      grid.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
      const names = this._keyNames(entry, gangs);
      for (const item of gangs) {
        const state = this._hass.states[item.entity_id];
        const on = state && state.state === "on";
        const wrap = document.createElement("div");
        wrap.className = "tilewrap";
        const tile = document.createElement("button");
        tile.className = "tile";
        tile.setAttribute("aria-pressed", on ? "true" : "false");
        tile.disabled = !state || state.state === "unavailable";
        tile.innerHTML = outletGlyph(this._hass, this._kinds, item.entity_id,
          state && state.attributes.device_class);
        tile.addEventListener("click", () =>
          this._hass.callService("homeassistant", "toggle", { entity_id: item.entity_id })
        );
        let name;
        if (this._renaming === item.entity_id) {
          name = this._renameInput(entry, item, names[item.entity_id]);
          setTimeout(() => name.focus(), 0);
        } else if (item.config_entry_id && this._isAdmin()) {
          name = document.createElement("button");
          name.className = "tilename can";
          name.title = this._t("rename_key");
          name.innerHTML = `<span></span><ha-icon icon="mdi:pencil-outline"></ha-icon>`;
          name.querySelector("span").textContent = names[item.entity_id];
          name.addEventListener("click", () => {
            this._renaming = item.entity_id;
            this._render();
          });
        } else {
          name = document.createElement("div");
          name.className = "tilename";
          name.textContent = names[item.entity_id];
        }
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
    if (gangs.length && !remote) {
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
    if (gangs.length && !remote) {
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

    const automations = this._automationBlock(entry, !gangs.length);
    if (automations) card.appendChild(automations);
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

  _shortName(entityId, title) {
    const name = this._friendly(entityId);
    return (title && name.replace(title, "").trim()) || name;
  }

  _value(state) {
    if (!state) return "—";
    if (state.state === "unavailable") return this._t("unavailable");
    if (state.state === "unknown") return this._t("unknown");
    if (state.entity_id.startsWith("binary_sensor."))
      return this._t(state.state === "on" ? "state_yes" : "state_no");
    const unit = state.attributes.unit_of_measurement;
    return unit ? state.state + " " + unit : state.state;
  }

  _entityRow(item, title) {
    const id = item.entity_id;
    const domain = id.split(".")[0];
    const state = this._hass.states[id];
    const row = document.createElement("div");
    row.className = "ent";
    const label = document.createElement("div");
    label.className = "grow";
    label.innerHTML = `<div class="name">${this._shortName(id, title)}</div><div class="eid">${id}</div>`;
    row.appendChild(label);

    const TOGGLEABLE = ["switch", "light", "fan", "humidifier", "siren", "input_boolean"];
    if (TOGGLEABLE.includes(domain)) {
      const on = state && state.state === "on";
      const toggle = document.createElement("button");
      toggle.className = "toggle";
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("aria-checked", on ? "true" : "false");
      toggle.title = this._t(on ? "turn_off" : "turn_on");
      toggle.disabled = !state || state.state === "unavailable";
      toggle.innerHTML = '<span class="knob"></span>';
      toggle.addEventListener("click", () =>
        this._hass.callService("homeassistant", "toggle", { entity_id: id })
      );
      row.appendChild(toggle);
    } else if (domain === "button" || domain === "scene") {
      const press = document.createElement("button");
      press.className = "act ghost";
      press.textContent = this._t("activate");
      press.disabled = !state || state.state === "unavailable";
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
      act.textContent = this._t(locked ? "do_unlock" : "do_lock");
      act.addEventListener("click", () =>
        this._hass.callService("lock", locked ? "unlock" : "lock", { entity_id: id })
      );
      row.appendChild(act);
    } else {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = this._value(state);
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
      this._iconFor = null;
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
    const ac = this._acOf(control);
    this._ac_shown = this._acSignature();
    body.innerHTML = `<div class="brand"><span>${control.name}</span><ha-icon icon="mdi:signal-variant" style="--mdc-icon-size:14px"></ha-icon></div>
      ${ac ? "" : `<div class="screen">${this._screen || "pronto"}</div>`}`;
    if (ac) body.appendChild(this._renderAc(ac));

    const keys = document.createElement("div");
    keys.className = "keys";
    keys.style.gridTemplateColumns = `repeat(${control.columns || 3}, 1fr)`;
    control.buttons.forEach((button, index) => {
      const slot = document.createElement("div");
      slot.className = "keyslot";
      const key = document.createElement("button");
      key.className = button.taught ? "key" : "key untaught";
      key.title = this._t(button.taught ? "tap_send" : "tap_learn");
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
        mk("←", this._t("move"), () => this._moveButton(index, -1)),
        mk("→", this._t("move"), () => this._moveButton(index, 1)),
        mk("◉", this._t("icon_change"), () => {
          this._iconFor = index;
          this._render();
        }),
        mk("⟳", this._t("edit"), () => this._learn(index)),
        mk("✕", this._t("delete"), () => {
          this._confirmButton = index;
          this._render();
        })
      );
      slot.appendChild(tools);
      keys.appendChild(slot);
    });
    // An air conditioner is run from its own controls; the taught keys stay one tap away.
    if (ac && !this._editing) {
      const more = document.createElement("button");
      more.className = "ac-more";
      more.textContent = this._t(this._acKeys ? "ac_keys_hide" : "ac_keys_show", {
        n: control.buttons.length,
      });
      more.addEventListener("click", () => {
        this._acKeys = !this._acKeys;
        this._render();
      });
      body.appendChild(more);
    }
    if (!ac || this._editing || this._acKeys) body.appendChild(keys);
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
    form.className = "pad";
    const line = document.createElement("div");
    line.className = "row";
    const name = document.createElement("input");
    name.className = "grow";
    name.placeholder = this._t("button_name");
    const add = document.createElement("button");
    add.className = "act";
    add.textContent = this._t("add_button");
    this._newIcon = this._newIcon || ICONS[0];
    add.addEventListener("click", () => {
      if (name.value.trim()) this._addButton(name.value.trim(), this._newIcon);
    });
    line.append(name, add);
    form.appendChild(line);

    const editing = control.buttons[this._iconFor];
    const label = document.createElement("div");
    label.className = "muted";
    label.style.marginTop = "12px";
    label.textContent = editing
      ? this._t("icon_for", { name: editing.name })
      : this._t("icon_label");
    form.appendChild(label);

    const picker = document.createElement("div");
    picker.className = "icons";
    const chosen = editing ? editing.icon : this._newIcon;
    for (const i of ICONS) {
      const pick = document.createElement("button");
      pick.className = "iconpick";
      pick.setAttribute("aria-pressed", String(chosen === i));
      pick.title = i.replace("mdi:", "");
      pick.innerHTML = `<ha-icon icon="${i}"></ha-icon>`;
      pick.addEventListener("click", async () => {
        if (editing) {
          editing.icon = i;
          this._iconFor = null;
          await this._save(this._remoteOf(this._entry()));
          this._render();
          return;
        }
        // Repainting here would throw away whatever is typed in the name field.
        this._newIcon = i;
        for (const other of picker.children) {
          other.setAttribute("aria-pressed", String(other === pick));
        }
      });
      picker.appendChild(pick);
    }
    form.appendChild(picker);
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

Object.assign(TuyaSelfhostPanel.prototype, SceneMethods, AutomationMethods);

customElements.define("tuya-selfhost-panel", TuyaSelfhostPanel);
