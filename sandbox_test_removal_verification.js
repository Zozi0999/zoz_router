// sandbox_test_removal_verification.js
const fs = require('fs');
const assert = require('assert');

console.log('=== SANDBOX TEST: VERIFIKASI PENGHAPUSAN SKILL PEMBUATAN WEBSITE & RESIDU ===');

const appCode = fs.readFileSync('./app.js', 'utf8');

// 1. Ekstrak fungsi dan struktur yang telah diubah
function extractFunction(src, name) {
  const match = src.match(new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`));
  if (!match) throw new Error(`Function ${name} not found`);
  const startIndex = match.index;
  let braceCount = 0;
  let started = false;
  let endIndex = -1;
  for (let i = startIndex; i < src.length; i++) {
    if (src[i] === '{') {
      braceCount++;
      started = true;
    } else if (src[i] === '}') {
      braceCount--;
      if (started && braceCount === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }
  return eval(`(${src.substring(startIndex, endIndex)})`);
}

const hasNegativeFileOrPreviewIntent = extractFunction(appCode, 'hasNegativeFileOrPreviewIntent');
const classifyCreationIntent = extractFunction(appCode, 'classifyCreationIntent');
const isWebsiteCreationPrompt = extractFunction(appCode, 'isWebsiteCreationPrompt');
const isWebsiteEditRequest = extractFunction(appCode, 'isWebsiteEditRequest');

// TEST 1: classifyCreationIntent never returns 'website'
console.log('--- TEST 1: classifyCreationIntent ---');
const prompts = [
  'buatkan saya website restoran modern',
  '/website bikin portofolio',
  '/web buat landing page keren',
  'tolong buatkan landing page dengan navbar dan hero section',
  'rancang situs web e-commerce dengan tailwind css',
  'bikin web app game sederhana'
];
for (const p of prompts) {
  const res = classifyCreationIntent(p);
  assert.notStrictEqual(res, 'website', `Prompt "${p}" should NOT return 'website', got ${res}`);
}
console.log('PASS: classifyCreationIntent never classifies prompts as website.');

// TEST 2: isWebsiteCreationPrompt always returns false
console.log('--- TEST 2: isWebsiteCreationPrompt ---');
for (const p of prompts) {
  assert.strictEqual(isWebsiteCreationPrompt(p), false, `Prompt "${p}" should return false`);
}
console.log('PASS: isWebsiteCreationPrompt returns false for all prompts.');

// TEST 3: isWebsiteEditRequest always returns false
console.log('--- TEST 3: isWebsiteEditRequest ---');
assert.strictEqual(isWebsiteEditRequest('ubah tombol navbar jadi warna hijau'), false);
assert.strictEqual(isWebsiteEditRequest('edit hero section website ini'), false);
console.log('PASS: isWebsiteEditRequest returns false.');

// TEST 4: Verification of Mandates and Slash Commands
console.log('--- TEST 4: Verification of Mandates & Residues ---');
assert.strictEqual(appCode.includes('MANDAT KHUSUS PEMBUATAN WEBSITE'), false, 'Found MANDAT KHUSUS PEMBUATAN WEBSITE in app.js');
assert.strictEqual(appCode.includes('MANDAT KHUSUS SURGICAL EDIT WEBSITE'), false, 'Found MANDAT KHUSUS SURGICAL EDIT WEBSITE in app.js');
assert.strictEqual(appCode.includes('AutoContinuation Ollama'), false, 'Found AutoContinuation Ollama in app.js');
assert.strictEqual(appCode.includes('AutoContinuation OpenRouter'), false, 'Found AutoContinuation OpenRouter in app.js');
assert.strictEqual(appCode.includes('AutoRegen Website Ollama'), false, 'Found AutoRegen Website Ollama in app.js');
assert.strictEqual(appCode.includes('AutoRegen Website OpenRouter'), false, 'Found AutoRegen Website OpenRouter in app.js');
assert.strictEqual(appCode.includes('gemini-canvas-warning-strip'), false, 'Found gemini-canvas-warning-strip in app.js');
console.log('PASS: All website creation mandates and residues are 100% removed from app.js.');

// TEST 5: Verification that Code Preview Button is Intact
console.log('--- TEST 5: Code Preview Button Intact ---');
assert.strictEqual(appCode.includes('code-preview-btn'), true, 'code-preview-btn must exist in app.js');
assert.strictEqual(appCode.includes('Buka Pratinjau Interaktif di AI File Studio'), true, 'Preview button tooltip must exist');
assert.strictEqual(appCode.includes('gemini-canvas-iframe'), true, 'gemini-canvas-iframe must exist for preview');
assert.strictEqual(appCode.includes('gemini-canvas-preview-pane'), true, 'gemini-canvas-preview-pane must exist');
console.log('PASS: Code preview button and iframe rendering are 100% intact!');

console.log('\n=== ALL VERIFICATION TESTS PASSED 100%! === 🎉');
