/**
 * What each key on a device really is.
 *
 * A strip tells us four booleans and nothing else: which one is a socket and
 * which one is a USB-C port is on the casing, not on the wire. So the house
 * says it once and both the panel and the card draw it.
 */

const LAYOUT_GET = "tuya_selfhost/layout/get";
const LAYOUT_SET = "tuya_selfhost/layout/set";

export const OUTLETS_KEY = "outlets";

export const OUTLET_KINDS = [
  { id: "key", icon: null, label: "kind_key" },
  { id: "outlet", icon: "mdi:power-socket-eu", label: "kind_outlet" },
  { id: "usb", icon: "mdi:usb-port", label: "kind_usb" },
  { id: "usbc", icon: "mdi:usb-c-port", label: "kind_usbc" },
  { id: "light", icon: "mdi:lightbulb", label: "kind_light" },
];

export const OUTLET_CSS = `
.tile .face { --mdc-icon-size:30px; color:var(--secondary-text-color); opacity:.6 }
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

export function outletIcon(kinds, entityId, deviceClass) {
  const found = OUTLET_KINDS.find(
    (k) => k.id === outletKind(kinds, entityId, deviceClass)
  );
  return found ? found.icon : null;
}

export function outletFace(kinds, entityId, deviceClass) {
  const icon = outletIcon(kinds, entityId, deviceClass);
  return icon
    ? `<ha-icon class="face" icon="${icon}"></ha-icon>`
    : '<span class="rocker"></span>';
}
