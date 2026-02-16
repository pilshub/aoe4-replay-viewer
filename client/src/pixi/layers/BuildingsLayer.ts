import * as PIXI from 'pixi.js';
import { OptimizedEntity } from '../../types/replay.types';
import { CoordinateMapper } from '../utils/CoordinateMapper';
import { getPlayerColor, lightenColor } from '../utils/ColorUtils';

/**
 * Renders buildings as prominent diamond/square shapes with glow borders.
 * Construct buildings (actual placements) are larger and more visible.
 * Rally-point buildings are smaller secondary markers.
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
      const isConstruct = entity.type === 'building_construct';

      if (isConstruct) {
        // Main building: large diamond with glow
        const size = 8;

        // Outer glow
        g.beginFill(color, 0.15);
        g.drawRect(x - size - 3, y - size - 3, (size + 3) * 2, (size + 3) * 2);
        g.endFill();

        // Building body (filled diamond)
        g.beginFill(color, 0.85);
        g.moveTo(x, y - size);
        g.lineTo(x + size, y);
        g.lineTo(x, y + size);
        g.lineTo(x - size, y);
        g.closePath();
        g.endFill();

        // Bright border
        g.lineStyle(2, lightenColor(color, 0.3), 1);
        g.moveTo(x, y - size);
        g.lineTo(x + size, y);
        g.lineTo(x, y + size);
        g.lineTo(x - size, y);
        g.closePath();
        g.lineStyle(0);
      } else {
        // Rally-point building: smaller square, more transparent
        const size = 5;
        g.beginFill(color, 0.4);
        g.drawRect(x - size / 2, y - size / 2, size, size);
        g.endFill();
        g.lineStyle(1, color, 0.6);
        g.drawRect(x - size / 2, y - size / 2, size, size);
        g.lineStyle(0);
      }
    }
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.container.visible = v;
  }
}
