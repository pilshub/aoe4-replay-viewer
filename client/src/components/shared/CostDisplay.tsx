import type { ResourceCosts } from '../../types/replay.types';

const RESOURCES: { key: keyof ResourceCosts; label: string; color: string }[] = [
  { key: 'food', label: 'F', color: 'text-red-400' },
  { key: 'wood', label: 'W', color: 'text-amber-600' },
  { key: 'stone', label: 'S', color: 'text-gray-400' },
  { key: 'gold', label: 'G', color: 'text-yellow-400' },
];

export function CostDisplay({ costs, compact }: { costs: ResourceCosts; compact?: boolean }) {
  const entries = RESOURCES.filter(r => costs[r.key] > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {entries.map(({ key, label, color }) => (
        <span key={key} className={`${color} ${compact ? 'text-[9px]' : 'text-[10px]'} font-mono`}>
          {costs[key]}{label}
        </span>
      ))}
    </div>
  );
}
