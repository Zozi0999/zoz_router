export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key, x-serper-key, x-api-key, x-title, HTTP-Referer'
        }
      });
    }

    // Proxy Ollama Chat
    if (url.pathname === '/api/ollama/chat' && request.method === 'POST') {
      try {
        const body = await request.json();
        const authHeader = request.headers.get('Authorization') || (body.apiKey ? `Bearer ${body.apiKey}` : (request.headers.get('x-ollama-key') ? `Bearer ${request.headers.get('x-ollama-key')}` : ''));
        const targetEndpoint = body.endpoint || 'https://ollama.com';
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

        const res = await fetch(targetUrl.toString(), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: body.model || 'gemma4:31b',
            messages: body.messages || [],
            stream: body.stream !== false,
            options: body.options || {}
          })
        });

        const newHeaders = new Headers(res.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        return new Response(res.body, {
          status: res.status,
          headers: newHeaders
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Proxy Ollama Models
    if (url.pathname === '/api/ollama/models' && request.method === 'GET') {
      try {
        const authHeader = request.headers.get('Authorization') || (request.headers.get('x-ollama-key') ? `Bearer ${request.headers.get('x-ollama-key')}` : '');
        const endpoint = url.searchParams.get('endpoint') || (authHeader ? 'https://ollama.com' : 'http://127.0.0.1:11434');
        const headers = {};
        if (authHeader) headers['Authorization'] = authHeader;

        let cleanEndpoint = (endpoint || '').trim();
        if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
          cleanEndpoint = (authHeader ? 'https://' : 'http://') + cleanEndpoint;
        }
        const parsedBase = new URL(cleanEndpoint);
        let curPath = parsedBase.pathname.replace(/\/+$/, '');
        if (curPath.endsWith('/api/tags')) {
          // already ends with /api/tags
        } else if (curPath.endsWith('/api')) {
          parsedBase.pathname = curPath + '/tags';
        } else {
          parsedBase.pathname = (curPath ? curPath : '') + '/api/tags';
        }
        const targetUrl = parsedBase;

        const res = await fetch(targetUrl.toString(), { headers });
        const data = await res.text();
        return new Response(data, {
          status: res.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ models: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Proxy OpenRouter Chat
    if (url.pathname === '/api/openrouter/chat' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        let apiKey = body.apiKey || request.headers.get('x-api-key') || (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '').trim() : '') || url.searchParams.get('key') || url.searchParams.get('apiKey') || env?.OPENROUTER_API_KEY;
        if (apiKey) apiKey = String(apiKey).replace(/^Bearer\s+/i, '').trim();
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'Missing OpenRouter API Key' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://zoz-router.pages.dev',
            'X-Title': 'ZOZ Router'
          },
          body: JSON.stringify({
            model: body.model || 'qwen/qwen3.8-27b:free',
            messages: body.messages || [],
            stream: body.stream !== false,
            temperature: body.temperature ?? 0.7,
            top_p: body.top_p ?? 0.9,
            max_tokens: body.max_tokens ?? 4096,
            ...(body.plugins ? { plugins: body.plugins } : {})
          })
        });

        const newHeaders = new Headers(res.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        return new Response(res.body, {
          status: res.status,
          headers: newHeaders
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Proxy OpenRouter Models
    if (url.pathname === '/api/openrouter/models' && request.method === 'GET') {
      try {
        let authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          const qKey = request.headers.get('x-api-key') || url.searchParams.get('key') || url.searchParams.get('apiKey') || env?.OPENROUTER_API_KEY;
          if (qKey) authHeader = `Bearer ${String(qKey).replace(/^Bearer\s+/i, '').trim()}`;
        }
        const headers = {};
        if (authHeader) headers['Authorization'] = authHeader;

        const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
        const data = await res.text();
        return new Response(data, {
          status: res.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Proxy OpenRouter Auth Check
    if (url.pathname === '/api/openrouter/auth-check' && request.method === 'GET') {
      try {
        let authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          const qKey = request.headers.get('x-api-key') || url.searchParams.get('key') || url.searchParams.get('apiKey') || env?.OPENROUTER_API_KEY;
          if (qKey) authHeader = `Bearer ${String(qKey).replace(/^Bearer\s+/i, '').trim()}`;
        }
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'No Authorization header provided' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { 'Authorization': authHeader }
        });
        const data = await res.text();
        return new Response(data, {
          status: res.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Proxy OpenRouter Credits
    if (url.pathname === '/api/openrouter/credits' && request.method === 'GET') {
      try {
        let authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          const qKey = request.headers.get('x-api-key') || url.searchParams.get('key') || url.searchParams.get('apiKey') || env?.OPENROUTER_API_KEY;
          if (qKey) authHeader = `Bearer ${String(qKey).replace(/^Bearer\s+/i, '').trim()}`;
        }
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'Authorization header is required' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const res = await fetch('https://openrouter.ai/api/v1/credits', {
          headers: { 'Authorization': authHeader, 'User-Agent': 'ZozRouter/1.0' }
        });
        const data = await res.text();
        return new Response(data, {
          status: res.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Proxy Generate Image
    if (url.pathname === '/api/generate-image') {
      try {
        let prompt = '';
        let model = 'flux';
        let width = 1024;
        let height = 1024;
        let seed = null;
        let openRouterKey = null;

        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          prompt = body.prompt || body.q || '';
          model = body.model || model;
          width = parseInt(body.width, 10) || width;
          height = parseInt(body.height, 10) || height;
          seed = body.seed || null;
          openRouterKey = body.openRouterKey || body.apiKey || (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || request.headers.get('x-api-key') || env?.OPENROUTER_API_KEY;
        } else {
          prompt = url.searchParams.get('prompt') || url.searchParams.get('q') || '';
          model = url.searchParams.get('model') || model;
          width = parseInt(url.searchParams.get('width'), 10) || width;
          height = parseInt(url.searchParams.get('height'), 10) || height;
          seed = url.searchParams.get('seed') || null;
          openRouterKey = url.searchParams.get('key') || url.searchParams.get('apiKey') || (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || request.headers.get('x-api-key') || env?.OPENROUTER_API_KEY;
        }

        if (openRouterKey) {
          openRouterKey = String(openRouterKey).replace(/^Bearer\s+/i, '').trim();
        }

        if (!prompt || !prompt.trim()) {
          return new Response(JSON.stringify({ error: 'Parameter `prompt` diperlukan untuk menghasilkan gambar.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const cleanPrompt = prompt.trim();
        const actualSeed = seed || Math.floor(Math.random() * 100000000);
        const startTime = Date.now();
        width = Math.min(Math.max(width, 256), 2048);
        height = Math.min(Math.max(height, 256), 2048);

        let effectiveModel = (model || 'flux').toLowerCase().trim();
        let finalImageUrl = '';

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
              body: JSON.stringify({ model: effectiveModel, prompt: cleanPrompt, width, height, n: 1 })
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
          } catch (_) {
            effectiveModel = 'flux';
          }
        }

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
        return new Response(JSON.stringify({
          success: true,
          url: finalImageUrl,
          localUrl: finalImageUrl,
          remoteUrl: finalImageUrl,
          prompt: cleanPrompt,
          model: effectiveModel,
          width,
          height,
          seed: actualSeed,
          duration: `${duration}s`
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Proxy Web Search (Serper Google API)
    if (url.pathname === '/api/web-search') {
      try {
        let query = url.searchParams.get('q') || url.searchParams.get('query') || '';
        let apiKey = request.headers.get('x-serper-key') || request.headers.get('x-api-key') || url.searchParams.get('apiKey') || url.searchParams.get('key') || '' || env?.SERPER_API_KEY;
        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          query = body.query || body.q || query;
          apiKey = body.apiKey || body.serperApiKey || apiKey || env?.SERPER_API_KEY;
        }
        const serperKey = apiKey || env?.SERPER_API_KEY || '075538fed9c64990e1eb32a06726c1e55a933c1e';
        const serperRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: query, num: 6, gl: 'us', hl: 'en' })
        });
        const serperData = await serperRes.text();
        return new Response(serperData, {
          status: serperRes.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Default static assets
    return env.ASSETS.fetch(request);
  }
};
