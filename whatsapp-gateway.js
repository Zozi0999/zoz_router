/**
 * ZOZ ROUTER - WhatsApp Web Gateway Engine
 * Powered by @whiskeysockets/baileys & qrcode
 * Handles multi-device session, contact sync, real-time message stream, and REST endpoints.
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const IS_VERCEL_ENV = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const SHARED_DATA_DIR = IS_VERCEL_ENV
  ? path.join('/tmp', 'data')
  : (process.env.ZOZ_DATA_DIR ? path.resolve(process.env.ZOZ_DATA_DIR) : path.join(__dirname, 'data'));

function sanitizeUserId(userId) {
  if (!userId || typeof userId !== 'string') return 'anonymous';
  const clean = userId.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(clean) || clean.length > 64) {
    return 'anonymous';
  }
  return clean;
}

function hashPin(pin) {
  if (!pin) return '';
  return crypto.createHash('sha256').update(String(pin).trim()).digest('hex');
}

function safeCompareStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Unwrap nested / wrapped WAMessage containers (e.g. documentWithCaptionMessage,
 * viewOnceMessage, viewOnceMessageV2, ephemeralMessage, editedMessage).
 */
function unwrapMessage(msg) {
  if (!msg) return msg;
  let curr = msg.message || msg;
  while (curr) {
    if (curr.ephemeralMessage?.message) {
      curr = curr.ephemeralMessage.message;
    } else if (curr.viewOnceMessage?.message) {
      curr = curr.viewOnceMessage.message;
    } else if (curr.viewOnceMessageV2?.message) {
      curr = curr.viewOnceMessageV2.message;
    } else if (curr.viewOnceMessageV2Extension?.message) {
      curr = curr.viewOnceMessageV2Extension.message;
    } else if (curr.documentWithCaptionMessage?.message) {
      curr = curr.documentWithCaptionMessage.message;
    } else if (curr.editedMessage?.message) {
      curr = curr.editedMessage.message;
    } else if (curr.lottieStickerMessage?.message) {
      curr = curr.lottieStickerMessage.message;
    } else if (curr.associatedChildMessage?.message) {
      curr = curr.associatedChildMessage.message;
    } else if (curr.deviceSentMessage?.message) {
      curr = curr.deviceSentMessage.message;
    } else {
      break;
    }
  }
  return curr;
}

class WhatsAppGateway {
  constructor(userId = 'default', options = {}) {
    this.userId = userId;
    this.isMaster = Boolean(options.isMaster || userId === 'usr_kaisar_master');
    this.sock = null;

    if (this.isMaster) {
      this.baseDir = SHARED_DATA_DIR;
      this.authDir = path.join(this.baseDir, 'wa-auth');
      this.contactsFile = path.join(this.baseDir, 'wa-contacts.json');
      this.messagesFile = path.join(this.baseDir, 'wa-messages.json');
      this.rawMediaFile = path.join(this.baseDir, 'wa-raw-media.json');
      this.configFile = path.join(this.baseDir, 'wa-master-config.json');
    } else {
      this.baseDir = path.join(SHARED_DATA_DIR, 'wa-users', sanitizeUserId(userId));
      this.authDir = path.join(this.baseDir, 'auth');
      this.contactsFile = path.join(this.baseDir, 'contacts.json');
      this.messagesFile = path.join(this.baseDir, 'messages.json');
      this.rawMediaFile = path.join(this.baseDir, 'raw-media.json');
      this.configFile = path.join(this.baseDir, 'config.json');
    }

    this.contacts = new Map(); // jid -> { id, name, notify, phone, lastMessage, lastTimestamp, unreadCount, hasAvatar, avatarUpdatedAt, about }
    this.messages = new Map(); // jid -> [ { id, fromMe, text, timestamp, senderName, status, media } ]
    this.rawMessages = new Map(); // id -> raw Baileys WAMessage
    this.groupMetadataCache = new Map(); // jid -> { id, subject, ... }
    this.uploadsDir = path.join(SHARED_DATA_DIR, 'uploads');
    this.avatarsDir = path.join(this.baseDir, 'avatars');
    this._profileSyncInFlight = null;
    this.inFlightDownloads = new Map();
    this._reconnectAttempts = 0;
    this._lastLogoutAt = 0;
    this.createdAt = Date.now();
    this.lastAccessedAt = Date.now();
    this.config = { pinHash: null, createdAt: Date.now() };

    this.status = {
      connected: false,
      connecting: false,
      phone: null,
      user: null,
      qr: null,
      pairingCode: null,
      lastDisconnectReason: null,
      updatedAt: Date.now()
    };

    this.sseClients = new Set();
    this.devices = new Map(); // devId -> { id, platform, icon, userAgent, ip, lastSeen }
    this.reconnectTimer = null;
    this.isExplicitDisconnect = false;
    this._saveTimer = null;
    this._savePromise = null;

    // Hanya buat direktori di konstruktor untuk Master atau tenant yang sudah punya direktori di disk
    // (mencegah banjir direktori & sync I/O dari tenant anonim sekali-pakai)
    if (this.isMaster || fs.existsSync(this.baseDir)) {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }
      this.initLidCache();
      this.loadConfig();
      this.loadPersistedData();
    } else {
      this.lidCache = new Map();
    }

