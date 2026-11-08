# Controlar un aparato cuyo protocolo el blaster no conoce

> 🇬🇧 [English](LEARNED_REMOTES.md) · 🇧🇷 [Português](LEARNED_REMOTES.pt-BR.md)

Las integraciones de protocolo como `gree_infrared` solo funcionan cuando el
aparato habla realmente ese protocolo. Muchos aires acondicionados, televisores y
ventiladores de marcas locales no lo hacen, y ninguna configuración lo cambia.

La salida es dejar de adivinar el protocolo y copiar la señal: enseñarle al
blaster tu mando físico y después repetir lo que grabó.

## La vía fácil: el panel Tuya Selfhost

La integración incluye un constructor. Abre **Tuya Selfhost** en la barra lateral,
crea un mando, añade botones con nombre e icono, y enséñalos uno a uno. Cada
captura ofrece **Probar / Conservar / Descartar**, así que una lectura mala nunca
reemplaza en silencio a una buena, y las flechas bajo cada botón fijan su posición.

Cuando el mando esté listo, **Añadir al panel** coloca la tarjeta terminada en tu
primera vista. Todo lo que sigue es lo mismo hecho a mano, para quien prefiera
YAML o lo necesite dentro de una automatización.

## Lo que hay que entender primero

**Un mando de aire acondicionado no envía "un grado más".** Cada pulsación
transmite el estado *completo* — encendido, modo, temperatura, ventilación,
swing — en una sola trama. No hay un botón "+" que aprender: "frío 22" y "frío
23" son dos códigos completamente distintos.

Por eso una integración de protocolo o funciona entera o no funciona nada, y por
eso aprender solo los estados que usas de verdad es lo sensato. Tres o cuatro
códigos cubren la vida real.

## Aprender un código

Apunta el mando físico al blaster, a unos 20 cm, y llama:

```yaml
action: remote.learn_command
target:
  entity_id: remote.tu_blaster
data:
  device: aire
  command: "frio_22"
```

Aparece una notificación y tienes 30 segundos para pulsar el botón. Deja el mando
en el estado exacto que quieres *antes* de pulsar, porque ese estado completo es
lo que se captura.

Códigos con los que empezar: encender a tu temperatura habitual, apagar, y uno
más frío y otro más cálido.

## Repetirlo

```yaml
action: remote.send_command
target:
  entity_id: remote.tu_blaster
data:
  device: aire
  command: "frio_22"
```

El código en crudo también sirve, sin aprender nada, si ya lo tienes de otra
fuente:

```yaml
data:
  command: "b64:JgBQAAABKJM..."
```

## Una tarjeta para el panel

Este es el patrón, con un botón de aprendizaje para añadir códigos sin editar
nada:

```yaml
type: grid
cards:
  - type: heading
    heading: Aire acondicionado
  - type: horizontal-stack
    cards:
      - type: button
        name: Encender
        icon: mdi:air-conditioner
        show_state: false
        tap_action:
          action: perform-action
          perform_action: remote.send_command
          target:
            entity_id: remote.tu_blaster
          data:
            device: aire
            command: frio_22
      - type: button
        name: Apagar
        icon: mdi:power
        show_state: false
        tap_action:
          action: perform-action
          perform_action: remote.send_command
          target:
            entity_id: remote.tu_blaster
          data:
            device: aire
            command: apagar
  - type: button
    name: Aprender apagar
    icon: mdi:school-outline
    show_state: false
    tap_action:
      action: perform-action
      perform_action: remote.learn_command
      target:
        entity_id: remote.tu_blaster
      data:
        device: aire
        command: apagar
```

## A qué renuncias

El infrarrojo es de un solo sentido. Home Assistant sabe lo que envió, nunca lo
que hizo el aparato, y una pulsación en el mando físico le resulta invisible. Los
botones son honestos al respecto de un modo en que un termostato redondo no lo
es: el dial sugiere un estado que Home Assistant no puede leer.

## Tus códigos sobreviven al cambio de aparato

Los códigos aprendidos se guardan por device id. Si vuelves a emparejar el
blaster en la app de Tuya obtiene un id nuevo, lo que hasta ahora dejaba
huérfanos todos los códigos enseñados. Usa **Reconfigurar** en la entrada en
lugar de borrarla y los códigos viajan con ella.

## Pulsar una tecla por voz

Cada tecla que enseñas se convierte también en una entidad `button`, llamada
`<mando> <tecla>` y agrupada en el emisor. Eso es lo que la pone al alcance de
una automatización, un script o un asistente de voz.

Alexa trata un botón como una escena, así que la orden es *enciende*:

> "Alexa, enciende Aire del salón Frío 22"

El bloque que genera la acción **configuración de Alexa** ya trae un comodín que
cubre todas las teclas, las de hoy y las de mañana, así que nunca tienes que
volver a generarlo después de enseñar una más. Lo que sí tienes que hacer es
dejar que Alexa la encuentre:

> "Alexa, detecta dispositivos"

Una skill propia no se entera de una entidad nueva por su cuenta — eso solo lo
tiene quien paga Nabu Casa. Un descubrimiento después de crear las teclas es
todo el coste.

[Exponiendo tus dispositivos a Alexa](ALEXA.es.md) cubre el resto, y
[Montando la skill de Alexa desde cero](ALEXA_SKILL.es.md) cubre la skill en sí.
