// ============================================================
// BROCOLI.FIT — App Core (Navbar, Scroll, FAQ, Animations)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initFAQ();
  initScrollAnimations();
  initCookieBanner();
});

// ============================================================
// NAVBAR
// ============================================================
function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const toggle    = document.getElementById('navToggle');
  const menu      = document.getElementById('mobileMenu');
  const menuClose = document.getElementById('mobileMenuClose');

  if (!navbar) return;

  // Scroll effect
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // Mobile menu
  if (toggle) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      menu?.classList.toggle('open');
      document.body.style.overflow = menu?.classList.contains('open') ? 'hidden' : '';
    });
  }

  if (menuClose) {
    menuClose.addEventListener('click', () => {
      toggle?.classList.remove('open');
      menu?.classList.remove('open');
      document.body.style.overflow = '';
    });
  }

  // Close mobile menu on link click
  document.querySelectorAll('.mobile-menu-link, .mobile-menu-actions a').forEach(link => {
    link.addEventListener('click', () => {
      toggle?.classList.remove('open');
      menu?.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// ============================================================
// FAQ ACCORDION
// ============================================================
function initFAQ() {
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', () => {
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
}

// ============================================================
// SCROLL ANIMATIONS (Intersection Observer)
// ============================================================
function initScrollAnimations() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.fade-up').forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.06}s`;
    obs.observe(el);
  });
}

// ============================================================
// COOKIE BANNER
// ============================================================
function initCookieBanner() {
  const banner = document.getElementById('cookieBanner');
  if (!banner) return;
  if (localStorage.getItem('cookieConsent')) return;

  setTimeout(() => banner.classList.add('show'), 1500);

  document.getElementById('cookieAccept')?.addEventListener('click', () => {
    localStorage.setItem('cookieConsent', 'accepted');
    banner.classList.remove('show');
  });

  document.getElementById('cookieDecline')?.addEventListener('click', () => {
    localStorage.setItem('cookieConsent', 'declined');
    banner.classList.remove('show');
  });
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(msg, type = 'info', duration = 3500) {
  const container = document.getElementById('toasts');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '💬'}</span><span class="toast-msg">${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

window.showToast = showToast;

// ============================================================
// UTILITY: Format calories
// ============================================================
function fmtCal(n) { return `${Math.round(n).toLocaleString()} kcal`; }
function fmtKg(n)  { return `${parseFloat(n).toFixed(1)} kg`; }
function calcBMI(w, h) { return h > 0 ? (w / ((h/100) ** 2)).toFixed(1) : '—'; }

window.fmtCal = fmtCal;
window.fmtKg  = fmtKg;
window.calcBMI = calcBMI;

// ============================================================
// UTILITY: Tag input helper
// ============================================================
function initTagInput(wrapId, inputId, tags = [], onChange) {
  const wrap  = document.getElementById(wrapId);
  const input = document.getElementById(inputId);
  if (!wrap || !input) return { getTags: () => tags };

  function renderTags() {
    wrap.querySelectorAll('.tag').forEach(t => t.remove());
    tags.forEach((tag, i) => {
      const el = document.createElement('span');
      el.className = 'tag';
      el.innerHTML = `${tag}<span class="tag-remove" data-i="${i}">×</span>`;
      wrap.insertBefore(el, input);
    });
    if (onChange) onChange(tags);
  }

  function addTag(val) {
    val = val.trim().toLowerCase();
    if (val && !tags.includes(val) && tags.length < 15) {
      tags.push(val);
      renderTags();
    }
    input.value = '';
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(input.value); }
    if (e.key === 'Backspace' && !input.value && tags.length) {
      tags.pop(); renderTags();
    }
  });

  wrap.addEventListener('click', e => {
    if (e.target.classList.contains('tag-remove')) {
      tags.splice(parseInt(e.target.dataset.i), 1);
      renderTags();
    } else {
      input.focus();
    }
  });

  renderTags();
  return { getTags: () => [...tags], addTag };
}

window.initTagInput = initTagInput;

// ============================================================
// UTILITY: Suggestion chips
// ============================================================
function renderSuggestions(containerId, suggestions, tagInput) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  suggestions.forEach(s => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sub-opt';
    chip.textContent = s;
    chip.style.fontSize = 'var(--text-xs)';
    chip.style.padding = '.3rem .7rem';
    chip.addEventListener('click', () => {
      tagInput.addTag(s);
      chip.style.opacity = '.4';
      chip.disabled = true;
    });
    el.appendChild(chip);
  });
}

window.renderSuggestions = renderSuggestions;

// ============================================================
// STEPPER HELPER
// ============================================================
function initStepper(downId, upId, valId, initial, min, max, step = 1, onChange) {
  let val = initial;
  const valEl = document.getElementById(valId);

  function update() {
    if (valEl) valEl.textContent = val;
    if (onChange) onChange(val);
  }

  document.getElementById(downId)?.addEventListener('click', () => {
    if (val - step >= min) { val -= step; update(); }
  });

  document.getElementById(upId)?.addEventListener('click', () => {
    if (val + step <= max) { val += step; update(); }
  });

  update();
  return { getVal: () => val, setVal: (v) => { val = Math.min(max, Math.max(min, v)); update(); } };
}

window.initStepper = initStepper;
