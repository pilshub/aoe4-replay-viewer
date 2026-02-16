import type { ResourceCosts } from '../../types/replay.types';
import { CostDisplay } from '../shared/CostDisplay';

export interface AggregatedEntry {
  count: number;
  firstTime: number;
  lastTime: number;
  name: string;
  icon: string;
  displayClass: string;
  costs: ResourceCosts | null;
  totalCosts: ResourceCosts | null;
  baseId: string;
  eventType: string;
  isAgeUp: boolean;
  targetAge: number;
}

const EVENT_COLORS: Record<string, string> = {
  construct: 'text-blue-300',
  build_unit: 'text-green-300',
  upgrade: 'text-yellow-300',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function BuildOrderRow({ item, onClick }: { item: AggregatedEntry; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-1 text-left
        hover:bg-white/5 transition-colors group"
    >
      {/* Time */}
      <span className="text-[11px] text-gray-500 w-10 shrink-0 font-mono">
        {formatTime(item.firstTime)}
      </span>

      {/* Icon */}
      {item.icon && (
        <img
          src={item.icon}
          alt={item.name}
          className="w-6 h-6 shrink-0 object-contain"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      {/* Count badge */}
      {item.count > 1 && (
        <span className="text-[10px] font-bold text-aoe-gold bg-aoe-gold/10 px-1.5 py-0.5 rounded min-w-[24px] text-center">
          {item.count}x
        </span>
      )}

      {/* Name */}
      <span className={`text-xs flex-1 truncate ${EVENT_COLORS[item.eventType] ?? 'text-gray-300'}`}>
        {item.name}
      </span>

      {/* Costs */}
      {item.totalCosts && <CostDisplay costs={item.totalCosts} compact />}
    </button>
  );
}
