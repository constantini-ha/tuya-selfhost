"""Tests for the notice each automation run gives."""

from unittest.mock import AsyncMock, patch

from homeassistant.components import persistent_notification
from homeassistant.core import Context, ServiceCall
from homeassistant.helpers import entity_registry as er

from custom_components.tuya_selfhost.notices import (
    Notices,
    notice_text,
)


def _phones(hass, *services):
    calls = []

    async def record(call: ServiceCall):
        calls.append((call.service, dict(call.data)))

    for service in services:
        hass.services.async_register("notify", service, record)
    return calls


def _automation(hass, unique_id, object_id):
    return (
        er.async_get(hass)
        .async_get_or_create(
            "automation", "automation", unique_id, suggested_object_id=object_id
        )
        .entity_id
    )


async def _run(hass, notices, entity_id, outcome):
    with patch.object(Notices, "_outcome", AsyncMock(return_value=outcome)):
        notices._on_run(
            type(
                "Event",
                (),
                {
                    "data": {"entity_id": entity_id, "name": "Lamp at night"},
                    "context": Context(),
                },
            )()
        )
        await hass.async_block_till_done(wait_background_tasks=True)


def test_the_text_says_how_it_went():
    assert notice_text("pt-BR", "finished", None).startswith("Feito às ")
    assert notice_text("es", "error", "Abajur no respondió").startswith(
        "No funcionó a las "
    )
    assert notice_text("en", "error", "Lamp did not answer").endswith(
        ": Lamp did not answer"
    )
    assert notice_text("pt-BR", None, None).startswith("Rodou às ")
    assert notice_text("de", "aborted", None).startswith("Stopped before the end")


async def test_panel_automations_notify_unless_turned_off(hass):
    notices = Notices(hass)
    assert notices.setting("tuya_auto_lamp") == {"on": True, "phones": None}
    assert notices.setting("1778986087558")["on"] is False
    await notices.async_set("tuya_auto_lamp", False, None)
    assert notices.setting("tuya_auto_lamp")["on"] is False


async def test_a_run_notifies_home_assistant_and_every_phone(hass):
    calls = _phones(hass, "mobile_app_iphone", "mobile_app_iphone_ana", "other")
    entity_id = _automation(hass, "tuya_auto_lamp", "lamp")
    notices = Notices(hass)

    await _run(hass, notices, entity_id, ("finished", None))

    shown = persistent_notification._async_get_or_create_notifications(hass)
    notice = shown["tuya_selfhost_tuya_auto_lamp"]
    assert notice["title"] == "Lamp at night"
    assert notice["message"].startswith("Done at ")
    assert sorted(service for service, _ in calls) == [
        "mobile_app_iphone",
        "mobile_app_iphone_ana",
    ]
    assert calls[0][1]["data"]["tag"] == "tuya_selfhost_tuya_auto_lamp"


async def test_only_the_chosen_phones_get_it(hass):
    calls = _phones(hass, "mobile_app_iphone", "mobile_app_iphone_ana")
    entity_id = _automation(hass, "tuya_auto_lamp", "lamp")
    notices = Notices(hass)
    await notices.async_set(
        "tuya_auto_lamp", True, ["mobile_app_iphone", "mobile_app_gone"]
    )

    await _run(hass, notices, entity_id, ("error", "Abajur não respondeu."))

    assert [service for service, _ in calls] == ["mobile_app_iphone"]
    assert "Abajur não respondeu." in calls[0][1]["message"]


async def test_quiet_when_off_or_replaced_by_a_newer_run(hass):
    calls = _phones(hass, "mobile_app_iphone")
    other = _automation(hass, "1778986087558", "garage")
    lamp = _automation(hass, "tuya_auto_lamp", "lamp")
    notices = Notices(hass)

    await _run(hass, notices, other, ("finished", None))
    await _run(hass, notices, lamp, ("cancelled", None))

    assert calls == []
    assert persistent_notification._async_get_or_create_notifications(hass) == {}


async def test_the_outcome_comes_from_the_trace_once_it_stops(hass):
    notices = Notices(hass)
    context = Context()
    runs = iter(
        [
            {"state": "running"},
            {
                "state": "stopped",
                "script_execution": "error",
                "error": "Abajur não respondeu.",
            },
        ]
    )
    with (
        patch(
            "homeassistant.components.trace.util.async_list_contexts",
            AsyncMock(return_value={context.id: {"run_id": "r1"}}),
        ),
        patch(
            "homeassistant.components.trace.util.async_get_trace",
            AsyncMock(side_effect=lambda *_: next(runs)),
        ),
        patch("custom_components.tuya_selfhost.notices.asyncio.sleep", AsyncMock()),
    ):
        assert await notices._outcome("tuya_auto_lamp", context.id) == (
            "error",
            "Abajur não respondeu.",
        )


async def test_without_a_trace_it_only_says_it_ran(hass):
    notices = Notices(hass)
    with (
        patch(
            "homeassistant.components.trace.util.async_list_contexts",
            AsyncMock(return_value={}),
        ),
        patch(
            "custom_components.tuya_selfhost.notices.asyncio.sleep", AsyncMock()
        ) as sleep,
    ):
        assert await notices._outcome("tuya_auto_lamp", "ctx") == (None, None)
    assert sleep.await_count == 6
