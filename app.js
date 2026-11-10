/* Bora Pro Rolê | PWA + Supabase | 10/11/2026
 * Arquivo único de lógica. Nenhuma chave secreta deve ser colocada aqui.
 * O app só libera a área social depois do onboarding validado pelo banco.
 */
'use strict';

// Capturamos o erro antes de o SDK processar/limpar o fragmento da URL.
const emailConfirmationReturn = new URLSearchParams(location.search).get('email_confirmed') === '1';
const confirmationFragment = new URLSearchParams(location.hash.slice(1));
const confirmationError = confirmationFragment.get('error_code') || confirmationFragment.get('error') ||
  new URLSearchParams(location.search).get('error_code');

const SUPABASE_URL = 'https://tohusfsmpyzipxvitble.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_p7kMjoFwe937a9G3mEGd1g_dRlQ_YCf';
const db = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = (id) => document.getElementById(id);
const html = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[ch]);
const legalUrl = (kind) => ({ terms: './termos.html', privacy: './privacidade.html', community: './comunidade.html' })[kind];
const safeHttps = (value) => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
const icons = () => window.lucide?.createIcons({ attrs: { 'stroke-width': 2 } });
const displayDate = (value) => new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'America/Sao_Paulo'
}).format(new Date(value));
const shortDate = (value) => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo'
}).format(new Date(value));
const currentRedirect = () => `${location.origin}${location.pathname}`;
// Link do cadastro volta a uma página real do GitHub Pages e oferece login.
// Cadastrar este URL EXATO em Authentication → URL Configuration → Redirect URLs.
const signupRedirect = () => new URL('./index.html?email_confirmed=1', currentRedirect()).href;
let pendingBirthdate = null; // Somente em memória, até a confirmação explícita.
const categories = [
  ['todos', '✨', 'Todos'], ['festa', '🪩', 'Festas'], ['bar', '🍹', 'Bares'],
  ['balada', '🎶', 'Baladas'], ['rave', '🔊', 'Raves'], ['cinema', '🎬', 'Cinema'],
  ['show', '🎤', 'Shows'], ['festival', '🎪', 'Festivais'], ['cultura', '🎨', 'Cultura'],
  ['ar-livre', '🌿', 'Ar livre'], ['carnaval', '🎭', 'Carnaval'],
  ['reveillon', '🎆', 'Réveillon'], ['sao-joao', '🌽', 'São João'], ['outros', '✨', 'Outros']
];
const catLabel = (slug) => categories.find((c) => c[0] === slug)?.[2] || 'Rolê';
function spotifyId(url, type) {
  try {
    const parsed = new URL(String(url || ''));
    const match = parsed.pathname.match(new RegExp(`^/${type}/([A-Za-z0-9]{22})/?$`));
    return parsed.protocol === 'https:' && parsed.hostname === 'open.spotify.com' ? (match?.[1] || '') : '';
  } catch { return ''; }
}
function spotifyEmbed(url, type = 'playlist') {
  const id = spotifyId(url, type);
  if (!id) return '';
  return `<div class="spotify-optin"><div><strong>🎧 Player do Spotify</strong><small>Ao ativar, o Spotify poderá receber dados de navegação conforme suas próprias políticas.</small></div>
    <button class="btn btn-ghost btn-small" data-action="spotify-load" data-spotify-kind="${type}" data-spotify-id="${id}">▶ Ouvir aqui</button></div>`;
}
const state = {
  user: null, profile: null, events: [], joined: new Set(), saved: new Map(),
  counts: new Map(), squads: [], squadRoles: new Map(), squadInvites: [],
  activeSquad: null, activeRoom: null, activeEvent: null, category: 'todos',
  search: '', view: 'mapa', map: null, markers: null, pickerMap: null,
  chatChannel: null, membersCache: new Map(), sessionVersion: 0, opened: false,
  lastFocus: null, lastAppRefresh: 0, lastSessionCheck: 0, isModerator: false
};

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 5000);
}

function feedback(message, error = true) {
  $('auth-feedback').textContent = message;
  $('auth-feedback').classList.toggle('error', error);
}

function showGate(stage, data = {}) {
  $('auth-gate').classList.remove('hidden');
  $('auth-feedback').textContent = '';
  const parts = {
    loading: '<h1>Preparando seu rolê…</h1><p class="small-muted">Validando sua sessão com segurança.</p>',
    login: `<span class="eyebrow">Bem-vindo de volta</span><h1>Entra, a galera tá te esperando. ✌️</h1>
      <form id="login-form" class="auth-form"><label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Senha<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="btn btn-pink" type="submit">Entrar</button></form>
      <p class="auth-switch"><button data-auth="forgot">Esqueci a senha</button> · <button data-auth="signup">Criar conta</button></p>
      <p class="auth-switch"><button data-auth="resend">Reenviar e-mail de confirmação</button></p>`,
    signup: `<span class="eyebrow">Seu próximo rolê começa aqui</span><h1>Crie sua conta 🪩</h1>
      <form id="signup-form" class="auth-form"><label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Senha (mínimo 8 caracteres)<input name="password" type="password" minlength="8" required autocomplete="new-password"></label>
      <p class="small-muted">Enviaremos um link de confirmação ao seu e-mail. Depois, você informará sua data de nascimento (18+), completará o perfil e aceitará os documentos da comunidade.</p>
      <button class="btn btn-pink" type="submit">Continuar</button></form>
      <p class="auth-switch"><button data-auth="login">Já tenho conta</button></p>`,
    forgot: `<h1>Recuperar senha 🔑</h1><p class="small-muted">Enviaremos um link para seu email.</p>
      <form id="forgot-form" class="auth-form"><label>Email<input name="email" type="email" required autocomplete="email"></label>
      <button class="btn btn-pink" type="submit">Enviar link</button></form><p class="auth-switch"><button data-auth="login">Voltar ao login</button></p>`,
    resend: `<h1>Reenviar confirmação ✉️</h1><p class="small-muted">Não recebeu o link ou ele expirou? Informe o e-mail usado no cadastro.</p>
      <form id="resend-form" class="auth-form"><label>Email<input name="email" type="email" required autocomplete="email"></label>
      <button class="btn btn-pink" type="submit">Reenviar confirmação</button></form><p class="auth-switch"><button data-auth="login">Voltar ao login</button></p>`,
    reset: `<h1>Defina uma nova senha</h1><form id="reset-form" class="auth-form">
      <label>Nova senha<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
      <button class="btn btn-pink" type="submit">Alterar senha</button></form>`,
    birth: `<span class="eyebrow">Etapa 1 de 3</span><h1>Você já completou 18 anos?</h1>
      <p class="small-muted">Informe sua data de nascimento verdadeira. Esta informação fica privada e não pode ser alterada livremente depois.</p>
      <form id="birth-form" class="auth-form"><label>Data de nascimento<input name="birthdate" type="date" required max="${new Date().toISOString().slice(0,10)}"></label>
      <button class="btn btn-pink" type="submit">Verificar data declarada</button></form>
      <p class="legal-note">Este espaço é exclusivo para maiores de 18 anos. A data informada é uma declaração, não uma verificação documental.</p>
      <p class="auth-switch"><button data-auth="logout">Sair da conta</button></p>`,
    'birth-confirm': `<span class="eyebrow">Confirmação de idade declarada</span><h1>Vamos confirmar sua informação 🔞</h1>
      <p>Você informou a data de nascimento <strong>${html(data.birthdate || '')}</strong>.</p>
      <p class="legal-note">O Bora Pro Rolê é exclusivo para pessoas com 18 anos ou mais. Não verificamos sua identidade nesta etapa; futuramente poderemos solicitar uma comprovação confiável da data informada. Dados falsos podem resultar em suspensão da conta.</p>
      <form id="birth-confirm-form" class="auth-form"><label class="check-label"><input name="truth_acknowledged" type="checkbox" required>
        Confirmo que tenho pelo menos 18 anos e que a data de nascimento informada é verdadeira.</label>
        <button class="btn btn-pink" type="submit">Confirmar declaração e continuar</button></form>
      <p class="auth-switch"><button data-auth="restart-birth">Corrigir data</button> · <button data-auth="logout">Sair</button></p>`,
    profile: `<span class="eyebrow">Etapa 2 de 3</span><h1>Como vamos te chamar?</h1>
      <form id="onboard-profile-form" class="auth-form"><label>Nome de exibição<input name="display_name" maxlength="60" required placeholder="Como quer aparecer no app"></label>
      <label>@nickname único<input name="username" maxlength="24" minlength="3" pattern="[a-z0-9_.]{3,24}" required placeholder="seu.nick" autocapitalize="none"></label>
      <label>Cidade de residência (opcional)<input name="city" maxlength="90" placeholder="Ex.: São Paulo"></label>
      <button class="btn btn-pink" type="submit">Criar meu perfil</button></form><p class="auth-switch"><button data-auth="logout">Sair</button></p>`,
    legal: `<span class="eyebrow">Etapa 3 de 3</span><h1>Comunidade segura é compromisso de todos.</h1>
      <p class="small-muted">Leia os documentos e aceite conscientemente para concluir seu acesso.</p>
      <div class="legal-links">${(data.docs || []).map((d) => `<a href="${html(legalUrl(d.kind))}" target="_blank" rel="noopener noreferrer">${html({terms:'Termos de Uso',privacy:'Política de Privacidade',community:'Regras da Comunidade'}[d.kind])} — v${html(d.version)} ↗</a>`).join('')}</div>
      <form id="legal-form" class="auth-form"><label class="check-label"><input type="checkbox" required> Li e aceito os Termos de Uso e as Regras da Comunidade; estou ciente da Política de Privacidade.</label>
      <button class="btn btn-pink" type="submit">Aceitar e entrar</button></form><p class="auth-switch"><button data-auth="logout">Sair</button></p>`,
    waiting: `<span class="eyebrow">Estamos organizando a casa</span><h1>As políticas estão em revisão. 🛡️</h1>
      <p>Seu acesso foi criado, mas a navegação social só será liberada depois da publicação dos Termos, Política de Privacidade e Regras da Comunidade.</p>
      <p class="small-muted">Não precisamos de nenhuma outra informação sua agora. Volte mais tarde.</p><button class="btn btn-ghost" data-auth="logout">Sair</button>`,
    blocked: `<h1>Acesso indisponível</h1><p>Não foi possível confirmar sua elegibilidade para entrar no Bora Pro Rolê. Contate o suporte responsável pelo aplicativo.</p><button class="btn btn-ghost" data-auth="logout">Sair</button>`,
    offline: `<h1>Conexão necessária</h1><p>Não foi possível inicializar o serviço de login. Confira a internet e recarregue a página.</p>
      <button class="btn btn-pink" onclick="location.reload()">Tentar novamente</button>`
  };
  $('auth-stage').innerHTML = parts[stage] || parts.loading;
  icons();
}

async function assertOk(promise) {
  const result = await promise;
  if (result.error) throw result.error;
  return result.data;
}

