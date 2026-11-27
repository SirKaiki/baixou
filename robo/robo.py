"""Robô do Baixou: garimpa ofertas, passa tudo pelo guardião e gera os dados do site.

Uso: python robo/robo.py
Sem as chaves do Mercado Livre (ML_CLIENT_ID / ML_CLIENT_SECRET) roda em modo demonstração.
Sai com código 2 quando o freio de emergência é acionado (o GitHub então avisa por e-mail).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
import urllib.request
from collections import Counter
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import demo  # noqa: E402
import guardiao as g  # noqa: E402
from ml import ClienteML, ErroML, normalizar  # noqa: E402
import shopee as sp  # noqa: E402
import modelo  # noqa: E402
import aprendiz  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
ARQ_CONFIG = RAIZ / "config.json"
ARQ_HIST = RAIZ / "dados" / "historico.json"
ARQ_APRENDIZ = RAIZ / "dados" / "aprendiz.json"
ARQ_CATS = RAIZ / "dados" / "categorias.json"
ARQ_OFERTAS = RAIZ / "site" / "data" / "ofertas.json"
ARQ_STATUS = RAIZ / "site" / "data" / "status.json"
ARQ_PRECOS = RAIZ / "site" / "data" / "precos.json"
ARQ_CONTADOR = RAIZ / "site" / "data" / "contador.json"
ARQ_RELACIONADOS = RAIZ / "site" / "data" / "relacionados.json"
ARQ_ENCERRADAS = RAIZ / "site" / "data" / "encerradas.json"
DIAS_ENCERRADAS = 7  # quanto tempo a página de uma oferta que saiu do ar continua mostrando o último preço


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


CONTADOR_URL = re.compile(r"https://[a-z0-9-]+(\.[a-z0-9-]+)*\.workers\.dev")


class _SemRedirecionar(urllib.request.HTTPRedirectHandler):
    """Não segue redirecionamentos: a chave do contador só vai para o endereço do próprio contador."""
    def redirect_request(self, *args, **kwargs):
        return None


def chave_contador() -> str | None:
    """Chave de leitura do contador. No GitHub vem pronta (CONTADOR_TOKEN), e o robô nem recebe a chave da Cloudflare."""
    pronta = os.environ.get("CONTADOR_TOKEN")
    if pronta:
        return pronta
    cf = os.environ.get("CLOUDFLARE_API_TOKEN")
    return hashlib.sha256(f"baixou-contador:{cf}".encode()).hexdigest() if cf else None


def ler_contador(alertas: list) -> dict | None:
    """Busca os dados do contador anônimo, se ele já estiver publicado."""
    url = str(ler(ARQ_CONTADOR, {}).get("url") or "")
    token = chave_contador()
    if not url or not token:
        return None
    if not CONTADOR_URL.fullmatch(url):
        alertas.append("Endereço do contador inválido em site/data/contador.json: ignorado.")
        return None
    try:
        req = urllib.request.Request(url + "/export", headers={"Authorization": f"Bearer {token}", "User-Agent": "baixou-robo/1.0"})
        with urllib.request.build_opener(_SemRedirecionar).open(req, timeout=20) as r:
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
    faltando = [i for i, o in anteriores.items() if i not in itens and (o.get("loja") or "Mercado Livre") == "Mercado Livre"]
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


def coletar_shopee(cfg: dict, anteriores: dict, alertas: list) -> tuple[list[dict], sp.ClienteShopee]:
    cliente = sp.ClienteShopee(os.environ["SHOPEE_APP_ID"], os.environ["SHOPEE_APP_SECRET"])
    opc = cfg.get("shopee", {})
    itens: dict[str, dict] = {}
    for cat in cfg["categorias"]:
        for palavra in cat.get("shopee", []):
            try:
                for bruto in cliente.buscar(palavra, opc.get("paginas_por_busca", 1), opc.get("itens_por_pagina", 50)):
                    item = sp.normalizar(bruto, cat["nome"])
                    if item["id"] and item["id"] not in itens:
                        itens[item["id"]] = item
            except sp.ErroShopee as e:
                alertas.append(f"Shopee: falha ao buscar \"{palavra}\" ({e}).")
                if not itens and cliente.chamadas <= 2:
                    raise  # o primeiro pedido já falhou (chave errada, sem acesso...): não adianta insistir

    # Rechecagem: o que estava no site e não veio nas buscas é consultado de novo, um a um (com limite).
    faltando = [o for i, o in anteriores.items() if i not in itens and o.get("loja") == sp.LOJA and i[len(sp.PREFIXO):].isdigit()]
    for ant in faltando[: opc.get("rechecar_no_maximo", 80)]:
        try:
            bruto = cliente.item(int(ant["id"][len(sp.PREFIXO):]))
        except sp.ErroShopee as e:
            alertas.append(f"Shopee: falha ao rechecar ofertas publicadas ({e}).")
            break
        if bruto:
            item = sp.normalizar(bruto, ant["categoria"])
            if item["id"]:
                itens[item["id"]] = item
    return list(itens.values()), cliente


def atualizar_encerradas(atual: dict, anteriores: dict, ids_novos: set, avaliacao: dict, historico: dict, agora) -> dict:
    """Guarda por alguns dias as ofertas que saíram do ar, para o link antigo mostrar "oferta encerrada" com o último preço."""
    carimbo = agora.isoformat(timespec="minutes")
    limite = (agora - timedelta(days=DIAS_ENCERRADAS)).isoformat(timespec="minutes")
    lista = {o["id"]: o for o in atual.get("ofertas", []) if o.get("encerrada_em", "") >= limite and o["id"] not in ids_novos}
    for id_ant, ant in anteriores.items():
        if id_ant in ids_novos or id_ant in lista:
            continue
        motivo = avaliacao.get(id_ant, ("", "anúncio encerrado"))[1] or "substituída por oferta melhor"
        lista[id_ant] = {k: ant.get(k) for k in ("id", "titulo", "categoria", "subcategoria", "marca", "foto", "preco", "preco_cheio", "desconto", "loja")} | {
            "encerrada_em": carimbo, "motivo": motivo, "historico": g.precos_diarios(historico.get(id_ant, []))}
    ordem = sorted(lista.values(), key=lambda o: o["encerrada_em"], reverse=True)[:300]
    return {"gerado_em": carimbo, "ofertas": ordem}


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

    ml_ativo = bool(os.environ.get("ML_CLIENT_ID") and os.environ.get("ML_CLIENT_SECRET"))
    shopee_ativa = bool(os.environ.get("SHOPEE_APP_ID") and os.environ.get("SHOPEE_APP_SECRET"))
    real = ml_ativo or shopee_ativa
    afiliado_ok = not ml_ativo or bool(os.environ.get("ML_MATT_WORD") and os.environ.get("ML_MATT_TOOL"))
    modo = "real" if real else "demonstração"
    # Saindo da demonstração para o modo real: as ofertas simuladas não contam como "anteriores"
    # (senão o freio de "queda brusca" seguraria o site na demonstração para sempre).
    cur = modelo.config(cfg.get("curadoria"))
    cfg_aprendiz = aprendiz.config(cfg.get("aprendiz"))
    janela_hist = max(regras["historico_dias"], cur["janela_dias"])
    # Mudou o modo da curadoria (observar ↔ aplicar)? Também recomeça do zero, pelo mesmo motivo.
    estreia = real and (ofertas_ant.get("modo") != "real" or ofertas_ant.get("curadoria", "observar") != cur["modo"])
    if estreia:
        anteriores = {}
    alertas: list[str] = []
    freio = None
    cliente = None  # cliente do Mercado Livre (fotos extras e subcategorias)
    clientes = []

    # 1. Coleta (cada loja configurada; se uma loja falhar por completo, o freio segura o site como estava)
    itens = []
    if not real:
        itens = demo.gerar(agora)
        for item in itens:
            item["link"] = item["permalink"]
            # histórico simulado e coerente (os preços de exemplo mudam a cada hora; guardá-los como se fossem
            # reais fazia o guardião desconfiar do preço cheio depois de dois dias e o freio segurar o site)
            historico[item["id"]] = demo.historico(item, agora)
    if ml_ativo:
        try:
            ml_itens, cliente = coletar_real(cfg, anteriores, alertas)
            itens += ml_itens
            clientes.append(cliente)
        except ErroML as e:
            freio = f"Não foi possível falar com o Mercado Livre: {e}."
    if shopee_ativa:
        try:
            sp_itens, cliente_sp = coletar_shopee(cfg, anteriores, alertas)
            itens += sp_itens
            clientes.append(cliente_sp)
        except sp.ErroShopee as e:
            freio = freio or f"Não foi possível falar com a Shopee: {e}."

    if ml_ativo and not afiliado_ok:
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
        g.registrar_preco(historico, item["id"], item["preco"], agora, janela_hist)

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
    aprovadas = sorted(melhores.values(), key=lambda i: -g.desconto(i["preco"], i["preco_cheio"]))

    # 3b. Curadoria por dados: o quanto o preço de agora é raro para cada produto (modelo estatístico)
    perfis = {i["id"]: modelo.perfil(historico.get(i["id"], []), i["preco"], agora, cur) for i in aprovadas}
    calibragem = modelo.calibragem([(i, perfis[i["id"]]) for i in aprovadas], cur)
    if cur["modo"] == "aplicar":
        ordem_nivel = {n: k for k, n in enumerate(modelo.NIVEIS)}
        fora = [i for i in aprovadas if perfis[i["id"]]["nivel"] not in cur["publicar"]]
        for i in fora:
            motivos[f"curadoria: preço {perfis[i['id']]['nivel'].replace('_', ' ')}"] += 1
        aprovadas = sorted((i for i in aprovadas if perfis[i["id"]]["nivel"] in cur["publicar"]),
                           key=lambda i: (ordem_nivel[perfis[i["id"]]["nivel"]], -perfis[i["id"]].get("queda", 0)))

    # 3c. Aprendiz (modo sombra por padrão): dá nota; só ajuda a ordenar se já provou que acerta
    base_aprendiz = ler(ARQ_APRENDIZ, {})
    modelo_aprendiz = base_aprendiz.get("modelo") or {"estado": "aguardando dados"}
    notas = {i["id"]: aprendiz.nota(modelo_aprendiz, aprendiz.caracteristicas(i | {"desconto": g.desconto(i["preco"], i["preco_cheio"])}, perfis[i["id"]]))
             for i in aprovadas}
    if aprendiz.pode_ajudar(modelo_aprendiz, cfg_aprendiz):
        aprovadas = sorted(aprovadas, key=lambda i: -(notas[i["id"]] or 0))
    aprovadas = aprovadas[: regras["max_ofertas"]]

    # 4. Freio de emergência
    chamadas = sum(c.chamadas for c in clientes)
    erros = sum(c.erros for c in clientes)
    if chamadas and erros / chamadas > regras["freio_taxa_erro"]:
        freio = freio or f"Muitas falhas na API ({erros} de {chamadas} chamadas)."
    if len(anteriores) >= 20 and len(aprovadas) < len(anteriores) * regras["freio_queda"]:
        freio = freio or f"Queda brusca de ofertas aprovadas ({len(anteriores)} → {len(aprovadas)})."
    if cliente and cliente.novo_refresh_token:
        alertas.append("O Mercado Livre trocou o refresh token: atualize o segredo ML_REFRESH_TOKEN.")

    # 5. Fotos extras e marca para a página do produto (só das aprovadas, em lotes de 20)
    fotos: dict[str, list[str]] = {}
    marcas: dict[str, str] = {}
    if cliente and aprovadas and not freio:
        try:
            for bruto in cliente.itens([i["id"] for i in aprovadas if (i.get("loja") or "Mercado Livre") == "Mercado Livre"]):
                urls = [(f.get("secure_url") or f.get("url") or "").replace("http://", "https://") for f in bruto.get("pictures", [])]
                fotos[bruto["id"]] = [u for u in urls if u][:4]
                marca = next((a.get("value_name") for a in bruto.get("attributes", []) if a.get("id") == "BRAND"), None)
                if marca:
                    marcas[bruto["id"]] = marca
        except ErroML as e:
            alertas.append(f"Não foi possível buscar as fotos extras ({e}).")

    # Subcategoria (nome da categoria exata do Mercado Livre), com cache para não repetir chamadas
    nomes_cat = ler(ARQ_CATS, {})
    if cliente and not freio:
        novas = [c for c in {i.get("categoria_ml") for i in aprovadas} if c and c not in nomes_cat][:80]
        for cid in novas:
            nome = cliente.nome_categoria(cid)
            if nome:
                nomes_cat[cid] = nome
        gravar(ARQ_CATS, nomes_cat)

    # 6. Publicação
    removidas = []
    if freio:
        alertas.insert(0, "FREIO ACIONADO: o site manteve as ofertas anteriores. " + freio)
    else:
        publicadas = []
        for item in aprovadas:
            publicadas.append({
                "id": item["id"], "titulo": item["titulo"], "categoria": item["categoria"],
                "subcategoria": nomes_cat.get(item.get("categoria_ml") or "") or item.get("subcategoria"),
                "preco": item["preco"], "preco_cheio": item["preco_cheio"],
                "desconto": g.desconto(item["preco"], item["preco_cheio"]),
                "parcelas": item["parcelas"], "sem_juros": item["sem_juros"],
                "frete_gratis": item["frete_gratis"], "full": item["full"],
                "foto": g.foto_segura(item["foto"]), "fotos": [f for f in map(g.foto_segura, fotos.get(item["id"], [])) if f],
                "marca": marcas.get(item["id"]) or item.get("marca"),
                "link": item["link"], "loja": item.get("loja") or cfg["loja"],
                "menor_30d": g.menor_preco_periodo(historico.get(item["id"], []), item["preco"]),
                "curadoria": {k: v for k, v in perfis[item["id"]].items() if k in ("nivel", "queda", "mediana", "minimo", "dias", "percentil")}
                | {"motivo": modelo.explicar(perfis[item["id"]], cur["janela_dias"])},
                "verificado_em": carimbo,
                "novo_em": anteriores.get(item["id"], {}).get("novo_em", carimbo),
            })
        ids_novos = {o["id"] for o in publicadas}
        for id_ant, ant in anteriores.items():
            if id_ant not in ids_novos:
                motivo = avaliacao.get(id_ant, ("", "anúncio não encontrado ou encerrado"))[1] or "substituída por oferta melhor"
                removidas.append({"titulo": ant["titulo"], "motivo": motivo})
        gravar(ARQ_ENCERRADAS, atualizar_encerradas({} if estreia else ler(ARQ_ENCERRADAS, {}), anteriores, ids_novos, avaliacao, historico, agora), compacto=True)
        gravar(ARQ_OFERTAS, {"gerado_em": carimbo, "modo": modo, "curadoria": cur["modo"], "ofertas": publicadas}, compacto=True)
        gravar(ARQ_PRECOS, {o["id"]: g.precos_diarios(historico.get(o["id"], [])) for o in publicadas}, compacto=True)
        export = ler_contador(alertas)
        populares = []
        if export is not None:
            relacionados = montar_relacionados(export, ids_novos)
            populares = relacionados["populares"]
            gravar(ARQ_RELACIONADOS, relacionados, compacto=True)
        if real:  # o aprendiz só aprende com ofertas reais
            aprendiz.registrar(base_aprendiz, publicadas, perfis, populares, agora.date().isoformat(), cfg_aprendiz)
            if modelo_aprendiz.get("treinado_em") != agora.date().isoformat():  # no máximo um treino por dia
                novo = aprendiz.treinar(aprendiz.rotulados(base_aprendiz, cfg_aprendiz), agora.date().isoformat(), cfg_aprendiz)
                modelo_aprendiz = novo if novo["estado"] == "treinado" else {**novo, "treinado_em": agora.date().isoformat()}
            base_aprendiz["modelo"] = modelo_aprendiz
            gravar(ARQ_APRENDIZ, base_aprendiz, compacto=True)

    g.podar_historico(historico, agora, janela_hist)
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
        "api": {"chamadas": chamadas, "erros": erros} if clientes else None,
        "lojas": [n for n, ativa in (("Mercado Livre", ml_ativo), ("Shopee", shopee_ativa)) if ativa],
        "produtos_no_historico": len(historico),
        "curadoria": calibragem,
        "aprendiz": {"modo": cfg_aprendiz["modo"], "estado": modelo_aprendiz.get("estado"),
                     "exemplos": len(base_aprendiz.get("exemplos", {})),
                     "rotulados": len(aprendiz.rotulados(base_aprendiz, cfg_aprendiz)), "precisa": cfg_aprendiz["min_exemplos"],
                     "auc": modelo_aprendiz.get("auc"), "auc_minima": cfg_aprendiz["auc_minima"],
                     "ajudando": aprendiz.pode_ajudar(modelo_aprendiz, cfg_aprendiz),
                     "importancia": modelo_aprendiz.get("importancia", []),
                     "notas": sorted(({"titulo": i["titulo"][:80], "nota": notas[i["id"]]} for i in aprovadas if notas.get(i["id"]) is not None),
                                     key=lambda x: -x["nota"])[:10]},
        "execucoes": execucoes,
    })

    print(f"[{modo}] candidatos={len(itens)} publicadas={publicadas_n} quarentena={len(quarentena)} alertas={len(alertas)}")
    for a in alertas:
        print("  alerta:", a)
    return 2 if freio else 0


if __name__ == "__main__":
    sys.exit(main())
