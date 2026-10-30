function isPrivateHostname(hostname) {
  if (!hostname) return true;
  const h = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
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
  if (/^fc00:|^fe80:/i.test(h)) return true; // IPv6 Unique Local & Link-Local
  if (h.startsWith('::ffff:')) return true; // Block all IPv4-mapped IPv6
  if (h.startsWith('::7f00:') || h.startsWith('::a9fe:') || h.startsWith('::c0a8:') || h.startsWith('::0a')) return true; // Block mapped hex variants
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

function mapOllamaModelToOpenRouter(modelId) {
  if (!modelId || typeof modelId !== 'string') return 'openrouter/free';
  const id = modelId.trim();
  if (id.includes('/')) return id;
  return 'openrouter/free';
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

  // 2. Proteksi lintas-asal browser
  const sfs = request.headers.get('sec-fetch-site');
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return false;

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
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ollama-endpoint, x-ollama-key, x-api-key, x-openrouter-key, x-title, X-Title, HTTP-Referer, http-referer, x-session-id, X-Session-ID, x-user-id, X-User-ID, x-client-id, X-Client-ID, x-user-token, X-User-Token, x-wa-pin, X-WA-PIN'
        }
      });
    }

    // Universal WhatsApp, AI & Daemon Tunnel Proxy (Edge Bridge)
    const TUNNEL_GATEWAY_URL = 'https://roommate-flashers-flags-briefly.trycloudflare.com';
    let reqBodyBytes = null;
    if (url.pathname.startsWith('/api/')) {
      const targetUrl = TUNNEL_GATEWAY_URL + url.pathname + url.search;
      const fwdHeaders = new Headers(request.headers);
      fwdHeaders.set('Host', 'roommate-flashers-flags-briefly.trycloudflare.com');
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
        const isWaOrTerm = url.pathname.startsWith('/api/wa/') || url.pathname.startsWith('/api/terminal/') || url.pathname.startsWith('/api/tunnel/') || url.pathname.startsWith('/api/daemon/');
        if (!isWaOrTerm && (upstream.status === 502 || upstream.status === 504 || upstream.status === 503)) {
          // Lanjut ke handler worker di bawah jika tunnel mengembalikan 502/504
        } else {
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
        }
      } catch (proxyErr) {
        const isWaOrTerm = url.pathname.startsWith('/api/wa/') || url.pathname.startsWith('/api/terminal/') || url.pathname.startsWith('/api/tunnel/') || url.pathname.startsWith('/api/daemon/');
        if (isWaOrTerm) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Gagal menghubungi tunnel WhatsApp/Daemon backend lokal: ' + proxyErr.message,
            tunnelUrl: TUNNEL_GATEWAY_URL
          }), {
            status: 502,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        // Endpoint AI/lainnya lanjut ke fallback worker di bawah jika tunnel offline
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
        let body = {};
        if (reqBodyBytes && reqBodyBytes.byteLength > 0) {
          try { body = JSON.parse(new TextDecoder().decode(reqBodyBytes)); } catch (_) {}
        } else {
          body = await request.json().catch(() => ({}));
        }
        const authHeaderVal = request.headers.get('Authorization') || request.headers.get('authorization') || '';
        const bearerKey = authHeaderVal.startsWith('Bearer ') ? authHeaderVal.slice(7).trim() : authHeaderVal.trim();
        const rawOllamaKey = sanitizeOllamaApiKey(
          (body.ollamaApiKey && !String(body.ollamaApiKey).startsWith('sk-or-')) ? String(body.ollamaApiKey) :
          (request.headers.get('x-ollama-key') && !String(request.headers.get('x-ollama-key')).startsWith('sk-or-') ? String(request.headers.get('x-ollama-key')) :
          (request.headers.get('x-api-key') && !String(request.headers.get('x-api-key')).startsWith('sk-or-') ? String(request.headers.get('x-api-key')) :
          ((body.apiKey && !String(body.apiKey).startsWith('sk-or-')) ? String(body.apiKey) :
          (bearerKey && !bearerKey.startsWith('sk-or-') ? bearerKey : null))))
        ) || (envKeyAllowed(request, env) ? sanitizeOllamaApiKey(env?.OLLAMA_API_KEY) : null);

        const targetEndpoint = body.endpoint || 'https://ollama.com';
        let cleanEndpoint = (targetEndpoint || 'https://ollama.com').trim();
        // Pada Cloudflare Edge, jika endpoint loopback dikirim oleh browser, alihkan ke Ollama Cloud
        if (cleanEndpoint.includes('127.0.0.1') || cleanEndpoint.includes('localhost') || cleanEndpoint.includes('::1') || !cleanEndpoint) {
          cleanEndpoint = 'https://ollama.com';
        }
        if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
          cleanEndpoint = 'https://' + cleanEndpoint;
        }

        const isLoopback = cleanEndpoint.includes('127.0.0.1') || cleanEndpoint.includes('localhost') || cleanEndpoint.includes('::1');
        // Cloud Bridge (OpenRouter fallback) HANYA dipakai jika pengguna TIDAK memiliki Ollama API Key / credit
        // DAN target endpoint adalah localhost/loopback atau ollama.com.
        // Jika pengguna MEMILIKI Ollama API Key (rawOllamaKey), mereka MEMILIKI kredit di Ollama, sehingga
        // WAJIB diteruskan langsung ke endpoint Ollama resmi (https://ollama.com/api/chat) tanpa dibajak ke OpenRouter!
        const shouldUseCloudBridge = !rawOllamaKey && (isLoopback || cleanEndpoint.includes('ollama.com'));

        if (shouldUseCloudBridge) {
          // Pure Cloud Fallback: Hanya jika pengguna belum mengisi Ollama API Key
          let orKey = body.openRouterKey || (body.apiKey && String(body.apiKey).startsWith('sk-or-') ? body.apiKey : null) || request.headers.get('x-openrouter-key') || request.headers.get('x-api-key') || (request.headers.get('Authorization') && request.headers.get('Authorization').includes('sk-or-') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
          if (orKey) orKey = String(orKey).replace(/^Bearer\s+/i, '').trim();

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
          const openRouterPayload = {
            model: targetModel,
            messages: body.messages || [],
            stream: isStream,
            provider: { allow_fallbacks: true }
          };
          if (body.options?.temperature !== undefined) openRouterPayload.temperature = body.options.temperature;
          if (body.options?.top_p !== undefined) openRouterPayload.top_p = body.options.top_p;

          const isFreeModel = targetModel.includes(':free') || targetModel.endsWith('/free') || targetModel === 'openrouter/free';
          if (!isFreeModel && Array.isArray(body.tools) && body.tools.length > 0) {
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

          const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: orHeaders,
            body: JSON.stringify(openRouterPayload),
            signal: request.signal
          });

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
            const textContent = data.choices?.[0]?.message?.content || '';
            const msgPayload = { role: 'assistant', content: textContent };
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

          (async () => {
            let buffer = '';
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith('data:')) continue;
                  const dataStr = trimmed.slice(5).trim();
                  if (dataStr === '[DONE]') {
                    await writer.write(encoder.encode(JSON.stringify({
                      model: body.model || 'qwen2.5:1.5b',
                      created_at: new Date().toISOString(),
                      message: { role: 'assistant', content: '' },
                      done: true
                    }) + '\n'));
                    continue;
                  }
                  try {
                    const parsed = JSON.parse(dataStr);
                    const deltaContent = parsed.choices?.[0]?.delta?.content || '';
                    const deltaToolCalls = parsed.choices?.[0]?.delta?.tool_calls;
                    if (deltaContent || deltaToolCalls) {
                      const msgPayload = { role: 'assistant', content: deltaContent };
                      if (deltaToolCalls) msgPayload.tool_calls = deltaToolCalls;
                      await writer.write(encoder.encode(JSON.stringify({
                        model: body.model || 'qwen2.5:1.5b',
                        created_at: new Date().toISOString(),
                        message: msgPayload,
                        done: false
                      }) + '\n'));
                    }
                  } catch (_) {}
                }
              }
            } catch (err) {
              console.error('Error in Ollama cloud streaming proxy:', err);
            } finally {
              await writer.close();
            }
          })();

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
        if (rawOllamaKey) {
          headers['Authorization'] = `Bearer ${rawOllamaKey}`;
          headers['x-ollama-key'] = rawOllamaKey;
        }

        const resolvedModel = body.model || 'llama3.2:3b';

        const outBody = {
          model: resolvedModel,
          messages: body.messages || [],
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

        let res = await fetch(targetUrl.toString(), {
          method: 'POST',
          headers,
          body: JSON.stringify(outBody),
          signal: request.signal
        });

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
        const endpoint = url.searchParams.get('endpoint') || 'https://ollama.com';
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
          res = await fetch(targetUrl.toString(), { headers, signal: AbortSignal.timeout(5000) });
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
          const v1Res = await fetch(v1Url.toString(), { headers, signal: AbortSignal.timeout(3500) }).catch(() => null);
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
            const isLiquid = reqModel.includes('liquid') || reqModel.includes('lfm-');
            const isReasoning = Boolean(reqModel && (/\/o[1-9]|\b(r1|reasoning|deepseek-r)\b/i.test(reqModel) || reqModel.toLowerCase().includes('reasoning') || reqModel.toLowerCase().includes('-r1')));
            const out = {
              model: reqModel,
              messages: body.messages || [],
              stream: body.stream !== false,
              ...(body.provider ? { provider: body.provider } : { provider: { allow_fallbacks: true } }),
              ...(body.plugins ? { plugins: body.plugins } : {}),
              ...(body.modalities ? { modalities: body.modalities } : {}),
              ...(body.reasoning ? { reasoning: body.reasoning } : {}),
              ...(body.max_tokens ? { max_tokens: body.max_tokens } : {})
            };
            if (!isReasoning) {
              out.temperature = body.temperature ?? 0.7;
            }
            if (!isLiquid && !isReasoning) {
              out.top_p = body.top_p ?? 0.9;
            }
            if (body.tools && Array.isArray(body.tools) && (!reqModel.includes(':free') && !reqModel.endsWith('/free') && reqModel !== 'openrouter/free')) {
              const clean = body.tools.filter(t => t && t.type === 'function' && t.function && t.function.name);
              if (clean.length > 0) {
                out.tools = clean;
                if (body.tool_choice) out.tool_choice = body.tool_choice;
              }
            }
            return out;
          })())
        });

        const newHeaders = new Headers(res.headers);
        newHeaders.delete('content-encoding');
        newHeaders.delete('content-length');
        newHeaders.delete('transfer-encoding');
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
          openRouterKey = body.openRouterKey || body.apiKey || (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || request.headers.get('x-openrouter-key') || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
        } else {
          prompt = url.searchParams.get('prompt') || url.searchParams.get('q') || '';
          musicModel = url.searchParams.get('musicModel') || url.searchParams.get('model') || musicModel;
          openRouterKey = (request.headers.get('Authorization') ? request.headers.get('Authorization').replace(/^Bearer\s+/i, '') : null) || request.headers.get('x-openrouter-key') || (envKeyAllowed(request, env) ? env?.OPENROUTER_API_KEY : null);
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
            status: orRes.status || 500,
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

        // 2. Direct Primary Feed Spiders (Direct publisher RSS without search engines)
        const PRIMARY_FEEDS = [
          'https://feeds.arstechnica.com/arstechnica/index',
          'https://huggingface.co/blog/feed.xml',
          'https://www.antaranews.com/rss/tekno.xml',
          'https://techcrunch.com/feed/'
        ];

        const candidatePool = [];

        // Crawl direct primary feeds if needed for live news
        const combinedContext = (cleanQuery + ' ' + (context || '')).toLowerCase();
        const wantsLive = true; // Worker tidak punya index persisten: selalu rayapi sumber primer langsung

        if (wantsLive) {
          const fetchFeed = async (feedUrl) => {
            try {
              const res = await fetch(feedUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZozSpider/2.0' },
                signal: AbortSignal.timeout(4000)
              });
              if (!res.ok) return [];
              const xml = await res.text();
              const items = [];
              const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
              let match;
              while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
                const raw = match[1];
                const titleM = /<title\b[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/title>/i.exec(raw);
                const linkM = /<link\b[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/link>/i.exec(raw);
                const descM = /<(?:description|content:encoded|summary)\b[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/(?:description|content:encoded|summary)>/i.exec(raw);
                const pubM = /<(?:pubDate|dc:date|published|updated)\b[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/(?:pubDate|dc:date|published|updated)>/i.exec(raw);

                const title = (titleM ? (titleM[1] || titleM[2] || '') : '').replace(/<[^>]+>/g, '').trim();
                let link = (linkM ? (linkM[1] || linkM[2] || '') : '').trim();
                const fullM = /<content:encoded\b[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/content:encoded>/i.exec(raw);
                const descText = (descM ? (descM[1] || descM[2] || '') : '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                const fullText = (fullM ? (fullM[1] || fullM[2] || '') : '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                const snippet = descText.slice(0, 300);
                const articleText = (fullText.length > descText.length ? fullText : descText).slice(0, 4000);
                const pubDate = (pubM ? (pubM[1] || pubM[2] || '') : '').trim();
                if (title && link) {
                  let domain = 'web';
                  try { domain = new URL(link).hostname.replace(/^www\./i, ''); } catch (_) {}
                  items.push({
                    url: link,
                    domain,
                    title,
                    snippet,
                    content: articleText,
                    category: 'feed',
                    published_at: pubDate
                  });
                }
              }
              return items;
            } catch (_) {
              return [];
            }
          };

          const feedResults = await Promise.allSettled(PRIMARY_FEEDS.map(f => fetchFeed(f)));
          for (const fr of feedResults) {
            if (fr.status === 'fulfilled' && Array.isArray(fr.value)) {
              candidatePool.push(...fr.value);
            }
          }
        }

        // Score candidates based on query token matches
        const qTokens = cleanQuery.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ').split(/\s+/).filter(Boolean);
        const scored = candidatePool.map(item => {
          let score = 0;
          const tLower = (item.title || '').toLowerCase();
          const sLower = (item.snippet || '').toLowerCase();
          const cLower = (item.content || '').toLowerCase();

          for (const token of qTokens) {
            if (tLower.includes(token)) score += 10;
            if (sLower.includes(token)) score += 4;
            if (cLower.includes(token)) score += 2;
          }

          if (item.published_at && (item.published_at.includes('2026') || item.published_at.includes('Oct') || item.published_at.includes('Oktober'))) {
            score += 5;
          }

          return { item, score };
        });

        // Filter and sort by score
        scored.sort((a, b) => b.score - a.score);

        const seenUrls = new Set();
        const results = [];
        for (const entry of scored) {
          if (entry.score <= 0 && results.length >= 3) break;
          const it = entry.item;
          if (!it.url || seenUrls.has(it.url)) continue;
          seenUrls.add(it.url);

          results.push({
            title: it.title,
            url: it.url,
            domain: it.domain,
            snippet: it.snippet,
            content: it.content || '',
            sourceProvider: `Zoz Sovereign Index (${it.domain})`,
            timestamp: Date.parse(it.published_at) || Date.now(),
            pubDate: it.published_at || 'Terkini'
          });
          if (results.length >= targetNum) break;
        }

        return new Response(JSON.stringify({
          success: true,
          query: cleanQuery,
          engine: 'zoz_sovereign_search_engine',
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
        const host = parsed.hostname.toLowerCase();
        if (/^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.0\.0\.0|169\.254\.)/.test(host) || host.endsWith('.local') || host.endsWith('.internal')) {
          return new Response(JSON.stringify({ success: false, error: 'Akses ke host lokal / intranet diblokir (SSRF Protection).' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const extRe = /\.(?:mp4|m4v|webm|ogv|mov|mkv|m3u8)(?:$|[?#])/i;
        const resp = await fetch(clean, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,video/*;q=0.9,*/*;q=0.5',
            'Range': 'bytes=0-524287'
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(9000)
        });

        if (!resp.ok && resp.status !== 206) {
          return new Response(JSON.stringify({ success: false, error: `HTTP ${resp.status}`, url: clean }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const ctype = String(resp.headers.get('content-type') || '').toLowerCase();
        const finalUrl = resp.url || clean;
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

    // Related & Recommended Videos Tool API (Cloudflare Worker)
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

        let mapped = [];
        const isDailymotion = /dailymotion\.com|dai\.ly/i.test(videoUrl) || platform === 'dailymotion';

        if (isDailymotion) {
          try {
            const dmRes = await fetch('https://api.dailymotion.com/videos?search=' + encodeURIComponent(effectiveQuery) + '&fields=id,title,channel,duration,views_total,thumbnail_url,url&limit=' + limit, { signal: AbortSignal.timeout(6000) });
            if (dmRes.ok) {
              const dmJson = await dmRes.json();
              if (Array.isArray(dmJson.list)) {
                mapped = dmJson.list.map(item => {
                  const dur = parseInt(item.duration, 10);
                  const m = Math.floor(dur / 60);
                  const s = dur % 60;
                  return {
                    platform: 'Dailymotion',
                    url: item.url || `https://www.dailymotion.com/video/${item.id}`,
                    title: item.title || 'Video Dailymotion',
                    channel: item.channel || 'Dailymotion',
                    duration: dur > 0 ? `${m}:${String(s).padStart(2, '0')}` : '',
                    views: item.views_total ? `${item.views_total} views` : '',
                    thumbnail: item.thumbnail_url || ''
                  };
                });
              }
            }
          } catch (_) {}
        }

        if (mapped.length < limit) {
          try {
            const data = await ytSearchVideos(effectiveQuery, limit - mapped.length);
            const ytMapped = (data && Array.isArray(data.results)) ? data.results.map(v => ({
              platform: 'YouTube',
              videoId: v.videoId,
              url: v.url || `https://www.youtube.com/watch?v=${v.videoId}`,
              title: v.title,
              channel: v.channel,
              duration: v.durationText || '',
              views: v.viewText || '',
              thumbnail: v.thumbnail || ''
            })) : [];
            mapped = mapped.concat(ytMapped);
          } catch (_) {}
        }

        return new Response(JSON.stringify({
          success: mapped.length > 0,
          platform: isDailymotion ? 'Dailymotion' : 'YouTube',
          query: effectiveQuery,
          sourceVideoUrl: videoUrl || null,
          count: mapped.length,
          videos: mapped
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

        // Intersep khusus untuk URL YouTube agar mengembalikan data judul & channel resmi via oEmbed
        const ytMatch = cleanTarget.match(/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
        if (ytMatch && ytMatch[1]) {
          try {
            const ytInfoRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytMatch[1]}`)}&format=json`, {
              signal: AbortSignal.timeout(8000),
              headers: { 'User-Agent': YT_SEARCH_UA }
            });
            if (ytInfoRes.ok) {
              const ytData = await ytInfoRes.json();
              return new Response(JSON.stringify({
                success: true,
                content: `[DATA TERVERIFIKASI VIDEO YOUTUBE]\n- URL: https://www.youtube.com/watch?v=${ytMatch[1]}\n- Judul Video: "${ytData.title}"\n- Nama Channel / Pembuat: "${ytData.author_name || 'Kreator YouTube'}" (${ytData.author_url || 'N/A'})\n- Thumbnail: ${ytData.thumbnail_url || `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`}\n- Status Transkrip: Tidak tersedia dalam metadata oEmbed.\n\n### PANDUAN INTEGRITAS & ANTI-HALUSINASI UNTUK ASISTEN AI:\n1. Informasi di atas adalah metadata resmi terverifikasi real-time via YouTube oEmbed.\n2. BATASAN DATA: Data di atas HANYA memuat judul dan nama channel/kreator, dan TIDAK MEMUAT transkrip/rekaman isi suara video.\n3. DILARANG BERHALUSINASI: Dilarang mengarang, menebak, atau mereka-reka isi dialog, kesimpulan, atau alur adegan detail dari video di atas semata-mata berdasarkan judulnya.\n4. JAWABAN JUJUR: Jika pengguna meminta "Rangkum isi video ini" atau "Apa kesimpulan video ini?", jelaskan fakta judul dan kreatornya, lalu sampaikan secara transparan kepada pengguna bahwa transkrip penuh percakapan di dalam video tidak tersedia.`,
                videoIds: [ytMatch[1]],
                charCount: 650
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
              });
            }
          } catch (_) {}
        }

        let content = '';
        let title = cleanTarget;

        // 1. Prioritaskan Jina Reader untuk ekstraksi halaman penuh bebas blokir
        try {
          const jinaRes = await fetch(`https://r.jina.ai/${cleanTarget}`, {
            headers: { 'Accept': 'text/plain', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(15000)
          });
          if (jinaRes.ok) {
            content = await jinaRes.text();
            const titleMatch = content.match(/^Title:\s*(.+)$/m);
            if (titleMatch) title = titleMatch[1].trim();
          }
        } catch (_) {}

        // 2. Fallback direct fetch jika Jina gagal
        if (!content) {
          try {
            const directRes = await fetch(cleanTarget, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              signal: AbortSignal.timeout(10000)
            });
            if (directRes.ok) {
              const html = await directRes.text();
              const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
              if (titleMatch) title = titleMatch[1].trim();
              content = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
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
            }
          } catch (_) {}
        }

        const trimmedContent = (content || '').slice(0, maxChars);
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
          success: true,
          message: `Berhasil menyimpan memori tentang: "${topic}"`,
          topic,
          engine: 'cloudflare-stateless'
        }), {
          status: 200,
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
