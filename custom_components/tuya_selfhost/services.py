"""Services for Tuya Local integration."""

import asyncio
import logging
from functools import partial

import voluptuous as vol
from homeassistant.components import infrared
from homeassistant.components.remote import (
    ATTR_DELAY_SECS,
    DEFAULT_DELAY_SECS,
)
from homeassistant.components.remote import DOMAIN as REMOTE_DOMAIN
from homeassistant.const import CONF_HOST
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import service

from .const import CONF_DEVICE_CID, CONF_DEVICE_ID, DOMAIN
from .infrared import TuyaRemoteCommand
from .remote import FLAG_SAVE_DELAY, TuyaLocalRemote

REMOTE_SEND_IR_COMMAND_SCHEMA = {
    vol.Required("emitter_entity_id"): cv.entity_id,
    vol.Required("command"): str,
    vol.Optional("device"): str,
}

_LOGGER = logging.getLogger(__name__)


async def async_setup_services(hass: HomeAssistant, entities: list[str]):
    """Set up services for the Tuya Local integration."""
    if "remote" in entities:
        service.async_register_platform_entity_service(
            hass,
            DOMAIN,
            "send_learned_ir_command",
            entity_domain=REMOTE_DOMAIN,
            schema=REMOTE_SEND_IR_COMMAND_SCHEMA,
            func=async_handle_send_ir_command,
        )
    hass.services.async_register(
        DOMAIN,
        "network_report",
        partial(async_handle_network_report, hass),
        schema=vol.Schema({}),
        supports_response=SupportsResponse.ONLY,
    )
    return True


def _read_arp_table() -> dict[str, str]:
    """Map IP to MAC from the kernel ARP cache."""
    table: dict[str, str] = {}
    try:
        with open("/proc/net/arp") as handle:
            next(handle, None)
            for line in handle:
                fields = line.split()
                if len(fields) >= 4 and fields[3] != "00:00:00:00:00:00":
                    table[fields[0]] = fields[3].upper()
    except OSError:
        _LOGGER.debug("ARP table unavailable")
    return table


def _host_sort_key(device: dict) -> list[int]:
    """Sort by IP, pushing anything unparseable to the end."""
    parts = device["host"].split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        return [int(p) for p in parts]
    return [999, 999, 999, 999]


async def async_handle_network_report(hass: HomeAssistant, call: ServiceCall):
    """List configured devices with their MAC, flagging which are safe to block."""
    arp = await hass.async_add_executor_job(_read_arp_table)
    entries = hass.config_entries.async_entries(DOMAIN)
    gateways = {
        entry.data.get(CONF_DEVICE_ID)
        for entry in entries
        if entry.data.get(CONF_DEVICE_CID)
    }

    devices = []
    for entry in entries:
        config = {**entry.data, **entry.options}
        host = config.get(CONF_HOST) or ""
        mac = arp.get(host)
        if config.get(CONF_DEVICE_CID):
            role, note = "sub-device", "reached through its gateway"
        elif config.get(CONF_DEVICE_ID) in gateways:
            role, note = "gateway", "other devices depend on it, and it needs the cloud"
        else:
            role, note = "device", "controlled locally"
        devices.append(
            {
                "name": entry.title,
                "host": host,
                "mac": mac,
                "on_lan": mac is not None,
                "role": role,
                "block_recommended": role == "device",
                "note": note,
            }
        )

    devices.sort(key=_host_sort_key)
    return {"devices": devices}


async def async_handle_send_ir_command(entity, call: ServiceCall):
    """Action to send a saved remote command."""
    _LOGGER.info("Sending saved remote command: %s", call.data)

    if not isinstance(entity, TuyaLocalRemote):
        raise ValueError("Entity must be a tuya-local remote")
    if not entity._storage_loaded:
        await entity._async_load_storage()

    emitter = call.data.get("emitter_entity_id")
    device = call.data.get("device")
    command = call.data.get("command")
    delay = call.data.get(ATTR_DELAY_SECS, DEFAULT_DELAY_SECS)
    code_list = entity._extract_codes(
        [command], subdevice=device
    )  # Validate command and get code
    at_least_one_sent = False
    for codes in code_list:
        if at_least_one_sent:
            await asyncio.sleep(delay)
        if len(codes) > 1:
            code = codes[entity._flags[device]]
            entity._flags[device] ^= 1
        else:
            code = codes[0]
        if code.startswith("rf:"):
            _LOGGER.error("RF emitters are not yet supported by this service")
            continue
        await infrared.async_send_command(
            entity.hass, emitter, TuyaRemoteCommand(code=code)
        )
        at_least_one_sent = True

        if at_least_one_sent:
            entity._flag_storage.async_delay_save(
                lambda: entity._flags, FLAG_SAVE_DELAY
            )
