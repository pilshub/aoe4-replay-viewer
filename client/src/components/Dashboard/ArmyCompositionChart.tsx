import type { MatchAnalysis, PlayerInfo } from '../../types/replay.types';

const PLAYER_COLORS = ['#3b82f6', '#ef4444'];

interface Props {
  analysis: MatchAnalysis;
  players: PlayerInfo[];
}

export function ArmyCompositionChart({ analysis, players }: Props) {
  const hasData = analysis.players.some(p => p.unitComposition.length > 0);
  if (!hasData) return null;

  return (
    <div className="px-8 py-4">
      <h3 className="font-cinzel text-xs tracking-[0.15em] text-aoe-text-secondary mb-4 uppercase">
        Army Composition
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {players.map((player, i) => {
          const pa = analysis.players.find(a => a.playerId === player.playerId);
          if (!pa || pa.unitComposition.length === 0) return null;
          const maxCount = pa.unitComposition[0].count;

          return (
            <div
              key={player.playerId}
              className="bg-aoe-panel/40 rounded-lg p-5 border border-aoe-border"
            >
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: PLAYER_COLORS[i] }}
                />
                <span className="font-cinzel text-sm text-aoe-text tracking-wide">
                  {player.name}
                </span>
                <span className="text-xs text-aoe-text-dim font-crimson">
                  ({pa.totalMilitaryUnits} units)
                </span>
              </div>
              <div className="space-y-2">
                {pa.unitComposition.slice(0, 8).map((u, j) => (
                  <div key={j} className="flex items-center gap-2.5">
                    {u.icon ? (
                      <img src={u.icon} alt="" className="w-5 h-5 flex-shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-5 h-5 flex-shrink-0" />
                    )}
                    <div className="flex-1 h-5 bg-aoe-bg/60 rounded-sm overflow-hidden">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${Math.max((u.count / maxCount) * 100, 4)}%`,
                          backgroundColor: PLAYER_COLORS[i],
                          opacity: 0.6,
                        }}
                      />
                    </div>
                    <span className="text-xs text-aoe-text-secondary w-7 text-right font-mono">
                      {u.count}
                    </span>
                    <span className="text-xs text-aoe-text-dim w-28 truncate font-crimson">
                      {u.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
