"""
Passive Tuya LAN scanner without ``select()``.

tinytuya's scanner drives its sockets through ``select.select``, which raises
``ValueError: filedescriptor out of range in select()`` whenever the process
holds file descriptors numbered above FD_SETSIZE (1024). A loaded Home
Assistant crosses that line easily, so every ``tinytuya.find_device`` /
``deviceScan`` call starts failing permanently once the instance has been up
for a while — silently killing LAN rediscovery.

This module listens on the Tuya broadcast ports itself using ``selectors``
(epoll on Linux, no fd limit) and reuses tinytuya's ``decrypt_udp`` payload
parser, so all broadcast formats tinytuya understands (plain 6666, AES-ECB
6667 and the 6699/GCM variant) are supported without duplicating protocol
knowledge. Tuya devices announce themselves every few seconds while they have
no active local TCP connection — exactly the state an unreachable device is
in — so passive listening is sufficient for relocation and discovery.

All functions are blocking and must run in an executor.
"""

import json
import logging
import selectors
import socket
import time

import tinytuya

_LOGGER = logging.getLogger(__name__)

BROADCAST_PORTS = (6666, 6667, 6699)
DEFAULT_TIMEOUT = 18.0


def _parse(raw: bytes) -> dict | None:
    """Decode one broadcast datagram into tinytuya's result dict."""
    try:
        payload = tinytuya.decrypt_udp(raw)
        result = json.loads(payload)
    except Exception:  # datagrama alheio/corrompido não pode matar o scan
        return None
    if not isinstance(result, dict):
        return None
    # normaliza no formato do tinytuya (deviceScan): id em gwId
    if "gwId" not in result and "id" in result:
        result["gwId"] = result["id"]
    return result


def scan_devices(
    wanted_ids: set | None = None, timeout: float = DEFAULT_TIMEOUT
) -> dict:
    """Listen for Tuya broadcasts and return ``{gwId: info}``.

    ``info`` carries at least ``ip``, ``gwId``, ``version`` and usually
    ``productKey``. When ``wanted_ids`` is given, returns early as soon as all
    of them have been seen.
    """
    found: dict[str, dict] = {}
    sel = selectors.DefaultSelector()
    socks = []
    try:
        for port in BROADCAST_PORTS:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                sock.setblocking(False)
                sock.bind(("", port))
            except OSError as err:
                _LOGGER.debug("Porta %s indisponível para escuta: %s", port, err)
                continue
            socks.append(sock)
            sel.register(sock, selectors.EVENT_READ)
        if not socks:
            return found

        deadline = time.monotonic() + timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            for key, _ in sel.select(timeout=min(remaining, 1.0)):
                try:
                    raw, addr = key.fileobj.recvfrom(4096)
                except OSError:
                    continue
                info = _parse(raw)
                if not info:
                    continue
                gwid = info.get("gwId")
                if not gwid:
                    continue
                info.setdefault("ip", addr[0])
                found[gwid] = info
            if wanted_ids and wanted_ids.issubset(found.keys()):
                break
    finally:
        sel.close()
        for sock in socks:
            sock.close()
    return found


def find_device(device_id: str, timeout: float = DEFAULT_TIMEOUT) -> dict:
    """Locate one device by id; mirrors ``tinytuya.find_device``'s shape."""
    found = scan_devices({device_id}, timeout)
    info = found.get(device_id)
    if not info:
        return {"ip": None, "version": ""}
    return info


def scan_all(timeout: float = DEFAULT_TIMEOUT) -> dict:
    """Scan the LAN; returns ``{ip: info}`` like ``tinytuya.deviceScan``."""
    return {
        info["ip"]: info
        for info in scan_devices(None, timeout).values()
        if info.get("ip")
    }
