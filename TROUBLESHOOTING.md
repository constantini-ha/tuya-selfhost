# Quando algo não funciona

> 🏠 [Voltar ao README](README.md)

Páginas irmãs: [DEVICE_DETAILS.md](DEVICE_DETAILS.md) para achar device id e local key, [CONFIGURATION.md](CONFIGURATION.md) para o significado de cada campo, [LEARNED_REMOTES.md](LEARNED_REMOTES.md) para blasters IR/RF.

## Offline operation issues


Many Tuya devices will stop responding if unable to connect to the
Tuya servers for an extended period.  Reportedly, some devices act
better offline if DNS as well as TCP connections is blocked.


## General issues


Many Tuya devices do not handle multiple commands sent in quick
succession.  Some will reboot, possibly changing state in the process,
others will go offline for 30s to a few minutes if you overload them.
There is some rate limiting to try to avoid this, but it is not
sufficient for some devices, and may not work across entities where
you are sending commands to multiple entities on the same device.  The
rate limiting also combines commands, which not all devices can
handle. If you are sending commands from an automation, it is best to
add delays between commands - if your automation is for multiple
devices, it might be enough to send commands to other devices first
before coming back to send a second command to the first one, or you
may still need a delay after that.  The exact timing depends on the
device, so you may need to experiment to find the minimum delay that
gives reliable results.

Most devices can handle multiple commands in a single message, so for
entity platforms that support it (eg climate `set_temperature` can
include presets, lights pretty much everything is set through
`turn_on`) multiple settings are sent at once.  But some devices do
not like this and require all commands to set only a single dp at a
time, so you may need to experiment with your automations to see
whether a single command or multiple commands (with delays, see above)
work best with your devices.

When adding devices, some devices that are detected as protocol version
3.3 at first require version 3.2 to work correctly. Either they cannot be
detected, or work as read-only if the pprotocol is set to 3.3.


## Connecting to devices via hubs


If your device connects via a hub (eg. battery powered water timers) you have to provide the following info when adding a new device:

- Device id (uuid): this is the **hub's** device id
- IP address or hostname: the **hub's** IP address or hostname
- Local key: the **hub's** local key
- Sub device id: the **actual device you want to control's** `node_id`. Note this `node_id` differs from the device id, you can find it with tinytuya as described below.


## Secure locks


Many locks are designed with basic security controls to make remote unlocking
more difficult. This integration supports the standard BLE lock model from Tuya
which uses a pair of dps (60: `remote_no_pd_seykey`, 61: `remote_no_dp_key`)
to share a key between the app and the lock during the pairing phase.
If you have access to the Tuya developer portal, you can eavesdrop on the
second of these messages when the app is used to unlock the lock remotely.
If you capture the value sent by the app, then you can decode it using a base64
decoder such as https://base64decode.org.
The format has 4 bytes of binary data, followed by an 8 digit ASCII numeric
code, followed by 3 or 4 more bytes of binary data.

The 8 digit numeric code from the first app that was paired should work for
unlocking the lock.

Although this is documented in the BLE lock documentation from Tuya, Zigbee
and WiFi locks often use the same naming for datapoints, which may be
compatible with this scheme.


## IR/RF blasters


Tuya IR and RF blasters are exposed as remote entities and support learning and
sending commands via the standard Home Assistant remote services. IR blasters are
also exposed as general `infrared` emitters, and learned commands can be sent to
other `infrared` emitters using the tuya-local specific "Send Learned IR command"
service.

### Learning commands

Use the `remote.learn_command` service with:
- `command`: the name to store the command under (e.g. `power`)
- `device`: a name for the appliance being controlled (e.g. `TV`)
- `command_type`: set to `rf` for RF remotes, omit or leave blank for IR

The integration will put the blaster into learning mode and wait up to 30 seconds
for you to press a button on the original remote. The learned code is stored
persistently and survives restarts.

### Sending commands

Using the `infrared` platform, you can send known IR commands using
other HA integrations, including
[HAIR](https://github.com/DAB-LABS/HAIR), a custom integration for
learning remote commands via an ESPHome receiver and sending them to
any supported `infrared` emitter.

To send learned commands using the same `remote` entity, you use the
`remote.send_command` service with the same `command` and `device`
values used when learning. You can also send known Tuya codes directly
without learning first:

- **IR inline code**: prefix with `b64:` followed by the base64-encoded IR code
- **RF inline code**: prefix with `rf:` followed by the base64-encoded RF code

There is also a special `send_learned_ir_command` service for sending commands
learned by the `remote` entity to any `infrared` emitter (including non-Tuya ones).
To use this, you must specify the `remote` entity the learned command was saved
with, the target `infrared` emitter entity, and the `command` and optional `device`
the command was saved as.


### UI

If you would like to expose the learnt commands as buttons in the user interface
you might want to take a look at the [Remote buttons](https://github.com/kongo09/remote_buttons)
integration, which is compatible with Tuya Local.


## Pet feeders


Many pet feeders expose an encoded **Meal plan** setting via a text entity. By default this is disabled, but you can enable it under the Device settings in HA. When enabled many pet feeders share the same underlying format, which is supported by the [FrederikM97/mealplan-card](https://github.com/FredrikM97/mealplan-card) custom card.

