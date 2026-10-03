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
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key'
        }
      });
    }

    // Proxy Ollama Chat
    if (url.pathname === '/api/ollama/chat' && request.method === 'POST') {
      try {
        const body = await request.json();
        const authHeader = request.headers.get('Authorization') || (body.apiKey ? `Bearer ${body.apiKey}` : (request.headers.get('x-ollama-key') ? `Bearer ${request.headers.get('x-ollama-key')}` : ''));
        const targetEndpoint = body.endpoint || 'https://ollama.com';
        const targetUrl = new URL('/api/chat', targetEndpoint.startsWith('http') ? targetEndpoint : `https://${targetEndpoint}`);

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
    if (url.pathname === '/api/ollama/models') {
      try {
        const authHeader = request.headers.get('Authorization') || (request.headers.get('x-ollama-key') ? `Bearer ${request.headers.get('x-ollama-key')}` : '');
        const headers = {};
        if (authHeader) headers['Authorization'] = authHeader;

        const res = await fetch('https://ollama.com/api/tags', { headers });
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

    // Proxy Web Search (Serper Google API)
    if (url.pathname === '/api/web-search') {
      try {
        let query = url.searchParams.get('q') || url.searchParams.get('query') || '';
        let apiKey = request.headers.get('x-serper-key') || '';
        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          query = body.query || body.q || query;
          apiKey = body.apiKey || body.serperApiKey || apiKey;
        }
        const serperKey = apiKey || '075538fed9c64990e1eb32a06726c1e55a933c1e';
        const serperRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: query, num: 6, gl: 'id', hl: 'id' })
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
