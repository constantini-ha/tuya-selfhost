/** When / If / Then automations for the panel.
 *
 *  Each one is a Home Assistant automation whose id starts with `tuya_auto_`, so
 *  it keeps running with the panel closed and stays editable in Home Assistant.
 */

import { decode, encode, slug } from "./scenes.js";

export const AUTO_PREFIX = "tuya_auto_";
const WATCHED = ["switch", "light", "fan"];

export const AUTO_CSS = `
.autos { padding:0 16px 16px }
.auto { display:flex; align-items:center; gap:12px; padding:12px 0 }
.auto + .auto { border-top:1px solid var(--divider-color) }
.auto .what { flex:1; min-width:0; border:none; background:none; padding:0; font:inherit;
  color:inherit; text-align:left; cursor:pointer }
.auto .what[disabled] { cursor:default }
.auto .name { overflow-wrap:anywhere }
.auto.off .what { opacity:.55 }
.part { margin-top:18px; padding-top:14px; border-top:1px solid var(--divider-color) }
.part .title { font-weight:500 }
.clause { display:flex; align-items:center; gap:10px; padding:10px 0 }
.clause + .clause { border-top:1px solid var(--divider-color) }
.clause ha-icon { --mdc-icon-size:22px; flex:none; color:var(--secondary-text-color) }
.times { display:flex; align-items:center; gap:10px }
`;

const clock = (text) => String(text || "").slice(0, 5);
const one = (value) => (Array.isArray(value) ? (value.length === 1 ? value[0] : null) : value);

function decodeTrigger(raw) {
  const kind = raw && (raw.trigger || raw.platform);
  const entity = raw && one(raw.entity_id);
  if (kind === "state" && typeof entity === "string" && ["on", "off"].includes(raw.to)) {
    return { kind: "state", entity, to: raw.to };
  }
  if (kind === "time" && typeof raw.at === "string" && /^\d\d:\d\d/.test(raw.at)) {
    return { kind: "time", at: clock(raw.at) };
  }
  // Anything written elsewhere is kept as it is, so saving here never loses it.
  return { kind: "raw", raw };
}

function encodeTrigger(item) {
  if (item.kind === "state") return { trigger: "state", entity_id: item.entity, to: item.to };
  if (item.kind === "time") return { trigger: "time", at: item.at + ":00" };
  return item.raw;
}

function decodeCondition(raw) {
  const entity = raw && one(raw.entity_id);
  if (raw && raw.condition === "state" && typeof entity === "string" &&
      ["on", "off"].includes(raw.state)) {
    return { kind: "state", entity, to: raw.state };
  }
  if (raw && raw.condition === "time" && typeof raw.after === "string" &&
      typeof raw.before === "string" && !raw.weekday) {
    return { kind: "time", after: clock(raw.after), before: clock(raw.before) };
  }
  return { kind: "raw", raw };
}

function encodeCondition(item) {
  if (item.kind === "state") return { condition: "state", entity_id: item.entity, state: item.to };
  if (item.kind === "time") {
    return { condition: "time", after: item.after + ":00", before: item.before + ":00" };
  }
  return item.raw;
}

const list = (config, plural, singular) => {
  const value = config[plural] ?? config[singular] ?? [];
  return Array.isArray(value) ? value : [value];
};

