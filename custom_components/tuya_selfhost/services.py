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
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import service

from .const import CONF_DEVICE_CID, CONF_DEVICE_ID, DOMAIN
from .helpers.arp import arp_table
from .infrared import TuyaRemoteCommand
from .remote import FLAG_SAVE_DELAY, TuyaLocalRemote
from .remote_keys import (
    OBJECT_ID_PREFIX,
    async_announce_to_alexa,
    async_forget_in_alexa,
)

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
        "alexa_config",
        partial(async_handle_alexa_config, hass),
        schema=vol.Schema({}),
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN,
        "alexa_announce",
        partial(async_handle_alexa_announce, hass),
        schema=vol.Schema({vol.Optional("forget"): vol.All(cv.ensure_list, [cv.string])}),
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN,
        "network_report",
        partial(async_handle_network_report, hass),
        schema=vol.Schema({}),
        supports_response=SupportsResponse.ONLY,
    )
    return True


# Domains the Alexa Smart Home integration can expose.
ALEXA_DOMAINS = frozenset(
    {
        "binary_sensor",
        "button",
        "climate",
        "cover",
        "fan",
        "humidifier",
        "light",
        "lock",
        "sensor",
        "switch",
        "vacuum",
        "water_heater",
    }
)


def _yaml_quote(value: str) -> str:
    """Quote a scalar so any character is safe inside generated YAML."""
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


async def async_handle_alexa_config(hass: HomeAssistant, call: ServiceCall):
    """Build an alexa: block covering every Tuya Selfhost entity."""
    registry = er.async_get(hass)
    entities = []
    for entry in hass.config_entries.async_entries(DOMAIN):
        for item in er.async_entries_for_config_entry(registry, entry.entry_id):
            if item.disabled_by or item.hidden_by or item.domain not in ALEXA_DOMAINS:
                continue
            state = hass.states.get(item.entity_id)
            if item.entity_id.startswith(
                (f"button.{OBJECT_ID_PREFIX}_", f"switch.{OBJECT_ID_PREFIX}_")
            ):
                # A remote key is already named "<remote> <key>"; the device name
                # Home Assistant prepends would make it unspeakable.
                name = item.name or item.original_name or item.entity_id
            else:
                name = (
                    (state.attributes.get("friendly_name") if state else None)
                    or item.name
                    or item.original_name
                    or item.entity_id
                )
            entities.append((item.entity_id, str(name)))
    entities.sort()

    lines = [
        "alexa:",
        "  smart_home:",
        f"    locale: {hass.config.language}  # check against your Alexa account",
        "    # Proactive state reporting: without these three the Alexa app shows",
        "    # a stale state when something changes outside Alexa. The credentials",
        "    # come from your skill: Build > Permissions > Send Alexa Events.",
        "    # endpoint: https://api.amazonalexa.com/v3/events",
        "    # client_id: !secret alexa_client_id",
        "    # client_secret: !secret alexa_client_secret",
        "    filter:",
        "      # Every remote key lands under this prefix, so keys learned later",
        "      # are already covered: Alexa only has to discover devices again.",
        "      include_entity_globs:",
        f"        - button.{OBJECT_ID_PREFIX}_*",
        f"        - switch.{OBJECT_ID_PREFIX}_*",
        "      include_entities:",
    ]
    lines += [f"        - {entity_id}" for entity_id, _ in entities]
    lines.append("    entity_config:")
    for entity_id, name in entities:
        lines.append(f"      {entity_id}:")
        lines.append(f"        name: {_yaml_quote(name)}")

    return {"yaml": "\n".join(lines), "entity_count": len(entities)}

async def async_handle_alexa_announce(hass: HomeAssistant, call: ServiceCall):
    """Hand every remote key to Alexa, without waiting for a discovery.

    `forget` drops endpoints Alexa still shows for keys that no longer exist —
    a scene deleted here leaves no trace there.
    """
    forget = call.data.get("forget") or []
    forgotten = await async_forget_in_alexa(hass, list(forget))

    registry = er.async_get(hass)
    entity_ids = [
        item.entity_id
        for entry in hass.config_entries.async_entries(DOMAIN)
        for item in er.async_entries_for_config_entry(registry, entry.entry_id)
        if item.entity_id.startswith(
            (f"button.{OBJECT_ID_PREFIX}_", f"switch.{OBJECT_ID_PREFIX}_")
        )
        and not item.disabled_by
        and not item.hidden_by
    ]
    sent = await async_announce_to_alexa(hass, entity_ids)
    return {
        "entity_count": len(entity_ids),
        "sent": sent,
        "forgotten": len(forget) if forgotten else 0,
    }


def _host_sort_key(device: dict) -> list[int]:
    """Sort by IP, pushing anything unparseable to the end."""
    parts = device["host"].split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        return [int(p) for p in parts]
    return [999, 999, 999, 999]


async def async_handle_network_report(hass: HomeAssistant, call: ServiceCall):
    """List configured devices with their MAC, flagging which are safe to block."""
    arp = await hass.async_add_executor_job(arp_table)
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
