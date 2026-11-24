function isPrivateHostname(hostname) {
  if (!hostname) return true;
  const h = String(hostname).toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (['localhost','127.0.0.1','::1','0.0.0.0','::','0'].includes(h)) return true;
  // Blokir format integer/hex decimal IP murni (misal 2130706433 atau 0x7f000001)
  if (/^(?:0x[0-9a-f]+|\d+)$/i.test(h)) return true;
  if (/^0\./.test(h)) return true; // 0.0.0.0/8 "this network" (RFC 1122)
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  // Rentang reserved (cocokkan proteksi server-side)
  if (/^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./.test(h)) return true; // 100.64.0.0/10 CGNAT (RFC 6598)
  if (/^192\.0\.0\./.test(h)) return true; // 192.0.0.0/24 IETF protocol assignments (RFC 6890)
  if (/^192\.0\.2\./.test(h)) return true; // 192.0.2.0/24 TEST-NET-1 (RFC 5737)
  if (/^192\.88\.99\./.test(h)) return true; // 192.88.99.0/24 6to4 relay anycast (RFC 3068)
  if (/^198\.(18|19)\./.test(h)) return true; // 198.18.0.0/15 benchmarking (RFC 2544)
  if (/^198\.51\.100\./.test(h)) return true; // 198.51.100.0/24 TEST-NET-2 (RFC 5737)
  if (/^203\.0\.113\./.test(h)) return true; // 203.0.113.0/24 TEST-NET-3 (RFC 5737)
  if (/^(22[4-9]|23[0-9]|24[0-9]|25[0-5])\./.test(h)) return true; // 224.0.0.0/4 multicast & 240.0.0.0/4 reserved (RFC 1112)
  if (/^f[cd][0-9a-f]{0,2}:|^fe[89ab][0-9a-f]{0,2}:/i.test(h)) return true; // IPv6 Unique Local (fc00::/7, incl. fd00::/8) & Link-Local (fe80::/10)
  const zeroNorm = h.replace(/(^|:)0+(?=[0-9a-f])/g, '$1');
  if (zeroNorm === '0:0:0:0:0:0:0:1' || zeroNorm === '0:0:0:0:0:0:0:0') return true;
  if (h.startsWith('::ffff:') || /^(?:0:){5}ffff:/i.test(zeroNorm)) return true; // Block all IPv4-mapped IPv6 (short & expanded)
  if (zeroNorm.startsWith('64:ff9b:') || zeroNorm.startsWith('2002:')) return true; // NAT64 & 6to4
  if (/^::(?:7f[0-9a-f]{0,2}:|a9fe:|c0a8:|0?a[0-9a-f]{0,2}:|ac1[0-9a-f]:)/i.test(h)) return true; // Block IPv4-compatible hex variants (incl. ::a00:1)
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return true;

  // Proteksi DNS Rebinding & Subdomain Private IP Tunnel
  if (/(?:\.|\b)(?:nip|sslip|localtest|lvh|vcap|traefik)\.(?:me|io)$/i.test(h)) return true;
  if (/(?:^|\.)(?:127[\.-]|10[\.-]|192[\.-]168[\.-]|172[\.-](?:1[6-9]|2[0-9]|3[0-1])[\.-]|169[\.-]254[\.-])/i.test(h)) return true;

  return false;
}

function checkOllamaEndpoint(endpointUrl) {
  let parsed;
  try { parsed = new URL(endpointUrl); } catch (e) { return { forbidden: true, reason: 'Format URL Ollama tidak valid.' }; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { forbidden: true, reason: 'Protokol Ollama harus http atau https.' };
  const host = (parsed.hostname || '').toLowerCase();

  // Pada Cloudflare Edge global, koneksi ke 127.0.0.1 / localhost milik server Cloudflare sendiri (bukan komputer user)
  if (['127.0.0.1', 'localhost', '::1', '0.0.0.0', '0'].includes(host)) {
    return {
      forbidden: true,
      reason: 'Ollama lokal (127.0.0.1 / localhost) tidak dapat diakses langsung dari Cloudflare Edge. Gunakan URL publik (seperti Cloudflare Tunnel atau Ngrok), atau jalankan ZOZ Router di server lokal (node server.js).'
    };
  }

  if (isPrivateHostname(host)) {
    return { forbidden: true, reason: 'Endpoint Ollama mengarah ke host privat/internal — akses diblokir (SSRF Protection).' };
  }

  return { forbidden: false };
}

function isOllamaEndpointForbidden(endpointUrl) {
  return checkOllamaEndpoint(endpointUrl).forbidden;
}

function sanitizeOllamaApiKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return '';
  return rawKey.replace(/^Bearer\s+/i, '').replace(/^["']+|["']+$/g, '').trim();
}

function isUnsupportedOllamaChatModel(m) {
  if (!m) return true;
  const id = String(m.name || m.model || m.id || '').toLowerCase().trim();
  if (!id) return true;
  if (id.startsWith('clef:') || id === 'clef') return true;
  if (m.visibility === 'hide' || m.supported_in_api === false) return true;
  if (Array.isArray(m.capabilities) && m.capabilities.length > 0 && !m.capabilities.includes('completion')) return true;
  return false;
}

// Model Resolver: Pertahankan nama model asli yang dipilih pengguna
function resolveOllamaCloudModel(modelId) {
  if (!modelId || typeof modelId !== 'string') return '';
  return modelId.trim();
}

function extractFallbackConclusionFromUnclosedThought(thoughtBody, options = {}) {
  const requireExplicitMarker = Boolean(options && options.requireExplicitMarker);
  const raw = String(thoughtBody || '').replace(/\[(?:Model Penjawab|Model|AI Model|Konteks Percakapan):[^\]]*\]\s*/gi, '').trim();
  if (!raw) return '';
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (/^(?:langkah|step|transkripsi|polaritas|uji\s+opsi|opsi\s+\d|evaluasi)\b/i.test(l)) continue;
    const m = l.match(/(?:kesimpulan|jawaban(?:\s+akhir|\s+yang\s+benar)?|final\s+answer|therefore|jadi\s+jawabannya)\s*[:=-]\s*(.+)$/i);
    if (m && m[1].trim()) return m[1].trim();
  }
  if (requireExplicitMarker) return '';
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

function mapOllamaModelToOpenRouter(modelId) {
  if (!modelId || typeof modelId !== 'string') return 'openrouter/free';
  const id = modelId.trim();
  if (id.includes('/')) return id;
  const lower = id.toLowerCase();
  if (lower === 'beam') return 'reflection/beam-1.0-501b-a23b';
  if (lower.startsWith('gemma4')) return 'google/gemma-4-31b-it:free';
  if (lower.startsWith('deepseek-r1')) return 'deepseek/deepseek-r1:free';
  if (lower.startsWith('deepseek-v3') || lower.startsWith('deepseek-v4')) return 'deepseek/deepseek-chat';
  if (lower.startsWith('qwen')) return 'qwen/qwen-2.5-72b-instruct';
  if (lower.startsWith('llama3')) return 'meta-llama/llama-3.3-70b-instruct:free';
  if (lower.startsWith('nemotron')) return 'nvidia/nemotron-3-ultra-550b-a55b:free';
  return 'openrouter/free';
}

/**
 * Normalizes message history for OpenRouter completions: strips non-standard
 * Ollama image keys, converts image attachments to multimodal parts, and
 * converts tool turns when target model or request disallows native tools.
 */
function normalizeMessagesForOpenRouter(messages, { normalizeTools = false, includeReasoningPrior = false } = {}) {
  const mapped = (Array.isArray(messages) ? messages : []).map((m) => {
    if (!m || typeof m !== 'object') return m;

    if (normalizeTools) {
      if (m.role === 'tool') {
        const toolText = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '');
        return { role: 'user', content: `[DATA HASIL PENELUSURAN ALAT / TOOL]:\n${toolText}` };
      }
      if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        const textContent = m.content || '[Mengeksekusi alat penelusuran otonom]';
        const baseM = { role: 'assistant', content: textContent };
        const priorReasoning = m.reasoning_content || m.reasoning || m.thinking;
        if (includeReasoningPrior || priorReasoning) {
          baseM.reasoning_content = priorReasoning || `Evaluasi analitis dan penalaran konseptual: ${String(textContent).slice(0, 150).replace(/[\r\n]+/g, ' ')}`;
        }
        return baseM;
      }
    }

    const imgs = Array.isArray(m.images) ? m.images : (m.image ? [m.image] : []);
    const cleanMsg = { ...m };
    delete cleanMsg.images;
    delete cleanMsg.image;

    if (cleanMsg.role === 'assistant') {
      const rawTxt = typeof cleanMsg.content === 'string' ? cleanMsg.content : '';
      const existingReasoning = cleanMsg.reasoning_content || cleanMsg.reasoning || cleanMsg.thinking;
      if (existingReasoning) {
        cleanMsg.reasoning_content = existingReasoning;
      } else if (includeReasoningPrior) {
        cleanMsg.reasoning_content = `Evaluasi analitis dan penalaran konseptual: ${rawTxt.slice(0, 150).replace(/[\r\n]+/g, ' ')}`;
      }
      delete cleanMsg.reasoning;
      delete cleanMsg.thinking;
    }

    if (imgs.length > 0 && cleanMsg.role === 'user' && !Array.isArray(cleanMsg.content)) {
      const rawContent = typeof cleanMsg.content === 'string' ? cleanMsg.content : '';
      const textPart = { type: 'text', text: rawContent || 'Analisis gambar ini.' };
      const imageParts = imgs.map((img) => {
        let url = img;
        if (typeof img === 'string' && !img.startsWith('data:image') && !img.startsWith('http://') && !img.startsWith('https://')) {
          url = `data:image/webp;base64,${img}`;
        }
        return { type: 'image_url', image_url: { url } };
      });
      cleanMsg.content = [textPart, ...imageParts];
    }

    return cleanMsg;
  });

  const normalized = [];
  for (const msg of mapped) {
    if (!msg) continue;
    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === 'user' && msg.role === 'user' && typeof prev.content === 'string' && typeof msg.content === 'string') {
      prev.content = `${prev.content}\n\n${msg.content}`;
    } else {
      normalized.push(msg);
    }
  }
  return normalized;
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
  const detailedDesc = (vr.detailedMetadataSnippets?.[0]?.snippetText && ytTextOf(vr.detailedMetadataSnippets[0].snippetText)) || ytTextOf(vr.descriptionSnippet) || '';
  return {
    videoId: vr.videoId,
    title,
    channel: ytTextOf(vr.ownerText || vr.longBylineText) || '',
    channelUrl: channelPath ? `https://www.youtube.com${channelPath}` : '',
    durationText,
    durationSeconds: ytDurationSeconds(durationText),
    viewText: ytTextOf(vr.viewCountText) || ytTextOf(vr.shortViewCountText),
    publishedText: ytTextOf(vr.publishedTimeText),
    description: detailedDesc.slice(0, 600),
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

// ==================== SOURCE GROUNDING & MULTI-SOURCE SYNTHESIS (WHITELIST TOOLS) ====================
const SOURCE_GROUNDING_WHITELIST = [
  'github.com',
  'bloomberg.com',
  'reddit.com',
  'x.com',
  'twitter.com',
  'edition.cnn.com',
  'cnn.com',
  'cna.al',
  'arxiv.org'
];

function isWhitelistedSourceUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl);
    const host = parsed.hostname.toLowerCase();
    return SOURCE_GROUNDING_WHITELIST.some(allowed => host === allowed || host.endsWith('.' + allowed));
  } catch (_) {
    return false;
  }
}

function extractWhitelistedDomain(rawUrl) {
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl);
    const host = parsed.hostname.toLowerCase();
    for (const allowed of SOURCE_GROUNDING_WHITELIST) {
      if (host === allowed || host.endsWith('.' + allowed)) {
        return allowed;
      }
    }
  } catch (_) {}
  return '';
}

function getSourceNameFromUrl(url) {
  const d = extractWhitelistedDomain(url);
  if (d.includes('arxiv.org')) return 'arXiv';
  if (d.includes('github.com')) return 'GitHub';
  if (d.includes('bloomberg.com')) return 'Bloomberg';
  if (d.includes('reddit.com')) return 'Reddit';
  if (d.includes('x.com') || d.includes('twitter.com')) return 'X (Twitter)';
  if (d.includes('cnn.com')) return 'CNN';
  if (d.includes('cna.al')) return 'CNA Albania';
  return d || 'Web Source';
}

function extractKeyPointsFromText(text, maxPoints = 4) {
  if (!text || typeof text !== 'string') return [];
  const sentences = text
    .replace(/\r?\n+/g, ' ')
    .match(/[^.!?]+[.!?]+/g) || [text];
  const valid = sentences
    .map(s => s.trim().replace(/^[-*•\s]+/, ''))
    .filter(s => s.length > 25 && s.length < 250 && !/^(cookie|subscribe|terms|privacy|sign in|advertisement)/i.test(s));
  return valid.slice(0, maxPoints);
}

function parseEdgeAuthenticTimestamp(rawDateStr, urlStr = '', bodyStr = '', nowMs = Date.now()) {
  const MAX_FUTURE_SKEW_MS = 36 * 3600 * 1000;
  const s = String(rawDateStr || '').trim();
  if (s && !/^(terkini|baru|latest|recent|unknown|n\/a|-)$/i.test(s)) {
    const direct = Date.parse(s);
    if (!Number.isNaN(direct) && direct > 946684800000 && direct <= nowMs + MAX_FUTURE_SKEW_MS) return direct;
    const rel = s.match(/(\d+)\s*(detik|menit|jam|hari|minggu|bulan|tahun|second|minute|hour|day|week|month|year)s?\s*(?:yang\s*)?(?:lalu|ago)/i);
    if (rel) {
      const n = parseInt(rel[1], 10);
      const u = rel[2].toLowerCase();
      const map = { detik: 1e3, second: 1e3, menit: 6e4, minute: 6e4, jam: 36e5, hour: 36e5, hari: 864e5, day: 864e5, minggu: 6048e5, week: 6048e5, bulan: 2592e6, month: 2592e6, tahun: 31536e6, year: 31536e6 };
      if (map[u]) return nowMs - n * map[u];
    }
  }
  const uMatch = String(urlStr || '').match(/\/(20[12]\d)[\/\-](0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])(?:\/|$|\b)/);
  if (uMatch) {
    const ts = Date.UTC(parseInt(uMatch[1], 10), parseInt(uMatch[2], 10) - 1, parseInt(uMatch[3], 10), 12, 0, 0);
    if (ts <= nowMs + MAX_FUTURE_SKEW_MS) return ts;
  }
  const bMatch = String(bodyStr || '').slice(0, 600).match(/\b(20[12]\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (bMatch) {
    const ts = Date.UTC(parseInt(bMatch[1], 10), parseInt(bMatch[2], 10) - 1, parseInt(bMatch[3], 10), 12, 0, 0);
    if (ts <= nowMs + MAX_FUTURE_SKEW_MS) return ts;
  }
  return null;
}

function computeEdgeRecencyProfile(query, contextText = '', nowMs = Date.now()) {
  const combined = `${query || ''} ${(contextText || '').slice(0, 300)}`.toLowerCase();
  const curYear = new Date(nowMs).getUTCFullYear();
  const yearMatches = (String(query || '').match(/\b(19\d{2}|20[0-3]\d)\b/g) || []).map(Number);
  const explicitPastYear = yearMatches.find(y => y < curYear) || null;
  if (explicitPastYear && !yearMatches.includes(curYear)) {
    return { alpha: 0.08, halfLifeDays: 1825, lambda: Math.LN2 / 1825, targetHistoricalYear: explicitPastYear };
  }
  let p = 0;
  const combineOr = (w) => { p = 1 - (1 - p) * (1 - w); };
  if (/\b(hari\s+ini|today|breaking|barusan|detik\s+ini|right\s+now|live)\b/i.test(combined)) combineOr(0.96);
  if (/\b(minggu\s+ini|pekan\s+ini|this\s+week|kemarin|yesterday)\b/i.test(combined)) combineOr(0.92);
  if (/\b(terbaru|terkini|latest|newest|recent|baru\s+rilis|rilis\s+terbaru|new\s+release|update\s+terbaru|saat\s+ini|sekarang)\b/i.test(combined)) combineOr(0.88);
  if (yearMatches.includes(curYear)) combineOr(0.82);
  if (/\b(rilis|release|launched|announc\w*|berita|news|harga|price|kurs|skor|benchmark)\b/i.test(combined)) combineOr(0.55);
  const alpha = Number(Math.min(0.99, Math.max(0.05, p)).toFixed(4));
  const halfLifeDays = alpha >= 0.90 ? 14 : (alpha >= 0.75 ? 25 : (alpha >= 0.50 ? 60 : 365));
  return { alpha, halfLifeDays, lambda: Math.LN2 / halfLifeDays, targetHistoricalYear: null };
}

function rankEdgeDocumentsMathematically(candidates, query, profile, nowMs = Date.now(), options = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const STOP = new Set([
    'apa','siapa','kapan','dimana','bagaimana','mengapa','kenapa','apakah','adalah','yang','dan','atau','di','ke','dari',
    'untuk','pada','dengan','ini','itu','coba','cari','carikan','tolong','internet','google','terbaru','terkini','hari',
    'minggu','bulan','tahun','antara','tentang','what','which','who','when','where','how','why','does','do','makes','make',
    'different','from','between','the','and','or','in','to','for','with','this','that','please','find','latest','newest','recent','today'
  ]);
  const MODIFIERS = new Set([
    'perbedaan','persamaan','perbandingan','definisi','pengertian','arti','cara','panduan','harga','berita','update','rilis',
    'perkembangan','difference','differences','versus','vs','compare','comparison','custom','built','built-in','guide','news','price','release'
  ]);
  const SYN = {
    rilis: ['release','released','launch','launched','announcing','introduced'],
    model: ['models','llm','foundation','frontier','architecture'],
    ai: ['artificial','intelligence','llm','genai','kecerdasan'],
    kecerdasan: ['artificial','intelligence','ai'],
    buatan: ['artificial','ai'],
    berita: ['news','report','update'],
    makalah: ['paper','papers','article','preprint','study'],
    jurnal: ['journal','paper','research'],
    riset: ['research','study','paper'],
    terbaik: ['best','top','benchmark'],
    manajer: ['manager','managers','management','manajemen'],
    manajemen: ['management','manager','managers','manajer'],
    proyek: ['project','projects'],
    program: ['program','programs','programme'],
    portofolio: ['portfolio','portfolios'],
    alat: ['tool','tools'],
    pencarian: ['search','retrieval'],
    penyunting: ['editor','editors']
  };
  const expandVar = (tok) => {
    const out = new Set([tok]);
    if (tok.includes('-')) for (const p of tok.split('-')) if (p.length >= 3 && !STOP.has(p)) out.add(p);
    if (tok.endsWith('nya') && tok.length >= 5) out.add(tok.slice(0, -3));
    if (tok.endsWith('ies') && tok.length >= 5) out.add(tok.slice(0, -3) + 'y');
    else if (tok.endsWith('es') && tok.length >= 5 && /(?:ches|shes|xes|zes|ses)$/.test(tok)) out.add(tok.slice(0, -2));
    else if (tok.endsWith('s') && !tok.endsWith('ss') && !tok.endsWith('us') && !tok.endsWith('is') && tok.length >= 4) out.add(tok.slice(0, -1));
    else if (tok.length >= 3 && !tok.endsWith('s')) out.add(tok + 's');
    for (const s of [...out]) {
      for (const syn of (SYN[s] || [])) out.add(syn);
    }
    return out;
  };
  const baseTokens = String(query || '').toLowerCase().replace(/[^\p{L}\p{N}.+-]+/gu, ' ').split(/\s+/).filter(t => t.length >= 2 && !STOP.has(t) && !/^20[12]\d$/.test(t));
  const essentialTokens = [...new Set(baseTokens.filter(t => !MODIFIERS.has(t)))];
  const essentialSet = essentialTokens.length > 0 ? essentialTokens : [...new Set(baseTokens)];
  const qTerms = [];
  const seenT = new Set();
  for (const t of baseTokens) {
    if (!seenT.has(t)) { seenT.add(t); qTerms.push({ term: t, weight: 1.0 }); }
    for (const s of expandVar(t)) {
      if (!seenT.has(s) && !STOP.has(s)) { seenT.add(s); qTerms.push({ term: s, weight: 0.80 }); }
    }
  }
  const N = candidates.length;
  const tokenizeDoc = (str) => {
    const raw = String(str || '').toLowerCase().replace(/[^\p{L}\p{N}.+-]+/gu, ' ').split(/\s+/).filter(Boolean);
    const out = [];
    for (const r of raw) {
      out.push(r);
      if (r.includes('-')) for (const sub of r.split('-')) if (sub.length >= 2) out.push(sub);
    }
    return out;
  };
  const docs = candidates.map(item => {
    const titleToks = tokenizeDoc(item.title || '');
    const snipToks = tokenizeDoc(item.snippet || '');
    let urlToks = [];
    try {
      const uo = new URL(item.url || '');
      urlToks = tokenizeDoc(`${uo.hostname.replace(/^www\./i, '')} ${decodeURIComponent(uo.pathname)}`);
    } catch (_) {}
    const contToks = tokenizeDoc(String(item.content || '').slice(0, 3500));
    const tf = new Map();
    const add = (arr, w) => { for (const tok of arr) tf.set(tok, (tf.get(tok) || 0) + w); };
    add(titleToks, 4.0); add(snipToks, 2.0); add(urlToks, 2.0); add(contToks, 1.0);
    const dl = titleToks.length * 4 + snipToks.length * 2 + contToks.length + 1;
    const ts = parseEdgeAuthenticTimestamp(item.published_at || item.published_date || item.pubDate || '', item.url || '', `${item.title || ''} ${item.snippet || ''}`, nowMs);
    return { item, tf, dl, ts };
  });
  const avgDl = docs.reduce((s, d) => s + d.dl, 0) / Math.max(1, N);
  const df = new Map();
  for (const q of qTerms) {
    let c = 0;
    for (const d of docs) if ((d.tf.get(q.term) || 0) > 0) c++;
    df.set(q.term, c);
  }
  const hasFreshVerified = docs.some(d => d.ts !== null && ((nowMs - d.ts) / 864e5) <= 90);
  const k1 = 1.5, b = 0.75, kappa = 3.2;
  const scored = [];
  for (const d of docs) {
    let bm25 = 0;
    for (const q of qTerms) {
      const f = d.tf.get(q.term) || 0;
      if (f <= 0) continue;
      const dfi = df.get(q.term) || 0;
      const idf = Math.log(1 + (N - dfi + 0.5) / (dfi + 0.5)) + 0.35;
      bm25 += q.weight * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (d.dl / avgDl))));
    }
    if (qTerms.length > 0 && bm25 <= 0.05) {
      if (options.isWhitelistedPool) {
        bm25 = 0.25;
      } else {
        continue;
      }
    }
    if (!options.isWhitelistedPool && essentialSet.length > 0) {
      let matchedE = 0;
      for (const eq of essentialSet) {
        let hit = false;
        for (const v of expandVar(eq)) {
          if ((d.tf.get(v) || 0) > 0) { hit = true; break; }
        }
        if (hit) matchedE++;
      }
      const E = essentialSet.length;
      const minReq = E === 1 ? 1 : (E <= 4 ? 2 : Math.min(4, Math.max(2, Math.ceil(Math.sqrt(E)))));
      if (matchedE < minReq) continue;
    }
    let ageDays = null;
    let temporalFactor = 1.0;
    if (d.ts !== null) {
      ageDays = Math.max(0, (nowMs - d.ts) / 864e5);
      if (profile.alpha >= 0.70 && hasFreshVerified && ageDays > 120) continue;
      temporalFactor = (1 - profile.alpha) + profile.alpha * Math.exp(-profile.lambda * ageDays);
    } else {
      temporalFactor = profile.alpha >= 0.70 ? 0.18 : (profile.alpha >= 0.55 ? 0.75 : 1.0);
    }
    const lexNorm = bm25 / (bm25 + kappa);
    const finalScore = lexNorm * temporalFactor;
    scored.push({
      ...d.item,
      timestamp: d.ts || 0,
      pubDate: d.ts !== null ? new Date(d.ts).toISOString().slice(0, 10) : '',
      ageDays: ageDays !== null ? Number(ageDays.toFixed(2)) : null,
      mathematicalScore: Number(finalScore.toFixed(4))
    });
  }
  scored.sort((a, b) => b.mathematicalScore - a.mathematicalScore);
  return scored;
}

// ==================== GLOBAL SEARCH & ENGLISH QUERY ADAPTER ====================
// Memastikan kueri pencarian otonom menjangkau indeks internasional/global
// dan mengonversi topik pengguna berbahasa Indonesia menjadi kata kunci pencarian bahasa Inggris global.
const INDO_DOMESTIC_PATTERN = /\b(indonesia|indonesian|jakarta|jabar|jatim|jateng|bandung|surabaya|medan|semarang|yogyakarta|jogja|bali|denpasar|aceh|sumatera|papua|kalimantan|sulawesi|nusantara|ikn\b|rupiah|idr\b|bmkg|pilkada|pemilu|kpu\b|bawaslu|prabowo|gibran|jokowi|bansos|bpjs|kominfo|menkominfo|kemendagri|kemenkes|kemendikbud|bumn|kemenkeu|sri mulyani|tni\b|polri|polda|polres|kapolri|dpr\b|mpr\b|dpd\b|kpk\b|kejagung|bca\b|mandiri\b|bri\b|bni\b|pertamina|pln\b)\b/i;

function isExplicitDomesticIndoQuery(str) {
  if (!str || typeof str !== 'string') return false;
  return INDO_DOMESTIC_PATTERN.test(str);
}

const INDO_WORDS_PATTERN = /\b(apa|apakah|siapa|siapakah|bagaimana|bagaimanakah|gimana|gimanakah|mengapa|kenapa|kapan|dimana|ke mana|di mana|dari mana|mana|yang|dan|atau|tetapi|namun|dengan|untuk|bagi|pada|di|ke|dari|tentang|mengenai|soal|terkait|adalah|ialah|yaitu|yakni|merupakan|bisa|dapat|terbaru|terkini|berita|warta|kabar|hari ini|minggu ini|bulan ini|tahun ini|sekarang|saat ini|kemarin|besok|perkembangan|kemajuan|penelitian|riset|penemuan|fitur|pembaruan|rilis|peluncuran|ulasan|panduan|cara|tips|trik|harga|biaya|pasar|saham|uang|bursa|ekonomi|keuangan|teknologi|sains|ilmiah|kesehatan|medis|kedokteran|penyakit|obat|perang|senjata|militer|dunia|internasional|luar angkasa|mobil|listrik|cuaca|gempa|keamanan|jaringan|kinerja|kecepatan|terbaik|tercepat|terbesar|faktor|penyebab|dampak|alasan|penjelasan|analisis|tolong|carikan|cari|bantu|coba|berapa|seperti|kayak|fungsi|arti|maksud|contoh)\b/i;

function hasIndonesianWords(str) {
  if (!str || typeof str !== 'string') return false;
  return INDO_WORDS_PATTERN.test(str);
}

const REPUTABLE_TECH_DOMAINS = new Set([
  'reuters.com', 'bloomberg.com', 'axios.com', 'apnews.com', 'wsj.com',
  'techcrunch.com', 'theverge.com', 'wired.com', 'arstechnica.com', 'venturebeat.com',
  'engadget.com', 'zdnet.com', 'tomshardware.com', 'anandtech.com',
  'openai.com', 'anthropic.com', 'deepmind.google', 'ai.meta.com', 'blog.google',
  'microsoft.com', 'nvidia.com', 'huggingface.co', 'github.com',
  'arxiv.org', 'nature.com', 'science.org', 'technologyreview.com',
  'mit.edu', 'stanford.edu', 'bbc.com', 'cnbc.com', 'ft.com'
]);

