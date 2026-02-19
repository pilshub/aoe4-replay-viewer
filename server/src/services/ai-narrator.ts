import OpenAI from 'openai';
import type { MatchAnalysisReport } from './match-analyzer';
import type { PlayerAnalysis } from './strategy-analyzer';
import type { PlayerInfo } from './transformer.service';
import type { ReplaySummaryData } from './summary-parser';
import {
  COUNTER_UNIT_MATRIX, TIMING_BENCHMARKS, STRATEGY_PATTERNS,
  ANALYSIS_GUIDELINES, getCivKnowledge,
} from '../data/aoe4-meta';
import { getGlobalIconMap } from '../data/aoe4-data';

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
  summaryData: ReplaySummaryData | null,
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
    lines.push('');
  }

  // Player scores (algorithmic 0-100)
  if (report.playerScores.length > 0) {
    lines.push('=== PLAYER SCORES (0-100) ===');
    for (const ps of report.playerScores) {
      lines.push(`  Player ${ps.playerId + 1}: Macro=${ps.macro.score} (${ps.macro.reasons.join('; ')}), Economy=${ps.economy.score} (${ps.economy.reasons.join('; ')}), Military=${ps.military.score} (${ps.military.reasons.join('; ')}), Tech=${ps.tech.score} (${ps.tech.reasons.join('; ')})`);
    }
    lines.push('');
  }

  // Army snapshots at key moments (show composition evolution)
  if (report.armySnapshots.length > 0) {
    // Pick snapshots at meaningful intervals: ~25%, 50%, 75%, 100% of match duration
    const snapshotTimes = new Set<number>();
    const targetPcts = [0.25, 0.5, 0.75, 1.0];
    for (const pct of targetPcts) {
      const targetTime = Math.floor(duration * pct);
      // Find closest snapshot time
      let closest = report.armySnapshots[0]?.time ?? 0;
      for (const snap of report.armySnapshots) {
        if (Math.abs(snap.time - targetTime) < Math.abs(closest - targetTime)) {
          closest = snap.time;
        }
      }
      snapshotTimes.add(closest);
    }

    lines.push('=== ARMY COMPOSITION OVER TIME (cumulative units produced, not accounting for deaths) ===');
    for (const t of [...snapshotTimes].sort((a, b) => a - b)) {
      lines.push(`  At ${formatTime(t)}:`);
      for (const snap of report.armySnapshots.filter(s => s.time === t)) {
        if (snap.units.length > 0) {
          const unitStr = snap.units.slice(0, 5).map(u => `${u.count}x ${u.name}`).join(', ');
          lines.push(`    Player ${snap.playerId + 1}: ${unitStr} (${snap.totalSupply} supply)`);
        } else {
          lines.push(`    Player ${snap.playerId + 1}: No military`);
        }
      }
    }
    lines.push('');
  }

  // === RICH SUMMARY DATA (from replay binary) ===
  if (summaryData && summaryData.players.length > 0) {
    lines.push('=== COMBAT STATISTICS (actual game data, NOT estimates) ===');
    for (let i = 0; i < summaryData.players.length; i++) {
      const sp = summaryData.players[i];
      const displayName = players[i]?.name ?? sp.playerName;
      const kd = sp.unitsLost > 0 ? (sp.unitsKilled / sp.unitsLost).toFixed(1) : 'N/A';
      const efficiency = sp.unitsKilledResourceValue > 0 && sp.unitsLostResourceValue > 0
        ? (sp.unitsKilledResourceValue / sp.unitsLostResourceValue).toFixed(2)
        : 'N/A';
      lines.push(`  ${displayName}:`);
      lines.push(`    Units killed: ${sp.unitsKilled} (${sp.unitsKilledResourceValue} res value)`);
      lines.push(`    Units lost: ${sp.unitsLost} (${sp.unitsLostResourceValue} res value)`);
      lines.push(`    K/D ratio: ${kd}, Combat efficiency: ${efficiency}x`);
      lines.push(`    Buildings razed: ${sp.buildingsRazed}, Buildings lost: ${sp.buildingsLost}`);
      if (sp.sacredSitesCaptured > 0 || sp.relicsCaptured > 0) {
        lines.push(`    Sacred sites captured: ${sp.sacredSitesCaptured}, Relics: ${sp.relicsCaptured}`);
      }
      lines.push(`    Largest army: ${sp.largestArmy} supply`);
    }
    lines.push('');

    // Resource gathering comparison
    lines.push('=== TOTAL RESOURCES ===');
    for (let i = 0; i < summaryData.players.length; i++) {
      const sp = summaryData.players[i];
      const displayName = players[i]?.name ?? sp.playerName;
      const g = sp.totalResourcesGathered;
      const s = sp.totalResourcesSpent;
      const totalGathered = Math.round(g.food + g.gold + g.stone + g.wood);
      const totalSpent = Math.round(s.food + s.gold + s.stone + s.wood);
      lines.push(`  ${displayName}: Gathered ${totalGathered} (F:${Math.round(g.food)} G:${Math.round(g.gold)} S:${Math.round(g.stone)} W:${Math.round(g.wood)}) | Spent ${totalSpent}`);
    }
    lines.push('');

    // Score timeline (show key moments)
    const firstPlayer = summaryData.players[0];
    if (firstPlayer?.timeline.length > 0) {
      lines.push('=== IN-GAME SCORE TIMELINE ===');
      // Show scores at 25%, 50%, 75%, end
      const tl = firstPlayer.timeline;
      const indices = [
        Math.floor(tl.length * 0.25),
        Math.floor(tl.length * 0.5),
        Math.floor(tl.length * 0.75),
        tl.length - 1,
      ].filter((v, i, a) => a.indexOf(v) === i);

      for (const idx of indices) {
        const ts = tl[idx]?.timestamp ?? 0;
        lines.push(`  At ${formatTime(ts)}:`);
        for (let p = 0; p < summaryData.players.length; p++) {
          const ptl = summaryData.players[p]?.timeline[idx];
          if (ptl) {
            const displayName = players[p]?.name ?? summaryData.players[p].playerName;
            lines.push(`    ${displayName}: Score ${Math.round(ptl.scoreTotal)} (Eco:${Math.round(ptl.scoreEconomy)} Mil:${Math.round(ptl.scoreMilitary)} Tech:${Math.round(ptl.scoreTechnology)})`);
          }
        }
      }
      lines.push('');
    }
  }

  // Economy comparison at end of match
  if (report.economyTimeline.length > 0) {
    lines.push('=== ECONOMY SUMMARY ===');
    for (const pid of [...new Set(report.economyTimeline.map(e => e.playerId))]) {
      const playerSnaps = report.economyTimeline.filter(s => s.playerId === pid);
      const final = playerSnaps[playerSnaps.length - 1];
      if (final) {
        const milPct = Math.round(final.militaryRatio * 100);
        lines.push(`  Player ${pid + 1}: ${final.totalSpent} total spent (${milPct}% military, ${100 - milPct}% eco+tech)`);
      }
    }
    lines.push('');
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
- If COMBAT STATISTICS are provided, use them for precise claims: K/D ratio, combat efficiency, units killed/lost, resource value traded. These are REAL game data.
- If COMBAT STATISTICS are NOT provided, do NOT invent specific numbers for battles. Only reference unit counts from the "Key units" and "Army comp" fields.
- Use exact unit names and building names from the data.
- Compare army compositions: don't just list units, explain WHY one comp beats the other (counter-unit logic).
- Compare age-up timings against benchmarks and explain the implications.
- The Verdict section MUST include 2-3 specific, actionable recommendations for the loser. Be concrete: name the exact unit, tech, or timing they should have chosen differently, and explain why it would have worked. Example: "Building Crossbowmen instead of more Spearmen at 8:00 would have countered the Cataphract transition."
- If a player's strategy was detected (Rush, Boom, Fast Castle, Semi Fast Castle, Tower Rush), explain whether it was well-executed or where it broke down.
- Use Player Scores to support your analysis — a low Macro score means villager production issues, low Military means fewer units or lost engagements.
- Use Army Composition snapshots to track how each player's army evolved. Note critical moments where one player's comp countered the other.
- Use Economy Summary to assess commitment: >60% military spending = aggressive, <30% = booming.${ageConstraint}

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
 * Build a comprehensive map of entity names → icon URLs.
 * Starts with the global map (ALL game entities), then overrides with match-specific data.
 */
function buildIconMap(
  report: MatchAnalysisReport,
  playerAnalyses: PlayerAnalysis[],
): Map<string, string> {
  // Start with global icon map (all 955+ entities from game data)
  const globalMap = getGlobalIconMap();
  const map = new Map<string, string>(globalMap);

  // Override with match-specific data (more accurate icons for this specific match)
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
    if (phase.landmark && phase.landmarkIcon) {
      map.set(phase.landmark, phase.landmarkIcon);
    }
  }

  for (const pa of playerAnalyses) {
    for (const u of pa.unitComposition) {
      if (u.icon && u.name) map.set(u.name, u.icon);
    }
    for (const a of pa.ageUpTimings) {
      if (a.landmarkName && a.landmarkIcon) {
        map.set(a.landmarkName, a.landmarkIcon);
      }
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
 * Uses a safe two-pass approach: first protect existing tokens, then inject, then restore.
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

  // Split text into segments: "safe to replace" vs "inside markdown/urls"
  // We'll work on a simple approach: do replacements, then verify no nesting
  const replaced = new Set<string>();

  for (const [name, icon] of expandedEntries) {
    const lowerName = name.toLowerCase();
    if (replaced.has(lowerName)) continue;

    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escaped})\\b`, 'ig');

    // Find all matches and only replace ones NOT inside an existing {{icon:...}} token
    let match: RegExpExecArray | null;
    let didReplace = false;
    const tokenRanges: Array<[number, number]> = [];

    // Find all existing token ranges
    const tokenRegex = /\{\{icon:[^}]*\}\}/g;
    let tokenMatch: RegExpExecArray | null;
    while ((tokenMatch = tokenRegex.exec(text)) !== null) {
      tokenRanges.push([tokenMatch.index, tokenMatch.index + tokenMatch[0].length]);
    }

    // Find first match not inside an existing token
    while ((match = regex.exec(text)) !== null) {
      const pos = match.index;
      const inside = tokenRanges.some(([start, end]) => pos >= start && pos < end);
      if (!inside) {
        // Replace this occurrence
        const before = text.slice(0, pos);
        const after = text.slice(pos + match[0].length);
        const replacement = `{{icon:${icon}|${match[1]}}}`;
        text = before + replacement + after;
        didReplace = true;
        break; // Only replace first occurrence per name
      }
    }

    if (didReplace) replaced.add(lowerName);
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
  summaryData: ReplaySummaryData | null = null,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('[ai-narrator] No OPENAI_API_KEY set, skipping narrative generation');
    return null;
  }

  const client = new OpenAI({ apiKey });
  const userPrompt = buildPrompt(report, playerAnalyses, players, duration, mapName, summaryData);

  // Determine max age reached from age phases
  let maxAgeReached = 1;
  for (const phase of report.agePhases) {
    if (phase.ageNumber > maxAgeReached) maxAgeReached = phase.ageNumber;
  }

  const systemPrompt = buildSystemPrompt(players, language, maxAgeReached);

  console.log(`[ai-narrator] Generating narrative (${userPrompt.length} chars input, lang=${language})...`);

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
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
