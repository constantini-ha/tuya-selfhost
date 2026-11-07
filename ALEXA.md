# Exposing your devices to Alexa

> 🇧🇷 [Português](ALEXA.pt-BR.md) · 🇪🇸 [Español](ALEXA.es.md)

This guide covers the self-hosted route: your own Alexa Smart Home skill talking
straight to your Home Assistant, with no Nabu Casa subscription.

It assumes you already have:

- Home Assistant reachable from the Internet over HTTPS (a reverse proxy, a
  Cloudflare Tunnel, or anything equivalent)
- An Alexa Smart Home skill with its AWS Lambda function and account linking
  already working

Setting the skill up is covered by the [Home Assistant Alexa
documentation](https://www.home-assistant.io/integrations/alexa.smart_home/).
What follows is only the part that touches your devices.

## 1. Generate the configuration

Listing every entity by hand is the tedious part, so the integration does it for
you. Go to **Developer tools → Actions**, run **Tuya Selfhost: Alexa
configuration**, and copy the `yaml` field from the response.

You get a complete `alexa:` block with every Tuya Selfhost entity Alexa can
handle, each one already carrying the name it has in Home Assistant.

## 2. Paste it into `configuration.yaml`

Paste the block as it is, then restart Home Assistant. If you already have an
`alexa:` section, merge the `include_entities` and `entity_config` lists into it
instead of adding a second one.

## 3. Turn on proactive state reporting

**Without this step Alexa works in one direction only.** Voice commands reach
your devices, but when something changes outside Alexa — the Home Assistant
dashboard, a wall switch, an automation — the Alexa app keeps showing the old
state. There is nowhere for Home Assistant to send the update.

In the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask),
open your skill, go to **Build → Permissions** and switch on **Send Alexa
Events**. Two credentials appear under *Alexa Skill Messaging*. They are not the
account linking ones.

Put them in `secrets.yaml`:

```yaml
alexa_client_id: amzn1.application-oa2-client.xxxxxxxx
alexa_client_secret: xxxxxxxx
```

Then uncomment the three lines the generated block left ready, picking the
endpoint for your region:

| Region | Endpoint |
| --- | --- |
| North America (includes pt-BR) | `https://api.amazonalexa.com/v3/events` |
| Europe and India | `https://api.eu.amazonalexa.com/v3/events` |
| Far East | `https://api.fe.amazonalexa.com/v3/events` |

Restart Home Assistant.

## 4. Relink the skill

This step is not optional. Amazon only sends the authorisation grant at the
moment the account is linked, so a skill that is already linked will never
deliver it, and the endpoint you just configured stays idle.

In the Alexa app: **Skills & Games → Your Skills → Dev → your skill → Disable
Skill**, then enable it and link again. Accept **Discover devices** at the end.

To confirm it worked, check that `.storage/alexa_auth` now exists in your Home
Assistant configuration directory. That file is the token Home Assistant uses to
push state changes.

## 5. Check it

Turn an entity on from the Home Assistant dashboard and watch the Alexa app. The
state should follow within a second or two.

## Troubleshooting

**The app still shows a stale state.** `.storage/alexa_auth` is missing: the
grant never arrived. Redo step 4 — the skill has to be unlinked and linked
again, not merely reloaded.

**A switch shows up as a plug when it drives a light.** Add
`display_categories: LIGHT` under that entity in `entity_config`. Alexa picks up
renames on rediscovery but *not* category changes, so you also have to forget
the device in the Alexa app and discover it again.

**Nothing is discovered.** Check that account linking still works by issuing a
voice command. If commands fail too, the problem is the skill or the Lambda, not
this configuration.
