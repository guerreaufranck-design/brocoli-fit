// ============================================================
// BROCOLI.FIT — Stripe Webhook Handler (Vercel Serverless)
// ============================================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Needed to read raw body for signature verification
export const config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig     = req.headers['stripe-signature'];
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log(`✅ Paiement confirmé — plan: ${session.metadata?.plan}, customer: ${session.customer}`);
      // TODO: Quand Supabase sera intégré, mettre à jour le profil utilisateur ici
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log(`❌ Abonnement annulé — customer: ${sub.customer}`);
      // TODO: Révoquer accès premium dans Supabase
      break;
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object;
      console.log(`⚠️ Paiement échoué — customer: ${inv.customer}`);
      // TODO: Notifier l'utilisateur par email via Supabase
      break;
    }
    default:
      console.log(`Event reçu: ${event.type}`);
  }

  res.status(200).json({ received: true });
};
