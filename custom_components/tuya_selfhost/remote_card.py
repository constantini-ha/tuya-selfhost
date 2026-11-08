"""Serves the remote builder card and stores the button layouts it draws."""

import logging
from pathlib import Path

import voluptuous as vol
from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
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
DEFAULT_LAYOUT = {"columns": 3, "buttons": []}


async def async_setup_remote_card(hass: HomeAssistant) -> None:
    """Register the card and its websocket API, once per Home Assistant run."""
    if hass.data.get(READY_FLAG):
        return
    hass.data[READY_FLAG] = True

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                FRONTEND_URL,
                str(Path(__file__).parent / "frontend"),
                cache_headers=False,
            )
        ]
    )

    integration = await async_get_integration(hass, DOMAIN)
    for card in (CARD_FILE, DEVICE_CARD_FILE):
        add_extra_js_url(hass, f"{FRONTEND_URL}/{card}?v={integration.version}")

    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="tuya-selfhost-panel",
        frontend_url_path=PANEL_URL_PATH,
        module_url=f"{FRONTEND_URL}/{PANEL_FILE}?v={integration.version}",
        sidebar_title="Tuya Selfhost",
        sidebar_icon="mdi:home-automation",
        require_admin=True,
        embed_iframe=False,
    )

    hass.data[STORAGE_KEY] = Store(hass, STORAGE_VERSION, STORAGE_KEY)

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
    connection.send_result(msg["id"], {"saved": True})
