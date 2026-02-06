import * as PIXI from 'pixi.js';
import { DeathEvent } from '../../types/replay.types';
import { CoordinateMapper } from '../utils/CoordinateMapper';

/**
 * Simple heatmap overlay showing death density.
 * Uses a grid-based approach rendered with PIXI graphics.
 */
export class HeatmapLayer {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private visible = false;
  private gridSize = 30; // cells per axis

  constructor() {
    this.container = new PIXI.Container();
    this.container.alpha = 0.5;
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  update(events: DeathEvent[], currentTime: number, mapper: CoordinateMapper): void {
    if (!this.visible) return;

    const g = this.graphics;
    g.clear();

    // Build density grid from deaths up to current time
    const grid: number[][] = Array.from({ length: this.gridSize },
      () => new Array(this.gridSize).fill(0)
    );

    let maxDensity = 0;
    for (const event of events) {
      if (event.time > currentTime) continue;
      const gx = Math.floor(event.x * (this.gridSize - 1));
      const gy = Math.floor(event.y * (this.gridSize - 1));
      if (gx >= 0 && gx < this.gridSize && gy >= 0 && gy < this.gridSize) {
        grid[gy][gx]++;
        if (grid[gy][gx] > maxDensity) maxDensity = grid[gy][gx];
      }
    }

    if (maxDensity === 0) return;

    const mapSize = mapper.getMapSize();
    const cellW = mapSize / this.gridSize;
    const cellH = mapSize / this.gridSize;
    const ox = mapper.getOffsetX();
    const oy = mapper.getOffsetY();

    for (let gy = 0; gy < this.gridSize; gy++) {
      for (let gx = 0; gx < this.gridSize; gx++) {
        const density = grid[gy][gx];
        if (density === 0) continue;

        const intensity = density / maxDensity;
        // Color gradient: blue (low) → yellow (mid) → red (high)
        let color: number;
        if (intensity < 0.5) {
          const t = intensity * 2;
          color = lerpColor(0x0000ff, 0xffff00, t);
        } else {
          const t = (intensity - 0.5) * 2;
          color = lerpColor(0xffff00, 0xff0000, t);
        }

        g.beginFill(color, intensity * 0.7);
        g.drawRect(ox + gx * cellW, oy + gy * cellH, cellW, cellH);
        g.endFill();
      }
    }
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.container.visible = v;
  }
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const blue = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | blue;
}
