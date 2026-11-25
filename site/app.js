{
/* =========================================================
   Baixou: loja de ofertas (página única, roteada por ?parâmetros)
   ?p=ID produto · ?cat= categoria · ?marca= marca · ?q= busca · ?max= preço · ?ver= vitrines
   ========================================================= */

/* ---------- utilidades ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const brl = v => Number(v).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const brl0 = v => 'R$ ' + Math.round(Number(v)).toLocaleString('pt-BR');
const seguro = u => /^https:\/\/([a-z0-9-]+\.)*(mercadolivre\.com\.br|mlstatic\.com)\//i.test(String(u)) ? String(u) : '';
const minutos = iso => (Date.now() - new Date(iso)) / 60000;
const ago = iso => { const m = Math.max(0, Math.round(minutos(iso))); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m/60)} h` : `há ${Math.round(m/1440)} d`; };
const dm = d => { const [, m, dd] = String(d).split('-'); return `${dd}/${m}`; };
const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
const qs = o => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v !== '' && v != null && v !== false) u.set(k, v); const s = u.toString(); return s ? '?' + s : './'; };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const ler = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const porDesc = (a, b) => b.desconto - a.desconto;
const porNovo = (a, b) => new Date(b.novo_em) - new Date(a.novo_em) || b.desconto - a.desconto;

/* ---------- ícones ---------- */
const IC = {
  phone: f => `<rect x="40" y="16" width="40" height="86" rx="9" fill="${f}"/><rect x="44" y="24" width="32" height="66" rx="3" fill="#fff" opacity=".92"/><circle cx="60" cy="96" r="2.5" fill="#fff"/>`,
  laptop: f => `<rect x="26" y="26" width="68" height="48" rx="5" fill="${f}"/><rect x="31" y="31" width="58" height="38" rx="2" fill="#fff"/><path d="M14 78h92l-7 12H21z" fill="${f}"/>`,
  head: f => `<path d="M28 70V58a32 32 0 0 1 64 0v12" fill="none" stroke="${f}" stroke-width="8" stroke-linecap="round"/><rect x="19" y="62" width="22" height="36" rx="9" fill="${f}"/><rect x="79" y="62" width="22" height="36" rx="9" fill="${f}"/>`,
  fryer: f => `<path d="M38 26h44a10 10 0 0 1 10 10v58a8 8 0 0 1-8 8H36a8 8 0 0 1-8-8V36a10 10 0 0 1 10-10z" fill="${f}"/><rect x="38" y="58" width="44" height="32" rx="5" fill="#fff"/><circle cx="60" cy="42" r="7" fill="#fff"/>`,
  pot: f => `<rect x="26" y="50" width="68" height="44" rx="10" fill="${f}"/><rect x="22" y="42" width="76" height="10" rx="5" fill="${f}"/><rect x="52" y="32" width="16" height="10" rx="4" fill="${f}"/><rect x="10" y="56" width="16" height="7" rx="3.5" fill="${f}"/><rect x="94" y="56" width="16" height="7" rx="3.5" fill="${f}"/>`,
  perf: f => `<rect x="51" y="16" width="18" height="16" rx="3" fill="${f}"/><rect x="56" y="31" width="8" height="10" fill="${f}" opacity=".7"/><rect x="32" y="40" width="56" height="62" rx="14" fill="${f}"/><rect x="41" y="56" width="38" height="26" rx="5" fill="#fff"/>`,
  shoe: f => `<path d="M14 82c0-12 4-26 10-34l14 4c6 10 18 15 32 17l22 4c8 1 14 6 14 12v5H14z" fill="${f}"/><rect x="12" y="88" width="96" height="9" rx="4.5" fill="${f}" opacity=".55"/><path d="M42 60l7-5M49 67l7-5M57 71l7-5" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`,
  dumb: f => `<rect x="38" y="56" width="44" height="9" rx="2" fill="${f}" opacity=".7"/><rect x="24" y="36" width="15" height="48" rx="4" fill="${f}"/><rect x="81" y="36" width="15" height="48" rx="4" fill="${f}"/><rect x="12" y="46" width="11" height="28" rx="3" fill="${f}"/><rect x="97" y="46" width="11" height="28" rx="3" fill="${f}"/>`,
  pad: f => `<path d="M34 40h52c12 0 18 10 21 24l3 18c1 9-9 13-15 7L84 78H36L25 89c-6 6-16 2-15-7l3-18c3-14 9-24 21-24z" fill="${f}"/><path d="M37 56v13M30.5 62.5h13" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/><circle cx="81" cy="56" r="4" fill="#fff"/><circle cx="90" cy="65" r="4" fill="#fff"/>`,
  drill: f => `<path d="M26 38h52l10 9v14l-10 9H26a6 6 0 0 1-6-6V44a6 6 0 0 1 6-6z" fill="${f}"/><rect x="88" y="50" width="22" height="7" rx="2" fill="${f}" opacity=".7"/><path d="M40 70h24l-4 30H44z" fill="${f}"/><rect x="38" y="96" width="28" height="10" rx="3" fill="${f}"/>`,
  blocks: f => `<rect x="20" y="58" width="40" height="40" rx="4" fill="${f}"/><rect x="60" y="58" width="40" height="40" rx="4" fill="${f}" opacity=".7"/><rect x="40" y="20" width="40" height="38" rx="4" fill="${f}" opacity=".85"/><circle cx="50" cy="20" r="5" fill="${f}"/><circle cx="70" cy="20" r="5" fill="${f}"/>`,
  baby: f => `<rect x="44" y="14" width="32" height="12" rx="4" fill="${f}" opacity=".7"/><path d="M52 26h16l8 14v56a8 8 0 0 1-8 8H52a8 8 0 0 1-8-8V40z" fill="${f}"/><path d="M52 58h16M52 70h16M52 82h16" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  tv: f => `<rect x="14" y="22" width="92" height="58" rx="4" fill="${f}"/><rect x="19" y="27" width="82" height="48" fill="#fff"/><rect x="56" y="80" width="8" height="12" fill="${f}"/><rect x="38" y="92" width="44" height="6" rx="3" fill="${f}"/>`,
  tag: f => `<path d="M30 40l26-22h34v34L64 78z" fill="${f}"/><circle cx="76" cy="32" r="6" fill="#fff"/><path d="M34 74h40v26H34z" fill="${f}" opacity=".45"/>`
};
const ESTILOS = [
  [/celular|smartphone|telefon/, 'phone', '#dfe6ff', '#1f3cff'],
  [/informatica|computador|notebook/, 'laptop', '#d6f0f7', '#0d5b78'],
  [/eletronic|audio|som/, 'head', '#ffe1d6', '#c4100a'],
  [/eletrodom/, 'fryer', '#fff3b0', '#7a5600'],
  [/casa|decora|cozinha/, 'pot', '#ffe9d6', '#a34a0c'],
  [/beleza|perfum|cuidado/, 'perf', '#ffdced', '#b5125b'],
  [/esporte|fitness/, 'dumb', '#d9f5e2', '#0b6b3a'],
  [/moda|calcad|roupa/, 'shoe', '#efe4d8', '#5b3417'],
  [/game|console/, 'pad', '#e8e0ff', '#4b2fa0'],
  [/ferrament/, 'drill', '#ffe5c7', '#b04a00'],
  [/brinquedo|hobb/, 'blocks', '#ffdede', '#b3261e'],
  [/bebe|infantil/, 'baby', '#dcf0fa', '#1b6a8f'],
  [/tv|video/, 'tv', '#e4e6ee', '#20242f'],
];
const estilo = cat => { const n = norm(cat); for (const [re, ic, bg, fg] of ESTILOS) if (re.test(n)) return {ic, bg, fg}; return {ic:'tag', bg:'#eceef4', fg:'#2b2f3d'}; };
const icone = (cat, cor) => { const e = estilo(cat); return `<svg viewBox="0 0 120 120" aria-hidden="true">${IC[e.ic](cor || e.fg)}</svg>`; };
const SVG_HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.8 0 6 3.8 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg>';
const SVG_SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
const PERK = {
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h12v10H2zM14 10h4l4 4v2h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
};

/* ---------- tema ---------- */
const temaBtns = [...document.querySelectorAll('.theme button')];
function aplicarTema(t) {
  const r = document.documentElement;
  if (t === 'claro') r.dataset.theme = 'light'; else if (t === 'escuro') r.dataset.theme = 'dark'; else delete r.dataset.theme;
  temaBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === t)));
  try { t === 'auto' ? localStorage.removeItem('baixou-tema') : localStorage.setItem('baixou-tema', t); } catch (e) {}
}
let tema = 'auto'; try { tema = localStorage.getItem('baixou-tema') || 'auto'; } catch (e) {}
aplicarTema(tema);
temaBtns.forEach(b => b.addEventListener('click', () => aplicarTema(b.dataset.t)));

/* ---------- dados ---------- */
let P = [], byId = new Map(), CATS = [], MARCAS = [], REL = {quem_viu:{}, populares:[]}, POP = new Map(), precosP = null;
const vistos = () => ler('baixou-vistos', []).map(id => byId.get(String(id))).filter(Boolean);
function marcarVisto(id) { const v = ler('baixou-vistos', []).filter(x => x !== id); v.unshift(id); guardar('baixou-vistos', v.slice(0, 16)); }
const precos = () => precosP ??= fetch('data/precos.json', {cache:'no-store'}).then(r => r.ok ? r.json() : {}).catch(() => ({}));

/* ---------- favoritos ---------- */
const favs = () => new Set(ler('baixou-favs', []));
function contarFavs() { const n = [...favs()].filter(id => byId.has(id)).length; $('favn').textContent = n; $('favn').hidden = !n; }
function alternarFav(id) {
  const f = favs(); const on = !f.has(id); on ? f.add(id) : f.delete(id); guardar('baixou-favs', [...f]);
  document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach(b => { b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Remover dos favoritos' : 'Salvar nos favoritos'); });
  contarFavs(); toast(on ? 'Salvo nos favoritos' : 'Removido dos favoritos');
}

/* ---------- contador anônimo (só se estiver publicado) ---------- */
let CONTADOR = '';
const sessao = (() => { try { let s = sessionStorage.getItem('baixou-s'); if (!s) { s = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => (b % 36).toString(36)).join(''); sessionStorage.setItem('baixou-s', s); } return s; } catch (e) { return ''; } })();
function evento(tipo, id) {
  if (!CONTADOR || !sessao || navigator.doNotTrack === '1' || !/^[A-Z0-9]{3,24}$/.test(id)) return;
  const corpo = new Blob([JSON.stringify({s:sessao, e:[{p:id, t:tipo}]})], {type:'text/plain'});
  try { navigator.sendBeacon(CONTADOR + '/e', corpo); } catch (e) {}
}

/* ---------- componentes ---------- */
function card(p, opts = {}) {
  const e = estilo(p.categoria), foto = seguro(p.foto), fav = favs().has(p.id);
  const novo = p.novo_em && minutos(p.novo_em) < 180;
  const pop = POP.get(p.id);
  const selo = p.menor_30d ? '<span class="flag low">Menor preço 30d</span>' : pop && pop.c >= 5 ? '<span class="flag hot">Em alta</span>' : novo ? '<span class="flag new">Novo</span>' : '';
  return `<article class="card">
    <button class="heart" type="button" data-fav="${esc(p.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}">${SVG_HEART}</button>
    <a href="?p=${encodeURIComponent(p.id)}" data-nav>
    <div class="pic" style="${foto ? '' : `background:${e.bg}`}">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<span class="ph">${icone(p.categoria)}</span>`}
      <span class="badges"><span class="off">-${p.desconto}%</span>${selo}</span></div>
    <div class="body">
      ${p.marca ? `<span class="brandn">${esc(p.marca)}</span>` : ''}
      <h3 class="name">${esc(p.titulo)}</h3>
      ${p.preco_cheio ? `<span class="was">${brl(p.preco_cheio)}</span>` : ''}
      <span class="now">${brl(p.preco)}</span>
      ${p.parcelas > 1 ? `<span class="parc">em ${p.parcelas}x de ${brl(p.preco / p.parcelas)}${p.sem_juros ? ' sem juros' : ''}</span>` : '<span class="parc">à vista</span>'}
      <span class="meta">${p.frete_gratis ? '<span class="ship">Frete grátis</span>' : ''}${p.full ? '<span class="full">⚡ Full</span>' : ''}${opts.pop && pop && pop.c ? `<span class="pop">${pop.c} ${pop.c === 1 ? 'pessoa foi' : 'pessoas foram'} à loja hoje</span>` : ''}</span>
    </div></a></article>`;
}
function fallbackImgs(root) {
  for (const img of root.querySelectorAll('.pic img, .plate img')) img.addEventListener('error', () => {
    const a = img.closest('a'); const id = a && new URLSearchParams((a.getAttribute('href') || '').replace(/^.*\?/, '')).get('p');
    const p = byId.get(id);
    img.outerHTML = img.closest('.plate') ? icone(p ? p.categoria : '') : `<span class="ph">${icone(p ? p.categoria : '', '#8b90a1')}</span>`;
  }, {once:true});
}
function rail(id, titulo, itens, link, linkTxt = 'Ver todas', sub = '', opts = {}) {
  if (!itens.length) return '';
  return `<section class="sec wrap" aria-labelledby="${id}-t"><div class="sec-head"><h2 id="${id}-t">${esc(titulo)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</h2><div class="arrows">${link ? `<a href="${esc(link)}" data-nav>${esc(linkTxt)}</a>` : ''}<button type="button" data-prev="${id}" aria-label="Anteriores">‹</button><button type="button" data-next="${id}" aria-label="Próximos">›</button></div></div>
    <div class="rail" id="${id}" tabindex="0">${itens.map(p => card(p, opts)).join('')}</div></section>`;
}
function plates(itens) {
  return `<div class="plates" aria-hidden="true">${itens.slice(0, 3).map(p => { const f = seguro(p.foto); return `<span class="plate">${f ? `<img src="${esc(f)}" alt="" referrerpolicy="no-referrer">` : icone(p.categoria)}<span class="tagp">${brl0(p.preco)}</span></span>`; }).join('')}</div>`;
}
const slide = c => `<a class="slide ${c.cls}" href="${esc(c.href)}" data-nav data-cls="${c.cls}"><div class="in">
    <div><span class="kick">${esc(c.kick)}</span><h2>${c.titulo}</h2><p>${esc(c.sub)}</p><span class="cta">${esc(c.cta || 'Ver ofertas')} →</span></div>${plates(c.itens)}</div></a>`;

/* ---------- campanhas montadas a partir das ofertas do momento ---------- */
function campanhas() {
  const cs = {};
  const menor = P.filter(p => p.menor_30d).sort(porDesc);
  if (menor.length >= 3) cs.menor = {cls:'s-green', kick:'Comparado com o histórico', titulo:'Menor preço <em>em 30 dias</em>', sub:`${menor.length} produtos no preço mais baixo do mês. Hora de comprar.`, href:'?ver=menor', itens:menor};
  const novas = [...P].sort(porNovo);
  if (novas.length >= 3) cs.novas = {cls:'s-blue', kick:'Atualizado agora', titulo:'Acabou <em>de baixar</em>', sub:'As promoções que entraram no site nas últimas horas, conferidas pelo robô.', href:'?ver=novas', itens:novas};
  const rank = CATS.filter(c => c.n >= 3).map(c => ({...c, max: Math.max(...P.filter(p => p.categoria === c.nome).map(p => p.desconto))})).sort((a, b) => b.max - a.max);
  rank.slice(0, 2).forEach((c, i) => { cs['cat' + i] = {cls: i ? 's-black' : 's-red', kick: c.nome, titulo:`Até <em>${c.max}% off</em> em ${esc(c.nome)}`, sub:`${c.n} ofertas selecionadas em ${c.nome.toLowerCase()}.`, href: qs({cat:c.nome}), itens: P.filter(p => p.categoria === c.nome).sort(porDesc)}; });
  const full = P.filter(p => p.full && p.frete_gratis).sort(porDesc);
  if (full.length >= 3) cs.full = {cls:'s-black', kick:'Chega rápido', titulo:'Frete grátis <em>+ Full</em>', sub:'Produtos que saem do estoque do Mercado Livre, com envio expresso.', href:'?ver=full', itens:full};
  const ate = P.filter(p => p.preco <= 100).sort(porDesc);
  if (ate.length >= 3) cs.ate100 = {cls:'s-yel', kick:'Cabe no bolso', titulo:'Tudo até <em>R$ 100</em>', sub:'Ofertas boas que não pesam no orçamento.', href:qs({max:100}), itens:ate};
  return cs;
}

/* ---------- carrosséis automáticos ---------- */
let timers = [];
const limparTimers = () => { timers.forEach(clearInterval); timers = []; };
function autoplay(el, passo, ms) {
  if (reduz || !el) return;
  let pausa = 0;
  const parar = () => { pausa = Date.now() + 9000; };
  ['pointerenter', 'touchstart', 'focusin', 'wheel'].forEach(ev => el.addEventListener(ev, parar, {passive:true}));
  el.addEventListener('pointerleave', () => { pausa = Date.now() + 1500; });
  timers.push(setInterval(() => { if (Date.now() < pausa || document.hidden) return; passo(); }, ms));
}
function heroInit() {
  const t = $('ht'); if (!t) return;
  const slides = [...t.children], dots = [...document.querySelectorAll('.dot')], hero = t.parentElement;
  const atual = () => Math.round(t.scrollLeft / t.clientWidth);
  const ir = i => t.scrollTo({left: ((i + slides.length) % slides.length) * t.clientWidth, behavior: reduz ? 'auto' : 'smooth'});
  const marcar = () => { const i = atual(); dots.forEach((d, k) => d.setAttribute('aria-current', String(k === i))); };
  let raf; t.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(marcar); }, {passive:true});
  dots.forEach((d, k) => d.addEventListener('click', () => ir(k)));
  hero.querySelector('.l')?.addEventListener('click', () => ir(atual() - 1));
  hero.querySelector('.r')?.addEventListener('click', () => ir(atual() + 1));
  marcar();
  if (slides.length > 1) autoplay(hero, () => ir(atual() + 1), 5500);
}
function railAuto(id) {
  const r = $(id); if (!r) return;
  autoplay(r, () => {
    const w = r.firstElementChild ? r.firstElementChild.getBoundingClientRect().width + 14 : 200;
    if (r.scrollLeft + r.clientWidth >= r.scrollWidth - 4) r.scrollTo({left:0, behavior:'smooth'});
    else r.scrollBy({left:w, behavior:'smooth'});
  }, 3200);
}

