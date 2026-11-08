"""Find the Bluetooth radio belonging to a device already reachable by IP."""

from __future__ import annotations

import logging

from homeassistant.components import bluetooth
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST
from homeassistant.core import HomeAssistant

from ..const import CONF_BLE
from ..helpers.arp import arp_table
from .discovery import SERVICE_UUID

_LOGGER = logging.getLogger(__name__)


def _radio_address(mac: str) -> str:
    """A Tuya combo module answers one address above its Wi-Fi interface."""
    digits = f"{int(mac.replace(':', ''), 16) + 1:012X}"
    return ":".join(digits[i : i + 2] for i in range(0, 12, 2))


def _is_advertising(hass: HomeAssistant, address: str) -> bool:
    for info in bluetooth.async_discovered_service_info(hass, connectable=True):
        if info.address.upper() != address:
            continue
        return SERVICE_UUID in (info.service_uuids or []) or SERVICE_UUID in (
            info.service_data or {}
        )
    return False


async def async_detect_reserve(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Give an entry a Bluetooth reserve once its radio is heard nearby."""
    config = {**entry.data, **entry.options}
    host = config.get(CONF_HOST)
    if config.get(CONF_BLE) or not host:
        return

    mac = (await hass.async_add_executor_job(arp_table)).get(host)
    if not mac:
        _LOGGER.debug("%s: %s is not in the ARP cache", entry.title, host)
        return

    address = _radio_address(mac)
    if not _is_advertising(hass, address):
        _LOGGER.debug(
            "%s: %s is at %s, so its radio would be %s, which is not advertising",
            entry.title, host, mac, address,
        )
        return

    _LOGGER.info(
        "%s also answers on Bluetooth at %s; keeping it as a reserve",
        entry.title,
        address,
    )
    hass.config_entries.async_update_entry(
        entry, options={**entry.options, CONF_BLE: address}
    )
