import type { CombatEngagement, KeyMoment } from '../../types/analysis.types';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const INTENSITY_COLORS: Record<string, string> = {
  low: 'bg-yellow-600/50',
  medium: 'bg-orange-500/60',
  high: 'bg-red-500/70',
};

const MOMENT_COLORS: Record<string, string> = {
  age_up: 'bg-aoe-gold',
  first_military: 'bg-red-400',
  major_fight: 'bg-orange-500',
  expansion: 'bg-green-500',
  tech_spike: 'bg-blue-400',
};

const MOMENT_DOT_COLORS: Record<string, string> = {
  age_up: 'bg-aoe-gold',
  first_military: 'bg-red-400',
  major_fight: 'bg-orange-500',
  expansion: 'bg-green-500',
  tech_spike: 'bg-blue-400',
};

interface Props {
  engagements: CombatEngagement[];
  keyMoments: KeyMoment[];
  duration: number;
}

export function CombatTimeline({ engagements, keyMoments, duration }: Props) {
  if (engagements.length === 0 && keyMoments.length === 0) return null;

  const pct = (time: number) => `${(time / duration) * 100}%`;

  return (
    <div className="mx-8 my-4 bg-aoe-panel/40 rounded-lg p-5 border border-aoe-border">
      <h3 className="font-cinzel text-xs tracking-[0.15em] text-aoe-text-secondary mb-4 uppercase">
        Combat & Key Moments
      </h3>

      {/* Timeline bar */}
      <div className="relative h-10 bg-aoe-bg/60 rounded-lg mb-2 border border-aoe-border/50">
        {engagements.map((e) => {
          const width = Math.max(((e.endTime - e.startTime) / duration) * 100, 0.5);
          return (
            <div
              key={e.id}
              className={`absolute top-1 h-8 rounded ${INTENSITY_COLORS[e.intensity] ?? 'bg-gray-500'}`}
              style={{ left: pct(e.startTime), width: `${width}%` }}
              title={`${formatTime(e.startTime)}-${formatTime(e.endTime)}: ${e.intensity} (${e.commandsP1} vs ${e.commandsP2})`}
            />
          );
        })}

        {keyMoments.map((m, i) => (
          <div
            key={i}
            className={`absolute top-0 w-1 h-10 ${MOMENT_COLORS[m.type] ?? 'bg-gray-400'} rounded-sm`}
            style={{ left: pct(m.time) }}
            title={`${formatTime(m.time)}: ${m.description}`}
          />
        ))}
      </div>

      {/* Time axis labels */}
      <div className="flex justify-between text-[10px] text-aoe-text-dim px-1 font-crimson">
        <span>0:00</span>
        <span>{formatTime(duration / 4)}</span>
        <span>{formatTime(duration / 2)}</span>
        <span>{formatTime((duration * 3) / 4)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-[10px] text-aoe-text-dim font-crimson">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-600/50" /> Low</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500/60" /> Medium</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/70" /> High</span>
        <span className="text-aoe-border">|</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-aoe-gold" /> Age Up</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500" /> Expansion</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-400" /> Tech Spike</span>
      </div>

      {/* Key moments list */}
      {keyMoments.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {keyMoments.slice(0, 12).map((m, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs font-crimson">
              <span className="text-aoe-text-dim font-mono w-10">{formatTime(m.time)}</span>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${MOMENT_DOT_COLORS[m.type] ?? 'bg-gray-400'}`} />
              <span className="text-aoe-text-secondary">{m.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
