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
const safeDriveFolder = (value) => {
  const url=safeHttps(value);
  if(!url)return '';
  const parsed=new URL(url);
  return parsed.hostname==='drive.google.com' && parsed.pathname.includes('/folders/') ? url : '';
};
// Mostrar/ocultar senha sem comprometer o valor digitado; requisitos informativos.
function enhancePasswordFields(root) {
  if (!root) return;
  root.querySelectorAll('input[type="password"]').forEach((input) => {
    if (input.closest('.bpr-password-field')) return;
    const wrapper = document.createElement('span');
    wrapper.className = 'bpr-password-field';
    input.parentNode.insertBefore(wrapper,input);
    wrapper.append(input);
    const toggle = document.createElement('button');
    toggle.type='button'; toggle.className='bpr-toggle-password';
    toggle.textContent='Mostrar'; toggle.setAttribute('aria-pressed','false');
    toggle.setAttribute('aria-label','Mostrar senha');
    wrapper.append(toggle);
    if (input.autocomplete === 'new-password' && input.name === 'password') {
      const hint=document.createElement('small');
      hint.className='bpr-password-hint';hint.setAttribute('aria-live','polite');
      hint.textContent='Use pelo menos 8 caracteres. Evite senhas comuns.';
      wrapper.after(hint);
      input.addEventListener('input', () => {
        const v=input.value;
        hint.textContent=!v?'Use pelo menos 8 caracteres. Evite senhas comuns.':
          v.length<8?'Faltam '+(8-v.length)+' caracteres.':
          /[a-zA-Z]/.test(v)&&/[0-9]/.test(v)&&/[^a-zA-Z0-9]/.test(v)?'Boa combinação de caracteres. Não reutilize senhas.':
          'Tamanho mínimo atingido. Misture letras, números e símbolos.';
      });
    }
  });
}
document.addEventListener('click', (event) => {
  const button=event.target.closest('.bpr-toggle-password');
  if (!button) return;
  const input=button.parentElement.querySelector('input');
  if (!input) return;
  const visible=input.type==='password';
  input.type=visible?'text':'password';
  button.textContent=visible?'Ocultar':'Mostrar';
  button.setAttribute('aria-pressed',String(visible));
  button.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');
  input.focus({preventScroll:true});
});

function friendlyError(error) {
  const message = String(error?.message || '');
  if (error?.code === '23505' || /profiles_username_key|duplicate key value.*username/i.test(message)) {
    return 'Este @user já está em uso. Escolha outro para continuar.';
  }
  if (/duplicate key value|unique constraint/i.test(message)) return 'Esse dado já está cadastrado. Confira as informações e tente novamente.';
  if (/invalid login credentials|invalid credentials/i.test(message)) return 'E-mail ou senha incorretos. Confira e tente novamente.';
  if (/email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar. Confira também a pasta de spam.';
  if (/user already registered|email.*already.*(registered|exists|taken)/i.test(message)) return 'Este e-mail já está cadastrado. Entre na sua conta ou recupere a senha.';
  if (/weak.password|password.*(too short|at least|minimum|weak|requirements|characters)|password.*(contain|include)/i.test(message) || error?.code==='weak_password')
    return 'Senha não aceita. Use pelo menos 8 caracteres e evite combinações muito comuns; misture letras, números e símbolos.';
  if (/invalid email|email.*invalid|email address.*not valid/i.test(message)) return 'Digite um endereço de e-mail válido.';
  if (/rate limit|too many requests|security purposes/i.test(message)) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.';
  if (/network|failed to fetch|fetch failed|timeout/i.test(message)) return 'Não foi possível conectar. Confira sua internet e tente novamente.';
  // Erros escritos pelo próprio aplicativo já estão em português.
  if (/[áàâãçéêíóôõú]|\b(não|seu|sua|informe|confirme|cadastro|precisa|deve)\b/i.test(message)) return message;
  if (message) console.warn('Erro técnico tratado no aplicativo:',error?.code || '',message);
  return 'Não foi possível concluir esta operação. Tente novamente ou entre em contato com o suporte.';
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
const recoveryRedirect = () => new URL('./index.html?auth=reset', currentRedirect()).href;
const recoveryReturn = new URLSearchParams(location.search).get('auth') === 'reset' || confirmationFragment.get('type') === 'recovery';
const authReturnError = confirmationError || new URLSearchParams(location.search).get('error');
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
    const match = parsed.pathname.match(new RegExp(`^(?:/intl-[a-z]{2,3})?/${type}/([A-Za-z0-9]{22})/?$`, 'i'));
    return parsed.protocol === 'https:' && parsed.hostname === 'open.spotify.com' ? (match?.[1] || '') : '';
  } catch { return ''; }
}
function spotifyEmbed(url, type = 'playlist') {
  const id = spotifyId(url, type);
  if (!id) return '';
  return `<div class="spotify-optin"><div><strong>🎧 Player do Spotify</strong><small>Ao ativar, o Spotify poderá receber dados de navegação conforme suas próprias políticas.</small></div>
    <button class="btn btn-ghost btn-small" data-action="spotify-load" data-spotify-kind="${type}" data-spotify-id="${id}">▶ Ouvir aqui</button></div>`;
}
// Preferências públicas da plataforma; no primeiro deploy sem SQL, mantém o comportamento antigo.
const bprControl = { settings: null, lastRead: 0, promise: null, lastSuccess: false };
const defaultBprSettings = {
  mode:'normal', message:'Estamos preparando novidades. Voltamos em breve!', announcement:'',
  banner_enabled:true, banner_title:'Conheça o Tem Gogó!',
  banner_url:'https://appspwa-zlsp.github.io/tem-gogo/',
  notice_kind:'info', squad_games_enabled:false, community_card:null
};
function applyBprPublicSettings(settings) {
  const config = {...defaultBprSettings, ...(settings || {})};
  const wall = $('bpr-maintenance');
  if (wall) {
    const on = config.mode === 'maintenance';
    wall.classList.toggle('hidden', !on);
    $('bpr-maintenance-message').textContent = config.message;
    // O status de manutenção se sobrepõe à sessão e não a encerra.
    document.body.classList.toggle('bpr-maintenance-active', on);
    $('auth-gate').inert = on;
    document.querySelector('.shell').inert = on;
  }
  const promo = $('bpr-promo');
  if (promo) {
    const target = safeHttps(config.banner_url);
    promo.classList.toggle('hidden', !config.banner_enabled || !target);
    promo.href = target || defaultBprSettings.banner_url;
    $('bpr-promo-title').textContent = config.banner_title;
    const featuredBanner=$('bpr-feature-tem');
    if(featuredBanner) featuredBanner.href=target || defaultBprSettings.banner_url;
  }
  const scheduled = config.mode === 'scheduled';
  const msg = config.announcement || config.message || 'Novidades em preparação. O app continua funcionando.';
  const topNotice = $('bpr-scheduled-strip');
  if (topNotice) {
    topNotice.classList.toggle('hidden', !scheduled);
    $('bpr-scheduled-summary').textContent = 'Atualização em andamento · ' + msg;
    topNotice.dataset.fullMessage = msg;
  }
  const gateNotice = $('bpr-auth-scheduled');
  if (gateNotice) {
    gateNotice.classList.toggle('hidden', !scheduled);
    gateNotice.textContent = '🔧 Atualização em andamento: o aplicativo continua disponível.';
  }
  const announcement = $('bpr-announcement');
  if (announcement) {
    const notice = config.announcement || (config.mode === 'scheduled' ? 'Manutenção programada. Acompanhe as próximas atualizações.' : '');
    announcement.textContent = notice;
    announcement.dataset.kind = ['info','news','warning','partnership'].includes(config.notice_kind) ? config.notice_kind : 'info';
    announcement.classList.toggle('hidden', !notice);
  }
  const card = config.community_card;
  const cardEl = $('bpr-public-card');
  if (cardEl) {
    const visible = !!(card && card.active === true && typeof card.title === 'string' && typeof card.body === 'string');
    cardEl.classList.toggle('hidden', !visible);
    if (visible) {
      cardEl.dataset.kind = ['celebration','info','warning','partnership'].includes(card.style) ? card.style : 'celebration';
      $('bpr-card-label').textContent = cardEl.dataset.kind === 'celebration' ? '💌 CARTÃO PARA A GALERA' : 'RECADO DA COMUNIDADE';
      $('bpr-card-title').textContent = card.title;
      $('bpr-card-body').textContent = card.body;
      const link = $('bpr-card-link');
      const url = safeHttps(card.url);
      link.classList.toggle('hidden', !url || !card.button);
      if (url && card.button) { link.href = url; link.textContent = card.button + ' ↗'; }
      else link.removeAttribute('href');
    }
  }
  bprControl.settings = config;
  const gamesOn = Boolean(config.squad_games_enabled && config.mode !== 'maintenance');
  document.querySelectorAll('.bpr-games-entry').forEach(el => {
    el.classList.toggle('hidden', !gamesOn);
    el.hidden = !gamesOn;
  });
  document.querySelector('[data-room-tab="games"]')?.toggleAttribute('hidden', !gamesOn);
  if (!gamesOn) {
    window.BPRGames?.close();
    if (state?.opened && activeScreen() === 'jogos') navigate('explorar');
    if (state.activeRoom?.type === 'squad' && document.querySelector('[data-room-tab="games"].active')) {
      changeRoomTab('chat').catch(() => {});
    }
  }
  refreshBprFeatures();
  if (state?.opened && activeScreen() === 'squad') renderSquadGames();
}
async function refreshBprPublicSettings(force=false) {
  if (!db) return defaultBprSettings;
  if (bprControl.promise) return bprControl.promise;
  if (!force && bprControl.lastRead && Date.now() - bprControl.lastRead < 30000) return bprControl.settings;
  bprControl.promise = (async () => {
    try {
      const {data,error} = await db.rpc('bpr_get_public_settings');
      if (error) throw error;
      bprControl.lastRead = Date.now();
      bprControl.lastSuccess = true;
      const wasMaintenance = bprControl.settings?.mode === 'maintenance';
      applyBprPublicSettings(data);
      if (wasMaintenance && data?.mode !== 'maintenance' && !state.opened) {
        // Saiu da manutenção: retoma o onboarding/login sem perder sessão.
        setTimeout(() => syncSession().catch(() => {}), 0);
      }
      return bprControl.settings;
    } catch (error) {
      // Em releases anteriores à instalação das RPCs, não interferir no app.
      if (!bprControl.lastSuccess) applyBprPublicSettings(defaultBprSettings);
      return bprControl.settings || defaultBprSettings;
    } finally { bprControl.promise = null; }
  })();
  return bprControl.promise;
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

// Navegação por histórico: o botão/gesto Voltar do Android percorre telas e modais.
// A primeira tela substitui a entrada atual para não prender o usuário no PWA.
const BORA_HISTORY_KEY = '__boraScreen';
function activeScreen() {
  return document.querySelector('.screen.active')?.id.replace(/^screen-/, '') || 'explorar';
}
function updateAppHistory(screen, modal = false, replace = false) {
  if (!state.opened) return;
  const previous = history.state?.[BORA_HISTORY_KEY];
  if (previous?.screen === screen && previous.modal === modal) return;
  const next = { ...(history.state || {}), [BORA_HISTORY_KEY]: {screen, modal} };
  if (replace || !previous) history.replaceState(next, '', location.href);
  else history.pushState(next, '', location.href);
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 5000);
}

// Confirmações e entradas padronizadas: nenhum window.prompt/confirm/alert com a URL do site.
let activeDecision = null;
let skipDecisionPopstate = false;
function finishAppDecision(value, fromHistory = false) {
  const decision = activeDecision;
  if (!decision) return;
  activeDecision = null;
  $('decision-overlay').classList.add('hidden');
  $('decision-form').reset();
  $('decision-field-error').classList.add('hidden');
  if (!fromHistory && history.state?.__boraDecision) {
    skipDecisionPopstate = true;
    history.back();
  }
  decision.focus?.focus?.();
  decision.resolve(value);
}
function appDecision({title='Confirme sua escolha',message='',label='',initial='',minLength=0,maxLength=900,
  confirmLabel='Confirmar',cancelLabel='Cancelar',danger=false}={}) {
  if (activeDecision) return Promise.resolve(null);
  const inputMode = Boolean(label);
  $('decision-title').textContent=title;
  $('decision-description').textContent=message;
  $('decision-field-wrap').classList.toggle('hidden',!inputMode);
  $('decision-field-label').textContent=label || 'Sua resposta';
  $('decision-input').value=initial;
  $('decision-input').minLength=minLength;
  $('decision-input').maxLength=maxLength;
  $('decision-submit').textContent=confirmLabel;
  $('decision-submit').classList.toggle('app-decision-danger',danger);
  $('decision-cancel').textContent=cancelLabel;
  $('decision-overlay').classList.remove('hidden');
  $('decision-field-error').classList.add('hidden');
  if (state.opened) history.pushState({...history.state,__boraDecision:true},'',location.href);
  return new Promise(resolve=>{
    activeDecision={resolve,inputMode,minLength,maxLength,focus:document.activeElement};
    (inputMode?$('decision-input'):$('decision-submit')).focus();
  });
}
async function appConfirm(message,options={}) {
  return await appDecision({title:'Só pra confirmar ✨',message,confirmLabel:'Sim, confirmar',...options})===true;
}
async function appPrompt(label,initial='',options={}) {
  return await appDecision({title:'Vamos ajustar ✨',label,initial,confirmLabel:'Salvar',...options});
}

function feedback(message, error = true) {
  $('auth-feedback').textContent = message;
  $('auth-feedback').classList.toggle('error', error);
  $('auth-feedback').setAttribute('role',error?'alert':'status');
}