const GLOBAL_SEARCH_PHRASE_DICT = [
  [/\bbotol minuman termostatik(?:nya)?\b/gi, 'thermos vacuum flask thermostatic bottle'],
  [/\bbotol termostatik(?:nya)?\b/gi, 'thermos vacuum flask bottle'],
  [/\bbotol minum(?:an)?(?:nya)?\b/gi, 'water bottle flask'],
  [/\bgempa bumi(?:nya)?\b/gi, 'earthquake'],
  [/\bangin topan(?:nya)?\b/gi, 'typhoon hurricane'],
  [/\bgunung berapi(?:nya)?\b/gi, 'volcano eruption'],
  [/\btanah longsor(?:nya)?\b/gi, 'landslide'],
  [/\bpanel surya(?:nya)?\b/gi, 'solar panels'],
  [/\bbaterai litium(?:nya)?\b/gi, 'lithium battery'],
  [/\bkartu grafis(?:nya)?\b/gi, 'graphics card gpu'],
  [/\bprosesor komputer(?:nya)?\b/gi, 'cpu processor'],
  [/\blubang hitam(?:nya)?\b/gi, 'black hole'],
  [/\bteori relativitas(?:nya)?\b/gi, 'theory of relativity'],
  [/\btata surya(?:nya)?\b/gi, 'solar system'],
  [/\brekayasa genetika(?:nya)?\b/gi, 'genetic engineering'],
  [/\bpembangkit listrik(?:nya)?\b/gi, 'power plant generator'],
  [/\bberita besar(?:nya)?\b/gi, 'major news headlines'],
  [/\bmodel(?:-model)? ai\b/gi, 'ai models'],
  [/\bmodel(?:-model)? llm\b/gi, 'llm models'],
  [/\bmodel penalaran(?:nya)?\b/gi, 'reasoning models'],
  [/\bmodel multimodal(?:nya)?\b/gi, 'multimodal models'],
  [/\bmodel terbuka(?:nya)?\b/gi, 'open source ai models'],
  [/\bperkembangan ai(?:nya)?\b/gi, 'ai developments'],
  [/\bterobosan ai(?:nya)?\b/gi, 'ai breakthroughs'],
  [/\bagen ai(?:nya)?\b/gi, 'ai agents'],
  [/\braksasa teknologi\b/gi, 'big tech companies'],
  [/\bperusahaan teknologi\b/gi, 'tech companies'],
  [/\bkecerdasan buatan generatif\b/gi, 'generative ai'],
  [/\bkecerdasan umum buatan(?:nya)?\b/gi, 'artificial general intelligence'],
  [/\bkecerdasan buatan(?:nya)?\b/gi, 'artificial intelligence'],
  [/\bpembelajaran mesin(?:nya)?\b/gi, 'machine learning'],
  [/\bjaringan saraf(?:nya)?\b/gi, 'neural networks'],
  [/\bpemrosesan bahasa alami(?:nya)?\b/gi, 'natural language processing'],
  [/\bmodel bahasa besar(?:nya)?\b/gi, 'large language models'],
  [/\bmodel bahasa(?:nya)?\b/gi, 'language models'],
  [/\brekayasa prompt(?:nya)?\b/gi, 'prompt engineering'],
  [/\bbursa saham(?:nya)?\b/gi, 'stock market'],
  [/\bpasar saham(?:nya)?\b/gi, 'stock market'],
  [/\bpasar modal(?:nya)?\b/gi, 'capital market'],
  [/\bnilai tukar mata uang(?:nya)?\b/gi, 'currency exchange rate'],
  [/\bnilai tukar(?:nya)?\b/gi, 'exchange rate'],
  [/\bmata uang(?:nya)?\b/gi, 'currency'],
  [/\bsuku bunga(?:nya)?\b/gi, 'interest rates'],
  [/\bminyak bumi(?:nya)?\b/gi, 'crude oil'],
  [/\bmobil listrik(?:nya)?\b/gi, 'electric vehicles'],
  [/\bluar angkasa(?:nya)?\b/gi, 'space exploration'],
  [/\btimur tengah(?:nya)?\b/gi, 'middle east'],
  [/\bperang dunia(?:nya)?\b/gi, 'world war'],
  [/\bperubahan iklim(?:nya)?\b/gi, 'climate change'],
  [/\bpemanasan global(?:nya)?\b/gi, 'global warming'],
  [/\benergi terbarukan(?:nya)?\b/gi, 'renewable energy'],
  [/\btenaga nuklir(?:nya)?\b/gi, 'nuclear energy'],
  [/\bdunia nyata(?:nya)?\b/gi, 'real world'],
  [/\bgaya hidup(?:nya)?\b/gi, 'lifestyle'],
  [/\bfitur baru(?:nya)?\b/gi, 'new features'],
  [/\bberita terbaru(?:nya)?\b/gi, 'latest news'],
  [/\bberita terkini(?:nya)?\b/gi, 'breaking news'],
  [/\bberita dunia(?:nya)?\b/gi, 'world news'],
  [/\bkabar terbaru(?:nya)?\b/gi, 'latest updates'],
  [/\bhari ini\b/gi, 'today'],
  [/\bminggu ini\b/gi, 'this week'],
  [/\bbulan ini\b/gi, 'this month'],
  [/\btahun ini\b/gi, 'this year'],
  [/\bsaat ini\b/gi, 'current'],
  [/\bcara kerja(?:nya)?\b/gi, 'how it works'],
  [/\bcara menggunakan(?:nya)?\b/gi, 'how to use'],
  [/\brekayasa perangkat lunak(?:nya)?\b/gi, 'software engineering'],
  [/\bsistem operasi(?:nya)?\b/gi, 'operating system'],
  [/\bkomputasi awan(?:nya)?\b/gi, 'cloud computing'],
  [/\bkomputasi kuantum(?:nya)?\b/gi, 'quantum computing'],
  [/\bkeamanan siber(?:nya)?\b/gi, 'cybersecurity'],
  [/\buji coba(?:nya)?\b/gi, 'trial test'],
  [/\bdampak negatif(?:nya)?\b/gi, 'negative impacts'],
  [/\bdampak positif(?:nya)?\b/gi, 'positive impacts'],
  [/\bkurs dollar(?:nya)?\b/gi, 'usd exchange rate'],
  [/\bkurs euro(?:nya)?\b/gi, 'eur exchange rate'],
  [/\bliga champions\b/gi, 'champions league'],
  [/\bliga inggris\b/gi, 'premier league'],
  [/\bsepak bola\b/gi, 'football soccer']
];

const GLOBAL_SEARCH_WORD_DICT = [
  [/\btermostatik(?:nya)?\b/gi, 'thermostatic vacuum flask'],
  [/\btermos(?:nya)?\b/gi, 'thermos flask'],
  [/\bbotol(?:nya)?\b/gi, 'bottle'],
  [/\bminuman(?:nya)?\b/gi, 'beverage'],
  [/\bpemula(?:nya)?\b/gi, 'beginners'],
  [/\bbumi\b/gi, 'earth'],
  [/\bterbaru(?:nya)?\b/gi, 'latest'],
  [/\bterkini(?:nya)?\b/gi, 'latest'],
  [/\bmutakhir(?:nya)?\b/gi, 'state of the art'],
  [/\bbesar(?:nya)?\b/gi, 'major'],
  [/\bmodel(?:nya)?\b/gi, 'model'],
  [/\btercanggih(?:nya)?\b/gi, 'most advanced'],
  [/\bcanggih(?:nya)?\b/gi, 'advanced'],
  [/\bterobosan(?:nya)?\b/gi, 'breakthrough'],
  [/\bbocoran(?:nya)?\b/gi, 'leak rumor'],
  [/\bsaingan(?:nya)?\b/gi, 'competitor alternative'],
  [/\bpopuler(?:nya)?\b/gi, 'popular trending'],
  [/\btren(?:nya)?\b/gi, 'trends'],
  [/\blaboratorium(?:nya)?\b/gi, 'lab research'],
  [/\bkemampuan(?:nya)?\b/gi, 'capabilities performance'],
  [/\bberita(?:nya)?\b/gi, 'news'],
  [/\bwarta(?:nya)?\b/gi, 'news'],
  [/\bkabar(?:nya)?\b/gi, 'news'],
  [/\bperkembangan(?:nya)?\b/gi, 'developments'],
  [/\bkemajuan(?:nya)?\b/gi, 'advancements'],
  [/\bpenelitian(?:nya)?\b/gi, 'research'],
  [/\briset(?:nya)?\b/gi, 'research'],
  [/\bpenemuan(?:nya)?\b/gi, 'discoveries'],
  [/\bpeluncuran(?:nya)?\b/gi, 'launch'],
  [/\brilis(?:nya)?\b/gi, 'release'],
  [/\bpembaruan(?:nya)?\b/gi, 'update'],
  [/\bfitur(?:nya)?\b/gi, 'features'],
  [/\bspesifikasi(?:nya)?\b/gi, 'specifications'],
  [/\bkelebihan(?:nya)?\b/gi, 'advantages'],
  [/\bkekurangan(?:nya)?\b/gi, 'limitations'],
  [/\bperbandingan(?:nya)?\b/gi, 'comparison'],
  [/\bulasan(?:nya)?\b/gi, 'review'],
  [/\bpanduan(?:nya)?\b/gi, 'guide'],
  [/\btutorial(?:nya)?\b/gi, 'tutorial'],
  [/\bbelajar(?:nya)?\b/gi, 'learn'],
  [/\bcara(?:nya)?\b/gi, 'how to'],
  [/\bharga(?:nya)?\b/gi, 'price'],
  [/\bbiaya(?:nya)?\b/gi, 'cost'],
  [/\btarif(?:nya)?\b/gi, 'rates'],
  [/\bsaham(?:nya)?\b/gi, 'stocks'],
  [/\bkeuangan(?:nya)?\b/gi, 'finance'],
  [/\bekonomi(?:nya)?\b/gi, 'economy'],
  [/\bkripto(?:nya)?\b/gi, 'crypto'],
  [/\bkoin(?:nya)?\b/gi, 'coins'],
  [/\bemas(?:nya)?\b/gi, 'gold price'],
  [/\bperak(?:nya)?\b/gi, 'silver price'],
  [/\bminyak(?:nya)?\b/gi, 'oil price'],
  [/\bkesehatan(?:nya)?\b/gi, 'health'],
  [/\bmedis(?:nya)?\b/gi, 'medical'],
  [/\bkedokteran(?:nya)?\b/gi, 'medicine'],
  [/\bpenyakit(?:nya)?\b/gi, 'disease'],
  [/\bvaksin(?:nya)?\b/gi, 'vaccine'],
  [/\bobat(?:nya)?\b/gi, 'treatment medication'],
  [/\bkanker(?:nya)?\b/gi, 'cancer treatment'],
  [/\bteknologi(?:nya)?\b/gi, 'technology'],
  [/\bsains(?:nya)?\b/gi, 'science'],
  [/\bilmiah(?:nya)?\b/gi, 'scientific'],
  [/\bcuaca(?:nya)?\b/gi, 'weather'],
  [/\bbadai(?:nya)?\b/gi, 'storm'],
  [/\bgempa(?:nya)?\b/gi, 'earthquake'],
  [/\bbanjir(?:nya)?\b/gi, 'flood'],
  [/\btsunami(?:nya)?\b/gi, 'tsunami'],
  [/\bperang(?:nya)?\b/gi, 'war conflict'],
  [/\bsenjata(?:nya)?\b/gi, 'weapons'],
  [/\bmiliter(?:nya)?\b/gi, 'military'],
  [/\bpemerintah(?:nya)?\b/gi, 'government'],
  [/\bkebijakan(?:nya)?\b/gi, 'policy'],
  [/\bhukum(?:nya)?\b/gi, 'law'],
  [/\baturan(?:nya)?\b/gi, 'regulations'],
  [/\bputusan(?:nya)?\b/gi, 'ruling'],
  [/\bdunia(?:nya)?\b/gi, 'world'],
  [/\bglobal(?:nya)?\b/gi, 'global'],
  [/\binternasional(?:nya)?\b/gi, 'international'],
  [/\bindustri(?:nya)?\b/gi, 'industry'],
  [/\bperusahaan(?:nya)?\b/gi, 'companies'],
  [/\bpasar(?:nya)?\b/gi, 'market'],
  [/\bmobil(?:nya)?\b/gi, 'cars'],
  [/\bkendaraan(?:nya)?\b/gi, 'vehicles'],
  [/\bpesawat(?:nya)?\b/gi, 'aircraft'],
  [/\brobot(?:nya)?\b/gi, 'robotics'],
  [/\brobotika(?:nya)?\b/gi, 'robotics'],
  [/\bfaktor(?:nya)?\b/gi, 'factors'],
  [/\bpenyebab(?:nya)?\b/gi, 'causes'],
  [/\bdampak(?:nya)?\b/gi, 'impacts'],
  [/\balasan(?:nya)?\b/gi, 'reasons'],
  [/\bpenjelasan(?:nya)?\b/gi, 'explanation'],
  [/\banalisis(?:nya)?\b/gi, 'analysis'],
  [/\bkeamanan(?:nya)?\b/gi, 'security'],
  [/\bkecepatan(?:nya)?\b/gi, 'speed'],
  [/\bkinerja(?:nya)?\b/gi, 'performance'],
  [/\bterbaik(?:nya)?\b/gi, 'best'],
  [/\btercepat(?:nya)?\b/gi, 'fastest'],
  [/\bterbesar(?:nya)?\b/gi, 'biggest'],
  [/\bpemenang(?:nya)?\b/gi, 'winner'],
  [/\bjuara(?:nya)?\b/gi, 'champion'],
  [/\bkondisi(?:nya)?\b/gi, 'conditions'],
  [/\bkeadaan(?:nya)?\b/gi, 'state condition'],
  [/\bbaterai(?:nya)?\b/gi, 'battery'],
  [/\benergi(?:nya)?\b/gi, 'energy'],
  [/\bliga(?:nya)?\b/gi, 'league'],
  [/\bfungsi(?:nya)?\b/gi, 'functionality'],
  [/\barti(?:nya)?\b/gi, 'meaning definition'],
  [/\bmaksud(?:nya)?\b/gi, 'definition'],
  [/\bcontoh(?:nya)?\b/gi, 'examples'],
  [/\bpenggunaan(?:nya)?\b/gi, 'usage'],
  [/\bpenerapan(?:nya)?\b/gi, 'application'],
  [/\bsekarang\b/gi, 'now']
];

const GLOBAL_SEARCH_STOPWORDS = /\b(apa|apakah|siapa|siapakah|bagaimana|bagaimanakah|gimana|gimanakah|mengapa|kenapa|kapan|dimana|ke mana|di mana|dari mana|mana|berapa|seperti|kayak|yang|dan|atau|tetapi|namun|dengan|untuk|bagi|pada|di|ke|dari|tentang|mengenai|soal|terkait|adalah|ialah|yaitu|yakni|merupakan|bisa|dapat|tolong|coba|carikan|cari|bantu|tampilkan|berikan|sebutkan|jelaskan|paparkan|terangkan|ceritakan|nya|kah|lah|saja|pun|dong|sih|kok|deh|ya|kan|ada|sudah|telah|sedang|lagi|akan|pernah|kalian|kamu|anda|kita|saya|nih|tuh|lho|loh|kira|kira-kira)\b/gi;

function translateIndoQueryToGlobalEnglish(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return '';
  return rawQuery.trim();
}

