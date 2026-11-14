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
- **A disabled entity has no state at all**, so `hass.states[id]` is undefined
  and `_friendly()` falls back to the raw entity id. Both lists in the panel
  were showing `switch.interruptor_bomba_overcharge_protection` as a device's
  name. Registry entries with `disabled_by` or `hidden_by` are dropped in
  `_boot`; the dashboard card had always filtered them.
- **A `1fr` column cannot shrink below its content.** One unbreakable 46
  character entity id took 262px of a 3-column grid, and `aspect-ratio:2/3`
  turned that into a 393px tall tile — a huge empty box next to a normal one.
  Grids that hold names use `minmax(0, 1fr)`, and `.tilename` wraps with
  `overflow-wrap:anywhere`.
- **Not every `switch.` is a key on the wall.** A relay has no
  `entity_category`; overcharge protection, child lock and the like are
  `config`, and they belong in the settings list, never in the tile grid.
- The settings list shows one device at a time, so each row strips the device
  title from the entity name (`_shortName`) instead of repeating it eleven
  times. `_value()` adds the unit and says "Unavailable" in the user's own
  language rather than printing Home Assistant's raw state.
- **A button is an input, so its page has nothing to press.** The device page
  shows what a device sets off: `_loadAutomations()` reads every automation's
  config once through the `automation/config` websocket command, and
  `_automationsFor()` keeps the ones whose **triggers** mention this device's
  ieee, its registry id or one of its entities. Searching the whole config
  would also catch automations that merely act on the device, which is the
  opposite question. A device with keys only gets the block when something
  matches; one without keys always gets it, or the page is blank.
- `search/related` does not find those automations. A ZHA button is wired with
  an `event` trigger on `zha_event` carrying `device_ieee`, which is not a
  device reference Home Assistant indexes.
- `last_triggered` carries a timezone and is safe to hand to
  `Intl.RelativeTimeFormat`. ZHA's `last_seen` does not: it is naive local time
  from the container, so a browser in another zone reads it hours off. That is
  why the facts line shows model, signal and battery and not when it last
  spoke.
- A battery device usually reports `lqi: null` — ZHA only knows the signal of a
  packet it has received since it started, and a sleeping button has not sent
  one. Showing nothing is right; do not read it as zero.
- **A shortcut is learnt, not chosen from a list.** The gesture names differ by
  quirk and by manufacturer id — a TS0041 answers `remote_button_short_press`
  while a SNZB-01P answers `toggle` — so the panel subscribes to `zha_event`,
  asks for the press, and keeps what the device actually said. A hard-coded
  dropdown of single/double/hold would be wrong on half the buttons.
- One press can raise **two** events: the quirk's own (`press_type` with
  `params: {press_type: 0}`) and the friendly `remote_button_*`. `_pickPress()`
  waits 700ms and prefers the friendly one, because matching on `press_type`
  alone would fire for every gesture. When only the quirk speaks, the params go
  into the trigger too.
- Confirmed on the hardware (`_TZ3000_yj6k7vfo` TS0041, quirk
  `TuyaSmartRemote0041TOPlusA`): a tap is `press_type: 0`, a double tap is `1`
  and a hold is `2`, each paired with its `remote_button_*` twin. A hold under
  about three seconds comes through as a plain tap, so a button that seems to
  have no hold was probably released too early — the quirk maps all three.
- Automations are written with `hass.callApi("POST", "config/automation/config/"
  + id, config)` and removed with `DELETE` on the same path, in the current
  schema (`triggers`, `conditions`, `actions`, with `action:` inside an action).
  An automation without an `id` came from YAML by hand and cannot be deleted
  that way, so the panel hides its delete button.
- Saving does not make the entity exist at once. `_refreshAutomations()` re-reads
  at 200ms, 1.5s and 4s rather than assuming one reload is enough.

- **A socket says it is a socket.** A power strip gives four plain booleans and
  nothing about USB, but the device config marks each outlet `class: outlet`, so
  the switch carries `device_class: outlet` while a key on the wall carries
  none. `outletKind()` in `outlets.js` reads that as the default, and only the
  USB ports need saying by hand.
- The kinds live in the layout store under the key `outlets` as
  `{kinds: {entity_id: kind}}`. It is the same store and the same
  `layout/get` · `layout/set` · `layout/subscribe` the remotes use, so the panel
  and the dashboard card follow each other with no new backend.
