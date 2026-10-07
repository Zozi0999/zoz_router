module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-title, HTTP-Referer');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    const apiKey = body.apiKey || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '').trim() : '');
    if (!apiKey) return res.status(400).json({ error: 'Missing OpenRouter API Key' });

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://zoz-router.vercel.app',
      'X-Title': 'ZOZ Router'
    };

    const payload = {
      model: body.model || 'deepseek/deepseek-r1:free',
      messages: body.messages || [],
      stream: body.stream !== false,
      temperature: body.temperature ?? 0.7,
      top_p: body.top_p ?? 0.9,
      max_tokens: body.max_tokens ?? 4096,
      ...(body.plugins ? { plugins: body.plugins } : {})
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).send(errText);
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of response.body) {
      res.write(chunk);
    }
    return res.end();
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
    try {
      res.end();
    } catch (_) {}
  }
};
