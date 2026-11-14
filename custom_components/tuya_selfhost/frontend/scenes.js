/** One-tap scenes for the panel.
 *
 *  A scene is a Home Assistant script whose id starts with `tuya_scene_`, so it
 *  runs from anywhere, Alexa sees it as a scene and the prefix gives the Alexa
 *  filter one stable glob.
 */

export const SCENE_PREFIX = "tuya_scene_";
const ENTITY_PREFIX = "script." + SCENE_PREFIX;

const SCENE_ICONS = [
  "mdi:play-circle-outline", "mdi:home", "mdi:exit-run", "mdi:weather-night",
  "mdi:white-balance-sunny", "mdi:movie-open", "mdi:lightbulb-group", "mdi:lightbulb-off",
  "mdi:sofa", "mdi:bed", "mdi:silverware-fork-knife", "mdi:party-popper",
  "mdi:shield-home", "mdi:car", "mdi:air-conditioner", "mdi:television", "mdi:power",
  "mdi:star",
];

const ACTS = {
  switch: ["on", "off", "toggle"],
  light: ["on", "off", "toggle"],
  fan: ["on", "off", "toggle"],
  button: ["press"],
  cover: ["open", "close", "stop"],
};

const SERVICE = {
  on: "homeassistant.turn_on",
  off: "homeassistant.turn_off",
  toggle: "homeassistant.toggle",
  press: "button.press",
  open: "cover.open_cover",
  close: "cover.close_cover",
  stop: "cover.stop_cover",
};
const ACT_OF = Object.fromEntries(Object.entries(SERVICE).map(([act, service]) => [service, act]));

export const SCENE_CSS = `
.scenes { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px;
  padding:0 16px 16px }
.scene { position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:10px;
  min-height:92px; padding:14px; border-radius:16px; cursor:pointer; font:inherit; text-align:left;
  border:1px solid var(--divider-color); color:var(--primary-text-color);
  background:var(--secondary-background-color); transition:transform .12s }
.scene:active { transform:scale(.97) }
.scene ha-icon { --mdc-icon-size:26px; color:var(--primary-color) }
.scene .label { font-size:.95em; overflow-wrap:anywhere; padding-right:26px }
.scene.ran { border-color:var(--primary-color) }
.scene.new { align-items:center; justify-content:center; text-align:center; border-style:dashed;
  background:transparent; color:var(--secondary-text-color) }
.scene.new ha-icon { color:var(--secondary-text-color) }
.scene .edit { position:absolute; top:6px; right:6px }
.scene .edit ha-icon { --mdc-icon-size:20px; color:var(--secondary-text-color) }
.scenehint { padding:0 16px 14px }
.task { display:flex; align-items:center; gap:10px; padding:10px 0 }
.task + .task { border-top:1px solid var(--divider-color) }
.task .num { width:24px; height:24px; flex:none; border-radius:50%; display:flex;
  align-items:center; justify-content:center; font-size:.75em;
  background:var(--secondary-background-color); color:var(--secondary-text-color) }
.task ha-icon { --mdc-icon-size:22px; flex:none; color:var(--secondary-text-color) }
.adder { display:grid; gap:10px; margin-top:12px; padding:14px; border-radius:12px;
  border:1px solid var(--divider-color) }
.adder select, .adder input, .field input { width:100%; box-sizing:border-box; font-size:16px }
.field { display:grid; gap:6px; margin-bottom:14px }
.error { color:var(--error-color,#db4437); font-size:.9em; margin-top:10px }
`;

