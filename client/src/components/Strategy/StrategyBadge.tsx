import type { StrategyType } from '../../types/replay.types';

const STRATEGY_STYLES: Record<StrategyType, { bg: string; border: string; text: string }> = {
  'Feudal Rush':       { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
  'Fast Castle':       { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  'Semi Fast Castle':  { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-400' },
  'Boom (Double TC)':  { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
  'Boom (Trade)':      { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  'Tower Rush':        { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
  'Standard':          { bg: 'bg-aoe-gold/5', border: 'border-aoe-gold-dark/30', text: 'text-aoe-text-secondary' },
};

export function StrategyBadge({ strategy, reasons }: { strategy: StrategyType; reasons?: string[] }) {
  const style = STRATEGY_STYLES[strategy] ?? STRATEGY_STYLES['Standard'];

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex px-2.5 py-1 text-xs font-cinzel tracking-wider rounded border ${style.bg} ${style.border} ${style.text}`}>
        {strategy}
      </span>
      {reasons && reasons.length > 0 && (
        <div className="text-[10px] text-aoe-text-dim leading-tight font-crimson">
          {reasons.join(' · ')}
        </div>
      )}
    </div>
  );
}
