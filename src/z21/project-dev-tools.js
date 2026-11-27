/**
 * Z21 Active-Project & Antigravity Multi-Root Agentic Dev Tools (v845)
 *
 * 6 Core Tools across Active Workspaces + Unified Permission Engine (Deny > Ask > Allow):
 *   1. run_command(command, cwd?, timeout_ms?, sandbox_mode?)
 *   2. read_file(path, start_line?, end_line?)
 *   3. write_file(path, content, mode?)
 *   4. edit_file(path, target, replacement, replace_all?)
 *   5. list_dir(path?, depth?, include_hidden?, sort_by?)
 *   6. grep_search(query, path?, is_regex?, case_sensitive?, include_glob?, max_results?)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawn, execFileSync } = require('child_process');

const DEFAULT_TIMEOUT_MS = 20000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30000;
const DEFAULT_MAX_OUTPUT_CHARS = 5000;
const DEFAULT_DOCKER_IMAGE = process.env.ZOZ_Z21_DOCKER_IMAGE || 'node:20-alpine';

const VALID_PERMISSION_PRESETS = new Set(['request-review', 'default', 'auto', 'turbo']);
const USER_FOLDER_SHORTHANDS = new Map([
  ['downloads', 'Downloads'],
  ['unduhan', 'Downloads'],
  ['documents', 'Documents'],
  ['desktop', 'Desktop'],
  ['pictures', 'Pictures'],
  ['videos', 'Videos'],
  ['music', 'Music']
]);

const BLOCKED_SECRET_SEGMENTS = new Set([
  '.git',
  '.ssh',
  '.gnupg',
  '.aws',
  '.kube',
  '.docker'
]);

const SENSITIVE_BASENAMES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.npmrc',
  '.pypirc',
  '.netrc',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  'credentials.json',
  'service-account.json',
  'serviceAccountKey.json'
]);

const SENSITIVE_EXTS = new Set([
  '.pem',
  '.key',
  '.pfx',
  '.p12',
  '.jks',
  '.keystore',
  '.kdbx'
]);

const WINDOWS_RESERVED_RE = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;
const SHELL_CHAINING_RE = /[;&|><`\r\n]|\$\(/;

const DEFAULT_SAFE_WHITELIST_PATTERNS = [
  /^(?:ls|dir)(?:\s+(?:[-a-zA-Z0-9_./\\~:%]+|"[^"]+"|'[^']+'))*$/i,
  /^get-childitem(?:\s+(?:[-a-zA-Z0-9_./\\~:%]+|"[^"]+"|'[^']+'))*$/i,
  /^pwd$/i,
  /^whoami$/i,
  /^hostname$/i,
  /^ipconfig(?:\s+\/(?:all|displaydns))?$/i,
  /^netsh\s+wlan\s+show\s+(?:interfaces|interface|networks|network|drivers)$/i,
  /^netsh\s+interface\s+(?:ip|ipv4|ipv6)\s+show\s+(?:config|addresses|stats|interfaces)$/i,
  /^netstat(?:\s+-[a-zA-Z]+)*$/i,
  /^arp\s+-a$/i,
  /^route\s+print$/i,
  /^tracert(?:\s+[-dwh]+\s+\d+)*\s+[a-zA-Z0-9.-]+$/i,
  /^nslookup\s+[a-zA-Z0-9.-]+$/i,
  /^systeminfo$/i,
  /^tasklist$/i,
  /^where(?:\.exe)?\s+[a-zA-Z0-9_.-]+$/i,
  /^get-(?:netconnectionprofile|netipconfiguration|netipaddress|netroute|dnsclientserveraddress|process|service|psdrive|volume|computerinfo)$/i,
  /^get-netadapter(?:\s+-physical)?$/i,
  /^ping\s+(?:-[ncw]\s+\d+\s+)*[a-zA-Z0-9.-]+$/i,
  /^git\s+(?:status|branch|log|diff|show)(?:\s+[-a-zA-Z0-9_./=~^:@]+)*$/i,
  /^node\s+(?:-v|--version)$/i,
  /^node\s+--check\s+[a-zA-Z0-9_./\\-]+$/i,
  /^(?:npm|pnpm|yarn|python|python3|pytest)\s+(?:-v|--version)$/i
];

const Z21_PROJECT_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'run_command',
      description:
        'Jalankan perintah shell/CLI pada Active Workspaces (proyek aktif, ~ / ~/Downloads / ~/Documents / ~/Desktop, atau path lokal sesuai Antigravity Permission Engine Deny > Ask > Allow). Mendukung multi-shell (powershell, cmd, bash, wsl, node, python), pipeline (|), chaining (&& / ;), sticky cwd, async backgrounding via wait_ms_before_async, daemon persisten (is_daemon: true), serta eksekusi ke tab ZOZ Terminal aktif (terminal_session).',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Perintah shell untuk dieksekusi.'
          },
          cwd: {
            type: 'string',
            description: 'Direktori kerja relatif, path "~" / "~/Downloads", atau path absolut lokal (mewarisi cwd sesi bila dikosongkan).'
          },
          shell: {
            type: 'string',
            enum: ['auto', 'powershell', 'cmd', 'bash', 'wsl', 'node', 'python'],
            description: 'Target runtime shell (default "auto").'
          },
          wait_ms_before_async: {
            type: 'integer',
            description: 'Tunggu sinkron dalam ms (500-30000) sebelum otomatis berpindah menjadi background task_id alih-alih dimatikan.'
          },
          is_daemon: {
            type: 'boolean',
            description: 'Set true untuk proses latar persisten tanpa batas waktu (dev server, watcher, tunnel) -> langsung kembalikan task_id.'
          },
          terminal_session: {
            type: 'string',
            description: 'Opsional: ID tab PTY terminal aktif ZOZ Router (mis. "tab-1-p1") untuk menjalankan perintah di shell interaktif pengguna.'
          },
          timeout_ms: {
            type: 'integer',
            description: 'Batas waktu sinkron jika tidak memakai wait_ms_before_async / is_daemon (1000 - 30000 ms).'
          },
          sandbox_mode: {
            type: 'string',
            enum: ['host', 'auto', 'docker', 'bwrap', 'sandbox-exec'],
            description: 'Mode isolasi eksekusi: host (dengan Y/N HITL), auto, atau container sandbox.'
          }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'manage_task',
      description:
        'Pantau, baca log terbaru, kirim input/Ctrl+C (stdin), atau hentikan proses background/daemon hasil run_command serta sesi PTY terminal ZOZ yang aktif.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'status', 'send_input', 'kill'],
            description: 'list: daftar task & PTY aktif; status: cek status & log baru; send_input: kirim teks/jawaban stdin; kill: hentikan proses.'
          },
          task_id: {
            type: 'string',
            description: 'ID tugas (mis. "task-1" atau "pty:tab-1-p1"). Wajib untuk status, send_input, dan kill.'
          },
          input: {
            type: 'string',
            description: 'Teks input stdin untuk action "send_input" (contoh: "y\\n" atau "<ctrl+c>").'
          },
          wait_ms: {
            type: 'integer',
            description: 'Opsional untuk action "status": tunggu hingga wait_ms (0-15000 ms) sampai ada keluaran/selesai.'
          }
        },
        required: ['action']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Baca isi berkas teks/kode secara langsung dari Active Workspaces (proyek aktif, ~/Downloads, ~/Documents, ~/Desktop, atau path lokal penuh sesuai izin Antigravity). Pada berkas sedang/besar, utamakan tool `select_lines` agar tidak kewalahan membaca seluruh isi berkas.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path file relatif proyek, shorthand user ("~/Downloads/catatan.txt", "Downloads/a.txt"), atau path absolut lokal.'
          },
          start_line: {
            type: 'integer',
            description: 'Baris awal 1-based (opsional).'
          },
          end_line: {
            type: 'integer',
            description: 'Baris akhir inklusif 1-based (opsional).'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'select_lines',
      description:
        'Pilih dan tampilkan HANYA baris yang relevan pada berkas (lewat outline:true peta struktur kode dengan rentang baris, pencarian query/symbol/keywords + context_lines, around_line, atau beberapa rentang baris ranges sekaligus) TANPA membaca seluruh berkas. Output bernomor baris "NNN: ..." siap dipakai langsung di edit_file.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path file relatif proyek, "~/Downloads/...", atau path absolut lokal.'
          },
          ranges: {
            type: 'array',
            description: 'Opsional: Daftar rentang baris pilihan, mis. ["15-40", "180-220"] atau [{"start_line":10,"end_line":40}].',
            items: { type: 'string' }
          },
          start_line: {
            type: 'integer',
            description: 'Opsional (1-based): Nomor baris awal tunggal bila tidak memakai ranges.'
          },
          end_line: {
            type: 'integer',
            description: 'Opsional (1-based): Nomor baris akhir inklusif tunggal.'
          },
          limit: {
            type: 'integer',
            description: 'Opsional: Jumlah baris yang diambil mulai dari start_line.'
          },
          around_line: {
            type: 'integer',
            description: 'Opsional (1-based): Tampilkan konteks di sekitar nomor baris target ini (±context_lines).'
          },
          context_lines: {
            type: 'integer',
            description: 'Opsional: Jumlah baris konteks sebelum & sesudah target/match (default 8 untuk query/symbol, 15 untuk around_line).'
          },
          query: {
            type: 'string',
            description: 'Opsional: Kata kunci / teks / pola regex untuk langsung memilih blok baris yang cocok beserta konteksnya.'
          },
          symbol: {
            type: 'string',
            description: 'Opsional: Nama fungsi, class, ID DOM, atau selector CSS yang ingin dicari definisi & barisnya.'
          },
          keywords: {
            type: 'array',
            description: 'Opsional: Beberapa kata kunci yang ingin dilihat baris konteksnya sekaligus dalam satu panggilan.',
            items: { type: 'string' }
          },
          outline: {
            type: 'boolean',
            description: 'Opsional: Set true untuk melihat peta struktur & rentang baris tiap blok (fungsi, style, script, section) tanpa memuat seluruh file.'
          },
          is_regex: {
            type: 'boolean',
            description: 'Opsional: Perlakukan query sebagai regex (default false).'
          },
          case_sensitive: {
            type: 'boolean',
            description: 'Opsional: Cocokkan huruf besar/kecil (default false).'
          },
          max_matches: {
            type: 'integer',
            description: 'Opsional: Batas jumlah jendela match yang diambil (1-20, default 10).'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Tulis atau tambahkan isi ke berkas pada Active Workspaces (proyek aktif, ~/Downloads, ~/Documents, ~/Desktop, atau path lokal yang diizinkan). Otomatis membuat folder induk yang belum ada.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path file relatif proyek, shorthand user ("~/Downloads/note.txt"), atau path absolut lokal.'
          },
          content: {
            type: 'string',
            description: 'Isi teks lengkap atau konten tambahan untuk ditulis.'
          },
          mode: {
            type: 'string',
            enum: ['overwrite', 'append'],
            description: 'Mode penulisan: overwrite (default) atau append.'
          }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description:
        'Tambal atau ganti potongan teks/kode tertentu secara presisi pada berkas di Active Workspaces (~ / ~/Downloads / proyek aktif / path lokal) tanpa menulis ulang seluruh file. Mendukung mode target + replacement ATAU rentang baris langsung start_line + end_line + replacement serta array edits.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path berkas relatif proyek, "~/Downloads/...", atau path absolut lokal.'
          },
          target: {
            type: 'string',
            description: 'Teks lama eksak yang akan diganti (sertakan konteks & indentasi). Opsional jika memakai start_line + end_line.'
          },
          replacement: {
            type: 'string',
            description: 'Teks baru pengganti target atau rentang baris start_line..end_line.'
          },
          start_line: {
            type: 'integer',
            description: 'Opsional (1-based): Nomor baris awal untuk mengganti rentang baris langsung atau mempersempit target.'
          },
          end_line: {
            type: 'integer',
            description: 'Opsional (1-based): Nomor baris akhir untuk mengganti rentang baris (maks 350 baris).'
          },
          replace_all: {
            type: 'boolean',
            description: 'Jika true, ganti semua kemunculan target (default false).'
          },
          edits: {
            type: 'array',
            description: 'Opsional: daftar objek [{ target, replacement, start_line, end_line, replace_all }] untuk beberapa edit sekaligus.',
            items: { type: 'object' }
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'grep_search',
      description:
        'Cari kata kunci atau pola teks/regex di dalam berkas pada Active Workspaces (proyek aktif, ~/Downloads, ~/Documents, atau path lokal) secara cepat.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Teks atau pola regex yang dicari.'
          },
          path: {
            type: 'string',
            description: 'Folder/file target relatif proyek (default "."), "~/Downloads", atau path absolut lokal.'
          },
          is_regex: {
            type: 'boolean',
            description: 'Perlakukan query sebagai regex (default false).'
          },
          case_sensitive: {
            type: 'boolean',
            description: 'Cocokkan huruf besar/kecil (default false).'
          },
          include_glob: {
            type: 'string',
            description: 'Filter nama/ekstensi berkas opsional (contoh: "*.js", "*.py").'
          },
          max_results: {
            type: 'integer',
            description: 'Maksimum kecocokan dikembalikan (1 - 100, default 40).'
          },
          context_lines: {
            type: 'integer',
            description: 'Opsional (0 - 15): Sertakan N baris konteks sebelum dan sesudah tiap kecocokan.'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description:
        'Lihat daftar berkas dan folder beserta ukuran serta waktu modifikasi pada Active Workspaces (proyek aktif ".", "~/Downloads", "Downloads", "~/Documents", "~/Desktop", "~", atau path lokal).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Folder target: ".", "~", "~/Downloads", "Downloads", "~/Desktop", atau path absolut lokal.'
          },
          depth: {
            type: 'integer',
            description: 'Kedalaman rekursi traversal (1 - 4, default 2).'
          },
          sort_by: {
            type: 'string',
            enum: ['name', 'modified', 'size'],
            description: 'Urutkan hasil berdasarkan name (default), modified (terbaru dulu), atau size.'
          },
          include_hidden: {
            type: 'boolean',
            description: 'Sertakan berkas tersembunyi non-rahasia (default false; .env & kredensial tetap diblokir).'
          }
        }
      }
    }
  }
];

let cachedAntigravityTrusted = null;
let cachedAntigravityTrustedAt = 0;

function resolveProjectRoot(customRoot) {
  const raw = String(customRoot || process.env.ZOZ_ACTIVE_PROJECT_ROOT || process.cwd()).trim();
  const abs = path.resolve(raw);
  try {
    return fs.realpathSync(abs);
  } catch (err) {
    console.warn('[z21/project-dev-tools] realpathSync root fallback:', err.message);
    return abs;
  }
}

function isContainedInsideRealRoot(realRoot, targetPath) {
  const a = process.platform === 'win32' ? String(realRoot || '').toLowerCase() : String(realRoot || '');
  const b = process.platform === 'win32' ? String(targetPath || '').toLowerCase() : String(targetPath || '');
  const rel = path.relative(a, b);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function isCriticalSystemPath(targetPath) {
  const p = String(targetPath || '').trim();
  if (!p) return false;
  const fwd = p.replace(/\\/g, '/').toLowerCase();
  if (/^(?:[a-z]:)?\/windows(?:\/|$)/.test(fwd)) return true;
  if (/^\/(?:etc|proc|sys|root)(?:\/|$)/.test(fwd)) return true;
  if (/\/user data\/(?:default|profile \d+)\/(?:login data|web data|cookies)$/i.test(fwd)) return true;
  return false;
}

function isBareDriveOrRoot(dirPath) {
  const clean = String(dirPath || '').trim().replace(/[\\/]+$/, '');
  return !clean || /^[a-zA-Z]:$/.test(clean) || clean === '/';
}

function loadAntigravityTrustedWorkspaces() {
  const now = Date.now();
  if (cachedAntigravityTrusted && now - cachedAntigravityTrustedAt < 60000) {
    return cachedAntigravityTrusted;
  }
  const results = [];
  try {
    const settingsPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const list = Array.isArray(parsed && parsed.trustedWorkspaces) ? parsed.trustedWorkspaces : [];
      for (const rawEntry of list) {
        const clean = String(rawEntry || '').trim();
        if (!clean || isBareDriveOrRoot(clean) || isCriticalSystemPath(clean)) continue;
        try {
          if (fs.existsSync(clean) && fs.statSync(clean).isDirectory()) {
            results.push(fs.realpathSync(clean));
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[z21/project-dev-tools] loadAntigravityTrustedWorkspaces warn:', err.message);
  }
  cachedAntigravityTrusted = results;
  cachedAntigravityTrustedAt = now;
  return results;
}

function isPathInsideAnyRoot(targetPath, roots) {
  if (!Array.isArray(roots) || !targetPath) return null;
  for (const r of roots) {
    if (r && isContainedInsideRealRoot(r, targetPath)) {
      return r;
    }
  }
  return null;
}

function resolveZ21WorkspaceContext(customRoot, options = {}) {
  const hasExplicitCustom = Boolean(customRoot && String(customRoot).trim());
  const hasExplicitEnv = Boolean(process.env.ZOZ_ACTIVE_PROJECT_ROOT && String(process.env.ZOZ_ACTIVE_PROJECT_ROOT).trim());
  const explicitSingleRoot = Boolean(
    options.isolatedSingleRoot ||
    (!options.enableUserHome && !Array.isArray(options.trustedRoots) && (hasExplicitCustom || hasExplicitEnv))
  );
  const primaryRoot = resolveProjectRoot(customRoot);
  const userHome = resolveProjectRoot(options.userHome || os.homedir());
  const presetRaw = String(options.permissionPreset || '').trim().toLowerCase();
  const permissionPreset = VALID_PERMISSION_PRESETS.has(presetRaw) ? presetRaw : null;

  const realizeDir = (dirCandidate) => {
    const clean = String(dirCandidate || '').trim();
    if (!clean || isBareDriveOrRoot(clean) || isCriticalSystemPath(clean)) return null;
    try {
      const abs = path.resolve(clean);
      const real = fs.existsSync(abs) ? fs.realpathSync(abs) : abs;
      if (isBareDriveOrRoot(real) || isCriticalSystemPath(real)) return null;
      return real;
    } catch (_) {
      return null;
    }
  };

  const rootSet = new Map();
  const pushRoot = (r) => {
    const real = realizeDir(r);
    if (!real) return;
    const key = process.platform === 'win32' ? real.toLowerCase() : real;
    if (!rootSet.has(key)) rootSet.set(key, real);
  };

  pushRoot(primaryRoot);
  if (!explicitSingleRoot) {
    if (options.enableUserHome !== false) {
      pushRoot(userHome);
    }
    const hasCustomUserHome = Boolean(
      options.userHome &&
      String(options.userHome).trim() &&
      path.resolve(String(options.userHome)) !== path.resolve(os.homedir())
    );
    if (!options.skipAntigravitySettings && !hasCustomUserHome) {
      for (const tw of loadAntigravityTrustedWorkspaces()) pushRoot(tw);
    }
    if (Array.isArray(options.trustedRoots)) {
      for (const tr of options.trustedRoots) pushRoot(tr);
    }
  } else if (Array.isArray(options.trustedRoots)) {
    for (const tr of options.trustedRoots) pushRoot(tr);
  }
  if (Array.isArray(options.grantedRoots)) {
    for (const gr of options.grantedRoots) pushRoot(gr);
  }

  const nonWorkspacePolicy = options.nonWorkspacePolicy
    ? String(options.nonWorkspacePolicy).toLowerCase()
    : ((explicitSingleRoot && !permissionPreset) ? 'deny' : 'preset');

  return {
    explicitSingleRoot,
    primaryRoot,
    userHome,
    enableUserHome: !explicitSingleRoot && options.enableUserHome !== false,
    trustedRoots: Array.from(rootSet.values()),
    permissionPreset,
    nonWorkspacePolicy
  };
}

function expandUserPathInput(rawInput, primaryRoot, userHome, enableUserHome = false) {
  let raw = rawInput === undefined || rawInput === null ? '' : String(rawInput).trim();
  if (!raw) return raw;
  const homeClean = String(userHome || os.homedir()).trim();
  if (raw === '~') return homeClean;
  if (/^~[\\/]/.test(raw)) {
    return path.join(homeClean, raw.slice(2));
  }
  if (/^(?:%USERPROFILE%|\$env:USERPROFILE|\$HOME)(?:[\\/]|$)/i.test(raw)) {
    return raw.replace(/^(?:%USERPROFILE%|\$env:USERPROFILE|\$HOME)/i, homeClean);
  }
  if (enableUserHome && !path.isAbsolute(raw) && !/^[a-zA-Z]:/.test(raw)) {
    const normFwd = raw.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
    const parts = normFwd.split('/').filter(Boolean);
    if (parts.length >= 1) {
      const canonical = USER_FOLDER_SHORTHANDS.get(parts[0].toLowerCase());
      if (canonical) {
        const localFirst = path.join(primaryRoot, parts[0]);
        const homeFirst = path.join(homeClean, canonical);
        if (!fs.existsSync(localFirst) && fs.existsSync(homeFirst)) {
          return parts.length === 1 ? homeFirst : path.join(homeFirst, ...parts.slice(1));
        }
      }
    }
  }
  return raw;
}

function isSensitiveSegmentOrName(segment) {
  const lower = String(segment || '').trim().toLowerCase();
  if (!lower) return false;
  if (BLOCKED_SECRET_SEGMENTS.has(lower)) return true;
  if (SENSITIVE_BASENAMES.has(lower)) return true;
  if (lower.startsWith('.env.') || lower === '.env') return true;
  const ext = path.extname(lower);
  if (ext && SENSITIVE_EXTS.has(ext)) return true;
  if (/^(?:secret|secrets|credential|credentials|private[_-]?key)\b/i.test(lower)) return true;
  return false;
}

function findNearestExistingRealpath(targetAbs, fallbackRoot) {
  let current = targetAbs;
  while (current && current !== path.dirname(current)) {
    if (fs.existsSync(current)) {
      return fs.realpathSync(current);
    }
    if (fallbackRoot && current === fallbackRoot) break;
    current = path.dirname(current);
  }
  try {
    return fs.existsSync(current) ? fs.realpathSync(current) : (fallbackRoot || current);
  } catch (_) {
    return fallbackRoot || current;
  }
}

function validateSafePathSegmentsAndTargets(pathStr, rawForErr) {
  if (isCriticalSystemPath(pathStr)) {
    throw new Error(`WORKSPACE_JAIL_BLOCK: Akses ke direktori/berkas sistem sensitif diblokir (${rawForErr}).`);
  }
  const normalized = String(pathStr || '').replace(/\\/g, '/').replace(/^[a-zA-Z]:/, '').replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  for (const seg of segments) {
    if (seg === '..') {
      throw new Error(`WORKSPACE_JAIL_BLOCK: Traversal ".." dilarang (${rawForErr}).`);
    }
    if (WINDOWS_RESERVED_RE.test(seg)) {
      throw new Error(`WORKSPACE_JAIL_BLOCK: Nama device Windows terlarang (${seg}).`);
    }
    if (isSensitiveSegmentOrName(seg)) {
      throw new Error(`WORKSPACE_JAIL_BLOCK: Akses ke berkas/direktori sensitif (${seg}) diblokir.`);
    }
  }
}

function evaluateWorkspaceContainment(candidateAbs, realTarget, nearestReal, ctx, options = {}) {
  const operation = options.operation === 'write' ? 'write' : 'read';
  const expectDir = Boolean(options.expectDir);
  const raw = String(options.raw || candidateAbs);
  const matchedRoot = isPathInsideAnyRoot(realTarget, ctx.trustedRoots);
  const nearestMatched = isPathInsideAnyRoot(nearestReal, ctx.trustedRoots);
  const outsideWorkspace = !matchedRoot || !nearestMatched;

  let requiresApproval = false;
  if (outsideWorkspace) {
    if (ctx.nonWorkspacePolicy === 'deny' && !options.approvedOutsideWorkspace) {
      throw new Error(`WORKSPACE_JAIL_BLOCK: Path berada di luar area kerja aktif (${raw}).`);
    }
    const preset = ctx.permissionPreset || 'default';
    if (!options.approvedOutsideWorkspace) {
      if (preset === 'turbo') {
        requiresApproval = false;
      } else if (preset === 'auto') {
        requiresApproval = (operation === 'write' || Boolean(ctx.explicitSingleRoot));
      } else {
        requiresApproval = true;
      }
    }
  } else if (
    ctx.permissionPreset === 'request-review' &&
    operation === 'write' &&
    !isContainedInsideRealRoot(ctx.primaryRoot, realTarget) &&
    !options.approvedOutsideWorkspace
  ) {
    requiresApproval = true;
  }

  return {
    matchedRoot,
    outsideWorkspace,
    requiresApproval,
    parentDir: expectDir ? realTarget : path.dirname(realTarget),
    preset: ctx.permissionPreset || 'default'
  };
}

function normalizeSegmentForMatch(seg) {
  return String(seg || '')
    .normalize('NFC')
    .replace(/[\u00A0\u2000-\u200B\s]+/g, ' ')
    .trim()
    .toLowerCase();
}

function resolveExistingPathWithNormalizedSegments(targetAbs) {
  if (!targetAbs || typeof targetAbs !== 'string') return null;
  const resolved = path.resolve(targetAbs);
  if (fs.existsSync(resolved)) return resolved;
  const parsed = path.parse(resolved);
  if (!parsed || !parsed.root) return null;
  const restSegs = resolved.slice(parsed.root.length).split(/[\\/]+/).filter(Boolean);
  let cur = parsed.root;
  for (const seg of restSegs) {
    const exactNext = path.join(cur, seg);
    if (fs.existsSync(exactNext)) {
      cur = exactNext;
      continue;
    }
    if (!fs.existsSync(cur) || isCriticalSystemPath(cur)) return null;
    let entries = [];
    try {
      entries = fs.readdirSync(cur);
    } catch (_) {
      return null;
    }
    const targetNorm = normalizeSegmentForMatch(seg);
    const matches = entries.filter(name => !isSensitiveSegmentOrName(name) && normalizeSegmentForMatch(name) === targetNorm);
    if (matches.length === 1) {
      cur = path.join(cur, matches[0]);
      continue;
    }
    return null;
  }
  return fs.existsSync(cur) ? cur : null;
}

function findClosestSiblingNames(parentDir, rawMissingName, limit = 5) {
  if (!parentDir || !rawMissingName || !fs.existsSync(parentDir) || isCriticalSystemPath(parentDir)) return [];
  let entries = [];
  try {
    entries = fs.readdirSync(parentDir);
  } catch (_) {
    return [];
  }
  const qNorm = normalizeSegmentForMatch(rawMissingName);
  if (!qNorm) return [];
  const qTokens = qNorm.split(/\s+/).filter(t => t.length >= 3);
  const scored = [];
  for (const name of entries) {
    if (!name || name.startsWith('.') || isSensitiveSegmentOrName(name)) continue;
    const nNorm = normalizeSegmentForMatch(name);
    let score = 0;
    if (nNorm === qNorm) score += 100;
    if (nNorm.includes(qNorm) || qNorm.includes(nNorm)) score += 6;
    for (const tok of qTokens) {
      if (nNorm.includes(tok)) score += 3;
    }
    if (qNorm.length >= 4 && nNorm.slice(0, 5) === qNorm.slice(0, 5)) score += 2;
    if (score >= 3) scored.push({ name, score });
  }
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map(x => x.name);
}

function normalizeExistingPathsInShellCommand(cmdStr, ctx, outsideApproved = false) {
  const src = String(cmdStr || '');
  if (!src || !/[~\\/]/.test(src)) return src;
  const tryRewrite = (inner, isSingleQuoted) => {
    const clean = String(inner || '').trim();
    if (!clean || clean.includes('://') || clean.includes('..') || /[*?]/.test(clean)) return null;
    if (!/^(?:~[\\/]|%USERPROFILE%[\\/]|\$(?:HOME|env:USERPROFILE)[\\/]|[A-Za-z]:[\\/]|(?:Downloads|Unduhan|Documents|Desktop|Pictures|Videos|Music)[\\/])/i.test(clean)) {
      return null;
    }
    const expanded = expandUserPathInput(clean, ctx.primaryRoot, ctx.userHome, ctx.enableUserHome);
    if (!expanded || fs.existsSync(expanded)) return null;
    const fixed = resolveExistingPathWithNormalizedSegments(expanded);
    if (!fixed || isCriticalSystemPath(fixed)) return null;
    if (!outsideApproved && !isPathInsideAnyRoot(fixed, ctx.trustedRoots)) return null;
    return isSingleQuoted ? fixed.replace(/'/g, "''") : fixed;
  };
  return src
    .replace(/"([^"\r\n]{2,260})"/g, (m, inner) => {
      const rw = tryRewrite(inner, false);
      return rw ? `"${rw}"` : m;
    })
    .replace(/'([^'\r\n]{2,260})'/g, (m, inner) => {
      const rw = tryRewrite(inner, true);
      return rw ? `'${rw}'` : m;
    });
}

function resolveProjectJailedPath(relOrAbsPath, customRoot, options = {}) {
  const allowRoot = Boolean(options.allowRoot);
  const mustExist = Boolean(options.mustExist);
  const expectDir = Boolean(options.expectDir);
  const ctx = resolveZ21WorkspaceContext(customRoot, options);

  let raw = relOrAbsPath === undefined || relOrAbsPath === null ? '' : String(relOrAbsPath).trim();
  if (!raw && allowRoot) raw = '.';
  if (!raw) {
    throw new Error('WORKSPACE_JAIL_BLOCK: Path kosong tidak diizinkan.');
  }
  if (/[\0\r\n]/.test(raw)) {
    throw new Error('WORKSPACE_JAIL_BLOCK: Karakter kontrol pada path ditolak.');
  }
  if (raw.startsWith('\\\\') || raw.startsWith('//')) {
    throw new Error('WORKSPACE_JAIL_BLOCK: Path jaringan UNC tidak diizinkan.');
  }

  const expanded = expandUserPathInput(raw, ctx.primaryRoot, ctx.userHome, ctx.enableUserHome);
  const normalizedFwd = expanded.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!allowRoot && (normalizedFwd === '.' || normalizedFwd === './' || normalizedFwd === '')) {
    throw new Error('WORKSPACE_JAIL_BLOCK: Operasi file wajib menunjuk file, bukan direktori root.');
  }

  validateSafePathSegmentsAndTargets(expanded, raw);

  if (/^[a-zA-Z]:(?![\\/])/.test(expanded)) {
    throw new Error('WORKSPACE_JAIL_BLOCK: Path drive-relative tanpa separator (mis. C:foo) tidak diizinkan; gunakan path relatif workspace atau path absolut penuh (C:\\...).');
  }
  const isDriveOrAbs = /^[a-zA-Z]:[\\/]/.test(expanded) || path.isAbsolute(expanded);
  let baseDirForRel = ctx.primaryRoot;
  if (!isDriveOrAbs && !/^\.\.(?:[\\/]|$)/.test(raw) && options.cwdHint) {
    const hintRaw = String(options.cwdHint).trim();
    if (hintRaw) {
      try {
        const hintExpanded = expandUserPathInput(hintRaw, ctx.primaryRoot, ctx.userHome, ctx.enableUserHome);
        const hintAbs = resolveExistingPathWithNormalizedSegments(path.resolve(hintExpanded)) || path.resolve(hintExpanded);
        if (fs.existsSync(hintAbs) && fs.statSync(hintAbs).isDirectory() && isPathInsideAnyRoot(hintAbs, ctx.trustedRoots)) {
          baseDirForRel = hintAbs;
        }
      } catch (_) {}
    }
  }
  let candidateAbs = isDriveOrAbs ? path.resolve(expanded) : path.resolve(baseDirForRel, normalizedFwd || '.');

  if (mustExist && !fs.existsSync(candidateAbs)) {
    const segResolved = resolveExistingPathWithNormalizedSegments(candidateAbs);
    if (segResolved) {
      candidateAbs = segResolved;
    } else if (!isDriveOrAbs && ctx.enableUserHome && !/^\.\.?(?:[\\/]|$)/.test(raw)) {
      let resolvedViaBase = null;
      if (baseDirForRel !== ctx.primaryRoot) {
        const fromHint = resolveExistingPathWithNormalizedSegments(path.join(baseDirForRel, normalizedFwd));
        if (fromHint && (!expectDir || fs.statSync(fromHint).isDirectory())) {
          resolvedViaBase = fromHint;
        }
      }
      if (!resolvedViaBase) {
        const baseMatches = [];
        const seenMatches = new Set();
        for (const baseDir of [
          path.join(ctx.userHome, 'Downloads'),
          path.join(ctx.userHome, 'Documents'),
          path.join(ctx.userHome, 'Desktop'),
          ctx.userHome
        ]) {
          const cand = resolveExistingPathWithNormalizedSegments(path.join(baseDir, normalizedFwd));
          if (cand && (!expectDir || fs.statSync(cand).isDirectory())) {
            const k = process.platform === 'win32' ? cand.toLowerCase() : cand;
            if (!seenMatches.has(k)) {
              seenMatches.add(k);
              baseMatches.push(cand);
            }
          }
        }
        if (baseMatches.length === 1) {
          resolvedViaBase = baseMatches[0];
        }
      }
      if (resolvedViaBase) {
        candidateAbs = resolvedViaBase;
      }
    }
  }

  validateSafePathSegmentsAndTargets(candidateAbs, raw);

  const nearestReal = findNearestExistingRealpath(candidateAbs, isDriveOrAbs ? null : ctx.primaryRoot);
  validateSafePathSegmentsAndTargets(nearestReal, raw);

  let finalReal = candidateAbs;
  if (fs.existsSync(candidateAbs)) {
    finalReal = fs.realpathSync(candidateAbs);
    validateSafePathSegmentsAndTargets(finalReal, raw);
    const stat = fs.statSync(finalReal);
    if (expectDir && !stat.isDirectory()) {
      throw new Error(`WORKSPACE_JAIL_BLOCK: Target bukan direktori (${raw}).`);
    }
    if (!expectDir && !allowRoot && stat.isDirectory()) {
      throw new Error(`WORKSPACE_JAIL_BLOCK: Target adalah direktori, bukan berkas (${raw}).`);
    }
  } else if (mustExist) {
    const missingLeaf = path.basename(candidateAbs);
    const hints = findClosestSiblingNames(nearestReal, missingLeaf);
    if (hints.length > 0) {
      throw new Error(`PATH_NOT_FOUND: Target tidak ditemukan (${raw}). Kandidat terdekat di "${nearestReal}": ${hints.map(h => JSON.stringify(h)).join(', ')} — gunakan path/nama persis tersebut.`);
    }
    throw new Error(`PATH_NOT_FOUND: Target tidak ditemukan (${raw}).`);
  }

  const access = evaluateWorkspaceContainment(candidateAbs, finalReal, nearestReal, ctx, { ...options, raw });
  if (access.requiresApproval) {
    if (options.returnApprovalObject) {
      return {
        requiresApproval: true,
        candidateAbs: finalReal,
        parentDir: access.parentDir,
        preset: access.preset,
        outsideWorkspace: access.outsideWorkspace
      };
    }
    throw new Error(`WORKSPACE_JAIL_BLOCK: Akses path di luar workspace (${raw}) memerlukan persetujuan pengguna.`);
  }

  const insidePrimaryRoot = isContainedInsideRealRoot(ctx.primaryRoot, finalReal);
  const displayPath = insidePrimaryRoot
    ? (path.relative(ctx.primaryRoot, finalReal) || '.').replace(/\\/g, '/')
    : finalReal.replace(/\\/g, '/');

  return {
    projectRoot: ctx.primaryRoot,
    matchedRoot: access.matchedRoot || path.parse(finalReal).root,
    allowedRoots: ctx.trustedRoots,
    insidePrimaryRoot,
    outsideWorkspace: access.outsideWorkspace,
    outsideWorkspaceApproved: Boolean(access.outsideWorkspace && !access.requiresApproval),
    absPath: finalReal,
    relativePath: displayPath,
    displayPath
  };
}

function validateProjectCommandJail(command, cwd, customRoot, options = {}) {
  const cmd = String(command || '').trim();
  if (!cmd) {
    throw new Error('COMMAND_INVALID: Parameter command wajib diisi.');
  }
  if (/[\0]/.test(cmd)) {
    throw new Error('COMMAND_JAIL_BLOCK: Null byte dalam perintah ditolak.');
  }
  if (cmd.length > 4000) {
    throw new Error('COMMAND_JAIL_BLOCK: Perintah melebihi batas 4000 karakter.');
  }

  const ctx = resolveZ21WorkspaceContext(customRoot, options);
  const cwdTarget = expandUserPathInput(cwd || '.', ctx.primaryRoot, ctx.userHome, ctx.enableUserHome);
  const jailedCwd = resolveProjectJailedPath(cwdTarget || '.', customRoot, {
    ...options,
    allowRoot: true,
    mustExist: true,
    expectDir: true,
    operation: 'read',
    returnApprovalObject: true
  });
  if (jailedCwd.requiresApproval) {
    jailedCwd.absPath = jailedCwd.candidateAbs;
    jailedCwd.relativePath = jailedCwd.candidateAbs.replace(/\\/g, '/');
    jailedCwd.projectRoot = ctx.primaryRoot;
  }

  // Tier 1 DENY: selalu blokir direktori sistem OS kritis, perintah destruktif, & berkas rahasia
  const hardDenyPatterns = [
    /(?:^|[\s"'`])(?:\/etc\/|\/root\/|\/var\/|\/proc\/|\/sys\/|\/usr\/local\/|C:\\Windows\\)/i,
    /(?:%SYSTEMROOT%|%WINDIR%)/i,
    /\b(?:rm\s+-rf\s+\/|del\s+\/s\s+\/q\s+[a-zA-Z]:\\|format\s+[a-zA-Z]:|diskpart|reg\s+(?:add|delete)|bcdedit|shutdown)\b/i,
    /(?:^|[\s"'`\/\\])\.env(?:\.[a-z0-9_.-]+)?(?:$|[\s"'`])/i,
    /(?:^|[\s"'`\/\\])\.git(?:[/\\]|$|\s)/i,
    /(?:^|[\s"'`\/\\])(?:\.ssh|\.gnupg|\.aws|\.kube|\.npmrc|id_rsa|id_ed25519)(?:[/\\]|$|\s)/i
  ];
  for (const re of hardDenyPatterns) {
    if (re.test(cmd)) {
      throw new Error(
        'COMMAND_JAIL_BLOCK: Perintah mencoba menyentuh direktori sistem OS atau file sensitif (.env/.git/.ssh/sistem).'
      );
    }
  }

  if (ctx.explicitSingleRoot && ctx.nonWorkspacePolicy === 'deny' && !options.approvedOutsideWorkspace) {
    const singleRootBlockPatterns = [
      /(?:^|\s)\.\.(?:[/\\]|$)/,
      /~[/\\]/,
      /(?:\$HOME|%USERPROFILE%|%APPDATA%)/i,
      /(?:^|[\s"'`])C:\\Users\\/i
    ];
    for (const re of singleRootBlockPatterns) {
      if (re.test(cmd)) {
        throw new Error(
          'COMMAND_JAIL_BLOCK: Perintah mencoba keluar dari Workspace Jail atau menyentuh file sensitif (.env/.git/sistem).'
        );
      }
    }
  }

  let touchesOutsideWorkspace = Boolean(jailedCwd.outsideWorkspace || jailedCwd.requiresApproval);
  const cmdWithoutUrls = cmd.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'`)]+/gi, ' ');
  const driveRe = /(?:^|[\s"'`=(])([A-Za-z]:[\\\/](?!\/)[^\s"';|&`)]*)/g;
  let drvMatch;
  while ((drvMatch = driveRe.exec(cmdWithoutUrls)) !== null) {
    const drvPath = drvMatch[1];
    if (isCriticalSystemPath(drvPath)) {
      throw new Error(`COMMAND_JAIL_BLOCK: Akses path sistem kritis (${drvPath}) ditolak.`);
    }
    const resolvedDrv = path.resolve(drvPath);
    if (!isPathInsideAnyRoot(resolvedDrv, ctx.trustedRoots)) {
      if (ctx.explicitSingleRoot && ctx.nonWorkspacePolicy === 'deny' && !options.approvedOutsideWorkspace) {
        throw new Error(`COMMAND_JAIL_BLOCK: Path drive eksternal (${drvPath}) ditolak di luar proyek aktif.`);
      }
      touchesOutsideWorkspace = true;
    }
  }

  jailedCwd.touchesOutsideWorkspace = touchesOutsideWorkspace;
  jailedCwd.permissionPreset = ctx.permissionPreset || 'default';
  return jailedCwd;
}

function isWhitelistedSafeCommand(command, customPrefixes = []) {
  const raw = String(command || '').trim();
  if (!raw) return false;
  if (SHELL_CHAINING_RE.test(raw)) {
    return false;
  }

  const normalized = raw.replace(/\s+/g, ' ').trim();
  for (const re of DEFAULT_SAFE_WHITELIST_PATTERNS) {
    if (re.test(normalized)) return true;
  }

  if (Array.isArray(customPrefixes) && customPrefixes.length > 0) {
    const normLower = normalized.toLowerCase();
    for (const prefixRaw of customPrefixes) {
      const prefix = String(prefixRaw || '').replace(/\s+/g, ' ').trim();
      if (!prefix || SHELL_CHAINING_RE.test(prefix)) continue;
      const prefLower = prefix.toLowerCase();
      if (normLower === prefLower || normLower.startsWith(prefLower + ' ')) {
        return true;
      }
    }
  }

  return false;
}

function isTrailingWinSlashQuote(src, i, quoteChar) {
  const prev = i > 0 ? src[i - 1] : '';
  if (quoteChar === "'") return true;
  if (prev !== '\\') return true;
  const next = i + 1 < src.length ? src[i + 1] : '';
  return !next || /[\s&|;)]/.test(next);
}

function splitUnquotedShellSegments(cmd) {
  const src = String(cmd || '');
  const segments = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      cur += ch;
      if (ch === quote && isTrailingWinSlashQuote(src, i, quote)) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '&' && src[i + 1] === '&') {
      if (cur.trim()) segments.push(cur.trim());
      cur = '';
      i++;
      continue;
    }
    if (ch === '|' || ch === ';' || ch === '\n' || ch === '\r') {
      if (cur.trim()) segments.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) segments.push(cur.trim());
  return segments;
}

function transpilePosixAndForPowerShell(cmd) {
  const src = String(cmd || '');
  let out = '';
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      out += ch;
      if (ch === quote && isTrailingWinSlashQuote(src, i, quote)) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '&' && src[i + 1] === '&') {
      out += '; if (($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) -or -not $?) { exit $(if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) { $LASTEXITCODE } else { 1 }) }; ';
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

function splitChainWithSeparatorsForPosix(cmd) {
  const src = String(cmd || '');
  const parts = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      cur += ch;
      if (ch === quote && isTrailingWinSlashQuote(src, i, quote)) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '&' && src[i + 1] === '&') {
      parts.push({ cmd: cur, sep: ' && ' });
      cur = '';
      i++;
      continue;
    }
    if (ch === ';' || ch === '\n') {
      parts.push({ cmd: cur, sep: ch === ';' ? '; ' : '\n' });
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push({ cmd: cur, sep: '' });
  return parts;
}

function hasUnquotedPipeOrRedirect(str) {
  const src = String(str || '');
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote && isTrailingWinSlashQuote(src, i, quote)) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '|' || ch === '>' || ch === '<' || ch === '$') return true;
  }
  return false;
}

function tokenizeSimpleShellArgs(str) {
  const src = String(str || '').trim();
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (i >= src.length) break;
    let val = '';
    let hasQuote = false;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) break;
      if (ch === '"' || ch === "'") {
        hasQuote = true;
        const q = ch;
        i++;
        while (i < src.length) {
          const inner = src[i];
          if (inner === q && isTrailingWinSlashQuote(src, i, q)) {
            i++;
            break;
          }
          val += inner;
          i++;
        }
        continue;
      }
      val += ch;
      i++;
    }
    tokens.push({ value: val, quoted: hasQuote });
  }
  return tokens;
}

function psSingleQuote(val) {
  return `'${String(val || '').replace(/'/g, "''")}'`;
}

function normalizeSinglePosixSegment(piece) {
  const raw = String(piece || '');
  const trimmed = raw.trim();
  if (!trimmed || hasUnquotedPipeOrRedirect(trimmed)) return raw;
  const tokens = tokenizeSimpleShellArgs(trimmed);
  if (tokens.length < 2) return raw;
  const lead = raw.match(/^\s*/)[0];
  const trail = raw.match(/\s*$/)[0];
  const cmdName = tokens[0].quoted ? '' : tokens[0].value.toLowerCase();

  if (cmdName === 'mkdir') {
    const flags = [];
    const dirs = [];
    for (let i = 1; i < tokens.length; i++) {
      if (!tokens[i].quoted && tokens[i].value.startsWith('-')) flags.push(tokens[i].value);
      else dirs.push(tokens[i].value);
    }
    if (flags.length > 0 && flags.every(f => /^-[pv]+$/i.test(f)) && flags.some(f => /p/i.test(f)) && dirs.length >= 1) {
      return `${lead}New-Item -ItemType Directory -Force -Path ${dirs.map(psSingleQuote).join(', ')} | Out-Null${trail}`;
    }
  } else if (cmdName === 'cp') {
    const flags = [];
    const args = [];
    for (let i = 1; i < tokens.length; i++) {
      if (!tokens[i].quoted && tokens[i].value.startsWith('-')) flags.push(tokens[i].value);
      else args.push(tokens[i].value);
    }
    if (flags.length > 0 && flags.every(f => /^-[rfRv]+$/.test(f)) && args.length === 2) {
      const recurse = flags.some(f => /[rR]/.test(f)) ? ' -Recurse' : '';
      const pathFlag = /[*?]/.test(args[0]) ? '-Path' : '-LiteralPath';
      return `${lead}Copy-Item -Force${recurse} ${pathFlag} ${psSingleQuote(args[0])} -Destination ${psSingleQuote(args[1])}${trail}`;
    }
  } else if (cmdName === 'mv') {
    const flags = [];
    const args = [];
    for (let i = 1; i < tokens.length; i++) {
      if (!tokens[i].quoted && tokens[i].value.startsWith('-')) flags.push(tokens[i].value);
      else args.push(tokens[i].value);
    }
    if (flags.length > 0 && flags.every(f => /^-[fv]+$/.test(f)) && args.length === 2) {
      const pathFlag = /[*?]/.test(args[0]) ? '-Path' : '-LiteralPath';
      return `${lead}Move-Item -Force ${pathFlag} ${psSingleQuote(args[0])} -Destination ${psSingleQuote(args[1])}${trail}`;
    }
  } else if (cmdName === 'touch') {
    const hasFlags = tokens.slice(1).some(t => !t.quoted && t.value.startsWith('-'));
    if (!hasFlags && tokens.length === 2) {
      const tp = psSingleQuote(tokens[1].value);
      return `${lead}if (-not (Test-Path -LiteralPath ${tp})) { New-Item -ItemType File -Force -Path ${tp} | Out-Null } else { (Get-Item -LiteralPath ${tp}).LastWriteTime = Get-Date }${trail}`;
    }
  }
  return raw;
}

