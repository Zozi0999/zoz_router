/**
 * Jozz Memory - Architecture Configuration
 * Mistral AI 6-Pillars Standard
 */

const path = require('path');
const os = require('os');

const DATA_DIR = process.env.ZOZ_DATA_DIR || path.join(os.homedir(), '.zoz-router');
const DB_PATH = process.env.JOZZ_MEMORY_DB_PATH || path.join(DATA_DIR, 'jozz_memory.db');

module.exports = {
  DATA_DIR,
  DB_PATH,
  DEFAULT_USER_ID: 'default',
  DEFAULT_SCOPE: 'global',
  
  // Model & Extraction Settings
  EXTRACTION_MODEL: process.env.JOZZ_MEMORY_MODEL || 'mistralai/mistral-small-latest',
  FALLBACK_MODELS: [
    'openrouter/free',
    'mistralai/mistral-7b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2.5-7b-instruct'
  ],
  EMBEDDING_MODEL: process.env.JOZZ_EMBEDDING_MODEL || 'mistral-embed',
  EMBEDDING_DIMENSION: 128, // Fast normalized float32 vector space for zero-config offline fallback
  
  // Recall & RRF Weights
  RRF_K: 60, // Standard Cormack-Clarke RRF constant
  WEIGHT_VECTOR: 0.40,
  WEIGHT_BM25: 0.40,
  WEIGHT_GRAPH: 0.20,
  
  MAX_RECALL_RESULTS: 8,
  MIN_RELEVANCE_SCORE: 0.002,
  MAX_SYSTEM_INJECT_MEMORIES: 6,
  
  // PII & Privacy Filter Settings
  ENABLE_PII_GUARDRAILS: true,
  
  // Temporal Graph Defaults
  GRAPH_MAX_HOPS: 2
};
