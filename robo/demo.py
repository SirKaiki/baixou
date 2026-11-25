"""Modo demonstração: gera anúncios simulados para o site funcionar antes das chaves do Mercado Livre.

Inclui de propósito alguns anúncios ruins, para o guardião mostrar no painel o que ele barra.
"""
from __future__ import annotations

import random
import re
import unicodedata
from datetime import datetime

# (título, categoria, preço cheio, desconto %, frete grátis, full, parcelas)
CATALOGO = [
    ("Smartphone Samsung Galaxy A35 5G 128GB", "Celulares", 2299, 30, True, True, 10),
    ("Smartphone Motorola Moto G85 5G 256GB", "Celulares", 1999, 32, True, False, 10),
    ("Smartwatch Amazfit Bip 6", "Celulares", 699, 36, True, True, 6),
    ("Notebook Lenovo IdeaPad Slim 3 Ryzen 5 8GB 512GB", "Informática", 3799, 24, True, True, 10),
    ("Monitor LG 24 IPS Full HD 100Hz", "Informática", 899, 28, True, True, 10),
    ("SSD Kingston NV2 1TB NVMe", "Informática", 549, 29, True, True, 6),
    ("Fone de ouvido JBL Tune 520BT", "Eletrônicos", 399, 43, True, True, 5),
    ("Caixa de som JBL Go 4", "Eletrônicos", 349, 29, True, True, 4),
    ("Smart TV TCL 50 4K Google TV", "Eletrônicos", 2799, 29, True, True, 10),
    ("Air Fryer Mondial 4L 1500W", "Eletrodomésticos", 449, 38, True, True, 6),
    ("Cafeteira Nespresso Essenza Mini", "Eletrodomésticos", 599, 33, True, False, 6),
    ("Jogo de panelas Tramontina 5 peças antiaderente", "Casa e decoração", 499, 40, True, True, 5),
    ("Jogo de cama casal 4 peças 400 fios", "Casa e decoração", 259, 35, False, False, 3),
    ("Perfume Natura Kaiak Masculino 100ml", "Beleza", 199, 35, False, False, 3),
    ("Secador de cabelo Taiff Black 2000W", "Beleza", 299, 40, True, True, 4),
    ("Kit protetor solar La Roche-Posay Anthelios FPS 70", "Beleza", 189, 27, True, True, 3),
    ("Tênis Olympikus Corre 4 masculino", "Moda e calçados", 499, 40, True, True, 5),
    ("Mochila Adidas Classic 3 listras", "Moda e calçados", 229, 30, False, False, 3),
    ("Kit halteres ajustáveis 2 a 10kg", "Esportes e fitness", 359, 39, False, False, 4),
    ("Bicicleta ergométrica Dream Fitness", "Esportes e fitness", 1499, 26, True, False, 10),
    ("Controle sem fio Xbox Series Carbon Black", "Games", 499, 24, True, True, 6),
    ("Console PlayStation 5 Slim Digital", "Games", 3999, 20, True, True, 12),
    ("Furadeira de impacto Bosch GSB 550 RE", "Ferramentas", 399, 33, True, True, 5),
    ("Jogo de chaves combinadas Tramontina 8 peças", "Ferramentas", 189, 31, True, True, 3),
    ("Lego Classic caixa criativa 790 peças", "Brinquedos", 449, 30, True, True, 6),
    ("Carrinho de bebê Burigotto Travel System", "Bebês", 1299, 27, True, False, 10),
]

# Anúncios ruins de propósito: (título, categoria, cheio, desconto, problema)
ARMADILHAS = [
    ("Fone bluetooth sem fio similar AirPods", "Eletrônicos", 299, 60, "titulo"),
    ("iPhone 13 128GB usado bom estado", "Celulares", 3200, 25, "usado"),
    ("Tênis esportivo corrida masculino", "Moda e calçados", 899, 88, "erro"),
    ("Liquidificador 3 velocidades 900W", "Eletrodomésticos", 199, 35, "reputacao"),
    ("Panela de pressão 4,5L alumínio", "Casa e decoração", 159, 8, "pouco"),
]


def _slug(texto: str) -> str:
    t = "".join(c for c in unicodedata.normalize("NFD", texto.lower()) if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def gerar(agora: datetime) -> list[dict]:
    rnd = random.Random(agora.strftime("%Y%m%d%H"))
    itens = []
    for n, (titulo, cat, cheio, pct, frete, full, parc) in enumerate(CATALOGO):
        variacao = rnd.choice([0, 0, 0, -2, 2, -4])
        preco = round(cheio * (1 - (pct + variacao) / 100), 2)
        itens.append(_item(n, titulo, cat, cheio, preco, frete, full, parc, "5_green", "new", rnd))
    for m, (titulo, cat, cheio, pct, problema) in enumerate(ARMADILHAS):
        preco = round(cheio * (1 - pct / 100), 2)
        condicao = "used" if problema == "usado" else "new"
        rep = "1_red" if problema == "reputacao" else "4_light_green"
        itens.append(_item(900 + m, titulo, cat, cheio, preco, True, False, 3, rep, condicao, rnd))
    return itens


MARCAS = ["Samsung", "Motorola", "Amazfit", "Lenovo", "LG", "Kingston", "JBL", "TCL", "Mondial", "Nespresso",
          "Tramontina", "Natura", "Taiff", "La Roche-Posay", "Olympikus", "Adidas", "Dream Fitness", "Xbox",
          "PlayStation", "Bosch", "Lego", "Burigotto"]


SUBS = [("smartphone", "Smartphones"), ("iphone", "Smartphones"), ("smartwatch", "Smartwatches"), ("notebook", "Notebooks"),
        ("monitor", "Monitores"), ("ssd", "Armazenamento"), ("fone", "Fones de ouvido"), ("caixa de som", "Caixas de som"),
        ("tv", "Smart TVs"), ("air fryer", "Fritadeiras"), ("liquidificador", "Liquidificadores"), ("cafeteira", "Cafeteiras"),
        ("panela", "Panelas"), ("cama", "Roupa de cama"), ("perfume", "Perfumes"), ("secador", "Secadores"),
        ("protetor", "Protetor solar"), ("tênis", "Tênis"), ("mochila", "Mochilas"), ("halteres", "Musculação"),
        ("bicicleta", "Ergométricas"), ("controle", "Controles"), ("console", "Consoles"), ("furadeira", "Furadeiras"),
        ("chaves", "Ferramentas manuais"), ("lego", "Blocos de montar"), ("carrinho", "Carrinhos de bebê")]


def _item(n, titulo, cat, cheio, preco, frete, full, parc, rep, condicao, rnd) -> dict:
    return {
        "subcategoria": next((s for k, s in SUBS if k in titulo.lower()), None),
        "marca": next((m for m in MARCAS if m.lower() in titulo.lower()), None),
        "id": f"DEMO{n:04d}",
        "titulo": titulo,
        "categoria": cat,
        "preco": preco,
        "preco_cheio": float(cheio),
        "condicao": condicao,
        "estoque": rnd.randint(3, 80),
        "status": "active",
        "vendedor_id": f"V{n}",
        "reputacao": rep,
        "frete_gratis": frete,
        "full": full,
        "parcelas": parc,
        "sem_juros": True,
        "foto": "",
        # No modo demonstração o botão abre a busca do produto (não há link de afiliado).
        "permalink": "https://lista.mercadolivre.com.br/" + _slug(titulo),
        "catalogo": None,
    }
