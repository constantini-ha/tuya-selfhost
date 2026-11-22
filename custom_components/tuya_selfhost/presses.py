"""The presses a Zigbee button knows, as ZHA's device triggers name them.

The panel learns a shortcut from the zha_event a press raises; this table says
which press that event was (single, double, hold; which button) for any model.
"""

from __future__ import annotations

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN

READY = f"{DOMAIN}_presses"


@callback
def async_setup_presses(hass: HomeAssistant) -> None:
    """Register the presses command, once per Home Assistant run."""
    if hass.data.get(READY):
        return
    hass.data[READY] = True
    websocket_api.async_register_command(hass, websocket_presses)


def zha_presses(hass: HomeAssistant, device_id: str) -> list[dict]:
    """Each press of the device with the event fields that mean it."""
    try:
        from homeassistant.components.zha.helpers import (
            async_get_zha_device_proxy,
            get_zha_data,
        )
    except ImportError:
        return []
    try:
        triggers = async_get_zha_device_proxy(
            hass, device_id
        ).device.device_automation_triggers
    except Exception:  # an internal reach; a device not up yet is in ZHA's cache
        try:
            triggers = get_zha_data(hass).device_trigger_cache[device_id][1]
        except Exception:
            return []
    return [
        {"type": kind, "subtype": subtype, "data": dict(data)}
        for (kind, subtype), data in (triggers or {}).items()
        if kind != "device_offline"
    ]


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/presses", vol.Required("device_id"): str}
)
@callback
def websocket_presses(hass, connection, msg):
    """The presses of one Zigbee device; empty when ZHA has none for it."""
    connection.send_result(msg["id"], zha_presses(hass, msg["device_id"]))