/* ---------- página inicial ---------- */
function viewHome() {
  document.title = 'Baixou: só o que está em promoção de verdade';
  if (!P.length) { $('view').innerHTML = `<div class="wrap" style="padding-block:60px"><div class="empty"><strong>Nenhuma oferta no momento</strong><p>O robô confere as promoções a cada 15 minutos. Volte daqui a pouco.</p></div></div>`; return; }
  const cs = campanhas();
  const heroC = ['menor', 'novas', 'cat0', 'full', 'ate100'].map(k => cs[k]).filter(Boolean).slice(0, 4);
  const novas = [...P].sort(porNovo).slice(0, 14);
  const vis = vistos();
  const populares = REL.populares.map(x => byId.get(x.id)).filter(Boolean);
  const nFrete = P.filter(p => p.frete_gratis).length;
  const faixas = [50, 100, 200, 500].map(m => ({m, n: P.filter(p => p.preco <= m).length})).filter(f => f.n);
  const topCats = [...CATS].sort((a, b) => b.n - a.n).filter(c => c.n >= 5).slice(0, 3);
  let h = '';
  h += `<div class="hero"><div class="hero-track" id="ht">${heroC.map(slide).join('')}</div>
    ${heroC.length > 1 ? `<button class="hero-arrow l" type="button" aria-label="Banner anterior">‹</button><button class="hero-arrow r" type="button" aria-label="Próximo banner">›</button><div class="hero-ctl">${heroC.map((c, i) => `<button class="dot" type="button" aria-label="Banner ${i + 1}"><i></i></button>`).join('')}</div>` : ''}</div>`;
  h += `<div class="perks"><div class="wrap">
    <div class="perk">${PERK.clock}<span><b>A cada 15 min</b>preços conferidos pelo robô</span></div>
    <div class="perk">${PERK.chart}<span><b>Desconto real</b>comparado com o histórico</span></div>
    <div class="perk">${PERK.shield}<span><b>Compra segura</b>direto no Mercado Livre</span></div>
    <div class="perk">${PERK.truck}<span><b>Frete grátis</b>em ${nFrete} ${nFrete === 1 ? 'oferta' : 'ofertas'}</span></div></div></div>`;
  h += rail('r-novas', 'Acabou de baixar', novas, '?ver=novas', 'Ver todas', 'Entraram no site agora há pouco');
  if (populares.length >= 6) h += rail('r-pop', 'Mais procurados hoje', populares.slice(0, 14), '', '', 'O que mais gente levou para a loja nas últimas 24 horas', {pop:true});
  if (faixas.length >= 2) h += `<section class="sec wrap" aria-labelledby="preco-t"><div class="sec-head"><h2 id="preco-t">Escolha por preço</h2></div><div class="prices">${faixas.map(f => `<a class="ptile" href="${qs({max:f.m})}" data-nav><span>Até</span><b>R$ ${f.m}</b><small>${f.n} ofertas</small></a>`).join('')}</div></section>`;
  h += `<section class="sec wrap" aria-labelledby="cats-t"><div class="sec-head"><h2 id="cats-t">Compre por categoria</h2></div><div class="tiles">${CATS.map(c => { const e = estilo(c.nome); return `<a class="tile" href="${esc(qs({cat:c.nome}))}" data-nav style="background:${e.bg}">${icone(c.nome)}<b>${esc(c.nome)}</b><small>${c.n} ${c.n === 1 ? 'oferta' : 'ofertas'}</small></a>`; }).join('')}</div></section>`;
  if (vis.length) h += rail('r-vistos', 'Vistos recentemente', vis.slice(0, 12), '', '', 'Continue de onde parou');
  if (cs.menor) h += rail('r-menor', 'Menor preço em 30 dias', cs.menor.itens.slice(0, 14), '?ver=menor', 'Ver todas', 'O preço mais baixo que registramos no mês');
  topCats.forEach((c, i) => { h += rail('r-cat' + i, `Destaques em ${c.nome}`, P.filter(p => p.categoria === c.nome).sort(porDesc).slice(0, 14), qs({cat:c.nome})); });
  if (MARCAS.length >= 4) h += `<section class="sec wrap" aria-labelledby="marcas-t"><div class="sec-head"><h2 id="marcas-t">Compre por marca</h2></div><div class="brands">${MARCAS.slice(0, 18).map(m => `<a class="brand" href="${esc(qs({marca:m.nome}))}" data-nav>${esc(m.nome)} <small>${m.n}</small></a>`).join('')}</div></section>`;
  h += rail('r-desc', 'Maiores descontos', [...P].sort(porDesc).slice(0, 14), '?ver=descontos');
  h += `<section class="sec wrap" aria-labelledby="all-t"><div class="sec-head"><h2 id="all-t">Todas as ofertas</h2><div class="arrows"><a href="?ver=todas" data-nav>Ver as ${P.length}</a></div></div><div class="grid">${[...P].sort(porNovo).slice(0, 10).map(p => card(p)).join('')}</div>
    <div class="more"><a class="btn2" href="?ver=todas" data-nav>Ver todas as ofertas</a></div></section>`;
  $('view').innerHTML = h;
  heroInit(); railAuto('r-novas');
}

