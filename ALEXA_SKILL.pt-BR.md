# Montando a skill da Alexa do zero

> 🇺🇸 [English](ALEXA_SKILL.md) · 🇪🇸 [Español](ALEXA_SKILL.es.md)

O guia [Expondo seus aparelhos para a Alexa](ALEXA.pt-BR.md) começa onde este
termina: ele parte do princípio de que você já tem uma skill e uma Lambda. Este
aqui monta as duas.

Nada disto é específico do Tuya Selfhost — é a configuração comum da Alexa
self-hosted, escrita em um lugar só para você não precisar juntar os pedaços. A
referência oficial é a [documentação do Alexa Smart Home do Home
Assistant](https://www.home-assistant.io/integrations/alexa.smart_home/); se
algum console tiver mudado de cara desde então, confie naquela página.

## O que você precisa antes

- Home Assistant acessível pela internet em HTTPS, porta 443, com certificado de
  uma autoridade certificadora de verdade. A Alexa recusa certificado
  autoassinado e não usa nenhuma outra porta.
- Uma [conta de desenvolvedor da Amazon](https://developer.amazon.com/).
- Uma [conta na AWS](https://aws.amazon.com/). O nível gratuito cobre isto com
  folga; uma casa com algumas dezenas de aparelhos não passa de alguns milhares
  de requisições por mês.

Use o mesmo e-mail nas duas, e o mesmo em que a sua Echo está registrada. Uma
skill em modo de desenvolvimento só aparece para a própria conta que a criou.

## 1. Crie a skill

No [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask),
**Create Skill**:

- Nome: o que você quiser, por exemplo `Home Assistant`.
- Idioma principal: o idioma que a sua Echo fala.
- Modelo: **Smart Home**.
- Hospedagem: **Provision your own**.

Crie a skill e deixe a **Payload version** em **v3**. Copie o **Skill ID**
(`amzn1.ask.skill.…`) — a Lambda vai precisar dele daqui a pouco.

## 2. Crie a Lambda

A região importa: ela tem que casar com o idioma da skill, senão a Alexa não
alcança a função.

| Idioma da skill | Região da AWS |
| --- | --- |
| Inglês (EUA, Canadá), português (BR), espanhol (EUA, México) | `us-east-1` (Norte da Virgínia) |
| Inglês (Reino Unido, Índia), alemão, espanhol (ES), francês, italiano | `eu-west-1` (Irlanda) |
| Japonês, inglês (Austrália) | `us-west-2` (Oregon) |

No [console da Lambda](https://console.aws.amazon.com/lambda/), mude para essa
região e vá em **Create function → Author from scratch**:

- Nome: `HomeAssistant`.
- Runtime: **Python 3.12** (qualquer runtime Python 3 atual serve).
- Arquitetura: `arm64` é mais barata e funciona igual.

Depois que ela existir:

1. **Configuration → Triggers → Add trigger → Alexa Smart Home**, e cole o Skill
   ID do passo 1.
2. **Configuration → Environment variables → Edit → Add**: `BASE_URL`, com o
   endereço do seu Home Assistant sem barra no fim, por exemplo
   `https://casa.exemplo.com`.
3. **Code**: troque o conteúdo de `lambda_function.py` pelo código abaixo e
   aperte **Deploy**.
4. Copie o **ARN** da função, no canto superior direito (`arn:aws:lambda:…`).

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

A função é um repassador e nada mais: confere que a diretiva é v3 e tem token,
encaminha para `/api/alexa/smart_home` e devolve a resposta do Home Assistant
sem mexer. Sem lista de aparelhos, sem credenciais, nada para manter
sincronizado. Deixe `DEBUG` desligado em produção — com ele ligado a função cai
para um token de longa duração, o que só serve durante os testes.

## 3. Aponte a skill para a Lambda

De volta ao console de desenvolvedor, em **Build → Smart Home**, cole o ARN em
**Default endpoint** e salve.

## 4. Vínculo de conta

Ainda em **Build**, abra **Account Linking** e preencha:

| Campo | Valor |
| --- | --- |
| Authorization URI | `https://seu-ha/auth/authorize` |
| Access Token URI | `https://seu-ha/auth/token` |
| Client ID | o endereço da Alexa da sua região, veja abaixo |
| Client Secret | qualquer coisa, o Home Assistant ignora |
| Authentication Scheme | **Credentials in request body** |
| Scope | adicione uma entrada: `smart_home` |

O Client ID é a origem da Alexa que vai te redirecionar de volta:

| Região | Client ID |
| --- | --- |
| América do Norte (inclui pt-BR) | `https://pitangui.amazon.com/` |
| Europa e Índia | `https://layla.amazon.com/` |
| Extremo Oriente | `https://alexa.amazon.co.jp/` |

A barra no fim faz parte. Salve.

Se o Home Assistant estiver atrás de um proxy reverso, confira que
`http.use_x_forwarded_for` e `trusted_proxies` estão configurados, senão a tela
de login recusa a requisição.

## 5. Ponha o bloco da Alexa no Home Assistant

É aí que [Expondo seus aparelhos para a Alexa](ALEXA.pt-BR.md) assume: gere o
bloco `alexa:` com a ação **Tuya Selfhost: configuração da Alexa**, cole no
`configuration.yaml`, ligue o relato proativo de estado e vincule a skill de
novo.

Vincular de novo não é opcional, e é o passo que a maioria das instalações
esquece.

## 6. Ative e descubra

No aplicativo da Alexa: **Skills e Jogos → Suas Skills → Dev → sua skill →
Ativar**, entre com a sua conta do Home Assistant e aceite a descoberta no fim.

## Quando não funciona

**"Não foi possível vincular sua skill".** Quase sempre é o HTTPS: certificado
em que a Alexa não confia, porta diferente da 443, ou proxy que não está
repassando o endereço real de quem chamou.

**A skill vincula mas nada é descoberto.** Olhe os logs da Lambda no CloudWatch.
401 quer dizer que o vínculo de conta não se completou de verdade; timeout quer
dizer que a função não alcança o seu `BASE_URL`.

**Os comandos funcionam mas o aplicativo mostra o estado antigo.** Isso é o
relato proativo, tratado no [ALEXA.pt-BR.md](ALEXA.pt-BR.md) — e ele exige
vincular a skill de novo depois que as credenciais estiverem no lugar.
