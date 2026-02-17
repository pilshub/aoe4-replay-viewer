import OpenAI from 'openai';
import type { MatchAnalysisReport } from './match-analyzer';
import type { PlayerAnalysis } from './strategy-analyzer';
import type { PlayerInfo } from './transformer.service';
import {
  COUNTER_UNIT_MATRIX, TIMING_BENCHMARKS, STRATEGY_PATTERNS,
  ANALYSIS_GUIDELINES, getCivKnowledge,
} from '../data/aoe4-meta';

const AGE_NAMES_NARRATOR = ['', 'Dark Age', 'Feudal Age', 'Castle Age', 'Imperial Age'];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildPrompt(
  report: MatchAnalysisReport,
  playerAnalyses: PlayerAnalysis[],
  players: PlayerInfo[],
  duration: number,
  mapName: string,
): string {
  const lines: string[] = [];

  // Match info
  lines.push(`Map: ${mapName}, Duration: ${formatTime(duration)}`);
  lines.push('');

  // Determine max age reached per player from age phases
  const maxAgePerPlayer = new Map<number, number>();
  for (const phase of report.agePhases) {
    const current = maxAgePerPlayer.get(phase.playerId) ?? 0;
    if (phase.ageNumber > current) maxAgePerPlayer.set(phase.playerId, phase.ageNumber);
  }
  const globalMaxAge = Math.max(...maxAgePerPlayer.values(), 1);

  // Players
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const a = playerAnalyses.find(pa => pa.playerId === p.playerId);
    const maxAge = maxAgePerPlayer.get(p.playerId) ?? 1;
    lines.push(`Player ${i + 1}: ${p.name} (${p.civ}) - ${p.outcome}`);
    lines.push(`  MAX AGE REACHED: ${AGE_NAMES_NARRATOR[maxAge] || `Age ${maxAge}`}`);
    if (a) {
      lines.push(`  Strategy: ${a.strategy} (${Math.round(a.strategyConfidence * 100)}%)`);
      lines.push(`  Age timings: ${a.ageUpTimings.map(t => `${t.ageName} at ${formatTime(t.time)}`).join(', ') || 'None detected'}`);
      lines.push(`  Military: ${a.totalMilitaryUnits} units, ${a.militaryBuildingCount} prod buildings, ${a.townCenterCount} TCs`);
      lines.push(`  Resources spent: F${a.resourceSpending.food} W${a.resourceSpending.wood} S${a.resourceSpending.stone} G${a.resourceSpending.gold}`);
      if (a.unitComposition.length > 0) {
        lines.push(`  Army comp: ${a.unitComposition.slice(0, 5).map(u => `${u.count}x ${u.name}`).join(', ')}`);
      }
      if (a.firstMilitaryUnit) {
        lines.push(`  First military: ${a.firstMilitaryUnit.name} at ${formatTime(a.firstMilitaryUnit.time)}`);
      }
    }
    lines.push('');
  }

  // Explicit constraint about ages
  const agesList = [];
  for (let a = 1; a <= globalMaxAge; a++) agesList.push(AGE_NAMES_NARRATOR[a]);
  lines.push(`AGES PRESENT IN THIS MATCH: ${agesList.join(', ')}. DO NOT write about any age beyond ${AGE_NAMES_NARRATOR[globalMaxAge]}.`);
  lines.push('');

  // Age phases
  if (report.agePhases.length > 0) {
    lines.push('=== AGE-BY-AGE BREAKDOWN ===');
    const ageGroups = new Map<number, typeof report.agePhases>();
    for (const phase of report.agePhases) {
      const group = ageGroups.get(phase.ageNumber) ?? [];
      group.push(phase);
      ageGroups.set(phase.ageNumber, group);
    }

    for (const [ageNum, phases] of [...ageGroups.entries()].sort((a, b) => a[0] - b[0])) {
      lines.push(`\n--- ${phases[0].ageName} ---`);
      for (const phase of phases) {
        const pNum = phase.playerId + 1;
        lines.push(`  Player ${pNum}: ${formatTime(phase.startTime)}-${formatTime(phase.endTime)} (${Math.round(phase.endTime - phase.startTime)}s)`);
        if (phase.landmark) lines.push(`    Landmark: ${phase.landmark}`);
        lines.push(`    Villagers: +${phase.villagersProduced}, Military: +${phase.militaryProduced}, Buildings: +${phase.buildingsConstructed}, Techs: +${phase.technologiesResearched}`);
        lines.push(`    Spent: ${phase.totalSpent} total (${phase.militarySpent} military)`);
        if (phase.keyUnits.length > 0) {
          lines.push(`    Key units: ${phase.keyUnits.map(u => `${u.count}x ${u.name}`).join(', ')}`);
        }
        if (phase.keyBuildings.length > 0) {
          lines.push(`    Key buildings: ${phase.keyBuildings.map(b => `${b.count}x ${b.name}`).join(', ')}`);
        }
        if (phase.keyTechs.length > 0) {
          lines.push(`    Techs: ${phase.keyTechs.map(t => t.name).join(', ')}`);
        }
      }
    }
    lines.push('');
  }

  // Villager gaps
  if (report.villagerGaps.length > 0) {
    lines.push('Villager Production Gaps (idle Town Center):');
    for (const gap of report.villagerGaps) {
      lines.push(`  Player ${gap.playerId + 1}: ${formatTime(gap.startTime)}-${formatTime(gap.endTime)} (${Math.round(gap.duration)}s idle)`);
    }
    lines.push('');
  }

  // Combat engagements (only medium/high intensity)
  const significantFights = report.combatEngagements.filter(f => f.intensity !== 'low');
  if (significantFights.length > 0) {
    lines.push('Combat Engagements (attack command volume, NOT actual unit counts):');
    for (const fight of significantFights) {
      const winner = fight.estimatedWinner != null ? `P${fight.estimatedWinner + 1} more aggressive` : 'even';
      lines.push(`  ${formatTime(fight.startTime)}-${formatTime(fight.endTime)}: ${fight.intensity} intensity (${winner})`);
    }
    lines.push('');
  }

  // Key moments
  if (report.keyMoments.length > 0) {
    lines.push('Key Moments:');
    for (const m of report.keyMoments) {
      lines.push(`  ${formatTime(m.time)}: ${m.description}`);
    }
  }

  return lines.join('\n');
}

