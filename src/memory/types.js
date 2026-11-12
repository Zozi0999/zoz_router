const crypto = require('crypto');

function genSecureId(prefix) {
  try {
    return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(12).toString('hex')}`;
  } catch (_) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

/**
 * Jozz Memory - Type Definitions & Structural Validators
 * Zero-dependency robust schema validator for Jozz Memory
 */

function validateString(val, fallback = '', maxLen = 10000) {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return trimmed.slice(0, maxLen);
}

function validateCategory(cat) {
  const clean = String(cat || '').toLowerCase().trim();
  if (clean === 'general_fact' || clean === 'fact') return 'fact';
  const allowed = ['preference', 'fact', 'project_context', 'technical_stack', 'instruction', 'error_lesson', 'episodic_context', 'general'];
  return allowed.includes(clean) ? clean : 'general';
}

function validateScope(scope) {
  const clean = String(scope || '').toLowerCase().trim();
  return clean ? clean.replace(/[^a-z0-9_-]/g, '') : 'global';
}

function createEpisode({
  id = null,
  userId = 'default',
  sessionId = 'default',
  turnIndex = 0,
  sourceType = 'chat', // 'chat' | 'document' | 'manual'
  sourceTitle = 'Chat Session',
  sourceUri = '',
  rawSnippet = '',
  createdAt = new Date().toISOString()
}) {
  return {
    id: id || genSecureId('ep'),
    userId: validateString(userId, 'default', 64),
    sessionId: validateString(sessionId, 'default', 64),
    turnIndex: Number(turnIndex) || 0,
    sourceType: ['chat', 'document', 'manual'].includes(sourceType) ? sourceType : 'chat',
    sourceTitle: validateString(sourceTitle, 'Percakapan AI', 256),
    sourceUri: validateString(sourceUri, '', 512),
    rawSnippet: validateString(rawSnippet, '', 4000),
    createdAt
  };
}

function createEntity({
  id = null,
  userId = 'default',
  name = '',
  entityType = 'concept', // 'concept' | 'tech' | 'person' | 'project' | 'preference'
  summary = '',
  scope = 'global',
  embeddingJson = null,
  updatedAt = new Date().toISOString()
}) {
  return {
    id: id || genSecureId('ent'),
    userId: validateString(userId, 'default', 64),
    name: validateString(name, '', 128),
    entityType: validateString(entityType, 'concept', 64),
    summary: validateString(summary, '', 2000),
    scope: validateScope(scope),
    embeddingJson: embeddingJson ? (typeof embeddingJson === 'string' ? embeddingJson : JSON.stringify(embeddingJson)) : null,
    updatedAt
  };
}

function createRelation({
  id = null,
  userId = 'default',
  sourceEntityId = '',
  targetEntityId = '',
  relationType = 'relates_to', // 'uses' | 'prefers' | 'replaces' | 'built_with' | 'works_on'
  fact = '',
  validFrom = new Date().toISOString(),
  validUntil = null,
  episodeId = null
}) {
  return {
    id: id || genSecureId('rel'),
    userId: validateString(userId, 'default', 64),
    sourceEntityId: validateString(sourceEntityId, '', 64),
    targetEntityId: validateString(targetEntityId, '', 64),
    relationType: validateString(relationType, 'relates_to', 64),
    fact: validateString(fact, '', 2000),
    validFrom,
    validUntil,
    episodeId
  };
}

function createMemoryItem({
  id = null,
  userId = 'default',
  content = '',
  category = 'fact',
  scope = 'global',
  confidence = 1.0,
  episodeId = null,
  embeddingJson = null,
  isActive = 1,
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString()
}) {
  return {
    id: id || genSecureId('mem'),
    userId: validateString(userId, 'default', 64),
    content: validateString(content, '', 3000),
    category: validateCategory(category),
    scope: validateScope(scope),
    confidence: Math.max(0.0, Math.min(1.0, Number(confidence) || 1.0)),
    episodeId: episodeId || null,
    embeddingJson: embeddingJson ? (typeof embeddingJson === 'string' ? embeddingJson : JSON.stringify(embeddingJson)) : null,
    isActive: isActive ? 1 : 0,
    createdAt,
    updatedAt
  };
}

function createMemoryReceipt({
  memoryId,
  episodeId,
  sourceTitle,
  sourceUri,
  sourceType,
  rawSnippet,
  relevanceScore = 0.0,
  matchedSignal = 'hybrid' // 'vector' | 'bm25' | 'graph' | 'hybrid'
}) {
  return {
    memoryId,
    episodeId,
    sourceTitle: validateString(sourceTitle, 'Sumber Percakapan', 256),
    sourceUri: validateString(sourceUri, '', 512),
    sourceType: sourceType || 'chat',
    rawSnippet: validateString(rawSnippet, '', 1000),
    relevanceScore: Number(Number(relevanceScore).toFixed(4)),
    matchedSignal
  };
}

module.exports = {
  validateString,
  validateCategory,
  validateScope,
  createEpisode,
  createEntity,
  createRelation,
  createMemoryItem,
  createMemoryReceipt
};
