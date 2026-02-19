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

// ── Rich token injection data ────────────────────────────────

/** Age name variants → age number (for {{age:N|Name}} tokens) */
const AGE_PATTERNS: Array<[RegExp, number, string]> = [
  // Spanish (longest first to avoid partial matches)
  [/Edad de los Castillos/gi, 3, 'Edad de los Castillos'],
  [/Edad Imperial/gi, 4, 'Edad Imperial'],
  [/Edad Feudal/gi, 2, 'Edad Feudal'],
  [/Edad Oscura/gi, 1, 'Edad Oscura'],
  // English
  [/Imperial Age/gi, 4, 'Imperial Age'],
  [/Castle Age/gi, 3, 'Castle Age'],
  [/Feudal Age/gi, 2, 'Feudal Age'],
  [/Dark Age/gi, 1, 'Dark Age'],
];

/** Spanish civ name variants → English civ key for flag lookup */
const SPANISH_CIV_VARIANTS: Record<string, string[]> = {
  'English': ['los ingleses', 'ingleses', 'el inglés'],
  'French': ['los franceses', 'franceses', 'el francés'],
  'Chinese': ['los chinos', 'chinos'],
  'Mongols': ['los mongoles', 'mongoles'],
  'Rus': ['los rusos', 'rusos'],
  'Delhi Sultanate': ['el Sultanato de Delhi', 'Sultanato de Delhi', 'Delhi'],
  'Abbasid Dynasty': ['los abasíes', 'los abasidas', 'abasíes', 'abasidas'],
  'Holy Roman Empire': ['el Sacro Imperio', 'Sacro Imperio'],
  'Ottomans': ['los otomanos', 'otomanos'],
  'Malians': ['los malienses', 'malienses'],
  'Byzantines': ['los bizantinos', 'bizantinos'],
  'Japanese': ['los japoneses', 'japoneses'],
  'Ayyubids': ['los ayubíes', 'ayubíes'],
  "Jeanne d'Arc": ['Juana de Arco'],
  'Order of the Dragon': ['la Orden del Dragón', 'Orden del Dragón'],
  "Zhu Xi's Legacy": ['el Legado de Zhu Xi', 'Legado de Zhu Xi'],
  'Sengoku': ['Sengoku'],
  'Golden Horde': ['la Horda de Oro', 'Horda de Oro'],
};

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
- Use Economy Summary to assess commitment: >60% military spending = aggressive, <30% = booming.

