/**
 * ZOZ ROUTER — Pure-JS Native Microsoft Edge Neural TTS Client
 * Zero external dependencies — works on Node.js 18/20/22/24 and Vercel Serverless.
 * Implements edge-tts 7.3.1 Sec-MS-GEC v2 DRM + RFC 6455 TLS WebSocket streaming.
 */
'use strict';

const tls = require('tls');
const crypto = require('crypto');

const BING_TTS_HOST = 'speech.platform.bing.com';
const BING_TTS_PATH_BASE = '/consumer/speech/synthesize/readaloud/edge/v1';
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR_VERSION = '143';
const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`;
const EDGE_ORIGIN = 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold';
const EDGE_USER_AGENT =
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ` +
  `(KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 ` +
  `Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`;

const DEFAULT_VOICE = 'id-ID-GadisNeural';
const MAX_TEXT_CHARS = 6000;
const WIN_EPOCH = 11644473600;

const TTS_VOICES_LIST = [
  { id: 'id-ID-GadisNeural', label: 'Gadis (Indonesia — Perempuan Natural)', shortLabel: 'Gadis', lang: 'id-ID', gender: 'Female' },
  { id: 'id-ID-ArdiNeural', label: 'Ardi (Indonesia — Laki-laki Natural)', shortLabel: 'Ardi', lang: 'id-ID', gender: 'Male' },
  { id: 'en-US-AriaNeural', label: 'Aria (English — Female Natural)', shortLabel: 'Aria', lang: 'en-US', gender: 'Female' },
  { id: 'en-US-GuyNeural', label: 'Guy (English — Male Natural)', shortLabel: 'Guy', lang: 'en-US', gender: 'Male' }
];
const ALLOWED_VOICES = Object.fromEntries(TTS_VOICES_LIST.map((v) => [v.id, v]));

// ===== Sec-MS-GEC v2 DRM Constants (ported verbatim from edge_tts/drm.py) =====
const _SHA256_INITIAL = [
  0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
  0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
];
const _SHA256_STATE = [
  0xFD9FBEA2, 0x91243CE7, 0xBE499094, 0xCD2E1E0A,
  0x6C006F49, 0x04BD35AB, 0xFEB0A7E4, 0x03EFFBD2
];
const _SHA256_SCHEDULE = [
  0xEB24BF9E, 0x1558691F, 0xA0C09EE2, 0x0CFA32BA,
  0xA622EE8C, 0xD1DD9491, 0xC0DD25A0, 0xF9E70AB6,
  0xF0C31573, 0x7058CE4E, 0x7188E606, 0x00E5AB33,
  0xD258B060, 0x72766564
];
const _SHA256_ROUND_CONSTANTS = [
  0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
  0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
  0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
  0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
  0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
  0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
  0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
  0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2
];
const _SHA256_ADJUSTMENT = 0xC9DC06A7;
const _SHA256_BLOCK_CONSTANTS = [
  ..._SHA256_ROUND_CONSTANTS.slice(0, 14),
  _SHA256_ADJUSTMENT,
  ..._SHA256_ROUND_CONSTANTS.slice(15)
];
const _SHA256_SIGMA0_ADJUSTMENT = 0x059C0B80;
const _SHA256_SIGMA1_ADJUSTMENT = 0x000B92C0;

const _CS64_COEFFICIENTS = [
  [0xE82E91B1, 0xB32700D0],
  [0x44DE24C6, 0x88DFF51D],
  [0x3BEB65BC, 0x29514038],
  [0xC89C5933, 0xB328CBDF],
  [0x8D1EC211, 0xD405B4D5],
  [0x314EF5D5, 0x26E55F3C],
  [0xE92491B1, 0x607801C6],
  [0xF0A5B9D5, 0x82B2C1FB],
  [0x06064CF3, 0xFA51A3DA],
  [0xDA79FA60, 0x207CC464],
  [0xBED20560, 0x3C3C74F3],
  [0x89F9C9F8, 0xD2D14B61],
  [0x35FA38C6, 0xBB04A2C1],
  [0xCB49E3C6, 0xC5626167]
];
const _CS64_FACTOR = 0x82893933;
const _CS64_ADJUSTMENT0 = 0xF2F90B1A;
const _CS64_ADJUSTMENT1 = 0x0B1A0000;

