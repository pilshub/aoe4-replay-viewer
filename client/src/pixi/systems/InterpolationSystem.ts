import { OptimizedEntity } from '../../types/replay.types';

/**
 * Computes interpolated position for a unit entity at a given time.
 * Uses linear interpolation between spawn and death positions.
 */
export function interpolatePosition(
  entity: OptimizedEntity,
  currentTime: number
): { x: number; y: number } | null {
  // Not yet spawned
  if (entity.spawnTime > currentTime) return null;
  // Already dead
  if (entity.deathTime != null && entity.deathTime <= currentTime) return null;

  // Buildings don't move
  if (entity.category === 'building') {
    return { x: entity.spawnX, y: entity.spawnY };
  }

  // Units: interpolate
  if (entity.deathX != null && entity.deathY != null && entity.deathTime != null) {
    const totalDuration = entity.deathTime - entity.spawnTime;
    if (totalDuration > 0) {
      const progress = (currentTime - entity.spawnTime) / totalDuration;
      const t = Math.min(1, Math.max(0, progress));
      return {
        x: entity.spawnX + (entity.deathX - entity.spawnX) * t,
        y: entity.spawnY + (entity.deathY - entity.spawnY) * t,
      };
    }
  }

  // Unit without death info: stay at spawn
  return { x: entity.spawnX, y: entity.spawnY };
}

/**
 * Smoothed interpolation using ease-in-out for more natural movement.
 */
export function interpolateSmooth(
  entity: OptimizedEntity,
  currentTime: number
): { x: number; y: number } | null {
  if (entity.spawnTime > currentTime) return null;
  if (entity.deathTime != null && entity.deathTime <= currentTime) return null;

  if (entity.category === 'building') {
    return { x: entity.spawnX, y: entity.spawnY };
  }

  if (entity.deathX != null && entity.deathY != null && entity.deathTime != null) {
    const totalDuration = entity.deathTime - entity.spawnTime;
    if (totalDuration > 0) {
      const linear = (currentTime - entity.spawnTime) / totalDuration;
      const t = Math.min(1, Math.max(0, linear));
      // Ease-in-out cubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      return {
        x: entity.spawnX + (entity.deathX - entity.spawnX) * eased,
        y: entity.spawnY + (entity.deathY - entity.spawnY) * eased,
      };
    }
  }

  return { x: entity.spawnX, y: entity.spawnY };
}
