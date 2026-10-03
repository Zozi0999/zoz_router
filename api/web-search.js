export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY, x-serper-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let query = req.query.q || req.query.query || '';
    let apiKey = req.headers['x-serper-key'] || req.headers['x-api-key'] || req.query.apiKey || '';

    if (req.method === 'POST' && req.body) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      query = body.query || body.q || query;
      apiKey = body.apiKey || body.serperApiKey || apiKey;
    }

    if (!query) {
      return res.status(400).json({ error: 'Parameter query `q` atau body `{ query }` diperlukan.' });
    }

    const serperKey = apiKey || process.env.SERPER_API_KEY || '075538fed9c64990e1eb32a06726c1e55a933c1e';

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query, num: 6, gl: 'id', hl: 'id' })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