- Only the cloud knows a USB port is type C: locally the strip never says. That
  is why the panel asks the house once instead of asking Tuya for an account.
- The USB drawings are ours, in `outlets.js`, because the icon set draws USB as
  a plug with a tail rather than the port you look at. They are inline SVG, so
  `kindGlyph()` returns markup and not an icon name, and the dashboard card
  sizes the same `.face` down to 19px.
- The socket is whichever one is on the wall of that house. `hass.config.country`
  decides, because a language does not: `en` is a British socket in one house
  and an American one in the next. The language is only the fallback when the
  country is empty. Every socket but the Brazilian one comes from the icon set.
- A key can be a bank of ports rather than one: `usbmix` draws two USB-A slots
  and a USB-C, as these strips carry them. Three ports need more height than
  one, so that kind carries its own `box` and a `tall` class, and `.tile
  .face.tall` is the only place the glyph grows.
- A strip just added says nothing about its USB ports, so the device list marks
  it: `_needsKinds()` is true while every key of a two-key-or-more device reads
  `outlet` and none has been marked, and tapping that row opens the settings
  rather than the keys. Marking one key is what silences it.
- A card has only a `hass` setter, so `this.hass` is undefined and `t(this.hass, …)`
  quietly falls back to English. Always pass `this._hass`, and never hardcode a
  label in the card: it shipped with English buttons on a pt-BR phone.
- A row in the device list wears what the device is, through `_deviceGlyph()`:
  a socket only when one of its keys is a socket or a USB port, a wall switch
  otherwise. Drawing the socket on every row made a house of wall switches look
  like a house of plugs.
- `outletNames()` lets a key that nobody named take the name of what it is, so
  a USB port reads "USB" and not "Tomada 3". A name given by hand in Home
  Assistant (`name` in the registry, not `original_name`) always wins, and two
  of a kind get numbered.

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

- **`has_returned_state` means "ever", not "still".** It reads the cached
  state, and the cache outlives the device: a switch that fell off the network
  hours ago still reports true. Anything asking "is this device still there"
  must use `is_responding`, which requires a refresh within several times
  `_CACHE_TIMEOUT`. Getting this wrong once stranded a switch for eleven hours —
  the discovery sweep skips entries it believes are reachable, so the one device
  that was working at the moment the router reshuffled every address was the one
  it never went looking for.
- A DHCP reshuffle moves every device at once. The sweep handles it, but only
  for entries it considers unreachable, which is why the staleness test above is
  what makes the recovery work at all.
- Known and unfixed: the sweep once accepted `192.168.0.3` — an address from a
  subnet this network does not use — for a device, and corrected itself two
  minutes later. Nothing validates that a discovered address is on the same
  network as Home Assistant.

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

### Cutting the cloud off, and knowing whether it worked

- The Network tab of the panel exists to get a device off the internet for good:
  it is set up locally here, so the only thing the cloud still gets is a
  description of your home. `network_report` lists every entry with its IP and
  the MAC from the ARP table, and says which ones are safe to block — a gateway
  is not, because its sub-devices reach it through the cloud.
- **Nothing on the LAN can tell you whether a device still has internet.** A
  device cut off at the router keeps answering us perfectly: same ARP, same
  port 6668, same state. The LAN discovery broadcast does not help either — its
  `active` field is 2 on every device whether or not the cloud is reachable, and
  `token`/`wf_cfg` describe the pairing method, not a live connection.
- **Tuya is the only side that can see it**, because the device's cloud session
  either reaches Tuya or it does not. That check was built, shipped and then
  removed: it cost a cloud account to answer a question the user was happy to
  answer by looking at their router, and every row said "not checked" until
  somebody logged in. The tab now says only whether a device answers *us*, which
  is what it can honestly know. Do not rebuild it without a reason the user
  asked for; `device.online` from `tuya_sharing`'s device list is where it was.
- What remains of that work and still earns its place: `is_responding`, which
  caught two dead switches in one afternoon.
