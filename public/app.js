/**
 * ZOZ ROUTER - Frontend Application Engine
 * High-Speed Multi-Engine AI Orchestrator for Ollama & OpenRouter
 */

(() => {
  'use strict';

  const IS_GITHUB_PAGES = location.hostname.endsWith('github.io') || location.protocol === 'file:';

  // ==================== SYSTEM PRESETS ====================
  const SYSTEM_PRESETS = {
    kaisar: 'Kamu adalah AI Personal Kaisar Zozi. Berikan analisis tingkat tinggi, strategis, berorientasi eksekusi cepat, cerdas, berbobot, dan tanpa basa-basi atau sensor berlebihan.',
    coder: 'You are an Elite Senior Software Architect & Fullstack Engineer. Provide clean, modular, scalable, production-ready code with clear explanations and industry best practices.',
    cyber: 'You are a Cyber Security Specialist & Penetration Tester. Analyze vulnerabilities, protocols, and security architectures with deep technical insight and defense-in-depth mitigations.',
    concise: 'Berikan jawaban langsung ke inti masalah (direct to point), sangat ringkas, terstruktur rapi dengan bullet points, dan tanpa kata-kata pengantar klise.',
    uncensored: 'Provide raw, unfiltered technical and analytical reasoning with maximal precision, comprehensive depth, and logical rigor.'
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
    mode: 'ollama', // 'ollama' | 'openrouter' | 'arena' | 'auto'
    sessions: [],
    currentSessionId: null,
    activeSessionPerMode: {
      ollama: null,
      openrouter: null,
      arena: null,
      auto: null
    },
    attachedImage: null, // Base64 data URL
    attachedDocs: [], // Array of { name, size, content }
    webSearchEnabled: false,
    isGenerating: false,
    abortController: null,
    soundEnabled: true,
    ollamaModels: [...OFFICIAL_OLLAMA_CLOUD_MODELS],
    openRouterModels: [...DEFAULT_OPENROUTER_MODELS],
    settings: {
      ollamaEndpoint: 'http://127.0.0.1:11434',
      ollamaApiKey: '',
      openRouterKey: '',
      serperApiKey: '075538fed9c64990e1eb32a06726c1e55a933c1e',
      ollamaModel: 'gemma4:31b',
      openRouterModel: 'deepseek/deepseek-r1:free',
      arenaModelA: 'gemma4:31b',
      arenaModelB: 'deepseek/deepseek-r1:free',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 8192,
      systemPrompt: SYSTEM_PRESETS.kaisar,
      activePreset: 'kaisar',
      autoPolicy: 'local_first'
    }
  };

  // ==================== AUDIO SYNTHESIZER (Sci-Fi Cyber Blips) ====================
  const AudioEngine = {
    ctx: null,
    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    },
    playBeep(freq = 440, type = 'sine', duration = 0.08, gain = 0.05) {
      if (!STATE.soundEnabled) return;
      try {
        this.init();
        if (!this.ctx) return;
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
    dropdownModelList: $('#dropdownModelList'),
    modelSearchInput: $('#modelSearchInput'),
    customModelInput: $('#customModelInput'),
    useCustomModelBtn: $('#useCustomModelBtn'),
    singleModelPickerWrap: $('#singleModelPickerWrap'),
    arenaConfigBar: $('#arenaConfigBar'),
    arenaModelOllama: $('#arenaModelOllama'),
    arenaModelOpenRouter: $('#arenaModelOpenRouter'),
    
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
    arenaChatContainer: $('#arenaChatContainer'),
    arenaMessagesA: $('#arenaMessagesA'),
    arenaMessagesB: $('#arenaMessagesB'),
    arenaStatsA: $('#arenaStatsA'),
    arenaStatsB: $('#arenaStatsB'),
    arenaInputA: $('#arenaInputA'),
    arenaSendBtnA: $('#arenaSendBtnA'),
    arenaStopBtnA: $('#arenaStopBtnA'),
    clearArenaChatABtn: $('#clearArenaChatABtn'),
    arenaInputB: $('#arenaInputB'),
    arenaSendBtnB: $('#arenaSendBtnB'),
    arenaStopBtnB: $('#arenaStopBtnB'),
    clearArenaChatBBtn: $('#clearArenaChatBBtn'),
    
    // History & Navigation
    newChatBtn: $('#newChatBtn'),
    chatHistoryList: $('#chatHistoryList'),
    searchHistoryInput: $('#searchHistoryInput'),
    clearAllHistoryBtn: $('#clearAllHistoryBtn'),
    toggleSidebarBtn: $('#toggleSidebarBtn'),
    closeSidebarBtn: $('#closeSidebarBtn'),
    sidebar: $('#sidebar'),
    sidebarBackdrop: $('#sidebarBackdrop'),
    mainContent: $('#mainContent'),
    
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
    webSearchToggleBtn: $('#webSearchToggleBtn'),
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
    scrollBottomBtn: $('#scrollBottomBtn')
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
      const savedSound = localStorage.getItem('zoz_router_sound_v1');
      if (savedSound !== null) {
        STATE.soundEnabled = savedSound === 'true';
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

      // 4. Sync from Device Disk Storage if backend is online
      if (DeviceStorage.isDeviceBackendAvailable) {
        const diskList = await DeviceStorage.getSessionsList();
        if (Array.isArray(diskList) && diskList.length > 0) {
          // Merge disk sessions with local state
          for (const diskItem of diskList) {
            const existing = STATE.sessions.find(s => s.id === diskItem.id);
            if (!existing) {
              const fullSess = await DeviceStorage.getSession(diskItem.id);
              if (fullSess) STATE.sessions.push(fullSess);
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
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          messages: (s.messages || []).map(m => ({
            role: m.role,
            content: m.content,
            displayContent: m.displayContent,
            model: m.model,
            engine: m.engine,
            slot: m.slot,
            sources: m.sources,
            stats: m.stats,
            timestamp: m.timestamp
          }))
        }));
        localStorage.setItem('zoz_router_sessions_v1', JSON.stringify(lightweight));
      } catch (quotaErr) {}
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

  function renderMarkdown(rawText) {
    if (!rawText) return '';
    if (window.marked) {
      marked.setOptions({
        breaks: true,
        gfm: true
      });
      return marked.parse(rawText);
    }
    return escapeHtml(rawText).replace(/\n/g, '<br>');
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
      if (this.onScroll) this.onScroll();
    }

    finish() {
      this.isDone = true;
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      if (this.el) {
        this.el.innerHTML = renderMarkdown(this.text);
      }
      if (this.onScroll) this.onScroll();
      return this.text;
    }
  }

  // ==================== SMART SCROLL & CONTINUATION MANAGER ====================
  let userScrolledUp = false;
  let isAutoScrolling = false;

  function isChatAtBottom(element = els.chatViewport, threshold = 80) {
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

  function smartScrollArenaToBottom(container, force = false) {
    if (!container) return;
    if (!isChatAtBottom(container, 60) && !force) return;
    container.scrollTop = container.scrollHeight;
  }

  function setupSmartScrolling() {
    if (!els.chatViewport) return;

    const checkUserScroll = (el = els.chatViewport) => {
      if (isAutoScrolling) return;
      if (!isChatAtBottom(el, 70)) {
        userScrolledUp = true;
        toggleScrollBottomBtn(true);
      } else {
        userScrolledUp = false;
        toggleScrollBottomBtn(false);
      }
    };

    els.chatViewport.addEventListener('scroll', () => checkUserScroll(els.chatViewport), { passive: true });
    els.chatViewport.addEventListener('touchmove', () => checkUserScroll(els.chatViewport), { passive: true });
    els.chatViewport.addEventListener('wheel', (e) => {
      if (e.deltaY < 0) {
        userScrolledUp = true;
        toggleScrollBottomBtn(true);
      }
    }, { passive: true });

    // Arena columns scroll tracking
    if (els.arenaMessagesA) {
      els.arenaMessagesA.addEventListener('scroll', () => checkUserScroll(els.arenaMessagesA), { passive: true });
      els.arenaMessagesA.addEventListener('touchmove', () => checkUserScroll(els.arenaMessagesA), { passive: true });
    }
    if (els.arenaMessagesB) {
      els.arenaMessagesB.addEventListener('scroll', () => checkUserScroll(els.arenaMessagesB), { passive: true });
      els.arenaMessagesB.addEventListener('touchmove', () => checkUserScroll(els.arenaMessagesB), { passive: true });
    }

    els.scrollBottomBtn?.addEventListener('click', () => {
      if (STATE.mode === 'arena') {
        if (els.arenaMessagesA) els.arenaMessagesA.scrollTo({ top: els.arenaMessagesA.scrollHeight, behavior: 'smooth' });
        if (els.arenaMessagesB) els.arenaMessagesB.scrollTo({ top: els.arenaMessagesB.scrollHeight, behavior: 'smooth' });
      } else {
        if (els.chatViewport) els.chatViewport.scrollTo({ top: els.chatViewport.scrollHeight, behavior: 'smooth' });
      }
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

    const isNemotronOrLong = modelName.toLowerCase().includes('nemotron') || modelName.toLowerCase().includes('deepseek') || modelName.toLowerCase().includes('qwen') || modelName.toLowerCase().includes('llama-3.3');
    const maxTokensVal = isNemotronOrLong ? 16384 : 8192;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: messagesPayload,
        stream: true,
        temperature: parseFloat(STATE.settings.temperature),
        max_tokens: maxTokensVal,
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
          temperature: parseFloat(STATE.settings.temperature),
          num_predict: -1,
          num_ctx: 16384
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

  function switchSession(sessionId) {
    if (STATE.isGenerating) {
      showToast('Harap tunggu atau hentikan generasi respons saat ini.', 'error');
      return;
    }
    const targetSession = STATE.sessions.find(s => s.id === sessionId);
    if (!targetSession) return;

    // If session has different mode, switch tab
    if (targetSession.mode && targetSession.mode !== STATE.mode) {
      STATE.mode = targetSession.mode;
      els.modeTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === STATE.mode);
      });
      updateModeLayout(STATE.mode);
    }

    STATE.currentSessionId = sessionId;
    sessionStorage.setItem('zoz_active_session_id', sessionId);
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

  function exportSessionData(sessionId) {
    const session = STATE.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    let md = `# ${session.title || 'Percakapan ZOZ Router'}\n`;
    md += `*Tanggal: ${new Date(session.createdAt || Date.now()).toLocaleString('id-ID')}*  \n`;
    md += `*Mode: ${(session.mode || 'ollama').toUpperCase()}*  \n\n---\n\n`;

    (session.messages || []).forEach(m => {
      const role = m.role === 'user' ? '👤 Pengguna' : `🤖 AI (${m.model || 'Model'})`;
      md += `### ${role}\n${m.content || ''}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(session.title || 'chat').replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    showToast('Percakapan diekspor ke file Markdown (.md)');
    AudioEngine.click();
  }

  function renderChatHistory(filterQuery = '') {
    els.chatHistoryList.innerHTML = '';
    const q = filterQuery.toLowerCase().trim();
    
    // Unified list of all sessions across engines
    const validSessions = STATE.sessions.filter(s => s.messages && s.messages.length > 0);
    const filtered = validSessions.filter(s => !q || s.title.toLowerCase().includes(q) || (s.mode && s.mode.toLowerCase().includes(q)));

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
      item.className = `history-item ${session.id === STATE.currentSessionId ? 'active' : ''}`;
      item.dataset.id = session.id;
      
      let modeIcon = 'fa-server';
      let modeColor = 'var(--neon-cyan)';
      let modeTag = 'Ollama';
      if (session.mode === 'openrouter') {
        modeIcon = 'fa-bolt';
        modeColor = 'var(--neon-amber)';
        modeTag = 'OpenRouter';
      } else if (session.mode === 'arena') {
        modeIcon = 'fa-scale-balanced';
        modeColor = 'var(--neon-pink, #ff0055)';
        modeTag = 'Arena';
      } else if (session.mode === 'auto') {
        modeIcon = 'fa-route';
        modeColor = 'var(--neon-teal)';
        modeTag = 'Auto';
      }

      item.innerHTML = `
        <div class="history-title-wrap">
          <i class="fa-solid ${modeIcon}" style="color:${modeColor}; font-size:0.8rem;" title="Engine: ${modeTag}"></i>
          <span class="history-title" title="${escapeHtml(session.title)}">${escapeHtml(session.title)}</span>
        </div>
        <div class="history-item-actions">
          <button class="history-menu-btn" title="Opsi Percakapan (Ganti Nama / Hapus)" aria-label="Opsi Percakapan">
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
    if (STATE.mode === 'arena') {
      els.welcomeHero.style.display = 'none';
      els.arenaMessagesA.innerHTML = '';
      els.arenaMessagesB.innerHTML = '';

      let session = STATE.currentSessionId ? STATE.sessions.find(s => s.id === STATE.currentSessionId && s.mode === 'arena') : null;
      if (!session) {
        session = STATE.sessions.find(s => s.mode === 'arena');
      }

      const messagesA = (session?.messages || []).filter(m => m.slot === 'A' || m.engine === 'ollama');
      const messagesB = (session?.messages || []).filter(m => m.slot === 'B' || m.engine === 'openrouter');

      if (messagesA.length === 0) {
        els.arenaMessagesA.innerHTML = `
          <div class="arena-empty-placeholder">
            <i class="fa-solid fa-robot"></i>
            <p>Slot Ollama Local siap. Ketik prompt di bawah untuk menjalankan model offline.</p>
          </div>
        `;
      } else {
        messagesA.forEach((msg, idx) => {
          appendArenaBubbleToColumn(els.arenaMessagesA, msg.role, msg.content, msg.model || 'Ollama', msg.stats, 'A', idx);
        });
      }

      if (messagesB.length === 0) {
        els.arenaMessagesB.innerHTML = `
          <div class="arena-empty-placeholder">
            <i class="fa-solid fa-bolt"></i>
            <p>Slot OpenRouter Cloud siap. Ketik prompt di bawah untuk model flagship.</p>
          </div>
        `;
      } else {
        messagesB.forEach((msg, idx) => {
          appendArenaBubbleToColumn(els.arenaMessagesB, msg.role, msg.content, msg.model || 'OpenRouter', msg.stats, 'B', idx);
        });
      }

      smartScrollArenaToBottom(els.arenaMessagesA, true);
      smartScrollArenaToBottom(els.arenaMessagesB, true);
      return;
    }

    // If no session is actively selected -> Land on TAMPILAN UTAMA (Welcome Hero)!
    if (!STATE.currentSessionId) {
      els.welcomeHero.style.display = 'flex';
      els.messagesList.innerHTML = '';
      smartScrollChatToBottom(true);
      return;
    }

    const session = STATE.sessions.find(s => s.id === STATE.currentSessionId);
    if (!session || !session.messages || session.messages.length === 0) {
      els.welcomeHero.style.display = 'flex';
      els.messagesList.innerHTML = '';
      smartScrollChatToBottom(true);
      return;
    }

    els.welcomeHero.style.display = 'none';
    els.messagesList.innerHTML = '';
    session.messages.forEach((msg, idx) => {
      appendMessageElement(msg.role, msg.content, msg.image, msg.model, msg.stats, idx, msg.sources);
    });

    smartScrollChatToBottom(true);
  }

  function appendArenaBubbleToColumn(container, role, content, model = '', stats = null, slot = 'A', idx = -1) {
    const bubble = document.createElement('div');
    bubble.className = `message-row ${role}`;
    bubble.style.marginBottom = '10px';
    bubble.dataset.slot = slot;
    bubble.dataset.index = idx;

    const avatar = role === 'user' ? '<i class="fa-solid fa-user-ninja"></i>' : '<i class="fa-solid fa-microchip-ai"></i>';
    const roleLabel = role === 'user' ? 'Anda' : (model || 'AI');
    const renderedBody = role === 'assistant' ? renderMarkdown(content) : escapeHtml(content).replace(/\n/g, '<br>');
    const statsHtml = stats ? `<span style="font-size:0.68rem; color:var(--neon-teal); font-family:var(--font-code);">⏱️ ${stats.duration}s • ⚡ ${stats.tps} tps</span>` : '';

    bubble.innerHTML = `
      <div class="message-avatar" style="width:28px; height:28px; font-size:0.75rem;">${avatar}</div>
      <div class="message-content-box" style="max-width:88%;">
        <div class="message-meta" style="font-size:0.68rem;">
          <strong>${roleLabel}</strong>
          ${statsHtml}
        </div>
        <div class="message-bubble" style="padding:8px 12px; font-size:0.85rem;">
          <div class="msg-text-content">${renderedBody}</div>
        </div>
        <div class="message-actions-bar">
          <button class="msg-action-btn copy-msg-btn" title="Salin Pesan"><i class="fa-solid fa-copy"></i> Salin</button>
        </div>
      </div>
    `;

    bubble.querySelectorAll('pre code').forEach(b => {
      if (window.hljs) hljs.highlightElement(b);
    });

    bubble.querySelector('.copy-msg-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(content);
      showToast('Pesan disalin!');
      AudioEngine.click();
    });

    container.appendChild(bubble);
    return bubble;
  }

  // ==================== MESSAGE DOM BUILDER ====================
  function appendMessageElement(role, content, image = null, model = '', stats = null, index = -1, sources = null) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;
    row.dataset.index = index;

    const avatarIcon = role === 'user' ? '<i class="fa-solid fa-user-ninja"></i>' : '<i class="fa-solid fa-microchip-ai"></i>';
    const roleLabel = role === 'user' ? 'Anda' : (model || 'Zoz AI');

    let imageHtml = '';
    if (image) {
      imageHtml = `<img src="${image}" alt="Vision Attachment" class="attached-vision-img">`;
    }

    let statsHtml = '';
    if (stats && role === 'assistant') {
      statsHtml = `
        <span class="meta-model-badge">${escapeHtml(model)}</span>
        <span>⏱️ ${stats.duration}s</span>
        <span>⚡ ${stats.tps} tps</span>
      `;
    } else if (model && role === 'assistant') {
      statsHtml = `<span class="meta-model-badge">${escapeHtml(model)}</span>`;
    }

    const renderedBody = role === 'assistant' ? renderMarkdown(content) : escapeHtml(content).replace(/\n/g, '<br>');

    let sourcesHtml = '';
    if (sources && Array.isArray(sources) && sources.length > 0 && role === 'assistant') {
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

    row.innerHTML = `
      <div class="message-avatar">${avatarIcon}</div>
      <div class="message-content-box">
        <div class="message-meta">
          <strong>${roleLabel}</strong>
          ${statsHtml}
        </div>
        <div class="message-bubble">
          ${imageHtml}
          <div class="msg-text-content">${renderedBody}</div>
          ${sourcesHtml}
        </div>
        <div class="message-actions-bar">
          ${role === 'user' ? '<button class="msg-action-btn edit-msg-btn" title="Edit & Kirim Ulang Prompt"><i class="fa-solid fa-pen-to-square"></i> Edit</button>' : ''}
          <button class="msg-action-btn copy-msg-btn" title="Salin Pesan"><i class="fa-solid fa-copy"></i> Salin</button>
        </div>
      </div>
    `;

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

    // Code copy listener & syntax highlighting
    row.querySelectorAll('pre code').forEach(block => {
      if (window.hljs) hljs.highlightElement(block);
      
      const pre = block.parentElement;
      const lang = block.className.match(/language-(\w+)/)?.[1] || 'CODE';
      
      const header = document.createElement('div');
      header.className = 'code-header';
      header.innerHTML = `
        <span>${lang.toUpperCase()}</span>
        <button class="code-copy-btn"><i class="fa-solid fa-clipboard"></i> Salin Kode</button>
      `;
      header.querySelector('.code-copy-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(block.innerText);
        showToast('Kode berhasil disalin ke clipboard!');
        AudioEngine.click();
      });
      pre.insertBefore(header, block);
    });

    // Message copy button
    row.querySelector('.copy-msg-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(content);
      showToast('Pesan disalin ke clipboard!');
      AudioEngine.click();
    });

    els.messagesList.appendChild(row);
    return row;
  }

  function appendMessageToArena(target, content, image = null, model = '', stats = null) {
    const isUser = target === 'user';
    const container = isUser ? null : (target === 'assistant-a' ? els.arenaMessagesA : els.arenaMessagesB);
    
    if (isUser) {
      // Append to both arena columns
      appendSingleArenaBubble(els.arenaMessagesA, 'user', content, image, 'User');
      appendSingleArenaBubble(els.arenaMessagesB, 'user', content, image, 'User');
    } else if (container) {
      appendSingleArenaBubble(container, 'assistant', content, image, model, stats);
    }
  }

  function appendSingleArenaBubble(container, role, content, image = null, model = '', stats = null) {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role === 'user' ? 'arena-user' : 'arena-bot'}`;
    bubble.style.marginBottom = '10px';
    bubble.style.fontSize = '0.85rem';
    
    let rendered = role === 'assistant' ? renderMarkdown(content) : escapeHtml(content).replace(/\n/g, '<br>');
    let statsBadge = stats ? `<div style="font-size:0.7rem; color:var(--neon-teal); margin-bottom:4px;">[${model} • ${stats.duration}s • ${stats.tps} tps]</div>` : '';
    
    bubble.innerHTML = `${statsBadge}<div>${rendered}</div>`;
    
    bubble.querySelectorAll('pre code').forEach(block => {
      if (window.hljs) hljs.highlightElement(block);
    });

    container.appendChild(bubble);
  }

  // ==================== DOCUMENT & FILE ATTACHMENT HANDLER ====================
  function handleDocUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files || files.length === 0) return;

    let loaded = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target.result || '';
        const sizeStr = (file.size < 1024) 
          ? `${file.size} B` 
          : (file.size < 1024 * 1024) 
            ? `${(file.size / 1024).toFixed(1)} KB` 
            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

        STATE.attachedDocs.push({
          name: file.name,
          size: sizeStr,
          content: content
        });
        loaded++;
        if (loaded === files.length) {
          renderAttachmentPreviews();
          showToast(`📎 ${files.length} file dokumen berhasil dilampirkan.`);
          AudioEngine.click();
        }
      };
      reader.onerror = () => {
        loaded++;
        showToast(`Gagal membaca file: ${file.name}`, 'error');
      };
      reader.readAsText(file);
    });

    if (els.docFileInput) els.docFileInput.value = '';
  }

  function removeAttachedDoc(idx) {
    STATE.attachedDocs.splice(idx, 1);
    renderAttachmentPreviews();
    AudioEngine.click();
  }

  function renderAttachmentPreviews() {
    if (!els.attachmentPreviewBar) return;
    const hasImage = !!STATE.attachedImage;
    const hasDocs = STATE.attachedDocs && STATE.attachedDocs.length > 0;

    if (!hasImage && !hasDocs) {
      els.attachmentPreviewBar.style.display = 'none';
      return;
    }

    els.attachmentPreviewBar.style.display = 'flex';

    // Handle Image Preview Card
    const imgCard = $('#imagePreviewCard');
    if (imgCard) {
      imgCard.style.display = hasImage ? 'block' : 'none';
    }

    // Remove existing doc chips
    els.attachmentPreviewBar.querySelectorAll('.doc-preview-chip').forEach(c => c.remove());

    // Append new doc chips
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

    updateVisionCompatibilityBadge();
  }

  // ==================== REAL-TIME WEB SEARCH ENGINE (SERPER GOOGLE API) ====================
  async function getWebSearchContext(query) {
    if (!query || !query.trim()) return null;
    const cleanQ = query.trim();
    const serperKey = STATE.settings.serperApiKey || '075538fed9c64990e1eb32a06726c1e55a933c1e';

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
            q: cleanQ,
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
          body: JSON.stringify({ query: cleanQ, apiKey: serperKey })
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
      const systemPromptContext = `[DATA PENCARIAN GOOGLE REAL-TIME - SERPER ENGINE]
Query Pencarian: "${cleanQ}"
Waktu Pencarian: ${currentTime}
${factsBlock}
=== TEMUAN SITUS WEB TERATAS ===
${organicBlock}
[PANDUAN UNTUK ASISTEN AI]:
- Anda adalah AI yang baru saja menjelajahi web Google secara real-time untuk topik ini.
- Gunakan data, angka, dan fakta terkini di atas untuk menyusun jawaban yang akurat, komprehensif, dan relevan bagi pengguna.
- Wajib gunakan referensi atau tautan sumber berformat markdown [Nama Sumber](URL) jika merujuk data spesifik.`;

      return {
        systemPromptContext,
        sources,
        query: cleanQ
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
          let res = await fetch(`${ep}/api/tags`, { headers, mode: 'cors' }).catch(() => null);
          if (res && res.ok) {
            const data = await res.json();
            rawModels = data.models || [];
            isRunning = true;
          } else {
            // 2. Try /v1/models (OpenAI compatibility)
            res = await fetch(`${ep}/v1/models`, { headers, mode: 'cors' }).catch(() => null);
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
        if (!modelNames.includes(STATE.settings.arenaModelA)) {
          STATE.settings.arenaModelA = modelNames[0];
          savePersistedState();
        }

        updateModelUI();
        populateModelDropdown();
        populateArenaDropdowns();
        renderModelHubGrid();
        return true;
      } else {
        STATE.ollamaModels = [];
        els.ollamaStatusVal.innerText = 'Offline (Cek Ollama)';
        els.ollamaIndicator.className = 'status-indicator error';
        populateModelDropdown();
        populateArenaDropdowns();
        renderModelHubGrid();
        return false;
      }
    } catch (e) {
      els.ollamaStatusVal.innerText = 'Tidak Terhubung';
      els.ollamaIndicator.className = 'status-indicator error';
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
          // Merge models
          const mapped = data.data.slice(0, 80).map(m => ({
            id: m.id,
            name: m.name || m.id,
            tag: m.id.includes(':free') ? 'Free' : (m.pricing?.prompt === '0' ? 'Free' : 'Cloud'),
            cat: m.id.includes(':free') ? 'free' : 'flagship'
          }));
          STATE.openRouterModels = mapped;
          populateModelDropdown();
          populateArenaDropdowns();
          renderModelHubGrid();
        }
      }
    } catch (e) {
      console.warn('Could not fetch dynamic OpenRouter model catalog:', e);
    }
  }

  // ==================== ATTACHMENT BADGE & COMPATIBILITY ====================
  function updateVisionCompatibilityBadge() {
    let badge = document.getElementById('visionCompatBadge');
    if (!badge && els.attachmentPreviewBar) {
      badge = document.createElement('div');
      badge.id = 'visionCompatBadge';
      badge.style.cssText = 'display:flex; align-items:center; gap:8px; font-size:0.75rem; padding:4px 10px; border-radius:6px; margin-left:8px; flex-grow:1;';
      els.attachmentPreviewBar.appendChild(badge);
    }

    if (!badge) return;

    if (STATE.attachedImage) {
      const current = getCurrentModel();
      badge.style.background = 'rgba(0, 240, 255, 0.08)';
      badge.style.border = '1px solid rgba(0, 240, 255, 0.3)';
      badge.style.color = 'var(--neon-cyan)';
      badge.innerHTML = `<i class="fa-solid fa-image"></i> <span>Lampiran visual siap diproses oleh model <strong>${escapeHtml(current)}</strong></span>`;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // ==================== MODEL DROPDOWN & SELECTORS ====================
  function populateModelDropdown(search = '') {
    els.dropdownModelList.innerHTML = '';
    const q = search.toLowerCase().trim();

    let models = [];
    if (STATE.mode === 'ollama') {
      if (STATE.ollamaModels && STATE.ollamaModels.length > 0) {
        models = STATE.ollamaModels.map(m => {
          const modelId = m.name || m.model || m.id;
          const isCloud = STATE.settings.ollamaApiKey || (STATE.settings.ollamaEndpoint && STATE.settings.ollamaEndpoint.includes('ollama.com'));
          return { 
            id: modelId, 
            name: m.name || modelId, 
            tag: m.tag || (isCloud ? 'Ollama Cloud' : 'Local') 
          };
        });
      } else {
        models = [];
      }
    } else {
      models = STATE.openRouterModels.map(m => ({
        ...m,
        tag: m.tag || 'Cloud'
      }));
    }

    const currentActive = getCurrentModel();
    const filtered = models.filter(m => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));

    if (filtered.length === 0) {
      els.dropdownModelList.innerHTML = `
        <div style="font-size:0.75rem; color:var(--text-dim); padding:12px; text-align:center; line-height:1.4;">
          ${STATE.mode === 'ollama' ? 'Belum ada model terdeteksi dari endpoint Ollama.<br><span style="font-size:0.68rem; opacity:0.8;">Gunakan input Model Kustom di bawah untuk memanggil model Anda.</span>' : 'Model tidak ditemukan'}
        </div>
      `;
      return;
    }

    filtered.forEach(m => {
      const item = document.createElement('div');
      item.className = `model-option-item ${m.id === currentActive ? 'selected' : ''}`;
      const isVision = m.tag.includes('👁️');
      const badgeStyle = isVision 
        ? 'background:rgba(0,255,194,0.15); color:var(--neon-teal); border:1px solid rgba(0,255,194,0.3);' 
        : 'background:rgba(0,240,255,0.1); color:var(--neon-cyan);';

      item.innerHTML = `
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${escapeHtml(m.name || m.id)}</span>
        <span style="font-size:0.65rem; padding:2px 5px; border-radius:3px; ${badgeStyle}">${escapeHtml(m.tag || 'AI')}</span>
      `;
      item.addEventListener('click', () => {
        selectModel(m.id);
        els.modelDropdownMenu.classList.remove('show');
        AudioEngine.click();
      });
      els.dropdownModelList.appendChild(item);
    });
  }

  function populateArenaDropdowns() {
    // Left (Ollama)
    els.arenaModelOllama.innerHTML = '';
    let ollamaList = [];
    if (STATE.ollamaModels && STATE.ollamaModels.length > 0) {
      ollamaList = STATE.ollamaModels.map(m => m.name || m.model || m.id);
    } else if (STATE.settings.arenaModelA) {
      ollamaList = [STATE.settings.arenaModelA];
    }
    
    ollamaList.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.innerText = m;
      if (m === STATE.settings.arenaModelA) opt.selected = true;
      els.arenaModelOllama.appendChild(opt);
    });

    // Right (OpenRouter)
    els.arenaModelOpenRouter.innerHTML = '';
    STATE.openRouterModels.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.innerText = `${m.name} [${m.tag}]`;
      if (m.id === STATE.settings.arenaModelB) opt.selected = true;
      els.arenaModelOpenRouter.appendChild(opt);
    });
  }

  function getCurrentModel() {
    if (STATE.mode === 'ollama') return STATE.settings.ollamaModel;
    if (STATE.mode === 'openrouter') return STATE.settings.openRouterModel;
    if (STATE.mode === 'auto') return `Auto (${STATE.settings.ollamaModel} ➔ ${STATE.settings.openRouterModel})`;
    return 'Dual Arena Active';
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
    els.currentModelLabel.innerText = current;
    els.footerModelInfo.innerText = `Engine: ${STATE.mode.toUpperCase()} (${current})`;
  }

  function updateModeLayout(mode) {
    if (mode === 'arena') {
      els.singleModelPickerWrap.style.display = 'none';
      els.arenaConfigBar.style.display = 'flex';
      els.singleChatContainer.style.display = 'none';
      els.arenaChatContainer.style.display = 'grid';
    } else {
      els.singleModelPickerWrap.style.display = 'block';
      els.arenaConfigBar.style.display = 'none';
      els.singleChatContainer.style.display = 'flex';
      els.arenaChatContainer.style.display = 'none';
    }
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
    const image = STATE.attachedImage;
    const docs = [...(STATE.attachedDocs || [])];

    if (!rawText && !image && docs.length === 0) return;
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
    const displayPrompt = rawText || (docs.length > 0 ? `📎 [${docs.length} File Lampiran: ${docs.map(d => d.name).join(', ')}]` : 'Analisis Gambar');
    const userMsg = {
      role: 'user',
      content: text,
      displayContent: displayPrompt,
      image: image,
      timestamp: new Date().toISOString()
    };

    // Auto title session if first message
    if (session.messages.length === 0) {
      session.title = displayPrompt.length > 30 ? displayPrompt.substring(0, 30) + '...' : displayPrompt;
      renderChatHistory();
    }

    session.messages.push(userMsg);
    savePersistedState();

    // Immediately render user's message bubble in single mode
    if (STATE.mode !== 'arena') {
      appendMessageElement('user', displayPrompt, image, 'Anda');
      smartScrollChatToBottom(true);
    }

    // Reset input & attachments
    els.promptInput.value = '';
    autoResizeTextarea(els.promptInput);
    STATE.attachedDocs = [];
    clearAttachedImage();
    renderAttachmentPreviews();
    AudioEngine.send();

    if (STATE.mode === 'arena') {
      await runArenaStreaming(session, text, image);
    } else if (STATE.mode === 'auto') {
      await runAutoRouterStreaming(session, text, image);
    } else if (STATE.mode === 'openrouter') {
      await runOpenRouterStreaming(session, text, image, STATE.settings.openRouterModel);
    } else {
      await runOllamaStreaming(session, text, image, STATE.settings.ollamaModel);
    }
  }

  // ==================== UNIVERSAL MODEL ERROR & WARNING HANDLER ====================
  function formatModelErrorMessage(engine, modelName, err, hasImage = false, hasWebSearch = false) {
    const rawMsg = (err && err.message) ? err.message : String(err || 'Unknown error');
    const msg = rawMsg.toLowerCase();
    const isCorsOrNetwork = IS_GITHUB_PAGES && (msg.includes('failed to fetch') || msg.includes('networkerror') || err.name === 'TypeError');
    const isVisionUnsupported = hasImage && (
      msg.includes('image') || 
      msg.includes('vision') || 
      msg.includes('multimodal') || 
      msg.includes('does not support') ||
      msg.includes('unsupported') ||
      msg.includes('schema') ||
      msg.includes('invalid format') ||
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
      advice = `💡 <strong>Saran:</strong> Semua model diizinkan mencoba memproses gambar. Jika model ini tidak mendukungnya, beralihlah ke model multimodal seperti <code>google/gemini-2.0-flash-exp:free</code>, <code>openai/gpt-4o</code>, <code>gemma4:31b</code>, atau kirim kembali prompt Anda tanpa lampiran gambar.`;
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

    try {
      const messagesPayload = [];
      let systemContent = STATE.settings.systemPrompt || '';

      // If Web Search is enabled, fetch real-time search context
      if (STATE.webSearchEnabled) {
        bubbleText.innerHTML = '<span style="color:var(--neon-cyan); font-size:0.8rem;"><i class="fa-solid fa-globe fa-spin"></i> Mencari informasi terkini di Google Serper...</span>';
        const webRes = await getWebSearchContext(promptText);
        if (webRes && webRes.systemPromptContext) {
          systemContent = systemContent ? `${systemContent}\n\n${webRes.systemPromptContext}` : webRes.systemPromptContext;
          webSources = webRes.sources;
        }
        bubbleText.innerHTML = '<span class="typing-cursor"></span>';
      }

      if (systemContent) {
        messagesPayload.push({ role: 'system', content: systemContent });
      }
      
      // History context - only attach image on the latest active user turn to prevent multi-turn schema rejections
      const lastIndex = session.messages.length - 1;
      session.messages.forEach((m, idx) => {
        const item = { role: m.role, content: m.content || '' };
        if (m.image && idx === lastIndex) {
          const rawBase64 = m.image.replace(/^data:image\/[a-z0-9.+_-]+;base64,/i, '').replace(/[\r\n\s]/g, '');
          if (rawBase64) item.images = [rawBase64];
        }
        messagesPayload.push(item);
      });

      const isNemotronOrLong = modelName.toLowerCase().includes('nemotron') || 
                               modelName.toLowerCase().includes('deepseek') || 
                               modelName.toLowerCase().includes('qwen') || 
                               modelName.toLowerCase().includes('llama-3.3') ||
                               modelName.toLowerCase().includes('kimi') ||
                               modelName.toLowerCase().includes('glm');

      const numPredictVal = isNemotronOrLong ? -1 : Math.max(parseInt(STATE.settings.maxTokens) || 8192, 8192);

      const ep = normalizeEndpoint(STATE.settings.ollamaEndpoint);
      const requestBody = {
        model: modelName,
        messages: messagesPayload,
        stream: true,
        options: {
          temperature: parseFloat(STATE.settings.temperature),
          top_p: parseFloat(STATE.settings.topP),
          num_predict: numPredictVal,
          num_ctx: 16384
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

      const chatUrl = IS_GITHUB_PAGES ? `${ep}/api/chat` : '/api/ollama/chat';

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
      const streamRenderer = new StreamBufferRenderer(bubbleText, () => smartScrollChatToBottom(false));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.done_reason) doneReason = parsed.done_reason;
            if (parsed.message?.content) {
              if (!firstTokenTime) firstTokenTime = performance.now();
              tokenCount++;
              streamRenderer.append(parsed.message.content);
            }
          } catch (pe) {
            console.error('Error parsing Ollama line:', pe);
          }
        }
      }

      const fullText = streamRenderer.finish();

      const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
      const tps = totalTime > 0 ? (tokenCount / totalTime).toFixed(1) : '0';
      
      bubbleText.innerHTML = renderMarkdown(fullText);
      if (webSources && webSources.length > 0) {
        renderMessageSources(assistantRow, webSources);
      }
      metaBox.innerHTML = `
        <strong>${modelName}</strong>
        <span class="meta-model-badge">Ollama</span>
        <span>⏱️ ${totalTime}s</span>
        <span>⚡ ${tps} tps</span>
      `;

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
        showToast('Generasi dihentikan oleh pengguna.');
      } else {
        const errorHtml = formatModelErrorMessage('ollama', modelName, err, Boolean(image), STATE.webSearchEnabled);

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
            showToast('Beralih ke OpenRouter. Mengirim prompt...', 'info');
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

    try {
      const messagesPayload = [];
      let systemContent = STATE.settings.systemPrompt || '';

      // If Web Search is enabled, fetch real-time search context
      if (STATE.webSearchEnabled) {
        bubbleText.innerHTML = '<span style="color:var(--neon-cyan); font-size:0.8rem;"><i class="fa-solid fa-globe fa-spin"></i> Menghubungkan Google Serper Web Search...</span>';
        const webRes = await getWebSearchContext(promptText);
        if (webRes && webRes.systemPromptContext) {
          systemContent = systemContent ? `${systemContent}\n\n${webRes.systemPromptContext}` : webRes.systemPromptContext;
          webSources = webRes.sources;
        }
        bubbleText.innerHTML = '<span class="typing-cursor"></span>';
      }

      if (systemContent) {
        messagesPayload.push({ role: 'system', content: systemContent });
      }

      // History context - safely format images
      const lastIndex = session.messages.length - 1;
      session.messages.forEach((m, idx) => {
        if (m.image && idx === lastIndex) {
          messagesPayload.push({
            role: m.role,
            content: [
              { type: 'text', text: m.content || 'Jelaskan dan analisis gambar ini secara detail.' },
              { type: 'image_url', image_url: { url: m.image } }
            ]
          });
        } else {
          messagesPayload.push({ role: m.role, content: m.content || '' });
        }
      });

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

      const isNemotronOrLong = modelName.toLowerCase().includes('nemotron') || 
                               modelName.toLowerCase().includes('deepseek') || 
                               modelName.toLowerCase().includes('qwen') || 
                               modelName.toLowerCase().includes('llama-3.3') ||
                               modelName.toLowerCase().includes('kimi') ||
                               modelName.toLowerCase().includes('glm');

      const maxTokensVal = isNemotronOrLong 
        ? Math.max(parseInt(STATE.settings.maxTokens) || 8192, 16384)
        : Math.max(parseInt(STATE.settings.maxTokens) || 8192, 8192);

      const requestBody = {
        model: modelName,
        messages: messagesPayload,
        stream: true,
        temperature: parseFloat(STATE.settings.temperature),
        top_p: parseFloat(STATE.settings.topP),
        max_tokens: maxTokensVal
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
      const streamRenderer = new StreamBufferRenderer(bubbleText, () => smartScrollChatToBottom(false));

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

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.error) throw new Error(typeof parsed.error === 'object' ? parsed.error.message : parsed.error);
            if (parsed.choices?.[0]?.finish_reason) {
              finishReason = parsed.choices[0].finish_reason;
            }
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              if (!firstTokenTime) firstTokenTime = performance.now();
              tokenCount++;
              streamRenderer.append(delta);
            }
          } catch (pe) {
            // Ignore parse errors on partial chunks
          }
        }
      }

      const fullText = streamRenderer.finish();

      const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
      const tps = totalTime > 0 ? (tokenCount / totalTime).toFixed(1) : '0';

      bubbleText.innerHTML = renderMarkdown(fullText);
      if (webSources && webSources.length > 0) {
        renderMessageSources(assistantRow, webSources);
      }
      metaBox.innerHTML = `
        <strong>${modelName}</strong>
        <span class="meta-model-badge" style="background:rgba(255,82,0,0.15); color:var(--neon-amber);">OpenRouter</span>
        <span>⏱️ ${totalTime}s</span>
        <span>⚡ ${tps} tps</span>
      `;

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
        showToast('Generasi dihentikan.');
      } else {
        const errorHtml = formatModelErrorMessage('openrouter', modelName, err, Boolean(image), STATE.webSearchEnabled);

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

  // --- INDEPENDENT DUAL SPLIT WORKSPACE STREAMING ---
  async function sendArenaPromptA(customText = null) {
    const text = customText || (els.arenaInputA ? els.arenaInputA.value.trim() : '');
    if (!text || STATE.isGeneratingA) return;

    const session = getActiveSession('arena');
    const modelA = (els.arenaModelOllama ? els.arenaModelOllama.value : null) || STATE.settings.arenaModelA;

    // Clear empty placeholder
    els.arenaMessagesA.querySelector('.arena-empty-placeholder')?.remove();

    // Append user message to Slot A
    appendArenaBubbleToColumn(els.arenaMessagesA, 'user', text, 'Anda', null, 'A');
    session.messages.push({ role: 'user', content: text, slot: 'A', engine: 'ollama', timestamp: new Date().toISOString() });
    savePersistedState();

    if (els.arenaInputA) els.arenaInputA.value = '';
    STATE.isGeneratingA = true;
    if (els.arenaSendBtnA) els.arenaSendBtnA.style.display = 'none';
    if (els.arenaStopBtnA) els.arenaStopBtnA.style.display = 'flex';
    STATE.abortControllerA = new AbortController();

    if (els.arenaStatsA) els.arenaStatsA.innerText = 'Menghasilkan...';
    const assistantRow = appendArenaBubbleToColumn(els.arenaMessagesA, 'assistant', '', modelA, null, 'A');
    const bubbleText = assistantRow.querySelector('.msg-text-content');
    bubbleText.innerHTML = '<span class="typing-cursor"></span>';
    smartScrollArenaToBottom(els.arenaMessagesA, true);

    const start = performance.now();
    let fullText = '';
    let tokens = 0;
    let webSources = null;

    try {
      const messagesPayload = [];
      let systemContent = STATE.settings.systemPrompt || '';

      if (STATE.webSearchEnabled) {
        bubbleText.innerHTML = '<span style="color:var(--neon-cyan); font-size:0.8rem;"><i class="fa-solid fa-globe fa-spin"></i> Mencari info Google Serper...</span>';
        const webRes = await getWebSearchContext(text);
        if (webRes && webRes.systemPromptContext) {
          systemContent = systemContent ? `${systemContent}\n\n${webRes.systemPromptContext}` : webRes.systemPromptContext;
          webSources = webRes.sources;
        }
        bubbleText.innerHTML = '<span class="typing-cursor"></span>';
      }

      if (systemContent) {
        messagesPayload.push({ role: 'system', content: systemContent });
      }

      session.messages.filter(m => m.slot === 'A').forEach(m => {
        messagesPayload.push({ role: m.role, content: m.content || '' });
      });

      const ep = normalizeEndpoint(STATE.settings.ollamaEndpoint);
      const headers = { 'Content-Type': 'application/json' };
      if (STATE.settings.ollamaApiKey) {
        headers['Authorization'] = `Bearer ${STATE.settings.ollamaApiKey}`;
        headers['x-ollama-key'] = STATE.settings.ollamaApiKey;
      }

      const chatUrl = IS_GITHUB_PAGES ? `${ep}/api/chat` : '/api/ollama/chat';

      const res = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelA,
          messages: messagesPayload,
          stream: true,
          endpoint: ep,
          ...(STATE.settings.ollamaApiKey ? { apiKey: STATE.settings.ollamaApiKey } : {})
        }),
        signal: STATE.abortControllerA.signal
      });

      if (!res.ok) {
        let errDetail = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errDetail = typeof errData.error === 'object' ? (errData.error.message || JSON.stringify(errData.error)) : errData.error;
          }
        } catch (je) {
          try {
            const raw = await res.text();
            if (raw) errDetail = raw.substring(0, 200);
          } catch (te) {}
        }
        throw new Error(errDetail);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      const streamRenderer = new StreamBufferRenderer(bubbleText, () => smartScrollArenaToBottom(els.arenaMessagesA, false));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const l of lines) {
          if (!l.trim()) continue;
          try {
            const p = JSON.parse(l);
            if (p.message?.content) {
              tokens++;
              streamRenderer.append(p.message.content);
            }
          } catch (pe) {}
        }
      }

      const fullText = streamRenderer.finish();

      const totalTime = ((performance.now() - start) / 1000).toFixed(2);
      const tps = totalTime > 0 ? (tokens / totalTime).toFixed(1) : '0';
      if (webSources && webSources.length > 0) {
        renderMessageSources(assistantRow, webSources);
      }
      if (els.arenaStatsA) els.arenaStatsA.innerText = `⏱️ ${totalTime}s • ⚡ ${tps} tps`;

      session.messages.push({
        role: 'assistant',
        content: fullText,
        model: modelA,
        slot: 'A',
        engine: 'ollama',
        sources: webSources,
        stats: { duration: totalTime, tps, tokens },
        timestamp: new Date().toISOString()
      });
      savePersistedState();
      AudioEngine.receive();
    } catch (e) {
      if (e.name === 'AbortError') {
        showToast('Ollama Slot A dihentikan.');
      } else {
        const errorHtml = formatModelErrorMessage('ollama', modelA, e, false, STATE.webSearchEnabled);
        bubbleText.innerHTML = errorHtml;
        if (els.arenaStatsA) els.arenaStatsA.innerText = 'Peringatan';
        AudioEngine.error();
      }
    } finally {
      STATE.isGeneratingA = false;
      if (els.arenaSendBtnA) els.arenaSendBtnA.style.display = 'flex';
      if (els.arenaStopBtnA) els.arenaStopBtnA.style.display = 'none';
    }
  }

  async function sendArenaPromptB(customText = null) {
    const text = customText || (els.arenaInputB ? els.arenaInputB.value.trim() : '');
    if (!text || STATE.isGeneratingB) return;

    if (!STATE.settings.openRouterKey) {
      showToast('OpenRouter API Key diperlukan untuk Slot B! Buka Pengaturan.', 'error');
      openModal('settingsModal');
      return;
    }

    const session = getActiveSession('arena');
    const modelB = (els.arenaModelOpenRouter ? els.arenaModelOpenRouter.value : null) || STATE.settings.arenaModelB;

    // Clear empty placeholder
    els.arenaMessagesB.querySelector('.arena-empty-placeholder')?.remove();

    // Append user message to Slot B
    appendArenaBubbleToColumn(els.arenaMessagesB, 'user', text, 'Anda', null, 'B');
    session.messages.push({ role: 'user', content: text, slot: 'B', engine: 'openrouter', timestamp: new Date().toISOString() });
    savePersistedState();

    if (els.arenaInputB) els.arenaInputB.value = '';
    STATE.isGeneratingB = true;
    if (els.arenaSendBtnB) els.arenaSendBtnB.style.display = 'none';
    if (els.arenaStopBtnB) els.arenaStopBtnB.style.display = 'flex';
    STATE.abortControllerB = new AbortController();

    if (els.arenaStatsB) els.arenaStatsB.innerText = 'Menghasilkan...';
    const assistantRow = appendArenaBubbleToColumn(els.arenaMessagesB, 'assistant', '', modelB, null, 'B');
    const bubbleText = assistantRow.querySelector('.msg-text-content');
    bubbleText.innerHTML = '<span class="typing-cursor"></span>';
    smartScrollArenaToBottom(els.arenaMessagesB, true);

    const start = performance.now();
    let fullText = '';
    let tokens = 0;
    let webSources = null;

    try {
      const messagesPayload = [];
      let systemContent = STATE.settings.systemPrompt || '';

      if (STATE.webSearchEnabled) {
        bubbleText.innerHTML = '<span style="color:var(--neon-cyan); font-size:0.8rem;"><i class="fa-solid fa-globe fa-spin"></i> Menghubungkan Google Serper Web Search...</span>';
        const webRes = await getWebSearchContext(text);
        if (webRes && webRes.systemPromptContext) {
          systemContent = systemContent ? `${systemContent}\n\n${webRes.systemPromptContext}` : webRes.systemPromptContext;
          webSources = webRes.sources;
        }
        bubbleText.innerHTML = '<span class="typing-cursor"></span>';
      }

      if (systemContent) {
        messagesPayload.push({ role: 'system', content: systemContent });
      }

      session.messages.filter(m => m.slot === 'B').forEach(m => {
        messagesPayload.push({ role: m.role, content: m.content || '' });
      });

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

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelB,
          messages: messagesPayload,
          stream: true,
          apiKey: isOpenRouterDirect ? undefined : STATE.settings.openRouterKey
        }),
        signal: STATE.abortControllerB.signal
      });

      if (!res.ok) {
        let errDetail = `HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson && errJson.error) {
            errDetail = typeof errJson.error === 'object' ? (errJson.error.message || JSON.stringify(errJson.error)) : errJson.error;
          }
        } catch (je) {
          try {
            const raw = await res.text();
            if (raw) errDetail = raw.substring(0, 200);
          } catch (te) {}
        }
        throw new Error(errDetail);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      const streamRenderer = new StreamBufferRenderer(bubbleText, () => smartScrollArenaToBottom(els.arenaMessagesB, false));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const l of lines) {
          if (!l.trim() || !l.startsWith('data:')) continue;
          const jsonStr = l.replace(/^data:\s*/, '');
          if (jsonStr === '[DONE]') break;
          try {
            const p = JSON.parse(jsonStr);
            const delta = p.choices?.[0]?.delta?.content;
            if (delta) {
              tokens++;
              streamRenderer.append(delta);
            }
          } catch (pe) {}
        }
      }

      const fullText = streamRenderer.finish();

      const totalTime = ((performance.now() - start) / 1000).toFixed(2);
      const tps = totalTime > 0 ? (tokens / totalTime).toFixed(1) : '0';
      if (webSources && webSources.length > 0) {
        renderMessageSources(assistantRow, webSources);
      }
      if (els.arenaStatsB) els.arenaStatsB.innerText = `⏱️ ${totalTime}s • ⚡ ${tps} tps`;

      session.messages.push({
        role: 'assistant',
        content: fullText,
        model: modelB,
        slot: 'B',
        engine: 'openrouter',
        sources: webSources,
        stats: { duration: totalTime, tps, tokens },
        timestamp: new Date().toISOString()
      });
      savePersistedState();
      AudioEngine.receive();
    } catch (e) {
      if (e.name === 'AbortError') {
        showToast('OpenRouter Slot B dihentikan.');
      } else {
        const errorHtml = formatModelErrorMessage('openrouter', modelB, e, false, STATE.webSearchEnabled);
        bubbleText.innerHTML = errorHtml;
        if (els.arenaStatsB) els.arenaStatsB.innerText = 'Peringatan';
        AudioEngine.error();
      }
    } finally {
      STATE.isGeneratingB = false;
      if (els.arenaSendBtnB) els.arenaSendBtnB.style.display = 'flex';
      if (els.arenaStopBtnB) els.arenaStopBtnB.style.display = 'none';
    }
  }

  // --- AUTO ROUTER (SMART ROUTING) ---
  async function runAutoRouterStreaming(session, promptText, image) {
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
      showToast('🔀 Auto-Router: Ollama offline, fallback ke OpenRouter...', 'info');
      await runOpenRouterStreaming(session, promptText, image, STATE.settings.openRouterModel);
    } else {
      showToast('Ollama offline dan OpenRouter Key belum disetting.', 'error');
    }
  }

  function setGeneratingState(isGen) {
    STATE.isGenerating = isGen;
    els.sendPromptBtn.style.display = isGen ? 'none' : 'flex';
    els.stopGenerationBtn.style.display = isGen ? 'flex' : 'none';
  }

  function stopGeneration() {
    if (STATE.abortController) {
      STATE.abortController.abort();
      STATE.abortController = null;
    }
    setGeneratingState(false);
  }

  // ==================== IMAGE VISION & MEDIA HANDLER ====================
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

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('File harus berupa format gambar (PNG, JPG, WEBP).', 'error');
      return;
    }

    try {
      const compressedDataUrl = await compressImageToWebP(file, 1024, 0.8) || (await new Promise(r => {
        const reader = new FileReader();
        reader.onload = ev => r(ev.target.result);
        reader.readAsDataURL(file);
      }));

      STATE.attachedImage = compressedDataUrl;
      els.imagePreviewImg.src = STATE.attachedImage;
      els.attachmentPreviewBar.style.display = 'flex';
      updateVisionCompatibilityBadge();
      AudioEngine.click();

      // If device backend is available, upload to data/uploads/ on disk in background
      DeviceStorage.uploadFile(compressedDataUrl).catch(() => {});
    } catch (err) {
      console.warn('Image processing warning:', err.message);
    }
  }

  function clearAttachedImage() {
    STATE.attachedImage = null;
    if (els.imageFileInput) els.imageFileInput.value = '';
    if (els.cameraFileInput) els.cameraFileInput.value = '';
    renderAttachmentPreviews();
    updateVisionCompatibilityBadge();
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


  // ==================== SYSTEM PRESET HANDLER ====================
  function applySystemPreset(presetKey) {
    if (SYSTEM_PRESETS[presetKey]) {
      STATE.settings.systemPrompt = SYSTEM_PRESETS[presetKey];
      STATE.settings.activePreset = presetKey;
      els.settingSystemPrompt.value = STATE.settings.systemPrompt;
      updatePresetBanner();
      savePersistedState();
      showToast(`Persona aktif: ${presetKey.toUpperCase()}`);
      AudioEngine.click();
    }
  }

  function updatePresetBanner() {
    if (STATE.settings.activePreset && SYSTEM_PRESETS[STATE.settings.activePreset]) {
      els.activePresetBanner.style.display = 'flex';
      els.activePresetName.innerText = `Persona: ${STATE.settings.activePreset.toUpperCase()}`;
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

  // ==================== EXPORT CHAT ====================
  function exportChatHistory() {
    const session = getActiveSession();
    if (session.messages.length === 0) {
      showToast('Obrolan masih kosong untuk diekspor.', 'error');
      return;
    }

    let md = `# ${session.title}\n*Tanggal: ${new Date(session.createdAt).toLocaleString()}*\n*Engine: ${session.mode}*\n\n---\n\n`;
    session.messages.forEach(m => {
      const sender = m.role === 'user' ? '👤 User' : `🤖 ${m.model || 'Zoz AI'}`;
      md += `### ${sender}\n\n${m.content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zoz-router-${session.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Obrolan berhasil diekspor sebagai Markdown!');
    AudioEngine.click();
  }

  // ==================== MODAL HELPERS ====================
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
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

  // ==================== SETTINGS SYNC HELPER ====================
  function syncSettingsModalFields() {
    if (els.settingOllamaEndpoint) els.settingOllamaEndpoint.value = STATE.settings.ollamaEndpoint || 'http://127.0.0.1:11434';
    if (els.settingOllamaApiKey) els.settingOllamaApiKey.value = STATE.settings.ollamaApiKey || '';
    if (els.settingOpenRouterKey) els.settingOpenRouterKey.value = STATE.settings.openRouterKey || '';
    if (els.settingSerperApiKey) els.settingSerperApiKey.value = STATE.settings.serperApiKey || '075538fed9c64990e1eb32a06726c1e55a933c1e';
    if (els.paramTemperature) els.paramTemperature.value = STATE.settings.temperature ?? 0.7;
    if (els.valTemperature) els.valTemperature.innerText = STATE.settings.temperature ?? 0.7;
    if (els.paramTopP) els.paramTopP.value = STATE.settings.topP ?? 0.9;
    if (els.valTopP) els.valTopP.innerText = STATE.settings.topP ?? 0.9;
    if (els.paramMaxTokens) els.paramMaxTokens.value = STATE.settings.maxTokens ?? 4096;
    if (els.settingSystemPrompt) els.settingSystemPrompt.value = STATE.settings.systemPrompt || '';
    if (els.settingAutoPolicy) els.settingAutoPolicy.value = STATE.settings.autoPolicy || 'local_first';
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
      els.modelDropdownMenu.classList.toggle('show');
      populateModelDropdown(els.modelSearchInput.value);
    });

    document.addEventListener('click', (e) => {
      if (!els.modelPickerChip.contains(e.target) && !els.modelDropdownMenu.contains(e.target)) {
        els.modelDropdownMenu.classList.remove('show');
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

    // Send Prompt & Keyboard Handlers
    els.sendPromptBtn.addEventListener('click', handleSendPrompt);
    els.stopGenerationBtn.addEventListener('click', stopGeneration);

    els.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendPrompt();
      }
    });

    els.promptInput.addEventListener('input', () => autoResizeTextarea(els.promptInput));


    // New Chat & History
    els.newChatBtn.addEventListener('click', () => createNewSession());
    els.searchHistoryInput.addEventListener('input', (e) => renderChatHistory(e.target.value));
    
    els.clearAllHistoryBtn.addEventListener('click', () => {
      if (confirm('Apakah Anda yakin ingin menghapus semua riwayat sesi obrolan?')) {
        STATE.sessions = [];
        STATE.currentSessionId = null;
        createNewSession();
        showToast('Semua riwayat dibersihkan.');
      }
    });

    // Sidebar Mobile Open/Close Helpers
    function openSidebar() {
      els.sidebar?.classList.add('open');
      els.sidebarBackdrop?.classList.add('show');
      AudioEngine.click();
    }

    function closeSidebar() {
      els.sidebar?.classList.remove('open');
      els.sidebarBackdrop?.classList.remove('show');
    }

    // Sidebar Mobile Toggle & Backdrop Dismiss
    els.toggleSidebarBtn?.addEventListener('click', openSidebar);
    els.closeSidebarBtn?.addEventListener('click', closeSidebar);
    els.sidebarBackdrop?.addEventListener('click', closeSidebar);

    // Auto-dismiss sidebar on mobile when clicking on main content / chat area
    els.mainContent?.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && els.sidebar?.classList.contains('open')) {
        if (!els.sidebar.contains(e.target) && !els.toggleSidebarBtn?.contains(e.target)) {
          closeSidebar();
        }
      }
    });

    els.chatViewport?.addEventListener('click', () => {
      if (window.innerWidth <= 768 && els.sidebar?.classList.contains('open')) {
        closeSidebar();
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

    // Dismiss attachment dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (els.attachmentDropdown && els.attachmentDropdown.style.display !== 'none') {
        if (!els.attachmentMenuWrapper?.contains(e.target)) {
          closeAttachmentDropdown();
        }
      }
    });

    // Dismiss dropdown on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAttachmentDropdown();
      }
    });

    els.webSearchToggleBtn?.addEventListener('click', () => {
      STATE.webSearchEnabled = !STATE.webSearchEnabled;
      els.webSearchToggleBtn.classList.toggle('active', STATE.webSearchEnabled);
      showToast(STATE.webSearchEnabled ? '🌐 Real-time Web Search: AKTIF' : '🌐 Real-time Web Search: NONAKTIF');
      AudioEngine.click();
    });

    // Arena Select Changes & Split Workspace Listeners
    els.arenaModelOllama?.addEventListener('change', (e) => {
      STATE.settings.arenaModelA = e.target.value;
      savePersistedState();
    });
    els.arenaModelOpenRouter?.addEventListener('change', (e) => {
      STATE.settings.arenaModelB = e.target.value;
      savePersistedState();
    });

    // Arena Slot A (Ollama Local) Listeners
    els.arenaSendBtnA?.addEventListener('click', () => sendArenaPromptA());
    els.arenaStopBtnA?.addEventListener('click', () => {
      if (STATE.abortControllerA) {
        STATE.abortControllerA.abort();
        STATE.abortControllerA = null;
      }
    });
    els.arenaInputA?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendArenaPromptA();
      }
    });
    els.arenaInputA?.addEventListener('input', () => autoResizeTextarea(els.arenaInputA));
    els.clearArenaChatABtn?.addEventListener('click', () => {
      const session = getActiveSession('arena');
      session.messages = session.messages.filter(m => m.slot !== 'A');
      savePersistedState();
      renderCurrentSession();
      showToast('Chat Ollama (Slot A) dibersihkan.');
      AudioEngine.click();
    });

    // Arena Slot B (OpenRouter Cloud) Listeners
    els.arenaSendBtnB?.addEventListener('click', () => sendArenaPromptB());
    els.arenaStopBtnB?.addEventListener('click', () => {
      if (STATE.abortControllerB) {
        STATE.abortControllerB.abort();
        STATE.abortControllerB = null;
      }
    });
    els.arenaInputB?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendArenaPromptB();
      }
    });
    els.arenaInputB?.addEventListener('input', () => autoResizeTextarea(els.arenaInputB));
    els.clearArenaChatBBtn?.addEventListener('click', () => {
      const session = getActiveSession('arena');
      session.messages = session.messages.filter(m => m.slot !== 'B');
      savePersistedState();
      renderCurrentSession();
      showToast('Chat OpenRouter (Slot B) dibersihkan.');
      AudioEngine.click();
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

    els.clearPresetBtn.addEventListener('click', () => {
      STATE.settings.activePreset = null;
      STATE.settings.systemPrompt = '';
      els.settingSystemPrompt.value = '';
      updatePresetBanner();
      savePersistedState();
      showToast('Persona default aktif.');
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

      if (els.paramTemperature) STATE.settings.temperature = parseFloat(els.paramTemperature.value);
      if (els.paramTopP) STATE.settings.topP = parseFloat(els.paramTopP.value);
      if (els.paramMaxTokens) STATE.settings.maxTokens = parseInt(els.paramMaxTokens.value) || 4096;
      if (els.settingSystemPrompt) STATE.settings.systemPrompt = els.settingSystemPrompt.value.trim();
      if (els.settingAutoPolicy) STATE.settings.autoPolicy = els.settingAutoPolicy.value;
      
      savePersistedState();
      checkOllamaHealth();
      checkOpenRouterStatus();
      updatePresetBanner();
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
    const inputs = [els.promptInput, els.arenaInputA, els.arenaInputB, els.modelSearchInput, els.customModelInput];
    inputs.forEach(input => {
      if (!input) return;
      input.addEventListener('focus', () => {
        setTimeout(() => {
          if (window.visualViewport && appContainer) {
            appContainer.style.height = `${window.visualViewport.height}px`;
          }
          if (STATE.mode === 'arena') {
            smartScrollArenaToBottom(els.arenaMessagesA, true);
            smartScrollArenaToBottom(els.arenaMessagesB, true);
          } else {
            smartScrollChatToBottom(true);
          }
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
    updateModelUI();

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
