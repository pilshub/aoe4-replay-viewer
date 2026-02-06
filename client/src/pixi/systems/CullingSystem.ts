import { OptimizedEntity } from '../../types/replay.types';
import { CoordinateMapper } from '../utils/CoordinateMapper';

interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Determines which entities are visible within the current viewport.
 * Returns indices of visible entities for efficient rendering.
 */
export function getVisibleEntities(
  entities: OptimizedEntity[],
  currentTime: number,
  mapper: CoordinateMapper,
  viewport: Viewport
): OptimizedEntity[] {
  const margin = 20; // pixels of margin
  const vLeft = viewport.x - margin;
  const vRight = viewport.x + viewport.width + margin;
  const vTop = viewport.y - margin;
  const vBottom = viewport.y + viewport.height + margin;

  return entities.filter((entity) => {
    // Time filter
    if (entity.spawnTime > currentTime) return false;
    if (entity.deathTime != null && entity.deathTime <= currentTime) return false;

    // Position filter (using spawn position for buildings, approximate for units)
    const sx = mapper.toScreenX(entity.spawnX);
    const sy = mapper.toScreenY(entity.spawnY);

    return sx >= vLeft && sx <= vRight && sy >= vTop && sy <= vBottom;
  });
}
