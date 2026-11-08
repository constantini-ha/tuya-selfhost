const LAYOUT_GET = "tuya_selfhost/layout/get";
const LAYOUT_SET = "tuya_selfhost/layout/set";

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
.banner { margin:14px 0 0; padding:12px 14px; border-radius:10px; font-size:13px;
  background:var(--primary-color); color:var(--text-primary-color) }
.banner button { margin:10px 6px 0 0 }
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
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._ready) {
      this._ready = true;
      this._boot();
    }
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
    this._busy = `Aponte o controle para o aparelho e aperte "${button.name}". 30 segundos.`;
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
      this._flash = `Não capturei nada: ${err.message || err}`;
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
      this._flash = `Falhou: ${err.message || err}`;
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
    this._flash = "Código descartado. Pode aprender de novo.";
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
    this._flash = `"${control.name}" foi para o seu painel.`;
    this._render();
  }

  // ---------- rendering ----------

  _render() {
    const root = document.createElement("div");
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.innerHTML = `<ha-icon icon="mdi:home-automation"></ha-icon><h1>Tuya Selfhost</h1>`;
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

    if (!this._entries || !this._entries.length) {
      wrap.innerHTML += `<ha-card><div class="pad">Nenhum aparelho Tuya Selfhost configurado ainda.</div></ha-card>`;
    } else if (this._remote) {
      wrap.appendChild(this._renderRemote());
    } else if (this._open) {
      wrap.appendChild(this._renderDevice());
    } else {
      wrap.appendChild(this._renderList());
    }
    this._paint(root);
  }

  _renderList() {
    const card = document.createElement("ha-card");
    card.header = "Seus aparelhos";
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
          <div class="muted">${entities.length} entidades${
            remote ? ` · ${controls} controle${controls === 1 ? "" : "s"}` : ""
          }</div>
        </div>
        ${remote ? '<span class="pill on">emissor IR/RF</span>' : ""}`;
      const open = document.createElement("button");
      open.className = "act";
      open.textContent = "Abrir";
      open.addEventListener("click", () => {
        this._open = entry.entry_id;
        this._render();
      });
      row.appendChild(open);
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
    back.textContent = "← Aparelhos";
    back.addEventListener("click", () => {
      this._open = null;
      this._render();
    });
    head.appendChild(back);
    head.appendChild(Object.assign(document.createElement("span"), { className: "grow" }));
    card.appendChild(head);

    const entities = this._byEntry[entry.entry_id] || [];
    const list = document.createElement("div");
    list.className = "pad";
    list.innerHTML =
      `<div class="muted" style="margin-bottom:8px">Entidades</div>` +
      entities
        .slice(0, 12)
        .map(
          (e) =>
            `<div class="row" style="padding:5px 0"><span class="grow">${
              e.entity_id
            }</span><span class="pill">${this._stateOf(e.entity_id)}</span></div>`
        )
        .join("") +
      (entities.length > 12
        ? `<div class="muted">e mais ${entities.length - 12}…</div>`
        : "");
    card.appendChild(list);

    if (remote) {
      const section = document.createElement("div");
      section.className = "pad";
      section.style.borderTop = "1px solid var(--divider-color)";
      section.innerHTML = `<div class="muted" style="margin-bottom:10px">Controles deste emissor</div>`;
      for (const control of this._controls(remote)) {
        const taught = control.buttons.filter((b) => b.taught).length;
        const row = document.createElement("div");
        row.className = "row";
        row.style.padding = "6px 0";
        row.innerHTML = `<ha-icon icon="mdi:remote-tv"></ha-icon>
          <div class="grow"><div>${control.name}</div>
          <div class="muted">${control.buttons.length} botões · ${taught} aprendidos</div></div>`;
        const open = document.createElement("button");
        open.className = "act";
        open.textContent = "Abrir";
        open.addEventListener("click", () => {
          this._remote = control.id;
          this._render();
        });
        const del = document.createElement("button");
        del.className = "act ghost";
        del.textContent = "Excluir";
        del.addEventListener("click", () => this._removeControl(remote, control.id));
        row.append(open, del);
        section.appendChild(row);
      }
      const form = document.createElement("div");
      form.className = "row";
      form.style.marginTop = "10px";
      const name = document.createElement("input");
      name.className = "grow";
      name.placeholder = "Nome do controle (ex.: Ar da sala)";
      const add = document.createElement("button");
      add.className = "act";
      add.textContent = "Criar controle";
      add.addEventListener("click", () => {
        if (name.value.trim()) this._addControl(remote, name.value.trim());
      });
      form.append(name, add);
      section.appendChild(form);
      card.appendChild(section);
    }
    return card;
  }

  _renderRemote() {
    const control = this._control();
    const card = document.createElement("ha-card");

    const head = document.createElement("div");
    head.className = "pad row";
    const back = document.createElement("button");
    back.className = "act ghost";
    back.textContent = "← Voltar";
    back.addEventListener("click", () => {
      this._remote = null;
      this._confirm = null;
      this._render();
    });
    const edit = document.createElement("button");
    edit.className = this._editing ? "act" : "act ghost";
    edit.textContent = this._editing ? "Concluir" : "Editar";
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
        mk("←", "Mover", () => this._moveButton(index, -1)),
        mk("→", "Mover", () => this._moveButton(index, 1)),
        mk("⟳", "Regravar", () => this._learn(index)),
        mk("✕", "Excluir", () => this._deleteButton(index))
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

    if (this._confirm !== null && this._confirm !== undefined) {
      const index = this._confirm;
      const box = document.createElement("div");
      box.className = "banner";
      box.style.margin = "16px";
      box.innerHTML = `<div>Capturado. Testar antes de manter?</div>`;
      const test = document.createElement("button");
      test.className = "act ghost";
      test.style.color = "inherit";
      test.textContent = "Testar";
      test.addEventListener("click", () => this._press(index));
      const keep = document.createElement("button");
      keep.className = "act";
      keep.textContent = "Manter";
      keep.addEventListener("click", () => {
        this._confirm = null;
        this._render();
      });
      const drop = document.createElement("button");
      drop.className = "act warn";
      drop.textContent = "Descartar";
      drop.addEventListener("click", () => this._discard(index));
      box.append(test, keep, drop);
      card.appendChild(box);
    }

    const actions = document.createElement("div");
    actions.className = "pad row";
    const dash = document.createElement("button");
    dash.className = "act";
    dash.textContent = "Adicionar ao painel";
    dash.disabled = !control.buttons.some((b) => b.taught);
    dash.addEventListener("click", () => this._toDashboard());
    actions.append(dash);
    if (this._editing) {
      const columns = document.createElement("select");
      for (const n of [2, 3, 4]) {
        const o = document.createElement("option");
        o.value = String(n);
        o.textContent = `${n} colunas`;
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

    if (!this._editing) {
      const hint = document.createElement("div");
      hint.className = "pad muted";
      hint.textContent = control.buttons.some((b) => !b.taught)
        ? "Teclas apagadas ainda não têm código: toque numa delas para aprender."
        : "Toque numa tecla para enviar. Em Editar você acrescenta, move e regrava.";
      card.appendChild(hint);
      return card;
    }

    const form = document.createElement("div");
    form.className = "pad row";
    const name = document.createElement("input");
    name.className = "grow";
    name.placeholder = "Nome do botão (ex.: Frio 22)";
    const icon = document.createElement("select");
    for (const i of ICONS) {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = i.replace("mdi:", "");
      icon.appendChild(o);
    }
    const add = document.createElement("button");
    add.className = "act";
    add.textContent = "+ Botão";
    add.addEventListener("click", () => {
      if (name.value.trim()) this._addButton(name.value.trim(), icon.value);
    });
    form.append(name, icon, add);
    card.appendChild(form);

    const tip = document.createElement("div");
    tip.className = "pad muted";
    tip.textContent =
      "Tecla apagada ainda não tem código: toque para aprender. Tecla acesa envia. " +
      "Deixe o controle físico no estado exato antes de apertar — controle de ar " +
      "transmite o estado inteiro a cada toque.";
    card.appendChild(tip);
    return card;
  }

  _paint(root) {
    const style = document.createElement("style");
    style.textContent = STYLE;
    this.shadowRoot.innerHTML = "";
    this.shadowRoot.append(style, root);
  }
}

customElements.define("tuya-selfhost-panel", TuyaSelfhostPanel);
