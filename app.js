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
function friendlyError(error) {
  const message = String(error?.message || '');
  if (error?.code === '23505' || /profiles_username_key|duplicate key value.*username/i.test(message)) {
    return 'Este @nickname já está em uso. Escolha outro para continuar.';
  }
  if (/invalid login credentials|invalid credentials/i.test(message)) return 'E-mail ou senha incorretos. Confira e tente novamente.';
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar. Confira também a pasta de spam.';
  if (/user already registered/i.test(message)) return 'Este e-mail já está cadastrado. Entre na sua conta ou recupere a senha.';
  return message || 'Não foi possível concluir. Tente novamente.';
}
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
  lastFocus: null, lastAppRefresh: 0, lastSessionCheck: 0, isModerator: false,
  photoUrls: []
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
  const authMessage = $('auth-feedback');
  if (authMessage && $('auth-stage').contains(authMessage)) $('auth-stage').after(authMessage);
  authMessage.textContent = '';
  const parts = {
    loading: '<h1>Preparando seu rolê…</h1><p class="small-muted">Validando sua sessão com segurança.</p>',
    login: `<span class="eyebrow">Bem-vindo de volta</span><h1>Entra, a galera tá te esperando. ✌️</h1>
      <form id="login-form" class="auth-form"><label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Senha<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="btn btn-pink" type="submit">Entrar</button></form>
      <p class="auth-switch"><button data-auth="forgot">Esqueci a senha</button> · <button data-auth="signup">Criar conta</button></p>
      <p class="auth-switch"><button data-auth="resend">Reenviar e-mail de confirmação</button></p>`,
    signup: `<span class="eyebrow">Uma conta, vários encontros</span><h1>Vem pro Bora Pro Rolê 🪩</h1>
      <form id="signup-form" class="auth-form">
      <label>Como podemos te chamar?<input name="display_name" minlength="2" maxlength="60" autocomplete="nickname" required placeholder="Seu nome de exibição"></label>
      <label>Seu @nickname<input name="username" minlength="3" maxlength="24" pattern="[a-z0-9_.]{3,24}" autocapitalize="none" required placeholder="seu.nick"></label>
      <label>Data de nascimento (uso privado, 18+)<input name="birthdate" type="date" required></label>
      <label>Cidade<input name="city" maxlength="90" placeholder="Ex.: São Paulo"></label>
      <label>Um pouco sobre você (opcional)<textarea name="bio" maxlength="300" rows="2" placeholder="Qual é a sua vibe?"></textarea></label>
      <label>Instagram pessoal (opcional)<input name="instagram" maxlength="140" placeholder="@seuperfil"></label>
      <div class="signup-identity"><strong>Identificação opcional e privada</strong><p class="small-muted">Serve apenas para participar de rolês com público direcionado. Você pode deixar em branco e escolher depois.</p>
        <label>Identidade de gênero<select name="gender"><option value="">Prefiro não informar</option><option value="woman">Mulher</option><option value="man">Homem</option><option value="nonbinary">Pessoa não binária</option><option value="other">Outra identificação</option></select></label>
        <label>Você se identifica como LGBTQIA+?<select name="lgbtq"><option value="">Prefiro não informar</option><option value="yes">Sim</option><option value="no">Não</option></select></label>
        <label class="check-label"><input type="checkbox" name="sensitive_consent"> Autorizo o uso dessas identificações apenas para controlar minha entrada em rolês direcionados. Posso revogar depois.</label></div>
      <label>Senha (mínimo 8 caracteres)<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
      <label class="check-label"><input type="checkbox" name="truth_acknowledged" required> Declaro que tenho 18 anos ou mais, que a data é verdadeira e sei que poderemos solicitar comprovação futuramente.</label>
      <label class="check-label"><input type="checkbox" name="legal_acknowledged" required> Li e aceito os <a href="./termos.html" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e as <a href="./comunidade.html" target="_blank" rel="noopener noreferrer">Regras da Comunidade</a>. Estou ciente da <a href="./privacidade.html" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.</label>
      <label>Seu e-mail (último passo)<input name="email" type="email" required autocomplete="email" placeholder="nome@exemplo.com"></label>
      <button class="btn btn-pink" type="submit">Criar conta e receber confirmação ✉️</button></form>
      <p class="auth-switch"><button data-auth="login">Já tenho conta</button></p>`,
    'check-email': `<span class="eyebrow">Quase lá!</span><h1>Confirma seu e-mail pra começar 💌</h1>
      <p class="confirmation-tip">📬 Verifique sua <strong>caixa de entrada e spam</strong>. Clique no link de confirmação e depois entre no Bora Pro Rolê pra conhecer seu próximo rolê!</p>
      <button class="btn btn-pink" data-auth="login">Ir para o login</button>
      <p class="auth-switch"><button data-auth="resend">Não recebi o e-mail</button></p>`,
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
  if (stage === 'login') $('login-form')?.querySelector('button[type="submit"]')?.before(authMessage);
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
      const birth = String(data.birthdate || '');
      const birthday = new Date(`${birth}T12:00:00`);
      const adultDate = new Date(); adultDate.setFullYear(adultDate.getFullYear() - 18);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !Number.isFinite(birthday.getTime()) || birthday > adultDate)
        throw Error('O cadastro é exclusivo para maiores de 18 anos. Confira sua data de nascimento.');
      const nickname = String(data.username || '').toLowerCase().trim();
      if (!/^[a-z0-9_.]{3,24}$/.test(nickname)) throw Error('Nickname: use de 3 a 24 letras minúsculas, números, . ou _.');
      if ((data.gender || data.lgbtq) && data.sensitive_consent !== 'on')
        throw Error('Para salvar a identificação opcional, autorize seu uso ou deixe os campos em branco.');
      if (data.truth_acknowledged !== 'on' || data.legal_acknowledged !== 'on')
        throw Error('Confirme sua idade declarada e leia os documentos para continuar.');
      const signup = await assertOk(db.auth.signUp({email: data.email, password: data.password,
        options: { emailRedirectTo: signupRedirect(), data: {bora_signup: {
          birthdate: birth, display_name: String(data.display_name || '').trim().slice(0,60),
          username: nickname, city: String(data.city || '').trim().slice(0,90),
          bio:String(data.bio || '').trim().slice(0,300),instagram:String(data.instagram || '').trim().slice(0,140),
          gender: data.sensitive_consent === 'on' ? data.gender || null : null,
          lgbtq: data.sensitive_consent === 'on' ? (data.lgbtq === 'yes' ? true : data.lgbtq === 'no' ? false : null) : null,
          sensitive_consent: data.sensitive_consent === 'on'
        }}}}));
      if (!signup.session) showGate('check-email');
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
    feedback(`❌ ${friendlyError(err)}`);
    if (kind === 'login') form?.querySelector('input[name="password"]')?.focus();
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
    let raw = await assertOk(db.rpc('my_onboarding_status'));
    if (version !== state.sessionVersion) return;
    let status = Array.isArray(raw) ? raw[0] : raw;
    const signup = state.user.user_metadata?.bora_signup;
    let onboardingIssue = '';
    if (signup && status && !status.can_use_app) {
      try {
        if (!status.adult_declared) await assertOk(db.rpc('declare_adulthood', {_birthdate:signup.birthdate}));
        if (!status.has_profile) await assertOk(db.from('profiles').insert({id:state.user.id,
          username:signup.username,display_name:signup.display_name,city:signup.city || null,
          bio:signup.bio || '',instagram:signup.instagram || null}));
        if (signup.sensitive_consent) await assertOk(db.rpc('set_audience_preferences', {
          _gender:signup.gender,_lgbtq:signup.lgbtq,_consent:true}));
        if (!status.legal_accepted) await assertOk(db.rpc('accept_current_documents'));
        raw = await assertOk(db.rpc('my_onboarding_status'));
        status = Array.isArray(raw) ? raw[0] : raw;
        if (status?.can_use_app) await db.auth.updateUser({data:{bora_signup:null}});
      } catch (err) { onboardingIssue = friendlyError(err); }
    }
    if (!status?.adult_declared) return showGate('birth');
    if (!status.has_profile) {
      showGate('profile');
      if (signup?.username) $('onboard-profile-form')?.querySelector('[name="username"]')?.setAttribute('value', signup.username);
      if (signup?.display_name) $('onboard-profile-form')?.querySelector('[name="display_name"]')?.setAttribute('value', signup.display_name);
      if (signup?.city) $('onboard-profile-form')?.querySelector('[name="city"]')?.setAttribute('value', signup.city);
      if (onboardingIssue) feedback(onboardingIssue);
      return;
    }
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
  // Um novo modal deve sempre abrir no início, inclusive no Safari do iPhone.
  const dialog = $('modal').querySelector('.dialog');
  if (dialog) dialog.scrollTop = 0;
  $('dialog-body').scrollTop = 0;
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
  $('home-calendar').classList.toggle('hidden', view !== 'calendario');
  $('events-grid').classList.toggle('hidden', view === 'calendario');
  if (view === 'calendario') renderHomeCalendar();
  if (view === 'mapa') setTimeout(() => state.map?.invalidateSize(), 100);
}

const heroMessages = [
  ['⚡ COM GENTE É MELHOR','A vida acontece<br>fora do feed.','Do cinema à rave, das boas conversas às amizades que ficam.'],
  ['🤝 RESPEITO SEMPRE','Toda vibe merece<br>respeito.','Aqui ninguém precisa esconder quem é. Diversidade e consentimento vêm primeiro.'],
  ['🛡️ ROLÊ SEGURO','Curta a noite.<br>Cuide da galera.','Marque encontros em locais públicos e denuncie assédio, preconceito e golpes.'],
  ['💜 AMIZADE REAL','Seu jeito.<br>Sua turma.','Converse, combine e compartilhe bons momentos sem pressão.']
];
let heroIndex = 0;
setInterval(() => {
  if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  heroIndex = (heroIndex + 1) % heroMessages.length;
  const [tag,heading,copy] = heroMessages[heroIndex];
  if ($('hero-kicker')) $('hero-kicker').textContent = tag;
  if ($('hero-headline')) $('hero-headline').innerHTML = heading;
  if ($('hero-message')) $('hero-message').textContent = copy;
}, 8500);