let clockSkewSeconds = 0;

function _rotr32(v, n) {
  return ((v >>> n) | (v << (32 - n))) >>> 0;
}

function _rol16(v) {
  return (((v & 0xFFFF) << 16) | ((v >>> 16) & 0xFFFF)) >>> 0;
}

function _sigma0(v) {
  return (_rotr32(v, 7) ^ _rotr32(v, 18) ^ (v >>> 3)) >>> 0;
}

function _sigma1(v) {
  return (_rotr32(v, 17) ^ _rotr32(v, 19) ^ (v >>> 10)) >>> 0;
}

function _expandSha256Schedule(words, firstWord = 16) {
  for (let i = firstWord; i < 64; i++) {
    const s1 = _sigma1(words[i - 2]);
    const s0 = _sigma0(words[i - 15]);
    words[i] = (s1 + words[i - 7] + s0 + words[i - 16]) >>> 0;
  }
}

function _sha256Rounds(state, words, firstRound = 0) {
  let [a, b, c, d, e, f, g, h] = state;
  const constants = firstRound === 14 ? _SHA256_BLOCK_CONSTANTS : _SHA256_ROUND_CONSTANTS;
  for (let i = firstRound; i < 64; i++) {
    const s1 = (_rotr32(e, 6) ^ _rotr32(e, 11) ^ _rotr32(e, 25)) >>> 0;
    const ch = (g ^ (e & (f ^ g))) >>> 0;
    const t1 = (h + s1 + ch + constants[i] + words[i]) >>> 0;
    const s0 = (_rotr32(a, 2) ^ _rotr32(a, 13) ^ _rotr32(a, 22)) >>> 0;
    const maj = ((a & b) | (c & (a | b))) >>> 0;
    const t2 = (s0 + maj) >>> 0;
    h = g;
    g = f;
    f = e;
    e = (d + t1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) >>> 0;
  }
  return [a, b, c, d, e, f, g, h];
}

function _sha256Init(headBytes) {
  const words = new Array(64).fill(0);
  words[14] = ((headBytes[0] << 16) | (headBytes[1] << 8) | headBytes[2]) >>> 0;
  words[15] = headBytes.readUInt32BE(3);
  for (let i = 16; i < 30; i++) {
    let v = _SHA256_SCHEDULE[i - 16];
    if (i - 2 >= 14) {
      const sig1 = _sigma1(words[i - 2]);
      v = (v + (i === 16 ? ((sig1 ^ _SHA256_SIGMA1_ADJUSTMENT) >>> 0) : sig1)) >>> 0;
    }
    if (i - 7 >= 14) {
      v = (v + words[i - 7]) >>> 0;
    }
    if (i - 15 >= 14) {
      const sig0 = _sigma0(words[i - 15]);
      v = (v + (i === 29 ? ((sig0 ^ _SHA256_SIGMA0_ADJUSTMENT) >>> 0) : sig0)) >>> 0;
    }
    words[i] = v >>> 0;
  }
  const adjDiff = (_SHA256_ADJUSTMENT - _SHA256_ROUND_CONSTANTS[14]) >>> 0;
  words[30] = (_sigma1(words[28]) + words[23] + _sigma0(words[15]) + words[14] + adjDiff) >>> 0;
  _expandSha256Schedule(words, 31);
  const working = _sha256Rounds(_SHA256_STATE, words, 14);
  return _SHA256_INITIAL.map((x, idx) => (x + working[idx]) >>> 0);
}

