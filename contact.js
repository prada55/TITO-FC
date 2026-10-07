// Fonction serverless Vercel : POST /api/contact
// Variables d'environnement requises : RESEND_API_KEY, CONTACT_TO
// Optionnelle : MAIL_FROM

const esc = s =>
  String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const body = req.body || {};
  const nom = String(body.nom || '').trim().slice(0, 80);
  const telephone = String(body.telephone || '').trim().slice(0, 25);
  const email = String(body.email || '').trim().slice(0, 120);
  const objet = String(body.objet || 'Autre demande').trim().slice(0, 60);
  const message = String(body.message || '').trim().slice(0, 1500);

  // Anti-spam : le champ caché "website" ne doit jamais être rempli
  if (body.website) return res.status(200).json({ ok: true });

  if (!nom || !telephone || !message) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email invalide' });
  }
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_TO) {
    console.error('Variables RESEND_API_KEY / CONTACT_TO manquantes');
    return res.status(500).json({ error: 'Configuration serveur incomplète' });
  }

  const payload = {
    from: process.env.MAIL_FROM || 'Site Tito FC <onboarding@resend.dev>',
    to: [process.env.CONTACT_TO],
    subject: `[Site TFC-G] ${objet} - ${nom}`,
    html: `
      <h2>Nouveau message depuis le site</h2>
      <p><b>Nom :</b> ${esc(nom)}</p>
      <p><b>Téléphone :</b> ${esc(telephone)}</p>
      <p><b>Email :</b> ${email ? esc(email) : 'non renseigné'}</p>
      <p><b>Objet :</b> ${esc(objet)}</p>
      <p><b>Message :</b><br>${esc(message).replace(/\n/g, '<br>')}</p>`
  };
  if (email) payload.reply_to = email;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      console.error('Resend error:', r.status, await r.text());
      return res.status(502).json({ error: "Échec de l'envoi" });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
