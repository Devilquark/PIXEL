export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BREVO_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_KEY) return res.status(500).json({ error: 'Config manquante' });

  async function getCount() {
    try {
      const r = await fetch('https://api.brevo.com/v3/contacts?limit=1', {
        headers: { 'api-key': BREVO_KEY }
      });
      const d = await r.json();
      return d.count || 0;
    } catch { return 0; }
  }

  // GET — retourne le compteur global
  if (req.method === 'GET') {
    return res.json({ count: await getCount() });
  }

  // POST — ajoute l'email dans Brevo
  if (req.method === 'POST') {
    const { email } = req.body || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    const r = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        attributes: { SOURCE: 'waitlist-pixel' },
        updateEnabled: false
      })
    });

    const duplicate = r.status === 400;
    const count = await getCount();
    return res.json({ count, duplicate });
  }

  return res.status(405).end();
}
