import * as PIXI from 'pixi.js';
import { OptimizedEntity } from '../../types/replay.types';
import { getPlayerColor } from '../utils/ColorUtils';

/**
 * Individual building sprite for potential future use with ParticleContainer.
 */
export class BuildingSprite {
  public sprite: PIXI.Graphics;
  public entity: OptimizedEntity;

  constructor(entity: OptimizedEntity) {
    this.entity = entity;
    this.sprite = new PIXI.Graphics();
    const color = getPlayerColor(entity.playerId);
    const size = 6;

    this.sprite.beginFill(color, 0.9);
    this.sprite.drawRect(-size / 2, -size / 2, size, size);
    this.sprite.endFill();
    this.sprite.lineStyle(1, 0xffffff, 0.2);
    this.sprite.drawRect(-size / 2, -size / 2, size, size);
  }

  setPosition(x: number, y: number): void {
    this.sprite.position.set(x, y);
  }

  setVisible(visible: boolean): void {
    this.sprite.visible = visible;
  }
}