async function authAction(kind, form) {
  try {
    if (kind === 'restart-birth') { pendingBirthdate = null; return showGate('birth'); }
    // Botões de troca de tela não são submissões de formulário.
    if (!form && ['login','signup','forgot','resend'].includes(kind)) return showGate(kind);
    feedback('Processando…', false);
    const data = form ? Object.fromEntries(new FormData(form)) : {};
    if (kind === 'login') {
      await assertOk(db.auth.signInWithPassword({ email: data.email, password: data.password }));
      await syncSession();
    } else if (kind === 'signup') {
      const signup = await assertOk(db.auth.signUp({email: data.email, password: data.password,
        options: { emailRedirectTo: signupRedirect() }}));
      if (!signup.session) { showGate('login'); feedback('Confira seu email para confirmar a conta e depois faça login.', false); }
      else await syncSession();
    } else if (kind === 'resend') {
      await assertOk(db.auth.resend({type: 'signup', email: data.email,
        options: {emailRedirectTo: signupRedirect()}}));
      showGate('login');
      feedback('Se há uma confirmação pendente, enviaremos um novo link. Verifique sua caixa de entrada e spam.', false);
    } else if (kind === 'forgot') {
      await assertOk(db.auth.resetPasswordForEmail(data.email, {redirectTo: currentRedirect()}));
      showGate('login'); feedback('Se o email estiver cadastrado, você receberá instruções para redefinir a senha.', false);
    } else if (kind === 'reset') {
      await assertOk(db.auth.updateUser({ password: data.password }));
      feedback('Senha alterada. Continuando…', false);
      await syncSession();
    } else if (kind === 'logout') {
      pendingBirthdate = null;
      await db.auth.signOut();
      state.user = null;
      state.opened = false;
      state.isModerator = false;
      $('moderation-entry')?.classList.add('hidden');
      leaveRoom();
      showGate('login');
    } else if (kind === 'birth') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.birthdate || ''))) throw Error('Informe uma data de nascimento válida.');
      pendingBirthdate = data.birthdate;
      return showGate('birth-confirm', {birthdate: new Date(`${data.birthdate}T12:00:00`).toLocaleDateString('pt-BR')});
    } else if (kind === 'confirm-birth') {
      if (!pendingBirthdate || data.truth_acknowledged !== 'on') throw Error('Confirme que a informação é verdadeira para continuar.');
      await assertOk(db.rpc('declare_adulthood', { _birthdate: pendingBirthdate }));
      pendingBirthdate = null;
      await syncSession();
    } else if (kind === 'profile') {
      const username = String(data.username || '').toLowerCase().trim().replace(/^@/, '');
      if (!/^[a-z0-9_.]{3,24}$/.test(username)) throw Error('Nickname deve ter de 3 a 24 caracteres: a-z, 0-9, ponto ou _');
      await assertOk(db.from('profiles').insert({id: state.user.id, username,
        display_name: String(data.display_name).trim(), city: String(data.city || '').trim() || null }));
      await syncSession();
    } else if (kind === 'legal') {
      await assertOk(db.rpc('accept_current_documents'));
      await syncSession();
    }
  } catch (err) {
    feedback(err.message || 'Não foi possível concluir. Tente novamente.');
  }
}

async function syncSession() {
  const version = ++state.sessionVersion;
  state.lastSessionCheck = Date.now();
  const session = await assertOk(db.auth.getSession());
  if (version !== state.sessionVersion) return;
  if (!session?.session?.user) {
    pendingBirthdate = null;
    state.user = null;
    state.opened = false;
    state.isModerator = false;
    state.lastAppRefresh = 0;
    $('moderation-entry')?.classList.add('hidden');
    showGate('login');
    return;
  }
  const sameUser = state.opened && state.user?.id === session.session.user.id;
  state.user = session.session.user;
  if (!sameUser) showGate('loading');
  try {
    const raw = await assertOk(db.rpc('my_onboarding_status'));
    if (version !== state.sessionVersion) return;
    const status = Array.isArray(raw) ? raw[0] : raw;
    if (!status?.adult_declared) return showGate('birth');
    if (!status.has_profile) return showGate('profile');
    if (!status.legal_accepted) {
      const docs = await assertOk(db.from('legal_documents').select('kind,version,document_url').eq('is_active', true));
      if (docs.length !== 3) return showGate('waiting');
      return showGate('legal', { docs });
    }
    if (!status.can_use_app) return showGate('blocked');
    state.profile = await assertOk(db.from('profiles').select('*').eq('id', state.user.id).single());
    if (version !== state.sessionVersion) return;
    $('auth-gate').classList.add('hidden');
    $('app-status').classList.add('hidden');
    hydrateProfile();
    if (!sameUser || Date.now() - state.lastAppRefresh > 180000) {
      await loadAppData();
      state.lastAppRefresh = Date.now();
    }
    if (!state.opened) {
      state.opened = true;
      navigate('explorar');
    }
  } catch (err) {
    if (!navigator.onLine || /network|fetch|timeout|failed to fetch/i.test(err?.message || '')) {
      if (!state.opened) showGate('offline');
      else toast('Sem conexão. Seus dados serão atualizados quando a internet voltar.');
    } else {
      showGate('blocked');
      feedback(`Falha ao consultar seu cadastro: ${err.message}`);
    }
  }
}

function showModal(title, body) {
  state.lastFocus = document.activeElement;
  $('dialog-title').textContent = title;
  $('dialog-body').className = 'dialog-content';
  $('dialog-body').innerHTML = body;
  $('modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  $('modal-close').focus();
  icons();
}

function closeModal() {
  if (state.pickerMap) { state.pickerMap.remove(); state.pickerMap = null; }
  $('modal').classList.add('hidden');
  $('dialog-body').innerHTML = '';
  document.body.style.overflow = '';
  state.lastFocus?.focus?.();
}

function navigate(page) {
  if (!state.user || !$('auth-gate').classList.contains('hidden')) return;
  if (page === 'criar') return openCreate();
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('active', screen.id === `screen-${page}`));
  document.querySelectorAll('[data-nav]').forEach((button) => button.classList.toggle('active', button.dataset.nav === page));
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (page === 'explorar') setTimeout(() => state.map?.invalidateSize(), 140);
  if (page === 'meus') renderMine();
  if (page === 'squad') renderSquads();
  icons();
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $('map-frame').classList.toggle('hidden', view !== 'mapa');
  if (view === 'mapa') setTimeout(() => state.map?.invalidateSize(), 100);
}

function renderChips() {
  $('category-chips').innerHTML = categories.map((c) => `<button class="chip ${state.category === c[0] ? 'active' : ''}" data-category="${c[0]}">${c[1]} ${c[2]}</button>`).join('');
}

const eventCount = (id) => Number(state.counts.get(id) ?? 0);
const eventImage = (event) => event.image || '';
const isPublished = (event) => event.status === 'published';
const filteredEvents = () => state.events.filter((event) =>
  new Date(event.endsAt) > new Date() &&
  (state.category === 'todos' || event.category === state.category) &&
  `${event.title} ${event.address} ${event.city} ${event.description}`.toLowerCase().includes(state.search));

function renderEvents() {
  const events = filteredEvents();
  $('events-grid').innerHTML = events.length ? events.map((event) => {
    const pending = !isPublished(event);
    return `<article class="event-card" role="button" tabindex="0" data-event="${html(event.id)}" aria-label="Ver detalhes de ${html(event.title)}">
      <div class="card-media">${eventImage(event) ? `<img src="${html(eventImage(event))}" alt="Foto de capa de ${html(event.title)}" loading="lazy">` : '<div class="image-placeholder">🪩</div>'}
      <div class="date-chip">${html(shortDate(event.date))}</div><span class="category-tag">${html(catLabel(event.category))}</span>
      <button class="save-btn ${state.saved.has(event.id) ? 'saved' : ''}" data-save="${html(event.id)}" aria-label="${state.saved.has(event.id) ? 'Remover dos salvos' : 'Salvar rolê'}"><i data-lucide="heart"></i></button></div>
      <div class="card-body"><h3>${html(event.title)}</h3>
      <div class="meta"><i data-lucide="map-pin"></i>${html(event.venue || event.address)} · ${html(event.city)}</div>
      <div class="meta"><i data-lucide="clock-3"></i>${html(displayDate(event.date))}</div>
      <div class="card-foot">${pending ? '<span class="badge">Em análise de segurança</span>' : `<span class="badge green">✓ ${eventCount(event.id)} confirmados</span>`}<span class="arrow"><i data-lucide="arrow-up-right"></i></span></div></div></article>`;
  }).join('') : '<div class="empty">Ainda não há rolês publicados nessa busca. Tente outra categoria ou aguarde novos eventos!</div>';
  $('results-count').textContent = `${events.length} rolê${events.length !== 1 ? 's' : ''} encontrado${events.length !== 1 ? 's' : ''}`;
  renderPins(events.filter(isPublished));
  icons();
}

function initMap() {
  if (!window.L) return;
  if (state.map) { state.map.invalidateSize(); return; }
  state.map = L.map('map', { zoomControl: false, scrollWheelZoom: false }).setView([-23.56, -46.625], 12);
  L.control.zoom({ position: 'bottomleft' }).addTo(state.map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
  }).addTo(state.map);
  state.markers = L.layerGroup().addTo(state.map);
  renderPins(filteredEvents().filter(isPublished));
}

function renderPins(events) {
  if (!state.markers) return;
  state.markers.clearLayers();
  for (const event of events) {
    if (!Number.isFinite(event.lat) || !Number.isFinite(event.lng)) continue;
    const isCarnaval = event.category === 'carnaval';
    const icon = L.divIcon({className: '', html: isCarnaval ? '<div class="season-truck" aria-label="Bloco de carnaval">🚛</div>' : '<div class="pin-dot"><span>✦</span></div>',
      iconSize: isCarnaval ? [42, 39] : [36, 40], iconAnchor: isCarnaval ? [21, 36] : [18, 38]});
    const marker = L.marker([event.lat, event.lng], { icon }).addTo(state.markers);
    const box = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = event.title;
    const address = document.createElement('p'); address.textContent = `${event.address} · ${eventCount(event.id)} confirmados`;
    const open = document.createElement('button'); open.textContent = 'Ver detalhes';
    open.addEventListener('click', () => openDetails(event.id));
    box.append(title, address, open); marker.bindPopup(box);
  }
}

function normalizeEvent(row) {
  return {id: row.id, title: row.title, category: row.category,
    description: row.description, date: row.starts_at, endsAt: row.ends_at,
    venue: row.venue_name || '', address: row.address, city: row.city,
    stateCode: row.state_code, lat: row.latitude == null ? null : Number(row.latitude),
    lng: row.longitude == null ? null : Number(row.longitude), image: '',
    coverPath: row.cover_path, instagram: row.venue_instagram || '',
    ticket: row.ticket_url || '', playlist: row.spotify_playlist_url || '', status: row.status, creatorId: row.creator_id,
    requiresVerifiedAge: row.requires_verified_age};
}

async function refreshCounts(ids) {
  const publishedIds = ids.filter((id) => state.events.some((event) => event.id === id && isPublished(event)));
  if (!publishedIds.length) return;
  const data = await assertOk(db.rpc('event_confirmed_counts', { _event_ids: publishedIds.slice(0, 100) }));
  for (const row of data || []) state.counts.set(row.event_id, Number(row.confirmed_count));
}

