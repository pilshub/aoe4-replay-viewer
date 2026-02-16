import { useState, useMemo } from 'react';
import { useReplayStore } from '../../state/replayStore';
import { BuildOrderEntry, PLAYER_COLORS } from '../../types/replay.types';
import { hexToCSS } from '../../pixi/utils/ColorUtils';

type FilterType = 'all' | 'construct' | 'build_unit' | 'upgrade';

const EVENT_COLORS: Record<string, string> = {
  construct: 'text-blue-400',
  build_unit: 'text-green-400',
  upgrade: 'text-yellow-400',
};

const EVENT_BG: Record<string, string> = {
  construct: 'bg-blue-400/10 border-blue-400/20',
  build_unit: 'bg-green-400/10 border-green-400/20',
  upgrade: 'bg-yellow-400/10 border-yellow-400/20',
};

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  construct: 'Buildings',
  build_unit: 'Units',
  upgrade: 'Technologies',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function BuildOrder() {
  const { data, metadata, setCurrentTime } = useReplayStore();
  const [filter, setFilter] = useState<FilterType>('all');

  const players = metadata?.players ?? [];
  const buildOrder = data?.buildOrder ?? [];

  const filtered = useMemo(() => {
    if (filter === 'all') return buildOrder;
    return buildOrder.filter((e) => e.eventType === filter);
  }, [buildOrder, filter]);

  // Split by player
  const byPlayer = useMemo(() => {
    const map = new Map<number, BuildOrderEntry[]>();
    for (const p of players) {
      map.set(p.playerId, []);
    }
    for (const e of filtered) {
      const list = map.get(e.playerId);
      if (list) list.push(e);
    }
    return map;
  }, [filtered, players]);

  // Count by type for filter badges
  const counts = useMemo(() => ({
    all: buildOrder.length,
    construct: buildOrder.filter((e) => e.eventType === 'construct').length,
    build_unit: buildOrder.filter((e) => e.eventType === 'build_unit').length,
    upgrade: buildOrder.filter((e) => e.eventType === 'upgrade').length,
  }), [buildOrder]);

  if (!data || !metadata) return null;

  if (buildOrder.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>No build order data available for this replay.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Filters */}
      <div className="flex gap-1 px-4 py-3 border-b border-aoe-border bg-aoe-panel/50">
        {(Object.keys(FILTER_LABELS) as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-md border transition-colors ${
              filter === f
                ? 'bg-aoe-gold/20 border-aoe-gold/50 text-aoe-gold'
                : 'bg-transparent border-aoe-border text-gray-400 hover:text-gray-300 hover:border-gray-500'
            }`}
          >
            {FILTER_LABELS[f]}
            <span className="ml-1 opacity-60">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Two-column build order */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {players.map((player) => {
          const entries = byPlayer.get(player.playerId) ?? [];
          const color = PLAYER_COLORS[player.color] ?? 0x9ca3af;
          const cssColor = hexToCSS(color);

          return (
            <div
              key={player.playerId}
              className="flex-1 flex flex-col min-h-0 border-r border-aoe-border last:border-r-0"
            >
              {/* Player header */}
              <div className="px-3 py-2 border-b border-aoe-border/50 bg-aoe-bg/50 flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: cssColor }}
                />
                <span className="text-sm font-medium truncate">{player.name}</span>
                <span className="text-xs text-gray-500 ml-auto">{player.civ}</span>
              </div>

              {/* Entries */}
              <div className="flex-1 overflow-y-auto">
                {entries.map((entry, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentTime(entry.time)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left
                      border-b border-aoe-border/20 hover:bg-white/5 transition-colors`}
                  >
                    {/* Timestamp */}
                    <span className="text-xs text-gray-500 w-10 shrink-0 font-mono">
                      {formatTime(entry.time)}
                    </span>

                    {/* Icon */}
                    {entry.icon && (
                      <img
                        src={entry.icon}
                        alt={entry.name}
                        className="w-6 h-6 shrink-0 object-contain"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}

                    {/* Name + type badge */}
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs ${EVENT_COLORS[entry.eventType]}`}>
                        {entry.name}
                      </span>
                      {entry.displayClass && (
                        <span className="text-[10px] text-gray-600 ml-1.5">
                          {entry.displayClass}
                        </span>
                      )}
                    </div>

                    {/* Type indicator */}
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${EVENT_BG[entry.eventType]}`}
                    >
                      {entry.eventType === 'construct' ? 'B' : entry.eventType === 'build_unit' ? 'U' : 'T'}
                    </span>
                  </button>
                ))}
                {entries.length === 0 && (
                  <div className="px-3 py-4 text-xs text-gray-600 text-center">
                    No events
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
