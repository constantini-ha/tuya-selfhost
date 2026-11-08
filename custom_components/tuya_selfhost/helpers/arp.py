"""Read the kernel ARP cache, the only place a device's MAC is known locally."""

import logging

_LOGGER = logging.getLogger(__name__)


def arp_table() -> dict[str, str]:
    """Map IP to MAC. Empty when Home Assistant does not share the host network."""
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
