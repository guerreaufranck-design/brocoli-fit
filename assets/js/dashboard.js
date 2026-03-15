// ============================================================
// BROCOLI.FIT — Dashboard page logic
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // ── Multi-child migration & data loading ──
  if (window.CHILDREN) { CHILDREN.migrate(); CHILDREN.cleanupIncomplete(); }
  const profile = window.CHILDREN ? CHILDREN.getProfile() : JSON.parse(localStorage.getItem('brocoliProfile') || '{}');
  const plan    = window.CHILDREN ? CHILDREN.getPlan()    : JSON.parse(localStorage.getItem('brocoliPlan')    || 'null');
  const history = window.CHILDREN ? CHILDREN.getHistory()  : JSON.parse(localStorage.getItem('brocoliHistory') || '[]');

  // ---- Guard: redirect to login if not authenticated ----
  if (!AUTH?.isLoggedIn()) {
    // Allow visiting dashboard even without "auth" during local dev
    // Just skip the guard for now
  }

  // ---- Greeting ----
  const hour  = new Date().getHours();
  const greet = hour < 12 ? t('dash.morning') || 'Bonjour' :
                hour < 18 ? t('dash.afternoon') || 'Bonjour' :
                             t('dash.evening')  || 'Bonsoir';
  const name  = profile.name || profile.parentName || '';
  setText('dashGreet', `${greet}${name ? ' ' + name : ''} 👋`);

  // ---- Child selector (multi-child) ----
  renderChildSelector();

  // ---- Stats row ----
  const userPlan = profile.selectedPlan || 'free';
  setText('ds-week',   currentWeekNumber());
  setText('ds-weight', profile.weight || '—');
  setText('ds-imc',    calcBMI?.(profile.weight, profile.height) || '—');
  setText('ds-plan',   planLabel(userPlan));

  // ---- Plan preview in "Mon plan" tab ----
  renderPlanPreview(plan, profile);

  // ---- AI advice timeline from history ----
  renderAdviceTimeline(history);

  // ---- History tab ----
  renderHistory(history);

  // ---- Check-in banner: show only if user hasn't checked in this week ----
  const lastCheckin = history[history.length - 1];
  const alreadyDone = lastCheckin && sameWeek(new Date(lastCheckin.date), new Date());
  if (alreadyDone) {
    document.getElementById('checkinBanner')?.style && (document.getElementById('checkinBanner').style.display = 'none');
  }

  // ============================================================
  // TAB SWITCHING
  // ============================================================
  const tabs = document.querySelectorAll('.dash-tab');
  const contents = document.querySelectorAll('.dash-tab-content');

  function showTab(tabId) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    contents.forEach(c => c.style.display = c.id === `tab-${tabId}` ? '' : 'none');
    window.location.hash = tabId;
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      showTab(tab.dataset.tab);
    });
  });

  // Links that switch tabs (e.g. checkin banner button)
  document.querySelectorAll('[data-tab]').forEach(el => {
    if (!el.classList.contains('dash-tab')) {
      el.addEventListener('click', e => {
        e.preventDefault();
        showTab(el.dataset.tab);
      });
    }
  });

  // Init from URL hash
  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById(`tab-${hash}`)) {
    showTab(hash);
  }

  // ============================================================
  // CHECK-IN FORM
  // ============================================================

  // Adherence slider live update
  const slider = document.getElementById('ci_adherence');
  const sliderVal = document.getElementById('adherenceVal');
  if (slider && sliderVal) {
    slider.addEventListener('input', () => {
      sliderVal.textContent = `${slider.value}%`;
    });
  }

  // Mood buttons
  document.querySelectorAll('#moodGrid .mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#moodGrid .mood-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Appetite buttons
  document.querySelectorAll('#appetiteOptions .sub-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#appetiteOptions .sub-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Submit check-in
  document.getElementById('submitCheckin')?.addEventListener('click', submitCheckin);

  // ============================================================
  // SUBMIT CHECK-IN
  // ============================================================
  async function submitCheckin() {
    const btn = document.getElementById('submitCheckin');
    const weight     = parseFloat(document.getElementById('ci_weight')?.value)    || null;
    const height     = parseFloat(document.getElementById('ci_height')?.value)    || null;
    const mood       = document.querySelector('#moodGrid .mood-btn.active')?.dataset.val || 'ok';
    const appetite   = document.querySelector('#appetiteOptions .sub-opt.active')?.dataset.val || 'normal';
    const adherence  = parseInt(document.getElementById('ci_adherence')?.value)   || 70;
    const notes      = document.getElementById('ci_notes')?.value?.trim()         || '';
    const newDislikes= document.getElementById('ci_newDislikes')?.value?.trim()   || '';

    if (!plan) {
      showToast(t('toast.noPlan') || 'Aucun plan actif. Créez votre programme d\'abord.', 'error');
      return;
    }

    // Save check-in entry to history
    const entry = {
      date:        new Date().toISOString(),
      week:        currentWeekNumber(),
      weight,
      height,
      mood,
      appetite,
      adherence,
      notes,
      newDislikes
    };

    // Update profile weight if provided
    if (weight) {
      profile.weight = weight;
      if (height) profile.height = height;
      if (window.CHILDREN) CHILDREN.saveProfile(profile);
      else localStorage.setItem('brocoliProfile', JSON.stringify(profile));
    }

    // Store check-in
    history.push(entry);
    if (window.CHILDREN) CHILDREN.saveHistory(history);
    else localStorage.setItem('brocoliHistory', JSON.stringify(history));

    // Update stats display
    if (weight) setText('ds-weight', weight);
    if (weight && (height || profile.height)) {
      setText('ds-imc', calcBMI?.(weight, height || profile.height) || '—');
    }

    // Disable button, show loading
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ <span>' + (t('dash.analyzing') || 'Analyse en cours…') + '</span>';
    }

    try {
      // Call Gemini to generate adjusted plan
      if (typeof GEMINI !== 'undefined' && typeof GEMINI.buildCheckinPrompt === 'function') {
        const prompt  = GEMINI.buildCheckinPrompt(profile, plan, entry);
        const newPlan = await GEMINI.call(prompt);

        if (newPlan && newPlan.analysis) {
          // Merge new plan: keep history, update plan data
          const updatedPlan = { ...plan, ...newPlan, generatedAt: new Date().toISOString() };
          if (window.CHILDREN) CHILDREN.savePlan(updatedPlan);
          else localStorage.setItem('brocoliPlan', JSON.stringify(updatedPlan));

          // Save AI advice from check-in into history entry
          if (newPlan.analysis?.checkin_advice) {
            entry.aiAdvice = newPlan.analysis.checkin_advice;
            history[history.length - 1] = entry;
            if (window.CHILDREN) CHILDREN.saveHistory(history);
            else localStorage.setItem('brocoliHistory', JSON.stringify(history));
          }

          showToast(t('toast.planAdjusted')   || '✅ Plan ajusté pour la semaine prochaine !', 'success');
          renderAdviceTimeline(history);
          renderHistory(history);
        } else {
          showToast(t('toast.planSavedNoAI')  || 'Plan enregistré (ajustement IA non disponible).', 'info');
        }
      } else {
        showToast(t('toast.checkinSaved')     || 'Suivi enregistré avec succès !', 'success');
      }
    } catch (err) {
      console.error('Checkin AI error:', err);
      showToast(t('toast.checkinSavedNoAdj') || 'Suivi enregistré. Ajustement non disponible.', 'info');
    }

    // Reset form
    resetCheckinForm();
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `🧠 <span>${t('ci.submit') || 'Analyser et ajuster mon plan'}</span>`;
    }

    // Hide check-in banner
    document.getElementById('checkinBanner')?.style && (document.getElementById('checkinBanner').style.display = 'none');
  }

  function resetCheckinForm() {
    const w = document.getElementById('ci_weight');
    const h = document.getElementById('ci_height');
    const n = document.getElementById('ci_notes');
    const d = document.getElementById('ci_newDislikes');
    const s = document.getElementById('ci_adherence');
    if (w) w.value = '';
    if (h) h.value = '';
    if (n) n.value = '';
    if (d) d.value = '';
    if (s) { s.value = 70; if (sliderVal) sliderVal.textContent = '70%'; }
    document.querySelectorAll('#moodGrid .mood-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#appetiteOptions .sub-opt').forEach(b => b.classList.remove('active'));
  }
});

