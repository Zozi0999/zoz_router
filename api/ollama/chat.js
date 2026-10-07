module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key, x-api-key, x-title, X-Title, http-referer, HTTP-Referer');

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

    const authHeader = req.headers.authorization || (body.apiKey ? `Bearer ${body.apiKey}` : (body.ollamaApiKey ? `Bearer ${body.ollamaApiKey}` : (req.headers['x-ollama-key'] ? `Bearer ${req.headers['x-ollama-key']}` : '')));

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

    let cleanEndpoint = (targetEndpoint || 'https://ollama.com').trim();
    if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
      cleanEndpoint = (authHeader ? 'https://' : 'http://') + cleanEndpoint;
    }
    const parsedBase = new URL(cleanEndpoint);
    let curPath = parsedBase.pathname.replace(/\/+$/, '');
    if (curPath.endsWith('/api/chat')) {
      // already ends with /api/chat
    } else if (curPath.endsWith('/api')) {
      parsedBase.pathname = curPath + '/chat';
    } else {
      parsedBase.pathname = (curPath ? curPath : '') + '/api/chat';
    }
    const targetUrl = parsedBase;
    const headers = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    const abortController = new AbortController();
    let clientDisconnected = false;

    req.on('close', () => {
      clientDisconnected = true;
      abortController.abort();
    });

    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: abortController.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).send(errText);
    }

    if (payload.stream === false) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    } else {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Transfer-Encoding', 'chunked');
    }

    for await (const chunk of response.body) {
      if (clientDisconnected || res.writableEnded || res.destroyed) {
        abortController.abort();
        break;
      }
      res.write(chunk);
    }
    if (!res.writableEnded && !res.destroyed) {
      return res.end();
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      try { res.end(); } catch (_) {}
      return;
    }
    console.error('Vercel Ollama Chat Proxy Error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
    try {
      res.end();
    } catch (_) {}
  }
};
