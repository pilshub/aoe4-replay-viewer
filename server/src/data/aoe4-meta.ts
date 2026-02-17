// ── AoE4 Strategic Knowledge Base for AI Analysis ──────────────

export const COUNTER_UNIT_MATRIX = `
COUNTER-UNIT RELATIONSHIPS (AoE4):
- Spearmen → hard counter Cavalry (bonus damage vs mounted)
- Crossbowmen → counter Heavy Infantry/MAA (bonus vs high armor)
- Horsemen → counter Ranged units (fast gap close, bonus vs ranged)
- Men-at-Arms → counter Archers (high armor absorbs arrow damage)
- Knights/Lancers → strong vs most units but expensive, weak to mass Spearmen
- Archers → counter Light Infantry, Spearmen (kite and kill)
- Mangonels → counter massed Infantry (AoE damage)
- Springalds → counter Siege (bonus vs siege)
- Handcannoneers → counter Heavy Infantry (high burst damage)
- Cavalry Archers/Horse Archers → counter slow infantry (hit and run)
- Camels → counter Cavalry (Abbasid/Ayyubid unique, bonus vs mounted)
- Elephants → strong in melee but slow, countered by Spearmen + Crossbows
- Trebuchets → counter Buildings/Walls (siege weapon)
- Bombards → counter Buildings and clustered units
KEY PRINCIPLE: No unit is unbeatable. The winner usually has the better composition for the matchup, not just more units.`;

export const TIMING_BENCHMARKS = `
TIMING BENCHMARKS (1v1 competitive):
- Feudal Age (Age II): Fast ≤4:00, Standard 4:00-5:30, Slow >5:30
- Castle Age (Age III): Fast ≤8:00, Standard 8:00-11:00, Slow >11:00
- Imperial Age (Age IV): Fast ≤14:00, Standard 14:00-18:00, Slow >18:00
- First military unit: Before 4:30 = very aggressive, 4:30-6:00 = standard, >6:00 = greedy/booming
- Villager production: Should NEVER stop in Dark Age. Brief pauses acceptable during age-up or emergency. Extended gaps (>30s) indicate macro issues.
- Second Town Center: Before 8:00 = economic boom strategy, 8:00-12:00 = standard, never = all-in military
- 20 villagers: Should reach around 5:00-6:00
- Attack timing: Feudal rush hits ~5:00-7:00, Castle Age push ~10:00-13:00`;

export const STRATEGY_PATTERNS = `
COMMON STRATEGIES:
1. FEUDAL RUSH: Age up fast, produce military immediately in Feudal, attack before opponent stabilizes. Goal: economic damage or kill. Risk: falls behind if defended well.
2. FAST CASTLE: Minimal military in Feudal, rush to Castle Age for stronger units (Knights, Crossbows, siege). Goal: power spike. Risk: vulnerable to Feudal aggression.
3. ECONOMIC BOOM: Build 2+ Town Centers, mass villagers, delayed military. Goal: overwhelming economy. Risk: dies to early all-in.
4. TOWER RUSH: Build towers aggressively near enemy base in Feudal. Goal: deny resources. Risk: expensive, easy to counter if scouted.
5. ALL-IN: Commit everything to military, no expansion, no eco upgrades. Goal: win before resources run out. Risk: loses if game goes long.
6. STANDARD: Balanced approach, moderate eco + military. Adapts to opponent. Most common in competitive play.`;