function renderHomeCalendar() {
  const input = $('home-calendar-month');
  const target = $('home-calendar-days');
  if (!input || !target) return;
  if (!input.value) input.value = new Date().toISOString().slice(0,7);
  const [year,month] = input.value.split('-').map(Number);
  if (!year || !(month >= 1 && month <= 12)) return;
  const days = new Date(year,month,0).getDate();
  const firstDay = new Date(year,month-1,1).getDay();
  const matches = filteredEvents().filter(isPublished);
  const eventDays = new Map();
  for (const event of matches) {
    const date = new Date(event.date);
    const local = new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
    if (!local.startsWith(input.value)) continue;
    const day = Number(local.slice(-2));
    if (!eventDays.has(day)) eventDays.set(day,[]);
    eventDays.get(day).push(event);
  }
  target.innerHTML = `<div class="bora-cal-grid"><div class="cal-week">Dom</div><div class="cal-week">Seg</div><div class="cal-week">Ter</div><div class="cal-week">Qua</div><div class="cal-week">Qui</div><div class="cal-week">Sex</div><div class="cal-week">Sáb</div>` +
    Array.from({length:firstDay},()=>'<div class="cal-empty"></div>').join('') +
    Array.from({length:days},(_,i)=> { const day=i+1; const events=eventDays.get(day) || [];
      return `<div class="cal-date ${events.length ? 'has-events' : ''}"><strong>${day}</strong>${events.slice(0,3).map(e=>
        `<button class="cal-event" data-event="${html(e.id)}" title="${html(e.title)}">${html(categories.find(c=>c[0]===e.category)?.[1] || '✨')} ${html(e.title)}</button>`).join('')}${events.length>3?`<small>+${events.length-3} rolês</small>`:''}</div>`;
    }).join('') + '</div>';
}
$('home-calendar-month')?.addEventListener('change',renderHomeCalendar);

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
      <div class="card-foot">${pending ? '<span class="badge">Não disponível</span>' : `<span class="badge green">✓ ${eventCount(event.id)} confirmados</span>`}<span class="arrow"><i data-lucide="arrow-up-right"></i></span></div></div></article>`;
  }).join('') : '<div class="empty">Ainda não há rolês publicados nessa busca. Tente outra categoria ou aguarde novos eventos!</div>';
  $('results-count').textContent = `${events.length} rolê${events.length !== 1 ? 's' : ''} encontrado${events.length !== 1 ? 's' : ''}`;
  renderPins(events.filter(isPublished));
  if (state.view === 'calendario') renderHomeCalendar();
  icons();
}

// O mapa acompanha a cidade declarada no perfil; nunca presume que todos moram em SP.
const cityCoordinates = {
  'rio de janeiro': [-22.9068,-43.1729,'RJ'], 'sao paulo': [-23.5505,-46.6333,'SP'],
  'belo horizonte': [-19.9167,-43.9345,'MG'], 'vitoria': [-20.3155,-40.3128,'ES'],
  'curitiba': [-25.4284,-49.2733,'PR'], 'florianopolis': [-27.5949,-48.5482,'SC'],
  'porto alegre': [-30.0346,-51.2177,'RS'], 'brasilia': [-15.7939,-47.8828,'DF'],
  'goiania': [-16.6869,-49.2648,'GO'], 'campo grande': [-20.4697,-54.6201,'MS'],
  'cuiaba': [-15.6010,-56.0974,'MT'], 'salvador': [-12.9777,-38.5016,'BA'],
  'recife': [-8.0476,-34.8770,'PE'], 'fortaleza': [-3.7319,-38.5267,'CE'],
  'natal': [-5.7945,-35.2110,'RN'], 'joao pessoa': [-7.1195,-34.8450,'PB'],
  'maceio': [-9.6658,-35.7353,'AL'], 'aracaju': [-10.9472,-37.0731,'SE'],
  'teresina': [-5.0892,-42.8016,'PI'], 'sao luis': [-2.5297,-44.3028,'MA'],
  'belem': [-1.4558,-48.4902,'PA'], 'manaus': [-3.1190,-60.0217,'AM'],
  'porto velho': [-8.7608,-63.8999,'RO'], 'rio branco': [-9.9754,-67.8249,'AC'],
  'boa vista': [2.8235,-60.6758,'RR'], 'macapa': [0.0349,-51.0694,'AP'],
  'palmas': [-10.2491,-48.3243,'TO'], 'campinas': [-22.9099,-47.0626,'SP'],
  'santos': [-23.9608,-46.3336,'SP'], 'guarulhos': [-23.4545,-46.5333,'SP'],
  'osasco': [-23.5325,-46.7917,'SP'], 'niteroi': [-22.8832,-43.1034,'RJ']
};
const cityKey = (city) => String(city || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\s*[-,/]\s*[a-z]{2}\s*$/,'').replace(/\s+/g,' ').trim();
function focusHomeMap() {
  const city = String(state.profile?.city || '').trim();
  const key = cityKey(city);
  const localEvents = state.events.filter(event => cityKey(event.city) === key && Number.isFinite(event.lat) && Number.isFinite(event.lng));
  const center = cityCoordinates[key] || (localEvents.length ? [localEvents[0].lat,localEvents[0].lng] : null);
  const hint = document.querySelector('#map-frame .map-hint');
  if (hint?.firstChild) hint.firstChild.textContent = center && city ? `📍 Rolês por ${city}` : '📍 Rolês pelo Brasil';
  if (!state.map) return;
  if (center) state.map.setView([center[0],center[1]], 11);
  else state.map.setView([-14.235,-51.925], 4);
}

function initMap() {
  if (!window.L) return;
  if (state.map) { state.map.invalidateSize(); focusHomeMap(); return; }
  state.map = L.map('map', { zoomControl: false, scrollWheelZoom: false }).setView([-14.235,-51.925], 4);
  L.control.zoom({ position: 'bottomleft' }).addTo(state.map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
  }).addTo(state.map);
  state.markers = L.layerGroup().addTo(state.map);
  renderPins(filteredEvents().filter(isPublished));
  focusHomeMap();
}

function renderPins(events) {
  if (!state.markers) return;
  state.markers.clearLayers();
  for (const event of events) {
    if (!Number.isFinite(event.lat) || !Number.isFinite(event.lng)) continue;
    const mark = event.category === 'carnaval' ? '🚛' : (categories.find(c=>c[0]===event.category)?.[1] || '📍');
    const icon = L.divIcon({className: '', html: `<div class="pin-emoji" aria-label="${html(catLabel(event.category))}">${html(mark)}</div>`,
      iconSize:[40,44],iconAnchor:[20,42]});
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
    requiresVerifiedAge: row.requires_verified_age, audience: row.audience || 'all', venueChecksId: !!row.venue_checks_id,
    estimatedSpend:row.estimated_spend_brl == null ? null : Number(row.estimated_spend_brl),
    spendNotes:row.spend_notes || ''};
}

async function refreshCounts(ids) {
  const publishedIds = ids.filter((id) => state.events.some((event) => event.id === id && isPublished(event)));
  if (!publishedIds.length) return;
  const data = await assertOk(db.rpc('event_confirmed_counts', { _event_ids: publishedIds.slice(0, 100) }));
  for (const row of data || []) state.counts.set(row.event_id, Number(row.confirmed_count));
}

async function loadEvents() {
  const rows = await assertOk(db.from('events').select('id,creator_id,title,description,category,starts_at,ends_at,venue_name,address,city,state_code,latitude,longitude,cover_path,venue_instagram,ticket_url,spotify_playlist_url,status,requires_verified_age,audience,venue_checks_id,estimated_spend_brl,spend_notes')
    .gte('ends_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('starts_at', { ascending: true }).limit(50));
  state.events = (rows || []).map(normalizeEvent);
  const covers = state.events.filter((event) => event.coverPath);
  if (covers.length) {
    const signed = await db.storage.from('event-covers').createSignedUrls(covers.map((event) => event.coverPath), 90);
    if (!signed.error) covers.forEach((event, index) => { event.image = safeHttps(signed.data[index]?.signedUrl); });
  }
  await refreshCounts(state.events.map((event) => event.id));
  renderEvents();
  focusHomeMap();
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
  const owner = event.creatorId === state.user.id;
  const audiences = {all:'🌎 Aberto a todos',women:'👩 Para mulheres',men:'👨 Para homens',lgbtq:'🏳️‍🌈 Para pessoas LGBTQIA+'};
  const mapsTarget = Number.isFinite(event.lat) && Number.isFinite(event.lng)
    ? `${event.lat},${event.lng}` : `${event.address}, ${event.city}, ${event.stateCode}, Brasil`;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsTarget)}`;
  const spendText = event.estimatedSpend == null ? 'Organizador não soube informar' :
    `Aproximadamente ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(event.estimatedSpend)} por pessoa`;
  showModal(event.title, `<div class="event-details">
    ${eventImage(event) ? `<img class="dialog-photo" src="${html(eventImage(event))}" alt="Capa do evento ${html(event.title)}">` : '<div class="detail-cover-fallback">🪩</div>'}
    <span class="badge pink">${html(catLabel(event.category))}</span>
    ${!active ? '<span class="badge">Este rolê não está disponível</span>' : ''}
    <h3 class="details-heading">Informações do rolê</h3>
    <dl class="event-facts">
      <div><dt>🎉 Nome do evento</dt><dd>${html(event.title)}</dd></div>
      <div><dt>📆 Data e hora</dt><dd>${html(displayDate(event.date))}</dd></div>
      <div><dt>🏢 Local</dt><dd>${html(event.venue || 'Local informado no endereço')}</dd></div>
      <div><dt>📍 Endereço</dt><dd>${html(event.address)}, ${html(event.city)} - ${html(event.stateCode)}</dd></div>
      <div><dt>🧭 Rota</dt><dd><a href="${html(mapsUrl)}" target="_blank" rel="noopener noreferrer">Abrir no Google Maps →</a></dd></div>
      <div><dt>💸 Média de gasto</dt><dd>${html(spendText)}${event.spendNotes ? `<p>${html(event.spendNotes)}</p>` : ''}<small>Estimativa informada pelo organizador; confirme preços e inclusões no estabelecimento.</small></dd></div>
      <div><dt>✅ Pessoas confirmadas</dt><dd><strong class="confirmed-count">${active ? eventCount(id) : '—'}</strong> ${active ? 'integrantes no grupo do rolê' : 'Evento ainda não publicado'}</dd></div>
      <div><dt>🫶 Público do encontro</dt><dd>${html(audiences[event.audience] || audiences.all)} (identificação autodeclarada)</dd></div>
      ${event.venueChecksId ? '<div><dt>🔞 Regra do estabelecimento</dt><dd>O local exige documento e aceita somente maiores de 18 anos.</dd></div>' : ''}
    </dl>
    <h3 class="details-heading">Sobre o encontro</h3><p class="detail-desc">${html(event.description)}</p>
    <div class="event-links"><div><strong>Instagram do evento/local</strong>${instaUrl ? `<a href="${html(instaUrl)}" target="_blank" rel="noopener noreferrer">Ver Instagram ↗</a>` : '<span>Não informado</span>'}</div>
    <div><strong>Compra de ingresso</strong>${ticketUrl ? `<a href="${html(ticketUrl)}" target="_blank" rel="noopener noreferrer">Abrir link oficial informado ↗</a>` : '<span>Sem link informado (confirme se é gratuito)</span>'}</div></div>
    ${spotifyEmbed(event.playlist) ? `<section class="event-spotify"><h3 class="details-heading">🎵 Playlist deste rolê</h3>${spotifyEmbed(event.playlist)}<p class="small-muted">A lista de sugestões dos participantes aparece depois de entrar no grupo. As músicas sugeridas no app não são adicionadas automaticamente ao Spotify.</p></section>` : ''}
    <div class="meeting-tip">🛡️ <strong>Combinado seguro:</strong> encontre o grupo em um local público, avise alguém de confiança sobre seu destino e confirme a procedência dos ingressos. <button data-action="safety" class="inline-button">Ver orientações</button></div>
    <div class="dialog-actions"><button class="btn btn-pink" data-action="join" data-id="${html(id)}" ${!active ? 'disabled' : ''}>${joined ? 'Abrir grupo do rolê 💬' : 'Confirmar presença e abrir grupo 💬'}</button>
    <button class="btn btn-ghost" data-action="detail-save" data-id="${html(id)}">${state.saved.has(id) ? '💗 Salvo' : '🤍 Salvar rolê'}</button>
    <button class="btn btn-ghost" data-action="close-modal">← Ver outros rolês</button>
    ${owner && active ? `<button class="btn btn-ghost" data-action="edit-event" data-id="${html(id)}">✏️ Editar rolê</button><button class="btn btn-ghost" data-action="cancel-event" data-id="${html(id)}">Cancelar rolê</button>` : ''}
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

function eventFormValues(event) {
  const toInput = (value) => { const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
  return {title:event.title,description:event.description,category:event.category,venue:event.venue,
    start:toInput(event.date),end:toInput(event.endsAt),address:event.address,city:event.city,
    state:event.stateCode,instagram:event.instagram,ticket:event.ticket,playlist:event.playlist,
    audience:event.audience,venueChecksId:event.venueChecksId,spend:event.estimatedSpend,spendNotes:event.spendNotes};
}

async function editEvent(id) {
  const event = state.events.find(item=>item.id===id && item.creatorId===state.user.id && isPublished(item));
  if (!event) return toast('Você não pode editar este rolê.');
  const v=eventFormValues(event);
  showModal('Editar rolê ✏️', `<p class="legal-note">Se houver confirmados, a edição será avisada automaticamente no chat do evento.</p>
    <form id="edit-event-form" class="create-form">
      <label>Nome<input name="title" required minlength="5" maxlength="100" value="${html(v.title)}"></label>
      <label>Categoria<select name="category">${categories.slice(1).map(c=>`<option value="${c[0]}" ${c[0]===v.category?'selected':''}>${c[1]} ${c[2]}</option>`).join('')}</select></label>
      <div class="fields"><label>Início<input type="datetime-local" name="starts_at" value="${html(v.start)}" required></label>
      <label>Término<input type="datetime-local" name="ends_at" value="${html(v.end)}" required></label></div>
      <label>Nome do local<input name="venue_name" maxlength="120" value="${html(v.venue)}"></label>
      <label>Endereço<input name="address" required maxlength="220" value="${html(v.address)}"></label>
      <div class="fields"><label>Cidade<input name="city" required maxlength="90" value="${html(v.city)}"></label>
      <label>UF<input name="state_code" required maxlength="2" value="${html(v.state)}"></label></div>
      <label>Descrição<textarea name="description" required minlength="10" maxlength="2000">${html(v.description)}</textarea></label>
      <label>Público do rolê<select name="audience">${[['all','Para todos'],['women','Para mulheres'],['men','Para homens'],['lgbtq','Para LGBTQIA+']].map(([k,label])=>`<option value="${k}" ${k===v.audience?'selected':''}>${label}</option>`).join('')}</select></label>
      <label class="check-label"><input type="checkbox" name="venue_checks_id" ${v.venueChecksId?'checked':''}> O local exige documento e aceita somente maiores de 18 anos.</label>
      <label>Instagram<input name="venue_instagram" value="${html(v.instagram)}"></label>
      <label>Link de ingresso<input name="ticket_url" type="url" value="${html(v.ticket)}"></label>
      <label>Playlist Spotify<input name="spotify_playlist_url" type="url" value="${html(v.playlist)}"></label>
      <label>Estimativa de gasto por pessoa em R$ (vazio = não sei informar)<input name="estimated_spend_brl" type="number" min="0" max="100000" step="0.01" value="${v.spend==null?'':v.spend}"></label>
      <label>Observações sobre custos<input name="spend_notes" maxlength="250" value="${html(v.spendNotes)}" placeholder="Ex.: ingresso inclui open bar"></label>
      <p class="small-muted">O pino do mapa e a capa não são alterados nesta edição.</p>
      <button class="btn btn-pink" type="submit">Salvar alterações e avisar confirmados</button>
    </form>`);
  $('edit-event-form').addEventListener('submit',async(ev)=>{
    ev.preventDefault();
    const payload=Object.fromEntries(new FormData(ev.target));
    const start=new Date(payload.starts_at),end=new Date(payload.ends_at);
    if (!(start>new Date()) || !(end>start)) return toast('Confira as datas do rolê.');
    payload.starts_at=start.toISOString();payload.ends_at=end.toISOString();
    payload.venue_checks_id=!!ev.target.querySelector('[name="venue_checks_id"]').checked;
    payload.estimated_spend_brl=payload.estimated_spend_brl==='' ? null : Number(payload.estimated_spend_brl);
    if (payload.ticket_url && !safeHttps(payload.ticket_url)) return toast('O ingresso precisa usar https://');
    if (payload.spotify_playlist_url && !spotifyId(payload.spotify_playlist_url,'playlist')) return toast('Playlist Spotify inválida.');
    const button=ev.submitter; button.disabled=true;
    try { await assertOk(db.rpc('bora_edit_event',{_event:id,_changes:payload}));
      closeModal();await loadEvents();toast('Rolê atualizado. Participantes notificados!');
    } catch(err){toast(err.message);} finally{button.disabled=false;}
  });
}

async function cancelEvent(id) {
  const reason=prompt('Por que precisa cancelar? Os participantes serão avisados (mínimo 8 caracteres).');
  if (reason===null) return;
  if (reason.trim().length<8) return toast('Descreva brevemente o motivo do cancelamento.');
  if (!confirm('Confirmar pedido de cancelamento? Até 5 confirmados, o cancelamento é imediato; acima disso, a moderação precisa autorizar.')) return;
  try { const result=await assertOk(db.rpc('bora_cancel_event',{_event:id,_reason:reason.trim()}));
    closeModal();await loadEvents();renderMine();
    toast(result.approval_required?'Pedido enviado à moderação; o rolê continua publicado até a decisão.':'Rolê cancelado; integrantes notificados.');
  } catch(err){toast(err.message);}
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
  $('created-list').innerHTML = state.events.filter(event=>event.creatorId===state.user.id).map(item).join('') ||
    '<p class="small-muted">Você ainda não publicou um rolê.</p>';
}

function openCreate() {
  showModal('Criar um rolê ✨', `<p class="small-muted">Seu rolê será publicado após o envio. Os usuários poderão denunciar anúncios suspeitos e a equipe poderá agir depois da publicação.</p>
    <form id="event-form" class="create-form"><div class="field"><label for="new-title">Nome do rolê *</label><input id="new-title" maxlength="100" minlength="5" required placeholder="Ex.: Cine + café no sábado"></div>
    <div class="fields"><div class="field"><label for="new-category">Categoria *</label><select id="new-category">${categories.slice(1).map((c) => `<option value="${c[0]}">${c[1]} ${c[2]}</option>`).join('')}</select></div>
    <div class="field"><label for="new-venue">Nome do local</label><input id="new-venue" maxlength="120" placeholder="Ex.: Cinemark Shopping"></div></div>
    <div class="fields"><div class="field"><label for="new-start">Início *</label><input id="new-start" type="datetime-local" required></div><div class="field"><label for="new-end">Término previsto *</label><input id="new-end" type="datetime-local" required></div></div>
    <div class="field"><label for="new-address">Endereço completo *</label><input id="new-address" maxlength="220" required placeholder="Rua, número, bairro"></div>
    <div class="fields"><div class="field"><label for="new-city">Cidade *</label><input id="new-city" maxlength="90" value="São Paulo" required></div><div class="field"><label for="new-state">UF *</label><input id="new-state" maxlength="2" value="SP" required></div></div>
    <div class="field"><label for="new-description">Descrição e combinados *</label><textarea id="new-description" minlength="10" maxlength="2000" required placeholder="Como será? Tem ingresso? Qual será o ponto de encontro?"></textarea></div>
    <div class="fields"><div class="field"><label for="new-insta">Instagram do local</label><input id="new-insta" placeholder="@local ou https://..."></div><div class="field"><label for="new-ticket">Link do ingresso</label><input id="new-ticket" type="url" placeholder="https://..."></div></div>
    <div class="field"><label for="new-playlist">Playlist do rolê no Spotify (opcional)</label><input id="new-playlist" type="url" placeholder="https://open.spotify.com/playlist/..."></div>
    <div class="field"><label for="new-spend">💸 Média de gasto por pessoa no local (R$)</label><input id="new-spend" type="number" min="0" max="100000" step="0.01" placeholder="Deixe vazio se não souber"><small class="small-muted">Estimativa opcional, além do ingresso. Vazio significa “Não sei informar”.</small></div>
    <div class="field"><label for="new-spend-notes">O que está incluído? (opcional)</label><input id="new-spend-notes" maxlength="250" placeholder="Ex.: ingresso já inclui open bar; consumo à parte"></div>
    <div class="field"><label for="new-cover">Foto de capa (WebP/JPG/PNG, opcional)</label><label class="file-picker" for="new-cover"><input id="new-cover" type="file" accept="image/*"><span class="file-picker-button">📷 Escolher capa</span><span class="file-picker-name" id="new-cover-name" aria-live="polite">Nenhuma imagem selecionada</span></label></div>
    <p class="small-muted">📍 Toque no mapa para marcar o local exato do evento. A localização não é a da sua residência.</p>
    <div id="map-picker" class="map-picker"></div><div id="picker-location" class="small-muted">Nenhum local marcado.</div>
    <div class="field"><label for="new-audience">Quem pode confirmar presença?</label><select id="new-audience"><option value="all">🌎 Todas as pessoas</option><option value="women">👩 Somente mulheres</option><option value="men">👨 Somente homens</option><option value="lgbtq">🏳️‍🌈 Somente pessoas LGBTQIA+</option></select><small class="small-muted">A participação em rolês direcionados usa a identificação autodeclarada e privada do perfil. A convivência deve respeitar as regras antidiscriminação.</small></div>
    <label class="check-label"><input id="new-verified" type="checkbox"> O local exige documento para entrada e só aceita maiores de 18 anos.</label>
    <p class="legal-note">Nunca publique endereços residenciais, dados de terceiros ou convites a práticas ilegais. O app pode recusar conteúdos e eventos inadequados.</p>
    <button type="submit" class="btn btn-pink" style="width:100%">Publicar evento agora</button></form>`);
  $('new-cover').addEventListener('change', (event) => {
    $('new-cover-name').textContent = event.target.files?.[0]?.name || 'Nenhuma imagem selecionada';
  });
  const userCity = String(state.profile?.city || '').trim();
  if (userCity) $('new-city').value = userCity;
  if (cityCoordinates[cityKey(userCity)]) $('new-state').value = cityCoordinates[cityKey(userCity)][2];
  const start = $('new-start');
  start.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
  state.pickedCoords = null;
  if (window.L) {
    const location = cityCoordinates[cityKey(userCity)] || [-14.235,-51.925];
    state.pickerMap = L.map('map-picker', {scrollWheelZoom: false}).setView(location.slice(0,2), userCity && cityCoordinates[cityKey(userCity)] ? 11 : 4);
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
      estimated_spend_brl:$('new-spend').value===''?null:Number($('new-spend').value),
      spend_notes:$('new-spend-notes').value.trim() || null,
      venue_checks_id: $('new-verified').checked,audience:$('new-audience').value,
      requires_verified_age:false};
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
    // A capa é enviada ANTES de publicar, por causa das permissões no Storage.
    await assertOk(db.rpc('bora_publish_event', {_event: uid}));
    closeModal();
    await loadEvents();
    toast('Seu rolê já está publicado! 🎉');
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
  focusHomeMap();
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
  if (!$('avatar-form')) {
    const photo = document.createElement('div');
    photo.className = 'profile-photo-edit';
    photo.innerHTML = `<h3>🖼️ Minha foto</h3>
      <form id="avatar-form" class="friend-finder"><label class="file-picker" for="avatar-upload"><input type="file" id="avatar-upload" accept="image/*"><span class="file-picker-button">📷 Escolher foto</span><span class="file-picker-name" id="avatar-filename" aria-live="polite">Nenhuma imagem selecionada</span></label><button class="btn btn-ghost btn-small" type="submit">Atualizar foto</button></form>
      <p class="small-muted">Foto WebP de até 300 KiB. A visibilidade segue suas escolhas de privacidade.</p>`;
    document.querySelector('.profile-bio').after(photo);
    $('avatar-upload').addEventListener('change', (event) => {
      $('avatar-filename').textContent = event.target.files?.[0]?.name || 'Nenhuma imagem selecionada';
    });
    $('avatar-form').addEventListener('submit', saveAvatar);
  }
  if (!$('profile-account-options')) {
    const options = document.createElement('div');
    options.id = 'profile-account-options';
    options.innerHTML = `<div class="switch-line"><label for="birthday-consent"><strong>🎂 Avisar meu aniversário aos SQUADs</strong>
        <small>Somente dia e mês, se você autorizar.</small></label><input type="checkbox" id="birthday-consent"></div>
      <button class="btn btn-ghost account-logout" data-action="logout"><i data-lucide="log-out"></i> Sair da minha conta</button>
      <button class="btn btn-ghost hidden" id="moderation-entry" data-action="moderation">🛡️ Painel de moderação</button>`;
    document.querySelector('#screen-perfil .profile-panel .two-col > .panel:last-child').append(options);
  }
  if (!$('friend-form')) {
    const finder = document.createElement('section');
    finder.className = 'panel friend-discovery';
    finder.innerHTML = `<div class="friend-discovery-title"><div class="friend-discovery-icon">🔎</div><div>
      <span class="eyebrow">Encontre sua galera</span><h2>Gente nova, SQUAD novo. ✌️</h2>
      <p>Procure pessoas pelo @nickname ou SQUADs pelo nome. Perfis e grupos só aparecem conforme a privacidade escolhida.</p></div></div>
      <form id="friend-form" class="friend-finder"><input id="friend-nick" placeholder="@nickname ou nome do SQUAD" maxlength="65" aria-label="Buscar pessoas ou SQUADs"><button class="btn btn-pink" type="submit">🔎 Buscar</button></form>
      <div class="friend-results" id="friend-result" role="status" aria-live="polite">A pesquisa não revela fotos, conversas ou integrantes privados.</div>
      <div class="blocked-profile-box"><h3>🔒 Controle de bloqueios</h3><p class="small-muted">Você pode bloquear qualquer @nickname, mesmo que o perfil não apareça nas pesquisas.</p>
      <form id="nickname-block-form" class="friend-finder"><input id="block-nick" placeholder="@nickname a bloquear" maxlength="24" aria-label="Bloquear pelo nickname"><button class="btn btn-ghost" type="submit">Bloquear</button></form>
      <button class="inline-button" data-action="manage-blocks">Ver e gerenciar meus bloqueios</button></div>`;
    document.querySelector('#screen-perfil .profile-panel').after(finder);
    $('friend-form').addEventListener('submit', followNickname);
    $('nickname-block-form').addEventListener('submit', blockNicknameFromForm);
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
    bio: $('edit-bio').value.trim(), instagram: $('edit-insta').value.trim() || null};
  try {
    const profile = await assertOk(db.from('profiles').update(payload).eq('id', state.user.id).select('*').single());
    state.profile = profile;
    hydrateProfile();
    toast('Perfil atualizado.');
  } catch (err) { toast(friendlyError(err)); }
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
  const query = $('friend-nick').value.trim();
  const nickname = query.replace(/^@/, '').toLowerCase();
  if (query.length < 3) return toast('Digite pelo menos três caracteres para pesquisar.');
  const target = $('friend-result');
  target.innerHTML = '<p class="small-muted">Buscando pessoas e SQUADs…</p>';
  try {
    const [people,groups] = await Promise.all([
      /^[a-z0-9_.]{3,24}$/.test(nickname) && nickname!==state.profile.username
        ? assertOk(db.rpc('bora_lookup_profile',{_nickname:nickname})) : Promise.resolve([]),
      query.startsWith('@') ? Promise.resolve([]) : assertOk(db.rpc('bora_search_squads',{_query:query}))
    ]);
    if (!state.user) return;
    const person = people?.[0];
    let avatarUrl = '';
    if (person?.avatar_path) {
      const {data,error} = await db.storage.from('avatars').createSignedUrl(person.avatar_path,90);
      if (!error) avatarUrl = safeHttps(data?.signedUrl);
    }
    const personCard = person ? `<article class="discovery-card person-result"><div class="discovery-avatar">${avatarUrl?`<img src="${html(avatarUrl)}" alt="Foto de @${html(person.username)}">`:'👤'}</div>
      <div class="grow"><strong>${html(person.display_name)}</strong><p>@${html(person.username)} ${person.is_friend?'· 🤝 Amizade recíproca':''}</p>
      ${person.bio?`<p>${html(person.bio)}</p>`:''}${person.city?`<p>📍 ${html(person.city)}</p>`:''}${person.instagram?`<p>Instagram: ${html(person.instagram)}</p>`:''}</div>
      <div class="discovery-actions"><button class="btn btn-pink btn-small" data-action="follow-found-user" data-id="${html(person.user_id)}" data-nick="${html(person.username)}">Seguir</button>
      <button class="btn btn-ghost btn-small" data-action="block-found-user" data-nick="${html(person.username)}">Bloquear</button></div></article>`:
      '<p class="small-muted">Nenhuma pessoa encontrada com esse @nickname ou ela não permite buscas.</p>';
    const squadCards = groups?.length ? groups.map(squad=>`<article class="discovery-card squad-result"><div class="discovery-avatar">🫶</div>
      <div class="grow"><strong>${html(squad.name)}</strong><p>${html(squad.description || 'Uma galera com planos em comum.')}</p>
      <span class="small-muted">${Number(squad.member_count)||0} integrante(s) · Entrada com autorização de admin</span></div>
      <button class="btn btn-pink btn-small" data-action="request-squad-join" data-id="${html(squad.squad_id)}">Pedir entrada</button></article>`).join(''):
      '<p class="small-muted">Nenhum SQUAD aberto a pedidos com esse nome.</p>';
    target.innerHTML = `<section class="discovery-group"><h3>👥 Pessoas</h3>${personCard}</section>
      <section class="discovery-group"><h3>🫶 SQUADs</h3>${squadCards}</section>`;
  } catch (err) { target.textContent = `Não foi possível pesquisar: ${friendlyError(err)}`; }
}

async function followFoundUser(userId,nickname) {
  if (!userId || userId===state.user?.id) return;
  try {
    await assertOk(db.from('follows').insert({follower_id:state.user.id,followed_id:userId}));
    toast(`Agora você segue @${nickname}. A amizade é recíproca quando a pessoa também seguir você.`);
  } catch(err) { toast(err.code==='23505'?'Você já segue esta pessoa.':friendlyError(err)); }
}

async function blockFoundNickname(nickname) {
  if (!confirm(`Bloquear @${nickname}? Vocês deixarão de se seguir e de se encontrar nas buscas.`)) return;
  try {
    await assertOk(db.rpc('bora_block_nickname',{_nickname:nickname}));
    $('friend-result').textContent = 'Bloqueio registrado. Você pode pesquisar outra pessoa ou SQUAD.';
    toast('Bloqueio registrado.');
  } catch(err) { toast(friendlyError(err)); }
}

async function blockNicknameFromForm(event) {
  event.preventDefault();
  const nick=$('block-nick').value.trim().replace(/^@/,'').toLowerCase();
  if (!/^[a-z0-9_.]{3,24}$/.test(nick)) return toast('Informe um @nickname válido.');
  await blockFoundNickname(nick);
  $('nickname-block-form').reset();
}

async function manageBlockedNicknames() {
  try {
    const rows=await assertOk(db.rpc('bora_my_blocks'));
    showModal('Quem você bloqueou 🔒',`${rows?.length?rows.map(item=>`<div class="list-row"><div class="grow"><strong>@${html(item.username)}</strong></div>
      <button class="btn btn-ghost btn-small" data-action="unblock-found-user" data-nick="${html(item.username)}">Desbloquear</button></div>`).join(''):
      '<p class="small-muted">Você ainda não bloqueou ninguém.</p>'}<button class="btn btn-ghost" data-action="close-modal">Voltar</button>`);
  } catch(err) { toast(friendlyError(err)); }
}

async function unblockFoundNickname(nickname) {
  if (!confirm(`Desbloquear @${nickname}?`)) return;
  try { await assertOk(db.rpc('bora_unblock_nickname',{_nickname:nickname})); toast('Perfil desbloqueado.'); await manageBlockedNicknames(); }
  catch(err) { toast(friendlyError(err)); }
}

async function loadSquads() {
  const [members, invites] = await Promise.all([
    assertOk(db.from('squad_members').select('squad_id,role').eq('user_id', state.user.id).limit(60)),
    assertOk(db.from('squad_invitations').select('id,squad_id,invited_by,created_at').eq('invitee_id', state.user.id).eq('status', 'pending').limit(25))
  ]);
  state.squadRoles = new Map((members || []).map((item) => [item.squad_id,item.role]));
  state.squadInvites = invites || [];
  const ids = (members || []).map((item) => item.squad_id);
  state.squads = ids.length ? await assertOk(db.from('squads').select('id,name,description,origin_event_id,cover_path,created_at,status,album_url,is_discoverable').in('id', ids).limit(60)) : [];
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
  list.innerHTML = `<div class="panel"><div class="squad-extras-head"><h3>Meus SQUADs</h3><button class="btn btn-pink btn-small" data-action="create-independent-squad">+ Criar SQUAD</button></div>
    ${state.squads.length ? state.squads.map((squad) => `<div class="list-row"><div class="icon-disc">🫶</div><div class="grow"><strong>${html(squad.name)}</strong><p>${html(squad.description || 'Comunidade de amigos')}</p></div>
      <button class="btn btn-pink btn-small" data-action="open-squad" data-id="${html(squad.id)}">Abrir</button></div>`).join('') : '<p class="small-muted">Ainda não participa de SQUAD. Você já pode criar um, sem precisar ir a um rolê antes.</p>'}</div>
    <div class="panel"><h3>O que é um SQUAD?</h3><p class="small-muted">Uma galera organizada com chat, enquetes, álbum privado, mural, convites por @nickname e até 3 administradores.</p>
      <div class="list-row"><div class="icon-disc">🔐</div><div class="grow"><strong>Entrada protegida</strong><p>Convites individuais precisam ser aceitos. Quem encontra o SQUAD pela busca solicita entrada e espera aprovação de um admin.</p></div></div>
      <div class="list-row"><div class="icon-disc">🛡️</div><div class="grow"><strong>Decisão em conjunto</strong><p>Excluir alguém do grupo exige concordância de 2 administradores, mesmo quando há 3.</p></div></div>
      <div class="list-row"><div class="icon-disc">🎂</div><div class="grow"><strong>Aniversários opcionais</strong><p>Quem permite, compartilha apenas dia e mês.</p></div></div></div>`;
  const extras = $('squad-live-extras');
  if (!extras) {
    const section = document.createElement('div');
    section.id = 'squad-live-extras';
    section.className = 'panel squad-live-extras';
    list.insertAdjacentElement('afterend', section);
  }
  const current = state.squads.find((row) => row.id === state.activeSquad);
  const currentRole = current ? state.squadRoles.get(current.id) : null;
  const manager = ['owner','moderator'].includes(currentRole);
  $('squad-live-extras').innerHTML = current ? `<div class="squad-extras-head"><div><span class="eyebrow">Comunidade selecionada</span><h3>${html(current.name)}</h3></div>
      <div class="squad-actions"><button class="btn btn-pink btn-small" data-action="open-squad" data-id="${html(current.id)}">Abrir conversa</button>
      ${manager ? `<button class="btn btn-ghost btn-small" data-action="rename-squad" data-id="${html(current.id)}">Renomear</button>` : ''}
      ${manager ? `<button class="btn btn-ghost btn-small" data-action="edit-album-link" data-id="${html(current.id)}">Link de álbum externo</button>` : ''}
      ${state.squadRoles.get(current.id) !== 'owner' ? `<button class="btn btn-ghost btn-small" data-action="leave-squad" data-id="${html(current.id)}">Sair do SQUAD</button>` : ''}</div></div>
      <div class="squad-guard-panel"><strong>🔐 Descoberta e acesso ao SQUAD</strong><p class="small-muted">As conversas, fotos e a lista de integrantes nunca ficam públicas na pesquisa. Encontrar o grupo só permite solicitar entrada.</p>
        ${currentRole==='owner' ? `<label class="squad-discovery-switch"><input type="checkbox" id="squad-discoverable" ${current.is_discoverable?'checked':''}> Permitir que encontrem este SQUAD na busca pelo nome</label>` :
        `<span class="small-muted">${current.is_discoverable?'Aparece nas buscas · acesso somente após aprovação.':'SQUAD privado, não aparece nas buscas.'}</span>`}
        ${manager ? `<div class="squad-actions"><button class="btn btn-pink btn-small" data-action="squad-join-requests" data-id="${html(current.id)}">💌 Pedidos de entrada</button>
          <button class="btn btn-ghost btn-small" data-action="squad-removals" data-id="${html(current.id)}">🛡️ Votos de remoção</button>
          <button class="btn btn-ghost btn-small" data-action="squad-roster" data-id="${html(current.id)}">👥 Integrantes e admins</button></div>`:''}</div>
      <div class="legal-note">🔐 <strong>Álbum do app:</strong> privado aos integrantes. ${current.album_url ? `<a href="${html(safeHttps(current.album_url))}" target="_blank" rel="noopener noreferrer">Abrir álbum externo (permissões do provedor) ↗</a>` : 'O link externo é opcional e só deve ser usado com acesso restrito no serviço de nuvem.'}</div>
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
    if ($('squad-discoverable')) $('squad-discoverable').addEventListener('change', async (event)=>{
      const checkbox=event.target;
      try {
        await assertOk(db.rpc('bora_set_squad_discovery',{_squad:current.id,_enabled:checkbox.checked}));
        current.is_discoverable=checkbox.checked;
        toast(checkbox.checked?'Seu SQUAD agora pode ser encontrado pelo nome. Entradas continuam sob aprovação.':'SQUAD removido das buscas públicas.');
      } catch(err) { checkbox.checked=!checkbox.checked; toast(friendlyError(err)); }
    });
    renderSquadCalendar(current.id);
  }
  icons();
}

