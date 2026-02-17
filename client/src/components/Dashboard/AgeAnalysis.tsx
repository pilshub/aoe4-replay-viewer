import { useMemo } from 'react';
import type { AgePhase } from '../../types/analysis.types';
import type { PlayerInfo } from '../../types/replay.types';

const PLAYER_COLORS = ['#3b82f6', '#ef4444'];

const AGE_ICONS: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  agePhases: AgePhase[];
  players: PlayerInfo[];
  duration: number;
}

export function AgeAnalysis({ agePhases, players, duration }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<number, AgePhase[]>();
    for (const phase of agePhases) {
      const group = map.get(phase.ageNumber) ?? [];
      group.push(phase);
      map.set(phase.ageNumber, group);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [agePhases]);

  if (agePhases.length === 0) return null;

  return (
    <div className="px-8 py-4">
      <h3 className="font-cinzel text-xs tracking-[0.15em] text-aoe-text-secondary mb-4 uppercase">
        Age-by-Age Breakdown
      </h3>

      <div className="space-y-4">
        {grouped.map(([ageNum, phases]) => (
          <div key={ageNum} className="bg-aoe-panel/40 rounded-lg border border-aoe-border overflow-hidden">
            {/* Age header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-aoe-border/50 bg-aoe-bg/30">
              <span className="font-cinzel text-aoe-gold text-lg font-bold w-8 text-center">
                {AGE_ICONS[ageNum] ?? ageNum}
              </span>
              <span className="font-cinzel text-sm text-aoe-text tracking-wider">
                {phases[0].ageName}
              </span>
              <span className="text-xs text-aoe-text-dim font-crimson">
                {formatTime(phases[0].startTime)} &mdash; {formatTime(phases[0].endTime)}
              </span>
            </div>

            {/* Player comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-aoe-border/30">
              {phases.map((phase) => {
                const playerIdx = players.findIndex(p => p.playerId === phase.playerId);
                const player = players[playerIdx];
                if (!player) return null;

                return (
                  <div key={phase.playerId} className="p-4">
                    {/* Player name */}
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: PLAYER_COLORS[playerIdx] }}
                      />
                      <span className="font-cinzel text-xs text-aoe-text tracking-wide">
                        {player.name}
                      </span>
                      {phase.landmark && (
                        <span className="text-[10px] text-aoe-gold-dark font-crimson italic flex items-center gap-1">
                          {phase.landmarkIcon && (
                            <img src={phase.landmarkIcon} alt="" className="w-4 h-4" loading="lazy" />
                          )}
                          {phase.landmark}
                        </span>
                      )}
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <StatBox label="Villagers" value={`+${phase.villagersProduced}`} />
                      <StatBox label="Military" value={`+${phase.militaryProduced}`} />
                      <StatBox label="Buildings" value={`+${phase.buildingsConstructed}`} />
                      <StatBox label="Techs" value={`+${phase.technologiesResearched}`} />
                    </div>

                    {/* Spending */}
                    <div className="flex items-center gap-3 mb-2 text-[11px] font-crimson">
                      <span className="text-aoe-text-dim">Spent:</span>
                      <span className="text-aoe-text-secondary">{phase.totalSpent}</span>
                      {phase.militarySpent > 0 && (
                        <span className="text-red-400/70">
                          ({Math.round((phase.militarySpent / Math.max(phase.totalSpent, 1)) * 100)}% military)
                        </span>
                      )}
                    </div>

                    {/* Key units */}
                    {phase.keyUnits.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {phase.keyUnits.map((u, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-crimson
                                       bg-aoe-bg/40 border border-aoe-border/50 rounded text-aoe-text-secondary"
                          >
                            {u.icon && <img src={u.icon} alt="" className="w-3.5 h-3.5" loading="lazy" />}
                            {u.count}x {u.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Key buildings */}
                    {phase.keyBuildings.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {phase.keyBuildings.map((b, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-crimson
                                       bg-blue-900/20 border border-blue-400/20 rounded text-blue-300/80"
                          >
                            {b.icon && <img src={b.icon} alt="" className="w-3.5 h-3.5" loading="lazy" />}
                            {b.count}x {b.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Key techs */}
                    {phase.keyTechs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {phase.keyTechs.map((t, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-crimson
                                       bg-aoe-gold/5 border border-aoe-gold-dark/20 rounded text-aoe-gold-dark"
                          >
                            {t.icon && <img src={t.icon} alt="" className="w-3.5 h-3.5" loading="lazy" />}
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center bg-aoe-bg/30 rounded py-1.5 px-1">
      <div className="font-cinzel text-sm text-aoe-text">{value}</div>
      <div className="text-[9px] text-aoe-text-dim font-crimson uppercase tracking-wider">{label}</div>
    </div>
  );
}
