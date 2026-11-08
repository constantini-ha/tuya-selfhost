# Controlando um aparelho cujo protocolo o blaster não conhece

> 🇬🇧 [English](LEARNED_REMOTES.md) · 🇪🇸 [Español](LEARNED_REMOTES.es.md)

Integrações de protocolo como a `gree_infrared` só funcionam quando o aparelho
realmente fala aquele protocolo. Muitos ar-condicionados, TVs e ventiladores de
marcas locais não falam, e nenhuma configuração muda isso.

A saída é parar de adivinhar o protocolo e copiar o sinal: ensinar o seu controle
físico ao blaster e depois repetir o que ele gravou.

## O caminho fácil: o painel Tuya Selfhost

A integração traz um construtor. Abra **Tuya Selfhost** na barra lateral, crie um
controle, acrescente botões com nome e ícone, e ensine um por um. Cada captura
oferece **Testar / Manter / Descartar**, então uma leitura ruim nunca substitui
uma boa em silêncio, e as setas embaixo de cada botão definem a posição dele.

Quando o controle estiver pronto, **Adicionar ao painel** solta o cartão pronto na
sua primeira visão. Tudo que vem abaixo é a mesma coisa feita na mão, para quem
prefere YAML ou precisa disso dentro de uma automação.

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

## Apertar uma tecla pela voz

Cada tecla que você ensina também vira uma entidade `button`, chamada
`<controle> <tecla>` e agrupada no emissor. É isso que deixa ela ao alcance de
uma automação, de um script ou de um assistente de voz.

A Alexa trata botão como cena, então o comando é *ligar*:

> "Alexa, ligar Ar da sala Frio 22"

O bloco gerado pela ação **configuração da Alexa** já traz um curinga que cobre
todas as teclas, as de hoje e as de amanhã, então você nunca precisa gerar de
novo depois de ensinar mais uma. Ensinar uma tecla já entrega ela para a Alexa na hora, então normalmente não
sobra nada para fazer. O Home Assistant só faz isso para quem assina o Nabu
Casa; a integração faz também para quem tem skill própria.

Se alguma tecla não aparecer — a Alexa estava fora do ar, ou você montou a skill
depois de ensinar —, a aba Alexa do painel tem **Enviar as teclas para a
Alexa**, e a ação `tuya_selfhost.alexa_announce` faz o mesmo de dentro de uma
automação. Na falta das duas, o caminho antigo continua valendo:

> "Alexa, descobrir dispositivos"

Uma coisa para conferir se não chega nada: o seu filtro do `alexa:` precisa
deixar passar botão. Um filtro que só diz `include_domains: [switch]` derruba
todas as teclas, e nenhuma descoberta resolve. O bloco gerado já vem certo.

[Expondo seus aparelhos para a Alexa](ALEXA.pt-BR.md) cobre o resto, e
[Montando a skill da Alexa do zero](ALEXA_SKILL.pt-BR.md) cobre a skill em si.

### Um par liga/desliga é melhor que duas cenas

Uma tecla sozinha é um disparo único, então a Alexa só consegue vê-la como cena.
Um par — uma tecla que liga o aparelho e uma que desliga — é um **dispositivo**,
e vale a pena montar: "ligar o ar condicionado" e "desligar o ar condicionado"
funcionam os dois, que é como qualquer um espera falar com um aparelho.

Em **Editar**, no **Par de energia**, escolha a tecla que liga e a que desliga.
As duas deixam de ser cenas e viram um switch só.

Cada controle é um dispositivo próprio no Home Assistant, com o nome que você
deu e listado embaixo do emissor — um blaster guarda uma televisão, um ar
condicionado e um ventilador, e cada um tem que atender pelo nome dele. Então o
switch aparece como "Ar da sala", e uma tecla como "Ar da sala Frio 22".

Infravermelho é mão única, então o switch não tem como saber o que o aparelho
está fazendo de verdade: ele mostra o que foi enviado por último. O Home
Assistant marca como estado presumido e desenha dois botões em vez de uma
chave.

O resto continua cena, que é o certo para tecla de disparo único como "Frio 22".

### Dar um nome que a Alexa entenda

A Alexa enxerga botão como **cena**, e cena só atende a *ligar* (ou *ativar*).
Não existe *desligar*: a tecla que desliga o aparelho é uma cena própria, e
precisa de um nome que soe bem depois de "ligar".

O nome que chega na Alexa é o da entidade, que o Home Assistant monta como
`<emissor> <controle> <tecla>` — comprido demais para falar. Dê um nome curto na
seção `entity_config` do seu bloco `alexa:`:

```yaml
      button.tuya_remote_ar_condicionado_ligar:
        name: Ar condicionado
      button.tuya_remote_ar_condicionado_desligar:
        name: Ar desligado
```

Daí "Alexa, ligar o ar condicionado" e "Alexa, ligar ar desligado". O segundo
soa esquisito; uma rotina no aplicativo da Alexa associa a frase que você quiser
à cena, que é a saída de sempre.

Trocou um nome, a tecla precisa sair de novo: o botão **Enviar as teclas para a
Alexa** faz isso. Tecla apagada aqui sai da Alexa sozinha, e a ação
`tuya_selfhost.alexa_announce` aceita uma lista `forget` para as cenas que
ficaram de antes disso existir.
