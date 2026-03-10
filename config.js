// ============================================================
// BROCOLI.FIT — Configuration publique
// ✅ Ce fichier ne contient AUCUNE clé secrète.
// La clé Gemini est gérée côté serveur dans /api/gemini.js
// via la variable d'environnement GEMINI_API_KEY sur Vercel.
// ============================================================

window.BROCOLI_CONFIG = {
  // Version
  VERSION: '1.1.0',

  // Langue par défaut
  DEFAULT_LANG: 'fr',

  // Langues supportées
  LANGUAGES: ['fr', 'en', 'de', 'it'],

  // Plans tarifaires
  PLANS: {
    free:      { price: 0,  name: 'Découverte' },
    essential: { price: 9,  name: 'Essentiel'  },
    premium:   { price: 19, name: 'Premium'    }
  }
};
