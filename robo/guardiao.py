"""Guardião: decide se uma oferta pode ir para o site.

Cada regra devolve um motivo legível. Há dois níveis de bloqueio:
- "reprovada": não serve (produto usado, sem estoque, desconto pequeno...).
- "quarentena": parece boa demais ou suspeita; fica fora do site e aparece no painel.
"""
from __future__ import annotations

import statistics
import unicodedata
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

HOSTS_ML = ("mercadolivre.com.br",)
CAMINHOS_PROIBIDOS = ("/ofertas", "/ofertas-do-dia", "/lista", "/busca")


def _sem_acento(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn")


def desconto(preco: float, preco_cheio: float | None) -> int:
    if not preco_cheio or preco_cheio <= preco:
        return 0
    return round((1 - preco / preco_cheio) * 100)


# ---------- link de afiliado ----------

def link_afiliado(permalink: str, matt_word: str | None, matt_tool: str | None) -> str:
    """Acrescenta o código de afiliado ao link do produto, sem mexer no resto."""
    partes = urlsplit(permalink)
    query = [(k, v) for k, v in parse_qsl(partes.query) if k not in ("matt_word", "matt_tool")]
    if matt_word and matt_tool:
        query += [("matt_word", matt_word), ("matt_tool", matt_tool)]
    return urlunsplit((partes.scheme or "https", partes.netloc, partes.path, urlencode(query), ""))


def checar_link(link: str, exige_afiliado: bool) -> str | None:
    """Devolve um motivo de bloqueio, ou None se o link está ok."""
    partes = urlsplit(link)
    host = partes.netloc.lower()
    if partes.scheme != "https" or not any(host == h or host.endswith("." + h) for h in HOSTS_ML):
        return "link fora do Mercado Livre"
    if host.startswith("lista.") or any(partes.path.startswith(c) for c in CAMINHOS_PROIBIDOS) or partes.path in ("", "/"):
        return "link não aponta para uma página de produto"
    if exige_afiliado:
        params = dict(parse_qsl(partes.query))
        if not params.get("matt_word") or not params.get("matt_tool"):
            return "link sem código de afiliado"
    return None


# ---------- histórico de preços ----------

def registrar_preco(historico: dict, item_id: str, preco: float, agora: datetime, dias: int) -> None:
    """Guarda um ponto por mudança de preço (ou a cada 6 h), e descarta o que passou da janela."""
    pontos = historico.setdefault(item_id, [])
    limite = agora - timedelta(days=dias)
    pontos[:] = [p for p in pontos if datetime.fromisoformat(p[0]) >= limite]
    if not pontos or pontos[-1][1] != preco or datetime.fromisoformat(pontos[-1][0]) <= agora - timedelta(hours=6):
        pontos.append([agora.isoformat(timespec="minutes"), preco])


def _janela(pontos: list) -> tuple[list[float], float]:
    if not pontos:
        return [], 0.0
    precos = [p[1] for p in pontos]
    inicio = datetime.fromisoformat(pontos[0][0])
    fim = datetime.fromisoformat(pontos[-1][0])
    return precos, (fim - inicio).total_seconds() / 86400


# ---------- a avaliação ----------

def avaliar(item: dict, regras: dict, comissao: float, historico_item: list, exige_afiliado: bool, checar_links: bool = True):
    """Devolve (situacao, motivo). situacao: 'aprovada' | 'reprovada' | 'quarentena'."""
    preco = item.get("preco") or 0
    cheio = item.get("preco_cheio")
    pct = desconto(preco, cheio)
    titulo = _sem_acento(item.get("titulo", ""))

    if item.get("status") != "active":
        return "reprovada", "anúncio inativo"
    if (item.get("estoque") or 0) <= 0:
        return "reprovada", "sem estoque"
    if item.get("condicao") != "new":
        return "reprovada", "produto não é novo"
    for palavra in regras["palavras_bloqueadas"]:
        if _sem_acento(palavra) in titulo:
            return "reprovada", f"palavra bloqueada: {palavra}"
    if comissao < regras["comissao_minima"]:
        return "reprovada", "categoria sem comissão"
    if preco < regras["preco_minimo"]:
        return "reprovada", "preço baixo demais para valer a comissão"
    rep = item.get("reputacao")
    if rep not in regras["reputacoes_aceitas"]:
        return "reprovada", "vendedor com reputação baixa" if rep else "reputação do vendedor desconhecida"
    if pct < regras["desconto_minimo"]:
        return "reprovada", f"desconto menor que {regras['desconto_minimo']}%"

    motivo_link = checar_link(item.get("link", ""), exige_afiliado) if checar_links else None
    if motivo_link:
        return "quarentena", motivo_link

    precos, dias = _janela(historico_item)
    if len(precos) >= 3 and dias >= 2:
        maior = max(precos)
        if cheio and cheio > maior * regras["inflacao_maxima"]:
            return "quarentena", "preço cheio inflado (acima do maior preço visto no período)"
        if len(precos) >= 6 and dias >= 7 and preco >= statistics.median(precos) * 0.97:
            return "reprovada", "preço igual ao de sempre (desconto não é real)"

    if pct >= regras["desconto_quarentena"]:
        return "quarentena", f"desconto suspeito ({pct}%), pode ser erro de anúncio"

    return "aprovada", ""


def menor_preco_periodo(pontos: list, preco: float) -> bool:
    """True quando o preço atual é o menor visto na janela (com pelo menos 3 dias de histórico)."""
    precos, dias = _janela(pontos)
    return len(precos) >= 3 and dias >= 3 and preco <= min(precos)


def precos_diarios(pontos: list) -> list:
    """Resume o histórico em um ponto por dia (o menor preço do dia), para o gráfico do site."""
    por_dia: dict[str, float] = {}
    for quando, preco in pontos:
        dia = quando[:10]
        por_dia[dia] = min(preco, por_dia.get(dia, preco))
    return [[d, por_dia[d]] for d in sorted(por_dia)]


def chave_duplicata(item: dict) -> str:
    """Mesmo produto de catálogo, ou mesmo título, conta como duplicata."""
    return item.get("catalogo") or _sem_acento(item.get("titulo", ""))[:60]


def agora_utc() -> datetime:
    return datetime.now(timezone.utc).replace(second=0, microsecond=0)
