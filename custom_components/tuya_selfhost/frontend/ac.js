// The look of a learned remote, and the air conditioner drawn on it, shared by the panel and the card.
import { t } from "./i18n.js";

export const AC_MODES = ["cool", "heat", "dry", "fan_only", "auto"];
// Most units ignore the temperature while drying or only blowing; each unit can say otherwise.
export const AC_TEMP_MODES = ["cool", "heat", "auto"];

export const AC_MODE_ICONS = {
  cool: "mdi:snowflake",
  heat: "mdi:fire",
  dry: "mdi:water-percent",
  fan_only: "mdi:fan",
  auto: "mdi:thermostat-auto",
};

export const REMOTE_CSS = `
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
.ac-screen { display:flex; flex-direction:column; align-items:center; gap:2px; padding:16px 14px }
.ac-screen.off { color:#4D6B78 }
.ac-temp { font-size:56px; line-height:1; font-weight:300; letter-spacing:-.02em;
  font-variant-numeric:tabular-nums }
.ac-temp small { font-size:16px; vertical-align:top; margin-left:2px }
.ac-line { font-size:12px; letter-spacing:.04em }
.ac-row { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:12px }
.ac-row.wide { grid-template-columns:1fr 1fr; margin-bottom:6px }
.key.pillkey { aspect-ratio:auto; border-radius:16px; padding:12px 8px; font-size:11px }
.key:disabled { opacity:.4; cursor:default; transform:none }
.key.power.on { background:linear-gradient(180deg,#2E9E7A,#1F7559) }
.ac-more { display:block; margin:12px auto 0; border:none; background:transparent; cursor:pointer;
  color:#8E97AC; font:inherit; font-size:12px; padding:6px 10px }
`;

export function acOf(hass, controlId) {
  if (!hass || !controlId) return null;
  return (
    Object.values(hass.states).find(
      (s) => s.entity_id.startsWith("climate.") && s.attributes.tuya_control === controlId
    ) || null
  );
}

export function acSignature(state) {
  return state ? [state.state, state.attributes.temperature, state.attributes.fan_mode].join("|") : "";
}

export function renderAc(hass, state) {
  const _t = (key, vars) => t(hass, key, vars);
  const a = state.attributes;
  const on = state.state !== "off";
  const mode = on ? state.state : a.last_mode || "cool";
  const temp = a.temperature ?? a.min_temp;
  const counts = (a.temp_modes || AC_TEMP_MODES).includes(mode);
  const box = document.createElement("div");
  box.className = "ac";
  box.innerHTML = `<div class="screen ac-screen${on ? "" : " off"}">
      <div class="ac-temp"><span></span><small>°C</small></div>
      <div class="ac-line"></div>
    </div>
    <div class="ac-row"></div>
    <div class="ac-row wide"></div>`;
  box.querySelector(".ac-temp span").textContent = counts ? temp : "--";
  if (!counts) box.querySelector(".ac-temp small").remove();
  box.querySelector(".ac-line").textContent = on
    ? `${_t("ac_mode_" + mode)} · ${_t("ac_fan_" + a.fan_mode)}`
    : _t("ac_off");

  const call = (service, data = {}) =>
    hass.callService("climate", service, { entity_id: state.entity_id, ...data });
  const key = (icon, label, fn, extra = "") => {
    const b = document.createElement("button");
    b.className = "key " + extra;
    b.setAttribute("aria-label", label);
    b.innerHTML = `<ha-icon icon="${icon}"></ha-icon><span></span>`;
    b.querySelector("span").textContent = label;
    b.addEventListener("click", fn);
    return b;
  };
  const step = (delta) => {
    const next = Math.min(a.max_temp, Math.max(a.min_temp, temp + delta));
    if (next !== temp) call("set_temperature", { temperature: next });
  };
  const [row, wide] = box.querySelectorAll(".ac-row");
  const colder = key("mdi:minus", _t("ac_colder"), () => step(-1));
  const warmer = key("mdi:plus", _t("ac_warmer"), () => step(1));
  colder.disabled = warmer.disabled = !counts;
  row.append(
    colder,
    key("mdi:power", _t(on ? "ac_turn_off" : "ac_turn_on"), () => call(on ? "turn_off" : "turn_on"),
      on ? "power on" : "power"),
    warmer
  );
  const modes = (a.hvac_modes || []).filter((m) => m !== "off");
  const fans = a.fan_modes || [];
  const modeKey = key(
    AC_MODE_ICONS[mode] || "mdi:air-conditioner",
    _t("ac_mode", { mode: _t("ac_mode_" + mode) }),
    () => call("set_hvac_mode", { hvac_mode: modes[(modes.indexOf(mode) + 1) % modes.length] }),
    "pillkey"
  );
  modeKey.disabled = !on;
  const fanKey = key(
    "mdi:fan",
    _t("ac_fan", { fan: _t("ac_fan_" + a.fan_mode) }),
    () => call("set_fan_mode", { fan_mode: fans[(fans.indexOf(a.fan_mode) + 1) % fans.length] }),
    "pillkey"
  );
  wide.append(modeKey, fanKey);
  return box;
}
