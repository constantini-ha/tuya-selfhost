"""Tests for what the panel shows about the Alexa skill."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import patch

from custom_components.tuya_selfhost import alexa_status
from custom_components.tuya_selfhost.alexa_status import async_alexa_status

LINKED = datetime(2026, 11, 5, 23, 37, tzinfo=UTC)
USED = datetime(2026, 11, 24, 18, 8, tzinfo=UTC)


def _user(name, *tokens):
    return SimpleNamespace(
        name=name,
        refresh_tokens={str(i): token for i, token in enumerate(tokens)},
    )


def _token(client_id, created=LINKED, used=USED):
    return SimpleNamespace(client_id=client_id, created_at=created, last_used_at=used)


def _config(**over):
    fields = {
        "locale": "pt-BR",
        "supports_auth": True,
        "authorized": True,
        "is_reporting_states": True,
        "endpoint": "https://api.amazonalexa.com/v3/events",
        "should_expose": lambda entity_id: entity_id.startswith("switch."),
    }
    fields.update(over)
    return SimpleNamespace(**fields)


async def _status(hass, users, config=None, url="https://home.example.com"):
    async def users_of():
        return users

    def get_url(hass, **kwargs):
        if url is None:
            raise alexa_status.NoURLAvailableError
        return url

    with (
        patch.object(hass.auth, "async_get_users", users_of),
        patch.object(alexa_status, "_alexa_config", lambda hass: config),
        patch.object(alexa_status, "get_url", get_url),
    ):
        return await async_alexa_status(hass)


async def test_a_linked_skill_with_reports_shows_all_of_it(hass):
    hass.states.async_set("switch.a", "on")
    hass.states.async_set("switch.b", "off")
    hass.states.async_set("light.c", "on")
    older = _token("https://pitangui.amazon.com/", used=LINKED)
    users = [
        _user("Ana", _token("https://home-assistant.io/iOS")),
        _user("Gustavo", older, _token("https://pitangui.amazon.com/")),
    ]
    status = await _status(hass, users, _config())
    assert status["base_url"] == "https://home.example.com"
    assert status["endpoint"] == "https://home.example.com/api/alexa/smart_home"
    assert status["skill"] == {
        "locale": "pt-BR",
        "can_report": True,
        "authorized": True,
        "reporting": True,
        "events_region": "na",
        "exposed": 2,
    }
    assert status["link"] == {
        "region": "na",
        "user": "Gustavo",
        "linked_at": LINKED.isoformat(),
        "used_at": USED.isoformat(),
    }
    assert status["links"] == 2


async def test_nothing_set_up_says_so(hass):
    status = await _status(hass, [_user("Ana")], None, url=None)
    assert status == {
        "base_url": None,
        "endpoint": None,
        "skill": None,
        "link": None,
        "links": 0,
    }


async def test_a_link_never_used_counts_from_when_it_was_made(hass):
    token = _token("https://layla.amazon.com/", used=None)
    status = await _status(hass, [_user("Ana", token)], _config(endpoint=None))
    assert status["link"]["region"] == "eu"
    assert status["link"]["used_at"] == LINKED.isoformat()
    assert status["skill"]["events_region"] is None


async def test_an_alexa_config_that_changed_shape_does_not_break_the_page(hass):
    def broken(entity_id):
        raise AttributeError(entity_id)

    hass.states.async_set("switch.a", "on")
    status = await _status(hass, [], _config(should_expose=broken))
    assert status["skill"]["exposed"] is None
    assert status["skill"]["reporting"] is False


async def test_the_command_answers_with_the_status(hass, hass_ws_client):
    alexa_status.async_setup_alexa_status(hass)
    alexa_status.async_setup_alexa_status(hass)
    client = await hass_ws_client(hass)
    with patch.object(alexa_status, "_alexa_config", lambda hass: None):
        await client.send_json_auto_id({"type": "tuya_selfhost/alexa/status"})
        reply = await client.receive_json()
    assert reply["success"]
    assert reply["result"]["skill"] is None
