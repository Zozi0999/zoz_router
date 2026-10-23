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
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

class WhatsAppGateway {
  constructor() {
    this.sock = null;
    this.authDir = path.join(__dirname, 'data', 'wa-auth');
    this.contactsFile = path.join(__dirname, 'data', 'wa-contacts.json');
    this.messagesFile = path.join(__dirname, 'data', 'wa-messages.json');

    this.contacts = new Map(); // jid -> { id, name, notify, phone, lastMessage, lastTimestamp, unreadCount }
    this.messages = new Map(); // jid -> [ { id, fromMe, text, timestamp, senderName, status } ]

    this.status = {
      connected: false,
      connecting: false,
      phone: null,
      user: null,
      qr: null,
      lastDisconnectReason: null,
      updatedAt: Date.now()
    };

    this.sseClients = new Set();
    this.reconnectTimer = null;
    this.isExplicitDisconnect = false;

    // Pastikan direktori data ada
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
      fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    }

    this.loadPersistedData();
  }

  loadPersistedData() {
    try {
      if (fs.existsSync(this.contactsFile)) {
        const raw = JSON.parse(fs.readFileSync(this.contactsFile, 'utf8'));
        if (Array.isArray(raw)) {
          raw.forEach(c => {
            if (c && c.id) this.contacts.set(c.id, c);
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
      const contactsArr = Array.from(this.contacts.values());
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
      return fs.existsSync(credsFile);
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

    // Kirim status awal langsung saat client connect
    const initialPayload = JSON.stringify({
      event: 'status',
      data: this.getStatus()
    });
    res.write(`data: ${initialPayload}\n\n`);
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
      phone: this.status.phone,
      user: this.status.user,
      qr: this.status.qr,
      pairingCode: this.status.pairingCode || null,
      contactCount: this.contacts.size,
      updatedAt: this.status.updatedAt
    };
  }

  async connect(forceNew = false) {
    if (this.sock && this.status.connected) {
      return this.getStatus();
    }

    if (forceNew) {
      await this.disconnect(true);
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
        version = [2, 3000, 1015901307];
      }

      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Desktop'),
        syncFullHistory: true,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000
      });

      this.sock.ev.on('creds.update', saveCreds);

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
          } catch (qrErr) {
            console.error('[WA-Gateway] Gagal generate QR code:', qrErr.message);
          }
        }

        if (connection === 'open') {
          this.status.connected = true;
          this.status.connecting = false;
          this.status.qr = null;
          this.status.user = this.sock.user;
          const rawId = this.sock.user?.id || '';
          this.status.phone = rawId ? rawId.split(':')[0] : 'Aktif';
          this.status.updatedAt = Date.now();

          console.log(`[WA-Gateway] 🟢 WhatsApp Terhubung! ID: ${this.status.phone}`);
          this.broadcast('status', this.getStatus());
          this.savePersistedData();
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !this.isExplicitDisconnect;

          this.status.connected = false;
          this.status.connecting = false;
          this.status.lastDisconnectReason = statusCode;
          this.status.updatedAt = Date.now();

          console.log(`[WA-Gateway] ⚪ Koneksi terputus. Status Code: ${statusCode}. Reconnect: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut || this.isExplicitDisconnect) {
            this.status.qr = null;
            this.status.phone = null;
            this.status.user = null;
            this.cleanupAuthDir();
          }

          this.broadcast('status', this.getStatus());

          if (shouldReconnect) {
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              this.connect();
            }, 3000);
          }
        }
      });

      // Sinkronisasi Riwayat Chat Penuh dari HP (Messaging History Sync)
      this.sock.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest }) => {
        let changed = false;
        if (Array.isArray(contacts)) {
          for (const c of contacts) {
            if (!c.id || c.id === 'status@broadcast') continue;
            const existing = this.contacts.get(c.id) || {
              id: c.id,
              name: c.name || c.notify || c.verifiedName || c.id.split('@')[0],
              notify: c.notify || '',
              phone: c.id.split('@')[0],
              unreadCount: 0,
              lastMessage: '',
              lastTimestamp: 0
            };
            if (c.name) existing.name = c.name;
            if (c.notify) existing.notify = c.notify;
            this.contacts.set(c.id, existing);
            changed = true;
          }
        }

        if (Array.isArray(chats)) {
          for (const chat of chats) {
            if (!chat.id || chat.id === 'status@broadcast') continue;
            let contact = this.contacts.get(chat.id);
            if (!contact) {
              contact = {
                id: chat.id,
                name: chat.name || chat.id.split('@')[0],
                notify: '',
                phone: chat.id.split('@')[0],
                unreadCount: chat.unreadCount || 0,
                lastMessage: '',
                lastTimestamp: chat.conversationTimestamp ? Number(chat.conversationTimestamp) * 1000 : 0
              };
              this.contacts.set(chat.id, contact);
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
            const jid = msg.key.remoteJid;
            if (!jid || jid === 'status@broadcast') continue;

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
      this.sock.ev.on('contacts.upsert', (newContacts) => {
        let changed = false;
        for (const c of newContacts) {
          if (!c.id || c.id === 'status@broadcast') continue;
          const existing = this.contacts.get(c.id) || {
            id: c.id,
            name: c.name || c.notify || c.verifiedName || c.id.split('@')[0],
            notify: c.notify || '',
            phone: c.id.split('@')[0],
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
          this.contacts.set(c.id, existing);
        }
        if (changed) {
          this.savePersistedData();
          this.broadcast('contacts', this.getContacts());
        }
      });

      this.sock.ev.on('contacts.update', (updates) => {
        let changed = false;
        for (const u of updates) {
          if (!u.id) continue;
          const existing = this.contacts.get(u.id);
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
          const jid = msg.key.remoteJid;
          if (!jid || jid === 'status@broadcast') continue;

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
          // Cek duplikasi ID
          if (!list.some(m => m.id === id)) {
            list.push(messageItem);
            hasNew = true;
          }

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

          // Broadcast pesan baru ke web client
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

      return this.getStatus();
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
    this.status.phone = null;
    this.status.user = null;
    this.status.qr = null;
    this.status.updatedAt = Date.now();

    if (logout) {
      this.cleanupAuthDir();
    }

    this.broadcast('status', this.getStatus());
    return { success: true };
  }

  cleanupAuthDir() {
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        console.log('[WA-Gateway] Sesi auth berhasil dibersihkan.');
      }
    } catch (e) {
      console.warn('[WA-Gateway] Gagal menghapus authDir:', e.message);
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
      throw new Error('WhatsApp belum terhubung. Silakan scan QR code terlebih dahulu.');
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
    const list = Array.from(this.contacts.values());
    // Urutkan berdasarkan interaksi / pesan terakhir (descending)
    return list.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
  }

  getMessages(jid) {
    if (!jid) return [];
    let targetJid = jid;
    if (!targetJid.includes('@')) {
      let cleanPhone = targetJid.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '62' + cleanPhone.slice(1);
      }
      targetJid = `${cleanPhone}@s.whatsapp.net`;
    }
    const list = this.messages.get(targetJid) || [];
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

// Singleton Instance
const waGateway = new WhatsAppGateway();

// Auto-connect jika ada sesi auth tersimpan di disk
if (waGateway.hasStoredSession()) {
  console.log('[WA-Gateway] Sesi tersimpan ditemukan. Memulai koneksi otomatis di latar belakang...');
  waGateway.connect().catch(err => {
    console.warn('[WA-Gateway] Auto-connect tertunda:', err.message);
  });
}

module.exports = waGateway;
