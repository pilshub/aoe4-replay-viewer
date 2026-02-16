import type { StrategyType } from '../../types/replay.types';

const STRATEGY_STYLES: Record<StrategyType, { bg: string; text: string }> = {
  'Feudal Rush':    { bg: 'bg-red-500/20 border-red-500/40', text: 'text-red-400' },
  'Fast Castle':    { bg: 'bg-blue-500/20 border-blue-500/40', text: 'text-blue-400' },
  'Economic Boom':  { bg: 'bg-green-500/20 border-green-500/40', text: 'text-green-400' },
  'Tower Rush':     { bg: 'bg-orange-500/20 border-orange-500/40', text: 'text-orange-400' },
  'All-in':         { bg: 'bg-purple-500/20 border-purple-500/40', text: 'text-purple-400' },
  'Standard':       { bg: 'bg-gray-500/20 border-gray-500/40', text: 'text-gray-400' },
};

export function StrategyBadge({ strategy, reasons }: { strategy: StrategyType; reasons?: string[] }) {
  const style = STRATEGY_STYLES[strategy] ?? STRATEGY_STYLES['Standard'];

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-md border ${style.bg} ${style.text}`}>
        {strategy}
      </span>
      {reasons && reasons.length > 0 && (
        <div className="text-[10px] text-gray-500 leading-tight">
          {reasons.join(' · ')}
        </div>
      )}
    </div>
  );
}
