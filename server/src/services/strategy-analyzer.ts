import { isMilitaryUnit, isMilitaryBuilding, isTownCenter, isTower, ResourceCosts } from '../data/aoe4-data';
import type { Aoe4Entry } from '../data/aoe4-data';

// ── Types ─────────────────────────────────────────────────

export type StrategyType =
  | 'Feudal Rush'
  | 'Fast Castle'
  | 'Semi Fast Castle'
  | 'Boom (Double TC)'
  | 'Boom (Trade)'
  | 'Tower Rush'
  | 'Standard';

export interface AgeUpTiming {
  age: number;
  ageName: string;
  time: number;
  landmarkName?: string;
  landmarkIcon?: string;
}

export interface PlayerAnalysis {
  playerId: number;
  strategy: StrategyType;
  strategyConfidence: number;
  strategyReasons: string[];
  ageUpTimings: AgeUpTiming[];
  currentAge: number;
  firstMilitaryUnit: { time: number; name: string; icon: string } | null;
  firstMilitaryBuilding: { time: number; name: string; icon: string } | null;
  unitComposition: Array<{ name: string; icon: string; count: number; baseId: string; displayClass: string }>;
  buildingBreakdown: Array<{ name: string; icon: string; count: number; baseId: string }>;
  resourceSpending: {
    food: number;
    wood: number;
    stone: number;
    gold: number;
    total: number;
    byCategory: { military: number; economic: number; technology: number; buildings: number };
  };
  townCenterCount: number;
  militaryBuildingCount: number;
  totalMilitaryUnits: number;
}

export interface MatchAnalysis {
  players: PlayerAnalysis[];
}

// ── Helpers ───────────────────────────────────────────────

