// Testes da personalização "Para você" (site/gosto.js). Rodar: node --test testes/
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const G = createRequire(import.meta.url)('../site/gosto.js');

const DIA = 864e5, T0 = Date.UTC(2026, 10, 27);
const prod = (id, categoria, preco, extra = {}) => ({id, categoria, preco, desconto: 20, ...extra});
const P = [
  prod('A1', 'Celulares', 1200, {marca: 'Samsung', subcategoria: 'Smartphones'}),
  prod('A2', 'Celulares', 1500, {marca: 'Motorola', subcategoria: 'Smartphones'}),
  prod('A3', 'Celulares', 80, {subcategoria: 'Capinhas'}),
  prod('B1', 'Games', 300), prod('B2', 'Games', 250), prod('B3', 'Games', 3500),
  prod('C1', 'Casa', 90), prod('C2', 'Casa', 60), prod('C3', 'Casa', 140),
];

test('sem nada escolhido nem visto, não há vitrine', () => {
  const e = G.novo();
  assert.equal(G.temSinal(e, T0), false);
  assert.deepEqual(G.paraVoce(e, P, {agora: T0}), []);
});

test('categorias escolhidas aparecem primeiro e só elas', () => {
  const e = G.novo(); e.escolhidas = ['Games'];
  assert.equal(G.temSinal(e, T0), true);
  const v = G.paraVoce(e, P, {agora: T0});
  assert.deepEqual(new Set(v.map(p => p.categoria)), new Set(['Games']));
  assert.equal(G.ordenarCategorias(e, [{nome: 'Casa'}, {nome: 'Games'}], T0)[0].nome, 'Games');
});

test('aprende com o uso: ir à loja pesa mais que só ver', () => {
  const e = G.novo();
  G.registrar(e, P[6], 'ver', T0);           // Casa: 1
  G.registrar(e, P[3], 'loja', T0);          // Games: 5
  assert.equal(G.temSinal(e, T0), true);
  assert.equal(G.paraVoce(e, P, {agora: T0})[0].categoria, 'Games');
  assert.equal(G.resumo(e, T0)[0].nome, 'Games');
});

test('o interesse esquece devagar (meia-vida de 21 dias)', () => {
  const e = G.novo();
  G.registrar(e, P[3], 'loja', T0);
  const hoje = G.afinidade(e, P[3], T0), depois = G.afinidade(e, P[3], T0 + 21 * DIA);
  assert.ok(depois < hoje && depois > 0);
  G.registrar(e, P[6], 'fav', T0 + 21 * DIA);
  assert.equal(G.paraVoce(e, P, {agora: T0 + 21 * DIA})[0].categoria, 'Casa');
});

test('com mais dados, faixa de preço e marca passam a pesar', () => {
  const e = G.novo();
  for (let i = 0; i < 4; i++) G.registrar(e, P[3], 'ver', T0);  // Games de R$ 300, várias vezes
  const barato = G.afinidade(e, P[4], T0), caro = G.afinidade(e, P[5], T0);
  assert.ok(barato > caro, 'o jogo perto do preço que ela olha vem antes do de R$ 3.500');
  const e2 = G.novo();
  G.registrar(e2, P[0], 'fav', T0);                              // Samsung
  assert.ok(G.afinidade(e2, P[0], T0) > G.afinidade(e2, P[1], T0), 'a marca salva pesa a favor');
});

test('uma busca reparte interesse entre as categorias encontradas', () => {
  const e = G.novo();
  G.registrarBusca(e, [P[0], P[1], P[3]], T0);
  const r = G.resumo(e, T0);
  assert.equal(r[0].nome, 'Celulares');
  assert.equal(r.reduce((s, x) => s + x.pct, 0), 100);
});

test('com o aprendizado desligado, nada é registrado', () => {
  const e = G.novo(); e.aprender = false;
  G.registrar(e, P[0], 'loja', T0); G.registrarBusca(e, P, T0);
  assert.deepEqual(e.sinais.cat, {});
});

test('a vitrine mistura categorias e não repete o que já está na página', () => {
  const e = G.novo(); e.escolhidas = ['Celulares', 'Games', 'Casa'];
  const v = G.paraVoce(e, P, {n: 6, agora: T0, excluir: new Set(['A1'])});
  assert.equal(v.length, 6);
  assert.ok(!v.some(p => p.id === 'A1'));
  assert.equal(new Set(v.map(p => p.categoria)).size, 3);
});

test('dados estragados no aparelho não quebram o site', () => {
  for (const lixo of [null, 'x', 42, [], {escolhidas: 'Games', sinais: {cat: {Games: {s: 'muito'}}}},
                      {escolhidas: ['<img src=x>', 5], sinais: {cat: {Games: {s: 1e9, t: 1}}}, faixa: {Casa: {m: NaN, w: 1}}}]) {
    const e = G.validar(lixo);
    assert.equal(e.v, G.VERSAO);
    assert.deepEqual(e.sinais.cat, {});
    assert.deepEqual(e.faixa, {});
    assert.ok(e.escolhidas.every(c => typeof c === 'string'));
  }
  const bom = G.registrar(G.novo(), P[0], 'ver', T0);
  assert.deepEqual(G.validar(JSON.parse(JSON.stringify(bom))), bom);
});

test('a memória não cresce sem limite', () => {
  const e = G.novo();
  for (let i = 0; i < 200; i++) G.registrar(e, prod('X' + i, 'Cat' + i, 10, {marca: 'M' + i}), 'ver', T0 + i);
  assert.ok(Object.keys(e.sinais.cat).length <= 40);
  assert.ok(Object.keys(e.sinais.marca).length <= 40);
  assert.ok(JSON.stringify(e).length < 20000);
});
