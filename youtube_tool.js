/**
 * ==============================================================================
 * UNIVERSAL YOUTUBE METADATA & GROUNDING TOOL (NODE.JS) - UPGRADED v2.0
 * ==============================================================================
 * Menggunakan YouTube oEmbed & parser metadata terverifikasi (Zero API Key).
 *
 * Pembaruan & Fitur Unggulan v2.0:
 * 1. Anti-Hallucination Grounding Directives: Memberi instruksi tegas kepada AI
 *    tentang batasan data (mencegah AI mengarang isi video jika transkrip tidak ada).
 * 2. TTL-Based In-Memory LRU Cache: Mencegah data basi dengan batas TTL (4 jam)
 *    dan batas maksimum entri (200 entri).
 * 3. Network Resilience: Retry otomatis dengan Exponential Backoff untuk mengatasi
 *    transient network errors dan status HTTP 429 / 5xx.
 * 4. Regex URL Universal: Mendukung youtu.be, shorts, live, embed, /v/, playlist,
 *    dan parameter timestamp (?t=120s).
 * 5. Eksekusi Asinkron Konkuren Cepat: Menggunakan Promise.all untuk multi-link.
 * ==============================================================================
 */

const https = require('https');
const { URL } = require('url');

const ALLOWED_HOSTS = new Set([
  'youtu.be',
  'www.youtu.be',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com'
]);

