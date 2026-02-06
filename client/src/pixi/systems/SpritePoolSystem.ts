import * as PIXI from 'pixi.js';

/**
 * Object pool for reusing PIXI Graphics objects to reduce GC pressure.
 */
export class SpritePool<T extends PIXI.DisplayObject> {
  private pool: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;

  constructor(factory: () => T, preallocate = 0) {
    this.factory = factory;
    for (let i = 0; i < preallocate; i++) {
      const obj = this.factory();
      obj.visible = false;
      this.pool.push(obj);
    }
  }

  acquire(): T {
    let obj = this.pool.pop();
    if (!obj) {
      obj = this.factory();
    }
    obj.visible = true;
    this.active.add(obj);
    return obj;
  }

  release(obj: T): void {
    obj.visible = false;
    this.active.delete(obj);
    this.pool.push(obj);
  }

  releaseAll(): void {
    for (const obj of this.active) {
      obj.visible = false;
      this.pool.push(obj);
    }
    this.active.clear();
  }

  getActive(): Set<T> {
    return this.active;
  }

  getPoolSize(): number {
    return this.pool.length;
  }

  getActiveCount(): number {
    return this.active.size;
  }
}
