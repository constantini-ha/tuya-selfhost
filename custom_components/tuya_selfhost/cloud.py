import logging
from typing import Any

from homeassistant.core import HomeAssistant
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
    CONF_ENDPOINT,
    CONF_LOCAL_KEY,
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

    async def async_login(self) -> bool:
        """Login to the Tuya cloud."""
        if not self.__user_code or not self.__qr_code:
            _LOGGER.warning("Login attempted without successful QR scan")
            return False, {}

        success, info = await self.__hass.async_add_executor_job(
            self.__login_control.login_result,
            self.__qr_code,
            TUYA_CLIENT_ID,
            self.__user_code,
        )
        if success:
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
        else:
            _LOGGER.warning("Login failed: %s", info)
            self.__error_code = info.get(TUYA_RESPONSE_CODE, {})
            self.__error_msg = info.get(TUYA_RESPONSE_MSG, "Unknown error")
            # Ensure expired authentication is cleared on next attempt
            self.__hass.data[DOMAIN]["auth_cache"] = None
            self.__authentication = {}
            persist_auth(self.__hass)
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

    async def async_online_map(self) -> dict[str, bool]:
        """Ask Tuya which of the account's devices are still reaching it.

        Tuya is the only side that can see a device's internet: a device cut off
        at the router still answers us on the LAN, so the cloud's own view is
        what tells a working block apart from a dead device.
        """
        manager = self._manager()
        await self.__hass.async_add_executor_job(manager.update_device_cache)
        online: dict[str, bool] = {}
        for device in manager.device_map.values():
            for key in (
                device.id,
                getattr(device, "uuid", None),
                getattr(device, "node_id", None),
            ):
                if key:
                    online[key] = bool(device.online)
        return online

    async def async_get_devices(self) -> dict[str, Any]:
        """Get all devices associated with the account."""
        manager = self._manager()

        listener = DeviceListener(self.__hass, manager)
        manager.add_device_listener(listener)

        # Get all devices from Tuya cloud
        await self.__hass.async_add_executor_job(manager.update_device_cache)

        # Register known device IDs
        cloud_devices = {}
        domain_data = self.__hass.data.get(DOMAIN)
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

            existing_id = domain_data.get(cloud_device["id"]) if domain_data else None
            existing_uuid = (
                domain_data.get(cloud_device["uuid"]) if domain_data else None
            )
            existing = existing_id or existing_uuid
            cloud_device["exists"] = existing and existing.get("device")
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
