module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const authHeader = req.headers.authorization || (req.headers['x-ollama-key'] ? `Bearer ${req.headers['x-ollama-key']}` : '');
    const endpoint = req.query.endpoint || (authHeader ? 'https://ollama.com' : 'http://127.0.0.1:11434');

    const headers = {};
    if (authHeader) headers['Authorization'] = authHeader;

    const targetUrl = new URL('/api/tags', endpoint.startsWith('http') ? endpoint : `http://${endpoint}`);
    const response = await fetch(targetUrl.toString(), { headers });

    if (response.ok) {
      const data = await response.json();
      return res.status(200).json(data);
    }

    return res.status(200).json({ models: [] });
  } catch (err) {
    return res.status(200).json({ models: [], error: err.message });
  }
};
