# Expondo seus aparelhos para a Alexa

> 🇬🇧 [English](ALEXA.md) · 🇪🇸 [Español](ALEXA.es.md)

Este guia cobre o caminho self-hosted: sua própria skill Smart Home conversando
direto com o seu Home Assistant, sem assinatura do Nabu Casa.

Ele pressupõe que você já tem:

- Home Assistant acessível pela internet em HTTPS (proxy reverso, Cloudflare
  Tunnel ou equivalente)
- Uma skill Alexa Smart Home com a função AWS Lambda e o vínculo de conta já
  funcionando

Ainda não tem? [Montando a skill da Alexa do zero](ALEXA_SKILL.pt-BR.md) passa
pela skill, pela Lambda (com o código) e pelo vínculo de conta, e devolve você
para cá. A [documentação da Alexa no Home
Assistant](https://www.home-assistant.io/integrations/alexa.smart_home/) é a
referência oficial dessa parte.

Aqui cobrimos só a parte que toca nos seus aparelhos.

## 1. Gere a configuração

Listar cada entidade na mão é a parte chata, então a integração faz isso por
você. Vá em **Ferramentas de desenvolvedor → Ações**, execute **Tuya Selfhost:
Configuração da Alexa** e copie o campo `yaml` da resposta.

Você recebe um bloco `alexa:` completo com todas as entidades do Tuya Selfhost
que a Alexa entende, cada uma já com o nome que tem no Home Assistant.

## 2. Cole no `configuration.yaml`

Cole o bloco como está e reinicie o Home Assistant. Se você já tem uma seção
`alexa:`, junte as listas `include_entities` e `entity_config` à que existe, em
vez de criar uma segunda.

## 3. Ligue o relatório proativo de estado

**Sem este passo a Alexa funciona em mão única.** Os comandos de voz chegam aos
aparelhos, mas quando algo muda fora da Alexa — pelo painel do Home Assistant,
pelo interruptor na parede, por uma automação — o app continua mostrando o
estado antigo. O Home Assistant não tem para onde mandar o aviso.

No [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask),
abra sua skill, vá em **Build → Permissions** e ligue **Send Alexa Events**.
Aparecem duas credenciais em *Alexa Skill Messaging*. Elas não são as mesmas do
vínculo de conta.

Guarde no `secrets.yaml`:

```yaml
alexa_client_id: amzn1.application-oa2-client.xxxxxxxx
alexa_client_secret: xxxxxxxx
```

Depois descomente as três linhas que o bloco gerado já deixou prontas,
escolhendo o endpoint da sua região:

| Região | Endpoint |
| --- | --- |
| América do Norte (inclui pt-BR) | `https://api.amazonalexa.com/v3/events` |
| Europa e Índia | `https://api.eu.amazonalexa.com/v3/events` |
| Extremo Oriente | `https://api.fe.amazonalexa.com/v3/events` |

Reinicie o Home Assistant.

## 4. Revincule a skill

Este passo não é opcional. A Amazon só envia a autorização no momento em que a
conta é vinculada, então uma skill já vinculada nunca vai entregá-la, e o
endpoint que você acabou de configurar fica parado sem servir para nada.

No app da Alexa: **Skills e Jogos → Seus Skills → Dev → sua skill → Desativar
Skill**, depois ative e vincule de novo. Aceite **Detectar dispositivos** no
final.

Para confirmar, veja se o arquivo `.storage/alexa_auth` passou a existir na
pasta de configuração do Home Assistant. É o token que ele usa para empurrar as
mudanças de estado.

## 5. Teste

Ligue uma entidade pelo painel do Home Assistant e olhe o app da Alexa. O estado
deve acompanhar em um ou dois segundos.

## Problemas comuns

**O app continua mostrando estado velho.** O `.storage/alexa_auth` não existe: a
autorização nunca chegou. Refaça o passo 4 — a skill precisa ser desvinculada e
vinculada de novo, não apenas recarregada.

**Um interruptor aparece como tomada, mas comanda uma luz.** Acrescente
`display_categories: LIGHT` naquela entidade dentro do `entity_config`. A Alexa
aceita renomeação na redescoberta, mas *não* aceita mudança de categoria — você
também precisa esquecer o aparelho no app e detectar de novo.

**Nada é detectado.** Confira se o vínculo de conta ainda funciona dando um
comando de voz. Se o comando também falhar, o problema está na skill ou no
Lambda, não nesta configuração.