// ============================================================
// RENDER HELPERS
// ============================================================

function renderPlanPreview(plan, profile) {
  const container = document.getElementById('dashPlanPreview');
  if (!container) return;

  if (!plan || !plan.analysis) {
    container.innerHTML = `
      <div style="text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:3rem">🥦</div>
        <p style="margin-top:1rem">${t('dash.noPlanActive') || 'Aucun plan actif.'} <a href="questionnaire.html" style="color:var(--green-dark);font-weight:700">${t('dash.createProgram') || 'Créez votre programme →'}</a></p>
      </div>`;
    return;
  }

  const a = plan.analysis;
  const today = plan.week?.[0];

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.875rem;margin-bottom:1.5rem">
      <div class="week-card" style="text-align:center">
        <div style="font-size:1.5rem">🔥</div>
        <div style="font-size:var(--text-xl);font-weight:900;color:var(--green-dark)">${a.daily_calories || '—'}</div>
        <div style="font-size:var(--text-xs);color:var(--text-muted);font-weight:700;margin-top:.125rem" data-i18n="stat.cal">kcal / jour</div>
      </div>
      <div class="week-card" style="text-align:center">
        <div style="font-size:1.5rem">💪</div>
        <div style="font-size:var(--text-xl);font-weight:900;color:var(--green-dark)">${a.macro_proteins_pct || 18}%</div>
        <div style="font-size:var(--text-xs);color:var(--text-muted);font-weight:700;margin-top:.125rem" data-i18n="mac.prot">Protéines</div>
      </div>
      <div class="week-card" style="text-align:center">
        <div style="font-size:1.5rem">📅</div>
        <div style="font-size:var(--text-xl);font-weight:900;color:var(--green-dark)">${Math.ceil((plan.week || []).length / 7)}</div>
        <div style="font-size:var(--text-xs);color:var(--text-muted);font-weight:700;margin-top:.125rem" data-i18n="stat.weeks">semaines</div>
      </div>
    </div>

    ${a.recommendations?.length ? `
    <div class="card" style="margin-bottom:1rem">
      <div style="font-size:var(--text-sm);font-weight:900;color:var(--text);margin-bottom:.875rem">🧠 ${t('dash.keyPoints') || 'Points clés'}</div>
      ${a.recommendations.slice(0,3).map(r => `
        <div style="display:flex;gap:.625rem;align-items:flex-start;margin-bottom:.625rem">
          <span style="color:var(--green);flex-shrink:0">✅</span>
          <span style="font-size:var(--text-sm);color:var(--text-mid)">${escHtml(r)}</span>
        </div>
      `).join('')}
    </div>` : ''}

    ${today ? `
    <div class="card">
      <div style="font-size:var(--text-sm);font-weight:900;color:var(--text);margin-bottom:.875rem">🍽️ ${t('dash.todayMeals') || "Repas d'aujourd'hui"}</div>
      ${(today.meals || []).slice(0,3).map(meal => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.625rem 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:.625rem">
            <span>${meal.emoji || '🍽️'}</span>
            <div>
              <div style="font-size:var(--text-sm);font-weight:800">${escHtml(meal.type || '')}</div>
              <div style="font-size:var(--text-xs);color:var(--text-muted)">${meal.time || ''}</div>
            </div>
          </div>
          <span class="badge badge-green">${meal.total_calories || 0} kcal</span>
        </div>
      `).join('')}
    </div>` : ''}`;

  if (window.applyI18n) applyI18n();
}