/* ---------- listagem ---------- */
const VITRINES = {
  todas: {t:'Todas as ofertas', d:'Tudo o que está em promoção agora.'},
  novas: {t:'Acabou de baixar', d:'As ofertas mais recentes primeiro.', sort:'new'},
  descontos: {t:'Maiores descontos', d:'Ordenado pelo maior desconto.', sort:'disc'},
  menor: {t:'Menor preço em 30 dias', d:'Produtos no preço mais baixo que registramos no último mês.', low:true},
  full: {t:'Frete grátis + Full', d:'Saem do estoque do Mercado Livre, com envio expresso.', full:true, frete:true},
  favoritos: {t:'Meus favoritos', d:'Salvos neste aparelho. Toque no coração de qualquer oferta para guardar aqui.', fav:true},
};
const PAGE = 24;
let L = null;
function viewLista(ps) {
  const max = /^\d+$/.test(ps.get('max') || '') ? ps.get('max') : '';
  let ver = VITRINES[ps.get('ver')] ? ps.get('ver') : '';
  if (!ver && !ps.get('cat') && !ps.get('q') && !ps.get('marca') && !max) ver = 'todas';
  const v = VITRINES[ver] || {};
  L = {cat: ps.get('cat') || '', marca: ps.get('marca') || '', q: ps.get('q') || '', ver, fav: !!v.fav, disc:0, min:'', max, frete:!!v.frete, full:!!v.full, low:!!v.low, sort:v.sort || (ps.get('q') ? 'disc' : 'new'), shown:PAGE};
  if (L.cat && !CATS.some(c => c.nome === L.cat)) L.cat = '';
  const titulo = L.q ? `“${L.q}”` : L.cat || L.marca || (max && !ver ? `Tudo até R$ ${max}` : v.t);
  const desc = L.q ? 'Resultados da busca' : L.cat ? `Ofertas selecionadas em ${L.cat.toLowerCase()}.` : L.marca ? `Ofertas da marca ${L.marca}.` : (max && !ver ? 'Ofertas que cabem no bolso.' : v.d);
  document.title = `${L.q ? 'Busca: ' + L.q : titulo} | Baixou`;
  $('view').innerHTML = `<div class="lhead"><div class="wrap"><div class="crumbs"><a href="./" data-nav>Início</a> › ${esc(L.q ? 'Busca' : titulo)}</div><h1>${esc(titulo)}</h1>${desc ? `<p>${esc(desc)}</p>` : ''}</div></div>
  <div class="wrap lmain">
    <aside><details id="fd" open><summary>Filtros</summary><div class="fbox">
      ${L.cat ? '' : `<div><h3>Categoria</h3><select id="fcat" aria-label="Categoria"><option value="">Todas</option>${CATS.map(c => `<option value="${esc(c.nome)}">${esc(c.nome)} (${c.n})</option>`).join('')}</select></div>`}
      <div><h3>Desconto</h3>${[0, 20, 30, 40].map(d => `<label class="opt"><input type="radio" name="disc" value="${d}"${d ? '' : ' checked'}> ${d ? d + '% ou mais' : 'Qualquer desconto'}</label>`).join('')}</div>
      <div><h3>Preço</h3><div class="price-row"><input id="pmin" type="number" inputmode="numeric" min="0" placeholder="Mín. R$" aria-label="Preço mínimo"><input id="pmax" type="number" inputmode="numeric" min="0" placeholder="Máx. R$" aria-label="Preço máximo" value="${esc(L.max)}"></div></div>
      <div><h3>Entrega e preço</h3>
        <label class="opt"><input id="frete" type="checkbox"${L.frete ? ' checked' : ''}> Frete grátis</label>
        <label class="opt"><input id="full" type="checkbox"${L.full ? ' checked' : ''}> Entrega Full</label>
        <label class="opt"><input id="low" type="checkbox"${L.low ? ' checked' : ''}> Menor preço em 30 dias</label></div>
      <div><h3>Loja</h3><label class="opt"><input type="checkbox" checked disabled> <span class="pill">Mercado Livre</span></label><label class="opt"><input type="checkbox" disabled> Amazon <small>em breve</small></label><label class="opt"><input type="checkbox" disabled> Shopee <small>em breve</small></label></div>
      <button class="btn2" id="reset" type="button">Limpar filtros</button>
    </div></details></aside>
    <section aria-live="polite">
      <div class="bar"><b id="cnt"></b><label for="sort">Ordenar <select id="sort"><option value="new">Mais recentes</option><option value="disc">Maior desconto</option><option value="low">Menor preço</option><option value="high">Maior preço</option></select></label></div>
      <div class="active" id="active"></div><div class="grid" id="grid"></div>
      <div class="more" id="more" hidden><button class="btn2" type="button" id="moreb">Carregar mais ofertas</button><span id="moret"></span></div>
    </section></div>`;
  $('sort').value = L.sort;
  if (matchMedia('(max-width:900px)').matches) $('fd').open = false;
  const on = (id, ev, fn) => $(id)?.addEventListener(ev, fn);
  on('fcat', 'change', e => { L.cat = e.target.value; listar(); });
  document.querySelectorAll('input[name=disc]').forEach(r => r.addEventListener('change', e => { L.disc = +e.target.value; listar(); }));
  on('pmin', 'input', e => { L.min = e.target.value; listar(); });
  on('pmax', 'input', e => { L.max = e.target.value; listar(); });
  ['frete', 'full', 'low'].forEach(k => on(k, 'change', e => { L[k] = e.target.checked; listar(); }));
  on('sort', 'change', e => { L.sort = e.target.value; listar(); });
  on('reset', 'click', () => { Object.assign(L, {disc:0, min:'', max:'', frete:false, full:false, low:false}); if ($('fcat')) { L.cat = ''; $('fcat').value = ''; } $('pmin').value = ''; $('pmax').value = ''; ['frete', 'full', 'low'].forEach(k => $(k).checked = false); document.querySelector('input[name=disc][value="0"]').checked = true; listar(); });
  on('moreb', 'click', () => { L.shown += PAGE; listar(false); });
  $('active').addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (!b) return; const k = b.dataset.x;
    if (k === 'disc') { L.disc = 0; document.querySelector('input[name=disc][value="0"]').checked = true; }
    else if (k === 'min' || k === 'max') { L[k] = ''; $('p' + k).value = ''; }
    else if (k === 'cat') { L.cat = ''; if ($('fcat')) $('fcat').value = ''; }
    else { L[k] = false; $(k).checked = false; }
    listar(); });
  listar();
}
function filtrados() {
  const q = norm(L.q.trim()), fv = favs();
  return P.filter(p => (!q || q.split(/\s+/).every(w => norm(p.titulo + ' ' + p.categoria + ' ' + (p.marca || '')).includes(w)))
    && (!L.cat || p.categoria === L.cat) && (!L.marca || p.marca === L.marca) && (!L.fav || fv.has(p.id)) && p.desconto >= L.disc
    && (L.min === '' || p.preco >= +L.min) && (L.max === '' || p.preco <= +L.max)
    && (!L.frete || p.frete_gratis) && (!L.full || p.full) && (!L.low || p.menor_30d));
}
function listar(reset = true) {
  if (reset) L.shown = PAGE;
  const by = {disc:porDesc, low:(a, b) => a.preco - b.preco, high:(a, b) => b.preco - a.preco, new:porNovo}[L.sort];
  const r = filtrados().sort(by), vis = r.slice(0, L.shown);
  $('cnt').textContent = r.length + (r.length === 1 ? ' oferta' : ' ofertas');
  $('grid').innerHTML = vis.length ? vis.map(p => card(p)).join('') : L.fav
    ? `<div class="empty"><strong>Nenhum favorito ainda</strong><p>Toque no coração de uma oferta para salvá-la aqui.</p><a class="btn2" href="./" data-nav>Ver ofertas</a></div>`
    : `<div class="empty"><strong>Nenhuma oferta com esses filtros</strong><p>Tente outra busca ou afrouxe os filtros.</p><a class="btn2" href="?ver=todas" data-nav>Ver todas as ofertas</a></div>`;
  fallbackImgs($('grid'));
  $('more').hidden = r.length <= L.shown;
  $('moret').textContent = `Mostrando ${vis.length} de ${r.length}`;
  const a = [];
  if (L.cat && $('fcat')) a.push(['cat', L.cat]);
  if (L.disc) a.push(['disc', `${L.disc}% ou mais`]);
  if (L.min !== '') a.push(['min', `A partir de ${brl(L.min)}`]);
  if (L.max !== '') a.push(['max', `Até ${brl(L.max)}`]);
  if (L.frete) a.push(['frete', 'Frete grátis']);
  if (L.full) a.push(['full', 'Entrega Full']);
  if (L.low) a.push(['low', 'Menor preço em 30 dias']);
  $('active').innerHTML = a.map(([k, l]) => `<button type="button" data-x="${k}" aria-label="Remover filtro ${esc(l)}">${esc(l)} <span aria-hidden="true">×</span></button>`).join('');
}

