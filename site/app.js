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
      <span class="meta">${p.frete_gratis ? '<span class="ship">Frete grátis</span>' : ''}${p.full ? '<span class="full"><svg class="bolt" viewBox="0 0 12 16" aria-hidden="true"><path d="M7 0L0 9h5l-1 7 7-9H6z" fill="currentColor"/></svg>FULL</span>' : ''}${opts.pop && pop && pop.c ? `<span class="pop">${pop.c} ${pop.c === 1 ? 'pessoa foi' : 'pessoas foram'} à loja hoje</span>` : ''}</span>
    </div></a></article>`;
}
function fallbackImgs(root) {
  for (const img of root.querySelectorAll('.pic img, .plate img, .fa-foto img, .bub img')) img.addEventListener('error', () => {
    const a = img.closest('a'); const id = a && new URLSearchParams((a.getAttribute('href') || '').replace(/^.*\?/, '')).get('p');
    const p = byId.get(id);
    img.outerHTML = img.closest('.plate, .fa-foto, .bub') ? icone(p ? p.categoria : '') : `<span class="ph">${icone(p ? p.categoria : '', '#8b90a1')}</span>`;
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
  h += `<section class="sec wrap" aria-labelledby="cats-t"><div class="sec-head"><h2 id="cats-t">Compre por categoria</h2></div><div class="tiles">${CATS.map(c => { const e = estilo(c.nome); return `<a class="tile" href="${esc(qs({cat:c.nome}))}" data-nav style="background:${e.bg}">${bolha(c.nome)}<b>${esc(c.nome)}</b><small>${c.n} ${c.n === 1 ? 'oferta' : 'ofertas'}</small></a>`; }).join('')}</div></section>`;
  if (vis.length) h += rail('r-vistos', 'Vistos recentemente', vis.slice(0, 12), '', '', 'Continue de onde parou');
  if (cs.menor) h += rail('r-menor', 'Menor preço em 30 dias', cs.menor.itens.slice(0, 14), '?ver=menor', 'Ver todas', 'O preço mais baixo que registramos no mês');
  topCats.forEach((c, i) => { h += rail('r-cat' + i, `Destaques em ${c.nome}`, P.filter(p => p.categoria === c.nome).sort(porDesc).slice(0, 14), qs({cat:c.nome})); });
  h += rail('r-desc', 'Maiores descontos', [...P].sort(porDesc).slice(0, 14), '?ver=descontos');
  h += `<section class="sec wrap" aria-labelledby="all-t"><div class="sec-head"><h2 id="all-t">Todas as ofertas</h2><div class="arrows"><a href="?ver=todas" data-nav>Ver as ${P.length}</a></div></div><div class="grid">${[...P].sort(porNovo).slice(0, 10).map(p => card(p)).join('')}</div>
    <div class="more"><a class="btn2" href="?ver=todas" data-nav>Ver todas as ofertas</a></div></section>`;
  $('view').innerHTML = h;
  heroInit(); railAuto('r-novas');
}

/* ---------- listagem com filtros ---------- */
const VITRINES = {
  todas: {t:'Todas as ofertas', d:'Tudo o que está em promoção agora.'},
  novas: {t:'Acabou de baixar', d:'As ofertas mais recentes primeiro.', sort:'new'},
  descontos: {t:'Maiores descontos', d:'Ordenado pelo maior desconto.', sort:'disc'},
  menor: {t:'Menor preço em 30 dias', d:'Produtos no preço mais baixo que registramos no último mês.', low:true},
  full: {t:'Frete grátis + Full', d:'Saem do estoque do Mercado Livre, com envio expresso.', full:true, frete:true},
  favoritos: {t:'Meus favoritos', d:'Salvos neste aparelho. Toque no coração de qualquer oferta para guardar aqui.', fav:true},
};
const FAIXAS = [['ate50', 'Até R$ 50', 0, 50], ['50-100', 'R$ 50 a R$ 100', 50, 100], ['100-200', 'R$ 100 a R$ 200', 100, 200], ['200-500', 'R$ 200 a R$ 500', 200, 500], ['500+', 'Acima de R$ 500', 500, Infinity]];
const DESCONTOS = [20, 30, 40, 50];
const PAGE = 24;
const irParaLista = () => { const g = $('grid'); if (g) scrollTo({top: g.getBoundingClientRect().top + scrollY - (desktop.matches ? 170 : 70), behavior: reduz ? 'auto' : 'smooth'}); };
function paginador(atual, total) {
  if (total <= 1) return '';
  const nums = [...new Set([1, 2, atual - 1, atual, atual + 1, total - 1, total])].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  let h = `<button type="button" class="pg-nav" data-pg="${atual - 1}"${atual === 1 ? ' disabled' : ''}>‹ Anterior</button><span class="pg-nums">`, ant = 0;
  for (const n of nums) { if (n - ant > 1) h += '<span class="pg-gap">…</span>'; h += `<button type="button" data-pg="${n}"${n === atual ? ' aria-current="page"' : ''} aria-label="Página ${n}">${n}</button>`; ant = n; }
  return h + `</span><button type="button" class="pg-nav" data-pg="${atual + 1}"${atual === total ? ' disabled' : ''}>Seguinte ›</button>`;
}
let L = null;
const naFaixa = (p, f) => f[2] === 0 ? p.preco <= f[3] : p.preco > f[2] && p.preco <= f[3];
const lista = v => (v || '').split(',').map(s => s.trim()).filter(Boolean);
function viewLista(ps) {
  let ver = VITRINES[ps.get('ver')] ? ps.get('ver') : '';
  const temAlgo = ['cat', 'q', 'marca', 'sub', 'max', 'min', 'preco', 'desc', 'frete', 'full', 'menor'].some(k => ps.get(k));
  if (!ver && !temAlgo) ver = 'todas';
  const v = VITRINES[ver] || {};
  const max = /^\d+$/.test(ps.get('max') || '') ? ps.get('max') : '';
  const min = /^\d+$/.test(ps.get('min') || '') ? ps.get('min') : '';
  L = {
    ver, fav: !!v.fav, q: ps.get('q') || '', catFixa: ps.get('cat') || '',
    cats: new Set(), subs: new Set(lista(ps.get('sub'))), marcas: new Set(lista(ps.get('marca'))),
    faixa: FAIXAS.some(f => f[0] === ps.get('preco')) ? ps.get('preco') : '', min, max,
    disc: DESCONTOS.includes(+ps.get('desc')) ? +ps.get('desc') : 0,
    frete: !!v.frete || ps.get('frete') === '1', full: !!v.full || ps.get('full') === '1', low: !!v.low || ps.get('menor') === '1',
    sort: ['new', 'disc', 'low', 'high'].includes(ps.get('ordem')) ? ps.get('ordem') : v.sort || (ps.get('q') ? 'disc' : 'new'),
    pagina: Math.max(1, parseInt(ps.get('pagina'), 10) || 1), ui: {open: new Set(['sub', 'marca', 'preco', 'entrega']), more: new Set(), mq: ''},
  };
  if (L.catFixa && !CATS.some(c => c.nome === L.catFixa)) L.catFixa = '';
  if (!L.catFixa) L.ui.open.add('cat');
  const marcaUnica = !L.catFixa && !L.q && L.marcas.size === 1 && !ver ? [...L.marcas][0] : '';
  const titulo = L.q ? `“${L.q}”` : L.catFixa || marcaUnica || (max && !ver && !min ? `Tudo até R$ ${max}` : v.t || 'Ofertas');
  const desc = L.q ? 'Resultados da busca' : L.catFixa ? `Ofertas selecionadas em ${L.catFixa.toLowerCase()}.` : marcaUnica ? `Ofertas da marca ${marcaUnica}.` : (max && !ver ? 'Ofertas que cabem no bolso.' : v.d || '');
  document.title = `${L.q ? 'Busca: ' + L.q : titulo} | Baixou`;
  $('view').innerHTML = `<div class="lhead"><div class="wrap"><div class="crumbs"><a href="./" data-nav>Início</a> › ${esc(L.q ? 'Busca' : titulo)}</div><h1>${esc(titulo)}</h1>${desc ? `<p>${esc(desc)}</p>` : ''}</div></div>
  <div class="wrap lmain">
    <aside id="faside" aria-label="Filtros"><div class="fp-head"><b>Filtrar</b><button type="button" data-fclose aria-label="Fechar filtros">×</button></div><div class="fpanel" id="fpanel"></div><div class="fp-foot"><button class="lim" type="button" data-flimpar>Limpar</button><button class="ver" type="button" data-fclose id="fver">Ver ofertas</button></div></aside>
    <section aria-live="polite">
      <div class="fbar"><button type="button" id="fopen">Filtrar <em id="fcount" hidden></em></button><select id="sort2" aria-label="Ordenar"><option value="new">Mais recentes</option><option value="disc">Maior desconto</option><option value="low">Menor preço</option><option value="high">Maior preço</option></select></div>
      <div class="bar"><b id="cnt"></b><label for="sort">Ordenar <select id="sort"><option value="new">Mais recentes</option><option value="disc">Maior desconto</option><option value="low">Menor preço</option><option value="high">Maior preço</option></select></label></div>
      <div class="active" id="active"></div><div class="grid" id="grid"></div>
      <nav class="pager" id="pager" aria-label="Páginas"></nav><p class="pg-info" id="moret"></p>
    </section></div>`;
  $('sort').value = $('sort2').value = L.sort;
  const ordenar = e => { L.sort = e.target.value; $('sort').value = $('sort2').value = L.sort; listar(); };
  $('sort').addEventListener('change', ordenar); $('sort2').addEventListener('change', ordenar);
  $('pager').addEventListener('click', e => { const b = e.target.closest('[data-pg]'); if (!b || b.disabled) return; L.pagina = +b.dataset.pg; listar(false); irParaLista(); });
  $('fopen').addEventListener('click', () => abrirFiltros(true));
  const fp = $('fpanel');
  fp.addEventListener('change', e => {
    const t = e.target, f = t.dataset.f; if (!f) return;
    if (f === 'cats' || f === 'subs' || f === 'marcas') { t.checked ? L[f].add(t.value) : L[f].delete(t.value); }
    else if (f === 'faixa') { L.faixa = t.checked ? t.value : ''; L.min = L.max = ''; }
    else if (f === 'disc') L.disc = +t.value;
    else L[f] = t.checked;
    listar();
  });
  fp.addEventListener('click', e => {
    const m = e.target.closest('[data-fmais]'); if (m) { const k = m.dataset.fmais; L.ui.more.has(k) ? L.ui.more.delete(k) : L.ui.more.add(k); painel(); }
    if (e.target.closest('[data-faplicar]')) { L.min = $('fmin').value.replace(/\D/g, ''); L.max = $('fmax').value.replace(/\D/g, ''); L.faixa = ''; listar(); }
  });
  fp.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.k) d.open ? L.ui.open.add(d.dataset.k) : L.ui.open.delete(d.dataset.k); }, true);
  fp.addEventListener('input', e => { if (e.target.id !== 'fmq') return; L.ui.mq = e.target.value; const q = norm(L.ui.mq);
    fp.querySelectorAll('[data-mopt]').forEach(o => o.hidden = q ? !norm(o.dataset.mopt).includes(q) : o.dataset.extra === '1' && !L.ui.more.has('marcas')); });
  $('faside').addEventListener('click', e => { if (e.target.closest('[data-fclose]')) abrirFiltros(false); if (e.target.closest('[data-flimpar]')) limparFiltros(); });
  $('active').addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (!b) return; const [k, val] = b.dataset.x.split('|');
    if (k === 'tudo') return limparFiltros();
    if (k === 'cats' || k === 'subs' || k === 'marcas') L[k].delete(val);
    else if (k === 'preco') { L.faixa = ''; L.min = L.max = ''; }
    else if (k === 'disc') L.disc = 0;
    else L[k] = false;
    listar(); });
  listar(false);
}
function abrirFiltros(on) {
  $('faside').classList.toggle('open', on); $('scrim').hidden = !on;
  requestAnimationFrame(() => $('scrim').classList.toggle('on', on));
  document.body.style.overflow = on ? 'hidden' : '';
}
function limparFiltros() {
  Object.assign(L, {faixa:'', min:'', max:'', disc:0, frete:false, full:false, low:false});
  L.cats.clear(); L.subs.clear(); L.marcas.clear(); L.ui.mq = '';
  listar();
}
/* Cada filtro conta as ofertas considerando todos os OUTROS filtros (contagem facetada). */
function passa(p, sem) {
  const q = norm(L.q.trim()), fv = L.fav ? favs() : null;
  if (q && !q.split(/\s+/).every(w => norm(`${p.titulo} ${p.categoria} ${p.subcategoria || ''} ${p.marca || ''}`).includes(w))) return false;
  if (L.catFixa && p.categoria !== L.catFixa) return false;
  if (fv && !fv.has(p.id)) return false;
  if (sem !== 'cats' && L.cats.size && !L.cats.has(p.categoria)) return false;
  if (sem !== 'subs' && L.subs.size && !L.subs.has(p.subcategoria)) return false;
  if (sem !== 'marcas' && L.marcas.size && !L.marcas.has(p.marca)) return false;
  if (sem !== 'faixa') {
    const f = FAIXAS.find(x => x[0] === L.faixa);
    if (f && !naFaixa(p, f)) return false;
    if (L.min !== '' && p.preco < +L.min) return false;
    if (L.max !== '' && p.preco > +L.max) return false;
  }
  if (sem !== 'disc' && p.desconto < L.disc) return false;
  if (sem !== 'frete' && L.frete && !p.frete_gratis) return false;
  if (sem !== 'full' && L.full && !p.full) return false;
  if (sem !== 'low' && L.low && !p.menor_30d) return false;
  return true;
}
function contar(sem, chave) { const c = new Map(); for (const p of P) if (passa(p, sem)) { const k = chave(p); if (k) c.set(k, (c.get(k) || 0) + 1); } return c; }
function opcoes(f, itens, limite) {
  const mais = L.ui.more.has(f);
  return itens.map(([val, n], i) => { const sel = L[f].has(val), extra = i >= limite && !sel;
    return `<label class="fopt${n ? '' : ' zero'}"${f === 'marcas' ? ` data-mopt="${esc(val)}" data-extra="${extra ? 1 : 0}"` : ''}${extra && !mais ? ' hidden' : ''}><input type="checkbox" data-f="${f}" value="${esc(val)}"${sel ? ' checked' : ''}><span>${esc(val)}</span><small>${n}</small></label>`; }).join('')
    + (itens.length > limite ? `<button class="fmore" type="button" data-fmais="${f}">${mais ? 'Ver menos' : `Ver mais (${itens.length - limite})`}</button>` : '');
}
function faceta(k, titulo, corpo, ativos) {
  return `<details class="facet" data-k="${k}"${L.ui.open.has(k) || ativos ? ' open' : ''}><summary>${esc(titulo)}${ativos ? `<em>${ativos}</em>` : ''}</summary><div class="fopts">${corpo}</div></details>`;
}
function painel() {
  const ord = (m, sel) => [...m.entries()].sort((a, b) => (sel.has(b[0]) - sel.has(a[0])) || b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  const comSel = (m, sel) => { for (const s of sel) if (!m.has(s)) m.set(s, 0); return m; };
  let h = '';
  if (!L.catFixa) h += faceta('cat', 'Categoria', opcoes('cats', ord(comSel(contar('cats', p => p.categoria), L.cats), L.cats), 8), L.cats.size);
  const subs = ord(comSel(contar('subs', p => p.subcategoria), L.subs), L.subs);
  if (subs.length) h += faceta('sub', L.catFixa ? `Tipo de produto` : 'Subcategoria', opcoes('subs', subs, 8), L.subs.size);
  const marcas = ord(comSel(contar('marcas', p => p.marca), L.marcas), L.marcas);
  if (marcas.length) h += faceta('marca', 'Marca', `${marcas.length > 8 ? `<input class="fsearch" id="fmq" type="search" placeholder="Buscar marca" aria-label="Buscar marca" value="${esc(L.ui.mq)}">` : ''}${opcoes('marcas', marcas, 8)}`, L.marcas.size);
  const cf = contar('faixa', p => FAIXAS.find(f => naFaixa(p, f))?.[0]);
  h += faceta('preco', 'Preço', FAIXAS.map(([k, l]) => `<label class="fopt${cf.get(k) ? '' : ' zero'}"><input type="checkbox" data-f="faixa" value="${k}"${L.faixa === k ? ' checked' : ''}><span>${l}</span><small>${cf.get(k) || 0}</small></label>`).join('')
    + `<div class="fprice"><input id="fmin" inputmode="numeric" placeholder="Mín." aria-label="Preço mínimo" value="${esc(L.min)}"><input id="fmax" inputmode="numeric" placeholder="Máx." aria-label="Preço máximo" value="${esc(L.max)}"><button type="button" data-faplicar>Ok</button></div>`, L.faixa || L.min || L.max ? 1 : 0);
  const cd = DESCONTOS.map(d => [d, P.filter(p => passa(p, 'disc') && p.desconto >= d).length]);
  h += faceta('disc', 'Desconto', `<label class="fopt"><input type="radio" name="fdisc" data-f="disc" value="0"${L.disc ? '' : ' checked'}><span>Qualquer desconto</span></label>` + cd.map(([d, n]) => `<label class="fopt${n ? '' : ' zero'}"><input type="radio" name="fdisc" data-f="disc" value="${d}"${L.disc === d ? ' checked' : ''}><span>${d}% ou mais</span><small>${n}</small></label>`).join(''), L.disc ? 1 : 0);
  const nb = (f, fn) => P.filter(p => passa(p, f) && fn(p)).length;
  h += faceta('entrega', 'Entrega e preço', [['frete', 'Frete grátis', p => p.frete_gratis], ['full', 'Entrega Full', p => p.full], ['low', 'Menor preço em 30 dias', p => p.menor_30d]]
    .map(([f, l, fn]) => { const n = nb(f, fn); return `<label class="fopt${n ? '' : ' zero'}"><input type="checkbox" data-f="${f}"${L[f] ? ' checked' : ''}><span>${l}</span><small>${n}</small></label>`; }).join(''), [L.frete, L.full, L.low].filter(Boolean).length);
  h += faceta('loja', 'Loja', `<label class="fopt"><input type="checkbox" checked disabled><span><span class="pill">Mercado Livre</span></span></label><label class="fopt zero"><input type="checkbox" disabled><span>Amazon</span><small>em breve</small></label><label class="fopt zero"><input type="checkbox" disabled><span>Shopee</span><small>em breve</small></label>`, 0);
  const fp = $('fpanel'), y = fp.scrollTop, foco = document.activeElement && document.activeElement.id === 'fmq';
  fp.innerHTML = h; fp.scrollTop = y;
  if (foco) { const i = $('fmq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  if (L.ui.mq) $('fmq')?.dispatchEvent(new Event('input', {bubbles:true}));
}
function syncLista() {
  const u = {cat:L.catFixa, q:L.q, ver:L.ver !== 'todas' ? L.ver : '', sub:[...L.subs].join(','), marca:[...L.marcas].join(','), preco:L.faixa, min:L.min, max:L.max, desc:L.disc || '',
    frete: L.frete && !VITRINES[L.ver]?.frete ? 1 : '', full: L.full && !VITRINES[L.ver]?.full ? 1 : '', menor: L.low && !VITRINES[L.ver]?.low ? 1 : '', ordem: L.sort !== (VITRINES[L.ver]?.sort || (L.q ? 'disc' : 'new')) ? L.sort : '', pagina: L.pagina > 1 ? L.pagina : ''};
  const url = qs(u); try { history.replaceState(null, '', url === './' ? '?ver=todas' : url); } catch (e) {}
}
function listar(reset = true) {
  if (reset) L.pagina = 1;
  const by = {disc:porDesc, low:(a, b) => a.preco - b.preco, high:(a, b) => b.preco - a.preco, new:porNovo}[L.sort];
  const r = P.filter(p => passa(p, '')).sort(by), paginas = Math.max(1, Math.ceil(r.length / PAGE));
  L.pagina = Math.min(L.pagina, paginas);
  const ini = (L.pagina - 1) * PAGE, vis = r.slice(ini, ini + PAGE);
  $('cnt').textContent = r.length + (r.length === 1 ? ' oferta' : ' ofertas');
  $('fver').textContent = `Ver ${r.length} ${r.length === 1 ? 'oferta' : 'ofertas'}`;
  $('grid').innerHTML = vis.length ? comAnuncios(vis, r.length) : L.fav && !favs().size
    ? `<div class="empty"><strong>Nenhum favorito ainda</strong><p>Toque no coração de uma oferta para salvá-la aqui.</p><a class="btn2" href="./" data-nav>Ver ofertas</a></div>`
    : `<div class="empty"><strong>Nenhuma oferta com esses filtros</strong><p>Tire algum filtro ou tente outra busca.</p><button class="btn2" type="button" data-x="tudo">Limpar filtros</button></div>`;
  fallbackImgs($('grid'));
  $('pager').innerHTML = paginador(L.pagina, paginas);
  $('moret').textContent = r.length > PAGE ? `Mostrando ${ini + 1}–${ini + vis.length} de ${r.length} ofertas` : '';
  const a = [];
  L.cats.forEach(c => a.push(['cats|' + c, c]));
  L.subs.forEach(c => a.push(['subs|' + c, c]));
  L.marcas.forEach(c => a.push(['marcas|' + c, c]));
  const f = FAIXAS.find(x => x[0] === L.faixa);
  if (f) a.push(['preco', f[1]]); else if (L.min || L.max) a.push(['preco', L.min && L.max ? `${brl0(L.min)} a ${brl0(L.max)}` : L.min ? `A partir de ${brl0(L.min)}` : `Até ${brl0(L.max)}`]);
  if (L.disc) a.push(['disc', `${L.disc}% ou mais`]);
  if (L.frete) a.push(['frete', 'Frete grátis']);
  if (L.full) a.push(['full', 'Entrega Full']);
  if (L.low) a.push(['low', 'Menor preço em 30 dias']);
  $('active').innerHTML = a.map(([k, l]) => `<button type="button" data-x="${esc(k)}" aria-label="Remover filtro ${esc(l)}">${esc(l)} <span aria-hidden="true">×</span></button>`).join('') + (a.length > 1 ? '<button class="clear" type="button" data-x="tudo">Limpar tudo</button>' : '');
  $('fcount').textContent = a.length; $('fcount').hidden = !a.length;
  painel(); syncLista();
}

/* ---------- anúncios do próprio Baixou no meio da listagem ---------- */
// Categorias que combinam entre si (para sugerir "leve também")
const COMBINA = [
  [/beleza|perfum/, /moda|calcad|esporte/], [/moda|calcad/, /beleza|esporte/], [/esporte|fitness/, /moda|calcad|eletronic/],
  [/celular/, /eletronic|informatica/], [/informatica/, /eletronic|celular|game/], [/eletronic|audio|tv/, /celular|game|informatica/],
  [/game/, /eletronic|informatica|tv/], [/eletrodom/, /casa|decora/], [/casa|decora/, /eletrodom|ferrament/],
  [/ferrament/, /casa|decora/], [/bebe/, /brinquedo|casa/], [/brinquedo/, /bebe|game/],
];
const combinaCom = cat => { const n = norm(cat); const par = COMBINA.find(([a]) => a.test(n)); return par ? CATS.filter(c => c.nome !== cat && par[1].test(norm(c.nome)) && c.n >= 3).map(c => c.nome) : []; };
const CORES_AD = ['s-blue', 's-green', 's-black', 's-red', 's-yel'];
function adHTML(a, i) {
  return `<section class="feedad ${CORES_AD[i % CORES_AD.length]}" aria-label="${esc(a.titulo)}">
    <div class="fa-txt"><span class="kick">${esc(a.kick)}</span><h3>${esc(a.titulo)}</h3>${a.sub ? `<p>${esc(a.sub)}</p>` : ''}<a class="cta" href="${esc(a.href)}" data-nav>${esc(a.cta || 'Ver ofertas')} →</a></div>
    <div class="fa-itens">${a.itens.slice(0, 3).map(p => { const f = seguro(p.foto); return `<a href="?p=${encodeURIComponent(p.id)}" data-nav aria-label="${esc(p.titulo)} por ${brl(p.preco)}"><span class="fa-foto">${f ? `<img src="${esc(f)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : icone(p.categoria)}</span><b>${brl0(p.preco)}</b><i>-${p.desconto}%</i></a>`; }).join('')}</div></section>`;
}
function anunciosFeed(resultado) {
  const ads = [], noFeed = new Set(resultado.slice(0, 8).map(p => p.id)), fora = p => !noFeed.has(p.id);
  const freq = {}; resultado.forEach(p => freq[p.categoria] = (freq[p.categoria] || 0) + 1);
  const catBase = L.catFixa || Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  // 1. Leve também: categoria que combina com o que a pessoa está vendo
  combinaCom(catBase).forEach(c => { const it = P.filter(p => p.categoria === c && fora(p)).sort(porDesc);
    if (it.length >= 3) ads.push({kick:`Combina com ${catBase.toLowerCase()}`, titulo:`Leve também: ${c}`, sub:`Até ${it[0].desconto}% off em ${c.toLowerCase()} agora.`, href:qs({cat:c}), cta:`Ver ${c.toLowerCase()}`, itens:it}); });
  // 2. Continue de onde parou (vistos recentemente)
  const vis = vistos().filter(fora);
  if (vis.length >= 2) ads.push({kick:'Vistos recentemente', titulo:'Ainda pensando nestes?', sub:'Os preços continuam sendo conferidos a cada 15 minutos.', href:'?ver=todas', cta:'Continuar vendo', itens:vis});
  // 3. Campanhas do momento (menor preço, frete, até R$ 100, outras categorias)
  const menor = P.filter(p => p.menor_30d && fora(p)).sort(porDesc);
  if (menor.length >= 3 && L.ver !== 'menor' && !L.low) ads.push({kick:'Comparado com o histórico', titulo:'Menor preço em 30 dias', sub:`${menor.length} produtos no preço mais baixo do mês.`, href:'?ver=menor', itens:menor});
  const ate = P.filter(p => p.preco <= 100 && fora(p)).sort(porDesc);
  if (ate.length >= 3 && !(L.max && +L.max <= 100)) ads.push({kick:'Cabe no bolso', titulo:'Tudo até R$ 100', sub:'Pequenos presentes e reposições com desconto de verdade.', href:qs({max:100}), itens:ate});
  const full = P.filter(p => p.full && p.frete_gratis && fora(p)).sort(porDesc);
  if (full.length >= 3 && !L.full) ads.push({kick:'Chega rápido', titulo:'Frete grátis + Full', sub:'Sai do estoque do Mercado Livre, com envio expresso.', href:'?ver=full', itens:full});
  // 4. Favoritos salvos
  const fv = [...favs()].map(id => byId.get(id)).filter(Boolean).filter(fora);
  if (fv.length && !L.fav) ads.push({kick:'Seus favoritos', titulo:`Você salvou ${fv.length} ${fv.length === 1 ? 'oferta' : 'ofertas'}`, sub:'Confira se o preço continua bom antes que a promoção acabe.', href:'?ver=favoritos', cta:'Ver favoritos', itens:fv});
  return ads;
}
// Intercala um anúncio depois da 8ª oferta e depois a cada 12 (só quando há ofertas suficientes)
function comAnuncios(vis, total) {
  if (total < 10) return vis.map(p => card(p)).join('');
  const ads = anunciosFeed(vis);
  let h = '', k = 0;
  vis.forEach((p, i) => { h += card(p); const pos = i + 1; if (ads[k] && (pos === 8 || (pos > 8 && (pos - 8) % 12 === 0)) && pos < vis.length) h += adHTML(ads[k], k++); });
  return h;
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
      <div class="tags"><span class="pill">${esc(p.loja || 'Mercado Livre')}</span>${p.full ? '<span class="full"><svg class="bolt" viewBox="0 0 12 16" aria-hidden="true"><path d="M7 0L0 9h5l-1 7 7-9H6z" fill="currentColor"/></svg>Entrega FULL</span>' : ''}</div>
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

/* ---------- menu de categorias (painel no computador, gaveta no celular) ---------- */
const subsDe = cat => { const m = new Map(); P.forEach(p => { if (p.categoria === cat && p.subcategoria) m.set(p.subcategoria, (m.get(p.subcategoria) || 0) + 1); }); return [...m].sort((a, b) => b[1] - a[1]); };
const marcasDe = cat => { const m = new Map(); P.forEach(p => { if (p.categoria === cat && p.marca) m.set(p.marca, (m.get(p.marca) || 0) + 1); }); return [...m].sort((a, b) => b[1] - a[1]); };
const topDe = cat => P.filter(p => p.categoria === cat).sort(porDesc);
function bolha(cat) { const t = topDe(cat).find(p => seguro(p.foto)); return `<span class="bub">${t ? `<img src="${esc(seguro(t.foto))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : icone(cat)}</span>`; }
const ICON_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function montarMenus() {
  const top5 = [...CATS].sort((x, y) => y.n - x.n).slice(0, 4);
  $('nav').innerHTML = `<button class="all" type="button" id="allBtn" aria-expanded="false" aria-controls="mega"><i class="i-menu">${ICON_MENU}</i><i class="i-x">${ICON_X}</i><span>Todas as categorias</span></button><a class="hot" href="?ver=menor" data-nav data-k="ver:menor">Menor preço</a><a href="?ver=novas" data-nav data-k="ver:novas">Acabou de baixar</a>`
    + top5.map(c => `<a href="${esc(qs({cat:c.nome}))}" data-nav data-k="cat:${esc(c.nome)}" data-mega="${esc(c.nome)}">${esc(c.nome)}</a>`).join('');
  $('allBtn').addEventListener('click', () => megaAtual ? fecharMega(true) : abrirMega(top5[0]?.nome || CATS[0]?.nome));
  $('drawer').innerHTML = `<div class="dhead"><b>Baixou</b><button type="button" data-dclose aria-label="Fechar menu">×</button></div>
    <div class="dcards">${[...CATS].sort((x, y) => y.n - x.n).map(c => `<a class="mcard" href="${esc(qs({cat:c.nome}))}" data-nav>${bolha(c.nome)}${esc(c.nome)}</a>`).join('')}</div>
    <nav class="dlinks"><a href="./" data-nav>Destaques</a><a class="hot" href="?ver=menor" data-nav>Menor preço em 30 dias</a><a href="?ver=novas" data-nav>Acabou de baixar</a><a href="?ver=favoritos" data-nav>Meus favoritos</a><a href="?ver=todas" data-nav>Todas as ofertas</a></nav>
    ${CATS.map((c, i) => { const subs = subsDe(c.nome); return `<div class="dcat"><button type="button" aria-expanded="false" aria-controls="dsub${i}"><span>${esc(c.nome)}</span><i aria-hidden="true">+</i></button>
      <div class="dsub" id="dsub${i}" hidden>${subs.map(([s, n]) => `<a href="${esc(qs({cat:c.nome, sub:s}))}" data-nav>${esc(s)} <small>${n}</small></a>`).join('')}<a class="all" href="${esc(qs({cat:c.nome}))}" data-nav>Ver tudo de ${esc(c.nome)} <small>${c.n}</small></a></div></div>`; }).join('')}`;
  falhasDeFoto($('drawer'));
}
const falhasDeFoto = root => root.querySelectorAll('.bub img, .mbanner img').forEach(i => i.addEventListener('error', () => { i.outerHTML = icone(''); }, {once:true}));
let megaAtual = null, megaT = 0;
function colunas(cat) {
  const c = CATS.find(x => x.nome === cat); if (!c) return '';
  const subs = subsDe(cat).slice(0, 8), marcas = marcasDe(cat).slice(0, 9), itens = P.filter(p => p.categoria === cat);
  const faixas = [50, 100, 200, 500].map(m => [m, itens.filter(p => p.preco <= m).length]).filter(([, n]) => n);
  const top = topDe(cat)[0], f = top && seguro(top.foto);
  const nMenor = itens.filter(p => p.menor_30d).length, nFull = itens.filter(p => p.full && p.frete_gratis).length;
  return `<div class="mcols">
    <div class="mcol"><h4>${esc(cat)}</h4><ul class="mlist">${subs.map(([s]) => `<li><a href="${esc(qs({cat, sub:s}))}" data-nav>${esc(s)}</a></li>`).join('')}<li><a class="vt" href="${esc(qs({cat}))}" data-nav>Ver tudo de ${esc(cat)}</a></li></ul></div>
    <div class="mcol"><h4>Marcas</h4><ul class="mlist">${marcas.length ? marcas.map(([m]) => `<li><a href="${esc(qs({cat, marca:m}))}" data-nav>${esc(m)}</a></li>`).join('') : '<li><a href="' + esc(qs({cat})) + '" data-nav>Todas as marcas</a></li>'}</ul></div>
    <div class="mcol"><h4>Por preço</h4><ul class="mlist">${faixas.map(([m]) => `<li><a href="${esc(qs({cat, max:m}))}" data-nav>Até R$ ${m}</a></li>`).join('')}<li><a href="${esc(qs({cat, ordem:'low'}))}" data-nav>Menor preço primeiro</a></li></ul></div>
    <div class="mcol"><h4>Ofertas</h4><ul class="mlist">${nMenor ? `<li><a href="${esc(qs({cat, menor:1}))}" data-nav>Menor preço em 30 dias</a></li>` : ''}${nFull ? `<li><a href="${esc(qs({cat, full:1, frete:1}))}" data-nav>Frete grátis + Full</a></li>` : ''}<li><a href="${esc(qs({cat, desc:30}))}" data-nav>30% ou mais de desconto</a></li><li><a href="${esc(qs({cat, ordem:'disc'}))}" data-nav>Maiores descontos</a></li></ul></div>
    ${top ? `<a class="mbanner ${['s-green', 's-blue', 's-red', 's-black'][CATS.indexOf(c) % 4]}" href="${esc(qs({cat, ordem:'disc'}))}" data-nav><span class="bimg"><span>${f ? `<img src="${esc(f)}" alt="" referrerpolicy="no-referrer">` : icone(cat)}</span></span><b>Até ${Math.max(...itens.map(p => p.desconto))}% off</b><small>em ${esc(cat.toLowerCase())}</small><i>aproveite</i></a>` : ''}
  </div>`;
}
function abrirMega(cat) {
  clearTimeout(megaT);
  const m = $('mega');
  if (!megaAtual) {
    m.innerHTML = `<div class="wrap"><div class="mcards" role="list">${CATS.map(c => `<a class="mcard" role="listitem" href="${esc(qs({cat:c.nome}))}" data-nav data-sel="${esc(c.nome)}">${bolha(c.nome)}${esc(c.nome)}</a>`).join('')}</div><div id="mcols"></div></div>`;
    m.hidden = false; falhasDeFoto(m);
  }
  if (megaAtual !== cat) {
    megaAtual = cat;
    $('mcols').innerHTML = colunas(cat); falhasDeFoto($('mcols'));
    m.querySelectorAll('.mcard').forEach(a => a.setAttribute('aria-current', String(a.dataset.sel === cat)));
  }
  $('allBtn').setAttribute('aria-expanded', 'true');
  document.querySelectorAll('#nav [data-mega]').forEach(a => a.classList.toggle('open', a.dataset.mega === cat));
}
function fecharMega(ja) {
  clearTimeout(megaT);
  const f = () => { megaAtual = null; $('mega').hidden = true; $('mega').innerHTML = '';
    $('allBtn')?.setAttribute('aria-expanded', 'false');
    document.querySelectorAll('#nav [data-mega]').forEach(a => a.classList.remove('open')); };
  ja ? f() : (megaT = setTimeout(f, 220));
}
const desktop = matchMedia('(min-width: 901px)');
$('nav').addEventListener('pointerover', e => { if (!desktop.matches || e.pointerType === 'touch') return; const a = e.target.closest('[data-mega]'); clearTimeout(megaT); if (a) megaT = setTimeout(() => abrirMega(a.dataset.mega), megaAtual ? 60 : 160); });
$('nav').addEventListener('focusin', e => { const a = e.target.closest('[data-mega]'); if (a && desktop.matches) abrirMega(a.dataset.mega); });
$('mega').addEventListener('pointerover', e => { clearTimeout(megaT); const c = e.target.closest('[data-sel]'); if (c && e.pointerType !== 'touch') abrirMega(c.dataset.sel); });
$('mega').addEventListener('focusin', e => { const c = e.target.closest('[data-sel]'); if (c) abrirMega(c.dataset.sel); });
document.querySelector('header').addEventListener('pointerleave', () => { if (megaAtual) fecharMega(); });
document.querySelector('header').addEventListener('pointerenter', () => clearTimeout(megaT));
document.addEventListener('click', e => { if (megaAtual && !e.composedPath().some(el => el.tagName === 'HEADER')) fecharMega(true); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (megaAtual) { fecharMega(true); $('allBtn')?.focus(); } abrirDrawer(false); if ($('faside')) abrirFiltros(false); } });
document.addEventListener('focusin', e => { if (megaAtual && !e.target.closest('header')) fecharMega(true); });
function abrirDrawer(on) {
  const d = $('drawer'); if (!d || (!on && !d.classList.contains('open'))) return;
  d.classList.toggle('open', on); d.setAttribute('aria-hidden', String(!on)); on ? d.removeAttribute('inert') : d.setAttribute('inert', '');
  $('menuBtn').setAttribute('aria-expanded', String(on));
  $('scrim').hidden = !on && !$('faside')?.classList.contains('open');
  requestAnimationFrame(() => $('scrim').classList.toggle('on', on));
  document.body.style.overflow = on ? 'hidden' : '';
  if (on) d.querySelector('[data-dclose]')?.focus(); else $('menuBtn').focus({preventScroll:true});
}
$('menuBtn').addEventListener('click', () => abrirDrawer(true));
$('drawer').addEventListener('click', e => {
  if (e.target.closest('[data-dclose]')) return abrirDrawer(false);
  const b = e.target.closest('.dcat>button'); if (b) { const on = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(on)); $(b.getAttribute('aria-controls')).hidden = !on; }
});
$('scrim').addEventListener('click', () => { abrirDrawer(false); if ($('faside')) abrirFiltros(false); });

/* ---------- faixa promocional (montada com as ofertas do momento) ---------- */
let promoK = 0;
function montarPromo() {
  const nMenor = P.filter(p => p.menor_30d).length, nFrete = P.filter(p => p.frete_gratis).length, maxD = P.length ? Math.max(...P.map(p => p.desconto)) : 0;
  const msgs = [
    nMenor ? {h:`<b>Menor preço em 30 dias</b> em ${nMenor} ${nMenor === 1 ? 'produto' : 'produtos'} · ver ofertas`, u:'?ver=menor'} : null,
    maxD ? {h:`Descontos de <b>até ${maxD}% off</b> conferidos pelo nosso robô`, u:'?ver=descontos'} : null,
    nFrete ? {h:`<b>Frete grátis</b> em ${nFrete} ${nFrete === 1 ? 'oferta' : 'ofertas'} agora`, u:'?ver=full'} : null,
    {h:'Preços conferidos <b>a cada 15 minutos</b>', u:'?ver=novas'},
  ].filter(Boolean);
  const mostrar = () => { const m = msgs[promoK % msgs.length]; $('ann').innerHTML = m.h; $('promo').setAttribute('href', m.u); };
  mostrar();
  if (!reduz && msgs.length > 1) setInterval(() => { if (!document.hidden) { promoK++; mostrar(); } }, 5000);
}

/* ---------- roteador ---------- */
function rota() {
  limparTimers(); fecharSugg(); fecharMega(true);
  if ($('drawer').classList.contains('open')) abrirDrawer(false);
  $('scrim').hidden = true; $('scrim').classList.remove('on'); document.body.style.overflow = '';
  if (obsBuy) { removeEventListener('scroll', obsBuy); obsBuy = null; }
  $('buybar').classList.remove('on'); document.body.classList.remove('has-buybar');
  const ps = new URLSearchParams(location.search);
  const id = ps.get('p') || ps.get('oferta');
  if (ps.get('oferta')) history.replaceState(null, '', qs({p:id}));
  if (id) viewProduto(id);
  else if (['cat', 'q', 'ver', 'marca', 'sub', 'max', 'min', 'preco', 'desc', 'frete', 'full', 'menor', 'pagina', 'ordem'].some(k => ps.get(k))) viewLista(ps);
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
  if (e.target.closest('#grid [data-x="tudo"]') && L) limparFiltros();
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
  montarMenus(); montarPromo();
  if (d.modo === 'demonstração') $('demo').hidden = false;
  contarFavs(); rota();
}).catch(() => { $('view').innerHTML = '<div class="wrap" style="padding-block:40px"><div class="empty"><strong>Não foi possível carregar as ofertas</strong><p>Tente recarregar a página em instantes.</p></div></div>'; });
}