- **The cloud login is now persisted** in `tuya_selfhost_cloud_auth`. It used to
  live only in `hass.data[DOMAIN]["auth_cache"]`, which made a verification a
  QR scan away every time Home Assistant restarted. `TokenListener.update_token`
  writes refreshed tokens back, or the stored login would die at expiry — and it
  runs on an executor thread, so the save goes through `call_soon_threadsafe`.
- A per-row sentence that repeats eleven times is noise, not help. The pill
  carries the state; the line underneath appears only for the exceptions worth
  reading: no answer, a gateway to leave online, a sub-device with no address of
  its own.
- **Sign in where you ask people to sign in.** Getting a Tuya account used to
  mean `/config/integrations/dashboard/add` — a form that adds a device — so
  people rightly asked what the login was even for. `cloud_api.py` serves
  `cloud/status`, `cloud/qr`, `cloud/login` and `cloud/logout`, and the add tab
  runs the whole QR dance in place, beside the manual form and looking like it.
  Signing in there also makes the add flow skip the code next time.
- **A poll must not call `async_login`.** It clears the stored account on every
  failure, which is right for a form someone just submitted and ruinous four
  seconds at a time while the code is still on screen. `async_poll_login` shares
  the success path and leaves a stored login alone when the answer is "not
  scanned yet".
- **`ha-qr-code` does not exist inside a custom panel.** Home Assistant loads
  its components per page, and `customElements.whenDefined("ha-qr-code")` in the
  panel never resolves — a test waiting on it hangs until it is killed. `segno`
  is already in the container, so the backend sends the matrix as rows of 0 and
  1 and the panel draws one `<path>`. Always black on white: a scanner needs the
  contrast whatever the theme is.
- Check a rendered QR by sampling the screenshot, not by trusting the encoder:
  take the bounding box of the pixels above 245 (the white card), divide by
  `size + 4` for the quiet zone, and read the centre of each module. The longest
  white *run* is not the square — the black modules cut it short, and the
  misalignment reads as a random 50% error rate.

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

### Scenes

- A panel scene is a **Home Assistant script** with id `tuya_scene_<slug>`, written
  through `config/script/config/<id>` (admin only) by `frontend/scenes.js`. No
  store and no entity of our own: the script engine already has delays, runs
  from anywhere and Alexa maps `script` to a scene. The id never changes on a
  rename, so the Alexa endpoint stays the same.
- Steps the editor does not know (anything edited elsewhere) are kept as `raw`
  and written back untouched; the rest of the saved config is kept too.
- `alexa_announce` sends the scenes along with the keys, but only when the filter
  exposes `script.tuya_scene_*`: a directive for an entity the filter drops is
  refused, so announcing it would leave a dead scene. The answer carries
  `alexa`, `scenes_exposed` and `sent`, and the panel words its message by them.
- The config API takes a moment to turn a saved script into a state; the panel
  waits for the state before announcing, or the report goes out without it.
- A test that saves a scene writes the real `scripts.yaml`. Use a wait-only scene
  so running it switches nothing, and delete it at the end.

- Scenes sit behind a pill in the header (`this._scenes`), not on the device list:
  the list is for devices, and the user asked for it that way.
- A key is renamed through `config/entity_registry/update` with `name`; `null`
  restores the original. While a name is being typed (`this._renaming`) the
  `hass` setter must not redraw, or the field loses focus on every state change.
  A blur that changed nothing redraws 150 ms later, so the tap that caused the
  blur still reaches its target.

### Bluetooth

- **Detection belongs to the transport, not to the device.** `_switch_transport`
  used to clear `_api_protocol_working` and `_api_protocol_version_index`, so
  coming back to Wi-Fi meant walking 3.1 through 3.5 again. A device that
  blinked for one poll then spent minutes swapping back and forth while being
  perfectly reachable the whole time. Each transport now keeps its own state.
- **A reserve is only real if it is tried.** `_switch_transport` ran on the last
  attempt of a round, so the other transport was selected and the round then
  ended: nothing ever ran on it. Worst at setup, where a failed refresh raises
  `ConfigEntryNotReady` and the device object is discarded, so the next retry
  started on Wi-Fi again — the log fell to Bluetooth over and over and never
  came back. `_retry_on_failed_connection` now runs `_attempt_over_transport`
  once per transport. It needs a sentinel, not `None`, to tell exhaustion from
  success: error 900 (a remote with no status to report) legitimately returns
  `None`.
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

