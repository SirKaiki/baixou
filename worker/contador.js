/**
 * Contador anônimo do Baixou (Cloudflare Worker + banco D1).
 *
 * POST /e        recebe eventos do site: {"s": sessão anônima, "e": [{"p": produto, "t": "v"|"c"}]}
 *                v = abriu a página do produto, c = clicou em "Comprar" (foi para a loja)
 * GET  /export   (só o robô, com token) devolve "quem viu também viu" e "mais procurados"
 *
 * Não guarda nome, e-mail, IP nem cookies: só um código aleatório da visita.
 */
const SESSAO = /^[a-z0-9]{12,40}$/;
const PRODUTO = /^[A-Z0-9]{3,24}$/;
const DIA = 86400000;

function cabecalhos(req, env) {
  const origem = req.headers.get('Origin') || '';
  const permitidas = (env.ORIGENS || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': permitidas.includes(origem) ? origem : (permitidas[0] || '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function origemValida(req, env) {
  const origem = req.headers.get('Origin');
  const permitidas = (env.ORIGENS || '').split(',').map(s => s.trim()).filter(Boolean);
  return !permitidas.length || (origem && permitidas.includes(origem));
}

function mesmoToken(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// Limite de envios por visitante (evita que alguém encha o banco com eventos falsos).
// O IP só serve de chave para o limitador do Cloudflare, na memória: nunca é gravado.
async function dentroDoLimite(req, env) {
  if (!env.LIMITADOR) return true;
  try {
    const {success} = await env.LIMITADOR.limit({key: req.headers.get('CF-Connecting-IP') || 'anon'});
    return success;
  } catch { return true; }
}

async function registrar(req, env, cors) {
  if (!origemValida(req, env)) return new Response('origem não permitida', {status: 403, headers: cors});
  if (!(await dentroDoLimite(req, env))) return new Response('muitas requisições', {status: 429, headers: cors});
  if (!/^(text\/plain|application\/json)/i.test(req.headers.get('Content-Type') || 'text/plain')) return new Response('tipo inválido', {status: 415, headers: cors});
  const texto = await req.text();
  if (texto.length > 2000) return new Response('grande demais', {status: 413, headers: cors});
  let dados;
  try { dados = JSON.parse(texto); } catch { return new Response('json inválido', {status: 400, headers: cors}); }
  const sessao = String(dados?.s || '');
  if (!SESSAO.test(sessao)) return new Response('sessão inválida', {status: 400, headers: cors});
  const agora = Date.now();
  const comandos = (Array.isArray(dados.e) ? dados.e.slice(0, 20) : [])
    .filter(ev => ev && PRODUTO.test(String(ev.p)) && (ev.t === 'v' || ev.t === 'c'))
    .map(ev => env.DB.prepare('INSERT OR IGNORE INTO eventos (sessao, produto, tipo, ts) VALUES (?1, ?2, ?3, ?4)')
      .bind(sessao, String(ev.p), ev.t, agora));
  if (comandos.length) await env.DB.batch(comandos);
  return new Response(null, {status: 204, headers: cors});
}

async function exportar(req, env) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!(await dentroDoLimite(req, env))) return new Response('muitas requisições', {status: 429});
  if (!mesmoToken(token, env.TOKEN || '')) return new Response('não autorizado', {status: 401});
  const agora = Date.now();
  await env.DB.prepare('DELETE FROM eventos WHERE ts < ?1').bind(agora - 45 * DIA).run();
  const pares = await env.DB.prepare(
    `SELECT a.produto AS a, b.produto AS b,
            COUNT(DISTINCT a.sessao) AS sessoes,
            SUM(CASE WHEN b.tipo = 'c' THEN 2 ELSE 1 END) AS peso
       FROM eventos a JOIN eventos b ON a.sessao = b.sessao AND a.produto <> b.produto
      WHERE a.tipo = 'v' AND a.ts >= ?1 AND b.ts >= ?1
      GROUP BY a.produto, b.produto
     HAVING sessoes >= 2
      ORDER BY peso DESC
      LIMIT 20000`).bind(agora - 30 * DIA).all();
  const populares = await env.DB.prepare(
    `SELECT produto, SUM(tipo = 'v') AS v, SUM(tipo = 'c') AS c
       FROM eventos WHERE ts >= ?1
      GROUP BY produto ORDER BY c DESC, v DESC LIMIT 500`).bind(agora - DIA).all();
  const visitas = await env.DB.prepare('SELECT COUNT(DISTINCT sessao) AS n FROM eventos WHERE ts >= ?1').bind(agora - DIA).first();
  return Response.json({
    gerado_em: new Date(agora).toISOString(),
    visitas_24h: visitas?.n || 0,
    pares: pares.results || [],
    populares: populares.results || [],
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = cabecalhos(req, env);
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    if (url.pathname === '/e' && req.method === 'POST') return registrar(req, env, cors);
    if (url.pathname === '/export' && req.method === 'GET') return exportar(req, env);
    return new Response('não encontrado', {status: 404, headers: cors});
  },
};
