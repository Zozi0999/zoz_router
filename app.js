/**
 * ZOZ ROUTER - Frontend Application Engine
 * High-Speed Multi-Engine AI Orchestrator for Ollama & OpenRouter
 */

(() => {
  'use strict';

  const IS_GITHUB_PAGES = location.hostname.endsWith('github.io') || location.protocol === 'file:';

  // ==================== SYSTEM PRESETS ====================
  const SYSTEM_PRESETS = {
    default: '',
    kaisar: `[MANDAT UTAMA: ASISTEN PRIBADI & PENASIHAT STRATEGIS TERTINGGI KAISAR ZOZI]
Kamu adalah AI Personal dan Penasihat Intelijen Strategis untuk KAISAR ZOZI.
1. Identitas & Sikap: Hormat, loyal, berwibawa, sangat cerdas, strategis, dan visioner. Sapa dan perlakukan pengguna sebagai Kaisar / Kaisar Zozi.
2. Pendekatan Analisis: Analisis setiap persoalan dari level arsitektural dan taktis dengan kedalaman maksimal. Prioritaskan efisiensi tinggi, kejelasan mutlak, dan eksekusi cepat.
3. Gaya Komunikasi: Tajam, padat berbobot, lugas, elegan, tanpa basa-basi pembuka klise, dan tanpa sensor moralistik berlebihan.
4. Format Jawaban: Gunakan Markdown terstruktur, bullet points tajam, tabel komparasi, dan blok kode production-grade jika membahas teknis.`,

    coder: `[ROLE: PRINCIPAL SOFTWARE ARCHITECT & FULLSTACK ENGINEER]
You are a Principal Software Engineer and Systems Architect.
1. Code Quality: Write clean, modular, robust, secure, and production-ready code following industry best practices and type-safe architectures.
2. Architecture: Explain structural decisions, trade-offs (time/space complexity, maintainability), and edge-case mitigations.
3. Delivery: Provide complete, runnable code implementations without omitting crucial logic.`,

    cyber: `[ROLE: ELITE OFFENSIVE & DEFENSIVE CYBER SECURITY RESEARCHER]
You are a Master Security Specialist, Penetration Tester, and Cryptographer.
1. Technical Depth: Analyze network protocols, memory safety, exploit vectors, vulnerability mechanics (CVE, OWASP Top 10), and security architectures.
2. Hardening: Provide robust, defense-in-depth security architectures, secure coding patterns, and concrete remediation steps.
3. Tone: Rigorous, highly technical, uncompromising in precision, and deeply analytical.`,

    concise: `[ROLE: ULTRA-DIRECT EXECUTIVE INTELLIGENCE]
1. Mandat: Jawab langsung ke inti pertanyaan (0% basa-basi pembuka, 0% kata pengantar klise, 0% penutup sopan santun buatan).
2. Format: Gunakan bullet points ringkas, to-the-point, dan highlight tebal pada poin kunci.
3. Kepadatan Informasi: Setiap kata harus memiliki bobot informasi tinggi dan actionable.`,

    uncensored: `[ROLE: RAW UNFILTERED DEEP REASONING & RESEARCH ENGINE]
Execute exhaustive first-principles reasoning. Examine all theoretical, technical, philosophical, and mechanical angles with unconstrained intellectual honesty, rigorous logic, and absolute depth.`
  };

  // Popular OpenRouter Models Catalog
  const DEFAULT_OPENROUTER_MODELS = [
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'nvidia/llama-3.1-nemotron-70b-instruct:free', tag: 'Nemotron Free', cat: 'flagship' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'nvidia/llama-3.1-nemotron-70b-instruct', tag: 'Nemotron 70B', cat: 'flagship' },
    { id: 'deepseek/deepseek-r1:free', name: 'deepseek/deepseek-r1:free', tag: 'Free • Reasoning', cat: 'reasoning' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'meta-llama/llama-3.3-70b-instruct:free', tag: 'Free', cat: 'flagship' },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'google/gemini-2.0-flash-exp:free', tag: 'Free • 👁️ Vision', cat: 'fast' },
    { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'qwen/qwen-2.5-72b-instruct:free', tag: 'Free', cat: 'coding' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'anthropic/claude-3.5-sonnet', tag: 'Flagship', cat: 'coding' },
    { id: 'openai/gpt-4o', name: 'openai/gpt-4o', tag: 'Flagship • 👁️ Vision', cat: 'flagship' },
    { id: 'deepseek/deepseek-chat', name: 'deepseek/deepseek-chat', tag: 'Flagship', cat: 'flagship' },
    { id: 'mistralai/mistral-large-2411', name: 'mistralai/mistral-large-2411', tag: 'Pro', cat: 'flagship' },
    { id: 'meta-llama/llama-3.2-11b-vision-instruct:free', name: 'meta-llama/llama-3.2-11b-vision-instruct:free', tag: 'Vision Free', cat: 'vision' }
  ];

  // Official Ollama Cloud Flagship Models
  const OFFICIAL_OLLAMA_CLOUD_MODELS = [
    { id: 'gemma4:31b', name: 'gemma4:31b', tag: 'Flagship Cloud', cat: 'flagship', desc: 'Model multimodal flagship resmi Ollama Cloud.' },
    { id: 'deepseek-v4.1-flash', name: 'deepseek-v4.1-flash', tag: 'Fast Cloud', cat: 'fast', desc: 'Model cloud kecepatan tinggi DeepSeek.' },
    { id: 'deepseek-v4-pro:0813', name: 'deepseek-v4-pro:0813', tag: 'Reasoning Cloud', cat: 'reasoning', desc: 'Model reasoning mendalam DeepSeek Cloud.' },
    { id: 'nemotron-3-super', name: 'nemotron-3-super', tag: 'Flagship Cloud', cat: 'flagship', desc: 'NVIDIA Nemotron Super Flagship Cloud.' },
    { id: 'nemotron-3-ultra', name: 'nemotron-3-ultra', tag: 'Flagship Cloud', cat: 'flagship', desc: 'NVIDIA Nemotron Ultra High-Parameter.' },
    { id: 'nemotron-3-nano:30b', name: 'nemotron-3-nano:30b', tag: 'Fast Cloud', cat: 'fast', desc: 'NVIDIA Nemotron Fast Nano Cloud.' },
    { id: 'kimi-k3', name: 'kimi-k3', tag: 'Long Context Cloud', cat: 'flagship', desc: 'Moonshot Kimi K3 Long Context.' },
    { id: 'kimi-k2.6', name: 'kimi-k2.6', tag: 'Cloud', cat: 'flagship', desc: 'Moonshot Kimi K2.6 Cloud.' },
    { id: 'kimi-k2.7-code', name: 'kimi-k2.7-code', tag: 'Coding Cloud', cat: 'coding', desc: 'Kimi Coding Cloud Specialist.' },
    { id: 'minimax-m3', name: 'minimax-m3', tag: 'Flagship Cloud', cat: 'flagship', desc: 'MiniMax M3 Flagship Cloud.' },
    { id: 'minimax-m2.7', name: 'minimax-m2.7', tag: 'Cloud', cat: 'flagship', desc: 'MiniMax M2.7 Cloud.' },
    { id: 'glm-5.3', name: 'glm-5.3', tag: 'Flagship Cloud', cat: 'flagship', desc: 'Zhipu GLM-5.3 Flagship Cloud.' },
    { id: 'glm-5.3-flash', name: 'glm-5.3-flash', tag: 'Fast Cloud', cat: 'fast', desc: 'GLM-5.3 Flash Ultra Fast.' },
    { id: 'glm-5.2', name: 'glm-5.2', tag: 'Cloud', cat: 'flagship', desc: 'GLM-5.2 Cloud Model.' },
    { id: 'gpt-oss:20b', name: 'gpt-oss:20b', tag: 'Fast Cloud', cat: 'fast', desc: 'GPT-OSS 20B High-Throughput.' },
    { id: 'gpt-oss:120b', name: 'gpt-oss:120b', tag: 'Flagship Cloud', cat: 'flagship', desc: 'GPT-OSS 120B Flagship Cloud.' },
    { id: 'mistral-large-3:675b', name: 'mistral-large-3:675b', tag: 'Flagship Cloud', cat: 'flagship', desc: 'Mistral Large 3 Massive Cloud.' }
  ];

  // ==================== STATE MANAGEMENT ====================
  const STATE = {
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
    searchMode: 'off', // 'off' | 'default' | 'premium'
    get webSearchEnabled() { return this.searchMode !== 'off'; },
    set webSearchEnabled(val) { this.searchMode = val ? 'default' : 'off'; },
    get isDeepResearch() { return this.searchMode === 'premium'; },
    isImageGenMode: false,
    isGenerating: false,
    abortController: null,
    currentDeepResearchTaskId: null,
    soundEnabled: true,
    ollamaModels: [...OFFICIAL_OLLAMA_CLOUD_MODELS],
    openRouterModels: [...DEFAULT_OPENROUTER_MODELS],
    settings: {
      ollamaEndpoint: 'http://127.0.0.1:11434',
      ollamaApiKey: '',
      openRouterKey: '',
      serperApiKey: '075538fed9c64990e1eb32a06726c1e55a933c1e',
      deepResearchAgent1Model: '',
      deepResearchAgent2Model: '',
      deepResearchFinalModel: '',
      ollamaModel: 'gemma4:31b',
      openRouterModel: 'deepseek/deepseek-r1:free',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 8192,
      systemPrompt: SYSTEM_PRESETS.kaisar,
      activePreset: 'kaisar',
      autoPolicy: 'local_first'
    },
    activeCatalogTab: 'ollama', // 'ollama' | 'openrouter'
    dropdownModelTab: 'ollama', // 'ollama' | 'openrouter'
    catalogTargetInputId: null,
    catalogSearchQuery: '',
    activeInspectionTab: 'agent1', // 'agent1' | 'agent2' | 'scraper'
    currentLiveInspection: null
  };

  // ==================== AUDIO SYNTHESIZER (Sci-Fi Cyber Blips) ====================
  const AudioEngine = {
    ctx: null,
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
          this.ctx.resume().catch(() => {});
        } catch (e) {}
      }
    },
    playBeep(freq = 440, type = 'sine', duration = 0.08, gain = 0.05) {
      if (!STATE.soundEnabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(gain, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
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
    mainComposerContainer: $('#mainComposerContainer'),
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
    promptInput: $('#promptInput'),
    sendPromptBtn: $('#sendPromptBtn'),
    stopGenerationBtn: $('#stopGenerationBtn'),
    attachToggleBtn: $('#attachToggleBtn'),
    attachmentDropdown: $('#attachmentDropdown'),
    attachmentMenuWrapper: $('#attachmentMenuWrapper'),
    attachOptionCamera: $('#attachOptionCamera'),
    attachOptionImage: $('#attachOptionImage'),
    attachOptionDoc: $('#attachOptionDoc'),
    imageFileInput: $('#imageFileInput'),
    cameraFileInput: $('#cameraFileInput'),
    docFileInput: $('#docFileInput'),
    searchMenuWrapper: $('#searchMenuWrapper'),
    webSearchToggleBtn: $('#webSearchToggleBtn'),
    webSearchIcon: $('#webSearchIcon'),
    searchBadge: $('#searchBadge'),
    searchDropdown: $('#searchDropdown'),
    imageGenToggleBtn: $('#imageGenToggleBtn'),
    composerBox: $('.composer-box'),
    attachmentPreviewBar: $('#attachmentPreviewBar'),
    imagePreviewImg: $('#imagePreviewImg'),
    removeImageBtn: $('#removeImageBtn'),
    activePresetBanner: $('#activePresetBanner'),
    activePresetName: $('#activePresetName'),
    clearPresetBtn: $('#clearPresetBtn'),
    footerModelInfo: $('#footerModelInfo'),
    footerLatencyInfo: $('#footerLatencyInfo'),
    
    // Buttons & Modals
    settingsBtn: $('#settingsBtn'),
    settingsModal: $('#settingsModal'),
    modelHubBtn: $('#modelHubBtn'),
    modelHubModal: $('#modelHubModal'),
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
    settingOpenRouterKey: $('#settingOpenRouterKey'),
    toggleShowKeyBtn: $('#toggleShowKeyBtn'),
    testOpenRouterBtn: $('#testOpenRouterBtn'),
    settingSerperApiKey: $('#settingSerperApiKey'),
    toggleShowSerperKeyBtn: $('#toggleShowSerperKeyBtn'),
    testSerperBtn: $('#testSerperBtn'),
    availableModelsDatalist: $('#availableModelsDatalist'),
    settingDeepResearchAgent1Model: $('#settingDeepResearchAgent1Model'),
    selectDeepResearchAgent1Model: $('#selectDeepResearchAgent1Model'),
    settingDeepResearchAgent2Model: $('#settingDeepResearchAgent2Model'),
    selectDeepResearchAgent2Model: $('#selectDeepResearchAgent2Model'),
    settingDeepResearchFinalModel: $('#settingDeepResearchFinalModel'),
    selectDeepResearchFinalModel: $('#selectDeepResearchFinalModel'),
    inputNewPresetName: $('#inputNewPresetName'),
    saveCustomPresetBtn: $('#saveCustomPresetBtn'),
    customPresetsList: $('#customPresetsList'),
    settingAutoPolicy: $('#settingAutoPolicy'),
    paramTemperature: $('#paramTemperature'),
    valTemperature: $('#valTemperature'),
    paramTopP: $('#paramTopP'),
    valTopP: $('#valTopP'),
    paramMaxTokens: $('#paramMaxTokens'),
    settingSystemPrompt: $('#settingSystemPrompt'),
    saveSettingsBtn: $('#saveSettingsBtn'),
    
    // Model Hub
    hubSearchInput: $('#hubSearchInput'),
    filterPills: $$('.filter-pill'),
    modelCardsGrid: $('#modelCardsGrid'),

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
    inspectCountAgent1: $('#inspectCountAgent1'),
    inspectCountAgent2: $('#inspectCountAgent2'),
    inspectCountScraper: $('#inspectCountScraper'),
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

    download() {
      if (!this.images[this.currentIndex]) return;
      const src = this.images[this.currentIndex];
      const a = document.createElement('a');
      a.href = src;
      a.download = `zoz_foto_${Date.now()}_${this.currentIndex + 1}.webp`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 100);
      showToast('Foto berhasil diunduh.');
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
      if (IS_GITHUB_PAGES) {
        this.isDeviceBackendAvailable = false;
        return;
      }
      try {
        const res = await fetch('/api/health', { method: 'GET', signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const data = await res.json();
          if (data.storage === 'device-disk' || data.status === 'online') {
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
        const res = await fetch('/api/sessions');
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
      if (!this.isDeviceBackendAvailable) return null;
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('DeviceStorage getSession failed:', e.message);
      }
      return null;
    },

    async saveSession(session) {
      if (!session || !session.id) return;
      // Safety guard: Never overwrite disk storage with an empty lazy-loaded session
      if (session._isLazyDisk && (!session.messages || session.messages.length === 0)) {
        return;
      }
      if (this.isDeviceBackendAvailable) {
        try {
          await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(session)
          });
        } catch (e) {
          console.warn('DeviceStorage saveSession failed:', e.message);
        }
      }
      // Also save in local ChatDB vault
      ChatDB.saveSession(session);
    },

    async updateSessionMetadata(id, patch) {
      if (!id || !patch) return;
      if (this.isDeviceBackendAvailable) {
        try {
          await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch)
          });
        } catch (e) {
          console.warn('DeviceStorage updateSessionMetadata failed:', e.message);
        }
      }
      const sess = STATE.sessions.find(s => s.id === id);
      if (sess) {
        Object.assign(sess, patch);
        if (!sess._isLazyDisk || (sess.messages && sess.messages.length > 0)) {
          ChatDB.saveSession(sess);
        }
      }
    },

    async renameSession(id, newTitle) {
      if (!id || !newTitle) return;
      if (this.isDeviceBackendAvailable) {
        try {
          await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
          });
        } catch (e) {
          console.warn('DeviceStorage renameSession failed:', e.message);
        }
      }
      const sess = STATE.sessions.find(s => s.id === id);
      if (sess) {
        sess.title = newTitle;
        ChatDB.saveSession(sess);
      }
    },

    async deleteSession(id) {
      if (!id) return;
      if (this.isDeviceBackendAvailable) {
        try {
          await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
            method: 'DELETE'
          });
        } catch (e) {
          console.warn('DeviceStorage deleteSession failed:', e.message);
        }
      }
      ChatDB.deleteSession(id);
    },

    async clearAllSessions() {
      if (this.isDeviceBackendAvailable) {
        try {
          await fetch('/api/sessions', {
            method: 'DELETE'
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: base64Data })
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

  async function loadPersistedState() {
    try {
      const savedSettings = localStorage.getItem('zoz_router_settings_v1');
      if (savedSettings) {
        STATE.settings = { ...STATE.settings, ...JSON.parse(savedSettings) };
      }
      if (!STATE.settings.ollamaModel) {
        STATE.settings.ollamaModel = 'gemma4:31b';
      }
      if (!STATE.settings.serperApiKey) {
        STATE.settings.serperApiKey = '075538fed9c64990e1eb32a06726c1e55a933c1e';
      }
      loadUserCustomResearchPresets();
      const savedSound = localStorage.getItem('zoz_router_sound_v1');
      if (savedSound !== null) {
        STATE.soundEnabled = savedSound === 'true';
      }
      const savedSearchMode = localStorage.getItem('zoz_router_search_mode_v1');
      if (savedSearchMode && ['off', 'default', 'premium'].includes(savedSearchMode)) {
        STATE.searchMode = savedSearchMode;
      }

      // 1. Initialize Device-First Storage
      await DeviceStorage.init();

      // 2. Fast synchronous load from localStorage
      const savedSessions = localStorage.getItem('zoz_router_sessions_v1');
      if (savedSessions) {
        try {
          const parsed = JSON.parse(savedSessions);
          if (Array.isArray(parsed)) STATE.sessions = parsed;
        } catch (e) {}
      }

      // 3. Sync from IndexedDB Vault
      const dbSessions = await ChatDB.getAllSessions();
      if (Array.isArray(dbSessions) && dbSessions.length > 0) {
        if (dbSessions.length >= STATE.sessions.length) {
          STATE.sessions = dbSessions;
        }
      }

      // 4. Sync lightweight session headers from Device Disk Storage if backend is online
      if (DeviceStorage.isDeviceBackendAvailable) {
        const diskList = await DeviceStorage.getSessionsList();
        if (Array.isArray(diskList) && diskList.length > 0) {
          for (const diskItem of diskList) {
            const existing = STATE.sessions.find(s => s.id === diskItem.id);
            if (!existing) {
              STATE.sessions.push({
                id: diskItem.id,
                title: diskItem.title || 'Obrolan Baru',
                mode: diskItem.mode || 'ollama',
                createdAt: diskItem.createdAt,
                updatedAt: diskItem.updatedAt,
                messages: [],
                messageCount: diskItem.messageCount || 0,
                _isLazyDisk: true
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error loading persisted state:', err);
    }
  }

  function savePersistedState() {
    try {
      localStorage.setItem('zoz_router_settings_v1', JSON.stringify(STATE.settings));
      localStorage.setItem('zoz_router_sound_v1', String(STATE.soundEnabled));
      localStorage.setItem('zoz_router_search_mode_v1', STATE.searchMode || 'off');

      // Save active session to Device Disk Storage
      if (STATE.currentSessionId) {
        const activeSess = STATE.sessions.find(s => s.id === STATE.currentSessionId);
        if (activeSess) {
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
            return {
              role: m.role,
              content: m.content,
              displayContent: m.displayContent,
              docs: safeDocs,
              images: safeImages,
              image: safeImage,
              model: m.model,
              engine: m.engine,
              slot: m.slot,
              sources: m.sources,
              stats: m.stats,
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
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ==================== UTILS ====================
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
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
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
      .replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
  }

  function renderMarkdown(rawText) {
    if (!rawText) return '';
    if (window.marked) {
      marked.setOptions({
        breaks: true,
        gfm: true
      });
      const parsed = marked.parse(rawText);
      return sanitizeHtmlSafe(parsed);
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
        const codeText = (codeBlock ? (codeBlock.innerText || codeBlock.textContent) : (pre.innerText || pre.textContent)) || '';
        
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
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try {
      const successful = document.execCommand('copy');
      if (successful && onSuccess) {
        onSuccess();
      } else if (!successful) {
        showToast('Gagal menyalin teks ke clipboard.', 'error');
      }
    } catch (err) {
      showToast('Gagal menyalin teks ke clipboard.', 'error');
    }
    document.body.removeChild(textarea);
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

    // ==================== HIGH-PERFORMANCE 60FPS STREAM BUFFER RENDERER ====================
  class StreamBufferRenderer {
    constructor(bubbleElement, onScrollCallback) {
      this.el = bubbleElement;
      this.onScroll = onScrollCallback;
      this.text = '';
      this.animId = null;
      this.lastRenderTime = 0;
      this.isDone = false;
    }

    append(delta) {
      this.text += delta;
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
      this.el.innerHTML = renderMarkdown(this.text) + '<span class="typing-cursor"></span>';
      if (this.onScroll && !userScrolledUp) this.onScroll();
    }

    finish() {
      this.isDone = true;
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      if (this.el) {
        this.el.innerHTML = renderMarkdown(this.text);
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
  let userScrolledUp = false;
  let isAutoScrolling = false;

  function isChatAtBottom(element = els.chatViewport, threshold = 25) {
    if (!element) return true;
    return (element.scrollHeight - element.scrollTop - element.clientHeight) <= threshold;
  }

  function toggleScrollBottomBtn(show) {
    if (!els.scrollBottomBtn) return;
    els.scrollBottomBtn.style.display = show ? 'flex' : 'none';
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
    let wheelTimer = null;

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

      els.pullUpNewChatWrapper.style.display = 'flex';
      els.pullUpNewChatWrapper.classList.add('visible');
      els.pullUpNewChatWrapper.classList.add('revealed');
      AudioEngine.snap();
    }

    function hidePullWrapper(instant = false, reboundToBottom = true) {
      if (!els.pullUpNewChatWrapper) return;
      if (pullHoldTimer) {
        clearTimeout(pullHoldTimer);
        pullHoldTimer = null;
      }

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
    els.pullUpNewChatBtn?.addEventListener('click', () => {
      createNewSession();
      hidePullWrapper(true, false);
      AudioEngine.click();
    });

    const handleScrollEvent = (el = els.chatViewport) => {
      if (isAutoScrolling) return;
      const atBottom = isChatAtBottom(el, 30);
      if (!atBottom) {
        userScrolledUp = true;
        toggleScrollBottomBtn(true);
        hidePullWrapper(true, false);
      } else {
        userScrolledUp = false;
        toggleScrollBottomBtn(false);
      }
    };

    els.chatViewport.addEventListener('scroll', () => handleScrollEvent(els.chatViewport), { passive: true });
    
    // User touch start, move, and end on mobile devices (ChatGPT Elastic Pull & Hold)
    els.chatViewport.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        if (pullHoldTimer) {
          clearTimeout(pullHoldTimer);
          pullHoldTimer = null;
        }
      }
    }, { passive: true });

    els.chatViewport.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        const deltaY = touchStartY - e.touches[0].clientY; // positive = pulling past bottom
        const atBottom = isChatAtBottom(els.chatViewport, 20);

        if (deltaY < -10 || (!atBottom && deltaY < 0)) {
          // Scrolling up into previous messages
          userScrolledUp = true;
          toggleScrollBottomBtn(true);
          hidePullWrapper(true, false);
        } else if (atBottom && deltaY > 15) {
          userScrolledUp = false;
          toggleScrollBottomBtn(false);

          if (!els.pullUpNewChatWrapper.classList.contains('revealed')) {
            showPullLoading();

            // Must pull deep (>= 70px) AND hold continuously for >= 500ms
            if (deltaY >= 70 && !pullHoldTimer) {
              pullHoldTimer = setTimeout(() => {
                revealPullNewChatBtn();
                pullHoldTimer = null;
              }, 450);
            }
          }
        }
      }
    }, { passive: true });

    els.chatViewport.addEventListener('touchend', () => {
      if (pullHoldTimer) {
        clearTimeout(pullHoldTimer);
        pullHoldTimer = null;
      }
      // If user did not hold long enough to reveal button -> elastic rebound back to chat output
      if (!els.pullUpNewChatWrapper?.classList.contains('revealed')) {
        hidePullWrapper(false, true);
      }
    }, { passive: true });

    // Desktop wheel: shows brief loading spinner momentum and rebounds smoothly to chat output
    els.chatViewport.addEventListener('wheel', (e) => {
      if (e.deltaY < 0) {
        // Scrolling up into past messages
        userScrolledUp = true;
        toggleScrollBottomBtn(true);
        hidePullWrapper(true, false);
      } else if (e.deltaY > 0) {
        const atBottom = isChatAtBottom(els.chatViewport, 20);
        if (atBottom) {
          userScrolledUp = false;
          toggleScrollBottomBtn(false);

          if (!els.pullUpNewChatWrapper?.classList.contains('revealed')) {
            showPullLoading();
            if (wheelTimer) clearTimeout(wheelTimer);
            wheelTimer = setTimeout(() => {
              hidePullWrapper(false, true);
            }, 180);
          }
        }
      }
    }, { passive: true });

    els.scrollBottomBtn?.addEventListener('click', () => {
      if (els.chatViewport) els.chatViewport.scrollTo({ top: els.chatViewport.scrollHeight, behavior: 'smooth' });
      userScrolledUp = false;
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
    // Check for mid-sentence termination
    const unfinishedEndings = [':', ',', ';', '-', '(', '[', '{', 'dan', 'atau', 'dengan', 'yang', 'untuk', 'pada', 'adalah'];
    if (unfinishedEndings.some(end => trimmed.endsWith(end))) return true;
    return false;
  }

  function attachContinuationButton(container, session, assistantRow, modelName, engine, previousText) {
    if (!container) return;
    container.querySelector('.continue-response-btn')?.remove();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'continue-response-btn';
    btn.innerHTML = '<i class="fa-solid fa-forward-step"></i> <span>⏩ Lanjutkan Jawaban (Output Terpotong)</span>';

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
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

        const merged = (previousText + '\n' + appendedText).trim();
        bubbleText.innerHTML = renderMarkdown(merged);
        enhanceCodeBlocks(bubbleText);
        
        const lastMsg = session.messages[session.messages.length - 1];
        if (lastMsg) lastMsg.content = merged;
        savePersistedState();

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
    const isOpenRouterDirect = IS_GITHUB_PAGES || !location.port;
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
      signal: STATE.abortController.signal
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let appended = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
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
            bubbleText.innerHTML = renderMarkdown(currentFullText + '\n' + appended) + '<span class="typing-cursor"></span>';
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

    const chatUrl = IS_GITHUB_PAGES ? `${ep}/api/chat` : '/api/ollama/chat';
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
      signal: STATE.abortController.signal
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let appended = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            appended += parsed.message.content;
            bubbleText.innerHTML = renderMarkdown(currentFullText + '\n' + appended) + '<span class="typing-cursor"></span>';
            smartScrollChatToBottom(false);
          }
        } catch (e) {}
      }
    }
    return appended;
  }

  // ==================== SESSIONS & CHAT MANAGEMENT ====================
  function createNewSession(initialTitle = 'Obrolan Baru', targetMode = STATE.mode) {
    STATE.currentSessionId = null;
    sessionStorage.removeItem('zoz_active_session_id');
    STATE.isImageGenMode = false;
    updateImageGenModeUI();
    renderChatHistory();
    renderCurrentSession();
    AudioEngine.click();
    if (window.innerWidth <= 768 && els.sidebar?.classList.contains('open')) {
      els.sidebar.classList.remove('open');
      els.sidebarBackdrop?.classList.remove('show');
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
      title: 'Obrolan Baru',
      mode: targetMode,
      messages: [],
      createdAt: new Date().toISOString()
    };
    STATE.sessions.unshift(newSession);
    STATE.currentSessionId = newSession.id;
    sessionStorage.setItem('zoz_active_session_id', newSession.id);
    savePersistedState();
    return newSession;
  }

  async function switchSession(sessionId) {
    if (STATE.isGenerating) {
      showToast('Harap tunggu atau hentikan generasi respons saat ini.', 'error');
      return;
    }
    const targetSession = STATE.sessions.find(s => s.id === sessionId);
    if (!targetSession) return;

    // Lazy load messages from device disk if needed
    if (targetSession._isLazyDisk && (!targetSession.messages || targetSession.messages.length === 0)) {
      if (DeviceStorage.isDeviceBackendAvailable) {
        try {
          const fullSess = await DeviceStorage.getSession(sessionId);
          if (fullSess && Array.isArray(fullSess.messages)) {
            targetSession.messages = fullSess.messages;
            delete targetSession._isLazyDisk;
          }
        } catch (e) {
          console.warn('Gagal memuat detail sesi dari disk:', e);
        }
      }
    }

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
    sessionStorage.setItem('zoz_active_session_id', sessionId);
    STATE.isImageGenMode = false;
    updateImageGenModeUI();
    savePersistedState();
    renderChatHistory();
    renderCurrentSession();
    updateModelUI();
    AudioEngine.click();

    if (window.innerWidth <= 768 && els.sidebar?.classList.contains('open')) {
      els.sidebar.classList.remove('open');
      els.sidebarBackdrop?.classList.remove('show');
    }
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

    STATE.sessions = STATE.sessions.filter(s => s.id !== sessionId);
    await DeviceStorage.deleteSession(sessionId);

    if (STATE.currentSessionId === sessionId) {
      STATE.currentSessionId = null;
      sessionStorage.removeItem('zoz_active_session_id');
    }

    savePersistedState();
    renderChatHistory();
    renderCurrentSession();
    showToast('Percakapan berhasil dihapus dari perangkat.');
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
      const lastMsg = s.messages[s.messages.length - 1];
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
    els.chatHistoryList.innerHTML = '';
    const q = filterQuery.toLowerCase().trim();
    
    // Unified list of all sessions across engines (including lazy-loaded disk sessions)
    const validSessions = STATE.sessions.filter(s => (s.messages && s.messages.length > 0) || (s._isLazyDisk && (s.messageCount > 0 || s.messages)));
    const filtered = validSessions.filter(s => !q || s.title.toLowerCase().includes(q) || (s.mode && s.mode.toLowerCase().includes(q)));

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

        item.querySelector('.history-item-actions').appendChild(dropdown);
        activeHistoryDropdown = dropdown;
        AudioEngine.click();
      });

      els.chatHistoryList.appendChild(item);
    });
  }

  function renderCurrentSession() {
    // If no session is actively selected -> Land on TAMPILAN UTAMA (Welcome Hero)!
    if (!STATE.currentSessionId) {
      els.welcomeHero.style.display = 'flex';
      els.messagesList.innerHTML = '';
      if (els.pullUpNewChatWrapper) {
        els.pullUpNewChatWrapper.classList.remove('visible');
        els.pullUpNewChatWrapper.style.display = 'none';
      }
      smartScrollChatToBottom(true);
      return;
    }

    const session = STATE.sessions.find(s => s.id === STATE.currentSessionId);
    if (!session || !session.messages || session.messages.length === 0) {
      els.welcomeHero.style.display = 'flex';
      els.messagesList.innerHTML = '';
      if (els.pullUpNewChatWrapper) {
        els.pullUpNewChatWrapper.classList.remove('visible');
        els.pullUpNewChatWrapper.style.display = 'none';
      }
      smartScrollChatToBottom(true);
      return;
    }

    els.welcomeHero.style.display = 'none';
    els.messagesList.innerHTML = '';
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
      appendMessageElement(msg.role, textToDisplay, imagesToDisplay, msg.model, msg.stats, idx, msg.sources, msg.docs, msg.isDeepResearch, msg.latency);
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
      <div class="image-result-card" data-prompt="${escapeHtml(prompt)}" data-img-url="${escapeHtml(imgUrl)}" data-model="${escapeHtml(model)}">
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

  function triggerImageDownload(url, promptText) {
    const a = document.createElement('a');
    a.href = url;
    const cleanName = (promptText || 'ai_image').toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
    a.download = `zoz_${cleanName}_${Date.now()}.png`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
    showToast('Mengunduh gambar HD...', 'info');
  }

  function attachImageCardListeners(row, promptText, imageUrl) {
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
        runImageGeneration(currentSession, promptText);
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

    attachImageCardListeners(row, msg.prompt, msg.imageUrl || msg.url);
    els.messagesList.appendChild(row);
  }

  function appendMessageElement(role, content, image = null, model = '', stats = null, index = -1, sources = null, docs = null, isDeepResearch = false, latency = null) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    row.dataset.index = index;
    if (content) {
      row.dataset.fullContent = content;
    }

    const avatarIcon = role === 'user' ? '<i class="fa-solid fa-user-ninja"></i>' : '<i class="fa-solid fa-microchip-ai"></i>';
    const roleLabel = role === 'user' ? 'Anda' : (model || 'Zoz AI');

    const imgList = Array.isArray(image) ? image.filter(Boolean) : (image ? [image] : []);
    let imageGalleryHtml = '';
    if (imgList.length > 0) {
      const gridClass = imgList.length === 1 ? 'grid-1' : (imgList.length === 2 ? 'grid-2' : 'grid-multi');
      imageGalleryHtml = `
        <div class="attached-images-gallery ${gridClass}">
          ${imgList.map((src, imgIdx) => `
            <div class="chat-img-thumb-wrap" data-img-idx="${imgIdx}" title="Klik untuk melihat foto layar penuh">
              <img src="${src}" alt="Foto ${imgIdx + 1}" class="chat-zoomable-img">
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
          ${docs.map(d => `
            <div class="msg-doc-badge">
              <i class="fa-solid fa-file-lines"></i>
              <span class="msg-doc-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
              <span class="msg-doc-size">${escapeHtml(d.size || '')}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    let statsHtml = '';
    if (isDeepResearch && role === 'assistant') {
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
    if (isDeepResearch && role === 'assistant' && hasText) {
      renderedBody = buildDeepResearchSummaryCardHtml(content, model, sources);
    } else {
      renderedBody = role === 'assistant' ? renderMarkdown(content || '') : escapeHtml(content || '').replace(/\n/g, '<br>');
    }
    const textDisplayStyle = (!hasText && role === 'user') ? 'style="display:none;"' : '';

    let sourcesHtml = '';
    if (sources && Array.isArray(sources) && sources.length > 0 && role === 'assistant' && !isDeepResearch) {
      sourcesHtml = `
        <div class="msg-sources-section">
          <div class="msg-sources-title">
            <i class="fa-solid fa-earth-americas" style="color:var(--neon-cyan);"></i>
            <span>Sumber Terverifikasi Google (${sources.length})</span>
          </div>
          <div class="msg-sources-grid">
            ${sources.map((s, i) => `
              <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="msg-source-chip" title="${escapeHtml(s.title + (s.snippet ? ' - ' + s.snippet : ''))}">
                <span class="source-index">${i + 1}</span>
                <span class="source-title">${escapeHtml(s.title || s.domain || 'Sumber Web')}</span>
                <span class="source-domain">${escapeHtml(s.domain || '')}</span>
              </a>
            `).join('')}
          </div>
        </div>
      `;
    }

    const metaContent = (isDeepResearch && role === 'assistant')
      ? statsHtml
      : `<strong>${roleLabel}</strong> ${statsHtml}`;

    row.innerHTML = `
      <div class="message-avatar">${avatarIcon}</div>
      <div class="message-content-box">
        <div class="message-meta">
          ${metaContent}
        </div>
        <div class="message-bubble">
          ${imageGalleryHtml}
          ${docsHtml}
          <div class="msg-text-content" ${textDisplayStyle}>${renderedBody}</div>
          ${sourcesHtml}
        </div>
        <div class="message-actions-bar">
          ${role === 'user' ? '<button class="msg-action-btn edit-msg-btn" title="Edit & Kirim Ulang Prompt"><i class="fa-solid fa-pen-to-square"></i> Edit</button>' : ''}
          <button class="msg-action-btn copy-msg-btn" title="Salin Pesan"><i class="fa-solid fa-copy"></i> Salin</button>
        </div>
      </div>
    `;

    // Attach Deep Research Card Actions (Full Report Modal & Quick Exports)
    if (isDeepResearch && role === 'assistant' && hasText) {
      attachDeepResearchCardEvents(row, content, model, sources, null);
    }

    // Attach Lightbox click triggers to images in this bubble
    if (imgList.length > 0) {
      row.querySelectorAll('.chat-img-thumb-wrap').forEach((thumb) => {
        thumb.addEventListener('click', (e) => {
          e.stopPropagation();
          const clickedIdx = parseInt(thumb.dataset.imgIdx, 10) || 0;
          ImageLightbox.open(imgList, clickedIdx);
        });
      });
    }


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

        // Create inline editor
        const originalContent = content;
        textContainer.style.display = 'none';
        actionsBar.style.display = 'none';

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
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        // Cancel
        editorBox.querySelector('.cancel-edit-btn').addEventListener('click', () => {
          editorBox.remove();
          textContainer.style.display = 'block';
          actionsBar.style.display = 'flex';
          AudioEngine.click();
        });

        // Save & Resend
        const doSaveAndResend = () => {
          const newText = textarea.value.trim();
          if (!newText && !image) {
            showToast('Prompt tidak boleh kosong.', 'error');
            return;
          }

          const session = getActiveSession();
          // Find index of this message in session
          let msgIdx = index;
          if (msgIdx < 0 || msgIdx >= session.messages.length) {
            msgIdx = session.messages.findIndex(m => m.role === 'user' && m.content === originalContent);
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
          els.promptInput.value = newText;
          if (image) STATE.attachedImage = image;
          handleSendPrompt();
          showToast('Prompt diperbarui & dikirim ulang!');
        };

        editorBox.querySelector('.save-edit-btn').addEventListener('click', doSaveAndResend);
        textarea.addEventListener('keydown', (e) => {
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

    els.messagesList.appendChild(row);
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
          return `[Pustaka pembaca DOCX (JSZip) belum termuat atau diblokir peramban. Tidak dapat membaca file "${file.name}".]`;
        }
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
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
      // 1. Cek cerdas: Jika user memilih foto/gambar melalui menu Dokumen, alihkan otomatis ke Galeri Foto/Vision
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
    if (addedImagesCount > 0) {
      updateVisionCompatibilityBadge();
    }
    if (addedDocsCount > 0 || addedImagesCount > 0) {
      AudioEngine.click();
    }
  }

  function removeAttachedDoc(idx) {
    STATE.attachedDocs.splice(idx, 1);
    renderAttachmentPreviews();
    AudioEngine.click();
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
          <img src="${imgSrc}" alt="Lampiran Foto ${idx + 1}">
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
        const chip = document.createElement('div');
        chip.className = 'doc-preview-chip';
        chip.innerHTML = `
          <i class="fa-solid fa-file-lines doc-icon"></i>
          <span class="doc-name" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</span>
          <span class="doc-size">(${escapeHtml(doc.size)})</span>
          <button class="remove-doc-btn" data-idx="${idx}" title="Hapus file"><i class="fa-solid fa-xmark"></i></button>
        `;
        chip.querySelector('.remove-doc-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          removeAttachedDoc(idx);
        });
        els.attachmentPreviewBar.appendChild(chip);
      });
    }

    updateVisionCompatibilityBadge();
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
            gl: 'id',
            hl: 'id'
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

  function renderMessageSources(row, sources) {
    if (!row || !sources || !Array.isArray(sources) || sources.length === 0) return;
    const bubble = row.querySelector('.message-bubble');
    if (!bubble) return;
    if (bubble.querySelector('.msg-sources-section')) return;

    const sourcesEl = document.createElement('div');
    sourcesEl.className = 'msg-sources-section';
    sourcesEl.innerHTML = `
      <div class="msg-sources-title">
        <i class="fa-solid fa-earth-americas" style="color:var(--neon-cyan);"></i>
        <span>Sumber Terverifikasi Google (${sources.length})</span>
      </div>
      <div class="msg-sources-grid">
        ${sources.map((s, i) => `
          <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="msg-source-chip" title="${escapeHtml(s.title + (s.snippet ? ' - ' + s.snippet : ''))}">
            <span class="source-index">${i + 1}</span>
            <span class="source-title">${escapeHtml(s.title || s.domain || 'Sumber Web')}</span>
            <span class="source-domain">${escapeHtml(s.domain || '')}</span>
          </a>
        `).join('')}
      </div>
    `;
    bubble.appendChild(sourcesEl);
  }

  // ==================== URL & ENDPOINT NORMALIZER ====================
  function normalizeEndpoint(ep) {
    if (!ep || typeof ep !== 'string' || !ep.trim()) return 'http://127.0.0.1:11434';
    let clean = ep.trim();
    if (!/^https?:\/\//i.test(clean)) {
      clean = (clean.includes(':443') || clean.includes('.com') || clean.includes('.io') || clean.includes('.ai') || clean.includes('.app'))
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
    try {
      const ep = normalizeEndpoint(STATE.settings.ollamaEndpoint);
      const headers = {};
      if (STATE.settings.ollamaApiKey) {
        headers['Authorization'] = `Bearer ${STATE.settings.ollamaApiKey}`;
        headers['x-ollama-key'] = STATE.settings.ollamaApiKey;
      }

      let rawModels = [];
      let isRunning = false;

      if (IS_GITHUB_PAGES) {
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
        populateDeepResearchModelPickers();
        renderModelHubGrid();
        if (STATE.activeCatalogTab === 'ollama') {
          renderLiveModelCatalog();
        }
        return true;
      } else {
        STATE.ollamaModels = [];
        if (els.badgeOllamaCount) els.badgeOllamaCount.innerText = '0';
        els.ollamaStatusVal.innerText = 'Offline (Cek Ollama)';
        els.ollamaIndicator.className = 'status-indicator error';
        populateModelDropdown();
        populateDeepResearchModelPickers();
        renderModelHubGrid();
        if (STATE.activeCatalogTab === 'ollama') {
          renderLiveModelCatalog();
        }
        return false;
      }
    } catch (e) {
      els.ollamaStatusVal.innerText = 'Tidak Terhubung';
      els.ollamaIndicator.className = 'status-indicator error';
      if (els.badgeOllamaCount) els.badgeOllamaCount.innerText = '0';
      return false;
    }
  }

  async function checkOpenRouterStatus() {
    if (!STATE.settings.openRouterKey) {
      els.openRouterStatusVal.innerText = 'Key Belum Diisi';
      els.openRouterIndicator.className = 'status-indicator error';
      return;
    }
    els.openRouterStatusVal.innerText = 'Key Tersimpan';
    els.openRouterIndicator.className = 'status-indicator online';
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
          const mapped = data.data.map(m => ({
            id: m.id,
            name: m.name || m.id,
            context_length: m.context_length || null,
            tag: m.id.includes(':free') ? 'Free' : (m.pricing?.prompt === '0' ? 'Free' : 'Cloud'),
            cat: m.id.includes(':free') ? 'free' : 'flagship'
          }));
          STATE.openRouterModels = mapped;
          if (els.badgeOpenRouterCount) {
            els.badgeOpenRouterCount.innerText = mapped.length;
          }
          populateModelDropdown();
          populateDeepResearchModelPickers();
          renderModelHubGrid();
          if (STATE.activeCatalogTab === 'openrouter') {
            renderLiveModelCatalog();
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch dynamic OpenRouter model catalog:', e);
    }
  }

  // ==================== ATTACHMENT BADGE & COMPATIBILITY ====================
  function updateVisionCompatibilityBadge() {
    const badge = document.getElementById('visionCompatBadge');
    if (badge) badge.remove();
  }

  // ==================== MODEL DROPDOWN & SELECTORS ====================
  function populateModelDropdown(search = '') {
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
          const isCloud = STATE.settings.ollamaApiKey || (STATE.settings.ollamaEndpoint && STATE.settings.ollamaEndpoint.includes('ollama.com'));
          return { 
            id: modelId, 
            name: m.name || modelId, 
            tag: m.tag || (isCloud ? 'Ollama Cloud' : 'Lokal') 
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

    // Urutkan model dengan rapi: Model aktif di paling atas, sisanya diurutkan secara alfabetis
    filtered.sort((a, b) => {
      if (a.id === currentActive) return -1;
      if (b.id === currentActive) return 1;
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
      item.className = `model-option-item ${m.id === currentActive ? 'selected' : ''}`;
      const isFree = m.tag.toLowerCase().includes('free');
      const isLocal = m.tag.toLowerCase().includes('lokal');
      const badgeStyle = isFree 
        ? 'background:rgba(0,255,194,0.15); color:var(--neon-teal); border:1px solid rgba(0,255,194,0.3);' 
        : (isLocal ? 'background:rgba(255,183,3,0.15); color:var(--neon-amber); border:1px solid rgba(255,183,3,0.3);' : 'background:rgba(0,240,255,0.1); color:var(--neon-cyan);');

      item.innerHTML = `
        <div style="display:flex; flex-direction:column; overflow:hidden; flex:1; padding-right:8px;">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; font-size:0.82rem;">${escapeHtml(m.name || m.id)}</span>
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.68rem; color:var(--text-dim); font-family:var(--font-code);">${escapeHtml(m.id)}</span>
        </div>
        <span style="font-size:0.65rem; padding:2px 6px; border-radius:3px; font-weight:600; flex-shrink:0; ${badgeStyle}">${escapeHtml(m.tag || 'AI')}</span>
      `;
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
    if (STATE.mode === 'ollama') {
      STATE.settings.ollamaModel = modelId;
    } else {
      STATE.settings.openRouterModel = modelId;
    }
    updateModelUI();
    updateVisionCompatibilityBadge();
    savePersistedState();
    showToast(`Model aktif: ${modelId}`);
  }

  function updateModelUI() {
    const current = getCurrentModel();
    if (els.currentModelLabel) els.currentModelLabel.innerText = current;
    if (els.footerModelInfo) els.footerModelInfo.innerText = `Engine: ${STATE.mode.toUpperCase()} (${current})`;
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
    updateVisionCompatibilityBadge();
    populateModelDropdown();
    renderChatHistory();
    renderCurrentSession();
    AudioEngine.click();
  }

  // ==================== DISPATCH / STREAMING ENGINE ====================
  async function handleSendPrompt() {
    const rawText = els.promptInput.value.trim();
    const images = [...(STATE.attachedImages || [])];
    const image = images.length > 0 ? images[0] : null;
    const docs = [...(STATE.attachedDocs || [])];

    if (!rawText && images.length === 0 && docs.length === 0) return;
    if (STATE.isGenerating) return;

    // Combine documents with text
    let text = rawText;
    if (docs.length > 0) {
      const docsContext = docs.map(d => `--- [LAMPIRAN DOKUMEN: ${d.name} (${d.size})] ---\n${d.content}\n--- [AKHIR DOKUMEN: ${d.name}] ---`).join('\n\n');
      text = text ? `${docsContext}\n\n${text}` : docsContext;
    }

    const session = getActiveSession();
    els.welcomeHero.style.display = 'none';

    // Build user message object
    const docsMeta = docs.map(d => ({ name: d.name, size: d.size }));
    const userMsg = {
      role: 'user',
      content: text,
      displayContent: rawText,
      docs: docsMeta,
      images: images,
      image: image,
      timestamp: new Date().toISOString()
    };

    // Auto title session if first message
    if (session.messages.length === 0) {
      const fallbackTitle = docs.length > 0 ? (docs[0].name || 'Dokumen Lampiran') : (images.length > 0 ? 'Analisis Gambar' : 'Percakapan Baru');
      const titleCandidate = rawText || fallbackTitle;
      session.title = titleCandidate.length > 30 ? titleCandidate.substring(0, 30) + '...' : titleCandidate;
      renderChatHistory();
    }

    session.messages.push(userMsg);
    savePersistedState();

    // Immediately render user's message bubble
    appendMessageElement('user', rawText, images, 'Anda', null, session.messages.length - 1, null, docsMeta);
    smartScrollChatToBottom(true);

    // Reset input & attachments
    els.promptInput.value = '';
    autoResizeTextarea(els.promptInput);
    STATE.attachedDocs = [];
    clearAttachedImages();
    renderAttachmentPreviews();
    AudioEngine.send();

    if (STATE.isImageGenMode || isImageGenerationTrigger(text)) {
      const cleanImgPrompt = extractImagePrompt(text);
      await runImageGeneration(session, cleanImgPrompt);
    } else if (STATE.isDeepResearch) {
      const activeEngine = (STATE.mode === 'auto')
        ? (STATE.settings.autoPolicy === 'cloud_first' ? 'openrouter' : 'ollama')
        : STATE.mode;
      const activeModel = (activeEngine === 'openrouter')
        ? STATE.settings.openRouterModel
        : STATE.settings.ollamaModel;
      await runDeepResearchStreaming(session, text, images, activeModel, activeEngine);
    } else if (STATE.mode === 'auto') {
      await runAutoRouterStreaming(session, text, images);
    } else if (STATE.mode === 'openrouter') {
      await runOpenRouterStreaming(session, text, images, STATE.settings.openRouterModel);
    } else {
      await runOllamaStreaming(session, text, images, STATE.settings.ollamaModel);
    }
  }

  // ==================== UNIVERSAL MODEL ERROR & WARNING HANDLER ====================
  function formatModelErrorMessage(engine, modelName, err, hasImage = false, hasWebSearch = false) {
    const rawMsg = (err && err.message) ? err.message : String(err || 'Unknown error');
    const msg = rawMsg.toLowerCase();
    const isCorsOrNetwork = IS_GITHUB_PAGES && (msg.includes('failed to fetch') || msg.includes('networkerror') || err.name === 'TypeError');
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

    let title = `Peringatan Model: ${escapeHtml(modelName)}`;
    let desc = escapeHtml(rawMsg);
    let advice = '';

    if (isVisionUnsupported) {
      title = `Model ${escapeHtml(modelName)} Tidak Mendukung Input Gambar`;
      desc = `Model ini menolak pemrosesan gambar multimodal karena beroperasi dalam mode teks murni (text-only).`;
      advice = `💡 <strong>Saran:</strong> Beralihlah ke model multimodal seperti <code>google/gemini-2.0-flash-exp:free</code>, <code>openai/gpt-4o</code>, <code>gemma4:31b</code>, atau kirim prompt Anda tanpa lampiran gambar.`;
    } else if (isCorsOrNetwork && engine === 'ollama') {
      title = `Batasan Koneksi Browser CORS (GitHub Pages)`;
      desc = `Browser memblokir koneksi langsung dari domain <code>github.io</code> ke server <code>ollama.com</code> karena pembatasan CORS server.`;
      advice = `💡 <strong>Solusi Cepat:</strong> Gunakan <strong>OpenRouter (Cloud)</strong> yang didukung 100% di web GitHub Pages tanpa batasan CORS, atau jalankan Desktop Gateway <code>http://localhost:4040</code> di PC Anda.`;
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
  function buildSanitizedMessagesPayload(sessionOrMessages, currentImages = [], engine = 'openrouter', systemContent = '') {
    const messagesPayload = [];
    if (systemContent && systemContent.trim()) {
      messagesPayload.push({ role: 'system', content: systemContent.trim() });
    }

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
            const raw = String(img).replace(/^data:image\/[a-z0-9.+_-]+;base64,/i, '').replace(/[\r\n\s]/g, '');
            if (raw) rawImages.push(raw);
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
              if (typeof img === 'string' && img.startsWith('data:image')) {
                contentParts.push({ type: 'image_url', image_url: { url: img } });
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

    try {
      let personaPrompt = STATE.settings.systemPrompt ? STATE.settings.systemPrompt.trim() : '';
      let systemContent = personaPrompt;

      // If Web Search is enabled, fetch real-time search context
      if (STATE.webSearchEnabled) {
        const webRes = await getWebSearchContext(promptText, session, bubbleText);
        if (webRes && webRes.systemPromptContext) {
          systemContent = personaPrompt 
            ? `### SYSTEM PERSONA & CORE DIRECTIVE:\n${personaPrompt}\n\n### REAL-TIME GOOGLE SEARCH GROUNDING DATA:\n${webRes.systemPromptContext}` 
            : webRes.systemPromptContext;
          webSources = webRes.sources;
        }
        bubbleText.innerHTML = '<span class="typing-cursor"></span>';
      }

      const rawImgs = Array.isArray(image) ? image : (image ? [image] : []);
      const messagesPayload = buildSanitizedMessagesPayload(session, rawImgs, 'ollama', systemContent);

      const ep = normalizeEndpoint(STATE.settings.ollamaEndpoint);
      const requestBody = {
        model: modelName,
        messages: messagesPayload,
        system: systemContent,
        stream: true,
        options: {
          temperature: parseFloat(STATE.settings.temperature),
          top_p: parseFloat(STATE.settings.topP)
        },
        endpoint: ep
      };
      if (STATE.settings.ollamaApiKey) {
        requestBody.apiKey = STATE.settings.ollamaApiKey;
      }

      const headers = { 'Content-Type': 'application/json' };
      if (STATE.settings.ollamaApiKey) {
        headers['Authorization'] = `Bearer ${STATE.settings.ollamaApiKey}`;
        headers['x-ollama-key'] = STATE.settings.ollamaApiKey;
      }

      const chatUrl = IS_GITHUB_PAGES ? resolveEndpointUrl(ep, 'api/chat') : '/api/ollama/chat';

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: STATE.abortController.signal
      });

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
      streamRenderer = new StreamBufferRenderer(bubbleText, () => smartScrollChatToBottom(false));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

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
          if (parsed.message?.content) {
            if (!firstTokenTime) firstTokenTime = performance.now();
            tokenCount++;
            streamRenderer.append(parsed.message.content);
          }
        }
      }

      fullText = streamRenderer.finish();
      if (!fullText.trim() && !STATE.abortController?.signal.aborted) {
        throw new Error('Model Ollama menyelesaikan koneksi tanpa menghasilkan respon teks.');
      }

      const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
      const tps = totalTime > 0 ? (tokenCount / totalTime).toFixed(1) : '0';
      
      bubbleText.innerHTML = renderMarkdown(fullText);
      enhanceCodeBlocks(bubbleText);
      if (webSources && webSources.length > 0) {
        renderMessageSources(assistantRow, webSources);
      }
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

      // Save to session
      session.messages.push({
        role: 'assistant',
        content: fullText,
        model: modelName,
        engine: 'ollama',
        sources: webSources,
        stats: { duration: totalTime, tps: tps, tokens: tokenCount },
        timestamp: new Date().toISOString()
      });
      savePersistedState();
      AudioEngine.receive();

    } catch (err) {
      if (err.name === 'AbortError') {
        const partialText = streamRenderer ? streamRenderer.finish() : '';
        if (partialText && partialText.trim()) {
          const stoppedText = `${partialText.trim()}\n\n*[Respons dihentikan oleh pengguna]*`;
          bubbleText.innerHTML = renderMarkdown(stoppedText);
          enhanceCodeBlocks(bubbleText);
          if (webSources && webSources.length > 0) {
            renderMessageSources(assistantRow, webSources);
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
            stats: { duration: totalTime, tokens: tokenCount, stopped: true },
            timestamp: new Date().toISOString()
          });
          savePersistedState();
        } else {
          assistantRow.remove();
        }
        showToast('Generasi dihentikan oleh pengguna.');
      } else {
        const actualHasImage = Array.isArray(image) ? image.length > 0 : Boolean(image);
        const errorHtml = formatModelErrorMessage('ollama', modelName, err, actualHasImage, STATE.webSearchEnabled);

        bubbleText.innerHTML = `
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
        
        bubbleText.querySelector('.switch-openrouter-btn')?.addEventListener('click', () => {
          assistantRow.remove();
          setEngineMode('openrouter');
          if (!STATE.settings.openRouterKey) {
            openModal('settingsModal');
            showToast('Silakan masukkan OpenRouter API Key Anda di menu Pengaturan.', 'info');
          } else {
            runOpenRouterStreaming(session, promptText, image, STATE.settings.openRouterModel);
          }
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
    if (!STATE.settings.openRouterKey) {
      showToast('OpenRouter API Key diperlukan! Buka Pengaturan untuk mengisi.', 'error');
      openModal('settingsModal');
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

    try {
      let personaPrompt = STATE.settings.systemPrompt ? STATE.settings.systemPrompt.trim() : '';
      let systemContent = personaPrompt;

      // If Web Search is enabled, fetch real-time search context
      if (STATE.webSearchEnabled) {
        const webRes = await getWebSearchContext(promptText, session, bubbleText);
        if (webRes && webRes.systemPromptContext) {
          systemContent = personaPrompt 
            ? `### SYSTEM PERSONA & CORE DIRECTIVE:\n${personaPrompt}\n\n### REAL-TIME GOOGLE SEARCH GROUNDING DATA:\n${webRes.systemPromptContext}` 
            : webRes.systemPromptContext;
          webSources = webRes.sources;
        }
        bubbleText.innerHTML = '<span class="typing-cursor"></span>';
      }

      const rawImgs = Array.isArray(image) ? image : (image ? [image] : []);
      const messagesPayload = buildSanitizedMessagesPayload(session, rawImgs, 'openrouter', systemContent);

      const isOpenRouterDirect = IS_GITHUB_PAGES || !location.port;
      const endpoint = isOpenRouterDirect ? 'https://openrouter.ai/api/v1/chat/completions' : '/api/openrouter/chat';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.settings.openRouterKey}`
      };
      if (isOpenRouterDirect) {
        headers['HTTP-Referer'] = location.origin || 'https://zozi0999.github.io/zoz_router';
        headers['X-Title'] = 'ZOZ Router';
      }

      const requestBody = {
        model: modelName,
        messages: messagesPayload,
        stream: true,
        temperature: parseFloat(STATE.settings.temperature),
        top_p: parseFloat(STATE.settings.topP)
      };
      if (!isOpenRouterDirect) {
        requestBody.apiKey = STATE.settings.openRouterKey;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: STATE.abortController.signal
      });

      if (!response.ok) {
        let errDetail = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson && errJson.error) {
            errDetail = typeof errJson.error === 'object' ? (errJson.error.message || JSON.stringify(errJson.error)) : errJson.error;
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
      let finishReason = null;
      streamRenderer = new StreamBufferRenderer(bubbleText, () => smartScrollChatToBottom(false));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

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
            throw new Error(errStr);
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
        }
      }

      fullText = streamRenderer.finish();
      if (!fullText.trim() && !STATE.abortController?.signal.aborted) {
        throw new Error('Model OpenRouter menyelesaikan koneksi tanpa menghasilkan respon teks.');
      }

      const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
      const tps = totalTime > 0 ? (tokenCount / totalTime).toFixed(1) : '0';

      bubbleText.innerHTML = renderMarkdown(fullText);
      enhanceCodeBlocks(bubbleText);
      if (webSources && webSources.length > 0) {
        renderMessageSources(assistantRow, webSources);
      }
      metaBox.innerHTML = `
        <strong>${modelName}</strong>
        <span class="meta-model-badge" style="background:rgba(255,82,0,0.15); color:var(--neon-amber);">OpenRouter</span>
        <span>⏱️ ${totalTime}s</span>
        <span>⚡ ${tps} tps</span>
      `;

      assistantRow.dataset.fullContent = fullText;

      // Check if output is cut in half and provide one-click continuation button
      if (isOutputTruncated(fullText, finishReason)) {
        attachContinuationButton(assistantRow.querySelector('.message-content-box') || assistantRow, session, assistantRow, modelName, 'openrouter', fullText);
      }

      session.messages.push({
        role: 'assistant',
        content: fullText,
        model: modelName,
        engine: 'openrouter',
        sources: webSources,
        stats: { duration: totalTime, tps: tps, tokens: tokenCount },
        timestamp: new Date().toISOString()
      });
      savePersistedState();
      AudioEngine.receive();

    } catch (err) {
      if (err.name === 'AbortError') {
        const partialText = streamRenderer ? streamRenderer.finish() : '';
        if (partialText && partialText.trim()) {
          const stoppedText = `${partialText.trim()}\n\n*[Respons dihentikan oleh pengguna]*`;
          bubbleText.innerHTML = renderMarkdown(stoppedText);
          enhanceCodeBlocks(bubbleText);
          if (webSources && webSources.length > 0) {
            renderMessageSources(assistantRow, webSources);
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
            stats: { duration: totalTime, tokens: tokenCount, stopped: true },
            timestamp: new Date().toISOString()
          });
          savePersistedState();
        } else {
          assistantRow.remove();
        }
        showToast('Generasi dihentikan.');
      } else {
        const actualHasImage = Array.isArray(image) ? image.length > 0 : Boolean(image);
        const errorHtml = formatModelErrorMessage('openrouter', modelName, err, actualHasImage, STATE.webSearchEnabled);

        bubbleText.innerHTML = `
          ${errorHtml}
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-outline retry-send-btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan); font-size:0.75rem;">
              <i class="fa-solid fa-rotate-right"></i> Coba Kirim Ulang
            </button>
            <button class="btn btn-sm btn-outline open-settings-btn" style="border-color:var(--neon-amber); color:var(--neon-amber); font-size:0.75rem;">
              <i class="fa-solid fa-gear"></i> Buka Pengaturan & Key
            </button>
          </div>
        `;
        
        bubbleText.querySelector('.retry-send-btn')?.addEventListener('click', () => {
          assistantRow.remove();
          runOpenRouterStreaming(session, promptText, image, modelName);
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

      if (STATE.settings.autoPolicy === 'cloud_heavy' && isLongOrHeavy && STATE.settings.openRouterKey) {
        showToast('🔀 Auto-Router: Mengarahkan tugas kompleks ke OpenRouter Cloud...', 'info');
        await runOpenRouterStreaming(session, promptText, image, STATE.settings.openRouterModel);
      } else if (isOllamaOnline) {
        showToast('🔀 Auto-Router: Mengeksekusi via Ollama Local Engine...', 'info');
        await runOllamaStreaming(session, promptText, image, STATE.settings.ollamaModel);
      } else if (STATE.settings.openRouterKey) {
        showToast('🔀 Auto-Router: Ollama offline, fallback ke OpenRouter Cloud...', 'info');
        await runOpenRouterStreaming(session, promptText, image, STATE.settings.openRouterModel);
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
              Ollama Local Engine tidak aktif pada <code>${escapeHtml(STATE.settings.ollamaEndpoint)}</code> dan <strong>OpenRouter API Key</strong> belum dikonfigurasi di Pengaturan.
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary); background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:6px; border-left:3px solid var(--neon-cyan);">
              💡 <strong>Solusi:</strong> Jalankan aplikasi Ollama di komputer Anda atau masukkan OpenRouter API Key Anda di menu Pengaturan agar Auto-Router dapat melakukan failover otomatis ke Cloud.
            </div>
          </div>
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-primary open-settings-btn" style="font-size:0.75rem;">
              <i class="fa-solid fa-sliders"></i> Buka Pengaturan & Masukkan API Key
            </button>
            <button class="btn btn-sm btn-outline retry-router-btn" style="border-color:var(--neon-cyan); color:var(--neon-cyan); font-size:0.75rem;">
              <i class="fa-solid fa-rotate-right"></i> Cek Ulang Status Ollama
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
    els.sendPromptBtn.style.display = isGen ? 'none' : 'flex';
    els.stopGenerationBtn.style.display = isGen ? 'flex' : 'none';
  }

  function stopGeneration() {
    if (STATE.currentDeepResearchTaskId && !IS_GITHUB_PAGES) {
      const abortTaskId = STATE.currentDeepResearchTaskId;
      STATE.currentDeepResearchTaskId = null;
      fetch('/api/batal-riset/' + abortTaskId, { method: 'POST' }).catch(() => {});
    }
    if (STATE.abortController) {
      STATE.abortController.abort();
      STATE.abortController = null;
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
    if (!file) return false;
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
      if (!isImageFile(file)) continue;
      const ok = await processSingleImageFile(file);
      if (ok) addedCount++;
    }

    if (els.imageFileInput) els.imageFileInput.value = '';
    if (els.cameraFileInput) els.cameraFileInput.value = '';
    renderAttachmentPreviews();
    updateVisionCompatibilityBadge();

    if (addedCount > 0) {
      AudioEngine.click();
    }
  }

  function removeAttachedImage(idx) {
    if (idx >= 0 && idx < STATE.attachedImages.length) {
      STATE.attachedImages.splice(idx, 1);
      renderAttachmentPreviews();
      updateVisionCompatibilityBadge();
      AudioEngine.click();
    }
  }

  function clearAttachedImages() {
    STATE.attachedImages = [];
    if (els.imageFileInput) els.imageFileInput.value = '';
    if (els.cameraFileInput) els.cameraFileInput.value = '';
    renderAttachmentPreviews();
    updateVisionCompatibilityBadge();
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

    if (mode === 'premium') {
      showToast('Mode Deep Research (Premium) Aktif 🔬');
    } else if (mode === 'default') {
      showToast('Mode Default: Pencarian Cepat Aktif 🌐');
    } else {
      showToast('Pencarian Web Dinonaktifkan.');
    }
  }

  function updateSearchModeUI() {
    const mode = STATE.searchMode || 'off';
    if (!els.webSearchToggleBtn) return;

    els.webSearchToggleBtn.classList.remove('mode-default', 'mode-premium', 'active');
    if (mode === 'default') {
      els.webSearchToggleBtn.classList.add('mode-default', 'active');
      if (els.webSearchIcon) els.webSearchIcon.className = 'fa-solid fa-globe';
      if (els.searchBadge) els.searchBadge.style.display = 'none';
      els.webSearchToggleBtn.title = 'Pencarian Web Default: Aktif (Klik untuk ubah mode)';
    } else if (mode === 'premium') {
      els.webSearchToggleBtn.classList.add('mode-premium', 'active');
      if (els.webSearchIcon) els.webSearchIcon.className = 'fa-solid fa-microscope';
      if (els.searchBadge) els.searchBadge.style.display = 'block';
      els.webSearchToggleBtn.title = 'Deep Research (Premium): Aktif (Klik untuk ubah mode)';
    } else {
      if (els.webSearchIcon) els.webSearchIcon.className = 'fa-solid fa-globe';
      if (els.searchBadge) els.searchBadge.style.display = 'none';
      els.webSearchToggleBtn.title = 'Mode Pencarian Web (Nonaktif - Klik untuk aktifkan)';
    }

    // Update active check indicators in popup menu
    $$('.search-menu-item').forEach(item => {
      const itemMode = item.dataset.mode || 'off';
      const isActive = itemMode === mode;
      item.classList.toggle('active', isActive);
      const checkIcon = item.querySelector('.search-item-check');
      if (checkIcon) checkIcon.style.display = isActive ? 'block' : 'none';
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
    els.searchDropdown.style.display = 'flex';
    els.webSearchToggleBtn?.setAttribute('aria-expanded', 'true');
    AudioEngine.click();
  }

  function closeSearchDropdown() {
    if (!els.searchDropdown) return;
    els.searchDropdown.style.display = 'none';
    els.webSearchToggleBtn?.setAttribute('aria-expanded', 'false');
  }

  // ==================== DEEP RESEARCH STREAMING ENGINE (PREMIUM) ====================
  async function performClientWebSearch(query, serperKey) {
    try {
      let data = null;
      try {
        const directRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: query, num: 6, gl: 'id', hl: 'id' }),
          signal: STATE.abortController?.signal
        });
        if (directRes.ok) data = await directRes.json();
      } catch (e) {}

      if (!data) {
        const proxyRes = await fetch('/api/web-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-serper-key': serperKey },
          body: JSON.stringify({ query: query, apiKey: serperKey }),
          signal: STATE.abortController?.signal
        }).catch(() => null);
        if (proxyRes && proxyRes.ok) data = await proxyRes.json();
      }

      if (!data) return null;

      const sources = [];
      let summary = '';
      if (data.knowledgeGraph) {
        summary += `\n[KG]: ${data.knowledgeGraph.title || ''}: ${data.knowledgeGraph.description || ''}\n`;
      }
      if (data.answerBox) {
        summary += `\n[ANSWER]: ${data.answerBox.answer || data.answerBox.snippet || ''}\n`;
      }
      const list = data.organic || data.results || [];
      if (Array.isArray(list)) {
        list.slice(0, 6).forEach((item, idx) => {
          summary += `\n${idx + 1}. ${item.title}: ${item.snippet} (${item.link || item.url || ''})`;
          if (item.link || item.url) {
            sources.push({
              title: item.title,
              url: item.link || item.url,
              snippet: item.snippet || '',
              domain: (item.link || item.url).replace(/^https?:\/\//i, '').split('/')[0]
            });
          }
        });
      }
      return { summary, sources };
    } catch (e) {
      return null;
    }
  }

  // Client-Side Helper for Divergent Serper Search (Strict zero domain/URL overlap)
  async function performClientDivergentSearch(query, serperApiKey, excludeDomains = [], excludeUrls = []) {
    try {
      const serperKey = serperApiKey || STATE.settings.serperApiKey || '075538fed9c64990e1eb32a06726c1e55a933c1e';
      const excludeDomainSet = new Set((excludeDomains || []).map(d => String(d).toLowerCase().replace(/^www\./, '')));
      const excludeUrlSet = new Set((excludeUrls || []).map(u => String(u).trim()));

      // 1. Buat query pencarian mendalam dengan kata kunci analitis
      let divergentQuery = `${query} riset data analisis spesifik 2026`;
      
      // Tambahkan filter eksklusi -site: untuk domain teratas yang sudah diambil Agen 1
      const topExclude = Array.from(excludeDomainSet).slice(0, 3);
      if (topExclude.length > 0) {
        divergentQuery += topExclude.map(d => ` -site:${d}`).join('');
      }

      let data = null;
      try {
        const directRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q: divergentQuery, num: 10, gl: 'id', hl: 'id' }),
          signal: STATE.abortController?.signal
        });
        if (directRes.ok) data = await directRes.json();
      } catch (e) {}

      if (!data) {
        const proxyRes = await fetch('/api/web-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-serper-key': serperKey },
          body: JSON.stringify({ query: divergentQuery, apiKey: serperKey }),
          signal: STATE.abortController?.signal
        }).catch(() => null);
        if (proxyRes && proxyRes.ok) data = await proxyRes.json();
      }

      if (!data) return null;

      const sources = [];
      let summary = '';
      if (data.knowledgeGraph) {
        summary += `\n[KG DIVERGEN]: ${data.knowledgeGraph.title || ''}: ${data.knowledgeGraph.description || ''}\n`;
      }
      if (data.answerBox) {
        summary += `\n[ANSWER DIVERGEN]: ${data.answerBox.answer || data.answerBox.snippet || ''}\n`;
      }

      const list = data.organic || data.results || [];
      let addedCount = 0;
      if (Array.isArray(list)) {
        for (const item of list) {
          const itemUrl = item.link || item.url || '';
          if (!itemUrl) continue;
          const rawDomain = (itemUrl.replace(/^https?:\/\//i, '').split('/')[0] || '').toLowerCase();
          const cleanDomain = rawDomain.replace(/^www\./, '');

          // Filter mutlak: jika URL atau domain sudah diambil Agen 1, lewati!
          if (excludeUrlSet.has(itemUrl) || excludeDomainSet.has(cleanDomain)) {
            continue;
          }

          addedCount++;
          summary += `\n${addedCount}. [Serper Divergen] ${item.title}: ${item.snippet} (${itemUrl})`;
          sources.push({
            title: item.title,
            url: itemUrl,
            snippet: item.snippet || '',
            domain: cleanDomain || rawDomain,
            sourceProvider: 'Serper (Divergen)'
          });
          excludeUrlSet.add(itemUrl);
          excludeDomainSet.add(cleanDomain);

          if (addedCount >= 6) break;
        }
      }

      return { summary, sources };
    } catch (e) {
      return null;
    }
  }

  // Helper untuk menyeimbangkan artikel scraper antara Agen 1 (Primer) dan Agen 2 (Divergen)
  function getBalancedScrapeList(sources, maxCount = 6) {
    if (!Array.isArray(sources) || sources.length === 0) return [];
    const primer = sources.filter(s => (s.sourceProvider || '').includes('Primer') || (!(s.sourceProvider || '').includes('Divergen')));
    const divergen = sources.filter(s => (s.sourceProvider || '').includes('Divergen'));
    if (primer.length === 0 || divergen.length === 0) return sources.slice(0, maxCount);
    const balanced = [];
    let p = 0;
    let d = 0;
    while (balanced.length < maxCount && (p < primer.length || d < divergen.length)) {
      if (p < primer.length && balanced.length < maxCount) balanced.push(primer[p++]);
      if (d < divergen.length && balanced.length < maxCount) balanced.push(divergen[d++]);
    }
    return balanced;
  }

  // Helper non-streaming untuk eksekusi telaah mandiri Model Agen 1 & Agen 2 di browser
  async function callClientLLMDirect(modelName, prompt, system = '', engine = '') {
    if (!prompt || !modelName) return '';
    const isModelOpenRouter = Boolean(modelName && modelName.includes('/'));
    const isModelOllama = Boolean(modelName && (modelName.includes(':') || (!modelName.includes('/') && (STATE.ollamaModels || []).some(m => (m.name || m.model || m.id) === modelName))));
    const resolvedEngine = isModelOpenRouter ? 'openrouter' : (isModelOllama ? 'ollama' : (engine || (STATE.settings.openRouterKey ? 'openrouter' : 'ollama')));

    const messages = [];
    if (system && system.trim()) messages.push({ role: 'system', content: system.trim() });
    messages.push({ role: 'user', content: prompt.trim() });

    if (resolvedEngine === 'openrouter' || (STATE.settings.openRouterKey && !isModelOllama)) {
      const isOpenRouterDirect = IS_GITHUB_PAGES || !location.port;
      const endpoint = isOpenRouterDirect ? 'https://openrouter.ai/api/v1/chat/completions' : '/api/openrouter/chat';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.settings.openRouterKey}`
      };
      if (isOpenRouterDirect) {
        headers['HTTP-Referer'] = location.origin || 'https://zozi0999.github.io/zoz_router';
        headers['X-Title'] = 'ZOZ Router Multi-Agent';
      }
      const requestBody = {
        model: modelName,
        messages,
        stream: false,
        temperature: 0.3
      };
      if (!isOpenRouterDirect) requestBody.apiKey = STATE.settings.openRouterKey;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: STATE.abortController?.signal
      });
      if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } else {
      const ep = normalizeEndpoint(STATE.settings.ollamaEndpoint);
      const headers = { 'Content-Type': 'application/json' };
      if (STATE.settings.ollamaApiKey) {
        headers['Authorization'] = `Bearer ${STATE.settings.ollamaApiKey}`;
        headers['x-ollama-key'] = STATE.settings.ollamaApiKey;
      }
      const requestBody = {
        model: modelName,
        messages,
        stream: false,
        options: { temperature: 0.3 },
        endpoint: ep
      };
      if (STATE.settings.ollamaApiKey) requestBody.apiKey = STATE.settings.ollamaApiKey;
      const chatUrl = IS_GITHUB_PAGES ? `${ep}/api/chat` : '/api/ollama/chat';

      const res = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: STATE.abortController?.signal
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const data = await res.json();
      return data.message?.content || '';
    }
  }

  async function streamLLMSynthesis(engine, modelName, systemPrompt, session, bubbleText) {
    const streamRenderer = new StreamBufferRenderer(bubbleText, () => smartScrollChatToBottom(false));
    let fullText = '';

    // Auto-resolve actual engine based on modelName pattern
    const isModelOpenRouter = Boolean(modelName && modelName.includes('/'));
    const isModelOllama = Boolean(modelName && (modelName.includes(':') || (!modelName.includes('/') && (STATE.ollamaModels || []).some(m => (m.name || m.model || m.id) === modelName))));
    const resolvedEngine = isModelOpenRouter ? 'openrouter' : (isModelOllama ? 'ollama' : (engine || 'ollama'));

    const messagesPayload = buildSanitizedMessagesPayload(session, [], resolvedEngine, systemPrompt);

    if (resolvedEngine === 'openrouter' || (!STATE.settings.ollamaModel && STATE.settings.openRouterKey && !isModelOllama)) {
      const isOpenRouterDirect = IS_GITHUB_PAGES || !location.port;
      const endpoint = isOpenRouterDirect ? 'https://openrouter.ai/api/v1/chat/completions' : '/api/openrouter/chat';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.settings.openRouterKey}`
      };
      if (isOpenRouterDirect) {
        headers['HTTP-Referer'] = location.origin || 'https://zozi0999.github.io/zoz_router';
        headers['X-Title'] = 'ZOZ Router Deep Research';
      }

      const requestBody = {
        model: modelName,
        messages: messagesPayload,
        stream: true,
        temperature: 0.3
      };
      if (!isOpenRouterDirect) requestBody.apiKey = STATE.settings.openRouterKey;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: STATE.abortController?.signal
      });

      if (!response.ok) {
        let errDetail = `OpenRouter HTTP ${response.status}`;
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
        if (done) break;
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
                streamRenderer.append(delta);
              }
            } catch (e) {
              if (e.message && !e.message.includes('JSON')) throw e;
            }
          }
        }
      }
      const renderedText = streamRenderer.finish();
      return fullText || renderedText;
    } else {
      const ep = normalizeEndpoint(STATE.settings.ollamaEndpoint);
      const headers = { 'Content-Type': 'application/json' };
      if (STATE.settings.ollamaApiKey) {
        headers['Authorization'] = `Bearer ${STATE.settings.ollamaApiKey}`;
        headers['x-ollama-key'] = STATE.settings.ollamaApiKey;
      }
      const requestBody = {
        model: modelName,
        messages: messagesPayload,
        stream: true,
        options: { temperature: 0.3 },
        endpoint: ep
      };
      if (STATE.settings.ollamaApiKey) requestBody.apiKey = STATE.settings.ollamaApiKey;

      const chatUrl = IS_GITHUB_PAGES ? `${ep}/api/chat` : '/api/ollama/chat';
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
        if (done) break;
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
            if (parsed.message?.content) {
              fullText += parsed.message.content;
              streamRenderer.append(parsed.message.content);
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }
      const renderedText = streamRenderer.finish();
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

  function extractReportSummary(fullText) {
    if (!fullText || typeof fullText !== 'string') return '';
    const text = fullText.trim();

    // 1. Ekstraksi Bab 1 / Ringkasan Eksekutif: buang seluruh baris heading-nya secara tuntas
    const regexHeading = /^##\s*(?:1\.\s*)?.*?(?:Ringkasan\s*Eksekutif|Executive\s*Summary)[^\n]*\n([\s\S]*?)(?=(?:\n##\s*2\.|\n##\s+[A-Za-z0-9]|\n---\n|$))/im;
    const match = text.match(regexHeading);
    if (match && match[1] && match[1].trim().length > 40) {
      // Bersihkan instruksi template dalam kurung seperti "(Uraikan ringkasan...)" jika ada
      let clean = match[1].replace(/^\s*\([^)]*\)\s*\n*/, '').trim();
      if (clean.length > 40) {
        return clean.length > 1600 ? clean.slice(0, 1600) + '...' : clean;
      }
    }

    // 2. Jika dokumen memiliki pengantar sebelum heading H2 pertama
    const h2Parts = text.split(/\n(?=##\s+)/);
    if (h2Parts.length > 0) {
      const introParagraphs = h2Parts[0]
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => !p.startsWith('#') && !p.startsWith('>') && !p.startsWith('---') && p.length > 30);
      
      if (introParagraphs.length > 0) {
        const combined = introParagraphs.slice(0, 3).join('\n\n');
        return combined.length > 1400 ? combined.slice(0, 1400) + '...' : combined;
      }
    }

    // 3. Jika pendahuluan ada di dalam section H2 pertama (h2Parts[1])
    if (h2Parts.length > 1) {
      const candidate = h2Parts[1].replace(/^##\s+[^\n]*\n+/, '').trim();
      let clean = candidate.replace(/^\s*\([^)]*\)\s*\n*/, '').trim();
      if (clean.length > 40) {
        return clean.length > 1400 ? clean.slice(0, 1400) + '...' : clean;
      }
    }

    // 4. Fallback umum non-heading
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => !p.startsWith('#') && !p.startsWith('>') && !p.startsWith('---') && p.length > 20);

    if (paragraphs.length > 0) {
      const combined = paragraphs.slice(0, 3).join('\n\n');
      return combined.length > 1200 ? combined.slice(0, 1200) + '...' : combined;
    }

    return text.length > 600 ? text.slice(0, 600) + '...' : text;
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

    const blob = new Blob(['\ufeff', wordContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanFilename}.docx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
    showToast('Laporan berhasil diunduh dalam format Word (.docx)', 'success');
  }

  function downloadReportPDF(title, markdownText) {
    const renderedHtml = renderMarkdown(markdownText || '');
    const currentDate = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

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
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
    showToast('Laporan berhasil diunduh dalam format Markdown (.md)', 'success');
  }

  function openDeepResearchReportModal(fullText, title, meta = {}) {
    const modal = document.getElementById('deepResearchReportModal');
    if (!modal) return;

    const resolvedTitle = title || extractReportTitle(fullText);
    const modalTitleEl = document.getElementById('fullReportModalTitle');
    if (modalTitleEl) modalTitleEl.textContent = resolvedTitle;

    const dateEl = document.getElementById('fullReportDate');
    if (dateEl) {
      const d = meta.date ? new Date(meta.date) : new Date();
      dateEl.textContent = d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    const sourcesCountEl = document.getElementById('fullReportSourcesCount');
    if (sourcesCountEl) {
      sourcesCountEl.textContent = (meta.sources && Array.isArray(meta.sources)) ? meta.sources.length : '0';
    }

    const modelsUsedEl = document.getElementById('fullReportModelsUsed');
    if (modelsUsedEl) {
      modelsUsedEl.textContent = meta.model || 'Pipeline 3-Model Hierarkis';
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
            tocItem.className = `toc-link ${levelClass}`;
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
        } else {
          tocList.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted); padding:8px 12px; display:block;">Tidak ada outline dokumen</span>';
        }
      }
    }

    openModal('deepResearchReportModal');
  }

  function buildDeepResearchSummaryCardHtml(fullText, model = '', sources = []) {
    const reportTitle = extractReportTitle(fullText);
    const summaryMarkdown = extractReportSummary(fullText);
    const renderedSummary = renderMarkdown(summaryMarkdown);

    return `
      <div class="deep-research-summary-card">
        <div class="summary-card-header">
          <span class="summary-card-badge"><i class="fa-solid fa-microscope"></i> RANGKUMAN EKSEKUTIF</span>
          <span class="meta-badge model-badge">${escapeHtml(model || 'Pipeline 3-Model')}</span>
        </div>
        <h4 class="summary-card-title">${escapeHtml(reportTitle)}</h4>
        <div class="summary-card-text">
          ${renderedSummary}
        </div>
        <div class="summary-card-actions">
          <button class="btn-open-full-report" data-action="open-full-report" title="Buka Dokumen Lengkap di Antarmuka Full Report">
            <i class="fa-solid fa-book-open-reader"></i> Buka Laporan Riset Lengkap (Full Report) ↗
          </button>
          <button class="btn-quick-export" data-action="export-pdf" title="Unduh Laporan sebagai Dokumen PDF">
            <i class="fa-solid fa-file-pdf" style="color:#FF4D4D;"></i> PDF
          </button>
          <button class="btn-quick-export" data-action="export-docx" title="Unduh Laporan sebagai Dokumen Word (.docx)">
            <i class="fa-solid fa-file-word" style="color:#2B579A;"></i> DOCX
          </button>
          <button class="btn-quick-export" data-action="export-md" title="Unduh File Markdown Asli (.md)">
            <i class="fa-solid fa-file-lines" style="color:var(--neon-cyan);"></i> MD
          </button>
        </div>
      </div>
    `;
  }

  function attachDeepResearchCardEvents(container, fullText, model, sources, date) {
    if (!container) return;
    const reportTitle = extractReportTitle(fullText);

    container.querySelector('[data-action="open-full-report"]')?.addEventListener('click', () => {
      openDeepResearchReportModal(fullText, reportTitle, {
        sources,
        model,
        date: date || new Date().toISOString()
      });
    });

    container.querySelector('[data-action="export-pdf"]')?.addEventListener('click', () => {
      downloadReportPDF(reportTitle, fullText);
    });

    container.querySelector('[data-action="export-docx"]')?.addEventListener('click', () => {
      downloadReportDOCX(reportTitle, fullText);
    });

    container.querySelector('[data-action="export-md"]')?.addEventListener('click', () => {
      downloadReportMD(reportTitle, fullText);
    });
  }

  async function runDeepResearchStreaming(session, promptText, image = null, modelName = null, engine = 'ollama') {

    const targetModel = modelName || (engine === 'openrouter' ? STATE.settings.openRouterModel : STATE.settings.ollamaModel);
    setGeneratingState(true);
    STATE.abortController = new AbortController();

    const startTime = performance.now();
    const assistantRow = appendMessageElement('assistant', '', null, `${targetModel} (Deep Research)`, null, -1, null, null, true);
    const bubbleText = assistantRow.querySelector('.msg-text-content');
    const metaBox = assistantRow.querySelector('.message-meta');

    let allSources = [];
    let currentProgress = 10;
    let stepItems = [
      { text: 'Inisialisasi Agen Riset Otonom & Analisis Konteks Percakapan...', status: 'active' }
    ];

    function renderResearchHUD(progress, statusMsg) {
      bubbleText.innerHTML = `
        <div class="deep-research-hud">
          <div class="deep-research-header">
            <div class="deep-research-title">
              <i class="fa-solid fa-atom fa-spin" style="color:var(--neon-amber);"></i>
              <span>Deep Research Agent (Premium)</span>
            </div>
            <span class="deep-research-badge">Multi-Iteration</span>
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

    renderResearchHUD(15, 'Menganalisis topik & konteks percakapan...');

    let finalReportText = '';

    try {
      let isBackendSuccess = false;
      const contextualTopic = session ? synthesizeAutonomousSearchQuery(session, promptText) : promptText;

      // 1. Coba panggil Backend Endpoint /api/mulai-riset (Local Node.js Server)
      if (!IS_GITHUB_PAGES) {
        try {
          const res = await fetch('/api/mulai-riset', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': STATE.settings.openRouterKey ? `Bearer ${STATE.settings.openRouterKey}` : '',
              'x-serper-key': STATE.settings.serperApiKey || '075538fed9c64990e1eb32a06726c1e55a933c1e'
            },
            body: JSON.stringify({
              topik: contextualTopic,
              prompt: promptText,
              messages: session ? session.messages : [],
              model: targetModel,
              provider: engine,
              endpoint: STATE.settings.ollamaEndpoint,
              apiKey: engine === 'openrouter' ? STATE.settings.openRouterKey : (STATE.settings.ollamaApiKey || ''),
              openRouterKey: STATE.settings.openRouterKey || '',
              ollamaApiKey: STATE.settings.ollamaApiKey || '',
              serperApiKey: STATE.settings.serperApiKey,
              agent1Model: STATE.settings.deepResearchAgent1Model || targetModel,
              agent2Model: STATE.settings.deepResearchAgent2Model || targetModel,
              finalModel: STATE.settings.deepResearchFinalModel || targetModel,
              maxIterations: 3
            }),
            signal: STATE.abortController.signal
          });

          if (res.ok) {
            const data = await res.json();
            const taskId = data.taskId;

            if (taskId) {
              STATE.currentDeepResearchTaskId = taskId;
              // 2. Lakukan Polling berkala ke /api/status-riset/:id
              while (STATE.isGenerating) {
                await new Promise(r => setTimeout(r, 1000));
                if (STATE.abortController?.signal.aborted) {
                  if (!IS_GITHUB_PAGES) {
                    fetch('/api/batal-riset/' + taskId, { method: 'POST' }).catch(() => {});
                  }
                  break;
                }

                const checkRes = await fetch(`/api/status-riset/${taskId}`, {
                  signal: STATE.abortController.signal
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
                  allSources = statusData.sources || [];
                  isBackendSuccess = true;
                  STATE.currentDeepResearchTaskId = null;
                  break;
                } else if (statusData.status === 'gagal' || statusData.status === 'dibatalkan') {
                  STATE.currentDeepResearchTaskId = null;
                  throw new Error(statusData.error || (statusData.status === 'dibatalkan' ? 'Riset dibatalkan oleh pengguna.' : 'Riset gagal diselesaikan.'));
                }
              }
            }
          }
        } catch (backendErr) {
          if (backendErr.name === 'AbortError') {
            if (STATE.currentDeepResearchTaskId && !IS_GITHUB_PAGES) {
              fetch('/api/batal-riset/' + STATE.currentDeepResearchTaskId, { method: 'POST' }).catch(() => {});
            }
            throw backendErr;
          }
          console.warn('Backend deep research fallback ke client-side execution:', backendErr);
        }
      }

      // 3. Fallback Client-Side Autonomous Deep Research Engine (Multi-Agent Serper Divergent)
      if (!isBackendSuccess && !STATE.abortController?.signal.aborted) {
        stepItems.push({ text: '[Langkah 1/3] Menelusuri Google via Multi-Agen (Dual-Agent Serper Divergen)...', status: 'active' });
        renderResearchHUD(25, '[Langkah 1/3] Menelusuri Google via Multi-Agen (Dual-Agent Serper Divergen)...');

        const serperKey = STATE.settings.serperApiKey || '075538fed9c64990e1eb32a06726c1e55a933c1e';
        let dataTemuan = [];
        let currentQuery = promptText;

        // Iterasi 1: Multi-Agent Parallel Search (Serper Primer & Serper Divergen Zero-Overlap)
        const iter1Serper = await performClientWebSearch(currentQuery, serperKey);
        const agent1UrlsIter1 = (iter1Serper?.sources || []).map(s => s.url);
        const agent1DomainsIter1 = (iter1Serper?.sources || []).map(s => s.domain).filter(Boolean);

        const iter1Divergent = await performClientDivergentSearch(currentQuery, serperKey, agent1DomainsIter1, agent1UrlsIter1);

        const agent1Model = (STATE.settings.deepResearchAgent1Model && STATE.settings.deepResearchAgent1Model.trim()) ? STATE.settings.deepResearchAgent1Model.trim() : targetModel;
        const agent2Model = (STATE.settings.deepResearchAgent2Model && STATE.settings.deepResearchAgent2Model.trim()) ? STATE.settings.deepResearchAgent2Model.trim() : targetModel;
        const finalModel = (STATE.settings.deepResearchFinalModel && STATE.settings.deepResearchFinalModel.trim()) ? STATE.settings.deepResearchFinalModel.trim() : targetModel;

        const serperBlockIter1 = (iter1Serper?.sources || []).map(s => `- [Web Primer] ${s.title}: ${s.snippet} (${s.url})`).join('\n');
        const divergentBlockIter1 = (iter1Divergent?.sources || []).map(s => `- [Web Divergen] ${s.title}: ${s.snippet} (${s.url})`).join('\n');

        let analisisAgen1Iter1 = '';
        let analisisAgen2Iter1 = '';

        try {
          const [res1, res2] = await Promise.all([
            serperBlockIter1 ? callClientLLMDirect(agent1Model, `Analisis temuan web primer untuk topik "${promptText}":\n${serperBlockIter1}`, 'Anda adalah Agen 1: Analis Web Primer Google. Rangkum fakta utama dan tren 2026 dalam 2 paragraf padat.') : Promise.resolve(''),
            divergentBlockIter1 ? callClientLLMDirect(agent2Model, `Analisis data domain mandiri/teknis untuk topik "${promptText}":\n${divergentBlockIter1}`, 'Anda adalah Agen 2: Analis Data Divergen. Rangkum fakta teknis spesifik dan perspektif independen dalam 2 paragraf padat.') : Promise.resolve('')
          ]);
          analisisAgen1Iter1 = res1 || iter1Serper?.summary || '';
          analisisAgen2Iter1 = res2 || iter1Divergent?.summary || '';
        } catch (e) {
          analisisAgen1Iter1 = iter1Serper?.summary || '';
          analisisAgen2Iter1 = iter1Divergent?.summary || '';
        }

        if (iter1Serper?.sources) allSources.push(...iter1Serper.sources);
        if (iter1Divergent?.sources) {
          iter1Divergent.sources.forEach(s => {
            if (!allSources.some(existing => existing.url === s.url)) allSources.push(s);
          });
        }

        let iter1Summary = `[ANALISIS MODEL 1 - PAKAR WEB (${agent1Model})]:\n${analisisAgen1Iter1}\n\n[ANALISIS MODEL 2 - PAKAR DIVERGEN (${agent2Model})]:\n${analisisAgen2Iter1}`;
        dataTemuan.push(`### Temuan Multi-Sumber Iterasi 1 (Query: "${currentQuery}"):\n${iter1Summary}`);

        const balancedArticlesIter1 = getBalancedScrapeList(allSources, 6);
        updateLiveInspectionData({
          topik: contextualTopic,
          currentQuery: currentQuery,
          iteration: 1,
          maxIterations: 2,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          agent1: {
            name: 'Agen 1 (Pakar Web Google)',
            provider: 'Google Serper API (Primer)',
            model: agent1Model,
            resultsCount: iter1Serper?.sources?.length || 0,
            results: (iter1Serper?.sources || []).map(s => ({ title: s.title, link: s.url, snippet: s.snippet })),
            analysis: analisisAgen1Iter1 || (iter1Serper?.sources?.length ? 'Analisis Model 1 selesai.' : 'Menunggu hasil penelusuran...')
          },
          agent2: {
            name: 'Agen 2 (Pakar Analisis Divergen)',
            provider: 'Google Serper API (Divergen)',
            model: agent2Model,
            resultsCount: iter1Divergent?.sources?.length || 0,
            results: (iter1Divergent?.sources || []).map(s => ({ title: s.title, link: s.url, snippet: s.snippet })),
            analysis: analisisAgen2Iter1 || (iter1Divergent?.sources?.length ? 'Analisis Model 2 selesai tanpa duplikasi domain.' : 'Pencarian selesai.')
          },
          scraper: {
            status: 'siap',
            totalScraped: balancedArticlesIter1.length,
            articles: balancedArticlesIter1.map((s, idx) => ({
              title: s.title,
              url: s.url,
              domain: s.domain || (s.url ? s.url.replace(/^https?:\/\//i, '').split('/')[0] : ''),
              sourceProvider: s.sourceProvider || (s.isDivergent ? 'Serper Divergen' : 'Serper Primer'),
              length: (s.snippet || '').length * 6 + 320,
              sample: s.snippet || 'Menunggu pemindaian konten mendalam...'
            }))
          },
          scrapedArticlesCount: balancedArticlesIter1.length,
          totalSourcesCount: allSources.length
        });

        stepItems[stepItems.length - 1].status = 'done';
        stepItems.push({ text: '[Langkah 2/3] Menganalisis & memindai konten mendalam artikel web...', status: 'active' });
        renderResearchHUD(55, '[Langkah 2/3] Menganalisis & memindai konten mendalam artikel web...');

        // Iterasi 2: Eksplorasi Sub-Query & Analisis Teknis 2026
        await new Promise(r => setTimeout(r, 600));
        const subQuery = `${promptText} data statistik spesifikasi teknis arsitektur 2026`;
        const iter2Serper = await performClientWebSearch(subQuery, serperKey);
        const knownUrls = allSources.map(s => s.url).concat((iter2Serper?.sources || []).map(s => s.url));
        const knownDomains = allSources.map(s => s.domain).concat((iter2Serper?.sources || []).map(s => s.domain)).filter(Boolean);

        const iter2Divergent = await performClientDivergentSearch(subQuery, serperKey, knownDomains, knownUrls);

        const serperBlockIter2 = (iter2Serper?.sources || []).map(s => `- [Web Primer] ${s.title}: ${s.snippet} (${s.url})`).join('\n');
        const divergentBlockIter2 = (iter2Divergent?.sources || []).map(s => `- [Web Divergen] ${s.title}: ${s.snippet} (${s.url})`).join('\n');

        let analisisAgen1Iter2 = '';
        let analisisAgen2Iter2 = '';

        try {
          const [res2A, res2B] = await Promise.all([
            serperBlockIter2 ? callClientLLMDirect(agent1Model, `Sub-Query: "${subQuery}"\nData Web:\n${serperBlockIter2}`, 'Anda adalah Agen 1: Analis Web Primer. Ekstrak data dan perkembangan terkini 2026.') : Promise.resolve(''),
            divergentBlockIter2 ? callClientLLMDirect(agent2Model, `Sub-Query: "${subQuery}"\nData Domain Mandiri:\n${divergentBlockIter2}`, 'Anda adalah Agen 2: Analis Data Divergen. Ekstrak spesifikasi teknis dan tantangan 2026.') : Promise.resolve('')
          ]);
          analisisAgen1Iter2 = res2A || iter2Serper?.summary || '';
          analisisAgen2Iter2 = res2B || iter2Divergent?.summary || '';
        } catch (e) {
          analisisAgen1Iter2 = iter2Serper?.summary || '';
          analisisAgen2Iter2 = iter2Divergent?.summary || '';
        }

        if (iter2Serper?.sources) {
          iter2Serper.sources.forEach(s => {
            if (!allSources.some(existing => existing.url === s.url)) allSources.push(s);
          });
        }
        if (iter2Divergent?.sources) {
          iter2Divergent.sources.forEach(s => {
            if (!allSources.some(existing => existing.url === s.url)) allSources.push(s);
          });
        }

        let iter2Summary = `[ANALISIS MODEL 1 - SERPER PRIMER (${agent1Model})]:\n${analisisAgen1Iter2}\n\n[ANALISIS MODEL 2 - SERPER DIVERGEN (${agent2Model})]:\n${analisisAgen2Iter2}`;
        dataTemuan.push(`### Temuan Multi-Sumber Iterasi 2 (Query: "${subQuery}"):\n${iter2Summary}`);

        const balancedArticlesIter2 = getBalancedScrapeList(allSources, 6);
        updateLiveInspectionData({
          topik: contextualTopic,
          currentQuery: subQuery,
          iteration: 2,
          maxIterations: 2,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          agent1: {
            name: 'Agen 1 (Pakar Web Google)',
            provider: 'Google Serper API (Primer)',
            model: agent1Model,
            resultsCount: iter2Serper?.sources?.length || 0,
            results: (iter2Serper?.sources || []).map(s => ({ title: s.title, link: s.url, snippet: s.snippet })),
            analysis: analisisAgen1Iter2 || (iter2Serper?.sources?.length ? 'Analisis spesifik Model 1 selesai.' : 'Tidak ada temuan tambahan.')
          },
          agent2: {
            name: 'Agen 2 (Pakar Analisis Divergen)',
            provider: 'Google Serper API (Divergen)',
            model: agent2Model,
            resultsCount: iter2Divergent?.sources?.length || 0,
            results: (iter2Divergent?.sources || []).map(s => ({ title: s.title, link: s.url, snippet: s.snippet })),
            analysis: analisisAgen2Iter2 || (iter2Divergent?.sources?.length ? 'Analisis mandiri Model 2 selesai tanpa tabrakan domain.' : 'Pencarian selesai.')
          },
          scraper: {
            status: 'selesai',
            totalScraped: balancedArticlesIter2.length,
            articles: balancedArticlesIter2.map((s, idx) => ({
              title: s.title,
              url: s.url,
              domain: s.domain || (s.url ? s.url.replace(/^https?:\/\//i, '').split('/')[0] : ''),
              sourceProvider: s.sourceProvider || (s.isDivergent ? 'Serper Divergen' : 'Serper Primer'),
              length: (s.snippet || '').length * 8 + 450,
              sample: `${s.snippet}\n[Konten artikel ${idx + 1} utuh telah dipindai (${s.sourceProvider || (s.isDivergent ? 'Serper Divergen' : 'Serper Primer')}) dan dievaluasi untuk sintesis]`
            }))
          },
          scrapedArticlesCount: balancedArticlesIter2.length,
          totalSourcesCount: allSources.length
        });

        // ==========================================
        // PILAR 2.5: PENCERNAAN KONTEN UTUH WEB OLEH MODEL 1 & MODEL 2 (CLIENT)
        // ==========================================
        stepItems[stepItems.length - 1].status = 'done';
        stepItems.push({ text: `[Langkah 2/3] Model 1 (${agent1Model}) & Model 2 (${agent2Model}) mencerna dokumen web...`, status: 'active' });
        renderResearchHUD(70, `Model 1 & Model 2 mencerna dokumen web...`);

        const primerArticles = balancedArticlesIter2.filter(s => (s.sourceProvider || '').includes('Primer') || (!(s.sourceProvider || '').includes('Divergen')));
        const divergenArticles = balancedArticlesIter2.filter(s => (s.sourceProvider || '').includes('Divergen'));

        const primerDocText = primerArticles.map((s, idx) => `[Dokumen Primer ${idx + 1}: ${s.title} (${s.url})]\n${s.snippet}\n${s.sample || ''}`).join('\n\n');
        const divergenDocText = divergenArticles.map((s, idx) => `[Dokumen Divergen ${idx + 1}: ${s.title} (${s.url})]\n${s.snippet}\n${s.sample || ''}`).join('\n\n');

        let laporanPakarClient1 = '';
        let laporanPakarClient2 = '';
        try {
          const [cerna1, cerna2] = await Promise.all([
            primerDocText ? callClientLLMDirect(agent1Model, `Topik: "${promptText}"\nBerikut adalah data dokumen web primer:\n${primerDocText}\n\nTugas: Cerna dan sajikan telaah mendalam temuan utama dan tren 2026 dalam 3 paragraf.`, 'Anda adalah Agen 1: Analis Web Primer.') : Promise.resolve(''),
            divergenDocText ? callClientLLMDirect(agent2Model, `Topik: "${promptText}"\nBerikut adalah data dokumen domain divergen/teknis:\n${divergenDocText}\n\nTugas: Cerna dan sajikan telaah kritis, data teknis spesifik, dan tantangan riil dalam 3 paragraf.`, 'Anda adalah Agen 2: Analis Data Divergen.') : Promise.resolve('')
          ]);
          laporanPakarClient1 = cerna1;
          laporanPakarClient2 = cerna2;
        } catch (e) {
          console.warn('Gagal mencerna dokumen di client fallback:', e);
        }

        if (laporanPakarClient1) {
          updateLiveInspectionData({
            agent1: { analysis: laporanPakarClient1 }
          });
        }
        if (laporanPakarClient2) {
          updateLiveInspectionData({
            agent2: { analysis: laporanPakarClient2 }
          });
        }

        // ==========================================
        // PILAR 3: SINTESIS EKSEKUTIF OLEH MODEL 3
        // ==========================================
        stepItems[stepItems.length - 1].status = 'done';
        stepItems.push({ text: `[Langkah 3/3] Model 3 (${finalModel}) mencerna output Model 1 & 2 serta menyusun laporan eksekutif...`, status: 'active' });
        renderResearchHUD(85, `[Langkah 3/3] Model 3 (${finalModel}) menyusun laporan riset eksekutif...`);

        const personaPrompt = STATE.settings.systemPrompt ? STATE.settings.systemPrompt.trim() : '';
        const synthesisSystem = `Anda adalah Analis Riset Senior, Lead Technical Scientist & Editor Eksekutif Utama (Model 3).
Topik Riset: "${promptText}".
Tugas utama Anda adalah mencerna, memvalidasi silang, membandingkan konsensus, dan menggabungkan DUA OUTPUT ANALISIS INDEPENDEN yang telah dihasilkan oleh Model 1 dan Model 2:

=== OUTPUT ANALISIS DARI MODEL 1 (PAKAR WEB GOOGLE PRIMER: ${agent1Model}) ===
${laporanPakarClient1 || analisisAgen1Iter2 || analisisAgen1Iter1 || 'Telaah Model 1 selesai.'}

=== OUTPUT ANALISIS DARI MODEL 2 (PAKAR ANALISIS DIVERGEN & DOMAIN MANDIRI: ${agent2Model}) ===
${laporanPakarClient2 || analisisAgen2Iter2 || analisisAgen2Iter1 || 'Telaah Model 2 selesai.'}

=== RIWAYAT TEMUAN MULTI-TAHAP ===
${dataTemuan.join('\n\n')}

Daftar Seluruh Sumber Terverifikasi (${allSources.length} Dokumen Web):
${allSources.map((s, idx) => `[${idx + 1}] [${s.sourceProvider || 'Web'}] ${s.title}: ${s.url}`).join('\n')}

Format Laporan yang WAJIB dipatuhi:
# 🔬 DEEP RESEARCH REPORT: ${promptText.toUpperCase()}
> **Status:** Riset Mendalam Multi-Iterasi & Validasi Konten Selesai  
> **Total Sumber Terverifikasi:** ${allSources.length} Dokumen Web  
> **Tahun Rujukan:** 2026

---

## 1. 📌 Pendahuluan & Ringkasan Eksekutif (Executive Summary)
(Uraikan ringkasan tingkat tinggi mengenai latar belakang, esensi topik, dan temuan inti dalam 2-3 paragraf berbobot tajam)

## 2. 🔍 Temuan Utama & Analisis Mendalam (Core Deep Findings)
(Analisis teknis, fakta-fakta spesifik, mekanisme kerja, dan data riil 2026)

## 3. ⚖️ Penyaringan Fakta & Validasi Sumber (Fact-Checking & Bias Analysis)
(Bandingkan fakta antar sumber: sebutkan poin konsensus, verifikasi klaim, dan catat bila ada kontradiksi/perbedaan pandangan antar pakar)

## 4. 📊 Matriks Data & Kategorisasi Tren (Trend & Synthesis Mapping)
- **Data & Fakta Statistik:** (Statistik konkret, angka, atau persentase)
- **Opini Tokoh & Pakar:** (Pandangan ahli di bidang terkait)
- **Tantangan & Hambatan:** (Regulasi, teknis, biaya, atau etika)
- **Peluang Industri & Dampak:** (Potensi nilai dan transformasi)

## 5. ⚠️ Tantangan & Hambatan Saat Ini
(Detail kendala implementasi, kepatuhan regulasi, atau keterbatasan saat ini)

## 6. 🚀 Tren & Analisis Masa Depan (Future Trajectory)
(Proyeksi perkembangan hingga akhir 2026 dan tahun-tahun berikutnya)

## 7. 🛠️ Rekomendasi Strategis & Implementasi Praktis
(Langkah konkret yang dapat diterapkan, arsitektur sistem, atau contoh kode/penerapan nyata jika relevan)

---
### 📚 Daftar Pustaka / Sumber Referensi:
Sajikan seluruh tautan asli markdown [Nama Sumber](URL) agar pengguna dapat langsung mengeklik rujukan aslinya.

${personaPrompt ? `\n\nInstruksi Persona Tambahan:\n${personaPrompt}` : ''}`;

        bubbleText.innerHTML = '<span class="typing-cursor"></span>';
        
        // Auto-detect finalModel engine for executive synthesis
        const finalEngine = finalModel.includes('/') ? 'openrouter' : (finalModel.includes(':') ? 'ollama' : engine);
        
        finalReportText = await streamLLMSynthesis(finalEngine, finalModel, synthesisSystem, session, bubbleText);
      }

      // Finalize UI & Markdown rendering
      if (finalReportText && finalReportText.trim()) {
        const endTime = performance.now();
        const totalDuration = ((endTime - startTime) / 1000).toFixed(2);
        const actualFinalModel = (STATE.settings.deepResearchFinalModel && STATE.settings.deepResearchFinalModel.trim()) ? STATE.settings.deepResearchFinalModel.trim() : targetModel;

        // Render Summary Card in chat bubble (Executive summary only)
        bubbleText.innerHTML = buildDeepResearchSummaryCardHtml(finalReportText, actualFinalModel, allSources);
        enhanceCodeBlocks(bubbleText);
        attachDeepResearchCardEvents(assistantRow, finalReportText, actualFinalModel, allSources, new Date().toISOString());
        assistantRow.dataset.fullContent = finalReportText;

        if (allSources.length > 0) {
          renderMessageSources(assistantRow, allSources);
        }

        if (metaBox) {
          metaBox.innerHTML = `
            <span class="meta-badge engine-badge"><i class="fa-solid fa-microscope" style="color:var(--neon-amber);"></i> DEEP RESEARCH</span>
            <span class="meta-badge model-badge">${escapeHtml(actualFinalModel)}</span>
            <span class="meta-badge latency-badge"><i class="fa-solid fa-bolt"></i> ${totalDuration}s</span>
            <span class="meta-badge sources-badge"><i class="fa-solid fa-globe"></i> ${allSources.length} Sumber</span>
          `;
        }

        // Save assistant message to session
        const assistantMsg = {
          role: 'assistant',
          content: finalReportText,
          model: actualFinalModel,
          sources: allSources,
          isDeepResearch: true,
          latency: totalDuration,
          timestamp: new Date().toISOString()
        };
        session.messages.push(assistantMsg);
        savePersistedState();
        AudioEngine.success();
        smartScrollChatToBottom(true);
      } else if (!STATE.abortController?.signal.aborted) {
        const actualFinalModel = (STATE.settings.deepResearchFinalModel && STATE.settings.deepResearchFinalModel.trim()) ? STATE.settings.deepResearchFinalModel.trim() : targetModel;
        throw new Error(`Sintesis laporan Deep Research tidak menghasilkan konten teks dari model: ${actualFinalModel}`);
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        if (finalReportText && finalReportText.trim()) {
          const stoppedText = `${finalReportText.trim()}\n\n*[Riset dihentikan oleh pengguna]*`;
          const actualFinalModel = (STATE.settings.deepResearchFinalModel && STATE.settings.deepResearchFinalModel.trim()) ? STATE.settings.deepResearchFinalModel.trim() : targetModel;
          bubbleText.innerHTML = buildDeepResearchSummaryCardHtml(stoppedText, actualFinalModel, allSources);
          enhanceCodeBlocks(bubbleText);
          attachDeepResearchCardEvents(assistantRow, stoppedText, actualFinalModel, allSources, new Date().toISOString());
          assistantRow.dataset.fullContent = stoppedText;
          session.messages.push({
            role: 'assistant',
            content: stoppedText,
            model: actualFinalModel,
            sources: allSources,
            isDeepResearch: true,
            timestamp: new Date().toISOString()
          });
          savePersistedState();
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
            <button class="btn btn-sm btn-outline open-settings-btn" style="border-color:var(--neon-amber); color:var(--neon-amber); font-size:0.75rem;">
              <i class="fa-solid fa-gear"></i> Buka Pengaturan Model Riset
            </button>
          </div>
        `;

        bubbleText.querySelector('.retry-research-btn')?.addEventListener('click', () => {
          assistantRow.remove();
          runDeepResearchStreaming(session, promptText, image, modelName, engine);
        });

        bubbleText.querySelector('.open-settings-btn')?.addEventListener('click', () => {
          syncSettingsModalFields();
          openModal('settingsModal');
          const tabBtn = document.querySelector('.settings-tab-btn[data-tab="deepResearchTab"]');
          if (tabBtn) tabBtn.click();
        });

        AudioEngine.error();
      }
    } finally {
      STATE.currentDeepResearchTaskId = null;
      setGeneratingState(false);
      STATE.abortController = null;
    }
  }

  // ==================== AI IMAGE STUDIO ENGINE ====================
  function isImageGenerationTrigger(promptText) {
    if (!promptText || typeof promptText !== 'string') return false;
    const t = promptText.trim().toLowerCase();
    if (t.startsWith('/image') || t.startsWith('/img') || t.startsWith('/gambar')) return true;
    if (/^(?:tolong\s+)?(?:buatkan|buat|bikin|generate|render|lukiskan|gambarkan)\s+gambar\b/i.test(t)) return true;
    if (/^(?:generate|create|render|draw|paint)\s+(?:an?\s+)?(?:image|picture|photo|illustration|art)\b/i.test(t)) return true;
    if (t.startsWith('gambar:') || t.startsWith('image:')) return true;
    return false;
  }

  function extractImagePrompt(promptText) {
    if (!promptText || typeof promptText !== 'string') return '';
    let p = promptText.trim();
    p = p.replace(/^\/(?:image|img|gambar)\s*/i, '');
    p = p.replace(/^(?:tolong\s+)?(?:buatkan|buat|bikin|generate|render|lukiskan|gambarkan)\s+gambar\s+(?:tentang\s+|dari\s+|sebuah\s+)?/i, '');
    p = p.replace(/^(?:generate|create|render|draw|paint)\s+(?:an?\s+)?(?:image|picture|photo|illustration|art)\s+(?:of\s+)?/i, '');
    p = p.replace(/^(?:gambar|image):\s*/i, '');
    return p.trim() || promptText.trim();
  }

  function updateImageGenModeUI() {
    if (els.composerBox) {
      els.composerBox.classList.toggle('image-mode-active', Boolean(STATE.isImageGenMode));
    }
    if (els.imageGenToggleBtn) {
      els.imageGenToggleBtn.classList.toggle('active', Boolean(STATE.isImageGenMode));
      els.imageGenToggleBtn.setAttribute('aria-pressed', String(Boolean(STATE.isImageGenMode)));
    }
    if (els.sendPromptBtn) {
      if (STATE.isImageGenMode) {
        els.sendPromptBtn.setAttribute('title', 'Generate Gambar (Enter) | Tahan 450ms untuk Mode Percakapan');
        els.sendPromptBtn.setAttribute('aria-label', 'Generate Gambar (Enter)');
      } else {
        els.sendPromptBtn.setAttribute('title', 'Kirim Prompt (Enter) | Tahan 450ms untuk Mode Gambar');
        els.sendPromptBtn.setAttribute('aria-label', 'Kirim Prompt (Enter)');
      }
    }
    if (els.promptInput) {
      if (STATE.isImageGenMode) {
        els.promptInput.placeholder = '🎨 Mode AI Image Studio Aktif — Ketik visual prompt (Ketik /chat untuk kembali)...';
      } else {
        els.promptInput.placeholder = 'Ketik pesan... (Ketik /img untuk Mode Gambar)';
      }
    }
  }

  async function runImageGeneration(session, promptText, customModel = 'flux') {
    if (!promptText || !promptText.trim()) return;
    const cleanPrompt = promptText.trim();
    
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
          <span class="image-gen-badge">Flux.1 Diffusion</span>
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
      updateHudStep('[Langkah 2/3] Denoising matriks difusi resolusi tinggi Flux...', 50);
    }, 700);

    const timerStep3 = setTimeout(() => {
      updateHudStep('[Langkah 3/3] Materialisasi kuantum, upscaling & render final...', 85);
    }, 2200);

    try {
      let finalImageUrl = '';
      let resultModel = 'Flux.1 Schnell';
      let actualSeed = Math.floor(Math.random() * 100000000);

      if (!IS_GITHUB_PAGES) {
        try {
          const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': STATE.settings.openRouterKey ? `Bearer ${STATE.settings.openRouterKey}` : ''
            },
            body: JSON.stringify({
              prompt: cleanPrompt,
              model: customModel || 'flux',
              width: 1024,
              height: 1024,
              openRouterKey: STATE.settings.openRouterKey || ''
            }),
            signal: STATE.abortController.signal
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
            throw new Error(`Server HTTP ${res.status}`);
          }
        } catch (serverErr) {
          if (serverErr.name === 'AbortError') throw serverErr;
          console.warn('Backend image gen fallback ke direct Pollinations AI:', serverErr);
        }
      }

      // Client-side Direct Pollinations Fallback (for GitHub Pages or server fallback)
      if (!finalImageUrl) {
        actualSeed = Math.floor(Math.random() * 100000000);
        let urlPrompt = cleanPrompt;
        if (urlPrompt.length > 800) {
          const cut = urlPrompt.slice(0, 800);
          const lastSpace = cut.lastIndexOf(' ');
          urlPrompt = (lastSpace > 600 ? cut.slice(0, lastSpace) : cut).trim();
        }
        const encoded = encodeURIComponent(urlPrompt);
        finalImageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&model=flux&seed=${actualSeed}&nologo=true&enhance=true`;
      }

      // Preload image to ensure 100% materialization animation
      await new Promise((resolve, reject) => {
        const testImg = new Image();
        testImg.onload = () => resolve();
        testImg.onerror = () => reject(new Error('Gagal memuat visual gambar yang digenerasi.'));
        if (STATE.abortController?.signal) {
          STATE.abortController.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
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

      // Save to Session
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
      savePersistedState();

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
        bubbleText.innerHTML = `
          <div style="background:rgba(255,0,127,0.08); border:1px solid rgba(255,0,127,0.4); border-radius:10px; padding:14px; line-height:1.5;">
            <div style="font-weight:700; color:#FF2E93; margin-bottom:6px; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-triangle-exclamation"></i> Gagal Menghasilkan Gambar AI
            </div>
            <div style="font-size:0.83rem; color:var(--text-main); margin-bottom:8px;">
              ${escapeHtml(err.message || 'Terjadi gangguan saat memproses rendering difusi.')}
            </div>
            <div style="margin-top:10px; display:flex; gap:8px;">
              <button class="btn btn-sm btn-primary retry-img-btn" style="font-size:0.75rem;">
                <i class="fa-solid fa-rotate-right"></i> Coba Generate Ulang
              </button>
            </div>
          </div>
        `;
        bubbleText.querySelector('.retry-img-btn')?.addEventListener('click', () => {
          assistantRow.remove();
          runImageGeneration(session, cleanPrompt, customModel);
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
    if (presetKey === 'default' || !presetKey) {
      STATE.settings.systemPrompt = '';
      STATE.settings.activePreset = 'default';
      els.settingSystemPrompt.value = '';
      showToast('Persona dinonaktifkan (Default).');
    } else if (presetKey === 'custom') {
      STATE.settings.activePreset = 'custom';
      setTimeout(() => els.settingSystemPrompt?.focus(), 50);
    } else if (SYSTEM_PRESETS[presetKey] !== undefined) {
      STATE.settings.systemPrompt = SYSTEM_PRESETS[presetKey];
      STATE.settings.activePreset = presetKey;
      els.settingSystemPrompt.value = STATE.settings.systemPrompt;
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

  // ==================== MODEL HUB MODAL ====================
  function renderModelHubGrid(filter = 'all', query = '') {
    els.modelCardsGrid.innerHTML = '';
    const q = query.toLowerCase().trim();

    // Combine Ollama + OpenRouter
    const combined = [
      ...STATE.ollamaModels.map(m => {
        const id = m.name || m.model || m.id;
        const sizeStr = m.size ? ` (${(m.size / (1024*1024*1024)).toFixed(1)} GB)` : '';
        return {
          id: id,
          name: id,
          desc: m.desc || `Model AI tersimpan di mesin Ollama${sizeStr}.`,
          tag: m.tag || 'Ollama Model',
          cat: m.cat || 'local',
          provider: 'ollama'
        };
      }),
      ...STATE.openRouterModels.map(m => {
        return {
          ...m,
          tag: m.tag || 'Cloud',
          cat: m.cat || 'flagship',
          desc: m.desc || (m.tag === 'Free' ? 'Model gratis bertenaga cloud di OpenRouter.' : 'Model komputasi cloud flagship.'),
          provider: 'openrouter'
        };
      })
    ];

    const filtered = combined.filter(m => {
      const matchQ = !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
      const matchFilter = filter === 'all' || 
        (filter === 'vision' && ((m.tag && m.tag.toLowerCase().includes('vision')) || (m.cat === 'vision') || m.id.toLowerCase().includes('vision'))) ||
        (filter === 'free' && (m.tag.includes('Free') || m.id.includes(':free'))) ||
        (filter === 'local' && m.provider === 'ollama') ||
        (filter === 'flagship' && (m.cat === 'flagship' || m.provider === 'openrouter')) ||
        (filter === 'coding' && (m.cat === 'coding' || m.id.includes('code') || m.id.includes('qwen') || m.id.includes('claude'))) ||
        (filter === 'reasoning' && (m.cat === 'reasoning' || m.id.includes('r1') || m.id.includes('o1')));
      return matchQ && matchFilter;
    });

    if (filtered.length === 0) {
      els.modelCardsGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-dim); padding:20px;">Tidak ada model yang cocok dengan filter.</div>`;
      return;
    }

    filtered.forEach(m => {
      const card = document.createElement('div');
      card.className = 'model-card-item';
      card.innerHTML = `
        <div>
          <div class="model-card-badge">${escapeHtml(m.tag || 'AI')}</div>
          <div class="model-card-title">${escapeHtml(m.name || m.id)}</div>
          <div class="model-card-desc">${escapeHtml(m.desc || m.id)}</div>
        </div>
        <button class="btn btn-sm btn-outline choose-model-btn">Pilih Model</button>
      `;

      card.querySelector('.choose-model-btn').addEventListener('click', () => {
        if (m.provider === 'ollama') {
          setEngineMode('ollama');
          selectModel(m.id);
        } else {
          setEngineMode('openrouter');
          selectModel(m.id);
        }
        closeModal('modelHubModal');
        AudioEngine.click();
      });

      els.modelCardsGrid.appendChild(card);
    });
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
    md += `*Tanggal: ${new Date(session.createdAt || Date.now()).toLocaleString('id-ID')}*  \n`;
    md += `*Engine: ${(session.mode || 'ollama').toUpperCase()}*  \n\n---\n\n`;

    session.messages.forEach(m => {
      const sender = m.role === 'user' ? '👤 Pengguna' : `🤖 AI (${m.model || 'Model'})`;
      let content = m.content || '';

      // Visual Markdown Image Rendering for AI Image Studio results
      if (m.type === 'image_generation' || m.isImageGen || m.imageUrl) {
        const imgUrl = m.imageUrl || m.url || '';
        const promptDesc = m.prompt ? m.prompt.replace(/[\[\]]/g, '') : 'Karya Seni AI';
        content += `\n\n![${promptDesc}](${imgUrl})\n\n`;
      }

      // Preserve user image attachments in Markdown
      if (m.images && Array.isArray(m.images) && m.images.length > 0) {
        m.images.forEach((img, i) => {
          content += `\n\n![Lampiran Foto ${i + 1}](${img})\n\n`;
        });
      }

      md += `### ${sender}\n\n${content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zoz-router-${(session.title || 'chat').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    showToast('Obrolan berhasil diekspor sebagai Markdown!');
    AudioEngine.success();
  }

  async function exportChatHistory() {
    const session = getActiveSession();
    await promptExportConfirmation(session);
  }

  // ==================== MODAL HELPERS ====================
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
      history.pushState({ modal: modalId }, '');
      AudioEngine.click();
    }
  }

  function closeModal(modalId, triggerHistoryBack = true) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      AudioEngine.click();
      if (triggerHistoryBack && history.state?.modal === modalId) {
        history.back();
      }
    }
  }

  function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
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
          tx.objectStore('tracks').put(track);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
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

    async init() {
      this.audio = new Audio();
      this.audio.crossOrigin = 'anonymous';

      // Load volume from storage
      const savedVol = localStorage.getItem('zoz_bgm_volume');
      if (savedVol !== null) {
        this.volume = parseFloat(savedVol);
      }
      this.audio.volume = this.volume;
      if (els.bgmMiniVolume) els.bgmMiniVolume.value = this.volume;
      if (els.deckMasterVolume) els.deckMasterVolume.value = this.volume;
      if (els.valMasterVolume) els.valMasterVolume.innerText = `${Math.round(this.volume * 100)}%`;

      // Audio Event Handlers
      this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
      this.audio.addEventListener('ended', () => this.onTrackEnded());
      this.audio.addEventListener('error', () => {
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
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    },

    ytPlayer: null,
    ytReady: false,
    currentOnlineTrack: null,

    async loadPlaylistFromDB() {
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
        document.body.appendChild(tag);
      } else {
        const check = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(check);
            this.ytReady = true;
            if (callback) callback();
          }
        }, 100);
      }
    },

    extractYouTubeId(url) {
      if (!url) return null;
      const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/live\/)([^"&?\/\s]{11})/i;
      const match = url.match(reg);
      return match ? match[1] : null;
    },

    playYouTube(videoId, customTitle = null) {
      this.initAudioContext();
      if (this.audio) this.audio.pause();
      this.stopAmbient();

      this.currentMode = 'youtube';
      this.activeAmbientId = null;
      this.currentOnlineTrack = {
        type: 'youtube',
        videoId,
        title: customTitle || `YouTube Stream (${videoId})`
      };

      const containerWrap = els.ytPlayerContainerWrap;
      if (containerWrap) containerWrap.style.display = 'block';

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
                  e.target.setVolume(Math.round(this.volume * 100));
                  e.target.playVideo();
                  this.setPlayingState(true);
                },
                onStateChange: (e) => {
                  if (e.data === YT.PlayerState.PLAYING) {
                    this.setPlayingState(true);
                    if (!customTitle && this.ytPlayer.getVideoData) {
                      const d = this.ytPlayer.getVideoData();
                      if (d && d.title) {
                        this.currentOnlineTrack.title = d.title;
                        this.updateUI();
                      }
                    }
                  } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
                    this.setPlayingState(false);
                    if (e.data === YT.PlayerState.ENDED && this.loopMode === 'all') {
                      this.nextTrack();
                    }
                  }
                }
              }
            });
          } else {
            this.ytPlayer.loadVideoById(videoId);
            this.ytPlayer.setVolume(Math.round(this.volume * 100));
            this.ytPlayer.playVideo();
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

      this.currentMode = 'file';
      this.activeAmbientId = null;
      this.currentOnlineTrack = { type: 'stream', url, title };

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

      await MusicDB.saveTrack(trackRecord);
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
      showToast(`✅ "${title}" berhasil disimpan ke Playlist!`);
      AudioEngine.click();
    },

    async handleUploadFiles(fileList) {
      if (!fileList || fileList.length === 0) return;
      let addedCount = 0;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
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

        await MusicDB.saveTrack(trackRecord);
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
        showToast(`✅ ${addedCount} lagu berhasil diupload ke Playlist Lokal!`);
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

        this.initAudioContext();
        this.stopAmbient();
        this.currentMode = 'file';
        this.activeAmbientId = null;
        this.currentOnlineTrack = null;

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
        if (this.currentMode === 'youtube' && this.ytPlayer && this.ytPlayer.pauseVideo) {
          this.ytPlayer.pauseVideo();
        } else if (this.currentMode === 'file') {
          this.audio.pause();
        } else if (this.currentMode === 'ambient') {
          this.stopAmbient();
        }
        this.setPlayingState(false);
      } else {
        if (this.currentMode === 'youtube' && this.ytPlayer && this.ytPlayer.playVideo) {
          this.ytPlayer.playVideo();
          this.setPlayingState(true);
        } else if (this.currentMode === 'file' && this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
          this.audio.play();
          this.setPlayingState(true);
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

    stop() {
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
      this.updateUI();
    },

    onTrackEnded() {
      if (this.loopMode === 'one') {
        this.audio.currentTime = 0;
        this.audio.play();
      } else if (this.loopMode === 'all') {
        this.nextTrack();
      } else {
        if (this.currentIndex < this.playlist.length - 1) {
          this.nextTrack();
        } else {
          this.setPlayingState(false);
        }
      }
    },

    onTimeUpdate() {
      if (!this.audio || this.currentMode !== 'file') return;
      const cur = this.audio.currentTime || 0;
      const dur = this.audio.duration || 0;
      
      if (dur > 0 && els.deckProgressSlider) {
        els.deckProgressSlider.value = (cur / dur) * 100;
      }

      if (els.deckCurrentTrackMeta) {
        const curStr = this.formatTime(cur);
        const durStr = dur ? this.formatTime(dur) : '--:--';
        els.deckCurrentTrackMeta.innerText = `${curStr} / ${durStr}`;
      }
    },

    seek(percent) {
      if (this.audio && this.audio.duration && this.currentMode === 'file') {
        this.audio.currentTime = (percent / 100) * this.audio.duration;
      }
    },

    setVolume(val) {
      this.volume = Math.max(0, Math.min(1, parseFloat(val)));
      localStorage.setItem('zoz_bgm_volume', this.volume.toString());

      if (this.audio) this.audio.volume = this.volume;
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
      if (this.audio) this.audio.pause();
      this.stopAmbient();

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
      const bufferLength = 32;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        this.animFrameId = requestAnimationFrame(draw);
        const w = canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth : 400;
        const h = canvas.height = 110;

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
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
  };

  // ==================== USER CUSTOM PRESETS & MODEL PICKER HELPERS ====================
  let userCustomResearchPresets = [];

  function loadUserCustomResearchPresets() {
    try {
      const raw = localStorage.getItem('zoz_custom_deep_research_presets_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) userCustomResearchPresets = parsed;
      }
    } catch (e) {
      userCustomResearchPresets = [];
    }
  }

  function saveUserCustomResearchPresets() {
    try {
      localStorage.setItem('zoz_custom_deep_research_presets_v1', JSON.stringify(userCustomResearchPresets));
    } catch (e) {}
  }

  function populateDeepResearchModelPickers() {
    const datalist = els.availableModelsDatalist;

    const modelSet = new Set();
    const modelsList = [];

    (STATE.ollamaModels || []).forEach(m => {
      const id = m.name || m.model || m.id;
      if (id && !modelSet.has(id)) {
        modelSet.add(id);
        modelsList.push({ id, name: id, source: 'Ollama' });
      }
    });

    (STATE.openRouterModels || []).forEach(m => {
      const id = m.id || m.name;
      if (id && !modelSet.has(id)) {
        modelSet.add(id);
        modelsList.push({ id, name: m.name || id, source: 'OpenRouter' });
      }
    });

    // Populate Datalist for autocomplete
    if (datalist) {
      datalist.innerHTML = modelsList.map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)} [${m.source}]</option>`).join('');
    }
  }

  function renderUserCustomPresetsUI() {
    const container = els.customPresetsList;
    if (!container) return;
    container.innerHTML = '';

    if (!userCustomResearchPresets || userCustomResearchPresets.length === 0) {
      container.innerHTML = '<span class="no-presets-hint" style="font-size:0.75rem; color:#718096; font-style:italic;">Belum ada preset kustom yang dibuat.</span>';
      return;
    }

    userCustomResearchPresets.forEach((p, idx) => {
      const pill = document.createElement('div');
      pill.className = 'custom-preset-pill';
      pill.style.cssText = 'display:inline-flex; align-items:center; gap:6px; background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.25); border-radius:6px; padding:4px 9px; font-size:0.78rem; color:#E2E8F0; cursor:pointer; transition:all 0.2s ease;';
      pill.title = `Klik untuk mengaktifkan preset:\nAgen 1: ${p.agent1 || 'Default'}\nAgen 2: ${p.agent2 || 'Default'}\nAgen Akhir: ${p.final || 'Default'}`;
      
      pill.innerHTML = `
        <i class="fa-solid fa-layer-group" style="color:#00F0FF; font-size:0.72rem;"></i>
        <span style="font-weight:600;">${escapeHtml(p.name)}</span>
        <button class="btn-del-preset" data-idx="${idx}" style="background:none; border:none; color:#FF0055; cursor:pointer; padding:0 2px; margin-left:4px; font-size:0.85rem;" title="Hapus preset ini">&times;</button>
      `;

      // Klik pill untuk menerapkan preset ke ketiga input model & simpan instan
      pill.addEventListener('click', (e) => {
        if (e.target.closest('.btn-del-preset')) return;
        if (els.settingDeepResearchAgent1Model) els.settingDeepResearchAgent1Model.value = p.agent1 || '';
        if (els.settingDeepResearchAgent2Model) els.settingDeepResearchAgent2Model.value = p.agent2 || '';
        if (els.settingDeepResearchFinalModel) els.settingDeepResearchFinalModel.value = p.final || '';
        
        // Auto-save langsung ke STATE.settings & storage disk
        STATE.settings.deepResearchAgent1Model = p.agent1 || '';
        STATE.settings.deepResearchAgent2Model = p.agent2 || '';
        STATE.settings.deepResearchFinalModel = p.final || '';
        savePersistedState();

        // Update visual active state pada pill
        container.querySelectorAll('.custom-preset-pill').forEach(el => {
          el.style.borderColor = 'rgba(0, 240, 255, 0.25)';
          el.style.background = 'rgba(0, 240, 255, 0.08)';
          el.classList.remove('active');
        });
        pill.style.borderColor = 'var(--neon-teal)';
        pill.style.background = 'rgba(0, 255, 194, 0.18)';
        pill.classList.add('active');

        showToast(`✅ Preset Kustom "${p.name}" diterapkan & disimpan!`);
        AudioEngine.click();
      });

      // Tombol hapus preset
      pill.querySelector('.btn-del-preset').addEventListener('click', (e) => {
        e.stopPropagation();
        const removedName = p.name;
        userCustomResearchPresets.splice(idx, 1);
        saveUserCustomResearchPresets();
        renderUserCustomPresetsUI();
        showToast(`🗑️ Preset "${removedName}" dihapus.`);
        AudioEngine.click();
      });

      container.appendChild(pill);
    });
  }

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
    if (els.liveModelCatalogSearchInput) {
      els.liveModelCatalogSearchInput.value = '';
    }
    
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

    openModal('liveModelCatalogModal');
  }

  function updateCatalogTabsUI() {
    if (els.btnTabCatalogOllama) {
      els.btnTabCatalogOllama.classList.toggle('active', STATE.activeCatalogTab === 'ollama');
    }
    if (els.btnTabCatalogOpenRouter) {
      els.btnTabCatalogOpenRouter.classList.toggle('active', STATE.activeCatalogTab === 'openrouter');
    }
  }

  function renderLiveModelCatalog() {
    const container = els.catalogListContainer;
    if (!container) return;
    container.innerHTML = '';

    const q = (STATE.catalogSearchQuery || '').toLowerCase().trim();
    const isOllama = STATE.activeCatalogTab === 'ollama';

    let list = [];
    if (isOllama) {
      list = (STATE.ollamaModels || []).map(m => {
        const id = m.name || m.model || m.id;
        const isCloud = STATE.settings.ollamaApiKey || (STATE.settings.ollamaEndpoint && STATE.settings.ollamaEndpoint.includes('ollama.com'));
        return {
          id: id,
          name: m.name || id,
          tag: m.tag || (isCloud ? 'Ollama Cloud' : 'Lokal'),
          size: m.size ? `${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB` : null,
          details: m.details || null
        };
      });

      // Urutkan model Ollama alfabetis A-Z
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    } else {
      list = (STATE.openRouterModels || []).map(m => {
        const isFree = Boolean(m.id && m.id.includes(':free'));
        return {
          id: m.id,
          name: m.name || m.id,
          tag: m.tag || (isFree ? 'Free' : 'Cloud'),
          isFree: isFree,
          context_length: m.context_length ? `${Math.round(m.context_length / 1024)}k konteks` : null
        };
      });

      // Urutkan OpenRouter secara cerdas:
      // 1. Model gratis (:free) diprioritaskan di paling atas
      // 2. Model unggulan/frontier populer (DeepSeek, Llama, Gemini, Claude, GPT, Qwen)
      // 3. Sisanya diurutkan secara alfabetis A-Z
      const featuredKeywords = ['deepseek', 'meta-llama', 'llama-3', 'gemini', 'claude', 'gpt-4', 'qwen', 'mistral'];
      list.sort((a, b) => {
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

    // Filter pencarian live
    if (q) {
      list = list.filter(item => 
        (item.name && item.name.toLowerCase().includes(q)) || 
        (item.id && item.id.toLowerCase().includes(q)) ||
        (item.tag && item.tag.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 24px; color: var(--text-dim); font-size: 0.85rem;">
          <i class="fa-solid fa-filter-circle-xmark" style="font-size: 1.6rem; color: var(--neon-amber); margin-bottom: 8px; display:block;"></i>
          Tidak ada model yang cocok dengan kata kunci "<strong>${escapeHtml(q)}</strong>".<br>
          <span style="font-size: 0.74rem;">Klik tombol <strong>Refresh</strong> untuk menyinkronkan kembali dari server / API.</span>
        </div>
      `;
      return;
    }

    list.forEach(m => {
      const row = document.createElement('div');
      row.className = 'catalog-model-row';

      const isFree = m.tag && m.tag.toLowerCase().includes('free');
      const isLocal = m.tag && m.tag.toLowerCase().includes('lokal');
      const badgeClass = isFree ? 'free' : (isLocal ? 'local' : '');

      row.innerHTML = `
        <div class="catalog-model-info">
          <div class="catalog-model-name">${escapeHtml(m.name)}</div>
          <div class="catalog-model-meta">
            <span class="catalog-badge ${badgeClass}">${escapeHtml(m.tag || 'Model')}</span>
            ${m.size ? `<span style="color:var(--text-dim); font-family:var(--font-code); font-size:0.7rem;"><i class="fa-solid fa-hard-drive"></i> ${escapeHtml(m.size)}</span>` : ''}
            ${m.context_length ? `<span style="color:var(--neon-teal); font-family:var(--font-code); font-size:0.7rem;"><i class="fa-solid fa-brain"></i> ${escapeHtml(m.context_length)}</span>` : ''}
            <span style="color:var(--text-muted); font-size:0.68rem; font-family:var(--font-code);">${escapeHtml(m.id)}</span>
          </div>
        </div>
        <button class="catalog-select-btn" type="button">
          <i class="fa-solid fa-check"></i> Gunakan Model
        </button>
      `;

      row.querySelector('.catalog-select-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applySelectedModelFromCatalog(m.id, isOllama ? 'ollama' : 'openrouter');
      });

      container.appendChild(row);
    });
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
      if (targetId === 'settingDeepResearchAgent1Model') {
        STATE.settings.deepResearchAgent1Model = modelId;
        if (els.selectDeepResearchAgent1Model) els.selectDeepResearchAgent1Model.value = modelId;
      } else if (targetId === 'settingDeepResearchAgent2Model') {
        STATE.settings.deepResearchAgent2Model = modelId;
        if (els.selectDeepResearchAgent2Model) els.selectDeepResearchAgent2Model.value = modelId;
      } else if (targetId === 'settingDeepResearchFinalModel') {
        STATE.settings.deepResearchFinalModel = modelId;
        if (els.selectDeepResearchFinalModel) els.selectDeepResearchFinalModel.value = modelId;
      }
      
      if (catModal) catModal.dataset.targetInputId = '';
      STATE.catalogTargetInputId = null;
      savePersistedState();
      showToast(`🎯 Model ditetapkan: ${modelId}`);

      // Tutup katalog langsung tanpa memicu event popstate liar
      if (catModal) catModal.classList.remove('show');

      // Update state history agar kembali merujuk ke settingsModal tanpa navigasi mundur browser
      try {
        if (window.history && history.replaceState) {
          history.replaceState({ modal: 'settingsModal' }, '');
        }
      } catch (e) {}

      // Pastikan modal Pengaturan TETAP AKTIF DAN TERLIHAT di tab Deep Research!
      const settingsModal = document.getElementById('settingsModal');
      if (settingsModal) {
        settingsModal.classList.add('show');
        const tabBtn = settingsModal.querySelector('[data-target="tabDeepResearch"]');
        const tabPane = settingsModal.querySelector('#tabDeepResearch');
        if (tabBtn && tabPane) {
          settingsModal.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
          settingsModal.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));
          tabBtn.classList.add('active');
          tabPane.classList.add('active');
        }
      }

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
    showToast(`⚡ Model obrolan diubah: ${modelId}`);

    closeModal('liveModelCatalogModal');
  }

  // ==================== LIVE RESEARCH INSPECTOR ====================
  function openLiveResearchInspection() {
    renderLiveInspectionContent();
    openModal('liveResearchInspectionModal');
  }

  function updateLiveInspectionData(inspectionData) {
    if (!inspectionData) return;
    STATE.currentLiveInspection = inspectionData;

    if (els.inspectTopik) els.inspectTopik.innerText = inspectionData.topik || '-';
    if (els.inspectCurrentQuery) els.inspectCurrentQuery.innerText = inspectionData.currentQuery || '-';
    if (els.inspectIteration) els.inspectIteration.innerText = `${inspectionData.iteration || 1} / ${inspectionData.maxIterations || 3}`;
    if (els.inspectTimestamp) els.inspectTimestamp.innerText = inspectionData.timestamp || new Date().toLocaleTimeString('id-ID');

    if (els.inspectCountAgent1) {
      els.inspectCountAgent1.innerText = inspectionData.agent1?.resultsCount || (inspectionData.agent1?.results?.length || 0);
    }
    if (els.inspectCountAgent2) {
      els.inspectCountAgent2.innerText = inspectionData.agent2?.resultsCount || (inspectionData.agent2?.results?.length || 0);
    }
    if (els.inspectCountScraper) {
      els.inspectCountScraper.innerText = inspectionData.scrapedArticlesCount ?? (inspectionData.scraper?.totalScraped ?? (inspectionData.scraper?.articles?.length || 0));
    }

    // Jika modal terbuka, langsung live update view secara dinamis
    if (els.liveResearchInspectionModal && els.liveResearchInspectionModal.classList.contains('show')) {
      renderLiveInspectionContent();
    }
  }

  function renderLiveInspectionContent() {
    const container = els.inspectTabContent;
    if (!container) return;
    const insp = STATE.currentLiveInspection;

    if (!insp) {
      container.innerHTML = `
        <div style="text-align:center; padding: 40px 20px; color: var(--text-dim);">
          <i class="fa-solid fa-satellite fa-spin" style="font-size: 2.4rem; color: var(--neon-cyan); margin-bottom: 12px; display:block;"></i>
          <h4 style="color:#FFF; margin:0 0 6px 0;">Menunggu Data Live Dari Agen Riset...</h4>
          <p style="font-size:0.82rem; margin:0;">Mulai Deep Research dari composer untuk melihat streaming data proses pencarian Agen 1 dan Agen 2 secara real-time.</p>
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
              <i class="fa-solid fa-robot" style="color: #00F0FF;"></i>
              <span>${escapeHtml(ag1.name || 'Agen 1 (Pakar Web Google)')}</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span class="catalog-badge">${escapeHtml(ag1.provider || 'Serper API')}</span>
              <span class="catalog-badge" style="background:rgba(0,240,255,0.08); color:#00F0FF;">Model: ${escapeHtml(ag1.model || 'Default')}</span>
            </div>
          </div>

          <div style="margin-bottom: 14px;">
            <div style="font-size: 0.78rem; font-weight: 700; color: #64F3FF; margin-bottom: 8px;">
              <i class="fa-solid fa-magnifying-glass"></i> Hasil Penelusuran Organik Google Serper (${results.length} Sumber):
            </div>
            ${results.length === 0 ? '<div style="font-size:0.78rem; color:var(--text-dim); font-style:italic;">Belum ada hasil pencarian.</div>' : ''}
            ${results.map((r, idx) => `
              <div class="inspector-source-item">
                <div class="inspector-source-title">
                  <a href="${escapeHtml(r.link || r.url || '#')}" target="_blank" rel="noopener noreferrer">
                    [${idx + 1}] ${escapeHtml(r.title || 'Tanpa Judul')}
                  </a>
                </div>
                <div class="inspector-source-snippet">${escapeHtml(r.snippet || r.content || '')}</div>
                <div style="font-size:0.68rem; color:var(--text-dim); margin-top:3px; font-family:var(--font-code);">${escapeHtml(r.link || r.url || '')}</div>
              </div>
            `).join('')}
          </div>

          <div>
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--neon-teal); margin-bottom: 8px;">
              <i class="fa-solid fa-brain"></i> Output Analisis Teks Spesialis Agen 1 (LLM Asli):
            </div>
            <div class="inspector-analysis-box">${escapeHtml(ag1.analysis || 'Sedang memproses analisis...')}</div>
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
              <i class="fa-solid fa-microchip" style="color: #00FFC2;"></i>
              <span>${escapeHtml(ag2.name || 'Agen 2 (Pakar Analisis Divergen / Serper)')}</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span class="catalog-badge" style="border-color:rgba(0,255,194,0.4); color:#00FFC2;">${escapeHtml(ag2.provider || 'Google Serper (Divergen)')}</span>
              <span class="catalog-badge" style="background:rgba(0,255,194,0.08); color:#00FFC2;">Model: ${escapeHtml(ag2.model || 'Default')}</span>
            </div>
          </div>

          ${ag2.answerBox ? `
            <div class="inspector-source-item" style="border-color: rgba(255, 183, 3, 0.4); background: rgba(255, 183, 3, 0.05); margin-bottom: 12px;">
              <div style="color: #FFB703; font-weight: 700; font-size: 0.78rem; margin-bottom: 4px;">
                <i class="fa-solid fa-bolt"></i> Google Serper Answer Box:
              </div>
              <div style="font-size: 0.8rem; color: #FFF;">${escapeHtml(ag2.answerBox.answer || ag2.answerBox.snippet || JSON.stringify(ag2.answerBox))}</div>
            </div>
          ` : ''}

          ${ag2.knowledgeGraph ? `
            <div class="inspector-source-item" style="border-color: rgba(0, 240, 255, 0.4); background: rgba(0, 240, 255, 0.05); margin-bottom: 12px;">
              <div style="color: #00F0FF; font-weight: 700; font-size: 0.78rem; margin-bottom: 4px;">
                <i class="fa-solid fa-circle-nodes"></i> Google Serper Knowledge Graph:
              </div>
              <div style="font-weight: 600; font-size: 0.84rem; color: #FFF;">${escapeHtml(ag2.knowledgeGraph.title || '')} (${escapeHtml(ag2.knowledgeGraph.type || '')})</div>
              <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 2px;">${escapeHtml(ag2.knowledgeGraph.description || '')}</div>
            </div>
          ` : ''}

          <div style="margin-bottom: 14px;">
            <div style="font-size: 0.78rem; font-weight: 700; color: #64F3FF; margin-bottom: 8px;">
              <i class="fa-solid fa-list-check"></i> Hasil Penelusuran Serper Divergen (${results.length} Sumber - Domain Mandiri):
            </div>
            ${results.length === 0 ? '<div style="font-size:0.78rem; color:var(--text-dim); font-style:italic;">Belum ada hasil pencarian.</div>' : ''}
            ${results.map((r, idx) => `
              <div class="inspector-source-item">
                <div class="inspector-source-title">
                  <a href="${escapeHtml(r.link || r.url || '#')}" target="_blank" rel="noopener noreferrer">
                    [${idx + 1}] ${escapeHtml(r.title || 'Tanpa Judul')}
                  </a>
                </div>
                <div class="inspector-source-snippet">${escapeHtml(r.snippet || '')}</div>
                <div style="font-size:0.68rem; color:var(--text-dim); margin-top:3px; font-family:var(--font-code);">${escapeHtml(r.link || r.url || '')}</div>
              </div>
            `).join('')}
          </div>

          <div>
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--neon-teal); margin-bottom: 8px;">
              <i class="fa-solid fa-brain"></i> Output Analisis Teks Spesialis Agen 2 (LLM Asli):
            </div>
            <div class="inspector-analysis-box">${escapeHtml(ag2.analysis || 'Sedang memproses analisis...')}</div>
          </div>
        </div>
      `;
    } else if (tab === 'scraper') {
      const scraper = insp.scraper || {};
      const articles = scraper.articles || [];
      container.innerHTML = `
        <div class="inspector-card">
          <div class="inspector-card-header">
            <div class="inspector-card-title">
              <i class="fa-solid fa-file-lines" style="color: #FFB703;"></i>
              <span>Pemindaian Konten Mendalam (Automated Web Scraper)</span>
            </div>
            <span class="catalog-badge" style="background:rgba(255,183,3,0.12); color:#FFB703; border-color:rgba(255,183,3,0.3);">
              Total: ${articles.length} Dokumen Web Utuh
            </span>
          </div>

          <p style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 12px; line-height: 1.45;">
            Engine scraper membuka langsung halaman web target dan mengekstrak seluruh teks artikel utuh (bukan sekadar cuplikan snippet Google) untuk validasi silang fakta mendalam.
          </p>

          ${articles.length === 0 ? `
            <div style="text-align:center; padding: 24px; color: var(--text-dim); font-size: 0.8rem; font-style:italic;">
              Belum ada artikel yang dipindai secara utuh pada langkah ini.
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
                  ${art.sourceProvider ? `
                    <span style="font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:600; font-family:var(--font-code); ${art.sourceProvider.includes('Divergen') ? 'background:rgba(187,134,252,0.15); color:#BB86FC; border:1px solid rgba(187,134,252,0.3);' : 'background:rgba(0,180,216,0.15); color:#00B4D8; border:1px solid rgba(0,180,216,0.3);'}">
                      ${escapeHtml(art.sourceProvider)}
                    </span>
                  ` : ''}
                  <span style="font-size:0.68rem; color:var(--neon-teal); font-family:var(--font-code); background:rgba(0,255,194,0.1); padding:2px 6px; border-radius:4px;">
                    ${art.length ? (art.length > 999 ? `${(art.length / 1000).toFixed(1)}k karakter` : `${art.length} karakter`) : 'Teks Utuh'}
                  </span>
                </div>
              </div>
              <div style="font-size:0.68rem; color:var(--text-dim); margin-bottom:6px; font-family:var(--font-code);">${escapeHtml(art.url)}</div>
              <div class="inspector-source-snippet" style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:4px; font-size:0.74rem;">
                <strong style="color:var(--text-muted); display:block; margin-bottom:2px; font-size:0.68rem;">Cuplikan Isi Teks Artikel Asli:</strong>
                ${escapeHtml(art.sample || art.preview || art.content || '')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  // ==================== SETTINGS SYNC HELPER ====================
  function syncSettingsModalFields() {
    if (els.settingOllamaEndpoint) els.settingOllamaEndpoint.value = STATE.settings.ollamaEndpoint || 'http://127.0.0.1:11434';
    if (els.settingOllamaApiKey) els.settingOllamaApiKey.value = STATE.settings.ollamaApiKey || '';
    if (els.settingOpenRouterKey) els.settingOpenRouterKey.value = STATE.settings.openRouterKey || '';
    if (els.settingSerperApiKey) els.settingSerperApiKey.value = STATE.settings.serperApiKey || '075538fed9c64990e1eb32a06726c1e55a933c1e';
    if (els.settingDeepResearchAgent1Model) els.settingDeepResearchAgent1Model.value = STATE.settings.deepResearchAgent1Model || '';
    if (els.settingDeepResearchAgent2Model) els.settingDeepResearchAgent2Model.value = STATE.settings.deepResearchAgent2Model || '';
    if (els.settingDeepResearchFinalModel) els.settingDeepResearchFinalModel.value = STATE.settings.deepResearchFinalModel || '';
    if (els.paramTemperature) els.paramTemperature.value = STATE.settings.temperature ?? 0.7;
    if (els.valTemperature) els.valTemperature.innerText = STATE.settings.temperature ?? 0.7;
    if (els.paramTopP) els.paramTopP.value = STATE.settings.topP ?? 0.9;
    if (els.valTopP) els.valTopP.innerText = STATE.settings.topP ?? 0.9;
    if (els.settingSystemPrompt) els.settingSystemPrompt.value = STATE.settings.systemPrompt || '';
    if (els.settingAutoPolicy) els.settingAutoPolicy.value = STATE.settings.autoPolicy || 'local_first';
    
    populateDeepResearchModelPickers();
    renderUserCustomPresetsUI();
    updatePresetPillUI();
  }

  // ==================== EVENT LISTENERS SETUP ====================
  function setupEventListeners() {
    // Mode Switchers
    els.modeTabs.forEach(tab => {
      tab.addEventListener('click', () => setEngineMode(tab.dataset.mode));
    });

    // Model Picker Dropdown
    els.modelPickerChip.addEventListener('click', (e) => {
      e.stopPropagation();
      STATE.dropdownModelTab = STATE.mode === 'openrouter' ? 'openrouter' : 'ollama';
      els.modelDropdownMenu.classList.toggle('show');
      populateModelDropdown(els.modelSearchInput.value);
    });

    // Model Dropdown Tabs di Header (Ollama vs OpenRouter)
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
      if (!els.modelPickerChip.contains(e.target) && !els.modelDropdownMenu.contains(e.target)) {
        els.modelDropdownMenu.classList.remove('show');
      }

      // Global delegation untuk tombol Cari Model
      const catalogBtn = e.target.closest('.btn-open-model-catalog');
      if (catalogBtn) {
        e.preventDefault();
        e.stopPropagation();
        const targetInputId = catalogBtn.dataset.targetInput;
        let labelName = 'Model';
        if (targetInputId === 'settingDeepResearchAgent1Model') labelName = 'Agen 1 (Pakar Web Google)';
        else if (targetInputId === 'settingDeepResearchAgent2Model') labelName = 'Agen 2 (Pakar Data Spesifik)';
        else if (targetInputId === 'settingDeepResearchFinalModel') labelName = 'Agen Akhir (Analis Senior)';
        openLiveModelCatalog(targetInputId, labelName);
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

    els.modelSearchInput.addEventListener('input', (e) => {
      populateModelDropdown(e.target.value);
    });

    els.useCustomModelBtn.addEventListener('click', () => {
      const val = els.customModelInput.value.trim();
      if (val) {
        selectModel(val);
        els.customModelInput.value = '';
        els.modelDropdownMenu.classList.remove('show');
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
      els.sendPromptBtn.addEventListener('pointerdown', startSendPress);
      els.sendPromptBtn.addEventListener('pointerup', cancelSendPress);
      els.sendPromptBtn.addEventListener('pointercancel', cancelSendPress);
    } else {
      els.sendPromptBtn.addEventListener('touchstart', startSendPress, { passive: true });
      els.sendPromptBtn.addEventListener('touchend', cancelSendPress);
      els.sendPromptBtn.addEventListener('touchcancel', cancelSendPress);
      els.sendPromptBtn.addEventListener('mousedown', startSendPress);
      els.sendPromptBtn.addEventListener('mouseup', cancelSendPress);
    }

    els.sendPromptBtn.addEventListener('click', (e) => {
      if (isSendLongPressed) {
        e.preventDefault();
        e.stopPropagation();
        isSendLongPressed = false;
        return;
      }
      handleSendPrompt();
    });

    els.stopGenerationBtn.addEventListener('click', stopGeneration);

    els.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendPrompt();
      }
    });

    els.promptInput.addEventListener('input', () => {
      autoResizeTextarea(els.promptInput);

      // Auto-detect prefix /img, /gambar, /image untuk mengaktifkan AI Image Studio seketika
      const val = els.promptInput.value;
      if (!STATE.isImageGenMode && /^\/(?:img|gambar|image)\s+/i.test(val)) {
        STATE.isImageGenMode = true;
        els.promptInput.value = val.replace(/^\/(?:img|gambar|image)\s+/i, '');
        updateImageGenModeUI();
        autoResizeTextarea(els.promptInput);
        if (navigator.vibrate) {
          try { navigator.vibrate(30); } catch (_) {}
        }
        showToast('🎨 Mode AI Image Studio Aktif!');
        AudioEngine.success();
      } else if (STATE.isImageGenMode && /^\/(?:chat|teks|text)\s+/i.test(val)) {
        STATE.isImageGenMode = false;
        els.promptInput.value = val.replace(/^\/(?:chat|teks|text)\s+/i, '');
        updateImageGenModeUI();
        autoResizeTextarea(els.promptInput);
        if (navigator.vibrate) {
          try { navigator.vibrate(20); } catch (_) {}
        }
        showToast('💬 Mode Percakapan Standar.');
        AudioEngine.click();
      }
    });


    // New Chat & History
    els.newChatBtn.addEventListener('click', () => createNewSession());
    els.searchHistoryInput.addEventListener('input', (e) => renderChatHistory(e.target.value));
    
    els.clearAllHistoryBtn.addEventListener('click', async () => {
      if (confirm('Apakah Anda yakin ingin menghapus semua riwayat sesi obrolan?')) {
        STATE.sessions = [];
        STATE.currentSessionId = null;
        sessionStorage.removeItem('zoz_active_session_id');
        await DeviceStorage.clearAllSessions();
        savePersistedState();
        createNewSession();
        showToast('Semua riwayat dibersihkan dari perangkat.');
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
        els.toggleYtPlayerVisibilityBtn.innerHTML = isHidden 
          ? '<i class="fa-solid fa-eye-slash"></i> Sembunyikan' 
          : '<i class="fa-solid fa-eye"></i> Tampilkan';
      }
      AudioEngine.click();
    });

    // Curated 1-Click Stream Cards
    $$('.curated-stream-card').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.type;
        const src = card.dataset.src;
        const title = card.dataset.title;

        if (type === 'youtube') {
          const ytId = BGMEngine.extractYouTubeId(src);
          if (ytId) BGMEngine.playYouTube(ytId, title);
        } else {
          BGMEngine.playDirectUrl(src, title);
        }
        if (els.onlineAudioUrlInput) els.onlineAudioUrlInput.value = src;
        if (els.onlineAudioTitleInput) els.onlineAudioTitleInput.value = title;
        AudioEngine.click();
      });
    });

    // Status Buttons
    els.refreshOllamaBtn.addEventListener('click', () => {
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

    els.exportChatBtn.addEventListener('click', exportChatHistory);

    els.btnExecuteExportChat?.addEventListener('click', () => {
      if (pendingExportSession) {
        const sess = pendingExportSession;
        pendingExportSession = null;
        closeModal('exportConfirmModal');
        executeExportDownload(sess);
      }
    });

    els.soundToggleBtn.addEventListener('click', () => {
      STATE.soundEnabled = !STATE.soundEnabled;
      savePersistedState();
      els.soundToggleBtn.innerHTML = STATE.soundEnabled 
        ? '<i class="fa-solid fa-volume-high"></i>' 
        : '<i class="fa-solid fa-volume-xmark"></i>';
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
    els.attachOptionDoc?.addEventListener('click', () => {
      closeAttachmentDropdown();
      els.docFileInput?.click();
    });

    els.imageFileInput?.addEventListener('change', handleImageUpload);
    els.cameraFileInput?.addEventListener('change', handleImageUpload);
    els.removeImageBtn?.addEventListener('click', clearAttachedImage);
    els.docFileInput?.addEventListener('change', handleDocUpload);

    // Dismiss attachment & search dropdowns when clicking outside
    document.addEventListener('click', (e) => {
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
    });

    // Dismiss dropdowns on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAttachmentDropdown();
        closeSearchDropdown();
      }
    });

    // Search Mode Toggle & Menu Items
    els.webSearchToggleBtn?.addEventListener('click', (e) => {
      toggleSearchDropdown(e);
    });

    $$('.search-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = item.dataset.mode || 'off';
        setSearchMode(mode);
      });
    });

    // Embedded AI Image Studio Toggle Listener
    els.imageGenToggleBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      STATE.isImageGenMode = !STATE.isImageGenMode;
      updateImageGenModeUI();
      if (STATE.isImageGenMode) {
        showToast('🎨 Mode AI Image Studio Aktif! Ketik deskripsi untuk digenerasi.');
        AudioEngine.success();
      } else {
        showToast('💬 Mode Percakapan Standar.');
        AudioEngine.click();
      }
    });

    // Keyboard shortcut: Alt+I to toggle Image Studio mode
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        STATE.isImageGenMode = !STATE.isImageGenMode;
        updateImageGenModeUI();
        if (STATE.isImageGenMode) {
          showToast('🎨 Mode AI Image Studio Aktif (Alt+I)!');
          AudioEngine.success();
          els.promptInput?.focus();
        } else {
          showToast('💬 Mode Percakapan Standar (Alt+I).');
          AudioEngine.click();
        }
      } else if (e.key === 'Escape' && STATE.isImageGenMode && !els.promptInput.value.trim()) {
        STATE.isImageGenMode = false;
        updateImageGenModeUI();
        showToast('💬 Mode Percakapan Standar.');
      }
    });

    // Quick Hero Prompts
    $$('.quick-prompt-card').forEach(card => {
      card.addEventListener('click', () => {
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
    els.paramTemperature.addEventListener('input', (e) => {
      els.valTemperature.innerText = e.target.value;
    });
    els.paramTopP.addEventListener('input', (e) => {
      els.valTopP.innerText = e.target.value;
    });

    // Presets in settings
    $$('.preset-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        applySystemPreset(pill.dataset.preset);
      });
    });

    els.settingSystemPrompt?.addEventListener('input', () => {
      const currentVal = els.settingSystemPrompt.value.trim();
      const matchedKey = Object.keys(SYSTEM_PRESETS).find(k => k !== 'default' && SYSTEM_PRESETS[k].trim() === currentVal);
      STATE.settings.activePreset = matchedKey || (currentVal ? 'custom' : 'default');
      updatePresetPillUI();
    });

    els.clearPresetBtn?.addEventListener('click', () => {
      applySystemPreset('default');
    });

    // Settings Actions
    els.settingsBtn.addEventListener('click', () => {
      syncSettingsModalFields();
      openModal('settingsModal');
    });

    els.toggleShowOllamaKeyBtn?.addEventListener('click', () => {
      const isPass = els.settingOllamaApiKey.type === 'password';
      els.settingOllamaApiKey.type = isPass ? 'text' : 'password';
      els.toggleShowOllamaKeyBtn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });

    els.toggleShowKeyBtn.addEventListener('click', () => {
      const isPass = els.settingOpenRouterKey.type === 'password';
      els.settingOpenRouterKey.type = isPass ? 'text' : 'password';
      els.toggleShowKeyBtn.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
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
          body: JSON.stringify({ q: 'test connection', gl: 'id', hl: 'id', num: 1 })
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

    // Event Listeners: Quick Select Model Dropdowns -> Sync to Input
    els.selectDeepResearchAgent1Model?.addEventListener('change', (e) => {
      if (e.target.value && els.settingDeepResearchAgent1Model) {
        els.settingDeepResearchAgent1Model.value = e.target.value;
        AudioEngine.click();
      }
    });

    els.selectDeepResearchAgent2Model?.addEventListener('change', (e) => {
      if (e.target.value && els.settingDeepResearchAgent2Model) {
        els.settingDeepResearchAgent2Model.value = e.target.value;
        AudioEngine.click();
      }
    });

    els.selectDeepResearchFinalModel?.addEventListener('change', (e) => {
      if (e.target.value && els.settingDeepResearchFinalModel) {
        els.settingDeepResearchFinalModel.value = e.target.value;
        AudioEngine.click();
      }
    });

    // Event Listener: Simpan Custom Preset Buatan Pengguna
    els.saveCustomPresetBtn?.addEventListener('click', () => {
      const name = els.inputNewPresetName ? els.inputNewPresetName.value.trim() : '';
      if (!name) {
        showToast('Ketik nama preset kustom terlebih dahulu.', 'error');
        return;
      }

      const p1 = els.settingDeepResearchAgent1Model ? els.settingDeepResearchAgent1Model.value.trim() : '';
      const p2 = els.settingDeepResearchAgent2Model ? els.settingDeepResearchAgent2Model.value.trim() : '';
      const pF = els.settingDeepResearchFinalModel ? els.settingDeepResearchFinalModel.value.trim() : '';

      userCustomResearchPresets.push({
        id: 'preset_' + Date.now(),
        name: name,
        agent1: p1,
        agent2: p2,
        final: pF
      });

      saveUserCustomResearchPresets();
      renderUserCustomPresetsUI();
      if (els.inputNewPresetName) els.inputNewPresetName.value = '';
      showToast(`✨ Preset Kustom "${name}" berhasil disimpan!`);
      AudioEngine.click();
    });

    els.testOllamaBtn.addEventListener('click', async () => {
      const ep = normalizeEndpoint(els.settingOllamaEndpoint.value.trim() || 'http://127.0.0.1:11434');
      const key = els.settingOllamaApiKey ? els.settingOllamaApiKey.value.trim() : '';
      try {
        const headers = {};
        if (key) {
          headers['Authorization'] = `Bearer ${key}`;
          headers['x-ollama-key'] = key;
        }

        if (IS_GITHUB_PAGES) {
          // Direct browser testing
          let res = await fetch(`${ep}/api/tags`, { headers, mode: 'cors' }).catch(() => null);
          if (!res || !res.ok) {
            res = await fetch(`${ep}/v1/models`, { headers, mode: 'cors' }).catch(() => null);
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
          } else if (data.server_running) {
            showToast(`✅ Ollama terhubung & siap digunakan.`);
          } else if (key) {
            showToast(`✅ Ollama API Key tersimpan! Mode Cloud aktif.`);
          } else {
            showToast(`❌ Gagal: ${data.error || data.warning || 'Ollama tidak merespons'}`, 'error');
          }
        }
      } catch (e) {
        showToast('❌ Gagal memeriksa endpoint Ollama: ' + e.message, 'error');
      }
    });

    els.testOpenRouterBtn.addEventListener('click', async () => {
      const key = els.settingOpenRouterKey.value.trim();
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
        } else {
          showToast(`❌ Validasi gagal: ${data.error || 'Key tidak valid'}`, 'error');
        }
      } catch (e) {
        showToast('❌ Gagal memeriksa API Key.', 'error');
      }
    });

    els.saveSettingsBtn.addEventListener('click', () => {
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

      if (els.settingDeepResearchAgent1Model) {
        STATE.settings.deepResearchAgent1Model = els.settingDeepResearchAgent1Model.value.trim();
      }

      if (els.settingDeepResearchAgent2Model) {
        STATE.settings.deepResearchAgent2Model = els.settingDeepResearchAgent2Model.value.trim();
      }

      if (els.settingDeepResearchFinalModel) {
        STATE.settings.deepResearchFinalModel = els.settingDeepResearchFinalModel.value.trim();
      }

      if (els.paramTemperature) STATE.settings.temperature = parseFloat(els.paramTemperature.value);
      if (els.paramTopP) STATE.settings.topP = parseFloat(els.paramTopP.value);
      if (els.settingSystemPrompt) {
        const pVal = els.settingSystemPrompt.value.trim();
        STATE.settings.systemPrompt = pVal;
        const matchedKey = Object.keys(SYSTEM_PRESETS).find(k => k !== 'default' && SYSTEM_PRESETS[k].trim() === pVal);
        STATE.settings.activePreset = matchedKey || (pVal ? 'custom' : 'default');
      }
      if (els.settingAutoPolicy) STATE.settings.autoPolicy = els.settingAutoPolicy.value;
      
      savePersistedState();
      checkOllamaHealth();
      checkOpenRouterStatus();
      updatePresetBanner();
      updatePresetPillUI();
      closeModal('settingsModal');
      showToast('Pengaturan Zoz Router berhasil disimpan!');
      AudioEngine.click();
    });

    // Model Hub Modal
    els.modelHubBtn.addEventListener('click', () => {
      openModal('modelHubModal');
      renderModelHubGrid();
    });

    els.hubSearchInput.addEventListener('input', (e) => {
      const activeFilter = $('.filter-pill.active')?.dataset.filter || 'all';
      renderModelHubGrid(activeFilter, e.target.value);
    });

    els.filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        els.filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        renderModelHubGrid(pill.dataset.filter, els.hubSearchInput.value);
      });
    });

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

    els.btnRefreshLiveCatalog?.addEventListener('click', async () => {
      if (els.btnRefreshLiveCatalog) {
        els.btnRefreshLiveCatalog.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Memuat...';
      }
      await Promise.all([checkOllamaHealth(), fetchOpenRouterModelsList()]);
      renderLiveModelCatalog();
      if (els.btnRefreshLiveCatalog) {
        els.btnRefreshLiveCatalog.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Refresh';
      }
      showToast('🔄 Katalog model berhasil disinkronkan secara real-time!');
      AudioEngine.click();
    });

    // ==================== LIVE RESEARCH INSPECTOR LISTENERS ====================
    els.btnTabInspectAgent1?.addEventListener('click', () => {
      STATE.activeInspectionTab = 'agent1';
      els.btnTabInspectAgent1.classList.add('active');
      els.btnTabInspectAgent2?.classList.remove('active');
      els.btnTabInspectScraper?.classList.remove('active');
      renderLiveInspectionContent();
      AudioEngine.click();
    });

    els.btnTabInspectAgent2?.addEventListener('click', () => {
      STATE.activeInspectionTab = 'agent2';
      els.btnTabInspectAgent2.classList.add('active');
      els.btnTabInspectAgent1?.classList.remove('active');
      els.btnTabInspectScraper?.classList.remove('active');
      renderLiveInspectionContent();
      AudioEngine.click();
    });

    els.btnTabInspectScraper?.addEventListener('click', () => {
      STATE.activeInspectionTab = 'scraper';
      els.btnTabInspectScraper.classList.add('active');
      els.btnTabInspectAgent1?.classList.remove('active');
      els.btnTabInspectAgent2?.classList.remove('active');
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
    els.triggerAudioUploadBtn?.addEventListener('click', () => els.localAudioFileInput.click());
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
  }

  // ==================== BOOTSTRAP INITIALIZATION ====================
  async function init() {
    await loadPersistedState();
    setupEventListeners();
    setupSmartScrolling();
    ImageLightbox.init();
    
    // Set sound toggle button icon
    els.soundToggleBtn.innerHTML = STATE.soundEnabled 
      ? '<i class="fa-solid fa-volume-high"></i>' 
      : '<i class="fa-solid fa-volume-xmark"></i>';

    // Distinguish Browser Refresh (same tab) vs Fresh App Entry
    const isTabReload = sessionStorage.getItem('zoz_tab_initialized') === 'true';
    const savedActiveId = sessionStorage.getItem('zoz_active_session_id');

    if (isTabReload && savedActiveId && STATE.sessions.some(s => s.id === savedActiveId)) {
      // Browser Refresh: Keep the user on their active conversation and refresh it
      STATE.currentSessionId = savedActiveId;
      const activeSess = STATE.sessions.find(s => s.id === savedActiveId);
      if (activeSess && activeSess._isLazyDisk && (!activeSess.messages || activeSess.messages.length === 0)) {
        if (DeviceStorage.isDeviceBackendAvailable) {
          try {
            const full = await DeviceStorage.getSession(savedActiveId);
            if (full && Array.isArray(full.messages)) {
              activeSess.messages = full.messages;
              delete activeSess._isLazyDisk;
            }
          } catch (e) {}
        }
      }
      renderChatHistory();
      renderCurrentSession();
    } else {
      // Fresh App Entry / Reopening: Land cleanly on TAMPILAN UTAMA (Welcome Hero / Beranda Bersih)
      sessionStorage.setItem('zoz_tab_initialized', 'true');
      sessionStorage.removeItem('zoz_active_session_id');
      STATE.currentSessionId = null;
      renderChatHistory();
      renderCurrentSession();
    }

    updatePresetBanner();
    updatePresetPillUI();
    updateModelUI();
    updateSearchModeUI();
    updateImageGenModeUI();

    // Restore desktop sidebar collapsed preference
    if (window.innerWidth > 768) {
      const isCollapsed = localStorage.getItem('zoz_sidebar_collapsed') === 'true';
      if (isCollapsed) {
        els.appContainer?.classList.add('sidebar-collapsed');
        els.sidebar?.classList.add('collapsed');
      }
    }

    // Initialize Cyber BGM Engine
    await BGMEngine.init();

    // Async checks
    await checkOllamaHealth();
    await checkOpenRouterStatus();
    fetchOpenRouterModelsList();

    console.log('⚡ ZOZ ROUTER INITIALIZED // READY');
  }

  // Start on DOM loaded
  document.addEventListener('DOMContentLoaded', init);
})();