function showGate(stage, data = {}) {
  $('auth-gate').classList.remove('hidden');
  const authMessage = $('auth-feedback');
  if (authMessage && $('auth-stage').contains(authMessage)) $('auth-stage').after(authMessage);
  authMessage.textContent = '';
  authMessage.classList.remove('error');
  authMessage.setAttribute('role','status');
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
      <label>Seu @user<input name="username" minlength="3" maxlength="24" pattern="[a-z0-9_.]{3,24}" autocapitalize="none" required placeholder="seu.user"></label>
      <label>Data de nascimento (uso privado, 18+)<input name="birthdate" type="date" required></label>
      <label>Cidade<input name="city" maxlength="90" placeholder="Ex.: São Paulo"></label>
      <label>Um pouco sobre você (opcional)<textarea name="bio" maxlength="300" rows="2" placeholder="Qual é a sua vibe?"></textarea></label>
      <label>Instagram pessoal (opcional)<input name="instagram" maxlength="140" placeholder="@seuperfil"></label>
      <details class="signup-identity"><summary>🔐 Identificação opcional e privada</summary><p class="small-muted">Use apenas se quiser participar de rolês com público direcionado. Você pode configurar isso depois no Perfil.</p>
        <label>Identidade de gênero<select name="gender"><option value="">Prefiro não informar</option><option value="woman">Mulher</option><option value="man">Homem</option><option value="nonbinary">Pessoa não binária</option><option value="other">Outra identificação</option></select></label>
        <label>Você se identifica como LGBTQIA+?<select name="lgbtq"><option value="">Prefiro não informar</option><option value="yes">Sim</option><option value="no">Não</option></select></label>
        <label class="check-label"><input type="checkbox" name="sensitive_consent"> <span>Autorizo o uso dessas identificações apenas para controlar minha entrada em rolês direcionados. Posso revogar depois.</span></label></details>
      <label>Senha (mínimo 8 caracteres)<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
      <label>Confirme sua senha<input name="confirm_password" type="password" minlength="8" autocomplete="new-password" required></label>
      <label class="check-label"><input type="checkbox" name="truth_acknowledged" required><span>Declaro que tenho 18 anos ou mais, que a data é verdadeira e sei que poderemos solicitar comprovação futuramente.</span></label>
      <label class="check-label"><input type="checkbox" name="legal_acknowledged" required><span>Li e aceito os <a href="./termos.html" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e as <a href="./comunidade.html" target="_blank" rel="noopener noreferrer">Regras da Comunidade</a>. Estou ciente da <a href="./privacidade.html" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.</span></label>
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
    reset: `<h1>Crie sua nova senha 🔐</h1><p class="small-muted">O link de recuperação foi validado. Após salvar, você voltará ao login.</p><form id="reset-form" class="auth-form">
      <label>Nova senha<input name="password" type="password" minlength="8" autocomplete="new-password" required></label>
      <label>Repita a nova senha<input name="confirm_password" type="password" minlength="8" autocomplete="new-password" required></label>
      <button class="btn btn-pink" type="submit">Salvar nova senha e voltar ao login</button></form>`,
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
      <label>@user único<input name="username" maxlength="24" minlength="3" pattern="[a-z0-9_.]{3,24}" required placeholder="seu.user" autocapitalize="none"></label>
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
  const activeForm=$('auth-stage').querySelector('form.auth-form');
  if (activeForm) {
    // Erros de formulários aparecem dentro do app, sem balões nativos do navegador.
    activeForm.noValidate=true;
    activeForm.querySelector('button[type="submit"]')?.before(authMessage);
  }
  enhancePasswordFields($('auth-stage'));
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
    if(form) {
      const invalid=[...form.querySelectorAll('input,select,textarea')].find(field=>!field.checkValidity());
      if(invalid) {
        const label=invalid.closest('label')?.textContent?.trim() || 'campo';
        const msg=invalid.name==='username'?'Escolha um @user de 3 a 24 caracteres: letras minúsculas, números, ponto ou _.':
          invalid.name==='password'?'Sua senha precisa ter pelo menos 8 caracteres.':
          invalid.type==='email'?'Digite um endereço de e-mail válido.':
          invalid.type==='checkbox'?'Marque a confirmação necessária para continuar.':
          `Confira o campo “${label}” antes de continuar.`;
        feedback(`❌ ${msg}`);
        invalid.focus();return;
      }
    }
    feedback('Processando…', false);
    const data = form ? Object.fromEntries(new FormData(form)) : {};
    if (kind === 'login') {
      await assertOk(db.auth.signInWithPassword({ email: data.email, password: data.password }));
      await syncSession();
    } else if (kind === 'signup') {
      if (String(data.password||'').length<8) throw Error('Sua senha precisa ter pelo menos 8 caracteres.');
      if (data.password !== data.confirm_password) throw Error('As senhas digitadas não coincidem.');
      const birth = String(data.birthdate || '');
      const birthday = new Date(`${birth}T12:00:00`);
      const adultDate = new Date(); adultDate.setFullYear(adultDate.getFullYear() - 18);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !Number.isFinite(birthday.getTime()) || birthday > adultDate)
        throw Error('O cadastro é exclusivo para maiores de 18 anos. Confira sua data de nascimento.');
      const nickname = String(data.username || '').toLowerCase().trim();
      if (!/^[a-z0-9_.]{3,24}$/.test(nickname)) throw Error('Seu @user deve ter de 3 a 24 caracteres: letras minúsculas, números, . ou _.');
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
      await assertOk(db.auth.resetPasswordForEmail(data.email, {redirectTo: recoveryRedirect()}));
      showGate('login'); feedback('Se o email estiver cadastrado, você receberá instruções para redefinir a senha.', false);
    } else if (kind === 'reset') {
      if (data.password !== data.confirm_password) throw Error('As senhas digitadas não coincidem.');
      if (String(data.password||'').length < 8) throw Error('Use pelo menos 8 caracteres na nova senha.');
      const { data: sessionData, error: sessionError } = await db.auth.getSession();
      if (sessionError || !sessionData?.session) throw Error('Seu link expirou. Solicite um novo link de recuperação.');
      await assertOk(db.auth.updateUser({ password: data.password }));
      await assertOk(db.auth.signOut());
      recoveringPassword = false;
      history.replaceState(history.state, '', currentRedirect());
      showGate('login');
      feedback('Sua senha foi alterada. Agora entre com a nova senha.', false);
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
      if (!/^[a-z0-9_.]{3,24}$/.test(username)) throw Error('Seu @user deve ter de 3 a 24 caracteres: a-z, 0-9, ponto ou _.');
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
  await refreshBprPublicSettings();
  if (bprControl.settings?.mode === 'maintenance') return;
  state.lastSessionCheck = Date.now();
  const session = await assertOk(db.auth.getSession());
  if (version !== state.sessionVersion) return;
  if (!session?.session?.user) {
    pendingBirthdate = null;
    state.user = null;
    void refreshNotificationBadge();
    bprProfileStyle={cover_theme:'aurora',relationship_status:null,show_relationship:false,preferred_categories:[]};
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
    bprStartNotificationRefresh();void refreshNotificationBadge();
    if (!sameUser || Date.now() - state.lastAppRefresh > 180000) {
      await loadAppData();
      state.lastAppRefresh = Date.now();
    }
    if (!state.opened) {
      state.opened = true;
      // Ao reabrir o PWA, nenhuma janela antiga deve permanecer no histórico.
      updateAppHistory('explorar', false, true);
      navigate('explorar', true);
      setTimeout(()=>startBprTour(),900);
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
  const alreadyOpen = !$('modal').classList.contains('hidden');
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
  if (!alreadyOpen && state.opened) {
    const screen = activeScreen();
    if (!history.state?.[BORA_HISTORY_KEY]) updateAppHistory(screen, false, true);
    updateAppHistory(screen, true);
  }
  enhancePasswordFields($('dialog-body'));
  icons();
}

function closeModal(fromHistory = false) {
  releaseAvatarCrop();
  const wasOpen = !$('modal').classList.contains('hidden');
  if (state.pickerMap) { state.pickerMap.remove(); state.pickerMap = null; }
  $('modal').classList.add('hidden');
  $('dialog-body').innerHTML = '';
  document.body.style.overflow = '';
  state.lastFocus?.focus?.();
  if (wasOpen && !fromHistory && history.state?.[BORA_HISTORY_KEY]?.modal) {
    updateAppHistory(activeScreen(), false, true);
  }
}

function navigate(page, fromHistory = false) {
  if (!state.user || !$('auth-gate').classList.contains('hidden')) return;
  if (page === 'criar') return openCreate();
  if (page === 'jogos' && !window.BPRGamesAllowed?.()) return toast('Os jogos estão desativados pela administração.');
  const previousScreen = activeScreen();
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('active', screen.id === `screen-${page}`));
  document.querySelectorAll('[data-nav]').forEach((button) => button.classList.toggle('active', button.dataset.nav === page));
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (page === 'explorar') setTimeout(() => state.map?.invalidateSize(), 140);
  if (page === 'meus') {
    renderMine();
    const selected = document.querySelector('[data-my-tab].active')?.dataset.myTab || 'joined';
    document.querySelectorAll('[data-my-panel]').forEach(panel => {
      panel.hidden = panel.dataset.myPanel !== selected;
    });
  }
  if (page === 'squad') renderSquads();
  if (!fromHistory && (previousScreen !== page || !history.state?.[BORA_HISTORY_KEY])) {
    updateAppHistory(page, false, !history.state?.[BORA_HISTORY_KEY]);
  }
  icons();
}

window.addEventListener('popstate', (event) => {
  if (skipDecisionPopstate) {skipDecisionPopstate=false;return;}
  if (activeDecision) {finishAppDecision(null,true);return;}
  if (!state.opened || !$('auth-gate').classList.contains('hidden')) return;
  const destination = event.state?.[BORA_HISTORY_KEY];
  if (!destination) return; // permite sair normalmente ao chegar ao histórico anterior ao app
  if (!$('modal').classList.contains('hidden')) {
    leaveRoom();
    closeModal(true);
  }
  if (destination.screen !== activeScreen()) navigate(destination.screen, true);
});

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
  ['🌐 CONEXÃO REAL','Seu jeito.<br>Sua turma.','Converse, combine e compartilhe bons momentos sem pressão.']
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

let bprSpotifyId = null;
async function loadHomePlaylist() {
  const target = $('home-spotify-embed');
  const link = $('bpr-feature-spotify-link');
  const preview = $('bpr-feature-spotify-preview');
  const description = $('bpr-feature-spotify-description');
  try {
    const row = await assertOk(db.from('app_settings').select('value').eq('key','home_spotify_playlist_url').maybeSingle());
    const url = String(row?.value || '').trim();
    bprSpotifyId = spotifyId(url,'playlist') || null;
    if(target) target.innerHTML = bprSpotifyId ? spotifyEmbed(`https://open.spotify.com/playlist/${bprSpotifyId}`) : '<p class="small-muted">Nenhuma playlist oficial configurada.</p>';
    if(bprSpotifyId) {
      link.href = `https://open.spotify.com/playlist/${bprSpotifyId}`;
      link.hidden = false;
      preview.hidden = false;
      description.textContent = 'Ouça aqui uma prévia ou abra a playlist no Spotify.';
    } else {
      link.hidden = true;
      link.removeAttribute('href');
      preview.hidden = true;
      description.textContent = 'A playlist oficial ainda não foi cadastrada.';
    }
  } catch (err) {
    bprSpotifyId = null;
    if(target) target.textContent = 'Playlist indisponível no momento.';
    link.hidden = true;
    link.removeAttribute('href');
    preview.hidden = true;
    description.textContent = 'Não conseguimos carregar a playlist. Tente novamente mais tarde.';
  }
  refreshBprFeatures();
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
  const reason=await appPrompt('Motivo do cancelamento','',{title:'Cancelar rolê',message:'Os participantes serão avisados. Explique o motivo com pelo menos 8 caracteres.',confirmLabel:'Continuar',minLength:8});
  if (reason===null) return;
  if (reason.trim().length<8) return toast('Descreva brevemente o motivo do cancelamento.');
  if (!await appConfirm('Até 5 confirmados, o cancelamento é imediato. Acima disso, a moderação precisa autorizar.',{title:'Confirmar cancelamento',confirmLabel:'Solicitar cancelamento',danger:true})) return;
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
  const myCounts = {
    joined: state.events.filter(event => state.joined.has(event.id)).length,
    saved: state.events.filter(event => state.saved.has(event.id)).length,
    created: state.events.filter(event => event.creatorId === state.user?.id).length
  };
  for (const [kind, count] of Object.entries(myCounts)) {
    const target = $(`bpr-count-${kind}`);
    if (target) target.textContent = String(count);
  }
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

// V5.6A: formulário progressivo, CEP consultado sob demanda e mapa somente após resolução.
function openCreate() {
  state.eventDraftPendingId = null;
  state.eventDraftCoverUploaded = false;
  state.eventCoverBlob = null;
  state.pickedCoords = null;
  state.pickerMap = null;
  state.pickerMarker = null;
  showModal('Criar um rolê ✨', `<form id="event-form" class="create-form bpr-create-wizard">
    <div class="bpr-wizard-progress" aria-label="Etapas de criação"><span class="active">1</span><span>2</span><span>3</span><span>4</span></div>
    <p class="small-muted bpr-wizard-hint">Preencha uma etapa por vez. Você poderá voltar para corrigir antes de publicar.</p>
    <section class="bpr-create-step" data-step="0" aria-label="Etapa 1: O plano">
      <h3>🎉 Qual é o plano?</h3>
      <div class="field"><label for="new-title">Nome do rolê *</label><input id="new-title" maxlength="100" minlength="5" required placeholder="Ex.: Cine + café no sábado"></div>
      <div class="field"><label for="new-category">Categoria *</label><select id="new-category">${categories.slice(1).map((c) => `<option value="${c[0]}">${c[1]} ${c[2]}</option>`).join('')}</select></div>
      <div class="field"><label for="new-venue">Nome do local (opcional)</label><input id="new-venue" maxlength="120" placeholder="Ex.: Cinemark Shopping"></div>
      <div class="field"><label for="new-description">Descrição e combinados *</label><textarea id="new-description" minlength="10" maxlength="2000" required placeholder="Como será o encontro? O que a galera precisa saber?"></textarea></div>
    </section>
    <section class="bpr-create-step" data-step="1" aria-label="Etapa 2: Data e participação" hidden>
      <h3>📅 Quando e para quem?</h3>
      <div class="fields"><div class="field"><label for="new-start">Início *</label><input id="new-start" type="datetime-local" required></div><div class="field"><label for="new-end">Término previsto *</label><input id="new-end" type="datetime-local" required></div></div>
      <div class="field"><label for="new-audience">Quem pode confirmar presença?</label><select id="new-audience"><option value="all">🌎 Todas as pessoas</option><option value="women">👩 Somente mulheres</option><option value="men">👨 Somente homens</option><option value="lgbtq">🏳️‍🌈 Somente pessoas LGBTQIA+</option></select><small class="small-muted">Rolês direcionados usam apenas as identificações privadas e autorizadas, respeitando as regras antidiscriminação.</small></div>
      <label class="check-label"><input id="new-verified" type="checkbox"> O local exige documento e aceita somente maiores de 18 anos.</label>
    </section>
    <section class="bpr-create-step" data-step="2" aria-label="Etapa 3: Localização" hidden>
      <h3>📍 Onde vai ser?</h3>
      <p class="small-muted">Digite o CEP para buscar rua, bairro, cidade e UF. Depois informe o número. O pino será posicionado automaticamente para sua conferência.</p>
      <div class="fields"><div class="field"><label for="bpr-event-cep">CEP (8 dígitos)</label><input id="bpr-event-cep" inputmode="numeric" maxlength="9" autocomplete="postal-code" placeholder="00000-000"></div><div class="field"><label for="new-number">Número do local *</label><input id="new-number" maxlength="15" required placeholder="Ex.: 125"></div></div>
      <p id="bpr-cep-feedback" class="small-muted" role="status" aria-live="polite">Após informar um CEP, buscaremos o endereço.</p>
      <div class="field"><label for="new-address">Rua ou avenida *</label><input id="new-address" maxlength="170" required placeholder="Rua, avenida ou praça"></div>
      <div class="fields"><div class="field"><label for="bpr-event-district">Bairro</label><input id="bpr-event-district" maxlength="80" placeholder="Bairro"></div><div class="field"><label for="bpr-event-complement">Complemento (opcional)</label><input id="bpr-event-complement" maxlength="70" placeholder="Shopping, piso..."></div></div>
      <div class="fields"><div class="field"><label for="new-city">Cidade *</label><input id="new-city" maxlength="90" required placeholder="Cidade"></div><div class="field"><label for="new-state">UF *</label><input id="new-state" maxlength="2" required placeholder="SP"></div></div>
      <button type="button" id="bpr-resolve-address" class="btn btn-ghost">Localizar endereço e conferir no mapa</button>
      <div id="bpr-map-guide" class="bpr-map-fallback" hidden>
        <h4>Não encontrou o endereço? Use o Google Maps</h4>
        <ol><li>Abra o Google Maps e procure o local público.</li><li>Toque em <strong>Compartilhar</strong> e depois em <strong>Copiar link</strong>.</li><li>Volte aqui e cole o link. Links encurtados podem exigir que você preencha o endereço acima manualmente.</li></ol>
        <div class="field"><label for="bpr-map-link">Link do Google Maps</label><input id="bpr-map-link" type="url" placeholder="https://www.google.com/maps/..."></div>
        <button type="button" id="bpr-resolve-link" class="btn btn-ghost">Conferir link no mapa</button>
      </div>
      <button type="button" id="bpr-map-guide-toggle" class="bpr-map-help">Não encontrou? Veja como copiar o link no Google Maps</button>
      <div id="bpr-map-preview" hidden><div id="map-picker" class="map-picker"></div><p id="picker-location" class="small-muted" role="status">Local ainda não confirmado.</p>
        <label class="check-label"><input id="bpr-confirm-location" type="checkbox"> Conferi o mapa e este é o local público correto do rolê.</label></div>
      <p class="small-muted">O mapa é somente uma prévia, sem marcação por toque. A precisão do serviço pode variar; confira o endereço antes de publicar.</p>
    </section>
    <section class="bpr-create-step" data-step="3" aria-label="Etapa 4: Imagem e revisão" hidden>
      <h3>✨ Últimos detalhes</h3>
      <div class="field"><label for="new-cover">Capa do rolê (opcional)</label>
        <label class="file-picker" for="new-cover"><input id="new-cover" type="file" accept="image/jpeg,image/png,image/webp"><span class="file-picker-button">📸 Escolher capa</span><span class="file-picker-name" id="new-cover-name" aria-live="polite">Nenhuma imagem selecionada</span></label>
      </div>
      <div id="bpr-event-cover-editor" class="bpr-event-cover-editor" hidden><p class="small-muted">Arraste a imagem e ajuste o zoom para enquadrar o cartão do evento.</p><canvas id="bpr-event-cover-canvas" width="960" height="540" aria-label="Prévia do corte horizontal"></canvas><label for="bpr-event-cover-zoom">Zoom</label><input id="bpr-event-cover-zoom" type="range" min="1" max="3" step="0.05" value="1"></div>
      <details class="bpr-create-extras"><summary>Mais opções <small>Instagram, ingresso, playlist e custos</small></summary><div class="bpr-create-extras-body">
        <div class="field"><label for="new-insta">Instagram do local</label><input id="new-insta" placeholder="@local ou https://..."></div>
        <div class="field"><label for="new-ticket">Link de ingresso</label><input id="new-ticket" type="url" placeholder="https://..."></div>
        <div class="field"><label for="new-playlist">Playlist Spotify</label><input id="new-playlist" type="url" placeholder="https://open.spotify.com/playlist/..."></div>
        <div class="field"><label for="new-spend">Gasto estimado por pessoa (R$)</label><input id="new-spend" type="number" min="0" max="100000" step="0.01" placeholder="Deixe vazio se não souber"></div>
        <div class="field"><label for="new-spend-notes">Observações de custos</label><input id="new-spend-notes" maxlength="250" placeholder="Ingresso, consumo..."></div>
      </div></details>
      <p class="legal-note">Confira o endereço público e os combinados. Não publique residências, dados pessoais de terceiros nem convites a práticas ilegais.</p>
      <div id="bpr-event-cover-error" class="bpr-cover-recovery" hidden role="alert"><p id="bpr-event-cover-error-text"></p><label class="check-label"><input type="checkbox" id="bpr-publish-no-cover"> Quero publicar sem a foto, caso o upload continue indisponível.</label><p class="small-muted">Se preferir a imagem, deixe desmarcado e toque em tentar novamente. Seus dados serão mantidos.</p></div>
    </section>
    <div class="bpr-wizard-actions"><button type="button" class="btn btn-ghost" id="bpr-step-back" hidden>← Voltar</button><button type="button" class="btn btn-pink" id="bpr-step-next">Continuar →</button><button type="submit" class="btn btn-pink" id="bpr-step-submit" hidden>Publicar rolê</button></div>
    </form>`);
  let currentStep = 0;
  const steps = [...document.querySelectorAll('.bpr-create-step')];
  const dots = [...document.querySelectorAll('.bpr-wizard-progress span')];
  const setStep = (index) => {
    currentStep = index;
    steps.forEach((el,i) => {el.hidden = i !== index;});
    dots.forEach((el,i) => el.classList.toggle('active',i <= index));
    $('bpr-step-back').hidden = index === 0;
    $('bpr-step-next').hidden = index === 3;
    $('bpr-step-submit').hidden = index !== 3;
    $('dialog-body')?.scrollTo({top:0,behavior:'instant'});
    if (index===2 && state.pickerMap) setTimeout(()=>state.pickerMap.invalidateSize(),80);
  };
  const validateStep = (index) => {
    for(const el of steps[index].querySelectorAll('input,textarea,select')) {
      if(el.disabled || !el.required || el.checkValidity()) continue;
      el.reportValidity(); return false;
    }
    if(index===1){const start=new Date($('new-start').value),end=new Date($('new-end').value);
      if(!(start > new Date()) || !(end > start)){toast('Confira os horários. O término precisa ser posterior ao início.');return false;}}
    if(index===2 && (!state.pickedCoords || !$('bpr-confirm-location').checked)) {toast('Localize e confirme o endereço no mapa.');return false;}
    return true;
  };
  $('bpr-step-next').addEventListener('click',()=>{if(validateStep(currentStep))setStep(currentStep+1);});
  $('bpr-step-back').addEventListener('click',()=>setStep(Math.max(0,currentStep-1)));
  const userCity=String(state.profile?.city || '').trim();
  if(userCity)$('new-city').value=userCity;
  if(cityCoordinates[cityKey(userCity)])$('new-state').value=cityCoordinates[cityKey(userCity)][2];
  $('new-start').min=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
  const resetLocation=()=>{state.pickedCoords=null;$('bpr-map-preview').hidden=true;$('bpr-confirm-location').checked=false;};
  ['new-address','new-number','new-city','new-state','bpr-event-district','bpr-event-complement','bpr-map-link'].forEach(id => $(id).addEventListener('input',resetLocation));
  let cepRequest=0;
  $('bpr-event-cep').addEventListener('input',async(e)=>{
    const digits=e.target.value.replace(/\D/g,'').slice(0,8);e.target.value=digits.length>5?`${digits.slice(0,5)}-${digits.slice(5)}`:digits;
    resetLocation();const request=++cepRequest;
    if(digits.length!==8){$('bpr-cep-feedback').textContent='Informe 8 dígitos para buscar o endereço.';return;}
    $('bpr-cep-feedback').textContent='Buscando endereço pelo CEP…';
    try {
      const response=await fetch(`https://viacep.com.br/ws/${digits}/json/`,{headers:{Accept:'application/json'}});
      if(!response.ok)throw Error('Consulta de CEP indisponível.');
      const data=await response.json();if(request!==cepRequest)return;
      if(data.erro||!data.localidade||!data.uf)throw Error('CEP não localizado. Confira os números ou use o Google Maps.');
      $('new-address').value=data.logradouro||'';
      $('bpr-event-district').value=data.bairro||'';
      $('new-city').value=data.localidade||'';
      $('new-state').value=data.uf||'';
      $('bpr-cep-feedback').textContent=data.logradouro?'Endereço preenchido. Informe o número e confira o mapa.':'CEP localizado, mas é necessário informar a rua e o número manualmente.';
    } catch(err){if(request!==cepRequest)return;$('bpr-cep-feedback').textContent=err.message;$('bpr-map-guide').hidden=false;}
  });
  $('bpr-map-guide-toggle').addEventListener('click',()=>{$('bpr-map-guide').hidden=!$('bpr-map-guide').hidden;});
  $('bpr-resolve-address').addEventListener('click',resolveBprLocation);
  $('bpr-resolve-link').addEventListener('click',resolveBprLocation);
  let crop=null;
  const disposeCrop=()=>{crop?.bitmap?.close?.();crop=null;state.eventCoverBlob=null;};
  $('new-cover').addEventListener('change',async(ev)=>{
    const file=ev.target.files?.[0];disposeCrop();$('bpr-event-cover-editor').hidden=true;
    $('new-cover-name').textContent=file?.name||'Nenhuma imagem selecionada';
    if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>15*1024*1024){ev.target.value='';toast('Escolha JPG, PNG ou WebP de até 15 MB.');return;}
    try{
      crop={bitmap:await createImageBitmap(file),zoom:1,x:0,y:0,pointer:null,lastX:0,lastY:0};
      $('bpr-event-cover-editor').hidden=false;
      const canvas=$('bpr-event-cover-canvas');const ctx=canvas.getContext('2d');
      const render=()=>{
        if(!crop)return;
        const bmp=crop.bitmap,scale=Math.max(960/bmp.width,540/bmp.height)*crop.zoom;
        const w=bmp.width*scale,h=bmp.height*scale;
        crop.x=Math.min((w-960)/2,Math.max(-(w-960)/2,crop.x));crop.y=Math.min((h-540)/2,Math.max(-(h-540)/2,crop.y));
        ctx.clearRect(0,0,960,540);ctx.drawImage(bmp,(960-w)/2+crop.x,(540-h)/2+crop.y,w,h);
      };
      const stage=canvas;
      stage.onpointerdown=(e)=>{crop.pointer=e.pointerId;crop.lastX=e.clientX;crop.lastY=e.clientY;stage.setPointerCapture?.(e.pointerId);};
      stage.onpointermove=(e)=>{if(!crop||crop.pointer!==e.pointerId)return;const k=960/Math.max(1,stage.getBoundingClientRect().width);crop.x+=(e.clientX-crop.lastX)*k;crop.y+=(e.clientY-crop.lastY)*k;crop.lastX=e.clientX;crop.lastY=e.clientY;render();};
      stage.onpointerup=stage.onpointercancel=(e)=>{if(crop&&crop.pointer===e.pointerId)crop.pointer=null;};
      $('bpr-event-cover-zoom').oninput=(e)=>{if(crop){crop.zoom=Number(e.target.value);render();}};
      render();
      // O corte permanece no canvas até o envio; não é gravado em Storage ao selecionar.
    }catch(err){disposeCrop();toast(`Não foi possível abrir esta imagem: ${friendlyError(err)}`);}
  });
  state.prepareEventCover=async()=>{
    if(!crop)return null;
    const canvas=$('bpr-event-cover-canvas');
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.78));
    if(!blob||blob.type!=='image/webp')throw Error('Não foi possível converter a capa em WebP.');
    return blob.size<=524288?blob:await compressWebp(new File([blob],'capa.webp',{type:'image/webp'}),524288);
  };
  $('event-form').addEventListener('submit',submitEvent);
  setStep(0);
}