async function loadEvents() {
  const rows = await assertOk(db.from('events').select('id,creator_id,title,description,category,starts_at,ends_at,venue_name,address,city,state_code,latitude,longitude,cover_path,venue_instagram,ticket_url,spotify_playlist_url,status,requires_verified_age')
    .gte('ends_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('starts_at', { ascending: true }).limit(50));
  state.events = (rows || []).map(normalizeEvent);
  const covers = state.events.filter((event) => event.coverPath);
  if (covers.length) {
    const signed = await db.storage.from('event-covers').createSignedUrls(covers.map((event) => event.coverPath), 90);
    if (!signed.error) covers.forEach((event, index) => { event.image = safeHttps(signed.data[index]?.signedUrl); });
  }
  await refreshCounts(state.events.map((event) => event.id));
  renderEvents();
}

async function loadMyEvents() {
  const [joins, saves] = await Promise.all([
    assertOk(db.from('event_members').select('event_id,status').eq('user_id', state.user.id).limit(200)),
    assertOk(db.from('personal_saves').select('id,event_id').eq('user_id', state.user.id).eq('kind', 'event').limit(200))
  ]);
  state.joined = new Set((joins || []).filter((row) => row.status === 'joined').map((row) => row.event_id));
  state.saved = new Map((saves || []).filter((row) => row.event_id).map((row) => [row.event_id, row.id]));
  renderMine();
  renderEvents();
}

async function loadAppData() {
  renderChips();
  try {
    await Promise.all([loadEvents(), loadMyEvents(), loadSquads(), loadHomePlaylist()]);
  } catch (err) {
    toast(`Não foi possível carregar tudo: ${err.message}`);
  }
  setTimeout(initMap, 150);
}

async function loadHomePlaylist() {
  const target = $('home-spotify-embed');
  try {
    const row = await assertOk(db.from('app_settings').select('value').eq('key','home_spotify_playlist_url').maybeSingle());
    const url = row?.value || '';
    target.innerHTML = spotifyEmbed(url) || '<p class="small-muted">🎧 A playlist oficial será publicada aqui em breve. Você também pode ouvir a playlist de cada evento na ficha do rolê.</p>';
  } catch (err) { target.textContent = `Playlist indisponível: ${err.message}`; }
}

async function openDetails(id) {
  const event = state.events.find((row) => row.id === id);
  if (!event) return;
  state.activeEvent = id;
  try { await refreshCounts([id]); } catch { /* Exibe a última contagem conhecida. */ }
  const instaValue = event.instagram.trim();
  const insta = instaValue.startsWith('@') ? `https://www.instagram.com/${instaValue.slice(1)}` : instaValue;
  const instaUrl = safeHttps(insta);
  const ticketUrl = safeHttps(event.ticket);
  const active = isPublished(event);
  const joined = state.joined.has(id);
  showModal(event.title, `<div class="event-details">
    ${eventImage(event) ? `<img class="dialog-photo" src="${html(eventImage(event))}" alt="Capa do evento ${html(event.title)}">` : '<div class="detail-cover-fallback">🪩</div>'}
    <span class="badge pink">${html(catLabel(event.category))}</span>
    ${!active ? '<span class="badge">Em análise de segurança</span>' : ''}
    <h3 class="details-heading">Informações do rolê</h3>
    <dl class="event-facts">
      <div><dt>🎉 Nome do evento</dt><dd>${html(event.title)}</dd></div>
      <div><dt>📆 Data e hora</dt><dd>${html(displayDate(event.date))}</dd></div>
      <div><dt>🏢 Local</dt><dd>${html(event.venue || 'Local informado no endereço')}</dd></div>
      <div><dt>📍 Endereço</dt><dd>${html(event.address)}, ${html(event.city)} - ${html(event.stateCode)}</dd></div>
      <div><dt>✅ Pessoas confirmadas</dt><dd><strong class="confirmed-count">${active ? eventCount(id) : '—'}</strong> ${active ? 'integrantes no grupo do rolê' : 'Evento ainda não publicado'}</dd></div>
    </dl>
    <h3 class="details-heading">Sobre o encontro</h3><p class="detail-desc">${html(event.description)}</p>
    <div class="event-links"><div><strong>Instagram do evento/local</strong>${instaUrl ? `<a href="${html(instaUrl)}" target="_blank" rel="noopener noreferrer">Ver Instagram ↗</a>` : '<span>Não informado</span>'}</div>
    <div><strong>Compra de ingresso</strong>${ticketUrl ? `<a href="${html(ticketUrl)}" target="_blank" rel="noopener noreferrer">Abrir link oficial informado ↗</a>` : '<span>Sem link informado (confirme se é gratuito)</span>'}</div></div>
    ${spotifyEmbed(event.playlist) ? `<section class="event-spotify"><h3 class="details-heading">🎵 Playlist deste rolê</h3>${spotifyEmbed(event.playlist)}<p class="small-muted">A lista de sugestões dos participantes aparece depois de entrar no grupo. As músicas sugeridas no app não são adicionadas automaticamente ao Spotify.</p></section>` : ''}
    <div class="meeting-tip">🛡️ <strong>Combinado seguro:</strong> encontre o grupo em um local público, avise alguém de confiança sobre seu destino e confirme a procedência dos ingressos. <button data-action="safety" class="inline-button">Ver orientações</button></div>
    <div class="dialog-actions"><button class="btn btn-pink" data-action="join" data-id="${html(id)}" ${!active ? 'disabled' : ''}>${joined ? 'Abrir grupo do rolê 💬' : 'Confirmar participação e entrar no grupo 💬'}</button>
    <button class="btn btn-ghost" data-action="report" data-kind="event" data-id="${html(id)}">Denunciar anúncio</button></div>
    <p class="small-muted">Antes de confirmar, você vê somente informações do evento e a quantidade de participantes. Dados pessoais permanecem protegidos pelas regras de privacidade.</p>
  </div>`);
}

async function joinEvent(id) {
  const event = state.events.find((item) => item.id === id);
  if (!event || !isPublished(event)) return toast('Evento ainda não disponível para participação.');
  try {
    if (!state.joined.has(id)) {
      const existing = await assertOk(db.from('event_members').select('status').eq('event_id', id).eq('user_id', state.user.id).maybeSingle());
      if (existing) await assertOk(db.from('event_members').update({status: 'joined'}).eq('event_id', id).eq('user_id', state.user.id));
      else await assertOk(db.from('event_members').insert({event_id: id, user_id: state.user.id}));
      state.joined.add(id);
    }
    await refreshCounts([id]);
    renderEvents(); renderMine();
    closeModal();
    await openRoom('event', id);
  } catch (err) { toast(`Não foi possível entrar no grupo: ${err.message}`); }
}

async function saveEvent(id) {
  const event = state.events.find((row) => row.id === id);
  if (!event) return;
  try {
    if (state.saved.has(id)) {
      await assertOk(db.from('personal_saves').delete().eq('id', state.saved.get(id)));
      state.saved.delete(id);
      toast('Removido dos salvos.');
    } else {
      const row = await assertOk(db.from('personal_saves').insert({kind: 'event', title: event.title,
        event_id: id, content: event.address}).select('id').single());
      state.saved.set(id, row.id);
      toast('Rolê salvo!');
    }
    renderEvents(); renderMine();
  } catch (err) { toast(err.message); }
}

function renderMine() {
  const item = (event) => `<div class="list-row"><div class="icon-disc">${categories.find((c) => c[0] === event.category)?.[1] || '✨'}</div>
    <div class="grow"><strong>${html(event.title)}</strong><p>${html(shortDate(event.date))} · ${html(event.address)}</p></div>
    <button class="btn btn-ghost btn-small" data-event="${html(event.id)}">Ver</button>
    ${state.joined.has(event.id) && new Date(event.endsAt) <= new Date() && new Date(event.endsAt) > new Date(Date.now() - 7 * 86400000)
      ? `<button class="btn btn-pink btn-small" data-action="create-squad" data-id="${html(event.id)}">Criar SQUAD</button>` : ''}</div>`;
  $('joined-list').innerHTML = state.events.filter((event) => state.joined.has(event.id)).map(item).join('') ||
    '<p class="small-muted">Ainda não confirmou nenhum rolê.</p>';
  $('saved-list').innerHTML = state.events.filter((event) => state.saved.has(event.id)).map(item).join('') ||
    '<p class="small-muted">Salve eventos pelo coração para encontrá-los aqui.</p>';
}

function openCreate() {
  showModal('Criar um rolê ✨', `<p class="small-muted">Seu rolê será publicado assim que os dados forem salvos. Anúncios com sinais de risco poderão ser encaminhados para análise de segurança.</p>
    <form id="event-form" class="create-form"><div class="field"><label for="new-title">Nome do rolê *</label><input id="new-title" maxlength="100" minlength="5" required placeholder="Ex.: Cine + café no sábado"></div>
    <div class="fields"><div class="field"><label for="new-category">Categoria *</label><select id="new-category">${categories.slice(1).map((c) => `<option value="${c[0]}">${c[1]} ${c[2]}</option>`).join('')}</select></div>
    <div class="field"><label for="new-venue">Nome do local</label><input id="new-venue" maxlength="120" placeholder="Ex.: Cinemark Shopping"></div></div>
    <div class="fields"><div class="field"><label for="new-start">Início *</label><input id="new-start" type="datetime-local" required></div><div class="field"><label for="new-end">Término previsto *</label><input id="new-end" type="datetime-local" required></div></div>
    <div class="field"><label for="new-address">Endereço completo *</label><input id="new-address" maxlength="220" required placeholder="Rua, número, bairro"></div>
    <div class="fields"><div class="field"><label for="new-city">Cidade *</label><input id="new-city" maxlength="90" value="São Paulo" required></div><div class="field"><label for="new-state">UF *</label><input id="new-state" maxlength="2" value="SP" required></div></div>
    <div class="field"><label for="new-description">Descrição e combinados *</label><textarea id="new-description" minlength="10" maxlength="2000" required placeholder="Como será? Tem ingresso? Qual será o ponto de encontro?"></textarea></div>
    <div class="fields"><div class="field"><label for="new-insta">Instagram do local</label><input id="new-insta" placeholder="@local ou https://..."></div><div class="field"><label for="new-ticket">Link do ingresso</label><input id="new-ticket" type="url" placeholder="https://..."></div></div>
    <div class="field"><label for="new-playlist">Playlist do rolê no Spotify (opcional)</label><input id="new-playlist" type="url" placeholder="https://open.spotify.com/playlist/..."></div>
    <div class="field"><label for="new-cover">Foto de capa (WebP/JPG/PNG, opcional)</label><input id="new-cover" type="file" accept="image/*"></div>
    <p class="small-muted">📍 Toque no mapa para marcar o local exato do evento. A localização não é a da sua residência.</p>
    <div id="map-picker" class="map-picker"></div><div id="picker-location" class="small-muted">Nenhum local marcado.</div>
    <label class="check-label"><input id="new-verified" type="checkbox"> Este rolê exige verificação etária independente (além da data declarada)</label>
    <p class="legal-note">Nunca publique endereços residenciais, dados de terceiros ou convites a práticas ilegais. O app pode recusar conteúdos e eventos inadequados.</p>
    <button type="submit" class="btn btn-pink" style="width:100%">Publicar rolê</button></form>`);
  const start = $('new-start');
  start.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
  state.pickedCoords = null;
  if (window.L) {
    state.pickerMap = L.map('map-picker', {scrollWheelZoom: false}).setView([-23.56, -46.625], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'}).addTo(state.pickerMap);
    let marker;
    state.pickerMap.on('click', (ev) => {
      state.pickedCoords = {lat: ev.latlng.lat, lng: ev.latlng.lng};
      if (marker) marker.setLatLng(ev.latlng);
      else marker = L.marker(ev.latlng).addTo(state.pickerMap);
      $('picker-location').textContent = `✓ Pino escolhido: ${ev.latlng.lat.toFixed(5)}, ${ev.latlng.lng.toFixed(5)}`;
    });
    setTimeout(() => state.pickerMap?.invalidateSize(), 180);
  }
  $('event-form').addEventListener('submit', submitEvent);
}

async function compressWebp(file, maxBytes = 314572) {
  if (!file) return null;
  const image = await createImageBitmap(file);
  let width = Math.min(image.width, 1200);
  let height = Math.round(image.height * (width / image.width));
  let quality = 0.82;
  for (let round = 0; round < 10; round++) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (blob && blob.type === 'image/webp' && blob.size <= maxBytes) { image.close?.(); return blob; }
    width = Math.max(220, Math.round(width * 0.82));
    height = Math.max(120, Math.round(height * 0.82));
    quality = Math.max(0.5, quality - 0.045);
  }
  image.close?.();
  throw Error('Imagem muito grande. Escolha outra imagem ou reduza o tamanho.');
}

async function submitEvent(event) {
  event.preventDefault();
  if (!state.pickedCoords) return toast('Marque o local no mapa antes de publicar.');
  const start = new Date($('new-start').value);
  const end = new Date($('new-end').value);
  if (!(start > new Date()) || !(end > start)) return toast('Confira as datas: o término precisa ocorrer após o início.');
  const ticket = $('new-ticket').value.trim();
  if (ticket && !safeHttps(ticket)) return toast('O link de ingresso precisa começar com https://');
  const playlist = $('new-playlist').value.trim();
  if (playlist && !spotifyId(playlist,'playlist')) return toast('Cole um link de playlist válido do Spotify.');
  const button = event.submitter;
  button.disabled = true;
  try {
    const uid = crypto.randomUUID();
    const row = {id: uid, creator_id: state.user.id,
      title: $('new-title').value.trim(), category: $('new-category').value,
      description: $('new-description').value.trim(), starts_at: start.toISOString(),
      ends_at: end.toISOString(), venue_name: $('new-venue').value.trim() || null,
      address: $('new-address').value.trim(), city: $('new-city').value.trim(),
      state_code: $('new-state').value.trim().toUpperCase(),
      latitude: state.pickedCoords.lat, longitude: state.pickedCoords.lng,
      venue_instagram: $('new-insta').value.trim() || null,
      ticket_url: ticket || null, spotify_playlist_url: playlist || null,
      requires_verified_age: $('new-verified').checked};
    await assertOk(db.from('events').insert(row));
    const file = $('new-cover').files?.[0];
    if (file) {
      try {
        const blob = await compressWebp(file, 524288);
        const path = `${uid}/cover.webp`;
        await assertOk(db.storage.from('event-covers').upload(path, blob, {contentType: 'image/webp', upsert: true}));
        await assertOk(db.from('events').update({cover_path: path}).eq('id', uid));
      } catch (err) { toast(`Rolê criado, mas a capa não foi salva: ${err.message}`); }
    }
    // A capa é enviada ANTES da publicação: as permissões de Storage só permitem upload enquanto pendente.
    // A função no banco decide se publica ou encaminha para análise, sem confiar na classificação do navegador.
    const publication = await assertOk(db.rpc('bora_publish_event', {_event: uid}));
    closeModal();
    await loadEvents();
    toast(publication?.needs_review
      ? 'O rolê foi salvo e encaminhado para análise de segurança.'
      : 'Seu rolê já está publicado! 🎉');
  } catch (err) { toast(`Não foi possível criar o rolê: ${err.message}`); }
  finally { button.disabled = false; }
}

function hydrateProfile() {
  const profile = state.profile;
  if (!profile) return;
  $('profile-display').textContent = profile.display_name;
  $('profile-handle').textContent = `@${profile.username}`;
  $('profile-bio').textContent = profile.bio || 'Ainda não escreveu sua descrição.';
  $('user-city-label').innerHTML = `<i data-lucide="map-pin"></i> ${html(profile.city || 'Brasil')}`;
  document.querySelector('.avatar-btn').textContent = profile.display_name.slice(0,1).toUpperCase();
  $('edit-name').value = profile.display_name;
  $('edit-handle').value = profile.username;
  $('edit-city').value = profile.city || '';
  $('edit-bio').value = profile.bio || '';
  $('edit-insta').value = profile.instagram || '';
  $('edit-birth').disabled = true;
  $('edit-birth').title = 'A data declarada só pode ser corrigida pelo suporte.';
  db.from('private_profile_data').select('date_of_birth').eq('user_id',state.user.id).maybeSingle()
    .then(({data}) => { if (data?.date_of_birth) $('edit-birth').value = data.date_of_birth; });
  const profileBadge = document.querySelector('#screen-perfil .profile-panel .panel h3 .badge');
  if (profileBadge) profileBadge.textContent = 'Conectado';
  const profileSave = document.querySelector('[data-action="save-profile"]');
  if (profileSave) profileSave.textContent = 'Salvar meu perfil';
  const privacyLabels = document.querySelectorAll('#screen-perfil .profile-panel .two-col .switch-line strong');
  if (privacyLabels[3]) privacyLabels[3].textContent = 'Permitir busca pelo meu @nickname';
  const switches = document.querySelectorAll('#screen-perfil .profile-panel .two-col .switch-line input');
  if (switches[0]) switches[0].checked = profile.avatar_visibility === 'friends';
  if (switches[1]) switches[1].checked = profile.details_visibility === 'friends';
  if (switches[2]) switches[2].checked = Boolean(profile.show_age);
  if (switches[3]) switches[3].checked = Boolean(profile.allow_nickname_lookup);
  const avatar = document.querySelector('.profile-avatar');
  avatar.textContent = profile.display_name.slice(0,1).toUpperCase();
  if (profile.avatar_path) {
    db.storage.from('avatars').createSignedUrl(profile.avatar_path, 90).then(({data}) => {
      if (data?.signedUrl && avatar) avatar.innerHTML = `<img src="${html(safeHttps(data.signedUrl))}" alt="Minha foto de perfil">`;
    });
  }
  if (!$('profile-extra-live')) {
    const extra = document.createElement('div');
    extra.id = 'profile-extra-live';
    extra.className = 'panel profile-live-extras';
    extra.innerHTML = `<h3>🖼️ Minha foto de perfil</h3>
      <form id="avatar-form" class="friend-finder"><input type="file" id="avatar-upload" accept="image/*" aria-label="Enviar foto de perfil"><button class="btn btn-ghost btn-small" type="submit">Salvar foto</button></form>
      <p class="small-muted">Compactamos sua foto para WebP e limitamos o arquivo a 300 KiB. A visibilidade segue suas escolhas.</p>
      <div class="switch-line"><div><strong>🎂 Avisar aniversário aos SQUADs</strong><small>Somente dia e mês, se você permitir.</small></div><input type="checkbox" id="birthday-consent"></div>
      <h3>🔎 Seguir alguém pelo @nickname</h3><form id="friend-form" class="friend-finder"><input id="friend-nick" placeholder="@nickname" maxlength="24" aria-label="Nickname"><button class="btn btn-pink btn-small" type="submit">Seguir</button></form>
      <p class="small-muted" id="friend-result">Seguir alguém não revela seus dados privados. Amizade é recíproca.</p>
      <h3>🛡️ Meus dados e direitos</h3>
      <p class="small-muted">Consulte e solicite acesso, correção, portabilidade ou exclusão dos seus dados pessoais.</p>
      <button class="btn btn-ghost" data-action="privacy-requests">Solicitações LGPD</button>
      <button class="btn btn-ghost hidden" id="moderation-entry" data-action="moderation">Painel de moderação</button>
      <button class="btn btn-ghost" data-action="logout">Sair da conta</button>`;
    document.querySelector('.profile-panel').append(extra);
    $('avatar-form').addEventListener('submit', saveAvatar);
    $('friend-form').addEventListener('submit', followNickname);
  }
  $('birthday-consent').checked = Boolean(profile.share_birthday_to_squads);
  const birthConsent = $('birthday-consent');
  birthConsent.onchange = async () => {
    try {
      await assertOk(db.from('profiles').update({share_birthday_to_squads: birthConsent.checked}).eq('id', state.user.id));
      state.profile.share_birthday_to_squads = birthConsent.checked;
      toast(birthConsent.checked ? 'Aniversário compartilhado somente com seus SQUADs.' : 'Aviso de aniversário desativado.');
    } catch (err) { birthConsent.checked = !birthConsent.checked; toast(err.message); }
  };
  const currentUid = state.user.id;
  db.rpc('moderation_is_staff').then(({data,error}) => {
    if (state.user?.id !== currentUid) return;
    state.isModerator = !error && data === true;
    $('moderation-entry')?.classList.toggle('hidden', !state.isModerator);
  }).catch(() => { state.isModerator = false; });
}

async function saveProfile() {
  const display = $('edit-name').value.trim();
  const username = $('edit-handle').value.trim().replace(/^@/, '').toLowerCase();
  if (!display || !/^[a-z0-9_.]{3,24}$/.test(username)) return toast('Confira seu nome e @nickname.');
  const switches = document.querySelectorAll('#screen-perfil .profile-panel .two-col .switch-line input');
  const payload = {display_name: display, username, city: $('edit-city').value.trim() || null,
    bio: $('edit-bio').value.trim(), instagram: $('edit-insta').value.trim() || null,
    avatar_visibility: switches[0]?.checked ? 'friends' : 'same_event',
    details_visibility: switches[1]?.checked ? 'friends' : 'same_event',
    show_age: Boolean(switches[2]?.checked), allow_nickname_lookup: Boolean(switches[3]?.checked)};
  try {
    const profile = await assertOk(db.from('profiles').update(payload).eq('id', state.user.id).select('*').single());
    state.profile = profile;
    hydrateProfile();
    toast('Perfil atualizado.');
  } catch (err) { toast(err.message); }
}

async function saveAvatar(event) {
  event.preventDefault();
  const file = $('avatar-upload').files?.[0];
  if (!file) return toast('Escolha uma imagem para seu perfil.');
  try {
    const blob = await compressWebp(file, 314572);
    const path = `${state.user.id}/avatar.webp`;
    await assertOk(db.storage.from('avatars').upload(path, blob, {upsert: true,contentType: 'image/webp'}));
    const profile = await assertOk(db.from('profiles').update({avatar_path: path}).eq('id', state.user.id).select('*').single());
    state.profile = profile;
    hydrateProfile();
    toast('Foto de perfil atualizada.');
  } catch (err) { toast(`Falha ao salvar foto: ${err.message}`); }
}

async function followNickname(event) {
  event.preventDefault();
  const nickname = $('friend-nick').value.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_.]{3,24}$/.test(nickname)) return toast('Informe um @nickname válido.');
  if (nickname === state.profile.username) return toast('Você não pode seguir a própria conta.');
  try {
    const found = await assertOk(db.rpc('lookup_nickname', {_nickname: nickname}));
    if (!found?.length) return $('friend-result').textContent = 'Perfil não encontrado ou não disponível para busca.';
    await assertOk(db.from('follows').insert({follower_id: state.user.id, followed_id: found[0].user_id}));
    $('friend-result').textContent = `Você está seguindo @${found[0].username}. Vocês serão amigos quando essa pessoa seguir de volta.`;
    toast(`Agora você segue @${found[0].username}.`);
  } catch (err) { toast(err.code === '23505' ? 'Você já segue esse usuário.' : err.message); }
}

