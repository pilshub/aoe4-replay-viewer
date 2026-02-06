import * as PIXI from 'pixi.js';
import { OptimizedEntity } from '../../types/replay.types';
import { getPlayerColor } from '../utils/ColorUtils';

/**
 * Individual unit sprite for potential future use with ParticleContainer.
 */
export class UnitSprite {
  public sprite: PIXI.Graphics;
  public entity: OptimizedEntity;

  constructor(entity: OptimizedEntity) {
    this.entity = entity;
    this.sprite = new PIXI.Graphics();
    const color = getPlayerColor(entity.playerId);

    this.sprite.beginFill(color, 0.85);
    this.sprite.drawCircle(0, 0, 3);
    this.sprite.endFill();
  }

  /**
   * Update position based on current time using linear interpolation.
   */
  updatePosition(currentTime: number, toScreenX: (n: number) => number, toScreenY: (n: number) => number): void {
    const e = this.entity;
    let nx = e.spawnX;
    let ny = e.spawnY;

    if (e.deathX != null && e.deathY != null && e.deathTime != null) {
      const duration = e.deathTime - e.spawnTime;
      if (duration > 0) {
        const progress = Math.min(1, Math.max(0, (currentTime - e.spawnTime) / duration));
        nx = e.spawnX + (e.deathX - e.spawnX) * progress;
        ny = e.spawnY + (e.deathY - e.spawnY) * progress;
      }
    }

    this.sprite.position.set(toScreenX(nx), toScreenY(ny));
  }

  setVisible(visible: boolean): void {
    this.sprite.visible = visible;
  }
}
