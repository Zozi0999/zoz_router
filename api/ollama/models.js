function isPrivateHostname(hostname) {
  if (!hostname) return true;
  const h = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  if (['localhost','127.0.0.1','::1','0.0.0.0','::','0'].includes(h)) return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^fc00:|^fe80:/i.test(h)) return true; // IPv6 Unique Local & Link-Local
  if (h.startsWith('::ffff:')) return true; // Block all IPv4-mapped IPv6
  if (h.startsWith('::7f00:') || h.startsWith('::a9fe:') || h.startsWith('::c0a8:') || h.startsWith('::0a')) return true; // Block mapped hex variants
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
    if (isOllamaEndpointForbidden(cleanEndpoint)) {
      return res.status(400).json({ error: 'Endpoint Ollama mengarah ke host privat/internal — akses diblokir (SSRF Protection).' });
    }
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

    return res.status(200).json({ success: false, models: [], data: [], error: `HTTP ${response.status} from Ollama upstream` });
  } catch (err) {
    return res.status(200).json({ success: false, models: [], data: [], error: err.message });
  }
};
