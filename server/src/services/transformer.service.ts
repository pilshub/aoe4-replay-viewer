import { computeBounds, normalize } from '../utils/coordinate-normalizer';
import { classifyEntity, EntityCategory } from '../utils/entity-classifier';
import { analyzeMatch, MatchAnalysis } from './strategy-analyzer';
import { analyzeMatchDeep, MatchAnalysisReport } from './match-analyzer';
import { generateMatchNarrative } from './ai-narrator';
import { inferCivilization, type ResourceCosts } from '../data/aoe4-data';
import type { ReplaySummaryData } from './summary-parser';

// ── Output types ──────────────────────────────────────────────

export interface BuildOrderEntry {
  time: number;
  playerId: number;
  eventType: 'construct' | 'build_unit' | 'upgrade';
  name: string;
  icon: string;
  displayClass: string;
  costs: ResourceCosts | null;
  age: number;
  baseId: string;
  isAgeUp: boolean;
  targetAge: number;
  classes: string[];
}

export interface DeepAnalysis extends MatchAnalysisReport {
  narrative: string | null;
}

export interface TimelineData {
  metadata: {
    duration: number;
    players: PlayerInfo[];
    mapName: string;
  };
  entities: OptimizedEntity[];
  events: DeathEvent[];
  timeline: Keyframe[];
  buildOrder: BuildOrderEntry[];
  analysis: MatchAnalysis;
  deepAnalysis: DeepAnalysis;
  summaryData: ReplaySummaryData | null;
}

export interface PlayerInfo {
  playerId: number;
  name: string;
  color: number;
  civ: string;
  civFlag: string;
  outcome: string;
}

export interface OptimizedEntity {
  id: string;
  playerId: number;
  type: string;
  category: EntityCategory;
  spawnTime: number;
  spawnX: number;
  spawnY: number;
  deathTime: number | null;
  deathX: number | null;
  deathY: number | null;
  killerId: number | null;
  unitCount: number;
}

export interface DeathEvent {
  entityId: string;
  playerId: number;
  time: number;
  x: number;
  y: number;
  type: string;
}

export interface Keyframe {
  time: number;
  entityCount: number;
  buildingCount: number;
  unitCount: number;
}

// Map aoe4world civ slugs to flag icon URLs
const CIV_FLAGS: Record<string, string> = {
  english: 'https://static.aoe4world.com/assets/flags/english-8c6c905d0eb11d6d314b9810b2a0b9c09eec69afb38934f55b329df36468daf2.png',
  french: 'https://static.aoe4world.com/assets/flags/french-c3474adb98d8835fb5a86b3988d6b963a1ac2a8327d136b11fb0fd0537b45594.png',
  holy_roman_empire: 'https://static.aoe4world.com/assets/flags/holy_roman_empire-fc0be4151234fc9ac8f83e10c83b4befe79f22f7a8f6ec1ff03745d61adddb4c.png',
  abbasid_dynasty: 'https://static.aoe4world.com/assets/flags/abbasid_dynasty-b722e3e4ee862226395c692e73cd14c18bc96c3469874d2e0d918305c70f8a69.png',
  delhi_sultanate: 'https://static.aoe4world.com/assets/flags/delhi_sultanate-7f92025d0623b8e224533d9f28b9cd7c51a5ff416ef3edaf7cc3e948ee290708.png',
  chinese: 'https://static.aoe4world.com/assets/flags/chinese-2d4edb3d7fc7ab5e1e2df43bd644aba4d63992be5a2110ba3163a4907d0f3d4e.png',
  rus: 'https://static.aoe4world.com/assets/flags/rus-cb31fb6f8663187f63136cb2523422a07161c792de27852bdc37f0aa1b74911b.png',
  mongols: 'https://static.aoe4world.com/assets/flags/mongols-7ce0478ab2ca1f95d0d879fecaeb94119629538e951002ac6cb936433c575105.png',
  ottomans: 'https://static.aoe4world.com/assets/flags/ottomans-83c752dcbe46ad980f6f65dd719b060f8fa2d0707ab8e2ddb1ae5d468fc019a2.png',
  malians: 'https://static.aoe4world.com/assets/flags/malians-edb6f54659da3f9d0c5c51692fd4b0b1619850be429d67dbe9c3a9d53ab17ddd.png',
  byzantines: 'https://static.aoe4world.com/assets/flags/byzantines-cfe0492a2ed33b486946a92063989a9500ae54d9301178ee55ba6b4d4c7ceb84.png',
  japanese: 'https://static.aoe4world.com/assets/flags/japanese-16a9b5bae87a5494d5a002cf7a2c2c5de5cead128a965cbf3a89eeee8292b997.png',
  ayyubids: 'https://static.aoe4world.com/assets/flags/ayyubids-9ba464806c83e293ac43e19e55dddb80f1fba7b7f5bcb6f7e53b48c4b9c83c9e.png',
  jeanne_darc: 'https://static.aoe4world.com/assets/flags/jeanne_darc-aeec47c19181d6af7b08a015e8a109853d7169d02494b25208d3581e38d022eb.png',
  order_of_the_dragon: 'https://static.aoe4world.com/assets/flags/order_of_the_dragon-cad6fa9212fd59f9b52aaa83b4a6173f07734d38d37200f976bcd46827667424.png',
  zhu_xis_legacy: 'https://static.aoe4world.com/assets/flags/zhu_xis_legacy-c4d119a5fc11f2355f41d206a8b65bea8bab2286d09523a81b7d662d1aad0762.png',
  sengoku_daimyo: 'https://static.aoe4world.com/assets/flags/sengoku_daimyo-ec63e1dbe8500527716f522b0ca957ec63a337a80fa2abf26d89b278b356c45b.png',
  golden_horde: 'https://static.aoe4world.com/assets/flags/golden_horde-3a689fad37debd619c57df4b2f82c57e12b9ad3055c1f2722bd1b2e318d11c0d.png',
  macedonian_dynasty: 'https://static.aoe4world.com/assets/flags/macedonian_dynasty-f1e76e7a33d34312ca9fb0c2efaf51bacbba8899cc308f3b08bcdd3ba931c7ff.png',
  tughlaq_dynasty: 'https://static.aoe4world.com/assets/flags/tughlaq_dynasty-0fb44a8770b846a0c4a82db577d50dbf011191d594ce93e7bb780bb7ee5becff.png',
  house_of_lancaster: 'https://static.aoe4world.com/assets/flags/house_of_lancaster-eb59b86336771c7ab996d411a9d12d71045b3639b06753301fde4a3a675b5d40.png',
  knights_templar: 'https://static.aoe4world.com/assets/flags/knights_templar-939b2e79f7a74d99f2cf75756efc9d1db17fd344fbbc86c9bd8c411ef78b2350.png',
};

