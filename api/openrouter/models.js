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
    const headers = {};
    if (authHeader) headers['Authorization'] = authHeader;

    const response = await fetch('https://openrouter.ai/api/v1/models', { headers });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
