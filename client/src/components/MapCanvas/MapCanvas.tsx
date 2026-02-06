import { useRef, useEffect, useCallback } from 'react';
import { PixiEngine } from '../../pixi/PixiEngine';
import { useReplayStore } from '../../state/replayStore';

interface MapCanvasProps {
  engineRef: React.MutableRefObject<PixiEngine | null>;
}

export function MapCanvas({ engineRef }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { data, currentTime, playing, speed, layers, setCurrentTime } = useReplayStore();
  const lastFrameTime = useRef<number>(0);

  // Initialize PixiJS engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement!;
    const width = parent.clientWidth;
    const height = parent.clientHeight;

    const engine = new PixiEngine(canvas, width, height);
    engineRef.current = engine;

    // Handle resize
    const handleResize = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      engine.resize(w, h);
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(parent);

    return () => {
      observer.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Load data into engine when available
  useEffect(() => {
    if (data && engineRef.current) {
      engineRef.current.loadData(data);
      engineRef.current.setTime(0);
      engineRef.current.render();
    }
  }, [data]);

  // Update layer visibility
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setLayerVisibility('buildings', layers.buildings);
    engine.setLayerVisibility('units', layers.units);
    engine.setLayerVisibility('effects', layers.effects);
    engine.setLayerVisibility('heatmap', layers.heatmap);
    engine.render();
  }, [layers]);

  // Animation loop
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !data) return;

    let animFrame: number;

    const tick = (timestamp: number) => {
      if (playing) {
        const delta = lastFrameTime.current ? (timestamp - lastFrameTime.current) / 1000 : 0;
        const newTime = Math.min(
          data.metadata.duration,
          currentTime + delta * speed
        );

        if (newTime >= data.metadata.duration) {
          // Reached end
          useReplayStore.getState().togglePlay();
          setCurrentTime(data.metadata.duration);
        } else {
          setCurrentTime(newTime);
        }
      }
      lastFrameTime.current = timestamp;

      engine.setTime(useReplayStore.getState().currentTime);
      engine.render();

      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [data, playing, speed]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
