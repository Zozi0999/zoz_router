module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-title, X-Title, http-referer, HTTP-Referer');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    let authHeader = req.headers.authorization;
    if (!authHeader) {
      const qKey = req.headers['x-openrouter-key'] || req.headers['x-api-key'] || process.env.OPENROUTER_API_KEY;
      if (qKey) authHeader = `Bearer ${String(qKey).replace(/^Bearer\s+/i, '').trim()}`;
    } else {
      authHeader = `Bearer ${String(authHeader).replace(/^Bearer\s+/i, '').trim()}`;
    }
    const headers = {};
    if (authHeader) headers['Authorization'] = authHeader;
    headers['User-Agent'] = 'ZozRouter/1.0';

    const targetUrl = (req.query?.type === 'images' || req.query?.images === 'true')
      ? 'https://openrouter.ai/api/v1/images/models'
      : 'https://openrouter.ai/api/v1/models';

    const response = await fetch(targetUrl, { headers });
    const rawText = await response.text();
    try {
      const data = JSON.parse(rawText);
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          data: [],
          error: data?.error?.message || data?.message || `HTTP ${response.status} from OpenRouter`,
          ...data
        });
      }
      return res.status(200).json(data);
    } catch (_) {
      return res.status(response.ok ? 200 : response.status).json({
        success: false,
        data: [],
        error: `HTTP ${response.status}: Respon non-JSON dari OpenRouter (${rawText.slice(0, 150)})`
      });
    }
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, data: [], error: err.message });
    }
  }
};
