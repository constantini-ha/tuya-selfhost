"""A tinytuya-shaped transport that reaches the device over Bluetooth."""

from __future__ import annotations

import asyncio
import logging
import queue
from typing import Any

from homeassistant.components import bluetooth
from homeassistant.core import HomeAssistant

from homeassistant.components import bluetooth as ha_bluetooth

from .discovery import uuid_from_advertisement
from .manager import AbstaractTuyaBLEDeviceManager, TuyaBLEDeviceCredentials
from .tuya_ble import TuyaBLEDataPoint, TuyaBLEDataPointType, TuyaBLEDevice

_LOGGER = logging.getLogger(__name__)

CALL_TIMEOUT = 30
RECEIVE_TIMEOUT = 5


class StoredCredentials(AbstaractTuyaBLEDeviceManager):
    """Hands the protocol the credentials the config entry already holds."""

    def __init__(self, credentials: TuyaBLEDeviceCredentials) -> None:
        self._credentials = credentials

    async def get_device_credentials(
        self,
        address: str,
        force_update: bool = False,
        save_data: bool = False,
    ) -> TuyaBLEDeviceCredentials | None:
        """Return the stored credentials; nothing is fetched at runtime."""
        return self._credentials


class TuyaBleTransport:
    """The slice of tinytuya.Device that TuyaLocalDevice drives, over GATT.

    TuyaLocalDevice calls this from an executor thread, so every method here
    bridges back onto the event loop the Bluetooth stack lives on.
    """

    def __init__(
        self,
        hass: HomeAssistant,
        address: str,
        device_id: str,
        local_key: str,
    ) -> None:
        self.id = device_id
        self.parent = None
        self.disabledetect = True
        self._hass = hass
        self._address = address.upper()
        self._device_id = device_id
        self._local_key = local_key
        self._device: TuyaBLEDevice | None = None
        self._updates: queue.Queue = queue.Queue()

    def _credentials(self, service_info) -> TuyaBLEDeviceCredentials:
        """Build credentials, taking the uuid from what the device broadcasts."""
        uuid = uuid_from_advertisement(service_info)
        if not uuid:
            raise ConnectionError(
                f"{self._address} does not broadcast a readable uuid"
            )
        return TuyaBLEDeviceCredentials(
            uuid=uuid,
            local_key=self._local_key,
            device_id=self._device_id,
            category="",
            product_id="",
            device_name=None,
            product_model=None,
            product_name=None,
        )

    # ------------------------------------------------------------------
    # bridging

    def _run(self, coro):
        return asyncio.run_coroutine_threadsafe(coro, self._hass.loop).result(
            CALL_TIMEOUT
        )

    async def _async_device(self) -> TuyaBLEDevice:
        if self._device is not None:
            return self._device
        ble_device = bluetooth.async_ble_device_from_address(
            self._hass, self._address, connectable=True
        )
        if ble_device is None:
            raise ConnectionError(f"{self._address} is out of Bluetooth range")
        service_info = ha_bluetooth.async_last_service_info(
            self._hass, self._address, connectable=True
        )
        if service_info is None:
            raise ConnectionError(f"{self._address} has not advertised yet")
        manager = StoredCredentials(self._credentials(service_info))
        device = TuyaBLEDevice(manager, ble_device)
        await device.initialize()
        device.register_callback(self._on_datapoints)
        self._device = device
        return device

    def _on_datapoints(self, datapoints: list[TuyaBLEDataPoint]) -> None:
        """Queue a push so receive() can hand it to the polling loop."""
        self._updates.put({str(dp.id): dp.value for dp in datapoints})

    @staticmethod
    def _as_dps(device: TuyaBLEDevice) -> dict[str, Any]:
        return {
            str(dp.id): dp.value
            for dp in device.datapoints._datapoints.values()  # noqa: SLF001
        }

    # ------------------------------------------------------------------
    # the tinytuya surface

    def status(self) -> dict[str, Any]:
        device = self._run(self._async_device())
        self._run(device.update())
        return {"dps": self._as_dps(device)}

    def updatedps(self, dps=None) -> dict[str, Any]:
        return self.status()

    def receive(self) -> dict[str, Any] | None:
        """Block briefly for a pushed update, like the TCP receive loop does."""
        try:
            return {"dps": self._updates.get(timeout=RECEIVE_TIMEOUT)}
        except queue.Empty:
            return None

    def heartbeat(self, nowait: bool = True):
        device = self._run(self._async_device())
        return {"connected": device.is_connected}

    def set_dps(self, value, dp_index, nowait: bool = False):
        return self.set_multiple_values({dp_index: value}, nowait=nowait)

    def set_multiple_values(self, properties: dict, nowait: bool = False):
        device = self._run(self._async_device())

        async def _write():
            for dp_id, value in properties.items():
                datapoint = device.datapoints[int(dp_id)]
                if datapoint is None:
                    datapoint = device.get_or_create_datapoint(
                        int(dp_id), _guess_type(value), value
                    )
                await datapoint.set_value(value)

        self._run(_write())
        return {"dps": {str(k): v for k, v in properties.items()}}

    # Settings that only mean something to a TCP socket.
    def set_socketPersistent(self, *_args, **_kwargs) -> None:
        return None

    def set_socketRetryLimit(self, *_args, **_kwargs) -> None:
        return None

    def set_version(self, *_args, **_kwargs) -> None:
        return None

    def set_dpsUsed(self, *_args, **_kwargs) -> None:
        return None

    def close(self) -> None:
        if self._device is not None:
            self._run(self._device.stop())
            self._device = None


def _guess_type(value: Any) -> TuyaBLEDataPointType:
    if isinstance(value, bool):
        return TuyaBLEDataPointType.DT_BOOL
    if isinstance(value, int):
        return TuyaBLEDataPointType.DT_VALUE
    if isinstance(value, (bytes, bytearray)):
        return TuyaBLEDataPointType.DT_RAW
    return TuyaBLEDataPointType.DT_STRING