FORMATTING RULES:
- Use ### headers for each section (e.g. ### Dark Age, ### Feudal Age, ### Verdict).
- After a section header, do NOT repeat the age name at the start of the paragraph. The header already identifies the age. Jump straight into the analysis.
- Refer to each civilization ONCE by its full name at the start, then use short forms ("the French", "the Ayyubids" — never "los franceses" after first mention).
- When listing unit counts, use the format "Nx UnitName" (e.g. "109 Archers", "23 Royal Knights"). DO NOT use "x" separator.
- Write short paragraphs (2-3 sentences each). Add a blank line between paragraphs.
- The Verdict section should start with (a) why the winner won, then (b) numbered recommendations (1., 2., 3.) each on its own line.
- CRITICAL: ALL unit, building, and technology names MUST stay in English exactly as they appear in the game data. NEVER translate them. Write "Royal Knight" not "Caballero Real". Write "Spearman" not "Lancero". Write "Archery Range" not "Campo de Tiro". Write "Town Center" not "Centro Urbano". The surrounding text can be in any language, but game entity names MUST be in English. This is mandatory for the icon system to work.${ageConstraint}

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

  // Add Spanish translations so GPT's Spanish names also get icons
  const SPANISH_UNIT_NAMES: Record<string, string> = {
    // Common units
    'Aldeano': 'Villager', 'Aldeanos': 'Villager',
    'Lancero': 'Spearman', 'Lanceros': 'Spearman',
    'Arquero': 'Archer', 'Arqueros': 'Archer',
    'Ballestero': 'Crossbowman', 'Ballesteros': 'Crossbowman',
    'Hombre de Armas': 'Man-at-Arms', 'Hombres de Armas': 'Man-at-Arms',
    'Caballero': 'Knight', 'Caballeros': 'Knight',
    'Caballero Real': 'Royal Knight', 'Caballeros Reales': 'Royal Knight',
    'Jinete': 'Horseman', 'Jinetes': 'Horseman',
    'Explorador': 'Scout', 'Exploradores': 'Scout',
    'Ariete': 'Battering Ram', 'Arietes': 'Battering Ram',
    'Mangonela': 'Mangonel', 'Mangonelas': 'Mangonel',
    'Trabuco': 'Counterweight Trebuchet', 'Trabucos': 'Counterweight Trebuchet',
    'Trebuchet': 'Counterweight Trebuchet', 'Trebuchets': 'Counterweight Trebuchet',
    'Bombardero': 'Bombard', 'Bombarderos': 'Bombard',
    'Arquero a caballo': 'Horse Archer', 'Arqueros a caballo': 'Horse Archer',
    'Lancero de Camello': 'Camel Lancer', 'Lanceros de Camello': 'Camel Lancer',
    'Arquero de Camello': 'Camel Archer', 'Arqueros de Camello': 'Camel Archer',
    // Civ-specific units
    'Catafracto': 'Cataphract', 'Catafractos': 'Cataphract',
    'Jenízaro': 'Janissary', 'Jenízaros': 'Janissary',
    'Sipahi': 'Sipahi',
    'Granadero': 'Grenadier', 'Granaderos': 'Grenadier',
    'Longbowman': 'Longbowman', 'Longbowmen': 'Longbowman',
    'Samurái': 'Samurai', 'Samuráis': 'Samurai',
    'Elefante de Guerra': 'War Elephant', 'Elefantes de Guerra': 'War Elephant',
    'Camello': 'Camel Rider', 'Camellos': 'Camel Rider',
    'Infante': 'Man-at-Arms', 'Infantes': 'Man-at-Arms',
    'Mosquetero': 'Handcannoneer', 'Mosqueteros': 'Handcannoneer',
    'Cañonero': 'Handcannoneer', 'Cañoneros': 'Handcannoneer',
    'Piquero': 'Spearman', 'Piqueros': 'Spearman',
    'Espringalda': 'Springald', 'Espringaldas': 'Springald',
    'Culverin': 'Culverin', 'Culverín': 'Culverin',
    'Zhuge Nu': 'Zhuge Nu',
    'Nido de Abejas': 'Nest of Bees',
    'Mangudai': 'Mangudai',
    'Arbaletrier': 'Arbaletrier', 'Arbaletriers': 'Arbaletrier',
    'Guerrero Donso': 'Donso', 'Guerreros Donso': 'Donso',
    'Guerrero Musofadi': 'Musofadi Warrior', 'Guerreros Musofadi': 'Musofadi Warrior',
    'Monje': 'Monk', 'Monjes': 'Monk',
    'Prelado': 'Prelate', 'Prelados': 'Prelate',
    'Imam': 'Imam', 'Imanes': 'Imam',
    'Galera': 'Galley', 'Galeras': 'Galley',
    'Ghulam': 'Ghulam', 'Ghulams': 'Ghulam',
    // Buildings
    'Centro Urbano': 'Town Center', 'Centros Urbanos': 'Town Center',
    'Cuartel': 'Barracks', 'Cuarteles': 'Barracks',
    'Establos': 'Stable', 'Establo': 'Stable',
    'Campo de Tiro': 'Archery Range',
    'Herrería': 'Blacksmith',
    'Mercado': 'Market', 'Mercados': 'Market',
    'Molino': 'Mill', 'Molinos': 'Mill',
    'Torre': 'Outpost', 'Torres': 'Outpost',
    'Castillo': 'Keep', 'Castillos': 'Keep',
    'Muralla': 'Stone Wall', 'Murallas': 'Stone Wall',
    'Monasterio': 'Monastery', 'Monasterios': 'Monastery',
    'Universidad': 'University',
    'Puerta': 'Gate', 'Puertas': 'Gate',
    'Taller de Asedio': 'Siege Workshop',
    'Muelle': 'Dock', 'Muelles': 'Dock',
    // Technologies
    'Herrero': 'Blacksmith',
    'Balística': 'Ballistics',
    'Química': 'Chemistry',
  };

  for (const [esName, enName] of Object.entries(SPANISH_UNIT_NAMES)) {
    const icon = map.get(enName);
    if (icon && !map.has(esName)) {
      map.set(esName, icon);
    }
  }

  return map;
}

// ── Token injection helpers ──────────────────────────────────

