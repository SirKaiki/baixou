"""Canal de ofertas: publica no Telegram as ofertas que acabaram de entrar no site.

Fica desligado até existirem os segredos no GitHub:
- TELEGRAM_BOT_TOKEN  (token do bot criado no @BotFather; o bot precisa ser administrador do canal)
- TELEGRAM_CHAT_ID    (o @ do canal, por exemplo @baixouofertas)

E as variáveis (opcionais) com os links públicos, que fazem os botões aparecerem no site:
- TELEGRAM_CANAL_URL  (https://t.me/...)
- WHATSAPP_CANAL_URL  (https://whatsapp.com/channel/...)

Regras: só publica em modo real (nunca as ofertas simuladas), no máximo MAX_POR_RODADA por
execução, as de maior desconto primeiro, e nunca repete uma oferta já publicada nos últimos dias.
Na primeira vez publica só as 3 melhores, para não despejar o catálogo inteiro no canal.
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARQ_OFERTAS = RAIZ / "site" / "data" / "ofertas.json"
ARQ_CANAIS = RAIZ / "site" / "data" / "canais.json"
ARQ_ESTADO = RAIZ / "dados" / "telegram.json"
MAX_POR_RODADA = 4
LEMBRAR_DIAS = 14


def ler(caminho: Path, padrao):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return padrao


def gravar(caminho: Path, dados) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(dados, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def brl(v: float) -> str:
    return "R$ " + f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def site_url() -> str:
    url = os.environ.get("SITE_URL", "").strip().rstrip("/")
    if url:
        return url
    dono, nome = os.environ.get("GITHUB_REPOSITORY", "SirKaiki/baixou").split("/", 1)
    return f"https://{dono.lower()}.github.io/{nome}"


def gravar_canais() -> dict:
    """Escreve os links públicos dos canais para o site mostrar os botões (só links com formato esperado)."""
    canais = {}
    tg = os.environ.get("TELEGRAM_CANAL_URL", "").strip()
    wa = os.environ.get("WHATSAPP_CANAL_URL", "").strip()
    if re.fullmatch(r"https://t\.me/[A-Za-z0-9_+/-]{3,80}", tg):
        canais["telegram"] = tg
    if re.fullmatch(r"https://(www\.)?whatsapp\.com/channel/[A-Za-z0-9]{10,60}", wa):
        canais["whatsapp"] = wa
    if canais or ARQ_CANAIS.exists():
        gravar(ARQ_CANAIS, canais)
    return canais


def texto(o: dict, base: str) -> str:
    e = html.escape
    linhas = [f"<b>{e(o['titulo'])}</b>"]
    preco = f"<b>{brl(o['preco'])}</b>"
    linhas.append(f"De <s>{brl(o['preco_cheio'])}</s> por {preco} (-{o['desconto']}%)" if o.get("preco_cheio") else preco)
    extras = [x for x in ("Frete grátis" if o.get("frete_gratis") else "", "Full" if o.get("full") else "",
                          "Menor preço em 30 dias" if o.get("menor_30d") else "") if x]
    if extras:
        linhas.append(" · ".join(extras))
    linhas.append(f'\n<a href="{e(base)}/o/{e(urllib.parse.quote(o["id"]))}.html">Ver a oferta no Baixou</a>')
    linhas.append(f"<i>Link de afiliado · vendido em {e(o.get('loja') or 'Mercado Livre')}</i>")
    return "\n".join(linhas)


def escolher(ofertas: list[dict], estado: dict, agora: datetime) -> tuple[list[dict], dict]:
    """Decide o que publicar nesta rodada e devolve o estado atualizado (ids já publicados, com data)."""
    limite = (agora - timedelta(days=LEMBRAR_DIAS)).isoformat(timespec="minutes")
    publicados = {k: v for k, v in estado.get("publicados", {}).items() if v >= limite}
    novas = sorted((o for o in ofertas if o["id"] not in publicados), key=lambda o: -o.get("desconto", 0))
    if not estado:  # primeira vez: só as 3 melhores; o resto conta como já visto
        escolhidas = novas[:3]
        for o in novas[3:]:
            publicados[o["id"]] = agora.isoformat(timespec="minutes")
    else:
        escolhidas = novas[:MAX_POR_RODADA]
    return escolhidas, {"publicados": publicados}


def enviar(token: str, chat: str, o: dict, base: str) -> None:
    legenda = texto(o, base)
    foto = o.get("foto") or ""
    if foto.startswith("https://"):
        metodo, dados = "sendPhoto", {"chat_id": chat, "photo": foto, "caption": legenda, "parse_mode": "HTML"}
    else:
        metodo, dados = "sendMessage", {"chat_id": chat, "text": legenda, "parse_mode": "HTML"}
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/{metodo}",
                                 data=urllib.parse.urlencode(dados).encode(), method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        if not json.loads(r.read()).get("ok"):
            raise RuntimeError("o Telegram recusou a mensagem")


def main() -> int:
    canais = gravar_canais()
    token, chat = os.environ.get("TELEGRAM_BOT_TOKEN", ""), os.environ.get("TELEGRAM_CHAT_ID", "")
    if not (token and chat):
        print(f"canal do Telegram desligado (sem token/canal) · links no site: {sorted(canais) or 'nenhum'}")
        return 0
    dados = ler(ARQ_OFERTAS, {})
    if dados.get("modo") != "real" and os.environ.get("TELEGRAM_DEMO") != "1":
        print("modo demonstração: nada é publicado no canal")
        return 0
    agora = datetime.now(timezone.utc)
    escolhidas, estado = escolher(dados.get("ofertas", []), ler(ARQ_ESTADO, {}), agora)
    base, enviadas = site_url(), 0
    for o in escolhidas:
        try:
            enviar(token, chat, o, base)
            estado["publicados"][o["id"]] = agora.isoformat(timespec="minutes")
            enviadas += 1
        except Exception as e:  # um erro não derruba o robô; tenta de novo na próxima rodada
            print(f"  falha ao publicar {o['id']}: {type(e).__name__}")
    gravar(ARQ_ESTADO, estado)
    print(f"canal do Telegram: {enviadas} de {len(escolhidas)} ofertas publicadas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
