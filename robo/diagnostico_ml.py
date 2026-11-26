"""Diagnóstico da API do Mercado Livre: descobre o que a conta do Baixou ainda consegue consultar.

O Mercado Livre fechou a busca (/sites/MLB/search) para apps de terceiros, mas outras consultas oficiais podem
continuar abertas (mais vendidos, catálogo, itens). Este script testa cada uma e grava só o resultado
(funcionou ou não, e quantos itens veio), nunca chaves nem tokens, em dados/diagnostico_ml.json.
Roda no máximo a cada 6 horas e só quando as chaves do Mercado Livre existem. Nunca derruba o robô.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ml import ClienteML, ErroML  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
ARQ = RAIZ / "dados" / "diagnostico_ml.json"
CATEGORIA = "MLB1055"  # Celulares e Smartphones


def _teste(cliente: ClienteML, nome: str, caminho: str, resumo) -> tuple[dict, object]:
    try:
        r = cliente._requisicao("GET", caminho, tentativas=1)
        return {"teste": nome, "ok": True, **resumo(r)}, r
    except ErroML as e:
        return {"teste": nome, "ok": False, "erro": str(e).split(" em ")[0]}, None


def rodar(cliente: ClienteML) -> list[dict]:
    resultados = []
    try:
        cliente.autenticar()
        resultados.append({"teste": "token do aplicativo", "ok": True})
    except ErroML as e:
        return [{"teste": "token do aplicativo", "ok": False, "erro": str(e)}]

    def add(nome, caminho, resumo):
        res, dados = _teste(cliente, nome, caminho, resumo)
        resultados.append(res)
        return dados

    lista = lambda chave: (lambda r: {"quantidade": len((r or {}).get(chave) or [])})  # noqa: E731
    add("busca por categoria (/sites/MLB/search)", f"/sites/MLB/search?category={CATEGORIA}&limit=5", lista("results"))
    destaques = add("mais vendidos da categoria (/highlights)", f"/highlights/MLB/category/{CATEGORIA}",
                    lambda r: {"quantidade": len(r.get("content") or []),
                               "tipos": sorted({c.get("type") for c in r.get("content") or [] if isinstance(c, dict)})})
    add("tendências de busca (/trends)", f"/trends/MLB/{CATEGORIA}", lambda r: {"quantidade": len(r or [])})
    catalogo = add("busca no catálogo (/products/search)", "/products/search?status=active&site_id=MLB&q=smartphone&limit=5", lista("results"))
    add("categorias do site (/sites/MLB/categories)", "/sites/MLB/categories", lambda r: {"quantidade": len(r or [])})

    conteudo = (destaques or {}).get("content") or []
    produto = next((c.get("id") for c in conteudo if c.get("type") == "PRODUCT"), None) \
        or next((p.get("id") for p in (catalogo or {}).get("results") or []), None)
    item = next((c.get("id") for c in conteudo if c.get("type") == "ITEM"), None)
    if produto:
        p = add("produto de catálogo (/products/ID)", f"/products/{produto}",
                lambda r: {"tem_buy_box": bool(r.get("buy_box_winner")), "tem_preco": bool((r.get("buy_box_winner") or {}).get("price"))})
        ofertas = add("ofertas do produto (/products/ID/items)", f"/products/{produto}/items", lista("results"))
        item = item or ((p or {}).get("buy_box_winner") or {}).get("item_id") \
            or next((o.get("item_id") for o in (ofertas or {}).get("results") or []), None)
    if item:
        add("vários itens (/items?ids=)", f"/items?ids={item}",
            lambda r: {"quantidade": len(r or []), "codigo": (r or [{}])[0].get("code"),
                       "tem_preco": bool(((r or [{}])[0].get("body") or {}).get("price")),
                       "tem_preco_original": bool(((r or [{}])[0].get("body") or {}).get("original_price"))})
        add("um item (/items/ID)", f"/items/{item}", lambda r: {"tem_preco": bool(r.get("price")), "tem_preco_original": bool(r.get("original_price"))})
        add("preço do item (/items/ID/prices)", f"/items/{item}/prices", lambda r: {"quantidade": len(r.get("prices") or [])})
    return resultados


def main() -> int:
    if not (os.environ.get("ML_CLIENT_ID") and os.environ.get("ML_CLIENT_SECRET")):
        print("diagnóstico do Mercado Livre: sem chaves, nada a testar")
        return 0
    agora = datetime.now(timezone.utc)
    try:
        anterior = json.loads(ARQ.read_text(encoding="utf-8"))
        if datetime.fromisoformat(anterior["em"]) > agora - timedelta(hours=6) and not os.environ.get("DIAGNOSTICO_AGORA"):
            print("diagnóstico do Mercado Livre: já rodou nas últimas 6 horas")
            return 0
    except (OSError, ValueError, KeyError):
        pass
    try:
        resultados = rodar(ClienteML(os.environ["ML_CLIENT_ID"], os.environ["ML_CLIENT_SECRET"], os.environ.get("ML_REFRESH_TOKEN")))
    except Exception as e:  # o diagnóstico nunca derruba o robô
        resultados = [{"teste": "diagnóstico", "ok": False, "erro": type(e).__name__}]
    ARQ.parent.mkdir(parents=True, exist_ok=True)
    ARQ.write_text(json.dumps({"em": agora.isoformat(timespec="minutes"), "resultados": resultados}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    for r in resultados:
        print(("  ✔ " if r["ok"] else "  ✘ ") + r["teste"], {k: v for k, v in r.items() if k not in ("teste", "ok")})
    return 0


if __name__ == "__main__":
    sys.exit(main())
