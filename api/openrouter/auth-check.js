module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    let authHeader = req.headers.authorization;
    if (!authHeader) {
      const qKey = req.query?.key || req.query?.apiKey;
      if (qKey) authHeader = `Bearer ${qKey}`;
    }
    if (!authHeader) return res.status(401).json({ error: 'No Authorization header provided' });

    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { 'Authorization': authHeader }
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
