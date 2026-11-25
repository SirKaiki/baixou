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

    def test_links_disfarcados_sao_barrados(self):
        ok = "matt_word=a&matt_tool=b"
        for ruim in (f"https://mercadolivre.com.br@golpe.com/MLB-1?{ok}",
                     f"https://produto.mercadolivre.com.br:8443/MLB-1?{ok}",
                     f"https://golpe.com/https://produto.mercadolivre.com.br/MLB-1?{ok}",
                     f"https://produto.mercadolivre.com.br.golpe.com/MLB-1?{ok}",
                     f"https://golpe.com\\@produto.mercadolivre.com.br/MLB-1?{ok}",
                     f"http://produto.mercadolivre.com.br/MLB-1?{ok}",
                     f"https://produto.mercadolivre.com.br:abc/MLB-1?{ok}"):
            self.assertEqual(avaliar(item(link=ruim))[1], "link fora do Mercado Livre", ruim)
        self.assertEqual(avaliar(item(link=f"https://produto.mercadolivre.com.br/MLB-1?{ok}"))[0], "aprovada")

    def test_id_que_vira_nome_de_arquivo_precisa_ser_simples(self):
        for ruim in ("../../x", "a/b", "MLB 1", "", "a" * 41, None, 123):
            self.assertEqual(avaliar(item(id=ruim))[1], "código do anúncio inválido", repr(ruim))
        self.assertTrue(g.id_seguro("MLB123456") and g.id_seguro("DEMO0001"))

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


class TestSegurancaDoSite(unittest.TestCase):
    """A política de segurança (CSP) só libera os scripts inline conhecidos; se alguém mexer num deles sem atualizar o hash, o site quebra."""

    def test_csp_bate_com_os_scripts_inline(self):
        import base64
        import hashlib
        import re
        site = Path(__file__).resolve().parent.parent / "site"
        for nome in ("index", "painel", "privacidade"):
            html = (site / f"{nome}.html").read_text(encoding="utf-8")
            csp = re.search(r'http-equiv="Content-Security-Policy" content="([^"]+)"', html)
            self.assertIsNotNone(csp, nome)
            self.assertNotIn("unsafe-eval", csp.group(1))
            self.assertIn("object-src 'none'", csp.group(1))
            script_src = re.search(r"script-src ([^;]+)", csp.group(1)).group(1)
            self.assertNotIn("unsafe-inline", script_src)
            for corpo in re.findall(r"<script>(.*?)</script>", html, re.S):
                h = "'sha256-" + base64.b64encode(hashlib.sha256(corpo.encode()).digest()).decode() + "'"
                self.assertIn(h, script_src, f"{nome}: script inline sem hash na CSP")
            self.assertNotRegex(html, r"\son(error|click|load)=", nome)

    def test_app_sem_handlers_inline(self):
        js = (Path(__file__).resolve().parent.parent / "site" / "app.js").read_text(encoding="utf-8")
        self.assertNotRegex(js, r"\son(error|click|load|mouseover)=")


class TestSemSegredosNoCodigo(unittest.TestCase):
    """O erro clássico de código feito por IA: colar a chave no código para "fazer funcionar". Aqui isso reprova o robô."""

    PADROES = [r"AKIA[0-9A-Z]{16}", r"gh[pousr]_[A-Za-z0-9]{30,}", r"github_pat_[A-Za-z0-9_]{30,}",
               r"\b[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}", r"APP_USR-[0-9]{6,}-[0-9]{6}-[0-9a-f]{20,}",
               r"TG-[0-9a-f]{20,}", r"-----BEGIN [A-Z ]*PRIVATE KEY-----", r"xox[abps]-[A-Za-z0-9-]{20,}",
               r"(?i)(client_secret|api[_-]?key|bot_token|password)\s*[:=]\s*[\"'][A-Za-z0-9_\-]{16,}[\"']"]

    def test_nenhuma_chave_nos_arquivos(self):
        import re
        import subprocess
        raiz = Path(__file__).resolve().parent.parent
        try:
            arquivos = subprocess.run(["git", "ls-files"], cwd=raiz, capture_output=True, text=True, check=True).stdout.split()
        except (OSError, subprocess.CalledProcessError):
            self.skipTest("fora de um repositório git")
        achados = []
        for nome in arquivos:
            if nome.endswith((".png", ".webp", ".jpg", ".ico")) or nome == "robo/test_robo.py":
                continue
            try:
                texto = (raiz / nome).read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            achados += [f"{nome}: {p}" for p in self.PADROES if re.search(p, texto)]
        self.assertEqual(achados, [], "parece haver uma chave no código; ela deve ficar só nos Secrets do GitHub")

    def test_detector_funciona(self):
        import re
        exemplo = 'BOT_TOKEN = "' + "1234567890:AA" + "x" * 33 + '"'
        self.assertTrue(any(re.search(p, exemplo) for p in self.PADROES))


