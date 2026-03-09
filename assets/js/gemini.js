// ============================================================
// BROCOLI.FIT — Gemini AI Integration
// ============================================================

const GEMINI = {

  async call(prompt, jsonMode = true) {
    const cfg = window.BROCOLI_CONFIG;
    const url = `${cfg.GEMINI_API_URL}${cfg.GEMINI_MODEL}:generateContent?key=${cfg.GEMINI_API_KEY}`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 32768,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {})
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (jsonMode) {
      try {
        return JSON.parse(text);
      } catch {
        // Try markdown code block
        const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) { try { return JSON.parse(match[1]); } catch {} }
        // Try raw JSON extraction (first { to last })
        const s = text.indexOf('{'), e = text.lastIndexOf('}');
        if (s !== -1 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch {} }
        throw new Error('Réponse IA invalide. Réessayez.');
      }
    }
    return text;
  },

  buildNutritionPrompt(profile) {
    const culture = window.I18N ? window.I18N.getCulturalProfile() : CULTURAL_PROFILES_FALLBACK.fr;
    const lang    = window.I18N ? window.I18N.current : 'fr';

    const profileLines = [
      `- Type de profil : ${profile.profil || 'enfant'}`,
      `- Prénom : ${profile.name || 'Votre enfant'}`,
      `- Sexe : ${profile.genre === 'm' ? 'Garçon' : profile.genre === 'f' ? 'Fille' : 'Non précisé'}`,
      `- Âge : ${profile.age || '?'} ans`,
      `- Poids : ${profile.weight || '?'} kg`,
      `- Taille : ${profile.height || '?'} cm`,
      `- Objectif : ${profile.objectif || 'alimentation saine'}`,
      `- Régime : ${profile.diet || 'omnivore'}`,
      `- Allergènes exclus : ${(profile.allergens || []).join(', ') || 'aucun'}`,
      `- Conditions médicales : ${(profile.healthConditions || []).join(', ') || 'aucune'}`,
      `- Note médicale : ${profile.healthNote || 'aucune'}`,
      `- Aliments aimés : ${(profile.favorites || []).join(', ') || 'non précisé'}`,
      `- Légumes refusés : ${(profile.dislikeVeg || []).join(', ') || 'aucun'}`,
      `- Viandes/poissons refusés : ${(profile.dislikeMeat || []).join(', ') || 'aucun'}`,
      `- Autres aliments refusés : ${(profile.dislikeOther || []).join(', ') || 'aucun'}`,
      `- Préférences cuisine : ${(profile.cuisines || []).join(', ') || 'familiale'}`,
      `- Personnes à table : ${profile.people || '4'}`,
      `- Budget hebdo : ${profile.budget || '50-100€'}`,
      `- Temps de cuisine : ${profile.cookTime || 'normal'}`,
      `- Activité physique : ${profile.activity || 'léger'}`,
      `- Sports : ${(profile.sports || []).join(', ') || 'aucun'}`,
    ].join('\n');

    const isPremium = profile.selectedPlan === 'premium';
    const isEssential = profile.selectedPlan === 'essential' || isPremium;

    return `Tu es NutriBot, l'expert en nutrition pédiatrique de Brocoli.fit.
Tu dois générer un programme nutritionnel personnalisé COMPLET pour 1 semaine (7 jours).

CONTEXTE CULTUREL — PAYS : ${culture.name}
Langue de réponse : ${culture.lang} (réponds TOUJOURS en ${culture.lang})
Repas structurés comme suit : ${culture.meals.join(' / ')}
Références nutritionnelles : ${culture.guidelines}
${culture.culturalNotes}

PROFIL DE L'ENFANT :
${profileLines}

RÈGLES ABSOLUES :
1. Ne JAMAIS inclure les allergènes listés ci-dessus
2. Ne JAMAIS inclure les aliments refusés
3. Respecter le régime alimentaire indiqué
4. Adapter les portions à l'âge et au poids
5. Respecter les conditions médicales
6. Utiliser la structure de repas culturelle du pays
7. Ce n'est pas un avis médical, toujours rappeler de consulter un professionnel

Génère une réponse JSON stricte avec cette structure EXACTE :
{
  "analysis": {
    "name": "prénom enfant",
    "age": 8,
    "bmi": 16.5,
    "bmi_status": "Normal",
    "daily_calories": 1650,
    "summary": "Résumé en 2-3 phrases du profil nutritionnel",
    "key_points": ["point 1", "point 2", "point 3"],
    "recommendations": ["conseil 1", "conseil 2", "conseil 3"],
    "macro_proteins_pct": 18,
    "macro_carbs_pct": 52,
    "macro_fats_pct": 30
  },
  "week": [
    {
      "day": "Lundi",
      "day_en": "Monday",
      "total_calories": 1650,
      "meals": [
        {
          "type": "Petit-déjeuner",
          "emoji": "🥣",
          "time": "7h30",
          "total_calories": 380,
          "items": [
            {
              "name": "Bol de céréales complètes",
              "quantity": "40g",
              "calories": 150,
              "allergens": [],
              "note": ""
            }
          ],
          "prep_time_min": 5,
          "recipe_hint": "Astuce rapide ou conseil de préparation"
        }
      ]
    }
  ]${isPremium ? `,
  "recipes": [
    {
      "name": "Nom de la recette",
      "emoji": "🍲",
      "for_meal": "Lundi déjeuner",
      "servings": 4,
      "prep_min": 15,
      "cook_min": 20,
      "ingredients": [{"item": "poulet", "qty": "200g", "note": ""}],
      "steps": ["Étape 1", "Étape 2"],
      "allergens": [],
      "substitutions": ["Si pas de poulet → dinde"]
    }
  ],
  "shopping_list": {
    "week": 1,
    "persons": 4,
    "categories": [
      {
        "category": "Fruits & Légumes",
        "emoji": "🥦",
        "items": [{"name": "Carottes", "qty": "500g", "approx_cost": "1.20€"}]
      }
    ],
    "estimated_total": "65€"
  }` : ''}
}

IMPORTANT : Génère les 7 jours complets avec TOUS les repas. Sois précis sur les quantités en grammes ou ml. Varie les repas chaque jour. Adapte tout au profil de l'enfant.`;
  },

  buildChatPrompt(userMessage, profile, planContext) {
    const culture = window.I18N ? window.I18N.getCulturalProfile() : {};
    const lang = window.I18N ? window.I18N.current : 'fr';

    return `Tu es NutriBot, l'assistant nutritionnel de Brocoli.fit, spécialisé en nutrition pédiatrique.
Réponds TOUJOURS en ${culture.lang || 'français'}, de façon bienveillante, claire et concise (max 3 paragraphes).
Tu ne donnes PAS de conseils médicaux — tu rappelles toujours de consulter un professionnel de santé pour les cas médicaux.

Contexte du profil enfant :
${profile ? `- ${profile.name || 'Enfant'}, ${profile.age || '?'} ans, ${profile.weight || '?'}kg` : 'Profil non disponible'}
${profile?.allergens?.length ? `- Allergènes exclus: ${profile.allergens.join(', ')}` : ''}
${profile?.healthConditions?.length ? `- Conditions: ${profile.healthConditions.join(', ')}` : ''}

${planContext ? `Contexte du plan actif: ${planContext}` : ''}

Question de l'utilisateur: ${userMessage}`;
  },

  buildCheckinPrompt(profile, checkinData, currentPlan) {
    const culture = window.I18N ? window.I18N.getCulturalProfile() : {};
    const lang = window.I18N ? window.I18N.current : 'fr';

    return `Tu es NutriBot, expert en nutrition pédiatrique de Brocoli.fit.
Sur base du suivi hebdomadaire ci-dessous, ajuste le plan nutritionnel pour la semaine prochaine.
Réponds en JSON structuré comme le plan original. Langue: ${culture.lang || 'français'}.

Profil: ${profile?.name || 'Enfant'}, ${profile?.age || '?'} ans, objectif: ${profile?.objectif || 'alimentation saine'}

Données de suivi cette semaine:
- Poids actuel: ${checkinData.weight || 'non renseigné'} kg
- Humeur: ${checkinData.mood || 'non renseigné'}
- Appétit: ${checkinData.appetite || 'non renseigné'}
- Adhésion au plan: ${checkinData.adherence || '?'}%
- Notes: ${checkinData.notes || 'aucune'}
- Nouveaux aliments refusés: ${checkinData.newDislikes || 'aucun'}

Ajustements à apporter:
- Si faible appétit → portions légèrement réduites, repas plus appétissants
- Si mauvaise humeur → aliments riches en tryptophane/magnésium
- Si mauvaise adhésion → simplifier les repas, favoriser les préférences
- Si nouveaux aliments refusés → les exclure complètement

Génère le plan ajusté pour la semaine prochaine avec le même format JSON.`;
  }
};