function slug(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function decode(step) {
  if (step && step.delay != null && Object.keys(step).length === 1) {
    const delay = step.delay;
    const seconds = typeof delay === "number"
      ? delay
      : (delay.hours || 0) * 3600 + (delay.minutes || 0) * 60 + (delay.seconds || 0);
    if (Number.isFinite(seconds)) return { kind: "wait", seconds };
  }
  const service = step && (step.action || step.service);
  const target = step && step.target && step.target.entity_id;
  const entity = Array.isArray(target) ? (target.length === 1 ? target[0] : null) : target;
  if (ACT_OF[service] && typeof entity === "string") {
    return { kind: "do", entity, act: ACT_OF[service] };
  }
  // Anything written elsewhere is kept as it is, so saving here never loses a step.
  return { kind: "raw", raw: step };
}

function encode(task) {
  if (task.kind === "wait") return { delay: { seconds: task.seconds } };
  if (task.kind === "do") return { action: SERVICE[task.act], target: { entity_id: task.entity } };
  return task.raw;
}

export const SceneMethods = {
  _sceneIds() {
    return Object.keys(this._hass.states).filter((id) => id.startsWith(ENTITY_PREFIX)).sort();
  },

  _scenesSignature() {
    return this._sceneIds()
      .map((id) => id + ":" + this._friendly(id) + ":" + (this._hass.states[id].attributes.icon || ""))
      .join("|");
  },

  _isAdmin() {
    return !!(this._hass.user && this._hass.user.is_admin);
  },

  _sceneTargets() {
    const all = [...(this._entries || []), ...(this._zigbee || [])];
    return all
      .map((entry) => ({
        id: entry.entry_id,
        title: entry.title,
        items: this._sorted(
          (this._byEntry[entry.entry_id] || []).filter(
            (item) =>
              ACTS[item.entity_id.split(".")[0]] &&
              !item.entity_category &&
              this._hass.states[item.entity_id]
          )
        ),
      }))
      .filter((target) => target.items.length);
  },

  _taskText(task) {
    if (task.kind === "wait") return this._t("scene_wait_for", { n: task.seconds });
    if (task.kind === "raw") return this._t("scene_custom_step");
    return this._friendly(task.entity) + " · " + this._t("scene_act_" + task.act);
  },

  _taskIcon(task) {
    if (task.kind === "wait") return "mdi:timer-sand";
    if (task.kind === "raw") return "mdi:code-braces";
    const state = this._hass.states[task.entity];
    return (state && state.attributes.icon) ||
      { button: "mdi:gesture-tap-button", cover: "mdi:window-shutter", fan: "mdi:fan",
        light: "mdi:lightbulb" }[task.entity.split(".")[0]] || "mdi:toggle-switch-variant";
  },

  async _runScene(entityId) {
    this._ran = entityId;
    this._render();
    setTimeout(() => {
      if (this._ran === entityId) {
        this._ran = null;
        this._render();
      }
    }, 1200);
    try {
      await this._hass.callService("script", "turn_on", { entity_id: entityId });
    } catch (err) {
      this._flash = this._t("scene_failed", { err: err.message || String(err) });
      this._render();
    }
  },

  _newScene() {
    this._scene = { id: null, name: "", icon: SCENE_ICONS[0], tasks: [], adding: null };
    this._render();
  },

  async _editScene(entityId) {
    try {
      const reply = await this._hass.callWS({ type: "script/config", entity_id: entityId });
      const config = (reply && reply.config) || {};
      this._scene = {
        id: entityId.slice("script.".length),
        name: config.alias || this._friendly(entityId),
        icon: config.icon || SCENE_ICONS[0],
        tasks: (config.sequence || []).map(decode),
        keep: config,
        adding: null,
      };
    } catch (err) {
      this._flash = this._t("scene_failed", { err: err.message || String(err) });
    }
    this._render();
  },

  _freshSceneId(name) {
    const base = SCENE_PREFIX + (slug(name) || "scene");
    let id = base;
    for (let n = 2; this._hass.states["script." + id]; n += 1) id = base + "_" + n;
    return id;
  },

  async _waitForState(entityId, present) {
    for (let tries = 0; tries < 25; tries += 1) {
      if (!!this._hass.states[entityId] === present) return true;
      await new Promise((done) => setTimeout(done, 200));
    }
    return false;
  },

  async _tellAlexa(forget) {
    try {
      const result = await this._hass.callService(
        "tuya_selfhost", "alexa_announce", forget ? { forget } : {}, undefined, false, true
      );
      return (result && result.response) || {};
    } catch (err) {
      return {};
    }
  },

  async _saveScene() {
    const draft = this._scene;
    const name = draft.name.trim();
    if (!name || !draft.tasks.length) {
      draft.error = this._t(name ? "scene_need_task" : "scene_need_name");
      this._render();
      return;
    }
    const id = draft.id || this._freshSceneId(name);
    const config = {
      ...(draft.keep || {}),
      alias: name,
      icon: draft.icon,
      description: (draft.keep && draft.keep.description) || this._t("scene_made_here"),
      mode: (draft.keep && draft.keep.mode) || "single",
      sequence: draft.tasks.map(encode),
    };
    draft.saving = true;
    this._render();
    try {
      await this._hass.callApi("POST", "config/script/config/" + id, config);
    } catch (err) {
      draft.saving = false;
      draft.error = this._t("scene_failed", { err: err.message || String(err) });
      this._render();
      return;
    }
    await this._waitForState("script." + id, true);
    // Home Assistant only tells Alexa about new entities for its paid cloud.
    const alexa = await this._tellAlexa();
    this._scene = null;
    this._flash = !alexa.alexa
      ? this._t("scene_saved")
      : !alexa.scenes_exposed
        ? this._t("scene_saved_filter")
        : alexa.sent
          ? this._t("scene_saved_alexa", { name })
          : this._t("scene_saved_discover");
    this._render();
  },

  async _deleteScene() {
    const draft = this._scene;
    const entityId = "script." + draft.id;
    try {
      await this._hass.callApi("DELETE", "config/script/config/" + draft.id);
    } catch (err) {
      draft.confirm = false;
      draft.error = this._t("scene_failed", { err: err.message || String(err) });
      this._render();
      return;
    }
    await this._waitForState(entityId, false);
    await this._tellAlexa([entityId]);
    this._scene = null;
    this._flash = this._t("scene_deleted");
    this._render();
  },

  _renderScenes() {
    const card = document.createElement("ha-card");
    card.header = this._t("scenes");
    const ids = this._sceneIds();
    const admin = this._isAdmin();
    if (!ids.length) {
      const hint = document.createElement("div");
      hint.className = "muted scenehint";
      hint.textContent = this._t(admin ? "scenes_empty" : "scenes_empty_user");
      card.appendChild(hint);
    }
    const grid = document.createElement("div");
    grid.className = "scenes";
    for (const id of ids) {
      const state = this._hass.states[id];
      const tile = document.createElement("div");
      tile.className = "scene" + (this._ran === id ? " ran" : "");
      tile.setAttribute("role", "button");
      tile.tabIndex = 0;
      tile.innerHTML = `<ha-icon></ha-icon><span class="label"></span>`;
      tile.querySelector("ha-icon").setAttribute(
        "icon", this._ran === id ? "mdi:check-circle" : state.attributes.icon || SCENE_ICONS[0]);
      tile.querySelector(".label").textContent = this._friendly(id);
      tile.title = this._t("scene_run");
      const run = () => this._runScene(id);
      tile.addEventListener("click", run);
      tile.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") run();
      });
      if (admin) {
        const edit = document.createElement("button");
        edit.className = "icon edit";
        edit.title = this._t("scene_edit");
        edit.setAttribute("aria-label", edit.title);
        edit.innerHTML = `<ha-icon icon="mdi:pencil-outline"></ha-icon>`;
        edit.addEventListener("click", (event) => {
          event.stopPropagation();
          this._editScene(id);
        });
        tile.appendChild(edit);
      }
      grid.appendChild(tile);
    }
    if (admin) {
      const add = document.createElement("button");
      add.className = "scene new";
      add.innerHTML = `<ha-icon icon="mdi:plus"></ha-icon><span></span>`;
      add.querySelector("span").textContent = this._t("scene_new");
      add.addEventListener("click", () => this._newScene());
      grid.appendChild(add);
    }
    if (ids.length || admin) card.appendChild(grid);
    return card;
  },

  _sceneAdder(draft) {
    const adding = draft.adding;
    const box = document.createElement("div");
    box.className = "adder";
    const finish = (task) => {
      draft.tasks.push(task);
      draft.adding = null;
      draft.error = null;
      this._render();
    };
    const buttons = document.createElement("div");
    buttons.className = "row";
    const cancel = document.createElement("button");
    cancel.className = "act ghost";
    cancel.textContent = this._t("no");
    cancel.addEventListener("click", () => {
      draft.adding = null;
      this._render();
    });
    const add = document.createElement("button");
    add.className = "act";
    add.textContent = this._t("scene_add");

    if (adding.kind === "wait") {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = "3600";
      input.inputMode = "numeric";
      input.value = adding.seconds;
      input.setAttribute("aria-label", this._t("scene_wait_seconds"));
      input.addEventListener("input", () => { adding.seconds = input.value; });
      const label = document.createElement("div");
      label.className = "muted";
      label.textContent = this._t("scene_wait_seconds");
      box.append(label, input);
      add.addEventListener("click", () => {
        const seconds = Math.round(Number(adding.seconds));
        if (seconds >= 1 && seconds <= 3600) finish({ kind: "wait", seconds });
      });
    } else {
      const targets = this._sceneTargets();
      const target = targets.find((item) => item.id === adding.device) || targets[0];
      if (!target) {
        box.textContent = this._t("scene_nothing_to_do");
        return box;
      }
      adding.device = target.id;
      const entity = target.items.find((item) => item.entity_id === adding.entity) || target.items[0];
      adding.entity = entity.entity_id;
      const acts = ACTS[adding.entity.split(".")[0]];
      if (!acts.includes(adding.act)) adding.act = acts[0];
      const select = (label, options, value, onChange) => {
        const node = document.createElement("select");
        node.setAttribute("aria-label", label);
        for (const [id, text] of options) {
          const option = document.createElement("option");
          option.value = id;
          option.textContent = text;
          option.selected = id === value;
          node.appendChild(option);
        }
        node.addEventListener("change", () => {
          onChange(node.value);
          this._render();
        });
        return node;
      };
      box.append(
        select(this._t("scene_pick_device"), targets.map((item) => [item.id, item.title]),
          adding.device, (value) => { adding.device = value; adding.entity = null; }),
        select(this._t("scene_pick_entity"),
          target.items.map((item) => [item.entity_id, this._shortName(item.entity_id, target.title)]),
          adding.entity, (value) => { adding.entity = value; }),
        select(this._t("scene_pick_act"), acts.map((act) => [act, this._t("scene_act_" + act)]),
          adding.act, (value) => { adding.act = value; })
      );
      add.addEventListener("click", () =>
        finish({ kind: "do", entity: adding.entity, act: adding.act }));
    }
    buttons.append(add, cancel);
    box.appendChild(buttons);
    return box;
  },

  _renderScene() {
    const draft = this._scene;
    const card = document.createElement("ha-card");
    card.header = this._t(draft.id ? "scene_edit" : "scene_new");
    const pad = document.createElement("div");
    pad.className = "pad";
    pad.style.paddingTop = "0";
    card.appendChild(pad);

    const field = document.createElement("label");
    field.className = "field";
    const caption = document.createElement("span");
    caption.className = "muted";
    caption.textContent = this._t("scene_name");
    const name = document.createElement("input");
    name.value = draft.name;
    name.maxLength = 60;
    name.placeholder = this._t("scene_name_example");
    name.addEventListener("input", () => { draft.name = name.value; });
    field.append(caption, name);
    pad.appendChild(field);

    const icons = document.createElement("div");
    icons.className = "icons";
    icons.style.margin = "0 0 18px";
    const choices = SCENE_ICONS.includes(draft.icon) ? SCENE_ICONS : [draft.icon, ...SCENE_ICONS];
    for (const icon of choices) {
      const pick = document.createElement("button");
      pick.className = "iconpick";
      pick.setAttribute("aria-pressed", String(icon === draft.icon));
      pick.setAttribute("aria-label", icon.replace("mdi:", ""));
      pick.innerHTML = `<ha-icon icon="${icon}"></ha-icon>`;
      pick.addEventListener("click", () => {
        draft.icon = icon;
        this._render();
      });
      icons.appendChild(pick);
    }
    pad.appendChild(icons);

    const heading = document.createElement("div");
    heading.className = "muted";
    heading.textContent = this._t(draft.tasks.length ? "scene_tasks" : "scene_tasks_empty");
    pad.appendChild(heading);

    draft.tasks.forEach((task, index) => {
      const row = document.createElement("div");
      row.className = "task";
      row.innerHTML = `<span class="num">${index + 1}</span><ha-icon></ha-icon><div class="grow"></div>`;
      row.querySelector("ha-icon").setAttribute("icon", this._taskIcon(task));
      row.querySelector(".grow").textContent = this._taskText(task);
      const tool = (icon, label, onClick, off) => {
        const button = document.createElement("button");
        button.className = "icon";
        button.title = label;
        button.setAttribute("aria-label", label);
        button.disabled = !!off;
        if (off) button.style.opacity = ".3";
        button.innerHTML = `<ha-icon icon="${icon}"></ha-icon>`;
        button.addEventListener("click", onClick);
        return button;
      };
      const move = (delta) => {
        const [item] = draft.tasks.splice(index, 1);
        draft.tasks.splice(index + delta, 0, item);
        this._render();
      };
      row.append(
        tool("mdi:arrow-up", this._t("scene_move_up"), () => move(-1), index === 0),
        tool("mdi:arrow-down", this._t("scene_move_down"), () => move(1),
          index === draft.tasks.length - 1),
        tool("mdi:close", this._t("scene_remove_task"), () => {
          draft.tasks.splice(index, 1);
          this._render();
        })
      );
      pad.appendChild(row);
    });

    if (draft.adding) {
      pad.appendChild(this._sceneAdder(draft));
    } else {
      const more = document.createElement("div");
      more.className = "row";
      more.style.marginTop = "12px";
      const task = document.createElement("button");
      task.className = "act ghost";
      task.textContent = "+ " + this._t("scene_add_task");
      task.addEventListener("click", () => {
        draft.adding = { kind: "do" };
        this._render();
      });
      const wait = document.createElement("button");
      wait.className = "act ghost";
      wait.textContent = "+ " + this._t("scene_add_wait");
      wait.addEventListener("click", () => {
        draft.adding = { kind: "wait", seconds: 5 };
        this._render();
      });
      more.append(task, wait);
      pad.appendChild(more);
    }

    if (draft.error) {
      const error = document.createElement("div");
      error.className = "error";
      error.setAttribute("role", "alert");
      error.textContent = draft.error;
      pad.appendChild(error);
    }

    const hint = document.createElement("div");
    hint.className = "muted";
    hint.style.marginTop = "16px";
    hint.textContent = this._t("scene_alexa_hint");
    pad.appendChild(hint);

    const foot = document.createElement("div");
    foot.className = "row";
    foot.style.marginTop = "16px";
    const save = document.createElement("button");
    save.className = "act";
    save.disabled = !!draft.saving;
    save.textContent = this._t(draft.saving ? "scene_saving" : "scene_save");
    save.addEventListener("click", () => this._saveScene());
    const cancel = document.createElement("button");
    cancel.className = "act ghost";
    cancel.textContent = this._t("no");
    cancel.addEventListener("click", () => {
      this._scene = null;
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
          this._deleteScene();
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