function openSquadCreateForm(eventId = null) {
  const origin = eventId ? state.events.find((event) => event.id === eventId) : null;
  showModal('Criar meu SQUAD ✨', `
    <div class="squad-create-intro"><span class="squad-create-icon" aria-hidden="true">🫶</span>
      <div><span class="eyebrow">Sua galera, suas regras</span>
        <h3>Todo SQUAD começa com uma boa ideia.</h3>
        <p>Crie um espaço para conversar, combinar rolês e manter a galera reunida.</p></div></div>
    ${origin ? `<p class="squad-create-origin">🎟️ SQUAD ligado ao rolê <strong>${html(origin.title)}</strong>.</p>` : ''}
    <form id="squad-create-form" class="create-form squad-create-form">
      <div class="field"><label for="squad-new-name">Nome do SQUAD <span aria-hidden="true">*</span></label>
        <input id="squad-new-name" name="name" minlength="3" maxlength="65" required autocomplete="off"
          placeholder="Ex.: A galera do próximo rolê" aria-describedby="squad-name-tip">
        <small id="squad-name-tip" class="small-muted">De 3 a 65 caracteres. Escolha um nome que a galera reconheça.</small></div>
      <div class="field"><label for="squad-new-description">Qual é a vibe? <span class="optional-label">Opcional</span></label>
        <textarea id="squad-new-description" name="description" maxlength="500" rows="3"
          placeholder="Ex.: Amizades para curtir shows, cinema e um café no fim de semana."></textarea>
        <small class="small-muted">Uma descrição curta ajuda a apresentar o grupo aos convidados.</small></div>
      <label class="squad-create-visibility" for="squad-new-discoverable">
        <input id="squad-new-discoverable" type="checkbox" name="discoverable">
        <span><strong>🔎 Aparecer na busca de SQUADs</strong>
          <small>Se ativar, outras pessoas podem encontrar o nome e pedir entrada. Um admin terá de aprovar. Chats, integrantes e fotos continuam privados.</small></span></label>
      <div class="squad-create-rules"><strong>🔐 Seu espaço começa protegido</strong>
        <p>Você será o primeiro admin e poderá convidar mais 1 ou 2. Ninguém entra automaticamente: convites devem ser aceitos e pedidos pela busca precisam de aprovação.</p></div>
      <p id="squad-create-error" class="squad-create-error hidden" role="alert"></p>
      <div class="squad-create-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Agora não</button>
        <button type="submit" class="btn btn-pink">✨ Criar SQUAD</button></div>
    </form>`);
  $('squad-create-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = $('squad-new-name').value.trim().replace(/\s+/g, ' ');
    const description = $('squad-new-description').value.trim();
    const errorBox = $('squad-create-error');
    errorBox.classList.add('hidden');
    if (name.length < 3 || name.length > 65) {
      errorBox.textContent = 'O nome deve ter de 3 a 65 caracteres.';
      errorBox.classList.remove('hidden');
      return;
    }
    const submit = event.submitter;
    submit.disabled = true;
    try {
      const row = await assertOk(db.from('squads').insert({
        creator_id: state.user.id,
        origin_event_id: eventId,
        name,
        description,
        is_discoverable: $('squad-new-discoverable').checked
      }).select('id').single());
      state.activeSquad = row.id;
      await loadSquads();
      closeModal();
      navigate('squad');
      toast('Seu SQUAD está pronto! Convide a galera por @nickname. 💜');
    } catch (err) {
      const permissionError = err?.code === '42501' || /row.level security|permission denied/i.test(String(err?.message || ''));
      errorBox.textContent = permissionError
        ? 'Não foi possível criar o SQUAD por uma permissão do banco. Aplique a migração 15 no Supabase e tente novamente.'
        : friendlyError(err);
      errorBox.classList.remove('hidden');
    } finally { submit.disabled = false; }
  });
}