const AGE_NAMES: Record<number, string> = {
  1: 'Dark Age', 2: 'Feudal Age', 3: 'Castle Age', 4: 'Imperial Age',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function sumCosts(costs: (ResourceCosts | null)[]): { food: number; wood: number; stone: number; gold: number; total: number } {
  let food = 0, wood = 0, stone = 0, gold = 0;
  for (const c of costs) {
    if (!c) continue;
    food += c.food;
    wood += c.wood;
    stone += c.stone;
    gold += c.gold;
  }
  return { food, wood, stone, gold, total: food + wood + stone + gold };
}

// Build a fake Aoe4Entry from BuildOrderEvent fields for classification helpers
function asEntry(e: BuildOrderEvent): Aoe4Entry {
  return {
    name: e.name,
    icon: e.icon,
    type: e.eventType === 'construct' ? 'building' : e.eventType === 'build_unit' ? 'unit' : 'technology',
    displayClass: e.displayClass,
    costs: e.costs,
    age: e.age,
    classes: e.classes,
    baseId: e.baseId,
  };
}

// ── Event type from imports ───────────────────────────────
interface BuildOrderEvent {
  time: number;
  playerId: number;
  eventType: 'construct' | 'build_unit' | 'upgrade';
  name: string;
  icon: string;
  displayClass: string;
  costs: ResourceCosts | null;
  age: number;
  classes: string[];
  baseId: string;
  isAgeUp: boolean;
  targetAge: number;
}

// ── Helpers: trade detection ─────────────────────────────

function isTrader(entry: Aoe4Entry): boolean {
  return entry.type === 'unit' && (
    entry.baseId === 'trader' ||
    entry.baseId === 'trade-caravan' ||
    entry.classes.includes('trade_cart') ||
    entry.classes.includes('trade_camel')
  );
}

function isMarket(entry: Aoe4Entry): boolean {
  return entry.type === 'building' && (
    entry.baseId === 'market' ||
    entry.classes.includes('scar_market') ||
    entry.classes.includes('exchange')
  );
}

// ── Strategy classification ───────────────────────────────

interface StrategyInput {
  feudalTime: number;
  castleTime: number;
  earlyMilitaryCount: number;       // military units within 2min of feudal
  feudalMilitaryCount: number;      // military units produced during entire feudal age
  militaryBuildingCount: number;
  townCenterCount: number;
  secondTCTime: number;
  earlyTowerCount: number;
  totalMilitaryUnits: number;
  traderCount: number;
  marketCount: number;
}

function classifyStrategy(input: StrategyInput): { strategy: StrategyType; confidence: number; reasons: string[] } {
  const {
    feudalTime, castleTime, earlyMilitaryCount, feudalMilitaryCount,
    militaryBuildingCount, townCenterCount, secondTCTime,
    earlyTowerCount, totalMilitaryUnits, traderCount, marketCount,
  } = input;

  const scores: Record<StrategyType, number> = {
    'Feudal Rush': 0,
    'Fast Castle': 0,
    'Semi Fast Castle': 0,
    'Boom (Double TC)': 0,
    'Boom (Trade)': 0,
    'Tower Rush': 0,
    'Standard': 0,
  };
  const reasons: string[] = [];

  // --- Feudal Rush ---
  // Aggressive feudal: fast age-up + lots of early military + stays in feudal or very late castle
  if (feudalTime < 300 && feudalTime !== Infinity) {
    scores['Feudal Rush'] += 2;
    reasons.push(`Fast feudal at ${formatTime(feudalTime)}`);
  }
  if (earlyMilitaryCount >= 5 && feudalTime !== Infinity) {
    scores['Feudal Rush'] += 3;
    reasons.push(`${earlyMilitaryCount} military units in early feudal`);
  }
  if (militaryBuildingCount >= 2 && townCenterCount <= 1 && feudalTime !== Infinity) {
    scores['Feudal Rush'] += 1;
  }
  // Key Rush signal: staying in feudal. If player reaches Castle → NOT a pure rush
  if (castleTime === Infinity && totalMilitaryUnits >= 8) {
    scores['Feudal Rush'] += 3; // strong: never left feudal
  } else if (castleTime !== Infinity && castleTime < 780) {
    scores['Feudal Rush'] -= 3; // reached Castle quickly → not a feudal rush
  }

  // --- Fast Castle ---
  // Very few or zero military units in feudal, rushes to Castle Age
  if (castleTime < 780 && castleTime !== Infinity) {
    scores['Fast Castle'] += 2;
    reasons.push(`Castle Age at ${formatTime(castleTime)}`);
  }
  if (earlyMilitaryCount <= 2 && castleTime !== Infinity && castleTime < 780) {
    scores['Fast Castle'] += 3;
    reasons.push('Minimal feudal military');
  }

  // --- Semi Fast Castle ---
  // Gets to Castle Age reasonably fast (<13min) with meaningful feudal military (3+).
  // The distinction from FC is that they produced military. From Rush is that they DID castle up.
  if (castleTime < 780 && castleTime !== Infinity && feudalMilitaryCount >= 3) {
    scores['Semi Fast Castle'] += 3;
    reasons.push(`${feudalMilitaryCount} military units before Castle`);
    reasons.push(`Castle Age at ${formatTime(castleTime)}`);
  }
  if (earlyMilitaryCount >= 3 && castleTime !== Infinity && castleTime < 780) {
    scores['Semi Fast Castle'] += 2;
  }

  // --- Boom (Double TC) ---
  if (secondTCTime < 480 && secondTCTime !== Infinity) { // 2nd TC by 8:00
    scores['Boom (Double TC)'] += 3;
    reasons.push(`2nd TC at ${formatTime(secondTCTime)}`);
  }
  if (townCenterCount >= 3) {
    scores['Boom (Double TC)'] += 2;
    reasons.push(`${townCenterCount} Town Centers`);
  }
  if (earlyMilitaryCount <= 3 && townCenterCount >= 2) {
    scores['Boom (Double TC)'] += 1;
  }

  // --- Boom (Trade) ---
  if (traderCount >= 3) {
    scores['Boom (Trade)'] += 4;
    reasons.push(`${traderCount} traders produced`);
  } else if (traderCount >= 1) {
    scores['Boom (Trade)'] += 2;
    reasons.push(`${traderCount} trader${traderCount > 1 ? 's' : ''} produced`);
  }
  if (marketCount >= 1 && traderCount >= 2) {
    scores['Boom (Trade)'] += 1;
  }

  // --- Tower Rush ---
  if (earlyTowerCount >= 2) {
    scores['Tower Rush'] += 4;
    reasons.push(`${earlyTowerCount} towers before 5:30`);
  } else if (earlyTowerCount === 1) {
    scores['Tower Rush'] += 2;
    reasons.push(`Early tower`);
  }

  // Find best
  let best: StrategyType = 'Standard';
  let bestScore = 0;
  for (const [strat, score] of Object.entries(scores) as [StrategyType, number][]) {
    if (score > bestScore) {
      bestScore = score;
      best = strat;
    }
  }

  if (bestScore < 2) {
    return { strategy: 'Standard', confidence: 0.5, reasons: ['No dominant strategy pattern detected'] };
  }

  return {
    strategy: best,
    confidence: Math.min(bestScore / 6, 1.0),
    reasons: [...new Set(reasons.filter(r => r.length > 0))],  // deduplicate
  };
}

// ── Main analysis ─────────────────────────────────────────

function analyzePlayer(events: BuildOrderEvent[], playerId: number): PlayerAnalysis {
  const playerEvents = events.filter(e => e.playerId === playerId);

  // 1. Age-up timings from age field transitions (more reliable than isAgeUp)
  const sortedEvents = [...playerEvents].sort((a, b) => a.time - b.time);
  const ageUpMap = new Map<number, { time: number; name: string; icon: string }>();
  let prevAge = 1;
  for (const e of sortedEvents) {
    const age = e.age ?? 1;
    if (age > prevAge) {
      if (!ageUpMap.has(age)) {
        ageUpMap.set(age, { time: e.time, name: '', icon: '' });
      }
      prevAge = age;
    }
  }
  // Enrich with landmark names from isAgeUp events
  for (const e of sortedEvents) {
    if (e.isAgeUp && e.targetAge >= 2) {
      const existing = ageUpMap.get(e.targetAge);
      if (existing && !existing.name) {
        existing.name = e.name;
        existing.icon = e.icon;
      }
    }
  }
  const ageUpTimings: AgeUpTiming[] = [];
  for (const [age, info] of [...ageUpMap.entries()].sort((a, b) => a[0] - b[0])) {
    ageUpTimings.push({
      age,
      ageName: AGE_NAMES[age] ?? `Age ${age}`,
      time: info.time,
      landmarkName: info.name,
      landmarkIcon: info.icon,
    });
  }
  const currentAge = ageUpTimings.length > 0 ? Math.max(...ageUpTimings.map(a => a.age)) : 1;

  const feudalTime = ageUpMap.get(2)?.time ?? Infinity;
  const castleTime = ageUpMap.get(3)?.time ?? Infinity;

  // 2. Military analysis
  const militaryUnits = playerEvents.filter(e => e.eventType === 'build_unit' && isMilitaryUnit(asEntry(e)));
  const firstMilUnit = militaryUnits.length > 0 ? militaryUnits[0] : null;

  const militaryBuildings = playerEvents.filter(e => e.eventType === 'construct' && isMilitaryBuilding(asEntry(e)));
  const firstMilBuilding = militaryBuildings.length > 0 ? militaryBuildings[0] : null;

  // Early military = units produced within 2 min of feudal
  const earlyMilitaryCount = feudalTime === Infinity
    ? 0
    : militaryUnits.filter(u => u.time < feudalTime + 120).length;

  // Feudal military = all military units produced before Castle Age
  const feudalMilitaryCount = castleTime === Infinity
    ? militaryUnits.length  // never reached Castle → all military is "feudal"
    : militaryUnits.filter(u => u.time < castleTime).length;

  // 3. Economic analysis
  const townCenters = playerEvents.filter(e => e.eventType === 'construct' && isTownCenter(asEntry(e)));
  const townCenterCount = townCenters.length + 1; // +1 for starting TC
  const secondTCTime = townCenters.length > 0 ? townCenters[0].time : Infinity;

  // 4. Tower analysis
  const towers = playerEvents.filter(e => e.eventType === 'construct' && isTower(asEntry(e)));
  const earlyTowers = towers.filter(t => t.time < 330); // before 5:30

  // 5. Trade analysis
  const traders = playerEvents.filter(e => e.eventType === 'build_unit' && isTrader(asEntry(e)));
  const markets = playerEvents.filter(e => e.eventType === 'construct' && isMarket(asEntry(e)));

  // 6. Strategy classification
  const { strategy, confidence, reasons } = classifyStrategy({
    feudalTime, castleTime, earlyMilitaryCount, feudalMilitaryCount,
    militaryBuildingCount: militaryBuildings.length,
    townCenterCount, secondTCTime,
    earlyTowerCount: earlyTowers.length,
    totalMilitaryUnits: militaryUnits.length,
    traderCount: traders.length,
    marketCount: markets.length,
  });

  // 6. Unit composition (aggregate by baseId)
  const unitMap = new Map<string, { name: string; icon: string; count: number; baseId: string; displayClass: string }>();
  for (const u of militaryUnits) {
    const key = u.baseId || u.name;
    const existing = unitMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      unitMap.set(key, { name: u.name, icon: u.icon, count: 1, baseId: u.baseId, displayClass: u.displayClass });
    }
  }
  const unitComposition = [...unitMap.values()].sort((a, b) => b.count - a.count);

  // 7. Building breakdown
  const buildingMap = new Map<string, { name: string; icon: string; count: number; baseId: string }>();
  const allBuildings = playerEvents.filter(e => e.eventType === 'construct');
  for (const b of allBuildings) {
    const key = b.baseId || b.name;
    const existing = buildingMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      buildingMap.set(key, { name: b.name, icon: b.icon, count: 1, baseId: b.baseId });
    }
  }
  const buildingBreakdown = [...buildingMap.values()].sort((a, b) => b.count - a.count);

  // 8. Resource spending
  const milCosts = sumCosts(militaryUnits.map(u => u.costs));
  const buildCosts = sumCosts(allBuildings.map(b => b.costs));
  const techCosts = sumCosts(playerEvents.filter(e => e.eventType === 'upgrade').map(e => e.costs));
  const allCosts = sumCosts(playerEvents.map(e => e.costs));

  return {
    playerId,
    strategy,
    strategyConfidence: confidence,
    strategyReasons: reasons,
    ageUpTimings,
    currentAge,
    firstMilitaryUnit: firstMilUnit ? { time: firstMilUnit.time, name: firstMilUnit.name, icon: firstMilUnit.icon } : null,
    firstMilitaryBuilding: firstMilBuilding ? { time: firstMilBuilding.time, name: firstMilBuilding.name, icon: firstMilBuilding.icon } : null,
    unitComposition,
    buildingBreakdown,
    resourceSpending: {
      ...allCosts,
      byCategory: {
        military: milCosts.total,
        economic: Math.max(0, buildCosts.total - milCosts.total),
        technology: techCosts.total,
        buildings: buildCosts.total,
      },
    },
    townCenterCount,
    militaryBuildingCount: militaryBuildings.length,
    totalMilitaryUnits: militaryUnits.length,
  };
}

// ── Public API ────────────────────────────────────────────

export function analyzeMatch(buildOrder: BuildOrderEvent[], playerIds: number[]): MatchAnalysis {
  const players = playerIds.map(pid => analyzePlayer(buildOrder, pid));

  for (const p of players) {
    console.log(`[strategy] Player ${p.playerId}: ${p.strategy} (${Math.round(p.strategyConfidence * 100)}%) - ${p.strategyReasons.join('; ')}`);
    if (p.ageUpTimings.length > 0) {
      console.log(`[strategy]   Age-ups: ${p.ageUpTimings.map(a => `${a.ageName} ${formatTime(a.time)}`).join(', ')}`);
    }
    console.log(`[strategy]   Military: ${p.totalMilitaryUnits} units, ${p.militaryBuildingCount} buildings, ${p.townCenterCount} TCs`);
  }

  return { players };
}
