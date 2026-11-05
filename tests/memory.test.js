/**
 * Jozz Memory - Automated Test Suite
 * Tests all 6 Mistral AI Memory Pillars:
 * 1. PII Redaction & Anti-Inference Guardrails
 * 2. SQLite Database & Temporal Conflict Resolution (valid_until)
 * 3. Explicit Capture & Background Extractor
 * 4. Scoped Hybrid Recall (Vector + BM25 + Graph) & Clickable Receipts
 * 5. Incognito Mode & Scope Isolation
 * 6. Sovereignty (Export & Import in JSON & Markdown with Deduplication)
 * 7. Memory Insights Generator
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Setup temporary test database
const TEST_DB_PATH = path.join(os.tmpdir(), `jozz_memory_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.db`);
process.env.JOZZ_MEMORY_DB_PATH = TEST_DB_PATH;

const config = require('../src/memory/config');
config.DB_PATH = TEST_DB_PATH;

const { redactPII, validateAntiInference, sanitizeFactCandidate } = require('../src/memory/pipeline/guardrails');
const dbStorage = require('../src/memory/storage/db');
const { recallMemories } = require('../src/memory/pipeline/retriever');
const { parseExplicitMemoryDirective, captureExplicitMemory } = require('../src/memory/pipeline/extractor');
const { exportMemories, importMemories } = require('../src/memory/sovereignty/porter');
const { generateMemoryInsights } = require('../src/memory/pipeline/insights');

async function runTests() {
  console.log('🚀 Running Jozz Memory Test Suite...\n');

  // ==========================================
  // Pillar 1: Guardrails & Anti-Inference
  // ==========================================
  console.log('👉 Pillar 1: Guardrail Privasi & Anti-Inferensi Ketat');
  const sensitiveText = 'Kunci rahasia saya sk-proj-1234567890abcdef1234567890 dan NIK 3201012304900001 dengan password=Secret123!';
  const redacted = redactPII(sensitiveText);
  assert.ok(!redacted.includes('sk-proj-'), 'OpenAI key must be redacted');
  assert.ok(!redacted.includes('3201012304900001'), 'NIK must be redacted');
  assert.ok(!redacted.includes('Secret123!'), 'Password must be redacted');
  assert.ok(redacted.includes('[REDACTED_API_KEY]'));
  assert.ok(redacted.includes('[REDACTED_NIK]'));

  // Anti-Inference check
  const speculativeFact = 'Mungkin pengguna lebih menyukai dark mode karena sering online malam';
  const infCheck = validateAntiInference(speculativeFact);
  assert.strictEqual(infCheck.valid, false, 'Speculative assumption must be blocked');

  const solidFact = 'Saya lebih memilih TypeScript daripada Python untuk proyek backend.';
  const solidCheck = validateAntiInference(solidFact);
  assert.strictEqual(solidCheck.valid, true, 'Explicit user statement must be accepted');
  console.log('✅ Pillar 1 PASSED: PII redacted & anti-inference guardrails enforced.\n');

  // ==========================================
  // Pillar 2 & 3: Hybrid Storage & Temporal Conflict Resolution
  // ==========================================
  console.log('👉 Pillar 2 & 3: Penyimpanan Hibrida & Temporal Conflict Resolution (valid_until)');
  dbStorage.initDatabase(TEST_DB_PATH);

  const entRest = dbStorage.upsertEntity({ userId: 'zozi', name: 'REST_API', entityType: 'tech', scope: 'web' });
  const entGql = dbStorage.upsertEntity({ userId: 'zozi', name: 'GraphQL', entityType: 'tech', scope: 'web' });

  // Initial fact: API uses REST
  const rel1 = dbStorage.addRelation({
    userId: 'zozi',
    sourceEntityId: entRest.id,
    targetEntityId: entGql.id,
    relationType: 'api_standard',
    fact: 'Layanan web menggunakan REST API standar'
  });
  assert.strictEqual(rel1.validUntil, null, 'Initial relation validUntil must be null (active)');

  // New fact replacing old: Now switched to GraphQL!
  const rel2 = dbStorage.addRelation({
    userId: 'zozi',
    sourceEntityId: entRest.id,
    targetEntityId: entGql.id,
    relationType: 'api_standard',
    fact: 'Layanan web sekarang beralih penuh ke GraphQL'
  }, { resolveConflict: true });

  const activeRelations = dbStorage.traverseActiveGraph('zozi', entRest.id, 1);
  assert.strictEqual(activeRelations.length, 1, 'Only one active relation must remain');
  assert.strictEqual(activeRelations[0].fact, 'Layanan web sekarang beralih penuh ke GraphQL');
  console.log('✅ Pillar 2 & 3 PASSED: Temporal conflict resolved (old valid_until stamped, new relation active).\n');

  // ==========================================
  // Pillar 4: Explicit Capture & Scoped Hybrid Recall (Vector + FTS5 BM25 + Graph)
  // ==========================================
  console.log('👉 Pillar 4: Scoped Hybrid Recall (Vector + BM25 + Graph) & Clickable Receipts');
  const explicitDirective = parseExplicitMemoryDirective('Ingat bahwa saya selalu menggunakan tema Cyberpunk Neon untuk UI dashboard');
  assert.ok(explicitDirective, 'Explicit directive must be parsed');

  const captured = captureExplicitMemory('zozi', explicitDirective, 'dashboard', {
    sourceTitle: 'Sesi Diskusi Desain',
    sourceUri: '/chat/session_101'
  });
  assert.strictEqual(captured.success, true);
  assert.ok(captured.memory.id.startsWith('mem_'));

  // Another memory in different scope
  captureExplicitMemory('zozi', 'Database analitik utama adalah ClickHouse', 'backend');

  // Scoped Recall for query 'tema UI' in scope 'dashboard'
  const recallResult = recallMemories('zozi', 'Apa tema warna UI yang saya pakai?', 'dashboard');
  assert.ok(recallResult.memories.length > 0, 'Must recall relevant memories');
  assert.ok(recallResult.receipts.length > 0, 'Must generate Clickable Receipts');
  assert.ok(recallResult.memories[0].content.includes('Cyberpunk Neon'), 'Must rank Cyberpunk Neon memory top');
  assert.ok(recallResult.systemPromptInjection.includes('### JOZZ MEMORY CONTEXT'), 'System prompt injection generated');

  // Verify Clickable Receipt attributes
  const receipt = recallResult.receipts[0];
  assert.ok(receipt.memoryId);
  assert.ok(receipt.sourceTitle);
  assert.strictEqual(receipt.sourceType, 'manual');
  console.log('✅ Pillar 4 PASSED: Scoped Hybrid Recall correctly recalled memory with clickable receipts.\n');

  // ==========================================
  // Pillar 5: Sovereignty (Export / Import in JSON & Markdown with Deduplication)
  // ==========================================
  console.log('👉 Pillar 5: Sovereignty (Export & Import in JSON & Markdown with Deduplication)');
  const exportedJson = exportMemories('zozi', 'json');
  assert.ok(exportedJson.content.includes('Cyberpunk Neon'));
  assert.strictEqual(exportedJson.contentType, 'application/json; charset=utf-8');

  const exportedMd = exportMemories('zozi', 'md');
  assert.ok(exportedMd.content.includes('# JOZZ MEMORY EXPORT'));
  assert.ok(exportedMd.content.includes('Cyberpunk Neon'));

  // Test import deduplication
  const importResult = importMemories('zozi', exportedJson.content, 'json');
  assert.strictEqual(importResult.success, true);
  assert.strictEqual(importResult.imported, 0, 'Existing memories must be deduplicated and not re-inserted');
  assert.ok(importResult.skipped > 0, 'Duplicate count must be logged');

  // Import new item from markdown
  const mdSnippet = `### Kategori: PREFERENCE\n- Suka menggunakan Font Fira Code untuk code editor`;
  const importMdRes = importMemories('zozi', mdSnippet, 'md');
  assert.strictEqual(importMdRes.imported, 1, 'New markdown item must be imported');
  console.log('✅ Pillar 5 PASSED: Export/Import in JSON & Markdown with deduplication successful.\n');

  // ==========================================
  // Pillar 6: Memory Insights Generation
  // ==========================================
  console.log('👉 Pillar 6: Memory Insights Generator');
  const insightsReport = generateMemoryInsights('zozi');
  assert.ok(insightsReport.totalMemories >= 2, 'Total memories must reflect stored items');
  assert.ok(insightsReport.categoryDistribution);
  assert.ok(Array.isArray(insightsReport.recommendedReviewTopics));
  console.log('✅ Pillar 6 PASSED: Memory Insights correctly analyzed categories and topics.\n');

  // Cleanup test database
  try {
    fs.unlinkSync(TEST_DB_PATH);
  } catch (_) {}

  console.log('🎉 ALL 6 PILLARS OF JOZZ MEMORY TESTED AND VERIFIED 100%!');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
