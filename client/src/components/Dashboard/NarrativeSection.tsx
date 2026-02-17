import { useMemo } from 'react';

interface Props {
  narrative: string;
}

/** Parse narrative text, replacing {{icon:url}}Name tokens with inline images. */
function parseNarrative(text: string): Array<{ type: 'text'; value: string } | { type: 'icon'; url: string; name: string }> {
  const parts: Array<{ type: 'text'; value: string } | { type: 'icon'; url: string; name: string }> = [];
  const regex = /\{\{icon:([^|]+)\|([^}]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'icon', url: match[1], name: match[2] });
    lastIndex = regex.lastIndex;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

export function NarrativeSection({ narrative }: Props) {
  const parts = useMemo(() => parseNarrative(narrative), [narrative]);

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
            {parts.map((part, i) =>
              part.type === 'text' ? (
                <span key={i}>{part.value}</span>
              ) : (
                <span key={i} className="inline-flex items-center gap-0.5 align-baseline">
                  <img
                    src={part.url}
                    alt={part.name}
                    className="w-5 h-5 inline -mt-0.5 rounded-sm"
                    loading="lazy"
                  />
                  <span>{part.name}</span>
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