function normalizePosixIdiomsForPowerShell(cmd) {
  const src = String(cmd || '');
  if (!src.trim()) return src;
  const chunks = splitChainWithSeparatorsForPosix(src);
  return chunks.map(c => `${normalizeSinglePosixSegment(c.cmd)}${c.sep}`).join('');
}

const AUTO_PRESET_HARD_BLOCK_RE = /\b(?:Invoke-Expression|iex|eval|Remove-Item|rm|del|erase|rmdir|rd|taskkill|kill|pkill|Stop-Process|Stop-Service|Restart-Computer|Stop-Computer|schtasks|reg|shutdown|diskpart|format|bcdedit)\b|(?:^|\s)-EncodedCommand\b|(?:^|\s)-enc\b|-Verb\s+RunAs|\$\(/i;

const AUTO_PRESET_UNSAFE_RE = /\b(?:Invoke-Expression|iex|eval|Remove-Item|Move-Item|Copy-Item|Rename-Item|Set-Content|Add-Content|Out-File|Clear-Content|New-Item|New-Object|Start-Process|Stop-Process|Set-Service|Stop-Service|Restart-Service|Restart-Computer|Stop-Computer|rm|del|erase|rmdir|rd|mkdir|md|mv|cp|ren|taskkill|kill|pkill|schtasks|reg|shutdown|diskpart|format|bcdedit)\b|(?:^|\s)-EncodedCommand\b|(?:^|\s)-enc\b|-Verb\s+RunAs|\$\(|\[[a-zA-Z0-9_.+]+\]::|\b(?:npm|pnpm|yarn|pip|pip3|winget|choco|scoop)\s+(?:install|i|add|remove|uninstall|update|upgrade|publish)\b|\bgit\s+(?:push|reset|clean|rebase|merge|commit|checkout\s+--|restore)\b|\bcurl(?:\.exe)?\b[^\r\n]*?(?:\s-O\b|\s-[oXdFT](?:\S+|\s+(?!NUL\b|\/dev\/null))|--(?:remote-name|request|data(?:-\w+)?|json|form|upload-file|output)(?:=|\s+(?!NUL\b|\/dev\/null)|$))|\bInvoke-WebRequest\b[^\r\n]*-OutFile\b|(?:^|[^2>])>{1,2}(?!\s*(?:&|\$null|NUL\b|\/dev\/null))/i;

const AUTO_PRESET_SAFE_SEGMENT_RE = /^(?:get-childitem|get-content|get-item|get-itemproperty|test-path|resolve-path|get-location|set-location|push-location|pop-location|select-object|where-object|sort-object|measure-object|group-object|foreach-object|format-table|format-list|select-string|convertto-json|convertfrom-json|out-string|write-output|get-date|get-process|get-service|get-ciminstance|get-net[a-z0-9]+|get-dnsclient[a-z0-9]*|get-volume|get-psdrive|get-computerinfo|get-filehash|ls|dir|pwd|cd|chdir|type|cat|head|tail|more|findstr|grep|rg|where(?:\.exe)?|which|tree|echo|whoami|hostname|ver|uname|ipconfig|ifconfig|netstat|arp|ping|tracert|traceroute|nslookup|systeminfo|tasklist|curl(?:\.exe)?|pytest)(?:\s|$)|^(?:netsh\s+(?:wlan|interface)\s+show|route\s+print|git\s+(?:status|diff|log|show|branch|rev-parse|remote)|node\s+(?:-v|--version|--check)|python3?\s+(?:-V|--version)|(?:npm|pnpm|yarn)\s+(?:-v|--version|list|ls|test|run\s+test))(?:\s|$)/i;

function isAutoPresetSafeCommand(command, customPrefixes = []) {
  const raw = String(command || '').trim();
  if (!raw) return false;
  if (/[\r\n]/.test(raw) && raw.split(/\r?\n/).filter(Boolean).length > 4) return false;
  if (AUTO_PRESET_HARD_BLOCK_RE.test(raw)) return false;

  const segments = splitUnquotedShellSegments(raw);
  if (segments.length === 0) return false;

  const normalizedCustoms = Array.isArray(customPrefixes)
    ? customPrefixes.map(p => String(p || '').replace(/\s+/g, ' ').trim().toLowerCase()).filter(p => p && !SHELL_CHAINING_RE.test(p))
    : [];

  for (const seg of segments) {
    const cleanSeg = seg.replace(/^[(@\s]+/, '').trim();
    if (!cleanSeg) continue;
    const segLower = cleanSeg.toLowerCase();
    if (normalizedCustoms.some(p => segLower === p || segLower.startsWith(p + ' '))) continue;
    if (AUTO_PRESET_UNSAFE_RE.test(cleanSeg)) return false;
    if (AUTO_PRESET_SAFE_SEGMENT_RE.test(cleanSeg)) continue;
    return false;
  }
  return true;
}

const Z21_CWD_SENTINEL = '---ZOZ_Z21_CWD_MARKER---';
const MAX_BG_TASKS = 40;
const backgroundTasks = new Map();
let bgTaskCounter = 0;

function stripZ21CwdSentinel(stdoutText) {
  const raw = String(stdoutText || '');
  const m = raw.match(/\r?\n?---ZOZ_Z21_CWD_MARKER---[ \t]*\r?\n([^\r\n]*)[\r\n]*$/);
  if (!m) return { stdout: raw, detectedCwd: '' };
  return {
    stdout: raw.slice(0, m.index),
    detectedCwd: String(m[1] || '').trim()
  };
}

function evictOldBackgroundTasks() {
  if (backgroundTasks.size < MAX_BG_TASKS) return;
  for (const [id, task] of backgroundTasks.entries()) {
    if (task && task.status !== 'running') {
      backgroundTasks.delete(id);
      if (backgroundTasks.size < MAX_BG_TASKS) break;
    }
  }
}

function summarizeTaskEntry(task, includeNewOutput = false) {
  const tail = stripZ21CwdSentinel(task.combinedLog || '').stdout.slice(-4000);
  const out = {
    task_id: task.id,
    pid: task.pid || null,
    command: task.command,
    cwd: task.cwd,
    abs_cwd: task.absCwd,
    shell: task.shell,
    is_daemon: Boolean(task.isDaemon),
    status: task.status,
    exit_code: task.exitCode,
    elapsed_ms: (task.endedAt || Date.now()) - task.startedAt,
    recent_output: tail
  };
  if (includeNewOutput) {
    const rawNew = String(task.combinedLog || '').slice(task.lastReadOffset || 0);
    task.lastReadOffset = (task.combinedLog || '').length;
    out.new_output = stripZ21CwdSentinel(rawNew).stdout.slice(-4000);
  }
  return out;
}

async function manageBackgroundTask(options = {}) {
  const action = String(options.action || 'list').trim().toLowerCase();
  if (action === 'list') {
    const tasks = Array.from(backgroundTasks.values()).map(t => summarizeTaskEntry(t, false));
    return { ok: true, count: tasks.length, tasks };
  }

  const rawId = String(options.taskId || options.task_id || '').trim();
  const cleanId = rawId.includes('/') ? rawId.split('/').pop().trim() : rawId;
  const task = backgroundTasks.get(cleanId);
  if (!task) {
    return { ok: false, error: `TASK_NOT_FOUND: Background task "${rawId}" tidak ditemukan.` };
  }

  if (action === 'status') {
    const waitMs = Math.min(15000, Math.max(0, Number(options.waitMs ?? options.wait_ms) || 0));
    if (task.status === 'running' && waitMs > 0) {
      await new Promise((resolveWait) => {
        let done = false;
        const onFinish = () => {
          if (done) return;
          done = true;
          clearTimeout(wt);
          resolveWait();
        };
        const wt = setTimeout(onFinish, waitMs);
        if (typeof wt.unref === 'function') wt.unref();
        task.waiters.push(onFinish);
      });
    }
    return { ok: true, ...summarizeTaskEntry(task, true) };
  }

  if (action === 'send_input') {
    if (task.status !== 'running' || !task.proc || !task.proc.stdin || task.proc.stdin.destroyed) {
      return {
        ok: false,
        error: `TASK_NOT_RUNNING: Task "${cleanId}" berstatus "${task.status}" dan tidak menerima stdin.`,
        ...summarizeTaskEntry(task, true)
      };
    }
    const rawInput = options.input === undefined || options.input === null ? '' : String(options.input);
    if (rawInput === '<ctrl+c>' || rawInput === '\x03') {
      try { task.proc.stdin.write('\x03'); } catch (_) {}
      killSpawnedProcessSafely(task.proc);
    } else {
      const needsNl = options.appendNewline !== false && !rawInput.endsWith('\n') && !rawInput.endsWith('\r');
      task.proc.stdin.write(needsNl ? `${rawInput}\n` : rawInput);
    }
    await new Promise((resolveWait) => {
      let done = false;
      const onFinish = () => {
        if (done) return;
        done = true;
        clearTimeout(wt);
        resolveWait();
      };
      const wt = setTimeout(onFinish, 450);
      if (typeof wt.unref === 'function') wt.unref();
      task.waiters.push(onFinish);
    });
    return { ok: true, ...summarizeTaskEntry(task, true) };
  }

  if (action === 'kill') {
    task.killed = true;
    if (task.safetyTimer) {
      clearTimeout(task.safetyTimer);
      task.safetyTimer = null;
    }
    if (task.status === 'running' && task.proc) {
      killSpawnedProcessSafely(task.proc);
      await new Promise((resolveWait) => {
        let done = false;
        const onFinish = () => {
          if (done) return;
          done = true;
          clearTimeout(wt);
          resolveWait();
        };
        const wt = setTimeout(onFinish, 450);
        if (typeof wt.unref === 'function') wt.unref();
        task.waiters.push(onFinish);
      });
    }
    if (task.status === 'running') {
      task.status = 'killed';
      task.endedAt = Date.now();
    }
    return { ok: true, killed: true, ...summarizeTaskEntry(task, true) };
  }

  return { ok: false, error: `UNKNOWN_ACTION: Aksi manage_task "${action}" tidak dikenal (gunakan list|status|send_input|kill).` };
}

let cachedSandboxCaps = null;
let cachedSandboxCapsTs = 0;

function probeSandboxCapabilities(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedSandboxCaps && now - cachedSandboxCapsTs < 60000) {
    return cachedSandboxCaps;
  }

  const checkBin = (bin, args) => {
    try {
      execFileSync(bin, args, { stdio: 'ignore', timeout: 2500 });
      return true;
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        console.warn(`[z21/project-dev-tools] Probe ${bin} failed:`, err.message);
      }
      return false;
    }
  };

  const caps = {
    platform: process.platform,
    docker: checkBin('docker', ['--version']),
    bwrap: process.platform === 'linux' ? checkBin('bwrap', ['--version']) : false,
    sandbox_exec: process.platform === 'darwin' ? checkBin('which', ['sandbox-exec']) : false,
    docker_image: DEFAULT_DOCKER_IMAGE
  };

  cachedSandboxCaps = caps;
  cachedSandboxCapsTs = now;
  return caps;
}

function buildContainerCommandSpec(command, options = {}) {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const cwdAbs = options.cwdAbs ? path.resolve(options.cwdAbs) : projectRoot;
  const relSubdir = path.relative(projectRoot, cwdAbs).replace(/\\/g, '/');
  const containerWorkdir = relSubdir && relSubdir !== '.' ? `/workspace/${relSubdir}` : '/workspace';
  const runtime = String(options.runtime || 'docker').toLowerCase();

  if (runtime === 'docker') {
    const dockerImage = String(options.dockerImage || DEFAULT_DOCKER_IMAGE).trim();
    return {
      runtime: 'docker',
      file: 'docker',
      args: [
        'run',
        '--rm',
        '-i',
        '--network',
        'none',
        '--cap-drop=ALL',
        '--security-opt',
        'no-new-privileges',
        '--memory=512m',
        '--cpus=1.0',
        '--pids-limit=128',
        '-v',
        `${projectRoot}:/workspace:rw`,
        '-w',
        containerWorkdir,
        dockerImage,
        'sh',
        '-lc',
        String(command)
      ]
    };
  }

  if (runtime === 'bwrap') {
    return {
      runtime: 'bwrap',
      file: 'bwrap',
      args: [
        '--ro-bind',
        '/usr',
        '/usr',
        '--ro-bind',
        '/bin',
        '/bin',
        '--ro-bind',
        '/lib',
        '/lib',
        '--dev',
        '/dev',
        '--proc',
        '/proc',
        '--bind',
        projectRoot,
        '/workspace',
        '--unshare-all',
        '--die-with-parent',
        '--chdir',
        containerWorkdir,
        'sh',
        '-lc',
        String(command)
      ]
    };
  }

  if (runtime === 'sandbox-exec') {
    const profile =
      '(version 1)(deny default)(allow process*)(allow file-read*)(deny file-write*)(allow file-write* (subpath "' +
      projectRoot.replace(/"/g, '') +
      '"))';
    return {
      runtime: 'sandbox-exec',
      file: 'sandbox-exec',
      args: ['-p', profile, 'sh', '-lc', String(command)]
    };
  }

  throw new Error(`SANDBOX_RUNTIME_UNSUPPORTED: Runtime "${runtime}" tidak dikenal.`);
}

function smartTruncateCommandOutput(text, maxChars = DEFAULT_MAX_OUTPUT_CHARS) {
  const raw = String(text || '');
  const limit = Math.max(256, Number(maxChars) || DEFAULT_MAX_OUTPUT_CHARS);
  if (raw.length <= limit) {
    return { text: raw, truncated: false, total_chars: raw.length };
  }

  const noticeTemplate = '\n... [truncated {OMITTED} chars; head + error/tail preserved] ...\n';
  const reserveNotice = noticeTemplate.length + 12;
  const available = Math.max(120, limit - reserveNotice);
  const headLen = Math.floor(available * 0.35);
  const tailLen = available - headLen;
  const omitted = raw.length - (headLen + tailLen);
  const marker = noticeTemplate.replace('{OMITTED}', String(omitted));
  const combined = raw.slice(0, headLen) + marker + raw.slice(raw.length - tailLen);
  return {
    text: combined.length > limit ? combined.slice(0, limit) : combined,
    truncated: true,
    total_chars: raw.length
  };
}

function formatCommandOutputsWithErrorPreservation(stdout, stderr, maxChars = DEFAULT_MAX_OUTPUT_CHARS) {
  const limit = Math.max(400, Number(maxChars) || DEFAULT_MAX_OUTPUT_CHARS);
  const rawOut = String(stdout || '');
  const rawErr = String(stderr || '');

  if (rawOut.length + rawErr.length <= limit) {
    return {
      stdout: rawOut,
      stderr: rawErr,
      truncated: false,
      stdout_chars: rawOut.length,
      stderr_chars: rawErr.length
    };
  }

  // Always reserve priority budget for stderr / stack traces so AI can self-correct.
  let errBudget = rawErr.length;
  let outBudget = limit - rawErr.length;
  if (rawErr.length > Math.floor(limit * 0.5)) {
    errBudget = Math.floor(limit * 0.55);
    outBudget = limit - errBudget;
  }

  const outRes = smartTruncateCommandOutput(rawOut, Math.max(256, outBudget));
  const errRes = smartTruncateCommandOutput(rawErr, Math.max(256, errBudget));

  return {
    stdout: outRes.text,
    stderr: errRes.text,
    truncated: outRes.truncated || errRes.truncated,
    stdout_chars: rawOut.length,
    stderr_chars: rawErr.length
  };
}

function killSpawnedProcessSafely(proc) {
  if (!proc) return;
  try {
    proc.kill('SIGKILL');
  } catch (err) {
    console.warn('[z21/project-dev-tools] proc.kill fallback:', err.message);
  }
  if (process.platform === 'win32' && proc.pid) {
    try {
      const killer = spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
        windowsHide: true,
        detached: true,
        stdio: 'ignore'
      });
      killer.unref();
    } catch (err) {
      console.warn('[z21/project-dev-tools] taskkill spawn fallback:', err.message);
    }
  }
}

