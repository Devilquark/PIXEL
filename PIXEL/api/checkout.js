const Stripe = require('stripe');

// Catalogue produits autorisés (prix en centimes)
const CATALOG = {
  'T-Shirt CHEAT CODE':  { price: 3500, image: 'https://pixelwear.fr/products/photos/cheatcode-front.png' },
  'T-Shirt ORIGIN 01':   { price: 3500, image: 'https://pixelwear.fr/products/photos/origin-front.png' },
  'T-Shirt NEW GAME':    { price: 3500, image: 'https://pixelwear.fr/products/photos/newgame-front.png' },
  'T-Shirt PLAYER ONE':  { price: 3500, image: 'https://pixelwear.fr/products/photos/playerone-front.png' },
};

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://pixelwear.fr');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const { items, origin } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Panier vide' });
    }

    // Construire les line_items Stripe
    const line_items = items.map(item => {
      const product = CATALOG[item.name];
      if (!product) throw new Error(`Produit inconnu : ${item.name}`);

      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.name,
            description: `Taille ${item.size} · Édition limitée`,
            images: [product.image],
            metadata: { size: item.size }
          },
          unit_amount: product.price,
        },
        quantity: item.qty,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `https://pixelwear.fr/merci.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: origin || 'https://pixelwear.fr/products/tshirt-cheatcode.html',
      shipping_address_collection: { allowed_countries: ['FR', 'BE', 'CH', 'LU'] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'eur' },
            display_name: 'Livraison standard',
            delivery_estimate: { minimum: { unit: 'business_day', value: 2 }, maximum: { unit: 'business_day', value: 4 } },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 690, currency: 'eur' },
            display_name: 'Livraison express',
            delivery_estimate: { minimum: { unit: 'business_day', value: 1 }, maximum: { unit: 'business_day', value: 2 } },
          },
        },
      ],
      locale: 'fr',
      metadata: {
        brand: 'PIXEL',
        items_count: items.length.toString(),
      },
    });

    res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
