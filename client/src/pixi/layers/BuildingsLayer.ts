import * as PIXI from 'pixi.js';
import { OptimizedEntity } from '../../types/replay.types';
import { CoordinateMapper } from '../utils/CoordinateMapper';
import { getPlayerColor } from '../utils/ColorUtils';

/**
 * Renders buildings as static colored squares.
 */
export class BuildingsLayer {
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
      if (entity.category !== 'building') continue;
      if (entity.spawnTime > currentTime) continue;
      if (entity.deathTime != null && entity.deathTime <= currentTime) continue;

      const x = mapper.toScreenX(entity.spawnX);
      const y = mapper.toScreenY(entity.spawnY);
      const color = getPlayerColor(entity.playerId);
      const size = 6;

      // Building body
      g.beginFill(color, 0.9);
      g.drawRect(x - size / 2, y - size / 2, size, size);
      g.endFill();

      // Border
      g.lineStyle(1, 0xffffff, 0.2);
      g.drawRect(x - size / 2, y - size / 2, size, size);
      g.lineStyle(0);
    }
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.container.visible = v;
  }
}