/* ---------- produto ---------- */
function parecidos(p, excluir) {
  const palavras = new Set(norm(p.titulo).split(/[^a-z0-9]+/).filter(w => w.length >= 3));
  return P.filter(x => x.id !== p.id && !excluir.has(x.id)).map(x => {
    const comuns = norm(x.titulo).split(/[^a-z0-9]+/).filter(w => palavras.has(w)).length;
    const preco = 1 - Math.min(1, Math.abs(Math.log(x.preco / p.preco)));
    return {x, s: (x.categoria === p.categoria ? 3 : 0) + comuns * 1.5 + preco + x.desconto / 100};
  }).sort((a, b) => b.s - a.s).slice(0, 14).map(o => o.x);
}
let obsBuy = null;
function viewProduto(id) {
  const p = byId.get(id);
  if (!p) {
    document.title = 'Oferta encerrada | Baixou';
    $('view').innerHTML = `<div class="wrap" style="padding-block:40px"><div class="empty"><strong>Esta oferta acabou</strong><p>O robô tira do ar o que encareceu ou esgotou. Veja o que está valendo agora:</p><a class="btn2" href="./" data-nav>Ir para a página inicial</a></div></div>${rail('r-desc', 'Maiores descontos agora', [...P].sort(porDesc).slice(0, 14), '?ver=descontos')}`;
    return;
  }
  marcarVisto(p.id); evento('v', p.id);
  document.title = `${p.titulo} por ${brl(p.preco)} | Baixou`;
  const fotos = [...new Set([...(p.fotos || []), p.foto].map(seguro).filter(Boolean))].slice(0, 5);
  const link = seguro(p.link) || '#';
  const e = estilo(p.categoria), fav = favs().has(p.id), pop = POP.get(p.id);
  const economia = p.preco_cheio ? p.preco_cheio - p.preco : 0;
  const quemViu = (REL.quem_viu[p.id] || []).map(i => byId.get(i)).filter(Boolean);
  const usados = new Set(quemViu.map(x => x.id));
  const daMarca = p.marca ? P.filter(x => x.marca === p.marca && x.id !== p.id).sort(porDesc) : [];
  const vis = vistos().filter(x => x.id !== p.id);
  $('view').innerHTML = `<div class="wrap"><div class="crumbs" style="padding-top:18px"><a href="./" data-nav>Início</a> › <a href="${esc(qs({cat:p.categoria}))}" data-nav>${esc(p.categoria)}</a>${p.marca ? ` › <a href="${esc(qs({marca:p.marca}))}" data-nav>${esc(p.marca)}</a>` : ''}</div>
  <div class="pmain">
    <div class="gal${fotos.length > 1 ? '' : ' one'}">
      <div class="big" style="${fotos.length ? '' : `background:${e.bg}`}">${fotos.length ? `<img id="bigimg" src="${esc(fotos[0])}" alt="${esc(p.titulo)}" referrerpolicy="no-referrer">` : `<span class="ph">${icone(p.categoria)}</span>`}
        <span class="badges"><span class="off">-${p.desconto}%</span>${p.menor_30d ? '<span class="flag low">Menor preço 30d</span>' : ''}</span>
        <button class="heart" type="button" data-fav="${esc(p.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}">${SVG_HEART}</button></div>
      ${fotos.length > 1 ? `<div class="thumbs">${fotos.map((f, i) => `<button type="button" data-img="${esc(f)}" aria-label="Foto ${i + 1}" aria-current="${i === 0}"><img src="${esc(f)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>` : ''}
    </div>
    <div class="info">
      <div class="tags"><span class="pill">${esc(p.loja || 'Mercado Livre')}</span>${p.full ? '<span class="full">⚡ Entrega Full</span>' : ''}</div>
      ${p.marca ? `<span class="brandn">${esc(p.marca)}</span>` : ''}
      <h1>${esc(p.titulo)}</h1>
      <div class="pbox">
        ${p.preco_cheio ? `<span class="was">${brl(p.preco_cheio)}</span>` : ''}
        <div class="row"><span class="now">${brl(p.preco)}</span><span class="off">-${p.desconto}%</span></div>
        ${economia > 0 ? `<span class="save">Você economiza ${brl(economia)}</span>` : ''}
        ${p.parcelas > 1 ? `<span class="parc" style="font-size:15px">em ${p.parcelas}x de ${brl(p.preco / p.parcelas)}${p.sem_juros ? ' sem juros' : ''}</span>` : ''}
        ${p.frete_gratis ? '<span class="ship">Frete grátis</span>' : ''}
        <a class="buy" id="buy" href="${esc(link)}" target="_blank" rel="nofollow sponsored noopener" data-buy="${esc(p.id)}">Comprar no Mercado Livre ↗</a>
        <button class="share" type="button" data-share="${esc(p.id)}">${SVG_SHARE} Compartilhar oferta</button>
        <p class="note">Preço verificado ${ago(p.verificado_em)}. Você conclui a compra no Mercado Livre; preço e estoque podem mudar.</p>
      </div>
      ${pop && pop.c >= 3 ? `<div class="proof"><b>${pop.c}</b> pessoas foram à loja por esta oferta nas últimas 24 horas</div>` : ''}
      <ul class="trust"><li>Vendedor com boa reputação no Mercado Livre</li><li>Produto novo, com desconto conferido pelo nosso robô</li><li>Pagamento, entrega e garantia direto com a loja</li></ul>
    </div>
  </div>
  <section class="hist" aria-labelledby="hist-t"><h2 class="h2" id="hist-t">Histórico de preço</h2><div class="fig" id="fig"></div><div class="stats" id="stats"></div></section></div>
  ${quemViu.length >= 4 ? rail('r-qv', 'Quem viu este também viu', quemViu, '', '', 'Baseado no que outros visitantes abriram no Baixou') : ''}
  ${rail('r-par', 'Parecidos com este', parecidos(p, usados), qs({cat:p.categoria}), 'Ver categoria')}
  ${daMarca.length >= 3 ? rail('r-marca', `Mais de ${p.marca}`, daMarca.slice(0, 14), qs({marca:p.marca}), 'Ver marca') : ''}
  ${vis.length ? rail('r-vistos', 'Vistos recentemente', vis.slice(0, 12)) : ''}`;
  $('bigimg')?.addEventListener('error', function () { const box = this.parentElement; box.style.background = e.bg; this.outerHTML = `<span class="ph">${icone(p.categoria)}</span>`; }, {once:true});
  document.querySelectorAll('[data-img]').forEach(b => b.addEventListener('click', () => {
    const big = $('bigimg'); if (big) big.src = b.dataset.img;
    document.querySelectorAll('[data-img]').forEach(x => x.setAttribute('aria-current', String(x === b)));
  }));
  // barra de compra fixa quando o botão principal sai da tela
  const bar = $('buybar');
  bar.innerHTML = `<div class="p"><b>${brl(p.preco)}</b><small>-${p.desconto}% · ${p.frete_gratis ? 'frete grátis' : 'Mercado Livre'}</small></div><a href="${esc(link)}" target="_blank" rel="nofollow sponsored noopener" data-buy="${esc(p.id)}">Comprar ↗</a>`;
  const btn = $('buy');
  obsBuy = () => { const on = btn.getBoundingClientRect().bottom < 0; bar.classList.toggle('on', on); bar.setAttribute('aria-hidden', String(!on)); document.body.classList.toggle('has-buybar', on); };
  addEventListener('scroll', obsBuy, {passive:true});
  precos().then(todos => grafico(p, todos[p.id] || []));
}
function grafico(p, pts) {
  const fig = $('fig'), stats = $('stats'); if (!fig) return;
  const hoje = new Date().toISOString().slice(0, 10);
  const serie = pts.map(([d, v]) => [d, Number(v)]);
  if (!serie.length || serie[serie.length - 1][0] !== hoje) serie.push([hoje, p.preco]);
  const vals = serie.map(s => s[1]), menor = Math.min(...vals), maior = Math.max(...vals);
  stats.innerHTML = `<div><span>Hoje</span><b>${brl(p.preco)}</b></div><div class="hl"><span>Menor registrado</span><b>${brl(menor)}</b></div><div><span>Maior registrado</span><b>${brl(maior)}</b></div>`;
  if (serie.length < 2) { fig.style.height = 'auto'; fig.innerHTML = `<p class="note" style="font-size:15px">Começamos a acompanhar este preço em ${dm(serie[0][0])}. O gráfico aparece assim que tivermos mais dias de histórico.</p>`; return; }
  fig.innerHTML = '<svg role="img" aria-label="Gráfico do histórico de preço"></svg>';
  const s = fig.firstChild;
  const draw = () => {
    const W = s.clientWidth, H = s.clientHeight, ml = 8, mr = W < 420 ? 96 : 112, mt = 16, mb = 28;
    const lo = menor === maior ? menor * .9 : menor - (maior - menor) * .15, hi = menor === maior ? maior * 1.1 : maior + (maior - menor) * .15;
    const x = i => ml + i / (serie.length - 1) * (W - ml - mr), y = v => mt + (hi - v) / (hi - lo) * (H - mt - mb);
    const linha = serie.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[1]).toFixed(1)}`).join('');
    const u = serie.length - 1;
    s.innerHTML = `<path d="${linha}L${x(u)},${H - mb}L${x(0)},${H - mb}Z" fill="var(--blue)" opacity=".12"/>
      <line x1="${ml}" x2="${W - mr}" y1="${y(menor)}" y2="${y(menor)}" stroke="#0b7a3b" stroke-dasharray="4 4"/>
      <text x="${W - mr + 8}" y="${y(menor) + 4}">menor ${brl(menor).replace('R$', '').trim()}</text>
      <path d="${linha}" fill="none" stroke="var(--blue)" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="${x(u)}" cy="${y(serie[u][1])}" r="5" fill="var(--blue)" stroke="var(--card)" stroke-width="2"/>
      ${Math.abs(y(serie[u][1]) - y(menor)) > 16 ? `<text x="${W - mr + 8}" y="${y(serie[u][1]) + 4}" style="fill:var(--ink);font-weight:600">hoje</text>` : ''}
      <text x="${ml}" y="${H - 8}">${dm(serie[0][0])}</text><text x="${W - mr}" y="${H - 8}" text-anchor="end">${dm(serie[u][0])}</text>`;
  };
  new ResizeObserver(draw).observe(s);
}

