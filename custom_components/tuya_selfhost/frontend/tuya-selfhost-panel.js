import { t } from "./i18n.js";
import { OUTLET_CSS, OUTLET_KINDS, kindGlyph, loadOutletKinds, outletGlyph, outletKind,
  outletNames, saveOutletKinds } from "./outlets.js";

const LAYOUT_GET = "tuya_selfhost/layout/get";
const LAYOUT_SET = "tuya_selfhost/layout/set";
const LAYOUT_SUB = "tuya_selfhost/layout/subscribe";
const CLOUD_STATUS = "tuya_selfhost/cloud/status";
const CLOUD_QR = "tuya_selfhost/cloud/qr";
const CLOUD_LOGIN = "tuya_selfhost/cloud/login";
const CLOUD_LOGOUT = "tuya_selfhost/cloud/logout";
const ZHA_DEVICES = "zha/devices";

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
.kindrow { padding:10px 0 }
.kindrow + .kindrow { border-top:1px solid var(--divider-color) }
.iconpick .face { width:22px; height:22px; --mdc-icon-size:22px }
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
      // A disabled or hidden entity never gets a state, so it has nothing to show.
      if (item.disabled_by || item.hidden_by) continue;
      (this._byEntry[item.config_entry_id] ||= []).push(item);
    }
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
  }

  async _loadZigbee() {
    // Zigbee devices belong to Home Assistant's own integration, but they are
    // devices in this house like any other, so they belong in this list too.
    this._zigbee = [];
    try {
      const devices = await this._hass.callWS({ type: ZHA_DEVICES });
      for (const device of devices || []) {
        if (device.active_coordinator) continue;
        const id = "zha:" + device.ieee;
        this._zigbee.push({
          entry_id: id,
          title: device.user_given_name || device.name,
          zha: device,
        });
        this._byEntry[id] = (device.entities || []).map((e) => ({
          entity_id: e.entity_id,
        }));
      }
    } catch (err) {
      this._zigbee = [];
      this._noZigbee = true;
    }
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
    const NAMED = {
      remote_button_short_press: "press_short",
      remote_button_double_press: "press_double",
      remote_button_long_press: "press_long",
    };
    return NAMED[command] ? this._t(NAMED[command]) : null;
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

  _pressOf(auto) {
    for (const trigger of auto.triggers || []) {
      const label = this._pressLabel((trigger.event_data || {}).command || trigger.subtype);
      if (label) return label;
    }
    return null;
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
      const name = document.createElement("div");
      name.textContent = names[item.entity_id];
      const picker = document.createElement("div");
      picker.className = "icons";
      const state = this._hass.states[item.entity_id];
      const current = outletKind(this._kinds, item.entity_id,
        state && state.attributes.device_class);
      for (const kind of OUTLET_KINDS) {
        const pick = document.createElement("button");
        pick.className = "iconpick";
        pick.setAttribute("aria-pressed", String(current === kind.id));
        pick.title = this._t(kind.label);
        pick.innerHTML = kindGlyph(kind, '<span class="rocker" style="width:22px"></span>');
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

  _startShortcut(entry) {
    this._newAuto = { entry_id: entry.entry_id, command: null, params: null, error: null,
                      target: null, keys: [], act: "toggle" };
    this._render();
    this._listenPress(entry);
  }

  // One press can speak twice: the quirk's own command and the friendly
  // remote_button_* one. Collect for a moment and keep the friendly one.
  async _listenPress(entry) {
    this._stopPress();
    const draft = this._newAuto;
    draft.error = null;
    draft.heard = [];
    try {
      this._unpress = await this._hass.connection.subscribeEvents((event) => {
        const data = (event && event.data) || {};
        if (!this._newAuto || this._newAuto.command) return;
        if (data.device_ieee !== entry.zha.ieee) return;
        this._newAuto.heard.push(data);
        clearTimeout(this._pressPick);
        this._pressPick = setTimeout(() => this._pickPress(), 700);
      }, "zha_event");
    } catch (err) {
      draft.error = err.message || String(err);
      this._render();
      return;
    }
    this._pressTimer = setTimeout(() => {
      this._stopPress();
      if (this._newAuto && !this._newAuto.command) {
        this._newAuto.error = this._t("press_none");
        this._render();
      }
    }, 30000);
  }

  _pickPress() {
    const draft = this._newAuto;
    if (!draft || draft.command || !draft.heard.length) return;
    const heard = draft.heard;
    const best =
      heard.find((data) => String(data.command || "").startsWith("remote_button_")) || heard[0];
    draft.command = best.command;
    draft.params = best.params && Object.keys(best.params).length ? best.params : null;
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

  _shortcutTargets() {
    const all = [...(this._entries || []), ...(this._zigbee || [])];
    return all
      .map((entry) => ({ id: entry.entry_id, title: entry.title, gangs: this._gangsOf(entry) }))
      .filter((target) => target.gangs.length);
  }

  async _makeShortcut(entry) {
    const draft = this._newAuto;
    if (!draft || !draft.keys.length) return;
    const press = this._pressLabel(draft.command) || draft.command;
    const data = { device_ieee: entry.zha.ieee, command: draft.command };
    // A quirk that only speaks press_type says which press in the params, and
    // without them the shortcut would answer every press alike.
    if (draft.params && !String(draft.command).startsWith("remote_button_"))
      data.params = draft.params;
    const config = {
      alias: entry.title + " \u00b7 " + press,
      description: this._t("auto_made_here"),
      triggers: [{ trigger: "event", event_type: "zha_event", event_data: data }],
      conditions: [],
      actions: [{ action: "homeassistant." + draft.act, target: { entity_id: draft.keys } }],
      mode: "single",
    };
    try {
      await this._hass.callApi("POST", "config/automation/config/" + Date.now(), config);
      this._newAuto = null;
      this._flash = this._t("shortcut_saved");
      this._refreshAutomations();
    } catch (err) {
      draft.error = this._t("shortcut_failed", { err: err.message || String(err) });
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
      this._flash = this._t("shortcut_failed", { err: err.message || String(err) });
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

    if (!draft.command) {
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

    const got = document.createElement("div");
    got.className = "muted";
    got.textContent = this._t("press_got", {
      press: this._pressLabel(draft.command) || draft.command,
    });
    box.appendChild(got);

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

    const keys = document.createElement("div");
    keys.className = "row";
    keys.style.cssText = "flex-wrap:wrap;margin-top:10px";
    for (const gang of picked ? picked.gangs : []) {
      const chosen = draft.keys.includes(gang.entity_id);
      const chip = document.createElement("button");
      chip.className = chosen ? "act" : "act ghost";
      chip.textContent = this._shortName(gang.entity_id, picked.title);
      chip.addEventListener("click", () => {
        draft.keys = chosen
          ? draft.keys.filter((id) => id !== gang.entity_id)
          : [...draft.keys, gang.entity_id];
        this._render();
      });
      keys.appendChild(chip);
    }
    box.appendChild(keys);

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
    make.textContent = this._t("create_shortcut");
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

      if (this._confirmAuto === auto.entity_id) {
        name.className = "muted";
        name.textContent = this._t("confirm_delete_auto", {
          name: auto.config.alias || auto.entity_id,
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

      name.textContent = auto.config.alias || auto.entity_id;
      facts.textContent = [
        this._pressOf(auto),
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
    const drafting = this._newAuto && this._newAuto.entry_id === entry.entry_id;
    if (entry.zha && drafting) {
      box.appendChild(this._shortcutForm(entry));
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
    if (this._unwatch) {
      this._unwatch();
      this._unwatch = null;
    }
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
    const card = entry.zha
      ? {
          type: "custom:tuya-selfhost-device-card",
          entities: (this._byEntry[entry.entry_id] || [])
            .map((e) => e.entity_id)
            .filter((id) => id.startsWith("switch.") || id.startsWith("light.")),
          title: entry.title,
        }
      : {
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

  // ---------- Tuya account ----------

  async _cloudQr(userCode) {
    this._login = { busy: true, user_code: userCode };
    this._render();
    try {
      const result = await this._hass.callWS({
        type: CLOUD_QR,
        user_code: userCode,
      });
      this._login = result.error
        ? { failed: result.error, user_code: userCode }
        : { rows: result.rows, tries: 0, user_code: userCode };
      if (this._login.rows) this._pollLogin();
    } catch (err) {
      this._login = { failed: err.message || String(err), user_code: userCode };
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
        this._cloud = { authenticated: true };
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
    this._cloud = { authenticated: false };
    this._login = null;
    this._render();
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
      if (code) this._cloudQr(code);
    };
    go.addEventListener("click", start);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") start();
    });
    field.append(input, go);
    box.appendChild(field);
    box.insertAdjacentHTML(
      "beforeend",
      `<div class="muted" style="margin-top:8px">${this._t("cloud_where")}</div>`
    );
    return box;
  }

  // ---------- Zigbee ----------

  async _permit() {
    try {
      await this._hass.callService("zha", "permit", { duration: 120 });
    } catch (err) {
      this._flash = this._t("zigbee_failed", { err: err.message || err });
      this._render();
      return;
    }
    this._pairing = {
      left: 120,
      found: [],
      before: new Set((this._zigbee || []).map((d) => d.entry_id)),
    };
    this._render();
    this._pairTick();
  }

  _pairTick() {
    clearTimeout(this._pairTimer);
    this._pairTimer = setTimeout(async () => {
      if (!this._pairing) return;
      this._pairing.left -= 5;
      await this._loadZigbee();
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
      this._pairing = null;
      this._flash = found.length
        ? this._t("zigbee_joined", { names: found.join(", ") })
        : this._t("zigbee_none");
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
      this._flash = this._t("zigbee_failed", { err: err.message || err });
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

    if (!(this._entries || []).length && !(this._zigbee || []).length) {
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
      this._report = ((result && result.response) || {}).devices || [];
    } catch (err) {
      this._report = [];
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
      ["zigbee", "tab_zigbee"],
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
    else if (this._config === "zigbee") card.appendChild(this._tabZigbee());
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

    const cloud = document.createElement("div");
    cloud.className = "block";
    cloud.innerHTML = `<h3>${this._t("add_cloud")}</h3>
      <div class="muted">${this._t("add_cloud_text")}</div>`;
    // The heading above already says what the account is for.
    const signIn = this._loginBox(false);
    signIn.style.marginTop = "12px";
    cloud.appendChild(signIn);
    box.appendChild(cloud);

    const manual = document.createElement("div");
    manual.className = "block";
    manual.innerHTML = `<h3>${this._t("add_local")}</h3>
      <div class="muted">${this._t("add_local_text")}</div>`;
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
          <div class="muted mono">${device.host || "—"} · ${
            device.mac || this._t("no_mac")
          }</div>
          ${
            advice
              ? `<div class="muted advice">${this._t(advice)}</div>`
              : ""
          }
        </div>
        <span class="pill ${tone}">${this._t(label)}</span>`;
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
    copy.className = "act ghost";
    copy.style.marginTop = "10px";
    copy.textContent = this._t("copy_macs");
    copy.disabled = !macs;
    copy.addEventListener("click", () => this._copy(macs, this._t("copied")));

    const again = document.createElement("button");
    again.className = "act ghost";
    again.style.marginTop = "10px";
    again.textContent = this._t("refresh");
    again.addEventListener("click", () => this._loadReport());

    foot.append(copy, again);
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
    for (const device of this._zigbee || []) {
      const entities = this._byEntry[device.entry_id] || [];
      const row = document.createElement("div");
      row.className = "dev";
      row.innerHTML = `
        <ha-icon icon="mdi:zigbee"></ha-icon>
        <div class="grow">
          <div>${device.title}</div>
          <div class="muted">${this._t("entities", { n: entities.length })}</div>
        </div>
        <span class="pill">${this._t("zigbee_pill")}</span>`;
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
    return card;
  }

  _renderDevice() {
    this._loadAutomations();
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

    if (entry.zha) {
      const facts = document.createElement("div");
      facts.className = "pad muted";
      facts.style.paddingTop = "0";
      facts.textContent = this._zigbeeFacts(entry);
      card.appendChild(facts);
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
        tile.innerHTML = outletGlyph(this._kinds, item.entity_id,
          state && state.attributes.device_class);
        tile.addEventListener("click", () =>
          this._hass.callService("homeassistant", "toggle", { entity_id: item.entity_id })
        );
        const name = document.createElement("div");
        name.className = "tilename";
        name.textContent = names[item.entity_id];
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

customElements.define("tuya-selfhost-panel", TuyaSelfhostPanel);
