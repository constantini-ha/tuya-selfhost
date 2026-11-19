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
from homeassistant.config_entries import SOURCE_USER
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers.storage import Store

from .cloud import Cloud
from .const import (
    CONF_DEVICE_CID,
    CONF_DEVICE_ID,
    CONF_LOCAL_KEY,
    DOMAIN,
    TUYA_RESPONSE_MSG,
)

_LOGGER = logging.getLogger(__name__)

LOGIN_KEY = "cloud_login"
QR_PREFIX = "tuyaSmart--qrLogin?token="
LAST_CODE_KEY = "last_user_code"
LAST_CODE_STORE_KEY = "tuya_selfhost_last_user_code"


async def async_setup_cloud_api(hass: HomeAssistant) -> None:
    """Register the sign-in commands the panel calls."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if "last_code_store" not in domain_data:
        store = Store(hass, 1, LAST_CODE_STORE_KEY)
        domain_data["last_code_store"] = store
        domain_data[LAST_CODE_KEY] = (await store.async_load() or {}).get("user_code", "")
    websocket_api.async_register_command(hass, websocket_cloud_status)
    websocket_api.async_register_command(hass, websocket_cloud_qr)
    websocket_api.async_register_command(hass, websocket_cloud_login)
    websocket_api.async_register_command(hass, websocket_cloud_logout)
    websocket_api.async_register_command(hass, websocket_cloud_inspect)
    websocket_api.async_register_command(hass, websocket_cloud_ble_probe)
    websocket_api.async_register_command(hass, websocket_cloud_devices)
    websocket_api.async_register_command(hass, websocket_cloud_add)


def _login_state(hass: HomeAssistant) -> dict[str, Any]:
    """A sign-in in progress: the code lives on a Cloud, which has to outlive a call."""
    return hass.data.setdefault(DOMAIN, {}).setdefault(LOGIN_KEY, {})


def _remember_code(hass: HomeAssistant, user_code: str) -> None:
    """Keep the last code Tuya accepted, or forget it when given an empty one."""
    hass.data[DOMAIN][LAST_CODE_KEY] = user_code
    hass.data[DOMAIN]["last_code_store"].async_delay_save(
        lambda: {"user_code": hass.data[DOMAIN].get(LAST_CODE_KEY, "")}, 1
    )


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
        {
            "authenticated": bool(cached),
            "user_code": (hass.data.get(DOMAIN) or {}).get(LAST_CODE_KEY, ""),
        },
    )


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/cloud/qr",
        vol.Required("user_code"): str,
        vol.Optional("remember", default=True): bool,
    }
)
@websocket_api.async_response
async def websocket_cloud_qr(hass, connection, msg) -> None:
    """Ask Tuya for a sign-in code and hand back the square to scan."""
    state = _login_state(hass)
    cloud = Cloud(hass)
    user_code = msg["user_code"].strip()
    token = await cloud.async_get_qr_code(user_code)
    if not token:
        state.clear()
        error = cloud.last_error or {}
        connection.send_result(
            msg["id"], {"error": error.get(TUYA_RESPONSE_MSG) or "unknown"}
        )
        return
    state["cloud"] = cloud
    state["token"] = token
    _remember_code(hass, user_code if msg["remember"] else "")
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


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/cloud/inspect",
        vol.Required("device_id"): str,
    }
)
@websocket_api.async_response
async def websocket_cloud_inspect(hass, connection, msg) -> None:
    """Describe one device of the account, to tell what it would take to support it."""
    if not (hass.data.get(DOMAIN) or {}).get("auth_cache"):
        connection.send_result(msg["id"], {"error": "signed_out"})
        return
    try:
        found = await Cloud(hass).async_inspect(msg["device_id"])
    except Exception as e:
        connection.send_result(msg["id"], {"error": f"{type(e).__name__}: {e}"})
        return
    connection.send_result(msg["id"], found or {"error": "not_found"})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/cloud/ble_probe",
        vol.Required("device_id"): str,
        vol.Optional("read", default=False): bool,
    }
)
@websocket_api.async_response
async def websocket_cloud_ble_probe(hass, connection, msg) -> None:
    """Is an account device within Bluetooth reach, and does it answer a status read?

    Read only: nothing is ever written to the device from here.
    """
    from homeassistant.components import bluetooth

    from .ble.discovery import SERVICE_UUID, uuid_from_advertisement
    from .ble.transport import TuyaBleTransport

    if not (hass.data.get(DOMAIN) or {}).get("auth_cache"):
        connection.send_result(msg["id"], {"error": "signed_out"})
        return
    found = await Cloud(hass).async_ble_credentials(msg["device_id"])
    if not found:
        connection.send_result(msg["id"], {"error": "not_found"})
        return
    uuid, local_key = found

    heard = []
    match = None
    for info in bluetooth.async_discovered_service_info(hass, connectable=False):
        payload = (info.service_data or {}).get(SERVICE_UUID)
        if not payload:
            continue
        broadcast = uuid_from_advertisement(info)
        row = {
            "address": info.address.upper(),
            "rssi": info.rssi,
            "connectable": info.connectable,
            "product": payload[1:].decode("ascii", "replace"),
            "is_it": broadcast == uuid,
        }
        heard.append(row)
        if broadcast == uuid:
            match = row
    result: dict[str, Any] = {"heard": heard, "match": match}

    if match and msg["read"]:
        transport = TuyaBleTransport(hass, match["address"], msg["device_id"], local_key)
        try:
            state = await hass.async_add_executor_job(transport.status)
            result["read"] = {
                code: "<hidden>" if isinstance(value, (str, bytes)) else value
                for code, value in (state.get("dps") or {}).items()
            }
        except Exception as e:
            result["read_error"] = f"{type(e).__name__}: {e}"
        finally:
            try:
                await hass.async_add_executor_job(transport.close)
            except Exception as e:
                _LOGGER.debug("Bluetooth close failed: %s %s", type(e).__name__, e)
    connection.send_result(msg["id"], result)


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/cloud/devices"})
@websocket_api.async_response
async def websocket_cloud_devices(hass, connection, msg) -> None:
    """The account's devices that are not set up here yet, without any key."""
    cloud = Cloud(hass)
    if not cloud.is_authenticated:
        connection.send_result(msg["id"], {"authenticated": False, "devices": []})
        return
    try:
        found = await cloud.async_get_devices()
    except Exception as err:  # noqa: BLE001
        connection.send_error(msg["id"], "cloud_failed", str(err))
        return
    known = set()
    for entry in hass.config_entries.async_entries(DOMAIN):
        known.update(filter(None, (entry.data.get(CONF_DEVICE_ID), entry.data.get(CONF_DEVICE_CID))))
    devices = []
    for key, device in found.items():
        sub = device.get("node_id")
        mine = {sub, device.get("uuid")} if sub else {device.get("id")}
        if device.get("exists") or mine & known:
            continue
        if device.get("support_local") is False or not device.get(CONF_LOCAL_KEY):
            why = "cloud_only"
        elif not device.get("ip"):
            why = "needs_hub"
        else:
            why = None
        devices.append(
            {
                "key": key,
                "name": device.get("name") or device.get("product_name") or key,
                "product": device.get("product_name") or "",
                "online": bool(device.get("online")),
                "blocked": why,
            }
        )
    devices.sort(key=lambda d: (d["blocked"] is not None, d["name"].lower()))
    connection.send_result(msg["id"], {"authenticated": True, "devices": devices})


