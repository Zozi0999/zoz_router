module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const DEFAULT_CLOUD_MODELS = [
    { name: 'llama3.2-vision:11b', model: 'llama3.2-vision:11b', details: { families: ['mllama', 'clip'], family: 'mllama' } },
    { name: 'llama3.2-vision:latest', model: 'llama3.2-vision:latest', details: { families: ['mllama', 'clip'], family: 'mllama' } },
    { name: 'llava:latest', model: 'llava:latest', details: { families: ['llava', 'clip'], family: 'llava' } },
    { name: 'llava:7b', model: 'llava:7b', details: { families: ['llava', 'clip'], family: 'llava' } },
    { name: 'qwen2.5-vl:7b', model: 'qwen2.5-vl:7b', details: { families: ['qwen2vl', 'clip'], family: 'qwen2vl' } },
    { name: 'moondream:1.8b', model: 'moondream:1.8b', details: { families: ['moondream', 'clip'], family: 'moondream' } },
    { name: 'granite3.2-vision:2b', model: 'granite3.2-vision:2b', details: { families: ['granite', 'clip'], family: 'granite' } },
    { name: 'minicpm-v:8b', model: 'minicpm-v:8b', details: { families: ['minicpmv', 'clip'], family: 'minicpmv' } },
    { name: 'pixtral:12b', model: 'pixtral:12b', details: { families: ['pixtral', 'clip'], family: 'pixtral' } },
    { name: 'deepseek-v4.1-flash', model: 'deepseek-v4.1-flash', details: { family: 'deepseek' } },
    { name: 'nemotron-3-ultra', model: 'nemotron-3-ultra', details: { family: 'nemotron' } },
    { name: 'gemma4:31b', model: 'gemma4:31b', details: { family: 'gemma' } },
    { name: 'nemotron-3-nano:30b', model: 'nemotron-3-nano:30b', details: { family: 'nemotron' } },
    { name: 'mistral-large-3:675b', model: 'mistral-large-3:675b', details: { family: 'mistral' } },
    { name: 'glm-5.3-flash', model: 'glm-5.3-flash', details: { family: 'glm' } },
    { name: 'deepseek-v4-pro:0813', model: 'deepseek-v4-pro:0813', details: { family: 'deepseek' } },
    { name: 'nemotron-3-super', model: 'nemotron-3-super', details: { family: 'nemotron' } },
    { name: 'kimi-k3', model: 'kimi-k3', details: { family: 'kimi' } },
    { name: 'kimi-k2.6', model: 'kimi-k2.6', details: { family: 'kimi' } },
    { name: 'kimi-k2.7-code', model: 'kimi-k2.7-code', details: { family: 'kimi' } },
    { name: 'minimax-m3', model: 'minimax-m3', details: { family: 'minimax' } },
    { name: 'minimax-m2.7', model: 'minimax-m2.7', details: { family: 'minimax' } },
    { name: 'glm-5.3', model: 'glm-5.3', details: { family: 'glm' } },
    { name: 'glm-5.2', model: 'glm-5.2', details: { family: 'glm' } },
    { name: 'gpt-oss:20b', model: 'gpt-oss:20b', details: { family: 'gpt-oss' } },
    { name: 'gpt-oss:120b', model: 'gpt-oss:120b', details: { family: 'gpt-oss' } }
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