function createSquad(eventId) { openSquadCreateForm(eventId); }

function createIndependentSquad() { openSquadCreateForm(); }

async function editAlbumLink(squadId) {
  const squad=state.squads.find(item=>item.id===squadId);
  if (!squad) return;
  const next=prompt('Link HTTPS de álbum externo (opcional). O link só será privado se as permissões do provedor estiverem limitadas aos integrantes. Apague para remover:',squad.album_url || '');
  if (next===null) return;
  if (next.trim() && !safeHttps(next.trim())) return toast('Informe um link seguro https:// ou deixe vazio.');
  try {await assertOk(db.from('squads').update({album_url:next.trim() || null}).eq('id',squadId));
    await loadSquads();toast('Link do álbum externo atualizado. Confira as permissões na nuvem.');
  }catch(err){toast(err.message);}
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

async function requestSquadJoin(squadId) {
  if (!confirm('Solicitar entrada neste SQUAD? Você só terá acesso após a aprovação de um administrador.')) return;
  try {
    const status=await assertOk(db.rpc('bora_request_join_squad',{_squad:squadId}));
    const message=status==='already_member'?'Você já participa deste SQUAD.':
      status==='already_requested'?'Seu pedido já está aguardando um administrador.':
      'Pedido enviado! Você receberá uma notificação quando um admin decidir. Até lá, o grupo permanece privado.';
    toast(message);
  } catch(err){toast(friendlyError(err));}
}

async function openSquadJoinRequests(squadId) {
  try {
    const requests=await assertOk(db.rpc('bora_pending_squad_joins',{_squad:squadId}));
    showModal('Pedidos para entrar 💌',`<p class="small-muted">Qualquer administrador pode aprovar ou recusar a entrada. O solicitante não tem acesso ao grupo antes da aprovação.</p>
      ${requests?.length?requests.map(request=>`<article class="squad-request-card"><div class="grow"><strong>${html(request.display_name)}</strong><p>@${html(request.username)}</p><small>Solicitado em ${html(shortDate(request.created_at))}</small></div>
      <div class="squad-actions"><button class="btn btn-pink btn-small" data-action="review-squad-join" data-id="${html(request.request_id)}" data-squad="${html(squadId)}" data-approve="true">Aprovar entrada</button>
      <button class="btn btn-ghost btn-small" data-action="review-squad-join" data-id="${html(request.request_id)}" data-squad="${html(squadId)}" data-approve="false">Recusar</button></div></article>`).join(''):
      '<p class="small-muted">Nenhum pedido aguardando análise.</p>'}
      <button class="btn btn-ghost" data-action="close-modal">Voltar</button>`);
  }catch(err){toast(friendlyError(err));}
}

async function reviewSquadJoin(requestId,squadId,approve) {
  if(!confirm(approve?'Aprovar esta pessoa no SQUAD? Ela poderá acessar chat, mural e álbum privado.':'Recusar este pedido de entrada?'))return;
  try {
    await assertOk(db.rpc('bora_review_squad_join',{_request:requestId,_approve:approve}));
    toast(approve?'Entrada aprovada!':'Pedido recusado.');
    await openSquadJoinRequests(squadId);
  }catch(err){toast(friendlyError(err));}
}

async function openSquadRemovals(squadId) {
  try {
    const removals=await assertOk(db.rpc('bora_pending_squad_removals',{_squad:squadId}));
    showModal('Decisões dos administradores 🛡️',`<p class="legal-note">A exclusão de um integrante só é efetivada com dois votos de administradores ativos. Com apenas um admin, ninguém pode expulsar usuários.</p>
      ${removals?.length?removals.map(item=>`<article class="squad-request-card"><div class="grow"><strong>@${html(item.username)}</strong><p>${Number(item.votes)||0} de 2 aprovações necessárias · ${item.voted_by_me?'Você já aprovou esta remoção.':'Aguardando seu voto.'}</p></div>
      ${item.voted_by_me?'🕒':`<button class="btn btn-ghost btn-small" data-action="vote-squad-removal" data-id="${html(item.target_id)}" data-squad="${html(squadId)}">Concordar com a remoção</button>`}</article>`).join(''):
      '<p class="small-muted">Nenhuma proposta de remoção pendente.</p>'}
      <button class="btn btn-ghost" data-action="squad-roster" data-id="${html(squadId)}">Ver integrantes</button>`);
  }catch(err){toast(friendlyError(err));}
}

async function voteSquadRemoval(squadId,targetId) {
  if(!confirm('Confirmar seu voto para remover este integrante? A ação só será executada se um segundo administrador também concordar.'))return;
  try {
    const result=await assertOk(db.rpc('bora_vote_squad_removal',{_squad:squadId,_target:targetId}));
    toast(result==='removed'?'Dois administradores aprovaram. Integrante removido.':'Seu voto foi registrado. Aguardando aprovação de outro administrador.');
    await openSquadRemovals(squadId);
  }catch(err){toast(friendlyError(err));}
}

async function showSquadRoster(squadId) {
  try {
    const roster=await assertOk(db.rpc('bora_squad_roster',{_squad:squadId}));
    const owner=state.squadRoles.get(squadId)==='owner';
    const manager=['owner','moderator'].includes(state.squadRoles.get(squadId));
    const admins=(roster||[]).filter(item=>['owner','moderator'].includes(item.role)).length;
    showModal('Integrantes e administradores 🛡️',`<p class="small-muted">O SQUAD pode ter 2 ou 3 administradores. ${admins<2?'⚠️ Promova pelo menos um integrante a admin antes de propor remoções.':'Para remover um integrante, 2 administradores devem aprovar.'}</p>
      ${(roster||[]).map(profile=>`<div class="list-row"><div class="icon-disc">${profile.role==='owner'?'⭐':profile.role==='moderator'?'🛡️':'👤'}</div>
        <div class="grow"><strong>${html(profile.display_name)} · @${html(profile.username)}</strong><p>${html(profile.role==='owner'?'Criador':profile.role==='moderator'?'Administrador':'Integrante')}</p></div>
        <div class="squad-actions">${owner&&profile.role!=='owner'?`<button class="btn btn-ghost btn-small" data-action="set-squad-admin" data-id="${html(profile.user_id)}" data-squad="${html(squadId)}" data-promote="${profile.role==='moderator'?'false':'true'}">${profile.role==='moderator'?'Retirar cargo':'Promover admin'}</button>`:''}
        ${manager&&profile.role==='member'?`<button class="btn btn-ghost btn-small" data-action="vote-squad-removal" data-id="${html(profile.user_id)}" data-squad="${html(squadId)}">Propor remoção</button>`:''}
        ${profile.user_id!==state.user.id?`<button class="btn btn-ghost btn-small" data-action="block-found-user" data-nick="${html(profile.username)}">Bloquear</button>`:''}</div>
      </div>`).join('')||'<p class="small-muted">Nenhum integrante encontrado.</p>'}
      ${manager?`<button class="btn btn-pink btn-small" data-action="squad-removals" data-id="${html(squadId)}">Ver votos pendentes</button>`:''}
      <button class="btn btn-ghost" data-action="close-modal">Fechar</button>`);
    leaveRoom();
  }catch(err){toast(friendlyError(err));}
}

function leaveRoom() {
  if (state.chatChannel && db) db.removeChannel(state.chatChannel);
  state.chatChannel = null;
  state.activeRoom = null;
  for (const url of state.photoUrls) URL.revokeObjectURL(url);
  state.photoUrls=[];
}

async function openRoom(type, id) {
  if (type === 'event' && !state.joined.has(id)) return toast('Confirme participação antes de entrar no chat.');
  if (type === 'squad' && !state.squadRoles.has(id)) return toast('Você não participa desse SQUAD.');
  leaveRoom();
  const title = type === 'event' ? state.events.find((row) => row.id === id)?.title : state.squads.find((row) => row.id === id)?.name;
  state.activeRoom = {type,id};
  if (type === 'squad') state.activeSquad = id;
  showModal(`${title || 'Grupo'} 💬`, `<div class="room-topline"><span>🔒 Apenas integrantes têm acesso a esta conversa.</span><button class="btn btn-ghost btn-small" data-action="room-members">Integrantes</button></div>
    <div class="chat-tabs"><button class="active" data-room-tab="chat">Chat</button><button data-room-tab="mural">Informações 📌</button>
    <button data-room-tab="polls">Enquetes 📊</button>
    ${type === 'event' ? '<button data-room-tab="music">Músicas 🎵</button>' : ''}
    ${type === 'squad' ? '<button data-room-tab="album">Fotos 🔒</button>' : ''}
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
  } else if (tab === 'polls') {
    target.innerHTML = `<p class="small-muted">📊 Faça uma pergunta com 2 a 6 alternativas. Só integrantes votam; a identidade dos votantes não aparece.</p>
      <button class="btn btn-ghost btn-small" data-action="create-poll">+ Criar enquete</button><div id="poll-list"></div>`;
    await refreshPolls();
  } else if (tab === 'album' && room.type === 'squad') {
    target.innerHTML = `<p class="legal-note">🔐 Fotos guardadas em espaço privado. Só integrantes autenticados podem baixá-las; fotos não aparecem em links públicos. Respeite o consentimento de quem aparece nas imagens.</p>
      <form id="squad-photo-form" class="photo-form"><label>Adicionar foto ao SQUAD (até 1 MB depois de otimizada)<input type="file" name="photo" accept="image/*" required></label>
      <label>Legenda (opcional)<input name="caption" maxlength="180" placeholder="Que rolê foi esse? ✨"></label>
      <button class="btn btn-pink" type="submit">📸 Compartilhar só com o SQUAD</button></form>
      <div id="squad-gallery" class="photo-grid"></div>`;
    $('squad-photo-form').addEventListener('submit',uploadSquadPhoto);
    await refreshSquadPhotos();
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
    const list = await assertOk(db.from(table).select(room.type==='event'?'id,author_id,body,created_at,system_notice':'id,author_id,body,created_at').eq(key,room.id)
      .order('created_at',{ascending:false}).limit(50));
    if (!state.activeRoom || state.activeRoom.id !== room.id || !$('chat-messages')) return;
    const messages = (list || []).reverse();
    target.innerHTML = messages.length ? messages.map((message) => `<div class="bubble ${message.system_notice ? 'system' : message.author_id === state.user.id ? 'mine' : ''}">
      <small>${message.author_id === state.user.id ? 'Você' : 'Integrante'} · ${html(new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(message.created_at)))}</small>
      <span>${html(message.body)}</span>
      ${!message.system_notice && message.author_id !== state.user.id ? `<button class="bubble-report" title="Denunciar mensagem" data-action="report" data-kind="${room.type}_message" data-id="${message.id}">Denunciar</button>` : ''}</div>`).join('') :
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

async function refreshPolls() {
  const room=state.activeRoom, target=$('poll-list');
  if (!room || !target) return;
  const args={_event:room.type==='event'?room.id:null,_squad:room.type==='squad'?room.id:null};
  try {
    const rows=await assertOk(db.rpc('bora_get_polls',args));
    if (!$('poll-list') || state.activeRoom?.id!==room.id) return;
    target.innerHTML=(rows || []).length ? rows.map(p=>{
      const total=p.options.reduce((n,o)=>n+Number(o.votes),0);
      const closed=new Date(p.closes_at)<=new Date();
      return `<section class="poll-card"><strong>📊 ${html(p.question)}</strong><small>${closed?'Encerrada':'Até '+html(displayDate(p.closes_at))}${p.multiple?' · Múltiplas escolhas':''}</small>
      ${p.options.map(o=>`<div class="poll-answer"><button class="btn btn-ghost btn-small" ${closed?'disabled':''} data-action="vote-poll" data-poll="${html(p.id)}" data-option="${html(o.id)}">${o.mine?'✅':'◯'} ${html(o.label)}</button><div class="poll-progress"><span style="width:${total?Math.round(Number(o.votes)*100/total):0}%"></span></div><small>${o.votes} voto(s) · ${total?Math.round(Number(o.votes)*100/total):0}%</small></div>`).join('')}
      </section>`;
    }).join(''):'<p class="small-muted">Ainda não há enquetes. Crie a primeira pra combinar com a galera!</p>';
  } catch(err){target.textContent=`Não foi possível carregar as enquetes: ${err.message}`;}
}

function createPoll() {
  const room=state.activeRoom;if (!room) return;
  const initial=new Date(Date.now()+86400000);
  const local=new Date(initial.getTime()-initial.getTimezoneOffset()*60000).toISOString().slice(0,16);
  showModal('Nova enquete 📊',`<p class="small-muted">A enquete fica visível somente para quem participa do grupo.</p>
    <form id="poll-form" class="create-form"><label>Pergunta<input name="question" minlength="8" maxlength="180" required placeholder="Qual dia a gente se encontra?"></label>
    ${Array.from({length:4},(_,i)=>`<label>Opção ${i+1}${i<2?' *':''}<input name="option${i+1}" maxlength="90" ${i<2?'required':''} placeholder="Resposta ${i+1}"></label>`).join('')}
    <label>Encerra em<input name="closes" type="datetime-local" value="${local}" required></label>
    <label class="check-label"><input type="checkbox" name="multiple"> Permitir votar em mais de uma opção</label>
    <button class="btn btn-pink" type="submit">Publicar enquete</button></form>`);
  $('poll-form').addEventListener('submit',async(ev)=>{
    ev.preventDefault();const data=Object.fromEntries(new FormData(ev.target));
    const options=[1,2,3,4].map(i=>String(data[`option${i}`] || '').trim()).filter(Boolean);
    const ends=new Date(data.closes);if(!Number.isFinite(ends.getTime()))return toast('Informe encerramento válido.');
    try {await assertOk(db.rpc('bora_create_poll',{
      _event:room.type==='event'?room.id:null,_squad:room.type==='squad'?room.id:null,
      _question:data.question.trim(),_options:options,_multiple:data.multiple==='on',_closes_at:ends.toISOString()}));
      closeModal();await openRoom(room.type,room.id);await changeRoomTab('polls');toast('Enquete publicada!');
    }catch(err){toast(err.message);}
  });
}

async function votePoll(pollId,optionId) {
  try {await assertOk(db.rpc('bora_vote_poll',{_poll:pollId,_option:optionId}));
    await refreshPolls();toast('Voto registrado!');}catch(err){toast(err.message);}
}

async function refreshSquadPhotos() {
  const room=state.activeRoom,target=$('squad-gallery');
  if (!room || room.type!=='squad' || !target) return;
  target.innerHTML='<p class="small-muted">Carregando fotos privadas…</p>';
  for(const url of state.photoUrls)URL.revokeObjectURL(url);
  state.photoUrls=[];
  try {
    const rows=await assertOk(db.from('squad_photos').select('id,path,caption,uploaded_by,created_at')
      .eq('squad_id',room.id).order('created_at',{ascending:false}).limit(36));
    const photos=await Promise.all((rows || []).map(async(row)=>{
      const result=await db.storage.from('squad-albums').download(row.path);
      if(result.error || !result.data) return {...row,url:''};
      return {...row,url:URL.createObjectURL(result.data)};
    }));
    if(state.activeRoom?.id!==room.id || !$('squad-gallery')){
      photos.forEach(photo=>{if(photo.url)URL.revokeObjectURL(photo.url);});return;
    }
    state.photoUrls=photos.map(p=>p.url).filter(Boolean);
    const isManager=['owner','moderator'].includes(state.squadRoles.get(room.id));
    target.innerHTML=photos.length?photos.map(photo=>`<article class="photo-card">
      ${photo.url?`<img loading="lazy" src="${html(photo.url)}" alt="Foto compartilhada no SQUAD">`:'<div>Foto indisponível</div>'}
      <small>${html(photo.caption || 'Momento da galera 📸')}</small>
      ${(isManager || photo.uploaded_by===state.user.id)?`<button class="btn btn-ghost btn-small" data-action="delete-squad-photo" data-id="${html(photo.id)}" data-path="${html(photo.path)}">Remover</button>`:''}
      <button class="inline-button" data-action="report" data-kind="squad" data-id="${html(room.id)}">Denunciar conteúdo</button></article>`).join(''):
      '<p class="small-muted">O álbum ainda está vazio. Compartilhe a primeira lembrança do SQUAD!</p>';
  }catch(err){target.textContent=`Galeria indisponível: ${err.message}`;}
}

async function uploadSquadPhoto(ev) {
  ev.preventDefault();const room=state.activeRoom;
  if(!room || room.type!=='squad')return;
  const file=ev.target.elements.photo.files?.[0];if(!file)return;
  const caption=String(ev.target.elements.caption.value || '').trim();
  const id=crypto.randomUUID(),path=`${room.id}/${id}.webp`,button=ev.submitter;
  button.disabled=true;
  try {
    const blob=await compressWebp(file,1048576);
    await assertOk(db.storage.from('squad-albums').upload(path,blob,{contentType:'image/webp',upsert:false}));
    try {await assertOk(db.from('squad_photos').insert({id,squad_id:room.id,uploaded_by:state.user.id,path,caption}));}
    catch(err){await db.storage.from('squad-albums').remove([path]);throw err;}
    ev.target.reset();await refreshSquadPhotos();toast('Foto compartilhada apenas com o SQUAD. 🔐');
  }catch(err){toast(`Falha ao adicionar foto: ${err.message}`);}finally{button.disabled=false;}
}

async function deleteSquadPhoto(id,path) {
  if(!confirm('Remover esta foto do álbum privado do SQUAD?'))return;
  try {await assertOk(db.storage.from('squad-albums').remove([path]));
    await assertOk(db.from('squad_photos').delete().eq('id',id));
    await refreshSquadPhotos();toast('Foto removida.');}catch(err){toast(err.message);}
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
  if (room.type==='squad') {
    return showSquadRoster(room.id);
  }
  const table = room.type === 'event' ? 'event_members' : 'squad_members';
  const key = room.type === 'event' ? 'event_id' : 'squad_id';
  try {
    const query = db.from(table).select(room.type==='squad'?'user_id,role':'user_id').eq(key,room.id).limit(30);
    if (room.type === 'event') query.eq('status','joined');
    const rows = await assertOk(query);
    const profiles = await Promise.all(rows.map(async (row) => {
      try {
        const card = await assertOk(db.rpc('get_profile_card',{_target:row.user_id}));
        return card?.[0] ? {...card[0],role:row.role || 'member'} : null;
      } catch { return null; }
    }));
    const visible = profiles.filter(Boolean);
    const withAvatar = visible.filter((profile) => profile.avatar_path);
    if (withAvatar.length) {
      const signed = await db.storage.from('avatars').createSignedUrls(withAvatar.map((p) => p.avatar_path),90);
      if (!signed.error) withAvatar.forEach((profile,i) => {profile.avatarUrl=safeHttps(signed.data[i]?.signedUrl);});
    }
    showModal('Participantes deste grupo', `<p class="small-muted">Exibindo até 30 perfis. Dados e fotos aparecem somente conforme as permissões de cada usuário. SQUAD: até três administradores (criador + dois moderadores).</p>
      ${visible.map((profile) => `<div class="list-row"><div class="icon-disc">${profile.avatarUrl ? `<img src="${html(profile.avatarUrl)}" alt="Foto de @${html(profile.username)}" class="member-photo">` : '👤'}</div><div class="grow"><strong>@${html(profile.username)}</strong>
        <p>${html(profile.bio || 'Perfil privado')}${profile.city ? ` · ${html(profile.city)}` : ''}${room.type==='squad' ? ` · ${html(profile.role==='owner'?'⭐ Dono':profile.role==='moderator'?'🛡️ Administrador':'Integrante')}` : ''}</p></div>
        ${room.type==='squad' && state.squadRoles.get(room.id)==='owner' && profile.role!=='owner'
        ? `<button class="btn btn-ghost btn-small" data-action="set-squad-admin" data-id="${html(profile.user_id)}" data-squad="${html(room.id)}" data-promote="${profile.role==='moderator'?'false':'true'}">${profile.role==='moderator'?'Remover admin':'Tornar admin'}</button>`:''}
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
    <p class="legal-note">Nunca compartilhe seu código de recuperação, senha ou links de acesso.</p>
    <div class="danger-zone"><h3>🗑️ Excluir minha conta</h3>
      <p>Você pode apagar sua conta imediatamente, após confirmar sua senha. Se houver denúncia ou investigação pendente envolvendo sua conta ou conteúdo, o pedido será registrado para análise humana.</p>
      <button class="btn btn-ghost" data-action="delete-account-start">Excluir minha conta definitivamente</button></div>`);
  $('account-password-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = Object.fromEntries(new FormData(event.target));
      await assertOk(db.auth.updateUser({password:data.password}));
      closeModal(); toast('Senha atualizada.');
    } catch (err) { toast(err.message); }
  });
}