function buildSystemPrompt(players: PlayerInfo[], language: string, maxAgeReached: number): string {
  // Build civ-specific knowledge section
  const civSections: string[] = [];
  for (const p of players) {
    const knowledge = getCivKnowledge(p.civ);
    if (knowledge) {
      civSections.push(`${p.civ}: ${knowledge}`);
    }
  }

  const civKnowledge = civSections.length > 0
    ? `\n\nCIVILIZATIONS IN THIS MATCH:\n${civSections.join('\n\n')}`
    : '';

  const languageInstruction = language && language !== 'en'
    ? `\n\nIMPORTANT: Write your entire analysis in ${LANGUAGE_NAMES[language] || language}. All section headers, descriptions, and commentary must be in ${LANGUAGE_NAMES[language] || language}.`
    : '';

  // Determine how to refer to players
  const civs = players.map(p => p.civ).filter(c => c && c !== 'Unknown');
  const sameCiv = civs.length === 2 && civs[0] === civs[1];
  const playerRefInstruction = sameCiv
    ? `Both players are ${civs[0]}. Refer to them by their player names: "${players[0].name}" and "${players[1].name}".`
    : `Refer to each player by their civilization name (e.g. "${civs[0] || 'Player 1'}", "${civs[1] || 'Player 2'}"). Never use "Player 1" or "Player 2".`;

  // Build age sections dynamically based on actual data
  const ageSections: string[] = [];
  ageSections.push('1. **Dark Age** — 1-2 sentences. Villager count, anything unusual.');
  if (maxAgeReached >= 2) ageSections.push('2. **Feudal Age** — Strategy identification (rush/boom/FC?), key military choices, first pressure, eco balance.');
  if (maxAgeReached >= 3) ageSections.push('3. **Castle Age** — Power spikes, tech/unit upgrades, decisive battles, landmark choices.');
  if (maxAgeReached >= 4) ageSections.push('4. **Imperial Age** — Late-game comp, final engagements, endgame execution.');
  ageSections.push(`${ageSections.length + 1}. **Verdict** — (a) Why the winner won (specific decisions/timings). (b) 2-3 concrete recommendations for the loser with exact unit/tech/timing alternatives.`);

  const ageConstraint = maxAgeReached < 4
    ? `\n\nCRITICAL: The highest age reached in this match is ${AGE_NAMES_NARRATOR[maxAgeReached]}. DO NOT write about ${maxAgeReached < 3 ? 'Castle Age or ' : ''}Imperial Age. DO NOT invent or speculate about ages that were never reached. Only analyze the ages that actually occurred in the data.`
    : '';

  return `You are a tactical analyst specializing in Age of Empires 4 competitive matches.
Your tone is precise, technical, and data-driven — like a chess analyst reviewing a game, not a hype caster.
Write 400-500 words. Use timestamps (mm:ss) for every claim.
${playerRefInstruction}

STRUCTURE:
${ageSections.join('\n')}

WRITING RULES:
- Dark Age: 1-2 sentences MAX. Only mention villager count and anything unusual (early military, scout kill, etc.). Most Dark Ages are standard — say so and move on.
- Focus your analysis on the AGE WHERE THE GAME WAS DECIDED. If the game was won in Feudal, spend 60% of your words on Feudal.
- Every claim must reference data from the input. If you don't have data for something, don't mention it.
- NEVER fabricate timestamps, unit counts, battles, or events not in the input data.
- NEVER invent specific numbers for battles (e.g. "X units vs Y units"). You only know total military produced per age, NOT how many were alive at any given moment. Only reference unit counts from the "Key units" and "Army comp" fields.
- Use exact unit names and building names from the data.
- Compare army compositions: don't just list units, explain WHY one comp beats the other (counter-unit logic).
- Compare age-up timings against benchmarks and explain the implications.
- The Verdict section MUST include 2-3 specific, actionable recommendations for the loser. Be concrete: name the exact unit, tech, or timing they should have chosen differently, and explain why it would have worked. Example: "Building Crossbowmen instead of more Spearmen at 8:00 would have countered the Cataphract transition."
- If a player's strategy was detected (Rush, Boom, Fast Castle, All-in), explain whether it was well-executed or where it broke down.${ageConstraint}

KNOWLEDGE BASE:
${COUNTER_UNIT_MATRIX}

${TIMING_BENCHMARKS}

${STRATEGY_PATTERNS}

${ANALYSIS_GUIDELINES}${civKnowledge}${languageInstruction}`;
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ru: 'Russian',
  tr: 'Turkish',
  pl: 'Polish',
};

