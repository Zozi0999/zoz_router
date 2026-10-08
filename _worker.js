export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key, x-serper-key, x-api-key, x-openrouter-key, x-title, X-Title, HTTP-Referer, http-referer'
        }
      });
    }

    // Health Check Endpoint
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'online',
        name: 'Zoz Router Cloud Gateway',
        version: '1.0.0',
        storage: 'cloud-stateless',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Proxy Ollama Chat
    if (url.pathname === '/api/ollama/chat' && request.method === 'POST') {
      try {
        const body = await request.json();
        const authHeader = request.headers.get('Authorization') || (body.apiKey ? `Bearer ${body.apiKey}` : (body.ollamaApiKey ? `Bearer ${body.ollamaApiKey}` : (request.headers.get('x-ollama-key') ? `Bearer ${request.headers.get('x-ollama-key')}` : '')));
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
        const authHeader = request.headers.get('Authorization') || (request.headers.get('x-ollama-key') ? `Bearer ${request.headers.get('x-ollama-key')}` : '') || (request.headers.get('x-api-key') ? `Bearer ${request.headers.get('x-api-key')}` : '') || (url.searchParams.get('key') ? `Bearer ${url.searchParams.get('key')}` : '') || (url.searchParams.get('apiKey') ? `Bearer ${url.searchParams.get('apiKey')}` : '');
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
        let apiKey = body.apiKey || body.openRouterKey || request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '').trim() : '') || url.searchParams.get('key') || url.searchParams.get('apiKey') || url.searchParams.get('openRouterKey') || env?.OPENROUTER_API_KEY;
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
            ...(body.plugins ? { plugins: body.plugins } : {}),
            ...(body.tools && Array.isArray(body.tools) && (!body.model || (!body.model.includes(':free') && body.model !== 'openrouter/free')) ? { tools: body.tools } : {})
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
          const qKey = request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || url.searchParams.get('key') || url.searchParams.get('apiKey') || url.searchParams.get('openRouterKey') || env?.OPENROUTER_API_KEY;
          if (qKey) authHeader = `Bearer ${String(qKey).replace(/^Bearer\s+/i, '').trim()}`;
        }
        const headers = {};
        if (authHeader) headers['Authorization'] = authHeader;

        const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
        const rawText = await res.text();
        try {
          const parsed = JSON.parse(rawText);
          if (!res.ok) {
            return new Response(JSON.stringify({
              success: false,
              data: [],
              error: parsed?.error?.message || parsed?.message || `HTTP ${res.status} from OpenRouter`,
              ...parsed
            }), {
              status: res.status,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }
          return new Response(rawText, {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        } catch (_) {
          return new Response(JSON.stringify({
            success: false,
            data: [],
            error: `HTTP ${res.status}: Respon non-JSON dari OpenRouter (${rawText.slice(0, 150)})`
          }), {
            status: res.ok ? 200 : res.status,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ success: false, data: [], error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Proxy OpenRouter Image Models
    if ((url.pathname === '/api/openrouter/images/models' || url.pathname === '/api/openrouter/image-models') && request.method === 'GET') {
      try {
        let authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          const qKey = request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || url.searchParams.get('key') || url.searchParams.get('apiKey') || url.searchParams.get('openRouterKey') || env?.OPENROUTER_API_KEY;
          if (qKey) authHeader = `Bearer ${String(qKey).replace(/^Bearer\s+/i, '').trim()}`;
        }
        const headers = {
          'User-Agent': 'ZozRouter/1.0',
          ...(authHeader ? { 'Authorization': authHeader } : {})
        };
        const res = await fetch('https://openrouter.ai/api/v1/images/models', { headers });
        const rawText = await res.text();
        try {
          const parsed = JSON.parse(rawText);
          if (!res.ok) {
            return new Response(JSON.stringify({
              success: false,
              data: [],
              error: parsed?.error?.message || parsed?.message || `HTTP ${res.status} from OpenRouter`,
              ...parsed
            }), {
              status: res.status,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }
          return new Response(rawText, {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        } catch (_) {
          return new Response(JSON.stringify({
            success: false,
            data: [],
            error: `HTTP ${res.status}: Respon non-JSON dari OpenRouter (${rawText.slice(0, 150)})`
          }), {
            status: res.ok ? 200 : res.status,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ success: false, data: [], error: e.message }), {
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
          const qKey = request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || url.searchParams.get('key') || url.searchParams.get('apiKey') || url.searchParams.get('openRouterKey') || env?.OPENROUTER_API_KEY;
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
          const qKey = request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || url.searchParams.get('key') || url.searchParams.get('apiKey') || url.searchParams.get('openRouterKey') || env?.OPENROUTER_API_KEY;
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
    if (url.pathname === '/api/generate-image' || url.pathname === '/api/image/generate') {
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
          openRouterKey = body.openRouterKey || body.apiKey || (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || env?.OPENROUTER_API_KEY;
        } else {
          prompt = url.searchParams.get('prompt') || url.searchParams.get('q') || '';
          model = url.searchParams.get('model') || model;
          width = parseInt(url.searchParams.get('width'), 10) || width;
          height = parseInt(url.searchParams.get('height'), 10) || height;
          seed = url.searchParams.get('seed') || null;
          openRouterKey = url.searchParams.get('openRouterKey') || url.searchParams.get('key') || url.searchParams.get('apiKey') || (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || env?.OPENROUTER_API_KEY;
        }

        if (openRouterKey) {
          openRouterKey = String(openRouterKey).replace(/^Bearer\s+/i, '').trim();
        }

        if (!prompt || !prompt.trim()) {
          return new Response(JSON.stringify({ success: false, error: 'Parameter `prompt` diperlukan untuk menghasilkan gambar.' }), {
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

        const isCloudModel = effectiveModel.includes('/');

        // 1. OpenRouter Cloud Dedicated Image Generation (POST /api/v1/images)
        if (isCloudModel) {
          if (!openRouterKey) {
            return new Response(JSON.stringify({
              success: false,
              error: `OpenRouter API Key diperlukan untuk model cloud "${effectiveModel}". Silakan masukkan API Key Anda di menu Pengaturan > Provider Cloud.`
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }

          let lastOrError = null;

          // 1A. Primary: Dedicated OpenRouter Image Generation API (POST /api/v1/images)
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
                aspect_ratio: '1:1'
              })
            });

            const parsed = await orRes.json().catch(() => ({}));
            if (orRes.ok) {
              const item = parsed.data?.[0];
              if (item) {
                if (item.b64_json) {
                  const mime = item.media_type || 'image/png';
                  finalImageUrl = `data:${mime};base64,${item.b64_json}`;
                } else if (item.url) {
                  finalImageUrl = item.url;
                }
              }
            } else {
              const errDetail = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
              lastOrError = new Error(errDetail || `OpenRouter Image API HTTP ${orRes.status}`);
            }
          } catch (err) {
            lastOrError = err;
          }

          // 1B. Secondary: Fallback ke Multimodal Chat Completions
          if (!finalImageUrl) {
            try {
              const chatRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openRouterKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'https://github.com/Zozi0999/zoz_router',
                  'X-Title': 'Zoz Router Image Studio'
                },
                body: JSON.stringify({
                  model: effectiveModel,
                  messages: [{ role: 'user', content: `Please generate an image: ${cleanPrompt}` }],
                  modalities: ['image', 'text']
                })
              });

              if (chatRes.ok) {
                const chatParsed = await chatRes.json().catch(() => ({}));
                const msg = chatParsed.choices?.[0]?.message;
                if (msg) {
                  const imgItem = msg.images?.[0];
                  if (imgItem) {
                    finalImageUrl = imgItem.image_url?.url || imgItem.url || '';
                  } else if (msg.content) {
                    const mdMatch = msg.content.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/);
                    if (mdMatch) finalImageUrl = mdMatch[1];
                  }
                }
              }
            } catch (_) {}
          }

          // Jika model cloud OpenRouter gagal, JANGAN diam-diam fallback ke Pollinations!
          if (!finalImageUrl) {
            const msg = lastOrError ? lastOrError.message : 'OpenRouter tidak mengembalikan visual gambar yang valid';
            return new Response(JSON.stringify({
              success: false,
              error: `Gagal menghasilkan gambar dari model cloud ${effectiveModel}: ${msg}`
            }), {
              status: 502,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }
        }

        // 2. Default (Pollinations AI Multi-Style) - HANYA untuk model lokal/Pollinations
        if (!isCloudModel && !finalImageUrl) {
          let styledPrompt = cleanPrompt;
          if (effectiveModel === 'flux-realism' && !/photo|realis|cinematic/i.test(cleanPrompt)) {
            styledPrompt = `${cleanPrompt}, photorealistic, ultra-detailed 8k photography, cinematic lighting`;
          } else if (effectiveModel === 'flux-anime' && !/anime|manga|2d/i.test(cleanPrompt)) {
            styledPrompt = `${cleanPrompt}, anime aesthetic, high quality Japanese manga style, vibrant colors, detailed line art`;
          } else if (effectiveModel === 'flux-3d' && !/3d|cgi|render/i.test(cleanPrompt)) {
            styledPrompt = `${cleanPrompt}, 3d digital render, octane render, unreal engine 5, 3d cgi volumetric lighting`;
          } else if (effectiveModel === 'midjourney' && !/artistic|midjourney/i.test(cleanPrompt)) {
            styledPrompt = `${cleanPrompt}, midjourney aesthetic, artistic concept art, dramatic composition, breathtaking detail`;
          } else if (effectiveModel === 'flux-pro' && !/masterpiece|pro/i.test(cleanPrompt)) {
            styledPrompt = `${cleanPrompt}, masterpiece, professional award-winning composition, ultra sharp details`;
          }

          let urlPrompt = styledPrompt;
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
        return new Response(JSON.stringify({ success: false, error: e.message }), {
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
        let num = parseInt(url.searchParams.get('num') || url.searchParams.get('limit') || '15', 10);
        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          query = body.query || body.q || query;
          apiKey = body.apiKey || body.serperApiKey || apiKey || env?.SERPER_API_KEY;
          if (body.num || body.limit) num = parseInt(body.num || body.limit, 10);
        }
        if (!query || !query.trim()) {
          return new Response(JSON.stringify({ success: false, error: 'Parameter query `q` atau body `{ query }` diperlukan.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        const targetNum = Math.min(Math.max(isNaN(num) ? 15 : num, 1), 30);
        const serperKey = apiKey || env?.SERPER_API_KEY || '075538fed9c64990e1eb32a06726c1e55a933c1e';
        const serperRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: query, num: targetNum, gl: 'us', hl: 'en' })
        });
        const serperData = await serperRes.text();
        return new Response(serperData, {
          status: serperRes.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Proxy YouTube oEmbed Metadata Grounding
    if (url.pathname === '/api/youtube-info' && (request.method === 'GET' || request.method === 'POST')) {
      try {
        let targetUrl = '';
        if (request.method === 'GET') {
          targetUrl = url.searchParams.get('url') || url.searchParams.get('link') || '';
        } else {
          const body = await request.json().catch(() => ({}));
          targetUrl = body.url || body.link || '';
        }

        if (!targetUrl || !targetUrl.trim()) {
          return new Response(JSON.stringify({ success: false, error: 'Parameter url diperlukan.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        let clean = targetUrl.trim();
        if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
        let parsedUrl;
        try {
          parsedUrl = new URL(clean);
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: 'Format URL tidak valid: ' + e.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        const hostname = parsedUrl.hostname ? parsedUrl.hostname.toLowerCase() : '';
        const allowedHosts = ['youtu.be', 'www.youtu.be', 'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'];
        if (!allowedHosts.includes(hostname)) {
          return new Response(JSON.stringify({ success: false, error: 'Hanya URL YouTube resmi yang diizinkan.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        let videoId = null;
        const match = parsedUrl.href.match(/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
        if (match && match[1]) videoId = match[1];
        const canonicalUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : parsedUrl.href;

        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
        const ytRes = await fetch(oembedUrl, {
          signal: AbortSignal.timeout(8000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          }
        });

        if (!ytRes.ok) {
          return new Response(JSON.stringify({
            success: false,
            videoId,
            url: canonicalUrl,
            error: `YouTube oEmbed HTTP ${ytRes.status}`
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const data = await ytRes.json();
        return new Response(JSON.stringify({
          success: true,
          url: canonicalUrl,
          videoId,
          title: data.title || 'Tanpa Judul',
          channel: data.author_name || 'Kreator YouTube',
          channel_url: data.author_url || '',
          thumbnail: data.thumbnail_url || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''),
          type: data.type || 'video',
          html: data.html || ''
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Stateless Session Route for Cloudflare Gateway
    if (url.pathname === '/api/sessions' || url.pathname.startsWith('/api/sessions/')) {
      if (request.method === 'GET') {
        const isSingle = url.pathname !== '/api/sessions';
        return new Response(JSON.stringify(isSingle ? { session: null, stateless: true } : { sessions: [], stateless: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        stateless: true,
        message: 'Stateless cloud gateway mode — riwayat sesi dikelola via IndexedDB peramban.'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Default static assets (Cloudflare Pages) atau 404 response (Standalone Worker)
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }
    return new Response(JSON.stringify({
      status: 404,
      error: 'Not Found',
      message: 'Rute tidak ditemukan pada Cloudflare Gateway.'
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