function openDeleteAccount() {
  showModal('Excluir conta definitivamente', `<div class="danger-zone"><h3>Esta ação não pode ser desfeita</h3>
    <p>Seu acesso e dados pessoais serão excluídos. Seus SQUADs com outros participantes continuarão com um novo administrador. Registros de moderação necessários à proteção de direitos poderão ser preservados.</p>
    <p><strong>Se uma denúncia estiver em investigação, sua solicitação será encaminhada à moderação em vez da exclusão imediata.</strong></p></div>
    <form id="confirm-account-deletion" class="privacy-form">
      <label>Digite EXCLUIR para confirmar<input name="confirmation" placeholder="EXCLUIR" autocomplete="off" spellcheck="false" required></label>
      <label>Sua senha atual<input name="password" type="password" autocomplete="current-password" required></label>
      <p id="delete-account-feedback" class="small-muted" role="status" aria-live="polite"></p>
      <button class="btn btn-pink" type="submit">Confirmar exclusão definitiva</button>
      <button class="btn btn-ghost" type="button" data-action="account">Voltar sem excluir</button></form>`);
  $('confirm-account-deletion').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const message = $('delete-account-feedback');
    if (values.confirmation !== 'EXCLUIR') {
      message.textContent = 'Digite EXCLUIR em letras maiúsculas para continuar.';
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    message.textContent = 'Confirmando sua identidade e verificando a conta…';
    try {
      // Confirmação recente da senha antes de uma operação irreversível.
      await assertOk(db.auth.signInWithPassword({email:state.user.email,password:values.password}));
      const { data, error } = await db.functions.invoke('delete-account', {body:{confirmed:true}});
      if (error) throw error;
      if (data?.outcome === 'review_required') {
        toast('Existe uma pendência de segurança. Seu pedido foi encaminhado à moderação.');
        return await openPrivacyRequests();
      }
      if (data?.outcome !== 'deleted') throw Error('A exclusão não foi confirmada. Contate a moderação antes de repetir a solicitação.');
      try { await db.auth.signOut({scope:'local'}); } catch { /* Conta já removida do Auth. */ }
      state.sessionVersion++;
      state.user = null; state.profile = null; state.opened = false; state.isModerator = false;
      leaveRoom(); closeModal(); showGate('login');
      feedback('Sua conta foi excluída. Obrigado por ter feito parte da nossa galera. 💜', false);
    } catch (err) {
      message.textContent = /invalid login credentials/i.test(err.message || '')
        ? 'Senha atual incorreta. Tente novamente.'
        : 'Não foi possível confirmar a exclusão agora. Sua conta pode estar em processamento. Entre em contato com moderacao.boraprorole@gmail.com se o problema continuar.';
      submit.disabled = false;
    }
  });
}

