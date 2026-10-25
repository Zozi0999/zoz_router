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
  makeCacheableSignalKeyStore
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
      this.configFile = path.join(this.baseDir, 'wa-master-config.json');
    } else {
      this.baseDir = path.join(__dirname, 'data', 'wa-users', sanitizeUserId(userId));
      this.authDir = path.join(this.baseDir, 'auth');
      this.contactsFile = path.join(this.baseDir, 'contacts.json');
      this.messagesFile = path.join(this.baseDir, 'messages.json');
      this.configFile = path.join(this.baseDir, 'config.json');
    }

    this.contacts = new Map(); // jid -> { id, name, notify, phone, lastMessage, lastTimestamp, unreadCount }
    this.messages = new Map(); // jid -> [ { id, fromMe, text, timestamp, senderName, status } ]
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

    this.loadConfig();
    this.loadPersistedData();
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

    // Untuk grup WhatsApp: tampilkan jika memiliki nama grup
    if (isGroup) {
      return Boolean(rawName && !/^[\d\s+()\-.]+$/.test(rawName));
    }

    // Untuk kontak individual:
    // Wajib memiliki nama asli tersimpan di buku telepon (bukan angka/digit mentah, bukan simbol kosong)
    if (!rawName) return false;
    if (/^[\d\s+()\-.]+$/.test(rawName)) return false;
    if (rawName.length <= 1) return false;
    if (/^[.~!@#$%^&*()_+=[\]{};':",.<>/?]+$/.test(rawName)) return false;

    // Cek apakah ada riwayat percakapan / chat
    const hasChat = Boolean(
      (this.messages.has(c.id) && this.messages.get(c.id).length > 0) ||
      (c.lastMessage && String(c.lastMessage).trim().length > 0)
    );
    if (hasChat) return true;

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
            this.contacts.set(c.id, c);
          });
        }
      }
    } catch (e) {
      console.warn('[WA-Gateway] Gagal memuat wa-contacts.json:', e.message);
    }

    try {
      if (fs.existsSync(this.messagesFile)) {
        const raw = JSON.parse(fs.readFileSync(this.messagesFile, 'utf8'));
        if (raw && typeof raw === 'object') {
          for (const [jid, list] of Object.entries(raw)) {
            if (jid.includes('6281234567890')) continue;
            if (Array.isArray(list)) {
              this.messages.set(jid, list.slice(-200)); // Simpan 200 pesan terakhir per kontak
            }
          }
        }
      }
    } catch (e) {
      console.warn('[WA-Gateway] Gagal memuat wa-messages.json:', e.message);
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
    this.sseClients.add(res);
    res.on('close', () => {
      this.sseClients.delete(res);
    });

    this.startSseHeartbeat();

    // Kirim status awal langsung saat client connect
    const initialPayload = JSON.stringify({
      event: 'status',
      data: this.getStatus()
    });
    res.write(`data: ${initialPayload}\n\n`);
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
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
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
          for (const msg of messages) {
            if (!msg.message) continue;
            const rawJid = msg.key.remoteJid;
            if (!rawJid || rawJid === 'status@broadcast') continue;
            const jid = await this.resolveLidToPhone(rawJid);
            if (jid.endsWith('@lid')) continue;

            const fromMe = Boolean(msg.key.fromMe);
            const text = msg.message.conversation ||
                         msg.message.extendedTextMessage?.text ||
                         msg.message.imageMessage?.caption ||
                         msg.message.videoMessage?.caption ||
                         (msg.message.imageMessage ? '📷 [Foto]' : '') ||
                         (msg.message.audioMessage ? '🎵 [Audio/Voice Note]' : '') ||
                         (msg.message.documentMessage ? `📄 [Dokumen: ${msg.message.documentMessage.fileName || 'file'}]` : '') ||
                         (msg.message.stickerMessage ? '🏷️ [Stiker]' : '') ||
                         '';
            if (!text) continue;

            let ts = Date.now();
            if (msg.messageTimestamp) {
              const rawTs = typeof msg.messageTimestamp === 'number'
                ? msg.messageTimestamp
                : Number(msg.messageTimestamp.low || msg.messageTimestamp);
              ts = rawTs > 9999999999 ? rawTs : rawTs * 1000;
            }

            const id = msg.key.id || `hist_${ts}_${Math.random().toString(36).slice(2, 6)}`;
            const senderName = msg.pushName || (fromMe ? 'Saya' : jid.split('@')[0]);

            if (!this.messages.has(jid)) {
              this.messages.set(jid, []);
            }
            const list = this.messages.get(jid);
            if (!list.some(m => m.id === id)) {
              list.push({ id, fromMe, text, timestamp: ts, senderName, status: fromMe ? 'sent' : 'received' });
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
        for (const msg of messages) {
          if (!msg.message) continue;
          const rawJid = msg.key.remoteJid;
          if (!rawJid || rawJid === 'status@broadcast') continue;
          const jid = await this.resolveLidToPhone(rawJid);
          if (jid.endsWith('@lid')) continue;

          const fromMe = Boolean(msg.key.fromMe);
          const text = msg.message.conversation ||
                       msg.message.extendedTextMessage?.text ||
                       msg.message.imageMessage?.caption ||
                       msg.message.videoMessage?.caption ||
                       (msg.message.imageMessage ? '📷 [Foto]' : '') ||
                       (msg.message.audioMessage ? '🎵 [Audio/Voice Note]' : '') ||
                       (msg.message.documentMessage ? `📄 [Dokumen: ${msg.message.documentMessage.fileName || 'file'}]` : '') ||
                       (msg.message.stickerMessage ? '🏷️ [Stiker]' : '') ||
                       '';

          if (!text && !msg.message.imageMessage && !msg.message.audioMessage) continue;

          let ts = Date.now();
          if (msg.messageTimestamp) {
            const rawTs = typeof msg.messageTimestamp === 'number'
              ? msg.messageTimestamp
              : Number(msg.messageTimestamp.low || msg.messageTimestamp);
            ts = rawTs > 9999999999 ? rawTs : rawTs * 1000;
          }

          const id = msg.key.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const senderName = msg.pushName || (fromMe ? 'Saya' : jid.split('@')[0]);

          const messageItem = {
            id,
            fromMe,
            text,
            timestamp: ts,
            senderName,
            status: fromMe ? 'sent' : 'received'
          };

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

  async sendMessage(jid, text) {
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

    const sent = await this.sock.sendMessage(targetJid, { text });
    const ts = Date.now();
    const messageItem = {
      id: sent.key.id || `msg_${ts}`,
      fromMe: true,
      text,
      timestamp: ts,
      senderName: 'Saya',
      status: 'sent'
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
        lastMessage: text,
        lastTimestamp: ts
      };
      this.contacts.set(targetJid, contact);
    } else {
      contact.lastMessage = text;
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
      lastMessage: '',
      lastTimestamp: Date.now()
    };

    existing.name = name || existing.name;
    existing.phone = cleanPhone;
    this.contacts.set(jid, existing);

    this.savePersistedData();
    this.broadcast('contacts', this.getContacts());
    return existing;
  }

  getContacts() {
    if (!this.status.connected) return [];
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

      return {
        ...c,
        name: formattedName,
        phone: isGroup ? 'Grup WhatsApp' : (c.phone || c.id.split('@')[0]),
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
    if (!this.status.connected) return [];
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
    return list;
  }

  clearChatHistory(jid) {
    if (!jid) return false;
    let targetJid = jid;
    if (!targetJid.includes('@')) {
      targetJid = `${targetJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    }
    this.messages.delete(targetJid);
    const contact = this.contacts.get(targetJid);
    if (contact) {
      contact.lastMessage = '';
      contact.unreadCount = 0;
    }
    this.savePersistedData();
    this.broadcast('contacts', this.getContacts());
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

    // 1. Otorisasi Mutlak Sesi Master Kaisar:
    // Sesi Master Kaisar HANYA boleh diakses jika:
    // a) Permintaan langsung dari localhost loopback (komputer host Kaisar), ATAU
    // b) PIN Master yang sah ('210560' atau hash terverifikasi) disertakan.
    const isMasterPinValid = cleanPin === '210560' || (this.masterGateway && this.masterGateway.verifyPin(cleanPin));
    if (isMasterPinValid || (isLocal && (rawUid === 'usr_kaisar_master' || !rawUid))) {
      return {
        success: true,
        gateway: this.masterGateway,
        isMaster: true,
        userId: 'usr_kaisar_master'
      };
    }

    // 2. Proteksi Akses Ilegal ke Master Kaisar:
    // Jika seseorang meminta 'usr_kaisar_master', 'master', 'kaisar' dari remote TANPA PIN Master -> TOLAK!
    if (rawUid === 'usr_kaisar_master' || rawUid === 'master' || rawUid === 'kaisar' || rawUid === 'usr_e465zuklwesa') {
      return {
        success: false,
        status: 401,
        error: 'Akses Ditolak: PIN Keamanan Master Kaisar (210560) diperlukan untuk membuka akun ini.',
        requiresPin: true,
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
