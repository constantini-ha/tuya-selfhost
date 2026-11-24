"""What Home Assistant can tell about the Alexa skill that reaches it.

The skill's Lambda lives in the user's AWS account, out of sight. What is in
sight is the address it must call, the account link Alexa holds, and whether
state reports are flowing back.
"""

from __future__ import annotations

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.network import NoURLAvailableError, get_url

from .const import DOMAIN
from .remote_keys import ALEXA_ENDPOINT, _alexa_config

READY = f"{DOMAIN}_alexa_status"

# Account-link client ids, by the region whose Alexa servers hold the link.
LINK_REGIONS = {
    "https://pitangui.amazon.com/": "na",
    "https://layla.amazon.com/": "eu",
    "https://alexa.amazon.co.jp/": "fe",
}

EVENT_REGIONS = {
    "api.amazonalexa.com": "na",
    "api.eu.amazonalexa.com": "eu",
    "api.fe.amazonalexa.com": "fe",
}


@callback
def async_setup_alexa_status(hass: HomeAssistant) -> None:
    """Register the status command, once per Home Assistant run."""
    if hass.data.get(READY):
        return
    hass.data[READY] = True
    websocket_api.async_register_command(hass, websocket_alexa_status)


def _base_url(hass: HomeAssistant) -> str | None:
    try:
        return get_url(hass, allow_internal=False, allow_ip=False)
    except NoURLAvailableError:
        return None


def _region_of(endpoint) -> str | None:
    text = str(endpoint or "")
    for host, region in EVENT_REGIONS.items():
        if f"//{host}/" in text:
            return region
    return None


async def _links(hass: HomeAssistant) -> list[dict]:
    """Every account link Alexa holds, newest use first."""
    links = []
    for user in await hass.auth.async_get_users():
        for token in user.refresh_tokens.values():
            region = LINK_REGIONS.get(token.client_id or "")
            if region is None:
                continue
            used = token.last_used_at or token.created_at
            links.append(
                {
                    "region": region,
                    "user": user.name,
                    "linked_at": token.created_at.isoformat(),
                    "used_at": used.isoformat(),
                }
            )
    return sorted(links, key=lambda link: link["used_at"], reverse=True)


def _skill(hass: HomeAssistant) -> dict | None:
    config = _alexa_config(hass)
    if config is None:
        return None
    try:
        exposed = sum(
            1
            for entity_id in hass.states.async_entity_ids()
            if config.should_expose(entity_id)
        )
        return {
            "locale": config.locale,
            "can_report": bool(config.supports_auth),
            "authorized": bool(config.authorized),
            "reporting": bool(config.is_reporting_states),
            "events_region": _region_of(config.endpoint),
            "exposed": exposed,
        }
    except Exception:  # an internal reach, like the rest of the Alexa glue
        return {
            "locale": None,
            "can_report": False,
            "authorized": False,
            "reporting": False,
            "events_region": None,
            "exposed": None,
        }


async def async_alexa_status(hass: HomeAssistant) -> dict:
    """The skill as seen from here: address, account link and state reports."""
    base = _base_url(hass)
    links = await _links(hass)
    return {
        "base_url": base,
        "endpoint": f"{base}{ALEXA_ENDPOINT}" if base else None,
        "skill": _skill(hass),
        "link": links[0] if links else None,
        "links": len(links),
    }


@websocket_api.websocket_command({"type": f"{DOMAIN}/alexa/status"})
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_alexa_status(hass, connection, msg):
    """The skill's status; admin only, as it says who linked it and when."""
    connection.send_result(msg["id"], await async_alexa_status(hass))
