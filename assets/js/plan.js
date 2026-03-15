// ============================================================
// BROCOLI.FIT — Plan page rendering
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const _t = k => (window.I18N && window.I18N.t(k)) || null;
  const plan    = JSON.parse(localStorage.getItem('brocoliPlan')    || 'null');
  const profile = JSON.parse(localStorage.getItem('brocoliProfile') || '{}');
  const userPlan= profile?.selectedPlan || 'free';

  if (!plan || !plan.analysis) {
    document.getElementById('mealsContent').innerHTML = `
      <div style="text-align:center;padding:3rem">
        <div style="font-size:3rem">🥦</div>
        <p style="color:var(--text-muted);margin-top:1rem">${_t('dash.noPlanActive') || 'Aucun plan disponible.'} <a href="questionnaire.html" style="color:var(--green-dark);font-weight:700">${_t('dash.createProgram') || 'Créez votre programme →'}</a></p>
      </div>`;
    return;
  }

  const a = plan.analysis;
  const weeks = plan.week ? distributeWeeks(plan.week) : {};

  // ---- Hero ----
  const heroName = document.getElementById('planHeroName');
  const heroMeta = document.getElementById('planHeroMeta');
  const childName = a.name || profile.name || _t('s.yourChild') || 'votre enfant';
  if (heroName) heroName.textContent = `${_t('plan.heroOf') || 'Plan de'} ${childName}`;
  if (heroMeta) heroMeta.textContent = `Plan ${planLabel(userPlan)} · 4 ${_t('stat.weeks') || 'semaines'} · ${_t('plan.eyebrow') || 'Généré par nos experts'}`;

  // ---- Intro phrase ----
  const heroIntro = document.getElementById('planHeroIntro');
  if (heroIntro) {
    const goalKey = profile.objectif ? `goal.${profile.objectif}` : null;
    const goalText = (goalKey && _t(goalKey)) || { sante: 'manger sainement', maintien: 'maintenir son poids', prise: 'prendre du poids', perte: 'perdre du poids' }[profile.objectif] || 'une alimentation équilibrée';
    const age = profile.age || a.age || '';
    const ageUnit = profile.profil === 'bebe' ? (_t('unit.months') || 'mois') : (_t('unit.years') || 'ans');
    heroIntro.textContent = `${_t('plan.intro') || 'Voici le programme personnalisé pour'} ${childName}${age ? `, ${age} ${ageUnit}` : ''}. ${_t('plan.introGoal') || 'Son objectif :'} ${goalText.toLowerCase()}.`;
  }

  // Show upgrade bar for free users
  if (userPlan === 'free') {
    document.getElementById('upgradeBar')?.removeAttribute('style');
  }

  // ---- Stats ----
  document.getElementById('statCal')?.textContent  !== undefined && (document.getElementById('statCal').textContent  = a.daily_calories || '—');
  document.getElementById('statProt')?.textContent !== undefined && (document.getElementById('statProt').textContent = `${a.macro_proteins_pct || 18}%`);
  document.getElementById('statIMC')?.textContent  !== undefined && (document.getElementById('statIMC').textContent  = a.bmi || calcBMI?.(profile.weight, profile.height) || '—');

  // ---- Macros ----
  const pPct = a.macro_proteins_pct || 18;
  const cPct = a.macro_carbs_pct    || 52;
  const fPct = a.macro_fats_pct     || 30;
  setWidth('macroProt', pPct);
  setWidth('macroCarb', cPct);
  setWidth('macroFat',  fPct);
  setText('mProtVal', `${pPct}%`);
  setText('mCarbVal', `${cPct}%`);
  setText('mFatVal',  `${fPct}%`);

  // ---- AI Advice ----
  const adviceList = document.getElementById('adviceList');
  if (adviceList && a.recommendations?.length) {
    adviceList.innerHTML = a.recommendations.map(r =>
      `<div class="advice-item">✅ <span>${escHtml(r)}</span></div>`
    ).join('');
  }

  // ---- Week & Day tabs ----
  let currentWeek = 1;
  let currentDay  = 0;
  const isFree = userPlan === 'free';

  const weekData = weeks; // { 1: [...7 days], 2: [...], 3: [...], 4: [...] }

  // Free plan: lock weeks 2-4
  if (isFree) {
    document.querySelectorAll('.week-tab').forEach(tab => {
      const w = parseInt(tab.dataset.week);
      if (w > 1) {
        tab.style.opacity = '0.4';
        tab.style.cursor = 'not-allowed';
        tab.innerHTML = `🔒 ${tab.textContent}`;
      }
    });
    // Update hero meta to show "1 semaine"
    if (heroMeta) heroMeta.textContent = `Plan ${planLabel(userPlan)} · 1 ${_t('stat.week') || 'semaine'} · ${_t('plan.eyebrow') || 'Généré par nos experts'}`;
  }

  document.querySelectorAll('.week-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const w = parseInt(tab.dataset.week);
      if (isFree && w > 1) {
        // Show upgrade card instead of meals
        const mealsEl = document.getElementById('mealsContent');
        const dayTabsEl = document.getElementById('dayTabs');
        if (dayTabsEl) dayTabsEl.innerHTML = '';
        if (mealsEl) mealsEl.innerHTML = `
          <div style="text-align:center;padding:3rem 1.5rem;max-width:500px;margin:2rem auto;background:var(--green-pale);border-radius:1.25rem;border:2px dashed var(--green)">
            <div style="font-size:3rem;margin-bottom:1rem">🔓</div>
            <h3 style="font-family:var(--font-heading);color:var(--green-dark);margin-bottom:.75rem">
              ${_t('plan.unlockWeeks', 'Débloquez les 4 semaines')}
            </h3>
            <p style="color:var(--text-muted);line-height:1.6;margin-bottom:1.5rem;font-size:.95rem">
              ${_t('plan.unlockDesc', 'Le plan gratuit inclut 1 semaine de programme. Passez au plan Essentiel ou Premium pour accéder aux 4 semaines complètes avec des repas variés chaque semaine.')}
            </p>
            <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
              <a href="login.html?redirect=checkout&plan=essential" class="btn btn-green btn-sm">
                ⭐ ${_t('plan.ess', 'Essentiel')} — 9€/mois
              </a>
              <a href="login.html?redirect=checkout&plan=premium" class="btn btn-dark btn-sm">
                👑 ${_t('plan.prem', 'Premium')} — 14,90€/mois
              </a>
            </div>
          </div>`;
        return;
      }
      document.querySelectorAll('.week-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentWeek = parseInt(tab.dataset.week);
      currentDay  = 0;
      renderDayTabs(currentWeek);
    });
  });

  function renderDayTabs(week) {
    const days = weekData[week] || plan.week || [];
    const tabContainer = document.getElementById('dayTabs');
    if (!tabContainer) return;

    tabContainer.innerHTML = '';
    days.forEach((day, i) => {
      const btn = document.createElement('button');
      btn.className = `day-tab${i === currentDay ? ' active' : ''}`;
      btn.textContent = day.day || `${_t('plan.day') || 'Jour'} ${i+1}`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        currentDay = i;
        renderMeals(days[i]);
      });
      tabContainer.appendChild(btn);
    });

    renderMeals(days[currentDay] || days[0]);
  }

  function renderMeals(dayData) {
    const container = document.getElementById('mealsContent');
    if (!container || !dayData) return;

    const meals = dayData.meals || [];
    container.innerHTML = meals.map(meal => `
      <div class="meal-card open">
        <div class="meal-head" onclick="this.closest('.meal-card').classList.toggle('open')">
          <div class="meal-type-wrap">
            <div class="meal-type-icon">${meal.emoji || '🍽️'}</div>
            <div>
              <div class="meal-type-name">${escHtml(meal.type || '')}</div>
              <div class="meal-type-cal">${meal.time || ''} · ${meal.total_calories || 0} kcal</div>
            </div>
          </div>
          <span class="meal-chevron">▼</span>
        </div>
        <div class="meal-body">
          <div class="meal-items">
            ${(meal.items || []).map(item => `
              <div class="meal-item">
                <div class="meal-item-l">
                  <div>
                    <div class="meal-item-name">${escHtml(item.name || '')}</div>
                    <div class="meal-item-qty">${escHtml(item.quantity || '')}</div>
                    ${(item.allergens||[]).map(a => `<span class="allergen-tag">${escHtml(a)}</span>`).join(' ')}
                  </div>
                </div>
                <div class="meal-item-r">
                  <div class="meal-item-cal">${item.calories || 0} kcal</div>
                </div>
              </div>
            `).join('')}
          </div>
          ${meal.recipe_hint ? `<div class="meal-note">💡 ${escHtml(meal.recipe_hint)}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  // ---- Recipes & Shopping (Premium) ----
  if (userPlan === 'premium') {
    renderRecipes(plan.recipes || []);
    renderShopping(plan.shopping_list);
  }

  function renderRecipes(recipes) {
    const section = document.getElementById('recipesSection');
    if (!section || !recipes.length) return;
    section.innerHTML = `
      <h3 style="font-family:var(--font-serif);font-style:italic;font-size:var(--text-2xl);color:var(--green-dark);margin-bottom:1rem">📖 ${_t('plan.recipesTitle') || 'Fiches recettes'}</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem">
        ${recipes.map(r => `
          <div class="recipe-card">
            <div class="recipe-thumb">${r.emoji || '🍲'}</div>
            <div class="recipe-body">
              <div class="recipe-name">${escHtml(r.name || '')}</div>
              <div class="recipe-meta">⏱ ${r.prep_min || 0}+${r.cook_min || 0} min · 🍽 ${r.servings || 4} ${_t('plan.pers') || 'pers.'}</div>
              <div class="recipe-tags">${(r.allergens||[]).map(a => `<span class="allergen-tag">${escHtml(a)}</span>`).join('')}</div>
              <button class="btn btn-outline btn-sm btn-full" style="margin-top:.875rem" onclick='showRecipe(${JSON.stringify(r).replace(/'/g,"&#39;")})'>${_t('plan.viewRecipe') || 'Voir la recette'}</button>
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  function renderShopping(list) {
    const section = document.getElementById('shoppingSection');
    if (!section || !list) return;
    section.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
        <h3 style="font-family:var(--font-serif);font-style:italic;font-size:var(--text-2xl);color:var(--green-dark)">🛒 ${_t('plan.shoppingTitle') || 'Liste de courses'}</h3>
        <span class="badge badge-green">~${list.estimated_total || '?'}</span>
      </div>
      ${(list.categories||[]).map(cat => `
        <div class="card" style="margin-bottom:1rem">
          <div style="font-size:var(--text-base);font-weight:900;color:var(--text);margin-bottom:.875rem">${cat.emoji || '🛒'} ${escHtml(cat.category || '')}</div>
          <div style="display:flex;flex-direction:column;gap:.5rem">
            ${(cat.items||[]).map(item => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;background:var(--bg);border-radius:var(--r-md)">
                <span style="font-size:var(--text-sm);font-weight:700">${escHtml(item.name || '')}</span>
                <div style="display:flex;align-items:center;gap:.75rem">
                  <span style="font-size:var(--text-xs);color:var(--text-muted)">${escHtml(item.qty || '')}</span>
                  <span style="font-size:var(--text-xs);color:var(--text-muted)">${escHtml(item.approx_cost || '')}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}`;
  }

  // Init with week 1
  renderDayTabs(1);
});