function bprNewEventAddress() {
  const road=$('new-address').value.trim(),number=$('new-number').value.trim();
  const neighborhood=$('bpr-event-district').value.trim(),extra=$('bpr-event-complement').value.trim();
  return [road, number, neighborhood, extra].filter(Boolean).join(', ');
}

// Geocodificação iniciada pelo usuário: nunca inventar coordenadas de links sem posição.
async function resolveBprLocation() {
  const button=$('bpr-resolve-address');const link=$('bpr-map-link').value.trim();
  let coords=null;let label='';
  if(link){
    try{
      const url=new URL(link);
      if(url.protocol!=='https:'||!/(^|\.)(google\.com|google\.com\.br|maps\.app\.goo\.gl|goo\.gl)$/.test(url.hostname))throw Error('Cole um link HTTPS do Google Maps.');
      const raw=decodeURIComponent(url.pathname+url.search);
      const patterns=[/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,/[?&](?:q|query|ll)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/];
      for(const pattern of patterns){const m=raw.match(pattern);if(m){coords={lat:Number(m[1]),lng:Number(m[2])};break;}}
      if(coords&&(!Number.isFinite(coords.lat)||!Number.isFinite(coords.lng)||Math.abs(coords.lat)>90||Math.abs(coords.lng)>180))coords=null;
      if(!coords){$('bpr-map-guide').hidden=false;toast('Este link não contém coordenadas verificáveis. Use o endereço e número ou copie o endereço completo no Maps.');return;}
      label='Coordenadas obtidas do link do Maps. Confirme que correspondem ao endereço informado.';
    }catch(err){toast(err.message);return;}
  } else {
    const address=bprNewEventAddress(),city=$('new-city').value.trim(),uf=$('new-state').value.trim();
    if($('new-address').value.trim().length<4||!$('new-number').value.trim()||city.length<2||uf.length!==2)return toast('Informe rua, número, cidade e UF antes de localizar.');
    button.disabled=true;
    try{
      const query=encodeURIComponent(`${address}, ${city}, ${uf}, Brasil`);
      const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${query}`,{headers:{Accept:'application/json'}});
      if(!res.ok)throw Error('O serviço de localização não respondeu. Tente novamente mais tarde.');
      const places=await res.json();if(!places.length)throw Error('Endereço não localizado. Confira o número ou use o Google Maps.');
      coords={lat:Number(places[0].lat),lng:Number(places[0].lon)};
      label=`Resultado: ${places[0].display_name}. Confirme antes de publicar.`;
    }catch(err){$('bpr-map-guide').hidden=false;toast(err.message);return;}
    finally{button.disabled=false;}
  }
  state.pickedCoords=coords;$('bpr-confirm-location').checked=false;
  $('bpr-map-preview').hidden=false;
  if(window.L){
    if(!state.pickerMap){state.pickerMap=L.map('map-picker',{scrollWheelZoom:false}).setView([coords.lat,coords.lng],16);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(state.pickerMap);
      state.pickerMap.getContainer().setAttribute('aria-label','Mapa de confirmação, sem edição por toque');
    }
    state.pickerMap.setView([coords.lat,coords.lng],16);
    if(state.pickerMarker)state.pickerMarker.setLatLng([coords.lat,coords.lng]);
    else state.pickerMarker=L.marker([coords.lat,coords.lng]).addTo(state.pickerMap);
    setTimeout(()=>state.pickerMap?.invalidateSize(),120);
  }
  $('picker-location').textContent=label;
  toast('Local encontrado. Confira o endereço e marque a confirmação.');
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
  if (!state.pickedCoords || !$('bpr-confirm-location').checked) return toast('Confirme a localização no mapa antes de publicar.');
  const start=new Date($('new-start').value), end=new Date($('new-end').value);
  if(!(start>new Date())||!(end>start))return toast('Confira as datas e horários do rolê.');
  const ticket=$('new-ticket').value.trim(),playlist=$('new-playlist').value.trim();
  if(ticket&&!safeHttps(ticket))return toast('O ingresso precisa usar https://');
  if(playlist&&!spotifyId(playlist,'playlist'))return toast('Informe uma playlist válida do Spotify.');
  const button=event.submitter||$('bpr-step-submit');button.disabled=true;
  try {
    const row={creator_id:state.user.id,title:$('new-title').value.trim(),category:$('new-category').value,
      description:$('new-description').value.trim(),starts_at:start.toISOString(),ends_at:end.toISOString(),
      venue_name:$('new-venue').value.trim()||null,address:bprNewEventAddress(),
      city:$('new-city').value.trim(),state_code:$('new-state').value.trim().toUpperCase(),
      latitude:state.pickedCoords.lat,longitude:state.pickedCoords.lng,
      venue_instagram:$('new-insta').value.trim()||null,ticket_url:ticket||null,
      spotify_playlist_url:playlist||null,
      estimated_spend_brl:$('new-spend').value===''?null:Number($('new-spend').value),
      spend_notes:$('new-spend-notes').value.trim()||null,
      venue_checks_id:$('new-verified').checked,audience:$('new-audience').value,requires_verified_age:false};
    // Validar/comprimir imagem ANTES de inserir o evento evita rascunhos por imagens inválidas.
    const file=$('new-cover').files?.[0];
    const skipCover=!!$('bpr-publish-no-cover')?.checked;
    const blob=file&&!skipCover&&!state.eventDraftCoverUploaded?await state.prepareEventCover?.():null;
    if(file&&!skipCover&&!state.eventDraftCoverUploaded&&!blob)throw Error('Escolha uma imagem compatível ou publique sem foto.');
    let uid=state.eventDraftPendingId;
    if(!uid){
      uid=crypto.randomUUID();
      await assertOk(db.from('events').insert({...row,id:uid}));
      state.eventDraftPendingId=uid;
    } else {
      // Reaproveita o evento pending em nova tentativa, sem criar duplicatas.
      await assertOk(db.from('events').update(row).eq('id',uid).eq('creator_id',state.user.id).eq('status','pending'));
    }
    if(file&&!skipCover){
      try{
        const path=`${uid}/cover.webp`;
        if(!state.eventDraftCoverUploaded){
          // Um arquivo novo usa apenas a política INSERT; não exige UPDATE/SELECT de upsert.
          await assertOk(db.storage.from('event-covers').upload(path,blob,{contentType:'image/webp',upsert:false}));
          state.eventDraftCoverUploaded=true;
        }
        await assertOk(db.from('events').update({cover_path:path}).eq('id',uid).eq('creator_id',state.user.id).eq('status','pending'));
      } catch(err){
        $('bpr-event-cover-error').hidden=false;
        $('bpr-event-cover-error-text').textContent=`Não foi possível salvar a capa: ${friendlyError(err)}. O evento ficou pendente e não foi publicado.`;
        button.textContent='Tentar novamente';
        return;
      }
    }
    // Publicação continua delegada à função existente; NÃO alterar seu backend.
    await assertOk(db.rpc('bora_publish_event',{_event:uid}));
    state.eventDraftPendingId=null;state.eventDraftCoverUploaded=false;state.prepareEventCover=null;
    closeModal();await loadEvents();toast('Seu rolê foi publicado! 🎉');
  } catch(err){toast(`Não foi possível publicar: ${friendlyError(err)}`);}
  finally{button.disabled=false;}
}

function hydrateProfile() {
  const profile = state.profile;
  if (!profile) return;
  $('profile-display').textContent = profile.display_name;
  $('profile-handle').textContent = `@${profile.username}`;
  $('profile-bio').textContent = profile.bio || 'Ainda não escreveu sua descrição.';
  $('user-city-label').innerHTML = `<i data-lucide="map-pin"></i> ${html(profile.city || 'Brasil')}`;
  const miniAvatar=document.querySelector('.avatar-btn');
  if (miniAvatar) {
    miniAvatar.replaceChildren();
    const fallback=document.createElement('span');
    fallback.className='bpr-avatar-fallback';fallback.textContent=profile.display_name.slice(0,1).toUpperCase();
    miniAvatar.append(fallback);
  }
  $('edit-name').value = profile.display_name;
  $('edit-handle').value = profile.username;
  $('edit-city').value = profile.city || '';
  $('edit-bio').value = profile.bio || '';
  $('edit-insta').value = profile.instagram || '';
  focusHomeMap();
  loadBprProfileStyle().catch(()=>{});
  $('edit-birth').disabled = true;
  $('edit-birth').title = 'A data declarada só pode ser corrigida pelo suporte.';
  db.from('private_profile_data').select('date_of_birth').eq('user_id',state.user.id).maybeSingle()
    .then(({data}) => { if (data?.date_of_birth) $('edit-birth').value = data.date_of_birth; });
  const profileBadge = document.querySelector('#screen-perfil .profile-panel .panel h3 .badge');
  if (profileBadge) profileBadge.textContent = 'Conectado';
  const profileSave = document.querySelector('[data-action="save-profile"]');
  if (profileSave) profileSave.textContent = 'Salvar meu perfil';
  const privacyLabels = document.querySelectorAll('#bpr-account-panel .switch-line strong');
  if (privacyLabels[3]) privacyLabels[3].textContent = 'Permitir busca pelo meu @user';
  const switches = document.querySelectorAll('#bpr-account-panel .switch-line input');
  if (switches[0]) switches[0].checked = profile.avatar_visibility === 'friends';
  if (switches[1]) switches[1].checked = profile.details_visibility === 'friends';
  if (switches[2]) switches[2].checked = Boolean(profile.show_age);
  if (switches[3]) switches[3].checked = Boolean(profile.allow_nickname_lookup);
  const avatar = document.querySelector('.profile-avatar');
  avatar.textContent = profile.display_name.slice(0,1).toUpperCase();
  if (profile.avatar_path) {
    db.storage.from('avatars').createSignedUrl(profile.avatar_path, 90).then(({data}) => {
      if (state.profile?.id !== profile.id || state.profile?.avatar_path !== profile.avatar_path || !data?.signedUrl) return;
      const url=safeHttps(data.signedUrl);
      if (!url) return;
      if (avatar) avatar.innerHTML = `<img src="${html(url)}" alt="Minha foto de perfil">`;
      if (miniAvatar) {
        const image=document.createElement('img');image.src=url;
        image.alt='';image.className='bpr-avatar-mini-photo';
        miniAvatar.replaceChildren(image);
      }
    });
  }
  // V5.4: edição da foto só aparece quando o usuário toca no avatar.
  const editPanel = document.querySelector('#bpr-edit-profile-panel');
  if (editPanel && !editPanel.id) editPanel.id = 'bpr-edit-profile-panel';
  if (editPanel && !editPanel.classList.contains('bpr-edit-profile-panel')) {
    editPanel.classList.add('bpr-edit-profile-panel');
    // O formulário permanece no DOM, recolhido pela gaveta nativa do painel.
  }
  if (!$('profile-account-options')) {
    const options = document.createElement('div');
    options.id = 'profile-account-options';
    options.innerHTML = `<div class="switch-line"><label for="birthday-consent"><strong>🎂 Avisar meu aniversário aos SQUADs</strong>
        <small>Somente dia e mês, se você autorizar.</small></label><input type="checkbox" id="birthday-consent"></div>
      <button class="btn btn-ghost hidden" id="moderation-entry" data-action="moderation">🛡️ Painel de moderação</button>`;
    document.querySelector('#bpr-account-panel').append(options);
  }
  if (!$('friend-form')) {
    const finder = document.createElement('section');
    finder.className = 'panel friend-discovery';
    finder.innerHTML = `<div class="friend-discovery-title"><div class="friend-discovery-icon">🔎</div><div>
      <span class="eyebrow">Encontre sua galera</span><h2>Gente nova, SQUAD novo. ✌️</h2>
      <p>Procure pessoas pelo @user ou SQUADs pelo nome. Perfis e grupos só aparecem conforme a privacidade escolhida.</p></div></div>
      <form id="friend-form" class="friend-finder"><input id="friend-nick" placeholder="@user ou nome do SQUAD" maxlength="65" aria-label="Buscar pessoas ou SQUADs"><button class="btn btn-pink" type="submit">🔎 Buscar</button></form>
      <div class="friend-results" id="friend-result" role="status" aria-live="polite">A pesquisa não revela fotos, conversas ou integrantes privados.</div>`;
    // Busca unificada aparece abaixo dos grupos do usuário, sem alterar RPCs.
    document.querySelector('#screen-squad .two-col').after(finder);
    const blocks = document.createElement('section');
    blocks.className = 'panel blocked-profile-box';
    blocks.id = 'bpr-blocking-profile';
    blocks.innerHTML = `<h3>🔒 Controle de bloqueios</h3><p class="small-muted">Você pode bloquear qualquer @user, mesmo que o perfil não apareça nas pesquisas.</p>
      <form id="nickname-block-form" class="friend-finder"><input id="block-nick" placeholder="@user a bloquear" maxlength="24" aria-label="Bloquear pelo @user"><button class="btn btn-ghost" type="submit">Bloquear</button></form>
      <button class="inline-button" data-action="manage-blocks">Ver e gerenciar meus bloqueios</button>`;
    document.querySelector('#bpr-hub-privacy .bpr-hub-drawer-body').append(blocks);
    const compact=$('bpr-squad-search-results');
    if(compact){
      finder.id='bpr-v6-squad-search-results-target';
      compact.replaceChildren(finder);
      finder.querySelector('.friend-discovery-title')?.classList.add('hidden');
      finder.querySelector('#friend-form')?.classList.add('bpr-v6-visually-hidden');
    }
    $('friend-form').addEventListener('submit', followNickname);
    $('nickname-block-form').addEventListener('submit', blockNicknameFromForm);
  }
  bprV6ProfileLayout();
  const targetAbout=$('bpr-v6-birthday-target');
  const birthdaySwitch=$('birthday-consent')?.closest('.switch-line');
  if(targetAbout && birthdaySwitch && !targetAbout.contains(birthdaySwitch))targetAbout.append(birthdaySwitch);
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


// V5.5 - painel único: a gaveta fechada mantém os valores não salvos no DOM.
// Somente uma subseção expandida, com teclado nativo e estado de foco preservado.
function initBprProfileHub(){
  const hub=document.getElementById('bpr-profile-hub');
  if(!hub||hub.dataset.initialized)return;
  hub.dataset.initialized='true';
  const drawers=[...hub.querySelectorAll('.bpr-hub-drawer')];
  drawers.forEach(drawer=>{
    drawer.addEventListener('toggle',()=>{
      if(!drawer.open)return;
      drawers.forEach(other=>{if(other!==drawer)other.open=false;});
    });
  });
}
initBprProfileHub();

// Personalização opcional, isolada das identificações sensíveis de acesso.
const bprProfileCategories=['festa','bar','balada','cinema','show','festival','cultura','ar-livre','rave','outros'];
const bprRelationshipLabels={single:'Solteiro(a)',dating:'Conhecendo alguém',relationship:'Em um relacionamento',complicated:'É complicado'};
const bprProfileThemes=['aurora','sunset','night','ocean','urban','festival','nature'];
let bprProfileStyle={cover_theme:'aurora',relationship_status:null,show_relationship:false,preferred_categories:[]};
let bprStyleLoadedUser=null;
function initBprStyleForm() {
  const form=$('bpr-style-form');if (!form || form.dataset.ready) return;
  form.dataset.ready='true';
  $('bpr-preferences-options').innerHTML=bprProfileCategories.map(slug => {
    return `<label class="bpr-preference-option"><input type="checkbox" name="preferred_categories" value="${html(slug)}"><span>${html(catLabel(slug))}</span></label>`;
  }).join('');
  form.addEventListener('change',event=>{
    if (event.target.name==='cover_theme') {
      applyBprCover(event.target.value);
    }
    if (event.target.name==='preferred_categories') {
      const checked=[...form.querySelectorAll('[name="preferred_categories"]:checked')];
      if(checked.length>5){event.target.checked=false; $('bpr-style-feedback').textContent='Escolha no máximo cinco tipos de rolê.';}
    }
    if(event.target.name==='relationship') $('bpr-show-relationship').disabled=!event.target.value;
  });
  form.addEventListener('submit',saveBprProfileStyle);
}
function applyBprCover(theme) {
  const cover=document.querySelector('#screen-perfil .profile-cover');
  if(cover) cover.dataset.vibe=bprProfileThemes.includes(theme)?theme:'aurora';
}
function renderBprProfileStyle(style=bprProfileStyle) {
  initBprStyleForm();
  const form=$('bpr-style-form');if(!form)return;
  const theme=bprProfileThemes.includes(style.cover_theme)?style.cover_theme:'aurora';
  const radio=form.querySelector(`[name="cover_theme"][value="${theme}"]`);
  if(radio)radio.checked=true;
  applyBprCover(theme);
  $('bpr-relationship').value=style.relationship_status||'';
  $('bpr-show-relationship').checked=Boolean(style.show_relationship);
  $('bpr-show-relationship').disabled=!style.relationship_status;
  form.querySelectorAll('[name="preferred_categories"]').forEach(el=>el.checked=(style.preferred_categories||[]).includes(el.value));
  const relationship=$('bpr-relationship-chip');
  const show=Boolean(style.relationship_status&&style.show_relationship&&bprRelationshipLabels[style.relationship_status]);
  relationship.classList.toggle('hidden',!show);
  if(show)relationship.textContent='💛 '+bprRelationshipLabels[style.relationship_status];
  const prefs=(style.preferred_categories||[]).filter(c=>bprProfileCategories.includes(c));
  $('bpr-preferences-chips').textContent=prefs.length?'Minha vibe: '+prefs.map(c=>catLabel(c)).join(' · '):'';
}
async function loadBprProfileStyle() {
  if(!state.user)return;
  const uid=state.user.id;bprStyleLoadedUser=uid;
  initBprStyleForm();
  const {data,error}=await db.from('bpr_profile_personalization').select('cover_theme,relationship_status,show_relationship,preferred_categories').eq('user_id',uid).maybeSingle();
  if(state.user?.id!==uid)return;
  if(error){
    $('bpr-style-feedback').textContent='Personalização aguardando ativação da migração no Supabase. O perfil antigo continua funcionando.';
    renderBprProfileStyle();return;
  }
  bprProfileStyle={cover_theme:'aurora',relationship_status:null,show_relationship:false,preferred_categories:[],...(data||{})};
  renderBprProfileStyle();
  $('bpr-style-feedback').textContent='As escolhas ficam vinculadas à sua conta. Seu relacionamento só aparece se você autorizar.';
}
async function saveBprProfileStyle(event) {
  event.preventDefault();if(!state.user)return;
  const form=event.currentTarget, submit=event.submitter;
  if(submit)submit.disabled=true;
  const pref=[...form.querySelectorAll('[name="preferred_categories"]:checked')].map(el=>el.value);
  if(pref.length>5){if(submit)submit.disabled=false;return toast('Escolha até 5 preferências.');}
  const rel=$('bpr-relationship').value||null;
  const theme=form.querySelector('[name="cover_theme"]:checked')?.value||'aurora';
  const payload={user_id:state.user.id,cover_theme:theme,relationship_status:rel,
    show_relationship:!!rel&&$('bpr-show-relationship').checked,preferred_categories:pref};
  try {
    const {data,error}=await db.from('bpr_profile_personalization').upsert(payload,{onConflict:'user_id'}).select('cover_theme,relationship_status,show_relationship,preferred_categories').single();
    if(error)throw error;
    bprProfileStyle=data;
    renderBprProfileStyle(data);
    $('bpr-style-feedback').textContent='Sua vibe foi salva no perfil.';
    toast('Sua vibe foi salva!');
  }catch(err){
    $('bpr-style-feedback').textContent='Não foi possível salvar. Confirme que a migração da personalização foi instalada.';
    toast('Personalização não salva. O restante do perfil não foi alterado.');
  }finally{if(submit)submit.disabled=false;}
}

async function saveProfile() {
  const display = $('edit-name').value.trim();
  const username = $('edit-handle').value.trim().replace(/^@/, '').toLowerCase();
  if (!display || !/^[a-z0-9_.]{3,24}$/.test(username)) return toast('Confira seu nome e @user.');
  const switches = document.querySelectorAll('#bpr-account-panel .switch-line input');
  const payload = {display_name: display, username, city: $('edit-city').value.trim() || null,
    bio: $('edit-bio').value.trim(), instagram: $('edit-insta').value.trim() || null};
  try {
    const profile = await assertOk(db.from('profiles').update(payload).eq('id', state.user.id).select('*').single());
    state.profile = profile;
    hydrateProfile();
    toast('Perfil atualizado.');
  } catch (err) { toast(friendlyError(err)); }
}

// V5.4: recorte quadrado feito pelo usuário; visualização sempre circular no perfil.
let bprAvatarCrop = null;
function releaseAvatarCrop() {
  bprAvatarCrop?.bitmap?.close?.();
  bprAvatarCrop = null;
}
async function getMyAvatarUrl() {
  const path=state.profile?.avatar_path;
  if(!path)return '';
  const {data,error}=await db.storage.from('avatars').createSignedUrl(path,90);
  if(error)throw error;
  return safeHttps(data?.signedUrl);
}
async function openAvatarOptions() {
  if(!state.user)return;
  releaseAvatarCrop();
  const hasPhoto=Boolean(state.profile?.avatar_path);
  showModal('Minha foto de perfil', `<div class="bpr-avatar-options">
    <p class="small-muted">Escolha como sua foto aparece. O corte final será redondo e não esticará a imagem.</p>
    <div class="bpr-avatar-choice-preview" id="bpr-avatar-choice-preview" aria-label="Prévia da foto atual">${html(state.profile?.display_name?.slice(0,1)?.toUpperCase()||'👤')}</div>
    <input type="file" id="bpr-avatar-file" accept="image/*" class="bpr-visually-hidden" aria-label="Escolher imagem para recortar">
    <button class="btn btn-pink" type="button" data-action="avatar-upload-start">📷 Escolher nova foto</button>
    <button class="btn btn-ghost" type="button" data-action="avatar-full" ${hasPhoto?'':'disabled'}>🔍 Ver foto ampliada</button>
    <button class="btn btn-ghost bpr-remove-avatar" type="button" data-action="avatar-remove" ${hasPhoto?'':'disabled'}>Remover foto</button>
  </div>`);
  const input=$('bpr-avatar-file');
  input.addEventListener('change', async ()=>{
    const file=input.files?.[0];if(!file)return;
    try{await openAvatarCrop(file);}catch(err){toast(friendlyError(err));}
  },{once:true});
  if(hasPhoto){
    try{
      const url=await getMyAvatarUrl();
      const target=$('bpr-avatar-choice-preview');
      if(url&&target)target.innerHTML=`<img src="${html(url)}" alt="Sua foto atual">`;
    }catch{ /* Mantém o fallback visível. */ }
  }
}
async function openAvatarCrop(file) {
  if(!file.type.startsWith('image/')||file.size>15*1024*1024)
    throw Error('Escolha uma imagem de até 15 MB em formato compatível.');
  const bitmap=await createImageBitmap(file);
  releaseAvatarCrop();
  const value={bitmap,zoom:1,offsetX:0,offsetY:0,pointerId:null,lastX:0,lastY:0};
  bprAvatarCrop=value;
  showModal('Ajustar minha foto',`<div class="bpr-crop-form">
    <p class="small-muted">Arraste para escolher o enquadramento dentro do círculo. Use o zoom para aproximar.</p>
    <div class="bpr-crop-stage" id="bpr-crop-stage" aria-label="Arraste a imagem para enquadrar">
      <canvas id="bpr-crop-canvas" width="360" height="360" aria-label="Prévia do corte"></canvas>
      <span class="bpr-crop-guide" aria-hidden="true"></span>
    </div>
    <label for="bpr-crop-zoom">Aproximar foto</label>
    <input type="range" id="bpr-crop-zoom" min="1" max="3" step="0.05" value="1" aria-label="Zoom da fotografia">
    <button class="btn btn-pink" type="button" data-action="avatar-crop-save">Salvar foto recortada</button>
    <button class="btn btn-ghost" type="button" data-action="avatar-crop-cancel">Cancelar</button>
  </div>`);
  const canvas=$('bpr-crop-canvas');const stage=$('bpr-crop-stage');
  function render(){
    if(bprAvatarCrop!==value)return;
    const ctx=canvas.getContext('2d');const size=360;
    const scale=Math.max(size/bitmap.width,size/bitmap.height)*value.zoom;
    const w=bitmap.width*scale,h=bitmap.height*scale;
    const maxX=Math.max(0,(w-size)/2), maxY=Math.max(0,(h-size)/2);
    value.offsetX=Math.max(-maxX,Math.min(maxX,value.offsetX));
    value.offsetY=Math.max(-maxY,Math.min(maxY,value.offsetY));
    ctx.clearRect(0,0,size,size);
    ctx.drawImage(bitmap,(size-w)/2+value.offsetX,(size-h)/2+value.offsetY,w,h);
  }
  stage.addEventListener('pointerdown',(e)=>{
    value.pointerId=e.pointerId;value.lastX=e.clientX;value.lastY=e.clientY;
    stage.setPointerCapture?.(e.pointerId);
  });
  stage.addEventListener('pointermove',(e)=>{
    if(value.pointerId!==e.pointerId)return;
    const k=360/Math.max(stage.getBoundingClientRect().width,1);
    value.offsetX+=(e.clientX-value.lastX)*k;
    value.offsetY+=(e.clientY-value.lastY)*k;
    value.lastX=e.clientX;value.lastY=e.clientY;render();
  });
  const stop=(e)=>{if(value.pointerId===e.pointerId)value.pointerId=null;};
  stage.addEventListener('pointerup',stop);stage.addEventListener('pointercancel',stop);
  $('bpr-crop-zoom').addEventListener('input',(e)=>{value.zoom=Number(e.target.value);render();});
  render();
}
async function saveAvatarCrop(button) {
  if(!bprAvatarCrop||!state.user)return;
  button.disabled=true;
  try {
    const canvas=$('bpr-crop-canvas');
    if(!canvas)throw Error('A prévia não está disponível. Escolha novamente sua foto.');
    let output=null;
    for(const size of [360,300,256]) {
      const dest=document.createElement('canvas');dest.width=dest.height=size;
      dest.getContext('2d').drawImage(canvas,0,0,size,size);
      for(const quality of [0.88,0.75,0.6]) {
        const blob=await new Promise(resolve=>dest.toBlob(resolve,'image/webp',quality));
        if(blob?.type==='image/webp'&&blob.size<=314572){output=blob;break;}
      }
      if(output)break;
    }
    if(!output)throw Error('Não foi possível preparar a imagem. Tente outra fotografia.');
    const path=`${state.user.id}/avatar.webp`;
    await assertOk(db.storage.from('avatars').upload(path,output,{upsert:true,contentType:'image/webp',cacheControl:'60'}));
    state.profile=await assertOk(db.from('profiles').update({avatar_path:path}).eq('id',state.user.id).select('*').single());
    releaseAvatarCrop();closeModal();hydrateProfile();toast('Foto atualizada com o enquadramento escolhido.');
  } catch(err) {toast(`Foto não salva: ${friendlyError(err)}`);}
  finally {button.disabled=false;}
}
async function viewMyAvatar() {
  if(!state.profile?.avatar_path)return toast('Você ainda não adicionou uma foto.');
  try {
    const url=await getMyAvatarUrl();
    if(!url)return toast('Não foi possível carregar a foto.');
    showModal('Minha foto',`<div class="bpr-avatar-full"><img src="${html(url)}" alt="Minha foto ampliada"></div>`);
  } catch(err){toast(friendlyError(err));}
}
async function removeMyAvatar() {
  if(!state.user||!state.profile?.avatar_path)return;
  if(!await appConfirm('Remover sua foto do perfil? O restante do seu perfil será mantido.',{title:'Remover foto',confirmLabel:'Remover foto',danger:true}))return;
  const oldPath=state.profile.avatar_path;
  try{
    state.profile=await assertOk(db.from('profiles').update({avatar_path:null}).eq('id',state.user.id).select('*').single());
    let cleanupFailed=false;
    const {error}=await db.storage.from('avatars').remove([oldPath]);
    if(error)cleanupFailed=true;
    releaseAvatarCrop();closeModal();hydrateProfile();
    toast(cleanupFailed?'Foto retirada do perfil. A remoção do arquivo no armazenamento precisa ser conferida.':'Foto removida do perfil.');
  }catch(err){toast(`Não foi possível remover a foto: ${friendlyError(err)}`);}
}

// Perfil de outras pessoas: informações retornam apenas por RPCs já existentes,
// com regras de privacidade, bloqueios e visibilidade validadas no backend.
async function viewUserProfile(userId,fromSquad='') {
  if(!userId||!state.user)return;
  if(userId===state.user.id){closeModal();return navigate('perfil');}
  try{
    const result=await assertOk(db.rpc('get_profile_card',{_target:userId}));
    const profile=Array.isArray(result)?result[0]:result;
    if(!profile?.username)return showModal('Perfil', '<p class="small-muted">Este perfil não está disponível para visualização com suas permissões atuais.</p>');
    const [image,style]=await Promise.all([
      profile.avatar_path?db.storage.from('avatars').createSignedUrl(profile.avatar_path,90):Promise.resolve({data:null}),
      db.rpc('bpr_profile_personalization_public',{p_user_id:userId})
    ]);
    const src=safeHttps(image?.data?.signedUrl);
    const theme=bprProfileThemes.includes(style?.data?.cover_theme)?style.data.cover_theme:'aurora';
    const rel=style?.data?.relationship_status;
    const relationship=rel&&bprRelationshipLabels[rel]?`<span class="bpr-relationship-chip">💛 ${html(bprRelationshipLabels[rel])}</span>`:'';
    showModal('Perfil de @'+profile.username,`<article class="bpr-guest-profile">
      <div class="bpr-guest-cover" data-vibe="${theme}"></div>
      <div class="bpr-guest-body">
        <div class="bpr-guest-avatar">${src?`<img src="${html(src)}" alt="Foto de @${html(profile.username)}">`:html((profile.display_name||profile.username).slice(0,1).toUpperCase())}</div>
        <h3>${html(profile.display_name||profile.username)}</h3><p class="small-muted">@${html(profile.username)}</p>
        ${profile.bio?`<p class="bpr-guest-bio">${html(profile.bio)}</p>`:'<p class="small-muted">Este perfil não compartilhou uma bio.</p>'}
        ${profile.city?`<p class="small-muted">📍 ${html(profile.city)}</p>`:''}
        ${relationship}<p class="small-muted">As informações exibidas respeitam a privacidade escolhida pela pessoa.</p>
        <div class="bpr-v6-guest-actions"><button type="button" class="btn btn-pink" data-action="follow-found-user" data-id="${html(userId)}" data-nick="${html(profile.username)}">Seguir</button><button type="button" class="btn btn-ghost" data-action="block-found-user" data-nick="${html(profile.username)}">Bloquear</button></div>
        ${fromSquad?`<button class="btn btn-ghost" type="button" data-action="squad-roster" data-id="${html(fromSquad)}">Voltar aos integrantes</button>`:''}
      </div></article>`);
    void bprV6CheckFollowing(userId);
  }catch(err){toast('Não foi possível abrir este perfil. '+friendlyError(err));}
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
      ${person.bio?`<p>${html(person.bio)}</p>`:''}${person.city?`<p>📍 ${html(person.city)}</p>`:''}${person.instagram?`<p>Instagram: ${html(person.instagram)}</p>`:''}<div class="bpr-person-style-view" aria-live="polite"></div></div>
      <div class="discovery-actions"><button class="btn btn-ghost btn-small" data-action="view-user-profile" data-id="${html(person.user_id)}">Ver perfil</button><button class="btn btn-pink btn-small" data-action="follow-found-user" data-id="${html(person.user_id)}" data-nick="${html(person.username)}">Seguir</button>
      <button class="btn btn-ghost btn-small" data-action="block-found-user" data-nick="${html(person.username)}">Bloquear</button></div></article>`:
      '<p class="small-muted">Nenhuma pessoa encontrada com esse @user ou ela não permite buscas.</p>';
    const squadCards = groups?.length ? groups.map(squad=>`<article class="discovery-card squad-result"><div class="discovery-avatar">🫶</div>
      <div class="grow"><strong>${html(squad.name)}</strong><p>${html(squad.description || 'Uma galera com planos em comum.')}</p>
      <span class="small-muted">${Number(squad.member_count)||0} integrante(s) · Entrada com autorização de admin</span></div>
      <button class="btn btn-pink btn-small" data-action="request-squad-join" data-id="${html(squad.squad_id)}">Pedir entrada</button></article>`).join(''):
      '<p class="small-muted">Nenhum SQUAD aberto a pedidos com esse nome.</p>';
    target.innerHTML = `<section class="discovery-group"><h3>👥 Pessoas</h3>${personCard}</section>
      <section class="discovery-group"><h3>🫶 SQUADs</h3>${squadCards}</section>`;
    // Complementos públicos são solicitados apenas para alguém já encontrado
    // pela busca que respeita as regras de visibilidade do perfil.
    if(person?.user_id) {
      void bprV6CheckFollowing(person.user_id);
      const resultBox=target.querySelector('.bpr-person-style-view');
      const personId=person.user_id;
      db.rpc('bpr_profile_personalization_public',{p_user_id:personId}).then(({data,error})=>{
        if(error||!resultBox?.isConnected||!data)return;
        if(data.relationship_status && bprRelationshipLabels[data.relationship_status]) {
          const badge=document.createElement('span');badge.className='bpr-relationship-chip';
          badge.textContent='💛 '+bprRelationshipLabels[data.relationship_status];
          resultBox.append(badge);
        }
        const theme=bprProfileThemes.includes(data.cover_theme)?data.cover_theme:'aurora';
        if(theme!=='aurora')resultBox.dataset.vibe=theme;
      }).catch(()=>{});
    }
  } catch (err) { target.textContent = `Não foi possível pesquisar: ${friendlyError(err)}`; }
}

function bprV6RefreshFollowButton(userId,following){
  document.querySelectorAll('[data-action="follow-found-user"], [data-action="unfollow-found-user"]').forEach(btn=>{
    if(btn.dataset.id!==userId)return;
    btn.dataset.action=following?'unfollow-found-user':'follow-found-user';
    btn.textContent=following?'✓ Seguindo':'Seguir';
    btn.setAttribute('aria-pressed',String(following));
    btn.classList.toggle('bpr-v6-following',following);
  });
}
async function bprV6UnfollowFoundUser(userId,nickname){
  if(!state.user||!userId)return;
  try{await assertOk(db.from('follows').delete().eq('follower_id',state.user.id).eq('followed_id',userId));
    bprV6RefreshFollowButton(userId,false);toast(`Você deixou de seguir @${nickname}.`);
  }catch(err){toast(friendlyError(err));}
}
async function bprV6CheckFollowing(userId){
  if(!state.user?.id || !userId)return;
  try{const rows=await assertOk(db.from('follows').select('followed_id').eq('follower_id',state.user.id).eq('followed_id',userId).limit(1));
    bprV6RefreshFollowButton(userId,Boolean(rows?.length));
  }catch(err){ /* erro de rede não deve produzir um falso estado Seguindo */ }
}
async function bprV6SquadSearch(){
  const query=$('friend-query-v6')?.value.trim() || '';
  if(query.length<3)return toast('Digite pelo menos três caracteres.');
  const original=$('friend-nick');
  if(!original){toast('A busca ainda está carregando. Tente novamente.');return;}
  original.value=query;
  await followNickname({preventDefault(){}});
  document.querySelector('#bpr-v6-squad-search-results-target')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});
}
$('friend-query-v6')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void bprV6SquadSearch();}});

