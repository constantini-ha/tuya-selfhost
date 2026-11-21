"""Bluetooth as a built-in reserve: every Wi-Fi device whose radio is heard gets one.

Nothing is set up by hand and no config entry is rewritten (that would reload the
device mid-command). What was learned lives in a store: which radio belongs to
which device, and the uuid each radio broadcast, which a faint radio may only
get through once.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta

from homeassistant.const import CONF_HOST
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store

from ..const import CONF_BLE, CONF_DEVICE_CID, CONF_DEVICE_ID, DOMAIN
from ..helpers.arp import arp_table
from .discovery import SERVICE_UUID, uuid_from_advertisement

_LOGGER = logging.getLogger(__name__)

DATA = f"{DOMAIN}_radios"
REFRESH = timedelta(minutes=10)
SAVE_DELAY = 10
_START_LOCK = asyncio.Lock()


def radio_address(mac: str) -> str:
    """A Tuya combo module answers one address above its Wi-Fi interface."""
    digits = f"{int(mac.replace(':', ''), 16) + 1:012X}"
    return ":".join(digits[i : i + 2] for i in range(0, 12, 2))


class Radios:
    """The radios of the configured devices, learned from ARP and from the air."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.reserves: dict[str, str] = {}
        self.uuids: dict[str, str] = {}
        # Radios ARP says a device should have, not heard yet; kept when ARP forgets them.
        self.expected: dict[str, str] = {}
        self.manual: set[str] = set()
        self._store: Store = Store(hass, 1, f"{DOMAIN}.ble_radios")
        self._unsubs: list = []
        self._listening = False

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        self.reserves = dict(stored.get("reserves") or {})
        self.uuids = dict(stored.get("uuids") or {})
        self._unsubs.append(
            async_track_time_interval(self.hass, self._refresh_later, REFRESH)
        )
        await self.async_refresh()

    @callback
    def async_stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        self._listening = False

    @callback
    def _refresh_later(self, _now=None) -> None:
        self.hass.async_create_background_task(
            self.async_refresh(), f"{DOMAIN} Bluetooth radios"
        )

    async def async_refresh(self) -> None:
        arp = await self.hass.async_add_executor_job(arp_table)
        for entry in self.hass.config_entries.async_entries(DOMAIN):
            config = {**entry.data, **entry.options}
            device_id = config.get(CONF_DEVICE_ID)
            if config.get(CONF_BLE):
                self.manual.add(config[CONF_BLE].upper())
            mac = arp.get(config.get(CONF_HOST) or "")
            if (
                not mac
                or not device_id
                or config.get(CONF_DEVICE_CID)
                or config.get(CONF_BLE)
                or device_id in self.reserves
            ):
                continue
            self.expected[radio_address(mac)] = device_id
        self._listen()

    @callback
    def _listen(self) -> None:
        if "bluetooth" not in self.hass.config.components:
            return
        from homeassistant.components import bluetooth

        if not self._listening:
            # Registering also replays what was heard before.
            self._unsubs.append(
                bluetooth.async_register_callback(
                    self.hass,
                    self._on_advert,
                    bluetooth.BluetoothCallbackMatcher(
                        service_data_uuid=SERVICE_UUID, connectable=True
                    ),
                    bluetooth.BluetoothScanningMode.ACTIVE,
                )
            )
            self._listening = True
            return
        for address in list(self.expected):
            info = bluetooth.async_last_service_info(
                self.hass, address, connectable=True
            )
            if info is not None:
                self._on_advert(info, None)

    @callback
    def _on_advert(self, info, _change) -> None:
        address = info.address.upper()
        device_id = self.expected.get(address)
        if (
            device_id is None
            and address not in self.manual
            and address not in self.reserves.values()
        ):
            return
        if address not in self.uuids:
            self.remember_uuid(address, uuid_from_advertisement(info))
        if device_id is not None:
            self.adopt(device_id, address)

    @callback
    def adopt(self, device_id: str, address: str) -> None:
        self.expected.pop(address, None)
        if self.reserves.get(device_id) == address:
            return
        self.reserves[device_id] = address
        self._save()
        runtime = (self.hass.data.get(DOMAIN) or {}).get(device_id) or {}
        device = runtime.get("device")
        _LOGGER.info(
            "%s also answers on Bluetooth at %s; keeping it as a reserve",
            device.name if device else device_id,
            address,
        )
        if device is not None:
            device.attach_reserve(address)

    @callback
    def remember_uuid(self, address: str, uuid: str | None) -> None:
        if uuid and self.uuids.get(address) != uuid:
            self.uuids[address] = uuid
            self._save()

    @callback
    def _save(self) -> None:
        self._store.async_delay_save(
            lambda: {"reserves": self.reserves, "uuids": self.uuids}, SAVE_DELAY
        )


async def async_start_radios(hass: HomeAssistant) -> None:
    """Start learning radios once; safe to call for every entry."""
    async with _START_LOCK:
        if DATA in hass.data:
            return
        radios = Radios(hass)
        hass.data[DATA] = radios
        await radios.async_start()


@callback
def async_stop_radios(hass: HomeAssistant) -> None:
    radios = hass.data.pop(DATA, None)
    if radios is not None:
        radios.async_stop()


def reserve_address(hass: HomeAssistant, device_id: str) -> str | None:
    radios = hass.data.get(DATA)
    return radios.reserves.get(device_id) if radios else None


def known_uuid(hass: HomeAssistant, address: str) -> str | None:
    radios = hass.data.get(DATA)
    return radios.uuids.get(address.upper()) if radios else None


def remember_uuid(hass: HomeAssistant, address: str, uuid: str | None) -> None:
    radios = hass.data.get(DATA)
    if radios is not None:
        radios.remember_uuid(address.upper(), uuid)
