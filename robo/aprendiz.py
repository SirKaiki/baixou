"""Aprendiz: modelo que aprende, com o tempo, quais ofertas o público do Baixou acha que valem a pena.

Funciona em três etapas, todas automáticas:
  1. Guarda exemplos: quando uma oferta é publicada pela primeira vez, guarda as características dela
     (queda real, raridade do preço, desconto anunciado, preço, loja, categoria...).
  2. Rotula com o comportamento real: visitas e idas à loja vindas do contador anônimo. Uma oferta com
     taxa de idas à loja acima da mediana conta como "valeu"; abaixo, como "não valeu".
  3. Treina (regressão logística, no máximo uma vez por dia) e se avalia em exemplos que NÃO viu no treino
     (AUC: 0,5 = chute; 1,0 = perfeito).

Modos (config.json → "aprendiz"):
  "sombra" (padrão): dá nota às ofertas e mostra no painel, mas não muda nada no site.
  "ajudar": se o teste de acerto passar do mínimo, a nota passa a ajudar a ORDENAR as ofertas.
Ele nunca publica nem barra uma oferta: isso continua com o guardião e o modelo estatístico.
Só biblioteca padrão.
"""
from __future__ import annotations

import hashlib
import math
import statistics

PADRAO = {
    "modo": "sombra",
    "min_exemplos": 300,       # exemplos rotulados para começar a treinar
    "min_por_classe": 30,
    "visitas_minimas": 20,     # uma oferta só vira exemplo rotulado depois de tantas visitas
    "auc_minima": 0.65,        # nota mínima no teste para poder "ajudar"
    "max_exemplos": 5000,
}

NUMERICAS = ("queda", "z", "percentil", "desconto_anunciado", "inflacao", "log_preco", "dias", "frete", "shopee", "rep_forte")


def config(cfg: dict | None) -> dict:
    return {**PADRAO, **(cfg or {})}


def caracteristicas(oferta: dict, perfil: dict) -> dict:
    """O que o aprendiz "vê" de uma oferta. Tudo número (categorias viram 0/1 depois)."""
    anunciado = float(oferta.get("desconto") or 0)
    queda = float(perfil.get("queda") or 0)
    return {
        "queda": queda,
        "z": max(-10.0, min(10.0, float(perfil.get("z") or 0))),
        "percentil": float(perfil.get("percentil", 0.5)),
        "desconto_anunciado": anunciado,
        "inflacao": anunciado - queda,  # desconto anunciado maior que a queda real = "de" inflado
        "log_preco": math.log10(max(1.0, float(oferta.get("preco") or 1))),
        "dias": min(90.0, float(perfil.get("dias") or 0)),
        "frete": 1.0 if oferta.get("frete_gratis") else 0.0,
        "shopee": 1.0 if oferta.get("loja") == "Shopee" else 0.0,
        "rep_forte": 1.0 if oferta.get("reputacao") in ("5_green", "platinum", "gold", "shopee_oficial") else 0.0,
        "categoria": str(oferta.get("categoria") or ""),
    }


# ---------- base de exemplos ----------

def registrar(base: dict, publicadas: list[dict], perfis: dict, populares: list[dict], hoje: str, cfg: dict | None = None) -> None:
    """Guarda as ofertas novas como exemplos e atualiza visitas/idas à loja com o contador."""
    c = config(cfg)
    exemplos = base.setdefault("exemplos", {})
    for o in publicadas:
        if o["id"] not in exemplos and o["id"] in perfis:
            exemplos[o["id"]] = {"x": caracteristicas(o, perfis[o["id"]]), "desde": hoje, "v": 0, "c": 0}
    for pop in populares:  # o contador entrega visitas e cliques das últimas 24 h; guardamos o maior visto
        ex = exemplos.get(str(pop.get("id")))
        if ex:
            ex["v"] = max(ex["v"], int(pop.get("v") or 0))
            ex["c"] = max(ex["c"], int(pop.get("c") or 0))
    if len(exemplos) > c["max_exemplos"]:
        for velho in sorted(exemplos, key=lambda i: exemplos[i]["desde"])[: len(exemplos) - c["max_exemplos"]]:
            del exemplos[velho]


def rotulados(base: dict, cfg: dict | None = None) -> list[tuple[dict, int]]:
    c = config(cfg)
    com_visitas = [e for e in base.get("exemplos", {}).values() if e["v"] >= c["visitas_minimas"]]
    if not com_visitas:
        return []
    corte = statistics.median(e["c"] / e["v"] for e in com_visitas)
    return [(e["x"], 1 if e["c"] / e["v"] > corte else 0) for e in com_visitas]


