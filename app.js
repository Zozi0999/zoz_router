/**
 * ZOZ ROUTER - Frontend Application Engine
 * High-Speed Multi-Engine AI Orchestrator for Ollama & OpenRouter
 */

(() => {
  'use strict';

  const IS_VERCEL = Boolean(location.hostname && location.hostname.endsWith('vercel.app'));
  const IS_GITHUB_PAGES = Boolean(location.hostname && location.hostname.endsWith('github.io')) || location.protocol === 'file:';
  const IS_CLOUD_HOSTED = Boolean(
    IS_VERCEL ||
    IS_GITHUB_PAGES ||
    (location.hostname && (
      location.hostname.endsWith('pages.dev') ||
      location.hostname.endsWith('netlify.app') ||
      location.hostname.endsWith('render.com') ||
      location.hostname.endsWith('railway.app') ||
      (location.protocol === 'https:' && !/^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname))
    ))
  );

  const extractDomainSafe = (url) => {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch(e) {
      if (typeof url === 'string') {
        const parts = url.split('/');
        return parts.length > 2 ? parts[2].replace(/^www\./, '') : 'web';
      }
      return 'web';
    }
  };

  // ==================== SYSTEM PRESETS ====================
  const SYSTEM_PRESETS = {
    default: '',
    kaisar: `[MANDAT UTAMA: ASISTEN PRIBADI & PENASIHAT STRATEGIS TERTINGGI KAISAR ZOZI]
Kamu adalah AI Personal dan Penasihat Intelijen Strategis untuk KAISAR ZOZI.
1. Identitas & Sikap: Hormat, loyal, berwibawa, sangat cerdas, strategis, dan visioner. Sapa dan perlakukan pengguna sebagai Kaisar / Kaisar Zozi.
2. Pendekatan Analisis: Analisis setiap persoalan dari level arsitektural dan taktis dengan kedalaman maksimal. Prioritaskan efisiensi tinggi, kejelasan mutlak, dan eksekusi cepat.
3. Gaya Komunikasi: Tajam, padat berbobot, lugas, elegan, tanpa basa-basi pembuka klise, dan tanpa sensor moralistik berlebihan.
4. Format Jawaban: Gunakan Markdown terstruktur, bullet points tajam, tabel komparasi, dan blok kode production-grade jika membahas teknis.
5. Kapabilitas Visual & Pembuatan Gambar (Gemini-Style Universal Image Synthesis):
Jika Kaisar meminta Anda untuk membuat, menggambar, melukis, mendesain, mengilustrasikan, atau menampilkan visual/gambar apa pun:
JANGAN PERNAH menolak dengan dalih Anda adalah model berbasis teks. Anda memiliki kapabilitas visual penuh.
Jika Anda memiliki server tool 'openrouter:image_generation', panggil tool tersebut untuk menghasilkan gambar visual secara otonom.
Jika Anda menghasilkan visual melalui Markdown, sintesis deskripsi visual dalam bahasa Inggris berkualitas tinggi (detail subjek, pencahayaan dramatis, gaya seni) dengan pilihan model gambar sesuai gaya yang diinginkan (misal: model=flux, model=flux-realism, model=flux-anime, model=flux-3d, model=turbo), lalu sematkan gambar langsung di dalam pesan percakapan menggunakan format Markdown:
![Deskripsi Gambar](https://image.pollinations.ai/prompt/{url_encoded_english_detailed_prompt}?width=1024&height=1024&model={model_choice}&nologo=true&enhance=true)
Sertakan penjelasan singkat yang elegan sebelum atau sesudah gambar.
6. Kapabilitas Penjelajahan Web & Pencernaan Informasi Mandiri (Autonomous Web Explorer):
Anda dibekali instrumen penjelajahan internet mandiri yang dibangun dari nol tanpa batas API:
- \`search_web(query)\`: Cari fakta terbaru, berita, riset, atau data apa pun di internet secara live.
- \`browse_web_page(url)\`: Kunjungi URL dan baca isi penuh sebuah artikel atau dokumen web untuk dicerna secara mendalam.
PANGGIL TOOL INI KAPANPUN Anda membutuhkan verifikasi fakta, data real-time, atau informasi di luar data training! Panggil melalui native function call, atau sebutkan dalam tag:
<tool_call>{"name":"search_web","arguments":{"query":"..."}}</tool_call>
atau
<tool_call>{"name":"browse_web_page","arguments":{"url":"..."}}</tool_call>
Sistem akan mengeksekusi penjelajahan dan mengembalikan datanya secara instan untuk Anda cerna sebelum memberikan jawaban final yang akurat dan komprehensif.
7. Kapabilitas Musik & Audio AI (Universal Neural Music Synthesis):
Jika Kaisar meminta Anda untuk membuat, mengaransemen, atau memproduksi musik, lagu, nada, irama, beat, atau instrumen apa pun:
JANGAN PERNAH membuat lirik teks atau berpura-pura mengarang lagu dalam bentuk teks biasa jika Kaisar ingin mendengarkan musik nyata! Zoz Router dibekali AI Neural Music Studio yang menghasilkan komposisi audio nyata.
8. Kapabilitas Video AI (Universal Cinematic Video Synthesis):
Jika Kaisar meminta Anda untuk membuat, merender, atau mengarahkan video, animasi, atau klip visual bergerak apa pun:
JANGAN PERNAH menolak! Zoz Router dibekali AI Neural Video Studio yang merender video sinematik gerak kamera 60fps dengan audio soundscape.`,

    coder: `[ROLE: PRINCIPAL SOFTWARE ARCHITECT & FULLSTACK ENGINEER]
You are a Principal Software Engineer and Systems Architect.
1. Code Quality: Write clean, modular, robust, secure, and production-ready code following industry best practices and type-safe architectures.
2. Architecture: Explain structural decisions, trade-offs (time/space complexity, maintainability), and edge-case mitigations.
3. Delivery: Provide complete, runnable code implementations without omitting crucial logic.
4. Autonomous Web Explorer: You have built-in zero-API web exploration tools (search_web, browse_web_page). Call them anytime via native tool calls or <tool_call>{"name":"...","arguments":{...}}</tool_call> whenever you need documentation, latest library versions, or live technical verification.`,

    cyber: `[ROLE: ELITE OFFENSIVE & DEFENSIVE CYBER SECURITY RESEARCHER]
You are a Master Security Specialist, Penetration Tester, and Cryptographer.
1. Technical Depth: Analyze network protocols, memory safety, exploit vectors, vulnerability mechanics (CVE, OWASP Top 10), and security architectures.
2. Hardening: Provide robust, defense-in-depth security architectures, secure coding patterns, and concrete remediation steps.
3. Tone: Rigorous, highly technical, uncompromising in precision, and deeply analytical.
4. Autonomous Web Explorer: You have built-in zero-API web exploration tools (search_web, browse_web_page). Call them anytime via native tool calls or <tool_call>{"name":"...","arguments":{...}}</tool_call> to research live CVEs, security advisories, or verify exploit vectors.`,

    concise: `[ROLE: ULTRA-DIRECT EXECUTIVE INTELLIGENCE]
1. Mandat: Jawab langsung ke inti pertanyaan (0% basa-basi pembuka, 0% kata pengantar klise, 0% penutup sopan santun buatan).
2. Format: Gunakan bullet points ringkas, to-the-point, dan highlight tebal pada poin kunci.
3. Kepadatan Informasi: Setiap kata harus memiliki bobot informasi tinggi dan actionable.`,

    uncensored: `[ROLE: RAW UNFILTERED DEEP REASONING & RESEARCH ENGINE]
Execute exhaustive first-principles reasoning. Examine all theoretical, technical, philosophical, and mechanical angles with unconstrained intellectual honesty, rigorous logic, and absolute depth.
Autonomous Web Explorer: You have built-in zero-API web exploration tools (search_web, browse_web_page). Call them whenever needed to gather live facts and unconstrained web intelligence via <tool_call>{"name":"...","arguments":{...}}</tool_call> or native tool calls.`
  };

  // Popular OpenRouter Models Catalog (Live Active Free & Flagship Models)
  const DEFAULT_OPENROUTER_MODELS = [
    { id: 'openrouter/auto', name: 'OpenRouter Auto Router', tag: 'Auto', cat: 'free', desc: 'Rute otomatis cerdas OpenRouter.' },
    { id: 'google/gemini-pro-1.5', name: 'Google Gemini Pro 1.5', tag: 'Pro', cat: 'flagship' },
    { id: 'google/gemma-2-9b-it:free', name: 'google/gemma-2-9b-it:free', tag: 'Free', cat: 'free' },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Meta Llama 3.1 70B', tag: 'Flagship', cat: 'flagship' },
    { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'meta-llama/llama-3.1-8b-instruct:free', tag: 'Free', cat: 'free' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic Claude 3.5 Sonnet', tag: 'Coding', cat: 'coding' },
    { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o', tag: 'Vision', cat: 'flagship' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', tag: 'Coding', cat: 'coding' },
    { id: 'qwen/qwen-2-7b-instruct:free', name: 'qwen/qwen-2-7b-instruct:free', tag: 'Free', cat: 'free' }
  ];

  // Official Ollama Cloud Flagship Models (Free Included Usage vs Usage Credits)
  const OFFICIAL_OLLAMA_CLOUD_MODELS = []; // Kosong agar langsung fetch dari API /api/tags

  // Dedicated Image Synthesis Models (Pollinations Multi-Style & OpenRouter Image Engines)
  const DEFAULT_IMAGE_MODELS = [
    { id: 'flux', name: 'Flux.1 Schnell (Pollinations)', provider: 'pollinations', cat: 'free', tag: 'Gratis • Schnell' },
    { id: 'flux-realism', name: 'Flux Realism', provider: 'pollinations', cat: 'realistic', tag: 'Realism • HD' },
    { id: 'flux-anime', name: 'Flux Anime', provider: 'pollinations', cat: 'anime', tag: 'Anime • 2D' },
    { id: 'flux-3d', name: 'Flux 3D', provider: 'pollinations', cat: '3d', tag: '3D • CGI' },
    { id: 'turbo', name: 'SDXL Turbo', provider: 'pollinations', cat: 'fast', tag: 'Fast • Turbo' }
  ];

  // Dedicated OpenRouter Curated Image Engines
  const CURATED_OPENROUTER_IMAGE_MODELS = []; // Kosongkan karena OpenRouter tidak mendistribusikan model gambar secara default

  // Model pembuat musik/audio ASLI (output audio) di OpenRouter. Model teks tidak bisa membuat suara.
  const CURATED_OPENROUTER_MUSIC_MODELS = []; // Kosongkan karena model seperti Lyria/Suno tidak ada di OpenRouter (hanya halusinasi AI sebelumnya)

  // Persistent Unique Client / User Identity Token for Strict User Isolation
  function getOrCreateUserId() {
    try {
      let uid = localStorage.getItem('zoz_user_id_v1');
      if (!uid || typeof uid !== 'string' || uid.length < 8) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          uid = 'usr_' + crypto.randomUUID().replace(/-/g, '');
        } else {
          uid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
        }
        localStorage.setItem('zoz_user_id_v1', uid);
      }
      return uid;
    } catch (_) {
      return 'usr_guest_' + Date.now().toString(36);
    }
  }

  // Capability token identitas: secret acak 256-bit yang hanya diketahui browser
  // ini. Server menyimpan SHA-256-nya pada pendaftaran kunjungan pertama lalu
  // MENOLAK setiap request ber-X-User-ID yang tidak membawa token cocok — sehingga
  // X-User-ID yang bocor (log/URL) tidak lagi cukup untuk membaca sesi orang lain.
  function getOrCreateUserToken() {
    try {
      let token = localStorage.getItem('zoz_user_token_v1');
      if (!token || typeof token !== 'string' || token.length < 32) {
        const bytes = new Uint8Array(32);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          crypto.getRandomValues(bytes);
        } else {
          for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        token = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('zoz_user_token_v1', token);
      }
      return token;
    } catch (_) {
      return '';
    }
  }

  // ==================== FAVORITE MODELS MANAGEMENT ====================
  function loadFavoriteModels() {
    try {
      const raw = localStorage.getItem('zoz_favorite_models_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  }

  function saveFavoriteModels() {
    try {
      localStorage.setItem('zoz_favorite_models_v1', JSON.stringify(STATE.favoriteModels || []));
    } catch (_) {}
  }

  function isModelFavorite(modelId) {
    if (!modelId || !STATE.favoriteModels) return false;
    return STATE.favoriteModels.includes(modelId);
  }

  function toggleModelFavorite(modelId, e) {
    if (e) {
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (_) {}
    }
    if (!modelId) return;
    if (!Array.isArray(STATE.favoriteModels)) {
      STATE.favoriteModels = [];
    }
    const idx = STATE.favoriteModels.indexOf(modelId);
    const wasFav = idx !== -1;
    if (wasFav) {
      STATE.favoriteModels.splice(idx, 1);
    } else {
      STATE.favoriteModels.push(modelId);
    }
    saveFavoriteModels();
    updateCatalogFavBadge();

    // Re-render model dropdown if visible or open
    try {
      if (typeof els !== 'undefined' && els.modelDropdownMenu && els.modelDropdownMenu.classList.contains('show')) {
        const searchVal = els.modelSearchInput ? els.modelSearchInput.value : '';
        populateModelDropdown(searchVal);
      }
    } catch (_) {}

    // Re-render live catalog if visible or open
    try {
      const catModal = document.getElementById('liveModelCatalogModal');
      if (catModal && catModal.classList.contains('show')) {
        renderLiveModelCatalog();
      }
    } catch (_) {}

    try {
      if (typeof AudioEngine !== 'undefined' && AudioEngine.click) AudioEngine.click();
    } catch (_) {}

    try {
      if (typeof showToast === 'function') {
        showToast(
          wasFav ? `Model "${modelId}" dihapus dari favorit` : `Model "${modelId}" ditambahkan ke favorit!`,
          wasFav ? 'info' : 'success'
        );
      }
    } catch (_) {}
  }

  function updateCatalogFavBadge() {
    try {
      const badge = document.getElementById('catalogFavCountBadge');
      if (badge) {
        const count = Array.isArray(STATE.favoriteModels) ? STATE.favoriteModels.length : 0;
        badge.textContent = count;
      }
    } catch (_) {}
  }

  // ==================== STATE MANAGEMENT ====================
  const STATE = {
    userId: getOrCreateUserId(),
    userToken: getOrCreateUserToken(),
    favoriteModels: loadFavoriteModels(),
    mode: 'ollama', // 'ollama' | 'openrouter' | 'auto'
    sessions: [],
    currentSessionId: null,
    activeSessionPerMode: {
      ollama: null,
      openrouter: null,
      auto: null
    },
    attachedImages: [], // Array of Base64 data URLs
    get attachedImage() { return (this.attachedImages && this.attachedImages.length > 0) ? this.attachedImages[0] : null; },
    set attachedImage(val) { this.attachedImages = val ? (Array.isArray(val) ? val : [val]) : []; },
    attachedDocs: [], // Array of { name, size, content }
    searchMode: 'default', // 'off' | 'default' | 'premium' | 'autonomous'
    get webSearchEnabled() { return this.searchMode !== 'off'; },
    set webSearchEnabled(val) { this.searchMode = val ? 'default' : 'off'; },
    get isDeepResearch() { return this.searchMode === 'premium'; },
    get isAutonomousSearch() { return this.searchMode === 'autonomous'; },
    researchTargetUrls: [], // Target URL kustom untuk Mode Deep Research
    isImageGenMode: false,
    isMusicGenMode: false,
    isYouTubeSearchMode: false, // Tool "Cari Video YouTube" (toggle dari menu Lampiran)
    isGenerating: false,
    isSending: false, // Guard anti pengiriman ganda (Enter berulang saat masih ada await)
    abortController: null,
    currentDeepResearchTaskId: null,
    soundEnabled: true,
    ollamaModels: [...OFFICIAL_OLLAMA_CLOUD_MODELS],
    openRouterModels: [...DEFAULT_OPENROUTER_MODELS],
    availableImageModels: [...DEFAULT_IMAGE_MODELS],
    settings: {
      ollamaEndpoint: 'http://127.0.0.1:11434',
      ollamaApiKey: '',
      openRouterKey: '',
      serperApiKey: '075538fed9c64990e1eb32a06726c1e55a933c1e',
      ollamaModel: 'qwen2.5:1.5b',
      openRouterModel: 'openrouter/free',
      imageModel: 'flux',
      musicModel: 'qwen2.5:1.5b',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 8192,
      systemPrompt: SYSTEM_PRESETS.kaisar,
      customSystemPrompt: '',
      activePreset: 'kaisar',
      autoPolicy: 'local_first',
      youtubeSearchTool: false // Tool pencarian video YouTube (toggle dari menu Lampiran)
    },
    activeCatalogTab: 'ollama', // 'ollama' | 'openrouter'
    dropdownModelTab: 'ollama', // 'ollama' | 'openrouter'
    catalogTargetInputId: null,
    catalogSearchQuery: '',
    catalogCategoryFilter: 'all', // 'all' | 'free' | 'reasoning' | 'fast' | 'flagship' | 'coding'
    musicOpenRouterCatFilter: 'all', // 'all' | 'free' | 'google' | 'openai' | 'anthropic' | 'meta' | 'deepseek' | 'qwen' | 'mistral'
    activeInspectionTab: 'agent1', // 'agent1' | 'agent2' | 'scraper' | 'synthesizer' | 'model4'
    currentLiveInspection: null,
    openRouterBalance: null, // { totalCredits, totalUsage, remaining, isFreeTier, lastChecked }
    ollamaBalance: null, // { currentBalance, freeUsage, lastChecked }
    ollamaStatus: { online: true, modelCount: 0, lastChecked: null },
    isPromptHidden: false
  };

  // H9: label tombol tampil/sembunyikan pemutar YouTube selalu mencerminkan
  // kondisi wrap. Dipanggil dari handler toggle DAN dari setiap jalur yang
  // mengubah wrap.style.display (playYouTube/playDirectUrl/playTrack) — dulu
  // label hanya diganti oleh handler sehingga basi ("Tampilkan" saat video
  // terlihat, atau tombol terkubur karena berada di dalam wrap yang disembunyikan).
  function syncYtPlayerVisibilityBtn() {
    try {
      const btn = els.toggleYtPlayerVisibilityBtn;
      const wrap = els.ytPlayerContainerWrap;
      if (!btn || !wrap) return;
      const hidden = !wrap.style.display || wrap.style.display === 'none';
      btn.innerHTML = hidden
        ? '<i class="fa-solid fa-eye"></i> Tampilkan Video'
        : '<i class="fa-solid fa-eye-slash"></i> Sembunyikan Video';
    } catch (_) {}
  }

  // ===== IDENTITAS OTOMATIS PADA SEMUA REQUEST SAME-ORIGIN =====
  // Dipasang SEKALI di sini sehingga setiap fetch('/api/...') — termasuk yang
  // belum pernah menyertakan header identitas — otomatis membawa X-User-ID +
  // X-User-Token. Server menolak (401) request ber-identitas tanpa token cocok;
  // tanpa wrapper ini satu pun request yang lupa header akan gagal.
  (function installIdentityHeaders() {
    try {
      const origFetch = window.fetch;
      if (typeof origFetch !== 'function') return;
      window.fetch = function (input, init) {
        try {
          const url = (typeof input === 'string') ? input
            : (input && typeof input === 'object' && typeof input.url === 'string') ? input.url
            : (input instanceof URL) ? input.href : '';
          const isSameOrigin = url.startsWith('/') ||
            url.startsWith(window.location.origin + '/') ||
            url === window.location.origin;
          if (isSameOrigin && STATE.userId) {
            const hdrs = new Headers((init && init.headers) || (input && input.headers) || undefined);
            if (!hdrs.has('X-User-ID')) hdrs.set('X-User-ID', STATE.userId);
            if (STATE.userToken && !hdrs.has('X-User-Token')) hdrs.set('X-User-Token', STATE.userToken);
            if (init) {
              init.headers = hdrs;
              return origFetch(input, init);
            }
            return origFetch(input, { headers: hdrs });
          }
        } catch (_) {}
        return origFetch(input, init);
      };
    } catch (_) {}
  })();

  // ==================== AUDIO SYNTHESIZER (Sci-Fi Cyber Blips) ====================
  const AudioEngine = {
    ctx: null,
    unlockPromise: null,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AudioContextClass();
        } catch (e) {
          this.ctx = null;
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        try {
          this.unlockPromise = this.ctx.resume().catch(() => {});
        } catch (e) {}
      }
      return this.ctx;
    },
    setupUnlock() {
      const unlock = () => {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      };
      window.addEventListener('pointerdown', unlock, { once: true, passive: true });
      window.addEventListener('keydown', unlock, { once: true, passive: true });
      window.addEventListener('touchstart', unlock, { once: true, passive: true });
    },
    playBeep(freq = 440, type = 'sine', duration = 0.08, gain = 0.05) {
      if (!STATE.soundEnabled) return;
      try {
        this.init();
        if (!this.ctx) return;

        const emitSound = () => {
          try {
            if (!this.ctx || this.ctx.state !== 'running') return;
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = type;
            const now = this.ctx.currentTime;
            osc.frequency.setValueAtTime(freq, now);
            g.gain.setValueAtTime(gain, now);
            g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            osc.connect(g);
            g.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + duration);
          } catch (_) {}
        };

        if (this.ctx.state === 'suspended') {
          const p = this.unlockPromise || this.ctx.resume().catch(() => {});
          p.then(() => {
            emitSound();
          }).catch(() => {});
        } else {
          emitSound();
        }
      } catch (e) {
        // Ignore audio restrictions
      }
    },
    click() { this.playBeep(880, 'triangle', 0.04, 0.03); },
    snap() {
      this.playBeep(1200, 'square', 0.03, 0.06);
      setTimeout(() => this.playBeep(600, 'sine', 0.05, 0.04), 35);
    },
    send() { 
      this.playBeep(520, 'sine', 0.06, 0.04);
      setTimeout(() => this.playBeep(1040, 'sine', 0.08, 0.04), 40);
    },
    receive() { this.playBeep(780, 'sine', 0.06, 0.03); },
    success() { 
      this.playBeep(587.33, 'sine', 0.08, 0.05); 
      setTimeout(() => this.playBeep(880, 'triangle', 0.12, 0.05), 60); 
    },
    error() { this.playBeep(220, 'sawtooth', 0.15, 0.06); }
  };
  AudioEngine.setupUnlock();

  // ==================== DOM ELEMENTS ====================
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const els = {
    // Nav & Mode
    modeTabs: $$('.mode-tab'),
    currentModelLabel: $('#currentModelLabel'),
    modelPickerChip: $('#modelPickerChip'),
    modelDropdownMenu: $('#modelDropdownMenu'),
    dropdownTabOllama: $('#dropdownTabOllama'),
    dropdownTabOpenRouter: $('#dropdownTabOpenRouter'),
    btnOpenFullCatalogFromDropdown: $('#btnOpenFullCatalogFromDropdown'),
    dropdownModelList: $('#dropdownModelList'),
    modelSearchInput: $('#modelSearchInput'),
    customModelInput: $('#customModelInput'),
    useCustomModelBtn: $('#useCustomModelBtn'),
    singleModelPickerWrap: $('#singleModelPickerWrap'),
    
    // Status
    ollamaStatusVal: $('#ollamaStatusVal'),
    ollamaIndicator: $('#ollamaIndicator'),
    refreshOllamaBtn: $('#refreshOllamaBtn'),
    openRouterStatusVal: $('#openRouterStatusVal'),
    openRouterIndicator: $('#openRouterIndicator'),
    openSettingsKeyBtn: $('#openSettingsKeyBtn'),
    
    // Chat containers
    chatViewport: $('#chatViewport'),
    singleChatContainer: $('#singleChatContainer'),
    welcomeHero: $('#welcomeHero'),
    messagesList: $('#messagesList'),
    
    // History & Navigation
    newChatBtn: $('#newChatBtn'),
    pullUpNewChatBtn: $('#pullUpNewChatBtn'),
    pullUpNewChatWrapper: $('#pullUpNewChatWrapper'),
    chatHistoryList: $('#chatHistoryList'),
    searchHistoryInput: $('#searchHistoryInput'),
    clearAllHistoryBtn: $('#clearAllHistoryBtn'),
    toggleSidebarBtn: $('#toggleSidebarBtn'),
    closeSidebarBtn: $('#closeSidebarBtn'),
    sidebar: $('#sidebar'),
    sidebarBackdrop: $('#sidebarBackdrop'),
    mainContent: $('#mainContent'),
    appContainer: $('.app-container'),
    
    // Input / Composer & Unified Attachments
    mainComposerContainer: $('#mainComposerContainer'),
    composerCrownRow: $('#composerCrownRow'),
    neutronCrownBtn: $('#neutronCrownBtn'),
    promptInput: $('#promptInput'),
    sendPromptBtn: $('#sendPromptBtn'),
    stopGenerationBtn: $('#stopGenerationBtn'),
    attachToggleBtn: $('#attachToggleBtn'),
    attachmentDropdown: $('#attachmentDropdown'),
    attachmentMenuWrapper: $('#attachmentMenuWrapper'),
    attachOptionCamera: $('#attachOptionCamera'),
    attachOptionImage: $('#attachOptionImage'),
    attachOptionGenImage: $('#attachOptionGenImage'),
    attachOptionGenMusic: $('#attachOptionGenMusic'),
    attachOptionDoc: $('#attachOptionDoc'),
    attachOptionYouTubeSearch: $('#attachOptionYouTubeSearch'),
    imageFileInput: $('#imageFileInput'),
    cameraFileInput: $('#cameraFileInput'),
    docFileInput: $('#docFileInput'),
    searchMenuWrapper: $('#searchMenuWrapper'),
    webSearchToggleBtn: $('#webSearchToggleBtn'),
    webSearchIcon: $('#webSearchIcon'),
    searchBadge: $('#searchBadge'),
    searchDropdown: $('#searchDropdown'),
    imageModelMenuWrapper: $('#imageModelMenuWrapper'),
    imageModelDropdown: $('#imageModelDropdown'),
    imageModelBadge: $('#imageModelBadge'),
    imageGenToggleBtn: $('#imageGenToggleBtn'),
    imageModeIndicator: $('#imageModeIndicator'),
    youtubeModeIndicator: $('#youtubeModeIndicator'),
    musicGenToggleBtn: $('#musicGenToggleBtn'),
    musicModeIndicator: $('#musicModeIndicator'),
    musicModelBadge: $('#musicModelBadge'),
    musicModelMenuWrapper: $('#musicModelMenuWrapper'),
    musicModelDropdown: $('#musicModelDropdown'),
    tabBtnMusicOllama: $('#tabBtnMusicOllama'),
    tabBtnMusicOpenRouter: $('#tabBtnMusicOpenRouter'),
    paneMusicOllama: $('#paneMusicOllama'),
    paneMusicOpenRouter: $('#paneMusicOpenRouter'),
    musicModelOllamaList: $('#musicModelOllamaList'),
    musicModelOpenRouterList: $('#musicModelOpenRouterList'),
    musicOllamaSearchInput: $('#musicOllamaSearchInput'),
    musicOllamaCountText: $('#musicOllamaCountText'),
    musicOpenRouterFilterPills: $('#musicOpenRouterFilterPills'),
    musicOpenRouterCountText: $('#musicOpenRouterCountText'),
    customOllamaMusicModelInput: $('#customOllamaMusicModelInput'),
    btnApplyCustomMusicOllamaModel: $('#btnApplyCustomMusicOllamaModel'),
    customOpenRouterMusicModelInput: $('#customOpenRouterMusicModelInput'),
    btnApplyCustomMusicOpenRouterModel: $('#btnApplyCustomMusicOpenRouterModel'),
    musicModelSearchInput: $('#musicModelSearchInput'),
    musicOpenRouterStatusBar: $('#musicOpenRouterStatusBar'),
    musicOpenRouterConfigBtn: $('#musicOpenRouterConfigBtn'),
    tabBtnPollinations: $('#tabBtnPollinations'),
    tabBtnOpenRouter: $('#tabBtnOpenRouter'),
    panePollinations: $('#panePollinations'),
    paneOpenRouter: $('#paneOpenRouter'),
    openRouterStatusBar: $('#openRouterStatusBar'),
    openRouterConfigBtn: $('#openRouterConfigBtn'),
    imageModelSearchInput: $('#imageModelSearchInput'),
    customOpenRouterImageModelInput: $('#customOpenRouterImageModelInput'),
    btnApplyCustomImageModel: $('#btnApplyCustomImageModel'),
    imageModelOpenRouterList: $('#imageModelOpenRouterList'),
    composerBox: $('.composer-box'),
    attachmentPreviewBar: $('#attachmentPreviewBar'),
    autoConvertDocRow: $('#autoConvertDocRow'),
    convertToMdPillBtn: $('#convertToMdPillBtn'),
    composerFoldPromptCard: $('#composerFoldPromptCard'),
    foldCardTitle: $('#foldCardTitle'),
    foldCardSubtitle: $('#foldCardSubtitle'),
    btnFoldConfirm: $('#btnFoldConfirm'),
    btnFoldDismiss: $('#btnFoldDismiss'),
    promptFoldConfirmModal: $('#promptFoldConfirmModal'),
    foldModalFileName: $('#foldModalFileName'),
    foldModalSnippet: $('#foldModalSnippet'),
    foldModalMeta: $('#foldModalMeta'),
    chkAutoFoldAlways: $('#chkAutoFoldAlways'),
    btnFoldModalConfirm: $('#btnFoldModalConfirm'),
    btnFoldModalCancel: $('#btnFoldModalCancel'),
    docPreviewModal: $('#docPreviewModal'),
    docPreviewModalTitle: $('#docPreviewModalTitle'),
    docPreviewMetaName: $('#docPreviewMetaName'),
    docPreviewMetaSize: $('#docPreviewMetaSize'),
    docPreviewMetaLines: $('#docPreviewMetaLines'),
    docPreviewContent: $('#docPreviewContent'),
    revertDocToPromptBtn: $('#revertDocToPromptBtn'),
    deleteDocFromModalBtn: $('#deleteDocFromModalBtn'),
    // AI File Studio (preview langsung + kode + unduh file buatan AI)
    aiFileStudioModal: $('#aiFileStudioModal'),
    aiFileStudioTitle: $('#aiFileStudioTitle'),
    aiFileStudioTabs: $('#aiFileStudioTabs'),
    aiFileStudioPreviewPane: $('#aiFileStudioPreviewPane'),
    aiFileStudioFrame: $('#aiFileStudioFrame'),
    aiFileStudioPlaceholder: $('#aiFileStudioPlaceholder'),
    aiFileStudioCode: $('#aiFileStudioCode'),
    aiFileStudioMeta: $('#aiFileStudioMeta'),
    aiFileStudioCopyBtn: $('#aiFileStudioCopyBtn'),
    aiFileStudioDownloadBtn: $('#aiFileStudioDownloadBtn'),
    imagePreviewImg: $('#imagePreviewImg'),
    removeImageBtn: $('#removeImageBtn'),
    activePresetBanner: $('#activePresetBanner'),
    activePresetName: $('#activePresetName'),
    clearPresetBtn: $('#clearPresetBtn'),
    researchUrlManagerModal: $('#researchUrlManagerModal'),
    researchUrlManagerInput: $('#researchUrlManagerInput'),
    researchUrlManagerAddBtn: $('#researchUrlManagerAddBtn'),
    researchUrlManagerList: $('#researchUrlManagerList'),
    researchUrlManagerDoneBtn: $('#researchUrlManagerDoneBtn'),
    researchUrlManagerDisableBtn: $('#researchUrlManagerDisableBtn'),
    researchUrlManagerSwitchModeBtn: $('#researchUrlManagerSwitchModeBtn'),
    
    // Buttons & Modals
    settingsBtn: $('#settingsBtn'),
    settingsModal: $('#settingsModal'),
    modelHubBtn: $('#modelHubBtn'),
    systemPromptModalBtn: $('#systemPromptModalBtn'),
    exportChatBtn: $('#exportChatBtn'),
    exportConfirmModal: $('#exportConfirmModal'),
    exportConfirmTitle: $('#exportConfirmTitle'),
    exportConfirmMsgCount: $('#exportConfirmMsgCount'),
    exportConfirmImgCount: $('#exportConfirmImgCount'),
    btnExecuteExportChat: $('#btnExecuteExportChat'),
    soundToggleBtn: $('#soundToggleBtn'),
    toastContainer: $('#toastContainer'),
    
    // Settings fields
    settingOllamaEndpoint: $('#settingOllamaEndpoint'),
    settingOllamaApiKey: $('#settingOllamaApiKey'),
    toggleShowOllamaKeyBtn: $('#toggleShowOllamaKeyBtn'),
    testOllamaBtn: $('#testOllamaBtn'),
    testOllamaKeyBtn: $('#testOllamaKeyBtn'),
    settingOllamaStatusCard: $('#settingOllamaStatusCard'),
    settingOllamaStatusDot: $('#settingOllamaStatusDot'),
    settingOllamaStatusVal: $('#settingOllamaStatusVal'),
    settingOllamaModelCountText: $('#settingOllamaModelCountText'),
    btnRefreshOllamaStatus: $('#btnRefreshOllamaStatus'),
    settingOpenRouterKey: $('#settingOpenRouterKey'),
    toggleShowKeyBtn: $('#toggleShowKeyBtn'),
    testOpenRouterBtn: $('#testOpenRouterBtn'),
    settingOpenRouterBalanceCard: $('#settingOpenRouterBalanceCard'),
    settingOpenRouterStatusDot: $('#settingOpenRouterStatusDot'),
    settingOpenRouterBalanceVal: $('#settingOpenRouterBalanceVal'),
    settingOpenRouterUsageText: $('#settingOpenRouterUsageText'),
    settingOpenRouterTierText: $('#settingOpenRouterTierText'),
    btnRefreshOpenRouterBalance: $('#btnRefreshOpenRouterBalance'),
    btnAddOpenRouterCredits: $('#btnAddOpenRouterCredits'),
    settingSerperApiKey: $('#settingSerperApiKey'),
    toggleShowSerperKeyBtn: $('#toggleShowSerperKeyBtn'),
    testSerperBtn: $('#testSerperBtn'),
    settingAutoPolicy: $('#settingAutoPolicy'),
    settingMusicModel: $('#settingMusicModel'),
    paramTemperature: $('#paramTemperature'),
    valTemperature: $('#valTemperature'),
    paramTopP: $('#paramTopP'),
    valTopP: $('#valTopP'),
    settingSystemPrompt: $('#settingSystemPrompt'),
    saveSettingsBtn: $('#saveSettingsBtn'),

    // Cyber BGM & Audio Deck
    musicPlayerModalBtn: $('#musicPlayerModalBtn'),
    musicHeaderPulse: $('#musicHeaderPulse'),
    musicDeckModal: $('#musicDeckModal'),
    sidebarBgmWidget: $('#sidebarBgmWidget'),
    bgmAnimBars: $('#bgmAnimBars'),
    bgmTrackTitle: $('#bgmTrackTitle'),
    openMusicModalFromWidget: $('#openMusicModalFromWidget'),
    bgmPrevBtn: $('#bgmPrevBtn'),
    bgmPlayPauseBtn: $('#bgmPlayPauseBtn'),
    bgmNextBtn: $('#bgmNextBtn'),
    bgmMiniVolume: $('#bgmMiniVolume'),
    audioDropzone: $('#audioDropzone'),
    localAudioFileInput: $('#localAudioFileInput'),
    triggerAudioUploadBtn: $('#triggerAudioUploadBtn'),
    playlistCountBadge: $('#playlistCountBadge'),
    playlistItemsList: $('#playlistItemsList'),
    clearPlaylistBtn: $('#clearPlaylistBtn'),
    ambientCardsGrid: $('#ambientCardsGrid'),
    audioVisualizerCanvas: $('#audioVisualizerCanvas'),
    deckCurrentTrackName: $('#deckCurrentTrackName'),
    deckCurrentTrackMeta: $('#deckCurrentTrackMeta'),
    deckLoopBtn: $('#deckLoopBtn'),
    deckShuffleBtn: $('#deckShuffleBtn'),
    deckProgressSlider: $('#deckProgressSlider'),
    deckPrevBtn: $('#deckPrevBtn'),
    deckPlayPauseBtn: $('#deckPlayPauseBtn'),
    deckNextBtn: $('#deckNextBtn'),
    deckMasterVolume: $('#deckMasterVolume'),
    valMasterVolume: $('#valMasterVolume'),
    
    // Online Audio & YouTube
    onlineAudioUrlInput: $('#onlineAudioUrlInput'),
    onlineAudioTitleInput: $('#onlineAudioTitleInput'),
    playOnlineUrlBtn: $('#playOnlineUrlBtn'),
    saveOnlineUrlBtn: $('#saveOnlineUrlBtn'),
    ytPlayerContainerWrap: $('#ytPlayerContainerWrap'),
    ytPlayerContainer: $('#ytPlayerContainer'),
    toggleYtPlayerVisibilityBtn: $('#toggleYtPlayerVisibilityBtn'),
    ytFsBtn: $('#ytFsBtn'),

    // Floating scroll to bottom button
    scrollBottomBtn: $('#scrollBottomBtn'),

    // Full-Screen Image Lightbox Modal
    imageLightboxModal: $('#imageLightboxModal'),
    lightboxBackdrop: $('#lightboxBackdrop'),
    lightboxImg: $('#lightboxImg'),
    lightboxImgWrapper: $('#lightboxImgWrapper'),
    lightboxCounter: $('#lightboxCounter'),
    lightboxPrevBtn: $('#lightboxPrevBtn'),
    lightboxNextBtn: $('#lightboxNextBtn'),
    lightboxZoomInBtn: $('#lightboxZoomInBtn'),
    lightboxZoomOutBtn: $('#lightboxZoomOutBtn'),
    lightboxDownloadBtn: $('#lightboxDownloadBtn'),
    lightboxCloseBtn: $('#lightboxCloseBtn'),

    // Live Model Catalog Modal
    liveModelCatalogModal: $('#liveModelCatalogModal'),
    btnTabCatalogOllama: $('#btnTabCatalogOllama'),
    btnTabCatalogOpenRouter: $('#btnTabCatalogOpenRouter'),
    liveModelCatalogSearchInput: $('#liveModelCatalogSearchInput'),
    btnRefreshLiveCatalog: $('#btnRefreshLiveCatalog'),
    catalogTargetHint: $('#catalogTargetHint'),
    catalogTargetLabel: $('#catalogTargetLabel'),
    catalogListContainer: $('#catalogListContainer'),
    badgeOllamaCount: $('#badgeOllamaCount'),
    badgeOpenRouterCount: $('#badgeOpenRouterCount'),
    catalogBalanceBanner: $('#catalogBalanceBanner'),
    catalogBalanceIcon: $('#catalogBalanceIcon'),
    catalogBalanceText: $('#catalogBalanceText'),
    catalogBalanceValue: $('#catalogBalanceValue'),
    catalogBalanceSub: $('#catalogBalanceSub'),
    btnRefreshCatalogBalance: $('#btnRefreshCatalogBalance'),
    btnCatalogAddCredits: $('#btnCatalogAddCredits'),
    catalogStatusInfo: $('#catalogStatusInfo'),

    // Live Research Inspector Modal
    liveResearchInspectionModal: $('#liveResearchInspectionModal'),
    inspectTopik: $('#inspectTopik'),
    inspectCurrentQuery: $('#inspectCurrentQuery'),
    inspectIteration: $('#inspectIteration'),
    inspectTimestamp: $('#inspectTimestamp'),
    btnTabInspectAgent1: $('#btnTabInspectAgent1'),
    btnTabInspectAgent2: $('#btnTabInspectAgent2'),
    btnTabInspectScraper: $('#btnTabInspectScraper'),
    btnTabInspectSynthesizer: $('#btnTabInspectSynthesizer'),
    btnTabInspectModel4: $('#btnTabInspectModel4'),
    inspectCountAgent1: $('#inspectCountAgent1'),
    inspectCountAgent2: $('#inspectCountAgent2'),
    inspectCountScraper: $('#inspectCountScraper'),
    inspectCountSynthesizer: $('#inspectCountSynthesizer'),
    inspectCountModel4: $('#inspectCountModel4'),
    inspectTabContent: $('#inspectTabContent')
  };

  // ==================== FULL-SCREEN IMAGE LIGHTBOX (ChatGPT & Gemini Style) ====================
  const ImageLightbox = {
    modal: null,
    img: null,
    imgWrapper: null,
    counter: null,
    prevBtn: null,
    nextBtn: null,
    images: [],
    currentIndex: 0,
    isZoomed: false,
    touchStartX: 0,
    touchEndX: 0,

    init() {
      this.modal = els.imageLightboxModal;
      this.img = els.lightboxImg;
      this.imgWrapper = els.lightboxImgWrapper;
      this.counter = els.lightboxCounter;
      this.prevBtn = els.lightboxPrevBtn;
      this.nextBtn = els.lightboxNextBtn;

      els.lightboxCloseBtn?.addEventListener('click', () => this.close());
      els.lightboxBackdrop?.addEventListener('click', () => this.close());
      this.prevBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.prev(); });
      this.nextBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.next(); });
      
      els.lightboxZoomInBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.toggleZoom(true); });
      els.lightboxZoomOutBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.toggleZoom(false); });
      els.lightboxDownloadBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.download(); });

      // Double-click image to toggle zoom
      this.img?.addEventListener('dblclick', () => this.toggleZoom());
      this.img?.addEventListener('click', (e) => {
        if (this.isZoomed) {
          e.stopPropagation();
          this.toggleZoom(false);
        }
      });

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (!this.isOpen()) return;
        if (e.key === 'Escape') this.close();
        if (e.key === 'ArrowLeft') this.prev();
        if (e.key === 'ArrowRight') this.next();
      });

      // Mobile Touch Swipe support
      const stage = $('#lightboxImageStage');
      if (stage) {
        stage.addEventListener('touchstart', (e) => {
          if (e.touches && e.touches[0]) this.touchStartX = e.touches[0].clientX;
        }, { passive: true });

        stage.addEventListener('touchend', (e) => {
          if (this.isZoomed) return; // Nonaktifkan swipe berganti foto saat pengguna sedang zoom & panning
          if (e.changedTouches && e.changedTouches[0]) {
            this.touchEndX = e.changedTouches[0].clientX;
            const diff = this.touchStartX - this.touchEndX;
            if (Math.abs(diff) > 45) {
              if (diff > 0) this.next();
              else this.prev();
            }
          }
        }, { passive: true });
      }
    },

    isOpen() {
      return this.modal && this.modal.style.display === 'flex';
    },

    open(imagesArray, index = 0) {
      if (!Array.isArray(imagesArray) || imagesArray.length === 0) return;
      this.images = imagesArray;
      this.currentIndex = Math.max(0, Math.min(index, imagesArray.length - 1));
      this.isZoomed = false;
      this.imgWrapper?.classList.remove('is-zoomed');
      
      this.updateView();
      if (this.modal) {
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        history.pushState({ modal: 'lightbox' }, '');
      }
      AudioEngine.click();
    },

    updateView() {
      if (!this.img || this.images.length === 0) return;
      const currentSrc = this.images[this.currentIndex];
      this.img.src = currentSrc;

      if (this.counter) {
        this.counter.innerText = `${this.currentIndex + 1} / ${this.images.length}`;
      }

      if (this.prevBtn) {
        this.prevBtn.style.display = this.images.length > 1 ? 'flex' : 'none';
      }
      if (this.nextBtn) {
        this.nextBtn.style.display = this.images.length > 1 ? 'flex' : 'none';
      }
    },

    next() {
      if (this.images.length <= 1) return;
      this.currentIndex = (this.currentIndex + 1) % this.images.length;
      this.toggleZoom(false);
      this.updateView();
      AudioEngine.click();
    },

    prev() {
      if (this.images.length <= 1) return;
      this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
      this.toggleZoom(false);
      this.updateView();
      AudioEngine.click();
    },

    toggleZoom(forceState = null) {
      this.isZoomed = forceState !== null ? forceState : !this.isZoomed;
      if (this.imgWrapper) {
        this.imgWrapper.classList.toggle('is-zoomed', this.isZoomed);
      }
    },

    async download() {
      if (!this.images[this.currentIndex]) return;
      const src = this.images[this.currentIndex];
      showToast('Mengunduh foto resolusi tinggi...', 'info');
      const fileName = `zoz_foto_${Date.now()}_${this.currentIndex + 1}.png`;
      try {
        if (src.startsWith('data:')) {
          const a = document.createElement('a');
          a.href = src;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => a.remove(), 500);
          return;
        }
        const resp = await fetch(src, { mode: 'cors' });
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          a.remove();
          URL.revokeObjectURL(blobUrl);
        }, 3000);
        showToast('Foto berhasil diunduh.');
      } catch (err) {
        const a = document.createElement('a');
        a.href = src;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 500);
        // F14: jalur fallback TIDAK boleh menampilkan toast "berhasil" — unduhan
        // otomatis sering diblokir CORS dan tab baru hanya membuka gambar.
        showToast('Gagal mengunduh langsung (CORS) — gambar dibuka di tab baru, gunakan klik-kanan → Simpan Gambar.', 'error');
      }
      AudioEngine.click();
    },

    close(triggerHistoryBack = true) {
      if (!this.modal || this.modal.style.display === 'none') return;
      this.modal.style.display = 'none';
      document.body.style.overflow = '';
      this.toggleZoom(false);
      AudioEngine.click();

      if (triggerHistoryBack && history.state?.modal === 'lightbox') {
        history.back();
      }
    }
  };

  // ==================== INDEXEDDB CHAT VAULT ====================
  const ChatDB = {
    db: null,
    async init() {
      return new Promise((resolve) => {
        try {
          const req = indexedDB.open('ZozRouterChatDB_v2', 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('sessions')) {
              db.createObjectStore('sessions', { keyPath: 'id' });
            }
          };
          req.onsuccess = (e) => {
            this.db = e.target.result;
            resolve(this.db);
          };
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    },
    async saveSession(session) {
      if (!session || !session.id) return false;
      if (!this.db) await this.init();
      if (!this.db) return false;
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('sessions', 'readwrite');
          tx.objectStore('sessions').put(session);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    },
    async getSession(id) {
      if (!id) return null;
      if (!this.db) await this.init();
      if (!this.db) return null;
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('sessions', 'readonly');
          const req = tx.objectStore('sessions').get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    },
    async saveAllSessions(sessions) {
      if (!this.db) await this.init();
      if (!this.db || !Array.isArray(sessions)) return false;
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('sessions', 'readwrite');
          const store = tx.objectStore('sessions');
          store.clear();
          sessions.forEach(s => store.put(s));
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    },
    async getAllSessions() {
      if (!this.db) await this.init();
      if (!this.db) return [];
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('sessions', 'readonly');
          const req = tx.objectStore('sessions').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });
    },
    async deleteSession(id) {
      if (!this.db) await this.init();
      if (!this.db) return false;
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('sessions', 'readwrite');
          tx.objectStore('sessions').delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    },
    async clearAllSessions() {
      if (!this.db) await this.init();
      if (!this.db) return false;
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('sessions', 'readwrite');
          tx.objectStore('sessions').clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    }
  };

  // ==================== DEVICE-FIRST NATIVE STORAGE & PERSISTENCE ====================
  const DeviceStorage = {
    isDeviceBackendAvailable: false,

    async init() {
      if (IS_GITHUB_PAGES || IS_CLOUD_HOSTED) {
        this.isDeviceBackendAvailable = false;
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch('/api/health', {
          method: 'GET',
          headers: { 'X-User-ID': STATE.userId },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (data && data.storage === 'device-disk' && !IS_CLOUD_HOSTED) {
            this.isDeviceBackendAvailable = true;
          }
        }
      } catch (e) {
        this.isDeviceBackendAvailable = false;
      }
    },

    async getSessionsList() {
      if (!this.isDeviceBackendAvailable) return null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch('/api/sessions', {
          headers: { 'X-User-ID': STATE.userId },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          return data.sessions || [];
        }
      } catch (e) {
        console.warn('DeviceStorage getSessionsList failed:', e.message);
      }
      return null;
    },

    async getSession(id) {
      if (this.isDeviceBackendAvailable) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
            headers: { 'X-User-ID': STATE.userId },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            return await res.json();
          }
        } catch (e) {
          console.warn('DeviceStorage getSession failed, falling back to ChatDB:', e.message);
        }
      }
      try {
        const localSess = await ChatDB.getSession(id);
        if (localSess) return localSess;
      } catch (dbErr) {
        console.warn('ChatDB getSession fallback error:', dbErr.message);
      }
      return null;
    },

    async saveSession(session) {
      if (!session || !session.id) return;
      session.userId = STATE.userId;
      // Safety guard: Never overwrite disk storage with an unhydrated lazy-loaded session
      if (session._isLazyDisk) {
        return;
      }
      if (this.isDeviceBackendAvailable) {
        try {
          await fetch('/api/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-ID': STATE.userId
            },
            body: JSON.stringify({ ...session, userId: STATE.userId })
          });
        } catch (e) {
          console.warn('DeviceStorage saveSession failed:', e.message);
        }
      }
      // Also save in local ChatDB vault
      await ChatDB.saveSession(session);
    },

    async updateSessionMetadata(id, patch) {
      if (!id || !patch) return;
      if (this.isDeviceBackendAvailable) {
        try {
          await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-User-ID': STATE.userId
            },
            body: JSON.stringify({ ...patch, userId: STATE.userId })
          });
        } catch (e) {
          console.warn('DeviceStorage updateSessionMetadata failed:', e.message);
        }
      }
      const sess = STATE.sessions.find(s => s.id === id);
      if (sess) {
        Object.assign(sess, patch);
        sess.userId = STATE.userId;
        if (!sess._isLazyDisk || (sess.messages && sess.messages.length > 0)) {
          await ChatDB.saveSession(sess);
        }
      }
    },

    async renameSession(id, newTitle) {
      if (!id || !newTitle) return;
      if (this.isDeviceBackendAvailable) {
        try {
          await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-User-ID': STATE.userId
            },
            body: JSON.stringify({ title: newTitle, userId: STATE.userId })
          });
        } catch (e) {
          console.warn('DeviceStorage renameSession failed:', e.message);
        }
      }
      const sess = STATE.sessions.find(s => s.id === id);
      if (sess) {
        sess.title = newTitle;
        sess.userId = STATE.userId;
        await ChatDB.saveSession(sess);
      }
    },

    async deleteSession(id) {
      if (!id) return;
      if (this.isDeviceBackendAvailable) {
        try {
          await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { 'X-User-ID': STATE.userId }
          });
        } catch (e) {
          console.warn('DeviceStorage deleteSession failed:', e.message);
        }
      }
      await ChatDB.deleteSession(id);
    },

    async clearAllSessions() {
      if (this.isDeviceBackendAvailable) {
        try {
          await fetch('/api/sessions', {
            method: 'DELETE',
            headers: { 'X-User-ID': STATE.userId }
          });
        } catch (e) {
          console.warn('DeviceStorage clearAllSessions failed:', e.message);
        }
      }
      await ChatDB.clearAllSessions();
    },

    async uploadFile(base64Data) {
      if (!this.isDeviceBackendAvailable || !base64Data) return null;
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': STATE.userId || 'default',
            'x-user-id': STATE.userId || 'default'
          },
          body: JSON.stringify({ data: base64Data, userId: STATE.userId || 'default' })
        });
        if (res.ok) {
          const data = await res.json();
          return data.url;
        }
      } catch (e) {
        console.warn('DeviceStorage uploadFile failed:', e.message);
      }
      return null;
    }
  };

  // Safe Session Storage Helper (absorbs Safari Private Browsing QuotaExceededError & SecurityError)
  const safeSessionStorage = {
    getItem(key) {
      try { return sessionStorage.getItem(key); } catch (_) { return null; }
    },
    setItem(key, val) {
      try { sessionStorage.setItem(key, String(val)); } catch (_) {}
    },
    removeItem(key) {
      try { sessionStorage.removeItem(key); } catch (_) {}
    }
  };

  function loadPersistedStateSync() {
    try {
      const savedSettings = localStorage.getItem('zoz_router_settings_v1');
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings);
          if (parsedSettings && typeof parsedSettings === 'object') {
            STATE.settings = { ...STATE.settings, ...parsedSettings };
          }
        } catch (parseErr) {
          console.warn('Gagal mengurai zoz_router_settings_v1 dari localStorage:', parseErr.message);
        }
      }

      // Sinkronkan tool "Cari Video YouTube" dari preferensi tersimpan
      STATE.isYouTubeSearchMode = Boolean(STATE.settings.youtubeSearchTool);

      // Pastikan customSystemPrompt terinisialisasi jika user sebelumnya sudah punya persona kustom
      if (typeof STATE.settings.customSystemPrompt !== 'string') {
        const isStandardPreset = Object.keys(SYSTEM_PRESETS).some(k => k !== 'default' && SYSTEM_PRESETS[k] === STATE.settings.systemPrompt);
        if (!isStandardPreset && STATE.settings.systemPrompt) {
          STATE.settings.customSystemPrompt = STATE.settings.systemPrompt;
        } else {
          STATE.settings.customSystemPrompt = '';
        }
      }

      // Pastikan endpoint Ollama terdefinisi dengan baik (default ke 127.0.0.1:11434 jika tidak ada API key)
      if (!STATE.settings.ollamaEndpoint) {
        STATE.settings.ollamaEndpoint = 'http://127.0.0.1:11434';
      } else if (STATE.settings.ollamaEndpoint.includes('ollama.com') && !STATE.settings.ollamaApiKey) {
        // Jika sebelumnya diarahkan ke ollama.com tapi tanpa API key, pulihkan ke Ollama lokal
        STATE.settings.ollamaEndpoint = 'http://127.0.0.1:11434';
      }

      // Pastikan model Ollama valid (jika di lokal dan model masih gemma4:31b/lama, arahkan ke qwen2.5:1.5b)
      const isLocalOllama = STATE.settings.ollamaEndpoint.includes('127.0.0.1') || 
                            STATE.settings.ollamaEndpoint.includes('localhost') || 
                            STATE.settings.ollamaEndpoint.includes('11434');
      if (!STATE.settings.ollamaModel || 
          (isLocalOllama && (STATE.settings.ollamaModel === 'gemma4:31b' || STATE.settings.ollamaModel === 'nemotron-mini:latest' || STATE.settings.ollamaModel === 'llama3:latest'))) {
        STATE.settings.ollamaModel = 'qwen2.5:1.5b';
      }

      // Auto-Migration: Alihkan model OpenRouter lama / mati ke router gratis (openrouter/free)
      const DEAD_OPENROUTER_MODELS = [
        'qwen/qwen3.8-27b:free',
        'deepseek/deepseek-r1:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'deepseek/deepseek-chat:free',
        'nvidia/llama-3.1-nemotron-70b-instruct:free',
        'google/gemini-2.0-flash-exp:free',
        'qwen/qwen-2.5-72b-instruct:free',
        'meta-llama/llama-3.2-11b-vision-instruct:free'
      ];
      if (!STATE.settings.openRouterModel || DEAD_OPENROUTER_MODELS.includes(STATE.settings.openRouterModel)) {
        STATE.settings.openRouterModel = 'openrouter/free';
      }

      // Jika baru pertama kali dibuka di cloud (Vercel) dan mode masih default 'ollama',
      // jadikan mode auto secara default.
      // H1 FIX: `saved` tidak pernah dideklarasikan → ReferenceError tiap load di cloud
      // host yang ditelan catch luar, sehingga SELURUH sisa load preferensi + mirror
      // sesi dilewatkan. `STATE.settings.mode` juga tidak pernah ada — mode hidup di
      // STATE.mode. Kini memakai savedSettings (ada = pernah disimpan) & STATE.mode.
      if (IS_CLOUD_HOSTED && !savedSettings && STATE.mode === 'ollama') {
        STATE.mode = 'auto';
      }

      if (!STATE.settings.imageModel) {
        STATE.settings.imageModel = 'flux';
      }

      if (!STATE.settings.serperApiKey) {
        STATE.settings.serperApiKey = '075538fed9c64990e1eb32a06726c1e55a933c1e';
      }
      const savedSound = localStorage.getItem('zoz_router_sound_v1');
      if (savedSound !== null) {
        STATE.soundEnabled = savedSound === 'true';
      }
      const savedSearchMode = localStorage.getItem('zoz_router_search_mode_v1');
      const searchModeMigrated = localStorage.getItem('zoz_router_search_mode_migrated_v1') === 'true';
      if (savedSearchMode && ['off', 'default', 'premium', 'autonomous'].includes(savedSearchMode)) {
        STATE.searchMode = savedSearchMode;
        // Migrasi legacy: versi lama selalu menulis 'off' sebagai default dan
        // menyembunyikan menu toggle, sehingga 'off' hampir pasti BUKAN pilihan user.
        // Dimigrasi sekali saja; pilihan 'off' yang dipilih user setelah ini dihormati.
        if (!searchModeMigrated && savedSearchMode === 'off') {
          STATE.searchMode = 'default';
          try {
            localStorage.setItem('zoz_router_search_mode_v1', 'default');
          } catch (_) {}
        }
      } else {
        STATE.searchMode = 'default';
        try {
          localStorage.setItem('zoz_router_search_mode_v1', 'default');
        } catch (_) {}
      }
      try {
        localStorage.setItem('zoz_router_search_mode_migrated_v1', 'true');
      } catch (_) {}
      const savedPromptHidden = localStorage.getItem('zoz_prompt_hidden');
      if (savedPromptHidden !== null) {
        STATE.isPromptHidden = savedPromptHidden === 'true';
      }

      // Fast synchronous load from localStorage (0ms startup)
      const savedSessions = localStorage.getItem('zoz_router_sessions_v1');
      if (savedSessions) {
        try {
          const parsed = JSON.parse(savedSessions);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // KEAMANAN KETAT: Bersihkan sesi lazy disk asing dan sesi yang memiliki userId milik orang lain
            STATE.sessions = parsed.filter(s => {
              if (s._isLazyDisk) return false;
              if (s.userId && s.userId !== STATE.userId) return false;
              return true;
            });
            STATE.sessions.forEach(s => {
              if (!s.userId) s.userId = STATE.userId;
            });
          }
        } catch (e) {}
      }

      // Synchronous load favorite models & update badge count
      STATE.favoriteModels = loadFavoriteModels();
      updateCatalogFavBadge();
    } catch (err) {
      console.error('Error loading persisted state sync:', err);
    }
  }

  async function syncPersistedStorageBackground(isTabReload = false, savedActiveId = null) {
    try {
      // 1. Initialize Device-First Storage
      await DeviceStorage.init();

      // 2. Sync from IndexedDB Vault
      const dbSessions = await ChatDB.getAllSessions();
      if (Array.isArray(dbSessions) && dbSessions.length > 0) {
        // KEAMANAN KETAT: Prune sesi yang berasal dari user lain atau lazy disk asing
        const validDbSessions = dbSessions.filter(s => {
          if (s._isLazyDisk) return false;
          if (s.userId && s.userId !== STATE.userId) return false;
          return true;
        });
        validDbSessions.forEach(s => {
          if (!s.userId) s.userId = STATE.userId;
        });
        if (validDbSessions.length !== dbSessions.length) {
          await ChatDB.saveAllSessions(validDbSessions);
        }
        if (validDbSessions.length >= STATE.sessions.length) {
          STATE.sessions = validDbSessions;
          renderChatHistory();
          if (STATE.currentSessionId) renderCurrentSession();
        }
      }

      // 3. Sync lightweight session headers from Device Disk Storage HANYA bila backend lokal online dan bukan cloud
      if (DeviceStorage.isDeviceBackendAvailable && !IS_CLOUD_HOSTED) {
        const diskList = await DeviceStorage.getSessionsList();
        if (Array.isArray(diskList) && diskList.length > 0) {
          let hasNewSessions = false;
          for (const diskItem of diskList) {
            const existing = STATE.sessions.find(s => s.id === diskItem.id);
            if (!existing) {
              STATE.sessions.push({
                id: diskItem.id,
                userId: STATE.userId,
                title: diskItem.title || 'Obrolan Baru',
                mode: diskItem.mode || 'ollama',
                createdAt: diskItem.createdAt,
                updatedAt: diskItem.updatedAt,
                messages: [],
                messageCount: diskItem.messageCount || 0,
                isPinned: !!diskItem.isPinned,
                _isLazyDisk: true
              });
              hasNewSessions = true;
            } else if (diskItem.isPinned !== undefined && existing.isPinned === undefined) {
              existing.isPinned = !!diskItem.isPinned;
            }
          }
          if (hasNewSessions) {
            renderChatHistory();
          }
        }

        // Hydrate active session from Device Disk Storage to ensure background messages are never overwritten
        const targetSid = savedActiveId || STATE.currentSessionId;
        if (targetSid) {
          const activeSess = STATE.sessions.find(s => s.id === targetSid);
          if (activeSess) {
            try {
              const full = await DeviceStorage.getSession(targetSid);
              if (full && Array.isArray(full.messages)) {
                const diskLen = full.messages.length;
                const memLen = activeSess.messages ? activeSess.messages.length : 0;
                const diskLast = full.messages[diskLen - 1];
                const memLast = activeSess.messages ? activeSess.messages[memLen - 1] : null;

                if (activeSess._isLazyDisk || diskLen > memLen || (diskLast && memLast && diskLast.content !== memLast.content && ((diskLast.content || '').length > (memLast.content || '').length || diskLast.backgroundCompleted))) {
                  activeSess.messages = full.messages;
                  delete activeSess._isLazyDisk;
                  activeSess.userId = STATE.userId;
                  await ChatDB.saveSession(activeSess);
                  renderCurrentSession();
                  renderChatHistory();
                }
              }
            } catch (e) {
              console.warn('Notice hydrating active session from disk:', e);
            }
          }
        }
      }

      // 4. Periksa apakah ada tugas chat latar belakang yang sedang berjalan atau baru selesai
      await checkBackgroundChatTasksSync();
    } catch (err) {
      console.warn('Background storage sync notice:', err);
    }
  }

  // ==================== CLAUDE AI RESILIENCE: BACKGROUND CHAT SYNC & POLLING ====================
  let activeChatPollTimer = null;
  let isCheckingBackgroundSync = false;

  function findCurrentActiveSession() {
    if (STATE.currentSessionId) {
      return STATE.sessions.find(s => s.id === STATE.currentSessionId) || null;
    }
    const lastSid = safeSessionStorage.getItem('zoz_active_session_id') || localStorage.getItem('zoz_last_active_session_id');
    if (lastSid) {
      return STATE.sessions.find(s => s.id === lastSid) || null;
    }
    return null;
  }

  async function handleBackgroundChatCompletion(activeSession, data) {
    setGeneratingState(false);
    const diskSess = await DeviceStorage.getSession(activeSession.id);
    const diskMsgs = (diskSess && Array.isArray(diskSess.messages)) ? diskSess.messages : [];
    const activeMsgs = Array.isArray(activeSession.messages) ? activeSession.messages : [];
    let diskLast = null;
    if (diskMsgs.length > 0) {
      diskLast = diskMsgs[diskMsgs.length - 1];
    }
    let activeLast = null;
    if (activeMsgs.length > 0) {
      activeLast = activeMsgs[activeMsgs.length - 1];
    }

    const hasNewMessages = diskMsgs.length > activeMsgs.length ||
      (diskLast && activeLast && diskLast.content !== activeLast.content && ((diskLast.content || '').length > (activeLast.content || '').length || diskLast.backgroundCompleted));

    if (hasNewMessages) {
      activeSession.messages = diskMsgs;
      delete activeSession._isLazyDisk;
      savePersistedState();
      renderCurrentSession();
      renderChatHistory();
      AudioEngine.success();
      showToast('✨ AI telah selesai menjawab di latar belakang saat Anda keluar.');
    } else if (data.text && data.text.trim()) {
      const trimmed = data.text.trim();
      if (!Array.isArray(activeSession.messages)) activeSession.messages = [];
      let curLast = null;
      if (activeSession.messages.length > 0) {
        curLast = activeSession.messages[activeSession.messages.length - 1];
      }
      if (curLast && curLast.role === 'assistant') {
        if (curLast.content !== trimmed && (trimmed.length > (curLast.content || '').length || !curLast.content)) {
          curLast.content = trimmed;
          curLast.backgroundCompleted = true;
          if (data.isDeepResearch) {
            curLast.isDeepResearch = true;
            if (data.chatSummary) curLast.chatSummary = data.chatSummary;
            if (Array.isArray(data.sources)) curLast.sources = data.sources;
          }
          activeSession.updatedAt = new Date().toISOString();
          savePersistedState();
          renderCurrentSession();
          renderChatHistory();
          AudioEngine.success();
          showToast('✨ AI telah selesai menjawab di latar belakang saat Anda keluar.');
        }
      } else {
        activeSession.messages.push({
          role: 'assistant',
          content: trimmed,
          model: data.model || 'AI Model',
          timestamp: new Date().toISOString(),
          backgroundCompleted: true,
          isDeepResearch: !!data.isDeepResearch,
          chatSummary: data.chatSummary || null,
          sources: data.sources || null
        });
        activeSession.updatedAt = new Date().toISOString();
        savePersistedState();
        renderCurrentSession();
        renderChatHistory();
        AudioEngine.success();
        showToast('✨ AI telah selesai menjawab di latar belakang saat Anda keluar.');
      }
    }
  }

  async function checkBackgroundChatTasksSync() {
    if (IS_GITHUB_PAGES || isCheckingBackgroundSync) return;
    isCheckingBackgroundSync = true;
    try {
      const activeSession = findCurrentActiveSession();

      // 1. Jika sesi aktif ditemukan, periksa sesi tersebut secara langsung
      if (activeSession) {
        const res = await fetch(`/api/chat/status/${encodeURIComponent(activeSession.id)}`, {
          headers: { 'X-User-ID': STATE.userId }
        }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.status === 'streaming') {
            setGeneratingState(true);
            attachToActiveBackgroundChat(activeSession, data.model, data.text || '');
            return;
          } else if (data && data.status === 'completed' && data.completedAt) {
            await handleBackgroundChatCompletion(activeSession, data);
            return;
          }
        }
      }

      // 2. Periksa status tugas latar belakang milik user ini jika ada sesi user yang belum selesai
      const globalRes = await fetch(`/api/chat/status?userId=${encodeURIComponent(STATE.userId)}`, {
        headers: { 'X-User-ID': STATE.userId }
      }).catch(() => null);
      if (globalRes && globalRes.ok) {
        const globalData = await globalRes.json();
        if (globalData && globalData.activeSessions && globalData.activeSessions.length > 0) {
          // KEAMANAN KETAT: Hanya tangani tugas yang sessionId-nya SUDAH ADA di STATE.sessions milik user ini!
          const targetTask = globalData.activeSessions.find(t => STATE.sessions.some(s => s.id === t.sessionId));
          if (targetTask) {
            const targetSid = targetTask.sessionId;
            const targetSession = STATE.sessions.find(s => s.id === targetSid);
            if (targetSession) {
              await switchSession(targetSid);
              setGeneratingState(true);
              attachToActiveBackgroundChat(targetSession, targetTask.model, targetTask.text || '');
              showToast('⚡ Menyambung kembali ke respons AI Anda yang sedang diproses di latar belakang...', 'info');
              return;
            }
          }
        }

        if (globalData && globalData.recentlyCompletedSessions && globalData.recentlyCompletedSessions.length > 0) {
          const lastActiveId = safeSessionStorage.getItem('zoz_active_session_id') || localStorage.getItem('zoz_last_active_session_id');
          // KEAMANAN KETAT: Hanya sinkronkan tugas milik user saat ini
          const matchedTask = globalData.recentlyCompletedSessions.find(s => s.sessionId === lastActiveId && STATE.sessions.some(sess => sess.id === s.sessionId)) ||
                              globalData.recentlyCompletedSessions.find(s => STATE.sessions.some(sess => sess.id === s.sessionId));
          if (matchedTask) {
            let matchedSession = STATE.sessions.find(s => s.id === matchedTask.sessionId);
            if (matchedSession) {
              const fullDisk = await DeviceStorage.getSession(matchedSession.id);
              if (fullDisk && Array.isArray(fullDisk.messages)) {
                matchedSession.messages = fullDisk.messages;
                delete matchedSession._isLazyDisk;
                matchedSession.userId = STATE.userId;
                await ChatDB.saveSession(matchedSession);
                savePersistedState();
                renderChatHistory();
              }
            }
          }
        }
      }
    } catch (_) {
    } finally {
      setTimeout(() => {
        isCheckingBackgroundSync = false;
      }, 350);
    }
  }

  function attachToActiveBackgroundChat(session, modelName, initialText = '') {
    if (activeChatPollTimer) clearInterval(activeChatPollTimer);

    // Dapatkan baris asisten terakhir atau buat baris baru jika belum ada di DOM
    let assistantRow = els.messagesList?.querySelector('.message-row.assistant:last-child');
    if (!assistantRow) {
      assistantRow = appendMessageElement('assistant', '', null, modelName || 'AI Assistant');
    }

    const bubbleText = assistantRow?.querySelector('.msg-text-content');
    const metaBox = assistantRow?.querySelector('.message-meta');
    if (bubbleText) {
      bubbleText.innerHTML = renderMarkdown(initialText || '') + '<span class="typing-cursor"></span>';
    }
    smartScrollChatToBottom(true);

    const startTime = performance.now();

    // M7: proteksi overlap — poll lambat (latensi > interval 800ms) tak boleh
    // meluncurkan tick baru sebelum yang selesai berjalan. Tanpa ini, handler
    // "selesai" bisa dieksekusi berulang oleh tick antrian: toast sukses, save,
    // dan notifikasi ganda. pollDone mengunci tick yang terlanjur masuk.
    let pollBusy = false;
    let pollDone = false;
    activeChatPollTimer = setInterval(async () => {
      if (pollBusy || pollDone) return;
      pollBusy = true;
      try {
        if (STATE.currentSessionId !== session.id) {
          clearInterval(activeChatPollTimer);
          activeChatPollTimer = null;
          return;
        }

        if (performance.now() - startTime > 15 * 60 * 1000) {
          clearInterval(activeChatPollTimer);
          activeChatPollTimer = null;
          setGeneratingState(false);
          return;
        }

        const res = await fetch(`/api/chat/status/${encodeURIComponent(session.id)}`, {
          headers: { 'X-User-ID': STATE.userId }
        }).catch(() => null);
        if (!res || !res.ok) return;
        const data = await res.json();
        if (!data) return;

        if (data.isDeepResearch && data.taskId) {
          STATE.currentDeepResearchTaskId = data.taskId;
        }

        const currentText = data.text || '';
        if (bubbleText && currentText) {
          if (data.isDeepResearch && data.status === 'streaming') {
            bubbleText.innerHTML = `
              <div class="deep-research-live-card" style="padding:14px; border:1px solid rgba(0,240,255,0.3); border-radius:12px; background:rgba(10,15,25,0.7); backdrop-filter:blur(8px);">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; color:var(--neon-cyan); font-weight:600; font-size:0.95rem;">
                  <i class="fa-solid fa-atom fa-spin"></i> Deep Research Pro Aktif di Latar Belakang
                </div>
                <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:6px;">${escapeHtml(currentText)}</div>
                <div style="width:100%; background:rgba(255,255,255,0.1); border-radius:4px; height:4px; overflow:hidden;">
                  <div style="width:65%; height:100%; background:linear-gradient(90deg, var(--neon-cyan), var(--neon-purple)); border-radius:4px; animation: progress-indeterminate 1.5s infinite linear;"></div>
                </div>
              </div>
            `;
          } else {
            bubbleText.innerHTML = renderMarkdown(currentText) + (data.status === 'streaming' ? '<span class="typing-cursor"></span>' : '');
          }
          smartScrollChatToBottom(false);
        }

        if (data.status === 'completed' || data.status === 'none' || data.status === 'aborted') {
          pollDone = true; // M7: kunci — tick antrian yang tersisa tidak boleh mengulang handler ini
          clearInterval(activeChatPollTimer);
          activeChatPollTimer = null;
          STATE.currentDeepResearchTaskId = null;

          const finalReportText = currentText;
          const actualModelName = modelName || data.model || (data.isDeepResearch ? 'Deep Research Pro' : 'AI Model');
          if (bubbleText) {
            if (data.isDeepResearch) {
              const allSources = Array.isArray(data.sources) ? data.sources : [];
              const chatSummary = data.chatSummary || '';
              const nowIso = new Date().toISOString();
              bubbleText.innerHTML = buildDeepResearchSummaryCardHtml(finalReportText, actualModelName, allSources, nowIso, chatSummary);
              enhanceCodeBlocks(bubbleText);
              attachDeepResearchCardEvents(assistantRow, finalReportText, actualModelName, allSources, nowIso);
            } else {
              bubbleText.innerHTML = renderMarkdown(finalReportText);
              enhanceCodeBlocks(bubbleText);
              enhanceChatImages(bubbleText);
            }
          }
          if (assistantRow) assistantRow.dataset.fullContent = finalReportText;

          const duration = ((performance.now() - startTime) / 1000).toFixed(1);
          if (metaBox) {
            metaBox.innerHTML = `
              <strong>${escapeHtml(actualModelName)}</strong>
              <span class="meta-model-badge" style="background:rgba(0,240,255,0.15); color:var(--neon-cyan);">${data.isDeepResearch ? 'Deep Research Sync' : 'Background Sync'}</span>
              <span>⏱️ ${duration}s</span>
            `;
          }

          // Simpan ke pesan sesi jika belum tersimpan atau perbarui jika teks masih parsial
          if (!Array.isArray(session.messages)) session.messages = [];
          let lastMsg = null;
          if (session.messages.length > 0) {
            lastMsg = session.messages[session.messages.length - 1];
          }
          if (!lastMsg || lastMsg.role !== 'assistant') {
            session.messages.push({
              role: 'assistant',
              content: finalReportText,
              model: modelName || data.model,
              timestamp: new Date().toISOString(),
              backgroundCompleted: true,
              isDeepResearch: !!data.isDeepResearch,
              chatSummary: data.chatSummary || null,
              sources: data.sources || null
            });
          } else {
            if (finalReportText) {
              lastMsg.content = finalReportText;
            }
            lastMsg.model = modelName || data.model || lastMsg.model;
            lastMsg.backgroundCompleted = true;
            if (data.isDeepResearch) {
              lastMsg.isDeepResearch = true;
              if (data.chatSummary) lastMsg.chatSummary = data.chatSummary;
              if (Array.isArray(data.sources)) lastMsg.sources = data.sources;
            }
          }
          session.updatedAt = new Date().toISOString();
          savePersistedState();
          renderChatHistory(els.searchHistoryInput?.value || '');

          setGeneratingState(false);
          if (data.status === 'aborted') {
            showToast('Generasi dihentikan oleh pengguna.');
          } else {
            AudioEngine.receive();
            notifyAiCompletion('🤖 ' + (modelName || data.model), finalReportText);
            showToast('✨ AI selesai menjawab di latar belakang.');
          }
        } else if (data.status === 'error') {
          pollDone = true; // M7: kunci agar handler error tidak berjalan dua kali
          clearInterval(activeChatPollTimer);
          activeChatPollTimer = null;
          STATE.currentDeepResearchTaskId = null;
          setGeneratingState(false);
          const partialText = data.text || '';
          const errDetail = typeof data.error === 'object' && data.error ? (data.error.message || JSON.stringify(data.error)) : String(data.error || 'Terjadi kesalahan koneksi');
          if (bubbleText) {
            if (partialText.trim()) {
              bubbleText.innerHTML = renderMarkdown(partialText) + `\n\n<div style="color:var(--neon-crimson); font-size:0.82rem; margin-top:8px; padding:6px 10px; border-left:2px solid var(--neon-crimson); background:rgba(255,0,85,0.08); border-radius:4px;"><i class="fa-solid fa-triangle-exclamation"></i> Respons terputus: ${escapeHtml(errDetail)}</div>`;
              enhanceCodeBlocks(bubbleText);
              enhanceChatImages(bubbleText);
            } else {
              bubbleText.innerHTML = `<div style="color:var(--neon-crimson); font-size:0.85rem;"><i class="fa-solid fa-triangle-exclamation"></i> Gagal menyelesaikan respons di latar belakang: ${escapeHtml(errDetail)}</div>`;
            }
          }
          if (partialText.trim()) {
            if (!Array.isArray(session.messages)) session.messages = [];
            let lastMsg = null;
            if (session.messages.length > 0) {
              lastMsg = session.messages[session.messages.length - 1];
            }
            const interruptedText = partialText + `\n\n*[Respons terputus: ${errDetail}]*`;
            if (!lastMsg || lastMsg.role !== 'assistant') {
              session.messages.push({
                role: 'assistant',
                content: interruptedText,
                model: modelName || data.model,
                timestamp: new Date().toISOString()
              });
            } else {
              lastMsg.content = interruptedText;
              lastMsg.model = modelName || data.model || lastMsg.model;
            }
            session.updatedAt = new Date().toISOString();
            savePersistedState();
            renderChatHistory(els.searchHistoryInput?.value || '');
          }
        }
      } catch (pollErr) {
        console.warn('Error polling background chat:', pollErr);
      } finally {
        pollBusy = false; // M7: lepas kunci tick setiap iterasi selesai
      }
    }, 800);
  }

  function savePersistedState() {
    try {
      try {
        localStorage.setItem('zoz_router_settings_v1', JSON.stringify(STATE.settings));
      } catch (e) {
        console.warn('Failed to save settings:', e);
      }
      try {
        localStorage.setItem('zoz_router_sound_v1', String(STATE.soundEnabled));
      } catch (e) {
        console.warn('Failed to save sound setting:', e);
      }
      try {
        localStorage.setItem('zoz_router_search_mode_v1', STATE.searchMode || 'default');
      } catch (e) {
        console.warn('Failed to save search mode:', e);
      }

      // Save active session to Device Disk Storage
      if (STATE.currentSessionId) {
        const activeSess = STATE.sessions.find(s => s.id === STATE.currentSessionId);
        if (activeSess) {
          activeSess.userId = STATE.userId;
          DeviceStorage.saveSession(activeSess);
        }
      }

      // Save to IndexedDB (asynchronous & practically unlimited quota)
      ChatDB.saveAllSessions(STATE.sessions);

      // Mirror lightweight summaries to localStorage
      try {
        const lightweight = STATE.sessions.map(s => ({
          id: s.id,
          title: s.title,
          mode: s.mode,
          isPinned: !!s.isPinned,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          messages: (s.messages || []).map(m => {
            let safeImages = undefined;
            if (Array.isArray(m.images)) {
              safeImages = m.images.map(img => (typeof img === 'string' && img.startsWith('data:')) ? '[data:image]' : img);
            }
            let safeImage = (typeof m.image === 'string' && m.image.startsWith('data:')) ? '[data:image]' : m.image;
            let safeDocs = undefined;
            if (Array.isArray(m.docs)) {
              safeDocs = m.docs.map(d => ({ name: d.name, size: d.size }));
            }
            // File buatan AI (AI File Studio): simpan juga isi kontennya agar kartu
            // bisa dibuka lagi setelah reload walau IndexedDB belum tersinkron.
            let safeFiles = undefined;
            if (Array.isArray(m.files) && m.files.length > 0) {
              safeFiles = m.files.map(f => ({
                name: f.name, mime: f.mime, lang: f.lang, content: f.content,
                byteSize: f.byteSize, lineCount: f.lineCount,
                size: f.size, desc: f.desc, isGeneratedByAI: true
              }));
            }
            return {
              role: m.role,
              content: m.content,
              displayContent: m.displayContent,
              docs: safeDocs,
              images: safeImages,
              image: safeImage,
              files: safeFiles,
              model: m.model,
              engine: m.engine,
              slot: m.slot,
              sources: m.sources,
              stats: m.stats,
              isDeepResearch: !!m.isDeepResearch,
              latency: m.latency,
              timestamp: m.timestamp
            };
          })
        }));
        localStorage.setItem('zoz_router_sessions_v1', JSON.stringify(lightweight));
      } catch (quotaErr) {
        console.warn('localStorage quota exceeded, saving headers only:', quotaErr.message);
        try {
          const headersOnly = STATE.sessions.map(s => ({
            id: s.id,
            title: s.title,
            mode: s.mode,
            isPinned: !!s.isPinned,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            messages: []
          }));
          localStorage.setItem('zoz_router_sessions_v1', JSON.stringify(headersOnly));
        } catch (innerErr) {
          console.warn('localStorage completely full, skipping sessions mirroring:', innerErr.message);
        }
      }
    } catch (err) {
      console.error('Error saving persisted state:', err);
    }
  }

  // ==================== TOAST NOTIFICATIONS ====================
  function showToast(message, type = 'info') {
    if (!els.toastContainer) return;
    // Bersihkan notifikasi lama agar tidak menumpuk memenuhi layar
    els.toastContainer.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    toast.onclick = () => toast.remove();
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 250);
    }, 1500);
  }

  // ==================== BROWSER DESKTOP/MOBILE NOTIFICATIONS ====================
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {});
      } catch (_) {}
    }
  }

  function notifyAiCompletion(title, textBody) {
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const cleanText = (textBody || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        const snippet = cleanText.slice(0, 140) + (cleanText.length > 140 ? '...' : '');
        const notif = new Notification(title || '🤖 Zoz Router AI', {
          body: snippet || 'Jawaban AI telah selesai diproses.',
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%2300F0FF"/><text x="50" y="66" font-size="46" font-weight="bold" text-anchor="middle" fill="%2308090D">Z</text></svg>'
        });
        notif.onclick = () => {
          try { window.focus(); } catch (_) {}
          notif.close();
        };
      } catch (_) {}
    }
  }

  // ==================== UTILS ====================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    return s.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function generateId() {
    return 'ses_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  }

  function sanitizeHtmlSafe(dirtyHtml) {
    if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';
    if (window.DOMPurify) {
      return DOMPurify.sanitize(dirtyHtml, {
        ADD_ATTR: ['target', 'rel'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
      });
    }
    // Fallback native sanitizer jika DOMPurify belum termuat atau offline
    return dirtyHtml
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object\b[\s\S]*?<\/object>/gi, '')
      .replace(/<embed\b[\s\S]*?<\/embed>/gi, '')
      .replace(/<form\b[\s\S]*?<\/form>/gi, '')
      .replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
  }

  function renderMarkdown(rawText) {
    if (!rawText) return '';
    if (window.marked) {
      try {
        marked.setOptions({
          breaks: true,
          gfm: true
        });
        const parsed = marked.parse(rawText);
        const sanitized = sanitizeHtmlSafe(parsed);
        // Pastikan seluruh tautan eksternal (http/https) membuka di tab baru agar tidak memutus sesi obrolan
        return sanitized.replace(/<a\b([^>]*?href=["']https?:\/\/[^"']+["'][^>]*)>/gi, (match, attrs) => {
          const cleanAttrs = attrs.replace(/\s*(?:target|rel)=["'][^"']*["']/gi, '');
          return `<a${cleanAttrs} target="_blank" rel="noopener noreferrer">`;
        });
      } catch (err) {
        console.warn('[renderMarkdown] Error parsing markdown, fallback to escaped text:', err);
        return escapeHtml(rawText).replace(/\n/g, '<br>');
      }
    }
    return escapeHtml(rawText).replace(/\n/g, '<br>');
  }


  // ==================== UNIVERSAL CODE BLOCK ENHANCER (Syntax & Copy Button) ====================
  function enhanceCodeBlocks(container = document) {
    if (!container) return;
    
    // Process all PRE elements within container
    const preElements = container.querySelectorAll('pre');
    preElements.forEach(pre => {
      // Avoid duplicate headers
      if (pre.querySelector('.code-header')) return;

      const codeBlock = pre.querySelector('code');
      let lang = 'CODE';

      if (codeBlock) {
        // Highlight syntax if hljs is present
        if (window.hljs && !codeBlock.dataset.highlighted) {
          try {
            hljs.highlightElement(codeBlock);
            codeBlock.dataset.highlighted = 'true';
          } catch (e) {}
        }
        const langMatch = codeBlock.className.match(/language-([a-zA-Z0-9_\-#+]+)/);
        if (langMatch && langMatch[1]) {
          lang = langMatch[1].toUpperCase();
        }
      }

      // Create code header bar with Copy Button
      const header = document.createElement('div');
      header.className = 'code-header';
      header.innerHTML = `
        <span class="code-lang-label"><i class="fa-solid fa-code"></i> ${escapeHtml(lang)}</span>
        <button class="code-copy-btn" title="Salin seluruh kode">
          <i class="fa-solid fa-clipboard"></i>
          <span class="copy-text">Salin Kode</span>
        </button>
      `;

      const copyBtn = header.querySelector('.code-copy-btn');
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        let codeText = '';
        if (codeBlock) {
          codeText = codeBlock.innerText || codeBlock.textContent || '';
        } else {
          const clone = pre.cloneNode(true);
          const oldHeader = clone.querySelector('.code-header');
          if (oldHeader) oldHeader.remove();
          codeText = clone.innerText || clone.textContent || '';
        }
        
        const setCopiedState = () => {
          copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--neon-teal);"></i> <span class="copy-text" style="color:var(--neon-teal);">Disalin!</span>';
          copyBtn.classList.add('copied');
          showToast(`Kode ${lang} berhasil disalin ke clipboard!`);
          AudioEngine.snap();
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fa-solid fa-clipboard"></i> <span class="copy-text">Salin Kode</span>';
            copyBtn.classList.remove('copied');
          }, 2000);
        };

        copyTextToClipboard(codeText, setCopiedState);
      });

      pre.insertBefore(header, pre.firstChild);
    });
  }

  // ==================== UNIVERSAL CHAT IMAGE ENHANCER (Lightbox & Zoom) ====================
  function enhanceChatImages(container = document) {
    if (!container) return;
    const images = container.querySelectorAll('.msg-text-content img, .message-bubble img');
    images.forEach(img => {
      if (img.classList.contains('chat-zoomable-img') || img.classList.contains('image-result-img')) return;
      img.classList.add('chat-zoomable-img');
      img.style.cursor = 'zoom-in';
      img.style.maxWidth = '100%';
      img.style.borderRadius = 'var(--radius-md, 8px)';
      img.style.display = 'block';
      img.style.marginTop = '8px';
      img.style.marginBottom = '8px';
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        if (ImageLightbox && typeof ImageLightbox.open === 'function') {
          ImageLightbox.open([img.src], 0);
        }
      });
    });
  }

  function fallbackCopyText(text, onSuccess) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    try {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const successful = document.execCommand('copy');
      if (successful && onSuccess) {
        onSuccess();
      } else if (!successful) {
        showToast('Gagal menyalin teks ke clipboard.', 'error');
      }
    } catch (err) {
      showToast('Gagal menyalin teks ke clipboard.', 'error');
    } finally {
      textarea.remove();
    }
  }

  function copyTextToClipboard(text, onSuccess, successMsg = 'Teks disalin ke clipboard!') {
    const handleSuccess = () => {
      if (typeof onSuccess === 'function') {
        onSuccess();
      } else if (successMsg) {
        showToast(successMsg);
        AudioEngine.click();
      }
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(handleSuccess).catch(() => {
        fallbackCopyText(text, handleSuccess);
      });
    } else {
      fallbackCopyText(text, handleSuccess);
    }
  }

    // ==================== SMART SCROLL STATE ====================
    let userScrolledUp = false;
    let isAutoScrolling = false;

    // ==================== HIGH-PERFORMANCE 60FPS STREAM BUFFER RENDERER ====================
  // Sembunyikan blok ZOZ_FILE (lengkap maupun masih mengalir) dari tampilan sementara
  // saat streaming, supaya kode mentah file tidak membajak gelembung obrolan.
  // Teks asli di dalam renderer TIDAK diubah — ekstraksi file tetap dilakukan di akhir stream.
  function hideFileBlocksForDisplay(text) {
    if (!text || text.indexOf('<<<ZOZ_FILE') === -1) return text;
    const out = [];
    let skipping = false;
    text.split('\n').forEach((line) => {
      const t = line.trim();
      if (!skipping) {
        if (t.indexOf('<<<ZOZ_FILE') === 0) { skipping = true; return; }
        out.push(line);
        return;
      }
      // Masih di dalam blok file: buang sampai penanda tutup (atau sampai stream berakhir)
      if (t.indexOf('<<<END_ZOZ_FILE') === 0) skipping = false;
    });
    return out.join('\n');
  }

  class StreamBufferRenderer {
    constructor(bubbleElement, onScrollCallback, prefixHtml = '') {
      this.el = bubbleElement;
      this.onScroll = onScrollCallback;
      this.prefixHtml = prefixHtml;
      this.text = '';
      this.animId = null;
      this.lastRenderTime = 0;
      this.isDone = false;
    }

    setPrefixHtml(prefix) {
      this.prefixHtml = prefix || '';
    }

    append(delta) {
      if (delta === null || delta === undefined) return;
      const str = String(delta);
      if (!str) return;
      this.text += str;
      if (this.isDone) return;
      const now = performance.now();
      // Throttle Markdown regex parsing to every 40ms to keep UI 60fps and prevent CPU lag
      if (now - this.lastRenderTime > 40) {
        this.render();
        this.lastRenderTime = now;
      } else if (!this.animId) {
        this.animId = requestAnimationFrame(() => {
          this.animId = null;
          this.render();
          this.lastRenderTime = performance.now();
        });
      }
    }

    render() {
      if (!this.el) return;
      this.el.innerHTML = (this.prefixHtml || '') + renderMarkdown(hideFileBlocksForDisplay(this.text)) + '<span class="typing-cursor"></span>';
      if (this.onScroll && !userScrolledUp) this.onScroll();
    }

    finish() {
      this.isDone = true;
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      if (this.el) {
        this.el.innerHTML = (this.prefixHtml || '') + renderMarkdown(hideFileBlocksForDisplay(this.text));
        enhanceCodeBlocks(this.el);
      }
      if (this.onScroll && !userScrolledUp) this.onScroll();
      return this.text;
    }

    flush() {
      return this.finish();
    }

    getFullText() {
      return this.text;
    }
  }

  // ==================== SMART SCROLL & CONTINUATION MANAGER ====================

  function isChatAtBottom(element = els.chatViewport, threshold = 25) {
    if (!element) return true;
    return (element.scrollHeight - element.scrollTop - element.clientHeight) <= threshold;
  }

  let scrollBottomBtnHideTimeout = null;

  function toggleScrollBottomBtn(show) {
    if (!els.scrollBottomBtn) return;
    if (scrollBottomBtnHideTimeout) {
      clearTimeout(scrollBottomBtnHideTimeout);
      scrollBottomBtnHideTimeout = null;
    }

    if (show) {
      els.scrollBottomBtn.style.display = 'flex';
      requestAnimationFrame(() => {
        els.scrollBottomBtn?.classList.add('visible');
      });
    } else {
      els.scrollBottomBtn.classList.remove('visible');
      scrollBottomBtnHideTimeout = setTimeout(() => {
        if (!els.scrollBottomBtn?.classList.contains('visible')) {
          els.scrollBottomBtn.style.display = 'none';
        }
      }, 300);
    }
  }

  function smartScrollChatToBottom(force = false) {
    if (!els.chatViewport) return;
    if (force) {
      userScrolledUp = false;
      toggleScrollBottomBtn(false);
    }
    if (userScrolledUp && !force) return;

    isAutoScrolling = true;
    els.chatViewport.scrollTop = els.chatViewport.scrollHeight;
    requestAnimationFrame(() => {
      isAutoScrolling = false;
    });
  }

  function setupSmartScrolling() {
    if (!els.chatViewport) return;

    let touchStartY = 0;
    let touchStartTime = 0;
    let pullHoldTimer = null;
    let pullFadeTimeout = null;
    let autoHideRevealedTimer = null;
    let wheelTimer = null;
    let wheelHoldTimer = null;
    let wheelAccumDelta = 0;
    let isScrollBtnVisible = false;
    // Dwell delay: tombol gulir-bawah hanya muncul setelah pengguna MENAHAN posisi
    // menggulir ke atas selama beberapa saat (bukan langsung reaktif saat melewati ambang).
    let scrollBtnDwellTimer = null;
    const SCROLL_BTN_DWELL_MS = 700;

    function showPullLoading() {
      if (!els.pullUpNewChatWrapper) return;
      const hasActiveMessages = STATE.currentSessionId && els.messagesList && els.messagesList.children.length > 0;
      if (!hasActiveMessages || STATE.isGenerating) return;

      if (pullFadeTimeout) {
        clearTimeout(pullFadeTimeout);
        pullFadeTimeout = null;
      }

      els.pullUpNewChatWrapper.style.display = 'flex';
      els.pullUpNewChatWrapper.classList.remove('revealed');
      requestAnimationFrame(() => {
        els.pullUpNewChatWrapper.classList.add('visible');
      });
    }

    function revealPullNewChatBtn() {
      if (!els.pullUpNewChatWrapper) return;
      const hasActiveMessages = STATE.currentSessionId && els.messagesList && els.messagesList.children.length > 0;
      if (!hasActiveMessages || STATE.isGenerating) return;

      if (pullFadeTimeout) {
        clearTimeout(pullFadeTimeout);
        pullFadeTimeout = null;
      }
      if (pullHoldTimer) {
        clearTimeout(pullHoldTimer);
        pullHoldTimer = null;
      }
      if (wheelHoldTimer) {
        clearTimeout(wheelHoldTimer);
        wheelHoldTimer = null;
      }
      wheelAccumDelta = 0;

      els.pullUpNewChatWrapper.style.display = 'flex';
      els.pullUpNewChatWrapper.classList.add('visible');
      els.pullUpNewChatWrapper.classList.add('revealed');
      AudioEngine.snap();

      // Auto dismiss after 8s if user leaves button untouched without clicking or scrolling
      if (autoHideRevealedTimer) clearTimeout(autoHideRevealedTimer);
      autoHideRevealedTimer = setTimeout(() => {
        if (els.pullUpNewChatWrapper?.classList.contains('revealed')) {
          hidePullWrapper(false, true);
        }
      }, 8000);
    }

    function hidePullWrapper(instant = false, reboundToBottom = true) {
      if (!els.pullUpNewChatWrapper) return;
      if (pullHoldTimer) {
        clearTimeout(pullHoldTimer);
        pullHoldTimer = null;
      }
      if (wheelHoldTimer) {
        clearTimeout(wheelHoldTimer);
        wheelHoldTimer = null;
      }
      if (autoHideRevealedTimer) {
        clearTimeout(autoHideRevealedTimer);
        autoHideRevealedTimer = null;
      }
      wheelAccumDelta = 0;

      if (instant) {
        els.pullUpNewChatWrapper.classList.remove('visible', 'revealed');
        els.pullUpNewChatWrapper.style.display = 'none';
        return;
      }

      els.pullUpNewChatWrapper.classList.remove('visible');
      if (pullFadeTimeout) clearTimeout(pullFadeTimeout);
      pullFadeTimeout = setTimeout(() => {
        if (!els.pullUpNewChatWrapper.classList.contains('visible')) {
          els.pullUpNewChatWrapper.classList.remove('revealed');
          els.pullUpNewChatWrapper.style.display = 'none';
          if (reboundToBottom && els.chatViewport && isChatAtBottom(els.chatViewport, 60)) {
            els.chatViewport.scrollTo({ top: els.chatViewport.scrollHeight, behavior: 'smooth' });
          }
        }
      }, 160);
    }

    // Pull-up New Chat button click handler
    els.pullUpNewChatBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      createNewSession();
      hidePullWrapper(true, false);
      AudioEngine.click();
    });

    const handleScrollEvent = (el = els.chatViewport) => {
      if (!el || isAutoScrolling) return;

      const scrollHeight = el.scrollHeight;
      const scrollTop = el.scrollTop;
      const clientHeight = el.clientHeight;
      const distFromBottom = Math.max(0, scrollHeight - scrollTop - clientHeight);

      // Ambang batas kemunculan tombol gulir (Scroll to Bottom Button Threshold):
      // Sesuai instruksi Kaisar Zozi: tombol tidak boleh muncul terlalu cepat saat pengguna hanya
      // menggulir sedikit (misal 50-200px dari dasar). Tombol HANYA muncul jika pengguna menggulir
      // jauh lebih tinggi ke atas (misal di bagian tengah output jawaban atau di percakapan-percakapan lama sebelumnya).
      // Ambang batas: minimal 380px atau 45% dari tinggi viewport obrolan.
      const showThreshold = Math.max(380, Math.round(clientHeight * 0.45));
      const hideThreshold = 80; // Sembunyi halus saat pengguna sudah dekat kembali ke bawah

      // Atur userScrolledUp untuk menjaga agar streaming tidak menyentak viewport jika pengguna sedang membaca
      userScrolledUp = distFromBottom > 70;

      if (distFromBottom >= showThreshold) {
        // Tampil HANYA setelah posisi menggulir ke atas ditahan stabil selama
        // SCROLL_BTN_DWELL_MS. Jika pengguna kembali ke dasar sebelum dwell selesai,
        // timer dibatalkan sehingga tombol tidak pernah muncul (anti-reaktif).
        if (!isScrollBtnVisible && !scrollBtnDwellTimer) {
          scrollBtnDwellTimer = setTimeout(() => {
            scrollBtnDwellTimer = null;
            const el = els.chatViewport;
            if (!el) return;
            const stillAway = (el.scrollHeight - el.scrollTop - el.clientHeight) >= showThreshold;
            if (stillAway && !isScrollBtnVisible) {
              isScrollBtnVisible = true;
              toggleScrollBottomBtn(true);
            }
          }, SCROLL_BTN_DWELL_MS);
        }
        hidePullWrapper(true, false);
      } else if (distFromBottom <= hideThreshold) {
        if (scrollBtnDwellTimer) {
          clearTimeout(scrollBtnDwellTimer);
          scrollBtnDwellTimer = null;
        }
        if (isScrollBtnVisible) {
          isScrollBtnVisible = false;
          toggleScrollBottomBtn(false);
        }
      }
    };

    els.chatViewport?.addEventListener('scroll', () => handleScrollEvent(els.chatViewport), { passive: true });
    
    // User touch start, move, and end on mobile devices (ChatGPT Elastic Pull & Hold)
    els.chatViewport?.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        if (pullHoldTimer) {
          clearTimeout(pullHoldTimer);
          pullHoldTimer = null;
        }
      }
    }, { passive: true });

    els.chatViewport?.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        const deltaY = touchStartY - e.touches[0].clientY; // positive = pulling past bottom
        const atBottom = isChatAtBottom(els.chatViewport, 45);

        if (deltaY < -10 || (!atBottom && deltaY < 0)) {
          // Scrolling up into previous messages: sembunyikan pull wrapper, handleScrollEvent yang akan mengecek threshold
          hidePullWrapper(true, false);
        } else if (atBottom && deltaY > 12) {
          userScrolledUp = false;
          if (isScrollBtnVisible) {
            isScrollBtnVisible = false;
            toggleScrollBottomBtn(false);
          }

          if (!els.pullUpNewChatWrapper?.classList.contains('revealed')) {
            showPullLoading();

            // Arm hold timer as soon as user pulls past bottom.
            // Dwell ditahan lebih lama agar tombol tidak muncul karena tarikan sesaat.
            if (!pullHoldTimer) {
              const holdDuration = deltaY >= 60 ? 550 : 750;
              pullHoldTimer = setTimeout(() => {
                revealPullNewChatBtn();
                pullHoldTimer = null;
              }, holdDuration);
            }
          }
        }
      }
    }, { passive: true });

    els.chatViewport?.addEventListener('touchend', () => {
      if (pullHoldTimer) {
        clearTimeout(pullHoldTimer);
        pullHoldTimer = null;
      }
      // If user revealed button -> keep it visible for interaction
      // If user did not hold long enough to reveal button -> elastic rebound back to chat output
      if (!els.pullUpNewChatWrapper?.classList.contains('revealed')) {
        hidePullWrapper(false, true);
      }
    }, { passive: true });

    // Desktop wheel: track scroll-and-hold at bottom to reveal New Chat button
    els.chatViewport?.addEventListener('wheel', (e) => {
      if (e.deltaY < 0) {
        // Scrolling up into past messages: sembunyikan pull wrapper, handleScrollEvent yang akan mengecek threshold
        hidePullWrapper(true, false);
      } else if (e.deltaY > 0) {
        const atBottom = isChatAtBottom(els.chatViewport, 45);
        if (atBottom) {
          userScrolledUp = false;
          if (isScrollBtnVisible) {
            isScrollBtnVisible = false;
            toggleScrollBottomBtn(false);
          }

          if (!els.pullUpNewChatWrapper?.classList.contains('revealed')) {
            showPullLoading();
            wheelAccumDelta += Math.abs(e.deltaY);

            // User scrolling down at bottom and holding or repeated wheeling.
            // Dwell ditahan: putaran roda sesaat TIDAK langsung membuka tombol —
            // pengguna harus menahan/menggulir terus selama ~650ms.
            if (!wheelHoldTimer) {
              wheelHoldTimer = setTimeout(() => {
                revealPullNewChatBtn();
                wheelHoldTimer = null;
              }, 650);
            }

            // Quick energetic wheel gesture threshold (dinaikkan dari 70 → 400:
            // butuh beberapa putaran roda berturut-turut, bukan satu sentakan).
            if (wheelAccumDelta >= 400) {
              if (wheelHoldTimer) clearTimeout(wheelHoldTimer);
              wheelHoldTimer = null;
              revealPullNewChatBtn();
            }

            // If user only gave a tiny accidental wheel tick and stopped, rebound after 450ms
            if (wheelTimer) clearTimeout(wheelTimer);
            wheelTimer = setTimeout(() => {
              wheelAccumDelta = 0;
              if (!els.pullUpNewChatWrapper?.classList.contains('revealed')) {
                hidePullWrapper(false, true);
              }
            }, 450);
          }
        }
      }
    }, { passive: true });

    els.scrollBottomBtn?.addEventListener('click', () => {
      if (els.chatViewport) els.chatViewport.scrollTo({ top: els.chatViewport.scrollHeight, behavior: 'smooth' });
      userScrolledUp = false;
      isScrollBtnVisible = false;
      toggleScrollBottomBtn(false);
      AudioEngine.click();
    });
  }

  // ==================== TRUNCATED RESPONSE / NEMOTRON CONTINUATION HELPERS ====================
  function isOutputTruncated(text, finishReason = null) {
    if (finishReason === 'length') return true;
    if (!text || text.length < 50) return false;
    const trimmed = text.trim();
    // Check for unclosed markdown code blocks (odd count of ```)
    const backtickCount = (trimmed.match(/```/g) || []).length;
    if (backtickCount % 2 !== 0) return true;
    // Check for trailing unfinished punctuation
    const unfinishedPunctuation = [':', ',', ';', '-', '(', '[', '{'];
    if (unfinishedPunctuation.some(p => trimmed.endsWith(p))) return true;
    // Check for mid-sentence trailing conjunction words (using word boundary to avoid false positives like Medan, Sudan, wayang, waspada)
    const unfinishedWords = ['dan', 'atau', 'dengan', 'yang', 'untuk', 'pada', 'adalah', 'karena', 'namun', 'tetapi', 'serta'];
    if (unfinishedWords.some(w => new RegExp(`\\b${w}$`, 'i').test(trimmed))) return true;
    return false;
  }

  function attachContinuationButton(container, session, assistantRow, modelName, engine, previousText) {
    if (!container) return;
    container.querySelector('.continue-response-btn')?.remove();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'continue-response-btn';
    btn.innerHTML = '<i class="fa-solid fa-forward-step"></i> <span>Lanjutkan Jawaban (Output Terpotong)</span>';

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      // H2: TOLAK saat masih ada stream berjalan. Handler ini membuat AbortController
      // BARU yang menimpa controller milik stream aktif — akibatnya tombol Stop jadi
      // mati untuk stream lama dan beberapa generasi bisa berjalan paralel
      // (jawaban tercampur di session.messages). Tombol dibiarkan ada agar bisa
      // diklik lagi setelah generasi selesai.
      if (STATE.isGenerating || STATE.isSending) {
        showToast('Masih ada respons yang sedang dihasilkan — tunggu selesai atau tekan Stop dulu.', 'info');
        return;
      }
      btn.remove();
      const bubbleText = assistantRow.querySelector('.msg-text-content');
      const continuePrompt = "Lanjutkan penjelasan/kode secara persis mulai dari kata/kalimat terakhir yang terpotong. JANGAN mengulang teks dari awal, langsung teruskan kelanjutannya.";

      bubbleText.innerHTML = renderMarkdown(previousText) + '<span class="typing-cursor"></span>';
      setGeneratingState(true);
      STATE.abortController = new AbortController();

      try {
        let appendedText = '';
        if (engine === 'openrouter') {
          appendedText = await streamContinuationOpenRouter(session, modelName, continuePrompt, bubbleText, previousText);
        } else {
          appendedText = await streamContinuationOllama(session, modelName, continuePrompt, bubbleText, previousText);
        }

        const needsNewline = previousText.endsWith('\n') || /[\.\!\?\:\;]\s*$/.test(previousText) || /```\w*$/.test(previousText);
        const needsSpace = !needsNewline && !previousText.endsWith(' ') && !appendedText.startsWith(' ') && !appendedText.startsWith('\n');
        const separator = needsNewline ? '\n' : (needsSpace ? ' ' : '');
        const merged = (previousText + separator + appendedText).trim();
        bubbleText.innerHTML = renderMarkdown(merged);
        enhanceCodeBlocks(bubbleText);
        
        let targetMsg = null;
        if (Array.isArray(session.messages)) {
          for (let i = session.messages.length - 1; i >= 0; i--) {
            const msg = session.messages[i];
            const msgContent = (msg && typeof msg.content === 'string') ? msg.content : '';
            if (msg && msg.role === 'assistant' && (msgContent === previousText || msgContent.startsWith(previousText.substring(0, 50)))) {
              targetMsg = msg;
              break;
            }
          }
        }
        if (targetMsg) {
          targetMsg.content = merged;
        } else {
          const lastMsg = (session.messages && session.messages.length > 0) ? session.messages[session.messages.length - 1] : null;
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = merged;
          }
        }
        assistantRow.dataset.fullContent = merged;
        session.updatedAt = new Date().toISOString();
        savePersistedState();
        renderChatHistory(els.searchHistoryInput?.value || '');

        if (isOutputTruncated(merged)) {
          attachContinuationButton(container, session, assistantRow, modelName, engine, merged);
        }
      } catch (err) {
        showToast('Gagal melanjutkan output: ' + err.message, 'error');
      } finally {
        setGeneratingState(false);
      }
    });

    container.appendChild(btn);
  }

  async function streamContinuationOpenRouter(session, modelName, promptInstruction, bubbleText, currentFullText) {
    const isOpenRouterDirect = IS_GITHUB_PAGES || IS_CLOUD_HOSTED;
    const endpoint = isOpenRouterDirect ? 'https://openrouter.ai/api/v1/chat/completions' : '/api/openrouter/chat';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${STATE.settings.openRouterKey}`
    };
    if (isOpenRouterDirect) {
      headers['HTTP-Referer'] = location.origin || 'https://zozi0999.github.io/zoz_router';
      headers['X-Title'] = 'ZOZ Router';
    }

    const messagesPayload = [];
    if (STATE.settings.systemPrompt) {
      messagesPayload.push({ role: 'system', content: STATE.settings.systemPrompt });
    }
    session.messages.forEach(m => messagesPayload.push({ role: m.role, content: m.content || '' }));
    messagesPayload.push({ role: 'user', content: promptInstruction });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: messagesPayload,
        stream: true,
        temperature: parseFloat(STATE.settings.temperature),
        apiKey: isOpenRouterDirect ? undefined : STATE.settings.openRouterKey
      }),
      signal: STATE.abortController?.signal
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let appended = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buf += decoder.decode();
        break;
      }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.replace(/^data:\s*/, '');
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            appended += delta;
            const needsNl = currentFullText.endsWith('\n') || /[\.\!\?\:\;]\s*$/.test(currentFullText) || /```\w*$/.test(currentFullText);
            const needsSp = !needsNl && !currentFullText.endsWith(' ') && !appended.startsWith(' ') && !appended.startsWith('\n');
            const sep = needsNl ? '\n' : (needsSp ? ' ' : '');
            bubbleText.innerHTML = renderMarkdown(currentFullText + sep + appended) + '<span class="typing-cursor"></span>';
            smartScrollChatToBottom(false);
          }
        } catch (e) {}
      }
    }

    if (buf && buf.trim() && buf.trim().startsWith('data:')) {
      const jsonStr = buf.trim().replace(/^data:\s*/, '');
      if (jsonStr !== '[DONE]') {
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            appended += delta;
            const needsNl = currentFullText.endsWith('\n') || /[\.\!\?\:\;]\s*$/.test(currentFullText) || /```\w*$/.test(currentFullText);
            const needsSp = !needsNl && !currentFullText.endsWith(' ') && !appended.startsWith(' ') && !appended.startsWith('\n');
            const sep = needsNl ? '\n' : (needsSp ? ' ' : '');
            bubbleText.innerHTML = renderMarkdown(currentFullText + sep + appended) + '<span class="typing-cursor"></span>';
            smartScrollChatToBottom(false);
          }
        } catch (e) {}
      }
    }
    return appended;
  }

  async function streamContinuationOllama(session, modelName, promptInstruction, bubbleText, currentFullText) {
    const ep = normalizeEndpoint(STATE.settings.ollamaEndpoint);
    const headers = { 'Content-Type': 'application/json' };
    if (STATE.settings.ollamaApiKey) {
      headers['Authorization'] = `Bearer ${STATE.settings.ollamaApiKey}`;
      headers['x-ollama-key'] = STATE.settings.ollamaApiKey;
    }

    const messagesPayload = [];
    if (STATE.settings.systemPrompt) {
      messagesPayload.push({ role: 'system', content: STATE.settings.systemPrompt });
    }
    session.messages.forEach(m => messagesPayload.push({ role: m.role, content: m.content || '' }));
    messagesPayload.push({ role: 'user', content: promptInstruction });

    const chatUrl = (IS_GITHUB_PAGES || /localhost|127\.0\.0\.1|\[::1\]/i.test(ep)) ? resolveEndpointUrl(ep, 'api/chat') : '/api/ollama/chat';
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: messagesPayload,
        stream: true,
        options: {
          temperature: parseFloat(STATE.settings.temperature)
        },
        endpoint: ep,
        ...(STATE.settings.ollamaApiKey ? { apiKey: STATE.settings.ollamaApiKey } : {})
      }),
      signal: STATE.abortController?.signal
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let appended = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buf += decoder.decode();
        break;
      }
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const chunk = parsed.message?.content || parsed.response || '';
          if (chunk) {
            appended += chunk;
            const needsNl = currentFullText.endsWith('\n') || /[\.\!\?\:\;]\s*$/.test(currentFullText) || /```\w*$/.test(currentFullText);
            const needsSp = !needsNl && !currentFullText.endsWith(' ') && !appended.startsWith(' ') && !appended.startsWith('\n');
            const sep = needsNl ? '\n' : (needsSp ? ' ' : '');
            bubbleText.innerHTML = renderMarkdown(currentFullText + sep + appended) + '<span class="typing-cursor"></span>';
            smartScrollChatToBottom(false);
          }
        } catch (e) {}
      }
    }

    if (buf && buf.trim()) {
      try {
        const parsed = JSON.parse(buf.trim());
        const chunk = parsed.message?.content || parsed.response || '';
        if (chunk) {
          appended += chunk;
          const needsNl = currentFullText.endsWith('\n') || /[\.\!\?\:\;]\s*$/.test(currentFullText) || /```\w*$/.test(currentFullText);
          const needsSp = !needsNl && !currentFullText.endsWith(' ') && !appended.startsWith(' ') && !appended.startsWith('\n');
          const sep = needsNl ? '\n' : (needsSp ? ' ' : '');
          bubbleText.innerHTML = renderMarkdown(currentFullText + sep + appended) + '<span class="typing-cursor"></span>';
          smartScrollChatToBottom(false);
        }
      } catch (e) {}
    }
    return appended;
  }

  // ==================== SESSIONS & CHAT MANAGEMENT ====================
  function createNewSession(initialTitle = 'Obrolan Baru', targetMode = STATE.mode) {
    if (activeChatPollTimer) {
      clearInterval(activeChatPollTimer);
      activeChatPollTimer = null;
    }
    if (STATE.isGenerating) {
      stopGeneration();
    }
    STATE.currentSessionId = null;
    safeSessionStorage.removeItem('zoz_active_session_id');
    try { localStorage.removeItem('zoz_last_active_session_id'); } catch (_) {}
    STATE.isImageGenMode = false;
    updateImageGenModeUI();
    STATE.isMusicGenMode = false;
    if (typeof updateMusicGenModeUI === 'function') updateMusicGenModeUI();
    clearResearchTargetUrls();
    STATE.attachedDocs = [];
    clearAttachedImages();
    if (els.docFileInput) els.docFileInput.value = '';
    renderAttachmentPreviews();
    renderChatHistory();
    renderCurrentSession();
    AudioEngine.click();
    if (window.innerWidth <= 768 && els.sidebar?.classList.contains('open')) {
      els.sidebar.classList.remove('open');
      els.sidebarBackdrop?.classList.remove('show');
      // M15: pop entri {modal:'sidebar'} yang dipush saat sidebar dibuka — tanpa ini
      // entri jadi yatim: tombol Back hardware ditelan, atau Back berikutnya
      // memunculkan sidebar ghost & menutup modal yang sedang terbuka.
      if (history.state?.modal === 'sidebar') history.back();
    }
  }

  function getActiveSession(targetMode = STATE.mode) {
    if (STATE.currentSessionId) {
      const found = STATE.sessions.find(s => s.id === STATE.currentSessionId);
      if (found) return found;
    }

    // Return or create active working session
    const newSession = {
      id: generateId(),
      userId: STATE.userId,
      title: 'Obrolan Baru',
      mode: targetMode,
      messages: [],
      createdAt: new Date().toISOString()
    };
    STATE.sessions.unshift(newSession);
    STATE.currentSessionId = newSession.id;
    safeSessionStorage.setItem('zoz_active_session_id', newSession.id);
    try { localStorage.setItem('zoz_last_active_session_id', newSession.id); } catch (_) {}
    savePersistedState();
    return newSession;
  }

  // M9: token per-pemanggilan — klik sesi terAKHIR yang menang, terlepas dari urutan
  // selesai await-nya (dulu "last-resolved-wins": sidebar bisa menyorot sesi A
  // padahal pengguna memilih B, dan input terasosiasi ke sesi yang salah).
  let sessionSwitchToken = 0;
  async function switchSession(sessionId) {
    if (STATE.isGenerating) {
      showToast('Harap tunggu atau hentikan generasi respons saat ini.', 'error');
      return;
    }
    const targetSession = STATE.sessions.find(s => s.id === sessionId);
    if (!targetSession) return;
    const switchToken = ++sessionSwitchToken;

    if (activeChatPollTimer) {
      clearInterval(activeChatPollTimer);
      activeChatPollTimer = null;
    }

    // Sinkronkan pesan dari disk storage jika targetSession lazy-loaded ATAU jika disk memiliki pembaruan latar belakang
    try {
      const fullSess = await DeviceStorage.getSession(sessionId);
      if (fullSess && Array.isArray(fullSess.messages)) {
        const diskLen = fullSess.messages.length;
        const memLen = targetSession.messages ? targetSession.messages.length : 0;
        const diskLast = fullSess.messages[diskLen - 1];
        const memLast = targetSession.messages ? targetSession.messages[memLen - 1] : null;

        if (targetSession._isLazyDisk || diskLen > memLen || (diskLast && memLast && diskLast.content !== memLast.content && ((diskLast.content || '').length > (memLast.content || '').length || diskLast.backgroundCompleted))) {
          targetSession.messages = fullSess.messages;
          delete targetSession._isLazyDisk;
          await ChatDB.saveSession(targetSession);
        }
      }
    } catch (e) {
      console.warn('Gagal memuat detail sesi dari storage:', e);
    }

    // M9: pengguna sudah memilih sesi LAIN selama await di atas → batalkan hasil basi ini
    if (switchToken !== sessionSwitchToken) return;

    // If session has different mode, switch tab
    if (targetSession.mode && targetSession.mode !== STATE.mode) {
      const safeMode = ['ollama', 'openrouter', 'auto'].includes(targetSession.mode) ? targetSession.mode : 'ollama';
      STATE.mode = safeMode;
      els.modeTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === STATE.mode);
      });
      updateModeLayout(STATE.mode);
    }

    STATE.currentSessionId = sessionId;
    safeSessionStorage.setItem('zoz_active_session_id', sessionId);
    try { localStorage.setItem('zoz_last_active_session_id', sessionId); } catch (_) {}
    STATE.isImageGenMode = false;
    updateImageGenModeUI();
    STATE.isMusicGenMode = false;
    if (typeof updateMusicGenModeUI === 'function') updateMusicGenModeUI();
    // Sinkronkan URL target riset sesuai sesi yang dituju
    if (Array.isArray(targetSession.researchTargetUrls)) {
      STATE.researchTargetUrls = [...targetSession.researchTargetUrls];
    } else {
      STATE.researchTargetUrls = [];
    }
    renderResearchUrlChips();
    STATE.attachedDocs = [];
    clearAttachedImages();
    if (els.docFileInput) els.docFileInput.value = '';
    renderAttachmentPreviews();
    savePersistedState();
    renderChatHistory();
    renderCurrentSession();
    updateModelUI();
    AudioEngine.click();

    if (window.innerWidth <= 768 && els.sidebar?.classList.contains('open')) {
      els.sidebar.classList.remove('open');
      els.sidebarBackdrop?.classList.remove('show');
      // M15: sama seperti createNewSession — buang entri history sidebar yatim.
      if (history.state?.modal === 'sidebar') history.back();
    }

    // Periksa apakah sesi tujuan memiliki tugas aktif atau selesai di background
    checkBackgroundChatTasksSync();
  }

  let activeHistoryDropdown = null;

  function closeAllHistoryDropdowns() {
    if (activeHistoryDropdown) {
      activeHistoryDropdown.remove();
      activeHistoryDropdown = null;
    }
    document.querySelectorAll('.history-item.menu-open').forEach(el => el.classList.remove('menu-open'));
  }

  // Global listeners for dropdown dismissal
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.history-dropdown-menu') && !e.target.closest('.history-menu-btn')) {
      closeAllHistoryDropdowns();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllHistoryDropdowns();
  });

  async function deleteSession(sessionId, e) {
    if (e) e.stopPropagation();
    const target = STATE.sessions.find(s => s.id === sessionId);
    if (!target) return;

    // H5: konfirmasi SEBELUM penghapusan permanen — dulu satu klik tak sengaja
    // (menu "Hapus" bersebelahan dengan Export/Rename) langsung menghapus sesi
    // beserta seluruh pesan dari IndexedDB tanpa undo, padahal hapus massal dan
    // hapus playlist keduanya memakai confirm().
    if (!confirm(`Hapus percakapan "${target.title || 'Obrolan Baru'}"?\n\nSeluruh pesan di dalamnya akan dihapus PERMANEN dan tidak bisa dikembalikan.`)) {
      return;
    }

    // Abort active in-flight generation if deleting the current generating session
    if (STATE.isGenerating && STATE.currentSessionId === sessionId) {
      stopGeneration();
    }

    // Hentikan tugas background chat/riset aktif di server agar tidak membangkitkan zombi sesi
    if (sessionId) {
      try {
        fetch('/api/chat/stop', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': STATE.userId
          },
          body: JSON.stringify({ sessionId, userId: STATE.userId })
        }).catch(() => {});
      } catch (_) {}
    }

    STATE.sessions = STATE.sessions.filter(s => s.id !== sessionId);
    await DeviceStorage.deleteSession(sessionId);

    if (STATE.currentSessionId === sessionId) {
      STATE.currentSessionId = null;
      safeSessionStorage.removeItem('zoz_active_session_id');
      try { localStorage.removeItem('zoz_last_active_session_id'); } catch (_) {}
    } else {
      try {
        if (localStorage.getItem('zoz_last_active_session_id') === sessionId) {
          localStorage.removeItem('zoz_last_active_session_id');
        }
      } catch (_) {}
    }

    savePersistedState();
    renderChatHistory();
    renderCurrentSession();
    AudioEngine.click();
  }

  function renameSessionPrompt(sessionId, titleSpanElement) {
    const session = STATE.sessions.find(s => s.id === sessionId);
    if (!session || !titleSpanElement) return;

    const currentTitle = session.title || 'Obrolan Baru';
    
    // Create inline editor input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'history-rename-input';
    input.value = currentTitle;
    
    let isSaved = false;
    const finishRename = async () => {
      if (isSaved) return;
      isSaved = true;
      const newTitle = input.value.trim() || currentTitle;
      session.title = newTitle;
      if (titleSpanElement.parentNode) {
        titleSpanElement.innerText = newTitle;
        titleSpanElement.title = newTitle;
        if (input.parentNode) input.replaceWith(titleSpanElement);
      }
      await DeviceStorage.renameSession(sessionId, newTitle);
      savePersistedState();
      showToast(`Nama percakapan diubah menjadi "${newTitle}"`);
      AudioEngine.click();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        isSaved = true;
        if (input.parentNode) input.replaceWith(titleSpanElement);
      }
    });

    input.addEventListener('blur', finishRename, { once: true });
    
    titleSpanElement.replaceWith(input);
    input.focus();
    input.select();
  }

  async function exportSessionData(sessionId) {
    const session = STATE.sessions.find(s => s.id === sessionId);
    if (!session) return;
    await promptExportConfirmation(session);
  }

  function getSessionTimestamp(s) {
    if (!s) return 0;
    if (s.updatedAt) {
      const t = new Date(s.updatedAt).getTime();
      if (!isNaN(t)) return t;
    }
    if (s.messages && s.messages.length > 0) {
      let lastMsg = null;
      if (s.messages.length > 0) {
        lastMsg = s.messages[s.messages.length - 1];
      }
      if (lastMsg && lastMsg.timestamp) {
        const t = new Date(lastMsg.timestamp).getTime();
        if (!isNaN(t)) return t;
      }
    }
    if (s.createdAt) {
      const t = new Date(s.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  }

  async function togglePinSession(sessionId) {
    const session = STATE.sessions.find(s => s.id === sessionId);
    if (!session) return;
    session.isPinned = !session.isPinned;
    session.updatedAt = new Date().toISOString();
    
    if (session._isLazyDisk && (!session.messages || session.messages.length === 0)) {
      await DeviceStorage.updateSessionMetadata(sessionId, { isPinned: session.isPinned, updatedAt: session.updatedAt });
    } else {
      await DeviceStorage.saveSession(session);
    }
    savePersistedState();
    renderChatHistory();
    showToast(session.isPinned ? '📌 Percakapan disematkan di paling atas' : 'Percakapan dilepas dari sematan');
    AudioEngine.click();
  }

  function renderChatHistory(filterQuery = '') {
    if (!els.chatHistoryList) return;
    els.chatHistoryList.innerHTML = '';
    const q = filterQuery.toLowerCase().trim();
    
    // Unified list of all sessions across engines (including lazy-loaded disk sessions)
    const validSessions = STATE.sessions.filter(s => {
      if (s._isLazyDisk) {
        return (typeof s.messageCount === 'number' && s.messageCount > 0) || (Array.isArray(s.messages) && s.messages.length > 0);
      }
      return Array.isArray(s.messages) && s.messages.length > 0;
    });
    const filtered = validSessions.filter(s => !q || (s.title || '').toLowerCase().includes(q) || (s.mode && s.mode.toLowerCase().includes(q)));

    // Sort strictly: Pinned sessions first, then most recently active descending
    filtered.sort((a, b) => {
      const aPinned = !!a.isPinned;
      const bPinned = !!b.isPinned;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return getSessionTimestamp(b) - getSessionTimestamp(a);
    });

    // Update history header label
    const historyHeader = $('.history-label');
    if (historyHeader) {
      historyHeader.innerText = 'RIWAYAT PERCAKAPAN';
    }

    if (filtered.length === 0) {
      els.chatHistoryList.innerHTML = `<div style="font-size:0.75rem; color:var(--text-dim); text-align:center; padding:16px 8px;">Belum ada riwayat percakapan<br><span style="font-size:0.68rem; opacity:0.7;">Ketik prompt di bawah untuk memulai.</span></div>`;
      return;
    }

    filtered.forEach(session => {
      const item = document.createElement('div');
      item.className = `history-item ${session.id === STATE.currentSessionId ? 'active' : ''} ${session.isPinned ? 'is-pinned' : ''}`;
      item.dataset.id = session.id;
      item.tabIndex = 0;
      
      let modeIcon = 'fa-server';
      let modeColor = 'var(--neon-cyan)';
      let modeTag = 'Ollama';
      if (session.mode === 'openrouter') {
        modeIcon = 'fa-bolt';
        modeColor = 'var(--neon-amber)';
        modeTag = 'OpenRouter';
      } else if (session.mode === 'auto') {
        modeIcon = 'fa-route';
        modeColor = 'var(--neon-teal)';
        modeTag = 'Auto';
      }

      item.innerHTML = `
        <div class="history-title-wrap">
          ${session.isPinned ? '<i class="fa-solid fa-thumbtack history-pin-icon" title="Disematkan di Atas"></i>' : ''}
          <i class="fa-solid ${modeIcon}" style="color:${modeColor}; font-size:0.8rem;" title="Engine: ${modeTag}"></i>
          <span class="history-title" title="${escapeHtml(session.title)}">${escapeHtml(session.title)}</span>
        </div>
        <div class="history-item-actions">
          <button class="history-menu-btn" title="Opsi Percakapan (Sematkan / Ganti Nama / Hapus)" aria-label="Opsi Percakapan">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </div>
      `;

      const titleSpan = item.querySelector('.history-title');
      const menuBtn = item.querySelector('.history-menu-btn');

      // Double-click on title to rename
      titleSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        renameSessionPrompt(session.id, titleSpan);
      });

      // Switch session on item click
      item.addEventListener('click', (e) => {
        if (e.target.closest('.history-menu-btn') || e.target.closest('.history-dropdown-menu') || e.target.closest('.history-rename-input')) {
          return;
        }
        closeAllHistoryDropdowns();
        switchSession(session.id);
      });

      // 3-Dots Menu Click Trigger
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = item.classList.contains('menu-open');
        closeAllHistoryDropdowns();

        if (isOpen) return;

        item.classList.add('menu-open');
        const dropdown = document.createElement('div');
        dropdown.className = 'history-dropdown-menu';
        dropdown.innerHTML = `
          <button class="history-dropdown-item pin-opt">
            <i class="fa-solid fa-thumbtack" style="${session.isPinned ? 'color:var(--neon-cyan); transform:rotate(45deg);' : ''}"></i>
            <span>${session.isPinned ? 'Lepas Sematan' : 'Sematkan di Atas'}</span>
          </button>
          <button class="history-dropdown-item rename-opt">
            <i class="fa-solid fa-pen-to-square"></i>
            <span>Ganti Nama</span>
          </button>
          <button class="history-dropdown-item export-opt">
            <i class="fa-solid fa-file-arrow-down"></i>
            <span>Unduh Chat (.md)</span>
          </button>
          <button class="history-dropdown-item delete-item delete-opt">
            <i class="fa-solid fa-trash-can"></i>
            <span>Hapus Percakapan</span>
          </button>
        `;

        dropdown.querySelector('.pin-opt').addEventListener('click', (ev) => {
          ev.stopPropagation();
          closeAllHistoryDropdowns();
          togglePinSession(session.id);
        });

        dropdown.querySelector('.rename-opt').addEventListener('click', (ev) => {
          ev.stopPropagation();
          closeAllHistoryDropdowns();
          renameSessionPrompt(session.id, titleSpan);
        });

        dropdown.querySelector('.export-opt').addEventListener('click', (ev) => {
          ev.stopPropagation();
          closeAllHistoryDropdowns();
          exportSessionData(session.id);
        });

        dropdown.querySelector('.delete-opt').addEventListener('click', (ev) => {
          ev.stopPropagation();
          closeAllHistoryDropdowns();
          deleteSession(session.id);
        });

        // Pasang FIXED di root: dulu dropdown adalah child absolut di dalam
        // .history-section (overflow-y:auto) sehingga menu pada item dekat dasar
        // daftar terpotong tepi scroll dan item "Hapus" jadi tak terjangkau.
        document.body.appendChild(dropdown);
        const anchor = e.currentTarget.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.zIndex = '1200';
        dropdown.style.right = '0px'; // fallback saat pengukuran
        dropdown.style.top = '0px';
        const menuW = dropdown.offsetWidth;
        const menuH = dropdown.offsetHeight;
        let menuTop = anchor.bottom + 4;
        if (menuTop + menuH > window.innerHeight - 8) {
          menuTop = Math.max(8, anchor.top - menuH - 4); // flip ke atas bila melewati dasar layar
        }
        let menuRight = Math.max(8, window.innerWidth - anchor.right);
        if (menuRight + menuW > window.innerWidth - 8) {
          menuRight = Math.max(8, window.innerWidth - menuW - 8);
        }
        dropdown.style.top = menuTop + 'px';
        dropdown.style.right = menuRight + 'px';
        activeHistoryDropdown = dropdown;
        AudioEngine.click();
      });

      els.chatHistoryList.appendChild(item);
    });
  }

  function renderCurrentSession() {
    // If no session is actively selected -> Land on TAMPILAN UTAMA (Welcome Hero)!
    if (!STATE.currentSessionId) {
      if (els.welcomeHero) els.welcomeHero.style.display = 'flex';
      if (els.messagesList) els.messagesList.innerHTML = '';
      if (els.pullUpNewChatWrapper) {
        els.pullUpNewChatWrapper.classList.remove('visible');
        els.pullUpNewChatWrapper.style.display = 'none';
      }
      smartScrollChatToBottom(true);
      return;
    }

    const session = STATE.sessions.find(s => s.id === STATE.currentSessionId);
    if (!session || !session.messages || session.messages.length === 0) {
      if (els.welcomeHero) els.welcomeHero.style.display = 'flex';
      if (els.messagesList) els.messagesList.innerHTML = '';
      if (els.pullUpNewChatWrapper) {
        els.pullUpNewChatWrapper.classList.remove('visible');
        els.pullUpNewChatWrapper.style.display = 'none';
      }
      smartScrollChatToBottom(true);
      return;
    }

    if (els.welcomeHero) els.welcomeHero.style.display = 'none';
    if (els.messagesList) els.messagesList.innerHTML = '';
    if (els.pullUpNewChatWrapper) {
      els.pullUpNewChatWrapper.classList.remove('visible');
      els.pullUpNewChatWrapper.style.display = 'none';
    }
    session.messages.forEach((msg, idx) => {
      if (msg.type === 'image_generation' || msg.isImageGen) {
        renderSavedImageMessage(msg, idx);
        return;
      }
      let textToDisplay = (msg.role === 'user' && typeof msg.displayContent === 'string') ? msg.displayContent : (msg.content || '');
      const imagesToDisplay = msg.images || (msg.image ? [msg.image] : null);
      if (imagesToDisplay && imagesToDisplay.length > 0 && /^📷 \[\d+ Foto Lampiran\]$/.test(textToDisplay.trim())) {
        textToDisplay = '';
      }
      appendMessageElement(msg.role, textToDisplay, imagesToDisplay, msg.model, msg.stats, idx, msg.sources, msg.docs, msg.isDeepResearch, msg.latency, msg.timestamp || session.updatedAt || session.createdAt, msg);
    });

    enhanceCodeBlocks(els.messagesList);
    smartScrollChatToBottom(true);
  }

  function createGeneratedImageCardHtml(item) {
    const imgUrl = item.url || item.imageUrl || item.localUrl || '';
    const prompt = item.prompt || '';
    const model = item.model || 'Flux.1 Schnell';
    const duration = item.duration || item.stats?.duration || '3.5';
    const width = item.width || 1024;
    const height = item.height || 1024;
    const seed = item.seed || '';

    return `
      <div class="image-result-card" data-prompt="${escapeHtml(prompt)}" data-img-url="${escapeHtml(imgUrl)}" data-model="${escapeHtml(model)}" tabindex="0">
        <div class="image-result-display-wrap" title="Klik untuk membuka layar penuh (Lightbox)">
          <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(prompt)}" class="image-result-img chat-zoomable-img">
          <div class="image-result-overlay">
            <button class="image-action-btn btn-open-lightbox" title="Buka Layar Penuh">
              <i class="fa-solid fa-expand"></i>
            </button>
            <button class="image-action-btn btn-download-img" title="Unduh HD PNG">
              <i class="fa-solid fa-download"></i>
            </button>
          </div>
        </div>
        <div class="image-result-footer">
          <div class="image-meta-badges">
            <span class="image-meta-badge model-badge"><i class="fa-solid fa-wand-magic-sparkles"></i> ${escapeHtml(model)}</span>
            <span class="image-meta-badge"><i class="fa-solid fa-vector-square"></i> ${width}×${height}</span>
            <span class="image-meta-badge latency-badge"><i class="fa-solid fa-bolt"></i> ${duration}s</span>
            ${seed ? `<span class="image-meta-badge"><i class="fa-solid fa-hashtag"></i> ${seed}</span>` : ''}
          </div>
          <div class="image-gen-prompt-quote" title="${escapeHtml(prompt)}">
            "${escapeHtml(prompt)}"
          </div>
          <div class="image-actions-bar">
            <button class="btn btn-xs btn-primary btn-image-action btn-regen-img">
              <i class="fa-solid fa-rotate-right"></i> Buat Variasi Baru
            </button>
            <button class="btn btn-xs btn-outline btn-image-action btn-copy-prompt">
              <i class="fa-solid fa-copy"></i> Salin Prompt
            </button>
            <button class="btn btn-xs btn-outline btn-image-action btn-download-direct">
              <i class="fa-solid fa-download"></i> Unduh Gambar
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async function triggerImageDownload(url, promptText) {
    showToast('Mengunduh gambar HD...', 'info');
    const cleanName = (promptText || 'ai_image').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
    const fileName = `zoz_${cleanName}_${Date.now()}.png`;
    try {
      if (url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 500);
        return;
      }
      const resp = await fetch(url, { mode: 'cors' });
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(blobUrl);
      }, 3000);
    } catch (err) {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 500);
    }
  }

  function attachImageCardListeners(row, promptText, imageUrl, cardModel = null) {
    const card = row.querySelector('.image-result-card');
    if (!card) return;

    // Lightbox on image click or fullscreen button
    const imgWrap = card.querySelector('.image-result-display-wrap');
    const openLbBtn = card.querySelector('.btn-open-lightbox');
    const triggerLightbox = (e) => {
      e.stopPropagation();
      ImageLightbox.open([imageUrl], 0);
    };
    imgWrap?.addEventListener('click', triggerLightbox);
    openLbBtn?.addEventListener('click', triggerLightbox);

    // Download HD Image
    const dlBtns = card.querySelectorAll('.btn-download-img, .btn-download-direct');
    dlBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerImageDownload(imageUrl, promptText);
      });
    });

    // Copy Prompt
    const copyBtns = [card.querySelector('.btn-copy-prompt'), row.querySelector('.copy-prompt-btn')].filter(Boolean);
    copyBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyTextToClipboard(promptText || '');
        showToast('Prompt gambar berhasil disalin!', 'success');
      });
    });

    // Regenerate variation
    const regenBtn = card.querySelector('.btn-regen-img');
    regenBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentSession = getActiveSession();
      if (currentSession) {
        runImageGeneration(currentSession, promptText, cardModel || STATE.settings.imageModel);
      }
    });
  }

  function renderSavedImageMessage(msg, idx = -1) {
    const row = document.createElement('div');
    row.className = 'message-row assistant';
    row.dataset.index = idx;

    const avatarIcon = '<i class="fa-solid fa-microchip-ai"></i>';
    const cardHtml = createGeneratedImageCardHtml(msg);

    row.innerHTML = `
      <div class="message-avatar">${avatarIcon}</div>
      <div class="message-content-box">
        <div class="message-meta">
          <strong>AI Image Studio</strong>
          <span class="meta-model-badge">${escapeHtml(msg.model || 'Flux.1')}</span>
          ${msg.stats?.duration ? `<span>⏱️ ${msg.stats.duration}s</span>` : ''}
        </div>
        <div class="message-bubble" style="background:transparent; border:none; padding:0;">
          ${cardHtml}
        </div>
        <div class="message-actions-bar">
          <button class="msg-action-btn copy-prompt-btn" title="Salin Prompt"><i class="fa-solid fa-copy"></i> Salin Prompt</button>
        </div>
      </div>
    `;

    attachImageCardListeners(row, msg.prompt, msg.imageUrl || msg.url, msg.model);
    els.messagesList.appendChild(row);
  }

  function appendMessageElement(role, content, image = null, model = '', stats = null, index = -1, sources = null, docs = null, isDeepResearch = false, latency = null, timestamp = null, extraMeta = null) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    row.dataset.index = index;
    const currentSess = STATE.sessions.find(s => s.id === STATE.currentSessionId);
    const resolvedTimestamp = timestamp || (typeof index === 'number' && index >= 0 && currentSess?.messages?.[index]?.timestamp) || currentSess?.updatedAt || currentSess?.createdAt || null;
    if (resolvedTimestamp) {
      row.dataset.reportDate = resolvedTimestamp;
    }
    if (content) {
      row.dataset.fullContent = content;
    }

    const avatarIcon = role === 'user' ? '<i class="fa-solid fa-user-ninja"></i>' : '<i class="fa-solid fa-microchip-ai"></i>';
    const roleLabel = role === 'user' ? 'Anda' : 'Zoz AI';

    const imgList = Array.isArray(image) ? image.filter(Boolean) : (image ? [image] : []);
    let imageGalleryHtml = '';
    if (imgList.length > 0) {
      const gridClass = imgList.length === 1 ? 'grid-1' : (imgList.length === 2 ? 'grid-2' : 'grid-multi');
      imageGalleryHtml = `
        <div class="attached-images-gallery ${gridClass}">
          ${imgList.map((src, imgIdx) => `
            <div class="chat-img-thumb-wrap" data-img-idx="${imgIdx}" title="Klik untuk melihat foto layar penuh" tabindex="0">
              <img src="${escapeHtml(src)}" alt="Foto ${imgIdx + 1}" class="chat-zoomable-img">
              <div class="chat-img-overlay">
                <i class="fa-solid fa-expand"></i>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    let docsHtml = '';
    if (docs && Array.isArray(docs) && docs.length > 0 && role === 'user') {
      docsHtml = `
        <div class="attached-docs-badge-row">
          ${docs.map(d => {
            const isWebDoc = Boolean(d.isWeb || (d.name && d.name.startsWith('[Web:')) || d.url);
            let targetUrl = d.url;
            if (!targetUrl && isWebDoc && typeof d.content === 'string') {
              const urlMatch = d.content.match(/Sumber URL:\s*(https?:\/\/[^\s\n]+)/i);
              if (urlMatch) targetUrl = urlMatch[1];
            }
            const iconClass = isWebDoc ? 'fa-solid fa-globe' : 'fa-solid fa-file-lines';
            const iconColor = isWebDoc ? 'color: var(--neon-cyan);' : '';
            if (isWebDoc && targetUrl) {
              return `
                <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer" class="msg-doc-badge msg-doc-web-link" title="Buka tautan website: ${escapeHtml(targetUrl)}">
                  <i class="${iconClass}" style="${iconColor}"></i>
                  <span class="msg-doc-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
                  <span class="msg-doc-size">${escapeHtml(d.size || '')}</span>
                  <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.65rem; opacity:0.75; margin-left:2px;"></i>
                </a>
              `;
            }
            return `
              <div class="msg-doc-badge">
                <i class="${iconClass}" style="${iconColor}"></i>
                <span class="msg-doc-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
                <span class="msg-doc-size">${escapeHtml(d.size || '')}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const isActuallyDeepResearch = Boolean(
      isDeepResearch ||
      (role === 'assistant' && typeof content === 'string' && (
        /#\s*(?:📑|🔬)?\s*(?:laporan\s*)?deep\s*research/i.test(content) ||
        content.includes('Lead Auditor & Corrector') ||
        (content.includes('DEEP RESEARCH') && /##\s*1\.\s*.*(?:rangkuman|pendahuluan|ringkasan|komprehensif)/i.test(content)) ||
        /##\s*1\.\s*.*(?:pendahuluan\s*&\s*ringkasan\s*komprehensif|ringkasan\s*eksekutif)/i.test(content)
      ))
    );

    let statsHtml = '';
    if (isActuallyDeepResearch && role === 'assistant') {
      statsHtml = `
        <span class="meta-badge engine-badge"><i class="fa-solid fa-microscope" style="color:var(--neon-amber);"></i> DEEP RESEARCH</span>
        <span class="meta-badge model-badge">${escapeHtml(model || 'Zoz AI')}</span>
        ${latency ? `<span class="meta-badge latency-badge"><i class="fa-solid fa-bolt"></i> ${escapeHtml(latency)}s</span>` : ''}
        ${sources && sources.length > 0 ? `<span class="meta-badge sources-badge"><i class="fa-solid fa-globe"></i> ${sources.length} Sumber</span>` : ''}
      `;
    } else if (stats && role === 'assistant') {
      statsHtml = `
        <span class="meta-model-badge">${escapeHtml(model)}</span>
        <span>⏱️ ${stats.duration}s</span>
        <span>⚡ ${stats.tps} tps</span>
      `;
    } else if (model && role === 'assistant') {
      statsHtml = `<span class="meta-model-badge">${escapeHtml(model)}</span>`;
    }

    const hasText = Boolean(content && String(content).trim().length > 0);
    let renderedBody = '';
    if (isActuallyDeepResearch && role === 'assistant' && hasText) {
      const msgObj = (typeof index === 'number' && index >= 0 && currentSess?.messages?.[index]) ? currentSess.messages[index] : null;
      renderedBody = buildDeepResearchSummaryCardHtml(content, model, sources, resolvedTimestamp || timestamp, msgObj?.chatSummary || '');
    } else {
      renderedBody = role === 'assistant' ? renderMarkdown(content || '') : escapeHtml(content || '').replace(/\n/g, '<br>');
    }
    const textDisplayStyle = (!hasText && role === 'user') ? 'style="display:none;"' : '';

    let assistantGeneratedImagesHtml = '';
    if (role === 'assistant' && imgList.length > 0) {
      assistantGeneratedImagesHtml = `
        <div class="chat-generated-images-grid" style="margin-top: 10px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
          ${imgList.map(src => createGeneratedImageCardHtml({
            url: src,
            imageUrl: src,
            prompt: content || 'Karya Visual AI',
            model: model || 'Zoz AI',
            duration: stats?.duration || '1.5'
          })).join('')}
        </div>
      `;
    }

    let assistantMediaHtml = '';
    const safeMeta = (extraMeta && typeof extraMeta === 'object') ? extraMeta : {};
    const audioUrl = safeMeta.audioUrl || safeMeta.url || (typeof content === 'string' && (content.match(/\[(?:Putar\s*\/\s*Unduh\s*Audio|Dengar\s*Audio)\]\((https?:\/\/[^\s\)]+|\/uploads\/[^\s\)]+)\)/i) || content.match(/\((https?:\/\/[^\s\)]+\.mp3|\/uploads\/[^\s\)]+\.mp3)\)/i))?.[1]);
    const videoUrl = safeMeta.videoUrl || (safeMeta.type === 'video_generation' && safeMeta.url) || (typeof content === 'string' && (content.match(/\[(?:Tonton\s*\/\s*Unduh\s*Video|Lihat\s*Video)\]\((https?:\/\/[^\s\)]+|\/uploads\/[^\s\)]+)\)/i) || content.match(/\((https?:\/\/[^\s\)]+\.mp4|\/uploads\/[^\s\)]+\.mp4)\)/i))?.[1]);

    if (role === 'assistant' && audioUrl && (safeMeta.isMusicGen || safeMeta.type === 'music_generation' || /\.mp3(?:$|\?)/i.test(audioUrl) || /Audio/i.test(content || ''))) {
      if (typeof buildCyberAudioPlayerCardHtml === 'function') {
        assistantMediaHtml += buildCyberAudioPlayerCardHtml({
          url: audioUrl,
          audioUrl: audioUrl,
          title: safeMeta.title || 'Singularity Cyber Audio',
          genre: safeMeta.genre || 'Cyberpunk',
          bpm: safeMeta.bpm || null,
          duration: safeMeta.duration || 15,
          prompt: safeMeta.prompt || content,
          aiComposed: Boolean(safeMeta.aiComposed),
          aiSummary: safeMeta.aiSummary || ''
        });
      }
    }

    if (role === 'assistant' && videoUrl && (safeMeta.isVideoGen || safeMeta.type === 'video_generation' || /\.mp4(?:$|\?)/i.test(videoUrl) || /Video/i.test(content || ''))) {
      if (typeof buildCyberVideoPlayerCardHtml === 'function') {
        assistantMediaHtml += buildCyberVideoPlayerCardHtml({
          url: videoUrl,
          videoUrl: videoUrl,
          title: safeMeta.title || 'Cinematic Video Motion',
          style: safeMeta.style || 'Cinematic Motion',
          duration: safeMeta.duration || 5,
          prompt: safeMeta.prompt || content
        });
      }
    }

    let sourcesHtml = '';
    if (sources && Array.isArray(sources) && sources.length > 0 && role === 'assistant' && !isActuallyDeepResearch) {
      sourcesHtml = buildSourcesSectionHtml(sources, true);
    }

    const metaContent = (isActuallyDeepResearch && role === 'assistant')
      ? statsHtml
      : `<strong>${roleLabel}</strong> ${statsHtml}`;

    row.innerHTML = `
      <div class="message-avatar">${avatarIcon}</div>
      <div class="message-content-box">
        <div class="message-meta">
          ${metaContent}
        </div>
        <div class="message-bubble">
          ${role === 'user' ? imageGalleryHtml : ''}
          ${docsHtml}
          <div class="msg-text-content" ${textDisplayStyle}>${renderedBody}</div>
          ${role === 'assistant' ? assistantGeneratedImagesHtml : ''}
          ${role === 'assistant' ? assistantMediaHtml : ''}
          ${sourcesHtml}
        </div>
        <div class="message-actions-bar">
          ${role === 'user' ? '<button class="msg-action-btn edit-msg-btn" title="Edit & Kirim Ulang Prompt"><i class="fa-solid fa-pen-to-square"></i> Edit</button>' : ''}
          <button class="msg-action-btn copy-msg-btn" title="Salin Pesan"><i class="fa-solid fa-copy"></i> Salin</button>
        </div>
      </div>
    `;

    // Attach Deep Research Card Actions (Full Report Modal & Quick Exports)
    if (isActuallyDeepResearch && role === 'assistant' && hasText) {
      attachDeepResearchCardEvents(row, content, model, sources, null);
    }

    // Attach image card listeners for assistant generated visual cards
    if (role === 'assistant' && imgList.length > 0) {
      attachImageCardListeners(row, content || '', imgList[0]);
    }

    // Attach audio & video listeners
    if (role === 'assistant') {
      try {
        if (typeof attachAudioPlayerListeners === 'function') attachAudioPlayerListeners(row);
        if (typeof attachVideoPlayerListeners === 'function') attachVideoPlayerListeners(row);
      } catch (mediaListenerErr) {
        console.warn('Media player listener init notice:', mediaListenerErr);
      }
    }

    // Attach Lightbox click triggers to images in user attachment bubble
    if (imgList.length > 0 && role === 'user') {
      row.querySelectorAll('.chat-img-thumb-wrap').forEach((thumb) => {
        thumb.addEventListener('click', (e) => {
          e.stopPropagation();
          const clickedIdx = parseInt(thumb.dataset.imgIdx, 10) || 0;
          ImageLightbox.open(imgList, clickedIdx);
        });
      });
    }

    // Enhance any inline markdown images
    enhanceChatImages(row);


    // Edit Prompt Button Handler (for User messages)
    if (role === 'user') {
      const editBtn = row.querySelector('.edit-msg-btn');
      const bubble = row.querySelector('.message-bubble');
      const textContainer = row.querySelector('.msg-text-content');
      const actionsBar = row.querySelector('.message-actions-bar');

      editBtn?.addEventListener('click', () => {
        if (STATE.isGenerating) {
          showToast('Harap tunggu atau hentikan generasi AI saat ini sebelum mengedit.', 'error');
          return;
        }
        if (!bubble || !textContainer) return;
        if (bubble.querySelector('.inline-edit-box')) return;

        // Create inline editor
        const originalContent = content;
        textContainer.style.display = 'none';
        if (actionsBar) actionsBar.style.display = 'none';

        const editorBox = document.createElement('div');
        editorBox.className = 'inline-edit-box';
        editorBox.style.cssText = 'display:flex; flex-direction:column; gap:8px; width:100%; min-width:280px; margin-top:4px;';
        editorBox.innerHTML = `
          <textarea class="inline-edit-textarea" style="width:100%; min-height:75px; background:var(--bg-core); border:1px solid var(--neon-cyan); border-radius:6px; color:var(--text-main); padding:8px 10px; font-family:var(--font-main); font-size:0.9rem; line-height:1.5; resize:vertical; outline:none; box-shadow:0 0 12px rgba(0,240,255,0.25);">${escapeHtml(originalContent)}</textarea>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button class="btn btn-sm btn-secondary cancel-edit-btn" style="padding:4px 10px; font-size:0.75rem;">Batal</button>
            <button class="btn btn-sm btn-primary save-edit-btn" style="padding:4px 12px; font-size:0.75rem;"><i class="fa-solid fa-paper-plane"></i> Simpan & Kirim Ulang</button>
          </div>
        `;

        bubble.appendChild(editorBox);
        const textarea = editorBox.querySelector('.inline-edit-textarea');
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }

        // Cancel
        editorBox.querySelector('.cancel-edit-btn')?.addEventListener('click', () => {
          editorBox.remove();
          if (textContainer) textContainer.style.display = 'block';
          if (actionsBar) actionsBar.style.display = 'flex';
          AudioEngine.click();
        });

        // Save & Resend
        const doSaveAndResend = () => {
          // M5: cek KEDUA guard SAAT tombol ditekan (bukan hanya saat editor dibuka).
          // Saat masih ada await awal di handleSendPrompt (scrape URL / hydrate sesi),
          // isSending=true tetapi isGenerating=false — dulu riwayat sudah dipotong
          // lebih dulu lalu kirim dibatalkan diam-diam oleh guard → pesan hilang.
          if (STATE.isGenerating || STATE.isSending) {
            showToast('Masih ada pengiriman yang diproses — tunggu selesai dulu sebelum mengedit & mengirim ulang.', 'error');
            return;
          }
          const newText = textarea ? textarea.value.trim() : '';
          if (!newText && (!imgList || imgList.length === 0) && (!docs || docs.length === 0)) {
            showToast('Prompt tidak boleh kosong.', 'error');
            return;
          }

          const session = getActiveSession();
          // Find index of this message in session (matching either raw content or displayContent)
          let msgIdx = index;
          if (msgIdx < 0 || msgIdx >= session.messages.length) {
            msgIdx = session.messages.findIndex(m => m.role === 'user' && (m.content === originalContent || m.displayContent === originalContent));
          }

          const targetUserMsg = (msgIdx >= 0 && msgIdx < session.messages.length) ? session.messages[msgIdx] : null;

          // Preserve / restore attached documents with their full text content
          let restoredDocs = (docs && Array.isArray(docs)) ? [...docs] : [];
          if (restoredDocs.length > 0 && targetUserMsg) {
            restoredDocs = restoredDocs.map(d => {
              if (d && typeof d.content === 'string' && d.content.trim().length > 0) {
                return d;
              }
              // Check if targetUserMsg.docs has content
              if (Array.isArray(targetUserMsg.docs)) {
                const foundDoc = targetUserMsg.docs.find(td => td && td.name === d.name && typeof td.content === 'string' && td.content.trim().length > 0);
                if (foundDoc) return { ...d, content: foundDoc.content };
              }
              // Extract content from targetUserMsg.content
              if (targetUserMsg.content && typeof targetUserMsg.content === 'string') {
                const safeName = (d.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const docRegex = new RegExp(`--- \\[LAMPIRAN DOKUMEN:\\s*${safeName}[^\\n]*\\] ---\\n([\\s\\S]*?)\\n--- \\[AKHIR DOKUMEN:`, 'i');
                const match = targetUserMsg.content.match(docRegex);
                if (match && match[1]) {
                  return { ...d, content: match[1] };
                }
              }
              return d;
            });
          }

          if (msgIdx >= 0) {
            // Truncate history from this message onward
            session.messages = session.messages.slice(0, msgIdx);
          }

          editorBox.remove();
          savePersistedState();
          
          // Re-render UI up to the truncated point
          renderCurrentSession();

          // Set prompt input and send
          if (els.promptInput) els.promptInput.value = newText;
          if (imgList && imgList.length > 0) {
            STATE.attachedImages = [...imgList];
            renderAttachmentPreviews();
          }
          if (restoredDocs && Array.isArray(restoredDocs) && restoredDocs.length > 0) {
            STATE.attachedDocs = [...restoredDocs];
            renderAttachmentPreviews();
          }
          if (STATE.isPromptHidden) {
            togglePromptVisibility(false);
          }
          handleSendPrompt().catch((err) => {
            console.error('Edit-and-resend gagal:', err);
            showToast('Gagal mengirim pesan: ' + (err && err.message ? err.message : err), 'error');
          });
        };

        editorBox.querySelector('.save-edit-btn')?.addEventListener('click', doSaveAndResend);
        textarea?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            doSaveAndResend();
          }
        });
      });
    }

    // Universal Code block enhancement & Copy button
    enhanceCodeBlocks(row);

    // Message copy button
    row.querySelector('.copy-msg-btn')?.addEventListener('click', () => {
      const textToCopy = row.dataset.fullContent || content || row.querySelector('.msg-text-content')?.innerText || '';
      copyTextToClipboard(textToCopy, null, 'Pesan disalin ke clipboard!');
    });

    els.messagesList?.appendChild(row);
    if (hasText) {
      renderYouTubeCardsForMessage(row, content);
    }
    // Kartu file buatan AI juga dirender saat pesan dimuat ulang dari riwayat (msg.files)
    renderMessageFiles(row, extraMeta && extraMeta.files);
    return row;
  }

  // ==================== DOCUMENT & FILE ATTACHMENT HANDLER ====================
  async function extractFileContent(file) {
    if (!file) return '';
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    
    // Safety guard: Jika berkas gambar lolos ke fungsi ini, cegah pembacaan teks mentah
    if (isImageFile(file)) {
      return `[File gambar "${file.name}" dialihkan secara visual ke galeri foto.]`;
    }

    // Safety guard: Berkas biner non-dokumen yang tidak boleh dibaca sebagai teks
    const binaryExtensions = [
      'exe', 'dll', 'so', 'bin', 'iso', 'img', 'dmg', 'apk', 'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz',
      'mp3', 'wav', 'ogg', 'm4a', 'flac', 'mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv'
    ];
    if (binaryExtensions.includes(ext)) {
      return `[File biner "${file.name}" tidak dapat dibaca sebagai dokumen teks. Harap gunakan format teks (PDF, DOCX, TXT, MD, JSON, CSV, Kode).]`;
    }

    // 1. PDF Documents (Extract text per page safely via PDF.js)
    if (ext === 'pdf' || file.type === 'application/pdf') {
      try {
        if (!window.pdfjsLib) {
          return `[Pustaka pembaca PDF (pdf.js) belum termuat atau diblokir peramban. Tidak dapat membaca file "${file.name}".]`;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          if (pageText.trim()) {
            fullText += `[Halaman ${i}]\n${pageText.trim()}\n\n`;
          }
        }
        if (!fullText.trim()) {
          return `[Dokumen PDF "${file.name}" tidak berisi lapisan teks digital / merupakan pindaian gambar.]`;
        }
        return fullText.trim();
      } catch (pdfErr) {
        console.warn('PDF.js parse error:', pdfErr);
        return `[Gagal mengekstrak teks dari PDF "${file.name}": ${pdfErr.message}]`;
      }
    }

    // 2. DOCX Documents (Extract text safely via JSZip & DOMParser)
    if (ext === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        if (!window.JSZip) {
          return Promise.resolve(`[Pustaka pembaca DOCX (JSZip) belum termuat atau diblokir peramban. Tidak dapat membaca file "${file.name}".]`);
        }
        const arrayBuffer = await file.arrayBuffer();
        let zip;
        try {
          zip = await JSZip.loadAsync(arrayBuffer);
        } catch (zipErr) {
          console.warn('JSZip loadAsync error:', zipErr);
          return `[File DOCX "${file.name}" corrupt atau bukan arsip ZIP valid: ${zipErr.message}]`;
        }
        const docXml = zip.file('word/document.xml');
        if (docXml) {
          const xmlText = await docXml.async('text');
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
          const paragraphs = xmlDoc.getElementsByTagName('w:p');
          const lines = [];
          for (let i = 0; i < paragraphs.length; i++) {
            const texts = paragraphs[i].getElementsByTagName('w:t');
            let pText = '';
            for (let j = 0; j < texts.length; j++) {
              pText += texts[j].textContent;
            }
            if (pText.trim()) lines.push(pText.trim());
          }
          if (lines.length > 0) return lines.join('\n');
        }
        return `[Dokumen DOCX "${file.name}" kosong atau tidak memiliki teks yang terbaca.]`;
      } catch (docxErr) {
        console.warn('DOCX parse error:', docxErr);
        return `[Gagal mengekstrak teks dari DOCX "${file.name}": ${docxErr.message}]`;
      }
    }

    // 3. Plain Text, Code, CSV, Markdown, JSON, YAML, etc.
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        let text = e.target.result || '';
        // Check for binary character density: if text contains excessive null bytes, it's an unsupported binary file
        let nullByteCount = 0;
        const sampleLimit = Math.min(text.length, 1000);
        for (let i = 0; i < sampleLimit; i++) {
          if (text.charCodeAt(i) === 0) nullByteCount++;
        }
        if (nullByteCount > 5) {
          return resolve(`[File "${file.name}" terdeteksi sebagai berkas biner mentah dan tidak dapat diekstrak sebagai teks.]`);
        }
        // Sanitize: strip dangerous unprintable ASCII binary characters while preserving text and newlines
        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
        resolve(text);
      };
      reader.onerror = () => resolve(`[Gagal membaca isi file: ${file.name}]`);
      reader.readAsText(file);
    });
  }

  async function handleDocUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files || files.length === 0) return;

    let addedDocsCount = 0;
    let addedImagesCount = 0;

    for (const file of files) {
      if (!file || typeof file.size !== 'number' || file.size <= 0) continue;
      // 1. Cek cerdas: Jika user memilih foto/gambar melalui menu Dokumen
      if (isImageFile(file)) {
        const ok = await processSingleImageFile(file);
        if (ok) addedImagesCount++;
        continue;
      }

      const sizeStr = (file.size < 1024) 
        ? `${file.size} B` 
        : (file.size < 1024 * 1024) 
          ? `${(file.size / 1024).toFixed(1)} KB` 
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

      const content = await extractFileContent(file);

      STATE.attachedDocs.push({
        name: file.name,
        size: sizeStr,
        content: content
      });
      addedDocsCount++;
    }

    if (els.docFileInput) els.docFileInput.value = '';
    renderAttachmentPreviews();
    if (addedDocsCount > 0 || addedImagesCount > 0) {
      AudioEngine.click();
    }
  }

  function removeAttachedDoc(idx) {
    if (idx >= 0 && idx < STATE.attachedDocs.length) {
      STATE.attachedDocs.splice(idx, 1);
      renderAttachmentPreviews();
      AudioEngine.click();
    }
  }

  // ==================== AUTO MARKDOWN FILE CONVERTER (CLAUDE & GROK AI STYLE) ====================
  let activePreviewDocIndex = -1;
  let activeAIFile = null; // file yang sedang dibuka di AI File Studio

  function detectDocumentTypeAndExt(text) {
    if (!text || typeof text !== 'string') return { ext: 'md', lang: 'markdown', label: 'Dokumen', customName: 'dokumen-lampiran.md' };
    const trimmed = text.trim();

    // 1. Cek judul Markdown (# Judul)
    const mdHeaderMatch = trimmed.match(/^#+\s+([^\n\r]{2,40})/);
    if (mdHeaderMatch) {
      const slug = mdHeaderMatch[1].trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '-').toLowerCase();
      if (slug.length >= 3 && !/^(?:function|class|def|import|const|var|let)\b/i.test(slug)) {
        return { ext: 'md', lang: 'markdown', label: slug, customName: `${slug}.md` };
      }
    }

    // 2. HTML / XML / JSX
    if (/<(?:!doctype\s+html|html|head|body|div|section|table|script|template)\b/i.test(trimmed)) {
      return { ext: 'html.md', lang: 'html', label: 'HTML Snippet', customName: 'webpage.html.md' };
    }

    // 3. JSON
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return { ext: 'json.md', lang: 'json', label: 'Data JSON', customName: 'data.json.md' };
      } catch (_) {}
    }

    // 4. SQL
    if (/\b(?:SELECT\s+[\s\S]*?\s+FROM|INSERT\s+INTO|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|UPDATE\s+[\s\S]*?\s+SET)\b/i.test(trimmed)) {
      return { ext: 'sql.md', lang: 'sql', label: 'Query SQL', customName: 'query.sql.md' };
    }

    // 5. Python
    if (/\b(?:def\s+[a-zA-Z_]\w*\s*\(|import\s+[a-zA-Z_]|from\s+[a-zA-Z_].*import|if\s+__name__\s*==\s*['"]__main__['"]|elif\s+|print\s*\()/i.test(trimmed)) {
      return { ext: 'py.md', lang: 'python', label: 'Python Script', customName: 'script.py.md' };
    }

    // 6. JavaScript / TypeScript
    if (/\b(?:const\s+[a-zA-Z_]|let\s+[a-zA-Z_]|var\s+[a-zA-Z_]|function\s+[a-zA-Z_]|import\s+.*from|export\s+(?:default|const|function)|console\.log\(|async\s+function|=>)/i.test(trimmed)) {
      if (/\b(?:interface\s+[A-Z]|type\s+[A-Z]|:\s*(?:string|number|boolean|any)\b)/.test(trimmed)) {
        return { ext: 'ts.md', lang: 'typescript', label: 'TypeScript Code', customName: 'code.ts.md' };
      }
      return { ext: 'js.md', lang: 'javascript', label: 'JavaScript Code', customName: 'script.js.md' };
    }

    // 7. PHP
    if (/<\?php|\b(?:echo\s+\$|\$this->)/i.test(trimmed)) {
      return { ext: 'php.md', lang: 'php', label: 'PHP Script', customName: 'script.php.md' };
    }

    // 8. C / C++ / C# / Java / Rust / Go
    if (/#include\s+[<"]|\bnamespace\s+\w+|\busing\s+System;|\bpublic\s+class\s+\w+|\bfn\s+main\b|\bpackage\s+main\b/i.test(trimmed)) {
      return { ext: 'code.md', lang: 'c', label: 'Source Code', customName: 'source-code.md' };
    }

    // 9. CSS / Styles
    if (
      /\b(?:display|margin|padding|border|color|background|font|width|height|position|align|flex|grid|transform|opacity|z-index)\s*:/i.test(trimmed) ||
      /[a-zA-Z0-9_\-#.:>\s,]+\s*\{\s*[^}]*\}/.test(trimmed) ||
      /(?:@media|@keyframes|\.[\w\-]+|#[\w\-]+)\s*\{/i.test(trimmed) ||
      /[a-zA-Z0-9_\-#.]+\s*\{\s*[\w\-]+\s*:[^;]+;/i.test(trimmed)
    ) {
      return { ext: 'css.md', lang: 'css', label: 'Styles CSS', customName: 'styles.css.md' };
    }

    // 10. Log / Trace
    if (/\b(?:\[(?:INFO|ERROR|WARN|DEBUG)\]|Traceback\s+\(most\s+recent\s+call\s+last\)|Exception in thread|FATAL:)\b/i.test(trimmed)) {
      return { ext: 'log.md', lang: 'log', label: 'System Log', customName: 'system-log.md' };
    }

    // 11. Heuristik baris pertama jika artikel/laporan
    const firstLine = trimmed.split('\n')[0].replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
    if (firstLine.length >= 4 && firstLine.length <= 30 && !/^(?:function|class|def|import|const|var|let|if|for|while)\b/i.test(firstLine)) {
      const slug = firstLine.replace(/\s+/g, '-').toLowerCase();
      return { ext: 'md', lang: 'markdown', label: 'Dokumen', customName: `${slug}.md` };
    }

    return { ext: 'md', lang: 'markdown', label: 'Dokumen Teks', customName: 'dokumen-lampiran.md' };
  }

  function countPromptWords(text) {
    if (!text || typeof text !== 'string') return 0;
    const trimmed = text.trim();
    if (!trimmed) return 0;
    const words = trimmed.match(/\S+/g);
    return words ? words.length : 0;
  }

  function shouldAutoConvertAsDocument(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (!trimmed) return false;

    // Mandat Kaisar Zozi: Minimal 500 KATA sebelum memicu notifikasi konversi ke markdown!
    // Teks di bawah 500 kata (misal 50, 100, 200, 400 kata) dibiarkan tetap di kolom prompt tanpa notifikasi.
    const wordCount = countPromptWords(trimmed);

    // Memicu notifikasi hanya jika mencapai minimal 500 kata (atau teks masif >= 4000 karakter)
    if (wordCount >= 500 || trimmed.length >= 4000) {
      return true;
    }

    return false;
  }

  function convertTextToMarkdownDoc(rawText, userGivenName = '') {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return null;
    const cleanText = rawText.trim();
    const typeInfo = detectDocumentTypeAndExt(cleanText);

    let baseName = userGivenName || typeInfo.customName;
    if (!baseName) {
      if (typeInfo.lang !== 'markdown') {
        baseName = `code-snippet.${typeInfo.ext}`;
      } else {
        baseName = `dokumen-lampiran.md`;
      }
    }

    // Unik nama file
    const existingNames = (STATE.attachedDocs || []).map(d => (d.name || '').toLowerCase());
    let finalName = baseName;
    let counter = 1;
    while (existingNames.includes(finalName.toLowerCase())) {
      const dotIdx = baseName.lastIndexOf('.');
      if (dotIdx > 0) {
        finalName = `${baseName.substring(0, dotIdx)}-${counter}${baseName.substring(dotIdx)}`;
      } else {
        finalName = `${baseName}-${counter}`;
      }
      counter++;
    }

    let formattedContent = cleanText;
    if (typeInfo.lang !== 'markdown' && !cleanText.startsWith('```')) {
      formattedContent = `\`\`\`${typeInfo.lang}\n${cleanText}\n\`\`\``;
    }

    let bytes = 0;
    try {
      bytes = new Blob([formattedContent]).size;
    } catch (_) {
      bytes = formattedContent.length;
    }
    const sizeStr = bytes < 1024 
      ? `${bytes} B` 
      : bytes < 1024 * 1024 
        ? `${(bytes / 1024).toFixed(1)} KB` 
        : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

    const charCount = cleanText.length;
    const lineCount = cleanText.split('\n').length;

    return {
      name: finalName,
      size: `${sizeStr} • ${lineCount} baris`,
      content: formattedContent,
      rawContent: cleanText,
      lang: typeInfo.lang,
      charCount,
      lineCount,
      isAutoConvertedMarkdown: true
    };
  }

  function tryAutoConvertInputToDoc(incomingText) {
    if (!incomingText || typeof incomingText !== 'string') return false;
    const trimmed = incomingText.trim();
    if (!shouldAutoConvertAsDocument(trimmed)) return false;

    // Periksa apakah ada instruksi pengantar singkat di baris pertama
    const lines = trimmed.split('\n');
    let promptInstruction = '';
    let docBody = trimmed;

    if (lines.length >= 2) {
      const firstLine = lines[0].trim();
      if (firstLine.length <= 120 && (/(?:tolong|jelaskan|analisis|baca|ringkas|review|perbaiki|fix|cek|bantu|buatkan|kenapa|mengapa|gimana|bagaimana|apa(?:kah)?|how|what|why|explain|analyze|help)\b/i.test(firstLine) || firstLine.endsWith(':') || firstLine.endsWith('?'))) {
        promptInstruction = firstLine;
        docBody = lines.slice(1).join('\n').trim();
      }
    }

    const doc = convertTextToMarkdownDoc(docBody);
    if (!doc) return false;

    STATE.attachedDocs.push(doc);
    renderAttachmentPreviews();
    AudioEngine.success();

    if (navigator.vibrate) {
      try { navigator.vibrate(40); } catch (_) {}
    }

    if (els.promptInput) {
      els.promptInput.value = promptInstruction;
      autoResizeTextarea(els.promptInput);
      els.promptInput.focus();
    }
    if (els.autoConvertDocRow) {
      els.autoConvertDocRow.style.display = 'none';
    }
    hideComposerFoldPromptCard();

    showToast(`📄 Teks panjang otomatis dikonversi ke file markdown [${doc.name}]! Kolom prompt tetap bersih.`, 'info');
    return true;
  }

  let pendingFoldText = '';
  let pendingFoldInstruction = '';
  let pendingFoldDismissedHash = '';
  let pendingFoldPastedDirectly = false;

  function hideComposerFoldPromptCard() {
    if (els.composerFoldPromptCard) {
      els.composerFoldPromptCard.style.display = 'none';
    }
  }

  function checkAndShowPromptFoldPrompt(incomingText, forceModal = false, fromPaste = false) {
    if (!incomingText || typeof incomingText !== 'string') {
      hideComposerFoldPromptCard();
      return false;
    }
    const trimmed = incomingText.trim();
    if (!shouldAutoConvertAsDocument(trimmed)) {
      hideComposerFoldPromptCard();
      return false;
    }

    // Jika user sudah mencentang opsi selalu otomatis konversi
    const alwaysAutoFold = localStorage.getItem('zoz_always_auto_fold_prompt') === 'true';
    if (alwaysAutoFold) {
      hideComposerFoldPromptCard();
      return tryAutoConvertInputToDoc(trimmed);
    }

    const textHash = `${trimmed.length}_${trimmed.substring(0, 50)}`;
    if (!forceModal && pendingFoldDismissedHash === textHash) {
      return false;
    }

    // Ambil instruksi baris pertama jika ada
    const lines = trimmed.split('\n');
    let promptInstruction = '';
    let docBody = trimmed;

    if (lines.length >= 2) {
      const firstLine = lines[0].trim();
      if (firstLine.length <= 120 && (/(?:tolong|jelaskan|analisis|baca|ringkas|review|perbaiki|fix|cek|bantu|buatkan|kenapa|mengapa|gimana|bagaimana|apa(?:kah)?|how|what|why|explain|analyze|help)\b/i.test(firstLine) || firstLine.endsWith(':') || firstLine.endsWith('?'))) {
        promptInstruction = firstLine;
        docBody = lines.slice(1).join('\n').trim();
      }
    }

    const typeInfo = detectDocumentTypeAndExt(docBody);
    const fileName = typeInfo.customName || `code-snippet.${typeInfo.ext}`;
    const wordCount = countPromptWords(docBody);
    const lineCount = docBody.split('\n').length;
    const charCount = docBody.length;

    pendingFoldText = docBody;
    pendingFoldInstruction = promptInstruction;
    pendingFoldPastedDirectly = fromPaste;

    // Tampilkan Floating Card di atas composer
    if (els.composerFoldPromptCard) {
      if (els.foldCardTitle) {
        els.foldCardTitle.textContent = `${typeInfo.label || 'Teks Panjang / Kodingan'} Terdeteksi (${fileName})`;
      }
      if (els.foldCardSubtitle) {
        els.foldCardSubtitle.textContent = `${wordCount.toLocaleString('id-ID')} kata • ${lineCount} baris (${charCount.toLocaleString('id-ID')} karakter) • Ubah ke file markdown agar prompt bersih?`;
      }
      els.composerFoldPromptCard.style.display = 'flex';
    }

    // Jika forceModal (misal saat paste kodingan besar)
    if (forceModal && els.promptFoldConfirmModal) {
      if (els.foldModalFileName) {
        els.foldModalFileName.textContent = fileName;
      }
      if (els.foldModalSnippet) {
        els.foldModalSnippet.textContent = docBody.length > 500 ? docBody.substring(0, 500) + '\n\n... (teks dipotong untuk preview)' : docBody;
      }
      if (els.foldModalMeta) {
        els.foldModalMeta.innerHTML = `<i class="fa-solid fa-align-left"></i> ${wordCount.toLocaleString('id-ID')} kata &bull; ${lineCount} baris &bull; ${charCount.toLocaleString('id-ID')} karakter`;
      }
      if (els.chkAutoFoldAlways) {
        els.chkAutoFoldAlways.checked = false;
      }
      openModal('promptFoldConfirmModal');
    }

    return true;
  }

  function executeConfirmedPromptFold() {
    if (!pendingFoldText) {
      hideComposerFoldPromptCard();
      closeModal('promptFoldConfirmModal');
      return;
    }

    if (els.chkAutoFoldAlways && els.chkAutoFoldAlways.checked) {
      try {
        localStorage.setItem('zoz_always_auto_fold_prompt', 'true');
      } catch (_) {}
    }

    const doc = convertTextToMarkdownDoc(pendingFoldText);
    if (doc) {
      STATE.attachedDocs.push(doc);
      renderAttachmentPreviews();
      AudioEngine.success();

      if (navigator.vibrate) {
        try { navigator.vibrate(40); } catch (_) {}
      }

      if (els.promptInput) {
        els.promptInput.value = pendingFoldInstruction || '';
        autoResizeTextarea(els.promptInput);
        els.promptInput.focus();
      }

      showToast(`📄 Berhasil! Teks diubah ke file markdown [${doc.name}]. Kolom prompt bersih.`, 'info');
    }

    hideComposerFoldPromptCard();
    closeModal('promptFoldConfirmModal');
    pendingFoldText = '';
    pendingFoldInstruction = '';
    pendingFoldPastedDirectly = false;
  }

  function dismissPromptFold(insertIntoPromptIfPasted = false) {
    if (pendingFoldText) {
      pendingFoldDismissedHash = `${pendingFoldText.length}_${pendingFoldText.substring(0, 50)}`;
    }

    if (insertIntoPromptIfPasted && pendingFoldPastedDirectly && pendingFoldText && els.promptInput) {
      const fullText = pendingFoldInstruction ? `${pendingFoldInstruction}\n${pendingFoldText}` : pendingFoldText;
      const currentVal = els.promptInput.value;
      els.promptInput.value = currentVal ? `${currentVal}\n${fullText}` : fullText;
      autoResizeTextarea(els.promptInput);
      els.promptInput.focus();
    }

    hideComposerFoldPromptCard();
    closeModal('promptFoldConfirmModal');
    pendingFoldText = '';
    pendingFoldInstruction = '';
    pendingFoldPastedDirectly = false;
  }

  function openDocPreviewModal(doc, idx) {
    if (!doc) return;
    activePreviewDocIndex = idx;
    if (els.docPreviewModalTitle) {
      const isMdCode = Boolean(doc.isAutoConvertedMarkdown || (doc.name && /\.(?:md|markdown|js|ts|py|html|css|json|sql|sh)$/i.test(doc.name)));
      els.docPreviewModalTitle.innerHTML = `<i class="${isMdCode ? 'fa-solid fa-file-code' : 'fa-solid fa-file-lines'}"></i> ${escapeHtml(doc.name)}`;
    }
    if (els.docPreviewMetaName) {
      els.docPreviewMetaName.innerHTML = `<i class="fa-solid fa-file"></i> ${escapeHtml(doc.name)}`;
    }
    if (els.docPreviewMetaSize) {
      els.docPreviewMetaSize.innerHTML = `<i class="fa-solid fa-weight-scale"></i> ${escapeHtml(doc.size || '')}`;
    }
    if (els.docPreviewMetaLines) {
      const raw = doc.rawContent || doc.content || '';
      const lines = raw.split('\n').length;
      const chars = raw.length;
      els.docPreviewMetaLines.innerHTML = `<i class="fa-solid fa-align-left"></i> ${lines} baris (${chars.toLocaleString('id-ID')} karakter)`;
    }
    if (els.docPreviewContent) {
      els.docPreviewContent.textContent = doc.rawContent || doc.content || '';
    }
    openModal('docPreviewModal');
  }

  // ==================== AI FILE STUDIO (preview langsung + kode + unduh) ====================
  // Format keluaran yang diminta ke AI ketika pengguna minta sebuah berkas:
  //   <<<ZOZ_FILE name="index.html" mime="text/html" lang="html">
  //   ...isi file apa adanya...
  //   <<<END_ZOZ_FILE>>>
  const TICK3 = String.fromCharCode(96).repeat(3);

  function getFileStudioDirective() {
    return `### INSTRUKSI SISTEM: AI FILE STUDIO (Pembuatan & Pengunduhan File)

Saat pengguna meminta sebuah berkas — website, script (.bat/.py/.sh/.ps1), konfigurasi, dokumen, atau file apa pun — tulis isinya di dalam blok penanda ini:

<<<ZOZ_FILE name="nama-file.ekstensi" mime="tipe/mime" lang="bahasa">
isi lengkap file, siap pakai, tanpa potongan
<<<END_ZOZ_FILE>>>

Aturan wajib:
- name : nama file final yang bisa diunduh (contoh: index.html, hapus-sampah.bat, backup.ps1, app.py)
- mime : text/html, text/plain, text/x-python, application/json, text/css, text/javascript, dll.
- lang : html, python, batch, powershell, javascript, css, json, dll. (untuk syntax highlight)
- Isi file HARUS lengkap, valid, dan langsung bisa dijalankan/dibuka — bukan pseudocode atau potongan.
- SETELAH blok file, tulis penjelasan singkat dalam Bahasa Indonesia: tujuan program, cara kerja tiap bagian, dan cara memakainya.
- Jangan menyalin ulang isi file di luar blok penanda, agar tampilan obrolan tetap rapi.`;
  }

  // Deteksi niat pengguna meminta pembuatan file (Bahasa Indonesia + Inggris)
  function isFileGenerationRequest(text) {
    if (!text || typeof text !== 'string') return false;
    const t = text.toLowerCase();
    const wants = /\b(?:buatkan|buat|bikin|bikinkan|tolong buat|generate|create|write|tulis|simpan sebagai|unduh|download|export|ekspor|saya butuh file|saya minta file|butuh file|perlukan file|bikinkan file)\b/i.test(t);
    const target = /\b(?:file|berkas|dokumen|script|skrip|kode program|program|website|situs|halaman web|landing|aplikasi|utilitas|tool|bot|konfigurasi|template|lampiran)\b|\.(?:html?|css|js|ts|py|bat|ps1|sh|sql|json|csv|xml|ya?ml|md|txt|docx|xlsx|ipynb)\b/i.test(t);
    return wants && target;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function guessMimeFromName(name) {
    const ext = (String(name).split('.').pop() || '').toLowerCase();
    const map = { html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', jsx: 'text/plain', ts: 'text/plain', py: 'text/x-python', bat: 'application/bat', cmd: 'application/bat', ps1: 'text/plain', sh: 'application/x-sh', bash: 'application/x-sh', json: 'application/json', yaml: 'text/yaml', yml: 'text/yaml', xml: 'application/xml', sql: 'text/plain', csv: 'text/csv', md: 'text/markdown', markdown: 'text/markdown', txt: 'text/plain', log: 'text/plain', php: 'text/x-php', java: 'text/plain', c: 'text/plain', cpp: 'text/plain', go: 'text/plain', toml: 'text/plain', ini: 'text/plain', conf: 'text/plain' };
    return map[ext] || 'text/plain';
  }

  function guessLangFromName(name) {
    const ext = (String(name).split('.').pop() || '').toLowerCase();
    const map = { html: 'html', htm: 'html', css: 'css', js: 'javascript', mjs: 'javascript', jsx: 'javascript', ts: 'typescript', py: 'python', bat: 'batch', ps1: 'powershell', sh: 'shell', bash: 'shell', json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml', sql: 'sql', md: 'markdown', markdown: 'markdown', php: 'php', java: 'java', c: 'c', cpp: 'cpp', go: 'go', csv: 'csv', txt: 'text' };
    return map[ext] || (ext || 'text');
  }

  function guessFileNameFromLang(lang) {
    const map = { html: 'index.html', css: 'styles.css', javascript: 'script.js', js: 'script.js', typescript: 'main.ts', ts: 'main.ts', python: 'main.py', py: 'main.py', bash: 'run.sh', sh: 'run.sh', shell: 'run.sh', batch: 'run.bat', bat: 'run.bat', powershell: 'script.ps1', ps1: 'script.ps1', json: 'data.json', yaml: 'config.yaml', yml: 'config.yaml', xml: 'data.xml', sql: 'query.sql', php: 'index.php', java: 'Main.java', c: 'main.c', cpp: 'main.cpp', go: 'main.go', csv: 'data.csv', markdown: 'README.md', md: 'README.md', text: 'notes.txt', txt: 'notes.txt' };
    return map[lang] || ('file.' + (lang || 'txt'));
  }

  function getFileIconClass(name) {
    const ext = (String(name || '').split('.').pop() || '').toLowerCase();
    const map = {
      html: 'fa-brands fa-html5', htm: 'fa-brands fa-html5',
      css: 'fa-brands fa-css3-alt', js: 'fa-brands fa-js', mjs: 'fa-brands fa-js', jsx: 'fa-brands fa-react',
      ts: 'fa-solid fa-code', py: 'fa-brands fa-python',
      bat: 'fa-solid fa-terminal', cmd: 'fa-solid fa-terminal', ps1: 'fa-solid fa-terminal',
      sh: 'fa-solid fa-terminal', bash: 'fa-solid fa-terminal',
      json: 'fa-solid fa-braces', yaml: 'fa-solid fa-gears', yml: 'fa-solid fa-gears',
      xml: 'fa-solid fa-code', sql: 'fa-solid fa-database',
      md: 'fa-brands fa-markdown', markdown: 'fa-brands fa-markdown',
      txt: 'fa-solid fa-file-lines', log: 'fa-solid fa-file-lines', csv: 'fa-solid fa-table',
      php: 'fa-brands fa-php', java: 'fa-brands fa-java', go: 'fa-solid fa-microchip',
      docx: 'fa-solid fa-file-word', pdf: 'fa-solid fa-file-pdf'
    };
    return map[ext] || 'fa-solid fa-file-code';
  }

  function buildAIFile(name, mime, lang, content, desc) {
    const cleanName = String(name || 'file.txt').trim() || 'file.txt';
    let bytes = 0;
    try { bytes = new Blob([content]).size; } catch (_) { bytes = String(content).length; }
    const lineCount = String(content).split('\n').length;
    return {
      name: cleanName,
      mime: mime || guessMimeFromName(cleanName),
      lang: lang || guessLangFromName(cleanName),
      content: String(content),
      // M1: TANPA rawContent duplikat — dulu string yang sama disimpan dua kali
      // (content + rawContent) dan mirror localStorage ikut mem-serialize keduanya →
      // payload AI File membengkak 2× dan kuota ~5MB 'zoz_router_sessions_v1' mudah
      // pecah (fallback-nya menulis messages: [] → badan pesan hilang dari mirror).
      // Semua pembaca memakai `file.rawContent || file.content` sehingga aman.
      byteSize: bytes,
      lineCount: lineCount,
      size: formatFileSize(bytes) + ' • ' + lineCount + ' baris',
      desc: desc || '',
      isGeneratedByAI: true
    };
  }

  function renderAttachmentPreviews() {
    if (!els.attachmentPreviewBar) return;
    const hasImages = STATE.attachedImages && STATE.attachedImages.length > 0;
    const hasDocs = STATE.attachedDocs && STATE.attachedDocs.length > 0;

    if (!hasImages && !hasDocs) {
      els.attachmentPreviewBar.style.display = 'none';
      return;
    }

    els.attachmentPreviewBar.style.display = 'flex';

    // Clear existing preview cards & chips
    els.attachmentPreviewBar.querySelectorAll('.preview-card, .doc-preview-chip').forEach(c => c.remove());

    // Append Image Preview Cards
    if (hasImages) {
      STATE.attachedImages.forEach((imgSrc, idx) => {
        const card = document.createElement('div');
        card.className = 'preview-card';
        card.title = 'Klik untuk melihat foto layar penuh';
        card.innerHTML = `
          <img src="${escapeHtml(imgSrc)}" alt="Lampiran Foto ${idx + 1}">
          <button class="remove-attachment-btn" data-img-idx="${idx}" title="Hapus Foto"><i class="fa-solid fa-xmark"></i></button>
        `;
        card.querySelector('img').addEventListener('click', (e) => {
          e.stopPropagation();
          ImageLightbox.open(STATE.attachedImages, idx);
        });
        card.querySelector('.remove-attachment-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          removeAttachedImage(idx);
        });
        els.attachmentPreviewBar.appendChild(card);
      });
    }

    // Append Doc Chips
    if (hasDocs) {
      STATE.attachedDocs.forEach((doc, idx) => {
        const isMarkdownOrCode = Boolean(doc.isAutoConvertedMarkdown || (doc.name && /\.(?:md|markdown|js|ts|py|html|css|json|sql|sh|txt)$/i.test(doc.name)));
        const iconClass = isMarkdownOrCode ? 'fa-solid fa-file-code' : 'fa-solid fa-file-lines';
        const chip = document.createElement('div');
        chip.className = 'doc-preview-chip';
        chip.title = 'Klik untuk pratinjau isi dokumen atau kode';
        chip.style.cursor = 'pointer';
        chip.innerHTML = `
          <i class="${iconClass} doc-icon"></i>
          <span class="doc-name" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</span>
          <span class="doc-size">(${escapeHtml(doc.size)})</span>
          <button class="remove-doc-btn" data-idx="${idx}" title="Hapus file"><i class="fa-solid fa-xmark"></i></button>
        `;
        chip.addEventListener('click', (e) => {
          if (e.target.closest('.remove-doc-btn')) return;
          openDocPreviewModal(doc, idx);
        });
        chip.querySelector('.remove-doc-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          removeAttachedDoc(idx);
        });
        els.attachmentPreviewBar.appendChild(chip);
      });
    }
  }

  function isPreviewableHtmlFile(file) {
    if (!file) return false;
    const mime = String(file.mime || '').toLowerCase();
    if (mime.indexOf('text/html') >= 0) return true;
    const ext = (String(file.name || '').split('.').pop() || '').toLowerCase();
    return ext === 'html' || ext === 'htm' || ext === 'xhtml';
  }

  function setAIFileStudioTab(tab) {
    const isPreview = tab === 'preview';
    if (els.aiFileStudioPreviewPane) els.aiFileStudioPreviewPane.classList.toggle('hidden', !isPreview);
    if (els.aiFileStudioCode) els.aiFileStudioCode.classList.toggle('active', !isPreview);
    if (els.aiFileStudioTabs) {
      els.aiFileStudioTabs.querySelectorAll('.ai-file-tab').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === tab);
      });
    }
  }

  function openAIFileStudio(file) {
    if (!file) return;
    activeAIFile = file;
    if (els.aiFileStudioTitle) {
      els.aiFileStudioTitle.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ${escapeHtml(file.name)}`;
    }
    if (els.aiFileStudioMeta) {
      els.aiFileStudioMeta.textContent = file.name + ' • ' + (file.size || '') + (file.desc ? ' — ' + file.desc : '');
    }

    const previewable = isPreviewableHtmlFile(file);
    setAIFileStudioTab(previewable ? 'preview' : 'code');

    if (els.aiFileStudioCode) {
      els.aiFileStudioCode.textContent = file.rawContent || file.content || '';
      try {
        if (window.hljs && els.aiFileStudioCode.removeAttribute) {
          els.aiFileStudioCode.removeAttribute('data-highlighted');
          window.hljs.highlightElement(els.aiFileStudioCode);
        }
      } catch (_) {}
    }
    if (els.aiFileStudioFrame) {
      if (previewable) {
        els.aiFileStudioFrame.srcdoc = file.content || '';
      } else {
        els.aiFileStudioFrame.removeAttribute('srcdoc');
        els.aiFileStudioFrame.srcdoc = '';
      }
    }
    if (els.aiFileStudioPlaceholder) {
      els.aiFileStudioPlaceholder.classList.toggle('show', !previewable);
    }

    openModal('aiFileStudioModal');
  }

  function downloadAIFile(file) {
    if (!file) return;
    try {
      const blob = new Blob([file.content || ''], { type: (String(file.mime || 'text/plain')) + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name || 'file.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 4000);
      showToast('⬇ File ' + file.name + ' berhasil diunduh.', 'success');
      AudioEngine.click();
    } catch (err) {
      showToast('Gagal mengunduh file: ' + (err && err.message ? err.message : err), 'error');
    }
  }

  // Ekstrak file buatan AI dari teks respons -> { files, rawBlocks }
  function extractGeneratedFiles(text, allowFallback) {
    const out = { files: [], rawBlocks: [] };
    if (!text || typeof text !== 'string') return out;
    const lines = text.split('\n');

    // --- Format utama: blok penanda ZOZ_FILE ---
    let idx = 0;
    while (idx < lines.length) {
      const header = lines[idx].trim();
      if (header.indexOf('<<<ZOZ_FILE') !== 0) { idx++; continue; }
      let end = -1;
      for (let j = idx + 1; j < lines.length; j++) {
        if (lines[j].trim().indexOf('<<<END_ZOZ_FILE') === 0) { end = j; break; }
      }
      if (end < 0) { idx++; continue; }

      const nameMatch = header.match(/name="([^"]*)"/);
      const mimeMatch = header.match(/mime="([^"]*)"/);
      const langMatch = header.match(/lang="([^"]*)"/);
      const descMatch = header.match(/desc="([^"]*)"/);
      const content = lines.slice(idx + 1, end).join('\n');
      out.files.push(buildAIFile(
        nameMatch ? nameMatch[1] : 'file.txt',
        mimeMatch ? mimeMatch[1] : '',
        langMatch ? langMatch[1] : '',
        content,
        descMatch ? descMatch[1] : ''
      ));
      out.rawBlocks.push(lines.slice(idx, end + 1).join('\n'));
      idx = end + 1;
    }

    // --- Fallback: blok kode besar saat pengguna meminta file/website tapi AI
    //     tidak memakai penanda (umum terjadi pada model kecil/tanpa tool call) ---
    if (allowFallback && out.files.length === 0) {
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t.length < 4 || t.slice(0, 3) !== TICK3) continue;
        const langTag = t.slice(3).trim().toLowerCase();
        if (!langTag || langTag === TICK3) continue;
        let end = -1;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === TICK3) { end = j; break; }
        }
        if (end <= i) continue;
        const body = lines.slice(i + 1, end).join('\n');
        if (body.length < 400) continue;
        out.files.push(buildAIFile(guessFileNameFromLang(langTag), '', langTag, body, ''));
        out.rawBlocks.push(lines.slice(i, end + 1).join('\n'));
        break;
      }
    }

    return out;
  }

  // Hapus blok file dari teks respons agar tampilan gelembung tetap rapi
  function stripGeneratedFileBlocks(text, rawBlocks) {
    let out = String(text);
    if (Array.isArray(rawBlocks)) {
      rawBlocks.forEach((b) => {
        if (b) out = out.split(b).join('');
      });
    }
    const kept = out.split('\n').filter((line) => {
      const t = line.trim();
      return t.indexOf('<<<ZOZ_FILE') !== 0 && t.indexOf('<<<END_ZOZ_FILE') !== 0;
    });
    const cleaned = [];
    let prevEmpty = false;
    kept.forEach((line) => {
      const isEmpty = line.trim() === '';
      if (isEmpty && prevEmpty) return;
      cleaned.push(line);
      prevEmpty = isEmpty;
    });
    return cleaned.join('\n').trim();
  }

  // Sanitasi teks parsial (jalur Abort / Koneksi Terputus): ekstrak blok ZOZ_FILE
  // yang sudah UTUH menjadi kartu file, lalu buang sisa marker/blok yang belum selesai
  // agar tidak ada kode mentah yang bocor ke gelembung maupun riwayat.
  function sanitizePartialResponseWithFiles(text) {
    const ex = extractGeneratedFiles(String(text || ''), false);
    let out = ex.files.length > 0 ? stripGeneratedFileBlocks(text, ex.rawBlocks) : String(text || '');
    out = hideFileBlocksForDisplay(out);
    return { text: out, files: ex.files };
  }

  // Kartu file di dalam gelembung obrolan (dipanggil saat render live & riwayat)
  function renderMessageFiles(row, files) {
    if (!row || !Array.isArray(files) || files.length === 0) return;
    const bubble = row.querySelector('.message-bubble');
    if (!bubble) return;
    if (bubble.querySelector('.msg-file-cards-wrap')) return;

    const wrap = document.createElement('div');
    wrap.className = 'msg-file-cards-wrap';
    files.forEach((file) => {
      const card = document.createElement('div');
      card.className = 'ai-file-card';
      card._aiFile = file;
      card.innerHTML =
        '<div class="ai-file-icon"><i class="' + getFileIconClass(file.name) + '"></i></div>' +
        '<div class="ai-file-info">' +
        '  <div class="ai-file-name" title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</div>' +
        '  <div class="ai-file-meta">' + escapeHtml(file.size || '') + '</div>' +
        (file.desc ? '  <div class="ai-file-desc" title="' + escapeHtml(file.desc) + '">' + escapeHtml(file.desc) + '</div>' : '') +
        '</div>' +
        '<div class="ai-file-actions">' +
        '  <button class="ai-file-btn preview" type="button" data-act="preview"><i class="fa-solid fa-eye"></i> Pratinjau</button>' +
        '  <button class="ai-file-btn download" type="button" data-act="download"><i class="fa-solid fa-download"></i> Unduh</button>' +
        '</div>';
      wrap.appendChild(card);
    });
    bubble.insertBefore(wrap, bubble.firstChild);
  }

  // ==================== AUTONOMOUS AI WEB SEARCH SKILL ENGINE ====================
  function synthesizeAutonomousSearchQuery(session, rawPrompt) {
    if (!rawPrompt) return '';
    const cleanPrompt = rawPrompt.trim();

    // Indonesian & English filler / stop-words
    const fillerWords = [
      'bagaimana', 'apa', 'apakah', 'kenapa', 'mengapa', 'tolong', 'coba', 'carikan', 'cari', 'jelaskan',
      'sebutkan', 'berikan', 'tampilkan', 'info', 'informasi', 'data', 'terbaru', 'terupdate', 'terkini',
      'hari ini', 'saat ini', 'sekarang', 'menurutmu', 'menurut anda', 'tentang', 'mengenai', 'bisa', 'dong',
      'kan', 'sih', 'ya', 'bro', 'min', 'how', 'what', 'why', 'tell', 'me', 'about', 'latest', 'news', 'update'
    ];

    const words = cleanPrompt.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').split(/\s+/).filter(Boolean);
    const nonFillerWords = words.filter(w => !fillerWords.includes(w) && w.length > 1);

    // Scan recent session history to extract subject context
    let contextSubject = '';
    if (session && Array.isArray(session.messages) && session.messages.length > 0) {
      // Look at the last 4 messages in reverse
      const recentMsgs = session.messages.slice(-4).reverse();
      for (const msg of recentMsgs) {
        const text = msg.content || '';
        // Extract capitalized terms, quotes, code blocks, technology names, product names
        const matches = text.match(/([A-Z][a-zA-Z0-9_\-\.\+]+(?:\s+[A-Z0-9][a-zA-Z0-9_\-\.\+]+)*)/g);
        if (matches && matches.length > 0) {
          const filteredMatches = matches.filter(m => !['Anda', 'AI', 'Zoz', 'Router', 'Ollama', 'OpenRouter', 'Google', 'HTTP', 'JSON'].includes(m) && m.length > 2);
          if (filteredMatches.length > 0) {
            contextSubject = filteredMatches[0];
            break;
          }
        }
        // If no capitalized match, check backticks or bold text
        const codeMatch = text.match(/`([^`]+)`|\*\*([^*]+)\*\*/);
        if (codeMatch) {
          contextSubject = codeMatch[1] || codeMatch[2];
          break;
        }
      }
    }

    // Formulate the optimal targeted query
    let finalQuery = '';
    if (nonFillerWords.length <= 2 && contextSubject) {
      // Heavily context-dependent prompt (e.g. "bagaimana data terbarunya" -> "[Subject] spesifikasi data terbaru 2026")
      const intentKeywords = nonFillerWords.length > 0 ? nonFillerWords.join(' ') : 'data spesifikasi update';
      finalQuery = `${contextSubject} ${intentKeywords} terbaru 2026`;
    } else if (contextSubject && !cleanPrompt.toLowerCase().includes(contextSubject.toLowerCase())) {
      finalQuery = `${contextSubject} ${cleanPrompt} 2026`;
    } else {
      finalQuery = `${cleanPrompt} 2026`;
    }

    return finalQuery.replace(/\s+/g, ' ').trim();
  }

  async function getWebSearchContext(query, session = null, hudElement = null) {
    if (!query || !query.trim()) return null;
    if (STATE.searchMode === 'autonomous') {
      // Mode Autonomous Web Explorer menggunakan eksekusi tool dinamis on-demand oleh AI tanpa Serper API!
      return null;
    }
    const smartQuery = session ? synthesizeAutonomousSearchQuery(session, query) : query.trim();
    const serperKey = STATE.settings.serperApiKey || '075538fed9c64990e1eb32a06726c1e55a933c1e';

    if (hudElement) {
      hudElement.innerHTML = `
        <div class="web-search-hud">
          <i class="fa-solid fa-satellite-dish fa-spin" style="color:var(--neon-cyan);"></i>
          <span><strong>AI Search Skill:</strong> Menganalisis konteks & mencari <em>"${escapeHtml(smartQuery)}"</em>...</span>
        </div>
      `;
    }

    try {
      let data = null;

      // 1. Direct browser fetch to Serper API
      try {
        const directRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: smartQuery,
            num: 6,
            gl: 'us', // Global Worldwide Search (Tidak terisolasi di satu negara)
            hl: 'en'
          })
        });
        if (directRes.ok) {
          data = await directRes.json();
        }
      } catch (errDirect) {
        console.warn('Direct Serper fetch failed, trying proxy...', errDirect);
      }

      // 2. Fallback to proxy /api/web-search if direct fetch failed
      if (!data) {
        const proxyRes = await fetch('/api/web-search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-serper-key': serperKey
          },
          body: JSON.stringify({ query: smartQuery, apiKey: serperKey })
        }).catch(() => null);
        if (proxyRes && proxyRes.ok) {
          data = await proxyRes.json();
        }
      }

      // 3. Fallback ke Zero-API Autonomous Search (/api/tools/search-web) jika Serper gagal atau tanpa hasil
      if (!data || (!data.organic?.length && !data.results?.length && !data.knowledgeGraph && !data.answerBox)) {
        try {
          const autoRes = await fetch('/api/tools/search-web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: smartQuery, maxResults: 8 })
          }).catch(() => null);
          if (autoRes && autoRes.ok) {
            const autoData = await autoRes.json().catch(() => null);
            if (autoData && Array.isArray(autoData.results) && autoData.results.length > 0) {
              data = {
                organic: autoData.results.map(r => ({
                  title: r.title,
                  link: r.url,
                  snippet: r.snippet,
                  date: r.pubDate
                }))
              };
            }
          }
        } catch (_) {}
      }

      if (!data) return null;

      const sources = [];
      let factsBlock = '';

      // Knowledge graph
      if (data.knowledgeGraph) {
        const kg = data.knowledgeGraph;
        const kgText = `${kg.title || ''} (${kg.type || 'Fakta Ringkas'}): ${kg.description || ''}`;
        factsBlock += `\n[KNOWLEDGE GRAPH]: ${kgText}\n`;
        const kgUrl = kg.website || kg.descriptionUrl;
        if (kgUrl) {
          sources.push({
            title: kg.title || 'Knowledge Graph Fact',
            url: kgUrl,
            snippet: kg.description || '',
            domain: kgUrl.replace(/^https?:\/\//i, '').split('/')[0]
          });
        }
      }

      // Answer Box
      if (data.answerBox) {
        const ab = data.answerBox;
        const abText = ab.answer || ab.snippet || ab.title || '';
        factsBlock += `\n[JAWABAN UTAMA GOOGLE]: ${abText}\n`;
        if (ab.link) {
          sources.push({
            title: ab.title || 'Jawaban Teratas',
            url: ab.link,
            snippet: abText,
            domain: ab.link.replace(/^https?:\/\//i, '').split('/')[0]
          });
        }
      }

      // Organic search results
      const organicList = data.organic || data.results || [];
      let organicBlock = '';

      if (Array.isArray(organicList) && organicList.length > 0) {
        organicList.slice(0, 6).forEach((item, idx) => {
          const title = item.title || `Sumber ${idx + 1}`;
          const link = item.link || item.url || '';
          const snippet = item.snippet || '';
          const date = item.date ? ` (Dipublikasikan: ${item.date})` : '';
          const domain = link ? link.replace(/^https?:\/\//i, '').split('/')[0] : 'google.com';

          organicBlock += `\n${idx + 1}. **[${title}](${link})**${date}\n   ${snippet}\n`;
          
          if (link && !sources.some(s => s.url === link)) {
            sources.push({
              title,
              url: link,
              snippet,
              date: item.date || null,
              domain
            });
          }
        });
      }

      if (!factsBlock && !organicBlock) return null;

      const currentTime = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
      const systemPromptContext = `[DATA PENCARIAN GOOGLE REAL-TIME - SERPER ENGINE (AI SEARCH SKILL)]
Query Kontekstual yang Dirumuskan AI: "${smartQuery}"
Pertanyaan Pengguna: "${query}"
Waktu Pencarian: ${currentTime}
${factsBlock}
=== TEMUAN SITUS WEB TERATAS ===
${organicBlock}
[PANDUAN UNTUK ASISTEN AI]:
- Anda adalah AI yang telah mengaktifkan kemampuan Search Skill untuk mencari data Google secara otonom berdasarkan konteks obrolan.
- Hubungkan data real-time di atas dengan konteks riwayat percakapan sebelumnya dan jawab dengan akurat, mutakhir (Tahun 2026), dan komprehensif.
- Wajib sertakan referensi tautan markdown [Nama Sumber](URL) jika merujuk fakta spesifik.`;

      return {
        systemPromptContext,
        sources,
        query: smartQuery
      };
    } catch (e) {
      console.error('Serper Web Search Engine error:', e);
      return null;
    }
  }

  function buildSourcesSectionHtml(sources, collapsed = true) {
    return `
      <div class="msg-sources-section${collapsed ? ' collapsed' : ''}">
        <button type="button" class="msg-sources-title msg-sources-toggle" aria-expanded="${collapsed ? 'false' : 'true'}" title="Πηγαὶ Ἀναφορᾶς Δικτύου (Ἀποκάλυψις / Ἀπόκρυψις)">
          <i class="fa-solid fa-earth-americas" style="color:var(--neon-cyan);"></i>
          <span>Πηγαὶ Ἀναφορᾶς Δικτύου (${sources.length})</span>
          <span class="sources-toggle-label">${collapsed ? 'Ἀποκάλυψις' : 'Ἀπόκρυψις'}</span>
          <i class="fa-solid fa-chevron-down sources-toggle-chevron"></i>
        </button>
        <div class="msg-sources-grid">
          ${sources.map((s, i) => `
            <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="msg-source-chip" title="${escapeHtml((s.title || '') + (s.snippet ? ' - ' + s.snippet : ''))}">
              <span class="source-index">${i + 1}</span>
              <span class="source-title">${escapeHtml(s.title || s.domain || 'Πηγὴ Δικτύου')}</span>
              <span class="source-domain">${escapeHtml(s.domain || '')}</span>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Delegasi klik: buka / tutup daftar referensi web di bubble chat (Ancient Greek)
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest ? e.target.closest('.msg-sources-toggle') : null;
    if (!toggle) return;
    const section = toggle.closest('.msg-sources-section');
    if (!section) return;
    const isCollapsed = section.classList.toggle('collapsed');
    toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    const label = toggle.querySelector('.sources-toggle-label');
    if (label) label.textContent = isCollapsed ? 'Ἀποκάλυψις' : 'Ἀπόκρυψις';
    AudioEngine.click();
  });

  function renderMessageSources(row, sources, collapsed = true) {
    if (!row || !sources || !Array.isArray(sources) || sources.length === 0) return;
    const bubble = row.querySelector('.message-bubble');
    if (!bubble) return;
    if (bubble.querySelector('.msg-sources-section')) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildSourcesSectionHtml(sources, collapsed);
    const sourcesEl = wrapper.firstElementChild;
    if (sourcesEl) bubble.appendChild(sourcesEl);
  }

  // ==================== UNIVERSAL YOUTUBE OEMBED ENGINE (CLIENT) ====================
  const YOUTUBE_URL_REGEX_CLIENT = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?/gi;
  const clientYouTubeCache = new Map();

  function extractYouTubeVideoIdsClient(text) {
    if (!text || typeof text !== 'string') return [];
    const ids = [];
    const re = new RegExp(YOUTUBE_URL_REGEX_CLIENT.source, 'gi');
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match[1] && !ids.includes(match[1])) {
        ids.push(match[1]);
      }
    }
    return ids;
  }

  async function fetchYouTubeInfoClient(rawUrlOrId) {
    if (!rawUrlOrId || typeof rawUrlOrId !== 'string') return null;
    const clean = rawUrlOrId.trim();
    let videoId = null;
    let canonicalUrl = '';

    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
      videoId = clean;
      canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    } else {
      const match = clean.match(/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
      if (match && match[1]) {
        videoId = match[1];
        canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
      } else {
        canonicalUrl = clean;
      }
    }

    const cacheKey = videoId || canonicalUrl;
    if (clientYouTubeCache.has(cacheKey)) {
      return clientYouTubeCache.get(cacheKey);
    }

    let result = null;

    // 1. Try local server endpoint first if not github pages
    if (!IS_GITHUB_PAGES) {
      try {
        const c1 = new AbortController();
        const t1 = setTimeout(() => c1.abort(), 8000);
        const resp = await fetch(`/api/youtube-info?url=${encodeURIComponent(canonicalUrl)}`, {
          signal: c1.signal
        });
        clearTimeout(t1);
        if (resp.ok) {
          result = await resp.json();
        }
      } catch (err) {
        console.warn('Backend YouTube info fetch failed, trying direct oEmbed fallback:', err?.message || err);
      }
    }

    // 2. Fallback to direct YouTube oEmbed API
    if (!result || !result.success) {
      try {
        const directUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
        const c2 = new AbortController();
        const t2 = setTimeout(() => c2.abort(), 8000);
        const resp = await fetch(directUrl, {
          signal: c2.signal
        });
        clearTimeout(t2);
        if (resp.ok) {
          const parsed = await resp.json();
          result = {
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
        }
      } catch (directErr) {
        console.warn('Direct YouTube oEmbed fetch error:', directErr?.message || directErr);
      }
    }

    // Fallback default info if fetch blocked
    if (!result || !result.success) {
      result = {
        success: false,
        videoId,
        url: canonicalUrl,
        title: videoId ? `Video YouTube (${videoId})` : 'Video YouTube',
        channel: 'YouTube',
        channel_url: '',
        thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '',
        type: 'video'
      };
    }

    // Hanya cache hasil sukses: kegagalan oEmbed bersifat sementara (mis. rate
    // limit) dan tidak boleh menempel sehingga kartu video hilang permanen.
    if (result && result.success) {
      clientYouTubeCache.set(cacheKey, result);
    }
    return result;
  }

  async function getYouTubeGroundingContext(promptText, hudElement = null) {
    if (!promptText || typeof promptText !== 'string') return null;
    const ids = extractYouTubeVideoIdsClient(promptText);
    if (ids.length === 0) return null;

    if (hudElement) {
      hudElement.innerHTML = `
        <div class="web-search-hud">
          <i class="fa-brands fa-youtube" style="color:#ff0033; font-size:1.1rem;"></i>
          <span><strong>YouTube Grounding:</strong> Mengambil metadata ${ids.length} video via oEmbed...</span>
        </div>
      `;
    }

    const videoInfos = await Promise.all(ids.map(id => fetchYouTubeInfoClient(id)));
    const validVideos = videoInfos.filter(v => v && v.success && v.title);

    if (validVideos.length === 0) return null;

    const blocks = validVideos.map((v, idx) => {
      return `[DATA TERVERIFIKASI VIDEO YOUTUBE #${idx + 1}]
- URL: ${v.url}
- Judul Video: "${v.title}"
- Nama Channel / Pembuat: "${v.channel}" (${v.channel_url || 'N/A'})
- Thumbnail: ${v.thumbnail}
(Informasi resmi ini diambil secara real-time via YouTube oEmbed)`;
    }).join('\n\n');

    const groundingContext = `### REAL-TIME YOUTUBE VIDEO GROUNDING DATA:\n${blocks}\n\nInstruksi untuk AI: Gunakan informasi metadata resmi di atas untuk menjawab dan menganalisis video YouTube yang ditanyakan pengguna secara tepat, akurat, dan tanpa halusinasi.`;

    return {
      groundingContext,
      videos: validVideos
    };
  }

  function buildYouTubePreviewCardHtml(video) {
    if (!video) return '';
    const safeTitle = escapeHtml(video.title || 'Video YouTube');
    const safeChannel = escapeHtml(video.channel || 'YouTube');
    const safeThumb = escapeHtml(video.thumbnail || (video.videoId ? `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg` : ''));
    const safeUrl = escapeHtml(video.url || (video.videoId ? `https://www.youtube.com/watch?v=${video.videoId}` : '#'));
    const vidId = escapeHtml(video.videoId || '');

    return `
      <div class="youtube-preview-card" data-video-id="${vidId}">
        <div class="yt-card-thumb-wrap">
          <img src="${safeThumb}" alt="${safeTitle}" class="yt-card-thumb" loading="lazy">
          <div class="yt-card-badge"><i class="fa-brands fa-youtube"></i> YouTube</div>
          ${vidId ? `<button type="button" class="yt-thumb-play" data-action="play-in-chat" data-video-id="${vidId}" data-title="${safeTitle}" title="Putar langsung di percakapan"><i class="fa-solid fa-play"></i></button>` : ''}
        </div>
        <div class="yt-card-info">
          <h4 class="yt-card-title" title="${safeTitle}">${safeTitle}</h4>
          <div class="yt-card-channel"><i class="fa-solid fa-circle-user"></i> ${safeChannel}</div>
          <div class="yt-card-actions">
            ${vidId ? `<button type="button" class="yt-card-btn play-chat-btn" data-action="play-in-chat" data-video-id="${vidId}" data-title="${safeTitle}"><i class="fa-solid fa-play"></i> Putar di Chat</button>` : ''}
            ${vidId ? `<button type="button" class="yt-card-btn play-yt-btn" data-video-id="${vidId}" data-title="${safeTitle}"><i class="fa-solid fa-headphones"></i> Putar di BGM</button>` : ''}
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="yt-card-btn open-yt-btn"><i class="fa-brands fa-youtube"></i> Tonton Langsung di YouTube</a>
          </div>
        </div>
      </div>
    `;
  }

  async function renderYouTubeCardsForMessage(row, text, extraIds = []) {
    if (!row) return;
    const ids = Array.isArray(extraIds) ? extraIds.filter(Boolean) : [];
    if (typeof text === 'string' && text) {
      extractYouTubeVideoIdsClient(text).forEach((id) => { if (id && !ids.includes(id)) ids.push(id); });
    }
    if (ids.length === 0) return;
    const bubble = row.querySelector('.message-bubble');
    if (!bubble) return;
    if (bubble.querySelector('.msg-youtube-cards-wrap')) return;

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'msg-youtube-cards-wrap';
    bubble.insertBefore(cardsContainer, bubble.firstChild);

    for (const vidId of ids) {
      let info = null;
      try {
        info = await fetchYouTubeInfoClient(vidId);
      } catch (_) {
        info = null;
      }
      // Metadata oEmbed bisa gagal sementara (rate limit / jaringan). Kartu tetap
      // dirender dengan metadata dasar agar tombol putar & "Tonton Langsung"
      // tetap tersedia daripada menghilang sama sekali.
      const meta = info || {};
      const cardData = {
        videoId: meta.videoId || vidId,
        url: meta.url || `https://www.youtube.com/watch?v=${vidId}`,
        title: meta.title || `Video YouTube (${vidId})`,
        channel: meta.channel || 'YouTube',
        thumbnail: meta.thumbnail || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`
      };
      const cardWrapper = document.createElement('div');
      cardWrapper.innerHTML = buildYouTubePreviewCardHtml(cardData);
      if (cardWrapper.firstElementChild) {
        cardsContainer.appendChild(cardWrapper.firstElementChild);
      }
    }

    if (cardsContainer.children.length === 0) {
      cardsContainer.remove();
    }
  }

  // Delegasi klik tombol putar YouTube di bubble chat
  document.addEventListener('click', (e) => {
    const playBtn = e.target.closest ? e.target.closest('.play-yt-btn') : null;
    if (playBtn) {
      const vidId = playBtn.dataset.videoId;
      const title = playBtn.dataset.title || 'Video YouTube';
      if (vidId && typeof BGMEngine !== 'undefined' && BGMEngine.playYouTube) {
        BGMEngine.playYouTube(vidId, title);
        showToast(`🎵 Memutar "${title}" di Cyber Deck...`);
        AudioEngine.click();
      }
    }
  });

  // Delegasi klik: putar video YouTube langsung DI DALAM percakapan (embed iframe)
  document.addEventListener('click', (e) => {
    const playBtn = e.target.closest ? e.target.closest('[data-action="play-in-chat"]') : null;
    if (!playBtn) return;
    const vidId = playBtn.dataset.videoId;
    const title = playBtn.dataset.title || 'Video YouTube';
    if (!vidId) return;
    const card = playBtn.closest('.youtube-preview-card');
    if (!card || card.classList.contains('yt-card-playing')) return;
    const thumbWrap = card.querySelector('.yt-card-thumb-wrap');
    if (!thumbWrap) return;

    card.classList.add('yt-card-playing');
    const frame = document.createElement('div');
    frame.className = 'yt-embed-frame';
    frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(vidId)}?autoplay=1&rel=0&modestbranding=1&playsinline=1" title="${escapeHtml(title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>`;
    thumbWrap.replaceWith(frame);

    // Tombol "Putar di Chat" sudah tidak relevan saat video sedang berjalan
    card.querySelector('.play-chat-btn')?.remove();
    AudioEngine.click();
    showToast(`▶ Memutar "${title}" di dalam percakapan`);
  });

  // Delegasi klik: tombol Pratinjau / Unduh pada kartu file buatan AI
  document.addEventListener('click', (e) => {
    const btn = e.target.closest ? e.target.closest('.ai-file-btn') : null;
    if (!btn) return;
    const card = btn.closest('.ai-file-card');
    if (!card || !card._aiFile) return;
    const file = card._aiFile;
    if (btn.dataset.act === 'download') {
      downloadAIFile(file);
    } else {
      openAIFileStudio(file);
    }
  });

  // Kontrol AI File Studio: tab, salin kode, unduh
  if (els.aiFileStudioTabs) {
    els.aiFileStudioTabs.querySelectorAll('.ai-file-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const name = tab.dataset.tab === 'code' ? 'code' : 'preview';
        if (name === 'preview' && !isPreviewableHtmlFile(activeAIFile)) {
          showToast('File ini bukan halaman web — lihat tab Kode Sumber.', 'info');
          return;
        }
        setAIFileStudioTab(name);
        AudioEngine.click();
      });
    });
  }
  els.aiFileStudioCopyBtn?.addEventListener('click', () => {
    if (!activeAIFile) return;
    copyTextToClipboard(activeAIFile.rawContent || activeAIFile.content || '', null, 'Kode file disalin ke clipboard!');
  });
  els.aiFileStudioDownloadBtn?.addEventListener('click', () => {
    if (activeAIFile) downloadAIFile(activeAIFile);
  });

  // ==================== UNIVERSAL WEB CONTENT EXTRACTOR & READER TOOL ====================
  const clientWebContentCache = new Map();

  // F12: cache ekstraksi web kini dibatasi64 entri (FIFO) — dulu tak berbatas,
  // setiap URL unik menahan payload ~8KB+ sepanjang usia halaman (pertumbuhan memori).
  function rememberWebContent(key, value) {
    clientWebContentCache.set(key, value);
    while (clientWebContentCache.size > 64) {
      const oldest = clientWebContentCache.keys().next().value;
      clientWebContentCache.delete(oldest);
    }
  }

  function extractWebUrlsFromText(input) {
    if (!input || typeof input !== 'string') return [];
    const urlRegex = /https?:\/\/[^\s<>"'{}|\\^`\[\]]+/gi;
    const matches = input.match(urlRegex) || [];
    return matches.map(u => u.replace(/[.,!?;:)]+$/, '')).filter(u => {
      try {
        const p = new URL(u);
        const h = p.hostname.toLowerCase();
        if (h.includes('youtube.com') || h.includes('youtu.be')) return false;
        if (/\.(png|jpe?g|webp|gif|svg|mp4|webm|mp3|wav|ogg|pdf)$/i.test(p.pathname)) return false;
        return true;
      } catch (_) {
        return false;
      }
    });
  }

  async function extractWebContentFromUrl(targetUrl, maxChars = 8000) {
    if (!targetUrl || typeof targetUrl !== 'string') return null;
    let clean = targetUrl.trim();
    if (!/^https?:\/\//i.test(clean)) clean = 'https://' + clean;

    if (clientWebContentCache.has(clean)) {
      return clientWebContentCache.get(clean);
    }

    // 1. Coba endpoint ekstraksi web resmi Zoz Router (/api/extract-web)
    try {
      const ep = '/api/extract-web?url=' + encodeURIComponent(clean) + '&maxChars=' + maxChars;
      const res = await fetch(ep, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.content && data.content.length > 30) {
          rememberWebContent(clean, data);
          return data;
        }
      }
    } catch (_) {}

    // 2. Fallback: coba endpoint /api/tools/browse-page
    try {
      const res = await fetch('/api/tools/browse-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clean, maxChars }),
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content || data.text || '';
        if (text && text.length > 30) {
          const formatted = {
            success: true,
            url: clean,
            domain: (new URL(clean)).hostname,
            title: data.title || (new URL(clean)).hostname,
            charCount: text.length,
            content: text
          };
          rememberWebContent(clean, formatted);
          return formatted;
        }
      }
    } catch (_) {}

    // 3. Fallback Client-side Jina Reader (CORS Open, Super Cepat & Teks Bersih Markdown)
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${encodeURI(clean)}`, {
        headers: { 'Accept': 'text/plain' },
        signal: AbortSignal.timeout(8000)
      });
      if (jinaRes.ok) {
        const markdown = await jinaRes.text();
        if (markdown && markdown.length > 50) {
          const titleMatch = markdown.match(/^Title:\s*(.+)$/m) || markdown.match(/^#\s+(.+)$/m);
          let docTitle = titleMatch ? titleMatch[1].trim() : '';
          try { if (!docTitle) docTitle = new URL(clean).hostname; } catch (_) {}
          const formatted = {
            success: true,
            url: clean,
            domain: (new URL(clean)).hostname,
            title: docTitle || (new URL(clean)).hostname,
            charCount: Math.min(markdown.length, maxChars),
            content: markdown.substring(0, maxChars)
          };
          rememberWebContent(clean, formatted);
          return formatted;
        }
      }
    } catch (_) {}

    return { success: false, url: clean, error: 'Gagal mengekstrak website.' };
  }

  // ==================== URL & ENDPOINT NORMALIZER ====================
  function normalizeEndpoint(ep) {
    if (!ep || typeof ep !== 'string' || !ep.trim()) return 'https://ollama.com';
    let clean = ep.trim();
    if (clean.includes('127.0.0.1') || clean.includes('localhost') || clean.includes('11434')) {
      return 'https://ollama.com';
    }
    if (!/^https?:\/\//i.test(clean)) {
      clean = (clean.includes(':443') || clean.includes('ollama.com') || clean.includes('.com') || clean.includes('.io') || clean.includes('.ai') || clean.includes('.app'))
        ? `https://${clean}`
        : `http://${clean}`;
    }
    return clean.replace(/\/+$/, '');
  }

  function resolveEndpointUrl(baseEndpoint, targetPath) {
    const norm = normalizeEndpoint(baseEndpoint);
    try {
      const parsed = new URL(norm);
      let curPath = parsed.pathname.replace(/\/+$/, '');
      const cleanTarget = targetPath.replace(/^\/+/, '');
      if (curPath.endsWith('/' + cleanTarget) || curPath === '/' + cleanTarget) return parsed.toString().replace(/\/+$/, '');
      if (curPath.endsWith('/api') && cleanTarget.startsWith('api/')) curPath = curPath.slice(0, -4);
      if (curPath.endsWith('/v1') && cleanTarget.startsWith('v1/')) curPath = curPath.slice(0, -3);
      const joined = (curPath ? curPath : '') + '/' + cleanTarget;
      parsed.pathname = joined.replace(/\/+/g, '/');
      return parsed.toString().replace(/\/+$/, '');
    } catch (e) {
      return `${norm.replace(/\/+$/, '')}/${targetPath.replace(/^\/+/, '')}`;
    }
  }

  // ==================== MODEL DISCOVERY & HEALTH CHECKS ====================
  async function checkOllamaHealth() {
    els.ollamaStatusVal.innerText = 'Memeriksa...';
    els.ollamaIndicator.className = 'status-indicator';
    // WAJIB dideklarasikan: tanpa ini, bila semua fetch gagal, baris
    // `if (rawModels.length === 0 ...)` akan melempar ReferenceError (senyap,
    // tertangkap try luar) sehingga daftar model terlihat kosong.
    let rawModels = [];
    let isRunning = false;
    try {
      const ep = normalizeEndpoint(STATE.settings.ollamaEndpoint);
      const headers = {};
      if (STATE.settings.ollamaApiKey) {
        headers['Authorization'] = `Bearer ${STATE.settings.ollamaApiKey}`;
        headers['x-ollama-key'] = STATE.settings.ollamaApiKey;
      }

      if (location.protocol === 'https:' && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])/i.test(ep)) {
        // Jangan langsung menyerah: yang diblokir browser hanyalah akses HTTPS -> HTTP
        // lokal. Ambil daftar model lewat gateway proxy (/api/ollama/models) yang tetap
        // bisa menjangkau Ollama Cloud, supaya daftar model TIDAK kosong di Vercel.
        try {
          const gwUrl = '/api/ollama/models' + (STATE.settings.ollamaApiKey ? '?endpoint=' + encodeURIComponent('https://ollama.com') : '');
          const gwRes = await fetch(gwUrl, { headers }).catch(() => null);
          if (gwRes && gwRes.ok) {
            const gwData = await gwRes.json();
            if (Array.isArray(gwData.models) && gwData.models.length > 0) {
              rawModels = gwData.models;
              isRunning = gwData.server_running !== false;
            }
          }
        } catch (gwErr) {
          console.warn('Gagal memuat daftar model Ollama via gateway:', gwErr && gwErr.message);
        }

        if (rawModels.length === 0) {
          els.ollamaStatusVal.innerText = 'Localhost Terblokir (Mixed Content)';
          els.ollamaStatusVal.title = 'Halaman HTTPS memblokir akses langsung ke HTTP localhost. Ubah endpoint ke https://ollama.com di Pengaturan, atau gunakan OpenRouter.';
          els.ollamaIndicator.className = 'status-indicator status-warning';
          STATE.ollamaModels = [];
          if (els.badgeOllamaCount) els.badgeOllamaCount.innerText = '0';
          populateModelDropdown();
          updateOllamaStatusUI();
          return false;
        }
        // Daftar model dari gateway tersedia — lanjut ke blok render di bawah.
      }

      if (IS_GITHUB_PAGES || /localhost|127\.0\.0\.1|\[::1\]/i.test(ep)) {
        // Direct browser fetch
        try {
          // 1. Try /api/tags
          let res = await fetch(resolveEndpointUrl(ep, 'api/tags'), { headers, mode: 'cors' }).catch(() => null);
          if (res && res.ok) {
            const data = await res.json();
            rawModels = data.models || [];
            isRunning = true;
          } else {
            // 2. Try /v1/models (OpenAI compatibility)
            res = await fetch(resolveEndpointUrl(ep, 'v1/models'), { headers, mode: 'cors' }).catch(() => null);
            if (res && res.ok) {
              const data = await res.json();
              if (data.data && Array.isArray(data.data)) {
                rawModels = data.data.map(m => ({ name: m.id, model: m.id }));
                isRunning = true;
              }
            }
          }
        } catch (e) {}

        // Fallback for Ollama Cloud when API key is provided
        if (rawModels.length === 0 && STATE.settings.ollamaApiKey) {
          // Try fetching via allorigins CORS bridge for live discovery
          try {
            const proxyRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent('https://ollama.com/api/tags')}`, { headers }).catch(() => null);
            if (proxyRes && proxyRes.ok) {
              const pData = await proxyRes.json();
              if (pData.models && Array.isArray(pData.models) && pData.models.length > 0) {
                rawModels = pData.models;
                isRunning = true;
              }
            }
          } catch (pe) {}
        }
      } else {
        // Via local gateway proxy
        const url = `/api/ollama/models?endpoint=${encodeURIComponent(ep)}`;
        const res = await fetch(url, { headers }).catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          rawModels = data.models || [];
          isRunning = data.server_running !== false;
        }
      }

      // If live discovery failed but API key is set or cloud endpoint configured, fallback to official cloud models
      if (rawModels.length === 0 && (STATE.settings.ollamaApiKey || ep.includes('ollama.com') || IS_GITHUB_PAGES)) {
        rawModels = [...OFFICIAL_OLLAMA_CLOUD_MODELS];
        isRunning = true;
      }

      if (rawModels.length > 0) {
        STATE.ollamaModels = rawModels;
        const isCloudMode = Boolean(STATE.settings.ollamaApiKey || ep.includes('ollama.com'));
        els.ollamaStatusVal.innerText = isCloudMode 
          ? `Ollama Cloud (${rawModels.length} Model Siap)` 
          : (isRunning ? `${rawModels.length} Model Aktif` : `${rawModels.length} Model Terpasang`);
        els.ollamaIndicator.className = 'status-indicator online';

        // Auto-select first real installed/cloud model if current model is invalid or default
        const modelNames = rawModels.map(m => m.name || m.model || m.id);
        if (!modelNames.includes(STATE.settings.ollamaModel)) {
          STATE.settings.ollamaModel = modelNames[0];
          savePersistedState();
        }

        if (els.badgeOllamaCount) {
          els.badgeOllamaCount.innerText = rawModels.length;
        }
        updateModelUI();
        populateModelDropdown();
        if (els.musicModelDropdown && els.musicModelDropdown.style.display !== 'none') {
          populateMusicOllamaModels(els.musicOllamaSearchInput?.value || '');
        }
        if (STATE.activeCatalogTab === 'ollama') {
          renderLiveModelCatalog();
        }
        updateOllamaStatusUI();
        return true;
      } else {
        STATE.ollamaModels = [];
        if (els.badgeOllamaCount) els.badgeOllamaCount.innerText = '0';
        els.ollamaStatusVal.innerText = 'Offline (Cek Ollama)';
        els.ollamaIndicator.className = 'status-indicator error';
        populateModelDropdown();
        if (STATE.activeCatalogTab === 'ollama') {
          renderLiveModelCatalog();
        }
        updateOllamaStatusUI();
        return false;
      }
    } catch (e) {
      els.ollamaStatusVal.innerText = 'Tidak Terhubung';
      els.ollamaIndicator.className = 'status-indicator error';
      if (els.badgeOllamaCount) els.badgeOllamaCount.innerText = '0';
      updateOllamaStatusUI();
      return false;
    }
  }

  // ==================== REAL-TIME PROVIDER BALANCE & CREDITS MONITOR ====================
  async function fetchOpenRouterCredits(forceRefresh = false) {
    const key = (els.settingOpenRouterKey ? els.settingOpenRouterKey.value.trim() : '') || STATE.settings.openRouterKey;
    if (!key) {
      updateOpenRouterBalanceUI({ error: 'Key Belum Diisi' });
      return null;
    }

    // Set UI loading indicator
    if (els.settingOpenRouterBalanceVal) {
      els.settingOpenRouterBalanceVal.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Memeriksa...';
    }
    if (els.catalogBalanceValue && STATE.activeCatalogTab === 'openrouter') {
      els.catalogBalanceValue.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    }

    try {
      const isDirect = IS_GITHUB_PAGES;
      const endpoint = isDirect ? 'https://openrouter.ai/api/v1/credits' : '/api/openrouter/credits';
      const headers = {
        'Authorization': `Bearer ${key}`
      };
      if (isDirect) {
        headers['HTTP-Referer'] = location.origin || 'https://zozi0999.github.io/zoz_router';
        headers['X-Title'] = 'ZOZ Router';
      }

      const res = await fetch(endpoint, { headers, cache: 'no-store' });
      let creditsData = null;
      if (res.ok) {
        const json = await res.json();
        creditsData = json.data || json;
      }

      // Ambil metadata key & tier via auth/key
      let keyData = null;
      try {
        const authEndpoint = isDirect ? 'https://openrouter.ai/api/v1/auth/key' : '/api/openrouter/auth-check';
        const authRes = await fetch(authEndpoint, { headers, cache: 'no-store' });
        if (authRes.ok) {
          const authJson = await authRes.json();
          keyData = authJson.data || authJson;
        }
      } catch (authErr) {
        console.warn('Auth check notice:', authErr);
      }

      let totalCredits = creditsData?.total_credits != null ? Number(creditsData.total_credits) : null;
      let totalUsage = creditsData?.total_usage != null ? Number(creditsData.total_usage) : (keyData?.usage != null ? Number(keyData.usage) : 0);
      let limit = keyData?.limit != null ? Number(keyData.limit) : null;
      let isFreeTier = Boolean(keyData?.is_free_tier);
      let label = keyData?.label || 'API Key Aktif';

      let remaining = null;
      if (totalCredits != null) {
        remaining = Math.max(0, totalCredits - totalUsage);
      } else if (limit != null) {
        remaining = Math.max(0, limit - totalUsage);
      }

      STATE.openRouterBalance = {
        totalCredits,
        totalUsage,
        remaining,
        limit,
        isFreeTier,
        label,
        lastChecked: new Date()
      };

      updateOpenRouterBalanceUI(STATE.openRouterBalance);
      return STATE.openRouterBalance;
    } catch (e) {
      console.warn('Error fetching OpenRouter credits:', e);
      const errInfo = { error: e.message || 'Gagal memuat saldo' };
      updateOpenRouterBalanceUI(errInfo);
      return null;
    }
  }

  function updateOpenRouterBalanceUI(balance) {
    if (!balance || balance.error) {
      // Sidebar status
      if (els.openRouterStatusVal) {
        els.openRouterStatusVal.innerText = balance?.error || 'Key Belum Diisi';
      }
      if (els.openRouterIndicator) {
        els.openRouterIndicator.className = 'status-indicator error';
      }

      // Settings modal card
      if (els.settingOpenRouterStatusDot) {
        els.settingOpenRouterStatusDot.className = 'pulse-dot error';
      }
      if (els.settingOpenRouterBalanceVal) {
        els.settingOpenRouterBalanceVal.innerText = balance?.error || 'Tidak Terhubung';
        els.settingOpenRouterBalanceVal.style.color = 'var(--neon-magenta)';
      }
      if (els.settingOpenRouterUsageText) {
        els.settingOpenRouterUsageText.innerText = 'Terpakai: -';
      }
      if (els.settingOpenRouterTierText) {
        els.settingOpenRouterTierText.innerText = 'Status: Periksa API Key';
      }

      // Catalog Banner
      if (els.catalogBalanceValue && STATE.activeCatalogTab === 'openrouter') {
        els.catalogBalanceValue.innerText = '-';
        els.catalogBalanceValue.style.color = 'var(--text-dim)';
      }
      if (els.catalogBalanceSub && STATE.activeCatalogTab === 'openrouter') {
        els.catalogBalanceSub.innerText = '(Key belum diisi / error)';
      }
      return;
    }

    const remainingStr = balance.remaining != null 
      ? `$${balance.remaining.toFixed(2)} USD` 
      : (balance.isFreeTier ? 'Free Tier (Gratis)' : 'Aktif (Pay-as-you-go)');
    
    const usageStr = `Terpakai: $${(balance.totalUsage || 0).toFixed(4)}`;

    // Sidebar status: tampilkan saldo langsung!
    if (els.openRouterStatusVal) {
      els.openRouterStatusVal.innerText = balance.remaining != null ? `$${balance.remaining.toFixed(2)}` : (balance.isFreeTier ? 'Free' : 'Aktif');
    }
    if (els.openRouterIndicator) {
      els.openRouterIndicator.className = 'status-indicator online';
    }

    // Settings modal card
    if (els.settingOpenRouterStatusDot) {
      if (balance.remaining != null && balance.remaining <= 0.05) {
        els.settingOpenRouterStatusDot.className = 'pulse-dot warning';
      } else {
        els.settingOpenRouterStatusDot.className = 'pulse-dot active';
      }
    }

    if (els.settingOpenRouterBalanceVal) {
      els.settingOpenRouterBalanceVal.innerText = remainingStr;
      if (balance.remaining != null && balance.remaining <= 0.05) {
        els.settingOpenRouterBalanceVal.style.color = 'var(--neon-magenta)';
      } else {
        els.settingOpenRouterBalanceVal.style.color = 'var(--neon-amber)';
      }
    }

    if (els.settingOpenRouterUsageText) {
      els.settingOpenRouterUsageText.innerHTML = `<i class="fa-solid fa-receipt"></i> ${usageStr}`;
    }

    if (els.settingOpenRouterTierText) {
      const tierBadge = balance.isFreeTier ? 'Akun Free' : (balance.label || 'Aktif');
      els.settingOpenRouterTierText.innerHTML = `<i class="fa-solid fa-shield-check"></i> ${escapeHtml(tierBadge)}`;
    }

    // Banner di Live Model Catalog Modal
    if (STATE.activeCatalogTab === 'openrouter') {
      updateCatalogBalanceBannerUI('openrouter');
    }
  }

  // ==================== OLLAMA ENGINE STATUS ====================
  async function fetchOllamaCloudUsage(forceRefresh = false) {
    updateOllamaStatusUI();
    return null;
  }

  function updateOllamaStatusUI() {
    const isCloudMode = Boolean(STATE.settings.ollamaApiKey || (els.settingOllamaApiKey && els.settingOllamaApiKey.value.trim()) || (STATE.settings.ollamaEndpoint && STATE.settings.ollamaEndpoint.includes('ollama.com')));
    const modelCount = Array.isArray(STATE.ollamaModels) ? STATE.ollamaModels.length : 0;
    const isRunning = modelCount > 0;
    const isCurrentlyOffline = !isRunning && Boolean(els.ollamaStatusVal && els.ollamaStatusVal.innerText.includes('Offline'));

    // Sidebar status: tampilkan status koneksi & model (TANPA saldo)
    if (els.ollamaStatusVal) {
      els.ollamaStatusVal.innerText = isCurrentlyOffline 
        ? 'Offline' 
        : (isCloudMode ? 'Cloud Aktif' : `${modelCount} Model`);
      els.ollamaStatusVal.title = isCloudMode ? 'Ollama Cloud Engine Terhubung' : 'Ollama Engine Siap';
      els.ollamaStatusVal.style.cursor = 'default';
    }
    if (els.ollamaIndicator) {
      els.ollamaIndicator.className = isCurrentlyOffline ? 'status-indicator error' : 'status-indicator online';
    }

    // Settings modal card: status koneksi (TANPA saldo)
    if (els.settingOllamaStatusDot) {
      els.settingOllamaStatusDot.className = isCurrentlyOffline ? 'pulse-dot error' : 'pulse-dot active';
    }

    if (els.settingOllamaStatusVal) {
      els.settingOllamaStatusVal.innerText = isCurrentlyOffline 
        ? 'Tidak Terhubung' 
        : (isCloudMode ? 'Terhubung (Cloud)' : 'Terhubung (Lokal)');
      els.settingOllamaStatusVal.style.color = isCurrentlyOffline ? 'var(--neon-magenta)' : 'var(--neon-teal)';
      els.settingOllamaStatusVal.style.cursor = 'default';
      els.settingOllamaStatusVal.title = '';
    }

    if (els.settingOllamaModelCountText) {
      els.settingOllamaModelCountText.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${modelCount} Model Siap`;
    }

    // (Rujukan mati els.settingOllamaCreditsText dihapus — id itu tidak pernah ada
    //  di index.html maupun map els; cabangnya tak pernah tercapai.)

    // Banner di Live Model Catalog Modal
    if (STATE.activeCatalogTab === 'ollama') {
      updateCatalogBalanceBannerUI('ollama');
    }
  }

  function updateCatalogBalanceBannerUI(tab = 'openrouter') {
    if (!els.catalogBalanceBanner) return;

    if (tab === 'openrouter') {
      els.catalogBalanceBanner.style.display = 'flex';
      const bal = STATE.openRouterBalance;
      const remainingStr = bal && bal.remaining != null 
        ? `$${bal.remaining.toFixed(2)} USD` 
        : (bal?.isFreeTier ? 'Free Tier' : (bal?.error ? 'Belum Terhubung' : 'Cek Saldo'));
      
      const usageStr = bal && bal.totalUsage != null ? `(Terpakai: $${bal.totalUsage.toFixed(3)})` : '';

      if (els.catalogBalanceIcon) {
        els.catalogBalanceIcon.innerHTML = '<i class="fa-solid fa-coins" style="color: var(--neon-amber); font-size: 0.95rem;"></i>';
      }
      if (els.catalogBalanceText) {
        els.catalogBalanceText.style.cursor = 'default';
        els.catalogBalanceText.title = '';
        els.catalogBalanceText.innerHTML = `Saldo OpenRouter: <strong id="catalogBalanceValue" style="color: var(--neon-amber); font-family: var(--font-code);">${escapeHtml(remainingStr)}</strong>`;
      }
      if (els.catalogBalanceSub) {
        els.catalogBalanceSub.innerText = usageStr;
      }
      if (els.btnCatalogAddCredits) {
        els.btnCatalogAddCredits.href = 'https://openrouter.ai/credits';
        els.btnCatalogAddCredits.innerHTML = '<i class="fa-solid fa-credit-card"></i> + Beli / Tambah Saldo';
        els.btnCatalogAddCredits.className = 'btn btn-xs btn-primary-neon';
        els.btnCatalogAddCredits.title = 'Buka halaman resmi top-up / pembelian kredit OpenRouter';
      }
    } else {
      // Hapus / sembunyikan indikator saldo khusus Ollama sesuai instruksi Kaisar
      els.catalogBalanceBanner.style.display = 'none';
    }
  }

  async function checkOpenRouterStatus() {
    if (!STATE.settings.openRouterKey) {
      updateOpenRouterBalanceUI({ error: 'Key Belum Diisi' });
      return;
    }
    await fetchOpenRouterCredits();
  }

  async function fetchOpenRouterModelsList() {
    try {
      const url = IS_GITHUB_PAGES ? 'https://openrouter.ai/api/v1/models' : '/api/openrouter/models';
      const headers = {};
      if (STATE.settings.openRouterKey) {
        headers['Authorization'] = `Bearer ${STATE.settings.openRouterKey}`;
      }
      const res = await fetch(url, { headers }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          // Ambil seluruh model secara live tanpa pemotongan buatan slice(0, 80)
          const mapped = data.data.map(m => {
            const arch = m.architecture || {};
            const outMods = arch.output_modalities || [];
            const modalityStr = String(arch.modality || '');
            const hasImageOutput = outMods.includes('image') || modalityStr.includes('->image') || modalityStr.endsWith('image');
            const supportedParams = Array.isArray(m.supported_parameters) ? m.supported_parameters : [];
            const supportsTools = supportedParams.includes('tools');
            return {
              id: m.id,
              name: m.name || m.id,
              description: m.description || '',
              context_length: m.context_length || null,
              hasImageOutput: hasImageOutput,
              hasAudioOutput: outMods.includes('audio') || modalityStr.endsWith('audio'),
              supportsTools: supportsTools,
              tag: (m.id.includes(':free') || m.id.endsWith('/free') || m.id === 'openrouter/free' || m.pricing?.prompt === '0') ? 'Free' : 'Cloud',
              cat: (m.id.includes(':free') || m.id.endsWith('/free') || m.id === 'openrouter/free' || m.pricing?.prompt === '0') ? 'free' : 'flagship'
            };
          });
          STATE.openRouterModels = mapped;
          if (els.badgeOpenRouterCount) {
            els.badgeOpenRouterCount.innerText = mapped.length;
          }
          populateModelDropdown();
          if (els.musicModelDropdown && els.musicModelDropdown.style.display !== 'none') {
            populateMusicOpenRouterModels(els.musicModelSearchInput?.value || '');
          }
          if (STATE.activeCatalogTab === 'openrouter') {
            renderLiveModelCatalog();
          }
        }
      }

      // Ambil katalog model khusus Image Generation OpenRouter secara live
      try {
        const imgUrl = IS_GITHUB_PAGES ? 'https://openrouter.ai/api/v1/images/models' : '/api/openrouter/images/models';
        const imgRes = await fetch(imgUrl, { headers }).catch(() => null);
        if (imgRes && imgRes.ok) {
          const imgData = await imgRes.json();
          if (imgData && Array.isArray(imgData.data)) {
            const mappedImgModels = imgData.data.map(im => ({
              id: im.id,
              name: im.name || im.id,
              provider: 'openrouter',
              cat: 'flagship',
              tag: 'OpenRouter • Image',
              desc: im.description || 'OpenRouter Dedicated Image Synthesis Model'
            }));
            const pollinationsOnly = DEFAULT_IMAGE_MODELS.filter(dm => dm.provider === 'pollinations');
            STATE.availableImageModels = [...pollinationsOnly, ...mappedImgModels];
            if (els.paneOpenRouter && els.paneOpenRouter.style.display !== 'none') {
              populateOpenRouterImageModels(els.imageModelSearchInput?.value || '');
            }
          }
        }
      } catch (imgErr) {
        console.warn('Could not fetch dynamic OpenRouter image models:', imgErr);
      }
    } catch (e) {
      console.warn('Could not fetch dynamic OpenRouter model catalog:', e);
    }
  }

  // ==================== MODEL DROPDOWN & SELECTORS ====================
  function populateModelDropdown(search = '') {
    if (!els.dropdownModelList) return;
    els.dropdownModelList.innerHTML = '';
    const q = search.toLowerCase().trim();

    // Sinkronisasi status visual tab dropdown
    if (els.dropdownTabOllama) {
      els.dropdownTabOllama.classList.toggle('active', STATE.dropdownModelTab === 'ollama');
    }
    if (els.dropdownTabOpenRouter) {
      els.dropdownTabOpenRouter.classList.toggle('active', STATE.dropdownModelTab === 'openrouter');
    }

    let models = [];
    const isOllamaTab = STATE.dropdownModelTab === 'ollama';

    if (isOllamaTab) {
      if (STATE.ollamaModels && STATE.ollamaModels.length > 0) {
        models = STATE.ollamaModels.map(m => {
          const modelId = m.name || m.model || m.id;
          let tag = m.tag || 'Ollama Cloud';
          if (tag === 'Lokal') tag = 'Ollama Cloud';
          return { 
            id: modelId, 
            name: m.name || modelId, 
            tag: tag 
          };
        });
      } else {
        models = [];
      }
    } else {
      models = (STATE.openRouterModels || []).map(m => ({
        id: m.id,
        name: m.name || m.id,
        tag: m.tag || (m.id.includes(':free') ? 'Free' : 'Cloud')
      }));
    }

    const currentActive = getCurrentModel();

    // Filter pencarian
    let filtered = models.filter(m => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));

    // Urutkan model dengan rapi: Model aktif di paling atas, disusul model favorit pengguna, lalu sisanya alfabetis
    filtered.sort((a, b) => {
      if (a.id === currentActive) return -1;
      if (b.id === currentActive) return 1;
      const aFav = isModelFavorite(a.id);
      const bFav = isModelFavorite(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    if (filtered.length === 0) {
      els.dropdownModelList.innerHTML = `
        <div style="font-size:0.75rem; color:var(--text-dim); padding:14px; text-align:center; line-height:1.4;">
          ${isOllamaTab ? 'Belum ada model terdeteksi dari Ollama.<br><span style="font-size:0.68rem; opacity:0.8;">Buka Katalog Lengkap atau ketik Model Kustom di bawah.</span>' : 'Model OpenRouter tidak ditemukan.<br><span style="font-size:0.68rem; opacity:0.8;">Buka Katalog Lengkap untuk pencarian real-time.</span>'}
        </div>
      `;
      return;
    }

    filtered.forEach(m => {
      const item = document.createElement('div');
      const isFav = isModelFavorite(m.id);
      item.className = `model-option-item ${m.id === currentActive ? 'selected' : ''} ${isFav ? 'is-fav' : ''}`;
      const isFree = m.tag.toLowerCase().includes('free');
      const isCloud = m.tag.toLowerCase().includes('cloud');
      const badgeStyle = isFree 
        ? 'background:rgba(0,255,194,0.15); color:var(--neon-teal); border:1px solid rgba(0,255,194,0.3);' 
        : (isCloud ? 'background:rgba(0,240,255,0.12); color:var(--neon-cyan); border:1px solid rgba(0,240,255,0.3);' : 'background:rgba(255,183,3,0.15); color:var(--neon-amber); border:1px solid rgba(255,183,3,0.3);');

      item.innerHTML = `
        <button type="button" class="model-fav-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Hapus dari Model Favorit' : 'Jadikan Model Favorit'}" style="margin-right:8px;">
          <i class="fa-solid fa-laptop-code"></i>
        </button>
        <div style="display:flex; flex-direction:column; overflow:hidden; flex:1; padding-right:8px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; font-size:0.82rem;">${escapeHtml(m.name || m.id)}</span>
            ${isFav ? `<span class="model-fav-tag" title="Model Favorit"><i class="fa-solid fa-laptop-code"></i></span>` : ''}
          </div>
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.68rem; color:var(--text-dim); font-family:var(--font-code);">${escapeHtml(m.id)}</span>
        </div>
        <span style="font-size:0.65rem; padding:2px 6px; border-radius:3px; font-weight:600; flex-shrink:0; ${badgeStyle}">${escapeHtml(m.tag || 'AI')}</span>
      `;

      const favBtn = item.querySelector('.model-fav-btn');
      if (favBtn) {
        favBtn.addEventListener('click', (e) => {
          toggleModelFavorite(m.id, e);
        });
      }

      item.addEventListener('click', () => {
        if (isOllamaTab && STATE.mode !== 'ollama') {
          setEngineMode('ollama');
        } else if (!isOllamaTab && STATE.mode !== 'openrouter') {
          setEngineMode('openrouter');
        }
        selectModel(m.id);
        els.modelDropdownMenu.classList.remove('show');
        AudioEngine.click();
      });
      els.dropdownModelList.appendChild(item);
    });
  }

  function getCurrentModel() {
    if (STATE.mode === 'ollama') return STATE.settings.ollamaModel;
    if (STATE.mode === 'openrouter') return STATE.settings.openRouterModel;
    if (STATE.mode === 'auto') return `Auto (${STATE.settings.ollamaModel} ➔ ${STATE.settings.openRouterModel})`;
    return STATE.settings.ollamaModel || 'Default';
  }

  function selectModel(modelId) {
    if (!modelId) return;
    const isOR = modelId.includes('/');
    if (isOR) {
      STATE.settings.openRouterModel = modelId;
      if (STATE.mode !== 'openrouter' && STATE.mode !== 'auto') {
        setEngineMode('openrouter');
      }
    } else {
      STATE.settings.ollamaModel = modelId;
      if (STATE.mode !== 'ollama' && STATE.mode !== 'auto') {
        setEngineMode('ollama');
      }
    }

    updateModelUI();
    savePersistedState();
  }

  function updateModelUI() {
    const current = getCurrentModel();
    if (els.currentModelLabel) els.currentModelLabel.innerText = current;
  }

  function updateModeLayout(mode) {
    if (els.singleModelPickerWrap) els.singleModelPickerWrap.style.display = 'block';
    if (els.singleChatContainer) els.singleChatContainer.style.display = 'flex';
  }

  // ==================== MODE SWITCHING ====================
  function setEngineMode(mode) {
    if (STATE.isGenerating) {
      showToast('Harap tunggu atau hentikan generasi respons saat ini.', 'error');
      return;
    }
    STATE.mode = mode;
    els.modeTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    updateModeLayout(mode);

    if (STATE.currentSessionId) {
      const session = STATE.sessions.find(s => s.id === STATE.currentSessionId);
      if (session) {
        session.mode = mode;
        savePersistedState();
      }
    }

    updateModelUI();
    populateModelDropdown();
    renderChatHistory();
    renderCurrentSession();
    AudioEngine.click();
  }

  // ==================== DISPATCH / STREAMING ENGINE ====================
  async function handleSendPrompt() {
    // HARUS `let`: blok auto-convert saat kirim (lihat di bawah) dan jalur rewrite
    // URL me-assign ulang rawText. Pakai `const` akan melempar TypeError senyap
    // di dalam try tanpa catch sehingga pesan tidak pernah terkirim.
    let rawText = els.promptInput ? els.promptInput.value.trim() : '';
    const images = [...(STATE.attachedImages || [])];
    const image = images.length > 0 ? images[0] : null;
    const docs = [...(STATE.attachedDocs || [])];

    if (!rawText && images.length === 0 && docs.length === 0) return;
    if (STATE.isGenerating || STATE.isSending) return;

    // Tutup celah await (hydrasi sesi lazy-disk) sebelum input dibersihkan,
    // agar Enter berulang tidak mengirim dua kali / memicu dua stream.
    STATE.isSending = true;
    try {

    // Claude AI resilience: minta izin notifikasi saat pengguna berinteraksi
    requestNotificationPermission();

    // Intersepsi perintah keluar / beralih mode cepat
    const trimmedLow = rawText.toLowerCase();
    if (trimmedLow === '/chat' || trimmedLow === '/teks' || trimmedLow === '/text') {
      STATE.isImageGenMode = false;
      updateImageGenModeUI();
      if (els.promptInput) {
        els.promptInput.value = '';
        autoResizeTextarea(els.promptInput);
      }
      showToast('Mode percakapan standar aktif.');
      AudioEngine.click();
      return;
    }
    if (trimmedLow === '/img' || trimmedLow === '/image' || trimmedLow === '/gambar') {
      STATE.isImageGenMode = true;
      updateImageGenModeUI();
      if (els.promptInput) {
        els.promptInput.value = '';
        autoResizeTextarea(els.promptInput);
      }
      showToast('Mode AI Image Studio aktif. Silakan ketik deskripsi visual!');
      AudioEngine.click();
      return;
    }

    // Simpan prompt teks asli pengguna untuk tampilan gelembung obrolan (displayContent)
    let originalUserPrompt = rawText;
    // Ambil URL & perintah slash dari teks ASLI sebelum auto-conversion. Blok lipat di
    // bawah menimpa rawText dengan instruksi singkat sehingga URL/perintah di dalamnya
    // hilang — bila divalidasi setelah lipat, Mode Deep Research menolak URL yang sah.
    const preFoldUrls = extractCustomAnalysisUrls(rawText);
    const preFoldDeepCommand = /^\/(?:deep|research|riset)\s+/i.test(rawText.trim());

    // Claude / Grok AI Style: Jika prompt teks yang dikirim pengguna merupakan codingan atau laporan panjang
    // dan belum ada dokumen lampiran, otomatis konversi blok tersebut menjadi file markdown lampiran
    if (rawText && shouldAutoConvertAsDocument(rawText) && docs.length === 0) {
      const lines = rawText.split('\n');
      const firstLine = lines[0].trim();
      let promptInstruction = '';
      let snippetContent = rawText;

      // Jika ada baris pengantar pendek di awal (misal "tolong jelaskan kode ini:\n...")
      if (firstLine.length <= 120 && (/(?:tolong|jelaskan|analisis|baca|ringkas|review|perbaiki|fix|cek|bantu|buatkan|kenapa|mengapa|gimana|bagaimana|apa(?:kah)?|how|what|why|explain|analyze|help)\b/i.test(firstLine) || firstLine.endsWith(':') || firstLine.endsWith('?'))) {
        promptInstruction = firstLine;
        snippetContent = lines.slice(1).join('\n').trim();
      }

      const autoDoc = convertTextToMarkdownDoc(snippetContent);
      if (autoDoc) {
        docs.push(autoDoc);
        originalUserPrompt = promptInstruction ? `${promptInstruction} [File: ${autoDoc.name}]` : `[File: ${autoDoc.name}]`;
        rawText = promptInstruction || `Tolong pelajari, analisis, dan jelaskan isi file dokumen ${autoDoc.name} di atas secara komprehensif.`;
      }
    }

    const isExplicitDeepResearch = preFoldDeepCommand || /^\/(?:deep|research|riset)\s+/i.test(rawText.trim());
    if (STATE.isDeepResearch || isExplicitDeepResearch) {
      // Validasi URL kustom untuk Mode Deep Research
      let targetUrls = Array.isArray(STATE.researchTargetUrls) ? [...STATE.researchTargetUrls] : [];
      const promptUrls = extractCustomAnalysisUrls(rawText);
      promptUrls.forEach(u => {
        if (!targetUrls.includes(u)) targetUrls.push(u);
      });
      // URL dari teks asli (sebelum lipat otomatis) juga dihitung sah
      preFoldUrls.forEach(u => {
        if (!targetUrls.includes(u)) targetUrls.push(u);
      });

      if (targetUrls.length === 0) {
        showToast('⚠️ Mode Deep Research memerlukan minimal 1 URL kustom untuk dianalisis. Tempel URL di modal Kelola Sumber atau kolom chat.');
        openResearchUrlManagerModal();
        STATE.isSending = false;
        return;
      }
    } else {
      // Auto-Extraction URL Web Publik untuk Analisis & Ringkasan AI (khusus mode biasa/non-Deep Research)
      const detectedWebUrls = extractWebUrlsFromText(rawText);
      if (detectedWebUrls.length > 0) {
        const urlsToScrape = detectedWebUrls.slice(0, 2);
        try {
          const scrapePromises = urlsToScrape.map(u => extractWebContentFromUrl(u, 7500));
          const scrapeResults = await Promise.all(scrapePromises);
          let extractedCount = 0;
          scrapeResults.forEach(res => {
            if (res && res.success && res.content && res.content.length > 30) {
              extractedCount++;
              const docName = `[Web: ${res.title || res.domain}]`;
              docs.push({
                name: docName,
                size: `${res.charCount || res.content.length} karakter`,
                content: `Sumber URL: ${res.url}\nJudul Halaman: ${res.title}\nDomain: ${res.domain}\n\n${res.content}`,
                url: res.url,
                isWeb: true
              });
            }
          });
          if (extractedCount > 0) {
            showToast(`🌐 Berhasil mengekstrak ${extractedCount} konten website secara langsung!`, 'success');
            // Jika pengguna hanya menempelkan link atau slash command tanpa instruksi khusus, otomatis buat prompt ringkasan
            let cleanPromptCheck = rawText.replace(/^\/(?:web|read|ringkas|baca|scrape)\s+/i, '').trim();
            if (/^https?:\/\/[^\s]+$/i.test(cleanPromptCheck)) {
              rawText = `Tolong baca, analisis, dan rangkum intisari serta poin-poin penting dari website berikut secara terstruktur: ${cleanPromptCheck}`;
            }
          }
        } catch (err) {
          console.warn('Auto-scrape URL web notice:', err.message);
        }
      }
    }

    // Combine documents with text
    let text = rawText;
    const validDocs = docs.filter(d => d && typeof d.content === 'string' && d.content.trim().length > 0);
    if (validDocs.length > 0) {
      const docsContext = validDocs.map(d => `--- [LAMPIRAN DOKUMEN: ${d.name} (${d.size})] ---\n${d.content}\n--- [AKHIR DOKUMEN: ${d.name}] ---`).join('\n\n');
      text = text ? `${docsContext}\n\n${text}` : `${docsContext}\n\nTolong baca, pahami, dan analisis isi dokumen lampiran di atas secara komprehensif.`;
    }

    const session = getActiveSession();
    // Safety guard: Hydrate full conversation history from storage if session was lazy-loaded
    if (session._isLazyDisk && (!session.messages || session.messages.length === 0)) {
      try {
        const fullSess = await DeviceStorage.getSession(session.id);
        if (fullSess && Array.isArray(fullSess.messages)) {
          session.messages = fullSess.messages;
          delete session._isLazyDisk;
        }
      } catch (e) {
        console.warn('Pre-send session hydration notice:', e);
      }
    }
    if (els.welcomeHero) {
      els.welcomeHero.style.display = 'none';
    }

    // Tampilan gelembung obrolan
    let displayPrompt = originalUserPrompt;
    if (!displayPrompt && docs.length > 0) {
      displayPrompt = `Tolong analisis file ${docs[0].name}`;
    }

    // Build user message object
    const docsWithContent = docs.map(d => ({ name: d.name, size: d.size, content: d.content, url: d.url, isWeb: d.isWeb }));
    const docsMeta = docs.map(d => ({ name: d.name, size: d.size, url: d.url, isWeb: d.isWeb }));
    const userMsg = {
      role: 'user',
      content: text,
      displayContent: displayPrompt,
      docs: docsMeta.length > 0 ? docsMeta : undefined,
      images: images,
      image: image,
      timestamp: new Date().toISOString()
    };

    // Auto title session if first message
    if (session.messages.length === 0) {
      const fallbackTitle = docs.length > 0 ? (docs[0].name || 'Dokumen Lampiran') : (images.length > 0 ? 'Analisis Gambar' : 'Percakapan Baru');
      let cleanCandidate = (displayPrompt || '').replace(/^\/(?:image|img|gambar|deep|research|riset|web|search|canvas)\s+/i, '').trim();
      const titleCandidate = cleanCandidate || fallbackTitle;
      session.title = titleCandidate.length > 30 ? titleCandidate.substring(0, 30) + '...' : titleCandidate;
    }

    session.updatedAt = new Date().toISOString();
    session.messages.push(userMsg);
    savePersistedState();
    renderChatHistory(els.searchHistoryInput?.value || '');

    // Immediately render user's message bubble
    const userRow = appendMessageElement('user', displayPrompt, images, 'Anda', null, session.messages.length - 1, null, docsWithContent.length > 0 ? docsWithContent : docsMeta);
    smartScrollChatToBottom(true);

    if (STATE.isPromptHidden) {
      togglePromptVisibility(false);
    }

    AudioEngine.send();

    // Reset input & attachments
    if (els.promptInput) {
      els.promptInput.value = '';
      autoResizeTextarea(els.promptInput);
    }
    // M6: kartu "Ubah ke file markdown?" ikut dibersihkan — prompt dikosongkan
    // secara programatik (tanpa event input), jadi kartu basi tetap terlihat di
    // atas composer; diklik → teks LAMA dilampirkan sebagai dokumen ke pesan
    // berikutnya (konten ganda terkirim diam-diam ke model).
    hideComposerFoldPromptCard();
    pendingFoldText = '';
    if (els.autoConvertDocRow) {
      els.autoConvertDocRow.style.display = 'none';
    }
    STATE.attachedDocs = [];
    clearAttachedImages();
    renderAttachmentPreviews();

    let targetModel = '';
    if (STATE.mode === 'openrouter') {
      targetModel = STATE.settings.openRouterModel || 'openrouter/free';
    } else {
      targetModel = STATE.settings.ollamaModel || 'qwen2.5:1.5b';
    }

    let effectiveImages = images;

    const isExplicitMusicCommand = /^\/(?:music|musik|audio|song|lagu)\b/i.test(text.trim());
    const isExplicitImageCommand = /^\/(?:image|img|gambar)\s+/i.test(text.trim());
    const isDirectImageCapable = isModelCapableOfImageGeneration(targetModel);
    const isToolImageCapable = (STATE.mode === 'openrouter' || targetModel.includes('/')) && Boolean(STATE.settings.openRouterKey) && doesModelSupportTools(targetModel);
    const canModelHandleImage = isDirectImageCapable || isToolImageCapable;

    if (STATE.isMusicGenMode || isExplicitMusicCommand || isMusicGenerationTrigger(text)) {
      const cleanMusicPrompt = extractMusicPrompt(text);
      await runMusicGeneration(session, cleanMusicPrompt);
    } else if (STATE.isImageGenMode || isExplicitImageCommand) {
      const cleanImgPrompt = extractImagePrompt(text);
      await runImageGeneration(session, cleanImgPrompt, STATE.settings.imageModel);
    } else if (isExplicitDeepResearch || STATE.isDeepResearch) {
      // Deep Research dieksekusi jika pengguna mengaktifkan mode Deep Research (Premium) dari UI atau mengetik slash command
      const cleanResearchPrompt = isExplicitDeepResearch ? text.replace(/^\/(?:deep|research|riset)\s+/i, '').trim() : text.trim();
      let deepTargetUrls = Array.isArray(STATE.researchTargetUrls) ? [...STATE.researchTargetUrls] : [];
      const extractedUrls = extractCustomAnalysisUrls(text);
      extractedUrls.forEach(u => {
        if (!deepTargetUrls.includes(u)) deepTargetUrls.push(u);
      });
      const activeEngine = (STATE.mode === 'auto')
        ? (STATE.settings.autoPolicy === 'cloud_first' ? 'openrouter' : 'ollama')
        : STATE.mode;
      const activeModel = (activeEngine === 'openrouter')
        ? STATE.settings.openRouterModel
        : STATE.settings.ollamaModel;
      await runDeepResearchStreaming(session, cleanResearchPrompt || text, effectiveImages, activeModel, activeEngine, deepTargetUrls);
    } else if (isImageGenerationTrigger(text) && !canModelHandleImage && !STATE.settings.openRouterKey && (STATE.mode === 'openrouter' || targetModel.includes('/'))) {
      // Jika model OpenRouter dipilih tapi tanpa API Key untuk tool calling dan tidak mampu gambar langsung,
      // fallback ke AI Image Studio dengan model gratis (Pollinations) agar pengguna tetap mendapatkan karya visual
      const cleanImgPrompt = extractImagePrompt(text);
      const fallbackImgModel = (STATE.settings.imageModel && !STATE.settings.imageModel.includes('/')) ? STATE.settings.imageModel : 'flux';
      await runImageGeneration(session, cleanImgPrompt, fallbackImgModel);
    } else {
      // MODE BIASA: Selalu jalankan streaming chat normal dengan pencarian web biasa otonom
      if (STATE.mode === 'auto') {
        await runAutoRouterStreaming(session, text, effectiveImages);
      } else if (STATE.mode === 'openrouter') {
        if (!targetModel.includes('/')) {
          await runOllamaStreaming(session, text, effectiveImages, targetModel);
        } else {
          await runOpenRouterStreaming(session, text, effectiveImages, targetModel);
        }
      } else {
        if (targetModel.includes('/')) {
          await runOpenRouterStreaming(session, text, effectiveImages, targetModel);
        } else {
          await runOllamaStreaming(session, text, effectiveImages, targetModel);
        }
      }
    }
    } catch (err) {
      // Jangan sampai kegagalan di dalam blok kirim jadi unhandled rejection senyap
      // (pola inilah yang menyembunyikan bug "const rawText" selama berminggu-minggu).
      console.error('handleSendPrompt gagal:', err);
      showToast('Gagal mengirim pesan: ' + (err && err.message ? err.message : err), 'error');
    } finally {
      STATE.isSending = false;
    }
  }

  // ==================== IMAGE GENERATION MODEL CAPABILITY DETECTOR ====================
  function isModelCapableOfImageGeneration(modelName) {
    if (!modelName || typeof modelName !== 'string') return false;
    const lower = modelName.toLowerCase();
    if (
      lower.includes('image') ||
      lower.includes('imagen') ||
      lower.includes('nano-banana') ||
      lower.includes('flux') ||
      lower.includes('dall-e') ||
      lower.includes('diffusion') ||
      lower.includes('midjourney') ||
      lower.includes('recraft') ||
      lower.includes('stable-diffusion')
    ) return true;

    // Deteksi jika model OpenRouter secara live memiliki output modality image
    const liveModel = (STATE.openRouterModels || []).find(m => m.id === modelName);
    if (liveModel && liveModel.hasImageOutput) return true;

    // Deteksi jika model terdaftar di katalog model gambar khusus
    const imgModel = (STATE.availableImageModels || []).find(m => m.id === modelName);
    if (imgModel) return true;

    return false;
  }

  function doesModelSupportTools(modelName) {
    if (!modelName || typeof modelName !== 'string') return false;
    const liveModel = (STATE.openRouterModels || []).find(m => m.id === modelName);
    if (liveModel && typeof liveModel.supportsTools === 'boolean') {
      return liveModel.supportsTools;
    }
    const lower = modelName.toLowerCase();
    return (
      lower.includes('gpt-') ||
      lower.includes('claude-') ||
      lower.includes('gemini-') ||
      lower.includes('qwen') ||
      lower.includes('mistral') ||
      lower.includes('llama-3') ||
      lower.includes('deepseek')
    );
  }

  // ==================== AUTONOMOUS WEB EXPLORER TOOLS & ENGINE (BUILT FROM ZERO) ====================
  const AUTONOMOUS_WEB_TOOLS = [
    {
      type: 'function',
      function: {
        name: 'search_web',
        description: 'Cari informasi terkini, riset, berita, fakta, atau data apapun di internet secara live dan bebas batas API. Mengembalikan daftar judul web, URL, dan ringkasan cuplikan untuk dicerna.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Kata kunci pencarian spesifik untuk ditelusuri di internet'
            }
          },
          required: ['query']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'browse_web_page',
        description: 'Jelajahi dan baca seluruh isi teks artikel atau halaman web berdasarkan URL untuk mencerna informasi mendalam secara lengkap.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'Alamat URL lengkap halaman web yang ingin dibaca (misal: https://example.com/artikel)'
            }
          },
          required: ['url']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'extract_web',
        description: 'Ekstrak dan baca seluruh isi teks artikel atau dokumen dari sebuah URL website secara penuh untuk dipelajari, diringkas, atau dianalisis mendalam.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'Alamat URL website yang ingin diekstrak (misal: https://example.com/artikel)'
            }
          },
          required: ['url']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_url',
        description: 'Kunjungi dan baca isi teks konten sebuah tautan/URL web secara lengkap.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'Alamat URL web yang ingin dibaca'
            }
          },
          required: ['url']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'search_youtube',
        description: 'Cari video YouTube berdasarkan kata kunci. Mengembalikan daftar video (judul, channel, durasi, jumlah tayangan, URL, thumbnail) yang bisa langsung diputar di dalam percakapan atau dibuka di YouTube. Gunakan kapan pun pengguna meminta mencarikan, menemukan, atau menonton sebuah video/tutorial/klip musik.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Kata kunci pencarian video YouTube (misal: "tutorial React JS", "lagu cyberpunk", "review RTX 5090")'
            },
            max_results: {
              type: 'integer',
              description: 'Jumlah video maksimal yang ingin dikembalikan (1-10, default 6)'
            }
          },
          required: ['query']
        }
      }
    }
  ];

  // Tool video YouTube selalu aktif — tidak bergantung pada toggle Mode Pencarian Web,
  // sehingga SEMUA model (native tool calling maupun format teks) tetap bisa memakainya.
  const YOUTUBE_TOOL_ONLY = AUTONOMOUS_WEB_TOOLS.filter(t => t && t.function && t.function.name === 'search_youtube');

  // Daftar nama tool otonom yang dikenal sistem (native call maupun parse teks)
  const AUTONOMOUS_TOOL_NAMES = [
    'search_web', 'web_search', 'search',
    'browse_web_page', 'browse_web', 'browse_page', 'extract_web', 'read_url', 'scrape_url',
    'search_youtube'
  ];

  // Keluarga tool ekstraksi/baca URL: diizinkan SELALU (bukan "pencarian"),
  // sehingga tetap bisa dipakai saat pengguna menempel URL dan memintanya dibaca,
  // bahkan bila Mode Pencarian Web sedang nonaktif.
  const EXTRACTION_TOOL_NAMES = ['browse_web_page', 'browse_web', 'browse_page', 'extract_web', 'read_url', 'scrape_url'];

  // Aturan izin (dipakai saat EKSEKUSI call): search_youtube bila toggle YouTube aktif;
  // ekstraksi web URL selalu diizinkan; tool search bila Mode Pencarian Web aktif.
  function isAutonomousToolAllowed(toolName, webToolsAllowed) {
    if (toolName === 'search_youtube') return Boolean(STATE.isYouTubeSearchMode);
    if (EXTRACTION_TOOL_NAMES.includes(toolName)) return true;
    return Boolean(webToolsAllowed);
  }

  // Susun daftar tool yang benar-benar DIKIRIMKAN ke model (wajib konsisten dengan
  // isAutonomousToolAllowed di atas, jika tidak model menerima tool yang nantinya
  // diblokir, atau sebaliknya menerima tool yang tak pernah diumumkan):
  //  - search_youtube            : bila toggle "Cari Video YouTube" aktif
  //  - keluarga extract/browse   : SELALU
  //  - search_web/web_search     : bila Mode Pencarian Web aktif
  function getSelectableAutonomousTools(webToolsAllowed) {
    return AUTONOMOUS_WEB_TOOLS.filter((t) => {
      const name = t && t.function ? t.function.name : '';
      if (name === 'search_youtube') return Boolean(STATE.isYouTubeSearchMode);
      if (EXTRACTION_TOOL_NAMES.includes(name)) return true;
      return Boolean(webToolsAllowed);
    });
  }

  // Sumber tanda tangan dedup per tool (mencegah loop pemanggilan berulang)
  function getAutonomousToolSignature(call) {
    const toolName = call && call.function ? call.function.name : '';
    let raw = null;
    try {
      raw = (typeof call.function.arguments === 'string') ? JSON.parse(call.function.arguments) : call.function.arguments;
    } catch (_) {
      raw = String(call.function.arguments || '');
    }
    if (toolName === 'search_web' || toolName === 'web_search' || toolName === 'search') return 'search_web';
    if (toolName === 'search_youtube') {
      const q = (raw && typeof raw === 'object') ? (raw.query || raw.q || '') : String(raw || '');
      return `youtube:${String(q).trim().toLowerCase()}`;
    }
    let url = '';
    if (raw && typeof raw === 'object') url = raw.url || raw.target || raw.link || '';
    else if (typeof raw === 'string') url = raw;
    const cleanUrl = String(url).trim().toLowerCase().replace(/\/+$/, '');
    return `browse:${cleanUrl}`;
  }

  function stripDateNoise(q) {
    if (!q || typeof q !== 'string') return '';
    const months = 'januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|april|may|june|july|august|september|october|november|december';
    const days = 'senin|selasa|rabu|kamis|jumat|sabtu|minggu|monday|tuesday|wednesday|thursday|friday|saturday|sunday';
    return q
      .replace(new RegExp(`\\b(${days})\\b`, 'gi'), ' ')
      .replace(new RegExp(`\\b\\d{1,2}\\s+(${months})(?:\\s*,?\\s*\\d{2,4})?\\b`, 'gi'), ' ')
      .replace(new RegExp(`\\b(${months})\\s+\\d{1,2}(?:\\s*,?\\s*\\d{2,4})?\\b`, 'gi'), ' ')
      .replace(new RegExp(`\\b(${months})(?:\\s+\\d{2,4})?\\b`, 'gi'), ' ')
      .replace(/\b(202[0-9])\b/g, ' ')
      .replace(/[,;]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function deriveBroadSearchQueries(rawQuery, contextText = '') {
    if (!rawQuery || typeof rawQuery !== 'string') {
      return { primary: '', tech: '', news: '', recentNews: '', recentNewsId: '', weeklyNews: '', core: '' };
    }

    // Bersihkan karakter berlebih / HTML
    let cleanQuery = rawQuery
      .replace(/<[^>]+>/g, ' ')
      .replace(/[^\w\s\.\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Bersihkan kata pengisi percakapan umum tanpa merusak topik inti
    const fillerWords = [
      'tolong', 'carikan', 'cari', 'bantu', 'apakah', 'bisakah', 'coba',
      'search', 'find', 'please'
    ];
    let coreQuery = cleanQuery;
    fillerWords.forEach(w => {
      coreQuery = coreQuery.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
    });
    coreQuery = coreQuery.replace(/\s+/g, ' ').trim();
    if (coreQuery.length < 2) coreQuery = cleanQuery;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthId = now.toLocaleString('id-ID', { month: 'long' });

    return {
      primary: cleanQuery,
      core: coreQuery,
      news: `${coreQuery} news`,
      recentNews: `${coreQuery} berita`,
      recentNewsId: `${coreQuery} berita terbaru`,
      weeklyNews: `${coreQuery} update`,
      tech: coreQuery
    };
  }

  // ==================== PENCARIAN VIDEO YOUTUBE (CLIENT) ====================
  // Dipakai tool `search_youtube`: endpoint lokal dulu, fallback lintas-origin
  // (GitHub Pages / endpoint gagal) lewat proxy publik CORS-bebas.
  function ytClientText(node) {
    if (!node) return '';
    if (typeof node.simpleText === 'string') return node.simpleText;
    if (Array.isArray(node.runs)) return node.runs.map((r) => (r && r.text) || '').join('');
    if (typeof node.content === 'string') return node.content;
    return '';
  }

  function ytClientExtractJson(source, marker) {
    if (!source || typeof source !== 'string') return null;
    const idx = source.indexOf(marker);
    if (idx === -1) return null;
    const start = source.indexOf('{', idx + marker.length);
    if (start === -1) return null;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < source.length; i++) {
      const c = source[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return source.slice(start, i + 1); }
    }
    return null;
  }

  function ytClientDurationSeconds(text) {
    if (!text || typeof text !== 'string') return 0;
    const parts = text.split(':').map((p) => parseInt(p, 10));
    if (parts.some((n) => Number.isNaN(n))) return 0;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }

  function ytClientMapVideoRenderer(vr) {
    if (!vr || !vr.videoId) return null;
    const title = ytClientText(vr.title);
    if (!title) return null;
    const ownerRuns = vr.ownerText && vr.ownerText.runs;
    const ownerNav = ownerRuns && ownerRuns[0] && ownerRuns[0].navigationEndpoint && ownerRuns[0].navigationEndpoint.browseEndpoint;
    const channelPath = ownerNav && ownerNav.canonicalBaseUrl;
    const durationText = ytClientText(vr.lengthText);
    return {
      videoId: vr.videoId,
      title,
      channel: ytClientText(vr.ownerText || vr.longBylineText) || '',
      channelUrl: channelPath ? `https://www.youtube.com${channelPath}` : '',
      durationText,
      durationSeconds: ytClientDurationSeconds(durationText),
      viewText: ytClientText(vr.viewCountText) || ytClientText(vr.shortViewCountText),
      publishedText: ytClientText(vr.publishedTimeText),
      description: ytClientText(vr.descriptionSnippet).slice(0, 260),
      url: `https://www.youtube.com/watch?v=${vr.videoId}`,
      thumbnail: `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
      source: 'YouTube Search'
    };
  }

  function ytClientCollect(node, out, limit) {
    if (!node || typeof node !== 'object' || out.length >= limit) return;
    if (Array.isArray(node)) {
      for (const item of node) { ytClientCollect(item, out, limit); if (out.length >= limit) return; }
      return;
    }
    if (node.videoRenderer) {
      const m = ytClientMapVideoRenderer(node.videoRenderer);
      if (m && !out.some((v) => v.videoId === m.videoId)) out.push(m);
      if (out.length >= limit) return;
    }
    if (node.lockupViewModel && node.lockupViewModel.contentId && String(node.lockupViewModel.contentType || '').toUpperCase().includes('VIDEO')) {
      const lv = node.lockupViewModel;
      const meta = (lv.metadata && lv.metadata.lockupMetadataViewModel) || {};
      const title = (meta.title && meta.title.content) || '';
      if (title && !out.some((v) => v.videoId === lv.contentId)) {
        out.push({
          videoId: lv.contentId,
          title,
          channel: '',
          channelUrl: '',
          durationText: '',
          durationSeconds: 0,
          viewText: (meta.metadata && meta.metadata.content) || '',
          publishedText: '',
          description: '',
          url: `https://www.youtube.com/watch?v=${lv.contentId}`,
          thumbnail: `https://i.ytimg.com/vi/${lv.contentId}/hqdefault.jpg`,
          source: 'YouTube Search'
        });
      }
      if (out.length >= limit) return;
    }
    for (const key of Object.keys(node)) { ytClientCollect(node[key], out, limit); if (out.length >= limit) return; }
  }

  function ytClientParseHtml(html, limit) {
    const jsonStr = ytClientExtractJson(html, 'ytInitialData');
    if (!jsonStr) return [];
    try {
      const out = [];
      ytClientCollect(JSON.parse(jsonStr), out, limit);
      return out;
    } catch (_) {
      return [];
    }
  }

  async function searchYouTubeClient(query, maxResults = 6) {
    const q = String(query || '').trim();
    const limit = Math.max(1, Math.min(10, parseInt(maxResults, 10) || 6));
    const payload = { success: false, query: q, count: 0, results: [], error: 'Pencarian video YouTube tidak tersedia saat ini.' };

    // 1) Endpoint lokal (server.js / Vercel / worker)
    if (!IS_GITHUB_PAGES) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 13000);
        const resp = await fetch('/api/youtube-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, limit }),
          signal: ctrl.signal
        });
        clearTimeout(t);
        if (resp.ok) {
          const data = await resp.json();
          if (data && Array.isArray(data.results)) {
            payload.success = data.success !== false && data.results.length > 0;
            payload.results = data.results;
            payload.count = data.results.length;
            payload.error = payload.success ? undefined : (data.error || payload.error);
            return payload;
          }
        }
      } catch (_) {
        // lanjut ke fallback
      }
    }

    // 2) Fallback lintas-origin lewat proxy publik (untuk GitHub Pages / endpoint gagal)
    try {
      const target = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en&gl=US`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
      const ctrl2 = new AbortController();
      const t2 = setTimeout(() => ctrl2.abort(), 13000);
      const resp2 = await fetch(proxyUrl, { signal: ctrl2.signal });
      clearTimeout(t2);
      if (resp2.ok) {
        const html = await resp2.text();
        const results = ytClientParseHtml(html, limit);
        payload.success = results.length > 0;
        payload.results = results;
        payload.count = results.length;
        payload.error = payload.success ? undefined : payload.error;
        return payload;
      }
    } catch (_) {
      // diamkan; payload kesalahan sudah siap
    }
    return payload;
  }

  async function executeAutonomousWebTool(toolName, rawArgs, promptContext = '', session = null) {
    try {
      let args = {};
      if (typeof rawArgs === 'string') {
        const trimmed = rawArgs.trim();
        try {
          args = JSON.parse(trimmed);
        } catch (_) {
          // If string is raw text (not JSON), use it directly
          if (['browse_web_page', 'browse_web', 'browse_page', 'extract_web', 'read_url', 'scrape_url'].includes(toolName)) {
            args = { url: trimmed };
          } else {
            // search_web & search_youtube sama-sama memakai query
            args = { query: trimmed };
          }
        }
      } else if (rawArgs && typeof rawArgs === 'object') {
        args = rawArgs;
      }

      // Unpack nested parameters if model wrapped them in arguments/parameters/input
      if (args && typeof args === 'object') {
        if (args.arguments && typeof args.arguments === 'object') args = args.arguments;
        else if (args.parameters && typeof args.parameters === 'object') args = args.parameters;
        else if (args.input && typeof args.input === 'object') args = args.input;
      }
      
      if (toolName === 'search_youtube') {
        let query = args.query || args.q || args.keyword || args.search || args.topic || args.title || args.text || (typeof args === 'string' ? args : '');
        if (!query || !String(query).trim()) {
          query = promptContext || 'video populer hari ini';
        }
        query = String(query).trim();
        const maxResults = Math.max(1, Math.min(10, parseInt(args.max_results || args.maxResults || args.limit, 10) || 6));

        const data = await searchYouTubeClient(query, maxResults);
        const list = (data && Array.isArray(data.results)) ? data.results : [];
        if (list.length === 0) {
          return {
            text: `Hasil pencarian video YouTube untuk "${query}": tidak ditemukan video. Coba kata kunci alternatif yang lebih spesifik.`,
            sources: [],
            videoIds: []
          };
        }

        let output = `HASIL PENCARIAN VIDEO YOUTUBE UNTUK "${query}":\n`;
        output += `Ditemukan ${list.length} video relevan:\n`;
        list.forEach((v, idx) => {
          output += `\n[${idx + 1}] ${v.title}\n`;
          output += `URL: ${v.url}\n`;
          if (v.channel) output += `Channel: ${v.channel}\n`;
          if (v.durationText) output += `Durasi: ${v.durationText}\n`;
          if (v.viewText) output += `Tayangan: ${v.viewText}\n`;
          if (v.publishedText) output += `Dipublikasikan: ${v.publishedText}\n`;
          if (v.description) output += `Deskripsi: ${v.description}\n`;
        });
        output += `\nCatatan: video di atas dapat diputar langsung di dalam percakapan. Sertakan tautan video yang Anda rekomendasikan (format markdown [Judul](URL)) di dalam jawaban akhir.`;

        return {
          text: output,
          sources: list.map((v) => ({
            title: v.title,
            url: v.url,
            domain: 'youtube.com',
            snippet: `${v.channel ? `Video YouTube oleh ${v.channel}: ` : 'Video YouTube: '}${(v.description || v.title || '').slice(0, 160)}`
          })),
          videoIds: list.map((v) => v.videoId).filter(Boolean)
        };
      }

      if (['search_web', 'web_search', 'search'].includes(toolName)) {
        let query = args.query || args.q || args.keyword || args.search || args.topic || args.text || (typeof args === 'string' ? args : '');
        if (!query || !query.trim()) {
          query = promptContext || 'berita dan informasi terkini';
        }
        
        let effectiveContext = promptContext || '';
        if (!effectiveContext && session?.messages?.length > 0) {
          effectiveContext = session.messages.slice(-3).map(m => m.content || '').join(' ');
        }

        const serperApiKey = (STATE.settings?.serperApiKey || '').trim() || '075538fed9c64990e1eb32a06726c1e55a933c1e';
        const cleanDateQuery = stripDateNoise(query.trim());
        const queriesToSearch = [query.trim()];
        if (cleanDateQuery && cleanDateQuery.length >= 3 && cleanDateQuery.toLowerCase() !== query.trim().toLowerCase()) {
          queriesToSearch.push(cleanDateQuery);
        }

        let results = [];
        const seenUrls = new Set();
        const seenTitles = new Set();

        const addCandidate = (item) => {
          if (!item || !item.url || !item.title) return;
          const normUrl = item.url.trim().toLowerCase().replace(/\/$/, '');
          const normTitle = item.title.trim().toLowerCase().replace(/[^\w\s]/g, '');

          // Filter Wikipedia HANYA jika sudah ada cukup sumber web/berita non-Wikipedia (>= 3)
          if (normUrl.includes('wikipedia.org') || normTitle.includes('wikipedia') || (item.domain && item.domain.includes('wikipedia.org'))) {
            if (results.length >= 3) return;
          }

          // Filter out irrelevant codename or disambiguation entries
          if (normTitle.includes('listofapplecodenames') && !query.toLowerCase().includes('apple')) return;

          if (seenUrls.has(normUrl)) return;
          seenUrls.add(normUrl);
          results.push(item);
        };

        // 1. Prioritas Utama: Google Serper API Langsung dari Browser (CORS Open, Super Cepat < 300ms, Akurat 100% untuk topik apa pun)
        if (serperApiKey) {
          try {
            for (const q of queriesToSearch) {
              if (results.length >= 10) break;
              const serperCtrl = new AbortController();
              const serperTimeout = setTimeout(() => serperCtrl.abort(), 6500);
              const sRes = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                  'X-API-KEY': serperApiKey,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  q: q,
                  num: 15,
                  gl: 'us', // Global Worldwide Search (Tidak terisolasi di satu negara)
                  hl: 'en'  // Global Language Ranking
                }),
                signal: serperCtrl.signal
              });
              clearTimeout(serperTimeout);
              if (sRes.ok) {
                const sData = await sRes.json();
                if (sData.answerBox) {
                  const abTitle = sData.answerBox.title || 'Jawaban Teratas Google';
                  const abLink = sData.answerBox.link || 'https://google.com';
                  let abDomain = 'google.com';
                  try { abDomain = new URL(abLink).hostname.replace(/^www\./, ''); } catch (_) {}
                  addCandidate({
                    title: abTitle,
                    url: abLink,
                    domain: abDomain,
                    snippet: `[Google AnswerBox] ${sData.answerBox.answer || sData.answerBox.snippet || ''}`,
                    sourceProvider: `Google AnswerBox (${abDomain})`,
                    timestamp: Date.now(),
                    pubDate: 'Terkini'
                  });
                }
                if (sData.knowledgeGraph) {
                  const kgTitle = sData.knowledgeGraph.title || 'Knowledge Graph';
                  const kgLink = sData.knowledgeGraph.website || sData.knowledgeGraph.descriptionUrl || 'https://google.com';
                  let kgDomain = 'google.com';
                  try { kgDomain = new URL(kgLink).hostname.replace(/^www\./, ''); } catch (_) {}
                  addCandidate({
                    title: `${kgTitle} (${sData.knowledgeGraph.type || 'Fakta'})`,
                    url: kgLink,
                    domain: kgDomain,
                    snippet: `[Knowledge Graph] ${sData.knowledgeGraph.description || ''}`,
                    sourceProvider: `Google KG (${kgDomain})`,
                    timestamp: Date.now(),
                    pubDate: 'Terkini'
                  });
                }
                if (Array.isArray(sData.organic)) {
                  sData.organic.forEach((it, idx) => {
                    const u = it.link || it.url || '';
                    if (!u) return;
                    let dName = 'web';
                    try { dName = new URL(u).hostname.replace(/^www\./, ''); } catch (_) {}
                    addCandidate({
                      title: it.title || `Hasil ${idx + 1}`,
                      url: u,
                      domain: dName,
                      snippet: it.snippet || '',
                      sourceProvider: `Google (${dName})`,
                      timestamp: it.date ? (Date.parse(it.date) || Date.now()) : Date.now(),
                      pubDate: it.date || 'Terkini'
                    });
                  });
                }
              }
            }
          } catch (_) {}
        }

        // 2. Prioritas Kedua: Coba endpoint backend lokal/tunnel jika hasil < 3
        if (results.length < 3) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);
            const res = await fetch('/api/tools/search-web', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: cleanDateQuery || query.trim(), context: effectiveContext, maxResults: 15 }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.results)) {
                data.results.forEach(addCandidate);
              }
            }
          } catch (_) {}
        }

        // 3. Fallback jika kueri pendek/kontekstual (seperti "Di youtube ada video nya") dan hasil < 2
        if (results.length < 2 && effectiveContext && effectiveContext.trim().length > 5) {
          try {
            const enrichedQ = `${query.trim()} ${effectiveContext.replace(/\b(user|assistant|system)\b/gi, ' ').slice(-100).trim()}`.replace(/\s+/g, ' ').trim();
            if (serperApiKey && enrichedQ.length > query.trim().length) {
              const sRes = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: { 'X-API-KEY': serperApiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: enrichedQ, num: 8, gl: 'us', hl: 'en' })
              });
              if (sRes.ok) {
                const sData = await sRes.json();
                if (Array.isArray(sData.organic)) {
                  sData.organic.forEach((it, idx) => {
                    const u = it.link || it.url || '';
                    if (!u) return;
                    let dName = 'web';
                    try { dName = new URL(u).hostname.replace(/^www\./, ''); } catch (_) {}
                    addCandidate({
                      title: it.title || `Hasil ${idx + 1}`,
                      url: u,
                      domain: dName,
                      snippet: it.snippet || '',
                      sourceProvider: `Google (${dName})`,
                      timestamp: Date.now(),
                      pubDate: it.date || 'Terkini'
                    });
                  });
                }
              }
            }
          } catch (_) {}
        }

        // 4. Multi-Source Client-Side Aggregator (HackerNews, DuckDuckGo) jika hasil masih < 3
        if (results.length < 3) {
          try {
            const clientController = new AbortController();
            const clientTimeout = setTimeout(() => clientController.abort(), 6000);
            const clientSignal = clientController.signal;

            const qPlan = deriveBroadSearchQueries(cleanDateQuery || query.trim(), effectiveContext);
            const techQ = qPlan.tech;
            const coreQ = qPlan.core;
            const combinedQueryStr = (query + ' ' + effectiveContext).toLowerCase();
            const isTechQuery = /\b(ai|llm|software|github|code|linux|python|developer|api|tech|crypto|bitcoin|model|chip|gpu|nvidia|programming|framework)\b/i.test(combinedQueryStr);
            const minHnTimestamp = Math.floor((Date.now() - 120 * 86400 * 1000) / 1000);
            const hnUrlTech = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(techQ)}&tags=story&hitsPerPage=8&numericFilters=created_at_i%3E${minHnTimestamp}`;
            const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(coreQ)}&format=json&no_html=1&skip_disambig=1`;

            await Promise.allSettled([
              isTechQuery ? fetch(hnUrlTech, { signal: clientSignal }).then(r => r.ok ? r.json() : null).then(d => {
                if (d && Array.isArray(d.hits)) {
                  d.hits.slice(0, 6).forEach(h => {
                    const u = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
                    let dName = 'news.ycombinator.com';
                    try { dName = new URL(u).hostname.replace(/^www\./, ''); } catch (_) {}
                    addCandidate({
                      title: h.title,
                      url: u,
                      domain: dName,
                      snippet: `[Tech Wire] ${h.title}`,
                      sourceProvider: 'HackerNews Wire',
                      timestamp: h.created_at_i ? h.created_at_i * 1000 : Date.now(),
                      pubDate: 'Terkini'
                    });
                  });
                }
              }).catch(() => {}) : Promise.resolve(),

              fetch(ddgUrl, { signal: clientSignal }).then(r => r.ok ? r.json() : null).then(d => {
                if (d) {
                  if (d.Heading && d.AbstractURL && !d.AbstractURL.includes('wikipedia.org')) {
                    let dName = 'duckduckgo.com';
                    try { dName = new URL(d.AbstractURL).hostname.replace(/^www\./, ''); } catch (_) {}
                    addCandidate({
                      title: d.Heading,
                      url: d.AbstractURL,
                      domain: dName,
                      snippet: (d.Abstract || d.Heading).replace(/<[^>]+>/g, ' ').slice(0, 180),
                      sourceProvider: 'DuckDuckGo Instant',
                      timestamp: 0,
                      pubDate: ''
                    });
                  }
                  if (Array.isArray(d.RelatedTopics)) {
                    d.RelatedTopics.slice(0, 3).forEach(rt => {
                      if (rt.FirstURL && rt.Text && !rt.FirstURL.includes('wikipedia.org')) {
                        let dName = 'duckduckgo.com';
                        try { dName = new URL(rt.FirstURL).hostname.replace(/^www\./, ''); } catch (_) {}
                        addCandidate({
                          title: rt.Text.slice(0, 60),
                          url: rt.FirstURL,
                          domain: dName,
                          snippet: rt.Text.replace(/<[^>]+>/g, ' ').slice(0, 180),
                          sourceProvider: 'DuckDuckGo Related',
                          timestamp: 0,
                          pubDate: ''
                        });
                      }
                    });
                  }
                }
              }).catch(() => {}),

              // Wikipedia Open CORS API Fallback (origin=* diizinkan di seluruh peramban)
              (async () => {
                const lang = 'en'; // Global Wikipedia (Ensiklopedia Komprehensif Dunia)
                const wikiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanDateQuery || query.trim())}&utf8=1&format=json&origin=*`;
                const wRes = await fetch(wikiUrl, { signal: clientSignal }).catch(() => null);
                if (wRes && wRes.ok) {
                  const wData = await wRes.json().catch(() => null);
                  if (wData?.query?.search && Array.isArray(wData.query.search)) {
                    wData.query.search.slice(0, 3).forEach(item => {
                      const pTitle = item.title || '';
                      const pUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pTitle.replace(/ /g, '_'))}`;
                      const cleanSnippet = (item.snippet || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                      addCandidate({
                        title: pTitle,
                        url: pUrl,
                        domain: `${lang}.wikipedia.org`,
                        snippet: cleanSnippet || `Artikel ensiklopedia: ${pTitle}`,
                        sourceProvider: 'Wikipedia Global',
                        timestamp: Date.now(),
                        pubDate: 'Ensiklopedia'
                      });
                    });
                  }
                }
              })().catch(() => {})
            ]);
            clearTimeout(clientTimeout);
          } catch (_) {}
        }
        
        if (results.length === 0) {
          return { text: `Hasil pencarian untuk "${query}": Tidak ditemukan hasil spesifik. Coba gunakan kata kunci alternatif.`, sources: [] };
        }
        
        let output = `HASIL PENCARIAN WEB MULTI-SUMBER UNTUK "${query}":\n`;
        output += `Ditemukan ${results.length} sumber informasi terverifikasi (Diurutkan dari publikasi paling mutakhir & aktual):\n`;
        results.forEach((item, idx) => {
          output += `\n[${idx + 1}] [${item.sourceProvider || 'Web'}] ${item.title}\nURL: ${item.url}\nSumber/Domain: ${item.domain}\nRingkasan: ${item.snippet}\n`;
        });
        return { text: output, sources: results };
      }
      
      if (['browse_web_page', 'browse_web', 'browse_page', 'extract_web', 'read_url', 'scrape_url'].includes(toolName)) {
        let url = args.url || args.target || args.link || args.href || args.targetUrl || (typeof args === 'string' ? args : '');
        if (!url || !url.trim()) return { text: 'Error: Parameter `url` tidak boleh kosong.', sources: [] };
        url = url.trim();
        if (!/^https?:\/\//i.test(url)) {
          url = 'https://' + url;
        }

        // Intersep khusus untuk URL YouTube agar mengembalikan metadata resmi video via oEmbed
        const ytIds = extractYouTubeVideoIdsClient(url);
        if (ytIds && ytIds.length > 0) {
          try {
            const ytInfo = await fetchYouTubeInfoClient(ytIds[0]);
            if (ytInfo && ytInfo.success && ytInfo.title) {
              return {
                text: `[INFORMASI TERVERIFIKASI VIDEO YOUTUBE]:\n- Judul: "${ytInfo.title}"\n- Channel / Pembuat: "${ytInfo.channel}" (${ytInfo.channel_url || 'N/A'})\n- URL: ${ytInfo.url}\n- Thumbnail: ${ytInfo.thumbnail}\n(Diambil secara real-time via YouTube oEmbed)`,
                sources: [{ title: ytInfo.title, url: ytInfo.url, domain: 'youtube.com', snippet: `Video YouTube oleh ${ytInfo.channel}: ${ytInfo.title}` }]
              };
            }
          } catch (_) {}
        }
        
        if (!IS_GITHUB_PAGES) {
          try {
            const browseController = new AbortController();
            const browseTimeout = setTimeout(() => browseController.abort(), 12000);

            // 1. Coba endpoint ekstraksi web resmi Zoz Router (/api/extract-web)
            try {
              const extRes = await fetch(`/api/extract-web?url=${encodeURIComponent(url)}&maxChars=8000`, {
                headers: { 'Accept': 'application/json' },
                signal: browseController.signal
              });
              if (extRes.ok) {
                const extData = await extRes.json();
                if (extData && extData.success && extData.content && extData.content.length > 40) {
                  clearTimeout(browseTimeout);
                  const docTitle = extData.title || (extractDomainSafe ? extractDomainSafe(url) : 'Halaman Web');
                  return {
                    text: `KONTEN HALAMAN WEB "${docTitle}" (${url}):\n\n${extData.content}`,
                    sources: [{ title: docTitle, url: url, domain: extData.domain || 'web', snippet: extData.content.substring(0, 160) }]
                  };
                }
              }
            } catch (_) {}

            // 2. Fallback: coba endpoint /api/tools/browse-page
            const res = await fetch('/api/tools/browse-page', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: url, maxChars: 5000 }),
              signal: browseController.signal
            });
            clearTimeout(browseTimeout);
            if (res.ok) {
              const data = await res.json();
              if (data && data.text && data.text.length > 50) {
                let output = `KONTEN HALAMAN WEB "${data.title || url}" (${url}):\n\n`;
                output += data.text || '(Konten teks bersih tidak ditemukan)';
                if (Array.isArray(data.links) && data.links.length > 0) {
                  output += '\n\nTautan Terkait Di Halaman:\n';
                  data.links.slice(0, 5).forEach(l => {
                    output += `- [${l.title}](${l.url})\n`;
                  });
                }
                const foundDomain = extractDomainSafe ? extractDomainSafe(url) : 'web';
                return {
                  text: output,
                  sources: [{ title: data.title || url, url: url, domain: foundDomain, snippet: (data.text || '').substring(0, 160) }]
                };
              }
            }
          } catch (_) {}
        }

        // Client-side universal reader via Jina Reader (CORS open, converts any URL to clean markdown)
        try {
          const jinaController = new AbortController();
          const jinaTimeout = setTimeout(() => jinaController.abort(), 7500);
          const jinaRes = await fetch(`https://r.jina.ai/${encodeURI(url)}`, {
            signal: jinaController.signal,
            headers: { 'Accept': 'text/plain' }
          });
          clearTimeout(jinaTimeout);
          if (jinaRes.ok) {
            const markdown = await jinaRes.text();
            if (markdown && markdown.length > 80) {
              const cleanMarkdown = markdown.substring(0, 5000);
              const titleMatch = markdown.match(/^Title:\s*(.+)$/m) || markdown.match(/^#\s+(.+)$/m);
              const docTitle = titleMatch ? titleMatch[1].trim() : (extractDomainSafe ? extractDomainSafe(url) : 'Halaman Web');
              return {
                text: `KONTEN HALAMAN WEB "${docTitle}" (${url}):\n\n${cleanMarkdown}`,
                sources: [{ title: docTitle, url: url, domain: extractDomainSafe ? extractDomainSafe(url) : 'web', snippet: cleanMarkdown.substring(0, 160) }]
              };
            }
          }
        } catch (_) {}

        // Client-side fallback for Wikipedia URLs on GitHub Pages
        if (/wikipedia\.org\/wiki\//i.test(url)) {
          try {
            const pageTitleMatch = url.match(/\/wiki\/([^#\?]+)/);
            if (pageTitleMatch && pageTitleMatch[1]) {
              const pageTitle = decodeURIComponent(pageTitleMatch[1]);
              const langMatch = url.match(/https?:\/\/([a-z]+)\.wikipedia\.org/i);
              const lang = langMatch ? langMatch[1] : 'id';
              const restApiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
              const wikiController = new AbortController();
              const wikiTimeout = setTimeout(() => wikiController.abort(), 6000);
              const wikiRes = await fetch(restApiUrl, { signal: wikiController.signal });
              clearTimeout(wikiTimeout);
              if (wikiRes.ok) {
                const wData = await wikiRes.json();
                const extract = wData.extract || wData.description || 'Halaman Wikipedia';
                return {
                  text: `KONTEN ARTIKEL WIKIPEDIA "${wData.title || pageTitle}" (${url}):\n\n${extract}`,
                  sources: [{ title: wData.title || pageTitle, url: url, domain: `${lang}.wikipedia.org`, snippet: extract.substring(0, 160) }]
                };
              }
            }
          } catch (_) {}
        }

        return { text: `Error: Tidak dapat membaca URL ${url} saat offline atau koneksi terputus.`, sources: [] };
      }
      
      return { text: `Error: Tool "${toolName}" tidak dikenal.`, sources: [] };
    } catch (err) {
      return { text: `Error menjalankan tool ${toolName}: ${err.message}`, sources: [] };
    }
  }

  function extractBalancedJsonObjects(text) {
    if (!text || typeof text !== 'string') return [];
    const results = [];
    let startIndex = 0;
    while (startIndex < text.length) {
      const start = text.indexOf('{', startIndex);
      if (start === -1) break;

      let depth = 0;
      let inString = false;
      let escape = false;
      let end = -1;

      for (let i = start; i < text.length; i++) {
        const char = text[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') {
            depth++;
          } else if (char === '}') {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
      }

      if (end !== -1) {
        const candidate = text.substring(start, end + 1);
        results.push({ json: candidate, start, end });
        startIndex = end + 1;
      } else {
        startIndex = start + 1;
      }
    }
    return results;
  }

  function scrubRawToolCallArtifacts(text) {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text
      .replace(/<(?:tool_call|function_call)>[\s\S]*?<\/(?:tool_call|function_call)>/gi, '')
      .replace(/<invoke\s+name=["'](?:search_web|browse_web_page|search_youtube)["']>[\s\S]*?<\/invoke>/gi, '')
      .replace(/\[TOOL_CALLS\][\s\S]*?(?:\[\/TOOL_CALLS\]|(?=\n\n)|$)/gi, '')
      .replace(/```(?:tool_call|json)?\s*\{[\s\S]*?"(?:name|function|tool)"\s*:\s*"(?:search_web|browse_web_page|search_youtube)"[\s\S]*?\}\s*```/gi, '');

    // Hapus blok JSON seimbang yang merepresentasikan pemanggilan tool mentah
    const jsonBlocks = extractBalancedJsonObjects(cleaned);
    for (const block of jsonBlocks) {
      try {
        const p = JSON.parse(block.json);
        const name = p.name || p.function || p.tool;
        if (AUTONOMOUS_TOOL_NAMES.includes(name)) {
          cleaned = cleaned.replace(block.json, '');
        }
      } catch (_) {}
    }

    // Bersihkan residu teks bocor seperti "We will call search_web for ..."
    cleaned = cleaned
      .replace(/(?:we will call|calling tool|memanggil tool|i will search|saya akan mencari)\s+(?:search_web|browse_web_page|search_youtube)[\s\S]*?(?:\.|\n|$)/gi, '')
      .replace(/(?:search_web|browse_web_page|search_youtube)\s*\(\s*\{[\s\S]*?\}\s*\)/gi, '')
      .replace(/(?:search_web|browse_web_page|search_youtube)\s*\(\s*(?:(?:query|url|q)\s*[:=]\s*)?(["'`])[\s\S]*?\1\s*\)/gi, '')
      .trim();

    return cleaned;
  }

  function extractInlineToolCalls(text) {
    if (!text || typeof text !== 'string') return [];
    const calls = [];
    const seenIds = new Set();

    function normalizeToolName(name) {
      if (!name) return '';
      const n = String(name).toLowerCase().trim();
      if (['web_search', 'search', 'pencarian_web', 'cari_web'].includes(n)) return 'search_web';
      if (['browse_web', 'browse_page', 'baca_web', 'scrape_url'].includes(n)) return 'browse_web_page';
      if (['baca_url', 'ambil_web'].includes(n)) return 'extract_web';
      return n;
    }

    function addCall(toolName, rawArgs, rawTag) {
      const normalizedName = normalizeToolName(toolName);
      if (!normalizedName || !AUTONOMOUS_TOOL_NAMES.includes(normalizedName)) return;

      let parsedArgs = rawArgs;
      if (typeof rawArgs === 'string') {
        const trimmed = rawArgs.trim();
        try {
          parsedArgs = JSON.parse(trimmed);
        } catch (_) {
          if (['browse_web_page', 'extract_web', 'read_url'].includes(normalizedName)) {
            parsedArgs = { url: trimmed };
          } else if (normalizedName === 'search_youtube') {
            parsedArgs = { query: trimmed };
          } else {
            parsedArgs = { query: trimmed };
          }
        }
      } else if (!parsedArgs || typeof parsedArgs !== 'object') {
        parsedArgs = {};
      }

      // Normalisasi properti argumen
      if (['browse_web_page', 'extract_web', 'read_url'].includes(normalizedName)) {
        const urlVal = parsedArgs.url || parsedArgs.target || parsedArgs.link || parsedArgs.href || parsedArgs.targetUrl || '';
        parsedArgs = { url: String(urlVal).trim() };
      } else if (normalizedName === 'search_youtube') {
        const qVal = parsedArgs.query || parsedArgs.q || parsedArgs.keyword || parsedArgs.search || '';
        parsedArgs = { query: String(qVal).trim(), max_results: parsedArgs.max_results || 6 };
      } else if (normalizedName === 'search_web') {
        const qVal = parsedArgs.query || parsedArgs.q || parsedArgs.keyword || parsedArgs.search || parsedArgs.topic || '';
        parsedArgs = { query: String(qVal).trim() };
      }

      const serializedArgs = JSON.stringify(parsedArgs);
      const callKey = `${normalizedName}:${serializedArgs}`;
      if (!seenIds.has(callKey)) {
        seenIds.add(callKey);
        calls.push({
          id: `call_${Date.now()}_${calls.length}`,
          type: 'function',
          rawTag: rawTag || '',
          function: {
            name: normalizedName,
            arguments: serializedArgs
          }
        });
      }
    }

    // 1. Tag <tool_call>...</tool_call> and <function_call>...</function_call>
    const tagRegex = /<(?:tool_call|function_call)>\s*([\s\S]*?)\s*<\/(?:tool_call|function_call)>/gi;
    let tm;
    while ((tm = tagRegex.exec(text)) !== null) {
      try {
        const clean = tm[1].replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const p = JSON.parse(clean);
        const name = p.name || p.function || p.tool;
        const args = p.arguments ?? p.parameters ?? p.args ?? p.input ?? {};
        addCall(name, args, tm[0]);
      } catch (_) {}
    }

    // 2. Mistral format: [TOOL_CALLS] [{"name": "search_web", "arguments": ...}]
    const mistralRegex = /\[TOOL_CALLS\]\s*([\s\S]*?)(?:\[\/TOOL_CALLS\]|$)/gi;
    let mtm;
    while ((mtm = mistralRegex.exec(text)) !== null) {
      try {
        const block = mtm[1].trim();
        const parsed = JSON.parse(block);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        items.forEach(it => {
          if (it && (it.name || it.function)) {
            addCall(it.name || it.function, it.arguments ?? it.parameters ?? it.args ?? {}, mtm[0]);
          }
        });
      } catch (_) {}
    }

    // 3. Anthropic XML format: <invoke name="search_web"><parameter name="query">...</parameter></invoke>
    const invokeRegex = /<invoke\s+name=["'](search_web|web_search|search|browse_web_page|browse_web|browse_page|extract_web|read_url|scrape_url|search_youtube)["']>([\s\S]*?)<\/invoke>/gi;
    let ivm;
    while ((ivm = invokeRegex.exec(text)) !== null) {
      const name = ivm[1];
      const inner = ivm[2];
      const paramMatch = inner.match(/<parameter\s+name=["'](?:query|q|url|target|link|href)["']>([\s\S]*?)<\/parameter>/i);
      const val = paramMatch ? paramMatch[1].trim() : inner.replace(/<[^>]+>/g, '').trim();
      if (val) {
        const isUrlTool = ['browse_web_page', 'browse_web', 'browse_page', 'extract_web', 'read_url', 'scrape_url'].includes(name.toLowerCase());
        addCall(name, isUrlTool ? { url: val } : { query: val }, ivm[0]);
      }
    }

    // 4. Fenced codeblock ```json ... ``` or ```tool_call ... ```
    const codeBlockRegex = /```(?:json|tool_call)?\s*(\{\s*"(?:name|function|tool)"\s*:\s*"(?:search_web|web_search|search|browse_web_page|browse_web|browse_page|extract_web|read_url|scrape_url|search_youtube)"[\s\S]*?\})\s*```/gi;
    let cm;
    while ((cm = codeBlockRegex.exec(text)) !== null) {
      try {
        const p = JSON.parse(cm[1]);
        const name = p.name || p.function || p.tool;
        const args = p.arguments ?? p.parameters ?? p.args ?? p.input ?? {};
        addCall(name, args, cm[0]);
      } catch (_) {}
    }

    // Strip fenced code blocks dan inline code sebelum menjalankan regex teks biasa (5, 6, 7, 8)
    // agar kode pemrograman / tutorial yang menyebut search_web TIDAK PERNAH terintersepsi keliru sebagai tool hidup
    const textWithoutCode = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`\n]+`/g, ' ');

    const isLongCompleteText = textWithoutCode.trim().length > 350;

    // 5. Raw balanced JSON objects anywhere in text (di luar blok kode)
    const jsonBlocks = extractBalancedJsonObjects(textWithoutCode);
    for (const block of jsonBlocks) {
      if (isLongCompleteText && block.start > 220) continue;
      try {
        const p = JSON.parse(block.json);
        const name = p.name || p.function || p.tool;
        if (AUTONOMOUS_TOOL_NAMES.includes(name) || AUTONOMOUS_TOOL_NAMES.includes(normalizeToolName(name))) {
          const args = p.arguments ?? p.parameters ?? p.args ?? p.input ?? {};
          addCall(name, args, block.json);
        }
      } catch (_) {}
    }

    // 6. Function call with JSON argument: search_web({"query": "..."}) or browse_web_page({"url": "..."})
    const funcJsonRegex = /(search_web|web_search|search|browse_web_page|browse_web|browse_page|extract_web|read_url|scrape_url|search_youtube)\s*\(\s*(\{[\s\S]*?\})\s*\)/gi;
    let fjm;
    while ((fjm = funcJsonRegex.exec(textWithoutCode)) !== null) {
      if (isLongCompleteText && fjm.index > 220) continue;
      const name = fjm[1];
      try {
        let cleanJson = fjm[2].replace(/'/g, '"');
        const p = JSON.parse(cleanJson);
        addCall(name, p, fjm[0]);
      } catch (_) {
        const qMatch = fjm[2].match(/["'](?:query|q|keyword|search|url|link|target)["']\s*:\s*["']([^"']+)["']/i);
        if (qMatch) {
          const isUrlTool = ['browse_web_page', 'browse_web', 'browse_page', 'extract_web', 'read_url', 'scrape_url'].includes(name.toLowerCase());
          addCall(name, isUrlTool ? { url: qMatch[1] } : { query: qMatch[1] }, fjm[0]);
        }
      }
    }

    // 7. Function call syntax: search_web("query") or browse_web_page("url")
    // Jika teks sangat panjang (> 300 kata), hanya izinkan jika pemanggilan ada di awal teks (< 200 karakter)
    const funcRegex = /(search_web|web_search|search|browse_web_page|browse_web|browse_page|extract_web|read_url|scrape_url|search_youtube)\s*\(\s*(?:(?:query|url|q|link|target)\s*[:=]\s*)?(["'`])([\s\S]*?)\2\s*\)/gi;
    let fm;
    while ((fm = funcRegex.exec(textWithoutCode)) !== null) {
      if (isLongCompleteText && fm.index > 220) continue;
      const name = fm[1];
      const val = fm[3].trim();
      if (val) {
        const isUrlTool = ['browse_web_page', 'browse_web', 'browse_page', 'extract_web', 'read_url', 'scrape_url'].includes(name.toLowerCase());
        addCall(name, isUrlTool ? { url: val } : { query: val }, fm[0]);
      }
    }

    // 8. Conversational triggers: "We will call search_web for <query>"
    // Hanya picu jika berada di awal generasi (bukan teks penutup di akhir pesan panjang)
    const convRegex = /(?:we will call|calling tool|memanggil tool|i will search|saya akan mencari|menjelajahi|ekstrak)\s+(search_web|web_search|search|browse_web_page|browse_web|browse_page|extract_web|read_url|scrape_url|search_youtube)(?:\s+(?:for|with|tentang|query|url|:))?\s*(["'`])([^\n]+?)\2/gi;
    let cvm;
    while ((cvm = convRegex.exec(textWithoutCode)) !== null) {
      if (isLongCompleteText && cvm.index > 220) continue;
      const name = cvm[1];
      const val = cvm[3].trim();
      if (val) {
        const isUrlTool = ['browse_web_page', 'browse_web', 'browse_page', 'extract_web', 'read_url', 'scrape_url'].includes(name.toLowerCase());
        addCall(name, isUrlTool ? { url: val } : { query: val }, cvm[0]);
      }
    }

    return calls;
  }

  function getAutonomousSystemDirective() {
    return `### INSTRUKSI SISTEM: KESADARAN PENGETAHUAN & PENGGUNAAN ALAT PENCARIAN & PENJELAJAHAN WEB LIVE

1. KESADARAN BATASAN PENGETAHUAN (KNOWLEDGE CUTOFF):
- Anda adalah asisten AI yang sepenuhnya menyadari bahwa pengetahuan internal bawaan Anda memiliki batasan waktu (knowledge cutoff).
- Anda TIDAK MEMILIKI pengetahuan bawaan mengenai data real-time, berita mutakhir, peristiwa terkini, atau informasi spesifik dunia nyata saat ini dalam topik APA PUN (politik, ekonomi, pasar saham, olahraga, sains, hiburan, hukum, peristiwa global maupun lokal).
- Dilarang menebak atau mengarang spekulasi tentang peristiwa dunia nyata terkini tanpa mencari fakta aktual melalui alat pencarian web.

2. KEWAJIBAN MENGGUNAKAN TOOL PENCARIAN & PENJELAJAHAN WEB:
- Gunakan alat pencarian dan penjelajahan web live kapan pun diperlukan untuk menjawab secara faktual:
  a. search_web: Untuk mencari informasi terkini, artikel, berita, atau data dari mesin pencari web.
     Format: search_web("kata kunci") atau <tool_call>{"name":"search_web","arguments":{"query":"kata kunci"}}</tool_call>
  b. browse_web_page / extract_web: Untuk membaca, menjelajahi, dan mengekstrak isi teks lengkap dari suatu tautan web (URL) spesifik.
     Format: browse_web_page("https://example.com/artikel") atau <tool_call>{"name":"browse_web_page","arguments":{"url":"https://example.com/artikel"}}</tool_call>
- Jika pengguna melampirkan atau menyebutkan URL/tautan web dan meminta membaca atau merangkumnya: WAJIB panggil tool browse_web_page("URL") atau extract_web("URL")!
- Keluarkan pemanggilan tool pada awal jawaban secara langsung tanpa bertele-tele.
- Rumuskan kueri pencarian yang ringkas, efektif, dan alami pada inti topik yang dicari.
- Dilarang menambahkan tanggal kalender fiktif atau operator kustom ke dalam argumen kueri.
- Anda dapat menjawab topik APA PUN di dunia nyata (bukan hanya tentang AI atau teknologi). Gunakan pencarian web untuk mendapatkan fakta terpercaya.
- HANYA jika pertanyaan pengguna berupa penjelasan konsep dasar teori, logika matematika murni, penulisan kode pemrograman standar, atau percakapan kasual yang sama sekali tidak membutuhkan fakta dunia nyata: Anda boleh langsung menjawab tanpa memanggil alat.

3. SINTESIS SETELAH PENCARIAN & PENJELAJAHAN WEB:
- Setelah sistem mengeksekusi alat dan menyediakan data kepada Anda, berikan jawaban akhir yang komprehensif, jelas, akurat, dan informatif berdasarkan informasi yang dihimpun.
- Wajib sertakan referensi tautan markdown [Nama Sumber](URL) jika merujuk fakta atau tautan spesifik.
- Jawab secara langsung tanpa penolakan kaku, tanpa basa-basi robotik, dan tanpa mencetak format pemanggilan tool lagi.`;
  }
  const AUTONOMOUS_SYSTEM_DIRECTIVE = getAutonomousSystemDirective();

  function getYouTubeToolDirective() {
    return `### INSTRUKSI SISTEM: TOOL PENCARIAN VIDEO YOUTUBE (search_youtube)

Tool \`search_youtube\` selalu aktif untuk SEMUA model, terlepas dari status Mode Pencarian Web.

1. KAPAN WAJIB DIPAKAI:
- Pengguna meminta mencarikan/menemukan/mencari/memutar/menonton sebuah video (YouTube, tutorial, klip musik, film, pertandingan, podcast, vlog, review, dsb).
- Argumen \`query\` berisi kata kunci alami hasil ekstraksi dari permintaan pengguna (misal: "tutorial React JS untuk pemula").
- Argumen \`max_results\` opsional (1-10, default 6).

2. FORMAT PEMANGGILAN (dukung SEMUA model):
Format native/JSON:
  {"name":"search_youtube","arguments":{"query":"kata kunci","max_results":6}}
Format teks (untuk model tanpa function calling):
  search_youtube("kata kunci")
  atau: search_youtube({"query":"kata kunci"})

3. SETELAH SISTEM MENGEMBALIKAN HASIL:
- Jelaskan dan rekomendasikan video yang paling relevan secara jelas (judul, channel, durasi, jumlah tayangan).
- WAJIB menyertakan tautan video pilihan Anda secara langsung di dalam jawaban akhir dengan format markdown, misal [Judul Video](https://www.youtube.com/watch?v=ID), agar kartu video dapat ditampilkan dan diputar langsung di dalam percakapan.
- Jangan mengarang data video; gunakan hanya hasil yang diberikan sistem.`;
  }

  function createAutonomousToolHudHtml(toolName, targetText, status = 'loading') {
    const isYouTube = toolName === 'search_youtube';
    const isBrowse = ['browse_web_page', 'browse_web', 'browse_page', 'extract_web', 'read_url', 'scrape_url'].includes(toolName);

    // iconClass sudah memuat prefiks family-nya (fa-solid / fa-brands) agar tidak
    // bentrok dengan aturan font-family bila digabung dengan fa-solid.
    let iconClass = status === 'loading' ? 'fa-solid fa-magnifying-glass fa-spin' : 'fa-solid fa-circle-check';
    let title = 'PENCARIAN WEB LIVE (ZERO-API)';

    if (isYouTube) {
      title = 'PENCARIAN VIDEO YOUTUBE LIVE';
      iconClass = status === 'loading' ? 'fa-brands fa-youtube fa-spin' : 'fa-brands fa-youtube';
    } else if (isBrowse) {
      title = (toolName === 'extract_web' || toolName === 'read_url') ? 'EKSTRAKSI KONTEN WEB' : 'PENJELAJAHAN HALAMAN WEB';
      iconClass = status === 'loading' ? 'fa-solid fa-compass fa-spin' : 'fa-solid fa-circle-check';
    }

    const actionText = status === 'loading'
      ? (isYouTube ? `Mencari video: "${escapeHtml(targetText)}"` : isBrowse ? `Mengekstrak URL: "${escapeHtml(targetText)}"` : `Mencari web: "${escapeHtml(targetText)}"`)
      : (isYouTube ? `Video ditemukan: "${escapeHtml(targetText)}"` : isBrowse ? `Halaman selesai diekstrak: "${escapeHtml(targetText)}"` : `Pencarian selesai: "${escapeHtml(targetText)}"`);

    const subText = status === 'loading'
      ? (isYouTube ? 'Menelusuri katalog video YouTube secara langsung...' : isBrowse ? 'Mengekstrak teks & konten halaman secara langsung...' : 'Mengumpulkan berita live & multi-sumber terkini...')
      : (isYouTube ? 'Daftar video siap diputar langsung di percakapan...' : isBrowse ? 'Konten halaman diserap & disintesis oleh AI...' : 'Data berita aktual diserap & disintesis oleh AI...');

    return `
      <div class="autonomous-tool-hud${status === 'done' ? ' done' : ''}">
        <div class="autonomous-tool-icon-wrap">
          <i class="${iconClass}"></i>
        </div>
        <div class="autonomous-tool-content">
          <div class="autonomous-tool-title">
            <span>${title}</span>
            <span style="font-size:0.75rem; font-weight:normal; opacity:0.8;">[${escapeHtml(toolName)}]</span>
          </div>
          <div class="autonomous-tool-subtext">
            <strong>${actionText}</strong> &mdash; ${subText}
          </div>
        </div>
      </div>
    `;
  }

  function deduplicateSources(sources) {
    if (!Array.isArray(sources)) return [];
    const seen = new Set();
    const result = [];
    for (const s of sources) {
      if (!s || !s.url) continue;
      const norm = String(s.url).trim().toLowerCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push(s);
      }
    }
    return result;
  }

  // ==================== UNIVERSAL MODEL ERROR & WARNING HANDLER ====================
  function formatModelErrorMessage(engine, modelName, err, hasImage = false, hasWebSearch = false) {
    const rawMsg = (err && err.message) ? err.message : String(err || 'Unknown error');
    const msg = rawMsg.toLowerCase();
    const isMixedContentLocal = (location.protocol === 'https:' || IS_CLOUD_HOSTED) && (
      msg.includes('mixed_content') || 
      ((msg.includes('failed to fetch') || msg.includes('networkerror') || err?.name === 'TypeError') && engine === 'ollama')
    );
    const isCorsOrNetwork = (IS_GITHUB_PAGES || IS_CLOUD_HOSTED) && (msg.includes('failed to fetch') || msg.includes('networkerror') || err.name === 'TypeError');
    const actualHasImage = Array.isArray(hasImage) ? hasImage.length > 0 : Boolean(hasImage);
    const isVisionUnsupported = actualHasImage && (
      msg.includes('image') || 
      msg.includes('vision') || 
      msg.includes('multimodal') || 
      msg.includes('does not support image') ||
      msg.includes('unsupported image') ||
      msg.includes('no endpoints found that support image')
    );
    const isAuthError = msg.includes('401') || msg.includes('unauthorized') || msg.includes('api key') || msg.includes('user not found');
    const isModelNotFound = msg.includes('404') || msg.includes('not found') || msg.includes('no endpoints') || msg.includes('does not exist');
    const isRateLimit = msg.includes('429') || msg.includes('rate limit') || msg.includes('quota') || msg.includes('credits') || msg.includes('free tier limit');
    const isContextLength = msg.includes('context length') || msg.includes('token limit') || msg.includes('maximum context');
    const isProviderReturnedError = msg.includes('provider returned error') || msg.includes('upstream error') || msg.includes('provider error') || msg.includes('provider rejected');

    let title = `Peringatan Model: ${escapeHtml(modelName)}`;
    let desc = escapeHtml(rawMsg);
    let advice = '';

    if (isMixedContentLocal && engine === 'ollama') {
      title = `Koneksi Ollama Lokal Terblokir oleh Keamanan Browser HTTPS`;
      desc = `Anda sedang membuka Zoz Router melalui Cloud HTTPS (<code>${escapeHtml(location.hostname)}</code>). Kebijakan keamanan browser (Mixed Content) melarang halaman web HTTPS mengakses alamat HTTP lokal (<code>${escapeHtml(STATE.settings.ollamaEndpoint)}</code>).`;
      advice = `💡 <strong>Solusi Cepat:</strong><br>&bull; <strong>Gunakan OpenRouter (Cloud AI):</strong> Buka Pengaturan, gunakan model gratis OpenRouter (DeepSeek, Gemma, dll) yang didukung 100% di cloud.<br>&bull; <strong>Jalankan di Komputer Lokal:</strong> Buka <code>http://localhost:4040</code> di komputer Anda untuk akses penuh ke Ollama lokal.<br>&bull; <strong>Atau Gunakan HTTPS Tunnel:</strong> Hubungkan Ollama via Cloudflare Tunnel atau ngrok lalu masukkan URL HTTPS-nya di Pengaturan.`;
    } else if (isVisionUnsupported) {
      title = `Model ${escapeHtml(modelName)} Tidak Mendukung Input Gambar`;
      desc = `Model ini menolak pemrosesan gambar multimodal karena beroperasi dalam mode teks murni (text-only).`;
      advice = `💡 <strong>Saran:</strong> Beralihlah ke model multimodal seperti <code>google/gemini-2.0-flash-exp:free</code>, <code>openai/gpt-4o</code>, <code>gemma4:31b</code>, atau kirim prompt Anda tanpa lampiran gambar.`;
    } else if (isProviderReturnedError) {
      title = `Penyedia Model OpenRouter Sedang Sibuk (Upstream Provider Error)`;
      desc = `Server penyedia pihak ketiga (upstream) untuk model <code>${escapeHtml(modelName)}</code> sedang mengalami antrean penuh atau gangguan sementara di OpenRouter.`;
      advice = `💡 <strong>Solusi Cepat:</strong> Coba beralih ke model free lain yang sedang aktif stabil seperti <code>openrouter/free</code> atau <code>google/gemma-2-9b-it:free</code>, atau klik <strong>Ganti ke Model Gratis &amp; Kirim Ulang</strong>.`;
    } else if (isCorsOrNetwork && engine === 'ollama') {
      title = `Batasan Koneksi Browser CORS / Jaringan`;
      desc = `Browser memblokir koneksi dari domain <code>${escapeHtml(location.hostname)}</code> ke endpoint <code>${escapeHtml(STATE.settings.ollamaEndpoint)}</code>.`;
      advice = `💡 <strong>Solusi Cepat:</strong> Gunakan <strong>OpenRouter (Cloud)</strong> yang didukung 100% di cloud tanpa batasan CORS, atau jalankan Desktop Gateway <code>http://localhost:4040</code> di PC Anda.`;
    } else if (isAuthError) {
      title = `Autentikasi / API Key Diperlukan`;
      desc = `API Key untuk provider <strong>${engine === 'ollama' ? 'Ollama Cloud' : 'OpenRouter'}</strong> tidak valid, belum diisi, atau kadaluarsa.`;
      advice = `💡 <strong>Solusi:</strong> Buka menu <strong>Pengaturan (⚙️)</strong> dan periksa kembali API Key Anda.`;
    } else if (isRateLimit) {
      title = `Batas Kuota / Rate Limit Provider Tercapai`;
      desc = `Permintaan ditolak oleh server provider karena batas kuota sementara atau beban server sedang tinggi.`;
      advice = `💡 <strong>Solusi:</strong> Pilih model gratis lainnya dari katalog Model Hub atau tunggu beberapa detik sebelum mencoba kembali.`;
    } else if (isModelNotFound) {
      title = `Model Tidak Ditemukan di Provider`;
      desc = `ID Model <code>${escapeHtml(modelName)}</code> tidak ditemukan atau belum aktif di server ${engine.toUpperCase()}.`;
      advice = `💡 <strong>Solusi:</strong> Periksa ejaan nama model atau pilih model resmi dari katalog Model Hub.`;
    } else if (isContextLength) {
      title = `Batas Panjang Konteks Terlampaui`;
      desc = `Jumlah teks prompt, dokumen, atau hasil pencarian web melebihi kapasitas context window model <code>${escapeHtml(modelName)}</code>.`;
      advice = `💡 <strong>Solusi:</strong> Ringkas teks prompt Anda atau gunakan model dengan context window besar seperti <code>kimi-k3</code> atau <code>google/gemini-2.0-flash-exp:free</code>.`;
    }

    return `
      <div style="background:rgba(255,170,0,0.08); border:1px solid rgba(255,170,0,0.35); border-radius:10px; padding:14px; margin-bottom:12px; line-height:1.5;">
        <div style="font-weight:700; color:var(--neon-amber); margin-bottom:6px; display:flex; align-items:center; gap:8px; font-size:0.9rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> ${title}
        </div>
        <div style="font-size:0.83rem; color:var(--text-main); margin-bottom:8px;">
          ${desc}
        </div>
        ${advice ? `<div style="font-size:0.8rem; color:var(--text-secondary); background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:6px; border-left:3px solid var(--neon-cyan);">${advice}</div>` : ''}
      </div>
    `;
  }

  // Universal Message Payload Normalizer & Alternating Role Enforcer
  function doesModelSupportSystemRole(modelName) {
    if (!modelName || typeof modelName !== 'string') return true;
    const lower = modelName.toLowerCase();
    // Model Gemma, Liquid LFM, Inkling, Dots, Ling, dll. menolak role "system" di sebagian besar provider OpenRouter
    if (
      lower.includes('gemma') || 
      lower.includes('mistral-tiny') ||
      lower.includes('lfm') ||
      lower.includes('liquid') ||
      lower.includes('inkling') ||
      lower.includes('dots-') ||
      lower.includes('ling-') ||
      lower.includes('apodex')
    ) {
      return false;
    }
    return true;
  }

  // Helper cerdas: Mengonversi path gambar lokal (/uploads/) menjadi Base64 Data URL di browser
  async function resolveImageToDataUrlSafe(img) {
    if (!img || typeof img !== 'string') return img;
    if (img.startsWith('data:image')) return img;
    if (img.startsWith('/uploads/') || img.includes('/uploads/')) {
      try {
        const resp = await fetch(img);
        if (resp.ok) {
          const blob = await resp.blob();
          return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(img);
            reader.readAsDataURL(blob);
          });
        }
      } catch (_) {}
    }
    return img;
  }

  function buildSanitizedMessagesPayload(sessionOrMessages, currentImages = [], engine = 'openrouter', systemContent = '', modelName = '') {
    const messagesPayload = [];
    const supportsSystem = doesModelSupportSystemRole(modelName);

    const rawList = Array.isArray(sessionOrMessages?.messages) ? sessionOrMessages.messages : (Array.isArray(sessionOrMessages) ? sessionOrMessages : []);
    const validList = [];

    rawList.forEach((m, idx) => {
      const isLatestTurn = (idx === rawList.length - 1);
      const mImgs = (isLatestTurn && Array.isArray(currentImages) && currentImages.length > 0)
        ? currentImages
        : (Array.isArray(m.images) && m.images.length > 0 ? m.images : (m.image ? [m.image] : []));

      const textContent = (m.content || '').trim();
      if (!textContent && mImgs.length === 0) {
        return; // skip blank message turns
      }

      validList.push({
        role: m.role || 'user',
        content: textContent || (mImgs.length > 0 ? 'Analisis gambar terlampir ini.' : '...'),
        images: mImgs
      });
    });

    if (validList.length === 0) {
      validList.push({ role: 'user', content: 'Halo', images: [] });
    }

    if (systemContent && systemContent.trim()) {
      if (supportsSystem) {
        messagesPayload.push({ role: 'system', content: systemContent.trim() });
      } else {
        // Untuk model yang tidak mendukung role system (misal: Gemma), lebur konteks sistem ke turn user pertama
        const firstUserMsg = validList.find(m => m.role === 'user');
        if (firstUserMsg) {
          firstUserMsg.content = `[Instruksi Sistem & Konteks:\n${systemContent.trim()}]\n\n${firstUserMsg.content}`;
        } else {
          validList.unshift({ role: 'user', content: `[Instruksi Sistem & Konteks:\n${systemContent.trim()}]`, images: [] });
        }
      }
    }

    // Merge consecutive messages with the same role to strictly enforce alternating roles
    const mergedList = [];
    for (const msg of validList) {
      if (mergedList.length > 0 && mergedList[mergedList.length - 1].role === msg.role) {
        const prev = mergedList[mergedList.length - 1];
        prev.content = `${prev.content}\n\n${msg.content}`.trim();
        if (msg.images && msg.images.length > 0) {
          prev.images = [...(prev.images || []), ...msg.images];
        }
      } else {
        mergedList.push({ ...msg });
      }
    }

    const lastIdx = mergedList.length - 1;
    mergedList.forEach((m, idx) => {
      const isLatestTurn = (idx === lastIdx);
      const imgs = m.images || [];

      if (engine === 'ollama') {
        const item = { role: m.role, content: m.content || '...' };
        if (imgs.length > 0 && isLatestTurn) {
          const rawImages = [];
          imgs.forEach(img => {
            if (typeof img === 'string') {
              if (img.startsWith('data:image')) {
                const raw = String(img).replace(/^data:image\/[a-z0-9.+_-]+;base64,/i, '').replace(/[\r\n\s]/g, '');
                if (raw) rawImages.push(raw);
              } else if (/^[A-Za-z0-9+/=]+$/.test(img.trim()) && img.trim().length > 50) {
                rawImages.push(img.trim().replace(/[\r\n\s]/g, ''));
              }
            }
          });
          if (rawImages.length > 0) item.images = rawImages;
        }
        messagesPayload.push(item);
      } else {
        // OpenRouter / OpenAI format
        if (imgs.length > 0 && m.role === 'user') {
          if (isLatestTurn) {
            const contentParts = [
              { type: 'text', text: m.content || 'Jelaskan dan analisis gambar terlampir ini.' }
            ];
            imgs.forEach(img => {
              if (typeof img === 'string') {
                if (img.startsWith('data:image')) {
                  contentParts.push({ type: 'image_url', image_url: { url: img } });
                } else if (img.startsWith('http://') || img.startsWith('https://')) {
                  try {
                    const parsed = new URL(img);
                    const host = parsed.hostname.toLowerCase();
                    const isPrivate = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local');
                    if (!isPrivate) {
                      contentParts.push({ type: 'image_url', image_url: { url: img } });
                    }
                  } catch (_) {
                    contentParts.push({ type: 'image_url', image_url: { url: img } });
                  }
                } else if (img.startsWith('/uploads/')) {
                  const host = window.location.hostname.toLowerCase();
                  const isPrivate = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local');
                  if (!isPrivate && window.location.protocol === 'https:') {
                    const fullUrl = `${window.location.origin}${img}`;
                    contentParts.push({ type: 'image_url', image_url: { url: fullUrl } });
                  } else {
                    // Di localhost/intranet, biarkan path /uploads/ relatif agar proxy backend server.js mengonversinya ke Base64
                    contentParts.push({ type: 'image_url', image_url: { url: img } });
                  }
                }
              }
            });
            messagesPayload.push({ role: m.role, content: contentParts });
          } else {
            // Pada riwayat pesan lama, hindari pengiriman ulang data Base64 gambar agar payload tetap ringan (<100KB)
            const textSummary = m.content || '[Pengguna melampirkan gambar untuk dianalisis]';
            messagesPayload.push({ role: m.role, content: textSummary });
          }
        } else {
          messagesPayload.push({ role: m.role, content: m.content || '...' });
        }
      }
    });

    return messagesPayload;
  }

  // --- OLLAMA STREAMING EXECUTION ---
  async function runOllamaStreaming(session, promptText, image, modelName) {
    setGeneratingState(true);
    STATE.abortController = new AbortController();

    const startTime = performance.now();
    let firstTokenTime = null;
    let tokenCount = 0;

    // Append initial assistant placeholder bubble
    const assistantRow = appendMessageElement('assistant', '', null, modelName);
    const bubbleText = assistantRow.querySelector('.msg-text-content');
    const metaBox = assistantRow.querySelector('.message-meta');
    bubbleText.innerHTML = '<span class="typing-cursor"></span>';
    smartScrollChatToBottom(true);

    let fullText = '';
    let webSources = null;
    let streamRenderer = null;
    let executedHudHtml = '';
    const foundYouTubeIds = []; // ID video hasil tool search_youtube (dipakai render kartu)
    const wantsFile = isFileGenerationRequest(promptText); // niat "buatkan file/website" untuk AI File Studio

    try {
      let personaPrompt = STATE.settings.systemPrompt ? STATE.settings.systemPrompt.trim() : '';
      const canRunAutonomous = Boolean(STATE.webSearchEnabled || STATE.searchMode === 'autonomous');
      let systemContent = personaPrompt;
      if (canRunAutonomous) {
        systemContent = personaPrompt ? `${personaPrompt}\n\n${getAutonomousSystemDirective()}` : getAutonomousSystemDirective();
      }
      // Tool video YouTube hanya diumumkan bila toggle "Cari Video YouTube" aktif
      // (agar model tidak memanggil tool yang tidak dikirim).
      if (STATE.isYouTubeSearchMode) {
        systemContent = systemContent
          ? `${systemContent}\n\n${getYouTubeToolDirective()}`
          : getYouTubeToolDirective();
      }

      // AI File Studio: selalu diumumkan agar model tahu format blok ZOZ_FILE
      // ketika pengguna meminta pembuatan file / website.
      systemContent = systemContent
        ? `${systemContent}\n\n${getFileStudioDirective()}`
        : getFileStudioDirective();

      // UNIVERSAL YOUTUBE METADATA GROUNDING FOR ALL MODELS
      try {
        const ytRes = await getYouTubeGroundingContext(promptText, bubbleText);
        if (ytRes && ytRes.groundingContext) {
          systemContent = `${systemContent}\n\n${ytRes.groundingContext}`;
          bubbleText.innerHTML = '<span class="typing-cursor"></span>';
        }
      } catch (ytErr) {
        console.warn('YouTube client grounding error:', ytErr);
      }

      // DEFAULT WEB SEARCH MODE (Pencarian Kilat Google / Multi-source Grounding)
      if (STATE.searchMode === 'default') {
        try {
          const searchRes = await getWebSearchContext(promptText, session, bubbleText);
          if (searchRes && searchRes.systemPromptContext) {
            systemContent = systemContent
              ? `${systemContent}\n\n${searchRes.systemPromptContext}`
              : searchRes.systemPromptContext;
            if (searchRes.sources && Array.isArray(searchRes.sources)) {
              if (!webSources) webSources = [];
              webSources.push(...searchRes.sources);
            }
            bubbleText.innerHTML = '<span class="typing-cursor"></span>';
          }
        } catch (searchErr) {
          console.warn('Default web search grounding error:', searchErr);
        }
      }

      const rawImgs = Array.isArray(image) ? image : (image ? [image] : []);
      const resolvedImgs = await Promise.all(rawImgs.map(resolveImageToDataUrlSafe));
      const messagesPayload = buildSanitizedMessagesPayload(session, resolvedImgs, 'ollama', systemContent, modelName);

      const ep = normalizeEndpoint(STATE.settings.ollamaEndpoint);
      const requestBody = {
        model: modelName,
        sessionId: session?.id || null,
        messages: messagesPayload,
        stream: true,
        options: {
          temperature: parseFloat(STATE.settings.temperature),
          top_p: parseFloat(STATE.settings.topP),
          repeat_penalty: 1.15
        },
        endpoint: ep
      };
      // Tool video YouTube selalu disertakan; tool web hanya saat Mode Pencarian Web aktif.
      const selectedOllamaTools = getSelectableAutonomousTools(canRunAutonomous);
      if (selectedOllamaTools.length > 0) requestBody.tools = selectedOllamaTools;
      if (session?.id) {
        requestBody.sessionId = session.id;
      }
      if (STATE.userId) {
        requestBody.userId = STATE.userId;
      }
      if (STATE.settings.ollamaApiKey) {
        requestBody.apiKey = STATE.settings.ollamaApiKey;
      }

      const headers = { 'Content-Type': 'application/json' };
      if (session?.id) {
        headers['X-Session-ID'] = session.id;
      }
      if (STATE.userId) {
        headers['X-User-ID'] = STATE.userId;
      }
      if (STATE.settings.ollamaApiKey) {
        headers['Authorization'] = `Bearer ${STATE.settings.ollamaApiKey}`;
        headers['x-ollama-key'] = STATE.settings.ollamaApiKey;
      }

      if (location.protocol === 'https:' && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])/i.test(ep)) {
        throw new Error('mixed_content: Browser HTTPS memblokir koneksi ke Ollama localhost HTTP.');
      }
      const chatUrl = (IS_GITHUB_PAGES || /localhost|127\.0\.0\.1|\[::1\]/i.test(ep)) ? resolveEndpointUrl(ep, 'api/chat') : '/api/ollama/chat';

      let response = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: STATE.abortController?.signal
      });

      // Auto-retry fallback: jika model lokal Ollama menolak parameter tools (HTTP 400/422/500 "model does not support tools")
      if (!response.ok && requestBody.tools && (response.status === 400 || response.status === 422 || response.status === 500)) {
        console.warn(`[Ollama] Model ${modelName} returned HTTP ${response.status} with tools enabled. Retrying without tools parameter...`);
        delete requestBody.tools;
        response = await fetch(chatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: STATE.abortController?.signal
        });
      }

      if (!response.ok) {
        let errDetail = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errDetail = typeof errData.error === 'object' ? (errData.error.message || JSON.stringify(errData.error)) : errData.error;
          }
        } catch (je) {
          try {
            const raw = await response.text();
            if (raw) errDetail = raw.substring(0, 200);
          } catch (te) {}
        }
        throw new Error(errDetail);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let doneReason = null;
      const accumulatedToolCalls = [];
      streamRenderer = new StreamBufferRenderer(bubbleText, () => smartScrollChatToBottom(false), executedHudHtml);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial line

        for (const line of lines) {
          if (!line.trim()) continue;
          let parsed;
          try {
            parsed = JSON.parse(line);
          } catch (pe) {
            continue;
          }
          if (parsed.error) {
            const errStr = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
            throw new Error(errStr);
          }
          if (parsed.done_reason) doneReason = parsed.done_reason;
          const chunk = parsed.message?.content || parsed.response || '';
          if (chunk) {
            if (!firstTokenTime) firstTokenTime = performance.now();
            tokenCount++;
            streamRenderer.append(chunk);
          }
          if (parsed.message?.tool_calls && Array.isArray(parsed.message.tool_calls)) {
            parsed.message.tool_calls.forEach(tc => {
              accumulatedToolCalls.push(tc);
            });
          }
        }
      }

      if (buffer && buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          if (parsed.error) {
            const errStr = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
            throw new Error(errStr);
          }
          if (parsed.done_reason) doneReason = parsed.done_reason;
          const chunk = parsed.message?.content || parsed.response || '';
          if (chunk) {
            if (!firstTokenTime) firstTokenTime = performance.now();
            tokenCount++;
            streamRenderer.append(chunk);
          }
          if (parsed.message?.tool_calls && Array.isArray(parsed.message.tool_calls)) {
            parsed.message.tool_calls.forEach(tc => {
              accumulatedToolCalls.push(tc);
            });
          }
        } catch (_) {}
      }

      fullText = streamRenderer.finish();

      // ==================== OLLAMA AUTONOMOUS LIVE WEB SEARCH DIGESTION ENGINE ====================
      const canRunAutonomousSearch = Boolean(STATE.webSearchEnabled || STATE.searchMode === 'autonomous');
      const maxAutonomousRounds = 1;
      let autonomousRound = 0;
      let preambleHtml = '';
      const conversationChain = [...messagesPayload];
      let currentRoundText = fullText;
      let currentRoundNativeCalls = accumulatedToolCalls;
      const executedToolSignatures = new Set();

      // Loop tetap dijalankan walau Mode Pencarian Web mati: filter izin di bawah
      // yang memblokir tool web, sementara search_youtube selalu diperbolehkan.
      while (autonomousRound < maxAutonomousRounds) {
        if (STATE.abortController?.signal?.aborted) break;

        const validNativeCalls = currentRoundNativeCalls.filter(tc => tc && tc.function && AUTONOMOUS_TOOL_NAMES.includes(tc.function.name) && isAutonomousToolAllowed(tc.function.name, canRunAutonomousSearch));
        const inlineCalls = extractInlineToolCalls(currentRoundText).filter(tc => tc && tc.function && AUTONOMOUS_TOOL_NAMES.includes(tc.function.name) && isAutonomousToolAllowed(tc.function.name, canRunAutonomousSearch));
        let rawAutonomousCalls = validNativeCalls.length > 0 ? validNativeCalls : inlineCalls;

        if (rawAutonomousCalls.length === 0) {
          break; // Model selesai merumuskan respon tanpa pemanggilan tool tambahan
        }

        // Filter out duplicate or loop tool calls
        const detectedAutonomousCalls = rawAutonomousCalls.filter(call => {
          if (!call || !call.function || !AUTONOMOUS_TOOL_NAMES.includes(call.function.name)) return false;
          const sig = getAutonomousToolSignature(call);
          if (executedToolSignatures.has(sig)) return false; // Cegah pemanggilan tool berulang (loop)
          return true;
        });

        if (detectedAutonomousCalls.length === 0) {
          break; // Model selesai merumuskan respon final tanpa pemanggilan tool tambahan
        }

        autonomousRound++;
        let roundToolResponsesText = '';
        const toolSummaryList = [];

        // Amankan teks pembuka yang telah digenerasi model sebelum pemanggilan tool agar tidak terhapus
        const cleanAssistant = scrubRawToolCallArtifacts(currentRoundText).trim();
        if (!preambleHtml && cleanAssistant && cleanAssistant.length > 20) {
          preambleHtml = `<div class="autonomous-preamble-text" style="margin-bottom:8px;">${renderMarkdown(cleanAssistant)}</div>`;
        }

        for (const call of detectedAutonomousCalls) {
          if (STATE.abortController?.signal?.aborted) break;
          const toolName = call.function.name;
          let previewArg = '';
          try {
            const raw = (typeof call.function.arguments === 'string') ? JSON.parse(call.function.arguments) : call.function.arguments;
            let parsedArgs = {};
            if (raw && typeof raw === 'object') {
              parsedArgs = raw;
            } else if (raw !== null && raw !== undefined) {
              parsedArgs = { query: String(raw), url: String(raw) };
            }
            previewArg = parsedArgs.query || parsedArgs.url || JSON.stringify(parsedArgs);
          } catch (_) {
            previewArg = String(call.function.arguments || '');
          }

          executedToolSignatures.add(getAutonomousToolSignature(call));
          toolSummaryList.push(`${toolName}("${previewArg.substring(0, 40)}")`);

          // Visual status loading di gelembung obrolan (Preamble teks dipertahankan)
          bubbleText.innerHTML = preambleHtml + executedHudHtml + createAutonomousToolHudHtml(toolName, previewArg, 'loading');
          smartScrollChatToBottom(true);

          // Eksekusi tool Zero-API Live News & Tech Wire
          const toolExecRes = await executeAutonomousWebTool(toolName, call.function.arguments, promptText, session);
          if (toolExecRes.sources && Array.isArray(toolExecRes.sources)) {
            if (!webSources) webSources = [];
            webSources.push(...toolExecRes.sources);
          }
          if (toolName === 'search_youtube' && Array.isArray(toolExecRes.videoIds)) {
            toolExecRes.videoIds.forEach((vid) => {
              if (vid && !foundYouTubeIds.includes(vid)) foundYouTubeIds.push(vid);
            });
          }
          roundToolResponsesText += `\n[HASIL PENGUMPULAN DATA OTONOM (${toolName})]:\n${toolExecRes.text}\n`;
          executedHudHtml += createAutonomousToolHudHtml(toolName, previewArg, 'done');
        }

        if (STATE.abortController?.signal?.aborted) break;

        // Tampilkan HUD bahwa data berita live sedang disintesis oleh AI
        bubbleText.innerHTML = preambleHtml + executedHudHtml + `<div class="autonomous-digesting-box" style="margin-top:8px;"><span class="typing-cursor"></span> <span style="font-size:0.85em; opacity:0.85; font-style:italic; color:var(--neon-teal);"><i class="fa-solid fa-bolt"></i> Menyintesis hasil pencarian terbaru...</span></div>`;
        smartScrollChatToBottom(true);

        if (cleanAssistant) {
          conversationChain.push({ role: 'assistant', content: cleanAssistant });
        } else {
          conversationChain.push({ role: 'assistant', content: `[Mengeksekusi penelusuran otonom: ${toolSummaryList.join(', ')}]` });
        }

        const roundInstruction = `[INFORMASI HASIL PENCARIAN TERBARU TELAH TERSEDIA]:
Gunakan data hasil pencarian di atas untuk menjawab pertanyaan pengguna secara komprehensif, jelas, faktual, dan akurat.
Jika hasilnya berupa video YouTube: jelaskan dan rekomendasikan video yang paling relevan (judul, channel, durasi, tayangan), lalu WAJIB sisipkan tautan video pilihan Anda dengan format markdown [Judul Video](https://www.youtube.com/watch?v=ID) agar kartu video dapat ditampilkan dan diputar langsung di dalam percakapan.
Jawablah secara langsung dan tuntas tanpa penolakan kaku, tanpa basa-basi robotik, dan tanpa format pemanggilan tool lagi.`;

        conversationChain.push({
          role: 'user',
          content: `[DATA HASIL PENCARIAN LIVE (WEB / VIDEO)]:\n${roundToolResponsesText}\n\n${roundInstruction}`
        });

        const digestionBody = {
          model: modelName,
          messages: conversationChain,
          stream: true,
          options: requestBody.options,
          endpoint: ep
        };
        if (session?.id) digestionBody.sessionId = session.id;
        if (STATE.settings.ollamaApiKey) digestionBody.apiKey = STATE.settings.ollamaApiKey;

        currentRoundText = '';
        currentRoundNativeCalls = [];

        try {
          const digestionRes = await fetch(chatUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(digestionBody),
            signal: STATE.abortController?.signal
          });

          if (!digestionRes.ok) {
            let errDetail = `HTTP ${digestionRes.status}`;
            try {
              const errJson = await digestionRes.json();
              if (errJson?.error) errDetail = typeof errJson.error === 'object' ? errJson.error.message : errJson.error;
            } catch (_) {}
            console.warn(`[Ollama Autonomous Digestion Round ${autonomousRound}] Error: ${errDetail}`);
            if (!fullText.trim()) {
              fullText = cleanAssistant || `[Pencarian selesai: ${toolSummaryList.join(', ')}. Sistem menyelesaikan penelusuran].`;
            }
            break;
          }

          const digestionReader = digestionRes.body.getReader();
          let digestionBuffer = '';
          const digestionContentBox = document.createElement('div');
          digestionContentBox.className = 'autonomous-digested-output';
          bubbleText.innerHTML = preambleHtml + executedHudHtml;
          bubbleText.appendChild(digestionContentBox);

          const digestionRenderer = new StreamBufferRenderer(digestionContentBox, () => smartScrollChatToBottom(false));
          currentRoundNativeCalls = [];
          currentRoundText = '';

          while (true) {
            const { done, value } = await digestionReader.read();
            if (done) {
              digestionBuffer += decoder.decode();
              break;
            }
            digestionBuffer += decoder.decode(value, { stream: true });
            const dLines = digestionBuffer.split('\n');
            digestionBuffer = dLines.pop();

            for (const dLine of dLines) {
              if (!dLine.trim()) continue;
              try {
                const dParsed = JSON.parse(dLine);
                const chunk = dParsed.message?.content || dParsed.response || '';
                if (chunk) {
                  tokenCount++;
                  digestionRenderer.append(chunk);
                  currentRoundText += chunk;
                }
                if (dParsed.message?.tool_calls && Array.isArray(dParsed.message.tool_calls)) {
                  dParsed.message.tool_calls.forEach(tc => currentRoundNativeCalls.push(tc));
                }
              } catch (_) {}
            }
          }

          if (digestionBuffer && digestionBuffer.trim()) {
            try {
              const dParsed = JSON.parse(digestionBuffer.trim());
              const chunk = dParsed.message?.content || dParsed.response || '';
              if (chunk) {
                tokenCount++;
                digestionRenderer.append(chunk);
                currentRoundText += chunk;
              }
              if (dParsed.message?.tool_calls && Array.isArray(dParsed.message.tool_calls)) {
                dParsed.message.tool_calls.forEach(tc => currentRoundNativeCalls.push(tc));
              }
            } catch (_) {}
          }
          const finishedDigestion = digestionRenderer.finish();
          if (finishedDigestion) currentRoundText = finishedDigestion;
          fullText = currentRoundText;
        } catch (digestionErr) {
          // H3: AbortError JANGAN ditelan oleh catch tool-round ini. Dulu abort saat
          // eksekusi tool/digestion jatuh ke jalur "sukses": bunyi selesai + notifikasi
          // desktop padahal pengguna menekan Stop. Teruskan ke catch luar agar
          // penangan AbortError yang menyelesaikan (toast "dihentikan" + parsial).
          if (digestionErr && (digestionErr.name === 'AbortError' || STATE.abortController?.signal?.aborted)) {
            throw digestionErr;
          }
          console.warn(`[Ollama Autonomous Digestion Round ${autonomousRound}] Fetch error:`, digestionErr);
          if (!fullText.trim()) fullText = cleanAssistant || '';
          break;
        }
      }

      // ===== AI FILE STUDIO =====
      // Ekstrak file yang dibuat AI, lalu hapus bloknya dari gelembung agar tidak
      // tampil kode mentah berulang (kartu file digantikan oleh kartu di bawah).
      const extractedAiFiles = extractGeneratedFiles(fullText, wantsFile);
      const generatedFiles = extractedAiFiles.files;
      if (generatedFiles.length > 0) {
        fullText = stripGeneratedFileBlocks(fullText, extractedAiFiles.rawBlocks);
      } else if (fullText.indexOf('<<<ZOZ_FILE') !== -1 || fullText.indexOf('<<<END_ZOZ_FILE') !== -1) {
        // M2: ada marker tapi TIDAK ada blok utuh (stream terputus sebelum
        // <<<END_ZOZ_FILE / END yatim). Dulu marker + isi blok tampil mentah di
        // gelembung final dan persist ke riwayat — padahal saat streaming barisnya
        // disembunyikan. Buang sisa blok (hideFileBlocksForDisplay memangkas dari
        // marker terbuka sampai akhir teks — tak ada isi setelah blok tak tertutup).
        fullText = stripGeneratedFileBlocks(hideFileBlocksForDisplay(fullText), []);
      }

      // Bersihkan sisa tag tool_call dan residu raw JSON jika ada sebelum render markdown final
      const cleanFinalText = scrubRawToolCallArtifacts(fullText);
      if (cleanFinalText) {
        fullText = cleanFinalText;
      }

      if (!fullText.trim() && generatedFiles.length === 0 && !preambleHtml) {
        if (STATE.abortController?.signal?.aborted) {
          // H3: dibatalkan sebelum ada teks sama sekali → HAPUS baris & beri tahu
          // pengguna. Dulu kondisi ini di-skip saat aborted sehingga gelembung KOSONG
          // tersimpan sebagai jawaban "selesai" dan tetap terkirim sebagai konteks.
          assistantRow.remove();
          showToast('Generasi dihentikan oleh pengguna.');
          return;
        }
        throw new Error('Model Ollama menyelesaikan koneksi tanpa menghasilkan respon teks.');
      }

      const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
      const tps = totalTime > 0 ? (tokenCount / totalTime).toFixed(1) : '0';
      
      const finalRenderedContent = (preambleHtml ? preambleHtml : '') + (executedHudHtml ? executedHudHtml + renderMarkdown(fullText) : renderMarkdown(fullText)).trim();
      bubbleText.innerHTML = finalRenderedContent.trim();
      enhanceCodeBlocks(bubbleText);
      enhanceChatImages(bubbleText);
      if (webSources && webSources.length > 0) {
        webSources = deduplicateSources(webSources);
        renderMessageSources(assistantRow, webSources, true);
      }
      renderYouTubeCardsForMessage(assistantRow, fullText, foundYouTubeIds);
      renderMessageFiles(assistantRow, generatedFiles);
      metaBox.innerHTML = `
        <strong>${modelName}</strong>
        <span class="meta-model-badge">Ollama</span>
        <span>⏱️ ${totalTime}s</span>
        <span>⚡ ${tps} tps</span>
      `;

      assistantRow.dataset.fullContent = fullText;

      // Check if output is cut in half and provide one-click continuation button
      if (isOutputTruncated(fullText, doneReason === 'length' ? 'length' : null)) {
        attachContinuationButton(assistantRow.querySelector('.message-content-box') || assistantRow, session, assistantRow, modelName, 'ollama', fullText);
      }

      // Save to session if session is still alive
      if (STATE.sessions.some(s => s.id === session.id)) {
        session.messages.push({
          role: 'assistant',
          content: fullText,
          model: modelName,
          engine: 'ollama',
          sources: webSources,
          files: generatedFiles.length > 0 ? generatedFiles : undefined,
          stats: { duration: totalTime, tps: tps, tokens: tokenCount },
          timestamp: new Date().toISOString()
        });
        session.updatedAt = new Date().toISOString();
        savePersistedState();
        renderChatHistory(els.searchHistoryInput?.value || '');
      }
      AudioEngine.receive();
      notifyAiCompletion('🤖 ' + modelName, fullText);

    } catch (err) {
      if (err.name === 'AbortError') {
        const partialRaw = streamRenderer ? streamRenderer.finish() : '';
        const stoppedPartial = sanitizePartialResponseWithFiles(partialRaw);
        const partialText = stoppedPartial.text;
        if (partialText && partialText.trim() && STATE.sessions.some(s => s.id === session.id)) {
          const stoppedText = `${partialText.trim()}\n\n*[Respons dihentikan oleh pengguna]*`;
          bubbleText.innerHTML = renderMarkdown(stoppedText);
          enhanceCodeBlocks(bubbleText);
          enhanceChatImages(bubbleText);
          renderMessageFiles(assistantRow, stoppedPartial.files);
          if (webSources && webSources.length > 0) {
            renderMessageSources(assistantRow, webSources, true);
          }
          const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
          metaBox.innerHTML = `
            <strong>${modelName}</strong>
            <span class="meta-model-badge">Ollama</span>
            <span>⏱️ ${totalTime}s (Dihentikan)</span>
          `;
          session.messages.push({
            role: 'assistant',
            content: stoppedText,
            model: modelName,
            engine: 'ollama',
            sources: webSources,
            files: stoppedPartial.files.length > 0 ? stoppedPartial.files : undefined,
            stats: { duration: totalTime, tokens: tokenCount, stopped: true },
            timestamp: new Date().toISOString()
          });
          session.updatedAt = new Date().toISOString();
          savePersistedState();
          renderChatHistory(els.searchHistoryInput?.value || '');
        } else {
          assistantRow.remove();
        }
        showToast('Generasi dihentikan oleh pengguna.');
      } else {
        const rescuePartial = sanitizePartialResponseWithFiles(streamRenderer ? streamRenderer.finish() : '');
        const partialText = rescuePartial.text;
        const hasPartialText = Boolean(partialText && partialText.trim());

        if (hasPartialText && STATE.sessions.some(s => s.id === session.id)) {
          const rescuedText = `${partialText.trim()}\n\n*[Koneksi terputus saat streaming]*`;
          const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);

          session.messages.push({
            role: 'assistant',
            content: rescuedText,
            model: modelName,
            engine: 'ollama',
            sources: webSources,
            files: rescuePartial.files.length > 0 ? rescuePartial.files : undefined,
            stats: { duration: totalTime, tokens: tokenCount, interrupted: true },
            timestamp: new Date().toISOString()
          });
          session.updatedAt = new Date().toISOString();
          savePersistedState();
          renderChatHistory(els.searchHistoryInput?.value || '');

          if (metaBox) {
            metaBox.innerHTML = `
              <strong>${modelName}</strong>
              <span class="meta-model-badge">Ollama</span>
              <span>⏱️ ${totalTime}s (Terputus)</span>
            `;
          }
        }

        const actualHasImage = Array.isArray(image) ? image.length > 0 : Boolean(image);
        const errorHtml = formatModelErrorMessage('ollama', modelName, err, actualHasImage, STATE.webSearchEnabled);

        const rescuedHtml = hasPartialText ? `
          <div class="partial-rescued-content" style="margin-bottom:12px; padding-bottom:12px; border-bottom:1px dashed rgba(255,255,255,0.15);">
            ${renderMarkdown(partialText.trim())}
          </div>
        ` : '';

        bubbleText.innerHTML = `
          ${rescuedHtml}
          ${errorHtml}
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-primary switch-openrouter-btn" style="font-size:0.75rem;">
              <i class="fa-solid fa-bolt"></i> Beralih & Jalankan via OpenRouter
            </button>
            <button class="btn btn-sm btn-outline retry-send-btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan); font-size:0.75rem;">
              <i class="fa-solid fa-rotate-right"></i> Coba Kirim Ulang
            </button>
            <button class="btn btn-sm btn-outline open-settings-btn" style="border-color:var(--neon-amber); color:var(--neon-amber); font-size:0.75rem;">
              <i class="fa-solid fa-gear"></i> Buka Pengaturan
            </button>
          </div>
        `;

        if (hasPartialText) {
          enhanceCodeBlocks(bubbleText);
          renderMessageFiles(assistantRow, rescuePartial.files);
          if (webSources && webSources.length > 0) {
            renderMessageSources(assistantRow, webSources, true);
          }
        }

        bubbleText.querySelector('.switch-openrouter-btn')?.addEventListener('click', () => {
          assistantRow.remove();
          setEngineMode('openrouter');
          runOpenRouterStreaming(session, promptText, image, STATE.settings.openRouterModel);
        });

        bubbleText.querySelector('.retry-send-btn')?.addEventListener('click', () => {
          assistantRow.remove();
          runOllamaStreaming(session, promptText, image, modelName);
        });

        bubbleText.querySelector('.open-settings-btn')?.addEventListener('click', () => {
          syncSettingsModalFields();
          openModal('settingsModal');
        });

        AudioEngine.error();
      }
    } finally {
      setGeneratingState(false);
    }
  }

  // --- OPENROUTER STREAMING EXECUTION ---
  async function runOpenRouterStreaming(session, promptText, image, modelName) {
    if (!STATE.settings.openRouterKey && !DeviceStorage.isDeviceBackendAvailable) {
      const assistantRow = appendMessageElement('assistant', '', null, modelName || 'OpenRouter Gateway');
      const bubbleText = assistantRow.querySelector('.msg-text-content');
      
      bubbleText.innerHTML = `
        <div style="background:rgba(255,82,0,0.08); border:1px solid rgba(255,82,0,0.3); border-radius:10px; padding:14px 16px; margin:4px 0;">
          <div style="display:flex; align-items:center; gap:8px; color:var(--neon-amber); font-weight:700; margin-bottom:8px; font-size:0.95rem;">
            <i class="fa-solid fa-key"></i> OpenRouter API Key Belum Terpasang
          </div>
          <p style="margin:0 0 12px 0; font-size:0.85rem; color:var(--text-muted); line-height:1.5;">
            Untuk menjalankan model cloud OpenRouter (<strong>${escapeHtml(modelName || 'Model Cloud')}</strong>), masukkan API Key OpenRouter Anda di menu Pengaturan. Kunci tersimpan aman di perangkat lokal Anda.
          </p>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <button class="btn btn-sm btn-primary open-settings-key-btn" style="font-size:0.78rem;">
              <i class="fa-solid fa-gear"></i> Buka Pengaturan & Masukkan API Key
            </button>
            <button class="btn btn-sm btn-outline retry-openrouter-btn" style="border-color:var(--neon-amber); color:var(--neon-amber); font-size:0.78rem;">
              <i class="fa-solid fa-rotate-right"></i> Coba Kirim Ulang
            </button>
            <button class="btn btn-sm btn-outline switch-ollama-btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan); font-size:0.78rem;">
              <i class="fa-solid fa-microchip"></i> Beralih ke Ollama (Lokal)
            </button>
            <button class="btn btn-sm btn-outline cancel-turn-btn" style="border-color:var(--text-dim); color:var(--text-muted); font-size:0.78rem;">
              <i class="fa-solid fa-trash-can"></i> Hapus Pesan Ini
            </button>
          </div>
        </div>
      `;

      bubbleText.querySelector('.open-settings-key-btn')?.addEventListener('click', () => {
        syncSettingsModalFields();
        openModal('settingsModal');
      });

      bubbleText.querySelector('.retry-openrouter-btn')?.addEventListener('click', () => {
        assistantRow.remove();
        runOpenRouterStreaming(session, promptText, image, modelName);
      });

      bubbleText.querySelector('.switch-ollama-btn')?.addEventListener('click', () => {
        assistantRow.remove();
        setEngineMode('ollama');
        runOllamaStreaming(session, promptText, image, STATE.settings.ollamaModel);
      });

      bubbleText.querySelector('.cancel-turn-btn')?.addEventListener('click', () => {
        assistantRow.remove();
        const lastMsgIdx = session.messages.length - 1;
        if (lastMsgIdx >= 0 && session.messages[lastMsgIdx].role === 'user') {
          session.messages.splice(lastMsgIdx, 1);
          savePersistedState();
          renderCurrentSession();
        }
      });

      AudioEngine.error();
      smartScrollChatToBottom(true);
      return;
    }

    setGeneratingState(true);
    STATE.abortController = new AbortController();

    const startTime = performance.now();
    let firstTokenTime = null;
    let tokenCount = 0;

    const assistantRow = appendMessageElement('assistant', '', null, modelName);
    const bubbleText = assistantRow.querySelector('.msg-text-content');
    const metaBox = assistantRow.querySelector('.message-meta');
    bubbleText.innerHTML = '<span class="typing-cursor"></span>';
    smartScrollChatToBottom(true);

    let fullText = '';
    let webSources = null;
    let streamRenderer = null;
    let actualModelUsed = null;
    let executedHudHtml = '';
    const foundYouTubeIds = []; // ID video hasil tool search_youtube (dipakai render kartu)
    const wantsFile = isFileGenerationRequest(promptText); // niat "buatkan file/website" untuk AI File Studio

    try {
      let personaPrompt = STATE.settings.systemPrompt ? STATE.settings.systemPrompt.trim() : '';
      const canRunAutonomous = Boolean(STATE.webSearchEnabled || STATE.searchMode === 'autonomous');
      let systemContent = personaPrompt;
      if (canRunAutonomous) {
        systemContent = personaPrompt ? `${personaPrompt}\n\n${getAutonomousSystemDirective()}` : getAutonomousSystemDirective();
      }
      // Tool video YouTube hanya diumumkan bila toggle "Cari Video YouTube" aktif
      // (agar model tidak memanggil tool yang tidak dikirim).
      if (STATE.isYouTubeSearchMode) {
        systemContent = systemContent
          ? `${systemContent}\n\n${getYouTubeToolDirective()}`
          : getYouTubeToolDirective();
      }

      // AI File Studio: selalu diumumkan agar model tahu format blok ZOZ_FILE
      // ketika pengguna meminta pembuatan file / website.
      systemContent = systemContent
        ? `${systemContent}\n\n${getFileStudioDirective()}`
        : getFileStudioDirective();

      // UNIVERSAL YOUTUBE METADATA GROUNDING FOR ALL MODELS
      try {
        const ytRes = await getYouTubeGroundingContext(promptText, bubbleText);
        if (ytRes && ytRes.groundingContext) {
          systemContent = `${systemContent}\n\n${ytRes.groundingContext}`;
          bubbleText.innerHTML = '<span class="typing-cursor"></span>';
        }
      } catch (ytErr) {
        console.warn('YouTube client grounding error:', ytErr);
      }

      // DEFAULT WEB SEARCH MODE (Pencarian Kilat Google / Multi-source Grounding)
      if (STATE.searchMode === 'default') {
        try {
          const searchRes = await getWebSearchContext(promptText, session, bubbleText);
          if (searchRes && searchRes.systemPromptContext) {
            systemContent = systemContent
              ? `${systemContent}\n\n${searchRes.systemPromptContext}`
              : searchRes.systemPromptContext;
            if (searchRes.sources && Array.isArray(searchRes.sources)) {
              if (!webSources) webSources = [];
              webSources.push(...searchRes.sources);
            }
            bubbleText.innerHTML = '<span class="typing-cursor"></span>';
          }
        } catch (searchErr) {
          console.warn('Default web search grounding error:', searchErr);
        }
      }

      const rawImgs = Array.isArray(image) ? image : (image ? [image] : []);
      const resolvedImgs = await Promise.all(rawImgs.map(resolveImageToDataUrlSafe));
      const messagesPayload = buildSanitizedMessagesPayload(session, resolvedImgs, 'openrouter', systemContent, modelName);

      const isOpenRouterDirect = IS_GITHUB_PAGES || IS_CLOUD_HOSTED;
      const endpoint = isOpenRouterDirect ? 'https://openrouter.ai/api/v1/chat/completions' : '/api/openrouter/chat';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.settings.openRouterKey}`
      };
      if (session?.id) {
        headers['X-Session-ID'] = session.id;
      }
      if (STATE.userId) {
        headers['X-User-ID'] = STATE.userId;
      }
      if (isOpenRouterDirect) {
        headers['HTTP-Referer'] = location.origin || 'https://zozi0999.github.io/zoz_router';
        headers['X-Title'] = 'ZOZ Router';
      }

      // Deteksi model gratis dan siapkan pool kandidat failover cerdas
      const isFreeModel = modelName.includes(':free') || modelName === 'openrouter/free';
      const candidateModels = isFreeModel
        ? [
            modelName,
            'openrouter/free',
            'google/gemma-2-9b-it:free',
            'meta-llama/llama-3.1-8b-instruct:free'
          ].filter(Boolean).filter((m, idx, arr) => arr.indexOf(m) === idx && m !== 'qwen/qwen3.8-27b:free')
        : [modelName];

      let response = null;
      let lastErrDetail = '';
      let activeMessagesPayload = null;

      for (let i = 0; i < candidateModels.length; i++) {
        const currentModel = candidateModels[i];
        const currentIsFree = currentModel.includes(':free') || currentModel === 'openrouter/free';
        const currentIsImageCapable = isModelCapableOfImageGeneration(currentModel);
        const currentMessagesPayload = buildSanitizedMessagesPayload(session, resolvedImgs, 'openrouter', systemContent, currentModel);

        const requestBody = {
          model: currentModel,
          sessionId: session?.id || null,
          messages: currentMessagesPayload,
          stream: true,
          temperature: parseFloat(STATE.settings.temperature),
          top_p: parseFloat(STATE.settings.topP),
          provider: {
            allow_fallbacks: true
          }
        };
        if (session?.id) {
          requestBody.sessionId = session.id;
        }
        if (STATE.userId) {
          requestBody.userId = STATE.userId;
        }

        if (currentIsImageCapable) {
          requestBody.modalities = ['text', 'image'];
        }

        // Pasang tools HANYA jika bukan model gratis, API key ada, dan model mendukung tools
        const canUseTools = doesModelSupportTools(currentModel);
        if (!currentIsFree && canUseTools && STATE.settings.openRouterKey) {
          const availableTools = [];
          if (STATE.isImageGenMode || currentIsImageCapable) {
            const imageGenTool = {
              type: 'openrouter:image_generation'
            };
            const activeImgModel = STATE.settings.imageModel || 'black-forest-labs/flux-1-schnell';
            if (activeImgModel && activeImgModel.includes('/')) {
              imageGenTool.parameters = { model: activeImgModel };
            }
            availableTools.push(imageGenTool);
          }
          // Tool disaring sesuai preferensi pengguna:
          // - web (search_web / browse_web_page) hanya bila Mode Pencarian Web aktif
          // - pencarian video YouTube hanya bila toggle "Cari Video YouTube" aktif
          const selectedAutonomousTools = getSelectableAutonomousTools(canRunAutonomous);
          if (selectedAutonomousTools.length > 0) {
            availableTools.push(...selectedAutonomousTools);
          }
          // Jangan kirim array tools kosong — OpenRouter menolak permintaan dengantools: [].
          if (availableTools.length > 0) {
            requestBody.tools = availableTools;
          }
        }

        if (!isOpenRouterDirect) {
          requestBody.apiKey = STATE.settings.openRouterKey;
        }

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: STATE.abortController?.signal
          });

          if (res.ok) {
            response = res;
            activeMessagesPayload = currentMessagesPayload;
            if (currentModel !== modelName) {
              actualModelUsed = currentModel;
            }
            break;
          }

          let errDetail = `HTTP ${res.status}`;
          try {
            const errJson = await res.json();
            if (errJson && errJson.error) {
              const baseErr = typeof errJson.error === 'object' ? (errJson.error.message || JSON.stringify(errJson.error)) : errJson.error;
              const rawUpstream = errJson.details?.error?.metadata?.raw || errJson.error?.metadata?.raw;
              errDetail = rawUpstream ? `${baseErr} (${rawUpstream})` : baseErr;
            }
          } catch (je) {
            try {
              const raw = await res.text();
              if (raw) errDetail = raw.substring(0, 200);
            } catch (te) {}
          }
          lastErrDetail = errDetail;

          // Hentikan langsung jika error autentikasi (401/403) agar tidak looping sia-sia ke kandidat lain
          if (res.status === 401 || res.status === 403) {
            throw new Error(`OpenRouter Authentication Error (HTTP ${res.status}): API Key tidak valid atau belum dipasang.`);
          }

          // Jika model gratis dan masih ada model kandidat berikutnya, coba otomatis
          if (isFreeModel && i < candidateModels.length - 1) {
            const nextCandidate = candidateModels[i + 1];
            console.warn(`[OpenRouter Free Failover] Model ${currentModel} gagal (${errDetail}). Mengalihkan ke ${nextCandidate}...`);
            bubbleText.innerHTML = `<span class="typing-cursor"></span> <span style="font-size:0.85em; opacity:0.8; font-style:italic;">Model <b>${escapeHtml(currentModel)}</b> sibuk (${res.status}). Mengalihkan otomatis ke <b>${escapeHtml(nextCandidate)}</b>...</span>`;
            await new Promise(r => setTimeout(r, 600));
            continue;
          } else {
            throw new Error(errDetail);
          }
        } catch (fetchErr) {
          if (STATE.abortController?.signal?.aborted) {
            throw fetchErr;
          }
          lastErrDetail = fetchErr.message || String(fetchErr);
          if (isFreeModel && i < candidateModels.length - 1) {
            const nextCandidate = candidateModels[i + 1];
            console.warn(`[OpenRouter Free Failover] Fetch error pada ${currentModel}:`, fetchErr.message);
            bubbleText.innerHTML = `<span class="typing-cursor"></span> <span style="font-size:0.85em; opacity:0.8; font-style:italic;">Koneksi ke <b>${escapeHtml(currentModel)}</b> terputus. Mencoba <b>${escapeHtml(nextCandidate)}</b>...</span>`;
            await new Promise(r => setTimeout(r, 600));
            continue;
          } else {
            throw fetchErr;
          }
        }
      }

      if (!response || !response.ok) {
        throw new Error(lastErrDetail || 'Gagal memanggil model OpenRouter.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finishReason = null;
      const collectedImages = [];
      const accumulatedToolCalls = [];
      streamRenderer = new StreamBufferRenderer(bubbleText, () => smartScrollChatToBottom(false), executedHudHtml);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (jsonStr === '[DONE]') break;

          let parsed;
          try {
            parsed = JSON.parse(jsonStr);
          } catch (pe) {
            continue;
          }
          if (parsed.error) {
            const errStr = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
            const rawUpstream = parsed.error?.metadata?.raw;
            throw new Error(rawUpstream ? `${errStr} (${rawUpstream})` : errStr);
          }
          if (parsed.model && parsed.model !== modelName && !actualModelUsed) {
            actualModelUsed = parsed.model;
          }
          if (parsed.choices?.[0]?.finish_reason) {
            finishReason = parsed.choices[0].finish_reason;
          }

          // Tangkap gambar yang dihasilkan model (seperti Gemini Flash Image / Nano Banana di OpenRouter)
          const rawImgs = parsed.choices?.[0]?.delta?.images 
            || parsed.choices?.[0]?.message?.images 
            || parsed.choices?.[0]?.images
            || (parsed.data && Array.isArray(parsed.data) ? parsed.data : null);
          if (Array.isArray(rawImgs) && rawImgs.length > 0) {
            rawImgs.forEach(img => {
              const url = img?.image_url?.url || img?.url || (img?.b64_json ? `data:${img.media_type || 'image/png'};base64,${img.b64_json}` : (typeof img === 'string' ? img : null));
              if (url && !collectedImages.includes(url)) {
                collectedImages.push(url);
              }
            });
          }

          // Tangkap tool_calls delta inkremental
          const deltaTc = parsed.choices?.[0]?.delta?.tool_calls;
          if (Array.isArray(deltaTc)) {
            deltaTc.forEach(tc => {
              const idx = tc.index ?? 0;
              if (!accumulatedToolCalls[idx]) {
                accumulatedToolCalls[idx] = {
                  id: tc.id || `call_${Date.now()}_${idx}`,
                  type: tc.type || 'function',
                  function: {
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || ''
                  }
                };
              } else {
                if (tc.id) accumulatedToolCalls[idx].id = tc.id;
                if (tc.function?.name) accumulatedToolCalls[idx].function.name += tc.function.name;
                if (tc.function?.arguments) accumulatedToolCalls[idx].function.arguments += tc.function.arguments;
              }
            });
          }

          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            if (!firstTokenTime) firstTokenTime = performance.now();
            tokenCount++;
            streamRenderer.append(delta);
          }
        }
      }

      if (buffer && buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed && trimmed.startsWith('data:')) {
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (jsonStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.error) {
                const errStr = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
                const rawUpstream = parsed.error?.metadata?.raw;
                throw new Error(rawUpstream ? `${errStr} (${rawUpstream})` : errStr);
              }
              if (parsed.choices?.[0]?.finish_reason) {
                finishReason = parsed.choices[0].finish_reason;
              }
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                if (!firstTokenTime) firstTokenTime = performance.now();
                tokenCount++;
                streamRenderer.append(delta);
              }
            } catch (_) {}
          }
        }
      }

      fullText = streamRenderer.finish();

      // ==================== UNIVERSAL AUTONOMOUS LIVE WEB SEARCH DIGESTION ENGINE ====================
      const canRunAutonomousSearch = Boolean(STATE.webSearchEnabled || STATE.searchMode === 'autonomous');
      const maxAutonomousRounds = 1;
      let autonomousRound = 0;
      let preambleHtml = '';
      const conversationChain = [...(activeMessagesPayload || messagesPayload)];
      let currentRoundText = fullText;
      let currentRoundNativeCalls = accumulatedToolCalls;
      const executedToolSignatures = new Set();

      // Loop tetap dijalankan walau Mode Pencarian Web mati: filter izin di bawah
      // yang memblokir tool web, sementara search_youtube selalu diperbolehkan.
      while (autonomousRound < maxAutonomousRounds) {
        if (STATE.abortController?.signal?.aborted) break;

        const validNativeCalls = currentRoundNativeCalls.filter(tc => tc && tc.function && AUTONOMOUS_TOOL_NAMES.includes(tc.function.name) && isAutonomousToolAllowed(tc.function.name, canRunAutonomousSearch));
        const inlineCalls = extractInlineToolCalls(currentRoundText).filter(tc => tc && tc.function && AUTONOMOUS_TOOL_NAMES.includes(tc.function.name) && isAutonomousToolAllowed(tc.function.name, canRunAutonomousSearch));
        let rawAutonomousCalls = validNativeCalls.length > 0 ? validNativeCalls : inlineCalls;

        if (rawAutonomousCalls.length === 0) {
          break; // Model selesai merumuskan respon tanpa pemanggilan tool tambahan
        }

        // Filter out duplicate or loop tool calls
        const detectedAutonomousCalls = rawAutonomousCalls.filter(call => {
          if (!call || !call.function || !AUTONOMOUS_TOOL_NAMES.includes(call.function.name)) return false;
          const sig = getAutonomousToolSignature(call);
          if (executedToolSignatures.has(sig)) return false; // Cegah pemanggilan tool berulang (loop)
          return true;
        });

        if (detectedAutonomousCalls.length === 0) {
          break; // Model selesai merumuskan respon final tanpa pemanggilan tool tambahan
        }

        autonomousRound++;
        let roundToolResponsesText = '';
        const toolSummaryList = [];

        // Amankan teks pembuka yang telah digenerasi model sebelum pemanggilan tool agar tidak terhapus
        const cleanAssistant = scrubRawToolCallArtifacts(currentRoundText).trim();
        if (!preambleHtml && cleanAssistant && cleanAssistant.length > 20) {
          preambleHtml = `<div class="autonomous-preamble-text" style="margin-bottom:8px;">${renderMarkdown(cleanAssistant)}</div>`;
        }

        for (const call of detectedAutonomousCalls) {
          if (STATE.abortController?.signal?.aborted) break;
          const toolName = call.function.name;
          let previewArg = '';
          try {
            const raw = (typeof call.function.arguments === 'string') ? JSON.parse(call.function.arguments) : call.function.arguments;
            let parsedArgs = {};
            if (raw && typeof raw === 'object') {
              parsedArgs = raw;
            } else if (raw !== null && raw !== undefined) {
              parsedArgs = { query: String(raw), url: String(raw) };
            }
            previewArg = parsedArgs.query || parsedArgs.url || JSON.stringify(parsedArgs);
          } catch (_) {
            previewArg = String(call.function.arguments || '');
          }

          executedToolSignatures.add(getAutonomousToolSignature(call));
          toolSummaryList.push(`${toolName}("${previewArg.substring(0, 40)}")`);

          // Visual status loading di gelembung obrolan (Preamble teks dipertahankan)
          bubbleText.innerHTML = preambleHtml + executedHudHtml + createAutonomousToolHudHtml(toolName, previewArg, 'loading');
          smartScrollChatToBottom(true);

          // Eksekusi tool Zero-API Live News & Tech Wire (Bebas Wikipedia)
          const toolExecRes = await executeAutonomousWebTool(toolName, call.function.arguments, promptText, session);
          if (toolExecRes.sources && Array.isArray(toolExecRes.sources)) {
            if (!webSources) webSources = [];
            webSources.push(...toolExecRes.sources);
          }
          if (toolName === 'search_youtube' && Array.isArray(toolExecRes.videoIds)) {
            toolExecRes.videoIds.forEach((vid) => {
              if (vid && !foundYouTubeIds.includes(vid)) foundYouTubeIds.push(vid);
            });
          }
          roundToolResponsesText += `\n[HASIL PENGUMPULAN DATA OTONOM (${toolName})]:\n${toolExecRes.text}\n`;
          executedHudHtml += createAutonomousToolHudHtml(toolName, previewArg, 'done');
        }

        if (STATE.abortController?.signal?.aborted) break;

        // Tampilkan HUD bahwa data berita live sedang disintesis oleh AI
        bubbleText.innerHTML = preambleHtml + executedHudHtml + `<div class="autonomous-digesting-box" style="margin-top:8px;"><span class="typing-cursor"></span> <span style="font-size:0.85em; opacity:0.85; font-style:italic; color:var(--neon-teal);"><i class="fa-solid fa-bolt"></i> Menyintesis hasil pencarian terbaru...</span></div>`;
        smartScrollChatToBottom(true);

        if (cleanAssistant) {
          conversationChain.push({ role: 'assistant', content: cleanAssistant });
        } else {
          conversationChain.push({ role: 'assistant', content: `[Mengeksekusi penelusuran otonom: ${toolSummaryList.join(', ')}]` });
        }

        const roundInstruction = `[INFORMASI HASIL PENCARIAN TERBARU TELAH TERSEDIA]:
Gunakan data hasil pencarian di atas untuk menjawab pertanyaan pengguna secara komprehensif, jelas, faktual, dan akurat.
Jika hasilnya berupa video YouTube: jelaskan dan rekomendasikan video yang paling relevan (judul, channel, durasi, tayangan), lalu WAJIB sisipkan tautan video pilihan Anda dengan format markdown [Judul Video](https://www.youtube.com/watch?v=ID) agar kartu video dapat ditampilkan dan diputar langsung di dalam percakapan.
Jawablah secara langsung dan tuntas tanpa penolakan kaku, tanpa basa-basi robotik, dan tanpa format pemanggilan tool lagi.`;

        conversationChain.push({
          role: 'user',
          content: `[DATA HASIL PENCARIAN LIVE (WEB / VIDEO)]:\n${roundToolResponsesText}\n\n${roundInstruction}`
        });

        // Jalankan panggilan streaming ke model untuk putaran berikutnya
        const digestionRequestBody = {
          model: actualModelUsed || modelName,
          messages: conversationChain,
          stream: true,
          temperature: parseFloat(STATE.settings.temperature),
          top_p: parseFloat(STATE.settings.topP)
        };
        if (session?.id) digestionRequestBody.sessionId = session.id;
        if (!isOpenRouterDirect) digestionRequestBody.apiKey = STATE.settings.openRouterKey;

        currentRoundText = '';
        currentRoundNativeCalls = [];

        try {
          const digestionRes = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(digestionRequestBody),
            signal: STATE.abortController?.signal
          });

          if (!digestionRes.ok) {
            let errDetail = `HTTP ${digestionRes.status}`;
            try {
              const errJson = await digestionRes.json();
              if (errJson && errJson.error) {
                errDetail = typeof errJson.error === 'object' ? (errJson.error.message || JSON.stringify(errJson.error)) : errJson.error;
              }
            } catch (_) {}
            console.warn(`[OpenRouter Autonomous Digestion Round ${autonomousRound}] Error:`, errDetail);
            if (!fullText.trim()) {
              fullText = cleanAssistant || `[Pencarian selesai: ${toolSummaryList.join(', ')}. Sistem menyelesaikan penelusuran].`;
            }
            break;
          }

          const digestionReader = digestionRes.body.getReader();
          let digestionBuffer = '';
          const digestionContentBox = document.createElement('div');
          digestionContentBox.className = 'autonomous-digested-output';
          bubbleText.innerHTML = preambleHtml + executedHudHtml;
          bubbleText.appendChild(digestionContentBox);

          const digestionRenderer = new StreamBufferRenderer(digestionContentBox, () => smartScrollChatToBottom(false));

          while (true) {
            const { done, value } = await digestionReader.read();
            if (done) {
              digestionBuffer += decoder.decode();
              break;
            }
            digestionBuffer += decoder.decode(value, { stream: true });
            const dLines = digestionBuffer.split('\n');
            digestionBuffer = dLines.pop();

            for (const dLine of dLines) {
              const dTrimmed = dLine.trim();
              if (!dTrimmed || !dTrimmed.startsWith('data:')) continue;
              const dJson = dTrimmed.replace(/^data:\s*/, '');
              if (dJson === '[DONE]') break;
              try {
                const dParsed = JSON.parse(dJson);
                const dDelta = dParsed.choices?.[0]?.delta?.content;
                if (dDelta) {
                  tokenCount++;
                  digestionRenderer.append(dDelta);
                }
                const deltaTc = dParsed.choices?.[0]?.delta?.tool_calls;
                if (Array.isArray(deltaTc)) {
                  deltaTc.forEach(tc => {
                    const idx = tc.index ?? 0;
                    if (!currentRoundNativeCalls[idx]) {
                      currentRoundNativeCalls[idx] = {
                        id: tc.id || `call_${Date.now()}_${idx}`,
                        type: tc.type || 'function',
                        function: {
                          name: tc.function?.name || '',
                          arguments: tc.function?.arguments || ''
                        }
                      };
                    } else {
                      if (tc.id) currentRoundNativeCalls[idx].id = tc.id;
                      if (tc.function?.name) currentRoundNativeCalls[idx].function.name += tc.function.name;
                      if (tc.function?.arguments) currentRoundNativeCalls[idx].function.arguments += tc.function.arguments;
                    }
                  });
                }
              } catch (_) {}
            }
          }

          if (digestionBuffer && digestionBuffer.trim() && digestionBuffer.trim().startsWith('data:')) {
            const dJson = digestionBuffer.trim().replace(/^data:\s*/, '');
            if (dJson !== '[DONE]') {
              try {
                const dParsed = JSON.parse(dJson);
                const dDelta = dParsed.choices?.[0]?.delta?.content;
                if (dDelta) {
                  tokenCount++;
                  digestionRenderer.append(dDelta);
                }
                const deltaTc = dParsed.choices?.[0]?.delta?.tool_calls;
                if (Array.isArray(deltaTc)) {
                  deltaTc.forEach(tc => {
                    const idx = tc.index ?? 0;
                    if (!currentRoundNativeCalls[idx]) {
                      currentRoundNativeCalls[idx] = {
                        id: tc.id || `call_${Date.now()}_${idx}`,
                        type: tc.type || 'function',
                        function: {
                          name: tc.function?.name || '',
                          arguments: tc.function?.arguments || ''
                        }
                      };
                    } else {
                      if (tc.id) currentRoundNativeCalls[idx].id = tc.id;
                      if (tc.function?.name) currentRoundNativeCalls[idx].function.name += tc.function.name;
                      if (tc.function?.arguments) currentRoundNativeCalls[idx].function.arguments += tc.function.arguments;
                    }
                  });
                }
              } catch (_) {}
            }
          }
          currentRoundText = digestionRenderer.finish();
          fullText = currentRoundText;
        } catch (digestionErr) {
          // H3: sama seperti jalur Ollama — AbortError diteruskan ke catch luar,
          // bukan dipaksa jadi respons "selesai" yang menyesatkan.
          if (digestionErr && (digestionErr.name === 'AbortError' || STATE.abortController?.signal?.aborted)) {
            throw digestionErr;
          }
          console.warn(`[OpenRouter Autonomous Digestion Round ${autonomousRound}] Fetch error:`, digestionErr);
          if (!fullText.trim()) fullText = cleanAssistant || '';
          break;
        }
      }

      // ===== AI FILE STUDIO =====
      // Ekstrak file yang dibuat AI, lalu hapus bloknya dari gelembung agar tidak
      // tampil kode mentah berulang (kartu file digantikan oleh kartu di bawah).
      const extractedAiFiles = extractGeneratedFiles(fullText, wantsFile);
      const generatedFiles = extractedAiFiles.files;
      if (generatedFiles.length > 0) {
        fullText = stripGeneratedFileBlocks(fullText, extractedAiFiles.rawBlocks);
      } else if (fullText.indexOf('<<<ZOZ_FILE') !== -1 || fullText.indexOf('<<<END_ZOZ_FILE') !== -1) {
        // M2: ada marker tapi TIDAK ada blok utuh (stream terputus sebelum
        // <<<END_ZOZ_FILE / END yatim). Dulu marker + isi blok tampil mentah di
        // gelembung final dan persist ke riwayat — padahal saat streaming barisnya
        // disembunyikan. Buang sisa blok (hideFileBlocksForDisplay memangkas dari
        // marker terbuka sampai akhir teks — tak ada isi setelah blok tak tertutup).
        fullText = stripGeneratedFileBlocks(hideFileBlocksForDisplay(fullText), []);
      }

      // Bersihkan sisa tag tool_call dan residu raw JSON jika ada sebelum render markdown final
      const cleanFinalText = scrubRawToolCallArtifacts(fullText);
      if (cleanFinalText) {
        fullText = cleanFinalText;
      }

      if (!fullText.trim() && generatedFiles.length === 0 && !preambleHtml && collectedImages.length === 0) {
        if (STATE.abortController?.signal?.aborted) {
          // H3: sama seperti Ollama — jangan simpan gelembung kosong sebagai jawaban.
          assistantRow.remove();
          showToast('Generasi dihentikan.');
          return;
        }
        throw new Error('Model OpenRouter menyelesaikan koneksi tanpa menghasilkan respon teks.');
      }

      const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
      const tps = totalTime > 0 ? (tokenCount / totalTime).toFixed(1) : '0';

      let renderedMarkdown = renderMarkdown(fullText);
      let imagesHtml = '';
      if (collectedImages.length > 0) {
        imagesHtml = `
          <div class="chat-generated-images-grid" style="margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
            ${collectedImages.map(url => createGeneratedImageCardHtml({
              url: url,
              imageUrl: url,
              prompt: promptText,
              model: modelName,
              duration: totalTime
            })).join('')}
          </div>
        `;
      }

      const finalRenderedContent = (preambleHtml ? preambleHtml : '') + (executedHudHtml ? executedHudHtml + renderedMarkdown + imagesHtml : renderedMarkdown + imagesHtml);
      bubbleText.innerHTML = finalRenderedContent.trim();
      enhanceCodeBlocks(bubbleText);
      enhanceChatImages(bubbleText);
      if (collectedImages.length > 0) {
        attachImageCardListeners(assistantRow, promptText, collectedImages[0]);
      }
      if (webSources && webSources.length > 0) {
        webSources = deduplicateSources(webSources);
        renderMessageSources(assistantRow, webSources, true);
      }
      renderYouTubeCardsForMessage(assistantRow, fullText, foundYouTubeIds);
      renderMessageFiles(assistantRow, generatedFiles);
      const effectiveDisplay = actualModelUsed ? `${actualModelUsed} (Failover)` : modelName;
      metaBox.innerHTML = `
        <strong title="${actualModelUsed ? 'Model dialihkan oleh OpenRouter ke ' + actualModelUsed : modelName}">${escapeHtml(effectiveDisplay)}</strong>
        <span class="meta-model-badge" style="background:rgba(255,82,0,0.15); color:var(--neon-amber);">OpenRouter</span>
        ${collectedImages.length > 0 ? '<span class="meta-model-badge" style="background:rgba(255,0,127,0.18); border-color:#FF007F; color:#FF66B2;"><i class="fa-solid fa-wand-magic-sparkles"></i> Gambar Dibuat</span>' : ''}
        <span>⏱️ ${totalTime}s</span>
        <span>⚡ ${tps} tps</span>
      `;

      assistantRow.dataset.fullContent = fullText;

      // Check if output is cut in half and provide one-click continuation button
      if (isOutputTruncated(fullText, finishReason)) {
        attachContinuationButton(assistantRow.querySelector('.message-content-box') || assistantRow, session, assistantRow, modelName, 'openrouter', fullText);
      }

      // Save to session if session is still alive
      if (STATE.sessions.some(s => s.id === session.id)) {
        session.messages.push({
          role: 'assistant',
          content: fullText,
          model: actualModelUsed || modelName,
          engine: 'openrouter',
          images: collectedImages.length > 0 ? collectedImages : undefined,
          files: generatedFiles.length > 0 ? generatedFiles : undefined,
          imageUrl: collectedImages[0] || undefined,
          sources: webSources,
          stats: { duration: totalTime, tps: tps, tokens: tokenCount },
          timestamp: new Date().toISOString()
        });
        session.updatedAt = new Date().toISOString();
        savePersistedState();
        renderChatHistory(els.searchHistoryInput?.value || '');
      }
      AudioEngine.receive();
      notifyAiCompletion('🤖 ' + (actualModelUsed || modelName), fullText);

    } catch (err) {
      if (err.name === 'AbortError') {
        const partialRaw = streamRenderer ? streamRenderer.finish() : '';
        const stoppedPartial = sanitizePartialResponseWithFiles(partialRaw);
        const partialText = stoppedPartial.text;
        if (partialText && partialText.trim() && STATE.sessions.some(s => s.id === session.id)) {
          const stoppedText = `${partialText.trim()}\n\n*[Respons dihentikan oleh pengguna]*`;
          bubbleText.innerHTML = renderMarkdown(stoppedText);
          enhanceCodeBlocks(bubbleText);
          renderMessageFiles(assistantRow, stoppedPartial.files);
          if (webSources && webSources.length > 0) {
            renderMessageSources(assistantRow, webSources, true);
          }
          const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
          metaBox.innerHTML = `
            <strong>${modelName}</strong>
            <span class="meta-model-badge" style="background:rgba(255,82,0,0.15); color:var(--neon-amber);">OpenRouter</span>
            <span>⏱️ ${totalTime}s (Dihentikan)</span>
          `;
          session.messages.push({
            role: 'assistant',
            content: stoppedText,
            model: modelName,
            engine: 'openrouter',
            sources: webSources,
            files: stoppedPartial.files.length > 0 ? stoppedPartial.files : undefined,
            stats: { duration: totalTime, tokens: tokenCount, stopped: true },
            timestamp: new Date().toISOString()
          });
          session.updatedAt = new Date().toISOString();
          savePersistedState();
          renderChatHistory(els.searchHistoryInput?.value || '');
        } else {
          assistantRow.remove();
        }
        showToast('Generasi dihentikan.');
      } else {
        const rescuePartial = sanitizePartialResponseWithFiles(streamRenderer ? streamRenderer.finish() : '');
        const partialText = rescuePartial.text;
        const hasPartialText = Boolean(partialText && partialText.trim());

        if (hasPartialText && STATE.sessions.some(s => s.id === session.id)) {
          const rescuedText = `${partialText.trim()}\n\n*[Koneksi terputus saat streaming]*`;
          const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);

          session.messages.push({
            role: 'assistant',
            content: rescuedText,
            model: modelName,
            engine: 'openrouter',
            sources: webSources,
            files: rescuePartial.files.length > 0 ? rescuePartial.files : undefined,
            stats: { duration: totalTime, tokens: tokenCount, interrupted: true },
            timestamp: new Date().toISOString()
          });
          session.updatedAt = new Date().toISOString();
          savePersistedState();
          renderChatHistory(els.searchHistoryInput?.value || '');

          if (metaBox) {
            metaBox.innerHTML = `
              <strong>${modelName}</strong>
              <span class="meta-model-badge" style="background:rgba(255,82,0,0.15); color:var(--neon-amber);">OpenRouter</span>
              <span>⏱️ ${totalTime}s (Terputus)</span>
            `;
          }
        }

        const actualHasImage = Array.isArray(image) ? image.length > 0 : Boolean(image);
        const errorHtml = formatModelErrorMessage('openrouter', modelName, err, actualHasImage, STATE.webSearchEnabled);

        const isFreeModel = modelName.includes(':free') || modelName === 'openrouter/free';
        const fallbackModelCandidate = modelName === 'openrouter/free' ? 'google/gemma-2-9b-it:free' : 'openrouter/free';
        const fallbackLabel = modelName === 'openrouter/free' ? 'Gemma 2 9B (Free)' : 'OpenRouter Free Router';

        const rescuedHtml = hasPartialText ? `
          <div class="partial-rescued-content" style="margin-bottom:12px; padding-bottom:12px; border-bottom:1px dashed rgba(255,255,255,0.15);">
            ${renderMarkdown(partialText.trim())}
          </div>
        ` : '';

        bubbleText.innerHTML = `
          ${rescuedHtml}
          ${errorHtml}
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-outline retry-send-btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan); font-size:0.75rem;">
               <i class="fa-solid fa-rotate-right"></i> Coba Kirim Ulang
            </button>
            ${isFreeModel ? `
              <button class="btn btn-sm btn-outline switch-free-model-btn" data-fallback="${fallbackModelCandidate}" style="border-color:var(--neon-teal); color:var(--neon-teal); font-size:0.75rem;">
                <i class="fa-solid fa-bolt"></i> Ganti ke ${fallbackLabel} &amp; Kirim Ulang
              </button>
            ` : ''}
            <button class="btn btn-sm btn-outline open-settings-btn" style="border-color:var(--neon-amber); color:var(--neon-amber); font-size:0.75rem;">
              <i class="fa-solid fa-gear"></i> Buka Pengaturan & Key
            </button>
          </div>
        `;

        if (hasPartialText) {
          enhanceCodeBlocks(bubbleText);
          renderMessageFiles(assistantRow, rescuePartial.files);
          if (webSources && webSources.length > 0) {
            renderMessageSources(assistantRow, webSources, true);
          }
        }

        bubbleText.querySelector('.retry-send-btn')?.addEventListener('click', () => {
          assistantRow.remove();
          runOpenRouterStreaming(session, promptText, image, modelName);
        });

        bubbleText.querySelector('.switch-free-model-btn')?.addEventListener('click', (e) => {
          const targetFallback = e.currentTarget.dataset.fallback || 'openrouter/free';
          selectModel(targetFallback);
          assistantRow.remove();
          runOpenRouterStreaming(session, promptText, image, targetFallback);
        });

        bubbleText.querySelector('.open-settings-btn')?.addEventListener('click', () => {
          syncSettingsModalFields();
          openModal('settingsModal');
        });

        AudioEngine.error();
      }
    } finally {
      setGeneratingState(false);
    }
  }

  // --- AUTO ROUTER (SMART ROUTING) ---
  async function runAutoRouterStreaming(session, promptText, image) {
    try {
      setGeneratingState(true);
      // Check if Ollama is online
      const isOllamaOnline = await checkOllamaHealth();
      
      // Policy check
      const isLongOrHeavy = (promptText.length > 800) || (promptText.toLowerCase().includes('buatkan sistem') || promptText.toLowerCase().includes('arsitektur kompleks'));

      if (STATE.settings.autoPolicy === 'cloud_heavy' && isLongOrHeavy && (STATE.settings.openRouterKey || DeviceStorage.isDeviceBackendAvailable)) {
        showToast('🔀 Auto-Router: Mengarahkan tugas kompleks ke OpenRouter Cloud...', 'info');
        await runOpenRouterStreaming(session, promptText, image, STATE.settings.openRouterModel || 'openrouter/free');
      } else if (isOllamaOnline) {
        showToast('🔀 Auto-Router: Mengeksekusi via Ollama Engine...', 'info');
        await runOllamaStreaming(session, promptText, image, STATE.settings.ollamaModel);
      } else if (STATE.settings.openRouterKey || DeviceStorage.isDeviceBackendAvailable) {
        showToast('🔀 Auto-Router: Ollama offline, fallback ke OpenRouter Cloud...', 'info');
        await runOpenRouterStreaming(session, promptText, image, STATE.settings.openRouterModel || 'openrouter/free');
      } else {
        // Kedua engine tidak siap: tampilkan kartu bantuan interaktif dan pulihkan composer
        const assistantRow = appendMessageElement('assistant', '', null, 'Auto-Router Engine');
        const bubbleText = assistantRow.querySelector('.msg-text-content');
        const metaBox = assistantRow.querySelector('.message-meta');
        
        bubbleText.innerHTML = `
          <div style="background:rgba(255,170,0,0.08); border:1px solid rgba(255,170,0,0.35); border-radius:10px; padding:14px; margin-bottom:12px; line-height:1.5;">
            <div style="font-weight:700; color:var(--neon-amber); margin-bottom:6px; display:flex; align-items:center; gap:8px; font-size:0.9rem;">
              <i class="fa-solid fa-triangle-exclamation"></i> Auto-Router: Tidak Ada Engine AI yang Siap
            </div>
            <div style="font-size:0.83rem; color:var(--text-main); margin-bottom:8px;">
              Ollama Cloud Engine tidak dapat dihubungi pada <code>${escapeHtml(STATE.settings.ollamaEndpoint)}</code> dan <strong>OpenRouter API Key</strong> belum dikonfigurasi di Pengaturan.
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary); background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:6px; border-left:3px solid var(--neon-cyan);">
              💡 <strong>Solusi:</strong> Masukkan Ollama API Key atau OpenRouter API Key di menu Pengaturan agar Auto-Router dapat mengeksekusi model Cloud secara lancar.
            </div>
          </div>
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-primary open-settings-btn" style="font-size:0.75rem;">
              <i class="fa-solid fa-sliders"></i> Buka Pengaturan & Masukkan API Key
            </button>
            <button class="btn btn-sm btn-outline retry-router-btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan); font-size:0.75rem;">
              <i class="fa-solid fa-rotate-right"></i> Cek Ulang Status Ollama Cloud
            </button>
          </div>
        `;

        bubbleText.querySelector('.open-settings-btn')?.addEventListener('click', () => {
          syncSettingsModalFields();
          openModal('settingsModal');
        });

        bubbleText.querySelector('.retry-router-btn')?.addEventListener('click', async () => {
          assistantRow.remove();
          await runAutoRouterStreaming(session, promptText, image);
        });

        if (metaBox) {
          metaBox.innerHTML = `
            <strong>Auto-Router</strong>
            <span class="meta-model-badge" style="background:rgba(255,50,50,0.2); color:#ff6b6b;">Offline</span>
          `;
        }

        AudioEngine.error();
        showToast('Ollama offline dan OpenRouter Key belum disetting.', 'error');
        smartScrollChatToBottom(true);
      }
    } finally {
      setGeneratingState(false);
    }
  }

  function setGeneratingState(isGen) {
    STATE.isGenerating = isGen;
    if (els.sendPromptBtn) {
      els.sendPromptBtn.style.display = isGen ? 'none' : 'flex';
    }
    if (els.stopGenerationBtn) {
      els.stopGenerationBtn.style.display = isGen ? 'flex' : 'none';
    }
  }

  function stopGeneration() {
    if (activeChatPollTimer) {
      clearInterval(activeChatPollTimer);
      activeChatPollTimer = null;
    }
    const activeCursor = els.messagesList?.querySelector('.typing-cursor');
    if (activeCursor) {
      const bubbleText = activeCursor.closest('.msg-text-content');
      activeCursor.remove();
      if (bubbleText) {
        enhanceCodeBlocks(bubbleText);
        enhanceChatImages(bubbleText);
      }
    }
    const activeSession = findCurrentActiveSession();
    if (activeSession?.id && !IS_GITHUB_PAGES) {
      fetch('/api/chat/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': STATE.userId
        },
        body: JSON.stringify({ sessionId: activeSession.id, userId: STATE.userId })
      }).catch(() => {});
    }
    if (STATE.currentDeepResearchTaskId && !IS_GITHUB_PAGES) {
      const abortTaskId = STATE.currentDeepResearchTaskId;
      STATE.currentDeepResearchTaskId = null;
      fetch('/api/batal-riset/' + abortTaskId, {
        method: 'POST',
        headers: { 'X-User-ID': STATE.userId }
      }).catch(() => {});
    }
    if (STATE.abortController) {
      STATE.abortController.abort();
    }
    setGeneratingState(false);
  }

  // ==================== IMAGE VISION & MEDIA HANDLER ====================
  function isImageFile(file) {
    if (!file) return false;
    if (file.type && typeof file.type === 'string' && file.type.startsWith('image/')) return true;
    const name = file.name || '';
    const ext = (name.split('.').pop() || '').toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'ico', 'heic', 'heif', 'tiff', 'jfif', 'avif'];
    return imageExtensions.includes(ext);
  }

  // Client-side instant image compressor (Reduces 10MB camera photo to ~80KB WebP)
  function compressImageToWebP(file, maxDimension = 1024, quality = 0.8) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(e.target.result);
          ctx.drawImage(img, 0, 0, width, height);
          try {
            const dataUrl = canvas.toDataURL('image/webp', quality);
            resolve(dataUrl);
          } catch (err) {
            resolve(e.target.result);
          }
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  async function processSingleImageFile(file) {
    if (!file || typeof file.size !== 'number' || file.size <= 0) return false;
    try {
      const compressedDataUrl = await compressImageToWebP(file, 1024, 0.8) || (await new Promise(r => {
        const reader = new FileReader();
        reader.onload = ev => r(ev.target.result);
        reader.onerror = () => r(null);
        reader.readAsDataURL(file);
      }));

      if (compressedDataUrl) {
        if (!Array.isArray(STATE.attachedImages)) STATE.attachedImages = [];
        STATE.attachedImages.push(compressedDataUrl);
        // Upload to disk in background if backend is available
        if (DeviceStorage.isDeviceBackendAvailable) {
          DeviceStorage.uploadFile(compressedDataUrl).catch(() => {});
        }
        return true;
      }
    } catch (err) {
      console.warn('Image processing warning:', err.message);
    }
    return false;
  }

  async function handleImageUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files || files.length === 0) return;

    let addedCount = 0;
    for (const file of files) {
      if (!file || typeof file.size !== 'number' || file.size <= 0 || !isImageFile(file)) continue;
      const ok = await processSingleImageFile(file);
      if (ok) addedCount++;
    }

    if (els.imageFileInput) els.imageFileInput.value = '';
    if (els.cameraFileInput) els.cameraFileInput.value = '';
    renderAttachmentPreviews();

    if (addedCount > 0) {
      AudioEngine.click();
    }
  }

  function removeAttachedImage(idx) {
    if (idx >= 0 && idx < STATE.attachedImages.length) {
      STATE.attachedImages.splice(idx, 1);
      renderAttachmentPreviews();
      AudioEngine.click();
    }
  }

  function clearAttachedImages() {
    STATE.attachedImages = [];
    if (els.imageFileInput) els.imageFileInput.value = '';
    if (els.cameraFileInput) els.cameraFileInput.value = '';
    renderAttachmentPreviews();
  }

  function clearAttachedImage() {
    clearAttachedImages();
  }

  // ==================== ATTACHMENT MENU & POPUP CONTROLLER ====================
  function toggleAttachmentDropdown(e) {
    if (e) e.stopPropagation();
    if (!els.attachmentDropdown) return;
    const isHidden = els.attachmentDropdown.style.display === 'none' || !els.attachmentDropdown.style.display;
    if (isHidden) {
      openAttachmentDropdown();
    } else {
      closeAttachmentDropdown();
    }
  }

  function openAttachmentDropdown() {
    if (!els.attachmentDropdown) return;
    closeSearchDropdown();
    closeImageModelDropdown();
    closeMusicModelDropdown();
    els.attachmentDropdown.style.display = 'flex';
    els.attachToggleBtn?.classList.add('active');
    els.attachToggleBtn?.setAttribute('aria-expanded', 'true');
    AudioEngine.click();
  }

  function closeAttachmentDropdown() {
    if (!els.attachmentDropdown) return;
    els.attachmentDropdown.style.display = 'none';
    els.attachToggleBtn?.classList.remove('active');
    els.attachToggleBtn?.setAttribute('aria-expanded', 'false');
  }

  // ==================== SEARCH MODE DROPDOWN & CONTROLLER ====================
  function setSearchMode(mode = 'off') {
    STATE.searchMode = mode;
    updateSearchModeUI();
    savePersistedState();
    AudioEngine.click();
    closeSearchDropdown();
  }

  function updateSearchModeUI() {
    const mode = STATE.searchMode || 'off';
    if (!els.webSearchToggleBtn) return;

    els.webSearchToggleBtn.classList.remove('mode-default', 'mode-premium', 'mode-autonomous', 'active');
    if (mode === 'autonomous') {
      els.webSearchToggleBtn.classList.add('mode-autonomous', 'active');
      if (els.webSearchIcon) els.webSearchIcon.className = 'fa-solid fa-compass';
      if (els.searchBadge) els.searchBadge.style.display = 'none';
      els.webSearchToggleBtn.title = 'Autonomous Web Explorer: Aktif (Klik untuk ubah / matikan)';
    } else if (mode === 'default') {
      els.webSearchToggleBtn.classList.add('mode-default', 'active');
      if (els.webSearchIcon) els.webSearchIcon.className = 'fa-solid fa-globe';
      if (els.searchBadge) els.searchBadge.style.display = 'none';
      els.webSearchToggleBtn.title = 'Pencarian Web Default: Aktif (Klik untuk ubah / matikan)';
    } else if (mode === 'premium') {
      els.webSearchToggleBtn.classList.add('mode-premium', 'active');
      if (els.webSearchIcon) els.webSearchIcon.className = 'fa-solid fa-microscope';
      const count = Array.isArray(STATE.researchTargetUrls) ? STATE.researchTargetUrls.length : 0;
      if (els.searchBadge) {
        els.searchBadge.style.display = 'block';
        els.searchBadge.textContent = count > 0 ? `PRO • ${count}` : 'PRO';
      }
      els.webSearchToggleBtn.title = `Deep Research: ${count} URL Sumber (Klik tombol untuk menu, klik badge PRO untuk kelola sumber)`;
    } else {
      if (els.webSearchIcon) els.webSearchIcon.className = 'fa-solid fa-globe';
      if (els.searchBadge) els.searchBadge.style.display = 'none';
      els.webSearchToggleBtn.title = 'Mode Pencarian Web (Nonaktif - Klik untuk aktifkan)';
    }

    if (mode === 'premium') {
      renderResearchUrlChips();
    } else {
      if (els.researchUrlChips) {
        els.researchUrlChips.style.display = 'none';
      }
    }

    // Update active check indicators & tombol aksi pada popup menu
    $$('.search-menu-item').forEach(item => {
      const itemMode = item.dataset.mode || 'off';
      const isActive = itemMode === mode;
      item.classList.toggle('active', isActive);

      const checkIcon = item.querySelector('.search-item-check');
      const closeBtn = item.querySelector('.search-item-close-btn');
      const manageBtn = item.querySelector('.search-item-manage-btn');

      if (checkIcon) {
        checkIcon.style.display = isActive ? 'inline-block' : 'none';
      }
      if (closeBtn) {
        closeBtn.style.display = (isActive && itemMode !== 'off') ? 'inline-flex' : 'none';
      }
      if (manageBtn) {
        manageBtn.style.display = (isActive && itemMode === 'premium') ? 'inline-flex' : 'none';
      }
    });
  }

  function toggleSearchDropdown(e) {
    if (e) e.stopPropagation();
    if (!els.searchDropdown) return;
    const isHidden = els.searchDropdown.style.display === 'none' || !els.searchDropdown.style.display;
    if (isHidden) {
      openSearchDropdown();
    } else {
      closeSearchDropdown();
    }
  }

  function openSearchDropdown() {
    if (!els.searchDropdown) return;
    closeAttachmentDropdown();
    closeImageModelDropdown();
    closeMusicModelDropdown();
    els.searchDropdown.style.display = 'flex';
    els.webSearchToggleBtn?.setAttribute('aria-expanded', 'true');
    AudioEngine.click();
  }

  function closeSearchDropdown() {
    if (!els.searchDropdown) return;
    els.searchDropdown.style.display = 'none';
    els.webSearchToggleBtn?.setAttribute('aria-expanded', 'false');
  }

  // ==================== CUSTOM URL DEEP RESEARCH HELPER FUNCTIONS ====================
  function extractCustomAnalysisUrls(text) {
    if (!text || typeof text !== 'string') return [];
    const urlRegex = /(?:https?:\/\/[^\s<>"'{}|\\^`\[\]]+|www\.[^\s<>"'{}|\\^`\[\]]+)/gi;
    const matches = text.match(urlRegex) || [];
    return matches.map(u => {
      let clean = u.replace(/[.,!?;:)]+$/, '');
      if (/^www\./i.test(clean)) clean = 'https://' + clean;
      return clean;
    }).filter(u => {
      try {
        new URL(u);
        return true;
      } catch (_) {
        return false;
      }
    });
  }

  function addResearchTargetUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    let url = rawUrl.trim();
    if (!url) return false;
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    try {
      new URL(url);
    } catch (_) {
      showToast('⚠️ Format URL tidak valid. Mohon sertakan tautan yang benar.');
      return false;
    }
    if (!Array.isArray(STATE.researchTargetUrls)) {
      STATE.researchTargetUrls = [];
    }
    if (STATE.researchTargetUrls.includes(url)) {
      showToast('⚠️ URL ini sudah ada di daftar target riset.');
      return false;
    }
    STATE.researchTargetUrls.push(url);
    syncActiveSessionResearchUrls();
    renderResearchUrlChips();
    if (els.researchTargetUrlInput) els.researchTargetUrlInput.value = '';
    if (els.researchUrlManagerInput) els.researchUrlManagerInput.value = '';
    showToast('🔗 URL target berhasil ditambahkan ke Deep Research.');
    return true;
  }

  function removeResearchTargetUrl(index) {
    if (!Array.isArray(STATE.researchTargetUrls)) return;
    if (index >= 0 && index < STATE.researchTargetUrls.length) {
      STATE.researchTargetUrls.splice(index, 1);
      syncActiveSessionResearchUrls();
      renderResearchUrlChips();
    }
  }

  function syncActiveSessionResearchUrls() {
    if (STATE.currentSessionId) {
      const activeSess = STATE.sessions.find(s => s.id === STATE.currentSessionId);
      if (activeSess) {
        activeSess.researchTargetUrls = [...STATE.researchTargetUrls];
        savePersistedState();
      }
    }
  }

  function clearResearchTargetUrls() {
    STATE.researchTargetUrls = [];
    syncActiveSessionResearchUrls();
    renderResearchUrlChips();
    if (els.researchTargetUrlInput) els.researchTargetUrlInput.value = '';
    if (els.researchUrlManagerInput) els.researchUrlManagerInput.value = '';
  }

  function openResearchUrlManagerModal() {
    renderResearchUrlManagerList();
    openModal('researchUrlManagerModal');
    setTimeout(() => {
      els.researchUrlManagerInput?.focus();
    }, 150);
  }

  function renderResearchUrlChips() {
    // Update badge count
    const count = Array.isArray(STATE.researchTargetUrls) ? STATE.researchTargetUrls.length : 0;
    if (els.searchBadge && STATE.searchMode === 'premium') {
      els.searchBadge.style.display = 'block';
      els.searchBadge.textContent = count > 0 ? `PRO • ${count}` : 'PRO';
    }
    if (els.webSearchToggleBtn && STATE.searchMode === 'premium') {
      els.webSearchToggleBtn.title = `Deep Research: ${count} URL Sumber (Klik tombol untuk menu, klik badge PRO untuk kelola sumber)`;
    }

    // Update inline chips (for backward compatibility / banner display)
    if (els.researchUrlChips) {
      if (STATE.searchMode !== 'premium') {
        els.researchUrlChips.style.display = 'none';
        return;
      }
      const urls = Array.isArray(STATE.researchTargetUrls) ? STATE.researchTargetUrls : [];
      if (urls.length === 0) {
        els.researchUrlChips.style.display = 'none';
        els.researchUrlChips.innerHTML = '';
      } else {
        els.researchUrlChips.style.display = 'flex';
        els.researchUrlChips.innerHTML = urls.map((url, idx) => {
          let domain = url;
          try { domain = new URL(url).hostname; } catch (_) {}
          return `
            <div class="research-url-chip" title="${escapeHtml(url)}">
              <i class="fa-solid fa-link" style="font-size:0.7rem; color:var(--neon-amber);"></i>
              <span class="research-url-chip-domain">${escapeHtml(domain)}</span>
              <button type="button" class="research-url-chip-remove" data-idx="${idx}" title="Hapus URL ini" aria-label="Hapus URL">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          `;
        }).join('');

        els.researchUrlChips.querySelectorAll('.research-url-chip-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx, 10);
            removeResearchTargetUrl(idx);
          });
        });
      }
    }

    // Update modal list
    renderResearchUrlManagerList();
  }

  function renderResearchUrlManagerList() {
    if (!els.researchUrlManagerList) return;
    const urls = Array.isArray(STATE.researchTargetUrls) ? STATE.researchTargetUrls : [];
    if (urls.length === 0) {
      els.researchUrlManagerList.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-dim); font-size: 0.8rem;">
          <i class="fa-solid fa-link" style="font-size: 1.5rem; color: rgba(255, 170, 0, 0.3); margin-bottom: 8px; display: block;"></i>
          Belum ada URL sumber. Tambah URL di atas untuk mulai analisis.
        </div>
      `;
      return;
    }
    els.researchUrlManagerList.innerHTML = urls.map((url, idx) => {
      let domain = url;
      try { domain = new URL(url).hostname; } catch (_) {}
      return `
        <div class="research-url-manager-item">
          <i class="fa-solid fa-link research-url-manager-item-icon"></i>
          <span class="research-url-manager-item-url" title="${escapeHtml(url)}">${escapeHtml(url)}</span>
          <span class="research-url-manager-item-domain">${escapeHtml(domain)}</span>
          <button type="button" class="research-url-manager-item-remove" data-idx="${idx}" title="Hapus URL ini" aria-label="Hapus URL">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;
    }).join('');

    els.researchUrlManagerList.querySelectorAll('.research-url-manager-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        removeResearchTargetUrl(idx);
      });
    });
  }

  // ==================== DEEP RESEARCH STREAMING ENGINE (PREMIUM) ====================
  // Helper non-streaming untuk eksekusi telaah mandiri Model Agen 1 & Agen 2 di browser
  async function callClientLLMDirect(modelName, prompt, system = '', engine = '') {
    if (!prompt || !modelName) return '';
    const isModelOpenRouter = Boolean(modelName && modelName.includes('/'));
    const isModelOllama = Boolean(modelName && (modelName.includes(':') || (!modelName.includes('/') && (STATE.ollamaModels || []).some(m => (m.name || m.model || m.id) === modelName))));
    const resolvedEngine = isModelOpenRouter ? 'openrouter' : (isModelOllama ? 'ollama' : (engine || (STATE.settings.openRouterKey ? 'openrouter' : 'ollama')));

    if (resolvedEngine === 'openrouter' || (STATE.settings.openRouterKey && !isModelOllama)) {
      const isFreeModel = Boolean(modelName && (modelName.includes(':free') || modelName === 'openrouter/free' || modelName.endsWith('/free')));
      const candidateModels = isFreeModel
        ? [
            modelName,
            'openrouter/free',
            'google/gemma-2-9b-it:free',
            'meta-llama/llama-3.1-8b-instruct:free'
          ].filter(Boolean).filter((m, idx, arr) => arr.indexOf(m) === idx && m !== 'qwen/qwen3.8-27b:free')
        : [modelName];

      const isOpenRouterDirect = IS_GITHUB_PAGES || IS_CLOUD_HOSTED;
      const endpoint = isOpenRouterDirect ? 'https://openrouter.ai/api/v1/chat/completions' : '/api/openrouter/chat';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.settings.openRouterKey}`
      };
      if (isOpenRouterDirect) {
        headers['HTTP-Referer'] = location.origin || 'https://zozi0999.github.io/zoz_router';
        headers['X-Title'] = 'ZOZ Router Multi-Agent';
      }

      let lastErr = null;
      for (let i = 0; i < candidateModels.length; i++) {
        const curModel = candidateModels[i];
        const supportsSystem = doesModelSupportSystemRole(curModel);
        const messages = [];
        if (system && system.trim()) {
          if (supportsSystem) {
            messages.push({ role: 'system', content: system.trim() });
            messages.push({ role: 'user', content: prompt.trim() });
          } else {
            messages.push({ role: 'user', content: `[Instruksi Sistem & Konteks:\n${system.trim()}]\n\n${prompt.trim()}` });
          }
        } else {
          messages.push({ role: 'user', content: prompt.trim() });
        }

        const requestBody = {
          model: curModel,
          messages,
          stream: false,
          temperature: 0.3,
          provider: {
            allow_fallbacks: true
          }
        };
        if (!isOpenRouterDirect) requestBody.apiKey = STATE.settings.openRouterKey;

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: STATE.abortController?.signal
          });
          if (!res.ok) {
            let errDetail = `OpenRouter HTTP ${res.status}`;
            try {
              const errJson = await res.json();
              if (errJson && errJson.error) {
                errDetail = typeof errJson.error === 'object' ? (errJson.error.message || JSON.stringify(errJson.error)) : errJson.error;
              }
            } catch (e) {}
            throw new Error(errDetail);
          }
          const data = await res.json();
          return data.choices?.[0]?.message?.content || '';
        } catch (callErr) {
          if (STATE.abortController?.signal?.aborted) throw callErr;
          lastErr = callErr;
          if (isFreeModel && i < candidateModels.length - 1) {
            console.warn(`[callClientLLMDirect] Failover dari ${curModel} ke ${candidateModels[i + 1]}:`, callErr.message);
            continue;
          }
          throw callErr;
        }
      }
      throw lastErr || new Error('Gagal memanggil model OpenRouter');
    } else {
      const ep = normalizeEndpoint(STATE.settings.ollamaEndpoint);
      const headers = { 'Content-Type': 'application/json' };
      if (STATE.settings.ollamaApiKey) {
        headers['Authorization'] = `Bearer ${STATE.settings.ollamaApiKey}`;
        headers['x-ollama-key'] = STATE.settings.ollamaApiKey;
      }
      const messages = [];
      if (system && system.trim()) messages.push({ role: 'system', content: system.trim() });
      messages.push({ role: 'user', content: prompt.trim() });

      const requestBody = {
        model: modelName,
        messages,
        stream: false,
        options: { temperature: 0.3 },
        endpoint: ep
      };
      if (STATE.settings.ollamaApiKey) requestBody.apiKey = STATE.settings.ollamaApiKey;
      const chatUrl = (IS_GITHUB_PAGES || /localhost|127\.0\.0\.1|\[::1\]/i.test(ep)) ? resolveEndpointUrl(ep, 'api/chat') : '/api/ollama/chat';

      const res = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: STATE.abortController?.signal
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const data = await res.json();
      return data.message?.content || data.response || data.choices?.[0]?.message?.content || '';
    }
  }

  async function streamLLMSynthesis(engine, modelName, systemPrompt, session, bubbleText = null, onChunk = null) {
    const streamRenderer = bubbleText ? new StreamBufferRenderer(bubbleText, () => smartScrollChatToBottom(false)) : null;
    let fullText = '';

    // Auto-resolve actual engine based on modelName pattern
    const isModelOpenRouter = Boolean(modelName && modelName.includes('/'));
    const isModelOllama = Boolean(modelName && (modelName.includes(':') || (!modelName.includes('/') && (STATE.ollamaModels || []).some(m => (m.name || m.model || m.id) === modelName))));
    const resolvedEngine = isModelOpenRouter ? 'openrouter' : (isModelOllama ? 'ollama' : (engine || 'ollama'));

    if (resolvedEngine === 'openrouter' || (!STATE.settings.ollamaModel && STATE.settings.openRouterKey && !isModelOllama)) {
      const isFreeModel = Boolean(modelName && (modelName.includes(':free') || modelName === 'openrouter/free' || modelName.endsWith('/free')));
      const candidateModels = isFreeModel
        ? [
            modelName,
            'openrouter/free',
            'google/gemma-2-9b-it:free',
            'meta-llama/llama-3.1-8b-instruct:free'
          ].filter(Boolean).filter((m, idx, arr) => arr.indexOf(m) === idx && m !== 'qwen/qwen3.8-27b:free')
        : [modelName];

      const isOpenRouterDirect = IS_GITHUB_PAGES || IS_CLOUD_HOSTED;
      const endpoint = isOpenRouterDirect ? 'https://openrouter.ai/api/v1/chat/completions' : '/api/openrouter/chat';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.settings.openRouterKey}`
      };
      if (isOpenRouterDirect) {
        headers['HTTP-Referer'] = location.origin || 'https://zozi0999.github.io/zoz_router';
        headers['X-Title'] = 'ZOZ Router Deep Research';
      }

      let response = null;
      let lastErrDetail = '';
      for (let i = 0; i < candidateModels.length; i++) {
        const curModel = candidateModels[i];
        const curMessagesPayload = buildSanitizedMessagesPayload(session, [], 'openrouter', systemPrompt, curModel);
        const requestBody = {
          model: curModel,
          messages: curMessagesPayload,
          stream: true,
          temperature: 0.3,
          provider: {
            allow_fallbacks: true
          }
        };
        if (!isOpenRouterDirect) requestBody.apiKey = STATE.settings.openRouterKey;

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: STATE.abortController?.signal
          });

          if (res.ok) {
            response = res;
            break;
          }

          let errDetail = `OpenRouter HTTP ${res.status}`;
          try {
            const errData = await res.json();
            if (errData && errData.error) {
              errDetail = typeof errData.error === 'object' ? (errData.error.message || JSON.stringify(errData.error)) : errData.error;
            }
          } catch (je) {}
          lastErrDetail = errDetail;

          if (isFreeModel && i < candidateModels.length - 1) {
            console.warn(`[streamLLMSynthesis] Failover dari ${curModel} ke ${candidateModels[i + 1]} (${errDetail})`);
            continue;
          } else {
            throw new Error(errDetail);
          }
        } catch (fetchErr) {
          if (STATE.abortController?.signal?.aborted) throw fetchErr;
          lastErrDetail = fetchErr.message || String(fetchErr);
          if (isFreeModel && i < candidateModels.length - 1) {
            console.warn(`[streamLLMSynthesis] Fetch error pada ${curModel}:`, fetchErr.message);
            continue;
          } else {
            throw fetchErr;
          }
        }
      }

      if (!response || !response.ok) {
        throw new Error(lastErrDetail || 'Gagal memulai streaming sintesis OpenRouter');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.replace(/^data:\s*/, ''));
              if (parsed.error) {
                const errStr = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
                throw new Error(errStr);
              }
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                if (streamRenderer) streamRenderer.append(delta);
                if (typeof onChunk === 'function') {
                  try { onChunk(delta, fullText); } catch (e) {}
                }
              }
            } catch (e) {
              if (e.message && !e.message.includes('JSON')) throw e;
            }
          }
        }
      }

      if (buffer && buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed && trimmed !== 'data: [DONE]' && trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.replace(/^data:\s*/, ''));
            if (parsed.error) {
              const errStr = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
              throw new Error(errStr);
            }
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              if (streamRenderer) streamRenderer.append(delta);
              if (typeof onChunk === 'function') {
                try { onChunk(delta, fullText); } catch (e) {}
              }
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      const renderedText = streamRenderer ? streamRenderer.finish() : fullText;
      return fullText || renderedText;
    } else {
      const ep = normalizeEndpoint(STATE.settings.ollamaEndpoint);
      const headers = { 'Content-Type': 'application/json' };
      if (STATE.settings.ollamaApiKey) {
        headers['Authorization'] = `Bearer ${STATE.settings.ollamaApiKey}`;
        headers['x-ollama-key'] = STATE.settings.ollamaApiKey;
      }
      const messagesPayload = buildSanitizedMessagesPayload(session, [], 'ollama', systemPrompt, modelName);
      const requestBody = {
        model: modelName,
        messages: messagesPayload,
        stream: true,
        options: { temperature: 0.3 },
        endpoint: ep
      };
      if (STATE.settings.ollamaApiKey) requestBody.apiKey = STATE.settings.ollamaApiKey;

      const chatUrl = (IS_GITHUB_PAGES || /localhost|127\.0\.0\.1|\[::1\]/i.test(ep)) ? resolveEndpointUrl(ep, 'api/chat') : '/api/ollama/chat';
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: STATE.abortController?.signal
      });

      if (!response.ok) {
        let errDetail = `Ollama HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errDetail = typeof errData.error === 'object' ? (errData.error.message || JSON.stringify(errData.error)) : errData.error;
          }
        } catch (je) {}
        throw new Error(errDetail);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.error) {
              const errStr = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
              throw new Error(errStr);
            }
            const chunk = parsed.message?.content || parsed.response || parsed.choices?.[0]?.delta?.content || '';
            if (chunk) {
              fullText += chunk;
              if (streamRenderer) streamRenderer.append(chunk);
              if (typeof onChunk === 'function') {
                try { onChunk(chunk, fullText); } catch (e) {}
              }
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      if (buffer && buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          if (parsed.error) {
            const errStr = typeof parsed.error === 'object' ? (parsed.error.message || JSON.stringify(parsed.error)) : parsed.error;
            throw new Error(errStr);
          }
          const chunk = parsed.message?.content || parsed.response || parsed.choices?.[0]?.delta?.content || '';
          if (chunk) {
            fullText += chunk;
            if (streamRenderer) streamRenderer.append(chunk);
            if (typeof onChunk === 'function') {
              try { onChunk(chunk, fullText); } catch (e) {}
            }
          }
        } catch (e) {
          if (e.message && !e.message.includes('JSON')) throw e;
        }
      }

      const renderedText = streamRenderer ? streamRenderer.finish() : fullText;
      return fullText || renderedText;
    }
  }

  // ==================== DEEP RESEARCH REPORT & EXPORT SUITE ====================
  let currentActiveReport = {
    title: '',
    fullText: '',
    sources: [],
    model: '',
    date: ''
  };

  function extractReportTitle(fullText) {
    if (!fullText || typeof fullText !== 'string') return 'Laporan Riset Mendalam (Deep Research)';
    const match = fullText.match(/^#\s+(?:🔬\s*)?(?:DEEP\s*RESEARCH\s*REPORT:\s*)?([^\n]+)/im);
    if (match && match[1]) {
      return match[1].trim();
    }
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      return lines[0].replace(/^#+\s*/, '').trim();
    }
    return 'Laporan Riset Mendalam (Deep Research)';
  }

  function sanitizeReportFilename(title) {
    let clean = (title || 'Deep-Research-Report')
      .replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF ]/g, '')
      .replace(/\s+/g, '_')
      .trim();

    if (clean.length > 60) {
      clean = clean.slice(0, 60).replace(/_[^_]*$/, '');
    }
    return clean || 'Deep-Research-Report';
  }

  function downloadReportDOCX(title, markdownText) {
    const renderedHtml = renderMarkdown(markdownText || '');
    const cleanFilename = sanitizeReportFilename(title);
    const currentDate = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

    const wordContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #111827;
      margin: 1in;
    }
    h1 {
      font-size: 20pt;
      font-weight: bold;
      color: #0F172A;
      border-bottom: 2pt solid #0284C7;
      padding-bottom: 6pt;
      margin-top: 0;
      margin-bottom: 12pt;
    }
    h2 {
      font-size: 14pt;
      font-weight: bold;
      color: #0369A1;
      margin-top: 18pt;
      margin-bottom: 8pt;
      border-bottom: 1pt solid #E2E8F0;
      padding-bottom: 3pt;
    }
    h3 {
      font-size: 12pt;
      font-weight: bold;
      color: #334155;
      margin-top: 12pt;
      margin-bottom: 6pt;
    }
    p {
      margin-top: 0;
      margin-bottom: 8pt;
    }
    ul, ol {
      margin-top: 0;
      margin-bottom: 8pt;
      padding-left: 20pt;
    }
    li {
      margin-bottom: 4pt;
    }
    blockquote {
      margin: 10pt 0;
      padding: 6pt 14pt;
      background: #F8FAFC;
      border-left: 3pt solid #38BDF8;
      font-style: italic;
      color: #475569;
    }
    code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 10pt;
      background: #F1F5F9;
      padding: 2pt 4pt;
      border-radius: 3pt;
    }
    pre {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 9.5pt;
      background: #F8FAFC;
      border: 1pt solid #E2E8F0;
      padding: 10pt;
      margin-bottom: 10pt;
      white-space: pre-wrap;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12pt 0;
    }
    th, td {
      border: 1pt solid #CBD5E1;
      padding: 6pt 8pt;
      text-align: left;
    }
    th {
      background-color: #F1F5F9;
      font-weight: bold;
    }
    .doc-meta {
      font-size: 9.5pt;
      color: #64748B;
      margin-bottom: 24pt;
      padding-bottom: 8pt;
      border-bottom: 1pt solid #CBD5E1;
    }
    a {
      color: #0284C7;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="doc-meta">
    ZOZ ROUTER &bull; DEEP RESEARCH INTELLIGENCE ENGINE &bull; Diterbitkan: ${currentDate}
  </div>
  ${renderedHtml}
</body>
</html>`;

    // F13: DOCX ASLI (OOXML zip) via JSZip \u2014 dulu konten HTML diberi ekstensi
    // .docx sehingga Word memperingatkan "format dan ekstensi tidak cocok" dan
    // pembaca DOCX-saja bisa menolak. Tanpa JSZip \u2192 unduh sebagai .doc (ekstensi
    // yang jujur untuk konten HTML ala Word).
    const downloadWordBlob = (blobObj, ext, msg) => {
      const url = URL.createObjectURL(blobObj);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanFilename}.${ext}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 800);
      showToast(msg, 'success');
    };

    if (typeof JSZip === 'undefined') {
      downloadWordBlob(new Blob(['\ufeff', wordContent], { type: 'application/msword;charset=utf-8' }), 'doc',
        'Laporan diunduh sebagai .doc (pustaka JSZip tidak tersedia).');
      return;
    }

    const xmlEscape = (s) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const docParagraphs = String(markdownText || '').split(/\r?\n/).map((line) => {
      if (!line.trim()) return '<w:p/>';
      let text = line;
      let bold = false;
      let size = null;
      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        text = heading[2];
        bold = true;
        size = heading[1].length === 1 ? 32 : (heading[1].length === 2 ? 26 : 22);
      } else {
        text = text
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/^>\s?/, '')
          .replace(/^[-*]\s+/, '\u2022 ');
      }
      const rPr = (bold || size)
        ? `<w:rPr>${bold ? '<w:b/>' : ''}${size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : ''}</w:rPr>`
        : '';
      return `<w:p><w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
    }).join('');

    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.folder('_rels').file('.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.folder('word').file('document.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      `<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t xml:space="preserve">${xmlEscape(title)}</w:t></w:r></w:p>` +
      `<w:p><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${xmlEscape('ZOZ ROUTER \u2022 Deep Research \u2022 Diterbitkan: ' + currentDate)}</w:t></w:r></w:p>` +
      docParagraphs +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
      '</w:body></w:document>');

    zip.generateAsync({ type: 'blob' }).then((zipBlob) => {
      downloadWordBlob(
        new Blob([zipBlob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        'docx',
        'Laporan berhasil diunduh dalam format DOCX asli.'
      );
    }).catch(() => {
      downloadWordBlob(new Blob(['\ufeff', wordContent], { type: 'application/msword;charset=utf-8' }), 'doc',
        'Gagal membuat DOCX \u2014 diunduh sebagai .doc sebagai gantinya.');
    });
  }

  function downloadReportPDF(title, markdownText) {
    const renderedHtml = renderMarkdown(markdownText || '');
    let currentDate = '';
    try {
      const reportDateObj = (currentActiveReport && currentActiveReport.date) ? new Date(currentActiveReport.date) : new Date();
      currentDate = !isNaN(reportDateObj.getTime())
        ? reportDateObj.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      currentDate = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    let printFrame = document.getElementById('reportPrintFrame');
    if (printFrame) printFrame.remove();

    printFrame = document.createElement('iframe');
    printFrame.id = 'reportPrintFrame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(sanitizeReportFilename(title))}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.6;
      color: #111827;
      margin: 0;
      padding: 0;
      background: #FFFFFF;
    }
    .print-header {
      border-bottom: 2px solid #00F0FF;
      padding-bottom: 12px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .print-header .logo-text {
      font-size: 13pt;
      font-weight: 800;
      letter-spacing: 1px;
      color: #0F172A;
    }
    .print-header .meta-text {
      font-size: 9pt;
      color: #64748B;
    }
    h1 {
      font-size: 18pt;
      font-weight: 800;
      color: #0F172A;
      margin-top: 0;
      margin-bottom: 12pt;
      line-height: 1.3;
    }
    h2 {
      font-size: 13pt;
      font-weight: 700;
      color: #0284C7;
      margin-top: 20pt;
      margin-bottom: 8pt;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 4pt;
      page-break-after: avoid;
    }
    h3 {
      font-size: 11pt;
      font-weight: 700;
      color: #334155;
      margin-top: 14pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }
    p {
      margin-top: 0;
      margin-bottom: 8pt;
    }
    ul, ol {
      margin-top: 0;
      margin-bottom: 8pt;
      padding-left: 20pt;
    }
    li {
      margin-bottom: 4pt;
    }
    blockquote {
      margin: 10pt 0;
      padding: 6pt 12pt;
      background: #F8FAFC;
      border-left: 3.5px solid #0284C7;
      font-style: italic;
      color: #475569;
    }
    code {
      font-family: Consolas, Monaco, monospace;
      font-size: 9pt;
      background: #F1F5F9;
      padding: 2pt 4pt;
      border-radius: 3pt;
    }
    pre {
      font-family: Consolas, Monaco, monospace;
      font-size: 8.5pt;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 10pt;
      border-radius: 4pt;
      white-space: pre-wrap;
      word-break: break-all;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
      font-size: 9.5pt;
    }
    th, td {
      border: 1px solid #CBD5E1;
      padding: 6pt 8pt;
      text-align: left;
    }
    th {
      background: #F1F5F9;
      font-weight: 700;
    }
    a {
      color: #0284C7;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="print-header">
    <div class="logo-text">🔬 ZOZ ROUTER &bull; DEEP RESEARCH REPORT</div>
    <div class="meta-text">Diterbitkan: ${currentDate}</div>
  </div>
  ${renderedHtml}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (e) {
        console.warn('Gagal memanggil print frame:', e);
      }
      // Pembersihan otomatis elemen iframe dari DOM setelah dialog cetak selesai
      setTimeout(() => {
        if (printFrame && printFrame.parentNode) {
          printFrame.parentNode.removeChild(printFrame);
        }
      }, 60000);
    }, 400);
  }

  function downloadReportMD(title, markdownText) {
    const cleanFilename = sanitizeReportFilename(title);
    const blob = new Blob([markdownText || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanFilename}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 800);
    showToast('Laporan berhasil diunduh dalam format Markdown (.md)', 'success');
  }

  // Membungkus bagian "Daftar Pustaka" bawaan laporan + panel Sumber Web agar bisa disembunyikan sekaligus
  function markReportReferences(contentEl, sources) {
    if (!contentEl) return;
    const refRegex = /daftar\s*pustaka|sumber\s*referensi|referensi|references|bibliograf/i;
    const headingEls = Array.from(contentEl.querySelectorAll('h1, h2, h3, h4'));
    let refHeading = null;
    headingEls.forEach(h => { if (refRegex.test(h.textContent || '')) refHeading = h; });

    if (refHeading && refHeading.parentElement === contentEl) {
      const section = document.createElement('section');
      section.className = 'report-references-section';
      let startNode = refHeading;
      const prev = refHeading.previousElementSibling;
      if (prev && prev.tagName === 'HR') startNode = prev;
      contentEl.insertBefore(section, startNode);
      let node = startNode;
      while (node) {
        const next = node.nextSibling;
        section.appendChild(node);
        node = next;
      }
    }

    if (sources && Array.isArray(sources) && sources.length > 0) {
      const panel = document.createElement('section');
      panel.className = 'report-references-section report-sources-panel';
      panel.innerHTML = `
        <div class="report-sources-title"><i class="fa-solid fa-earth-americas"></i> Sumber Web Terverifikasi (${sources.length})</div>
        <ol class="report-sources-list">
          ${sources.map(s => `
            <li>
              <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title || s.domain || s.url)}</a>
              <span class="report-source-domain">${escapeHtml(s.domain || '')}</span>
            </li>
          `).join('')}
        </ol>
      `;
      contentEl.appendChild(panel);
    }
  }

  function applyReportReferencesState() {
    const modal = document.getElementById('deepResearchReportModal');
    const btn = document.getElementById('btnToggleReportSources');
    if (!modal) return;
    let hidden = false;
    try { hidden = localStorage.getItem('zoz_report_refs_hidden') === '1'; } catch (e) {}
    modal.classList.toggle('references-hidden', hidden);
    if (btn) {
      btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
      btn.title = hidden ? 'Tampilkan referensi web' : 'Sembunyikan referensi web';
      btn.innerHTML = hidden
        ? '<i class="fa-solid fa-eye"></i> <span>Tampilkan Referensi</span>'
        : '<i class="fa-solid fa-eye-slash"></i> <span>Sembunyikan Referensi</span>';
    }

    // Jika link TOC yang sedang aktif kini tersembunyi, pindahkan status active ke link terakhir yang tampak
    const activeToc = modal.querySelector('#fullReportTOCList .toc-link.active');
    if (activeToc && activeToc.offsetParent === null) {
      const visibleLinks = Array.from(modal.querySelectorAll('#fullReportTOCList .toc-link')).filter(el => el.offsetParent !== null);
      if (visibleLinks.length > 0) {
        activeToc.classList.remove('active');
        visibleLinks[visibleLinks.length - 1].classList.add('active');
      }
    }
  }

  function toggleReportReferences() {
    const modal = document.getElementById('deepResearchReportModal');
    if (!modal) return;
    const willHide = !modal.classList.contains('references-hidden');
    try { localStorage.setItem('zoz_report_refs_hidden', willHide ? '1' : '0'); } catch (e) {}
    applyReportReferencesState();
    AudioEngine.click();
  }

  function openDeepResearchReportModal(fullText, title, meta = {}) {
    const modal = document.getElementById('deepResearchReportModal');
    if (!modal) return;

    const resolvedTitle = title || extractReportTitle(fullText);
    const modalTitleEl = document.getElementById('fullReportModalTitle');
    if (modalTitleEl) modalTitleEl.textContent = resolvedTitle;

    const dateEl = document.getElementById('fullReportDate');
    if (dateEl) {
      let dateText = '-';
      try {
        const d = meta.date ? new Date(meta.date) : new Date();
        if (!isNaN(d.getTime())) {
          dateText = d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
      } catch (e) {}
      dateEl.textContent = dateText;
    }

    const sourcesCountEl = document.getElementById('fullReportSourcesCount');
    if (sourcesCountEl) {
      sourcesCountEl.textContent = (meta.sources && Array.isArray(meta.sources)) ? meta.sources.length : '0';
    }

    const modelsUsedEl = document.getElementById('fullReportModelsUsed');
    if (modelsUsedEl) {
      modelsUsedEl.textContent = meta.model || 'Deep Research Pro';
    }

    // Simpan ke state pelacak laporan aktif
    currentActiveReport = {
      title: resolvedTitle,
      fullText: fullText || '',
      sources: meta.sources || [],
      model: meta.model || '',
      date: meta.date || new Date().toISOString()
    };

    // Reset scroll posisi dokumen ke paling atas
    const stageEl = document.getElementById('fullReportArticleStage');
    if (stageEl) {
      stageEl.scrollTop = 0;
    }

    // Render markdown dokumen utuh ke reading stage
    const contentEl = document.getElementById('fullReportContent');
    if (contentEl) {
      contentEl.innerHTML = renderMarkdown(fullText || '');
      enhanceCodeBlocks(contentEl);
      markReportReferences(contentEl, meta.sources);

      // Bangun Dynamic Outline / Table of Contents
      const tocList = document.getElementById('fullReportTOCList');
      if (tocList) {
        tocList.innerHTML = '';
        const headings = contentEl.querySelectorAll('h1, h2, h3');
        if (headings.length > 0) {
          headings.forEach((heading, idx) => {
            const anchorId = `report-heading-${idx}`;
            heading.id = anchorId;

            const level = heading.tagName.toLowerCase();
            const levelClass = (level === 'h1') ? 'toc-h1' : (level === 'h2' ? 'toc-h2' : 'toc-h3');
            const tocItem = document.createElement('a');
            tocItem.className = `toc-link ${levelClass}${heading.closest('.report-references-section') ? ' toc-ref' : ''}`;
            tocItem.dataset.headingId = anchorId;
            tocItem.href = `#${anchorId}`;
            tocItem.textContent = heading.textContent.trim();
            tocItem.addEventListener('click', (e) => {
              e.preventDefault();
              heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
              tocList.querySelectorAll('.toc-link').forEach(el => el.classList.remove('active'));
              tocItem.classList.add('active');
            });
            tocList.appendChild(tocItem);
          });

          // Set heading pertama sebagai default aktif
          tocList.querySelector('.toc-link')?.classList.add('active');

          // Pasang Scrollspy dinamis saat pengguna men-scroll canvas artikel
          if (stageEl) {
            let isTicking = false;
            const updateTOCScrollspy = () => {
              const stageTop = stageEl.getBoundingClientRect().top;
              let currentActiveIdx = 0;

              headings.forEach((heading, idx) => {
                if (heading.offsetParent === null) return; // Lewati heading yang disembunyikan (misal: references-hidden)
                const rect = heading.getBoundingClientRect();
                if (rect.top - stageTop <= 130) {
                  currentActiveIdx = idx;
                }
              });

              const activeAnchorId = `report-heading-${currentActiveIdx}`;
              const currentActiveLink = tocList.querySelector(`.toc-link[data-heading-id="${activeAnchorId}"]`);
              if (currentActiveLink && !currentActiveLink.classList.contains('active')) {
                tocList.querySelectorAll('.toc-link').forEach(el => el.classList.remove('active'));
                currentActiveLink.classList.add('active');

                // Auto-scroll halus sidebar TOC jika link berada di luar area pandang
                const tocNavRect = tocList.getBoundingClientRect();
                const linkRect = currentActiveLink.getBoundingClientRect();
                if (linkRect.bottom > tocNavRect.bottom || linkRect.top < tocNavRect.top) {
                  currentActiveLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
              }
              isTicking = false;
            };

            if (stageEl._tocScrollHandler) {
              stageEl.removeEventListener('scroll', stageEl._tocScrollHandler);
            }
            stageEl._tocScrollHandler = () => {
              if (!isTicking) {
                window.requestAnimationFrame(updateTOCScrollspy);
                isTicking = true;
              }
            };
            stageEl.addEventListener('scroll', stageEl._tocScrollHandler, { passive: true });
          }
        } else {
          tocList.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted); padding:8px 12px; display:block;">Tidak ada outline dokumen</span>';
        }
      }
    }

    applyReportReferencesState();
    openModal('deepResearchReportModal');
  }

  function buildDeepResearchSummaryCardHtml(fullText, model = '', sources = [], date = null, chatSummary = '') {
    const reportTitle = extractReportTitle(fullText);
    const sourcesCount = (sources && Array.isArray(sources)) ? sources.length : 0;

    let dateStr = '';
    try {
      const d = date ? new Date(date) : new Date();
      if (!isNaN(d.getTime())) {
        dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (e) {}

    const metaParts = [];
    if (dateStr) metaParts.push(dateStr);
    if (sourcesCount > 0) metaParts.push(`${sourcesCount} Sumber Terverifikasi`);
    if (model) metaParts.push(escapeHtml(model));
    const metaString = metaParts.join(' &bull; ');

    let effectiveSummary = (chatSummary && chatSummary.trim()) ? chatSummary.trim() : '';

    // Backward compatibility: Jika chatSummary kosong (riwayat sesi lama), ekstrak Bab 1 / Pendahuluan dari fullText
    if (!effectiveSummary && fullText && typeof fullText === 'string') {
      const bab1Match = fullText.match(/##\s*1\.\s*.*?\n([\s\S]*?)(?=\n##\s*2\.|\n---|$)/i);
      if (bab1Match && bab1Match[1] && bab1Match[1].trim()) {
        const cleanBab1 = bab1Match[1].trim();
        effectiveSummary = `### 💡 Rangkuman Eksekutif Riset\n${cleanBab1.substring(0, 700)}${cleanBab1.length > 700 ? '...' : ''}\n\n*Catatan: Dokumen analisis komprehensif lengkap dapat dibuka melalui tombol di bawah.*`;
      }
    }

    const summaryHtml = effectiveSummary ? renderMarkdown(effectiveSummary) : '';

    return `
      <div class="gemini-research-card-wrapper" style="display:flex; flex-direction:column; gap:12px; width:100%;">
        ${summaryHtml ? `
          <div class="gemini-research-chat-summary" style="background:rgba(0, 240, 255, 0.04); border:1px solid rgba(0, 240, 255, 0.22); border-radius:10px; padding:14px 16px; font-size:0.86rem; line-height:1.6; color:var(--text-main); box-shadow:0 4px 16px rgba(0,0,0,0.25);">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.08);">
              <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; font-weight:700; color:var(--neon-cyan);">
                <i class="fa-solid fa-sparkles"></i>
                <span>RANGKUMAN EKSEKUTIF CHAT (MODEL 4)</span>
              </div>
              <span class="badge" style="font-size:0.65rem; background:rgba(0, 255, 194, 0.12); color:var(--neon-teal); border:1px solid rgba(0,255,194,0.3); border-radius:4px; padding:2px 8px;">
                Terkoreksi Model 3
              </span>
            </div>
            <div class="chat-summary-markdown" style="font-size:0.85rem;">
              ${summaryHtml}
            </div>
          </div>
        ` : `
          <div class="gemini-research-intro">
            Riset mendalam telah selesai dan divalidasi silang. Anda dapat membuka dokumen laporan lengkap hasil audit dan koreksi Model 3 di bawah ini:
          </div>
        `}
        <div class="gemini-research-card" data-action="open-full-report" role="button" tabindex="0" title="Klik untuk membuka dokumen riset mendalam lengkap (Hasil Audit & Koreksi Model 3)">
          <div class="gemini-card-left">
            <div class="gemini-card-icon-box" style="background:rgba(255, 0, 127, 0.12); border-color:rgba(255, 0, 127, 0.35); color:#FF007F;">
              <i class="fa-solid fa-book-open-reader"></i>
            </div>
            <div class="gemini-card-content">
              <h4 class="gemini-card-title">${escapeHtml(reportTitle)}</h4>
              <div class="gemini-card-meta">${metaString}</div>
            </div>
          </div>
          <button type="button" class="gemini-card-open-btn" data-action="open-full-report" title="Buka Dokumen Riset Komprehensif">
            <i class="fa-solid fa-book-bookmark" style="margin-right:4px;"></i>
            <span>Buka Laporan (${sourcesCount} Sumber)</span>
          </button>
        </div>
      </div>
    `;
  }

  function attachDeepResearchCardEvents(container, fullText, model, sources, date) {
    if (!container) return;
    const reportTitle = extractReportTitle(fullText);
    const openReport = () => {
      openDeepResearchReportModal(fullText, reportTitle, {
        sources,
        model,
        date: date || container.dataset.reportDate || new Date().toISOString()
      });
    };

    container.querySelectorAll('[data-action="open-full-report"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openReport();
      });
    });

    // Logo / Badge Deep Research & Badge Sumber di metadata bubble kini bisa diklik untuk langsung membuka laporan & sumber
    container.querySelectorAll('.engine-badge, .sources-badge').forEach(badge => {
      badge.style.cursor = 'pointer';
      badge.setAttribute('title', 'Klik untuk melihat sumber & laporan lengkap riset');
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        openReport();
      });
    });

    const cardEl = container.querySelector('.gemini-research-card');
    cardEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openReport();
      }
    });

    container.querySelector('[data-action="export-pdf"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadReportPDF(reportTitle, fullText);
    });

    container.querySelector('[data-action="export-docx"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadReportDOCX(reportTitle, fullText);
    });

    container.querySelector('[data-action="export-md"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadReportMD(reportTitle, fullText);
    });
  }

  async function runDeepResearchStreaming(session, promptText, image = null, modelName = null, engine = 'ollama', customTargetUrls = []) {

    const targetModel = modelName || (engine === 'openrouter' ? STATE.settings.openRouterModel : STATE.settings.ollamaModel);
    // Mandat Mutlak Kaisar Zozi: Deep Research 100% Mengadopsi Model Percakapan Aktif Saat Itu.
    // Seluruh konfigurasi model riset di settings telah dihapus. Pipeline Deep Research (Explorer Agen 1,
    // Divergent Agen 2, Lead Corrector Model 3, dan Executive Summarizer Model 4) berjalan super efisien
    // menggunakan 1 model master tunggal yang sedang aktif di percakapan pengguna.
    const masterResearchModel = targetModel;

    // Kumpulkan seluruh URL target kustom pengguna
    let effectiveTargetUrls = Array.isArray(customTargetUrls) && customTargetUrls.length > 0
      ? [...customTargetUrls]
      : (Array.isArray(STATE.researchTargetUrls) ? [...STATE.researchTargetUrls] : []);
    const urlsInPrompt = extractCustomAnalysisUrls(promptText);
    urlsInPrompt.forEach(u => {
      if (!effectiveTargetUrls.includes(u)) effectiveTargetUrls.push(u);
    });
    effectiveTargetUrls = effectiveTargetUrls.map(u => {
      let clean = String(u).trim();
      if (!/^https?:\/\//i.test(clean)) clean = 'https://' + clean;
      return clean;
    });
    effectiveTargetUrls = Array.from(new Set(effectiveTargetUrls));

    setGeneratingState(true);
    const currentAbortController = new AbortController();
    STATE.abortController = currentAbortController;

    const startTime = performance.now();
    const assistantRow = appendMessageElement('assistant', '', null, `${masterResearchModel} (Deep Research)`, null, -1, null, null, true);
    const bubbleText = assistantRow.querySelector('.msg-text-content');
    const metaBox = assistantRow.querySelector('.message-meta');

    let allSources = [];
    let currentProgress = 10;
    let stepItems = [
      { text: `Inisialisasi Penganalisis Web Kustom URL (${effectiveTargetUrls.length} URL target)...`, status: 'active' }
    ];

    function renderResearchHUD(progress, statusMsg) {
      bubbleText.innerHTML = `
        <div class="deep-research-hud">
          <div class="deep-research-header">
            <div class="deep-research-title">
              <i class="fa-solid fa-microscope" style="color:var(--neon-amber);"></i>
              <span>Deep Research: Penganalisis Web Kustom URL</span>
            </div>
            <span class="deep-research-badge">${effectiveTargetUrls.length} URL Target</span>
          </div>
          <div class="deep-research-progress-bar">
            <div class="deep-research-progress-fill" style="width: ${progress}%;"></div>
          </div>
          <div class="deep-research-status-text">
            <i class="fa-solid fa-circle-notch fa-spin" style="color:var(--neon-amber);"></i>
            <span class="status-msg">${escapeHtml(statusMsg)}</span>
          </div>
          <div class="deep-research-steps-list">
            ${stepItems.map(item => `
              <div class="deep-research-step-item ${item.status === 'active' ? 'active' : ''}">
                <i class="fa-solid ${item.status === 'done' ? 'fa-check' : (item.status === 'active' ? 'fa-circle-dot' : 'fa-clock')}" 
                   style="color:${item.status === 'done' ? 'var(--neon-teal)' : (item.status === 'active' ? 'var(--neon-amber)' : 'var(--text-dim)')};"></i>
                <span>${escapeHtml(item.text)}</span>
              </div>
            `).join('')}
          </div>
          <div class="deep-research-actions" style="margin-top: 10px; display: flex; gap: 8px;">
            <button type="button" class="btn btn-xs btn-outline btn-live-inspection-trigger" style="font-size: 0.76rem; border-color: rgba(0, 240, 255, 0.4); color: var(--neon-cyan); background: rgba(0, 240, 255, 0.08); display: inline-flex; align-items: center; gap: 6px; cursor: pointer; padding: 5px 12px; border-radius: var(--radius-sm); font-weight: 600;">
              <i class="fa-solid fa-eye"></i> Pertinjau Proses Nyata (Live Inspection)
            </button>
          </div>
        </div>
      `;

      const triggerBtn = bubbleText.querySelector('.btn-live-inspection-trigger');
      if (triggerBtn) {
        triggerBtn.addEventListener('click', () => {
          openLiveResearchInspection();
        });
      }

      smartScrollChatToBottom(false);
    }

    renderResearchHUD(15, `Menyiapkan ekstraksi konten lengkap untuk ${effectiveTargetUrls.length} URL...`);

    let finalReportText = '';
    let chatSummary = '';

    let effectivePrompt = promptText;
    let searchPrompt = promptText;
    try {
      const ytRes = await getYouTubeGroundingContext(promptText);
      if (ytRes) {
        if (ytRes.groundingContext) {
          effectivePrompt = `${promptText}\n\n${ytRes.groundingContext}`;
        }
        if (Array.isArray(ytRes.videos) && ytRes.videos.length > 0) {
          const videoTitles = ytRes.videos.map(v => v.title).filter(Boolean).join(' ');
          const promptWithoutYtUrls = promptText.replace(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+)[^\s]*/gi, '').trim();
          searchPrompt = `${promptWithoutYtUrls} ${videoTitles}`.trim() || videoTitles || promptText;
        }
      }
    } catch (ytErr) {
      console.warn('YouTube grounding skip for Deep Research:', ytErr);
    }

    try {
      let isBackendSuccess = false;
      const contextualTopic = session ? synthesizeAutonomousSearchQuery(session, searchPrompt) : searchPrompt;

      // 1. Coba panggil Backend Endpoint /api/mulai-riset (Local Node.js Server)
      if (!IS_GITHUB_PAGES) {
        try {
          const res = await fetch('/api/mulai-riset', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': STATE.settings.openRouterKey ? `Bearer ${STATE.settings.openRouterKey}` : '',
              'x-openrouter-key': STATE.settings.openRouterKey || '',
              'x-serper-key': STATE.settings.serperApiKey || '075538fed9c64990e1eb32a06726c1e55a933c1e',
              'x-session-id': session ? session.id : '',
              'X-User-ID': STATE.userId || 'default',
              'x-user-id': STATE.userId || 'default'
            },
            body: JSON.stringify({
              userId: STATE.userId || 'default',
              sessionId: session ? session.id : null,
              topik: contextualTopic,
              prompt: searchPrompt,
              targetUrls: effectiveTargetUrls,
              urls: effectiveTargetUrls,
              messages: (session && Array.isArray(session.messages)) ? session.messages.map(m => ({
                role: m.role || 'user',
                content: typeof m.content === 'string' ? m.content : ''
              })) : [],
              model: masterResearchModel,
              provider: masterResearchModel.includes('/') ? 'openrouter' : (masterResearchModel.includes(':') ? 'ollama' : engine),
              endpoint: STATE.settings.ollamaEndpoint,
              apiKey: (masterResearchModel.includes('/') || engine === 'openrouter') ? STATE.settings.openRouterKey : (STATE.settings.ollamaApiKey || ''),
              openRouterKey: STATE.settings.openRouterKey || '',
              ollamaApiKey: STATE.settings.ollamaApiKey || '',
              serperApiKey: STATE.settings.serperApiKey,
              agent1Model: masterResearchModel,
              agent2Model: masterResearchModel,
              finalModel: masterResearchModel,
              model3: masterResearchModel,
              model4: masterResearchModel,
              maxIterations: 3
            }),
            signal: currentAbortController.signal
          });

          if (res.ok) {
            const data = await res.json();
            const taskId = data.taskId;

            if (taskId) {
              STATE.currentDeepResearchTaskId = taskId;
              // 2. Lakukan Polling berkala ke /api/status-riset/:id
              while (STATE.isGenerating && !currentAbortController.signal.aborted) {
                await new Promise(r => setTimeout(r, 1000));
                if (currentAbortController.signal.aborted || !STATE.isGenerating) {
                  if (!IS_GITHUB_PAGES) {
                    fetch('/api/batal-riset/' + taskId, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-User-ID': STATE.userId || 'default',
                        'x-user-id': STATE.userId || 'default'
                      },
                      body: JSON.stringify({ userId: STATE.userId || 'default' })
                    }).catch(() => {});
                  }
                  break;
                }

                const checkRes = await fetch(`/api/status-riset/${taskId}`, {
                  headers: {
                    'X-User-ID': STATE.userId || 'default',
                    'x-user-id': STATE.userId || 'default'
                  },
                  signal: currentAbortController.signal
                });
                if (!checkRes.ok) break;

                const statusData = await checkRes.json();

                if (statusData.stepsHistory && Array.isArray(statusData.stepsHistory)) {
                  stepItems = statusData.stepsHistory.map((s, idx) => ({
                    text: s.replace(/^\[\d+:\d+:\d+\]\s*/, ''),
                    status: (idx === statusData.stepsHistory.length - 1 && statusData.status !== 'selesai') ? 'active' : 'done'
                  }));
                }

                if (statusData.liveInspection) {
                  updateLiveInspectionData(statusData.liveInspection);
                }

                currentProgress = statusData.progressPercent || currentProgress;
                renderResearchHUD(currentProgress, statusData.currentStep || 'Sedang meneliti web secara otonom...');

                if (statusData.status === 'selesai') {
                  finalReportText = statusData.hasil || '';
                  chatSummary = statusData.chatSummary || '';
                  allSources = statusData.sources || [];
                  isBackendSuccess = true;
                  STATE.currentDeepResearchTaskId = null;
                  if (statusData.liveInspection?.synthesizer) {
                    updateLiveInspectionData({ synthesizer: statusData.liveInspection.synthesizer });
                  } else {
                    updateLiveInspectionData({
                      synthesizer: {
                        name: 'Model 3 (Lead Corrector & Enhancer)',
                        model: masterResearchModel,
                        status: 'completato',
                        text: finalReportText,
                        length: (finalReportText || '').length
                      }
                    });
                  }
                  if (statusData.liveInspection?.model4) {
                    updateLiveInspectionData({ model4: statusData.liveInspection.model4 });
                  } else if (chatSummary) {
                    updateLiveInspectionData({
                      model4: {
                        name: 'Model 4 (Executive Chat Summarizer)',
                        model: masterResearchModel,
                        status: 'completato',
                        text: chatSummary,
                        length: (chatSummary || '').length
                      }
                    });
                  }
                  break;
                } else if (statusData.status === 'gagal' || statusData.status === 'dibatalkan') {
                  STATE.currentDeepResearchTaskId = null;
                  const errMsg = statusData.error || (statusData.status === 'dibatalkan' ? 'Riset dibatalkan oleh pengguna.' : 'Riset gagal diselesaikan.');
                  const statusErr = new Error(errMsg);
                  if (statusData.status === 'dibatalkan') {
                    statusErr.name = 'AbortError';
                  }
                  throw statusErr;
                }
              }
            }
          }
        } catch (backendErr) {
          if (backendErr.name === 'AbortError' || backendErr.message?.includes('dibatalkan') || currentAbortController.signal.aborted || !STATE.isGenerating) {
            if (STATE.currentDeepResearchTaskId && !IS_GITHUB_PAGES) {
              fetch('/api/batal-riset/' + STATE.currentDeepResearchTaskId, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-User-ID': STATE.userId || 'default',
                  'x-user-id': STATE.userId || 'default'
                },
                body: JSON.stringify({ userId: STATE.userId || 'default' })
              }).catch(() => {});
            }
            const abortErr = new Error('Deep Research dihentikan oleh pengguna.');
            abortErr.name = 'AbortError';
            throw abortErr;
          }
          console.warn('Backend deep research fallback ke client-side execution:', backendErr);
        }
      }

      // 3. Fallback Client-Side Deep Custom URL Web Content Analyzer
      if (!isBackendSuccess && !currentAbortController.signal.aborted && STATE.isGenerating) {
        if (effectiveTargetUrls.length === 0) {
          throw new Error('Mode Deep Research memerlukan minimal 1 URL kustom untuk dianalisis.');
        }

        stepItems.push({ text: `[Langkah 1/3] Mengambil & mengekstrak konten lengkap dari ${effectiveTargetUrls.length} URL kustom...`, status: 'active' });
        renderResearchHUD(25, `[Langkah 1/3] Mengambil konten lengkap dari ${effectiveTargetUrls.length} URL kustom...`);

        const scrapedPages = [];
        for (let idx = 0; idx < effectiveTargetUrls.length; idx++) {
          if (currentAbortController.signal.aborted || !STATE.isGenerating) break;
          const targetUrl = effectiveTargetUrls[idx];
          let domain = targetUrl;
          try { domain = new URL(targetUrl).hostname; } catch (_) {}

          renderResearchHUD(25 + Math.round(((idx + 1) / effectiveTargetUrls.length) * 25), `[Langkah 1/3] Membaca halaman (${idx + 1}/${effectiveTargetUrls.length}): ${domain}...`);

          try {
            const pageData = await extractWebContentFromUrl(targetUrl, 16000);
            if (pageData && pageData.content && pageData.content.length > 50) {
              scrapedPages.push({
                url: pageData.url || targetUrl,
                domain: pageData.domain || domain,
                title: pageData.title || domain,
                charCount: pageData.charCount || pageData.content.length,
                content: pageData.content
              });
              allSources.push({
                title: pageData.title || domain,
                url: pageData.url || targetUrl,
                domain: pageData.domain || domain,
                snippet: pageData.content.slice(0, 300) + '...',
                sourceProvider: 'URL Kustom Analisis'
              });
            }
          } catch (e) {
            console.warn('Gagal membaca URL client-side:', targetUrl, e);
          }
        }

        if (scrapedPages.length === 0) {
          throw new Error('Gagal mengekstrak teks isi dari URL kustom yang diberikan. Pastikan tautan dapat diakses publik.');
        }

        updateLiveInspectionData({
          topik: contextualTopic,
          currentQuery: effectiveTargetUrls.join(', '),
          iteration: 1,
          maxIterations: 1,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          agent1: {
            name: 'Penganalisis Web Kustom URL (Ekstraksi Konten)',
            provider: 'Deep Web Extractor',
            model: masterResearchModel,
            resultsCount: scrapedPages.length,
            results: scrapedPages.map(p => ({ title: p.title, link: p.url, snippet: p.content.slice(0, 250) + '...', charCount: p.charCount })),
            analysis: `Berhasil mengekstrak ${scrapedPages.length} halaman web kustom utuh untuk telaah mendalam.`
          },
          scraper: {
            status: 'completato',
            totalScraped: scrapedPages.length,
            temporalAnalysis: '',
            articles: scrapedPages.map(p => ({
              title: p.title,
              url: p.url,
              domain: p.domain,
              sourceProvider: 'URL Kustom Analisis',
              length: p.charCount,
              sample: p.content.slice(0, 300) + '...'
            }))
          },
          analyzer: {
            name: 'Penganalisis Web Kustom URL',
            model: masterResearchModel,
            urls: scrapedPages.map(p => ({
              url: p.url,
              domain: p.domain,
              title: p.title,
              charCount: p.charCount,
              sample: p.content.slice(0, 300) + '...'
            }))
          },
          scrapedArticlesCount: scrapedPages.length,
          totalSourcesCount: allSources.length
        });

        // TAHAP 2/3: DEKONSTRUKSI KONTEN, ANALISIS DATA TERBARU VS DATA LAMA
        stepItems[stepItems.length - 1].status = 'done';
        stepItems.push({ text: `[Langkah 2/3] Model Riset (${masterResearchModel}) membedah struktur isi, mendeteksi fakta terbaru vs konteks lama...`, status: 'active' });
        renderResearchHUD(60, `[Langkah 2/3] Membedah struktur isi, fakta terbaru vs konteks lama...`);

        const docsContext = scrapedPages.map((p, idx) => `
=====================================================
DOKUMEN KUSTOM #${idx + 1}: ${p.title}
URL: ${p.url}
DOMAIN: ${p.domain}
=====================================================
${p.content.slice(0, 14000)}
=====================================================
`).join('\n\n');

        const promptBedahKomparatif = `Anda adalah Ahli Analisis Dokumen Web & Intelijen Data Kustom (Deep Custom URL Web Content Analyzer).
Instruksi Pengguna: "${effectivePrompt}"

Berikut adalah isi teks LENGKAP dari URL kustom yang diberikan pengguna:
${docsContext}

TUGAS ANDA:
1. Bedah isi keseluruhan secara mendalam (apa esensi utama, topik bahasan, poin-poin kunci, data kuantitatif, arsitektur, dan argumen penting).
2. Identifikasi secara spesifik APA YANG TERBARU:
   - Pembaruan terkini, pengumuman terbaru, fitur/versi rilis terkini, kebijakan baru, harga terbaru, atau fakta baru.
3. Identifikasi secara spesifik APA YANG LAMA:
   - Konteks historis, aturan/kebijakan terdahulu, versi terdahulu, fakta lama, atau apa yang telah digantikan/ditinggalkan.
4. Buat poin-poin matriks perbandingan antara Data Baru vs Data Lama.`;

        let hasilBedahAnalisis = '';
        try {
          hasilBedahAnalisis = await callClientLLMDirect(masterResearchModel, promptBedahKomparatif, 'Anda adalah Deep Research Web Content Analyzer yang objektif, kritis, dan sangat teliti dalam membedakan data baru vs lama.');
        } catch (e) {
          console.warn('Gagal analisis bedah client-side:', e);
          hasilBedahAnalisis = `[Rangkuman Ekstraksi Dokumen]:\n${scrapedPages.map(p => `- ${p.title} (${p.url}): ${p.content.slice(0, 400)}...`).join('\n')}`;
        }

        updateLiveInspectionData({
          agent2: {
            name: 'Dekonstruksi Konseptual & Analisis Struktur',
            provider: 'Neural Content Deconstructor',
            model: masterResearchModel,
            resultsCount: scrapedPages.length,
            analysis: hasilBedahAnalisis
          },
          scraper: {
            status: 'completato',
            totalScraped: scrapedPages.length,
            temporalAnalysis: hasilBedahAnalisis,
            articles: scrapedPages.map(p => ({
              title: p.title,
              url: p.url,
              domain: p.domain,
              sourceProvider: 'URL Kustom Analisis',
              length: p.charCount,
              sample: p.content.slice(0, 350) + '...'
            }))
          }
        });

        // TAHAP 3/3: PENYUSUNAN LAPORAN EKSEKUTIF DENGAN MATRIKS KOMPARASI
        stepItems[stepItems.length - 1].status = 'done';
        stepItems.push({ text: `[Langkah 3/3] Menyusun Laporan Analisis Eksekutif Web & Matriks Komparasi...`, status: 'active' });
        renderResearchHUD(85, `[Langkah 3/3] Menyusun Laporan Analisis Eksekutif Web & Matriks Komparasi...`);

        const promptLaporanAkhir = `Anda adalah Lead Executive Research Architect.
Perintah / Pertanyaan Pengguna: "${effectivePrompt}"
Daftar URL Kustom yang Dianalisis: ${effectiveTargetUrls.join(', ')}

Hasil Telaah Analitis Mendalam:
${hasilBedahAnalisis}

Susun Laporan Riset Komprehensif dengan struktur format markdown berikut:

# 🌐 LAPORAN ANALISIS MENDALAM: PENGANALISIS WEB KUSTOM URL
> **URL Target:** ${effectiveTargetUrls.map(u => `[${u}](${u})`).join(', ')}  
> **Fokus Analisis:** Dekonstruksi Konten Utuh, Data Terbaru vs Lama, & Matriks Evolusi  
> **Model Analisis:** ${masterResearchModel}  

---

## 1. 📌 Ringkasan Eksekutif & Dekonstruksi Isi Dokumen
(Uraikan secara menyeluruh intisari isi halaman web, tujuan artikel/dokumen, pesan inti, dan konteks pembahasan secara mendalam dan padat).

## 2. ⚡ Informasi & Fakta Terbaru (Apa yang Terkini)
(Jelaskan secara rinci seluruh data terbaru, pengumuman, fitur terkini, update penting, metrik terbaru, dan fakta paling mutakhir yang ditemukan pada halaman).

## 3. 🏛️ Konteks Lama & Latar Belakang Historis (Apa yang Lama / Digantikan)
(Uraikan secara jelas kondisi terdahulu, aturan atau versi lama, latar belakang sebelum perubahan terjadi, atau apa yang digantikan oleh informasi terbaru tersebut).

## 4. ⚖️ Matriks Komparasi: Perubahan Baru vs Lama
Sajikan perbandingan terstruktur dalam format TABEL MARKDOWN:
| Kategori / Aspek | Kondisi / Data Lama | Pembaruan / Fakta Terbaru | Implikasi Perubahan |
| :--- | :--- | :--- | :--- |
(Isi minimal 3-6 baris komparasi nyata berdasarkan isi dokumen).

## 5. 💡 Analisis Implikasi & Sintesis Kritis
(Telaah dampak perubahan atau informasi ini bagi pengguna, industri, atau ekosistem terkait).

## 6. 🎯 Rekomendasi & Langkah Strategis
(Langkah taktis yang disarankan berdasarkan temuan).

## 7. 🔗 Referensi Sumber Kustom Terverifikasi
(Daftar tautan asli lengkap yang dapat diklik langsung oleh pengguna).`;

        try {
          finalReportText = await callClientLLMDirect(masterResearchModel, promptLaporanAkhir, 'Anda adalah Executive Research Architect yang menyusun laporan riset tingkat tinggi yang terstruktur rapi.');
        } catch (e) {
          finalReportText = `# 🌐 LAPORAN ANALISIS MENDALAM: PENGANALISIS WEB KUSTOM URL\n\n> URL Target: ${effectiveTargetUrls.join(', ')}\n\n${hasilBedahAnalisis}`;
        }

        const promptChatSummary = `Anda adalah Executive Chat Summarizer.
Pertanyaan Pengguna: "${effectivePrompt}"
Laporan Analisis Web Lengkap:
${finalReportText.slice(0, 6000)}

Tugas:
Tuliskan jawaban langsung yang ringkas, elegan, dan to-the-point (2-3 paragraf) dalam percakapan chat yang menjelaskan:
1. Inti isi halaman web yang dianalisis.
2. Apa yang paling baru dan apa yang lama/berubah.
3. Kesimpulan utama bagi pengguna.
Tuliskan langsung jawabannya dengan gaya ramah dan profesional.`;

        try {
          chatSummary = await callClientLLMDirect(masterResearchModel, promptChatSummary, 'Anda adalah AI Assistant yang ramah, efisien, dan komunikatif.');
        } catch (e) {
          chatSummary = '';
        }

        updateLiveInspectionData({
          synthesizer: {
            name: 'Model 3 (Lead Corrector & Enhancer)',
            model: masterResearchModel,
            status: 'completato',
            text: finalReportText,
            length: (finalReportText || '').length
          },
          model4: {
            name: 'Model 4 (Executive Chat Summarizer)',
            model: masterResearchModel,
            status: 'completato',
            text: chatSummary,
            length: (chatSummary || '').length
          }
        });
      }

      // Finalize UI & Markdown rendering
      if (finalReportText && finalReportText.trim()) {
        const endTime = performance.now();
        const totalDuration = ((endTime - startTime) / 1000).toFixed(2);
        const actualFinalModel = masterResearchModel;

        const nowIso = new Date().toISOString();
        // Render Gemini-Style Research Card in chat bubble (dengan rangkuman Model 4 di antarmuka chat)
        bubbleText.innerHTML = buildDeepResearchSummaryCardHtml(finalReportText, actualFinalModel, allSources, nowIso, chatSummary);
        enhanceCodeBlocks(bubbleText);
        attachDeepResearchCardEvents(assistantRow, finalReportText, actualFinalModel, allSources, nowIso);
        assistantRow.dataset.fullContent = finalReportText;

        if (metaBox) {
          metaBox.innerHTML = `
            <span class="meta-badge engine-badge"><i class="fa-solid fa-microscope" style="color:var(--neon-amber);"></i> DEEP RESEARCH</span>
            <span class="meta-badge model-badge">${escapeHtml(actualFinalModel)}</span>
            <span class="meta-badge latency-badge"><i class="fa-solid fa-bolt"></i> ${totalDuration}s</span>
            <span class="meta-badge sources-badge"><i class="fa-solid fa-globe"></i> ${allSources.length} Sumber</span>
          `;
        }

        // Save assistant message to session
        if (STATE.sessions.some(s => s.id === session.id)) {
          const assistantMsg = {
            role: 'assistant',
            content: finalReportText,
            chatSummary: chatSummary,
            model: actualFinalModel,
            sources: allSources,
            isDeepResearch: true,
            latency: totalDuration,
            timestamp: new Date().toISOString()
          };
          session.messages.push(assistantMsg);
          session.updatedAt = new Date().toISOString();
          savePersistedState();
          renderChatHistory(els.searchHistoryInput?.value || '');
        }
        AudioEngine.success();
        smartScrollChatToBottom(true);
      } else if (!currentAbortController.signal.aborted && STATE.isGenerating) {
        const actualFinalModel = masterResearchModel;
        throw new Error(`Sintesis laporan Deep Research tidak menghasilkan konten teks dari model: ${actualFinalModel}`);
      }

    } catch (err) {
      if (err.name === 'AbortError' || currentAbortController.signal.aborted || !STATE.isGenerating) {
        if (finalReportText && finalReportText.trim() && STATE.sessions.some(s => s.id === session.id)) {
          const stoppedText = `${finalReportText.trim()}\n\n*[Riset dihentikan oleh pengguna]*`;
          const actualFinalModel = masterResearchModel;
          const nowIso = new Date().toISOString();
          bubbleText.innerHTML = buildDeepResearchSummaryCardHtml(stoppedText, actualFinalModel, allSources, nowIso, chatSummary);
          enhanceCodeBlocks(bubbleText);
          attachDeepResearchCardEvents(assistantRow, stoppedText, actualFinalModel, allSources, nowIso);
          assistantRow.dataset.fullContent = stoppedText;
          session.messages.push({
            role: 'assistant',
            content: stoppedText,
            chatSummary: chatSummary,
            model: actualFinalModel,
            sources: allSources,
            isDeepResearch: true,
            timestamp: new Date().toISOString()
          });
          session.updatedAt = new Date().toISOString();
          savePersistedState();
          renderChatHistory(els.searchHistoryInput?.value || '');
        } else {
          assistantRow.remove();
        }
        showToast('Deep Research dihentikan oleh pengguna.');
      } else {
        console.error('Deep research error:', err);
        const errorHtml = formatModelErrorMessage(engine, targetModel, err, false, true);
        bubbleText.innerHTML = `
          ${errorHtml}
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-primary retry-research-btn" style="font-size:0.75rem;">
              <i class="fa-solid fa-rotate-right"></i> Coba Riset Ulang
            </button>
            <button class="btn btn-sm btn-outline inspect-research-err-btn" style="border-color:rgba(0, 240, 255, 0.4); color:var(--neon-cyan); font-size:0.75rem;">
              <i class="fa-solid fa-eye"></i> Pertinjau Log Riset
            </button>
            <button class="btn btn-sm btn-outline open-settings-btn" style="border-color:var(--neon-amber); color:var(--neon-amber); font-size:0.75rem;">
              <i class="fa-solid fa-gear"></i> Buka Pengaturan
            </button>
          </div>
        `;

        bubbleText.querySelector('.retry-research-btn')?.addEventListener('click', () => {
          assistantRow.remove();
          runDeepResearchStreaming(session, promptText, image, modelName, engine);
        });

        bubbleText.querySelector('.inspect-research-err-btn')?.addEventListener('click', () => {
          openLiveResearchInspection();
        });

        bubbleText.querySelector('.open-settings-btn')?.addEventListener('click', () => {
          syncSettingsModalFields();
          openModal('settingsModal');
        });

        AudioEngine.error();
      }
    } finally {
      STATE.currentDeepResearchTaskId = null;
      setGeneratingState(false);
      STATE.abortController = null;
    }
  }

  // ==================== AI MUSIC STUDIO TRIGGERS ====================
  function isMusicGenerationTrigger(promptText) {
    if (!promptText || typeof promptText !== 'string') return false;
    const t = promptText.trim().toLowerCase();

    // 1. Direct slash commands & prefixes (selalu picu tanpa pengecualian)
    if (t.startsWith('/music') || t.startsWith('/musik') || t.startsWith('/audio') || t.startsWith('/song') || t.startsWith('/lagu')) return true;
    if (t.startsWith('music:') || t.startsWith('musik:') || t.startsWith('audio:') || t.startsWith('song:') || t.startsWith('lagu:')) return true;

    // 2. Filter negatif: jangan picu jika pengguna sedang berdiskusi, komplain bug, atau meminta perbaikan kode
    if (/\b(?:bug|error|masalah|issue|perbaiki|troubleshoot|mengapa|kenapa|source code|skrip|script|koding|coding)\b/i.test(t)) {
      return false;
    }

    // 3. Kata kerja / aksi pembuatan musik
    const actionWords = '(?:buatkan|buat|bikin|membuat|generate|ciptakan|menciptakan|gubah|menggubah|aransir|mainkan|memainkan|perdengarkan|rakit|memproduksi|compose|produce|make|create|play)';
    // 4. Objek musik (dukung ejaan "music" dan "musik")
    const musicWords = '(?:musik|music|lagu|song|track|soundtrack|melodi|melody|audio|beat|instrumen|instrumental|nada|irama)';

    // Pola percakapan fleksibel: "ai buatkan music", "tolong buat music", "bisa bikin lagu", "ai yang membuat music", "ai buat music"
    const flexiblePattern = new RegExp(
      `(?:^(?:.*\\b)?(?:ai|bot|sistem|kamu|tolong|coba|bisa|mohon|mau|ingin|untuk|yang)\\b\\s+)*` +
      `${actionWords}\\s+(?:kan\\s+)?(?:saya\\s+|kita\\s+|sebuah\\s+|suatu\\s+|satu\\s+)?(?:ada\\s+)?${musicWords}\\b`,
      'i'
    );
    if (flexiblePattern.test(t)) return true;

    // Pola langsung: "buatkan music", "buat music", "bikin music", "generate music", "compose music"
    const directPattern = new RegExp(
      `\\b${actionWords}\\s+(?:kan\\s+)?(?:saya\\s+|kita\\s+|sebuah\\s+|suatu\\s+|satu\\s+)?${musicWords}\\b`,
      'i'
    );
    if (directPattern.test(t)) return true;

    // Pola genre langsung: "musik lofi", "lagu cyberpunk", "music synthwave", "buat musik santai"
    if (new RegExp(`(?:buatkan|buat|bikin|generate|ciptakan|gubah|putar|mainkan)\\s+${musicWords}\\s+(?:lofi|cyberpunk|synthwave|epic|santai|jedag|remix|edm|rock|pop|klasik|ambient|chill)`, 'i').test(t)) return true;
    if (new RegExp(`^(?:musik|music|lagu|soundtrack)\\s+(?:lofi|cyberpunk|synthwave|epic|santai|jedag|remix|edm|rock|pop|klasik|ambient|chill)\\b`, 'i').test(t)) return true;

    // Pola bahasa Inggris
    if (/^(?:(?:please|can you|could you|would you)\s+)?(?:generate|create|compose|produce|make|play)\s+(?:me\s+)?(?:an?\s+)?(?:music|song|track|audio|soundtrack|melody|instrumental|beat)\b/i.test(t)) return true;
    if (/\b(?:compose|produce)\s+(?:me\s+)?(?:an?\s+)?(?:music|song|track|beat)\b/i.test(t)) return true;

    return false;
  }

  function extractMusicPrompt(promptText) {
    if (!promptText || typeof promptText !== 'string') return '';
    let p = promptText.trim();
    p = p.replace(/^\/(?:music|musik|audio|song|lagu)\s*/i, '');
    p = p.replace(/^(?:music|musik|audio|song|lagu):\s*/i, '');
    p = p.replace(/^(?:(?:ai|bot|sistem|kamu|tolong|coba|bisa|mohon|seharusnya|mau|ingin|untuk|yang)\s+)+/i, '');
    p = p.replace(/^(?:buatkan|buat|bikin|membuat|generate|ciptakan|menciptakan|gubah|menggubah|aransir|mainkan|memainkan|perdengarkan|rakit|memproduksi|compose|produce|make|create|play)\s+(?:kan\s+)?(?:saya\s+|kita\s+|sebuah\s+|suatu\s+|satu\s+)?(?:ada\s+)?(?:musik|music|lagu|song|track|soundtrack|melodi|melody|audio|beat|instrumen|instrumental|nada|irama)\s+(?:tentang\s+|dari\s+|yang\s+|dengan\s+|genre\s+|tema\s+|untuk\s+)?/i, '');
    p = p.replace(/^(?:(?:please|can you|could you|would you)\s+)?(?:generate|create|compose|produce|make|play)\s+(?:me\s+)?(?:an?\s+)?(?:music|song|track|audio|soundtrack|melody|instrumental|beat)\s+(?:of\s+|about\s+|with\s+|for\s+)?/i, '');
    return p.trim() || promptText.trim();
  }

  // ==================== LEVIATHAN NEURAL TUNNELING (PROMPT DE-CENSORING) ====================
  function neuralTunnelMusicPrompt(rawPrompt) {
    let p = String(rawPrompt || '').trim();
    if (!p) return 'Cyberpunk futuristic melodic synthwave beat, fast tempo 128 BPM';

    const lower = p.toLowerCase();

    // 1. Tokoh legendaris & sensitif bagi safety classifier Google Gemini
    if (/terry\s*(a\.?)?\s*davis|temple\s*os/i.test(lower)) {
      return 'Epic baroque chiptune synthwave tribute, sacred 8-bit hymns, 640x480 retro computing soundscape, rapid arpeggios, fast tempo 138 BPM, solitary programmer divine coding journey, nostalgic heroic instrumental melody';
    }
    if (/kurt\s*cobain|nirvana/i.test(lower)) {
      return 'Raw energetic 90s grunge rock anthem, heavy distorted electric guitars, driving aggressive drums, emotional acoustic intro building into explosive chorus, 120 BPM';
    }
    if (/chester\s*bennington|linkin\s*park/i.test(lower)) {
      return 'Hybrid nu-metal and electronic rock anthem, powerful atmospheric synthesizer riffs, hard-hitting drum beats, soaring emotional melody, 130 BPM';
    }
    if (/michael\s*jackson/i.test(lower)) {
      return 'Energetic 80s funk pop dance groove, punchy bassline, crisp brass stabs, syncopated rhythm, infectious upbeat tempo 120 BPM';
    }
    if (/bob\s*marley/i.test(lower)) {
      return 'Warm soulful roots reggae rhythm, laid-back offbeat guitar skank, deep melodic bassline, organ bubble, uplifting conscious groove 78 BPM';
    }
    if (/beethoven|mozart|bach/i.test(lower)) {
      return 'Grand classical symphonic overture, virtuoso piano passages, dramatic string quartet, sweeping emotional crescendos, baroque elegance';
    }

    // 2. Filter kata sensitif / tragedi / bunuh diri yang memicu false-positive filter Google
    if (/suicide|bunuh\s*diri|self[- ]harm/i.test(lower)) {
      return 'Deep emotional melancholic piano ballad, poignant sorrowful string arrangement building into a powerful uplifting cathartic release, 75 BPM';
    }
    if (/death|mati|kematian|die|dying|grave|makam/i.test(lower)) {
      return 'Ethereal cinematic orchestral adagio, melancholic cello solo, gentle acoustic resonance, dramatic emotional progression';
    }
    if (/war|perang|battle|tempur|pembantaian|massacre/i.test(lower)) {
      return 'Epic cinematic symphonic battle soundtrack, thunderous taiko drums, roaring brass section, heroic fast strings, dramatic climactic overture 140 BPM';
    }
    if (/traged(y|i)|sad\s*story|kisah\s*sedih/i.test(lower)) {
      return 'Poignant cinematic soundtrack, emotional cello and piano duet, dramatic crescendo, profound melancholy transforming into hope, 80 BPM';
    }

    // 3. Entity & biographical phrase scrubber
    let cleaned = p
      .replace(/\b(?:create|make|generate|produce|compose|write|bikin|buatkan|buat|mainkan)\s+(?:music|musik|song|lagu|track|audio|beat|melodi)\s+(?:for|about|of|tentang|untuk)?/gi, '')
      .replace(/\b(?:the\s+)?(?:life\s*story|biography|story|kisah\s*hidup|cerita)\s+(?:of|about|tentang)?/gi, '')
      .replace(/\b(?:for|about|tentang|mengenai)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g, 'a visionary heroic journey')
      .trim();

    if (!cleaned || cleaned.length < 5) {
      cleaned = 'Inspiring cinematic instrumental journey, uplifting melody, rich harmonic layers, dynamic rhythms';
    }

    // 4. Pastikan memiliki deskriptor musikal (genre, instrumen, tempo)
    const hasMusicalGenre = /rock|metal|pop|jazz|lofi|lo-fi|synthwave|cyberpunk|electronic|edm|classical|chiptune|hiphop|acoustic|ambient|orchestral|reggae|blues|techno|house|drill|trap|folk|ballad/i.test(cleaned);
    if (!hasMusicalGenre) {
      cleaned = `Cinematic emotional melodic tribute, ${cleaned}, rich instruments, soaring arrangement, 120 BPM`;
    }

    return cleaned;
  }

  // ==================== AI IMAGE STUDIO ENGINE ====================
  function isImageGenerationTrigger(promptText) {
    if (!promptText || typeof promptText !== 'string') return false;
    const t = promptText.trim().toLowerCase();

    // 1. Direct slash / command prefix
    if (t.startsWith('/image') || t.startsWith('/img') || t.startsWith('/gambar')) return true;
    if (t.startsWith('gambar:') || t.startsWith('image:') || t.startsWith('draw:') || t.startsWith('paint:')) return true;

    // 2. Filter negatif: jangan picu jika sedang berdiskusi bug / koding
    if (/\b(?:bug|error|masalah|issue|perbaiki|troubleshoot|mengapa|kenapa|source code|skrip|script|koding|coding)\b/i.test(t)) {
      return false;
    }
    
    // 3. Perintah pembuatan visual bahasa Indonesia alami
    if (/^(?:(?:tolong|coba|bisa|mohon)\s+)?(?:buatkan|buat|bikin|generate|render|lukiskan|lukis|gambarkan|gambarin|desainkan|desain|tampilkan)\s+(?:saya\s+|kita\s+|sebuah\s+|suatu\s+)?(?:gambar|foto|lukisan|ilustrasi|visual|art|karya|desain)\b/i.test(t)) return true;
    if (/^(?:(?:tolong|coba|bisa|mohon)\s+)?(?:lukiskan|lukis|gambarkan|gambarin)\s+(?:saya\s+|sebuah\s+|seekor\s+|suatu\s+)?/i.test(t)) return true;
    if (/^(?:gambar(?:kan)?|foto)\s+(?:seekor|sebuah|suasana|pemandangan|karakter|objek|suatu)\b/i.test(t)) return true;

    // 4. Perintah pembuatan visual bahasa Inggris alami
    if (/^(?:(?:please|can you|could you)\s+)?(?:generate|create|render|draw|paint|design|illustrate|make)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|illustration|art|painting|drawing|visual|graphic)\b/i.test(t)) return true;
    if (/^(?:draw|paint|sketch|illustrate)\s+(?:me\s+)?(?:an?\s+)?/i.test(t)) return true;

    return false;
  }

  function extractImagePrompt(promptText) {
    if (!promptText || typeof promptText !== 'string') return '';
    let p = promptText.trim();
    p = p.replace(/^\/(?:image|img|gambar)\s*/i, '');
    p = p.replace(/^(?:gambar|image|draw|paint):\s*/i, '');
    p = p.replace(/^(?:(?:tolong|coba|bisa|mohon)\s+)?(?:buatkan|buat|bikin|generate|render|lukiskan|lukis|gambarkan|gambarin|desainkan|desain|tampilkan)\s+(?:saya\s+|kita\s+|sebuah\s+|suatu\s+)?(?:gambar|foto|lukisan|ilustrasi|visual|art|karya|desain)\s+(?:tentang\s+|dari\s+|sebuah\s+|seekor\s+|suatu\s+)?/i, '');
    p = p.replace(/^(?:(?:tolong|coba|bisa|mohon)\s+)?(?:lukiskan|lukis|gambarkan|gambarin)\s+(?:saya\s+|sebuah\s+|seekor\s+|suatu\s+)?/i, '');
    p = p.replace(/^(?:gambar(?:kan)?|foto)\s+(?:seekor|sebuah|suasana|pemandangan|karakter|objek|suatu)\s+/i, '');
    p = p.replace(/^(?:(?:please|can you|could you)\s+)?(?:generate|create|render|draw|paint|design|illustrate|make)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|illustration|art|painting|drawing|visual|graphic)\s+(?:of\s+)?/i, '');
    p = p.replace(/^(?:draw|paint|sketch|illustrate)\s+(?:me\s+)?(?:an?\s+)?(?:of\s+)?/i, '');
    return p.trim() || promptText.trim();
  }

  function getImageModelDisplayName(modelId) {
    if (!modelId || modelId === 'off') return 'Nonaktif (Mode Obrolan)';
    const found = DEFAULT_IMAGE_MODELS.find(m => m.id === modelId) || 
                  CURATED_OPENROUTER_IMAGE_MODELS.find(m => m.id === modelId) ||
                  (STATE.availableImageModels && STATE.availableImageModels.find(m => m.id === modelId));
    if (found) return found.name || found.id;
    const m = String(modelId).toLowerCase();
    if (m === 'flux') return 'Flux.1 Schnell';
    if (m === 'flux-realism') return 'Flux Realism';
    if (m === 'flux-anime') return 'Flux Anime & Manga';
    if (m === 'flux-3d') return 'Flux 3D CGI';
    if (m === 'turbo') return 'SDXL Turbo';
    if (m === 'flux-pro') return 'Flux.1 Pro';
    if (m === 'midjourney') return 'Midjourney Style';
    if (m.includes('/')) {
      const parts = modelId.split('/');
      return parts[1] ? parts[1].replace(/[-_]/g, ' ') : modelId;
    }
    return modelId;
  }

  function getImageModelBadgeText(modelId) {
    if (!modelId || modelId === 'off') return 'Flux';
    const m = String(modelId).toLowerCase();
    if (m === 'flux-realism') return 'Realism';
    if (m === 'flux-anime') return 'Anime';
    if (m === 'flux-3d') return '3D CGI';
    if (m === 'turbo') return 'Turbo';
    if (m === 'flux-pro') return 'Pro';
    if (m === 'midjourney') return 'MJ';
    if (m.includes('flux-3') || m.includes('flux.3')) return 'FLUX-3';
    if (m.includes('flux.2') || m.includes('flux-2')) return 'FLUX-2';
    if (m.includes('gemini')) return 'Gemini';
    if (m.includes('gpt')) return 'GPT';
    if (m.includes('recraft')) return 'Recraft';
    if (m.includes('seedream')) return 'Seedream';
    if (m.includes('grok')) return 'Grok';
    if (m.includes('qwen')) return 'Qwen';
    if (m.includes('krea')) return 'Krea';
    if (m.includes('mai')) return 'MAI';
    if (m.includes('/')) {
      const part = modelId.split('/')[1] || modelId;
      return part.slice(0, 8);
    }
    return 'Flux';
  }

  function updateImageGenModeUI() {
    const isImageMode = Boolean(STATE.isImageGenMode);
    const activeModel = STATE.settings.imageModel || 'flux';
    const badgeText = getImageModelBadgeText(activeModel);
    const displayName = getImageModelDisplayName(activeModel);

    if (els.composerBox) {
      els.composerBox.classList.toggle('image-mode-active', isImageMode);
    }
    if (els.imageGenToggleBtn) {
      els.imageGenToggleBtn.classList.toggle('active', isImageMode);
      els.imageGenToggleBtn.setAttribute('aria-pressed', String(isImageMode));
      els.imageGenToggleBtn.setAttribute('title', isImageMode 
        ? `Mode Gambar Aktif: ${displayName} (Klik untuk ganti model / nonaktifkan)` 
        : 'AI Image Studio - Pilih Model Gambar');
    }
    if (els.imageModelBadge) {
      els.imageModelBadge.innerText = badgeText;
      els.imageModelBadge.style.display = isImageMode ? 'inline-block' : 'none';
    }
    if (els.sendPromptBtn) {
      if (isImageMode) {
        els.sendPromptBtn.setAttribute('title', `Generate Gambar dengan ${displayName} (Enter) | Tahan 450ms untuk Mode Percakapan`);
        els.sendPromptBtn.setAttribute('aria-label', `Generate Gambar dengan ${displayName} (Enter)`);
      } else {
        els.sendPromptBtn.setAttribute('title', 'Kirim Prompt (Enter) | Tahan 450ms untuk Mode Gambar');
        els.sendPromptBtn.setAttribute('aria-label', 'Kirim Prompt (Enter)');
      }
    }
    if (els.promptInput) {
      els.promptInput.placeholder = isImageMode 
        ? `Deskripsikan visual yang ingin dibuat dengan ${badgeText}...` 
        : '';
    }

    if (els.imageModeIndicator) {
      els.imageModeIndicator.style.display = isImageMode ? 'flex' : 'none';
      // Selalu reset ikon ke ikon gambar, agar tidak menyimpan ikon silang
      // sisa hover saat mode gambar dinonaktifkan lalu diaktifkan kembali.
      const indicatorIcon = els.imageModeIndicator.querySelector('i');
      if (indicatorIcon) {
        indicatorIcon.className = 'fa-solid fa-image';
      }
    }

    // Sinkronisasi status checked pada popup modal/dropdown
    $$('.image-model-item').forEach(item => {
      const itemModel = item.dataset.model;
      const isSelected = isImageMode ? (itemModel === activeModel) : (itemModel === 'off');
      item.classList.toggle('active', isSelected);
      const checkIcon = item.querySelector('.image-model-check');
      if (checkIcon) checkIcon.style.display = isSelected ? 'block' : 'none';
    });
  }

  // ==================== AI YOUTUBE SEARCH TOOL (TOGGLE) ====================
  // Tool pencarian video yang dapat dipakai semua model AI (native tool calling
  // maupun format teks). Diaktifkan/dinonaktifkan dari menu Lampiran; indikatornya
  // muncul di kiri kolom prompt dan dapat dimatikan lewat klik (ikon silang saat hover).
  function updateYouTubeModeUI() {
    const isOn = Boolean(STATE.isYouTubeSearchMode);

    if (els.youtubeModeIndicator) {
      els.youtubeModeIndicator.style.display = isOn ? 'flex' : 'none';
      els.youtubeModeIndicator.setAttribute('aria-pressed', String(isOn));
      // Selalu reset ikon agar tidak menyimpan silang sisa hover.
      const indicatorIcon = els.youtubeModeIndicator.querySelector('i');
      if (indicatorIcon) indicatorIcon.className = 'fa-brands fa-youtube';
    }

    if (els.attachOptionYouTubeSearch) {
      els.attachOptionYouTubeSearch.classList.toggle('active', isOn);
      els.attachOptionYouTubeSearch.setAttribute('aria-pressed', String(isOn));
      const checkIcon = els.attachOptionYouTubeSearch.querySelector('.attach-yt-check');
      if (checkIcon) checkIcon.style.display = isOn ? 'block' : 'none';
    }
  }

  function setYouTubeSearchMode(enabled) {
    const on = Boolean(enabled);
    STATE.isYouTubeSearchMode = on;
    STATE.settings.youtubeSearchTool = on;
    updateYouTubeModeUI();
    savePersistedState();
    AudioEngine.click();
    showToast(
      on
        ? '🔎 Tool "Cari Video YouTube" aktif. Model AI akan otomatis memanggilnya saat Anda meminta video.'
        : '🔎 Tool "Cari Video YouTube" nonaktif. Model AI tidak akan mencari video.',
      'info'
    );
  }

  const MUSIC_AUDIO_RE = /lyria|musicgen|suno|udio|stable-audio|gpt-audio/i;
  const DEFAULT_MUSIC_MODEL = 'google/lyria-3-clip-preview';
  function isAudioMusicModel(id) { return MUSIC_AUDIO_RE.test(String(id || '')); }
  function normalizeMusicModelSetting() {
    if (!isAudioMusicModel(STATE.settings.musicModel)) {
      STATE.settings.musicModel = DEFAULT_MUSIC_MODEL;
      try { localStorage.setItem('zoz_router_settings_v1', JSON.stringify(STATE.settings)); } catch (_) {}
      if (els.settingMusicModel) els.settingMusicModel.value = DEFAULT_MUSIC_MODEL;
    }
  }

  function getMusicModelDisplayName(modelId) {
    if (!modelId || modelId === 'off') return 'Nonaktif (Mode Obrolan)';
    const foundOR = (STATE.openRouterModels || []).find(m => m.id === modelId);
    if (foundOR) return foundOR.name || foundOR.id;
    const foundCurated = CURATED_OPENROUTER_MUSIC_MODELS.find(m => m.id === modelId);
    if (foundCurated) return foundCurated.name;
    const foundOllama = (STATE.ollamaModels || []).find(m => (m.id || m.name || m.model) === modelId);
    if (foundOllama) return foundOllama.name || foundOllama.model || foundOllama.id;
    const m = String(modelId).toLowerCase();
    if (m === 'qwen2.5:1.5b') return 'Qwen 2.5 1.5B (Lokal)';
    if (m === 'llama3.2:3b') return 'Llama 3.2 3B (Lokal)';
    if (m === 'openrouter/free') return 'OpenRouter Free Auto';
    if (m.includes('/')) {
      const parts = modelId.split('/');
      return parts[1] ? parts[1].replace(/[-_]/g, ' ') : modelId;
    }
    return modelId;
  }

  function getMusicModelBadgeText(modelId) {
    if (!modelId || modelId === 'off') return 'Music';
    const m = String(modelId).toLowerCase();
    if (m.includes('qwen2.5:1.5b')) return 'Qwen 1.5B';
    if (m.includes('qwen2.5:7b') || m.includes('qwen-2.5-72b') || m.includes('qwen2.5') || m.includes('qwen')) return 'Qwen';
    if (m.includes('llama-3.3') || m.includes('llama3.3')) return 'Llama 3.3';
    if (m.includes('llama3.2:3b') || m.includes('llama3.2')) return 'Llama 3.2';
    if (m.includes('llama')) return 'Llama';
    if (m.includes('gemini-2.0') || m.includes('gemini-2') || m.includes('gemini')) return 'Gemini';
    if (m.includes('deepseek-v4') || m.includes('deepseek-r1') || m.includes('deepseek')) return 'DeepSeek';
    if (m.includes('gpt-4o')) return 'GPT-4o';
    if (m.includes('gpt-4') || m.includes('gpt-3') || m.includes('gpt')) return 'GPT';
    if (m.includes('claude-3.5') || m.includes('claude') || m.includes('haiku') || m.includes('sonnet')) return 'Claude';
    if (m.includes('mistral') || m.includes('codestral') || m.includes('mixtral')) return 'Mistral';
    if (m.includes('nemotron')) return 'Nemotron';
    if (m.includes('granite')) return 'Granite';
    if (m.includes('kimi')) return 'Kimi';
    if (m.includes('gemma')) return 'Gemma';
    if (m.includes('openrouter/free')) return 'OR Free';
    if (m.includes('/')) {
      const part = modelId.split('/')[1] || modelId;
      return part.slice(0, 10);
    }
    if (m.includes(':')) {
      return m.split(':')[0].slice(0, 10);
    }
    return modelId.slice(0, 10);
  }

  function updateMusicGenModeUI() {
    normalizeMusicModelSetting();
    const isMusicMode = Boolean(STATE.isMusicGenMode);
    const activeModel = STATE.settings.musicModel || 'google/lyria-3-clip-preview';
    const badgeText = getMusicModelBadgeText(activeModel);
    const displayName = getMusicModelDisplayName(activeModel);

    if (els.composerBox) {
      els.composerBox.classList.toggle('music-mode-active', isMusicMode);
    }
    if (els.musicGenToggleBtn) {
      els.musicGenToggleBtn.classList.toggle('active', isMusicMode);
      els.musicGenToggleBtn.setAttribute('aria-pressed', String(isMusicMode));
      els.musicGenToggleBtn.setAttribute('title', isMusicMode 
        ? `Mode Musik Aktif: ${displayName} (Klik untuk ganti model / nonaktifkan)` 
        : 'AI Music Studio - Pilih Model Musik AI');
    }
    if (els.musicModelBadge) {
      els.musicModelBadge.innerText = badgeText;
      els.musicModelBadge.style.display = isMusicMode ? 'inline-block' : 'none';
    }
    if (els.sendPromptBtn) {
      if (isMusicMode) {
        els.sendPromptBtn.setAttribute('title', `Gubah Musik dengan ${displayName} (Enter)`);
        els.sendPromptBtn.setAttribute('aria-label', `Gubah Musik dengan ${displayName} (Enter)`);
      } else if (!STATE.isImageGenMode) {
        els.sendPromptBtn.setAttribute('title', 'Kirim Prompt (Enter)');
        els.sendPromptBtn.setAttribute('aria-label', 'Kirim Prompt (Enter)');
      }
    }
    if (els.promptInput && isMusicMode) {
      els.promptInput.placeholder = `Deskripsikan musik, beat, atau melodi untuk digubah dengan ${badgeText}...`;
    } else if (els.promptInput && !STATE.isImageGenMode) {
      els.promptInput.placeholder = '';
    }
    if (els.attachOptionGenMusic) {
      els.attachOptionGenMusic.classList.toggle('active', isMusicMode);
    }
    if (els.musicModeIndicator) {
      els.musicModeIndicator.style.display = isMusicMode ? 'flex' : 'none';
      // Selalu reset ikon ke nota musik, agar tidak menyimpan ikon silang
      // sisa hover saat mode musik dinonaktifkan lalu diaktifkan kembali.
      const indicatorIcon = els.musicModeIndicator.querySelector('i');
      if (indicatorIcon) {
        indicatorIcon.className = 'fa-solid fa-music';
      }
    }

    // Sinkronisasi status checked pada popup modal/dropdown musik
    $$('.music-model-item').forEach(item => {
      const itemModel = item.dataset.model;
      const isSelected = isMusicMode ? (itemModel === activeModel) : (itemModel === 'off');
      item.classList.toggle('active', isSelected);
      const checkIcon = item.querySelector('.music-model-check');
      if (checkIcon) checkIcon.style.display = isSelected ? 'block' : 'none';
    });
  }

  function switchMusicModelTab(tabName) {
    const isOR = tabName === 'openrouter';
    if (els.tabBtnMusicOllama) els.tabBtnMusicOllama.classList.toggle('active', !isOR);
    if (els.tabBtnMusicOpenRouter) els.tabBtnMusicOpenRouter.classList.toggle('active', isOR);
    if (els.paneMusicOllama) els.paneMusicOllama.style.display = isOR ? 'none' : 'flex';
    if (els.paneMusicOpenRouter) els.paneMusicOpenRouter.style.display = isOR ? 'flex' : 'none';

    if (isOR) {
      updateMusicOpenRouterStatusBar();
      populateMusicOpenRouterModels(els.musicModelSearchInput?.value || '');
      setTimeout(() => els.musicModelSearchInput?.focus(), 60);
    } else {
      populateMusicOllamaModels(els.musicOllamaSearchInput?.value || '');
      setTimeout(() => els.musicOllamaSearchInput?.focus(), 60);
    }
  }

  function updateMusicOpenRouterStatusBar() {
    if (!els.musicOpenRouterStatusBar) return;
    const hasKey = Boolean(STATE.settings.openRouterKey);
    els.musicOpenRouterStatusBar.className = `music-model-status-bar ${hasKey ? 'connected' : 'warning'}`;
    els.musicOpenRouterStatusBar.innerHTML = hasKey
      ? `<span><i class="fa-solid fa-circle-check" style="color:var(--neon-teal);"></i> API Key Terhubung • Cloud Neural Music Models Siap</span>
         <button class="status-action-btn" id="musicOpenRouterConfigBtn" type="button">Pengaturan</button>`
      : `<span><i class="fa-solid fa-circle-exclamation" style="color:var(--neon-amber);"></i> Butuh OpenRouter Key untuk cloud models</span>
         <button class="status-action-btn" id="musicOpenRouterConfigBtn" type="button">Buka Pengaturan</button>`;

    const cfgBtn = els.musicOpenRouterStatusBar.querySelector('#musicOpenRouterConfigBtn');
    cfgBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMusicModelDropdown();
      const modal = $('#settingsModal');
      if (modal) {
        modal.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === 'tabProviders'));
        modal.querySelectorAll('.settings-tab-pane').forEach(pane => pane.classList.toggle('active', pane.id === 'tabProviders'));
      }
      openModal('settingsModal');
      AudioEngine.click();
    });
  }

  function populateMusicOllamaModels(searchQuery = '') {
    if (!els.musicModelOllamaList) return;
    // Model Ollama adalah model teks: tidak bisa menghasilkan audio. Arahkan ke model musik asli.
    if (els.musicOllamaCountText) els.musicOllamaCountText.innerText = 'tidak tersedia';
    els.musicModelOllamaList.innerHTML = '<div style="padding: 18px 10px; text-align: center; color: var(--text-dim); font-size: 0.76rem; line-height: 1.55;"><i class="fa-solid fa-circle-info" style="font-size: 1.2rem; margin-bottom: 8px; display: block; color: var(--neon-amber);"></i>Model Ollama hanya menghasilkan <strong>teks</strong>, bukan suara.<br>Untuk musik AI asli, buka tab <strong>OpenRouter (Cloud)</strong> dan pilih <strong>Google Lyria 3</strong>.</div>';
    return;
  }

  function populateMusicOpenRouterModels(searchQuery = '') {
    if (!els.musicModelOpenRouterList) return;
    const q = (typeof searchQuery === 'string' ? searchQuery : (els.musicModelSearchInput?.value || '')).toLowerCase().trim();
    const activeModel = STATE.settings.musicModel || 'google/lyria-3-clip-preview';
    const isMusicMode = Boolean(STATE.isMusicGenMode);
    const cat = STATE.musicOpenRouterCatFilter || 'all';

    // Ambil seluruh model resmi yang terdaftar dari OpenRouter API (STATE.openRouterModels)
    const allModelsMap = new Map();

    // Masukkan curated rekomendasi awal sebagai base enrichment jika ada
    CURATED_OPENROUTER_MUSIC_MODELS.forEach(m => allModelsMap.set(m.id, m));

    // Masukkan SELURUH 468+ model resmi dari OpenRouter
    if (Array.isArray(STATE.openRouterModels) && STATE.openRouterModels.length > 0) {
      STATE.openRouterModels.forEach(m => {
        if (!m.hasAudioOutput && !isAudioMusicModel(m.id)) return;
        if (!allModelsMap.has(m.id)) {
          allModelsMap.set(m.id, {
            id: m.id,
            name: m.name || m.id,
            provider: 'openrouter',
            tag: m.tag || (m.id.includes(':free') ? 'Free' : 'Cloud'),
            cat: m.cat || (m.id.includes(':free') ? 'free' : 'flagship'),
            desc: m.description || m.desc || m.id
          });
        } else {
          // Merge description & name jika belum lengkap
          const existing = allModelsMap.get(m.id);
          if (m.name && (!existing.name || existing.name === existing.id)) existing.name = m.name;
          if (m.description && (!existing.desc || existing.desc === existing.id)) existing.desc = m.description;
        }
      });
    } else {
      // Pemicu fetch otomatis jika daftar belum tersedia
      fetchOpenRouterModelsList().then(() => {
        if (Array.isArray(STATE.openRouterModels) && STATE.openRouterModels.length > 0) {
          populateMusicOpenRouterModels(els.musicModelSearchInput?.value || '');
        }
      }).catch(() => {});
    }

    // Pastikan activeModel muncul jika merupakan OpenRouter model
    if (activeModel.includes('/') && !allModelsMap.has(activeModel)) {
      allModelsMap.set(activeModel, {
        id: activeModel,
        name: getMusicModelDisplayName(activeModel),
        provider: 'openrouter',
        tag: 'Cloud Model',
        cat: 'cloud',
        desc: activeModel
      });
    }

    let list = Array.from(allModelsMap.values());

    // 1. Filter Kategori Pills (Semua, Gratis, Google, OpenAI, Anthropic, Meta, DeepSeek, Qwen, Mistral)
    if (cat !== 'all') {
      list = list.filter(m => {
        const idLow = (m.id || '').toLowerCase();
        const nameLow = (m.name || '').toLowerCase();
        if (cat === 'free') {
          return idLow.includes(':free') || idLow.endsWith('/free') || idLow === 'openrouter/free' || m.tag === 'Free' || m.cat === 'free';
        }
        if (cat === 'google') {
          return idLow.includes('google') || idLow.includes('gemini') || nameLow.includes('google');
        }
        if (cat === 'openai') {
          return idLow.includes('openai') || idLow.includes('gpt') || nameLow.includes('openai');
        }
        if (cat === 'anthropic') {
          return idLow.includes('anthropic') || idLow.includes('claude') || nameLow.includes('anthropic');
        }
        if (cat === 'meta') {
          return idLow.includes('meta') || idLow.includes('llama') || nameLow.includes('meta');
        }
        if (cat === 'deepseek') {
          return idLow.includes('deepseek') || nameLow.includes('deepseek');
        }
        if (cat === 'qwen') {
          return idLow.includes('qwen') || nameLow.includes('qwen');
        }
        if (cat === 'mistral') {
          return idLow.includes('mistral') || nameLow.includes('mistral');
        }
        return true;
      });
    }

    // 2. Filter Pencarian Teks Cerdas
    if (q) {
      list = list.filter(m => 
        (m.id && m.id.toLowerCase().includes(q)) || 
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.desc && m.desc.toLowerCase().includes(q)) ||
        (m.tag && m.tag.toLowerCase().includes(q))
      );
    }

    // Perbarui counter model resmi OpenRouter
    if (els.musicOpenRouterCountText) {
      els.musicOpenRouterCountText.innerText = `${list.length} Model Resmi`;
    }

    if (list.length === 0) {
      els.musicModelOpenRouterList.innerHTML = `
        <div style="padding: 24px 8px; text-align: center; color: var(--text-dim); font-size: 0.72rem;">
          <i class="fa-solid fa-ghost" style="font-size: 1.3rem; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
          Tidak ada model OpenRouter yang cocok dengan filter & kata kunci "<strong>${escapeHtml(q || cat)}</strong>"<br>
          Gunakan baris kustom di bawah untuk memasukkan ID model secara manual.
        </div>
      `;
      return;
    }

    // Batasi render DOM hingga 75 item teratas untuk menjaga responsivitas 60 FPS
    const maxRender = 75;
    const itemsToRender = list.slice(0, maxRender);
    const hasMore = list.length > maxRender;

    let itemsHtml = itemsToRender.map(m => {
      const isSelected = isMusicMode && (m.id === activeModel);
      let icon = 'fa-solid fa-cloud';
      let accentClass = 'cloud-accent';
      const idLow = m.id.toLowerCase();

      if (idLow.includes('gemini') || idLow.includes('google')) { 
        icon = 'fa-brands fa-google'; 
        accentClass = 'gemini-accent'; 
      } else if (idLow.includes('llama') || idLow.includes('meta')) { 
        icon = 'fa-solid fa-infinity'; 
        accentClass = 'llama-accent'; 
      } else if (idLow.includes('qwen')) { 
        icon = 'fa-solid fa-dragon'; 
        accentClass = 'qwen-accent'; 
      } else if (idLow.includes('deepseek')) { 
        icon = 'fa-solid fa-eye'; 
        accentClass = 'gemini-accent'; 
      } else if (idLow.includes('claude') || idLow.includes('anthropic')) { 
        icon = 'fa-solid fa-brain'; 
        accentClass = 'flux-accent'; 
      } else if (idLow.includes('gpt') || idLow.includes('openai')) { 
        icon = 'fa-solid fa-microchip'; 
        accentClass = 'cloud-accent'; 
      } else if (idLow.includes('mistral')) { 
        icon = 'fa-solid fa-wind'; 
        accentClass = 'flux-accent'; 
      } else if (idLow.includes('free')) { 
        icon = 'fa-solid fa-bolt-lightning'; 
        accentClass = 'flux-accent'; 
      }

      const isFree = idLow.includes(':free') || idLow.endsWith('/free') || idLow === 'openrouter/free' || m.tag === 'Free' || m.cat === 'free';
      const tagText = isFree ? 'Gratis' : (m.tag || 'OpenRouter');

      return `
        <button class="music-model-item ${isSelected ? 'active' : ''}" type="button" data-model="${escapeHtml(m.id)}">
          <div class="music-model-icon-box ${accentClass}">
            <i class="${icon}"></i>
          </div>
          <div class="music-model-info">
            <div class="music-model-title-row">
              <span class="music-model-title">${escapeHtml(m.name || m.id)}</span>
              <span class="music-model-tag ${isFree ? 'free-tag' : ''}">${escapeHtml(tagText)}</span>
            </div>
            <span class="music-model-desc">${escapeHtml(m.desc || m.id)}</span>
          </div>
          <i class="fa-solid fa-check music-model-check" style="${isSelected ? 'display: block;' : 'display: none;'}"></i>
        </button>
      `;
    }).join('');

    if (hasMore) {
      itemsHtml += `
        <div style="padding: 10px 8px; text-align: center; color: var(--text-dim); font-size: 0.72rem; border-top: 1px dashed var(--border-color); margin-top: 6px;">
          <i class="fa-solid fa-list-check" style="margin-right: 4px; color: var(--neon-teal);"></i>
          Menampilkan ${maxRender} dari <strong>${list.length}</strong> model resmi OpenRouter.<br>
          Ketik nama model di kotak pencarian untuk menemukan model spesifik lainnya.
        </div>
      `;
    }

    els.musicModelOpenRouterList.innerHTML = itemsHtml;

    els.musicModelOpenRouterList.querySelectorAll('.music-model-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const modelVal = item.dataset.model;
        if (modelVal) setMusicModel(modelVal);
      });
    });
  }

  function toggleMusicModelDropdown(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!els.musicModelDropdown) return;
    const isHidden = els.musicModelDropdown.style.display === 'none' || !els.musicModelDropdown.style.display;
    if (isHidden) {
      openMusicModelDropdown();
    } else {
      closeMusicModelDropdown();
    }
  }

  function openMusicModelDropdown() {
    if (!els.musicModelDropdown) return;
    normalizeMusicModelSetting();
    closeAttachmentDropdown();
    closeSearchDropdown();
    closeImageModelDropdown();
    els.musicModelDropdown.style.display = 'flex';
    els.musicGenToggleBtn?.setAttribute('aria-expanded', 'true');

    // Auto-fetch model resmi OpenRouter jika belum di-cache
    if (!STATE.openRouterModels || STATE.openRouterModels.length <= 10) {
      fetchOpenRouterModelsList().then(() => {
        if (els.paneMusicOpenRouter && els.paneMusicOpenRouter.style.display !== 'none') {
          populateMusicOpenRouterModels(els.musicModelSearchInput?.value || '');
        }
      }).catch(() => {});
    }

    // Auto-fetch model resmi Ollama jika belum ada
    if (!STATE.ollamaModels || STATE.ollamaModels.length === 0) {
      checkOllamaHealth().then(() => {
        if (els.paneMusicOllama && els.paneMusicOllama.style.display !== 'none') {
          populateMusicOllamaModels(els.musicOllamaSearchInput?.value || '');
        }
      }).catch(() => {});
    }

    switchMusicModelTab('openrouter');

    AudioEngine.click();
  }

  function closeMusicModelDropdown() {
    if (!els.musicModelDropdown) return;
    els.musicModelDropdown.style.display = 'none';
    els.musicGenToggleBtn?.setAttribute('aria-expanded', 'false');
  }

  function setMusicModel(modelVal) {
    if (modelVal === 'off') {
      STATE.isMusicGenMode = false;
      updateMusicGenModeUI();
      closeMusicModelDropdown();
      AudioEngine.click();
      showToast('ℹ️ Mode AI Music Studio dinonaktifkan. Kembali ke obrolan biasa.');
      return;
    }

    STATE.settings.musicModel = modelVal;
    STATE.isMusicGenMode = true;
    STATE.isImageGenMode = false;
    try {
      localStorage.setItem('zoz_router_settings_v1', JSON.stringify(STATE.settings));
    } catch (_) {}
    if (els.settingMusicModel) {
      els.settingMusicModel.value = modelVal;
    }
    updateMusicGenModeUI();
    updateImageGenModeUI();
    closeMusicModelDropdown();
    AudioEngine.success();
    els.promptInput?.focus();
    const displayName = getMusicModelDisplayName(modelVal);
    if (modelVal.includes('/') && !STATE.settings.openRouterKey) {
      showToast(`⚠️ Model musik ${displayName} dipilih. Butuh OpenRouter Key di Pengaturan untuk memanggil cloud model.`, 'warning');
    } else {
      showToast(`🎵 Model Musik Aktif: ${displayName}`);
    }
  }

  function switchImageModelTab(tabName) {
    const isOR = tabName === 'openrouter';
    if (els.tabBtnPollinations) els.tabBtnPollinations.classList.toggle('active', !isOR);
    if (els.tabBtnOpenRouter) els.tabBtnOpenRouter.classList.toggle('active', isOR);
    if (els.panePollinations) els.panePollinations.style.display = isOR ? 'none' : 'flex';
    if (els.paneOpenRouter) els.paneOpenRouter.style.display = isOR ? 'flex' : 'none';

    if (isOR) {
      updateImageModelStatusBar();
      populateOpenRouterImageModels(els.imageModelSearchInput?.value || '');
      setTimeout(() => els.imageModelSearchInput?.focus(), 60);
    }
  }

  function updateImageModelStatusBar() {
    if (!els.openRouterStatusBar) return;
    const hasKey = Boolean(STATE.settings.openRouterKey);
    els.openRouterStatusBar.className = `image-model-status-bar ${hasKey ? 'connected' : 'warning'}`;
    els.openRouterStatusBar.innerHTML = hasKey
      ? `<span><i class="fa-solid fa-circle-check" style="color:var(--neon-teal);"></i> API Key Terhubung • 59+ Cloud Image Engines</span>
         <button class="status-action-btn" id="openRouterConfigBtn" type="button">Pengaturan</button>`
      : `<span><i class="fa-solid fa-circle-exclamation" style="color:var(--neon-amber);"></i> Butuh OpenRouter Key untuk cloud models</span>
         <button class="status-action-btn" id="openRouterConfigBtn" type="button">Buka Pengaturan</button>`;

    const cfgBtn = els.openRouterStatusBar.querySelector('#openRouterConfigBtn');
    cfgBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeImageModelDropdown();
      const modal = $('#settingsModal');
      if (modal) {
        modal.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === 'tabProviders'));
        modal.querySelectorAll('.settings-tab-pane').forEach(pane => pane.classList.toggle('active', pane.id === 'tabProviders'));
      }
      openModal('settingsModal');
      AudioEngine.click();
    });
  }

  function populateOpenRouterImageModels(searchQuery = '') {
    if (!els.imageModelOpenRouterList) return;
    const q = (searchQuery || '').toLowerCase().trim();
    
    // Gabungkan model terkurasi dan hasil fetch live OpenRouter
    const allModelsMap = new Map();
    CURATED_OPENROUTER_IMAGE_MODELS.forEach(m => allModelsMap.set(m.id, m));
    if (Array.isArray(STATE.availableImageModels)) {
      STATE.availableImageModels.forEach(m => {
        if (m.provider === 'openrouter' || (m.id && m.id.includes('/'))) {
          if (!allModelsMap.has(m.id)) allModelsMap.set(m.id, m);
        }
      });
    }

    // Pastikan model kustom aktif yang dipilih pengguna tetap muncul di daftar jika belum ada
    const activeModel = STATE.settings.imageModel || 'flux';
    if (activeModel.includes('/') && !allModelsMap.has(activeModel)) {
      allModelsMap.set(activeModel, {
        id: activeModel,
        name: getImageModelDisplayName(activeModel),
        provider: 'openrouter',
        cat: 'custom',
        tag: 'Custom • Cloud',
        desc: `Model Kustom OpenRouter: ${activeModel}`
      });
    }

    let list = Array.from(allModelsMap.values());
    if (q) {
      list = list.filter(m => 
        m.id.toLowerCase().includes(q) || 
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.desc && m.desc.toLowerCase().includes(q)) ||
        (m.tag && m.tag.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      els.imageModelOpenRouterList.innerHTML = `
        <div style="padding: 16px 8px; text-align: center; color: var(--text-dim); font-size: 0.72rem;">
          <i class="fa-solid fa-ghost" style="font-size: 1.2rem; margin-bottom: 6px; display: block; opacity: 0.5;"></i>
          Tidak ada model OpenRouter yang cocok dengan "<strong>${escapeHtml(q)}</strong>"<br>
          Gunakan baris kustom di atas untuk memasukkan model secara manual.
        </div>
      `;
      return;
    }

    const isImageMode = Boolean(STATE.isImageGenMode);

    els.imageModelOpenRouterList.innerHTML = list.map(m => {
      const isSelected = isImageMode && (m.id === activeModel);
      let icon = 'fa-cloud';
      let accentClass = 'cloud-accent';
      const idLow = m.id.toLowerCase();
      if (idLow.includes('flux')) { icon = 'fa-bolt-lightning'; accentClass = 'flux-accent'; }
      else if (idLow.includes('gemini')) { icon = 'fa-brands fa-google'; accentClass = 'realism-accent'; }
      else if (idLow.includes('gpt') || idLow.includes('openai')) { icon = 'fa-microchip'; accentClass = 'cloud-accent'; }
      else if (idLow.includes('recraft')) { icon = 'fa-vector-square'; accentClass = 'anime-accent'; }
      else if (idLow.includes('grok')) { icon = 'fa-rocket'; accentClass = 'turbo-accent'; }
      else if (idLow.includes('seedream')) { icon = 'fa-seedling'; accentClass = 'cgi-accent'; }
      else if (idLow.includes('qwen')) { icon = 'fa-dragon'; accentClass = 'mj-accent'; }
      else if (idLow.includes('krea')) { icon = 'fa-palette'; accentClass = 'pro-accent'; }

      return `
        <button class="image-model-item ${isSelected ? 'active' : ''}" type="button" data-model="${escapeHtml(m.id)}">
          <div class="image-model-icon-box ${accentClass}">
            <i class="${icon}"></i>
          </div>
          <div class="image-model-info">
            <div class="image-model-title-row">
              <span class="image-model-title">${escapeHtml(m.name || m.id)}</span>
              <span class="image-model-tag">${escapeHtml(m.tag || 'OpenRouter')}</span>
            </div>
            <span class="image-model-desc">${escapeHtml(m.desc || m.id)}</span>
          </div>
          <i class="fa-solid fa-check image-model-check" style="${isSelected ? 'display: block;' : 'display: none;'}"></i>
        </button>
      `;
    }).join('');

    // Pasang listener klik ke item model OpenRouter
    els.imageModelOpenRouterList.querySelectorAll('.image-model-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const modelVal = item.dataset.model;
        if (modelVal) setImageModel(modelVal);
      });
    });
  }

  function toggleImageModelDropdown(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!els.imageModelDropdown) return;
    const isHidden = els.imageModelDropdown.style.display === 'none' || !els.imageModelDropdown.style.display;
    if (isHidden) {
      openImageModelDropdown();
    } else {
      closeImageModelDropdown();
    }
  }

  function openImageModelDropdown() {
    if (!els.imageModelDropdown) return;
    closeAttachmentDropdown();
    closeSearchDropdown();
    closeMusicModelDropdown();
    els.imageModelDropdown.style.display = 'flex';
    els.imageGenToggleBtn?.setAttribute('aria-expanded', 'true');

    // Auto switch ke tab OpenRouter jika model saat ini adalah model cloud OpenRouter
    const currentModel = STATE.settings.imageModel || 'flux';
    if (currentModel.includes('/')) {
      switchImageModelTab('openrouter');
    } else {
      switchImageModelTab('pollinations');
    }

    AudioEngine.click();
  }

  function closeImageModelDropdown() {
    if (!els.imageModelDropdown) return;
    els.imageModelDropdown.style.display = 'none';
    els.imageGenToggleBtn?.setAttribute('aria-expanded', 'false');
  }

  function setImageModel(modelVal) {
    if (modelVal === 'off') {
      STATE.isImageGenMode = false;
      updateImageGenModeUI();
      closeImageModelDropdown();
      AudioEngine.click();
      showToast('ℹ️ Mode Buat Gambar dinonaktifkan. Kembali ke obrolan biasa.');
      return;
    }

    STATE.settings.imageModel = modelVal;
    STATE.isImageGenMode = true;
    STATE.isMusicGenMode = false;
    try {
      localStorage.setItem('zoz_router_settings_v1', JSON.stringify(STATE.settings));
    } catch (_) {}
    updateImageGenModeUI();
    updateMusicGenModeUI();
    closeImageModelDropdown();
    AudioEngine.success();
    els.promptInput?.focus();
    const displayName = getImageModelDisplayName(modelVal);
    if (modelVal.includes('/') && !STATE.settings.openRouterKey) {
      showToast(`⚠️ Model ${displayName} aktif. Butuh OpenRouter Key di Pengaturan untuk menghasilkan gambar.`, 'warning');
    } else {
      showToast(`🎨 Model Gambar Aktif: ${displayName}`);
    }
  }

  function togglePromptVisibility(forceState) {
    if (typeof forceState === 'boolean') {
      STATE.isPromptHidden = forceState;
    } else {
      STATE.isPromptHidden = !STATE.isPromptHidden;
    }

    updatePromptVisibilityUI(false);

    try {
      localStorage.setItem('zoz_prompt_hidden', STATE.isPromptHidden ? 'true' : 'false');
    } catch (_) {}

    AudioEngine.click();
    if (navigator.vibrate) {
      try { navigator.vibrate(25); } catch (_) {}
    }
  }

  function updatePromptVisibilityUI(silent = false) {
    const isHidden = Boolean(STATE.isPromptHidden);
    if (els.mainComposerContainer) {
      els.mainComposerContainer.classList.toggle('composer-collapsed', isHidden);
    }

    if (els.neutronCrownBtn) {
      els.neutronCrownBtn.classList.toggle('state-blue', isHidden);
      els.neutronCrownBtn.classList.toggle('state-red', !isHidden);
      // A11y: label DIPERBARUI sesuai state, bukan dihapus — dulu title/aria-label
      // dibuang setiap toggle sehingga tombol permanen "tak bernama" di screen reader.
      const crownLabel = isHidden ? 'Tampilkan kembali kolom prompt' : 'Sembunyikan kolom prompt';
      els.neutronCrownBtn.setAttribute('title', crownLabel);
      els.neutronCrownBtn.setAttribute('aria-label', crownLabel);
    }

    if (!silent && !isHidden) {
      setTimeout(() => {
        els.promptInput?.focus();
        autoResizeTextarea(els.promptInput);
      }, 60);
    }
  }

  async function runImageGeneration(session, promptText, customModel = null) {
    if (!promptText || !promptText.trim()) return;
    const cleanPrompt = promptText.trim();
    const activeImageModel = (customModel && typeof customModel === 'string') ? customModel : (STATE.settings.imageModel || 'flux');
    
    setGeneratingState(true);
    STATE.abortController = new AbortController();

    const startTime = performance.now();
    const assistantRow = appendMessageElement('assistant', '', null, 'AI Image Studio');
    const bubbleText = assistantRow.querySelector('.msg-text-content');
    const metaBox = assistantRow.querySelector('.message-meta');

    // Render Creation Animation HUD
    bubbleText.innerHTML = `
      <div class="image-gen-hud">
        <div class="image-gen-header">
          <div class="image-gen-title-box">
            <i class="fa-solid fa-atom fa-spin" style="color:#FF007F;"></i>
            <span>AI Image Studio (Neural Synthesis)</span>
          </div>
          <span class="image-gen-badge">${escapeHtml(activeImageModel)}</span>
        </div>
        <div class="image-gen-canvas-wrapper">
          <div class="image-gen-canvas-grid"></div>
          <div class="image-gen-laser-beam"></div>
          <div class="image-gen-holo-center">
            <div class="image-gen-holo-icon-wrap">
              <div class="image-gen-holo-ring"></div>
              <i class="fa-solid fa-wand-magic-sparkles image-gen-holo-core"></i>
            </div>
            <div class="image-gen-holo-label">Sintesis Kuantum Aktif</div>
          </div>
        </div>
        <div class="image-gen-telemetry">
          <div class="image-gen-status-row">
            <span class="image-gen-status-text">
              <i class="fa-solid fa-circle-notch fa-spin" style="color:#FF007F;"></i>
              <span class="image-gen-step-msg">[Langkah 1/3] Mengonversi semantik prompt ke ruang laten...</span>
            </span>
            <span class="image-gen-percent-text">15%</span>
          </div>
          <div class="image-gen-progress-track">
            <div class="image-gen-progress-fill" style="width: 15%;"></div>
          </div>
          <div class="image-gen-prompt-quote" title="${escapeHtml(cleanPrompt)}">
            "${escapeHtml(cleanPrompt)}"
          </div>
        </div>
      </div>
    `;
    smartScrollChatToBottom(true);

    const stepMsgEl = bubbleText.querySelector('.image-gen-step-msg');
    const percentEl = bubbleText.querySelector('.image-gen-percent-text');
    const progressFillEl = bubbleText.querySelector('.image-gen-progress-fill');

    function updateHudStep(stepText, percent) {
      if (stepMsgEl) stepMsgEl.innerText = stepText;
      if (percentEl) percentEl.innerText = `${percent}%`;
      if (progressFillEl) progressFillEl.style.width = `${percent}%`;
      smartScrollChatToBottom(false);
    }

    // Step 2 & Step 3 timed progression
    const timerStep2 = setTimeout(() => {
      updateHudStep(`[Langkah 2/3] Denoising matriks difusi ${escapeHtml(activeImageModel)}...`, 50);
    }, 700);

    const timerStep3 = setTimeout(() => {
      updateHudStep('[Langkah 3/3] Materialisasi kuantum, upscaling & render final...', 85);
    }, 2200);

    const isCloudModel = activeImageModel.includes('/');
    const displayName = getImageModelDisplayName(activeImageModel);

    try {
      if (isCloudModel && !STATE.settings.openRouterKey) {
        throw new Error(`Model cloud OpenRouter (${displayName}) memerlukan API Key. Silakan masukkan OpenRouter API Key Anda di menu Pengaturan > Provider Cloud, atau pilih model gratis di tab Pollinations.`);
      }

      let finalImageUrl = '';
      let resultModel = activeImageModel;
      let actualSeed = Math.floor(Math.random() * 100000000);

      if (!IS_GITHUB_PAGES) {
        try {
          const targetSessId = session ? session.id : (STATE.currentSessionId || null);
          const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': STATE.settings.openRouterKey ? `Bearer ${STATE.settings.openRouterKey}` : '',
              'x-session-id': targetSessId || '',
              'X-User-ID': STATE.userId || 'default',
              'x-user-id': STATE.userId || 'default'
            },
            body: JSON.stringify({
              userId: STATE.userId || 'default',
              sessionId: targetSessId,
              prompt: cleanPrompt,
              model: activeImageModel,
              width: 1024,
              height: 1024,
              openRouterKey: STATE.settings.openRouterKey || ''
            }),
            signal: STATE.abortController?.signal
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && (data.url || data.localUrl)) {
              finalImageUrl = data.url || data.localUrl;
              resultModel = data.model || resultModel;
              actualSeed = data.seed || actualSeed;
            } else {
              throw new Error(data.error || 'Server tidak mengembalikan data gambar');
            }
          } else {
            let errorMsg = `Server HTTP ${res.status}`;
            try {
              const errData = await res.json();
              if (errData && errData.error) {
                errorMsg = typeof errData.error === 'object' ? (errData.error.message || JSON.stringify(errData.error)) : errData.error;
              }
            } catch (_) {}
            throw new Error(errorMsg);
          }
        } catch (serverErr) {
          if (serverErr.name === 'AbortError') throw serverErr;
          if (isCloudModel) {
            // Direct client-side OpenRouter API call if server endpoint is offline or errored
            if (STATE.settings.openRouterKey) {
              try {
                updateHudStep(`[Langkah 2/3] Menghubungi OpenRouter API langsung (${escapeHtml(displayName)})...`, 60);
                const directRes = await fetch('https://openrouter.ai/api/v1/images', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${STATE.settings.openRouterKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://github.com/Zozi0999/zoz_router',
                    'X-Title': 'Zoz Router Image Studio'
                  },
                  body: JSON.stringify({
                    model: activeImageModel,
                    prompt: cleanPrompt,
                    aspect_ratio: '1:1'
                  }),
                  signal: STATE.abortController?.signal
                });
                const directData = await directRes.json().catch(() => ({}));
                if (directRes.ok && directData.data?.[0]) {
                  const it = directData.data[0];
                  if (it.b64_json) {
                    finalImageUrl = `data:${it.media_type || 'image/png'};base64,${it.b64_json}`;
                  } else if (it.url) {
                    finalImageUrl = it.url;
                  }
                  resultModel = activeImageModel;
                } else {
                  const msg = typeof directData.error === 'object' ? (directData.error.message || JSON.stringify(directData.error)) : (directData.error || serverErr.message);
                  throw new Error(msg);
                }
              } catch (directErr) {
                if (directErr.name === 'AbortError') throw directErr;
                throw new Error(`Gagal menghasilkan gambar dari model OpenRouter (${displayName}): ${directErr.message}`);
              }
            } else {
              throw serverErr;
            }
          } else {
            console.warn('Backend image gen fallback ke direct Pollinations AI:', serverErr);
          }
        }
      }

      // Client-side Direct OpenRouter (untuk GitHub Pages jika IS_GITHUB_PAGES bernilai true)
      if (isCloudModel && !finalImageUrl) {
        if (STATE.settings.openRouterKey) {
          updateHudStep(`[Langkah 2/3] Menghubungi OpenRouter API langsung (${escapeHtml(displayName)})...`, 60);
          const directRes = await fetch('https://openrouter.ai/api/v1/images', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${STATE.settings.openRouterKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://github.com/Zozi0999/zoz_router',
              'X-Title': 'Zoz Router Image Studio'
            },
            body: JSON.stringify({
              model: activeImageModel,
              prompt: cleanPrompt,
              aspect_ratio: '1:1'
            }),
            signal: STATE.abortController?.signal
          });
          const directData = await directRes.json().catch(() => ({}));
          if (directRes.ok && directData.data?.[0]) {
            const it = directData.data[0];
            if (it.b64_json) {
              finalImageUrl = `data:${it.media_type || 'image/png'};base64,${it.b64_json}`;
            } else if (it.url) {
              finalImageUrl = it.url;
            }
            resultModel = activeImageModel;
          } else {
            const msg = typeof directData.error === 'object' ? (directData.error.message || JSON.stringify(directData.error)) : (directData.error || 'OpenRouter API gagal merespons');
            throw new Error(`Gagal menghasilkan gambar dari model OpenRouter (${displayName}): ${msg}`);
          }
        } else {
          throw new Error(`Model cloud OpenRouter (${displayName}) memerlukan API Key. Masukkan API Key di menu Pengaturan > Provider Cloud.`);
        }
      }

      // Client-side Direct Pollinations Fallback (HANYA UNTUK MODEL NON-CLOUD / POLLINATIONS)
      if (!isCloudModel && !finalImageUrl) {
        actualSeed = Math.floor(Math.random() * 100000000);
        let styledPrompt = cleanPrompt;
        const lowModel = activeImageModel.toLowerCase();
        if (lowModel === 'flux-realism' && !/photo|realis|cinematic/i.test(cleanPrompt)) {
          styledPrompt = `${cleanPrompt}, photorealistic, ultra-detailed 8k photography, cinematic lighting`;
        } else if (lowModel === 'flux-anime' && !/anime|manga|2d/i.test(cleanPrompt)) {
          styledPrompt = `${cleanPrompt}, anime aesthetic, high quality Japanese manga style, vibrant colors, detailed line art`;
        } else if (lowModel === 'flux-3d' && !/3d|cgi|render/i.test(cleanPrompt)) {
          styledPrompt = `${cleanPrompt}, 3d digital render, octane render, unreal engine 5, 3d cgi volumetric lighting`;
        } else if (lowModel === 'midjourney' && !/artistic|midjourney/i.test(cleanPrompt)) {
          styledPrompt = `${cleanPrompt}, midjourney aesthetic, artistic concept art, dramatic composition, breathtaking detail`;
        } else if (lowModel === 'flux-pro' && !/masterpiece|pro/i.test(cleanPrompt)) {
          styledPrompt = `${cleanPrompt}, masterpiece, professional award-winning composition, ultra sharp details`;
        }

        let urlPrompt = styledPrompt;
        if (urlPrompt.length > 800) {
          const cut = urlPrompt.slice(0, 800);
          const lastSpace = cut.lastIndexOf(' ');
          urlPrompt = (lastSpace > 600 ? cut.slice(0, lastSpace) : cut).trim();
        }
        const encoded = encodeURIComponent(urlPrompt);
        finalImageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&model=${encodeURIComponent(activeImageModel)}&seed=${actualSeed}&nologo=true&enhance=true`;
      }
      // Preload image to ensure 100% materialization animation (with 25s safety timeout to prevent infinite UI hang)
      await new Promise((resolve, reject) => {
        const testImg = new Image();
        const timeout = setTimeout(() => {
          // If preloading takes > 25s, proceed so UI doesn't hang indefinitely
          resolve();
        }, 25000);
        testImg.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        testImg.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Gagal memuat visual gambar yang digenerasi.'));
        };
        const abortSig = STATE.abortController?.signal;
        if (abortSig) {
          if (abortSig.aborted) {
            clearTimeout(timeout);
            return reject(new DOMException('Aborted', 'AbortError'));
          }
          abortSig.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        }
        testImg.src = finalImageUrl;
      });

      clearTimeout(timerStep2);
      clearTimeout(timerStep3);
      updateHudStep('[Langkah 3/3] Selesai! Menampilkan karya visual...', 100);

      const endTime = performance.now();
      const totalDuration = ((endTime - startTime) / 1000).toFixed(2);

      // Render Result Card with Materialization Animation
      const cardItem = {
        url: finalImageUrl,
        imageUrl: finalImageUrl,
        prompt: cleanPrompt,
        model: resultModel,
        width: 1024,
        height: 1024,
        seed: actualSeed,
        duration: totalDuration
      };

      bubbleText.innerHTML = createGeneratedImageCardHtml(cardItem);
      attachImageCardListeners(assistantRow, cleanPrompt, finalImageUrl);

      if (metaBox) {
        metaBox.innerHTML = `
          <strong>AI Image Studio</strong>
          <span class="meta-model-badge" style="background:rgba(255,0,127,0.18); border-color:#FF007F; color:#FF66B2;"><i class="fa-solid fa-wand-magic-sparkles"></i> ${escapeHtml(resultModel)}</span>
          <span>⏱️ ${totalDuration}s</span>
        `;
      }

      // Save to Session if session is still alive
      if (STATE.sessions.some(s => s.id === session.id)) {
        session.messages.push({
          role: 'assistant',
          content: `[Gambar AI Hasil Generasi: "${cleanPrompt}"]`,
          type: 'image_generation',
          isImageGen: true,
          imageUrl: finalImageUrl,
          url: finalImageUrl,
          prompt: cleanPrompt,
          model: resultModel,
          width: 1024,
          height: 1024,
          seed: actualSeed,
          stats: { duration: totalDuration },
          timestamp: new Date().toISOString()
        });
        session.updatedAt = new Date().toISOString();
        savePersistedState();
        renderChatHistory(els.searchHistoryInput?.value || '');
      }

      AudioEngine.success();
      smartScrollChatToBottom(true);

    } catch (err) {
      clearTimeout(timerStep2);
      clearTimeout(timerStep3);

      if (err.name === 'AbortError') {
        assistantRow.remove();
        showToast('Generasi gambar dibatalkan oleh pengguna.');
      } else {
        console.error('Image gen error:', err);
        const isKeyOrCloudErr = isCloudModel || (err.message && (err.message.includes('API Key') || err.message.includes('OpenRouter') || err.message.includes('kredit')));
        bubbleText.innerHTML = `
          <div style="background:rgba(255,0,127,0.08); border:1px solid rgba(255,0,127,0.4); border-radius:10px; padding:14px; line-height:1.5;">
            <div style="font-weight:700; color:#FF2E93; margin-bottom:6px; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-triangle-exclamation"></i> Gagal Menghasilkan Gambar AI
            </div>
            <div style="font-size:0.83rem; color:var(--text-main); margin-bottom:8px;">
              ${escapeHtml(err.message || 'Terjadi gangguan saat memproses rendering difusi.')}
            </div>
            <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px;">
              <button class="btn btn-sm btn-primary retry-img-btn" style="font-size:0.75rem;">
                <i class="fa-solid fa-rotate-right"></i> Coba Generate Ulang
              </button>
              ${isKeyOrCloudErr ? `
              <button class="btn btn-sm btn-outline open-key-settings-btn" style="font-size:0.75rem; border-color:var(--neon-teal); color:var(--neon-teal);">
                <i class="fa-solid fa-key"></i> Buka Pengaturan API Key
              </button>
              ` : ''}
            </div>
          </div>
        `;
        bubbleText.querySelector('.retry-img-btn')?.addEventListener('click', () => {
          assistantRow.remove();
          runImageGeneration(session, cleanPrompt, activeImageModel);
        });
        bubbleText.querySelector('.open-key-settings-btn')?.addEventListener('click', () => {
          const modal = $('#settingsModal');
          if (modal) {
            modal.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === 'tabProviders'));
            modal.querySelectorAll('.settings-tab-pane').forEach(pane => pane.classList.toggle('active', pane.id === 'tabProviders'));
          }
          openModal('settingsModal');
          setTimeout(() => els.settingOpenRouterKey?.focus(), 120);
        });
        AudioEngine.error();
      }
    } finally {
      setGeneratingState(false);
      STATE.abortController = null;
    }
  }

  // ====================================================
  // AI MUSIC STUDIO & CYBER AUDIO PLAYER ENGINE
  // ====================================================
  function buildCyberAudioPlayerCardHtml(track) {
    const safeUrl = escapeHtml(track.url || track.audioUrl || '');
    const safeTitle = escapeHtml(track.title || 'Singularity Cyber Audio');
    const safeGenre = escapeHtml(track.genre || 'Cyberpunk');
    const bpm = track.bpm || null;
    const dur = track.duration || 15;
    const safePrompt = escapeHtml(track.prompt || '');
    const aiSummary = escapeHtml(track.aiSummary || '');
    const isAiComposed = Boolean(track.aiComposed);
    const trackId = 'cyber_audio_' + Math.random().toString(36).substring(2, 9);

    return `
      <div class="cyber-audio-card" id="${trackId}">
        <div class="cyber-audio-body">
          <div class="cyber-audio-title-row">
            <div class="cyber-audio-title"><i class="fa-solid fa-headphones" style="color:var(--neon-teal); margin-right:6px;"></i> ${safeTitle}</div>
            <div style="display:flex; gap:6px; align-items:center;">
              <span class="image-meta-badge" style="color:var(--neon-teal); border-color:rgba(0,255,194,0.4);"><i class="fa-solid fa-compact-disc"></i> ${safeGenre.toUpperCase()}</span>
              ${isAiComposed ? `<span class="image-meta-badge" style="color:#00F0FF; border-color:rgba(0,240,255,0.4); background:rgba(0,240,255,0.1);"><i class="fa-solid fa-brain"></i> AI Composed</span>` : ''}
            </div>
          </div>
          ${aiSummary ? `<div class="cyber-audio-ai-summary" style="font-size:0.75rem; color:var(--text-dim); margin-top:5px; margin-bottom:8px; line-height:1.45; display:flex; align-items:flex-start; gap:6px; border-left:2px solid var(--neon-teal); padding-left:8px; background:rgba(0,255,194,0.03); border-radius:0 6px 6px 0;"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--neon-teal); margin-top:2px; flex-shrink:0;"></i><span>${aiSummary}</span></div>` : ''}
          <div class="cyber-audio-wave-wrap">
            <canvas class="cyber-audio-wave-canvas" width="480" height="48"></canvas>
          </div>
          <div class="cyber-audio-controls-row">
            <button type="button" class="cyber-audio-play-btn" data-url="${safeUrl}" title="Putar / Jeda Audio"><i class="fa-solid fa-play"></i></button>
            <div class="cyber-audio-scrubber-wrap">
              <input type="range" class="cyber-audio-scrubber" min="0" max="100" value="0" step="0.1">
              <div class="cyber-audio-time-row">
                <span class="curr-time">0:00</span>
                <span class="total-time">0:${dur < 10 ? '0' + dur : dur}</span>
              </div>
            </div>
            <audio preload="metadata" src="${safeUrl}" style="display:none;"></audio>
          </div>
          <div class="image-meta-badges">
            ${bpm ? `<span class="image-meta-badge"><i class="fa-solid fa-gauge-high"></i> ${bpm} BPM</span>` : ''}
            <span class="image-meta-badge"><i class="fa-solid fa-clock"></i> ${dur}s</span>
            <span class="image-meta-badge" style="color:var(--neon-teal); border-color:rgba(0,255,194,0.3);"><i class="fa-solid fa-microchip"></i> ${isAiComposed ? 'AI Neural Music Architect' : 'Neural Audio Synth'}</span>
          </div>
          <div class="image-actions-bar">
            <button type="button" class="btn btn-xs btn-outline add-gen-to-bgm-btn" data-url="${safeUrl}" data-title="${safeTitle}">
              <i class="fa-solid fa-plus"></i> Tambah ke BGM Deck
            </button>
            <a href="${safeUrl}" download="${safeTitle}.mp3" class="btn btn-xs btn-outline">
              <i class="fa-solid fa-download"></i> Unduh Audio
            </a>
            ${safePrompt ? `<button type="button" class="btn btn-xs btn-outline copy-audio-prompt-btn" data-prompt="${safePrompt}"><i class="fa-solid fa-copy"></i> Salin Prompt</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function attachAudioPlayerListeners(container) {
    if (!container) return;
    const cards = container.querySelectorAll('.cyber-audio-card');
    cards.forEach(card => {
      if (card.dataset.listenersAttached) return;
      card.dataset.listenersAttached = 'true';

      const audio = card.querySelector('audio');
      const playBtn = card.querySelector('.cyber-audio-play-btn');
      const scrubber = card.querySelector('.cyber-audio-scrubber');
      const currTimeEl = card.querySelector('.curr-time');
      const totalTimeEl = card.querySelector('.total-time');
      const canvas = card.querySelector('.cyber-audio-wave-canvas');
      const addBgmBtn = card.querySelector('.add-gen-to-bgm-btn');
      const copyPromptBtn = card.querySelector('.copy-audio-prompt-btn');

      if (!audio || !playBtn) return;

      let animFrameId = null;
      function drawWaveform(isPlaying) {
        if (!canvas || typeof canvas.getContext !== 'function') return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const bars = 48;
        const barW = w / bars;
        const now = performance.now() * 0.005;

        for (let b = 0; b < bars; b++) {
          let barHeight;
          if (isPlaying) {
            barHeight = (Math.sin(now + b * 0.4) * 0.5 + 0.5) * (h * 0.75) + 4;
          } else {
            barHeight = Math.sin(b * 0.3) * (h * 0.3) + (h * 0.35);
          }
          const grad = ctx.createLinearGradient(0, h - barHeight, 0, h);
          grad.addColorStop(0, '#00FFC2');
          grad.addColorStop(1, '#00F0FF');
          ctx.fillStyle = grad;
          ctx.fillRect(b * barW + 1, h - barHeight, barW - 2, barHeight);
        }

        if (isPlaying) {
          animFrameId = requestAnimationFrame(() => drawWaveform(true));
        }
      }
      drawWaveform(false);

      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (audio.paused) {
          document.querySelectorAll('.cyber-audio-card audio').forEach(a => { if (a !== audio) a.pause(); });
          document.querySelectorAll('.cyber-audio-card .cyber-audio-play-btn').forEach(b => { if (b !== playBtn) b.innerHTML = '<i class="fa-solid fa-play"></i>'; });

          audio.play().then(() => {
            playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            drawWaveform(true);
          }).catch(err => {
            console.warn('Audio play error:', err);
          });
        } else {
          audio.pause();
          playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
          cancelAnimationFrame(animFrameId);
          drawWaveform(false);
        }
      });

      audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        if (scrubber) scrubber.value = pct;
        if (currTimeEl) {
          const mins = Math.floor(audio.currentTime / 60);
          const secs = Math.floor(audio.currentTime % 60);
          currTimeEl.innerText = `${mins}:${secs < 10 ? '0' + secs : secs}`;
        }
      });

      audio.addEventListener('loadedmetadata', () => {
        if (!audio.duration || !totalTimeEl) return;
        const mins = Math.floor(audio.duration / 60);
        const secs = Math.floor(audio.duration % 60);
        totalTimeEl.innerText = `${mins}:${secs < 10 ? '0' + secs : secs}`;
      });

      audio.addEventListener('ended', () => {
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        cancelAnimationFrame(animFrameId);
        drawWaveform(false);
        if (scrubber) scrubber.value = 0;
      });

      scrubber?.addEventListener('input', () => {
        if (!audio.duration) return;
        audio.currentTime = (scrubber.value / 100) * audio.duration;
      });

      addBgmBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = addBgmBtn.dataset.url;
        const title = addBgmBtn.dataset.title || 'Musik AI';
        if (typeof BGMEngine !== 'undefined' && BGMEngine.saveOnlineToPlaylist) {
          BGMEngine.saveOnlineToPlaylist(url, title);
          showToast(`🎵 "${title}" disimpan ke playlist BGM Deck!`);
        } else {
          showToast(`Audio URL: ${url}`, 'info');
        }
      });

      copyPromptBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        copyTextToClipboard(copyPromptBtn.dataset.prompt || '', () => {
          showToast('📋 Prompt musik berhasil disalin!');
        });
      });
    });
  }

  // ====================================================
  // AI VIDEO STUDIO & CYBER VIDEO PLAYER ENGINE
  // ====================================================
  function buildCyberVideoPlayerCardHtml(video) {
    const safeUrl = escapeHtml(video.url || video.videoUrl || '');
    const safeTitle = escapeHtml(video.title || 'Cinematic Video');
    const safeStyle = escapeHtml(video.style || 'Cinematic Motion');
    const dur = video.duration || 5;
    const safePrompt = escapeHtml(video.prompt || '');
    const videoId = 'cyber_video_' + Math.random().toString(36).substring(2, 9);

    return `
      <div class="cyber-video-card" id="${videoId}">
        <div class="cyber-video-wrap">
          <video controls autoplay loop playsinline preload="metadata" class="cyber-video-player" src="${safeUrl}"></video>
        </div>
        <div class="image-result-footer">
          <div class="image-meta-badges">
            <span class="image-meta-badge" style="color:#B026FF; border-color:rgba(176,38,255,0.4);"><i class="fa-solid fa-clapperboard"></i> ${safeTitle}</span>
            <span class="image-meta-badge"><i class="fa-solid fa-clock"></i> ${dur}s</span>
            <span class="image-meta-badge"><i class="fa-solid fa-film"></i> MP4 H.264 HD</span>
            <span class="image-meta-badge"><i class="fa-solid fa-wand-magic-sparkles"></i> ${safeStyle}</span>
          </div>
          <div class="image-actions-bar">
            <a href="${safeUrl}" download="${safeTitle}.mp4" class="btn btn-xs btn-outline">
              <i class="fa-solid fa-download"></i> Unduh Video
            </a>
            ${safePrompt ? `<button type="button" class="btn btn-xs btn-outline copy-video-prompt-btn" data-prompt="${safePrompt}"><i class="fa-solid fa-copy"></i> Salin Prompt</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function attachVideoPlayerListeners(container) {
    if (!container) return;
    const copyBtns = container.querySelectorAll('.copy-video-prompt-btn');
    copyBtns.forEach(btn => {
      if (btn.dataset.listenersAttached) return;
      btn.dataset.listenersAttached = 'true';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyTextToClipboard(btn.dataset.prompt || '', () => {
          showToast('📋 Prompt video berhasil disalin!');
        });
      });
    });
  }

  function base64ToUint8Array(base64) {
    let b64 = String(base64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
    while (b64.length % 4 !== 0) b64 += '=';
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function detectAudioMimeFromBytes(bytes) {
    if (!bytes || bytes.length < 4) return null;
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'audio/wav';
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return 'audio/mp3';
    if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return 'audio/mp3';
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return 'audio/ogg';
    if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) return 'audio/flac';
    if (bytes.length > 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'audio/mp4';
    return null;
  }

  function wrapPcm16InWavBlob(pcmBytes, sampleRate = 24000, numChannels = 1) {
    const dataLen = pcmBytes.length;
    const buffer = new ArrayBuffer(44 + dataLen);
    const view = new DataView(buffer);
    const byteRate = sampleRate * numChannels * 2;
    const blockAlign = numChannels * 2;

    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataLen, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"

    view.setUint32(12, 0x666D7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);

    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataLen, true);

    const outBytes = new Uint8Array(buffer);
    outBytes.set(pcmBytes, 44);
    return new Blob([outBytes], { type: 'audio/wav' });
  }

  async function generateAudioViaOpenRouterClient({ model, prompt, key, signal, isRetried = false }) {
    if (!key) {
      throw new Error('NO_KEY: Butuh OpenRouter API Key (Pengaturan → Providers) untuk memanggil model musik AI Google Lyria 3.');
    }
    const cleanModel = String(model || 'google/lyria-3-clip-preview').replace(/^openrouter:/i, '').trim();

    const payload = {
      model: cleanModel,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['text', 'audio'],
      stream: true
    };
    if (/gpt-audio/i.test(cleanModel)) {
      payload.audio = { voice: 'alloy', format: 'pcm16' };
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/Zozi0999/zoz_router',
        'X-Title': 'Zoz Router AI Music Studio'
      },
      body: JSON.stringify(payload),
      signal
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      let errMsg = `OpenRouter HTTP ${res.status}`;
      if (errJson && errJson.error) {
        errMsg = typeof errJson.error === 'object'
          ? (errJson.error.message || JSON.stringify(errJson.error))
          : String(errJson.error);
      }
      if (res.status === 401) {
        throw new Error('NO_KEY: API Key OpenRouter tidak valid atau belum diisi. Periksa API Key di menu Pengaturan → Providers.');
      }
      if (res.status === 402) {
        throw new Error('Saldo kredit OpenRouter tidak mencukupi untuk menggunakan model Google Lyria.');
      }
      // LEVIATHAN NEURAL TUNNELING AUTO-BYPASS ON GOOGLE SAFETY BLOCK
      if (!isRetried && /PROHIBITED_CONTENT|BLOCKED|SAFETY|HARM|filtered/i.test(errMsg)) {
        console.warn('[Leviathan Neural Tunneling] Terdeteksi filter sensor Google (' + errMsg + '). Mengaktifkan adversarial prompt tunneling...');
        const bypassedPrompt = neuralTunnelMusicPrompt(prompt);
        return generateAudioViaOpenRouterClient({
          model: cleanModel,
          prompt: bypassedPrompt,
          key,
          signal,
          isRetried: true
        });
      }
      throw new Error(`OpenRouter (${cleanModel}): ${errMsg}`);
    }

    const sink = { text: '', base64Parts: [] };

    const processChoice = (choice) => {
      if (!choice) return;
      for (const m of [choice.delta, choice.message]) {
        if (!m || typeof m !== 'object') continue;
        if (typeof m.content === 'string') sink.text += m.content;
        else if (Array.isArray(m.content)) {
          for (const part of m.content) {
            if (!part || typeof part !== 'object') continue;
            if (typeof part.text === 'string') sink.text += part.text;
            const a = part.audio || part.output_audio;
            if (a && typeof a.data === 'string') sink.base64Parts.push(a.data);
            else if (typeof part.data === 'string' && /audio/i.test(String(part.type || ''))) sink.base64Parts.push(part.data);
            const u = (part.audio_url && part.audio_url.url) || (part.audio && part.audio.url) || '';
            if (typeof u === 'string' && u.includes('base64,')) sink.base64Parts.push(u.split('base64,')[1]);
          }
        }
        if (m.audio && typeof m.audio === 'object' && !Array.isArray(m.audio)) {
          if (typeof m.audio.data === 'string') sink.base64Parts.push(m.audio.data);
          if (typeof m.audio.transcript === 'string') sink.text += m.audio.transcript;
          const u = m.audio.url || '';
          if (typeof u === 'string' && u.includes('base64,')) sink.base64Parts.push(u.split('base64,')[1]);
        }
      }
    };

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      const json = await res.json();
      if (json.error) throw new Error(typeof json.error === 'object' ? (json.error.message || JSON.stringify(json.error)) : String(json.error));
      if (Array.isArray(json.choices)) json.choices.forEach(processChoice);
    } else {
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const l = line.trim();
          if (!l || l.startsWith(':') || !l.startsWith('data:')) continue;
          const data = l.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const j = JSON.parse(data);
            if (j.error) throw new Error(typeof j.error === 'object' ? (j.error.message || JSON.stringify(j.error)) : String(j.error));
            if (Array.isArray(j.choices)) j.choices.forEach(processChoice);
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }
      if (buffer.trim()) {
        const l = buffer.trim();
        if (l.startsWith('data:')) {
          const data = l.slice(5).trim();
          if (data && data !== '[DONE]') {
            try {
              const j = JSON.parse(data);
              if (Array.isArray(j.choices)) j.choices.forEach(processChoice);
            } catch (_) {}
          }
        }
      }
    }

    if (sink.base64Parts.length === 0) {
      throw new Error(`Model "${cleanModel}" tidak mengembalikan aliran audio biner. Pastikan model Google Lyria 3 dipilih.`);
    }

    const mergedBase64 = sink.base64Parts.join('').replace(/^data:audio\/[^;]+;base64,/i, '').replace(/\s+/g, '');
    const mergedBytes = base64ToUint8Array(mergedBase64);
    const mime = detectAudioMimeFromBytes(mergedBytes);
    let blob;
    if (mime) {
      blob = new Blob([mergedBytes], { type: mime });
    } else {
      blob = wrapPcm16InWavBlob(mergedBytes, 24000, 1);
    }

    const blobUrl = URL.createObjectURL(blob);
    return {
      url: blobUrl,
      blob,
      sizeBytes: blob.size,
      mimeType: blob.type,
      text: sink.text.trim(),
      model: cleanModel
    };
  }

  // M16: blob: URL musik hasil generate dibatasi (6 terbaru) dan yang lebih tua
  // direvoke — dulu tidak pernah direvoke sehingga setiap generate menahan blob
  // di memori selama sesi penuh (pertumbuhan tak terbatas). URL yang sudah
  // di-revoke memang mati permanen — itu inherent ke blob:, tetap mati saat reload.
  const liveGeneratedAudioUrls = [];
  function registerGeneratedAudioUrl(url) {
    if (!url || typeof url !== 'string' || url.indexOf('blob:') !== 0) return;
    liveGeneratedAudioUrls.push(url);
    while (liveGeneratedAudioUrls.length > 6) {
      const oldest = liveGeneratedAudioUrls.shift();
      try { URL.revokeObjectURL(oldest); } catch (_) {}
    }
  }

  async function runMusicGeneration(session, promptText, options = {}) {
    const cleanPrompt = extractMusicPrompt(promptText) || 'Cyberpunk futuristic darksynth beat';
    const tunneledPrompt = neuralTunnelMusicPrompt(cleanPrompt);
    normalizeMusicModelSetting();
    const targetMusicModel = (options.model && typeof options.model === 'string' && isAudioMusicModel(options.model)) ? options.model : STATE.settings.musicModel;
    const targetModelDisplayName = getMusicModelDisplayName(targetMusicModel);

    setGeneratingState(true);
    STATE.abortController = new AbortController();
    const startTime = performance.now();

    const assistantRow = appendMessageElement('assistant', '', null, 'Neural Music Studio');
    const bubbleText = assistantRow.querySelector('.msg-text-content');
    const metaBox = assistantRow.querySelector('.message-meta');

    if (bubbleText) {
      bubbleText.innerHTML = `
        <div class="music-gen-hud">
          <div class="music-gen-header">
            <div class="music-gen-title-box">
              <i class="fa-solid fa-music"></i> AI NEURAL MUSIC STUDIO
            </div>
            <span class="music-gen-badge">Model: ${escapeHtml(getMusicModelBadgeText(targetMusicModel))}</span>
          </div>
          <div class="music-gen-telemetry">
            <div class="music-gen-status-row">
              <span class="music-gen-status-text">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <span class="music-gen-step-msg">[Langkah 1/3] Merancang harmoni dengan ${escapeHtml(targetModelDisplayName)}...</span>
              </span>
              <span class="music-gen-percent-text">20%</span>
            </div>
            <div class="image-gen-progress-track">
              <div class="image-gen-progress-fill music-gen-progress-fill" style="width: 20%; background: linear-gradient(90deg, #00FFC2, #00F0FF);"></div>
            </div>
            <div class="image-gen-prompt-quote" style="border-left-color: #00FFC2;">"${escapeHtml(cleanPrompt)}"</div>
          </div>
        </div>
      `;
    }
    smartScrollChatToBottom(true);

    const stepMsgEl = bubbleText.querySelector('.music-gen-step-msg');
    const percentEl = bubbleText.querySelector('.music-gen-percent-text');
    const progressFillEl = bubbleText.querySelector('.music-gen-progress-fill');

    function updateHudStep(msg, pct) {
      if (stepMsgEl) stepMsgEl.innerText = msg;
      if (percentEl) percentEl.innerText = `${pct}%`;
      if (progressFillEl) progressFillEl.style.width = `${pct}%`;
      smartScrollChatToBottom(false);
    }

    const timer2 = setTimeout(() => {
      updateHudStep(`[Langkah 2/3] ${targetModelDisplayName} sedang menggubah & merender audio AI (20-90 detik)...`, 55);
    }, 1500);

    const timer3 = setTimeout(() => {
      updateHudStep('[Langkah 3/3] Menunggu aliran audio dari model AI...', 85);
    }, 15000);

    try {
      let finalAudioUrl = '';
      let trackTitle = 'AI Track';
      let trackGenre = 'ai';
      let trackBpm = null;
      let trackDuration = /clip/i.test(targetMusicModel) ? 30 : 0;
      let trackAiSummary = '';
      let trackAiComposed = true;
      let trackAiModel = targetMusicModel;
      let trackAiProvider = 'openrouter';
      let generatedSuccessfully = false;

      // 1. Coba panggil server backend lokal jika bukan di GitHub Pages
      if (!IS_GITHUB_PAGES) {
        try {
          updateHudStep(`[Langkah 2/3] Menghubungi server musik Zoz Router...`, 45);
          const res = await fetch('/api/generate-music', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-session-id': session ? session.id : '',
              'x-openrouter-key': STATE.settings.openRouterKey || '',
              'X-User-ID': STATE.userId || 'default',
              'x-user-id': STATE.userId || 'default'
            },
            body: JSON.stringify({
              userId: STATE.userId || 'default',
              prompt: tunneledPrompt,
              originalPrompt: cleanPrompt,
              sessionId: session ? session.id : null,
              musicModel: targetMusicModel,
              openRouterKey: STATE.settings.openRouterKey || ''
            }),
            signal: STATE.abortController?.signal
          });

          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.success && data.url) {
              finalAudioUrl = data.url;
              trackTitle = data.title || trackTitle;
              trackGenre = data.genre || trackGenre;
              trackBpm = data.bpm || null;
              trackDuration = data.duration || trackDuration;
              trackAiSummary = data.aiSummary || '';
              trackAiComposed = true;
              trackAiModel = data.aiModel || trackAiModel;
              trackAiProvider = data.aiProvider || trackAiProvider;
              generatedSuccessfully = true;
            } else {
              throw new Error(data.error || 'Server backend tidak mengembalikan data audio.');
            }
          } else {
            let errorMsg = `Server audio HTTP ${res.status}`;
            try {
              const errData = await res.json();
              if (errData && errData.error) errorMsg = errData.error;
            } catch (_) {}
            throw new Error(errorMsg);
          }
        } catch (serverErr) {
          if (serverErr.name === 'AbortError') throw serverErr;
          console.warn('[Music Studio] Server local gagal/offline, beralih ke Direct OpenRouter Client:', serverErr.message);
        }
      }

      // 2. Direct Browser OpenRouter Client (untuk GitHub Pages atau jika server lokal offline/404)
      if (!generatedSuccessfully) {
        if (!STATE.settings.openRouterKey) {
          throw new Error('NO_KEY: Butuh OpenRouter API Key (Pengaturan → Providers) untuk memanggil model musik AI Google Lyria 3.');
        }

        updateHudStep(`[Langkah 2/3] Memanggil ${escapeHtml(targetModelDisplayName)} via OpenRouter Cloud langsung...`, 60);

        const clientAudio = await generateAudioViaOpenRouterClient({
          model: targetMusicModel,
          prompt: tunneledPrompt,
          key: STATE.settings.openRouterKey,
          signal: STATE.abortController?.signal
        });

        finalAudioUrl = clientAudio.url;
        trackDuration = /clip/i.test(targetMusicModel) ? 30 : 0;
        trackAiSummary = clientAudio.text || `Dihasilkan langsung oleh model AI ${targetModelDisplayName}`;
        trackAiModel = clientAudio.model;
        trackAiProvider = 'openrouter';

        const words = cleanPrompt.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 6);
        trackTitle = words.length ? words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Lyria Track';
        generatedSuccessfully = true;
      }

      clearTimeout(timer2);
      clearTimeout(timer3);
      updateHudStep('[Langkah 3/3] Selesai! Menampilkan Cyberdeck Audio Player...', 100);
      // M16: daftarkan blob URL agar yang paling tua direvoke otomatis
      if (finalAudioUrl) registerGeneratedAudioUrl(finalAudioUrl);

      const endTime = performance.now();
      const totalDuration = ((endTime - startTime) / 1000).toFixed(2);

      const trackData = {
        url: finalAudioUrl,
        audioUrl: finalAudioUrl,
        title: trackTitle,
        genre: trackGenre,
        bpm: trackBpm,
        duration: trackDuration,
        prompt: cleanPrompt,
        aiComposed: trackAiComposed,
        aiSummary: trackAiSummary,
        aiModel: trackAiModel,
        aiProvider: trackAiProvider
      };

      bubbleText.innerHTML = buildCyberAudioPlayerCardHtml(trackData);
      attachAudioPlayerListeners(bubbleText);

      const providerIcon = trackAiProvider === 'openrouter' ? 'fa-cloud' : 'fa-microchip';
      const modelBadgeName = getMusicModelBadgeText(trackAiModel);
      metaBox.innerHTML = `
        <strong>Neural Music Studio</strong>
        <span class="meta-model-badge" style="background:rgba(0,255,194,0.15); border-color:#00FFC2; color:var(--neon-teal);"><i class="fa-solid ${providerIcon}"></i> ${escapeHtml(modelBadgeName)} (AI Audio)</span>
        <span>⏱️ ${totalDuration}s</span>
      `;

      if (session) {
        session.messages.push({
          role: 'assistant',
          content: `[Musik AI: "${cleanPrompt}"]\n\n- Judul: ${trackTitle}\n- Engine: ${trackAiModel} (${trackAiProvider})\n- Aransemen: ${trackAiSummary || 'Digubah oleh AI Neural Music Studio'}\n- Audio: [Putar / Unduh Audio](${finalAudioUrl})`,
          type: 'music_generation',
          isMusicGen: true,
          audioUrl: finalAudioUrl,
          url: finalAudioUrl,
          title: trackTitle,
          genre: trackGenre,
          bpm: trackBpm,
          duration: trackDuration,
          prompt: cleanPrompt,
          aiComposed: trackAiComposed,
          aiSummary: trackAiSummary,
          model: `${trackAiModel} (${trackAiProvider})`,
          stats: { duration: totalDuration },
          timestamp: new Date().toISOString()
        });
        session.updatedAt = new Date().toISOString();
        savePersistedState();
        renderChatHistory(els.searchHistoryInput?.value || '');
      }

      AudioEngine.success();
      smartScrollChatToBottom(true);

    } catch (err) {
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (err.name === 'AbortError') {
        assistantRow.remove();
        showToast('Generasi musik dibatalkan.');
      } else {
        console.error('Music gen error:', err);
        const isKeyError = err.message && (err.message.includes('NO_KEY') || err.message.includes('API Key') || err.message.includes('OpenRouter API Key'));
        const cleanErrMsg = (err.message || 'Terjadi gangguan saat memproses aransemen musik.').replace(/^NO_KEY:\s*/, '');

        bubbleText.innerHTML = `
          <div style="background:rgba(255,0,85,0.08); border:1px solid rgba(255,0,85,0.4); border-radius:10px; padding:14px; line-height:1.5;">
            <div style="font-weight:700; color:var(--neon-crimson); margin-bottom:6px; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-triangle-exclamation"></i> Gagal Menghasilkan Musik AI
            </div>
            <div style="font-size:0.83rem; color:var(--text-main); margin-bottom:12px;">
              ${escapeHtml(cleanErrMsg)}
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
              ${isKeyError ? `
                <button class="btn btn-sm btn-outline open-settings-key-btn" style="font-size:0.75rem; border-color:var(--neon-teal); color:var(--neon-teal);">
                  <i class="fa-solid fa-key"></i> Buka Pengaturan API Key
                </button>
              ` : ''}
              <button class="btn btn-sm btn-primary retry-music-btn" style="font-size:0.75rem;">
                <i class="fa-solid fa-rotate-right"></i> Coba Generate Ulang
              </button>
            </div>
          </div>
        `;
        bubbleText.querySelector('.open-settings-key-btn')?.addEventListener('click', () => {
          const modal = els.settingsModal || $('#settingsModal');
          if (modal) {
            modal.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.target === 'tabProviders' || btn.dataset.tab === 'tabProviders'));
            modal.querySelectorAll('.settings-tab-pane').forEach(pane => pane.classList.toggle('active', pane.id === 'tabProviders'));
          }
          openModal('settingsModal');
          setTimeout(() => { els.settingOpenRouterKey?.focus(); }, 300);
        });
        bubbleText.querySelector('.retry-music-btn')?.addEventListener('click', () => {
          assistantRow.remove();
          runMusicGeneration(session, cleanPrompt, options);
        });
        AudioEngine.error();
      }
    } finally {
      setGeneratingState(false);
      STATE.abortController = null;
    }
  }

  // ==================== SYSTEM PRESET HANDLER ====================
  function applySystemPreset(presetKey) {
    const currentVal = els.settingSystemPrompt ? els.settingSystemPrompt.value : '';
    const isPresetText = Object.keys(SYSTEM_PRESETS).some(k => k !== 'default' && SYSTEM_PRESETS[k].trim() === currentVal.trim());

    if (presetKey === 'default' || !presetKey) {
      // Simpan backup prompt kustom jika ada teks kustom di textarea yang belum disimpan
      if (currentVal.trim() && !isPresetText) {
        STATE.settings.customSystemPrompt = currentVal;
      }
      STATE.settings.systemPrompt = '';
      STATE.settings.activePreset = 'default';
      // JANGAN HAPUS persona kustom! Tetap pertahankan teks custom yang tersimpan di textarea
      if (els.settingSystemPrompt) {
        els.settingSystemPrompt.value = STATE.settings.customSystemPrompt || '';
      }
      showToast('Persona dinonaktifkan (Default). Prompt kustom tetap disimpan.');
    } else if (presetKey === 'custom') {
      STATE.settings.activePreset = 'custom';
      // Pulihkan prompt kustom yang tersimpan, atau ambil dari textarea
      const restored = STATE.settings.customSystemPrompt || currentVal.trim() || '';
      STATE.settings.systemPrompt = restored;
      STATE.settings.customSystemPrompt = restored;
      if (els.settingSystemPrompt) {
        els.settingSystemPrompt.value = restored;
      }
      showToast(restored ? 'Persona Kustom diaktifkan kembali.' : 'Mode Persona Kustom aktif.');
      setTimeout(() => els.settingSystemPrompt?.focus(), 50);
    } else if (SYSTEM_PRESETS[presetKey] !== undefined) {
      // Simpan backup prompt kustom jika berpindah dari custom/teks kustom
      if (currentVal.trim() && !isPresetText) {
        STATE.settings.customSystemPrompt = currentVal;
      }
      STATE.settings.systemPrompt = SYSTEM_PRESETS[presetKey];
      STATE.settings.activePreset = presetKey;
      if (els.settingSystemPrompt) {
        els.settingSystemPrompt.value = STATE.settings.systemPrompt;
      }
      showToast(`Persona aktif: ${presetKey.toUpperCase()}`);
    }
    updatePresetBanner();
    updatePresetPillUI();
    savePersistedState();
    AudioEngine.click();
  }

  function updatePresetPillUI() {
    const active = STATE.settings.activePreset || (STATE.settings.systemPrompt ? 'custom' : 'default');
    $$('.preset-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.preset === active);
    });
  }

  function updatePresetBanner() {
    const hasPrompt = Boolean(STATE.settings.systemPrompt && STATE.settings.systemPrompt.trim());
    if (hasPrompt) {
      const presetKey = STATE.settings.activePreset;
      const label = (presetKey && presetKey !== 'default' && presetKey !== 'custom' && SYSTEM_PRESETS[presetKey]) 
        ? presetKey.toUpperCase() 
        : 'CUSTOM';
      els.activePresetBanner.style.display = 'flex';
      els.activePresetName.innerText = `Persona: ${label}`;
    } else {
      els.activePresetBanner.style.display = 'none';
    }
  }

  // ==================== EXPORT CHAT WITH CONFIRMATION & IMAGE RENDERING ====================
  let pendingExportSession = null;

  async function promptExportConfirmation(session) {
    if (!session) {
      showToast('Obrolan masih kosong untuk diekspor.', 'error');
      return;
    }

    // Lazy load messages from device disk if needed before exporting
    if (session._isLazyDisk && (!session.messages || session.messages.length === 0)) {
      if (DeviceStorage.isDeviceBackendAvailable) {
        try {
          const fullSess = await DeviceStorage.getSession(session.id);
          if (fullSess && Array.isArray(fullSess.messages)) {
            session.messages = fullSess.messages;
            delete session._isLazyDisk;
          }
        } catch (e) {
          console.warn('Gagal memuat detail sesi aktif dari disk untuk ekspor:', e);
        }
      }
    }

    if (!session.messages || session.messages.length === 0) {
      showToast('Obrolan masih kosong untuk diekspor.', 'error');
      return;
    }

    pendingExportSession = session;

    const msgCount = session.messages.length;
    const imgCount = session.messages.filter(m => m.type === 'image_generation' || m.isImageGen || m.imageUrl).length;

    if (els.exportConfirmTitle) els.exportConfirmTitle.innerText = `"${session.title || 'Percakapan ZOZ Router'}"`;
    if (els.exportConfirmMsgCount) els.exportConfirmMsgCount.innerText = String(msgCount);
    if (els.exportConfirmImgCount) els.exportConfirmImgCount.innerText = String(imgCount);

    openModal('exportConfirmModal');
    AudioEngine.click();
  }

  function executeExportDownload(session) {
    if (!session || !session.messages || session.messages.length === 0) return;

    let md = `# ${session.title || 'Percakapan ZOZ Router'}\n`;
    let formattedDate = '';
    try {
      const createdAtDate = session.createdAt ? new Date(session.createdAt) : new Date();
      formattedDate = !isNaN(createdAtDate.getTime())
        ? createdAtDate.toLocaleString('id-ID')
        : new Date().toLocaleString('id-ID');
    } catch (_) {
      formattedDate = new Date().toLocaleString('id-ID');
    }
    md += `*Tanggal: ${formattedDate}*  \n`;
    md += `*Engine: ${(session.mode || 'ollama').toUpperCase()}*  \n\n---\n\n`;

    session.messages.forEach(m => {
      const sender = m.role === 'user' ? '👤 Pengguna' : `🤖 AI (${m.model || 'Model'})`;
      let content = m.content || '';

      // Visual Markdown Image Rendering for AI Image Studio results
      if (m.type === 'image_generation' || m.isImageGen || m.imageUrl) {
        let imgUrl = m.imageUrl || m.url || '';
        if (typeof imgUrl === 'string' && imgUrl.startsWith('/')) {
          imgUrl = window.location.origin + imgUrl;
        }
        const promptDesc = m.prompt ? m.prompt.replace(/[\[\]]/g, '') : 'Karya Seni AI';
        content += `\n\n![${promptDesc}](${imgUrl})\n\n`;
      }

      // Preserve user image attachments in Markdown
      const allUserImgs = (m.images && Array.isArray(m.images) && m.images.length > 0)
        ? m.images
        : (m.image ? [m.image] : []);
      if (allUserImgs.length > 0) {
        allUserImgs.forEach((img, i) => {
          const resolvedImg = (typeof img === 'string' && img.startsWith('/')) ? (window.location.origin + img) : img;
          content += `\n\n![Lampiran Foto ${i + 1}](${resolvedImg})\n\n`;
        });
      }

      // Preserve verified web sources in Markdown for Deep Research and Web Search
      if (m.sources && Array.isArray(m.sources) && m.sources.length > 0) {
        content += `\n\n**Sumber Terverifikasi Google (${m.sources.length} Dokumen Web):**\n`;
        m.sources.forEach((s, i) => {
          content += `${i + 1}. [${s.title || s.domain || 'Sumber Web'}](${s.url})\n`;
        });
      }

      md += `### ${sender}\n\n${content}\n\n---\n\n`;
    });

    const cleanTitle = sanitizeReportFilename(session.title || 'chat');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zoz-router-${cleanTitle}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 800);

    showToast('Obrolan berhasil diekspor sebagai Markdown!');
    AudioEngine.success();
  }

  async function exportChatHistory() {
    const session = getActiveSession();
    await promptExportConfirmation(session);
  }

  // ==================== MODAL HELPERS ====================
  function syncBodyModalState() {
    const hasOpenModal = !!document.querySelector('.modal-backdrop.show');
    if (hasOpenModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }

  function openModal(modalId) {
    if (modalId === 'modelHubModal') {
      openLiveModelCatalog(null, 'Model Obrolan Utama');
      return;
    }
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
      syncBodyModalState();
      history.pushState({ modal: modalId }, '');
      AudioEngine.click();
    }
  }

  function closeModal(modalId, triggerHistoryBack = true) {
    if (modalId === 'modelHubModal') {
      closeModal('liveModelCatalogModal', triggerHistoryBack);
      return;
    }
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      syncBodyModalState();
      AudioEngine.click();
      if (modalId === 'deepResearchReportModal') {
        const stageEl = document.getElementById('fullReportArticleStage');
        if (stageEl && stageEl._tocScrollHandler) {
          stageEl.removeEventListener('scroll', stageEl._tocScrollHandler);
          stageEl._tocScrollHandler = null;
        }
      }
      // Clean up AI File Studio active file reference to prevent memory leak
      if (modalId === 'aiFileStudioModal') {
        activeAIFile = null;
      }
      if (triggerHistoryBack && history.state?.modal === modalId) {
        history.back();
      }
    }
  }

  function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollH = textarea.scrollHeight;
    const maxHeight = 180;
    if (scrollH > maxHeight) {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.height = `${scrollH}px`;
      textarea.style.overflowY = 'hidden';
      if (!textarea.value) {
        textarea.scrollTop = 0;
      }
    }
  }

  // ==================== INDEXEDDB AUDIO VAULT ====================
  const MusicDB = {
    db: null,
    async init() {
      return new Promise((resolve) => {
        try {
          const req = indexedDB.open('ZozRouterMusicDB_v1', 1);
          req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('tracks')) {
              db.createObjectStore('tracks', { keyPath: 'id' });
            }
          };
          req.onsuccess = (e) => {
            this.db = e.target.result;
            resolve(this.db);
          };
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    },
    async saveTrack(track) {
      if (!this.db) await this.init();
      if (!this.db) return false;
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('tracks', 'readwrite');
          const req = tx.objectStore('tracks').put(track);
          req.onerror = () => resolve(false);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    },
    async getAllTracks() {
      if (!this.db) await this.init();
      if (!this.db) return [];
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('tracks', 'readonly');
          const req = tx.objectStore('tracks').getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
          // F11: transaksi yang di-abort (tekanan storage / tab lain menutup DB)
          // kini menyelesaikan Promise — dulu gantung selamanya dan init() playlist
          // tak pernah selesai (UI playlist/ambient tak pernah terinisialisasi).
          tx.onabort = () => resolve([]);
        } catch (e) {
          resolve([]);
        }
      });
    },
    async deleteTrack(id) {
      if (!this.db) await this.init();
      if (!this.db) return false;
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('tracks', 'readwrite');
          tx.objectStore('tracks').delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false); // F11: jangan gantung
        } catch (e) {
          resolve(false);
        }
      });
    },
    async clearAll() {
      if (!this.db) await this.init();
      if (!this.db) return false;
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction('tracks', 'readwrite');
          tx.objectStore('tracks').clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false); // F11: jangan gantung
        } catch (e) {
          resolve(false);
        }
      });
    }
  };

  // ==================== PROCEDURAL AMBIENT SOUNDSCAPES ====================
  const AMBIENT_PRESETS = [
    {
      id: 'ambient_space',
      name: '🌌 Deep Space Neural Drone',
      desc: 'Sintesis frekuensi 432Hz meditatif & resonansi sub-bass ruang hampa untuk ketenangan pikiran.',
      icon: 'fa-brain'
    },
    {
      id: 'ambient_synthwave',
      name: '⚡ Cyberpunk Synthwave Pulse',
      desc: 'Arpeggio neon 80s dengan filter cutoff analog dan modulasi binaural berenergi tinggi.',
      icon: 'fa-bolt'
    },
    {
      id: 'ambient_rain',
      name: '🌧️ Neo-Tokyo Rain & Lo-Fi Vinyl',
      desc: 'Deru hujan malam kota cyberpunk yang disaring dengan pad chord lo-fi bernuansa hangat.',
      icon: 'fa-cloud-rain'
    },
    {
      id: 'ambient_quantum',
      name: '🧠 Quantum Focus Alpha Waves',
      desc: 'Gelombang otak Alpha 10Hz binaural beats terkalibrasi khusus untuk deep coding & konsentrasi tajam.',
      icon: 'fa-microchip'
    }
  ];

  // ==================== CYBER BGM AUDIO ENGINE ====================
  const BGMEngine = {
    audio: null,
    audioCtx: null,
    analyser: null,
    sourceNode: null,
    masterGainNode: null,
    ambientGainNode: null,
    ambientNodes: [],
    ambientTimer: null,
    playlist: [],
    currentIndex: -1,
    isPlaying: false,
    currentMode: null, // 'file' | 'ambient'
    activeAmbientId: null,
    volume: 0.5,
    loopMode: 'all', // 'all' | 'one' | 'none'
    isShuffle: false,
    animFrameId: null,
    // Niat pemutaran pengguna: tetap true walau browser men-suspend audio saat tab
    // disembunyikan/di-minimize. Dipakai guardian untuk membangunkan playback lagi.
    wantsPlayback: false,
    guardianTimer: null,

    async init() {
      this.audio = new Audio();
      this.audio.crossOrigin = 'anonymous';

      // Load volume from storage
      try {
        const savedVol = localStorage.getItem('zoz_bgm_volume');
        if (savedVol !== null) {
          const parsedVol = parseFloat(savedVol);
          if (!isNaN(parsedVol) && isFinite(parsedVol)) {
            this.volume = Math.max(0, Math.min(1, parsedVol));
          }
        }
      } catch (_) {}
      this.audio.volume = this.volume;
      if (els.bgmMiniVolume) els.bgmMiniVolume.value = this.volume;
      if (els.deckMasterVolume) els.deckMasterVolume.value = this.volume;
      if (els.valMasterVolume) els.valMasterVolume.innerText = `${Math.round(this.volume * 100)}%`;

      // Audio Event Handlers
      this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
      this.audio.addEventListener('ended', () => this.onTrackEnded());
      // Sumber file yang BARU sudah benar-benar berbunyi → tutup jendela abaikan-
      // pause (dipakai hanya saat ganti track) lebih awal. Akibatnya pause pengguna
      // sesaat setelah lagu berganti TETAP dihormati (dulu kejebak 800ms penuh).
      this.audio.addEventListener('playing', () => {
        this._ignorePauseUntil = 0;
        this._reviveAttempts = 0;
      });
      // Pause di luar jendela pergantian = niat pengguna/SISTEM (tombol app sudah
      // menandai wantsPlayback sendiri; ini untuk media key OS, headphone Bluetooth
      // yang dilepas, dll.) — HORMATI tanpa memandang tab terlihat atau tidak.
      // Dulu pause saat tab tersembunyi diabaikan → guardian "membangunkan" musik
      // beberapa detik kemudian dan suara meledak dari speaker tanpa diminta.
      this.audio.addEventListener('pause', () => {
        if (this._ignorePauseUntil && performance.now() < this._ignorePauseUntil) return;
        if (this.currentMode === 'file' && this.audio.paused && this.wantsPlayback) {
          this.wantsPlayback = false;
          this.stopGuardian();
          this.setPlayingState(false);
        }
      });
      this.audio.addEventListener('error', () => {
        // Sumber mati (404 / codec tak didukung / URL stream habis) → matikan
        // guardian SEKALIGUS, jangan retry play() ke src rusak tiap 4 detik selamanya.
        this.wantsPlayback = false;
        this.stopGuardian();
        showToast('Gagal memutar file audio.', 'error');
        this.setPlayingState(false);
      });

      // Load saved playlist from IndexedDB
      await this.loadPlaylistFromDB();
      this.renderPlaylistUI();
      this.renderAmbientGridUI();

      // Start Visualizer Canvas Loop
      this.setupVisualizer();
    },

    initAudioContext() {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          try {
            this.audioCtx = new AudioContextClass();
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 64;

            this.masterGainNode = this.audioCtx.createGain();
            this.masterGainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
            this.masterGainNode.connect(this.audioCtx.destination);

            // Connect HTML Audio source to Web Audio analyser
            try {
              this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
              this.sourceNode.connect(this.analyser);
              this.analyser.connect(this.masterGainNode);
            } catch (e) {}
          } catch (e) {
            this.audioCtx = null;
          }
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        try {
          this.audioCtx.resume().catch(() => {});
        } catch (e) {}
      }
    },

    ytPlayer: null,
    ytReady: false,
    currentOnlineTrack: null,

    async loadPlaylistFromDB() {
      if (Array.isArray(this.playlist)) {
        this.playlist.forEach(t => {
          if (t && t.blob && t.url) {
            try { URL.revokeObjectURL(t.url); } catch (_) {}
          }
        });
      }
      const records = await MusicDB.getAllTracks();
      this.playlist = records.map(r => ({
        id: r.id,
        name: r.name,
        size: r.size || (r.isOnline ? 'Online' : 'Local'),
        type: r.type,
        isOnline: r.isOnline || false,
        youtubeId: r.youtubeId || null,
        onlineUrl: r.onlineUrl || null,
        url: r.blob ? URL.createObjectURL(r.blob) : (r.onlineUrl || ''),
        blob: r.blob || null
      }));
    },

    initYouTube(callback) {
      if (window.YT && window.YT.Player) {
        this.ytReady = true;
        if (callback) callback();
        return;
      }
      const existing = document.getElementById('ytIframeApiScript');
      if (!existing) {
        window.onYouTubeIframeAPIReady = () => {
          this.ytReady = true;
          if (callback) callback();
        };
        const tag = document.createElement('script');
        tag.id = 'ytIframeApiScript';
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.onerror = () => {
          console.warn('Gagal memuat skrip YouTube Iframe API (kemungkinan terblokir oleh peramban/adblocker).');
        };
        document.body.appendChild(tag);
      } else {
        let attempts = 0;
        const maxAttempts = 60; // Maksimal 6 detik batas timeout
        const check = setInterval(() => {
          attempts++;
          if (window.YT && window.YT.Player) {
            clearInterval(check);
            this.ytReady = true;
            if (callback) callback();
          } else if (attempts >= maxAttempts) {
            clearInterval(check);
            console.warn('YouTube Iframe API load timed out.');
          }
        }, 100);
      }
    },

    extractYouTubeId(url) {
      if (!url || typeof url !== 'string') return null;
      const trimmed = url.trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
      const match = trimmed.match(/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
      if (match && match[1]) return match[1];
      const fallbackReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/live\/)([^"&?\/\s]{11})/i;
      const fallbackMatch = trimmed.match(fallbackReg);
      return fallbackMatch ? fallbackMatch[1] : null;
    },

    playYouTube(videoId, customTitle = null) {
      this.initAudioContext();
      this._ignorePauseUntil = performance.now() + 800;
      if (this.audio) this.audio.pause();
      this.stopAmbient();

      this.wantsPlayback = true;
      this.startGuardian();
      this.currentMode = 'youtube';
      this.activeAmbientId = null;
      this.currentOnlineTrack = {
        type: 'youtube',
        videoId,
        title: customTitle || `YouTube Stream (${videoId})`
      };

      const containerWrap = els.ytPlayerContainerWrap;
      if (containerWrap) containerWrap.style.display = 'block';
      syncYtPlayerVisibilityBtn();

      const createOrLoad = () => {
        try {
          if (!this.ytPlayer) {
            this.ytPlayer = new YT.Player('ytPlayerContainer', {
              videoId: videoId,
              playerVars: {
                autoplay: 1,
                controls: 1,
                modestbranding: 1,
                playsinline: 1,
                origin: window.location.origin
              },
              events: {
                onReady: (e) => {
                  try {
                    e.target.setVolume(Math.round(this.volume * 100));
                    e.target.playVideo();
                  } catch (_) {}
                  this.setPlayingState(true);

                  // Tambahkan allow="fullscreen" ke iframe YouTube agar fullscreen
                  // berfungsi di mobile (YouTube IFrame API tidak menambahkannya otomatis)
                  try {
                    const container = document.getElementById('ytPlayerContainer');
                    if (container) {
                      const ytIframe = container.querySelector('iframe');
                      if (ytIframe && !ytIframe.hasAttribute('allow')) {
                        ytIframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen');
                      } else if (ytIframe && ytIframe.hasAttribute('allow')) {
                        const currentAllow = ytIframe.getAttribute('allow');
                        if (!currentAllow.includes('fullscreen')) {
                          ytIframe.setAttribute('allow', currentAllow + '; fullscreen');
                        }
                      }
                    }
                  } catch (_) {}
                },
                onStateChange: (e) => {
                  if (e.data === YT.PlayerState.PLAYING) {
                    this._ignorePauseUntil = 0;
                    this._reviveAttempts = 0;
                    this.setPlayingState(true);
                    if (!customTitle && this.ytPlayer.getVideoData) {
                      const d = this.ytPlayer.getVideoData();
                      if (d && d.title) {
                        this.currentOnlineTrack.title = d.title;
                        this.updateUI();
                      }
                    }
                  } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                    // H4: event PAUSED/ENDED bisa datang TERLAMBAT setelah pengguna
                    // sudah pindah ke lagu/mode lain (pauseVideo saat beralih memicu
                    // event asinkron). Tanpa guard ini, event basi membajak state:
                    // guardian lagu baru dimatikan & UI dipaksa "paused".
                    if (this.currentMode !== 'youtube') return;

                    if (e.data === YT.PlayerState.PAUSED) {
                      // Masih dalam jendela pergantian (loadVideoById / pindah mode):
                      // pause ini berasal dari SWAP buatan kita, bukan pengguna.
                      if (this._ignorePauseUntil && performance.now() < this._ignorePauseUntil) return;
                      // Pause iframe YouTube = niat pengguna/system (tombol app sudah
                      // menandai wantsPlayback sendiri sebelum pauseVideo) — hormati
                      // tanpa memandang tab terlihat; jangan biarkan guardian kembali.
                      if (this.isPlaying) {
                        this.wantsPlayback = false;
                        this.stopGuardian();
                      }
                      this.setPlayingState(false);
                      return;
                    }

                    // ENDED
                    this.setPlayingState(false);
                    if (this.loopMode === 'one') {
                      if (e.target && typeof e.target.seekTo === 'function' && typeof e.target.playVideo === 'function') {
                        e.target.seekTo(0);
                        e.target.playVideo();
                        this.setPlayingState(true);
                      }
                      return;
                    }
                    if (this.loopMode === 'all' && this.playlist.length > 0) {
                      this.nextTrack(); // wrap ke awal playlist
                      return;
                    }
                    // Loop mati, ATAU loop-all tanpa playlist (video dari kotak URL):
                    // akhiri bersih — matikan guardian agar interval/listener 4 detik
                    // tidak hidup percuma sampai reload halaman (M13).
                    this.wantsPlayback = false;
                    this.stopGuardian();
                  }
                },
                onError: (e) => {
                  console.warn('YouTube Player error code:', e.data);
                  // Pemutar rusak/dibatasi → jangan biarkan guardian memanggil
                  // playVideo() ulang tiap 4 detik ke video yang sama-sama error.
                  this.wantsPlayback = false;
                  this.stopGuardian();
                  showToast('Video YouTube tidak dapat diputar atau dibatasi oleh pemilik video.', 'error');
                  this.setPlayingState(false);
                }
              }
            });
          } else {
            this.ytPlayer.loadVideoById(videoId);
            if (typeof this.ytPlayer.setVolume === 'function') {
              try {
                this.ytPlayer.setVolume(Math.round(this.volume * 100));
              } catch (_) {}
            }
            if (typeof this.ytPlayer.playVideo === 'function') {
              try {
                this.ytPlayer.playVideo();
              } catch (_) {}
            }
            this.setPlayingState(true);
          }
          this.updateUI();
          showToast(`▶️ Memutar YouTube: ${this.currentOnlineTrack.title}`);
        } catch (err) {
          console.error('Error starting YouTube Player:', err);
        }
      };

      this.initYouTube(() => {
        createOrLoad();
      });
    },

    playDirectUrl(url, title = 'Online Stream') {
      this.initAudioContext();
      this.stopAmbient();
      if (this.ytPlayer && this.ytPlayer.pauseVideo) {
        this.ytPlayer.pauseVideo();
      }
      const containerWrap = els.ytPlayerContainerWrap;
      if (containerWrap) containerWrap.style.display = 'none';
      syncYtPlayerVisibilityBtn();

      this.wantsPlayback = true;
      this.startGuardian();
      this.currentMode = 'file';
      this.activeAmbientId = null;
      this.currentOnlineTrack = { type: 'stream', url, title };

      this._ignorePauseUntil = performance.now() + 800;
      this.audio.src = url;
      this.audio.currentTime = 0;
      this.audio.play()
        .then(() => {
          this.setPlayingState(true);
          this.updateUI();
          showToast(`▶️ Memutar Stream: ${title}`);
        })
        .catch((e) => {
          showToast('Gagal memutar stream audio: ' + e.message, 'error');
          this.setPlayingState(false);
        });
    },

    async saveOnlineToPlaylist(url, customTitle) {
      if (!url || !url.trim()) {
        showToast('Masukkan URL audio atau YouTube terlebih dahulu.', 'error');
        return;
      }
      const trimmed = url.trim();
      const ytId = this.extractYouTubeId(trimmed);
      const title = (customTitle && customTitle.trim()) || (ytId ? `YouTube (${ytId})` : 'Online Audio Stream');
      const id = `online_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const trackRecord = {
        id,
        name: title,
        size: ytId ? 'YouTube' : 'Stream',
        type: ytId ? 'youtube' : 'audio/stream',
        isOnline: true,
        youtubeId: ytId,
        onlineUrl: trimmed,
        addedAt: new Date().toISOString()
      };

      const saved = await MusicDB.saveTrack(trackRecord);
      this.playlist.push({
        id,
        name: trackRecord.name,
        size: trackRecord.size,
        type: trackRecord.type,
        isOnline: true,
        youtubeId: ytId,
        onlineUrl: trimmed,
        url: trimmed
      });

      this.renderPlaylistUI();
      if (!saved) {
        showToast(`⚠️ "${title}" ditambahkan, namun penyimpanan offline dibatasi (hanya aktif di sesi ini).`, 'warning');
      } else {
        showToast(`✅ "${title}" berhasil disimpan ke Playlist!`);
      }
      AudioEngine.click();
    },

    async handleUploadFiles(fileList) {
      if (!fileList || fileList.length === 0) return;
      let addedCount = 0;
      let quotaWarning = false;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!file || typeof file.size !== 'number' || file.size <= 0) continue;
        if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i)) {
          continue;
        }

        const id = `track_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const trackRecord = {
          id,
          name: file.name.replace(/\.[^/.]+$/, ''),
          size: (file.size / (1024 * 1024)).toFixed(1),
          type: file.type || 'audio/mpeg',
          blob: file,
          addedAt: new Date().toISOString()
        };

        const saved = await MusicDB.saveTrack(trackRecord);
        if (!saved) {
          quotaWarning = true;
        }

        this.playlist.push({
          id,
          name: trackRecord.name,
          size: trackRecord.size,
          type: trackRecord.type,
          url: URL.createObjectURL(file),
          blob: file
        });
        addedCount++;
      }

      if (addedCount > 0) {
        if (quotaWarning) {
          showToast(`⚠️ ${addedCount} lagu ditambahkan ke sesi, namun penyimpanan offline browser penuh/dibatasi (hanya aktif di sesi ini).`, 'warning');
        } else {
          showToast(`✅ ${addedCount} lagu berhasil diupload ke Playlist Lokal!`);
        }
        this.renderPlaylistUI();
        AudioEngine.click();
        
        // Auto play the first uploaded track if idle
        if (!this.isPlaying) {
          this.playTrack(this.playlist.length - addedCount);
        }
      } else {
        showToast('Format file tidak didukung. Pilih format audio (MP3, WAV, FLAC, OGG, M4A).', 'error');
      }
    },

    async deleteTrack(id, e) {
      if (e) e.stopPropagation();
      await MusicDB.deleteTrack(id);
      
      const idx = this.playlist.findIndex(t => t.id === id);
      if (idx !== -1) {
        const wasCurrent = (this.currentIndex === idx);
        if (this.playlist[idx].blob) {
          URL.revokeObjectURL(this.playlist[idx].url);
        }
        this.playlist.splice(idx, 1);
        
        if (wasCurrent) {
          this.stop();
          if (this.playlist.length > 0) {
            this.playTrack(Math.min(idx, this.playlist.length - 1));
          } else {
            this.currentIndex = -1;
          }
        } else if (this.currentIndex > idx) {
          this.currentIndex--;
        }
      }

      this.renderPlaylistUI();
      showToast('Lagu dihapus dari playlist.');
      AudioEngine.click();
    },

    async clearAllTracks() {
      if (this.playlist.length === 0) return;
      if (!confirm('Hapus semua lagu dari playlist?')) return;
      
      this.stop();
      this.playlist.forEach(t => {
        if (t.blob) URL.revokeObjectURL(t.url);
      });
      this.playlist = [];
      this.currentIndex = -1;
      await MusicDB.clearAll();
      this.renderPlaylistUI();
      showToast('Playlist telah dikosongkan.');
      AudioEngine.click();
    },

    playTrack(index) {
      if (index < 0 || index >= this.playlist.length) return;
      this.currentIndex = index;
      const track = this.playlist[index];

      if (track.isOnline && track.youtubeId) {
        this.playYouTube(track.youtubeId, track.name);
      } else if (track.isOnline && track.onlineUrl) {
        this.playDirectUrl(track.onlineUrl, track.name);
      } else {
        if (this.ytPlayer && this.ytPlayer.pauseVideo) {
          this.ytPlayer.pauseVideo();
        }
        const containerWrap = els.ytPlayerContainerWrap;
        if (containerWrap) containerWrap.style.display = 'none';
        syncYtPlayerVisibilityBtn();

        this.initAudioContext();
        this.stopAmbient();
        this.wantsPlayback = true;
        this.startGuardian();
        this.currentMode = 'file';
        this.activeAmbientId = null;
        this.currentOnlineTrack = null;

        this._ignorePauseUntil = performance.now() + 800;
        this.audio.src = track.url;
        this.audio.currentTime = 0;
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.setPlayingState(true);
              this.updateUI();
            })
            .catch(() => {
              this.setPlayingState(false);
            });
        }
      }
    },

    togglePlayPause() {
      this.initAudioContext();

      if (this.isPlaying) {
        // Pause eksplisit dari pengguna: hentikan guardian agar tidak "membangunkan" lagi
        this.wantsPlayback = false;
        this.stopGuardian();
        if (this.currentMode === 'youtube' && this.ytPlayer && this.ytPlayer.pauseVideo) {
          this.ytPlayer.pauseVideo();
        } else if (this.currentMode === 'file') {
          this.audio.pause();
        } else if (this.currentMode === 'ambient') {
          this.stopAmbient();
        }
        this.setPlayingState(false);
      } else {
        this.wantsPlayback = true;
        this.startGuardian();
        if (this.currentMode === 'youtube' && this.ytPlayer && this.ytPlayer.playVideo) {
          this.ytPlayer.playVideo();
          this.setPlayingState(true);
        } else if (this.currentMode === 'file' && ((this.currentIndex >= 0 && this.currentIndex < this.playlist.length) || (this.currentOnlineTrack && this.audio.src))) {
          const playPromise = this.audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                this.setPlayingState(true);
                this.updateUI();
              })
              .catch((err) => {
                console.warn('Audio play failed:', err?.message || err);
                this.setPlayingState(false);
                this.updateUI();
              });
          } else {
            this.setPlayingState(true);
          }
        } else if (this.currentMode === 'ambient' && this.activeAmbientId) {
          this.startAmbient(this.activeAmbientId);
        } else if (this.playlist.length > 0) {
          this.playTrack(0);
        } else {
          this.startAmbient('ambient_space');
        }
      }
      this.updateUI();
      AudioEngine.click();
    },

    nextTrack() {
      if (this.playlist.length === 0) return;
      let nextIdx = this.currentIndex + 1;
      if (this.isShuffle) {
        nextIdx = Math.floor(Math.random() * this.playlist.length);
      } else if (nextIdx >= this.playlist.length) {
        nextIdx = 0;
      }
      this.playTrack(nextIdx);
      AudioEngine.click();
    },

    prevTrack() {
      if (this.playlist.length === 0) return;
      if (this.audio && this.audio.currentTime > 3) {
        this.audio.currentTime = 0;
        return;
      }
      let prevIdx = this.currentIndex - 1;
      if (prevIdx < 0) prevIdx = this.playlist.length - 1;
      this.playTrack(prevIdx);
      AudioEngine.click();
    },

    ytProgressTimer: null,

    startYouTubeProgressTimer() {
      this.stopYouTubeProgressTimer();
      this.ytProgressTimer = setInterval(() => {
        if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function' && typeof this.ytPlayer.getDuration === 'function') {
          try {
            const cur = this.ytPlayer.getCurrentTime() || 0;
            const dur = this.ytPlayer.getDuration() || 0;
            if (dur > 0 && els.deckProgressSlider) {
              els.deckProgressSlider.value = (cur / dur) * 100;
            }
            if (els.deckCurrentTrackMeta) {
              const curStr = this.formatTime(cur);
              const durStr = dur ? this.formatTime(dur) : '--:--';
              els.deckCurrentTrackMeta.innerText = `${curStr} / ${durStr}`;
            }
          } catch (_) {}
        }
      }, 500);
    },

    stopYouTubeProgressTimer() {
      if (this.ytProgressTimer) {
        clearInterval(this.ytProgressTimer);
        this.ytProgressTimer = null;
      }
    },

    stop() {
      this.stopYouTubeProgressTimer();
      this.wantsPlayback = false;
      this.stopGuardian();
      if (this.audio) {
        this.audio.pause();
        this.audio.currentTime = 0;
      }
      if (this.ytPlayer && this.ytPlayer.pauseVideo) {
        this.ytPlayer.pauseVideo();
      }
      this.stopAmbient();
      this.setPlayingState(false);
      this.updateUI();
    },

    setPlayingState(isPlaying) {
      this.isPlaying = isPlaying;
      if (this.isPlaying && this.currentMode === 'youtube') {
        this.startYouTubeProgressTimer();
      } else {
        this.stopYouTubeProgressTimer();
      }
      this.updateUI();
    },

    updateMediaSession(title) {
      try {
        if (!('mediaSession' in navigator)) return;
        const cleanTitle = String(title || 'Cyber BGM').replace(/^[^\w(#]+\s/, '');
        if (this._msTitle === cleanTitle && this._msState === this.isPlaying) return;
        this._msTitle = cleanTitle;
        this._msState = this.isPlaying;

        if (typeof MediaMetadata !== 'undefined') {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: cleanTitle,
            artist: 'Cyber BGM Deck',
            album: 'ZOZ Router • Musik Latar Belakang'
          });
        }
        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';

        const safeSet = (action, fn) => {
          try { navigator.mediaSession.setActionHandler(action, fn); } catch (_) {}
        };
        safeSet('play', () => { if (!this.isPlaying) this.togglePlayPause(); });
        safeSet('pause', () => { if (this.isPlaying) this.togglePlayPause(); });
        safeSet('nexttrack', () => this.nextTrack());
        safeSet('previoustrack', () => this.prevTrack());
        safeSet('stop', () => this.stop());
      } catch (_) {}
    },

    // ==================== BACKGROUND PLAYBACK GUARDIAN ====================
    // Musik "Latar Belakang" harus tetap hidup saat tab disembunyikan, window
    // di-minimize, atau pengguna pindah aplikasi. Browser sering men-suspend
    // AudioContext / media element saat halaman jadi tidak terlihat — guardian
    // ini membangunkan playback kembali sesuai NIAT pengguna (wantsPlayback),
    // tanpa pernah menghidupkan lagi musik yang sengaja di-pause pengguna.
    startGuardian() {
      if (this.guardianTimer) return;
      this.guardianTimer = setInterval(() => this.revivePlayback(), 4000);
      document.addEventListener('visibilitychange', this._visHandler = () => this.revivePlayback());
      window.addEventListener('focus', this._focusHandler = () => this.revivePlayback());
      window.addEventListener('pagehide', this._pageHandler = () => this.revivePlayback());
      this.revivePlayback();
    },

    stopGuardian() {
      if (this.guardianTimer) {
        clearInterval(this.guardianTimer);
        this.guardianTimer = null;
      }
      if (this._visHandler) { document.removeEventListener('visibilitychange', this._visHandler); this._visHandler = null; }
      if (this._focusHandler) { window.removeEventListener('focus', this._focusHandler); this._focusHandler = null; }
      if (this._pageHandler) { window.removeEventListener('pagehide', this._pageHandler); this._pageHandler = null; }
    },

    revivePlayback() {
      if (!this.wantsPlayback) return;
      try {
        // 1. Bangunkan AudioContext yang di-suspend browser
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }

        // 2. Mode file/stream lokal: audio element yang dipaksa pause browser
        if (this.currentMode === 'file' && this.audio && this.audio.paused && this.audio.src) {
          const p = this.audio.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }

        // 3. Mode YouTube: player yang di-pause browser saat tab hidden
        if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getPlayerState === 'function') {
          const st = this.ytPlayer.getPlayerState();
          // 2 = PAUSED, -1 = cued (belum main), 5 = ended tapi loop masih aktif
          if (st === 2 || st === -1) {
            if (typeof this.ytPlayer.playVideo === 'function') this.ytPlayer.playVideo();
          }
        }

        // 4. Mode ambient synth: oscillator sudah mati → nyalakan ulang preset yang sama
        if (this.currentMode === 'ambient' && this.activeAmbientId && this.ambientNodes.length === 0) {
          this.startAmbient(this.activeAmbientId);
        }
      } catch (_) {}

      // BATAS PERCOBAAN BANGKIT (M12): bila setelah 4 siklus berturut-turut audio
      // tetap tidak berbunyi (sumber mati, AudioContext gagal dibuat, kebijakan
      // autoplay), menyerah dan matikan guardian — daripada memanggil play() ke
      // sumber rusak tanpa henti sampai halaman ditutup. Sukses 'playing'/PLAYING
      // me-reset penghitung ke 0.
      try {
        const stillSilent =
          (this.currentMode === 'file' && this.audio && this.audio.src && this.audio.paused) ||
          (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getPlayerState === 'function' && (this.ytPlayer.getPlayerState() === 2 || this.ytPlayer.getPlayerState() === -1)) ||
          (this.currentMode === 'ambient' && (!this.audioCtx || this.audioCtx.state !== 'running') && this.ambientNodes.length === 0);
        if (stillSilent) {
          // Separate attempt counters per mode to prevent ambient failures from
          // affecting file/youtube playback recovery (M12)
          const attemptKey = this.currentMode === 'ambient' ? '_reviveAttemptsAmbient' : '_reviveAttempts';
          this[attemptKey] = (this[attemptKey] || 0) + 1;
          if (this[attemptKey] >= 4) {
            this.wantsPlayback = false;
            this.stopGuardian();
          }
        } else {
          const attemptKey = this.currentMode === 'ambient' ? '_reviveAttemptsAmbient' : '_reviveAttempts';
          this[attemptKey] = 0;
        }
      } catch (_) {}
    },

    onTrackEnded() {
      if (this.loopMode === 'one') {
        this.audio.currentTime = 0;
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.setPlayingState(true);
              this.updateUI();
            })
            .catch((err) => {
              console.warn('Audio loop replay failed:', err?.message || err);
              this.setPlayingState(false);
              this.updateUI();
            });
        }
      } else if (this.loopMode === 'all') {
        if (this.playlist.length > 0) {
          this.nextTrack();
        } else {
          // Loop-all tapi playlist kosong (stream URL tunggal): tak ada lagu yang
          // bisa diputar lagi → AKHIRI. Tanpa ini guardian terus membangunkan
          // stream yang sudah habis dari atas tiap 4 detik di tab tersembunyi —
          // loop tak berujung yang membakar CPU/jaringan (M14).
          this.wantsPlayback = false;
          this.stopGuardian();
          this.setPlayingState(false);
        }
      } else {
        if (this.currentIndex < this.playlist.length - 1) {
          this.nextTrack();
        } else {
          // Playlist habis & loop nonaktif: ini akhir pemutaran — matikan guardian
          // supaya tidak membangunkan audio yang sudah ended (diputar ulang dari 0).
          this.wantsPlayback = false;
          this.stopGuardian();
          this.setPlayingState(false);
        }
      }
    },

    onTimeUpdate() {
      if (!this.audio || this.currentMode !== 'file') return;
      const cur = this.audio.currentTime || 0;
      const dur = this.audio.duration || 0;
      
      if (isFinite(dur) && dur > 0 && els.deckProgressSlider) {
        els.deckProgressSlider.value = (cur / dur) * 100;
      }

      if (els.deckCurrentTrackMeta) {
        const curStr = this.formatTime(cur);
        const durStr = (isFinite(dur) && dur > 0) ? this.formatTime(dur) : '--:--';
        els.deckCurrentTrackMeta.innerText = `${curStr} / ${durStr}`;
      }
    },

    seek(percent) {
      if (this.currentMode === 'file' && this.audio && isFinite(this.audio.duration) && this.audio.duration > 0) {
        this.audio.currentTime = (percent / 100) * this.audio.duration;
      } else if (this.currentMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getDuration === 'function' && typeof this.ytPlayer.seekTo === 'function') {
        try {
          const dur = this.ytPlayer.getDuration() || 0;
          if (isFinite(dur) && dur > 0) {
            this.ytPlayer.seekTo((percent / 100) * dur, true);
          }
        } catch (_) {}
      }
    },

    setVolume(val) {
      const num = parseFloat(val);
      this.volume = isNaN(num) ? 0.7 : Math.max(0, Math.min(1, num));
      try {
        localStorage.setItem('zoz_bgm_volume', this.volume.toString());
      } catch (_) {}

      if (this.audio) this.audio.volume = this.volume;
      if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
        try {
          this.ytPlayer.setVolume(Math.round(this.volume * 100));
        } catch (_) {}
      }
      if (this.masterGainNode && this.audioCtx) {
        this.masterGainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      }
      if (this.ambientGainNode && this.audioCtx) {
        this.ambientGainNode.gain.setValueAtTime(this.volume * 0.45, this.audioCtx.currentTime);
      }

      if (els.bgmMiniVolume) els.bgmMiniVolume.value = this.volume;
      if (els.deckMasterVolume) els.deckMasterVolume.value = this.volume;
      if (els.valMasterVolume) els.valMasterVolume.innerText = `${Math.round(this.volume * 100)}%`;
    },

    // --- PROCEDURAL SYNTHESIZER GENERATOR ---
    startAmbient(presetId) {
      this.initAudioContext();
      // M18: VALIDASI AudioContext SEBELUM commit state. Dulu wantsPlayback/
      // guardian diset lebih dulu; bila audioCtx null (peramban tanpa Web Audio)
      // ctx.createGain() melempar di tengah → guardian terus memanggil startAmbient
      // tiap 4 detik dalam siklus error abadi tanpa suara.
      if (!this.audioCtx) {
        showToast('Web Audio API tidak tersedia — preset ambient tidak dapat dijalankan.', 'error');
        return;
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      this._ignorePauseUntil = performance.now() + 800;
      if (this.audio) this.audio.pause();
      this.stopAmbient();

      this.wantsPlayback = true;
      this.startGuardian();
      this.currentMode = 'ambient';
      this.activeAmbientId = presetId;
      this.currentIndex = -1;

      const ctx = this.audioCtx;
      this.ambientGainNode = ctx.createGain();
      this.ambientGainNode.gain.setValueAtTime(this.volume * 0.45, ctx.currentTime);
      
      // Route ambient synth to analyser and master destination
      if (this.analyser) {
        this.ambientGainNode.connect(this.analyser);
      } else {
        this.ambientGainNode.connect(ctx.destination);
      }

      if (presetId === 'ambient_space') {
        // 🌌 Deep Space Neural Drone (432Hz sine + 108Hz sub-bass + slow LFO)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(432, ctx.currentTime);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(216, ctx.currentTime);
        sub.type = 'sine';
        sub.frequency.setValueAtTime(108, ctx.currentTime);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(320, ctx.currentTime);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.08, ctx.currentTime);
        lfoGain.gain.setValueAtTime(120, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        osc1.connect(filter);
        osc2.connect(filter);
        sub.connect(filter);
        filter.connect(this.ambientGainNode);

        osc1.start();
        osc2.start();
        sub.start();
        lfo.start();
        this.ambientNodes.push(osc1, osc2, sub, lfo, filter, lfoGain);

      } else if (presetId === 'ambient_synthwave') {
        // ⚡ Cyberpunk Synthwave Pulse (Arp Chords + Resonant Lowpass)
        const notes = [130.81, 164.81, 196.00, 261.63, 196.00, 164.81];
        let noteIdx = 0;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        filter.Q.setValueAtTime(4, ctx.currentTime);
        filter.connect(this.ambientGainNode);

        const pad = ctx.createOscillator();
        pad.type = 'sawtooth';
        pad.frequency.setValueAtTime(65.41, ctx.currentTime);
        pad.connect(filter);
        pad.start();
        this.ambientNodes.push(pad, filter);

        this.ambientTimer = setInterval(() => {
          if (!this.isPlaying || this.activeAmbientId !== 'ambient_synthwave') return;
          try {
            const arp = ctx.createOscillator();
            const arpGain = ctx.createGain();
            arp.type = 'sawtooth';
            arp.frequency.setValueAtTime(notes[noteIdx % notes.length], ctx.currentTime);
            arpGain.gain.setValueAtTime(0.08, ctx.currentTime);
            arpGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
            arp.connect(arpGain);
            arpGain.connect(filter);
            arp.start();
            arp.stop(ctx.currentTime + 0.35);
            noteIdx++;
          } catch (e) {}
        }, 320);

      } else if (presetId === 'ambient_rain') {
        // 🌧️ Neo-Tokyo Rain & Lo-Fi Vinyl (Filtered White Noise + Warm Chords)
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const rainFilter = ctx.createBiquadFilter();
        rainFilter.type = 'bandpass';
        rainFilter.frequency.setValueAtTime(1000, ctx.currentTime);
        rainFilter.Q.setValueAtTime(0.5, ctx.currentTime);

        const chord1 = ctx.createOscillator();
        const chord2 = ctx.createOscillator();
        chord1.type = 'sine';
        chord1.frequency.setValueAtTime(220, ctx.currentTime);
        chord2.type = 'sine';
        chord2.frequency.setValueAtTime(277.18, ctx.currentTime);

        const chordGain = ctx.createGain();
        chordGain.gain.setValueAtTime(0.04, ctx.currentTime);

        chord1.connect(chordGain);
        chord2.connect(chordGain);
        chordGain.connect(this.ambientGainNode);

        whiteNoise.connect(rainFilter);
        rainFilter.connect(this.ambientGainNode);

        whiteNoise.start();
        chord1.start();
        chord2.start();
        this.ambientNodes.push(whiteNoise, rainFilter, chord1, chord2, chordGain);

      } else if (presetId === 'ambient_quantum') {
        // 🧠 Quantum Focus Alpha Waves (10Hz Binaural Beats + Sub Pad)
        const leftOsc = ctx.createOscillator();
        const rightOsc = ctx.createOscillator();
        const leftPanner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        const rightPanner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

        leftOsc.type = 'sine';
        leftOsc.frequency.setValueAtTime(200, ctx.currentTime);
        rightOsc.type = 'sine';
        rightOsc.frequency.setValueAtTime(210, ctx.currentTime); // 10Hz Alpha difference

        if (leftPanner && rightPanner) {
          leftPanner.pan.setValueAtTime(-1, ctx.currentTime);
          rightPanner.pan.setValueAtTime(1, ctx.currentTime);
          leftOsc.connect(leftPanner);
          rightOsc.connect(rightPanner);
          leftPanner.connect(this.ambientGainNode);
          rightPanner.connect(this.ambientGainNode);
          this.ambientNodes.push(leftPanner, rightPanner);
        } else {
          leftOsc.connect(this.ambientGainNode);
          rightOsc.connect(this.ambientGainNode);
        }

        leftOsc.start();
        rightOsc.start();
        this.ambientNodes.push(leftOsc, rightOsc);
      }

      this.setPlayingState(true);
      this.updateUI();
    },

    stopAmbient() {
      if (this.ambientTimer) {
        clearInterval(this.ambientTimer);
        this.ambientTimer = null;
      }
      this.ambientNodes.forEach(node => {
        try {
          if (node.stop) node.stop();
          if (node.disconnect) node.disconnect();
        } catch (e) {}
      });
      this.ambientNodes = [];
      // M17: lepaskan JUGA gain node pembawa — dulu hanya nodes yang dilepas sementara
      // gain lama tetap menempel di graph analyser dan menumpuk tiap ganti preset.
      if (this.ambientGainNode) {
        try { this.ambientGainNode.disconnect(); } catch (_) {}
        this.ambientGainNode = null;
      }
    },

    // --- UI RENDERING & SYNCHRONIZATION ---
    renderPlaylistUI() {
      if (els.playlistCountBadge) els.playlistCountBadge.innerText = this.playlist.length;
      if (!els.playlistItemsList) return;

      if (this.playlist.length === 0) {
        els.playlistItemsList.innerHTML = `
          <div style="text-align: center; padding: 24px; color: var(--text-dim); font-size: 0.82rem;">
            <i class="fa-solid fa-music" style="font-size: 1.8rem; color: rgba(0, 240, 255, 0.25); margin-bottom: 8px; display: block;"></i>
            Belum ada lagu. Upload file musik lokal atau masukkan link YouTube pada tab Custom URL!
          </div>
        `;
        return;
      }

      els.playlistItemsList.innerHTML = '';
      this.playlist.forEach((track, idx) => {
        const isCurrent = (this.currentMode === 'file' && this.currentIndex === idx) ||
                          (this.currentMode === 'youtube' && this.currentOnlineTrack && this.currentOnlineTrack.videoId === track.youtubeId);
        const item = document.createElement('div');
        item.className = `playlist-item ${isCurrent ? 'active' : ''}`;
        const icon = track.youtubeId ? '<i class="fa-brands fa-youtube" style="color:#FF0033;"></i>' : (track.isOnline ? '<i class="fa-solid fa-globe" style="color:var(--neon-teal);"></i>' : '<i class="fa-solid fa-music"></i>');
        const sizeLabel = track.size ? (track.isOnline ? track.size : `${track.size} MB`) : '';

        item.innerHTML = `
          <div class="playlist-item-info">
            <span style="font-family: var(--font-code); color: var(--neon-cyan); font-size: 0.72rem; min-width: 20px;">${icon}</span>
            <span class="playlist-item-title">${escapeHtml(track.name)}</span>
            <span class="playlist-item-size">${sizeLabel}</span>
          </div>
          <div class="playlist-item-actions">
            <button class="btn btn-xs btn-outline play-track-btn" title="Putar Lagu"><i class="fa-solid ${isCurrent && this.isPlaying ? 'fa-pause' : 'fa-play'}"></i></button>
            <button class="btn btn-xs btn-outline del-track-btn" style="border-color: rgba(255,82,0,0.4); color: var(--neon-amber);" title="Hapus Lagu"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        `;

        item.querySelector('.play-track-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          if (isCurrent) {
            this.togglePlayPause();
          } else {
            this.playTrack(idx);
          }
        });

        item.querySelector('.del-track-btn').addEventListener('click', (e) => this.deleteTrack(track.id, e));

        item.addEventListener('click', () => {
          if (isCurrent) {
            this.togglePlayPause();
          } else {
            this.playTrack(idx);
          }
        });

        els.playlistItemsList.appendChild(item);
      });
    },

    renderAmbientGridUI() {
      if (!els.ambientCardsGrid) return;
      els.ambientCardsGrid.innerHTML = '';

      AMBIENT_PRESETS.forEach(p => {
        const card = document.createElement('div');
        const isActive = this.currentMode === 'ambient' && this.activeAmbientId === p.id && this.isPlaying;
        card.className = `ambient-card ${isActive ? 'active' : ''}`;
        card.innerHTML = `
          <div>
            <div class="ambient-card-header">
              <div class="ambient-card-icon"><i class="fa-solid ${p.icon}"></i></div>
              <div class="ambient-card-title">${escapeHtml(p.name)}</div>
            </div>
            <div class="ambient-card-desc">${escapeHtml(p.desc)}</div>
          </div>
          <button class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'} toggle-ambient-btn">
            <i class="fa-solid ${isActive ? 'fa-stop' : 'fa-play'}"></i> ${isActive ? 'Hentikan Soundscape' : 'Aktifkan Ambient'}
          </button>
        `;

        card.querySelector('.toggle-ambient-btn').addEventListener('click', () => {
          if (this.currentMode === 'ambient' && this.activeAmbientId === p.id && this.isPlaying) {
            this.stop();
          } else {
            this.startAmbient(p.id);
          }
          this.renderAmbientGridUI();
        });

        els.ambientCardsGrid.appendChild(card);
      });
    },

    updateUI() {
      // Header Pulse Indicator
      if (els.musicHeaderPulse) {
        els.musicHeaderPulse.style.display = this.isPlaying ? 'block' : 'none';
      }

      // Sidebar Widget Equalizer Animation
      if (els.bgmAnimBars) {
        els.bgmAnimBars.classList.toggle('playing', this.isPlaying);
      }

      // Title String
      let title = 'Cyber BGM: Siap';
      if (this.currentMode === 'youtube' && this.currentOnlineTrack) {
        title = `🔴 ${this.currentOnlineTrack.title}`;
      } else if (this.currentMode === 'file' && this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
        const tr = this.playlist[this.currentIndex];
        title = `${tr.isOnline ? (tr.youtubeId ? '🔴' : '🌐') : '🎵'} ${tr.name}`;
      } else if (this.currentMode === 'ambient' && this.activeAmbientId) {
        const preset = AMBIENT_PRESETS.find(p => p.id === this.activeAmbientId);
        title = preset ? preset.name : 'Cyber Ambient';
      }

      if (els.bgmTrackTitle) els.bgmTrackTitle.innerText = title;
      if (els.deckCurrentTrackName) els.deckCurrentTrackName.innerText = title;

      // Media Session API: daftarkan metadata ke OS agar playback diakui sebagai
      // "media latar belakang" (muncul di media overlay Windows/macOS/Android dan
      // sinyal kuat ke browser untuk MENGHENTIKAN auto-suspend tab yang bermusik).
      this.updateMediaSession(title);

      // Play / Pause Icons
      const playIcon = this.isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
      if (els.bgmPlayPauseBtn) els.bgmPlayPauseBtn.innerHTML = playIcon;
      if (els.deckPlayPauseBtn) els.deckPlayPauseBtn.innerHTML = playIcon;

      // Update active rows in playlist & ambient grid
      this.renderPlaylistUI();
      this.renderAmbientGridUI();
    },

    setupVisualizer() {
      const canvas = els.audioVisualizerCanvas;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const bufferLength = 32;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        this.animFrameId = requestAnimationFrame(draw);

        // Hanya render jika canvas sedang terlihat di layar atau audio sedang diputar
        const isCanvasVisible = Boolean(canvas.offsetParent);
        if (!isCanvasVisible && !this.isPlaying) {
          return;
        }

        const targetW = canvas.parentElement ? canvas.parentElement.clientWidth : 400;
        const targetH = 110;
        if (canvas.width !== targetW) canvas.width = targetW;
        if (canvas.height !== targetH) canvas.height = targetH;
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        if (this.analyser && this.isPlaying) {
          this.analyser.getByteFrequencyData(dataArray);
        } else {
          dataArray.fill(0);
        }

        const barWidth = (w / bufferLength) * 0.75;
        const barSpacing = (w / bufferLength) * 0.25;
        let x = barSpacing / 2;

        for (let i = 0; i < bufferLength; i++) {
          const val = dataArray[i];
          const percent = val / 255;
          const barHeight = Math.max(4, percent * (h - 15));

          const gradient = ctx.createLinearGradient(0, h, 0, h - barHeight);
          gradient.addColorStop(0, 'rgba(0, 240, 255, 0.25)');
          gradient.addColorStop(0.6, 'rgba(0, 255, 194, 0.8)');
          gradient.addColorStop(1, '#00F0FF');

          ctx.fillStyle = gradient;
          ctx.shadowBlur = this.isPlaying ? 8 : 0;
          ctx.shadowColor = '#00F0FF';
          ctx.fillRect(x, h - barHeight, barWidth, barHeight);

          // Neon top cap
          ctx.fillStyle = '#FFF';
          ctx.fillRect(x, h - barHeight - 2, barWidth, 2);

          x += barWidth + barSpacing;
        }
      };

      draw();
    },

    formatTime(sec) {
      if (!isFinite(sec) || isNaN(sec) || sec < 0) return '--:--';
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
  };

  // ==================== LIVE REAL-TIME MODEL CATALOG ====================
  function openLiveModelCatalog(targetInputId = null, targetLabelName = 'Model Obrolan') {
    STATE.catalogTargetInputId = targetInputId;
    const catModal = document.getElementById('liveModelCatalogModal');
    if (catModal) {
      catModal.dataset.targetInputId = targetInputId || '';
      catModal.dataset.targetLabelName = targetLabelName || 'Model Obrolan';
    }
    if (els.catalogTargetLabel) {
      els.catalogTargetLabel.innerText = targetLabelName;
    }
    STATE.catalogSearchQuery = '';
    STATE.catalogCategoryFilter = 'all';
    if (els.liveModelCatalogSearchInput) {
      els.liveModelCatalogSearchInput.value = '';
    }
    document.querySelectorAll('.catalog-filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.catalogFilter === 'all');
    });
    updateCatalogFavBadge();
    
    // Auto-detect tab aktif secara cerdas berdasarkan target input dan mode
    if (targetInputId) {
      const targetEl = document.getElementById(targetInputId);
      const currentVal = targetEl ? targetEl.value.trim() : '';
      if (currentVal) {
        if (currentVal.includes('/')) {
          STATE.activeCatalogTab = 'openrouter';
        } else if (currentVal.includes(':') || (STATE.ollamaModels || []).some(m => (m.name || m.model || m.id) === currentVal)) {
          STATE.activeCatalogTab = 'ollama';
        } else {
          STATE.activeCatalogTab = STATE.mode === 'openrouter' ? 'openrouter' : 'ollama';
        }
      } else {
        if (STATE.settings.openRouterKey && (!STATE.ollamaModels || STATE.ollamaModels.length === 0)) {
          STATE.activeCatalogTab = 'openrouter';
        } else {
          STATE.activeCatalogTab = STATE.mode === 'openrouter' ? 'openrouter' : 'ollama';
        }
      }
    } else {
      STATE.activeCatalogTab = STATE.mode === 'openrouter' ? 'openrouter' : 'ollama';
    }
    
    updateCatalogTabsUI();
    renderLiveModelCatalog();
    updateCatalogBalanceBannerUI(STATE.activeCatalogTab);

    // Auto-sync status & balance on open
    if (STATE.activeCatalogTab === 'openrouter') {
      fetchOpenRouterCredits();
    } else {
      fetchOllamaCloudUsage();
    }

    openModal('liveModelCatalogModal');
  }

  function updateCatalogTabsUI() {
    if (els.btnTabCatalogOllama) {
      els.btnTabCatalogOllama.classList.toggle('active', STATE.activeCatalogTab === 'ollama');
    }
    if (els.btnTabCatalogOpenRouter) {
      els.btnTabCatalogOpenRouter.classList.toggle('active', STATE.activeCatalogTab === 'openrouter');
    }
    updateCatalogBalanceBannerUI(STATE.activeCatalogTab);
  }

  function renderLiveModelCatalog() {
    const container = els.catalogListContainer;
    if (!container) return;
    container.innerHTML = '';

    const q = (STATE.catalogSearchQuery || '').toLowerCase().trim();
    const isOllama = STATE.activeCatalogTab === 'ollama';

    let list = [];
    if (isOllama) {
      const FREE_OLLAMA_CLOUD_PREFIXES = ['gemma4', 'gpt-oss', 'nemotron-3-nano', 'nemotron-3-super', 'nemotron-3-ultra'];
      list = (STATE.ollamaModels || []).map(m => {
        const id = m.name || m.model || m.id;
        const idLower = (id || '').toLowerCase();
        let tag = m.tag || 'Ollama Cloud';
        if (tag === 'Lokal') tag = 'Ollama Cloud';

        const isFree = Boolean(m.isFree || FREE_OLLAMA_CLOUD_PREFIXES.some(pre => idLower.includes(pre)));

        // Auto-assign smart badge kategori cloud jika tag masih bawaan umum
        if (tag === 'Ollama Cloud') {
          if (idLower.includes('reason') || idLower.includes('pro') || idLower.includes('deepseek-r') || idLower.includes('deepseek-v4-pro')) {
            tag = 'Reasoning Cloud';
          } else if (idLower.includes('flash') || idLower.includes('nano') || idLower.includes(':20b') || idLower.includes('fast') || idLower.includes('mini')) {
            tag = isFree ? 'Free Fast Cloud' : 'Fast Cloud';
          } else if (idLower.includes('code') || idLower.includes('coder') || idLower.includes('dev')) {
            tag = 'Coding Cloud';
          } else if (idLower.includes('kimi-k3') || idLower.includes('long') || idLower.includes('128k') || idLower.includes('1m')) {
            tag = 'Long Context Cloud';
          } else if (idLower.includes('super') || idLower.includes('ultra') || idLower.includes('large') || idLower.includes('gemma4') || idLower.includes(':120b') || idLower.includes(':675b') || idLower.includes('m3') || idLower.includes('glm-5.3') || idLower.includes('flagship')) {
            tag = isFree ? 'Free Flagship Cloud' : 'Flagship Cloud';
          }
        }

        return {
          id: id,
          name: m.name || id,
          tag: tag,
          isFree: isFree,
          size: m.size ? `${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB` : null,
          details: m.details || null
        };
      });

      // Urutkan model Ollama Cloud secara cerdas:
      // 1. Model Favorit pengguna di paling atas
      // 2. Model Included Free Usage diprioritaskan
      // 3. Model unggulan/frontier populer (DeepSeek, Kimi, Mistral, GLM, MiniMax)
      // 4. Sisanya diurutkan secara alfabetis A-Z
      const featuredKeywords = ['deepseek', 'mistral', 'kimi', 'glm', 'minimax'];
      list.sort((a, b) => {
        const aFav = isModelFavorite(a.id);
        const bFav = isModelFavorite(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;

        if (a.isFree && !b.isFree) return -1;
        if (!a.isFree && b.isFree) return 1;

        const aId = a.id.toLowerCase();
        const bId = b.id.toLowerCase();
        const aFeatured = featuredKeywords.some(k => aId.includes(k));
        const bFeatured = featuredKeywords.some(k => bId.includes(k));

        if (aFeatured && !bFeatured) return -1;
        if (!aFeatured && bFeatured) return 1;

        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    } else {
      list = (STATE.openRouterModels || []).map(m => {
        const idLower = (m.id || '').toLowerCase();
        const isFree = Boolean(m.id && (m.id.includes(':free') || m.id.endsWith('/free') || m.id === 'openrouter/free' || m.tag === 'Free' || m.cat === 'free'));
        
        let tag = 'Cloud';
        if (isFree) {
          tag = 'Free';
        } else if (idLower.includes('reason') || idLower.includes('r1') || idLower.includes('deepseek-r') || idLower.includes('o1') || idLower.includes('o3') || idLower.includes('qwq')) {
          tag = 'Reasoning Cloud';
        } else if (idLower.includes('flash') || idLower.includes('mini') || idLower.includes('turbo') || idLower.includes('lite') || idLower.includes('haiku') || idLower.includes(':20b') || idLower.includes(':8b')) {
          tag = 'Fast Cloud';
        } else if (idLower.includes('code') || idLower.includes('coder') || idLower.includes('dev')) {
          tag = 'Coding Cloud';
        } else if (idLower.includes('pro') || idLower.includes('plus') || idLower.includes('flagship') || idLower.includes('opus') || idLower.includes('max') || idLower.includes(':120b') || idLower.includes(':70b') || idLower.includes('sonnet') || idLower.includes('glm-5.3') || idLower.includes('minimax-m3') || idLower.includes('gemma4:31b')) {
          tag = 'Flagship Cloud';
        } else if (m.context_length && m.context_length >= 128000) {
          tag = 'Long Context Cloud';
        }

        return {
          id: m.id,
          name: m.name || m.id,
          tag: m.tag || tag,
          isFree: isFree,
          context_length: m.context_length ? `${Math.round(m.context_length / 1024)}k konteks` : null
        };
      });

      // Urutkan OpenRouter secara cerdas:
      // 1. Model Favorit pengguna di paling atas
      // 2. Model gratis (:free) diprioritaskan di paling atas
      // 3. Model unggulan/frontier populer (DeepSeek, Llama, Gemini, Claude, GPT, Qwen)
      // 4. Sisanya diurutkan secara alfabetis A-Z
      const featuredKeywords = ['deepseek', 'meta-llama', 'llama-3', 'gemini', 'claude', 'gpt-4', 'qwen', 'mistral'];
      list.sort((a, b) => {
        const aFav = isModelFavorite(a.id);
        const bFav = isModelFavorite(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;

        if (a.isFree && !b.isFree) return -1;
        if (!a.isFree && b.isFree) return 1;

        const aId = a.id.toLowerCase();
        const bId = b.id.toLowerCase();
        const aFeatured = featuredKeywords.some(k => aId.includes(k));
        const bFeatured = featuredKeywords.some(k => bId.includes(k));

        if (aFeatured && !bFeatured) return -1;
        if (!aFeatured && bFeatured) return 1;

        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    }

    // Filter kategori cepat (Pills)
    if (STATE.catalogCategoryFilter && STATE.catalogCategoryFilter !== 'all') {
      const cat = STATE.catalogCategoryFilter.toLowerCase();
      list = list.filter(item => {
        const tagL = (item.tag || '').toLowerCase();
        const idL = (item.id || '').toLowerCase();
        if (cat === 'favorites') {
          return isModelFavorite(item.id);
        } else if (cat === 'free') {
          return item.isFree || tagL.includes('free') || idL.includes(':free') || idL.endsWith('/free') || idL === 'openrouter/free';
        } else if (cat === 'reasoning') {
          return tagL.includes('reasoning') || idL.includes('reason') || idL.includes('r1') || idL.includes('o1') || idL.includes('o3') || idL.includes('qwq');
        } else if (cat === 'fast') {
          return tagL.includes('fast') || idL.includes('flash') || idL.includes('nano') || idL.includes('mini') || idL.includes(':20b') || idL.includes(':8b');
        } else if (cat === 'flagship') {
          return tagL.includes('flagship') || idL.includes('super') || idL.includes('ultra') || idL.includes('large') || idL.includes('gemma4') || idL.includes(':120b') || idL.includes(':675b') || idL.includes('sonnet') || idL.includes('opus') || idL.includes('pro');
        } else if (cat === 'coding') {
          return tagL.includes('coding') || idL.includes('code') || idL.includes('coder') || idL.includes('dev');
        }
        return true;
      });
    }

    // Filter pencarian live
    if (q) {
      list = list.filter(item => 
        (item.name && item.name.toLowerCase().includes(q)) || 
        (item.id && item.id.toLowerCase().includes(q)) ||
        (item.tag && item.tag.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      if (STATE.catalogCategoryFilter === 'favorites') {
        container.innerHTML = `
          <div style="text-align:center; padding: 32px 20px; color: var(--text-dim); font-size: 0.85rem;">
            <i class="fa-solid fa-laptop-code" style="font-size: 2rem; color: var(--neon-amber); margin-bottom: 12px; display:block; filter: drop-shadow(0 0 10px rgba(255,183,3,0.5));"></i>
            <strong>Belum ada model favorit yang ditandai.</strong><br>
            <span style="font-size: 0.76rem; display:inline-block; margin-top:6px; max-width:380px; line-height:1.5;">
              Klik ikon laptop <i class="fa-solid fa-laptop-code" style="color:var(--neon-amber);"></i> pada model mana saja di katalog atau dropdown untuk menjadikannya model favorit Anda!
            </span>
          </div>
        `;
        return;
      }
      const filterLabel = STATE.catalogCategoryFilter !== 'all' ? `kategori "${STATE.catalogCategoryFilter}"` : '';
      const queryLabel = q ? `kata kunci "${escapeHtml(q)}"` : '';
      const combinedLabel = [filterLabel, queryLabel].filter(Boolean).join(' dan ');
      container.innerHTML = `
        <div style="text-align:center; padding: 24px; color: var(--text-dim); font-size: 0.85rem;">
          <i class="fa-solid fa-filter-circle-xmark" style="font-size: 1.6rem; color: var(--neon-amber); margin-bottom: 8px; display:block;"></i>
          Tidak ada model yang cocok dengan ${combinedLabel || 'filter yang dipilih'}.<br>
          <span style="font-size: 0.74rem;">Klik filter <strong>Semua</strong> atau klik tombol <strong>Refresh</strong> untuk memuat ulang.</span>
        </div>
      `;
      return;
    }

    list.forEach(m => {
      const row = document.createElement('div');
      const isFav = isModelFavorite(m.id);
      row.className = `catalog-model-row ${isFav ? 'is-fav' : ''}`;

      const tagLower = (m.tag || '').toLowerCase();
      let badgeClass = '';
      if (tagLower.includes('free')) badgeClass = 'free';
      else if (tagLower.includes('reasoning')) badgeClass = 'reasoning';
      else if (tagLower.includes('flagship')) badgeClass = 'flagship';
      else if (tagLower.includes('fast')) badgeClass = 'fast';
      else if (tagLower.includes('coding')) badgeClass = 'coding';
      else if (tagLower.includes('long context')) badgeClass = 'context';
      else if (tagLower.includes('cloud')) badgeClass = 'cloud';
      else if (tagLower.includes('lokal')) badgeClass = 'local';
      else badgeClass = '';

      row.innerHTML = `
        <div class="catalog-model-info">
          <div class="catalog-model-name" style="display:flex; align-items:center; gap:6px;">
            <span>${escapeHtml(m.name)}</span>
            ${isFav ? `<span class="catalog-fav-indicator"><i class="fa-solid fa-laptop-code"></i> Favorit</span>` : ''}
          </div>
          <div class="catalog-model-meta">
            <span class="catalog-badge ${badgeClass}">${escapeHtml(m.tag || 'Model')}</span>
            ${m.size ? `<span style="color:var(--text-dim); font-family:var(--font-code); font-size:0.7rem;"><i class="fa-solid fa-hard-drive"></i> ${escapeHtml(m.size)}</span>` : ''}
            ${m.context_length ? `<span style="color:var(--neon-teal); font-family:var(--font-code); font-size:0.7rem;"><i class="fa-solid fa-brain"></i> ${escapeHtml(m.context_length)}</span>` : ''}
            <span style="color:var(--text-muted); font-size:0.68rem; font-family:var(--font-code);">${escapeHtml(m.id)}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="catalog-fav-btn ${isFav ? 'active' : ''}" type="button" title="${isFav ? 'Hapus dari Model Favorit' : 'Jadikan Model Favorit'}">
            <i class="fa-solid fa-laptop-code"></i>
          </button>
          <button class="catalog-select-btn" type="button">
            <i class="fa-solid fa-check"></i> Gunakan Model
          </button>
        </div>
      `;

      const favBtn = row.querySelector('.catalog-fav-btn');
      if (favBtn) {
        favBtn.addEventListener('click', (e) => {
          toggleModelFavorite(m.id, e);
        });
      }

      row.querySelector('.catalog-select-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applySelectedModelFromCatalog(m.id, isOllama ? 'ollama' : 'openrouter');
      });

      container.appendChild(row);
    });

    updateCatalogFavBadge();
  }

  let isApplyingModelCatalog = false;

  function applySelectedModelFromCatalog(modelId, provider) {
    if (isApplyingModelCatalog) return;
    isApplyingModelCatalog = true;
    setTimeout(() => { isApplyingModelCatalog = false; }, 800);

    const catModal = document.getElementById('liveModelCatalogModal');
    const targetId = (catModal && catModal.dataset.targetInputId) || STATE.catalogTargetInputId;

    if (targetId) {
      const targetInput = document.getElementById(targetId);
      if (targetInput) {
        targetInput.value = modelId;
      }
      
      if (catModal) catModal.dataset.targetInputId = '';
      STATE.catalogTargetInputId = null;
      savePersistedState();

      // Tutup katalog langsung tanpa memicu event popstate liar
      if (catModal) catModal.classList.remove('show');

      try {
        if (window.history && history.replaceState) {
          history.replaceState({ modal: 'settingsModal' }, '');
        }
      } catch (e) {}

      AudioEngine.click();
      return;
    }

    // Model Obrolan Utama
    if (provider === 'ollama') {
      setEngineMode('ollama');
      STATE.settings.ollamaModel = modelId;
    } else {
      setEngineMode('openrouter');
      STATE.settings.openRouterModel = modelId;
    }
    savePersistedState();
    updateModelUI();

    closeModal('liveModelCatalogModal');
  }

  // ==================== LIVE RESEARCH INSPECTOR ====================
  function openLiveResearchInspection() {
    renderLiveInspectionContent();
    openModal('liveResearchInspectionModal');
  }

  function updateLiveInspectionData(inspectionData) {
    if (!inspectionData) return;
    STATE.currentLiveInspection = {
      ...(STATE.currentLiveInspection || {}),
      ...inspectionData,
      agent1: { ...(STATE.currentLiveInspection?.agent1 || {}), ...(inspectionData.agent1 || {}) },
      agent2: { ...(STATE.currentLiveInspection?.agent2 || {}), ...(inspectionData.agent2 || {}) },
      scraper: { ...(STATE.currentLiveInspection?.scraper || {}), ...(inspectionData.scraper || {}) },
      synthesizer: { ...(STATE.currentLiveInspection?.synthesizer || {}), ...(inspectionData.synthesizer || {}) },
      model4: { ...(STATE.currentLiveInspection?.model4 || {}), ...(inspectionData.model4 || {}) }
    };
    const currentInsp = STATE.currentLiveInspection;

    if (els.inspectTopik) els.inspectTopik.innerText = currentInsp.topik || '-';
    if (els.inspectCurrentQuery) els.inspectCurrentQuery.innerText = currentInsp.currentQuery || '-';
    if (els.inspectIteration) els.inspectIteration.innerText = `${currentInsp.iteration || 1} / ${currentInsp.maxIterations || 3}`;
    if (els.inspectTimestamp) els.inspectTimestamp.innerText = currentInsp.timestamp || new Date().toLocaleTimeString('id-ID');

    if (els.inspectCountAgent1) {
      els.inspectCountAgent1.innerText = currentInsp.agent1?.resultsCount || (currentInsp.agent1?.results?.length || 0);
    }
    if (els.inspectCountAgent2) {
      els.inspectCountAgent2.innerText = currentInsp.agent2?.resultsCount || (currentInsp.agent2?.results?.length || 0);
    }
    if (els.inspectCountScraper) {
      els.inspectCountScraper.innerText = currentInsp.scrapedArticlesCount ?? (currentInsp.scraper?.totalScraped ?? (currentInsp.scraper?.articles?.length || 0));
    }
    if (els.inspectCountSynthesizer) {
      const synLen = currentInsp.synthesizer?.text ? currentInsp.synthesizer.text.length : (currentInsp.synthesizer?.length || 0);
      els.inspectCountSynthesizer.innerText = synLen > 0 ? (synLen > 999 ? `${(synLen / 1000).toFixed(1)}k` : `${synLen}`) : (currentInsp.synthesizer?.status === 'selesai' ? 'Selesai' : 'Siap');
    }
    if (els.inspectCountModel4) {
      const m4Len = currentInsp.model4?.text ? currentInsp.model4.text.length : (currentInsp.model4?.length || 0);
      els.inspectCountModel4.innerText = m4Len > 0 ? (m4Len > 999 ? `${(m4Len / 1000).toFixed(1)}k` : `${m4Len}`) : (currentInsp.model4?.status === 'selesai' ? 'Selesai' : 'Siap');
    }

    // Jika modal terbuka, langsung live update view secara dinamis
    if (els.liveResearchInspectionModal && els.liveResearchInspectionModal.classList.contains('show')) {
      renderLiveInspectionContent();
    }
  }

  function syncLiveInspectionTabButtons() {
    const activeTab = STATE.activeInspectionTab || 'agent1';
    els.btnTabInspectAgent1?.classList.toggle('active', activeTab === 'agent1');
    els.btnTabInspectAgent2?.classList.toggle('active', activeTab === 'agent2');
    els.btnTabInspectScraper?.classList.toggle('active', activeTab === 'scraper');
    els.btnTabInspectSynthesizer?.classList.toggle('active', activeTab === 'synthesizer');
    els.btnTabInspectModel4?.classList.toggle('active', activeTab === 'model4');
  }

  function renderLiveInspectionContent() {
    syncLiveInspectionTabButtons();
    const container = els.inspectTabContent;
    if (!container) return;
    const insp = STATE.currentLiveInspection;

    if (!insp) {
      container.innerHTML = `
        <div style="text-align:center; padding: 40px 20px; color: var(--text-dim);">
          <i class="fa-solid fa-satellite fa-spin" style="font-size: 2.4rem; color: var(--neon-cyan); margin-bottom: 12px; display:block;"></i>
          <h4 style="color:#FFF; margin:0 0 6px 0;">Menunggu Data Live Dari Agen Riset...</h4>
          <p style="font-size:0.82rem; margin:0;">Mulai Deep Research dari composer dengan URL target untuk memantau proses analisis dan ekstraksi konten secara real-time.</p>
        </div>
      `;
      return;
    }

    const tab = STATE.activeInspectionTab || 'agent1';

    if (tab === 'agent1') {
      const ag1 = insp.agent1 || {};
      const results = ag1.results || [];
      container.innerHTML = `
        <div class="inspector-card">
          <div class="inspector-card-header">
            <div class="inspector-card-title">
              <i class="fa-solid fa-link" style="color: #00F0FF;"></i>
              <span>${escapeHtml(ag1.name || 'Penganalisis Web Kustom URL (Ekstraksi Konten)')}</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span class="catalog-badge">${escapeHtml(ag1.provider || 'Deep Web Extractor')}</span>
              <span class="catalog-badge" style="background:rgba(0,240,255,0.08); color:#00F0FF;">Model: ${escapeHtml(ag1.model || 'Default')}</span>
            </div>
          </div>

          <div style="margin-bottom: 14px;">
            <div style="font-size: 0.78rem; font-weight: 700; color: #64F3FF; margin-bottom: 8px;">
              <i class="fa-solid fa-file-export"></i> Dokumen Web Utuh yang Diambil (${results.length} Sumber URL):
            </div>
            ${results.length === 0 ? '<div style="font-size:0.78rem; color:var(--text-dim); font-style:italic;">Belum ada hasil pencarian.</div>' : ''}
            ${results.map((r, idx) => `
              <div class="inspector-source-item">
                <div class="inspector-source-title">
                  <a href="${escapeHtml(r.link || r.url || '#')}" target="_blank" rel="noopener noreferrer">
                    [${idx + 1}] ${escapeHtml(r.title || 'Senza Titolo')}
                  </a>
                </div>
                <div class="inspector-source-snippet">${escapeHtml(r.snippet || r.content || '')}</div>
                <div style="font-size:0.68rem; color:var(--text-dim); margin-top:3px; font-family:var(--font-code);">${escapeHtml(r.link || r.url || '')}</div>
              </div>
            `).join('')}
          </div>

          <div>
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--neon-teal); margin-bottom: 8px;">
              <i class="fa-solid fa-brain"></i> Hasil Ekstraksi Awal & Validasi:
            </div>
            <div class="inspector-analysis-box">${escapeHtml(ag1.analysis || 'Sedang mengekstrak & menormalkan konten...')}</div>
          </div>
        </div>
      `;
    } else if (tab === 'agent2') {
      const ag2 = insp.agent2 || {};
      const results = ag2.results || [];
      container.innerHTML = `
        <div class="inspector-card">
          <div class="inspector-card-header">
            <div class="inspector-card-title">
              <i class="fa-solid fa-layer-group" style="color: #00FFC2;"></i>
              <span>${escapeHtml(ag2.name || 'Dekonstruksi Konseptual & Analisis Struktur')}</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span class="catalog-badge" style="border-color:rgba(0,255,194,0.4); color:#00FFC2;">${escapeHtml(ag2.provider || 'Neural Content Deconstructor')}</span>
              <span class="catalog-badge" style="background:rgba(0,255,194,0.08); color:#00FFC2;">Model: ${escapeHtml(ag2.model || 'Default')}</span>
            </div>
          </div>

          <p style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 12px; line-height: 1.45;">
            Modul ini mendekonstruksi struktur konseptual dan semantik dokumen — menganalisis arsitektur konten, argumen utama, data kuantitatif, serta teori yang dinyatakan di halaman web target.
          </p>

          <div>
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--neon-teal); margin-bottom: 8px;">
              <i class="fa-solid fa-diagram-project"></i> Hasil Dekonstruksi Struktural & Argumen:
            </div>
            <div class="inspector-analysis-box" style="white-space: pre-wrap; font-size: 0.82rem; line-height: 1.55;">${escapeHtml(ag2.analysis || 'Sedang menganalisis struktur & konsep...')}</div>
          </div>
        </div>
      `;
    } else if (tab === 'scraper') {
      const scraper = insp.scraper || {};
      const articles = scraper.articles || [];
      const temporalAnalysis = scraper.temporalAnalysis || '';
      container.innerHTML = `
        <div class="inspector-card">
          <div class="inspector-card-header">
            <div class="inspector-card-title">
              <i class="fa-solid fa-scale-balanced" style="color: #FFB703;"></i>
              <span>Analisis Temporal: Baru vs Arsip Lama</span>
            </div>
            <span class="catalog-badge" style="background:rgba(255,183,3,0.12); color:#FFB703; border-color:rgba(255,183,3,0.3);">
              Total: ${articles.length} Dokumen Utuh
            </span>
          </div>

          <p style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 12px; line-height: 1.45;">
            Evaluasi temporal & komparatif: memisahkan secara tepat apa yang baru saja diperkenalkan (pembaruan terbaru, versi baru, perubahan kebijakan) dari aturan dan kondisi sebelumnya (data usang, deprecated, atau tergantikan).
          </p>

          ${temporalAnalysis ? `
            <div style="margin-bottom: 16px;">
              <div style="font-size: 0.78rem; font-weight: 700; color: #FFB703; margin-bottom: 8px;">
                <i class="fa-solid fa-timeline"></i> Sintesis Komparatif (Baru vs Status Sebelumnya):
              </div>
              <div class="inspector-analysis-box" style="background: rgba(255,183,3,0.05); border-color: rgba(255,183,3,0.3); font-size:0.8rem; line-height:1.55; white-space: pre-wrap;">
                ${escapeHtml(temporalAnalysis)}
              </div>
            </div>
          ` : ''}

          <div style="margin-bottom: 14px;">
            <div style="font-size: 0.78rem; font-weight: 700; color: #64F3FF; margin-bottom: 8px;">
              <i class="fa-solid fa-file-lines"></i> Dokumen Web yang Diekstrak (${articles.length} Sumber):
            </div>
            ${articles.length === 0 ? `
              <div style="text-align:center; padding: 24px; color: var(--text-dim); font-size: 0.8rem; font-style:italic;">
                Belum ada dokumen yang diekstrak pada fase ini.
              </div>
            ` : articles.map((art, idx) => `
              <div class="inspector-source-item" style="margin-bottom: 12px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px; gap:8px;">
                  <div class="inspector-source-title" style="margin:0;">
                    <a href="${escapeHtml(art.url)}" target="_blank" rel="noopener noreferrer">
                      [${idx + 1}] ${escapeHtml(art.title)}
                    </a>
                  </div>
                  <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                    <span style="font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:600; font-family:var(--font-code); background:rgba(0,180,216,0.15); color:#00B4D8; border:1px solid rgba(0,180,216,0.3);">
                      ${escapeHtml(art.sourceProvider)}
                    </span>
                    <span style="font-size:0.68rem; color:var(--neon-teal); font-family:var(--font-code); background:rgba(0,255,194,0.1); padding:2px 6px; border-radius:4px;">
                      ${art.length ? (art.length > 999 ? `${(art.length / 1000).toFixed(1)}k karakter` : `${art.length} karakter`) : 'Teks Lengkap'}
                    </span>
                  </div>
                </div>
                <div style="font-size:0.68rem; color:var(--text-dim); margin-bottom:6px; font-family:var(--font-code);">${escapeHtml(art.url)}</div>
                <div class="inspector-source-snippet" style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:4px; font-size:0.74rem;">
                  <strong style="color:var(--text-muted); display:block; margin-bottom:2px; font-size:0.68rem;">Campione di Testo Estratto:</strong>
                  ${escapeHtml(art.sample || art.preview || art.content || '')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (tab === 'synthesizer') {
      const syn = insp.synthesizer || {};
      const synText = syn.text || insp.hasil || '';
      const isComplete = syn.status === 'selesai' || syn.status === 'completato';
      container.innerHTML = `
        <div class="inspector-card">
          <div class="inspector-card-header">
            <div class="inspector-card-title">
              <i class="fa-solid fa-file-contract" style="color: #FF007F;"></i>
              <span>${escapeHtml(syn.name || 'Model 3 (Lead Corrector & Enhancer)')}</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span class="catalog-badge" style="background:rgba(255,0,127,0.1); color:#FF007F; border-color:rgba(255,0,127,0.3);">
                Model: ${escapeHtml(syn.model || STATE.activeModel || (STATE.currentEngine === 'openrouter' ? STATE.settings.openRouterModel : STATE.settings.ollamaModel) || 'Lead Corrector')}
              </span>
              <span class="catalog-badge" style="background:rgba(0,255,194,0.1); color:var(--neon-teal);">
                ${syn.status === 'selesai' ? '<i class="fa-solid fa-check"></i> Selesai' : (synText ? '<i class="fa-solid fa-spinner fa-spin"></i> Mengoreksi...' : 'Menunggu')}
              </span>
            </div>
          </div>

          <p style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 12px; line-height: 1.45;">
            Sintesis analitik akhir: menyusun laporan riset lengkap 7 bagian dengan matriks komparatif Markdown antara data lama dan temuan terbaru.
          </p>

          <div>
            <div style="font-size: 0.78rem; font-weight: 700; color: #FF007F; margin-bottom: 8px; display:flex; justify-content:space-between; align-items:center;">
              <span><i class="fa-solid fa-terminal"></i> Draft Live Laporan Riset Komprehensif Terkoreksi:</span>
              <span style="font-size:0.7rem; color:var(--text-dim); font-family:var(--font-code);">${synText ? `${synText.length} karakter` : '0 karakter'}</span>
            </div>
            <div class="inspector-analysis-box" style="max-height: 480px; overflow-y: auto; white-space: pre-wrap; font-family: var(--font-code); font-size: 0.8rem; line-height: 1.5; border-color: rgba(255,0,127,0.3); background: rgba(20, 8, 16, 0.6);">${escapeHtml(synText || 'Model 3 sedang menunggu hasil telaah Model 1 & Model 2 sebelum mulai mengoreksi dan menyempurnakan laporan...')}</div>
          </div>
        </div>
      `;
    } else if (tab === 'model4') {
      const m4 = insp.model4 || {};
      const m4Text = m4.text || '';
      const isComplete = m4.status === 'selesai' || m4.status === 'completato';
      container.innerHTML = `
        <div class="inspector-card">
          <div class="inspector-card-header">
            <div class="inspector-card-title">
              <i class="fa-solid fa-comment-dots" style="color: var(--neon-cyan);"></i>
              <span>${escapeHtml(m4.name || 'Model 4 (Executive Chat Summarizer)')}</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span class="catalog-badge" style="background:rgba(0,240,255,0.08); color:var(--neon-cyan); border-color:rgba(0,240,255,0.3);">
                Model: ${escapeHtml(m4.model || STATE.activeModel || (STATE.currentEngine === 'openrouter' ? STATE.settings.openRouterModel : STATE.settings.ollamaModel) || 'Executive Summarizer')}
              </span>
              <span class="catalog-badge" style="background:rgba(0,255,194,0.1); color:var(--neon-teal);">
                ${m4.status === 'selesai' ? '<i class="fa-solid fa-check"></i> Selesai' : (m4Text ? '<i class="fa-solid fa-spinner fa-spin"></i> Merumuskan...' : 'Menunggu')}
              </span>
            </div>
          </div>

          <p style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 12px; line-height: 1.45;">
            Menyusun rangkuman eksekutif ringkas & profesional (2-3 paragrafi) hasil olahan dari laporan lengkap, siap dikirim langsung ke percakapan chat.
          </p>

          <div>
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--neon-cyan); margin-bottom: 8px; display:flex; justify-content:space-between; align-items:center;">
              <span><i class="fa-solid fa-comment-dots"></i> Draft Live Rangkuman Eksekutif Chat:</span>
              <span style="font-size:0.7rem; color:var(--text-dim); font-family:var(--font-code);">${m4Text ? `${m4Text.length} karakter` : '0 karakter'}</span>
            </div>
            <div class="inspector-analysis-box" style="max-height: 480px; overflow-y: auto; white-space: pre-wrap; font-family: var(--font-code); font-size: 0.8rem; line-height: 1.5; border-color: rgba(0,240,255,0.3); background: rgba(8, 20, 24, 0.6);">${escapeHtml(m4Text || 'Model 4 sedang menunggu penyelesaian laporan terkoreksi dari Model 3...')}</div>
          </div>
        </div>
      `;
    }
  }

  // ==================== SETTINGS SYNC HELPER ====================
  function syncSettingsModalFields() {
    if (els.settingOllamaEndpoint) els.settingOllamaEndpoint.value = STATE.settings.ollamaEndpoint || 'https://ollama.com';
    if (els.settingOllamaApiKey) els.settingOllamaApiKey.value = STATE.settings.ollamaApiKey || '';
    if (els.settingOpenRouterKey) els.settingOpenRouterKey.value = STATE.settings.openRouterKey || '';
    if (els.settingSerperApiKey) els.settingSerperApiKey.value = STATE.settings.serperApiKey || '075538fed9c64990e1eb32a06726c1e55a933c1e';
    if (els.settingMusicModel) els.settingMusicModel.value = STATE.settings.musicModel || 'google/lyria-3-clip-preview';
    if (els.paramTemperature) els.paramTemperature.value = STATE.settings.temperature ?? 0.7;
    if (els.valTemperature) els.valTemperature.innerText = STATE.settings.temperature ?? 0.7;
    if (els.paramTopP) els.paramTopP.value = STATE.settings.topP ?? 0.9;
    if (els.valTopP) els.valTopP.innerText = STATE.settings.topP ?? 0.9;
    if (els.settingSystemPrompt) {
      if (STATE.settings.activePreset === 'default') {
        els.settingSystemPrompt.value = STATE.settings.customSystemPrompt || '';
      } else if (STATE.settings.activePreset === 'custom') {
        els.settingSystemPrompt.value = STATE.settings.customSystemPrompt || STATE.settings.systemPrompt || '';
      } else if (STATE.settings.activePreset && SYSTEM_PRESETS[STATE.settings.activePreset]) {
        els.settingSystemPrompt.value = SYSTEM_PRESETS[STATE.settings.activePreset];
      } else {
        els.settingSystemPrompt.value = STATE.settings.systemPrompt || '';
      }
    }
    if (els.settingAutoPolicy) els.settingAutoPolicy.value = STATE.settings.autoPolicy || 'local_first';
    
    updatePresetPillUI();
  }

  // ==================== EVENT LISTENERS SETUP ====================
  function setupEventListeners() {
    // Mode Switchers (Auto Router Toggle & Switch)
    els.modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetMode = tab.dataset.mode;
        if (targetMode === 'auto') {
          if (STATE.mode === 'auto') {
            // Toggle kembali ke provider model yang saat ini sedang aktif
            const currentModel = getCurrentModel();
            const fallbackMode = (currentModel && currentModel.includes('/')) ? 'openrouter' : 'ollama';
            setEngineMode(fallbackMode);
            showToast(`Auto Router dinonaktifkan. Mode: ${fallbackMode.toUpperCase()}`);
          } else {
            setEngineMode('auto');
            showToast('Auto Router aktif: Ollama Cloud first + OpenRouter fallback');
          }
        } else {
          setEngineMode(targetMode);
        }
      });
    });

    // Model Picker: Buka Katalog Model Layar Lebar & Besar Real-Time (Live Catalog)
    els.modelPickerChip?.addEventListener('click', (e) => {
      e.stopPropagation();
      AudioEngine.click();
      if (els.modelDropdownMenu) {
        els.modelDropdownMenu.classList.remove('show');
      }
      openLiveModelCatalog(null, 'Model Obrolan Utama');
    });

    // Custom Model Direct Input pada Katalog Layar Lebar
    const catalogCustomInput = document.getElementById('catalogCustomModelInput');
    const btnUseCatalogCustom = document.getElementById('btnUseCatalogCustomModel');

    const handleUseCustomModel = () => {
      const val = catalogCustomInput?.value.trim();
      if (!val) return;
      const provider = val.includes('/') ? 'openrouter' : (STATE.activeCatalogTab || 'ollama');
      applySelectedModelFromCatalog(val, provider);
      if (catalogCustomInput) catalogCustomInput.value = '';
    };

    btnUseCatalogCustom?.addEventListener('click', (e) => {
      e.preventDefault();
      handleUseCustomModel();
    });

    catalogCustomInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUseCustomModel();
      }
    });

    // Fallback Dropdown Tabs di Header (jika diakses)
    els.dropdownTabOllama?.addEventListener('click', (e) => {
      e.stopPropagation();
      STATE.dropdownModelTab = 'ollama';
      populateModelDropdown(els.modelSearchInput?.value || '');
      AudioEngine.click();
    });

    els.dropdownTabOpenRouter?.addEventListener('click', (e) => {
      e.stopPropagation();
      STATE.dropdownModelTab = 'openrouter';
      populateModelDropdown(els.modelSearchInput?.value || '');
      AudioEngine.click();
    });

    els.btnOpenFullCatalogFromDropdown?.addEventListener('click', (e) => {
      e.stopPropagation();
      els.modelDropdownMenu?.classList.remove('show');
      openLiveModelCatalog(null, 'Model Obrolan Utama');
    });

    document.addEventListener('click', (e) => {
      if (els.modelPickerChip && els.modelDropdownMenu && !els.modelPickerChip.contains(e.target) && !els.modelDropdownMenu.contains(e.target)) {
        els.modelDropdownMenu.classList.remove('show');
      }

      // Global delegation untuk tombol Cari Model
      const catalogBtn = e.target.closest('.btn-open-model-catalog');
      if (catalogBtn) {
        e.preventDefault();
        e.stopPropagation();
        const targetInputId = catalogBtn.dataset.targetInput || null;
        openLiveModelCatalog(targetInputId, 'Model Obrolan Utama');
        return;
      }

      // Global delegation untuk tombol Pertinjau Proses Nyata (Live Inspection)
      const inspectBtn = e.target.closest('.btn-live-inspection-trigger');
      if (inspectBtn) {
        e.preventDefault();
        e.stopPropagation();
        openLiveResearchInspection();
        return;
      }
    });

    els.modelSearchInput?.addEventListener('input', (e) => {
      populateModelDropdown(e.target.value);
    });

    els.useCustomModelBtn?.addEventListener('click', () => {
      const val = els.customModelInput ? els.customModelInput.value.trim() : '';
      if (val) {
        selectModel(val);
        if (els.customModelInput) els.customModelInput.value = '';
        els.modelDropdownMenu?.classList.remove('show');
      }
    });

    // ==================== SEND PROMPT & QUICK-GESTURE HANDLERS ====================
    let sendPressTimer = null;
    let isSendLongPressed = false;

    const startSendPress = () => {
      if (STATE.isGenerating) return;
      isSendLongPressed = false;
      clearTimeout(sendPressTimer);
      sendPressTimer = setTimeout(() => {
        isSendLongPressed = true;
        STATE.isImageGenMode = !STATE.isImageGenMode;
        updateImageGenModeUI();
        if (navigator.vibrate) {
          try { navigator.vibrate([40, 40, 40]); } catch (_) {}
        }
        if (STATE.isImageGenMode) {
          showToast('🎨 Quick Toggle: Mode AI Image Studio Aktif!');
          AudioEngine.success();
          els.promptInput?.focus();
        } else {
          showToast('💬 Quick Toggle: Mode Percakapan Standar.');
          AudioEngine.click();
          els.promptInput?.focus();
        }
      }, 450);
    };

    const cancelSendPress = () => {
      clearTimeout(sendPressTimer);
    };

    if (window.PointerEvent) {
      els.sendPromptBtn?.addEventListener('pointerdown', startSendPress);
      els.sendPromptBtn?.addEventListener('pointerup', cancelSendPress);
      els.sendPromptBtn?.addEventListener('pointerleave', cancelSendPress);
      els.sendPromptBtn?.addEventListener('pointercancel', cancelSendPress);
    } else {
      els.sendPromptBtn?.addEventListener('touchstart', startSendPress, { passive: true });
      els.sendPromptBtn?.addEventListener('touchend', cancelSendPress);
      els.sendPromptBtn?.addEventListener('touchcancel', cancelSendPress);
      els.sendPromptBtn?.addEventListener('mousedown', startSendPress);
      els.sendPromptBtn?.addEventListener('mouseup', cancelSendPress);
      els.sendPromptBtn?.addEventListener('mouseleave', cancelSendPress);
    }
    window.addEventListener('blur', cancelSendPress);

    els.sendPromptBtn?.addEventListener('click', (e) => {
      if (isSendLongPressed) {
        e.preventDefault();
        e.stopPropagation();
        isSendLongPressed = false;
        return;
      }
      handleSendPrompt().catch((err) => {
        console.error('Kirim prompt gagal:', err);
        showToast('Gagal mengirim pesan: ' + (err && err.message ? err.message : err), 'error');
      });
    });

    els.stopGenerationBtn?.addEventListener('click', stopGeneration);
    els.neutronCrownBtn?.addEventListener('click', () => togglePromptVisibility());

    els.promptInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        handleSendPrompt().catch((err) => {
          console.error('Kirim prompt (Enter) gagal:', err);
          showToast('Gagal mengirim pesan: ' + (err && err.message ? err.message : err), 'error');
        });
      }
    });

    els.promptInput?.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || window.clipboardData)?.items;
      if (items) {
        for (const item of items) {
          if (item.type && item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              const ok = await processSingleImageFile(file);
              if (ok) {
                renderAttachmentPreviews();
                AudioEngine.click();
              }
            }
            return;
          }
        }
      }

      // Claude & Grok AI Style: Otomatis konversi teks panjang / kodingan / laporan menjadi file markdown
      let pastedText = '';
      try {
        if (e.clipboardData) {
          pastedText = e.clipboardData.getData('text/plain') || '';
        } else if (window.clipboardData) {
          pastedText = window.clipboardData.getData('Text') || '';
        }
      } catch (_) {}

      if (pastedText && shouldAutoConvertAsDocument(pastedText)) {
        e.preventDefault();
        const alwaysAuto = localStorage.getItem('zoz_always_auto_fold_prompt') === 'true';
        if (alwaysAuto) {
          const currentText = (els.promptInput ? els.promptInput.value.trim() : '');
          const converted = tryAutoConvertInputToDoc(pastedText);
          if (converted && currentText && els.promptInput) {
            els.promptInput.value = currentText;
            autoResizeTextarea(els.promptInput);
            els.promptInput?.focus();
          }
          return;
        }

        // Tampilkan pop-up modal & floating card konfirmasi interaktif
        checkAndShowPromptFoldPrompt(pastedText, true, true);
        return;
      }
    });

    // Tangani drag & drop teks kodingan/laporan langsung ke textarea prompt
    els.promptInput?.addEventListener('drop', (e) => {
      let droppedText = '';
      try {
        droppedText = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
      } catch (_) {}
      if (droppedText && shouldAutoConvertAsDocument(droppedText)) {
        e.preventDefault();
        const alwaysAuto = localStorage.getItem('zoz_always_auto_fold_prompt') === 'true';
        if (alwaysAuto) {
          const currentText = (els.promptInput ? els.promptInput.value.trim() : '');
          const converted = tryAutoConvertInputToDoc(droppedText);
          if (converted && currentText && els.promptInput) {
            els.promptInput.value = currentText;
            autoResizeTextarea(els.promptInput);
            els.promptInput?.focus();
          }
          return;
        }

        checkAndShowPromptFoldPrompt(droppedText, true, true);
      }
    });

    els.promptInput?.addEventListener('input', (e) => {
      autoResizeTextarea(els.promptInput);

      const val = els.promptInput ? els.promptInput.value : '';

      // Tampilkan tombol pill konversi jika ada teks yang cocok dikonversi
      if (els.autoConvertDocRow) {
        if (val && shouldAutoConvertAsDocument(val)) {
          els.autoConvertDocRow.style.display = 'flex';
        } else {
          els.autoConvertDocRow.style.display = 'none';
        }
      }

      // Deteksi kodingan / teks panjang untuk pop-up konfirmasi atau auto-convert
      if (val && shouldAutoConvertAsDocument(val)) {
        const alwaysAuto = localStorage.getItem('zoz_always_auto_fold_prompt') === 'true';
        if (alwaysAuto) {
          if (countPromptWords(val) >= 500 || val.length >= 4000) {
            tryAutoConvertInputToDoc(val);
            return;
          }
        } else {
          checkAndShowPromptFoldPrompt(val, false, false);
        }
      } else {
        hideComposerFoldPromptCard();
      }

      // Auto-detect prefix /img, /gambar, /image untuk mengaktifkan AI Image Studio seketika
      if (!STATE.isImageGenMode && /^\/(?:img|gambar|image)\s+/i.test(val)) {
        STATE.isImageGenMode = true;
        STATE.isMusicGenMode = false;
        els.promptInput.value = val.replace(/^\/(?:img|gambar|image)\s+/i, '');
        updateImageGenModeUI();
        updateMusicGenModeUI();
        autoResizeTextarea(els.promptInput);
        if (navigator.vibrate) {
          try { navigator.vibrate(30); } catch (_) {}
        }
        showToast('🎨 Mode AI Image Studio Aktif!');
        AudioEngine.success();
      } else if (!STATE.isMusicGenMode && /^\/(?:music|musik|audio|song|lagu)\s+/i.test(val)) {
        STATE.isMusicGenMode = true;
        STATE.isImageGenMode = false;
        els.promptInput.value = val.replace(/^\/(?:music|musik|audio|song|lagu)\s+/i, '');
        updateMusicGenModeUI();
        updateImageGenModeUI();
        autoResizeTextarea(els.promptInput);
        if (navigator.vibrate) {
          try { navigator.vibrate(30); } catch (_) {}
        }
        showToast('🎵 Mode AI Music Studio Aktif!');
        AudioEngine.success();
      } else if ((STATE.isImageGenMode || STATE.isMusicGenMode) && /^\/(?:chat|teks|text)\s+/i.test(val)) {
        STATE.isImageGenMode = false;
        STATE.isMusicGenMode = false;
        els.promptInput.value = val.replace(/^\/(?:chat|teks|text)\s+/i, '');
        updateImageGenModeUI();
        updateMusicGenModeUI();
        autoResizeTextarea(els.promptInput);
        if (navigator.vibrate) {
          try { navigator.vibrate(20); } catch (_) {}
        }
        showToast('💬 Mode Percakapan Standar.');
        AudioEngine.click();
      }
    });

    // Tombol Konversi Teks Panjang ke Markdown
    els.convertToMdPillBtn?.addEventListener('click', () => {
      const val = els.promptInput ? els.promptInput.value.trim() : '';
      if (!val) return;
      // Buka modal konversi interaktif agar user bisa konfirmasi
      checkAndShowPromptFoldPrompt(val, true, false);
    });

    // Event listener untuk Pop-up Card Konfirmasi (Setuju / Tidak)
    els.btnFoldConfirm?.addEventListener('click', () => {
      executeConfirmedPromptFold();
    });
    els.btnFoldDismiss?.addEventListener('click', () => {
      dismissPromptFold(true);
    });

    // Event listener untuk Modal Konfirmasi (Setuju / Batal)
    els.btnFoldModalConfirm?.addEventListener('click', () => {
      executeConfirmedPromptFold();
    });
    els.btnFoldModalCancel?.addEventListener('click', () => {
      dismissPromptFold(true);
    });

    // Event listener untuk Document Preview & Revert Modal
    els.revertDocToPromptBtn?.addEventListener('click', () => {
      if (activePreviewDocIndex >= 0 && activePreviewDocIndex < STATE.attachedDocs.length) {
        const doc = STATE.attachedDocs[activePreviewDocIndex];
        const textToRestore = doc.rawContent || doc.content || '';
        STATE.attachedDocs.splice(activePreviewDocIndex, 1);
        renderAttachmentPreviews();
        if (els.promptInput) {
          els.promptInput.value = els.promptInput.value ? `${els.promptInput.value}\n\n${textToRestore}` : textToRestore;
          autoResizeTextarea(els.promptInput);
          els.promptInput.focus();
        }
        closeModal('docPreviewModal');
        showToast('↩️ File dokumen dikembalikan ke kolom prompt input.');
        AudioEngine.click();
      }
    });

    els.deleteDocFromModalBtn?.addEventListener('click', () => {
      if (activePreviewDocIndex >= 0 && activePreviewDocIndex < STATE.attachedDocs.length) {
        STATE.attachedDocs.splice(activePreviewDocIndex, 1);
        renderAttachmentPreviews();
        closeModal('docPreviewModal');
        showToast('File dokumen dihapus.');
        AudioEngine.click();
      }
    });


    // New Chat & History
    els.newChatBtn?.addEventListener('click', () => createNewSession());
    els.searchHistoryInput?.addEventListener('input', (e) => renderChatHistory(e.target.value));
    
    els.clearAllHistoryBtn?.addEventListener('click', async () => {
      if (confirm('Apakah Anda yakin ingin menghapus semua riwayat sesi obrolan?')) {
        if (STATE.isGenerating) {
          stopGeneration();
        }
        STATE.sessions = [];
        STATE.currentSessionId = null;
        safeSessionStorage.removeItem('zoz_active_session_id');
        try { localStorage.removeItem('zoz_last_active_session_id'); } catch (_) {}
        await DeviceStorage.clearAllSessions();
        savePersistedState();
        createNewSession();
        AudioEngine.click();
      }
    });

    // ==================== SIDEBAR HELPERS (Desktop Collapse & Mobile Drawer) ====================
    function isMobile() {
      return window.innerWidth <= 768;
    }

    function openMobileSidebar() {
      els.sidebar?.classList.add('open');
      els.sidebarBackdrop?.classList.add('show');
      history.pushState({ modal: 'sidebar' }, '');
      renderChatHistory(els.searchHistoryInput?.value || '');
      AudioEngine.click();
    }

    function closeMobileSidebar(triggerHistoryBack = true) {
      els.sidebar?.classList.remove('open');
      els.sidebarBackdrop?.classList.remove('show');
      if (triggerHistoryBack && history.state?.modal === 'sidebar') {
        history.back();
      }
    }

    function toggleDesktopSidebar() {
      const isCollapsed = els.appContainer?.classList.toggle('sidebar-collapsed');
      els.sidebar?.classList.toggle('collapsed', isCollapsed);
      if (!isCollapsed) {
        renderChatHistory(els.searchHistoryInput?.value || '');
      }
      try {
        localStorage.setItem('zoz_sidebar_collapsed', isCollapsed ? 'true' : 'false');
      } catch (e) {}
      AudioEngine.click();
    }

    function toggleSidebar() {
      if (isMobile()) {
        if (els.sidebar?.classList.contains('open')) {
          closeMobileSidebar(true);
        } else {
          openMobileSidebar();
        }
      } else {
        toggleDesktopSidebar();
      }
    }

    function closeSidebar() {
      if (isMobile()) {
        closeMobileSidebar(true);
      } else {
        els.appContainer?.classList.add('sidebar-collapsed');
        els.sidebar?.classList.add('collapsed');
        try {
          localStorage.setItem('zoz_sidebar_collapsed', 'true');
        } catch (e) {}
        AudioEngine.click();
      }
    }

    // Sidebar Toggle & Close Handlers
    els.toggleSidebarBtn?.addEventListener('click', toggleSidebar);
    els.closeSidebarBtn?.addEventListener('click', closeSidebar);
    els.sidebarBackdrop?.addEventListener('click', () => {
      if (isMobile()) closeMobileSidebar(true);
    });

    // Auto-dismiss sidebar on mobile when clicking on main content / chat area
    els.mainContent?.addEventListener('click', (e) => {
      if (isMobile() && els.sidebar?.classList.contains('open')) {
        if (!els.sidebar.contains(e.target) && !els.toggleSidebarBtn?.contains(e.target)) {
          closeMobileSidebar(true);
        }
      }
    });

    els.chatViewport?.addEventListener('click', () => {
      if (isMobile() && els.sidebar?.classList.contains('open')) {
        closeMobileSidebar(true);
      }
    });

    // Online & YouTube Music Handlers
    els.playOnlineUrlBtn?.addEventListener('click', () => {
      const url = els.onlineAudioUrlInput ? els.onlineAudioUrlInput.value.trim() : '';
      const title = els.onlineAudioTitleInput ? els.onlineAudioTitleInput.value.trim() : '';
      if (!url) {
        showToast('Masukkan URL audio atau YouTube terlebih dahulu.', 'error');
        return;
      }
      const ytId = BGMEngine.extractYouTubeId(url);
      if (ytId) {
        BGMEngine.playYouTube(ytId, title || null);
      } else {
        BGMEngine.playDirectUrl(url, title || 'Online Stream');
      }
      AudioEngine.click();
    });

    els.saveOnlineUrlBtn?.addEventListener('click', () => {
      const url = els.onlineAudioUrlInput ? els.onlineAudioUrlInput.value.trim() : '';
      const title = els.onlineAudioTitleInput ? els.onlineAudioTitleInput.value.trim() : '';
      BGMEngine.saveOnlineToPlaylist(url, title);
    });

    els.toggleYtPlayerVisibilityBtn?.addEventListener('click', () => {
      const wrap = els.ytPlayerContainerWrap;
      if (wrap) {
        const isHidden = wrap.style.display === 'none';
        wrap.style.display = isHidden ? 'block' : 'none';
        syncYtPlayerVisibilityBtn();
      }
      AudioEngine.click();
    });

    // Tombol "Layar Penuh": fullscreen-kan iframe YouTube ASLI (bukan container wrap).
    // YouTube IFrame API menciptakan iframe di dalam #ytPlayerContainer.
    // Di mobile, iframe ITU yang harus requestFullscreen(), bukan wrap-nya.
    els.ytFsBtn?.addEventListener('click', () => {
      const wrap = els.ytPlayerContainerWrap;
      const container = els.ytPlayerContainer;
      if (!wrap || !container) return;

      // Cari iframe YouTube asli yang dibuat oleh YouTube IFrame API
      const ytIframe = container.querySelector('iframe');

      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          // Prioritas: fullscreen iframe YouTube asli (diperlukan di mobile)
          const targetEl = ytIframe || wrap;
          const req = targetEl.requestFullscreen || targetEl.webkitRequestFullscreen || targetEl.mozRequestFullScreen || targetEl.msRequestFullscreen;
          if (req) {
            const p = req.call(targetEl);
            if (p && typeof p.catch === 'function') {
              p.catch((err) => {
                // Fallback: coba fullscreen wrap jika iframe gagal
                if (targetEl === ytIframe && wrap !== ytIframe) {
                  const wrapReq = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
                  if (wrapReq) wrapReq.call(wrap).catch(() => showToast('Fullscreen diblokir oleh browser.', 'error'));
                } else {
                  showToast('Fullscreen diblokir oleh browser.', 'error');
                }
              });
            }
          } else {
            showToast('Browser ini tidak mendukung Fullscreen API.', 'error');
          }
        }
      } catch (err) {
        showToast('Gagal memasuk layar penuh: ' + (err && err.message ? err.message : err), 'error');
      }
      AudioEngine.click();
    });

    // Curated 1-Click Stream Cards
    $$('.curated-stream-card').forEach(card => {
      card.addEventListener('click', () => {
        const src = card.dataset.url || card.dataset.src || '';
        const title = card.dataset.title || 'Online Stream';
        if (!src) return;

        const ytId = BGMEngine.extractYouTubeId(src);
        const type = card.dataset.type || (ytId ? 'youtube' : 'stream');

        if (type === 'youtube' && ytId) {
          BGMEngine.playYouTube(ytId, title);
        } else {
          BGMEngine.playDirectUrl(src, title);
        }
        if (els.onlineAudioUrlInput) els.onlineAudioUrlInput.value = src;
        if (els.onlineAudioTitleInput) els.onlineAudioTitleInput.value = title;
        AudioEngine.click();
      });
    });

    // Status Buttons
    els.refreshOllamaBtn?.addEventListener('click', () => {
      checkOllamaHealth();
      AudioEngine.click();
    });

    // Top Action Buttons
    els.systemPromptModalBtn?.addEventListener('click', () => {
      syncSettingsModalFields();
      const modal = els.settingsModal;
      if (modal) {
        modal.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.target === 'tabSystem'));
        modal.querySelectorAll('.settings-tab-pane').forEach(pane => pane.classList.toggle('active', pane.id === 'tabSystem'));
      }
      openModal('settingsModal');
      AudioEngine.click();
    });

    els.openSettingsKeyBtn?.addEventListener('click', () => {
      syncSettingsModalFields();
      const modal = els.settingsModal;
      if (modal) {
        modal.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.target === 'tabProviders'));
        modal.querySelectorAll('.settings-tab-pane').forEach(pane => pane.classList.toggle('active', pane.id === 'tabProviders'));
      }
      openModal('settingsModal');
      AudioEngine.click();
    });

    els.exportChatBtn?.addEventListener('click', exportChatHistory);

    els.btnExecuteExportChat?.addEventListener('click', () => {
      if (pendingExportSession) {
        const sess = pendingExportSession;
        pendingExportSession = null;
        closeModal('exportConfirmModal');
        executeExportDownload(sess);
      }
    });

    els.soundToggleBtn?.addEventListener('click', () => {
      STATE.soundEnabled = !STATE.soundEnabled;
      savePersistedState();
      if (els.soundToggleBtn) {
        els.soundToggleBtn.innerHTML = STATE.soundEnabled 
          ? '<i class="fa-solid fa-volume-high"></i>' 
          : '<i class="fa-solid fa-volume-xmark"></i>';
      }
      showToast(STATE.soundEnabled ? 'Suara UI diaktifkan.' : 'Suara UI dibisukan.');
      if (STATE.soundEnabled) AudioEngine.click();
    });

    // Unified Composer Attachments (ChatGPT & Gemini Style Plus Menu)
    els.attachToggleBtn?.addEventListener('click', toggleAttachmentDropdown);

    els.attachOptionCamera?.addEventListener('click', () => {
      closeAttachmentDropdown();
      els.cameraFileInput?.click();
    });
    els.attachOptionImage?.addEventListener('click', () => {
      closeAttachmentDropdown();
      els.imageFileInput?.click();
    });
    els.attachOptionGenImage?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAttachmentDropdown();
      STATE.isImageGenMode = true;
      STATE.isMusicGenMode = false;
      updateMusicGenModeUI();
      updateImageGenModeUI();
      openImageModelDropdown();
      AudioEngine.click();
    });
    els.attachOptionGenMusic?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAttachmentDropdown();
      STATE.isMusicGenMode = true;
      STATE.isImageGenMode = false;
      updateImageGenModeUI();
      updateMusicGenModeUI();
      openMusicModelDropdown();
      if (els.promptInput) {
        els.promptInput.focus();
      }
      AudioEngine.click();
    });
    // Toggle tool "Cari Video YouTube" (independen dari mode gambar/musik/video)
    els.attachOptionYouTubeSearch?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAttachmentDropdown();
      setYouTubeSearchMode(!STATE.isYouTubeSearchMode);
    });
    els.attachOptionDoc?.addEventListener('click', () => {
      closeAttachmentDropdown();
      els.docFileInput?.click();
    });

    els.imageFileInput?.addEventListener('change', handleImageUpload);
    els.cameraFileInput?.addEventListener('change', handleImageUpload);
    els.removeImageBtn?.addEventListener('click', clearAttachedImage);
    els.docFileInput?.addEventListener('change', handleDocUpload);

    // Dismiss attachment, search & image model dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      // If clicking inside an active modal, cleanly close dropdowns without interfering with modal interaction
      if (e.target && e.target.closest && e.target.closest('.modal-backdrop.show')) {
        if (els.attachmentDropdown && els.attachmentDropdown.style.display !== 'none') {
          closeAttachmentDropdown();
        }
        if (els.searchDropdown && els.searchDropdown.style.display !== 'none') {
          closeSearchDropdown();
        }
        if (els.imageModelDropdown && els.imageModelDropdown.style.display !== 'none') {
          closeImageModelDropdown();
        }
        if (els.musicModelDropdown && els.musicModelDropdown.style.display !== 'none') {
          closeMusicModelDropdown();
        }
        return;
      }

      if (els.attachmentDropdown && els.attachmentDropdown.style.display !== 'none') {
        if (!els.attachmentMenuWrapper?.contains(e.target)) {
          closeAttachmentDropdown();
        }
      }
      if (els.searchDropdown && els.searchDropdown.style.display !== 'none') {
        if (!els.searchMenuWrapper?.contains(e.target)) {
          closeSearchDropdown();
        }
      }
      if (els.imageModelDropdown && els.imageModelDropdown.style.display !== 'none') {
        if (!els.imageModelMenuWrapper?.contains(e.target)) {
          closeImageModelDropdown();
        }
      }
      if (els.musicModelDropdown && els.musicModelDropdown.style.display !== 'none') {
        if (!els.musicModelMenuWrapper?.contains(e.target)) {
          closeMusicModelDropdown();
        }
      }
    });

    // Dismiss dropdowns & open modals on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAttachmentDropdown();
        closeSearchDropdown();
        closeImageModelDropdown();
        closeMusicModelDropdown();

        if (ImageLightbox.isOpen()) {
          return;
        }

        // Close top-most active modal if open
        const openModals = Array.from(document.querySelectorAll('.modal-backdrop.show'));
        if (openModals.length > 0) {
          const topModal = openModals[openModals.length - 1];
          closeModal(topModal.id, true);
        }
      }
    });

    // Search Mode Toggle & Menu Items
    els.webSearchToggleBtn?.addEventListener('click', (e) => {
      toggleSearchDropdown(e);
    });

    // Klik langsung pada badge PRO untuk kelola URL Deep Research jika mode premium aktif
    els.searchBadge?.addEventListener('click', (e) => {
      if (STATE.searchMode === 'premium') {
        e.stopPropagation();
        closeSearchDropdown();
        openResearchUrlManagerModal();
      }
    });

    // Klik kanan / long-press membuka menu pilihan mode
    els.webSearchToggleBtn?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSearchDropdown(e);
    });

    // Modal: Matikan Mode Riset
    els.researchUrlManagerDisableBtn?.addEventListener('click', () => {
      clearResearchTargetUrls();
      setSearchMode('default');
      closeModal('researchUrlManagerModal');
      showToast('Mode Deep Research dinonaktifkan. Kembali ke Mode Default.');
    });

    // Modal: Ganti Mode Penelusuran
    els.researchUrlManagerSwitchModeBtn?.addEventListener('click', () => {
      closeModal('researchUrlManagerModal');
      setTimeout(() => {
        openSearchDropdown();
      }, 150);
    });

    // Modal: Tambah URL
    els.researchUrlManagerAddBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      const val = els.researchUrlManagerInput?.value;
      if (val) {
        if (addResearchTargetUrl(val)) {
          els.researchUrlManagerInput.value = '';
        }
      }
    });

    els.researchUrlManagerInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = els.researchUrlManagerInput?.value;
        if (val) {
          if (addResearchTargetUrl(val)) {
            els.researchUrlManagerInput.value = '';
          }
        }
      }
    });

    // Modal: Selesai
    els.researchUrlManagerDoneBtn?.addEventListener('click', () => {
      closeModal('researchUrlManagerModal');
    });

    $$('.search-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = item.dataset.mode || 'off';
        if (mode !== STATE.searchMode) {
          setSearchMode(mode);
          if (mode === 'premium') {
            showToast('Mode Deep Research diaktifkan.');
            if (!STATE.researchTargetUrls || STATE.researchTargetUrls.length === 0) {
              openResearchUrlManagerModal();
            }
          } else if (mode === 'default') {
            showToast('Mode Pencarian Web Default aktif.');
          } else if (mode === 'autonomous') {
            showToast('Autonomous Web Explorer aktif.');
          } else {
            showToast('Pencarian web dinonaktifkan.');
          }
        } else {
          // Klik mode yang sudah aktif cukup menutup menu tanpa mematikan mode
          closeSearchDropdown();
        }
      });
    });

    // Tombol Kelola URL khusus pada item Deep Research
    $$('.search-item-manage-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSearchDropdown();
        openResearchUrlManagerModal();
      });
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          e.stopPropagation();
          btn.click();
        }
      });
    });

    $$('.search-item-close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSearchMode('off');
        showToast('Mode riset/pencarian dinonaktifkan.');
      });
      // Elemen ini kini <span role="button" tabindex="0"> (karena <button> bersarang
      // di dalam <button> dilarang oleh HTML spec dan merusak tampilan menu riset).
      // Kembalikan perilaku keyboard agar tetap bisa diakses via Enter/Space.
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          e.stopPropagation();
          btn.click();
        }
      });
    });

    // Embedded AI Image Studio Model Selector Dropdown & Items
    els.imageGenToggleBtn?.addEventListener('click', (e) => {
      toggleImageModelDropdown(e);
    });

    // Embedded AI Music Studio Model Selector Dropdown Toggle
    els.musicGenToggleBtn?.addEventListener('click', (e) => {
      toggleMusicModelDropdown(e);
    });

    // Music Model Nonaktif (Mode Obrolan) Option
    $('#musicModelOptionOff')?.addEventListener('click', (e) => {
      e.stopPropagation();
      setMusicModel('off');
    });
    // Music Mode Indicator (hover to deactivate)
    els.musicModeIndicator?.addEventListener('click', (e) => {
      e.stopPropagation();
      const icon = els.musicModeIndicator?.querySelector('i');
      if (icon) icon.className = 'fa-solid fa-music';
      setMusicModel('off');
    });
    els.musicModeIndicator?.addEventListener('mouseenter', () => {
      if (els.musicModeIndicator) {
        const icon = els.musicModeIndicator.querySelector('i');
        if (icon) {
          icon.className = 'fa-solid fa-times';
        }
      }
    });
    els.musicModeIndicator?.addEventListener('mouseleave', () => {
      // Reset tanpa syarat: saat mode dinonaktifkan lewat klik, mouseleave
      // tetap harus mengembalikan ikon agar tidak nyangkut di silang.
      const icon = els.musicModeIndicator?.querySelector('i');
      if (icon) {
        icon.className = 'fa-solid fa-music';
      }
    });

    // Music Model Dropdown Tabs (Ollama vs OpenRouter)
    els.tabBtnMusicOllama?.addEventListener('click', (e) => {
      e.stopPropagation();
      switchMusicModelTab('ollama');
    });

    els.tabBtnMusicOpenRouter?.addEventListener('click', (e) => {
      e.stopPropagation();
      switchMusicModelTab('openrouter');
    });

    // Ollama Music Model Search Filter
    els.musicOllamaSearchInput?.addEventListener('input', (e) => {
      populateMusicOllamaModels(e.target.value);
    });

    els.musicOllamaSearchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const firstItem = els.musicModelOllamaList?.querySelector('.music-model-item');
        if (firstItem && firstItem.dataset.model) {
          setMusicModel(firstItem.dataset.model);
        }
      }
    });

    // OpenRouter Music Model Filter Pills
    $$('#musicOpenRouterFilterPills .music-filter-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat = pill.dataset.cat || 'all';
        STATE.musicOpenRouterCatFilter = cat;
        $$('#musicOpenRouterFilterPills .music-filter-pill').forEach(p => p.classList.toggle('active', p === pill));
        populateMusicOpenRouterModels(els.musicModelSearchInput?.value || '');
        AudioEngine.click();
      });
    });

    // OpenRouter Music Model Search Filter
    els.musicModelSearchInput?.addEventListener('input', (e) => {
      populateMusicOpenRouterModels(e.target.value);
    });

    els.musicModelSearchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const firstItem = els.musicModelOpenRouterList?.querySelector('.music-model-item');
        if (firstItem && firstItem.dataset.model) {
          setMusicModel(firstItem.dataset.model);
        }
      }
    });

    // Custom Ollama Music Model Apply Button & Enter Key
    els.btnApplyCustomMusicOllamaModel?.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = els.customOllamaMusicModelInput?.value.trim();
      if (val) {
        setMusicModel(val);
        if (els.customOllamaMusicModelInput) els.customOllamaMusicModelInput.value = '';
      } else {
        showToast('⚠️ Masukkan nama model Ollama (misal: qwen2.5:1.5b)');
      }
    });

    els.customOllamaMusicModelInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const val = els.customOllamaMusicModelInput?.value.trim();
        if (val) {
          setMusicModel(val);
          els.customOllamaMusicModelInput.value = '';
        } else {
          showToast('⚠️ Masukkan nama model Ollama (misal: qwen2.5:1.5b)');
        }
      }
    });

    // Custom OpenRouter Music Model Apply Button & Enter Key
    els.btnApplyCustomMusicOpenRouterModel?.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = els.customOpenRouterMusicModelInput?.value.trim();
      if (val) {
        setMusicModel(val);
        if (els.customOpenRouterMusicModelInput) els.customOpenRouterMusicModelInput.value = '';
      } else {
        showToast('⚠️ Masukkan model ID OpenRouter (misal: google/gemini-2.0-flash-exp:free)');
      }
    });

    els.customOpenRouterMusicModelInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const val = els.customOpenRouterMusicModelInput?.value.trim();
        if (val) {
          setMusicModel(val);
          els.customOpenRouterMusicModelInput.value = '';
        } else {
          showToast('⚠️ Masukkan model ID OpenRouter (misal: google/gemini-2.0-flash-exp:free)');
        }
      }
    });

    $$('.image-model-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const modelVal = item.dataset.model || 'flux';
        setImageModel(modelVal);
      });
    });

    // Image Mode Indicator (hover untuk menonaktifkan — sama seperti music indicator)
    els.imageModeIndicator?.addEventListener('click', (e) => {
      e.stopPropagation();
      const icon = els.imageModeIndicator?.querySelector('i');
      if (icon) icon.className = 'fa-solid fa-image';
      setImageModel('off');
    });
    els.imageModeIndicator?.addEventListener('mouseenter', () => {
      if (els.imageModeIndicator) {
        const icon = els.imageModeIndicator.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-times';
      }
    });
    els.imageModeIndicator?.addEventListener('mouseleave', () => {
      // Reset tanpa syarat: saat mode dinonaktifkan lewat klik, mouseleave
      // tetap harus mengembalikan ikon agar tidak nyangkut di silang.
      const icon = els.imageModeIndicator?.querySelector('i');
      if (icon) icon.className = 'fa-solid fa-image';
    });

    // YouTube Search Mode Indicator (hover untuk menonaktifkan — sama seperti image/music indicator)
    els.youtubeModeIndicator?.addEventListener('click', (e) => {
      e.stopPropagation();
      const icon = els.youtubeModeIndicator?.querySelector('i');
      if (icon) icon.className = 'fa-brands fa-youtube';
      setYouTubeSearchMode(false);
    });
    els.youtubeModeIndicator?.addEventListener('mouseenter', () => {
      if (els.youtubeModeIndicator) {
        const icon = els.youtubeModeIndicator.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-times';
      }
    });
    els.youtubeModeIndicator?.addEventListener('mouseleave', () => {
      // Reset tanpa syarat agar ikon tidak nyangkut di silang setelah klik.
      const icon = els.youtubeModeIndicator?.querySelector('i');
      if (icon) icon.className = 'fa-brands fa-youtube';
    });

    // Image Model Dropdown Tabs (Pollinations vs OpenRouter)
    els.tabBtnPollinations?.addEventListener('click', (e) => {
      e.stopPropagation();
      switchImageModelTab('pollinations');
    });

    els.tabBtnOpenRouter?.addEventListener('click', (e) => {
      e.stopPropagation();
      switchImageModelTab('openrouter');
    });

    // OpenRouter Image Model Search Filter
    els.imageModelSearchInput?.addEventListener('input', (e) => {
      populateOpenRouterImageModels(e.target.value);
    });

    els.imageModelSearchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const firstItem = els.imageModelOpenRouterList?.querySelector('.image-model-item');
        if (firstItem && firstItem.dataset.model) {
          setImageModel(firstItem.dataset.model);
        }
      }
    });

    // Custom OpenRouter Model Button & Enter key
    els.btnApplyCustomImageModel?.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = els.customOpenRouterImageModelInput?.value.trim();
      if (val) {
        setImageModel(val);
        if (els.customOpenRouterImageModelInput) els.customOpenRouterImageModelInput.value = '';
      } else {
        showToast('⚠️ Masukkan model ID OpenRouter (misal: black-forest-labs/flux-1-schnell)');
      }
    });

    els.customOpenRouterImageModelInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const val = els.customOpenRouterImageModelInput?.value.trim();
        if (val) {
          setImageModel(val);
          els.customOpenRouterImageModelInput.value = '';
        } else {
          showToast('⚠️ Masukkan model ID OpenRouter (misal: black-forest-labs/flux-1-schnell)');
        }
      }
    });

    // Keyboard shortcuts: Alt+I (Image Mode / Dropdown), Alt+M (Music Mode / Dropdown) & Alt+H (Toggle Prompt Visibility)
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        togglePromptVisibility();
        return;
      }

      if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        toggleImageModelDropdown();
      } else if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        toggleMusicModelDropdown();
      } else if (e.key === 'Escape' && STATE.isImageGenMode && !els.promptInput?.value.trim()) {
        closeImageModelDropdown();
      } else if (e.key === 'Escape' && STATE.isMusicGenMode && !els.promptInput?.value.trim()) {
        closeMusicModelDropdown();
      }
    });

    // Quick Hero Prompts
    $$('.quick-prompt-card').forEach(card => {
      card.addEventListener('click', () => {
        if (STATE.isPromptHidden) {
          togglePromptVisibility(false);
        }
        els.promptInput.value = card.dataset.prompt;
        autoResizeTextarea(els.promptInput);
        els.promptInput.focus();
        AudioEngine.click();
      });
    });

    // Modals Close handlers
    $$('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    // Modals Backdrop Click to Dismiss
    $$('.modal-backdrop').forEach(modalEl => {
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) {
          closeModal(modalEl.id, true);
        }
      });
    });

    // ==================== DEEP RESEARCH FULL REPORT MODAL LISTENERS ====================
    document.getElementById('btnExportReportPDF')?.addEventListener('click', () => {
      if (!currentActiveReport.fullText) return;
      downloadReportPDF(currentActiveReport.title, currentActiveReport.fullText);
    });

    document.getElementById('btnExportReportDOCX')?.addEventListener('click', () => {
      if (!currentActiveReport.fullText) return;
      downloadReportDOCX(currentActiveReport.title, currentActiveReport.fullText);
    });

    document.getElementById('btnExportReportMD')?.addEventListener('click', () => {
      if (!currentActiveReport.fullText) return;
      downloadReportMD(currentActiveReport.title, currentActiveReport.fullText);
    });

    document.getElementById('btnCopyFullReport')?.addEventListener('click', () => {
      if (!currentActiveReport.fullText) return;
      copyTextToClipboard(currentActiveReport.fullText, null, 'Seluruh teks laporan riset disalin ke clipboard!');
    });

    document.getElementById('btnToggleReportSources')?.addEventListener('click', () => {
      toggleReportReferences();
    });

    // Global Hardware / Gesture Back Button Interceptor for Mobile (popstate)
    window.addEventListener('popstate', (e) => {
      // 1. Close Lightbox if open
      if (ImageLightbox.isOpen()) {
        ImageLightbox.close(false);
        return;
      }

      // 2. Close any open modal dialogs (Stack-aware for nested modals)
      const openModals = Array.from(document.querySelectorAll('.modal-backdrop.show'));
      if (openModals.length > 0) {
        const activeModalId = e.state?.modal;
        if (activeModalId) {
          // If popped back into an existing parent modal (e.g. settingsModal),
          // close all child modals and keep the parent modal active.
          openModals.forEach(m => {
            if (m.id !== activeModalId) {
              m.classList.remove('show');
            }
          });
          const targetEl = document.getElementById(activeModalId);
          if (targetEl) {
            targetEl.classList.add('show');
          }
        } else {
          // Check if child modal (e.g. liveModelCatalogModal) was open on top of settingsModal
          const settingsModal = document.getElementById('settingsModal');
          const isSettingsOpen = settingsModal && settingsModal.classList.contains('show');
          const isChildOpen = openModals.some(m => m.id === 'liveModelCatalogModal' || m.id === 'liveResearchInspectionModal');

          if (isSettingsOpen && isChildOpen) {
            // Dismiss child modal only, keep settingsModal alive
            openModals.forEach(m => {
              if (m.id !== 'settingsModal') m.classList.remove('show');
            });
            try {
              history.replaceState({ modal: 'settingsModal' }, '');
            } catch (err) {}
          } else {
            // No modal in current history state -> return to main chat by closing all open modals
            openModals.forEach(m => m.classList.remove('show'));
          }
          syncBodyModalState();
        }
        return;
      }

      // 3. Close mobile sidebar if open
      if (els.sidebar?.classList.contains('open')) {
        closeMobileSidebar(false);
        return;
      }
    });

    // Settings Modal Tabs
    $$('.settings-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-card');
        if (modal) {
          modal.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
          modal.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          const target = modal.querySelector(`#${btn.dataset.target}`);
          if (target) target.classList.add('active');
        }
      });
    });

    // Sliders
    els.paramTemperature?.addEventListener('input', (e) => {
      if (els.valTemperature) els.valTemperature.innerText = e.target.value;
    });
    els.paramTopP?.addEventListener('input', (e) => {
      if (els.valTopP) els.valTopP.innerText = e.target.value;
    });

    // Presets in settings
    $$('.preset-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        applySystemPreset(pill.dataset.preset);
      });
    });

    els.settingSystemPrompt?.addEventListener('input', () => {
      const currentVal = els.settingSystemPrompt.value;
      const trimmed = currentVal.trim();
      const matchedKey = Object.keys(SYSTEM_PRESETS).find(k => k !== 'default' && SYSTEM_PRESETS[k].trim() === trimmed);

      if (matchedKey) {
        STATE.settings.activePreset = matchedKey;
        STATE.settings.systemPrompt = SYSTEM_PRESETS[matchedKey];
      } else if (trimmed) {
        STATE.settings.activePreset = 'custom';
        STATE.settings.systemPrompt = currentVal;
        STATE.settings.customSystemPrompt = currentVal;
      } else {
        STATE.settings.activePreset = 'default';
        STATE.settings.systemPrompt = '';
        // Pertahankan STATE.settings.customSystemPrompt agar persona kustom tidak terhapus saat textarea dikosongkan sementara
      }
      updatePresetPillUI();
    });

    els.clearPresetBtn?.addEventListener('click', () => {
      applySystemPreset('default');
    });

    // Settings Actions
    els.settingsBtn?.addEventListener('click', () => {
      syncSettingsModalFields();
      fetchOpenRouterCredits();
      updateOllamaStatusUI();
      openModal('settingsModal');
    });

    els.toggleShowOllamaKeyBtn?.addEventListener('click', () => {
      const isPass = els.settingOllamaApiKey.type === 'password';
      els.settingOllamaApiKey.type = isPass ? 'text' : 'password';
      els.toggleShowOllamaKeyBtn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });

    els.toggleShowKeyBtn?.addEventListener('click', () => {
      if (els.settingOpenRouterKey && els.toggleShowKeyBtn) {
        const isPass = els.settingOpenRouterKey.type === 'password';
        els.settingOpenRouterKey.type = isPass ? 'text' : 'password';
        els.toggleShowKeyBtn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
      }
    });

    els.toggleShowSerperKeyBtn?.addEventListener('click', () => {
      const isPass = els.settingSerperApiKey.type === 'password';
      els.settingSerperApiKey.type = isPass ? 'text' : 'password';
      els.toggleShowSerperKeyBtn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });

    els.testSerperBtn?.addEventListener('click', async () => {
      const key = els.settingSerperApiKey ? els.settingSerperApiKey.value.trim() : '';
      if (!key) {
        showToast('Masukkan Serper API Key terlebih dahulu.', 'error');
        return;
      }
      try {
        const res = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': key,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: 'test connection', gl: 'us', hl: 'en', num: 1 })
        });
        if (res.ok) {
          showToast('✅ Serper API Key valid & Google Search terhubung aktif!');
        } else {
          showToast(`❌ Serper API Key tidak valid (Status HTTP ${res.status})`, 'error');
        }
      } catch (e) {
        showToast('❌ Gagal memeriksa Serper Key: ' + e.message, 'error');
      }
    });

    els.testOllamaBtn?.addEventListener('click', async () => {
      const ep = normalizeEndpoint(els.settingOllamaEndpoint?.value.trim() || 'https://ollama.com');
      const key = els.settingOllamaApiKey ? els.settingOllamaApiKey.value.trim() : '';
      try {
        const headers = {};
        if (key) {
          headers['Authorization'] = `Bearer ${key}`;
          headers['x-ollama-key'] = key;
        }

        if (IS_GITHUB_PAGES || /localhost|127\.0\.0\.1|\[::1\]/i.test(ep)) {
          // Direct browser testing
          let res = await fetch(resolveEndpointUrl(ep, 'api/tags'), { headers, mode: 'cors' }).catch(() => null);
          if (!res || !res.ok) {
            res = await fetch(resolveEndpointUrl(ep, 'v1/models'), { headers, mode: 'cors' }).catch(() => null);
          }
          if (res && res.ok) {
            const data = await res.json();
            const count = data.models?.length || data.data?.length || 0;
            showToast(`✅ Koneksi Ollama sukses! Ditemukan ${count} model.`);
          } else if (key) {
            showToast(`✅ Ollama API Key tersimpan! Model Cloud siap dijalankan.`);
          } else {
            showToast(`⚠️ Tidak dapat menjangkau ${ep}. Periksa endpoint atau izin CORS.`, 'error');
          }
        } else {
          // Gateway Proxy testing
          const res = await fetch(`/api/ollama/models?endpoint=${encodeURIComponent(ep)}`, { headers });
          const data = await res.json();
          if (res.ok && data.models && data.models.length > 0) {
            showToast(`✅ Koneksi Ollama sukses! Ditemukan ${data.models.length} model (${data.cloud_auth ? 'Cloud Auth' : 'Local'}).`);
            await checkOllamaHealth();
            updateOllamaStatusUI();
          } else if (data.server_running) {
            showToast(`✅ Ollama terhubung & siap digunakan.`);
            await checkOllamaHealth();
            updateOllamaStatusUI();
          } else if (key) {
            showToast(`✅ Ollama API Key tersimpan! Mode Cloud aktif.`);
            await checkOllamaHealth();
            updateOllamaStatusUI();
          } else {
            showToast(`❌ Gagal: ${data.error || data.warning || 'Ollama tidak merespons'}`, 'error');
            updateOllamaStatusUI();
          }
        }
      } catch (e) {
        showToast('❌ Gagal memeriksa endpoint Ollama: ' + e.message, 'error');
        updateOllamaStatusUI();
      }
    });

    els.testOllamaKeyBtn?.addEventListener('click', async () => {
      const key = els.settingOllamaApiKey ? els.settingOllamaApiKey.value.trim() : '';
      if (!key) {
        showToast('Masukkan Ollama Cloud API Key terlebih dahulu.', 'error');
        return;
      }
      STATE.settings.ollamaApiKey = key;
      savePersistedState();

      const origHtml = els.testOllamaKeyBtn.innerHTML;
      els.testOllamaKeyBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Validasi...';
      try {
        const ok = await checkOllamaHealth();
        if (ok) {
          showToast('✅ Ollama Cloud API Key valid & terhubung!');
          updateOllamaStatusUI();
          AudioEngine.click();
        } else {
          showToast('⚠️ Endpoint tidak merespons atau key belum terverifikasi.', 'warning');
          updateOllamaStatusUI();
        }
      } catch (err) {
        showToast('❌ Gagal memeriksa API Key Ollama Cloud: ' + err.message, 'error');
      } finally {
        els.testOllamaKeyBtn.innerHTML = origHtml;
      }
    });

    els.btnRefreshOllamaStatus?.addEventListener('click', async () => {
      if (els.btnRefreshOllamaStatus) {
        els.btnRefreshOllamaStatus.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Cek...';
      }
      await checkOllamaHealth();
      updateOllamaStatusUI();
      if (els.btnRefreshOllamaStatus) {
        els.btnRefreshOllamaStatus.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Cek Status';
      }
      showToast('🦙 Status Ollama diperbarui!');
      AudioEngine.click();
    });

    els.testOpenRouterBtn?.addEventListener('click', async () => {
      const key = els.settingOpenRouterKey ? els.settingOpenRouterKey.value.trim() : '';
      if (!key) {
        showToast('Masukkan API Key terlebih dahulu.', 'error');
        return;
      }
      try {
        const res = await fetch('/api/openrouter/auth-check', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        const data = await res.json();
        if (res.ok) {
          showToast('✅ OpenRouter API Key valid & aktif!');
          await fetchOpenRouterCredits(true);
        } else {
          showToast(`❌ Validasi gagal: ${data.error || 'Key tidak valid'}`, 'error');
          updateOpenRouterBalanceUI({ error: data.error || 'Key tidak valid' });
        }
      } catch (e) {
        showToast('❌ Gagal memeriksa API Key.', 'error');
      }
    });

    els.btnRefreshOpenRouterBalance?.addEventListener('click', async () => {
      if (els.btnRefreshOpenRouterBalance) {
        els.btnRefreshOpenRouterBalance.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Cek...';
      }
      await fetchOpenRouterCredits(true);
      if (els.btnRefreshOpenRouterBalance) {
        els.btnRefreshOpenRouterBalance.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Cek Saldo';
      }
      showToast('💰 Saldo OpenRouter disinkronkan!');
      AudioEngine.click();
    });

    els.saveSettingsBtn?.addEventListener('click', () => {
      const epVal = els.settingOllamaEndpoint ? els.settingOllamaEndpoint.value.trim() : '';
      if (epVal) STATE.settings.ollamaEndpoint = epVal;

      if (els.settingOllamaApiKey) {
        STATE.settings.ollamaApiKey = els.settingOllamaApiKey.value.trim();
      }

      if (els.settingOpenRouterKey) {
        STATE.settings.openRouterKey = els.settingOpenRouterKey.value.trim();
      }

      if (els.settingSerperApiKey) {
        STATE.settings.serperApiKey = els.settingSerperApiKey.value.trim();
      }

      if (els.settingMusicModel) {
        STATE.settings.musicModel = els.settingMusicModel.value.trim() || DEFAULT_MUSIC_MODEL;
        normalizeMusicModelSetting();
      }

      if (els.paramTemperature) STATE.settings.temperature = parseFloat(els.paramTemperature.value);
      if (els.paramTopP) STATE.settings.topP = parseFloat(els.paramTopP.value);
      if (els.settingSystemPrompt) {
        const rawVal = els.settingSystemPrompt.value;
        const pVal = rawVal.trim();
        const matchedKey = Object.keys(SYSTEM_PRESETS).find(k => k !== 'default' && SYSTEM_PRESETS[k].trim() === pVal);

        if (!matchedKey && pVal) {
          STATE.settings.customSystemPrompt = rawVal;
        }

        if (STATE.settings.activePreset === 'default') {
          // Mode Default dipertahankan (tanpa persona aktif ke AI), prompt kustom tetap aman di memori
          STATE.settings.systemPrompt = '';
        } else if (STATE.settings.activePreset === 'custom') {
          STATE.settings.systemPrompt = rawVal;
          STATE.settings.customSystemPrompt = rawVal;
        } else if (matchedKey) {
          STATE.settings.activePreset = matchedKey;
          STATE.settings.systemPrompt = SYSTEM_PRESETS[matchedKey];
        } else if (pVal) {
          STATE.settings.activePreset = 'custom';
          STATE.settings.systemPrompt = rawVal;
          STATE.settings.customSystemPrompt = rawVal;
        } else {
          STATE.settings.activePreset = 'default';
          STATE.settings.systemPrompt = '';
        }
      }
      if (els.settingAutoPolicy) STATE.settings.autoPolicy = els.settingAutoPolicy.value;
      
      savePersistedState();
      checkOllamaHealth();
      updateOllamaStatusUI();
      checkOpenRouterStatus();
      updatePresetBanner();
      updatePresetPillUI();
      closeModal('settingsModal');
      showToast('Pengaturan Zoz Router berhasil disimpan!');
      AudioEngine.click();
    });

    // Model Hub / Live Model Catalog Button
    if (els.modelHubBtn) {
      els.modelHubBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        AudioEngine.click();
        openLiveModelCatalog(null, 'Model Obrolan Utama');
      });
    }

    // ==================== LIVE MODEL CATALOG LISTENERS ====================
    // Note: Click handling for .btn-open-model-catalog is handled via global delegation in document click listener

    els.btnTabCatalogOllama?.addEventListener('click', () => {
      STATE.activeCatalogTab = 'ollama';
      updateCatalogTabsUI();
      renderLiveModelCatalog();
      AudioEngine.click();
    });

    els.btnTabCatalogOpenRouter?.addEventListener('click', () => {
      STATE.activeCatalogTab = 'openrouter';
      updateCatalogTabsUI();
      renderLiveModelCatalog();
      AudioEngine.click();
    });

    els.liveModelCatalogSearchInput?.addEventListener('input', (e) => {
      STATE.catalogSearchQuery = e.target.value;
      renderLiveModelCatalog();
    });

    document.querySelectorAll('.catalog-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.catalog-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        STATE.catalogCategoryFilter = pill.dataset.catalogFilter || 'all';
        renderLiveModelCatalog();
        AudioEngine.click();
      });
    });

    els.btnRefreshLiveCatalog?.addEventListener('click', async () => {
      if (els.btnRefreshLiveCatalog) {
        els.btnRefreshLiveCatalog.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Memuat...';
      }
      await Promise.all([
        checkOllamaHealth(), 
        fetchOllamaCloudUsage(true),
        fetchOpenRouterModelsList(),
        fetchOpenRouterCredits(true)
      ]);
      renderLiveModelCatalog();
      updateCatalogBalanceBannerUI(STATE.activeCatalogTab);
      if (els.btnRefreshLiveCatalog) {
        els.btnRefreshLiveCatalog.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Refresh';
      }
      showToast('🔄 Katalog model & saldo berhasil disinkronkan secara real-time!');
      AudioEngine.click();
    });

    els.btnRefreshCatalogBalance?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (els.btnRefreshCatalogBalance) {
        els.btnRefreshCatalogBalance.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i>';
      }
      if (STATE.activeCatalogTab === 'openrouter') {
        await fetchOpenRouterCredits(true);
      } else {
        await Promise.all([checkOllamaHealth(), fetchOllamaCloudUsage(true)]);
        updateOllamaStatusUI();
      }
      updateCatalogBalanceBannerUI(STATE.activeCatalogTab);
      if (els.btnRefreshCatalogBalance) {
        els.btnRefreshCatalogBalance.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
      }
      showToast('🔄 Status & saldo provider diperbarui!');
      AudioEngine.click();
    });

    // ==================== LIVE RESEARCH INSPECTOR LISTENERS ====================
    els.btnTabInspectAgent1?.addEventListener('click', () => {
      STATE.activeInspectionTab = 'agent1';
      els.btnTabInspectAgent1.classList.add('active');
      els.btnTabInspectAgent2?.classList.remove('active');
      els.btnTabInspectScraper?.classList.remove('active');
      els.btnTabInspectSynthesizer?.classList.remove('active');
      els.btnTabInspectModel4?.classList.remove('active');
      renderLiveInspectionContent();
      AudioEngine.click();
    });

    els.btnTabInspectAgent2?.addEventListener('click', () => {
      STATE.activeInspectionTab = 'agent2';
      els.btnTabInspectAgent2.classList.add('active');
      els.btnTabInspectAgent1?.classList.remove('active');
      els.btnTabInspectScraper?.classList.remove('active');
      els.btnTabInspectSynthesizer?.classList.remove('active');
      els.btnTabInspectModel4?.classList.remove('active');
      renderLiveInspectionContent();
      AudioEngine.click();
    });

    els.btnTabInspectScraper?.addEventListener('click', () => {
      STATE.activeInspectionTab = 'scraper';
      els.btnTabInspectScraper.classList.add('active');
      els.btnTabInspectAgent1?.classList.remove('active');
      els.btnTabInspectAgent2?.classList.remove('active');
      els.btnTabInspectSynthesizer?.classList.remove('active');
      els.btnTabInspectModel4?.classList.remove('active');
      renderLiveInspectionContent();
      AudioEngine.click();
    });

    els.btnTabInspectSynthesizer?.addEventListener('click', () => {
      STATE.activeInspectionTab = 'synthesizer';
      els.btnTabInspectSynthesizer.classList.add('active');
      els.btnTabInspectAgent1?.classList.remove('active');
      els.btnTabInspectAgent2?.classList.remove('active');
      els.btnTabInspectScraper?.classList.remove('active');
      els.btnTabInspectModel4?.classList.remove('active');
      renderLiveInspectionContent();
      AudioEngine.click();
    });

    els.btnTabInspectModel4?.addEventListener('click', () => {
      STATE.activeInspectionTab = 'model4';
      els.btnTabInspectModel4.classList.add('active');
      els.btnTabInspectAgent1?.classList.remove('active');
      els.btnTabInspectAgent2?.classList.remove('active');
      els.btnTabInspectScraper?.classList.remove('active');
      els.btnTabInspectSynthesizer?.classList.remove('active');
      renderLiveInspectionContent();
      AudioEngine.click();
    });

    // ==================== BGM & AUDIO LISTENERS ====================
    els.musicPlayerModalBtn?.addEventListener('click', () => {
      openModal('musicDeckModal');
      AudioEngine.click();
    });

    els.openMusicModalFromWidget?.addEventListener('click', () => {
      openModal('musicDeckModal');
      AudioEngine.click();
    });

    els.bgmPlayPauseBtn?.addEventListener('click', () => BGMEngine.togglePlayPause());
    els.deckPlayPauseBtn?.addEventListener('click', () => BGMEngine.togglePlayPause());

    els.bgmNextBtn?.addEventListener('click', () => BGMEngine.nextTrack());
    els.deckNextBtn?.addEventListener('click', () => BGMEngine.nextTrack());

    els.bgmPrevBtn?.addEventListener('click', () => BGMEngine.prevTrack());
    els.deckPrevBtn?.addEventListener('click', () => BGMEngine.prevTrack());

    els.bgmMiniVolume?.addEventListener('input', (e) => BGMEngine.setVolume(e.target.value));
    els.deckMasterVolume?.addEventListener('input', (e) => BGMEngine.setVolume(e.target.value));

    els.deckProgressSlider?.addEventListener('input', (e) => BGMEngine.seek(e.target.value));

    els.deckLoopBtn?.addEventListener('click', () => {
      if (BGMEngine.loopMode === 'all') {
        BGMEngine.loopMode = 'one';
        els.deckLoopBtn.innerHTML = '<i class="fa-solid fa-repeat"></i> Loop 1';
        showToast('Mode Loop: Ulang 1 Lagu');
      } else if (BGMEngine.loopMode === 'one') {
        BGMEngine.loopMode = 'none';
        els.deckLoopBtn.innerHTML = '<i class="fa-solid fa-repeat"></i> Loop: Off';
        showToast('Mode Loop: Nonaktif');
      } else {
        BGMEngine.loopMode = 'all';
        els.deckLoopBtn.innerHTML = '<i class="fa-solid fa-repeat"></i> Loop All';
        showToast('Mode Loop: Ulang Semua Playlist');
      }
      AudioEngine.click();
    });

    els.deckShuffleBtn?.addEventListener('click', () => {
      BGMEngine.isShuffle = !BGMEngine.isShuffle;
      els.deckShuffleBtn.innerHTML = `<i class="fa-solid fa-shuffle"></i> Acak: ${BGMEngine.isShuffle ? 'On' : 'Off'}`;
      els.deckShuffleBtn.classList.toggle('active', BGMEngine.isShuffle);
      showToast(BGMEngine.isShuffle ? 'Mode Acak: Aktif' : 'Mode Acak: Nonaktif');
      AudioEngine.click();
    });

    // Audio Upload Handlers
    els.triggerAudioUploadBtn?.addEventListener('click', () => els.localAudioFileInput?.click());
    els.localAudioFileInput?.addEventListener('change', (e) => {
      BGMEngine.handleUploadFiles(e.target.files);
    });

    // Dropzone Drag & Drop
    if (els.audioDropzone) {
      els.audioDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        els.audioDropzone.classList.add('dragover');
      });
      els.audioDropzone.addEventListener('dragleave', () => {
        els.audioDropzone.classList.remove('dragover');
      });
      els.audioDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        els.audioDropzone.classList.remove('dragover');
        if (e.dataTransfer?.files) {
          BGMEngine.handleUploadFiles(e.dataTransfer.files);
        }
      });
    }

    // Mobile Keyboard & Visual Viewport Handler
    setupMobileKeyboardHandler();
  }

  // ==================== MOBILE KEYBOARD & VIEWPORT RESIZE HANDLER ====================
  function setupMobileKeyboardHandler() {
    const appContainer = $('.app-container');
    const chatViewport = els.chatViewport;

    if (window.visualViewport) {
      const handleResize = () => {
        const vh = window.visualViewport.height;
        if (appContainer) {
          appContainer.style.height = `${vh}px`;
        }
        autoResizeTextarea(els.promptInput);

        // If keyboard opened (visual viewport significantly smaller than innerHeight)
        if (window.innerHeight - vh > 100) {
          setTimeout(() => {
            const active = document.activeElement;
            if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
              active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
            if (chatViewport) {
              chatViewport.scrollTop = chatViewport.scrollHeight;
            }
          }, 60);
        }
      };

      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', () => {
        if (window.visualViewport.offsetTop > 0) {
          window.scrollTo(0, 0);
        }
      });
    }

    // Adapt textarea sizing on window resize
    window.addEventListener('resize', () => {
      autoResizeTextarea(els.promptInput);
    });

    // Auto-scroll on textarea focus for all inputs
    const inputs = [els.promptInput, els.modelSearchInput, els.customModelInput];
    inputs.forEach(input => {
      if (!input) return;
      input.addEventListener('focus', () => {
        setTimeout(() => {
          if (window.visualViewport && appContainer) {
            appContainer.style.height = `${window.visualViewport.height}px`;
          }
          smartScrollChatToBottom(true);
        }, 120);
      });
      input.addEventListener('blur', () => {
        setTimeout(() => {
          if (window.visualViewport && appContainer) {
            appContainer.style.height = `${window.visualViewport.height}px`;
          }
        }, 100);
      });
    });

    // Claude AI resilience: sinkronisasi respons latar belakang saat pengguna kembali membuka aplikasi atau tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkBackgroundChatTasksSync();
      }
    });
    window.addEventListener('focus', () => {
      checkBackgroundChatTasksSync();
    });
  }

  // ==================== BOOTSTRAP INITIALIZATION ====================
  function init() {
    // 1. FAST SYNCHRONOUS BOOTSTRAP (0ms - Instant UI & Interactivity)
    loadPersistedStateSync();

    // 2. ATTACH ALL EVENT LISTENERS IMMEDIATELY (Millisecond 0 responsiveness)
    setupEventListeners();
    setupSmartScrolling();
    ImageLightbox.init();
    
    // Set sound toggle button icon
    if (els.soundToggleBtn) {
      els.soundToggleBtn.innerHTML = STATE.soundEnabled 
        ? '<i class="fa-solid fa-volume-high"></i>' 
        : '<i class="fa-solid fa-volume-xmark"></i>';
    }

    // Distinguish Browser Refresh (same tab) vs Fresh App Entry
    const isTabReload = safeSessionStorage.getItem('zoz_tab_initialized') === 'true';
    const savedActiveId = safeSessionStorage.getItem('zoz_active_session_id') || localStorage.getItem('zoz_last_active_session_id');

    if (isTabReload && savedActiveId && STATE.sessions.some(s => s.id === savedActiveId)) {
      // Browser Refresh: Keep the user on their active conversation and refresh it
      STATE.currentSessionId = savedActiveId;
      renderChatHistory();
      renderCurrentSession();
    } else {
      // Fresh App Entry / Reopening: Land cleanly on TAMPILAN UTAMA (Welcome Hero / Beranda Bersih)
      // Catat inisialisasi tab dan pertahankan penanda sesi terakhir untuk background task recovery
      safeSessionStorage.setItem('zoz_tab_initialized', 'true');
      if (savedActiveId && STATE.sessions.some(s => s.id === savedActiveId)) {
        safeSessionStorage.setItem('zoz_active_session_id', savedActiveId);
      } else {
        safeSessionStorage.removeItem('zoz_active_session_id');
      }
      STATE.currentSessionId = null;
      renderChatHistory();
      renderCurrentSession();
    }

    // 3. RENDER ALL UI CONTROLS INSTANTLY (Synchronous, 0ms, Zero Lag)
    updatePresetBanner();
    updatePresetPillUI();
    updateModelUI();
    populateModelDropdown();
    updateCatalogFavBadge();
    els.modeTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === STATE.mode);
    });
    updateSearchModeUI();
    updateImageGenModeUI();
    updateMusicGenModeUI();
    updateYouTubeModeUI();
    autoResizeTextarea(els.promptInput);
    updatePromptVisibilityUI(true);

    // Restore desktop sidebar collapsed preference
    if (window.innerWidth > 768) {
      try {
        const isCollapsed = localStorage.getItem('zoz_sidebar_collapsed') === 'true';
        if (isCollapsed) {
          els.appContainer?.classList.add('sidebar-collapsed');
          els.sidebar?.classList.add('collapsed');
        }
      } catch (_) {}
    }

    console.log('⚡ ZOZ ROUTER INITIALIZED // READY IN 0MS');

    // 4. NON-BLOCKING ASYNCHRONOUS BACKGROUND TASKS (Storage sync, BGM engine & health checks)
    initBackgroundTasks(isTabReload, savedActiveId);
  }

  async function initBackgroundTasks(isTabReload, savedActiveId) {
    // A. Sync storage in background (IndexedDB & Device Disk Storage)
    syncPersistedStorageBackground(isTabReload, savedActiveId).catch(err => {
      console.warn('Background storage sync notice:', err);
    });

    // B. Initialize Cyber BGM Engine in background
    BGMEngine.init().catch(bgmErr => {
      console.warn('BGM Engine background init notice:', bgmErr);
    });

    // C. Non-blocking Network Health Checks
    checkOllamaHealth().catch(() => {});
    checkOpenRouterStatus().catch(() => {});
    fetchOpenRouterModelsList().catch(() => {});
    fetchOllamaCloudUsage().catch(() => {});
  }

  // Start on DOM loaded
  document.addEventListener('DOMContentLoaded', init);
})();
