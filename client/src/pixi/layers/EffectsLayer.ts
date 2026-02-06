import * as PIXI from 'pixi.js';
import { DeathEvent } from '../../types/replay.types';
import { CoordinateMapper } from '../utils/CoordinateMapper';
import { getPlayerColor } from '../utils/ColorUtils';

interface ActiveEffect {
  x: number;
  y: number;
  color: number;
  startTime: number;
  duration: number;
}

const EFFECT_DURATION = 1.5; // seconds the death effect lasts

/**
 * Renders death/combat effects as expanding, fading rings.
 */
export class EffectsLayer {
  public container: PIXI.Container;
  private graphics: PIXI.Graphics;
  private activeEffects: ActiveEffect[] = [];
  private visible = true;

  constructor() {
    this.container = new PIXI.Container();
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  update(events: DeathEvent[], currentTime: number, mapper: CoordinateMapper): void {
    if (!this.visible) return;

    // Collect active effects (deaths within the last EFFECT_DURATION seconds)
    this.activeEffects = [];
    for (const event of events) {
      const elapsed = currentTime - event.time;
      if (elapsed >= 0 && elapsed < EFFECT_DURATION) {
        this.activeEffects.push({
          x: mapper.toScreenX(event.x),
          y: mapper.toScreenY(event.y),
          color: getPlayerColor(event.playerId),
          startTime: event.time,
          duration: EFFECT_DURATION,
        });
      }
    }

    // Draw
    const g = this.graphics;
    g.clear();

    for (const effect of this.activeEffects) {
      const progress = (currentTime - effect.startTime) / effect.duration;
      const alpha = 1 - progress;
      const radius = 4 + progress * 12;

      // Expanding ring
      g.lineStyle(2, effect.color, alpha * 0.8);
      g.drawCircle(effect.x, effect.y, radius);
      g.lineStyle(0);

      // Center flash
      if (progress < 0.3) {
        const flashAlpha = (1 - progress / 0.3) * 0.9;
        g.beginFill(0xffffff, flashAlpha);
        g.drawCircle(effect.x, effect.y, 3 * (1 - progress));
        g.endFill();
      }
    }
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.container.visible = v;
  }
}
