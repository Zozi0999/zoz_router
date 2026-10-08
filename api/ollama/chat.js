function isPrivateHostname(hostname) {
  if (!hostname) return true;
  const h = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  if (['localhost','127.0.0.1','::1','0.0.0.0','::','0'].includes(h)) return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^fc00:|^fe80:/i.test(h)) return true;
  if (h.startsWith('::ffff:127.') || h.startsWith('::ffff:192.168.') || h.startsWith('::ffff:10.')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return true;
  return false;
}

function isOllamaEndpointForbidden(endpointUrl) {
  let parsed;
  try { parsed = new URL(endpointUrl); } catch (e) { return true; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return true;
  const host = (parsed.hostname || '').toLowerCase();
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  if ((host === '127.0.0.1' || host === 'localhost' || host === '::1') && port === '11434') return false;
  return isPrivateHostname(host);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key, x-api-key, x-openrouter-key, x-session-id, X-Session-ID, x-title, X-Title, http-referer, HTTP-Referer');

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
    if (isOllamaEndpointForbidden(cleanEndpoint)) {
      return res.status(400).json({ error: 'Endpoint Ollama mengarah ke host privat/internal — akses diblokir (SSRF Protection).' });
    }
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

    res.on('close', () => {
      if (res.writableEnded) return;
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
