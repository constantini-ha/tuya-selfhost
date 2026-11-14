"""Nova Digital SA-6 Safira, a Tuya TS0601 six-gang wall switch.

The `_TZE28C1000000_` module prefix is newer than the `_TZE204_` units covered
upstream, so no existing fingerprint matches. Datapoints are identical.
"""

from zigpy.profiles import zha

from zhaquirks.tuya.builder import TuyaQuirkBuilder

DEVICES = (("_TZE28C1000000_gxbdnfrh", "TS0601"),)

(
    TuyaQuirkBuilder(*DEVICES[0])
    .friendly_name(manufacturer="Nova Digital", model="SA-6")
    # same device type as endpoint 1, so all six gangs land on the switch platform
    .adds_endpoint(2, device_type=zha.DeviceType.SMART_PLUG)
    .adds_endpoint(3, device_type=zha.DeviceType.SMART_PLUG)
    .adds_endpoint(4, device_type=zha.DeviceType.SMART_PLUG)
    .adds_endpoint(5, device_type=zha.DeviceType.SMART_PLUG)
    .adds_endpoint(6, device_type=zha.DeviceType.SMART_PLUG)
    .tuya_onoff(dp_id=1, endpoint_id=1)
    .tuya_onoff(dp_id=2, endpoint_id=2)
    .tuya_onoff(dp_id=3, endpoint_id=3)
    .tuya_onoff(dp_id=4, endpoint_id=4)
    .tuya_onoff(dp_id=5, endpoint_id=5)
    .tuya_onoff(dp_id=6, endpoint_id=6)
    # this unit reports datapoints only; the genOnOff bind fails with INVALID_EP
    .tuya_enchantment()
    .add_to_registry()
)
