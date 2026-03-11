// ============================================================
// BROCOLI.FIT — Auth via Supabase
// Supporte : email/password · Google OAuth · Magic Link
// ============================================================

// Initialise le client Supabase (URL et clé anon dans config.js)
const _sb = (window.supabase && window.BROCOLI_CONFIG?.SUPABASE_URL)
  ? window.supabase.createClient(
      window.BROCOLI_CONFIG.SUPABASE_URL,
      window.BROCOLI_CONFIG.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        }
      }
    )
  : null;

if (!_sb) {
  console.warn('[Auth] Supabase non configuré — ajoutez SUPABASE_URL et SUPABASE_ANON_KEY dans config.js');
}

// ============================================================
const AUTH = {

  _user: null,

  // ── Init (appeler au chargement de chaque page) ───────────
  async init() {
    if (!_sb) return null;
    try {
      const { data: { session } } = await _sb.auth.getSession();
      this._user = session?.user || null;

      // Listener : réagit aux changements de session (login, logout, magic link)
      _sb.auth.onAuthStateChange((event, session) => {
        this._user = session?.user || null;
        if (event === 'SIGNED_IN') {
          // Après login, redirige selon le paramètre ?redirect= ou vers dashboard
          const redirectTo = new URLSearchParams(window.location.search).get('redirect');
          if (redirectTo) {
            window.location.href = decodeURIComponent(redirectTo);
          } else if (!window.location.pathname.includes('dashboard') &&
                     !window.location.pathname.includes('plan') &&
                     !window.location.pathname.includes('analyse')) {
            window.location.href = 'dashboard.html';
          }
        }
        if (event === 'SIGNED_OUT') {
          window.location.href = 'index.html';
        }
      });
    } catch (e) {
      console.error('[Auth] init error:', e);
    }
    return this._user;
  },

  getUser()   { return this._user; },
  isLoggedIn(){ return !!this._user; },
  getUserName(){
    const u = this._user;
    return u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email?.split('@')[0] || 'Utilisateur';
  },

  // ── Email + Mot de passe ──────────────────────────────────
  async register(email, password, name) {
    if (!_sb) throw new Error('Supabase non configuré');
    const { data, error } = await _sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });
    if (error) throw new Error(error.message);
    return data.user;
  },

  async login(email, password) {
    if (!_sb) throw new Error('Supabase non configuré');
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(this._translateError(error.message));
    this._user = data.user;
    return data.user;
  },

  // ── Magic Link (email sans mot de passe) ──────────────────
  async sendMagicLink(email) {
    if (!_sb) throw new Error('Supabase non configuré');
    const redirectTo = `${window.location.origin}/dashboard.html`;
    const { error } = await _sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    if (error) throw new Error(error.message);
  },

  // ── Google OAuth ──────────────────────────────────────────
  async loginWithGoogle() {
    if (!_sb) throw new Error('Supabase non configuré');
    const redirectTo = `${window.location.origin}/dashboard.html`;
    const { error } = await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
    if (error) throw new Error(error.message);
  },

  // ── Mot de passe oublié ───────────────────────────────────
  async resetPassword(email) {
    if (!_sb) throw new Error('Supabase non configuré');
    const { error } = await _sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login.html?mode=reset`
    });
    if (error) throw new Error(error.message);
  },

  // ── Déconnexion ───────────────────────────────────────────
  async logout() {
    await _sb?.auth.signOut();
    this._user = null;
    window.location.href = 'index.html';
  },

  // ── Traduction erreurs Supabase → langue de l'UI ──────────
  _translateError(msg) {
    const t = k => (window.I18N && window.I18N.t(k)) || null;
    const map = {
      'Invalid login credentials':        t('err.invalidCredentials') || 'Email ou mot de passe incorrect.',
      'Email not confirmed':               t('err.emailNotConfirmed')  || 'Confirmez votre email avant de vous connecter.',
      'User already registered':           t('err.alreadyRegistered')  || 'Un compte existe déjà avec cet email.',
      'Password should be at least 6':     t('err.passwordTooShort')   || 'Le mot de passe doit contenir au moins 6 caractères.',
      'Unable to validate email address':  t('err.invalidEmail')       || 'Adresse email invalide.',
    };
    for (const [k, v] of Object.entries(map)) {
      if (msg.includes(k)) return v;
    }
    return msg;
  }
};

window.AUTH = AUTH;

// ============================================================
// Met à jour les boutons du header selon l'état de connexion
// ============================================================
function _updateNavAuth() {
  const loggedIn  = AUTH.isLoggedIn();
  const userName  = AUTH.getUserName();

  // Tous les liens "Connexion" → "Mon espace" si connecté
  document.querySelectorAll('a[href="login.html"]').forEach(el => {
    if (loggedIn) {
      el.textContent = '👤 ' + userName;
      el.href = 'dashboard.html';
    }
  });

  // Bouton "Commencer" → "Mon tableau de bord" si connecté
  document.querySelectorAll('a[href="questionnaire.html"]').forEach(el => {
    if (loggedIn) {
      el.textContent = '🥦 Mon tableau de bord';
      el.href = 'dashboard.html';
    }
  });
}

// ============================================================
// Logique de la page login.html
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await AUTH.init();

  // Mise à jour du header sur toutes les pages
  _updateNavAuth();

  // Sur la page login : si déjà connecté → rediriger
  if (window.location.pathname.includes('login')) {
    if (AUTH.isLoggedIn()) {
      const redirect = new URLSearchParams(window.location.search).get('redirect') || 'dashboard.html';
      window.location.href = decodeURIComponent(redirect);
      return;
    }
  }

  // Sur les pages protégées : si NON connecté → rediriger vers inscription
  // ⚠️ Exception : si ?code= est dans l'URL, c'est un retour OAuth PKCE en cours
  //    → ne pas rediriger, laisser Supabase finir l'échange du code
  const _hasOAuthCode = new URLSearchParams(window.location.search).has('code');
  const _protectedPages = ['dashboard', 'plan', 'analyse'];
  const _currentPage = window.location.pathname.replace(/^\//, '').replace(/\.html$/, '');
  if (!_hasOAuthCode && _protectedPages.some(p => _currentPage === p || _currentPage.startsWith(p))) {
    if (!AUTH.isLoggedIn()) {
      const _dest = _currentPage || 'dashboard';
      window.location.href = '/login?signup=true&redirect=' + encodeURIComponent(_dest);
      return;
    }
  }

  // ── Boutons de la page login ──────────────────────────────
  const loginBtn    = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const magicBtn    = document.getElementById('magicLinkBtn');
  const googleBtn   = document.getElementById('googleBtn');
  const forgotBtn   = document.getElementById('forgotBtn');
  const logoutBtn   = document.getElementById('dashLogout');

  // Helper i18n local
  const _t = k => (window.I18N && window.I18N.t(k)) || null;

  // Connexion email + mot de passe
  loginBtn?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail')?.value?.trim();
    const pass  = document.getElementById('loginPassword')?.value;
    if (!email || !pass) { showToast?.(_t('auth.fillEmailPwd') || 'Remplissez email et mot de passe', 'warning'); return; }
    setLoading(loginBtn, true, _t('auth.loading.connecting') || 'Connexion…');
    try {
      await AUTH.login(email, pass);
      // onAuthStateChange gère la redirection
    } catch (e) {
      showToast?.(e.message, 'error');
      setLoading(loginBtn, false, _t('login.cta') || 'Se connecter');
    }
  });

  // Inscription email + mot de passe
  registerBtn?.addEventListener('click', async () => {
    const name  = document.getElementById('regName')?.value?.trim();
    const email = document.getElementById('regEmail')?.value?.trim();
    const pass  = document.getElementById('regPassword')?.value;
    const terms = document.getElementById('regTerms')?.checked;
    if (!email || !pass) { showToast?.(_t('auth.fillEmailPwd') || 'Remplissez email et mot de passe', 'warning'); return; }
    if (!terms)          { showToast?.(_t('auth.acceptTerms')  || 'Acceptez les conditions d\'utilisation', 'warning'); return; }
    setLoading(registerBtn, true, _t('auth.loading.creating') || 'Création…');
    try {
      await AUTH.register(email, pass, name || email.split('@')[0]);
      showToast?.(_t('auth.accountCreated') || '✅ Compte créé ! Vérifiez votre email pour confirmer.', 'success');
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setLoading(registerBtn, false, _t('reg.cta') || 'Créer mon compte');
    }
  });

  // Magic link
  magicBtn?.addEventListener('click', async () => {
    const email = document.getElementById('magicEmail')?.value?.trim();
    if (!email) { showToast?.(_t('auth.enterEmail') || 'Entrez votre adresse email', 'warning'); return; }
    setLoading(magicBtn, true, _t('auth.loading.sending') || 'Envoi…');
    try {
      await AUTH.sendMagicLink(email);
      const suc = document.getElementById('magicSuccess');
      if (suc) suc.style.display = '';
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setLoading(magicBtn, false, 'Recevoir le lien magique ✨');
    }
  });

  // Google OAuth
  googleBtn?.addEventListener('click', async () => {
    try { await AUTH.loginWithGoogle(); }
    catch (e) { showToast?.(e.message, 'error'); }
  });

  // Mot de passe oublié
  forgotBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value?.trim();
    if (!email) { showToast?.(_t('auth.enterEmailFirst') || 'Entrez d\'abord votre email ci-dessus', 'warning'); return; }
    try {
      await AUTH.resetPassword(email);
      showToast?.(_t('auth.resetSent') || '✅ Email de réinitialisation envoyé !', 'success');
    } catch (err) { showToast?.(err.message, 'error'); }
  });

  // Déconnexion (dashboard, plan, etc.)
  logoutBtn?.addEventListener('click', () => AUTH.logout());

  // Helper
  function setLoading(btn, loading, label) {
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = label;
  }
});