function _sha256Digest(dataBuf) {
  if (!dataBuf || dataBuf.length < 7) {
    throw new Error('Token salt must contain at least seven bytes');
  }
  const length = 57 + dataBuf.length;
  const padZeroCount = (((55 - length) % 64) + 64) % 64;
  const tailLenBuf = Buffer.alloc(8);
  tailLenBuf.writeBigUInt64BE(BigInt(length) * 8n, 0);
  const padded = Buffer.concat([
    dataBuf.subarray(7),
    Buffer.from([0x80]),
    Buffer.alloc(padZeroCount),
    tailLenBuf
  ]);
  let state = _sha256Init(dataBuf.subarray(0, 7));
  const words = new Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let j = 0; j < 16; j++) {
      words[j] = padded.readUInt32BE(offset + j * 4);
    }
    _expandSha256Schedule(words, 16);
    const working = _sha256Rounds(state, words, 0);
    state = state.map((x, idx) => (x + working[idx]) >>> 0);
  }
  const out = Buffer.alloc(32);
  for (let i = 0; i < 8; i++) {
    out.writeUInt32BE(state[i] >>> 0, i * 4);
  }
  return out;
}

function _wordsLe4Even(dataBuf) {
  const padLen = (4 - (dataBuf.length % 4)) % 4;
  const padded = padLen ? Buffer.concat([dataBuf, Buffer.alloc(padLen)]) : dataBuf;
  if (padded.length === 0) return [];
  const words = [];
  for (let i = 0; i < padded.length; i += 4) {
    words.push(padded.readUInt32LE(i));
  }
  if (words.length % 2 === 1) words.push(0);
  return words;
}

function _cs64Digest(dataBuf, digestBuf) {
  const keyA = (digestBuf.readUInt32LE(0) | 1) >>> 0;
  const keyB = (digestBuf.readUInt32LE(4) | 1) >>> 0;
  const factors = [
    Math.imul(keyA, _CS64_FACTOR) >>> 0,
    Math.imul(keyB, _CS64_FACTOR) >>> 0
  ];
  const terms = [];
  const offsets = [];
  for (let i = 0; i < _CS64_COEFFICIENTS.length; i++) {
    const [coeff, off] = _CS64_COEFFICIENTS[i];
    terms.push(Math.imul(coeff, factors[i % 2]) >>> 0);
    offsets.push(off >>> 0);
  }
  const prefixed = Buffer.concat([Buffer.from([0]), dataBuf]);
  const leWords = _wordsLe4Even(prefixed);
  for (let i = 0; i < leWords.length; i++) {
    const w = leWords[i];
    let term = Math.imul(w, i % 2 === 0 ? keyA : keyB) >>> 0;
    let offset = Math.imul(_rol16(w), i % 2 === 0 ? 0xEF0569FB : 0xC31713DB) >>> 0;
    if (i === 0) {
      term = (term + (Math.imul(_CS64_ADJUSTMENT0, factors[0]) >>> 0)) >>> 0;
      offset = (offset + _CS64_ADJUSTMENT1) >>> 0;
    }
    terms.push(term >>> 0);
    offsets.push(offset >>> 0);
  }
  let swapAcc = 0;
  let swapLast = 0;
  let state = 0;
  let acc = 0;
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i];
    const y = terms[i + 1];
    let t = _rol16((offsets[i] + x) >>> 0);
    let q = Math.imul(t, 0x76F50F34) >>> 0;
    swapAcc = (swapAcc + ((Math.imul(_rol16(q), 0xC3EFEA97) + q) >>> 0)) >>> 0;

    t = _rol16((offsets[i + 1] + y) >>> 0);
    q = Math.imul(t, 0x1881CE3C) >>> 0;
    swapLast = (Math.imul(_rol16(q), 0x35BD1EC9) + q) >>> 0;
    swapAcc = (swapAcc + swapLast) >>> 0;

    state = (Math.imul(state, keyA) + x) >>> 0;
    state = Math.imul(_rol16(state), 0xCF98B111) >>> 0;
    state = Math.imul(_rol16(state), 0x87085B9F) >>> 0;
    state = Math.imul(_rol16(state), 0x12CEB96D) >>> 0;
    state = Math.imul(_rol16(state), 0x257E1D83) >>> 0;
    acc = (acc + state) >>> 0;

    t = (Math.imul(state, keyB) + y) >>> 0;
    t = Math.imul(_rol16(t), 0xA27416F5) >>> 0;
    t = Math.imul(_rol16(t), 0xD38396FF) >>> 0;
    state = Math.imul(_rol16(Math.imul(_rol16(t), 0x7C932B89) >>> 0), 0xBFA49F69) >>> 0;
    acc = (acc + state) >>> 0;
  }
  const out = Buffer.alloc(8);
  out.writeUInt32LE((swapLast ^ state) >>> 0, 0);
  out.writeUInt32LE((swapAcc ^ acc) >>> 0, 4);
  return out;
}

