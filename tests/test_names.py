"""Tests for renaming from the panel, which also renames for voice."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_registry import COMPUTED_NAME
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.tuya_selfhost import LOADED_SETTINGS, async_update_entry
from custom_components.tuya_selfhost.const import DOMAIN
from custom_components.tuya_selfhost.names import NAME, voice_aliases, websocket_rename


def _alexa(exposed, pinned=()):
    config = MagicMock()
    config.should_expose.side_effect = lambda entity_id: entity_id in exposed
    config.entity_config = {entity_id: {"name": "Fixed"} for entity_id in pinned}
    return config


def _keys(hass):
    entry = MockConfigEntry(domain="zha")
    entry.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={("zha", "a4:c1:38:9a:fe:99:34:85")},
        name="Nova Digital SA-6",
    )
    registry = er.async_get(hass)
    keys = [
        registry.async_get_or_create(
            "switch",
            "zha",
            f"key_{n}",
            config_entry=entry,
            device_id=device.id,
            original_name="Interruptor",
            has_entity_name=True,
            suggested_object_id=f"suite_tecla_{n}",
        ).entity_id
        for n in (1, 2)
    ]
    return device.id, keys


async def _rename(hass, alexa, sent=True, **msg):
    connection = MagicMock()
    connection.user.is_admin = True
    announce = AsyncMock(return_value=sent)
    with (
        patch(
            "custom_components.tuya_selfhost.names._alexa_config", return_value=alexa
        ),
        patch(
            "custom_components.tuya_selfhost.names.async_announce_to_alexa", announce
        ),
    ):
        websocket_rename(
            hass, connection, {"id": 1, "type": "tuya_selfhost/rename", **msg}
        )
        await hass.async_block_till_done(wait_background_tasks=True)
    return connection, announce


def test_the_new_name_is_spoken_first():
    assert voice_aliases([COMPUTED_NAME], "Luz da cortina") == ["Luz da cortina"]
    assert voice_aliases(["Luz janela", "Cortina"], "Cortina") == ["Cortina"]
    assert voice_aliases(["Luz janela", "Janela"], None) == [COMPUTED_NAME, "Janela"]
    assert voice_aliases([], "Abajur") == ["Abajur"]
    assert NAME("  Luz  ") == "Luz"


async def test_a_key_renamed_is_renamed_for_alexa_at_once(hass):
    _, keys = _keys(hass)
    connection, announce = await _rename(
        hass, _alexa(exposed=keys), entity_id=keys[0], name="Luz da cortina"
    )

    entry = er.async_get(hass).async_get(keys[0])
    assert entry.name == "Luz da cortina"
    assert entry.aliases == ["Luz da cortina"]
    announce.assert_awaited_once_with(hass, [keys[0]])
    assert connection.send_result.call_args.args[1] == {
        "exposed": 1,
        "alexa": True,
        "pinned": [],
    }


async def test_a_device_renamed_tells_alexa_about_keys_named_after_it(hass):
    device_id, keys = _keys(hass)
    er.async_get(hass).async_update_entity(keys[0], aliases=["Luz da cortina"])
    connection, announce = await _rename(
        hass, _alexa(exposed=keys), device_id=device_id, name="Interruptor quarto"
    )

    assert dr.async_get(hass).async_get(device_id).name_by_user == "Interruptor quarto"
    announce.assert_awaited_once_with(hass, keys[1:])
    assert connection.send_result.call_args.args[1]["exposed"] == 1


async def test_a_name_fixed_in_yaml_is_reported(hass):
    _, keys = _keys(hass)
    connection, _ = await _rename(
        hass, _alexa(exposed=keys, pinned=keys[:1]), entity_id=keys[0], name="Luz"
    )

    assert connection.send_result.call_args.args[1]["pinned"] == [keys[0]]


async def test_without_alexa_only_the_name_changes(hass):
    _, keys = _keys(hass)
    connection, announce = await _rename(hass, None, entity_id=keys[1], name=None)

    assert er.async_get(hass).async_get(keys[1]).aliases == [COMPUTED_NAME]
    announce.assert_not_awaited()
    assert connection.send_result.call_args.args[1] == {
        "exposed": 0,
        "alexa": False,
        "pinned": [],
    }


async def test_an_unknown_key_is_an_error(hass):
    connection, _ = await _rename(hass, None, entity_id="switch.gone", name="X")

    assert connection.send_error.call_args.args[1] == "not_found"


def _wifi(hass):
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Interruptor cozinha",
        data={"device_id": "ebb7fa352594ef81c6fake", "host": "10.0.0.8"},
    )
    entry.add_to_hass(hass)
    device = dr.async_get(hass).async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={(DOMAIN, "ebb7fa352594ef81c6fake")},
        name="Interruptor cozinha",
    )
    key = (
        er.async_get(hass)
        .async_get_or_create(
            "switch",
            DOMAIN,
            "ebb7fa352594ef81c6fake-switch_1",
            config_entry=entry,
            device_id=device.id,
            original_name="Interruptor 1",
            has_entity_name=True,
        )
        .entity_id
    )
    running = SimpleNamespace(name="Interruptor cozinha")
    hass.data.setdefault(DOMAIN, {})["ebb7fa352594ef81c6fake"] = {"device": running}
    return entry, device.id, key, running


async def test_a_wifi_device_renamed_keeps_running_under_the_new_name(hass):
    entry, device_id, key, running = _wifi(hass)
    dr.async_get(hass).async_update_device(device_id, name_by_user="Old HA name")
    connection, announce = await _rename(
        hass, _alexa(exposed=[key]), entry_id=entry.entry_id, name="Luz da cozinha"
    )

    device = dr.async_get(hass).async_get(device_id)
    assert entry.title == "Luz da cozinha"
    assert (device.name, device.name_by_user) == ("Luz da cozinha", None)
    assert running.name == "Luz da cozinha"
    announce.assert_awaited_once_with(hass, [key])
    assert connection.send_result.call_args.args[1]["exposed"] == 1


async def test_a_wifi_device_cannot_lose_its_name(hass):
    entry, *_ = _wifi(hass)
    connection, _ = await _rename(hass, None, entry_id=entry.entry_id, name=None)

    assert connection.send_error.call_args.args[1] == "invalid_format"
    assert entry.title == "Interruptor cozinha"


async def test_a_new_title_alone_does_not_reconnect_the_device(hass):
    entry, *_ = _wifi(hass)
    hass.data[LOADED_SETTINGS] = {entry.entry_id: {**entry.data, **entry.options}}
    with patch.object(hass.config_entries, "async_schedule_reload") as reload:
        await async_update_entry(hass, entry)
        reload.assert_not_called()
        hass.data[LOADED_SETTINGS][entry.entry_id] = {"host": "10.0.0.9"}
        await async_update_entry(hass, entry)
        reload.assert_called_once_with(entry.entry_id)
