// ============================================================
// BROCOLI.FIT — Gemini AI Proxy (Vercel Serverless Function)
// La clé API reste côté serveur, jamais exposée au client.
// ============================================================

module.exports = async (req, res) => {
  // ── CORS ──────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Clé API ───────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Gemini] GEMINI_API_KEY manquante dans les variables d\'environnement Vercel');
    return res.status(500).json({ error: 'GEMINI_API_KEY non configurée. Ajoutez-la dans les variables d\'environnement Vercel.' });
  }

  // ── Paramètres de la requête ───────────────────────────────
  const { prompt, jsonMode = true } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Le champ "prompt" est requis.' });
  }

  const model   = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url     = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature:     0.7,
      maxOutputTokens: 65536,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {})
    }
  };

  // ── Appel Gemini ──────────────────────────────────────────
  console.log(`[Gemini] → ${model} | jsonMode=${jsonMode} | prompt=${prompt.length} chars`);

  try {
    const geminiRes = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const errMsg = data?.error?.message || `HTTP ${geminiRes.status}`;
      console.error(`[Gemini] Erreur API: ${errMsg}`);
      return res.status(geminiRes.status).json({ error: errMsg });
    }

    const tokensIn  = data?.usageMetadata?.promptTokenCount     || '?';
    const tokensOut = data?.usageMetadata?.candidatesTokenCount || '?';
    const finishReason = data?.candidates?.[0]?.finishReason || 'UNKNOWN';
    console.log(`[Gemini] ✓ ${tokensIn} tokens in / ${tokensOut} tokens out | finishReason=${finishReason}`);

    if (finishReason === 'MAX_TOKENS') {
      console.error('[Gemini] ⚠️ Réponse tronquée (MAX_TOKENS) — le JSON est probablement incomplet');
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[Gemini] Erreur réseau:', err.message);
    return res.status(500).json({ error: `Erreur réseau: ${err.message}` });
  }
};
