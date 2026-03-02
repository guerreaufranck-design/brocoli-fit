// ============================================================
// BROCOLI.FIT — Stripe Checkout Session (Vercel Serverless)
// ============================================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  essential: process.env.STRIPE_PRICE_ESSENTIAL,
  premium:   process.env.STRIPE_PRICE_PREMIUM,
};

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan, locale = 'fr' } = req.body;

  if (!PRICES[plan]) {
    return res.status(400).json({ error: 'Plan invalide' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe non configuré' });
  }

  const baseUrl = process.env.APP_URL || `https://${process.env.VERCEL_URL}` || 'http://localhost:3456';

  const stripeLocale = { fr: 'fr', en: 'en', de: 'de', it: 'it' }[locale] || 'fr';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICES[plan], quantity: 1 }],
      success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url:  `${baseUrl}/questionnaire.html?plan=${plan}&cancelled=1`,
      locale: stripeLocale,
      allow_promotion_codes: true,
      metadata: { plan },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
