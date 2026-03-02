// ============================================================
// BROCOLI.FIT — Questionnaire multi-étapes
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const TOTAL_STEPS = 8;
  let currentStep = 1;

  // State
  const data = {
    profil: null, name: '', genre: null, age: 7, weight: 28, height: 128,
    objectif: null, diet: 'omnivore', favorites: [], cuisines: [],
    dislikeVeg: [], dislikeMeat: [], dislikeOther: [],
    allergens: [], otherAllergy: '',
    healthConditions: [], healthNote: '',
    people: '4', budget: null, cookTime: null, activity: null, sports: [],
    selectedPlan: 'free'
  };

  // ---- Number inputs (age, weight, height) ----
  document.getElementById('ageVal')?.addEventListener('input',    e => { data.age    = parseFloat(e.target.value) || 7; });
  document.getElementById('weightVal')?.addEventListener('input', e => { data.weight = parseFloat(e.target.value) || 28; });
  document.getElementById('heightVal')?.addEventListener('input', e => { data.height = parseFloat(e.target.value) || 128; });

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
  // Update suggestions when language changes
  document.querySelectorAll('.lang-option').forEach(o => o.addEventListener('click', () => setTimeout(updateSuggestions, 100)));

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
        });
      });
    }
  }
  initSubOptions('dietOptions',     'diet');
  initSubOptions('activityOptions', 'activity');
  initSubOptions('sportsOptions',   'sports');

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

  // ---- Plan selection ----
  document.querySelectorAll('.plan-sel-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.plan-sel-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      data.selectedPlan = card.dataset.plan;
    });
  });
  // Default: essential
  document.querySelector('.plan-sel-card[data-plan="essential"]')?.classList.add('selected');
  data.selectedPlan = 'essential';

  // Pre-select from URL
  const urlPlan = new URLSearchParams(window.location.search).get('plan');
  if (urlPlan) {
    document.querySelectorAll('.plan-sel-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`.plan-sel-card[data-plan="${urlPlan}"]`)?.classList.add('selected');
    data.selectedPlan = urlPlan;
  }

  // Pre-select profil from URL
  const urlProfil = new URLSearchParams(window.location.search).get('profil');
  if (urlProfil) {
    const card = document.querySelector(`.option-card[data-value="${urlProfil}"]`);
    if (card) { card.classList.add('selected'); data.profil = urlProfil; }
  }

  // ---- Name input ----
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

  function buildStepsNav() {
    const nav = document.getElementById('qStepsNav');
    if (!nav) return;

    const stepDefs = [
      { emoji:'👤', label:'Profil' },
      { emoji:'📋', label:'Infos'  },
      { emoji:'😋', label:'Goûts'  },
      { emoji:'🚫', label:'Refus'  },
      { emoji:'⚠️', label:'Allergies'},
      { emoji:'🏥', label:'Santé'  },
      { emoji:'🗂️', label:'Pratique'},
      { emoji:'✅', label:'Résumé' },
    ];

    nav.innerHTML = '';
    stepDefs.forEach((s, i) => {
      if (i > 0) {
        const line = document.createElement('div');
        line.className = `q-step-line ${i < currentStep ? 'done' : ''}`;
        line.id = `line-${i}`;
        nav.appendChild(line);
      }
      const dot = document.createElement('div');
      dot.className = `q-step-dot ${i + 1 < currentStep ? 'done' : i + 1 === currentStep ? 'active' : ''}`;
      dot.id = `dot-${i+1}`;
      dot.innerHTML = `<div class="q-step-dot-circle">${i + 1 < currentStep ? '✓' : s.emoji}</div><span class="q-step-dot-label">${s.label}</span>`;
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
      if (circle) circle.textContent = i + 1 < currentStep ? '✓' : ['👤','📋','😋','🚫','⚠️','🏥','🗂️','✅'][i];
    });
    document.querySelectorAll('.q-step-line').forEach((l, i) => {
      l.className = `q-step-line ${i + 1 < currentStep ? 'done' : ''}`;
    });

    // Progress
    const pct = (currentStep / TOTAL_STEPS) * 100;
    if (progress) progress.style.width = `${pct}%`;
    if (stepLabel) stepLabel.textContent = `Étape ${currentStep} sur ${TOTAL_STEPS}`;
    if (stepCount) stepCount.textContent = `Étape ${currentStep} sur ${TOTAL_STEPS} · Presque fini ! 🎉`;

    // Buttons
    if (prevBtn) prevBtn.style.display = currentStep > 1 ? '' : 'none';

    if (nextLabel) {
      if (currentStep === TOTAL_STEPS) {
        nextLabel.textContent = '🥦 Générer mon plan — 4 semaines !';
        nextBtn?.classList.add('btn-secondary');
        nextBtn?.classList.remove('btn-primary');
      } else {
        nextLabel.textContent = 'Continuer →';
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
      // Submit
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
        if (!data.profil) { showToast?.('Sélectionnez un type de profil', 'warning'); return false; }
        break;
      case 2:
        // Age/weight/height are always set via stepper
        break;
    }
    return true;
  }

  function buildSummary() {
    data.favorites  = favInput.getTags();
    data.dislikeVeg = dvegInput.getTags();
    data.dislikeMeat= dmeatInput.getTags();
    data.dislikeOther = dotherInput.getTags();

    const profilLabels = {bebe:'Bébé (4m-2ans)',enfant:'Enfant (2-10ans)',ado:'Adolescent (10-16ans)',famille:'Famille entière'};
    const goalLabels   = {sante:'Manger sainement',maintien:'Maintenir le poids',prise:'Prendre du poids',perte:'Perdre du poids'};

    setText('sType',    profilLabels[data.profil] || '—');
    setText('sName',    data.name || 'votre enfant');
    setText('sAge',     `${data.age} ans`);
    setText('sBody',    `${data.weight} kg · ${data.height} cm (IMC: ${calcBMI(data.weight, data.height)})`);
    setText('sGoal',    goalLabels[data.objectif] || '—');
    setText('sAllergens', data.allergens.length ? data.allergens.join(', ') : 'Aucune allergie renseignée');
    const allDislikes = [...data.dislikeVeg, ...data.dislikeMeat, ...data.dislikeOther];
    setText('sDislikes', allDislikes.length ? allDislikes.join(', ') : 'Aucun');
    setText('sHealth',  data.healthConditions.length ? data.healthConditions.join(', ') : 'Aucune condition particulière');
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function submitQuestionnaire() {
    // Gather all data
    data.favorites   = favInput.getTags();
    data.dislikeVeg  = dvegInput.getTags();
    data.dislikeMeat = dmeatInput.getTags();
    data.dislikeOther= dotherInput.getTags();

    // Save profile
    localStorage.setItem('brocoliProfile', JSON.stringify(data));
    localStorage.setItem('brocoliSelectedPlan', data.selectedPlan);

    // Set language in profile
    data.lang = window.I18N?.current || 'fr';

    if (nextLabel) nextLabel.textContent = '⏳ Préparation…';
    if (nextBtn) nextBtn.disabled = true;

    // Check if user is logged in
    const user = window.AUTH?.getUser();
    if (!user && data.selectedPlan !== 'free') {
      // Redirect to login first
      window.location.href = `login.html?signup=true&plan=${data.selectedPlan}&redirect=analyse.html`;
    } else {
      // Go to analysis
      window.location.href = 'analyse.html';
    }
  }

  // Init nav
  buildStepsNav();
  updateNav();
});