// Regex YouTube komprehensif (watch, shorts, live, embed, /v/, playlist)
const YOUTUBE_URL_REGEX = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?/gi;
const PLAYLIST_URL_REGEX = /(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/playlist\?(?:.*&)?list=([a-zA-Z0-9_-]+)/i;

/**
 * In-Memory LRU Cache dengan Time-To-Live (TTL)
 */
class TtlCache {
  constructor(maxEntries = 200, ttlMs = 4 * 60 * 60 * 1000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear() {
    this.cache.clear();
  }
}

const memoryCache = new TtlCache();

/**
 * Mengekstrak ID video YouTube yang unik dari teks apapun.
 * @param {string} text 
 * @returns {string[]}
 */
function extractYouTubeVideoIds(text) {
  if (!text || typeof text !== 'string') return [];
  const ids = [];
  const re = new RegExp(YOUTUBE_URL_REGEX.source, 'gi');
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match[1] && !ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }
  return ids;
}

/**
 * Pembantu fetch HTTPS dengan mekanisme retry dan exponential backoff.
 */
function httpsGetWithRetry(targetUrl, timeoutMs = 8000, maxRetries = 2, backoffMs = 500) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    function executeRequest() {
      attempt++;
      const req = https.get(targetUrl, {
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/html, */*'
        }
      }, (res) => {
        // Handle redirect 301/302
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          return resolve(httpsGetWithRetry(res.headers.location, timeoutMs, maxRetries - 1, backoffMs));
        }

        // Retry jika terkena rate limit (429) atau server error (500, 502, 503, 504)
        if ((res.statusCode === 429 || (res.statusCode >= 500 && res.statusCode <= 504)) && attempt <= maxRetries) {
          const delay = backoffMs * Math.pow(2, attempt - 1);
          return setTimeout(executeRequest, delay);
        }

        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
      });

      req.on('timeout', () => {
        req.destroy();
        if (attempt <= maxRetries) {
          setTimeout(executeRequest, backoffMs * attempt);
        } else {
          reject(new Error(`Timeout setelah ${timeoutMs}ms`));
        }
      });

      req.on('error', (err) => {
        if (attempt <= maxRetries) {
          setTimeout(executeRequest, backoffMs * attempt);
        } else {
          reject(err);
        }
      });
    }

    executeRequest();
  });
}

/**
 * Mengambil metadata resmi dan informasi YouTube via oEmbed dengan caching TTL.
 * @param {string} rawUrlOrId 
 * @param {number} [timeoutMs=8000] 
 * @returns {Promise<Object>}
 */
async function getYouTubeInfo(rawUrlOrId, timeoutMs = 8000) {
  if (!rawUrlOrId || typeof rawUrlOrId !== 'string') {
    throw new Error('URL atau ID video YouTube tidak valid.');
  }

  const clean = rawUrlOrId.trim();
  let videoId = null;
  let canonicalUrl = '';
  let playlistId = null;

  // Cek jika input berupa ID video 11 karakter murni
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    videoId = clean;
    canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  } else {
    let parsedUrl;
    try {
      const urlStr = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
      parsedUrl = new URL(urlStr);
    } catch (err) {
      throw new Error(`Format URL tidak valid: ${err.message}`);
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(hostname)) {
      throw new Error(`Host '${hostname}' tidak diizinkan. Hanya URL resmi YouTube yang diizinkan.`);
    }

    const idMatch = parsedUrl.href.match(/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (idMatch && idMatch[1]) {
      videoId = idMatch[1];
      canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    } else {
      canonicalUrl = parsedUrl.href;
    }

    const plMatch = parsedUrl.href.match(PLAYLIST_URL_REGEX);
    if (plMatch && plMatch[1]) {
      playlistId = plMatch[1];
    }
  }

  // Periksa cache dengan TTL
  const cached = memoryCache.get(canonicalUrl);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;

  try {
    const res = await httpsGetWithRetry(oembedEndpoint, timeoutMs);

    if (res.statusCode === 404) {
      return {
        success: false,
        error: 'Video tidak ditemukan atau berstatus privat/dihapus (HTTP 404).',
        url: canonicalUrl,
        videoId
      };
    }

    if (res.statusCode === 429) {
      return {
        success: false,
        error: 'YouTube menerapkan pembatasan laju kueri (HTTP 429 Rate Limit). Coba beberapa saat lagi.',
        url: canonicalUrl,
        videoId
      };
    }

    if (res.statusCode !== 200) {
      return {
        success: false,
        error: `YouTube oEmbed mengembalikan status HTTP ${res.statusCode}`,
        url: canonicalUrl,
        videoId
      };
    }

    const parsed = JSON.parse(res.body);
    const result = {
      success: true,
      videoId,
      playlistId: playlistId || null,
      url: canonicalUrl,
      title: parsed.title || 'Tanpa Judul',
      channel: parsed.author_name || 'Kreator YouTube',
      channel_url: parsed.author_url || '',
      thumbnail: parsed.thumbnail_url || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''),
      type: parsed.type || 'video',
      provider: parsed.provider_name || 'YouTube',
      hasTranscript: false, // oEmbed murni metadata (transkrip teks tidak tersedia di oEmbed)
      timestamp: Date.now()
    };

    memoryCache.set(canonicalUrl, result);
    return result;
  } catch (err) {
    return {
      success: false,
      error: `Kegagalan jaringan YouTube oEmbed: ${err.message}`,
      url: canonicalUrl,
      videoId
    };
  }
}

/**
 * ==============================================================================
 * UNIVERSAL AUTO-GROUNDING DENGAN INSTRUKSI ANTI-HALUSINASI
 * ==============================================================================
 * Mengambil metadata resmi dan menyuntikkan instruksi tegas kepada AI
 * agar tidak berhalusinasi mengarang isi video jika transkrip tidak ada.
 * ==============================================================================
 */
async function enrichPromptWithYouTube(prompt) {
  if (!prompt || typeof prompt !== 'string') return prompt;
  const ids = extractYouTubeVideoIds(prompt);
  if (ids.length === 0) return prompt;

  // Eksekusi paralel asinkron (konkuren) untuk semua tautan
  const results = await Promise.all(ids.map(id => getYouTubeInfo(id)));
  const validVideos = results.filter(r => r && r.success);
  if (validVideos.length === 0) return prompt;

  const groundingBlocks = validVideos.map((v, idx) => {
    return `[DATA TERVERIFIKASI VIDEO YOUTUBE #${idx + 1}]
- URL Resmi: ${v.url}
- ID Video: ${v.videoId || 'N/A'}
- Judul Video: "${v.title}"
- Nama Channel / Kreator: "${v.channel}" (${v.channel_url || 'N/A'})
- Thumbnail: ${v.thumbnail}
- Status Transkrip: Tidak tersedia dalam metadata oEmbed.`;
  }).join('\n\n');

  const groundingHeader = `\n\n### DATA METADATA RESMI YOUTUBE (VERIFIED GROUNDING):
${groundingBlocks}

### PANDUAN INTEGRITAS & ANTI-HALUSINASI UNTUK ASISTEN AI:
1. Informasi di atas adalah metadata resmi terverifikasi real-time via YouTube oEmbed.
2. BATASAN DATA: Data di atas HANYA memuat judul dan nama channel/kreator, dan TIDAK MEMUAT transkrip/rekaman isi suara video.
3. DILARANG BERHALUSINASI: Dilarang mengarang, menebak, atau mereka-reka isi dialog, kesimpulan, atau alur adegan detail dari video di atas semata-mata berdasarkan judulnya.
4. JAWABAN JUJUR: Jika pengguna meminta "Rangkum isi video ini" atau "Apa kesimpulan video ini?", jelaskan fakta judul dan kreatornya, lalu sampaikan secara transparan kepada pengguna bahwa transkrip penuh percakapan di dalam video tidak tersedia.\n`;

  return prompt + groundingHeader;
}

/**
 * ==============================================================================
 * TOOL DEFINITIONS UNTUK SEMUA FRAMEWORK FUNCTION CALLING
 * ==============================================================================
 */

// 1. Skema untuk Anthropic Claude
const YOUTUBE_TOOL_ANTHROPIC = {
  name: 'get_youtube_info',
  description: 'Mengambil metadata resmi (judul, nama kreator, URL channel, dan thumbnail) dari tautan atau ID video YouTube resmi via oEmbed. Gunakan tool ini setiap kali pengguna memberikan tautan YouTube.',
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL video YouTube (contoh: https://youtu.be/... atau https://www.youtube.com/watch?v=...) atau ID video 11 karakter.'
      }
    },
    required: ['url']
  }
};

// 2. Skema untuk OpenAI & OpenRouter
const YOUTUBE_TOOL_OPENAI = {
  type: 'function',
  function: {
    name: 'get_youtube_info',
    description: 'Mengambil metadata resmi (judul, nama kreator, thumbnail) dari video YouTube via oEmbed.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL lengkap video YouTube atau ID video 11 karakter.'
        }
      },
      required: ['url']
    }
  }
};

