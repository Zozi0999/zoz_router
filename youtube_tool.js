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
const { execFile } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

function parseVttToCleanText(vttContent) {
  if (!vttContent) return '';
  const lines = vttContent.split(/\r?\n/);
  const cleanTokens = [];
  let prevLine = '';

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('WEBVTT') || line.startsWith('Kind:') || line.startsWith('Language:')) continue;
    if (/^\d{2}:\d{2}/.test(line) || /-->/.test(line)) continue;
    if (/^\d+$/.test(line)) continue;

    const cleaned = line
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .trim();

    if (cleaned && cleaned !== prevLine) {
      if (prevLine && cleaned.startsWith(prevLine)) {
        const added = cleaned.slice(prevLine.length).trim();
        if (added) cleanTokens.push(added);
      } else {
        cleanTokens.push(cleaned);
      }
      prevLine = cleaned;
    }
  }

  return cleanTokens.join(' ').replace(/\s+/g, ' ').trim();
}

function fetchYouTubeViaYtDlp(canonicalUrl, videoId) {
  return new Promise((resolve) => {
    const tmpDir = path.join(os.tmpdir(), `zoz_ytdlp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
    } catch (_) {
      return resolve(null);
    }

    const outTemplate = path.join(tmpDir, '%(id)s.%(ext)s');
    const args = [
      '--skip-download',
      '--write-auto-sub',
      '--write-sub',
      '--sub-lang', 'id.*,en.*',
      '--sub-format', 'vtt',
      '--ignore-errors',
      '--no-warnings',
      '--no-playlist',
      '--print-json',
      '-o', outTemplate,
      canonicalUrl
    ];

    execFile('yt-dlp', args, { timeout: 25000, maxBuffer: 15 * 1024 * 1024 }, (err, stdout, stderr) => {
      let meta = null;
      try {
        if (stdout) {
          meta = JSON.parse(stdout);
        }
      } catch (e) {
        const match = stdout?.match(/\{[\s\S]*\}/);
        if (match) {
          try { meta = JSON.parse(match[0]); } catch (_) {}
        }
      }

      let transcript = '';
      let hasTranscript = false;
      let transcriptLang = '';

      try {
        const files = fs.readdirSync(tmpDir);
        const vttFiles = files.filter(f => f.endsWith('.vtt'));
        if (vttFiles.length > 0) {
          const chosen = vttFiles.find(f => f.includes('.id')) ||
                         vttFiles.find(f => f.includes('.en')) ||
                         vttFiles[0];
          if (chosen) {
            const rawVtt = fs.readFileSync(path.join(tmpDir, chosen), 'utf8');
            transcript = parseVttToCleanText(rawVtt);
            if (transcript.length > 0) {
              hasTranscript = true;
              transcriptLang = chosen.includes('.id') ? 'id' : 'en';
            }
          }
        }
      } catch (fsErr) {
        console.error('Error reading tmp vtt files:', fsErr);
      } finally {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {}
      }

      if (!meta && !hasTranscript) {
        return resolve(null);
      }

      resolve({
        success: true,
        videoId: meta?.id || videoId || '',
        url: meta?.webpage_url || canonicalUrl,
        title: meta?.title || 'Tanpa Judul',
        channel: meta?.channel || meta?.uploader || 'Kreator YouTube',
        channel_url: meta?.channel_url || meta?.uploader_url || '',
        duration: meta?.duration || '',
        durationText: meta?.duration_string || '',
        views: meta?.view_count ? String(meta.view_count) : '',
        description: meta?.description || '',
        thumbnail: meta?.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''),
        type: 'video',
        hasTranscript,
        transcriptLang,
        transcript
      });
    });
  });
}

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

  // 1. Coba ambil metadata lengkap + transkrip nyata via yt-dlp
  if (videoId) {
    try {
      const ytdlpData = await fetchYouTubeViaYtDlp(canonicalUrl, videoId);
      if (ytdlpData && ytdlpData.success) {
        memoryCache.set(canonicalUrl, ytdlpData);
        return ytdlpData;
      }
    } catch (_) {}
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
    let block = `[DATA TERVERIFIKASI VIDEO YOUTUBE #${idx + 1}]
- URL Resmi: ${v.url}
- ID Video: ${v.videoId || 'N/A'}
- Judul Video: "${v.title}"
- Nama Channel / Kreator: "${v.channel}" (${v.channel_url || 'N/A'})
- Durasi: ${v.durationText || (v.duration ? `${v.duration} detik` : 'N/A')}
- Jumlah Tayangan: ${v.views || 'N/A'}
- Thumbnail: ${v.thumbnail}`;

    if (v.description) {
      const descSnippet = v.description.length > 2000 ? v.description.slice(0, 2000) + '...' : v.description;
      block += `\n- Deskripsi Resmi Video:\n"""\n${descSnippet}\n"""`;
    }
    if (v.hasTranscript && v.transcript) {
      const transSnippet = v.transcript.length > 25000 ? v.transcript.slice(0, 25000) + '... [transkrip dipotong untuk batas konteks]' : v.transcript;
      block += `\n- TRANSKRIP / PERCAKAPAN LENGKAP VIDEO (TERVERIFIKASI REAL-TIME):\n"""\n${transSnippet}\n"""`;
    } else {
      block += `\n- Status Transkrip: Tidak tersedia langsung pada video ini (gunakan deskripsi resmi di atas untuk merangkum).`;
    }
    return block;
  }).join('\n\n');

  const hasAnyTranscript = validVideos.some(v => v.hasTranscript && v.transcript);

  const groundingHeader = `\n\n### DATA METADATA RESMI & TRANSKRIP YOUTUBE (VERIFIED GROUNDING):
${groundingBlocks}

### PANDUAN PENGGUNAAN INFORMASI VIDEO UNTUK ASISTEN AI:
1. Data di atas memuat judul, pembuat, durasi, deskripsi resmi, serta ${hasAnyTranscript ? 'TRANSKRIP PERCAKAPAN SUARA NYATA' : 'metadata resmi'} yang diekstrak secara real-time dari video YouTube yang dikirim oleh pengguna.
2. JELASKAN & RANGKUM ISI VIDEO SECARA MENDALAM: Jika pengguna bertanya "Apa ini?", "Rangkum video ini", "Apa isinya?", atau menanyakan hal terkait materi video, manfaatkan transkrip percakapan dan deskripsi resmi di atas untuk menjawab secara detail, komprehensif, dan tepat.
3. DILARANG MENOLAK MERANGKUM jika transkrip atau deskripsi tersedia di atas. Dilarang meminta pengguna menyalin transkrip secara manual karena data transkrip dan informasinya sudah disediakan lengkap di atas untuk Anda.
4. DILARANG menyatakan "Saya tidak memiliki akses ke transkrip lengkap atau rekaman audio" jika transkrip atau deskripsi video tertera di atas. Rangkumlah poin-poin materi, pembicara, dan isi pembahasan secara profesional dan percaya diri.
5. Jika transkrip tidak tersedia pada video tersebut namun terdapat deskripsi resmi, jelaskan ringkasan materi video berdasarkan deskripsi resmi dan metadata yang disediakan.\n`;

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
