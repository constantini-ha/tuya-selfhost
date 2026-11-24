"""Zigbee devices that joined lately, and how far their interview got.

ZHA only lists a device once its interview ends. A battery button sleeps in
the middle of it, so without this the panel saw nothing while one was joining.
"""

from __future__ import annotations

import time

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .const import DOMAIN

READY = f"{DOMAIN}_zigbee_joins"
JOINS = f"{DOMAIN}_zigbee_joins_seen"
# ZHA's own names (zha.application.const), spelled out to stay off its internals.
GATEWAY_MESSAGE = "zha_gateway_message"
STAGES = {
    "device_joined": "joined",
    "raw_device_initialized": "identified",
    "device_fully_initialized": "done",
}
KEEP_SECONDS = 15 * 60


@callback
def async_setup_zigbee_joins(hass: HomeAssistant) -> None:
    """Follow ZHA's join messages and register the command, once per run."""
    if hass.data.get(READY):
        return
    hass.data[READY] = True
    joins: dict[str, dict] = hass.data.setdefault(JOINS, {})

    @callback
    def seen(message: dict) -> None:
        stage = STAGES.get(message.get("type"))
        info = message.get("device_info") or {}
        ieee = info.get("ieee")
        if stage is None or not ieee:
            return
        entry = joins.setdefault(str(ieee), {"ieee": str(ieee)})
        entry["stage"] = stage
        entry["at"] = time.time()
        if info.get("model"):
            entry["model"] = info["model"]
        if info.get("manufacturer"):
            entry["manufacturer"] = info["manufacturer"]

    async_dispatcher_connect(hass, GATEWAY_MESSAGE, seen)
    websocket_api.async_register_command(hass, websocket_zigbee_joins)


def recent_joins(hass: HomeAssistant) -> dict:
    """The joins of the last minutes, with the server's clock to compare against."""
    now = time.time()
    joins: dict[str, dict] = hass.data.get(JOINS, {})
    for ieee in [i for i, e in joins.items() if now - e["at"] > KEEP_SECONDS]:
        del joins[ieee]
    return {
        "now": int(now * 1000),
        "joins": [
            {**entry, "at": int(entry["at"] * 1000)}
            for entry in sorted(joins.values(), key=lambda e: e["at"])
        ],
    }


@websocket_api.websocket_command({"type": f"{DOMAIN}/zigbee/joins"})
@websocket_api.require_admin
@callback
def websocket_zigbee_joins(hass, connection, msg):
    """Recent joins and their stage."""
    connection.send_result(msg["id"], recent_joins(hass))