async function followFoundUser(userId,nickname) {
  if (!userId || userId===state.user?.id) return;
  try {
    await assertOk(db.from('follows').insert({follower_id:state.user.id,followed_id:userId}));
    bprV6RefreshFollowButton(userId,true); toast(`Agora você segue @${nickname}. A amizade é recíproca quando a pessoa também seguir você.`);
  } catch(err) { toast(err.code==='23505'?'Você já segue esta pessoa.':friendlyError(err)); }
}

async function blockFoundNickname(nickname) {
  if (!await appConfirm(`Bloquear @${nickname}? Vocês deixarão de se seguir e de se encontrar nas buscas.`,{title:'Bloquear usuário',confirmLabel:'Bloquear',danger:true})) return;
  try {
    await assertOk(db.rpc('bora_block_nickname',{_nickname:nickname}));
    $('friend-result').textContent = 'Bloqueio registrado. Você pode pesquisar outra pessoa ou SQUAD.';
    toast('Bloqueio registrado.');
  } catch(err) { toast(friendlyError(err)); }
}

async function blockNicknameFromForm(event) {
  event.preventDefault();
  const nick=$('block-nick').value.trim().replace(/^@/,'').toLowerCase();
  if (!/^[a-z0-9_.]{3,24}$/.test(nick)) return toast('Informe um @user válido.');
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
  if (!await appConfirm(`Desbloquear @${nickname}?`,{title:'Desbloquear usuário'})) return;
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


// V6: uma gaveta contextual: dados privados, relacionamento e aniversário.
function bprV6ProfileLayout(){
  const edit=document.querySelector('#bpr-hub-edit .bpr-hub-drawer-body');
  const style=$('bpr-style-form');
  const rel=$('bpr-relationship')?.closest('.field');
  const vis=$('bpr-show-relationship')?.closest('label');
  if(!edit || !style || !rel || !vis || $('bpr-v6-about'))return;
  const section=document.createElement('section');section.id='bpr-v6-about';section.className='bpr-v6-about';
  section.innerHTML='<h3>🔐 Identificações privadas</h3><p class="small-muted">Dados de gênero e identificação LGBTQIA+ não são exibidos no perfil e só são utilizados para rolês direcionados com sua autorização.</p><button type="button" class="btn btn-ghost" data-action="audience-preferences">Editar identificações privadas</button><h3>💛 O que posso mostrar</h3>';
  edit.prepend(section);
  section.append(rel,vis);
  // Esses elementos continuam salvos pelo formulário original, apesar da nova localização.
  section.querySelectorAll('input,select').forEach(el=>el.setAttribute('form','bpr-style-form'));
  $('bpr-relationship')?.addEventListener('change',ev=>{ $('bpr-show-relationship').disabled=!ev.target.value; if(!ev.target.value)$('bpr-show-relationship').checked=false; });
  const birthday=document.createElement('div');birthday.className='bpr-v6-birthday-target';birthday.id='bpr-v6-birthday-target';
  section.append(birthday);
  const privacyButton=document.querySelector('#bpr-account-panel [data-action="audience-preferences"]');privacyButton?.remove();
  document.querySelector('#bpr-hub-edit .bpr-hub-copy small').textContent='Bio, identificações, relacionamento e aniversário';
  document.querySelector('#bpr-hub-vibe .bpr-hub-copy small').textContent='7 capas e tipos de rolê favoritos';
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
    ${state.squads.length ? `<div class="bpr-v6-squad-grid">${state.squads.map((squad) => `<button type="button" class="bpr-v6-squad-tile" data-action="open-squad" data-id="${html(squad.id)}"><span class="bpr-v6-squad-symbol" aria-hidden="true">🫶</span><strong>${html(squad.name)}</strong><small>${html(squad.description || 'Comunidade de amigos')}</small><span class="bpr-v6-squad-open">Abrir grupo ↗</span></button>`).join('')}</div>` : '<p class="small-muted">Ainda não participa de SQUAD. Você já pode criar um, sem precisar ir a um rolê antes.</p>'}</div>
    <details class="panel bpr-squad-guide"><summary>O que é um SQUAD? <span>Ver orientações</span></summary><p class="small-muted">Uma galera organizada com chat, enquetes, álbum compartilhado no Google Drive, mural, convites por @user e até 3 administradores.</p>
      <div class="list-row"><div class="icon-disc">🔐</div><div class="grow"><strong>Entrada protegida</strong><p>Convites individuais precisam ser aceitos. Quem encontra o SQUAD pela busca solicita entrada e espera aprovação de um admin.</p></div></div>
      <div class="list-row"><div class="icon-disc">🛡️</div><div class="grow"><strong>Decisão em conjunto</strong><p>Excluir alguém do grupo exige concordância de 2 administradores, mesmo quando há 3.</p></div></div>
      <div class="list-row"><div class="icon-disc">🎂</div><div class="grow"><strong>Aniversários opcionais</strong><p>Quem permite, compartilha apenas dia e mês.</p></div></div></details>`;
  // Os controles e o calendário agora vivem dentro da sala do Squad.
  // Remover cartão legado com gestão duplicada em 'Meus Squads'.
  document.getElementById('squad-live-extras')?.remove();
  renderSquadGames();
  icons();
}

// Jogos leves e locais: não gravam respostas, rodadas ou pontuação no Supabase.
// A central só controla se os jogos ficam visíveis. Não é jogo sincronizado em tempo real.

// Carrossel V5.2: alternância automática, com pausa explícita e sem trocas durante interação.
let bprFeatureIndex=0;
let bprFeaturePaused=false;
let bprFeatureHoldUntil=Date.now()+11000;
let bprFeaturePointerOver=false;
let bprFeatureTouchX=null;
const bprFeatureReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const bprFeatureDelay=10500;
function bprFeatureAvailable() {
  return [...document.querySelectorAll('.bpr-feature-slide')].filter(x=>x.dataset.available==='true');
}
function refreshBprFeatures() {
  const slides=[...document.querySelectorAll('.bpr-feature-slide')];
  if(!slides.length)return;
  const config=bprControl.settings||{};
  // Aviso de manutenção agendada já aparece na faixa fixa: não duplicar no carrossel.
  const msg=config.mode==='scheduled'?'':String(config.announcement||'').trim();
  const card=config.community_card;
  $('bpr-feature-message-text').textContent=msg;
  $('bpr-feature-message').dataset.kind=config.notice_kind||'info';
  $('bpr-feature-card-title').textContent=card?.title||'';
  $('bpr-feature-card-body').textContent=card?.body||'';
  const cardLink=$('bpr-feature-card-link');
  const safeCardUrl=safeHttps(card?.url);
  if(safeCardUrl){cardLink.href=safeCardUrl;cardLink.textContent=card.button||'Saiba mais ↗';cardLink.hidden=false;}
  else {cardLink.hidden=true;cardLink.removeAttribute('href');}
  const visible=slides.filter(slide=>{
    const idx=Number(slide.dataset.slide);
    const enabled=idx===0||(idx===1&&config.banner_enabled!==false)||idx===2||(idx===3&&!!bprSpotifyId)||(idx===4&&msg.length>0)||(idx===5&&!!card?.active)||(idx===6&&!!config.squad_games_enabled);
    slide.dataset.available=String(enabled);
    return enabled;
  });
  if(!visible.length)return;
  bprFeatureIndex=Math.min(bprFeatureIndex,visible.length-1);
  slides.forEach(slide=>{slide.hidden=true;});
  visible[bprFeatureIndex].hidden=false;
  $('bpr-feature-indicator').innerHTML=`<span aria-hidden="true">${visible.map((_,i)=>`<i class="bpr-feature-dot ${i===bprFeatureIndex?'is-active':''}"></i>`).join('')}</span><span class="bpr-sr">Próximo destaque, ${bprFeatureIndex+1} de ${visible.length}</span>`;
  const control=$('bpr-feature-toggle');
  if(control) {
    const paused=bprFeaturePaused||bprFeatureReducedMotion.matches;
    control.textContent=paused?'▶':'Ⅱ';control.title=paused?'Retomar':'Pausar';
    control.setAttribute('aria-pressed',String(paused));
    control.setAttribute('aria-label',paused?'Retomar a passagem automática dos destaques':'Pausar a passagem automática dos destaques');
  }
}
function bprFeatureStep(delta) {
  const slides=bprFeatureAvailable();
  if(slides.length<2)return;
  bprFeatureIndex=(bprFeatureIndex+delta+slides.length)%slides.length;
  bprFeatureHoldUntil=Date.now()+bprFeatureDelay;
  refreshBprFeatures();
}
function bprFeatureHold(duration=20000) {
  bprFeatureHoldUntil=Date.now()+duration;
}
const bprFeatureContainer=$('bpr-feature-toggle')?.closest('.bpr-feature-carousel');
if (bprFeatureContainer) {
  bprFeatureContainer.addEventListener('mouseenter',()=>{bprFeaturePointerOver=true;});
  bprFeatureContainer.addEventListener('mouseleave',()=>{bprFeaturePointerOver=false;bprFeatureHold();});
  bprFeatureContainer.addEventListener('focusin',()=>bprFeatureHold());
  bprFeatureContainer.addEventListener('focusout',()=>bprFeatureHold());
  bprFeatureContainer.addEventListener('touchstart',event=>{
    bprFeatureTouchX=event.touches[0]?.clientX??null;
    bprFeatureHold(22000);
  },{passive:true});
  bprFeatureContainer.addEventListener('touchend',event=>{
    const endX=event.changedTouches[0]?.clientX;
    if(bprFeatureTouchX!==null&&typeof endX==='number') {
      const shift=endX-bprFeatureTouchX;
      if(Math.abs(shift)>65) bprFeatureStep(shift<0?1:-1);
    }
    bprFeatureTouchX=null;
    bprFeatureHold(14000);
  },{passive:true});
  bprFeatureContainer.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();bprFeatureStep(event.key==='ArrowRight'?1:-1);
    }
  });
  bprFeatureContainer.addEventListener('click',event=>{
    if(event.target.closest('a,button')) bprFeatureHold(30000);
  });
}
$('bpr-feature-indicator')?.addEventListener('click',()=>{bprFeatureStep(1);bprFeatureHold(14000);});
$('bpr-feature-toggle')?.addEventListener('click',()=>{
  bprFeaturePaused=!bprFeaturePaused;
  if(!bprFeaturePaused) bprFeatureHold(1500);
  refreshBprFeatures();
});
$('bpr-feature-spotify-preview')?.addEventListener('click',()=>{
  if(!bprSpotifyId)return;
  const shell=$('bpr-feature-spotify-player');
  const open=shell.hidden;
  if(open){
    shell.innerHTML=spotifyEmbed(`https://open.spotify.com/playlist/${bprSpotifyId}`);
    shell.hidden=false;
    // O visitante decide se carrega o iframe do Spotify (privacidade).
    bprFeaturePaused=true;
  }else{
    shell.replaceChildren();shell.hidden=true;
  }
  $('bpr-feature-spotify-preview').textContent=open?'Fechar prévia':'▶ Ouvir prévia aqui';
  refreshBprFeatures();
});
window.setInterval(()=>{
  if(bprFeaturePaused||bprFeatureReducedMotion.matches||document.hidden||
     !state.opened||activeScreen()!=='explorar'||
     bprFeaturePointerOver||
     bprFeatureContainer?.contains(document.activeElement)||
     Date.now()<bprFeatureHoldUntil||bprFeatureAvailable().length<2)return;
  bprFeatureStep(1);
},1000);
bprFeatureReducedMotion.addEventListener?.('change',refreshBprFeatures);

