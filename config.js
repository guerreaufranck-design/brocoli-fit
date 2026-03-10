// ============================================================
// BROCOLI.FIT — Configuration publique
// ✅ Ce fichier ne contient AUCUNE clé secrète.
// La clé Gemini est gérée côté serveur dans /api/gemini.js
// via la variable d'environnement GEMINI_API_KEY sur Vercel.
// ============================================================

window.BROCOLI_CONFIG = {
  // ── Supabase Auth ─────────────────────────────────────────
  // Récupérez ces valeurs dans : supabase.com → votre projet → Settings → API
  SUPABASE_URL:      'VOTRE_SUPABASE_URL',       // ex: https://xxxx.supabase.co
  SUPABASE_ANON_KEY: 'VOTRE_SUPABASE_ANON_KEY',  // clé anon/public (safe à exposer)

  // ── App ────────────────────────────────────────────────────
  VERSION:      '1.1.0',
  DEFAULT_LANG: 'fr',
  LANGUAGES:    ['fr', 'en', 'de', 'it'],

  // ── Plans tarifaires ──────────────────────────────────────
  PLANS: {
    free:      { price: 0,  name: 'Découverte' },
    essential: { price: 9,  name: 'Essentiel'  },
    premium:   { price: 19, name: 'Premium'    }
  }
};
