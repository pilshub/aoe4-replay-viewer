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
  ageSections.push('1. **Dark Age** (0:00 to Feudal) - Opening build, villager count, strategy signals');
  if (maxAgeReached >= 2) ageSections.push('2. **Feudal Age** - Military choices, first engagements, economic balance');
  if (maxAgeReached >= 3) ageSections.push('3. **Castle Age** - Power spikes, key tech/unit choices, major battles');
  if (maxAgeReached >= 4) ageSections.push('4. **Imperial Age** - Late-game decisions, final engagements');
  ageSections.push(`${ageSections.length + 1}. **Verdict** - Why the winner won, what the loser could have done differently. Reference specific counter-unit choices and timing mistakes.`);

  const ageConstraint = maxAgeReached < 4
    ? `\n\nCRITICAL: The highest age reached in this match is ${AGE_NAMES_NARRATOR[maxAgeReached]}. DO NOT write about ${maxAgeReached < 3 ? 'Castle Age or ' : ''}Imperial Age. DO NOT invent or speculate about ages that were never reached. Only analyze the ages that actually occurred in the data.`
    : '';

  return `You are a professional Age of Empires 4 match analyst and esports caster.
Write an engaging, insightful match analysis in 400-600 words.
Use specific timestamps (mm:ss format) when referencing events.
${playerRefInstruction}

Structure your analysis BY AGE with these sections:
${ageSections.join('\n')}

STRICT RULES:
- ONLY write sections for ages that appear in the data. The data will tell you "AGES PRESENT IN THIS MATCH".
- Never fabricate data, timestamps, unit counts, or events not provided in the input.
- Never invent battles, unit numbers, or engagements that are not in the data.
- Be specific about unit names, building names, and strategies.
- When evaluating army composition, consider counter-unit relationships.
- When evaluating timing, compare against standard benchmarks.
- Be analytical but engaging, like a top-tier esports commentator.${ageConstraint}

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
      temperature: 0.7,
      max_tokens: 1200,
    });

    const narrative = response.choices[0]?.message?.content ?? null;
    if (narrative) {
      console.log(`[ai-narrator] Narrative generated (${narrative.length} chars)`);
    }
    return narrative;
  } catch (err: any) {
    console.error(`[ai-narrator] Failed: ${err.message}`);
    return null;
  }
}
