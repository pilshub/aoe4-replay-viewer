interface Props {
  narrative: string;
}

export function NarrativeSection({ narrative }: Props) {
  return (
    <div className="mx-8 my-6 relative">
      {/* Card with parchment subtle texture */}
      <div
        className="relative p-6 rounded-lg border border-aoe-gold/20 shadow-gold-glow overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(26,26,36,0.95) 0%, rgba(13,13,18,0.98) 100%)',
        }}
      >
        {/* Subtle parchment bg */}
        <div
          className="absolute inset-0 opacity-[0.03] bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: "url('/assets/parchment.webp')" }}
        />

        {/* Gold accent line at top */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)' }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-aoe-gold">&#9876;</span>
            <h3 className="font-cinzel text-sm tracking-[0.15em] text-aoe-gold font-semibold uppercase">
              Match Analysis
            </h3>
            <span className="text-aoe-gold">&#9876;</span>
          </div>
          <div className="font-crimson text-[15px] text-aoe-text leading-relaxed whitespace-pre-line">
            {narrative}
          </div>
        </div>
      </div>
    </div>
  );
}
