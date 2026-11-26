"""Modelo estatístico de preço: diz o quanto o preço de agora é raro PARA AQUELE PRODUTO.

Não usa o "de R$ X" do anúncio (que o vendedor pode inflar). Usa só o histórico real:
  - preço típico: mediana dos preços diários (um por dia, o menor do dia), sem contar hoje;
  - variação típica: MAD (desvio absoluto mediano), robusto a picos isolados;
  - queda: quanto o preço de agora está abaixo do típico, em %;
  - z robusto: a queda medida em "variações típicas" (1 produto estável cai pouco e já é raro;
    um produto que vive oscilando precisa cair muito);
  - percentil: em que fração dos dias o preço esteve igual ou abaixo do de agora (0 = nunca esteve tão barato).
Tudo explicável e determinístico. Só biblioteca padrão.
"""
from __future__ import annotations

import statistics
from datetime import datetime, timedelta

PADRAO = {
    "modo": "observar",            # "observar": só mede e mostra no painel | "aplicar": só publica os níveis escolhidos
    "janela_dias": 90,
    "dias_minimos": 7,             # antes disso o produto fica "sem histórico"
    "escala_minima": 0.015,        # variação típica nunca menor que 1,5% do preço (evita z gigante em preço "parado")
    "niveis": {
        "excepcional": {"queda_min": 15, "z_min": 3.0, "percentil_max": 0.02},
        "boa": {"queda_min": 8, "z_min": 2.0, "percentil_max": 0.10},
    },
    "publicar": ["excepcional", "boa"],
}

NIVEIS = ("excepcional", "boa", "comum", "sem_historico")


def config(cfg: dict | None) -> dict:
    c = {**PADRAO, **(cfg or {})}
    c["niveis"] = {**PADRAO["niveis"], **((cfg or {}).get("niveis") or {})}
    return c


def diarios(pontos: list, agora: datetime, janela_dias: int) -> list[tuple[str, float]]:
    """Um preço por dia (o menor do dia), dentro da janela, SEM o dia de hoje."""
    hoje = agora.date().isoformat()
    inicio = (agora - timedelta(days=janela_dias)).date().isoformat()
    por_dia: dict[str, float] = {}
    for quando, preco in pontos:
        dia = quando[:10]
        if inicio <= dia < hoje and isinstance(preco, (int, float)) and preco > 0:
            por_dia[dia] = min(preco, por_dia.get(dia, preco))
    return sorted(por_dia.items())


def perfil(pontos: list, preco: float, agora: datetime, cfg: dict | None = None) -> dict:
    """Mede o preço de agora contra o histórico do produto e devolve o nível e os números que o justificam."""
    c = config(cfg)
    dias = diarios(pontos, agora, c["janela_dias"])
    if len(dias) < c["dias_minimos"] or not preco or preco <= 0:
        return {"nivel": "sem_historico", "dias": len(dias)}
    precos = [p for _, p in dias]
    mediana = statistics.median(precos)
    mad = statistics.median(abs(p - mediana) for p in precos)
    escala = max(1.4826 * mad, mediana * c["escala_minima"])
    z = (mediana - preco) / escala
    queda = (mediana - preco) / mediana * 100
    abaixo = sum(1 for p in precos if p < preco) + 0.5 * sum(1 for p in precos if p == preco)
    percentil = abaixo / len(precos)
    minimo = min(precos)
    nivel = "comum"
    for nome in ("excepcional", "boa"):
        r = c["niveis"][nome]
        if queda >= r["queda_min"] and z >= r["z_min"] and percentil <= r["percentil_max"]:
            nivel = nome
            break
    return {
        "nivel": nivel,
        "dias": len(dias),
        "mediana": round(mediana, 2),
        "minimo": round(minimo, 2),
        "queda": round(queda, 1),
        "z": round(max(-99.0, min(99.0, z)), 2),
        "percentil": round(percentil, 3),
        "menor_da_janela": preco < minimo,
    }


def brl(v: float) -> str:
    return "R$ " + f"{v:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")


def explicar(p: dict, janela_dias: int = 90) -> str:
    """Frase curta para o site e o Telegram: por que esta oferta está aqui."""
    if p.get("nivel") == "sem_historico":
        return "Ainda estamos aprendendo o preço normal deste produto."
    partes = []
    if p["queda"] > 0:
        partes.append(f"{p['queda']:.0f}% abaixo do preço típico ({brl(p['mediana'])})")
    else:
        partes.append(f"No preço típico ({brl(p['mediana'])})")
    if p.get("menor_da_janela"):
        partes.append(f"o menor preço em {p['dias']} dias acompanhados")
    elif p["percentil"] <= 0.10:
        partes.append(f"mais barato que em {100 - p['percentil'] * 100:.0f}% dos dias acompanhados")
    return " · ".join(partes)


def calibragem(perfis: list[tuple[dict, dict]], cfg: dict | None = None) -> dict:
    """Relatório para o painel: quantas ofertas passariam em cada régua, com exemplos reais."""
    c = config(cfg)
    com_hist = [(item, p) for item, p in perfis if p["nivel"] != "sem_historico"]
    contagem = {n: 0 for n in NIVEIS}
    for _, p in perfis:
        contagem[p["nivel"]] += 1
    reguas = []
    for queda_min in (5, 10, 15, 20, 25, 30):
        reguas.append({"queda_min": queda_min,
                       "ofertas": sum(1 for _, p in com_hist if p["queda"] >= queda_min and p["percentil"] <= 0.10)})
    exemplos = {}
    for nivel in ("excepcional", "boa", "comum"):
        doms = sorted((x for x in com_hist if x[1]["nivel"] == nivel), key=lambda x: -x[1]["queda"])[:5]
        exemplos[nivel] = [{"id": i["id"], "titulo": i.get("titulo", "")[:90], "preco": i["preco"], "mediana": p["mediana"],
                            "queda": p["queda"], "percentil": p["percentil"], "dias": p["dias"]} for i, p in doms]
    return {"modo": c["modo"], "publicar": c["publicar"], "contagem": contagem, "reguas": reguas, "exemplos": exemplos}
