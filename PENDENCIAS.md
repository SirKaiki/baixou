# Pendências do Baixou

Lista do que ficou para depois. Tudo aqui depende de uma ação do dono do projeto (criar conta, cadastrar chave
nos *Secrets* do GitHub ou decidir algo). **Nunca cole chaves no chat nem no código.**

## Lojas (produtos reais)

- [ ] **Shopee — completar o cadastro de afiliado** (Informações de Pagamento e Fiscais), necessário também para receber comissões.
- [ ] **Shopee — pedir acesso à Open API**: em affiliate.shopee.com.br/open_api → "Central de Ajuda" → formulário
      (já sou afiliado: Sim · problema de login: Não, outras dúvidas · ID de afiliado em /account_setting ·
      tema "dúvidas com cadastro e conta" · cenário "Quero ativar a API").
- [ ] **Shopee — cadastrar as chaves no GitHub**: Secrets `SHOPEE_APP_ID` e `SHOPEE_APP_SECRET` (a "Senha" da página Open API).
- [ ] **Mercado Livre — criar o app de desenvolvedor** com escopo "Somente leitura" e as permissões funcionais
      **"Métricas do negócio"** (mais vendidos) e **"Publicação e sincronização"** (itens e catálogo); cadastrar
      `ML_CLIENT_ID`, `ML_CLIENT_SECRET` (Secrets) e `ML_MATT_WORD`, `ML_MATT_TOOL` (Variables). O diagnóstico
      (`dados/diagnostico_ml.json`) mostra o que a conta consegue consultar. A busca geral (`/sites/MLB/search`)
      não aparece mais na documentação; o caminho é mais vendidos (`/highlights`) + catálogo (`/products/ID`).

## Contador anônimo e aprendiz

- [ ] **Cloudflare — criar conta grátis** (plano Free; não aceitar plano pago nem cartão sem conferir antes).
- [ ] **Cloudflare — gerar a chave restrita** (modelo "Edit Cloudflare Workers" + permissão "D1: Edit") e cadastrar
      `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` nos Secrets do GitHub. Sem o contador, o aprendiz guarda ofertas mas não aprende.
- [ ] Ao implantar o contador, conferir no painel da Cloudflare a regra de limite de requisições.

## Canal de ofertas

- [ ] **Telegram** — criar o canal público e o bot (@BotFather), cadastrar `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
      (Secrets) e `TELEGRAM_CANAL_URL` (Variables). Opcional: `WHATSAPP_CANAL_URL` (os posts no WhatsApp são manuais).

## Segurança (configurações do GitHub que só o dono consegue mudar)

- [ ] *Settings → Actions → General → Workflow permissions*: "Read repository contents" e desmarcar
      "Allow GitHub Actions to create and approve pull requests".
- [ ] *Settings → Code security*: ligar "Dependabot alerts" e "Private vulnerability reporting".
- [ ] Ligar a verificação em dois fatores na conta do GitHub.
- [ ] *Settings → Collaborators*: confirmar que só o dono tem acesso de escrita.
- [ ] Em casa: instalar o Claude Code e rodar o Claude Security no repositório (segunda opinião da auditoria).

## Decisões para quando houver dados

- [ ] **Escolher a régua da curadoria** depois de algumas semanas com loja ligada (painel → "Curadoria por dados"),
      e trocar `"curadoria": {"modo": "observar"}` para `"aplicar"` no `config.json`.
- [ ] **Aprendiz**: quando o painel mostrar nota de teste ≥ 0,65, decidir se passa de `"sombra"` para `"ajudar"`.
- [ ] Pensar num domínio próprio (ex.: baixou.com.br) quando o site ganhar tráfego (isola o site e passa mais confiança).