function generateSecMsGecV2(unixTimestamp = null) {
  const baseSec = unixTimestamp == null
    ? (Date.now() / 1000 + clockSkewSeconds)
    : Number(unixTimestamp);
  const winSecs = Math.floor(baseSec) + WIN_EPOCH;
  const floored = winSecs - (winSecs % 300);
  const ticksStr = (BigInt(floored) * 10000000n).toString();
  const strToHash = Buffer.from(`${ticksStr}${TRUSTED_CLIENT_TOKEN}`, 'ascii');
  const digest = _sha256Digest(strToHash);
  const cs64 = _cs64Digest(strToHash, digest);
  return `${cs64.toString('hex').toUpperCase()}-${digest.toString('hex').toUpperCase()}`;
}

function adjustClockSkewFromDateHeader(dateHeader) {
  if (!dateHeader || typeof dateHeader !== 'string') return false;
  const parsedMs = Date.parse(dateHeader);
  if (!Number.isFinite(parsedMs)) return false;
  const serverSec = parsedMs / 1000;
  const localSkewedSec = Date.now() / 1000 + clockSkewSeconds;
  clockSkewSeconds += (serverSec - localSkewedSec);
  return true;
}

function normalizeVoice(voice) {
  const c = String(voice || '').trim();
  return ALLOWED_VOICES[c] ? c : DEFAULT_VOICE;
}

function normalizeRate(rate) {
  const c = String(rate || '+0%').trim();
  if (/^[+-](?:[0-4]?\d|50)%$/.test(c)) {
    const val = Math.max(-25, Math.min(50, parseInt(c.slice(0, -1), 10) || 0));
    return val >= 0 ? `+${val}%` : `${val}%`;
  }
  return '+0%';
}