// Show recipe modal
function showRecipe(recipe) {
  const _t = k => (window.I18N && window.I18N.t(k)) || null;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:1rem';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:var(--r-2xl);max-width:540px;width:100%;max-height:85vh;overflow-y:auto;padding:2rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
        <span style="font-size:2rem">${recipe.emoji || '🍲'}</span>
        <button onclick="this.closest('div[style]').remove()" style="font-size:1.25rem;cursor:pointer;padding:.5rem">✕</button>
      </div>
      <h3 style="font-size:var(--text-2xl);font-weight:900;color:var(--green-dark);margin-bottom:.5rem">${escHtml(recipe.name)}</h3>
      <div style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:1.5rem">⏱ ${recipe.prep_min}+${recipe.cook_min} min · 🍽 ${recipe.servings} ${_t('plan.persons') || 'personnes'}</div>
      <h4 style="font-size:var(--text-sm);font-weight:900;text-transform:uppercase;letter-spacing:1px;color:var(--green);margin-bottom:.75rem">${_t('plan.ingredients') || 'Ingrédients'}</h4>
      <ul style="margin-bottom:1.5rem;display:flex;flex-direction:column;gap:.375rem">
        ${(recipe.ingredients||[]).map(i => `<li style="font-size:var(--text-sm);display:flex;gap:.5rem"><span>•</span><span><strong>${escHtml(i.item)}</strong> — ${escHtml(i.qty)}${i.note ? ` (${escHtml(i.note)})` : ''}</span></li>`).join('')}
      </ul>
      <h4 style="font-size:var(--text-sm);font-weight:900;text-transform:uppercase;letter-spacing:1px;color:var(--green);margin-bottom:.75rem">${_t('plan.preparation') || 'Préparation'}</h4>
      <ol style="display:flex;flex-direction:column;gap:.625rem">
        ${(recipe.steps||[]).map((s,i) => `<li style="font-size:var(--text-sm);display:flex;gap:.75rem"><span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--green-pale);color:var(--green-dark);font-weight:900;font-size:.75rem;display:flex;align-items:center;justify-content:center">${i+1}</span><span>${escHtml(s)}</span></li>`).join('')}
      </ol>
      ${recipe.substitutions?.length ? `<div style="margin-top:1.5rem;padding:1rem;background:var(--orange-light);border-radius:var(--r-md)"><div style="font-size:var(--text-sm);font-weight:900;color:#c96520;margin-bottom:.5rem">🔄 ${_t('plan.substitutions') || 'Substitutions'}</div>${recipe.substitutions.map(s=>`<div style="font-size:var(--text-sm);color:var(--text-mid)">${escHtml(s)}</div>`).join('')}</div>` : ''}
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function distributeWeeks(days) {
  // If we have 7 days, distribute across 4 weeks (cycling)
  const weeks = {1:[],2:[],3:[],4:[]};
  days.forEach((d,i) => { weeks[Math.min(4, Math.ceil((i+1)/7)) || 1].push(d); });
  // Fill weeks 2-4 by cycling week 1 if not enough data
  for (let w=2; w<=4; w++) {
    if (!weeks[w].length && weeks[1].length) weeks[w] = weeks[1];
  }
  return weeks;
}

function setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${pct}%`;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function planLabel(p) {
  const _t = k => (window.I18N && window.I18N.t(k)) || null;
  return {
    free:      _t('plan.free.name') || 'Découverte',
    essential: _t('plan.ess.name')  || 'Essentiel',
    premium:   _t('plan.prem.name') || 'Premium',
  }[p] || _t('plan.free.name') || 'Découverte';
}
