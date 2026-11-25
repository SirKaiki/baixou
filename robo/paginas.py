"""Gera, só no pacote publicado (não vai para o repositório):

- site/o/<id>.html: uma página leve por oferta, com título, preço e foto nas etiquetas
  Open Graph. É o link que o botão "Compartilhar" usa, para o WhatsApp, o Telegram e as
  redes mostrarem a prévia da oferta. Quem abre é levado na hora para a página da oferta.
- site/sitemap.xml: a lista de páginas para o Google.

Uso: python robo/paginas.py   (endereço do site em SITE_URL; se faltar, deduz do repositório)
"""
from __future__ import annotations

import html
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlencode

RAIZ = Path(__file__).resolve().parent.parent
SITE = RAIZ / "site"


def endereco_site() -> str:
    url = os.environ.get("SITE_URL", "").strip().rstrip("/")
    if url:
        return url
    repo = os.environ.get("GITHUB_REPOSITORY", "SirKaiki/baixou")
    dono, nome = repo.split("/", 1)
    return f"https://{dono.lower()}.github.io/{nome}"


def brl(v: float) -> str:
    s = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def ler(caminho: Path, padrao):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return padrao


def pagina(o: dict, base: str, encerrada: bool = False) -> str:
    e = html.escape
    alvo = f"{base}/?p={quote(o['id'])}"
    preco = brl(float(o["preco"]))
    if encerrada:
        titulo = f"Oferta encerrada: {o['titulo']}"
        descricao = f"Esta oferta saiu do ar (último preço {preco}). Veja as promoções que estão valendo agora no Baixou."
    else:
        titulo = f"{o['titulo']} por {preco} (-{o.get('desconto', 0)}%)"
        descricao = (f"De {brl(float(o['preco_cheio']))} por {preco}" if o.get("preco_cheio") else preco) + \
            (" · frete grátis" if o.get("frete_gratis") else "") + " · preço conferido pelo robô do Baixou."
    foto = o.get("foto") or ""
    if not foto.startswith("https://"):
        foto = f"{base}/img/og.png"
    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(titulo)} | Baixou</title>
<meta name="description" content="{e(descricao)}">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="{e(alvo)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Baixou">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="{e(titulo)}">
<meta property="og:description" content="{e(descricao)}">
<meta property="og:image" content="{e(foto)}">
<meta property="og:url" content="{e(base)}/o/{e(quote(o['id']))}.html">
<meta property="product:price:amount" content="{float(o['preco']):.2f}">
<meta property="product:price:currency" content="BRL">
<meta name="twitter:card" content="summary_large_image">
<script>location.replace({json.dumps(alvo)} + location.hash)</script>
<style>body{{font:16px system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f4f4f6;color:#16171b;text-align:center}}a{{color:#1a3cff}}img{{max-width:220px;height:auto}}</style>
</head><body><main><img src="{e(foto)}" alt=""><h1 style="font-size:20px;max-width:520px">{e(o['titulo'])}</h1><p><b>{e(preco)}</b></p><p><a href="{e(alvo)}">Ver a oferta no Baixou</a></p></main></body></html>
"""


def main() -> int:
    base = endereco_site()
    ofertas = ler(SITE / "data" / "ofertas.json", {}).get("ofertas", [])
    encerradas = ler(SITE / "data" / "encerradas.json", {}).get("ofertas", [])
    destino = SITE / "o"
    destino.mkdir(exist_ok=True)
    ativos = set()
    for o in ofertas:
        (destino / f"{o['id']}.html").write_text(pagina(o, base), encoding="utf-8")
        ativos.add(o["id"])
    for o in encerradas:
        if o.get("id") and o["id"] not in ativos and o.get("titulo") and o.get("preco"):
            (destino / f"{o['id']}.html").write_text(pagina(o, base, encerrada=True), encoding="utf-8")

    hoje = datetime.now(timezone.utc).date().isoformat()
    urls = [f"{base}/"] + [f"{base}/?{urlencode({'ver': v})}" for v in ("todas", "descontos", "menor", "novas")]
    urls += [f"{base}/?{urlencode({'cat': c})}" for c in sorted({o["categoria"] for o in ofertas if o.get("categoria")})]
    urls += [f"{base}/?p={quote(o['id'])}" for o in ofertas]
    corpo = "".join(f"<url><loc>{html.escape(u)}</loc><lastmod>{hoje}</lastmod></url>" for u in urls)
    (SITE / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{corpo}</urlset>\n',
        encoding="utf-8")
    print(f"páginas de compartilhamento: {len(ativos)} ativas + {len(encerradas)} encerradas · sitemap com {len(urls)} endereços · {base}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