// Map aoe4world civ slugs to display names
const CIV_DISPLAY_NAMES: Record<string, string> = {
  english: 'English', french: 'French', chinese: 'Chinese', mongols: 'Mongols',
  rus: 'Rus', delhi_sultanate: 'Delhi Sultanate', abbasid_dynasty: 'Abbasid Dynasty',
  holy_roman_empire: 'Holy Roman Empire', ottomans: 'Ottomans', malians: 'Malians',
  byzantines: 'Byzantines', japanese: 'Japanese', ayyubids: 'Ayyubids',
  jeanne_darc: "Jeanne d'Arc", order_of_the_dragon: 'Order of the Dragon',
  zhu_xis_legacy: "Zhu Xi's Legacy", sengoku_daimyo: 'Sengoku',
  varangian_guard: 'Varangian Guard', golden_horde: 'Golden Horde',
  knights_hospitaller: 'Knights Hospitaller', house_of_lancaster: 'House of Lancaster',
  tughra_dynasty: 'Tughra Dynasty',
};

function normalizeCivName(raw: string): string {
  if (!raw || raw === 'Unknown') return raw;
  return CIV_DISPLAY_NAMES[raw.toLowerCase()] ?? raw;
}

// ── Transformer ───────────────────────────────────────────────

export async function transformReplayData(raw: any, language: string = 'en'): Promise<TimelineData> {
  const players: PlayerInfo[] = [];
  const allRawEntities: Array<any & { _playerId: number }> = [];

  const summary = raw.gameSummary ?? raw;
  const rawPlayers = summary.players ?? summary.Players ?? [];

  for (const p of rawPlayers) {
    const playerId = p.playerId ?? p.PlayerId ?? players.length;
    const rawCiv = (p.civ ?? p.Civ ?? 'Unknown').toLowerCase();
    players.push({
      playerId,
      name: p.playerName ?? p.PlayerName ?? `Player ${playerId + 1}`,
      color: p.playerColor ?? p.PlayerColor ?? playerId,
      civ: normalizeCivName(p.civ ?? p.Civ ?? 'Unknown'),
      civFlag: CIV_FLAGS[rawCiv] ?? '',
      outcome: p.outcome ?? p.Outcome ?? 'unknown',
    });

    const units = p.units ?? p.Units ?? [];
    const startingUnits = p.startingUnits ?? p.StartingUnits ?? [];
    const entities = p.entities ?? p.Entities ?? [...startingUnits, ...units];
    for (const e of entities) {
      allRawEntities.push({ ...e, _playerId: playerId });
    }
  }

  const replaySummary = raw.replaySummary ?? {};
  const dataSTLS = replaySummary.dataSTLS ?? {};
  let duration = summary.duration ?? summary.Duration ?? dataSTLS.gameLength ?? 0;
  if (duration === 0) {
    for (const e of allRawEntities) {
      const dt = e.DeathTimestamp ?? e.deathTimestamp ?? 0;
      const st = e.SpawnTimestamp ?? e.spawnTimestamp ?? 0;
      if (dt > duration) duration = dt;
      if (st > duration) duration = st;
    }
  }

  const bounds = computeBounds(
    allRawEntities.map(e => ({
      SpawnX: e.SpawnX ?? e.spawnX,
      SpawnY: e.SpawnY ?? e.spawnY,
      DeathX: e.DeathX ?? e.deathX,
      DeathY: e.DeathY ?? e.deathY,
    }))
  );

  const entities: OptimizedEntity[] = [];
  const events: DeathEvent[] = [];

  for (const e of allRawEntities) {
    const spawnX = e.SpawnX ?? e.spawnX ?? 0;
    const spawnY = e.SpawnY ?? e.spawnY ?? 0;
    const deathX = e.DeathX ?? e.deathX;
    const deathY = e.DeathY ?? e.deathY;
    const spawnTime = e.SpawnTimestamp ?? e.spawnTimestamp ?? 0;
    const deathTime = e.DeathTimestamp ?? e.deathTimestamp;
    const entityType = e.EntityType ?? e.entityType ?? 'unknown';
    const category = classifyEntity(e.Category ?? e.category, entityType);
    const id = `${e._playerId}-${e.Id ?? e.id ?? entities.length}`;

    const normalized: OptimizedEntity = {
      id,
      playerId: e._playerId,
      type: entityType,
      category,
      spawnTime,
      spawnX: normalize(spawnX, bounds.minX, bounds.maxX),
      spawnY: normalize(spawnY, bounds.minY, bounds.maxY),
      deathTime: deathTime ?? null,
      deathX: deathX != null ? normalize(deathX, bounds.minX, bounds.maxX) : null,
      deathY: deathY != null ? normalize(deathY, bounds.minY, bounds.maxY) : null,
      killerId: e.KillerId ?? e.killerId ?? null,
      unitCount: e.unitCount ?? e.UnitCount ?? 1,
    };

    entities.push(normalized);

    if (deathTime != null && deathX != null && deathY != null) {
      events.push({
        entityId: id,
        playerId: e._playerId,
        time: deathTime,
        x: normalized.deathX!,
        y: normalized.deathY!,
        type: entityType,
      });
    }
  }

  entities.sort((a, b) => a.spawnTime - b.spawnTime);
  events.sort((a, b) => a.time - b.time);

  const timeline: Keyframe[] = [];
  const step = 10;
  for (let t = 0; t <= duration; t += step) {
    let entityCount = 0;
    let buildingCount = 0;
    let unitCount = 0;
    for (const e of entities) {
      if (e.spawnTime <= t && (e.deathTime == null || e.deathTime > t)) {
        entityCount++;
        if (e.category === 'building') buildingCount++;
        else unitCount++;
      }
    }
    timeline.push({ time: t, entityCount, buildingCount, unitCount });
  }

  // Transform build order events with enriched data
  const rawBuildOrder = raw.buildOrderEvents ?? [];

  // Determine PLAS ID → sequential ID mapping
  const plasIds = rawBuildOrder.map((e: any) => e.playerId);
  const uniquePlasIds = [...new Set(plasIds)].sort() as number[];

  const buildOrder: BuildOrderEntry[] = rawBuildOrder.map((e: any) => {
    const idx = uniquePlasIds.indexOf(e.playerId);
    return {
      time: e.time,
      playerId: idx >= 0 ? idx : e.playerId,
      eventType: e.eventType,
      name: e.name,
      icon: e.icon,
      displayClass: e.displayClass ?? '',
      costs: e.costs ?? null,
      age: e.age ?? 1,
      baseId: e.baseId ?? '',
      isAgeUp: e.isAgeUp ?? false,
      targetAge: e.targetAge ?? 0,
      classes: e.classes ?? [],
    };
  });

  // Infer civilizations from build order if not set by metadata
  for (const player of players) {
    if (!player.civ || player.civ === 'Unknown') {
      const playerBaseIds = buildOrder
        .filter(e => e.playerId === player.playerId)
        .map(e => e.baseId)
        .filter(Boolean);
      const inferred = inferCivilization(playerBaseIds);
      if (inferred) {
        player.civ = inferred;
        console.log(`[transformer] Inferred civ for player ${player.playerId}: ${inferred}`);
      }
    }
  }

  // Run strategy analysis
  const playerIds = players.map(p => p.playerId);
  const analysis = analyzeMatch(buildOrder, playerIds);

  // Run deep match analysis (algorithmic)
  const rawCommands = raw.commands ?? [];
  // Remap command playerIds the same way as build order
  const remappedCommands = rawCommands.map((c: any) => ({
    ...c,
    playerId: Math.max(0, uniquePlasIds.indexOf(c.playerId)),
  }));
  const report = analyzeMatchDeep(buildOrder, remappedCommands, playerIds, duration);

  // Extract summary data from binary replay (rich stats, timelines, kills)
  const summaryData = raw.summaryData ?? null;

  // Generate AI narrative (pass summaryData for richer analysis)
  const mapName = summary.mapName ?? summary.MapName ?? raw.mapName ?? 'Unknown';
  const narrative = await generateMatchNarrative(
    report, analysis.players, players, duration, mapName, language, summaryData,
  );

  return {
    metadata: {
      duration,
      players,
      mapName,
    },
    entities,
    events,
    timeline,
    buildOrder,
    analysis,
    deepAnalysis: { ...report, narrative },
    summaryData,
  };
}
