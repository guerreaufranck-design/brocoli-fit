// ============================================================
// BROCOLI.FIT — Stripe Session Verification (Vercel Serverless)
// ============================================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    const paid = session.payment_status === 'paid' || session.status === 'complete';

    res.status(200).json({
      success: paid,
      plan:           session.metadata?.plan || null,
      customerId:     session.customer       || null,
      subscriptionId: session.subscription   || null,
      email:          session.customer_details?.email || null,
    });
  } catch (err) {
    console.error('Verify error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
