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

// ==================== YOUTUBE LIVE SEARCH (ZERO API KEY) ====================
const YT_SEARCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const YT_INVIDIOUS = ['https://inv.nadeko.net', 'https://yewtu.be', 'https://invidious.nerdvpn.de'];
const ytSearchCache = new Map();

function ytDurationSeconds(text) {
  if (!text || typeof text !== 'string') return 0;
  const parts = text.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function ytExtractJsonAfterMarker(source, marker) {
  if (!source || typeof source !== 'string') return null;
  const idx = source.indexOf(marker);
  if (idx === -1) return null;
  const start = source.indexOf('{', idx + marker.length);
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return source.slice(start, i + 1); }
  }
  return null;
}

function ytTextOf(node) {
  if (!node) return '';
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map((r) => (r && r.text) || '').join('');
  if (typeof node.content === 'string') return node.content;
  return '';
}

function ytMapVideoRenderer(vr) {
  if (!vr || !vr.videoId) return null;
  const title = ytTextOf(vr.title);
  if (!title) return null;
  const ownerRuns = vr.ownerText && vr.ownerText.runs;
  const ownerNav = ownerRuns && ownerRuns[0] && ownerRuns[0].navigationEndpoint && ownerRuns[0].navigationEndpoint.browseEndpoint;
  const channelPath = ownerNav && ownerNav.canonicalBaseUrl;
  const durationText = ytTextOf(vr.lengthText);
  return {
    videoId: vr.videoId,
    title,
    channel: ytTextOf(vr.ownerText || vr.longBylineText) || '',
    channelUrl: channelPath ? `https://www.youtube.com${channelPath}` : '',
    durationText,
    durationSeconds: ytDurationSeconds(durationText),
    viewText: ytTextOf(vr.viewCountText) || ytTextOf(vr.shortViewCountText),
    publishedText: ytTextOf(vr.publishedTimeText),
    description: ytTextOf(vr.descriptionSnippet).slice(0, 260),
    url: `https://www.youtube.com/watch?v=${vr.videoId}`,
    thumbnail: `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
    source: 'YouTube Search'
  };
}

function ytMapLockup(lv) {
  if (!lv || !lv.contentId) return null;
  const meta = (lv.metadata && lv.metadata.lockupMetadataViewModel) || {};
  const title = (meta.title && meta.title.content) || '';
  if (!title) return null;
  const metaLine = (meta.metadata && meta.metadata.content) || '';
  const sources = (meta.image && meta.image.thumbnailSources) || [];
  let thumb = '';
  for (const s of sources) {
    if (s && typeof s.url === 'string' && /hqdefault|mqdefault|maxresdefault/i.test(s.url)) { thumb = s.url; break; }
  }
  if (!thumb && sources.length && sources[0].url) thumb = sources[0].url;
  if (thumb && thumb.startsWith('//')) thumb = `https:${thumb}`;
  if (thumb && thumb.startsWith('/')) thumb = `https://i.ytimg.com${thumb}`;
  return {
    videoId: lv.contentId,
    title,
    channel: '',
    channelUrl: '',
    durationText: '',
    durationSeconds: 0,
    viewText: metaLine,
    publishedText: '',
    description: metaLine.slice(0, 260),
    url: `https://www.youtube.com/watch?v=${lv.contentId}`,
    thumbnail: thumb || `https://i.ytimg.com/vi/${lv.contentId}/hqdefault.jpg`,
    source: 'YouTube Search'
  };
}

function ytCollect(node, out, limit) {
  if (!node || typeof node !== 'object' || out.length >= limit) return;
  if (Array.isArray(node)) {
    for (const item of node) { ytCollect(item, out, limit); if (out.length >= limit) return; }
    return;
  }
  if (node.videoRenderer) {
    const m = ytMapVideoRenderer(node.videoRenderer);
    if (m && !out.some((v) => v.videoId === m.videoId)) out.push(m);
    if (out.length >= limit) return;
  }
  if (node.lockupViewModel && node.lockupViewModel.contentId && String(node.lockupViewModel.contentType || '').toUpperCase().includes('VIDEO')) {
    const m = ytMapLockup(node.lockupViewModel);
    if (m && !out.some((v) => v.videoId === m.videoId)) out.push(m);
    if (out.length >= limit) return;
  }
  for (const k of Object.keys(node)) { ytCollect(node[k], out, limit); if (out.length >= limit) return; }
}

async function ytSearchViaYouTubePage(query, limit) {
  try {
    const resp = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&gl=US`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': YT_SEARCH_UA, 'Accept-Language': 'en-US,en;q=0.9', 'Cookie': 'SOCS=CAI' }
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const jsonStr = ytExtractJsonAfterMarker(html, 'ytInitialData');
    if (!jsonStr) return [];
    const out = [];
    ytCollect(JSON.parse(jsonStr), out, limit);
    return out;
  } catch (_) {
    return [];
  }
}

async function ytSearchViaInvidious(query, limit) {
  const seen = new Set();
  for (const base of YT_INVIDIOUS) {
    try {
      const resp = await fetch(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
        signal: AbortSignal.timeout(7000),
        headers: { 'Accept': 'application/json', 'User-Agent': YT_SEARCH_UA }
      });
      if (!resp.ok) continue;
      const list = await resp.json();
      if (!Array.isArray(list)) continue;
      const mapped = list
        .filter((it) => it && it.videoId && it.title)
        .slice(0, limit)
        .map((it) => ({
          videoId: it.videoId,
          title: it.title,
          channel: it.author || '',
          channelUrl: it.authorUrl ? (String(it.authorUrl).startsWith('http') ? it.authorUrl : `${base}${it.authorUrl}`) : '',
          durationText: '',
          durationSeconds: Number(it.lengthSeconds) || 0,
          viewText: Number(it.viewCount) > 0 ? `${Number(it.viewCount).toLocaleString('en-US')} views` : '',
          publishedText: it.publishedText || '',
          description: String(it.description || '').slice(0, 260),
          url: `https://www.youtube.com/watch?v=${it.videoId}`,
          thumbnail: `https://i.ytimg.com/vi/${it.videoId}/hqdefault.jpg`,
          source: 'Invidious'
        }));
      const fresh = mapped.filter((v) => {
        if (!v.videoId || seen.has(v.videoId)) return false;
        seen.add(v.videoId);
        return true;
      });
      if (fresh.length) return fresh;
    } catch (_) {}
  }
  return [];
}