# ---------- regressão logística (sem bibliotecas) ----------

def _vetor(x: dict, categorias: list[str]) -> list[float]:
    return [float(x[k]) for k in NUMERICAS] + [1.0 if x.get("categoria") == cat else 0.0 for cat in categorias]


def _sig(t: float) -> float:
    return 1 / (1 + math.exp(-max(-30.0, min(30.0, t))))


def _treinar(xs: list[list[float]], ys: list[int], passos: int = 400, taxa: float = 0.3, l2: float = 0.01) -> list[float]:
    w = [0.0] * (len(xs[0]) + 1)
    n = len(xs)
    for _ in range(passos):
        g = [0.0] * len(w)
        for x, y in zip(xs, ys):
            erro = _sig(w[0] + sum(a * b for a, b in zip(w[1:], x))) - y
            g[0] += erro
            for j, v in enumerate(x):
                g[j + 1] += erro * v
        w[0] -= taxa * g[0] / n
        for j in range(1, len(w)):
            w[j] -= taxa * (g[j] / n + l2 * w[j])
    return w


def auc(notas: list[float], ys: list[int]) -> float | None:
    pos = [s for s, y in zip(notas, ys) if y == 1]
    neg = [s for s, y in zip(notas, ys) if y == 0]
    if not pos or not neg:
        return None
    ganhos = sum(1.0 if p > n else 0.5 if p == n else 0.0 for p in pos for n in neg)
    return ganhos / (len(pos) * len(neg))


def _no_teste(x: dict) -> bool:
    """Separa 20% dos exemplos para o teste, sempre os mesmos (não depende da sorte)."""
    return int(hashlib.sha256(repr(sorted(x.items())).encode()).hexdigest(), 16) % 5 == 0


def treinar(dados: list[tuple[dict, int]], hoje: str, cfg: dict | None = None) -> dict:
    """Treina e avalia. Devolve o modelo (ou o motivo de ainda não treinar)."""
    c = config(cfg)
    pos = sum(y for _, y in dados)
    if len(dados) < c["min_exemplos"] or min(pos, len(dados) - pos) < c["min_por_classe"]:
        return {"estado": "aguardando dados", "exemplos": len(dados), "precisa": c["min_exemplos"]}
    categorias = sorted({x.get("categoria", "") for x, _ in dados})
    vetores = [(_vetor(x, categorias), y, _no_teste(x)) for x, y in dados]
    treino = [(v, y) for v, y, t in vetores if not t]
    teste = [(v, y) for v, y, t in vetores if t]
    k = len(treino[0][0])
    medias = [statistics.fmean(v[j] for v, _ in treino) for j in range(k)]
    desvios = [statistics.pstdev([v[j] for v, _ in treino]) or 1.0 for j in range(k)]
    norm = lambda v: [(a - m) / d for a, m, d in zip(v, medias, desvios)]  # noqa: E731
    w = _treinar([norm(v) for v, _ in treino], [y for _, y in treino])
    notas = [_sig(w[0] + sum(a * b for a, b in zip(w[1:], norm(v)))) for v, _ in teste]
    nota_teste = auc(notas, [y for _, y in teste])
    nomes = list(NUMERICAS) + [f"cat:{c_}" for c_ in categorias]
    return {"estado": "treinado", "treinado_em": hoje, "exemplos": len(dados), "teste": len(teste),
            "auc": round(nota_teste, 3) if nota_teste is not None else None, "categorias": categorias,
            "medias": medias, "desvios": desvios, "pesos": w,
            "importancia": sorted(((n, round(p, 3)) for n, p in zip(nomes, w[1:])), key=lambda t: -abs(t[1]))[:8]}


def nota(modelo: dict, x: dict) -> float | None:
    """Probabilidade (0 a 1) de a oferta "valer a pena" para o público, segundo o aprendiz."""
    if modelo.get("estado") != "treinado":
        return None
    v = _vetor(x, modelo["categorias"])
    z = [(a - m) / d for a, m, d in zip(v, modelo["medias"], modelo["desvios"])]
    return round(_sig(modelo["pesos"][0] + sum(a * b for a, b in zip(modelo["pesos"][1:], z))), 3)


def pode_ajudar(modelo: dict, cfg: dict | None = None) -> bool:
    c = config(cfg)
    return c["modo"] == "ajudar" and modelo.get("estado") == "treinado" and (modelo.get("auc") or 0) >= c["auc_minima"]
