// ============================================================
// BROCOLI.FIT — Build script (Vercel)
// Génère config.js depuis les variables d'environnement
// ============================================================

const fs = require('fs');

const apiKey      = process.env.GEMINI_API_KEY   || '';
const supabaseUrl = process.env.SUPABASE_URL      || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!apiKey)      console.warn('⚠️  GEMINI_API_KEY non défini — le site fonctionnera sans IA');
if (!supabaseUrl) console.warn('⚠️  SUPABASE_URL non défini');
if (!supabaseKey) console.warn('⚠️  SUPABASE_ANON_KEY non défini');

const content = `// Auto-généré au build — ne pas modifier manuellement
window.BROCOLI_CONFIG = {
  GEMINI_API_KEY:   '${apiKey}',
  GEMINI_MODEL:     'gemini-2.0-flash',
  GEMINI_API_URL:   'https://generativelanguage.googleapis.com/v1beta/models/',
  SUPABASE_URL:     '${supabaseUrl}',
  SUPABASE_ANON_KEY:'${supabaseKey}',
  VERSION: '1.0.0',
  DEFAULT_LANG: 'fr',
  LANGUAGES: ['fr', 'en', 'de', 'it'],
  PLANS: {
    free:      { price: 0,  name: 'Découverte' },
    essential: { price: 9,  name: 'Essentiel'  },
    premium:   { price: 19, name: 'Premium'    }
  }
};
`;

fs.writeFileSync('config.js', content);
console.log('✅ config.js généré depuis les variables d\'environnement');
