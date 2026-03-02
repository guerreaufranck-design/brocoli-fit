// ============================================================
// BROCOLI.FIT — Auth (localStorage-based for local dev)
// ============================================================

const AUTH = {
  getUser() {
    try { return JSON.parse(localStorage.getItem('brocoliUser') || 'null'); } catch { return null; }
  },
  saveUser(u) { localStorage.setItem('brocoliUser', JSON.stringify(u)); },
  logout()    { localStorage.removeItem('brocoliUser'); window.location.href = 'login.html'; },
  isLoggedIn(){ return !!this.getUser(); },

  register(name, email, password) {
    if (!name || !email || !password) throw new Error('Tous les champs sont requis');
    if (password.length < 8)         throw new Error('Mot de passe trop court (min. 8 caractères)');
    const user = {
      id: Date.now().toString(),
      name, email,
      plan: 'free',
      createdAt: new Date().toISOString(),
      checkins: [], plans: []
    };
    this.saveUser(user);
    return user;
  },

  login(email, password) {
    // For local dev, accept any credentials and create a mock user
    const existing = this.getUser();
    if (existing && existing.email === email) return existing;
    const user = {
      id: Date.now().toString(),
      name: email.split('@')[0],
      email,
      plan: localStorage.getItem('brocoliSelectedPlan') || 'free',
      createdAt: new Date().toISOString(),
      checkins: [], plans: []
    };
    this.saveUser(user);
    return user;
  }
};

window.AUTH = AUTH;

// ============================================================
// Login page logic
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn    = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const logoutBtn   = document.getElementById('dashLogout');

  // Redirect if already logged in (on login page)
  if (window.location.pathname.includes('login.html') && AUTH.isLoggedIn()) {
    window.location.href = 'dashboard.html';
    return;
  }

  loginBtn?.addEventListener('click', () => {
    const email = document.getElementById('loginEmail')?.value;
    const pass  = document.getElementById('loginPassword')?.value;
    if (!email) { showToast?.('Entrez votre email', 'warning'); return; }
    try {
      AUTH.login(email, pass);
      const redirect = new URLSearchParams(window.location.search).get('redirect') || 'dashboard.html';
      window.location.href = redirect;
    } catch(e) { showToast?.(e.message, 'error'); }
  });

  registerBtn?.addEventListener('click', () => {
    const name  = document.getElementById('regName')?.value;
    const email = document.getElementById('regEmail')?.value;
    const pass  = document.getElementById('regPassword')?.value;
    const terms = document.getElementById('regTerms')?.checked;
    if (!terms) { showToast?.('Acceptez les conditions d\'utilisation', 'warning'); return; }
    try {
      AUTH.register(name, email, pass);
      const plan = new URLSearchParams(window.location.search).get('plan');
      if (plan) localStorage.setItem('brocoliSelectedPlan', plan);
      const redirect = new URLSearchParams(window.location.search).get('redirect') || 'questionnaire.html';
      window.location.href = redirect;
    } catch(e) { showToast?.(e.message, 'error'); }
  });

  logoutBtn?.addEventListener('click', () => AUTH.logout());
});
