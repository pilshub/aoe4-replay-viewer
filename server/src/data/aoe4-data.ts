import fs from 'fs';
import path from 'path';

export interface ResourceCosts {
  food: number;
  wood: number;
  stone: number;
  gold: number;
  total: number;
  popcap: number;
  time: number; // build/research time in seconds
}

export interface Aoe4Entry {
  name: string;
  icon: string;
  type: 'building' | 'unit' | 'technology';
  displayClass: string;
  costs: ResourceCosts | null;
  age: number;         // 1=Dark, 2=Feudal, 3=Castle, 4=Imperial
  classes: string[];
  baseId: string;      // civ-agnostic identifier (e.g. "archer", "barracks")
}

// Lazy-loaded singleton
let _lookup: Map<number, Aoe4Entry> | null = null;

/**
 * Get the pbgid → entry lookup map.
 * Loads from the raw JSON files on first call, then caches.
 */
export function getAoe4Lookup(): Map<number, Aoe4Entry> {
  if (_lookup) return _lookup;

  _lookup = new Map();
  const dataDir = path.join(__dirname);

  const files: { file: string; type: 'building' | 'unit' | 'technology' }[] = [
    { file: 'buildings-raw.json', type: 'building' },
    { file: 'units-raw.json', type: 'unit' },
    { file: 'technologies-raw.json', type: 'technology' },
  ];

  for (const { file, type } of files) {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`[aoe4-data] Missing ${file}, skipping`);
      continue;
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const entries: any[] = raw.data ?? [];

    for (const entry of entries) {
      const pbgid = entry.pbgid as number;
      if (!pbgid || _lookup.has(pbgid)) continue;

      _lookup.set(pbgid, {
        name: (entry.name ?? 'Unknown').replace(/\n/g, ' '),
        icon: entry.icon ?? '',
        type,
        displayClass: entry.displayClasses?.[0] ?? '',
        costs: entry.costs ? {
          food: entry.costs.food ?? 0,
          wood: entry.costs.wood ?? 0,
          stone: entry.costs.stone ?? 0,
          gold: entry.costs.gold ?? 0,
          total: entry.costs.total ?? 0,
          popcap: entry.costs.popcap ?? 0,
          time: entry.costs.time ?? 0,
        } : null,
        age: entry.age ?? 1,
        classes: entry.classes ?? [],
        baseId: entry.baseId ?? entry.id ?? '',
      });
    }

    console.log(`[aoe4-data] Loaded ${entries.length} ${type} entries from ${file}`);
  }

  console.log(`[aoe4-data] Total unique pbgids: ${_lookup.size}`);
  return _lookup;
}

/**
 * Look up a pbgid. Returns undefined if not found.
 */
export function lookupPbgid(pbgid: number): Aoe4Entry | undefined {
  return getAoe4Lookup().get(pbgid);
}

/**
 * Get all known pbgid sets by type (for heuristic matching in parser).
 */
export function getPbgidSets(): {
  buildings: Set<number>;
  units: Set<number>;
  technologies: Set<number>;
} {
  const lookup = getAoe4Lookup();
  const buildings = new Set<number>();
  const units = new Set<number>();
  const technologies = new Set<number>();

  for (const [pbgid, entry] of lookup) {
    switch (entry.type) {
      case 'building': buildings.add(pbgid); break;
      case 'unit': units.add(pbgid); break;
      case 'technology': technologies.add(pbgid); break;
    }
  }

  return { buildings, units, technologies };
}

// ── Classification helpers ────────────────────────────────

export function isAgeUpEvent(entry: Aoe4Entry): { isAgeUp: boolean; targetAge: number } {
  // Method 1: Technology with age_up_upgrade class (Abbasid, Ayyubid, etc.)
  if (entry.type === 'technology' && entry.classes.includes('age_up_upgrade')) {
    // Exclude Abbasid/Ayyubid wing BONUS techs (Industry, Growth, Master Smiths, etc.)
    // These have 'abbasid_wing_upgrade' class and are NOT actual age-ups.
    // The real age-ups are the wing constructions themselves (Culture Wing, Economic Wing, etc.)
    if (entry.classes.includes('abbasid_wing_upgrade')) {
      return { isAgeUp: false, targetAge: 0 };
    }
    if (entry.classes.includes('scar_feudal_age_upgrade')) return { isAgeUp: true, targetAge: 2 };
    if (entry.classes.includes('scar_castle_age_upgrade')) return { isAgeUp: true, targetAge: 3 };
    if (entry.classes.includes('scar_imperial_age_upgrade')) return { isAgeUp: true, targetAge: 4 };
    // Generic age-up without specific age class - infer from age field
    if (entry.age >= 2) return { isAgeUp: true, targetAge: entry.age };
  }
  // Method 2: Building a landmark (most civs age up by constructing landmarks)
  if (entry.type === 'building' && entry.classes.includes('landmark')) {
    if (entry.age >= 2 && entry.age <= 4) return { isAgeUp: true, targetAge: entry.age };
  }
  return { isAgeUp: false, targetAge: 0 };
}

export function isMilitaryUnit(entry: Aoe4Entry): boolean {
  return entry.type === 'unit' && (
    entry.classes.includes('military') ||
    entry.classes.includes('land_military')
  );
}

export function isMilitaryBuilding(entry: Aoe4Entry): boolean {
  return entry.type === 'building' && (
    entry.classes.includes('military_production_building') ||
    entry.classes.includes('scar_barracks') ||
    entry.classes.includes('scar_archeryrange') ||
    entry.classes.includes('scar_stable') ||
    entry.classes.includes('siege_workshop')
  );
}

export function isTownCenter(entry: Aoe4Entry): boolean {
  return entry.type === 'building' && (
    entry.classes.includes('town_center') ||
    entry.classes.includes('scar_town_center')
  );
}

export function isTower(entry: Aoe4Entry): boolean {
  return entry.type === 'building' && (
    entry.classes.includes('tower') ||
    entry.classes.includes('outpost')
  );
}

export function isEconomicBuilding(entry: Aoe4Entry): boolean {
  return entry.type === 'building' && (
    entry.classes.includes('economy_building') ||
    entry.classes.includes('drop_off_building') ||
    entry.classes.includes('house')
  );
}