// V5.1 — baralhos e rodadas são executados somente no navegador (games.js).
// A única chave de ativação é a flag global da Central. Não existem controles por Squad.
function renderSquadGames() {
  // Remove os cartões legados fora da sala do Squad; jogos ficam na aba da sala
  // ou na Central de Jogos independente, sem exigir participação em Squad.
  document.getElementById('bpr-squad-games')?.remove();
}
window.BPRGamesAllowed = () => Boolean(
  state.user && state.opened &&
  bprControl.settings?.squad_games_enabled &&
  bprControl.settings?.mode !== 'maintenance'
);
function bprGamesTiles() {
  return window.BPRGames?.tiles() || '';
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
      // Não use insert().select(): a leitura via RLS depende da inclusão do dono
      // pelo trigger AFTER INSERT, que ainda não existe no RETURNING do INSERT.
      const squadId = crypto.randomUUID();
      await assertOk(db.from('squads').insert({
        id: squadId,
        creator_id: state.user.id,
        origin_event_id: eventId,
        name,
        description,
        is_discoverable: $('squad-new-discoverable').checked
      }));
      state.activeSquad = squadId;
      await loadSquads();
      closeModal();
      navigate('squad');
      toast('Seu SQUAD está pronto! Convide a galera por @user. 💜');
    } catch (err) {
      const permissionError = err?.code === '42501' || /row.level security|permission denied/i.test(String(err?.message || ''));
      errorBox.textContent = permissionError
        ? 'O banco recusou a criação (permissão 42501). Confira se seu cadastro está liberado e tente novamente.'
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
  if (!['owner','moderator'].includes(state.squadRoles.get(squadId))) return;
  const fromRoom=state.activeRoom?.type==='squad' && state.activeRoom.id===squadId;
  if(fromRoom)leaveRoom();
  showModal('Álbum do SQUAD 📸',`<div class="album-setup-intro"><span aria-hidden="true">☁️</span><div><span class="eyebrow">Fotos fora do Supabase</span><h3>Uma pasta da galera, no Google Drive.</h3><p>O Bora Pro Rolê guarda somente o endereço da pasta. Todas as fotos são enviadas diretamente pelo Drive.</p></div></div>
    <section class="album-guide" aria-label="Passo a passo para criar uma pasta compartilhada">
      <h3>Como preparar o álbum</h3>
      <ol><li><strong>Abra o Google Drive.</strong> Entre na sua conta e toque em <b>Novo → Pasta</b>. Dê um nome, por exemplo, “Fotos — ${html(squad.name)}”.</li>
      <li><strong>Abra Compartilhar.</strong> Nas opções da pasta, escolha <b>Acesso geral: Restrito</b>. Não use “Qualquer pessoa com o link”.</li>
      <li><strong>Adicione os integrantes autorizados.</strong> Compartilhe com cada conta Google e dê permissão de <b>Editor</b> para permitir o envio de fotos.</li>
      <li><strong>Proteja as permissões.</strong> Nas configurações de compartilhamento, quando disponível, desative a opção que permite a editores mudar o acesso. Editores ainda podem alterar ou apagar arquivos.</li>
      <li><strong>Copie o link da pasta.</strong> Cole abaixo e salve. Quando alguém sair do SQUAD, retire também o acesso dessa pessoa no Drive.</li></ol>
      <a class="btn btn-ghost btn-small album-help-link" href="https://drive.google.com/drive/u/0/my-drive" target="_blank" rel="noopener noreferrer">☁️ Abrir meu Google Drive ↗</a>
    </section>
    <form id="album-link-form" class="create-form album-link-form" novalidate>
      <label for="album-link-input">Link da pasta no Drive <span class="optional-label">Pode configurar depois</span></label>
      <input id="album-link-input" name="album_url" type="url" inputmode="url" maxlength="650" placeholder="https://drive.google.com/drive/folders/..." value="${html(squad.album_url || '')}">
      <p class="small-muted">O link aparece somente para os integrantes logados no SQUAD. A privacidade das fotos é controlada no Google Drive.</p>
      <p class="album-link-error hidden" id="album-link-error" role="alert"></p>
      <div class="dialog-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">Agora não</button><button type="submit" class="btn btn-pink">Salvar álbum</button></div>
      ${squad.album_url?'<button type="button" class="inline-button album-remove-button" id="album-link-remove">Remover link do SQUAD</button>':''}
    </form>`);
  const form=$('album-link-form');
  async function persistAlbum(value) {
    const field=$('album-link-input');const errorBox=$('album-link-error');
    errorBox.classList.add('hidden');
    const next=value.trim();
    if(next) {
      if(!safeDriveFolder(next)) {
        errorBox.textContent='Cole o link HTTPS de uma pasta do Google Drive (drive.google.com/drive/folders/…).';
        errorBox.classList.remove('hidden');field.focus();return;
      }
    }
    const save=form.querySelector('button[type="submit"]');save.disabled=true;
    try {
      await assertOk(db.from('squads').update({album_url:next||null}).eq('id',squadId));
      await loadSquads();closeModal();
      toast(next?'Pasta vinculada! Lembre-se de autorizar cada integrante no Google Drive. 💜':'Link do álbum removido do SQUAD.');
      if(fromRoom){await openRoom('squad',squadId);await changeRoomTab('album');}
    } catch(err) {errorBox.textContent=friendlyError(err);errorBox.classList.remove('hidden');}
    finally {save.disabled=false;}
  }
  form.addEventListener('submit',async(ev)=>{ev.preventDefault();await persistAlbum(form.elements.album_url.value);});
  $('album-link-remove')?.addEventListener('click',async()=>{
    if(await appConfirm('O atalho será removido do app, mas a pasta continuará existindo no Google Drive.',{title:'Remover link do álbum',confirmLabel:'Remover link',danger:true})) await persistAlbum('');
  });
}

async function renameSquad(id) {
  const current = state.squads.find((row) => row.id === id);
  if (!current) return;
  const nextName = await appPrompt('Nome do SQUAD',current.name,{title:'Renomear SQUAD ✏️',message:'Escolha um nome que seus integrantes reconheçam.',minLength:3,maxLength:65,confirmLabel:'Salvar novo nome'});
  if (!nextName || nextName.trim().length < 3 || nextName.trim().length > 65) return;
  try {
    await assertOk(db.from('squads').update({name:nextName.trim()}).eq('id',id));
    await loadSquads();
    toast('Nome do SQUAD atualizado.');
  } catch(err) { toast(err.message); }
}

async function leaveSquad(id) {
  if (!await appConfirm('Você quer mesmo sair deste SQUAD?',{title:'Sair do SQUAD',confirmLabel:'Sim, sair',danger:true})) return;
  try {
    await assertOk(db.rpc('leave_squad',{_squad:id}));
    state.activeSquad = null;
    await loadSquads();
    toast('Você saiu do SQUAD.');
  } catch(err) { toast(err.message); }
}

