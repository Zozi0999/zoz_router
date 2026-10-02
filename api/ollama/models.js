module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const DEFAULT_CLOUD_MODELS = [
    { name: 'deepseek-v4.1-flash', model: 'deepseek-v4.1-flash' },
    { name: 'nemotron-3-ultra', model: 'nemotron-3-ultra' },
    { name: 'gemma4:31b', model: 'gemma4:31b' },
    { name: 'nemotron-3-nano:30b', model: 'nemotron-3-nano:30b' },
    { name: 'mistral-large-3:675b', model: 'mistral-large-3:675b' },
    { name: 'glm-5.3-flash', model: 'glm-5.3-flash' },
    { name: 'deepseek-v4-pro:0813', model: 'deepseek-v4-pro:0813' },
    { name: 'nemotron-3-super', model: 'nemotron-3-super' },
    { name: 'kimi-k3', model: 'kimi-k3' },
    { name: 'kimi-k2.6', model: 'kimi-k2.6' },
    { name: 'kimi-k2.7-code', model: 'kimi-k2.7-code' },
    { name: 'minimax-m3', model: 'minimax-m3' },
    { name: 'minimax-m2.7', model: 'minimax-m2.7' },
    { name: 'glm-5.3', model: 'glm-5.3' },
    { name: 'glm-5.2', model: 'glm-5.2' },
    { name: 'gpt-oss:20b', model: 'gpt-oss:20b' },
    { name: 'gpt-oss:120b', model: 'gpt-oss:120b' }
  ];

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

    return res.status(200).json({ models: DEFAULT_CLOUD_MODELS });
  } catch (err) {
    return res.status(200).json({ models: DEFAULT_CLOUD_MODELS });
  }
};
