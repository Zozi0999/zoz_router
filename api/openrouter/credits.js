module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    let authHeader = req.headers.authorization;
    if (!authHeader) {
      const qKey = req.headers['x-api-key'] || req.query?.key || req.query?.apiKey || process.env.OPENROUTER_API_KEY;
      if (qKey) authHeader = `Bearer ${String(qKey).replace(/^Bearer\s+/i, '').trim()}`;
    }
    if (!authHeader) return res.status(401).json({ error: 'Authorization header is required' });

    const response = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'ZozRouter/1.0'
      }
    });
    const data = await response.json();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