- The panel's Network tab has Wi-Fi, Bluetooth and Zigbee sub-tabs (`this._net`).
  `network_report` answers `bluetooth: {available, radios}` from
  `bluetooth.async_discovered_service_info(hass, connectable=False)`: anything
  advertising a201/fd50 or manufacturer 0x07D0, plus any address a configured
  device owns (its stored reserve, or Wi-Fi MAC plus one from the ARP table). A
  stored reserve that is not heard is listed as out of reach.

### Releasing

- This checkout has two remotes, and `gh` resolves to the **upstream**
  (`make-all/tuya-local`), not to the fork. A release created without
  `--repo constantini-ha/tuya-selfhost` is refused with a misleading message
  about a missing `workflow` scope. Always pass `--repo`, and `--target main`.
- Bump `manifest.json` in the same commit as the change, not afterwards: a
  release whose manifest names the previous version cannot be fixed without
  moving a published tag.
- Release notes are written in English, Portuguese and Spanish, in that order,
  separated by `---`.

### Zigbee in this panel

- Zigbee devices belong to Home Assistant's own ZHA integration, and the panel
  only borrows them: `zha/devices` over the websocket returns everything,
  including an `entities` list, so no device-registry lookup is needed. Skip the
  one with `active_coordinator` — that is the stick.
- They are folded into the panel under a synthetic `zha:<ieee>` entry id with
  the same shape as a config entry, so the device page, the tiles, all-on and
  all-off work unchanged. The dashboard card takes `entities` instead of
  `entry_id`, which it already supported.
- **Pairing is a service, not a websocket command.** `zha/devices/permit` is
  gone; call `zha.permit` with a `duration`, and `zha.permit` with `duration: 0`
  to close the window early. Joins arrive through an in-process dispatcher
  signal, not the event bus, so the panel polls `zha/devices` and diffs instead
  of subscribing to ZHA internals.

### Zigbee quirks

- `zigbee_quirks/` holds quirks for Tuya Zigbee devices that zha-quirks does not
  cover yet. They used to be a separate integration (`tuya_zha_quirks`); it was
  folded in here in 2026.11.48 and its repository deleted.
- One module per device. Importing it registers the quirk (`TuyaQuirkBuilder`
  ends in `add_to_registry()`), and its `DEVICES` tuple names the
  (manufacturer, model) pairs it covers, as Zigbee reports them.
- **Order matters.** ZHA picks a device's quirk when it loads its devices from
  its database, not when the quirk is registered. So the quirks are registered at
  the top of `async_setup_entry`, and once Home Assistant has started
  `_loaded_bare` checks whether ZHA loaded a covered device without a quirk; if
  so, the ZHA entry is reloaded once and a warning is logged. A reload is enough:
  the quirk is already in the registry, so no re-pairing and no restart.
- Do not import `homeassistant.components.zha`. hassfest would then demand `zha`
  in `after_dependencies`, which makes this integration load **after** ZHA, the
  one order that does not work. The check reads `hass.data["zha"]` instead, and
  swallows any error, because that is ZHA's private shape.
- A new module prefix (`_TZE28C1000000_` here) matches no existing fingerprint
  even when the datapoints are identical to a covered unit. Give gangs 2..n the
  device type of endpoint 1 (`SMART_PLUG`), or they come out as `light.*`.
- The quirk libraries are not on the host, and there is no Docker access. Read
  them from GitHub at the versions in Home Assistant's `zha/manifest.json`.

### Testing the frontend

- Playwright drives the real Home Assistant. Browsers live in
  `~/.cache/ms-playwright`; pass `executablePath` so nothing is downloaded, and
  set `LD_LIBRARY_PATH=~/.local/lib/chrome-deps`. That folder exists because the
  Umbrel's root filesystem is rebuilt at boot: the NSS libraries Chrome needs
  disappear with it, and the copy under `~` is what survives.
- `getByText` pierces shadow DOM; `document.body.innerText` does not, so walk
  `shadowRoot` when reading the panel's text.
- Save a storage state once and reuse it — repeated logins hit a 429.
- Home Assistant takes several seconds to paint after `domcontentloaded`. Waits
  under 9 s produce flaky, meaningless failures.
- Clean up anything a test creates: these runs go against the user's live
  installation.
