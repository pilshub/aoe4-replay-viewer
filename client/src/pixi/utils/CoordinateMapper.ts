/**
 * Maps normalized (0-1) game coordinates to screen pixel coordinates.
 */
export class CoordinateMapper {
  private mapSize: number;
  private offsetX: number;
  private offsetY: number;
  private scale: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    // Use the smaller dimension to keep the map square
    this.mapSize = Math.min(canvasWidth, canvasHeight);
    this.offsetX = (canvasWidth - this.mapSize) / 2;
    this.offsetY = (canvasHeight - this.mapSize) / 2;
    this.scale = 1;
  }

  /** Convert normalized X (0-1) to screen X */
  toScreenX(normX: number): number {
    return this.offsetX + normX * this.mapSize;
  }

  /** Convert normalized Y (0-1) to screen Y */
  toScreenY(normY: number): number {
    return this.offsetY + normY * this.mapSize;
  }

  /** Get the map render size in pixels */
  getMapSize(): number {
    return this.mapSize;
  }

  getOffsetX(): number {
    return this.offsetX;
  }

  getOffsetY(): number {
    return this.offsetY;
  }

  resize(canvasWidth: number, canvasHeight: number): void {
    this.mapSize = Math.min(canvasWidth, canvasHeight);
    this.offsetX = (canvasWidth - this.mapSize) / 2;
    this.offsetY = (canvasHeight - this.mapSize) / 2;
  }
}