export const CIV_PROFILES: Record<string, string> = {
  'English': 'Longbowmen are core unit (outrange most Feudal units). Network of Castles gives +25% attack speed near keeps/TCs. Strong defensive early game, good at holding positions. Council Hall landmark doubles Longbow production. Farm bonus reduces wood cost. Common strats: Longbow rush, defensive Castle boom.',
  'French': 'Royal Knights are cheap and strong cavalry. Economic techs cost less. School of Cavalry produces Knights faster. Keeps fire faster. Trade bonus in late game. Common strats: Fast Knights rush in Feudal (very popular), Fast Castle into mass Knights, trade boom.',
  'Holy Roman Empire': 'Prelates inspire villagers (+40% gather rate). Relics generate gold in buildings. Men-at-Arms available in Feudal (strong early). Landsknecht splash damage. Common strats: MAA rush in Feudal, relic control in Castle, Prelate eco boom.',
  'Mongols': 'Nomadic (can pack/unpack buildings). Ovoo provides free double production with stone. Mangudai (cavalry archer) is core unit. Khan provides buffs. No walls. Early aggression specialist. Common strats: Tower rush with Ovoo, dark age aggression, Mangudai hit-and-run.',
  'Rus': 'Bounty system generates gold from killing animals and units. Wooden Fortresses (unique keep). Horse Archers strong in Feudal. Streltsy (handcannoneer) in Imperial. Lodya ships versatile. Common strats: Professional Scouts bounty rush, Horse Archer harass, Fast Castle.',
  'Chinese': 'Dynasty system unlocks unique bonuses and units. Zhuge Nu (repeating crossbow) available early. Imperial Officials collect tax (gold). Village system. Gunpowder units (Handcannoneers, Fire Lancers). Slower age-up (build both landmarks). Common strats: Song Dynasty villager boom, Zhuge Nu rush.',
  'Delhi Sultanate': 'All technologies are FREE but take longer to research. Scholars speed up research. War Elephants are devastating siege units. Tower of Victory landmark buffs infantry. Sacred Sites generate gold. Common strats: Sacred Site control, Scholar tech advantage, Elephant push.',
  'Abbasid Dynasty': 'House of Wisdom provides age-up (no landmarks). Wing bonuses give eco/military/tech boosts. Camels counter cavalry. Golden Age mechanic increases production speed. Common strats: Camel Archer harass, Fast Castle wing bonus, Economic wing boom.',
  'Malians': 'Gold-focused economy. Musofadi (stealth warrior) unique. Cattle produce gold. Javelin Throwers strong ranged. Toll Outposts generate gold from trade. Common strats: Gold advantage abuse, Javelin Thrower mass, pit mine economy.',
  'Ottomans': 'Imperial Council provides free military units periodically. Janissaries (handcannoneer) available in Castle. Great Bombard is devastating siege. Military School auto-produces. Common strats: Free military pressure, Janissary push, Great Bombard siege.',
  'Byzantines': 'Cistern of the First Hill provides buffs. Mercenaries can be hired. Greek Fire (unique upgrade) devastating. Limitanei (cheap infantry) for defense. Common strats: Mercenary timing attacks, Cistern eco bonus, Greek Fire push.',
  'Japanese': 'Samurai and Onna-musha warrior monks. Farmhouse produces rice efficiently. Ozutsu (cannon infantry) unique. Shinobi scouts. Daimyo Lord buffs nearby units. Common strats: Samurai rush, Farm eco advantage, Ozutsu timing.',
  'Ayyubids': 'Atabeg system provides unique upgrades per age. Desert Raiders (fast raider cavalry). Wing system similar to Abbasid. Camel units counter cavalry. Common strats: Desert Raider harass, wing-based age-up, Camel counter-cavalry.',
  'Jeanne d\'Arc': 'French variant with hero Jeanne d\'Arc unit. Divine companions provide auras. Jeanne levels up through ages gaining abilities. Keeps + cavalry focus. Common strats: Jeanne-supported Knight push, hero-centric aggression.',
  'Order of the Dragon': 'HRE variant with Gilded units (stronger but more expensive versions). Inspiration mechanic buffs Gilded units. Prelates more important. Common strats: Gilded MAA timing, quality-over-quantity military.',
  'Zhu Xi\'s Legacy': 'Chinese variant with Imperial Academy. Meditation mechanic recovers units. Shaolin Monks unique. Tax collection enhanced. Common strats: Meditation sustain, Shaolin Monk aggression.',
};

export function getCivKnowledge(civName: string): string {
  // Try exact match first, then partial match
  if (CIV_PROFILES[civName]) return CIV_PROFILES[civName];
  const lower = civName.toLowerCase();
  for (const [key, value] of Object.entries(CIV_PROFILES)) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return value;
    }
  }
  return '';
}

export const ANALYSIS_GUIDELINES = `
ANALYSIS PRINCIPLES:
- Always evaluate army composition relative to what the opponent is making (counter-units matter more than raw numbers)
- Villager production gaps are usually the #1 macro mistake — even 30s of idle TC costs 2+ villagers
- Age-up timing reveals strategy: fast feudal = aggression, fast castle = tech/unit advantage, slow = either booming or under pressure
- Resource spending ratio (military vs economic) reveals commitment: >70% military = all-in, <30% military = booming
- First military unit timing + type reveals intent: early Spearmen = defensive, early Knights = aggressive
- Look at WHAT landmark was chosen for age-up — it reveals strategic intent
- Combat engagement wins depend on composition, not just numbers. 20 Spearmen beat 20 Knights.
- Expansion (2nd TC) timing is crucial: early expansion = eco advantage long-term, no expansion = must win with current army
`;
