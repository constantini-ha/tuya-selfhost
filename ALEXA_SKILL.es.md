# Montando la skill de Alexa desde cero

> 🇺🇸 [English](ALEXA_SKILL.md) · 🇧🇷 [Português](ALEXA_SKILL.pt-BR.md)

La guía [Exponiendo tus dispositivos a Alexa](ALEXA.es.md) empieza donde esta
termina: da por hecho que ya tienes una skill y una Lambda. Esta monta las dos.

Nada de esto es específico de Tuya Selfhost — es la configuración corriente de
Alexa self-hosted, escrita en un solo sitio para que no tengas que juntar las
piezas. La referencia oficial es la [documentación de Alexa Smart Home de Home
Assistant](https://www.home-assistant.io/integrations/alexa.smart_home/); si
alguna consola ha cambiado de aspecto desde entonces, hazle caso a esa página.

## Lo que necesitas antes

- Home Assistant accesible desde internet por HTTPS, puerto 443, con un
  certificado de una autoridad certificadora de verdad. Alexa rechaza los
  certificados autofirmados y no usa ningún otro puerto.
- Una [cuenta de desarrollador de Amazon](https://developer.amazon.com/).
- Una [cuenta de AWS](https://aws.amazon.com/). El nivel gratuito cubre esto de
  sobra; una casa con unas decenas de dispositivos no pasa de unos pocos miles
  de peticiones al mes.

Usa el mismo correo en las dos, y el mismo con el que está registrado tu Echo.
Una skill en modo de desarrollo solo la ve la cuenta que la creó.

## 1. Crea la skill

En la [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask),
**Create Skill**:

- Nombre: el que quieras, por ejemplo `Home Assistant`.
- Idioma principal: el idioma que habla tu Echo.
- Modelo: **Smart Home**.
- Alojamiento: **Provision your own**.

Créala y deja la **Payload version** en **v3**. Copia el **Skill ID**
(`amzn1.ask.skill.…`) — la Lambda lo necesita en un momento.

## 2. Crea la Lambda

La región importa: tiene que coincidir con el idioma de la skill, o Alexa no
llegará a la función.

| Idioma de la skill | Región de AWS |
| --- | --- |
| Inglés (EE. UU., Canadá), portugués (BR), español (EE. UU., México) | `us-east-1` (Norte de Virginia) |
| Inglés (Reino Unido, India), alemán, español (ES), francés, italiano | `eu-west-1` (Irlanda) |
| Japonés, inglés (Australia) | `us-west-2` (Oregón) |

En la [consola de Lambda](https://console.aws.amazon.com/lambda/), cambia a esa
región y ve a **Create function → Author from scratch**:

- Nombre: `HomeAssistant`.
- Runtime: **Python 3.12** (sirve cualquier runtime Python 3 actual).
- Arquitectura: `arm64` es más barata y funciona igual.

Una vez creada:

1. **Configuration → Triggers → Add trigger → Alexa Smart Home**, y pega el
   Skill ID del paso 1.
2. **Configuration → Environment variables → Edit → Add**: `BASE_URL`, con la
   dirección de tu Home Assistant sin barra final, por ejemplo
   `https://casa.ejemplo.com`.
3. **Code**: sustituye el contenido de `lambda_function.py` por el código de
   abajo y pulsa **Deploy**.
4. Copia el **ARN** de la función, arriba a la derecha (`arn:aws:lambda:…`).

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

La función es un reenviador y nada más: comprueba que la directiva es v3 y trae
token, la reenvía a `/api/alexa/smart_home` y devuelve la respuesta de Home
Assistant sin tocarla. Sin lista de dispositivos, sin credenciales, nada que
mantener sincronizado. Deja `DEBUG` sin poner en producción — con él la función
recurre a un token de larga duración, que solo sirve mientras pruebas.

## 3. Apunta la skill a la Lambda

De vuelta en la consola de desarrollador, en **Build → Smart Home**, pega el ARN
en **Default endpoint** y guarda.

## 4. Vinculación de cuenta

Todavía en **Build**, abre **Account Linking** y rellena:

| Campo | Valor |
| --- | --- |
| Authorization URI | `https://tu-ha/auth/authorize` |
| Access Token URI | `https://tu-ha/auth/token` |
| Client ID | la dirección de Alexa de tu región, mira abajo |
| Client Secret | cualquier cosa, Home Assistant lo ignora |
| Authentication Scheme | **Credentials in request body** |
| Scope | añade una entrada: `smart_home` |

El Client ID es el origen de Alexa que te redirigirá de vuelta:

| Región | Client ID |
| --- | --- |
| América del Norte (incluye pt-BR) | `https://pitangui.amazon.com/` |
| Europa e India | `https://layla.amazon.com/` |
| Extremo Oriente | `https://alexa.amazon.co.jp/` |

La barra final forma parte. Guarda.

Si Home Assistant está detrás de un proxy inverso, asegúrate de que
`http.use_x_forwarded_for` y `trusted_proxies` están configurados, o la pantalla
de inicio de sesión rechazará la petición.

## 5. Pon el bloque de Alexa en Home Assistant

Ahí toma el relevo [Exponiendo tus dispositivos a Alexa](ALEXA.es.md): genera el
bloque `alexa:` con la acción **Tuya Selfhost: configuración de Alexa**, pégalo
en `configuration.yaml`, activa el informe proactivo de estado y vuelve a
vincular la skill.

Volver a vincular no es opcional, y es el paso que más instalaciones se saltan.

## 6. Activa y descubre

En la aplicación de Alexa: **Skills y Juegos → Tus Skills → Dev → tu skill →
Activar**, entra con tu cuenta de Home Assistant y acepta el descubrimiento al
final.

## Cuando no funciona

**"No hemos podido vincular tu skill".** Casi siempre es el HTTPS: un
certificado en el que Alexa no confía, un puerto distinto del 443, o un proxy
que no reenvía la dirección real de quien llama.

**La skill se vincula pero no se descubre nada.** Mira los registros de la
Lambda en CloudWatch. Un 401 significa que la vinculación no llegó a
completarse; un timeout, que la función no alcanza tu `BASE_URL`.

**Los comandos funcionan pero la aplicación muestra el estado antiguo.** Eso es
el informe proactivo, tratado en [ALEXA.es.md](ALEXA.es.md) — y necesita volver
a vincular la skill una vez puestas las credenciales.
