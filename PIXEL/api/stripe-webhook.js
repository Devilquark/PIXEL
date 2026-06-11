const Stripe = require('stripe');

// Lit le body brut (nécessaire pour la vérification de signature Stripe)
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', chunk => { buf += chunk; });
    req.on('end',  () => resolve(buf));
    req.on('error', reject);
  });
}

// Envoie l'email de confirmation via Brevo
async function sendConfirmationEmail(email, name, items, total, shipping, sessionId) {
  const firstName = name.split(' ')[0] || 'Player';
  const shippingHtml = shipping
    ? `<p style="margin:0;color:#999;font-size:13px;">
        ${shipping.line1}${shipping.line2 ? ', ' + shipping.line2 : ''}<br>
        ${shipping.postal_code} ${shipping.city}, ${shipping.country}
       </p>`
    : '';

  const itemsHtml = items.map(i => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #1a1a1a;color:#fff;font-family:monospace;font-size:13px;">
        ${i.description || i.price?.product_data?.name || 'Article PIXEL'}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #1a1a1a;color:#fff;font-family:monospace;font-size:13px;text-align:right;">
        ${((i.amount_total || 0) / 100).toFixed(2)} €
      </td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td>
      <table width="560" cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:560px;">

        <!-- HEADER -->
        <tr>
          <td style="padding-bottom:32px;border-bottom:1px solid #1a1a1a;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:12px;height:12px;background:#FF2D55;margin-right:10px;"></td>
                <td style="padding-left:10px;color:#fff;font-size:18px;font-family:monospace;letter-spacing:0.2em;font-weight:bold;">PIXEL</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TITLE -->
        <tr>
          <td style="padding:32px 0 8px;">
            <p style="margin:0;color:#FF2D55;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">// COMMANDE CONFIRMÉE</p>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:8px;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-family:monospace;letter-spacing:0.1em;">SAVE FILE CREATED.</h1>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:32px;">
            <p style="margin:0;color:#666;font-size:13px;line-height:1.6;">
              ${firstName}, ta commande est enregistrée.<br>
              On t'envoie un email dès l'expédition.
            </p>
          </td>
        </tr>

        <!-- ORDER ID -->
        <tr>
          <td style="padding:16px;background:#111;border-left:3px solid #FF2D55;margin-bottom:24px;display:block;">
            <p style="margin:0;color:#666;font-size:10px;letter-spacing:0.2em;">ORDER ID</p>
            <p style="margin:4px 0 0;color:#fff;font-size:12px;font-family:monospace;">${sessionId.slice(-12).toUpperCase()}</p>
          </td>
        </tr>

        <!-- ITEMS -->
        <tr><td style="padding-top:24px;">
          <p style="margin:0 0 12px;color:#666;font-size:10px;letter-spacing:0.2em;">ARTICLES</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${itemsHtml}
            <tr>
              <td style="padding:16px 0 0;color:#fff;font-family:monospace;font-size:14px;font-weight:bold;letter-spacing:0.1em;">TOTAL</td>
              <td style="padding:16px 0 0;color:#FF2D55;font-family:monospace;font-size:16px;font-weight:bold;text-align:right;">${total} €</td>
            </tr>
          </table>
        </td></tr>

        <!-- SHIPPING -->
        ${shipping ? `
        <tr><td style="padding-top:24px;">
          <p style="margin:0 0 8px;color:#666;font-size:10px;letter-spacing:0.2em;">LIVRAISON</p>
          ${shippingHtml}
          <p style="margin:4px 0 0;color:#555;font-size:11px;">2–4 jours ouvrés</p>
        </td></tr>` : ''}

        <!-- FOOTER -->
        <tr><td style="padding-top:40px;border-top:1px solid #1a1a1a;margin-top:32px;">
          <p style="margin:0;color:#333;font-size:11px;line-height:1.6;">
            Des questions ? Réponds à cet email.<br>
            <span style="color:#555;">PIXEL · Made in France · Édition limitée</span>
          </p>
          <p style="margin:12px 0 0;color:#FF2D55;font-size:10px;letter-spacing:0.2em;">↑ ↑ ↓ ↓ ← → ← → P I X E L</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender:  { name: 'PIXEL', email: 'noreply@pixelwear.fr' },
      to:      [{ email, name }],
      subject: `✓ Commande confirmée — PIXEL #${sessionId.slice(-6).toUpperCase()}`,
      htmlContent: html
    })
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe        = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig           = req.headers['stripe-signature'];

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items']
      });

      const email    = full.customer_details?.email;
      const name     = full.customer_details?.name || 'Player';
      const items    = full.line_items?.data || [];
      const total    = ((full.amount_total || 0) / 100).toFixed(2);
      const shipping = full.shipping_details?.address;

      if (email) {
        await sendConfirmationEmail(email, name, items, total, shipping, session.id);
        console.log('Confirmation sent to', email);
      }
    } catch (err) {
      console.error('Email error:', err.message);
    }
  }

  res.json({ received: true });
};

module.exports.config = {
  api: { bodyParser: false }
};
