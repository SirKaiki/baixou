/* Personalização do Baixou: "Para você".
   Tudo fica NO APARELHO da pessoa (localStorage). Nada daqui é enviado ao Baixou, à Cloudflare nem a ninguém.
   O site não lê cookies de outros sites nem histórico de pesquisas (o navegador nem deixa): aprende só com o que a
   pessoa escolhe e faz DENTRO do Baixou.

   Como funciona:
   - escolhidas: categorias que a pessoa marcou em "Do que você gosta?" (peso fixo, até ela mudar);
   - sinais: o que ela faz aqui dentro (ver oferta, salvar nos favoritos, ir à loja, buscar), com pesos e
     esquecimento gradual (meia-vida de 21 dias), por categoria, subcategoria e marca;
   - faixa de preço: média (em escala log) do preço do que ela olha em cada categoria.
   Pronto para mais dados: subcategoria, marca e faixa de preço só passam a pesar quando há sinal suficiente
   (constantes em LIMIAR); com poucas ofertas, a escolha de categorias já faz o trabalho. */
(function (raiz) {
  'use strict';
  const VERSAO = 1;
  const DIA = 864e5;
  const MEIA_VIDA = 21 * DIA;
  const PESOS = {ver: 1, busca: 1, fav: 3, loja: 5};
  const LIMIAR = {
    sinal: 3,         // soma mínima de sinais para "Para você" aparecer sem categorias escolhidas
    faixa: 3,         // olhadas numa categoria antes de a faixa de preço contar
    detalhe: 2,       // sinal mínimo numa subcategoria/marca para ela contar
    min_vitrine: 4,   // produtos mínimos para mostrar a vitrine "Para você"
  };
  const MAX_CHAVES = 40;  // por tipo de sinal; o mais fraco sai primeiro
  const TIPOS = ['cat', 'sub', 'marca'];

  const novo = () => ({v: VERSAO, aprender: true, escolhidas: [], sinais: {cat: {}, sub: {}, marca: {}}, faixa: {}});

  const num = x => typeof x === 'number' && isFinite(x);
  const txt = x => typeof x === 'string' && x.length > 0 && x.length <= 80;

  // O localStorage pode ter sido mexido à mão (ou ser de uma versão antiga): só aproveita o que tem forma certa.
  function validar(e) {
    const ok = novo();
    if (!e || typeof e !== 'object') return ok;
    if (e.aprender === false) ok.aprender = false;
    if (Array.isArray(e.escolhidas)) ok.escolhidas = [...new Set(e.escolhidas.filter(txt))].slice(0, 30);
    const s = e.sinais && typeof e.sinais === 'object' ? e.sinais : {};
    for (const t of TIPOS) {
      const m = s[t] && typeof s[t] === 'object' ? s[t] : {};
      for (const [k, v] of Object.entries(m).slice(0, MAX_CHAVES * 2))
        if (txt(k) && v && num(v.s) && v.s > 0 && v.s < 1e6 && num(v.t)) ok.sinais[t][k] = {s: v.s, t: v.t};
    }
    const f = e.faixa && typeof e.faixa === 'object' ? e.faixa : {};
    for (const [k, v] of Object.entries(f).slice(0, MAX_CHAVES * 2))
      if (txt(k) && v && num(v.m) && num(v.w) && v.w > 0) ok.faixa[k] = {m: v.m, w: Math.min(v.w, 50)};
    return ok;
  }

  const atual = (v, agora) => v ? v.s * Math.pow(0.5, Math.max(0, agora - v.t) / MEIA_VIDA) : 0;

  function somar(mapa, chave, peso, agora) {
    if (!txt(chave)) return;
    mapa[chave] = {s: atual(mapa[chave], agora) + peso, t: agora};
    const ks = Object.keys(mapa);
    if (ks.length > MAX_CHAVES) {
      ks.sort((a, b) => atual(mapa[a], agora) - atual(mapa[b], agora));
      for (const k of ks.slice(0, ks.length - MAX_CHAVES)) delete mapa[k];
    }
  }

  // tipo: 'ver' | 'fav' | 'loja'. Devolve o próprio estado (já alterado).
  function registrar(e, p, tipo, agora = Date.now(), fracao = 1) {
    if (!e.aprender || !p || !PESOS[tipo]) return e;
    const w = PESOS[tipo] * fracao;
    somar(e.sinais.cat, p.categoria, w, agora);
    if (p.subcategoria) somar(e.sinais.sub, p.categoria + '›' + p.subcategoria, w, agora);
    if (p.marca) somar(e.sinais.marca, p.marca, w, agora);
    if (tipo !== 'busca' && txt(p.categoria) && num(p.preco) && p.preco > 0) {
      const f = e.faixa[p.categoria] || {m: 0, w: 0}, lp = Math.log(p.preco), nw = Math.min(f.w + 1, 50);
      e.faixa[p.categoria] = {m: f.m + (lp - f.m) / nw, w: nw};
    }
    return e;
  }

  // Uma busca reparte 1 ponto entre as categorias dos produtos que casam (no máximo 3 categorias).
  function registrarBusca(e, encontrados, agora = Date.now()) {
    if (!e.aprender || !encontrados || !encontrados.length) return e;
    const conta = new Map();
    for (const p of encontrados) conta.set(p.categoria, (conta.get(p.categoria) || 0) + 1);
    const top = [...conta].sort((a, b) => b[1] - a[1]).slice(0, 3), total = top.reduce((s, x) => s + x[1], 0);
    for (const [cat, n] of top) somar(e.sinais.cat, cat, PESOS.busca * n / total, agora);
    return e;
  }

  const sat = x => x / (x + 3);  // 0 → 0, 3 → 0,5, cresce devagar: ninguém "domina" a página
  const total = (e, agora) => Object.values(e.sinais.cat).reduce((s, v) => s + atual(v, agora), 0);
  const temSinal = (e, agora = Date.now()) => e.escolhidas.length > 0 || total(e, agora) >= LIMIAR.sinal;

  // Quanto um produto combina com a pessoa (0 = nada).
  function afinidade(e, p, agora = Date.now()) {
    let a = 0;
    if (e.escolhidas.includes(p.categoria)) a += 1;
    a += sat(atual(e.sinais.cat[p.categoria], agora));
    const sub = p.subcategoria && atual(e.sinais.sub[p.categoria + '›' + p.subcategoria], agora);
    if (sub >= LIMIAR.detalhe) a += 0.6 * sat(sub);
    const marca = p.marca && atual(e.sinais.marca[p.marca], agora);
    if (marca >= LIMIAR.detalhe) a += 0.6 * sat(marca);
    const f = e.faixa[p.categoria];
    if (a > 0 && f && f.w >= LIMIAR.faixa && p.preco > 0) {
      const d = Math.log(p.preco) - f.m;
      a *= 0.7 + 0.3 * Math.exp(-(d * d) / (2 * 0.6 * 0.6));  // perto do preço que ela costuma olhar pesa mais
    }
    return a;
  }

  // Vitrine "Para você": combina afinidade com o tamanho do desconto e varia as categorias.
  function paraVoce(e, produtos, {n = 14, agora = Date.now(), excluir = new Set()} = {}) {
    const nota = p => afinidade(e, p, agora) * (1 + Math.min(p.desconto || 0, 70) / 100);
    const cand = produtos.filter(p => !excluir.has(p.id)).map(p => [p, nota(p)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    const cats = new Set(cand.map(x => x[0].categoria)).size || 1;
    const teto = Math.max(3, Math.ceil(n / cats) + 2), porCat = new Map(), r = [], sobra = [];
    for (const [p] of cand) {
      const k = porCat.get(p.categoria) || 0;
      if (k < teto) { r.push(p); porCat.set(p.categoria, k + 1); } else sobra.push(p);
      if (r.length >= n) break;
    }
    return r.length < n ? [...r, ...sobra].slice(0, n) : r;
  }

  // Categorias na ordem do interesse da pessoa (empate: ordem original).
  function ordenarCategorias(e, cats, agora = Date.now()) {
    const peso = c => (e.escolhidas.includes(c.nome) ? 1 : 0) + sat(atual(e.sinais.cat[c.nome], agora));
    return cats.map((c, i) => [c, peso(c), i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(x => x[0]);
  }

  // Para a tela "Seus interesses": o que o site percebeu, em porcentagem.
  function resumo(e, agora = Date.now(), n = 5) {
    const l = Object.entries(e.sinais.cat).map(([k, v]) => [k, atual(v, agora)]).filter(x => x[1] >= 0.5).sort((a, b) => b[1] - a[1]);
    const soma = l.reduce((s, x) => s + x[1], 0);
    return l.slice(0, n).map(([nome, s]) => ({nome, pct: Math.round(100 * s / soma)}));
  }

  const G = {VERSAO, PESOS, LIMIAR, novo, validar, registrar, registrarBusca, afinidade, paraVoce, ordenarCategorias, resumo, temSinal};
  if (typeof module !== 'undefined' && module.exports) module.exports = G; else raiz.Gosto = G;
})(this);