function renderAdviceTimeline(history) {
  const container = document.getElementById('aiAdviceTimeline');
  if (!container) return;

  const withAdvice = history.filter(h => h.aiAdvice).slice(-3).reverse();

  if (!withAdvice.length) return; // Keep default "no advice" message

  container.innerHTML = withAdvice.map(entry => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-body">
        <div class="timeline-date">${formatDateShort(entry.date)}</div>
        <div class="timeline-text">${escHtml(entry.aiAdvice)}</div>
      </div>
    </div>
  `).join('');
}

function renderHistory(history) {
  const container = document.getElementById('historyContent');
  if (!container) return;

  if (!history.length) return; // Keep default empty state

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:.875rem">
      ${[...history].reverse().map(entry => `
        <div class="week-card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:.75rem">
            <div>
              <div class="week-num">${t('dash.week') || 'Semaine'} ${entry.week} · ${formatDateShort(entry.date)}</div>
              <div class="week-name">${moodLabel(entry.mood)} · ${appetiteLabel(entry.appetite)}</div>
            </div>
            <span class="badge badge-green">${entry.adherence || 0}% ${t('dash.adherence') || 'adhésion'}</span>
          </div>
          <div class="week-tags">
            ${entry.weight ? `<span class="tag">${entry.weight} kg</span>` : ''}
            ${entry.notes ? `<span class="tag" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(entry.notes)}</span>` : ''}
          </div>
          ${entry.aiAdvice ? `
          <div style="margin-top:.75rem;padding:.625rem;background:var(--green-pale);border-radius:var(--r-md)">
            <div style="font-size:var(--text-xs);font-weight:900;color:var(--green-dark);margin-bottom:.25rem">💚 ${t('dash.personalAdvice') || 'Conseil personnalisé'}</div>
            <div style="font-size:var(--text-sm);color:var(--text-mid)">${escHtml(entry.aiAdvice)}</div>
          </div>` : ''}
        </div>
      `).join('')}
    </div>`;
}

// ============================================================
// UTILITY
// ============================================================

function currentWeekNumber() {
  const now  = new Date();
  const start= new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}

function sameWeek(d1, d2) {
  const oneDay = 86400000;
  const startOfWeek = d => {
    const day = d.getDay() || 7;
    return new Date(d.getTime() - (day - 1) * oneDay);
  };
  return startOfWeek(d1).toDateString() === startOfWeek(d2).toDateString();
}

function formatDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(navigator.language || 'fr-FR', { day: 'numeric', month: 'short' });
}

