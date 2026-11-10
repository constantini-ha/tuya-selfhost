"""Signing in to Tuya from the panel.

Knowing whether a device still reaches the internet means asking Tuya, and that
needs an account. The only way in used to be the add-device form, which asks
for a device nobody wanted to add.
"""

import logging
from typing import Any

import segno
import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from .cloud import Cloud
from .const import DOMAIN, TUYA_RESPONSE_MSG

_LOGGER = logging.getLogger(__name__)

LOGIN_KEY = "cloud_login"
QR_PREFIX = "tuyaSmart--qrLogin?token="


async def async_setup_cloud_api(hass: HomeAssistant) -> None:
    """Register the sign-in commands the panel calls."""
    websocket_api.async_register_command(hass, websocket_cloud_status)
    websocket_api.async_register_command(hass, websocket_cloud_qr)
    websocket_api.async_register_command(hass, websocket_cloud_login)
    websocket_api.async_register_command(hass, websocket_cloud_logout)


def _login_state(hass: HomeAssistant) -> dict[str, Any]:
    """A sign-in in progress: the code lives on a Cloud, which has to outlive a call."""
    return hass.data.setdefault(DOMAIN, {}).setdefault(LOGIN_KEY, {})


def _qr_rows(data: str) -> list[str]:
    """The code as rows of 0 and 1, for the panel to draw."""
    return ["".join(str(module) for module in row) for row in segno.make(data, error="m").matrix]


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/cloud/status"})
@websocket_api.callback
def websocket_cloud_status(hass, connection, msg) -> None:
    """Whether an account is signed in, and which one."""
    cached = (hass.data.get(DOMAIN) or {}).get("auth_cache") or {}
    connection.send_result(
        msg["id"],
        {"authenticated": bool(cached), "user_code": cached.get("user_code", "")},
    )


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/cloud/qr",
        vol.Required("user_code"): str,
    }
)
@websocket_api.async_response
async def websocket_cloud_qr(hass, connection, msg) -> None:
    """Ask Tuya for a sign-in code and hand back the square to scan."""
    state = _login_state(hass)
    cloud = Cloud(hass)
    token = await cloud.async_get_qr_code(msg["user_code"].strip())
    if not token:
        state.clear()
        error = cloud.last_error or {}
        connection.send_result(
            msg["id"], {"error": error.get(TUYA_RESPONSE_MSG) or "unknown"}
        )
        return
    state["cloud"] = cloud
    state["token"] = token
    connection.send_result(msg["id"], {"rows": _qr_rows(QR_PREFIX + token)})


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/cloud/login"})
@websocket_api.async_response
async def websocket_cloud_login(hass, connection, msg) -> None:
    """Ask Tuya whether the code has been scanned yet."""
    state = _login_state(hass)
    cloud = state.get("cloud")
    if cloud is None or not state.get("token"):
        connection.send_result(msg["id"], {"ok": False, "error": "no_code"})
        return
    ok = await cloud.async_poll_login()
    if ok:
        state.clear()
        connection.send_result(msg["id"], {"ok": True})
        return
    error = cloud.last_error or {}
    connection.send_result(
        msg["id"], {"ok": False, "error": error.get(TUYA_RESPONSE_MSG) or "waiting"}
    )


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/cloud/logout"})
@websocket_api.async_response
async def websocket_cloud_logout(hass, connection, msg) -> None:
    """Forget the account."""
    _login_state(hass).clear()
    Cloud(hass).logout()
    connection.send_result(msg["id"], {"ok": True})
