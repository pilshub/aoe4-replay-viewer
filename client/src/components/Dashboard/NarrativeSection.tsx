import { useMemo, type ReactNode } from 'react';

interface Props {
  narrative: string;
}

// ── Token types ──────────────────────────────────────────────

type NarrativePart =
  | { type: 'text'; value: string }
  | { type: 'icon'; url: string; name: string }
  | { type: 'civ'; url: string; name: string }
  | { type: 'age'; ageNum: number; name: string }
  | { type: 'time'; value: string }
  | { type: 'header'; value: string };

// ── Age badge config ─────────────────────────────────────────

const AGE_STYLES: Record<number, { numeral: string; bg: string; border: string; text: string }> = {
  1: { numeral: 'I', bg: 'bg-stone-800/60', border: 'border-stone-500/40', text: 'text-stone-300' },
  2: { numeral: 'II', bg: 'bg-emerald-900/50', border: 'border-emerald-500/40', text: 'text-emerald-300' },
  3: { numeral: 'III', bg: 'bg-blue-900/50', border: 'border-blue-400/40', text: 'text-blue-300' },
  4: { numeral: 'IV', bg: 'bg-amber-900/50', border: 'border-amber-400/50', text: 'text-amber-300' },
};

// ── Parser ───────────────────────────────────────────────────

