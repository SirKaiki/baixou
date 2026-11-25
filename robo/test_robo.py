"""Testes do guardião e do robô (rode com: python -m unittest discover robo)."""
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent))
import guardiao as g  # noqa: E402
import robo  # noqa: E402

REGRAS = json.loads((Path(__file__).parent.parent / "config.json").read_text())["guardiao"]
AGORA = datetime(2026, 11, 24, 12, 0, tzinfo=timezone.utc)
LINK_OK = "https://produto.mercadolivre.com.br/MLB-123-fone?matt_word=cesar&matt_tool=999"


def item(**mudancas):
    base = {"id": "MLB1", "titulo": "Fone JBL Tune 520BT", "categoria": "Eletrônicos", "preco": 229.0,
            "preco_cheio": 399.0, "condicao": "new", "estoque": 10, "status": "active",
            "reputacao": "5_green", "link": LINK_OK}
    return base | mudancas


def avaliar(it, hist=None, comissao=5):
    return g.avaliar(it, REGRAS, comissao, hist or [], exige_afiliado=True)


class TestGuardiao(unittest.TestCase):
    def test_oferta_boa_passa(self):
        self.assertEqual(avaliar(item()), ("aprovada", ""))

    def test_regras_basicas(self):
        self.assertEqual(avaliar(item(condicao="used"))[0], "reprovada")
        self.assertEqual(avaliar(item(estoque=0))[1], "sem estoque")
        self.assertEqual(avaliar(item(status="paused"))[1], "anúncio inativo")
        self.assertEqual(avaliar(item(reputacao="2_orange"))[1], "vendedor com reputação baixa")
        self.assertEqual(avaliar(item(preco=390.0))[1], "desconto menor que 15%")
        self.assertEqual(avaliar(item(), comissao=0)[1], "categoria sem comissão")
        self.assertIn("palavra bloqueada", avaliar(item(titulo="Fone Réplica Premium"))[1])

    def test_desconto_absurdo_vai_para_quarentena(self):
        self.assertEqual(avaliar(item(preco=40.0))[0], "quarentena")

    def test_links(self):
        self.assertEqual(avaliar(item(link="https://produto.mercadolivre.com.br/MLB-1"))[1], "link sem código de afiliado")
        self.assertEqual(avaliar(item(link="https://lista.mercadolivre.com.br/fone?matt_word=a&matt_tool=b"))[0], "quarentena")
        self.assertEqual(avaliar(item(link="https://golpe.com/MLB-1?matt_word=a&matt_tool=b"))[1], "link fora do Mercado Livre")

    def test_link_afiliado_preserva_e_substitui(self):
        url = g.link_afiliado("https://produto.mercadolivre.com.br/MLB-1-x?matt_word=velho&foo=1", "cesar", "999")
        self.assertIn("foo=1", url)
        self.assertIn("matt_word=cesar", url)
        self.assertNotIn("velho", url)
        self.assertIsNone(g.checar_link(url, True))

    def test_preco_cheio_inflado(self):
        hist = {"MLB1": []}
        for d in range(5):
            g.registrar_preco(hist, "MLB1", 300.0 + d, AGORA - timedelta(days=5 - d), 30)
        # sempre custou ~300, agora "de 599 por 229": cheio inflado
        self.assertEqual(avaliar(item(preco_cheio=599.0), hist["MLB1"])[1], "preço cheio inflado (acima do maior preço visto no período)")

    def test_preco_de_sempre_nao_e_promocao(self):
        hist = {"MLB1": []}
        for d in range(10):
            g.registrar_preco(hist, "MLB1", 229.0, AGORA - timedelta(days=10 - d), 30)
        self.assertEqual(avaliar(item(preco_cheio=260.0), hist["MLB1"])[0], "reprovada")

    def test_menor_preco_do_periodo(self):
        hist = {"X": []}
        for d, preco in enumerate([300.0, 280.0, 310.0, 250.0]):
            g.registrar_preco(hist, "X", preco, AGORA - timedelta(days=4 - d), 30)
        self.assertTrue(g.menor_preco_periodo(hist["X"], 250.0))
        self.assertFalse(g.menor_preco_periodo(hist["X"], 260.0))
        self.assertFalse(g.menor_preco_periodo(hist["X"][:2], 200.0))

    def test_precos_diarios(self):
        pts = [["2026-11-20T10:00+00:00", 300.0], ["2026-11-20T18:00+00:00", 280.0], ["2026-11-21T09:00+00:00", 290.0]]
        self.assertEqual(g.precos_diarios(pts), [["2026-11-20", 280.0], ["2026-11-21", 290.0]])

    def test_historico_descarta_pontos_antigos(self):
        hist = {"X": [["2026-01-01T00:00+00:00", 10.0]]}
        g.registrar_preco(hist, "X", 12.0, AGORA, 30)
        self.assertEqual(len(hist["X"]), 1)