function cleanTextForSpeech(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  text = text.replace(/<<<ZOZ_(?:FILE|EDIT|MODIFY|TASKS)[\s\S]*?(?:<<<END_ZOZ_(?:FILE|EDIT|MODIFY|TASKS)[^\n>]*>?|$)/gi, ' ');
  text = text.replace(/<(?:think|thinking|reasoning|thought|tool_call|function_call)>[\s\S]*?<\/(?:think|thinking|reasoning|thought|tool_call|function_call)>/gi, ' ');
  text = text.replace(/\[\[ZOZ_(?:IMAGE|WEATHER)_DISPLAY:[^\]]+\]\]/gi, ' ');
  text = text.replace(/\[System Note:[^\]]*\]/gi, ' ');

  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/~~~[\s\S]*?~~~/g, ' ');

  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  text = text.replace(/\[([^\]]+)\]\((?:https?:\/\/|\/|#)[^)]*\)/g, '$1');

  text = text.replace(/https?:\/\/[^\s)\]>'"]+/gi, ' ');
  text = text.replace(/\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\]/g, '');

  const cleanLatex = (_, expr) => {
    let e = String(expr || '');
    e = e.replace(/\\text\{([^}]*)\}/g, ' $1 ');
    e = e.replace(/\\mathrm\{([^}]*)\}/g, ' $1 ');
    e = e.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, ' $1 per $2 ');
    e = e.replace(/\\sqrt\{([^}]*)\}/g, ' akar $1 ');
    e = e.replace(/\\times/g, ' kali ').replace(/\\cdot/g, ' kali ');
    e = e.replace(/\\approx/g, ' sekitar ')
         .replace(/\\le/g, ' kurang dari sama dengan ')
         .replace(/\\ge/g, ' lebih dari sama dengan ');
    e = e.replace(/\\[a-zA-Z]+/g, ' ');
    e = e.replace(/[{}^_]/g, ' ');
    return ` ${e} `;
  };
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, cleanLatex);
  text = text.replace(/\$([^$\n]{1,180})\$/g, cleanLatex);

  text = text.replace(/`([^`\n]+)`/g, '$1');

  text = text.replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{0,}:?\s*\|?\s*$/gm, ' ');
  text = text.replace(/^\s*[-*_]{3,}\s*$/gm, ' ');
  text = text.replace(/\|/g, ', ');

  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  text = text.replace(/^\s*>\s?/gm, '');
  text = text.replace(/^\s*[-*•◦▪]\s+/gm, '');

  text = text.replace(/(\*\*|__)([\s\S]*?)\1/g, '$2');
  text = text.replace(/~~([\s\S]*?)~~/g, '$1');
  text = text.replace(/(^|[^\w])[*_]([^*\n_]+)[*_](?=$|[^\w])/g, '$1$2');
  text = text.replace(/[*_~#`]+/g, '');
  text = text.replace(/<[^>]+>/g, ' ');

  try {
    text = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, ' ');
  } catch (_) {}

  const lines = text.split('\n').map((ln) => ln.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const cleanLines = lines.map((ln) => (/[.!?,;:]$/.test(ln) ? ln : `${ln}.`));
  let cleaned = cleanLines.join(' ');
  cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1');
  cleaned = cleaned.replace(/([.,!?;:])\1+/g, '$1');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  if (cleaned.length > MAX_TEXT_CHARS) {
    const sliced = cleaned.slice(0, MAX_TEXT_CHARS);
    const lastSp = sliced.lastIndexOf(' ');
    cleaned = (lastSp > 100 ? sliced.slice(0, lastSp) : sliced).trim();
  }
  return cleaned;
}

function removeIncompatibleChars(str) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 0 && code <= 8) || (code >= 11 && code <= 12) || (code >= 14 && code <= 31)) {
      out += ' ';
    } else {
      out += str[i];
    }
  }
  return out;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function splitSsmlChunks(escapedText, maxBytes = 3600) {
  const buf = Buffer.from(escapedText, 'utf8');
  const chunks = [];
  let offset = 0;
  while (offset < buf.length) {
    if (buf.length - offset <= maxBytes) {
      const tail = buf.subarray(offset).toString('utf8').trim();
      if (tail) chunks.push(tail);
      break;
    }
    let splitLen = maxBytes;
    const nlIdx = buf.lastIndexOf(0x0A, offset + maxBytes);
    const spIdx = buf.lastIndexOf(0x20, offset + maxBytes);
    if (nlIdx > offset + 64) {
      splitLen = nlIdx - offset;
    } else if (spIdx > offset + 64) {
      splitLen = spIdx - offset;
    } else {
      while (splitLen > 1 && (buf[offset + splitLen] & 0xC0) === 0x80) {
        splitLen--;
      }
    }
    // Never split inside an XML entity like &amp;
    const seg = buf.subarray(offset, offset + splitLen);
    const ampIdx = seg.lastIndexOf(0x26);
    if (ampIdx >= 0 && seg.indexOf(0x3B, ampIdx) === -1) {
      splitLen = ampIdx > 0 ? ampIdx : splitLen;
    }
    const piece = buf.subarray(offset, offset + splitLen).toString('utf8').trim();
    if (piece) chunks.push(piece);
    offset += Math.max(splitLen, 1);
  }
  return chunks;
}

function formatEdgeDate() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${d.getUTCFullYear()} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

