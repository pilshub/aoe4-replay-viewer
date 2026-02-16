import { computeBounds, normalize } from '../utils/coordinate-normalizer';
import { classifyEntity, EntityCategory } from '../utils/entity-classifier';
import { analyzeMatch, MatchAnalysis } from './strategy-analyzer';
import type { ResourceCosts } from '../data/aoe4-data';

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
}

export interface PlayerInfo {
  playerId: number;
  name: string;
  color: number;
  civ: string;
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

// ── Transformer ───────────────────────────────────────────────

export function transformReplayData(raw: any): TimelineData {
  const players: PlayerInfo[] = [];
  const allRawEntities: Array<any & { _playerId: number }> = [];

  const summary = raw.gameSummary ?? raw;
  const rawPlayers = summary.players ?? summary.Players ?? [];

  for (const p of rawPlayers) {
    const playerId = p.playerId ?? p.PlayerId ?? players.length;
    players.push({
      playerId,
      name: p.playerName ?? p.PlayerName ?? `Player ${playerId + 1}`,
      color: p.playerColor ?? p.PlayerColor ?? playerId,
      civ: p.civ ?? p.Civ ?? 'Unknown',
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

  // Run strategy analysis
  const playerIds = players.map(p => p.playerId);
  const analysis = analyzeMatch(buildOrder, playerIds);

  return {
    metadata: {
      duration,
      players,
      mapName: summary.mapName ?? summary.MapName ?? raw.mapName ?? 'Unknown',
    },
    entities,
    events,
    timeline,
    buildOrder,
    analysis,
  };
}
