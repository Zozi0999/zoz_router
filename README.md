# ⚡ ZOZ ROUTER — Neural AI Multi-Engine Gateway

**ZOZ ROUTER** adalah antarmuka web modern, cepat, dan futuristik bertema *Neural Void Cyberpunk* yang dirancang untuk menjalankan dan mengorkestrasi kecerdasan buatan (AI) secara simultan melalui:
1. 🦙 **Ollama** (Model AI Lokal Offline — Llama 3, DeepSeek R1, Qwen 2.5, Mistral, dll.)
2. ⚡ **OpenRouter** (Cloud AI Gateway Flagship — Claude 3.5 Sonnet, GPT-4o, DeepSeek V3/R1, Gemini 2.0 Flash, Llama 3.3 70B, dll.)

---

## 🚀 Fitur Unggulan

- **🦙 Ollama Local Engine Gateway**: Deteksi otomatis seluruh model yang terpasang di Ollama dengan 1-klik refresh, penyesuaian endpoint custom, dan streaming chunked respons super cepat tanpa CORS issue.
- **⚡ OpenRouter Cloud Gateway**: Akses ratusan model LLM terbaik dunia (termasuk model gratis / Free tier) dengan penyimpanan API Key lokal yang aman.
- **🔀 Smart Auto-Router**: Logika perutean cerdas (*Local-First* untuk privasi dan gratis, otomatis failover ke *OpenRouter Cloud* bila Ollama offline atau untuk tugas komputasi berat).
- **🌐 Deep Web Research Engine**: Agen pencarian web mendalam dengan DuckDuckGo live scraping, parsing halaman, dan sintesis ringkasan multi-sumber otomatis.
- **👁️ Multimodal Vision Support**: Unggah dan analisis gambar secara langsung untuk model vision seperti LLaVA, GPT-4o, dan Claude 3.5 Sonnet.
- **🎙️ Voice Speech-to-Text & TTS Reader**: Input prompt menggunakan suara (Mic) dan dengarkan respons AI dengan tombol audio speaker.
- **🎧 Cyber BGM Deck & Local Music Player**: Aktifkan musik latar belakang saat coding/chatting dengan fitur **Upload File Audio Lokal** (MP3, WAV, FLAC, OGG, M4A) yang tersimpan permanen di IndexedDB browser, visualizer spektrum audio neon real-time, kontrol pemutar musik mini di sidebar & full deck modal, serta 4 generator suara prosedural **Cyber Ambient Offline** (Deep Space 432Hz Drone, Synthwave Pulse, Neo-Tokyo Rain, & 10Hz Alpha Waves).
- **👑 Persona & System Prompt Presets**: Preset siap pakai untuk *Kaisar Zozi Personal AI*, *Senior Software Architect*, *Cyber Security Hacker*, *Ultra Ringkas*, dan *Raw Deep Reasoning*.
- **📊 Parameter Tuning**: Kendali penuh atas *Temperature*, *Top-P*, *Max Tokens*, dan *System Instruction*.
- **💾 Session Persistence & Markdown Export**: Seluruh riwayat obrolan tersimpan di browser (`localStorage`) dan dapat diekspor menjadi file `.md` atau disalin per blok kode dengan 1-klik.

---

## 🛠️ Cara Menjalankan

### Cara 1: Menggunakan File Batch (1-Klik)
Cukup klik dua kali file **[`start.bat`](file:///C:/Users/user/zoz-router/start.bat)**. Server akan otomatis aktif dan browser Anda akan langsung membuka `http://localhost:4040`.

### Cara 2: Melalui Terminal / Command Prompt
```bash
cd C:\Users\user\zoz-router
node server.js
```
Lalu buka browser Anda di: `http://localhost:4040`

---

## 🗂️ Struktur Direktori

```
C:\Users\user\zoz-router\
├── server.js          # Node.js Streaming Proxy & Backend (Zero Dependencies)
├── package.json       # Metadata & Scripts
├── start.bat          # 1-Click Windows Launcher
├── README.md          # Dokumentasi Proyek
└── public\
    ├── index.html     # Struktur Antarmuka Cyberpunk UI
    ├── style.css      # Desain Visual Neural Void & Responsive Styling
    ├── app.js         # Logika Client, Stream Parser, & Audio Synthesizer
    └── favicon.svg    # Icon Glowing Hexagon Zoz Router
```

---

## ⌨️ Shortcut Keyboard

| Shortcut | Aksi |
| :--- | :--- |
| `Enter` | Mengirim prompt ke Zoz Router |
| `Shift + Enter` | Membuat baris baru pada input box |
| `Esc` | Menutup jendela popup modal / model catalog |

---

*Dikembangkan untuk Kaisar Zozi — Leviathan Orbital Dominance.*