async function loadSquads() {
  const [members, invites] = await Promise.all([
    assertOk(db.from('squad_members').select('squad_id,role').eq('user_id', state.user.id).limit(60)),
    assertOk(db.from('squad_invitations').select('id,squad_id,invited_by,created_at').eq('invitee_id', state.user.id).eq('status', 'pending').limit(25))
  ]);
  state.squadRoles = new Map((members || []).map((item) => [item.squad_id,item.role]));
  state.squadInvites = invites || [];
  const ids = (members || []).map((item) => item.squad_id);
  state.squads = ids.length ? await assertOk(db.from('squads').select('id,name,description,origin_event_id,cover_path,created_at,status').in('id', ids).limit(60)) : [];
  if (!state.activeSquad && state.squads.length) state.activeSquad = state.squads[0].id;
  renderSquads();
}

function renderSquads() {
  const inviteContainer = $('squad-invite');
  inviteContainer.classList.toggle('hidden', !state.squadInvites.length);
  if (state.squadInvites.length) {
    inviteContainer.innerHTML = `<div><strong>💌 ${state.squadInvites.length} convite(s) para SQUAD</strong><p>Você decide se quer participar.</p></div>
      <div class="squad-actions"><button class="btn btn-lime btn-small" data-action="accept-invite" data-id="${html(state.squadInvites[0].id)}">Aceitar</button>
      <button class="btn btn-ghost btn-small" data-action="decline-invite" data-id="${html(state.squadInvites[0].id)}">Recusar</button></div>`;
  }
  const list = document.querySelector('#screen-squad .two-col');
  list.innerHTML = `<div class="panel"><h3>Meus SQUADs</h3>
    ${state.squads.length ? state.squads.map((squad) => `<div class="list-row"><div class="icon-disc">🫶</div><div class="grow"><strong>${html(squad.name)}</strong><p>${html(squad.description || 'Comunidade de amigos')}</p></div>
      <button class="btn btn-pink btn-small" data-action="open-squad" data-id="${html(squad.id)}">Abrir</button></div>`).join('') : '<p class="small-muted">Você ainda não participa de nenhum SQUAD. Depois de um rolê, a galera pode criar um.</p>'}</div>
    <div class="panel"><h3>O que é um SQUAD?</h3><p class="small-muted">Um espaço para continuar conversando, compartilhar informações no mural, convidar amigos por @nickname e organizar encontros futuros.</p>
      <div class="list-row"><div class="icon-disc">🔐</div><div class="grow"><strong>Só entra quem aceitar</strong><p>Convites individuais, sem inclusão automática.</p></div></div>
      <div class="list-row"><div class="icon-disc">🎂</div><div class="grow"><strong>Aniversários opcionais</strong><p>Quem permite, compartilha apenas dia e mês.</p></div></div></div>`;
  const extras = $('squad-live-extras');
  if (!extras) {
    const section = document.createElement('div');
    section.id = 'squad-live-extras';
    section.className = 'panel squad-live-extras';
    list.insertAdjacentElement('afterend', section);
  }
  const current = state.squads.find((row) => row.id === state.activeSquad);
  $('squad-live-extras').innerHTML = current ? `<div class="squad-extras-head"><div><span class="eyebrow">Comunidade selecionada</span><h3>${html(current.name)}</h3></div>
      <div class="squad-actions"><button class="btn btn-pink btn-small" data-action="open-squad" data-id="${html(current.id)}">Abrir conversa</button>
      ${['owner','moderator'].includes(state.squadRoles.get(current.id)) ? `<button class="btn btn-ghost btn-small" data-action="rename-squad" data-id="${html(current.id)}">Renomear</button>` : ''}
      ${state.squadRoles.get(current.id) !== 'owner' ? `<button class="btn btn-ghost btn-small" data-action="leave-squad" data-id="${html(current.id)}">Sair do SQUAD</button>` : ''}</div></div>
      <div class="two-col"><div><h3>Convidar pelo @nickname</h3><p class="small-muted">Somente dono ou moderador do SQUAD pode enviar convites.</p>
      <form id="squad-invite-form" class="friend-finder"><input id="squad-nick" placeholder="@amigo" aria-label="Nickname do convidado" maxlength="24"><button class="btn btn-ghost btn-small">Convidar</button></form>
      <p class="small-muted" id="squad-invite-result"></p></div>
      <div><div class="calendar-head"><h3>🗓️ Calendário e aniversários</h3><input id="squad-month" type="month" aria-label="Mês do calendário"></div>
      <div id="squad-calendar"></div><button class="btn btn-ghost btn-small" data-action="add-calendar" data-id="${html(current.id)}">Adicionar encontro</button></div></div>` :
    '<p class="small-muted">Selecione um SQUAD para visualizar o calendário e enviar convites.</p>';
  if (current) {
    $('squad-month').value = new Date().toISOString().slice(0, 7);
    $('squad-month').addEventListener('change', () => renderSquadCalendar(current.id));
    $('squad-invite-form').addEventListener('submit', (event) => inviteNickname(event, current.id));
    renderSquadCalendar(current.id);
  }
  icons();
}

