// ============================================================
// BROCOLI.FIT — Questionnaire multi-étapes
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const TOTAL_STEPS = 8;
  let currentStep = 1;

  // Helper: get i18n string or fallback
  function t(key, fallback) {
    return (window.I18N && window.I18N.t(key)) || fallback || key;
  }

  // ── Multi-child: migration & mode detection ──────────────────────────
  if (window.CHILDREN) CHILDREN.migrate();
  const _qParams   = new URLSearchParams(window.location.search);
  const _addMode   = _qParams.get('mode') === 'add-child';
  const _addChildId= _qParams.get('childId');
  // If in add-child mode, set the new child as active
  if (_addMode && _addChildId && window.CHILDREN) {
    CHILDREN.setActiveChild(_addChildId);
  }

  // ── Guard: free users can only create 1 plan ──────────────────────────
  const existingPlan = window.CHILDREN ? CHILDREN.getPlan() : JSON.parse(localStorage.getItem('brocoliPlan') || 'null');
  const existingSub  = JSON.parse(localStorage.getItem('brocoliSubscription') || 'null');
  const existingProfile = window.CHILDREN ? CHILDREN.getProfile() : JSON.parse(localStorage.getItem('brocoliProfile') || 'null');
  const currentTier = window.CHILDREN ? CHILDREN.getTier() : (existingSub?.plan || existingProfile?.selectedPlan || 'free');

  // Skip guard in add-child mode (user already passed canAddChild check)
  if (!_addMode && existingPlan && existingPlan.analysis && currentTier === 'free') {
    // Free user already has a plan → block access
    document.querySelector('.q-container')?.remove();
    const main = document.querySelector('main') || document.body;
    main.innerHTML = `
      <div style="max-width:500px;margin:4rem auto;text-align:center;padding:2rem">
        <div style="font-size:3.5rem;margin-bottom:1rem">🔒</div>
        <h2 style="font-family:var(--font-heading);color:var(--green-dark);margin-bottom:.75rem">
          ${t('q.freeLimitTitle', 'Votre plan est déjà actif !')}
        </h2>
        <p style="color:var(--text-muted);line-height:1.6;margin-bottom:1.5rem">
          ${t('q.freeLimitDesc', 'Le plan gratuit inclut un seul programme de 4 semaines. Pour créer de nouveaux programmes pour d\'autres enfants, passez à un plan supérieur.')}
        </p>
        <a href="plan.html" class="btn btn-green" style="margin-bottom:.75rem;display:inline-block">
          ${t('q.freeLimitViewPlan', '📋 Voir mon programme actuel')}
        </a>
        <div style="margin-top:1rem;display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
          <a href="login.html?redirect=checkout&plan=essential" class="btn btn-dark btn-sm" onclick="localStorage.removeItem('brocoliPlan')">
            ⭐ ${t('plan.ess', 'Essentiel')} — 9€/mois (2 enfants)
          </a>
          <a href="login.html?redirect=checkout&plan=premium" class="btn btn-dark btn-sm" onclick="localStorage.removeItem('brocoliPlan')">
            👑 ${t('plan.prem', 'Premium')} — 14,90€/mois (illimité)
          </a>
        </div>
      </div>`;
    return; // Stop questionnaire initialization
  }

  // State
  const data = {
    profil: null, name: '', genre: null, age: 7, ageUnit: 'years', weight: 28, height: 128,
    objectif: null, diet: 'omnivore', dietOther: '', favorites: [], cuisines: [],
    dislikeVeg: [], dislikeMeat: [], dislikeOther: [],
    allergens: [], otherAllergy: '',
    healthConditions: [], healthNote: '',
    people: '4', budget: null, cookTime: null, activity: null, sports: [], sportsOther: '',
    selectedPlan: 'free'
  };

  // ---- Number inputs (age, weight, height) ----
  document.getElementById('ageVal')?.addEventListener('input',    e => { data.age    = parseFloat(e.target.value) || (data.profil === 'bebe' ? 9 : 7); });
  document.getElementById('weightVal')?.addEventListener('input', e => { data.weight = parseFloat(e.target.value) || 28; });
  document.getElementById('heightVal')?.addEventListener('input', e => { data.height = parseFloat(e.target.value) || 128; });

  // Diet other text
  document.getElementById('dietOther')?.addEventListener('input', e => { data.dietOther = e.target.value; });
  document.getElementById('sportsOther')?.addEventListener('input', e => { data.sportsOther = e.target.value; });

  // ---- Init tag inputs ----
  const favInput  = initTagInput('favWrap',         'favInput',         data.favorites);
  const dvegInput = initTagInput('dislikeVegWrap',  'dislikeVegInput',  data.dislikeVeg);
  const dmeatInput= initTagInput('dislikeMeatWrap', 'dislikeMeatInput', data.dislikeMeat);
  const dotherInput = initTagInput('dislikeOtherWrap', 'dislikeOtherInput', data.dislikeOther);

  // ---- Suggestions ----
  const suggestionsLang = {
    fr: {
      fav:      ['pâtes', 'poulet', 'pizza', 'riz', 'brocoli', 'yaourt', 'pommes', 'carottes', 'omelette', 'lentilles'],
      vegDis:   ['épinards', 'courgettes', 'aubergines', 'champignons', 'poireaux', 'choux de Bruxelles'],
      meatDis:  ['foie', 'poisson', 'thon', 'saumon', 'sardines', 'agneau', 'lapin'],
    },
    en: {
      fav:      ['pasta', 'chicken', 'pizza', 'rice', 'broccoli', 'yogurt', 'apples', 'carrots', 'eggs', 'lentils'],
      vegDis:   ['spinach', 'courgette', 'aubergine', 'mushrooms', 'leeks', 'Brussels sprouts'],
      meatDis:  ['liver', 'fish', 'tuna', 'salmon', 'sardines', 'lamb', 'rabbit'],
    },
    de: {
      fav:      ['Nudeln', 'Hähnchen', 'Pizza', 'Reis', 'Brokkoli', 'Joghurt', 'Äpfel', 'Möhren', 'Eier', 'Linsen'],
      vegDis:   ['Spinat', 'Zucchini', 'Aubergine', 'Pilze', 'Lauch', 'Rosenkohl'],
      meatDis:  ['Leber', 'Fisch', 'Thunfisch', 'Lachs', 'Sardinen', 'Lamm'],
    },
    it: {
      fav:      ['pasta', 'pollo', 'pizza', 'riso', 'broccoli', 'yogurt', 'mele', 'carote', 'uova', 'lenticchie'],
      vegDis:   ['spinaci', 'zucchine', 'melanzane', 'funghi', 'porri', 'cavoletti di Bruxelles'],
      meatDis:  ['fegato', 'pesce', 'tonno', 'salmone', 'sardine', 'agnello'],
    }
  };

  function updateSuggestions() {
    const lang  = window.I18N?.current || 'fr';
    const sugg  = suggestionsLang[lang] || suggestionsLang.fr;
    renderSuggestions('favSuggestions',    sugg.fav,      favInput);
    renderSuggestions('dislikeVegSugg',    sugg.vegDis,   dvegInput);
    renderSuggestions('dislikeMeatSugg',   sugg.meatDis,  dmeatInput);
  }
  updateSuggestions();
  document.querySelectorAll('.lang-option').forEach(o => o.addEventListener('click', () => setTimeout(() => { updateSuggestions(); updateNav(); }, 100)));

  // ---- Age unit switching (bebe = months, others = years) ----
  function switchAgeUnit(profil) {
    const ageInput = document.getElementById('ageVal');
    const ageUnit  = document.getElementById('ageUnit');
    if (!ageInput || !ageUnit) return;

    if (profil === 'bebe') {
      ageInput.min   = '4';
      ageInput.max   = '24';
      ageInput.step  = '1';
      ageInput.value = data.age >= 4 && data.age <= 24 ? data.age : 9;
      data.age       = parseFloat(ageInput.value);
      data.ageUnit   = 'months';
      ageUnit.setAttribute('data-i18n', 'q2.months');
      ageUnit.textContent = t('q2.months', 'mois');
    } else {
      ageInput.min   = '1';
      ageInput.max   = '18';
      ageInput.step  = '1';
      ageInput.value = data.age >= 1 && data.age <= 18 ? data.age : 7;
      data.age       = parseFloat(ageInput.value);
      data.ageUnit   = 'years';
      ageUnit.setAttribute('data-i18n', 'q2.years');
      ageUnit.textContent = t('q2.years', 'ans');
    }
  }

  // ---- Sports by profile ----
  const sportsByProfile = {
    bebe: [],
    enfant: [
      { val: 'foot',         emoji: '⚽', i18n: 'sp.football' },
      { val: 'natation',     emoji: '🏊', i18n: 'sp.swim'    },
      { val: 'danse',        emoji: '💃', i18n: 'sp.dance'   },
      { val: 'gym',          emoji: '🤸', i18n: 'sp.gym'     },
      { val: 'arts_martiaux',emoji: '🥋', i18n: 'sp.martial' },
      { val: 'velo',         emoji: '🚴', i18n: 'sp.bike'    },
      { val: 'basket',       emoji: '🏀', i18n: 'sp.basket'  },
      { val: 'tennis',       emoji: '🎾', i18n: 'sp.tennis'  },
      { val: 'judo',         emoji: '🥋', i18n: 'sp.judo'    },
      { val: 'equitation',   emoji: '🐴', i18n: 'sp.equitation'},
      { val: 'patinage',     emoji: '⛸️', i18n: 'sp.patinage'},
      { val: 'escalade',     emoji: '🧗', i18n: 'sp.escalade'},
    ],
    ado: [
      { val: 'foot',         emoji: '⚽', i18n: 'sp.football'   },
      { val: 'natation',     emoji: '🏊', i18n: 'sp.swim'       },
      { val: 'danse',        emoji: '💃', i18n: 'sp.dance'      },
      { val: 'gym',          emoji: '🤸', i18n: 'sp.gym'        },
      { val: 'arts_martiaux',emoji: '🥋', i18n: 'sp.martial'   },
      { val: 'velo',         emoji: '🚴', i18n: 'sp.bike'       },
      { val: 'basket',       emoji: '🏀', i18n: 'sp.basket'     },
      { val: 'rugby',        emoji: '🏉', i18n: 'sp.rugby'      },
      { val: 'tennis',       emoji: '🎾', i18n: 'sp.tennis'     },
      { val: 'escalade',     emoji: '🧗', i18n: 'sp.escalade'   },
      { val: 'athletisme',   emoji: '🏃', i18n: 'sp.athletisme' },
      { val: 'handball',     emoji: '🤾', i18n: 'sp.handball'   },
      { val: 'volleyball',   emoji: '🏐', i18n: 'sp.volleyball' },
    ],
    famille: [
      { val: 'foot',         emoji: '⚽', i18n: 'sp.football'  },
      { val: 'natation',     emoji: '🏊', i18n: 'sp.swim'      },
      { val: 'danse',        emoji: '💃', i18n: 'sp.dance'     },
      { val: 'gym',          emoji: '🤸', i18n: 'sp.gym'       },
      { val: 'velo',         emoji: '🚴', i18n: 'sp.bike'      },
      { val: 'basket',       emoji: '🏀', i18n: 'sp.basket'    },
      { val: 'tennis',       emoji: '🎾', i18n: 'sp.tennis'    },
      { val: 'escalade',     emoji: '🧗', i18n: 'sp.escalade'  },
      { val: 'arts_martiaux',emoji: '🥋', i18n: 'sp.martial'   },
      { val: 'rugby',        emoji: '🏉', i18n: 'sp.rugby'     },
    ]
  };

  function renderSports(profil) {
    const container = document.getElementById('sportsOptions');
    const wrap      = document.getElementById('sportsSectionWrap');
    if (!container) return;

    const sports = sportsByProfile[profil] || sportsByProfile.enfant;

    // Hide sports & activity level sections for babies (not relevant for infants)
    if (wrap) wrap.style.display = profil === 'bebe' ? 'none' : '';
    const actWrap = document.getElementById('activitySectionWrap');
    if (actWrap) actWrap.style.display = profil === 'bebe' ? 'none' : '';
    // For babies: auto-set activity to 'eveil' so Gemini adapts the plan
    if (profil === 'bebe') { data.activity = 'eveil'; data.sports = []; }

    // Clear and re-render
    container.innerHTML = '';
    if (profil !== 'bebe') data.sports = [];

    sports.forEach(s => {
      const btn = document.createElement('button');
      btn.className   = 'sub-opt';
      btn.dataset.val = s.val;
      const label = t(s.i18n, s.val);
      btn.innerHTML = `${s.emoji} <span>${label}</span>`;
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
        data.sports = [...container.querySelectorAll('.sub-opt.selected')].map(b => b.dataset.val);
      });
      container.appendChild(btn);
    });
  }

  // ---- Option card selection ----
  function initOptionCards(containerId, key, multi = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        if (!multi) container.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        card.classList.toggle('selected', !multi || !card.classList.contains('selected'));
        if (!multi) {
          data[key] = card.dataset.value;
          // When profil changes, update age unit and sports list
          if (key === 'profil') {
            switchAgeUnit(data.profil);
            renderSports(data.profil);
          }
        } else {
          const vals = [];
          container.querySelectorAll('.option-card.selected').forEach(c => vals.push(c.dataset.value));
          data[key] = vals[0] || null;
        }
      });
    });
  }

  initOptionCards('profileOptions', 'profil');
  initOptionCards('genderOptions',  'genre');
  initOptionCards('goalOptions',    'objectif');
  initOptionCards('timeGrid',       'cookTime');

  // ---- People: preset buttons + free input ----
  const peopleInput = document.getElementById('peopleVal');
  document.querySelectorAll('#peoplePresets .people-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#peoplePresets .people-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const n = parseInt(btn.dataset.n);
      data.people = n;
      if (peopleInput) peopleInput.value = n;
    });
  });
  if (peopleInput) {
    peopleInput.addEventListener('input', e => {
      const n = parseInt(e.target.value) || 4;
      data.people = n;
      document.querySelectorAll('#peoplePresets .people-preset').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.n) === n);
      });
    });
  }

  // ---- Sub-options (multi-select) ----
  function initSubOptions(containerId, key) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.sub-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
        data[key] = [...container.querySelectorAll('.sub-opt.selected')].map(b => b.dataset.val);
      });
    });
    // Single select for diet
    if (key === 'diet') {
      container.querySelectorAll('.sub-opt').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.sub-opt').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          data.diet = btn.dataset.val;
          // Show/hide "autre" free text
          const otherWrap = document.getElementById('dietOtherWrap');
          if (otherWrap) otherWrap.style.display = btn.dataset.val === 'autre' ? '' : 'none';
        });
      });
    }
  }
  initSubOptions('dietOptions',     'diet');
  initSubOptions('activityOptions', 'activity');
  // Note: sportsOptions is rendered dynamically, click handlers added in renderSports()

  // ---- Cuisine cards ----
  document.querySelectorAll('.cuisine-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('selected');
      data.cuisines = [...document.querySelectorAll('.cuisine-card.selected')].map(c => c.dataset.val);
    });
  });

  // ---- Budget cards ----
  document.querySelectorAll('.budget-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.budget-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      data.budget = card.dataset.val;
    });
  });

  // ---- Allergen chips ----
  document.querySelectorAll('.allergen-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      data.allergens = [...document.querySelectorAll('.allergen-chip.selected')].map(c => c.dataset.val);
    });
  });

  // ---- Health cards ----
  document.querySelectorAll('.health-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('selected');
      data.healthConditions = [...document.querySelectorAll('.health-card.selected')].map(c => c.dataset.val);
    });
  });

  // ---- Plan : read from localStorage (already chosen before questionnaire) ----
  const _sub = JSON.parse(localStorage.getItem('brocoliSubscription') || 'null');
  data.selectedPlan = _sub?.plan
    || localStorage.getItem('brocoliSelectedPlan')
    || new URLSearchParams(window.location.search).get('plan')
    || 'free';

  // Pre-select profil from URL
  const urlProfil = new URLSearchParams(window.location.search).get('profil');
  if (urlProfil) {
    const card = document.querySelector(`.option-card[data-value="${urlProfil}"]`);
    if (card) {
      card.classList.add('selected');
      data.profil = urlProfil;
      switchAgeUnit(data.profil);
      renderSports(data.profil);
    }
  }

  // ---- Name & notes inputs ----
  document.getElementById('q_name')?.addEventListener('input', e => data.name = e.target.value);
  document.getElementById('q_healthNote')?.addEventListener('input', e => data.healthNote = e.target.value);
  document.getElementById('q_otherAllergy')?.addEventListener('input', e => data.otherAllergy = e.target.value);

  // ---- Navigation ----
  const steps     = document.querySelectorAll('.q-step');
  const prevBtn   = document.getElementById('qPrev');
  const nextBtn   = document.getElementById('qNext');
  const nextLabel = document.getElementById('qNextLabel');
  const stepLabel = document.getElementById('qStepLabel');
  const stepCount = document.getElementById('qStepCountText');
  const progress  = document.getElementById('qProgressFill');

  // Step dot definitions using i18n keys
  const STEP_DEFS = [
    { emoji:'👤', i18n:'step.profil',    fb:'Profil'     },
    { emoji:'📋', i18n:'step.infos',     fb:'Infos'      },
    { emoji:'😋', i18n:'step.gouts',     fb:'Goûts'      },
    { emoji:'🚫', i18n:'step.refus',     fb:'Refus'      },
    { emoji:'⚠️', i18n:'step.allergies', fb:'Allergies'  },
    { emoji:'🏥', i18n:'step.sante',     fb:'Santé'      },
    { emoji:'🗂️', i18n:'step.pratique',  fb:'Pratique'   },
    { emoji:'✅', i18n:'step.resume',    fb:'Résumé'     },
  ];

  function buildStepsNav() {
    const nav = document.getElementById('qStepsNav');
    if (!nav) return;

    nav.innerHTML = '';
    STEP_DEFS.forEach((s, i) => {
      if (i > 0) {
        const line = document.createElement('div');
        line.className = `q-step-line ${i < currentStep ? 'done' : ''}`;
        line.id = `line-${i}`;
        nav.appendChild(line);
      }
      const dot = document.createElement('div');
      dot.className = `q-step-dot ${i + 1 < currentStep ? 'done' : i + 1 === currentStep ? 'active' : ''}`;
      dot.id = `dot-${i+1}`;
      const label = t(s.i18n, s.fb);
      dot.innerHTML = `<div class="q-step-dot-circle">${i + 1 < currentStep ? '✓' : s.emoji}</div><span class="q-step-dot-label">${label}</span>`;
      dot.addEventListener('click', () => { if (i + 1 < currentStep) goToStep(i + 1); });
      nav.appendChild(dot);
    });
  }

  function updateNav() {
    // Steps
    steps.forEach((s, i) => s.classList.toggle('active', i + 1 === currentStep));

    // Dots & lines
    document.querySelectorAll('.q-step-dot').forEach((d, i) => {
      d.className = `q-step-dot ${i + 1 < currentStep ? 'done' : i + 1 === currentStep ? 'active' : ''}`;
      const circle = d.querySelector('.q-step-dot-circle');
      if (circle) circle.textContent = i + 1 < currentStep ? '✓' : STEP_DEFS[i]?.emoji || (i+1);
      const lbl = d.querySelector('.q-step-dot-label');
      if (lbl && STEP_DEFS[i]) lbl.textContent = t(STEP_DEFS[i].i18n, STEP_DEFS[i].fb);
    });
    document.querySelectorAll('.q-step-line').forEach((l, i) => {
      l.className = `q-step-line ${i + 1 < currentStep ? 'done' : ''}`;
    });

    // Progress
    const pct = (currentStep / TOTAL_STEPS) * 100;
    if (progress) progress.style.width = `${pct}%`;
    const stepWord = t('q.step', 'Étape');
    const ofWord   = t('q.of',   'sur');
    if (stepLabel) stepLabel.textContent = `${stepWord} ${currentStep} ${ofWord} ${TOTAL_STEPS}`;
    if (stepCount) stepCount.textContent = `${stepWord} ${currentStep} ${ofWord} ${TOTAL_STEPS} · ${t('q.almost', 'Presque fini ! 🎉')}`;

    // Buttons
    if (prevBtn) prevBtn.style.display = currentStep > 1 ? '' : 'none';

    if (nextLabel) {
      if (currentStep === TOTAL_STEPS) {
        nextLabel.textContent = t('q.generate', '🥦 Générer mon programme — 4 semaines !');
        nextBtn?.classList.add('btn-secondary');
        nextBtn?.classList.remove('btn-primary');
      } else {
        nextLabel.textContent = t('q.continue', 'Continuer →');
        nextBtn?.classList.add('btn-primary');
        nextBtn?.classList.remove('btn-secondary');
      }
    }

    // Step 8 summary
    if (currentStep === TOTAL_STEPS) buildSummary();
  }

  window.goToStep = function(n) {
    currentStep = n;
    updateNav();
    window.scrollTo(0, 0);
  };

  prevBtn?.addEventListener('click', () => { if (currentStep > 1) { currentStep--; updateNav(); window.scrollTo(0,0); } });

  nextBtn?.addEventListener('click', () => {
    if (!validateStep(currentStep)) return;

    if (currentStep === TOTAL_STEPS) {
      submitQuestionnaire();
    } else {
      currentStep++;
      updateNav();
      window.scrollTo(0, 0);
    }
  });

  function validateStep(step) {
    switch(step) {
      case 1:
        if (!data.profil) { showToast?.(t('q.select.profil', 'Sélectionnez un type de profil'), 'warning'); return false; }
        break;
      case 2:
        // Age/weight/height are always set via stepper
        break;
    }
    return true;
  }

  function buildSummary() {
    data.favorites   = favInput.getTags();
    data.dislikeVeg  = dvegInput.getTags();
    data.dislikeMeat = dmeatInput.getTags();
    data.dislikeOther= dotherInput.getTags();

    // Profil labels from i18n
    const profilLabels = {
      bebe:    t('s.profil.bebe',    'Bébé (4-24 mois)'),
      enfant:  t('s.profil.enfant',  'Enfant (2-12 ans)'),
      ado:     t('s.profil.ado',     'Adolescent (12-18 ans)'),
      famille: t('s.profil.famille', 'Famille entière'),
    };
    // Goal labels from i18n (existing keys)
    const goalLabels = {
      sante:    t('goal.sante',    'Manger sainement'),
      maintien: t('goal.maintien', 'Maintenir le poids'),
      prise:    t('goal.prise',    'Prendre du poids'),
      perte:    t('goal.perte',    'Perdre du poids'),
    };

    setText('sType', profilLabels[data.profil] || '—');
    setText('sName', data.name || t('s.yourChild', 'votre enfant'));

    // Age display: months for baby, years for others
    if (data.profil === 'bebe') {
      setText('sAge', `${data.age} ${t('q2.months', 'mois')}`);
    } else {
      setText('sAge', `${data.age} ${t('q2.years', 'ans')}`);
    }

    setText('sBody',    `${data.weight} kg · ${data.height} cm (IMC: ${calcBMI(data.weight, data.height)})`);
    setText('sGoal',    goalLabels[data.objectif] || '—');
    setText('sAllergens', data.allergens.length ? data.allergens.join(', ') : t('s.noAllergen', 'Aucune allergie renseignée'));
    const allDislikes = [...data.dislikeVeg, ...data.dislikeMeat, ...data.dislikeOther];
    setText('sDislikes', allDislikes.length ? allDislikes.join(', ') : t('s.noDislikes', 'Aucun'));
    setText('sHealth',  data.healthConditions.length ? data.healthConditions.join(', ') : t('s.noHealth', 'Aucune condition particulière'));
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  async function submitQuestionnaire() {
    // Gather all data
    data.favorites    = favInput.getTags();
    data.dislikeVeg   = dvegInput.getTags();
    data.dislikeMeat  = dmeatInput.getTags();
    data.dislikeOther = dotherInput.getTags();
    data.lang         = window.I18N?.current || 'fr';
    // Add sportsOther to sports if filled
    const sportsOtherEl = document.getElementById('sportsOther');
    if (sportsOtherEl?.value.trim()) data.sportsOther = sportsOtherEl.value.trim();
    // Effective diet
    if (data.diet === 'autre' && data.dietOther.trim()) data.diet = data.dietOther.trim();

    // Save profile (multi-child aware)
    if (window.CHILDREN) {
      // If this is a brand-new user (no children yet), create the first child
      if (!CHILDREN.getActiveChildId()) {
        CHILDREN.addChild(data);
      } else {
        CHILDREN.saveProfile(data);
      }
    } else {
      localStorage.setItem('brocoliProfile', JSON.stringify(data));
    }
    localStorage.setItem('brocoliSelectedPlan', data.selectedPlan);

    if (nextLabel) nextLabel.textContent = t('q.loading', '⏳ Préparation…');
    if (nextBtn) nextBtn.disabled = true;

    // Payment is already done (via Stripe before questionnaire) — go straight to analysis
    window.location.href = 'analyse.html';
  }

  // Init
  renderSports('enfant'); // default sports (will update when profil selected)
  buildStepsNav();
  updateNav();
});
