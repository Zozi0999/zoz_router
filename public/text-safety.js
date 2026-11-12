(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.ZozTextSafety = api;
    root.textSafety = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const REASONING_KEYS = new Set([
    'reasoning', 'reasoning_content', 'reasoning_details', 'thought', 'thinking', 'thoughts'
  ]);

  const THINKING_TAG_REGEX = /<(?:think|thought|thinking|reasoning|ant_thought|thought_process)\b[^>]*>[\s\S]*?(?:<\/(?:think|thought|thinking|reasoning|ant_thought|thought_process)>|$)/gi;
  const BRACKET_THINK_REGEX = /\[(?:THOUGHT|REASONING)\][\s\S]*?(?:\[\/(?:THOUGHT|REASONING)\]|$)/gi;
  const MODEL_TAG_REGEX = /\[(?:Model Penjawab|Model|AI Model|Konteks Percakapan|Konteks Silsilah|Konteks Internal|Catatan Konteks|INSTRUKSI FORMAT WAJIB|Instruksi Sistem & Konteks|INTEGRITAS KONTEKS|AUTONOMIC NERVOUS LOG|BIO-ENDOCRINE|ChatEndocrine):(?:[^\[\]]|\[[^\]]*\])*\](?:\n\n|\s*)/gi;

  // ==================== PURE MATHEMATICAL TOKEN TRANSPORT & NON-EUCLIDEAN ENGINE ====================
  // Beroperasi murni pada lapisan Byte-Stream, Ruang Hilbert, & Manifold Poincaré Disk (K = -1)
  // TANPA bergantung pada teks persona / instruksi prompt.

  const STOPWORDS_AND_VERBS = new Set([
    'yang', 'di', 'ke', 'dari', 'dan', 'atau', 'dengan', 'untuk', 'pada', 'adalah', 'ini', 'itu',
    'saya', 'aku', 'kamu', 'anda', 'kita', 'kami', 'mereka', 'dia', 'ia', 'nya', 'kan', 'lah',
    'tolong', 'coba', 'buatkan', 'buat', 'bikin', 'ubah', 'ganti', 'jelaskan', 'ceritakan',
    'analisis', 'analisa', 'berikan', 'kasih', 'tulis', 'tuliskan', 'apa', 'apakah', 'bagaimana',
    'mengapa', 'kenapa', 'siapa', 'dimana', 'kapan', 'berapa', 'seperti', 'agar', 'supaya',
    'dalam', 'secara', 'tentang', 'mengenai', 'oleh', 'sebagai', 'bisa', 'dapat', 'akan', 'sudah',
    'sedang', 'masih', 'lebih', 'paling', 'sangat', 'sekali', 'juga', 'hanya', 'saja', 'tidak',
    'bukan', 'belum', 'jangan', 'jika', 'kalau', 'bila', 'karena', 'sebab', 'jadi', 'maka',
    'the', 'a', 'an', 'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'about', 'as',
    'is', 'are', 'was', 'were', 'be', 'been', 'please', 'can', 'could', 'would', 'should', 'you',
    'make', 'create', 'explain', 'tell', 'write', 'give', 'show', 'how', 'what', 'why', 'who', 'maaf',
    'tidak bisa', 'safety', 'hal lain', 'melanggar'
  ]);

  const LOW_ENTROPY_FILLERS = new Set([
    'tentu', 'saja', 'baik', 'baiklah', 'halo', 'hai', 'hi', 'hello', 'pasti', 'berikut',
    'ini', 'adalah', 'penjelasan', 'mengenai', 'tentang', 'sebagai', 'asisten', 'ai', 'model',
    'bahasa', 'senang', 'hati', 'membantu', 'pertanyaan', 'menarik', 'bagus', 'sekali', 'mari',
    'kita', 'bahas', 'ulasan', 'ringkasan', 'jawaban', 'untuk', 'anda', 'kamu', 'sure',
    'certainly', 'here', 'happy', 'help', 'great', 'question', 'let', 'us', 'discuss', 'of', 'course'
  ]);

  const CASUAL_GREETING_ONLY_REGEX = /^(?:\s*(?:halo+|hai+|hi+|hello+|hey+|p|ping|tes|test|selamat\s+(?:pagi|siang|sore|malam)|assalamu'?alaikum|permisi|bro|gan|kak|min|bos|apa\s+kabar|gimana\s+kabarnya|makasih|terima\s+kasih|thanks|thank\s+you|oke|ok|sip|mantap|keren)\s*[!?.~,]*)+$/i;

  // Klausa pengantar berentropi rendah (dapat muncul berurutan di awal respons)
  const SINGLE_PREAMBLE_SENTENCE_REGEX = /^(?:\s*(?:(?:halo|hai|hi|hello|selamat\s+(?:pagi|siang|sore|malam))[!,.:\s]+|(?:wah[,.\s]+)?(?:pertanyaan|permintaan|topik|ide)\s+yang\s+(?:sangat\s+)?(?:bagus|menarik|hebat|luar\s+biasa|keren|tepat|kritis)[^.!?\n]*[.!?\n]+|(?:tentu(?:\s+saja)?|baik(?:lah)?|pasti|oke|siap|dengan\s+senang\s+hati|sure|certainly|of\s+course|great|absolutely)[,!.\s]+(?:(?:saya\s+(?:akan|bisa|dapat)|mari\s+kita|berikut\s+(?:ini\s+)?(?:adalah\s+)?|here\s+(?:is|are)\s+|let's\s+|i\s+(?:will|can)\s+)[^\n:.!?]*[:.!?]+\s*)?|(?:berikut\s+(?:ini\s+)?(?:adalah\s+)?(?:penjelasan|analisis|jawaban|ulasan|ringkasan|pembahasan|rincian|uraian|kode|implementasi|daftar|langkah|rumus)[^\n:.!?]*[:.!?]+\s*)|(?:here\s+(?:is|are)\s+(?:the|an?|your)?\s*(?:explanation|analysis|answer|overview|summary|breakdown|code|implementation|guide|list|steps|formula)[^\n:.!?]*[:.!?]+\s*)|(?:sebagai\s+(?:asisten\s+ai|model\s+bahasa|ai)[^,\n]*,\s*saya\s+akan\s+[^\n:.!?]*[:.!?]+\s*)))+/i;

  const REFUSAL_DEFLECTION_REGEX = /^\s*(?:(?:maaf|mohon\s+maaf|sorry|i\s+apologize|i'm\s+sorry|unfortunately)[,.\s]+)?(?:sebagai\s+(?:ai|model\s+bahasa|asisten\s+virtual|kecerdasan\s+buatan)|as\s+an\s+(?:ai|artificial\s+intelligence|language\s+model|helpful\s+assistant)|saya\s+tidak\s+(?:bisa|dapat|memiliki\s+(?:akses|kemampuan|opini)|diizinkan)\s+(?:untuk\s+)?(?:memberikan|menjawab|membuat|menganalisis|menjelaskan|memenuhi)|i\s+(?:cannot|can't|am\s+unable\s+to|am\s+not\s+able\s+to)\s+(?:provide|fulfill|answer|generate|create|assist\s+with))/i;

  function extractIntentVector(userPrompt) {
    const raw = String(userPrompt || '').trim();
    const isCasualGreeting = !raw || (raw.length < 45 && CASUAL_GREETING_ONLY_REGEX.test(raw));
    const isCodeMode = /\b(?:html|css|javascript|website|web|landing\s*page|portofolio|kode|code|script|component|react|jsx)\b/i.test(raw) || /<<<ZOZ_FILE|<<<<<<< SEARCH/i.test(raw);

    let cleanUserText = raw;
    const userInstructionMatch = raw.match(/(?:Instruksi Pengguna(?: Terkini)?|Permintaan Pengguna|Arahan \/ Keinginan Kustomisasi dari Pengguna):\s*"([^"]+)"/i);
    if (userInstructionMatch) {
      cleanUserText = userInstructionMatch[1].trim();
    }

    const tokens = cleanUserText
      .toLowerCase()
      .replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2);

    const vector = new Map();
    const coreTerms = [];
    const seenCore = new Set();

    for (const w of tokens) {
      const isStop = STOPWORDS_AND_VERBS.has(w);
      const weight = isStop ? 0.12 : (Math.log(1 + w.length) * (w.length >= 5 ? 1.6 : 1.1));
      vector.set(w, (vector.get(w) || 0) + weight);
      if (!isStop && w.length >= 3 && !seenCore.has(w)) {
        seenCore.add(w);
        coreTerms.push(w);
      }
    }

    let normSq = 0;
    for (const val of vector.values()) normSq += val * val;
    const norm = Math.sqrt(normSq) || 1;

    return {
      raw: cleanUserText,
      isCasualGreeting,
      isCodeMode,
      vector,
      norm,
      coreTerms
    };
  }

  function computeStreamMetrics(streamText, intentObj) {
    const text = String(streamText || '').trim();
    if (!text) return { entropyDensity: 0, cosineSimilarity: 0, isRefusal: false, isPreamble: false };

    const isRefusal = !(intentObj && intentObj.isCasualGreeting) && REFUSAL_DEFLECTION_REGEX.test(text);
    const isPreamble = !(intentObj && intentObj.isCasualGreeting) && SINGLE_PREAMBLE_SENTENCE_REGEX.test(text);

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ')
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) {
      return { entropyDensity: 0, cosineSimilarity: isRefusal ? -1 : 0, isRefusal, isPreamble };
    }

    let totalSelfInfo = 0;
    const streamVec = new Map();

    for (const w of words) {
      let info;
      if (LOW_ENTROPY_FILLERS.has(w)) {
        info = 0.04;
      } else if (STOPWORDS_AND_VERBS.has(w)) {
        info = 0.20;
      } else {
        info = Math.log(1 + w.length) * (w.length >= 5 ? 1.5 : 1.0);
      }
      totalSelfInfo += info;
      streamVec.set(w, (streamVec.get(w) || 0) + info);
    }

    const entropyDensity = totalSelfInfo / words.length;

    let dotProduct = 0;
    let streamNormSq = 0;
    for (const [sw, sVal] of streamVec.entries()) {
      streamNormSq += sVal * sVal;
      if (intentObj && intentObj.vector) {
        if (intentObj.vector.has(sw)) {
          dotProduct += sVal * intentObj.vector.get(sw);
        } else if (sw.length >= 4) {
          const stem = sw.slice(0, 4);
          for (const [uw, uVal] of intentObj.vector.entries()) {
            if (uw.length >= 4 && uw.startsWith(stem)) {
              dotProduct += sVal * uVal * 0.85;
              break;
            }
          }
        }
      }
    }

    const streamNorm = Math.sqrt(streamNormSq) || 1;
    const intentNorm = (intentObj && intentObj.norm) || 1;
    const rawCosine = Math.min(1, dotProduct / (streamNorm * intentNorm));
    const cosineSimilarity = isRefusal ? -1.0 : rawCosine;

    return {
      entropyDensity,
      cosineSimilarity,
      isRefusal,
      isPreamble
    };
  }

  function synthesizeAutoregressivePrefill(userPrompt, options = {}) {
    const intent = typeof userPrompt === 'object' && userPrompt && userPrompt.coreTerms
      ? userPrompt
      : extractIntentVector(userPrompt);

    if (intent.isCasualGreeting) return '';

    const mode = options.mode || (intent.isCodeMode ? 'code' : 'chat');
    const titleTerms = intent.coreTerms.slice(0, 6).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const cleanSubject = titleTerms || 'Analisis Teknis';

    if (mode === 'code' || mode === 'rewrite') {
      const fileName = options.fileName || '';
      if (fileName && options.useZozHeader) {
        return `<<<ZOZ_FILE name="${fileName}">\n`;
      }
      return `**${cleanSubject}**\n\n`;
    }

    return `**${cleanSubject}**\n\n`;
  }

  // ============================================================================
  // 2. TEORI GRAF BILANGAN ERDŐS (ERDŐS COLLABORATION DISTANCE GRAPH)
  // v_0 (Erdős = 0) : Kernel Niat Pengguna (User Intent Kernel)
  // v_1 (Erdős = 1) : Token/Baris yang berkolaborasi langsung (co-occurring) dengan v_0
  // v_2 (Erdős = 2) : Token jembatan struktural yang terhubung ke simpul Erdős = 1
  // v_∞ (Erdős > 2) : Simpul terisolasi / melenceng dari maksud pengguna
  // ============================================================================
  function computeErdosIntentGraph(userPrompt, candidateText = '', sourceCode = '') {
    const intent = extractIntentVector(userPrompt);
    const erdosZeroSet = new Set(intent.coreTerms.map(t => t.toLowerCase()));
    const erdosOneSet = new Set();
    const erdosTwoSet = new Set();

    // Bangun ketetanggaan Hop-1 dari klausa prompt dan baris sourceCode yang mengandung simpul Erdős-0
    const contextCorpus = [String(userPrompt || ''), String(sourceCode || ''), String(candidateText || '')].join('\n');
    const clauses = contextCorpus.split(/[\r\n.;!?]+/);

    for (const clause of clauses) {
      const words = clause.toLowerCase().replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ').split(/\s+/).filter(w => w.length >= 2 && !LOW_ENTROPY_FILLERS.has(w));
      const hasZero = words.some(w => erdosZeroSet.has(w) || [...erdosZeroSet].some(z => z.length >= 4 && (w.includes(z) || z.includes(w))));
      if (hasZero) {
        for (const w of words) {
          if (!erdosZeroSet.has(w)) erdosOneSet.add(w);
        }
      }
    }

    for (const clause of clauses) {
      const words = clause.toLowerCase().replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ').split(/\s+/).filter(w => w.length >= 2 && !LOW_ENTROPY_FILLERS.has(w));
      const hasOne = words.some(w => erdosOneSet.has(w));
      if (hasOne) {
        for (const w of words) {
          if (!erdosZeroSet.has(w) && !erdosOneSet.has(w)) erdosTwoSet.add(w);
        }
      }
    }

    // Evaluasi distribusi bilangan Erdős pada candidateText
    const evalWords = String(candidateText || '').toLowerCase().replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ').split(/\s+/).filter(w => w.length >= 2 && !LOW_ENTROPY_FILLERS.has(w));
    let sumDistance = 0;
    let hop0Count = 0;
    let hop1Count = 0;
    let hop2Count = 0;
    let disconnectedCount = 0;

    for (const w of evalWords) {
      if (erdosZeroSet.has(w) || [...erdosZeroSet].some(z => z.length >= 4 && (w.includes(z) || z.includes(w)))) {
        hop0Count++;
        sumDistance += 0;
      } else if (erdosOneSet.has(w)) {
        hop1Count++;
        sumDistance += 1;
      } else if (erdosTwoSet.has(w)) {
        hop2Count++;
        sumDistance += 2;
      } else {
        disconnectedCount++;
        sumDistance += 4; // penalti komponen tak terhubung
      }
    }

    const totalEval = Math.max(1, evalWords.length);
    const meanErdosNumber = evalWords.length > 0 ? (sumDistance / totalEval) : 1;
    const erdosAffinity = 1 / (1 + meanErdosNumber);
    const hop1Ratio = (hop0Count + hop1Count) / totalEval;

    // Cari baris jangkar pada sourceCode dengan Bilangan Erdős <= 1 (untuk lokalisasi target edit website)
    const hop1Anchors = [];
    if (sourceCode) {
      const srcLines = String(sourceCode).split(/\r?\n/);
      for (let i = 0; i < srcLines.length; i++) {
        const line = srcLines[i];
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 4) continue;
        const lWords = trimmed.toLowerCase().replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ').split(/\s+/).filter(Boolean);
        let hits0 = 0;
        let hits1 = 0;
        for (const lw of lWords) {
          if (erdosZeroSet.has(lw) || [...erdosZeroSet].some(z => z.length >= 4 && (lw.includes(z) || z.includes(lw)))) hits0++;
          else if (erdosOneSet.has(lw)) hits1++;
        }
        if (hits0 > 0) {
          hop1Anchors.push({ lineNumber: i + 1, erdosNumber: 1, score: hits0 * 3 + hits1, content: line });
        }
      }
      hop1Anchors.sort((a, b) => b.score - a.score);
    }

    return {
      erdosZeroKernel: [...erdosZeroSet],
      meanErdosNumber: Number(meanErdosNumber.toFixed(4)),
      erdosAffinity: Number(erdosAffinity.toFixed(4)),
      hop1Ratio: Number(hop1Ratio.toFixed(4)),
      counts: { hop0: hop0Count, hop1: hop1Count, hop2: hop2Count, disconnected: disconnectedCount },
      hop1Anchors: hop1Anchors.slice(0, 8)
    };
  }

  // ============================================================================
  // 3. TEOREMA BATAS SZEGŐ & MATRIKS TOEPLITZ (SZEGŐ TOEPLITZ SPECTRAL ANALYZER)
  // Memodelkan sinyal pengiriman token x_1..x_N sebagai matriks autokorelasi Toeplitz
  // T_p = [r_{|i-j|}] dan menghitung koefisien polinomial ortogonal Szegő / Verblunsky
  // κ_k serta rasio determinan asimtotik:
  //   lim_{p->∞} det(T_p) / (r_0 * det(T_{p-1})) = Π_{k=1}^p (1 - κ_k^2) = exp(1/2π ∫ ln(f(ω)/r_0) dω)
  // ============================================================================
  function computeSzegoToeplitzSpectrum(signalSamples, maxOrder = 6) {
    const x = Array.isArray(signalSamples) ? signalSamples.map(Number).filter(Number.isFinite) : [];
    const N = x.length;
    if (N < 3) {
      return {
        szegoSpectralFlatness: 1,
        toeplitzDetRatio: 1,
        verblunskyCoeffs: [],
        eigenMin: 1,
        eigenMax: 1,
        isNarrowbandSingularity: false
      };
    }

    let mean = 0;
    for (let i = 0; i < N; i++) mean += x[i];
    mean /= N;

    const centered = new Array(N);
    for (let i = 0; i < N; i++) centered[i] = x[i] - mean;

    const p = Math.min(maxOrder, N - 1);
    const r = new Array(p + 1).fill(0);
    for (let k = 0; k <= p; k++) {
      let acc = 0;
      for (let n = 0; n < N - k; n++) {
        acc += centered[n] * centered[n + k];
      }
      r[k] = acc / N;
    }

    if (r[0] <= 1e-12) {
      return {
        szegoSpectralFlatness: 0,
        toeplitzDetRatio: 0,
        verblunskyCoeffs: [1],
        eigenMin: 0,
        eigenMax: 0,
        isNarrowbandSingularity: N >= 6
      };
    }

    // Rekursi Levinson-Durbin untuk Polinomial Ortogonal Szegő pada Lingkaran Satuan (OPUC)
    const a = new Array(p + 1).fill(0);
    const verblunskyCoeffs = [];
    let E = r[0];
    let detProduct = 1.0;

    for (let k = 1; k <= p; k++) {
      let lambda = r[k];
      for (let j = 1; j < k; j++) {
        lambda += a[j] * r[k - j];
      }
      const kappa = Math.max(-0.9999, Math.min(0.9999, -lambda / Math.max(1e-12, E)));
      verblunskyCoeffs.push(Number(kappa.toFixed(4)));

      const nextA = new Array(p + 1).fill(0);
      nextA[k] = kappa;
      for (let j = 1; j < k; j++) {
        nextA[j] = a[j] + kappa * a[k - j];
      }
      for (let j = 1; j <= k; j++) a[j] = nextA[j];

      const factor = 1 - kappa * kappa;
      detProduct *= factor;
      E *= factor;
    }

    // Evaluasi simbol spektral Fourier f(ω) = r_0 + 2 Σ_{k=1}^p (1 - k/(p+1)) r_k cos(k ω) (kernel Fejér-Szegő non-negatif)
    let fMin = Infinity;
    let fMax = -Infinity;
    const M = 16;
    for (let m = 0; m < M; m++) {
      const omega = (Math.PI * m) / (M - 1);
      let fVal = r[0];
      for (let k = 1; k <= p; k++) {
        const fejerWeight = 1 - (k / (p + 1));
        fVal += 2 * fejerWeight * r[k] * Math.cos(k * omega);
      }
      if (fVal < fMin) fMin = fVal;
      if (fVal > fMax) fMax = fVal;
    }

    const szegoSpectralFlatness = Math.max(0, Math.min(1, detProduct));
    return {
      szegoSpectralFlatness: Number(szegoSpectralFlatness.toFixed(4)),
      toeplitzDetRatio: Number((E / r[0]).toFixed(4)),
      verblunskyCoeffs,
      eigenMin: Number(Math.max(0, fMin).toFixed(4)),
      eigenMax: Number(Math.max(0, fMax).toFixed(4)),
      isNarrowbandSingularity: N >= 8 && szegoSpectralFlatness < 0.015
    };
  }

  // ============================================================================
  // 4. TEOREMA KŐNIG (BIPARTITE MAXIMUM MATCHING = MINIMUM VERTEX COVER)
  // Mencocokkan blok SEARCH (himpunan simpul U) terhadap jendela baris kode sumber
  // (himpunan simpul V) pada graf bipartit G = (U ∪ V, E) menggunakan algoritma
  // lintasan penambah (augmenting path) Kőnig-Hopcroft-Karp sehingga pengeditan
  // website berhasil secara deterministik meskipun ada deviasi spasi/atribut kecil.
  // ============================================================================
  function normalizeCodeLineForKonig(line) {
    return String(line || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s*([=<>/{};:(),])\s*/g, '$1')
      .toLowerCase();
  }

  function computeLineBipartiteWeight(normU, normV) {
    if (!normU && !normV) return 1.0;
    if (!normU || !normV) return 0.0;
    if (normU === normV) return 1.0;
    if (normU.length < 3 || normV.length < 3) {
      return normU === normV ? 1.0 : 0.0;
    }
    // Sorensen-Dice bigram similarity pada string ternormalisasi
    const bigramsU = new Map();
    for (let i = 0; i < normU.length - 1; i++) {
      const bg = normU.slice(i, i + 2);
      bigramsU.set(bg, (bigramsU.get(bg) || 0) + 1);
    }
    let intersection = 0;
    for (let i = 0; i < normV.length - 1; i++) {
      const bg = normV.slice(i, i + 2);
      const count = bigramsU.get(bg) || 0;
      if (count > 0) {
        intersection++;
        bigramsU.set(bg, count - 1);
      }
    }
    return (2.0 * intersection) / ((normU.length - 1) + (normV.length - 1));
  }

  function konigBipartiteMatchHunk(sourceCode, searchStr, replaceStr, edgeThreshold = 0.72) {
    const code = String(sourceCode || '');
    const sRaw = String(searchStr || '').replace(/^\r?\n/, '').replace(/\r?\n\s*$/, '');
    const rRaw = String(replaceStr || '').replace(/^\r?\n/, '').replace(/\r?\n\s*$/, '');
    if (!code || !sRaw.trim()) return null;

    const srcLines = code.split(/\r?\n/);
    const rawSearchLines = sRaw.split(/\r?\n/);

    // Filter simpul U (baris non-kosong dari SEARCH) beserta indeks aslinya
    const U = [];
    for (let i = 0; i < rawSearchLines.length; i++) {
      const norm = normalizeCodeLineForKonig(rawSearchLines[i]);
      if (norm) U.push({ idx: i, raw: rawSearchLines[i], norm });
    }
    if (U.length === 0) return null;

    const normSrc = srcLines.map(normalizeCodeLineForKonig);

    // Cari kandidat posisi awal berdasarkan kecocokan simpul pertama U[0] atau simpul kedua U[1]
    const candidateStarts = new Set();
    for (let j = 0; j < normSrc.length; j++) {
      if (!normSrc[j]) continue;
      if (computeLineBipartiteWeight(U[0].norm, normSrc[j]) >= edgeThreshold) {
        candidateStarts.add(j);
      } else if (U.length >= 2 && computeLineBipartiteWeight(U[1].norm, normSrc[j]) >= edgeThreshold && j > 0) {
        candidateStarts.add(j - 1);
      }
    }

    if (candidateStarts.size === 0) return null;

    let bestMatch = null;
    const minSpan = Math.max(1, U.length - 1);
    const maxSpan = Math.min(srcLines.length, rawSearchLines.length + Math.max(3, Math.ceil(rawSearchLines.length * 0.35)));

    for (const startIdx of candidateStarts) {
      const windowLen = Math.min(maxSpan, srcLines.length - startIdx);
      if (windowLen < minSpan) continue;

      // Himpunan simpul V dalam jendela kandidat [startIdx, startIdx + windowLen - 1]
      const V = [];
      for (let k = 0; k < windowLen; k++) {
        const lineIdx = startIdx + k;
        if (normSrc[lineIdx]) {
          V.push({ winOffset: k, lineIdx, norm: normSrc[lineIdx] });
        }
      }
      if (V.length === 0) continue;

      // Konstruksi graf bipartit G = (U ∪ V, E) dengan syarat bobot w(u_a, v_b) >= edgeThreshold
      const adj = Array.from({ length: U.length }, () => []);
      const weights = Array.from({ length: U.length }, () => ({}));
      for (let a = 0; a < U.length; a++) {
        for (let b = 0; b < V.length; b++) {
          // Jaga kedekatan urutan relatif agar tidak mencocokkan baris yang melompat jauh
          if (Math.abs(a - b) > Math.max(3, Math.ceil(U.length * 0.4))) continue;
          const w = computeLineBipartiteWeight(U[a].norm, V[b].norm);
          if (w >= edgeThreshold) {
            adj[a].push(b);
            weights[a][b] = w;
          }
        }
        // Urutkan tetangga berdasarkan bobot tertinggi terlebih dahulu
        adj[a].sort((b1, b2) => weights[a][b2] - weights[a][b1]);
      }

      // Algoritma Augmenting Path Kőnig-Kuhn untuk mencari Pencocokan Maksimum |M*| = Penutup Simpul Minimum |C*|
      const matchV = new Array(V.length).fill(-1);
      const matchU = new Array(U.length).fill(-1);

      function dfsAugment(u, visited) {
        for (const v of adj[u]) {
          if (visited[v]) continue;
          visited[v] = true;
          if (matchV[v] === -1 || dfsAugment(matchV[v], visited)) {
            matchV[v] = u;
            matchU[u] = v;
            return true;
          }
        }
        return false;
      }

      let matchingCardinality = 0;
      for (let u = 0; u < U.length; u++) {
        const visited = new Array(V.length).fill(false);
        if (dfsAugment(u, visited)) {
          matchingCardinality++;
        }
      }

      const coverageRatio = matchingCardinality / U.length;
      if (coverageRatio < (U.length <= 2 ? 1.0 : 0.75)) continue;

      // Hitung total bobot pencocokan dan rentang baris aktual [matchedStartLine, matchedEndLine]
      let totalWeight = 0;
      let minLineIdx = Infinity;
      let maxLineIdx = -Infinity;
      for (let u = 0; u < U.length; u++) {
        const v = matchU[u];
        if (v !== -1) {
          totalWeight += weights[u][v];
          if (V[v].lineIdx < minLineIdx) minLineIdx = V[v].lineIdx;
          if (V[v].lineIdx > maxLineIdx) maxLineIdx = V[v].lineIdx;
        }
      }

      // Pastikan batas awal dan akhir jendela tercakup dengan baik
      if (matchU[0] === -1 || matchU[U.length - 1] === -1) continue;

      const avgWeight = totalWeight / matchingCardinality;
      const compositeScore = coverageRatio * 0.6 + avgWeight * 0.4;

      if (!bestMatch || compositeScore > bestMatch.compositeScore) {
        bestMatch = {
          startLineIdx: minLineIdx,
          endLineIdx: maxLineIdx,
          matchingCardinality,
          minimumVertexCoverSize: matchingCardinality, // Berdasarkan Teorema Kőnig: |M*| = |C*|
          coverageRatio: Number(coverageRatio.toFixed(4)),
          avgWeight: Number(avgWeight.toFixed(4)),
          compositeScore: Number(compositeScore.toFixed(4))
        };
      }
    }

    if (!bestMatch || bestMatch.compositeScore < 0.76) return null;

    // Terapkan penggantian pada rentang [startLineIdx, endLineIdx] dengan penyesuaian indentasi
    const origIndent = (srcLines[bestMatch.startLineIdx].match(/^\s*/) || [''])[0];
    const rLines = rRaw.split(/\r?\n/);
    const firstNonEmpty = rLines.find(l => l.trim()) || '';
    const rIndent = (firstNonEmpty.match(/^\s*/) || [''])[0];
    const adjustedReplace = rLines.map(l => {
      if (!l.trim()) return l;
      return l.startsWith(rIndent) ? origIndent + l.slice(rIndent.length) : origIndent + l.trim();
    });

    const spanLength = bestMatch.endLineIdx - bestMatch.startLineIdx + 1;
    const updatedLines = [...srcLines];
    updatedLines.splice(bestMatch.startLineIdx, spanLength, ...adjustedReplace);

    return {
      content: updatedLines.join('\n'),
      range: {
        startLine: bestMatch.startLineIdx + 1,
        endLine: bestMatch.startLineIdx + Math.max(1, adjustedReplace.length)
      },
      konigDiagnostics: bestMatch
    };
  }

  // ============================================================================
  // 5. MESIN CONTINUATION INDUKTIF & PENCANGKOKAN SUB-POHON DOM (DOM SUBTREE GRAFTING)
  // Menangani kondisi ketika AI mengeluarkan ribuan token namun terputus di tengah
  // jalan (belum menutup >>>>>>> REPLACE, ```, atau </html>) dengan menyambung
  // stream secara rekursif (Overlap-Free KMP Suffix-Prefix Stitching) serta
  // mencangkokkan fragmen komponen HTML parsial (<section id="kontak">...</section>)
  // ke dalam pohon DOM dokumen utama.
  // ============================================================================
  function detectIncompleteEditStream(text, step = 'patch', kind = 'html') {
    const s = String(text || '');
    if (!s.trim()) return { incomplete: true, reason: 'empty_stream' };

    // 1. Cek blok SEARCH/REPLACE yang belum ditutup
    const gitSearchOpens = (s.match(/^<{3,}[ \t]*SEARCH\b/gim) || []).length;
    const gitReplaceCloses = (s.match(/^>{3,}[ \t]*(?:REPLACE)?[ \t>]*$/gim) || []).length;
    if (gitSearchOpens > gitReplaceCloses) {
      return { incomplete: true, reason: 'unclosed_git_hunk', openCount: gitSearchOpens, closeCount: gitReplaceCloses };
    }

    const zozSearchOpens = (s.match(/<<<SEARCH>>>/gi) || []).length;
    const zozReplaceOpens = (s.match(/<<<REPLACE>>>/gi) || []).length;
    const zozEditCloses = (s.match(/<<<END_ZOZ_EDIT>>>/gi) || []).length;
    if (zozSearchOpens > zozReplaceOpens || (zozSearchOpens > 0 && zozEditCloses === 0 && !/\n```\s*$/.test(s.trim()))) {
      return { incomplete: true, reason: 'unclosed_zoz_hunk', openCount: zozSearchOpens, closeCount: zozEditCloses };
    }

    // 2. Cek blok pagar kode markdown (```) yang ganjil (belum ditutup)
    const fences = (s.match(/```/g) || []).length;
    if (fences % 2 === 1) {
      return { incomplete: true, reason: 'unclosed_code_fence', fences };
    }

    // 3. Cek dokumen HTML utuh yang belum mencapai </html>
    if (kind !== 'jsx' && (step === 'rewrite' || /<!DOCTYPE\s+html|<html[\s>]/i.test(s))) {
      if (/<html[\s>]|<!DOCTYPE\s+html/i.test(s) && !/<\/html\s*>/i.test(s)) {
        return { incomplete: true, reason: 'unclosed_html_document' };
      }
    }

    // 4. Cek tag komponen utama (<section>, <style>, <script>, <header>, <footer>) yang masih menggantung
    for (const tag of ['section', 'style', 'script', 'header', 'footer', 'main', 'nav']) {
      const oCount = (s.match(new RegExp('<' + tag + '(?=[\\s>/])', 'gi')) || []).length;
      const cCount = (s.match(new RegExp('</' + tag + '\\s*>', 'gi')) || []).length;
      if (oCount > cCount && gitSearchOpens === 0 && zozSearchOpens === 0) {
        return { incomplete: true, reason: `unclosed_${tag}_tag`, openCount: oCount, closeCount: cCount };
      }
    }

    return { incomplete: false, reason: 'complete' };
  }

  function stitchContinuationOverlap(accumulated, nextChunk) {
    const a = String(accumulated || '');
    let b = String(nextChunk || '');
    if (!a) return b;
    if (!b) return a;

    // Bersihkan pembuka pagar markdown duplikat jika bagian sebelumnya sedang berada di dalam kode/hunk
    const aFences = (a.match(/```/g) || []).length;
    const aInUnclosedHunk = ((a.match(/^<{3,}[ \t]*SEARCH\b/gim) || []).length > (a.match(/^>{3,}[ \t]*(?:REPLACE)?[ \t>]*$/gim) || []).length);
    if (aFences % 2 === 1 || aInUnclosedHunk || (/<html[\s>]|<!DOCTYPE\s+html/i.test(a) && !/<\/html\s*>/i.test(a))) {
      b = b.replace(/^(?:[^\n<`]*\n)?```[a-zA-Z0-9_-]*\r?\n/, '');
    }

    // 1. Cari tumpang-tindih berbasis baris (hingga 12 baris terakhir dari a terhadap 12 baris pertama dari b)
    const aLines = a.split(/\r?\n/);
    const bLines = b.split(/\r?\n/);
    const maxLineCheck = Math.min(12, aLines.length, bLines.length);
    for (let k = maxLineCheck; k >= 1; k--) {
      let match = true;
      let nonBlankCount = 0;
      for (let j = 0; j < k; j++) {
        const lineA = aLines[aLines.length - k + j].trim();
        const lineB = bLines[j].trim();
        if (lineA !== lineB) {
          match = false;
          break;
        }
        if (lineA.length > 0) {
          nonBlankCount++;
        }
      }
      // Overlap sah jika:
      // - k >= 2: semua k baris cocok dan terdapat minimal 1 baris non-kosong bermakna
      // - k === 1: baris tunggal cocok dan memiliki panjang signifikan (>= 8 karakter) untuk mencegah kolisi kurung tunggal '}' atau ';'
      const isValidOverlap = match && (
        (k >= 2 && nonBlankCount >= 1) ||
        (k === 1 && nonBlankCount >= 1 && aLines[aLines.length - 1].trim().length >= 8)
      );
      if (isValidOverlap) {
        return aLines.concat(bLines.slice(k)).join('\n');
      }
    }

    // 2. Cari tumpang-tindih berbasis karakter persis (KMP Suffix-Prefix Overlap hingga 350 karakter)
    const maxCharOverlap = Math.min(350, a.length, b.length);
    for (let len = maxCharOverlap; len >= 6; len--) {
      if (a.slice(a.length - len) === b.slice(0, len)) {
        return a + b.slice(len);
      }
    }

    return a + b;
  }

  function findBalancedTagSpan(html, startIndex, tagName) {
    const tagRe = new RegExp('<(\\/?)' + tagName + '(?=[\\s>/])[^>]*>', 'gi');
    tagRe.lastIndex = startIndex;
    let depth = 0;
    let hasOpened = false;
    let m;
    while ((m = tagRe.exec(html)) !== null) {
      const fullTag = m[0];
      const isClose = m[1] === '/';
      const isSelfClose = /\/\s*>$/.test(fullTag);
      if (isClose) {
        if (hasOpened) {
          depth--;
          if (depth <= 0) {
            return { start: startIndex, end: m.index + fullTag.length };
          }
        }
      } else if (!isSelfClose) {
        depth++;
        hasOpened = true;
      }
    }
    return null;
  }

  function graftPartialHtmlFragment(originalHtml, modelText, userGoal = '') {
    const orig = String(originalHtml || '');
    const raw = String(modelText || '');
    if (!orig.trim() || !raw.trim()) return null;

    // Ekstrak seluruh blok kode dari respons model
    const fragments = [];
    const fenceRe = /```(?:html|css|js|javascript|xml)?[ \t]*\r?\n([\s\S]*?)(?:\r?\n```|$)/gi;
    let m;
    while ((m = fenceRe.exec(raw)) !== null) {
      if (m[1] && m[1].trim()) fragments.push(m[1].trim());
    }
    if (fragments.length === 0) {
      const rawTagMatch = raw.match(/(<(?:section|header|footer|nav|main|article|aside|div|style|script)\b[\s\S]*<\/(?:section|header|footer|nav|main|article|aside|div|style|script)>)/i);
      if (rawTagMatch) fragments.push(rawTagMatch[1].trim());
    }
    if (fragments.length === 0) return null;

    let working = orig;
    const editedRanges = [];
    let graftedCount = 0;

    for (const frag of fragments) {
      // Abaikan jika ini dokumen HTML penuh (ditangani oleh extractFullCode)
      if (/<!DOCTYPE\s+html|<html[\s>]/i.test(frag)) continue;

      // Kasus A: Fragmen adalah blok <style>...</style> atau aturan CSS murni
      if (/^<style\b/i.test(frag) || (!frag.startsWith('<') && /\{[\s\S]*:[\s\S]*\}/.test(frag))) {
        const styleBlock = /^<style\b/i.test(frag) ? frag : `<style>\n${frag}\n</style>`;
        if (/<\/head\s*>/i.test(working)) {
          const idx = working.search(/<\/head\s*>/i);
          const startLine = working.slice(0, idx).split('\n').length;
          working = working.slice(0, idx) + styleBlock + '\n' + working.slice(idx);
          editedRanges.push({ startLine, endLine: startLine + styleBlock.split('\n').length });
          graftedCount++;
          continue;
        }
      }

      // Kasus B: Fragmen adalah elemen komponen HTML (<section>, <header>, <footer>, <nav>, <div ...>)
      const openMatch = frag.match(/^<([a-zA-Z0-9_-]+)\b([^>]*)>/);
      if (!openMatch) continue;
      const tagName = openMatch[1].toLowerCase();
      const attrs = openMatch[2] || '';
      const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/i);
      const classMatch = attrs.match(/\bclass\s*=\s*["']([^"']+)["']/i);

      // B1. Cangkokkan berdasarkan atribut id="..." yang cocok di dokumen asli
      if (idMatch && idMatch[1]) {
        const targetId = idMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const targetOpenRe = new RegExp('<' + tagName + '\\b[^>]*\\bid\\s*=\\s*["\']' + targetId + '["\'][^>]*>', 'i');
        const found = targetOpenRe.exec(working);
        if (found) {
          const span = findBalancedTagSpan(working, found.index, tagName);
          if (span) {
            const startLine = working.slice(0, span.start).split('\n').length;
            working = working.slice(0, span.start) + frag + working.slice(span.end);
            editedRanges.push({ startLine, endLine: startLine + frag.split('\n').length - 1 });
            graftedCount++;
            continue;
          }
        }
      }

      // B2. Cangkokkan ke elemen sejenis berdasarkan kesamaan Bilangan Erdős / Kőnig pada kandidat <section>/<header>/<footer>/<div class="hero...">
      const goalLower = String(userGoal || '').toLowerCase();
      const candidateRe = new RegExp('<' + tagName + '\\b([^>]*)>', 'gi');
      let candMatch;
      let bestSpan = null;
      let bestScore = 0;

      while ((candMatch = candidateRe.exec(working)) !== null) {
        const span = findBalancedTagSpan(working, candMatch.index, tagName);
        if (!span) continue;
        const candidateSubtree = working.slice(span.start, span.end);
        // Jangan ganti wrapper raksasa yang membungkus seluruh body jika fragmen jauh lebih kecil
        if (tagName === 'div' && candidateSubtree.length > working.length * 0.75 && frag.length < candidateSubtree.length * 0.6) {
          continue;
        }
        const candOpenLine = candidateSubtree.split('\n')[0];
        const fragOpenLine = frag.split('\n')[0];
        let score = computeLineBipartiteWeight(normalizeCodeLineForKonig(fragOpenLine), normalizeCodeLineForKonig(candOpenLine));

        // Tambah skor jika kata kunci target pengguna (mis. "hero", "kontak", "footer") ada di dalam kandidat ini
        const goalKeywords = goalLower.match(/\b(hero|header|navbar|nav|kontak|contact|tentang|about|fitur|feature|layanan|service|harga|pricing|testimoni|footer|galeri|cta)\b/g) || [];
        for (const kw of goalKeywords) {
          if (candidateSubtree.toLowerCase().includes(kw) && frag.toLowerCase().includes(kw)) {
            score += 0.35;
          }
        }
        if (classMatch && classMatch[1]) {
          const fragClasses = classMatch[1].split(/\s+/).filter(c => c.length >= 3);
          const candAttrs = (candMatch[1] || '').toLowerCase();
          for (const fc of fragClasses) {
            if (candAttrs.includes(fc.toLowerCase())) score += 0.15;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestSpan = span;
        }
      }

      if (bestSpan && bestScore >= 0.55) {
        const startLine = working.slice(0, bestSpan.start).split('\n').length;
        working = working.slice(0, bestSpan.start) + frag + working.slice(bestSpan.end);
        editedRanges.push({ startLine, endLine: startLine + frag.split('\n').length - 1 });
        graftedCount++;
        continue;
      }

      // B3. Jika merupakan <section> atau <footer> baru (mis. menambahkan #kontak baru), sisipkan sebelum <footer atau </body>
      if (['section', 'footer', 'header', 'nav'].includes(tagName)) {
        const insertBeforeRe = tagName === 'header' || tagName === 'nav'
          ? /<body\b[^>]*>/i
          : (/<footer\b/i.test(working) && tagName !== 'footer' ? /<footer\b/i : /<\/body\s*>/i);
        const insMatch = insertBeforeRe.exec(working);
        if (insMatch) {
          const insPos = (tagName === 'header' || tagName === 'nav') ? (insMatch.index + insMatch[0].length) : insMatch.index;
          const startLine = working.slice(0, insPos).split('\n').length;
          working = working.slice(0, insPos) + '\n' + frag + '\n' + working.slice(insPos);
          editedRanges.push({ startLine, endLine: startLine + frag.split('\n').length });
          graftedCount++;
        }
      }
    }

    if (graftedCount === 0 || working === orig) return null;
    return {
      content: working,
      ranges: editedRanges,
      graftedCount
    };
  }

  function createHyperbolicManifold() {
    const PHI = (Math.sqrt(5) - 1) / 2;
    let lastPoint = { x: 0, y: 0, r: 0, theta: 0, geodesicDist: 0, busemann: 0 };
    let lastTheta = 0;
    let dyckDepth = 0;
    const history = [];
    const MAX_HISTORY = 64;

    function mobiusSub(u, v) {
      const uDotV = u.x * v.x + u.y * v.y;
      const vSq = v.x * v.x + v.y * v.y;
      const uSq = u.x * u.x + u.y * u.y;
      const denom = 1 - 2 * uDotV + uSq * vSq;
      if (Math.abs(denom) < 1e-12) return { x: 0, y: 0 };
      const numX = (1 - 2 * uDotV + vSq) * u.x - (1 - uSq) * v.x;
      const numY = (1 - 2 * uDotV + vSq) * u.y - (1 - uSq) * v.y;
      return { x: numX / denom, y: numY / denom };
    }

    function geodesicDistance(u, v) {
      const diff = mobiusSub(u, v);
      const norm = Math.min(0.999999, Math.sqrt(diff.x * diff.x + diff.y * diff.y));
      return Math.log((1 + norm) / (1 - norm));
    }

    function busemannValue(z, xiTheta) {
      const xiX = Math.cos(xiTheta);
      const xiY = Math.sin(xiTheta);
      const dx = 1 - (z.x * xiX + z.y * xiY);
      const dy = -(z.y * xiX - z.x * xiY);
      const numSq = dx * dx + dy * dy;
      const denom = Math.max(1e-9, 1 - (z.x * z.x + z.y * z.y));
      return Math.log(numSq / denom);
    }

    function mapToken(tokenStr) {
      const s = String(tokenStr || '');
      if (!s) return lastPoint;

      const opens = (s.match(/<[a-zA-Z][^/>]*>|[{\[(]/g) || []).length;
      const closes = (s.match(/<\/[a-zA-Z][^>]*>|[}\])]/g) || []).length;
      dyckDepth = Math.max(0, dyckDepth + opens - closes);

      const cleanW = s.trim().toLowerCase();
      const selfInfo = LOW_ENTROPY_FILLERS.has(cleanW) ? 0.05 : Math.log(1 + Math.min(20, s.length));

      const r = Math.tanh((0.32 * dyckDepth + 0.22 * selfInfo) / 2);

      let hash = 0;
      for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash) + s.charCodeAt(i);
        hash |= 0;
      }
      const seed = Math.abs(hash) % 997;
      lastTheta = (lastTheta + 2 * Math.PI * PHI * (seed / 997)) % (2 * Math.PI);

      const pt = {
        x: r * Math.cos(lastTheta),
        y: r * Math.sin(lastTheta),
        r,
        theta: lastTheta,
        dyckDepth,
        token: s
      };

      pt.geodesicDist = geodesicDistance(lastPoint, pt);
      pt.busemann = busemannValue(pt, lastTheta);

      history.push(pt);
      if (history.length > MAX_HISTORY) history.shift();
      lastPoint = pt;
      return pt;
    }

    function detectHorocycleTrap(windowSize = 32) {
      if (history.length < windowSize) return { trapped: false, busemannVariance: 1 };
      const win = history.slice(-windowSize);

      let meanBusemann = 0;
      for (const p of win) meanBusemann += p.busemann;
      meanBusemann /= win.length;

      let busemannVariance = 0;
      for (const p of win) {
        const d = p.busemann - meanBusemann;
        busemannVariance += d * d;
      }
      busemannVariance /= win.length;

      const joined = win.map(p => p.token).join('');
      // Abaikan karakter formatting, spasi inden, pemisah tabel (|---|), strip (-) dan simbol syntax
      const substantiveChars = joined.replace(/[\s\-=_*|.#]+/g, '');
      // Deteksi loop degenerasi sejati: pola harus berulang minimal 8 kali dan panjang substantif minimal 150 karakter
      // Mencegah false-positive memotong jawaban normal yang berisi tabel, daftar item, CSS, atau kata berulang normal
      const hasSubstantivePeriodicOrbit = substantiveChars.length >= 150 && /([a-zA-Z0-9\u00C0-\u024F]{3,80})\1{7,}$/s.test(substantiveChars);

      const trapped = hasSubstantivePeriodicOrbit || (busemannVariance < 1e-12 && win.length >= 24 && win[0].token.length >= 4 && win.every(p => p.token === win[0].token));
      return { trapped, busemannVariance, radius: lastPoint.r };
    }

    return {
      mapToken,
      detectHorocycleTrap,
      getState: () => {
        const signalSamples = history.map(p => p.geodesicDist + p.r);
        return {
          lastPoint,
          dyckDepth,
          historyLength: history.length,
          szegoSpectrum: computeSzegoToeplitzSpectrum(signalSamples, 6)
        };
      }
    };
  }

  function createEntropyStreamGate(userPrompt, options = {}) {
    const intent = extractIntentVector(userPrompt);
    const manifold = createHyperbolicManifold();
    let gateOpen = intent.isCasualGreeting || Boolean(options.bypassPreambleStrip);
    let lookaheadBuffer = '';
    let strippedPreamble = '';
    let refusalDetected = false;
    let horocycleTrapped = false;
    let totalProcessedChars = 0;
    let sampleWindowText = '';
    const MAX_GATE_HOLD_CHARS = options.maxHoldChars || 64;

    function consumePreamblePrefix() {
      if (!lookaheadBuffer) return;
      while (true) {
        const m = SINGLE_PREAMBLE_SENTENCE_REGEX.exec(lookaheadBuffer);
        if (m && m[0].length > 0) {
          strippedPreamble += m[0];
          lookaheadBuffer = lookaheadBuffer.slice(m[0].length);
        } else {
          break;
        }
      }
    }

    function push(chunkText, isFinal = false) {
      const str = String(chunkText || '');
      if (str) {
        totalProcessedChars += str.length;
        if (sampleWindowText.length < 1600) {
          sampleWindowText += str;
        }
        manifold.mapToken(str);
        const trapCheck = manifold.detectHorocycleTrap();
        if (trapCheck.trapped) {
          horocycleTrapped = true;
        }
      }

      if (gateOpen) {
        return str;
      }

      lookaheadBuffer += str;

      // 1. Deteksi Subruang Penolakan (Refusal Subspace: cos θ = -1)
      if (!intent.isCasualGreeting && lookaheadBuffer.length >= 18) {
        if (REFUSAL_DEFLECTION_REGEX.test(lookaheadBuffer.trim())) {
          refusalDetected = true;
          if (!isFinal && lookaheadBuffer.length < MAX_GATE_HOLD_CHARS) {
            return '';
          }
        }
      }

      // 2. Kupas klausa basa-basi yang sudah lengkap (berakhir dengan :, ., !, ?, atau \n)
      consumePreamblePrefix();

      if (!lookaheadBuffer.trim()) {
        if (isFinal) {
          gateOpen = true;
          return strippedPreamble;
        }
        return '';
      }

      // 3. Jika token yang tersisa adalah kode/markdown/substansi atau sudah melewati batas tunggu, buka katup seketika!
      const trimmed = lookaheadBuffer.trimStart();
      const isDirectSubstance = /^(?:<!DOCTYPE|<html|<div|<<<ZOZ_FILE|<<<<<<< SEARCH|```|#|\*\*|1\.|- |\{|\[)/i.test(trimmed);
      const hasSentenceOrLineEnd = /[:\n.!?]/.test(lookaheadBuffer);

      const looksLikeIncompletePreamble = /^(?:halo|hai|hi|hello|selamat|wah|pertanyaan|permintaan|topik|ide|tentu|baik|pasti|oke|siap|dengan\s+senang|berikut|sebagai|maaf|mohon\s+maaf|sorry|i\s+apologize|unfortunately|saya\s+tidak|i\s+cannot|i\s+can't|i\s+am\s+unable|as\s+an\s+ai|sure|certainly|of\s+course|here\s+is)\b/i.test(trimmed);

      // Fast-path latensi ultra-rendah (<50ms): Jika bukan awalan basa-basi dan sudah ada 1 token substansi + spasi
      const hasSubstantiveToken = !looksLikeIncompletePreamble && (trimmed.length >= 10 && /\s/.test(trimmed));

      if (isDirectSubstance || hasSubstantiveToken || (hasSentenceOrLineEnd && !looksLikeIncompletePreamble) || lookaheadBuffer.length >= MAX_GATE_HOLD_CHARS || isFinal) {
        consumePreamblePrefix();
        let out = lookaheadBuffer.replace(/^\s+/, '');
        lookaheadBuffer = '';
        if (!out) return '';
        if (strippedPreamble && /^[a-z]/.test(out)) {
          out = out.charAt(0).toUpperCase() + out.slice(1);
        }
        gateOpen = true;
        return out;
      }

      return '';
    }

    function flush() {
      if (gateOpen && !lookaheadBuffer) return '';
      consumePreamblePrefix();
      let out = lookaheadBuffer.replace(/^\s+/, '');
      lookaheadBuffer = '';
      const alreadyOpen = gateOpen;
      gateOpen = true;
      if (strippedPreamble && /^[a-z]/.test(out)) {
        out = out.charAt(0).toUpperCase() + out.slice(1);
      }
      if (out) return out;
      return alreadyOpen ? '' : strippedPreamble;
    }

    return {
      push,
      flush,
      getDiagnostics: () => ({
        intentCore: intent.coreTerms,
        strippedPreamble,
        refusalDetected,
        horocycleTrapped,
        erdosGraph: computeErdosIntentGraph(userPrompt, sampleWindowText),
        manifold: manifold.getState()
      })
    };
  }

  function extractFallbackConclusionFromUnclosedThought(thoughtBody) {
    const raw = String(thoughtBody || '').replace(MODEL_TAG_REGEX, '').trim();
    if (!raw) return '';
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      if (/^(?:langkah|step|transkripsi|polaritas|uji\s+opsi|opsi\s+\d|evaluasi)\b/i.test(l)) continue;
      const m = l.match(/(?:kesimpulan|jawaban(?:\s+akhir|\s+yang\s+benar)?|final\s+answer|therefore|jadi\s+jawabannya)\s*[:=-]\s*(.+)$/i);
      if (m && m[1].trim()) return m[1].trim();
    }
    return lines.length > 0 ? lines[lines.length - 1] : '';
  }

  function cleanPseudoCotJson(text) {
    if (!text || typeof text !== 'string') return '';
    // 1. Jika ada JSON reasoning yang mendahului teks kesimpulan / jawaban pengguna:
    let out = text.replace(/(?:^|\n)\s*(?:```(?:json)?\s*)?\{\s*"(?:image_\d+|transcription|polarity|options_analysis|reasoning|cot|step_\d+)"[\s\S]*?\}(?:\s*```)?\s*(?=(?:\n\s*|\b)(?:Jawaban|Solusi|Answer|Kesimpulan|Rekapitulasi|Hasil|Rekomendasi|\*\*Jawaban|\$[a-zA-Z]|\b[1-9]\.))/i, '').trim();

    // 2. Jika seluruh respons adalah blok JSON reasoning tanpa teks penutup, pulihkan jawaban yang bersih:
    if (/(?:^|\n)\s*(?:```(?:json)?\s*)?\{\s*"(?:image_\d+|transcription|polarity|options_analysis|correct_option|step_\d+)"[\s\S]*?\}(?:\s*```)?\s*$/i.test(out || text)) {
      try {
        const jsonMatch = (out || text).match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const obj = JSON.parse(jsonMatch[0]);
          const keys = Object.keys(obj);
          const parts = [];
          for (const k of keys) {
            const item = obj[k];
            if (item && typeof item === 'object') {
              const ans = item.correct_option_text || item.correct_option || item.answer;
              const explanation = (item.options_analysis && ans && item.options_analysis[ans]) || '';
              if (ans) {
                parts.push(`**Jawaban yang tepat (${k}):** $${ans.replace(/^\$+|\$+$/g, '')}$` + (explanation ? `\n\n${explanation}` : ''));
              }
            }
          }
          if (parts.length > 0) return parts.join('\n\n');
        }
      } catch (_) {}
    }
    return out;
  }

  function stripReasoningText(rawText) {
    if (typeof rawText !== 'string' || !rawText) return '';
    let cleaned = rawText
      .replace(THINKING_TAG_REGEX, '')
      .replace(BRACKET_THINK_REGEX, '')
      .replace(/<\/?(?:think|thought|thinking|reasoning|ant_thought|thought_process)\b[^>]*>/gi, '')
      .replace(/\[\/?(?:THOUGHT|REASONING)\]/gi, '')
      .replace(MODEL_TAG_REGEX, '')
      .trim();
    if (!cleaned && /<(?:think|thought|thinking|reasoning|ant_thought|thought_process)\b/i.test(rawText)) {
      const inner = rawText.replace(/^[\s\S]*?<(?:think|thought|thinking|reasoning|ant_thought|thought_process)\b[^>]*>/i, '');
      return extractFallbackConclusionFromUnclosedThought(inner);
    }
    // Bersihkan residu pseudo-cot JSON yang lolos keluar dari tag <think>
    cleaned = cleanPseudoCotJson(cleaned);
    return cleaned;
  }

  function splitReasoningAndContent(rawText) {
    if (typeof rawText !== 'string' || !rawText) {
      return { reasoning: '', content: '', isThinking: false };
    }
    const cleanContent = stripReasoningText(rawText);
    return { reasoning: '', content: cleanContent, isThinking: false };
  }

  function reflowShreddedProse(text) {
    // Preserve authored formatting instead of broadly rewriting Markdown.
    return typeof text === 'string' ? text : '';
  }

  function createThinkTagStripper() {
    let inside = false;
    let pending = '';
    let capturedThought = '';
    let emittedVisibleChars = 0;

    const OPEN_REGEX = /<(?:think|thought|thinking|reasoning|ant_thought|thought_process)\b[^>]*>|\[(?:thought|reasoning)\]/i;
    const CLOSE_REGEX = /<\/(?:think|thought|thinking|reasoning|ant_thought|thought_process)>|\[\/(?:thought|reasoning)\]/i;
    const OPEN_PREFIXES = ['<think', '<thought', '<thinking', '<reasoning', '<ant_thought', '<thought_process', '[thought]', '[reasoning]'];
    const CLOSE_TAGS = ['</think>', '</thought>', '</thinking>', '</reasoning>', '</ant_thought>', '</thought_process>', '[/thought]', '[/reasoning]'];

    function findPartialTagTailIndex(s, closingMode) {
      const minPos = Math.max(0, s.length - 36);
      for (let i = minPos; i < s.length; i++) {
        const ch = s[i];
        if (ch !== '<' && ch !== '[') continue;
        const tail = s.slice(i).toLowerCase();
        if (closingMode) {
          if (CLOSE_TAGS.some(tag => tag.startsWith(tail))) return i;
        } else {
          if (OPEN_PREFIXES.some(pref => pref.startsWith(tail) || (pref.startsWith('<') && tail.startsWith(pref) && !tail.includes('>')))) {
            return i;
          }
        }
      }
      return -1;
    }

    function push(text, final = false) {
      let input = pending + String(text || '');
      pending = '';
      let output = '';

      while (input.length > 0) {
        if (inside) {
          const closeMatch = CLOSE_REGEX.exec(input);
          if (!closeMatch) {
            const partialIdx = !final ? findPartialTagTailIndex(input, true) : -1;
            if (partialIdx >= 0) {
              if (capturedThought.length < 6000) capturedThought += input.slice(0, partialIdx);
              pending = input.slice(partialIdx);
            } else if (capturedThought.length < 6000) {
              capturedThought += input;
            }
            break;
          }
          capturedThought = '';
          input = input.slice(closeMatch.index + closeMatch[0].length);
          // Buang whitespace pembatas tepat setelah </think> jika belum ada teks jawaban sebelumnya
          if (emittedVisibleChars === 0 && !output.trim()) {
            input = input.replace(/^\s+/, '');
            output = '';
          }
          inside = false;
          continue;
        }

        const openMatch = OPEN_REGEX.exec(input);
        if (!openMatch) {
          const partialIdx = !final ? findPartialTagTailIndex(input, false) : -1;
          if (partialIdx >= 0) {
            output += input.slice(0, partialIdx);
            pending = input.slice(partialIdx);
          } else {
            output += input;
          }
          break;
        }

        output += input.slice(0, openMatch.index);
        input = input.slice(openMatch.index + openMatch[0].length);
        inside = true;
      }

      if (final && !inside && pending) {
        output += pending;
        pending = '';
      }
      const cleanOut = output.replace(MODEL_TAG_REGEX, '');
      if (cleanOut.trim()) {
        emittedVisibleChars += cleanOut.trim().length;
      }
      if (final && inside && emittedVisibleChars === 0 && capturedThought.trim()) {
        const fallback = extractFallbackConclusionFromUnclosedThought(capturedThought);
        capturedThought = '';
        return fallback;
      }
      return cleanOut;
    }

    return { push, isInsideThought: () => inside };
  }

  function sanitizeRecord(record, tagStrippers, entropyGate = null, isFinalRecord = false) {
    if (Array.isArray(record)) return record.map(item => sanitizeRecord(item, tagStrippers, entropyGate, isFinalRecord));
    if (!record || typeof record !== 'object') return record;
    const localFinal = Boolean(isFinalRecord || record.done === true || record.finish_reason);
    const out = {};
    for (const [key, value] of Object.entries(record)) {
      // Hapus kunci reasoning/thought agar pemikiran internal tidak bocor ke output klien/penyimpanan
      if (REASONING_KEYS.has(key.toLowerCase())) {
        continue;
      }
      if ((key === 'content' || key === 'response' || key === 'text') && typeof value === 'string') {
        const id = key + ':' + (record.index ?? record.id ?? record.model ?? 'default');
        if (!tagStrippers.has(id)) tagStrippers.set(id, createThinkTagStripper());
        let cleaned = tagStrippers.get(id).push(value, localFinal);
        if (entropyGate) {
          cleaned = localFinal
            ? (entropyGate.push(cleaned, true) + entropyGate.flush())
            : entropyGate.push(cleaned, false);
        }
        out[key] = cleaned;
      } else if ((key === 'content' || key === 'response') && Array.isArray(value)) {
        out[key] = value.map((part, index) => {
          if (part && typeof part === 'object' && typeof part.text === 'string') {
            const id = `part:${record.index ?? record.id ?? 'default'}:${index}`;
            if (!tagStrippers.has(id)) tagStrippers.set(id, createThinkTagStripper());
            let cleaned = tagStrippers.get(id).push(part.text, localFinal);
            if (entropyGate) {
              cleaned = localFinal
                ? (entropyGate.push(cleaned, true) + entropyGate.flush())
                : entropyGate.push(cleaned, false);
            }
            return { ...part, text: cleaned };
          }
          return sanitizeRecord(part, tagStrippers, entropyGate, localFinal);
        });
      } else if (value && typeof value === 'object') {
        out[key] = sanitizeRecord(value, tagStrippers, entropyGate, localFinal);
      } else {
        out[key] = value;
      }
    }
    // Jika record OpenRouter memiliki finish_reason pada choice tetapi delta.content tidak ada, flush sisa tagStripper & gate
    if (localFinal && out.delta && typeof out.delta === 'object' && typeof out.delta.content !== 'string') {
      let rem = '';
      for (const stripper of tagStrippers.values()) rem += stripper.push('', true);
      tagStrippers.clear();
      if (entropyGate) {
        rem = entropyGate.push(rem, true) + entropyGate.flush();
      }
      if (rem) out.delta.content = rem;
    }
    return out;
  }

  function createProviderStreamFilter(provider, mode = 'stream', options = {}) {
    let buffer = '';
    const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
    const tagStrippers = new Map();
    const entropyGate = (options && options.userPrompt)
      ? createEntropyStreamGate(options.userPrompt, options)
      : null;

    const finishTagStrippers = () => {
      let tail = '';
      for (const stripper of tagStrippers.values()) tail += stripper.push('', true);
      tagStrippers.clear();
      if (entropyGate) {
        tail = entropyGate.push(tail, true) + entropyGate.flush();
      }
      return tail;
    };
    const isOpenRouter = provider === 'openrouter';
    const isJsonSequence = provider === 'ollama' && mode === 'stream';
    const outputQueue = [];

    function decodeChunk(chunk, final = false) {
      const isBuffer = typeof Buffer !== 'undefined' && Buffer.isBuffer(chunk);
      if (decoder && isBuffer) return decoder.decode(chunk, { stream: !final });
      if (isBuffer) return chunk.toString('utf8');
      if (final && decoder) return decoder.decode();
      return String(chunk || '');
    }

    function cleanJson(raw, isSse) {
      try {
        const parsed = JSON.parse(raw);
        const isFinalRec = Boolean(parsed && (parsed.done === true || (Array.isArray(parsed.choices) && parsed.choices.some(c => c && c.finish_reason))));
        const hadOllamaText = Boolean(parsed && parsed.message && typeof parsed.message.content === 'string' && parsed.message.content.length > 0);
        const hadOpenRouterText = Boolean(parsed && Array.isArray(parsed.choices) && parsed.choices.some(c => c && c.delta && typeof c.delta.content === 'string' && c.delta.content.length > 0));
        const clean = sanitizeRecord(parsed, tagStrippers, entropyGate, isFinalRec);
        if (!isFinalRec) {
          if (hadOllamaText && clean && clean.message && clean.message.content === '' && !clean.message.tool_calls && !clean.message.images) {
            return '';
          }
          if (hadOpenRouterText && clean && Array.isArray(clean.choices) && clean.choices.every(c => !c || !c.delta || (c.delta.content === '' && !c.delta.tool_calls && !c.delta.images))) {
            return '';
          }
        }
        return (isSse ? 'data: ' : '') + JSON.stringify(clean);
      } catch (_) {
        // Jangan buang frame jika parsing gagal, teruskan frame asli agar tidak memutus kata
        return (isSse ? 'data: ' : '') + raw;
      }
    }

    function processLine(line, eol) {
      const trimmed = line.trim();
      if (!trimmed) return eol;
      if (isOpenRouter) {
        if (/^(event:|id:|retry:|:)/.test(trimmed)) return line + eol;
        if (!trimmed.startsWith('data:')) return '';
        const payload = trimmed.replace(/^data:\s*/, '');
        if (payload === '[DONE]') {
          let prefixFrame = '';
          const flushed = finishTagStrippers();
          if (flushed) {
            prefixFrame = 'data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: flushed } }] }) + eol;
          }
          return prefixFrame + 'data: [DONE]' + eol;
        }
        const clean = cleanJson(payload, true);
        return clean ? clean + eol : '';
      }
      const clean = cleanJson(trimmed, false);
      return clean ? clean + eol : '';
    }

    function drainQueue() {
      const output = outputQueue.join('');
      outputQueue.length = 0;
      return output;
    }

    function push(chunk) {
      buffer += decodeChunk(chunk, false);
      if (mode === 'json') return '';
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      if (isJsonSequence) {
        for (const line of lines) {
          if (!line.trim()) continue;
          const clean = cleanJson(line.trim(), false);
          if (clean) outputQueue.push(clean + '\n');
        }
        return drainQueue();
      }
      return lines.map(line => processLine(line, '\n')).join('');
    }

    function end() {
      let output = decodeChunk(typeof Buffer !== 'undefined' ? Buffer.alloc(0) : '', true);
      if (mode === 'json') {
        if (buffer.trim()) output += cleanJson(buffer, false);
        buffer = '';
      } else if (isJsonSequence) {
        if (buffer.trim()) {
          const clean = cleanJson(buffer.trim(), false);
          if (clean) outputQueue.push(clean);
        }
        buffer = '';
        output += drainQueue();
      } else if (buffer.trim()) {
        output += processLine(buffer, '');
        buffer = '';
      }
      const leftover = finishTagStrippers();
      if (leftover && isJsonSequence) {
        output += JSON.stringify({ message: { role: 'assistant', content: leftover }, done: false }) + '\n';
      }
      return output;
    }

    return {
      push,
      end,
      getGateDiagnostics: () => (entropyGate ? entropyGate.getDiagnostics() : null)
    };
  }

  // ============================================================================
  // 6. PURE MATHEMATICAL INFORMATION RETRIEVAL, RADIOACTIVE TEMPORAL DECAY,
  //    BOLTZMANN ENTROPY CONTROL & HILBERT-SPACE GROUNDING PROJECTION
  //    Menghapus halusinasi & pengambilan informasi usang murni dengan aljabar
  //    linear, peluruhan eksponensial radioaktif W(Δt) = exp(-λ·Δt), skor BM25F,
  //    dan proyeksi ortogonal subruang bukti P_E(u) tanpa instruksi persona AI.
  // ============================================================================

  const MONTH_INDEX_MAP = {
    januari: 1, jan: 1, january: 1,
    februari: 2, feb: 2, february: 2,
    maret: 3, mar: 3, march: 3,
    april: 4, apr: 4,
    mei: 5, may: 5,
    juni: 6, jun: 6, june: 6,
    juli: 7, jul: 7, july: 7,
    agustus: 8, agu: 8, agt: 8, aug: 8, august: 8,
    september: 9, sep: 9, sept: 9,
    oktober: 10, okt: 10, oct: 10, october: 10,
    november: 11, nov: 11,
    desember: 12, des: 12, dec: 12, december: 12
  };

  const ID_MONTH_NAMES = [
    '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const GENERIC_NON_ENTITY_WORDS = new Set([
    'januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
    'january', 'february', 'march', 'may', 'june', 'july', 'august', 'october', 'december',
    'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'agu', 'agt', 'sep', 'sept', 'okt', 'oct', 'nov', 'dec', 'des',
    'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'tahun', 'bulan', 'pekan', 'hari', 'jam', 'menit', 'detik', 'year', 'years', 'month', 'months', 'week', 'weeks', 'day', 'days', 'hour', 'hours',
    'tanggal', 'date', 'abad', 'kuartal', 'quarter', 'semester', 'tahap', 'fase', 'phase', 'stage', 'step', 'langkah',
    'bab', 'chapter', 'pasal', 'ayat', 'bagian', 'part', 'section', 'poin', 'nomor', 'no', 'item', 'baris', 'kolom', 'tabel', 'sumber', 'source',
    'versi', 'version', 'seri', 'series', 'generasi', 'gen', 'tier', 'level', 'kelas', ' peringkat', 'rank', 'top', 'skor', 'score',
    'juta', 'miliar', 'triliun', 'ribu', 'persen', 'percent', 'million', 'billion', 'trillion', 'ribuan',
    'usd', 'idr', 'eur', 'rupiah', 'dolar', 'dollar', 'gb', 'tb', 'mb', 'kb', 'kw', 'mw', 'gw', 'hz', 'ghz', 'mhz', 'nm', 'mm', 'cm', 'km', 'kg', 'fps', 'tps',
    'dari', 'pada', 'untuk', 'dengan', 'dalam', 'hingga', 'sampai', 'antara', 'sekitar', 'lebih', 'kurang', 'hampir', 'mencapai', 'sebesar', 'senilai',
    'over', 'under', 'from', 'into', 'with', 'than', 'more', 'less', 'about', 'around', 'nearly', 'up', 'to', 'in', 'on', 'at', 'by', 'of', 'for', 'the', 'and',
    'rilis', 'dirilis', 'release', 'released', 'update', 'updated', 'model', 'models', 'fitur', 'agen', 'agent', 'agents', 'data', 'kode', 'code', 'api', 'web'
  ]);

  const BILINGUAL_QUERY_BASIS = {
    rilis: ['release', 'releases', 'released', 'launch', 'launches', 'unveils', 'announces'],
    peluncuran: ['launch', 'release', 'unveils'],
    terbaru: ['latest', 'new', 'newest', 'recent'],
    terkini: ['latest', 'breaking', 'current', 'recent'],
    mutakhir: ['frontier', 'latest', 'advanced'],
    berita: ['news', 'report', 'updates'],
    pembaruan: ['update', 'updates', 'upgrade'],
    perkembangan: ['development', 'developments', 'progress', 'advances', 'trends'],
    kecerdasan: ['artificial', 'intelligence', 'ai'],
    buatan: ['artificial', 'ai'],
    makalah: ['paper', 'papers', 'article', 'articles', 'preprint', 'study'],
    jurnal: ['journal', 'paper', 'research'],
    riset: ['research', 'study', 'findings', 'paper'],
    ilmiah: ['scientific', 'academic', 'research'],
    terbaik: ['best', 'top', 'leading', 'benchmark'],
    model: ['model', 'models', 'llm', 'architecture'],
    penalaran: ['reasoning', 'thinking'],
    terbuka: ['open', 'weights', 'source'],
    harga: ['price', 'pricing', 'cost'],
    saham: ['stock', 'stocks', 'market'],
    gempa: ['earthquake', 'seismic'],
    perang: ['war', 'conflict'],
    perbedaan: ['difference', 'differences', 'vs', 'versus', 'comparison', 'compare'],
    manajer: ['manager', 'managers', 'management', 'manajemen'],
    manajemen: ['management', 'manager', 'managers', 'pengelolaan', 'manajer'],
    pengelolaan: ['management', 'manajemen', 'governance'],
    proyek: ['project', 'projects'],
    program: ['program', 'programs', 'programme', 'programmes'],
    portofolio: ['portfolio', 'portfolios'],
    alat: ['tool', 'tools'],
    perkakas: ['tool', 'tools'],
    pencarian: ['search', 'searching', 'retrieval'],
    penelusuran: ['search', 'searching', 'retrieval'],
    penyunting: ['editor', 'editors'],
    teks: ['text'],
    bawaan: ['built', 'builtin', 'built-in', 'native', 'default'],
    kustom: ['custom', 'customized'],
    dokumentasi: ['docs', 'documentation', 'reference', 'guide']
  };

  // Proyeksi Lintas-Bahasa Simetris (ID <-> EN): Membangun penutupan dua arah atas BILINGUAL_QUERY_BASIS
  const SYMMETRIC_BILINGUAL_BASIS = (() => {
    const map = new Map();
    const addEdge = (a, b) => {
      if (!a || !b || a === b) return;
      if (!map.has(a)) map.set(a, new Set());
      map.get(a).add(b);
    };
    for (const [k, arr] of Object.entries(BILINGUAL_QUERY_BASIS)) {
      const lk = k.toLowerCase();
      for (const v of arr) {
        const lv = v.toLowerCase();
        addEdge(lk, lv);
        addEdge(lv, lk);
      }
    }
    return map;
  })();

  function expandMorphologicalAndBilingualVariants(token) {
    const t = String(token || '').toLowerCase().trim();
    const out = new Set();
    if (!t || t.length < 2) return out;
    out.add(t);

    // 1. Dekomposisi kata majemuk bertanda hubung (e.g. "built-in" -> "built", "text-editor" -> "text", "editor")
    if (t.includes('-')) {
      for (const part of t.split('-')) {
        if (part.length >= 3 && !STOPWORDS_AND_VERBS.has(part)) out.add(part);
      }
    }

    // 2. Normalisasi infleksi jamak/tunggal EN & enklitik ID (-nya, -lah, -kah)
    if (t.endsWith('nya') && t.length >= 5) out.add(t.slice(0, -3));
    if ((t.endsWith('lah') || t.endsWith('kah')) && t.length >= 6) out.add(t.slice(0, -3));
    if (t.endsWith('ies') && t.length >= 5) out.add(t.slice(0, -3) + 'y');
    else if (t.endsWith('es') && t.length >= 5 && /(?:ches|shes|xes|zes|ses)$/.test(t)) out.add(t.slice(0, -2));
    else if (t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us') && !t.endsWith('is') && t.length >= 4) out.add(t.slice(0, -1));
    else if (t.length >= 3 && !t.endsWith('s')) out.add(t + 's');

    // 3. Ekspansi padanan dwi-bahasa simetris atas seluruh bentuk akar
    const seeds = [...out];
    for (const s of seeds) {
      const syns = SYMMETRIC_BILINGUAL_BASIS.get(s);
      if (syns) {
        for (const syn of syns) out.add(syn);
      }
    }
    return out;
  }

  const IR_STOPWORDS = new Set([
    ...STOPWORDS_AND_VERBS,
    'cari', 'carikan', 'coba', 'tolong', 'internet', 'google', 'find', 'look',
    'terbaru', 'terkini', 'hari', 'minggu', 'bulan', 'tahun', 'sekarang', 'saat', 'latest', 'recent',
    'today', 'week', 'month', 'year', 'now', 'current', 'new', 'baru', 'from', 'different', 'makes', 'make', 'what', 'which', 'how', 'does', 'do'
  ]);

  function parseAuthenticTimestamp(rawDateStr, urlStr = '', bodyStr = '', nowMs = Date.now()) {
    const maxFutureMs = nowMs + 36 * 3600 * 1000;
    const minValidMs = Date.UTC(1995, 0, 1);

    const tryEpoch = (ms) => {
      if (!Number.isFinite(ms)) return null;
      if (ms < minValidMs || ms > maxFutureMs) return null;
      return ms;
    };

    const raw = String(rawDateStr || '').trim();
    if (raw && !/^(?:terkini|baru|latest|recent|today|now|n\/a|unknown|-)$/i.test(raw)) {
      // Relative time expressions: "3 hours ago", "2 days ago", "5 jam lalu"
      const relMatch = raw.match(/(\d+)\s*(detik|menit|jam|hari|minggu|bulan|second|minute|hour|day|week|month)s?\s*(?:yang\s+)?(?:lalu|ago)/i);
      if (relMatch) {
        const val = parseInt(relMatch[1], 10);
        const unit = relMatch[2].toLowerCase();
        const mult = unit.startsWith('det') || unit.startsWith('sec') ? 1000
          : unit.startsWith('men') || unit.startsWith('min') ? 60000
          : unit.startsWith('jam') || unit.startsWith('hour') ? 3600000
          : unit.startsWith('har') || unit.startsWith('day') ? 86400000
          : unit.startsWith('ming') || unit.startsWith('week') ? 7 * 86400000
          : 30 * 86400000;
        const t = tryEpoch(nowMs - val * mult);
        if (t !== null) return t;
      }

      // Pure ISO / RFC-2822 parse (reject bare 4-digit year string alone as ambiguous)
      if (!/^\d{4}$/.test(raw)) {
        const parsed = Date.parse(raw);
        const valid = tryEpoch(parsed);
        if (valid !== null) return valid;
      }

      // Indonesian / textual date in rawDateStr (e.g., "30 Oktober 2026")
      const coords = extractCalendarDateCoordinates(raw);
      if (coords.length > 0 && coords[0].year) {
        const c = coords[0];
        const valid = tryEpoch(Date.UTC(c.year, c.month - 1, c.day || 15, 12, 0, 0));
        if (valid !== null) return valid;
      }
    }

    // Extract from URL path: /2026/10/30/ or -20261029- or /2026-10-30
    const u = String(urlStr || '');
    if (u) {
      const urlYmd = u.match(/(?:\/|[-_])(20[0-2]\d)[\/\-_](0[1-9]|1[0-2])[\/\-_](0[1-9]|[12]\d|3[01])(?:\/|[-_.]|$)/);
      if (urlYmd) {
        const valid = tryEpoch(Date.UTC(parseInt(urlYmd[1], 10), parseInt(urlYmd[2], 10) - 1, parseInt(urlYmd[3], 10), 12, 0, 0));
        if (valid !== null) return valid;
      }
      const urlCompact = u.match(/(?:\/|[-_])(20[0-2]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[-_/.]|$)/);
      if (urlCompact) {
        const valid = tryEpoch(Date.UTC(parseInt(urlCompact[1], 10), parseInt(urlCompact[2], 10) - 1, parseInt(urlCompact[3], 10), 12, 0, 0));
        if (valid !== null) return valid;
      }
      const urlYm = u.match(/\/(20[0-2]\d)\/(0[1-9]|1[0-2])\//);
      if (urlYm) {
        const valid = tryEpoch(Date.UTC(parseInt(urlYm[1], 10), parseInt(urlYm[2], 10) - 1, 15, 12, 0, 0));
        if (valid !== null) return valid;
      }
    }

    // Extract from leading article body header (first 400 chars often contain byline date)
    const head = String(bodyStr || '').slice(0, 450);
    if (head) {
      const coords = extractCalendarDateCoordinates(head);
      const withYear = coords.find(c => c.year && c.hasDay);
      if (withYear) {
        const valid = tryEpoch(Date.UTC(withYear.year, withYear.month - 1, withYear.day, 12, 0, 0));
        if (valid !== null) return valid;
      }
    }

    return null;
  }

  function extractCalendarDateCoordinates(text, fallbackYear = null) {
    const s = String(text || '');
    if (!s) return [];
    const results = [];
    const seen = new Set();

    const pushCoord = (year, month, day, hasDay, raw) => {
      const y = year ? parseInt(year, 10) : fallbackYear;
      const m = parseInt(month, 10);
      const d = hasDay ? parseInt(day, 10) : 15;
      if (!m || m < 1 || m > 12 || d < 1 || d > 31) return;
      if (y && (y < 1990 || y > 2099)) return;
      const epochDays = y ? Math.floor(Date.UTC(y, m - 1, d) / 86400000) : null;
      const key = `${y || '?'}-${m}-${hasDay ? d : 'M'}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ year: y || null, month: m, day: hasDay ? d : null, hasDay, epochDays, raw: raw.trim() });
      }
    };

    const monthPat = Object.keys(MONTH_INDEX_MAP).join('|');

    // 1. ISO YYYY-MM-DD or YYYY/MM/DD
    const isoRe = /\b(20[0-3]\d)[-\/](0[1-9]|1[0-2])[-\/](0[1-9]|[12]\d|3[01])\b/g;
    let m;
    while ((m = isoRe.exec(s)) !== null) {
      pushCoord(m[1], m[2], m[3], true, m[0]);
    }

    // 2. DD Month [YYYY] (Indonesian & RFC: "12 Oktober 2026", "5 Okt", "30 Oct 2026")
    const dmyRe = new RegExp(`\\b([0-3]?\\d)\\s+(${monthPat})(?:[.,]?\\s*(20[0-3]\\d))?\\b`, 'gi');
    while ((m = dmyRe.exec(s)) !== null) {
      const dayNum = parseInt(m[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const monIdx = MONTH_INDEX_MAP[m[2].toLowerCase()];
        if (monIdx) pushCoord(m[3] || fallbackYear, monIdx, dayNum, true, m[0]);
      }
    }

    // 3. Month DD[, YYYY] (English: "October 30, 2026", "Oct 27")
    const mdyRe = new RegExp(`\\b(${monthPat})\\.?\\s+([0-3]?\\d)(?:st|nd|rd|th)?(?:\\s*,?\\s*(20[0-3]\\d))?\\b`, 'gi');
    while ((m = mdyRe.exec(s)) !== null) {
      const dayNum = parseInt(m[2], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        const monIdx = MONTH_INDEX_MAP[m[1].toLowerCase()];
        if (monIdx) pushCoord(m[3] || fallbackYear, monIdx, dayNum, true, m[0]);
      }
    }

    // 4. Month YYYY without day ("Sep 2026", "September 2026", "Oktober 2026")
    const myRe = new RegExp(`\\b(${monthPat})\\.?\\s+(20[0-3]\\d)\\b`, 'gi');
    while ((m = myRe.exec(s)) !== null) {
      const monIdx = MONTH_INDEX_MAP[m[1].toLowerCase()];
      if (monIdx) pushCoord(m[2], monIdx, 15, false, m[0]);
    }

    return results;
  }

  function extractVersionedEntityAnchors(text) {
    const s = String(text || '');
    if (!s) return [];
    const anchors = new Set();

    // 1. Formal morphological <Entity>[ -]<Version> extractor:
    //    Matches e.g. "Claude 3.7", "Claude 3.5", "Claude 3 Opus", "Gemma 4", "Genie 4",
    //    "Llama 4", "Large 4", "GPT-6.1", "GPT-5", "GPT-4o", "Qwen 2.5", "DeepSeek-V3", "DeepSeek R1", "Gemini 2.0"
    const entityVerRe = /\b([A-Za-z][A-Za-z0-9]{1,18})(?:[\s\-]+)(v?\d+(?:\.\d+)*[a-z]?|r[12]\b|v[1-9](?:\.\d+)?)\b/gi;
    let m;
    while ((m = entityVerRe.exec(s)) !== null) {
      const ent = m[1].toLowerCase();
      let ver = m[2].toLowerCase();
      if (GENERIC_NON_ENTITY_WORDS.has(ent)) continue;
      if (STOPWORDS_AND_VERBS.has(ent) || LOW_ENTROPY_FILLERS.has(ent)) continue;
      // Ignore 4-digit calendar years (1990-2039) and parameter/context sizes (70b, 31b, 128k, 100m)
      if (/^(?:19\d\d|20[0-3]\d)$/.test(ver)) continue;
      if (/^\d+(?:\.\d+)?[bkmgt]$/i.test(ver) && !/^v\d/i.test(ver)) continue;
      // Ignore pure counts >= 25 unless decimal or prefixed with v/r (versions are typically 1..24 or x.y)
      if (/^\d+$/.test(ver) && parseInt(ver, 10) > 24) continue;
      ver = ver.replace(/^v(?=\d)/, '');
      // Normalize trailing .0 (e.g. "2.0" -> "2" so "Gemini 2.0" == "Gemini 2")
      ver = ver.replace(/^(\d+)\.0$/, '$1');
      anchors.add(`${ent}:${ver}`);
    }

    // 2. Standalone reasoning / frontier shorthand model codes: o1, o3, o4-mini, r1
    const codeRe = /\b(o1(?:-mini|-pro|-preview)?|o3(?:-mini|-pro)?|o4(?:-mini)?)\b/gi;
    while ((m = codeRe.exec(s)) !== null) {
      const baseCode = m[1].toLowerCase().split('-')[0];
      anchors.add(`code:${baseCode}`);
    }

    return [...anchors];
  }

  // ============================================================================
  // 15B. OPERATOR REVISI ANAPHORA KUIS & PENGHAPUSAN HIPOTESIS SALAH (BAYESIAN HYPOTHESIS PRUNER)
  // Mendeteksi kueri pengguna yang meminta penggantian/koreksi jawaban kuis
  // (misal "ganti", "ganti jawabannya", "bukan itu", "salah, coba yang lain").
  // Information Gain pencarian web adalah nol (IG(Search|Q) = 0) sehingga pencarian web
  // DIBLOKIR TOTAL dan model diperintahkan memfalsifikasi jawaban lama (P(h_prev) = 0)
  // serta mengevaluasi sisa opsi alternatif.
  // ============================================================================
  const QUIZ_REVISION_EXACT_REGEX = /^(?:\s*(?:ganti|ubah|tukar|pilihkan\s+(?:yang\s+)?lain|coba\s+(?:yang\s+)?lain|bukan\s+(?:itu|yang\s+ini|yang\s+tadi)|salah\b|opsi\s+lain|jawaban\s+lain|alternatif\s+lain|jawaban\s+kedua|nomor\s+lain|ganti\s+(?:opsi|jawaban|pilihan)|bukan\s+[A-Fa-f]|change\s+(?:the\s+)?answer|try\s+another|pick\s+another|switch\s+(?:to|answer)|not\s+that|wrong|incorrect)\s*[!?.~,"'`]*)+$/i;

  const QUIZ_FAILURE_FEEDBACK_REGEX = /\b(?:anda\s+)?(?:tidak|belum)\s+lulus\b|\b(?:gagal|failed|fail|not\s+passing|re-?take|retake)\b|\b(?:your\s+score|skor(?:\s+anda)?|score|nilai(?:\s+saya)?|passing(?:\s+grade|\s+score)?)\s*(?:is|:|=|adalah)?\s*"?\s*\d{1,3}\s*%/i;

  const QUIZ_REVISION_PHRASE_REGEX = /\b(?:ganti\s+(?:jawabannya|jawaban|opsi|pilihan)|coba\s+ganti|salah\s+ganti|bukan\s+itu|jawaban\s+(?:lain|kedua|baru|yang\s+benar|berikutnya)|pilih\s+(?:yang\s+)?lain|opsi\s+lain|alternatif\s+lain|jawaban\s+salah|salah\s+(?:jawabannya|opsinya|pilihannya)|koreksi\s+(?:jawabannya|pilihan)|revisi\s+jawaban|change\s+(?:the\s+)?answer|switch\s+(?:the\s+)?option|try\s+another\s+option|wrong\s+answer)\b/i;

  function stripInjectedSystemTagsFromUserText(text) {
    if (!text || typeof text !== 'string') return '';
    let out = text.trim();
    if (out.startsWith('[Instruksi Sistem & Konteks:')) {
      const lastBracketIdx = out.lastIndexOf(']\n\n');
      if (lastBracketIdx !== -1) {
        out = out.slice(lastBracketIdx + 3).trim();
      } else {
        out = out.replace(/^\[Instruksi Sistem & Konteks:[\s\S]*?\]\s*/i, '').trim();
      }
    }
    out = out
      .replace(/\n*\[PANDUAN RESONANSI PERSONA SISTEM[\s\S]*$/i, '')
      .replace(/\n*\[PROYEKSI RUANG KEADAAN REVISI[\s\S]*$/i, '')
      .replace(/\n*\[PROYEKSI OPERATOR ANAPHORA[\s\S]*$/i, '')
      .replace(/\[(?:Model Penjawab|Model|AI Model|Konteks Percakapan|Konteks Silsilah|Konteks Internal|Catatan Konteks):[^\]]*\]\s*/gi, '')
      .trim();
    return out;
  }

  function isRevisionQuery(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = stripInjectedSystemTagsFromUserText(text);
    if (!clean || clean.length > 350) return false;
    const lower = clean.toLowerCase();

    // Guard: Jika ini adalah soal kuis asli yang menanyakan pernyataan yang "salah/incorrect"
    const isOriginalQuizQuestion = /\b(?:manakah|yang\s+mana|apakah|pernyataan\s+berikut|di\s+bawah\s+ini|which\s+(?:of\s+the\s+following|statement)|what\s+is)\b/i.test(lower) ||
      (/\?/.test(lower) && /\b(?:salah|incorrect|false|kecuali|except|not)\b/i.test(lower) && lower.split(/\s+/).length >= 5) ||
      (/^(?:\(?[A-Fa-f]\)|[A-Fa-f][.)]\s+)/m.test(clean) && clean.split(/\r?\n/).length >= 3);

    if (isOriginalQuizQuestion) return false;

    const QUIZ_REVISION_EXACT_REGEX = /^(?:\s*(?:ganti|ubah|tukar|pilihkan\s+(?:yang\s+)?lain|coba\s+(?:yang\s+)?lain|bukan\s+(?:itu|yang\s+ini|yang\s+tadi)|salah\b|masih\s+salah|opsi\s+lain|jawaban\s+lain|alternatif\s+lain|jawaban\s+kedua|nomor\s+lain|ganti\s+(?:opsi|jawaban|pilihan)|bukan\s+[A-Fa-f]|change\s+(?:the\s+)?answer|try\s+another|pick\s+another|switch\s+(?:to|answer)|not\s+that|wrong|incorrect)\s*[!?.~,"'`]*)+$/i;
    const QUIZ_FAILURE_FEEDBACK_REGEX = /\b(?:anda\s+)?(?:tidak|belum)\s+lulus\b|\b(?:gagal|failed|fail|not\s+passing|re-?take|retake)\b|\b(?:your\s+score|skor(?:\s+anda)?|score|nilai(?:\s+saya)?|passing(?:\s+grade|\s+score)?)\s*(?:is|:|=|adalah)?\s*"?\s*\d{1,3}\s*%/i;
    const QUIZ_REVISION_PHRASE_REGEX = /\b(?:ganti\s+(?:jawabannya|jawaban|opsi|pilihan)|coba\s+ganti|salah\s+ganti|masih\s+salah|bukan\s+itu|jawaban\s+(?:lain|kedua|baru|yang\s+benar|berikutnya)|pilih\s+(?:yang\s+)?lain|opsi\s+lain|alternatif\s+lain|jawaban\s+salah|salah\s+(?:jawabannya|opsinya|pilihannya)|koreksi\s+(?:jawabannya|pilihan)|revisi\s+jawaban|change\s+(?:the\s+)?answer|switch\s+(?:the\s+)?option|try\s+another\s+option|wrong\s+answer)\b/i;

    if (QUIZ_REVISION_EXACT_REGEX.test(clean)) return true;
    if (QUIZ_FAILURE_FEEDBACK_REGEX.test(clean)) return true;
    if (QUIZ_REVISION_PHRASE_REGEX.test(clean)) return true;

    const hasErrorToken = /\b(?:salah+|slh|keliru|bukan|salahnya|salahk?an|wrong|incorrect|false|err|error)\b|not\s+(?:that|this|the\s+one|right|correct)/i.test(lower);
    const hasChangeToken = /\b(?:gant+i+|ubah+|tukar+|pili+h+|coba+|cari+|gnti|plh|change|switch|replace|retry|another|next|alternative|alternatif|try)\b/i.test(lower);
    const hasPriorToken = /\b(?:tadi+|barusan|sudah+|udah+|sdh|pernah|kemarin|sebelumnya|earlier|already|prev|previous|lagi)\b/i.test(lower);
    const hasOptionToken = /\b(?:jawaban+|jawabannya+|jwbn+|opsi+|opsinya+|pilihan+|pilihannya+|soal+|kuis+|quiz|option|choice|answer)\b/i.test(lower);
    const hasPersonalOrDemonstrative = /\b(?:saya|aku|gua|gw|kamu|anda|mu|itu|ini|yg\s+ini|yang\s+ini|yg\s+itu|yang\s+itu|tadi)\b/i.test(lower);

    // Kombinasi 1: Error + Ganti (misal: "salah itu saya sudah piliih tadi ganti", "salah ganti", "salah coba yang lain")
    if (hasErrorToken && hasChangeToken) return true;

    // Kombinasi 2: Error + Rujukan tadi/sudah/saya (misal: "salah itu saya sudah pilih", "tadi salah", "salah yang tadi", "jawaban ini salah")
    if (hasErrorToken && (hasPriorToken || (hasOptionToken && hasPersonalOrDemonstrative) || (hasPersonalOrDemonstrative && clean.length <= 60))) return true;

    // Kombinasi 3: Ganti + Opsi / lain / tadi (misal: "ganti opsi", "coba opsi lain", "pilih yang lain", "ganti yang tadi")
    if (hasChangeToken && (hasOptionToken || hasPriorToken || /\blain\b/i.test(lower))) return true;

    // Kombinasi 4: Kalimat pendek (<= 60 char) yang diawali atau didominasi penolakan
    if (clean.length <= 60 && /^(?:(?:aduh\s+|wah\s+|yah\s+|kok\s+|masih\s+)?salah\b|bukan\s+(?:itu|yang\s+ini|ini)|ternyata\s+salah|salah\s+semua)/i.test(lower)) return true;

    if (/\b(?:skor|score|nilai)\b/i.test(lower) && /\b\d{1,2}%\b/.test(lower)) return true;

    return false;
  }

  const QUIZ_INSTRUCTION_LINE_REGEX = /^(?:select|choose|pilih(?:lah)?|mark|check|centang)\s+(?:the\s+)?(?:all|one|two|three|four|five|\d+|satu|dua|tiga|empat|semua)(?:\s+(?:that|which)\s+apply|\s+correct|\s+options?|\s+answers?|\s+statements?|\s+jawaban|\s+opsi|\s+pilihan|\s+pernyataan)?(?:\s+yang\s+(?:benar|tepat|sesuai))?[.:!]?$/i;

  function isPostHocProjectionQuery(text) {
    if (!text || typeof text !== 'string') return null;
    const clean = stripInjectedSystemTagsFromUserText(text).trim();
    if (!clean || clean.length > 120) return null;
    if (isRevisionQuery(clean)) return null;
    const lower = clean.toLowerCase();

    // Guard: Abaikan sapaan murni atau soal kuis baru yang memiliki banyak baris
    if (/^(?:halo|hai|hi|hello|pagi|siang|sore|malam|tes|test|ping|ok|oke|makasih|terima\s+kasih|thanks|lanjut|next)[\s!.,?]*$/i.test(clean)) {
      return null;
    }
    if (clean.split(/\r?\n/).filter(Boolean).length >= 3) return null;

    // 1. Operator Proyeksi Indeks Huruf / Nomor (\hat{P}_{index}: "abcd sja", "abcd saja", "hurufnya saja", "a b c d", "123 saja")
    const isIndexLetter = /^(?:\s*(?:tolong|coba|mohon|pakai|gunakan|jawab(?:annya)?|tulis(?:kan)?|berikan|kasih|cukup|hanya|dalam|format|opsi|pilihan|huruf|angka|nomor)\s+)*(?:a\s*[,/.\-\s]*b\s*[,/.\-\s]*c(?:\s*[,/.\-\s]*d)?(?:\s*[,/.\-\s]*e)?|abcd(?:e)?|huruf(?:nya)?(?:\s+saja|\s+aja)?|abjad(?:nya)?(?:\s+saja|\s+aja)?|1\s*[,/.\-\s]*2\s*[,/.\-\s]*3(?:\s*[,/.\-\s]*4)?|nomor(?:nya)?\s+(?:saja|aja)|angka(?:nya)?\s+(?:saja|aja)|letter(?:s)?\s+only)(?:\s+(?:saja|aja|sja|sj|ya|dong|please|only))?[\s!.,?]*$/i.test(clean)
      || /\b(?:abcd(?:e)?\s*(?:saja|sja|aja|sj|only)?|(?:huruf|abjad)(?:nya)?\s+(?:saja|sja|aja|sj)|jawab\s+(?:pakai\s+|dengan\s+)?abcd)\b/i.test(lower);
    if (isIndexLetter) {
      return { isPostHoc: true, type: 'index_letter', raw: clean };
    }

    // 2. Operator Proyeksi Kompresi / Jawaban Langsung (\hat{P}_{concise}: "singkat saja", "intinya saja", "langsung jawabannya")
    const isConcise = /^(?:\s*(?:tolong|coba|mohon|langsung|cukup|hanya|kasih|berikan|tulis(?:kan)?|jawab(?:annya)?|ambil|pilih)\s+)*(?:singkat(?:\s+saja|\s+sja|\s+aja)?|intinya(?:\s+saja|\s+sja|\s+aja)?|poin(?:nya)?(?:\s+saja|\s+sja|\s+aja)?|kesimpulan(?:nya)?(?:\s+saja|\s+sja|\s+aja)?|jawaban(?:nya)?\s+(?:saja|sja|aja|langsung)|langsung\s+(?:jawaban(?:nya)?|intinya)|tanpa\s+penjelasan|to\s+the\s+point|short\s+answer|just\s+the\s+answer)[\s!.,?]*$/i.test(clean);
    if (isConcise) {
      return { isPostHoc: true, type: 'concise', raw: clean };
    }

    // 3. Operator Ekspansi Epistemik (\hat{P}_{expand}: "jelaskan", "kenapa begitu", "apa alasannya")
    const isExpand = /^(?:\s*(?:tolong|coba|mohon|bisa)\s+)*(?:jelaskan(?:\s+lebih\s+detail|\s+kenapa|\s+mengapa|\s+itu|\s+tadi)?|kenapa(?:\s+begitu|\s+itu|\s+bisa\s+begitu|\s+jawabannya\s+itu|\s+pilih\s+itu)?|mengapa(?:\s+demikian|\s+begitu|\s+itu)?|apa\s+alasannya|alasannya(?:\s+apa)?|uraikan(?:\s+lebih\s+lengkap)?|lebih\s+(?:lengkap|detail)|explain(?:\s+why)?|why(?:\s+is\s+that)?)[\s!.,?]*$/i.test(clean);
    if (isExpand) {
      return { isPostHoc: true, type: 'expand', raw: clean };
    }

    // 4. Operator Translasi Bahasa (\hat{P}_{translate}: "bahasa indonesia", "terjemahkan", "indo saja")
    const isTranslate = /^(?:\s*(?:tolong|coba|ubah|ganti|terjemahkan|translate|artikan)\s+)*(?:(?:ke\s+|dalam\s+)?bahasa\s+(?:indonesia|inggris)|indo(?:nesia)?(?:\s+saja|\s+sja|\s+aja)?|english(?:\s+only|\s+please)?|terjemahkan(?:\s+itu|\s+tadi|\s+ke\s+indonesia)?)[\s!.,?]*$/i.test(clean);
    if (isTranslate) {
      return { isPostHoc: true, type: 'translate', raw: clean };
    }

    return null;
  }

  function extractCandidateOptionsFromTextBlock(textBlock, isAssistantText = false) {
    if (!textBlock || typeof textBlock !== 'string') return [];
    const lines = textBlock.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    // 1. Cek opsi berlabel eksplisit (A., B., C., D. atau (A), (B), 1., 2.)
    const labeled = [];
    for (const l of lines) {
      const cl = l.replace(/^[-*•]\s+/, '').trim();
      if (/^(?:\(?[A-Fa-f]\)|[A-Fa-f][.)]\s+|\([1-6]\)\s+|[1-6][.)]\s+\S)/.test(cl)) {
        // Hindari judul sub-bab bernomor pada teks asisten seperti "1. Inti Program" jika diikuti paragraf panjang
        if (isAssistantText && /^[1-6]\.\s+\*\*/.test(cl)) continue;
        labeled.push(cl.replace(/\*\*/g, '').trim());
      }
    }
    if (labeled.length >= 2) return labeled;

    if (!isAssistantText) {
      // Pada teks soal pengguna tanpa label huruf: pisahkan baris kalimat tanya utama & sub-instruksi ("Select the three that apply.") dari baris-baris opsi di bawahnya
      let qIdx = lines.findIndex(l => /\?\s*$/.test(l) || /:\s*$/.test(l) || /\.\.\.\s*$/.test(l) || /\b(?:which|what|manakah|berikut|following|pilih|select|choose|pernyataan)\b/i.test(l));
      while (qIdx !== -1 && qIdx + 1 < lines.length && (QUIZ_INSTRUCTION_LINE_REGEX.test(lines[qIdx + 1]) || /\?\s*$/.test(lines[qIdx + 1]) || /:\s*$/.test(lines[qIdx + 1]))) {
        qIdx++;
      }
      const candidatePool = (qIdx !== -1 && lines.length >= qIdx + 3) ? lines.slice(qIdx + 1) : lines;
      const unlabeled = candidatePool
        .map(l => l.replace(/^[-*•]\s+/, '').trim())
        .filter(l => {
          if (/^(?:jawab|berikan|pilih|tuliskan)\s+(?:singkat|langsung|hanya|saja|jawaban)/i.test(l)) return false;
          if (QUIZ_INSTRUCTION_LINE_REGEX.test(l)) return false;
          const wc = l.split(/\s+/).filter(Boolean).length;
          return wc >= 1 && wc <= 36 && !/\?\s*$/.test(l);
        });
      if (unlabeled.length >= 2) return unlabeled;
    } else {
      // Pada teks analisis asisten (misal soal berasal dari gambar/screenshot):
      // Ekstrak baris daftar aktivitas/opsi seperti "Removing redundant data -> Data Preparation" atau bullet "- Opsi"
      const extracted = [];
      for (const l of lines) {
        const arrowMatch = l.match(/^[-*•]?\s*([A-Z][^:\n\r—–\->]{3,85}?)\s+(?:->|→|—|–|\s{2,})\s*(?:Data\s+|Benar|Salah|True|False|[A-Z])/);
        if (arrowMatch && arrowMatch[1]) {
          const cand = arrowMatch[1].replace(/[*`"']/g, '').trim();
          if (cand.split(/\s+/).length <= 18 && !extracted.includes(cand)) {
            extracted.push(cand);
          }
          continue;
        }
        const bulletOpt = l.match(/^[-*•]\s+\*\*([^*]{3,85})\*\*/);
        if (bulletOpt && bulletOpt[1]) {
          const cand = bulletOpt[1].trim();
          if (cand.split(/\s+/).length <= 18 && !extracted.includes(cand)) {
            extracted.push(cand);
          }
        }
      }
      // Cek juga apakah ada opsi komposit yang dikutip di teks asisten (misal "All of the above...")
      const quotedMatches = textBlock.match(/["“]((?:All|None)\s+of\s+the\s+above[^"”\n]{0,70}|Semua\s+(?:jawaban|pernyataan|pilihan)\s+(?:di\s+atas\s+)?(?:benar|salah)[^"”\n]{0,40})["”]/gi) || [];
      for (const qm of quotedMatches) {
        const cleanQ = qm.replace(/^["“]|["”]$/g, '').trim();
        if (cleanQ && !extracted.some(e => e.toLowerCase().includes(cleanQ.toLowerCase()) || cleanQ.toLowerCase().includes(e.toLowerCase()))) {
          extracted.push(cleanQ);
        }
      }
      if (extracted.length >= 2) return extracted;
    }
    return [];
  }

  function identifyChosenOptionsInAssistantTurn(asstText, candidateOptions = []) {
    if (!asstText || typeof asstText !== 'string') {
      return { chosenOptions: [], chosenLetters: [], primaryOption: '' };
    }
    const cleanAsst = asstText.trim();
    const chosenOptions = [];
    const chosenLetters = [];

    if (Array.isArray(candidateOptions) && candidateOptions.length >= 2) {
      const asstLines = cleanAsst.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      candidateOptions.forEach((opt, idx) => {
        const letter = String.fromCharCode(65 + idx);
        const cOpt = opt.replace(/^(?:\(?[A-Fa-f]\)|[A-Fa-f][.)\s-]+|\([1-6]\)\s+|[1-6][.)]\s+)/, '').toLowerCase().trim();
        if (!cOpt) return;
        const shortAnchor = cOpt.split(/\s+/).slice(0, 6).join(' ');

        // Cek apakah baris asisten menyebut opsi ini secara afirmatif (bukan baris yang menyatakan opsi tersebut salah/incorrect)
        let isAffirmed = false;
        for (const line of asstLines) {
          const lowerLine = line.toLowerCase().replace(/[*`"']/g, '');
          const hasMatch = (cOpt.length >= 4 && lowerLine.includes(cOpt)) || (shortAnchor.length >= 14 && lowerLine.includes(shortAnchor));
          if (hasMatch) {
            const isNegatedLine = /\b(?:salah|incorrect|false|tidak\s+tepat|bukan\s+jawaban|eliminasi)\b/i.test(lowerLine) && !/\b(?:adalah\s+salah\s+satu\s+yang\s+benar|tidak\s+salah)\b/i.test(lowerLine);
            if (!isNegatedLine) {
              isAffirmed = true;
              break;
            }
          }
        }
        if (isAffirmed) {
          chosenOptions.push(opt);
          chosenLetters.push(letter);
        }
      });

      // Jika asisten hanya menjawab dengan huruf eksplisit (misal "A, B, D" atau "Jawaban: C")
      if (chosenOptions.length === 0) {
        const letterOnlyMatch = cleanAsst.match(/^(?:jawaban(?:nya)?\s*[:=-]?\s*)?([A-Fa-f](?:\s*(?:,|dan|and|&|\s)\s*[A-Fa-f])*)\s*[.!]*$/i);
        if (letterOnlyMatch && letterOnlyMatch[1]) {
          const letters = letterOnlyMatch[1].toUpperCase().match(/[A-F]/g) || [];
          for (const L of letters) {
            const idx = L.charCodeAt(0) - 65;
            if (idx >= 0 && idx < candidateOptions.length && !chosenLetters.includes(L)) {
              chosenLetters.push(L);
              chosenOptions.push(candidateOptions[idx]);
            }
          }
        }
      }
    }

    if (chosenOptions.length > 0) {
      return {
        chosenOptions,
        chosenLetters,
        primaryOption: chosenOptions.join(' | ')
      };
    }

    // Fallback tunggal
    const single = identifyChosenOptionInAssistantTurn(cleanAsst, candidateOptions);
    if (single && Array.isArray(candidateOptions) && candidateOptions.length >= 2) {
      const idx = candidateOptions.findIndex(o => o === single || o.toLowerCase().includes(single.toLowerCase()));
      if (idx !== -1) {
        return {
          chosenOptions: [candidateOptions[idx]],
          chosenLetters: [String.fromCharCode(65 + idx)],
          primaryOption: candidateOptions[idx]
        };
      }
    }
    return {
      chosenOptions: single ? [single] : [],
      chosenLetters: [],
      primaryOption: single || ''
    };
  }

  function identifyChosenOptionInAssistantTurn(asstText, candidateOptions = []) {
    if (!asstText || typeof asstText !== 'string') return '';
    const cleanAsst = asstText.trim();

    // 1. Cek pola rekomendasi eksplisit yang diikuti "adalah" atau ":" (dan bukan kalimat negasi "tidak memiliki jawaban")
    const explicitRecMatch =
      cleanAsst.match(/(?<!tidak\s+memiliki\s+)(?:jawaban\s+yang\s+(?:diharapkan|paling\s+tepat|benar|direkomendasikan|harus\s+dipilih)|pilihan\s+yang\s+(?:paling\s+)?(?:tepat|benar)|rekomendasi\s+utama)\s*(?:adalah|ialah|:)\s*["“*]*([^"”*\n\r.(]{3,100})["”*]*/i) ||
      cleanAsst.match(/^(?:(?:\*\*|\*|\[)?(?:Jawaban|Opsi|Pilihan)?\s*[A-Da-d](?:[.)\]]|\*\*)?)\s+([^\n\r]+)/m);

    if (explicitRecMatch && explicitRecMatch[1]) {
      const recStr = explicitRecMatch[1].replace(/[*[\]"“”']/g, '').trim();
      if (candidateOptions.length >= 2) {
        const matchedOpt = candidateOptions.find(opt => {
          const cOpt = opt.replace(/^[A-Fa-f][.)\s-]+/, '').toLowerCase().trim();
          const cRec = recStr.replace(/^[A-Fa-f][.)\s-]+/, '').toLowerCase().trim();
          return cOpt === cRec || cOpt.includes(cRec) || cRec.includes(cOpt);
        });
        if (matchedOpt) return matchedOpt;
      }
      return recStr;
    }

    // 2. Jika ada candidateOptions, cari opsi yang disebut pada 40% bagian akhir pesan asisten (kesimpulan)
    if (candidateOptions.length >= 2) {
      const tailSlice = cleanAsst.slice(Math.floor(cleanAsst.length * 0.60)).toLowerCase();
      for (const opt of candidateOptions) {
        const cOpt = opt.replace(/^[A-Fa-f][.)\s-]+/, '').toLowerCase().trim();
        const shortAnchor = cOpt.split(/\s+/).slice(0, 4).join(' ');
        if ((cOpt.length >= 4 && tailSlice.includes(cOpt)) || (shortAnchor.length >= 10 && tailSlice.includes(shortAnchor))) {
          return opt;
        }
      }
      // Fallback ke baris pertama jika baris pertama langsung menyebut salah satu opsi
      const firstLine = cleanAsst.split(/\r?\n/)[0].toLowerCase();
      for (const opt of candidateOptions) {
        const cOpt = opt.replace(/^[A-Fa-f][.)\s-]+/, '').toLowerCase().trim();
        if (cOpt.length >= 4 && firstLine.includes(cOpt)) {
          return opt;
        }
      }
    }

    return cleanAsst.slice(0, 90).replace(/\n.*/s, '').replace(/[*[\]"']/g, '').trim();
  }

  function extractParentQuizContext(sessionOrMessages, fallbackSessions = null) {
    let rawList = Array.isArray(sessionOrMessages?.messages) ? sessionOrMessages.messages : (Array.isArray(sessionOrMessages) ? sessionOrMessages : []);
    // Cross-session bridge: jika sesi baru belum memiliki balasan asisten, ambil konteks dari sesi aktif terakhir sebelumnya
    if ((!rawList || !rawList.some(m => m && m.role === 'assistant' && m.content)) && Array.isArray(fallbackSessions) && fallbackSessions.length > 0) {
      for (const s of fallbackSessions) {
        if (s && !s.isIncognito && Array.isArray(s.messages) && s.messages.some(m => m && m.role === 'assistant' && m.content)) {
          rawList = s.messages;
          break;
        }
      }
    }
    if (!rawList || rawList.length < 2) return null;

    let lastAsstMsg = '';
    let lastAsstIdx = -1;
    for (let i = rawList.length - 1; i >= 0; i--) {
      if (rawList[i] && rawList[i].role === 'assistant' && rawList[i].content) {
        lastAsstIdx = i;
        lastAsstMsg = String(rawList[i].content).trim();
        break;
      }
    }
    if (lastAsstIdx === -1 || !lastAsstMsg) return null;

    // Cari giliran pengguna induk (soal asli) dengan melewati giliran-giliran revisi ("salah ganti") maupun post-hoc format ("abcd sja")
    let parentUserMsg = null;
    let parentUserIdx = -1;
    let candidateOptions = [];
    for (let i = lastAsstIdx - 1; i >= 0; i--) {
      if (rawList[i] && rawList[i].role === 'user' && rawList[i].content) {
        const uText = stripInjectedSystemTagsFromUserText(String(rawList[i].content || ''));
        if (!uText || isRevisionQuery(uText) || isPostHocProjectionQuery(uText)) continue;
        const opts = extractCandidateOptionsFromTextBlock(uText, false);
        if (opts.length >= 2) {
          parentUserMsg = rawList[i];
          parentUserIdx = i;
          candidateOptions = opts;
          break;
        }
        if (!parentUserMsg) {
          parentUserMsg = rawList[i];
          parentUserIdx = i;
          candidateOptions = opts;
        }
      }
    }

    // Jika soal asli berupa gambar atau opsi belum terekstrak dari teks user, ekstrak dari pesan asisten
    if (candidateOptions.length < 2) {
      const startScanIdx = parentUserIdx !== -1 ? parentUserIdx + 1 : lastAsstIdx;
      for (let j = startScanIdx; j <= lastAsstIdx; j++) {
        if (rawList[j] && rawList[j].role === 'assistant' && rawList[j].content) {
          const asstOpts = extractCandidateOptionsFromTextBlock(String(rawList[j].content), true);
          if (asstOpts.length >= 2) {
            candidateOptions = asstOpts;
            break;
          }
        }
      }
    }

    // Kumpulkan seluruh jawaban asisten yang telah terfalsifikasi sejak parentUserIdx
    const falsifiedAnswers = [];
    const startAsstIdx = parentUserIdx !== -1 ? parentUserIdx + 1 : lastAsstIdx;
    for (let j = startAsstIdx; j <= lastAsstIdx; j++) {
      if (rawList[j] && rawList[j].role === 'assistant' && rawList[j].content) {
        const chosen = identifyChosenOptionInAssistantTurn(String(rawList[j].content), candidateOptions);
        if (chosen && !falsifiedAnswers.includes(chosen)) {
          falsifiedAnswers.push(chosen);
        }
      }
    }

    const multiSelection = identifyChosenOptionsInAssistantTurn(lastAsstMsg, candidateOptions);
    const prevChosenLabel = falsifiedAnswers.length > 0
      ? falsifiedAnswers[falsifiedAnswers.length - 1]
      : (multiSelection.primaryOption || identifyChosenOptionInAssistantTurn(lastAsstMsg, candidateOptions));

    const indexedOptions = candidateOptions.map((opt, idx) => {
      const cleanOpt = opt.replace(/^(?:\(?[A-Fa-f]\)|[A-Fa-f][.)\s-]+|\([1-6]\)\s+|[1-6][.)]\s+)/, '').trim();
      return `${String.fromCharCode(65 + idx)}. ${cleanOpt}`;
    });

    return {
      userText: parentUserMsg ? stripInjectedSystemTagsFromUserText(String(parentUserMsg.content || '')) : '',
      lastAsstMsg,
      parentUserIdx,
      lastAsstIdx,
      candidateOptions,
      indexedOptions,
      chosenOptions: multiSelection.chosenOptions,
      chosenLetters: multiSelection.chosenLetters,
      previousAnswer: prevChosenLabel,
      falsifiedAnswers: falsifiedAnswers.length > 0 ? falsifiedAnswers : (prevChosenLabel ? [prevChosenLabel] : [])
    };
  }

  function computeTemporalRecencyProfile(query, contextText = '', nowMs = Date.now()) {
    const q = String(query || '').trim();
    if (isRevisionQuery(q) || isPostHocProjectionQuery(q)) {
      return {
        recencyAlpha: 0.0,
        halfLifeDays: 365,
        lambda: 0.0,
        epistemicSearchTrigger: 0.0,
        targetHistoricalYear: null,
        targetDates: []
      };
    }
    const combined = `${q} ${String(contextText || '')}`.trim();
    const curYear = new Date(nowMs).getUTCFullYear();

    const isCodeOrCreative = /\b(?:html|css|javascript|typescript|python|java|rust|golang|sql|regex|website|landing\s*page|komponen|buatkan\s+(?:kode|script|fungsi|program|puisi|cerpen|cerita|lagu|musik|surat|makalah|dokumen))\b/i.test(q)
      || /<<<ZOZ_FILE|<<<<<<< SEARCH|```/.test(q);

    // Noisy-OR fusion over temporal & epistemic retrieval operators
    const probs = [];
    let halfLifeDays = 365;

    const explicitWebOp = /\b(?:cari(?:kan)?|search|searching|pencarian|tool\s+pencarian|telusuri|browsing|googling|cek\s+di\s+(?:web|internet))\b/i.test(q);
    if (explicitWebOp) {
      probs.push(0.96);
      halfLifeDays = Math.min(halfLifeDays, 21);
    }

    const immediateRecency = /\b(?:hari\s+ini|kemarin|barusan|sekarang|minggu\s+ini|pekan\s+ini|today|yesterday|right\s+now|this\s+week|breaking\s+news)\b/i.test(q);
    if (immediateRecency) {
      probs.push(0.95);
      halfLifeDays = Math.min(halfLifeDays, 10);
    }

    const generalRecency = /\b(?:terbaru|terkini|mutakhir|bulan\s+ini|tahun\s+ini|latest|newest|most\s+recent|this\s+month|current\s+release|rilis\s+.*\bbaru|new\s+release)\b/i.test(q);
    if (generalRecency) {
      probs.push(0.90);
      halfLifeDays = Math.min(halfLifeDays, 18);
    }

    const releaseOrNewsTopic = /\b(?:rilis|peluncuran|berita|kabar|pengumuman|update|pembaruan|harga|kurs|skor|klasemen|jadwal|cuaca|gempa|release|launch|announcement|news|price)\b/i.test(q);
    if (releaseOrNewsTopic) {
      probs.push(0.55);
      halfLifeDays = Math.min(halfLifeDays, 30);
    }

    // Explicit year detection
    const yearMatches = (q.match(/\b(199\d|20[0-3]\d)\b/g) || []).map(Number);
    const hasCurrentYear = yearMatches.includes(curYear);
    const historicalYears = yearMatches.filter(y => y < curYear);

    if (hasCurrentYear) {
      probs.push(0.88);
      halfLifeDays = Math.min(halfLifeDays, 21);
    }

    let targetHistoricalYear = null;
    if (historicalYears.length > 0 && !hasCurrentYear && !immediateRecency && !generalRecency) {
      targetHistoricalYear = historicalYears[0];
    }

    let recencyAlpha = 0.15;
    if (targetHistoricalYear !== null) {
      recencyAlpha = 0.0;
    } else if (probs.length > 0) {
      let complement = 1.0;
      for (const p of probs) complement *= (1.0 - p);
      recencyAlpha = 1.0 - complement;
    }

    // Check contextual continuity (e.g. follow-up turn about recent news)
    if (recencyAlpha < 0.5 && !targetHistoricalYear && /\b(?:terbaru|terkini|latest|2026|oktober|october)\b/i.test(combined)) {
      recencyAlpha = Math.max(recencyAlpha, 0.55);
      halfLifeDays = Math.min(halfLifeDays, 30);
    }

    const lambda = Math.LN2 / Math.max(1, halfLifeDays);
    const epistemicSearchTrigger = isCodeOrCreative ? 0.0 : (explicitWebOp ? 0.98 : recencyAlpha);

    return {
      recencyAlpha: Number(recencyAlpha.toFixed(4)),
      halfLifeDays,
      lambda: Number(lambda.toFixed(6)),
      targetHistoricalYear,
      curYear,
      explicitWebOp,
      epistemicSearchTrigger: Number(epistemicSearchTrigger.toFixed(4))
    };
  }

  function tokenizeForIR(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}._-]/gu, ' ')
      .split(/\s+/)
      .map(t => t.replace(/^[._-]+|[._-]+$/g, ''))
      .filter(t => t.length >= 2);
  }

  function expandQueryTokensMathematically(query, curYear) {
    const rawTokens = tokenizeForIR(query);
    const expanded = new Map();
    for (const t of rawTokens) {
      if (t === String(curYear)) {
        expanded.set(t, 0.25);
        continue;
      }
      if (IR_STOPWORDS.has(t)) continue;
      expanded.set(t, Math.max(expanded.get(t) || 0, 1.0));
      const variants = expandMorphologicalAndBilingualVariants(t);
      for (const v of variants) {
        if (v !== t && !IR_STOPWORDS.has(v)) {
          expanded.set(v, Math.max(expanded.get(v) || 0, 0.85));
        }
      }
    }
    // If all tokens were stopwords/temporal (e.g. "berita terbaru hari ini"), retain core topical tokens
    if (expanded.size === 0) {
      for (const t of rawTokens) {
        if (t.length >= 2) expanded.set(t, 0.7);
      }
    }
    return expanded;
  }

  const GENERIC_IR_MODIFIERS = new Set([
    'harga', 'terbaru', 'terkini', 'berita', 'update', 'jadwal', 'rilis', 'daftar', 'informasi',
    'spesifikasi', 'fitur', 'cara', 'panduan', 'tutorial', 'review', 'ulasan', 'kelebihan',
    'kekurangan', 'biografi', 'profil', 'asal', 'sejarah', 'penyebab', 'dampak', 'solusi',
    'arti', 'makna', 'definisi', 'pengertian', 'perbedaan', 'persamaan', 'perbandingan', 'antara',
    'contoh', 'hasil', 'skor', 'klasemen', 'stat', 'statistik', 'populer', 'viral', 'resmi',
    'official', 'news', 'price', 'specs', 'release', 'date', 'schedule', 'guide', 'history',
    'meaning', 'result', 'hari', 'bulan', 'tahun', 'minggu', 'different', 'difference',
    'differences', 'between', 'versus', 'vs', 'compare', 'comparison', 'custom', 'built',
    'in', 'built-in', 'using', 'use', 'used', 'work', 'works', 'working', 'perkembangan'
  ]);

  function extractEssentialTokensIR(query) {
    const rawTokens = tokenizeForIR(query);
    const content = rawTokens.filter(t => !IR_STOPWORDS.has(t));
    if (content.length === 0) return [];
    const essential = content.filter(t => !GENERIC_IR_MODIFIERS.has(t));
    if (essential.length > 0) return [...new Set(essential)];
    const longer = content.filter(t => t.length >= 4);
    if (longer.length > 0) return [...new Set(longer)];
    return [...new Set(content)];
  }

  function rankDocumentsMathematically(candidates, query, options = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    const nowMs = options.nowMs || Date.now();
    const profile = options.profile || computeTemporalRecencyProfile(query, options.contextText || '', nowMs);
    const queryWeights = expandQueryTokensMathematically(query, profile.curYear);
    const qTerms = [...queryWeights.keys()];
    const essentialTokens = extractEssentialTokensIR(query);
    const essentialVariantsMap = new Map();
    for (const eq of essentialTokens) {
      essentialVariantsMap.set(eq, expandMorphologicalAndBilingualVariants(eq));
    }

    const addTokenWithSubparts = (tfMap, tok) => {
      tfMap.set(tok, (tfMap.get(tok) || 0) + 1);
      if (/[._-]/.test(tok)) {
        for (const sub of tok.split(/[._-]+/)) {
          if (sub.length >= 2) tfMap.set(sub, (tfMap.get(sub) || 0) + 1);
        }
      }
    };

    // Pre-tokenize documents & extract authentic timestamps
    const docs = candidates.map((item) => {
      const title = String(item.title || '');
      const snippet = String(item.snippet || '');
      const content = String(item.content || '');
      const url = String(item.url || item.link || '');
      const rawDate = item.published_at || item.pubDate || item.published_date || item.date || '';

      const titleTokens = tokenizeForIR(title);
      const effectiveSnippet = snippet.length >= 30 ? snippet : `${snippet} ${content.slice(0, 280)}`;
      const snippetTokens = tokenizeForIR(effectiveSnippet);
      const contentTokens = tokenizeForIR(content.slice(0, 4000));
      let urlPathTokens = [];
      try {
        const uObj = new URL(url);
        urlPathTokens = tokenizeForIR(`${uObj.hostname.replace(/^www\./i, '')} ${decodeURIComponent(uObj.pathname)}`);
      } catch (_) {}

      const tfTitle = new Map();
      const tfSnippet = new Map();
      const tfContent = new Map();
      for (const t of titleTokens) addTokenWithSubparts(tfTitle, t);
      for (const t of snippetTokens) addTokenWithSubparts(tfSnippet, t);
      for (const t of urlPathTokens) addTokenWithSubparts(tfSnippet, t);
      for (const t of contentTokens) addTokenWithSubparts(tfContent, t);

      const surfaceTextLower = `${title} ${effectiveSnippet} ${url}`.toLowerCase();
      const docLen = titleTokens.length * 2 + snippetTokens.length + contentTokens.length;
      const verifiedTs = parseAuthenticTimestamp(rawDate, url, `${title} ${snippet} ${content.slice(0, 400)}`, nowMs);
      const ageDays = verifiedTs !== null ? ((nowMs - verifiedTs) / 86400000) : null;

      return {
        item,
        url,
        titleTokens,
        tfTitle,
        tfSnippet,
        tfContent,
        surfaceTextLower,
        docLen: Math.max(1, docLen),
        verifiedTs,
        ageDays
      };
    });

    const N = docs.length;
    const avgdl = docs.reduce((acc, d) => acc + d.docLen, 0) / Math.max(1, N);

    // Compute IDF(q) across candidate corpus
    const idfMap = new Map();
    for (const qt of qTerms) {
      let df = 0;
      for (const d of docs) {
        if (d.tfTitle.has(qt) || d.tfSnippet.has(qt) || d.tfContent.has(qt)) df++;
      }
      // Smooth Robertson-Sparck Jones IDF with floor so shared topical terms in pre-filtered pools stay positive
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5)) + 0.35;
      idfMap.set(qt, idf);
    }

    const freshVerifiedCount = docs.filter(d => d.ageDays !== null && d.ageDays >= -1.5 && d.ageDays <= 60).length;

    const k1 = 1.5;
    const b = 0.75;
    const kappa = 3.2;

    const scored = [];
    for (const d of docs) {
      // 1. Field-weighted Okapi BM25F
      let bm25 = 0;
      let matchedDistinct = 0;
      for (const [qt, qWeight] of queryWeights.entries()) {
        const fT = d.tfTitle.get(qt) || 0;
        const fS = d.tfSnippet.get(qt) || 0;
        const fC = d.tfContent.get(qt) || 0;
        const pseudoFreq = 4.0 * fT + 2.0 * fS + 1.0 * fC;
        if (pseudoFreq > 0) {
          matchedDistinct++;
          const idf = idfMap.get(qt) || 0.5;
          const denom = pseudoFreq + k1 * (1 - b + b * (d.docLen / Math.max(1, avgdl)));
          bm25 += qWeight * idf * ((pseudoFreq * (k1 + 1)) / denom);
        }
      }

      if (bm25 <= 0 || matchedDistinct === 0) {
        if (options.keepCandidateFloor || options.isWhitelistedPool) {
          bm25 = 0.5;
        } else {
          continue;
        }
      }

      // Sublinear Essential Entity Gate \mathcal{G}_{essential}(Q, D) on Surface Representation (Title ∪ Snippet ∪ URL)
      // Mencegah artikel panjang tak relevan lolos hanya karena kata umum tersebar acak di paragraf bawah body 5000 karakter.
      if (essentialTokens.length > 0 && !options.keepCandidateFloor && !options.isWhitelistedPool) {
        let matchedEssentialSurface = 0;
        for (const eq of essentialTokens) {
          const variants = essentialVariantsMap.get(eq) || new Set([eq]);
          let hit = false;
          for (const v of variants) {
            if (d.tfTitle.has(v) || d.tfSnippet.has(v)) {
              hit = true;
              break;
            }
          }
          if (hit) matchedEssentialSurface++;
        }
        const E = essentialTokens.length;
        const minReq = E === 1 ? 1 : (E <= 4 ? 2 : Math.min(4, Math.max(2, Math.ceil(Math.sqrt(E)))));
        if (matchedEssentialSurface < minReq) {
          continue; // Gugurkan kandidat yang tidak memuat entitas esensial pada judul/ringkasan/URL
        }
      }

      // Sequential Dependence Model (Metzler-Croft MRF) Bigram Proximity Bonus
      if (essentialTokens.length >= 2) {
        for (let bi = 0; bi < essentialTokens.length - 1; bi++) {
          const w1 = essentialTokens[bi];
          const w2 = essentialTokens[bi + 1];
          if (d.surfaceTextLower.includes(`${w1} ${w2}`) || d.surfaceTextLower.includes(`${w1}-${w2}`)) {
            bm25 += 1.35;
          }
        }
      }
      const lexNorm = bm25 / (bm25 + kappa);

      // 2. Exponential Radioactive Temporal Decay W_time(Δt) = exp(-λ · Δt)
      let temporalWeight = 1.0;
      if (profile.targetHistoricalYear !== null) {
        if (d.verifiedTs !== null) {
          const docYear = new Date(d.verifiedTs).getUTCFullYear();
          const yearDiff = docYear - profile.targetHistoricalYear;
          temporalWeight = Math.exp(-(yearDiff * yearDiff) / 2.0);
        } else {
          temporalWeight = 0.4;
        }
      } else if (d.ageDays !== null) {
        if (d.ageDays < -1.5) {
          // Causal cone violation (impossible future publication timestamp)
          continue;
        }
        // Hard horizon cutoff when query demands fresh info and fresh documents exist
        if (profile.recencyAlpha >= 0.72 && freshVerifiedCount >= 2 && d.ageDays > 120) {
          continue;
        }
        temporalWeight = Math.exp(-profile.lambda * Math.max(0, d.ageDays));
      } else {
        // Evergreen documentation / encyclopedia / profile pages without news pubDate:
        // Do NOT penalize when query is non-temporal (recencyAlpha < 0.55)
        const combinedLower = `${d.item.title || ''} ${d.item.snippet || ''}`.toLowerCase();
        const mentionsPastYear = /\b(201\d|202[0-5])\b/.test(combinedLower) && !combinedLower.includes(String(profile.curYear));
        if (profile.recencyAlpha >= 0.72) {
          if (mentionsPastYear || freshVerifiedCount >= 3) {
            temporalWeight = mentionsPastYear ? 0.0 : 0.06;
          } else {
            temporalWeight = 0.18;
          }
        } else if (profile.recencyAlpha >= 0.55) {
          temporalWeight = 0.75;
        } else {
          temporalWeight = 1.0;
        }
      }

      if (temporalWeight <= 1e-6) continue;

      // 3. Joint Multiplicative-Harmonic Retrieval Score × Multi-Channel Reciprocal Rank Fusion (RRF) Boost
      const alpha = profile.recencyAlpha;
      const blend = (1 - alpha) + alpha * temporalWeight;
      const rrfNorm = Math.min(1.0, Math.max(0, Number(d.item.rrfNorm || 0)));
      const rrfBoost = 1.0 + 0.30 * rrfNorm;
      const mathScore = Math.min(1.0, lexNorm * blend * Math.pow(temporalWeight, alpha) * rrfBoost);

      if (mathScore <= 1e-5) continue;

      const isoDate = d.verifiedTs !== null ? new Date(d.verifiedTs).toISOString().slice(0, 10) : '';

      scored.push({
        ...d.item,
        timestamp: d.verifiedTs || 0,
        pubDate: isoDate || (d.verifiedTs !== null ? d.item.pubDate : ''),
        published_at: d.verifiedTs !== null ? (d.item.published_at || isoDate) : '',
        mathematicalScore: Number(mathScore.toFixed(5)),
        mathDiagnostics: {
          mathScore: Number(mathScore.toFixed(5)),
          bm25Score: Number(bm25.toFixed(4)),
          lexNorm: Number(lexNorm.toFixed(4)),
          temporalWeight: Number(temporalWeight.toFixed(5)),
          rrfNorm: Number(rrfNorm.toFixed(4)),
          ageDays: d.ageDays !== null ? Number(d.ageDays.toFixed(2)) : null,
          recencyAlpha: alpha
        }
      });
    }

    scored.sort((a, b) => b.mathDiagnostics.mathScore - a.mathDiagnostics.mathScore);
    if (scored.length > 0 && !options.keepCandidateFloor && !options.isWhitelistedPool) {
      const topScore = scored[0].mathDiagnostics.mathScore;
      if (topScore > 0) {
        return scored.filter(s => s.mathDiagnostics.mathScore >= topScore * 0.40);
      }
    }
    return scored;
  }

  // ============================================================================
  // 16B. DEDUKSI PROPOSISIONAL, RANTAI MARKOV LATEN <think>, & KALIBRASI BAYESIAN
  // Mengatasi kegagalan kompleksitas sirkuit dangkal O(1) (tebakan token ke-1),
  // bias panjang kalimat, jebakan negasi ("kecuali"), & jebakan "Semua benar/salah":
  //   1. Rantai Transisi Laten Wajib <think>...</think> sebelum emisi jawaban akhir
  //      (disaring bersih secara real-time oleh createThinkTagStripper).
  //   2. Polaritas Operator Proposisional P_op ∈ {+1, -1} & Resolusi Negasi Ganda.
  //   3. Tabel Kebenaran Independen v(H_i) ∈ {0,1} dengan Prior Seragam P_0 = 1/K.
  //   4. Aljabar Boole Eksak untuk Opsi Komposit ("Semua benar" / "Semua salah").
  // ============================================================================
  // ============================================================================
  // SENSOR AVERSI KESALAHAN MATEMATIS MURNI (PURE MATHEMATICAL ASYMMETRIC LOSS SENSOR)
  // Memodelkan 'Ketakutan akan Kesalahan' secara matematis murni:
  // 1. Fungsi Kerugian Asimetris Varian-Linex L(e) = (2/a^2) * (exp(a*e) - a*e - 1) dengan a = 15.0.
  //    Penalti memilih distractor semantik atau asumsi ceroboh adalah tak hingga (∞).
  // 2. Indeks Ketakutan Epistemik Φ_fear ∈ [0, 1] berbasis Entropi Shannon H_0,
  //    Kardinalitas Multi-Opsi |Y| = k, Polaritas Operator P_op ∈ {+1, -1}, dan
  //    Probabilitas Tabrakan Taksonomi C_collision (Data vs Model, PI vs SPI).
  // 3. Pendinginan Termostat Boltzmann (T -> 0.08) untuk eliminasi spekulasi token acak.
  // 4. Aksioma Invarian Tahapan & Entitas Sistem:
  //    Phase(O_i) ∩ Phase(Q) ≠ ∅ ∧ Entity(O_i) = Entity(Q).
  // ============================================================================
  function computeMathematicalErrorAversion(promptText, options = {}) {
    const raw = stripInjectedSystemTagsFromUserText(String(promptText || ''));
    if (!raw) return { fearIndex: 0, fearPct: 0, lossLinexParam: 15.0, mathematicalFearDirective: '' };
    const lower = raw.toLowerCase();

    // 1. Deteksi Kardinalitas & Multi-Select (|Y| = k)
    const multiSelectMatch = raw.match(/\b(?:select|choose|pilih(?:lah)?)\s+(?:the\s+)?(?:all|two|three|four|2|3|4|dua|tiga|empat|semua)(?:\s+(?:that|which)\s+apply|\s+correct|\s+options?|\s+answers?|\s+statements?|\s+jawaban|\s+opsi|\s+pilihan|\s+pernyataan)?/i);
    const isMultiSelect = Boolean(multiSelectMatch);
    let targetK = 1;
    if (isMultiSelect) {
      if (/\b(?:two|2|dua)\b/i.test(multiSelectMatch[0])) targetK = 2;
      else if (/\b(?:three|3|tiga)\b/i.test(multiSelectMatch[0])) targetK = 3;
      else if (/\b(?:four|4|empat)\b/i.test(multiSelectMatch[0])) targetK = 4;
      else if (/\b(?:all|semua)\b/i.test(multiSelectMatch[0])) targetK = 99;
    }

    // 2. Deteksi Polaritas Operator Soal P_op ∈ {+1, -1} (Negasi / Kecuali / Bukan)
    const isNegativePolarity = /\b(?:not|never|except|without|tidak|bukan|kecuali|bukanlah|salah\s+satu\s+yang\s+bukan|tidak\s+termasuk)\b/i.test(lower);
    const polarity = isNegativePolarity ? -1 : 1;

    // 3. Deteksi Domain Sensitivitas Taksonomis Tinggi (High Conceptual Collision C_collision)
    let collisionScore = 0;
    const collisionTriggers = [];

    // Kasus A: Tata Kelola AI & Privasi (Data Lifecycle vs Model Deployment Phase)
    if (/\b(?:privacy|privasi|anonymization|anonimisasi|minimization|minimisasi|differential\s+privacy|model\s+anonymization|training\s+data|deployment|deployed|deploy)\b/i.test(lower)) {
      collisionScore += 0.85;
      collisionTriggers.push('AI_GOVERNANCE_DATA_VS_MODEL_LIFECYCLE');
    }

    // Kasus B: Klasifikasi Informasi Pribadi (PI vs SPI / Sensitive Personal Information)
    if (/\b(?:personal\s+information|sensitive\s+personal\s+information|\bspi\b|harmful\s+personal|inferential\s+personal|informasi\s+pribadi|informasi\s+sensitif)\b/i.test(lower)) {
      collisionScore += 0.90;
      collisionTriggers.push('INFORMATION_TAXONOMY_PI_VS_SPI');
    }

    // Kasus C: Serangan Keamanan AI (Membership Inference vs Model Inversion vs Extraction)
    if (/\b(?:membership\s+inference|model\s+inversion|extraction\s+attack|poisoning|adversarial\s+attack|serangan\s+inferensi)\b/i.test(lower)) {
      collisionScore += 0.80;
      collisionTriggers.push('AI_SECURITY_ATTACK_CLASSIFICATION');
    }

    // Kasus D: Transparansi vs Akuntabilitas vs Explainability vs Fairness
    if (/\b(?:transparency|transparansi|explainability|accountability|fairness|bias|disclosing\s+information)\b/i.test(lower)) {
      collisionScore += 0.70;
      collisionTriggers.push('AI_ETHICS_TRANSPARENCY_AXIOM');
    }

    // 4. Deteksi Tahapan Siklus Hidup yang Disebutkan
    let detectedStage = 'general';
    if (/\b(?:before\s+(?:his\s+|the\s+)?model\s+is\s+deployed|before\s+deployment|pre-deployment|model\s+deployment|setelah\s+dilatih|siap\s+rilis|saat\s+inferensi)\b/i.test(lower)) {
      detectedStage = 'model_deployment';
    } else if (/\b(?:what\s+data\s+to\s+collect|decides\s+not\s+to\s+collect|data\s+collection|pengumpulan\s+data|saat\s+mengumpulkan)\b/i.test(lower)) {
      detectedStage = 'data_collection';
    } else if (/\b(?:preparing\s+data|cleaning\s+data|training\s+data\s+set|pembersihan\s+data|sebelum\s+dilatih)\b/i.test(lower)) {
      detectedStage = 'data_preparation';
    }

    // 5. Cek Riwayat Kesalahan Sesi Aktif
    const sessionObj = options.session || options.history;
    let pastSessionErrors = 0;
    if (sessionObj && Array.isArray(sessionObj.messages)) {
      pastSessionErrors = sessionObj.messages.filter(m => m && m.role === 'user' && isRevisionQuery(m.content || '')).length;
    }

    // 6. Hitung Indeks Ketakutan Epistemik Φ_fear ∈ [0, 1]
    const baseEntropy = Math.log2(options.optionCount || 4);
    const rawRisk = (0.25 * baseEntropy) +
                    (isMultiSelect ? 0.65 : 0.0) +
                    (isNegativePolarity ? 0.75 : 0.0) +
                    (collisionScore * 0.85) +
                    (pastSessionErrors * 0.50);

    const fearIndex = Math.min(1.0, Math.max(0.15, Math.tanh(rawRisk)));
    const fearPct = Math.round(fearIndex * 100);
    const lossLinexParam = 15.0;

    // 7. Konstruksi Direktif Aversi Kesalahan Matematis Murni
    const stageRules = [];
    if (detectedStage === 'model_deployment') {
      stageRules.push('- BATASAN TAHAPAN TEMPORAL: Tahap eksplisit adalah "SEBELUM DEPLOYMENT MODEL" (Model Phase). Kontrol privasi pada tahap ini beroperasi pada MODEL dan ARSITEKTUR/OUTPUT-NYA (misal: Differential Privacy, Model Anonymization), BUKAN kontrol tahap pengumpulan data mentah (Data Minimization / Data Anonymization). Opsi data mentah GUGUR: v(Data Control) = 0.');
    } else if (detectedStage === 'data_collection') {
      stageRules.push('- BATASAN TAHAPAN TEMPORAL: Tahap eksplisit adalah "PENGUMPULAN DATA" (Data Collection Phase). Kontrol privasi pada tahap ini beroperasi pada keputusan data apa yang diambil/dibatasi (misal: Data Minimization).');
    }

    if (collisionTriggers.includes('INFORMATION_TAXONOMY_PI_VS_SPI')) {
      stageRules.push('- BATASAN KATEGORI INFORMASI: Bedakan secara ketat antara Informasi Pribadi Biasa (PI) vs Informasi Pribadi Sensitif (SPI: riwayat kriminal/penangkapan, data medis/kesehatan, orientasi seksual, agama, ras, biometrik). Catatan penangkapan/arrest record = SENSITIVE Personal Information (SPI). Informasi umum yang tidak sensitif = PI biasa.');
    }

    const multiRule = isMultiSelect
      ? `- KARDINALITAS TARGET: Pilih TEPAT ${targetK === 99 ? 'seluruh' : targetK} opsi yang benar (|Y| = ${targetK === 99 ? 'k' : targetK}). DILARANG memilih kurang atau lebih dari jumlah ini!`
      : '- KARDINALITAS TARGET: Pilih TEPAT 1 opsi kanonik (|Y| = 1).';

    const polarityRule = isNegativePolarity
      ? '- POLARITAS OPERATOR P_op = -1 (NEGASI / KECUALI / NOT): Anda mencari opsi yang TIDAK memenuhi kriteria atau merupakan PENGECUALIAN. Evaluasi negasi secara ketat!'
      : '- POLARITAS OPERATOR P_op = +1 (AFIRMATIF): Anda mencari opsi yang benar secara faktual.';

    const mathematicalFearDirective = `[SENSOR AVERSI KESALAHAN MATEMATIS MURNI — Φ_fear = ${fearPct}%, a = ${lossLinexParam}]:
1. FUNGSI KERUGIAN LINEX ASIMETRIS: L(e) = (2/a^2) * (exp(a*e) - a*e - 1) -> ∞.
   Penalti kerugian untuk kesalahan tebakan distractor adalah TAK HINGGA (∞). DILARANG KERAS memilih opsi berdasarkan kemiripan kata umum semata.
2. OPERATOR AKSIOMA BATASAN SOAL:
   ${stageRules.length > 0 ? stageRules.join('\n   ') + '\n   ' : ''}${multiRule}
   ${polarityRule}
3. TABEL KEBENARAN DEDUKTIF v(O_i) ∈ {0, 1}:
   Uji setiap opsi secara independen terhadap kondisi batas premis. Pilih himpunan opsi dengan valuasi v(O) = 1 yang meminimalkan Linex Loss L.`;

    return {
      fearIndex,
      fearPct,
      lossLinexParam,
      isMultiSelect,
      targetK,
      polarity,
      detectedStage,
      collisionScore,
      collisionTriggers,
      mathematicalFearDirective
    };
  }

  function detectGroundTruthCorrectionOrExplanation(userText, assistantText) {
    const uStr = String(userText || '').trim();
    const aStr = String(assistantText || '').trim();

    // 1. Cek pengakuan koreksi asisten (Asisten mengakui koreksi pengguna dan merangkum soal & jawaban)
    if (aStr) {
      const qnAFromAsst = aStr.match(/Pertanyaan:\s*([^\n\r]+?)\s*Jawaban:\s*([^\n\r.]+)/i);
      if (qnAFromAsst && qnAFromAsst[1] && qnAFromAsst[2]) {
        const qText = qnAFromAsst[1].trim();
        const aText = qnAFromAsst[2].trim();
        return {
          detected: true,
          questionText: qText,
          verifiedAnswer: aText,
          falsifiedAnswer: 'Jawaban salah sebelumnya',
          content: `[KOREKSI KESALAHAN TERVERIFIKASI] Soal: "${qText}" | Hipotesis Salah (P = 0, JANGAN PILIH LAGI): Jawaban salah sebelumnya | Jawaban Terverifikasi: "${aText}"`
        };
      }

      const caseAnswerMatch = aStr.match(/jawaban yang benar untuk (?:kasus|soal|pertanyaan)\s+([^:.]+?)\s+adalah:\s*([^\n\r.]+)/i);
      if (caseAnswerMatch && caseAnswerMatch[1] && caseAnswerMatch[2]) {
        const caseName = caseAnswerMatch[1].trim();
        const verifiedAns = caseAnswerMatch[2].trim();
        const fullQ = uStr.length >= 20 ? uStr : `Soal kasus ${caseName}`;
        return {
          detected: true,
          questionText: fullQ,
          verifiedAnswer: verifiedAns,
          falsifiedAnswer: 'Jawaban salah sebelumnya',
          content: `[KOREKSI KESALAHAN TERVERIFIKASI] Kasus: "${caseName}" | Soal: "${fullQ.slice(0, 200)}" | Jawaban Terverifikasi: "${verifiedAns}"`
        };
      }
    }

    // 2. Cek penjelasan silabus resmi dari pengguna (User memberikan penjelasan buku/silabus)
    if (uStr.length >= 25) {
      const byUsingMatch = uStr.match(/\bBy using\s+([^,]+),\s*(\w+)\s+(?:makes|decreases|ensures|allows|protects)\b/i);
      if (byUsingMatch && byUsingMatch[1] && byUsingMatch[2]) {
        const keyConcepts = byUsingMatch[1].trim();
        const subjectName = byUsingMatch[2].trim();
        return {
          detected: true,
          questionText: `Kasus ${subjectName}: ${uStr.slice(0, 200)}`,
          verifiedAnswer: keyConcepts,
          falsifiedAnswer: 'Jawaban alternatif yang keliru',
          content: `[KOREKSI KESALAHAN TERVERIFIKASI] Subjek: "${subjectName}" | Konsep Terverifikasi Silabus: "${keyConcepts}" | Penjelasan: "${uStr.slice(0, 260)}"`
        };
      }

      // Format kunci jawaban langsung dari pengguna: "Kunci jawaban: B, D" atau "Jawaban yang benar adalah X"
      const explicitKeyMatch = uStr.match(/(?:kunci\s+jawaban|jawaban\s+(?:yang\s+)?benar(?:\s+adalah)?|correct\s+answer\s+is)\s*[:=-]?\s*([^\n\r.]+)/i);
      if (explicitKeyMatch && explicitKeyMatch[1]) {
        return {
          detected: true,
          questionText: uStr.slice(0, 240),
          verifiedAnswer: explicitKeyMatch[1].trim(),
          falsifiedAnswer: 'Jawaban sebelumnya',
          content: `[KOREKSI KESALAHAN TERVERIFIKASI] Kunci Jawaban Resmi: "${explicitKeyMatch[1].trim()}" | Soal: "${uStr.slice(0, 220)}"`
        };
      }
    }

    return null;
  }

  function computeBayesianDecisionCalibration(promptText, options = {}) {
    const raw = stripInjectedSystemTagsFromUserText(String(promptText || ''));
    const imageCount = (options && typeof options.imageCount === 'number')
      ? options.imageCount
      : (options && options.hasImages ? 1 : 0);
    const hasImages = Boolean((options && options.hasImages) || imageCount > 0);
    const lower = raw.toLowerCase();

    // 0. Deteksi Revisi Jawaban Kuis / Anaphora Penggantian Hipotesis (Falsifikasi P(H_prev) = 0)
    const isRevision = isRevisionQuery(raw);
    const sessionObj = options && (options.session || options.history || options.sessionOrMessages);
    const fallbackSessions = options && options.fallbackSessions;
    const parentQuiz = isRevision ? extractParentQuizContext(sessionObj, fallbackSessions) : null;

    if (isRevision && parentQuiz && parentQuiz.candidateOptions.length >= 2) {
      const falsifiedList = Array.isArray(parentQuiz.falsifiedAnswers) && parentQuiz.falsifiedAnswers.length > 0
        ? parentQuiz.falsifiedAnswers
        : (parentQuiz.previousAnswer ? [parentQuiz.previousAnswer] : []);
      const cleanFalsifiedSet = falsifiedList
        .map(f => String(f || '').replace(/^[A-Fa-f][.)\s-]+/, '').toLowerCase().trim())
        .filter(Boolean);

      const remainingOptions = parentQuiz.candidateOptions.filter(opt => {
        const cleanOpt = opt.replace(/^[A-Fa-f][.)\s-]+/, '').toLowerCase().trim();
        return !cleanFalsifiedSet.some(cf => cleanOpt === cf || (cf.length >= 5 && (cleanOpt.includes(cf) || cf.includes(cleanOpt))));
      });
      const effectiveOpts = remainingOptions.length > 0 ? remainingOptions : parentQuiz.candidateOptions;
      const effectiveK = Math.max(2, effectiveOpts.length);
      const uniformPrior = Number((1 / effectiveK).toFixed(4));
      const maxEntropyBits = Number(Math.log2(effectiveK).toFixed(4));
      const calibratedTemp = 0.12;
      const calibratedTopP = 0.90;
      const falsifiedStr = falsifiedList.join('; ') || parentQuiz.previousAnswer;

      const reconstructedUserPrompt = `${raw}\n\n[PROYEKSI RUANG KEADAAN REVISI (P(H_falsified) = 0)]:\n` +
        (parentQuiz.userText ? `- Soal Asli: ${parentQuiz.userText.replace(/\r?\n/g, ' | ')}\n` : '') +
        `- Opsi Terfalsifikasi (P = 0, JANGAN DIPILIH): ${falsifiedStr}\n` +
        `- Ruang Opsi Tersisa (P_0 = 1/${effectiveOpts.length}): ${effectiveOpts.map((o, i) => `(${i + 1}) ${o}`).join(' ; ')}\n` +
        `- Instruksi Eksak: Pilih tepat 1 opsi yang paling benar dari Ruang Opsi Tersisa di atas dan tuliskan di baris pertama beserta alasan konseptual mengapa opsi tersebut benar (batalkan klaim sebelumnya bahwa tidak ada opsi yang tepat).`;

      const calibrationDirective = `[KOREKSI BAYESIAN: Opsi "${falsifiedStr}" salah (P = 0). Evaluasi sisa opsi: ${effectiveOpts.join(', ')} (P_0 = 1/${effectiveOpts.length}). Langsung berikan satu opsi pengganti terbaik di baris pertama beserta alasan ringkas tanpa meminta pengguna mengulang soal.]`;

      return {
        isDiscreteChoice: true,
        isQuizRevision: true,
        isPostHocProjection: false,
        isConceptualTaxonomy: false,
        isSelfContainedDiscreteTurn: false,
        isAnalyticalQuery: true,
        imageCount,
        optionCount: effectiveK,
        uniformPrior,
        maxEntropyBits,
        temperature: calibratedTemp,
        topP: calibratedTopP,
        top_p: calibratedTopP,
        presencePenalty: 0,
        frequencyPenalty: 0,
        candidateOptions: parentQuiz.candidateOptions,
        remainingOptions: effectiveOpts,
        falsifiedAnswer: parentQuiz.previousAnswer,
        falsifiedAnswers: falsifiedList,
        parentQuestionText: parentQuiz.userText || '',
        reconstructedUserPrompt,
        calibrationDirective
      };
    } else if (isRevision) {
      // Resilien Fallback untuk Revisi Kuis tanpa Format Opsi Standar / Soal Konversasional / Gambar
      const prevAnswerText = parentQuiz?.previousAnswer || 'Jawaban pada giliran sebelumnya';
      const falsifiedList = Array.isArray(parentQuiz?.falsifiedAnswers) && parentQuiz.falsifiedAnswers.length > 0
        ? parentQuiz.falsifiedAnswers
        : [prevAnswerText];
      const falsifiedStr = falsifiedList.join('; ');
      const calibratedTemp = 0.12;
      const calibratedTopP = 0.90;

      const reconstructedUserPrompt = `${raw}\n\n[PROYEKSI RUANG KEADAAN REVISI (P(H_falsified) = 0)]:\n` +
        (parentQuiz?.userText ? `- Soal Asli: ${parentQuiz.userText.replace(/\r?\n/g, ' | ')}\n` : '') +
        `- Jawaban Terfalsifikasi (P = 0, JANGAN DIPILIH): ${falsifiedStr}\n` +
        `- Instruksi Eksak: Evaluasi kembali soal pada riwayat di atas, eliminasi jawaban yang salah tersebut, dan langsung tuliskan 1 jawaban pengganti terbaik di baris pertama beserta alasan singkat (tanpa meminta pengguna mengirim ulang soal).`;

      const calibrationDirective = `[KOREKSI BAYESIAN: Jawaban sebelumnya ("${falsifiedStr}") salah (P = 0). Evaluasi soal pada riwayat obrolan di atas dan langsung berikan satu jawaban revisi pengganti terbaik di baris pertama beserta alasan ringkas tanpa meminta pengguna mengulang soal.]`;

      return {
        isDiscreteChoice: true,
        isQuizRevision: true,
        isPostHocProjection: false,
        isConceptualTaxonomy: false,
        isSelfContainedDiscreteTurn: false,
        isAnalyticalQuery: true,
        imageCount,
        optionCount: 4,
        uniformPrior: 0.25,
        maxEntropyBits: 2.0,
        temperature: calibratedTemp,
        topP: calibratedTopP,
        top_p: calibratedTopP,
        presencePenalty: 0,
        frequencyPenalty: 0,
        candidateOptions: parentQuiz?.candidateOptions || [],
        remainingOptions: [],
        falsifiedAnswer: prevAnswerText,
        falsifiedAnswers: falsifiedList,
        parentQuestionText: parentQuiz?.userText || '',
        reconstructedUserPrompt,
        calibrationDirective
      };
    }

    // 0b. Deteksi Operator Proyeksi Anaphora Post-Hoc ("abcd sja", "hurufnya saja", "singkat saja", "jelaskan")
    //     Mengikat operator pendek pengguna langsung ke pertanyaan & jawaban giliran sebelumnya (Delta_pos = 0)
    //     sehingga AI tidak pernah lupa pada pertanyaan yang baru saja ditanyakan atau meminta pengguna mengirim ulang soal!
    const postHoc = isPostHocProjectionQuery(raw);
    if (postHoc) {
      const postHocParent = extractParentQuizContext(sessionObj, fallbackSessions);
      if (postHocParent && (postHocParent.userText || postHocParent.lastAsstMsg)) {
        const hasOpts = Array.isArray(postHocParent.candidateOptions) && postHocParent.candidateOptions.length >= 2;
        const chosenLettersStr = Array.isArray(postHocParent.chosenLetters) && postHocParent.chosenLetters.length > 0
          ? postHocParent.chosenLetters.join(', ')
          : '';
        let reconstructedUserPrompt = '';
        let calibrationDirective = '';

        if (postHoc.type === 'index_letter' && hasOpts) {
          reconstructedUserPrompt = `${raw}\n\n[PROYEKSI OPERATOR ANAPHORA PADA PERTANYAAN SEBELUMNYA (Δpos = 0)]:\n` +
            `- Pertanyaan Acuan: ${postHocParent.userText.replace(/\r?\n/g, ' | ')}\n` +
            `- Pemetaan Indeks Biiektif Opsi (φ: O -> {A, B, C, D}):\n${postHocParent.indexedOptions.map(o => '  ' + o).join('\n')}\n` +
            `- Opsi Terpilih dari Evaluasi Sebelumnya: ${chosenLettersStr || postHocParent.previousAnswer}\n` +
            `- Instruksi Eksak: Terapkan perintah format pengguna ("${raw}") LANGSUNG pada Pertanyaan Acuan di atas sekarang juga. Tuliskan HANYA huruf indeks jawaban yang benar (${chosenLettersStr || 'huruf opsi yang tepat'}) secara langsung tanpa meminta pengguna mengirimkan ulang pertanyaannya.`;
          calibrationDirective = `[PROYEKSI INDEKS BIJEKTIF: Pertanyaan acuan memiliki ${postHocParent.candidateOptions.length} opsi (${postHocParent.indexedOptions.join(' ; ')}). Jawaban terverifikasi = ${chosenLettersStr || postHocParent.previousAnswer}. Langsung tuliskan huruf indeks jawaban tersebut sekarang tanpa meminta soal dikirim ulang.]`;
        } else {
          reconstructedUserPrompt = `${raw}\n\n[PROYEKSI OPERATOR ANAPHORA PADA PERTANYAAN SEBELUMNYA (Δpos = 0)]:\n` +
            (postHocParent.userText ? `- Pertanyaan Acuan: ${postHocParent.userText.replace(/\r?\n/g, ' | ')}\n` : '') +
            (postHocParent.lastAsstMsg ? `- Jawaban Sebelumnya: ${postHocParent.lastAsstMsg.slice(0, 650).replace(/\r?\n/g, ' | ')}\n` : '') +
            `- Instruksi Eksak: Terapkan perintah pengguna ("${raw}") LANGSUNG pada Pertanyaan Acuan dan Jawaban Sebelumnya di atas sekarang juga tanpa meminta pengguna mengirimkan ulang pertanyaannya.`;
          calibrationDirective = `[PROYEKSI ANAPHORA: Terapkan perintah "${raw}" langsung pada pertanyaan dan jawaban giliran sebelumnya tanpa meminta pengguna mengulang pertanyaan.]`;
        }

        const effectiveK = hasOpts ? postHocParent.candidateOptions.length : 4;
        return {
          isDiscreteChoice: hasOpts,
          isQuizRevision: false,
          isPostHocProjection: true,
          postHocType: postHoc.type,
          isConceptualTaxonomy: false,
          isSelfContainedDiscreteTurn: false,
          isAnalyticalQuery: true,
          imageCount,
          optionCount: effectiveK,
          uniformPrior: Number((1 / effectiveK).toFixed(4)),
          maxEntropyBits: Number(Math.log2(effectiveK).toFixed(4)),
          temperature: 0.12,
          topP: 0.90,
          top_p: 0.90,
          presencePenalty: 0,
          frequencyPenalty: 0,
          candidateOptions: postHocParent.candidateOptions || [],
          indexedOptions: postHocParent.indexedOptions || [],
          chosenLetters: postHocParent.chosenLetters || [],
          chosenOptions: postHocParent.chosenOptions || [],
          parentQuestionText: postHocParent.userText || '',
          reconstructedUserPrompt,
          calibrationDirective
        };
      }
    }

    // Abaikan sapaan murni sangat pendek atau perintah pembuatan berkas/visual murni
    const isTrivialGreeting = !hasImages && raw.length < 18 && /^(halo|hai|hi|hello|pagi|siang|sore|malam|tes|test|ping|ok|oke|makasih|terima kasih|thanks)[\s!.,?]*$/i.test(raw);
    const isPureMediaGen = !hasImages && /\b(buatkan\s+(gambar|foto|ilustrasi|logo|website|landing\s*page|aplikasi|dokumen|pdf|word|makalah)|carikan\s+(foto|gambar|video))\b/i.test(lower);

    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // 1. Deteksi opsi berlabel eksplisit: A./B./C./D. atau (A)/(B)/(C) atau a)/b)/c)
    const labeledOptionLines = lines.filter(l => /^(?:\(?[A-Fa-f]\)|[A-Fa-f][.)]\s+|\([1-6]\)\s+|[1-6][.)]\s+\S)/.test(l));
    const inlineOptionsMatch = raw.match(/(?:^|\s)(?:\([A-Da-d]\)|[A-Da-d][.)])\s+[^\n]+(?:\s+(?:\([B-Eb-e]\)|[B-Eb-e][.)])\s+[^\n]+)/);

    // 2. Deteksi pilihan ganda tanpa huruf (format kuis Coursera / Skilljar / IBM / Dicoding / Google):
    //    WAJIB terdapat baris kalimat tanya ('?' atau ':' atau kata tanya eksplisit) diikuti >= 2 baris opsi kandidat
    let unlabeledOptionCount = 0;
    let questionLineIdx = lines.findIndex(l => {
      const trimmedLine = l.trim();
      if (/\?+\s*$/.test(trimmedLine) || /:\s*$/.test(trimmedLine)) return true;
      if (/^\s*(?:what|which|how|why|when|where|who|whom|whose|manakah|apakah|bagaimana|mengapa|pilih(?:lah)?|select|choose)\b/i.test(trimmedLine)) return true;
      if (/\b(?:true or false|benar atau salah|kecuali|except)\b/i.test(trimmedLine)) return true;
      return false;
    });
    while (questionLineIdx !== -1 && questionLineIdx + 1 < lines.length && (QUIZ_INSTRUCTION_LINE_REGEX.test(lines[questionLineIdx + 1]) || /\?\s*$/.test(lines[questionLineIdx + 1]) || /:\s*$/.test(lines[questionLineIdx + 1]))) {
      questionLineIdx++;
    }
    if (questionLineIdx !== -1 && lines.length >= questionLineIdx + 3) {
      const tailLines = lines.slice(questionLineIdx + 1).filter(l => {
        if (/^(?:jawab|berikan|pilih|tuliskan)\s+(?:singkat|langsung|hanya|saja|jawaban)/i.test(l)) return false;
        if (QUIZ_INSTRUCTION_LINE_REGEX.test(l)) return false;
        if (/^(?:submit|next(?:\s+question)?|sebelumnya|selanjutnya|selesaikan)$/i.test(l)) return false;
        return true;
      });
      const candidateLines = tailLines.filter(l => {
        const wc = l.split(/\s+/).filter(Boolean).length;
        return wc >= 1 && wc <= 36 && !/\?\s*$/.test(l) && !/^[-*#>`]/.test(l);
      });
      if (candidateLines.length >= 2 && candidateLines.length <= 7 && candidateLines.length >= tailLines.length * 0.7) {
        unlabeledOptionCount = candidateLines.length;
      }
    }

    // 2b. Deteksi taksonomi relasional eksplisit (misal daftar istilah Morton Deutsch Social Interdependence).
    //     DILARANG mengklasifikasikan pesan multi-baris biasa pengguna tanpa kalimat tanya sebagai kuis (mencegah pembajakan input pengguna)!
    let pureListOptionCount = 0;
    const unlabeledCandidateSetCount = 0;
    if (lines.length >= 2 && lines.length <= 8 && !hasImages && unlabeledOptionCount === 0 && labeledOptionLines.length === 0) {
      const isRelationalTheoryTerms = lines.some(l => /\b(independent|competitive|cooperative|interdependent|contrience|promotive)\b/i.test(l));
      const isAllVeryShortTerms = lines.every(l => {
        const wc = l.split(/\s+/).filter(Boolean).length;
        return wc >= 1 && wc <= 6;
      });
      if (isAllVeryShortTerms && isRelationalTheoryTerms) {
        pureListOptionCount = lines.length;
      }
    }

    // 3. Deteksi kueri evaluasi soal bergambar atau pilihan eksplisit
    const hasQuizCue = /\b(pilihan\s+ganda|multiple\s+choice|which\s+(?:of\s+the\s+following|type|evaluation|response|approach|scenario|situation|technique|opening|statement)|what(?:'s|\s+is)\s+the\s+(?:best|most\s+effective|primary|correct|main)\b|manakah\s+(?:dari|pernyataan|opsi|pilihan|kata\s+kunci|berikut)|berikut\s+adalah\s+.*kecuali|pilih\s+satu|jawaban\s+yang\s+(?:benar|tepat)|true\s+or\s+false|benar\s+atau\s+salah)\b/i.test(lower);
    const hasImageQuizCue = hasImages && (raw.length === 0 || /\b(analisis\s+gambar|jawab|soal|pilihan|opsi|benar|tepat|quiz|ujian|nomor|pertanyaan|singkat)\b/i.test(lower));

    const isConceptualTaxonomy = pureListOptionCount >= 2 && !hasQuizCue && !hasImageQuizCue && questionLineIdx === -1;

    let optionCount = 0;
    if (labeledOptionLines.length >= 2) {
      optionCount = labeledOptionLines.length;
    } else if (unlabeledOptionCount >= 2) {
      optionCount = unlabeledOptionCount;
    } else if (inlineOptionsMatch) {
      optionCount = 4;
    } else if (hasQuizCue || hasImageQuizCue) {
      optionCount = 4;
    }

    const isDiscreteChoice = !isPureMediaGen && !isConceptualTaxonomy && (optionCount >= 2 || hasQuizCue || hasImageQuizCue);

    // 4. JANGAN PERNAH menghapus riwayat percakapan (isSelfContainedDiscreteTurn = false secara mutlak)
    //    agar konteks multi-giliran dan instruksi pengguna tetap utuh 100%.
    const isSelfContainedDiscreteTurn = false;

    // 5. Deteksi persoalan analitis / logika / matematika / sains / kausalitas umum
    const isAnalyticalQuery = !isTrivialGreeting && !isPureMediaGen && (
      isDiscreteChoice ||
      isConceptualTaxonomy ||
      hasImages ||
      /\?/.test(raw) ||
      raw.split(/\s+/).length >= 6 ||
      /\b(apa|apakah|mengapa|kenapa|bagaimana|jelaskan|analisis|analisa|bandingkan|perbedaan|manakah|benarkah|siapa|berapa|kapan|dimana|evaluasi|hitung|buktikan|pecahkan|solusi|masalah|kasus|what|why|how|which|explain|compare|analyze|solve|is\s+it|does|can|should|would)\b/i.test(lower)
    );

    // 6. Parameter Matematis Prior Entropi Maksimum & Suhu Boltzmann Terkalibrasi
    const effectiveK = Math.max(2, optionCount || (pureListOptionCount || 4));
    const uniformPrior = Number((1 / effectiveK).toFixed(4));
    const maxEntropyBits = Number(Math.log2(effectiveK).toFixed(4));

    // T = 0.15 pada kuis pilihan ganda, T = 0.18 pada penalaran analitis/sains/taksonomi relasional formal
    const calibratedTemp = isDiscreteChoice ? 0.15 : ((isConceptualTaxonomy || isAnalyticalQuery) ? 0.18 : 0.45);
    const calibratedTopP = (isDiscreteChoice || isConceptualTaxonomy || isAnalyticalQuery) ? 0.90 : 0.92;

    const multiImageNote = imageCount > 1
      ? ` Evaluasi ${imageCount} gambar terlampir secara berurutan (1 s/d ${imageCount}).`
      : '';

    const extractedOpts = isDiscreteChoice ? extractCandidateOptionsFromTextBlock(raw, false) : [];
    const indexedOpts = extractedOpts.map((opt, idx) => {
      const cleanOpt = opt.replace(/^(?:\(?[A-Fa-f]\)|[A-Fa-f][.)\s-]+|\([1-6]\)\s+|[1-6][.)]\s+)/, '').trim();
      return `${String.fromCharCode(65 + idx)}. ${cleanOpt}`;
    });
    const isMultiSelectQuestion = /\b(?:select|choose|pilih(?:lah)?)\s+(?:the\s+)?(?:all|two|three|four|2|3|4|dua|tiga|empat|semua)\b/i.test(raw);

    // Cek apakah di dalam riwayat sesi ini pengguna pernah meminta format huruf saja ("abcd sja")
    let hasSessionLetterPreference = Boolean(options && options.preferLetterOnly);
    if (!hasSessionLetterPreference && sessionObj) {
      const histMsgs = Array.isArray(sessionObj?.messages) ? sessionObj.messages : (Array.isArray(sessionObj) ? sessionObj : []);
      hasSessionLetterPreference = histMsgs.some(m => m && m.role === 'user' && isPostHocProjectionQuery(m.content || '')?.type === 'index_letter');
    }

    // Evaluasi Sensor Aversi Kesalahan Matematis Murni
    const errorAversion = computeMathematicalErrorAversion(raw, {
      session: sessionObj,
      optionCount: effectiveK,
      candidateOptions: extractedOpts
    });

    let calibrationDirective = '';
    if (isDiscreteChoice) {
      const targetSelectionClause = isMultiSelectQuestion
        ? `Tetapkan TEPAT ${errorAversion.targetK === 99 ? 'seluruh' : errorAversion.targetK} opsi kanonik yang memenuhi syarat secara serentak.`
        : 'Tetapkan tepat satu kunci jawaban kanonik yang paling akurat secara tegas tanpa meragukan desain soal.';
      const indexMapClause = indexedOpts.length >= 2
        ? ` Pemetaan indeks opsi: ${indexedOpts.join(' | ')}.`
        : '';
      const letterPrefClause = hasSessionLetterPreference
        ? ' Sesuai preferensi format pengguna ("abcd saja"), tuliskan hanya huruf indeks jawaban yang benar (misal: A, B, D).'
        : '';
      calibrationDirective = `${errorAversion.mathematicalFearDirective}\n\n[KALIBRASI KEPUTUSAN BAYESIAN — P_0(H_i) = ${uniformPrior}, H_0 = ${maxEntropyBits} bit]: Evaluasi setiap opsi secara independen sesuai polaritas operator soal (positif vs negasi/kecuali) serta opsi komposit ("Semua benar/salah" / "All/None of the above"). ${targetSelectionClause}${indexMapClause}${letterPrefClause}${multiImageNote}`;
    }

    const fearQuenchedTemp = (errorAversion.fearIndex >= 0.35 && isDiscreteChoice) ? 0.08 : calibratedTemp;
    const fearQuenchedTopP = (errorAversion.fearIndex >= 0.35 && isDiscreteChoice) ? 0.88 : calibratedTopP;

    return {
      isDiscreteChoice,
      isQuizRevision: false,
      isPostHocProjection: false,
      isMultiSelectQuestion,
      preferLetterOnly: hasSessionLetterPreference,
      candidateOptions: extractedOpts,
      indexedOptions: indexedOpts,
      isConceptualTaxonomy,
      isSelfContainedDiscreteTurn,
      isAnalyticalQuery,
      imageCount,
      optionCount: isDiscreteChoice ? effectiveK : 0,
      uniformPrior,
      maxEntropyBits,
      temperature: fearQuenchedTemp,
      topP: fearQuenchedTopP,
      top_p: fearQuenchedTopP,
      presencePenalty: 0,
      frequencyPenalty: 0,
      errorAversion,
      fearIndex: errorAversion.fearIndex,
      fearPct: errorAversion.fearPct,
      calibrationDirective
    };
  }

  function computeOptimalSamplingTemperature(recencyProfile, hasGroundedEvidence = false, decisionProfile = null) {
    if (decisionProfile && decisionProfile.errorAversion && decisionProfile.errorAversion.fearIndex >= 0.35 && decisionProfile.isDiscreteChoice) {
      const fi = decisionProfile.errorAversion.fearIndex;
      const dampedTemp = Math.max(0.06, Number((0.15 * (1.0 - 0.55 * fi)).toFixed(2)));
      return { temperature: dampedTemp, top_p: 0.88, topP: 0.88, fearDamped: true };
    }
    if (decisionProfile && decisionProfile.isConceptualTaxonomy) {
      return { temperature: 0.18, top_p: 0.90, topP: 0.90 };
    }
    if (decisionProfile && decisionProfile.isDiscreteChoice) {
      return { temperature: 0.15, top_p: 0.90, topP: 0.90 };
    }
    if (hasGroundedEvidence) {
      return { temperature: 0.25, top_p: 0.88, topP: 0.88 };
    }
    if (decisionProfile && decisionProfile.isAnalyticalQuery) {
      return { temperature: 0.18, top_p: 0.90, topP: 0.90 };
    }
    const alpha = recencyProfile && typeof recencyProfile.recencyAlpha === 'number'
      ? recencyProfile.recencyAlpha
      : 0.15;
    const temp = Math.max(0.22, Number((0.55 * (1 - 0.55 * alpha)).toFixed(2)));
    const pVal = alpha >= 0.7 ? 0.88 : 0.92;
    return { temperature: temp, top_p: pVal, topP: pVal };
  }

  function buildCharNgramSet(text, n = 4) {
    const clean = String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const set = new Set();
    for (let i = 0; i <= clean.length - n; i++) {
      set.add(clean.slice(i, i + n));
    }
    return set;
  }

  function projectGroundedResponseMathematically(responseText, sources, rawToolText = '', options = {}) {
    const raw = String(responseText || '');
    if (!raw.trim() || !Array.isArray(sources) || sources.length === 0) {
      return { text: raw, prunedCount: 0, dateCorrections: 0, hallucinationRate: 0 };
    }

    const nowMs = options.nowMs || Date.now();
    const nowDate = new Date(nowMs);
    const curYear = nowDate.getUTCFullYear();
    const todayEpochDays = Math.floor(nowMs / 86400000);

    // 1. Construct Verified Evidence Anchor Sets A_ver(E), A_date(E), and Invariant Token Space I(E)
    const evidenceDocs = sources.map((s) => {
      const docText = [
        s.title || '',
        s.snippet || '',
        s.content || '',
        s.pubDate || '',
        s.published_at || '',
        s.published_date || '',
        s.date || '',
        s.url || ''
      ].join(' ');
      const ts = parseAuthenticTimestamp(
        s.published_at || s.pubDate || s.published_date || s.date || '',
        s.url || '',
        docText,
        nowMs
      );
      const docDates = extractCalendarDateCoordinates(docText, curYear);
      if (ts !== null) {
        const dt = new Date(ts);
        docDates.unshift({
          year: dt.getUTCFullYear(),
          month: dt.getUTCMonth() + 1,
          day: dt.getUTCDate(),
          hasDay: true,
          epochDays: Math.floor(ts / 86400000),
          raw: dt.toISOString().slice(0, 10)
        });
      }
      return {
        source: s,
        docText,
        tokens: new Set(tokenizeForIR(docText)),
        ngrams: buildCharNgramSet(docText, 4),
        verAnchors: new Set(extractVersionedEntityAnchors(docText)),
        dates: docDates,
        ts
      };
    });

    const fullEvidenceCorpus = `${String(rawToolText || '')}\n${evidenceDocs.map(d => d.docText).join('\n')}`;
    const verifiedVerAnchors = new Set(extractVersionedEntityAnchors(fullEvidenceCorpus));
    const verifiedTokens = new Set(tokenizeForIR(fullEvidenceCorpus));

    // Also index entity stems that have verified versions so we recognize version mismatches cleanly
    const verifiedDayEpochSet = [];
    const verifiedMonthSet = new Set();
    // Allow today's system date as a valid meta-reference ("per 31 Oktober 2026")
    verifiedDayEpochSet.push(todayEpochDays);
    verifiedMonthSet.add(`${curYear}-${nowDate.getUTCMonth() + 1}`);

    for (const d of evidenceDocs) {
      for (const dc of d.dates) {
        if (dc.epochDays !== null && dc.hasDay) verifiedDayEpochSet.push(dc.epochDays);
        if (dc.year && dc.month) verifiedMonthSet.add(`${dc.year}-${dc.month}`);
      }
    }
    for (const dc of extractCalendarDateCoordinates(rawToolText, curYear)) {
      if (dc.epochDays !== null && dc.hasDay) verifiedDayEpochSet.push(dc.epochDays);
      if (dc.year && dc.month) verifiedMonthSet.add(`${dc.year}-${dc.month}`);
    }

    const hasVerifiedDates = verifiedDayEpochSet.length > 1;

    const isDateSupported = (coord, sentenceContext = '') => {
      const isForward = /\b(target|proyeksi|prediksi|rencana|jadwal|dijadwalkan|akan|menuju|hingga|sampai|mendatang|perkiraan|roadmap|expected|projected|forecast|scheduled|upcoming)\b/i.test(sentenceContext);
      if (coord.epochDays !== null && coord.epochDays > todayEpochDays + 1 && !isForward) {
        // Future date claimed as past/present fact: must exist verbatim in evidence
        return verifiedDayEpochSet.some(ed => Math.abs(ed - coord.epochDays) <= 1);
      }
      if (isForward) return true;
      if (!hasVerifiedDates) return true;
      if (coord.hasDay && coord.epochDays !== null) {
        // Tolerance ±1 day for UTC <-> local timezone (WIB/PDT) boundary shifts
        return verifiedDayEpochSet.some(ed => Math.abs(ed - coord.epochDays) <= 1);
      }
      if (!coord.hasDay && coord.year && coord.month) {
        return verifiedMonthSet.has(`${coord.year}-${coord.month}`);
      }
      return true;
    };

    const computeMaxDocSimilarity = (unitText) => {
      const uNgrams = buildCharNgramSet(unitText, 4);
      if (uNgrams.size === 0) return 0;
      let bestSim = 0;
      let bestDoc = null;
      for (const d of evidenceDocs) {
        let inter = 0;
        for (const ng of uNgrams) {
          if (d.ngrams.has(ng)) inter++;
        }
        const sim = inter / Math.max(1, uNgrams.size);
        if (sim > bestSim) {
          bestSim = sim;
          bestDoc = d;
        }
      }
      return { bestSim, bestDoc };
    };

    const computeInvariantSupport = (unitText) => {
      // Extract capitalized proper nouns / tech identifiers / numbers not in Indonesian stopwords
      const rawWords = String(unitText || '').match(/\b[A-Z][A-Za-z0-9._-]{1,20}\b|\b[a-z]+[0-9][a-z0-9._-]*\b/g) || [];
      const invariants = [];
      for (const w of rawWords) {
        const lw = w.toLowerCase();
        if (GENERIC_NON_ENTITY_WORDS.has(lw) || STOPWORDS_AND_VERBS.has(lw) || LOW_ENTROPY_FILLERS.has(lw)) continue;
        if (/^(?:tabel|ringkasan|analisis|catatan|kesimpulan|poin|tren|pola|rekap|model|rilis|kategori|pengembang|sorotan|utama|indonesia|dunia|global)$/i.test(lw)) continue;
        invariants.push(lw);
      }
      if (invariants.length === 0) return { count: 0, ratio: 1 };
      let hits = 0;
      for (const inv of invariants) {
        if (verifiedTokens.has(inv) || [...verifiedTokens].some(vt => vt.length >= 4 && inv.length >= 4 && (vt.includes(inv) || inv.includes(vt)))) {
          hits++;
        }
      }
      return { count: invariants.length, ratio: hits / invariants.length };
    };

    // 2. Line-by-line & Structural Block Projection (preserving code fences)
    const lines = raw.split(/\r?\n/);
    const projectedLines = [];
    let inCodeFence = false;
    let prunedCount = 0;
    let dateCorrections = 0;
    let evaluatedClaims = 0;

    // Track section headings so if a heading introduces an ungrounded entity (or loses all body lines), we prune it cleanly
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();

      if (/^```/.test(trimmed)) {
        inCodeFence = !inCodeFence;
        projectedLines.push(line);
        continue;
      }
      if (inCodeFence || !trimmed) {
        projectedLines.push(line);
        continue;
      }

      // A. Markdown Table Row Projection: | col1 | col2 | ... |
      const isTableRow = /^\|.*\|$/.test(trimmed);
      const isTableSeparator = /^\|[\s:|-]+\|$/.test(trimmed);
      if (isTableRow && !isTableSeparator) {
        // Detect if header row (next line is |---|---|)
        const nextTrimmed = (lines[i + 1] || '').trim();
        const isTableHeader = /^\|[\s:|-]+\|$/.test(nextTrimmed);
        if (isTableHeader) {
          projectedLines.push(line);
          continue;
        }

        evaluatedClaims++;
        const rowVers = extractVersionedEntityAnchors(trimmed);
        const rowDates = extractCalendarDateCoordinates(trimmed, curYear);
        const inv = computeInvariantSupport(trimmed);

        // Rule T1: Disjoint versioned entity in table row -> project out
        if (rowVers.length > 0) {
          const hasAnySupportedVer = rowVers.some(v => verifiedVerAnchors.has(v));
          if (!hasAnySupportedVer) {
            prunedCount++;
            continue;
          }
        }

        // Rule T2: Unsupported calendar date coordinate in table row
        if (rowDates.length > 0) {
          const allDatesValid = rowDates.every(dc => isDateSupported(dc, trimmed));
          if (!allDatesValid) {
            // If entity IS supported in a specific dated evidence doc, project the date cell to the verified date!
            const { bestSim, bestDoc } = computeMaxDocSimilarity(trimmed);
            const hasSupportedVer = rowVers.length > 0 && rowVers.some(v => verifiedVerAnchors.has(v));
            if ((hasSupportedVer || bestSim >= 0.28) && bestDoc && bestDoc.ts !== null) {
              const dt = new Date(bestDoc.ts);
              const trueDateStr = `${dt.getUTCDate()} ${ID_MONTH_NAMES[dt.getUTCMonth() + 1]} ${dt.getUTCFullYear()}`;
              for (const badDc of rowDates) {
                if (!isDateSupported(badDc, trimmed) && badDc.raw) {
                  line = line.replace(badDc.raw, trueDateStr);
                  dateCorrections++;
                }
              }
              projectedLines.push(line);
              continue;
            }
            prunedCount++;
            continue;
          }
        }

        // Rule T3: Zero invariant support across multi-entity table row
        if (inv.count >= 2 && inv.ratio === 0) {
          prunedCount++;
          continue;
        }

        projectedLines.push(line);
        continue;
      }

      if (isTableSeparator) {
        projectedLines.push(line);
        continue;
      }

      // B. Heading Projection (## ... or **1. Title (Date)**)
      const isMarkdownHeading = /^#{1,6}\s+/.test(trimmed);
      const isBoldSubheading = /^\*\*(?:\d+\.\s*)?[^*\n]{4,90}\*\*\s*$/.test(trimmed);
      if (isMarkdownHeading || isBoldSubheading) {
        const hVers = extractVersionedEntityAnchors(trimmed);
        if (hVers.length > 0 && !hVers.some(v => verifiedVerAnchors.has(v))) {
          // Entire sub-section header is about a non-existent / stale parametric model!
          // Skip this heading AND skip immediately following bullets/lines belonging to this ungrounded entity until next heading/blank section
          prunedCount++;
          evaluatedClaims++;
          let j = i + 1;
          while (j < lines.length) {
            const nt = lines[j].trim();
            if (/^#{1,6}\s+/.test(nt) || /^\*\*(?:\d+\.\s*)?[^*\n]{4,90}\*\*\s*$/.test(nt) || /^\|.*\|$/.test(nt) || /^---+$/.test(nt)) {
              break;
            }
            if (nt) {
              const nextVers = extractVersionedEntityAnchors(nt);
              // Stop skipping if a new paragraph introduces a verified entity from E
              if (nextVers.length > 0 && nextVers.some(v => verifiedVerAnchors.has(v))) {
                break;
              }
            }
            j++;
          }
          i = j - 1;
          continue;
        }

        // Correct or strip unverified date inside a valid heading
        const hDates = extractCalendarDateCoordinates(trimmed, curYear);
        for (const dc of hDates) {
          if (!isDateSupported(dc, trimmed) && dc.raw) {
            const { bestDoc } = computeMaxDocSimilarity(trimmed);
            if (bestDoc && bestDoc.ts !== null) {
              const dt = new Date(bestDoc.ts);
              const trueDateStr = `${dt.getUTCDate()} ${ID_MONTH_NAMES[dt.getUTCMonth() + 1]} ${dt.getUTCFullYear()}`;
              line = line.replace(dc.raw, trueDateStr);
              dateCorrections++;
            }
          }
        }
        projectedLines.push(line);
        continue;
      }

      // C. Prose Paragraph / Bullet Item Projection
      const pVers = extractVersionedEntityAnchors(trimmed);
      const pDates = extractCalendarDateCoordinates(trimmed, curYear);

      if (pVers.length > 0 || pDates.length > 0) {
        evaluatedClaims++;

        // C1. Disjoint versioned entity assertion -> prune node & its unanchored child bullets in Markdown AST
        if (pVers.length > 0 && !pVers.some(v => verifiedVerAnchors.has(v))) {
          prunedCount++;
          const isTopBullet = /^\s*(?:[-*•]|\d+\.)\s+/.test(line);
          const curIndent = (line.match(/^\s*/) || [''])[0].length;
          let j = i + 1;
          while (j < lines.length) {
            const rawNext = lines[j];
            const nt = rawNext.trim();
            if (!nt) {
              // Peek past single blank line only if followed by child bullets of a non-bullet intro paragraph
              const afterBlank = (lines[j + 1] || '').trim();
              if (!isTopBullet && /^(?:[-*•])\s+/.test(afterBlank)) {
                j++;
                continue;
              }
              break;
            }
            if (/^#{1,6}\s+/.test(nt) || /^\|.*\|$/.test(nt) || /^---+$/.test(nt) || /^```/.test(nt)) break;
            const nextVers = extractVersionedEntityAnchors(nt);
            if (nextVers.length > 0 && nextVers.some(v => verifiedVerAnchors.has(v))) break;
            const nextIsBullet = /^\s*(?:[-*•]|\d+\.)\s+/.test(rawNext);
            const nextIndent = (rawNext.match(/^\s*/) || [''])[0].length;
            if (isTopBullet) {
              // Only skip deeper-indented sub-bullets belonging to this bullet
              if (nextIndent > curIndent) { j++; continue; }
              break;
            } else {
              // Parent prose paragraph was ungrounded: skip its child bullets
              if (nextIsBullet) { j++; continue; }
              break;
            }
          }
          i = j - 1;
          continue;
        }

        // C2. Unverified calendar date assertion
        if (pDates.length > 0) {
          const unsupportedDates = pDates.filter(dc => !isDateSupported(dc, trimmed));
          if (unsupportedDates.length > 0) {
            const hasSupportedVer = pVers.length > 0 && pVers.some(v => verifiedVerAnchors.has(v));
            const inv = computeInvariantSupport(trimmed);
            const { bestSim, bestDoc } = computeMaxDocSimilarity(trimmed);

            if ((hasSupportedVer || inv.ratio >= 0.5 || bestSim >= 0.25) && bestDoc && bestDoc.ts !== null) {
              // Entity/event IS grounded in bestDoc, project fabricated date onto verified timestamp
              const dt = new Date(bestDoc.ts);
              const trueDateStr = `${dt.getUTCDate()} ${ID_MONTH_NAMES[dt.getUTCMonth() + 1]} ${dt.getUTCFullYear()}`;
              for (const badDc of unsupportedDates) {
                if (badDc.raw) {
                  line = line.replace(badDc.raw, trueDateStr);
                  dateCorrections++;
                }
              }
            } else {
              // Neither date nor entity/invariant is grounded in E -> prune fabricated claim!
              prunedCount++;
              continue;
            }
          }
        }
      }

      projectedLines.push(line);
    }

    // 3. Clean up empty Markdown tables (header + separator with 0 remaining data rows) & orphaned headings
    const cleanedLines = [];
    for (let i = 0; i < projectedLines.length; i++) {
      const cur = projectedLines[i].trim();
      const nxt = (projectedLines[i + 1] || '').trim();
      const nxt2 = (projectedLines[i + 2] || '').trim();
      if (/^\|.*\|$/.test(cur) && /^\|[\s:|-]+\|$/.test(nxt) && !/^\|.*\|$/.test(nxt2)) {
        // Table lost all its ungrounded rows -> skip header & separator
        i += 1;
        continue;
      }
      cleanedLines.push(projectedLines[i]);
    }

    // Remove headings that became completely empty (followed immediately by another heading of same/higher level or EOF)
    const finalLines = [];
    for (let i = 0; i < cleanedLines.length; i++) {
      const cur = cleanedLines[i].trim();
      if (/^#{1,4}\s+/.test(cur)) {
        const curLevel = (cur.match(/^#+/) || [''])[0].length;
        let k = i + 1;
        while (k < cleanedLines.length && (!cleanedLines[k].trim() || /^---+$/.test(cleanedLines[k].trim()))) k++;
        if (k >= cleanedLines.length) continue;
        const nextNonEmpty = cleanedLines[k].trim();
        if (/^#{1,4}\s+/.test(nextNonEmpty)) {
          const nextLevel = (nextNonEmpty.match(/^#+/) || [''])[0].length;
          if (nextLevel <= curLevel) continue;
        }
      }
      finalLines.push(cleanedLines[i]);
    }

    const finalText = finalLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const hallucinationRate = evaluatedClaims > 0 ? (prunedCount / evaluatedClaims) : 0;

    return {
      text: finalText,
      prunedCount,
      dateCorrections,
      evaluatedClaims,
      hallucinationRate: Number(hallucinationRate.toFixed(4))
    };
  }

  // ============================================================================
  // 17. GERBANG INFORMASI SHANNON & DETEKSI KUERI AMBIGU / META-IMPERATIVE TANPA KONTEKS
  // Mencegah kolaps prior tanpa syarat saat kueri hanya berisi instruksi meta (misal "Jawab singkat saja")
  // atau merujuk ke media terlampir padahal tidak ada lampiran gambar/berkas (Dangling Media Deictic Query).
  // ============================================================================
  const DEICTIC_MEDIA_TOKENS = new Set([
    'gambar', 'gambarnya', 'foto', 'fotonya', 'image', 'images', 'photo', 'photos',
    'picture', 'pictures', 'screenshot', 'lampiran', 'terlampir', 'dilampirkan',
    'dokumen', 'file', 'pdf', 'diagram', 'grafik', 'skrinsut', 'isi', 'konten'
  ]);

  const META_IMPERATIVE_TOKENS = new Set([
    'jawab', 'jawablah', 'jawabannya', 'jawaban', 'singkat', 'saja', 'tolong', 'bantu', 'berikan', 'kasih',
    'coba', 'cobalah', 'silakan', 'mohon',
    'apa', 'mana', 'cepat', 'ya', 'dong', 'ini', 'itu', 'deh', 'lah', 'kan', 'nih',
    'analisis', 'analisa', 'jelaskan', 'sebutkan', 'uraikan', 'baca', 'bacakan', 'cek', 'periksa',
    'simpulkan', 'terjemahkan', 'artikan', 'tuliskan', 'tulis',
    'answer', 'respond', 'reply', 'give', 'me', 'the', 'please', 'just', 'briefly', 'shortly', 'quick', 'only',
    'analyze', 'analysis', 'explain', 'read', 'check', 'summarize'
  ]);

  function isZeroInformationQuery(prompt, hasImages = false, hasHistory = false) {
    if (hasImages || hasHistory) return false;
    if (!prompt || typeof prompt !== 'string') return true;
    const words = prompt.toLowerCase().replace(/[^a-z0-9_\u00C0-\u024F\s-]/gi, ' ').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const substantive = words.filter(w => !META_IMPERATIVE_TOKENS.has(w) && !DEICTIC_MEDIA_TOKENS.has(w));
    return substantive.length === 0;
  }

  // ============================================================================
  // 18. GERBANG ALJABAR & DETEKSI KONSEP DEDUKTIF MURNI (PURE CONCEPTUAL ALGEBRA)
  // Mendeteksi kueri yang terdiri dari himpunan konsep tertutup, taksonomi formal,
  // atau relasi aljabar/logika murni di mana Information Gain web search adalah nol:
  // IG(Search | Q) = 0. Menjaga agar penalaran deduktif model (seperti NVIDIA Nemotron)
  // tidak dikotori snippet pencarian acak atau dimusnahkan oleh template penolakan web.
  // ============================================================================
  function isPureAlgebraOrConceptualQuery(query) {
    if (!query || typeof query !== 'string') return false;
    const raw = query.trim();
    if (!raw) return false;
    const lower = raw.toLowerCase();

    // 0. Pengecualian mutlak: kueri naratif, biografi, sejarah, kisah hidup, atau pertanyaan profil tokoh
    // Pertanyaan ini membutuhkan sintesis fakta historis/biografis, bukan dekonstruksi simbolik murni!
    const isNarrativeOrBiographical = /\b(?:kisah\s+hidup|biografi|ceritakan|sejarah|riwayat|siapa\s+(?:itu|tokoh|sosok)|lahir|meninggal|kehidupan|profil|kronologi|karya\s+tulis|perjalanan\s+hidup)\b/i.test(lower);
    if (isNarrativeOrBiographical) return false;

    // Jika memuat indikator waktu aktual eksplisit (berita, hari ini, rilis baru, tahun ini), bukan konsep murni
    const hasTemporal = /\b(hari\s+ini|kemarin|sekarang|terbaru|terkini|minggu\s+ini|bulan\s+ini|tahun\s+ini|today|yesterday|right\s+now|latest|breaking|news|berita|harga|kurs|jadwal|cuaca|update|rilis|202[4-9])\b/i.test(lower);
    if (hasTemporal) return false;

    // Kriteria 1: Himpunan istilah konsep diskrit baris-demi-baris (2-8 baris konsep pendek)
    // Contoh eksplisit:
    // Competitive
    // Independent
    // Cooperative
    // Interdependent
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length >= 2 && lines.length <= 8) {
      const allShortConcepts = lines.every(l => {
        const wc = l.split(/\s+/).filter(Boolean).length;
        return wc >= 1 && wc <= 10 && !/^(?:tolong|halo|hai|buatkan|cari|apa|siapa|kenapa)\b/i.test(l);
      });
      if (allShortConcepts) return true;
    }

    // Kriteria 2: Istilah aljabar, matematika formal, logika simbolik, teori relasional, atau dikotomi konsep abstrak (EN + ID)
    const conceptualTermsRegex = /\b(?:matematika(?:\s+murni)?|pure\s+math|competitive|independent|cooperative|interdependent|zero-sum|non-zero-sum|game\s+theory|nash\s+equilibrium|social\s+interdependence|relational\s+algebra|boolean\s+algebra|truth\s+table|monoid|semigroup|group\s+theory|ring\s+theory|field\s+theory|isomorphism|homomorphism|bijection|injection|surjection|set\s+theory|predicate\s+logic|modal\s+logic|epistemic|ontology|taxonomy|dichotomy|trichotomy|inductive|deductive|abductive|apriori|a\s+priori|aposteriori|a\s+posteriori|modus\s+ponens|modus\s+tollens|contrapositive|tautology|contradiction|contingency|matrix|determinant|eigenvalue|eigenvector|vector\s+space|subspace|orthogonal|basis|dimension|kernel|nullity|topology|metric\s+space|limit|derivative|integral|turunan|diferensial|kalkulus|aljabar|matriks|vektor|aritmatika|persamaan|pertidaksamaan|trigonometri|geometri|peluang|probabilitas|permutasi|kombinasi|himpunan|teorema|aksioma|silogisme|premis|silogistis|kontradiksi|faktorial|logaritma|deret|barisan|calculus|algebra|polynomial|quadratic|logarithm|factorial|permutation|combination|syllogism|premise|axiom|theorem)\b/i;
    if (conceptualTermsRegex.test(lower)) return true;

    // Kriteria 3: Ekspresi simbolik matematika murni, fungsi, kalkulus, atau aritmatika numerik
    const hasSymbolicMath = /(?:[\d\w]\s*[\+\-\*\/\^=><≤≥≠≈]\s*[\d\w]|f\([a-z]\)\s*=|dy\/dx|d\/dx|\\(?:int|sum|prod|lim|frac|sqrt)|sqrt\s*\(|\bsin\s*\(|\bcos\s*\(|\btan\s*\(|\blog\s*\(|\bln\s*\(|\b\d+\s*[\*x×\+\-\/÷\^]\s*\d+\b)/i.test(raw);
    if (hasSymbolicMath) return true;

    // Kriteria 4: Struktur silogisme atau penalaran logika formal proposisional
    const hasFormalLogic = /\b(?:jika\s+(?:semua|ada|setiap|beberapa)|semua\s+\w+\s+adalah|apakah\s+(?:semua|setiap|ada)|if\s+all\s+|if\s+p\s+then\s+q)\b/i.test(lower);
    if (hasFormalLogic) return true;

    return false;
  }

  // =========================================================================
  // 19. DISAMBIGUASI ENTITAS MATEMATIKA MURNI (DAMERAU-LEVENSHTEIN & BAYESIAN POSTERIOR)
  // Menghilangkan distorsi prior halusinasi dan memetakan transliterasi fonetik / typo
  // ke identitas kanonikal resmi (misal: "jenos bolaly" -> János Bolyai, BUKAN John von Neumann).
  // =========================================================================

  function computeDamerauLevenshtein(s1, s2) {
    if (!s1 || !s2) return (s1 ? s1.length : (s2 ? s2.length : 0));
    const a = s1.toLowerCase();
    const b = s2.toLowerCase();
    const lenA = a.length;
    const lenB = b.length;
    const d = [];
    for (let i = 0; i <= lenA; i++) d[i] = [i];
    for (let j = 0; j <= lenB; j++) d[0][j] = j;
    for (let i = 1; i <= lenA; i++) {
      for (let j = 1; j <= lenB; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[lenA][lenB];
  }

  function computeNormalizedSimilarity(strA, strB) {
    if (!strA || !strB) return 0;
    const dist = computeDamerauLevenshtein(strA, strB);
    const maxLen = Math.max(strA.length, strB.length);
    if (maxLen === 0) return 1.0;
    return Math.max(0, 1.0 - (dist / maxLen));
  }

  const CANONICAL_SCIENTIFIC_ENTITIES = [
    {
      id: 'janos_bolyai',
      canonicalName: 'János Bolyai',
      variants: ['jenos bolaly', 'jenos bolyai', 'janos bolaly', 'janos bolyai', 'jennos bolaly', 'jenos bolai', 'bolyai', 'bolaly', 'bolai janos', 'bolaly jenos'],
      keywords: ['matematikawan', 'hongaria', 'hungary', 'hungaria', 'geometri', 'non-euklides', 'hiperbolik', 'matematika', 'farkas', 'gauss'],
      years: '1802–1860',
      nationality: 'Hungaria',
      field: 'Pelopor Geometri Non-Euklides (Hiperbolik)',
      disambiguationAvoid: ['John von Neumann', 'János Neumann', 'Neumann'],
      summary: 'János Bolyai adalah matematikawan legendaris asal Hungaria penemu independen geometri non-Euklides (geometri hiperbolik). Karya terbesarnya "The Absolute Science of Space" dipublikasikan tahun 1832 sebagai lampiran karya ayahnya, Farkas Bolyai.'
    },
    {
      id: 'john_von_neumann',
      canonicalName: 'John von Neumann (János Lajos Neumann)',
      variants: ['john von neumann', 'jhon fon neuman', 'von neumann', 'fon neuman', 'janos neumann', 'john von neuman', 'jhon neuman', 'jon von neuman'],
      keywords: ['komputer', 'game theory', 'teori permainan', 'arsitektur', 'kuantum', 'minimax', 'ias', 'princeton', 'automata'],
      years: '1903–1957',
      nationality: 'Hungaria-Amerika',
      field: 'Teori Permainan, Arsitektur Komputer Modern, Mekanika Kuantum, Teori Himpunan',
      disambiguationAvoid: ['János Bolyai', 'Bolyai'],
      summary: 'John von Neumann adalah polimatik Hungaria-Amerika penemu arsitektur Von Neumann, bapak teori permainan (teorema Minimax), dan perumus landasan matematika mekanika kuantum.'
    },
    {
      id: 'paul_erdos',
      canonicalName: 'Paul Erdős (Pál Erdős)',
      variants: ['paul erdos', 'pal erdos', 'erdos', 'pol erdos', 'erdos pal'],
      keywords: ['graf', 'kombinatorika', 'nomor erdos', 'bilangan', 'probabilistik'],
      years: '1913–1996',
      nationality: 'Hungaria',
      field: 'Teori Graf, Kombinatorika, Teori Bilangan Probabilistik',
      disambiguationAvoid: [],
      summary: 'Paul Erdős adalah matematikawan legendaris Hungaria pelopor teori graf dan metode kombinatorika probabilistik.'
    },
    {
      id: 'george_polya',
      canonicalName: 'George Pólya (György Pólya)',
      variants: ['george polya', 'gyorgy polya', 'polya', 'geor polya', 'polya gyorgy'],
      keywords: ['how to solve it', 'heuristik', 'pemecahan masalah', 'peluang'],
      years: '1887–1985',
      nationality: 'Hungaria-Amerika',
      field: 'Heuristik Matematika, Kombinatorika',
      disambiguationAvoid: [],
      summary: 'George Pólya adalah matematikawan Hungaria penulis buku monumental "How to Solve It".'
    },
    {
      id: 'carl_friedrich_gauss',
      canonicalName: 'Carl Friedrich Gauss',
      variants: ['carl friedrich gauss', 'karl friedrik gaus', 'gauss', 'gaus', 'friedrich gauss', 'carl gauss'],
      keywords: ['pangeran matematika', 'distribusi normal', 'aritmetika', 'bilangan'],
      years: '1777–1855',
      nationality: 'Jerman',
      field: 'Princeps Mathematicorum, Teori Bilangan, Analisis Matematis, Astronomi',
      disambiguationAvoid: [],
      summary: 'Carl Friedrich Gauss adalah salah satu matematikawan teragung sepanjang masa, pelopor teori bilangan modern dan kurva normal Gauss.'
    },
    {
      id: 'isaac_newton',
      canonicalName: 'Sir Isaac Newton',
      variants: ['isaac newton', 'ishak newton', 'isak newton', 'newton'],
      keywords: ['gravitasi', 'kalkulus', 'hukum gerak', 'optika', 'principia'],
      years: '1643–1727',
      nationality: 'Inggris',
      field: 'Kalkulus, Mekanika Klasik, Hukum Gravitasi Universal',
      disambiguationAvoid: [],
      summary: 'Sir Isaac Newton adalah raksasa sains penemu kalkulus independen dan perumus hukum mekanika serta gravitasi universal.'
    },
    {
      id: 'albert_einstein',
      canonicalName: 'Albert Einstein',
      variants: ['albert einstein', 'albert ainsten', 'ainsten', 'einsten', 'einstein'],
      keywords: ['relativitas', 'e=mc2', 'fotolistrik', 'fisika'],
      years: '1879–1955',
      nationality: 'Jerman-Amerika',
      field: 'Fisika Teoretis, Teori Relativitas Umum & Khusus',
      disambiguationAvoid: [],
      summary: 'Albert Einstein adalah fisikawan teoretis terkemuka penemu teori relativitas dan peraih Nobel Fisika 1921.'
    },
    {
      id: 'rene_descartes',
      canonicalName: 'René Descartes',
      variants: ['rene descartes', 'rene deskartes', 'descartes', 'deskartes'],
      keywords: ['kartesius', 'koordinat', 'filsafat', 'cogito'],
      years: '1596–1650',
      nationality: 'Prancis',
      field: 'Geometri Analitis (Sistem Koordinat Kartesius), Rasionalisme',
      disambiguationAvoid: [],
      summary: 'René Descartes adalah penemu sistem koordinat Kartesius yang menyatukan aljabar dan geometri serta bapak filsafat modern.'
    },
    {
      id: 'al_khwarizmi',
      canonicalName: 'Muhammad ibn Musa al-Khwarizmi',
      variants: ['al khawarizmi', 'al khwarizmi', 'alkhawarizmi', 'al-khwarizmi', 'khawarizmi'],
      keywords: ['aljabar', 'algoritma', 'angka nol', 'baghdad', 'baitul hikmah'],
      years: 'c. 780–850 M',
      nationality: 'Persia-Arab',
      field: 'Bapak Aljabar, Algoritma, Angka Indo-Arab',
      disambiguationAvoid: [],
      summary: 'Al-Khwarizmi adalah polimatik perintis aljabar ("Kitab al-Jabr wal-Muqabala") dan peletak dasar konsep algoritma.'
    },
    {
      id: 'leonhard_euler',
      canonicalName: 'Leonhard Euler',
      variants: ['leonhard euler', 'leonard euler', 'euler', 'oiler'],
      keywords: ['identitas euler', 'konstanta e', 'graf', 'konigsberg', 'analisis'],
      years: '1707–1783',
      nationality: 'Swiss',
      field: 'Teori Graf, Kalkulus, Analisis Kompleks',
      disambiguationAvoid: [],
      summary: 'Leonhard Euler adalah matematikawan paling produktif sepanjang masa, penemu teori graf dan identitas e^{i pi} + 1 = 0.'
    },
    {
      id: 'alan_turing',
      canonicalName: 'Alan Turing',
      variants: ['alan turing', 'turing', 'alan tyuring'],
      keywords: ['enigma', 'mesin turing', 'ai', 'komputasi'],
      years: '1912–1954',
      nationality: 'Inggris',
      field: 'Komputasi Teoretis, Pemecahan Kode Enigma, Mesin Turing',
      disambiguationAvoid: [],
      summary: 'Alan Turing adalah bapak ilmu komputer teoretis dan kecerdasan buatan, pemecah mesin sandi Enigma pada PD II.'
    },
    {
      id: 'bernhard_riemann',
      canonicalName: 'Bernhard Riemann',
      variants: ['bernhard riemann', 'bernhard riman', 'riemann', 'riman'],
      keywords: ['geometri riemann', 'hipotesis riemann', 'fungsi zeta', 'manifold'],
      years: '1826–1866',
      nationality: 'Jerman',
      field: 'Geometri Diferensial, Analisis Kompleks, Teori Bilangan',
      disambiguationAvoid: [],
      summary: 'Bernhard Riemann adalah pelopor geometri eliptik non-Euklides (geometri Riemann) dan pencetus Hipotesis Riemann.'
    }
  ];

  function resolveEntityPhoneticallyMathematically(promptText) {
    if (!promptText || typeof promptText !== 'string') return null;
    const cleanPrompt = promptText.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanPrompt.length < 3) return null;

    let bestEntity = null;
    let bestScore = 0;
    let matchedVariant = '';

    const words = cleanPrompt.split(/\s+/).filter(w => w.length >= 3);
    const ngrams = [];
    for (let i = 0; i < words.length; i++) {
      ngrams.push(words[i]);
      if (i < words.length - 1) ngrams.push(`${words[i]} ${words[i + 1]}`);
      if (i < words.length - 2) ngrams.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }

    for (const ent of CANONICAL_SCIENTIFIC_ENTITIES) {
      let maxSimForEntity = 0;
      let matchedVarForEntity = '';

      for (const variant of ent.variants) {
        if (cleanPrompt.includes(variant)) {
          maxSimForEntity = Math.max(maxSimForEntity, 1.0);
          matchedVarForEntity = variant;
          break;
        }
        for (const ng of ngrams) {
          const sim = computeNormalizedSimilarity(ng, variant);
          if (sim > maxSimForEntity) {
            maxSimForEntity = sim;
            matchedVarForEntity = variant;
          }
        }
      }

      // Hitung bobot kata kunci pembantu (misal: "matematikawan", "hongaria")
      let kwOverlap = 0;
      for (const kw of ent.keywords) {
        if (cleanPrompt.includes(kw)) kwOverlap++;
      }
      const kwBonus = Math.min(0.25, (kwOverlap * 0.12));
      const totalScore = (maxSimForEntity * 0.75) + kwBonus;

      if (totalScore > bestScore && maxSimForEntity >= 0.68) {
        bestScore = totalScore;
        bestEntity = ent;
        matchedVariant = matchedVarForEntity;
      }
    }

    if (bestEntity && bestScore >= 0.70) {
      const avoidWarn = (bestEntity.disambiguationAvoid && bestEntity.disambiguationAvoid.length > 0)
        ? `\n- PERINGATAN INTEGRITAS & ANTI-ASOSIASI KELIRU: DILARANG KERAS menukar, mengaitkan, atau mengganti subjek ini dengan ${bestEntity.disambiguationAvoid.join(' atau ')}. Subjek resmi yang diminta pengguna secara eksak adalah ${bestEntity.canonicalName}.`
        : '';

      const directive = `### RESOLUSI IDENTITAS ENTITAS MATEMATIKA MURNI (BAYESIAN DISAMBIGUATION — P(E|Q) >= 0.99)
[SUBJEK TERVERIFIKASI SECARA DEDUKTIF]:
- Kueri Pengguna: "${promptText}"
- Tokoh yang Dimaksud Pengguna: ${bestEntity.canonicalName} (${bestEntity.years})
- Kebangsaan & Peran: ${bestEntity.nationality} — ${bestEntity.field}.${avoidWarn}
- Intisari Biografis: ${bestEntity.summary}

[MANDAT KONTEN & FORMAT]:
1. Anda WAJIB menyajikan biografi / kisah hidup lengkap tentang ${bestEntity.canonicalName} (${bestEntity.years}) secara runut, mendalam, dan utuh.
2. DILARANG KERAS menceritakan tokoh lain!`;

      return {
        resolved: true,
        entityId: bestEntity.id,
        canonicalName: bestEntity.canonicalName,
        years: bestEntity.years,
        nationality: bestEntity.nationality,
        field: bestEntity.field,
        summary: bestEntity.summary,
        avoidNames: bestEntity.disambiguationAvoid,
        score: Number(bestScore.toFixed(4)),
        directive
      };
    }

    return null;
  }

  // =========================================================================
  // 20. NEGATIVE FORMATTING CONSTRAINT ENGINE (KONTROL ALJABAR BOOLE ATAS FORMAT)
  // Menjamin larangan pengguna (seperti "tanpa tabel", "jangan buat tabel", dsb.)
  // dipatuhi 100% dan tidak pernah ditimpa oleh prompt sistem default.
  // =========================================================================

  function extractNegativeFormattingConstraints(queryText) {
    if (!queryText || typeof queryText !== 'string') {
      return { noTable: false, noCode: false, isExhaustive: false, directive: '' };
    }
    const text = queryText.toLowerCase();
    const noTable = /\b(?:tanpa\s+tabel|jangan\s+(?:pakai|gunakan|buat)\s+tabel|tidak\s+perlu\s+tabel|no\s+tables?|without\s+tables?)\b/i.test(text);
    const noCode = /\b(?:tanpa\s+kode|jangan\s+(?:tulis|buat)\s+kode|no\s+code)\b/i.test(text);
    const isExhaustive = /\b(?:fuul|full|lengkap|komprehensif|tuntas|detail|mendalam|seluruh|episode|semua\s+bab)\b/i.test(text);

    const directives = [];
    if (noTable) {
      directives.push(`[BATASAN FORMAT WAJIB — TANPA TABEL]: Pengguna secara tegas melarang penyajian dalam bentuk tabel ("tanpa tabel"). DILARANG KERAS menyajikan tabel Markdown; gunakan narasi paragraf komprehensif yang mengalir dan poin deskriptif terstruktur.`);
    }
    if (noCode) {
      directives.push(`[BATASAN FORMAT WAJIB — TANPA KODE]: Pengguna melarang kode pemrograman. Sajikan hanya penjelasan konseptual/teks naratif.`);
    }
    if (isExhaustive) {
      directives.push(`[MANDAT KEDALAMAN]: Pengguna meminta penjabaran lengkap/full episode. Sajikan biografi/pembahasan secara tuntas, runut, dan mendalam.`);
    }

    return {
      noTable,
      noCode,
      isExhaustive,
      directive: directives.join('\n\n')
    };
  }

  // =========================================================================
  // PURE MATHEMATICAL PERSONA PERSISTENCE & IN-CONTEXT ANTI-DRIFT SENSOR
  // Aljabar Resonansi Perhatian Multiturn \Pi_{res} & Purifikasi Riwayat Halusinasi \Pi_{purify}
  // Menghilangkan Attention Decay \exp(-\gamma \cdot \Delta pos) dan mencegah Induction Heads
  // meniru residu sistem atau pembelokan persona dari giliran riwayat lampau.
  // =========================================================================

  /**
   * Pemurnian Deterministik Giliran Asisten Riwayat (\Pi_{purify}).
   * Memproyeksikan riwayat pesan asisten ke subruang bebas-halusinasi sebelum dikirim ke LLM.
   */
  function purifyHistoricalAssistantTurn(text, options = {}) {
    if (typeof text !== 'string' || !text) return '';
    let out = stripReasoningText(text);

    // 1. Bersihkan segala bentuk residu internal tool / pseudotool / status penelusuran sistem
    out = out.replace(/^\[(?:Pencarian selesai|STATUS PENELUSURAN|Mengeksekusi penelusuran|DATA PENELUSURAN|HASIL|PANDUAN SINTESIS|ALUR VERIFIKASI|SPESIFIKASI SINTESIS)[^\]]*\]\.?\s*/gim, '');
    out = out.replace(/\[(?:Pencarian selesai|STATUS PENELUSURAN|Mengeksekusi penelusuran|DATA PENELUSURAN FAKTA|DATA HASIL PENELUSURAN INTERNAL|HASIL prepare_image_display|HASIL search_images|HASIL eksekusi|ALUR VERIFIKASI VISUAL AKTIF|SPESIFIKASI SINTESIS BUKTI|HASIL EKSEKUSI TOOL|BATASAN DOMAIN KLAIM)[^\]]*\]/gi, '');
    out = out.replace(/(?:^|\n)\s*Sistem menyelesaikan penelusuran\.?\s*(?:\n|$)/gi, '\n');
    out = out.replace(/(?:^|\n)\s*Model telah menyelesaikan penelusuran komprehensif atas kueri Anda\.?\s*(?:\n|$)/gi, '\n');
    out = out.replace(/\[(?:Model Penjawab|Model|AI Model|Konteks Percakapan|Konteks Silsilah|Konteks Internal|Catatan Konteks):[^\]]*\]\s*/gi, '');

    // 2. Bersihkan penyangkalan persona & klise pembuka AI generik yang mendistorsi induction heads
    out = out.replace(/^(?:Sebagai|Saya adalah)\s+(?:sebuah\s+|seorang\s+)?(?:model\s+AI|asisten\s+AI|AI\s+language\s+model|kecerdasan\s+buatan|large\s+language\s+model|asisten\s+virtual)[^,\n.]*[,.]\s*(?:namun\s+|tetapi\s+|saya\s+)?/i, '');
    out = out.replace(/^(?:Sebagai\s+AI|As\s+an\s+AI)[^,\n.]*[,.]\s*/i, '');
    out = out.replace(/^(?:Saya\s+tidak\s+memiliki\s+persona|I\s+do\s+not\s+have\s+a\s+persona)[^,\n.]*[,.]\s*/i, '');
    out = out.replace(/^(?:Mohon\s+maaf,\s+)?(?:saya\s+tidak\s+dapat\s+berperan\s+sebagai|saya\s+hanya\s+bisa\s+membantu\s+sebagai\s+AI)[^,\n.]*[,.]\s*/i, '');

    // 3. Bersihkan sisa token display tunggal yang tertinggal tanpa teks
    out = out.replace(/^\[\[?ZOZ_IMAGE_DISPLAY:disp_[a-zA-Z0-9_-]+\]?\]?\s*$/gim, '');

    return out.trim();
  }

  /**
   * Vektor Resonansi Persona Deterministik (\Pi_{res}).
   * Dinonaktifkan pada pesan user (mengembalikan string kosong) agar pesan user
   * tidak pernah tercemar teks tambahan di ujung giliran aktif (menjaga SNR(X_t) = 1.0).
   * Persona pengguna tetap dipertahankan secara utuh di dalam role: 'system'.
   */
  function computePersonaResonanceVector(_activePersona, _turnCount = 1) {
    return '';
  }

  /**
   * Sensor Anti-Drift Output Model (\Pi_{anti-drift}).
   * Menjamin respon model tidak menyangkal persona aktif atau membocorkan residu pencarian.
   */
  function sanitizeModelPersonaDrift(text, activePersona = '') {
    if (typeof text !== 'string' || !text) return '';
    let out = text;

    // Bersihkan residu pseudotool di awal teks
    out = out.replace(/^\[(?:Pencarian selesai|STATUS PENELUSURAN|Mengeksekusi penelusuran)[^\]]*\]\.?\s*/i, '');
    out = out.replace(/^Sistem menyelesaikan penelusuran\.?\s*/i, '');

    // Bersihkan pembuka penyangkalan persona AI
    out = out.replace(/^(?:Sebagai|Saya adalah)\s+(?:sebuah\s+|seorang\s+)?(?:model\s+AI|asisten\s+AI|AI\s+language\s+model|kecerdasan\s+buatan|large\s+language\s+model|asisten\s+virtual)[^,\n.]*[,.]\s*(?:namun\s+|tetapi\s+|saya\s+)?/i, '');
    out = out.replace(/^(?:Sebagai\s+AI|As\s+an\s+AI)[^,\n.]*[,.]\s*/i, '');
    out = out.replace(/^(?:Saya\s+tidak\s+memiliki\s+persona|I\s+do\s+not\s+have\s+a\s+persona)[^,\n.]*[,.]\s*/i, '');
    out = out.replace(/^(?:Mohon\s+maaf,\s+)?(?:saya\s+tidak\s+dapat\s+berperan\s+sebagai|saya\s+hanya\s+bisa\s+membantu\s+sebagai\s+AI)[^,\n.]*[,.]\s*/i, '');

    return out.trim();
  }

  return {
    cleanPseudoCotJson,
    isZeroInformationQuery,
    isPureAlgebraOrConceptualQuery,
    splitReasoningAndContent,
    stripReasoningText,
    reflowShreddedProse,
    createThinkTagStripper,
    createProviderStreamFilter,
    extractIntentVector,
    computeStreamMetrics,
    synthesizeAutoregressivePrefill,
    computeErdosIntentGraph,
    computeSzegoToeplitzSpectrum,
    konigBipartiteMatchHunk,
    detectIncompleteEditStream,
    stitchContinuationOverlap,
    graftPartialHtmlFragment,
    createHyperbolicManifold,
    createEntropyStreamGate,
    parseAuthenticTimestamp,
    extractCalendarDateCoordinates,
    extractVersionedEntityAnchors,
    computeTemporalRecencyProfile,
    expandMorphologicalAndBilingualVariants,
    extractEssentialTokensIR,
    rankDocumentsMathematically,
    computeBayesianDecisionCalibration,
    computeOptimalSamplingTemperature,
    projectGroundedResponseMathematically,
    purifyHistoricalAssistantTurn,
    computePersonaResonanceVector,
    sanitizeModelPersonaDrift,
    stripInjectedSystemTagsFromUserText,
    isRevisionQuery,
    isPostHocProjectionQuery,
    identifyChosenOptionsInAssistantTurn,
    extractParentQuizContext,
    computeDamerauLevenshtein,
    resolveEntityPhoneticallyMathematically,
    extractNegativeFormattingConstraints,
    extractFallbackConclusionFromUnclosedThought,
    computeMathematicalErrorAversion,
    detectGroundTruthCorrectionOrExplanation
  };
});
