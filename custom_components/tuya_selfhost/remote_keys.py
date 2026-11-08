"""Turns every learned remote key into a button entity.

A key stored by the panel is only data; Alexa, Google and automations can only
reach it once it is an entity. One button per taught key does that, and the
Alexa integration maps the button domain to a scene, so "turn on <key>" presses
it.
"""

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.start import async_at_started
from homeassistant.util import slugify

from .const import DOMAIN
from .helpers.config import get_device_id
from .remote_card import SIGNAL_LAYOUTS, STORAGE_KEY

_LOGGER = logging.getLogger(__name__)

OBJECT_ID_PREFIX = "tuya_remote"


async def async_setup_remote_keys(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities
) -> None:
    """Keep one button per taught key, following what the panel saves."""
    config = {**entry.data, **entry.options}
    device = hass.data[DOMAIN][get_device_id(config)]["device"]
    known: set[str] = set()

    async def _sync(*_args) -> None:
        registry = er.async_get(hass)
        remotes = [
            item.entity_id
            for item in er.async_entries_for_config_entry(registry, entry.entry_id)
            if item.domain == "remote"
        ]
        if not remotes:
            return

        store = hass.data.get(STORAGE_KEY)
        stored = await store.async_load() or {}

        wanted: dict[str, ButtonEntity] = {}
        for remote_id in remotes:
            for control in (stored.get(remote_id) or {}).get("controls", []):
                for key in control.get("buttons", []):
                    if not key.get("taught"):
                        continue
                    button = RemoteKeyButton(entry, device, remote_id, control, key)
                    wanted[button.unique_id] = button

        fresh = [b for uid, b in wanted.items() if uid not in known]
        if fresh:
            async_add_entities(fresh)
            known.update(b.unique_id for b in fresh)

        for uid in known - set(wanted):
            entity_id = registry.async_get_entity_id("button", DOMAIN, uid)
            if entity_id:
                registry.async_remove(entity_id)
            known.discard(uid)

    # Marked as a callback, or the dispatcher runs it in a worker thread.
    @callback
    def _schedule(*_args) -> None:
        entry.async_create_task(hass, _sync())

    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_LAYOUTS, _schedule))
    entry.async_on_unload(async_at_started(hass, _sync))


class RemoteKeyButton(ButtonEntity):
    """One learned key, pressable by voice, automation or dashboard."""

    _attr_has_entity_name = False
    _attr_should_poll = False

    def __init__(self, entry: ConfigEntry, device, remote_id: str, control, key):
        self._remote_id = remote_id
        self._device_name = control.get("device")
        self._command = key["command"]
        self._attr_unique_id = f"{entry.entry_id}:{control['id']}:{key['command']}"
        self._attr_name = f"{control['name']} {key['name']}".strip()
        self._attr_icon = key.get("icon") or "mdi:remote"
        self._attr_device_info = device.device_info
        # Set outright rather than suggested: Home Assistant prefixes a suggestion
        # with the area and the device, and the Alexa filter needs one stable glob.
        self.entity_id = f"button.{slugify(f'{OBJECT_ID_PREFIX} {self._attr_name}')}"

    async def async_press(self) -> None:
        await self.hass.services.async_call(
            "remote",
            "send_command",
            {
                "entity_id": self._remote_id,
                "device": self._device_name,
                "command": self._command,
            },
            blocking=True,
        )