/* ---------- roteador ---------- */
function rota() {
  limparTimers(); fecharSugg();
  if (obsBuy) { removeEventListener('scroll', obsBuy); obsBuy = null; }
  $('buybar').classList.remove('on'); document.body.classList.remove('has-buybar');
  const ps = new URLSearchParams(location.search);
  const id = ps.get('p') || ps.get('oferta');
  if (ps.get('oferta')) history.replaceState(null, '', qs({p:id}));
  if (id) viewProduto(id);
  else if (ps.get('cat') || ps.get('q') || ps.get('ver') || ps.get('marca') || ps.get('max')) viewLista(ps);
  else viewHome();
  $('q').value = ps.get('q') || '';
  const atual = id ? null : ps.get('cat') ? 'cat:' + ps.get('cat') : ps.get('ver') ? 'ver:' + ps.get('ver') : ps.toString() ? null : 'home';
  document.querySelectorAll('#nav a').forEach(a => { if (a.dataset.k === atual) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  fallbackImgs($('view'));
}
function ir(url) { history.pushState(null, '', url); rota(); scrollTo(0, 0); $('view').focus({preventScroll:true}); }
addEventListener('popstate', rota);
document.addEventListener('click', e => {
  const fv = e.target.closest('[data-fav]'); if (fv) { e.preventDefault(); alternarFav(fv.dataset.fav); return; }
  const by = e.target.closest('[data-buy]'); if (by) evento('c', by.dataset.buy);
  const a = e.target.closest('a[data-nav]');
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); ir(a.getAttribute('href')); return; }
  const pv = e.target.closest('[data-prev]'), nx = e.target.closest('[data-next]');
  if (pv || nx) { const r = $((pv || nx).dataset.prev || (pv || nx).dataset.next); r.scrollBy({left: (pv ? -1 : 1) * r.clientWidth * .85, behavior:'smooth'}); }
  const sh = e.target.closest('[data-share]'); if (sh) compartilhar(sh.dataset.share);
});

