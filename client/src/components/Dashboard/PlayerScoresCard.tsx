import { useState } from 'react';
import type { PlayerScores, ScoreDetail } from '../../types/analysis.types';
import type { ReplayMetadata } from '../../types/replay.types';

const PLAYER_COLORS = ['#3b82f6', '#ef4444'];

const SCORE_DEFS: {
  key: keyof Omit<PlayerScores, 'playerId'>;
  label: string;
  tooltip: string;
}[] = [
  {
    key: 'macro',
    label: 'Macro',
    tooltip: 'Villager production consistency. Penalizes idle TC time — fewer and shorter gaps = higher score. Absolute metric (not relative to opponent).',
  },
  {
    key: 'economy',
    label: 'Economy',
    tooltip: 'Total resources spent compared to the opponent. A higher share of combined spending = higher score. Relative metric.',
  },
  {
    key: 'military',
    label: 'Military',
    tooltip: '60% military units produced (relative share) + 40% combat engagement wins. Relative metric.',
  },
  {
    key: 'tech',
    label: 'Tech',
    tooltip: 'Technologies researched compared to the opponent. More research = higher score. Relative metric.',
  },
];

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#c9a84c';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function Tooltip({ text }: { text: string }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 px-3 py-2
                    bg-aoe-panel border border-aoe-gold/30 rounded-md shadow-lg z-50
                    text-xs text-aoe-text leading-relaxed font-crimson
                    pointer-events-none">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
                      border-l-[5px] border-r-[5px] border-t-[5px]
                      border-l-transparent border-r-transparent border-t-aoe-gold/30" />
    </div>
  );
}

interface Props {
  scores: PlayerScores[];
  metadata: ReplayMetadata;
}

export function PlayerScoresCard({ scores, metadata }: Props) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  if (!scores || scores.length < 2) return null;

  const { players } = metadata;

  return (
    <div className="mx-8 my-5">
      <div
        className="relative rounded-lg border border-aoe-gold/20 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(26,26,36,0.95) 0%, rgba(13,13,18,0.98) 100%)',
        }}
      >
        {/* Gold accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)' }}
        />

        <div className="p-5">
          {/* Header with player names */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-cinzel tracking-wide" style={{ color: PLAYER_COLORS[0] }}>
              {players[0]?.name ?? 'Player 1'}
            </span>
            <h3 className="font-cinzel text-[11px] tracking-[0.15em] text-aoe-gold-dark uppercase">
              Performance
            </h3>
            <span className="text-xs font-cinzel tracking-wide" style={{ color: PLAYER_COLORS[1] }}>
              {players[1]?.name ?? 'Player 2'}
            </span>
          </div>

          {/* Score rows */}
          <div className="space-y-3">
            {SCORE_DEFS.map(({ key, label, tooltip }) => {
              const s1 = scores.find(s => s.playerId === players[0]?.playerId);
              const s2 = scores.find(s => s.playerId === players[1]?.playerId);
              const d1: ScoreDetail = s1?.[key] ?? { score: 0, reasons: [] };
              const d2: ScoreDetail = s2?.[key] ?? { score: 0, reasons: [] };

              return (
                <div key={key}>
                  {/* Label row with tooltip */}
                  <div
                    className="relative flex items-center justify-center gap-1.5 mb-1"
                    onMouseEnter={() => setHoveredRow(key)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <span className="font-cinzel text-[11px] tracking-[0.15em] text-aoe-text-secondary uppercase cursor-help">
                      {label}
                    </span>
                    <span className="text-aoe-text-dim text-[10px] cursor-help">&#9432;</span>
                    {hoveredRow === key && <Tooltip text={tooltip} />}
                  </div>

                  {/* Dual bar */}
                  <div className="flex items-center gap-2">
                    {/* P1 score */}
                    <span
                      className="w-8 text-right text-sm font-semibold tabular-nums"
                      style={{ color: getScoreColor(d1.score) }}
                    >
                      {d1.score}
                    </span>

                    {/* P1 bar (grows left) */}
                    <div className="flex-1 h-3 bg-aoe-panel rounded-sm overflow-hidden flex justify-end">
                      <div
                        className="h-full rounded-sm transition-all duration-700"
                        style={{
                          width: `${d1.score}%`,
                          backgroundColor: PLAYER_COLORS[0],
                          opacity: 0.85,
                        }}
                      />
                    </div>

                    <div className="w-px h-5 bg-aoe-gold/30" />

                    {/* P2 bar (grows right) */}
                    <div className="flex-1 h-3 bg-aoe-panel rounded-sm overflow-hidden">
                      <div
                        className="h-full rounded-sm transition-all duration-700"
                        style={{
                          width: `${d2.score}%`,
                          backgroundColor: PLAYER_COLORS[1],
                          opacity: 0.85,
                        }}
                      />
                    </div>

                    {/* P2 score */}
                    <span
                      className="w-8 text-left text-sm font-semibold tabular-nums"
                      style={{ color: getScoreColor(d2.score) }}
                    >
                      {d2.score}
                    </span>
                  </div>

                  {/* Reasons row */}
                  <div className="flex justify-between mt-0.5 px-10">
                    <span className="text-[10px] text-aoe-text-dim font-crimson italic">
                      {d1.reasons.join(' · ')}
                    </span>
                    <span className="text-[10px] text-aoe-text-dim font-crimson italic">
                      {d2.reasons.join(' · ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
