"""A notice each time an automation runs: whether it worked, in Home Assistant and on phones.

Automations made in the panel give one unless it is turned off; others only when turned on.
Phones are the ones with the Home Assistant app; none chosen means every one of them.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any
from urllib.parse import quote

import voluptuous as vol

from homeassistant.components import persistent_notification, websocket_api
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util, slugify

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

DATA = f"{DOMAIN}_notices"
AUTO_PREFIX = "tuya_auto_"
PHONE_PREFIX = "mobile_app_"
PANEL_PATH = "/tuya-selfhost"
# A command that falls back to Bluetooth can take a minute.
WAIT = 120
# Without a trace by then (traces turned off), the notice only says it ran.
NO_TRACE = 5

TEXTS = {
    "en": {
        "done": "Done at {time}.",
        "failed": "Did not work at {time}: {error}",
        "stopped": "Stopped before the end, at {time}.",
        "ran": "Ran at {time}.",
    },
    "pt": {
        "done": "Feito às {time}.",
        "failed": "Não deu certo às {time}: {error}",
        "stopped": "Parou antes do fim, às {time}.",
        "ran": "Rodou às {time}.",
    },
    "es": {
        "done": "Hecho a las {time}.",
        "failed": "No funcionó a las {time}: {error}",
        "stopped": "Se detuvo antes del final, a las {time}.",
        "ran": "Se ejecutó a las {time}.",
    },
}


def notice_text(language: str | None, execution: str | None, error: str | None) -> str:
    texts = TEXTS.get((language or "en").split("-")[0], TEXTS["en"])
    time = dt_util.now().strftime("%H:%M")
    if error:
        return texts["failed"].format(time=time, error=error)
    if execution is None:
        return texts["ran"].format(time=time)
    return texts["done" if execution == "finished" else "stopped"].format(time=time)


class Notices:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.settings: dict[str, dict[str, Any]] = {}
        self._store: Store = Store(hass, 1, f"{DOMAIN}.automation_notices")
        self._unsub = None

    async def async_start(self) -> None:
        self.settings = await self._store.async_load() or {}
        self._unsub = self.hass.bus.async_listen("automation_triggered", self._on_run)

    @callback
    def async_stop(self) -> None:
        if self._unsub:
            self._unsub()
            self._unsub = None

    def setting(self, automation_id: str) -> dict[str, Any]:
        saved = self.settings.get(automation_id)
        if saved is not None:
            return saved
        return {"on": automation_id.startswith(AUTO_PREFIX), "phones": None}

    async def async_set(
        self, automation_id: str, on: bool, phones: list[str] | None
    ) -> None:
        self.settings[automation_id] = {"on": on, "phones": phones}
        await self._store.async_save(self.settings)

    def phones(self) -> dict[str, str]:
        """The notify service of each phone with the app, and the phone's name."""
        names = {}
        for entry in self.hass.config_entries.async_entries("mobile_app"):
            name = entry.data.get("device_name") or entry.title
            names[PHONE_PREFIX + slugify(name)] = name
        return {
            service: names.get(service, service[len(PHONE_PREFIX) :].replace("_", " "))
            for service in sorted(
                self.hass.services.async_services_for_domain("notify")
            )
            if service.startswith(PHONE_PREFIX)
        }

    @callback
    def _on_run(self, event: Event) -> None:
        entry = er.async_get(self.hass).async_get(event.data.get("entity_id") or "")
        if entry is None or not entry.unique_id:
            return
        setting = self.setting(entry.unique_id)
        if not setting["on"]:
            return
        name = event.data.get("name") or entry.original_name or entry.entity_id
        self.hass.async_create_background_task(
            self._notify(entry.unique_id, name, event.context.id, setting["phones"]),
            f"{DOMAIN} automation notice",
        )

    async def _outcome(
        self, automation_id: str, context_id: str
    ) -> tuple[str | None, str | None]:
        """How the run ended and its error, read from its trace once it stops."""
        try:
            from homeassistant.components.trace.util import (  # noqa: PLC0415
                async_get_trace,
                async_list_contexts,
            )
        except ImportError:
            return None, None
        key = f"automation.{automation_id}"
        for second in range(WAIT):
            await asyncio.sleep(1)
            try:
                run = (await async_list_contexts(self.hass, key)).get(context_id)
                trace = run and await async_get_trace(self.hass, key, run["run_id"])
            except KeyError, AttributeError, TypeError:
                return None, None
            if not run:
                if second >= NO_TRACE:
                    return None, None
                continue
            if trace.get("state") == "stopped":
                return trace.get("script_execution"), trace.get("error")
        return None, None

    async def _notify(
        self, automation_id: str, name: str, context_id: str, chosen: list[str] | None
    ) -> None:
        execution, error = await self._outcome(automation_id, context_id)
        # In restart mode a newer run took over; that one gives the notice.
        if execution == "cancelled":
            return
        message = notice_text(self.hass.config.language, execution, error)
        tag = f"{DOMAIN}_{automation_id}"
        url = f"{PANEL_PATH}?automation={quote(automation_id)}"
        persistent_notification.async_create(
            self.hass, message, title=name, notification_id=tag
        )
        phones = self.phones()
        for service in phones if chosen is None else [s for s in chosen if s in phones]:
            try:
                await self.hass.services.async_call(
                    "notify",
                    service,
                    {
                        "title": name,
                        "message": message,
                        # The newest notice of an automation replaces the one before.
                        "data": {
                            "tag": tag,
                            "group": DOMAIN,
                            "url": url,
                            "clickAction": url,
                        },
                    },
                )
            except HomeAssistantError as err:
                _LOGGER.warning(
                    "Could not send the notice of %s to %s: %s", name, service, err
                )


async def async_start_notices(hass: HomeAssistant) -> None:
    """Start once; safe to call for every entry."""
    if DATA in hass.data:
        return
    notices = Notices(hass)
    hass.data[DATA] = notices
    await notices.async_start()
    if not hass.data.get(f"{DATA}_ws"):
        hass.data[f"{DATA}_ws"] = True
        websocket_api.async_register_command(hass, websocket_get_notice)
        websocket_api.async_register_command(hass, websocket_set_notice)


@callback
def async_stop_notices(hass: HomeAssistant) -> None:
    notices = hass.data.pop(DATA, None)
    if notices is not None:
        notices.async_stop()


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/notice/get",
        vol.Optional("automation_id"): vol.Any(str, None),
    }
)
@websocket_api.require_admin
@callback
def websocket_get_notice(hass, connection, msg):
    """The phones that can get notices and the choice for one automation."""
    notices: Notices | None = hass.data.get(DATA)
    if notices is None:
        connection.send_error(
            msg["id"], "not_ready", "No Tuya Selfhost device is set up"
        )
        return
    automation_id = msg.get("automation_id") or AUTO_PREFIX
    connection.send_result(
        msg["id"],
        {
            "available": [{"id": k, "name": v} for k, v in notices.phones().items()],
            **notices.setting(automation_id),
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/notice/set",
        vol.Required("automation_id"): str,
        vol.Required("on"): bool,
        vol.Optional("phones"): vol.Any(None, [str]),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def websocket_set_notice(hass, connection, msg):
    notices: Notices | None = hass.data.get(DATA)
    if notices is None:
        connection.send_error(
            msg["id"], "not_ready", "No Tuya Selfhost device is set up"
        )
        return
    await notices.async_set(msg["automation_id"], msg["on"], msg.get("phones"))
    connection.send_result(msg["id"], {"saved": True})
