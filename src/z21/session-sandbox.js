'use strict';

/**
 * Z21 Localhost Session Sandbox Engine
 *
 * Isolates file reads/writes (`read_file`, `write_file`) and shell commands (`run_terminal`)
 * strictly inside `./sandbox_sessions/<chat_id>` for Mode Z21 running on localhost.
 *
 * Guardrails:
 *  - Timeout: 15-30s window (default 20s, hard ceiling 30s) with full process-tree kill
 *  - Workspace Jail: canonical realpath + traversal/symlink/device/drive blocking
 *  - Output Limit: max 5.000 characters returned to the LLM
 *  - Tool-Calling Loop: lightweight `while` loop executing tool calls until the LLM answers
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { extractFileCodeOutline, selectLinesFromContentCore } = require('./project-dev-tools');

const DEFAULT_TIMEOUT_MS = 20000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 30000;
const MAX_OUTPUT_CHARS = 5000;
const MAX_WRITE_BYTES = 2 * 1024 * 1024;
const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

const SANDBOX_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'run_terminal',
      description: 'KHUSUS LOCALHOST MODE Z21: Menjalankan perintah terminal di dalam folder sesi terisolasi ./sandbox_sessions/<chat_id> dan mengembalikan stdout, stderr, serta exit_code. Timeout otomatis maks 30 detik dan output dibatasi 5.000 karakter.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Perintah shell/CLI yang dijalankan di folder sesi (contoh: "python main.py", "node app.js", "ls -la").'
          },
          cwd: {
            type: 'string',
            description: 'Opsional: Sub-folder relatif di dalam sandbox sesi (default ".").'
          },
          timeout_ms: {
            type: 'integer',
            minimum: 1000,
            maximum: 30000,
            default: 20000,
            description: 'Batas waktu eksekusi dalam milidetik (default 20000ms / 20 detik, maks 30000ms / 30 detik).'
          }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'KHUSUS LOCALHOST MODE Z21: Membaca isi berkas secara langsung di dalam folder sandbox sesi ./sandbox_sessions/<chat_id> tanpa memakai cat di bash (anti masalah tanda kutip). Output dibatasi 5.000 karakter.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path berkas relatif di dalam folder sandbox sesi (contoh: "main.py", "src/helper.js").'
          },
          start_line: {
            type: 'integer',
            minimum: 1,
            description: 'Opsional: Baris awal (1-based).'
          },
          end_line: {
            type: 'integer',
            minimum: 1,
            description: 'Opsional: Baris akhir (1-based).'
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
      description: 'KHUSUS LOCALHOST MODE Z21: Memilih baris spesifik pada berkas di ./sandbox_sessions/<chat_id> berdasarkan ranges, around_line, query/symbol/keywords, atau outline:true tanpa memuat penuh berkas >5.000 karakter.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path berkas relatif di sandbox sesi.' },
          ranges: { type: 'array', items: { type: 'string' }, description: 'Opsional: Daftar rentang baris, mis. ["10-40"].' },
          around_line: { type: 'integer', minimum: 1, description: 'Opsional: Pusat baris (±context_lines).' },
          context_lines: { type: 'integer', minimum: 0, description: 'Opsional: Jumlah baris konteks.' },
          query: { type: 'string', description: 'Opsional: Kata kunci atau regex.' },
          symbol: { type: 'string', description: 'Opsional: Nama fungsi/simbol target.' },
          keywords: { type: 'array', items: { type: 'string' }, description: 'Opsional: Beberapa kata kunci.' },
          outline: { type: 'boolean', description: 'Opsional: Set true untuk peta struktur blok/baris.' },
          is_regex: { type: 'boolean', description: 'Opsional: Perlakukan query sebagai regex.' },
          case_sensitive: { type: 'boolean', description: 'Opsional: Peka huruf besar/kecil.' },
          max_matches: { type: 'integer', description: 'Opsional: Batas lokasi kecocokan (1-20).' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'KHUSUS LOCALHOST MODE Z21: Menulis atau menimpa berkas secara aman di dalam folder sandbox sesi ./sandbox_sessions/<chat_id> tanpa memakai echo/cat heredoc di bash (anti masalah tanda kutip).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path berkas relatif di dalam folder sandbox sesi (contoh: "main.py", "notes/todo.txt").'
          },
          content: {
            type: 'string',
            description: 'Isi teks lengkap yang akan ditulis ke berkas.'
          },
          append: {
            type: 'boolean',
            default: false,
            description: 'Opsional: Jika true, tambahkan ke akhir berkas alih-alih menimpa.'
          }
        },
        required: ['path', 'content']
      }
    }
  }
];

function createSandboxError(message, code = 'SANDBOX_ERROR', status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function getSandboxSessionsRoot(workspaceRoot = '') {
  if (process.env.ZOZ_SANDBOX_SESSIONS_DIR && String(process.env.ZOZ_SANDBOX_SESSIONS_DIR).trim()) {
    return path.resolve(String(process.env.ZOZ_SANDBOX_SESSIONS_DIR).trim());
  }
  const baseRoot = (workspaceRoot && fs.existsSync(workspaceRoot))
    ? workspaceRoot
    : path.resolve(__dirname, '..', '..');
  return path.join(baseRoot, 'sandbox_sessions');
}

function sanitizeSessionId(sessionId) {
  const raw = String(sessionId || '').trim();
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 96);
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return 'default_z21';
  }
  return cleaned;
}

function ensureSessionSandboxDir(sessionId, workspaceRoot = '') {
  const rootDir = getSandboxSessionsRoot(workspaceRoot);
  fs.mkdirSync(rootDir, { recursive: true });
  const realRootDir = fs.realpathSync(rootDir);
  const safeSessionId = sanitizeSessionId(sessionId);
  const sessionDirCandidate = path.join(realRootDir, safeSessionId);
  fs.mkdirSync(sessionDirCandidate, { recursive: true });
  const realSessionDir = fs.realpathSync(sessionDirCandidate);
  const rel = path.relative(realRootDir, realSessionDir);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw createSandboxError('Direktori sandbox sesi keluar dari batas sandbox_sessions.', 'SANDBOX_JAIL_VIOLATION', 403);
  }
  return {
    safeSessionId,
    rootDir: realRootDir,
    sessionDir: realSessionDir
  };
}

function isPathInsideDir(parentDir, childPath) {
  const rel = path.relative(parentDir, childPath);
  if (!rel) return true;
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function assertAncestorsInsideDir(realSessionDir, candidatePath) {
  let cursor = candidatePath;
  const maxSteps = 64;
  for (let i = 0; i < maxSteps; i++) {
    if (fs.existsSync(cursor)) {
      const realAncestor = fs.realpathSync(cursor);
      if (!isPathInsideDir(realSessionDir, realAncestor)) {
        throw createSandboxError(
          'Akses path ditolak: symlink/junction mengarah ke luar workspace sandbox sesi.',
          'SANDBOX_JAIL_VIOLATION',
          403
        );
      }
      return realAncestor;
    }
    const parent = path.dirname(cursor);
    if (!parent || parent === cursor) break;
    cursor = parent;
  }
  throw createSandboxError('Akses path ditolak: tidak ditemukan direktori induk valid dalam sandbox.', 'SANDBOX_JAIL_VIOLATION', 403);
}

function resolveJailedPath(realSessionDir, targetPath, options = {}) {
  const allowRoot = Boolean(options && options.allowRoot);
  const safeSessionId = path.basename(realSessionDir);
  if (typeof targetPath !== 'string' || targetPath.includes('\0')) {
    throw createSandboxError('Parameter path tidak valid.', 'SANDBOX_INVALID_PATH', 400);
  }
  let raw = targetPath.trim();
  if (!raw) {
    if (allowRoot) {
      return { fullPath: realSessionDir, relPath: '.' };
    }
    throw createSandboxError('Parameter path wajib diisi.', 'SANDBOX_INVALID_PATH', 400);
  }
  if (/^\\\\|^\/\//.test(raw)) {
    throw createSandboxError('Akses ditolak: UNC/network path tidak diizinkan dalam sandbox.', 'SANDBOX_JAIL_VIOLATION', 403);
  }

  // Izinkan AI menyebut prefiks "./sandbox_sessions/<sessionId>/..." dengan memotongnya aman ke relatif sesi
  const normalizedSlashes = raw.replace(/\\/g, '/');
  const sessionPrefixRe = new RegExp(`^(?:\\.?/)?sandbox_sessions/${safeSessionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/|$)`, 'i');
  if (sessionPrefixRe.test(normalizedSlashes)) {
    raw = normalizedSlashes.replace(sessionPrefixRe, '') || '.';
  }

  let candidate;
  if (path.isAbsolute(raw) || /^[a-zA-Z]:/.test(raw)) {
    // Izinkan hanya jika path absolut itu sendiri secara nyata berada di dalam realSessionDir
    candidate = path.resolve(raw);
    if (!isPathInsideDir(realSessionDir, candidate)) {
      throw createSandboxError(
        `Akses ditolak (Workspace Jail): path "${targetPath}" berada di luar sandbox sesi.`,
        'SANDBOX_JAIL_VIOLATION',
        403
      );
    }
  } else {
    if (/^[~]/.test(raw) || /^\/(?!$)/.test(raw)) {
      // Cegah /etc/passwd atau ~/... yang terlihat seperti path root absolut Unix pada Windows maupun POSIX
      const rootLikeCandidate = path.resolve(realSessionDir, raw.replace(/^\/+/, ''));
      if (raw.startsWith('~') || raw.startsWith('/etc/') || raw.startsWith('/var/') || raw.startsWith('/usr/') || raw.startsWith('/root/')) {
        throw createSandboxError(
          `Akses ditolak (Workspace Jail): path "${targetPath}" berada di luar sandbox sesi.`,
          'SANDBOX_JAIL_VIOLATION',
          403
        );
      }
      candidate = rootLikeCandidate;
    } else {
      candidate = path.resolve(realSessionDir, raw);
    }
  }

  const rel = path.relative(realSessionDir, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw createSandboxError(
      `Akses ditolak (Workspace Jail): path "${targetPath}" mencoba keluar dari direktori sesi.`,
      'SANDBOX_JAIL_VIOLATION',
      403
    );
  }
  if (!allowRoot && !rel) {
    throw createSandboxError('Path harus menunjuk ke berkas di dalam sandbox sesi, bukan folder root.', 'SANDBOX_INVALID_PATH', 400);
  }

  const segments = rel ? rel.split(/[\\/]+/).filter(Boolean) : [];
  for (const seg of segments) {
    const baseNoExt = seg.split('.')[0].toUpperCase();
    if (WINDOWS_RESERVED_NAMES.has(baseNoExt)) {
      throw createSandboxError(`Nama berkas "${seg}" tidak diizinkan (Windows reserved device).`, 'SANDBOX_JAIL_VIOLATION', 403);
    }
  }

  assertAncestorsInsideDir(realSessionDir, candidate);
  if (fs.existsSync(candidate)) {
    const lst = fs.lstatSync(candidate);
    if (lst.isSymbolicLink()) {
      const targetReal = fs.realpathSync(candidate);
      if (!isPathInsideDir(realSessionDir, targetReal)) {
        throw createSandboxError('Akses ditolak: symlink mengarah ke luar sandbox sesi.', 'SANDBOX_JAIL_VIOLATION', 403);
      }
    }
  }

  return {
    fullPath: candidate,
    relPath: rel ? rel.replace(/\\/g, '/') : '.'
  };
}

function validateJailedCommand(command, realSessionDir, activeCwd) {
  const cmd = String(command || '').trim();
  if (!cmd) {
    throw createSandboxError('Parameter command tidak boleh kosong.', 'SANDBOX_EMPTY_COMMAND', 400);
  }
  if (cmd.includes('\0')) {
    throw createSandboxError('Perintah mengandung karakter null yang tidak valid.', 'SANDBOX_JAIL_VIOLATION', 403);
  }

  // Deteksi path UNC atau traversal eksplisit yang keluar dari realSessionDir
  if (/\\\\[a-zA-Z0-9._-]+\\/.test(cmd)) {
    throw createSandboxError('Workspace Jail: akses UNC network share tidak diizinkan.', 'SANDBOX_JAIL_VIOLATION', 403);
  }
  if (/\b(?:mklink|New-Item\s+[^#\n]*-ItemType\s+(?:SymbolicLink|Junction)|ln\s+-s)\b/i.test(cmd)) {
    throw createSandboxError('Workspace Jail: pembuatan symlink/junction tidak diizinkan.', 'SANDBOX_JAIL_VIOLATION', 403);
  }
  if (/(?:^|[;&|]\s*)(?:cd|chdir)\.\./i.test(cmd)) {
    throw createSandboxError('Workspace Jail: perintah cd.. mencoba keluar dari sandbox sesi.', 'SANDBOX_JAIL_VIOLATION', 403);
  }
  if (/(?:^|[;&|]\s*)(?:cd|chdir|pushd|set-location|sl)\s+(?:\/d\s+)?(?:~|[\\/]{1,2}(?![a-zA-Z0-9_-]*sandbox_sessions)|\.\.(?:[\\/]|\s|$|;))/i.test(cmd)) {
    const dotMatch = cmd.match(/(?:cd|chdir|pushd|set-location|sl)\s+(?:\/d\s+)?([^\s;&|"']+)/i);
    const dest = dotMatch ? dotMatch[1] : '..';
    if (dest.startsWith('~') || dest.startsWith('/') || dest.startsWith('\\')) {
      throw createSandboxError(`Workspace Jail: perpindahan direktori "${dest}" keluar dari sandbox sesi diblokir.`, 'SANDBOX_JAIL_VIOLATION', 403);
    }
    const resolvedDest = path.resolve(activeCwd || realSessionDir, dest);
    if (!isPathInsideDir(realSessionDir, resolvedDest)) {
      throw createSandboxError(`Workspace Jail: perintah cd "${dest}" mencoba keluar dari sandbox sesi.`, 'SANDBOX_JAIL_VIOLATION', 403);
    }
  }

  // Periksa token traversal `..` pada argumen perintah (mis. `cat ../server.js` atau `type ..\package.json`)
  const traversalRe = /(?:^|[\s"'=,(])([a-zA-Z0-9_.\-\\/]*\.\.(?:[\\/][^\s"';&|),]*)?)/g;
  let m;
  while ((m = traversalRe.exec(cmd)) !== null) {
    const token = m[1];
    if (!token) continue;
    const candidate = path.resolve(activeCwd || realSessionDir, token);
    if (!isPathInsideDir(realSessionDir, candidate)) {
      throw createSandboxError(
        `Workspace Jail: referensi path "${token}" keluar dari direktori sandbox sesi.`,
        'SANDBOX_JAIL_VIOLATION',
        403
      );
    }
  }

  // Periksa path absolut drive Windows (C:\...) atau root Linux sensitif (/etc/, /Users/, /home/)
  const absWinRe = /(?:^|[\s"'=,(])([a-zA-Z]:[\\/][^\s"';&|),]*)/g;
  while ((m = absWinRe.exec(cmd)) !== null) {
    const winPath = path.resolve(m[1]);
    if (!isPathInsideDir(realSessionDir, winPath)) {
      throw createSandboxError(
        `Workspace Jail: akses path absolut "${m[1]}" di luar sandbox sesi diblokir.`,
        'SANDBOX_JAIL_VIOLATION',
        403
      );
    }
  }
  const absPosixSensitiveRe = /(?:^|[\s"'=,(])(\/(?:etc|usr|var|root|home|Users|Windows|ProgramData|mnt\/[a-z])\b[^\s"';&|),]*)/gi;
  while ((m = absPosixSensitiveRe.exec(cmd)) !== null) {
    const normResolved = path.resolve(m[1]);
    if (!isPathInsideDir(realSessionDir, normResolved)) {
      throw createSandboxError(
        `Workspace Jail: akses path sistem "${m[1]}" di luar sandbox sesi diblokir.`,
        'SANDBOX_JAIL_VIOLATION',
        403
      );
    }
  }

  return cmd;
}

function truncateSandboxOutput(text, maxChars = MAX_OUTPUT_CHARS) {
  const str = String(text === undefined || text === null ? '' : text);
  const limit = Math.max(200, Number(maxChars) || MAX_OUTPUT_CHARS);
  if (str.length <= limit) {
    return { text: str, truncated: false, originalLength: str.length };
  }
  const notice = `\n...[Output dipotong otomatis pada batas ${limit} karakter; total ${str.length} karakter]`;
  const keep = Math.max(0, limit - notice.length);
  return {
    text: str.slice(0, keep) + notice,
    truncated: true,
    originalLength: str.length
  };
}

function killProcessTree(proc) {
  if (!proc || !proc.pid) return Promise.resolve();
  const pidStr = String(proc.pid);
  if (process.platform === 'win32') {
    try {
      const killer = spawn('taskkill', ['/PID', pidStr, '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
        detached: true
      });
      killer.on('error', (err) => {
        console.warn('[Z21 Sandbox] taskkill warn:', err.message);
      });
      if (typeof killer.unref === 'function') killer.unref();
    } catch (err) {
      console.warn('[Z21 Sandbox] taskkill spawn warn:', err.message);
    }
    try {
      proc.kill('SIGKILL');
    } catch (killErr) {
      console.warn('[Z21 Sandbox] proc kill warn:', killErr.message);
    }
    return Promise.resolve();
  }
  try {
    proc.kill('SIGKILL');
  } catch (err) {
    console.warn('[Z21 Sandbox] POSIX kill warn:', err.message);
  }
  return Promise.resolve();
}

async function runTerminal({
  sessionId = 'default_z21',
  command = '',
  cwd = '',
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxOutputChars = MAX_OUTPUT_CHARS,
  workspaceRoot = ''
} = {}) {
  const { safeSessionId, sessionDir } = ensureSessionSandboxDir(sessionId, workspaceRoot);
  const { fullPath: resolvedCwd } = resolveJailedPath(sessionDir, cwd || '.', { allowRoot: true });
  let activeCwd = resolvedCwd;
  if (!fs.existsSync(activeCwd) || !fs.statSync(activeCwd).isDirectory()) {
    throw createSandboxError(`Direktori kerja "${cwd}" tidak ditemukan di sandbox sesi.`, 'SANDBOX_INVALID_CWD', 400);
  }
  activeCwd = fs.realpathSync(activeCwd);
  if (!isPathInsideDir(sessionDir, activeCwd)) {
    throw createSandboxError('Direktori kerja berada di luar sandbox sesi.', 'SANDBOX_JAIL_VIOLATION', 403);
  }

  const cmd = validateJailedCommand(command, sessionDir, activeCwd);
  const rawTimeout = parseInt(timeoutMs, 10);
  const effectiveTimeoutMs = Number.isFinite(rawTimeout)
    ? Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, rawTimeout))
    : DEFAULT_TIMEOUT_MS;
  const outputCap = Math.max(200, Math.min(MAX_OUTPUT_CHARS, parseInt(maxOutputChars, 10) || MAX_OUTPUT_CHARS));

  const sentinel = '__ZOZ_SANDBOX_CWD_9471__';
  const isWin = process.platform === 'win32';
  const executable = isWin ? 'powershell.exe' : (fs.existsSync('/bin/bash') ? '/bin/bash' : 'sh');
  const scriptArgs = isWin
    ? [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `$ErrorActionPreference = 'Continue'\n$global:LASTEXITCODE = 0\n${cmd}\n$__zoz_ok = $?\n$__zoz_ec = if ($LASTEXITCODE -is [int] -and $LASTEXITCODE -ne 0) { $LASTEXITCODE } elseif (-not $__zoz_ok) { 1 } else { 0 }\nWrite-Output '${sentinel}'\n(Get-Location).Path\nexit $__zoz_ec`
      ]
    : ['-c', `${cmd}\n__zoz_ec=$?\necho "${sentinel}"\npwd\nexit $__zoz_ec`];

  const childEnv = {
    ...process.env,
    ZOZ_SANDBOX_DIR: sessionDir,
    ZOZ_SANDBOX_SESSION_ID: safeSessionId,
    HOME: sessionDir,
    USERPROFILE: sessionDir,
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1'
  };

  return await new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(executable, scriptArgs, {
        cwd: activeCwd,
        env: childEnv,
        windowsHide: true
      });
    } catch (spawnErr) {
      resolve({
        sandbox: true,
        success: false,
        session_id: safeSessionId,
        sandbox_dir: sessionDir,
        cwd: path.relative(sessionDir, activeCwd).replace(/\\/g, '/') || '.',
        stdout: '',
        stderr: truncateSandboxOutput(`Gagal menjalankan terminal sandbox: ${spawnErr.message}`, outputCap).text,
        exit_code: 1,
        timed_out: false,
        truncated: false,
        timeout_ms: effectiveTimeoutMs
      });
      return;
    }

    let rawStdout = '';
    let rawStderr = '';
    let timedOut = false;
    let settled = false;
    let killPromise = null;
    const rawBufferLimit = Math.max(32000, outputCap * 6);

    const finalize = async (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killPromise) {
        await killPromise;
      }

      let cleanStdout = rawStdout;
      let nextCwdRel = path.relative(sessionDir, activeCwd).replace(/\\/g, '/') || '.';
      const sentinelIdx = rawStdout.lastIndexOf(sentinel);
      if (sentinelIdx !== -1) {
        cleanStdout = rawStdout.slice(0, sentinelIdx);
        const reportedCwd = rawStdout.slice(sentinelIdx + sentinel.length).trim().split(/\r?\n/)[0] || '';
        if (reportedCwd) {
          try {
            const realReported = fs.existsSync(reportedCwd) ? fs.realpathSync(reportedCwd) : path.resolve(reportedCwd);
            if (isPathInsideDir(sessionDir, realReported)) {
              nextCwdRel = path.relative(sessionDir, realReported).replace(/\\/g, '/') || '.';
            } else {
              nextCwdRel = '.';
            }
          } catch (cwdErr) {
            console.warn('[Z21 Sandbox] cwd resolve warn:', cwdErr.message);
            nextCwdRel = '.';
          }
        }
      }

      cleanStdout = cleanStdout.replace(/\r\n/g, '\n').trimEnd();
      let cleanStderr = rawStderr.replace(/\r\n/g, '\n').trimEnd();
      let finalExit = Number.isInteger(exitCode) ? exitCode : (timedOut ? 124 : 1);

      if (timedOut) {
        finalExit = 124;
        const timeoutMsg = `[TIMEOUT]: Perintah dihentikan otomatis karena melebihi batas ${(effectiveTimeoutMs / 1000).toFixed(1).replace(/\.0$/, '')} detik.`;
        cleanStderr = cleanStderr ? `${cleanStderr}\n${timeoutMsg}` : timeoutMsg;
      }

      // Jaga total stdout + stderr tetap di bawah batas 5.000 karakter saat dikirim ke LLM
      let stdoutCapLimit = outputCap;
      let stderrCap = truncateSandboxOutput(cleanStderr, Math.min(2000, outputCap));
      stdoutCapLimit = Math.max(200, outputCap - stderrCap.text.length);
      let stdoutCap = truncateSandboxOutput(cleanStdout, stdoutCapLimit);
      if (cleanStderr && stdoutCap.text.length + stderrCap.text.length > outputCap) {
        stderrCap = truncateSandboxOutput(cleanStderr, Math.max(200, outputCap - stdoutCap.text.length));
      }

      resolve({
        sandbox: true,
        success: !timedOut && finalExit === 0,
        session_id: safeSessionId,
        sandbox_dir: sessionDir,
        cwd: nextCwdRel === '.' ? '.' : `./${nextCwdRel}`,
        stdout: stdoutCap.text,
        stderr: stderrCap.text,
        exit_code: finalExit,
        timed_out: timedOut,
        truncated: Boolean(stdoutCap.truncated || stderrCap.truncated),
        timeout_ms: effectiveTimeoutMs
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killPromise = killProcessTree(proc);
      killPromise.then(() => {
        if (!settled) {
          try { if (proc.stdout) proc.stdout.destroy(); } catch (sErr) { console.warn('[Z21 Sandbox] stdout destroy:', sErr.message); }
          try { if (proc.stderr) proc.stderr.destroy(); } catch (eErr) { console.warn('[Z21 Sandbox] stderr destroy:', eErr.message); }
          finalize(124);
        }
      });
    }, effectiveTimeoutMs);

    proc.stdout.on('data', (chunk) => {
      if (rawStdout.length < rawBufferLimit) {
        rawStdout += chunk.toString('utf8');
      }
    });

    proc.stderr.on('data', (chunk) => {
      if (rawStderr.length < rawBufferLimit) {
        rawStderr += chunk.toString('utf8');
      }
    });

    proc.on('error', (procErr) => {
      rawStderr += `\n${procErr.message}`;
      finalize(1);
    });

    proc.on('close', (code) => {
      finalize(code === null ? (timedOut ? 124 : 1) : code);
    });
  });
}

async function readSandboxFile({
  sessionId = 'default_z21',
  path: targetPath = '',
  startLine = null,
  endLine = null,
  maxChars = MAX_OUTPUT_CHARS,
  workspaceRoot = ''
} = {}) {
  const { safeSessionId, sessionDir } = ensureSessionSandboxDir(sessionId, workspaceRoot);
  const { fullPath, relPath } = resolveJailedPath(sessionDir, targetPath, { allowRoot: false });
  if (!fs.existsSync(fullPath)) {
    throw createSandboxError(`Berkas tidak ditemukan di sandbox sesi: ${relPath}`, 'SANDBOX_FILE_NOT_FOUND', 404);
  }
  const stat = await fsp.stat(fullPath);
  if (stat.isDirectory()) {
    throw createSandboxError(`Target "${relPath}" adalah direktori, bukan berkas.`, 'SANDBOX_IS_DIRECTORY', 400);
  }

  const rawContent = await fsp.readFile(fullPath, 'utf8');
  const lines = rawContent.split(/\r?\n/);
  const totalLines = lines.length;
  const parsedStart = parseInt(startLine, 10);
  const parsedEnd = parseInt(endLine, 10);

  let selectedText = rawContent;
  let effectiveStart = 1;
  let effectiveEnd = totalLines;

  if ((Number.isFinite(parsedStart) && parsedStart > 0) || (Number.isFinite(parsedEnd) && parsedEnd > 0)) {
    effectiveStart = Math.max(1, Math.min(totalLines, Number.isFinite(parsedStart) && parsedStart > 0 ? parsedStart : 1));
    effectiveEnd = Number.isFinite(parsedEnd) && parsedEnd > 0
      ? Math.max(effectiveStart, Math.min(totalLines, parsedEnd))
      : totalLines;
    selectedText = lines.slice(effectiveStart - 1, effectiveEnd).join('\n');
  }

  const outputCap = Math.max(200, Math.min(MAX_OUTPUT_CHARS, parseInt(maxChars, 10) || MAX_OUTPUT_CHARS));
  const capped = truncateSandboxOutput(selectedText, outputCap);

  return {
    sandbox: true,
    success: true,
    session_id: safeSessionId,
    sandbox_dir: sessionDir,
    path: relPath,
    size: stat.size,
    total_lines: totalLines,
    start_line: effectiveStart,
    end_line: effectiveEnd,
    truncated: capped.truncated || effectiveEnd < totalLines,
    content: capped.text
  };
}

async function selectSandboxFileLines({
  sessionId = 'default_z21',
  path: targetPath = '',
  workspaceRoot = '',
  maxChars = MAX_OUTPUT_CHARS,
  ...restOpts
} = {}) {
  const { safeSessionId, sessionDir } = ensureSessionSandboxDir(sessionId, workspaceRoot);
  const { fullPath, relPath } = resolveJailedPath(sessionDir, targetPath, { allowRoot: false });
  if (!fs.existsSync(fullPath)) {
    throw createSandboxError(`Berkas tidak ditemukan di sandbox sesi: ${relPath}`, 'SANDBOX_FILE_NOT_FOUND', 404);
  }
  const stat = await fsp.stat(fullPath);
  if (stat.isDirectory()) {
    throw createSandboxError(`Target "${relPath}" adalah direktori, bukan berkas.`, 'SANDBOX_IS_DIRECTORY', 400);
  }
  if (stat.size > MAX_WRITE_BYTES) {
    throw createSandboxError(`Ukuran berkas melebihi batas maksimum seleksi ${MAX_WRITE_BYTES} bytes.`, 'SANDBOX_FILE_TOO_LARGE', 400);
  }
  const rawBuf = await fsp.readFile(fullPath);
  if (rawBuf.includes(0)) {
    throw createSandboxError(`Berkas "${relPath}" adalah file biner (bukan teks UTF-8).`, 'SANDBOX_BINARY_FILE', 400);
  }
  const coreResult = selectLinesFromContentCore(rawBuf.toString('utf8'), relPath, stat.size, {
    ...restOpts,
    max_chars: Math.max(1000, Math.min(24000, parseInt(maxChars, 10) || 12000))
  });
  return {
    ...coreResult,
    sandbox: true,
    success: true,
    session_id: safeSessionId,
    sandbox_dir: sessionDir,
    path: relPath
  };
}

async function writeSandboxFile({
  sessionId = 'default_z21',
  path: targetPath = '',
  content = '',
  append = false,
  workspaceRoot = ''
} = {}) {
  const { safeSessionId, sessionDir } = ensureSessionSandboxDir(sessionId, workspaceRoot);
  const { fullPath, relPath } = resolveJailedPath(sessionDir, targetPath, { allowRoot: false });
  if (content === undefined || content === null) {
    throw createSandboxError('Parameter content wajib diisi.', 'SANDBOX_INVALID_CONTENT', 400);
  }
  const textContent = String(content);
  const byteSize = Buffer.byteLength(textContent, 'utf8');
  if (byteSize > MAX_WRITE_BYTES) {
    throw createSandboxError(`Ukuran berkas melebihi batas maksimum ${MAX_WRITE_BYTES} bytes.`, 'SANDBOX_FILE_TOO_LARGE', 400);
  }

  const parentDir = path.dirname(fullPath);
  await fsp.mkdir(parentDir, { recursive: true });
  const realParent = fs.realpathSync(parentDir);
  if (!isPathInsideDir(sessionDir, realParent)) {
    throw createSandboxError('Workspace Jail: direktori induk berada di luar sandbox sesi.', 'SANDBOX_JAIL_VIOLATION', 403);
  }

  if (append) {
    await fsp.appendFile(fullPath, textContent, 'utf8');
  } else {
    await fsp.writeFile(fullPath, textContent, 'utf8');
  }

  const finalStat = await fsp.stat(fullPath);
  const writtenText = append ? await fsp.readFile(fullPath, 'utf8') : textContent;

  return {
    sandbox: true,
    success: true,
    session_id: safeSessionId,
    sandbox_dir: sessionDir,
    path: relPath,
    size: finalStat.size,
    total_lines: writtenText.split(/\r?\n/).length,
    appended: Boolean(append)
  };
}

function parseSandboxToolArgs(rawArgs) {
  if (!rawArgs) return {};
  if (typeof rawArgs === 'object' && !Array.isArray(rawArgs)) return rawArgs;
  if (typeof rawArgs === 'string') {
    const trimmed = rawArgs.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (parseErr) {
      console.warn('[Z21 Sandbox] arg parse warn:', parseErr.message);
      return { command: trimmed, path: trimmed };
    }
  }
  return {};
}

function extractInlineSandboxToolCalls(text = '') {
  const calls = [];
  if (!text || typeof text !== 'string') return calls;
  const re = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi;
  let m;
  let idx = 0;
  while ((m = re.exec(text)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      if (obj && obj.name) {
        calls.push({
          id: `sandbox_inline_${Date.now()}_${idx++}`,
          type: 'function',
          function: {
            name: String(obj.name).trim(),
            arguments: JSON.stringify(obj.arguments || obj.parameters || {})
          }
        });
      }
    } catch (inlineErr) {
      console.warn('[Z21 Sandbox] inline tool_call parse skip:', inlineErr.message);
    }
  }
  return calls;
}

async function executeSandboxToolByName(name, rawArgs, ctx = {}) {
  const tool = String(name || '').toLowerCase().trim();
  const args = parseSandboxToolArgs(rawArgs);
  const common = {
    sessionId: ctx.sessionId,
    workspaceRoot: ctx.workspaceRoot,
    maxOutputChars: ctx.maxOutputChars || MAX_OUTPUT_CHARS
  };

  if (tool === 'run_terminal' || tool === 'terminal' || tool === 'bash' || tool === 'shell') {
    return await runTerminal({
      ...common,
      command: args.command || args.cmd || '',
      cwd: args.cwd || '',
      timeoutMs: args.timeout_ms || args.timeoutMs || ctx.timeoutMs || DEFAULT_TIMEOUT_MS
    });
  }
  if (tool === 'select_lines') {
    return await selectSandboxFileLines({
      ...common,
      path: args.path || args.file || args.filePath || '',
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
      max_matches: args.max_matches ?? args.maxMatches,
      maxChars: ctx.maxOutputChars || 12000
    });
  }
  if (tool === 'read_file') {
    return await readSandboxFile({
      ...common,
      path: args.path || args.file || args.filePath || '',
      startLine: args.start_line || args.startLine || null,
      endLine: args.end_line || args.endLine || null,
      maxChars: ctx.maxOutputChars || MAX_OUTPUT_CHARS
    });
  }
  if (tool === 'write_file') {
    return await writeSandboxFile({
      ...common,
      path: args.path || args.file || args.filePath || '',
      content: args.content !== undefined ? args.content : args.text,
      append: Boolean(args.append)
    });
  }
  throw createSandboxError(`Tool sandbox "${name}" tidak dikenal. Gunakan run_terminal, read_file, atau write_file.`, 'SANDBOX_UNKNOWN_TOOL', 400);
}

async function callDefaultSandboxLlm({
  engine = 'ollama',
  endpoint = 'http://127.0.0.1:11434',
  apiKey = '',
  model = 'qwen3:8b',
  messages = [],
  tools = []
}) {
  const normalizedEngine = String(engine || 'ollama').toLowerCase();
  const useOpenRouter = normalizedEngine === 'openrouter' || String(endpoint).includes('openrouter.ai');
  const url = useOpenRouter
    ? (String(endpoint || '').includes('/chat/completions') ? endpoint : 'https://openrouter.ai/api/v1/chat/completions')
    : `${String(endpoint || 'http://127.0.0.1:11434').replace(/\/+$/, '')}/api/chat`;

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const body = useOpenRouter
    ? {
        model,
        messages,
        stream: false,
        ...(Array.isArray(tools) && tools.length > 0 ? { tools, tool_choice: 'auto' } : {})
      }
    : {
        model,
        messages,
        stream: false,
        ...(Array.isArray(tools) && tools.length > 0 ? { tools } : {})
      };

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data) {
    const errMsg = (data && (data.error?.message || data.error)) || `HTTP ${resp.status}`;
    throw createSandboxError(`Gagal memanggil LLM (${normalizedEngine}): ${errMsg}`, 'SANDBOX_LLM_ERROR', 502);
  }

  if (useOpenRouter) {
    const msg = data.choices?.[0]?.message || {};
    return {
      content: String(msg.content || ''),
      tool_calls: Array.isArray(msg.tool_calls) ? msg.tool_calls : []
    };
  }
  const msg = data.message || {};
  return {
    content: String(msg.content || ''),
    tool_calls: Array.isArray(msg.tool_calls) ? msg.tool_calls : []
  };
}

async function runZ21SandboxAgentLoop({
  sessionId = 'default_z21',
  prompt = '',
  messages = [],
  systemPrompt = '',
  model = 'qwen3:8b',
  engine = 'ollama',
  endpoint = 'http://127.0.0.1:11434',
  apiKey = '',
  maxRounds = 8,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxOutputChars = MAX_OUTPUT_CHARS,
  workspaceRoot = '',
  llmCaller = null
} = {}) {
  const { safeSessionId, sessionDir } = ensureSessionSandboxDir(sessionId, workspaceRoot);
  const roundLimit = Math.max(1, Math.min(20, parseInt(maxRounds, 10) || 8));
  const outputCap = Math.max(200, Math.min(MAX_OUTPUT_CHARS, parseInt(maxOutputChars, 10) || MAX_OUTPUT_CHARS));

  const defaultSysPrompt = [
    `Anda adalah agen developer lokal Mode Z21 pada lingkungan sandbox terisolasi untuk sesi "${safeSessionId}".`,
    `Folder kerja sandbox Anda hanya berada di dalam ./sandbox_sessions/${safeSessionId}.`,
    'Gunakan `write_file` untuk membuat/mengubah berkas dan `read_file` untuk membaca berkas (JANGAN memakai cat/echo dengan heredoc atau tanda kutip rumit di shell).',
    'Gunakan `run_terminal` untuk menjalankan kode, pengujian, atau memeriksa hasil eksekusi (timeout maks 30 detik, output dipotong pada 5.000 karakter).',
    'Berhenti memanggil tool segera setelah tugas selesai dan sampaikan jawaban akhir yang jujur berdasarkan stdout, stderr, dan exit_code.'
  ].join('\n');

  const conversation = [
    { role: 'system', content: systemPrompt ? `${defaultSysPrompt}\n\n${systemPrompt}` : defaultSysPrompt }
  ];
  if (Array.isArray(messages) && messages.length > 0) {
    for (const m of messages) {
      if (m && m.role && m.role !== 'system') conversation.push(m);
    }
  }
  if (prompt && String(prompt).trim()) {
    conversation.push({ role: 'user', content: String(prompt).trim() });
  }

  const toolTrace = [];
  let round = 0;
  let finalAnswer = '';

  while (round < roundLimit) {
    const llmReply = llmCaller
      ? await llmCaller({ messages: conversation, tools: SANDBOX_TOOL_SCHEMAS, round, sessionId: safeSessionId, sandboxDir: sessionDir })
      : await callDefaultSandboxLlm({ engine, endpoint, apiKey, model, messages: conversation, tools: SANDBOX_TOOL_SCHEMAS });

    const assistantText = String(llmReply && llmReply.content ? llmReply.content : '');
    let toolCalls = Array.isArray(llmReply && llmReply.tool_calls) ? llmReply.tool_calls : [];
    if (toolCalls.length === 0 && assistantText.includes('<tool_call>')) {
      toolCalls = extractInlineSandboxToolCalls(assistantText);
    }

    if (toolCalls.length === 0) {
      finalAnswer = assistantText;
      conversation.push({ role: 'assistant', content: finalAnswer });
      break;
    }

    const normalizedCalls = toolCalls.map((tc, idx) => ({
      id: tc.id || `sandbox_call_${round}_${idx}`,
      type: 'function',
      function: {
        name: String(tc.function?.name || tc.name || '').trim(),
        arguments: typeof tc.function?.arguments === 'string'
          ? tc.function.arguments
          : JSON.stringify(tc.function?.arguments || tc.arguments || {})
      }
    }));

    conversation.push({
      role: 'assistant',
      content: assistantText || null,
      tool_calls: normalizedCalls
    });

    for (const call of normalizedCalls) {
      let execResult;
      try {
        execResult = await executeSandboxToolByName(call.function.name, call.function.arguments, {
          sessionId: safeSessionId,
          workspaceRoot,
          timeoutMs,
          maxOutputChars: outputCap
        });
      } catch (toolErr) {
        execResult = {
          sandbox: true,
          success: false,
          code: toolErr.code || 'SANDBOX_ERROR',
          error: toolErr.message || String(toolErr)
        };
      }

      const serialized = truncateSandboxOutput(JSON.stringify(execResult), outputCap).text;
      toolTrace.push({
        round,
        tool: call.function.name,
        arguments: parseSandboxToolArgs(call.function.arguments),
        result: execResult
      });
      conversation.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: serialized
      });
    }

    round++;
  }

  if (!finalAnswer && round >= roundLimit) {
    const synthesisReply = llmCaller
      ? await llmCaller({ messages: conversation, tools: [], round, finalSynthesis: true, sessionId: safeSessionId, sandboxDir: sessionDir })
      : await callDefaultSandboxLlm({ engine, endpoint, apiKey, model, messages: conversation, tools: [] });
    finalAnswer = String(synthesisReply && synthesisReply.content ? synthesisReply.content : '');
    conversation.push({ role: 'assistant', content: finalAnswer });
  }

  return {
    sandbox: true,
    success: true,
    session_id: safeSessionId,
    sandbox_dir: sessionDir,
    answer: finalAnswer,
    rounds: round,
    tool_trace: toolTrace,
    messages: conversation
  };
}

if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);
    const readFlag = (flag, fallback = '') => {
      const idx = argv.indexOf(flag);
      return (idx !== -1 && idx + 1 < argv.length) ? argv[idx + 1] : fallback;
    };
    const sessionId = readFlag('--session', 'cli_z21_session');
    const prompt = readFlag('--prompt', '');
    const model = readFlag('--model', process.env.ZOZ_SANDBOX_MODEL || 'qwen3:8b');
    const engine = readFlag('--engine', 'ollama');
    const endpoint = readFlag('--endpoint', 'http://127.0.0.1:11434');
    if (!prompt) {
      console.error('Usage: node src/z21/session-sandbox.js --session <chat_id> --prompt "<task>" [--model qwen3:8b]');
      process.exit(1);
    }
    const result = await runZ21SandboxAgentLoop({ sessionId, prompt, model, engine, endpoint });
    console.log(JSON.stringify({ session_id: result.session_id, rounds: result.rounds, answer: result.answer }, null, 2));
  })().catch((err) => {
    console.error('[Z21 Sandbox CLI Error]', err);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  MAX_OUTPUT_CHARS,
  MAX_WRITE_BYTES,
  SANDBOX_TOOL_SCHEMAS,
  getSandboxSessionsRoot,
  sanitizeSessionId,
  ensureSessionSandboxDir,
  resolveJailedPath,
  validateJailedCommand,
  truncateSandboxOutput,
  runTerminal,
  readSandboxFile,
  selectSandboxFileLines,
  writeSandboxFile,
  executeSandboxToolByName,
  runZ21SandboxAgentLoop
};
