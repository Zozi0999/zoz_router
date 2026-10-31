'use strict';

/**
 * ZOZ ROUTER — Grounded Image Discovery, Verification & Asset Proxy Service
 *
 * Memisahkan secara tegas:
 * 1. Pencarian & pengambilan metadata kandidat gambar (searchImages)
 * 2. Inspeksi aksesibilitas biner, kecocokan subjek berbasis metadata, & lisensi (inspectImage)
 * 3. Persiapan payload aset terverifikasi & proxy streaming aman untuk UI renderer (prepareImageDisplay, streamVerifiedAsset)
 *
 * Keamanan Backend:
 * - Memisahkan SOURCE_PAGE_ALLOWLIST dan MEDIA_CDN_ALLOWLIST secara ketat (exact / dot-boundary subdomain, tanpa pencocokan substring).
 * - Wajib HTTPS port 443, memblokir URL berkredensial (username/password), literal IP, jaringan privat/loopback/CGNAT/link-local/metadata cloud.
 * - Resolusi DNS otoritatif & IP pinning pada setiap koneksi serta setiap lompatan redirect (maks 3 redirect).
 * - Batas ukuran unduhan (64 KB saat probe header; 8 MB saat streaming aset), batas waktu respons (8 detik), dan verifikasi magic-bytes (menolak SVG/HTML/script).
 * - Seluruh metadata eksternal diperlakukan sebagai teks tidak tepercaya (untrusted data).
 */

const https = require('node:https');
const crypto = require('node:crypto');
const dns = require('node:dns');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

const ALLOWED_SOURCES = Object.freeze([
  'pinterest',
  'unsplash',
  'pexels',
  'pixabay',
  'kaboompics',
  'wikimedia_commons'
]);

// 1. Allowlist Halaman Sumber (Terpisah dari Host Media/CDN)
const SOURCE_PAGE_ALLOWLIST = Object.freeze({
  pinterest: { exact: ['pinterest.com', 'www.pinterest.com'], suffixes: ['.pinterest.com'] },
  unsplash: { exact: ['unsplash.com', 'www.unsplash.com'], suffixes: [] },
  pexels: { exact: ['pexels.com', 'www.pexels.com'], suffixes: [] },
  pixabay: { exact: ['pixabay.com', 'www.pixabay.com'], suffixes: [] },
  kaboompics: { exact: ['kaboompics.com', 'www.kaboompics.com'], suffixes: [] },
  wikimedia_commons: { exact: ['commons.wikimedia.org'], suffixes: [] }
});

// 2. Allowlist Host Media / CDN Resmi Terverifikasi per Penyedia
const MEDIA_CDN_ALLOWLIST = Object.freeze({
  pinterest: { exact: ['i.pinimg.com'], suffixes: [] },
  unsplash: { exact: ['images.unsplash.com'], suffixes: [] },
  pexels: { exact: ['images.pexels.com'], suffixes: [] },
  pixabay: { exact: ['cdn.pixabay.com', 'pixabay.com'], suffixes: [] },
  kaboompics: { exact: ['kaboompics.com', 'www.kaboompics.com'], suffixes: [] },
  wikimedia_commons: { exact: ['upload.wikimedia.org', 'thumb.wikimedia.org'], suffixes: [] }
});

// Allowlist Endpoint API Resmi Penyedia untuk Koneksi Backend
const PROVIDER_API_ALLOWLIST = Object.freeze({
  wikimedia_commons: { exact: ['commons.wikimedia.org'], suffixes: [] },
  unsplash: { exact: ['api.unsplash.com'], suffixes: [] },
  pexels: { exact: ['api.pexels.com'], suffixes: [] },
  pixabay: { exact: ['pixabay.com'], suffixes: [] },
  pinterest: { exact: ['api.pinterest.com'], suffixes: [] }
});

// Allowlist Domain Lisensi & Profil Kreator Publik
const AUXILIARY_LINK_ALLOWLIST = Object.freeze({
  exact: [
    'creativecommons.org',
    'www.creativecommons.org',
    'commons.wikimedia.org',
    'wikimediafoundation.org',
    'unsplash.com',
    'www.unsplash.com',
    'pexels.com',
    'www.pexels.com',
    'pixabay.com',
    'www.pixabay.com',
    'pinterest.com',
    'www.pinterest.com',
    'kaboompics.com',
    'www.kaboompics.com',
    'gnu.org',
    'www.gnu.org',
    'artlibre.org'
  ],
  suffixes: ['.wikimedia.org', '.wikipedia.org', '.pinterest.com']
});

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]);

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_PROBE_BYTES = 64 * 1024;          // 64 KB untuk verifikasi header & dimensi
const MAX_ASSET_STREAM_BYTES = 8 * 1024 * 1024; // 8 MB batas unduhan proxy gambar
const MAX_API_JSON_BYTES = 2 * 1024 * 1024; // 2 MB batas respons JSON API penyedia
const CANDIDATE_TTL_MS = 2 * 60 * 60 * 1000; // 2 jam TTL cache kandidat di RAM
const STATELESS_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari masa berlaku token HMAC stateless untuk riwayat sesi
const MAX_CANDIDATE_CACHE = 600;
const MAX_DISPLAY_CACHE = 250;

const USER_AGENT = 'ZozRouterImageGrounding/1.0 (https://z21.zozdocs.com; ImageVerificationBot)';

// ==================== IP & DNS SSRF GUARDS ====================

function isPrivateOrReservedIPv4Local(ip) {
  if (!ip || typeof ip !== 'string') return true;
  let ipv4 = ip.trim();
  if (ipv4.toLowerCase().startsWith('::ffff:')) {
    ipv4 = ipv4.slice(7);
  }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ipv4)) return false;
  const parts = ipv4.split('.').map(Number);
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b, c, d] = parts;
  if (a === 0) return true;                             // 0.0.0.0/8
  if (a === 10) return true;                            // 10.0.0.0/8 RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true;    // 100.64.0.0/10 CGNAT
  if (a === 127) return true;                           // 127.0.0.0/8 Loopback
  if (a === 169 && b === 254) return true;              // 169.254.0.0/16 Link-local & Cloud Metadata
  if (a === 172 && b >= 16 && b <= 31) return true;     // 172.16.0.0/12 RFC1918
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 192 && b === 168) return true;              // 192.168.0.0/16 RFC1918
  if (a === 198 && (b === 18 || b === 19)) return true; // Benchmarking
  if (a === 198 && b === 51 && c === 100) return true;  // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true;   // TEST-NET-3
  if (a >= 224) return true;                            // Multicast / Reserved / Broadcast
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;
  return false;
}

function isPrivateOrReservedIPv6Local(ip) {
  if (!ip || typeof ip !== 'string') return true;
  let lower = ip.toLowerCase().trim();
  if (lower.startsWith('[') && lower.endsWith(']')) lower = lower.slice(1, -1);
  const zoneIdx = lower.indexOf('%');
  if (zoneIdx !== -1) lower = lower.slice(0, zoneIdx);

  if (lower === '::1' || lower === '::' || lower === '0:0:0:0:0:0:0:1' || lower === '0:0:0:0:0:0:0:0') return true;
  if (lower.startsWith('::ffff:')) {
    const tail = lower.slice(7);
    if (tail.includes('.')) return isPrivateOrReservedIPv4Local(tail);
    return true;
  }
  if (/^f[cd][0-9a-f]{0,2}:/i.test(lower)) return true;   // fc00::/7 Unique Local (termasuk AWS fd00:ec2::254)
  if (/^fe[89ab][0-9a-f]{0,2}:/i.test(lower)) return true; // fe80::/10 Link-Local
  if (lower.startsWith('2001:db8:') || lower.startsWith('2001:0db8:')) return true;
  if (lower.startsWith('ff')) return true;                // Multicast
  return false;
}

function isForbiddenIpAddress(ip) {
  const ver = net.isIP(ip);
  if (ver === 4) return isPrivateOrReservedIPv4Local(ip);
  if (ver === 6) return isPrivateOrReservedIPv6Local(ip);
  return true;
}

function matchesHostRule(hostname, rule) {
  if (!hostname || !rule) return false;
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (Array.isArray(rule.exact) && rule.exact.includes(host)) return true;
  if (Array.isArray(rule.suffixes)) {
    for (const suffix of rule.suffixes) {
      if (suffix && suffix.startsWith('.') && host.endsWith(suffix) && host.length > suffix.length) {
        return true;
      }
    }
  }
  return false;
}

// ==================== SANITASI METADATA TIDAK TEPERCAYA ====================

const HTML_ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '-',
  '&mdash;': '—',
  '&copy;': '©'
};

function sanitizeUntrustedText(raw, maxLen = 400) {
  if (raw === null || raw === undefined) return null;
  let text = String(raw);
  if (!text.trim()) return null;

  // Hapus komentar HTML, script/style tags, dan seluruh tag markup
  text = text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  // Decode entitas dasar tanpa mengeksekusi ulang sebagai HTML
  text = text.replace(/&(amp|lt|gt|quot|apos|nbsp|ndash|mdash|copy|#39);/gi, (m) => {
    const key = m.toLowerCase();
    return HTML_ENTITY_MAP[key] !== undefined ? HTML_ENTITY_MAP[key] : m;
  });
  text = text.replace(/&#(\d{1,4});/g, (_, dec) => {
    const code = parseInt(dec, 10);
    return (code >= 32 && code <= 126) ? String.fromCharCode(code) : ' ';
  });

  // Netralisasi pola prompt-injection & delimiter kontrol tool internal
  text = text
    .replace(/<\/?(?:tool_call|function_call|invoke|system|instruction)\b[^>]*>/gi, ' ')
    .replace(/\[\/?TOOL_CALLS\]/gi, ' ')
    .replace(/<<<\s*(?:END_)?ZOZ_[A-Z0-9_]+[\s\S]*?(?:>>>|$)/gi, ' ')
    .replace(/\b(?:ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?|disregard\s+system\s+prompt|you\s+are\s+now\s+in\s+developer\s+mode)\b/gi, '[redacted-untrusted-text]');

  // Hapus karakter kontrol ASCII
  text = text.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length > maxLen) {
    text = text.slice(0, maxLen - 1).trimEnd() + '…';
  }
  return text;
}

