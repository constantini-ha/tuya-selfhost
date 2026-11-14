<p align="center">
  <img src="custom_components/tuya_selfhost/brand/icon.svg" width="88" alt="">
</p>

<h1 align="center">Tuya Selfhost</h1>

<p align="center">
  Your Tuya and Smart&nbsp;Life devices, controlled over your own network.<br>
  No cloud, no developer account, no internet needed to switch on a light.
</p>

<p align="center">
  <a href="https://github.com/constantini-ha/tuya-selfhost/releases"><img src="https://img.shields.io/github/v/release/constantini-ha/tuya-selfhost?style=flat-square&color=41BDF5" alt="release"></a>
  <img src="https://img.shields.io/badge/Home_Assistant-2026.6+-41BDF5?style=flat-square" alt="Home Assistant 2026.6+">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT">
  <img src="https://img.shields.io/badge/devices-1676-orange?style=flat-square" alt="1676 devices">
</p>

<p align="center">
  <b>English</b> · <a href="README.pt-BR.md">Português</a> · <a href="README.es.md">Español</a>
</p>

---

## What changes

```
         CLOUD                              LOCAL

  📱 ──▶ ☁️  ──▶ 🏠 💡            📱 ──▶ 🏠 💡

  3 hops, ~800 ms                   1 hop, ~40 ms
  dies when your ISP dies           keeps working
  the vendor sees everything        nothing leaves your network
```

Once a device is set up you can **block it at the router** and it carries on
answering. The `network_report` action lists every device's MAC for exactly that.

## Installation

[![Open in Marketplace](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=constantini-ha&repository=tuya-selfhost&category=integration)

In **Marketplace** (or HACS before 2026.11), add `constantini-ha/tuya-selfhost` as a
custom repository of type integration, install and restart.

## Adding a device

[![Add integration](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=tuya_selfhost)

```
  ┌─ cloud assisted (recommended) ──────────────────────────┐
  │  QR login in the app  →  pick the device from the list   │
  │  →  its IP is found for you  →  done                     │
  └──────────────────────────────────────────────────────────┘
  ┌─ manual ────────────────────────────────────────────────┐
  │  you supply device id, local key, IP and protocol        │
  └──────────────────────────────────────────────────────────┘
```

The QR login only fetches the `local_key`; the key is stored and the session is
not. Field by field in **[CONFIGURATION.md](CONFIGURATION.md)**, and how to find
the values by hand in **[DEVICE_DETAILS.md](DEVICE_DETAILS.md)**.

**Re-paired the device in the app?** Use **Reconfigure** on the entry instead of
deleting it: entity ids, history, area and learned codes all come along.

## Supported devices

**[DEVICES.md](DEVICES.md) lists all 1676 configurations**, by category.

| How it connects | What that covers |
| --- | --- |
| **Wi-Fi, directly** | The bulk of the catalogue: switches, plugs, lights, climate, fans, locks, sensors, covers, vacuums, water heaters |
| **Zigbee behind a Tuya gateway** | Sub-devices reached through the hub, configured with their `device_cid`. The gateway keeps its cloud connection; the sub-devices do not need one |
| **IR and RF through a blaster** | Any appliance, by copying its original remote — see below |
| **Bluetooth** | Not yet. The Wi-Fi modules do advertise it, and the groundwork is under way |

Yours missing? The config flow log prints what you need for an
[issue](https://github.com/constantini-ha/tuya-selfhost/issues), and writing a new
one is just a YAML file, documented in
[custom_components/tuya_selfhost/devices/README.md](custom_components/tuya_selfhost/devices/README.md).

## IR and RF remote builder

Open **Tuya Selfhost** in the sidebar. No protocol integration works with your
air conditioner? Copy the real remote instead.

```
  Tuya Selfhost                                  [Add to dashboard]
  ┌────────────┬────────────┬────────────┐
  │  ❄ Cool 22 │  ⏻ Off     │     +      │   tap without a code → learn
  │  learned   │  learned   │            │   tap with a code    → test
  │  ← → ⟳ ✕   │  ← → ⟳ ✕   │            │   ← →  position
  └────────────┴────────────┴────────────┘
       every capture asks:  Test · Keep · Discard
```

Works with any brand, because it depends on no protocol at all — it is your own
signal, recorded and replayed. Full recipe in
**[LEARNED_REMOTES.md](LEARNED_REMOTES.md)** ·
[pt-BR](LEARNED_REMOTES.pt-BR.md) · [es](LEARNED_REMOTES.es.md)

## Scenes

The panel opens with **Scenes**: one tap does several things at once, like
Tap-to-Run in the Smart Life app. Pick a name and an icon, add the steps — a
device to turn on or off, a learned remote key to press, a wait — and save. A
scene is an ordinary Home Assistant script whose id starts with `tuya_scene_`,
so it also works in dashboards and automations.

Saving a scene sends it to Alexa on the spot when the self-hosted skill reports
state: say "Alexa, turn on" and the name of the scene. The `alexa:` filter must
let it through, with `script.tuya_scene_*` under `include_entity_globs`; the
generated block already carries that line.

## Alexa

The **Alexa configuration** action builds the whole `alexa:` block from your
entities, ready to paste. The guide covers the self-hosted skill without Nabu Casa
and the proactive reporting catch, which is what makes the Alexa app track state
for real: **[ALEXA.md](ALEXA.md)** · [pt-BR](ALEXA.pt-BR.md) · [es](ALEXA.es.md)

## When something breaks

Errors 901, 905 and 914, devices dropping off the network, locks, hubs and
blasters: **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**.

## Actions

| Action | What it does |
| --- | --- |
| `tuya_selfhost.network_report` | Lists every device's IP and MAC, and which are safe to cut off the internet |
| `tuya_selfhost.alexa_config` | Generates the complete `alexa:` block from your entities |
| `tuya_selfhost.send_learned_ir_command` | Fires a learned code through an infrared emitter |

## Contributing

Issues and pull requests welcome. A new device configuration is the most useful
contribution: one YAML in `custom_components/tuya_selfhost/devices/` and a test.

## License

[MIT](LICENSE.md).
