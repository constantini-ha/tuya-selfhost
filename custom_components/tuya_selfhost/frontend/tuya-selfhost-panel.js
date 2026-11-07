const LAYOUT_GET = "tuya_selfhost/layout/get";
const LAYOUT_SET = "tuya_selfhost/layout/set";
const ICONS = [
  "mdi:power", "mdi:air-conditioner", "mdi:snowflake", "mdi:snowflake-melt",
  "mdi:fan", "mdi:water-percent", "mdi:thermometer-plus", "mdi:thermometer-minus",
  "mdi:volume-plus", "mdi:volume-minus", "mdi:play-pause", "mdi:television",
  "mdi:lightbulb", "mdi:arrow-up", "mdi:arrow-down", "mdi:remote",
];

const STYLE = `
  :host { display: block; background: var(--primary-background-color); min-height: 100vh; }
  .bar {
    display: flex; align-items: center; gap: 16px; height: 64px; padding: 0 16px;
    background: var(--app-header-background-color, var(--primary-color));
    color: var(--app-header-text-color, var(--text-primary-color));
  }
  .bar h1 { font-size: 20px; font-weight: 400; margin: 0; flex: 1; }
  .wrap { padding: 16px; max-width: 900px; margin: 0 auto; }
  ha-card { margin-bottom: 16px; }
  .pad { padding: 16px; }
  .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .row + .row { margin-top: 12px; }
  .grow { flex: 1; min-width: 120px; }
  .muted { color: var(--secondary-text-color); font-size: .9em; }
  button.act {
    border: none; border-radius: 8px; padding: 9px 14px; cursor: pointer;
    background: var(--primary-color); color: var(--text-primary-color); font: inherit;
  }
  button.act.ghost { background: transparent; color: var(--primary-color); }
  button.act.warn { background: var(--error-color, #db4437); }
  button.act:disabled { opacity: .5; cursor: default; }
  input, select {
    padding: 9px; border-radius: 8px; font: inherit;
    border: 1px solid var(--divider-color); background: var(--card-background-color);
    color: var(--primary-text-color);
  }
  .keys { display: grid; gap: 8px; margin-top: 16px; }
  .keywrap { position: relative; }
  .key {
    width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 14px 6px; min-height: 80px; border-radius: 12px; cursor: pointer;
    border: 1px solid var(--divider-color); background: var(--card-background-color);
    color: var(--primary-text-color); font: inherit; font-size: .85em;
  }
  .key.untaught { border-style: dashed; opacity: .75; }
  .key ha-icon { --mdc-icon-size: 26px; }
  .tools { display: flex; justify-content: center; gap: 2px; margin-top: 4px; }
  .tools button {
    border: none; background: transparent; cursor: pointer; padding: 2px 4px;
    color: var(--secondary-text-color); font: inherit; font-size: .8em;
  }
  .banner { padding: 12px 16px; border-radius: 8px; margin-bottom: 12px; }
  .banner.info { background: var(--primary-color); color: var(--text-primary-color); }
  .banner.ok { background: var(--success-color, #43a047); color: #fff; }
  .list-item {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    border-top: 1px solid var(--divider-color);
  }
  .list-item:first-of-type { border-top: none; }
`;

class TuyaSelfhostPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._state = { entityId: null, controls: [], open: null, busy: null, flash: null };
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
    const registry = await this._hass.callWS({ type: "config/entity_registry/list" });
    this._remotes = registry.filter(
      (e) => e.platform === "tuya_selfhost" && e.entity_id.startsWith("remote.")
    );
    if (this._remotes.length) {
      this._state.entityId = this._remotes[0].entity_id;
      await this._loadControls();
    }
    this._render();
  }

  async _loadControls() {
    const stored = await this._hass.callWS({
      type: LAYOUT_GET,
      key: this._state.entityId,
    });
    this._state.controls = (stored && stored.controls) || [];
  }

  async _save() {
    await this._hass.callWS({
      type: LAYOUT_SET,
      key: this._state.entityId,
      layout: { controls: this._state.controls },
    });
  }

  _control() {
    return this._state.controls.find((c) => c.id === this._state.open);
  }

  _name(entityId) {
    const state = this._hass.states[entityId];
    return (state && state.attributes.friendly_name) || entityId;
  }

  // ---------- actions ----------

  async _addControl(name) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    this._state.controls.push({
      id: `${slug}_${Date.now().toString(36)}`,
      name,
      device: slug || "controle",
      columns: 3,
      buttons: [],
    });
    await this._save();
    this._render();
  }

  async _removeControl(id) {
    this._state.controls = this._state.controls.filter((c) => c.id !== id);
    if (this._state.open === id) this._state.open = null;
    await this._save();
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
    await this._save();
    this._render();
  }

  async _moveButton(index, delta) {
    const list = this._control().buttons;
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    await this._save();
    this._render();
  }

  async _deleteButton(index) {
    const control = this._control();
    const [removed] = control.buttons.splice(index, 1);
    await this._save();
    this._hass
      .callService("remote", "delete_command", {
        entity_id: this._state.entityId,
        device: control.device,
        command: removed.command,
      })
      .catch(() => {});
    this._render();
  }

  async _learn(index) {
    const control = this._control();
    const button = control.buttons[index];
    this._state.busy = `Aponte o controle para o blaster e aperte "${button.name}". Você tem 30 segundos.`;
    this._render();
    try {
      await this._hass.callService("remote", "learn_command", {
        entity_id: this._state.entityId,
        device: control.device,
        command: button.command,
      });
      button.taught = true;
      await this._save();
      this._state.busy = null;
      this._state.confirm = index;
    } catch (err) {
      this._state.busy = null;
      this._state.flash = `Não capturei nada: ${err.message || err}`;
    }
    this._render();
  }

  async _test(index) {
    const control = this._control();
    await this._hass.callService("remote", "send_command", {
      entity_id: this._state.entityId,
      device: control.device,
      command: control.buttons[index].command,
    });
  }

  async _discard(index) {
    const control = this._control();
    const button = control.buttons[index];
    await this._hass.callService("remote", "delete_command", {
      entity_id: this._state.entityId,
      device: control.device,
      command: button.command,
    });
    button.taught = false;
    await this._save();
    this._state.confirm = null;
    this._state.flash = "Código descartado. Pode aprender de novo.";
    this._render();
  }

  async _addToDashboard() {
    const control = this._control();
    const config = await this._hass.callWS({ type: "lovelace/config", url_path: null });
    const card = {
      type: "custom:tuya-selfhost-remote-card",
      entity: this._state.entityId,
      control: control.id,
      title: control.name,
    };
    const view = config.views[0];
    if (view.sections) {
      view.sections.push({ type: "grid", cards: [card] });
    } else {
      view.cards = view.cards || [];
      view.cards.push(card);
    }
    await this._hass.callWS({ type: "lovelace/config/save", url_path: null, config });
    this._state.flash = `"${control.name}" foi para o seu painel.`;
    this._render();
  }

  // ---------- rendering ----------

  _render() {
    const s = this._state;
    const root = document.createElement("div");

    const bar = document.createElement("div");
    bar.className = "bar";
    bar.innerHTML = `<ha-icon icon="mdi:remote"></ha-icon><h1>Controles Tuya</h1>`;
    root.appendChild(bar);

    const wrap = document.createElement("div");
    wrap.className = "wrap";
    root.appendChild(wrap);

    if (!this._remotes || !this._remotes.length) {
      wrap.innerHTML = `<ha-card><div class="pad">Nenhum blaster IR/RF encontrado
        nesta instalação. Adicione o aparelho pela integração Tuya Selfhost primeiro.</div></ha-card>`;
      this._paint(root);
      return;
    }

    if (s.flash) {
      const flash = document.createElement("div");
      flash.className = "banner ok";
      flash.textContent = s.flash;
      wrap.appendChild(flash);
      s.flash = null;
    }

    wrap.appendChild(s.open ? this._renderControl() : this._renderList());
    this._paint(root);
  }

  _renderList() {
    const card = document.createElement("ha-card");
    card.header = "Seus controles";

    if (this._remotes.length > 1) {
      const picker = document.createElement("div");
      picker.className = "pad row";
      picker.innerHTML = `<span class="muted">Blaster</span>`;
      const select = document.createElement("select");
      select.className = "grow";
      this._remotes.forEach((r) => {
        const option = document.createElement("option");
        option.value = r.entity_id;
        option.textContent = this._name(r.entity_id);
        option.selected = r.entity_id === this._state.entityId;
        select.appendChild(option);
      });
      select.addEventListener("change", async () => {
        this._state.entityId = select.value;
        await this._loadControls();
        this._render();
      });
      picker.appendChild(select);
      card.appendChild(picker);
    }

    this._state.controls.forEach((control) => {
      const taught = control.buttons.filter((b) => b.taught).length;
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `
        <ha-icon icon="mdi:remote-tv"></ha-icon>
        <div class="grow">
          <div>${control.name}</div>
          <div class="muted">${control.buttons.length} botões · ${taught} aprendidos</div>
        </div>`;
      const open = document.createElement("button");
      open.className = "act";
      open.textContent = "Abrir";
      open.addEventListener("click", () => {
        this._state.open = control.id;
        this._render();
      });
      const remove = document.createElement("button");
      remove.className = "act ghost";
      remove.textContent = "Excluir";
      remove.addEventListener("click", () => this._removeControl(control.id));
      item.append(open, remove);
      card.appendChild(item);
    });

    const form = document.createElement("div");
    form.className = "pad row";
    const input = document.createElement("input");
    input.className = "grow";
    input.placeholder = "Nome do novo controle (ex.: Ar da sala)";
    const add = document.createElement("button");
    add.className = "act";
    add.textContent = "Criar controle";
    add.addEventListener("click", () => {
      if (input.value.trim()) this._addControl(input.value.trim());
    });
    form.append(input, add);
    card.appendChild(form);
    return card;
  }

  _renderControl() {
    const control = this._control();
    const card = document.createElement("ha-card");
    card.header = control.name;

    const head = document.createElement("div");
    head.className = "pad row";
    const back = document.createElement("button");
    back.className = "act ghost";
    back.textContent = "← Voltar";
    back.addEventListener("click", () => {
      this._state.open = null;
      this._state.confirm = null;
      this._render();
    });
    const spacer = document.createElement("span");
    spacer.className = "grow";
    const columns = document.createElement("select");
    [2, 3, 4].forEach((n) => {
      const option = document.createElement("option");
      option.value = String(n);
      option.textContent = `${n} colunas`;
      option.selected = (control.columns || 3) === n;
      columns.appendChild(option);
    });
    columns.addEventListener("change", async () => {
      control.columns = Number(columns.value);
      await this._save();
      this._render();
    });
    const toDash = document.createElement("button");
    toDash.className = "act";
    toDash.textContent = "Adicionar ao painel";
    toDash.disabled = !control.buttons.some((b) => b.taught);
    toDash.addEventListener("click", () => this._addToDashboard());
    head.append(back, spacer, columns, toDash);
    card.appendChild(head);

    if (this._state.busy) {
      const banner = document.createElement("div");
      banner.className = "banner info";
      banner.style.margin = "0 16px 12px";
      banner.textContent = this._state.busy;
      card.appendChild(banner);
    }

    const keys = document.createElement("div");
    keys.className = "keys pad";
    keys.style.gridTemplateColumns = `repeat(${control.columns || 3}, 1fr)`;
    control.buttons.forEach((button, index) => {
      const cell = document.createElement("div");
      cell.className = "keywrap";
      const key = document.createElement("button");
      key.className = button.taught ? "key" : "key untaught";
      key.innerHTML = `<ha-icon icon="${button.icon}"></ha-icon><span>${button.name}</span>
        <span class="muted">${button.taught ? "aprendido" : "sem código"}</span>`;
      key.addEventListener("click", () =>
        button.taught ? this._test(index) : this._learn(index)
      );
      cell.appendChild(key);

      const tools = document.createElement("div");
      tools.className = "tools";
      const mk = (label, title, handler) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.title = title;
        b.addEventListener("click", handler);
        return b;
      };
      tools.append(
        mk("←", "Mover para a esquerda", () => this._moveButton(index, -1)),
        mk("→", "Mover para a direita", () => this._moveButton(index, 1)),
        mk("⟳", "Aprender de novo", () => this._learn(index)),
        mk("✕", "Excluir botão", () => this._deleteButton(index))
      );
      cell.appendChild(tools);

      if (this._state.confirm === index) {
        const box = document.createElement("div");
        box.className = "banner info";
        box.style.marginTop = "8px";
        box.innerHTML = `<div style="margin-bottom:8px">Capturado. Testar antes de manter?</div>`;
        const test = document.createElement("button");
        test.className = "act ghost";
        test.style.background = "rgba(255,255,255,.2)";
        test.style.color = "inherit";
        test.textContent = "Testar";
        test.addEventListener("click", () => this._test(index));
        const keep = document.createElement("button");
        keep.className = "act";
        keep.textContent = "Manter";
        keep.addEventListener("click", () => {
          this._state.confirm = null;
          this._render();
        });
        const drop = document.createElement("button");
        drop.className = "act warn";
        drop.textContent = "Descartar";
        drop.addEventListener("click", () => this._discard(index));
        box.append(test, keep, drop);
        cell.appendChild(box);
      }
      keys.appendChild(cell);
    });
    card.appendChild(keys);

    const form = document.createElement("div");
    form.className = "pad row";
    const name = document.createElement("input");
    name.className = "grow";
    name.placeholder = "Nome do botão (ex.: Frio 22)";
    const icon = document.createElement("select");
    ICONS.forEach((i) => {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = i.replace("mdi:", "");
      icon.appendChild(option);
    });
    const add = document.createElement("button");
    add.className = "act";
    add.textContent = "+ Adicionar botão";
    add.addEventListener("click", () => {
      if (name.value.trim()) this._addButton(name.value.trim(), icon.value);
    });
    form.append(name, icon, add);
    card.appendChild(form);

    const tip = document.createElement("div");
    tip.className = "pad muted";
    tip.textContent =
      "Toque num botão sem código para aprender. Num já aprendido, o toque testa. " +
      "Deixe o controle físico no estado exato que você quer antes de apertar: " +
      "controle de ar transmite o estado inteiro a cada toque.";
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
