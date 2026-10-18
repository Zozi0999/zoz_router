# ⚡ ZOZ ROUTER — Neural AI Multi-Engine & Command Terminal Gateway
> **Version:** `v335 (Quantum Orbital Edition)`  
> **Architecture:** *Neural Void Cyberpunk • Dual-Channel BioEndocrine • Hybrid Local/Cloud • ConPTY Terminal Engine*  
> **Author & Sovereign:** **Kaisar Zozi** (`Zozi Atul Azimi`) — *Leviathan Orbital Dominance*

[![Status: Active](https://img.shields.io/badge/Status-Active%20%26%20Production%20Ready-00FFC2?style=for-the-badge&logo=shield)](https://github.com/Zozi0999/zoz_router)
[![Platform: Windows & Cloud](https://img.shields.io/badge/Platform-Windows%20%7C%20Vercel%20%7C%20WAN%20Mobile-00F0FF?style=for-the-badge&logo=windows)](https://github.com/Zozi0999/zoz_router)
[![Engine: Ollama & OpenRouter](https://img.shields.io/badge/AI%20Engine-Ollama%20%2B%20OpenRouter-FFB703?style=for-the-badge&logo=openai)](https://github.com/Zozi0999/zoz_router)
[![Terminal: ConPTY xterm.js](https://img.shields.io/badge/Terminal-ConPTY%20%2B%20SSE%20Duplex-FF0055?style=for-the-badge&logo=powershell)](https://github.com/Zozi0999/zoz_router)
[![BioEndocrine: 5-Pillar Matrix](https://img.shields.io/badge/Self--Healing-BioEndocrine%20v2-7B2CBF?style=for-the-badge)](https://github.com/Zozi0999/zoz_router)

---

## 🌌 Ringkasan Proyek

**ZOZ ROUTER** adalah platform orkestrasi kecerdasan buatan (*AI Multi-Engine Gateway*) dan konsol terminal sistem canggih bertema **Neural Void Cyberpunk**. Dibangun dengan arsitektur hibrida berkinerja tinggi, ZOZ ROUTER menggabungkan kebebasan privasi model lokal offline via **Ollama**, kedahsyatan model komputasi cloud unggulan dunia via **OpenRouter**, dan antarmuka **Virtual Console Terminal (ConPTY)** interaktif yang terhubung langsung ke sistem operasi Windows serta dapat dikendalikan dari jarak jauh melalui **Cloudflare WAN Tunnel**.

Sistem ini diperkuat oleh mekanisme **Dual-Channel BioEndocrine & Code Endorfin**, sebuah arsitektur biomimetik mandiri yang secara aktif memantau integritas DOM, mendeteksi kerusakan respons teks AI, mengaudit halangan tombol, dan mampu melakukan *self-healing* otomatis tanpa memerlukan reload peramban.

---

## 🚀 Fitur-Fitur Utama & Arsitektur Sistem

```
                                  ┌─────────────────────────────┐
                                  │      ZOZ ROUTER WEB UI      │
                                  │  (Cyberpunk Neural Void UI) │
                                  └──────────────┬──────────────┘
                                                 │
            ┌────────────────────────────────────┼────────────────────────────────────┐
            ▼                                    ▼                                    ▼
┌───────────────────────┐            ┌───────────────────────┐            ┌───────────────────────┐
│     AI ORCHESTRATOR   │            │   CONPTY TERMINAL CLI │            │   BIO-ENDOCRINE v2    │
│  - Local Ollama PTY   │            │  - Windows PowerShell │            │  - Connectome 405/405 │
│  - OpenRouter Gateway │            │  - Cloudflare Tunnel  │            │  - 5-Pillar Diagnostics│
│  - Deep Web Research  │            │  - Split / Hover Focus│            │  - Terminal Endorfin  │
│  - Gemini Canvas      │            │  - Mobile Touch Keybar│            │  - Chat Affective Log │
└───────────────────────┘            └───────────────────────┘            └───────────────────────┘
```

### 1. ⚡ Neural CLI Terminal Engine (Integrated ConPTY & Duplex SSE)
Terminal interaktif native berkecepatan tinggi yang tertanam langsung di dalam aplikasi web tanpa memerlukan software pihak ketiga tambahan:
- **Native Windows ConPTY Engine**: Mengintegrasikan modul `node-pty` langsung dengan PowerShell, CMD, WSL Bash, Node.js, dan Python subprocess.
- **Pemuatan Profil Penuh ($PROFILE)**: Memuat seluruh fungsi dan alias kustom Windows (`unduh`, `lab`, `market`, `recon`, `leviathan`, `agy`, dll.) serta banner sistem `[!] Leviathan Orbital Omega Profile Loaded zozi [!]`.
- **Dukungan TUI Interaktif & AI CLI**: Mendukung penuh aplikasi TUI kompleks seperti `agy`, `claude` (Claude Code CLI), `htop`, `nano`, `python`, dan `node` tanpa blocking atau infinite loop.
- **Tampilan Split Dual-Pane & Hover-to-Focus**:
  - Mode panel ganda independen (*Split View*) berdampingan dengan pembagi resizer interaktif.
  - Fitur **Focus-Follows-Mouse**: Kursor cukup diarahkan ke panel split tanpa klik untuk langsung mengetik, dilengkapi feedback visual **Active Pane Glow** neon cyan.
- **Isolasi Mutlak Tab Terminal**: Manajemen multi-tab dinamis di mana setiap tab menyimpan status shell, direktori aktif (`cwd`), riwayat output, status split, dan pengaturan Auto Enter masing-masing secara terisolasi.
- **Auto Enter Mandiri AI CLI (`⚡ Auto Y` & `🌊 Enter`)**:
  - Tombol mandiri di header masing-masing panel (Panel 1 dan Panel 2).
  - Algoritma pengenalan prompt interaktif cerdas (`[Y/n]`, `(y/n)`, `Accept file edit?`, `1. Yes, accept this change`, `shift+tab to auto-approve`, `Press Enter to continue`) yang otomatis mengirimkan carriage return atau keystroke persetujuan tanpa intervensi manual.
- **Desktop Pure Canvas & Mobile Ergonomics**:
  - Desktop: Bilah input bawah otomatis disembunyikan untuk memberikan pengalaman layar terminal murni 100% tinggi jendela dengan input langsung pada posisi kursor shell `xterm.js`.
  - Mobile: Bilah input dan keyboard row tetap aktif secara responsif untuk kenyamanan sentuhan layar smartphone.

---

### 2. ☁️ Cloudflare Tunnel Remote Access (WAN Mobile-to-Desktop)
Akses terminal desktop Windows dari mana saja (misal dari HP di sekolah atau di luar rumah) secara instan dan aman:
- **Otomatisasi Quick Tunnel**: Server internal mengorkestrasi binary `cloudflared` untuk menghasilkan URL publik aman (`https://*.trycloudflare.com` & `wss://*.trycloudflare.com`).
- **Proteksi 6-Digit PIN Sesi**: Seluruh koneksi remote dari jaringan luar diwajibkan melewati gerbang autentikasi PIN kriptografis, sementara koneksi loopback lokal (`localhost`, `127.0.0.1`) tetap bebas hambatan.
- **Instant QR-Code Pairing**: Menghasilkan QR Code pairing otomatis dengan URL parameter `?remote_host=...&pin=...` untuk pemindaian instan 1-klik dari kamera smartphone.
- **Mobile Touch Keybar Ergonomis**: Bilah tombol khusus sentuh di bagian bawah layar HP (`[ESC]`, `[TAB]`, `[^C]`, `[^L]`, `[↑]`, `[↓]`, `[←]`, `[→]`, `[Paste]`, `[↵ Enter]`) yang dilengkapi haptic vibration feedback.
- **Indikator Latensi Real-Time**: Status ping berkala menampilkan latensi bolak-balik jaringan (`☁️ Remote WAN • XX ms`).

---

### 3. 🌿 Dual-Channel BioEndocrine & Code Endorfin Architecture
Sistem neuro-biologis buatan yang memonitor kesehatan ekosistem kode dan kestabilan antarmuka secara real-time:

#### Jalur 1: CodeEndocrine v2 (Matriks Diagnostik 5 Pilar)
1. **Pilar 1: DOM Connectome Audit**: Memverifikasi 405+ simpul reseptor antarmuka (`els`) terhadap elemen DOM nyata di `index.html` (100% harmonis, 0 simpul terisolasi).
2. **Pilar 2: Model Error Detection**: Menangkap dan mengkategorikan kesalahan pemanggilan model inferensi (HTTP 400 Parameter, 401 Unauthorized, 402 Quota, 403 Forbidden, 404 Deprecated, 429 Rate Limit, 500+ Outage, Context Window Overflow, Safety Content Blocks).
3. **Pilar 3: Text Anomaly & Corruption**:
   - Mendeteksi dan membersihkan kebocoran tag pemikiran internal AI (`<think>`, `<thought>`, `<reasoning>`).
   - Deteksi artefak karakter rusak encoding UTF-8 (Mojibake).
   - Deteksi loop degenerasi kata berulang (*Infinite Token Repetition Loop*).
   - Deteksi string super-panjang tanpa spasi pembobol batas layout wadah (*Container Blowout*).
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

### 4. 🎨 Gemini Canvas Studio & Diagramming Engine
- **Interactive Markdown Canvas**: Ruang kerja visual interaktif untuk penulisan kode, dokumen teknis, dan rancangan sistem.
- **Mermaid Vector & Raster Exporter**: Rendering diagram flowchart, sequence, state, class, ER, dan Gantt chart otomatis dengan dukungan ekspor berkualitas tinggi ke format **SVG** dan **JPEG**.
- **Dual Download Pipeline**: Unduh hasil kerja dalam format Markdown murni (`.md`), PDF terformat, SVG vektor, atau JPEG raster.
- **In-Place Interactive Editing**: Modifikasi langsung kode dan diagram di dalam pratinjau canvas.

---

### 5. 🌐 Autonomous Deep Research & Video Intelligence
- **Multi-Hop Deep Research**: Melakukan pencarian rekursif DuckDuckGo secara live, ekstraksi halaman bersih (*clean text extraction*), sintesis informasi multi-dokumen, dan anotasi referensi sumber.
- **YouTube Video Intelligence**: Ekstraksi transkrip dan ringkasan substansial video YouTube secara instan.
- **Zero-CORS Windows Local Bridge**: Komunikasi mulus antara front-end web (Vercel atau localhost) dengan runtime sistem operasi lokal via Private Network Access (PNA).

---

### 6. 🎧 Cyber BGM Deck & Audio Engine
- **Procedural Offline Ambient Audio**: 4 generator suara binaural procedural synthesizer yang dapat dimainkan tanpa koneksi internet:
  - *Deep Space 432Hz Drone*
  - *Synthwave Pulse*
  - *Neo-Tokyo Rain*
  - *10Hz Alpha Waves (Fokus & Coding)*
- **Local Audio Vault (IndexedDB)**: Simpan dan putar berkas audio lokal Anda (MP3, WAV, FLAC, OGG, M4A) secara permanen di browser dengan visualizer spektrum neon cyberpunk.

---

## 📁 Struktur Direktori Proyek

```
C:\Users\user\zoz-router\
├── server.js                   # Node.js Core Server, ConPTY Gateway & Streaming Proxy
├── package.json                # Project Dependencies & Manifest
├── vercel.json                 # Vercel Serverless Routing & PNA CORS Configuration
├── _worker.js                  # Cloudflare Pages / Workers Proxy Adapter
├── start.bat                   # 1-Click Persistent Launcher Windows Daemon
├── README.md                   # Dokumentasi Lengkap Sistem ZOZ ROUTER
│
├── api/                        # Serverless API Handlers (Vercel Runtime)
│   ├── [...slug].js            # Catch-all Dynamic Endpoint Router
│   ├── index.js                # Serverless Base Handler
│   └── ping.js                 # Lightweight Health & Latency Probe
│
├── bin/                        # Binary Executables
│   └── cloudflared.exe         # Cloudflare Tunnel Binary for WAN Remote Access
│
├── public/                     # Static Client Assets & CDN Mirrored Runtime
│   ├── index.html              # Responsive Cyberpunk Shell & Semantic Layout
│   ├── style.css               # Styling Neon Cyberpunk, Aura Themes & Animations
│   ├── style.min.css           # Level-2 Minified Production Stylesheet
│   ├── app.js                  # Unified Frontend Logic, Terminal Engine & BioEndocrine
│   ├── favicon.svg             # Glowing Hexagonal Core Vector Logo
│   ├── xterm.js                # High-Performance Terminal Canvas Engine
│   ├── xterm.css               # Terminal Styling & Color Profiles
│   └── addon-fit.js            # Responsive Viewport Terminal Fit Addon
│
└── scratch/                    # Test Suites, Benchmarks & Endocrine Diagnostics
    ├── test_dual_channel_endocrine.js   # Unit Tests for Jalur 1 & Jalur 2 Endocrine
    ├── test_terminal_tab_isolation.js   # Unit Tests for Multi-Tab & Split Pane State
    ├── test_terminal_remote_tunnel.js   # Unit Tests for WAN PIN & Remote Protocol
    ├── test_terminal_exec_api.js        # Unit Tests for Subprocess Exec Gateway
    ├── test_gemini_canvas.js            # Unit Tests for Canvas & Mermaid Exporter
    ├── test_vercel_architecture.js      # Unit Tests for Serverless & PNA Routing
    └── audit_connectome.js              # DOM Receptors Connectome Verifier
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

# Install dependencies (opsional untuk node-pty native)
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
3. **Audit Imunitas Mandiri**: Kode dilengkapi pemeriksaan paritas bitwise 100% terverifikasi (`fc.exe /b`) untuk memastikan integritas berkas di seluruh lingkungan deployment.

---

## 👑 Sovereign Mandate & Dedikasi

> *"Sistem ini beroperasi di bawah mandat gravitasi orbital permanen. Dirancang untuk kebal dari degradasi, meregenerasi diri melalui endorfin biologis buatan, dan menghadirkan dominasi komputasi penuh tanpa kompromi."*

**Diciptakan secara eksklusif untuk:**  
**KAISAR ZOZI** (`Zozi Atul Azimi`)  
*Leviathan Orbital Dominance • Omega Root Access*
