import type { ReplayCommand, BuildOrderEvent } from './replay-parser';
import type { BuildOrderEntry, PlayerInfo } from './transformer.service';
import type { PlayerAnalysis } from './strategy-analyzer';
import { isMilitaryUnit, isMilitaryBuilding, isTownCenter, isVillager, isEconomicBuilding } from '../data/aoe4-data';
import type { Aoe4Entry, ResourceCosts } from '../data/aoe4-data';

// ── Types ─────────────────────────────────────────────────

export interface ProductionTimelinePoint {
  time: number;
  playerId: number;
  villagers: number;
  military: number;
  buildings: number;
  technologies: number;
}

export interface VillagerGap {
  playerId: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface CombatEngagement {
  id: number;
  startTime: number;
  endTime: number;
  centerX: number;
  centerZ: number;
  commandsP1: number;
  commandsP2: number;
  estimatedWinner: number | null;
  intensity: 'low' | 'medium' | 'high';
}

export interface ArmySnapshot {
  time: number;
  playerId: number;
  units: Array<{ name: string; icon: string; count: number; baseId: string }>;
  totalSupply: number;
}

export interface EconomySnapshot {
  time: number;
  playerId: number;
  totalSpent: number;
  militarySpent: number;
  economicSpent: number;
  techSpent: number;
  militaryRatio: number;
}

export interface KeyMoment {
  time: number;
  type: 'age_up' | 'first_military' | 'major_fight' | 'expansion' | 'tech_spike';
  description: string;
  playerId: number;
}

export interface AgePhase {
  ageNumber: number;
  ageName: string;
  playerId: number;
  startTime: number;
  endTime: number;
  landmark: string | null;
  landmarkIcon: string | null;
  villagersProduced: number;
  militaryProduced: number;
  buildingsConstructed: number;
  technologiesResearched: number;
  totalSpent: number;
  militarySpent: number;
  keyUnits: Array<{ name: string; icon: string; count: number }>;
  keyBuildings: Array<{ name: string; icon: string; count: number }>;
  keyTechs: Array<{ name: string; icon: string }>;
}

export interface MatchAnalysisReport {
  productionTimeline: ProductionTimelinePoint[];
  villagerGaps: VillagerGap[];
  combatEngagements: CombatEngagement[];
  armySnapshots: ArmySnapshot[];
  economyTimeline: EconomySnapshot[];
  keyMoments: KeyMoment[];
  agePhases: AgePhase[];
}

// ── Helpers ───────────────────────────────────────────────

function asEntry(e: BuildOrderEntry): Aoe4Entry {
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Production Timeline ───────────────────────────────────

function buildProductionTimeline(
  buildOrder: BuildOrderEntry[],
  playerIds: number[],
  duration: number,
): ProductionTimelinePoint[] {
  const BUCKET_SIZE = 30;
  const points: ProductionTimelinePoint[] = [];

  for (const pid of playerIds) {
    const playerEvents = buildOrder.filter(e => e.playerId === pid);
    let villagers = 0;
    let military = 0;
    let buildings = 0;
    let technologies = 0;
    let eventIdx = 0;

    for (let t = 0; t <= duration; t += BUCKET_SIZE) {
      while (eventIdx < playerEvents.length && playerEvents[eventIdx].time <= t) {
        const e = playerEvents[eventIdx];
        const entry = asEntry(e);
        if (e.eventType === 'build_unit') {
          if (isVillager(entry)) villagers++;
          else if (isMilitaryUnit(entry)) military++;
        } else if (e.eventType === 'construct') {
          buildings++;
        } else if (e.eventType === 'upgrade') {
          technologies++;
        }
        eventIdx++;
      }
      points.push({ time: t, playerId: pid, villagers, military, buildings, technologies });
    }
  }

  return points;
}

// ── Villager Gap Detection ────────────────────────────────

const DEFAULT_VILLAGER_TRAIN_TIME = 20;
const VILLAGER_GAP_THRESHOLD = 25;

function detectVillagerGaps(
  buildOrder: BuildOrderEntry[],
  playerIds: number[],
): VillagerGap[] {
  const gaps: VillagerGap[] = [];

  for (const pid of playerIds) {
    const vilEvents = buildOrder
      .filter(e => e.playerId === pid && e.eventType === 'build_unit' && isVillager(asEntry(e)))
      .sort((a, b) => a.time - b.time);

    for (let i = 0; i < vilEvents.length - 1; i++) {
      const trainTime = vilEvents[i].costs?.time ?? DEFAULT_VILLAGER_TRAIN_TIME;
      const expectedNext = vilEvents[i].time + trainTime;
      const actualNext = vilEvents[i + 1].time;
      const gap = actualNext - expectedNext;

      if (gap > VILLAGER_GAP_THRESHOLD) {
        gaps.push({
          playerId: pid,
          startTime: expectedNext,
          endTime: actualNext,
          duration: gap,
        });
      }
    }
  }

  return gaps.sort((a, b) => a.startTime - b.startTime);
}

// ── Combat Detection ──────────────────────────────────────

const CMD_ATTACK_MOVE = 71;
const CMD_ATTACK_GROUND = 67;
const COMBAT_TIME_WINDOW = 15;
const COMBAT_SPACE_WINDOW = 50;

function detectCombatEngagements(
  commands: ReplayCommand[],
  playerIds: number[],
): CombatEngagement[] {
  const combatCmds = commands
    .filter(c => (c.cmdType === CMD_ATTACK_MOVE || c.cmdType === CMD_ATTACK_GROUND) && playerIds.includes(c.playerId))
    .sort((a, b) => a.time - b.time);

  if (combatCmds.length === 0) return [];

  // Cluster by time + space proximity
  const clusters: ReplayCommand[][] = [];
  let current: ReplayCommand[] = [combatCmds[0]];

  for (let i = 1; i < combatCmds.length; i++) {
    const cmd = combatCmds[i];
    const last = current[current.length - 1];
    const timeDiff = cmd.time - last.time;
    const spaceDiff = Math.sqrt((cmd.x - last.x) ** 2 + (cmd.z - last.z) ** 2);

    if (timeDiff <= COMBAT_TIME_WINDOW && spaceDiff <= COMBAT_SPACE_WINDOW) {
      current.push(cmd);
    } else {
      if (current.length >= 3) clusters.push(current);
      current = [cmd];
    }
  }
  if (current.length >= 3) clusters.push(current);

  return clusters.map((cluster, idx) => {
    const startTime = cluster[0].time;
    const endTime = cluster[cluster.length - 1].time;
    const centerX = cluster.reduce((s, c) => s + c.x, 0) / cluster.length;
    const centerZ = cluster.reduce((s, c) => s + c.z, 0) / cluster.length;

    const p1 = playerIds[0];
    const p2 = playerIds[1];
    const cmdsP1 = cluster.filter(c => c.playerId === p1).reduce((s, c) => s + c.unitCount, 0);
    const cmdsP2 = cluster.filter(c => c.playerId === p2).reduce((s, c) => s + c.unitCount, 0);

    const totalCmds = cluster.length;
    const intensity: CombatEngagement['intensity'] =
      totalCmds >= 30 ? 'high' : totalCmds >= 10 ? 'medium' : 'low';

    let estimatedWinner: number | null = null;
    if (cmdsP1 > cmdsP2 * 1.3) estimatedWinner = p1;
    else if (cmdsP2 > cmdsP1 * 1.3) estimatedWinner = p2;

    return { id: idx, startTime, endTime, centerX, centerZ, commandsP1: cmdsP1, commandsP2: cmdsP2, estimatedWinner, intensity };
  });
}

// ── Army Snapshots ────────────────────────────────────────

function buildArmySnapshots(
  buildOrder: BuildOrderEntry[],
  playerIds: number[],
  keyTimes: number[],
): ArmySnapshot[] {
  const snapshots: ArmySnapshot[] = [];

  for (const pid of playerIds) {
    const milEvents = buildOrder
      .filter(e => e.playerId === pid && e.eventType === 'build_unit' && isMilitaryUnit(asEntry(e)))
      .sort((a, b) => a.time - b.time);

    for (const t of keyTimes) {
      const unitMap = new Map<string, { name: string; icon: string; count: number; baseId: string }>();
      let totalSupply = 0;

      for (const e of milEvents) {
        if (e.time > t) break;
        const key = e.baseId || e.name;
        const existing = unitMap.get(key);
        if (existing) existing.count++;
        else unitMap.set(key, { name: e.name, icon: e.icon, count: 1, baseId: e.baseId });
        totalSupply += e.costs?.popcap ?? 1;
      }

      snapshots.push({
        time: t,
        playerId: pid,
        units: [...unitMap.values()].sort((a, b) => b.count - a.count),
        totalSupply,
      });
    }
  }

  return snapshots;
}

// ── Economy Timeline ──────────────────────────────────────

function buildEconomyTimeline(
  buildOrder: BuildOrderEntry[],
  playerIds: number[],
  duration: number,
): EconomySnapshot[] {
  const BUCKET_SIZE = 30;
  const snapshots: EconomySnapshot[] = [];

  for (const pid of playerIds) {
    const playerEvents = buildOrder.filter(e => e.playerId === pid);
    let totalSpent = 0;
    let militarySpent = 0;
    let economicSpent = 0;
    let techSpent = 0;
    let eventIdx = 0;

    for (let t = 0; t <= duration; t += BUCKET_SIZE) {
      while (eventIdx < playerEvents.length && playerEvents[eventIdx].time <= t) {
        const e = playerEvents[eventIdx];
        const cost = e.costs?.total ?? 0;
        totalSpent += cost;

        const entry = asEntry(e);
        if (e.eventType === 'build_unit' && isMilitaryUnit(entry)) {
          militarySpent += cost;
        } else if (e.eventType === 'upgrade') {
          techSpent += cost;
        } else {
          economicSpent += cost;
        }
        eventIdx++;
      }

      snapshots.push({
        time: t,
        playerId: pid,
        totalSpent,
        militarySpent,
        economicSpent,
        techSpent,
        militaryRatio: totalSpent > 0 ? militarySpent / totalSpent : 0,
      });
    }
  }

  return snapshots;
}

// ── Key Moments ───────────────────────────────────────────

function detectKeyMoments(
  buildOrder: BuildOrderEntry[],
  combatEngagements: CombatEngagement[],
  playerIds: number[],
): KeyMoment[] {
  const moments: KeyMoment[] = [];

  // Age-ups: detect from age field transitions (more reliable than isAgeUp)
  for (const pid of playerIds) {
    const playerBO = buildOrder
      .filter(e => e.playerId === pid)
      .sort((a, b) => a.time - b.time);
    let prevAge = 1;
    for (const e of playerBO) {
      const age = e.age ?? 1;
      if (age > prevAge) {
        moments.push({
          time: e.time,
          type: 'age_up',
          description: `Player ${pid + 1} ages up to ${AGE_NAMES[age] || `Age ${age}`}`,
          playerId: pid,
        });
        prevAge = age;
      }
    }
  }

  // First military unit per player
  for (const pid of playerIds) {
    const firstMil = buildOrder.find(e =>
      e.playerId === pid && e.eventType === 'build_unit' && isMilitaryUnit(asEntry(e))
    );
    if (firstMil) {
      moments.push({
        time: firstMil.time,
        type: 'first_military',
        description: `Player ${pid + 1} trains first military unit: ${firstMil.name}`,
        playerId: pid,
      });
    }
  }

  // Major fights
  for (const fight of combatEngagements) {
    if (fight.intensity === 'high' || fight.intensity === 'medium') {
      const winner = fight.estimatedWinner != null
        ? `Player ${fight.estimatedWinner + 1} likely wins`
        : 'Close fight';
      moments.push({
        time: fight.startTime,
        type: 'major_fight',
        description: `Major engagement at ${formatTime(fight.startTime)} (${fight.commandsP1} vs ${fight.commandsP2} units). ${winner}`,
        playerId: fight.estimatedWinner ?? playerIds[0],
      });
    }
  }

  // TC expansions
  for (const e of buildOrder) {
    if (e.eventType === 'construct' && isTownCenter(asEntry(e))) {
      moments.push({
        time: e.time,
        type: 'expansion',
        description: `Player ${e.playerId + 1} builds a new Town Center`,
        playerId: e.playerId,
      });
    }
  }

  // Tech spikes (3+ techs in 30s)
  for (const pid of playerIds) {
    const techs = buildOrder
      .filter(e => e.playerId === pid && e.eventType === 'upgrade')
      .sort((a, b) => a.time - b.time);
    for (let i = 0; i < techs.length - 2; i++) {
      if (techs[i + 2].time - techs[i].time < 30) {
        moments.push({
          time: techs[i].time,
          type: 'tech_spike',
          description: `Player ${pid + 1} researches 3+ technologies rapidly`,
          playerId: pid,
        });
        // Skip ahead to avoid duplicates
        while (i < techs.length - 3 && techs[i + 3].time - techs[i + 1].time < 30) i++;
      }
    }
  }

  return moments.sort((a, b) => a.time - b.time);
}

// ── Age Phase Analysis ────────────────────────────────────

const AGE_NAMES = ['', 'Dark Age', 'Feudal Age', 'Castle Age', 'Imperial Age'];

function buildAgePhases(
  buildOrder: BuildOrderEntry[],
  playerIds: number[],
  duration: number,
): AgePhase[] {
  const phases: AgePhase[] = [];

  for (const pid of playerIds) {
    const playerEvents = buildOrder
      .filter(e => e.playerId === pid)
      .sort((a, b) => a.time - b.time);

    // Detect age transitions from the age field on build order entries.
    // The `age` field on each event reflects what age the unit/building REQUIRES,
    // so the first event at age=2 means the player is already in Feudal.
    // This is MORE RELIABLE than isAgeUp events, which can fire late (e.g. landmark
    // construction finishes after the player already aged up).
    const ageTransitions = new Map<number, { time: number; landmark: string | null; landmarkIcon: string | null }>();
    ageTransitions.set(1, { time: 0, landmark: null, landmarkIcon: null });

    // Primary source: first event at each new age value
    let prevAge = 1;
    for (const e of playerEvents) {
      const age = e.age ?? 1;
      if (age > prevAge) {
        if (!ageTransitions.has(age)) {
          ageTransitions.set(age, { time: e.time, landmark: null, landmarkIcon: null });
        }
        prevAge = age;
      }
    }

    // Enrich with landmark names from isAgeUp events (but do NOT override timing)
    for (const e of playerEvents) {
      if (e.isAgeUp && e.targetAge >= 2) {
        const existing = ageTransitions.get(e.targetAge);
        if (existing && !existing.landmark) {
          existing.landmark = e.name;
          existing.landmarkIcon = e.icon;
        }
      }
    }

    const maxAge = Math.max(...ageTransitions.keys());

    for (let age = 1; age <= maxAge; age++) {
      const transition = ageTransitions.get(age);
      const startTime = transition?.time ?? 0;
      const nextAge = age + 1;
      const endTime = ageTransitions.has(nextAge) ? ageTransitions.get(nextAge)!.time : duration;

      // Group events by TIME window (not by e.age, which is the unit's age requirement)
      const ageEvents = playerEvents.filter(e => e.time >= startTime && e.time < endTime);

      let villagersProduced = 0;
      let militaryProduced = 0;
      let buildingsConstructed = 0;
      let technologiesResearched = 0;
      let totalSpent = 0;
      let militarySpent = 0;

      const unitMap = new Map<string, { name: string; icon: string; count: number }>();
      const buildingMap = new Map<string, { name: string; icon: string; count: number }>();
      const techs: Array<{ name: string; icon: string }> = [];

      for (const e of ageEvents) {
        const entry = asEntry(e);
        const cost = e.costs?.total ?? 0;
        totalSpent += cost;

        if (e.eventType === 'build_unit') {
          if (isVillager(entry)) {
            villagersProduced++;
          } else if (isMilitaryUnit(entry)) {
            militaryProduced++;
            militarySpent += cost;
            const key = e.baseId || e.name;
            const existing = unitMap.get(key);
            if (existing) existing.count++;
            else unitMap.set(key, { name: e.name, icon: e.icon, count: 1 });
          }
        } else if (e.eventType === 'construct') {
          buildingsConstructed++;
          const key = e.baseId || e.name;
          const existing = buildingMap.get(key);
          if (existing) existing.count++;
          else buildingMap.set(key, { name: e.name, icon: e.icon, count: 1 });
        } else if (e.eventType === 'upgrade') {
          technologiesResearched++;
          techs.push({ name: e.name, icon: e.icon });
        }
      }

      phases.push({
        ageNumber: age,
        ageName: AGE_NAMES[age] || `Age ${age}`,
        playerId: pid,
        startTime,
        endTime,
        landmark: transition?.landmark ?? null,
        landmarkIcon: transition?.landmarkIcon ?? null,
        villagersProduced,
        militaryProduced,
        buildingsConstructed,
        technologiesResearched,
        totalSpent,
        militarySpent,
        keyUnits: [...unitMap.values()].sort((a, b) => b.count - a.count).slice(0, 5),
        keyBuildings: [...buildingMap.values()].sort((a, b) => b.count - a.count).slice(0, 5),
        keyTechs: techs.slice(0, 5),
      });
    }
  }

  return phases.sort((a, b) => a.ageNumber - b.ageNumber || a.playerId - b.playerId);
}

// ── Public API ────────────────────────────────────────────

export function analyzeMatchDeep(
  buildOrder: BuildOrderEntry[],
  commands: ReplayCommand[],
  playerIds: number[],
  duration: number,
): MatchAnalysisReport {
  const productionTimeline = buildProductionTimeline(buildOrder, playerIds, duration);
  const villagerGaps = detectVillagerGaps(buildOrder, playerIds);
  const combatEngagements = detectCombatEngagements(commands, playerIds);
  const economyTimeline = buildEconomyTimeline(buildOrder, playerIds, duration);
  const keyMoments = detectKeyMoments(buildOrder, combatEngagements, playerIds);
  const agePhases = buildAgePhases(buildOrder, playerIds, duration);

  // Army snapshots at key times: age-ups, major fights, and every 2 minutes
  const keyTimes = new Set<number>();
  for (let t = 120; t <= duration; t += 120) keyTimes.add(t);
  for (const m of keyMoments) keyTimes.add(m.time);
  const sortedKeyTimes = [...keyTimes].sort((a, b) => a - b);

  const armySnapshots = buildArmySnapshots(buildOrder, playerIds, sortedKeyTimes);

  console.log(`[match-analyzer] Production: ${productionTimeline.length} points, Villager gaps: ${villagerGaps.length}, Combats: ${combatEngagements.length}, Key moments: ${keyMoments.length}, Age phases: ${agePhases.length}`);

  return {
    productionTimeline,
    villagerGaps,
    combatEngagements,
    armySnapshots,
    economyTimeline,
    keyMoments,
    agePhases,
  };
}
