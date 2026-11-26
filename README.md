# Baixou

Site de ofertas da Shopee e do Mercado Livre que se atualiza sozinho. Um robô roda a cada 15 minutos, garimpa as promoções, passa cada uma por um **guardião** de segurança e publica no site só o que é bom, com o link de afiliado.

- **Site:** `https://sirkaiki.github.io/baixou/`
- **Painel do robô:** `https://sirkaiki.github.io/baixou/painel.html`

## Como funciona

1. **Robô garimpa**: consulta a API de afiliados da Shopee (e a do Mercado Livre, se configurada) com as categorias e palavras de `config.json`.
2. **Guardião filtra**: só passa produto novo, com estoque, de vendedor com reputação boa, com desconto real e em categoria que paga comissão. Ofertas suspeitas (desconto absurdo, preço cheio inflado, link estranho) vão para a quarentena.
3. **Site publica**: com foto, preço, parcelas, frete e o link de afiliado.
4. **Vigia sempre**: a cada execução, tudo o que está no site é conferido de novo. O que encareceu ou esgotou sai sozinho.
5. **Freio de emergência**: se a API falhar muito ou as ofertas despencarem de uma vez, o site mantém as ofertas anteriores e o GitHub manda um e-mail avisando.

Sem as chaves de nenhuma loja, o robô roda em **modo demonstração**, com produtos simulados.

## Configuração (uma vez só)

| O quê | Onde | Valor |
|---|---|---|
| Ligar o site | Settings → Pages → *Source* | **GitHub Actions** |
| Chave da API de afiliados da Shopee (painel de afiliado → Open API) | Settings → Secrets and variables → Actions → **Secrets** | `SHOPEE_APP_ID`, `SHOPEE_APP_SECRET` |
| Chave do app do Mercado Livre (opcional, ver abaixo) | Settings → Secrets and variables → Actions → **Secrets** | `ML_CLIENT_ID`, `ML_CLIENT_SECRET` |
| Código de afiliado | Settings → Secrets and variables → Actions → **Variables** | `ML_MATT_WORD`, `ML_MATT_TOOL` |

**Shopee:** o link de cada oferta já vem da API de afiliados com o seu código. A "reputação" usada pelo guardião é o tipo de loja (Shopee Mall ou Indicada) ou nota ≥ 4,7 com pelo menos 100 vendas.

**Mercado Livre:** desde 2025 o Mercado Livre bloqueia a busca de produtos (`/sites/MLB/search`) para aplicativos de terceiros, então o robô não consegue garimpar ofertas por lá. O código continua pronto caso a busca volte; até lá, deixe as chaves do Mercado Livre em branco.

Os valores de afiliado do Mercado Livre aparecem em qualquer link gerado no painel de afiliados do Mercado Livre (parâmetros `matt_word` e `matt_tool`). Sem eles, nenhuma oferta é publicada no modo real, para não divulgar link que não paga comissão.

## Contador anônimo (quem viu também viu, mais procurados)

O site registra, sem identificar ninguém, quais ofertas cada visita abriu e quais levou para a loja. Isso alimenta "Quem viu este também viu", "Mais procurados hoje" e o selo "Em alta". O contador roda na Cloudflare (plano gratuito):

1. Crie uma conta gratuita em cloudflare.com e abra **Workers & Pages** uma vez para escolher o subdomínio `workers.dev`.
2. Em *My Profile → API Tokens*, crie um token com o modelo **Edit Cloudflare Workers** e acrescente a permissão **D1: Edit**.
3. No GitHub, salve em **Secrets**: `CLOUDFLARE_API_TOKEN` (o token) e `CLOUDFLARE_ACCOUNT_ID` (o ID da conta, que aparece na página inicial da Cloudflare).
4. Em *Actions → Contador anônimo*, clique em **Run workflow**. Ele cria o banco, publica o contador e liga o site a ele.

Sem essas chaves, o site funciona normalmente com "Parecidos com este". Detalhes para o visitante em `privacidade.html`.

## Canal de ofertas no Telegram (opcional)

O robô publica sozinho, no seu canal, as ofertas que acabaram de entrar no site (no máximo 4 por rodada, sem repetir, só em modo real). Cada post leva o selo "Link de afiliado".

1. No Telegram, crie um **canal público** (ex.: `@baixouofertas`).
2. Fale com o **@BotFather**, envie `/newbot` e guarde o token que ele mostrar.
3. Adicione o bot ao canal como **administrador** (com permissão de publicar).
4. No GitHub: Settings → Secrets and variables → Actions:
   - Secrets: `TELEGRAM_BOT_TOKEN` (o token) e `TELEGRAM_CHAT_ID` (o @ do canal).
   - Variables: `TELEGRAM_CANAL_URL` = `https://t.me/seucanal` (faz o botão aparecer no site).
5. Canal do WhatsApp: crie pelo app e coloque o link em `WHATSAPP_CANAL_URL` (Variables). O WhatsApp não permite publicação automática, então lá os posts são manuais.

## Ajustar as regras

Edite o `config.json` direto no GitHub (ícone de lápis):

- `desconto_minimo`: desconto mínimo para entrar no site (padrão 15%).
- `desconto_quarentena`: acima disso a oferta vai para a quarentena (padrão 80%).
- `categorias`: quais categorias garimpar e a comissão de cada uma.
- `palavras_bloqueadas`: termos que barram o anúncio (réplica, usado...).

## Pastas

- `robo/`: o robô (`robo.py`), o guardião (`guardiao.py`), o cliente da API (`ml.py`), o modo demonstração e os testes.
- `worker/`: o contador anônimo (Cloudflare Worker + banco D1) e seus testes.
- `site/`: a loja (`index.html`, `app.css`, `app.js`) e o painel (`painel.html`); `site/data/` é gerado pelo robô (`ofertas.json`, `precos.json` para o gráfico de histórico, `status.json`).
- `dados/historico.json`: histórico de preços usado para detectar desconto falso.