/* ---------- busca com sugestões ---------- */
const sugg = $('sugg'); let sel = -1;
function fecharSugg() { sugg.hidden = true; sel = -1; }
$('q').addEventListener('input', () => {
  const bruto = $('q').value.trim(), q = norm(bruto); sel = -1;
  if (q.length < 2) return fecharSugg();
  const ws = q.split(/\s+/);
  const cats = CATS.filter(c => norm(c.nome).includes(q)).slice(0, 3);
  const marcas = MARCAS.filter(m => norm(m.nome).includes(q)).slice(0, 2);
  const prods = P.filter(p => ws.every(w => norm(p.titulo + ' ' + p.categoria + ' ' + (p.marca || '')).includes(w))).sort(porDesc).slice(0, 6);
  if (!cats.length && !marcas.length && !prods.length) { sugg.innerHTML = `<a href="${esc(qs({q:bruto}))}" data-nav role="option">Buscar “${esc(bruto)}”</a>`; sugg.hidden = false; return; }
  sugg.innerHTML = cats.map(c => `<a href="${esc(qs({cat:c.nome}))}" data-nav role="option"><span class="th" style="background:${estilo(c.nome).bg}">${icone(c.nome)}</span><span class="cat">${esc(c.nome)}<small>${c.n} ofertas na categoria</small></span></a>`).join('')
    + marcas.map(m => `<a href="${esc(qs({marca:m.nome}))}" data-nav role="option"><span class="th" style="font:800 italic 14px var(--disp)">${esc(m.nome.slice(0, 3).toUpperCase())}</span><span class="cat">${esc(m.nome)}<small>${m.n} ofertas da marca</small></span></a>`).join('')
    + prods.map(p => { const f = seguro(p.foto); return `<a href="?p=${encodeURIComponent(p.id)}" data-nav role="option"><span class="th">${f ? `<img src="${esc(f)}" alt="" referrerpolicy="no-referrer">` : icone(p.categoria)}</span><span>${esc(p.titulo)}<small>${brl(p.preco)} · -${p.desconto}%</small></span></a>`; }).join('');
  sugg.hidden = false;
});
$('q').addEventListener('keydown', e => {
  const itens = [...sugg.querySelectorAll('a')]; if (sugg.hidden || !itens.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length; itens.forEach((a, i) => a.classList.toggle('on', i === sel)); }
  else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); ir(itens[sel].getAttribute('href')); $('q').blur(); }
  else if (e.key === 'Escape') fecharSugg();
});
document.addEventListener('click', e => { if (!e.target.closest('.sbox')) fecharSugg(); });
$('sf').addEventListener('submit', e => { e.preventDefault(); const q = $('q').value.trim(); if (q) ir(qs({q})); $('q').blur(); });

