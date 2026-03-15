// ============================================================
// BROCOLI.FIT — Gemini AI Integration
// ============================================================

/**
 * Calcule les besoins caloriques journaliers d'après les équations OMS/Schofield.
 * @param {object} profile  — profil questionnaire
 * @returns {{ target, breakfast, lunch, snack, dinner }} en kcal
 */
function _computeDailyCalories(profile) {
  const profil  = profile.profil || 'enfant';
  const age     = parseFloat(profile.age)    || 0;   // mois si bebe, ans sinon
  const weight  = parseFloat(profile.weight) || 0;
  const height  = parseFloat(profile.height) || 0;
  const isMale  = profile.genre === 'm';
  const activity = profile.activity || 'leger';

  // PAL (Physical Activity Level)
  const pal = { sedentaire: 1.2, leger: 1.375, modere: 1.55, actif: 1.725 }[activity] || 1.375;

  let bmr = 0;

  if (profil === 'bebe' || age < 1) {
    // Nourrisson : kcal/kg/j (OMS) — age en mois
    const ageMonths = profil === 'bebe' ? age : age * 12;
    const kcalPerKg = ageMonths < 6 ? 105 : 80;
    const w = weight > 0 ? weight : (ageMonths < 6 ? 5.5 : 8);
    bmr = kcalPerKg * w;
    // Les nourrissons n'ont pas de PAL significatif
    const t = Math.round(bmr);
    return { target: t, breakfast: Math.round(t * 0.25), lunch: Math.round(t * 0.30), snack: Math.round(t * 0.15), dinner: Math.round(t * 0.30) };
  }

  if (age < 3) {
    // WHO 1–3 ans
    bmr = isMale ? 60.9 * weight - 54 : 61.0 * weight - 51;
  } else if (age < 10) {
    // WHO 3–10 ans
    bmr = isMale ? 22.7 * weight + 495 : 22.5 * weight + 499;
  } else if (age < 18) {
    // WHO 10–18 ans
    bmr = isMale ? 17.5 * weight + 651 : 12.2 * weight + 746;
  } else {
    // Mifflin-St Jeor (18+)
    bmr = isMale
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
  }

  // Sécurité : valeurs minimales physiologiques
  const minKcal = age < 3 ? 900 : age < 6 ? 1100 : age < 10 ? 1300 : age < 14 ? 1600 : 1800;
  const target = Math.max(Math.round(bmr * pal), minKcal);

  // Distribution standard des repas
  return {
    target,
    breakfast: Math.round(target * 0.25),
    lunch:     Math.round(target * 0.35),
    snack:     Math.round(target * 0.10),
    dinner:    Math.round(target * 0.30),
  };
}

