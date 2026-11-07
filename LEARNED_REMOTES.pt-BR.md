# Controlando um aparelho cujo protocolo o blaster não conhece

> 🇬🇧 [English](LEARNED_REMOTES.md) · 🇪🇸 [Español](LEARNED_REMOTES.es.md)

Integrações de protocolo como a `gree_infrared` só funcionam quando o aparelho
realmente fala aquele protocolo. Muitos ar-condicionados, TVs e ventiladores de
marcas locais não falam, e nenhuma configuração muda isso.

A saída é parar de adivinhar o protocolo e copiar o sinal: ensinar o seu controle
físico ao blaster e depois repetir o que ele gravou.

## O que você precisa entender antes

**Controle de ar-condicionado não manda "um grau a mais".** Cada toque transmite
o estado *inteiro* — liga/desliga, modo, temperatura, ventilação, swing — num
único pacote. Não existe botão "+" para aprender: "frio 22" e "frio 23" são dois
códigos completamente diferentes.

É por isso que uma integração de protocolo ou funciona inteira ou não funciona
nada, e por isso aprender só os estados que você usa de verdade é o caminho
sensato. Três ou quatro códigos cobrem a vida real.

## Aprendendo um código

Aponte o controle físico para o blaster, a uns 20 cm, e chame:

```yaml
action: remote.learn_command
target:
  entity_id: remote.seu_blaster
data:
  device: ar
  command: "frio_22"
```

Aparece uma notificação e você tem 30 segundos para apertar o botão. Deixe o
controle no estado exato que você quer *antes* de apertar, porque é esse estado
inteiro que será capturado.

Códigos que valem a pena começar: ligar na sua temperatura habitual, desligar, e
um mais frio e um mais quente.

## Repetindo o código

```yaml
action: remote.send_command
target:
  entity_id: remote.seu_blaster
data:
  device: ar
  command: "frio_22"
```

Código cru também funciona, sem aprender nada, se você já o tiver de outra fonte:

```yaml
data:
  command: "b64:JgBQAAABKJM..."
```

## Um cartão para o painel

Este é o padrão, já com um botão de aprendizado para você acrescentar códigos sem
editar nada:

```yaml
type: grid
cards:
  - type: heading
    heading: Ar-condicionado
  - type: horizontal-stack
    cards:
      - type: button
        name: Ligar
        icon: mdi:air-conditioner
        show_state: false
        tap_action:
          action: perform-action
          perform_action: remote.send_command
          target:
            entity_id: remote.seu_blaster
          data:
            device: ar
            command: frio_22
      - type: button
        name: Desligar
        icon: mdi:power
        show_state: false
        tap_action:
          action: perform-action
          perform_action: remote.send_command
          target:
            entity_id: remote.seu_blaster
          data:
            device: ar
            command: desligar
  - type: button
    name: Aprender desligar
    icon: mdi:school-outline
    show_state: false
    tap_action:
      action: perform-action
      perform_action: remote.learn_command
      target:
        entity_id: remote.seu_blaster
      data:
        device: ar
        command: desligar
```

## O que você abre mão

Infravermelho é mão única. O Home Assistant sabe o que mandou, nunca o que o
aparelho fez, e um toque no controle físico é invisível para ele. Botões são
honestos quanto a isso de um jeito que um termostato redondo não é — o termostato
sugere um estado que o Home Assistant não consegue ler.

## Seus códigos sobrevivem à troca do aparelho

Os códigos aprendidos são guardados por device id. Se você re-parear o blaster no
app da Tuya ele ganha um id novo, o que até aqui deixava órfãos todos os códigos ensinados.
Use **Reconfigurar** na entrada em vez de apagá-la, e os códigos vão junto.
