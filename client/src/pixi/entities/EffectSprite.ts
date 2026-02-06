import * as PIXI from 'pixi.js';
import { DeathEvent } from '../../types/replay.types';
import { getPlayerColor } from '../utils/ColorUtils';

/**
 * Death/combat effect sprite.
 */
export class EffectSprite {
  public sprite: PIXI.Graphics;
  public event: DeathEvent;
  public startTime: number;
  public duration: number;

  constructor(event: DeathEvent, duration = 1.5) {
    this.event = event;
    this.startTime = event.time;
    this.duration = duration;
    this.sprite = new PIXI.Graphics();
  }

  update(currentTime: number): boolean {
    const elapsed = currentTime - this.startTime;
    if (elapsed < 0 || elapsed >= this.duration) {
      this.sprite.visible = false;
      return false;
    }

    this.sprite.visible = true;
    const progress = elapsed / this.duration;
    const alpha = 1 - progress;
    const radius = 4 + progress * 12;
    const color = getPlayerColor(this.event.playerId);

    const g = this.sprite;
    g.clear();
    g.lineStyle(2, color, alpha * 0.8);
    g.drawCircle(0, 0, radius);
    g.lineStyle(0);

    if (progress < 0.3) {
      const flashAlpha = (1 - progress / 0.3) * 0.9;
      g.beginFill(0xffffff, flashAlpha);
      g.drawCircle(0, 0, 3 * (1 - progress));
      g.endFill();
    }

    return true;
  }
}
