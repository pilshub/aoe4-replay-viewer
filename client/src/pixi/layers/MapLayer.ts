import * as PIXI from 'pixi.js';
import { CoordinateMapper } from '../utils/CoordinateMapper';

/**
 * Dark grid background layer representing the map.
 */
export class MapLayer {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;

  constructor() {
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  draw(mapper: CoordinateMapper): void {
    const g = this.graphics;
    g.clear();

    const size = mapper.getMapSize();
    const ox = mapper.getOffsetX();
    const oy = mapper.getOffsetY();

    // Background
    g.beginFill(0x0d1117);
    g.drawRect(ox, oy, size, size);
    g.endFill();

    // Grid lines
    const gridCount = 20;
    const step = size / gridCount;
    g.lineStyle(1, 0x1a2233, 0.5);

    for (let i = 0; i <= gridCount; i++) {
      // Vertical
      g.moveTo(ox + i * step, oy);
      g.lineTo(ox + i * step, oy + size);
      // Horizontal
      g.moveTo(ox, oy + i * step);
      g.lineTo(ox + size, oy + i * step);
    }

    // Border
    g.lineStyle(2, 0x2a3a4a, 1);
    g.drawRect(ox, oy, size, size);
  }
}