function moodLabel(val) {
  const _t = k => (window.I18N && window.I18N.t(k)) || null;
  const m = {
    happy: '😄 ' + (_t('mood.great') || 'Super'),
    ok:    '🙂 ' + (_t('mood.ok')    || 'Bien'),
    meh:   '😐 ' + (_t('mood.meh')   || 'Moyen'),
    bad:   '😔 ' + (_t('mood.bad')   || 'Difficile'),
  };
  return m[val] || val || '—';
}

function appetiteLabel(val) {
  const _t = k => (window.I18N && window.I18N.t(k)) || null;
  const a = {
    great:  _t('app.great')  || 'Très bon appétit',
    normal: _t('app.normal') || 'Normal',
    low:    _t('app.low')    || 'Peu d\'appétit',
    none:   _t('app.none')   || 'Pas mangé',
  };
  return a[val] || val || '—';
}

function planLabel(p) {
  const _t = k => (window.I18N && window.I18N.t(k)) || null;
  return {
    free:      _t('plan.free.name') || 'Découverte',
    essential: _t('plan.ess.name')  || 'Essentiel',
    premium:   _t('plan.prem.name') || 'Premium',
  }[p] || _t('plan.free.name') || 'Découverte';
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function t(key) {
  return (window.I18N?.current && window.I18N.current[key]) || null;
}

// ============================================================
// CHILD SELECTOR (multi-child support)
// ============================================================

function renderChildSelector() {
  const container = document.getElementById('childSelectorWrap');
  if (!container || !window.CHILDREN) return;

  const allChildren = CHILDREN.getAllChildren();
  const activeId    = CHILDREN.getActiveChildId();

  // Hide selector if only 1 child and free plan
  if (allChildren.length <= 1 && CHILDREN.getTier() === 'free') {
    // Still show for 1 child on paid plans (to show "Add" button)
    if (allChildren.length <= 1 && CHILDREN.getTier() === 'free') {
      container.style.display = 'none';
      return;
    }
  }

  const _t = k => (window.I18N?.t(k)) || null;

  let html = '<div class="child-selector">';
  html += '<div class="child-selector-label">' + (_t('children.selector') || 'Mes enfants') + '</div>';
  html += '<div class="child-selector-pills">';

  allChildren.forEach(child => {
    const isActive = child.id === activeId;
    const name = child.profile?.name || (_t('s.yourChild') || 'Enfant');
    const age  = child.profile?.age  || '?';
    const ageUnit = child.profile?.profil === 'bebe'
      ? (_t('q2.months') || 'mois')
      : (_t('q2.years')  || 'ans');
    const hasPlan = !!(child.plan && child.plan.analysis);

    html += '<button class="child-pill' + (isActive ? ' active' : '') + '" data-child-id="' + child.id + '">'
      + '<span class="child-pill-name">' + escHtml(name) + '</span>'
      + '<span class="child-pill-age">' + age + ' ' + ageUnit + '</span>'
      + (isActive ? '<span class="child-pill-badge">' + (_t('children.active') || 'Actif') + '</span>' : '')
      + (!hasPlan && !isActive ? '<span class="child-pill-age">' + (_t('children.noPlan') || 'Pas de plan') + '</span>' : '')
      + '</button>';
  });

  // Add child button
  html += '<button class="child-pill child-pill-add" id="addChildBtn">'
    + '<span>+ ' + (_t('children.add') || 'Ajouter un enfant') + '</span>'
    + '</button>';

  html += '</div></div>';
  container.innerHTML = html;

  // Event: switch child
  container.querySelectorAll('.child-pill[data-child-id]').forEach(pill => {
    pill.addEventListener('click', () => {
      const childId = pill.dataset.childId;
      if (childId !== activeId) {
        CHILDREN.setActiveChild(childId);
        window.location.reload();
      }
    });
  });

  // Event: add child
  document.getElementById('addChildBtn')?.addEventListener('click', () => {
    if (CHILDREN.canAddChild()) {
      CHILDREN.startAddChildFlow();
    } else {
      CHILDREN.showUpgradePopup();
    }
  });
}
