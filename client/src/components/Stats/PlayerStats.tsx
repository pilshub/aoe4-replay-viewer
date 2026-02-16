import type { PlayerAnalysis } from '../../types/replay.types';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const RESOURCE_COLORS: Record<string, string> = {
  food: 'bg-red-400',
  wood: 'bg-amber-600',
  stone: 'bg-gray-400',
  gold: 'bg-yellow-400',
};

export function PlayerStats({ analysis }: { analysis: PlayerAnalysis }) {
  const { ageUpTimings, firstMilitaryUnit, unitComposition, resourceSpending } = analysis;
  const maxUnitCount = unitComposition.length > 0 ? unitComposition[0].count : 1;
  const totalRes = resourceSpending.total || 1;

  return (
    <div className="px-3 py-2 space-y-3 text-xs border-b border-aoe-border/50 bg-aoe-bg/30">
      {/* Age-up timings */}
      <div>
        <div className="text-gray-500 font-semibold mb-1">Age Timings</div>
        <div className="flex gap-3">
          {[2, 3, 4].map(age => {
            const timing = ageUpTimings.find(a => a.age === age);
            const names = ['', '', 'Feudal', 'Castle', 'Imperial'];
            return (
              <div key={age} className="flex items-center gap-1">
                <span className="text-gray-500">{names[age]}:</span>
                <span className={timing ? 'text-gray-200' : 'text-gray-600'}>
                  {timing ? formatTime(timing.time) : '--'}
                </span>
              </div>
            );
          })}
        </div>
        {ageUpTimings.length > 0 && (
          <div className="flex gap-2 mt-1">
            {ageUpTimings.map(a => a.landmarkName && (
              <div key={a.age} className="flex items-center gap-1 text-[10px] text-gray-500">
                {a.landmarkIcon && (
                  <img src={a.landmarkIcon} alt="" className="w-4 h-4" loading="lazy" />
                )}
                <span>{a.landmarkName}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* First military */}
      {firstMilitaryUnit && (
        <div className="flex items-center gap-1 text-gray-400">
          <span className="text-gray-500">1st Military:</span>
          <span className="text-gray-200">{formatTime(firstMilitaryUnit.time)}</span>
          {firstMilitaryUnit.icon && (
            <img src={firstMilitaryUnit.icon} alt="" className="w-4 h-4" loading="lazy" />
          )}
          <span>{firstMilitaryUnit.name}</span>
        </div>
      )}

      {/* Unit composition */}
      {unitComposition.length > 0 && (
        <div>
          <div className="text-gray-500 font-semibold mb-1">Units ({analysis.totalMilitaryUnits})</div>
          <div className="space-y-1">
            {unitComposition.slice(0, 5).map((u, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className="h-2 bg-aoe-gold/60 rounded-sm"
                  style={{ width: `${Math.max((u.count / maxUnitCount) * 100, 8)}%`, minWidth: '8px' }}
                />
                <span className="text-gray-300 font-mono w-6 text-right">{u.count}</span>
                {u.icon && <img src={u.icon} alt="" className="w-4 h-4" loading="lazy" />}
                <span className="text-gray-400 truncate">{u.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resource spending */}
      <div>
        <div className="text-gray-500 font-semibold mb-1">Resources Spent</div>
        <div className="flex h-3 rounded-sm overflow-hidden bg-aoe-bg">
          {(['food', 'wood', 'stone', 'gold'] as const).map(r => {
            const val = resourceSpending[r];
            if (val <= 0) return null;
            const pct = (val / totalRes) * 100;
            return (
              <div
                key={r}
                className={`${RESOURCE_COLORS[r]} opacity-70`}
                style={{ width: `${pct}%` }}
                title={`${r}: ${val}`}
              />
            );
          })}
        </div>
        <div className="flex gap-3 mt-1 text-[10px] text-gray-500">
          {resourceSpending.food > 0 && <span className="text-red-400">{resourceSpending.food}F</span>}
          {resourceSpending.wood > 0 && <span className="text-amber-600">{resourceSpending.wood}W</span>}
          {resourceSpending.stone > 0 && <span className="text-gray-400">{resourceSpending.stone}S</span>}
          {resourceSpending.gold > 0 && <span className="text-yellow-400">{resourceSpending.gold}G</span>}
        </div>
      </div>
    </div>
  );
}
