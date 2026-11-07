# Controlling a device your blaster has no protocol for

> 🇧🇷 [Português](LEARNED_REMOTES.pt-BR.md) · 🇪🇸 [Español](LEARNED_REMOTES.es.md)

Protocol integrations such as `gree_infrared` only work when your appliance
really speaks that protocol. Plenty of air conditioners, TVs and fans sold under
local brands do not, and no amount of configuration will change that.

The way out is to stop guessing the protocol and copy the signal instead: teach
the blaster your physical remote, then replay it.

## The easy way: the Controles Tuya page

The integration ships a builder. Open **Controles Tuya** in the sidebar, create a
control, add buttons with a name and an icon, and teach them one at a time. Each
capture offers **Test / Keep / Discard**, so a bad reading never silently
replaces a good one, and the arrows under each button set its position.

When the control is ready, **Add to dashboard** drops the finished card into your
first view. Everything below is the same thing done by hand, for anyone who
prefers YAML or needs it inside an automation.

## The one thing to understand first

**Air conditioner remotes do not send "one degree warmer".** Every press
transmits the *entire* state — power, mode, temperature, fan speed, swing — in a
single frame. So there is no "+" button to learn; "cool at 22" and "cool at 23"
are two completely different codes.

This is why a protocol integration either works entirely or not at all, and why
learning only the states you actually use is the sensible approach. Three or four
codes cover normal life.

## Learning a code

Point the physical remote at the blaster, about 20 cm away, then call:

```yaml
action: remote.learn_command
target:
  entity_id: remote.your_blaster
data:
  device: ac
  command: "on_cool_22"
```

A notification appears and you have 30 seconds to press the button. Set the
remote to the exact state you want *before* pressing, because that whole state is
what gets captured.

Useful codes to start with: turning on at your usual temperature, turning off,
and one colder and one warmer setting.

## Replaying it

```yaml
action: remote.send_command
target:
  entity_id: remote.your_blaster
data:
  device: ac
  command: "on_cool_22"
```

Raw codes work too, without learning anything, if you already have them from
another source:

```yaml
data:
  command: "b64:JgBQAAABKJM..."
```

## A dashboard card

This is the pattern, with a learning button so you can add codes without editing
anything:

```yaml
type: grid
cards:
  - type: heading
    heading: Air conditioner
  - type: horizontal-stack
    cards:
      - type: button
        name: On
        icon: mdi:air-conditioner
        show_state: false
        tap_action:
          action: perform-action
          perform_action: remote.send_command
          target:
            entity_id: remote.your_blaster
          data:
            device: ac
            command: on_cool_22
      - type: button
        name: Off
        icon: mdi:power
        show_state: false
        tap_action:
          action: perform-action
          perform_action: remote.send_command
          target:
            entity_id: remote.your_blaster
          data:
            device: ac
            command: "off"
  - type: button
    name: Learn "off"
    icon: mdi:school-outline
    show_state: false
    tap_action:
      action: perform-action
      perform_action: remote.learn_command
      target:
        entity_id: remote.your_blaster
      data:
        device: ac
        command: "off"
```

## What you give up

Infrared is one way. Home Assistant knows what it sent, never what the appliance
did, and a press on the physical remote is invisible to it. Buttons are honest
about this in a way a thermostat dial is not — the dial implies a state Home
Assistant cannot actually read.

## Your codes survive a device swap

Learned codes are stored per device id. If you ever re-pair the blaster in the
Tuya app it gets a new id, which used to orphan every code you had taught it. Use
**Reconfigure** on the entry instead of deleting it and the codes travel with it.
