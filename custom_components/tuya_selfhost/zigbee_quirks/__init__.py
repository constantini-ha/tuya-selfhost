"""Zigbee quirks for Tuya devices that zha-quirks does not cover yet.

Each module here registers its quirk on import and names the devices it covers
in `DEVICES`, as (manufacturer, model) pairs.
"""

from __future__ import annotations

import importlib
import logging
import pkgutil

from homeassistant.core import HomeAssistant
from homeassistant.helpers.start import async_at_started

_LOGGER = logging.getLogger(__name__)

READY_FLAG = "tuya_selfhost_zigbee_quirks"
ZHA = "zha"


def _register() -> set[tuple[str, str]]:
    """Import every quirk and return the devices they cover."""
    try:
        import zhaquirks  # noqa: F401
    except ImportError:
        return set()

    covered: set[tuple[str, str]] = set()
    for module in pkgutil.iter_modules(__path__):
        try:
            quirk = importlib.import_module(f"{__name__}.{module.name}")
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Zigbee quirk %s was not registered: %s", module.name, err)
        else:
            covered.update(quirk.DEVICES)
    return covered


def _loaded_bare(hass: HomeAssistant, covered: set[tuple[str, str]]) -> bool:
    """Whether Zigbee already loaded a covered device without its quirk."""
    try:
        devices = hass.data[ZHA].gateway_proxy.gateway.devices.values()
        return any(
            not getattr(device, "quirk_applied", True)
            and (device.manufacturer, device.model) in covered
            for device in devices
        )
    except Exception:  # noqa: BLE001
        return False


async def async_setup_zigbee_quirks(hass: HomeAssistant) -> None:
    """Register the quirks, once per Home Assistant run."""
    if hass.data.get(READY_FLAG):
        return
    hass.data[READY_FLAG] = True

    covered = await hass.async_add_executor_job(_register)
    if not covered:
        return

    async def _catch_up(_hass: HomeAssistant) -> None:
        # Zigbee picks a quirk when it loads its devices; if it won the race, it loads again.
        if not _loaded_bare(hass, covered):
            return
        _LOGGER.warning(
            "Zigbee started before the Tuya quirks were registered; reloading it once"
        )
        for entry in hass.config_entries.async_entries(ZHA):
            await hass.config_entries.async_reload(entry.entry_id)

    async_at_started(hass, _catch_up)