// 3. Skema untuk Ollama
const YOUTUBE_TOOL_OLLAMA = YOUTUBE_TOOL_OPENAI;

// ==============================================================================
// CLI ENTRYPOINT
// ==============================================================================
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Penggunaan CLI Node.js (v2.0):');
    console.log('  1. Ambil info video:');
    console.log('     node youtube_tool.js https://youtu.be/tscOUFxV3qA');
    console.log('\n  2. Perkaya prompt dengan proteksi anti-halusinasi:');
    console.log('     node youtube_tool.js --enrich "Rangkum video https://youtu.be/tscOUFxV3qA ini"');
    process.exit(0);
  }

  (async () => {
    try {
      if (args[0] === '--enrich' && args.length > 1) {
        const promptInput = args.slice(1).join(' ');
        const enriched = await enrichPromptWithYouTube(promptInput);
        console.log('=== PROMPT TERKAYA DENGAN GROUNDING ANTI-HALUSINASI ===');
        console.log(enriched);
      } else {
        const info = await getYouTubeInfo(args[0]);
        console.log(JSON.stringify(info, null, 2));
      }
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  getYouTubeInfo,
  extractYouTubeVideoIds,
  enrichPromptWithYouTube,
  TtlCache,
  YOUTUBE_TOOL_ANTHROPIC,
  YOUTUBE_TOOL_OPENAI,
  YOUTUBE_TOOL_OLLAMA
};