async function runProjectCommand(options = {}) {
  const command = String(options.command || '').trim();
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const jailedCwd = validateProjectCommandJail(command, options.cwd || '.', projectRoot, options);
  const timeoutMs = Math.min(
    MAX_TIMEOUT_MS,
    Math.max(MIN_TIMEOUT_MS, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS)
  );
  const requestedSandbox = String(options.sandboxMode || 'host').toLowerCase();
  const allowlistPrefixes = Array.isArray(options.allowlistPrefixes) ? options.allowlistPrefixes : [];

  let activeRuntime = 'host';
  let containerSpec = null;

  if (requestedSandbox === 'docker' || requestedSandbox === 'bwrap' || requestedSandbox === 'sandbox-exec') {
    const caps = probeSandboxCapabilities();
    const isAvail =
      (requestedSandbox === 'docker' && caps.docker) ||
      (requestedSandbox === 'bwrap' && caps.bwrap) ||
      (requestedSandbox === 'sandbox-exec' && caps.sandbox_exec);
    if (!isAvail) {
      return {
        ok: false,
        sandbox_unavailable: true,
        runtime: requestedSandbox,
        error: `Sandbox "${requestedSandbox}" tidak tersedia di host saat ini.`
      };
    }
    activeRuntime = requestedSandbox;
    containerSpec = buildContainerCommandSpec(command, {
      projectRoot: jailedCwd.absPath || projectRoot,
      cwdAbs: jailedCwd.absPath,
      runtime: requestedSandbox,
      dockerImage: options.dockerImage
    });
  } else if (requestedSandbox === 'auto') {
    const caps = probeSandboxCapabilities();
    const autoRuntime = caps.docker ? 'docker' : caps.bwrap ? 'bwrap' : caps.sandbox_exec ? 'sandbox-exec' : 'host';
    if (autoRuntime !== 'host') {
      activeRuntime = autoRuntime;
      containerSpec = buildContainerCommandSpec(command, {
        projectRoot: jailedCwd.absPath || projectRoot,
        cwdAbs: jailedCwd.absPath,
        runtime: autoRuntime,
        dockerImage: options.dockerImage
      });
    }
  }

  const whitelisted = isWhitelistedSafeCommand(command, allowlistPrefixes);
  const approved = Boolean(options.approved || options.approvedOutsideWorkspace);
  const activePreset = VALID_PERMISSION_PRESETS.has(String(options.permissionPreset || '').toLowerCase())
    ? String(options.permissionPreset).toLowerCase()
    : 'default';
  const autoSafe = !jailedCwd.touchesOutsideWorkspace && (whitelisted || isAutoPresetSafeCommand(command, allowlistPrefixes));

  let requiresHostApproval = false;
  if (!approved) {
    if (jailedCwd.touchesOutsideWorkspace && activePreset !== 'turbo') {
      requiresHostApproval = true;
    } else if (activeRuntime === 'host') {
      if (activePreset === 'turbo') {
        requiresHostApproval = false;
      } else if (activePreset === 'request-review') {
        requiresHostApproval = true;
      } else if (activePreset === 'auto') {
        requiresHostApproval = !autoSafe;
      } else {
        requiresHostApproval = !whitelisted;
      }
    }
  }

  if (requiresHostApproval) {
    return {
      ok: false,
      status: 'requires_approval',
      requires_approval: true,
      approval_type: jailedCwd.touchesOutsideWorkspace ? 'outside_workspace_command' : 'terminal_command',
      outside_workspace: Boolean(jailedCwd.touchesOutsideWorkspace),
      preset: activePreset,
      whitelisted,
      runtime: 'host',
      command,
      cwd: jailedCwd.relativePath,
      timeout_ms: timeoutMs,
      reason: jailedCwd.touchesOutsideWorkspace
        ? 'Perintah menyentuh direktori di luar Active Workspaces dan memerlukan konfirmasi Y/N pengguna.'
        : 'Perintah shell berada di luar whitelist aman dan memerlukan konfirmasi Y/N pengguna.'
    };
  }

  const reqShell = String(options.shell || 'auto').trim().toLowerCase();
  const isDaemon = Boolean(options.isDaemon ?? options.is_daemon);
  const hasExplicitAsyncWait = options.waitMsBeforeAsync !== undefined && options.waitMsBeforeAsync !== null;
  const isBackgroundEligible = Boolean(isDaemon || hasExplicitAsyncWait);
  const waitWindowMs = isDaemon
    ? Math.min(5000, Math.max(300, Number(options.waitMsBeforeAsync) || 1000))
    : Math.min(30000, Math.max(300, Number(options.waitMsBeforeAsync) || 10000));
  const ctxForCwd = resolveZ21WorkspaceContext(projectRoot, options);
  const normalizedHostCmd = (reqShell === 'node' || reqShell === 'python' || containerSpec)
    ? command
    : normalizeExistingPathsInShellCommand(command, ctxForCwd, jailedCwd.outsideWorkspaceApproved);

  const startedAt = Date.now();
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let promotedTask = null;

    const childEnv = (ctxForCwd.enableUserHome && ctxForCwd.userHome)
      ? { ...process.env, USERPROFILE: ctxForCwd.userHome, HOME: ctxForCwd.userHome }
      : process.env;

    let proc;
    try {
      if (containerSpec) {
        proc = spawn(containerSpec.file, containerSpec.args, {
          cwd: jailedCwd.absPath,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          env: childEnv
        });
      } else if (reqShell === 'node') {
        proc = spawn(process.execPath, ['-e', command], {
          cwd: jailedCwd.absPath,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          env: childEnv
        });
      } else if (reqShell === 'python') {
        const pyBin = process.platform === 'win32' ? 'python' : 'python3';
        proc = spawn(pyBin, ['-c', command], {
          cwd: jailedCwd.absPath,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          env: childEnv
        });
      } else if (process.platform === 'win32') {
        const hasPsCmdlet = /\b(?:Select-String|Get-|Set-|New-|Remove-|Invoke-|Measure-|Where-Object|ForEach-Object|ConvertTo-|ConvertFrom-|Out-|Write-Output|Format-Table|Format-List|Resolve-Path|Test-Path)\b|\$_(?:\b|\.)/i.test(normalizedHostCmd);
        const needsCmdExe = reqShell === 'cmd' || (reqShell === 'auto' && !hasPsCmdlet && /%[A-Za-z_][A-Za-z0-9_]*%/.test(normalizedHostCmd));
        if (reqShell === 'bash' || reqShell === 'wsl') {
          const gitBashPaths = ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe'];
          const gitBash = reqShell === 'bash' ? gitBashPaths.find(p => fs.existsSync(p)) : null;
          if (gitBash) {
            proc = spawn(gitBash, ['-c', `${normalizedHostCmd}\n__ec=$?\necho "${Z21_CWD_SENTINEL}"\npwd\nexit $__ec`], {
              cwd: jailedCwd.absPath,
              shell: false,
              stdio: ['pipe', 'pipe', 'pipe'],
              windowsHide: true,
              env: childEnv
            });
          } else {
            proc = spawn('wsl.exe', ['-e', 'bash', '-c', `${normalizedHostCmd}\n__ec=$?\necho "${Z21_CWD_SENTINEL}"\npwd\nexit $__ec`], {
              cwd: jailedCwd.absPath,
              shell: false,
              stdio: ['pipe', 'pipe', 'pipe'],
              windowsHide: true,
              env: childEnv
            });
          }
        } else if (needsCmdExe) {
          const cmdWrapped = `${normalizedHostCmd}& set "__zoz_ec=!ERRORLEVEL!"& echo ${Z21_CWD_SENTINEL}& cd& exit /b !__zoz_ec!`;
          proc = spawn('cmd.exe', ['/v:on', '/d', '/s', '/c', `"${cmdWrapped}"`], {
            cwd: jailedCwd.absPath,
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            windowsVerbatimArguments: true,
            env: childEnv
          });
        } else {
          let psCommand = normalizedHostCmd;
          const posixLsMatch = !SHELL_CHAINING_RE.test(command) && command.match(/^ls(?:\s+((?:-[a-zA-Z]+\s*)+))?(?:\s+(.+))?$/i);
          if (posixLsMatch) {
            const flags = String(posixLsMatch[1] || '');
            const forceFlag = /a/i.test(flags) ? ' -Force' : '';
            let lsTarget = posixLsMatch[2] ? posixLsMatch[2].trim().replace(/^["']|["']$/g, '') : '';
            if (lsTarget) {
              const hasGlob = /[*?\[]/.test(lsTarget);
              lsTarget = expandUserPathInput(lsTarget, jailedCwd.absPath || ctxForCwd.primaryRoot, ctxForCwd.userHome, ctxForCwd.enableUserHome);
              if (hasGlob) {
                const absGlob = /^[a-zA-Z]:[\\/]/.test(lsTarget) ? lsTarget : path.join(jailedCwd.absPath || ctxForCwd.primaryRoot, lsTarget);
                psCommand = `Get-ChildItem -Path '${absGlob.replace(/'/g, "''")}'${forceFlag}`;
              } else {
                const absCand = /^[a-zA-Z]:[\\/]/.test(lsTarget) ? lsTarget : path.join(jailedCwd.absPath || ctxForCwd.primaryRoot, lsTarget);
                lsTarget = resolveExistingPathWithNormalizedSegments(absCand) || absCand;
                psCommand = `Get-ChildItem -LiteralPath '${lsTarget.replace(/'/g, "''")}'${forceFlag}`;
              }
            } else {
              psCommand = `Get-ChildItem${forceFlag}`;
            }
          } else {
            psCommand = transpilePosixAndForPowerShell(normalizePosixIdiomsForPowerShell(normalizedHostCmd));
          }
          const psScript = [
            '$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
            '$global:LASTEXITCODE = 0',
            '$script:__zozCmdOk = $true',
            `. {\n${psCommand}\n$script:__zozCmdOk = $?\n} | Out-String -Width 4096 -Stream | ForEach-Object { $_.TrimEnd() }`,
            '$__ok = $script:__zozCmdOk',
            '$__zoz_ec = if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) { $LASTEXITCODE } elseif (-not $__ok) { 1 } else { 0 }',
            `Write-Output '${Z21_CWD_SENTINEL}'`,
            '(Get-Location).Path',
            'exit $__zoz_ec'
          ].join('\n');
          proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
            cwd: jailedCwd.absPath,
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            env: childEnv
          });
        }
      } else {
        const shBin = reqShell === 'bash' && fs.existsSync('/bin/bash') ? '/bin/bash' : 'sh';
        proc = spawn(shBin, ['-c', `${command}\n__ec=$?\necho "${Z21_CWD_SENTINEL}"\npwd\nexit $__ec`], {
          cwd: jailedCwd.absPath,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          env: childEnv
        });
      }
    } catch (spawnErr) {
      resolve({
        ok: false,
        exit_code: -1,
        stdout: '',
        stderr: spawnErr.message,
        timed_out: false,
        truncated: false,
        cwd: jailedCwd.relativePath,
        abs_cwd: jailedCwd.absPath,
        runtime: activeRuntime,
        whitelisted,
        duration_ms: Date.now() - startedAt
      });
      return;
    }

    const MAX_CAPTURE_BYTES = 1024 * 512;
    const appendTaskLog = (txt) => {
      if (!promotedTask || !txt) return;
      if (promotedTask.combinedLog.length + txt.length <= MAX_CAPTURE_BYTES) {
        promotedTask.combinedLog += txt;
      } else {
        const nextLog = (promotedTask.combinedLog + txt).slice(-MAX_CAPTURE_BYTES);
        const trimmedLen = Math.max(0, (promotedTask.combinedLog.length + txt.length) - nextLog.length);
        promotedTask.combinedLog = nextLog;
        promotedTask.lastReadOffset = Math.max(0, (promotedTask.lastReadOffset || 0) - trimmedLen);
      }
    };
    if (proc.stdout) {
      proc.stdout.on('data', (chunk) => {
        const s = chunk.toString('utf8');
        if (stdout.length < 1024 * 256) stdout += s;
        appendTaskLog(s);
      });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (chunk) => {
        const s = chunk.toString('utf8');
        if (stderr.length < 1024 * 256) stderr += s;
        appendTaskLog(`[stderr] ${s}`);
      });
    }

    let killTimer = null;
    let asyncTimer = null;

    if (isBackgroundEligible) {
      asyncTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        evictOldBackgroundTasks();
        const taskId = `task-${++bgTaskCounter}`;
        const initialLog = `${stdout}${stderr ? `\n[stderr] ${stderr}` : ''}`;
        promotedTask = {
          id: taskId,
          pid: proc.pid || null,
          proc,
          command,
          cwd: jailedCwd.relativePath,
          absCwd: jailedCwd.absPath,
          shell: reqShell,
          isDaemon,
          status: 'running',
          exitCode: null,
          killed: false,
          startedAt,
          endedAt: null,
          combinedLog: initialLog,
          lastReadOffset: initialLog.length,
          waiters: [],
          safetyTimer: null
        };
        if (!isDaemon) {
          promotedTask.safetyTimer = setTimeout(() => {
            if (promotedTask && promotedTask.status === 'running') {
              promotedTask.killed = true;
              killSpawnedProcessSafely(proc);
            }
          }, 15 * 60 * 1000);
          if (typeof promotedTask.safetyTimer.unref === 'function') promotedTask.safetyTimer.unref();
        }
        backgroundTasks.set(taskId, promotedTask);
        const formatted = formatCommandOutputsWithErrorPreservation(
          stripZ21CwdSentinel(stdout).stdout,
          stderr,
          DEFAULT_MAX_OUTPUT_CHARS
        );
        resolve({
          ok: true,
          backgrounded: true,
          status: 'running',
          task_id: taskId,
          pid: proc.pid || null,
          is_daemon: isDaemon,
          stdout: formatted.stdout,
          stderr: formatted.stderr,
          timed_out: false,
          truncated: formatted.truncated,
          cwd: jailedCwd.relativePath,
          abs_cwd: jailedCwd.absPath,
          runtime: activeRuntime,
          whitelisted,
          project_jail: true,
          duration_ms: Date.now() - startedAt
        });
      }, waitWindowMs);
      if (typeof asyncTimer.unref === 'function') asyncTimer.unref();
    } else {
      killTimer = setTimeout(() => {
        timedOut = true;
        killSpawnedProcessSafely(proc);
      }, timeoutMs);
    }

    const finalize = (exitCode, spawnErrMsg = '') => {
      if (killTimer) { clearTimeout(killTimer); killTimer = null; }
      if (asyncTimer) { clearTimeout(asyncTimer); asyncTimer = null; }

      if (promotedTask) {
        if (promotedTask.safetyTimer) {
          clearTimeout(promotedTask.safetyTimer);
          promotedTask.safetyTimer = null;
        }
        promotedTask.exitCode = typeof exitCode === 'number' ? exitCode : 1;
        promotedTask.endedAt = Date.now();
        promotedTask.status = promotedTask.killed ? 'killed' : (promotedTask.exitCode === 0 ? 'completed' : 'failed');
        if (spawnErrMsg) appendTaskLog(`\n${spawnErrMsg}`);
        const waiters = promotedTask.waiters.splice(0, promotedTask.waiters.length);
        for (const w of waiters) {
          try { w(); } catch (_) {}
        }
        return;
      }

      if (settled) return;
      settled = true;

      const parsedCwd = stripZ21CwdSentinel(stdout);
      stdout = parsedCwd.stdout;
      let nextAbsCwd = jailedCwd.absPath;
      let nextRelCwd = jailedCwd.relativePath;
      if (parsedCwd.detectedCwd) {
        try {
          const candAbs = path.resolve(parsedCwd.detectedCwd);
          if (!isCriticalSystemPath(candAbs) && fs.existsSync(candAbs) && fs.statSync(candAbs).isDirectory()) {
            const realNext = fs.realpathSync(candAbs);
            if (jailedCwd.outsideWorkspaceApproved || isPathInsideAnyRoot(realNext, ctxForCwd.trustedRoots)) {
              nextAbsCwd = realNext;
              nextRelCwd = isContainedInsideRealRoot(ctxForCwd.primaryRoot, realNext)
                ? (path.relative(ctxForCwd.primaryRoot, realNext) || '.').replace(/\\/g, '/')
                : realNext.replace(/\\/g, '/');
            }
          }
        } catch (_) {}
      }

      const combinedErr = timedOut
        ? `${stderr ? stderr + '\n' : ''}[TIMEOUT] Perintah dihentikan otomatis setelah ${timeoutMs} ms.`
        : spawnErrMsg
        ? `${stderr ? stderr + '\n' : ''}${spawnErrMsg}`
        : stderr;

      const formatted = formatCommandOutputsWithErrorPreservation(stdout, combinedErr, DEFAULT_MAX_OUTPUT_CHARS);
      const code = typeof exitCode === 'number' ? exitCode : timedOut ? 124 : 1;
      const errorHint = (code !== 0 && !timedOut)
        ? buildCommandErrorGuidance({
            command,
            stderr: combinedErr,
            absCwd: nextAbsCwd,
            exitCode: code,
            shell: reqShell
          })
        : '';
      resolve({
        ok: code === 0 && !timedOut,
        exit_code: code,
        stdout: formatted.stdout,
        stderr: formatted.stderr,
        timed_out: timedOut,
        truncated: formatted.truncated,
        stdout_chars: formatted.stdout_chars,
        stderr_chars: formatted.stderr_chars,
        cwd: nextRelCwd,
        abs_cwd: nextAbsCwd,
        runtime: activeRuntime,
        whitelisted,
        project_jail: true,
        ...(errorHint ? { error_hint: errorHint } : {}),
        duration_ms: Date.now() - startedAt
      });
    };

    proc.on('error', (err) => finalize(-1, err.message));
    proc.on('close', (code) => finalize(code));
  });
}