const GEMINI = {

  async call(prompt, jsonMode = true, timeoutMs = 300000) {
    // ── Appel via la route serverless Vercel /api/gemini ──────
    // La clé API reste sécurisée côté serveur.
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
      res = await fetch('/api/gemini', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt, jsonMode }),
        signal:  controller.signal
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        const timeoutErr = new Error((window.I18N?.t('gemini.timeout')) || 'La génération a pris trop de temps. Réessayez ou simplifiez le profil.');
        timeoutErr.type = 'timeout';
        throw timeoutErr;
      }
      throw fetchErr;
    }
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const finishReason = data.candidates?.[0]?.finishReason || '';

    if (jsonMode) {
      // 1. Direct parse
      try { return JSON.parse(text); } catch {}
      // 2. Markdown code block
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) { try { return JSON.parse(match[1]); } catch {} }
      // 3. Raw JSON extraction (first { to last })
      const s = text.indexOf('{'), e = text.lastIndexOf('}');
      if (s !== -1 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch {} }
      // 4. Truncated JSON repair: close open brackets/braces
      if (s !== -1 && text.length > 500) {
        let truncated = text.slice(s);
        // Remove trailing incomplete value (after last comma or colon)
        truncated = truncated.replace(/,\s*"[^"]*"?\s*:?\s*[^,\]}]*$/, '');
        truncated = truncated.replace(/,\s*\{[^}]*$/, '');
        truncated = truncated.replace(/,\s*\[[^\]]*$/, '');
        truncated = truncated.replace(/,\s*"[^"]*$/, '');
        // Count and close open brackets
        let opens = 0, closesNeeded = '';
        for (const ch of truncated) {
          if (ch === '{') opens++;
          else if (ch === '}') opens--;
          else if (ch === '[') { opens++; closesNeeded += ']'; }
          else if (ch === ']') { opens--; closesNeeded = closesNeeded.slice(0, -1); }
        }
        // Close remaining open structures
        while (opens > 0) { truncated += '}'; opens--; }
        try { return JSON.parse(truncated); } catch {}
      }
      console.error('Gemini raw response (first 500 chars):', text.slice(0, 500));
      console.error('Gemini finishReason:', finishReason);
      throw new Error(
        finishReason === 'MAX_TOKENS'
          ? ((window.I18N?.t('gemini.truncated')) || 'La réponse IA a été tronquée. Réessayez.')
          : ((window.I18N?.t('gemini.invalidResp')) || 'Réponse IA invalide. Réessayez.')
      );
    }
    return text;
  },

  buildNutritionPrompt(profile) {
    const culture = window.I18N ? window.I18N.getCulturalProfile() : CULTURAL_PROFILES_FALLBACK.fr;
    const lang    = window.I18N ? window.I18N.current : 'fr';

    const profil = profile.profil || 'enfant';
    const age    = parseFloat(profile.age) || 0;
    const weight = parseFloat(profile.weight) || 0;
    const height = parseFloat(profile.height) || 0;
    const gender = profile.genre === 'm' ? 'garçon' : profile.genre === 'f' ? 'fille' : 'non précisé';

    // BMI calculé côté prompt pour contextualisation
    const bmi = (height > 0 && weight > 0)
      ? (weight / Math.pow(height / 100, 2)).toFixed(1)
      : 'non calculable';

    // ── Référentiels nutritionnels par tranche d'âge (ANSES / OMS / PNNS) ──
    let nutritionRef;
    if (profil === 'bebe' || age < 1) {
      nutritionRef = `
══════════════════════════════════════
RÉFÉRENTIEL NUTRITIONNEL — NOURRISSON (< 1 an) | Sources : OMS, ANSES, SFP
══════════════════════════════════════
• Allaitement ou lait maternisé : base exclusive jusqu'à 6 mois révolus
• Diversification : jamais avant 4 mois, idéalement vers 6 mois
• 4-6 mois : purées lisses, légumes puis fruits, 1 aliment nouveau tous les 3 jours
• 6-9 mois : textures lissées/mixées, légumes + viande/poisson 10-20 g/j
• 9-12 mois : morceaux mous, finger foods, viande/poisson 20-30 g/j
• Besoins caloriques : 500-700 kcal/j (dont lait)
• Protéines : 1.5 g/kg/j
• Calcium : 400-600 mg/j (lait maternel/maternisé couvre)
• Fer : indispensable dès 6 mois — viande rouge, légumineuses, céréales enrichies
• Vitamine D : systématique 400-800 UI/j (prescription médicale)
• INTERDITS ABSOLUS : sel, sucre ajouté, miel (botulisme), lait de vache entier avant 1 an, noix entières, aliments durs
• TEXTURES : strictement adaptées à l'âge (lisse < 6 mois, écrasé 6-9 mois, morceaux mous 9-12 mois)
• Repas : 5 prises/j (biberon + 2-3 repas + goûter selon âge)`;
    } else if (age < 3) {
      nutritionRef = `
══════════════════════════════════════
RÉFÉRENTIEL NUTRITIONNEL — TOUT-PETIT 1-3 ans | Sources : ANSES 2021, PNNS4
══════════════════════════════════════
• Besoins énergétiques : 1000-1400 kcal/j (selon activité)
• Protéines : 1.14 g/kg/j → ~${Math.round((weight || 12) * 1.14)} g/j pour ce profil
• Lipides : 40-50% des AET (NE PAS réduire les graisses chez le tout-petit !)
• Glucides : 45-55% des AET
• Calcium : 500 mg/j → 3 produits laitiers/j (yaourt, fromage, lait de croissance)
• Fer : 7 mg/j → 1 portion viande/poisson/œuf par jour
• Zinc : 4 mg/j
• Vitamine D : 400-600 UI/j (supplémentation recommandée)
• Oméga-3 (DHA) : 100 mg/j → 1-2 fois/sem poisson gras (saumon, sardine)
• PORTIONS adaptées à ce profil :
  - Viande/poisson/œuf : 20-30 g par repas
  - Féculents : 30-50 g cuits par repas
  - Légumes : 80-100 g par repas (purée, petits dés)
  - Produits laitiers : 3-4 x/j (yaourt 125 g, fromage 20 g)
  - Fruits : 1-2 portions/j (compote sans sucre, fruit écrasé)
• Lait de croissance (1er ou 2e âge enrichi) recommandé jusqu'à 3 ans
• 4 repas structurés, pas de grignotage entre repas
• Eau seule entre les repas, pas de jus de fruits`;
    } else if (age < 6) {
      nutritionRef = `
══════════════════════════════════════
RÉFÉRENTIEL NUTRITIONNEL — ENFANT 3-5 ans (maternelle) | Sources : ANSES 2021, PNNS4
══════════════════════════════════════
• Besoins énergétiques : 1200-1500 kcal/j (filles 1200, garçons 1300-1500)
• Protéines : 1.0 g/kg/j → ~${Math.round((weight || 18) * 1.0)} g/j pour ce profil
• Lipides : 35-40% des AET (huile de colza + olive pour équilibre oméga)
• Calcium : 700 mg/j → 3 produits laitiers/j (yaourt, lait demi-écrémé, fromage)
• Fer : 7 mg/j → viande/volaille 1x/j, légumineuses 2x/sem, céréales enrichies
• Zinc : 5 mg/j
• Vitamine C : 45 mg/j (kiwi, agrumes, poivron) → favorise absorption du fer
• Fibres : 15 g/j → légumes, fruits, légumineuses, céréales semi-complètes
• Oméga-3 : EPA+DHA 250 mg/j → poisson 1-2x/sem
• PORTIONS adaptées à ce profil :
  - Viande/poisson/œuf : 30-40 g par repas (1 portée)
  - Féculents : 50-80 g cuits par repas (selon activité)
  - Légumes : 100-150 g par repas (cuits ou crus)
  - Produits laitiers : 3 x/j
  - Fruits : 1-2 portions/j
• 4 repas : petit-déjeuner, déjeuner, goûter, dîner (goûter OBLIGATOIRE)
• Goûter idéal : 1 fruit + 1 laitage (pas de biscuits industriels)
• Textures familiales, présentation ludique pour favoriser l'acceptation`;
    } else if (age < 10) {
      nutritionRef = `
══════════════════════════════════════
RÉFÉRENTIEL NUTRITIONNEL — ENFANT 6-9 ans (primaire) | Sources : ANSES 2021, PNNS4
══════════════════════════════════════
• Besoins énergétiques : 1400-1800 kcal/j
  - Filles : 1400-1600 kcal/j ; Garçons : 1500-1800 kcal/j
  - Activité sportive régulière : +200-400 kcal les jours d'entraînement
• Protéines : 0.9-1.0 g/kg/j → ~${Math.round((weight || 26) * 0.95)} g/j pour ce profil
• Glucides : 50-55% (privilégier index glycémique bas : légumineuses, céréales complètes)
• Lipides : 35-40% (acides gras essentiels indispensables au cerveau)
• Calcium : 900 mg/j → 3 laitages/j (période de croissance osseuse accélérée)
• Fer : 8-10 mg/j → viande rouge 2x/sem, légumineuses 2x/sem, épinards, tofu
• Zinc : 6 mg/j → viande, fruits de mer, graines de courge
• Magnésium : 130-200 mg/j → oléagineux, légumineuses, chocolat noir
• Vitamine D : 600 UI/j
• Iode : 90 µg/j → poisson, produits laitiers
• PORTIONS adaptées à ce profil :
  - Viande/poisson/œuf : 50 g par repas (augmenter les jours de sport)
  - Féculents : 80-120 g cuits par repas (base des repas)
  - Légumes : 150-200 g par repas (au moins 2x/j)
  - Fruits : 2-3 portions/j
  - Produits laitiers : 3 x/j
• 4 repas structurés — JAMAIS sauter le petit-déjeuner (impact concentr. scolaire)
• Petit-déjeuner idéal : glucides complexes + protéines + fruit (ex: flocons avoine + œuf + orange)
• Eau : 1.2-1.4 L/j minimum (eau seule, pas jus ni sodas)`;
    } else if (age < 14) {
      nutritionRef = `
══════════════════════════════════════
RÉFÉRENTIEL NUTRITIONNEL — PRÉ-ADOLESCENT 10-13 ans | Sources : ANSES 2021, PNNS4
══════════════════════════════════════
• Besoins énergétiques (pic de croissance pubertaire) :
  - Filles : 1800-2100 kcal/j
  - Garçons : 2000-2300 kcal/j
  - Sport intensif : +300-500 kcal les jours d'entraînement
• Protéines : 1.0-1.2 g/kg/j → ~${Math.round((weight || 42) * 1.1)} g/j pour ce profil
• Calcium : 1200-1300 mg/j ⚠️ CRITIQUE — pic de minéralisation osseuse à cet âge !
  → 4 produits laitiers/j impératifs (déficit = ostéoporose future)
  → Alternatives : tofu enrichi, amandes, brocolis, sardines en boîte avec arêtes
• Fer :
  - Garçons : 11 mg/j
  - Filles : 13 mg/j (si règles → besoins augmentés)
  → viande rouge 2-3x/sem, légumineuses 3x/sem, épinards, lentilles
• Zinc : 8-10 mg/j (croissance, immunité, hormones)
• Magnésium : 280-300 mg/j (fonction musculaire, humeur, concentration)
• Vitamine D : 600-800 UI/j
• Iode : 120 µg/j
• Oméga-3 : EPA+DHA 250-500 mg/j → poisson gras 2x/sem
• PORTIONS adaptées à ce profil :
  - Viande/poisson/œuf : 60-80 g par repas
  - Féculents : 100-130 g cuits par repas (glucides = carburant de la croissance)
  - Légumes : 200-250 g par repas
  - Produits laitiers : 4 x/j
• Ne JAMAIS sauter de repas en période de croissance accélérée
• Attention aux régimes restrictifs souvent initiés à cet âge (risque de carences)
• Eau : 1.6-1.8 L/j`;
    } else {
      nutritionRef = `
══════════════════════════════════════
RÉFÉRENTIEL NUTRITIONNEL — ADOLESCENT 14-18 ans | Sources : ANSES 2021, PNNS4
══════════════════════════════════════
• Besoins énergétiques :
  - Filles : 2000-2500 kcal/j (+ 300-500 kcal si sport)
  - Garçons : 2500-3200 kcal/j (+ 500-800 kcal si sport intensif)
• Protéines :
  - Filles : 46-50 g/j (1.0 g/kg/j)
  - Garçons : 52-60 g/j (1.0-1.2 g/kg/j)
  - Sport de force/endurance : jusqu'à 1.4-1.6 g/kg/j
  → ~${Math.round((weight || 60) * (profile.genre === 'm' ? 1.1 : 1.0))} g/j pour ce profil
• Calcium : 1200-1300 mg/j (finalisation de la masse osseuse — dernière chance !)
  → 4 produits laitiers/j : lait, yaourt, fromage
• Fer :
  - Filles : 15-16 mg/j ⚠️ (menstruations = pertes importantes, risque d'anémie)
  - Garçons : 11-12 mg/j
  → viande rouge 2-3x/sem, lentilles, épinards, tofu, céréales enrichies + vitamine C
• Zinc : Filles 9 mg/j, Garçons 11 mg/j (acné, immunité, fertilité)
• Magnésium : 380-410 mg/j (stress scolaire, sport, humeur)
• Iode : 130 µg/j
• Vitamine D : 600-1000 UI/j
• Oméga-3 (EPA+DHA) : 500 mg/j → saumon, maquereau, sardine 2-3x/sem
• PORTIONS adaptées à ce profil :
  - Viande/poisson/œuf : 80-120 g par repas (selon sexe et activité)
  - Féculents : 120-180 g cuits par repas (glucides complexes en base)
  - Légumes : 200-300 g par repas
  - Produits laitiers : 4 x/j
  - Oléagineux (noix, amandes) : 30 g/j comme collation
• Alertes spécifiques adolescents :
  - Attention aux régimes hypocaloriques restrictifs (risque de TCA)
  - Éviter les boissons énergisantes (caféine + sucre → troubles du sommeil)
  - Petit-déjeuner obligatoire pour les résultats scolaires
  - Hydratation : 2.0-2.5 L/j (eau)
${gender === 'fille' ? '• Filles spécifique : surveiller statut en fer à chaque bilan sanguin annuel' : '• Garçons spécifique : apport protéique post-entraînement dans les 30 min'}`;
    }

    // Ajustement calorique si sport
    const sportsBonus = (profile.sports && profile.sports.length > 0 && profile.activity !== 'sedentaire')
      ? `\n• BONUS SPORT (${(profile.sports || []).join(', ')}) : ajouter 200-500 kcal les jours d'entraînement (glucides + protéines)`
      : '';

    const profileLines = [
      `- Type de profil : ${profil}`,
      `- Prénom : ${profile.name || 'Votre enfant'}`,
      `- Sexe : ${gender}`,
      `- Âge : ${profile.age || '?'} ${profil === 'bebe' ? 'mois' : 'ans'}`,
      `- Poids : ${profile.weight || '?'} kg`,
      `- Taille : ${profile.height || '?'} cm`,
      `- IMC calculé : ${bmi} ${bmi !== 'non calculable' ? '(à contextualiser selon les courbes de croissance de l\'enfant)' : ''}`,
      `- Objectif parental : ${profile.objectif || 'alimentation saine équilibrée'}`,
      `- Régime alimentaire : ${profile.diet || 'omnivore'}`,
      `- Allergènes EXCLUS (OBLIGATOIRE) : ${(profile.allergens || []).join(', ') || 'aucun'}`,
      `- Conditions médicales : ${(profile.healthConditions || []).join(', ') || 'aucune'}`,
      `- Note médicale du parent : ${profile.healthNote || 'aucune'}`,
      `- Aliments appréciés : ${(profile.favorites || []).join(', ') || 'non précisé'}`,
      `- Légumes refusés : ${(profile.dislikeVeg || []).join(', ') || 'aucun'}`,
      `- Viandes/poissons refusés : ${(profile.dislikeMeat || []).join(', ') || 'aucun'}`,
      `- Autres aliments refusés : ${(profile.dislikeOther || []).join(', ') || 'aucun'}`,
      `- Cuisines préférées : ${(profile.cuisines || []).join(', ') || 'familiale / française'}`,
      `- Temps de cuisine disponible : ${profile.cookTime || 'moyen (30-45 min)'}`,
      `- Niveau d'activité physique : ${profile.activity || 'léger'}`,
      `- Sports pratiqués : ${(profile.sports || []).join(', ') || 'aucun'}`,
    ].join('\n');

    const isPremium = profile.selectedPlan === 'premium';
    const isEssential = profile.selectedPlan === 'essential' || isPremium;

    // ── Calcul des calories spécifiques à ce profil ──────────────────────────
    const cal = _computeDailyCalories(profile);

    // ── Saison actuelle ─────────────────────────────────────────────────────
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    const currentMonth = monthNames[month];
    const season = month >= 2 && month <= 4 ? 'printemps' : month >= 5 && month <= 7 ? 'été' : month >= 8 && month <= 10 ? 'automne' : 'hiver';

    return `Tu es NutriBot, l'expert en nutrition pédiatrique de Brocoli.fit.
Tu dois générer un programme nutritionnel personnalisé COMPLET pour 1 SEMAINE (7 jours), RIGOUREUSEMENT adapté à l'âge, au poids, au sexe et aux besoins spécifiques de l'enfant ci-dessous.
⚠️ CHAQUE JOUR DOIT ÊTRE DIFFÉRENT — pas de copier-coller. Varie les protéines, les légumes, les féculents et les recettes chaque jour.

═══════════════════════════════════════════════
CONTEXTE CULTUREL — PAYS : ${culture.name}
═══════════════════════════════════════════════
Langue de réponse : ${culture.lang} (réponds TOUJOURS en ${culture.lang})
Structure des repas : ${culture.meals.join(' / ')}
Références guidelines : ${culture.guidelines}
${culture.culturalNotes}

═══════════════════════════════════════════════
SAISON & DISPONIBILITÉ DES PRODUITS
═══════════════════════════════════════════════
Mois actuel : ${currentMonth} | Saison : ${season}
⚠️ OBLIGATION : Utiliser UNIQUEMENT des fruits et légumes DE SAISON disponibles en ${season} dans le pays ${culture.name}.
Exemples de produits de saison en ${season} :
${season === 'hiver' ? '• Légumes : poireaux, choux, carottes, navets, courges, betteraves, endives, céleri, topinambour, panais\n• Fruits : pommes, poires, clémentines, oranges, kiwis, bananes' :
  season === 'printemps' ? '• Légumes : asperges, petits pois, radis, épinards, artichauts, fèves, laitue, carottes nouvelles\n• Fruits : fraises, cerises, rhubarbe, abricots (fin mai), pommes' :
  season === 'été' ? '• Légumes : tomates, courgettes, aubergines, poivrons, haricots verts, concombre, maïs, fenouil\n• Fruits : pêches, nectarines, abricots, melons, pastèques, figues, framboises, myrtilles' :
  '• Légumes : potimarron, courges, champignons, brocoli, chou-fleur, poireaux, épinards, betteraves\n• Fruits : pommes, poires, raisins, figues, noix, châtaignes, coings'}
⛔ NE PAS proposer de fraises en hiver, de courges en été, etc. — respecter la saisonnalité locale.

═══════════════════════════════════════════════
PROFIL DE L'ENFANT :
═══════════════════════════════════════════════
${profileLines}
${sportsBonus}

${nutritionRef}

╔═══════════════════════════════════════════════╗
║   ⚡ CALORIES CALCULÉES POUR CE PROFIL PRÉCIS  ║
╠═══════════════════════════════════════════════╣
║  Total journalier : ${String(cal.target).padEnd(6)} kcal/j            ║
║  Petit-déjeuner   : ~${String(cal.breakfast).padEnd(5)} kcal              ║
║  Déjeuner         : ~${String(cal.lunch).padEnd(5)} kcal              ║
║  Goûter           : ~${String(cal.snack).padEnd(5)} kcal              ║
║  Dîner            : ~${String(cal.dinner).padEnd(5)} kcal              ║
╚═══════════════════════════════════════════════╝
⛔ INTERDIT : Ne JAMAIS utiliser 1650 kcal ou toute autre valeur par défaut.
⛔ La valeur "daily_calories" dans le JSON DOIT être exactement ${cal.target}.
⛔ Chaque "total_calories" de journée DOIT être entre ${Math.round(cal.target * 0.9)} et ${Math.round(cal.target * 1.1)} kcal.

═══════════════════════════════════════════════
RÈGLES DE GÉNÉRATION OBLIGATOIRES :
═══════════════════════════════════════════════
1. ⛔ ALLERGÈNES : Ne JAMAIS inclure les allergènes listés — vérifier CHAQUE ingrédient
2. ⛔ REFUS : Ne JAMAIS inclure les aliments refusés listés
3. ✅ RÉGIME : Respecter strictement le type de régime (végétarien, vegan, halal, etc.)
4. ✅ PORTIONS : Utiliser EXACTEMENT les grammages du référentiel nutritionnel ci-dessus pour cet âge
5. ✅ CALORIES : daily_calories = ${cal.target} kcal/j OBLIGATOIRE (calculé d'après OMS/Schofield pour ce profil)
6. ✅ MICRONUTRIMENTS : Assurer les apports en calcium, fer, zinc, vitamine D selon le référentiel
7. ✅ VARIÉTÉ : Chaque jour doit avoir des repas DIFFÉRENTS — pas de répétition sur 7 jours
8. ✅ CULTURE : Respecter la structure de repas et les aliments culturellement adaptés
9. ✅ PRATICITÉ : Adapter à la réalité familiale (temps cuisine ${profile.cookTime || 'moyen'})
10. ⚠️ AVERTISSEMENT : Rappeler qu'il s'agit de recommandations générales, à valider avec un professionnel de santé

EXEMPLES DE REPAS ADAPTÉS À L'ÂGE :
${profil === 'bebe' || age < 1 ? `
- Petit-déjeuner : biberon lait maternisé + purée fruits (pomme-poire lisse, 80g)
- Déjeuner : purée courgette-poulet (légumes 80g + viande 20g) + fromage blanc
- Goûter : biberon ou compote pomme sans sucre
- Dîner : crème de légumes variés (carotte-patate douce) + fromage blanc entier` :
age < 3 ? `
- Petit-déjeuner : lait de croissance (200ml) + pain de mie complet (30g) + purée de fruits
- Déjeuner : steack haché (30g) + purée de légumes (100g) + yaourt entier
- Goûter : yaourt + petits biscuits ou fruit
- Dîner : soupe de légumes + oeuf mollet (1) + fromage frais` :
age < 6 ? `
- Petit-déjeuner : bol de lait + flocons d'avoine (40g) + fruit de saison
- Déjeuner : filet de poisson (40g) + riz (60g cuit) + haricots verts vapeur (120g) + yaourt
- Goûter : banane + verre de lait
- Dîner : soupe de légumes + 1 œuf + pain complet + fromage` :
age < 10 ? `
- Petit-déjeuner : bol de céréales complètes (40g) + lait (200ml) + orange
- Déjeuner : poulet rôti (50g) + pâtes complètes (100g cuit) + salade verte + yaourt
- Goûter : pomme + poignée d'amandes (15g) ou fromage
- Dîner : lentilles corail au curry (150g cuit) + riz (80g) + brocoli vapeur` :
age < 14 ? `
- Petit-déjeuner : pain complet (60g) + beurre de cacahuète (20g) + verre lait + kiwi
- Déjeuner : boeuf sauté (70g) + quinoa (120g cuit) + légumes rôtis (200g) + laitage
- Goûter : poignée d'amandes/noix (30g) + yaourt grec + fruits rouges
- Dîner : saumon (70g) + patate douce (150g) + épinards + fromage` : `
- Petit-déjeuner : flocons avoine (60g) + lait (250ml) + 2 œufs brouillés + fruit
- Déjeuner : viande rouge (100g) + pâtes complètes (150g cuit) + salade + laitage
- Collation post-sport : smoothie banane-lait + poignée amandes
- Dîner : saumon (100g) + riz (120g) + légumes variés + fromage`}

Génère une réponse JSON stricte avec cette structure EXACTE :
{
  "analysis": {
    "name": "prénom enfant",
    "age": ${age || 8},
    "bmi": ${bmi !== 'non calculable' ? bmi : 'null'},
    "bmi_status": "Normal / Insuffisance pondérale / Surpoids / Obésité",
    "daily_calories": ${cal.target},
    "summary": "Résumé en 2-3 phrases précises du profil nutritionnel et des enjeux de l'âge",
    "key_points": ["Besoin spécifique 1 lié à l'âge", "Micronutriment prioritaire", "Point comportement alimentaire"],
    "recommendations": ["Conseil pratique 1", "Conseil pratique 2", "Conseil pratique 3"],
    "macro_proteins_pct": 18,
    "macro_carbs_pct": 52,
    "macro_fats_pct": 30
  },
  "week": [
    // SEMAINE 1 — 7 jours (index 0-6)
    {
      "day": "Lundi",
      "total_calories": ${cal.target},
      "meals": [
        {
          "type": "Petit-déjeuner",
          "emoji": "🥣",
          "time": "7h30",
          "total_calories": ${cal.breakfast},
          "items": [
            {
              "name": "Flocons d'avoine",
              "quantity": "40g",
              "calories": ${Math.round(cal.breakfast / 2)}
            }
          ],
          "prep_time_min": 5,
          "recipe_hint": "Astuce de préparation"
        }
      ]
    },
    // ... Mardi à Dimanche
    // TOTAL : 7 objets jour dans ce tableau
  ]${isEssential ? `,
  "recipes": [
    {
      "name": "Nom de la recette",
      "emoji": "🍲",
      "for_meal": "Lundi déjeuner",
      "servings": ${profile.people || 4},
      "prep_min": 15,
      "cook_min": 20,
      "ingredients": [{"item": "poulet", "qty": "200g", "note": "bio de préférence"}],
      "steps": ["Étape 1 précise", "Étape 2 précise"],
      "substitutions": ["Si pas de poulet → dinde ou tofu selon régime"]
    }
  ]` : ''}${isPremium ? `,
  "shopping_list": {
    "week": 1,
    "persons": ${profile.people || 4},
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

IMPORTANT FINAL :
- Génère EXACTEMENT 7 jours (1 semaine, Lundi à Dimanche) dans le tableau "week" — 7 objets au total
- Chaque jour DOIT proposer des repas DIFFÉRENTS — varie les recettes chaque jour
- Quantités TOUJOURS en grammes (g) ou millilitres (ml) — jamais "1 portion" ou "au goût"
- Calories PRÉCISES par item et par repas
- Varie les sources protéiques (viande, poisson, œufs, légumineuses) chaque jour
- Inclure au moins 5 couleurs de légumes différents sur la semaine
- Les menus du week-end peuvent être légèrement plus élaborés (plus de temps de cuisine)
- Adapte STRICTEMENT au profil : allergènes, refus, temps cuisine`;
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

  /**
   * Builds a TEXT feedback prompt for the weekly check-in.
   * Returns a detailed, empathetic coaching response.
   */
  buildCheckinFeedbackPrompt(profile, checkinData, allCheckins, currentPlan) {
    const culture = window.I18N ? window.I18N.getCulturalProfile() : {};
    const lang = window.I18N ? window.I18N.current : 'fr';

    // Build history summary for trend analysis
    let historyBlock = '';
    if (allCheckins && allCheckins.length > 1) {
      const recent = allCheckins.slice(-8); // Last 8 check-ins
      historyBlock = `
═══════════════════════════════════
HISTORIQUE DES SUIVIS PRÉCÉDENTS (${recent.length} derniers) :
═══════════════════════════════════`;
      for (let i = 0; i < recent.length; i++) {
        const c = recent[i];
        historyBlock += `
Semaine ${c.week || i + 1} (${c.date ? new Date(c.date).toLocaleDateString('fr-FR') : '?'}) :
  - Poids: ${c.weight ? c.weight + ' kg' : '—'} | Taille: ${c.height ? c.height + ' cm' : '—'}
  - Humeur: ${c.mood || '—'} | Appétit: ${c.appetite || '—'}
  - Adhésion: ${c.adherence || '—'}%
  - Notes: ${c.notes || '—'}
  - Aliments refusés: ${c.newDislikes || '—'}`;
      }

      // Calculate trends
      const weights = recent.filter(c => c.weight).map(c => ({ week: c.week, w: parseFloat(c.weight) }));
      if (weights.length >= 2) {
        const first = weights[0].w;
        const last = weights[weights.length - 1].w;
        const delta = last - first;
        historyBlock += `

📊 TENDANCE POIDS : ${first} kg → ${last} kg (${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg sur ${weights.length} semaines)`;
      }

      const heights = recent.filter(c => c.height).map(c => ({ week: c.week, h: parseFloat(c.height) }));
      if (heights.length >= 2) {
        const first = heights[0].h;
        const last = heights[heights.length - 1].h;
        const delta = last - first;
        historyBlock += `
📊 TENDANCE TAILLE : ${first} cm → ${last} cm (${delta > 0 ? '+' : ''}${delta.toFixed(1)} cm sur ${heights.length} semaines)`;
      }

      const adherences = recent.filter(c => c.adherence != null).map(c => parseInt(c.adherence));
      if (adherences.length >= 2) {
        const avg = Math.round(adherences.reduce((s, a) => s + a, 0) / adherences.length);
        const trend = adherences[adherences.length - 1] - adherences[0];
        historyBlock += `
📊 ADHÉSION MOYENNE : ${avg}% (tendance : ${trend > 0 ? '↗ en hausse' : trend < 0 ? '↘ en baisse' : '→ stable'})`;
      }
    }

    // Profile weight goal analysis
    let goalAnalysis = '';
    if (profile.targetWeight && checkinData.weight) {
      const target = parseFloat(profile.targetWeight);
      const current = parseFloat(checkinData.weight);
      const start = parseFloat(profile.weight) || current;
      const totalNeeded = Math.abs(target - start);
      const achieved = Math.abs(current - start);
      const remaining = Math.abs(target - current);
      const direction = target > start ? 'prise de poids' : 'perte de poids';
      goalAnalysis = `
═══════════════════════════════════
OBJECTIF POIDS :
═══════════════════════════════════
- Objectif : ${direction} de ${start} kg → ${target} kg
- Progression : ${achieved.toFixed(1)} kg sur ${totalNeeded.toFixed(1)} kg (${totalNeeded > 0 ? Math.round(achieved / totalNeeded * 100) : 100}%)
- Reste : ${remaining.toFixed(1)} kg`;
    }

    return `Tu es NutriBot, coach nutritionnel bienveillant et expert en nutrition pédiatrique de Brocoli.fit.
Réponds TOUJOURS en ${culture.lang || 'français'}.

═══════════════════════════════════
PROFIL DE L'ENFANT :
═══════════════════════════════════
- Prénom : ${profile?.name || 'Votre enfant'}
- Profil : ${profile?.profil || 'enfant'}
- Âge : ${profile?.age || '?'} ${profile?.profil === 'bebe' ? 'mois' : 'ans'}
- Poids initial : ${profile?.weight || '?'} kg
- Taille initiale : ${profile?.height || '?'} cm
- Objectif : ${profile?.objectif || 'alimentation saine et équilibrée'}
- Régime : ${profile?.diet || 'omnivore'}
- Allergènes : ${(profile?.allergens || []).join(', ') || 'aucun'}
- Aliments refusés : ${[...(profile?.dislikeVeg || []), ...(profile?.dislikeMeat || []), ...(profile?.dislikeOther || [])].join(', ') || 'aucun'}
${goalAnalysis}
${historyBlock}

═══════════════════════════════════
SUIVI DE CETTE SEMAINE :
═══════════════════════════════════
- Poids actuel : ${checkinData.weight ? checkinData.weight + ' kg' : 'non renseigné'}
- Taille actuelle : ${checkinData.height ? checkinData.height + ' cm' : 'non renseignée'}
- Humeur : ${checkinData.mood || 'non renseignée'} ${checkinData.mood === 'great' ? '(très bien 😄)' : checkinData.mood === 'ok' ? '(bien 🙂)' : checkinData.mood === 'meh' ? '(bof 😐)' : checkinData.mood === 'bad' ? '(mauvaise 😔)' : ''}
- Appétit : ${checkinData.appetite || 'non renseigné'} ${checkinData.appetite === 'great' ? '(excellent 😋)' : checkinData.appetite === 'normal' ? '(normal 👍)' : checkinData.appetite === 'low' ? '(faible 😕)' : checkinData.appetite === 'none' ? '(très faible 🙅)' : ''}
- Adhésion au plan : ${checkinData.adherence || '?'}%
- Commentaires du parent : "${checkinData.notes || 'aucun commentaire'}"
- Nouveaux aliments refusés : ${checkinData.newDislikes || 'aucun'}

═══════════════════════════════════
CE QUE TU DOIS FAIRE :
═══════════════════════════════════

Rédige un BILAN COMPLET et PERSONNALISÉ en format texte (PAS de JSON), structuré en sections. Sois bienveillant, encourageant mais honnête :

## 🎯 Bilan de la semaine
- Analyse l'évolution du poids et de la taille par rapport aux semaines précédentes
- Pour un enfant/bébé en croissance : la prise de poids est-elle normale pour l'âge ?
- Compare avec les courbes de croissance OMS si pertinent
- Mentionne si la tendance est rassurante ou si des ajustements sont nécessaires

## 💬 Réponse aux commentaires
- Si le parent a laissé des notes/commentaires, réponds-y DIRECTEMENT et de manière empathique
- Propose des solutions concrètes à chaque problème soulevé
- Si aucun commentaire : félicite le parent pour son suivi régulier

## 🍽️ Adaptations recommandées pour la semaine prochaine
Selon les données :
- Si adhésion < 50% → propose des repas PLUS SIMPLES et rapides, favorise les aliments préférés, réduis le nombre d'ingrédients
- Si adhésion 50-70% → quelques ajustements ciblés, garde les repas qui marchent
- Si adhésion > 70% → félicite et propose de nouveaux défis culinaires progressifs
- Si appétit faible → portions plus petites mais plus fréquentes, textures appétissantes, couleurs variées
- Si appétit bon → augmente légèrement les portions si croissance le nécessite
- Si humeur mauvaise → favorise aliments riches en tryptophane (banane, lait, avoine), magnésium (chocolat noir, amandes)
- Si nouveaux aliments refusés → propose 2-3 alternatives pour chaque aliment refusé

## 🔄 Suggestions d'alternatives
- Pour chaque aliment refusé, propose 2-3 substituts équivalents nutritionnellement
- Si des repas spécifiques n'ont pas fonctionné, propose des alternatives

## 💪 Encouragements et prochaines étapes
- Encourage le parent, souligne les points positifs
- Fixe 2-3 petits objectifs concrets pour la semaine à venir
- Rappelle qu'il est normal que l'enfant ait des phases de refus

IMPORTANT :
- Sois CONCRET (pas de conseils vagues), donne des exemples de repas/aliments
- Adapte le ton selon le profil (bébé = plus technique sur textures/portions, ado = plus de conseils sur autonomie)
- Ne dépasse PAS 500 mots au total
- NE fournis PAS de JSON, uniquement du texte formaté en markdown`;
  },

  /**
   * Builds a JSON prompt to regenerate/adapt the nutrition plan based on check-in data.
   * Only used for paid plans (essential/premium).
   */
  buildCheckinAdaptPrompt(profile, checkinData, allCheckins, currentPlan) {
    const culture = window.I18N ? window.I18N.getCulturalProfile() : {};

    // Gather all refused foods (original + new from check-ins)
    const allRefused = [
      ...(profile?.dislikeVeg || []),
      ...(profile?.dislikeMeat || []),
      ...(profile?.dislikeOther || []),
    ];
    if (allCheckins) {
      allCheckins.forEach(c => {
        if (c.newDislikes) {
          c.newDislikes.split(',').forEach(d => {
            const trimmed = d.trim();
            if (trimmed && !allRefused.includes(trimmed)) allRefused.push(trimmed);
          });
        }
      });
    }

    const cal = _computeDailyCalories(profile);

    return `Tu es NutriBot, expert en nutrition pédiatrique de Brocoli.fit.
Sur base du suivi hebdomadaire, génère un plan nutritionnel ADAPTÉ pour la semaine prochaine (7 jours).
Langue : ${culture.lang || 'français'}.

Profil : ${profile?.name || 'Enfant'}, ${profile?.age || '?'} ${profile?.profil === 'bebe' ? 'mois' : 'ans'}, ${profile?.weight || '?'} kg, objectif: ${profile?.objectif || 'alimentation saine'}
Régime : ${profile?.diet || 'omnivore'}
Allergènes EXCLUS : ${(profile?.allergens || []).join(', ') || 'aucun'}
TOUS les aliments refusés (y compris nouveaux) : ${allRefused.join(', ') || 'aucun'}
Calories cibles : ${cal.target} kcal/j

Données de suivi cette semaine :
- Poids: ${checkinData.weight || '?'} kg | Taille: ${checkinData.height || '?'} cm
- Humeur: ${checkinData.mood || '?'} | Appétit: ${checkinData.appetite || '?'}
- Adhésion: ${checkinData.adherence || '?'}%
- Notes: ${checkinData.notes || 'aucune'}

RÈGLES D'ADAPTATION :
${checkinData.adherence < 50 ? '⚠️ ADHÉSION FAIBLE → Simplifie les repas : max 4-5 ingrédients, temps préparation < 20min, favorise les goûts de l\'enfant' : ''}
${checkinData.appetite === 'low' || checkinData.appetite === 'none' ? '⚠️ APPÉTIT FAIBLE → Portions réduites de 20%, repas plus fréquents, textures appétissantes' : ''}
${checkinData.mood === 'bad' || checkinData.mood === 'meh' ? '⚠️ HUMEUR BASSE → Inclure aliments riches en tryptophane, magnésium, oméga-3' : ''}
- Exclure COMPLÈTEMENT les aliments refusés listés ci-dessus
- Calories journalières : exactement ${cal.target} kcal/j

Génère EXACTEMENT 7 jours (1 semaine, Lundi à Dimanche) au même format JSON que le plan original :
{
  "analysis": { "daily_calories": ${cal.target}, "summary": "Résumé des ajustements", ... },
  "week": [
    { "day": "Lundi", "total_calories": ${cal.target}, "meals": [...] },
    ... 7 jours (Lundi à Dimanche)
  ]
}`;
  },

  // Keep legacy method as alias
  buildCheckinPrompt(profile, checkinData, currentPlan) {
    return this.buildCheckinFeedbackPrompt(profile, checkinData, [], null);
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

  function setSubtitle(text) {
    const el = document.getElementById('anaSubtitle');
    if (el) el.textContent = text;
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Heartbeat: slowly creeps from startPct toward 99 while the promise is pending
  function startHeartbeat(startPct) {
    let pct = startPct;
    let stopped = false;
    const _t = k => (window.I18N?.t(k)) || null;
    const messages = [
      _t('gemini.hb1') || 'Génération de votre plan sur 7 jours… ✨',
      _t('gemini.hb2') || "Calcul des portions adaptées à l'âge…",
      _t('gemini.hb3') || 'Adaptation aux préférences culturelles…',
      _t('gemini.hb4') || 'Vérification des allergènes…',
      _t('gemini.hb5') || 'Création de la liste de courses…',
      _t('gemini.hb6') || 'Presque terminé, encore un instant… 🥦',
    ];
    let msgIdx = 0;
    const iv = setInterval(() => {
      if (stopped) { clearInterval(iv); return; }
      // Slow logarithmic creep toward 99
      pct = pct + (99 - pct) * 0.04;
      setProgress(pct);
      // Cycle through patience messages every ~5s
      msgIdx++;
      if (msgIdx % 5 === 0) {
        const mIdx = Math.floor(msgIdx / 5) % messages.length;
        setSubtitle(messages[mIdx]);
      }
    }, 1000);
    return () => { stopped = true; clearInterval(iv); };
  }

  try {
    // Animate steps 1-4 quickly (intro animation)
    const stepProgress = [15, 30, 50, 65, 90];
    for (let i = 0; i < 4; i++) {
      setStep(i, 'active');
      setProgress(stepProgress[i]);
      await delay(700);
      setStep(i, 'done');
    }
    setStep(4, 'active');
    setProgress(stepProgress[4]);
    setSubtitle((window.I18N?.t('gemini.generating')) || 'Génération de votre plan personnalisé… Cela peut prendre 1 à 2 minutes.');

    // Start heartbeat animation while Gemini works
    const stopHeartbeat = startHeartbeat(stepProgress[4]);

    // Build prompt
    const prompt = GEMINI.buildNutritionPrompt(profile);

    let result;
    try {
      // Call Gemini (up to 5 minutes timeout)
      result = await GEMINI.call(prompt, true, 300000);
    } catch (firstErr) {
      // Retry once on network/timeout error
      if (firstErr.name === 'AbortError' || firstErr.type === 'timeout' || firstErr.message.includes('fetch')) {
        setSubtitle((window.I18N?.t('gemini.retry')) || 'Nouvelle tentative en cours…');
        await delay(2000);
        result = await GEMINI.call(prompt, true, 300000);
      } else {
        throw firstErr;
      }
    } finally {
      stopHeartbeat();
    }

    setStep(4, 'done');
    setProgress(100);
    await delay(400);

    // Save result
    if (window.CHILDREN) { CHILDREN.savePlan(result); }
    else {
      localStorage.setItem('brocoliPlan', JSON.stringify(result));
      localStorage.setItem('brocoliPlanDate', new Date().toISOString());
    }

    // Redirect to plan page
    window.location.href = 'plan.html';

  } catch (err) {
    console.error('Gemini error:', err);
    const errEl = document.getElementById('anaError');
    const errMsg = document.getElementById('anaErrorMsg');
    if (errEl) errEl.style.display = '';
    if (errMsg) errMsg.textContent = err.message || (window.I18N?.t('gemini.errUnknown')) || 'Erreur inconnue. Vérifiez votre connexion.';
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
