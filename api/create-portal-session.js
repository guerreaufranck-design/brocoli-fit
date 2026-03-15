// ============================================================
// BROCOLI.FIT — Stripe Customer Portal (Vercel Serverless)
// Permet aux utilisateurs de gérer leur abonnement, changer
// de moyen de paiement, ou résilier leur abonnement.
// ============================================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { customerId } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: 'customerId requis' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe non configuré' });
  }

  const baseUrl = process.env.APP_URL || 'https://brocoli-fit.vercel.app';

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/account.html`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
