import { useEffect, useRef } from 'react';
import { useReplayStore } from '../../state/replayStore';
import { PLAYER_COLORS } from '../../types/replay.types';
import { PixiEngine } from '../../pixi/PixiEngine';

interface MinimapProps {
  engineRef: React.MutableRefObject<PixiEngine | null>;
}

const MINIMAP_SIZE = 180;

export function Minimap({ engineRef }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { data, currentTime } = useReplayStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // Draw entities
    for (const entity of data.entities) {
      if (entity.spawnTime > currentTime) continue;
      if (entity.deathTime != null && entity.deathTime <= currentTime) continue;

      const color = PLAYER_COLORS[entity.playerId] ?? 0x9ca3af;
      const cssColor = `#${color.toString(16).padStart(6, '0')}`;

      // Interpolate position for units
      let nx = entity.spawnX;
      let ny = entity.spawnY;
      if (entity.category === 'unit' && entity.deathX != null && entity.deathY != null && entity.deathTime != null) {
        const duration = entity.deathTime - entity.spawnTime;
        if (duration > 0) {
          const progress = Math.min(1, (currentTime - entity.spawnTime) / duration);
          nx = entity.spawnX + (entity.deathX - entity.spawnX) * progress;
          ny = entity.spawnY + (entity.deathY - entity.spawnY) * progress;
        }
      }

      const x = nx * MINIMAP_SIZE;
      const y = ny * MINIMAP_SIZE;

      ctx.fillStyle = cssColor;
      if (entity.category === 'building') {
        ctx.fillRect(x - 2, y - 2, 4, 4);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw viewport indicator
    if (engineRef.current) {
      const vp = engineRef.current.getViewport();
      const mapper = engineRef.current.getMapper();
      const mapSize = mapper.getMapSize();

      if (mapSize > 0) {
        const scale = MINIMAP_SIZE / mapSize;
        const vpX = (vp.x - mapper.getOffsetX()) * scale;
        const vpY = (vp.y - mapper.getOffsetY()) * scale;
        const vpW = vp.width * scale;
        const vpH = vp.height * scale;

        ctx.strokeStyle = 'rgba(212, 168, 83, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(vpX, vpY, vpW, vpH);
      }
    }

    // Border
    ctx.strokeStyle = '#2a3a4a';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  }, [data, currentTime]);

  if (!data) return null;

  return (
    <div className="absolute bottom-16 left-4">
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        className="rounded-lg border border-aoe-border shadow-lg"
      />
    </div>
  );
}