async function requestSquadJoin(squadId) {
  if (!await appConfirm('Solicitar entrada neste SQUAD? Você só terá acesso após a aprovação de um administrador.',{title:'Pedir para entrar 💌',confirmLabel:'Enviar pedido'})) return;
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
  if(!await appConfirm(approve?'Aprovar esta pessoa no SQUAD? Ela poderá acessar chat, mural e o link do álbum externo.':'Recusar este pedido de entrada?',{title:approve?'Aprovar integrante':'Recusar solicitação',confirmLabel:approve?'Aprovar entrada':'Recusar pedido',danger:!approve}))return;
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
  if(!await appConfirm('A remoção só ocorrerá se um segundo administrador também aprovar.',{title:'Confirmar voto de remoção',confirmLabel:'Confirmar meu voto',danger:true}))return;
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
    // Cada integrante tem uma linha de dados e outra de ações: sem nomes em coluna vertical.
    const cards=(roster||[]).map(profile=>{
      const role=profile.role==='owner'?'Criador':profile.role==='moderator'?'Administrador':'Integrante';
      const actions=[];
      actions.push(`<button class="btn btn-ghost btn-small" data-action="view-user-profile" data-id="${html(profile.user_id)}" data-squad="${html(squadId)}">Ver perfil</button>`);
      if(owner&&profile.role!=='owner')actions.push(`<button class="btn btn-ghost btn-small" data-action="set-squad-admin" data-id="${html(profile.user_id)}" data-squad="${html(squadId)}" data-promote="${profile.role==='moderator'?'false':'true'}">${profile.role==='moderator'?'Retirar cargo':'Promover admin'}</button>`);
      if(manager&&profile.role==='member')actions.push(`<button class="btn btn-ghost btn-small" data-action="vote-squad-removal" data-id="${html(profile.user_id)}" data-squad="${html(squadId)}">Propor remoção</button>`);
      if(profile.user_id!==state.user.id)actions.push(`<button class="btn btn-ghost btn-small" data-action="block-found-user" data-nick="${html(profile.username)}">Bloquear</button>`);
      return `<article class="bpr-roster-card">
        <div class="bpr-roster-person"><span class="bpr-roster-icon" aria-hidden="true" data-member-avatar-id="${html(profile.user_id)}">${profile.role==='owner'?'⭐':profile.role==='moderator'?'🛡️':'👤'}</span>
          <div class="bpr-roster-identity"><strong>${html(profile.display_name||profile.username)}</strong><span>@${html(profile.username)}</span><small>${role}</small></div></div>
        <div class="bpr-roster-actions">${actions.join('')}</div></article>`;
    });
    showModal('Integrantes e administradores 🛡️',`<div class="bpr-roster-list"><p class="small-muted">O SQUAD pode ter 2 ou 3 administradores. ${admins<2?'⚠️ Promova pelo menos um integrante a admin antes de propor remoções.':'Para remover alguém, dois administradores devem aprovar.'}</p>
      ${cards.join('')||'<p class="small-muted">Nenhum integrante encontrado.</p>'}
      ${manager?`<button class="btn btn-pink btn-small" data-action="squad-invite-member" data-id="${html(squadId)}">➕ Convidar integrante</button><button class="btn btn-ghost btn-small" data-action="squad-removals" data-id="${html(squadId)}">Ver votos pendentes</button>`:''}
      <button class="btn btn-ghost" data-action="close-modal">Fechar</button></div>`);
    leaveRoom();
    // Fotografias somente pela RPC de visibilidade; não consulta profiles abertamente.
    for(const member of (roster||[])) {
      (async()=>{
        const result=await assertOk(db.rpc('get_profile_card',{_target:member.user_id}));
        const card=Array.isArray(result)?result[0]:result;
        if(!card?.avatar_path)return;
        const {data,error}=await db.storage.from('avatars').createSignedUrl(card.avatar_path,90);
        if(error)return;
        const src=safeHttps(data?.signedUrl);
        const target=document.querySelector(`.bpr-roster-icon[data-member-avatar-id="${member.user_id}"]`);
        if(!src||!target)return;
        const img=document.createElement('img');img.src=src;img.alt='';
        target.replaceChildren(img);
      })().catch(()=>{});
    }
  }catch(err){toast(friendlyError(err));}
}

function leaveRoom() {
  if (state.chatChannel && db) db.removeChannel(state.chatChannel);
  state.chatChannel = null;
  state.activeRoom = null;
  for (const url of state.photoUrls) URL.revokeObjectURL(url);
  state.photoUrls=[];
}

// Temas de Squad só persistem pelo Supabase após instalar SQL V6.
const bprSquadThemes={neon:'Neon urbano',ocean:'Oceano',sunset:'Pôr do sol'};
let bprSquadThemeCurrent='neon';
function bprV6PaintSquad(theme){
  bprSquadThemeCurrent=Object.hasOwn(bprSquadThemes,theme)?theme:'neon';
  document.querySelector('.bpr-v6-room-head')?.setAttribute('data-squad-theme',bprSquadThemeCurrent);
}
async function bprV6LoadSquadTheme(id){
  bprV6PaintSquad('neon');
  const {data,error}=await db.rpc('bpr_squad_get_theme',{p_squad:id});
  if(state.activeRoom?.id!==id)return;
  if(!error && data?.theme)bprV6PaintSquad(data.theme);
}
async function bprV6SaveSquadTheme(theme,button){
  const id=state.activeRoom?.id;
  if(state.activeRoom?.type!=='squad'||!['owner','moderator'].includes(state.squadRoles.get(id)))return toast('Apenas gestores do Squad podem alterar o tema.');
  if(!Object.hasOwn(bprSquadThemes,theme))return;
  const prev=bprSquadThemeCurrent;
  button.disabled=true;
  bprV6PaintSquad(theme);
  const {data,error}=await db.rpc('bpr_squad_set_theme',{p_squad:id,p_theme:theme});
  button.disabled=false;
  if(error){bprV6PaintSquad(prev);toast('O tema não foi salvo. Confira a migração SQL V6 e suas permissões.');return;}
  bprV6PaintSquad(data?.theme||theme);
  toast('Tema do Squad salvo para todos os integrantes.');
  document.querySelectorAll('.bpr-v6-theme-choice[data-squad-theme]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.squadTheme===bprSquadThemeCurrent)));
}
function bprV65ManagerMarkup(room){
  return `<details class="bpr-v65-management" id="bpr-v65-management"><summary>⚙️ Administração e configurações <span>Somente responsáveis</span></summary><div class="bpr-v65-management-inner"><h3>⚙️ Gestão do Squad</h3><p class="small-muted">Os comandos existentes continuam sujeitos às permissões do banco de dados.</p><div class="bpr-squad-settings-actions">
      <button class="btn btn-ghost" data-action="rename-squad" data-id="${html(room.id)}">Renomear Squad</button>
      <button class="btn btn-ghost" data-action="edit-album-link" data-id="${html(room.id)}">Configurar álbum</button>
      <button class="btn btn-ghost" data-action="squad-join-requests" data-id="${html(room.id)}">Pedidos de entrada</button>
      <button class="btn btn-ghost" data-action="squad-removals" data-id="${html(room.id)}">Votos de remoção</button>
      <button class="btn btn-ghost" data-action="squad-roster" data-id="${html(room.id)}">Integrantes e cargos</button>
      <button class="btn btn-ghost" data-action="add-calendar" data-id="${html(room.id)}">📅 Adicionar ao calendário</button></div>
      <div class="bpr-v6-theme-panel"><h4>🎨 Tema deste Squad</h4><p class="small-muted">Escolha uma capa visual para a sala. Somente responsáveis podem salvar; os integrantes apenas visualizam.</p><div class="bpr-v6-theme-grid">
      ${Object.entries(bprSquadThemes).map(([value,label])=>`<button type="button" class="bpr-v6-theme-choice" data-squad-theme="${value}" aria-pressed="${value===bprSquadThemeCurrent}"><span class="bpr-v6-theme-sample" data-squad-theme="${value}"></span><strong>${label}</strong></button>`).join('')}</div><small id="bpr-v6-theme-message">As escolhas precisam da migração SQL V6 para persistir.</small></div>
      ${state.squadRoles.get(room.id) === 'owner' ? `<label class="squad-discovery-switch bpr-room-visibility"><input type="checkbox" id="squad-discoverable" ${state.squads.find(s=>s.id===room.id)?.is_discoverable?'checked':''}> Permitir que encontrem este Squad na busca pelo nome (entrada sempre mediante aprovação)</label>` : ''}
      <button type="button" class="btn btn-ghost bpr-invite-from-management" data-action="squad-invite-member" data-id="${html(room.id)}">💌 Convidar integrante</button></div></details>`;
}
function bprV65BindManager(room){
  $('squad-discoverable')?.addEventListener('change',async(ev)=>{
      const checkbox=ev.target;
      try {
        await assertOk(db.rpc('bora_set_squad_discovery',{_squad:room.id,_enabled:checkbox.checked}));
        const item=state.squads.find(s=>s.id===room.id);
        if(item) item.is_discoverable=checkbox.checked;
        toast('Visibilidade da busca atualizada. A entrada continua exigindo aprovação.');
      } catch(err){checkbox.checked=!checkbox.checked;toast(friendlyError(err));}
    });
}

async function openRoom(type, id) {
  if (type === 'event' && !state.joined.has(id)) return toast('Confirme participação antes de entrar no chat.');
  if (type === 'squad' && !state.squadRoles.has(id)) return toast('Você não participa desse SQUAD.');
  leaveRoom();
  const title = type === 'event' ? state.events.find((row) => row.id === id)?.title : state.squads.find((row) => row.id === id)?.name;
  state.activeRoom = {type,id};
  if (type === 'squad') state.activeSquad = id;
  const isSquad=type==='squad';
  const isManager=isSquad&&['owner','moderator'].includes(state.squadRoles.get(id));
  const squadTools=isSquad ? `<div class="bpr-v65-room-head-tools">
    <details class="bpr-v65-room-faq"><summary aria-label="Ajuda sobre o Squad" title="Ajuda sobre o Squad">❔ <span>Ajuda</span></summary>
      <div class="bpr-v65-room-faq-panel"><strong>Como funciona?</strong><p>Somente integrantes participam dos chats e ferramentas do grupo. O mural guarda recados e calendário; apenas gestores veem comandos de gestão. Convites exigem aceitação.</p><p>Em caso de abuso, use Denunciar e escolha o conteúdo correto. Dados privados permanecem protegidos.</p></div></details>
    <button type="button" class="bpr-v65-report-link" data-action="report" data-kind="squad" data-id="${html(id)}" aria-label="Denunciar este Squad">⚑ <span>Denunciar</span></button>
  </div>` : '';
  showModal(`${title || 'Grupo'} 💬`, `<div class="room-topline bpr-v6-room-head bpr-v65-room-head"><span>🔒 Conversa e ferramentas exclusivas de integrantes.</span>${squadTools}</div>
    ${isSquad ? `<nav class="bpr-v65-room-navigation" aria-label="Áreas do Squad">
      <button class="active" type="button" data-room-tab="chat">💬 <span>Conversa</span></button>
      <button type="button" data-room-tab="members">👥 <span>Integrantes</span></button>
      <button type="button" data-room-tab="album">📸 <span>Álbum</span></button>
      <button type="button" data-room-tab="polls">📊 <span>Enquetes</span></button>
      <button type="button" data-room-tab="games" ${bprControl.settings?.squad_games_enabled ? '' : 'hidden'}>🎲 <span>Jogos</span></button>
      <button type="button" data-room-tab="board">📌 <span>${isManager?'Mural e gestão':'Mural'}</span></button>
    </nav>` : `<div class="chat-tabs bpr-v6-room-tabs"><button class="active" data-room-tab="chat">Conversa</button><button data-room-tab="mural">Mural</button><button data-room-tab="polls">Enquetes 📊</button><button data-room-tab="music">Músicas 🎵</button></div>`}
    <div id="room-content" class="room-content"></div>`);
  $('dialog-body').className = 'dialog-content room-panel';
  if(type==='squad')void bprV6LoadSquadTheme(id);
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
  // A lista de integrantes abre diretamente, sem uma tela intermediária.
  if (tab === 'members' && room.type === 'squad') return showSquadRoster(room.id);
  if (room.type==='squad' && ['mural','settings','more'].includes(tab)) tab='board';
  document.querySelectorAll('.bpr-v6-room-tabs [data-room-tab],.bpr-v65-room-navigation [data-room-tab]').forEach(button=>{const active=button.dataset.roomTab===tab;button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false');});
  const target = $('room-content');
  target.innerHTML = '<div class="room-loading">Carregando…</div>';
  if (tab === 'chat') {
    target.innerHTML = `<p class="legal-note">⏳ As mensagens comuns são temporárias: limpeza automática depois de aproximadamente sete dias. ${room.type === 'event' ? 'O envio de novas mensagens neste grupo encerra até dois dias após o fim do evento; depois, continuem a conversa num SQUAD. ' : ''}Informações importantes devem ir para o mural, que não é apagado com o chat.</p>
      <div class="chat-messages" id="chat-messages"></div>
      <form class="chat-form" id="chat-form"><input id="chat-text" maxlength="800" placeholder="Converse com respeito (até 800 caracteres)…" aria-label="Mensagem" required><button class="btn btn-pink" aria-label="Enviar mensagem"><i data-lucide="send"></i></button></form>`;
    $('chat-form').addEventListener('submit', sendMessage);
    await refreshRoomChat();
  } else if (tab === 'mural' || (tab==='board'&&room.type==='squad')) {
    target.innerHTML = `<p class="small-muted">Informações e links importantes ficam aqui, mesmo depois da limpeza do chat.</p><div id="mural-items"></div>
      <form id="pin-form" class="pin-form"><input name="title" maxlength="90" required placeholder="Título do aviso"><textarea name="body" maxlength="900" placeholder="Descrição ou combinado"></textarea>
      <input name="link_url" type="url" placeholder="Link https:// (opcional)"><button class="btn btn-ghost" type="submit">📌 Fixar informação</button></form>
      ${room.type === 'squad' ? `<section class="bpr-room-calendar" aria-label="Calendário do Squad"><div class="calendar-head"><h3>🗓️ Calendário e aniversários</h3><input id="squad-month" type="month" aria-label="Mês do calendário"></div><p class="small-muted">Eventos do grupo e aniversários compartilhados com autorização.</p><div id="squad-calendar" role="status"></div></section>` : ''}`;
    $('pin-form').addEventListener('submit', addPin);
    await refreshRoomPins();
    if(room.type === 'squad' && $('squad-month')) {
      const d = new Date();
      $('squad-month').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      $('squad-month').addEventListener('change',()=>renderSquadCalendar(room.id));
      await renderSquadCalendar(room.id);
    }
    if(room.type==='squad' && ['owner','moderator'].includes(state.squadRoles.get(room.id))){
      target.insertAdjacentHTML('beforeend',bprV65ManagerMarkup(room));
      bprV65BindManager(room);
    }
  } else if (tab === 'polls') {
    target.innerHTML = `<p class="small-muted">📊 Faça uma pergunta com 2 a 6 alternativas. Só integrantes votam; a identidade dos votantes não aparece.</p>
      <button class="btn btn-ghost btn-small" data-action="create-poll">+ Criar enquete</button><div id="poll-list"></div>`;
    await refreshPolls();
  } else if (tab === 'games' && room.type === 'squad') {
    if(!bprControl.settings?.squad_games_enabled) {
      target.innerHTML='<p class="small-muted">Os jogos estão desativados pela administração da plataforma.</p>';
    } else {
      target.innerHTML=`<h3>Jogos da galera 🎲</h3><p class="small-muted">Cartas para brincar juntos no chat ou pessoalmente, sem registrar respostas ou placar.</p><div class="bpr-room-games">${bprGamesTiles()}</div>`;
    }
  } else if (tab === 'album' && room.type === 'squad') {
    const squad=state.squads.find(item=>item.id===room.id);
    const album=safeDriveFolder(squad?.album_url);
    const manager=['owner','moderator'].includes(state.squadRoles.get(room.id));
    target.innerHTML=`<div class="drive-album-card">
      <div class="drive-album-hero"><span aria-hidden="true">☁️</span><div><span class="eyebrow">Álbum compartilhado</span><h3>As lembranças da sua galera 📸</h3><p>As fotos ficam no Google Drive, sem ocupar espaço no Supabase.</p></div></div>
      ${album?`<a class="btn btn-pink drive-album-cta" href="${html(album)}" target="_blank" rel="noopener noreferrer">📸 Abrir álbum e enviar fotos ↗</a>
      <p class="small-muted">Ao abrir a pasta, toque em <strong>+ Novo → Upload de arquivo</strong> para adicionar uma foto. Se o Drive pedir permissão, solicite acesso ao administrador.</p>`:
      `<div class="drive-album-empty">🕒 A pasta ainda não foi configurada. Assim que um administrador cadastrar o link, todos os integrantes verão o botão para abrir o álbum.</div>`}
      ${manager?`<button class="btn btn-ghost" data-action="edit-album-link" data-id="${html(room.id)}">⚙️ ${album?'Gerenciar pasta e permissões':'Criar e vincular pasta no Drive'}</button>`:''}
      <p class="legal-note">🔐 <strong>Privacidade:</strong> o link é mostrado apenas aos integrantes deste SQUAD. No Google Drive, mantenha <b>Acesso geral: Restrito</b> e autorize cada pessoa individualmente. Não publique fotos de outras pessoas sem consentimento.</p>
    </div>`;
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
  } catch (err) { target.textContent = `Chat indisponível: ${friendlyError(err)}`; }
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
  } catch (err) { toast(friendlyError(err)); }
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

// Denúncias: alvos e relato na mesma tela, usando os sete códigos já aceitos por reports.
// A classificação específica é anexada ao campo details, sem modificar o contrato da RPC.
const BPR_REPORT_INCIDENTS = Object.freeze([
  { id:'importunacao', reason:'harassment', label:'Importunação, assédio ou constrangimento' },
  { id:'ameaca', reason:'harassment', label:'Ameaça ou intimidação' },
  { id:'agressao', reason:'harassment', label:'Agressão ou violência física' },
  { id:'perseguicao', reason:'harassment', label:'Perseguição insistente' },
  { id:'discriminacao', reason:'discrimination', label:'Discriminação, racismo ou LGBTfobia' },
  { id:'fotos', reason:'privacy', label:'Uso indevido de fotos ou vídeos' },
  { id:'intimidade', reason:'privacy', label:'Exposição de imagens íntimas sem autorização' },
  { id:'dados', reason:'privacy', label:'Exposição de dados pessoais ou privacidade' },
  { id:'golpe', reason:'fraud', label:'Golpe, fraude ou pedido suspeito de dinheiro' },
  { id:'perfil-falso', reason:'fraud', label:'Perfil falso ou tentativa de se passar por alguém' },
  { id:'menor', reason:'minor', label:'Suspeita de menor de idade' },
  { id:'ilegal', reason:'illegal', label:'Conteúdo ou atividade ilegal' },
  { id:'outro', reason:'other', label:'Outro problema' }
]);

function bprReportDetailsForm() {
  return `<div class="bpr-report-detail-fields">
    <label class="bpr-report-field">Classificação da ocorrência *
      <select name="incident" required aria-describedby="bpr-report-classification-help">
        <option value="" selected disabled>Escolha o que aconteceu</option>
        ${BPR_REPORT_INCIDENTS.map(item=>`<option value="${html(item.id)}">${html(item.label)}</option>`).join('')}
      </select>
    </label>
    <p id="bpr-report-classification-help" class="small-muted">Escolha o motivo principal. Você poderá explicar outros detalhes no relato.</p>
    <label class="bpr-report-field">Conte o que aconteceu *
      <textarea name="details" rows="5" minlength="12" maxlength="1850" required placeholder="Descreva o ocorrido, onde aconteceu e quando, se souber. Não inclua senhas ou documentos pessoais."></textarea>
    </label>
    <p class="small-muted bpr-report-privacy-note">🔒 Seu relato será enviado à equipe de moderação. Ao denunciar uma mensagem pelo chat, o registro será associado à mensagem específica. Em risco imediato, ligue 190.</p>
  </div>`;
}

async function bprSendReport(kind, target, form) {
  const data = new FormData(form);
  const choice = BPR_REPORT_INCIDENTS.find(item=>item.id===data.get('incident'));
  const detail = String(data.get('details')||'').trim();
  if (!choice) throw Error('Selecione uma classificação para a denúncia.');
  if (detail.length < 12) throw Error('Conte o que aconteceu com pelo menos 12 caracteres.');
  // Sem anexos ou acesso amplo aos chats; os snapshots são responsabilidade da RPC.
  const description = `Ocorrência informada: ${choice.label}\nRelato: ${detail}`;
  if (description.length > 2000) throw Error('Relato muito longo. Resuma a descrição.');
  await assertOk(db.rpc('submit_report', {
    _target_kind:kind,
    _target_id:String(target),
    _reason:choice.reason,
    _details:description
  }));
}

// Denúncia geral: o usuário escolhe alvo, classificação e relato sem uma tela intermediária.
// Denúncias de mensagens continuam na própria mensagem, por seu identificador único.
// Histórico do próprio denunciante, fornecido exclusivamente por RPC autenticada.
// Não consulta diretamente reports nem retorna evidências, detalhes internos ou dados de terceiros.
const bprReportStatusLabels = {pending:'Recebida',reviewing:'Em análise',resolved:'Concluída',dismissed:'Encerrada sem confirmação'};
const bprReportKindLabels = {user:'Pessoa',event:'Rolê',squad:'Squad',pin:'Mural',event_message:'Mensagem do rolê',squad_message:'Mensagem do Squad'};
async function openMyReports() {
  if (!state.user) return toast('Faça login para acompanhar suas denúncias.');
  let reports;
  try {
    reports = await assertOk(db.rpc('bpr_report_my_list'));
    if (!Array.isArray(reports)) throw Error('Resposta inesperada do servidor.');
  } catch(error) {
    showModal('Minhas denúncias 🛡️', `<p role="alert" class="small-muted">Não foi possível consultar o histórico agora. Confirme se a atualização do Supabase V6.2.2 foi instalada e tente novamente.</p><button type="button" class="btn btn-ghost" data-action="report-my">Tentar novamente</button>`);
    return;
  }
  const cards = reports.map(r=>{
    const items = Array.isArray(r.updates) ? r.updates : [];
    const history = items.map(u=>`<div class="bpr-report-timeline-item"><strong>${html(u.kind==='reply'?'Resposta da equipe':'Situação atualizada')} · ${html(bprReportStatusLabels[u.status]||u.status)}</strong><small>${html(shortDate(u.created_at))}</small>${u.kind==='reply'&&u.message?`<p>${html(u.message)}</p>`:''}</div>`).join('');
    return `<article class="mod-card bpr-report-tracking-card"><div class="bpr-report-tracking-head"><strong>Protocolo ${html(r.protocol||String(r.id||'').slice(0,8).toUpperCase())}</strong><span class="badge green">${html(bprReportStatusLabels[r.status]||r.status)}</span></div><p class="small-muted">${html(bprReportKindLabels[r.target_kind]||r.target_kind)} · ${html(shortDate(r.created_at))}</p><details><summary>Ver relato e acompanhamento</summary><div class="bpr-report-timeline"><div class="bpr-report-timeline-item"><strong>Denúncia recebida</strong><small>${html(shortDate(r.created_at))}</small><p>${html(r.details||'Relato enviado para análise.')}</p></div>${history}</div></details></article>`;
  }).join('');
  showModal('Minhas denúncias 🛡️', `<p class="small-muted">Acompanhe os protocolos e respostas da moderação. O andamento é consultado ao abrir esta tela; não há notificação push.</p><div class="bpr-report-history-actions"><button class="btn btn-ghost btn-small" type="button" data-action="report-my">Atualizar histórico</button><button class="btn btn-pink btn-small" type="button" data-action="report-center">Nova denúncia</button></div><div class="bpr-report-tracking-list">${cards||'<p class="small-muted">Você ainda não enviou denúncias.</p>'}</div><p class="small-muted">A equipe não divulga dados privados de outras pessoas nem detalhes de investigações internas.</p>`);
}

async function openSafetyReportCenter() {
  if (!state.user) return toast('Entre em sua conta para enviar uma denúncia.');
  const published = state.events.filter(e=>e.status==='published').slice(0,100);
  const squads = state.squads.slice(0,80);
  showModal('Registrar denúncia 🛡️', `<p class="small-muted">Conte o que aconteceu. O relato será encaminhado à moderação sem tornar conversas privadas públicas.</p>
    <form id="bpr-safety-report-picker" class="privacy-form bpr-report-form">
      <label class="bpr-report-field">O que deseja denunciar? *
        <select name="kind" id="bpr-safety-report-kind" required>
          <option value="event">Um rolê</option>
          <option value="squad">Um Squad</option>
          <option value="user">Uma pessoa por @user</option>
        </select>
      </label>
      <label class="bpr-report-field" id="bpr-safety-report-event-wrap">Escolha o rolê *
        <select name="eventId" id="bpr-safety-report-event" aria-label="Rolê denunciado">
          ${published.length ? published.map(e=>`<option value="${html(e.id)}">${html(e.title)} · ${html(e.city||'')}</option>`).join('') : '<option value="">Nenhum rolê disponível nesta sessão</option>'}
        </select>
      </label>
      <label class="bpr-report-field" id="bpr-safety-report-squad-wrap" hidden>Escolha o Squad *
        <select name="squadId" id="bpr-safety-report-squad" aria-label="Squad denunciado">
          ${squads.length ? squads.map(s=>`<option value="${html(s.id)}">${html(s.name)}</option>`).join('') : '<option value="">Nenhum Squad disponível nesta sessão</option>'}
        </select>
      </label>
      <label class="bpr-report-field" id="bpr-safety-report-user-wrap" hidden>@user da pessoa *
        <input type="text" name="nickname" id="bpr-safety-report-user" maxlength="24" placeholder="Ex.: seuuser" autocomplete="off">
      </label>
      ${bprReportDetailsForm()}
      <p class="small-muted">Para denunciar uma mensagem de um Squad ou rolê, abra o chat e use <strong>Denunciar</strong> na mensagem. Assim a denúncia identifica o conteúdo exato.</p>
      <button type="submit" class="btn btn-pink bpr-report-send">Enviar denúncia</button>
    </form>`);
  const form = $('bpr-safety-report-picker');
  const kindField = $('bpr-safety-report-kind');
  const renderKind = () => {
    const kind = kindField.value;
    $('bpr-safety-report-event-wrap').hidden = kind !== 'event';
    $('bpr-safety-report-squad-wrap').hidden = kind !== 'squad';
    $('bpr-safety-report-user-wrap').hidden = kind !== 'user';
  };
  kindField.addEventListener('change', renderKind);
  renderKind();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.submitter || form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      const kind = kindField.value;
      let target = '';
      if (kind === 'event') target = $('bpr-safety-report-event').value;
      else if (kind === 'squad') target = $('bpr-safety-report-squad').value;
      else {
        const nickname = $('bpr-safety-report-user').value.trim().replace(/^@/,'').toLowerCase();
        if (!/^[a-z0-9_.]{3,24}$/.test(nickname)) throw Error('Informe um @user válido, com 3 a 24 caracteres.');
        const people = await assertOk(db.rpc('bora_lookup_profile',{_nickname:nickname}));
        target = people?.[0]?.user_id || '';
      }
      if (!target) throw Error('Não encontramos esse conteúdo. Confirme o rolê, Squad ou @user antes de denunciar.');
      await bprSendReport(kind,target,form);
      closeModal();
      toast('Denúncia enviada. Consulte o protocolo em Minhas denúncias.');
      await openMyReports();
    } catch (err) {
      toast(friendlyError(err));
    } finally { submit.disabled = false; }
  });
}