async function openAudiencePreferences() {
  try {
    const prefs=await assertOk(db.from('private_profile_data')
      .select('gender_identity,lgbtq_identifies,audience_consent_at').eq('user_id',state.user.id).maybeSingle());
    showModal('Suas identificações 🔐',`<p class="legal-note">Estes dados são opcionais, sensíveis e <strong>privados</strong>. Servem para você confirmar presença em rolês direcionados. Mulheres trans são mulheres; homens trans são homens. A escolha é autodeclarada e pode ser removida a qualquer momento.</p>
      <form id="audience-preferences-form" class="create-form">
        <label>Identidade de gênero<select name="gender"><option value="">Não informar</option>
          ${[['woman','Mulher'],['man','Homem'],['nonbinary','Pessoa não binária'],['other','Outra'],['prefer_not','Prefiro não dizer']].map(([value,label])=>`<option value="${value}" ${value===prefs?.gender_identity?'selected':''}>${label}</option>`).join('')}</select></label>
        <label>Você se identifica como LGBTQIA+?<select name="lgbtq"><option value="">Não informar</option><option value="yes" ${prefs?.lgbtq_identifies===true?'selected':''}>Sim</option><option value="no" ${prefs?.lgbtq_identifies===false?'selected':''}>Não</option></select></label>
        <label class="check-label"><input name="consent" type="checkbox" ${prefs?.audience_consent_at?'checked':''}> Autorizo o tratamento destas identificações para elegibilidade nos rolês direcionados. Posso revogar a qualquer momento.</label>
        <button class="btn btn-pink" type="submit">Salvar minhas escolhas</button>
        <button class="btn btn-ghost" type="button" data-action="revoke-audience">Apagar minhas identificações</button></form>`);
    $('audience-preferences-form').addEventListener('submit',async(event)=>{
      event.preventDefault();const data=Object.fromEntries(new FormData(event.target));
      if ((data.gender||data.lgbtq) && data.consent!=='on')return toast('Marque o consentimento ou apague as identificações.');
      try {await assertOk(db.rpc('set_audience_preferences',{
        _gender:data.consent==='on'?(data.gender||null):null,
        _lgbtq:data.consent==='on'?(data.lgbtq==='yes'?true:data.lgbtq==='no'?false:null):null,
        _consent:data.consent==='on'}));closeModal();toast('Identificações atualizadas com privacidade.');
      }catch(err){toast(err.message);}
    });
  }catch(err){toast(err.message);}
}

