// Testes do contador com um banco D1 de mentira (SQLite embutido do Node). Rode: node --test worker/contador.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import contador from './contador.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    run: async () => db.prepare(sql).run(...args),
    all: async () => ({results: db.prepare(sql).all(...args).map(r => ({...r}))}),
    first: async () => { const r = db.prepare(sql).get(...args); return r ? {...r} : null; },
  });
  return {prepare: sql => stmt(sql), batch: async l => Promise.all(l.map(s => s.run())), _db: db};
}
const ORIGEM = 'https://sirkaiki.github.io';
const env = () => ({DB: d1(), ORIGENS: ORIGEM, TOKEN: 'segredo'});
const enviar = (e, corpo, origem = ORIGEM) => contador.fetch(new Request('https://x.dev/e', {method: 'POST', headers: {Origin: origem, 'Content-Type': 'text/plain'}, body: JSON.stringify(corpo)}), e);
const exportar = (e, token = 'segredo') => contador.fetch(new Request('https://x.dev/export', {headers: {Authorization: 'Bearer ' + token}}), e);

test('registra eventos válidos e ignora duplicados e lixo', async () => {
  const e = env();
  const r = await enviar(e, {s: 'abc123def456', e: [{p: 'MLB1', t: 'v'}, {p: 'MLB1', t: 'v'}, {p: 'x<script>', t: 'v'}, {p: 'MLB2', t: 'z'}]});
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGEM);
  assert.equal(e.DB._db.prepare('SELECT COUNT(*) n FROM eventos').get().n, 1);
});

test('recusa origem estranha, sessão inválida e corpo enorme', async () => {
  const e = env();
  assert.equal((await enviar(e, {s: 'abc123def456', e: []}, 'https://golpe.com')).status, 403);
  assert.equal((await enviar(e, {s: 'curta', e: []})).status, 400);
  assert.equal((await enviar(e, {s: 'abc123def456', e: [{p: 'A'.repeat(3000), t: 'v'}]})).status, 413);
});

test('exportação exige token e calcula quem viu também viu', async () => {
  const e = env();
  // sabonete (MLB10) e shampoo (MLB20) vistos juntos por 3 visitas; uma delas foi para a loja no shampoo
  for (const s of ['sessaoaaaaaa1', 'sessaoaaaaaa2', 'sessaoaaaaaa3']) await enviar(e, {s, e: [{p: 'MLB10', t: 'v'}, {p: 'MLB20', t: 'v'}]});
  await enviar(e, {s: 'sessaoaaaaaa1', e: [{p: 'MLB20', t: 'c'}]});
  await enviar(e, {s: 'sessaoaaaaaa4', e: [{p: 'MLB10', t: 'v'}, {p: 'MLB30', t: 'v'}]}); // par visto 1 vez: não entra
  assert.equal((await exportar(e, 'errado')).status, 401);
  const d = await (await exportar(e)).json();
  const par = d.pares.find(x => x.a === 'MLB10' && x.b === 'MLB20');
  assert.equal(par.sessoes, 3);
  assert.equal(par.peso, 5); // 3 visualizações + clique vale 2
  assert.ok(!d.pares.some(x => x.b === 'MLB30'));
  assert.equal(d.visitas_24h, 4);
  assert.deepEqual(d.populares[0], {produto: 'MLB20', v: 3, c: 1});
});

test('limite de envios por visitante devolve 429 e não grava', async () => {
  const e = env();
  let n = 0;
  e.LIMITADOR = {limit: async () => ({success: ++n <= 2})};
  const s = {s: 'abc123def456', e: [{p: 'MLB1', t: 'v'}]};
  assert.equal((await enviar(e, s)).status, 204);
  assert.equal((await enviar(e, {s: 'abc123def457', e: [{p: 'MLB2', t: 'v'}]})).status, 204);
  assert.equal((await enviar(e, {s: 'abc123def458', e: [{p: 'MLB3', t: 'v'}]})).status, 429);
  assert.equal(e.DB._db.prepare('SELECT COUNT(*) n FROM eventos').get().n, 2);
  assert.equal((await exportar(e, 'chute')).status, 429);
});

test('rota desconhecida responde 404', async () => {
  const r = await contador.fetch(new Request('https://x.dev/qualquer'), env());
  assert.equal(r.status, 404);
});
