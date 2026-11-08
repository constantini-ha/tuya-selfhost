"""Serves the remote builder card and stores the button layouts it draws."""

import logging
from pathlib import Path

import voluptuous as vol
from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import (
    async_dispatcher_connect,
    async_dispatcher_send,
)
from homeassistant.helpers.storage import Store
from homeassistant.loader import async_get_integration

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

CARD_FILE = "tuya-selfhost-remote-card.js"
DEVICE_CARD_FILE = "tuya-selfhost-device-card.js"
PANEL_FILE = "tuya-selfhost-panel.js"
PANEL_URL_PATH = "tuya-selfhost"
FRONTEND_URL = f"/{DOMAIN}/frontend"
STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}_remote_layouts"
READY_FLAG = f"{DOMAIN}_remote_card"
SIGNAL_LAYOUTS = f"{DOMAIN}_layouts_changed"
DEFAULT_LAYOUT = {"columns": 3, "buttons": []}


async def async_setup_remote_card(hass: HomeAssistant) -> None:
    """Register the card and its websocket API, once per Home Assistant run."""
    if hass.data.get(READY_FLAG):
        return
    hass.data[READY_FLAG] = True

    integration = await async_get_integration(hass, DOMAIN)
    # Serving under the version means a relative import cannot pick up a stale
    # copy: a query string would only version the file that carries it.
    base = f"{FRONTEND_URL}/{integration.version}"

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                base,
                str(Path(__file__).parent / "frontend"),
                cache_headers=True,
            )
        ]
    )

    for card in (CARD_FILE, DEVICE_CARD_FILE):
        add_extra_js_url(hass, f"{base}/{card}")

    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="tuya-selfhost-panel",
        frontend_url_path=PANEL_URL_PATH,
        module_url=f"{base}/{PANEL_FILE}",
        sidebar_title="Tuya Selfhost",
        sidebar_icon="mdi:home-automation",
        require_admin=True,
        embed_iframe=False,
    )

    hass.data[STORAGE_KEY] = Store(hass, STORAGE_VERSION, STORAGE_KEY)

    websocket_api.async_register_command(hass, websocket_subscribe_layouts)
    websocket_api.async_register_command(hass, websocket_layout_entities)
    websocket_api.async_register_command(hass, websocket_get_layout)
    websocket_api.async_register_command(hass, websocket_set_layout)
    _LOGGER.debug("Remote builder card served from %s", FRONTEND_URL)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/layout/get",
        vol.Required("key"): str,
    }
)
@websocket_api.async_response
async def websocket_get_layout(hass, connection, msg):
    """Return the stored button layout for one remote and sub-device."""
    stored = await hass.data[STORAGE_KEY].async_load() or {}
    connection.send_result(msg["id"], stored.get(msg["key"], DEFAULT_LAYOUT))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/layout/set",
        vol.Required("key"): str,
        vol.Required("layout"): dict,
    }
)
@websocket_api.async_response
async def websocket_set_layout(hass, connection, msg):
    """Persist the button layout drawn in the card."""
    store = hass.data[STORAGE_KEY]
    stored = await store.async_load() or {}
    stored[msg["key"]] = msg["layout"]
    await store.async_save(stored)
    async_dispatcher_send(hass, SIGNAL_LAYOUTS)
    connection.send_result(msg["id"], {"saved": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/layout/entities",
        vol.Required("key"): str,
    }
)
@websocket_api.callback
def websocket_layout_entities(hass, connection, msg):
    """Say which entity each control and key turned into.

    A card could guess the entity id from the name, but a rename or a clash
    would quietly break it. The registry knows, so ask the registry.
    """
    registry = er.async_get(hass)
    remote = registry.async_get(msg["key"])
    found: dict[str, dict] = {}
    if remote and remote.config_entry_id:
        prefix = f"{remote.config_entry_id}:"
        for item in er.async_entries_for_config_entry(
            registry, remote.config_entry_id
        ):
            if not item.unique_id.startswith(prefix):
                continue
            parts = item.unique_id[len(prefix):].split(":", 1)
            if len(parts) != 2:
                continue
            control_id, command = parts
            slot = found.setdefault(control_id, {"power": None, "keys": {}})
            if command == "power":
                slot["power"] = item.entity_id
            else:
                slot["keys"][command] = item.entity_id
    connection.send_result(msg["id"], found)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/layout/subscribe"})
@callback
def websocket_subscribe_layouts(hass, connection, msg):
    """Tell every open screen that the layouts changed.

    Without this a panel keeps the copy it read at boot, and the next save
    writes that stale copy back over whatever another screen did.
    """

    @callback
    def _changed() -> None:
        connection.send_message(websocket_api.event_message(msg["id"], {}))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(
        hass, SIGNAL_LAYOUTS, _changed
    )
    connection.send_result(msg["id"])