// ============================================================
// Analysis flow (used by analyse.html)
// ============================================================
async function runGeminiAnalysis(profile) {
  const steps = [
    document.getElementById('ls1'),
    document.getElementById('ls2'),
    document.getElementById('ls3'),
    document.getElementById('ls4'),
    document.getElementById('ls5'),
  ];

  function setStep(idx, state) {
    if (!steps[idx]) return;
    steps[idx].className = `loading-step ${state}`;
    const ic = steps[idx].querySelector('.loading-step-ic');
    if (!ic) return;
    if (state === 'done') ic.textContent = '✓';
    else if (state === 'active') ic.textContent = '⏳';
    else ic.textContent = idx + 1;
  }

  function setProgress(pct) {
    const fill = document.getElementById('anaProgressFill');
    const label = document.getElementById('anaProgressPct');
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = `${Math.round(pct)}%`;
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  try {
    // Animate steps with progress
    const stepProgress = [15, 30, 50, 65, 90];
    for (let i = 0; i < 4; i++) {
      setStep(i, 'active');
      setProgress(stepProgress[i]);
      await delay(700);
      setStep(i, 'done');
    }
    setStep(4, 'active');
    setProgress(stepProgress[4]);

    // Build prompt
    const prompt = GEMINI.buildNutritionPrompt(profile);

    // Call Gemini
    const result = await GEMINI.call(prompt, true);

    setStep(4, 'done');
    setProgress(100);
    await delay(400);

    // Save result
    localStorage.setItem('brocoliPlan', JSON.stringify(result));
    localStorage.setItem('brocoliPlanDate', new Date().toISOString());

    // Redirect to plan page
    window.location.href = 'plan.html';

  } catch (err) {
    console.error('Gemini error:', err);
    const errEl = document.getElementById('anaError');
    const errMsg = document.getElementById('anaErrorMsg');
    if (errEl) errEl.style.display = '';
    if (errMsg) errMsg.textContent = err.message || 'Erreur inconnue. Vérifiez votre connexion.';
  }
}

// Fallback cultural profiles if i18n not loaded
const CULTURAL_PROFILES_FALLBACK = {
  fr: {
    name: 'France', lang: 'Français',
    meals: ['Petit-déjeuner', 'Déjeuner', 'Goûter', 'Dîner'],
    guidelines: 'PNNS / ANSES',
    culturalNotes: 'France: 4 repas, goûter obligatoire pour les enfants, déjeuner repas principal.'
  }
};
