/**
 * Jozz Memory - Memory Insights Generator
 * Analyzes user work patterns, trending tech stacks, and recommends past discussions.
 */

const config = require('../config');
const dbStorage = require('../storage/db');

function generateMemoryInsights(userId, scope = null) {
  const uid = userId || config.DEFAULT_USER_ID;
  const { db } = dbStorage.initDatabase();

  // 1. Memory totals & category distributions
  const allMemories = dbStorage.listMemories(uid, { scope, limit: 200 });
  const totalCount = allMemories.length;

  const categoryCounts = {};
  for (const m of allMemories) {
    const cat = m.category || 'general';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  // 2. Active Knowledge Graph Entities & Top Topics
  let entSql = 'SELECT * FROM entities WHERE user_id = ?';
  const entParams = [uid];
  if (scope) {
    entSql += ' AND (scope = ? OR scope = "global")';
    entParams.push(scope);
  }
  entSql += ' ORDER BY updated_at DESC LIMIT 30';

  const entStmt = db.prepare(entSql);
  const entities = typeof entStmt.all === 'function' ? entStmt.all(...entParams) : [];

  // 3. Active Temporal Relations (Facts currently holding true)
  const relStmt = db.prepare(`
    SELECT r.*, e1.name as source_name, e2.name as target_name 
    FROM relations r
    LEFT JOIN entities e1 ON r.source_entity_id = e1.id
    LEFT JOIN entities e2 ON r.target_entity_id = e2.id
    WHERE r.user_id = ? AND r.valid_until IS NULL
    ORDER BY r.valid_from DESC LIMIT 20
  `);
  const activeRelations = typeof relStmt.all === 'function' ? relStmt.all(uid) : [];

  // 4. Synthesize Work Pattern Summary & Key Recommendations
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({ category: cat, count }));

  const topEntities = entities.slice(0, 10).map(e => ({
    name: e.name,
    type: e.entity_type,
    summary: e.summary,
    scope: e.scope
  }));

  const recommendedReviewTopics = [];
  if (activeRelations.length > 0) {
    activeRelations.slice(0, 4).forEach(r => {
      recommendedReviewTopics.push({
        topic: `${r.source_name || 'Entitas'} ${r.relation_type} ${r.target_name || ''}`.trim(),
        fact: r.fact,
        validFrom: r.valid_from
      });
    });
  } else if (allMemories.length > 0) {
    allMemories.slice(0, 3).forEach(m => {
      recommendedReviewTopics.push({
        topic: m.category,
        fact: m.content,
        validFrom: m.created_at
      });
    });
  }

  return {
    userId: uid,
    totalMemories: totalCount,
    categoryDistribution: categoryCounts,
    topCategories,
    topEntities,
    activeRelationsCount: activeRelations.length,
    activeRelations: activeRelations.slice(0, 8),
    recommendedReviewTopics,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  generateMemoryInsights
};
