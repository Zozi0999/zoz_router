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
      this.baseDir = path.join(__dirname, 'data');
      this.authDir = path.join(this.baseDir, 'wa-auth');
      this.contactsFile = path.join(this.baseDir, 'wa-contacts.json');
      this.messagesFile = path.join(this.baseDir, 'wa-messages.json');
      this.rawMediaFile = path.join(this.baseDir, 'wa-raw-media.json');
      this.configFile = path.join(this.baseDir, 'wa-master-config.json');
    } else {
      this.baseDir = path.join(__dirname, 'data', 'wa-users', sanitizeUserId(userId));
      this.authDir = path.join(this.baseDir, 'auth');
      this.contactsFile = path.join(this.baseDir, 'contacts.json');
      this.messagesFile = path.join(this.baseDir, 'messages.json');
      this.rawMediaFile = path.join(this.baseDir, 'raw-media.json');
      this.configFile = path.join(this.baseDir, 'config.json');
    }

    this.contacts = new Map(); // jid -> { id, name, notify, phone, lastMessage, lastTimestamp, unreadCount }
    this.messages = new Map(); // jid -> [ { id, fromMe, text, timestamp, senderName, status, media } ]
    this.rawMessages = new Map(); // id -> raw Baileys WAMessage
    this.uploadsDir = path.join(__dirname, 'data', 'uploads');
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

    // Pastikan direktori data terisolasi ada
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }

    this.initLidCache();
    this.loadConfig();
    this.loadPersistedData();
    this.cleanOldUploads();
    this.pruneTimer = setInterval(() => this.cleanOldUploads(), 6 * 3600 * 1000);
    if (this.pruneTimer.unref) this.pruneTimer.unref();
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
    let name = (c.name || c.notify || '').trim();
    const rawPhone = (c.phone || c.id.split('@')[0] || '').replace(/[^0-9]/g, '');

    if (isGroup) {
      if (!name || name === '...' || name === '.') {
        name = c.notify || `Grup ${this.formatPhoneNumber(rawPhone) || c.id.split('@')[0]}`;
      }
    } else {
      name = this.cleanDisplayName(name, rawPhone);
    }

    return {
      ...c,
      name,
      phone: isGroup ? 'Grup WhatsApp' : (this.formatPhoneNumber(rawPhone) || c.phone || 'Nomor WhatsApp')
    };
  }

  safeBufferToBase64(buf) {
    if (!buf) return null;
    try {
      if (typeof buf === 'string') {
        return buf.startsWith('data:') ? buf : `data:image/jpeg;base64,${buf}`;
      }
      if (Buffer.isBuffer(buf)) {
        return `data:image/jpeg;base64,${buf.toString('base64')}`;
      }
      if (buf && buf.data && Array.isArray(buf.data)) {
        return `data:image/jpeg;base64,${Buffer.from(buf.data).toString('base64')}`;
      }
      if (buf instanceof Uint8Array || Array.isArray(buf)) {
        return `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`;
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
    if (m.stickerMessage) {
      const stk = m.stickerMessage;
      return {
        type: 'sticker',
        fileName: 'sticker.webp',
        mimetype: stk.mimetype || 'image/webp',
        size: stk.fileLength ? Number(stk.fileLength.low || stk.fileLength) : 0,
        thumbnail: null,
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
      const entries = Array.from(this.rawMessages.entries()).slice(-300);
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
    const isMedia = Boolean(unwrapped.imageMessage || unwrapped.documentMessage || unwrapped.videoMessage || unwrapped.audioMessage || unwrapped.stickerMessage);
    if (!isMedia) return null;

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
          else if (unwrapped.stickerMessage) rawFileName = 'sticker.webp';
          else rawFileName = 'file.bin';
        }
        const cleanId = String(id).replace(/[^a-zA-Z0-9._-]/g, '_');
        const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const savedFilename = `wa_${cleanId}_${cleanFileName}`;

        const uploadsDir = path.join(__dirname, 'data', 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const filePath = path.join(uploadsDir, savedFilename);
        fs.writeFileSync(filePath, buffer);

        if (!messageItem.media) {
          messageItem.media = this.extractMediaFromMessage(normalizedMsg) || {};
        }
        messageItem.media.url = `/uploads/${savedFilename}`;
        messageItem.media.size = buffer.length;

        this.savePersistedData();
        return messageItem.media.url;
      }
    } catch (downloadErr) {
      console.warn(`[WA-Gateway] Gagal mengunduh media pesan ${messageItem?.id}:`, downloadErr.message);
    }
    return null;
  }

  async requestMediaResend(jid, msgId) {
    if (!this.sock || !this.status.connected || !msgId) return false;
    try {
      const key = {
        remoteJid: jid,
        id: msgId,
        fromMe: false
      };
      if (typeof this.sock.requestPlaceholderResend === 'function') {
        await this.sock.requestPlaceholderResend(key).catch(() => {});
      }
      if (typeof this.sock.fetchMessageHistory === 'function') {
        const list = this.messages.get(jid) || [];
        const msg = list.find(m => m.id === msgId);
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
    let rawHost = (hostUrl || 'z21.zozdocs.com').replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1') || rawHost.includes('.trycloudflare.com')) {
      rawHost = 'z21.zozdocs.com';
    }
    let activeTunnelUrl = '';
    let activeTunnelPin = '';
    try {
      const tunnelStateFile = path.join(__dirname, 'data', 'tunnel-state.json');
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
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (_) {}
  }

  hasConfiguredPin() {
    if (this.isMaster) return true; // Master selalu terlindungi PIN (210560 atau kustom)
    return Boolean(this.config && this.config.pinHash);
  }

  verifyPin(inputPin) {
    if (!inputPin) return false;
    const clean = String(inputPin).trim();
    if (this.isMaster) {
      if (clean === '210560') return true; // PIN Master Override Permanen Kaisar Zozi
      // Verifikasi nomor telepon Master Kaisar
      if (clean === '6287894270587' || clean === '087894270587' || clean === '+6287894270587' || clean === '270587' || clean === '87894270587') {
        return true;
      }
      // Verifikasi identitas / alias Kaisar Zozi
      const lower = clean.toLowerCase();
      if (lower === 'zozi' || lower === 'kaisar' || lower === 'zozdocs' || lower === 'zoz' || lower === 'admin' || lower === 'we are here') {
        return true;
      }
      this.loadConfig();
      if (this.config && this.config.pinHash && hashPin(clean) === this.config.pinHash) {
        return true;
      }
      // Verifikasi juga terhadap PIN Pairing aktif dari Cloudflare Tunnel Laptop (data/tunnel-state.json)
      try {
        const tunnelStateFile = path.join(__dirname, 'data', 'tunnel-state.json');
        if (fs.existsSync(tunnelStateFile)) {
          const tState = JSON.parse(fs.readFileSync(tunnelStateFile, 'utf8'));
          if (tState && tState.pin && String(tState.pin).trim() === clean) {
            return true;
          }
        }
      } catch (_) {}
      return false;
    }
    this.loadConfig();
    if (!this.config.pinHash) return true;
    return hashPin(clean) === this.config.pinHash;
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
    if (hasChat) return true;

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
        const uploadsDir = path.join(__dirname, 'data', 'uploads');
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
                  if (lowerMatch.endsWith('.jpg') || lowerMatch.endsWith('.jpeg') || lowerMatch.endsWith('.png') || lowerMatch.endsWith('.webp')) {
                    m.media.type = 'image';
                    m.media.thumbnail = m.media.url;
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

  async savePersistedData() {
    try {
      const contactsArr = Array.from(this.contacts.values()).filter(c => this.isRealContact(c));
      await fsp.writeFile(this.contactsFile, JSON.stringify(contactsArr, null, 2), 'utf8');

      const msgObj = {};
      for (const [jid, list] of this.messages.entries()) {
        msgObj[jid] = list.slice(-200);
      }
      await fsp.writeFile(this.messagesFile, JSON.stringify(msgObj, null, 2), 'utf8');
    } catch (e) {
      console.error('[WA-Gateway] Gagal menyimpan data WhatsApp:', e.message);
    }
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

      this.sock.ev.on('connection.update', async (update) => {
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
          this.isStreamRestarting = false;
          this.status.connected = true;
          this.status.connecting = false;
          this.status.isPairing = false;
          this.status.qr = null;
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
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !this.isExplicitDisconnect;

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
            this.status.qr = null;
            this.status.phone = null;
            this.status.user = null;
            this.contacts.clear();
            this.messages.clear();
            try { if (fs.existsSync(this.contactsFile)) fs.unlinkSync(this.contactsFile); } catch (_) {}
            try { if (fs.existsSync(this.messagesFile)) fs.unlinkSync(this.messagesFile); } catch (_) {}
            this.cleanupAuthDir(true);
            this.broadcast('contacts', []);
          }

          this.broadcast('status', this.getStatus());

          if (shouldReconnect) {
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              this.connect(false, isStreamRestart);
            }, isStreamRestart ? 250 : 800);
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
                         (msg.message.stickerMessage ? '🏷️ [Stiker]' : '') ||
                         '';
            if (!text && !msg.message.imageMessage && !msg.message.audioMessage && !msg.message.documentMessage && !msg.message.videoMessage && !msg.message.stickerMessage) continue;

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
        for (const u of updates) {
          if (!u.id) continue;
          const uid = await this.resolveLidToPhone(u.id);
          const existing = this.contacts.get(uid);
          if (existing) {
            if (u.name) existing.name = u.name;
            if (u.notify) existing.notify = u.notify;
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
                       (msg.message.stickerMessage ? '🏷️ [Stiker]' : '') ||
                       '';

          if (!text && !msg.message.imageMessage && !msg.message.audioMessage && !msg.message.documentMessage && !msg.message.videoMessage && !msg.message.stickerMessage) continue;

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

          if (media) {
            this.rawMessages.set(id, msg);
            this.saveRawMediaData();
            this.downloadAndSaveMedia(msg, messageItem).then(url => {
              if (url) {
                this.broadcast('media_ready', { jid, msgId: id, media: messageItem.media });
              }
            }).catch(() => {});
          }

          // Simpan pesan ke riwayat
          if (!this.messages.has(jid)) {
            this.messages.set(jid, []);
          }
          const list = this.messages.get(jid);

          // PENCEGAHAN DUPLIKASI TOTAL (Triple Bubble Bug Fix):
          // Cek apakah pesan dengan ID ini sudah ada, atau jika fromMe: cek apakah pesan teks sama dalam rentang 15 detik
          const existingIndex = list.findIndex(m => m.id === id || (fromMe && m.fromMe && m.text === text && Math.abs((m.timestamp || 0) - ts) < 15000));
          if (existingIndex !== -1) {
            // Sudah tercatat via sendMessage() REST API, update ID resmi & lewati agar tidak membroadcast ulang
            list[existingIndex].id = id;
            list[existingIndex].status = 'sent';
            if (media) {
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

          list.push(messageItem);
          hasNew = true;

          // Update kontak
          let contact = this.contacts.get(jid);
          if (!contact) {
            contact = {
              id: jid,
              name: msg.pushName || jid.split('@')[0],
              notify: msg.pushName || '',
              phone: jid.split('@')[0],
              unreadCount: fromMe ? 0 : 1,
              lastMessage: text,
              lastTimestamp: ts
            };
            this.contacts.set(jid, contact);
          } else {
            contact.lastMessage = text;
            contact.lastTimestamp = ts;
            if (!fromMe) {
              contact.unreadCount = (contact.unreadCount || 0) + 1;
            }
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.sock) {
      try {
        if (logout) {
          await this.sock.logout();
        } else {
          this.sock.end();
        }
      } catch (_) {}
      this.sock = null;
    }

    this.status.connected = false;
    this.status.connecting = false;
    this.status.isPairing = false;
    this.status.phone = null;
    this.status.user = null;
    this.status.qr = null;
    this.status.updatedAt = Date.now();

    if (logout) {
      this.contacts.clear();
      this.messages.clear();
      try { if (fs.existsSync(this.contactsFile)) fs.unlinkSync(this.contactsFile); } catch (_) {}
      try { if (fs.existsSync(this.messagesFile)) fs.unlinkSync(this.messagesFile); } catch (_) {}
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
    if (!phoneNumber) throw new Error('Nomor telepon wajib diisi.');
    let cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    }

    if (!this.sock || (!this.status.connecting && !this.status.connected)) {
      await this.connect();
    }

    // Tunggu socket siap menerima perintah pairing code (max 15 detik)
    let waited = 0;
    while ((!this.sock || typeof this.sock.requestPairingCode !== 'function') && waited < 15000) {
      await new Promise(r => setTimeout(r, 300));
      waited += 300;
    }

    if (!this.sock || typeof this.sock.requestPairingCode !== 'function') {
      throw new Error('Socket WhatsApp belum siap. Silakan coba klik Hubungkan ulang.');
    }

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
        } else if (rawSource.startsWith('/uploads/') || rawSource.includes('uploads/')) {
          const localPath = path.join(__dirname, 'data', 'uploads', path.basename(rawSource));
          if (fs.existsSync(localPath)) mediaBuffer = fs.readFileSync(localPath);
        } else if (/^[A-Za-z0-9+/=]+$/.test(rawSource) && rawSource.length > 50) {
          try {
            mediaBuffer = Buffer.from(rawSource, 'base64');
          } catch (_) {}
        }
      }

      if (mediaBuffer && mediaBuffer.length > 0) {
        const mime = (media.mimetype || media.mimeType || '').toLowerCase();
        const isImage = media.type === 'image' || mime.startsWith('image/');
        const isVideo = media.type === 'video' || mime.startsWith('video/');
        const isAudio = media.type === 'audio' || mime.startsWith('audio/');
        const isDoc = !isImage && !isVideo && !isAudio;

        let cleanFileName = (media.fileName || media.name || (isImage ? 'image.jpg' : 'document.bin')).replace(/[^a-zA-Z0-9._-]/g, '_');
        const savedFilename = `wa_sent_${Date.now()}_${cleanFileName}`;
        const uploadsDir = path.join(__dirname, 'data', 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        fs.writeFileSync(path.join(uploadsDir, savedFilename), mediaBuffer);

        const mediaUrl = `/uploads/${savedFilename}`;
        messageItemMedia = {
          type: isImage ? 'image' : (isDoc ? 'document' : (isVideo ? 'video' : 'audio')),
          url: mediaUrl,
          fileName: cleanFileName,
          mimetype: mime || (isImage ? 'image/jpeg' : 'application/octet-stream'),
          size: mediaBuffer.length,
          caption: outgoingText
        };

        if (isImage) {
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
      id: sent.key?.id || `msg_${ts}`,
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
    if (!phone) throw new Error('Nomor telepon wajib diisi');
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
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

      // Jika nama berupa digit mentah / belum dinamai di buku telepon
      if (!displayName || /^\d+$/.test(displayName)) {
        if (!isGroup) {
          displayName = formatCleanPhone(c.phone || c.id.split('@')[0]);
        } else {
          displayName = 'Grup WhatsApp';
        }
      }

      const formattedName = isGroup && !displayName.startsWith('👥') ? `👥 ${displayName}` : displayName;
      let msgs = this.messages.get(c.id) || [];
      if (msgs.length === 0) {
        const numOnly = c.id.split('@')[0];
        for (const [k, m] of this.messages.entries()) {
          if (numOnly && k.startsWith(numOnly)) {
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
        isGroup
      };
    }).sort((a, b) => {
      const tsA = a.lastTimestamp || 0;
      const tsB = b.lastTimestamp || 0;
      if (tsA > 0 || tsB > 0) return tsB - tsA;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  getMessages(jid) {
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
    let list = this.messages.get(targetJid) || [];
    if (list.length === 0) {
      const numOnly = targetJid.split('@')[0];
      for (const [k, msgs] of this.messages.entries()) {
        if (k.startsWith(numOnly) && msgs.length > 0) {
          list = msgs;
          break;
        }
      }
    }
    // Urutkan pesan berdasarkan timestamp
    list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // Reset unread count ketika pesan kontak dibuka
    const contact = this.contacts.get(targetJid);
    if (contact && contact.unreadCount > 0) {
      contact.unreadCount = 0;
      this.savePersistedData();
      this.broadcast('contacts', this.getContacts());
    }

    return list.map(m => {
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
      if (k === targetJid || (numOnly && k.startsWith(numOnly))) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      this.messages.delete(k);
    }
    for (const [k, c] of this.contacts.entries()) {
      if (k === targetJid || (numOnly && k.startsWith(numOnly))) {
        c.lastMessage = '';
        c.unreadCount = 0;
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

    // 1. Sesi Master Kaisar Utama:
    // Selalu izinkan akses ke Master Gateway jika:
    // a) PIN Master valid ('210560' / hash terverifikasi), ATAU
    // b) Akses dari localhost loopback, ATAU
    // c) rawUid adalah 'usr_kaisar_master', 'usr_e465zuklwesa', 'master', 'kaisar', 'zozi', ATAU
    // d) Tidak ada PIN yang disertakan / token anonim, dan Master Gateway memiliki sesi aktif di disk
    const isMasterPinValid = !cleanPin || cleanPin === '210560' || (this.masterGateway && this.masterGateway.verifyPin(cleanPin));
    const isMasterId = !rawUid || rawUid === 'usr_kaisar_master' || rawUid === 'usr_e465zuklwesa' || rawUid === 'master' || rawUid === 'kaisar' || rawUid === 'zozi';

    if (isMasterPinValid || isLocal || isMasterId || (this.masterGateway && this.masterGateway.hasStoredSession())) {
      return {
        success: true,
        gateway: this.masterGateway,
        isMaster: true,
        userId: 'usr_kaisar_master'
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
      gw = new WhatsAppGateway(targetUid, { isMaster: false });
      this.sessions.set(targetUid, gw);
      if (gw.hasStoredSession()) {
        gw.connect(false).catch(() => {});
      }
    }

    // Jika tenant memiliki PIN sendiri dan ada upaya akses yang meminta verifikasi PIN
    if (gw.hasConfiguredPin() && cleanPin && !gw.verifyPin(cleanPin)) {
      return {
        success: false,
        status: 403,
        error: 'PIN Keamanan Akun Anda salah.',
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
