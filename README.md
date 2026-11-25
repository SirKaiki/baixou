# Baixou

Site de ofertas do Mercado Livre que se atualiza sozinho. Um robô roda a cada 15 minutos, garimpa as promoções, passa cada uma por um **guardião** de segurança e publica no site só o que é bom, com o link de afiliado.

- **Site:** `https://sirkaiki.github.io/baixou/`
- **Painel do robô:** `https://sirkaiki.github.io/baixou/painel.html`

## Como funciona

1. **Robô garimpa**: consulta a API do Mercado Livre nas categorias de `config.json`.
2. **Guardião filtra**: só passa produto novo, com estoque, de vendedor com reputação boa, com desconto real e em categoria que paga comissão. Ofertas suspeitas (desconto absurdo, preço cheio inflado, link estranho) vão para a quarentena.
3. **Site publica**: com foto, preço, parcelas, frete e o link de afiliado.
4. **Vigia sempre**: a cada execução, tudo o que está no site é conferido de novo. O que encareceu ou esgotou sai sozinho.
5. **Freio de emergência**: se a API falhar muito ou as ofertas despencarem de uma vez, o site mantém as ofertas anteriores e o GitHub manda um e-mail avisando.

Sem as chaves do Mercado Livre, o robô roda em **modo demonstração**, com produtos simulados.

## Configuração (uma vez só)

| O quê | Onde | Valor |
|---|---|---|
| Ligar o site | Settings → Pages → *Source* | **GitHub Actions** |
| Chave do app do Mercado Livre | Settings → Secrets and variables → Actions → **Secrets** | `ML_CLIENT_ID`, `ML_CLIENT_SECRET` |
| Código de afiliado | Settings → Secrets and variables → Actions → **Variables** | `ML_MATT_WORD`, `ML_MATT_TOOL` |

Os valores de afiliado aparecem em qualquer link gerado no painel de afiliados do Mercado Livre (parâmetros `matt_word` e `matt_tool`). Sem eles, nenhuma oferta é publicada no modo real, para não divulgar link que não paga comissão.

## Ajustar as regras

Edite o `config.json` direto no GitHub (ícone de lápis):

- `desconto_minimo`: desconto mínimo para entrar no site (padrão 15%).
- `desconto_quarentena`: acima disso a oferta vai para a quarentena (padrão 80%).
- `categorias`: quais categorias garimpar e a comissão de cada uma.
- `palavras_bloqueadas`: termos que barram o anúncio (réplica, usado...).

## Pastas

- `robo/`: o robô (`robo.py`), o guardião (`guardiao.py`), o cliente da API (`ml.py`), o modo demonstração e os testes.
- `site/`: a loja (`index.html`, `app.css`, `app.js`) e o painel (`painel.html`); `site/data/` é gerado pelo robô (`ofertas.json`, `precos.json` para o gráfico de histórico, `status.json`).
- `dados/historico.json`: histórico de preços usado para detectar desconto falso.