function makeHexId(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

function buildSpeechConfigPayload() {
  return (
    `X-Timestamp:${formatEdgeDate()}\r\n` +
    `Content-Type:application/json; charset=utf-8\r\n` +
    `Path:speech.config\r\n\r\n` +
    `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`
  );
}

function buildSsmlPayload(requestId, voice, rate, escapedChunk) {
  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${voice}'>` +
    `<prosody pitch='+0Hz' rate='${rate}' volume='+0%'>` +
    `${escapedChunk}` +
    `</prosody></voice></speak>`;
  return (
    `X-RequestId:${requestId}\r\n` +
    `Content-Type:application/ssml+xml\r\n` +
    `X-Timestamp:${formatEdgeDate()}Z\r\n` +
    `Path:ssml\r\n\r\n` +
    `${ssml}`
  );
}

function encodeWsClientFrame(opcode, payloadBuf) {
  const data = Buffer.isBuffer(payloadBuf) ? payloadBuf : Buffer.from(String(payloadBuf), 'utf8');
  const len = data.length;
  const maskKey = crypto.randomBytes(4);
  let header;
  if (len < 126) {
    header = Buffer.alloc(6);
    header[0] = 0x80 | (opcode & 0x0F);
    header[1] = 0x80 | len;
    maskKey.copy(header, 2);
  } else if (len <= 0xFFFF) {
    header = Buffer.alloc(8);
    header[0] = 0x80 | (opcode & 0x0F);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
    maskKey.copy(header, 4);
  } else {
    header = Buffer.alloc(14);
    header[0] = 0x80 | (opcode & 0x0F);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
    maskKey.copy(header, 10);
  }
  const masked = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) {
    masked[i] = data[i] ^ maskKey[i & 3];
  }
  return Buffer.concat([header, masked]);
}

function parseHeadersBlock(headerStr) {
  const map = {};
  const lines = headerStr.split('\r\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const k = line.slice(0, colonIdx).trim().toLowerCase();
      const v = line.slice(colonIdx + 1).trim();
      map[k] = v;
    }
  }
  return map;
}

