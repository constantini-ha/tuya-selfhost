"""Renaming from the panel: the name on screen is the one voice assistants hear.

From Home Assistant 2026.11 Alexa (and Assist) call an entity by its first
alias, so a new name goes there as well, and Alexa is told at once instead of
waiting for "discover devices".
"""

from __future__ import annotations

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.const import CONF_NAME
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .helpers.config import get_device_id
from .remote_keys import _alexa_config, async_announce_to_alexa

try:
    from homeassistant.helpers.entity_registry import COMPUTED_NAME
except ImportError:  # before aliases were ordered, none of them was spoken first
    COMPUTED_NAME = None

NAME = vol.Any(None, vol.All(str, vol.Strip, vol.Length(max=60)))
READY = f"{DOMAIN}_names"


@callback
def async_setup_names(hass: HomeAssistant) -> None:
    """Register the rename command, once per Home Assistant run."""
    if hass.data.get(READY):
        return
    hass.data[READY] = True
    websocket_api.async_register_command(hass, websocket_rename)


def voice_aliases(aliases: list, name: str | None) -> list:
    """The aliases with the new name first; no name speaks the computed one again."""
    first = name or COMPUTED_NAME
    return [first, *(alias for alias in aliases[1:] if alias != first)]


def _alexa_targets(hass: HomeAssistant, entity_ids: list[str]) -> tuple[list, list]:
    """The renamed entities Alexa has, and those a configuration.yaml name holds."""
    config = _alexa_config(hass)
    if config is None:
        return [], []
    try:
        exposed = [
            entity_id for entity_id in entity_ids if config.should_expose(entity_id)
        ]
        pinned = [
            entity_id
            for entity_id in exposed
            if CONF_NAME in (config.entity_config.get(entity_id) or {})
        ]
    except Exception:  # an internal reach, like the rest of the Alexa glue
        return [], []
    return exposed, pinned


def _named_after(entities: er.EntityRegistry, device_id: str) -> list[str]:
    """Keys spoken by the computed name, which carries the device's; the rest keep their own."""
    return [
        item.entity_id
        for item in er.async_entries_for_device(entities, device_id)
        if not item.aliases or next(iter(item.aliases)) is COMPUTED_NAME
    ]


def _rename_wifi_device(hass: HomeAssistant, entry, name: str) -> list[str]:
    """Rename one of this integration's devices: its entry, the running device and its row."""
    hass.config_entries.async_update_entry(entry, title=name)
    device_id = get_device_id(entry.data)
    runtime = (hass.data.get(DOMAIN) or {}).get(device_id) or {}
    if (device := runtime.get("device")) is not None:
        # Keys learned later are filed under the device by this name.
        device.name = name
    devices = dr.async_get(hass)
    found = devices.async_get_device(identifiers={(DOMAIN, device_id)})
    if found is None:
        return []
    devices.async_update_device(found.id, name=name, name_by_user=None)
    return _named_after(er.async_get(hass), found.id)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/rename",
        vol.Exclusive("entity_id", "target"): str,
        vol.Exclusive("device_id", "target"): str,
        vol.Exclusive("entry_id", "target"): str,
        vol.Required("name"): NAME,
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_rename(hass, connection, msg):
    """Rename a key or a device, then hand the new names to Alexa."""
    name = msg["name"] or None
    entities = er.async_get(hass)
    if entity_id := msg.get("entity_id"):
        entry = entities.async_get(entity_id)
        if entry is None:
            connection.send_error(msg["id"], "not_found", f"No entity {entity_id}")
            return
        changes = {"name": name}
        if COMPUTED_NAME is not None:
            changes["aliases"] = voice_aliases(list(entry.aliases), name)
        entities.async_update_entity(entity_id, **changes)
        renamed = [entity_id]
    elif device_id := msg.get("device_id"):
        devices = dr.async_get(hass)
        if devices.async_get(device_id) is None:
            connection.send_error(msg["id"], "not_found", f"No device {device_id}")
            return
        devices.async_update_device(device_id, name_by_user=name)
        renamed = _named_after(entities, device_id)
    elif config_id := msg.get("entry_id"):
        entry = hass.config_entries.async_get_entry(config_id)
        if entry is None or entry.domain != DOMAIN:
            connection.send_error(msg["id"], "not_found", f"No device {config_id}")
            return
        if name is None:
            connection.send_error(msg["id"], "invalid_format", "A device needs a name")
            return
        renamed = _rename_wifi_device(hass, entry, name)
    else:
        connection.send_error(msg["id"], "invalid_format", "Name a key or a device")
        return

    exposed, pinned = _alexa_targets(hass, renamed)
    sent = bool(exposed) and await async_announce_to_alexa(hass, exposed)
    connection.send_result(
        msg["id"], {"exposed": len(exposed), "alexa": sent, "pinned": pinned}
    )
