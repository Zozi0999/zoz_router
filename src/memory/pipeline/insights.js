/**
 * Jozz Memory - Memory Insights Generator
 * Analyzes user work patterns, trending tech stacks, and recommends past discussions.
 */

const config = require('../config');
const dbStorage = require('../storage/db');

function generateMemoryInsights(userId, scope = null) {
  const uid = userId || config.DEFAULT_USER_ID;

  // 1. Memory totals & category distributions
  const allMemories = dbStorage.listMemories(uid, { scope, limit: 200 });
  const totalCount = allMemories.length;

  const categoryCounts = {};
  for (const m of allMemories) {
    const cat = m.category || 'general';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  // 2 & 3. Active Knowledge Graph Entities & Temporal Relations (mode-agnostic)
  const { entities, activeRelations } = dbStorage.getInsightsData(uid, scope);

  // 4. Synthesize Work Pattern Summary & Key Recommendations
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({ category: cat, count }));

  const topEntities = entities.slice(0, 10).map(e => ({
    name: e.name,
    type: e.entity_type || e.entityType || 'concept',
    summary: e.summary,
    scope: e.scope
  }));

  const recommendedReviewTopics = [];
  if (activeRelations.length > 0) {
    activeRelations.slice(0, 4).forEach(r => {
      recommendedReviewTopics.push({
        topic: `${r.source_name || 'Entitas'} ${r.relation_type || r.relationType} ${r.target_name || ''}`.trim(),
        fact: r.fact,
        validFrom: r.valid_from || r.validFrom
      });
    });
  } else if (allMemories.length > 0) {
    allMemories.slice(0, 3).forEach(m => {
      recommendedReviewTopics.push({
        topic: m.category,
        fact: m.content,
        validFrom: m.created_at || m.createdAt
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