class TestFotos(unittest.TestCase):
    def test_so_fotos_do_mercado_livre(self):
        boa = "https://http2.mlstatic.com/D_NQ_NP_123-O.webp"
        self.assertEqual(g.foto_segura(boa), boa)
        for ruim in ("http://http2.mlstatic.com/a.jpg", "https://rastreador.com/pixel.png", "https://mlstatic.com.golpe.com/a.jpg",
                     "https://mlstatic.com@golpe.com/a.jpg", 'https://http2.mlstatic.com/a.jpg" onerror="x', "javascript:alert(1)", None, 5):
            self.assertEqual(g.foto_segura(ruim), "", repr(ruim))

    def test_pagina_de_compartilhamento_tem_csp_que_bate(self):
        import base64
        import hashlib
        import re
        import paginas
        o = {"id": "MLB123", "titulo": "Fone <b>x</b>", "preco": 99.9, "preco_cheio": 150, "desconto": 33, "foto": "https://rastreador.com/p.png"}
        h = paginas.pagina(o, "https://sirkaiki.github.io/baixou")
        self.assertNotIn("rastreador.com", h)
        self.assertNotIn("<b>x</b>", h)
        corpo = re.search(r"<script>(.*?)</script>", h, re.S).group(1)
        hash_ = "'sha256-" + base64.b64encode(hashlib.sha256(corpo.encode()).digest()).decode() + "'"
        self.assertIn(f"script-src {hash_};", h)


class TestEncerradas(unittest.TestCase):
    def test_guarda_as_que_sairam_e_esquece_depois_de_uma_semana(self):
        ant = {"A": {"id": "A", "titulo": "Fone", "categoria": "Eletrônicos", "preco": 99.9, "preco_cheio": 150.0, "desconto": 33, "foto": "https://x/a.jpg"},
               "B": {"id": "B", "titulo": "Mouse", "categoria": "Informática", "preco": 50.0}}
        velha = {"id": "C", "titulo": "Velha", "encerrada_em": (AGORA - timedelta(days=8)).isoformat(timespec="minutes")}
        voltou = {"id": "B", "titulo": "Mouse", "encerrada_em": (AGORA - timedelta(days=1)).isoformat(timespec="minutes")}
        r = robo.atualizar_encerradas({"ofertas": [velha, voltou]}, ant, {"B"}, {"A": ("reprovada", "sem estoque")}, {}, AGORA)
        ids = [o["id"] for o in r["ofertas"]]
        self.assertEqual(ids, ["A"])  # A saiu agora; B voltou ao ar; C passou de 7 dias
        self.assertEqual(r["ofertas"][0]["motivo"], "sem estoque")
        self.assertEqual(r["ofertas"][0]["preco"], 99.9)


class TestTelegram(unittest.TestCase):
    def setUp(self):
        import telegram
        self.t = telegram
        self.ofertas = [{"id": f"MLB{i}", "titulo": f"Produto {i}", "preco": 100.0, "preco_cheio": 150.0, "desconto": 10 + i} for i in range(8)]

    def test_primeira_vez_publica_so_as_3_melhores(self):
        esc, est = self.t.escolher(self.ofertas, {}, AGORA)
        self.assertEqual([o["id"] for o in esc], ["MLB7", "MLB6", "MLB5"])
        self.assertEqual(len(est["publicados"]), 5)  # as outras contam como vistas

    def test_nao_repete_e_respeita_limite(self):
        visto = AGORA.isoformat(timespec="minutes")
        est = {"publicados": {"MLB7": visto, "MLB6": visto}}
        esc, _ = self.t.escolher(self.ofertas, est, AGORA)
        self.assertEqual([o["id"] for o in esc], ["MLB5", "MLB4", "MLB3", "MLB2"])

    def test_texto_identifica_afiliado_e_escapa_html(self):
        msg = self.t.texto({"id": "MLB1", "titulo": "Fone <JBL>", "preco": 99.9, "preco_cheio": 150.0, "desconto": 33}, "https://x.github.io/baixou")
        self.assertIn("Fone &lt;JBL&gt;", msg)
        self.assertIn("Link de afiliado", msg)
        self.assertIn("https://x.github.io/baixou/o/MLB1.html", msg)

    def test_links_dos_canais_validados(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(self.t, "ARQ_CANAIS", Path(d) / "canais.json"), \
                mock.patch.dict(os.environ, {"TELEGRAM_CANAL_URL": "https://t.me/baixouofertas", "WHATSAPP_CANAL_URL": "javascript:alert(1)"}):
            self.assertEqual(self.t.gravar_canais(), {"telegram": "https://t.me/baixouofertas"})


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
                 "installments": {"quantity": 6, "rate": 0}, "thumbnail": "http://http2.mlstatic.com/D_1-I.jpg", "category_id": "MLB3835",
                 "permalink": f"https://produto.mercadolivre.com.br/MLB-{n}-caixa"} for n in range(30)]

    def itens(self, ids):
        return [{"id": i, "attributes": [{"id": "BRAND", "value_name": "JBL"}],
                 "pictures": [{"secure_url": f"https://http2.mlstatic.com/D_{i}_{k}-O.jpg"} for k in range(6)]} for i in ids]

    def reputacao(self, vid):
        return "5_green"

    def nome_categoria(self, cid):
        return "Caixas de som" if cid == "MLB3835" else None


class TestRoboReal(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        raiz = Path(self.tmp.name)
        self.patches = [
            mock.patch.object(robo, "ARQ_HIST", raiz / "historico.json"),
            mock.patch.object(robo, "ARQ_OFERTAS", raiz / "ofertas.json"),
            mock.patch.object(robo, "ARQ_STATUS", raiz / "status.json"),
            mock.patch.object(robo, "ARQ_PRECOS", raiz / "precos.json"),
            mock.patch.object(robo, "ARQ_CATS", raiz / "categorias.json"),
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
        self.assertEqual(ofertas[0]["subcategoria"], "Caixas de som")
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
