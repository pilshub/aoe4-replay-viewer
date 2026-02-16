import { useMemo } from 'react';
import { useReplayStore } from '../../state/replayStore';
import { PlayerBuildOrder } from './PlayerBuildOrder';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function BuildOrderView() {
  const { data, metadata, setCurrentTime } = useReplayStore();

  const players = metadata?.players ?? [];
  const buildOrder = data?.buildOrder ?? [];
  const analysis = data?.analysis;

  const eventsByPlayer = useMemo(() => {
    const map = new Map<number, typeof buildOrder>();
    for (const p of players) map.set(p.playerId, []);
    for (const e of buildOrder) {
      map.get(e.playerId)?.push(e);
    }
    return map;
  }, [buildOrder, players]);

  if (!data || !metadata) return null;

  if (buildOrder.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">No build order data</p>
          <p className="text-sm">This replay didn't produce parseable build order events.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Match header */}
      <div className="px-4 py-2 bg-aoe-panel/30 border-b border-aoe-border flex items-center gap-4 text-xs text-gray-400">
        <span>Duration: <strong className="text-gray-200">{formatTime(metadata.duration)}</strong></span>
        <span>Map: <strong className="text-gray-200">{metadata.mapName}</strong></span>
        <span>Events: <strong className="text-gray-200">{buildOrder.length}</strong></span>
      </div>

      {/* Player columns */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {players.map((player) => {
          const playerAnalysis = analysis?.players.find(a => a.playerId === player.playerId);
          return (
            <PlayerBuildOrder
              key={player.playerId}
              player={player}
              events={eventsByPlayer.get(player.playerId) ?? []}
              analysis={playerAnalysis}
              onTimeClick={setCurrentTime}
            />
          );
        })}
      </div>
    </div>
  );
}
