# Building the Alexa skill from scratch

> 🇧🇷 [Português](ALEXA_SKILL.pt-BR.md) · 🇪🇸 [Español](ALEXA_SKILL.es.md)

[Exposing your devices to Alexa](ALEXA.md) starts where this guide ends: it
assumes you already have a skill and a Lambda. This one builds both.

Nothing here is specific to Tuya Selfhost — it is the plain self-hosted Alexa
setup, written out in one place so you do not have to piece it together. The
canonical reference is the [Home Assistant Alexa Smart Home
documentation](https://www.home-assistant.io/integrations/alexa.smart_home/);
if a console has been redesigned since, trust that page over this one.

## What you need first

- Home Assistant reachable from the Internet over HTTPS, port 443, with a
  certificate from a real certificate authority. Alexa rejects self-signed
  certificates, and it will not use any other port.
- An [Amazon developer account](https://developer.amazon.com/).
- An [AWS account](https://aws.amazon.com/). The free tier covers this by a
  wide margin; a home with a few dozen devices stays in the low thousands of
  requests a month.

Use the same email address for both, and the same one your Echo is registered
with. A skill in development mode is only visible to its own developer account.

## 1. Create the skill

In the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask),
**Create Skill**:

- Name: anything, e.g. `Home Assistant`.
- Primary locale: the language your Echo speaks.
- Model: **Smart Home**.
- Hosting: **Provision your own**.

Create it, and leave the **Payload version** at **v3**. Copy the **Skill ID**
(`amzn1.ask.skill.…`) — the Lambda needs it in a moment.

## 2. Create the Lambda

The region matters: it has to match your skill's locale, or Alexa will not
reach the function.

| Skill locale | AWS region |
| --- | --- |
| English (US, CA), Portuguese (BR), Spanish (US, MX) | `us-east-1` (N. Virginia) |
| English (UK, IN), German, Spanish (ES), French, Italian | `eu-west-1` (Ireland) |
| Japanese, English (AU) | `us-west-2` (Oregon) |

In the [Lambda console](https://console.aws.amazon.com/lambda/), switch to that
region, then **Create function → Author from scratch**:

- Name: `HomeAssistant`.
- Runtime: **Python 3.12** (any current Python 3 runtime works).
- Architecture: `arm64` is cheaper and perfectly fine.

Once it exists:

1. **Configuration → Triggers → Add trigger → Alexa Smart Home**, and paste the
   Skill ID from step 1.
2. **Configuration → Environment variables → Edit → Add**: `BASE_URL`, set to
   your Home Assistant address with no trailing slash, e.g.
   `https://home.example.com`.
3. **Code**: replace the contents of `lambda_function.py` with the code below
   and press **Deploy**.
4. Copy the function **ARN** from the top right (`arn:aws:lambda:…`).

### `lambda_function.py`

```python
"""Forwards Alexa Smart Home directives to Home Assistant.

Set BASE_URL in the function's environment variables, e.g.
https://home.example.com (no trailing slash).
"""

import json
import logging
import os
import urllib.error
import urllib.request

_debug = bool(os.environ.get("DEBUG"))

_logger = logging.getLogger("HomeAssistant-SmartHome")
_logger.setLevel(logging.DEBUG if _debug else logging.INFO)

base_url = os.environ.get("BASE_URL")
assert base_url is not None, "BASE_URL is not set"
base_url = base_url.strip("/")


def lambda_handler(event, context):
    """Handle one directive and return Home Assistant's answer verbatim."""
    _logger.debug("Event: %s", event)

    directive = event.get("directive")
    assert directive is not None, "Malformed request: no directive"
    assert (
        directive.get("header", {}).get("payloadVersion") == "3"
    ), "Only payloadVersion 3 is supported"

    scope = directive.get("endpoint", {}).get("scope")
    if scope is None:
        scope = directive.get("payload", {}).get("grantee")
    if scope is None:
        scope = directive.get("payload", {}).get("scope")
    assert scope is not None, "Malformed request: no endpoint.scope"
    assert scope.get("type") == "BearerToken", "Only BearerToken is supported"

    token = scope.get("token")
    if token is None and _debug:
        token = os.environ.get("LONG_LIVED_ACCESS_TOKEN")

    request = urllib.request.Request(
        f"{base_url}/api/alexa/smart_home",
        method="POST",
        data=json.dumps(event).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request) as response:
            answer = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        _logger.error("Home Assistant answered %s", err.code)
        raise

    _logger.debug("Answer: %s", answer)
    return answer
```

The function is a relay and nothing more: it checks the directive is a v3 one
with a bearer token, forwards it to `/api/alexa/smart_home`, and returns Home
Assistant's answer untouched. No device list, no credentials, nothing to keep in
sync. Leave `DEBUG` unset in production — with it set, the function falls back
to a long-lived token, which is only useful while testing.

## 3. Point the skill at the Lambda

Back in the developer console, under **Build → Smart Home**, paste the ARN into
**Default endpoint** and save.

## 4. Account linking

Still under **Build**, open **Account Linking** and fill it in:

| Field | Value |
| --- | --- |
| Authorization URI | `https://your-ha/auth/authorize` |
| Access Token URI | `https://your-ha/auth/token` |
| Client ID | the Alexa address for your region, see below |
| Client Secret | anything at all, Home Assistant ignores it |
| Authentication Scheme | **Credentials in request body** |
| Scope | add one entry: `smart_home` |

The Client ID is the Alexa origin that will redirect back to you:

| Region | Client ID |
| --- | --- |
| North America (includes pt-BR) | `https://pitangui.amazon.com/` |
| Europe and India | `https://layla.amazon.com/` |
| Far East | `https://alexa.amazon.co.jp/` |

The trailing slash is part of it. Save.

If Home Assistant sits behind a reverse proxy, make sure `http.use_x_forwarded_for`
and `trusted_proxies` are set, otherwise the login page will refuse the request.

## 5. Add the Alexa block to Home Assistant

That is where [Exposing your devices to Alexa](ALEXA.md) takes over: generate
the `alexa:` block with the **Tuya Selfhost: Alexa configuration** action, paste
it into `configuration.yaml`, turn on proactive reporting, and relink the skill.

The relink is not optional, and it is the step most setups miss.

## 6. Enable and discover

In the Alexa app: **Skills & Games → Your Skills → Dev → your skill → Enable**,
log in with your Home Assistant account, and accept the discovery at the end.

## When it does not work

**"We were unable to link your skill".** Almost always HTTPS: a certificate
Alexa does not trust, a port other than 443, or a proxy that is not forwarding
the real client address.

**The skill links but nothing is discovered.** Look at the Lambda's CloudWatch
logs. A 401 means account linking did not really complete; a timeout means the
function cannot reach your `BASE_URL`.

**Commands work but the app shows stale state.** That is proactive reporting,
covered in [ALEXA.md](ALEXA.md) — and it needs the skill relinked after the
credentials are in place.
