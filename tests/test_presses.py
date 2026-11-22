"""Tests for the press table the panel names button presses by."""

import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock, patch

from custom_components.tuya_selfhost.presses import websocket_presses, zha_presses

TABLE = {
    ("device_offline", "device_offline"): {"device_event_type": "device_offline"},
    ("remote_button_short_press", "button"): {"command": "toggle"},
    ("remote_button_double_press", "button"): {"command": "on"},
}


def _zha(device=None, cache=None):
    helpers = ModuleType("homeassistant.components.zha.helpers")

    def proxy(hass, device_id):
        if device is None:
            raise ValueError(device_id)
        return SimpleNamespace(device=device)

    helpers.async_get_zha_device_proxy = proxy
    helpers.get_zha_data = lambda hass: SimpleNamespace(
        device_trigger_cache=cache or {}
    )
    return patch.dict(sys.modules, {"homeassistant.components.zha.helpers": helpers})


def test_each_press_comes_with_the_fields_that_mean_it(hass):
    with _zha(device=SimpleNamespace(device_automation_triggers=TABLE)):
        assert zha_presses(hass, "dev1") == [
            {
                "type": "remote_button_short_press",
                "subtype": "button",
                "data": {"command": "toggle"},
            },
            {
                "type": "remote_button_double_press",
                "subtype": "button",
                "data": {"command": "on"},
            },
        ]


def test_a_device_not_up_yet_is_read_from_zha_cache(hass):
    with _zha(cache={"dev1": ("a4:59", TABLE)}):
        assert len(zha_presses(hass, "dev1")) == 2
        assert zha_presses(hass, "other") == []


def test_the_command_answers_with_the_table(hass):
    connection = MagicMock()
    with _zha(device=SimpleNamespace(device_automation_triggers=TABLE)):
        websocket_presses(
            hass,
            connection,
            {"id": 4, "type": "tuya_selfhost/presses", "device_id": "dev1"},
        )
    assert connection.send_result.call_args.args[0] == 4
    assert [press["data"] for press in connection.send_result.call_args.args[1]] == [
        {"command": "toggle"},
        {"command": "on"},
    ]
