# ⚡ ZOZ ROUTER — Neural AI Multi-Engine & Command Terminal Gateway
> **Version:** `v335 (Quantum Orbital Edition)`  
> **Architecture:** *Neural Void Glassmorphism • Dual-Channel BioEndocrine • Hybrid Local/Cloud • ConPTY Terminal Engine*  
> **Pembuat / Creator:** **Zozi Atul Azimi** (`Kaisar Zozi`) — *Leviathan Orbital Dominance*

[![Pembuat: Zozi Atul Azimi](https://img.shields.io/badge/Pembuat-Zozi%20Atul%20Azimi-00FFC2?style=for-the-badge&logo=github)](https://github.com/Zozi0999)
[![Status: Active](https://img.shields.io/badge/Status-Active%20%26%20Production%20Ready-00FFC2?style=for-the-badge&logo=shield)](https://github.com/Zozi0999/zoz_router)
[![Platform: Windows & Cloud](https://img.shields.io/badge/Platform-Windows%20%7C%20Cloudflare%20%7C%20WAN%20Mobile-00F0FF?style=for-the-badge&logo=windows)](https://github.com/Zozi0999/zoz_router)
[![AI Engine: Dynamic Live Discovery](https://img.shields.io/badge/AI%20Engine-Ollama%20%2B%20OpenRouter%20Live-FFB703?style=for-the-badge&logo=openai)](https://github.com/Zozi0999/zoz_router)
[![WhatsApp: Baileys Multi-Device](https://img.shields.io/badge/WhatsApp-Baileys%20Multi--Device-25D366?style=for-the-badge&logo=whatsapp)](https://github.com/Zozi0999/zoz_router)
[![Terminal: ConPTY xterm.js](https://img.shields.io/badge/Terminal-ConPTY%20%2B%20SSE%20Duplex-FF0055?style=for-the-badge&logo=powershell)](https://github.com/Zozi0999/zoz_router)
[![BioEndocrine: 5-Pillar Matrix](https://img.shields.io/badge/Self--Healing-BioEndocrine%20v2-7B2CBF?style=for-the-badge)](https://github.com/Zozi0999/zoz_router)

---

## 🌌 Ringkasan Proyek

**ZOZ ROUTER** adalah platform orkestrasi kecerdasan buatan (*AI Multi-Engine Gateway*) dan konsol terminal sistem canggih bertema **Neural Void Glassmorphism**. Dibangun dengan arsitektur hibrida berkinerja tinggi, ZOZ ROUTER menggabungkan:
1. **AI Discovery 100% Dinamis**: Penemuan model live real-time langsung dari daemon lokal **Ollama** (`/api/tags`, `/v1/models`) dan endpoint resmi **OpenRouter** (`/api/v1/models`) tanpa daftar tiruan statis (*zero hardcoded gimmick models*).
2. **Pemulihan Matematika Aliran Token (Dyck-Language Continuity)**: Algoritma automata matematika murni yang memvalidasi integritas tanda kurung, blok kode, dan sintaksis untuk menyambung output AI yang terputus di tengah jalan secara mulus tanpa notifikasi palsu dan tanpa intervensi teks persona.
3. **Gerbang Kedaulatan WhatsApp (`@whiskeysockets/baileys`)**: Integrasi WhatsApp multi-device native dengan pairing kode QR instan di UI dan auto-responder AI.
4. **Virtual Console Terminal (ConPTY)**: Terminal native Windows interaktif yang terhubung langsung ke PowerShell/CMD/WSL melalui Duplex SSE, dilengkapi mode Split-Screen, *Focus-Follows-Mouse*, dan otomatisasi persetujuan AI CLI (`[Y/n]`).
5. **Akses Jarak Jauh Cloudflare WAN Tunnel**: Kendali terminal desktop dari smartphone melalui terowongan publik aman yang dilindungi PIN kriptografis 6-digit dan pairing QR code.
6. **Sistem File Workspace Mandiri (Server-FS & Desktop-FS)**: Penjelajah pohon berkas (*file tree*), editor kode in-app, dan fitur ekspor ZIP bundle.
7. **Pencarian Mandiri Berbasis SQLite FTS5 & YouTube Intelligence**: Riset web multi-hop dengan ekstraksi teks bersih serta transkripsi video YouTube.
8. **Studio Kanvas Gemini & Visualisasi Diagram Mermaid**: Editor dokumen markdown interaktif dengan ekspor vektor SVG dan raster JPEG.
9. **Deck Audio BGM Prosedural & Vault Audio Offline**: 4 synthesizer binaural frekuensi murni dan penyimpanan audio lokal via IndexedDB dengan penganalisis spektrum frekuensi responsif.
10. **Dual-Channel BioEndocrine & Code Endorfin**: Sistem imun mandiri 5-pilar yang memantau 405+ reseptor DOM, menyembuhkan layout yang rusak, dan meregulasi kesehatan antarmuka secara otomatis.

---

## 🚀 Fitur-Fitur Utama & Arsitektur Sistem

```
                                  ┌─────────────────────────────┐
                                  │      ZOZ ROUTER WEB UI      │
                                  │ (Neural Void Glassmorphism) │
                                  └──────────────┬──────────────┘
                                                 │
        ┌───────────────────────────┬────────────┴────────────┬───────────────────────────┐
        ▼                           ▼                         ▼                           ▼
┌──────────────────┐    ┌───────────────────────┐ ┌───────────────────────┐ ┌──────────────────┐
│ AI ORCHESTRATOR  │    │  CONPTY TERMINAL CLI  │ │   WHATSAPP GATEWAY    │ │ BIO-ENDOCRINE v2 │
│- Dynamic Ollama  │    │- Native Win ConPTY    │ │- Baileys Multi-Device │ │- Connectome 405  │
│- OpenRouter Live │    │- Duplex SSE Streaming │ │- Instant QR Pairing   │ │- 5-Pillar Matrix │
│- Dyck Continuity │    │- Cloudflare Tunnel    │ │- AI Auto-Responder    │ │- Layout Healing  │
│- Img/Audio Synth │    │- Split & Hover Focus  │ │- Multi-Chat Summary   │ │- Chat Affective  │
│- Deep Research   │    │- AI Auto-Enter [Y/n]  │ │- Session Persistence  │ │- Terminal Endorf │
└──────────────────┘    └───────────────────────┘ └───────────────────────┘ └──────────────────┘
```

---

### 1. ⚡ AI Multi-Engine Neural Gateway & Dynamic Model Discovery
Arsitektur gateway AI cerdas yang menghubungkan model lokal dan cloud dengan kedaulatan data penuh:
- **100% Dynamic Model Discovery (Bebas Residu Model Gimmick)**:
  - **Ollama Local Engine**: Mengambil katalog model secara langsung dari daemon lokal (`/api/tags` dan `/v1/models`). Ekstraksi ukuran parameter (`parameter_size`), arsitektur keluarga (`family`), dan context window secara real-time.
  - **OpenRouter Cloud Engine**: Menyaring dan menyajikan katalog model resmi langsung dari API endpoint menggunakan kunci API pengguna. Tidak ada daftar model statis usang atau model rusak yang tertanam dalam kode sumber.
- **Pemulihan Matematika Kontinuitas Aliran (Dyck-Language Continuity)**:
  - Automata matematika murni berbasis teori bahasa formal (*Dyck Language*) untuk mendeteksi penutupan tanda kurung `()`, kurung siku `[]`, kurung kurawal `{}`, serta blok kode markdown ```` ``` ````.
  - Saat aliran token terhenti di tengah jalan karena pemutusan sepihak upstream, algoritma secara matematis mendeteksi status belum selesai, menyambung token secara otomatis, dan menghapus peringatan error merah yang mengganggu agar alur kerja tetap berjalan mulus.
  - Berjalan murni secara algoritmik tanpa manipulasi prompt persona.
- **Normalisasi Teks & Proteksi Konten**:
  - Pembersihan otomatis tag pemikiran internal AI (`<think>`, `<thought>`, `<reasoning>`).
  - Pemulihan artefak karakter rusak UTF-8 (*Mojibake Healing*).
  - Penekanan loop degenerasi kata berulang (*Infinite Repetition Suppression*).
  - Pencegahan string tak terbatas yang merusak batas wadah (*Container Blowout Protection*).

---

### 2. 🎨 Multimodal Dynamic Visual & Audio Synthesis
- **Dynamic Image Synthesis**:
  - Menyaring model text-to-image secara dinamis langsung dari kapabilitas endpoint OpenRouter (`output_modalities: image`, arsitektur output visual) seperti FLUX dan seri Qwen Image.
  - Fallback lokal/gratis terintegrasi via Pollinations AI Engine dengan puluhan gaya artistik (*Cinematic*, *Anime*, *Photorealistic*, *Futuristic Neon*, *Oil Painting*, dll.).
- **Dynamic Audio & Music Synthesis**:
  - Deteksi model audio generasi suara/musik secara dinamis dari kapabilitas endpoint OpenRouter (`output_modalities: audio`).
  - Dukungan sintesis suara prosedural dan generator frekuensi binaural langsung di peramban.

---

### 3. 📱 Sovereign WhatsApp Gateway (`@whiskeysockets/baileys`)
Integrasi gerbang perpesanan instan WhatsApp multi-device mandiri yang terpasang langsung di server:
- **Native Baileys Engine**: Beroperasi tanpa antarmuka browser Puppeteer/Chromium, menghemat memori RAM secara drastis (<50MB).
- **Pairing Kode QR Real-Time**: Menampilkan kode QR login langsung pada antarmuka web ZOZ ROUTER untuk pemindaian cepat dari aplikasi WhatsApp di smartphone.
- **Kredensial Sesi Terisolasi**: Penyimpanan status autentikasi terenkripsi di folder `data/wa-auth/` dengan pemulihan otomatis saat server dimulai ulang.
- **Asisten AI Auto-Responder**: Respon otomatis berbasis kecerdasan buatan untuk pesan masuk dengan konteks percakapan cerdas dan pengaturan instruksi sistem yang fleksibel.
- **Manajemen Kontak & Rangkuman Percakapan**: Pencatatan riwayat pesan terstruktur di `data/wa-messages.json` dan fitur rangkuman pesan masuk instan.

---

### 4. 💻 Neural CLI Terminal Engine (Integrated ConPTY & Duplex SSE)
Terminal interaktif native berkecepatan tinggi yang tertanam langsung di aplikasi web tanpa memerlukan emulator pihak ketiga:
- **Native Windows ConPTY Engine**: Mengintegrasikan modul `node-pty` langsung dengan PowerShell, CMD, WSL Bash, Node.js, dan Python subprocess.
- **Pemuatan Profil Penuh ($PROFILE)**: Memuat seluruh fungsi dan alias kustom Windows (`unduh`, `lab`, `market`, `recon`, `leviathan`, `agy`, dll.) serta banner sistem `[!] Leviathan Orbital Omega Profile Loaded zozi [!]`.
- **Dukungan Penuh TUI & AI CLI**: Kompatibel dengan aplikasi CLI modern seperti `agy`, `claude` (Claude Code CLI), `htop`, `nano`, `python`, dan `node` tanpa blocking atau infinite loop.
- **Tampilan Split Dual-Pane & Focus-Follows-Mouse**:
  - Mode panel ganda independen (*Split View*) berdampingan dengan pembagi resizer interaktif.
  - **Focus-Follows-Mouse**: Kursor cukup diarahkan ke panel split tanpa klik untuk langsung mengetik, dilengkapi feedback visual **Active Pane Glow** neon cyan.
- **Isolasi Mutlak Tab Terminal**: Multi-tab dinamis di mana setiap tab menyimpan status shell, direktori aktif (`cwd`), riwayat output, status split, dan pengaturan Auto Enter masing-masing secara terisolasi.
- **Auto Enter Mandiri AI CLI (`⚡ Auto Y` & `🌊 Enter`)**:
  - Tombol mandiri di header masing-masing panel (Panel 1 dan Panel 2).
  - Algoritma pengenalan prompt interaktif cerdas (`[Y/n]`, `(y/n)`, `Accept file edit?`, `1. Yes, accept this change`, `shift+tab to auto-approve`, `Press Enter to continue`) yang otomatis mengirimkan keystroke persetujuan tanpa intervensi manual.
- **Desktop Pure Canvas & Mobile Ergonomics**:
  - Desktop: Layar terminal murni 100% tinggi jendela dengan input langsung pada posisi kursor shell `xterm.js`.
  - Mobile: Bilah input dan keyboard row sentuh responsif.

---

### 5. ☁️ Cloudflare Tunnel Remote Access (WAN Mobile-to-Desktop)
Akses terminal desktop Windows dari mana saja (smartphone, laptop lain, jaringan seluler luar) secara instan dan aman:
- **Otomatisasi Quick Tunnel**: Mengorkestrasi binary `bin/cloudflared.exe` untuk menghasilkan URL publik aman (`https://*.trycloudflare.com` & `wss://*.trycloudflare.com`).
- **Proteksi 6-Digit PIN Sesi**: Seluruh koneksi remote dari jaringan luar diwajibkan melewati gerbang autentikasi PIN kriptografis, sementara koneksi loopback lokal (`localhost`, `127.0.0.1`) tetap bebas hambatan.
- **Instant QR-Code Pairing**: Menghasilkan QR Code pairing otomatis dengan URL parameter `?remote_host=...&pin=...` untuk pemindaian instan 1-klik dari kamera smartphone.
- **Mobile Touch Keybar Ergonomis**: Bilah tombol khusus sentuh di bagian bawah layar HP (`[ESC]`, `[TAB]`, `[^C]`, `[^L]`, `[↑]`, `[↓]`, `[←]`, `[→]`, `[Paste]`, `[↵ Enter]`) yang dilengkapi haptic vibration feedback.
- **Indikator Latensi Real-Time**: Status ping berkala menampilkan latensi bolak-balik jaringan (`☁️ Remote WAN • XX ms`).

---

### 6. 📁 Local Workspace & Sovereign File System (Server-FS & Desktop-FS)
Manajemen file proyek lokal yang terintegrasi langsung dalam antarmuka web:
- **Live Workspace File Tree**: Penjelajah pohon direktori interaktif untuk membaca struktur folder kerja secara real-time.
- **In-App File Editor**: Membuka, mengedit, dan menyimpan perubahan berkas kode sumber langsung dari peramban.
- **Ekspor ZIP Sekali Klik**: Mengompresi dan mengunduh seluruh direktori workspace dalam format arsip `.zip` instan.

---

### 7. 🌐 Autonomous Deep Web Research & Video Intelligence
- **Multi-Hop Deep Research**: Pencarian web rekursif via DuckDuckGo / SearXNG secara live, ekstraksi halaman bersih (*clean text extraction*), sintesis multi-dokumen, dan anotasi referensi sumber.
- **Penyimpanan SQLite FTS5**: Pengindeksan basis pengetahuan dan hasil riset lokal menggunakan database SQLite Full-Text Search (`data/zoz_web_search.db` & `data/zoz_memory.db`) untuk penelusuran berkecepatan tinggi.
- **YouTube Video Intelligence (`youtube_tool.js` / `youtube_tool.py`)**: Ekstraksi transkrip subtitle video YouTube secara instan dan penyusunan ringkasan komprehensif.

---

### 8. 🖌️ Gemini Canvas Studio & Diagramming Engine
- **Interactive Markdown Canvas**: Ruang kerja visual interaktif untuk penulisan kode, dokumen teknis, dan rancangan sistem secara berdampingan.
- **Mermaid Vector & Raster Exporter**: Rendering diagram flowchart, sequence, state, class, ER, dan Gantt chart otomatis dengan dukungan ekspor berkualitas tinggi ke format **SVG** dan **JPEG**.
- **Dual Download Pipeline**: Unduh hasil kerja dalam format Markdown murni (`.md`), PDF terformat via `jspdf`, SVG vektor, atau JPEG raster.
- **In-Place Interactive Editing**: Modifikasi langsung kode dan diagram di dalam pratinjau canvas tanpa kehilangan state.

---

### 9. 🎧 Ambient BGM Deck & Audio Engine
- **Procedural Offline Ambient Audio**: 4 generator suara binaural procedural synthesizer yang dapat dimainkan tanpa koneksi internet:
  - *Deep Space 432Hz Drone*
  - *Synthwave Pulse*
  - *Neo-Tokyo Rain*
  - *10Hz Alpha Waves (Fokus & Coding)*
- **Local Audio Vault (IndexedDB)**: Simpan dan putar berkas audio lokal Anda (MP3, WAV, FLAC, OGG, M4A) secara permanen di browser dengan visualizer spektrum neon responsif real-time.

---

### 10. 🌿 Dual-Channel BioEndocrine & Code Endorfin Architecture
Sistem neuro-biologis buatan yang memonitor integritas ekosistem kode dan kestabilan antarmuka secara real-time:

#### Jalur 1: CodeEndocrine v2 (Matriks Diagnostik 5 Pilar)
1. **Pilar 1: DOM Connectome Audit**: Memverifikasi 405+ simpul reseptor antarmuka (`els`) terhadap elemen DOM nyata di `index.html` (100% harmonis, 0 simpul terisolasi).
2. **Pilar 2: Model Error Detection**: Menangkap dan mengkategorikan kesalahan pemanggilan model inferensi (HTTP 400 Parameter, 401 Unauthorized, 402 Quota, 403 Forbidden, 404 Deprecated, 429 Rate Limit, 500+ Outage, Context Window Overflow, Safety Content Blocks).
3. **Pilar 3: Text Anomaly & Corruption**: Deteksi dan perbaikan kebocoran tag pemikiran, karakter Mojibake, loop kata berulang, dan peluapan batas wadah.
4. **Pilar 4: Viewport & Layout Dimensions**: Deteksi kebocoran scroll horizontal, layout clipping, dan overlay transparan tak terlihat yang memblokir interaksi sentuhan/klik pengguna.
5. **Pilar 5: Button Placement & Obstruction**: Audit dimensi tombol kerdil (<6px), posisi offscreen, pointer-events traps, serta deteksi halangan fisik elemen lain yang menimpa titik klik tombol via `document.elementFromPoint`.
- **Auto-Heal Engine (`autoFixLayoutAndButtons`)**: Perbaikan instan 1-klik yang menormalkan batas lebar wadah dan mengembalikan interaktivitas tombol.
- **Stress Purge & Suntikan Endorfin**: Menetralkan kortisol ke 0% dan mengembalikan dopamin ke 100%.

#### Jalur 2: ChatEndocrine v2 (Sistem Saraf Emosional Afektif AI)
- Memetakan 4 kuadran emosi biologis non-fisik: **Sakit**, **Senang**, **Bahagia**, dan **Marah** (0–100%).
- Memonitor 4 vitals neuro-hormonal: **Oksitosin** (empati), **Dopamin** (minat eksplorasi), **Kortisol** (tensi), dan **Serotonin** (kestabilan).
- Sensor intuisi kontekstual (`senseAndModulate`) yang menghasilkan ringkasan status saraf latar belakang (*Autonomic Nervous Log*) tanpa merusak format jawaban AI.

#### Terminal Endorphin Engine
Modul *self-healing* terminal khusus yang mendiagnosa dan memulihkan:
- Dimensi ConPTY sempit pembengkok baris (<45 kolom).
- Jebakan kursor scroll atas (*Scroll Trap*).
- Sinkronisasi SGR mouse wheel sequence untuk mode TUI (Claude Code, Nano).
- Pembersihan buffer textarea virtual keyboard IME.

---

## 📁 Struktur Direktori Proyek

```
C:\Users\user\zoz-router\
├── server.js                      # Core Node.js Server, ConPTY Gateway & Streaming Proxy
├── whatsapp-gateway.js            # Baileys Multi-Device WhatsApp Gateway Engine
├── text-safety.js                 # Text Sanitizer, Mojibake Repair & Safety Logic
├── youtube_tool.js                # YouTube Transcript & Summary Extractor (Node.js)
├── youtube_tool.py                # YouTube Subtitles Extractor Bridge (Python)
├── package.json                   # Dependencies & Configuration Manifest
├── vercel.json                    # Vercel Serverless Routing & PNA CORS Configuration
├── _worker.js                     # Cloudflare Pages / Workers Proxy Adapter
├── start.bat                      # 1-Click Persistent Launcher Windows Daemon
├── README.md                      # Dokumentasi Lengkap Sistem ZOZ ROUTER
│
├── api/                           # Serverless API Handlers (Vercel Runtime)
│   ├── [...slug].js               # Catch-all Dynamic Endpoint Router
│   ├── index.js                   # Serverless Base Handler
│   └── ping.js                    # Lightweight Health & Latency Probe
│
├── bin/                           # Binary Executables
│   └── cloudflared.exe            # Cloudflare Tunnel Binary for WAN Remote Access
│
├── data/                          # Persistent Database, Sessions & Auth Store
│   ├── wa-auth/                   # Multi-Device WhatsApp Credentials & Pairing Keys
│   ├── sessions/                  # PTY Terminal Sessions & State Storage
│   ├── uploads/                   # User Uploads & Media Storage
│   ├── zoz_memory.db              # SQLite FTS5 Memory & Knowledge Base
│   ├── zoz_web_search.db          # SQLite FTS5 Deep Web Research Cache
│   ├── identities.json            # Persona Identities & Prompts Configuration
│   ├── tunnel-state.json          # Active Cloudflare Tunnel Status
│   └── wa-config.json             # WhatsApp Gateway Preferences & Settings
│
├── public/                        # Static Client Assets & Browser Runtime
│   ├── index.html                 # Responsive Neural Shell & Semantic Layout
│   ├── style.css                  # Styling Neon Modern Dark, Aura Themes & Animations
│   ├── style.min.css              # Level-2 Minified Production Stylesheet
│   ├── app.js                     # Unified Frontend Logic, Terminal Engine & BioEndocrine
│   ├── server.js                  # Mirrored Client Proxy Runtime
│   ├── text-safety.js             # Mirrored Text Sanitizer Engine
│   ├── xterm.js                   # High-Performance Terminal Canvas Engine
│   ├── xterm.css                  # Terminal Styling & Color Profiles
│   ├── addon-fit.js               # Responsive Viewport Terminal Fit Addon
│   ├── mermaid.min.js             # Mermaid Diagramming Engine
│   ├── jspdf.umd.min.js           # PDF Document Generation Engine
│   ├── favicon.svg                # Glowing Hexagonal Core Vector Logo
│   └── zoz-logo.png               # Official ZOZ Router System Icon
│
└── endorfin analyst/              # Endocrine Diagnostics, Sentinel & Audit Suite
    ├── audit-runner.js            # Automated BioEndocrine Diagnostic Runner
    ├── endocrine-sentinel.js      # Continuous Sentinel Health Monitor
    ├── endorfin.js                # Core Endorphin Regulation Functions
    └── endocrine.config.json      # Thresholds & Telemetry Baseline Matrix
```

---

## 🛠️ Panduan Memulai & Instalasi

### Prasyarat Sistem
- **Sistem Operasi**: Windows 10/11 (Direkomendasikan) atau Linux
- **Node.js**: Versi 18.0.0 atau lebih baru (Disarankan Node.js 20+)
- **Ollama** *(Opsional untuk model lokal)*: Unduh di [ollama.ai](https://ollama.ai)

### 1. Menjalankan secara Lokal di Windows (1-Klik)
Cukup jalankan berkas batch peluncur:
```cmd
start.bat
```
*Skrip ini akan mengaktifkan server latar belakang pada port `4040` dengan izin Private Network Access (PNA) dan langsung membuka antarmuka di peramban.*

### 2. Menjalankan secara Manual via Terminal
```bash
# Masuk ke direktori proyek
cd C:\Users\user\zoz-router

# Install dependencies
npm install

# Jalankan server utama
node server.js
```
Akses web UI melalui: `http://localhost:4040`

### 3. Mengaktifkan Sinkronisasi dengan Web Vercel
Jika Anda mengakses antarmuka melalui Vercel (`https://zoz-router.vercel.app`):
1. Pastikan server lokal Windows aktif (`node server.js` atau `start.bat`).
2. Buka terminal di web Vercel. Tombol status **`[Win Sync ⚡]`** akan otomatis mendeteksi server Windows Anda dalam <5ms dan menghubungkan sesi PTY langsung ke PowerShell lokal laptop Anda.

---

## ⌨️ Pintasan Keyboard & Navigasi Cepat

| Shortcut | Cakupan | Aksi |
| :--- | :--- | :--- |
| `Ctrl + \`` | Global | Membuka / Menutup Modal Terminal Interaktif |
| `F11` | Terminal | Beralih Layar Penuh (Fullscreen Terminal Mode) |
| `Hover Mouse` | Split Terminal | Beralih fokus antar panel (Focus-Follows-Mouse) tanpa klik |
| `Enter` | Composer | Mengirim prompt percakapan ke model AI |
| `Shift + Enter` | Composer | Membuat baris baru dalam editor prompt |
| `Esc` | Global | Menutup modal aktif (Settings, Terminal, Telemetri, Canvas) |
| `↑` / `↓` | Terminal | Menavigasi riwayat perintah sebelumnya |
| `Ctrl + C` | Terminal | Mengirimkan interrupt signal (SIGINT) ke proses PTY |
| `Ctrl + L` | Terminal | Membersihkan layar terminal (*Clear Screen*) |

---

## ⚡ Perintah Cepat Terminal (In-CLI Built-in Commands)

Saat berada di dalam terminal ZOZ ROUTER, Anda dapat mengetikkan perintah internal:

- `endorfin` atau `heal` — Menjalankan diagnosa dan *self-healing* terminal otomatis (mereset scroll trap, menormalkan kolom PTY, dan mengosongkan buffer IME).
- `cls` atau `clear` — Membersihkan layar panel aktif.
- `split` — Mengaktifkan / menonaktifkan tampilan dua panel berdampingan.
- `theme` — Beralih antara tema **Aura Es** (Cyan Glow) dan **Aura Api** (Amber Glow).
- `font <ukuran>` — Mengubah ukuran font terminal secara dinamis (contoh: `font 14`).
- `shell <nama>` — Beralih shell aktif (`powershell`, `cmd`, `wsl`, `node`, `python`).
- `help` — Menampilkan daftar perintah dan panduan interaktif.

---

## 🔒 Keamanan, Privasi & Kedaulatan Data

1. **Local-First Zero Telemetry**: Kunci API OpenRouter dan riwayat percakapan Anda disimpan secara lokal di peramban (`localStorage` dan `IndexedDB`). Tidak ada data pengguna yang dikirim ke server pihak ketiga selain penyedia model AI yang Anda pilih secara eksplisit.
2. **PIN-Protected WAN Access**: Akses terminal melalui internet publik diamankan oleh enkripsi TLS Cloudflare Tunnel dan PIN kriptografis 6-digit dengan perlindungan *rate-limiting* dan masking respons.
3. **Audit Imunitas Mandiri**: Kode diverifikasi secara berkala untuk integritas struktur DOM (405+ connectome) dan kelengkapan sintaksis model.

---

## 👨‍💻 Pembuat / Creator

Platform **ZOZ ROUTER** dirancang, dikembangkan, dan diarsiteki sepenuhnya oleh:

* **Nama Lengkap:** **Zozi Atul Azimi** (*Kaisar Zozi*)
* **GitHub:** [@Zozi0999](https://github.com/Zozi0999) (`https://github.com/Zozi0999`)
* **LinkedIn:** [Zozi Atul Azimi](https://www.linkedin.com/in/zozi-atul-azimi-1-656108404/) (`linkedin.com/in/zozi-atul-azimi-1-656108404`)
* **Email:** `zoziazimi@gmail.com`
* **Peran & Spesialisasi:** Lead AI System Architect, Full-Stack Sovereign Engineer, Creator of Leviathan Orbital Dominance

---

## 👑 Sovereign Mandate & Dedikasi

> *"Sistem ini beroperasi di bawah mandat gravitasi orbital permanen. Dirancang untuk kebal dari degradasi, meregenerasi diri melalui endorfin biologis buatan, dan menghadirkan dominasi komputasi penuh tanpa kompromi."*

**Diciptakan dan Dikembangkan oleh:**  
**KAISAR ZOZI** (`Zozi Atul Azimi`)  
*Leviathan Orbital Dominance • Omega Root Access*
