"""Robô do Baixou: garimpa ofertas, passa tudo pelo guardião e gera os dados do site.

Uso: python robo/robo.py
Sem as chaves do Mercado Livre (ML_CLIENT_ID / ML_CLIENT_SECRET) roda em modo demonstração.
Sai com código 2 quando o freio de emergência é acionado (o GitHub então avisa por e-mail).
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import demo  # noqa: E402
import guardiao as g  # noqa: E402
from ml import ClienteML, ErroML, normalizar  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
ARQ_CONFIG = RAIZ / "config.json"
ARQ_HIST = RAIZ / "dados" / "historico.json"
ARQ_OFERTAS = RAIZ / "site" / "data" / "ofertas.json"
ARQ_STATUS = RAIZ / "site" / "data" / "status.json"
ARQ_PRECOS = RAIZ / "site" / "data" / "precos.json"
ARQ_CONTADOR = RAIZ / "site" / "data" / "contador.json"
ARQ_RELACIONADOS = RAIZ / "site" / "data" / "relacionados.json"


def montar_relacionados(export: dict, publicados: set) -> dict:
    """Transforma a exportação do contador em 'quem viu também viu' e 'mais procurados' (só ofertas no ar)."""
    quem_viu: dict[str, list] = {}
    for par in sorted(export.get("pares", []), key=lambda x: -x.get("peso", 0)):
        a, b = str(par.get("a")), str(par.get("b"))
        if a in publicados and b in publicados and len(quem_viu.setdefault(a, [])) < 12:
            quem_viu[a].append(b)
    populares = [{"id": str(x["produto"]), "v": int(x.get("v") or 0), "c": int(x.get("c") or 0)}
                 for x in export.get("populares", []) if str(x.get("produto")) in publicados]
    return {"gerado_em": export.get("gerado_em"), "visitas_24h": int(export.get("visitas_24h") or 0),
            "quem_viu": quem_viu, "populares": populares[:60]}


def ler_contador(alertas: list) -> dict | None:
    """Busca os dados do contador anônimo, se ele já estiver publicado."""
    url = ler(ARQ_CONTADOR, {}).get("url")
    chave = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not url or not chave:
        return None
    token = hashlib.sha256(f"baixou-contador:{chave}".encode()).hexdigest()
    try:
        req = urllib.request.Request(url.rstrip("/") + "/export", headers={"Authorization": f"Bearer {token}", "User-Agent": "baixou-robo/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode())
    except Exception as e:  # o contador nunca derruba o robô
        alertas.append(f"Contador de visitas indisponível ({type(e).__name__}).")
        return None


def ler(caminho: Path, padrao):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return padrao


def gravar(caminho: Path, dados, compacto: bool = False) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(dados, ensure_ascii=False, separators=(",", ":")) if compacto else json.dumps(dados, ensure_ascii=False, indent=1)
    caminho.write_text(texto + "\n", encoding="utf-8")


def coletar_real(cfg: dict, anteriores: dict, alertas: list) -> tuple[list[dict], ClienteML]:
    cliente = ClienteML(os.environ["ML_CLIENT_ID"], os.environ["ML_CLIENT_SECRET"],
                        os.environ.get("ML_REFRESH_TOKEN") or None, cfg["site_id"])
    cliente.autenticar()
    regras = cfg["guardiao"]
    itens: dict[str, dict] = {}
    for cat in cfg["categorias"]:
        try:
            for bruto in cliente.buscar_categoria(cat["id"], cfg["paginas_por_categoria"]):
                itens[bruto["id"]] = normalizar(bruto, cat["nome"], None)
        except ErroML as e:
            alertas.append(f"Falha ao buscar a categoria {cat['nome']} ({e}).")

    # Rechecagem: tudo que estava no site é consultado de novo, mesmo que não tenha vindo na busca.
    faltando = [i for i in anteriores if i not in itens]
    if faltando:
        try:
            for bruto in cliente.itens(faltando):
                ant = anteriores[bruto["id"]]
                item = normalizar(bruto, ant["categoria"], None)
                if not item["parcelas"]:
                    item["parcelas"], item["sem_juros"] = ant.get("parcelas", 0), ant.get("sem_juros", False)
                itens[item["id"]] = item
        except ErroML as e:
            alertas.append(f"Falha ao rechecar ofertas publicadas ({e}).")

    # Reputação só para quem tem chance de passar (economiza chamadas).
    for item in itens.values():
        if not item["reputacao"] and item["condicao"] == "new" and g.desconto(item["preco"], item["preco_cheio"]) >= regras["desconto_minimo"]:
            item["reputacao"] = cliente.reputacao(item["vendedor_id"])

    mw, mt = os.environ.get("ML_MATT_WORD"), os.environ.get("ML_MATT_TOOL")
    for item in itens.values():
        item["link"] = g.link_afiliado(item["permalink"], mw, mt)
    return list(itens.values()), cliente


def main() -> int:
    inicio = time.time()
    cfg = ler(ARQ_CONFIG, None)
    regras = cfg["guardiao"]
    comissoes = {c["nome"]: c["comissao"] for c in cfg["categorias"]}
    agora = g.agora_utc()
    carimbo = agora.isoformat(timespec="minutes")

    historico = ler(ARQ_HIST, {})
    ofertas_ant = ler(ARQ_OFERTAS, {"ofertas": []})
    status_ant = ler(ARQ_STATUS, {})
    anteriores = {o["id"]: o for o in ofertas_ant.get("ofertas", [])}

    real = bool(os.environ.get("ML_CLIENT_ID") and os.environ.get("ML_CLIENT_SECRET"))
    afiliado_ok = bool(os.environ.get("ML_MATT_WORD") and os.environ.get("ML_MATT_TOOL"))
    modo = "real" if real else "demonstração"
    alertas: list[str] = []
    freio = None
    cliente = None

    # 1. Coleta
    try:
        if real:
            itens, cliente = coletar_real(cfg, anteriores, alertas)
        else:
            itens = demo.gerar(agora)
            for item in itens:
                item["link"] = item["permalink"]
    except ErroML as e:
        itens = []
        freio = f"Não foi possível falar com o Mercado Livre: {e}."

    if real and not afiliado_ok:
        alertas.append("Código de afiliado não configurado (ML_MATT_WORD / ML_MATT_TOOL): nenhuma oferta é publicada sem ele.")

    # 2. Guardião
    aprovadas, quarentena, motivos, avaliacao = [], [], Counter(), {}
    for item in itens:
        hist_item = historico.get(item["id"], [])
        situacao, motivo = g.avaliar(item, regras, comissoes.get(item["categoria"], 0), hist_item,
                                     exige_afiliado=real, checar_links=real)
        avaliacao[item["id"]] = (situacao, motivo)
        if situacao == "aprovada":
            aprovadas.append(item)
        else:
            motivos[motivo] += 1
            if situacao == "quarentena":
                quarentena.append(item | {"motivo": motivo, "desconto": g.desconto(item["preco"], item["preco_cheio"])})
        g.registrar_preco(historico, item["id"], item["preco"], agora, regras["historico_dias"])

    # 3. Duplicatas: fica a versão com maior desconto
    melhores: dict[str, dict] = {}
    for item in aprovadas:
        chave = g.chave_duplicata(item)
        if chave not in melhores or g.desconto(item["preco"], item["preco_cheio"]) > g.desconto(melhores[chave]["preco"], melhores[chave]["preco_cheio"]):
            if chave in melhores:
                motivos["duplicata"] += 1
            melhores[chave] = item
        else:
            motivos["duplicata"] += 1
    aprovadas = sorted(melhores.values(), key=lambda i: -g.desconto(i["preco"], i["preco_cheio"]))[: regras["max_ofertas"]]

    # 4. Freio de emergência
    if cliente and cliente.chamadas and cliente.erros / cliente.chamadas > regras["freio_taxa_erro"]:
        freio = freio or f"Muitas falhas na API ({cliente.erros} de {cliente.chamadas} chamadas)."
    if len(anteriores) >= 20 and len(aprovadas) < len(anteriores) * regras["freio_queda"]:
        freio = freio or f"Queda brusca de ofertas aprovadas ({len(anteriores)} → {len(aprovadas)})."
    if cliente and cliente.novo_refresh_token:
        alertas.append("O Mercado Livre trocou o refresh token: atualize o segredo ML_REFRESH_TOKEN.")

    # 5. Fotos extras e marca para a página do produto (só das aprovadas, em lotes de 20)
    fotos: dict[str, list[str]] = {}
    marcas: dict[str, str] = {}
    if cliente and aprovadas and not freio:
        try:
            for bruto in cliente.itens([i["id"] for i in aprovadas]):
                urls = [(f.get("secure_url") or f.get("url") or "").replace("http://", "https://") for f in bruto.get("pictures", [])]
                fotos[bruto["id"]] = [u for u in urls if u][:4]
                marca = next((a.get("value_name") for a in bruto.get("attributes", []) if a.get("id") == "BRAND"), None)
                if marca:
                    marcas[bruto["id"]] = marca
        except ErroML as e:
            alertas.append(f"Não foi possível buscar as fotos extras ({e}).")

    # 6. Publicação
    removidas = []
    if freio:
        alertas.insert(0, "FREIO ACIONADO: o site manteve as ofertas anteriores. " + freio)
    else:
        publicadas = []
        for item in aprovadas:
            publicadas.append({
                "id": item["id"], "titulo": item["titulo"], "categoria": item["categoria"],
                "preco": item["preco"], "preco_cheio": item["preco_cheio"],
                "desconto": g.desconto(item["preco"], item["preco_cheio"]),
                "parcelas": item["parcelas"], "sem_juros": item["sem_juros"],
                "frete_gratis": item["frete_gratis"], "full": item["full"],
                "foto": item["foto"], "fotos": fotos.get(item["id"], []),
                "marca": marcas.get(item["id"]) or item.get("marca"),
                "link": item["link"], "loja": cfg["loja"],
                "menor_30d": g.menor_preco_periodo(historico.get(item["id"], []), item["preco"]),
                "verificado_em": carimbo,
                "novo_em": anteriores.get(item["id"], {}).get("novo_em", carimbo),
            })
        ids_novos = {o["id"] for o in publicadas}
        for id_ant, ant in anteriores.items():
            if id_ant not in ids_novos:
                motivo = avaliacao.get(id_ant, ("", "anúncio não encontrado ou encerrado"))[1] or "substituída por oferta melhor"
                removidas.append({"titulo": ant["titulo"], "motivo": motivo})
        gravar(ARQ_OFERTAS, {"gerado_em": carimbo, "modo": modo, "ofertas": publicadas}, compacto=True)
        gravar(ARQ_PRECOS, {o["id"]: g.precos_diarios(historico.get(o["id"], [])) for o in publicadas}, compacto=True)
        export = ler_contador(alertas)
        if export is not None:
            gravar(ARQ_RELACIONADOS, montar_relacionados(export, ids_novos), compacto=True)

    gravar(ARQ_HIST, historico, compacto=True)

    publicadas_n = len(aprovadas) if not freio else len(anteriores)
    execucoes = ([{"em": carimbo, "publicadas": publicadas_n, "quarentena": len(quarentena),
                   "alertas": len(alertas)}] + status_ant.get("execucoes", []))[:30]
    gravar(ARQ_STATUS, {
        "gerado_em": carimbo,
        "modo": modo,
        "duracao_s": round(time.time() - inicio, 1),
        "afiliado_configurado": afiliado_ok,
        "freio": bool(freio),
        "contagem": {"candidatos": len(itens), "publicadas": publicadas_n,
                     "quarentena": len(quarentena), "reprovadas": sum(motivos.values()) - len(quarentena)},
        "motivos": dict(motivos.most_common()),
        "alertas": alertas,
        "quarentena": [{"titulo": q["titulo"], "preco": q["preco"], "preco_cheio": q["preco_cheio"],
                        "desconto": q["desconto"], "motivo": q["motivo"], "link": q.get("link", "")} for q in quarentena],
        "removidas": removidas[:50],
        "api": {"chamadas": cliente.chamadas, "erros": cliente.erros} if cliente else None,
        "produtos_no_historico": len(historico),
        "execucoes": execucoes,
    })

    print(f"[{modo}] candidatos={len(itens)} publicadas={publicadas_n} quarentena={len(quarentena)} alertas={len(alertas)}")
    for a in alertas:
        print("  alerta:", a)
    return 2 if freio else 0


if __name__ == "__main__":
    sys.exit(main())