function parseNarrative(text: string): NarrativePart[] {
  const parts: NarrativePart[] = [];
  const regex = /\{\{(icon|civ):([^|]+)\|([^}]+)\}\}|\{\{age:(\d)\|([^}]+)\}\}|\{\{time:([^}]+)\}\}|\{\{header:([^}]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    if (match[1] === 'icon') {
      parts.push({ type: 'icon', url: match[2], name: match[3] });
    } else if (match[1] === 'civ') {
      parts.push({ type: 'civ', url: match[2], name: match[3] });
    } else if (match[4]) {
      parts.push({ type: 'age', ageNum: parseInt(match[4]), name: match[5] });
    } else if (match[6]) {
      parts.push({ type: 'time', value: match[6] });
    } else if (match[7]) {
      parts.push({ type: 'header', value: match[7] });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

// ── Inline markdown (bold) ───────────────────────────────────

function renderInlineMarkdown(text: string): ReactNode {
  const boldRegex = /\*\*([^*]+)\*\*/g;
  const fragments: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = boldRegex.exec(text)) !== null) {
    if (m.index > last) fragments.push(text.slice(last, m.index));
    fragments.push(
      <span key={`b${m.index}`} className="font-semibold text-aoe-parchment">{m[1]}</span>
    );
    last = boldRegex.lastIndex;
  }

  if (last === 0) return text;
  if (last < text.length) fragments.push(text.slice(last));
  return <>{fragments}</>;
}

// ── Text with paragraph breaks + quantity detection ──────────

function renderText(value: string, nextIsIcon: boolean): ReactNode {
  const paragraphs = value.split(/\n\n+/);
  const elements: ReactNode[] = [];
  let k = 0;

  for (let p = 0; p < paragraphs.length; p++) {
    // Paragraph spacer
    if (p > 0) {
      elements.push(<span key={`pg-${k++}`} className="block h-5" />);
    }

    const para = paragraphs[p];
    const isLastPara = p === paragraphs.length - 1;
    const lines = para.split('\n');

    for (let l = 0; l < lines.length; l++) {
      if (l > 0) elements.push(<br key={`lb-${k++}`} />);

      const line = lines[l];
      const isLastLine = isLastPara && l === lines.length - 1;

      // Quantity detection: "...109 " before an icon
      if (isLastLine && nextIsIcon) {
        const qtyMatch = line.match(/^([\s\S]*?)(\d+)x?\s*$/);
        if (qtyMatch) {
          if (qtyMatch[1]) {
            elements.push(<span key={`t-${k++}`}>{renderInlineMarkdown(qtyMatch[1])}</span>);
          }
          elements.push(
            <span key={`q-${k++}`} className="text-aoe-gold font-bold tabular-nums">
              {qtyMatch[2]}x
            </span>
          );
          continue;
        }
      }

      if (line.trim()) {
        elements.push(<span key={`t-${k++}`}>{renderInlineMarkdown(line)}</span>);
      }
    }
  }

  return <>{elements}</>;
}

// ── Section header with age detection ────────────────────────

function renderHeader(value: string, isFirst: boolean): ReactNode {
  const ageMatch = value.match(/^(Dark Age|Feudal Age|Castle Age|Imperial Age|Edad Oscura|Edad Feudal|Edad de los Castillos|Edad Imperial)$/i);

  const ageMap: Record<string, number> = {
    'dark age': 1, 'edad oscura': 1,
    'feudal age': 2, 'edad feudal': 2,
    'castle age': 3, 'edad de los castillos': 3,
    'imperial age': 4, 'edad imperial': 4,
  };

  if (ageMatch) {
    const ageNum = ageMap[ageMatch[1].toLowerCase()] ?? 1;
    const style = AGE_STYLES[ageNum];
    return (
      <div className={`${isFirst ? 'mt-1' : 'mt-10'} mb-4`}>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded border text-sm font-bold tracking-wide ${style.bg} ${style.border} ${style.text}`}
          >
            <span className="font-cinzel text-base">{style.numeral}</span>
            <span>{value}</span>
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-aoe-gold/25 to-transparent" />
        </div>
      </div>
    );
  }

  // Verdict / other headers
  const isVerdict = /verdict|veredicto/i.test(value);
  return (
    <div className={`${isFirst ? 'mt-1' : 'mt-10'} mb-4`}>
      <div className="flex items-center gap-3">
        {isVerdict && <span className="text-aoe-gold text-xl">&#9876;</span>}
        <span className={`font-cinzel tracking-[0.12em] font-semibold uppercase ${isVerdict ? 'text-aoe-gold text-base' : 'text-aoe-gold-dark text-sm'}`}>
          {value}
        </span>
        {isVerdict && <span className="text-aoe-gold text-xl">&#9876;</span>}
        <div className="flex-1 h-px bg-gradient-to-r from-aoe-gold/25 to-transparent" />
      </div>
    </div>
  );
}

// ── Shared vertical-align for all inline elements ────────────

const ICON_VALIGN = { verticalAlign: '-7px' } as const;
const CIV_VALIGN = { verticalAlign: '-9px' } as const;
const BADGE_VALIGN = { verticalAlign: '-3px' } as const;

// ── Main component ───────────────────────────────────────────

export function NarrativeSection({ narrative }: Props) {
  const parts = useMemo(() => parseNarrative(narrative), [narrative]);

  const seenCivs = useMemo(() => new Set<string>(), [narrative]);
  let headerCount = 0;

  return (
    <div className="mx-8 my-6 relative">
      <div
        className="relative p-8 pb-10 rounded-lg border border-aoe-gold/20 shadow-gold-glow overflow-hidden"
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
          {/* Title */}
          <div className="flex items-center gap-3 mb-7">
            <span className="text-aoe-gold text-xl">&#9876;</span>
            <h3 className="font-cinzel text-base tracking-[0.15em] text-aoe-gold font-semibold uppercase">
              Match Analysis
            </h3>
            <span className="text-aoe-gold text-xl">&#9876;</span>
          </div>

          {/* Narrative content */}
          <div className="font-crimson text-[17px] text-aoe-text leading-[2.15]">
            {parts.map((part, i) => {
              const nextPart = parts[i + 1];

              switch (part.type) {
                case 'text':
                  return <span key={i}>{renderText(part.value, nextPart?.type === 'icon')}</span>;

                case 'icon':
                  return (
                    <img
                      key={i}
                      src={part.url}
                      alt={part.name}
                      title={part.name}
                      className="inline w-7 h-7 rounded-sm mx-[2px]"
                      style={{
                        ...ICON_VALIGN,
                        filter: 'drop-shadow(0 0 3px rgba(201, 168, 76, 0.25))',
                      }}
                      loading="lazy"
                    />
                  );

                case 'civ': {
                  const civKey = part.url;
                  const isFirstMention = !seenCivs.has(civKey);
                  seenCivs.add(civKey);

                  if (isFirstMention) {
                    return (
                      <span key={i} className="mx-[2px]">
                        <img
                          src={part.url}
                          alt={part.name}
                          className="inline w-8 h-8 rounded-sm"
                          style={{
                            ...CIV_VALIGN,
                            boxShadow: '0 0 8px rgba(201, 168, 76, 0.4)',
                          }}
                          loading="lazy"
                        />
                        <span className="font-semibold text-aoe-parchment text-lg ml-1.5">{part.name}</span>
                      </span>
                    );
                  }

                  return (
                    <img
                      key={i}
                      src={part.url}
                      alt={part.name}
                      title={part.name}
                      className="inline w-6 h-6 rounded-sm mx-[2px] opacity-85"
                      style={ICON_VALIGN}
                      loading="lazy"
                    />
                  );
                }

                case 'age': {
                  const style = AGE_STYLES[part.ageNum] ?? AGE_STYLES[1];
                  return (
                    <span
                      key={i}
                      className={`inline-block mx-[3px] px-2 py-[1px] rounded border text-[13px] font-semibold leading-tight ${style.bg} ${style.border} ${style.text}`}
                      style={BADGE_VALIGN}
                      title={part.name}
                    >
                      <span className="font-cinzel text-xs">{style.numeral}</span>
                    </span>
                  );
                }

                case 'time':
                  return (
                    <span key={i} className="text-aoe-gold font-semibold tabular-nums">
                      {part.value}
                    </span>
                  );

                case 'header': {
                  const isFirst = headerCount === 0;
                  headerCount++;
                  seenCivs.clear();
                  return <span key={i}>{renderHeader(part.value, isFirst)}</span>;
                }

                default:
                  return null;
              }
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