class TestRelacionados(unittest.TestCase):
    def test_monta_so_com_ofertas_no_ar(self):
        export = {"visitas_24h": 9, "pares": [{"a": "A", "b": "B", "peso": 5}, {"a": "A", "b": "X", "peso": 9}, {"a": "A", "b": "C", "peso": 2}],
                  "populares": [{"produto": "X", "v": 9, "c": 9}, {"produto": "B", "v": 3, "c": 1}]}
        r = robo.montar_relacionados(export, {"A", "B", "C"})
        self.assertEqual(r["quem_viu"]["A"], ["B", "C"])
        self.assertEqual(r["populares"], [{"id": "B", "v": 3, "c": 1}])
        self.assertEqual(r["visitas_24h"], 9)


class FakeCliente:
    """Imita a API do Mercado Livre."""
    falhar_tudo = False

    def __init__(self, *a, **k):
        self.chamadas, self.erros, self.novo_refresh_token = 1, 0, None

    def autenticar(self):
        if FakeCliente.falhar_tudo:
            raise robo.ErroML("HTTP 401 em /oauth/token")

    def buscar_categoria(self, cat, paginas):
        if cat != "MLB1000":
            return []
        return [{"id": f"MLB{n}", "title": f"Caixa de som modelo {n}", "price": 100.0, "original_price": 150.0,
                 "condition": "new", "available_quantity": 5, "status": "active",
                 "seller": {"id": 7}, "shipping": {"free_shipping": True, "logistic_type": "fulfillment"},
                 "installments": {"quantity": 6, "rate": 0}, "thumbnail": "http://http2.mlstatic.com/D_1-I.jpg",
                 "permalink": f"https://produto.mercadolivre.com.br/MLB-{n}-caixa"} for n in range(30)]

    def itens(self, ids):
        return [{"id": i, "attributes": [{"id": "BRAND", "value_name": "JBL"}],
                 "pictures": [{"secure_url": f"https://http2.mlstatic.com/D_{i}_{k}-O.jpg"} for k in range(6)]} for i in ids]

    def reputacao(self, vid):
        return "5_green"


class TestRoboReal(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        raiz = Path(self.tmp.name)
        self.patches = [
            mock.patch.object(robo, "ARQ_HIST", raiz / "historico.json"),
            mock.patch.object(robo, "ARQ_OFERTAS", raiz / "ofertas.json"),
            mock.patch.object(robo, "ARQ_STATUS", raiz / "status.json"),
            mock.patch.object(robo, "ARQ_PRECOS", raiz / "precos.json"),
            mock.patch.object(robo, "ClienteML", FakeCliente),
            mock.patch.dict(os.environ, {"ML_CLIENT_ID": "x", "ML_CLIENT_SECRET": "y",
                                         "ML_MATT_WORD": "cesar", "ML_MATT_TOOL": "999"}),
        ]
        for p in self.patches:
            p.start()
        FakeCliente.falhar_tudo = False
        self.raiz = raiz

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def ler(self, nome):
        return json.loads((self.raiz / nome).read_text())

    def test_publica_com_link_de_afiliado_e_foto_https(self):
        self.assertEqual(robo.main(), 0)
        ofertas = self.ler("ofertas.json")["ofertas"]
        self.assertEqual(len(ofertas), 30)
        self.assertTrue(all("matt_word=cesar" in o["link"] and o["foto"].startswith("https://") for o in ofertas))
        self.assertTrue(ofertas[0]["full"] and ofertas[0]["frete_gratis"])
        self.assertEqual(len(ofertas[0]["fotos"]), 4)
        self.assertEqual(ofertas[0]["marca"], "JBL")
        precos = self.ler("precos.json")
        self.assertEqual(set(precos), {o["id"] for o in ofertas})

    def test_sem_codigo_de_afiliado_nada_e_publicado(self):
        with mock.patch.dict(os.environ, {"ML_MATT_WORD": ""}):
            robo.main()
        self.assertEqual(self.ler("ofertas.json")["ofertas"], [])
        self.assertTrue(any("afiliado" in a for a in self.ler("status.json")["alertas"]))

    def test_freio_mantem_ofertas_anteriores(self):
        robo.main()
        antes = self.ler("ofertas.json")
        FakeCliente.falhar_tudo = True
        self.assertEqual(robo.main(), 2)
        self.assertEqual(self.ler("ofertas.json"), antes)
        status = self.ler("status.json")
        self.assertTrue(status["freio"])
        self.assertTrue(status["alertas"][0].startswith("FREIO ACIONADO"))


if __name__ == "__main__":
    unittest.main()
