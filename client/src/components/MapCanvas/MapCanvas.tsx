import { useRef, useEffect } from 'react';
import { PixiEngine } from '../../pixi/PixiEngine';
import { useReplayStore } from '../../state/replayStore';

interface MapCanvasProps {
  engineRef: React.MutableRefObject<PixiEngine | null>;
}

export function MapCanvas({ engineRef }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrameTime = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: PixiEngine | null = null;
    let observer: ResizeObserver | null = null;
    let animFrame: number;
    let destroyed = false;

    const tick = (timestamp: number) => {
      if (destroyed) return;

      const parent = canvas.parentElement!;

      // Wait for valid dimensions before creating engine
      if (!engine) {
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (w > 100 && h > 100) {
          engine = new PixiEngine(canvas, w, h);
          engineRef.current = engine;

          observer = new ResizeObserver(() => {
            const rw = parent.clientWidth;
            const rh = parent.clientHeight;
            if (rw > 0 && rh > 0 && engine) engine.resize(rw, rh);
          });
          observer.observe(parent);
        } else {
          // Not ready yet, keep polling
          animFrame = requestAnimationFrame(tick);
          return;
        }
      }

      const s = useReplayStore.getState();

      // Load data when available
      if (s.data && !engine.hasData()) {
        engine.loadData(s.data);
      }

      // Update layer visibility
      engine.setLayerVisibility('buildings', s.layers.buildings);
      engine.setLayerVisibility('units', s.layers.units);
      engine.setLayerVisibility('effects', s.layers.effects);
      engine.setLayerVisibility('heatmap', s.layers.heatmap);

      // Advance time if playing
      if (s.playing && s.data) {
        const delta = lastFrameTime.current ? (timestamp - lastFrameTime.current) / 1000 : 0;
        const newTime = Math.min(s.data.metadata.duration, s.currentTime + delta * s.speed);
        if (newTime >= s.data.metadata.duration) {
          useReplayStore.getState().togglePlay();
          useReplayStore.getState().setCurrentTime(s.data.metadata.duration);
        } else {
          useReplayStore.getState().setCurrentTime(newTime);
        }
      }
      lastFrameTime.current = timestamp;

      engine.setTime(useReplayStore.getState().currentTime);
      engine.render();

      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);

    return () => {
      destroyed = true;
      cancelAnimationFrame(animFrame);
      if (observer) observer.disconnect();
      if (engine) engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
