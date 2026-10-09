/**
 * YOUTUBE LIVE SEARCH (ZERO API KEY) — penunjang tool `search_youtube`.
 * Dua strategi fallback:
 *   1) Parsing halaman hasil pencarian YouTube (ytInitialData)
 *   2) Instance Invidious publik (API JSON terbuka)
 */
const YOUTUBE_SEARCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.nerdvpn.de'
];
const searchCache = new Map();

function youtubeDurationToSeconds(text) {
  if (!text || typeof text !== 'string') return 0;
  const parts = text.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function extractJsonAfterMarker(source, marker) {
  if (!source || typeof source !== 'string') return null;
  const idx = source.indexOf(marker);
  if (idx === -1) return null;
  const start = source.indexOf('{', idx + marker.length);
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

function ytText(node) {
  if (!node) return '';
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map((r) => (r && r.text) || '').join('');
  if (typeof node.content === 'string') return node.content;
  return '';
}

function mapVideoRenderer(vr) {
  try {
    if (!vr || !vr.videoId) return null;
    const title = ytText(vr.title);
    if (!title) return null;
    const ownerRuns = vr.ownerText && vr.ownerText.runs;
    const ownerNav = ownerRuns && ownerRuns[0] && ownerRuns[0].navigationEndpoint && ownerRuns[0].navigationEndpoint.browseEndpoint;
    const channelPath = ownerNav && ownerNav.canonicalBaseUrl;
    const durationText = ytText(vr.lengthText);
    return {
      videoId: vr.videoId,
      title,
      channel: ytText(vr.ownerText || vr.longBylineText) || '',
      channelUrl: channelPath ? `https://www.youtube.com${channelPath}` : '',
      durationText,
      durationSeconds: youtubeDurationToSeconds(durationText),
      viewText: ytText(vr.viewCountText) || ytText(vr.shortViewCountText),
      publishedText: ytText(vr.publishedTimeText),
      description: ytText(vr.descriptionSnippet).slice(0, 260),
      url: `https://www.youtube.com/watch?v=${vr.videoId}`,
      thumbnail: `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
      source: 'YouTube Search'
    };
  } catch (_) {
    return null;
  }
}

function mapLockupViewModel(lv) {
  try {
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
  } catch (_) {
    return null;
  }
}

function collectYouTubeSearchResults(node, out, limit) {
  if (!node || typeof node !== 'object' || out.length >= limit) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectYouTubeSearchResults(item, out, limit);
      if (out.length >= limit) return;
    }
    return;
  }
  if (node.videoRenderer) {
    const mapped = mapVideoRenderer(node.videoRenderer);
    if (mapped && !out.some((v) => v.videoId === mapped.videoId)) out.push(mapped);
    if (out.length >= limit) return;
  }
  if (node.lockupViewModel && node.lockupViewModel.contentId && String(node.lockupViewModel.contentType || '').toUpperCase().includes('VIDEO')) {
    const mapped = mapLockupViewModel(node.lockupViewModel);
    if (mapped && !out.some((v) => v.videoId === mapped.videoId)) out.push(mapped);
    if (out.length >= limit) return;
  }
  for (const key of Object.keys(node)) {
    collectYouTubeSearchResults(node[key], out, limit);
    if (out.length >= limit) return;
  }
}

async function searchViaYouTubeResultsPage(query, limit) {
  const target = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&gl=US`;
  try {
    const resp = await fetch(target, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': YOUTUBE_SEARCH_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'SOCS=CAI'
      }
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const jsonStr = extractJsonAfterMarker(html, 'ytInitialData');
    if (!jsonStr) return [];
    const data = JSON.parse(jsonStr);
    const results = [];
    collectYouTubeSearchResults(data, results, limit);
    return results;
  } catch (_) {
    return [];
  }
}

async function searchViaInvidious(query, limit) {
  const seenIds = new Set();
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const resp = await fetch(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
        signal: AbortSignal.timeout(7000),
        headers: { 'Accept': 'application/json', 'User-Agent': YOUTUBE_SEARCH_UA }
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
        if (!v.videoId || seenIds.has(v.videoId)) return false;
        seenIds.add(v.videoId);
        return true;
      });
      if (fresh.length) return fresh;
    } catch (_) {
      // lanjut ke instance berikutnya
    }
  }
  return [];
}

async function enrichYouTubeSearchResults(results) {
  const missing = results.filter((v) => !v.channel);
  if (missing.length === 0) return results;
  await Promise.all(missing.map(async (v) => {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(v.url)}&format=json`;
      const r = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': YOUTUBE_SEARCH_UA }
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

async function searchYouTubeVideos(query, maxResults) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Parameter query tidak boleh kosong.');
  const limit = Math.max(1, Math.min(10, parseInt(maxResults, 10) || 6));
  const cacheKey = `${q.toLowerCase()}::${limit}`;
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);

  let results = await searchViaYouTubeResultsPage(q, limit);
  if (results.length === 0) {
    results = await searchViaInvidious(q, limit);
  }
  if (results.length > 0) {
    results = await enrichYouTubeSearchResults(results);
  }

  const payload = {
    success: results.length > 0,
    query: q,
    count: results.length,
    results,
    error: results.length > 0 ? undefined : 'Tidak ditemukan hasil video. Coba kata kunci lain.'
  };
  if (results.length > 0) {
    if (searchCache.size > 80) {
      searchCache.delete(searchCache.keys().next().value);
    }
    searchCache.set(cacheKey, payload);
  }
  return payload;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    let query = '';
    let maxResults = 6;

    if (req.method === 'GET') {
      query = req.query?.q || req.query?.query || '';
      maxResults = parseInt(req.query?.limit, 10) || 6;
    } else {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) {}
      }
      body = body || {};
      query = body.q || body.query || body.keyword || '';
      maxResults = parseInt(body.limit || body.max_results, 10) || 6;
    }

    if (!query || !String(query).trim()) {
      return res.status(400).json({ success: false, error: 'Parameter query diperlukan.' });
    }

    const data = await searchYouTubeVideos(String(query).trim(), maxResults);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