def _flow_defaults(schema) -> dict[str, Any]:
    answer = {}
    for marker in getattr(schema, "schema", {}) or {}:
        default = getattr(marker, "default", vol.UNDEFINED)
        if default is not vol.UNDEFINED:
            answer[str(marker.schema)] = default() if callable(default) else default
    return answer


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/cloud/add", vol.Required("key"): str}
)
@websocket_api.async_response
async def websocket_cloud_add(hass, connection, msg) -> None:
    """Set one account device up, taking every default the form would offer.

    The flow runs here so the device's key never travels to the browser.
    """
    flows = hass.config_entries.flow
    answers = {
        "user": {"setup_mode": "cloud"},
        "choose_device": {"device_id": msg["key"], "hub_id": "None"},
        "search": {},
    }
    flow_id = None
    try:
        result = await flows.async_init(
            DOMAIN, context={"source": SOURCE_USER, "user_id": connection.user.id}
        )
        for _ in range(10):
            flow_id = result.get("flow_id")
            if result["type"] == FlowResultType.CREATE_ENTRY:
                connection.send_result(msg["id"], {"ok": True, "title": result["title"]})
                return
            if result["type"] == FlowResultType.ABORT:
                connection.send_result(msg["id"], {"ok": False, "reason": result["reason"]})
                return
            if result["type"] != FlowResultType.FORM or result.get("errors"):
                errors = result.get("errors") or {}
                reason = next(iter(errors.values()), str(result["type"]))
                break
            step = result["step_id"]
            answer = answers.get(step)
            if answer is None:
                answer = _flow_defaults(result.get("data_schema"))
            result = await flows.async_configure(flow_id, answer)
        else:
            reason = "too_many_steps"
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Adding an account device failed: %s", err)
        reason = str(err) or type(err).__name__
    if flow_id:
        try:
            flows.async_abort(flow_id)
        except Exception:  # noqa: BLE001
            pass
    connection.send_result(msg["id"], {"ok": False, "reason": reason})

