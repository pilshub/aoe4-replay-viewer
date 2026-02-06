import * as PIXI from 'pixi.js';
import { TimelineData } from '../types/replay.types';
import { CoordinateMapper } from './utils/CoordinateMapper';
import { MapLayer } from './layers/MapLayer';
import { BuildingsLayer } from './layers/BuildingsLayer';
import { UnitsLayer } from './layers/UnitsLayer';
import { EffectsLayer } from './layers/EffectsLayer';
import { HeatmapLayer } from './layers/HeatmapLayer';

export class PixiEngine {
  private app: PIXI.Application;
  private mapper: CoordinateMapper;
  private data: TimelineData | null = null;

  // Layers
  private mapLayer: MapLayer;
  private buildingsLayer: BuildingsLayer;
  private unitsLayer: UnitsLayer;
  private effectsLayer: EffectsLayer;
  private heatmapLayer: HeatmapLayer;

  // Playback state (set externally each frame)
  private currentTime = 0;

  // Pan & zoom
  private worldContainer: PIXI.Container;
  private zoomLevel = 1;
  private panX = 0;
  private panY = 0;
  private isPanning = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.app = new PIXI.Application({
      view: canvas,
      width,
      height,
      backgroundColor: 0x080c14,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.mapper = new CoordinateMapper(width, height);

    // World container for pan/zoom
    this.worldContainer = new PIXI.Container();
    this.app.stage.addChild(this.worldContainer);

    // Create layers (order matters: bottom to top)
    this.mapLayer = new MapLayer();
    this.buildingsLayer = new BuildingsLayer();
    this.unitsLayer = new UnitsLayer();
    this.heatmapLayer = new HeatmapLayer();
    this.effectsLayer = new EffectsLayer();

    this.worldContainer.addChild(this.mapLayer.container);
    this.worldContainer.addChild(this.buildingsLayer.container);
    this.worldContainer.addChild(this.unitsLayer.container);
    this.worldContainer.addChild(this.heatmapLayer.container);
    this.worldContainer.addChild(this.effectsLayer.container);

    // Draw static map background
    this.mapLayer.draw(this.mapper);

    // Set up mouse events for pan/zoom
    this.setupInteraction(canvas);
  }

  private setupInteraction(canvas: HTMLCanvasElement): void {
    // Zoom with mouse wheel
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(10, Math.max(0.5, this.zoomLevel * zoomFactor));

      // Zoom toward mouse position
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Adjust pan so zoom centers on mouse
      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoomLevel);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoomLevel);

      this.zoomLevel = newZoom;
      this.applyTransform();
    }, { passive: false });

    // Pan with middle mouse button or right click
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2) {
        this.isPanning = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        e.preventDefault();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX += e.clientX - this.lastMouseX;
        this.panY += e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.applyTransform();
      }
    });

    canvas.addEventListener('mouseup', () => { this.isPanning = false; });
    canvas.addEventListener('mouseleave', () => { this.isPanning = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private applyTransform(): void {
    this.worldContainer.scale.set(this.zoomLevel);
    this.worldContainer.position.set(this.panX, this.panY);
  }

  loadData(data: TimelineData): void {
    this.data = data;
  }

  setTime(time: number): void {
    this.currentTime = time;
  }

  render(): void {
    if (!this.data) return;

    this.buildingsLayer.update(this.data.entities, this.currentTime, this.mapper);
    this.unitsLayer.update(this.data.entities, this.currentTime, this.mapper);
    this.effectsLayer.update(this.data.events, this.currentTime, this.mapper);
    this.heatmapLayer.update(this.data.events, this.currentTime, this.mapper);
  }

  setLayerVisibility(layer: string, visible: boolean): void {
    switch (layer) {
      case 'buildings': this.buildingsLayer.setVisible(visible); break;
      case 'units': this.unitsLayer.setVisible(visible); break;
      case 'effects': this.effectsLayer.setVisible(visible); break;
      case 'heatmap': this.heatmapLayer.setVisible(visible); break;
    }
  }

  resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
    this.mapper.resize(width, height);
    this.mapLayer.draw(this.mapper);
  }

  /** Get current viewport info for minimap */
  getViewport(): { x: number; y: number; zoom: number; width: number; height: number } {
    return {
      x: -this.panX / this.zoomLevel,
      y: -this.panY / this.zoomLevel,
      zoom: this.zoomLevel,
      width: this.app.renderer.width / this.zoomLevel,
      height: this.app.renderer.height / this.zoomLevel,
    };
  }

  getMapper(): CoordinateMapper {
    return this.mapper;
  }

  destroy(): void {
    this.app.destroy(false, { children: true });
  }
}
