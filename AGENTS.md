# Instructions for autonomous agents

## Development environment

- This project is a Home Assistant integration.
- The source languages are Python, YAML and JSON
- package management is using `uv`
  If it is not already installed, it can be installed using:
```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
```
- Use `uv run ...` to run commands on the project

## Coding standards

- Python files should be checked with `uv run ruff check`, `uv run ruff check --select -I`
- Python files should be formatted consistently with `uv run ruff format`
- YAML files for device configuration should be checked with `uv run yamllint`
- YAML files for device configuration must be located in the custom_components/tuya_selfhost/devices folder
- Python files implementing the HA integration must be located in custom_components/tuya_selfhost and its subfolders, with unit tests in tests and its subfolders.
- JSON files for translations are located in the custom_components/tuya_selfhost/translations folder.
- Icons for translation keys are defined in custom_components/tuya_selfhost/icons.json, and use icons from the material design icons at https://pictogrammers.com/library/mdi/
- Where possible, new devices should use existing translation_keys which are present in custom_components/tuya_selfhost/translations/*.json and custom_components/tuya_selfhost/icons.json
- if new translation_keys are added, they should be generic, not device specific, and translations in the appropriate language should be added to all files in custom_components/tuya_selfhost/translations and relevant icons to custom_components/tuya_selfhost/icons.json. It is best to submit additional translations as a separate PR request from new device submissions, as they can involve a lot of rework to existing configs.
- Device and entity names should follow the Home Assistant naming guidelines. Only the first word should be capitalised.
- Try to keep device and entity names concise.
- Top level names should be unbranded and without redundant words like "Smart" or "WiFi".

## Information gathering for new device configs

- When an unsupported device is attempted to be added to this integration, a WARNING level log message containing "LOCAL DPS" is output. This is essential information to determine which dps are present when the device is discovered by this integration. Any dps that are not present in this log message must be marked with `optional: true` in the config so that they are not required for matching.
- The Tuya developer platform is accessible at https://platform.tuya.com. The user should sign up for an account to get access to detailed information about their device.
- The DEVICE_ID for the user's device is required. They can get this from their list of devices in the Tuya developer portal, or from `tinytuya scan`.
- Product id for inclusion in the products section is available from the "Query Device Details" API call in the Cloud API Explorer on https://platform.tuya.com. This is also available as an api call at https://openapi.tuyaus.com/v2.0/cloud/thing/${DEVICE_ID} with some complex authentication. tuyaus may be tuyaeu or another string depending on region. If the region is wrong, a "space permission" error will result.
- Full dps information is available from the "Query Things Data Model" API call in the Cloud API Explorer on https://platform.tuya.com. This is also available as an api call at https://openapi.tuyaus.com/v2.0/cloud/thing/${DEVICE_ID}/model with some complex authentication. tuyaus may be tuyaeu or another string depending on region. The result field contains a model field, which is a json string containing the detailed information about the dps under the properties field. abilityId maps to the id, code and name tell the function of the dp, sometimes they do not match, so the user may be need to be prompted for which is correct after translating the name. typeSpec contains information about the type, range and enum values. type raw means base64, value means integer, bitmap means bitfield.

## Rules for making config files

- The configuration file format is defined in `custom_components/tuya_selfhost/devices/device_config_schema.json` and documented in `custom_components/tuya_selfhost/devices/README.md`.
- Likely a device with the same functionality already exists. Search the `custom_components/tuya_selfhost/devices` folder for a device with the same set of functions. `uv run best_match '${LOCAL_LOG}'` can be helpful for finding the closest match.
- If a device config matches perfectly except for the product details, then an entry can be made under the products section of that config for the user's device instead of creating a new config file.
- If a device config is found that is close, but not perfectly matching, it can be used as a template for a new config. If multiple files are close matches, the most recently added one is likely to be the best quality template to follow.
- To create a unique but concise filename, the format `${BRAND}_${MODEL}_${TYPE}.yaml` is used, where ${BRAND} is the brand as ASCII lower case letters and numbers with spaces and punctuation removed, ${MODEL} is the model name or number as ASCII lower case letters and numbers with spaces and punctuation removed, and ${TYPE} is the type of device as lower case ASCII letters with spaces and punctuation removed. If model is unknown, then `${BRAND}_${TYPE}` can be used.
- If the name chosen by this formula already exists, first check if the dps details are a close match, if there are no conflicts then it may be better to modify the exisiting config to add missing details. If this is done, any added dps must be larked as `optional: true` in case the older variant is missing these.
- If the name chosen already exists and is not a match, append v2 to the ${MODEL} portion of the name. If this also exists, try v3, etc.
- The top level `name` inside the config should be generic, without branding, as other brands of device can often match the same config. Branding should go under `products` only.
- The `products` entry for the device must have an `id`, as determined in the information gathering above. If known, the `manufacturer` and `model` should be filled in. Rarely, model is split into a descriptive `model` and a code `model_id`.
- Higher level entities are preferred when they fit a device's functionality. If the device is a heater, airconditioner or heatpump that both heats and cools, there should be a climate entity, and as much functionality as can be supported by the climate entity should go in there. Water heaters with only heat function should be water_heater entities. Humidifiers and dehumidifiers should be humidifier entities. Air purifiers should generally be fan entities.
- Make use of translation keys where possible instead of explicit names and icons
- Primary functions of a device and most sensors should not have a category. Config entities that are not frequently used should have `category: config`. Sensors and binary_sensors that are not generally useful in dashboards should have `category: diagnostic`.
- Certain patterns are used for commonly encountered functions:
    - child lock functions are implemented as `lock` entities with `translation_key: child_lock`.
    - fault sensors are implemented as `binary_sensor` entities with `class: problem`. When they are bitfields (bitmap in Tuya API), 0 should map to false, and the default mapping is to true. The raw value is available as a `fault_code` attribute on the entity, and if sufficient information is available for human readable descriptions of each fault, then a `description` attribute may be added with mapping of `0` to `ok` and other values to the appropriate human readable description.
- where a suitable class is available for a sensor, and it is the only sensor of that class, no name is necessary. Some classes of sensor have translation keys defined for ${CLASS}_x, these can be used when there are multiple sensors of the same class as:
```yaml
   - entity: sensor
     class: ${CLASS}
     translation_key: ${CLASS}_x
     translation_placeholders:
       x: "${N}"
```
     where ${N} is a number, letter or word uniquely identifying that sensor among the class.
     Where no such `translation_key` exists, a unique `name` is required instead.
     Where one sensor stands out as the main sensor for that class, it can be unnamed and without translation_key, and all the others named or translated as above.

- after creating the new device config, run `uv run duplicates ${CONFIG_FILENAME}`. If any 100% matches are listed, then explain the differences between the configs for the PR message.

## Testing instructions

- Find the CI plan in the .github/workflows folder
- Ignore the .github/workflows/hacs-validate.yml workflow if not running from the main repository at https://github.com/constantini-ha/tuya-selfhost
- run `uv run pytest` to run every test defined for the project
- run `uv run pytest tests/test_device_config.py` to test only yaml file changes or additions
- run `uv run pytest tests/test_translations.py` to test only json file changes or additions
- do not add new tests if only making a yaml or json file change
- add new tests if making a python file change that introduces new functionality
- fix any test or lint failures until the whole test suite passes

## PR instructions

- Please separate 
- Always run `uv run ruff check .`, `uv run ruff check --select -I .`, `uv run ruff format --check .` and `uv run yamllint custom_components/tuya_selfhost/devices` before committing

## What this fork adds, and the traps in it

Everything below is specific to tuya-selfhost. None of it exists upstream, and
all of it was learned by running against real hardware — if something here
contradicts your instinct, trust the note.

### The panel and the cards

- `custom_components/tuya_selfhost/frontend/` is served at `/tuya_selfhost/frontend`
  by `remote_card.py`, which also registers the sidebar panel and pushes both
  dashboard cards through `add_extra_js_url`.
- The files are loaded as ES modules, so `import` between files in that folder
  works. `i18n.js` holds every string, in English, Portuguese and Spanish.
- **No user-visible string is ever written inline.** Add the key to all three
  tables in `i18n.js` and call `this._t(key, vars)` in the panel or
  `t(this.hass, key, vars)` in a card. `tn(key)` reads `navigator.language` and
  exists only for the card-picker labels, which run before `hass` is available.
- A custom panel replaces Home Assistant's own header, so it has to provide the
  sidebar button itself by firing `hass-toggle-menu`.
- Style against theme variables (`--primary-color`, `--divider-color`,
  `--secondary-text-color`, …). The panel must look right under any theme.
- Icon buttons in the top bar are styled by `.bar button.menu`; that selector is
  scoped to the bar, so an icon button anywhere else needs `.icon` or it renders
  with the browser's default border.
- **The frontend is served under the version**, `/tuya_selfhost/frontend/<version>/`.
  A `?v=` query only versions the file that carries it: `i18n.js`, reached by a
  relative import, kept being served from cache with strings the rest of the
  build no longer matched. A versioned directory busts everything at once and
  lets the files cache properly.
- **A screen that reads once writes stale data back.** The layouts are shared
  between the panel, the cards and every phone, so each subscribes to
  `tuya_selfhost/layout/subscribe` and re-reads when it fires. The panel skips
  the reload while its own save is in flight.
- A card must not guess an entity id from a name — a rename or a clash breaks it
  silently. `tuya_selfhost/layout/entities` reads the registry and answers which
  entity each control and key became.
- Destructive actions confirm in place: the row or a banner swaps to
  "yes / cancel" rather than opening a dialog. See `_confirmControl` and
  `_confirmButton`.

### Remote layouts and the keys they become

- The panel stores remotes in a `Store` named `tuya_selfhost_remote_layouts`,
  keyed by the remote entity id:
  `{controls: [{id, name, device, buttons: [{command, name, icon, taught}]}]}`.
- Pressing a key calls `remote.send_command` with `device` and `command`.
- `remote_keys.py` turns every **taught** key into a `button` entity, and a
  control's power pair into a `switch`, so voice assistants and automations can
  reach them. It re-syncs on the `tuya_selfhost_layouts_changed` dispatcher
  signal and once at startup. An entity adder belongs to one platform, so the
  pass takes a `kind` and `button.py` and `switch.py` each run their own.
- Platform forwarding in `__init__.py` is derived from the device config's
  entity list, so `button` and `switch` are added explicitly whenever `remote` is present —
  an emitter has neither of its own. `async_tuya_setup_platform` raises
  `ValueError` when a platform has no entities, so `button.py` checks the device
  config before calling it.

### Home Assistant traps that cost real debugging time

- **Mark dispatcher and timer handlers with `@callback`.** Without it Home
  Assistant runs them in a `SyncWorker` thread and any `async_create_task` from
  there raises `RuntimeError: ... from a thread other than the event loop`. This
  has bitten this integration twice: `async_detect_reserve` and
  `remote_keys._schedule`.
- **`suggested_object_id` is only a base.** Home Assistant prefixes it with the
  area and the device, so `tuya_remote_ar_da_sala_frio_22` becomes
  `button.sala_de_estar_controle_remoto_..._tuya_remote_ar_da_sala_frio_22`.
  Where a stable prefix matters — the Alexa filter glob does — set
  `self.entity_id` outright in `__init__`.
- **The registry resurrects deleted entity ids.** A removed entity is kept under
  `deleted_entities`, and an entity re-added with the same `unique_id` gets its
  old entity_id back. When testing entity naming, change the unique_id or the
  old id will mask the fix.
- **`friendly_name` carries the device name** once the entity has `device_info`.
  That is why each control gets a **device of its own** (`_control_device`),
  named as the user named it and hung off the emitter with `via_device`: one
  blaster holds a TV, an air conditioner and a fan, so the blaster's name is the
  wrong one to inherit. The power switch then takes `_attr_name = None` and
  reads as the control; a key takes its own name and reads "<control> <key>".

### Alexa

- `button` maps to `AlexaSceneController` (no deactivation), display category
  `ACTIVITY_TRIGGER`. The phrase is "turn on <name>", and that is why remote
  keys are buttons rather than scripts.
- **Home Assistant does not tell a self-hosted skill about new entities.**
  `async_send_add_or_update_message` is only called from `cloud/alexa_config.py`
  (Nabu Casa). `remote_keys.async_announce_to_alexa` closes that gap by calling
  it ourselves whenever a key becomes an entity, and the `alexa_announce` action
  does it on demand.
- **Getting at the manual Alexa config is the catch.** `smart_home.async_setup`
  builds `AlexaConfig` and hands it to the HTTP view; it is in no `hass.data`,
  so `_alexa_config()` walks `hass.http.app.router` for the route whose
  canonical path is `/api/alexa/smart_home` and digs the view out of the
  handler's closure. That is an internal reach: keep every step guarded and
  fall back to "say discover devices" rather than failing.
- Check `config.should_report_state` first. Without proactive reporting there
  is no token to push with, and the call would only raise.
- The generated block carries `include_entity_globs` with
  `button.tuya_remote_*`, so keys learned later are already in the filter. A
  filter that only lists `include_domains: [switch]` — a common hand-written
  one — silently drops every key, and no amount of discovering will help.
- Proactive state reporting needs `endpoint`, `client_id` and `client_secret`,
  **and the skill relinked**: Amazon only sends the authorisation grant at the
  moment the account is linked. `.storage/alexa_auth` appearing is the proof it
  arrived. pt-BR is served by the North America gateway,
  `https://api.amazonalexa.com/v3/events`.
- A scene has no *off*: `supports_deactivation=False`, so "turn off <key>" never
  works. That is why a control can name a **power pair**: the two keys become
  one `switch` with `assumed_state`, which Alexa drives as a device through
  `PowerController`. The paired keys get no button of their own, or every
  assistant would list them twice. A lone key stays a scene and needs a name
  that reads after "turn on". The name Alexa gets comes from `entity_config`, falling back to the
  entity's own — which carries the device prefix and is unusable by voice.
- Renaming only reaches Alexa on the next AddOrUpdate, and a deleted key leaves
  a dead scene behind unless a DeleteReport goes out. Both are wired:
  `async_announce_to_alexa` and `async_forget_in_alexa`, plus the `forget` list
  on the `alexa_announce` action for scenes orphaned before that existed.
- `ALEXA_SKILL.md` (plus `.pt-BR` and `.es`) builds the skill, the Lambda and
  account linking from zero; `ALEXA.md` covers the entity side. Keep the Lambda
  code identical across the three translations.

### Bluetooth

- **Detection belongs to the transport, not to the device.** `_switch_transport`
  used to clear `_api_protocol_working` and `_api_protocol_version_index`, so
  coming back to Wi-Fi meant walking 3.1 through 3.5 again. A device that
  blinked for one poll then spent minutes swapping back and forth while being
  perfectly reachable the whole time. Each transport now keeps its own state.
- When a device looks lost, prove it from outside Home Assistant before touching
  the code: listen for the UDP broadcast on 6666/6667 (AES-ECB with
  `md5(b"yGAdlopoPVldABfn")`) to see which device id is at which address, then
  open a `tinytuya` session with the stored key. Twice now that has shown the
  device to be fine and the integration to be the one at fault.


- Tuya combo modules advertise service `0000a201` at **the Wi-Fi MAC plus one**.
- The uuid is in the advertisement; `key = md5(service_data[1:])`, then AES-128-CBC
  (key used as iv) over `manufacturer_data[6:]`. `service_data[0]` is 0 for a
  product id and **1 for a product key** — upstream only handled 0.
- Keep **one shared session per address**. Two `TuyaBLEDevice` objects on the
  same radio produce duplicate and garbled packets.
- A weak signal is not a reason to give up: `bleak_retry_connector` has held
  GATT sessions at −98 dBm, where a single `bluetoothctl` attempt fails.
- The first status read comes back empty; wait `STATUS_SETTLE_STEPS` before
  deciding a device is mute.

### Testing the frontend

- Playwright drives the real Home Assistant. Browsers live in
  `~/.cache/ms-playwright`; pass `executablePath` so nothing is downloaded, and
  set `LD_LIBRARY_PATH` to the folder holding the Chrome dependencies.
- `getByText` pierces shadow DOM; `document.body.innerText` does not, so walk
  `shadowRoot` when reading the panel's text.
- Save a storage state once and reuse it — repeated logins hit a 429.
- Home Assistant takes several seconds to paint after `domcontentloaded`. Waits
  under 9 s produce flaky, meaningless failures.
- Clean up anything a test creates: these runs go against the user's live
  installation.