async function createSquad(eventId) {
  const name = prompt('Como sua galera vai chamar o SQUAD? (3 a 65 caracteres)');
  if (!name?.trim()) return;
  try {
    const row = await assertOk(db.from('squads').insert({origin_event_id: eventId,
      creator_id: state.user.id, name: name.trim().slice(0,65)}).select('id').single());
    state.activeSquad = row.id;
    await loadSquads();
    navigate('squad');
    toast('SQUAD criado! Convide amigos para continuar o papo.');
  } catch (err) { toast(err.message); }
}

async function renameSquad(id) {
  const current = state.squads.find((row) => row.id === id);
  if (!current) return;
  const nextName = prompt('Novo nome do SQUAD (3–65 caracteres):',current.name);
  if (!nextName || nextName.trim().length < 3 || nextName.trim().length > 65) return;
  try {
    await assertOk(db.from('squads').update({name:nextName.trim()}).eq('id',id));
    await loadSquads();
    toast('Nome do SQUAD atualizado.');
  } catch(err) { toast(err.message); }
}

async function leaveSquad(id) {
  if (!confirm('Você quer mesmo sair deste SQUAD?')) return;
  try {
    await assertOk(db.rpc('leave_squad',{_squad:id}));
    state.activeSquad = null;
    await loadSquads();
    toast('Você saiu do SQUAD.');
  } catch(err) { toast(err.message); }
}

function leaveRoom() {
  if (state.chatChannel && db) db.removeChannel(state.chatChannel);
  state.chatChannel = null;
  state.activeRoom = null;
}

async function openRoom(type, id) {
  if (type === 'event' && !state.joined.has(id)) return toast('Confirme participação antes de entrar no chat.');
  if (type === 'squad' && !state.squadRoles.has(id)) return toast('Você não participa desse SQUAD.');
  leaveRoom();
  const title = type === 'event' ? state.events.find((row) => row.id === id)?.title : state.squads.find((row) => row.id === id)?.name;
  state.activeRoom = {type,id};
  if (type === 'squad') state.activeSquad = id;
  showModal(`${title || 'Grupo'} 💬`, `<div class="room-topline"><span>🔒 Apenas integrantes têm acesso a esta conversa.</span><button class="btn btn-ghost btn-small" data-action="room-members">Integrantes</button></div>
    <div class="chat-tabs"><button class="active" data-room-tab="chat">Chat</button><button data-room-tab="mural">Mural 📌</button>
    ${type === 'event' ? '<button data-room-tab="music">Músicas 🎵</button>' : ''}
    <button data-action="report" data-kind="${type}" data-id="${html(id)}">Denunciar</button></div>
    <div id="room-content" class="room-content"></div>`);
  $('dialog-body').className = 'dialog-content room-panel';
  await changeRoomTab('chat');
  const table = type === 'event' ? 'event_messages' : 'squad_messages';
  const foreignKey = type === 'event' ? 'event_id' : 'squad_id';
  state.chatChannel = db.channel(`bora-${type}-${id}-${Date.now()}`).on('postgres_changes',
    {event:'INSERT',schema:'public',table,filter:`${foreignKey}=eq.${id}`}, () => {
      if (state.activeRoom?.id === id && document.querySelector('[data-room-tab="chat"].active')) refreshRoomChat();
    }).subscribe();
}

async function changeRoomTab(tab) {
  const room = state.activeRoom;
  if (!room) return;
  document.querySelectorAll('[data-room-tab]').forEach((button) => button.classList.toggle('active', button.dataset.roomTab === tab));
  const target = $('room-content');
  target.innerHTML = '<div class="room-loading">Carregando…</div>';
  if (tab === 'chat') {
    target.innerHTML = `<p class="legal-note">⏳ As mensagens comuns são temporárias: limpeza automática depois de aproximadamente sete dias. ${room.type === 'event' ? 'O envio de novas mensagens neste grupo encerra até dois dias após o fim do evento; depois, continuem a conversa num SQUAD. ' : ''}Informações importantes devem ir para o mural, que não é apagado com o chat.</p>
      <div class="chat-messages" id="chat-messages"></div>
      <form class="chat-form" id="chat-form"><input id="chat-text" maxlength="800" placeholder="Converse com respeito (até 800 caracteres)…" aria-label="Mensagem" required><button class="btn btn-pink" aria-label="Enviar mensagem"><i data-lucide="send"></i></button></form>`;
    $('chat-form').addEventListener('submit', sendMessage);
    await refreshRoomChat();
  } else if (tab === 'mural') {
    target.innerHTML = `<p class="small-muted">Informações e links importantes ficam aqui, mesmo depois da limpeza do chat.</p><div id="mural-items"></div>
      <form id="pin-form" class="pin-form"><input name="title" maxlength="90" required placeholder="Título do aviso"><textarea name="body" maxlength="900" placeholder="Descrição ou combinado"></textarea>
      <input name="link_url" type="url" placeholder="Link https:// (opcional)"><button class="btn btn-ghost" type="submit">📌 Fixar informação</button></form>`;
    $('pin-form').addEventListener('submit', addPin);
    await refreshRoomPins();
  } else if (tab === 'music' && room.type === 'event') {
    const event = state.events.find((row) => row.id === room.id);
    target.innerHTML = `<p class="small-muted">🎵 Cada participante pode indicar músicas do Spotify para animar o encontro. A lista de sugestões abaixo pertence ao Bora Pro Rolê. <strong>Ela não altera automaticamente a playlist no Spotify.</strong></p>
      ${event?.playlist ? `<div class="room-spotify">${spotifyEmbed(event.playlist)}<a href="${html(event.playlist)}" target="_blank" rel="noopener noreferrer">Abrir playlist no Spotify ↗</a></div>` : '<p class="legal-note">O organizador ainda não vinculou uma playlist oficial ao evento.</p>'}
      <form id="song-form" class="song-form"><label>Link da música no Spotify<input name="spotify_track_url" type="url" required placeholder="https://open.spotify.com/track/..."></label>
      <label>Nome da música / artista<input name="title" maxlength="120" minlength="2" required placeholder="Ex.: Nome da música — Artista"></label>
      <button type="submit" class="btn btn-pink">+ Sugerir música</button></form><div id="song-list"></div>`;
    $('song-form').addEventListener('submit', addSongSuggestion);
    await refreshSongs();
  }
  icons();
}

