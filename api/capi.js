// Vercel Serverless Function — Meta Conversions API (server-side) for umevio.com
// The static site POSTs deduplicated events here; this forwards them to Meta with
// the secret token (set META_CAPI_TOKEN in Vercel → Project Settings → Environment Variables).
// Dedup: the browser pixel fires the same event with the same eventID, so Meta merges them.

const PIXEL_ID = '1632776258010871'; // Umevio Meta Pixel

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = process.env.META_CAPI_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'META_CAPI_TOKEN not set' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const { event_name, event_id, page_url, fbp, fbc } = body;
  if (!event_name || !event_id) {
    res.status(400).json({ error: 'event_name and event_id required' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ua = req.headers['user-agent'] || '';

  const user_data = { client_ip_address: ip, client_user_agent: ua };
  if (fbp) user_data.fbp = fbp;   // _fbp cookie — improves match quality
  if (fbc) user_data.fbc = fbc;   // _fbc cookie — click attribution

  const payload = {
    data: [{
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id,                     // shared with the browser pixel → dedup
      action_source: 'website',
      event_source_url: page_url || '',
      user_data,
    }],
  };

  try {
    const r = await fetch(
      `https://graph.facebook.com/v22.0/${PIXEL_ID}/events?access_token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    const data = await r.json();
    res.status(r.ok ? 200 : 400).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