/** Check if a position in text falls inside any existing token */
function isInsideToken(text: string, position: number): boolean {
  const tokenRegex = /\{\{(?:icon|civ|age|time|header):[^}]*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(text)) !== null) {
    if (position >= match.index && position < match.index + match[0].length) return true;
  }
  return false;
}

/** Convert markdown headers (### Title) to {{header:Title}} tokens */
function convertHeaders(text: string): string {
  return text.replace(/^#{1,4}\s+(.+)$/gm, (_match, title) => {
    // Strip bold markers from header text
    const clean = title.replace(/\*\*/g, '').trim();
    return `{{header:${clean}}}`;
  });
}

/** Replace age names with {{age:N|Name}} tokens */
function injectAgeTokens(text: string): string {
  for (const [pattern, ageNum, _displayName] of AGE_PATTERNS) {
    // Replace ALL occurrences (ages are mentioned multiple times)
    text = text.replace(pattern, (match, ...args) => {
      // The match offset is the second-to-last argument in replace callback
      const offset = typeof args[args.length - 2] === 'number' ? args[args.length - 2] as number : -1;
      if (offset >= 0 && isInsideToken(text, offset)) return match;
      return `{{age:${ageNum}|${match}}}`;
    });
  }
  return text;
}

/** Replace civ names with {{civ:flagURL|Name}} tokens */
function injectCivTokens(text: string, players: PlayerInfo[]): string {
  // Build civ name → flag URL map from match players
  const civEntries: Array<[string, string]> = [];

  for (const player of players) {
    if (!player.civFlag || !player.civ || player.civ === 'Unknown') continue;

    // English civ name
    civEntries.push([player.civ, player.civFlag]);

    // Spanish variants
    const variants = SPANISH_CIV_VARIANTS[player.civ] ?? [];
    for (const v of variants) {
      civEntries.push([v, player.civFlag]);
    }
  }

  // Sort longest first
  civEntries.sort((a, b) => b[0].length - a[0].length);

  const replaced = new Set<string>();

  for (const [name, flagUrl] of civEntries) {
    const lower = name.toLowerCase();
    if (replaced.has(lower)) continue;

    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escaped})\\b`, 'ig');

    // Replace ALL occurrences not inside existing tokens
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let didReplace = false;

    while ((match = regex.exec(text)) !== null) {
      if (!isInsideToken(text, match.index)) {
        result += text.slice(lastIndex, match.index);
        result += `{{civ:${flagUrl}|${match[1]}}}`;
        lastIndex = regex.lastIndex;
        didReplace = true;
      }
    }

    if (didReplace) {
      result += text.slice(lastIndex);
      text = result;
      replaced.add(lower);
    }
  }

  return text;
}

/** Wrap timestamps (M:SS or MM:SS) with {{time:...}} tokens */
function injectTimeTokens(text: string): string {
  // Match timestamps like 4:20, 12:05, 0:30 that are NOT inside existing tokens
  const regex = /(\d{1,3}:\d{2})/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (!isInsideToken(text, match.index)) {
      result += text.slice(lastIndex, match.index);
      result += `{{time:${match[1]}}}`;
      lastIndex = regex.lastIndex;
    }
  }

  result += text.slice(lastIndex);
  return result;
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

  // Track which base names (lowercased) have already been handled via a longer variant
  const replaced = new Set<string>();

  for (const [name, icon] of expandedEntries) {
    const lowerName = name.toLowerCase();
    if (replaced.has(lowerName)) continue;

    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escaped})\\b`, 'ig');

    // Replace ALL occurrences not inside existing tokens
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let didReplace = false;

    while ((match = regex.exec(text)) !== null) {
      const pos = match.index;
      if (!isInsideToken(text, pos)) {
        result += text.slice(lastIndex, pos);
        result += `{{icon:${icon}|${match[1]}}}`;
        lastIndex = regex.lastIndex;
        didReplace = true;
      }
    }

    if (didReplace) {
      result += text.slice(lastIndex);
      text = result;
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
      // Post-process: inject rich tokens in order (headers → ages → civs → icons → times)
      narrative = convertHeaders(narrative);
      narrative = injectAgeTokens(narrative);
      narrative = injectCivTokens(narrative, players);
      const iconMap = buildIconMap(report, playerAnalyses);
      narrative = injectIcons(narrative, iconMap);
      narrative = injectTimeTokens(narrative);
    }
    return narrative;
  } catch (err: any) {
    console.error(`[ai-narrator] Failed: ${err.message}`);
    return null;
  }
}