async function refreshRoomChat() {
  const room = state.activeRoom;
  const target = $('chat-messages');
  if (!room || !target) return;
  const table = room.type === 'event' ? 'event_messages' : 'squad_messages';
  const key = room.type === 'event' ? 'event_id' : 'squad_id';
  try {
    const list = await assertOk(db.from(table).select('id,author_id,body,created_at').eq(key,room.id)
      .order('created_at',{ascending:false}).limit(50));
    if (!state.activeRoom || state.activeRoom.id !== room.id || !$('chat-messages')) return;
    const messages = (list || []).reverse();
    target.innerHTML = messages.length ? messages.map((message) => `<div class="bubble ${message.author_id === state.user.id ? 'mine' : ''}">
      <small>${message.author_id === state.user.id ? 'Você' : 'Integrante'} · ${html(new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(message.created_at)))}</small>
      <span>${html(message.body)}</span>
      ${message.author_id !== state.user.id ? `<button class="bubble-report" title="Denunciar mensagem" data-action="report" data-kind="${room.type}_message" data-id="${message.id}">Denunciar</button>` : ''}</div>`).join('') :
      '<p class="small-muted">A conversa ainda está vazia. Que tal mandar um “oi”? 💜</p>';
    target.scrollTop = target.scrollHeight;
  } catch (err) { target.textContent = `Chat indisponível: ${err.message}`; }
}

async function sendMessage(event) {
  event.preventDefault();
  const room = state.activeRoom;
  if (!room) return;
  const body = $('chat-text')?.value.trim();
  if (!body || body.length > 800) return;
  const table = room.type === 'event' ? 'event_messages' : 'squad_messages';
  const key = room.type === 'event' ? 'event_id' : 'squad_id';
  try {
    await assertOk(db.from(table).insert({[key]: room.id, author_id:state.user.id, body}));
    $('chat-text').value = '';
    await refreshRoomChat();
  } catch (err) { toast(err.message); }
}

async function refreshRoomPins() {
  const room = state.activeRoom;
  const target = $('mural-items');
  if (!room || !target) return;
  const key = room.type === 'event' ? 'event_id' : 'squad_id';
  try {
    const rows = await assertOk(db.from('room_pins').select('id,title,body,link_url,author_id').eq(key,room.id).order('created_at',{ascending:false}).limit(50));
    if (state.activeRoom?.id !== room.id || !$('mural-items')) return;
    target.innerHTML = rows.length ? rows.map((row) => `<div class="mural-item"><strong>${html(row.title)}</strong><p>${html(row.body)}</p>
      ${safeHttps(row.link_url) ? `<a href="${html(safeHttps(row.link_url))}" target="_blank" rel="noopener noreferrer">Abrir link ↗</a>` : ''}
      ${row.author_id === state.user.id ? `<button class="inline-button" data-action="delete-pin" data-id="${html(row.id)}">Remover</button>` : ''}</div>`).join('') :
      '<p class="small-muted">Ainda não há informações fixadas.</p>';
  } catch (err) { target.textContent = err.message; }
}

async function addPin(event) {
  event.preventDefault();
  const room = state.activeRoom;
  if (!room) return;
  const form = Object.fromEntries(new FormData(event.target));
  const link = String(form.link_url || '').trim();
  if (link && !safeHttps(link)) return toast('Use link iniciado por https://');
  try {
    const key = room.type === 'event' ? 'event_id' : 'squad_id';
    await assertOk(db.from('room_pins').insert({[key]:room.id,title:form.title.trim(),
      body:form.body?.trim() || '',link_url:link || null}));
    event.target.reset();
    await refreshRoomPins();
  } catch (err) { toast(err.message); }
}

async function refreshSongs() {
  const room = state.activeRoom;
  const target = $('song-list');
  if (!room || room.type !== 'event' || !target) return;
  try {
    const rows = await assertOk(db.from('event_song_suggestions').select('id,user_id,title,spotify_track_id,created_at')
      .eq('event_id',room.id).order('created_at',{ascending:false}).limit(50));
    if (state.activeRoom?.id !== room.id || !$('song-list')) return;
    target.innerHTML = `<h3>🎼 Músicas sugeridas (${rows.length})</h3>` + (rows.length ? rows.map((row) =>
      `<div class="song-item"><div class="music-icon">♫</div><div><strong>${html(row.title)}</strong><small>Indicação de integrante</small></div>
        <a href="https://open.spotify.com/track/${row.spotify_track_id}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-small">Ouvir ↗</a>
        ${row.user_id === state.user.id ? `<button class="inline-button" data-action="remove-song" data-id="${row.id}">Remover</button>` : ''}</div>`).join('') :
      '<p class="small-muted">Nenhuma música sugerida ainda. Comece a trilha do rolê!</p>');
  } catch (err) { target.textContent = err.message; }
}

async function addSongSuggestion(event) {
  event.preventDefault();
  const room = state.activeRoom;
  if (room?.type !== 'event') return;
  const form = Object.fromEntries(new FormData(event.target));
  const trackId = spotifyId(form.spotify_track_url,'track');
  if (!trackId) return toast('Cole o link oficial de uma música do Spotify.');
  try {
    await assertOk(db.from('event_song_suggestions').insert({event_id:room.id,spotify_track_id:trackId,title:form.title.trim()}));
    event.target.reset();
    await refreshSongs();
    toast('Música adicionada às sugestões do grupo!');
  } catch (err) { toast(err.code === '23505' ? 'Essa música já foi sugerida neste rolê.' : err.message); }
}

async function openRoomMembers() {
  const room = state.activeRoom;
  if (!room) return;
  const table = room.type === 'event' ? 'event_members' : 'squad_members';
  const key = room.type === 'event' ? 'event_id' : 'squad_id';
  try {
    const query = db.from(table).select('user_id').eq(key,room.id).limit(20);
    if (room.type === 'event') query.eq('status','joined');
    const rows = await assertOk(query);
    const profiles = await Promise.all(rows.map(async (row) => {
      try {
        const card = await assertOk(db.rpc('get_profile_card',{_target:row.user_id}));
        return card?.[0] || null;
      } catch { return null; }
    }));
    const visible = profiles.filter(Boolean);
    const withAvatar = visible.filter((profile) => profile.avatar_path);
    if (withAvatar.length) {
      const signed = await db.storage.from('avatars').createSignedUrls(withAvatar.map((p) => p.avatar_path),90);
      if (!signed.error) withAvatar.forEach((profile,i) => {profile.avatarUrl=safeHttps(signed.data[i]?.signedUrl);});
    }
    showModal('Participantes deste grupo', `<p class="small-muted">Exibindo até 20 perfis. Dados e fotos aparecem somente conforme as permissões de cada usuário.</p>
      ${visible.map((profile) => `<div class="list-row"><div class="icon-disc">${profile.avatarUrl ? `<img src="${html(profile.avatarUrl)}" alt="Foto de @${html(profile.username)}" class="member-photo">` : '👤'}</div><div class="grow"><strong>@${html(profile.username)}</strong>
        <p>${html(profile.bio || 'Perfil privado')}${profile.city ? ` · ${html(profile.city)}` : ''}</p></div>
        ${profile.user_id !== state.user.id ? `<div class="member-actions"><button class="btn btn-ghost btn-small" data-action="report" data-kind="user" data-id="${html(profile.user_id)}">Denunciar</button>
          <button class="btn btn-ghost btn-small" data-action="block-user" data-id="${html(profile.user_id)}">Bloquear</button></div>` : ''}</div>`).join('') || '<p class="small-muted">Nenhum perfil pode ser exibido com suas permissões atuais.</p>'}
      <button class="btn btn-ghost" data-action="close-modal">Fechar</button>`);
    leaveRoom();
  } catch (err) { toast(err.message); }
}

function openReport(kind, target) {
  leaveRoom();
  showModal('Denunciar à moderação 🛡️', `<p class="legal-note">Denúncias ficam restritas à equipe de moderação. Em situação de risco imediato, ligue 190. Esta ação não substitui as autoridades.</p>
    <form id="report-form"><div class="field"><label>Motivo<select name="reason" required>
      <option value="harassment">Assédio, ameaça ou violência</option><option value="discrimination">Racismo, LGBTfobia ou discriminação</option>
      <option value="fraud">Golpe ou fraude</option><option value="minor">Suspeita de menor de idade</option>
      <option value="illegal">Conteúdo ilegal</option><option value="privacy">Violação de privacidade</option><option value="other">Outro</option></select></label></div>
      <div class="field"><label>Explique o ocorrido<textarea name="details" maxlength="2000" required placeholder="O que aconteceu? Não publique dados sensíveis de terceiros."></textarea></label></div>
      <button class="btn btn-pink" type="submit">Enviar denúncia</button></form>`);
  $('report-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    try {
      await assertOk(db.rpc('submit_report',{_target_kind:kind,_target_id:String(target),_reason:data.reason,_details:data.details.trim()}));
      closeModal(); toast('Denúncia registrada para análise.');
    } catch (err) { toast(`Falha ao registrar denúncia: ${err.message}`); }
  });
}

async function openNotifications() {
  try {
    const rows = await assertOk(db.from('notifications').select('id,kind,message,created_at,read_at').eq('user_id',state.user.id)
      .order('created_at',{ascending:false}).limit(30));
    showModal('Suas notificações 🔔', rows.length ? rows.map((item) => `<div class="list-row"><div class="icon-disc">🔔</div>
      <div class="grow"><strong>${html(item.message)}</strong><p>${html(displayDate(item.created_at))}</p></div></div>`).join('') :
      '<p class="small-muted">Nenhuma notificação por enquanto.</p>');
    await db.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',state.user.id).is('read_at',null);
  } catch (err) { toast(err.message); }
}

async function deletePin(id) {
  if (!confirm('Remover esta informação fixada?')) return;
  try { await assertOk(db.from('room_pins').delete().eq('id',id)); await refreshRoomPins(); }
  catch (err) { toast(err.message); }
}

