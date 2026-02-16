import * as PIXI from 'pixi.js';
import { OptimizedEntity } from '../../types/replay.types';
import { CoordinateMapper } from '../utils/CoordinateMapper';
import { getPlayerColor, lightenColor } from '../utils/ColorUtils';

/**
 * Renders unit activity as army position markers.
 * With chained commands, only 1-2 entities per player are visible at once,
 * so we render them as large, clear army indicators.
 *
 * - unit_activity: army marker with direction arrow and size indicator
 * - unit_combat: combat marker (crossed swords) with pulsing border
 * - unit_ability: ring burst effect
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
      const brightColor = lightenColor(color, 0.4);

      // Interpolate position
      let normX = entity.spawnX;
      let normY = entity.spawnY;
      let progress = 0;

      if (entity.deathX != null && entity.deathY != null && entity.deathTime != null) {
        const totalDuration = entity.deathTime - entity.spawnTime;
        if (totalDuration > 0) {
          progress = Math.min(1, Math.max(0,
            (currentTime - entity.spawnTime) / totalDuration
          ));
          normX = entity.spawnX + (entity.deathX - entity.spawnX) * progress;
          normY = entity.spawnY + (entity.deathY - entity.spawnY) * progress;
        }
      }

      const x = mapper.toScreenX(normX);
      const y = mapper.toScreenY(normY);

      if (entity.type === 'unit_combat') {
        // Combat: red-tinted marker with crossed swords icon
        const count = entity.unitCount ?? 1;
        const radius = Math.min(14, 6 + Math.sqrt(count) * 1.5);

        // Outer glow
        g.beginFill(color, 0.15);
        g.drawCircle(x, y, radius + 6);
        g.endFill();

        // Main circle
        g.beginFill(color, 0.5);
        g.drawCircle(x, y, radius);
        g.endFill();

        // Border
        g.lineStyle(2, brightColor, 0.9);
        g.drawCircle(x, y, radius);
        g.lineStyle(0);

        // X marker (combat icon)
        const s = radius * 0.5;
        g.lineStyle(2, 0xffffff, 0.8);
        g.moveTo(x - s, y - s);
        g.lineTo(x + s, y + s);
        g.moveTo(x + s, y - s);
        g.lineTo(x - s, y + s);
        g.lineStyle(0);

      } else if (entity.type === 'unit_ability') {
        // Ability: concentric rings expanding outward
        g.lineStyle(2, color, 0.7);
        g.drawCircle(x, y, 8);
        g.lineStyle(1, color, 0.3);
        g.drawCircle(x, y, 14);
        g.lineStyle(0);

      } else {
        // Movement: army position marker sized by unit count
        const count = entity.unitCount ?? 1;
        const radius = Math.min(14, 4 + Math.sqrt(count) * 2);

        // Direction arrow: draw a trail from spawn to current position
        if (entity.deathX != null && entity.deathY != null && progress > 0.05) {
          const spawnScreenX = mapper.toScreenX(entity.spawnX);
          const spawnScreenY = mapper.toScreenY(entity.spawnY);
          const dx = x - spawnScreenX;
          const dy = y - spawnScreenY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 5) {
            // Trail line (fading from origin)
            const trailWidth = Math.min(4, 1 + count * 0.3);
            g.lineStyle(trailWidth, color, 0.15);
            g.moveTo(spawnScreenX, spawnScreenY);
            g.lineTo(x, y);
            g.lineStyle(0);
          }
        }

        // Outer glow for larger groups
        if (count >= 3) {
          g.beginFill(color, 0.08);
          g.drawCircle(x, y, radius + 5);
          g.endFill();
        }

        // Main body
        g.beginFill(color, 0.7);
        g.drawCircle(x, y, radius);
        g.endFill();

        // Border
        g.lineStyle(1.5, brightColor, 0.9);
        g.drawCircle(x, y, radius);
        g.lineStyle(0);

        // Unit count label for groups of 3+
        if (count >= 3) {
          // Small inner dot to indicate "army" vs "scout"
          g.beginFill(0xffffff, 0.3);
          g.drawCircle(x, y, 2);
          g.endFill();
        }
      }
    }
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.container.visible = v;
  }
}