/* ---------- compartilhar, avisos, topo ---------- */
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2000); }
async function compartilhar(id) {
  const p = byId.get(id); if (!p) return;
  const url = location.origin + location.pathname + '?p=' + encodeURIComponent(id);
  const texto = `${p.titulo} por ${brl(p.preco)} (-${p.desconto}%) no Baixou`;
  if (navigator.share) { try { await navigator.share({title:'Baixou', text:texto, url}); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(texto + ' ' + url); toast('Link da oferta copiado'); }
  catch (e) { window.open('https://wa.me/?text=' + encodeURIComponent(texto + ' ' + url), '_blank', 'noopener'); }
}
const AVISOS = ['Preços conferidos a cada 15 minutos', 'Só desconto de verdade, comparado com o histórico', 'Compra segura direto no Mercado Livre'];
if (!reduz) { let k = 0; setInterval(() => { if (!document.hidden) $('ann').textContent = AVISOS[k = (k + 1) % AVISOS.length]; }, 4500); }
$('up').addEventListener('click', () => scrollTo({top:0, behavior:'smooth'}));
addEventListener('scroll', () => $('up').classList.toggle('on', scrollY > 900), {passive:true});

/* ---------- carregar ---------- */
$('view').innerHTML = `<div class="wrap" style="padding-block:24px"><div class="grid">${Array.from({length:8}, () => '<div class="sk" aria-hidden="true"></div>').join('')}</div></div>`;
const opcional = u => fetch(u, {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null);
Promise.all([
  fetch('data/ofertas.json', {cache:'no-store'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  opcional('data/relacionados.json'), opcional('data/contador.json'),
]).then(([d, rel, cont]) => {
  P = (d.ofertas || []).filter(p => p && p.titulo && p.preco > 0).map(p => ({...p, id:String(p.id), desconto:Number(p.desconto) || 0, parcelas:Number(p.parcelas) || 0}));
  byId = new Map(P.map(p => [p.id, p]));
  if (rel && typeof rel === 'object') { REL = {quem_viu: rel.quem_viu || {}, populares: Array.isArray(rel.populares) ? rel.populares : []}; POP = new Map(REL.populares.map(x => [String(x.id), x])); }
  if (cont && /^https:\/\/[a-z0-9.-]+\.workers\.dev$/i.test(String(cont.url || ''))) CONTADOR = cont.url;
  const cont1 = {}, cont2 = {};
  P.forEach(p => { cont1[p.categoria] = (cont1[p.categoria] || 0) + 1; if (p.marca) cont2[p.marca] = (cont2[p.marca] || 0) + 1; });
  CATS = Object.entries(cont1).map(([nome, n]) => ({nome, n})).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  MARCAS = Object.entries(cont2).map(([nome, n]) => ({nome, n})).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, 'pt-BR'));
  $('nav').innerHTML = `<a href="./" data-nav data-k="home">Destaques</a><a class="hot" href="?ver=menor" data-nav data-k="ver:menor">Menor preço</a><a href="?ver=novas" data-nav data-k="ver:novas">Acabou de baixar</a>` + CATS.map(c => `<a href="${esc(qs({cat:c.nome}))}" data-nav data-k="cat:${esc(c.nome)}">${esc(c.nome)}</a>`).join('');
  if (d.modo === 'demonstração') $('demo').hidden = false;
  contarFavs(); rota();
}).catch(() => { $('view').innerHTML = '<div class="wrap" style="padding-block:40px"><div class="empty"><strong>Não foi possível carregar as ofertas</strong><p>Tente recarregar a página em instantes.</p></div></div>'; });
}