export const AutomationMethods = {
  _autoIds() {
    const related = this._autoRelated || new Set();
    return Object.keys(this._hass.states)
      .filter((id) => id.startsWith("automation.") &&
        (related.has(id) ||
          String(this._hass.states[id].attributes.id || "").startsWith(AUTO_PREFIX)))
      .sort((a, b) => this._friendly(a).localeCompare(this._friendly(b)));
  },

  _buttonOf(raw) {
    const data = raw && raw.event_type === "zha_event" && raw.event_data;
    const ieee = data && data.device_ieee;
    return ieee ? (this._zigbee || []).find((entry) => entry.entry_id === "zha:" + ieee) : null;
  },

  // Automations made elsewhere that drive these devices belong on this list too.
  async _findRelatedAutos() {
    const all = Object.keys(this._hass.states).filter((id) => id.startsWith("automation.")).sort();
    const key = all.join("|");
    if (key === this._autoScanned) return;
    this._autoScanned = key;
    const needles = [
      ...Object.values(this._byEntry || {}).flat().map((item) => item.entity_id),
      ...(this._zigbee || []).map((entry) => entry.entry_id.slice("zha:".length)),
    ].map((needle) => JSON.stringify(needle));
    const found = new Set();
    await Promise.all(all.map(async (entityId) => {
      try {
        const reply = await this._hass.callWS({ type: "automation/config", entity_id: entityId });
        const text = JSON.stringify((reply && reply.config) || {});
        if (needles.some((needle) => text.includes(needle))) found.add(entityId);
      } catch (err) {
        // Not readable by this user, or not made in the editor: leave it out.
      }
    }));
    this._autoRelated = found;
    if (this._scenes && !this._scene && !this._auto) this._render();
  },

  _autosSignature() {
    return this._autoIds()
      .map((id) => id + ":" + this._friendly(id) + ":" + this._hass.states[id].state)
      .join("|");
  },

  _clauseText(item, list) {
    if (item.kind === "raw") {
      const button = this._buttonOf(item.raw);
      return button ? this._t("auto_pressed", { name: button.title }) : this._t("auto_custom");
    }
    if (item.kind === "time") {
      return list === "triggers"
        ? this._t("auto_at", { time: item.at })
        : this._t("auto_between", { from: item.after, to: item.before });
    }
    const key = (list === "triggers" ? "auto_turns_" : "auto_is_") + item.to;
    return this._t(key, { name: this._friendly(item.entity) });
  },

  _clauseIcon(item) {
    if (item.kind === "raw") {
      return this._buttonOf(item.raw) ? "mdi:gesture-tap-button" : "mdi:code-braces";
    }
    if (item.kind === "time") return "mdi:clock-outline";
    return this._taskIcon({ kind: "do", entity: item.entity });
  },

  _newAuto() {
    this._auto = { id: null, name: "", triggers: [], conditions: [], tasks: [], adding: null,
      picking: null };
    this._render();
  },

  async _editAuto(entityId) {
    try {
      const reply = await this._hass.callWS({ type: "automation/config", entity_id: entityId });
      const config = (reply && reply.config) || {};
      this._auto = {
        id: config.id || this._hass.states[entityId].attributes.id,
        entityId,
        name: config.alias || this._friendly(entityId),
        triggers: list(config, "triggers", "trigger").map(decodeTrigger),
        conditions: list(config, "conditions", "condition").map(decodeCondition),
        tasks: list(config, "actions", "action").map(decode),
        keep: config,
        adding: null,
        picking: null,
      };
    } catch (err) {
      this._flash = this._t("scene_failed", { err: this._errText(err) });
    }
    this._render();
  },

  _freshAutoId(name) {
    const taken = new Set(this._autoIds().map((id) => this._hass.states[id].attributes.id));
    const base = AUTO_PREFIX + (slug(name) || "automation");
    let id = base;
    for (let n = 2; taken.has(id); n += 1) id = base + "_" + n;
    return id;
  },

  async _waitForAuto(id, present) {
    for (let tries = 0; tries < 25; tries += 1) {
      const found = this._autoIds().some((entity) => this._hass.states[entity].attributes.id === id);
      if (found === present) return true;
      await new Promise((done) => setTimeout(done, 200));
    }
    return false;
  },

  async _saveAuto() {
    const draft = this._auto;
    const name = draft.name.trim();
    const missing = !name ? "auto_need_name"
      : !draft.triggers.length ? "auto_need_when"
        : !draft.tasks.length ? "auto_need_then" : null;
    if (missing) {
      draft.error = this._t(missing);
      this._render();
      return;
    }
    const id = draft.id || this._freshAutoId(name);
    const { trigger, condition, action, ...kept } = draft.keep || {};
    const config = {
      ...kept,
      alias: name,
      description: kept.description || this._t("auto_made_here"),
      mode: kept.mode || "restart",
      triggers: draft.triggers.map(encodeTrigger),
      conditions: draft.conditions.map(encodeCondition),
      actions: draft.tasks.map(encode),
    };
    draft.saving = true;
    this._render();
    try {
      await this._hass.callApi("POST", "config/automation/config/" + id, config);
    } catch (err) {
      draft.saving = false;
      draft.error = this._t("scene_failed", { err: this._errText(err) });
      this._render();
      return;
    }
    await this._waitForAuto(id, true);
    this._auto = null;
    this._flash = this._t("auto_saved");
    this._render();
  },

  async _deleteAuto() {
    const draft = this._auto;
    try {
      await this._hass.callApi("DELETE", "config/automation/config/" + draft.id);
    } catch (err) {
      draft.confirm = false;
      draft.error = this._t("scene_failed", { err: this._errText(err) });
      this._render();
      return;
    }
    await this._waitForAuto(draft.id, false);
    this._auto = null;
    this._flash = this._t("auto_deleted");
    this._render();
  },

  async _toggleAuto(entityId) {
    const on = this._hass.states[entityId].state === "on";
    try {
      await this._hass.callService("automation", on ? "turn_off" : "turn_on", { entity_id: entityId });
    } catch (err) {
      this._flash = this._t("scene_failed", { err: this._errText(err) });
      this._render();
    }
  },

  _renderAutomations() {
    this._findRelatedAutos();
    const card = document.createElement("ha-card");
    card.header = this._t("autos");
    const ids = this._autoIds();
    const admin = this._isAdmin();
    const hint = document.createElement("div");
    hint.className = "muted scenehint";
    hint.textContent = this._t(ids.length ? "autos_intro" : admin ? "autos_empty" : "autos_empty_user");
    card.appendChild(hint);

    const box = document.createElement("div");
    box.className = "autos";
    for (const id of ids) {
      const on = this._hass.states[id].state === "on";
      const row = document.createElement("div");
      row.className = "auto" + (on ? "" : " off");
      const what = document.createElement("button");
      what.className = "what";
      what.disabled = !admin;
      what.innerHTML = `<div class="name"></div><div class="muted"></div>`;
      what.querySelector(".name").textContent = this._friendly(id);
      what.querySelector(".muted").textContent = this._t(on ? "auto_on" : "auto_off");
      if (admin) {
        what.title = this._t("auto_edit");
        what.addEventListener("click", () => this._editAuto(id));
      }
      const toggle = this._rowTool(
        on ? "mdi:toggle-switch" : "mdi:toggle-switch-off-outline",
        this._t(on ? "auto_pause" : "auto_resume"), () => this._toggleAuto(id));
      toggle.setAttribute("aria-pressed", String(on));
      toggle.style.setProperty("--mdc-icon-size", "34px");
      if (on) toggle.style.color = "var(--primary-color)";
      row.append(what, toggle);
      box.appendChild(row);
    }
    if (admin) {
      const add = document.createElement("button");
      add.className = "act";
      add.style.marginTop = ids.length ? "12px" : "0";
      add.textContent = "+ " + this._t("auto_new");
      add.addEventListener("click", () => this._newAuto());
      box.appendChild(add);
    }
    card.appendChild(box);
    return card;
  },

  _clausePicker(draft) {
    const picking = draft.picking;
    const when = picking.list === "triggers";
    const box = document.createElement("div");
    box.className = "adder";
    const done = (item) => {
      draft[picking.list].push(item);
      draft.picking = null;
      draft.error = null;
      this._render();
    };
    const buttons = document.createElement("div");
    buttons.className = "row";
    const add = document.createElement("button");
    add.className = "act";
    add.textContent = this._t("scene_add");
    const cancel = document.createElement("button");
    cancel.className = "act ghost";
    cancel.textContent = this._t("no");
    cancel.addEventListener("click", () => {
      draft.picking = null;
      this._render();
    });

    const time = (label, field) => {
      const input = document.createElement("input");
      input.type = "time";
      input.value = picking[field];
      input.setAttribute("aria-label", label);
      input.addEventListener("input", () => { picking[field] = input.value; });
      return input;
    };

    if (picking.kind === "time") {
      const label = document.createElement("div");
      label.className = "muted";
      label.textContent = this._t(when ? "auto_pick_time" : "auto_pick_window");
      box.appendChild(label);
      if (when) {
        box.appendChild(time(this._t("auto_pick_time"), "at"));
        add.addEventListener("click", () => {
          if (/^\d\d:\d\d$/.test(picking.at)) done({ kind: "time", at: picking.at });
        });
      } else {
        const times = document.createElement("div");
        times.className = "times";
        const dash = document.createElement("span");
        dash.textContent = "–";
        times.append(time(this._t("auto_from"), "after"), dash, time(this._t("auto_to"), "before"));
        box.appendChild(times);
        add.addEventListener("click", () => {
          if (/^\d\d:\d\d$/.test(picking.after) && /^\d\d:\d\d$/.test(picking.before) &&
              picking.after !== picking.before) {
            done({ kind: "time", after: picking.after, before: picking.before });
          }
        });
      }
    } else {
      const targets = this._sceneTargets(WATCHED);
      const target = targets.find((item) => item.id === picking.device) || targets[0];
      if (!target) {
        box.textContent = this._t("scene_nothing_to_do");
        return box;
      }
      picking.device = target.id;
      const entity = target.items.find((item) => item.entity_id === picking.entity) || target.items[0];
      picking.entity = entity.entity_id;
      picking.to = picking.to || "on";
      const prefix = when ? "auto_opt_turns_" : "auto_opt_is_";
      box.append(
        this._select(this._t("scene_pick_device"), targets.map((item) => [item.id, item.title]),
          picking.device, (value) => { picking.device = value; picking.entity = null; }),
        this._select(this._t("scene_pick_entity"),
          target.items.map((item) => [item.entity_id, this._shortName(item.entity_id, target.title)]),
          picking.entity, (value) => { picking.entity = value; }),
        this._select(this._t(when ? "auto_pick_change" : "auto_pick_state"),
          ["on", "off"].map((to) => [to, this._t(prefix + to)]),
          picking.to, (value) => { picking.to = value; })
      );
      add.addEventListener("click", () =>
        done({ kind: "state", entity: picking.entity, to: picking.to }));
    }
    buttons.append(add, cancel);
    box.appendChild(buttons);
    return box;
  },

  _clausePart(draft, pad, name) {
    const part = document.createElement("div");
    part.className = "part";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = this._t(name === "triggers" ? "auto_when" : "auto_if");
    const help = document.createElement("div");
    help.className = "muted";
    help.textContent = this._t(name === "triggers" ? "auto_when_help" : "auto_if_help");
    part.append(title, help);

    draft[name].forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "clause";
      row.innerHTML = `<ha-icon></ha-icon><div class="grow"></div>`;
      row.querySelector("ha-icon").setAttribute("icon", this._clauseIcon(item));
      row.querySelector(".grow").textContent = this._clauseText(item, name);
      row.appendChild(this._rowTool("mdi:close", this._t("auto_remove"), () => {
        draft[name].splice(index, 1);
        this._render();
      }));
      part.appendChild(row);
    });

    if (draft.picking && draft.picking.list === name) {
      part.appendChild(this._clausePicker(draft));
    } else {
      const more = document.createElement("div");
      more.className = "row";
      more.style.marginTop = "10px";
      const pick = (label, start) => {
        const button = document.createElement("button");
        button.className = "act ghost";
        button.textContent = "+ " + this._t(label);
        button.addEventListener("click", () => {
          draft.picking = { list: name, ...start };
          draft.adding = null;
          this._render();
        });
        return button;
      };
      more.append(
        pick("scene_add_task", { kind: "state" }),
        pick("auto_add_time", name === "triggers"
          ? { kind: "time", at: "18:00" }
          : { kind: "time", after: "18:00", before: "23:00" })
      );
      part.appendChild(more);
    }
    pad.appendChild(part);
  },

  _renderAuto() {
    const draft = this._auto;
    const card = document.createElement("ha-card");
    card.header = this._t(draft.id ? "auto_edit" : "auto_new");
    const pad = document.createElement("div");
    pad.className = "pad";
    pad.style.paddingTop = "0";
    card.appendChild(pad);

    const field = document.createElement("label");
    field.className = "field";
    field.style.marginBottom = "0";
    const caption = document.createElement("span");
    caption.className = "muted";
    caption.textContent = this._t("scene_name");
    const name = document.createElement("input");
    name.value = draft.name;
    name.maxLength = 60;
    name.placeholder = this._t("auto_name_example");
    name.addEventListener("input", () => { draft.name = name.value; });
    field.append(caption, name);
    pad.appendChild(field);

    this._clausePart(draft, pad, "triggers");
    this._clausePart(draft, pad, "conditions");

    const then = document.createElement("div");
    then.className = "part";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = this._t("auto_then");
    const help = document.createElement("div");
    help.className = "muted";
    help.textContent = this._t("auto_then_help");
    then.append(title, help);
    this._taskRows(draft, then);
    pad.appendChild(then);

    if (draft.error) {
      const error = document.createElement("div");
      error.className = "error";
      error.setAttribute("role", "alert");
      error.textContent = draft.error;
      pad.appendChild(error);
    }

    const foot = document.createElement("div");
    foot.className = "row";
    foot.style.marginTop = "20px";
    const save = document.createElement("button");
    save.className = "act";
    save.disabled = !!draft.saving;
    save.textContent = this._t(draft.saving ? "scene_saving" : "auto_save");
    save.addEventListener("click", () => this._saveAuto());
    const cancel = document.createElement("button");
    cancel.className = "act ghost";
    cancel.textContent = this._t("no");
    cancel.addEventListener("click", () => {
      this._auto = null;
      this._render();
    });
    foot.append(save, cancel);
    if (draft.id) {
      const spacer = document.createElement("div");
      spacer.className = "grow";
      const remove = document.createElement("button");
      remove.className = draft.confirm ? "act warn" : "act ghost";
      remove.textContent = this._t(draft.confirm ? "scene_delete_sure" : "scene_delete");
      remove.addEventListener("click", () => {
        if (draft.confirm) {
          this._deleteAuto();
          return;
        }
        draft.confirm = true;
        this._render();
      });
      foot.append(spacer, remove);
    }
    pad.appendChild(foot);
    return card;
  },
};
