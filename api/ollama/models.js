module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key, x-api-key, x-title, X-Title, http-referer, HTTP-Referer');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const authHeader = req.headers.authorization || (req.headers['x-ollama-key'] ? `Bearer ${req.headers['x-ollama-key']}` : '') || (req.headers['x-api-key'] ? `Bearer ${req.headers['x-api-key']}` : '') || (req.query?.key ? `Bearer ${req.query.key}` : '') || (req.query?.apiKey ? `Bearer ${req.query.apiKey}` : '');
    const endpoint = req.query?.endpoint || (authHeader ? 'https://ollama.com' : 'http://127.0.0.1:11434');

    const headers = {};
    if (authHeader) headers['Authorization'] = authHeader;

    let cleanEndpoint = (endpoint || '').trim();
    if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
      cleanEndpoint = (authHeader ? 'https://' : 'http://') + cleanEndpoint;
    }
    const parsedBase = new URL(cleanEndpoint);
    let curPath = parsedBase.pathname.replace(/\/+$/, '');
    if (curPath.endsWith('/api/tags')) {
      // already ends with /api/tags
    } else if (curPath.endsWith('/api')) {
      parsedBase.pathname = curPath + '/tags';
    } else {
      parsedBase.pathname = (curPath ? curPath : '') + '/api/tags';
    }
    const targetUrl = parsedBase;
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