async function openPrivacyRequests() {
  try {
    const rows = await assertOk(db.from('privacy_requests')
      .select('id,kind,details,status,staff_response,created_at,updated_at')
      .eq('requester_id',state.user.id).order('created_at',{ascending:false}).limit(20));
    const labels = {access:'Acesso aos dados',correction:'Correção de dados',portability:'Portabilidade',
      deletion:'Exclusão da conta/dados',opposition:'Oposição ao tratamento',other:'Outra solicitação'};
    showModal('Seus dados e direitos — LGPD', `<p class="small-muted">Este canal registra solicitações de dados para análise humana. Para excluir sua conta, use <strong>Meu perfil → Senha e exclusão da conta</strong>. Solicitações não são públicas e algumas informações podem exigir retenção legal.</p>
      <form id="privacy-request-form" class="privacy-form"><label>O que deseja solicitar?
        <select name="kind" required>${Object.entries(labels).filter(([key])=>key!=='deletion').map(([key,label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
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
    const [events,reports,privacy,cancellations] = await Promise.all([
      assertOk(db.from('events').select('id,title,description,category,starts_at,venue_name,address,city,state_code,cover_path,venue_instagram,ticket_url,creator_id,requires_verified_age,screening_reason').eq('status','published').eq('needs_review',true).order('created_at',{ascending:true}).limit(25)),
      assertOk(db.from('reports').select('id,target_kind,target_id,reason,details,evidence_snapshot,status,created_at').in('status',['pending','reviewing']).order('created_at',{ascending:true}).limit(40)),
      assertOk(db.from('privacy_requests').select('id,requester_id,kind,details,status,created_at').in('status',['pending','in_progress']).order('created_at',{ascending:true}).limit(30)),
      assertOk(db.from('event_cancel_requests').select('id,event_id,requester_id,reason,created_at').eq('status','pending').order('created_at',{ascending:true}).limit(30))
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
      <h3>🔎 Alertas de eventos já publicados (${events.length})</h3><div class="mod-list">${events.length ? events.map(row => `<article class="mod-card">
        ${row.coverUrl ? `<img src="${html(row.coverUrl)}" alt="Capa a revisar" class="mod-cover">` : ''}
        <strong>${html(row.title)}</strong><small>${html(displayDate(row.starts_at))} · ${html(row.category)}</small>
        <p>${html(row.description)}</p><p>📍 ${html(row.venue_name || '')} · ${html(row.address)} · ${html(row.city)} / ${html(row.state_code)}</p>
        <p>Organizador: ${html(row.creator_id)} ${row.requires_verified_age ? ' · EXIGE VERIFICAÇÃO INDEPENDENTE' : ''}</p>
        ${row.screening_reason ? `<p><strong>Alerta automático:</strong> ${html(row.screening_reason)}</p>` : ''}
        ${safeHttps(row.ticket_url) ? `<a href="${html(safeHttps(row.ticket_url))}" target="_blank" rel="noopener noreferrer">Revisar ingressos ↗</a>` : ''}
        ${row.venue_instagram ? `<p>Instagram informado: ${html(row.venue_instagram)}</p>` : ''}
        ${safeHttps(row.venue_instagram) ? `<a href="${html(safeHttps(row.venue_instagram))}" target="_blank" rel="noopener noreferrer">Revisar Instagram ↗</a>` : ''}
        <div class="mod-actions"><button class="btn btn-ghost btn-small" data-action="mod-remove" data-kind="event" data-id="${html(row.id)}">Remover anúncio ilícito</button>
        <button class="btn btn-pink btn-small" data-action="mod-event" data-decision="published" data-id="${html(row.id)}">Revisado sem violação</button></div></article>`).join('') : '<p class="small-muted">Nenhum alerta novo.</p>'}</div>
      <h3>🗓️ Pedidos de cancelamento (${cancellations.length})</h3><div class="mod-list">${cancellations.length ? cancellations.map(row=>`<article class="mod-card"><strong>Rolê ${html(row.event_id)}</strong><small>Solicitado em ${html(displayDate(row.created_at))}</small>
        <p>Motivo: ${html(row.reason)}</p><div class="mod-actions"><button class="btn btn-pink btn-small" data-action="mod-cancel" data-decision="approve" data-id="${html(row.id)}">Autorizar cancelamento</button>
        <button class="btn btn-ghost btn-small" data-action="mod-cancel" data-decision="deny" data-id="${html(row.id)}">Negar com justificativa</button></div></article>`).join(''):'<p class="small-muted">Sem pedidos de cancelamento.</p>'}</div>
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
    if (action === 'mod-cancel') await assertOk(db.rpc('bora_review_cancel',{_request:el.dataset.id,_approve:el.dataset.decision==='approve',_reason:reason.trim()}));
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
      case 'detail-save': await saveEvent(id);return await openDetails(id);
      case 'edit-event': return await editEvent(id);
      case 'cancel-event': return await cancelEvent(id);
      case 'safety': closeAndLeaveRoom(); return navigate('seguranca');
      case 'save-profile': return await saveProfile();
      case 'follow-found-user': return await followFoundUser(id,element.dataset.nick);
      case 'block-found-user': return await blockFoundNickname(element.dataset.nick);
      case 'manage-blocks': return await manageBlockedNicknames();
      case 'unblock-found-user': return await unblockFoundNickname(element.dataset.nick);
      case 'notifications': return await openNotifications();
      case 'account': return await openAccount();
      case 'delete-account-start': return openDeleteAccount();
      case 'audience-preferences': return await openAudiencePreferences();
      case 'revoke-audience': {
        if(!confirm('Apagar suas identificações opcionais? Você deixará de confirmar presença em rolês de público direcionado.'))return;
        await assertOk(db.rpc('set_audience_preferences',{_gender:null,_lgbtq:null,_consent:false}));
        closeModal();return toast('Identificações privadas apagadas.');
      }
      case 'privacy-requests': return await openPrivacyRequests();
      case 'moderation': return await openModeration();
      case 'mod-event': case 'mod-report': case 'mod-remove': case 'mod-suspend': case 'mod-privacy': case 'mod-cancel':
        return await performModeration(action, element);
      case 'logout': return await authAction('logout');
      case 'open-squad': return await openRoom('squad', id);
      case 'create-squad': return await createSquad(id);
      case 'create-independent-squad': return await createIndependentSquad();
      case 'rename-squad': return await renameSquad(id);
      case 'edit-album-link': return await editAlbumLink(id);
      case 'request-squad-join': return await requestSquadJoin(id);
      case 'squad-join-requests': return await openSquadJoinRequests(id);
      case 'review-squad-join': return await reviewSquadJoin(id,element.dataset.squad,element.dataset.approve==='true');
      case 'squad-roster': return await showSquadRoster(id);
      case 'squad-removals': return await openSquadRemovals(id);
      case 'vote-squad-removal': return await voteSquadRemoval(element.dataset.squad,id);
      case 'set-squad-admin': {
        if(!confirm(element.dataset.promote==='true'?'Promover este integrante a administrador do SQUAD?':'Remover o cargo de administrador?'))return;
        await assertOk(db.rpc('bora_set_squad_admin',{_squad:element.dataset.squad,_member:id,_promote:element.dataset.promote==='true'}));
        toast('Permissão do integrante atualizada.');
        await loadSquads();return await showSquadRoster(element.dataset.squad);
      }
      case 'leave-squad': return await leaveSquad(id);
      case 'accept-invite': return await respondInvite(id, true);
      case 'decline-invite': return await respondInvite(id, false);
      case 'add-calendar': return openCalendarForm(id);
      case 'room-members': return await openRoomMembers();
      case 'create-poll': return createPoll();
      case 'vote-poll': return await votePoll(element.dataset.poll,element.dataset.option);
      case 'delete-squad-photo': return await deleteSquadPhoto(id,element.dataset.path);
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
