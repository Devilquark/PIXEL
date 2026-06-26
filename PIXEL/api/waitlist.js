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

    const WAITLIST_LIST_ID = 2; // ID de la liste Brevo "Your first list"

    const r = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        listIds: [WAITLIST_LIST_ID],
        attributes: { SOURCE: 'waitlist-pixel' },
        updateEnabled: true
      })
    });

    const duplicate = r.status === 400;

    // Email de confirmation
    if (!duplicate) {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'PIXEL', email: 'hello@pixelwear.fr' },
          to: [{ email }],
          subject: '■ PIXEL — Tu es dans la liste.',
          htmlContent: `
            <div style="background:#111;color:#EEE9DE;font-family:monospace;padding:48px 32px;max-width:480px;margin:0 auto;">
              <p style="font-size:22px;letter-spacing:4px;margin-bottom:8px;">■ P I X E L</p>
              <p style="color:#888;font-size:11px;margin-bottom:32px;">The Hidden Tribute.</p>
              <p style="font-size:14px;line-height:1.8;">Accès enregistré.<br>Tu seras le premier informé du drop.</p>
              <hr style="border:none;border-top:1px solid #222;margin:32px 0;">
              <p style="color:#555;font-size:10px;line-height:1.7;">
                Tu reçois cet email car tu t'es inscrit sur <a href="https://pixelwear.fr" style="color:#555;">pixelwear.fr</a>.<br>
                © 2026 PIXEL —
                <a href="https://pixelwear.fr/legal/mentions-legales.html" style="color:#555;">Mentions légales</a> ·
                <a href="https://pixelwear.fr/legal/politique-confidentialite.html" style="color:#555;">Confidentialité</a>
              </p>
            </div>
          `
        })
      }).catch(() => {}); // silencieux si l'envoi échoue
    }

    const count = await getCount();
    return res.json({ count, duplicate });
  }

  return res.status(405).end();
}
