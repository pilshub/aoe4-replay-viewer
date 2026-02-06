export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Compute bounding box from all entity coordinates with padding.
 */
export function computeBounds(
  entities: Array<{ SpawnX?: number; SpawnY?: number; DeathX?: number; DeathY?: number }>
): Bounds {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const e of entities) {
    if (e.SpawnX != null && e.SpawnY != null) {
      if (e.SpawnX < minX) minX = e.SpawnX;
      if (e.SpawnX > maxX) maxX = e.SpawnX;
      if (e.SpawnY < minY) minY = e.SpawnY;
      if (e.SpawnY > maxY) maxY = e.SpawnY;
    }
    if (e.DeathX != null && e.DeathY != null) {
      if (e.DeathX < minX) minX = e.DeathX;
      if (e.DeathX > maxX) maxX = e.DeathX;
      if (e.DeathY < minY) minY = e.DeathY;
      if (e.DeathY > maxY) maxY = e.DeathY;
    }
  }

  // Add 10% padding
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const padX = rangeX * 0.1;
  const padY = rangeY * 0.1;

  return {
    minX: minX - padX,
    maxX: maxX + padX,
    minY: minY - padY,
    maxY: maxY + padY,
  };
}

/**
 * Normalize a coordinate to 0-1 range given bounds.
 */
export function normalize(value: number, min: number, max: number): number {
  const range = max - min;
  if (range === 0) return 0.5;
  return (value - min) / range;
}
