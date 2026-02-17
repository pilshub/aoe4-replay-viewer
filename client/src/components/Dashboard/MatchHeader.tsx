import type { ReplayMetadata, MatchAnalysis } from '../../types/replay.types';
import { StrategyBadge } from '../Strategy/StrategyBadge';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const PLAYER_COLORS = ['#3b82f6', '#ef4444'];

const OUTCOME_STYLE: Record<string, { text: string; color: string }> = {
  win: { text: 'VICTORY', color: 'text-green-400' },
  loss: { text: 'DEFEAT', color: 'text-red-400/70' },
};

interface Props {
  metadata: ReplayMetadata;
  analysis: MatchAnalysis;
}

export function MatchHeader({ metadata, analysis }: Props) {
  const { players, duration, mapName } = metadata;

  return (
    <div className="px-8 py-6">
      {/* Match info */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="ornament-line flex-1" />
        <div className="flex items-center gap-3 text-xs font-cinzel tracking-[0.15em] text-aoe-text-dim uppercase">
          <span>{mapName}</span>
          <span className="text-aoe-gold-dark">&#10022;</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="ornament-line flex-1" />
      </div>

      {/* Players */}
      <div className="flex gap-8">
        {players.map((player, i) => {
          const pa = analysis.players.find(a => a.playerId === player.playerId);
          const outcome = OUTCOME_STYLE[player.outcome];

          return (
            <div
              key={player.playerId}
              className="flex-1 bg-aoe-panel/50 rounded-lg p-5 border border-aoe-border
                         hover:border-aoe-gold-dark/30 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 shadow-lg"
                  style={{
                    backgroundColor: PLAYER_COLORS[i] ?? '#6b7280',
                    boxShadow: `0 0 12px ${PLAYER_COLORS[i]}44`,
                  }}
                />
                {player.civFlag && (
                  <img src={player.civFlag} alt={player.civ} className="w-7 h-7 rounded-sm" loading="lazy" />
                )}
                <span className="font-cinzel text-lg font-semibold text-aoe-text tracking-wide">
                  {player.name}
                </span>
                <span className="text-sm text-aoe-text-secondary font-crimson italic">
                  {player.civ}
                </span>
                {outcome && (
                  <span className={`text-xs font-cinzel tracking-widest ${outcome.color}`}>
                    {outcome.text}
                  </span>
                )}
              </div>

              {pa && (
                <div className="flex items-center gap-4">
                  <StrategyBadge strategy={pa.strategy} reasons={pa.strategyReasons} />
                  <div className="text-aoe-text-dim text-xs font-crimson">
                    {pa.ageUpTimings.map(a => (
                      <span key={a.age} className="mr-3">
                        {a.ageName}{' '}
                        <span className="text-aoe-text-secondary">{formatTime(a.time)}</span>
                        {a.landmarkIcon && (
                          <img src={a.landmarkIcon} alt="" className="w-4 h-4 inline ml-1 -mt-0.5" loading="lazy" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