// ==================== DETEKSI MAGIC BYTES & DIMENSI GAMBAR BINER ====================

function sniffImageHeader(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) {
    return { valid: false, mimeType: null, dimensions: null, reason: 'Buffer gambar terlalu pendek atau kosong.' };
  }

  // Tolak tegas payload berbasis teks/script (SVG, HTML, XML, JSON)
  const headAscii = buf.subarray(0, Math.min(256, buf.length)).toString('utf8').trimStart().toLowerCase();
  if (
    headAscii.startsWith('<!doctype') ||
    headAscii.startsWith('<html') ||
    headAscii.startsWith('<svg') ||
    headAscii.startsWith('<?xml') ||
    headAscii.startsWith('<script')
  ) {
    return { valid: false, mimeType: null, dimensions: null, reason: 'Payload berbasis markup/script (HTML/SVG/XML) diblokir.' };
  }

  // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
    buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A
  ) {
    let dimensions = null;
    if (buf.length >= 24 && buf.subarray(12, 16).toString('ascii') === 'IHDR') {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0 && width <= 65535 && height <= 65535) {
        dimensions = { width, height };
      }
    }
    return { valid: true, mimeType: 'image/png', dimensions, reason: null };
  }

  // 2. JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    const dimensions = parseJpegDimensions(buf);
    return { valid: true, mimeType: 'image/jpeg', dimensions, reason: null };
  }

  // 3. GIF: GIF87a / GIF89a
  if (
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) {
    const width = buf.readUInt16LE(6);
    const height = buf.readUInt16LE(8);
    const dimensions = (width > 0 && height > 0) ? { width, height } : null;
    return { valid: true, mimeType: 'image/gif', dimensions, reason: null };
  }

  // 4. WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    const dimensions = parseWebpDimensions(buf);
    return { valid: true, mimeType: 'image/webp', dimensions, reason: null };
  }

  // 5. AVIF: ....ftypavif / ....ftypavis
  if (buf.length >= 16 && buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1') {
      return { valid: true, mimeType: 'image/avif', dimensions: null, reason: null };
    }
  }

  return { valid: false, mimeType: null, dimensions: null, reason: 'Magic bytes bukan format gambar raster yang diizinkan.' };
}

function parseJpegDimensions(buf) {
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xFF) {
      offset++;
      continue;
    }
    let marker = buf[offset + 1];
    while (marker === 0xFF && offset + 2 < buf.length) {
      offset++;
      marker = buf[offset + 1];
    }
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    if (offset + 4 >= buf.length) break;
    const segLen = buf.readUInt16BE(offset + 2);
    if (segLen < 2) break;

    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    const isSof = (
      (marker >= 0xC0 && marker <= 0xC3) ||
      (marker >= 0xC5 && marker <= 0xC7) ||
      (marker >= 0xC9 && marker <= 0xCB) ||
      (marker >= 0xCD && marker <= 0xCF)
    );
    if (isSof && offset + 9 <= buf.length) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    offset += 2 + segLen;
  }
  return null;
}

function parseWebpDimensions(buf) {
  if (buf.length < 30) return null;
  const chunkType = buf.subarray(12, 16).toString('ascii');
  if (chunkType === 'VP8X') {
    const width = 1 + buf.readUIntLE(24, 3);
    const height = 1 + buf.readUIntLE(27, 3);
    return (width > 0 && height > 0) ? { width, height } : null;
  }
  if (chunkType === 'VP8 ' && buf.length >= 30) {
    if (buf[23] === 0x9D && buf[24] === 0x01 && buf[25] === 0x2A) {
      const width = buf.readUInt16LE(26) & 0x3FFF;
      const height = buf.readUInt16LE(28) & 0x3FFF;
      return (width > 0 && height > 0) ? { width, height } : null;
    }
  }
  if (chunkType === 'VP8L' && buf.length >= 25 && buf[20] === 0x2F) {
    const b0 = buf[21];
    const b1 = buf[22];
    const b2 = buf[23];
    const b3 = buf[24];
    const width = 1 + (((b1 & 0x3F) << 8) | b0);
    const height = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
    return (width > 0 && height > 0) ? { width, height } : null;
  }
  return null;
}

// ==================== UTILITAS EVALUASI SUBJEK & ORIENTASI ====================

function computeOrientationMatches(width, height, requestedOrientation) {
  if (!requestedOrientation || requestedOrientation === 'any') return true;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return true;
  const ratio = width / height;
  if (requestedOrientation === 'landscape') return ratio > 1.08;
  if (requestedOrientation === 'portrait') return ratio < 0.92;
  if (requestedOrientation === 'square') return ratio >= 0.88 && ratio <= 1.14;
  return true;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'photo', 'image', 'picture', 'view',
  'foto', 'gambar', 'potret', 'ilustrasi', 'dari', 'yang', 'dan', 'untuk', 'pada', 'atau', 'di', 'ke'
]);

