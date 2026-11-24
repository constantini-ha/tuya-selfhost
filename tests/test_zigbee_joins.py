"""Tests for the joins the pairing screen follows."""

from unittest.mock import patch

from homeassistant.helpers.dispatcher import async_dispatcher_send

from custom_components.tuya_selfhost import zigbee_joins
from custom_components.tuya_selfhost.zigbee_joins import (
    GATEWAY_MESSAGE,
    async_setup_zigbee_joins,
    recent_joins,
)

IEEE = "0c:ef:f6:ff:fe:5b:ba:d7"


def _say(hass, kind, **info):
    async_dispatcher_send(hass, GATEWAY_MESSAGE, {"type": kind, "device_info": info})


async def test_a_join_is_followed_through_its_interview(hass):
    async_setup_zigbee_joins(hass)
    async_setup_zigbee_joins(hass)
    _say(hass, "device_joined", ieee=IEEE, nwk=0xB409)
    await hass.async_block_till_done()
    (join,) = recent_joins(hass)["joins"]
    assert (join["ieee"], join["stage"]) == (IEEE, "joined")
    _say(
        hass,
        "raw_device_initialized",
        ieee=IEEE,
        model="SNZB-01P",
        manufacturer="eWeLink",
    )
    await hass.async_block_till_done()
    (join,) = recent_joins(hass)["joins"]
    assert (join["stage"], join["model"], join["manufacturer"]) == (
        "identified",
        "SNZB-01P",
        "eWeLink",
    )
    _say(hass, "device_fully_initialized", ieee=IEEE)
    await hass.async_block_till_done()
    assert recent_joins(hass)["joins"][0]["stage"] == "done"


async def test_other_messages_and_ones_without_a_device_are_ignored(hass):
    async_setup_zigbee_joins(hass)
    _say(hass, "device_removed", ieee=IEEE)
    _say(hass, "device_joined")
    async_dispatcher_send(hass, GATEWAY_MESSAGE, {"type": "device_joined"})
    await hass.async_block_till_done()
    assert recent_joins(hass)["joins"] == []


async def test_old_joins_are_forgotten(hass):
    async_setup_zigbee_joins(hass)
    with patch.object(zigbee_joins.time, "time", return_value=1000.0):
        _say(hass, "device_joined", ieee=IEEE)
        await hass.async_block_till_done()
    with patch.object(zigbee_joins.time, "time", return_value=1000.0 + 16 * 60):
        answer = recent_joins(hass)
    assert answer == {"now": int((1000 + 16 * 60) * 1000), "joins": []}


async def test_the_command_answers_with_the_joins(hass, hass_ws_client):
    async_setup_zigbee_joins(hass)
    _say(hass, "device_joined", ieee=IEEE)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "tuya_selfhost/zigbee/joins"})
    reply = await client.receive_json()
    assert reply["success"]
    assert reply["result"]["joins"][0]["ieee"] == IEEE


def test_recent_joins_before_setup_is_empty(hass):
    assert recent_joins(hass)["joins"] == []
