import { useMemo, useState } from 'react';
import type { BuildOrderEntry, PlayerInfo, PlayerAnalysis } from '../../types/replay.types';
import { PLAYER_COLORS } from '../../types/replay.types';
import { hexToCSS } from '../../pixi/utils/ColorUtils';
import { StrategyBadge } from '../Strategy/StrategyBadge';
import { PlayerStats } from '../Stats/PlayerStats';
import { AgeSection } from './AgeSection';

interface PlayerBuildOrderProps {
  player: PlayerInfo;
  events: BuildOrderEntry[];
  analysis?: PlayerAnalysis;
  onTimeClick: (time: number) => void;
}

function groupByAge(events: BuildOrderEntry[]): Map<number, BuildOrderEntry[]> {
  // Find age-up times
  const ageUpTimes = new Map<number, number>();
  ageUpTimes.set(1, 0);
  for (const e of events) {
    if (e.isAgeUp && e.targetAge >= 2) {
      const existing = ageUpTimes.get(e.targetAge);
      if (!existing || e.time < existing) {
        ageUpTimes.set(e.targetAge, e.time);
      }
    }
  }

  const sortedAges = [...ageUpTimes.entries()].sort((a, b) => a[1] - b[1]);
  const grouped = new Map<number, BuildOrderEntry[]>();
  for (const [age] of sortedAges) grouped.set(age, []);

  for (const event of events) {
    let currentAge = 1;
    for (const [age, time] of sortedAges) {
      if (event.time >= time) currentAge = age;
    }
    if (!grouped.has(currentAge)) grouped.set(currentAge, []);
    grouped.get(currentAge)!.push(event);
  }

  return grouped;
}

export function PlayerBuildOrder({ player, events, analysis, onTimeClick }: PlayerBuildOrderProps) {
  const [showStats, setShowStats] = useState(true);
  const color = PLAYER_COLORS[player.color] ?? 0x9ca3af;
  const cssColor = hexToCSS(color);

  const grouped = useMemo(() => groupByAge(events), [events]);

  const ageUpInfo = useMemo(() => {
    const info = new Map<number, { time: number; name?: string; icon?: string }>();
    if (analysis) {
      for (const a of analysis.ageUpTimings) {
        info.set(a.age, { time: a.time, name: a.landmarkName, icon: a.landmarkIcon });
      }
    }
    return info;
  }, [analysis]);

  return (
    <div className="flex-1 flex flex-col min-h-0 border-r border-aoe-border last:border-r-0">
      {/* Player header */}
      <div className="px-3 py-2 border-b border-aoe-border bg-aoe-panel/50">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cssColor }} />
          <span className="text-sm font-semibold truncate">{player.name}</span>
          {player.outcome === 'win' && <span className="text-aoe-gold text-xs ml-auto">WIN</span>}
          {player.outcome === 'loss' && <span className="text-red-400 text-xs ml-auto">LOSS</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{player.civ}</span>
          {analysis && (
            <div className="ml-auto">
              <StrategyBadge strategy={analysis.strategy} reasons={analysis.strategyReasons} />
            </div>
          )}
        </div>
      </div>

      {/* Stats toggle */}
      <button
        onClick={() => setShowStats(!showStats)}
        className="px-3 py-1 text-[10px] text-gray-500 hover:text-gray-300 border-b border-aoe-border/30 text-left"
      >
        {showStats ? '▼' : '▶'} Stats
      </button>

      {/* Stats panel */}
      {showStats && analysis && <PlayerStats analysis={analysis} />}

      {/* Build order by age */}
      <div className="flex-1 overflow-y-auto">
        {[1, 2, 3, 4].map(age => {
          const ageEvents = grouped.get(age);
          const info = ageUpInfo.get(age);
          if (!ageEvents && !info && age > 1) return null;
          return (
            <AgeSection
              key={age}
              age={age}
              ageUpTime={info?.time}
              landmarkName={info?.name}
              landmarkIcon={info?.icon}
              events={ageEvents ?? []}
              onTimeClick={onTimeClick}
            />
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="px-3 py-1.5 border-t border-aoe-border bg-aoe-bg/50 text-[10px] text-gray-500">
        {events.length} events · {events.filter(e => e.eventType === 'construct').length} buildings · {events.filter(e => e.eventType === 'build_unit').length} units · {events.filter(e => e.eventType === 'upgrade').length} techs
      </div>
    </div>
  );
}
