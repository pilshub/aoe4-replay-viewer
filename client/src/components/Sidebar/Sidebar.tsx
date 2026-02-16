import { useReplayStore } from '../../state/replayStore';
import { PLAYER_COLORS, PLAYER_COLOR_NAMES } from '../../types/replay.types';
import { hexToCSS } from '../../pixi/utils/ColorUtils';

export function Sidebar() {
  const { metadata, data, currentTime } = useReplayStore();

  if (!metadata || !data) return null;

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Count alive entities per player at current time
  const playerStats = metadata.players.map((player) => {
    let buildings = 0;
    let units = 0;
    for (const e of data.entities) {
      if (e.playerId !== player.playerId) continue;
      if (e.spawnTime > currentTime) continue;
      if (e.deathTime != null && e.deathTime <= currentTime) continue;
      if (e.category === 'building') buildings++;
      else units++;
    }
    return { ...player, buildings, units };
  });

  return (
    <div className="w-64 bg-aoe-panel border-l border-aoe-border flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-aoe-border">
        <h2 className="text-aoe-gold font-semibold text-sm">Match Info</h2>
        <p className="text-gray-500 text-xs mt-1">
          Duration: {formatTime(metadata.duration)} &middot; {metadata.mapName}
        </p>
      </div>

      {/* Players */}
      <div className="flex-1 overflow-y-auto">
        {playerStats.map((player) => {
          const color = PLAYER_COLORS[player.color] ?? 0x9ca3af;
          const cssColor = hexToCSS(color);
          const colorName = PLAYER_COLOR_NAMES[player.color] ?? 'Unknown';

          return (
            <div
              key={player.playerId}
              className="px-4 py-3 border-b border-aoe-border/50 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: cssColor }}
                />
                <span className="font-medium text-sm truncate">{player.name}</span>
                {player.outcome === 'win' && (
                  <span className="text-aoe-gold text-xs ml-auto">W</span>
                )}
                {player.outcome === 'loss' && (
                  <span className="text-red-400 text-xs ml-auto">L</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{player.civ}</span>
                <span className="text-gray-600">|</span>
                <span>{colorName}</span>
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Buildings:</span>
                  <span className="text-gray-300">{player.buildings}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Units:</span>
                  <span className="text-gray-300">{player.units}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-aoe-border">
        <h3 className="text-gray-400 text-xs font-semibold mb-2">Legend</h3>
        <div className="space-y-1.5 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1 13,7 7,13 1,7" fill="#888" stroke="#fff" strokeWidth="1"/></svg>
            <span>Building</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="4" fill="#888" fillOpacity="0.7" stroke="#bbb" strokeWidth="1.5"/></svg>
            <span>Army (size = units)</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="#888" fillOpacity="0.5" stroke="#bbb" strokeWidth="1.5"/><line x1="4" y1="4" x2="10" y2="10" stroke="#fff" strokeWidth="1.5"/><line x1="10" y1="4" x2="4" y2="10" stroke="#fff" strokeWidth="1.5"/></svg>
            <span>Combat</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="4" fill="none" stroke="#f88" strokeWidth="2" opacity="0.8"/></svg>
            <span>Death effect</span>
          </div>
        </div>
      </div>

      {/* Entity counts summary */}
      <div className="px-4 py-3 border-t border-aoe-border bg-aoe-bg/50">
        <div className="text-xs text-gray-500">
          Total entities: {data.entities.length} &middot; Deaths: {data.events.length}
        </div>
      </div>
    </div>
  );
}
