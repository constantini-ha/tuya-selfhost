"""Turns every learned remote key into a button entity.

A key stored by the panel is only data; Alexa, Google and automations can only
reach it once it is an entity. One button per taught key does that, and the
Alexa integration maps the button domain to a scene, so "turn on <key>" presses
it.
"""

import logging
from typing import Any

from homeassistant.components.button import ButtonEntity
from homeassistant.components.climate import (
    ClimateEntity,
    ClimateEntityFeature,
    HVACMode,
)
from homeassistant.components.remote import DATA_COMPONENT as REMOTES
from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.const import ATTR_TEMPERATURE, UnitOfTemperature
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.restore_state import RestoreEntity
from homeassistant.helpers.start import async_at_started
from homeassistant.util import slugify

from .const import DOMAIN, SIGNAL_CODE_SENT
from .helpers.config import get_device_id
from .ir_ac import MAX_TEMP, MIN_TEMP, AcState, encode, recognize, template_of
from .remote_card import SIGNAL_LAYOUTS, STORAGE_KEY

_LOGGER = logging.getLogger(__name__)

OBJECT_ID_PREFIX = "tuya_remote"
# Scenes made in the panel are scripts whose id starts with this.
SCENE_PREFIX = "tuya_scene_"
MODEL = "Learned remote"
ALEXA_ENDPOINT = "/api/alexa/smart_home"


async def async_setup_remote_keys(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities, kind: str
) -> None:
    """Keep the entities of one domain in step with what the panel saves.

    `kind` is "button" for the single keys, "switch" for a power pair and
    "climate" for an air conditioner whose codes we can write; each platform
    owns its own adder, so they cannot share one pass.
    """
    config = {**entry.data, **entry.options}
    device = hass.data[DOMAIN][get_device_id(config)]["device"]
    known: set[str] = set()
    live: dict[str, ButtonEntity | SwitchEntity | ClimateEntity] = {}

    async def _sync(*_args) -> None:
        registry = er.async_get(hass)
        remotes = [
            item.entity_id
            for item in er.async_entries_for_config_entry(registry, entry.entry_id)
            if item.domain == "remote"
        ]
        if not remotes:
            return

        store = hass.data.get(STORAGE_KEY)
        stored = await store.async_load() or {}

        wanted: dict[str, ButtonEntity | SwitchEntity | ClimateEntity] = {}
        for remote_id in remotes:
            for control in (stored.get(remote_id) or {}).get("controls", []):
                if kind == "climate":
                    found = await _ac_template(hass, remote_id, control)
                    if found:
                        climate = RemoteAirConditioner(
                            entry, device, remote_id, control, *found
                        )
                        wanted[climate.unique_id] = climate
                    continue
                power = control.get("power") or {}
                by_command = {k["command"]: k for k in control.get("buttons", [])}
                paired = {
                    c
                    for c in (power.get("on"), power.get("off"))
                    if c and by_command.get(c, {}).get("taught")
                }
                if kind == "switch":
                    if paired:
                        switch = RemotePowerSwitch(
                            entry, device, remote_id, control, power
                        )
                        wanted[switch.unique_id] = switch
                    continue
                for key in control.get("buttons", []):
                    if not key.get("taught"):
                        continue
                    # A paired key already answers through the switch; a second
                    # entity for it would only show up twice in every assistant.
                    if key["command"] in paired:
                        continue
                    button = RemoteKeyButton(entry, device, remote_id, control, key)
                    wanted[button.unique_id] = button

        fresh = [b for uid, b in wanted.items() if uid not in known]
        for uid, entity in wanted.items():
            if uid in known and isinstance(live.get(uid), RemoteAirConditioner):
                live[uid].apply_settings(entity.settings)
        if fresh:
            async_add_entities(fresh)
            known.update(b.unique_id for b in fresh)
            live.update((b.unique_id, b) for b in fresh)
            await async_announce_to_alexa(hass, [b.entity_id for b in fresh])

        gone = []
        for uid in known - set(wanted):
            entity_id = registry.async_get_entity_id(kind, DOMAIN, uid)
            if entity_id:
                registry.async_remove(entity_id)
                gone.append(entity_id)
            known.discard(uid)
            live.pop(uid, None)
        if gone:
            await async_forget_in_alexa(hass, gone)

    # Marked as a callback, or the dispatcher runs it in a worker thread.
    @callback
    def _schedule(*_args) -> None:
        entry.async_create_task(hass, _sync())

    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_LAYOUTS, _schedule))
    entry.async_on_unload(async_at_started(hass, _sync))


