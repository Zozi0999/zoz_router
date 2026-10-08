module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-KEY, x-api-key, x-serper-key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    let query = req.query?.q || req.query?.query || '';
    let apiKey = req.headers['x-serper-key'] || req.headers['x-api-key'] || req.query?.apiKey || req.query?.key || req.query?.serperApiKey || '';
    let num = parseInt(req.query?.num || req.query?.limit || '15', 10);

    if (req.method === 'POST' && req.body) {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) {}
      }
      body = body || {};
      query = body.query || body.q || query;
      apiKey = body.apiKey || body.serperApiKey || apiKey;
      if (body.num || body.limit) num = parseInt(body.num || body.limit, 10);
    }

    if (!query) {
      return res.status(400).json({ error: 'Parameter query `q` atau body `{ query }` diperlukan.' });
    }

    const targetNum = Math.min(Math.max(isNaN(num) ? 15 : num, 1), 30);
    const serperKey = apiKey || process.env.SERPER_API_KEY;
    if (!serperKey) {
      return res.status(400).json({ error: 'Serper API key diperlukan. Setel SERPER_API_KEY atau kirim header x-serper-key.' });
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query, num: targetNum, gl: 'us', hl: 'en' })
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
