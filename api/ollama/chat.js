module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    const authHeader = req.headers.authorization || (body.apiKey ? `Bearer ${body.apiKey}` : (req.headers['x-ollama-key'] ? `Bearer ${req.headers['x-ollama-key']}` : ''));

    let targetEndpoint = body.endpoint || 'https://ollama.com';
    if (authHeader && (!body.endpoint || body.endpoint.includes('127.0.0.1') || body.endpoint.includes('localhost'))) {
      targetEndpoint = 'https://ollama.com';
    }

    const payload = {
      model: body.model || 'gemma4:31b',
      messages: body.messages || [],
      stream: body.stream !== false,
      options: body.options || {}
    };

    const targetUrl = new URL('/api/chat', targetEndpoint.startsWith('http') ? targetEndpoint : `https://${targetEndpoint}`);
    const headers = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).send(errText);
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of response.body) {
      res.write(chunk);
    }
    return res.end();
  } catch (err) {
    console.error('Vercel Ollama Chat Proxy Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