async function removeSong(id) {
  if (!confirm('Remover esta sugestão musical?')) return;
  try { await assertOk(db.from('event_song_suggestions').delete().eq('id',id)); await refreshSongs(); }
  catch (err) { toast(err.message); }
}

async function blockUser(id) {
  if (!confirm('Bloquear este usuário? Você deixará de ver as informações e mensagens que as regras permitem ocultar.')) return;
  try {
    await assertOk(db.from('user_blocks').insert({blocker_id:state.user.id,blocked_id:id}));
    closeModal();
    toast('Usuário bloqueado.');
  } catch (err) { toast(err.code === '23505' ? 'Este usuário já está bloqueado.' : err.message); }
}

async function openAccount() {
  showModal('Senha e segurança 🔐', `<p class="small-muted">Sua senha pode ser alterada com segurança pelo Supabase Auth. Para recuperar uma senha esquecida, saia da conta e use “Esqueci a senha”.</p>
    <form id="account-password-form"><div class="field"><label>Nova senha<input name="password" type="password" minlength="8" autocomplete="new-password" required></label></div>
    <button class="btn btn-pink" type="submit">Alterar minha senha</button></form>
    <p class="legal-note">Nunca compartilhe seu código de recuperação, senha ou links de acesso. A exclusão completa de conta ainda depende de um canal seguro de suporte.</p>`);
  $('account-password-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(event.target));
      await assertOk(db.auth.updateUser({password:data.password}));
      closeModal(); toast('Senha atualizada.');
    } catch (err) { toast(err.message); }
  });
}

async function openPrivacyRequests() {
  try {
    const rows = await assertOk(db.from('privacy_requests')
      .select('id,kind,details,status,staff_response,created_at,updated_at')
      .eq('requester_id',state.user.id).order('created_at',{ascending:false}).limit(20));
    const labels = {access:'Acesso aos dados',correction:'Correção de dados',portability:'Portabilidade',
      deletion:'Exclusão da conta/dados',opposition:'Oposição ao tratamento',other:'Outra solicitação'};
    showModal('Seus dados e direitos — LGPD', `<p class="small-muted">Este canal registra seu pedido para análise humana. Não exclui a conta automaticamente. Solicitações não são públicas; algumas informações podem exigir retenção legal. O atendimento será registrado aqui.</p>
      <form id="privacy-request-form" class="privacy-form"><label>O que deseja solicitar?
        <select name="kind" required>${Object.entries(labels).map(([key,label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
        <label>Detalhes do pedido (opcional)<textarea name="details" maxlength="2000" rows="3" placeholder="Explique o que você deseja. Não inclua documentos ou informações sensíveis de terceiros."></textarea></label>
        <button class="btn btn-pink" type="submit">Registrar solicitação</button></form>
      <h3 style="margin-top:20px">Histórico de pedidos</h3><div class="mod-list">
        ${rows.length ? rows.map(row => `<article class="mod-card"><strong>${html(labels[row.kind] || row.kind)}</strong>
        <small>${html(displayDate(row.created_at))} · ${html(row.status)}</small>
        ${row.details ? `<p>${html(row.details)}</p>` : ''}
        ${row.staff_response ? `<p><strong>Resposta:</strong> ${html(row.staff_response)}</p>` : ''}</article>`).join('') : '<p class="small-muted">Nenhum pedido registrado.</p>'}
      </div>`);
    $('privacy-request-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target));
      const submitter = event.submitter;
      submitter.disabled = true;
      try {
        await assertOk(db.from('privacy_requests').insert({kind:data.kind,details:String(data.details || '').trim()}));
        toast('Solicitação registrada. Acompanhe o andamento neste painel.');
        await openPrivacyRequests();
      } catch (err) { toast(`Não foi possível registrar: ${err.message}`); }
      finally { submitter.disabled = false; }
    });
  } catch (err) { toast(err.message); }
}

async function openModeration() {
  if (!state.isModerator) return toast('Acesso reservado à moderação.');
  try {
    const [events,reports,privacy] = await Promise.all([
      assertOk(db.from('events').select('id,title,description,category,starts_at,venue_name,address,city,state_code,cover_path,venue_instagram,ticket_url,creator_id,requires_verified_age,screening_reason').eq('status','pending').eq('needs_review',true).order('created_at',{ascending:true}).limit(25)),
      assertOk(db.from('reports').select('id,target_kind,target_id,reason,details,evidence_snapshot,status,created_at').in('status',['pending','reviewing']).order('created_at',{ascending:true}).limit(40)),
      assertOk(db.from('privacy_requests').select('id,requester_id,kind,details,status,created_at').in('status',['pending','in_progress']).order('created_at',{ascending:true}).limit(30))
    ]);
    const covers = (events || []).filter(row => row.cover_path);
    if (covers.length) {
      const {data} = await db.storage.from('event-covers').createSignedUrls(covers.map(row=>row.cover_path),90);
      if (data) covers.forEach((row,i)=>{row.coverUrl=safeHttps(data[i]?.signedUrl);});
    }
    const priority = {minor:0,illegal:1,harassment:2,discrimination:3,fraud:4,privacy:5,other:6};
    reports.sort((a,b)=>(priority[a.reason] ?? 9)-(priority[b.reason] ?? 9));
    const risk = {minor:'URGENTE · Menor de idade',illegal:'URGENTE · Conteúdo ilegal',harassment:'Assédio/violência',
      discrimination:'Discriminação',fraud:'Golpe',privacy:'Privacidade',other:'Outro'};
    showModal('Central de moderação 🛡️', `<p class="legal-note">Área restrita. Eventos comuns são publicados automaticamente; esta fila recebe sinais de risco. O filtro por palavras não examina imagens nem substitui denúncias e avaliação humana. Denúncias urgentes exigem prioridade; o painel não substitui autoridades.</p>
      <h3>⏳ Eventos aguardando análise (${events.length})</h3><div class="mod-list">${events.length ? events.map(row => `<article class="mod-card">
        ${row.coverUrl ? `<img src="${html(row.coverUrl)}" alt="Capa a revisar" class="mod-cover">` : ''}
        <strong>${html(row.title)}</strong><small>${html(displayDate(row.starts_at))} · ${html(row.category)}</small>
        <p>${html(row.description)}</p><p>📍 ${html(row.venue_name || '')} · ${html(row.address)} · ${html(row.city)} / ${html(row.state_code)}</p>
        <p>Organizador: ${html(row.creator_id)} ${row.requires_verified_age ? ' · EXIGE VERIFICAÇÃO INDEPENDENTE' : ''}</p>
        ${row.screening_reason ? `<p><strong>Alerta automático:</strong> ${html(row.screening_reason)}</p>` : ''}
        ${safeHttps(row.ticket_url) ? `<a href="${html(safeHttps(row.ticket_url))}" target="_blank" rel="noopener noreferrer">Revisar ingressos ↗</a>` : ''}
        ${row.venue_instagram ? `<p>Instagram informado: ${html(row.venue_instagram)}</p>` : ''}
        ${safeHttps(row.venue_instagram) ? `<a href="${html(safeHttps(row.venue_instagram))}" target="_blank" rel="noopener noreferrer">Revisar Instagram ↗</a>` : ''}
        <div class="mod-actions"><button class="btn btn-ghost btn-small" data-action="mod-event" data-decision="rejected" data-id="${html(row.id)}">Rejeitar</button>
        <button class="btn btn-pink btn-small" data-action="mod-event" data-decision="published" data-id="${html(row.id)}">Aprovar após conferir</button></div></article>`).join('') : '<p class="small-muted">Nenhum evento pendente.</p>'}</div>
      <h3>🚩 Denúncias abertas (${reports.length})</h3><div class="mod-list">${reports.length ? reports.map(row => `<article class="mod-card">
        <strong>${html(risk[row.reason] || row.reason)}</strong><small>${html(displayDate(row.created_at))} · ${html(row.status)}</small>
        <p>Tipo: ${html(row.target_kind)} · ID: ${html(row.target_id)}</p><p>${html(row.details || 'Sem detalhes adicionais.')}</p>
        ${row.evidence_snapshot ? `<p><strong>Registro preservado:</strong> ${html(row.evidence_snapshot)}</p>` : ''}
        <div class="mod-actions"><button class="btn btn-ghost btn-small" data-action="mod-report" data-decision="reviewing" data-id="${html(row.id)}">Em análise</button>
        ${row.target_kind!=='user' ? `<button class="btn btn-ghost btn-small" data-action="mod-remove" data-kind="${html(row.target_kind)}" data-id="${html(row.target_id)}">Remover conteúdo</button>` : ''}
        ${row.target_kind==='user' ? `<button class="btn btn-ghost btn-small" data-action="mod-suspend" data-id="${html(row.target_id)}">Suspender conta (admin)</button>` : ''}
        <button class="btn btn-pink btn-small" data-action="mod-report" data-decision="resolved" data-id="${html(row.id)}">Concluir análise</button>
        <button class="btn btn-ghost btn-small" data-action="mod-report" data-decision="dismissed" data-id="${html(row.id)}">Improcedente</button></div></article>`).join('') : '<p class="small-muted">Nenhuma denúncia pendente.</p>'}</div>
      <h3>🔐 Pedidos LGPD (${privacy.length})</h3><div class="mod-list">${privacy.length ? privacy.map(row => `<article class="mod-card">
        <strong>${html(row.kind)}</strong><small>${html(displayDate(row.created_at))} · ${html(row.status)}</small>
        <p>Usuário: ${html(row.requester_id || 'Conta removida')}</p><p>${html(row.details || 'Sem observações.')}</p>
        <div class="mod-actions"><button class="btn btn-ghost btn-small" data-action="mod-privacy" data-decision="in_progress" data-id="${html(row.id)}">Em atendimento</button>
        <button class="btn btn-pink btn-small" data-action="mod-privacy" data-decision="completed" data-id="${html(row.id)}">Concluído após atender</button>
        <button class="btn btn-ghost btn-small" data-action="mod-privacy" data-decision="declined" data-id="${html(row.id)}">Indeferir justificando</button></div></article>`).join('') : '<p class="small-muted">Nenhum pedido LGPD pendente.</p>'}</div>
      <button class="btn btn-ghost" data-action="moderation">Atualizar filas</button>`);
  } catch (err) { toast(`Falha ao carregar moderação: ${err.message}`); }
}

async function performModeration(action, el) {
  if (!state.isModerator) return;
  const reason = prompt('Informe o motivo detalhado e objetivo (mínimo 8 caracteres). Essa decisão ficará registrada:');
  if (reason === null) return;
  if (reason.trim().length < 8) return toast('O motivo precisa ter pelo menos 8 caracteres.');
  try {
    if (action === 'mod-event') await assertOk(db.rpc('moderation_review_event',{_event:el.dataset.id,_decision:el.dataset.decision,_reason:reason.trim()}));
    if (action === 'mod-report') await assertOk(db.rpc('moderation_review_report',{_report:el.dataset.id,_decision:el.dataset.decision,_reason:reason.trim()}));
    if (action === 'mod-remove') await assertOk(db.rpc('moderation_remove_content',{_kind:el.dataset.kind,_target:el.dataset.id,_reason:reason.trim()}));
    if (action === 'mod-suspend') await assertOk(db.rpc('moderation_set_account',{_user:el.dataset.id,_status:'suspended',_reason:reason.trim()}));
    if (action === 'mod-privacy') await assertOk(db.rpc('moderation_review_privacy_request',{_request:el.dataset.id,_decision:el.dataset.decision,_response:reason.trim()}));
    toast('Ação registrada com auditoria.');
    await openModeration();
    if (action === 'mod-event') await loadEvents();
  } catch (err) { toast(`Não foi possível concluir: ${err.message}`); }
}