function streamSingleChunkViaTlsWs({ escapedChunk, voice, rate, onChunk, signal, timeoutMs, attempt = 1 }) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      return reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    }

    const connId = makeHexId(16);
    const muid = makeHexId(16).toUpperCase();
    const secMsGec = generateSecMsGecV2();
    const wsKey = crypto.randomBytes(16).toString('base64');
    const pathAndQuery =
      `${BING_TTS_PATH_BASE}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
      `&ConnectionId=${connId}` +
      `&Sec-MS-GEC=${secMsGec}` +
      `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    let settled = false;
    let handshakeDone = false;
    let rxBuf = Buffer.alloc(0);
    let fragOpcode = 0;
    let fragBuffers = [];
    let emittedBytes = 0;
    let turnEnded = false;

    const socket = tls.connect({
      host: BING_TTS_HOST,
      port: 443,
      servername: BING_TTS_HOST,
      ALPNProtocols: ['http/1.1']
    });

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (signal && onAbort) {
        try { signal.removeEventListener('abort', onAbort); } catch (_) {}
      }
    };

    const doneResolve = (bytesCount) => {
      if (settled) return;
      settled = true;
      cleanup();
      try { socket.destroy(); } catch (_) {}
      resolve(bytesCount);
    };

    const doneReject = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      try { socket.destroy(); } catch (_) {}
      reject(err);
    };

    let timer = setTimeout(() => {
      doneReject(new Error(`Edge TTS WebSocket timeout (${timeoutMs}ms)`));
    }, Math.max(5000, Number(timeoutMs) || 35000));

    const onAbort = () => {
      doneReject(Object.assign(new Error('TTS request aborted'), { name: 'AbortError' }));
    };
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    socket.on('error', (err) => {
      doneReject(err || new Error('TLS WebSocket socket error'));
    });

    socket.on('close', () => {
      if (settled) return;
      if (turnEnded || emittedBytes > 0) {
        doneResolve(emittedBytes);
      } else {
        doneReject(new Error('Edge TTS WebSocket closed without audio'));
      }
    });

    socket.on('secureConnect', () => {
      const reqLines = [
        `GET ${pathAndQuery} HTTP/1.1`,
        `Host: ${BING_TTS_HOST}`,
        `Upgrade: websocket`,
        `Connection: Upgrade`,
        `Sec-WebSocket-Key: ${wsKey}`,
        `Sec-WebSocket-Version: 13`,
        `Origin: ${EDGE_ORIGIN}`,
        `User-Agent: ${EDGE_USER_AGENT}`,
        `Pragma: no-cache`,
        `Cache-Control: no-cache`,
        `Accept-Language: en-US,en;q=0.9`,
        `Cookie: muid=${muid};`,
        ``,
        ``
      ];
      try {
        socket.write(reqLines.join('\r\n'));
      } catch (wErr) {
        doneReject(wErr);
      }
    });

    const handleCompleteMessage = (opcode, payload) => {
      if (opcode === 0x8) {
        turnEnded = true;
        if (emittedBytes > 0) {
          doneResolve(emittedBytes);
        } else {
          doneReject(new Error('Edge TTS closed before sending audio'));
        }
        return;
      }
      if (opcode === 0x9) {
        try { socket.write(encodeWsClientFrame(0xA, payload)); } catch (_) {}
        return;
      }
      if (opcode === 0xA) {
        return;
      }
      if (opcode === 0x1) {
        const textMsg = payload.toString('utf8');
        const sepIdx = textMsg.indexOf('\r\n\r\n');
        const hdrs = parseHeadersBlock(sepIdx >= 0 ? textMsg.slice(0, sepIdx) : textMsg);
        if (hdrs.path === 'turn.end') {
          turnEnded = true;
          try { socket.write(encodeWsClientFrame(0x8, Buffer.alloc(0))); } catch (_) {}
          doneResolve(emittedBytes);
        }
        return;
      }
      if (opcode === 0x2) {
        if (payload.length < 2) return;
        const headerLen = payload.readUInt16BE(0);
        if (2 + headerLen > payload.length) return;
        const hdrText = payload.subarray(2, 2 + headerLen).toString('utf8');
        const hdrs = parseHeadersBlock(hdrText);
        if (hdrs.path === 'audio') {
          const contentType = String(hdrs['content-type'] || '');
          const audioData = payload.subarray(2 + headerLen);
          if (audioData.length > 0 && (!contentType || contentType.includes('audio/mpeg'))) {
            emittedBytes += audioData.length;
            if (typeof onChunk === 'function') {
              onChunk(audioData);
            }
          }
        }
      }
    };

    const drainWsFrames = () => {
      while (!settled && rxBuf.length >= 2) {
        const b0 = rxBuf[0];
        const b1 = rxBuf[1];
        const fin = (b0 & 0x80) !== 0;
        const opcode = b0 & 0x0F;
        const masked = (b1 & 0x80) !== 0;
        let payloadLen = b1 & 0x7F;
        let offset = 2;

        if (payloadLen === 126) {
          if (rxBuf.length < 4) return;
          payloadLen = rxBuf.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (rxBuf.length < 10) return;
          const bigLen = rxBuf.readBigUInt64BE(2);
          if (bigLen > 32n * 1024n * 1024n) {
            return doneReject(new Error('Edge TTS frame too large'));
          }
          payloadLen = Number(bigLen);
          offset = 10;
        }

        const maskLen = masked ? 4 : 0;
        if (rxBuf.length < offset + maskLen + payloadLen) return;

        let payload = rxBuf.subarray(offset + maskLen, offset + maskLen + payloadLen);
        if (masked) {
          const maskKey = rxBuf.subarray(offset, offset + 4);
          const unmasked = Buffer.allocUnsafe(payloadLen);
          for (let i = 0; i < payloadLen; i++) {
            unmasked[i] = payload[i] ^ maskKey[i & 3];
          }
          payload = unmasked;
        } else {
          payload = Buffer.from(payload);
        }
        rxBuf = rxBuf.subarray(offset + maskLen + payloadLen);

        if (opcode >= 0x8) {
          handleCompleteMessage(opcode, payload);
          continue;
        }

        if (opcode !== 0x0) {
          fragOpcode = opcode;
          fragBuffers = [payload];
        } else {
          fragBuffers.push(payload);
        }

        if (fin) {
          const fullPayload = fragBuffers.length === 1 ? fragBuffers[0] : Buffer.concat(fragBuffers);
          const msgOpcode = fragOpcode || 0x1;
          fragBuffers = [];
          fragOpcode = 0;
          handleCompleteMessage(msgOpcode, fullPayload);
        }
      }
    };

    socket.on('data', (chunk) => {
      if (settled) return;
      rxBuf = rxBuf.length > 0 ? Buffer.concat([rxBuf, chunk]) : Buffer.from(chunk);

      if (!handshakeDone) {
        const hdrEndIdx = rxBuf.indexOf('\r\n\r\n');
        if (hdrEndIdx === -1) {
          if (rxBuf.length > 16384) {
            doneReject(new Error('Handshake header overflow'));
          }
          return;
        }
        const rawHdr = rxBuf.subarray(0, hdrEndIdx).toString('latin1');
        rxBuf = rxBuf.subarray(hdrEndIdx + 4);

        const statusLine = rawHdr.split('\r\n')[0] || '';
        const statusMatch = statusLine.match(/^HTTP\/\d\.\d\s+(\d{3})/i);
        const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 0;

        if (statusCode === 403 && attempt < 2) {
          const respHdrs = parseHeadersBlock(rawHdr.slice(rawHdr.indexOf('\r\n') + 2));
          if (adjustClockSkewFromDateHeader(respHdrs.date)) {
            settled = true;
            cleanup();
            try { socket.destroy(); } catch (_) {}
            return streamSingleChunkViaTlsWs({
              escapedChunk, voice, rate, onChunk, signal, timeoutMs, attempt: attempt + 1
            }).then(resolve, reject);
          }
        }

        if (statusCode !== 101) {
          return doneReject(new Error(`Edge TTS handshake HTTP ${statusCode}: ${statusLine.slice(0, 120)}`));
        }

        handshakeDone = true;
        try {
          socket.write(encodeWsClientFrame(0x1, buildSpeechConfigPayload()));
          socket.write(encodeWsClientFrame(0x1, buildSsmlPayload(makeHexId(16), voice, rate, escapedChunk)));
        } catch (sendErr) {
          return doneReject(sendErr);
        }
      }

      drainWsFrames();
    });
  });
}

