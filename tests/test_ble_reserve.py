"""Tests for the Bluetooth reserve every Wi-Fi device gets on its own."""

import hashlib
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from Crypto.Cipher import AES
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.tuya_selfhost.ble import transport as transport_module
from custom_components.tuya_selfhost.ble.discovery import MANUFACTURER_ID, SERVICE_UUID
from custom_components.tuya_selfhost.ble.reserve import (
    DATA,
    Radios,
    known_uuid,
    radio_address,
)
from custom_components.tuya_selfhost.ble.transport import TuyaBleTransport
from custom_components.tuya_selfhost.const import DOMAIN

FENCE_RADIO = "C4:82:E1:BC:A1:D2"
UUID = "tuya5f0b9a3e21c4"


def _advert(address, uuid=None):
    """What a Tuya combo module broadcasts; the uuid only comes in the scan response."""
    payload = b"\x01" + b"productkey123456"
    manufacturer = {}
    if uuid:
        key = hashlib.md5(payload[1:]).digest()  # noqa: S324 - the protocol uses md5
        manufacturer[MANUFACTURER_ID] = b"\x00" * 6 + AES.new(
            key, AES.MODE_CBC, key
        ).encrypt(uuid.encode())
    return SimpleNamespace(
        address=address,
        service_data={SERVICE_UUID: payload},
        manufacturer_data=manufacturer,
    )


def test_radio_sits_one_address_above_wifi():
    assert radio_address("C4:82:E1:BC:A1:D1") == FENCE_RADIO
    assert radio_address("aa:00:00:00:00:ff") == "AA:00:00:00:01:00"


async def test_a_radio_heard_becomes_the_running_devices_reserve(hass):
    radios = Radios(hass)
    device = MagicMock()
    hass.data[DOMAIN] = {"fence": {"device": device}}
    radios.expected[FENCE_RADIO] = "fence"

    radios._on_advert(_advert(FENCE_RADIO), None)

    assert radios.reserves == {"fence": FENCE_RADIO}
    assert FENCE_RADIO not in radios.expected
    device.attach_reserve.assert_called_once_with(FENCE_RADIO)


async def test_the_uuid_is_kept_the_one_time_it_gets_through(hass):
    radios = Radios(hass)
    radios.reserves["fence"] = FENCE_RADIO

    radios._on_advert(_advert(FENCE_RADIO, UUID), None)
    radios._on_advert(_advert(FENCE_RADIO), None)

    assert radios.uuids == {FENCE_RADIO: UUID}


async def test_strangers_are_ignored(hass):
    radios = Radios(hass)

    radios._on_advert(_advert("11:22:33:44:55:66", UUID), None)

    assert radios.reserves == {}
    assert radios.uuids == {}


async def test_refresh_expects_the_radio_of_each_wifi_device(hass):
    for title, data, options in [
        ("Fence", {"device_id": "fence", "host": "10.0.0.4"}, {}),
        (
            "Manual",
            {"device_id": "manual", "host": "10.0.0.5"},
            {"ble": "AA:BB:CC:DD:EE:FF"},
        ),
        ("Child", {"device_id": "gw", "host": "10.0.0.6", "device_cid": "c1"}, {}),
        ("Offline", {"device_id": "off", "host": "10.0.0.7"}, {}),
        ("Known", {"device_id": "known", "host": "10.0.0.8"}, {}),
    ]:
        MockConfigEntry(
            domain=DOMAIN, title=title, data=data, options=options
        ).add_to_hass(hass)
    radios = Radios(hass)
    radios.reserves["known"] = "00:00:00:00:00:09"
    arp = {
        "10.0.0.4": "C4:82:E1:BC:A1:D1",
        "10.0.0.5": "AA:BB:CC:DD:EE:FE",
        "10.0.0.6": "AA:00:00:00:00:06",
        "10.0.0.8": "AA:00:00:00:00:08",
    }
    with patch(
        "custom_components.tuya_selfhost.ble.reserve.arp_table", return_value=arp
    ):
        await radios.async_refresh()

    assert radios.expected == {FENCE_RADIO: "fence"}
    assert radios.manual == {"AA:BB:CC:DD:EE:FF"}


async def test_credentials_fall_back_to_the_uuid_heard_before(hass):
    radios = Radios(hass)
    hass.data[DATA] = radios
    transport = TuyaBleTransport(hass, FENCE_RADIO, "fence", "0123456789abcdef")

    with pytest.raises(ConnectionError):
        transport._credentials(_advert(FENCE_RADIO))

    assert transport._credentials(_advert(FENCE_RADIO, UUID)).uuid == UUID
    assert known_uuid(hass, FENCE_RADIO) == UUID
    assert transport._credentials(_advert(FENCE_RADIO)).uuid == UUID


async def test_a_silent_radio_gets_a_moment_before_giving_up(hass):
    transport = TuyaBleTransport(hass, FENCE_RADIO, "fence", "0123456789abcdef")
    bluetooth = MagicMock()
    bluetooth.async_ble_device_from_address.return_value = None

    async def silent(*_args):
        raise TimeoutError

    bluetooth.async_process_advertisements = MagicMock(side_effect=silent)
    with patch.object(transport_module, "bluetooth", bluetooth):
        with pytest.raises(ConnectionError, match="out of Bluetooth range"):
            await transport._async_connect()

    assert bluetooth.async_process_advertisements.call_args.args[4] == (
        transport_module.HEAR_TIMEOUT
    )