function extractQueryTokens(query) {
  if (!query || typeof query !== 'string') return [];
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

const NEGATIVE_SUBJECT_SPOOF_REGEX = /\b(impersonators?|look-?alikes?|parod(?:y|ies)|caricatures?|wax(?:work|\s+figures?)?|madame\s+tussauds|cosplay(?:ers?)?|memes?|cartoons?|satires?|puppets?|effig(?:y|ies))\b/i;

function evaluateSubjectMatch(candidate, query) {
  const rawQueryStr = String(query || candidate.search_query || '');
  const tokens = extractQueryTokens(rawQueryStr);
  const titleText = (candidate.title || '').toLowerCase();
  const descText = (candidate.description || '').toLowerCase();
  const catText = Array.isArray(candidate._categories) ? candidate._categories.join(' ').toLowerCase() : '';
  const combined = `${titleText} ${descText} ${catText}`.trim();

  if (combined && NEGATIVE_SUBJECT_SPOOF_REGEX.test(combined) && !NEGATIVE_SUBJECT_SPOOF_REGEX.test(rawQueryStr)) {
    return {
      subject_match: 'mismatch',
      match_basis: 'Metadata sumber mengindikasikan peniru (impersonator), parodi, karikatur, atau replika lilin, bukan subjek asli; ditolak demi keaslian identitas.'
    };
  }

  if (!combined || tokens.length === 0) {
    return {
      subject_match: 'uncertain',
      match_basis: 'Metadata kandidat terbatas atau kueri kosong; pemeriksaan visual piksel tidak dilakukan.'
    };
  }

  let titleHits = 0;
  let totalHits = 0;
  for (const tok of tokens) {
    if (titleText.includes(tok)) titleHits++;
    if (combined.includes(tok)) totalHits++;
  }

  const coverage = totalHits / tokens.length;
  const titleCoverage = titleHits / tokens.length;
  const isStockSource = ['unsplash', 'pexels', 'pixabay', 'kaboompics'].includes(candidate.source_name);

  if (totalHits === 0) {
    return {
      subject_match: 'mismatch',
      match_basis: `Tidak ada token subjek kueri (${tokens.join(', ')}) yang ditemukan pada judul maupun deskripsi metadata sumber; pemeriksaan visual piksel tidak dilakukan.`
    };
  }

  // Untuk sumber stok foto, jangan mengklaim "confirmed" pada subjek spesifik kecuali seluruh token cocok & bukan klaim dokumenter
  if (!isStockSource && coverage >= 0.85 && titleCoverage >= 0.5) {
    return {
      subject_match: 'confirmed',
      match_basis: `Kecocokan penuh (${totalHits}/${tokens.length} token subjek) terverifikasi pada judul/kategori metadata ${candidate.source_name}; pemeriksaan visual piksel tidak dilakukan.`
    };
  }

  if (coverage >= 0.6) {
    return {
      subject_match: 'likely',
      match_basis: `Sebagian besar kata kunci subjek (${totalHits}/${tokens.length} token) cocok pada metadata ${candidate.source_name}${isStockSource ? ' (sumber foto stok — cocok untuk ilustrasi umum, bukan bukti peristiwa/tokoh spesifik)' : ''}; pemeriksaan visual piksel tidak dilakukan.`
    };
  }

  return {
    subject_match: 'uncertain',
    match_basis: `Hanya ${totalHits}/${tokens.length} token subjek yang cocok pada metadata sumber; pemeriksaan visual piksel tidak dilakukan.`
  };
}

// ==================== FACTORY UTAMA SERVICE ====================

function createImageGroundingService(options = {}) {
  const env = options.env || process.env;
  const externalAssertResolvesPublic = typeof options.assertResolvesPublic === 'function'
    ? options.assertResolvesPublic
    : null;
  let persistentSecret = options.secret || env.ZOZ_IMAGE_PROXY_SECRET || '';
  if (!persistentSecret) {
    const secretPath = path.join(__dirname, 'data', 'image_proxy.secret');
    try {
      if (fs.existsSync(secretPath)) {
        persistentSecret = fs.readFileSync(secretPath, 'utf8').trim();
      } else {
        persistentSecret = crypto.randomBytes(32).toString('hex');
        fs.mkdirSync(path.dirname(secretPath), { recursive: true });
        fs.writeFileSync(secretPath, persistentSecret, 'utf8');
      }
    } catch (_) {
      persistentSecret = crypto.randomBytes(32).toString('hex');
    }
  }
  const hmacSecret = persistentSecret;

  // Konfigurasi tambahan host media tepercaya opsional (hanya dari konfigurasi backend eksplisit)
  const extraMediaHosts = options.extraTrustedMediaHostsBySource || {};

  const candidateStore = new Map(); // image_id -> candidate record
  const displayStore = new Map();   // display_id -> prepared display record
  const assetTokenStore = new Map(); // token -> { url, source_name, mime_type, created_at }

  function pruneMap(map, maxEntries, ttlMs) {
    const now = Date.now();
    for (const [k, v] of map.entries()) {
      if (v && v._createdAt && now - v._createdAt > ttlMs) {
        map.delete(k);
      }
    }
    while (map.size > maxEntries) {
      const oldestKey = map.keys().next().value;
      if (oldestKey === undefined) break;
      map.delete(oldestKey);
    }
  }

  function getMediaRuleForSource(sourceName) {
    const base = MEDIA_CDN_ALLOWLIST[sourceName];
    if (!base) return null;
    const extra = Array.isArray(extraMediaHosts[sourceName]) ? extraMediaHosts[sourceName] : [];
    if (extra.length === 0) return base;
    return {
      exact: [...new Set([...base.exact, ...extra.map((h) => String(h).toLowerCase().trim())])],
      suffixes: base.suffixes
    };
  }

  function validateStaticHttpsUrl(rawUrl, allowRule) {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { ok: false, code: 'invalid_image', reason: 'URL kosong atau bukan string.' };
    }
    let parsed;
    try {
      parsed = new URL(rawUrl.trim());
    } catch (_) {
      return { ok: false, code: 'invalid_image', reason: 'Format URL tidak valid.' };
    }
    if (parsed.protocol !== 'https:') {
      return { ok: false, code: 'access_denied', reason: 'Hanya skema HTTPS yang diizinkan.' };
    }
    if (parsed.username || parsed.password) {
      return { ok: false, code: 'access_denied', reason: 'URL berkredensial (username/password) diblokir.' };
    }
    if (parsed.port && parsed.port !== '443') {
      return { ok: false, code: 'access_denied', reason: 'Port non-standar HTTPS diblokir.' };
    }
    const host = (parsed.hostname || '').toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
    if (!host) {
      return { ok: false, code: 'invalid_image', reason: 'Hostname kosong.' };
    }
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.localhost') ||
      host === 'metadata.google.internal' ||
      host === 'instance-data'
    ) {
      return { ok: false, code: 'access_denied', reason: 'Hostname lokal/internal/metadata diblokir.' };
    }
    if (net.isIP(host)) {
      return { ok: false, code: 'access_denied', reason: 'Literal alamat IP tidak diizinkan; wajib hostname allowlist.' };
    }
    if (allowRule && !matchesHostRule(host, allowRule)) {
      return { ok: false, code: 'access_denied', reason: `Hostname "${host}" tidak termasuk dalam allowlist yang diizinkan.` };
    }
    return { ok: true, urlObj: parsed, normalizedUrl: parsed.toString(), host };
  }

  function sanitizeSourcePageUrl(rawUrl, sourceName) {
    const rule = SOURCE_PAGE_ALLOWLIST[sourceName];
    const check = validateStaticHttpsUrl(rawUrl, rule);
    return check.ok ? check.normalizedUrl : null;
  }

  function sanitizeMediaUrl(rawUrl, sourceName) {
    const rule = getMediaRuleForSource(sourceName);
    const check = validateStaticHttpsUrl(rawUrl, rule);
    return check.ok ? check.normalizedUrl : null;
  }

  function sanitizeAuxiliaryUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    let normalized = rawUrl.trim();
    if (normalized.startsWith('//')) normalized = 'https:' + normalized;
    if (normalized.startsWith('http://creativecommons.org/')) {
      normalized = 'https://' + normalized.slice('http://'.length);
    }
    const check = validateStaticHttpsUrl(normalized, AUXILIARY_LINK_ALLOWLIST);
    return check.ok ? check.normalizedUrl : null;
  }

  async function resolveAndVerifyPublicHost(urlStr, allowRule) {
    const staticCheck = validateStaticHttpsUrl(urlStr, allowRule);
    if (!staticCheck.ok) return staticCheck;

    const { host, urlObj, normalizedUrl } = staticCheck;

    if (externalAssertResolvesPublic) {
      const ext = await externalAssertResolvesPublic(normalizedUrl);
      if (!ext || !ext.ok) {
        return {
          ok: false,
          code: 'access_denied',
          reason: (ext && ext.msg) || 'Hostname gagal melewati validasi DNS publik.'
        };
      }
    }

    const [v4, v6] = await Promise.all([
      dns.promises.resolve4(host).catch(() => []),
      dns.promises.resolve6(host).catch(() => [])
    ]);

    const ips = [];
    for (const ip of v4) ips.push({ address: ip, family: 4 });
    for (const ip of v6) ips.push({ address: ip, family: 6 });

    if (ips.length === 0) {
      // Fallback dns.promises.lookup jika resolver langsung dibatasi jaringan lokal, tetap periksa seluruh IP
      const lookedUp = await dns.promises.lookup(host, { all: true }).catch(() => []);
      for (const entry of lookedUp) {
        if (entry && entry.address) {
          ips.push({ address: entry.address, family: entry.family || (net.isIP(entry.address) || 4) });
        }
      }
    }

    if (ips.length === 0) {
      return { ok: false, code: 'access_denied', reason: `Gagal meresolusi DNS publik untuk "${host}".` };
    }

    for (const item of ips) {
      if (isForbiddenIpAddress(item.address)) {
        return {
          ok: false,
          code: 'access_denied',
          reason: `Resolusi DNS "${host}" mengarah ke alamat IP privat/terlarang (${item.address}).`
        };
      }
    }

    return {
      ok: true,
      urlObj,
      normalizedUrl,
      host,
      pinnedIp: ips[0].address,
      pinnedFamily: ips[0].family
    };
  }

  /**
   * Koneksi HTTPS aman dengan:
   * - Validasi allowlist hostname di setiap redirect hop (maks 3 redirect)
   * - DNS resolution check + IP pinning anti-DNS-rebinding
   * - Timeout ketat & batas maksimum byte unduhan
   */
  async function secureHttpsFetch(rawUrl, fetchOpts = {}) {
    const {
      allowRule,
      headers = {},
      maxBytes = MAX_API_JSON_BYTES,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      maxRedirects = MAX_REDIRECTS,
      stopAfterBytes = null
    } = fetchOpts;

    let currentUrl = rawUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const verified = await resolveAndVerifyPublicHost(currentUrl, allowRule);
      if (!verified.ok) {
        return {
          ok: false,
          status: 0,
          code: verified.code || 'access_denied',
          error: verified.reason
        };
      }

      const hopResult = await new Promise((resolve) => {
        let settled = false;
        const done = (val) => {
          if (!settled) {
            settled = true;
            resolve(val);
          }
        };

        const req = https.request({
          protocol: 'https:',
          hostname: verified.host,
          port: 443,
          path: verified.urlObj.pathname + verified.urlObj.search,
          method: 'GET',
          servername: verified.host,
          lookup: (_hostname, lookupOpts, cb) => {
            if (lookupOpts && lookupOpts.all) {
              return cb(null, [{ address: verified.pinnedIp, family: verified.pinnedFamily }]);
            }
            return cb(null, verified.pinnedIp, verified.pinnedFamily);
          },
          headers: {
            'User-Agent': USER_AGENT,
            'Accept-Encoding': 'identity',
            ...headers
          },
          timeout: timeoutMs
        }, (res) => {
          const status = res.statusCode || 0;
          const resHeaders = res.headers || {};

          if ([301, 302, 303, 307, 308].includes(status)) {
            res.resume();
            const loc = resHeaders.location;
            if (!loc) {
              return done({ ok: false, status, code: 'invalid_image', error: 'Redirect tanpa header Location.' });
            }
            let nextUrl;
            try {
              nextUrl = new URL(loc, verified.normalizedUrl).toString();
            } catch (_) {
              return done({ ok: false, status, code: 'invalid_image', error: 'URL redirect tidak valid.' });
            }
            return done({ redirect: true, nextUrl, status });
          }

          const contentLength = resHeaders['content-length'] ? parseInt(resHeaders['content-length'], 10) : null;
          if (!stopAfterBytes && Number.isFinite(contentLength) && contentLength > maxBytes) {
            res.destroy();
            return done({
              ok: false,
              status,
              code: 'invalid_image',
              error: `Ukuran berkas (${contentLength} byte) melebihi batas keamanan (${maxBytes} byte).`
            });
          }

          const chunks = [];
          let totalBytes = 0;
          let truncatedIntentionally = false;

          res.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (stopAfterBytes && totalBytes >= stopAfterBytes) {
              chunks.push(chunk.subarray(0, chunk.length - (totalBytes - stopAfterBytes)));
              truncatedIntentionally = true;
              res.destroy();
              return done({
                ok: true,
                status,
                headers: resHeaders,
                buffer: Buffer.concat(chunks),
                finalUrl: verified.normalizedUrl,
                truncated: true
              });
            }
            if (totalBytes > maxBytes) {
              res.destroy();
              return done({
                ok: false,
                status,
                code: 'invalid_image',
                error: `Unduhan melampaui batas maksimum ${maxBytes} byte.`
              });
            }
            chunks.push(chunk);
          });

          res.on('end', () => {
            done({
              ok: status >= 200 && status < 300,
              status,
              headers: resHeaders,
              buffer: Buffer.concat(chunks),
              finalUrl: verified.normalizedUrl,
              truncated: truncatedIntentionally
            });
          });

          res.on('close', () => {
            if (truncatedIntentionally) return;
            done({
              ok: status >= 200 && status < 300 && chunks.length > 0,
              status,
              headers: resHeaders,
              buffer: Buffer.concat(chunks),
              finalUrl: verified.normalizedUrl,
              truncated: false
            });
          });

          res.on('error', (err) => {
            if (truncatedIntentionally) return;
            done({ ok: false, status, code: 'access_denied', error: err.message });
          });
        });

        req.on('timeout', () => {
          req.destroy();
          done({ ok: false, status: 0, code: 'access_denied', error: `Waktu koneksi habis (>${timeoutMs}ms).` });
        });

        req.on('error', (err) => {
          done({ ok: false, status: 0, code: 'access_denied', error: err.message });
        });

        req.end();
      });

      if (hopResult.redirect) {
        if (hop === maxRedirects) {
          return { ok: false, status: hopResult.status, code: 'access_denied', error: `Melebihi batas maksimum ${maxRedirects} redirect.` };
        }
        currentUrl = hopResult.nextUrl;
        continue;
      }

      return hopResult;
    }

    return { ok: false, status: 0, code: 'access_denied', error: 'Gagal menyelesaikan koneksi.' };
  }

  async function secureFetchProviderJson(apiUrl, sourceName, extraHeaders = {}) {
    const allowRule = PROVIDER_API_ALLOWLIST[sourceName];
    const res = await secureHttpsFetch(apiUrl, {
      allowRule,
      headers: {
        Accept: 'application/json',
        ...extraHeaders
      },
      maxBytes: MAX_API_JSON_BYTES,
      timeoutMs: DEFAULT_TIMEOUT_MS
    });

    if (!res.ok) {
      if (res.status === 401) {
        return { ok: false, code: 'authentication_required', message: `Autentikasi API ${sourceName} gagal (HTTP 401).` };
      }
      if (res.status === 429) {
        return { ok: false, code: 'rate_limited', message: `Batas kuota permintaan (rate limit) ${sourceName} tercapai (HTTP 429).` };
      }
      if (res.status === 403) {
        const rlRemaining = res.headers && (res.headers['x-ratelimit-remaining'] || res.headers['ratelimit-remaining']);
        if (rlRemaining === '0') {
          return { ok: false, code: 'rate_limited', message: `Kuota API ${sourceName} habis (rate-limit 0).` };
        }
        return { ok: false, code: 'access_denied', message: `Akses ke endpoint ${sourceName} ditolak (HTTP 403).` };
      }
      return {
        ok: false,
        code: res.code || 'access_denied',
        message: res.error || `Permintaan API ${sourceName} gagal dengan status HTTP ${res.status}.`
      };
    }

    try {
      const data = JSON.parse(res.buffer.toString('utf8'));
      return { ok: true, data };
    } catch (_) {
      return { ok: false, code: 'invalid_image', message: `Respons JSON dari ${sourceName} tidak valid.` };
    }
  }

  function registerCandidate(rawCandidate, query) {
    pruneMap(candidateStore, MAX_CANDIDATE_CACHE, CANDIDATE_TTL_MS);

    const hashSeed = `${rawCandidate.source_name}|${rawCandidate.source_page_url}|${rawCandidate.image_url || rawCandidate.preview_url || ''}`;
    const shortHash = crypto.createHash('sha256').update(hashSeed).digest('hex').slice(0, 14);
    const prefixMap = {
      wikimedia_commons: 'wmc',
      unsplash: 'uns',
      pexels: 'pex',
      pixabay: 'pix',
      pinterest: 'pin',
      kaboompics: 'kab'
    };
    const image_id = rawCandidate._customImageId || `img_${prefixMap[rawCandidate.source_name] || 'src'}_${shortHash}`;

    const candidate = {
      image_id,
      title: sanitizeUntrustedText(rawCandidate.title, 220),
      description: sanitizeUntrustedText(rawCandidate.description, 500),
      source_name: rawCandidate.source_name,
      source_page_url: rawCandidate.source_page_url,
      preview_url: rawCandidate.preview_url || null,
      image_url: rawCandidate.image_url || null,
      creator: sanitizeUntrustedText(rawCandidate.creator, 140),
      creator_url: sanitizeAuxiliaryUrl(rawCandidate.creator_url),
      license_name: sanitizeUntrustedText(rawCandidate.license_name, 120),
      license_url: sanitizeAuxiliaryUrl(rawCandidate.license_url),
      attribution_text: sanitizeUntrustedText(rawCandidate.attribution_text, 320),
      width: Number.isInteger(rawCandidate.width) && rawCandidate.width > 0 ? rawCandidate.width : null,
      height: Number.isInteger(rawCandidate.height) && rawCandidate.height > 0 ? rawCandidate.height : null,
      // Properti internal backend (tidak diekspos mentah jika tidak diminta)
      _categories: Array.isArray(rawCandidate._categories) ? rawCandidate._categories : [],
      _mediaCategory: rawCandidate._mediaCategory || 'unknown',
      _requiresProxy: Boolean(rawCandidate._requiresProxy),
      _unsplashDownloadLocation: rawCandidate._unsplashDownloadLocation || null,
      _searchQuery: query || '',
      _inspection: null,
      _createdAt: Date.now()
    };

    candidateStore.set(image_id, candidate);
    return candidate;
  }

  function toPublicCandidateMetadata(c) {
    return {
      image_id: c.image_id,
      title: c.title,
      description: c.description,
      source_name: c.source_name,
      source_page_url: c.source_page_url,
      preview_url: c.preview_url,
      image_url: c.image_url,
      creator: c.creator,
      creator_url: c.creator_url,
      license_name: c.license_name,
      license_url: c.license_url,
      attribution_text: c.attribution_text,
      width: c.width,
      height: c.height
    };
  }

  // ==================== ADAPTER PENYEDIA RESMI ====================

  // 1. Wikimedia Commons (API Resmi MediaWiki Action API — Tanpa API Key)
  async function searchWikimediaCommons({ query, limit, orientation, image_type }) {
    const fetchCount = Math.min(40, Math.max(12, limit * 3));
    let gsrsearch = query.trim();
    if (image_type === 'photo') {
      gsrsearch += ' filetype:bitmap';
    } else if (image_type === 'illustration') {
      gsrsearch += ' filetype:drawing';
    }
    // Catatan: Untuk 'any', jangan tambahkan akhiran filetype apapun karena MediaWiki CirrusSearch
    // pada generator=search gagal mengurai sintaks grouping kurung/OR '(filetype:bitmap OR filetype:drawing)'
    // sehingga menghasilkan 0 halaman. gsrnamespace=6 sudah membatasi hasil khusus berkas media.

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

    const apiUrl = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
    const res = await secureFetchProviderJson(apiUrl, 'wikimedia_commons');
    if (!res.ok) {
      return { images: [], error: { source: 'wikimedia_commons', code: res.code, message: res.message } };
    }

    const pagesObj = res.data && res.data.query && res.data.query.pages ? res.data.query.pages : null;
    if (!pagesObj) {
      return { images: [], error: null };
    }

    const pages = Object.values(pagesObj).sort((a, b) => (a.index ?? 999999) - (b.index ?? 999999));
    const queryAllowsSpoof = NEGATIVE_SUBJECT_SPOOF_REGEX.test(query);
    const rawCandidates = [];

    for (const page of pages) {
      const ii = Array.isArray(page.imageinfo) && page.imageinfo[0] ? page.imageinfo[0] : null;
      if (!ii) continue;

      const rawMime = String(ii.mime || '').toLowerCase();
      // Jika file asli adalah SVG, gunakan PNG thumbnail raster dari upload.wikimedia.org; lewati video/audio/dokumen
      const isSvg = rawMime === 'image/svg+xml';
      if (!ALLOWED_IMAGE_MIME_TYPES.has(rawMime) && !isSvg) continue;
      if (image_type === 'photo' && isSvg) continue;

      const sourcePageUrl = sanitizeSourcePageUrl(ii.descriptionurl, 'wikimedia_commons');
      if (!sourcePageUrl) continue;

      const previewUrl = sanitizeMediaUrl(ii.thumburl || (!isSvg ? ii.url : null), 'wikimedia_commons');
      const fullRasterUrl = isSvg
        ? previewUrl
        : sanitizeMediaUrl(ii.url || ii.thumburl, 'wikimedia_commons');

      if (!fullRasterUrl && !previewUrl) continue;

      const width = Number.isInteger(ii.thumbwidth) && isSvg ? ii.thumbwidth : (Number.isInteger(ii.width) ? ii.width : null);
      const height = Number.isInteger(ii.thumbheight) && isSvg ? ii.thumbheight : (Number.isInteger(ii.height) ? ii.height : null);

      if (!computeOrientationMatches(width, height, orientation)) continue;

      const ext = ii.extmetadata || {};
      const cleanTitle = sanitizeUntrustedText(
        (ext.ObjectName && ext.ObjectName.value) || String(page.title || '').replace(/^File:/i, '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' '),
        220
      );
      const description = sanitizeUntrustedText(ext.ImageDescription && ext.ImageDescription.value, 500);
      const creator = sanitizeUntrustedText(ext.Artist && ext.Artist.value, 140);
      const licenseName = sanitizeUntrustedText(
        (ext.LicenseShortName && ext.LicenseShortName.value) || (ext.UsageTerms && ext.UsageTerms.value),
        120
      );
      const licenseUrl = sanitizeAuxiliaryUrl(ext.LicenseUrl && ext.LicenseUrl.value);

      const categories = Array.isArray(page.categories)
        ? page.categories.map((c) => String(c.title || '').replace(/^Category:/i, ''))
        : [];
      const joinedMeta = `${cleanTitle || ''} ${categories.join(' ')} ${description || ''}`;
      if (!queryAllowsSpoof && NEGATIVE_SUBJECT_SPOOF_REGEX.test(joinedMeta)) {
        continue;
      }

      const joinedCats = joinedMeta.toLowerCase();
      let mediaCategory = 'documentary_photo';
      if (/\b(ai-generated|artificial intelligence|midjourney|stable diffusion|dall-e)\b/i.test(joinedCats)) {
        mediaCategory = 'ai_generated';
      } else if (isSvg || /\b(diagrams?|illustrations?|icons?|maps?|coats of arms|charts?)\b/i.test(joinedCats)) {
        mediaCategory = 'illustration';
      } else if (/\b(paintings?|sculptures?|drawings?|engravings?|artworks?)\b/i.test(joinedCats)) {
        mediaCategory = 'artwork';
      }

      const creditParts = [];
      if (creator) creditParts.push(`Foto/Karya: ${creator}`);
      creditParts.push('Wikimedia Commons');
      if (licenseName) creditParts.push(`(${licenseName})`);
      const attributionText = creditParts.join(' — ');

      const qTokens = extractQueryTokens(query);
      const titleLower = String(cleanTitle || '').toLowerCase();
      let titleHitScore = 0;
      for (const qt of qTokens) {
        if (titleLower.includes(qt)) titleHitScore += 1;
      }
      const rankScore = (qTokens.length > 0 ? (titleHitScore / qTokens.length) * 100 : 0) - ((page.index ?? 999) * 0.5);

      rawCandidates.push({
        rankScore,
        payload: {
          title: cleanTitle,
          description,
          source_name: 'wikimedia_commons',
          source_page_url: sourcePageUrl,
          preview_url: previewUrl,
          image_url: fullRasterUrl,
          creator,
          creator_url: null,
          license_name: licenseName,
          license_url: licenseUrl,
          attribution_text: attributionText,
          width,
          height,
          _categories: categories,
          _mediaCategory: mediaCategory,
          _requiresProxy: true
        }
      });
    }

    rawCandidates.sort((a, b) => b.rankScore - a.rankScore);
    const candidates = rawCandidates.slice(0, limit).map((item) => registerCandidate(item.payload, query));

    return { images: candidates, error: null };
  }

  // 2. Unsplash (Official REST API — Memerlukan UNSPLASH_ACCESS_KEY)
  async function searchUnsplash({ query, limit, orientation, safe_search }) {
    const accessKey = String(env.UNSPLASH_ACCESS_KEY || '').trim();
    if (!accessKey) {
      return {
        images: [],
        error: {
          source: 'unsplash',
          code: 'authentication_required',
          message: 'UNSPLASH_ACCESS_KEY belum dikonfigurasi pada environment backend.'
        }
      };
    }

    const params = new URLSearchParams({
      query: query.trim(),
      per_page: String(Math.min(20, Math.max(1, limit))),
      content_filter: safe_search === false ? 'low' : 'high'
    });
    if (orientation === 'landscape' || orientation === 'portrait') {
      params.set('orientation', orientation);
    } else if (orientation === 'square') {
      params.set('orientation', 'squarish');
    }

    const apiUrl = `https://api.unsplash.com/search/photos?${params.toString()}`;
    const res = await secureFetchProviderJson(apiUrl, 'unsplash', {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1'
    });

    if (!res.ok) {
      return { images: [], error: { source: 'unsplash', code: res.code, message: res.message } };
    }

    const results = Array.isArray(res.data && res.data.results) ? res.data.results : [];
    const candidates = [];

    for (const item of results) {
      if (candidates.length >= limit) break;
      const rawPage = item?.links?.html ? `${item.links.html}${item.links.html.includes('?') ? '&' : '?'}utm_source=zoz_router&utm_medium=referral` : null;
      const sourcePageUrl = sanitizeSourcePageUrl(rawPage, 'unsplash');
      const previewUrl = sanitizeMediaUrl(item?.urls?.small, 'unsplash');
      const imageUrl = sanitizeMediaUrl(item?.urls?.regular, 'unsplash');
      if (!sourcePageUrl || (!imageUrl && !previewUrl)) continue;

      const creator = sanitizeUntrustedText(item?.user?.name, 140);
      const rawCreatorUrl = item?.user?.links?.html
        ? `${item.user.links.html}${item.user.links.html.includes('?') ? '&' : '?'}utm_source=zoz_router&utm_medium=referral`
        : null;

      const registered = registerCandidate({
        title: sanitizeUntrustedText(item.description || item.alt_description, 220),
        description: sanitizeUntrustedText(item.alt_description || item.description, 500),
        source_name: 'unsplash',
        source_page_url: sourcePageUrl,
        preview_url: previewUrl,
        image_url: imageUrl,
        creator,
        creator_url: rawCreatorUrl,
        license_name: 'Unsplash License',
        license_url: 'https://unsplash.com/license',
        attribution_text: creator ? `Foto oleh ${creator} di Unsplash` : 'Foto dari Unsplash',
        width: Number.isInteger(item.width) ? item.width : null,
        height: Number.isInteger(item.height) ? item.height : null,
        _categories: [],
        _mediaCategory: 'stock_photo',
        _requiresProxy: false, // Ketentuan API Unsplash mewajibkan hotlinking ke images.unsplash.com
        _unsplashDownloadLocation: item?.links?.download_location || null
      }, query);

      candidates.push(registered);
    }

    return { images: candidates, error: null };
  }

  // 3. Pexels (Official REST API — Memerlukan PEXELS_API_KEY)
  async function searchPexels({ query, limit, orientation }) {
    const apiKey = String(env.PEXELS_API_KEY || '').trim();
    if (!apiKey) {
      return {
        images: [],
        error: {
          source: 'pexels',
          code: 'authentication_required',
          message: 'PEXELS_API_KEY belum dikonfigurasi pada environment backend.'
        }
      };
    }

    const params = new URLSearchParams({
      query: query.trim(),
      per_page: String(Math.min(20, Math.max(1, limit)))
    });
    if (['landscape', 'portrait', 'square'].includes(orientation)) {
      params.set('orientation', orientation);
    }

    const apiUrl = `https://api.pexels.com/v1/search?${params.toString()}`;
    const res = await secureFetchProviderJson(apiUrl, 'pexels', {
      Authorization: apiKey
    });

    if (!res.ok) {
      return { images: [], error: { source: 'pexels', code: res.code, message: res.message } };
    }

    const photos = Array.isArray(res.data && res.data.photos) ? res.data.photos : [];
    const candidates = [];

    for (const p of photos) {
      if (candidates.length >= limit) break;
      const sourcePageUrl = sanitizeSourcePageUrl(p?.url, 'pexels');
      const previewUrl = sanitizeMediaUrl(p?.src?.medium, 'pexels');
      const imageUrl = sanitizeMediaUrl(p?.src?.large2x || p?.src?.large, 'pexels');
      if (!sourcePageUrl || (!imageUrl && !previewUrl)) continue;

      const creator = sanitizeUntrustedText(p.photographer, 140);
      const registered = registerCandidate({
        title: sanitizeUntrustedText(p.alt, 220),
        description: sanitizeUntrustedText(p.alt, 500),
        source_name: 'pexels',
        source_page_url: sourcePageUrl,
        preview_url: previewUrl,
        image_url: imageUrl,
        creator,
        creator_url: p.photographer_url || null,
        license_name: 'Pexels License',
        license_url: 'https://www.pexels.com/license/',
        attribution_text: creator ? `Foto oleh ${creator} di Pexels` : 'Foto dari Pexels',
        width: Number.isInteger(p.width) ? p.width : null,
        height: Number.isInteger(p.height) ? p.height : null,
        _categories: [],
        _mediaCategory: 'stock_photo',
        _requiresProxy: true
      }, query);

      candidates.push(registered);
    }

    return { images: candidates, error: null };
  }

  // 4. Pixabay (Official REST API — Memerlukan PIXABAY_API_KEY)
  async function searchPixabay({ query, limit, orientation, image_type, safe_search }) {
    const apiKey = String(env.PIXABAY_API_KEY || '').trim();
    if (!apiKey) {
      return {
        images: [],
        error: {
          source: 'pixabay',
          code: 'authentication_required',
          message: 'PIXABAY_API_KEY belum dikonfigurasi pada environment backend.'
        }
      };
    }

    const perPage = Math.min(20, Math.max(3, limit)); // Pixabay mewajibkan per_page >= 3
    const params = new URLSearchParams({
      key: apiKey,
      q: query.trim().slice(0, 100),
      image_type: image_type === 'photo' ? 'photo' : (image_type === 'illustration' ? 'illustration' : 'all'),
      safesearch: safe_search === false ? 'false' : 'true',
      per_page: String(perPage)
    });
    if (orientation === 'landscape') params.set('orientation', 'horizontal');
    else if (orientation === 'portrait') params.set('orientation', 'vertical');

    const apiUrl = `https://pixabay.com/api/?${params.toString()}`;
    const res = await secureFetchProviderJson(apiUrl, 'pixabay');
    if (!res.ok) {
      return { images: [], error: { source: 'pixabay', code: res.code, message: res.message } };
    }

    const hits = Array.isArray(res.data && res.data.hits) ? res.data.hits : [];
    const candidates = [];

    for (const h of hits) {
      if (candidates.length >= limit) break;
      const w = Number.isInteger(h.imageWidth) ? h.imageWidth : null;
      const ht = Number.isInteger(h.imageHeight) ? h.imageHeight : null;
      if (!computeOrientationMatches(w, ht, orientation)) continue;

      const sourcePageUrl = sanitizeSourcePageUrl(h.pageURL, 'pixabay');
      const previewUrl = sanitizeMediaUrl(h.previewURL, 'pixabay');
      const imageUrl = sanitizeMediaUrl(h.webformatURL || h.largeImageURL, 'pixabay');
      if (!sourcePageUrl || (!imageUrl && !previewUrl)) continue;

      const creator = sanitizeUntrustedText(h.user, 140);
      const creatorUrl = h.user && h.user_id ? `https://pixabay.com/users/${encodeURIComponent(h.user)}-${encodeURIComponent(h.user_id)}/` : null;
      const tags = sanitizeUntrustedText(h.tags, 220);

      const registered = registerCandidate({
        title: tags,
        description: tags ? `Tag Pixabay: ${tags}` : null,
        source_name: 'pixabay',
        source_page_url: sourcePageUrl,
        preview_url: previewUrl,
        image_url: imageUrl,
        creator,
        creator_url: creatorUrl,
        license_name: 'Pixabay Content License',
        license_url: 'https://pixabay.com/service/license-summary/',
        attribution_text: creator ? `Gambar oleh ${creator} di Pixabay` : 'Gambar dari Pixabay',
        width: w,
        height: ht,
        _categories: tags ? tags.split(',').map((t) => t.trim()) : [],
        _mediaCategory: h.type === 'illustration' || h.type === 'vector/svg' ? 'illustration' : 'stock_photo',
        _requiresProxy: true // URL gambar Pixabay API kedaluwarsa setelah 24 jam & hotlinking langsung dilarang
      }, query);

      candidates.push(registered);
    }

    return { images: candidates, error: null };
  }

  // 5. Pinterest (Official API v5 — Memerlukan PINTEREST_ACCESS_TOKEN OAuth2)
  async function searchPinterest({ query, limit }) {
    const accessToken = String(env.PINTEREST_ACCESS_TOKEN || '').trim();
    if (!accessToken) {
      return {
        images: [],
        error: {
          source: 'pinterest',
          code: 'authentication_required',
          message: 'PINTEREST_ACCESS_TOKEN (OAuth2 API v5) belum dikonfigurasi pada backend; scraping langsung tidak dilakukan.'
        }
      };
    }

    const params = new URLSearchParams({
      query: query.trim(),
      page_size: String(Math.min(20, Math.max(1, limit)))
    });
    const apiUrl = `https://api.pinterest.com/v5/search/pins?${params.toString()}`;
    const res = await secureFetchProviderJson(apiUrl, 'pinterest', {
      Authorization: `Bearer ${accessToken}`
    });

    if (!res.ok) {
      return { images: [], error: { source: 'pinterest', code: res.code, message: res.message } };
    }

    const items = Array.isArray(res.data && res.data.items) ? res.data.items : [];
    const candidates = [];

    for (const pin of items) {
      if (candidates.length >= limit) break;
      const pinId = pin && pin.id ? String(pin.id).replace(/[^0-9a-zA-Z_-]/g, '') : '';
      if (!pinId) continue;

      const sourcePageUrl = sanitizeSourcePageUrl(`https://www.pinterest.com/pin/${pinId}/`, 'pinterest');
      const imagesMap = pin?.media?.images || {};
      const orig = imagesMap['1200x'] || imagesMap['600x'] || imagesMap.originals || null;
      const thumb = imagesMap['400x300'] || imagesMap['150x150'] || orig;
      const previewUrl = sanitizeMediaUrl(thumb && thumb.url, 'pinterest');
      const imageUrl = sanitizeMediaUrl(orig && orig.url, 'pinterest');
      if (!sourcePageUrl || (!imageUrl && !previewUrl)) continue;

      const registered = registerCandidate({
        title: sanitizeUntrustedText(pin.title || pin.alt_text, 220),
        description: sanitizeUntrustedText(pin.description || pin.alt_text, 500),
        source_name: 'pinterest',
        source_page_url: sourcePageUrl,
        preview_url: previewUrl,
        image_url: imageUrl,
        creator: sanitizeUntrustedText(pin.board_owner && pin.board_owner.username, 140),
        creator_url: null,
        license_name: null, // Pin Pinterest tidak menyertakan lisensi terbuka standar secara otomatis
        license_url: null,
        attribution_text: null,
        width: orig && Number.isInteger(orig.width) ? orig.width : null,
        height: orig && Number.isInteger(orig.height) ? orig.height : null,
        _categories: [],
        _mediaCategory: 'unknown',
        _requiresProxy: true
      }, query);

      candidates.push(registered);
    }

    return { images: candidates, error: null };
  }

  // 6. Kaboompics (Status Jujur: Tidak Menyediakan REST API Publik Resmi)
  async function searchKaboompics() {
    return {
      images: [],
      error: {
        source: 'kaboompics',
        code: 'access_denied',
        message: 'Kaboompics (https://kaboompics.com/) tidak menyediakan endpoint REST API publik resmi untuk pencarian terprogram; akses scraping otomatis dinonaktifkan sesuai kebijakan penyedia.'
      }
    };
  }

  // ==================== IMPLEMENTASI 3 TOOL UTAMA ====================

  function normalizeSourceEnum(rawSource) {
    if (!rawSource) return null;
    const s = String(rawSource).toLowerCase().trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '');
    if (s === 'pinterest' || s === 'pinterest.com') return 'pinterest';
    if (s === 'unsplash' || s === 'unsplash.com') return 'unsplash';
    if (s === 'pexels' || s === 'pexels.com') return 'pexels';
    if (s === 'pixabay' || s === 'pixabay.com') return 'pixabay';
    if (s === 'kaboompics' || s === 'kaboompics.com') return 'kaboompics';
    if (s === 'wikimedia_commons' || s === 'commons.wikimedia.org' || s === 'wikimedia' || s === 'commons') return 'wikimedia_commons';
    return null;
  }

  /**
   * TOOL 1: search_images
   */
  async function searchImages(params = {}) {
    const query = typeof params.query === 'string' ? params.query.trim() : '';
    if (!query) {
      return {
        status: 'error',
        images: [],
        source_errors: [{ source: 'request', code: 'invalid_query', message: 'Parameter "query" wajib diisi dan tidak boleh kosong.' }]
      };
    }

    const rawLimit = params.limit !== undefined ? parseInt(params.limit, 10) : 6;
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(20, rawLimit)) : 6;
    const orientation = ['any', 'landscape', 'portrait', 'square'].includes(params.orientation) ? params.orientation : 'any';
    const image_type = ['photo', 'illustration', 'any'].includes(params.image_type) ? params.image_type : 'any';
    const safe_search = params.safe_search !== false;

    const source_errors = [];
    let targetSources = [];

    if (Array.isArray(params.sources) && params.sources.length > 0) {
      for (const raw of params.sources) {
        const norm = normalizeSourceEnum(raw);
        if (norm && ALLOWED_SOURCES.includes(norm)) {
          if (!targetSources.includes(norm)) targetSources.push(norm);
        } else {
          source_errors.push({
            source: String(raw),
            code: 'access_denied',
            message: `Sumber "${String(raw)}" tidak termasuk dalam daftar 6 sumber yang diizinkan.`
          });
        }
      }
      if (targetSources.length === 0) {
        return {
          status: 'error',
          images: [],
          source_errors
        };
      }
    } else {
      // Pilih otomatis sumber yang relevan & memiliki kredensial aktif tanpa memaksakan semua 6 sumber
      targetSources = ['wikimedia_commons'];
      if (env.UNSPLASH_ACCESS_KEY) targetSources.push('unsplash');
      if (env.PEXELS_API_KEY) targetSources.push('pexels');
      if (env.PIXABAY_API_KEY) targetSources.push('pixabay');
    }

    const perSourceLimit = Math.max(2, Math.min(20, Math.ceil(limit / Math.max(1, targetSources.length)) + 2));

    const adapterMap = {
      wikimedia_commons: () => searchWikimediaCommons({ query, limit: perSourceLimit, orientation, image_type, safe_search }),
      unsplash: () => searchUnsplash({ query, limit: perSourceLimit, orientation, image_type, safe_search }),
      pexels: () => searchPexels({ query, limit: perSourceLimit, orientation, image_type, safe_search }),
      pixabay: () => searchPixabay({ query, limit: perSourceLimit, orientation, image_type, safe_search }),
      pinterest: () => searchPinterest({ query, limit: perSourceLimit, orientation, image_type, safe_search }),
      kaboompics: () => searchKaboompics({ query, limit: perSourceLimit, orientation, image_type, safe_search })
    };

    const settled = await Promise.all(
      targetSources.map(async (src) => {
        try {
          const fn = adapterMap[src];
          return await fn();
        } catch (err) {
          return {
            images: [],
            error: {
              source: src,
              code: 'access_denied',
              message: err && err.message ? err.message : `Gagal memanggil sumber ${src}.`
            }
          };
        }
      })
    );

    const combinedCandidates = [];
    let succeededSources = 0;

    for (const res of settled) {
      if (res.error) {
        source_errors.push(res.error);
      } else {
        succeededSources++;
      }
      if (Array.isArray(res.images) && res.images.length > 0) {
        combinedCandidates.push(...res.images);
      }
    }

    const finalImages = combinedCandidates.slice(0, limit).map(toPublicCandidateMetadata);

    let status = 'success';
    if (finalImages.length === 0) {
      status = succeededSources > 0 ? 'no_results' : 'error';
    } else if (source_errors.length > 0) {
      status = 'partial';
    }

    return {
      status,
      images: finalImages,
      source_errors
    };
  }

  async function hydrateWikimediaCandidateByPageId(imageId) {
    const match = typeof imageId === 'string' ? imageId.match(/^img_wmc_(\d+)$/) : null;
    if (!match) return null;
    const pageId = match[1];
    const params = new URLSearchParams({
      action: 'query',
      pageids: pageId,
      prop: 'imageinfo|categories',
      cllimit: '15',
      iiprop: 'url|size|mime|mediatype|extmetadata',
      iiurlwidth: '960',
      format: 'json'
    });
    const apiUrl = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
    const res = await secureFetchProviderJson(apiUrl, 'wikimedia_commons').catch(() => null);
    if (!res || !res.ok || !res.data?.query?.pages) return null;
    const page = res.data.query.pages[pageId];
    const ii = page && Array.isArray(page.imageinfo) && page.imageinfo[0] ? page.imageinfo[0] : null;
    if (!ii) return null;

    const rawMime = String(ii.mime || '').toLowerCase();
    const isSvg = rawMime === 'image/svg+xml';
    if (!ALLOWED_IMAGE_MIME_TYPES.has(rawMime) && !isSvg) return null;

    const sourcePageUrl = sanitizeSourcePageUrl(ii.descriptionurl, 'wikimedia_commons');
    const previewUrl = sanitizeMediaUrl(ii.thumburl || (!isSvg ? ii.url : null), 'wikimedia_commons');
    const fullRasterUrl = isSvg ? previewUrl : sanitizeMediaUrl(ii.url || ii.thumburl, 'wikimedia_commons');
    if (!sourcePageUrl || (!fullRasterUrl && !previewUrl)) return null;

    const ext = ii.extmetadata || {};
    const cleanTitle = sanitizeUntrustedText(
      (ext.ObjectName && ext.ObjectName.value) || String(page.title || '').replace(/^File:/i, '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' '),
      220
    );
    const description = sanitizeUntrustedText(ext.ImageDescription && ext.ImageDescription.value, 500);
    const creator = sanitizeUntrustedText(ext.Artist && ext.Artist.value, 140);
    const licenseName = sanitizeUntrustedText(
      (ext.LicenseShortName && ext.LicenseShortName.value) || (ext.UsageTerms && ext.UsageTerms.value),
      120
    );
    const licenseUrl = sanitizeAuxiliaryUrl(ext.LicenseUrl && ext.LicenseUrl.value);
    const categories = Array.isArray(page.categories)
      ? page.categories.map((c) => String(c.title || '').replace(/^Category:/i, ''))
      : [];
    const creditParts = [];
    if (creator) creditParts.push(`Foto/Karya: ${creator}`);
    creditParts.push('Wikimedia Commons');
    if (licenseName) creditParts.push(`(${licenseName})`);

    return registerCandidate({
      _customImageId: imageId,
      title: cleanTitle,
      description,
      source_name: 'wikimedia_commons',
      source_page_url: sourcePageUrl,
      preview_url: previewUrl,
      image_url: fullRasterUrl,
      creator,
      creator_url: null,
      license_name: licenseName,
      license_url: licenseUrl,
      attribution_text: creditParts.join(' — '),
      width: Number.isInteger(ii.width) ? ii.width : null,
      height: Number.isInteger(ii.height) ? ii.height : null,
      _categories: categories,
      _mediaCategory: 'documentary_photo',
      _requiresProxy: true
    }, cleanTitle || '');
  }

  /**
   * TOOL 2: inspect_image
   */
  async function inspectImage(params = {}) {
    const image_id = typeof params.image_id === 'string' ? params.image_id.trim() : '';
    if (!image_id) {
      return {
        image_id: '',
        accessible: false,
        mime_type: null,
        dimensions: null,
        subject_match: 'uncertain',
        match_basis: 'Parameter image_id kosong; pemeriksaan visual tidak dilakukan.',
        usage_status: 'unknown',
        attribution_text: null,
        warnings: ['invalid_image: image_id wajib diisi.']
      };
    }

    let candidate = candidateStore.get(image_id);
    if (!candidate && /^img_wmc_\d+$/.test(image_id)) {
      candidate = await hydrateWikimediaCandidateByPageId(image_id);
    }
    if (!candidate) {
      return {
        image_id,
        accessible: false,
        mime_type: null,
        dimensions: null,
        subject_match: 'uncertain',
        match_basis: 'Kandidat image_id tidak ditemukan di sesi backend (mungkin belum dicari melalui search_images atau telah kedaluwarsa); pemeriksaan visual tidak dilakukan.',
        usage_status: 'unknown',
        attribution_text: null,
        warnings: ['invalid_image: image_id tidak terdaftar.']
      };
    }

    const warnings = [];
    const targetUrl = (candidate.source_name === 'wikimedia_commons' && candidate.preview_url)
      ? candidate.preview_url
      : (candidate.image_url || candidate.preview_url);
    const mediaAllowRule = getMediaRuleForSource(candidate.source_name);

    let accessible = false;
    let verifiedMime = null;
    let verifiedDimensions = (candidate.width && candidate.height)
      ? { width: candidate.width, height: candidate.height }
      : null;

    if (!targetUrl) {
      warnings.push('invalid_image: Kandidat tidak memiliki URL media yang diizinkan.');
    } else {
      const probeRes = await secureHttpsFetch(targetUrl, {
        allowRule: mediaAllowRule,
        headers: {
          Range: `bytes=0-${MAX_PROBE_BYTES - 1}`,
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.1'
        },
        maxBytes: MAX_ASSET_STREAM_BYTES,
        stopAfterBytes: MAX_PROBE_BYTES,
        timeoutMs: DEFAULT_TIMEOUT_MS
      });

      if (!probeRes.ok && !(probeRes.status === 206 && probeRes.buffer && probeRes.buffer.length > 0)) {
        warnings.push(`invalid_image: Gagal mengakses berkas gambar (${probeRes.error || `HTTP ${probeRes.status}`}).`);
      } else {
        const sniffed = sniffImageHeader(probeRes.buffer);
        if (!sniffed.valid || !ALLOWED_IMAGE_MIME_TYPES.has(sniffed.mimeType)) {
          warnings.push(`invalid_image: ${sniffed.reason || 'Tipe berkas tidak didukung.'}`);
        } else {
          accessible = true;
          verifiedMime = sniffed.mimeType;
          if (sniffed.dimensions) {
            verifiedDimensions = sniffed.dimensions;
            candidate.width = sniffed.dimensions.width;
            candidate.height = sniffed.dimensions.height;
          }
        }
      }
    }

    const matchEval = evaluateSubjectMatch(candidate, candidate._searchQuery);

    // Evaluasi status lisensi & ketentuan penggunaan (Partisi Disjoin Lattice Kleene: cek predikat pembatas terlebih dahulu agar P_open ∩ P_rest = ∅)
    let usage_status = 'unknown';
    const licLower = (candidate.license_name || '').toLowerCase();
    const isRestrictedLicense = /\b(all rights reserved|copyrighted|fair use|non-?commercial|by-nc|cc-by-nc|no derivatives|by-nd|cc-by-nd)\b/i.test(licLower);
    const isOpenLicense = !isRestrictedLicense && (
      licLower.includes('public domain') ||
      /\bpd(?:-[a-z0-9-]+|\b)/i.test(licLower) ||
      licLower.includes('cc0') ||
      licLower.includes('cc-zero') ||
      licLower.includes('no restrictions') ||
      licLower.includes('cc by') ||
      licLower.includes('cc-by') ||
      licLower.includes('attribution') ||
      licLower.includes('unsplash license') ||
      licLower.includes('pexels license') ||
      licLower.includes('pixabay') ||
      licLower.includes('free art license') ||
      licLower.includes('gfdl')
    );
    if (!candidate.license_name) {
      usage_status = candidate.source_name === 'pinterest' ? 'restricted' : 'unknown';
      warnings.push('license_unknown: Lisensi sumber tidak tercantum secara eksplisit pada metadata.');
    } else if (isRestrictedLicense) {
      usage_status = 'restricted';
      warnings.push(`access_denied: Lisensi "${candidate.license_name}" membatasi penayangan ulang.`);
    } else if (isOpenLicense) {
      usage_status = accessible ? 'allowed' : 'restricted';
    } else {
      usage_status = 'unknown';
      warnings.push(`license_unknown: Ketentuan lisensi "${candidate.license_name}" memerlukan verifikasi manual.`);
    }

    if (candidate._mediaCategory === 'stock_photo') {
      warnings.push('stock_photo_context: Foto stok — jangan gunakan sebagai bukti peristiwa nyata atau identitas tokoh tertentu.');
    } else if (candidate._mediaCategory === 'ai_generated') {
      warnings.push('ai_generated_media: Metadata mengindikasikan gambar buatan AI, bukan foto dokumenter.');
    } else if (candidate._mediaCategory === 'illustration' || candidate._mediaCategory === 'artwork') {
      warnings.push(`media_type_${candidate._mediaCategory}: Media merupakan ${candidate._mediaCategory === 'artwork' ? 'karya seni' : 'ilustrasi/diagram'}, bukan foto dokumenter langsung.`);
    }

    const inspectionResult = {
      image_id: candidate.image_id,
      accessible,
      mime_type: verifiedMime,
      dimensions: verifiedDimensions,
      subject_match: matchEval.subject_match,
      match_basis: matchEval.match_basis,
      usage_status,
      attribution_text: candidate.attribution_text,
      warnings
    };

    candidate._inspection = inspectionResult;
    return inspectionResult;
  }

  function mintSignedAssetToken(candidate, mimeType) {
    pruneMap(assetTokenStore, MAX_CANDIDATE_CACHE, CANDIDATE_TTL_MS);
    const targetUrl = candidate.preview_url && candidate.source_name === 'wikimedia_commons'
      ? candidate.preview_url // Gunakan resolusi 960px optimal untuk Commons agar cepat & hemat bandwidth
      : (candidate.image_url || candidate.preview_url);

    const nonce = crypto.randomBytes(8).toString('hex');
    const exp = Date.now() + STATELESS_TOKEN_TTL_MS;
    const tokenObj = {
      id: candidate.image_id,
      u: targetUrl,
      s: candidate.source_name,
      m: mimeType || 'image/jpeg',
      exp,
      n: nonce
    };
    const rawJson = JSON.stringify(tokenObj);
    const sig = crypto.createHmac('sha256', hmacSecret).update(rawJson).digest('hex').slice(0, 24);
    const token = `${Buffer.from(rawJson, 'utf8').toString('base64url')}.${sig}`;

    assetTokenStore.set(token, {
      image_id: candidate.image_id,
      url: targetUrl,
      source_name: candidate.source_name,
      mime_type: mimeType || 'image/jpeg',
      exp,
      _createdAt: Date.now()
    });

    return token;
  }

  async function triggerUnsplashDownloadPing(candidate) {
    const accessKey = String(env.UNSPLASH_ACCESS_KEY || '').trim();
    if (!accessKey || !candidate._unsplashDownloadLocation) return;
    await secureFetchProviderJson(candidate._unsplashDownloadLocation, 'unsplash', {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1'
    }).catch(() => {});
  }

  /**
   * TOOL 3: prepare_image_display
   * Catatan penting: Keberhasilan fungsi ini HANYA berarti payload aset terverifikasi siap dikirim ke renderer UI,
   * BUKAN klaim bahwa gambar sudah tampil di layar pengguna.
   */
  async function prepareImageDisplay(params = {}) {
    const rawIds = Array.isArray(params.image_ids) ? params.image_ids.map((id) => String(id || '').trim()).filter(Boolean) : [];
    const layout = ['single', 'gallery', 'collage'].includes(params.layout) ? params.layout : 'single';
    const placement = ['after_intro', 'within_section'].includes(params.placement) ? params.placement : 'after_intro';
    const rawAlts = Array.isArray(params.alt_texts) ? params.alt_texts : [];

    if (rawIds.length === 0 || rawIds.length > 3) {
      return {
        status: 'error',
        error_code: 'invalid_image',
        message: 'Parameter "image_ids" wajib berisi 1 hingga maksimal 3 ID kandidat gambar.',
        display_items: [],
        layout,
        placement,
        rendering_requirements: {
          requires_client_renderer: true,
          payload_is_not_render_confirmation: true
        }
      };
    }

    if (rawAlts.length !== rawIds.length) {
      return {
        status: 'error',
        error_code: 'invalid_alt_texts',
        message: 'Parameter "alt_texts" wajib menyediakan tepat satu teks alternatif untuk setiap image_id.',
        display_items: [],
        layout,
        placement,
        rendering_requirements: {
          requires_client_renderer: true,
          payload_is_not_render_confirmation: true
        }
      };
    }

    const display_items = [];
    const item_errors = [];

    for (let i = 0; i < rawIds.length; i++) {
      const id = rawIds[i];
      let candidate = candidateStore.get(id);
      if (!candidate && /^img_wmc_\d+$/.test(id)) {
        candidate = await hydrateWikimediaCandidateByPageId(id);
      }
      if (!candidate) {
        item_errors.push({ image_id: id, code: 'invalid_image', message: `image_id "${id}" tidak ditemukan.` });
        continue;
      }

      const inspection = candidate._inspection || await inspectImage({ image_id: id });
      if (!inspection.accessible) {
        item_errors.push({ image_id: id, code: 'invalid_image', message: `Berkas gambar "${id}" tidak dapat diakses atau tidak valid.` });
        continue;
      }
      if (inspection.usage_status === 'restricted') {
        item_errors.push({ image_id: id, code: 'access_denied', message: `Gambar "${id}" dibatasi ketentuan lisensi.` });
        continue;
      }
      if (inspection.usage_status === 'unknown') {
        item_errors.push({ image_id: id, code: 'license_unknown', message: `Lisensi gambar "${id}" tidak diketahui.` });
        continue;
      }
      if (inspection.subject_match === 'mismatch') {
        item_errors.push({ image_id: id, code: 'subject_mismatch', message: `Metadata gambar "${id}" tidak cocok dengan subjek kueri.` });
        continue;
      }

      const cleanAlt = sanitizeUntrustedText(rawAlts[i], 240) || candidate.title || 'Gambar referensi terverifikasi';
      const token = mintSignedAssetToken(candidate, inspection.mime_type);
      const proxyRef = `/api/tools/image-asset/${encodeURIComponent(token)}`;

      // Patuhi pedoman Unsplash (wajib hotlink ke images.unsplash.com + ping download_location);
      // Untuk sumber lain (Wikimedia, Pexels, Pixabay) gunakan proxy terverifikasi same-origin sebagai asset_ref utama.
      let primaryAssetRef = proxyRef;
      if (candidate.source_name === 'unsplash' && candidate.image_url) {
        primaryAssetRef = candidate.image_url;
        triggerUnsplashDownloadPing(candidate);
      }

      display_items.push({
        image_id: candidate.image_id,
        asset_ref: primaryAssetRef,
        fallback_asset_ref: candidate.preview_url || candidate.image_url || proxyRef,
        direct_media_url: candidate.preview_url || candidate.image_url || null,
        alt_text: cleanAlt,
        title: candidate.title,
        source_name: candidate.source_name,
        source_page_url: candidate.source_page_url,
        creator: candidate.creator,
        creator_url: candidate.creator_url,
        license_name: candidate.license_name,
        license_url: candidate.license_url,
        attribution_text: candidate.attribution_text,
        width: inspection.dimensions ? inspection.dimensions.width : candidate.width,
        height: inspection.dimensions ? inspection.dimensions.height : candidate.height,
        media_category: candidate._mediaCategory
      });
    }

    if (display_items.length === 0) {
      const primaryErr = item_errors[0] ? item_errors[0].code : 'invalid_image';
      return {
        status: 'error',
        error_code: primaryErr,
        display_items: [],
        item_errors,
        layout,
        placement,
        rendering_requirements: {
          requires_client_renderer: true,
          payload_is_not_render_confirmation: true,
          fallback_action: 'Gunakan tautan source_page_url dalam teks tanpa mengklaim gambar berhasil ditampilkan.'
        }
      };
    }

    const effectiveLayout = display_items.length === 1 ? 'single' : layout;
    const display_id = `disp_${crypto.randomBytes(6).toString('hex')}`;
    const placement_token = `[[ZOZ_IMAGE_DISPLAY:${display_id}]]`;

    pruneMap(displayStore, MAX_DISPLAY_CACHE, CANDIDATE_TTL_MS);
    const publicPayload = {
      status: item_errors.length > 0 ? 'partial' : 'ready',
      display_id,
      placement_token,
      display_items,
      ...(item_errors.length > 0 ? { item_errors } : {}),
      layout: effectiveLayout,
      placement,
      rendering_requirements: {
        requires_client_renderer: true,
        payload_is_not_render_confirmation: true,
        placement_token,
        component_type: 'zoz-grounded-image-display',
        supported_layouts: ['single', 'gallery', 'collage'],
        fallback_on_error: 'renderer_unavailable_or_broken_img_shows_verified_source_card'
      }
    };

    displayStore.set(display_id, { ...publicPayload, _createdAt: Date.now() });
    return publicPayload;
  }

  /**
   * Streaming Proxy Aset Gambar Aman (GET /api/tools/image-asset/:token)
   */
  async function serveVerifiedImageAsset(token, res) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Token aset gambar tidak valid.', code: 'invalid_image' }));
      return;
    }

    const [encodedPayload, providedSig] = token.split('.');
    let decodedPayload = '';
    try {
      decodedPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    } catch (_) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Format token aset rusak.', code: 'invalid_image' }));
      return;
    }

    const expectedSig = crypto.createHmac('sha256', hmacSecret).update(decodedPayload).digest('hex').slice(0, 24);
    const sigBufA = Buffer.from(providedSig || '', 'utf8');
    const sigBufB = Buffer.from(expectedSig, 'utf8');
    if (sigBufA.length !== sigBufB.length || !crypto.timingSafeEqual(sigBufA, sigBufB)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Tanda tangan token aset ditolak.', code: 'access_denied' }));
      return;
    }

    let entry = assetTokenStore.get(token);
    if (!entry) {
      try {
        const parsed = JSON.parse(decodedPayload);
        if (parsed && parsed.u && parsed.s && parsed.exp) {
          entry = {
            image_id: parsed.id,
            url: parsed.u,
            source_name: parsed.s,
            mime_type: parsed.m || 'image/jpeg',
            exp: parsed.exp
          };
        }
      } catch (_) {}
    }

    if (!entry || Date.now() > entry.exp) {
      assetTokenStore.delete(token);
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Token aset telah kedaluwarsa atau tidak ditemukan.', code: 'invalid_image' }));
      return;
    }

    const allowRule = getMediaRuleForSource(entry.source_name);
    const upstream = await secureHttpsFetch(entry.url, {
      allowRule,
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.1'
      },
      maxBytes: MAX_ASSET_STREAM_BYTES,
      timeoutMs: DEFAULT_TIMEOUT_MS
    });

    if (!upstream.ok || !upstream.buffer || upstream.buffer.length === 0) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        error: upstream.error || 'Gagal mengambil aset gambar dari CDN sumber.',
        code: upstream.code || 'invalid_image'
      }));
      return;
    }

    const sniffed = sniffImageHeader(upstream.buffer);
    if (!sniffed.valid || !ALLOWED_IMAGE_MIME_TYPES.has(sniffed.mimeType)) {
      res.writeHead(415, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        error: sniffed.reason || 'Tipe berkas gambar tidak diizinkan.',
        code: 'invalid_image'
      }));
      return;
    }

    // Header keamanan ketat anti-sniffing & anti-eksekusi script
    const cacheHeader = entry.source_name === 'pixabay'
      ? 'private, max-age=3600'
      : 'public, max-age=3600, stale-while-revalidate=7200';

    res.writeHead(200, {
      'Content-Type': sniffed.mimeType,
      'Content-Length': String(upstream.buffer.length),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': cacheHeader
    });
    res.end(upstream.buffer);
  }

  return {
    ALLOWED_SOURCES,
    SOURCE_PAGE_ALLOWLIST,
    MEDIA_CDN_ALLOWLIST,
    searchImages,
    inspectImage,
    prepareImageDisplay,
    serveVerifiedImageAsset,
    validateStaticHttpsUrl,
    resolveAndVerifyPublicHost,
    sanitizeUntrustedText,
    sniffImageHeader
  };
}

module.exports = {
  createImageGroundingService,
  ALLOWED_SOURCES,
  SOURCE_PAGE_ALLOWLIST,
  MEDIA_CDN_ALLOWLIST,
  sanitizeUntrustedText,
  sniffImageHeader,
  evaluateSubjectMatch
};