async function streamEdgeTts({ text, voice = DEFAULT_VOICE, rate = '+0%', onChunk, signal, timeoutMs = 40000, skipClean = false }) {
  const safeVoice = normalizeVoice(voice);
  const safeRate = normalizeRate(rate);
  const cleaned = skipClean ? String(text || '').trim() : cleanTextForSpeech(String(text || ''));
  if (!cleaned) {
    const err = new Error('Teks kosong setelah dibersihkan dari simbol Markdown/kode.');
    err.code = 'EMPTY_CLEAN_TEXT';
    throw err;
  }

  const escaped = escapeXml(removeIncompatibleChars(cleaned));
  const chunks = splitSsmlChunks(escaped, 3600);
  if (chunks.length === 0) {
    const err = new Error('Teks kosong setelah sanitasi XML.');
    err.code = 'EMPTY_CLEAN_TEXT';
    throw err;
  }

  let totalBytes = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (signal && signal.aborted) {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    }
    const n = await streamSingleChunkViaTlsWs({
      escapedChunk: chunks[i],
      voice: safeVoice,
      rate: safeRate,
      onChunk,
      signal,
      timeoutMs
    });
    totalBytes += n;
  }
  return { totalBytes, voice: safeVoice, rate: safeRate };
}

module.exports = {
  TTS_VOICES_LIST,
  ALLOWED_VOICES,
  DEFAULT_VOICE,
  normalizeVoice,
  normalizeRate,
  cleanTextForSpeech,
  removeIncompatibleChars,
  escapeXml,
  splitSsmlChunks,
  generateSecMsGecV2,
  streamEdgeTts
};