async function ytEnrich(results) {
  const missing = results.filter((v) => !v.channel);
  if (missing.length === 0) return results;
  await Promise.all(missing.map(async (v) => {
    try {
      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(v.url)}&format=json`, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': YT_SEARCH_UA }
      });
      if (!r.ok) return;
      const info = await r.json();
      if (info && info.author_name) {
        v.channel = info.author_name;
        if (info.title && !v.title) v.title = info.title;
        if (info.thumbnail_url && !v.thumbnail) v.thumbnail = info.thumbnail_url;
      }
    } catch (_) {}
  }));
  return results;
}

async function ytSearchVideos(query, maxResults) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Parameter query tidak boleh kosong.');
  const limit = Math.max(1, Math.min(10, parseInt(maxResults, 10) || 6));
  const key = `${q.toLowerCase()}::${limit}`;
  if (ytSearchCache.has(key)) return ytSearchCache.get(key);

  let results = await ytSearchViaYouTubePage(q, limit);
  if (results.length === 0) results = await ytSearchViaInvidious(q, limit);
  if (results.length > 0) results = await ytEnrich(results);

  const payload = {
    success: results.length > 0,
    query: q,
    count: results.length,
    results,
    error: results.length > 0 ? undefined : 'Tidak ditemukan hasil video. Coba kata kunci lain.'
  };
  if (results.length > 0) {
    if (ytSearchCache.size > 80) ytSearchCache.delete(ytSearchCache.keys().next().value);
    ytSearchCache.set(key, payload);
  }
  return payload;
}

// H8 (Cloudflare Worker): key milik OPERATOR (env OPENROUTER_API_KEY/SERPER_API_KEY)
// hanya dipakai untuk permintaan same-origin / non-browser. Halaman lintas-asal
// tidak pernah menerimanya (ACAO:* tidak lagi berarti pembakaran kredit gratis).
// Front-end di domain terpisah: setel env ZOX_ALLOW_CROSS_ORIGIN=1.
function envKeyAllowed(request, env) {
  try {
    if (env && env.ZOX_ALLOW_CROSS_ORIGIN === '1') return true;
  } catch (_) {}
  const sfs = request.headers.get('sec-fetch-site');
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return false;
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser (curl/fetch tanpa Origin)
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch (_) {
    return false;
  }
}

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
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key, x-serper-key, x-api-key, x-openrouter-key, x-title, X-Title, HTTP-Referer, http-referer, x-session-id, X-Session-ID, x-user-id, X-User-ID, x-client-id, X-Client-ID, x-user-token, X-User-Token'
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
        const apiKey = body.apiKey ? String(body.apiKey).replace(/^Bearer\s+/i, '').trim() : (body.ollamaApiKey ? String(body.ollamaApiKey).replace(/^Bearer\s+/i, '').trim() : (request.headers.get('x-ollama-key') ? String(request.headers.get('x-ollama-key')).replace(/^Bearer\s+/i, '').trim() : ''));
        const authHeader = request.headers.get('Authorization') || (apiKey ? `Bearer ${apiKey}` : '');
        const targetEndpoint = body.endpoint || 'https://ollama.com';
        let cleanEndpoint = (targetEndpoint || 'https://ollama.com').trim();
        if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
          cleanEndpoint = (authHeader ? 'https://' : 'http://') + cleanEndpoint;
        }
        const parsedBase = new URL(cleanEndpoint);
        if (isOllamaEndpointForbidden(cleanEndpoint)) {
          return new Response(JSON.stringify({ error: 'Endpoint Ollama mengarah ke host privat/internal — akses diblokir (SSRF Protection).' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
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
        const key = request.headers.get('x-ollama-key') || request.headers.get('x-api-key') || '';
        const authHeader = request.headers.get('Authorization') || (key ? `Bearer ${String(key).replace(/^Bearer\s+/i, '').trim()}` : '');
        const endpoint = url.searchParams.get('endpoint') || (authHeader ? 'https://ollama.com' : 'http://127.0.0.1:11434');
        const headers = {};
        if (authHeader) headers['Authorization'] = authHeader;

        let cleanEndpoint = (endpoint || '').trim();
        if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
          cleanEndpoint = (authHeader ? 'https://' : 'http://') + cleanEndpoint;
        }
        const parsedBase = new URL(cleanEndpoint);
        if (isOllamaEndpointForbidden(cleanEndpoint)) {
          return new Response(JSON.stringify({ error: 'Endpoint Ollama mengarah ke host privat/internal — akses diblokir (SSRF Protection).' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
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
        let apiKey = body.apiKey || body.openRouterKey || request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '').trim() : '') || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
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
          const qKey = request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
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
          const qKey = request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
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
          const qKey = request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
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
          const qKey = request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
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
          openRouterKey = body.openRouterKey || body.apiKey || (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
        } else {
          prompt = url.searchParams.get('prompt') || url.searchParams.get('q') || '';
          model = url.searchParams.get('model') || model;
          width = parseInt(url.searchParams.get('width'), 10) || width;
          height = parseInt(url.searchParams.get('height'), 10) || height;
          seed = url.searchParams.get('seed') || null;
          openRouterKey = (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
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
        let apiKey = request.headers.get('x-serper-key') || request.headers.get('x-api-key') || (envKeyAllowed(request, env) ? env?.SERPER_API_KEY : null);
        let num = parseInt(url.searchParams.get('num') || url.searchParams.get('limit') || '15', 10);
        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          query = body.query || body.q || query;
          apiKey = body.apiKey || body.serperApiKey || apiKey || (envKeyAllowed(request, env) ? env?.SERPER_API_KEY : null);
          if (body.num || body.limit) num = parseInt(body.num || body.limit, 10);
        }
        if (!query || !query.trim()) {
          return new Response(JSON.stringify({ success: false, error: 'Parameter query `q` atau body `{ query }` diperlukan.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        const targetNum = Math.min(Math.max(isNaN(num) ? 15 : num, 1), 30);
        const serperKey = apiKey || (envKeyAllowed(request, env) ? env?.SERPER_API_KEY : null);
        if (!serperKey) {
          return new Response(JSON.stringify({ success: false, error: 'Serper API key diperlukan. Setel SERPER_API_KEY atau kirim header x-serper-key.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
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

    // YouTube Live Search (penunjang tool search_youtube, zero API key)
    if (url.pathname === '/api/youtube-search' && (request.method === 'GET' || request.method === 'POST')) {
      try {
        let query = '';
        let maxResults = 6;
        if (request.method === 'GET') {
          query = url.searchParams.get('q') || url.searchParams.get('query') || '';
          maxResults = parseInt(url.searchParams.get('limit') || '6', 10) || 6;
        } else {
          const body = await request.json().catch(() => ({}));
          query = body.q || body.query || body.keyword || '';
          maxResults = parseInt(body.limit || body.max_results, 10) || 6;
        }

        if (!query || !String(query).trim()) {
          return new Response(JSON.stringify({ success: false, error: 'Parameter query diperlukan.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const data = await ytSearchVideos(String(query).trim(), maxResults);
        return new Response(JSON.stringify(data), {
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
