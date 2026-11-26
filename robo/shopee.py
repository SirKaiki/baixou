"""Cliente da API de afiliados da Shopee (Open API, GraphQL). Só leitura, só biblioteca padrão.

Autenticação (documentação da Shopee):
  Authorization: SHA256 Credential={AppId}, Timestamp={segundos}, Signature={sha256(AppId + Timestamp + corpo + Secret)}
O corpo assinado é exatamente o texto enviado.
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.request

API = "https://open-api.affiliate.shopee.com.br/graphql"
LOJA = "Shopee"
PREFIXO = "SHP"  # os ids da Shopee viram "SHP<itemId>", para não colidir com os do Mercado Livre

CAMPOS = ("itemId productName commissionRate price priceMin priceMax priceDiscountRate sales ratingStar "
          "imageUrl shopName shopId shopType productLink offerLink periodEndTime")

BUSCA = ("query($keyword:String,$sortType:Int,$page:Int,$limit:Int){"
         "productOfferV2(keyword:$keyword,sortType:$sortType,page:$page,limit:$limit)"
         "{nodes{" + CAMPOS + "} pageInfo{page limit hasNextPage}}}")
# Consulta de um produto: o código vai direto no texto (é um número que nós mesmos validamos),
# para não depender do nome do tipo inteiro grande no esquema da Shopee.
UM_ITEM = "query{productOfferV2(itemId:%d,page:1,limit:1){nodes{" + CAMPOS + "}}}"

MAIS_VENDIDOS = 2


class ErroShopee(Exception):
    pass


def assinatura(app_id: str, timestamp: int, corpo: str, secret: str) -> str:
    return hashlib.sha256(f"{app_id}{timestamp}{corpo}{secret}".encode()).hexdigest()


class ClienteShopee:
    def __init__(self, app_id: str, secret: str):
        self.app_id = app_id
        self.secret = secret
        self.chamadas = 0
        self.erros = 0

    def _consulta(self, consulta: str, variaveis: dict | None = None, tentativas: int = 3) -> dict:
        corpo = json.dumps({"query": consulta, "variables": variaveis or {}}, separators=(",", ":"), ensure_ascii=False)
        ultimo = None
        for tentativa in range(tentativas):
            self.chamadas += 1
            ts = int(time.time())
            cab = {
                "Content-Type": "application/json",
                "User-Agent": "baixou-robo/1.0",
                "Authorization": f"SHA256 Credential={self.app_id}, Timestamp={ts}, Signature={assinatura(self.app_id, ts, corpo, self.secret)}",
            }
            try:
                req = urllib.request.Request(API, data=corpo.encode(), headers=cab, method="POST")
                with urllib.request.urlopen(req, timeout=20) as r:
                    resposta = json.loads(r.read().decode())
            except urllib.error.HTTPError as e:
                ultimo = f"HTTP {e.code}"
                if e.code in (429, 500, 502, 503, 504):
                    time.sleep(2 * (tentativa + 1))
                    continue
                break
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
                ultimo = type(e).__name__
                time.sleep(2 * (tentativa + 1))
                continue
            erros = resposta.get("errors") or []
            if erros:
                codigo = ((erros[0] or {}).get("extensions") or {}).get("code")
                ultimo = {10020: "assinatura inválida (confira SHOPEE_APP_ID e SHOPEE_APP_SECRET)",
                          10035: "a conta ainda não tem acesso à Open API",
                          10030: "limite de requisições"}.get(codigo, f"erro {codigo or 'desconhecido'} da API")
                if codigo == 10030:
                    time.sleep(3 * (tentativa + 1))
                    continue
                break
            return (resposta.get("data") or {}).get("productOfferV2") or {}
        self.erros += 1
        raise ErroShopee(ultimo or "falha desconhecida")

    def buscar(self, palavra: str, paginas: int, limite: int = 50) -> list[dict]:
        itens = []
        for pagina in range(1, paginas + 1):
            r = self._consulta(BUSCA, {"keyword": palavra, "sortType": MAIS_VENDIDOS, "page": pagina, "limit": limite})
            itens += [n for n in (r.get("nodes") or []) if isinstance(n, dict)]
            if not (r.get("pageInfo") or {}).get("hasNextPage"):
                break
        return itens

    def item(self, item_id: int) -> dict | None:
        if not isinstance(item_id, int) or item_id <= 0:
            return None
        nos = self._consulta(UM_ITEM % item_id, tentativas=2).get("nodes") or []
        return nos[0] if nos and isinstance(nos[0], dict) else None


def _num(valor) -> float:
    try:
        return float(valor)
    except (TypeError, ValueError):
        return 0.0


def reputacao(bruto: dict) -> str | None:
    """Shopee não informa reputação como o Mercado Livre. Usamos o tipo de loja e a nota."""
    tipos = bruto.get("shopType") or []
    tipos = tipos if isinstance(tipos, list) else [tipos]
    if 1 in tipos:
        return "shopee_oficial"          # Shopee Mall (lojas oficiais)
    if 2 in tipos or 4 in tipos:
        return "shopee_indicada"         # Lojas Indicadas (Star / Star+)
    if _num(bruto.get("ratingStar")) >= 4.7 and _num(bruto.get("sales")) >= 100:
        return "shopee_bem_avaliada"
    return None


def normalizar(bruto: dict, categoria_nome: str) -> dict:
    """Converte a oferta da Shopee para o formato do robô."""
    item_id = str(bruto.get("itemId") or "")
    preco = round(_num(bruto.get("priceMin") or bruto.get("price")), 2)
    taxa = _num(bruto.get("priceDiscountRate"))
    taxa = taxa * 100 if 0 < taxa < 1 else taxa  # aceita 0.35 ou 35
    cheio = round(preco / (1 - taxa / 100), 2) if 0 < taxa < 100 and preco > 0 else None
    comissao = _num(bruto.get("commissionRate"))
    comissao = comissao * 100 if 0 < comissao < 1 else comissao
    return {
        "id": f"{PREFIXO}{item_id}" if item_id.isdigit() else "",
        "item_id": int(item_id) if item_id.isdigit() else None,
        "titulo": bruto.get("productName") or "",
        "categoria": categoria_nome,
        "preco": preco,
        "preco_cheio": cheio,
        "condicao": "new",
        "estoque": 1,
        "status": "active",
        "reputacao": reputacao(bruto),
        "frete_gratis": False,
        "full": False,
        "parcelas": 0,
        "sem_juros": False,
        "foto": (bruto.get("imageUrl") or "").replace("http://", "https://", 1),
        "permalink": bruto.get("productLink") or "",
        "link": bruto.get("offerLink") or "",
        "catalogo": None,
        "categoria_ml": None,
        "loja": LOJA,
        "comissao": round(comissao, 2),
        "marca": None,
    }
