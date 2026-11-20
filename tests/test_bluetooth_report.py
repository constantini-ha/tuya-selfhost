"""Tests for the Bluetooth part of the network report."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from custom_components.tuya_selfhost.services import _bluetooth_report


def _entry(title, host, ble=None, cid=None):
    data = {"host": host}
    if cid:
        data["device_cid"] = cid
    return SimpleNamespace(title=title, data=data, options={"ble": ble} if ble else {})


def _heard(address, rssi):
    return SimpleNamespace(
        address=address,
        name="TY",
        rssi=rssi,
        service_uuids=[],
        service_data={},
        manufacturer_data={},
    )


def test_every_wifi_device_gets_a_row():
    entries = [
        _entry("Near", "10.0.0.2", ble="AA:00:00:00:00:02"),
        _entry("Reserve away", "10.0.0.3", ble="AA:00:00:00:00:04"),
        _entry("Fence", "10.0.0.4"),
        _entry("No mac yet", "10.0.0.5"),
        _entry("Behind gateway", "10.0.0.6", cid="child"),
    ]
    arp = {
        "10.0.0.2": "AA:00:00:00:00:01",
        "10.0.0.3": "AA:00:00:00:00:03",
        "10.0.0.4": "C4:82:E1:BC:A1:D1",
    }
    bluetooth = MagicMock()
    bluetooth.async_discovered_service_info.return_value = [_heard("AA:00:00:00:00:02", -60)]
    bluetooth.async_scanner_count.return_value = 1
    with patch.dict(
        "sys.modules", {"homeassistant.components.bluetooth": bluetooth}
    ), patch("homeassistant.components.bluetooth", bluetooth, create=True):
        report = _bluetooth_report(MagicMock(), entries, arp)

    rows = [(r["name"], r["address"], r["in_range"], r["reserve"]) for r in report["radios"]]
    assert rows == [
        ("Near", "AA:00:00:00:00:02", True, True),
        ("Reserve away", "AA:00:00:00:00:04", False, True),
        ("Fence", "C4:82:E1:BC:A1:D2", False, False),
        ("No mac yet", None, False, False),
    ]
