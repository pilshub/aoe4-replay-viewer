export type EntityCategory = 'building' | 'unit';

// Category codes from the parser
const BUILDING_CATEGORY = 19;
const UNIT_CATEGORY = 46;

/**
 * Classify entity as building or unit based on category code or type name.
 */
export function classifyEntity(category?: number | string, typeName?: string): EntityCategory {
  if (category === BUILDING_CATEGORY) return 'building';
  if (category === UNIT_CATEGORY) return 'unit';

  // Handle string categories from the parser (e.g. "Building", "Unit")
  if (typeof category === 'string') {
    const lower = category.toLowerCase();
    if (lower === 'building') return 'building';
    if (lower === 'unit') return 'unit';
  }

  // Fallback: infer from type name
  if (typeName) {
    const lower = typeName.toLowerCase();
    if (lower.startsWith('building_') || lower.includes('town_center') ||
        lower.includes('barracks') || lower.includes('stable') ||
        lower.includes('archery') || lower.includes('siege_workshop') ||
        lower.includes('blacksmith') || lower.includes('market') ||
        lower.includes('monastery') || lower.includes('university') ||
        lower.includes('keep') || lower.includes('castle') ||
        lower.includes('dock') || lower.includes('house') ||
        lower.includes('farm') || lower.includes('mill') ||
        lower.includes('lumber') || lower.includes('mining') ||
        lower.includes('wall') || lower.includes('gate') ||
        lower.includes('tower') || lower.includes('outpost') ||
        lower.includes('palisade')) {
      return 'building';
    }
  }

  return 'unit';
}
