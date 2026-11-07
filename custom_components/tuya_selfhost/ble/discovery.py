"""Recover a device's uuid from what it broadcasts, with no cloud round trip."""

import hashlib
import logging

from Crypto.Cipher import AES

_LOGGER = logging.getLogger(__name__)

SERVICE_UUID = "0000a201-0000-1000-8000-00805f9b34fb"
MANUFACTURER_ID = 2000


def uuid_from_advertisement(service_info) -> str | None:
    """Decrypt the uuid a Tuya module carries in its advertisement.

    The service data holds the product id (byte 0 is 0) or the product key
    (byte 0 is 1); either one, hashed, is the key and IV for the uuid that
    travels in the manufacturer data.
    """
    payload = (service_info.service_data or {}).get(SERVICE_UUID)
    manufacturer = (service_info.manufacturer_data or {}).get(MANUFACTURER_ID)
    if not payload or len(payload) < 2 or not manufacturer or len(manufacturer) < 22:
        return None
    try:
        key = hashlib.md5(payload[1:]).digest()
        decrypted = AES.new(key, AES.MODE_CBC, key).decrypt(manufacturer[6:])
        uuid = decrypted.decode("utf-8")
    except (ValueError, UnicodeDecodeError) as err:
        _LOGGER.debug("%s: uuid not readable from advertisement: %s",
                      service_info.address, err)
        return None
    return uuid if uuid.isprintable() else None
