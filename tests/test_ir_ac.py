"""Air conditioner codes written from a learned TCL112 code."""

import base64
import struct
from unittest.mock import AsyncMock, Mock, patch

import pytest
from homeassistant.components.climate import HVACMode

from custom_components.tuya_selfhost import ir_ac
from custom_components.tuya_selfhost.remote_keys import RemoteAirConditioner

FIRST = [0x23, 0xCB, 0x26, 0x02, 0x00, 0x40, 0, 0, 0, 0, 0, 0, 0, 0x65]
COOL_20 = [0x23, 0xCB, 0x26, 0x01, 0x00, 0x24, 0x03, 0x0B, 0, 0, 0, 0, 0x80, 0xC7]


def _frame(state, last):
    timings = [3060, 1580]
    for byte in state:
        for bit in range(8):
            timings += [510, 1080 if byte >> bit & 1 else 315]
    return timings + [510, last]


def _code(state):
    timings = _frame(FIRST, 65000) + _frame(state, 0)
    return base64.b64encode(struct.pack(f"<{len(timings)}H", *timings)).decode()


def test_reads_the_state_a_code_carries():
    assert ir_ac.recognize(_code(COOL_20)) == ir_ac.AcState(True, "cool", 20, "auto")


@pytest.mark.parametrize(
    "code", ["", "not base64!", base64.b64encode(b"\x00" * 10).decode()]
)
def test_other_codes_are_not_air_conditioners(code):
    assert ir_ac.recognize(code) is None


def test_a_bad_checksum_is_not_recognized():
    assert ir_ac.recognize(_code([*COOL_20[:13], 0x00])) is None


def test_writes_every_mode_fan_and_temperature():
    template = _code(COOL_20)
    for mode in ir_ac.MODES:
        for fan in ir_ac.FANS:
            for degrees in (16, 23, 31):
                wanted = ir_ac.AcState(True, mode, degrees, fan)
                assert ir_ac.recognize(ir_ac.encode(template, wanted)) == wanted


def test_off_keeps_the_rest_of_the_state():
    code = ir_ac.encode(_code(COOL_20), ir_ac.AcState(False, "cool", 22, "high"))
    assert ir_ac.recognize(code) == ir_ac.AcState(False, "cool", 22, "high")


def test_temperature_is_kept_in_range():
    code = ir_ac.encode(_code(COOL_20), ir_ac.AcState(True, "cool", 40, "auto"))
    assert ir_ac.recognize(code).temperature == ir_ac.MAX_TEMP


def test_encode_refuses_other_codes():
    with pytest.raises(ValueError):
        ir_ac.encode("AAAA", ir_ac.AcState(True, "cool", 22, "auto"))


def test_template_prefers_a_powered_on_code():
    off = _code([*COOL_20[:5], 0x20, *COOL_20[6:13], (sum(COOL_20[:13]) - 4) & 0xFF])
    codes = {"off": off, "junk": "AAAA", "on": [_code(COOL_20)]}
    code, state = ir_ac.template_of(codes, [])
    assert state.power and code == codes["on"][0]
    assert ir_ac.template_of({"off": off}, [])[1].power is False
    assert ir_ac.template_of({"junk": "AAAA"}, []) is None


def _entity():
    control = {"id": "ac_1", "name": "Ar condicionado", "device": "ac"}
    with patch(
        "custom_components.tuya_selfhost.remote_keys._control_device", return_value={}
    ):
        entity = RemoteAirConditioner(
            Mock(entry_id="e1"),
            Mock(),
            "remote.blaster",
            control,
            _code(COOL_20),
            ir_ac.recognize(_code(COOL_20)),
        )
    entity.hass = Mock()
    entity.hass.services.async_call = AsyncMock()
    entity.async_write_ha_state = Mock()
    return entity


def ir_ac_modes():
    return [
        HVACMode.COOL,
        HVACMode.HEAT,
        HVACMode.DRY,
        HVACMode.FAN_ONLY,
        HVACMode.AUTO,
    ]


async def test_settings_from_the_panel_shape_the_modes():
    entity = _entity()
    entity.apply_settings({"modes": ["cool", "dry"], "temp_modes": ["cool", "heat"]})
    assert entity.hvac_modes == [HVACMode.OFF, HVACMode.COOL, HVACMode.DRY]
    # A mode the unit does not have cannot count for temperature.
    assert entity.extra_state_attributes["temp_modes"] == ["cool"]
    entity.async_write_ha_state.assert_called_once()


def _sent(entity):
    data = entity.hass.services.async_call.call_args.args[2]
    assert data["entity_id"] == "remote.blaster"
    return ir_ac.recognize(data["command"].removeprefix("b64:"))


async def test_climate_starts_off_with_the_learned_settings():
    entity = _entity()
    assert entity.entity_id == "climate.tuya_remote_ar_condicionado"
    assert entity.hvac_mode == HVACMode.OFF
    assert entity.target_temperature == 20
    assert entity.extra_state_attributes == {
        "tuya_control": "ac_1",
        "last_mode": "cool",
        "temp_modes": ["cool", "heat", "auto"],
    }
    assert entity.hvac_modes == [HVACMode.OFF, *ir_ac_modes()]


async def test_climate_sends_the_whole_state():
    entity = _entity()
    await entity.async_set_hvac_mode(HVACMode.HEAT)
    assert _sent(entity) == ir_ac.AcState(True, "heat", 20, "auto")
    await entity.async_set_temperature(temperature=24)
    assert _sent(entity) == ir_ac.AcState(True, "heat", 24, "auto")
    await entity.async_set_fan_mode("high")
    assert _sent(entity) == ir_ac.AcState(True, "heat", 24, "high")
    await entity.async_turn_off()
    assert _sent(entity) == ir_ac.AcState(False, "heat", 24, "high")
    assert entity.hvac_mode == HVACMode.OFF


async def test_climate_does_not_switch_on_while_adjusting_off():
    entity = _entity()
    await entity.async_set_temperature(temperature=18)
    await entity.async_set_fan_mode("low")
    entity.hass.services.async_call.assert_not_called()
    await entity.async_turn_on()
    assert _sent(entity) == ir_ac.AcState(True, "cool", 18, "low")
    assert entity.hvac_mode == HVACMode.COOL


async def test_temperature_with_a_mode_switches_to_it():
    entity = _entity()
    await entity.async_set_temperature(temperature=22, hvac_mode=HVACMode.DRY)
    assert _sent(entity) == ir_ac.AcState(True, "dry", 22, "auto")


async def test_restores_the_last_state():
    entity = _entity()
    last = Mock(
        state="off",
        attributes={"temperature": 23, "fan_mode": "medium", "last_mode": "heat"},
    )
    with patch.object(
        RemoteAirConditioner, "async_get_last_state", AsyncMock(return_value=last)
    ):
        await entity.async_added_to_hass()
    assert (entity.hvac_mode, entity.target_temperature, entity.fan_mode) == (
        HVACMode.OFF,
        23,
        "medium",
    )
    await entity.async_turn_on()
    assert _sent(entity) == ir_ac.AcState(True, "heat", 23, "medium")

    entity = _entity()
    last = Mock(state="dry", attributes={})
    with patch.object(
        RemoteAirConditioner, "async_get_last_state", AsyncMock(return_value=last)
    ):
        await entity.async_added_to_hass()
    assert entity.hvac_mode == HVACMode.DRY