class RemoteKeyButton(ButtonEntity):
    """One learned key, pressable by voice, automation or dashboard."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, entry: ConfigEntry, device, remote_id: str, control, key):
        self._remote_id = remote_id
        self._device_name = control.get("device")
        self._command = key["command"]
        self._attr_unique_id = f"{entry.entry_id}:{control['id']}:{key['command']}"
        self._attr_name = key["name"]
        self._attr_icon = key.get("icon") or "mdi:remote"
        self._attr_device_info = _control_device(entry, device, control)
        # Set outright rather than suggested: Home Assistant prefixes a suggestion
        # with the area and the device, and the Alexa filter needs one stable glob.
        self.entity_id = "button." + slugify(
            f"{OBJECT_ID_PREFIX} {control['name']} {key['name']}"
        )

    async def async_press(self) -> None:
        await self.hass.services.async_call(
            "remote",
            "send_command",
            {
                "entity_id": self._remote_id,
                "device": self._device_name,
                "command": self._command,
            },
            blocking=True,
        )


async def _ac_template(hass: HomeAssistant, remote_id: str, control) -> tuple | None:
    """A learned code of this control we can rewrite, with the state it carries."""
    remote = hass.data[REMOTES].get_entity(remote_id) if REMOTES in hass.data else None
    if remote is None or not hasattr(remote, "async_codes"):
        return None
    codes = await remote.async_codes(control.get("device"))
    power = control.get("power") or {}
    return template_of(codes, [c for c in (power.get("on"),) if c])


# Most units ignore the temperature while drying or only blowing; the user can say otherwise.
DEFAULT_TEMP_MODES = ["cool", "heat", "auto"]

HVAC_MODES = {
    HVACMode.COOL: "cool",
    HVACMode.HEAT: "heat",
    HVACMode.DRY: "dry",
    HVACMode.FAN_ONLY: "fan_only",
    HVACMode.AUTO: "auto",
}


class RemoteAirConditioner(ClimateEntity, RestoreEntity):
    """An air conditioner driven by codes written from a learned one.

    Infrared is one way: what is shown is what was last sent.
    """

    _attr_has_entity_name = True
    _attr_name = None
    _attr_should_poll = False
    _attr_assumed_state = True
    _attr_temperature_unit = UnitOfTemperature.CELSIUS
    _attr_target_temperature_step = 1
    _attr_min_temp = MIN_TEMP
    _attr_max_temp = MAX_TEMP
    _attr_hvac_modes = [HVACMode.OFF, *HVAC_MODES]
    _attr_fan_modes = ["auto", "low", "medium", "high"]
    _attr_supported_features = (
        ClimateEntityFeature.TARGET_TEMPERATURE
        | ClimateEntityFeature.FAN_MODE
        | ClimateEntityFeature.TURN_ON
        | ClimateEntityFeature.TURN_OFF
    )

    def __init__(
        self, entry, device, remote_id, control, template: str, learned: AcState
    ):
        self._remote_id = remote_id
        self._device_name = control.get("device")
        self._template = template
        self._mode = learned.mode
        self._attr_unique_id = f"{entry.entry_id}:{control['id']}:climate"
        self._attr_device_info = _control_device(entry, device, control)
        self._attr_extra_state_attributes = {"tuya_control": control["id"]}
        self.settings = control.get("ac") or {}
        self._apply(self.settings)
        self._attr_hvac_mode = HVACMode.OFF
        self._attr_target_temperature = learned.temperature
        self._attr_fan_mode = learned.fan
        self._attr_icon = "mdi:air-conditioner"
        self.entity_id = "climate." + slugify(f"{OBJECT_ID_PREFIX} {control['name']}")

    def _apply(self, settings: dict) -> None:
        modes = settings.get("modes") or list(HVAC_MODES.values())
        self._attr_hvac_modes = [
            HVACMode.OFF,
            *(m for m, v in HVAC_MODES.items() if v in modes),
        ]
        self._temp_modes = [
            m for m in settings.get("temp_modes", DEFAULT_TEMP_MODES) if m in modes
        ]

    def apply_settings(self, settings: dict) -> None:
        """The modes this unit has and where temperature counts, as set in the panel."""
        self.settings = settings
        self._apply(settings)
        if self.hass is not None:
            self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_CODE_SENT, self._on_code_sent)
        )
        last = await self.async_get_last_state()
        if last is None:
            return
        if last.state in HVAC_MODES:
            self._attr_hvac_mode = HVACMode(last.state)
            self._mode = HVAC_MODES[self._attr_hvac_mode]
        elif last.state == HVACMode.OFF:
            self._mode = last.attributes.get("last_mode") or self._mode
        temperature = last.attributes.get(ATTR_TEMPERATURE)
        if isinstance(temperature, (int, float)):
            self._attr_target_temperature = int(temperature)
        if last.attributes.get("fan_mode") in self._attr_fan_modes:
            self._attr_fan_mode = last.attributes["fan_mode"]

    @callback
    def _on_code_sent(self, remote_id, device, _name, code) -> None:
        """Whatever sent it (Alexa, a key, an automation), the code says the new state."""
        if remote_id != self._remote_id or device != self._device_name:
            return
        state = recognize(code)
        if state is None:
            return
        self._mode = state.mode
        self._attr_hvac_mode = (
            next(m for m, v in HVAC_MODES.items() if v == state.mode)
            if state.power
            else HVACMode.OFF
        )
        self._attr_target_temperature = state.temperature
        self._attr_fan_mode = state.fan
        self.async_write_ha_state()

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            **self._attr_extra_state_attributes,
            "last_mode": self._mode,
            "temp_modes": self._temp_modes,
        }

    async def _send(self, power: bool) -> None:
        code = encode(
            self._template,
            AcState(
                power,
                self._mode,
                int(self._attr_target_temperature),
                self._attr_fan_mode,
            ),
        )
        await self.hass.services.async_call(
            "remote",
            "send_command",
            {
                "entity_id": self._remote_id,
                "device": self._device_name,
                "command": f"b64:{code}",
            },
            blocking=True,
        )

    async def async_set_hvac_mode(self, hvac_mode: HVACMode) -> None:
        if hvac_mode == HVACMode.OFF:
            await self._send(False)
        else:
            self._mode = HVAC_MODES[hvac_mode]
            await self._send(True)
        self._attr_hvac_mode = hvac_mode
        self.async_write_ha_state()

    async def async_turn_on(self) -> None:
        await self.async_set_hvac_mode(
            next(m for m, v in HVAC_MODES.items() if v == self._mode)
        )

    async def async_turn_off(self) -> None:
        await self.async_set_hvac_mode(HVACMode.OFF)

    async def async_set_temperature(self, **kwargs: Any) -> None:
        if ATTR_TEMPERATURE in kwargs:
            self._attr_target_temperature = int(
                min(MAX_TEMP, max(MIN_TEMP, kwargs[ATTR_TEMPERATURE]))
            )
        mode = kwargs.get("hvac_mode")
        if mode is not None:
            await self.async_set_hvac_mode(mode)
            return
        # The unit takes the whole state at once: sending while off would switch it on.
        if self._attr_hvac_mode != HVACMode.OFF:
            await self._send(True)
        self.async_write_ha_state()

    async def async_set_fan_mode(self, fan_mode: str) -> None:
        self._attr_fan_mode = fan_mode
        if self._attr_hvac_mode != HVACMode.OFF:
            await self._send(True)
        self.async_write_ha_state()


def _alexa_config(hass: HomeAssistant):
    """Find the config of a self-hosted Alexa skill.

    Home Assistant keeps it on the view that serves the skill and nowhere else,
    so there is no supported way to ask for it. Everything here is best effort.
    """
    try:
        routes = hass.http.app.router.routes()
    except AttributeError:
        return None

    for route in routes:
        resource = getattr(route, "resource", None)
        if getattr(resource, "canonical", None) != ALEXA_ENDPOINT:
            continue
        handler = getattr(route, "handler", None)
        view = getattr(handler, "__self__", None)
        config = getattr(view, "smart_home_config", None)
        if config is not None:
            return config
        for cell in getattr(handler, "__closure__", None) or ():
            try:
                candidate = cell.cell_contents
            except ValueError:
                continue
            config = getattr(candidate, "smart_home_config", None)
            if config is not None:
                return config
    return None


class RemotePowerSwitch(SwitchEntity, RestoreEntity):
    """An on/off key pair, so assistants see a device instead of two scenes.

    Infrared is one way: the state here is what we last sent, not what the
    appliance is doing. `assumed_state` says so, and Home Assistant draws the
    two buttons rather than a toggle because of it.
    """

    _attr_has_entity_name = True
    _attr_name = None  # the control's own name, with nothing appended
    _attr_should_poll = False
    _attr_assumed_state = True

    def __init__(self, entry: ConfigEntry, device, remote_id: str, control, power):
        self._remote_id = remote_id
        self._device_name = control.get("device")
        self._on = power.get("on")
        self._off = power.get("off")
        self._attr_unique_id = f"{entry.entry_id}:{control['id']}:power"
        self._attr_icon = "mdi:power"
        self._attr_device_info = _control_device(entry, device, control)
        self._attr_is_on = False
        self.entity_id = "switch." + slugify(f"{OBJECT_ID_PREFIX} {control['name']}")

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_CODE_SENT, self._on_code_sent)
        )
        last = await self.async_get_last_state()
        if last is not None:
            self._attr_is_on = last.state == "on"

    @callback
    def _on_code_sent(self, remote_id, device, name, code) -> None:
        """Follow its own keys and, on an air conditioner, the power every code carries."""
        if remote_id != self._remote_id or device != self._device_name:
            return
        if name is not None and name in (self._on, self._off):
            on = name == self._on
        else:
            state = recognize(code)
            if state is None:
                return
            on = state.power
        if on != self._attr_is_on:
            self._attr_is_on = on
            self.async_write_ha_state()

    async def _press(self, command: str | None) -> None:
        if command is None:
            return
        await self.hass.services.async_call(
            "remote",
            "send_command",
            {
                "entity_id": self._remote_id,
                "device": self._device_name,
                "command": command,
            },
            blocking=True,
        )

    async def async_turn_on(self, **kwargs) -> None:
        await self._press(self._on)
        self._attr_is_on = True
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        await self._press(self._off)
        self._attr_is_on = False
        self.async_write_ha_state()


async def _async_tell_alexa(
    hass: HomeAssistant, entity_ids: list[str], *, gone: bool
) -> bool:
    """Send one discovery message about these keys.

    Home Assistant sends these only for Nabu Casa accounts; a self-hosted skill
    is left to find out on its own. When anything is missing — no Alexa, no
    proactive reporting, no grant yet — the user still has "discover devices".
    """
    try:
        from homeassistant.components.alexa.state_report import (
            async_send_add_or_update_message,
            async_send_delete_message,
        )
    except ImportError:
        return False

    if not entity_ids:
        return False

    config = _alexa_config(hass)
    if config is None:
        _LOGGER.debug("No self-hosted Alexa skill set up; keys not reported")
        return False
    if not getattr(config, "should_report_state", False):
        _LOGGER.debug("Alexa proactive reporting is off; keys not reported")
        return False

    if not gone:
        entity_ids = [e for e in entity_ids if config.should_expose(e)]
        if not entity_ids:
            return False
    send = async_send_delete_message if gone else async_send_add_or_update_message
    try:
        await send(hass, config, entity_ids)
    except Exception as err:  # the skill is Amazon's, every failure is theirs
        _LOGGER.debug("Alexa refused the key list (%s); ask it to discover", err)
        return False
    _LOGGER.info(
        "Told Alexa to %s %s", "forget" if gone else "add", ", ".join(entity_ids)
    )
    return True


async def async_announce_to_alexa(hass: HomeAssistant, entity_ids: list[str]) -> bool:
    """Hand new keys to Alexa, so the user does not have to run a discovery."""
    return await _async_tell_alexa(hass, entity_ids, gone=False)


async def async_forget_in_alexa(hass: HomeAssistant, entity_ids: list[str]) -> bool:
    """Drop deleted keys from Alexa, so no dead scene is left behind."""
    return await _async_tell_alexa(hass, entity_ids, gone=True)


def _control_device(entry: ConfigEntry, emitter, control) -> DeviceInfo:
    """One device per control, named as the user named it.

    A blaster holds several remotes — a TV, an air conditioner, a fan — so the
    emitter's name is the wrong one to carry: Home Assistant prefixes an
    entity's name with its device's, and "<blaster> <remote> <key>" is not
    something anyone can say out loud.
    """
    parent = dr.async_get(emitter._hass).async_get_device_by_identifier(
        next(iter(emitter.device_info["identifiers"])), entry.entry_id
    )
    return DeviceInfo(
        identifiers={(DOMAIN, f"{entry.entry_id}:{control['id']}")},
        name=control["name"],
        manufacturer="Tuya Selfhost",
        model=MODEL,
        **({"via_device_id": parent.id} if parent else {}),
    )
