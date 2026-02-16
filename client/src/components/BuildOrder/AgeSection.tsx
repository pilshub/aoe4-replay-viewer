import type { BuildOrderEntry } from '../../types/replay.types';
import { BuildOrderRow, type AggregatedEntry } from './BuildOrderRow';
import type { ResourceCosts } from '../../types/replay.types';

const AGE_NAMES: Record<number, string> = {
  1: 'DARK AGE',
  2: 'FEUDAL AGE',
  3: 'CASTLE AGE',
  4: 'IMPERIAL AGE',
};

const AGE_STYLES: Record<number, { text: string; border: string; bg: string }> = {
  1: { text: 'text-gray-400', border: 'border-gray-600', bg: 'bg-gray-400/5' },
  2: { text: 'text-green-400', border: 'border-green-600', bg: 'bg-green-400/5' },
  3: { text: 'text-blue-400', border: 'border-blue-600', bg: 'bg-blue-400/5' },
  4: { text: 'text-purple-400', border: 'border-purple-600', bg: 'bg-purple-400/5' },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function multiplyCosts(costs: ResourceCosts, count: number): ResourceCosts {
  return {
    food: costs.food * count,
    wood: costs.wood * count,
    stone: costs.stone * count,
    gold: costs.gold * count,
    total: costs.total * count,
    popcap: costs.popcap * count,
    time: costs.time,
  };
}

function aggregateConsecutive(events: BuildOrderEntry[]): AggregatedEntry[] {
  const result: AggregatedEntry[] = [];

  for (const event of events) {
    if (event.isAgeUp) {
      // Age-ups never aggregate
      result.push({
        count: 1, firstTime: event.time, lastTime: event.time,
        name: event.name, icon: event.icon, displayClass: event.displayClass,
        costs: event.costs, totalCosts: event.costs,
        baseId: event.baseId, eventType: event.eventType,
        isAgeUp: true, targetAge: event.targetAge,
      });
      continue;
    }

    const prev = result[result.length - 1];
    if (prev &&
        !prev.isAgeUp &&
        prev.baseId === event.baseId &&
        prev.eventType === event.eventType &&
        event.time - prev.lastTime < 60) {
      prev.count++;
      prev.lastTime = event.time;
      if (prev.costs) {
        prev.totalCosts = multiplyCosts(prev.costs, prev.count);
      }
    } else {
      result.push({
        count: 1, firstTime: event.time, lastTime: event.time,
        name: event.name, icon: event.icon, displayClass: event.displayClass,
        costs: event.costs, totalCosts: event.costs,
        baseId: event.baseId, eventType: event.eventType,
        isAgeUp: false, targetAge: 0,
      });
    }
  }

  return result;
}

interface AgeSectionProps {
  age: number;
  ageUpTime?: number;
  landmarkName?: string;
  landmarkIcon?: string;
  events: BuildOrderEntry[];
  onTimeClick: (time: number) => void;
}

export function AgeSection({ age, ageUpTime, landmarkName, landmarkIcon, events, onTimeClick }: AgeSectionProps) {
  const style = AGE_STYLES[age] ?? AGE_STYLES[1];
  const aggregated = aggregateConsecutive(events);

  if (aggregated.length === 0 && age > 1 && !ageUpTime) return null;

  return (
    <div className={`border-l-2 ${style.border} mb-1`}>
      {/* Age header */}
      <div className={`flex items-center gap-2 px-3 py-1.5 ${style.bg}`}>
        <span className={`text-[10px] font-bold tracking-wider ${style.text}`}>
          {AGE_NAMES[age] ?? `AGE ${age}`}
        </span>
        {ageUpTime !== undefined && (
          <span className="text-[10px] text-gray-500 font-mono">
            {formatTime(ageUpTime)}
          </span>
        )}
        {landmarkName && (
          <div className="flex items-center gap-1 ml-auto">
            {landmarkIcon && (
              <img src={landmarkIcon} alt="" className="w-4 h-4" loading="lazy" />
            )}
            <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{landmarkName}</span>
          </div>
        )}
      </div>

      {/* Events */}
      {aggregated.map((item, i) => (
        <BuildOrderRow
          key={i}
          item={item}
          onClick={() => onTimeClick(item.firstTime)}
        />
      ))}

      {aggregated.length === 0 && (
        <div className="px-3 py-1 text-[10px] text-gray-600">No events</div>
      )}
    </div>
  );
}
