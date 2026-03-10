// ============================================================
// BROCOLI.FIT — Configuration publique
// ✅ Ce fichier ne contient AUCUNE clé secrète.
// La clé Gemini est gérée côté serveur dans /api/gemini.js
// via la variable d'environnement GEMINI_API_KEY sur Vercel.
// ============================================================

window.BROCOLI_CONFIG = {
  // ── Supabase Auth ─────────────────────────────────────────
  // Récupérez ces valeurs dans : supabase.com → votre projet → Settings → API
  SUPABASE_URL:      'https://vjiiglfzqbzgzvbphtot.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqaWlnbGZ6cWJ6Z3p2YnBodG90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0Nzc4ODUsImV4cCI6MjA4ODA1Mzg4NX0.9_9fbhenyJ7QFYxrfZUN-bzyaKfHYaJmn0sfeNkB0EI',

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