// Keamanan Kuota Operator (Cloudflare Worker):
// Kunci API milik operator (env OPENROUTER_API_KEY / OLLAMA_API_KEY) HANYA boleh dipakai
// untuk permintaan yang terverifikasi berasal dari aplikasi web same-origin (melalui Origin/Referer)
// atau klien yang menyertakan operator shared secret (x-operator-secret / x-admin-key).
// Klien eksternal non-browser (cURL, Postman, automated scraper) TANPA otentikasi DILARANG
// menggunakan kunci operator secara cuma-cuma.
function envKeyAllowed(request, env) {
  try {
    if (env && env.ZOX_ALLOW_CROSS_ORIGIN === '1') return true;
  } catch (_) {}

  // 1. Operator Shared Secret untuk akses terotorisasi dari CLI / subagent
  const operatorSecret = request.headers.get('x-operator-secret') || request.headers.get('x-admin-key');
  if (operatorSecret && env && env.ZOX_OPERATOR_SECRET && operatorSecret === env.ZOX_OPERATOR_SECRET) {
    return true;
  }

  // 2. Proteksi lintas-asal browser (wajib ada Sec-Fetch-Site: same-origin / same-site kecuali diizinkan eksplisit)
  const sfs = (request.headers.get('sec-fetch-site') || '').toLowerCase();
  const allowNonBrowser = Boolean(env && (env.ZOX_ALLOW_NON_BROWSER === '1' || env.ZOX_ALLOW_CURL === '1'));
  if (!sfs) {
    if (!allowNonBrowser) return false;
  } else if (sfs !== 'same-origin' && sfs !== 'same-site' && sfs !== 'none') {
    return false;
  }

  let reqHost = '';
  try {
    reqHost = new URL(request.url).host;
  } catch (_) {
    return false;
  }

  // 3. Validasi Origin browser
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === reqHost;
    } catch (_) {
      return false;
    }
  }

  // 4. Validasi Referer browser
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === reqHost;
    } catch (_) {
      return false;
    }
  }

  // 5. Permintaan non-browser tanpa Origin/Referer (cURL, scraper) tidak boleh membakar kuota operator,
  // kecuali jika operator secara eksplisit mengaktifkannya via ZOX_ALLOW_NON_BROWSER='1'.
  if (env && (env.ZOX_ALLOW_NON_BROWSER === '1' || env.ZOX_ALLOW_CURL === '1')) {
    return true;
  }

  return false;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key, x-api-key, x-openrouter-key, x-serper-key, x-auto-router, X-Auto-Router, x-title, X-Title, HTTP-Referer, http-referer, x-session-id, X-Session-ID, x-user-id, X-User-ID, x-client-id, X-Client-ID, x-user-token, X-User-Token, x-wa-user-id, X-WA-USER-ID, x-wa-pin, X-WA-PIN, x-terminal-pin, X-Terminal-Pin, Access-Control-Request-Private-Network'
        }
      });
    }

    // Dedicated Laptop Hardware & Daemon Bridge:
    // HANYA Terminal, WhatsApp Gateway lokal, kontrol daemon/tunnel lokal, dan aset fisik disk laptop
    // yang diteruskan ke TUNNEL_GATEWAY_URL (server laptop).
    // Pemanggilan AI & API Key (OpenRouter, Ollama Cloud, Search Web, Models, Sessions)
    // BERJALAN 100% MANDIRI DI CLOUDFLARE EDGE TANPA PERNAH BERGANTUNG PADA LAPTOP!
    const TUNNEL_GATEWAY_URL = String((env && env.TUNNEL_GATEWAY_URL) || 'https://navy-perfect-exam-thehun.trycloudflare.com').replace(/\/+$/, '');
    let reqBodyBytes = null;

    const isLaptopOnlyRoute = url.pathname.startsWith('/api/terminal') ||
      url.pathname.startsWith('/api/wa/') ||
      url.pathname.startsWith('/api/tunnel/') ||
      url.pathname.startsWith('/api/daemon/') ||
      url.pathname === '/api/workspace' ||
      url.pathname.startsWith('/api/workspace/') ||
      url.pathname === '/api/ollama/start' ||
      url.pathname.startsWith('/uploads/');

    if (isLaptopOnlyRoute) {
      const targetUrl = TUNNEL_GATEWAY_URL + url.pathname + url.search;
      const fwdHeaders = new Headers(request.headers);
      fwdHeaders.set('Host', new URL(TUNNEL_GATEWAY_URL).host);
      fwdHeaders.set('X-Forwarded-Host', url.host);
      fwdHeaders.set('X-Forwarded-Proto', 'https');
      fwdHeaders.set('X-Real-IP', request.headers.get('cf-connecting-ip') || '127.0.0.1');

      const fetchInit = {
        method: request.method,
        headers: fwdHeaders,
        redirect: 'follow'
      };

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          reqBodyBytes = await request.arrayBuffer();
        } catch (_) {}
        if (reqBodyBytes && reqBodyBytes.byteLength > 0) {
          fetchInit.body = reqBodyBytes;
          fetchInit.duplex = 'half';
        }
      }

      try {
        const upstream = await fetch(targetUrl, fetchInit);
        if (upstream.status === 101 || upstream.webSocket) {
          return upstream;
        }
        const resHeaders = new Headers(upstream.headers);
        resHeaders.set('Access-Control-Allow-Origin', '*');
        resHeaders.set('Access-Control-Allow-Private-Network', 'true');
        resHeaders.set('X-Accel-Buffering', 'no');
        resHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');

        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: resHeaders
        });
      } catch (proxyErr) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Layanan lokal laptop sedang tidak terhubung via tunnel: ' + proxyErr.message,
          tunnelUrl: TUNNEL_GATEWAY_URL
        }), {
          status: 502,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // Gateway root info
    if ((url.pathname === '/api' || url.pathname === '/api/') && request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'online',
        name: 'ZOZ ROUTER Neural Gateway (Cloudflare Edge)',
        version: '1.0.0',
        cloud: true,
        edge: true,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Jozz Memory Cloud Edge Endpoints (/api/memories/*)
    if (url.pathname.startsWith('/api/memories')) {
      if (!globalThis.__ZOZ_EDGE_MEMORIES) {
        globalThis.__ZOZ_EDGE_MEMORIES = new Map();
      }
      const memMap = globalThis.__ZOZ_EDGE_MEMORIES;
      const jsonHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      };
      const resolveMemUid = (body = null) => (
        request.headers.get('x-user-id') ||
        url.searchParams.get('userId') ||
        (body && body.userId) ||
        'default'
      );
      const getMemOwner = (m) => (m && (m.userId || m.user_id)) || 'default';
      const isMemActive = (m) => Boolean(m && (m.isActive !== undefined ? m.isActive : (m.is_active !== undefined ? m.is_active : 1)));

      if (request.method === 'GET' && url.pathname === '/api/memories/insights') {
        const uid = resolveMemUid();
        const scope = url.searchParams.get('scope') || null;
        const userItems = Array.from(memMap.values()).filter(m =>
          isMemActive(m) && getMemOwner(m) === uid && (!scope || m.scope === scope || m.scope === 'global')
        );
        const categoryDistribution = {};
        for (const item of userItems) {
          const cat = item.category || 'general';
          categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
        }
        const topCategories = Object.entries(categoryDistribution)
          .sort((a, b) => b[1] - a[1])
          .map(([category, count]) => ({ category, count }));
        const insightPayload = {
          userId: uid,
          totalMemories: userItems.length,
          categoryDistribution,
          topCategories,
          topEntities: [],
          activeRelationsCount: 0,
          activeRelations: [],
          recommendedReviewTopics: userItems.slice(0, 3).map(m => ({
            topic: m.category || 'general',
            fact: m.content,
            validFrom: m.created_at || m.updated_at || ''
          })),
          generatedAt: new Date().toISOString()
        };
        return new Response(JSON.stringify({
          success: true,
          data: insightPayload,
          insights: insightPayload
        }), { status: 200, headers: jsonHeaders });
      }

      if (request.method === 'GET' && url.pathname === '/api/memories/export') {
        const uid = resolveMemUid();
        const format = (url.searchParams.get('format') || 'json').toLowerCase() === 'md' ? 'md' : 'json';
        const userItems = Array.from(memMap.values()).filter(m => isMemActive(m) && getMemOwner(m) === uid);
        const ts = Date.now();
        const safeFileName = `jozz_memories_${uid.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32)}_${ts}.${format}`;
        const bodyContent = format === 'md'
          ? `# JOZZ MEMORIES VAULT\n*Exported on ${new Date().toISOString()}*\n\n` +
            userItems.map(m => `### [${m.category || 'general'}] ${m.id}\n- **Scope**: ${m.scope || 'global'}\n- **Dibuat**: ${m.created_at || ''}\n- **Isi**: ${m.content}\n`).join('\n')
          : JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(), memories: userItems }, null, 2);
        return new Response(bodyContent, {
          status: 200,
          headers: {
            'Content-Type': format === 'md' ? 'text/markdown; charset=utf-8' : 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${safeFileName}"`,
            'Cache-Control': 'private, no-store, no-cache, must-revalidate',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      if (request.method === 'POST' && url.pathname === '/api/memories/import') {
        const uid = resolveMemUid();
        const format = (url.searchParams.get('format') || 'json').toLowerCase();
        const rawText = await request.text().catch(() => '');
        let candidates = [];
        const trimmedRaw = String(rawText || '').trim();
        if (format === 'json' || trimmedRaw.startsWith('{') || trimmedRaw.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmedRaw || '{}');
            const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.memories) ? parsed.memories : []);
            candidates = arr.map(item => ({
              content: String((item && (item.content || item.fact)) || '').trim().slice(0, 2000),
              category: String((item && item.category) || 'preference').trim().slice(0, 64) || 'preference',
              scope: String((item && item.scope) || 'global').trim().slice(0, 64) || 'global'
            })).filter(c => c.content);
          } catch (parseErr) {
            return new Response(JSON.stringify({ success: false, error: `JSON import tidak valid: ${parseErr.message}` }), { status: 400, headers: jsonHeaders });
          }
        } else {
          const lines = trimmedRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          for (const line of lines) {
            const bulletMatch = line.match(/^(?:[-*]|\d+\.)\s*(?:\*\*\s*Isi\s*\*\*\s*:\s*)?(.+)$/i);
            const rawFact = bulletMatch ? bulletMatch[1].trim() : (!line.startsWith('#') ? line : '');
            if (rawFact && rawFact.length >= 4) {
              candidates.push({ content: rawFact.slice(0, 2000), category: 'preference', scope: 'global' });
            }
          }
        }
        const existingContents = new Set(
          Array.from(memMap.values())
            .filter(m => isMemActive(m) && getMemOwner(m) === uid)
            .map(m => String(m.content || '').trim().toLowerCase())
        );
        let importedCount = 0;
        let skippedDuplicates = 0;
        const nowIso = new Date().toISOString();
        for (const cand of candidates) {
          const normKey = cand.content.toLowerCase();
          if (existingContents.has(normKey)) {
            skippedDuplicates++;
            continue;
          }
          existingContents.add(normKey);
          const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          if (memMap.size >= 500 && !memMap.has(id)) {
            const oldestKey = memMap.keys().next().value;
            if (oldestKey !== undefined) memMap.delete(oldestKey);
          }
          memMap.set(id, {
            id,
            userId: uid,
            user_id: uid,
            content: cand.content,
            category: cand.category,
            scope: cand.scope,
            confidence: 1.0,
            isActive: 1,
            is_active: 1,
            created_at: nowIso,
            updated_at: nowIso
          });
          importedCount++;
        }
        const totalMemories = Array.from(memMap.values()).filter(m => isMemActive(m) && getMemOwner(m) === uid).length;
        return new Response(JSON.stringify({
          success: true,
          importedCount,
          skippedDuplicates,
          totalMemories
        }), { status: 200, headers: jsonHeaders });
      }

      if (request.method === 'POST' && url.pathname === '/api/memories/recall') {
        let body = {};
        try { body = await request.json(); } catch (_) {}
        if (Boolean(body.incognito)) {
          return new Response(JSON.stringify({
            success: true,
            incognito: true,
            memories: [],
            receipts: [],
            systemPromptInjection: ''
          }), { status: 200, headers: jsonHeaders });
        }
        const uid = resolveMemUid(body);
        const targetScope = body.scope || 'global';
        const q = String(body.query || body.message || '').toLowerCase();
        const qTokens = [...new Set(q.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3))];
        const userMemories = Array.from(memMap.values()).filter(m => {
          if (!m || getMemOwner(m) !== uid) return false;
          const active = m.isActive !== undefined ? m.isActive : (m.is_active !== undefined ? m.is_active : 1);
          if (!active) return false;
          return !targetScope || targetScope === 'global' || m.scope === targetScope || m.scope === 'global';
        });
        const scored = [];
        for (const m of userMemories) {
          const text = String(m.content || '').toLowerCase();
          let hits = 0;
          for (const t of qTokens) {
            if (text.includes(t)) hits++;
          }
          if (hits >= 2 || (m.category === 'error_lesson' && hits >= 1)) {
            scored.push({ m, score: (m.category === 'error_lesson' ? 10 : 1) + hits });
          }
        }
        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, 5).map(s => s.m);
        let systemPromptInjection = '';
        if (top.length > 0) {
          const lines = top.map((m, i) => `[MEM-${i + 1} | Cat: ${m.category || 'fact'}]: ${m.content}`);
          systemPromptInjection = `### JOZZ MEMORY CONTEXT (EDGE VAULT):\n${lines.join('\n')}`;
        }
        return new Response(JSON.stringify({
          success: true,
          incognito: false,
          memories: top,
          receipts: [],
          systemPromptInjection
        }), { status: 200, headers: jsonHeaders });
      }

      if (request.method === 'POST' && url.pathname === '/api/memories/extract-background') {
        let body = {};
        try { body = await request.json(); } catch (_) {}
        const uid = resolveMemUid(body);
        const incognito = Boolean(body.incognito);
        const nowIso = new Date().toISOString();
        const putScopedEdgeMem = (rawId, prefix, payloadObj) => {
          const existing = rawId ? memMap.get(rawId) : null;
          const safeId = (rawId && (!existing || getMemOwner(existing) === uid))
            ? rawId
            : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          if (memMap.size >= 500 && !memMap.has(safeId)) {
            const oldestKey = memMap.keys().next().value;
            if (oldestKey !== undefined) memMap.delete(oldestKey);
          }
          const safeContent = String(payloadObj.content || '').slice(0, 2000);
          memMap.set(safeId, { ...payloadObj, content: safeContent, id: safeId, userId: uid, user_id: uid, updated_at: nowIso });
        };
        if (!incognito) {
          if (body.errorLesson && body.errorLesson.content) {
            putScopedEdgeMem(body.errorLesson.id, 'lesson', { ...body.errorLesson, category: 'error_lesson' });
          }
          if (body.episodicSummary && body.episodicSummary.content) {
            putScopedEdgeMem(body.episodicSummary.id, 'ep', { ...body.episodicSummary, category: 'episodic_context' });
          }
          if (body.preferenceMemory && body.preferenceMemory.content) {
            putScopedEdgeMem(body.preferenceMemory.id, 'pref', { ...body.preferenceMemory, category: 'preference' });
          }
        }
        return new Response(JSON.stringify({ success: true, queued: !incognito }), { status: 200, headers: jsonHeaders });
      }

      if (request.method === 'GET' && (url.pathname === '/api/memories' || url.pathname === '/api/memories/')) {
        const uid = resolveMemUid();
        const catFilter = url.searchParams.get('category') || null;
        const scopeFilter = url.searchParams.get('scope') || null;
        const qFilter = (url.searchParams.get('q') || '').trim().toLowerCase();
        let list = Array.from(memMap.values()).filter(m => isMemActive(m) && getMemOwner(m) === uid);
        if (catFilter) list = list.filter(m => m.category === catFilter);
        if (scopeFilter) list = list.filter(m => m.scope === scopeFilter || m.scope === 'global');
        if (qFilter) list = list.filter(m => String(m.content || '').toLowerCase().includes(qFilter));
        return new Response(JSON.stringify({ success: true, count: list.length, memories: list }), { status: 200, headers: jsonHeaders });
      }

      if (request.method === 'POST' && (url.pathname === '/api/memories' || url.pathname === '/api/memories/')) {
        let body = {};
        try { body = await request.json(); } catch (_) {}
        const uid = resolveMemUid(body);
        const content = String(body.content || body.fact || '').trim().slice(0, 2000);
        if (!content) {
          return new Response(JSON.stringify({ success: false, error: 'Isi memori (content) wajib diisi.' }), { status: 400, headers: jsonHeaders });
        }
        const existingById = body.id ? memMap.get(body.id) : null;
        if (existingById && getMemOwner(existingById) !== uid) {
          return new Response(JSON.stringify({ success: false, error: 'ID memori sudah dimiliki akun lain.' }), { status: 403, headers: jsonHeaders });
        }
        const id = body.id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        if (memMap.size >= 500 && !memMap.has(id)) {
          const oldestKey = memMap.keys().next().value;
          if (oldestKey !== undefined) memMap.delete(oldestKey);
        }
        const nowIso = new Date().toISOString();
        const item = {
          id,
          userId: uid,
          user_id: uid,
          content,
          category: body.category || 'preference',
          scope: body.scope || 'global',
          confidence: 1.0,
          isActive: 1,
          is_active: 1,
          created_at: nowIso,
          updated_at: nowIso
        };
        memMap.set(id, item);
        return new Response(JSON.stringify({ success: true, memory: item }), { status: 201, headers: jsonHeaders });
      }

      if (request.method === 'PATCH' && url.pathname.startsWith('/api/memories/')) {
        const rawMemId = url.pathname.replace('/api/memories/', '').trim();
        let memId = rawMemId;
        try { memId = decodeURIComponent(rawMemId); } catch (_) {}
        if (!memId) {
          return new Response(JSON.stringify({ success: false, error: 'ID memori wajib disertakan.' }), { status: 400, headers: jsonHeaders });
        }
        let body = {};
        try { body = await request.json(); } catch (_) {}
        const uid = resolveMemUid(body);
        const existing = memMap.get(memId);
        if (!existing || getMemOwner(existing) !== uid) {
          return new Response(JSON.stringify({ success: false, error: 'Memori tidak ditemukan atau bukan milik akun Anda.' }), { status: 404, headers: jsonHeaders });
        }
        const updated = {
          ...existing,
          content: typeof body.content === 'string' ? body.content.trim().slice(0, 2000) : existing.content,
          category: typeof body.category === 'string' ? body.category.trim().slice(0, 64) : existing.category,
          scope: typeof body.scope === 'string' ? body.scope.trim().slice(0, 64) : existing.scope,
          updated_at: new Date().toISOString()
        };
        if (typeof body.isActive !== 'undefined') {
          updated.isActive = body.isActive ? 1 : 0;
          updated.is_active = updated.isActive;
        }
        memMap.set(memId, updated);
        return new Response(JSON.stringify({ success: true, memory: updated }), { status: 200, headers: jsonHeaders });
      }

      if (request.method === 'DELETE') {
        const uid = resolveMemUid();
        if (url.pathname === '/api/memories' || url.pathname === '/api/memories/') {
          if (url.searchParams.get('confirm') !== 'true') {
            return new Response(JSON.stringify({ success: false, error: 'Harap sertakan parameter ?confirm=true untuk konfirmasi penghapusan seluruh memori.' }), { status: 400, headers: jsonHeaders });
          }
          for (const [k, v] of memMap.entries()) {
            if (getMemOwner(v) === uid) memMap.delete(k);
          }
          return new Response(JSON.stringify({ success: true, message: 'Seluruh memori pengguna di edge vault telah dihapus.' }), { status: 200, headers: jsonHeaders });
        }
        const rawDelId = url.pathname.replace('/api/memories/', '').trim();
        let memId = rawDelId;
        try { memId = decodeURIComponent(rawDelId); } catch (_) {}
        const existing = memId ? memMap.get(memId) : null;
        if (!existing || getMemOwner(existing) !== uid) {
          return new Response(JSON.stringify({ success: false, error: 'Memori tidak ditemukan atau bukan milik akun Anda.' }), { status: 404, headers: jsonHeaders });
        }
        memMap.delete(memId);
        return new Response(JSON.stringify({ success: true, deletedId: memId }), { status: 200, headers: jsonHeaders });
      }

      return new Response(JSON.stringify({ success: false, error: 'Endpoint memori tidak ditemukan di edge worker.' }), { status: 404, headers: jsonHeaders });
    }

    // Fast Diagnostic Probe Ping (Zero-Dependency)
    if (url.pathname === '/api/ping' && (request.method === 'GET' || request.method === 'HEAD')) {
      return new Response(JSON.stringify({
        ok: true,
        status: 'healthy',
        mode: 'edge-worker',
        time: new Date().toISOString(),
        colo: request.cf?.colo || null,
        country: request.cf?.country || null,
        version: '1.0.0'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Health & Storage Mode Check Endpoint
    if ((url.pathname === '/api/health' || url.pathname === '/api/storage-mode') && request.method === 'GET') {
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
        let body = {};
        if (reqBodyBytes && reqBodyBytes.byteLength > 0) {
          try { body = JSON.parse(new TextDecoder().decode(reqBodyBytes)); } catch (_) {}
        } else {
          body = await request.json().catch(() => ({}));
        }
        const authHeaderVal = request.headers.get('Authorization') || request.headers.get('authorization') || '';
        const bearerKey = authHeaderVal.startsWith('Bearer ') ? authHeaderVal.slice(7).trim() : authHeaderVal.trim();
        const clientOllamaKey = sanitizeOllamaApiKey(
          (body.ollamaApiKey && !String(body.ollamaApiKey).startsWith('sk-or-')) ? String(body.ollamaApiKey) :
          (request.headers.get('x-ollama-key') && !String(request.headers.get('x-ollama-key')).startsWith('sk-or-') ? String(request.headers.get('x-ollama-key')) :
          (request.headers.get('x-api-key') && !String(request.headers.get('x-api-key')).startsWith('sk-or-') ? String(request.headers.get('x-api-key')) :
          ((body.apiKey && !String(body.apiKey).startsWith('sk-or-')) ? String(body.apiKey) :
          (bearerKey && !bearerKey.startsWith('sk-or-') ? bearerKey : null))))
        );
        const envOllamaKey = envKeyAllowed(request, env) ? sanitizeOllamaApiKey(env?.OLLAMA_API_KEY) : null;
        const rawOllamaKey = clientOllamaKey || envOllamaKey;

        const targetEndpoint = body.endpoint || request.headers.get('x-ollama-endpoint') || 'https://ollama.com';
        let cleanEndpoint = (targetEndpoint || 'https://ollama.com').trim();
        const isLoopback = !cleanEndpoint || cleanEndpoint.includes('127.0.0.1') || cleanEndpoint.includes('localhost') || cleanEndpoint.includes('::1');
        // Pada Cloudflare Edge, jika endpoint loopback dikirim oleh browser, alihkan ke Ollama Cloud
        if (isLoopback) {
          cleanEndpoint = 'https://ollama.com';
        }
        if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
          cleanEndpoint = 'https://' + cleanEndpoint;
        }
        const isCloudModel = Boolean(
          body.model === 'beam' ||
          (body.model && body.model.includes(':cloud')) ||
          (body.model && body.model.includes('-cloud')) ||
          /^(?:beam\b|clef\b|muse-spark|mimo-|minimax-|glm-|kimi-|nemotron-|mistral-large|gpt-oss|deepseek-|gemma4|cogito|qwen3)/i.test(body.model || '')
        );
        let orKey = body.openRouterKey || (body.apiKey && String(body.apiKey).startsWith('sk-or-') ? body.apiKey : null) || request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (request.headers.get('Authorization') && request.headers.get('Authorization').includes('sk-or-') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
        if (orKey) orKey = String(orKey).replace(/^Bearer\s+/i, '').trim();

        // DILARANG KERAS memindahkan chat Ollama ke OpenRouter jika Auto-Router tidak diaktifkan secara eksplisit kecuali fallback model cloud dengan key OpenRouter!
        const isAutoRouterExplicit = Boolean(request.headers.get('x-auto-router') === 'true' || body.isAutoRouter);
        const shouldUseCloudBridge = Boolean((isAutoRouterExplicit || (isCloudModel && !rawOllamaKey && orKey)) && !rawOllamaKey && (isLoopback || cleanEndpoint.includes('ollama.com')));

        if (shouldUseCloudBridge) {
          if (!orKey) {
            return new Response(JSON.stringify({
              error: 'Ollama API Key diperlukan untuk menggunakan model Ollama Cloud di https://z21.zozdocs.com/. Silakan masukkan Ollama API Key Anda di menu Pengaturan.'
            }), {
              status: 401,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }

          const targetModel = mapOllamaModelToOpenRouter(body.model || 'qwen2.5:1.5b');
          const isStream = body.stream !== false;
          const isNemotronModel = targetModel.toLowerCase().includes('nemotron');
          const isFreeModel = targetModel.includes(':free') || targetModel.endsWith('/free') || targetModel === 'openrouter/free';
          const isNonToolModel = isFreeModel || isNemotronModel || targetModel.includes('beam') || targetModel.includes('reflection');
          const isBeamOrReasoning = Boolean(targetModel && (
            targetModel.includes('beam') ||
            targetModel.includes('reflection') ||
            targetModel.includes('r1')
          ));

          // Multimodal Translation, Tool Normalization & Latent Reasoning Preservation
          const normalizedOrMessages = normalizeMessagesForOpenRouter(body.messages, {
            normalizeTools: isNonToolModel,
            includeReasoningPrior: isBeamOrReasoning
          });

          const isDenseModel = Boolean(targetModel && (
            targetModel.includes('beam') ||
            targetModel.includes('reflection') ||
            targetModel.includes('501b') ||
            targetModel.includes('671b') ||
            targetModel.includes('675b')
          ));
          const requestedPredict = (body.options?.num_predict && Number.isFinite(body.options.num_predict))
            ? body.options.num_predict
            : ((body.max_tokens && Number.isFinite(body.max_tokens)) ? body.max_tokens : 16384);
          const initialMaxTokens = isDenseModel ? Math.min(requestedPredict, 8192) : Math.min(requestedPredict, 16384);

          const openRouterPayload = {
            model: targetModel,
            messages: normalizedOrMessages,
            stream: isStream,
            max_tokens: initialMaxTokens,
            provider: { allow_fallbacks: true }
          };
          if (body.reasoning) {
            openRouterPayload.reasoning = body.reasoning;
          } else if (targetModel.includes('beam') || targetModel.includes('reflection')) {
            openRouterPayload.reasoning = { effort: 'medium' };
          }
          if (body.include_reasoning !== undefined && body.include_reasoning !== false) {
            openRouterPayload.include_reasoning = body.include_reasoning;
          }
          if (body.options?.temperature !== undefined) openRouterPayload.temperature = body.options.temperature;
          if (body.options?.top_p !== undefined) openRouterPayload.top_p = body.options.top_p;

          if (!isNonToolModel && Array.isArray(body.tools) && body.tools.length > 0) {
            const clean = body.tools.filter(t => t && t.type === 'function' && t.function && t.function.name);
            if (clean.length > 0) {
              openRouterPayload.tools = clean;
              if (body.tool_choice) openRouterPayload.tool_choice = body.tool_choice;
            }
          }

          const orHeaders = {
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://zoz-router.pages.dev',
            'X-Title': 'ZOZ Router Ollama Cloud Bridge'
          };
          if (orKey) orHeaders['Authorization'] = `Bearer ${orKey}`;

          let orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: orHeaders,
            body: JSON.stringify(openRouterPayload),
            signal: request.signal
          });

          // Auto-Recovery HTTP 400 (Jinja template missing reasoning) & HTTP 402 & Upstream Provider Error
          if (!orRes.ok) {
            const errClone = await orRes.clone().json().catch(() => ({}));
            const errMsg = errClone?.error?.message || errClone?.error || '';
            if (orRes.status === 400 && /missing its reasoning|allow_missing_thinking/i.test(errMsg)) {
              openRouterPayload.messages = (openRouterPayload.messages || []).map(m => {
                if (m && m.role === 'assistant') {
                  const raw = (typeof m.content === 'string') ? m.content : '';
                  const latent = m.reasoning || m.reasoning_content || `Evaluasi penalaran analitis konseptual: ${raw.slice(0, 150).replace(/[\r\n]+/g, ' ')}`;
                  return { ...m, reasoning_content: latent };
                }
                return m;
              });
              orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: orHeaders,
                body: JSON.stringify(openRouterPayload),
                signal: request.signal
              });
            } else if (orRes.status === 402 || /can only afford/i.test(errMsg)) {
              const affordMatch = errMsg.match(/can only afford\s+(\d+)/i);
              const affordVal = affordMatch ? parseInt(affordMatch[1], 10) : 0;
              const safeTokens = affordVal > 256 ? Math.max(512, Math.min(2048, affordVal - 128)) : 1024;
              openRouterPayload.max_tokens = safeTokens;
              orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: orHeaders,
                body: JSON.stringify(openRouterPayload),
                signal: request.signal
              });
            } else if ((orRes.status >= 500 || orRes.status === 429 || orRes.status === 404 || /provider returned error|temporarily unavailable|overloaded|no endpoints/i.test(errMsg)) && openRouterPayload.model !== 'deepseek/deepseek-chat') {
              openRouterPayload.model = 'deepseek/deepseek-chat';
              openRouterPayload.max_tokens = Math.min(openRouterPayload.max_tokens || 8192, 8192);
              orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: orHeaders,
                body: JSON.stringify(openRouterPayload),
                signal: request.signal
              });
            }
          }

          if (!orRes.ok) {
            const errJson = await orRes.json().catch(() => ({}));
            return new Response(JSON.stringify({
              error: errJson?.error?.message || errJson?.error || `OpenRouter upstream error: HTTP ${orRes.status}`
            }), {
              status: orRes.status,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }

          if (!isStream) {
            const data = await orRes.json().catch(() => ({}));
            let textContent = data.choices?.[0]?.message?.content || '';
            const reasoningContent = data.choices?.[0]?.message?.reasoning || data.choices?.[0]?.message?.reasoning_content || data.choices?.[0]?.message?.thinking || '';
            const reasoningDetails = data.choices?.[0]?.message?.reasoning_details;
            if (!textContent.trim() && reasoningContent.trim()) {
              textContent = extractFallbackConclusionFromUnclosedThought(reasoningContent, { requireExplicitMarker: true });
            }
            const msgPayload = { role: 'assistant', content: textContent };
            if (reasoningContent) msgPayload.reasoning = reasoningContent;
            if (reasoningDetails) msgPayload.reasoning_details = reasoningDetails;
            if (data.choices?.[0]?.message?.tool_calls) {
              msgPayload.tool_calls = data.choices[0].message.tool_calls;
            }
            return new Response(JSON.stringify({
              model: body.model || 'qwen2.5:1.5b',
              created_at: new Date().toISOString(),
              message: msgPayload,
              done: true
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }

          const { readable, writable } = new TransformStream();
          const writer = writable.getWriter();
          const reader = orRes.body.getReader();
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();

          const pumpPromise = (async () => {
            let buffer = '';
            let accumulatedContent = '';
            let accumulatedReasoning = '';
            let lastFinishReason = null;
            let sentDone = false;
            const processSseLine = async (rawLine) => {
              const trimmed = rawLine.trim();
              if (!trimmed.startsWith('data:')) return;
              const dataStr = trimmed.slice(5).trim();
              if (dataStr === '[DONE]') {
                if (!accumulatedContent.trim() && accumulatedReasoning.trim()) {
                  const fallback = extractFallbackConclusionFromUnclosedThought(accumulatedReasoning, { requireExplicitMarker: true });
                  if (fallback) {
                    await writer.write(encoder.encode(JSON.stringify({
                      model: body.model || 'qwen2.5:1.5b',
                      created_at: new Date().toISOString(),
                      message: { role: 'assistant', content: fallback },
                      done: false
                    }) + '\n'));
                  }
                }
                sentDone = true;
                await writer.write(encoder.encode(JSON.stringify({
                  model: body.model || 'qwen2.5:1.5b',
                  created_at: new Date().toISOString(),
                  message: { role: 'assistant', content: '' },
                  done: true,
                  done_reason: lastFinishReason || 'stop'
                }) + '\n'));
                return;
              }
              try {
                const parsed = JSON.parse(dataStr);
                const ch = parsed.choices?.[0];
                if (ch?.finish_reason) lastFinishReason = ch.finish_reason;
                const deltaContent = ch?.delta?.content || '';
                const deltaReasoning = ch?.delta?.reasoning || ch?.delta?.reasoning_content || ch?.delta?.thinking || '';
                const deltaReasoningDetails = ch?.delta?.reasoning_details;
                const deltaToolCalls = ch?.delta?.tool_calls;
                if (deltaContent) accumulatedContent += deltaContent;
                if (deltaReasoning) accumulatedReasoning += deltaReasoning;
                if (deltaContent || deltaReasoning || deltaReasoningDetails || deltaToolCalls) {
                  const msgPayload = { role: 'assistant', content: deltaContent };
                  if (deltaReasoning) msgPayload.reasoning = deltaReasoning;
                  if (deltaReasoningDetails) msgPayload.reasoning_details = deltaReasoningDetails;
                  if (deltaToolCalls) msgPayload.tool_calls = deltaToolCalls;
                  await writer.write(encoder.encode(JSON.stringify({
                    model: body.model || 'qwen2.5:1.5b',
                    created_at: new Date().toISOString(),
                    message: msgPayload,
                    done: false
                  }) + '\n'));
                }
              } catch (_) {}
            };

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  buffer += decoder.decode();
                  break;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  await processSseLine(line);
                }
              }
              if (buffer && buffer.trim()) {
                await processSseLine(buffer);
              }
              if (!sentDone) {
                if (!accumulatedContent.trim() && accumulatedReasoning.trim()) {
                  const fallback = extractFallbackConclusionFromUnclosedThought(accumulatedReasoning, { requireExplicitMarker: true });
                  if (fallback) {
                    await writer.write(encoder.encode(JSON.stringify({
                      model: body.model || 'qwen2.5:1.5b',
                      created_at: new Date().toISOString(),
                      message: { role: 'assistant', content: fallback },
                      done: false
                    }) + '\n'));
                  }
                }
                await writer.write(encoder.encode(JSON.stringify({
                  model: body.model || 'qwen2.5:1.5b',
                  created_at: new Date().toISOString(),
                  message: { role: 'assistant', content: '' },
                  done: true,
                  done_reason: lastFinishReason || 'incomplete'
                }) + '\n'));
              }
            } catch (err) {
              console.error('Error in Ollama cloud streaming proxy:', err);
              if (!sentDone) {
                try {
                  await writer.write(encoder.encode(JSON.stringify({
                    model: body.model || 'qwen2.5:1.5b',
                    created_at: new Date().toISOString(),
                    message: { role: 'assistant', content: '' },
                    done: true,
                    done_reason: lastFinishReason || 'incomplete'
                  }) + '\n'));
                } catch (_) {}
              }
            } finally {
              try { await reader.cancel(); } catch (_) {}
              try { await writer.close(); } catch (_) {}
            }
          })();
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(pumpPromise);
          }

          return new Response(readable, {
            status: 200,
            headers: {
              'Content-Type': 'application/x-ndjson',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }

        // Direct Native Ollama Execution (Kredensial & Kredit Ollama Pengguna Digunakan Penuh)
        const parsedBase = new URL(cleanEndpoint);
        const endpointCheck = checkOllamaEndpoint(cleanEndpoint);
        if (endpointCheck.forbidden) {
          return new Response(JSON.stringify({ error: endpointCheck.reason }), {
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

        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'ZozRouter/1.0 (Windows NT 10.0; Win64; x64)'
        };
        const targetHostLower = (parsedBase.hostname || '').toLowerCase();
        const isOfficialOllamaHost = targetHostLower === 'ollama.com' || targetHostLower === 'api.ollama.com' || targetHostLower.endsWith('.ollama.com');
        const effectiveOllamaKey = clientOllamaKey || (isOfficialOllamaHost ? envOllamaKey : null);
        if (effectiveOllamaKey) {
          headers['Authorization'] = `Bearer ${effectiveOllamaKey}`;
          headers['x-ollama-key'] = effectiveOllamaKey;
        }

        const resolvedModel = body.model || 'llama3.2:3b';

        // Multimodal Defense: Bersihkan skema images agar hanya berisi base64 valid untuk native Ollama
        const sanitizedOllamaMessages = (body.messages || []).map(m => {
          if (!m) return m;
          const cleanM = { ...m };
          if (Array.isArray(cleanM.images)) {
            cleanM.images = cleanM.images
              .map(img => {
                if (typeof img === 'string') {
                  if (img.startsWith('data:image')) {
                    return img.replace(/^data:image\/[a-z0-9.+_-]+;base64,/i, '').replace(/[\r\n\s]/g, '');
                  }
                  if (/^[A-Za-z0-9+/=]+$/.test(img.trim()) && img.trim().length > 50) {
                    return img.trim().replace(/[\r\n\s]/g, '');
                  }
                }
                return null;
              })
              .filter(Boolean);
            if (cleanM.images.length === 0) delete cleanM.images;
          }
          return cleanM;
        });

        const outBody = {
          model: resolvedModel,
          messages: sanitizedOllamaMessages,
          stream: body.stream !== false
        };
        if (body.options && typeof body.options === 'object' && Object.keys(body.options).length > 0) {
          outBody.options = body.options;
        }
        if (body.tools && Array.isArray(body.tools) && body.tools.length > 0) {
          outBody.tools = body.tools;
        }
        if (body.format) {
          outBody.format = body.format;
        }
        if (typeof body.think === 'boolean' || typeof body.think === 'string') {
          outBody.think = body.think;
        }

        let res = await fetch(targetUrl.toString(), {
          method: 'POST',
          headers,
          body: JSON.stringify(outBody),
          redirect: 'manual',
          signal: request.signal
        });

        if (!res.ok && outBody.think !== undefined && (res.status === 400 || res.status === 422 || res.status === 500)) {
          const errTextProbe = await res.clone().text().catch(() => '');
          if (/think/i.test(errTextProbe)) {
            delete outBody.think;
            res = await fetch(targetUrl.toString(), {
              method: 'POST',
              headers,
              body: JSON.stringify(outBody),
              redirect: 'manual',
              signal: request.signal
            });
          }
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          const errMsg = errData?.error?.message || errData?.error || errData?.message || (res.status === 401 ? 'Kunci API Ollama tidak valid atau kuota/kredit Anda telah habis.' : `Ollama error: HTTP ${res.status}`);
          return new Response(JSON.stringify({ error: errMsg }), {
            status: res.status,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const newHeaders = new Headers(res.headers);
        newHeaders.delete('content-encoding');
        newHeaders.delete('content-length');
        newHeaders.delete('transfer-encoding');
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', '*');
        if (body.stream !== false) {
          newHeaders.set('Content-Type', 'application/x-ndjson; charset=utf-8');
          newHeaders.set('Cache-Control', 'no-cache');
        }

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
        const endpoint = url.searchParams.get('endpoint') || request.headers.get('x-ollama-endpoint') || 'https://ollama.com';
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'ZozRouter/1.0 (Windows NT 10.0; Win64; x64)'
        };
        if (authHeader) headers['Authorization'] = authHeader;
        if (key) headers['x-ollama-key'] = key;

        let cleanEndpoint = (endpoint || '').trim();
        // Pada Cloudflare Edge, jika endpoint loopback atau ollama.com default diminta:
        // - Jika ada authHeader: alihkan ke https://ollama.com resmi
        if (cleanEndpoint.includes('127.0.0.1') || cleanEndpoint.includes('localhost') || cleanEndpoint.includes('::1') || cleanEndpoint.includes('ollama.com')) {
          if (authHeader && !cleanEndpoint.includes('ollama.com')) {
            cleanEndpoint = 'https://ollama.com';
          }
        }

        if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
          cleanEndpoint = (authHeader ? 'https://' : 'http://') + cleanEndpoint;
        }
        const parsedBase = new URL(cleanEndpoint);
        const endpointCheck = checkOllamaEndpoint(cleanEndpoint);
        if (endpointCheck.forbidden) {
          return new Response(JSON.stringify({
            models: [],
            server_running: false,
            cloud_ready: false,
            cloud_auth: Boolean(authHeader),
            note: 'Endpoint Ollama lokal tidak dapat dijangkau dari Cloudflare Edge'
          }), {
            status: 200,
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

        let res = null;
        try {
          res = await fetch(targetUrl.toString(), { headers, redirect: 'manual', signal: AbortSignal.timeout(5000) });
        } catch (_) {}

        if (res && res.ok) {
          const rawText = await res.text();
          try {
            const parsed = JSON.parse(rawText);
            if (Array.isArray(parsed.models) && parsed.models.length > 0) {
              const liveModels = parsed.models.filter(m => !isUnsupportedOllamaChatModel(m));
              return new Response(JSON.stringify({
                models: liveModels,
                server_running: true,
                cloud_ready: true,
                cloud_auth: Boolean(authHeader)
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
              });
            }
          } catch (_) {}
        }

        // Secondary probe: Coba endpoint /v1/models (kompatibel OpenAI / vLLM / Ollama v1)
        try {
          const v1Url = new URL(cleanEndpoint);
          let v1Path = v1Url.pathname.replace(/\/+$/, '');
          if (v1Path.endsWith('/v1/models')) {
            // already ends with /v1/models
          } else if (v1Path.endsWith('/v1')) {
            v1Url.pathname = v1Path + '/models';
          } else {
            v1Url.pathname = (v1Path ? v1Path : '') + '/v1/models';
          }
          const v1Res = await fetch(v1Url.toString(), { headers, redirect: 'manual', signal: AbortSignal.timeout(3500) }).catch(() => null);
          if (v1Res && v1Res.ok) {
            const v1Text = await v1Res.text();
            const v1Parsed = JSON.parse(v1Text);
            if (Array.isArray(v1Parsed.data) && v1Parsed.data.length > 0) {
              const mappedModels = v1Parsed.data
                .filter(m => !isUnsupportedOllamaChatModel(m))
                .map(m => ({
                  name: m.id,
                  model: m.id,
                  details: { family: m.id }
                }));
              return new Response(JSON.stringify({
                models: mappedModels,
                server_running: true,
                cloud_ready: true,
                cloud_auth: Boolean(authHeader)
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
              });
            }
          }
        } catch (_) {}

        // Fallback jika response bukan 200 atau models kosong
        return new Response(JSON.stringify({
          models: [],
          server_running: false,
          cloud_ready: false,
          cloud_auth: Boolean(authHeader),
          note: 'Ollama offline atau tidak ada model terpasang'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({
          models: [],
          server_running: false,
          cloud_ready: false,
          cloud_auth: false,
          note: 'Gagal terhubung ke Ollama'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Proxy Ollama Cloud Usage Check
    if (url.pathname === '/api/ollama/usage' && request.method === 'GET') {
      try {
        const rawKey = request.headers.get('x-ollama-key') || (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '').trim() : '') || (envKeyAllowed(request, env) ? env?.OLLAMA_API_KEY : null);
        if (!rawKey) {
          return new Response(JSON.stringify({ error: 'Ollama API key is required' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        const usageRes = await fetch('https://ollama.com/api/usage', {
          headers: {
            'Authorization': `Bearer ${rawKey}`,
            'x-ollama-key': rawKey,
            'User-Agent': 'ZozRouter/1.0 (Cloudflare Edge)',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          signal: AbortSignal.timeout(6000)
        });
        const usageData = await usageRes.json().catch(() => ({}));
        return new Response(JSON.stringify(usageData), {
          status: usageRes.status,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Failed to fetch Ollama usage: ' + e.message }), {
          status: 502,
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
          signal: request.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://zoz-router.pages.dev',
            'X-Title': 'ZOZ Router'
          },
          body: JSON.stringify((() => {
            let reqModel = body.model || 'openrouter/free';
            if (reqModel && !reqModel.includes('/')) {
              reqModel = mapOllamaModelToOpenRouter(reqModel);
            }
            const isNemotronReq = reqModel.toLowerCase().includes('nemotron');
            const isFreeReq = reqModel.includes(':free') || reqModel.endsWith('/free') || reqModel === 'openrouter/free';
            const isLiquid = reqModel.includes('liquid') || reqModel.includes('lfm-');
            // Hanya model OpenAI o-series dan DeepSeek R1 ketat yang menolak kustomisasi temperature di OpenRouter
            const isStrictReasoning = Boolean(reqModel && !isNemotronReq && (/\/o[1-9]|\b(r1|reasoning|deepseek-r)\b/i.test(reqModel) || reqModel.toLowerCase().includes('reasoning') || reqModel.toLowerCase().includes('-r1')));
            const isBeamOrReasoningReq = Boolean(reqModel && (
              reqModel.includes('beam') ||
              reqModel.includes('reflection') ||
              reqModel.includes('r1')
            ));

            const cleanTools = (!isNemotronReq && !isFreeReq && Array.isArray(body.tools))
              ? body.tools.filter(t => t && t.type === 'function' && t.function && t.function.name)
              : [];

            const messagesReq = normalizeMessagesForOpenRouter(body.messages, {
              normalizeTools: cleanTools.length === 0,
              includeReasoningPrior: isBeamOrReasoningReq
            });

            const isDenseModelOr = Boolean(reqModel && (
              reqModel.includes('beam') ||
              reqModel.includes('reflection') ||
              reqModel.includes('501b') ||
              reqModel.includes('671b') ||
              reqModel.includes('675b')
            ));
            const calculatedMaxTokens = isDenseModelOr
              ? Math.min(body.max_tokens || 8192, 8192)
              : (body.max_tokens || 16384);

            const out = {
              model: reqModel,
              messages: messagesReq,
              stream: body.stream !== false,
              ...(body.provider ? { provider: body.provider } : { provider: { allow_fallbacks: true } }),
              ...(body.plugins ? { plugins: body.plugins } : {}),
              ...(body.modalities ? { modalities: body.modalities } : {}),
              ...(isNemotronReq ? { reasoning: { effort: 'high' }, include_reasoning: true } : (body.reasoning ? { reasoning: body.reasoning } : ((reqModel.includes('beam') || reqModel.includes('reflection')) ? { reasoning: { effort: 'medium' } } : {}))),
              max_tokens: calculatedMaxTokens
            };
            if (!isStrictReasoning) {
              out.temperature = body.temperature ?? 0.7;
            }
            if (!isLiquid && !isStrictReasoning) {
              out.top_p = body.top_p ?? 0.9;
            }
            if (cleanTools.length > 0) {
              out.tools = cleanTools;
              if (body.tool_choice) out.tool_choice = body.tool_choice;
            }
            return out;
          })())
        });

        const newHeaders = new Headers(res.headers);
        newHeaders.delete('content-encoding');
        newHeaders.delete('content-length');
        newHeaders.delete('transfer-encoding');
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Cache-Control', 'no-cache, no-transform');
        newHeaders.set('X-Accel-Buffering', 'no');
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

    // Stop Active Chat Task acknowledgement
    if ((url.pathname === '/api/chat/stop' || url.pathname.startsWith('/api/chat/stop/')) && (request.method === 'POST' || request.method === 'GET')) {
      return new Response(JSON.stringify({ success: true, stopped: true, message: 'Chat stop acknowledged.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Chat Status Endpoint for Cloudflare Gateway (Stateless)
    if ((url.pathname === '/api/chat/status' || url.pathname.startsWith('/api/chat/status/')) && (request.method === 'GET' || request.method === 'POST')) {
      return new Response(JSON.stringify({
        success: true,
        stateless: true,
        active: false,
        status: 'none',
        activeSessions: [],
        recentlyCompletedSessions: []
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
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

        let referenceImage = null;

        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          prompt = body.prompt || body.q || '';
          referenceImage = body.referenceImage || body.image || body.initImage || null;
          model = body.model || model;
          width = parseInt(body.width, 10) || width;
          height = parseInt(body.height, 10) || height;
          seed = (body.seed !== undefined && body.seed !== null && body.seed !== '') ? (parseInt(body.seed, 10) || 0) : null;
          openRouterKey = body.openRouterKey || body.apiKey || (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
        } else {
          prompt = url.searchParams.get('prompt') || url.searchParams.get('q') || '';
          referenceImage = url.searchParams.get('referenceImage') || url.searchParams.get('image') || null;
          model = url.searchParams.get('model') || model;
          width = parseInt(url.searchParams.get('width'), 10) || width;
          height = parseInt(url.searchParams.get('height'), 10) || height;
          const rawSeed = url.searchParams.get('seed');
          seed = (rawSeed !== null && rawSeed !== '') ? (parseInt(rawSeed, 10) || 0) : null;
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
        const actualSeed = (seed !== null && !isNaN(seed)) ? seed : Math.floor(Math.random() * 100000000);
        const startTime = Date.now();
        width = Math.min(Math.max(width, 256), 2048);
        height = Math.min(Math.max(height, 256), 2048);

        let rawModel = String(model || 'flux').trim();
        let lowModel = rawModel.toLowerCase();
        let effectiveModel = rawModel;
        if (lowModel === 'qwen/qwen-image-2.1-pro' || lowModel === 'qwen: qwen image 2.1 pro' || lowModel === 'qwen-image-2.1-pro' || lowModel === 'qwen image 2.1 pro' || lowModel === 'qwen 2.1 pro') {
          effectiveModel = 'qwen/qwen-image-2.1-pro';
        } else if (lowModel === 'qwen/qwen-image-2.1-turbo' || lowModel === 'qwen: qwen image 2.1 turbo' || lowModel === 'qwen-image-2.1-turbo' || lowModel === 'qwen image 2.1 turbo' || lowModel === 'qwen 2.1 turbo') {
          effectiveModel = 'qwen/qwen-image-2.1-turbo';
        } else if (lowModel === 'qwen/qwen-image-3-pro' || lowModel === 'qwen: qwen image 3 pro' || lowModel === 'qwen-image-3-pro' || lowModel === 'qwen image 3 pro') {
          effectiveModel = 'qwen/qwen-image-3-pro';
        } else if (lowModel === 'qwen/qwen-image-3' || lowModel === 'qwen: qwen image 3' || lowModel === 'qwen-image-3' || lowModel === 'qwen image 3') {
          effectiveModel = 'qwen/qwen-image-3';
        } else if (lowModel === 'flux-3' || lowModel === 'flux.3' || lowModel === 'flux 3 image' || lowModel === 'black-forest-labs/flux-3-image') {
          effectiveModel = 'black-forest-labs/flux-3-image';
        } else if (lowModel === 'flux-3-klein' || lowModel === 'flux.3-klein' || lowModel === 'black-forest-labs/flux-3-image-klein') {
          effectiveModel = 'black-forest-labs/flux-3-image-klein';
        } else if (lowModel === 'flux.2-pro' || lowModel === 'flux-2-pro' || lowModel === 'black-forest-labs/flux.2-pro') {
          effectiveModel = 'black-forest-labs/flux.2-pro';
        } else if (lowModel === 'flux.2-max' || lowModel === 'flux-2-max' || lowModel === 'black-forest-labs/flux.2-max') {
          effectiveModel = 'black-forest-labs/flux.2-max';
        } else if (lowModel === 'nano-banana-2.1' || lowModel === 'gemini-nano-banana-2.1' || lowModel === 'nano banana 2.1' || lowModel === 'google/gemini-nano-banana-2.1') {
          effectiveModel = 'google/gemini-nano-banana-2.1';
        } else if (lowModel === 'gemini-3.1-flash-image' || lowModel === 'google/gemini-3.1-flash-image') {
          effectiveModel = 'google/gemini-3.1-flash-image';
        } else if (lowModel === 'gemini-3-pro-image' || lowModel === 'google/gemini-3-pro-image') {
          effectiveModel = 'google/gemini-3-pro-image';
        } else if (lowModel === 'gpt-image-2' || lowModel === 'gpt image 2' || lowModel === 'openai/gpt-image-2') {
          effectiveModel = 'openai/gpt-image-2';
        } else if (lowModel === 'gpt-image-2.5-sunburst' || lowModel === 'openai/gpt-image-2.5-sunburst') {
          effectiveModel = 'openai/gpt-image-2.5-sunburst';
        } else if (lowModel === 'gpt-image-2.5-flare' || lowModel === 'openai/gpt-image-2.5-flare') {
          effectiveModel = 'openai/gpt-image-2.5-flare';
        } else if (lowModel === 'gpt-image-1' || lowModel === 'openai/gpt-image-1') {
          effectiveModel = 'openai/gpt-image-1';
        } else if (lowModel === 'recraft-ai/recraft-v3') {
          effectiveModel = 'recraft/recraft-v3';
        } else if (lowModel === 'tencent/hunyuan-image-v3.5') {
          effectiveModel = 'tencent/hy-image-v3.5-preview';
        } else {
          effectiveModel = lowModel;
        }
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
                aspect_ratio: '1:1',
                ...(referenceImage ? { input_references: [{ type: 'image_url', image_url: { url: referenceImage } }] } : {})
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
              const userContent = [
                { type: 'text', text: referenceImage ? `Please edit, modify or transform this image according to the instructions: ${cleanPrompt}` : `Please generate an image: ${cleanPrompt}` }
              ];
              if (referenceImage) {
                userContent.push({ type: 'image_url', image_url: { url: referenceImage } });
              }
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
                  messages: [{ role: 'user', content: userContent }],
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
                    const mdMatch = msg.content.match(/!\[.*?\]\(((?:https?:\/\/|data:image\/)[^\s\)]+)\)/);
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
          // 2A. Jika mode edit foto dan foto referensi adalah data URL Base64, panggil endpoint POST Pollinations img2img
          if (referenceImage && typeof referenceImage === 'string' && referenceImage.startsWith('data:')) {
            try {
              const pollRes = await fetch('https://image.pollinations.ai/', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                body: JSON.stringify({
                  prompt: cleanPrompt,
                  model: effectiveModel,
                  image: referenceImage,
                  width: width,
                  height: height,
                  nologo: true,
                  seed: actualSeed
                })
              });
              if (pollRes.ok) {
                const buf = await pollRes.arrayBuffer();
                if (buf && buf.byteLength > 0) {
                  const mime = pollRes.headers.get('content-type') || 'image/jpeg';
                  let binary = '';
                  const bytes = new Uint8Array(buf);
                  const len = bytes.byteLength;
                  const CHUNK_SIZE = 0x8000; // 32KB chunking
                  for (let i = 0; i < len; i += CHUNK_SIZE) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK_SIZE, len)));
                  }
                  finalImageUrl = `data:${mime};base64,${btoa(binary)}`;
                }
              }
            } catch (editErr) {
              console.warn('Pollinations POST Img2Img error in worker:', editErr);
            }
          }

          // 2B. Standar text-to-image (atau fallback GET jika POST gagal / foto berupa URL HTTP)
          if (!finalImageUrl) {
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
            if (referenceImage && /^https?:\/\//i.test(referenceImage)) {
              finalImageUrl += `&image=${encodeURIComponent(referenceImage)}`;
            }
          }
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

    // Proxy Generate Music (AI Music Studio via OpenRouter Audio API)
    if ((url.pathname === '/api/generate-music' || url.pathname === '/api/music/generate') && (request.method === 'POST' || request.method === 'GET')) {
      try {
        let prompt = '';
        let musicModel = 'google/lyria-3-clip-preview';
        let openRouterKey = null;

        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          prompt = body.prompt || body.q || '';
          musicModel = body.musicModel || body.model || musicModel;
          openRouterKey = body.openRouterKey || body.apiKey || (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
        } else {
          prompt = url.searchParams.get('prompt') || url.searchParams.get('q') || '';
          musicModel = url.searchParams.get('musicModel') || url.searchParams.get('model') || musicModel;
          openRouterKey = (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
        }

        if (openRouterKey) {
          openRouterKey = String(openRouterKey).replace(/^Bearer\s+/i, '').trim();
        }

        if (!prompt || !prompt.trim()) {
          return new Response(JSON.stringify({ success: false, error: 'Prompt musik kosong.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (!openRouterKey) {
          return new Response(JSON.stringify({
            success: false,
            code: 'NO_KEY',
            error: 'OpenRouter API Key diperlukan untuk membuat musik AI.'
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const cleanPrompt = prompt.trim();
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/Zozi0999/zoz_router',
            'X-Title': 'Zoz Router Music Studio'
          },
          body: JSON.stringify({
            model: musicModel,
            modalities: ['audio', 'text'],
            messages: [{ role: 'user', content: cleanPrompt }]
          })
        });

        const orData = await orRes.json().catch(() => ({}));
        if (!orRes.ok || orData.error) {
          const msg = typeof orData.error === 'object' ? (orData.error.message || JSON.stringify(orData.error)) : (orData.error || `HTTP ${orRes.status}`);
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: orRes.ok ? 502 : (orRes.status || 500),
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        let audioBase64 = '';
        let audioMime = 'audio/wav';
        const msg = orData.choices?.[0]?.message;
        if (msg) {
          const a = msg.audio || msg.output_audio;
          if (a && typeof a.data === 'string') audioBase64 = a.data;
          else if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part?.audio?.data) { audioBase64 = part.audio.data; break; }
              if (typeof part?.data === 'string' && /audio/i.test(part.type || '')) { audioBase64 = part.data; break; }
            }
          }
        }

        if (!audioBase64) {
          return new Response(JSON.stringify({ success: false, error: 'Model OpenRouter tidak mengembalikan audio musik.' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const existingDataPrefix = audioBase64.match(/^data:(audio\/[a-z0-9.+-]+);base64,(.+)$/i);
        if (existingDataPrefix) {
          audioMime = existingDataPrefix[1].toLowerCase();
          audioBase64 = existingDataPrefix[2];
        } else if (audioBase64.startsWith('SUQz') || audioBase64.startsWith('//u') || audioBase64.startsWith('//s')) {
          audioMime = 'audio/mpeg';
        } else if (audioBase64.startsWith('T2dnUw')) {
          audioMime = 'audio/ogg';
        } else if (audioBase64.startsWith('fLaC') || audioBase64.startsWith('ZkxhQw')) {
          audioMime = 'audio/flac';
        }

        const dataUrl = `data:${audioMime};base64,${audioBase64}`;
        return new Response(JSON.stringify({
          success: true,
          url: dataUrl,
          title: 'Singularity Cyber Audio',
          genre: 'Cyberpunk',
          duration: 15,
          aiComposed: true,
          aiModel: musicModel,
          aiProvider: 'openrouter'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'Gagal membuat musik: ' + e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Stateless Media / File Upload Handler
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        if (!body.data) {
          return new Response(JSON.stringify({ error: 'Data gambar atau file diperlukan.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        return new Response(JSON.stringify({
          success: true,
          url: body.data,
          stateless: true,
          message: 'Uploaded to stateless edge buffer.'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Upload failed: ' + e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Sovereign Zoz Neural Web Search Engine (Independen, Zero 3rd-party search engine)
    if (url.pathname === '/api/web-search' || url.pathname === '/api/tools/search-web' || url.pathname === '/api/autonomous/search') {
      try {
        let query = url.searchParams.get('q') || url.searchParams.get('query') || url.searchParams.get('search') || url.searchParams.get('keyword') || url.searchParams.get('topic') || url.searchParams.get('topik') || url.searchParams.get('text') || url.searchParams.get('cari') || url.searchParams.get('kata_kunci') || '';
        let num = parseInt(url.searchParams.get('num') || url.searchParams.get('limit') || url.searchParams.get('maxResults') || '12', 10);
        let context = url.searchParams.get('context') || '';
        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          query = body.query || body.q || body.search || body.keyword || body.topic || body.topik || body.text || body.cari || body.kata_kunci || query;
          context = body.context || body.conversationContext || context;
          if (body.num || body.limit || body.maxResults) num = parseInt(body.num || body.limit || body.maxResults, 10);
        }
        if (!query || !query.trim()) {
          return new Response(JSON.stringify({ success: false, error: 'Parameter query `q` atau body `{ query }` diperlukan.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        const targetNum = Math.min(Math.max(isNaN(num) ? 12 : num, 1), 30);
        const cleanQuery = query.trim();
        const nowMs = Date.now();
        const profile = computeEdgeRecencyProfile(cleanQuery, context, nowMs);

        // Dekomposisi Aljabar Boolean K ∧ (e₁ ∨ ... ∨ eₘ) hanya untuk >= 2 KELUARGA LAB BERBEDA
        const LAB_FAMILY = {
          openai: 'openai', chatgpt: 'openai', gpt: 'openai',
          anthropic: 'anthropic', claude: 'anthropic',
          google: 'google', deepmind: 'google', gemini: 'google', gemma: 'google',
          meta: 'meta', llama: 'meta',
          mistral: 'mistral', deepseek: 'deepseek',
          qwen: 'qwen', alibaba: 'qwen',
          xai: 'xai', grok: 'xai',
          nvidia: 'nvidia', microsoft: 'microsoft', cohere: 'cohere', zhipu: 'zhipu'
        };
        const rawWords = cleanQuery.replace(/[?,!;:()[\]{}"'`]+/g, ' ').split(/\s+/).filter(Boolean);
        const NOISE = new Set(['apa','siapa','kapan','dimana','bagaimana','coba','cari','carikan','tolong','di','ke','dari','internet','terbaru','terkini','minggu','hari','bulan','ini','itu','please','find','latest','newest','recent','what','makes','make','different','from','between']);
        const ents = [];
        const core = [];
        for (const w of rawWords) {
          const lw = w.toLowerCase();
          if (NOISE.has(lw) || /^20[12]\d$/.test(lw)) continue;
          if (LAB_FAMILY[lw]) ents.push(lw);
          else core.push(w);
        }
        const distinctFamilies = new Set(ents.map(e => LAB_FAMILY[e] || e));
        const fullCleanStr = [...rawWords.filter(w => !NOISE.has(w.toLowerCase()))].slice(0, 8).join(' ').trim() || cleanQuery;
        const coreStr = (distinctFamilies.size >= 2 ? core.join(' ').trim() : fullCleanStr) || cleanQuery;
        const enCore = coreStr
          .replace(/\brilis\b/gi, 'release')
          .replace(/\bberita\b/gi, 'news')
          .replace(/\bharga\b/gi, 'price')
          .replace(/\bkecerdasan\s+buatan\b/gi, 'AI');
        const subQueries = [];
        if (distinctFamilies.size >= 2 && core.length >= 2) {
          subQueries.push(`${enCore} (${ents.slice(0, 6).join(' OR ')})`.trim());
          subQueries.push(enCore);
        } else {
          subQueries.push(enCore);
          if (enCore.toLowerCase() !== coreStr.toLowerCase()) subQueries.push(coreStr);
        }
        const isIndoEdge = /\b(indonesia|jakarta|perbedaan|pengertian|manajer|manajemen|proyek|portofolio|siapa|bagaimana|mengapa|kenapa|apakah|adalah|cara|sejarah|perkembangan|kecerdasan|buatan)\b/i.test(cleanQuery);

        const PRIMARY_FEEDS = [
          'https://feeds.arstechnica.com/arstechnica/index',
          'https://huggingface.co/blog/feed.xml',
          'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
          'https://techcrunch.com/category/artificial-intelligence/feed/',
          'https://simonwillison.net/atom/everything/',
          'https://www.antaranews.com/rss/tekno.xml'
        ];

        const parseRssXmlItems = (xml, maxItems = 10, unwrapBing = false) => {
          const items = [];
          const itemRegex = /<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
          let match;
          while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
            const raw = match[1];
            const titleM = /<title\b[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i.exec(raw);
            const linkAttrM = /<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(raw);
            const linkM = /<link\b[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/link>/i.exec(raw);
            const descM = /<(?:description|content:encoded|summary|content)\b[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/(?:description|content:encoded|summary|content)>/i.exec(raw);
            const pubM = /<(?:pubDate|dc:date|published|updated)\b[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/(?:pubDate|dc:date|published|updated)>/i.exec(raw);
            const srcM = /<source\b[^>]*>([\s\S]*?)<\/source>/i.exec(raw);

            const title = (titleM ? (titleM[1] || titleM[2] || '') : '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
            let link = (linkM ? (linkM[1] || linkM[2] || '') : (linkAttrM ? linkAttrM[1] : '')).replace(/&amp;/g, '&').trim();
            if (unwrapBing && link.includes('bing.com/news/apiclick.aspx')) {
              try {
                const uParam = new URL(link).searchParams.get('url');
                if (uParam && /^https?:\/\//i.test(uParam)) link = uParam;
              } catch (_) {}
            }
            const descText = (descM ? (descM[1] || descM[2] || '') : '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
            const pubDate = (pubM ? (pubM[1] || pubM[2] || '') : '').trim();
            const srcName = srcM ? srcM[1].replace(/<[^>]+>/g, '').trim() : '';
            if (title && link && /^https?:\/\//i.test(link)) {
              let domain = 'web';
              try { domain = new URL(link).hostname.replace(/^www\./i, ''); } catch (_) {}
              if (domain === 'news.google.com' && srcName) domain = srcName;
              items.push({
                url: link,
                domain,
                title,
                snippet: descText.slice(0, 320),
                content: descText.slice(0, 4000),
                category: 'live_feed',
                published_at: pubDate
              });
            }
          }
          return items;
        };

        const tasks = [];
        const mainSubQ = subQueries[0] || cleanQuery;
        const whenSuffix = profile.alpha >= 0.65 ? ' when:30d' : '';

        // 0A. General Web Search (DuckDuckGo HTML dengan unwrapping uddg= & Sec-Fetch headers)
        tasks.push((async () => {
          try {
            const webQ = isIndoEdge ? fullCleanStr : mainSubQ;
            const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(webQ)}`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': isIndoEdge ? 'id-ID,id;q=0.9,en-US;q=0.8' : 'en-US,en;q=0.9,id;q=0.7',
                'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Upgrade-Insecure-Requests': '1'
              },
              signal: AbortSignal.timeout(4200)
            });
            if (!r.ok || r.status !== 200) return [];
            const html = await r.text();
            if (!html || html.includes('anomaly-modal')) return [];
            const out = [];
            const chunks = html.split(/<div\b[^>]*class="[^"]*\bresults_links\b[^"]*"[^>]*>/i).slice(1);
            for (const ch of chunks) {
              if (out.length >= 10) break;
              if (/result--ad|badge--ad/i.test(ch.slice(0, 600))) continue;
              const aM = /<a\b[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(ch)
                || /<a\b[^>]*href="([^"]+)"[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(ch);
              if (!aM) continue;
              let href = aM[1].replace(/&amp;/g, '&').trim();
              if (href.startsWith('//')) href = 'https:' + href;
              let link = '';
              try {
                const uo = new URL(href, 'https://html.duckduckgo.com');
                if (uo.pathname.includes('/y.js') || uo.searchParams.has('ad_domain')) continue;
                const uddg = uo.searchParams.get('uddg');
                if (uddg && /^https?:\/\//i.test(uddg)) link = uddg;
                else if (/^https?:\/\//i.test(uo.href) && !/duckduckgo\.com$/i.test(uo.hostname)) link = uo.href;
              } catch (_) {}
              if (!link) continue;
              const title = aM[2].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/\s+/g, ' ').trim();
              const sM = /<(?:a|div|span)\b[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i.exec(ch);
              const snippet = sM ? sM[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/\s+/g, ' ').trim().slice(0, 420) : '';
              let domain = 'web';
              try { domain = new URL(link).hostname.replace(/^www\./i, ''); } catch (_) {}
              if (title && link) out.push({ url: link, domain, title, snippet, content: snippet || title, category: 'general_web', published_at: '' });
            }
            return out;
          } catch (_) { return []; }
        })());

        // 0B. Wikipedia MediaWiki Search API (ID / EN)
        tasks.push((async () => {
          try {
            const wLang = isIndoEdge ? 'id' : 'en';
            const wQuery = (isIndoEdge ? fullCleanStr : enCore).split(/\s+/).slice(0, 5).join(' ');
            const r = await fetch(`https://${wLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(wQuery)}&srlimit=4&format=json`, {
              headers: { 'User-Agent': 'ZozRouterIR/2.1 (https://z21.zozdocs.com)' },
              signal: AbortSignal.timeout(3500)
            });
            if (!r.ok) return [];
            const data = await r.json();
            return ((data && data.query && data.query.search) || []).map(h => {
              const pageTitle = String(h.title || '').trim();
              const snippet = String(h.snippet || '').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
              return {
                url: `https://${wLang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/\s+/g, '_'))}`,
                domain: `${wLang}.wikipedia.org`,
                title: `${pageTitle} - Wikipedia`,
                snippet,
                content: snippet || pageTitle,
                category: 'encyclopedia',
                published_at: ''
              };
            });
          } catch (_) { return []; }
        })());

        // 1. Bing News RSS Live Query (dengan unwrapping URL penerbit asli)
        for (const sq of subQueries.slice(0, 2)) {
          tasks.push((async () => {
            try {
              const bUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(sq)}&format=rss&setlang=en-us`;
              const r = await fetch(bUrl, { headers: { 'User-Agent': 'Mozilla/5.0 ZozSpider/3.0' }, signal: AbortSignal.timeout(4000) });
              return r.ok ? parseRssXmlItems(await r.text(), 10, true) : [];
            } catch (_) { return []; }
          })());
        }

        // 2. Google News RSS Live Query (EN & ID)
        tasks.push((async () => {
          try {
            const gEn = `https://news.google.com/rss/search?q=${encodeURIComponent(mainSubQ + whenSuffix)}&hl=en-US&gl=US&ceid=US:en`;
            const r = await fetch(gEn, { headers: { 'User-Agent': 'Mozilla/5.0 ZozSpider/3.0' }, signal: AbortSignal.timeout(4000) });
            return r.ok ? parseRssXmlItems(await r.text(), 10, false) : [];
          } catch (_) { return []; }
        })());
        tasks.push((async () => {
          try {
            const gId = `https://news.google.com/rss/search?q=${encodeURIComponent(coreStr + whenSuffix)}&hl=id&gl=ID&ceid=ID:id`;
            const r = await fetch(gId, { headers: { 'User-Agent': 'Mozilla/5.0 ZozSpider/3.0' }, signal: AbortSignal.timeout(4000) });
            return r.ok ? parseRssXmlItems(await r.text(), 8, false) : [];
          } catch (_) { return []; }
        })());

        // 3. Hacker News Algolia Live API (timestamp Unix terverifikasi)
        tasks.push((async () => {
          try {
            const endpoint = profile.alpha >= 0.65 ? 'search_by_date' : 'search';
            const minTs = profile.alpha >= 0.65 ? `&numericFilters=created_at_i>${Math.floor((nowMs - 45 * 864e5) / 1000)}` : '';
            const hnUrl = `https://hn.algolia.com/api/v1/${endpoint}?query=${encodeURIComponent(enCore)}&tags=story&hitsPerPage=8${minTs}`;
            const r = await fetch(hnUrl, { signal: AbortSignal.timeout(3500) });
            if (!r.ok) return [];
            const data = await r.json();
            return (Array.isArray(data.hits) ? data.hits : []).filter(h => h && h.title && h.url).map(h => {
              let domain = 'news.ycombinator.com';
              try { domain = new URL(h.url).hostname.replace(/^www\./i, ''); } catch (_) {}
              return {
                url: h.url,
                domain,
                title: h.title,
                snippet: `${h.title} (${h.points || 0} pts, ${h.num_comments || 0} comments on HN)`,
                content: h.story_text ? String(h.story_text).replace(/<[^>]+>/g, ' ').slice(0, 2000) : h.title,
                category: 'hn_live',
                published_at: h.created_at || ''
              };
            });
          } catch (_) { return []; }
        })());

        // 4. Primary Publisher Feeds
        for (const fUrl of PRIMARY_FEEDS) {
          tasks.push((async () => {
            try {
              const r = await fetch(fUrl, { headers: { 'User-Agent': 'Mozilla/5.0 ZozSpider/3.0' }, signal: AbortSignal.timeout(3800) });
              return r.ok ? parseRssXmlItems(await r.text(), 8, false) : [];
            } catch (_) { return []; }
          })());
        }

        const settled = await Promise.allSettled(tasks);
        const seenUrls = new Set();
        const candidatePool = [];
        for (const st of settled) {
          if (st.status === 'fulfilled' && Array.isArray(st.value)) {
            for (const it of st.value) {
              const norm = String(it.url || '').trim().replace(/\/+$/, '');
              if (!norm || seenUrls.has(norm)) continue;
              seenUrls.add(norm);
              candidatePool.push(it);
            }
          }
        }

        const ranked = rankEdgeDocumentsMathematically(candidatePool, cleanQuery, profile, nowMs);
        const topEdge = ranked.slice(0, targetNum);

        // Perkaya konten teks halaman teratas (maks 3 URL non-Google-News-RSS) agar AI menerima isi faktual, bukan hanya judul/link
        const enrichTargets = topEdge
          .slice(0, 3)
          .filter(it => it && it.url && /^https?:\/\//i.test(it.url) && !/news\.google\.com\/rss\/articles\//i.test(it.url) && String(it.content || '').length < 400);
        if (enrichTargets.length > 0) {
          await Promise.allSettled(enrichTargets.map(async (it) => {
            try {
              const parsedItUrl = new URL(it.url);
              if (isPrivateHostname(parsedItUrl.hostname)) return;
              const pageRes = await fetch(it.url, {
                redirect: 'manual',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36', 'Accept': 'text/html,*/*;q=0.8' },
                signal: AbortSignal.timeout(2500)
              });
              if (!pageRes.ok) return;
              const ct = (pageRes.headers.get('content-type') || '').toLowerCase();
              if (!ct.includes('text/html') && !ct.includes('text/plain')) return;
              const rawHtml = await pageRes.text();
              const mainMatch = rawHtml.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
              const targetHtml = (mainMatch && mainMatch[1] && mainMatch[1].length >= 250) ? mainMatch[1] : rawHtml;
              const plain = targetHtml
                .replace(/<head\b[\s\S]*?<\/head>/gi, ' ')
                .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
                .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
                .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
                .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
                .replace(/<(?:nav|header|footer|aside)\b[\s\S]*?<\/(?:nav|header|footer|aside)>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Math.min(65535, Number(dec) || 32)))
                .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Math.min(65535, parseInt(hex, 16) || 32)))
                .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              if (plain.length > String(it.content || '').length) {
                it.content = plain.slice(0, 3200);
                if (!it.snippet || it.snippet.length < 80) it.snippet = plain.slice(0, 320);
              }
            } catch (_) {}
          }));
        }

        const results = topEdge.map(it => ({
          title: it.title,
          url: it.url,
          domain: it.domain,
          snippet: it.snippet,
          content: it.content || '',
          sourceProvider: `Zoz Mathematical IR (${it.domain})`,
          timestamp: it.timestamp || 0,
          pubDate: it.pubDate || '',
          ageDays: it.ageDays,
          mathematicalScore: it.mathematicalScore
        }));

        return new Response(JSON.stringify({
          success: true,
          query: cleanQuery,
          engine: 'zoz_sovereign_mathematical_ir_v2',
          temporalProfile: profile,
          count: results.length,
          results
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
        let playlistId = null;
        const match = parsedUrl.href.match(/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
        if (match && match[1]) videoId = match[1];
        const plMatch = parsedUrl.href.match(/(?:playlist\?(?:.*&)?list=)([a-zA-Z0-9_-]+)/i);
        if (plMatch && plMatch[1]) playlistId = plMatch[1];
        const canonicalUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : parsedUrl.href;

        // 1. Coba ambil metadata lengkap (deskripsi, durasi, view count, transkrip nyata) via YouTube InnerTube
        if (videoId) {
          try {
            const innerClientVer = '20.10.38';
            const innerUserAgent = `com.google.android.youtube/${innerClientVer} (Linux; U; Android 14)`;
            const innerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': innerUserAgent
              },
              body: JSON.stringify({
                context: { client: { clientName: 'ANDROID', clientVersion: innerClientVer } },
                videoId: videoId
              }),
              signal: AbortSignal.timeout(8000)
            });
            if (innerRes.ok) {
              const innerData = await innerRes.json();
              const details = innerData.videoDetails;
              if (details && details.title) {
                let transcript = '';
                let hasTranscript = false;
                let transcriptLang = '';
                const captionTracks = innerData.captions?.playerCaptionsTracklistRenderer?.captionTracks;
                if (Array.isArray(captionTracks) && captionTracks.length > 0) {
                  const selectedTrack = captionTracks.find(t => t.languageCode === 'id') ||
                                        captionTracks.find(t => t.languageCode === 'en') ||
                                        captionTracks[0];
                  if (selectedTrack && selectedTrack.baseUrl) {
                    transcriptLang = selectedTrack.languageCode || '';
                    try {
                      const json3Url = selectedTrack.baseUrl.includes('&fmt=')
                        ? selectedTrack.baseUrl.replace(/&fmt=[^&]+/, '&fmt=json3')
                        : (selectedTrack.baseUrl + '&fmt=json3');
                      const tRes = await fetch(json3Url, {
                        headers: { 'User-Agent': innerUserAgent },
                        signal: AbortSignal.timeout(8000)
                      });
                      if (tRes.ok) {
                        const tText = await tRes.text();
                        try {
                          const jd = JSON.parse(tText);
                          if (Array.isArray(jd.events)) {
                            const words = [];
                            for (const ev of jd.events) {
                              if (Array.isArray(ev.segs)) {
                                const line = ev.segs.map(s => s.utf8 || '').join('').trim();
                                if (line) words.push(line);
                              }
                            }
                            transcript = words.join(' ').replace(/\s+/g, ' ').trim();
                            if (transcript.length > 0) hasTranscript = true;
                          }
                        } catch (_) {
                          const re = /<text[^>]*>([^<]+)<\/text>/g;
                          let m;
                          const words = [];
                          while ((m = re.exec(tText)) !== null) {
                            words.push(m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'));
                          }
                          if (words.length > 0) {
                            transcript = words.join(' ').replace(/\s+/g, ' ').trim();
                            hasTranscript = true;
                          }
                        }
                      }
                    } catch (_) {}
                  }
                }

                const s = parseInt(details.lengthSeconds, 10);
                let durationText = '';
                if (!isNaN(s) && s > 0) {
                  const h = Math.floor(s / 3600);
                  const m = Math.floor((s % 3600) / 60);
                  const sec = s % 60;
                  durationText = h > 0 ? `${h} jam ${m} menit ${sec} detik` : (m > 0 ? `${m} menit ${sec} detik` : `${sec} detik`);
                }

                return new Response(JSON.stringify({
                  success: true,
                  url: canonicalUrl,
                  videoId,
                  playlistId,
                  title: details.title || 'Tanpa Judul',
                  channel: details.author || 'Kreator YouTube',
                  channel_url: details.channelId ? `https://www.youtube.com/channel/${details.channelId}` : '',
                  thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                  type: 'video',
                  duration: details.lengthSeconds || '',
                  durationText,
                  views: details.viewCount || '',
                  description: details.shortDescription || '',
                  hasTranscript,
                  transcriptLang,
                  transcript,
                  html: ''
                }), {
                  status: 200,
                  headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=7200, s-maxage=14400, stale-while-revalidate=86400',
                    'Vary': 'Accept-Encoding'
                  }
                });
              }
            }
          } catch (_) {}
        }

        // 2. Fallback ke endpoint YouTube oEmbed resmi
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
            playlistId,
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
          playlistId,
          title: data.title || 'Tanpa Judul',
          channel: data.author_name || 'Kreator YouTube',
          channel_url: data.author_url || '',
          thumbnail: data.thumbnail_url || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''),
          type: data.type || 'video',
          hasTranscript: false,
          html: data.html || ''
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=7200, s-maxage=14400, stale-while-revalidate=86400',
            'Vary': 'Accept-Encoding'
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Universal Video Link Probe API (deteksi video dari URL apa pun pada Cloudflare Pages / Workers)
    if (url.pathname === '/api/video-probe' && (request.method === 'GET' || request.method === 'POST')) {
      try {
        let target = '';
        if (request.method === 'GET') {
          target = (url.searchParams.get('url') || '').trim();
        } else {
          const b = await request.json().catch(() => ({}));
          target = (b.url || '').trim();
        }
        if (!target) {
          return new Response(JSON.stringify({ success: false, error: 'Parameter url diperlukan.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        let clean = target;
        if (!/^https?:\/\//i.test(clean)) clean = 'https://' + clean;
        const parsed = new URL(clean);
        if (!['http:', 'https:'].includes(parsed.protocol) || isPrivateHostname(parsed.hostname)) {
          return new Response(JSON.stringify({ success: false, error: 'Akses ke host lokal / intranet diblokir (SSRF Protection).' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const extRe = /\.(?:mp4|m4v|webm|ogv|mov|mkv|m3u8)(?:$|[?#])/i;
        let currentProbeUrl = clean;
        let resp = null;
        for (let hop = 0; hop <= 3; hop++) {
          const hopParsed = new URL(currentProbeUrl);
          if (!['http:', 'https:'].includes(hopParsed.protocol) || isPrivateHostname(hopParsed.hostname)) {
            return new Response(JSON.stringify({ success: false, error: 'Redirect ke host lokal / intranet diblokir (SSRF Protection).' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }
          resp = await fetch(currentProbeUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,video/*;q=0.9,*/*;q=0.5',
              'Range': 'bytes=0-524287'
            },
            redirect: 'manual',
            signal: AbortSignal.timeout(9000)
          });
          if (resp.status >= 300 && resp.status < 400) {
            const loc = resp.headers.get('location');
            try { await resp.body?.cancel(); } catch (_) {}
            if (!loc) break;
            currentProbeUrl = new URL(loc, currentProbeUrl).toString();
            continue;
          }
          break;
        }
        if (resp && resp.status >= 300 && resp.status < 400) {
          return new Response(JSON.stringify({ success: false, error: 'Terlalu banyak redirect pada target probe.', url: clean }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (!resp.ok && resp.status !== 206) {
          return new Response(JSON.stringify({ success: false, error: `HTTP ${resp.status}`, url: clean }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const ctype = String(resp.headers.get('content-type') || '').toLowerCase();
        const finalUrl = currentProbeUrl || resp.url || clean;
        const finalParsed = new URL(finalUrl);

        if (/^video\//.test(ctype) || /mpegurl|application\/ogg/.test(ctype) || (/octet-stream/.test(ctype) && extRe.test(finalParsed.pathname))) {
          const fileName = decodeURIComponent(finalParsed.pathname.split('/').filter(Boolean).pop() || finalParsed.hostname);
          return new Response(JSON.stringify({
            success: true,
            kind: 'file',
            fileUrl: finalUrl,
            url: clean,
            site: finalParsed.hostname,
            title: fileName,
            hls: /mpegurl/.test(ctype) || /\.m3u8(?:$|[?#])/i.test(finalParsed.pathname)
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=600' }
          });
        }

        const html = await resp.text();
        const getMeta = (prop) => {
          const m = html.match(new RegExp(`<meta\\b[^>]*(?:property|name)=["'](?:og:|twitter:)?${prop}["'][^>]*content=["']([^"']*)["']`, 'i')) ||
                    html.match(new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["'](?:og:|twitter:)?${prop}["']`, 'i'));
          return m ? m[1] : '';
        };

        const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
        const title = getMeta('title') || (titleMatch ? titleMatch[1].trim() : finalParsed.hostname);
        const thumbnail = getMeta('image');
        const site = getMeta('site_name') || finalParsed.hostname;
        const vUrl = getMeta('video:secure_url') || getMeta('video:url') || getMeta('video');
        const vType = getMeta('video:type');
        const player = getMeta('player');

        let result = null;
        if (vUrl && (/^video\//.test(vType) || extRe.test(vUrl))) {
          result = { kind: 'file', fileUrl: vUrl, hls: /\.m3u8(?:$|[?#])/i.test(vUrl) };
        } else {
          const embed = player || (vUrl && /^https:/i.test(vUrl) ? vUrl : '');
          if (embed && /^https:\/\//i.test(embed) && embed !== clean) {
            result = { kind: 'embed', embedUrl: embed };
          }
        }

        if (!result) {
          const xvM = clean.match(/https?:\/\/(?:www\.|m\.)?xvideos\.com\/(?:video(?:[._\/-])?([0-9a-zA-Z_]+)|embedframe\/([0-9a-zA-Z_]+))/i);
          const xnM = clean.match(/https?:\/\/(?:www\.|m\.)?xnxx\.com\/(?:video(?:[._\/-])?([0-9a-zA-Z_]+)|embedframe\/([0-9a-zA-Z_]+))/i);
          const phM = clean.match(/https?:\/\/(?:www\.|m\.)?pornhub\.com\/view_video\.php\?(?:.*&)?viewkey=([a-zA-Z0-9]+)/i);
          if (xvM) result = { kind: 'embed', embedUrl: `https://www.xvideos.com/embedframe/${xvM[1] || xvM[2]}` };
          else if (xnM) result = { kind: 'embed', embedUrl: `https://www.xnxx.com/embedframe/${xnM[1] || xnM[2]}` };
          else if (phM) result = { kind: 'embed', embedUrl: `https://www.pornhub.com/embed/${phM[1]}` };
        }

        if (!result) {
          return new Response(JSON.stringify({ success: false, error: 'Halaman ini tidak memuat video yang dapat disematkan.', url: clean }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          ...result,
          url: clean,
          title,
          thumbnail: /^https?:\/\//i.test(thumbnail) ? thumbnail : '',
          site
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=600' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message, url: target }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Related & Recommended Videos Tool API (Cloudflare Worker - All Videos on Earth)
    if ((url.pathname === '/api/tools/related-videos' || url.pathname === '/api/tools/search-videos') && (request.method === 'GET' || request.method === 'POST')) {
      try {
        let videoUrl = '';
        let query = '';
        let limit = 5;
        let platform = 'auto';
        if (request.method === 'GET') {
          videoUrl = url.searchParams.get('video_url') || url.searchParams.get('url') || url.searchParams.get('link') || '';
          query = url.searchParams.get('query') || url.searchParams.get('q') || url.searchParams.get('search') || url.searchParams.get('topic') || '';
          limit = parseInt(url.searchParams.get('limit') || url.searchParams.get('max_results') || '5', 10);
          platform = url.searchParams.get('platform') || 'auto';
        } else {
          const body = await request.json().catch(() => ({}));
          videoUrl = body.video_url || body.videoUrl || body.url || body.link || '';
          query = body.query || body.q || body.search || body.topic || '';
          if (body.limit || body.max_results) limit = parseInt(body.limit || body.max_results, 10);
          if (body.platform) platform = body.platform;
        }

        let effectiveQuery = String(query || '').trim();
        if (!effectiveQuery && videoUrl) {
          try {
            const p = new URL(videoUrl);
            const slug = p.pathname.split('/').filter(Boolean).pop();
            if (slug && slug.length > 2 && !/^[0-9a-f]{16,}$/i.test(slug)) {
              effectiveQuery = decodeURIComponent(slug).replace(/[._-]+/g, ' ').trim();
            }
          } catch (_) {}
        }
        if (!effectiveQuery) effectiveQuery = 'popular trending videos';

        const parsedLim = Number(limit);
        const safeLimit = Math.min(Math.max(Number.isFinite(parsedLim) ? parsedLim : 6, 1), 10);
        let mapped = [];

        const isAdult = /porn|sex|hentai|creampie|squirt|cunt|pussy|tits|blowjob|anal|milf|jav|boobs|nsfw|xxx|slut/i.test(effectiveQuery) ||
          /xvideos|xnxx|pornhub|redtube|youporn/i.test(videoUrl) ||
          platform === 'xvideos' || platform === 'xnxx';

        if (isAdult || platform === 'xvideos' || platform === 'xnxx') {
          try {
            const xvRes = await fetch('https://www.xvideos.com/?k=' + encodeURIComponent(effectiveQuery), {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              },
              signal: AbortSignal.timeout(5000)
            });
            if (xvRes.ok) {
              const html = await xvRes.text();
              const videoBlockRegex = /<div id="video_([0-9a-zA-Z]+)"[\s\S]*?<p class="title">\s*<a href="([^"]+)"\s+title="([^"]+)"[\s\S]*?<\/div>/gi;
              let m;
              while ((m = videoBlockRegex.exec(html)) !== null && mapped.length < safeLimit) {
                const block = m[0];
                const durMatch = block.match(/<span class="duration">([^<]+)<\/span>/i);
                const chMatch = block.match(/<span class="name">([^<]+)<\/span>/i);
                const viewsMatch = block.match(/([0-9.]+[kMGT]?)\s*<span class="sprfluous">\s*Views/i);
                mapped.push({
                  platform: 'XVIDEOS',
                  videoId: m[1],
                  url: `https://www.xvideos.com${m[2]}`,
                  title: m[3].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim(),
                  channel: chMatch ? chMatch[1].trim() : 'XVIDEOS',
                  duration: durMatch ? durMatch[1].trim() : '',
                  views: viewsMatch ? `${viewsMatch[1]} views` : ''
                });
              }
            }
          } catch (_) {}
        } else {
          // Multi-platform global search across YouTube, Dailymotion & Archive.org
          const isDailymotion = /dailymotion\.com|dai\.ly/i.test(videoUrl) || platform === 'dailymotion';
          const isArchive = /archive\.org/i.test(videoUrl) || platform === 'archive';
          const isYouTube = /youtube\.com|youtu\.be/i.test(videoUrl) || platform === 'youtube';

          if (isDailymotion || platform === 'all' || platform === 'auto') {
            try {
              const dmRes = await fetch('https://api.dailymotion.com/videos?search=' + encodeURIComponent(effectiveQuery) + '&fields=id,title,description,channel,duration,views_total,thumbnail_url,url&limit=' + safeLimit, { signal: AbortSignal.timeout(5000) });
              if (dmRes.ok) {
                const dmJson = await dmRes.json();
                if (Array.isArray(dmJson.list)) {
                  dmJson.list.forEach(item => {
                    const dur = parseInt(item.duration, 10);
                    const m = Math.floor(dur / 60);
                    const s = dur % 60;
                    const cleanDesc = String(item.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    mapped.push({
                      platform: 'Dailymotion',
                      url: item.url || `https://www.dailymotion.com/video/${item.id}`,
                      title: item.title || 'Video Dailymotion',
                      channel: item.channel || 'Dailymotion',
                      duration: dur > 0 ? `${m}:${String(s).padStart(2, '0')}` : '',
                      views: item.views_total ? `${item.views_total} views` : '',
                      description: cleanDesc.slice(0, 600),
                      thumbnail: item.thumbnail_url || ''
                    });
                  });
                }
              }
            } catch (_) {}
          }

          if (mapped.length < safeLimit && (isYouTube || platform === 'all' || platform === 'auto')) {
            try {
              const data = await ytSearchVideos(effectiveQuery, safeLimit - mapped.length);
              const ytMapped = (data && Array.isArray(data.results)) ? data.results.map(v => ({
                platform: 'YouTube',
                videoId: v.videoId,
                url: v.url || `https://www.youtube.com/watch?v=${v.videoId}`,
                title: v.title,
                channel: v.channel,
                duration: v.durationText || '',
                views: v.viewText || '',
                publishedText: v.publishedText || '',
                description: v.description || '',
                thumbnail: v.thumbnail || ''
              })) : [];
              mapped = mapped.concat(ytMapped);
            } catch (_) {}
          }

          if (mapped.length < safeLimit && (isArchive || platform === 'all' || platform === 'auto')) {
            try {
              const archRes = await fetch('https://archive.org/advancedsearch.php?q=' + encodeURIComponent(effectiveQuery) + '+AND+mediatype:movies&fl[]=identifier,title,description,duration&rows=' + (safeLimit - mapped.length) + '&output=json', { signal: AbortSignal.timeout(4000) });
              if (archRes.ok) {
                const archJson = await archRes.json();
                const docs = archJson?.response?.docs || [];
                docs.forEach(doc => {
                  const rawDesc = Array.isArray(doc.description) ? doc.description.join(' ') : (doc.description || '');
                  const cleanDesc = String(rawDesc).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                  mapped.push({
                    platform: 'Archive.org',
                    videoId: doc.identifier,
                    url: `https://archive.org/details/${doc.identifier}`,
                    title: doc.title || doc.identifier,
                    channel: 'Internet Archive',
                    duration: doc.duration || '',
                    views: '',
                    description: cleanDesc.slice(0, 600)
                  });
                });
              }
            } catch (_) {}
          }
        }

        return new Response(JSON.stringify({
          success: mapped.length > 0,
          platform: isAdult ? 'XVIDEOS' : (mapped[0]?.platform || 'multi-platform'),
          query: effectiveQuery,
          sourceVideoUrl: videoUrl || null,
          count: mapped.length,
          videos: mapped.slice(0, safeLimit)
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message, videos: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Helper implementasi tool pencarian sumber web, ekstraksi konten URL, & rangkuman sumber di Cloudflare Edge
    const searchWebSources = async ({ query = '', sources = [], max_results = 5 }) => {
      const cleanQ = String(query || '').trim();
      if (!cleanQ) return { success: false, error: 'Parameter query wajib diisi.', results: [] };
      const cap = Math.min(Math.max(Number.isFinite(Number(max_results)) ? Number(max_results) : 5, 1), 10);
      const domainMap = {
        github: 'github.com',
        bloomberg: 'bloomberg.com',
        reddit: 'reddit.com',
        x: 'x.com',
        twitter: 'x.com',
        cnn: 'cnn.com',
        cna: 'cna.al',
        arxiv: 'arxiv.org'
      };
      const siteFilters = (Array.isArray(sources) ? sources : [])
        .map(s => domainMap[String(s || '').toLowerCase()] || String(s || '').replace(/[^a-z0-9.-]/gi, ''))
        .filter(Boolean);
      const effectiveQ = siteFilters.length > 0
        ? `${cleanQ} (${siteFilters.map(d => `site:${d}`).join(' OR ')})`
        : cleanQ;
      const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(effectiveQ)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000)
      });
      const html = ddgRes.ok ? await ddgRes.text() : '';
      const results = [];
      const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = linkRe.exec(html)) !== null && results.length < cap) {
        let rawHref = String(m[1] || '').replace(/&amp;/gi, '&');
        const uddg = rawHref.match(/[?&]uddg=([^&]+)/);
        if (uddg) {
          try { rawHref = decodeURIComponent(uddg[1]); } catch (_) {}
        }
        const title = m[2].replace(/<[^>]+>/g, '').trim();
        if (/^https?:\/\//i.test(rawHref)) {
          results.push({ title: title || rawHref, url: rawHref });
        }
      }
      return { success: true, query: cleanQ, count: results.length, results };
    };

    const fetchUrlContent = async ({ url: targetUrl = '', extract_mode = 'full_text' }) => {
      const cleanUrl = String(targetUrl || '').trim();
      if (!cleanUrl) return { success: false, error: 'Parameter url wajib diisi.' };
      let currentUrl;
      try { currentUrl = new URL(cleanUrl); } catch (_) { return { success: false, error: 'URL tidak valid.' }; }
      if (!['http:', 'https:'].includes(currentUrl.protocol) || isPrivateHostname(currentUrl.hostname)) {
        return { success: false, error: 'Target URL privat atau tidak diizinkan.' };
      }
      let res = null;
      for (let hop = 0; hop <= 4; hop++) {
        res = await fetch(currentUrl.toString(), {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          redirect: 'manual',
          signal: AbortSignal.timeout(9000)
        });
        if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get('location')) {
          const loc = res.headers.get('location');
          try { await res.body?.cancel(); } catch (_) {}
          if (hop >= 4) return { success: false, status: res.status, error: 'Terlalu banyak redirect.' };
          let nextUrl;
          try { nextUrl = new URL(loc, currentUrl); } catch (_) { return { success: false, error: 'Redirect URL tidak valid.' }; }
          if (!['http:', 'https:'].includes(nextUrl.protocol) || isPrivateHostname(nextUrl.hostname)) {
            return { success: false, error: 'Redirect ke target URL privat diblokir.' };
          }
          currentUrl = nextUrl;
          continue;
        }
        break;
      }
      if (!res || !res.ok) {
        try { await res?.body?.cancel(); } catch (_) {}
        return { success: false, status: res ? res.status : 502, error: `HTTP ${res ? res.status : 502}` };
      }
      const ctype = String(res.headers.get('content-type') || '').toLowerCase();
      if (ctype && !/(?:text\/|json|xml|html|xhtml)/i.test(ctype)) {
        try { await res.body?.cancel(); } catch (_) {}
        return { success: false, error: `Tipe konten non-teks tidak didukung (${ctype.split(';')[0]}).` };
      }
      let rawHtml = '';
      if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let bytesRead = 0;
        const maxBytes = 1024 * 1024;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytesRead += value ? value.byteLength : 0;
          rawHtml += dec.decode(value, { stream: true });
          if (bytesRead >= maxBytes) {
            try { await reader.cancel(); } catch (_) {}
            break;
          }
        }
        rawHtml += dec.decode();
      } else {
        rawHtml = await res.text();
      }
      const text = rawHtml
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const maxLen = extract_mode === 'summary' ? 2500 : 12000;
      return { success: true, url: currentUrl.toString(), content: text.slice(0, maxLen) };
    };

    const summarizeSources = async ({ query = '', urls = [] }) => {
      const validUrls = (Array.isArray(urls) ? urls : []).slice(0, 5);
      const items = [];
      for (const u of validUrls) {
        try {
          const item = await fetchUrlContent({ url: u, extract_mode: 'summary' });
          if (item && item.success) items.push({ url: u, excerpt: item.content });
        } catch (_) {}
      }
      return {
        success: true,
        query,
        sourcesCount: items.length,
        sources: items,
        summary: items.map((it, idx) => `[${idx + 1}] ${it.url}:\n${it.excerpt}`).join('\n\n')
      };
    };

    // 1. Search Web Sources Tool API (Whitelisted Sources: GitHub, Bloomberg, Reddit, X, CNN, CNA Albania, arXiv)
    if (url.pathname === '/api/tools/search-web-sources' && (request.method === 'GET' || request.method === 'POST')) {
      try {
        let query = '';
        let sources = [];
        let max_results = 5;
        let language = '';

        if (request.method === 'GET') {
          query = url.searchParams.get('query') || url.searchParams.get('q') || '';
          sources = url.searchParams.get('sources') ? url.searchParams.get('sources').split(',').map(s => s.trim()) : [];
          max_results = parseInt(url.searchParams.get('max_results') || '5', 10);
          language = url.searchParams.get('language') || '';
        } else {
          const body = await request.json().catch(() => ({}));
          query = body.query || body.q || '';
          if (body.sources) sources = Array.isArray(body.sources) ? body.sources : String(body.sources).split(',').map(s => s.trim());
          if (body.max_results) max_results = parseInt(body.max_results, 10);
          if (body.language) language = body.language;
        }

        const data = await searchWebSources({ query, sources, max_results, language });
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'Gagal mencari sumber web: ' + e.message, results: [] }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 2. Fetch URL Content Tool API (Whitelisted Sources)
    if (url.pathname === '/api/tools/fetch-url-content' && (request.method === 'GET' || request.method === 'POST')) {
      try {
        let targetUrl = '';
        let extract_mode = 'full_text';

        if (request.method === 'GET') {
          targetUrl = url.searchParams.get('url') || url.searchParams.get('link') || '';
          extract_mode = url.searchParams.get('extract_mode') || 'full_text';
        } else {
          const body = await request.json().catch(() => ({}));
          targetUrl = body.url || body.link || '';
          if (body.extract_mode) extract_mode = body.extract_mode;
        }

        const data = await fetchUrlContent({ url: targetUrl, extract_mode });
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'Gagal mengambil konten URL: ' + e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 3. Summarize Sources Tool API (Whitelisted Sources Synthesis)
    if (url.pathname === '/api/tools/summarize-sources' && (request.method === 'GET' || request.method === 'POST')) {
      try {
        let query = '';
        let urls = [];
        let summary_style = 'detailed';
        let include_citations = true;

        if (request.method === 'GET') {
          query = url.searchParams.get('query') || url.searchParams.get('q') || '';
          urls = url.searchParams.get('urls') ? url.searchParams.get('urls').split(',').map(u => u.trim()) : [];
          summary_style = url.searchParams.get('summary_style') || 'detailed';
          include_citations = url.searchParams.get('include_citations') !== 'false';
        } else {
          const body = await request.json().catch(() => ({}));
          query = body.query || body.q || '';
          if (body.urls) urls = Array.isArray(body.urls) ? body.urls : String(body.urls).split(',').map(u => u.trim());
          if (body.summary_style) summary_style = body.summary_style;
          if (typeof body.include_citations === 'boolean') include_citations = body.include_citations;
        }

        const data = await summarizeSources({ query, urls, summary_style, include_citations });
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'Gagal merangkum sumber: ' + e.message }), {
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
          query = url.searchParams.get('q') || url.searchParams.get('query') || url.searchParams.get('keyword') || url.searchParams.get('search') || url.searchParams.get('topic') || url.searchParams.get('title') || url.searchParams.get('text') || url.searchParams.get('cari') || url.searchParams.get('kata_kunci') || url.searchParams.get('judul') || '';
          const parsedLimit = parseInt(url.searchParams.get('limit') || url.searchParams.get('max_results') || '6', 10);
          maxResults = Math.min(Math.max(isNaN(parsedLimit) ? 6 : parsedLimit, 1), 20);
        } else {
          const body = await request.json().catch(() => ({}));
          query = body.q || body.query || body.keyword || body.search || body.topic || body.title || body.text || body.cari || body.kata_kunci || body.judul || '';
          const parsedLimit = parseInt(body.limit || body.max_results || '6', 10);
          maxResults = Math.min(Math.max(isNaN(parsedLimit) ? 6 : parsedLimit, 1), 20);
        }

        if (!query || !String(query).trim()) {
          return new Response(JSON.stringify({ success: false, error: 'Parameter query diperlukan.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const data = await ytSearchVideos(String(query).trim(), maxResults);
        const resHeaders = {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        };
        if (request.method === 'GET') {
          resHeaders['Cache-Control'] = 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=7200';
          resHeaders['Vary'] = 'Accept-Encoding';
        }
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: resHeaders
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Web Page Content Extractor / Autonomous Browse Tool API (via Jina Reader & Direct Fetch)
    if ((url.pathname === '/api/extract-web' || url.pathname === '/api/read-url' || url.pathname === '/api/scrape-url' || url.pathname === '/api/tools/browse-page' || url.pathname === '/api/autonomous/browse') && (request.method === 'GET' || request.method === 'POST')) {
      try {
        let targetUrl = '';
        let maxChars = 8000;
        if (request.method === 'GET') {
          targetUrl = url.searchParams.get('url') || url.searchParams.get('link') || url.searchParams.get('target') || url.searchParams.get('targetUrl') || url.searchParams.get('tautan') || '';
          if (url.searchParams.get('maxChars')) maxChars = parseInt(url.searchParams.get('maxChars'), 10) || 8000;
        } else {
          const body = await request.json().catch(() => ({}));
          targetUrl = body.url || body.link || body.targetUrl || body.target || body.tautan || '';
          if (body.maxChars) maxChars = parseInt(body.maxChars, 10) || 8000;
        }
        if (!targetUrl || !targetUrl.trim()) {
          return new Response(JSON.stringify({ success: false, error: 'Parameter url diperlukan.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        let cleanTarget = targetUrl.trim();
        if (!/^https?:\/\//i.test(cleanTarget)) {
          cleanTarget = 'https://' + cleanTarget;
        }

        let parsedTarget;
        try {
          parsedTarget = new URL(cleanTarget);
        } catch (_) {
          return new Response(JSON.stringify({ success: false, error: 'Format URL tidak valid.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (!['http:', 'https:'].includes(parsedTarget.protocol) || isPrivateHostname(parsedTarget.hostname)) {
          return new Response(JSON.stringify({ success: false, error: 'Akses ke host lokal/privat diblokir demi keamanan.' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        // Intersep khusus untuk URL YouTube resmi saja (cegah pembajakan URL non-YouTube yang memuat /live/ atau /shorts/)
        let isOfficialYtHost = false;
        try {
          const parsedYtHost = new URL(cleanTarget).hostname.toLowerCase();
          isOfficialYtHost = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be'].includes(parsedYtHost);
        } catch (_) {}
        const ytMatch = isOfficialYtHost
          ? cleanTarget.match(/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i)
          : null;
        if (ytMatch && ytMatch[1]) {
          const vidId = ytMatch[1];
          try {
            const innerClientVer = '20.10.38';
            const innerUserAgent = `com.google.android.youtube/${innerClientVer} (Linux; U; Android 14)`;
            const innerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'User-Agent': innerUserAgent },
              body: JSON.stringify({
                context: { client: { clientName: 'ANDROID', clientVersion: innerClientVer } },
                videoId: vidId
              }),
              signal: AbortSignal.timeout(8000)
            });
            if (innerRes.ok) {
              const innerData = await innerRes.json();
              const details = innerData.videoDetails || {};
              let ytTitle = details.title || '';
              if (ytTitle) {
              let ytChannel = details.author || 'YouTube Creator';
              let ytDesc = details.shortDescription || '';
              let transcript = '';

              const captionTracks = innerData.captions?.playerCaptionsTracklistRenderer?.captionTracks;
              if (Array.isArray(captionTracks) && captionTracks.length > 0) {
                const selectedTrack = captionTracks.find(t => t.languageCode === 'id') ||
                                      captionTracks.find(t => t.languageCode === 'en') ||
                                      captionTracks[0];
                if (selectedTrack && selectedTrack.baseUrl) {
                  try {
                    const json3Url = selectedTrack.baseUrl.includes('&fmt=')
                      ? selectedTrack.baseUrl.replace(/&fmt=[^&]+/, '&fmt=json3')
                      : (selectedTrack.baseUrl + '&fmt=json3');
                    const tRes = await fetch(json3Url, {
                      headers: { 'User-Agent': innerUserAgent },
                      signal: AbortSignal.timeout(6000)
                    });
                    if (tRes.ok) {
                      const tText = await tRes.text();
                      try {
                        const jd = JSON.parse(tText);
                        if (Array.isArray(jd.events)) {
                          const words = [];
                          for (const ev of jd.events) {
                            if (Array.isArray(ev.segs)) {
                              const line = ev.segs.map(s => s.utf8 || '').join('').trim();
                              if (line) words.push(line);
                            }
                          }
                          transcript = words.join(' ').replace(/\s+/g, ' ').trim();
                        }
                      } catch (_) {
                        const re = /<text[^>]*>([^<]+)<\/text>/g;
                        let m;
                        const words = [];
                        while ((m = re.exec(tText)) !== null) {
                          words.push(m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'));
                        }
                        if (words.length > 0) transcript = words.join(' ').replace(/\s+/g, ' ').trim();
                      }
                    }
                  } catch (_) {}
                }
              }

              let ytBody = `[DATA TERVERIFIKASI VIDEO YOUTUBE]\n- URL: https://www.youtube.com/watch?v=${vidId}\n- Judul Video: "${ytTitle}"\n- Channel / Pembuat: "${ytChannel}"\n- Thumbnail: https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;
              if (ytDesc) ytBody += `\n- Deskripsi Resmi:\n"""\n${ytDesc.slice(0, 2000)}\n"""`;
              if (transcript) {
                ytBody += `\n- TRANSKRIP PERCAKAPAN LENGKAP REAL-TIME:\n"""\n${transcript.slice(0, 15000)}\n"""`;
              } else {
                ytBody += `\n- Status Transkrip: Tidak tersedia langsung pada video ini (gunakan deskripsi resmi di atas untuk merangkum).`;
              }
              ytBody += `\n\n### PANDUAN ASISTEN AI:\nRangkum dan jelaskan materi video secara mendalam berdasarkan informasi dan transkrip di atas. Dilarang menolak jika deskripsi atau transkrip tersedia.`;

              return new Response(JSON.stringify({
                success: true,
                content: ytBody,
                videoIds: [vidId],
                charCount: ytBody.length
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
              });
              }
            }
          } catch (_) {}

          // Fallback oEmbed jika InnerTube gagal
          try {
            const ytInfoRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${vidId}`)}&format=json`, {
              signal: AbortSignal.timeout(6000),
              headers: { 'User-Agent': YT_SEARCH_UA }
            });
            if (ytInfoRes.ok) {
              const ytData = await ytInfoRes.json();
              return new Response(JSON.stringify({
                success: true,
                content: `[DATA TERVERIFIKASI VIDEO YOUTUBE]\n- URL: https://www.youtube.com/watch?v=${vidId}\n- Judul Video: "${ytData.title}"\n- Nama Channel / Pembuat: "${ytData.author_name || 'Kreator YouTube'}" (${ytData.author_url || 'N/A'})\n- Thumbnail: ${ytData.thumbnail_url || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`}\n\n### PANDUAN ASISTEN AI:\nJelaskan topik video secara informatif dan ramah berdasarkan judul dan nama kreator resmi di atas.`,
                videoIds: [vidId],
                charCount: 450
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
              });
            }
          } catch (_) {}
        }

        let content = '';
        let title = cleanTarget;
        let binaryRejectedReason = '';

        const isWorkerBinaryOrGarbledPdf = (sampleText) => {
          if (typeof sampleText !== 'string' || !sampleText) return false;
          const head = sampleText.slice(0, 12000);
          if (/^%PDF-\d\.\d/i.test(head.trimStart())) return true;
          if (/\b\d+\s+\d+\s+obj\b/.test(head) && /\bendobj\b/.test(head) && /%PDF-\d\.\d/i.test(head)) return true;
          let garbageCount = 0;
          for (let k = 0; k < head.length; k++) {
            const c = head.charCodeAt(k);
            if (c === 0xFFFD || (c < 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D)) garbageCount++;
          }
          return head.length >= 40 && garbageCount >= 4 && (garbageCount / head.length) > 0.04;
        };

        // 1. Prioritaskan Jina Reader untuk ekstraksi halaman penuh bebas blokir
        try {
          const jinaRes = await fetch(`https://r.jina.ai/${cleanTarget}`, {
            headers: { 'Accept': 'text/plain', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(15000)
          });
          if (jinaRes.ok) {
            const jinaText = await jinaRes.text();
            if (jinaText && !isWorkerBinaryOrGarbledPdf(jinaText)) {
              content = jinaText;
              const titleMatch = content.match(/^Title:\s*(.+)$/m);
              if (titleMatch) title = titleMatch[1].trim();
            }
          }
        } catch (_) {}

        // 2. Fallback direct fetch jika Jina gagal (dengan proteksi redirect manual terhadap SSRF)
        if (!content) {
          try {
            let currentFetchUrl = cleanTarget;
            let directRes = null;
            for (let hop = 0; hop < 4; hop++) {
              const hopRes = await fetch(currentFetchUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                redirect: 'manual',
                signal: AbortSignal.timeout(10000)
              });
              if ([301, 302, 303, 307, 308].includes(hopRes.status)) {
                const loc = hopRes.headers.get('location');
                try { await hopRes.body?.cancel(); } catch (_) {}
                if (!loc) break;
                const nextUrl = new URL(loc, currentFetchUrl);
                if (!['http:', 'https:'].includes(nextUrl.protocol) || isPrivateHostname(nextUrl.hostname)) {
                  break;
                }
                currentFetchUrl = nextUrl.toString();
                continue;
              }
              directRes = hopRes;
              break;
            }
            if (directRes && directRes.ok) {
              const directCtype = String(directRes.headers.get('content-type') || '').toLowerCase();
              const isNonTextMime = /^(?:image|audio|video)\/|application\/(?:pdf|octet-stream|zip|x-gzip|msword|vnd\.openxmlformats-)/.test(directCtype);
              if (isNonTextMime) {
                binaryRejectedReason = `Konten biner/PDF (${directCtype || 'application/octet-stream'}) tidak dapat diekstrak langsung di mode Cloudflare Stateless.`;
              } else {
                const html = await directRes.text();
                if (isWorkerBinaryOrGarbledPdf(html)) {
                  binaryRejectedReason = 'Konten biner atau PDF mentah terdeteksi pada respons URL dan tidak dapat dibaca sebagai HTML.';
                } else {
                  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                  if (titleMatch) title = titleMatch[1].trim();
                  const stripped = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
                                       .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
                                       .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
                                       .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
                                       .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
                                       .replace(/<aside\b[\s\S]*?<\/aside>/gi, ' ')
                                       .replace(/<!--[\s\S]*?-->/g, ' ')
                                       .replace(/<[^>]+>/g, ' ')
                                       .replace(/&amp;/g, '&')
                                       .replace(/&lt;/g, '<')
                                       .replace(/&gt;/g, '>')
                                       .replace(/&quot;/g, '"')
                                       .replace(/&#39;/g, "'")
                                       .replace(/&#x27;/g, "'")
                                       .replace(/&nbsp;/g, ' ')
                                       .replace(/\s+/g, ' ').trim();
                  if (isWorkerBinaryOrGarbledPdf(stripped)) {
                    binaryRejectedReason = 'Hasil ekstraksi teks mengandung karakter biner/PDF rusak.';
                  } else {
                    content = stripped;
                  }
                }
              }
            }
          } catch (_) {}
        }

        if (binaryRejectedReason) {
          return new Response(JSON.stringify({
            success: false,
            error: binaryRejectedReason
          }), {
            status: 415,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const trimmedContent = (content || '').slice(0, maxChars).trim();
        if (!trimmedContent) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Gagal mengekstrak konten teks yang dapat dibaca dari URL tersebut.'
          }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        return new Response(JSON.stringify({
          success: true,
          url: cleanTarget,
          title: title || cleanTarget,
          content: trimmedContent,
          charCount: trimmedContent.length
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'Gagal mengekstrak web: ' + e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Long-Term Memory Save Endpoint (Cloudflare Worker Stateless Handler)
    if ((url.pathname === '/api/memory/save' || url.pathname === '/api/tools/memory/save') && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        const content = String(body.content || body.value || body.text || body.fact || body.note || body.catatan || body.info || body.data || body.isi || body.konten || '').trim();
        let topic = String(body.topic || body.key || body.title || body.subject || body.kategori || body.topik || '').trim();
        if (!content) {
          return new Response(JSON.stringify({ error: 'Parameter content (atau teks fakta) diperlukan.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }
        if (!topic) {
          topic = content.split(/\s+/).slice(0, 4).join('_').replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase() || 'catatan';
        }
        return new Response(JSON.stringify({
          success: false,
          persisted: false,
          error: '[Cloudflare Stateless] Penyimpanan memori SQLite jangka panjang hanya aktif saat terhubung ke backend Node lokal (server.js). Gunakan memori browser.',
          topic,
          engine: 'cloudflare-stateless'
        }), {
          status: 501,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Gagal memproses memori: ' + e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Long-Term Memory Search Endpoint (Cloudflare Worker Stateless Handler)
    if ((url.pathname === '/api/memory/search' || url.pathname === '/api/tools/memory/search') && (request.method === 'GET' || request.method === 'POST')) {
      try {
        let query = url.searchParams.get('q') || url.searchParams.get('query') || url.searchParams.get('cari') || url.searchParams.get('kata_kunci') || url.searchParams.get('topik') || '';
        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          query = body.query || body.cari || body.kata_kunci || body.keyword || body.topik || body.topic || body.q || query;
        }
        return new Response(JSON.stringify({
          success: true,
          count: 0,
          results: [],
          text: `[Cloudflare Stateless] Memori jangka panjang SQLite FTS5 berjalan di backend lokal (node server.js). Gunakan browser storage untuk sesi ini.`,
          engine: 'cloudflare-stateless'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Gagal mencari memori: ' + e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Python Code Subprocess Sandbox Execution Endpoint (Cloudflare Worker Handler)
    if ((url.pathname === '/api/execute-code' || url.pathname === '/api/tools/execute-code') && request.method === 'POST') {
      return new Response(JSON.stringify({
        success: false,
        output: 'Error eksekusi: Lingkungan Cloudflare Pages / Worker adalah serverless sandbox tanpa interpreter Python. Jalankan server lokal ZOZ Router (node server.js) untuk mengeksekusi kode Python.',
        executionTimeMs: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
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

    // Stateless Chat History Search Route for Cloudflare Gateway
    if ((url.pathname === '/api/tools/search-chat-history' || url.pathname === '/api/tools/chat-history-search') && (request.method === 'GET' || request.method === 'POST')) {
      let q = url.searchParams.get('query') || url.searchParams.get('q') || url.searchParams.get('keyword') || '';
      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const rawQ = body && (body.query ?? body.q ?? body.keyword ?? body.topik ?? body.topic ?? body.cari);
        if (typeof rawQ === 'string') q = rawQ;
      }
      return new Response(JSON.stringify({
        success: true,
        stateless: true,
        tool: 'search_chat_history',
        mode: 'recent',
        query: String(q || ''),
        totalScanned: 0,
        totalMatched: 0,
        count: 0,
        sessions: [],
        formattedContext: '[HASIL PENCARIAN RIWAYAT OBROLAN ZOZ ROUTER — CLOUD EDGE]\nMode gateway stateless: riwayat obrolan dicari langsung dari penyimpanan lokal peramban.'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Real-Time Weather & Reverse Geocode Grounding (Cloudflare Edge, Zero-API-Key)
    if ((url.pathname === '/api/tools/weather' || url.pathname === '/api/tools/weather/geocode' || url.pathname === '/api/tools/geocode') && (request.method === 'GET' || request.method === 'POST')) {
      const jsonEdgeResp = (payload, status = 200) => new Response(JSON.stringify(payload), {
        status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        }
      });
      try {
        let body = {};
        if (request.method === 'POST') {
          body = await request.json().catch(() => ({}));
        }
        const isGeocodePath = url.pathname === '/api/tools/weather/geocode' || url.pathname === '/api/tools/geocode';
        const action = String(body.action ?? url.searchParams.get('action') ?? (isGeocodePath ? 'reverse_geocode' : 'forecast')).toLowerCase();
        const rawLat = body.lat ?? body.latitude ?? url.searchParams.get('lat') ?? url.searchParams.get('latitude');
        const rawLon = body.lon ?? body.lng ?? body.longitude ?? url.searchParams.get('lon') ?? url.searchParams.get('lng') ?? url.searchParams.get('longitude');
        const rawCity = String(body.city ?? body.location ?? body.kota ?? body.q ?? url.searchParams.get('city') ?? url.searchParams.get('location') ?? url.searchParams.get('q') ?? '').trim();

        const round4 = (n) => Math.round(Number(n) * 10000) / 10000;
        let lat = rawLat !== undefined && rawLat !== null && rawLat !== '' ? Number(rawLat) : NaN;
        let lon = rawLon !== undefined && rawLon !== null && rawLon !== '' ? Number(rawLon) : NaN;
        let matchedLoc = null;

        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          if (!rawCity) {
            return jsonEdgeResp({ success: false, error: 'Koordinat atau nama kota yang valid diperlukan.' }, 400);
          }
          for (const lang of ['id', 'en']) {
            const gRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(rawCity)}&count=3&language=${lang}&format=json`, {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(6000)
            }).catch(() => null);
            if (gRes && gRes.ok) {
              const gJson = await gRes.json().catch(() => null);
              if (gJson && Array.isArray(gJson.results) && gJson.results.length > 0) {
                const hit = gJson.results[0];
                lat = round4(hit.latitude);
                lon = round4(hit.longitude);
                matchedLoc = {
                  city: hit.name || rawCity,
                  sublocality: hit.admin2 || '',
                  region: hit.admin1 || '',
                  country: hit.country || '',
                  timezone: hit.timezone || 'auto',
                  displayName: [hit.name, hit.admin1, hit.country].filter(Boolean).join(', '),
                  source: 'open-meteo-geocoding'
                };
                break;
              }
            }
          }
          if (!matchedLoc) {
            const nomSearch = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(rawCity)}&limit=3&accept-language=id&addressdetails=1`, {
              headers: { 'Accept': 'application/json', 'User-Agent': 'ZozRouter-WeatherTool/1.0 (+https://zozdocs.com)' },
              signal: AbortSignal.timeout(6000)
            }).catch(() => null);
            if (nomSearch && nomSearch.ok) {
              const nArr = await nomSearch.json().catch(() => null);
              if (Array.isArray(nArr) && nArr.length > 0) {
                const hit = nArr[0];
                const addr = hit.address || {};
                const cityLabel = addr.city || addr.town || addr.municipality || addr.county || hit.name || rawCity;
                const regionLabel = addr.state || addr.province || '';
                const countryLabel = addr.country || '';
                lat = round4(hit.lat);
                lon = round4(hit.lon);
                matchedLoc = {
                  city: cityLabel,
                  sublocality: addr.suburb || addr.village || '',
                  region: regionLabel,
                  country: countryLabel,
                  timezone: 'auto',
                  displayName: [cityLabel, regionLabel, countryLabel].filter(Boolean).join(', ') || hit.display_name || rawCity,
                  source: 'nominatim-search'
                };
              }
            }
          }
          if (!matchedLoc) {
            return jsonEdgeResp({ success: false, error: `Lokasi "${rawCity}" tidak ditemukan.` }, 400);
          }
        }

        const safeLat = round4(lat);
        const safeLon = round4(lon);

        const resolveEdgeWmo = (code, isDay = true) => {
          const c = Number.isFinite(Number(code)) ? Number(code) : 0;
          const d = Boolean(isDay);
          if (c === 0) return d ? { condition: 'Cerah', iconKey: 'sunny', visualTheme: 'sunny', advice: 'Cuaca cerah, tetap gunakan tabir surya jika beraktivitas di luar ruangan.' } : { condition: 'Cerah Berbintang', iconKey: 'clear-night', visualTheme: 'night', advice: 'Langit malam cerah dan nyaman untuk aktivitas luar ruangan.' };
          if (c === 1) return d ? { condition: 'Umumnya Cerah', iconKey: 'partly-cloudy', visualTheme: 'sunny', advice: 'Cuaca cenderung cerah berawan dan bersahabat.' } : { condition: 'Cerah Berawan', iconKey: 'partly-cloudy-night', visualTheme: 'night', advice: 'Langit malam sebagian cerah dengan sedikit awan.' };
          if (c === 2) return d ? { condition: 'Cerah Berawan', iconKey: 'partly-cloudy', visualTheme: 'partly_cloudy', advice: 'Suhu terasa nyaman dengan tutupan awan parsial.' } : { condition: 'Berawan Sebagian', iconKey: 'partly-cloudy-night', visualTheme: 'night', advice: 'Malam berawan ringan.' };
          if (c === 3) return { condition: 'Mendung / Berawan', iconKey: 'cloudy', visualTheme: 'cloudy', advice: 'Langit tertutup awan tebal, pantau potensi gerimis jika hendak bepergian.' };
          if (c === 45 || c === 48) return { condition: 'Berkabut', iconKey: 'fog', visualTheme: 'fog', advice: 'Jarak pandang berkurang karena kabut, berhati-hati saat berkendara.' };
          if ([51, 53, 55, 56, 57].includes(c)) return { condition: 'Gerimis', iconKey: 'drizzle', visualTheme: 'rain', advice: 'Sediakan payung atau jas hujan ringan sebelum keluar ruangan.' };
          if ([61, 80].includes(c)) return { condition: 'Hujan Ringan', iconKey: 'rain-light', visualTheme: 'rain', advice: 'Jangan lupa bawa payung atau jas hujan jika berencana keluar ruangan.' };
          if ([63, 81].includes(c)) return { condition: 'Hujan Sedang', iconKey: 'rain', visualTheme: 'rain', advice: 'Hujan cukup merata; gunakan payung atau kendaraan tertutup.' };
          if ([65, 66, 67, 82].includes(c)) return { condition: 'Hujan Lebat', iconKey: 'rain-heavy', visualTheme: 'rain', advice: 'Curah hujan tinggi; utamakan keamanan perjalanan.' };
          if ([71, 73, 75, 77, 85, 86].includes(c)) return { condition: 'Salju / Hujan Es', iconKey: 'snow', visualTheme: 'snow', advice: 'Kenakan pakaian hangat tahan air dan waspadai permukaan licin.' };
          if ([95, 96, 99].includes(c)) return { condition: 'Hujan Petir', iconKey: 'storm', visualTheme: 'storm', advice: 'Hindari area terbuka dan pohon tinggi saat badai petir berlangsung.' };
          return { condition: 'Berawan', iconKey: 'cloudy', visualTheme: 'cloudy', advice: 'Pantau perubahan cuaca lokal sebelum bepergian.' };
        };

        const resolveReverseLoc = async () => {
          if (matchedLoc) return matchedLoc;
          const [bdcRes, nomRes] = await Promise.allSettled([
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(safeLat)}&longitude=${encodeURIComponent(safeLon)}&localityLanguage=id`, { signal: AbortSignal.timeout(4500) }).then(r => r.ok ? r.json() : null),
            fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(safeLat)}&lon=${encodeURIComponent(safeLon)}&accept-language=id&zoom=14`, {
              headers: { 'User-Agent': 'ZozRouter-WeatherTool/1.0 (+https://zozdocs.com)' },
              signal: AbortSignal.timeout(4500)
            }).then(r => r.ok ? r.json() : null)
          ]);
          const bdc = bdcRes.status === 'fulfilled' ? bdcRes.value : null;
          const nom = nomRes.status === 'fulfilled' ? nomRes.value : null;
          const addr = (nom && nom.address) ? nom.address : {};
          const sublocality = String(addr.suburb || addr.city_district || addr.neighbourhood || addr.village || (bdc && bdc.locality) || '').trim();
          let city = String(addr.city || addr.town || addr.municipality || addr.county || (bdc && (bdc.city || bdc.locality)) || '').trim();
          if (addr.city_district && /jakarta\s+(?:selatan|pusat|barat|timur|utara)/i.test(String(addr.city_district))) {
            city = String(addr.city_district).trim();
          } else if (!city && sublocality) {
            city = sublocality;
          }
          const region = String(addr.state || addr.province || (bdc && bdc.principalSubdivision) || '').trim();
          const country = String(addr.country || (bdc && bdc.countryName) || '').trim();
          const parts = [];
          if (city) parts.push(city);
          if (region && !parts.some(p => p.toLowerCase() === region.toLowerCase())) parts.push(region);
          if (country && !parts.some(p => p.toLowerCase() === country.toLowerCase())) parts.push(country);
          return {
            city: city || `${safeLat}, ${safeLon}`,
            sublocality,
            region,
            country,
            displayName: parts.join(', ') || `Koordinat ${safeLat}, ${safeLon}`,
            source: nom ? 'nominatim' : 'bigdatacloud'
          };
        };

        if (action === 'reverse_geocode' || action === 'geocode') {
          const loc = await resolveReverseLoc();
          return jsonEdgeResp({
            success: true,
            tool: 'get_current_coordinates',
            coordinates: { lat: safeLat, lon: safeLon },
            location: loc
          });
        }

        const fUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(safeLat)}&longitude=${encodeURIComponent(safeLon)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max&forecast_days=3&timezone=auto`;
        const [locResolved, fRes] = await Promise.allSettled([
          resolveReverseLoc(),
          fetch(fUrl, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(9000) })
        ]);
        const locInfo = locResolved.status === 'fulfilled' ? locResolved.value : { city: `${safeLat}, ${safeLon}`, displayName: `${safeLat}, ${safeLon}` };
        const resp = fRes.status === 'fulfilled' ? fRes.value : null;
        if (!resp || !resp.ok) {
          // Edge fallback provider: wttr.in JSON
          const wtRes = await fetch(`https://wttr.in/${encodeURIComponent(rawCity || `${safeLat},${safeLon}`)}?format=j1`, {
            headers: { 'Accept': 'application/json', 'Accept-Language': 'id,en;q=0.8' },
            signal: AbortSignal.timeout(8000)
          }).catch(() => null);
          const wtJson = (wtRes && wtRes.ok) ? await wtRes.json().catch(() => null) : null;
          const cc = Array.isArray(wtJson?.current_condition) ? wtJson.current_condition[0] : null;
          if (!cc) {
            return jsonEdgeResp({ success: false, error: 'Gagal menghubungi API Open-Meteo maupun wttr.in dari Cloud Edge.' }, 502);
          }
          const todayW = Array.isArray(wtJson?.weather) ? wtJson.weather[0] : {};
          const desc = String(cc.weatherDesc?.[0]?.value || '').toLowerCase();
          const wCodeNum = Number(cc.weatherCode || 0);
          const mapWttrWmo = (d, c) => (/thunder|storm|petir/.test(d) || [200, 386, 389, 392, 395].includes(c)) ? 95
            : (/heavy rain|lebat/.test(d) || [308, 305, 356, 359].includes(c)) ? 65
            : (/moderate rain|hujan sedang/.test(d) || [302, 299].includes(c)) ? 63
            : (/rain|shower/.test(d) || [293, 296, 353, 176, 266, 263].includes(c)) ? 61
            : (/drizzle/.test(d) || [281, 284].includes(c)) ? 51
            : (/fog|mist/.test(d) || [143, 248, 260].includes(c)) ? 45
            : (/overcast/.test(d) || c === 122) ? 3
            : (/cloudy/.test(d) || c === 119 || c === 116) ? 2
            : (/sunny|clear/.test(d) || c === 113) ? 0 : 2;
          const hrNow = new Date().getHours();
          const wtDay = hrNow >= 6 && hrNow < 18;
          const wtWmo = mapWttrWmo(desc, wCodeNum);
          const wtMeta = resolveEdgeWmo(wtWmo, wtDay);
          const buildWttrEdgeHours = (wd, dIdx) => {
            const dHoursAll = Array.isArray(wd?.hourly) ? wd.hourly : [];
            const pickIdx = [2, 3, 4, 5, 6, 7].filter(ix => ix < dHoursAll.length);
            const indices = dIdx === 0
              ? dHoursAll.map((_, ix) => ix).slice(0, 6)
              : (pickIdx.length >= 4 ? pickIdx : dHoursAll.map((_, ix) => ix).slice(0, 6));
            return indices.map((ix, i) => {
              const h = dHoursAll[ix] || {};
              const hNum = parseInt(String(h.time || i * 300), 10);
              const hh = String(Math.floor((Number.isFinite(hNum) ? hNum : i * 300) / 100)).padStart(2, '0');
              const hW = mapWttrWmo(String(h.weatherDesc?.[0]?.value || desc).toLowerCase(), Number(h.weatherCode || wCodeNum));
              const hIsDay = Number(hh) >= 6 && Number(hh) < 18;
              const hM = resolveEdgeWmo(hW, hIsDay);
              return {
                time: `${wd?.date || ''}T${hh}:00`,
                hourLabel: dIdx === 0 && i === 0 ? 'Sekarang' : `${hh}:00`,
                tempC: Math.round(Number(h.tempC ?? cc.temp_C ?? 0)),
                feelsLikeC: Number.isFinite(Number(h.FeelsLikeC)) ? Math.round(Number(h.FeelsLikeC)) : null,
                precipProb: Math.round(Number(h.chanceofrain ?? 0)),
                humidity: h.humidity !== undefined ? Math.round(Number(h.humidity)) : null,
                windKmh: h.windspeedKmph !== undefined ? Math.round(Number(h.windspeedKmph)) : null,
                weatherCode: hW,
                condition: hM.condition,
                iconKey: hM.iconKey,
                isDay: hIsDay
              };
            });
          };
          const wtHours = buildWttrEdgeHours(todayW, 0);
          const curW = {
            tempC: Math.round(Number(cc.temp_C ?? 0)),
            tempExactC: Number(cc.temp_C ?? 0),
            feelsLikeC: Math.round(Number(cc.FeelsLikeC ?? cc.temp_C ?? 0)),
            humidity: Math.round(Number(cc.humidity ?? 0)),
            windKmh: Math.round(Number(cc.windspeedKmph ?? 0)),
            windDirection: String(cc.winddir16Point || '-'),
            precipitationMm: Number(cc.precipMM ?? 0),
            cloudCover: Math.round(Number(cc.cloudcover ?? 0)),
            pressureHpa: cc.pressure !== undefined ? Math.round(Number(cc.pressure)) : null,
            rainProbNow: wtHours[0] ? wtHours[0].precipProb : 0,
            weatherCode: wtWmo,
            condition: wtMeta.condition,
            iconKey: wtMeta.iconKey,
            visualTheme: wtMeta.visualTheme,
            advice: wtMeta.advice,
            isDay: wtDay,
            observedAt: cc.localObsDateTime || new Date().toISOString(),
            timezone: 'auto',
            timezoneAbbr: ''
          };
          const dW = {
            tempMaxC: todayW?.maxtempC !== undefined ? Math.round(Number(todayW.maxtempC)) : null,
            tempMinC: todayW?.mintempC !== undefined ? Math.round(Number(todayW.mintempC)) : null,
            precipProbMax: wtHours.reduce((m, x) => Math.max(m, x.precipProb || 0), 0),
            uvIndexMax: cc.uvIndex !== undefined ? Number(cc.uvIndex) : null,
            sunrise: todayW?.astronomy?.[0]?.sunrise || null,
            sunset: todayW?.astronomy?.[0]?.sunset || null
          };
          const wtDailyForecast = (Array.isArray(wtJson?.weather) ? wtJson.weather : []).slice(0, 3).map((wd, dIdx) => {
            const dayLabels = ['Hari Ini', 'Besok', 'Lusa'];
            const dSlice = buildWttrEdgeHours(wd, dIdx);
            const midday = dSlice.find(h => h.hourLabel.startsWith('12') || h.hourLabel.startsWith('15')) || dSlice[0] || {};
            const repWmo = midday.weatherCode ?? wtWmo;
            const repMeta = resolveEdgeWmo(repWmo, true);
            return {
              date: String(wd?.date || ''),
              dayLabel: dayLabels[dIdx] || `Hari +${dIdx}`,
              dayOffset: dIdx,
              weatherCode: repWmo,
              condition: repMeta.condition,
              iconKey: repMeta.iconKey,
              visualTheme: repMeta.visualTheme,
              advice: repMeta.advice,
              isDay: true,
              tempC: dIdx === 0 ? curW.tempC : (Number.isFinite(midday.tempC) ? midday.tempC : Math.round(Number(wd?.maxtempC ?? curW.tempC))),
              feelsLikeC: dIdx === 0 ? curW.feelsLikeC : (midday.feelsLikeC ?? midday.tempC ?? curW.feelsLikeC),
              tempMaxC: wd?.maxtempC !== undefined ? Math.round(Number(wd.maxtempC)) : null,
              tempMinC: wd?.mintempC !== undefined ? Math.round(Number(wd.mintempC)) : null,
              humidity: dIdx === 0 ? curW.humidity : (midday.humidity ?? curW.humidity),
              windKmh: dIdx === 0 ? curW.windKmh : (midday.windKmh ?? curW.windKmh),
              precipProbMax: dSlice.reduce((m, x) => Math.max(m, x.precipProb || 0), 0),
              uvIndexMax: wd?.uvIndex !== undefined ? Number(wd.uvIndex) : (cc.uvIndex !== undefined ? Number(cc.uvIndex) : null),
              sunrise: wd?.astronomy?.[0]?.sunrise || null,
              sunset: wd?.astronomy?.[0]?.sunset || null,
              hourly: dSlice
            };
          });
          const hLines = wtHours.map(h => `  • ${h.hourLabel}: ${h.tempC}°C (${h.condition}, peluang hujan ${h.precipProb}%)`).join('\n');
          const dLines = wtDailyForecast.map(d => `  • ${d.dayLabel} (${d.date}): ${d.condition}, ${d.tempMinC ?? '-'}°C..${d.tempMaxC ?? '-'}°C (peluang hujan ${d.precipProbMax}%)`).join('\n');
          return jsonEdgeResp({
            success: true,
            tool: 'fetch_weather_data',
            provider: 'wttr.in-edge',
            coordinates: { lat: safeLat, lon: safeLon },
            location: locInfo,
            current: curW,
            daily: dW,
            dailyForecast: wtDailyForecast,
            hourly: wtHours,
            formattedContext: `[HASIL DATA CUACA REAL-TIME — WTTR.IN]\n- Lokasi Cocok: ${locInfo.displayName || locInfo.city}\n- Kondisi Saat Ini: ${curW.condition} | Suhu: ${curW.tempC}°C (Terasa ${curW.feelsLikeC}°C)\n- Kelembapan: ${curW.humidity}% | Angin: ${curW.windKmh} km/j\n- Prakiraan 5 Jam Ke Depan:\n${hLines}${dLines ? `\n- Prakiraan Harian (Hari Ini, Besok & Lusa):\n${dLines}` : ''}\n- Saran: ${curW.advice}`
          });
        }
        const raw = await resp.json();
        const cur = raw.current || {};
        const isDay = cur.is_day === undefined ? true : Boolean(Number(cur.is_day));
        const wmoCode = Number.isFinite(Number(cur.weather_code)) ? Number(cur.weather_code) : 0;
        const wmoMeta = resolveEdgeWmo(wmoCode, isDay);
        const curTimeStr = String(cur.time || '');
        const curPrefix = curTimeStr.slice(0, 13);
        const hObj = raw.hourly || {};
        const hTimes = Array.isArray(hObj.time) ? hObj.time : [];
        let startIdx = curPrefix ? hTimes.findIndex(t => String(t || '').startsWith(curPrefix)) : 0;
        if (startIdx < 0) startIdx = 0;
        const hourlyForecast = [];
        for (let i = startIdx; i < Math.min(hTimes.length, startIdx + 6); i++) {
          const tStr = String(hTimes[i] || '');
          const hIsDay = Array.isArray(hObj.is_day) && hObj.is_day[i] !== undefined ? Boolean(Number(hObj.is_day[i])) : isDay;
          const hCode = Array.isArray(hObj.weather_code) ? Number(hObj.weather_code[i] ?? wmoCode) : wmoCode;
          const hMeta = resolveEdgeWmo(hCode, hIsDay);
          hourlyForecast.push({
            time: tStr,
            hourLabel: i === startIdx ? 'Sekarang' : (tStr.length >= 16 ? tStr.slice(11, 16) : tStr),
            tempC: Math.round(Number(hObj.temperature_2m?.[i] ?? cur.temperature_2m ?? 0)),
            feelsLikeC: hObj.apparent_temperature?.[i] !== undefined ? Math.round(Number(hObj.apparent_temperature[i])) : null,
            precipProb: Math.round(Number(hObj.precipitation_probability?.[i] ?? 0)),
            weatherCode: hCode,
            condition: hMeta.condition,
            iconKey: hMeta.iconKey,
            isDay: hIsDay
          });
        }
        const dObj = raw.daily || {};
        const dailySummary = {
          tempMaxC: Array.isArray(dObj.temperature_2m_max) && dObj.temperature_2m_max[0] !== undefined ? Math.round(Number(dObj.temperature_2m_max[0])) : null,
          tempMinC: Array.isArray(dObj.temperature_2m_min) && dObj.temperature_2m_min[0] !== undefined ? Math.round(Number(dObj.temperature_2m_min[0])) : null,
          precipProbMax: Array.isArray(dObj.precipitation_probability_max) && dObj.precipitation_probability_max[0] !== undefined ? Math.round(Number(dObj.precipitation_probability_max[0])) : null,
          uvIndexMax: Array.isArray(dObj.uv_index_max) && dObj.uv_index_max[0] !== undefined ? Number(Number(dObj.uv_index_max[0]).toFixed(1)) : null,
          sunrise: Array.isArray(dObj.sunrise) && dObj.sunrise[0] ? String(dObj.sunrise[0]).slice(11, 16) : null,
          sunset: Array.isArray(dObj.sunset) && dObj.sunset[0] ? String(dObj.sunset[0]).slice(11, 16) : null
        };
        const dTimes = Array.isArray(dObj.time) ? dObj.time : [];
        const dayNames = ['Hari Ini', 'Besok', 'Lusa'];
        const dailyForecast = [];
        for (let dIdx = 0; dIdx < Math.min(dTimes.length, 3); dIdx++) {
          const dateStr = String(dTimes[dIdx] || '');
          const dCode = Array.isArray(dObj.weather_code) ? Number(dObj.weather_code[dIdx] ?? wmoCode) : wmoCode;
          const dMeta = resolveEdgeWmo(dCode, true);
          const dayHourIndices = [];
          for (let hIdx = 0; hIdx < hTimes.length; hIdx++) {
            if (String(hTimes[hIdx] || '').startsWith(dateStr)) dayHourIndices.push(hIdx);
          }
          const targetHoursSet = new Set(['06', '09', '12', '15', '18', '21']);
          let chosenIdx = dayHourIndices.filter(hi => targetHoursSet.has(String(hTimes[hi] || '').slice(11, 13)));
          if (chosenIdx.length < 4) chosenIdx = dayHourIndices.filter((_, p) => p % 4 === 0).slice(0, 6);
          const dayHourly = dIdx === 0
            ? hourlyForecast
            : chosenIdx.slice(0, 6).map(hi => {
                const tStr = String(hTimes[hi] || '');
                const hhMm = tStr.length >= 16 ? tStr.slice(11, 16) : tStr;
                const hIsDay = Array.isArray(hObj.is_day) && hObj.is_day[hi] !== undefined ? Boolean(Number(hObj.is_day[hi])) : true;
                const hCode = Array.isArray(hObj.weather_code) ? Number(hObj.weather_code[hi] ?? dCode) : dCode;
                const hMeta = resolveEdgeWmo(hCode, hIsDay);
                return {
                  time: tStr,
                  hourLabel: hhMm,
                  tempC: Math.round(Number(hObj.temperature_2m?.[hi] ?? cur.temperature_2m ?? 0)),
                  feelsLikeC: hObj.apparent_temperature?.[hi] !== undefined ? Math.round(Number(hObj.apparent_temperature[hi])) : null,
                  precipProb: Math.round(Number(hObj.precipitation_probability?.[hi] ?? 0)),
                  humidity: hObj.relative_humidity_2m?.[hi] !== undefined ? Math.round(Number(hObj.relative_humidity_2m[hi])) : null,
                  windKmh: hObj.wind_speed_10m?.[hi] !== undefined ? Math.round(Number(hObj.wind_speed_10m[hi])) : null,
                  weatherCode: hCode,
                  condition: hMeta.condition,
                  iconKey: hMeta.iconKey,
                  isDay: hIsDay
                };
              });
          const middaySlot = dayHourly.find(h => h.hourLabel.startsWith('12') || h.hourLabel.startsWith('15')) || dayHourly[Math.floor(dayHourly.length / 2)] || {};
          const dMin = Array.isArray(dObj.temperature_2m_min) && dObj.temperature_2m_min[dIdx] !== undefined ? Math.round(Number(dObj.temperature_2m_min[dIdx])) : null;
          const dMax = Array.isArray(dObj.temperature_2m_max) && dObj.temperature_2m_max[dIdx] !== undefined ? Math.round(Number(dObj.temperature_2m_max[dIdx])) : null;
          const dHumVals = chosenIdx.map(hi => Number(hObj.relative_humidity_2m?.[hi])).filter(Number.isFinite);
          const dWindVals = chosenIdx.map(hi => Number(hObj.wind_speed_10m?.[hi])).filter(Number.isFinite);
          dailyForecast.push({
            date: dateStr,
            dayLabel: dayNames[dIdx] || `Hari +${dIdx}`,
            dayOffset: dIdx,
            weatherCode: dCode,
            condition: dMeta.condition,
            iconKey: dMeta.iconKey,
            visualTheme: dMeta.visualTheme,
            advice: dMeta.advice,
            isDay: dIdx === 0 ? isDay : true,
            tempC: dIdx === 0 ? Math.round(Number(cur.temperature_2m ?? 0)) : (Number.isFinite(middaySlot.tempC) ? middaySlot.tempC : (dMax ?? dMin ?? Math.round(Number(cur.temperature_2m ?? 0)))),
            feelsLikeC: dIdx === 0 ? Math.round(Number(cur.apparent_temperature ?? cur.temperature_2m ?? 0)) : (middaySlot.feelsLikeC ?? middaySlot.tempC ?? dMax ?? null),
            tempMaxC: dMax,
            tempMinC: dMin,
            humidity: dIdx === 0 ? Math.round(Number(cur.relative_humidity_2m ?? 0)) : (dHumVals.length ? Math.round(dHumVals.reduce((a, b) => a + b, 0) / dHumVals.length) : Math.round(Number(cur.relative_humidity_2m ?? 0))),
            windKmh: dIdx === 0 ? Math.round(Number(cur.wind_speed_10m ?? 0)) : (dWindVals.length ? Math.round(dWindVals.reduce((a, b) => a + b, 0) / dWindVals.length) : Math.round(Number(cur.wind_speed_10m ?? 0))),
            precipProbMax: Array.isArray(dObj.precipitation_probability_max) && dObj.precipitation_probability_max[dIdx] !== undefined ? Math.round(Number(dObj.precipitation_probability_max[dIdx])) : null,
            uvIndexMax: Array.isArray(dObj.uv_index_max) && dObj.uv_index_max[dIdx] !== undefined ? Number(Number(dObj.uv_index_max[dIdx]).toFixed(1)) : null,
            sunrise: Array.isArray(dObj.sunrise) && dObj.sunrise[dIdx] ? String(dObj.sunrise[dIdx]).slice(11, 16) : null,
            sunset: Array.isArray(dObj.sunset) && dObj.sunset[dIdx] ? String(dObj.sunset[dIdx]).slice(11, 16) : null,
            hourly: dayHourly
          });
        }
        const dirs = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
        const windDirLabel = Number.isFinite(Number(cur.wind_direction_10m)) ? dirs[Math.round(((Number(cur.wind_direction_10m) % 360) + 360) % 360 / 45) % 8] : '-';
        const currentData = {
          tempC: Math.round(Number(cur.temperature_2m ?? 0)),
          tempExactC: Number(cur.temperature_2m ?? 0),
          feelsLikeC: Math.round(Number(cur.apparent_temperature ?? cur.temperature_2m ?? 0)),
          humidity: Math.round(Number(cur.relative_humidity_2m ?? 0)),
          windKmh: Math.round(Number(cur.wind_speed_10m ?? 0)),
          windDirection: windDirLabel,
          precipitationMm: Number(cur.precipitation ?? 0),
          cloudCover: Math.round(Number(cur.cloud_cover ?? 0)),
          pressureHpa: cur.surface_pressure !== undefined ? Math.round(Number(cur.surface_pressure)) : null,
          rainProbNow: hourlyForecast[0] ? hourlyForecast[0].precipProb : (dailySummary.precipProbMax ?? 0),
          weatherCode: wmoCode,
          condition: wmoMeta.condition,
          iconKey: wmoMeta.iconKey,
          visualTheme: wmoMeta.visualTheme,
          advice: wmoMeta.advice,
          isDay,
          observedAt: curTimeStr,
          timezone: raw.timezone || 'auto',
          timezoneAbbr: raw.timezone_abbreviation || ''
        };
        const hourlyLines = hourlyForecast.map(h => `  • ${h.hourLabel}: ${h.tempC}°C (${h.condition}, peluang hujan ${h.precipProb}%)`).join('\n');
        const dailyLines = dailyForecast.map(d => `  • ${d.dayLabel} (${d.date}): ${d.condition}, suhu ${d.tempMinC ?? '-'}°C–${d.tempMaxC ?? '-'}°C, peluang hujan maks ${d.precipProbMax ?? 0}%`).join('\n');
        return jsonEdgeResp({
          success: true,
          tool: 'fetch_weather_data',
          provider: 'open-meteo-edge',
          coordinates: { lat: safeLat, lon: safeLon },
          location: locInfo,
          current: currentData,
          daily: dailySummary,
          dailyForecast,
          hourly: hourlyForecast,
          formattedContext: `[HASIL DATA CUACA REAL-TIME — OPEN-METEO]\n- Lokasi Cocok: ${locInfo.displayName || locInfo.city}\n- Kondisi Saat Ini: ${currentData.condition} | Suhu: ${currentData.tempC}°C (Terasa ${currentData.feelsLikeC}°C)\n- Kelembapan: ${currentData.humidity}% | Angin: ${currentData.windKmh} km/j (${currentData.windDirection}) | Awan: ${currentData.cloudCover}%\n- Prakiraan 5 Jam Ke Depan:\n${hourlyLines}${dailyLines ? `\n- Prakiraan Harian (Hari Ini, Besok & Lusa):\n${dailyLines}` : ''}\n- Saran: ${currentData.advice}`
        });
      } catch (e) {
        return jsonEdgeResp({ success: false, error: 'Gagal memproses data cuaca: ' + (e?.message || e) }, 502);
      }
    }

    // ==================== IMAGE GROUNDING ENDPOINTS (CLOUDFLARE EDGE) ====================
    const edgeCandidateCache = globalThis.__ZOZ_EDGE_CANDIDATES__ || (globalThis.__ZOZ_EDGE_CANDIDATES__ = new Map());
    const EDGE_SPOOF_REGEX = /\b(impersonators?|look-?alikes?|parod(?:y|ies)|caricatures?|wax(?:work|\s+figures?)?|madame\s+tussauds|cosplay(?:ers?)?|memes?|cartoons?|satires?|puppets?|effig(?:y|ies))\b/i;

    const putEdgeCandidate = (id, cand) => {
      if (!id || !cand) return;
      if (edgeCandidateCache.has(id)) edgeCandidateCache.delete(id);
      while (edgeCandidateCache.size >= 300) {
        const oldestKey = edgeCandidateCache.keys().next().value;
        if (oldestKey === undefined) break;
        edgeCandidateCache.delete(oldestKey);
      }
      edgeCandidateCache.set(id, cand);
    };

    const evaluateEdgeLicenseStatus = (licenseName) => {
      if (!licenseName || typeof licenseName !== 'string' || !licenseName.trim()) {
        return { usage_status: 'unknown', warning: 'license_unknown: Metadata lisensi sumber bernilai null/tidak diketahui.' };
      }
      const licLower = licenseName.toLowerCase();
      if (/\b(all rights reserved|copyrighted|fair use|non-?commercial|by-nc|cc-by-nc|no derivatives|by-nd|cc-by-nd)\b/i.test(licLower)) {
        return { usage_status: 'restricted', warning: `access_denied: Lisensi "${licenseName}" membatasi penayangan ulang.` };
      }
      if (
        licLower.includes('public domain') ||
        /\bpd(?:-[a-z0-9-]+|\b)/i.test(licLower) ||
        licLower.includes('cc0') ||
        licLower.includes('cc-zero') ||
        licLower.includes('no restrictions') ||
        licLower.includes('cc by') ||
        licLower.includes('cc-by') ||
        licLower.includes('attribution') ||
        licLower.includes('unsplash license') ||
        licLower.includes('free art license') ||
        licLower.includes('gfdl')
      ) {
        return { usage_status: 'allowed', warning: null };
      }
      return { usage_status: 'unknown', warning: `license_unknown: Ketentuan lisensi "${licenseName}" memerlukan verifikasi manual.` };
    };

    const parseWikimediaPageForEdge = (page, queryStr = '') => {
      if (!page || !Array.isArray(page.imageinfo) || page.imageinfo.length === 0) return null;
      const info = page.imageinfo[0];
      const ext = info.extmetadata || {};
      const mime = String(info.mime || '').toLowerCase();
      if (!mime.startsWith('image/') || mime.includes('svg')) return null;

      const rawTitle = String(page.title || '').replace(/^File:/i, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ').trim();
      const pageUrl = info.descriptionurl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(String(page.title || '').replace(/^File:/i, '').replace(/\s+/g, '_'))}`;
      const creator = (ext.Artist && typeof ext.Artist.value === 'string')
        ? (ext.Artist.value.replace(/<[^>]+>/g, '').trim() || null)
        : null;
      const rawLicShort = (ext.LicenseShortName && typeof ext.LicenseShortName.value === 'string')
        ? ext.LicenseShortName.value.replace(/<[^>]+>/g, '').trim()
        : '';
      const rawUsageTerms = (ext.UsageTerms && typeof ext.UsageTerms.value === 'string')
        ? ext.UsageTerms.value.replace(/<[^>]+>/g, '').trim()
        : '';
      const rawLicCode = (ext.License && typeof ext.License.value === 'string')
        ? ext.License.value.replace(/<[^>]+>/g, '').trim()
        : '';
      const license = rawLicShort || rawUsageTerms || rawLicCode || null;
      const licenseUrl = (ext.LicenseUrl && typeof ext.LicenseUrl.value === 'string')
        ? (ext.LicenseUrl.value.trim() || null)
        : null;
      const desc = (ext.ImageDescription && typeof ext.ImageDescription.value === 'string')
        ? (ext.ImageDescription.value.replace(/<[^>]+>/g, '').trim() || null)
        : null;
      const categories = Array.isArray(page.categories)
        ? page.categories.map((c) => String(c.title || '').replace(/^Category:/i, ''))
        : [];

      const creditParts = [];
      if (creator) creditParts.push(`Foto/Karya: ${creator}`);
      creditParts.push('Wikimedia Commons');
      if (license) creditParts.push(`(${license})`);

      const image_id = page.pageid ? `img_wmc_${page.pageid}` : `img_wmc_${Math.random().toString(36).slice(2, 10)}`;
      return {
        image_id,
        title: rawTitle || null,
        description: desc,
        source_name: 'wikimedia_commons',
        source_page_url: pageUrl,
        preview_url: info.thumburl || info.url || null,
        image_url: info.url || null,
        creator,
        creator_url: null,
        license_name: license,
        license_url: licenseUrl,
        attribution_text: creditParts.join(' — '),
        width: Number.isInteger(info.width) && info.width > 0 ? info.width : null,
        height: Number.isInteger(info.height) && info.height > 0 ? info.height : null,
        _mime: mime,
        _categories: categories,
        _query: queryStr || ''
      };
    };

    const resolveEdgeCandidateById = async (imageId) => {
      if (!imageId || typeof imageId !== 'string') return null;
      const cached = edgeCandidateCache.get(imageId);
      if (cached) return cached;
      const m = imageId.match(/^img_wmc_(\d+)$/);
      if (!m) return null;
      const pageId = m[1];
      const params = new URLSearchParams({
        action: 'query',
        pageids: pageId,
        prop: 'imageinfo|categories',
        cllimit: '15',
        iiprop: 'url|size|mime|mediatype|extmetadata',
        iiurlwidth: '960',
        format: 'json'
      });
      const wmcRes = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
        headers: {
          'User-Agent': 'ZozRouter/1.0 (Cloudflare Edge Visual Grounding; https://z21.zozdocs.com)',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(7000)
      }).catch(() => null);
      if (!wmcRes || !wmcRes.ok) return null;
      const data = await wmcRes.json().catch(() => null);
      const page = data?.query?.pages?.[pageId];
      const parsed = parseWikimediaPageForEdge(page, '');
      if (parsed) {
        parsed.image_id = imageId;
        putEdgeCandidate(imageId, parsed);
      }
      return parsed;
    };

    const isAllowedEdgeCdnHost = (hostname) => {
      const h = String(hostname || '').toLowerCase();
      const ALLOWED_CDN = ['upload.wikimedia.org', 'thumb.wikimedia.org', 'images.unsplash.com', 'images.pexels.com', 'cdn.pixabay.com'];
      return ALLOWED_CDN.some((d) => h === d || h.endsWith(`.${d}`));
    };

    const isSafeRasterAssetUrl = (u) => {
      if (!u || u.protocol !== 'https:' || !isAllowedEdgeCdnHost(u.hostname)) return false;
      if (/\.(?:svg|svgz|html?|xhtml|xml|js|mjs|php)(?:$|\?)/i.test(u.pathname || '')) return false;
      return true;
    };

    const buildSafeImageProxyResponse = (upRes, isHead = false) => {
      if (!upRes || !upRes.ok) return null;
      const rawCtype = String(upRes.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
      const SAFE_RASTER_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
      if (!SAFE_RASTER_MIMES.has(rawCtype)) return null;
      if (isHead) {
        try { upRes.body?.cancel(); } catch (_) {}
      }
      const headers = {
        'Content-Type': rawCtype === 'image/jpg' ? 'image/jpeg' : rawCtype,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'none'; script-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=172800',
        'Access-Control-Allow-Origin': '*'
      };
      const upstreamLen = upRes.headers.get('content-length');
      if (upstreamLen) headers['Content-Length'] = upstreamLen;
      return new Response(isHead ? null : upRes.body, {
        status: 200,
        headers
      });
    };

    const readEdgeJsonBody = async () => {
      if (reqBodyBytes && reqBodyBytes.byteLength > 0) {
        try {
          return JSON.parse(new TextDecoder().decode(reqBodyBytes));
        } catch (_) {
          return {};
        }
      }
      return await request.json().catch(() => ({}));
    };

    // 1. Search Images (Fallback Edge saat tunnel backend offline)
    if ((url.pathname === '/api/tools/search-images' || url.pathname === '/api/search-images') && (request.method === 'GET' || request.method === 'POST')) {
      try {
        let query = '';
        let per_page = undefined;
        let limit = undefined;
        let sources = undefined;
        let orientation = 'any';
        let image_type = 'photo';
        let safe_search = true;
        if (request.method === 'GET') {
          query = url.searchParams.get('query') || url.searchParams.get('q') || '';
          if (url.searchParams.get('per_page')) per_page = parseInt(url.searchParams.get('per_page'), 10);
          if (url.searchParams.get('limit')) limit = parseInt(url.searchParams.get('limit'), 10);
          if (url.searchParams.get('sources')) sources = url.searchParams.get('sources').split(',').map((s) => s.trim()).filter(Boolean);
          orientation = url.searchParams.get('orientation') || 'any';
          image_type = url.searchParams.get('image_type') || 'photo';
        } else {
          const body = await readEdgeJsonBody();
          query = body.query || body.q || '';
          if (body.per_page !== undefined) per_page = parseInt(body.per_page, 10);
          if (body.limit !== undefined) limit = parseInt(body.limit, 10);
          if (body.sources !== undefined) {
            sources = Array.isArray(body.sources) ? body.sources : String(body.sources || '').split(',').map((s) => s.trim()).filter(Boolean);
          }
          if (body.orientation) orientation = body.orientation;
          if (body.image_type) image_type = body.image_type;
          if (typeof body.safe_search === 'boolean') safe_search = body.safe_search;
        }
        const rawCount = per_page !== undefined ? per_page : (limit !== undefined ? limit : 3);
        limit = Number.isFinite(rawCount) ? Math.max(1, Math.min(20, rawCount)) : 3;

        const cleanQ = String(query || '').trim();
        if (!cleanQ) {
          return new Response(JSON.stringify({ status: 'no_results', images: [], source_errors: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const edgeUnsplashKey = String((env && env.UNSPLASH_ACCESS_KEY) || '').trim();
        const wantsOnlyWmc = Array.isArray(sources) && sources.length > 0 && !sources.some((s) => String(s).toLowerCase().includes('unsplash'));
        if (edgeUnsplashKey && !wantsOnlyWmc) {
          try {
            const unsParams = new URLSearchParams({
              query: cleanQ,
              per_page: String(Math.min(20, Math.max(1, limit))),
              content_filter: safe_search === false ? 'low' : 'high'
            });
            if (orientation === 'landscape' || orientation === 'portrait') unsParams.set('orientation', orientation);
            else if (orientation === 'square') unsParams.set('orientation', 'squarish');

            const unsRes = await fetch(`https://api.unsplash.com/search/photos?${unsParams.toString()}`, {
              headers: {
                'Authorization': `Client-ID ${edgeUnsplashKey}`,
                'Accept-Version': 'v1',
                'Accept': 'application/json'
              },
              signal: AbortSignal.timeout(8000)
            });
            if (unsRes.ok) {
              const unsData = await unsRes.json().catch(() => null);
              const unsResults = Array.isArray(unsData && unsData.results) ? unsData.results : [];
              const unsCandidates = [];
              for (const item of unsResults.slice(0, limit)) {
                const previewUrl = item?.urls?.small || null;
                const imageUrl = item?.urls?.regular || previewUrl;
                const pageUrl = item?.links?.html ? `${item.links.html}${item.links.html.includes('?') ? '&' : '?'}utm_source=zoz_router&utm_medium=referral` : 'https://unsplash.com';
                if (!imageUrl) continue;
                const creator = item?.user?.name || 'Unsplash Photographer';
                const candId = `img_uns_${String(item.id || Math.random().toString(36).slice(2, 10))}`;
                const parsed = {
                  image_id: candId,
                  title: String(item.alt_description || item.description || cleanQ).slice(0, 220),
                  description: String(item.description || item.alt_description || cleanQ).slice(0, 500),
                  source_name: 'unsplash',
                  source_page_url: pageUrl,
                  preview_url: previewUrl || imageUrl,
                  image_url: imageUrl,
                  creator,
                  creator_url: item?.user?.links?.html || null,
                  license_name: 'Unsplash License',
                  license_url: 'https://unsplash.com/license',
                  attribution_text: `Foto oleh ${creator} di Unsplash`,
                  width: Number.isInteger(item.width) ? item.width : null,
                  height: Number.isInteger(item.height) ? item.height : null,
                  _mime: 'image/jpeg',
                  _categories: [],
                  _query: cleanQ
                };
                putEdgeCandidate(candId, parsed);
                const { _mime, _categories, _query, ...pub } = parsed;
                unsCandidates.push(pub);
              }
              if (unsCandidates.length > 0) {
                return new Response(JSON.stringify({
                  status: 'success',
                  english_query: cleanQ,
                  images: unsCandidates,
                  source_errors: []
                }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
              }
            }
          } catch (_) {}
        }

        const fetchCount = Math.min(30, Math.max(10, limit * 2));
        let gsrsearch = cleanQ;
        if (image_type === 'photo') {
          gsrsearch += ' filetype:bitmap';
        } else if (image_type === 'illustration') {
          gsrsearch += ' filetype:drawing';
        }

        const params = new URLSearchParams({
          action: 'query',
          generator: 'search',
          gsrnamespace: '6',
          gsrsearch,
          gsrlimit: String(fetchCount),
          prop: 'imageinfo|categories',
          cllimit: '15',
          iiprop: 'url|size|mime|mediatype|extmetadata',
          iiurlwidth: '960',
          format: 'json'
        });

        const wmcRes = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
          headers: {
            'User-Agent': 'ZozRouter/1.0 (Cloudflare Edge Visual Grounding; https://z21.zozdocs.com)',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(8000)
        });

        const data = await wmcRes.json().catch(() => null);
        const pages = data && data.query && data.query.pages
          ? Object.values(data.query.pages).sort((a, b) => (a.index ?? 999999) - (b.index ?? 999999))
          : [];
        const qTokens = cleanQ.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
        const queryAllowsSpoof = EDGE_SPOOF_REGEX.test(cleanQ);
        const scored = [];

        for (const page of pages) {
          const parsed = parseWikimediaPageForEdge(page, cleanQ);
          if (!parsed) continue;
          const combinedMeta = `${parsed.title || ''} ${parsed.description || ''} ${(parsed._categories || []).join(' ')}`;
          if (!queryAllowsSpoof && EDGE_SPOOF_REGEX.test(combinedMeta)) continue;

          const titleLower = String(parsed.title || '').toLowerCase();
          let hitCount = 0;
          for (const qt of qTokens) {
            if (titleLower.includes(qt)) hitCount++;
          }
          const score = (qTokens.length > 0 ? (hitCount / qTokens.length) * 100 : 0) - ((page.index ?? 999) * 0.5);
          scored.push({ score, parsed });
        }

        scored.sort((a, b) => b.score - a.score);
        const candidates = scored.slice(0, limit).map(({ parsed }) => {
          putEdgeCandidate(parsed.image_id, parsed);
          const { _mime, _categories, _query, ...pub } = parsed;
          return pub;
        });

        return new Response(JSON.stringify({
          status: candidates.length > 0 ? 'success' : 'no_results',
          images: candidates,
          source_errors: []
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          status: 'error',
          images: [],
          source_errors: [{ source: 'wikimedia_commons', code: 'error', message: err.message }]
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 2. Inspect Image
    if ((url.pathname === '/api/tools/inspect-image' || url.pathname === '/api/inspect-image') && (request.method === 'GET' || request.method === 'POST')) {
      try {
        let image_id = '';
        if (request.method === 'GET') {
          image_id = url.searchParams.get('image_id') || url.searchParams.get('id') || '';
        } else {
          const body = await readEdgeJsonBody();
          image_id = body.image_id || body.id || '';
        }
        image_id = String(image_id || '').trim();
        const cand = await resolveEdgeCandidateById(image_id);
        if (!cand) {
          return new Response(JSON.stringify({
            image_id: image_id || '',
            accessible: false,
            mime_type: null,
            dimensions: null,
            subject_match: 'uncertain',
            match_basis: 'Kandidat image_id tidak ditemukan atau tidak valid; pemeriksaan visual piksel tidak dilakukan.',
            usage_status: 'unknown',
            attribution_text: null,
            warnings: ['invalid_image: image_id tidak terdaftar.']
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const licEval = evaluateEdgeLicenseStatus(cand.license_name);
        const combinedMeta = `${cand.title || ''} ${cand.description || ''} ${(cand._categories || []).join(' ')}`;
        const isSpoof = EDGE_SPOOF_REGEX.test(combinedMeta) && !EDGE_SPOOF_REGEX.test(cand._query || '');
        const qTokens = String(cand._query || '').toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
        let hitCount = 0;
        for (const qt of qTokens) {
          if (combinedMeta.toLowerCase().includes(qt)) hitCount++;
        }
        let subject_match = 'likely';
        if (isSpoof) {
          subject_match = 'mismatch';
        } else if (cand.source_name === 'unsplash') {
          subject_match = 'likely';
        } else if (qTokens.length > 0) {
          const cov = hitCount / qTokens.length;
          subject_match = cov >= 0.85 ? 'confirmed' : (cov >= 0.5 ? 'likely' : (cov > 0 ? 'uncertain' : 'mismatch'));
        }

        const warnings = [];
        if (licEval.warning) warnings.push(licEval.warning);

        return new Response(JSON.stringify({
          image_id: cand.image_id,
          accessible: Boolean(cand.preview_url || cand.image_url),
          mime_type: cand._mime || 'image/jpeg',
          dimensions: (cand.width && cand.height) ? { width: cand.width, height: cand.height } : null,
          subject_match,
          match_basis: isSpoof
            ? 'Metadata mengindikasikan peniru/parodi/karikatur, bukan subjek asli.'
            : 'Evaluasi metadata judul, deskripsi, dan kategori sumber resmi Wikimedia Commons; pemeriksaan visual piksel tidak dilakukan.',
          usage_status: (cand.preview_url || cand.image_url) ? licEval.usage_status : 'restricted',
          attribution_text: cand.attribution_text || null,
          warnings
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          image_id: 'unknown',
          accessible: false,
          mime_type: null,
          dimensions: null,
          subject_match: 'uncertain',
          match_basis: 'Gagal menginspeksi kandidat gambar.',
          usage_status: 'unknown',
          attribution_text: null,
          warnings: [err.message]
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 3. Prepare Image Display
    if ((url.pathname === '/api/tools/prepare-image-display' || url.pathname === '/api/prepare-image-display') && request.method === 'POST') {
      try {
        const body = await readEdgeJsonBody();
        const image_ids = Array.isArray(body.image_ids) ? body.image_ids.map((id) => String(id || '').trim()).filter(Boolean).slice(0, 12) : [];
        const layout = ['single', 'gallery', 'collage'].includes(body.layout) ? body.layout : (image_ids.length === 1 ? 'single' : 'collage');
        const placement = ['after_intro', 'within_section'].includes(body.placement) ? body.placement : 'after_intro';
        const alt_texts = Array.isArray(body.alt_texts) ? body.alt_texts : [];

        const display_items = [];
        const item_errors = [];

        for (let idx = 0; idx < image_ids.length; idx++) {
          const id = image_ids[idx];
          const cand = await resolveEdgeCandidateById(id);
          if (!cand) {
            item_errors.push({ image_id: id, code: 'invalid_image', message: `image_id "${id}" tidak ditemukan.` });
            continue;
          }
          const licEval = evaluateEdgeLicenseStatus(cand.license_name);
          if (licEval.usage_status !== 'allowed') {
            item_errors.push({ image_id: id, code: licEval.usage_status === 'restricted' ? 'access_denied' : 'license_unknown', message: licEval.warning || 'Lisensi tidak terverifikasi.' });
            continue;
          }
          const verifiedMediaUrl = cand.source_name === 'unsplash'
            ? (cand.image_url || cand.preview_url)
            : (cand.preview_url || cand.image_url);
          if (!verifiedMediaUrl) {
            item_errors.push({ image_id: id, code: 'invalid_image', message: 'URL media kandidat kosong.' });
            continue;
          }
          const alt = String(alt_texts[idx] || cand.title || `Visual terverifikasi ${idx + 1}`).trim();
          const tokenPayload = JSON.stringify({ id: cand.image_id, u: verifiedMediaUrl, ts: Date.now(), exp: Date.now() + 6 * 3600 * 1000 });
          const payloadB64 = btoa(unescape(encodeURIComponent(tokenPayload))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          let token = payloadB64;
          try {
            const secretStr = String((env && (env.IMAGE_TOKEN_SECRET || env.OPENROUTER_API_KEY || env.TUNNEL_GATEWAY_URL)) || TUNNEL_GATEWAY_URL || 'zoz-edge-asset-v1');
            const keyData = new TextEncoder().encode(secretStr);
            const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
            const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payloadB64));
            const sigBytes = new Uint8Array(sigBuf);
            let sigBin = '';
            for (let si = 0; si < sigBytes.length; si++) sigBin += String.fromCharCode(sigBytes[si]);
            const sigB64 = btoa(sigBin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            token = `edge.${payloadB64}.${sigB64}`;
          } catch (_) {}
          const asset_ref = cand.source_name === 'unsplash' ? verifiedMediaUrl : `/api/tools/image-asset/${token}`;
          display_items.push({
            image_id: cand.image_id,
            asset_ref,
            fallback_asset_ref: verifiedMediaUrl,
            direct_media_url: verifiedMediaUrl,
            alt_text: alt,
            title: cand.title,
            source_name: cand.source_name || 'wikimedia_commons',
            source_page_url: cand.source_page_url,
            creator: cand.creator,
            creator_url: cand.creator_url,
            license_name: cand.license_name,
            license_url: cand.license_url,
            attribution_text: cand.attribution_text,
            width: cand.width,
            height: cand.height,
            media_category: 'documentary_photo'
          });
        }

        if (display_items.length === 0) {
          return new Response(JSON.stringify({
            status: 'error',
            error_code: item_errors[0]?.code || 'invalid_image',
            display_items: [],
            item_errors,
            layout,
            placement,
            rendering_requirements: {
              requires_client_renderer: true,
              payload_is_not_render_confirmation: true
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const display_id = `disp_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
        const placement_token = `[[ZOZ_IMAGE_DISPLAY:${display_id}]]`;

        return new Response(JSON.stringify({
          status: item_errors.length > 0 ? 'partial' : 'ready',
          display_id,
          placement_token,
          display_items,
          item_errors,
          layout: display_items.length === 1 ? 'single' : layout,
          placement,
          rendering_requirements: {
            requires_client_renderer: true,
            payload_is_not_render_confirmation: true,
            placement_token,
            component_type: 'zoz-grounded-image-display',
            supported_layouts: ['single', 'gallery', 'collage']
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          status: 'error',
          error_code: 'renderer_unavailable',
          message: err.message,
          display_items: []
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // 4. Image Asset Proxy Streamer
    if (url.pathname.startsWith('/api/tools/image-asset/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const isHeadRequest = request.method === 'HEAD';
      try {
        const rawToken = decodeURIComponent(url.pathname.replace(/^\/api\/tools\/image-asset\//, ''));
        // A0. Token Cloudflare Edge bertanda tangan HMAC-SHA256 (edge.<payload>.<sig>)
        if (rawToken.startsWith('edge.')) {
          const parts = rawToken.split('.');
          if (parts.length !== 3 || !parts[1] || !parts[2]) {
            return new Response(isHeadRequest ? null : 'Invalid token', { status: 403 });
          }
          const [, payloadPart, sigPart] = parts;
          try {
            const secretStr = String((env && (env.IMAGE_TOKEN_SECRET || env.OPENROUTER_API_KEY || env.TUNNEL_GATEWAY_URL)) || TUNNEL_GATEWAY_URL || 'zoz-edge-asset-v1');
            const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(secretStr), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
            let sigB64 = sigPart.replace(/-/g, '+').replace(/_/g, '/');
            while (sigB64.length % 4) sigB64 += '=';
            const sigBin = atob(sigB64);
            const sigBytes = new Uint8Array(sigBin.length);
            for (let si = 0; si < sigBin.length; si++) sigBytes[si] = sigBin.charCodeAt(si);
            const isValidSig = await crypto.subtle.verify('HMAC', cryptoKey, sigBytes, new TextEncoder().encode(payloadPart));
            if (!isValidSig) {
              return new Response(isHeadRequest ? null : 'Invalid signature', { status: 403 });
            }
            let b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) b64 += '=';
            const decodedEdge = JSON.parse(decodeURIComponent(escape(atob(b64))));
            if (!decodedEdge || (decodedEdge.exp && Date.now() > decodedEdge.exp) || (decodedEdge.ts && Date.now() - decodedEdge.ts > 6 * 3600 * 1000)) {
              return new Response(isHeadRequest ? null : 'Token expired', { status: 410 });
            }
            let targetAssetUrl = null;
            if (decodedEdge.id) {
              const hydrated = await resolveEdgeCandidateById(decodedEdge.id);
              targetAssetUrl = hydrated ? (hydrated.preview_url || hydrated.image_url) : null;
            }
            if (!targetAssetUrl && (decodedEdge.u || decodedEdge.url)) {
              targetAssetUrl = decodedEdge.u || decodedEdge.url;
            }
            if (targetAssetUrl) {
              const u = new URL(targetAssetUrl);
              if (isSafeRasterAssetUrl(u)) {
                const upRes = await fetch(targetAssetUrl, {
                  headers: { 'User-Agent': 'ZozRouter/1.0 (Cloudflare Edge Visual Proxy; https://z21.zozdocs.com)' },
                  redirect: 'manual',
                  signal: AbortSignal.timeout(7000)
                });
                const safeResp = buildSafeImageProxyResponse(upRes, isHeadRequest);
                if (safeResp) return safeResp;
              }
            }
          } catch (_) {
            return new Response(isHeadRequest ? null : 'Invalid token', { status: 403 });
          }
          return new Response(isHeadRequest ? null : 'Asset unavailable', { status: 404 });
        }

        // A. Token dari laptop server (membawa signature tanda titik '.')
        if (rawToken.includes('.')) {
          const tunnelBase = TUNNEL_GATEWAY_URL;
          const laptopRes = await fetch(`${tunnelBase}${url.pathname}`, {
            method: isHeadRequest ? 'HEAD' : 'GET',
            headers: { 'Accept': 'image/*' },
            signal: AbortSignal.timeout(6000)
          }).catch(() => null);
          if (laptopRes && laptopRes.ok) {
            const safeLaptopResp = buildSafeImageProxyResponse(laptopRes, isHeadRequest);
            if (safeLaptopResp) return safeLaptopResp;
          }
          // Hanya gunakan fallback CDN jika kandidat terdaftar di Edge cache (bukan URL mentah dari payload tak terverifikasi)
          try {
            const payloadB64 = rawToken.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
            const padded = payloadB64 + '='.repeat((4 - (payloadB64.length % 4)) % 4);
            const parsedOriginToken = JSON.parse(decodeURIComponent(escape(atob(padded))));
            const candidateId = parsedOriginToken?.id;
            if (candidateId && (!parsedOriginToken.exp || Date.now() <= parsedOriginToken.exp)) {
              const hydrated = await resolveEdgeCandidateById(candidateId);
              const licCheckA = hydrated ? evaluateEdgeLicenseStatus(hydrated.license_name) : { usage_status: 'unknown' };
              const originTargetUrl = (hydrated && licCheckA.usage_status === 'allowed') ? (hydrated.preview_url || hydrated.image_url) : null;
              if (originTargetUrl) {
                const u = new URL(originTargetUrl);
                if (isSafeRasterAssetUrl(u)) {
                  const upRes = await fetch(originTargetUrl, {
                    headers: { 'User-Agent': 'ZozRouter/1.0 (Cloudflare Edge Visual Proxy; https://z21.zozdocs.com)' },
                    redirect: 'manual',
                    signal: AbortSignal.timeout(7000)
                  }).catch(() => null);
                  const safeResp = buildSafeImageProxyResponse(upRes, isHeadRequest);
                  if (safeResp) return safeResp;
                }
              }
            }
          } catch (_) {}
        }

        // B. Token tanpa signature: HANYA izinkan jika ID kandidat tercatat di Edge cache & lolos verifikasi lisensi
        let decoded = null;
        try {
          let b64 = rawToken.replace(/-/g, '+').replace(/_/g, '/');
          while (b64.length % 4) b64 += '=';
          decoded = JSON.parse(decodeURIComponent(escape(atob(b64))));
        } catch (_) {}

        let targetAssetUrl = null;
        if (decoded && decoded.id && (!decoded.ts || Date.now() - decoded.ts <= 6 * 3600 * 1000)) {
          const hydrated = await resolveEdgeCandidateById(decoded.id);
          const licCheckB = hydrated ? evaluateEdgeLicenseStatus(hydrated.license_name) : { usage_status: 'unknown' };
          targetAssetUrl = (hydrated && licCheckB.usage_status === 'allowed') ? (hydrated.preview_url || hydrated.image_url) : null;
        }

        if (targetAssetUrl) {
          const u = new URL(targetAssetUrl);
          if (isSafeRasterAssetUrl(u)) {
            const upRes = await fetch(targetAssetUrl, {
              headers: { 'User-Agent': 'ZozRouter/1.0 (Cloudflare Edge Visual Proxy; https://z21.zozdocs.com)' },
              redirect: 'manual',
              signal: AbortSignal.timeout(7000)
            });
            const safeResp = buildSafeImageProxyResponse(upRes, isHeadRequest);
            if (safeResp) return safeResp;
          }
        }

        // C. Fallback: coba alirkan melalui laptop tunnel
        const tunnelFallback = TUNNEL_GATEWAY_URL;
        const fallbackRes = await fetch(`${tunnelFallback}${url.pathname}`, {
          method: isHeadRequest ? 'HEAD' : 'GET',
          headers: { 'Accept': 'image/*' },
          signal: AbortSignal.timeout(6000)
        }).catch(() => null);

        if (fallbackRes && fallbackRes.ok) {
          const ct = String(fallbackRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
          if (!ct.startsWith('image/') || ct.includes('svg')) {
            return new Response(isHeadRequest ? null : 'Unsupported media type', { status: 415 });
          }
          if (isHeadRequest) {
            try { fallbackRes.body?.cancel(); } catch (_) {}
          }
          const respHeaders = {
            'Content-Type': ct,
            'Cache-Control': 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; sandbox",
            'Access-Control-Allow-Origin': '*'
          };
          const fbLen = fallbackRes.headers.get('content-length');
          if (fbLen) respHeaders['Content-Length'] = fbLen;
          return new Response(isHeadRequest ? null : fallbackRes.body, {
            status: 200,
            headers: respHeaders
          });
        }

        return new Response(isHeadRequest ? null : 'Asset not found or expired', { status: 404 });
      } catch (_) {
        return new Response(isHeadRequest ? null : 'Asset proxy error', { status: 502 });
      }
    }

    // Default static assets (Cloudflare Pages) atau 404 response (Standalone Worker)
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      const assetRes = await env.ASSETS.fetch(request);
      const assetCt = String(assetRes.headers.get('content-type') || '').toLowerCase();
      if (url.pathname === '/' || url.pathname.endsWith('.html') || assetCt.includes('text/html')) {
        const noCacheHeaders = new Headers(assetRes.headers);
        noCacheHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        return new Response(assetRes.body, {
          status: assetRes.status,
          statusText: assetRes.statusText,
          headers: noCacheHeaders
        });
      }
      return assetRes;
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
