/**
 * What each key on a device really is.
 *
 * A strip tells us four booleans and nothing else: which one is a socket and
 * which one is a USB-C port is on the casing, not on the wire. So the house
 * says it once and both the panel and the card draw it.
 *
 * The USB drawings are ours because the ones in the icon set are plugs with a
 * tail rather than the port you look at. The sockets come from the icon set,
 * which has one per country, except the Brazilian one, which it does not.
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

// The bank as it sits on the strip: two USB-A slots and a USB-C, drawn as the
// ports themselves. Three ports need more height than one, so this glyph has a
// taller box of its own.
const USB_BANK = `<rect x="2.6" y="0.8" width="18.8" height="5.8" rx="1.2" fill="none"
  stroke="currentColor" stroke-width="1.6"/>
  <rect x="6.3" y="3" width="11.4" height="1.5" rx="0.75"/>
  <rect x="2.6" y="9.6" width="18.8" height="5.8" rx="1.2" fill="none"
  stroke="currentColor" stroke-width="1.6"/>
  <rect x="6.3" y="11.8" width="11.4" height="1.5" rx="0.75"/>
  <rect x="5.2" y="18.4" width="13.6" height="5.4" rx="2.7" fill="none"
  stroke="currentColor" stroke-width="1.6"/>
  <rect x="8.5" y="20.4" width="7" height="1.5" rx="0.75"/>`;

const USB_C = `<rect x="2" y="8.6" width="20" height="6.8" rx="3.4" fill="none"
  stroke="currentColor" stroke-width="2"/>
  <rect x="6" y="10.85" width="12" height="2.3" rx="1.15" fill="none"
  stroke="currentColor" stroke-width="1.3"/>`;

// The wall here is not the wall everywhere: the house says which country it
// is in, and only falls back to the language when nobody filled that in.
const SOCKET_BY_COUNTRY = {
  BR: "br",
  GB: "uk", IE: "uk", MT: "uk", CY: "uk", SG: "uk", MY: "uk", HK: "uk", AE: "uk",
  US: "us", CA: "us", MX: "us", PH: "us", CO: "us", VE: "us",
  AU: "au", NZ: "au", CN: "au", AR: "au",
  JP: "jp", CH: "ch", LI: "ch", IT: "it",
  FR: "fr", BE: "fr", PL: "fr", CZ: "fr", SK: "fr",
  DE: "de", AT: "de", NL: "de", SE: "de", NO: "de", FI: "de", DK: "de",
  ES: "de", PT: "de", GR: "de", RO: "de", HU: "de",
};

const SOCKET_BY_LANGUAGE = { "pt-BR": "br", pt: "de", es: "de", en: "us" };

const SOCKET_ICONS = {
  uk: "mdi:power-socket-uk", us: "mdi:power-socket-us", au: "mdi:power-socket-au",
  jp: "mdi:power-socket-jp", ch: "mdi:power-socket-ch", it: "mdi:power-socket-it",
  fr: "mdi:power-socket-fr", de: "mdi:power-socket-de", eu: "mdi:power-socket-eu",
};

export const OUTLET_KINDS = [
  { id: "key", label: "kind_key" },
  { id: "outlet", label: "kind_outlet", socket: true },
  { id: "usb", label: "kind_usb", svg: USB_A },
  { id: "usbmix", label: "kind_usbmix", svg: USB_BANK, box: "0 0 24 24.6", tall: true },
  { id: "usbc", label: "kind_usbc", svg: USB_C },
  { id: "light", label: "kind_light", icon: "mdi:lightbulb" },
];

export const OUTLET_CSS = `
.face { width:30px; height:30px; --mdc-icon-size:30px; flex:none }
svg.face { fill:currentColor }
.tile .face { width:46px; height:46px; --mdc-icon-size:34px;
  color:var(--secondary-text-color); opacity:.6 }
.tile .face.tall { width:60px; height:62px }
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

function socketOf(hass) {
  const country = ((hass && hass.config && hass.config.country) || "").toUpperCase();
  const language = (hass && hass.language) || "";
  return (
    SOCKET_BY_COUNTRY[country] ||
    SOCKET_BY_LANGUAGE[language] ||
    SOCKET_BY_LANGUAGE[language.split("-")[0]] ||
    "eu"
  );
}

export function kindGlyph(hass, kind, fallback) {
  if (kind && kind.socket) {
    const socket = socketOf(hass);
    return socket === "br"
      ? `<svg class="face" viewBox="0 0 24 24" aria-hidden="true">${SOCKET_BR}</svg>`
      : `<ha-icon class="face" icon="${SOCKET_ICONS[socket]}"></ha-icon>`;
  }
  if (kind && kind.svg)
    return `<svg class="face${kind.tall ? " tall" : ""}" viewBox="${
      kind.box || "0 0 24 24"
    }" aria-hidden="true">${kind.svg}</svg>`;
  if (kind && kind.icon) return `<ha-icon class="face" icon="${kind.icon}"></ha-icon>`;
  return fallback || '<span class="rocker"></span>';
}

export function outletGlyph(hass, kinds, entityId, deviceClass, fallback) {
  const id = outletKind(kinds, entityId, deviceClass);
  return kindGlyph(hass, OUTLET_KINDS.find((k) => k.id === id), fallback);
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
