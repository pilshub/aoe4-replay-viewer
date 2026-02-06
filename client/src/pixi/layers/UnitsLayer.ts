import * as PIXI from 'pixi.js';
import { OptimizedEntity } from '../../types/replay.types';
import { CoordinateMapper } from '../utils/CoordinateMapper';
import { getPlayerColor } from '../utils/ColorUtils';

/**
 * Renders units as circles with linear interpolation between spawn and death positions.
 */
export class UnitsLayer {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private visible = true;

  constructor() {
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  update(entities: OptimizedEntity[], currentTime: number, mapper: CoordinateMapper): void {
    if (!this.visible) return;

    const g = this.graphics;
    g.clear();

    for (const entity of entities) {
      if (entity.category !== 'unit') continue;
      if (entity.spawnTime > currentTime) continue;
      if (entity.deathTime != null && entity.deathTime <= currentTime) continue;

      const color = getPlayerColor(entity.playerId);

      // Interpolate position
      let normX = entity.spawnX;
      let normY = entity.spawnY;

      if (entity.deathX != null && entity.deathY != null && entity.deathTime != null) {
        const totalDuration = entity.deathTime - entity.spawnTime;
        if (totalDuration > 0) {
          const progress = Math.min(1, Math.max(0,
            (currentTime - entity.spawnTime) / totalDuration
          ));
          normX = entity.spawnX + (entity.deathX - entity.spawnX) * progress;
          normY = entity.spawnY + (entity.deathY - entity.spawnY) * progress;
        }
      }

      const x = mapper.toScreenX(normX);
      const y = mapper.toScreenY(normY);
      const radius = 3;

      g.beginFill(color, 0.85);
      g.drawCircle(x, y, radius);
      g.endFill();
    }
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.container.visible = v;
  }
}
