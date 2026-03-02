// ============================================================
// BROCOLI.FIT — Build script (Vercel)
// Génère config.js depuis les variables d'environnement
// ============================================================

const fs = require('fs');

const apiKey = process.env.GEMINI_API_KEY || '';

if (!apiKey) {
  console.warn('⚠️  GEMINI_API_KEY non défini — le site fonctionnera sans IA');
}

const content = `// Auto-généré au build — ne pas modifier manuellement
window.BROCOLI_CONFIG = {
  GEMINI_API_KEY: '${apiKey}',
  GEMINI_MODEL:   'gemini-2.5-flash',
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
  VERSION: '1.0.0',
  DEFAULT_LANG: 'fr',
  LANGUAGES: ['fr', 'en', 'de', 'it'],
  PLANS: {
    free:      { price: 0,     name: 'Découverte' },
    essential: { price: 9.90,  name: 'Essentiel'  },
    premium:   { price: 19.90, name: 'Premium'    }
  }
};
`;

fs.writeFileSync('config.js', content);
console.log('✅ config.js généré depuis les variables d\'environnement');