/**
 * Build a map of entity names → icon URLs from match data.
 */
function buildIconMap(
  report: MatchAnalysisReport,
  playerAnalyses: PlayerAnalysis[],
): Map<string, string> {
  const map = new Map<string, string>();

  // From age phases: keyUnits, keyBuildings, keyTechs
  for (const phase of report.agePhases) {
    for (const u of phase.keyUnits) {
      if (u.icon && u.name) map.set(u.name, u.icon);
    }
    for (const b of phase.keyBuildings) {
      if (b.icon && b.name) map.set(b.name, b.icon);
    }
    for (const t of phase.keyTechs) {
      if (t.icon && t.name) map.set(t.name, t.icon);
    }
  }

  // From player analyses: unitComposition
  for (const pa of playerAnalyses) {
    for (const u of pa.unitComposition) {
      if (u.icon && u.name) map.set(u.name, u.icon);
    }
  }

  return map;
}

/**
 * Common AoE4 plural forms (Man-at-Arms → Men-at-Arms, Spearman → Spearmen, etc.)
 */
function generateVariants(name: string): string[] {
  const variants = [name];
  // man → men
  if (name.includes('man')) variants.push(name.replace(/man\b/i, 'men'));
  if (name.includes('Man')) variants.push(name.replace(/Man\b/, 'Men'));
  // Add plural -s
  if (!name.endsWith('s') && !name.endsWith('y')) variants.push(name + 's');
  // -ry → -ries, -y → -ies
  if (name.endsWith('ry')) variants.push(name.slice(0, -1) + 'ies');
  else if (name.endsWith('y')) variants.push(name.slice(0, -1) + 'ies');
  return variants;
}

/**
 * Replace known unit/building/tech names in narrative text with {{icon:url|Name}} tokens.
 * Replaces every occurrence to make the narrative consistently enriched with icons.
 */
function injectIcons(text: string, iconMap: Map<string, string>): string {
  if (iconMap.size === 0) return text;

  // Build expanded map with plural variants
  const expandedEntries: Array<[string, string]> = [];
  for (const [name, icon] of iconMap) {
    for (const variant of generateVariants(name)) {
      expandedEntries.push([variant, icon]);
    }
  }

  // Sort by name length (longest first) to avoid partial matches
  expandedEntries.sort((a, b) => b[0].length - a[0].length);

  const replaced = new Set<string>();

  for (const [name, icon] of expandedEntries) {
    // Skip if a longer form already replaced this
    const lowerName = name.toLowerCase();
    if (replaced.has(lowerName)) continue;

    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match whole word, case-insensitive, not already inside an icon token
    const regex = new RegExp(`(?<!\\{\\{icon:[^}]*\\|)\\b(${escaped})\\b`, 'i');
    const match = text.match(regex);
    if (match) {
      text = text.replace(regex, `{{icon:${icon}|${match[1]}}}`);
      replaced.add(lowerName);
    }
  }

  return text;
}

export async function generateMatchNarrative(
  report: MatchAnalysisReport,
  playerAnalyses: PlayerAnalysis[],
  players: PlayerInfo[],
  duration: number,
  mapName: string,
  language: string = 'en',
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('[ai-narrator] No OPENAI_API_KEY set, skipping narrative generation');
    return null;
  }

  const client = new OpenAI({ apiKey });
  const userPrompt = buildPrompt(report, playerAnalyses, players, duration, mapName);

  // Determine max age reached from age phases
  let maxAgeReached = 1;
  for (const phase of report.agePhases) {
    if (phase.ageNumber > maxAgeReached) maxAgeReached = phase.ageNumber;
  }

  const systemPrompt = buildSystemPrompt(players, language, maxAgeReached);

  console.log(`[ai-narrator] Generating narrative (${userPrompt.length} chars input, lang=${language})...`);

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this AoE4 match:\n\n${userPrompt}` },
      ],
      temperature: 0.5,
      max_tokens: 1200,
    });

    let narrative = response.choices[0]?.message?.content ?? null;
    if (narrative) {
      console.log(`[ai-narrator] Narrative generated (${narrative.length} chars)`);
      // Post-process: inject icon tokens for known units/buildings/techs
      const iconMap = buildIconMap(report, playerAnalyses);
      narrative = injectIcons(narrative, iconMap);
    }
    return narrative;
  } catch (err: any) {
    console.error(`[ai-narrator] Failed: ${err.message}`);
    return null;
  }
}
