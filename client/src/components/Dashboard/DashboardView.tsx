import { useMemo } from 'react';
import { useReplayStore } from '../../state/replayStore';
import { MatchHeader } from './MatchHeader';
import { PlayerScoresCard } from './PlayerScoresCard';
import { NarrativeSection } from './NarrativeSection';
import { AgeAnalysis } from './AgeAnalysis';
import { ProductionChart } from './ProductionChart';
import { EconomyChart } from './EconomyChart';
import { ArmyCompositionChart } from './ArmyCompositionChart';
import { CombatTimeline } from './CombatTimeline';
import { BuildOrderView } from '../BuildOrder/BuildOrderView';

export function DashboardView() {
  const { data, metadata } = useReplayStore();

  if (!data || !metadata) return null;

  const { analysis, deepAnalysis } = data;

  // Extract age-up times for chart markers
  const ageUpTimes = useMemo(() => {
    if (!deepAnalysis?.agePhases) return [];
    const times: Array<{ time: number; label: string }> = [];
    const seen = new Set<number>();
    for (const phase of deepAnalysis.agePhases) {
      if (phase.ageNumber >= 2 && !seen.has(phase.ageNumber)) {
        seen.add(phase.ageNumber);
        times.push({
          time: phase.startTime,
          label: ['', '', 'II', 'III', 'IV'][phase.ageNumber] ?? `${phase.ageNumber}`,
        });
      }
    }
    return times;
  }, [deepAnalysis?.agePhases]);

  return (
    <div className="relative z-10 flex-1 overflow-y-auto">
      <MatchHeader metadata={metadata} analysis={analysis} />

      {/* Ornamental divider */}
      <div className="ornament-line mx-8" />

      {deepAnalysis?.narrative && (
        <NarrativeSection narrative={deepAnalysis.narrative} />
      )

      }

      {/* Player Scores — complementary to the narrative */}
      {deepAnalysis?.playerScores && deepAnalysis.playerScores.length > 0 && (
        <PlayerScoresCard scores={deepAnalysis.playerScores} metadata={metadata} />
      )}

      {/* Age-by-Age Breakdown */}
      {deepAnalysis?.agePhases && deepAnalysis.agePhases.length > 0 && (
        <>
          <div className="px-8 pt-6 pb-2">
            <h2 className="font-cinzel text-sm tracking-[0.2em] text-aoe-gold-dark uppercase">
              &#10022; Age Breakdown &#10022;
            </h2>
          </div>
          <AgeAnalysis
            agePhases={deepAnalysis.agePhases}
            players={metadata.players}
            duration={metadata.duration}
          />
        </>
      )}

      {/* Charts section */}
      <div className="px-8 pt-6 pb-2">
        <h2 className="font-cinzel text-sm tracking-[0.2em] text-aoe-gold-dark uppercase">
          &#10022; Statistics &#10022;
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 px-8 pb-4">
        <ProductionChart
          data={deepAnalysis?.productionTimeline ?? []}
          players={metadata.players}
          ageUpTimes={ageUpTimes}
        />
        <EconomyChart
          data={deepAnalysis?.economyTimeline ?? []}
          players={metadata.players}
          ageUpTimes={ageUpTimes}
        />
      </div>

      <ArmyCompositionChart analysis={analysis} players={metadata.players} />

      <CombatTimeline
        engagements={deepAnalysis?.combatEngagements ?? []}
        keyMoments={deepAnalysis?.keyMoments ?? []}
        duration={metadata.duration}
      />

      {/* Build Order section */}
      <div className="px-8 pt-6 pb-2">
        <h2 className="font-cinzel text-sm tracking-[0.2em] text-aoe-gold-dark uppercase">
          &#10022; Build Order &#10022;
        </h2>
      </div>
      <div className="mx-8 mb-6 border border-aoe-border rounded-lg overflow-hidden bg-aoe-panel/30">
        <div className="h-[500px] flex flex-col">
          <BuildOrderView />
        </div>
      </div>

      <div className="h-8" />
    </div>
  );
}
