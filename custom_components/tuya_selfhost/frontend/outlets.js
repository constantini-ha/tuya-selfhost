/**
 * What each key on a device really is.
 *
 * A strip tells us four booleans and nothing else: which one is a socket and
 * which one is a USB-C port is on the casing, not on the wire. So the house
 * says it once and both the panel and the card draw it.
 *
 * The drawings are ours because the icon set has no Brazilian socket, and the
 * ones it has for USB are plugs with a tail rather than the port you look at.
 */

const LAYOUT_GET = "tuya_selfhost/layout/get";
const LAYOUT_SET = "tuya_selfhost/layout/set";

export const OUTLETS_KEY = "outlets";

const SOCKET_BR = `<path fill-rule="evenodd" d="M1.5 12 6 6.5h12L22.5 12 18 17.5H6Z
  M6.45 12a1.55 1.55 0 1 0 3.1 0 1.55 1.55 0 1 0-3.1 0
  M10.45 12a1.55 1.55 0 1 0 3.1 0 1.55 1.55 0 1 0-3.1 0
  M14.45 12a1.55 1.55 0 1 0 3.1 0 1.55 1.55 0 1 0-3.1 0"/>`;

const USB_A = `<rect x="3" y="7.4" width="18" height="9.2" rx="1.6" fill="none"
  stroke="currentColor" stroke-width="2"/>
  <rect x="6.6" y="11" width="10.8" height="2" rx="1"/>`;

const USB_C = `<rect x="2" y="8.6" width="20" height="6.8" rx="3.4" fill="none"
  stroke="currentColor" stroke-width="2"/>
  <rect x="6" y="10.85" width="12" height="2.3" rx="1.15" fill="none"
  stroke="currentColor" stroke-width="1.3"/>`;

export const OUTLET_KINDS = [
  { id: "key", label: "kind_key" },
  { id: "outlet", label: "kind_outlet", svg: SOCKET_BR },
  { id: "usb", label: "kind_usb", svg: USB_A },
  { id: "usbc", label: "kind_usbc", svg: USB_C },
  { id: "light", label: "kind_light", icon: "mdi:lightbulb" },
];

export const OUTLET_CSS = `
.face { width:30px; height:30px; --mdc-icon-size:30px; flex:none }
svg.face { fill:currentColor }
.tile .face { width:46px; height:46px; --mdc-icon-size:34px;
  color:var(--secondary-text-color); opacity:.6 }
.tile[aria-pressed="true"] .face { color:var(--text-primary-color); opacity:.95 }
`;

export async function loadOutletKinds(hass) {
  try {
    const stored = await hass.callWS({ type: LAYOUT_GET, key: OUTLETS_KEY });
    return (stored && stored.kinds) || {};
  } catch (err) {
    return {};
  }
}

export async function saveOutletKinds(hass, kinds) {
  await hass.callWS({ type: LAYOUT_SET, key: OUTLETS_KEY, layout: { kinds } });
}

export function outletKind(kinds, entityId, deviceClass) {
  const chosen = (kinds || {})[entityId];
  if (chosen) return chosen;
  // A socket says so itself; a key on the wall says nothing and stays a rocker.
  return deviceClass === "outlet" ? "outlet" : "key";
}

export function kindGlyph(kind, fallback) {
  if (kind && kind.svg)
    return `<svg class="face" viewBox="0 0 24 24" aria-hidden="true">${kind.svg}</svg>`;
  if (kind && kind.icon) return `<ha-icon class="face" icon="${kind.icon}"></ha-icon>`;
  return fallback || '<span class="rocker"></span>';
}

export function outletGlyph(kinds, entityId, deviceClass, fallback) {
  const id = outletKind(kinds, entityId, deviceClass);
  return kindGlyph(OUTLET_KINDS.find((k) => k.id === id), fallback);
}

/**
 * A key nobody named takes the name of what it is, like the vendor app: the
 * socket keeps "Tomada 3", the USB port says USB. A name given by hand always
 * wins, and two of a kind get numbered so they stay apart.
 *
 * keys: [{entity_id, named, fallback, deviceClass}], label: (key) => string
 */
export function outletNames(keys, kinds, label) {
  const of = (key) => outletKind(kinds, key.entity_id, key.deviceClass);
  const names = {};
  for (const key of keys) {
    const kind = of(key);
    if (key.named || kind === "key" || kind === "outlet") {
      names[key.entity_id] = key.fallback;
      continue;
    }
    const same = keys.filter((other) => !other.named && of(other) === kind);
    const text = label(OUTLET_KINDS.find((k) => k.id === kind).label);
    names[key.entity_id] =
      same.length > 1 ? `${text} ${same.indexOf(key) + 1}` : text;
  }
  return names;
}