function buildCommandErrorGuidance({ command = '', stderr = '', absCwd = '', exitCode = 1, shell = 'auto' } = {}) {
  if (!exitCode || exitCode === 0) return '';
  const errStr = String(stderr || '');
  const cmdStr = String(command || '');
  if (/Could not find a part of the path|Cannot find path|ItemNotFoundException|The system cannot find the path/i.test(errStr)) {
    let entriesLabel = '(tidak dapat dibaca)';
    try {
      if (absCwd && fs.existsSync(absCwd) && !isCriticalSystemPath(absCwd)) {
        const items = fs.readdirSync(absCwd, { withFileTypes: true })
          .filter(d => d && d.name && !d.name.startsWith('.') && !isSensitiveSegmentOrName(d.name))
          .slice(0, 10)
          .map(d => (d.isDirectory() ? `${d.name}/` : d.name));
        entriesLabel = items.length > 0 ? items.join(', ') : '(kosong)';
      }
    } catch (_) {}
    const parts = [`cwd="${absCwd}" | isi folder: ${entriesLabel}.`];
    if (/\b(?:Copy-Item|Move-Item|cp|mv)\b/i.test(cmdStr) && /Could not find a part of the path/i.test(errStr)) {
      parts.push('Jika folder induk tujuan belum ada, buat dulu: New-Item -ItemType Directory -Force -Path "<folder_tujuan>" | Out-Null.');
    }
    return parts.join(' ');
  }
  if (/A parameter cannot be found that matches parameter name/i.test(errStr)) {
    return `Shell aktif adalah Windows PowerShell 5.1 (shell="${shell}"); gunakan cmdlet PowerShell native (Copy-Item, Move-Item, New-Item, Get-ChildItem) atau set shell="bash" jika memakai flag POSIX.`;
  }
  if (/is not recognized as the name of a cmdlet|CommandNotFoundException/i.test(errStr)) {
    return 'Perintah tidak dikenali di PowerShell 5.1 Windows; gunakan tool read_file/edit_file/grep_search atau cmdlet PowerShell yang valid.';
  }
  return '';
}