function openReport(kind, target) {
  leaveRoom();
  showModal('Denunciar à moderação 🛡️', `<p class="small-muted">Descreva a ocorrência associada ao conteúdo selecionado. O registro ficará restrito à moderação.</p>
    <form id="report-form" class="bpr-report-form">
      ${bprReportDetailsForm()}
      <button type="submit" class="btn btn-pink bpr-report-send">Enviar denúncia</button>
    </form>`);
  const form = $('report-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter || form.querySelector('[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    try {
      await bprSendReport(kind,target,form);
      closeModal();
      toast('Denúncia enviada. Consulte o protocolo em Minhas denúncias.');
      await openMyReports();
    } catch (err) { toast(friendlyError(err)); }
    finally { button.disabled = false; }
  });
}

// V6.3: notificações por usuário; nada é marcado automaticamente só por abrir o painel.
let bprNotifPoll = null;
async function refreshNotificationBadge() {
  const badge=$('bpr-notif-count');
  const bell=document.querySelector('[data-action="notifications"]');
  if(!badge || !bell)return;
  if(!state.user || !state.opened){badge.classList.add('hidden');bell.setAttribute('aria-label','Notificações');return;}
  try {
    const result=await db.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',state.user.id).is('read_at',null);
    if(result.error)throw result.error;
    const amount=Number(result.count||0);
    badge.textContent=amount>99?'99+':String(amount);
    badge.classList.toggle('hidden',amount===0);
    bell.setAttribute('aria-label',amount?`Notificações: ${amount} não lidas`:'Notificações: nenhuma não lida');
  }catch(err){console.warn('Aviso de notificações indisponível:',err?.code||'');}
}
function bprStartNotificationRefresh(){
  if(bprNotifPoll)return;
  bprNotifPoll=setInterval(()=>{if(!document.hidden&&state.opened)void refreshNotificationBadge();},45000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.opened)void refreshNotificationBadge();});
}
function bprNotifKind(item){
  const payload=item.payload&&typeof item.payload==='object'?item.payload:{};
  const source=String(payload.source||'');
  const msg=String(item.message||'').toLowerCase();
  if(source==='follow'||msg.includes('seguir')||msg.includes('segu')||msg.includes('amigos'))return '💚';
  if(source.includes('squad')||msg.includes('squad')||msg.includes('convite')||msg.includes('entrada'))return '👥';
  return '🔔';
}
async function openNotifications(){
  if(!state.user)return;
  try {
    const rows=await assertOk(db.from('notifications').select('id,kind,message,created_at,read_at,payload').eq('user_id',state.user.id)
      .order('created_at',{ascending:false}).limit(60));
    const controls=`<div class="bpr-notif-top"><p class="small-muted">Escolha quais notificações deseja ler ou apagar. Abrir esta tela não marca tudo como lido.</p><button type="button" class="btn btn-ghost btn-small" data-action="notif-read-all">✓ Marcar todas como lidas</button></div>`;
    const content=(rows||[]).map(item=>`<article class="bpr-notif-item ${item.read_at?'is-read':'is-unread'}">
      <span class="bpr-notif-icon" aria-hidden="true">${bprNotifKind(item)}</span><div class="bpr-notif-content"><strong>${html(item.message)}</strong><small>${html(displayDate(item.created_at))}</small><div class="bpr-notif-actions">
      ${item.read_at?'':`<button type="button" class="btn btn-ghost btn-small" data-action="notif-read" data-id="${html(String(item.id))}">✓ Marcar lida</button>`}
      <button type="button" class="btn btn-ghost btn-small" data-action="notif-delete" data-id="${html(String(item.id))}">🗑 Apagar</button></div></div></article>`).join('');
    showModal('Suas notificações 🔔',controls+(content||'<p class="small-muted">Você está em dia! Nenhuma notificação por enquanto.</p>'));
    void refreshNotificationBadge();
  }catch(err){toast(friendlyError(err));}
}
async function bprNotificationAction(action,id){
  if(!state.user)return;
  try{
    if(action==='notif-read-all'){
      await assertOk(db.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',state.user.id).is('read_at',null));
    }else if(action==='notif-read'){
      await assertOk(db.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',state.user.id).eq('id',id).is('read_at',null));
    }else if(action==='notif-delete'){
      if(!await appConfirm('Apagar esta notificação?',{title:'Apagar notificação',confirmLabel:'Apagar',danger:true}))return;
      await assertOk(db.from('notifications').delete().eq('user_id',state.user.id).eq('id',id));
    }
    await refreshNotificationBadge();await openNotifications();
  }catch(err){toast(friendlyError(err));}
}

async function deletePin(id) {
  if (!await appConfirm('Remover esta informação fixada?',{title:'Remover do mural',confirmLabel:'Remover',danger:true})) return;
  try { await assertOk(db.from('room_pins').delete().eq('id',id)); await refreshRoomPins(); }
  catch (err) { toast(err.message); }
}

async function removeSong(id) {
  if (!await appConfirm('Remover esta sugestão musical?',{title:'Remover sugestão',confirmLabel:'Remover',danger:true})) return;
  try { await assertOk(db.from('event_song_suggestions').delete().eq('id',id)); await refreshSongs(); }
  catch (err) { toast(err.message); }
}

async function blockUser(id) {
  if (!await appConfirm('Bloquear este usuário? Você deixará de ver as informações e mensagens que as regras permitem ocultar.',{title:'Bloquear usuário',confirmLabel:'Bloquear',danger:true})) return;
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

// Tour opcional: é exibido uma única vez por conta e reaberto pelo FAQ.
const bprTourSteps=[
  {title:'Bem-vindo ao Bora Pro Rolê ✌️',body:'Encontre eventos, conheça pessoas e explore a cidade. Você pode pular o tour a qualquer momento.'},
  {title:'Explore eventos pelo mapa ou lista',body:'Use Explorar para filtrar rolês, verificar data e local, salvar e confirmar presença com segurança.'},
  {title:'Seus encontros em um lugar só',body:'Meus rolês reúne participação, salvos e eventos publicados. As preferências ficam no Perfil.'},
  {title:'Crie um rolê com endereço confirmado',body:'Informe o endereço ou link compatível do Google Maps e confira a prévia antes de publicar.'},
  {title:'Squads e jogos da galera',body:'Meus Squads reúne conversas, informações e convites. A Central de Jogos aparece quando a administração habilita.'},
  {title:'Você no controle 🔐',body:'Toque na foto do cabeçalho para abrir o menu da conta. No Perfil, escolha sua capa, controle a privacidade e encontre o botão Sair.'}
];
let bprTourCurrent=0;
const bprTourKey=()=>state.user?`bpr_tour_v53_${state.user.id}`:null;
function finishBprTour(){
  try{const key=bprTourKey();if(key)localStorage.setItem(key,'done');}catch(_){}
  closeModal();
}
function bprTourRender(){
  const step=bprTourSteps[bprTourCurrent];
  showModal('Conheça o Bora Pro Rolê', `<div class="bpr-tour-step"><span class="eyebrow">Passo ${bprTourCurrent+1} de ${bprTourSteps.length}</span><h3>${html(step.title)}</h3><p>${html(step.body)}</p><div class="bpr-tour-progress" aria-label="Progresso do tour">${bprTourSteps.map((_,i)=>`<span class="${i===bprTourCurrent?'active':''}"></span>`).join('')}</div><div class="bpr-tour-actions"><button type="button" class="btn btn-ghost" id="bpr-tour-skip">Pular tour</button>${bprTourCurrent>0?'<button type="button" class="btn btn-ghost" id="bpr-tour-back">Anterior</button>':''}<button type="button" class="btn btn-pink" id="bpr-tour-next">${bprTourCurrent===bprTourSteps.length-1?'Concluir':'Próximo'}</button></div></div>`);
  $('bpr-tour-skip').onclick=finishBprTour;
  if($('bpr-tour-back'))$('bpr-tour-back').onclick=()=>{bprTourCurrent--;bprTourRender();};
  $('bpr-tour-next').onclick=()=>{if(bprTourCurrent===bprTourSteps.length-1)finishBprTour();else{bprTourCurrent++;bprTourRender();}};
}
function startBprTour(force=false){
  if(!state.opened||!state.user)return;
  const key=bprTourKey();
  try{if(!force&&localStorage.getItem(key)==='done')return;}catch(_){}
  if(!$('modal').classList.contains('hidden'))return;
  bprTourCurrent=0;bprTourRender();
}

// Atendimento próprio: dúvidas/erros/sugestões ficam separados de denúncias e LGPD.
// Só envia para RPCs autorizadas: nenhuma escrita direta em tabelas administrativas.
let bprPendingHelpKey = null;
const bprReplyKeys = new Map();
const bprHelpLabels = {question:'Dúvida',bug:'Problema técnico',suggestion:'Sugestão',appeal:'Recurso ou revisão'};
const bprHelpStatuses = {open:'Aberto',in_progress:'Em atendimento',answered:'Respondido',closed:'Encerrado'};
async function openBprHelp() {
  if (!state.user) return toast('Entre na sua conta para usar o atendimento.');
  let rows=[], issue='';
  try {
    rows = await assertOk(db.rpc('bpr_help_my_list'));
    if (!Array.isArray(rows)) rows=[];
  } catch (error) {
    issue = 'O atendimento interno está indisponível neste momento. Tente novamente mais tarde. Para denunciar um conteúdo, use o botão Denunciar no aplicativo.';
  }
  showModal('Ajuda e atendimento 💬', `<p class="small-muted">Fale com a equipe e acompanhe as respostas aqui. Não inclua senhas, documentos ou informações íntimas.</p>
    <button type="button" class="btn btn-ghost bpr-report-history-btn" data-action="report-my">🛡️ Minhas denúncias e respostas</button>
    <button type="button" id="bpr-tour-restart" class="btn btn-ghost">▶ Rever tour do aplicativo</button>
    <details class="bpr-faq"><summary>Como usar o Bora Pro Rolê? · Guia rápido</summary><ol>
      <li>Em <strong>Explorar</strong>, busque rolês e consulte os detalhes no mapa ou na lista.</li>
      <li>Em <strong>Meus rolês</strong>, acompanhe o que salvou ou confirmou.</li>
      <li>Em <strong>Criar</strong>, publique um evento e revise o endereço.</li>
      <li>Em <strong>Squads</strong>, converse com os grupos dos quais participa.</li>
      <li>Em <strong>Perfil</strong>, altere suas informações, privacidade e senha.</li>
    </ol><p>Para denunciar pessoas ou publicações, use <strong>Denunciar</strong>. Para direitos sobre seus dados, use <strong>Solicitações LGPD</strong>.</p></details>
    ${issue ? `<p class="bpr-help-warning" role="alert">${html(issue)}</p>` : `<form id="bpr-help-form" class="privacy-form">
      <label>Tipo de solicitação<select name="category" required>${Object.entries(bprHelpLabels).map(([key,value])=>`<option value="${html(key)}">${html(value)}</option>`).join('')}</select></label>
      <label>Assunto<input name="subject" minlength="5" maxlength="110" required placeholder="Ex.: Não consigo acessar meu squad"></label>
      <label>Explique a situação<textarea name="details" minlength="5" maxlength="2000" rows="4" required placeholder="Conte o que aconteceu e o que esperava. Não envie dados sensíveis."></textarea></label>
      <button type="submit" class="btn btn-pink">Enviar solicitação</button></form>`}
    <h3>Minhas solicitações</h3><div class="bpr-help-history">${!issue ? (rows.length ? rows.map(row=>`
      <article class="mod-card"><strong>${html(row.subject)}</strong><small>${html(bprHelpLabels[row.category]||row.category)} · ${html(bprHelpStatuses[row.status]||row.status)} · ${html(shortDate(row.updated_at))}</small>
      <div class="bpr-help-thread">${(row.messages||[]).map(msg=>`<div class="bpr-help-message ${msg.kind==='team'?'team':''}"><strong>${msg.kind==='team'?'Equipe':'Você'}</strong><p>${html(msg.content)}</p><small>${html(shortDate(msg.created_at))}</small></div>`).join('')}</div>
      ${row.status!=='closed'?`<form class="bpr-help-reply" data-ticket="${html(row.id)}"><label>Responder neste atendimento<textarea name="message" maxlength="2000" minlength="5" required rows="2" placeholder="Escreva sua mensagem"></textarea></label><button class="btn btn-ghost btn-small" type="submit">Enviar resposta</button></form>`:''}</article>`).join(''):'<p class="small-muted">Nenhuma solicitação registrada até agora.</p>') : ''}</div>
    <p class="small-muted">As respostas da equipe ficam neste painel. Para denúncias, use o botão Denunciar; para emergências, procure os órgãos públicos competentes.</p>`);
  $('bpr-tour-restart')?.addEventListener('click',()=>{closeModal();setTimeout(()=>startBprTour(true),50);});
  const form=$('bpr-help-form');
  if(form) form.addEventListener('input',()=>{bprPendingHelpKey=null;});
  if(form) form.addEventListener('submit', async event=>{
    event.preventDefault(); const submit=event.submitter;submit.disabled=true;
    const data=new FormData(form);
    if(!bprPendingHelpKey) bprPendingHelpKey=crypto.randomUUID();
    try {await assertOk(db.rpc('bpr_help_submit',{p_category:String(data.get('category')),p_subject:String(data.get('subject')).trim(),p_message:String(data.get('details')).trim(),p_request_key:bprPendingHelpKey}));
      bprPendingHelpKey=null;toast('Solicitação recebida. Acompanhe as respostas aqui.');await openBprHelp();
    }catch(error){toast('Não foi possível registrar: '+friendlyError(error));submit.disabled=false;}
  });
  document.querySelectorAll('.bpr-help-reply').forEach(form=>{form.addEventListener('input',()=>bprReplyKeys.delete(form.dataset.ticket));form.addEventListener('submit',async event=>{
    event.preventDefault();const submit=event.submitter;submit.disabled=true;const id=form.dataset.ticket;
    if(!bprReplyKeys.has(id))bprReplyKeys.set(id,crypto.randomUUID());
    try {await assertOk(db.rpc('bpr_help_user_reply',{p_ticket:id,p_message:form.elements.message.value.trim(),p_request_key:bprReplyKeys.get(id)}));
      bprReplyKeys.delete(id);toast('Sua mensagem foi enviada.');await openBprHelp();
    }catch(error){toast('Não foi possível enviar: '+friendlyError(error));submit.disabled=false;}
  });});
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
  const reason = await appPrompt('Motivo da decisão','',{title:'Decisão da moderação 🛡️',message:'Descreva o motivo com objetividade. A decisão ficará registrada para auditoria.',minLength:8,confirmLabel:'Registrar decisão'});
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
      case 'report-center': return await openSafetyReportCenter();
      case 'report-my': return await openMyReports();
      case 'profile-toggle-edit': {
        const hub=$('bpr-profile-hub'), drawer=$('bpr-hub-edit');
        if(!hub||!drawer)return;
        hub.open=true;drawer.open=true;
        drawer.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
        $('edit-name')?.focus({preventScroll:true});
        return;
      }
      case 'save-profile': return await saveProfile();
      case 'avatar-options': return await openAvatarOptions();
      case 'avatar-upload-start': return $('bpr-avatar-file')?.click();
      case 'avatar-full': return await viewMyAvatar();
      case 'avatar-remove': return await removeMyAvatar();
      case 'avatar-crop-save': return await saveAvatarCrop(element);
      case 'avatar-crop-cancel': releaseAvatarCrop();return openAvatarOptions();
      case 'view-user-profile': return await viewUserProfile(id,element.dataset.squad||'');
      case 'follow-found-user': return await followFoundUser(id,element.dataset.nick);
      case 'unfollow-found-user': return await bprV6UnfollowFoundUser(id,element.dataset.nick);
      case 'squad-search-v6': return await bprV6SquadSearch();
      case 'block-found-user': return await blockFoundNickname(element.dataset.nick);
      case 'manage-blocks': return await manageBlockedNicknames();
      case 'unblock-found-user': return await unblockFoundNickname(element.dataset.nick);
      case 'notifications': return await openNotifications();
      case 'squad-invite-member': return bprInviteMemberFromRoster(id);
      case 'notif-read': case 'notif-delete': case 'notif-read-all': return await bprNotificationAction(action,id);
      case 'account': return await openAccount();
      case 'delete-account-start': return openDeleteAccount();
      case 'audience-preferences': return await openAudiencePreferences();
      case 'revoke-audience': {
        if(!await appConfirm('Apagar suas identificações opcionais? Você deixará de confirmar presença em rolês de público direcionado.',{title:'Apagar identificação',confirmLabel:'Apagar dados',danger:true}))return;
        await assertOk(db.rpc('set_audience_preferences',{_gender:null,_lgbtq:null,_consent:false}));
        closeModal();return toast('Identificações privadas apagadas.');
      }
      case 'bpr-help': return await openBprHelp();
      case 'privacy-requests': return await openPrivacyRequests();
      case 'moderation': return await openModeration();
      case 'mod-event': case 'mod-report': case 'mod-remove': case 'mod-suspend': case 'mod-privacy': case 'mod-cancel':
        return await performModeration(action, element);
      case 'logout': {
        const profileEditor = document.querySelector('#bpr-edit-profile-panel');
        const unsavedProfile = Boolean(profileEditor && state.profile && (
          $('edit-name')?.value.trim() !== (state.profile.display_name || '') ||
          $('edit-handle')?.value.trim() !== (state.profile.username || '') ||
          $('edit-city')?.value.trim() !== (state.profile.city || '') ||
          $('edit-bio')?.value.trim() !== (state.profile.bio || '') ||
          $('edit-insta')?.value.trim() !== (state.profile.instagram || '')
        ));
        const question = unsavedProfile ?
          'Você tem alterações não salvas no perfil. Sair agora descarta essas alterações. Deseja continuar?' :
          'Deseja encerrar sua sessão neste dispositivo?';
        if (!await appConfirm(question, {title:'Sair da conta',confirmLabel:'Sim, sair',danger:true})) return;
        $('bpr-account-menu')?.removeAttribute('open');
        return await authAction('logout');
      }
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
        if(!await appConfirm(element.dataset.promote==='true'?'Promover este integrante a administrador do SQUAD?':'Remover o cargo de administrador?',{title:'Alterar administração',confirmLabel:'Confirmar alteração'}))return;
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
  const accountMenu = $('bpr-account-menu');
  if (accountMenu?.open && !accountMenu.contains(event.target)) accountMenu.removeAttribute('open');
  if (event.target.closest('#bpr-account-menu [data-nav], #bpr-account-menu [data-action]')) {
    accountMenu?.removeAttribute('open');
  }
  const authButton = event.target.closest('[data-auth]');
  if (authButton) { event.preventDefault(); return authAction(authButton.dataset.auth); }

  const save = event.target.closest('[data-save]');
  if (save) { event.preventDefault(); event.stopPropagation(); return saveEvent(save.dataset.save); }
  const squadThemeButton=event.target.closest('.bpr-v6-theme-choice');
  if(squadThemeButton){event.preventDefault();return void bprV6SaveSquadTheme(squadThemeButton.dataset.squadTheme,squadThemeButton);}
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) { event.preventDefault(); return handleAction(actionButton.dataset.action, actionButton); }
  const myTab = event.target.closest('[data-my-tab]');
  if (myTab) {
    event.preventDefault();
    const selected = myTab.dataset.myTab;
    document.querySelectorAll('[data-my-tab]').forEach(button => {
      const active = button.dataset.myTab === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-my-panel]').forEach(panel => {
      panel.hidden = panel.dataset.myPanel !== selected;
    });
    return;
  }
  const nav = event.target.closest('[data-nav]');
  if (nav) return navigate(nav.dataset.nav);
  const screenLink = event.target.closest('[data-screen-link]');
  if (screenLink) { event.preventDefault(); return navigate(screenLink.dataset.screenLink); }
  const category = event.target.closest('[data-category]');
  if (category) { state.category = category.dataset.category; renderChips(); const label=categories.find(c=>c[0]===state.category)?.[2]||'Todas'; if($('bpr-category-current'))$('bpr-category-current').textContent=label; $('bpr-category-drawer')?.setAttribute('hidden',''); $('bpr-category-toggle')?.setAttribute('aria-expanded','false'); return renderEvents(); }
  const categoryToggle=event.target.closest('#bpr-category-toggle'); if(categoryToggle){const d=$('bpr-category-drawer');d.hidden=!d.hidden;categoryToggle.setAttribute('aria-expanded',String(!d.hidden));return;}
  const view = event.target.closest('[data-view]');
  if (view) return setView(view.dataset.view);
  const tab = event.target.closest('[data-room-tab]');
  if (tab) return changeRoomTab(tab.dataset.roomTab);
  const eventCard = event.target.closest('[data-event]');
  if (eventCard) return openDetails(eventCard.dataset.event);
  const season = event.target.closest('[data-season]');
  if (season) { state.category = season.dataset.season; renderChips(); renderEvents(); navigate('explorar'); }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && $('bpr-account-menu')?.open) {
    $('bpr-account-menu').removeAttribute('open');
    $('bpr-account-menu summary')?.focus();
  }
});

