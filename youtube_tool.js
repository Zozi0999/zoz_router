/**
 * ==============================================================================
 * UNIVERSAL YOUTUBE METADATA TOOL FOR ALL AI MODELS (NODE.JS)
 * ==============================================================================
 * Menggunakan endpoint resmi YouTube oEmbed (tanpa memerlukan YouTube API Key).
 * Mendukung 100% seluruh model AI:
 * 1. Universal Auto-Grounding (Dapat digunakan oleh SEMUA model tanpa function calling)
 * 2. Anthropic Claude (via Native Tool Use / Function Calling)
 * 3. OpenAI / OpenRouter (via Native Tool Calling)
 * 4. Ollama (via Native Tool Calling)
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

const YOUTUBE_URL_REGEX = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi;

const memoryCache = new Map();

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
 * Mengambil judul video, nama channel kreator, channel URL, dan thumbnail dari YouTube oEmbed.
 * Proteksi SSRF aktif (whitelist domain resmi) dan zero API key.
 * @param {string} rawUrlOrId 
 * @param {number} [timeoutMs=10000] 
 * @returns {Promise<Object>}
 */
async function getYouTubeInfo(rawUrlOrId, timeoutMs = 10000) {
  if (!rawUrlOrId || typeof rawUrlOrId !== 'string') {
    throw new Error('URL atau ID video YouTube tidak valid.');
  }

  const clean = rawUrlOrId.trim();
  let videoId = null;
  let canonicalUrl = '';

  // Jika input berupa ID 11 karakter murni
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
      throw new Error(`Host '${hostname}' tidak diizinkan. Hanya URL YouTube resmi yang diizinkan (youtu.be, youtube.com).`);
    }

    const match = parsedUrl.href.match(/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (match && match[1]) {
      videoId = match[1];
      canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    } else {
      canonicalUrl = parsedUrl.href;
    }
  }

  if (memoryCache.has(canonicalUrl)) {
    return memoryCache.get(canonicalUrl);
  }

  const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;

  return new Promise((resolve, reject) => {
    const req = https.get(oembedEndpoint, {
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'ZozRouter-YouTubeTool/1.0 (Mozilla/5.0 Compatible)'
      }
    }, (res) => {
      if (res.statusCode === 404) {
        const notFoundRes = {
          success: false,
          error: 'Video tidak ditemukan atau berstatus privat/dihapus (HTTP 404).',
          url: canonicalUrl,
          videoId
        };
        return resolve(notFoundRes);
      }

      if (res.statusCode !== 200) {
        const errRes = {
          success: false,
          error: `YouTube oEmbed mengembalikan status HTTP ${res.statusCode}`,
          url: canonicalUrl,
          videoId
        };
        return resolve(errRes);
      }

      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const result = {
            success: true,
            videoId,
            url: canonicalUrl,
            title: parsed.title || 'Tanpa Judul',
            channel: parsed.author_name || 'Kreator YouTube',
            channel_url: parsed.author_url || '',
            thumbnail: parsed.thumbnail_url || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''),
            type: parsed.type || 'video',
            provider: parsed.provider_name || 'YouTube'
          };

          if (memoryCache.size > 200) {
            const firstKey = memoryCache.keys().next().value;
            memoryCache.delete(firstKey);
          }
          memoryCache.set(canonicalUrl, result);
          resolve(result);
        } catch (e) {
          resolve({
            success: false,
            error: `Gagal mengurai respons JSON YouTube oEmbed: ${e.message}`,
            url: canonicalUrl,
            videoId
          });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: `Timeout saat menghubungi YouTube oEmbed (${timeoutMs / 1000}s).`,
        url: canonicalUrl,
        videoId
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: `Network error YouTube oEmbed: ${err.message}`,
        url: canonicalUrl,
        videoId
      });
    });
  });
}

/**
 * ==============================================================================
 * METODE 1: UNIVERSAL AUTO-GROUNDING (BISA DIGUNAKAN OLEH 100% SEMUA MODEL)
 * ==============================================================================
 * Mendeteksi link YouTube di dalam prompt atau percakapan, mengambil metadata oEmbed,
 * dan menyuntikkan fakta judul & kreator ke dalam prompt / system context.
 * Bekerja tanpa perlu tool calling API sama sekali.
 * ==============================================================================
 */
async function enrichPromptWithYouTube(prompt) {
  if (!prompt || typeof prompt !== 'string') return prompt;
  const ids = extractYouTubeVideoIds(prompt);
  if (ids.length === 0) return prompt;

  const results = await Promise.all(ids.map(id => getYouTubeInfo(id)));
  const validVideos = results.filter(r => r && r.success);
  if (validVideos.length === 0) return prompt;

  const groundingBlocks = validVideos.map((v, idx) => {
    return `[DATA TERVERIFIKASI VIDEO YOUTUBE #${idx + 1}]
- URL Video: ${v.url}
- Judul Video: "${v.title}"
- Nama Channel / Kreator: "${v.channel}" (${v.channel_url || 'N/A'})
- Thumbnail: ${v.thumbnail}
(Data resmi real-time via YouTube oEmbed)`;
  }).join('\n\n');

  const groundingHeader = `\n\n### REAL-TIME YOUTUBE VIDEO GROUNDING DATA:\n${groundingBlocks}\n\nInstruksi untuk AI: Gunakan informasi metadata resmi di atas untuk menjawab dan menganalisis video YouTube yang ditanyakan pengguna secara tepat, akurat, dan tanpa halusinasi.\n`;

  return prompt + groundingHeader;
}

/**
 * ==============================================================================
 * METODE 2: TOOL SCHEMAS UNTUK FUNCTION CALLING MODEL
 * ==============================================================================
 */

// 1. Skema untuk Anthropic Claude
const YOUTUBE_TOOL_ANTHROPIC = {
  name: 'get_youtube_info',
  description: 'Mengambil judul, nama channel kreator, URL channel, dan thumbnail dari URL atau ID video YouTube resmi via oEmbed. Gunakan tool ini setiap kali pengguna menyertakan tautan YouTube atau menanyakan informasi mengenai video YouTube.',
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL lengkap video YouTube (contoh: https://youtu.be/... atau https://www.youtube.com/watch?v=...) atau ID video 11 karakter.'
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
    description: 'Mengambil judul, nama channel kreator, dan thumbnail dari video YouTube resmi menggunakan oEmbed.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL video YouTube (misal: https://youtu.be/...)'
        }
      },
      required: ['url']
    }
  }
};

// 3. Skema untuk Ollama
const YOUTUBE_TOOL_OLLAMA = YOUTUBE_TOOL_OPENAI;

// ==============================================================================
// CLI EXECUTION ENTRYPOINT
// ==============================================================================
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Penggunaan CLI Node.js:');
    console.log('  1. Ambil info video langsung:');
    console.log('     node youtube_tool.js https://youtu.be/tscOUFxV3qA');
    console.log('\n  2. Perkaya prompt untuk SEMUA MODEL (Universal):');
    console.log('     node youtube_tool.js --enrich "Apa isi video https://youtu.be/tscOUFxV3qA ini?"');
    process.exit(0);
  }

  (async () => {
    try {
      if (args[0] === '--enrich' && args.length > 1) {
        const promptInput = args.slice(1).join(' ');
        const enriched = await enrichPromptWithYouTube(promptInput);
        console.log('=== PROMPT TERKAYA UNTUK SEMUA MODEL (NODE.JS) ===');
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
  YOUTUBE_TOOL_ANTHROPIC,
  YOUTUBE_TOOL_OPENAI,
  YOUTUBE_TOOL_OLLAMA
};
