import copy
import logging
import time
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.storage import Store
from tuya_sharing import (
    CustomerDevice,
    LoginControl,
    Manager,
    SharingDeviceListener,
    SharingTokenListener,
)

from .const import (
    CONF_DEVICE_CID,
    CONF_DEVICE_ID,
    CONF_ENDPOINT,
    CONF_LOCAL_KEY,
    CONF_MODEL,
    CONF_TERMINAL_ID,
    DOMAIN,
    TUYA_CLIENT_ID,
    TUYA_RESPONSE_CODE,
    TUYA_RESPONSE_MSG,
    TUYA_RESPONSE_QR_CODE,
    TUYA_RESPONSE_RESULT,
    TUYA_RESPONSE_SUCCESS,
    TUYA_SCHEMA,
)

_LOGGER = logging.getLogger(__name__)

AUTH_STORE_KEY = "tuya_selfhost_cloud_auth"
AUTH_STORE_VERSION = 1


async def async_restore_auth(hass: HomeAssistant) -> None:
    """Bring a previous cloud login back, so a restart does not ask for the QR again."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if "auth_store" in domain_data:
        return
    store = Store(hass, AUTH_STORE_VERSION, AUTH_STORE_KEY)
    domain_data["auth_store"] = store
    if not domain_data.get("auth_cache"):
        domain_data["auth_cache"] = await store.async_load() or {}


def persist_auth(hass: HomeAssistant) -> None:
    """Write the current authentication, or its absence, to disk."""
    store = hass.data.get(DOMAIN, {}).get("auth_store")
    if store:
        store.async_delay_save(lambda: hass.data[DOMAIN].get("auth_cache") or {}, 1)


HUB_CATEGORIES = [
    "wgsxj",  # Gateway camera
    "lyqwg",  # Router
    "bywg",  # IoT edge gateway
    "zigbee",  # Gateway
    "wg2",  # Gateway
    "dgnzk",  # Multi-function controller
    "videohub",  # Videohub
    "xnwg",  # Virtual gateway
    "qtyycp",  # Voice gateway composite solution
    "alexa_yywg",  # Gateway with Alexa
    "gywg",  # Industrial gateway
    "cnwg",  # Energy gateway
    "wnykq",  # Smart IR
]


class Cloud:
    """Optional Tuya cloud interface for getting device information."""

    def __init__(self, hass: HomeAssistant):
        self.__login_control = LoginControl()
        self.__authentication = {}
        self.__user_code = None
        self.__qr_code = None
        self.__hass = hass
        self.__error_code = None
        self.__error_msg = None
        # Restore cached authentication
        if cached := self.__hass.data[DOMAIN].get("auth_cache"):
            self.__authentication = cached

    async def async_get_qr_code(self, user_code: str | None = None) -> bool:
        """Get QR code from Tuya server for user code authentication."""
        if not user_code:
            user_code = self.__user_code
            if not user_code:
                _LOGGER.error("Cannot get QR code without a user code")
                return False, {TUYA_RESPONSE_MSG: "QR code requires a user code"}

        response = await self.__hass.async_add_executor_job(
            self.__login_control.qr_code,
            TUYA_CLIENT_ID,
            TUYA_SCHEMA,
            user_code,
        )
        if response.get(TUYA_RESPONSE_SUCCESS, False):
            self.__user_code = user_code
            self.__qr_code = response[TUYA_RESPONSE_RESULT][TUYA_RESPONSE_QR_CODE]
            return self.__qr_code

        _LOGGER.error("Failed to get QR code: %s", response)
        self.__error_code = response.get(TUYA_RESPONSE_CODE, {})
        self.__error_msg = response.get(TUYA_RESPONSE_MSG, "Unknown error")

        return False

    def _store_auth(self, info: dict[str, Any]) -> None:
        """Keep a login that worked, in memory and on disk."""
        self.__authentication = {
            "user_code": self.__user_code,
            "terminal_id": info[CONF_TERMINAL_ID],
            "endpoint": info[CONF_ENDPOINT],
            "token_info": {
                "t": info["t"],
                "uid": info["uid"],
                "expire_time": info["expire_time"],
                "access_token": info["access_token"],
                "refresh_token": info["refresh_token"],
            },
        }
        self.__hass.data[DOMAIN]["auth_cache"] = self.__authentication
        persist_auth(self.__hass)

    def _note_error(self, info: dict[str, Any]) -> None:
        self.__error_code = info.get(TUYA_RESPONSE_CODE, {})
        self.__error_msg = info.get(TUYA_RESPONSE_MSG, "Unknown error")

    async def _async_login_result(self):
        return await self.__hass.async_add_executor_job(
            self.__login_control.login_result,
            self.__qr_code,
            TUYA_CLIENT_ID,
            self.__user_code,
        )

    async def async_login(self) -> bool:
        """Login to the Tuya cloud."""
        if not self.__user_code or not self.__qr_code:
            _LOGGER.warning("Login attempted without successful QR scan")
            return False

        success, info = await self._async_login_result()
        if success:
            self._store_auth(info)
        else:
            _LOGGER.warning("Login failed: %s", info)
            self._note_error(info)
            # Ensure expired authentication is cleared on next attempt
            self.__hass.data[DOMAIN]["auth_cache"] = None
            self.__authentication = {}
            persist_auth(self.__hass)
        return success

    async def async_poll_login(self) -> bool:
        """Has the code been scanned yet?

        async_login throws the stored account away whenever it fails, which is
        right for a form someone just submitted and wrong for a poll that runs
        every few seconds while the code is still on screen.
        """
        if not self.__user_code or not self.__qr_code:
            return False
        success, info = await self._async_login_result()
        if success:
            self._store_auth(info)
        else:
            self._note_error(info)
        return success

    def _manager(self) -> Manager:
        """A cloud session built from the stored authentication."""
        return Manager(
            TUYA_CLIENT_ID,
            self.__authentication["user_code"],
            self.__authentication["terminal_id"],
            self.__authentication["endpoint"],
            self.__authentication["token_info"],
            TokenListener(self.__hass),
        )

    async def async_get_devices(self, max_age: float = 0) -> dict[str, Any]:
        """Get all devices associated with the account.

        Tuya answers three calls per device, about a second each, so a list
        younger than `max_age` seconds is handed back again.
        """
        cache = self.__hass.data[DOMAIN].setdefault("cloud_devices", {})
        if max_age and cache.get("devices") and time.monotonic() - cache["at"] < max_age:
            return self._mark_existing(copy.deepcopy(cache["devices"]))
        found = await self._async_fetch_devices()
        cache.update(at=time.monotonic(), devices=found)
        self._keep_product_names(found)
        return self._mark_existing(copy.deepcopy(found))

    def _keep_product_names(self, cloud_devices: dict[str, Any]) -> None:
        """Devices added before their product name was kept learn it, for their icon."""
        names = {}
        for device in cloud_devices.values():
            sub = device.get("node_id")
            for key in {sub, device.get("uuid")} if sub else {device.get("id")}:
                if key and device.get("product_name"):
                    names[key] = device["product_name"]
        for entry in self.__hass.config_entries.async_entries(DOMAIN):
            name = names.get(
                entry.data.get(CONF_DEVICE_CID) or entry.data.get(CONF_DEVICE_ID)
            )
            if not name or entry.data.get(CONF_MODEL):
                continue
            self.__hass.config_entries.async_update_entry(
                entry, data={**entry.data, CONF_MODEL: name}
            )
            registry = dr.async_get(self.__hass)
            for device in dr.async_entries_for_config_entry(registry, entry.entry_id):
                if not device.model and not device.via_device_id:
                    registry.async_update_device(device.id, model=name)

    def _mark_existing(self, cloud_devices: dict[str, Any]) -> dict[str, Any]:
        domain_data = self.__hass.data.get(DOMAIN)
        for cloud_device in cloud_devices.values():
            existing_id = domain_data.get(cloud_device["id"]) if domain_data else None
            existing_uuid = (
                domain_data.get(cloud_device["uuid"]) if domain_data else None
            )
            existing = existing_id or existing_uuid
            cloud_device["exists"] = existing and bool(existing.get("device"))
        return cloud_devices

    async def _async_fetch_devices(self) -> dict[str, Any]:
        manager = self._manager()

        listener = DeviceListener(self.__hass, manager)
        manager.add_device_listener(listener)

        # Get all devices from Tuya cloud
        await self.__hass.async_add_executor_job(manager.update_device_cache)

        cloud_devices = {}
        for device in manager.device_map.values():
            cloud_device = {
                "category": device.category,
                "id": device.id,
                "ip": device.ip,
                CONF_LOCAL_KEY: device.local_key
                if hasattr(device, CONF_LOCAL_KEY)
                else "",
                "name": device.name,
                "node_id": device.node_id if hasattr(device, "node_id") else "",
                "online": device.online,
                "product_id": device.product_id,
                "product_name": device.product_name,
                "uid": device.uid,
                "uuid": device.uuid,
                "support_local": device.support_local,
                CONF_DEVICE_CID: None,
                "version": None,
                "is_hub": (
                    device.category in HUB_CATEGORIES
                    or not hasattr(device, "local_key")
                ),
            }
            _LOGGER.debug("Found device: %s", cloud_device["product_name"])

            if hasattr(device, "node_id"):
                index = "/".join(
                    [
                        cloud_device["id"],
                        cloud_device["node_id"],
                    ]
                )
            else:
                index = cloud_device["id"]
            cloud_devices[index] = cloud_device

        return cloud_devices

    async def async_ble_credentials(self, device_id: str) -> tuple[str, str] | None:
        """The uuid a device broadcasts and its key, for code that stays on the server."""
        manager = self._manager()
        await self.__hass.async_add_executor_job(manager.update_device_cache)
        device = manager.device_map.get(device_id)
        if device is None:
            return None
        return device.uuid, getattr(device, "local_key", "") or ""

    async def async_inspect(self, device_id: str) -> dict[str, Any] | None:
        """What Tuya knows about one device, without its key or secrets."""
        manager = self._manager()
        await self.__hass.async_add_executor_job(manager.update_device_cache)
        device = manager.device_map.get(device_id)
        if device is None:
            return None
        response = await self.__hass.async_add_executor_job(
            manager.customer_api.get,
            f"/v1.0/m/life/devices/{device_id}/status",
        )
        result = (response or {}).get("result") or {}
        secret = ("password", "key", "token", "secret")
        return {
            "name": device.name,
            "category": device.category,
            "product_id": device.product_id,
            "product_name": device.product_name,
            "online": device.online,
            "support_local": device.support_local,
            "has_local_key": bool(getattr(device, "local_key", "")),
            # Raw values carry offline passwords and keys under harmless names.
            "status": {
                code: "<hidden>"
                if any(w in code for w in secret) or isinstance(value, str)
                else value
                for code, value in (device.status or {}).items()
            },
            "function": {
                code: {"type": f.type, "values": f.values}
                for code, f in (device.function or {}).items()
            },
            "status_range": {
                code: {"type": r.type, "values": r.values}
                for code, r in (device.status_range or {}).items()
            },
            "datapoints": [
                {
                    "id": entry.get("dpId"),
                    "code": entry.get("dpCode"),
                    "type": entry.get("valueType"),
                    "local": entry.get("supportLocal"),
                }
                for entry in result.get("dpStatusRelationDTOS") or []
            ],
            "fields": sorted(vars(device)),
            "status_fields": sorted(result),
            "datapoint_fields": sorted(
                {k for entry in result.get("dpStatusRelationDTOS") or [] for k in entry}
            ),
        }

    async def async_get_datamodel(self, device_id) -> dict[str, Any] | None:
        """Get the data model for the specified device (QueryThingsDataModel)."""
        manager = self._manager()
        response = await self.__hass.async_add_executor_job(
            manager.customer_api.get,
            f"/v1.0/m/life/devices/{device_id}/status",
        )
        _LOGGER.debug("Datamodel response: %s", response)
        if response.get("result"):
            response = response["result"]
        transform = []
        for entry in response.get("dpStatusRelationDTOS"):
            if entry["supportLocal"]:
                transform.append(
                    {
                        "id": entry["dpId"],
                        "name": entry["dpCode"],
                        "type": entry["valueType"],
                        "format": entry["valueDesc"],
                        "enumMap": entry["enumMappingMap"],
                    }
                )
        return transform

    def logout(self) -> None:
        """Logout from the Tuya cloud."""
        _LOGGER.debug("Logging out from Tuya cloud")
        # Clear authentication cache
        self.__hass.data[DOMAIN]["auth_cache"] = None
        self.__hass.data[DOMAIN].pop("cloud_devices", None)
        self.__authentication = {}
        persist_auth(self.__hass)

    @property
    def is_authenticated(self) -> bool:
        """Is the cloud account authenticated?"""
        return True if self.__authentication else False

    @property
    def last_error(self) -> dict[str, Any] | None:
        """The last cloud error code and message, if any."""
        if self.__error_code is not None:
            return {
                TUYA_RESPONSE_MSG: self.__error_msg,
                TUYA_RESPONSE_CODE: self.__error_code,
            }


class DeviceListener(SharingDeviceListener):
    """Device update listener."""

    def __init__(
        self,
        hass: HomeAssistant,
        manager: Manager,
    ):
        self.__hass = hass
        self._manager = manager

    def update_device(
        self,
        device: CustomerDevice,
        updated_status_properties: list[str] | None,
    ) -> None:
        """Device status has updated."""
        _LOGGER.debug(
            "Received update for device %s: %s (properties %s)",
            device.id,
            self._manager.device_map[device.id].status,
            updated_status_properties,
        )

    def add_device(self, device: CustomerDevice) -> None:
        """A new device has been added."""
        _LOGGER.debug(
            "Received add device %s: %s",
            device.id,
            self._manager.device_map[device.id].status,
        )

    def remove_device(self, device_id: str) -> None:
        """A device has been removed."""
        _LOGGER.debug(
            "Received remove device %s: %s",
            device_id,
            self._manager.device_map[device_id].status,
        )


class TokenListener(SharingTokenListener):
    """Listener for upstream token updates.
    This is only needed to get some debug output when tokens are refreshed."""

    def __init__(self, hass: HomeAssistant):
        self.__hass = hass

    def update_token(self, token_info: dict[str, Any]) -> None:
        """Update the token information."""
        _LOGGER.debug("Token updated")
        cache = self.__hass.data.get(DOMAIN, {}).get("auth_cache")
        if cache:
            cache["token_info"] = token_info
            # The SDK refreshes from an executor thread.
            self.__hass.loop.call_soon_threadsafe(persist_auth, self.__hass)
