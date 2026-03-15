// ============================================================
// BROCOLI.FIT — Configuration (EXAMPLE)
// Copiez ce fichier en config.js et renseignez votre clé API
// ⚠️ Ne jamais committer config.js avec une vraie clé API
// ============================================================

window.BROCOLI_CONFIG = {
  GEMINI_API_KEY: 'VOTRE_CLE_API_GEMINI_ICI',
  GEMINI_MODEL:   'gemini-2.5-flash',
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',

  VERSION: '1.0.0',
  DEFAULT_LANG: 'fr',
  LANGUAGES: ['fr', 'en', 'de', 'it'],

  PLANS: {
    free:      { price: 0,     name: 'Découverte' },
    essential: { price: 9.90,  name: 'Essentiel'  },
    premium:   { price: 14.90, name: 'Premium'    }
  }
};
