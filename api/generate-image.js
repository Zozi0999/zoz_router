module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-title, X-Title, http-referer, HTTP-Referer, x-api-key, x-openrouter-key');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    let prompt = '';
    let model = 'flux';
    let width = 1024;
    let height = 1024;
    let seed = null;
    let openRouterKey = null;

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) {}
      }
      body = body || {};
      prompt = body.prompt || body.q || '';
      model = body.model || model;
      width = parseInt(body.width, 10) || width;
      height = parseInt(body.height, 10) || height;
      seed = body.seed || null;
      openRouterKey = body.openRouterKey || body.apiKey || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : null) || req.headers['x-api-key'] || process.env.OPENROUTER_API_KEY;
    } else {
      prompt = req.query?.prompt || req.query?.q || '';
      model = req.query?.model || model;
      width = parseInt(req.query?.width, 10) || width;
      height = parseInt(req.query?.height, 10) || height;
      seed = req.query?.seed || null;
      openRouterKey = req.query?.key || req.query?.apiKey || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : null) || req.headers['x-api-key'] || process.env.OPENROUTER_API_KEY;
    }

    if (openRouterKey) {
      openRouterKey = String(openRouterKey).replace(/^Bearer\s+/i, '').trim();
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Parameter `prompt` diperlukan untuk menghasilkan gambar.' });
    }

    const cleanPrompt = prompt.trim();
    const actualSeed = seed || Math.floor(Math.random() * 100000000);
    const startTime = Date.now();

    width = Math.min(Math.max(width, 256), 2048);
    height = Math.min(Math.max(height, 256), 2048);

    let effectiveModel = (model || 'flux').toLowerCase().trim();
    let finalImageUrl = '';

    // 1. Coba OpenRouter Image API jika key tersedia dan model namespace ditentukan
    if (openRouterKey && effectiveModel.includes('/')) {
      try {
        const orRes = await fetch('https://openrouter.ai/api/v1/images', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/Zozi0999/zoz_router',
            'X-Title': 'Zoz Router Image Studio'
          },
          body: JSON.stringify({
            model: effectiveModel,
            prompt: cleanPrompt,
            width: width,
            height: height,
            n: 1
          })
        });

        if (orRes.ok) {
          const parsed = await orRes.json();
          const imgItem = parsed.data?.[0] || parsed.images?.[0] || parsed.choices?.[0];
          if (imgItem) {
            if (imgItem.b64_json) {
              finalImageUrl = `data:image/png;base64,${imgItem.b64_json}`;
            } else if (imgItem.url) {
              finalImageUrl = imgItem.url;
            }
          }
        }
      } catch (orErr) {
        effectiveModel = 'flux';
      }
    }

    // 2. Default / Fallback: Pollinations AI
    if (!finalImageUrl) {
      effectiveModel = effectiveModel.includes('/') ? 'flux' : effectiveModel;
      let urlPrompt = cleanPrompt;
      if (urlPrompt.length > 800) {
        const cut = urlPrompt.slice(0, 800);
        const lastSpace = cut.lastIndexOf(' ');
        urlPrompt = (lastSpace > 600 ? cut.slice(0, lastSpace) : cut).trim();
      }
      const encodedPrompt = encodeURIComponent(urlPrompt);
      finalImageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${encodeURIComponent(effectiveModel)}&seed=${actualSeed}&nologo=true&enhance=true`;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return res.status(200).json({
      success: true,
      url: finalImageUrl,
      localUrl: finalImageUrl,
      remoteUrl: finalImageUrl,
      prompt: cleanPrompt,
      model: effectiveModel,
      width: width,
      height: height,
      seed: actualSeed,
      duration: `${duration}s`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