document.addEventListener('submit', (event) => {
  const key = ({'login-form':'login','signup-form':'signup','forgot-form':'forgot','resend-form':'resend',
    'reset-form':'reset','birth-form':'birth','birth-confirm-form':'confirm-birth','onboard-profile-form':'profile','legal-form':'legal'})[event.target.id];
  if (key) { event.preventDefault(); authAction(key, event.target); }
});

$('modal-close').addEventListener('click', closeAndLeaveRoom);
$('modal').addEventListener('click', (event) => { if (event.target === $('modal')) closeAndLeaveRoom(); });
$('decision-cancel').addEventListener('click',()=>finishAppDecision(null));
$('decision-form').addEventListener('submit',(event)=>{
  event.preventDefault();
  const decision=activeDecision;
  if (!decision) return;
  if (!decision.inputMode) return finishAppDecision(true);
  const value=$('decision-input').value.trim();
  if (value.length<decision.minLength || value.length>decision.maxLength) {
    $('decision-field-error').textContent=`Informe entre ${decision.minLength} e ${decision.maxLength} caracteres para continuar.`;
    $('decision-field-error').classList.remove('hidden');
    $('decision-input').focus();return;
  }
  finishAppDecision(value);
});
$('decision-overlay').addEventListener('click',(event)=>{
  if(event.target===$('decision-overlay'))finishAppDecision(null);
});
document.addEventListener('keydown', (event) => {
  if (event.key==='Escape' && activeDecision) {event.preventDefault();finishAppDecision(null);return;}
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
$('bpr-scheduled-strip')?.querySelector('[data-action="scheduled-info"]')?.addEventListener('click', () => {
  const s=bprControl.settings;
  showModal('Atualização do Bora Pro Rolê', `<p>${html(s?.announcement || s?.message || 'Estamos preparando novidades.')}</p><p class="small-muted">O aplicativo continua disponível normalmente neste aviso. Nenhuma manutenção bloqueante foi ativada.</p>`);
});
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
  let recoveringPassword = recoveryReturn;
  let confirmingEmail = emailConfirmationReturn && !recoveryReturn;
  db.auth.onAuthStateChange((event) => {
    if (confirmingEmail) return; // Não abrir automaticamente a área social durante a confirmação.
    if (event === 'PASSWORD_RECOVERY') { recoveringPassword = true; return showGate('reset'); }
    if (recoveringPassword) {
      if (event === 'SIGNED_OUT') { recoveringPassword=false; return; }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') return;
      return; // Redefinição termina exclusivamente em Login, nunca abre o feed.
    }
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
  } else if (recoveringPassword) {
    // A URL de recuperação nunca leva direto para o conteúdo social.
    db.auth.getSession().then(({data,error}) => {
      if (error || authReturnError || !data?.session) {
        recoveringPassword=false; history.replaceState(history.state,'',currentRedirect());
        showGate('login'); feedback('O link de recuperação expirou ou não é válido. Solicite um novo link.');
      } else showGate('reset');
    }).catch(() => {recoveringPassword=false;showGate('forgot');feedback('Não foi possível validar o link. Solicite outro.');});
  } else {
    syncSession().catch((err) => { showGate('blocked'); feedback(err.message); });
  }
  // Mantém a manutenção e os avisos sincronizados sem reload (até ~45 segundos).
  setInterval(() => refreshBprPublicSettings(true).catch(() => {}), 45000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshBprPublicSettings(true).catch(() => {});
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
  // Atualização explícita do worker: evita manter uma instalação antiga do PWA.
  navigator.serviceWorker.register('./service-worker.js?v=20261120-squad-invite-v64', {updateViaCache:'none'}).catch(() => {});
}

function bprInviteMemberFromRoster(squadId){
  if(!['owner','moderator'].includes(state.squadRoles.get(squadId)))return toast('Somente responsáveis podem convidar integrantes.');
  showModal('Convidar para o Squad 💌',`<div class="bpr-v64-invite">
    <p class="small-muted">Pesquise a pessoa, confira a foto e o @user e selecione quem deseja convidar. Ninguém entra automaticamente: o convite precisa ser aceito.</p>
    <form id="bpr-v64-invite-form" novalidate>
      <label for="bpr-v64-invite-query">Buscar pessoa pelo @user</label>
      <input id="bpr-v64-invite-query" type="search" placeholder="Comece a digitar o @user" minlength="3" maxlength="25" autocomplete="off" spellcheck="false" aria-controls="bpr-v64-invite-results" aria-describedby="bpr-v64-invite-help" required>
      <small id="bpr-v64-invite-help">A busca mostra apenas perfis que permitem ser encontrados.</small>
      <div class="bpr-v64-invite-results" id="bpr-v64-invite-results" role="region" aria-label="Resultados da busca" aria-live="polite"><p class="small-muted">Digite pelo menos 3 caracteres.</p></div>
      <div class="bpr-v64-invite-picked" id="bpr-v64-invite-picked" aria-live="polite"></div>
      <button type="submit" class="btn btn-pink bpr-v64-invite-send" id="bpr-v64-invite-send" disabled>Enviar convite</button>
      <p id="bpr-v64-invite-status" class="small-muted" role="status" aria-live="polite"></p>
    </form>
  </div>`);
  const form=$('bpr-v64-invite-form');
  const input=$('bpr-v64-invite-query');
  const results=$('bpr-v64-invite-results');
  const picked=$('bpr-v64-invite-picked');
  const send=$('bpr-v64-invite-send');
  const status=$('bpr-v64-invite-status');
  let chosen=null;
  let items=[];
  let sequence=0;
  let timer=null;
  let disabled=false;
  const validUser=(query)=>/^[a-z0-9_.]{3,24}$/.test(query);
  async function draw(query){
    const token=++sequence;
    chosen=null;send.disabled=true;picked.textContent='';
    if(!validUser(query)) {results.innerHTML='<p class="small-muted">Digite ao menos 3 caracteres do @user.</p>';return;}
    results.innerHTML='<p class="small-muted">Procurando pessoas…</p>';
    try {
      // A pesquisa parcial só é permitida pela RPC com escopo de administrador e privacidade.
      // Se a migração não existir, a busca exata anterior permanece disponível.
      let data;
      let limited=false;
      const {data:rows,error}=await db.rpc('bpr_squad_invite_candidates',{p_squad:squadId,p_query:query});
      if(error) {
        if(!['42883','PGRST202'].includes(error.code) && !/Could not find the function|does not exist/i.test(error.message||'')) throw error;
        limited=true;
        data=await assertOk(db.rpc('bora_lookup_profile',{_nickname:query}));
      } else data=rows;
      if(token!==sequence || !$('bpr-v64-invite-form'))return;
      items=(data||[]).filter(item=>item.user_id && item.user_id!==state.user?.id).slice(0,8);
      if(!items.length) {results.innerHTML=`<p class="small-muted">Nenhuma pessoa encontrada${limited?' com esse @user':''}. Confira o nome ou a privacidade da conta.</p>`;return;}
      const avatarUrls=await Promise.all(items.map(async(item)=>{
        if(!item.avatar_path)return '';
        const {data,error}=await db.storage.from('avatars').createSignedUrl(item.avatar_path,90);
        return error?'':safeHttps(data?.signedUrl)||'';
      }));
      if(token!==sequence || !$('bpr-v64-invite-form'))return;
      results.innerHTML=items.map((person,i)=>`<button type="button" class="bpr-v64-invite-option" data-bpr-invite-index="${i}" aria-pressed="false">
        <span class="bpr-v64-invite-avatar">${avatarUrls[i]?`<img src="${html(avatarUrls[i])}" alt="">`:'👤'}</span>
        <span class="bpr-v64-invite-identity"><strong>${html(person.display_name||person.username)}</strong><small>@${html(person.username)}</small></span>
        <span class="bpr-v64-invite-check" aria-hidden="true">Selecionar</span></button>`).join('');
      if(limited)status.textContent='Pesquisa exata disponível. Para sugestões por início do nome, execute o SQL de busca do patch.';
      else status.textContent='Escolha a pessoa correta antes de enviar.';
    }catch(err){
      if(token!==sequence)return;
      results.innerHTML='<p class="small-muted">Não foi possível pesquisar agora. Tente novamente.</p>';
      status.textContent=friendlyError(err);
    }
  }
  input.addEventListener('input',()=>{
    if(disabled)return;
    const query=input.value.trim().replace(/^@/,'').toLowerCase();
    clearTimeout(timer);
    sequence++;chosen=null;send.disabled=true;picked.textContent='';results.innerHTML='<p class="small-muted">Aguardando busca…</p>';
    if(!validUser(query)){results.innerHTML='<p class="small-muted">Digite pelo menos 3 caracteres.</p>';status.textContent='';return;}
    timer=setTimeout(()=>void draw(query),320);
  });
  results.addEventListener('click',event=>{
    const button=event.target.closest('[data-bpr-invite-index]');
    if(!button||disabled)return;
    chosen=items[Number(button.dataset.bprInviteIndex)];
    if(!chosen)return;
    results.querySelectorAll('.bpr-v64-invite-option').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
    picked.textContent=`Selecionado: ${chosen.display_name||chosen.username} (@${chosen.username})`;
    send.disabled=false;status.textContent='Confira a pessoa selecionada e envie o convite.';
  });
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();
    if(disabled||!chosen||!state.user?.id)return;
    disabled=true;send.disabled=true;input.disabled=true;
    status.textContent='Enviando convite…';
    try{
      // invited_by precisa ser o usuário autenticado; INSERT permanece sujeito ao RLS.
      await assertOk(db.from('squad_invitations').insert({squad_id:squadId,invitee_id:chosen.user_id,invited_by:state.user.id}));
      status.textContent=`Convite enviado a @${chosen.username}. Aguarde a aceitação da pessoa.`;
      picked.textContent=`✓ Convite enviado para ${chosen.display_name||chosen.username} (@${chosen.username})`;
      toast(`Convite enviado a @${chosen.username}.`);
    }catch(err){
      disabled=false;send.disabled=false;input.disabled=false;
      const hint=err.code==='23505'?'Já existe um convite para esta pessoa.':
        err.code==='42501'||/row.level security/i.test(err.message||'')?'O Supabase recusou o convite pela política do Squad. Confira a autorização do responsável e a política de INSERT.':friendlyError(err);
      status.textContent=hint;
    }
  });
  input.focus();
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
  if (!['owner','moderator'].includes(state.squadRoles.get(squadId))) {
    toast('Somente administradores e moderadores do Squad podem adicionar encontros.');
    return;
  }
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

// Iniciar carrossel com valores padrão, até a configuração remota ser consultada.
refreshBprFeatures();

// Opção B V6, montada sem modificar funções existentes de salvamento.
bprV6ProfileLayout();
