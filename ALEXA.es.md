# Exponer tus dispositivos a Alexa

> 🇬🇧 [English](ALEXA.md) · 🇧🇷 [Português](ALEXA.pt-BR.md)

Esta guía cubre la vía self-hosted: tu propia skill Smart Home hablando
directamente con tu Home Assistant, sin suscripción a Nabu Casa.

Da por hecho que ya tienes:

- Home Assistant accesible desde Internet por HTTPS (proxy inverso, Cloudflare
  Tunnel o equivalente)
- Una skill Alexa Smart Home con su función AWS Lambda y la vinculación de
  cuenta ya funcionando

¿Aún no los tienes? [Montando la skill de Alexa desde cero](ALEXA_SKILL.es.md)
recorre la skill, la Lambda (con el código) y la vinculación de cuenta, y te
devuelve aquí. La [documentación de Alexa en Home
Assistant](https://www.home-assistant.io/integrations/alexa.smart_home/) es la
referencia oficial de esa parte.

Aquí solo cubrimos la parte que toca tus dispositivos.

## 1. Genera la configuración

Listar cada entidad a mano es lo tedioso, así que la integración lo hace por ti.
Ve a **Herramientas para desarrolladores → Acciones**, ejecuta **Tuya Selfhost:
Configuración de Alexa** y copia el campo `yaml` de la respuesta.

Obtienes un bloque `alexa:` completo con todas las entidades de Tuya Selfhost
que Alexa admite, cada una con el nombre que tiene en Home Assistant.

## 2. Pégalo en `configuration.yaml`

Pega el bloque tal cual y reinicia Home Assistant. Si ya tienes una sección
`alexa:`, fusiona las listas `include_entities` y `entity_config` con la
existente en lugar de crear una segunda.

## 3. Activa el informe proactivo de estado

**Sin este paso Alexa funciona en un solo sentido.** Los comandos de voz llegan
a los dispositivos, pero cuando algo cambia fuera de Alexa — el panel de Home
Assistant, un interruptor de pared, una automatización — la app sigue mostrando
el estado antiguo. Home Assistant no tiene adónde enviar el aviso.

En la [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask),
abre tu skill, ve a **Build → Permissions** y activa **Send Alexa Events**.
Aparecen dos credenciales en *Alexa Skill Messaging*. No son las mismas de la
vinculación de cuenta.

Guárdalas en `secrets.yaml`:

```yaml
alexa_client_id: amzn1.application-oa2-client.xxxxxxxx
alexa_client_secret: xxxxxxxx
```

Después descomenta las tres líneas que el bloque generado dejó listas, eligiendo
el endpoint de tu región:

| Región | Endpoint |
| --- | --- |
| Norteamérica (incluye pt-BR) | `https://api.amazonalexa.com/v3/events` |
| Europa e India | `https://api.eu.amazonalexa.com/v3/events` |
| Lejano Oriente | `https://api.fe.amazonalexa.com/v3/events` |

Reinicia Home Assistant.

## 4. Vuelve a vincular la skill

Este paso no es opcional. Amazon solo envía la autorización en el momento en que
se vincula la cuenta, así que una skill ya vinculada nunca la entregará y el
endpoint que acabas de configurar se queda sin uso.

En la app de Alexa: **Skills y juegos → Tus Skills → Dev → tu skill →
Inhabilitar skill**, luego habilítala y vincúlala de nuevo. Acepta **Detectar
dispositivos** al final.

Para confirmarlo, comprueba que ahora exista el archivo `.storage/alexa_auth` en
la carpeta de configuración de Home Assistant. Ese archivo es el token que usa
para enviar los cambios de estado.

## 5. Compruébalo

Enciende una entidad desde el panel de Home Assistant y mira la app de Alexa. El
estado debería seguirla en uno o dos segundos.

## Problemas frecuentes

**La app sigue mostrando un estado antiguo.** Falta `.storage/alexa_auth`: la
autorización nunca llegó. Repite el paso 4 — hay que desvincular y volver a
vincular la skill, no solo recargarla.

**Un interruptor aparece como enchufe aunque controla una luz.** Añade
`display_categories: LIGHT` a esa entidad dentro de `entity_config`. Alexa
acepta el cambio de nombre al redescubrir, pero *no* el de categoría: también
tienes que olvidar el dispositivo en la app y detectarlo otra vez.

**No se detecta nada.** Comprueba que la vinculación de cuenta siga funcionando
dando un comando de voz. Si el comando también falla, el problema está en la
skill o en el Lambda, no en esta configuración.
