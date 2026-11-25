"""Cliente simples da API do Mercado Livre (só leitura, só biblioteca padrão)."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.mercadolibre.com"


class ErroML(Exception):
    pass


class ClienteML:
    def __init__(self, client_id: str, client_secret: str, refresh_token: str | None = None, site: str = "MLB"):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.site = site
        self.token: str | None = None
        self.chamadas = 0
        self.erros = 0
        self.novo_refresh_token: str | None = None
        self._reputacoes: dict[str, str | None] = {}

    # ----- infraestrutura -----

    def _requisicao(self, metodo: str, caminho: str, dados: dict | None = None, autenticar: bool = True, tentativas: int = 3):
        url = caminho if caminho.startswith("http") else API + caminho
        corpo = urllib.parse.urlencode(dados).encode() if dados else None
        cabecalhos = {"Accept": "application/json", "User-Agent": "baixou-robo/1.0"}
        if dados:
            cabecalhos["Content-Type"] = "application/x-www-form-urlencoded"
        if autenticar and self.token:
            cabecalhos["Authorization"] = f"Bearer {self.token}"
        ultimo = None
        for tentativa in range(tentativas):
            self.chamadas += 1
            try:
                req = urllib.request.Request(url, data=corpo, headers=cabecalhos, method=metodo)
                with urllib.request.urlopen(req, timeout=20) as resp:
                    return json.loads(resp.read().decode())
            except urllib.error.HTTPError as e:
                ultimo = f"HTTP {e.code} em {caminho.split('?')[0]}"
                if e.code in (429, 500, 502, 503, 504):
                    time.sleep(2 * (tentativa + 1))
                    continue
                break
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
                ultimo = f"{type(e).__name__} em {caminho.split('?')[0]}"
                time.sleep(2 * (tentativa + 1))
        self.erros += 1
        raise ErroML(ultimo or "falha desconhecida")

    def autenticar(self) -> None:
        """Tenta o token de aplicativo; se não der, usa o refresh token (se houver)."""
        try:
            r = self._requisicao("POST", "/oauth/token", {
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }, autenticar=False, tentativas=2)
            self.token = r["access_token"]
            return
        except (ErroML, KeyError):
            if not self.refresh_token:
                raise ErroML("não foi possível obter o token de acesso do Mercado Livre")
        r = self._requisicao("POST", "/oauth/token", {
            "grant_type": "refresh_token",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": self.refresh_token,
        }, autenticar=False, tentativas=2)
        self.token = r["access_token"]
        if r.get("refresh_token") and r["refresh_token"] != self.refresh_token:
            self.novo_refresh_token = r["refresh_token"]

    # ----- dados -----

    def buscar_categoria(self, categoria: str, paginas: int) -> list[dict]:
        itens = []
        for pagina in range(paginas):
            q = urllib.parse.urlencode({"category": categoria, "limit": 50, "offset": 50 * pagina})
            r = self._requisicao("GET", f"/sites/{self.site}/search?{q}")
            itens += r.get("results", [])
            if len(r.get("results", [])) < 50:
                break
        return itens

    def itens(self, ids: list[str]) -> list[dict]:
        """Busca até 20 anúncios por chamada; ignora os que vierem com erro."""
        saida = []
        for i in range(0, len(ids), 20):
            lote = ",".join(ids[i:i + 20])
            r = self._requisicao("GET", f"/items?ids={lote}")
            saida += [x["body"] for x in r if x.get("code") == 200 and isinstance(x.get("body"), dict)]
        return saida

    def nome_categoria(self, categoria_id: str) -> str | None:
        try:
            return self._requisicao("GET", f"/categories/{categoria_id}", tentativas=2).get("name")
        except ErroML:
            return None

    def reputacao(self, vendedor_id) -> str | None:
        chave = str(vendedor_id)
        if chave not in self._reputacoes:
            try:
                r = self._requisicao("GET", f"/users/{chave}", tentativas=2)
                self._reputacoes[chave] = (r.get("seller_reputation") or {}).get("level_id")
            except ErroML:
                self._reputacoes[chave] = None
        return self._reputacoes[chave]


def normalizar(bruto: dict, categoria_nome: str, reputacao: str | None) -> dict:
    """Converte o anúncio do formato da API para o formato do robô."""
    parc = bruto.get("installments") or {}
    frete = bruto.get("shipping") or {}
    foto = (bruto.get("thumbnail") or bruto.get("secure_thumbnail") or "").replace("http://", "https://")
    foto = foto.replace("-I.jpg", "-O.jpg")
    vendedor = bruto.get("seller") or {}
    rep_busca = (vendedor.get("seller_reputation") or {}).get("level_id") if isinstance(vendedor, dict) else None
    return {
        "id": bruto.get("id"),
        "titulo": bruto.get("title", ""),
        "categoria": categoria_nome,
        "preco": float(bruto.get("price") or 0),
        "preco_cheio": float(bruto["original_price"]) if bruto.get("original_price") else None,
        "condicao": bruto.get("condition"),
        "estoque": bruto.get("available_quantity", 1),
        "status": bruto.get("status", "active"),
        "vendedor_id": (vendedor.get("id") if isinstance(vendedor, dict) else None) or bruto.get("seller_id"),
        "reputacao": reputacao or rep_busca,
        "frete_gratis": bool(frete.get("free_shipping")),
        "full": frete.get("logistic_type") == "fulfillment",
        "parcelas": parc.get("quantity") or 0,
        "sem_juros": (parc.get("rate") == 0) if parc else False,
        "foto": foto,
        "permalink": bruto.get("permalink", ""),
        "catalogo": bruto.get("catalog_product_id"),
        "categoria_ml": bruto.get("category_id"),
    }