    if (this.isMaster) {
      this.cleanOldUploads();
      this.pruneTimer = setInterval(() => this.cleanOldUploads(), 6 * 3600 * 1000);
      if (this.pruneTimer.unref) this.pruneTimer.unref();
    }
  }

  cleanOldUploads(retentionDays = 30) {
    try {
      if (!fs.existsSync(this.uploadsDir)) return;
      const files = fs.readdirSync(this.uploadsDir);
      const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
      let pruned = 0;
      for (const file of files) {
        const fullPath = path.join(this.uploadsDir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile() && stat.mtimeMs < cutoff) {
            fs.unlinkSync(fullPath);
            pruned++;
          }
        } catch (_) {}
      }
      if (pruned > 0) {
        console.log(`[WA-Gateway] Pruned ${pruned} berkas media lama (> ${retentionDays} hari) dari uploads.`);
      }
    } catch (err) {
      console.warn('[WA-Gateway] Gagal membersihkan media lama:', err.message);
    }
  }

  initLidCache() {
    this.lidCache = new Map();
    try {
      if (fs.existsSync(this.authDir)) {
        const files = fs.readdirSync(this.authDir);
        for (const f of files) {
          if (f.startsWith('lid-mapping-') && f.endsWith('_reverse.json')) {
            const rawLid = f.replace('lid-mapping-', '').replace('_reverse.json', '').replace(/_\d+$/, '');
            try {
              const phone = JSON.parse(fs.readFileSync(path.join(this.authDir, f), 'utf8'));
              if (phone) this.lidCache.set(rawLid, String(phone));
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }

  formatPhoneNumber(num) {
    if (!num) return '';
    const digits = String(num).replace(/[^0-9]/g, '');
    if (!digits) return '';
    if (digits.startsWith('62')) {
      const rest = digits.slice(2);
      if (rest.length <= 8) return `+62 ${rest}`;
      return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`;
    }
    if (digits.startsWith('0')) {
      const rest = digits.slice(1);
      return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`;
    }
    return `+${digits}`;
  }

  cleanDisplayName(rawName, phoneOrJid) {
    const raw = (rawName || '').trim();
    const rawDigits = (phoneOrJid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    const formattedPhone = this.formatPhoneNumber(rawDigits);

    const isMeaningless = !raw ||
      raw === '...' || raw === '..' || raw === '.' || raw === '~' || raw === '-' || raw === '_' || raw === '!?' || raw === '\u200e' ||
      raw.startsWith('120363') || // ID grup WhatsApp yang bocor sebagai nama
      /^[\s._\-~:;*#@!?^$()\[\]{}|\\/]+$/.test(raw) ||
      raw.replace(/[\s._\-~:;*#@!?^$()\[\]{}|\\/]/g, '').length === 0;

    if (isMeaningless) {
      return formattedPhone || 'Pengguna WhatsApp';
    }
    if (/^[0-9]{9,15}$/.test(raw)) {
      return this.formatPhoneNumber(raw);
    }
    return raw;
  }

  cleanContact(c) {
    if (!c || !c.id) return c;
    const isGroup = c.id.endsWith('@g.us');
    let name = (c.name || '').trim();
    let notify = (c.notify || '').trim();
    const rawPhone = (c.phone || c.id.split('@')[0] || '').replace(/[^0-9]/g, '');
    const myPhone = (this.status?.phone || (this.sock?.user?.id ? this.sock.user.id.split(':')[0] : '')).replace(/[^0-9]/g, '');
    const myPushName = (this.sock?.user?.name || '').trim();

    if (isGroup) {
      // Jika nama grup masih nama pengirim individu (~Tinaaa, We Are Here, dsb) atau angka id grup
      const isFakeGroupName = !name || name === '...' || name === '.' || name.startsWith('120363') ||
        name === myPushName || name === 'We Are Here' || name.startsWith('~') || /^\d+$/.test(name);
      if (isFakeGroupName) {
        const cached = this.groupMetadataCache?.get(c.id);
        name = (cached && cached.subject) ? cached.subject : 'Grup WhatsApp';
      }
    } else {
      // Jika kontak individual: cegah pencemaran nama profil akun sendiri ('We Are Here')
      const isMe = myPhone && rawPhone === myPhone;
      if (!isMe && (name === myPushName || name === 'We Are Here')) {
        name = (notify && notify !== myPushName && notify !== 'We Are Here' && notify !== '.' && notify !== '?')
          ? notify
          : this.formatPhoneNumber(rawPhone);
      } else {
        name = this.cleanDisplayName(name, rawPhone);
      }
      if (!isMe && (notify === myPushName || notify === 'We Are Here')) {
        notify = '';
      }
    }

    return {
      ...c,
      name,
      notify,
      phone: isGroup ? 'Grup WhatsApp' : (this.formatPhoneNumber(rawPhone) || c.phone || 'Nomor WhatsApp')
    };
  }

  safeBufferToBase64(buf, defaultMime = 'image/jpeg') {
    if (!buf) return null;
    try {
      if (typeof buf === 'string') {
        return buf.startsWith('data:') ? buf : `data:${defaultMime};base64,${buf}`;
      }
      let rawBuf = null;
      if (Buffer.isBuffer(buf)) {
        rawBuf = buf;
      } else if (buf && buf.data && Array.isArray(buf.data)) {
        rawBuf = Buffer.from(buf.data);
      } else if (buf instanceof Uint8Array || Array.isArray(buf)) {
        rawBuf = Buffer.from(buf);
      }
      if (rawBuf && rawBuf.length > 0) {
        let mime = defaultMime;
        if (rawBuf.length >= 4 && rawBuf[0] === 0x89 && rawBuf[1] === 0x50 && rawBuf[2] === 0x4E && rawBuf[3] === 0x47) {
          mime = 'image/png';
        } else if (rawBuf.length >= 12 && rawBuf.slice(0, 4).toString('ascii') === 'RIFF' && rawBuf.slice(8, 12).toString('ascii') === 'WEBP') {
          mime = 'image/webp';
        } else if (rawBuf.length >= 3 && rawBuf[0] === 0xFF && rawBuf[1] === 0xD8 && rawBuf[2] === 0xFF) {
          mime = 'image/jpeg';
        }
        return `data:${mime};base64,${rawBuf.toString('base64')}`;
      }
    } catch (_) {}
    return null;
  }

  extractMediaFromMessage(msg) {
    if (!msg) return null;
    const m = unwrapMessage(msg);
    if (!m) return null;
    if (m.imageMessage) {
      const img = m.imageMessage;
      const thumb = this.safeBufferToBase64(img.jpegThumbnail);
      return {
        type: 'image',
        fileName: 'photo.jpg',
        mimetype: img.mimetype || 'image/jpeg',
        size: img.fileLength ? Number(img.fileLength.low || img.fileLength) : 0,
        thumbnail: thumb,
        caption: img.caption || '',
        url: null
      };
    }
    if (m.documentMessage) {
      const doc = m.documentMessage;
      const docName = doc.fileName || 'dokumen.bin';
      const thumb = this.safeBufferToBase64(doc.jpegThumbnail);
      return {
        type: 'document',
        fileName: docName,
        mimetype: doc.mimetype || 'application/octet-stream',
        size: doc.fileLength ? Number(doc.fileLength.low || doc.fileLength) : 0,
        pageCount: doc.pageCount ? Number(doc.pageCount) : null,
        thumbnail: thumb,
        caption: doc.caption || '',
        url: null
      };
    }
    if (m.videoMessage) {
      const vid = m.videoMessage;
      const thumb = this.safeBufferToBase64(vid.jpegThumbnail);
      return {
        type: 'video',
        fileName: 'video.mp4',
        mimetype: vid.mimetype || 'video/mp4',
        size: vid.fileLength ? Number(vid.fileLength.low || vid.fileLength) : 0,
        thumbnail: thumb,
        caption: vid.caption || '',
        url: null
      };
    }
    if (m.audioMessage) {
      const aud = m.audioMessage;
      const isM4a = aud.mimetype && aud.mimetype.includes('mp4');
      return {
        type: 'audio',
        fileName: isM4a ? 'audio.m4a' : 'audio.ogg',
        mimetype: aud.mimetype || 'audio/ogg',
        size: aud.fileLength ? Number(aud.fileLength.low || aud.fileLength) : 0,
        seconds: aud.seconds ? Number(aud.seconds) : null,
        thumbnail: null,
        caption: '',
        url: null
      };
    }
    if (m.stickerMessage || m.lottieStickerMessage) {
      const stk = m.stickerMessage || m.lottieStickerMessage?.message?.stickerMessage || m.lottieStickerMessage;
      const thumb = this.safeBufferToBase64(stk.pngThumbnail || stk.jpegThumbnail, 'image/webp');
      return {
        type: 'sticker',
        fileName: 'sticker.webp',
        mimetype: stk.mimetype || 'image/webp',
        isAnimated: Boolean(stk.isAnimated),
        size: stk.fileLength ? Number(stk.fileLength.low || stk.fileLength) : 0,
        thumbnail: thumb,
        caption: '',
        url: null
      };
    }
    return null;
  }

  saveRawMediaData() {
    try {
      if (!this.rawMediaFile) return;
      const obj = {};
      const entries = Array.from(this.rawMessages.entries()).slice(-600);
      for (const [id, msg] of entries) {
        obj[id] = msg;
      }
      fs.writeFileSync(this.rawMediaFile, JSON.stringify(obj), 'utf8');
    } catch (_) {}
  }

  async downloadAndSaveMedia(msg, messageItem) {
    if (!msg) return null;
    const unwrapped = unwrapMessage(msg);
    if (!unwrapped) return null;
    const isMedia = Boolean(
      unwrapped.imageMessage ||
      unwrapped.documentMessage ||
      unwrapped.videoMessage ||
      unwrapped.audioMessage ||
      unwrapped.stickerMessage ||
      unwrapped.lottieStickerMessage
    );
    if (!isMedia) return null;

    const dedupKey = String(messageItem?.id || msg.key?.id || '');
    if (dedupKey && this.inFlightDownloads && this.inFlightDownloads.has(dedupKey)) {
      return this.inFlightDownloads.get(dedupKey);
    }

    const downloadPromise = (async () => {
    try {
      const normalizedMsg = { ...msg, message: unwrapped };
      const buffer = await downloadMediaMessage(
        normalizedMsg,
        'buffer',
        {},
        {
          logger: pino({ level: 'silent' }),
          reuploadRequest: this.sock ? ((m) => this.sock.updateMediaMessage(m)) : undefined
        }
      );

      if (buffer && buffer.length > 0) {
        const id = messageItem?.id || msg.key?.id || `media_${Date.now()}`;
        let rawFileName = messageItem?.media?.fileName;
        if (!rawFileName) {
          if (unwrapped.documentMessage?.fileName) rawFileName = unwrapped.documentMessage.fileName;
          else if (unwrapped.imageMessage) rawFileName = 'photo.jpg';
          else if (unwrapped.audioMessage) rawFileName = (unwrapped.audioMessage.mimetype && unwrapped.audioMessage.mimetype.includes('mp4')) ? 'audio.m4a' : 'audio.ogg';
          else if (unwrapped.videoMessage) rawFileName = 'video.mp4';
          else if (unwrapped.stickerMessage || unwrapped.lottieStickerMessage) rawFileName = 'sticker.webp';
          else rawFileName = 'file.bin';
        }
        const cleanId = String(id).replace(/[^a-zA-Z0-9._-]/g, '_');
        const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const savedFilename = `wa_${cleanId}_${cleanFileName}`;

        const uploadsDir = this.uploadsDir;
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const filePath = path.join(uploadsDir, savedFilename);
        await fsp.writeFile(filePath, buffer);

        const extracted = this.extractMediaFromMessage(normalizedMsg) || {};
        if (!messageItem.media) {
          messageItem.media = { ...extracted };
        } else {
          messageItem.media = { ...extracted, ...messageItem.media };
        }
        if (unwrapped.stickerMessage || unwrapped.lottieStickerMessage || cleanFileName === 'sticker.webp') {
          messageItem.media.type = 'sticker';
          messageItem.media.mimetype = messageItem.media.mimetype || 'image/webp';
        }
        messageItem.media.url = `/uploads/${savedFilename}`;
        messageItem.media.size = buffer.length;
        if ((messageItem.media.type === 'sticker' || messageItem.media.type === 'image') && !messageItem.media.thumbnail) {
          messageItem.media.thumbnail = messageItem.media.url;
        }

        this.savePersistedData();
        return messageItem.media.url;
      }
    } catch (downloadErr) {
      console.warn(`[WA-Gateway] Gagal mengunduh media pesan ${messageItem?.id}:`, downloadErr.message);
    }
    return null;
    })();

    if (dedupKey && this.inFlightDownloads) {
      this.inFlightDownloads.set(dedupKey, downloadPromise);
      downloadPromise.finally(() => {
        if (this.inFlightDownloads.get(dedupKey) === downloadPromise) {
          this.inFlightDownloads.delete(dedupKey);
        }
      });
    }
    return downloadPromise;
  }

  async requestMediaResend(jid, msgId) {
    if (!this.sock || !this.status.connected || !msgId) return false;
    try {
      const list = this.messages.get(jid) || [];
      const msg = list.find(m => m.id === msgId);
      const key = {
        remoteJid: jid,
        id: msgId,
        fromMe: Boolean(msg?.fromMe),
        ...(jid.endsWith('@g.us') && msg?.participant
          ? { participant: msg.participant.includes('@') ? msg.participant : `${msg.participant}@s.whatsapp.net` }
          : {})
      };
      if (typeof this.sock.requestPlaceholderResend === 'function') {
        await this.sock.requestPlaceholderResend(key).catch(() => {});
      }
      if (typeof this.sock.fetchMessageHistory === 'function') {
        const ts = msg?.timestamp || Date.now();
        await this.sock.fetchMessageHistory(15, key, ts).catch(() => {});
      }
      return true;
    } catch (err) {
      console.warn(`[WA-Gateway] Gagal request media resend untuk ${msgId}:`, err.message);
      return false;
    }
  }

  recordDevice(req) {
    if (!req) return;
    try {
      const rawUa = req.headers['user-agent'] || 'Unknown Browser';
      const ip = (req.headers['x-real-ip'] || req.headers['cf-connecting-ip'] || req.socket?.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '');

      let platform = 'Desktop PC';
      let icon = 'fa-laptop';
      if (/android/i.test(rawUa)) {
        platform = 'Ponsel Android';
        icon = 'fa-mobile-screen-button';
      } else if (/iphone|ipad|ipod/i.test(rawUa)) {
        platform = 'Apple iPhone / iPad';
        icon = 'fa-mobile-screen-button';
      } else if (/windows/i.test(rawUa)) {
        platform = 'Windows PC';
        icon = 'fa-desktop';
      } else if (/macintosh|mac os/i.test(rawUa)) {
        platform = 'macOS';
        icon = 'fa-desktop';
      } else if (/linux/i.test(rawUa)) {
        platform = 'Linux Desktop';
        icon = 'fa-desktop';
      }

      const devId = crypto.createHash('md5').update(`${ip}_${rawUa}`).digest('hex').slice(0, 8);
      this.devices.set(devId, {
        id: devId,
        platform,
        icon,
        userAgent: rawUa,
        ip,
        lastSeen: Date.now()
      });
    } catch (_) {}
  }

  getConnectedDevices() {
    const now = Date.now();
    const list = [];

    // 1. Perangkat Handphone Induk WhatsApp (Sesi Baileys Utama)
    if (this.status.connected) {
      list.push({
        id: 'wa_primary_phone',
        name: this.status.phone ? `+${this.status.phone}` : 'Ponsel Induk WhatsApp',
        type: 'phone',
        platform: 'WhatsApp Multi-Device (Ponsel Induk)',
        icon: 'fa-mobile-screen-button',
        status: 'online',
        isMasterDevice: true,
        lastSeen: now
      });
    }

    // 2. Daftar Perangkat Web / Klien yang mengakses sesi ini
    for (const [id, dev] of this.devices.entries()) {
      const isOnline = (now - dev.lastSeen) < 180000; // Aktif dalam 3 menit
      list.push({
        id: dev.id,
        name: dev.platform,
        type: dev.platform.includes('Ponsel') || dev.platform.includes('iPhone') ? 'phone' : 'desktop',
        platform: `${dev.platform} (${dev.ip})`,
        icon: dev.icon || 'fa-laptop',
        status: isOnline ? 'online' : 'idle',
        isMasterDevice: false,
        lastSeen: dev.lastSeen
      });
    }

    return list;
  }

  async generateMobileLink(hostUrl, pin = '') {
    let rawHost = String(hostUrl || 'z21.zozdocs.com').replace(/^https?:\/\//i, '').split('/')[0].trim().toLowerCase();
    const isTrustedPublicHost = /^[a-z0-9.-]+(?::\d{1,5})?$/.test(rawHost) && (
      rawHost === 'z21.zozdocs.com' ||
      rawHost.endsWith('.zozdocs.com') ||
      rawHost === 'zoz-router.vercel.app'
    );
    if (!isTrustedPublicHost || rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1') || rawHost.includes('.trycloudflare.com')) {
      rawHost = 'z21.zozdocs.com';
    }
    let activeTunnelUrl = '';
    let activeTunnelPin = '';
    try {
      const tunnelStateFile = path.join(SHARED_DATA_DIR, 'tunnel-state.json');
      if (fs.existsSync(tunnelStateFile)) {
        const tState = JSON.parse(fs.readFileSync(tunnelStateFile, 'utf8'));
        if (tState && tState.url) activeTunnelUrl = String(tState.url).trim();
        if (tState && tState.pin) activeTunnelPin = String(tState.pin).trim();
      }
    } catch (_) {}

    const cleanPin = pin || (this.isMaster ? (activeTunnelPin || '210560') : '');
    const effectiveUid = this.isMaster ? 'usr_kaisar_master' : (this.userId || 'usr_kaisar_master');
    const tunnelParam = activeTunnelUrl ? `&tunnel=${encodeURIComponent(activeTunnelUrl)}` : '';
    const mobileUrl = `https://${rawHost}/?userId=${encodeURIComponent(effectiveUid)}${cleanPin ? `&pin=${encodeURIComponent(cleanPin)}` : ''}${tunnelParam}&mode=whatsapp`;
    const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
      margin: 2,
      scale: 6,
      color: { dark: '#000000', light: '#ffffff' }
    });
    return {
      url: mobileUrl,
      qr: qrDataUrl,
      userId: effectiveUid,
      isMaster: this.isMaster,
      hasPin: Boolean(cleanPin),
      tunnelUrl: activeTunnelUrl
    };
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const raw = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        if (raw && typeof raw === 'object') {
          this.config = { ...this.config, ...raw };
        }
      }
    } catch (_) {}
  }

  saveConfig() {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (_) {}
  }

  hasConfiguredPin() {
    if (this.isMaster) return true; // Master selalu terlindungi PIN
    this.loadConfig();
    return Boolean(this.config && this.config.pinHash);
  }

  verifyPin(inputPin) {
    if (!inputPin) return false;
    const clean = String(inputPin).trim();
    if (!clean) return false;
    this.loadConfig();
    if (this.isMaster) {
      if (this.config && this.config.pinHash) {
        if (safeCompareStr(hashPin(clean), this.config.pinHash)) return true;
      } else {
        const defaultMasterPin = String(process.env.ZOZ_MASTER_PIN || '210560').trim();
        if (safeCompareStr(clean, defaultMasterPin)) return true;
      }
      // Verifikasi terhadap PIN Pairing aktif dari Cloudflare Tunnel Laptop (data/tunnel-state.json)
      try {
        const tunnelStateFile = path.join(SHARED_DATA_DIR, 'tunnel-state.json');
        if (fs.existsSync(tunnelStateFile)) {
          const tState = JSON.parse(fs.readFileSync(tunnelStateFile, 'utf8'));
          if (tState && tState.pin && safeCompareStr(String(tState.pin).trim(), clean)) {
            return true;
          }
        }
      } catch (_) {}
      return false;
    }
    if (!this.config || !this.config.pinHash) return false;
    return safeCompareStr(hashPin(clean), this.config.pinHash);
  }

  setPin(newPin) {
    if (!newPin || typeof newPin !== 'string') return false;
    const clean = newPin.trim();
    if (clean.length < 4 || clean.length > 16) {
      throw new Error('PIN Keamanan harus antara 4 hingga 16 karakter.');
    }
    this.config.pinHash = hashPin(clean);
    this.config.pinUpdatedAt = Date.now();
    this.saveConfig();
    return true;
  }

  isRealContact(c) {
    if (!c || !c.id) return false;
    if (c.id.includes('6281234567890')) return false;
    if (c.id.endsWith('@lid') || c.id === 'status@broadcast' || c.id.endsWith('@bot')) return false;

    const isGroup = c.id.endsWith('@g.us');
    const rawName = (c.name || '').trim();

    // 1. Cek apakah ada riwayat percakapan / chat (prioritas utama: jika ada chat, pasti kontak aktif!)
    const numOnly = c.id.split('@')[0];
    let hasChat = Boolean(
      (this.messages.has(c.id) && this.messages.get(c.id).length > 0) ||
      (c.lastMessage && String(c.lastMessage).trim().length > 0)
    );
    if (!hasChat && numOnly) {
      for (const [k, msgs] of this.messages.entries()) {
        if (k.startsWith(numOnly) && msgs.length > 0) {
          hasChat = true;
          break;
        }
      }
    }
    if (hasChat || c.hasClearedHistory) return true;

    // 2. Untuk grup WhatsApp tanpa riwayat chat: tampilkan jika memiliki nama grup yang jelas
    if (isGroup) {
      return Boolean(rawName && !/^[\d\s+()\-.]+$/.test(rawName));
    }

    // 3. Untuk kontak individual tanpa riwayat chat: wajib memiliki nama asli tersimpan di buku telepon
    if (!rawName) return false;
    if (/^[\d\s+()\-.]+$/.test(rawName)) return false;
    if (rawName.length <= 1) return false;
    if (/^[.~!@#$%^&*()_+=[\]{};':",.<>/?]+$/.test(rawName)) return false;

    // Jika tanpa riwayat chat: Jika nama sama persis dengan notify (pushname asing), itu adalah anggota grup pasif
    if (c.notify && rawName.toLowerCase() === String(c.notify).trim().toLowerCase()) {
      return false;
    }

    return true;
  }

  loadPersistedData() {
    if (!this.hasStoredSession()) {
      this.contacts.clear();
      this.messages.clear();
      try { if (fs.existsSync(this.contactsFile)) fs.unlinkSync(this.contactsFile); } catch (_) {}
      try { if (fs.existsSync(this.messagesFile)) fs.unlinkSync(this.messagesFile); } catch (_) {}
      return;
    }

    try {
      if (fs.existsSync(this.contactsFile)) {
        const raw = JSON.parse(fs.readFileSync(this.contactsFile, 'utf8'));
        if (Array.isArray(raw)) {
          raw.forEach(c => {
            if (!this.isRealContact(c)) return;
            const cleaned = this.cleanContact(c);
            this.contacts.set(cleaned.id, cleaned);
          });
        }
      }
    } catch (e) {
      console.warn('[WA-Gateway] Gagal memuat wa-contacts.json:', e.message);
    }

    try {
      if (fs.existsSync(this.messagesFile)) {
        const raw = JSON.parse(fs.readFileSync(this.messagesFile, 'utf8'));
        const uploadsDir = this.uploadsDir;
        const diskUploads = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];

        if (raw && typeof raw === 'object') {
          for (const [jid, list] of Object.entries(raw)) {
            if (jid.includes('6281234567890')) continue;
            if (Array.isArray(list)) {
              const enhancedList = list.slice(-200).map(m => {
                // Cari apakah ada berkas media di data/uploads yang cocok dengan ID pesan ini
                const diskMatch = diskUploads.find(f => f.startsWith(`wa_${m.id}_`));
                if (diskMatch) {
                  if (!m.media) m.media = {};
                  m.media.url = `/uploads/${diskMatch}`;
                  try {
                    m.media.size = fs.statSync(path.join(uploadsDir, diskMatch)).size;
                  } catch (_) {}
                  const lowerMatch = diskMatch.toLowerCase();
                  const isStickerMsg = lowerMatch.endsWith('sticker.webp') ||
                    m.media?.type === 'sticker' ||
                    (m.text && /\[(?:Stiker|Sticker)\]/i.test(m.text));
                  if (isStickerMsg) {
                    m.media.type = 'sticker';
                    m.media.fileName = 'sticker.webp';
                    m.media.mimetype = 'image/webp';
                    m.media.thumbnail = m.media.url;
                  } else if (lowerMatch.endsWith('.jpg') || lowerMatch.endsWith('.jpeg') || lowerMatch.endsWith('.png') || lowerMatch.endsWith('.webp')) {
                    m.media.type = 'image';
                    m.media.thumbnail = m.media.url;
                  } else if (lowerMatch.endsWith('.mp4') || lowerMatch.endsWith('.webm') || lowerMatch.endsWith('.mov')) {
                    m.media.type = 'video';
                    if (!m.media.fileName) m.media.fileName = diskMatch.replace(`wa_${m.id}_`, '');
                  } else if (lowerMatch.endsWith('.ogg') || lowerMatch.endsWith('.mp3') || lowerMatch.endsWith('.m4a') || lowerMatch.endsWith('.wav')) {
                    m.media.type = 'audio';
                    if (!m.media.fileName) m.media.fileName = diskMatch.replace(`wa_${m.id}_`, '');
                  } else {
                    m.media.type = 'document';
                    if (!m.media.fileName) m.media.fileName = diskMatch.replace(`wa_${m.id}_`, '');
                  }
                } else if (!m.media && m.text) {
                  const docMatch = m.text.match(/(?:📄\s*)?\[Dokumen:\s*([^\]]+)\]/i);
                  if (docMatch) {
                    const rawName = docMatch[1].trim();
                    const clean = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const ext = rawName.includes('.') ? rawName.slice(rawName.lastIndexOf('.')).toLowerCase() : '';
                    const savedFile = `wa_${m.id}_${clean}`;
                    const localPath = path.join(uploadsDir, savedFile);
                    m.media = {
                      type: 'document',
                      fileName: rawName,
                      mimetype: ext === '.pdf' ? 'application/pdf' : (ext.includes('doc') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream'),
                      url: fs.existsSync(localPath) ? `/uploads/${savedFile}` : null,
                      size: 0
                    };
                  } else if (m.text.includes('📷 [Foto]')) {
                    const savedFile = `wa_${m.id}_photo.jpg`;
                    const localPath = path.join(uploadsDir, savedFile);
                    m.media = {
                      type: 'image',
                      fileName: 'photo.jpg',
                      mimetype: 'image/jpeg',
                      url: fs.existsSync(localPath) ? `/uploads/${savedFile}` : null
                    };
                  } else if (/\[(?:Stiker|Sticker)\]/i.test(m.text)) {
                    const savedFile = `wa_${m.id}_sticker.webp`;
                    const localPath = path.join(uploadsDir, savedFile);
                    m.media = {
                      type: 'sticker',
                      fileName: 'sticker.webp',
                      mimetype: 'image/webp',
                      url: fs.existsSync(localPath) ? `/uploads/${savedFile}` : null
                    };
                  }
                }

                // Sanitasi thumbnail jika berbentuk Buffer serialization
                if (m.media && m.media.thumbnail && typeof m.media.thumbnail !== 'string') {
                  m.media.thumbnail = this.safeBufferToBase64(m.media.thumbnail);
                }

                // Tentukan status berkas (File / Foto / Dokumen / Audio / Video / WPS Link)
                const hasFile = Boolean(
                  m.hasFile ||
                  m.media ||
                  (m.text && (
                    m.text.includes('[Dokumen:') ||
                    m.text.includes('[Document:') ||
                    m.text.includes('[Foto]') ||
                    m.text.includes('[Photo]') ||
                    m.text.includes('[Audio') ||
                    m.text.includes('[Video') ||
                    m.text.includes('[Stiker]') ||
                    m.text.includes('wps.com')
                  ))
                );
                m.hasFile = hasFile;

                // Sinkronisasi peserta jika ada raw message di memori
                if (!m.participant && this.rawMessages && this.rawMessages.has(m.id)) {
                  const rMsg = this.rawMessages.get(m.id);
                  const p = rMsg?.key?.participant || rMsg?.participant;
                  if (p) {
                    const rawLid = p.split('@')[0].split(':')[0].replace(/_\d+$/, '');
                    if (this.lidCache && this.lidCache.has(rawLid)) {
                      m.participant = this.lidCache.get(rawLid);
                    } else {
                      m.participant = rawLid;
                    }
                  }
                }

                // Retroaktif pemetaan pengirim grup yang bocor tanda titik / titik-titik / ID grup
                if (!m.fromMe) {
                  let name = (m.senderName || '').trim();
                  if (jid === '120363433033717333@g.us') {
                    if (name === '...' || (m.text && m.text.includes('Fisliatul aini'))) {
                      m.participant = '6287899163076';
                      m.senderName = this.formatPhoneNumber('6287899163076');
                    } else if (name === '.') {
                      m.participant = '6287871835789';
                      m.senderName = this.formatPhoneNumber('6287871835789');
                    } else if (name.startsWith('120363')) {
                      m.senderName = 'Admin Grup';
                    }
                  } else if (jid.endsWith('@s.whatsapp.net')) {
                    const phone = jid.split('@')[0];
                    if (!name || name === '.' || name === '...' || name === '~') {
                      m.participant = phone;
                      m.senderName = this.formatPhoneNumber(phone);
                    }
                  } else if (name.startsWith('120363')) {
                    m.senderName = 'Admin Grup';
                  }
                }

                const fallbackId = m.participant || (!jid.endsWith('@g.us') ? jid.split('@')[0] : '');
                m.senderName = m.fromMe ? 'Saya' : this.cleanDisplayName(m.senderName, fallbackId);

                return m;
              });
              this.messages.set(jid, enhancedList);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[WA-Gateway] Gagal memuat wa-messages.json:', e.message);
    }

    try {
      if (this.rawMediaFile && fs.existsSync(this.rawMediaFile)) {
        const rawMap = JSON.parse(fs.readFileSync(this.rawMediaFile, 'utf8'));
        if (rawMap && typeof rawMap === 'object') {
          for (const [mid, rmsg] of Object.entries(rawMap)) {
            this.rawMessages.set(mid, rmsg);
          }
        }
      }
    } catch (e) {
      console.warn('[WA-Gateway] Gagal memuat wa-raw-media.json:', e.message);
    }
  }

  savePersistedData(immediate = false) {
    if (immediate) {
      if (this._saveTimer) {
        clearTimeout(this._saveTimer);
        this._saveTimer = null;
      }
      return this._executeAtomicSave();
    }
    if (this._saveTimer) return Promise.resolve();
    return new Promise((resolve) => {
      this._saveTimer = setTimeout(async () => {
        this._saveTimer = null;
        await this._executeAtomicSave();
        resolve();
      }, 1000);
    });
  }

  async _executeAtomicSave() {
    while (this._savePromise) {
      try { await this._savePromise; } catch (_) {}
    }

    const saveStartedAt = Date.now();
    const saveTask = (async () => {
      if (this._lastLogoutAt > saveStartedAt) return;
      if (!fs.existsSync(this.baseDir)) {
        await fsp.mkdir(this.baseDir, { recursive: true });
      }
      const nonce = `${process.pid}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const tmpContacts = `${this.contactsFile}.${nonce}.tmp`;
      const tmpMessages = `${this.messagesFile}.${nonce}.tmp`;
      try {
        const myPhone = (this.status?.phone || (this.sock?.user?.id ? this.sock.user.id.split(':')[0] : '')).replace(/[^0-9]/g, '');
        const myPushName = (this.sock?.user?.name || '').trim();
        const contactsArr = Array.from(this.contacts.values())
          .filter(c => this.isRealContact(c))
          .map(c => {
            const rawPhone = (c.phone || c.id.split('@')[0] || '').replace(/[^0-9]/g, '');
            const isMe = myPhone && rawPhone === myPhone;
            let cleanNotify = (c.notify || '').trim();
            let cleanName = (c.name || '').trim();
            if (!isMe) {
              if (cleanNotify === 'We Are Here' || (myPushName && cleanNotify === myPushName)) cleanNotify = '';
              if (cleanName === 'We Are Here' || (myPushName && cleanName === myPushName)) cleanName = '';
            }
            return {
              ...c,
              name: cleanName || c.name,
              notify: cleanNotify
            };
          });
        await fsp.writeFile(tmpContacts, JSON.stringify(contactsArr, null, 2), 'utf8');
        if (this._lastLogoutAt > saveStartedAt) {
          try { await fsp.unlink(tmpContacts); } catch (_) {}
          return;
        }
        await fsp.rename(tmpContacts, this.contactsFile);

        const msgObj = {};
        for (const [jid, list] of this.messages.entries()) {
          msgObj[jid] = list.slice(-200);
        }
        await fsp.writeFile(tmpMessages, JSON.stringify(msgObj, null, 2), 'utf8');
        if (this._lastLogoutAt > saveStartedAt) {
          try { await fsp.unlink(tmpMessages); } catch (_) {}
          return;
        }
        await fsp.rename(tmpMessages, this.messagesFile);
      } catch (e) {
        console.error('[WA-Gateway] Gagal menyimpan data WhatsApp secara atomik:', e.message);
        try { if (fs.existsSync(tmpContacts)) await fsp.unlink(tmpContacts); } catch (_) {}
        try { if (fs.existsSync(tmpMessages)) await fsp.unlink(tmpMessages); } catch (_) {}
      }
    })();

    this._savePromise = saveTask;
    try {
      await saveTask;
    } finally {
      if (this._savePromise === saveTask) {
        this._savePromise = null;
      }
    }
  }

  async syncGroupMetadata(jid) {
    if (!jid || !jid.endsWith('@g.us') || !this.sock || !this.status.connected) return null;
    try {
      const meta = await this.sock.groupMetadata(jid);
      if (meta && meta.subject) {
        this.groupMetadataCache.set(jid, meta);
        let contact = this.contacts.get(jid);
        if (!contact) {
          contact = {
            id: jid,
            name: meta.subject,
            notify: meta.subject,
            phone: 'Grup WhatsApp',
            unreadCount: 0,
            lastMessage: '',
            lastTimestamp: Date.now()
          };
          this.contacts.set(jid, contact);
        } else {
          contact.name = meta.subject;
          contact.notify = meta.subject;
        }
        this.savePersistedData();
        this.broadcast('contacts', this.getContacts());
        return meta.subject;
      }
    } catch (_) {}
    return null;
  }

  async syncAllGroupMetadata() {
    if (!this.sock || !this.status.connected) return;
    const groupJids = Array.from(this.contacts.keys()).filter(k => k && k.endsWith('@g.us'));
    if (groupJids.length === 0) return;

    for (const jid of groupJids) {
      await this.syncGroupMetadata(jid);
      await new Promise(r => setTimeout(r, 200));
    }
  }

  ensureAvatarsDir() {
    try {
      if (!fs.existsSync(this.avatarsDir)) {
        fs.mkdirSync(this.avatarsDir, { recursive: true });
      }
    } catch (_) {}
  }

  getAvatarFilePath(jid) {
    const safeName = String(jid || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(this.avatarsDir, `${safeName}.jpg`);
  }

  getMyNormalizedJid() {
    const rawId = this.sock?.user?.id || this.status?.user?.id || '';
    const num = rawId ? rawId.split('@')[0].split(':')[0] : '';
    return num ? `${num}@s.whatsapp.net` : '';
  }

  clearCachedAvatars() {
    try {
      if (fs.existsSync(this.avatarsDir)) {
        fs.rmSync(this.avatarsDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }

  getCachedAvatarBuffer(jid) {
    if (!jid) return null;
    try {
      const filePath = this.getAvatarFilePath(jid);
      if (!fs.existsSync(filePath)) return null;
      const buf = fs.readFileSync(filePath);
      if (!buf || buf.length < 32) return null;
      return buf;
    } catch (_) {
      return null;
    }
  }

  async downloadAvatarToCache(jid, remoteUrl) {
    if (!jid || !remoteUrl) return false;
    let tmpPath = '';
    try {
      this.ensureAvatarsDir();
      const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return false;
      const arrBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrBuf);
      if (buf.length < 64) return false;
      const filePath = this.getAvatarFilePath(jid);
      tmpPath = `${filePath}.${process.pid}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.tmp`;
      await fsp.writeFile(tmpPath, buf);
      await fsp.rename(tmpPath, filePath);
      return true;
    } catch (_) {
      try { if (tmpPath && fs.existsSync(tmpPath)) await fsp.unlink(tmpPath); } catch (__) {}
      return false;
    }
  }

  async syncBatchStatuses(jids = []) {
    if (!this.sock || !this.status.connected || typeof this.sock.fetchStatus !== 'function') return 0;
    const targets = jids.filter(j => j && !j.endsWith('@g.us') && !j.endsWith('@lid') && j !== 'status@broadcast');
    if (targets.length === 0) return 0;

    let updated = 0;
    const CHUNK_SIZE = 15;
    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      const chunk = targets.slice(i, i + CHUNK_SIZE);
      try {
        const results = await this.sock.fetchStatus(...chunk);
        if (Array.isArray(results)) {
          for (const item of results) {
            if (!item || !item.id) continue;
            const resolvedId = await this.resolveLidToPhone(item.id);
            const contact = this.contacts.get(resolvedId) || this.contacts.get(item.id);
            if (!contact) continue;
            const rawStatus = typeof item.status === 'string'
              ? item.status
              : (item.status && typeof item.status.status === 'string' ? item.status.status : '');
            const cleanAbout = rawStatus.trim();
            contact.aboutCheckedAt = Date.now();
            if (cleanAbout !== (contact.about || '')) {
              contact.about = cleanAbout;
              updated++;
            }
          }
        }
      } catch (_) {}
      if (i + CHUNK_SIZE < targets.length) {
        await new Promise(r => setTimeout(r, 150));
      }
    }
    return updated;
  }

  async syncContactProfile(jid, { force = false, skipBroadcast = false } = {}) {
    if (!jid || !this.sock || !this.status.connected) return false;
    if (jid === 'status@broadcast' || jid.endsWith('@lid') || jid.includes('6281234567890')) return false;

    const myJid = this.getMyNormalizedJid();
    const isSelfTarget = Boolean(myJid && jid === myJid);
    const contact = this.contacts.get(jid);
    if (!contact && !isSelfTarget) return false;

    const now = Date.now();
    const TTL_MS = 30 * 60 * 1000;
    const lastChecked = isSelfTarget ? (this.status.myAvatarCheckedAt || 0) : (contact?.avatarCheckedAt || 0);
    const currentlyHasAvatar = isSelfTarget ? Boolean(this.status.myHasAvatar) : Boolean(contact?.hasAvatar);
    if (!force && lastChecked && (now - lastChecked) < TTL_MS) {
      if (!currentlyHasAvatar || fs.existsSync(this.getAvatarFilePath(jid))) {
        return false;
      }
    }

    let changed = false;
    if (contact && jid.endsWith('@g.us') && (force || !this.groupMetadataCache.has(jid))) {
      try {
        const meta = await this.sock.groupMetadata(jid);
        if (meta) {
          this.groupMetadataCache.set(jid, meta);
          if (meta.subject && meta.subject !== contact.name) {
            contact.name = meta.subject;
            contact.notify = meta.subject;
            changed = true;
          }
          const desc = typeof meta.desc === 'string' ? meta.desc.trim() : '';
          if (desc && desc !== (contact.about || '')) {
            contact.about = desc.slice(0, 180);
            changed = true;
          }
        }
      } catch (_) {}
    }

    let remotePicUrl = null;
    try {
      remotePicUrl = await this.sock.profilePictureUrl(jid, 'preview', 6000);
    } catch (_) {
      remotePicUrl = null;
    }

    if (remotePicUrl) {
      const ok = await this.downloadAvatarToCache(jid, remotePicUrl);
      if (ok) {
        if (isSelfTarget) {
          this.status.myHasAvatar = true;
          this.status.myAvatarUpdatedAt = now;
        }
        if (contact) {
          contact.hasAvatar = true;
          contact.avatarUpdatedAt = now;
          contact.avatarUrl = remotePicUrl;
          changed = true;
        }
      }
    } else {
      try {
        const fPath = this.getAvatarFilePath(jid);
        if (fs.existsSync(fPath)) fs.unlinkSync(fPath);
      } catch (_) {}
      if (isSelfTarget && this.status.myHasAvatar) {
        this.status.myHasAvatar = false;
      }
      if (contact && contact.hasAvatar) {
        contact.hasAvatar = false;
        contact.avatarUrl = '';
        changed = true;
      }
    }

    if (isSelfTarget) {
      this.status.myAvatarCheckedAt = now;
    }
    if (contact) {
      contact.avatarCheckedAt = now;
    }

    if (!skipBroadcast && changed) {
      this.savePersistedData();
      this.broadcast('contacts', this.getContacts());
    }
    return changed;
  }

  async syncAllProfiles({ force = false, limit = 60 } = {}) {
    if (!this.sock || !this.status.connected) {
      return { success: false, syncedCount: 0, avatarsUpdated: 0, total: 0 };
    }
    if (this._profileSyncInFlight) {
      return await this._profileSyncInFlight;
    }

    this._profileSyncInFlight = (async () => {
      let avatarsUpdated = 0;
      let aboutUpdated = 0;
      let syncedCount = 0;

      try {
        const myJid = this.getMyNormalizedJid();
        if (myJid) {
          await this.syncContactProfile(myJid, { force, skipBroadcast: true });
          this.broadcast('status', this.getStatus());
        }

        const targets = Array.from(this.contacts.values())
          .filter(c => this.isRealContact(c))
          .sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0))
          .slice(0, Math.max(1, limit));

        const individualJids = targets
          .filter(c => !c.id.endsWith('@g.us') && (force || !c.aboutCheckedAt))
          .map(c => c.id);
        if (individualJids.length > 0) {
          aboutUpdated = await this.syncBatchStatuses(individualJids);
        }

        const CONCURRENCY = 4;
        for (let i = 0; i < targets.length; i += CONCURRENCY) {
          if (!this.sock || !this.status.connected) break;
          const batch = targets.slice(i, i + CONCURRENCY);
          const batchResults = await Promise.all(
            batch.map(async (c) => {
              const updated = await this.syncContactProfile(c.id, { force, skipBroadcast: true });
              syncedCount++;
              return updated ? 1 : 0;
            })
          );
          avatarsUpdated += batchResults.reduce((sum, n) => sum + n, 0);

          if ((i + batch.length) < targets.length && (avatarsUpdated > 0 || aboutUpdated > 0)) {
            this.savePersistedData();
            this.broadcast('contacts', this.getContacts());
          }
          if (i + CONCURRENCY < targets.length) {
            await new Promise(r => setTimeout(r, 80));
          }
        }

        this.savePersistedData();
        this.broadcast('contacts', this.getContacts());
        return { success: true, syncedCount, avatarsUpdated, aboutUpdated, total: targets.length };
      } finally {
        this._profileSyncInFlight = null;
      }
    })();

    return await this._profileSyncInFlight;
  }

  hasStoredSession() {
    try {
      const credsFile = path.join(this.authDir, 'creds.json');
      if (!fs.existsSync(credsFile)) return false;
      const raw = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
      return Boolean(raw && raw.me && raw.me.id && (raw.registered === true || raw.account));
    } catch (_) {
      return false;
    }
  }

  // Registrasi SSE Listener untuk push event real-time ke web client
  addSseClient(res) {
    if (!res || res.destroyed || res.writableEnded) return;
    this.sseClients.add(res);
    const removeClient = () => {
      this.sseClients.delete(res);
    };
    res.on('close', removeClient);
    res.on('error', removeClient);
    res.on('finish', removeClient);

    this.startSseHeartbeat();

    // Kirim status awal langsung saat client connect
    try {
      const initialPayload = JSON.stringify({
        event: 'status',
        data: this.getStatus()
      });
      res.write(`data: ${initialPayload}\n\n`);

      // Kirim daftar kontak awal seketika jika ada sesi tersimpan / kontak aktif
      const initialContacts = this.getContacts();
      if (initialContacts && initialContacts.length > 0) {
        res.write(`data: ${JSON.stringify({ event: 'contacts', data: initialContacts })}\n\n`);
      }
      if (typeof res.flush === 'function') res.flush();
    } catch (_) {
      this.sseClients.delete(res);
    }
  }

  startSseHeartbeat() {
    if (this.sseHeartbeatTimer) return;
    this.sseHeartbeatTimer = setInterval(() => {
      if (this.sseClients.size === 0) {
        clearInterval(this.sseHeartbeatTimer);
        this.sseHeartbeatTimer = null;
        return;
      }
      for (const client of this.sseClients) {
        try {
          client.write(': ping\n\n');
        } catch (_) {
          this.sseClients.delete(client);
        }
      }
    }, 15000);
  }

  async resolveLidToPhone(jid) {
    if (!jid || typeof jid !== 'string') return jid;
    if (!jid.endsWith('@lid')) return jid;
    try {
      if (this.sock?.signalRepository?.lidMapping) {
        const pn = await this.sock.signalRepository.lidMapping.getPNForLID(jid);
        if (pn) return pn.replace(/:.*@/, '@');
      }
    } catch (_) {}
    // Fallback: cek pemetaan reverse LID di direktori wa-auth
    try {
      const lidNum = jid.split('@')[0].split(':')[0];
      const revFile = path.join(this.authDir, `lid-mapping-${lidNum}_reverse.json`);
      if (fs.existsSync(revFile)) {
        const phoneNum = JSON.parse(fs.readFileSync(revFile, 'utf8'));
        if (phoneNum) return `${phoneNum}@s.whatsapp.net`;
      }
    } catch (_) {}
    if (this.sock?.user?.lid && jid.startsWith(this.sock.user.lid.split(':')[0])) {
      return this.sock.user.id.replace(/:.*@/, '@');
    }
    return jid;
  }

  broadcast(event, data) {
    const payload = JSON.stringify({ event, data });
    for (const client of this.sseClients) {
      if (client.destroyed || client.writableEnded) {
        this.sseClients.delete(client);
        continue;
      }
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (_) {
        this.sseClients.delete(client);
      }
    }
  }

  getStatus() {
    return {
      connected: this.status.connected,
      connecting: this.status.connecting,
      isPairing: Boolean(this.status.isPairing),
      phone: this.status.phone,
      myName: this.status.user?.name || '',
      myHasAvatar: Boolean(this.status.myHasAvatar),
      myAvatarUpdatedAt: this.status.myAvatarUpdatedAt || 0,
      myJid: this.getMyNormalizedJid(),
      user: this.status.user,
      qr: this.status.qr,
      pairingCode: this.status.pairingCode || null,
      contactCount: this.contacts.size,
      hasPin: this.hasConfiguredPin(),
      hasStoredSession: this.hasStoredSession(),
      userId: this.userId,
      isMaster: this.isMaster,
      updatedAt: this.status.updatedAt
    };
  }

  async connect(forceNew = false, isStreamRestart = false) {
    if (!forceNew && !isStreamRestart && this._connectPromise) {
      return this._connectPromise;
    }
    const task = this._connectImpl(forceNew, isStreamRestart);
    this._connectPromise = task;
    try {
      return await task;
    } finally {
      if (this._connectPromise === task) this._connectPromise = null;
    }
  }

  async _connectImpl(forceNew = false, isStreamRestart = false) {
    if (!forceNew && !isStreamRestart) {
      if (this.sock && this.status.connected) {
        return this.getStatus();
      }
      if (this.sock && this.status.connecting && this.status.qr && (Date.now() - (this.status.updatedAt || 0) < 45000)) {
        return this.getStatus();
      }
      if (this.isStreamRestarting && (Date.now() - (this.lastStreamRestartAt || 0) < 15000)) {
        return this.getStatus();
      }
    }

    if (forceNew) {
      await this.disconnect(true);
    } else {
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners();
          this.sock.end();
        } catch (_) {}
        this.sock = null;
      }
    }

    this.isExplicitDisconnect = false;
    this.status.connecting = true;
    this.status.updatedAt = Date.now();
    this.broadcast('status', this.getStatus());

    try {
      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      let version;
      try {
        const vInfo = await fetchLatestBaileysVersion();
        version = vInfo.version;
      } catch (_) {
        version = [2, 3000, 1043857760];
      }

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Chrome'),
        syncFullHistory: false,
        keepAliveIntervalMs: 25000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 3,
        markOnlineOnConnect: false,
        getMessage: async () => ({ conversation: '' }),
      });

      this.sock.ev.on('creds.update', saveCreds);

      let resolveSettled = null;
      const settlePromise = new Promise((resolve) => {
        resolveSettled = resolve;
      });

      const currentSock = this.sock;
      this.sock.ev.on('connection.update', async (update) => {
        if (this.sock && this.sock !== currentSock) return;
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 6,
              color: {
                dark: '#0f172a',
                light: '#ffffff'
              }
            });
            this.status.qr = qrDataUrl;
            this.status.connecting = true;
            this.status.connected = false;
            this.status.updatedAt = Date.now();
            this.broadcast('qr', { qr: qrDataUrl });
            this.broadcast('status', this.getStatus());
            if (resolveSettled) {
              resolveSettled(this.getStatus());
              resolveSettled = null;
            }
          } catch (qrErr) {
            console.error('[WA-Gateway] Gagal generate QR code:', qrErr.message);
          }
        }

        if (connection === 'open') {
          this._reconnectAttempts = 0;
          this.isStreamRestarting = false;
          this.status.connected = true;
          this.status.connecting = false;
          this.status.isPairing = false;
          this.status.qr = null;
          this.status.pairingCode = null;
          this.status.user = this.sock.user;
          const rawId = this.sock.user?.id || '';
          this.status.phone = rawId ? rawId.split(':')[0] : 'Aktif';
          this.status.updatedAt = Date.now();

          if (this.pingInterval) clearInterval(this.pingInterval);
          this.pingInterval = setInterval(() => {
            try {
              if (this.sock?.ws?.readyState === 1) {
                this.sock.ws.ping?.();
              }
            } catch (_) {}
          }, 20000);

          try {
            if (state && state.creds) {
              state.creds.registered = true;
              await saveCreds();
            }
          } catch (_) {}

          console.log(`[WA-Gateway] 🟢 WhatsApp Terhubung! ID: ${this.status.phone}`);
          this.broadcast('status', this.getStatus());
          this.savePersistedData();

          // Sinkronisasi nama grup & profil orang-orang (foto + bio) di latar belakang
          setTimeout(() => {
            this.syncAllGroupMetadata()
              .then(() => this.syncAllProfiles({ limit: 50, force: false }))
              .catch(() => {});
          }, 800);

          if (resolveSettled) {
            resolveSettled(this.getStatus());
            resolveSettled = null;
          }
        }

        if (connection === 'close') {
          if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
          }
          const statusCode = (lastDisconnect?.error)?.output?.statusCode;
          const isStreamRestart = statusCode === 515;
          const isTerminalDisconnect = statusCode === DisconnectReason.loggedOut ||
                                       statusCode === DisconnectReason.connectionReplaced ||
                                       statusCode === DisconnectReason.multideviceMismatch ||
                                       statusCode === 440 ||
                                       statusCode === 411 ||
                                       statusCode === 403;
          const shouldReconnect = !isTerminalDisconnect && !this.isExplicitDisconnect && (this._reconnectAttempts || 0) < 12;

          this.status.connected = false;
          this.status.lastDisconnectReason = statusCode;
          this.status.updatedAt = Date.now();

          if (isStreamRestart) {
            this.isStreamRestarting = true;
            this.lastStreamRestartAt = Date.now();
            this.status.connecting = true;
            this.status.isPairing = false;
            console.log(`[WA-Gateway] 🔄 Stream Restart (Code: 515) — Menyelesaikan handshake WhatsApp...`);
          } else {
            this.isStreamRestarting = false;
            this.status.connecting = shouldReconnect;
            this.status.isPairing = false;
            console.log(`[WA-Gateway] ⚪ Koneksi terputus. Status Code: ${statusCode}. Reconnect: ${shouldReconnect}`);
          }

          if (statusCode === DisconnectReason.loggedOut || this.isExplicitDisconnect) {
            this._lastLogoutAt = Date.now();
            if (this._saveTimer) {
              clearTimeout(this._saveTimer);
              this._saveTimer = null;
            }
            this.status.qr = null;
            this.status.pairingCode = null;
            this.status.phone = null;
            this.status.user = null;
            this.contacts.clear();
            this.messages.clear();
            if (this.rawMessages) this.rawMessages.clear();
            if (this.groupMetadataCache) this.groupMetadataCache.clear();
            this.clearCachedAvatars();
            try { if (fs.existsSync(this.contactsFile)) fs.unlinkSync(this.contactsFile); } catch (_) {}
            try { if (fs.existsSync(this.messagesFile)) fs.unlinkSync(this.messagesFile); } catch (_) {}
            try { if (this.rawMediaFile && fs.existsSync(this.rawMediaFile)) fs.unlinkSync(this.rawMediaFile); } catch (_) {}
            this.cleanupAuthDir(true);
            this.broadcast('contacts', []);
          }

          this.broadcast('status', this.getStatus());

          if (shouldReconnect) {
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            const attemptIdx = isStreamRestart ? 0 : (this._reconnectAttempts = (this._reconnectAttempts || 0) + 1);
            const delayMs = isStreamRestart ? 250 : Math.min(Math.round(800 * Math.pow(1.8, attemptIdx - 1)), 30000);
            this.reconnectTimer = setTimeout(() => {
              this.connect(false, isStreamRestart).catch(() => {});
            }, delayMs);
          }
        }
      });

      // Sinkronisasi Riwayat Chat Penuh dari HP (Messaging History Sync)
      this.sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
        let changed = false;
        if (Array.isArray(contacts)) {
          for (const c of contacts) {
            if (!c.id || c.id === 'status@broadcast') continue;
            const cid = await this.resolveLidToPhone(c.id);
            if (cid.endsWith('@lid')) continue;
            const existing = this.contacts.get(cid) || {
              id: cid,
              name: c.name || '',
              notify: c.notify || '',
              phone: cid.split('@')[0],
              unreadCount: 0,
              lastMessage: '',
              lastTimestamp: 0
            };
            if (c.name) existing.name = c.name;
            if (c.notify) existing.notify = c.notify;
            this.contacts.set(cid, existing);
            changed = true;
          }
        }

        if (Array.isArray(chats)) {
          for (const chat of chats) {
            if (!chat.id || chat.id === 'status@broadcast') continue;
            const chatId = await this.resolveLidToPhone(chat.id);
            if (chatId.endsWith('@lid')) continue;
            let contact = this.contacts.get(chatId);
            if (!contact) {
              contact = {
                id: chatId,
                name: chat.name || chatId.split('@')[0],
                notify: '',
                phone: chatId.split('@')[0],
                unreadCount: chat.unreadCount || 0,
                lastMessage: '',
                lastTimestamp: chat.conversationTimestamp ? Number(chat.conversationTimestamp) * 1000 : 0
              };
              this.contacts.set(chatId, contact);
            } else {
              if (chat.name && !contact.name) contact.name = chat.name;
              if (chat.unreadCount !== undefined) contact.unreadCount = chat.unreadCount;
              if (chat.conversationTimestamp) contact.lastTimestamp = Number(chat.conversationTimestamp) * 1000;
            }
            changed = true;
          }
        }

        if (Array.isArray(messages)) {
          for (const rawMsg of messages) {
            if (!rawMsg) continue;
            const msg = { ...rawMsg, message: unwrapMessage(rawMsg) };
            if (!msg.message) continue;
            const rawJid = msg.key?.remoteJid;
            if (!rawJid || rawJid === 'status@broadcast') continue;
            const jid = await this.resolveLidToPhone(rawJid);
            if (jid.endsWith('@lid')) continue;

            const fromMe = Boolean(msg.key?.fromMe);
            const text = msg.message.conversation ||
                         msg.message.extendedTextMessage?.text ||
                         msg.message.imageMessage?.caption ||
                         msg.message.videoMessage?.caption ||
                         (msg.message.imageMessage ? '📷 [Foto]' : '') ||
                         (msg.message.audioMessage ? '🎵 [Audio/Voice Note]' : '') ||
                         (msg.message.documentMessage ? `📄 [Dokumen: ${msg.message.documentMessage.fileName || 'file'}]` : '') ||
                         ((msg.message.stickerMessage || msg.message.lottieStickerMessage) ? '🏷️ [Stiker]' : '') ||
                         '';
            if (!text && !msg.message.imageMessage && !msg.message.audioMessage && !msg.message.documentMessage && !msg.message.videoMessage && !msg.message.stickerMessage && !msg.message.lottieStickerMessage) continue;

            let ts = Date.now();
            if (msg.messageTimestamp) {
              const rawTs = typeof msg.messageTimestamp === 'number'
                ? msg.messageTimestamp
                : Number(msg.messageTimestamp.low || msg.messageTimestamp);
              ts = rawTs > 9999999999 ? rawTs : rawTs * 1000;
            }

            const media = this.extractMediaFromMessage(msg);
            const id = msg.key.id || `hist_${ts}_${Math.random().toString(36).slice(2, 6)}`;
            
            const rawParticipant = msg.key?.participant || msg.participant || '';
            let senderPhone = '';
            if (rawParticipant) {
              const pJid = await this.resolveLidToPhone(rawParticipant);
              senderPhone = pJid ? pJid.split('@')[0].split(':')[0] : '';
            }
            if (!senderPhone && !fromMe && !jid.endsWith('@g.us')) {
              senderPhone = jid.split('@')[0].split(':')[0];
            }

            const rawSenderName = fromMe ? 'Saya' : (msg.pushName || '');
            const senderName = fromMe ? 'Saya' : this.cleanDisplayName(rawSenderName, senderPhone || (!jid.endsWith('@g.us') ? jid.split('@')[0] : ''));
            const hasFile = Boolean(media || (text && (text.includes('[Dokumen:') || text.includes('[Document:') || text.includes('[Foto]') || text.includes('[Photo]') || text.includes('[Audio') || text.includes('[Video') || text.includes('[Stiker]') || text.includes('wps.com'))));

            if (!this.messages.has(jid)) {
              this.messages.set(jid, []);
            }
            const list = this.messages.get(jid);
            const existing = list.find(m => m.id === id);
            if (!existing) {
              const item = {
                id,
                fromMe,
                text,
                timestamp: ts,
                senderName,
                participant: senderPhone,
                hasFile,
                status: fromMe ? 'sent' : 'received',
                ...(media ? { media } : {})
              };
              list.push(item);
              if (media) {
                this.rawMessages.set(id, msg);
                this.saveRawMediaData();
                this.downloadAndSaveMedia(msg, item).then(url => {
                  if (url) this.broadcast('media_ready', { jid, msgId: id, media: item.media });
                }).catch(() => {});
              }
            } else {
              if (media) {
                this.rawMessages.set(id, msg);
                this.saveRawMediaData();
                if (!existing.media || !existing.media.url) {
                  existing.media = { ...(existing.media || {}), ...media };
                  this.downloadAndSaveMedia(msg, existing).then(url => {
                    if (url) this.broadcast('media_ready', { jid, msgId: id, media: existing.media });
                  }).catch(() => {});
                }
              }
            }

            let contact = this.contacts.get(jid);
            if (contact && (!contact.lastTimestamp || ts >= contact.lastTimestamp)) {
              contact.lastMessage = text;
              contact.lastTimestamp = ts;
            }
            changed = true;
          }
        }

        if (changed) {
          this.savePersistedData();
          this.broadcast('contacts', this.getContacts());
        }
      });

      // Sinkronisasi Kontak Masuk / Update
      this.sock.ev.on('contacts.upsert', async (newContacts) => {
        let changed = false;
        for (const c of newContacts) {
          if (!c.id || c.id === 'status@broadcast') continue;
          const cid = await this.resolveLidToPhone(c.id);
          if (cid.endsWith('@lid')) continue;
          const existing = this.contacts.get(cid) || {
            id: cid,
            name: c.name || '',
            notify: c.notify || '',
            phone: cid.split('@')[0],
            unreadCount: 0,
            lastMessage: '',
            lastTimestamp: 0
          };
          if (c.name && c.name !== existing.name) {
            existing.name = c.name;
            changed = true;
          }
          if (c.notify && !existing.notify) {
            existing.notify = c.notify;
            changed = true;
          }
          this.contacts.set(cid, existing);
        }
        if (changed) {
          this.savePersistedData();
          this.broadcast('contacts', this.getContacts());
        }
      });

      this.sock.ev.on('contacts.update', async (updates) => {
        let changed = false;
        const avatarRefreshJids = [];
        for (const u of updates) {
          if (!u.id) continue;
          const uid = await this.resolveLidToPhone(u.id);
          const existing = this.contacts.get(uid);
          if (existing) {
            if (u.name) existing.name = u.name;
            if (u.notify) existing.notify = u.notify;
            changed = true;
          }
          if (u.imgUrl !== undefined) {
            avatarRefreshJids.push(uid);
          }
        }
        if (changed) {
          this.savePersistedData();
          this.broadcast('contacts', this.getContacts());
        }
        for (const refreshJid of avatarRefreshJids) {
          this.syncContactProfile(refreshJid, { force: true }).catch(() => {});
        }
      });

      // Sinkronisasi Nama Subjek Grup WhatsApp Asli
      this.sock.ev.on('groups.update', async (groupUpdates) => {
        let changed = false;
        for (const update of groupUpdates) {
          if (!update.id) continue;
          const jid = update.id;
          const subject = (update.subject || '').trim();
          if (subject) {
            let contact = this.contacts.get(jid);
            if (!contact) {
              contact = {
                id: jid,
                name: subject,
                notify: subject,
                phone: 'Grup WhatsApp',
                unreadCount: 0,
                lastMessage: '',
                lastTimestamp: Date.now()
              };
              this.contacts.set(jid, contact);
            } else {
              contact.name = subject;
              contact.notify = subject;
            }
            if (this.groupMetadataCache) {
              const prev = this.groupMetadataCache.get(jid) || {};
              this.groupMetadataCache.set(jid, { ...prev, id: jid, subject });
            }
            changed = true;
          }
        }
        if (changed) {
          this.savePersistedData();
          this.broadcast('contacts', this.getContacts());
        }
      });

      this.sock.ev.on('groups.upsert', async (groups) => {
        let changed = false;
        for (const g of groups) {
          if (!g.id) continue;
          const jid = g.id;
          const subject = (g.subject || g.name || '').trim();
          if (subject) {
            let contact = this.contacts.get(jid);
            if (!contact) {
              contact = {
                id: jid,
                name: subject,
                notify: subject,
                phone: 'Grup WhatsApp',
                unreadCount: 0,
                lastMessage: '',
                lastTimestamp: Date.now()
              };
              this.contacts.set(jid, contact);
            } else {
              contact.name = subject;
              contact.notify = subject;
            }
            if (this.groupMetadataCache) {
              const prev = this.groupMetadataCache.get(jid) || {};
              this.groupMetadataCache.set(jid, { ...prev, id: jid, subject });
            }
            changed = true;
          }
        }
        if (changed) {
          this.savePersistedData();
          this.broadcast('contacts', this.getContacts());
        }
      });

      // Menangani Pesan Masuk / Keluar
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        let hasNew = false;
        for (const rawMsg of messages) {
          if (!rawMsg) continue;
          const msg = { ...rawMsg, message: unwrapMessage(rawMsg) };
          if (!msg.message) continue;
          const rawJid = msg.key?.remoteJid;
          if (!rawJid || rawJid === 'status@broadcast') continue;
          const jid = await this.resolveLidToPhone(rawJid);
          if (jid.endsWith('@lid')) continue;

          // Penanganan Pesan Dihapus Pengirim (Revoke / Delete for everyone)
          if (msg.message.protocolMessage && (msg.message.protocolMessage.type === 0 || msg.message.protocolMessage.type === 5)) {
            const targetMsgId = msg.message.protocolMessage.key?.id;
            if (targetMsgId) {
              const list = this.messages.get(jid) || [];
              const targetMsg = list.find(m => m.id === targetMsgId);
              if (targetMsg) {
                targetMsg.text = '🚫 Pesan ini telah dihapus oleh pengirim';
                targetMsg.isDeleted = true;
                targetMsg.media = null;
                const contact = this.contacts.get(jid);
                if (contact && contact.lastMessage) {
                  contact.lastMessage = '🚫 Pesan ini telah dihapus';
                }
                this.savePersistedData();
                this.broadcast('message_revoked', { jid, msgId: targetMsgId });
              }
            }
            continue;
          }

          // Penanganan Reaksi Emoji (reactionMessage)
          if (msg.message.reactionMessage) {
            const reaction = msg.message.reactionMessage;
            const targetMsgId = reaction.key?.id;
            const emoji = reaction.text || '';
            if (targetMsgId) {
              const list = this.messages.get(jid) || [];
              const targetMsg = list.find(m => m.id === targetMsgId);
              if (targetMsg) {
                targetMsg.reaction = emoji;
                this.savePersistedData();
                this.broadcast('message_reaction', { jid, msgId: targetMsgId, reaction: emoji });
              }
            }
            continue;
          }

          const fromMe = Boolean(msg.key?.fromMe);
          const text = msg.message.conversation ||
                       msg.message.extendedTextMessage?.text ||
                       msg.message.imageMessage?.caption ||
                       msg.message.videoMessage?.caption ||
                       (msg.message.imageMessage ? '📷 [Foto]' : '') ||
                       (msg.message.audioMessage ? '🎵 [Audio/Voice Note]' : '') ||
                       (msg.message.documentMessage ? `📄 [Dokumen: ${msg.message.documentMessage.fileName || 'file'}]` : '') ||
                       ((msg.message.stickerMessage || msg.message.lottieStickerMessage) ? '🏷️ [Stiker]' : '') ||
                       '';

          if (!text && !msg.message.imageMessage && !msg.message.audioMessage && !msg.message.documentMessage && !msg.message.videoMessage && !msg.message.stickerMessage && !msg.message.lottieStickerMessage) continue;

          let ts = Date.now();
          if (msg.messageTimestamp) {
            const rawTs = typeof msg.messageTimestamp === 'number'
              ? msg.messageTimestamp
              : Number(msg.messageTimestamp.low || msg.messageTimestamp);
            ts = rawTs > 9999999999 ? rawTs : rawTs * 1000;
          }

          const id = msg.key.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          
          const rawParticipant = msg.key?.participant || msg.participant || '';
          let senderPhone = '';
          if (rawParticipant) {
            const pJid = await this.resolveLidToPhone(rawParticipant);
            senderPhone = pJid ? pJid.split('@')[0].split(':')[0] : '';
          }
          if (!senderPhone && !fromMe && !jid.endsWith('@g.us')) {
            senderPhone = jid.split('@')[0].split(':')[0];
          }

          const rawSenderName = fromMe ? 'Saya' : (msg.pushName || '');
          const senderName = fromMe ? 'Saya' : this.cleanDisplayName(rawSenderName, senderPhone || (!jid.endsWith('@g.us') ? jid.split('@')[0] : ''));
          const media = this.extractMediaFromMessage(msg);
          const hasFile = Boolean(media || (text && (text.includes('[Dokumen:') || text.includes('[Document:') || text.includes('[Foto]') || text.includes('[Photo]') || text.includes('[Audio') || text.includes('[Video') || text.includes('[Stiker]') || text.includes('wps.com'))));

          const messageItem = {
            id,
            fromMe,
            text,
            timestamp: ts,
            senderName,
            participant: senderPhone,
            hasFile,
            status: fromMe ? 'sent' : 'received',
            ...(media ? { media } : {})
          };

          // Simpan pesan ke riwayat (cek duplikasi dulu agar downloadAndSaveMedia selalu memutasi item yang benar)
          if (!this.messages.has(jid)) {
            this.messages.set(jid, []);
          }
          const list = this.messages.get(jid);

          // PENCEGAHAN DUPLIKASI:
          // Cocokkan ID pesan resmi Baileys, atau fallback optimistic temp ID saat tidak membawa media
          const existingIndex = list.findIndex(m =>
            m.id === id ||
            (fromMe && m.fromMe && !media && String(m.id || '').startsWith('msg_') && m.text === text && Math.abs((m.timestamp || 0) - ts) < 15000)
          );
          if (existingIndex !== -1) {
            // Sudah tercatat via sendMessage() REST API, update ID resmi & lewati agar tidak membroadcast ulang
            list[existingIndex].id = id;
            list[existingIndex].status = 'sent';
            if (media) {
              if (this.rawMessages.size >= 300) {
                const oldestRaw = this.rawMessages.keys().next().value;
                if (oldestRaw !== undefined) this.rawMessages.delete(oldestRaw);
              }
              this.rawMessages.set(id, msg);
              this.saveRawMediaData();
              if (!list[existingIndex].media || !list[existingIndex].media.url) {
                list[existingIndex].media = { ...(list[existingIndex].media || {}), ...media };
                this.downloadAndSaveMedia(msg, list[existingIndex]).then(url => {
                  if (url) this.broadcast('media_ready', { jid, msgId: id, media: list[existingIndex].media });
                }).catch(() => {});
              }
            }
            continue;
          }

          if (media) {
            if (this.rawMessages.size >= 300) {
              const oldestRaw = this.rawMessages.keys().next().value;
              if (oldestRaw !== undefined) this.rawMessages.delete(oldestRaw);
            }
            this.rawMessages.set(id, msg);
            this.saveRawMediaData();
            this.downloadAndSaveMedia(msg, messageItem).then(url => {
              if (url) {
                this.broadcast('media_ready', { jid, msgId: id, media: messageItem.media });
              }
            }).catch(() => {});
          }

          list.push(messageItem);
          if (list.length > 250) list.splice(0, list.length - 250);
          hasNew = true;

          // Update kontak secara akurat (Anti-Ngarang)
          const isGroup = jid.endsWith('@g.us');
          let contact = this.contacts.get(jid);
          const myPushName = (this.sock?.user?.name || '').trim();
          const validPush = (!fromMe && msg.pushName && msg.pushName.trim() && msg.pushName.trim() !== myPushName && !/^[.~!@#$%^&*()_+=[\]{};':",.<>/?\s-]+$/.test(msg.pushName.trim()))
            ? msg.pushName.trim()
            : '';

          if (!contact) {
            let initialName = isGroup ? 'Grup WhatsApp' : (validPush || this.formatPhoneNumber(jid.split('@')[0]) || jid.split('@')[0]);
            if (isGroup && this.groupMetadataCache && this.groupMetadataCache.has(jid)) {
              initialName = this.groupMetadataCache.get(jid).subject || initialName;
            }
            contact = {
              id: jid,
              name: initialName,
              notify: isGroup ? '' : validPush,
              phone: isGroup ? 'Grup WhatsApp' : jid.split('@')[0],
              unreadCount: fromMe ? 0 : 1,
              lastMessage: text,
              lastTimestamp: ts
            };
            this.contacts.set(jid, contact);
            if (isGroup) {
              this.syncGroupMetadata(jid).catch(() => {});
            }
          } else {
            contact.lastMessage = text;
            contact.lastTimestamp = ts;
            if (!fromMe) {
              contact.unreadCount = (contact.unreadCount || 0) + 1;
              if (validPush && !isGroup) {
                contact.notify = validPush;
                const currentName = (contact.name || '').trim();
                const isPlaceholder = !currentName ||
                  currentName === contact.phone ||
                  currentName === 'We Are Here' ||
                  currentName === 'Pengguna WhatsApp' ||
                  /^[0-9+()\-\s]+$/.test(currentName);
                if (isPlaceholder) {
                  contact.name = validPush;
                }
              }
            }
            if (isGroup) {
              const currentGName = (contact.name || '').trim();
              if (!currentGName || currentGName === 'Grup WhatsApp' || currentGName.startsWith('~') || currentGName === 'We Are Here' || currentGName.startsWith('120363')) {
                this.syncGroupMetadata(jid).catch(() => {});
              }
            }
          }

          if (!contact.avatarCheckedAt) {
            this.syncContactProfile(jid, { force: false }).catch(() => {});
          }

          // Broadcast pesan baru HANYA untuk pesan baru yang belum ada di layar
          this.broadcast('new_message', {
            jid,
            message: messageItem,
            contact
          });
        }

        if (hasNew) {
          this.savePersistedData();
          this.broadcast('contacts', this.getContacts());
        }
      });

      // Tunggu instan hingga QR code siap atau koneksi terjalin (maksimal 4.5 detik)
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(this.getStatus()), 4500));
      return await Promise.race([settlePromise, timeoutPromise]);
    } catch (err) {
      console.error('[WA-Gateway] Kesalahan saat inisialisasi socket:', err);
      this.status.connecting = false;
      this.status.connected = false;
      this.status.updatedAt = Date.now();
      this.broadcast('status', this.getStatus());
      throw err;
    }
  }

  async disconnect(logout = true) {
    this.isExplicitDisconnect = true;
    this.isStreamRestarting = false;
    this._reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.sock) {
      const sockToClose = this.sock;
      this.sock = null;
      try {
        sockToClose.ev?.removeAllListeners?.();
        if (logout) {
          await sockToClose.logout();
        } else {
          sockToClose.end();
        }
      } catch (_) {}
    }

    this.status.connected = false;
    this.status.connecting = false;
    this.status.isPairing = false;
    this.status.phone = null;
    this.status.user = null;
    this.status.qr = null;
    this.status.pairingCode = null;
    this.status.updatedAt = Date.now();

    if (logout) {
      this._lastLogoutAt = Date.now();
      if (this._saveTimer) {
        clearTimeout(this._saveTimer);
        this._saveTimer = null;
      }
      this.contacts.clear();
      this.messages.clear();
      if (this.rawMessages) this.rawMessages.clear();
      if (this.groupMetadataCache) this.groupMetadataCache.clear();
      this.clearCachedAvatars();
      try { if (fs.existsSync(this.contactsFile)) fs.unlinkSync(this.contactsFile); } catch (_) {}
      try { if (fs.existsSync(this.messagesFile)) fs.unlinkSync(this.messagesFile); } catch (_) {}
      try { if (this.rawMediaFile && fs.existsSync(this.rawMediaFile)) fs.unlinkSync(this.rawMediaFile); } catch (_) {}
      this.cleanupAuthDir(true);
      this.broadcast('contacts', []);
    }

    this.broadcast('status', this.getStatus());
    return { success: true };
  }

  cleanupAuthDir(purgeAll = false) {
    try {
      if (fs.existsSync(this.authDir)) {
        const files = fs.readdirSync(this.authDir);
        for (const file of files) {
          if (purgeAll || !file.startsWith('lid-mapping-')) {
            fs.rmSync(path.join(this.authDir, file), { force: true, recursive: true });
          }
        }
        console.log(`[WA-Gateway] Sesi auth berhasil dibersihkan${purgeAll ? ' (seluruh cache dibersihkan)' : ' (LID mappings dipertahankan)'}.`);
      }
    } catch (e) {
      console.warn('[WA-Gateway] Gagal membersihkan authDir:', e.message);
    }
  }

  async requestPairingCode(phoneNumber) {
    if (phoneNumber === null || phoneNumber === undefined || String(phoneNumber).trim() === '') {
      throw new Error('Nomor telepon wajib diisi.');
    }
    let cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    }
    if (cleanPhone.length < 7 || cleanPhone.length > 16) {
      throw new Error('Format nomor telepon tidak valid (minimal 7 digit angka).');
    }
    if (this.status.connected) {
      throw new Error('Sesi WhatsApp sudah terhubung. Putuskan koneksi terlebih dahulu jika ingin menautkan nomor baru.');
    }

    if (!this.sock || !this.status.connecting) {
      await this.connect();
    }

    // Tunggu socket WebSocket terbuka / QR state siap menerima perintah pairing code (max 15 detik)
    let waited = 0;
    while (
      (!this.sock || typeof this.sock.requestPairingCode !== 'function' || (this.sock.ws && this.sock.ws.readyState !== 1 && !this.status.qr)) &&
      waited < 15000
    ) {
      await new Promise(r => setTimeout(r, 300));
      waited += 300;
    }

    if (!this.sock || typeof this.sock.requestPairingCode !== 'function') {
      throw new Error('Socket WhatsApp belum siap. Silakan coba klik Hubungkan ulang.');
    }

    this.status.isPairing = true;
    const rawCode = await this.sock.requestPairingCode(cleanPhone);
    const formatted = rawCode ? (rawCode.match(/.{1,4}/g)?.join('-') || rawCode) : '';
    this.status.pairingCode = formatted;
    this.broadcast('pairing_code', { code: formatted, phone: cleanPhone });
    return { code: formatted, phone: cleanPhone };
  }

  async sendMessage(jid, text, options = {}) {
    if (!this.sock || !this.status.connected) {
      if (this.hasStoredSession() || this.status.connecting) {
        if (!this.status.connecting) {
          this.connect(false).catch(() => {});
        }
        let waited = 0;
        while ((!this.sock || !this.status.connected) && waited < 6000) {
          await new Promise(r => setTimeout(r, 250));
          waited += 250;
        }
      }
      if (!this.sock || !this.status.connected) {
        throw new Error('WhatsApp belum terhubung. Silakan scan QR code terlebih dahulu.');
      }
    }

    let targetJid = jid;
    if (!targetJid.includes('@')) {
      let cleanPhone = targetJid.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.slice(1);
      }
      targetJid = `${cleanPhone}@s.whatsapp.net`;
    }

    let sent = null;
    let messageItemMedia = null;
    let outgoingText = text || '';

    // Deteksi mention anggota grup (@628xxx) jika mengirim ke WhatsApp Group
    const mentions = [];
    if (options && Array.isArray(options.mentions)) {
      for (const m of options.mentions) {
        let clean = String(m).replace(/[^0-9]/g, '');
        if (clean) mentions.push(clean.includes('@') ? clean : `${clean}@s.whatsapp.net`);
      }
    }
    if (targetJid.endsWith('@g.us') && outgoingText) {
      const matches = outgoingText.match(/@(\d{9,16})/g);
      if (matches) {
        for (const match of matches) {
          const num = match.replace('@', '');
          const mentionJid = `${num}@s.whatsapp.net`;
          if (!mentions.includes(mentionJid)) {
            mentions.push(mentionJid);
          }
        }
      }
    }

    const media = options && options.media ? options.media : null;
    let mediaBuffer = null;
    if (media && (media.data || media.buffer || media.url)) {
      const rawSource = media.data || media.buffer || media.url;
      if (Buffer.isBuffer(rawSource)) {
        mediaBuffer = rawSource;
      } else if (typeof rawSource === 'string') {
        if (rawSource.startsWith('data:')) {
          const b64 = rawSource.replace(/^data:[^;]+;base64,/, '');
          mediaBuffer = Buffer.from(b64, 'base64');
        } else if (rawSource.startsWith('/uploads/')) {
          const baseName = path.basename(rawSource);
          if (baseName && baseName !== '.' && baseName !== '..' && !baseName.includes('/') && !baseName.includes('\\')) {
            const localPath = path.join(this.uploadsDir, baseName);
            try {
              if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
                mediaBuffer = fs.readFileSync(localPath);
              }
            } catch (_) {}
          }
        } else if (/^[A-Za-z0-9+/=]+$/.test(rawSource) && rawSource.length > 50) {
          try {
            mediaBuffer = Buffer.from(rawSource, 'base64');
          } catch (_) {}
        }
      }

      if (mediaBuffer && mediaBuffer.length > 0) {
        const mime = (media.mimetype || media.mimeType || '').toLowerCase();
        const isSticker = media.type === 'sticker' || (mime === 'image/webp' && /sticker|stiker/i.test(media.fileName || media.name || ''));
        const isImage = !isSticker && (media.type === 'image' || mime.startsWith('image/'));
        const isVideo = media.type === 'video' || mime.startsWith('video/');
        const isAudio = media.type === 'audio' || mime.startsWith('audio/');
        const isDoc = !isSticker && !isImage && !isVideo && !isAudio;

        let cleanFileName = (media.fileName || media.name || (isSticker ? 'sticker.webp' : (isImage ? 'image.jpg' : 'document.bin'))).replace(/[^a-zA-Z0-9._-]/g, '_');
        const savedFilename = `wa_sent_${Date.now()}_${cleanFileName}`;
        const uploadsDir = this.uploadsDir;
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        fs.writeFileSync(path.join(uploadsDir, savedFilename), mediaBuffer);

        const mediaUrl = `/uploads/${savedFilename}`;
        messageItemMedia = {
          type: isSticker ? 'sticker' : (isImage ? 'image' : (isDoc ? 'document' : (isVideo ? 'video' : 'audio'))),
          url: mediaUrl,
          fileName: cleanFileName,
          mimetype: mime || (isSticker ? 'image/webp' : (isImage ? 'image/jpeg' : 'application/octet-stream')),
          size: mediaBuffer.length,
          caption: outgoingText
        };

        if (isSticker) {
          sent = await this.sock.sendMessage(targetJid, {
            sticker: mediaBuffer,
            mimetype: 'image/webp'
          });
          if (!outgoingText) outgoingText = '🏷️ [Stiker]';
        } else if (isImage) {
          sent = await this.sock.sendMessage(targetJid, {
            image: mediaBuffer,
            caption: outgoingText,
            mimetype: mime || 'image/jpeg',
            ...(mentions.length > 0 ? { mentions } : {})
          });
          if (!outgoingText) outgoingText = '📷 [Foto]';
        } else if (isVideo) {
          sent = await this.sock.sendMessage(targetJid, {
            video: mediaBuffer,
            caption: outgoingText,
            mimetype: mime || 'video/mp4',
            ...(mentions.length > 0 ? { mentions } : {})
          });
          if (!outgoingText) outgoingText = '📹 [Video]';
        } else if (isAudio) {
          sent = await this.sock.sendMessage(targetJid, {
            audio: mediaBuffer,
            mimetype: mime || 'audio/mp4',
            ptt: true
          });
          if (!outgoingText) outgoingText = '🎵 [Audio/Voice Note]';
        } else {
          sent = await this.sock.sendMessage(targetJid, {
            document: mediaBuffer,
            mimetype: mime || 'application/octet-stream',
            fileName: cleanFileName,
            caption: outgoingText,
            ...(mentions.length > 0 ? { mentions } : {})
          });
          if (!outgoingText) outgoingText = `📄 [Dokumen: ${cleanFileName}]`;
        }
      }
    }

    if (!sent) {
      if (!outgoingText.trim()) {
        throw new Error('Pesan WhatsApp tidak boleh kosong.');
      }
      sent = await this.sock.sendMessage(targetJid, {
        text: outgoingText,
        ...(mentions.length > 0 ? { mentions } : {})
      });
    }

    const ts = Date.now();
    const messageItem = {
      id: (sent && sent.key && sent.key.id) ? sent.key.id : `msg_${ts}`,
      fromMe: true,
      text: outgoingText,
      timestamp: ts,
      senderName: 'Saya',
      status: 'sent',
      ...(options && options.tempId ? { tempId: options.tempId } : {}),
      ...(messageItemMedia ? { media: messageItemMedia } : {})
    };

    if (!this.messages.has(targetJid)) {
      this.messages.set(targetJid, []);
    }
    this.messages.get(targetJid).push(messageItem);

    // Update kontak
    let contact = this.contacts.get(targetJid);
    if (!contact) {
      contact = {
        id: targetJid,
        name: targetJid.split('@')[0],
        notify: '',
        phone: targetJid.split('@')[0],
        unreadCount: 0,
        lastMessage: outgoingText,
        lastTimestamp: ts
      };
      this.contacts.set(targetJid, contact);
    } else {
      contact.lastMessage = outgoingText;
      contact.lastTimestamp = ts;
    }

    await this.savePersistedData();
    this.broadcast('new_message', { jid: targetJid, message: messageItem, contact });
    this.broadcast('contacts', this.getContacts());

    return messageItem;
  }

  addOrUpdateContact(name, phone) {
    if (phone === null || phone === undefined || String(phone).trim() === '') {
      throw new Error('Nomor telepon wajib diisi');
    }
    let cleanPhone = String(phone).replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    }
    if (cleanPhone.length < 5 || cleanPhone.length > 18) {
      throw new Error('Format nomor telepon tidak valid');
    }
    const jid = `${cleanPhone}@s.whatsapp.net`;

    const existing = this.contacts.get(jid) || {
      id: jid,
      name: name || cleanPhone,
      notify: '',
      phone: cleanPhone,
      unreadCount: 0,
      lastMessage: 'Kontak baru ditambahkan',
      lastTimestamp: Date.now()
    };

    existing.name = name || existing.name || cleanPhone;
    existing.phone = cleanPhone;
    if (!existing.lastMessage) existing.lastMessage = 'Kontak baru ditambahkan';
    this.contacts.set(jid, existing);

    this.savePersistedData();
    this.broadcast('contacts', this.getContacts());
    if (this.sock && this.status.connected) {
      this.syncContactProfile(jid, { force: true }).catch(() => {});
    }
    return existing;
  }

  getContacts() {
    if (!this.status.connected && !this.hasStoredSession() && this.contacts.size === 0) return [];
    const list = Array.from(this.contacts.values()).filter(c => this.isRealContact(c));

    const formatCleanPhone = (num) => {
      let digits = String(num || '').replace(/[^0-9]/g, '');
      if (digits.startsWith('62')) {
        return `+62 ${digits.slice(2, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`;
      }
      return digits.length > 5 ? `+${digits.slice(0, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}` : digits;
    };

    const cleanText = (str) => {
      if (!str) return '';
      return str.replace(/dY[^\s]+/g, '').replace(/[\uFFFD]/g, '').trim();
    };

    return list.map(c => {
      let displayName = cleanText(c.name || '');
      const isGroup = c.id.endsWith('@g.us');
      const myPhone = (this.status?.phone || (this.sock?.user?.id ? this.sock.user.id.split(':')[0] : '')).replace(/[^0-9]/g, '');
      const myPushName = (this.sock?.user?.name || '').trim();

      if (isGroup) {
        // Jika nama grup masih berupa ID, '~Tinaaa', 'We Are Here', atau belum subjek asli
        const isBadName = !displayName || displayName === '...' || displayName === 'Grup WhatsApp' ||
          displayName.startsWith('120363') || displayName.startsWith('~') || displayName === 'We Are Here' || displayName === myPushName;
        if (isBadName) {
          const cached = this.groupMetadataCache?.get(c.id);
          if (cached && cached.subject) {
            displayName = cleanText(cached.subject);
          } else {
            displayName = 'Grup WhatsApp';
            if (this.sock && this.status.connected) {
              this.syncGroupMetadata(c.id).catch(() => {});
            }
          }
        }
      } else {
        const rawPhone = (c.phone || c.id.split('@')[0] || '').replace(/[^0-9]/g, '');
        const isMe = myPhone && rawPhone === myPhone;
        // Jika kontak individual dinamai nama akun sendiri 'We Are Here'
        if (!isMe && (displayName === 'We Are Here' || displayName === myPushName)) {
          displayName = (c.notify && c.notify !== 'We Are Here' && c.notify !== myPushName && c.notify !== '.' && c.notify !== '?')
            ? cleanText(c.notify)
            : formatCleanPhone(rawPhone);
        }
        // Jika nama berupa digit mentah / belum dinamai di buku telepon
        if (!displayName || /^\d+$/.test(displayName)) {
          if (c.notify && c.notify !== '.' && c.notify !== '?' && c.notify !== 'We Are Here' && c.notify !== myPushName && !/^\d+$/.test(c.notify)) {
            displayName = cleanText(c.notify);
          } else {
            displayName = formatCleanPhone(rawPhone);
          }
        }
      }

      const formattedName = isGroup && !displayName.startsWith('👥') ? `👥 ${displayName}` : displayName;
      let msgs = this.messages.get(c.id) || [];
      if (msgs.length === 0) {
        const numOnly = c.id.split('@')[0];
        for (const [k, m] of this.messages.entries()) {
          if (this.matchesJidKey(k, c.id, numOnly)) {
            msgs = m;
            break;
          }
        }
      }
      const hasFile = Boolean(
        c.hasFile ||
        msgs.some(m => m.hasFile || m.media || (m.text && (
          m.text.includes('[Dokumen:') ||
          m.text.includes('[Document:') ||
          m.text.includes('[Foto]') ||
          m.text.includes('[Photo]') ||
          m.text.includes('[Audio') ||
          m.text.includes('[Video') ||
          m.text.includes('[Stiker]') ||
          m.text.includes('wps.com')
        ))) ||
        (c.lastMessage && (
          c.lastMessage.includes('[Dokumen:') ||
          c.lastMessage.includes('[Document:') ||
          c.lastMessage.includes('[Foto]') ||
          c.lastMessage.includes('[Photo]') ||
          c.lastMessage.includes('wps.com')
        ))
      );

      return {
        ...c,
        name: formattedName,
        phone: isGroup ? 'Grup WhatsApp' : (c.phone || c.id.split('@')[0]),
        hasFile,
        isGroup,
        hasAvatar: Boolean(c.hasAvatar),
        avatarUpdatedAt: c.avatarUpdatedAt || 0,
        about: c.about || ''
      };
    }).sort((a, b) => {
      const tsA = a.lastTimestamp || 0;
      const tsB = b.lastTimestamp || 0;
      if (tsA > 0 || tsB > 0) return tsB - tsA;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  matchesJidKey(key, targetJid, numOnly) {
    if (!key) return false;
    if (key === targetJid) return true;
    return Boolean(numOnly) && key.startsWith(`${numOnly}@`);
  }

  getMessages(jid, options = {}) {
    if (!this.status.connected && !this.hasStoredSession() && (!this.messages || this.messages.size === 0)) return [];
    if (!jid) return [];
    if (jid.includes('6281234567890')) return [];
    let targetJid = jid;
    if (!targetJid.includes('@')) {
      let cleanPhone = targetJid.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.slice(1);
      }
      targetJid = `${cleanPhone}@s.whatsapp.net`;
    }
    let rawList = this.messages.get(targetJid) || [];
    if (rawList.length === 0) {
      const numOnly = targetJid.split('@')[0];
      for (const [k, msgs] of this.messages.entries()) {
        if (this.matchesJidKey(k, targetJid, numOnly) && msgs.length > 0) {
          rawList = msgs;
          break;
        }
      }
    }
    const list = [...rawList].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // Reset unread count hanya saat dibuka pengguna (bukan lookup media internal)
    if (options.markAsRead !== false) {
      const contact = this.contacts.get(targetJid);
      if (contact && contact.unreadCount > 0) {
        contact.unreadCount = 0;
        this.savePersistedData();
        this.broadcast('contacts', this.getContacts());
      }
    }

    return list.map(m => {
      if (!m.media && m.text && /\[(?:Stiker|Sticker)\]/i.test(m.text)) {
        const safeId = String(m.id || '').replace(/[^a-zA-Z0-9._-]/g, '_');
        const savedFile = `wa_${safeId}_sticker.webp`;
        const localPath = path.join(this.uploadsDir, savedFile);
        m.media = {
          type: 'sticker',
          fileName: 'sticker.webp',
          mimetype: 'image/webp',
          url: fs.existsSync(localPath) ? `/uploads/${savedFile}` : null
        };
      } else if (m.media && (m.media.type === 'sticker' || m.media.fileName === 'sticker.webp' || (m.text && /\[(?:Stiker|Sticker)\]/i.test(m.text)))) {
        m.media.type = 'sticker';
        if (!m.media.fileName) m.media.fileName = 'sticker.webp';
        if (!m.media.url) {
          const safeId = String(m.id || '').replace(/[^a-zA-Z0-9._-]/g, '_');
          const savedFile = `wa_${safeId}_sticker.webp`;
          const localPath = path.join(this.uploadsDir, savedFile);
          if (fs.existsSync(localPath)) {
            m.media.url = `/uploads/${savedFile}`;
          }
        }
      }
      if (m.media && !m.media.url && this.rawMessages && this.rawMessages.has(m.id)) {
        const rawMsg = this.rawMessages.get(m.id);
        this.downloadAndSaveMedia(rawMsg, m).then(url => {
          if (url) this.broadcast('media_ready', { jid: targetJid, msgId: m.id, media: m.media });
        }).catch(() => {});
      }
      const hasFile = Boolean(
        m.hasFile ||
        m.media ||
        (m.text && (
          m.text.includes('[Dokumen:') ||
          m.text.includes('[Document:') ||
          m.text.includes('[Foto]') ||
          m.text.includes('[Photo]') ||
          m.text.includes('[Audio') ||
          m.text.includes('[Video') ||
          m.text.includes('[Stiker]') ||
          m.text.includes('wps.com')
        ))
      );
      const fallbackId = m.participant || (!targetJid.endsWith('@g.us') ? targetJid.split('@')[0] : '');
      const senderName = m.fromMe ? 'Saya' : this.cleanDisplayName(m.senderName, fallbackId);
      return {
        ...m,
        hasFile,
        senderName
      };
    });
  }

  clearChatHistory(jid) {
    if (!jid) return false;
    let targetJid = jid;
    if (!targetJid.includes('@')) {
      targetJid = `${targetJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    }
    const numOnly = targetJid.split('@')[0];
    const keysToDelete = [];
    for (const k of this.messages.keys()) {
      if (this.matchesJidKey(k, targetJid, numOnly)) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      this.messages.delete(k);
    }
    for (const [k, c] of this.contacts.entries()) {
      if (this.matchesJidKey(k, targetJid, numOnly)) {
        c.lastMessage = '';
        c.unreadCount = 0;
        c.hasClearedHistory = true;
      }
    }
    this.savePersistedData();
    this.broadcast('contacts', this.getContacts());
    this.broadcast('chat_cleared', { jid: targetJid, numOnly });
    return true;
  }
}

/**
 * WhatsAppGatewayManager
 * Multi-tenant session isolation manager for Baileys WhatsApp Gateway.
 * Isolates user directories, contacts, and messages.
 * Protects Master Kaisar session behind PIN 210560.
 */
class WhatsAppGatewayManager {
  constructor() {
    this.sessions = new Map(); // userId -> WhatsAppGateway instance
    // Sesi Master Kaisar Zozi (Port 4040, sesi asli)
    this.masterGateway = new WhatsAppGateway('usr_kaisar_master', { isMaster: true });
    this.sessions.set('usr_kaisar_master', this.masterGateway);
    this.sessions.set('usr_e465zuklwesa', this.masterGateway);

    // Auto-connect Master session jika kredensial auth tersimpan di disk
    if (this.masterGateway.hasStoredSession()) {
      console.log('[WA-Manager] Master Sesi Kaisar terdeteksi di disk. Menjalankan auto-connect di background...');
      this.masterGateway.connect(false).catch(err => {
        console.warn('[WA-Manager] Auto-connect Master Kaisar tertunda:', err.message);
      });
    }
  }

  resolveGateway(userId, pin, isLocal = false) {
    const cleanPin = pin ? String(pin).trim() : '';
    const rawUid = userId ? String(userId).trim() : '';

    const isMasterId = rawUid === 'usr_kaisar_master' || rawUid === 'usr_e465zuklwesa' || rawUid === 'master' || rawUid === 'kaisar' || rawUid === 'zozi';

    // 1. Sesi Master Kaisar Utama:
    // WAJIB memenuhi salah satu syarat otentikasi ketat:
    // a) Permintaan dari localhost loopback mesin lokal pemilik, ATAU
    // b) PIN Master terverifikasi melalui masterGateway.verifyPin() (tanpa bypass hardcoded)
    const isMasterPinValid = Boolean(cleanPin && this.masterGateway && this.masterGateway.verifyPin(cleanPin));

    if ((isMasterId && (isLocal || isMasterPinValid)) || (isLocal && (!rawUid || isMasterId))) {
      return {
        success: true,
        gateway: this.masterGateway,
        isMaster: true,
        userId: 'usr_kaisar_master'
      };
    }

    if (isMasterId && !isLocal && !isMasterPinValid) {
      return {
        success: false,
        status: 403,
        requiresPin: true,
        userId: 'usr_kaisar_master',
        error: 'Akses remote ke Master Kaisar ditolak: PIN Master 6-digit yang valid wajib disertakan.'
      };
    }

    // 3. Multi-Tenant User Terisolasi (Google Anonymous Guest Mode):
    // Setiap pengunjung publik memiliki ID anonim unik dan terisolasi
    let targetUid = sanitizeUserId(rawUid);
    if (!targetUid || targetUid === 'default' || targetUid === 'anonymous' || targetUid.length < 5) {
      targetUid = 'usr_anon_' + crypto.randomBytes(6).toString('hex');
    }

    let gw = this.sessions.get(targetUid);
    if (!gw) {
      // Batasi jumlah sesi tamu tidak aktif di memori untuk mencegah memory/session exhaustion DoS
      if (this.sessions.size >= 60) {
        let oldestKey = null;
        let oldestTs = Infinity;
        for (const [k, v] of this.sessions.entries()) {
          if (v && !v.isMaster && !v.status?.connected && !v.status?.connecting && !v.hasConfiguredPin()) {
            const ts = v.lastAccessedAt || v.createdAt || 0;
            if (ts < oldestTs) {
              oldestTs = ts;
              oldestKey = k;
            }
          }
        }
        if (oldestKey) {
          const evicted = this.sessions.get(oldestKey);
          if (evicted) {
            if (evicted.reconnectTimer) { clearTimeout(evicted.reconnectTimer); evicted.reconnectTimer = null; }
            if (evicted._saveTimer) { clearTimeout(evicted._saveTimer); evicted._saveTimer = null; }
            if (evicted.sseHeartbeatTimer) { clearInterval(evicted.sseHeartbeatTimer); evicted.sseHeartbeatTimer = null; }
            if (evicted.pingInterval) { clearInterval(evicted.pingInterval); evicted.pingInterval = null; }
            if (evicted.sseClients) {
              for (const c of evicted.sseClients) { try { if (!c.writableEnded) c.end(); } catch (_) {} }
              evicted.sseClients.clear();
            }
          }
          this.sessions.delete(oldestKey);
        }
      }
      gw = new WhatsAppGateway(targetUid, { isMaster: false });
      this.sessions.set(targetUid, gw);
      if (gw.hasStoredSession()) {
        gw.connect(false).catch(() => {});
      }
    }
    gw.lastAccessedAt = Date.now();

    // Jika tenant memiliki PIN sendiri, wajibkan verifikasi PIN valid pada setiap akses (termasuk saat pin kosong)
    if (gw.hasConfiguredPin() && !gw.verifyPin(cleanPin)) {
      return {
        success: false,
        status: 403,
        error: cleanPin ? 'PIN Keamanan Akun Anda salah.' : 'PIN Keamanan Akun wajib dimasukkan.',
        requiresPin: true,
        userId: targetUid
      };
    }

    return {
      success: true,
      gateway: gw,
      isMaster: false,
      userId: targetUid
    };
  }

  getGateway(userId) {
    return this.sessions.get(userId) || null;
  }
}

// Singleton Manager
const waGatewayManager = new WhatsAppGatewayManager();

module.exports = {
  WhatsAppGateway,
  WhatsAppGatewayManager,
  waGatewayManager,
  waGateway: waGatewayManager.masterGateway // Kompatibilitas mundur
};