function buildFileApprovalResponse(action, target) {
  return {
    ok: false,
    status: 'requires_approval',
    requires_approval: true,
    approval_type: 'outside_workspace_file',
    action,
    path: target.candidateAbs,
    abs_path: target.candidateAbs,
    parent_dir: target.parentDir,
    preset: target.preset,
    outside_workspace: Boolean(target.outsideWorkspace),
    reason: `Operasi \`${action}\` pada "${target.candidateAbs}" berada di luar workspace utama dan memerlukan persetujuan pengguna (HITL Y/N).`
  };
}

function isChildEntryAccessible(realChild, target) {
  if (isCriticalSystemPath(realChild)) return false;
  if (target.outsideWorkspaceApproved) return true;
  if (target.outsideWorkspace) return isContainedInsideRealRoot(target.absPath, realChild);
  return Boolean(isPathInsideAnyRoot(realChild, target.allowedRoots || [target.projectRoot]));
}

const LAZY_ELISION_PLACEHOLDER_RE = /(?:<!--\s*\.\.\.\s*(?:existing|rest|unchanged|sisa|kode|tetap)[\s\S]*?-->|(?:\/\/|\/\*|#)\s*\.\.\.\s*(?:existing\s+code|rest\s+of\s+(?:code|file)|unchanged|sisa\s+kode|kode\s+(?:lainnya|tetap|sebelumnya)))/i;

function readProjectFile(options = {}) {
  const rawPath = options.path || options.file_path || options.filePath || options.Path || options.file || '';
  const target = resolveProjectJailedPath(rawPath, options.projectRoot, {
    ...options,
    allowRoot: false,
    mustExist: true,
    expectDir: false,
    operation: 'read',
    returnApprovalObject: Boolean(options.permissionPreset || options.allowOutsideApproval)
  });
  if (target.requiresApproval) {
    return buildFileApprovalResponse('read_file', target);
  }
  const stat = fs.statSync(target.absPath);
  if (stat.size > 1024 * 1024) {
    throw new Error(`FILE_TOO_LARGE: Berkas (${stat.size} bytes) melebihi batas baca 1 MB.`);
  }
  const rawBuf = fs.readFileSync(target.absPath);
  if (rawBuf.subarray(0, Math.min(8192, rawBuf.length)).includes(0)) {
    throw new Error(`BINARY_FILE: Berkas "${target.relativePath}" adalah file biner (bukan teks UTF-8) sehingga tidak dapat dibaca sebagai teks.`);
  }
  const raw = rawBuf.toString('utf8');
  const lines = raw.split(/\r?\n/);

  const startLine = Math.max(1, Number(options.start_line ?? options.startLine ?? options.offset) || 1);
  const explicitEnd = (options.end_line ?? options.endLine);
  const requestedEnd = explicitEnd
    ? Number(explicitEnd)
    : (options.limit ? (startLine + Math.max(1, Number(options.limit)) - 1) : (startLine + 1599));
  const maxEndLine = Math.min(lines.length, Math.max(startLine, requestedEnd));
  const MAX_READ_CHARS = 75000;

  const rawSelectedLines = [];
  const numberedLines = [];
  let charAcc = 0;
  for (let i = startLine - 1; i < maxEndLine; i++) {
    const lineText = lines[i];
    const numLine = `${i + 1}: ${lineText}`;
    const addCost = numLine.length + (numberedLines.length > 0 ? 1 : 0);
    if (numberedLines.length > 0 && (charAcc + addCost > MAX_READ_CHARS)) {
      const remainingLineCount = maxEndLine - i;
      let remainingChars = 0;
      if (remainingLineCount <= 60) {
        for (let j = i; j < maxEndLine; j++) {
          remainingChars += `${j + 1}: ${lines[j]}`.length + 1;
        }
      }
      if (remainingLineCount > 60 || remainingChars > 4000) {
        break;
      }
    }
    if (numberedLines.length === 0 && numLine.length > MAX_READ_CHARS) {
      rawSelectedLines.push(lineText.slice(0, MAX_READ_CHARS));
      numberedLines.push(numLine.slice(0, MAX_READ_CHARS));
      charAcc = numberedLines[0].length;
      break;
    }
    rawSelectedLines.push(lineText);
    numberedLines.push(numLine);
    charAcc += addCost;
  }

  const actualEndLine = rawSelectedLines.length > 0 ? (startLine + rawSelectedLines.length - 1) : 0;
  const hasMore = actualEndLine > 0 && actualEndLine < lines.length;

  return {
    ok: true,
    path: target.relativePath,
    abs_path: target.absPath,
    outside_workspace: Boolean(target.outsideWorkspace),
    start_line: startLine,
    end_line: actualEndLine,
    actual_end_line: actualEndLine,
    total_lines: lines.length,
    has_more: hasMore,
    next_start_line: hasMore ? (actualEndLine + 1) : null,
    bytes: stat.size,
    truncated: hasMore,
    content: rawSelectedLines.join('\n'),
    numbered_content: numberedLines.join('\n'),
    project_jail: true
  };
}

function parseLooseJsonArrayOrStrings(rawVal, options = {}) {
  if (Array.isArray(rawVal)) return rawVal;
  if (typeof rawVal === 'string') {
    const trimmed = rawVal.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
      if (trimmed.endsWith(']') && trimmed.length >= 2) {
        const inner = trimmed.slice(1, -1).trim();
        if (!inner) return [];
        return inner.split(',').map(s => s.trim().replace(/^["']+|["']+$/g, '')).filter(Boolean);
      }
    }
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map(s => s.trim().replace(/^["']+|["']+$/g, '')).filter(Boolean);
      if (parts.length > 0) return parts;
    }
    if (options.allowSingleToken) {
      return [trimmed];
    }
  }
  return null;
}

function extractFileCodeOutline(rawContent, relPath = '', options = {}) {
  const norm = String(rawContent || '').replace(/\r\n?/g, '\n');
  const lines = norm === '' ? [] : norm.split('\n');
  const totalLines = lines.length;
  const maxSections = Math.min(120, Math.max(10, Math.floor(Number(options.max_sections ?? options.maxSections) || 80)));
  const maxChars = Math.min(8000, Math.max(600, Math.floor(Number(options.max_chars ?? options.maxChars) || 4500)));
  const ext = path.extname(String(relPath || '')).toLowerCase();

  let lang = 'text';
  if (/^\.(?:html?|xhtml|vue|svelte)$/i.test(ext)) lang = 'html';
  else if (/^\.(?:css|scss|sass|less)$/i.test(ext)) lang = 'css';
  else if (/^\.(?:js|mjs|cjs|ts|tsx|jsx)$/i.test(ext)) lang = 'js';
  else if (/^\.py$/i.test(ext)) lang = 'python';
  else if (/^\.md$/i.test(ext)) lang = 'markdown';
  else if (/^\.json$/i.test(ext)) lang = 'json';
  else if (lines.some(l => /^\s*<!DOCTYPE\b|<html\b/i.test(l))) lang = 'html';

  const rawHits = [];
  let inStyle = false;
  let inScript = false;
  let inMarkdownFence = false;

  for (let i = 0; i < totalLines; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const indent = (rawLine.match(/^[ \t]*/) || [''])[0].length;
    const lineNo = i + 1;

    if (lang === 'html') {
      if (!inStyle && !inScript && /^<style\b/i.test(trimmed)) {
        rawHits.push({ start_line: lineNo, kind: 'style_block', label: trimmed.slice(0, 100), isMajor: true });
        if (!/<\/style\s*>/i.test(trimmed)) inStyle = true;
        continue;
      }
      if (inStyle && /<\/style\s*>/i.test(trimmed)) {
        inStyle = false;
        continue;
      }
      if (!inScript && !inStyle && /^<script\b/i.test(trimmed)) {
        rawHits.push({ start_line: lineNo, kind: 'script_block', label: trimmed.slice(0, 100), isMajor: true });
        if (!/<\/script\s*>/i.test(trimmed)) inScript = true;
        continue;
      }
      if (inScript && /<\/script\s*>/i.test(trimmed)) {
        inScript = false;
        continue;
      }
    }

    if (inStyle || lang === 'css') {
      if (
        /^\/\*(?:=|─|-|\*){3,}/.test(trimmed) ||
        /^:root\b/.test(trimmed) ||
        /^\[data-theme\b/i.test(trimmed) ||
        /^@(?:media|keyframes|layer|supports|font-face)\b/i.test(trimmed) ||
        (indent <= 8 && /^[.#a-zA-Z\[*:][^{}\n]{1,75}\{\s*$/.test(trimmed))
      ) {
        rawHits.push({ start_line: lineNo, kind: 'css_rule', label: trimmed.slice(0, 100), isMajor: indent <= 4 });
      }
      continue;
    }

    if (inScript || lang === 'js') {
      if (
        /^\/\/\s*(?:=|─|-|\*){3,}/.test(trimmed) ||
        /^(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+[A-Za-z0-9_$]+/.test(trimmed) ||
        /^(?:export\s+(?:default\s+)?)?(?:abstract\s+)?(?:class|interface|type|enum)\s+[A-Za-z0-9_$]+/.test(trimmed) ||
        (indent <= 4 && /^(?:export\s+(?:default\s+)?)?(?:const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*(?:async\s+)?(?:(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>|function\b)/.test(trimmed)) ||
        (indent <= 2 && /^(?:const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*(?:\{|\[)/.test(trimmed)) ||
        (indent <= 4 && /^(?:async\s+)?[A-Za-z_$][A-Za-z0-9_$]*\s*\([^)]*\)\s*\{\s*$/.test(trimmed) && !/^(?:if|for|while|switch|catch|else)\b/.test(trimmed)) ||
        /^(?:window\.[A-Za-z0-9_$]+\s*=|module\.exports\s*=)/.test(trimmed) ||
        /addEventListener\s*\(/.test(trimmed)
      ) {
        rawHits.push({ start_line: lineNo, kind: 'js_symbol', label: trimmed.slice(0, 105), isMajor: indent <= 4 });
      }
      continue;
    }

    if (lang === 'html') {
      if (
        /^<!DOCTYPE\b|^<(?:html|head|title|body|header|nav|main|section|article|aside|footer|video|audio)\b/i.test(trimmed) ||
        /^<!--\s*(?:=|─|-|\*|[A-Z0-9 _-]{4,})/.test(trimmed) ||
        /<[a-z][a-z0-9-]*\b[^>]*\bid=["'][^"']+["']/i.test(trimmed)
      ) {
        rawHits.push({ start_line: lineNo, kind: 'html_section', label: trimmed.slice(0, 105), isMajor: indent <= 6 });
      }
      continue;
    }

    if (lang === 'python') {
      if (/^(?:async\s+)?def\s+[A-Za-z0-9_]+|^class\s+[A-Za-z0-9_]+|^#\s*(?:=|─|-){3,}/.test(trimmed)) {
        rawHits.push({ start_line: lineNo, kind: 'py_symbol', label: trimmed.slice(0, 105), isMajor: indent === 0 });
      }
      continue;
    }

    if (lang === 'markdown') {
      if (/^(?:```|~~~)/.test(trimmed)) {
        inMarkdownFence = !inMarkdownFence;
        continue;
      }
      if (!inMarkdownFence && /^#{1,4}\s+\S/.test(trimmed)) {
        rawHits.push({ start_line: lineNo, kind: 'heading', label: trimmed.slice(0, 105), isMajor: /^#{1,2}\s/.test(trimmed) });
      }
      continue;
    }

    if (lang === 'json') {
      if (indent <= 4 && /^"[^"]+"\s*:/.test(trimmed)) {
        rawHits.push({ start_line: lineNo, kind: 'json_key', label: trimmed.slice(0, 105), isMajor: indent <= 2 });
      }
      continue;
    }

    if (/^(?:async\s+)?function\s+[A-Za-z0-9_$]+|^(?:export\s+)?class\s+[A-Za-z0-9_$]+|^(?:async\s+)?def\s+[A-Za-z0-9_]+|^#{1,3}\s+\S|^<[a-z]+[^>]*\bid=["']/.test(trimmed)) {
      rawHits.push({ start_line: lineNo, kind: 'landmark', label: trimmed.slice(0, 105), isMajor: indent <= 4 });
    }
  }

  const deduped = [];
  for (const hit of rawHits) {
    if (deduped.length > 0 && deduped[deduped.length - 1].start_line === hit.start_line) continue;
    deduped.push(hit);
  }

  const sections = [];
  const limitCount = Math.min(deduped.length, maxSections);
  for (let i = 0; i < limitCount; i++) {
    const cur = deduped[i];
    const nextStart = i + 1 < deduped.length ? deduped[i + 1].start_line : (totalLines + 1);
    const estEnd = Math.max(cur.start_line, Math.min(totalLines, nextStart - 1));
    sections.push({
      label: cur.label,
      kind: cur.kind,
      start_line: cur.start_line,
      end_line: estEnd
    });
  }

  const linesOut = [];
  let charAcc = 0;
  for (const s of sections) {
    const spanTxt = s.end_line > s.start_line ? `${s.start_line}-${s.end_line}` : `${s.start_line}`;
    const entryLine = `- Baris ${spanTxt}: ${s.label}`;
    if (charAcc + entryLine.length + 1 > maxChars) break;
    linesOut.push(entryLine);
    charAcc += entryLine.length + 1;
  }

  return {
    language: lang,
    total_lines: totalLines,
    sections,
    text: linesOut.join('\n') || `(tidak terdeteksi struktur blok khusus; total ${totalLines} baris)`
  };
}

function selectLinesFromContentCore(rawContent, relPath = '', byteSize = 0, options = {}) {
  const norm = String(rawContent || '').replace(/\r\n?/g, '\n');
  const lines = norm === '' ? [] : norm.split('\n');
  const totalLines = lines.length;
  const relLabel = relPath || 'file';

  const MAX_RANGES = 12;
  const MAX_SELECTED_LINES = 260;
  const MAX_SELECT_CHARS = Math.min(55000, Math.max(1000, Math.floor(Number(options.max_chars ?? options.maxChars) || 55000)));

  const parseStrictFiniteInt = (val, fieldName) => {
    const n = Number(val);
    if (!Number.isFinite(n)) {
      throw new Error(`RANGE_INVALID: Parameter ${fieldName} (${String(val)}) harus berupa angka valid pada ${relLabel}.`);
    }
    return Math.floor(n);
  };

  const outlineOnly = Boolean(options.outline);
  const aroundRaw = options.around_line ?? options.aroundLine ?? options.line;
  const hasAroundParam = aroundRaw !== undefined && aroundRaw !== null && String(aroundRaw).trim() !== '';
  const hasRangesInput = options.ranges !== undefined && options.ranges !== null && String(options.ranges).trim() !== '' && !(Array.isArray(options.ranges) && options.ranges.length === 0);
  const rawRangesParam = parseLooseJsonArrayOrStrings(options.ranges, { allowSingleToken: true }) ?? (Array.isArray(options.ranges) ? options.ranges : null);
  const singleStartRaw = options.start_line ?? options.startLine ?? options.offset;
  const singleEndRaw = options.end_line ?? options.endLine;
  const limitRaw = options.limit;
  const hasLimitParam = limitRaw !== undefined && limitRaw !== null && String(limitRaw).trim() !== '';
  const hasSingleRange = (singleStartRaw !== undefined && singleStartRaw !== null && String(singleStartRaw).trim() !== '') ||
    (singleEndRaw !== undefined && singleEndRaw !== null && String(singleEndRaw).trim() !== '') ||
    hasLimitParam;

  const rawSymbol = (options.symbol !== undefined && options.symbol !== null) ? String(options.symbol).trim() : '';
  const rawQuery = (options.query !== undefined && options.query !== null) ? String(options.query).trim() : '';
  const parsedKeywords = parseLooseJsonArrayOrStrings(options.keywords) ?? (typeof options.keywords === 'string' && options.keywords.trim() ? [options.keywords.trim()] : []);
  const keywordsList = [...parsedKeywords.map(k => String(k || '').trim()).filter(Boolean)];
  if (rawSymbol && !keywordsList.includes(rawSymbol)) keywordsList.unshift(rawSymbol);
  if (rawQuery && !keywordsList.includes(rawQuery)) keywordsList.push(rawQuery);
  const hasSearchSelectors = keywordsList.length > 0;

  const outlineData = extractFileCodeOutline(norm, relLabel);
  const rawContext = options.context_lines ?? options.contextLines ?? options.context;
  const hasContextParam = rawContext !== undefined && rawContext !== null && String(rawContext).trim() !== '';

  let mode = 'outline';
  let requestedWindows = [];
  let matchedLines = [];
  let matchFound = true;
  let truncatedByBudget = false;

  if (totalLines === 0) {
    return {
      ok: true,
      mode: 'empty',
      path: relLabel,
      total_lines: 0,
      bytes: byteSize,
      selected_lines_count: 0,
      selected_count: 0,
      omitted_lines_count: 0,
      picked_ranges: [],
      ranges_applied: [],
      ranges_label: '-',
      matched_lines: [],
      match_found: false,
      truncated: false,
      outline: outlineData,
      outline_text: outlineData.text,
      content: '',
      numbered_content: ''
    };
  }

  const parseOneRangeItem = (item) => {
    if (Array.isArray(item) && item.length >= 1) {
      const s = Number(item[0]);
      const e = Number(item[1] ?? item[0]);
      return { start_line: s, end_line: e };
    }
    if (typeof item === 'string') {
      const m = item.trim().match(/^(\d+)(?:\s*(?:-(?!-)|:(?!:)|\.\.(?!\.))\s*(\d+))?$/);
      if (m) {
        const s = Number(m[1]);
        const e = Number(m[2] || m[1]);
        return { start_line: s, end_line: e };
      }
      return null;
    }
    if (item && typeof item === 'object') {
      const s = Number(item.start_line ?? item.startLine ?? item.start ?? item.from);
      const eVal = item.end_line ?? item.endLine ?? item.end ?? item.to;
      const e = (eVal !== undefined && eVal !== null && eVal !== '') ? Number(eVal) : s;
      return { start_line: s, end_line: e };
    }
    return null;
  };

  if (!outlineOnly && (hasRangesInput || (rawRangesParam && rawRangesParam.length > 0) || hasSingleRange)) {
    mode = 'ranges';
    if (hasRangesInput && (!rawRangesParam || rawRangesParam.length === 0)) {
      throw new Error(`RANGE_INVALID: Format parameter ranges tidak valid pada ${relLabel}.`);
    }
    let inputList;
    if (rawRangesParam && rawRangesParam.length > 0) {
      if (rawRangesParam.length > MAX_RANGES) truncatedByBudget = true;
      inputList = rawRangesParam.slice(0, MAX_RANGES);
    } else {
      const sVal = (singleStartRaw !== undefined && singleStartRaw !== null && String(singleStartRaw).trim() !== '')
        ? parseStrictFiniteInt(singleStartRaw, 'start_line')
        : 1;
      let eVal;
      if (singleEndRaw !== undefined && singleEndRaw !== null && String(singleEndRaw).trim() !== '') {
        eVal = parseStrictFiniteInt(singleEndRaw, 'end_line');
      } else if (hasLimitParam) {
        const limVal = parseStrictFiniteInt(limitRaw, 'limit');
        if (limVal < 1) {
          throw new Error(`RANGE_INVALID: Parameter limit (${limVal}) harus >= 1 pada ${relLabel}.`);
        }
        eVal = Math.max(1, sVal) + limVal - 1;
      } else {
        eVal = Math.max(1, sVal) + 79;
      }
      inputList = [{ start_line: sVal, end_line: eVal }];
    }

    for (const rawItem of inputList) {
      const parsed = parseOneRangeItem(rawItem);
      if (!parsed || !Number.isFinite(parsed.start_line) || !Number.isFinite(parsed.end_line)) {
        throw new Error(`RANGE_INVALID: Format rentang baris tidak valid pada ${relLabel}.`);
      }
      const s = Math.floor(parsed.start_line);
      const e = Math.floor(parsed.end_line);
      if (s < 1 || e < 1) {
        throw new Error(`RANGE_INVALID: Nomor baris harus >= 1 pada ${relLabel} (diterima ${s}-${e}).`);
      }
      if (e < s) {
        throw new Error(`RANGE_INVALID: end_line (${e}) harus >= start_line (${s}) pada ${relLabel}.`);
      }
      if (s > totalLines) {
        throw new Error(`RANGE_OUT_OF_BOUNDS: start_line (${s}) melebihi jumlah baris berkas (${totalLines}) pada ${relLabel}.`);
      }
      requestedWindows.push({ start_line: s, end_line: Math.min(totalLines, e) });
    }
  } else if (!outlineOnly && hasAroundParam) {
    mode = 'around_line';
    const center = parseStrictFiniteInt(aroundRaw, 'around_line');
    if (center < 1 || center > totalLines) {
      throw new Error(`RANGE_OUT_OF_BOUNDS: around_line (${center}) berada di luar rentang 1..${totalLines} pada ${relLabel}.`);
    }
    const ctxLines = Math.min(80, Math.max(0, hasContextParam ? parseStrictFiniteInt(rawContext, 'context_lines') : 15));
    requestedWindows.push({
      start_line: Math.max(1, center - ctxLines),
      end_line: Math.min(totalLines, center + ctxLines)
    });
    matchedLines.push(center);
  } else if (!outlineOnly && hasSearchSelectors) {
    mode = (rawSymbol && !rawQuery) ? 'symbol' : 'query';
    const isRegex = Boolean(options.is_regex ?? options.isRegex);
    const caseSensitive = Boolean(options.case_sensitive ?? options.caseSensitive);
    const ctxLines = Math.min(60, Math.max(0, hasContextParam ? parseStrictFiniteInt(rawContext, 'context_lines') : 8));
    const maxMatchesRaw = options.max_matches ?? options.maxMatches;
    const maxMatches = Math.min(20, Math.max(1, (maxMatchesRaw !== undefined && maxMatchesRaw !== null && String(maxMatchesRaw).trim() !== '') ? parseStrictFiniteInt(maxMatchesRaw, 'max_matches') : 10));

    let matchers = [];
    if (isRegex) {
      const regexTargets = rawQuery ? [rawQuery] : keywordsList;
      for (const kw of regexTargets) {
        if (kw.length > 256 || /(?:[+*]|\{\d+,\})\s*\)[+*?]/.test(kw)) {
          throw new Error(`INVALID_REGEX: Pola regex "${kw.slice(0, 60)}" terlalu panjang atau berisiko ReDoS.`);
        }
        try {
          matchers.push({ kw, re: new RegExp(kw, caseSensitive ? '' : 'i') });
        } catch (rxErr) {
          throw new Error(`INVALID_REGEX: Pola regex "${kw}" tidak valid (${rxErr.message}).`);
        }
      }
      if (rawQuery && keywordsList.length > 1) {
        for (const extraKw of keywordsList) {
          if (extraKw !== rawQuery) {
            matchers.push({ kw: extraKw, needle: caseSensitive ? extraKw : extraKw.toLowerCase() });
          }
        }
      }
    } else {
      matchers = keywordsList.map(kw => ({ kw, needle: caseSensitive ? kw : kw.toLowerCase() }));
    }

    const symEsc = rawSymbol ? rawSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    const symRe = symEsc
      ? new RegExp(`(?:\\bfunction\\s+${symEsc}\\b|\\bclass\\s+${symEsc}\\b|\\bdef\\s+${symEsc}\\b|\\b(?:const|let|var)\\s+${symEsc}\\s*=|id=["']${symEsc}["']|<${symEsc}\\b)`, caseSensitive ? '' : 'i')
      : null;

    const hitScores = [];
    for (let i = 0; i < totalLines; i++) {
      const lineStr = lines[i];
      const lineCmp = caseSensitive ? lineStr : lineStr.toLowerCase();
      let matchScore = 0;
      for (const m of matchers) {
        if (m.re ? m.re.test(lineStr) : lineCmp.includes(m.needle)) {
          matchScore += 1;
        }
      }
      if (matchScore > 0) {
        const defBonus = (symRe && symRe.test(lineStr)) ? 10 : 0;
        hitScores.push({ line: i + 1, priority: matchScore + defBonus });
      }
    }

    if (hitScores.length === 0) {
      matchFound = false;
      mode = 'query_no_match_outline';
    } else {
      hitScores.sort((a, b) => (b.priority - a.priority) || (a.line - b.line));
      const pickedHits = hitScores.slice(0, maxMatches).sort((a, b) => a.line - b.line);
      for (const h of pickedHits) {
        matchedLines.push(h.line);
        requestedWindows.push({
          start_line: Math.max(1, h.line - ctxLines),
          end_line: Math.min(totalLines, h.line + ctxLines)
        });
      }
    }
  }

  if (mode === 'outline' || mode === 'query_no_match_outline') {
    const headEnd = Math.min(totalLines, 15);
    const tailStart = Math.max(headEnd + 1, totalLines - 14);
    if (headEnd >= 1) requestedWindows.push({ start_line: 1, end_line: headEnd });
    if (tailStart <= totalLines && tailStart > headEnd) requestedWindows.push({ start_line: tailStart, end_line: totalLines });
  }

  // Urutkan & gabungkan rentang yang tumpang tindih atau berjarak <= 2 baris
  requestedWindows.sort((a, b) => a.start_line - b.start_line || a.end_line - b.end_line);
  const mergedWindows = [];
  for (const w of requestedWindows) {
    if (mergedWindows.length === 0 || w.start_line > mergedWindows[mergedWindows.length - 1].end_line + 2) {
      mergedWindows.push({ start_line: w.start_line, end_line: w.end_line });
    } else if (w.end_line > mergedWindows[mergedWindows.length - 1].end_line) {
      mergedWindows[mergedWindows.length - 1].end_line = w.end_line;
    }
  }

  const clipSafeStr = (str, maxLen) => {
    if (str.length <= maxLen) return str;
    let end = maxLen;
    if (end > 0) {
      const code = str.charCodeAt(end - 1);
      if (code >= 0xD800 && code <= 0xDBFF) end -= 1;
    }
    return str.slice(0, Math.max(0, end));
  };

  const pickedRanges = [];
  const rawBlockStrings = [];
  const numberedBlockStrings = [];
  let selectedLinesCount = 0;
  let totalCharsAcc = 0;
  let prevEndLine = 0;

  for (const w of mergedWindows) {
    if (selectedLinesCount >= MAX_SELECTED_LINES || totalCharsAcc >= MAX_SELECT_CHARS) {
      truncatedByBudget = true;
      break;
    }
    const rawBlock = [];
    const numBlock = [];
    let actualStart = w.start_line;
    let actualEnd = w.start_line - 1;

    for (let ln = w.start_line; ln <= w.end_line; ln++) {
      if (selectedLinesCount >= MAX_SELECTED_LINES) {
        truncatedByBudget = true;
        break;
      }
      let textLine = lines[ln - 1];
      let numLine = `${ln}: ${textLine}`;
      const cost = numLine.length + 1;
      if (selectedLinesCount > 0 && totalCharsAcc + cost > MAX_SELECT_CHARS) {
        truncatedByBudget = true;
        break;
      }
      if (selectedLinesCount === 0 && cost > MAX_SELECT_CHARS) {
        const prefixLen = `${ln}: `.length;
        textLine = clipSafeStr(textLine, Math.max(80, MAX_SELECT_CHARS - prefixLen - 64)) + '...[BARIS_DIPOTONG]';
        numLine = `${ln}: ${textLine}`;
        truncatedByBudget = true;
      }
      rawBlock.push(textLine);
      numBlock.push(numLine);
      selectedLinesCount++;
      totalCharsAcc += numLine.length + 1;
      actualEnd = ln;
      if (truncatedByBudget && selectedLinesCount === 1 && cost > MAX_SELECT_CHARS) {
        break;
      }
    }

    if (actualEnd >= actualStart) {
      if (prevEndLine > 0 && actualStart > prevEndLine + 1) {
        const skipped = actualStart - prevEndLine - 1;
        const divider = `... [Baris ${prevEndLine + 1}..${actualStart - 1} dilewati (${skipped} baris)] ...`;
        rawBlockStrings.push(divider);
        numberedBlockStrings.push(divider);
      }
      prevEndLine = actualEnd;
      pickedRanges.push({ start_line: actualStart, end_line: actualEnd });
      rawBlockStrings.push(rawBlock.join('\n'));
      numberedBlockStrings.push(numBlock.join('\n'));
    }
  }

  matchedLines = matchedLines.filter(ln => pickedRanges.some(r => ln >= r.start_line && ln <= r.end_line));
  const rangesLabel = pickedRanges.map(r => (r.start_line === r.end_line ? `${r.start_line}` : `${r.start_line}-${r.end_line}`)).join(', ') || '-';

  return {
    ok: true,
    mode,
    path: relLabel,
    total_lines: totalLines,
    bytes: byteSize,
    selected_lines_count: selectedLinesCount,
    selected_count: selectedLinesCount,
    omitted_lines_count: Math.max(0, totalLines - selectedLinesCount),
    picked_ranges: pickedRanges,
    ranges_applied: pickedRanges,
    ranges_label: rangesLabel,
    matched_lines: matchedLines,
    match_found: matchFound,
    truncated: truncatedByBudget,
    outline: outlineData,
    outline_text: outlineData.text,
    content: rawBlockStrings.join('\n'),
    numbered_content: numberedBlockStrings.join('\n')
  };
}

function selectProjectFileLines(options = {}) {
  const rawPath = options.path || options.file_path || options.filePath || options.filepath || options.target_file || options.Path || options.file || '';
  const target = resolveProjectJailedPath(rawPath, options.projectRoot, {
    ...options,
    allowRoot: false,
    mustExist: true,
    expectDir: false,
    operation: 'read',
    returnApprovalObject: Boolean(options.permissionPreset || options.allowOutsideApproval)
  });
  if (target.requiresApproval) {
    return buildFileApprovalResponse('select_lines', target);
  }

  const stat = fs.statSync(target.absPath);
  if (stat.size > 2 * 1024 * 1024) {
    throw new Error(`FILE_TOO_LARGE: Berkas (${stat.size} bytes) melebihi batas seleksi 2 MB.`);
  }
  const rawBuf = fs.readFileSync(target.absPath);
  if (rawBuf.includes(0)) {
    throw new Error(`BINARY_FILE: Berkas "${target.relativePath}" adalah file biner (bukan teks UTF-8) sehingga tidak dapat diseleksi sebagai teks.`);
  }

  const coreResult = selectLinesFromContentCore(rawBuf.toString('utf8'), target.relativePath, stat.size, options);
  return {
    ...coreResult,
    path: target.relativePath,
    abs_path: target.absPath,
    outside_workspace: Boolean(target.outsideWorkspace),
    project_jail: true
  };
}

function writeProjectFile(options = {}) {
  const rawPath = options.path || options.file_path || options.filePath || options.Path || options.file || '';
  const target = resolveProjectJailedPath(rawPath, options.projectRoot, {
    ...options,
    allowRoot: false,
    mustExist: false,
    expectDir: false,
    operation: 'write',
    returnApprovalObject: Boolean(options.permissionPreset || options.allowOutsideApproval)
  });
  if (target.requiresApproval) {
    return buildFileApprovalResponse('write_file', target);
  }
  const rawContent = options.content !== undefined ? options.content : (options.Content !== undefined ? options.Content : options.text);
  const content = rawContent === undefined || rawContent === null ? '' : String(rawContent);
  const mode = String(options.mode || 'overwrite').toLowerCase() === 'append' ? 'append' : 'overwrite';
  if (
    mode === 'overwrite' &&
    /\.(?:html?|css|js|mjs|cjs|jsx|ts|tsx|json|py|md|svg)$/i.test(target.absPath) &&
    fs.existsSync(target.absPath)
  ) {
    try {
      const existingStat = fs.statSync(target.absPath);
      if (existingStat.isFile() && existingStat.size <= 1024 * 1024) {
        const existingRaw = fs.readFileSync(target.absPath, 'utf8');
        if (LAZY_ELISION_PLACEHOLDER_RE.test(content) && !LAZY_ELISION_PLACEHOLDER_RE.test(existingRaw)) {
          throw new Error(
            `LAZY_PLACEHOLDER_BLOCKED: Penulisan ke "${target.relativePath}" ditolak karena mengandung komentar pemotong ("... existing code ..."). Gunakan edit_file hanya pada bagian baris yang berubah!`
          );
        }
        if (!options.allow_destructive_shrink && existingStat.size >= 1500) {
          const existingBytes = existingStat.size;
          const existingLines = existingRaw.split(/\r?\n/).length;
          if (existingLines >= 40) {
            const newBytes = Buffer.byteLength(content, 'utf8');
            const newLines = content.split(/\r?\n/).length;
            const isSevereShrink = newBytes < existingBytes * 0.35 && newLines < existingLines * 0.45;
            const isHtmlShellDestroyed = /\.(?:html?)$/i.test(target.absPath) && (
              (/(?:<!DOCTYPE\s+html|<html\b)/i.test(existingRaw) && !/(?:<!DOCTYPE\s+html|<html\b)/i.test(content)) ||
              (/<\/html>/i.test(existingRaw) && !/<\/html>/i.test(content))
            );
            if (isSevereShrink || isHtmlShellDestroyed) {
              throw new Error(
                `DESTRUCTIVE_OVERWRITE_BLOCKED: File "${target.relativePath}" saat ini utuh (${existingBytes} B, ${existingLines} baris), sedangkan write_file Anda hanya ${newBytes} B (${newLines} baris)${isHtmlShellDestroyed ? ' dan kehilangan struktur lengkap <html>...</html>' : ''}. Panggil read_file("${target.relativePath}") lalu gunakan edit_file untuk menyisipkan perubahan secara bedah tanpa merusak file yang sudah ada (atau sertakan allow_destructive_shrink: true bila memang ingin mengganti total).`
              );
            }
          }
        }
      }
    } catch (guardErr) {
      if (guardErr && (/^(?:DESTRUCTIVE_OVERWRITE_BLOCKED|LAZY_PLACEHOLDER_BLOCKED):/.test(String(guardErr.message || '')))) {
        throw guardErr;
      }
    }
  }
  fs.mkdirSync(path.dirname(target.absPath), { recursive: true });
  if (mode === 'append') {
    fs.appendFileSync(target.absPath, content, 'utf8');
  } else {
    fs.writeFileSync(target.absPath, content, 'utf8');
  }
  const stat = fs.statSync(target.absPath);
  return {
    ok: true,
    path: target.relativePath,
    abs_path: target.absPath,
    outside_workspace: Boolean(target.outsideWorkspace),
    mode,
    bytes: stat.size,
    lines: content.split(/\r?\n/).length,
    project_jail: true
  };
}

function listProjectDir(options = {}) {
  const target = resolveProjectJailedPath(options.path || '.', options.projectRoot, {
    ...options,
    allowRoot: true,
    mustExist: true,
    expectDir: true,
    operation: 'read',
    returnApprovalObject: Boolean(options.permissionPreset || options.allowOutsideApproval)
  });
  if (target.requiresApproval) {
    return buildFileApprovalResponse('list_dir', target);
  }
  const maxDepth = Math.min(4, Math.max(1, Number(options.depth) || 2));
  const includeHidden = Boolean(options.include_hidden);
  const sortBy = ['modified', 'size', 'name'].includes(String(options.sort_by || '').toLowerCase())
    ? String(options.sort_by).toLowerCase()
    : 'name';
  const maxEntries = 250;
  const entries = [];
  const walkRelInit = target.insidePrimaryRoot ? target.relativePath : '.';

  const queue = [{ dirAbs: target.absPath, relBase: walkRelInit, depth: 1 }];
  while (queue.length > 0 && entries.length < maxEntries) {
    const node = queue.shift();
    let items = [];
    try {
      items = fs.readdirSync(node.dirAbs, { withFileTypes: true });
    } catch (err) {
      console.warn('[z21/project-dev-tools] readdirSync skipped:', err.message);
      continue;
    }

    items.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const item of items) {
      if (entries.length >= maxEntries) break;
      const name = item.name;
      if (isSensitiveSegmentOrName(name)) continue;
      if (!includeHidden && name.startsWith('.')) continue;

      const childAbs = path.join(node.dirAbs, name);
      let realChild;
      try {
        realChild = fs.realpathSync(childAbs);
      } catch (err) {
        console.warn('[z21/project-dev-tools] realpath child skipped:', err.message);
        continue;
      }
      if (!isChildEntryAccessible(realChild, target)) continue;

      const relPath = (node.relBase === '.' ? name : `${node.relBase}/${name}`).replace(/\\/g, '/');
      let st = null;
      try {
        st = fs.statSync(realChild);
      } catch (err) {
        console.warn('[z21/project-dev-tools] statSync skipped:', err.message);
      }
      const mtimeMs = st ? Math.round(st.mtimeMs) : 0;
      const modified = st ? new Date(st.mtimeMs).toISOString().slice(0, 16).replace('T', ' ') : '';

      const isDir = st ? st.isDirectory() : item.isDirectory();
      if (isDir) {
        let childCount = 0;
        try {
          const subItems = fs.readdirSync(realChild);
          childCount = subItems.filter(n => !isSensitiveSegmentOrName(n) && (includeHidden || !n.startsWith('.'))).length;
        } catch (_) {}
        entries.push({ path: relPath, type: 'dir', size: 0, child_count: childCount, mtimeMs, modified });
        if (node.depth < maxDepth && name !== 'node_modules') {
          queue.push({ dirAbs: realChild, relBase: relPath, depth: node.depth + 1 });
        }
      } else {
        entries.push({ path: relPath, type: 'file', size: st ? st.size : 0, mtimeMs, modified });
      }
    }
  }

  if (sortBy === 'modified') {
    entries.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  } else if (sortBy === 'size') {
    entries.sort((a, b) => (b.size || 0) - (a.size || 0));
  }

  return {
    ok: true,
    path: target.relativePath,
    abs_path: target.absPath,
    outside_workspace: Boolean(target.outsideWorkspace),
    depth: maxDepth,
    sort_by: sortBy,
    count: entries.length,
    truncated: entries.length >= maxEntries,
    entries,
    project_jail: true
  };
}

function buildClosestTargetContextHint(rawContent, searchTarget, relPath = '') {
  const lines = String(rawContent || '').replace(/\r\n/g, '\n').split('\n');
  const sLines = String(searchTarget || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 3);
  if (sLines.length === 0 || lines.length === 0) return '';

  const tokenSet = new Set();
  for (const sl of sLines) {
    const tokens = sl.toLowerCase().match(/[a-z0-9_.-]{3,}/g) || [];
    for (const tok of tokens) tokenSet.add(tok);
  }
  const probeTokens = Array.from(tokenSet);
  const firstTrimmed = sLines[0].toLowerCase();

  let bestScore = 0;
  let bestIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    if (!lineLower.trim()) continue;
    let score = 0;
    if (firstTrimmed && lineLower.includes(firstTrimmed)) {
      score += 10;
    }
    for (const sl of sLines) {
      if (sl.length >= 6 && lineLower.includes(sl.toLowerCase())) {
        score += 5;
      }
    }
    for (const tok of probeTokens) {
      if (lineLower.includes(tok)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  if (bestScore <= 0 || bestIdx < 0) return '';

  const start = Math.max(0, bestIdx - 5);
  const end = Math.min(lines.length - 1, bestIdx + 8);
  const formatted = [];
  for (let i = start; i <= end; i++) {
    formatted.push(`${i + 1}: ${lines[i]}`);
  }
  const snippet = formatted.join('\n').slice(0, 1200);
  return `\n[Konteks baris terdekat di ${relPath || 'file'} (salin ISI kode TANPA awalan angka "<baris>: ")]:\n${snippet}`;
}

function stripAccidentalLineNumberPrefixes(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length === 0) return text;
  const linePrefixRe = /^[ \t]*(?:L?\d+[ \t]*(?:→|\||:)[ \t]?)/;
  const strongSingleRe = /^[ \t]*(?:L\d+:[ \t]?|\d+[ \t]*(?:→|\|)[ \t]?|\d+:[ \t])/;
  const matchedCount = nonEmpty.filter(l => linePrefixRe.test(l)).length;
  const shouldStrip = nonEmpty.length >= 2
    ? (matchedCount / nonEmpty.length >= 0.6)
    : strongSingleRe.test(nonEmpty[0]);
  if (!shouldStrip) return text;
  return lines.map(l => l.replace(linePrefixRe, '')).join('\n');
}

function computeMatchLineNumbers(normRaw, needle) {
  const out = [];
  let idx = 0;
  while (idx <= normRaw.length) {
    const pos = normRaw.indexOf(needle, idx);
    if (pos === -1) break;
    const lineNum = normRaw.slice(0, pos).split('\n').length;
    out.push(lineNum);
    idx = pos + Math.max(1, needle.length);
  }
  return out;
}

function applySingleResilientEdit(normRaw, hunk, relPath) {
  const rawT = hunk.target ?? hunk.old_string ?? hunk.old_str ?? hunk.old_text ?? hunk.oldText ?? hunk.search ?? hunk.Target;
  const rawR = hunk.replacement ?? hunk.new_string ?? hunk.new_str ?? hunk.new_text ?? hunk.newText ?? hunk.replace ?? hunk.Replacement;
  const searchTarget = rawT === undefined || rawT === null ? '' : String(rawT);
  const replacement = rawR === undefined || rawR === null ? '' : String(rawR);
  const replaceAll = Boolean(hunk.replace_all ?? hunk.replaceAll);
  const startLineHint = Number(hunk.start_line ?? hunk.startLine) || 0;
  const endLineHint = Number(hunk.end_line ?? hunk.endLine) || 0;

  if (LAZY_ELISION_PLACEHOLDER_RE.test(replacement) && (!searchTarget || !LAZY_ELISION_PLACEHOLDER_RE.test(searchTarget))) {
    throw new Error(`LAZY_PLACEHOLDER_BLOCKED: \`replacement\` pada ${relPath} mengandung komentar pemotong ("... existing code ..."). Tulis hanya baris perubahan nyata.`);
  }
  if (!searchTarget) {
    if (startLineHint >= 1 && endLineHint >= startLineHint && rawR !== undefined && rawR !== null) {
      const hadTrailingNlRange = normRaw.endsWith('\n');
      const bodyStrRange = hadTrailingNlRange ? normRaw.slice(0, -1) : normRaw;
      const allLinesRange = bodyStrRange === '' ? [] : bodyStrRange.split('\n');
      if (startLineHint > allLinesRange.length) {
        throw new Error(`TARGET_NOT_FOUND: start_line (${startLineHint}) melebihi jumlah baris berkas (${allLinesRange.length}) pada ${relPath}.`);
      }
      const clampedEnd = Math.min(allLinesRange.length, endLineHint);
      const span = clampedEnd - startLineHint + 1;
      if (span > 350) {
        throw new Error(`RANGE_TOO_LARGE: Rentang baris (${span}) melebihi batas 350 baris per edit pada ${relPath}; sertakan target unik atau pecah edit.`);
      }
      const normReplRange = replacement.replace(/\r\n/g, '\n');
      const existingSlice = allLinesRange.slice(startLineHint - 1, clampedEnd).join('\n');
      if (existingSlice === normReplRange) {
        throw new Error(`NO_CHANGE: Isi baris ${startLineHint}-${clampedEnd} pada ${relPath} sudah identik dengan replacement.`);
      }
      const replLines = normReplRange === '' ? [] : (normReplRange === '\n' ? [''] : normReplRange.split('\n'));
      allLinesRange.splice(startLineHint - 1, span, ...replLines);
      const nextStrRange = allLinesRange.join('\n') + (hadTrailingNlRange && allLinesRange.length > 0 ? '\n' : '');
      return { nextContent: nextStrRange, replacements: 1, matchStrategy: 'line_range', lastRepl: normReplRange };
    }
    throw new Error('EDIT_TARGET_EMPTY: Parameter `target` / `old_string` (atau `start_line` + `end_line` + `replacement`) wajib diisi.');
  }

  const normTarget = searchTarget.replace(/\r\n/g, '\n');
  const normRepl = replacement.replace(/\r\n/g, '\n');

  const tryExactInText = (haystack, needle, repl) => {
    const parts = haystack.split(needle);
    const occ = parts.length - 1;
    if (occ === 1 || (occ > 1 && replaceAll)) {
      return { ok: true, count: occ, content: parts.join(repl) };
    }
    return { ok: false, occ };
  };

  // Optional line-window scoping for disambiguation (exact slice first if padded window is ambiguous)
  if (startLineHint > 0) {
    const allLines = normRaw.split('\n');
    const strictEnd = Math.min(allLines.length, endLineHint > 0 ? endLineHint : startLineHint + normTarget.split('\n').length - 1);
    if (endLineHint >= startLineHint && startLineHint <= allLines.length) {
      const strictStartIdx = startLineHint - 1;
      const strictStr = allLines.slice(strictStartIdx, strictEnd).join('\n');
      const strictExact = tryExactInText(strictStr, normTarget, normRepl);
      if (strictExact.ok) {
        const strictInsert = strictExact.content === '' ? [] : [strictExact.content];
        const rebuiltStrict = [...allLines.slice(0, strictStartIdx), ...strictInsert, ...allLines.slice(strictEnd)].join('\n');
        return { nextContent: rebuiltStrict, replacements: strictExact.count, matchStrategy: 'window_exact', lastRepl: normRepl };
      }
    }
    const winStartIdx = Math.max(0, startLineHint - 6);
    const winEndIdx = Math.min(allLines.length, (endLineHint > 0 ? endLineHint : startLineHint + normTarget.split('\n').length) + 5);
    const winStr = allLines.slice(winStartIdx, winEndIdx).join('\n');
    const winExact = tryExactInText(winStr, normTarget, normRepl);
    if (winExact.ok) {
      const winInsert = winExact.content === '' ? [] : [winExact.content];
      const rebuilt = [...allLines.slice(0, winStartIdx), ...winInsert, ...allLines.slice(winEndIdx)].join('\n');
      return { nextContent: rebuilt, replacements: winExact.count, matchStrategy: 'window_exact', lastRepl: normRepl };
    }
  }

  // Pass 1: Strict exact match with uniqueness guard
  const exactRes = tryExactInText(normRaw, normTarget, normRepl);
  if (exactRes.ok) {
    return { nextContent: exactRes.content, replacements: exactRes.count, matchStrategy: 'exact', lastRepl: normRepl };
  }
  if (exactRes.occ > 1 && !replaceAll) {
    const matchLines = computeMatchLineNumbers(normRaw, normTarget);
    throw new Error(
      `AMBIGUOUS_TARGET: Teks target ditemukan ${exactRes.occ} kali di ${relPath} (baris ${matchLines.slice(0, 6).join(', ')}). Sertakan 2-4 baris konteks unik di sekitarnya, tentukan start_line/end_line, atau gunakan replace_all: true.`
    );
  }

  // Pass 2: Strip accidental line-number prefixes copied from read_file ("120: ...", "L120: ...", "120→...")
  const strippedTarget = stripAccidentalLineNumberPrefixes(normTarget);
  const strippedRepl = stripAccidentalLineNumberPrefixes(normRepl);
  if (strippedTarget !== normTarget && strippedTarget.trim()) {
    const p2Exact = tryExactInText(normRaw, strippedTarget, strippedRepl);
    if (p2Exact.ok) {
      return { nextContent: p2Exact.content, replacements: p2Exact.count, matchStrategy: 'line_prefix_stripped', lastRepl: strippedRepl };
    }
    if (p2Exact.occ > 1 && !replaceAll) {
      const matchLines = computeMatchLineNumbers(normRaw, strippedTarget);
      throw new Error(
        `AMBIGUOUS_TARGET: Teks target (setelah melepas awalan nomor baris) ditemukan ${p2Exact.occ} kali di ${relPath} (baris ${matchLines.slice(0, 6).join(', ')}). Sertakan lebih banyak konteks unik atau gunakan replace_all: true.`
      );
    }
  }

  // Pass 3: Horizontal-whitespace & indentation-normalized unique block match with real-indent preservation
  const activeTarget = (strippedTarget !== normTarget && strippedTarget.trim()) ? strippedTarget : normTarget;
  const activeRepl = (strippedTarget !== normTarget && strippedTarget.trim()) ? strippedRepl : normRepl;
  const fileLines = normRaw.split('\n');
  let tLines = activeTarget.split('\n');
  while (tLines.length > 1 && tLines[0].trim() === '') tLines.shift();
  while (tLines.length > 1 && tLines[tLines.length - 1].trim() === '') tLines.pop();

  if (tLines.length >= 1 && tLines.some(l => l.trim().length >= 2)) {
    const canon = (s) => s.trim().replace(/[ \t]+/g, ' ');
    const canonTargets = tLines.map(canon);
    const matches = [];
    for (let i = 0; i <= fileLines.length - tLines.length; i++) {
      let allMatch = true;
      for (let k = 0; k < tLines.length; k++) {
        if (canon(fileLines[i + k]) !== canonTargets[k]) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) matches.push(i);
    }

    if (matches.length > 1 && !replaceAll) {
      throw new Error(
        `AMBIGUOUS_TARGET: Pola target ditemukan ${matches.length} kali di ${relPath} (baris ${matches.slice(0, 6).map(idx => idx + 1).join(', ')}). Sertakan 2-4 baris konteks unik di sekitarnya atau gunakan replace_all: true.`
      );
    }
    if (matches.length === 1 || (matches.length > 1 && replaceAll)) {
      const nextFileLines = [...fileLines];
      let firstNonEmptyIdx = tLines.findIndex(l => l.trim().length > 0);
      if (firstNonEmptyIdx < 0) firstNonEmptyIdx = 0;
      const targetIndent = (tLines[firstNonEmptyIdx].match(/^[ \t]*/) || [''])[0];
      const rawReplLines = activeRepl === '' ? [] : (activeRepl === '\n' ? [''] : activeRepl.split('\n'));
      let lastAppliedRepl = activeRepl;

      for (let m = matches.length - 1; m >= 0; m--) {
        const mIdx = matches[m];
        const fileIndent = (fileLines[mIdx + firstNonEmptyIdx].match(/^[ \t]*/) || [''])[0];
        const adjustedReplLines = rawReplLines.map((rl) => {
          if (!rl.trim()) return rl;
          if (targetIndent && rl.startsWith(targetIndent)) {
            return fileIndent + rl.slice(targetIndent.length);
          }
          if (!targetIndent && fileIndent) {
            return fileIndent + rl;
          }
          return rl;
        });
        lastAppliedRepl = adjustedReplLines.join('\n');
        nextFileLines.splice(mIdx, tLines.length, ...adjustedReplLines);
      }
      return {
        nextContent: nextFileLines.join('\n'),
        replacements: matches.length,
        matchStrategy: 'indent_normalized',
        lastRepl: lastAppliedRepl
      };
    }
  }

  // Pass 4: Fail loudly with line-numbered closest context for self-healing retry
  const hint = buildClosestTargetContextHint(normRaw, activeTarget, relPath);
  throw new Error(
    `TARGET_NOT_FOUND: Teks target tidak ditemukan di ${relPath}. Panggil read_file terlebih dahulu${hint ? ' atau salin baris persis dari konteks berikut (TANPA awalan angka baris):' + hint : '.'}\nGunakan target persis dari baris tersebut lalu ulangi edit_file; JANGAN menimpa seluruh file dengan write_file.`
  );
}

function stripCssStringsAndComments(cssStr) {
  return String(cssStr || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, '""');
}

function buildPostMutationDiagnostics(relPath, content) {
  const warnings = [];
  const ext = path.extname(String(relPath || '')).toLowerCase();
  const text = String(content || '');
  if (ext === '.html' || ext === '.htm') {
    const outerText = text
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '<script></script>')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '<style></style>');
    const openStyle = (outerText.match(/<style\b[^>]*>/gi) || []).length;
    const closeStyle = (outerText.match(/<\/style\s*>/gi) || []).length;
    if (openStyle !== closeStyle) {
      warnings.push(`Tag <style> tidak seimbang (${openStyle} pembuka vs ${closeStyle} penutup).`);
    }
    const openScript = (outerText.match(/<script\b[^>]*>/gi) || []).length;
    const closeScript = (outerText.match(/<\/script\s*>/gi) || []).length;
    if (openScript !== closeScript) {
      warnings.push(`Tag <script> tidak seimbang (${openScript} pembuka vs ${closeScript} penutup).`);
    }
    if (/<html\b/i.test(text) && !/<\/html\s*>/i.test(text)) {
      warnings.push('Tag penutup </html> hilang (kemungkinan file terpotong).');
    }
    const trailingAfterHtml = text.match(/<\/html\s*>([\s\S]+)$/i);
    if (trailingAfterHtml && trailingAfterHtml[1].replace(/<!--[\s\S]*?-->/g, '').trim()) {
      warnings.push(`Ditemukan karakter/markup nyasar setelah tag penutup </html>: ${trailingAfterHtml[1].trim().slice(0, 40)}`);
    }
    const styleBlocks = text.match(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi) || [];
    for (let idx = 0; idx < styleBlocks.length; idx++) {
      const cssBody = stripCssStringsAndComments(
        styleBlocks[idx].replace(/^<style\b[^>]*>|<\/style\s*>$/gi, '')
      );
      let braceDelta = 0;
      for (const ch of cssBody) {
        if (ch === '{') braceDelta++;
        else if (ch === '}') braceDelta--;
      }
      if (braceDelta !== 0) {
        warnings.push(`Kurung kurawal CSS di dalam <style> blok #${idx + 1} tidak seimbang (selisih: ${braceDelta > 0 ? '+' + braceDelta : braceDelta}).`);
      }
    }
  } else if (ext === '.css') {
    const cleanCss = stripCssStringsAndComments(text);
    let braceDelta = 0;
    for (const ch of cleanCss) {
      if (ch === '{') braceDelta++;
      else if (ch === '}') braceDelta--;
    }
    if (braceDelta !== 0) {
      warnings.push(`Kurung kurawal CSS pada ${relPath} tidak seimbang (selisih: ${braceDelta > 0 ? '+' + braceDelta : braceDelta}).`);
    }
  } else if (ext === '.json') {
    try {
      JSON.parse(text);
    } catch (jsonErr) {
      warnings.push(`Sintaks JSON tidak valid: ${jsonErr.message}`);
    }
  }
  return {
    ok: warnings.length === 0,
    warnings
  };
}

function parseMaybeJsonEditsArray(rawEdits) {
  if (Array.isArray(rawEdits)) return rawEdits;
  if (typeof rawEdits === 'string') {
    try {
      const parsed = JSON.parse(rawEdits);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {}
  }
  return [];
}

function buildZ21EditFileOptions(baseOpts = {}, args = {}) {
  const parsedEdits = parseMaybeJsonEditsArray(args.edits);
  return {
    ...baseOpts,
    path: args.path || args.file_path || args.filePath || args.Path || args.file || '',
    target: args.target ?? args.old_string ?? args.old_str ?? args.old_text ?? args.oldText ?? args.search ?? args.Target ?? args.oldString,
    replacement: args.replacement ?? args.new_string ?? args.new_str ?? args.new_text ?? args.newText ?? args.replace ?? args.Replacement ?? args.newString,
    replace_all: args.replace_all ?? args.replaceAll,
    start_line: args.start_line ?? args.startLine,
    end_line: args.end_line ?? args.endLine,
    edits: parsedEdits.length > 0 ? parsedEdits : undefined
  };
}

function editProjectFile(options = {}) {
  const rawPath = options.path || options.file_path || options.filePath || options.Path || options.file || '';
  const targetObj = resolveProjectJailedPath(rawPath, options.projectRoot, {
    ...options,
    allowRoot: false,
    mustExist: true,
    expectDir: false,
    operation: 'write',
    returnApprovalObject: Boolean(options.permissionPreset || options.allowOutsideApproval)
  });
  if (targetObj.requiresApproval) {
    return buildFileApprovalResponse('edit_file', targetObj);
  }
  const coercedEdits = parseMaybeJsonEditsArray(options.edits);
  let editsArray = coercedEdits.length > 0
    ? [...coercedEdits]
    : [{
        target: options.target ?? options.old_string ?? options.old_str ?? options.old_text ?? options.oldText ?? options.search ?? options.Target ?? options.oldString,
        replacement: options.replacement ?? options.new_string ?? options.new_str ?? options.new_text ?? options.newText ?? options.replace ?? options.Replacement ?? options.newString,
        replace_all: options.replace_all ?? options.replaceAll,
        start_line: options.start_line ?? options.startLine,
        end_line: options.end_line ?? options.endLine
      }];

  // Jika seluruh hunk pada array edits memakai mode line_range murni (tanpa target),
  // validasi tumpang tindih dan urutkan dari baris terbawah ke atas agar offset baris atas tetap stabil.
  const isPureLineRangeHunk = (h) => {
    if (!h || typeof h !== 'object') return false;
    const t = h.target ?? h.old_string ?? h.old_str ?? h.old_text ?? h.oldText ?? h.search ?? h.Target ?? h.oldString;
    const sl = Number(h.start_line ?? h.startLine) || 0;
    const el = Number(h.end_line ?? h.endLine) || 0;
    return (t === undefined || t === null || String(t) === '') && sl >= 1 && el >= sl;
  };
  if (editsArray.length > 1 && editsArray.every(isPureLineRangeHunk)) {
    const sorted = [...editsArray].sort((a, b) => Number(b.start_line ?? b.startLine) - Number(a.start_line ?? a.startLine));
    for (let i = 0; i < sorted.length - 1; i++) {
      const upper = sorted[i + 1];
      const lower = sorted[i];
      if (Number(upper.end_line ?? upper.endLine) >= Number(lower.start_line ?? lower.startLine)) {
        throw new Error('AMBIGUOUS_TARGET: Rentang baris pada array edits saling tumpang tindih.');
      }
    }
    editsArray = sorted;
  }

  const stat = fs.statSync(targetObj.absPath);
  if (stat.size > 1024 * 1024) {
    throw new Error(`FILE_TOO_LARGE: Berkas (${stat.size} bytes) melebihi batas edit 1 MB.`);
  }
  const raw = fs.readFileSync(targetObj.absPath, 'utf8');
  const usesCrlf = raw.includes('\r\n');
  let workingNorm = raw.replace(/\r\n/g, '\n');
  let totalReplacements = 0;
  let lastStrategy = 'exact';
  let lastReplStr = '';

  for (const hunk of editsArray) {
    if (!hunk || typeof hunk !== 'object') {
      throw new Error('EDIT_TARGET_EMPTY: Setiap entri edits wajib berupa objek { target, replacement }.');
    }
    const step = applySingleResilientEdit(workingNorm, hunk, targetObj.absPath || targetObj.relativePath);
    workingNorm = step.nextContent;
    totalReplacements += step.replacements;
    lastStrategy = step.matchStrategy || lastStrategy;
    lastReplStr = step.lastRepl || '';
  }

  let nextContent = workingNorm;
  if (usesCrlf) {
    nextContent = nextContent.replace(/\n/g, '\r\n');
  }

  fs.writeFileSync(targetObj.absPath, nextContent, 'utf8');
  const nextStat = fs.statSync(targetObj.absPath);
  const normNext = workingNorm;
  const replIdx = lastReplStr ? normNext.indexOf(lastReplStr) : -1;
  const verifiedPreview = replIdx >= 0
    ? normNext.slice(Math.max(0, replIdx - 120), Math.min(normNext.length, replIdx + lastReplStr.length + 120)).slice(0, 420)
    : normNext.slice(0, 420);
  const diagnostics = buildPostMutationDiagnostics(targetObj.relativePath, normNext);
  return {
    ok: true,
    path: targetObj.relativePath,
    abs_path: targetObj.absPath,
    outside_workspace: Boolean(targetObj.outsideWorkspace),
    replacements: totalReplacements,
    edits_applied: editsArray.length,
    match_strategy: lastStrategy,
    bytes_before: stat.size,
    bytes: nextStat.size,
    total_lines: normNext.split('\n').length,
    verified_preview: verifiedPreview,
    diagnostics,
    project_jail: true
  };
}

function globToRegex(globStr) {
  const clean = String(globStr || '').trim();
  if (!clean) return null;
  const escaped = clean
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`(?:^|/)${escaped}$`, 'i');
}

function grepProjectSearch(options = {}) {
  const queryRaw = options.query === undefined || options.query === null ? '' : String(options.query);
  if (!queryRaw) {
    throw new Error('GREP_QUERY_EMPTY: Parameter `query` wajib diisi.');
  }
  const targetObj = resolveProjectJailedPath(options.path || '.', options.projectRoot, {
    ...options,
    allowRoot: true,
    mustExist: true,
    expectDir: false,
    operation: 'read',
    returnApprovalObject: Boolean(options.permissionPreset || options.allowOutsideApproval)
  });
  if (targetObj.requiresApproval) {
    return buildFileApprovalResponse('grep_search', targetObj);
  }
  const isRegex = Boolean(options.is_regex ?? options.isRegex);
  const caseSensitive = Boolean(options.case_sensitive ?? options.caseSensitive);
  const maxResults = Math.min(100, Math.max(1, Math.floor(Number(options.max_results) || 40)));
  const rawCtx = options.context_lines ?? options.contextLines ?? options.context;
  let contextLines = 0;
  if (rawCtx !== undefined && rawCtx !== null && String(rawCtx).trim() !== '') {
    const parsedCtx = Number(rawCtx);
    if (Number.isFinite(parsedCtx)) {
      contextLines = Math.min(15, Math.max(0, Math.floor(parsedCtx)));
    }
  }
  const globRe = globToRegex(options.include_glob);

  let matcherRe = null;
  if (isRegex) {
    if (queryRaw.length > 256 || /(?:[+*]|\{\d+,\})\s*\)[+*?]/.test(queryRaw)) {
      throw new Error(`INVALID_REGEX: Pola regex "${queryRaw.slice(0, 60)}" terlalu panjang atau berisiko ReDoS.`);
    }
    try {
      matcherRe = new RegExp(queryRaw, caseSensitive ? '' : 'i');
    } catch (rxErr) {
      throw new Error(`INVALID_REGEX: Pola regex "${queryRaw}" tidak valid (${rxErr.message}).`);
    }
  }
  const needleLower = caseSensitive ? queryRaw : queryRaw.toLowerCase();
  const matches = [];
  let scannedFiles = 0;

  function scanFile(absFile, relFile) {
    if (matches.length >= maxResults || scannedFiles >= 600) return;
    if (globRe && !globRe.test(relFile) && !globRe.test(path.basename(relFile))) return;
    let stat;
    try {
      stat = fs.statSync(absFile);
    } catch (err) {
      console.warn('[z21/project-dev-tools] grep stat skipped:', err.message);
      return;
    }
    if (!stat.isFile() || stat.size > 1024 * 1024) return;
    scannedFiles++;
    let content;
    try {
      const rawBuf = fs.readFileSync(absFile);
      if (rawBuf.subarray(0, Math.min(8192, rawBuf.length)).includes(0)) return;
      content = rawBuf.toString('utf8');
    } catch (err) {
      console.warn('[z21/project-dev-tools] grep read skipped:', err.message);
      return;
    }
    const lines = content.replace(/\r\n?/g, '\n').split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
      if (matches.length >= maxResults) break;
      const lineStr = lines[idx];
      const matched = matcherRe
        ? matcherRe.test(lineStr)
        : (caseSensitive ? lineStr.includes(queryRaw) : lineStr.toLowerCase().includes(needleLower));
      if (matched) {
        const hit = {
          path: relFile,
          line: idx + 1,
          text: lineStr.length > 260 ? lineStr.slice(0, 257) + '...' : lineStr
        };
        if (contextLines > 0) {
          const bStart = Math.max(0, idx - contextLines);
          const aEnd = Math.min(lines.length - 1, idx + contextLines);
          hit.context_before = [];
          for (let j = bStart; j < idx; j++) {
            hit.context_before.push({ line: j + 1, text: lines[j].length > 220 ? lines[j].slice(0, 217) + '...' : lines[j] });
          }
          hit.context_after = [];
          for (let j = idx + 1; j <= aEnd; j++) {
            hit.context_after.push({ line: j + 1, text: lines[j].length > 220 ? lines[j].slice(0, 217) + '...' : lines[j] });
          }
        }
        matches.push(hit);
      }
    }
  }

  function walkGrep(dirAbs, relBase) {
    if (matches.length >= maxResults || scannedFiles >= 600) return;
    let items = [];
    try {
      items = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch (err) {
      console.warn('[z21/project-dev-tools] grep readdir skipped:', err.message);
      return;
    }
    for (const item of items) {
      if (matches.length >= maxResults || scannedFiles >= 600) break;
      const name = item.name;
      if (isSensitiveSegmentOrName(name) || name === 'node_modules') continue;
      const childAbs = path.join(dirAbs, name);
      let realChild;
      try {
        realChild = fs.realpathSync(childAbs);
      } catch (err) {
        console.warn('[z21/project-dev-tools] grep realpath skipped:', err.message);
        continue;
      }
      if (!isChildEntryAccessible(realChild, targetObj)) continue;
      const relPath = (relBase === '.' ? name : `${relBase}/${name}`).replace(/\\/g, '/');
      let st = null;
      try {
        st = fs.statSync(realChild);
      } catch (_) {}
      const isDir = st ? st.isDirectory() : item.isDirectory();
      const isFile = st ? st.isFile() : item.isFile();
      if (isDir) {
        walkGrep(realChild, relPath);
      } else if (isFile) {
        scanFile(realChild, relPath);
      }
    }
  }

  const rootStat = fs.statSync(targetObj.absPath);
  if (rootStat.isDirectory()) {
    const walkRelInit = targetObj.insidePrimaryRoot ? targetObj.relativePath : '.';
    walkGrep(targetObj.absPath, walkRelInit);
  } else {
    scanFile(targetObj.absPath, targetObj.relativePath);
  }

  return {
    ok: true,
    query: queryRaw,
    path: targetObj.relativePath,
    abs_path: targetObj.absPath,
    outside_workspace: Boolean(targetObj.outsideWorkspace),
    scanned_files: scannedFiles,
    count: matches.length,
    truncated: matches.length >= maxResults || scannedFiles >= 600,
    matches,
    project_jail: true
  };
}

function promptTerminalConfirmation(command, cwd) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(
      `\n[Z21 HITL Guard] Jalankan perintah berikut di "${cwd}"?\n  > ${command}\nIzinkan? (Y/N): `,
      (answer) => {
        rl.close();
        const norm = String(answer || '').trim().toLowerCase();
        resolve(norm === 'y' || norm === 'yes');
      }
    );
  });
}

async function runZ21ProjectAgentLoop(options = {}) {
  if (typeof options.callLlm !== 'function') {
    throw new Error('AGENT_LOOP_ERROR: callLlm(payload) function wajib disediakan.');
  }
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const maxTurns = Math.min(24, Math.max(1, Number(options.maxTurns) || 10));
  const sandboxMode = String(options.sandboxMode || 'host').toLowerCase();
  const allowlistPrefixes = Array.isArray(options.allowlistPrefixes) ? options.allowlistPrefixes : [];
  const sharedToolOpts = {
    projectRoot,
    enableUserHome: options.enableUserHome,
    userHome: options.userHome,
    trustedRoots: options.trustedRoots,
    grantedRoots: options.grantedRoots,
    permissionPreset: options.permissionPreset,
    allowOutsideApproval: options.allowOutsideApproval,
    nonWorkspacePolicy: options.nonWorkspacePolicy
  };
  const messages = Array.isArray(options.messages) ? options.messages.map((m) => ({ ...m })) : [];
  const trace = [];

  for (let turn = 1; turn <= maxTurns; turn++) {
    const llmReply = await options.callLlm({
      turn,
      messages,
      tools: Z21_PROJECT_TOOL_SCHEMAS
    });

    const toolCalls = Array.isArray(llmReply && llmReply.tool_calls) ? llmReply.tool_calls : [];
    const assistantMsg = {
      role: 'assistant',
      content: String((llmReply && llmReply.content) || '')
    };
    if (toolCalls.length > 0) {
      assistantMsg.tool_calls = toolCalls;
    }
    messages.push(assistantMsg);

    if (toolCalls.length === 0) {
      return {
        ok: true,
        turns: turn,
        content: assistantMsg.content,
        messages,
        trace
      };
    }

    for (const tc of toolCalls) {
      const fnName = String((tc.function && tc.function.name) || tc.name || '').trim();
      const rawArgs = tc.function ? tc.function.arguments : tc.arguments;
      let args = {};
      if (typeof rawArgs === 'string') {
        try {
          args = JSON.parse(rawArgs || '{}');
        } catch (err) {
          args = { _parse_error: err.message };
        }
      } else if (rawArgs && typeof rawArgs === 'object') {
        args = rawArgs;
      }

      let result;
      try {
        if (fnName === 'run_command') {
          let cmdResult = await runProjectCommand({
            ...sharedToolOpts,
            command: args.command || args.CommandLine || args.cmd,
            cwd: args.cwd || args.Cwd || '.',
            shell: args.shell || 'auto',
            timeoutMs: args.timeout_ms ?? args.timeoutMs,
            waitMsBeforeAsync: args.wait_ms_before_async ?? args.waitMsBeforeAsync ?? args.WaitMsBeforeAsync,
            isDaemon: Boolean(args.is_daemon ?? args.isDaemon ?? args.IsDaemon),
            sandboxMode: args.sandbox_mode || sandboxMode,
            allowlistPrefixes,
            approved: Boolean(args.approved)
          });

          if (cmdResult && cmdResult.requires_approval) {
            let userApproved = false;
            if (typeof options.onConfirmCommand === 'function') {
              userApproved = Boolean(await options.onConfirmCommand(cmdResult));
            } else if (options.cliPrompt) {
              userApproved = await promptTerminalConfirmation(cmdResult.command, cmdResult.cwd);
            }

            if (userApproved) {
              cmdResult = await runProjectCommand({
                ...sharedToolOpts,
                command: args.command || args.CommandLine || args.cmd,
                cwd: args.cwd || args.Cwd || '.',
                shell: args.shell || 'auto',
                timeoutMs: args.timeout_ms ?? args.timeoutMs,
                waitMsBeforeAsync: args.wait_ms_before_async ?? args.waitMsBeforeAsync ?? args.WaitMsBeforeAsync,
                isDaemon: Boolean(args.is_daemon ?? args.isDaemon ?? args.IsDaemon),
                sandboxMode: args.sandbox_mode || sandboxMode,
                allowlistPrefixes,
                approved: true
              });
            } else {
              cmdResult = {
                ok: false,
                rejected_by_user: true,
                exit_code: -1,
                command: cmdResult.command,
                cwd: cmdResult.cwd,
                stderr: 'Perintah ditolak oleh pengguna (Human-in-the-Loop N).'
              };
            }
          }
          result = cmdResult;
        } else if (fnName === 'manage_task') {
          result = await manageBackgroundTask({
            action: args.action,
            taskId: args.task_id || args.taskId,
            input: args.input,
            waitMs: args.wait_ms ?? args.waitMs,
            appendNewline: args.append_newline ?? args.appendNewline
          });
        } else if (fnName === 'read_file') {
          result = readProjectFile({
            ...sharedToolOpts,
            path: args.path || args.file_path || args.filePath || args.Path || args.file,
            start_line: args.start_line ?? args.startLine ?? args.offset,
            end_line: args.end_line ?? args.endLine,
            limit: args.limit
          });
        } else if (fnName === 'select_lines') {
          result = selectProjectFileLines({
            ...sharedToolOpts,
            path: args.path || args.file_path || args.filePath || args.filepath || args.target_file || args.Path || args.file,
            ranges: args.ranges ?? args.line_ranges ?? args.lines,
            start_line: args.start_line ?? args.startLine ?? args.offset,
            end_line: args.end_line ?? args.endLine,
            limit: args.limit,
            around_line: args.around_line ?? args.aroundLine ?? args.line,
            context_lines: args.context_lines ?? args.contextLines ?? args.context,
            query: args.query ?? args.pattern,
            symbol: args.symbol ?? args.section,
            keywords: args.keywords,
            outline: args.outline,
            is_regex: args.is_regex ?? args.isRegex,
            case_sensitive: args.case_sensitive ?? args.caseSensitive,
            max_matches: args.max_matches ?? args.maxMatches
          });
        } else if (fnName === 'write_file') {
          result = writeProjectFile({ ...sharedToolOpts, path: args.path || args.file_path || args.filePath, content: args.content, mode: args.mode });
        } else if (fnName === 'list_dir') {
          result = listProjectDir({ ...sharedToolOpts, path: args.path || '.', depth: args.depth, sort_by: args.sort_by, include_hidden: args.include_hidden });
        } else if (fnName === 'edit_file') {
          result = editProjectFile(buildZ21EditFileOptions(sharedToolOpts, args));
        } else if (fnName === 'grep_search') {
          result = grepProjectSearch({ ...sharedToolOpts, query: args.query, path: args.path || '.', is_regex: args.is_regex ?? args.isRegex, case_sensitive: args.case_sensitive ?? args.caseSensitive, include_glob: args.include_glob, max_results: args.max_results, context_lines: args.context_lines ?? args.contextLines ?? args.context });
        } else {
          result = { ok: false, error: `UNKNOWN_TOOL: Tool "${fnName}" tidak terdaftar di Z21.` };
        }
        if (result && result.requires_approval && typeof options.onConfirmCommand === 'function') {
          const confirmedOutside = await options.onConfirmCommand({
            command: `${fnName}: ${args.path || args.file_path || '.'}`,
            cwd: result.abs_path || result.path || sharedToolOpts.projectRoot,
            reason: result.reason,
            whitelisted: false
          });
          if (confirmedOutside) {
            const approvedToolOpts = { ...sharedToolOpts, approved: true, approvedOutsideWorkspace: true };
            if (fnName === 'read_file') result = readProjectFile({ ...approvedToolOpts, path: args.path || args.file_path || args.filePath || args.Path || args.file, start_line: args.start_line ?? args.startLine ?? args.offset, end_line: args.end_line ?? args.endLine, limit: args.limit });
            else if (fnName === 'select_lines') result = selectProjectFileLines({ ...approvedToolOpts, path: args.path || args.file_path || args.filePath || args.filepath || args.target_file || args.Path || args.file, ranges: args.ranges ?? args.line_ranges ?? args.lines, start_line: args.start_line ?? args.startLine ?? args.offset, end_line: args.end_line ?? args.endLine, limit: args.limit, around_line: args.around_line ?? args.aroundLine ?? args.line, context_lines: args.context_lines ?? args.contextLines ?? args.context, query: args.query ?? args.pattern, symbol: args.symbol ?? args.section, keywords: args.keywords, outline: args.outline, is_regex: args.is_regex ?? args.isRegex, case_sensitive: args.case_sensitive ?? args.caseSensitive, max_matches: args.max_matches ?? args.maxMatches });
            else if (fnName === 'write_file') result = writeProjectFile({ ...approvedToolOpts, path: args.path || args.file_path || args.filePath, content: args.content, mode: args.mode });
            else if (fnName === 'list_dir') result = listProjectDir({ ...approvedToolOpts, path: args.path || '.', depth: args.depth, sort_by: args.sort_by, include_hidden: args.include_hidden });
            else if (fnName === 'edit_file') result = editProjectFile(buildZ21EditFileOptions(approvedToolOpts, args));
            else if (fnName === 'grep_search') result = grepProjectSearch({ ...approvedToolOpts, query: args.query, path: args.path || '.', is_regex: args.is_regex ?? args.isRegex, case_sensitive: args.case_sensitive ?? args.caseSensitive, include_glob: args.include_glob, max_results: args.max_results, context_lines: args.context_lines ?? args.contextLines ?? args.context });
          } else {
            result = { ok: false, rejected_by_user: true, error: `USER_REJECTED_OUTSIDE_WORKSPACE: Akses ${fnName} ditolak oleh pengguna.` };
          }
        }
      } catch (toolErr) {
        result = { ok: false, error: toolErr.message || String(toolErr) };
      }

      trace.push({ turn, tool: fnName, args, result });
      messages.push({
        role: 'tool',
        tool_call_id: tc.id || `call_${turn}_${trace.length}`,
        name: fnName,
        content: JSON.stringify(result)
      });
    }
  }

  return {
    ok: false,
    reason: 'max_turns_reached',
    turns: maxTurns,
    content: 'Batas iterasi agentic loop tercapai sebelum model menyelesaikan jawaban akhir.',
    messages,
    trace
  };
}

module.exports = {
  Z21_PROJECT_TOOL_SCHEMAS,
  DEFAULT_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_CHARS,
  resolveProjectRoot,
  isContainedInsideRealRoot,
  loadAntigravityTrustedWorkspaces,
  resolveZ21WorkspaceContext,
  expandUserPathInput,
  resolveExistingPathWithNormalizedSegments,
  resolveProjectJailedPath,
  validateProjectCommandJail,
  isWhitelistedSafeCommand,
  isAutoPresetSafeCommand,
  normalizePosixIdiomsForPowerShell,
  buildCommandErrorGuidance,
  manageBackgroundTask,
  probeSandboxCapabilities,
  buildContainerCommandSpec,
  smartTruncateCommandOutput,
  formatCommandOutputsWithErrorPreservation,
  runProjectCommand,
  readProjectFile,
  selectProjectFileLines,
  selectLinesFromContentCore,
  extractFileCodeOutline,
  writeProjectFile,
  editProjectFile,
  listProjectDir,
  grepProjectSearch,
  promptTerminalConfirmation,
  runZ21ProjectAgentLoop
};
