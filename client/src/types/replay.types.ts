export interface TimelineData {
  metadata: ReplayMetadata;
  entities: OptimizedEntity[];
  events: DeathEvent[];
  timeline: Keyframe[];
}

export interface ReplayMetadata {
  duration: number;
  players: PlayerInfo[];
  mapName: string;
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
  category: 'building' | 'unit';
  spawnTime: number;
  spawnX: number;
  spawnY: number;
  deathTime: number | null;
  deathX: number | null;
  deathY: number | null;
  killerId: number | null;
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

// Player color mapping (AoE4 standard colors)
export const PLAYER_COLORS: Record<number, number> = {
  0: 0x3b82f6, // Blue
  1: 0xef4444, // Red
  2: 0xeab308, // Yellow
  3: 0x22c55e, // Green
  4: 0x06b6d4, // Cyan
  5: 0xec4899, // Pink
  6: 0xf97316, // Orange
  7: 0x8b5cf6, // Purple
};

export const PLAYER_COLOR_NAMES: Record<number, string> = {
  0: 'Blue',
  1: 'Red',
  2: 'Yellow',
  3: 'Green',
  4: 'Cyan',
  5: 'Pink',
  6: 'Orange',
  7: 'Purple',
};