function closeAndLeaveRoom() { leaveRoom(); closeModal(); }

async function handleAction(action, element) {
  const id = element.dataset.id;
  try {
    switch (action) {
      case 'spotify-load': {
        const kind = element.dataset.spotifyKind;
        const trackId = element.dataset.spotifyId;
        if (!['track','playlist'].includes(kind) || !/^[A-Za-z0-9]{22}$/.test(trackId)) return;
        const shell = element.closest('.spotify-optin');
        if (shell) shell.innerHTML = `<iframe title="Player do Spotify" loading="lazy" src="https://open.spotify.com/embed/${kind}/${trackId}?utm_source=generator" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
        return;
      }
      case 'create': return openCreate();
      case 'join': return await joinEvent(id);
      case 'safety': closeAndLeaveRoom(); return navigate('seguranca');
      case 'save-profile': return await saveProfile();
      case 'notifications': return await openNotifications();
      case 'account': return await openAccount();
      case 'privacy-requests': return await openPrivacyRequests();
      case 'moderation': return await openModeration();
      case 'mod-event': case 'mod-report': case 'mod-remove': case 'mod-suspend': case 'mod-privacy':
        return await performModeration(action, element);
      case 'logout': return await authAction('logout');
      case 'open-squad': return await openRoom('squad', id);
      case 'create-squad': return await createSquad(id);
      case 'rename-squad': return await renameSquad(id);
      case 'leave-squad': return await leaveSquad(id);
      case 'accept-invite': return await respondInvite(id, true);
      case 'decline-invite': return await respondInvite(id, false);
      case 'add-calendar': return openCalendarForm(id);
      case 'room-members': return await openRoomMembers();
      case 'delete-pin': return await deletePin(id);
      case 'remove-song': return await removeSong(id);
      case 'block-user': return await blockUser(id);
      case 'close-modal': return closeAndLeaveRoom();
      case 'report': return openReport(element.dataset.kind || 'event', id || state.activeEvent);
      default: return;
    }
  } catch (err) { toast(err.message); }
}

document.addEventListener('click', (event) => {
  const authButton = event.target.closest('[data-auth]');
  if (authButton) { event.preventDefault(); return authAction(authButton.dataset.auth); }

  const save = event.target.closest('[data-save]');
  if (save) { event.preventDefault(); event.stopPropagation(); return saveEvent(save.dataset.save); }
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) { event.preventDefault(); return handleAction(actionButton.dataset.action, actionButton); }
  const nav = event.target.closest('[data-nav]');
  if (nav) return navigate(nav.dataset.nav);
  const screenLink = event.target.closest('[data-screen-link]');
  if (screenLink) { event.preventDefault(); return navigate(screenLink.dataset.screenLink); }
  const category = event.target.closest('[data-category]');
  if (category) { state.category = category.dataset.category; renderChips(); return renderEvents(); }
  const view = event.target.closest('[data-view]');
  if (view) return setView(view.dataset.view);
  const tab = event.target.closest('[data-room-tab]');
  if (tab) return changeRoomTab(tab.dataset.roomTab);
  const eventCard = event.target.closest('[data-event]');
  if (eventCard) return openDetails(eventCard.dataset.event);
  const season = event.target.closest('[data-season]');
  if (season) { state.category = season.dataset.season; renderChips(); renderEvents(); navigate('explorar'); }
});

document.addEventListener('submit', (event) => {
  const key = ({'login-form':'login','signup-form':'signup','forgot-form':'forgot','resend-form':'resend',
    'reset-form':'reset','birth-form':'birth','birth-confirm-form':'confirm-birth','onboard-profile-form':'profile','legal-form':'legal'})[event.target.id];
  if (key) { event.preventDefault(); authAction(key, event.target); }
});

$('modal-close').addEventListener('click', closeAndLeaveRoom);
$('modal').addEventListener('click', (event) => { if (event.target === $('modal')) closeAndLeaveRoom(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('modal').classList.contains('hidden')) closeAndLeaveRoom();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('global-search').focus(); }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.event-card')) {
    event.preventDefault(); openDetails(event.target.dataset.event);
  }
});

$('global-search').addEventListener('input', (event) => {
  state.search = event.target.value.trim().toLowerCase();
  navigate('explorar'); renderEvents();
});

function applyTheme(theme) {
  theme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme === 'light' ? '#f8f7fa' : '#12101d');
  try { localStorage.setItem('bora_theme', theme); } catch (_) { /* Navegação privada pode bloquear armazenamento. */ }
  $('theme-toggle').innerHTML = theme === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
  icons();
}
$('theme-toggle').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
applyTheme(document.documentElement.dataset.theme || 'dark');
window.addEventListener('storage', (event) => {
  if (event.key === 'bora_theme') applyTheme(event.newValue || 'dark');
});

const debugBanner = $('app-status');
debugBanner.textContent = '';
debugBanner.classList.add('hidden');
showGate('loading');
if (!db) showGate('offline');
else {
  let recoveringPassword = false;
  let confirmingEmail = emailConfirmationReturn;
  db.auth.onAuthStateChange((event) => {
    if (confirmingEmail) return; // Não abrir automaticamente a área social durante a confirmação.
    if (event === 'PASSWORD_RECOVERY') { recoveringPassword = true; return showGate('reset'); }
    if (recoveringPassword && event !== 'SIGNED_OUT' && event !== 'USER_UPDATED') return;
    if (event === 'USER_UPDATED') recoveringPassword = false;
    if (event === 'TOKEN_REFRESHED' && state.opened) return;
    setTimeout(() => syncSession().catch((err) => { showGate('blocked'); feedback(err.message); }), 0);
  });
  if (confirmingEmail) {
    // O Supabase confirma o e-mail ANTES de voltar ao Pages e entrega a sessão no fragmento.
    // Depois de o SDK processá-la, encerramos a sessão e mostramos o formulário de login.
    (async () => {
      try {
        if (confirmationError) throw Error('Este link de confirmação é inválido ou expirou. Solicite um novo link.');
        const session = await assertOk(db.auth.getSession());
        if (!session?.session) throw Error('Não foi possível concluir a confirmação. Solicite um novo link se necessário.');
        const identity = await assertOk(db.auth.getUser());
        if (!identity?.user?.email_confirmed_at) throw Error('O e-mail ainda não consta como confirmado. Solicite um novo link.');
        await assertOk(db.auth.signOut());
        confirmingEmail = false;
        history.replaceState(history.state, '', currentRedirect());
        showGate('login');
        feedback('E-mail confirmado com sucesso! Agora entre com seu e-mail e senha.', false);
      } catch (err) {
        confirmingEmail = false;
        history.replaceState(history.state, '', currentRedirect());
        showGate('login');
        feedback(err.message || 'Não foi possível confirmar seu e-mail. Solicite um novo link.');
      }
    })();
  } else {
    syncSession().catch((err) => { showGate('blocked'); feedback(err.message); });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - state.lastSessionCheck > 180000) {
      syncSession().catch(() => toast('Não foi possível atualizar sua sessão. Confira a conexão.'));
    }
  });
  window.addEventListener('online', () => {
    if (Date.now() - state.lastSessionCheck > 180000) {
      syncSession().catch(() => {});
    }
  });
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

async function inviteNickname(event, squadId) {
  event.preventDefault();
  const nickname = $('squad-nick').value.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_.]{3,24}$/.test(nickname)) return toast('Nickname inválido.');
  try {
    const found = await assertOk(db.rpc('lookup_nickname', {_nickname: nickname}));
    if (!found?.length) return $('squad-invite-result').textContent = 'Nickname indisponível.';
    await assertOk(db.from('squad_invitations').insert({squad_id: squadId,invitee_id:found[0].user_id}));
    $('squad-invite-result').textContent = `Convite enviado a @${found[0].username}. Ela(e) precisa aceitar.`;
  } catch (err) { toast(err.message); }
}

async function respondInvite(id, accepted) {
  try {
    await assertOk(db.rpc(accepted ? 'accept_squad_invitation' : 'decline_squad_invitation', {_invite: id}));
    await loadSquads();
    toast(accepted ? 'Você entrou no SQUAD!' : 'Convite recusado.');
  } catch (err) { toast(err.message); }
}

async function renderSquadCalendar(squadId) {
  const target = $('squad-calendar');
  if (!target) return;
  const value = $('squad-month')?.value || new Date().toISOString().slice(0,7);
  const [year, month] = value.split('-').map(Number);
  if (!year || month < 1 || month > 12) return;
  const from = new Date(Date.UTC(year,month-1,1)).toISOString();
  const to = new Date(Date.UTC(year,month,1)).toISOString();
  try {
    const [calendar, birthdays] = await Promise.all([
      assertOk(db.from('squad_calendar').select('id,title,starts_at').eq('squad_id',squadId).gte('starts_at',from).lt('starts_at',to).limit(100)),
      assertOk(db.rpc('get_squad_birthdays',{_squad: squadId,_month: month}))
    ]);
    if (!$('squad-calendar') || state.activeSquad !== squadId) return;
    const items = [
      ...(calendar || []).map((row) => ({day: new Date(row.starts_at).getDate(),text: row.title,icon:'📅'})),
      ...(birthdays || []).map((row) => ({day: row.birthday_day,text: `Aniversário de @${row.username}`,icon:'🎂'}))
    ].sort((a,b) => a.day-b.day);
    target.innerHTML = items.length ? items.map((row) => `<div class="calendar-entry"><span class="calendar-day">${row.day}</span><div><strong>${row.icon} ${html(row.text)}</strong></div></div>`).join('') :
      '<div class="empty" style="padding:16px">Nenhum evento ou aniversário autorizado neste mês.</div>';
  } catch (err) { target.textContent = `Agenda indisponível: ${err.message}`; }
}

function openCalendarForm(squadId) {
  showModal('Adicionar encontro ao calendário', `<form id="calendar-form"><div class="field"><label>Título<input name="title" minlength="3" maxlength="100" required></label></div>
    <div class="field"><label>Data e hora<input name="starts_at" type="datetime-local" required></label></div>
    <div class="field"><label>Informações (opcional)<textarea name="description" maxlength="700"></textarea></label></div>
    <button class="btn btn-pink" type="submit">Salvar no calendário</button></form>`);
  $('calendar-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    try {
      await assertOk(db.from('squad_calendar').insert({squad_id:squadId,title:data.title.trim(),
        starts_at:new Date(data.starts_at).toISOString(),description:data.description?.trim() || null}));
      closeModal();
      await renderSquadCalendar(squadId);
      toast('Encontro incluído no calendário.');
    } catch (err) { toast(err.message); }
  });
}
