export interface ProductionTimelinePoint {
  time: number;
  playerId: number;
  villagers: number;
  military: number;
  buildings: number;
  technologies: number;
}

export interface VillagerGap {
  playerId: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface CombatEngagement {
  id: number;
  startTime: number;
  endTime: number;
  centerX: number;
  centerZ: number;
  commandsP1: number;
  commandsP2: number;
  estimatedWinner: number | null;
  intensity: 'low' | 'medium' | 'high';
}

export interface ArmySnapshot {
  time: number;
  playerId: number;
  units: Array<{ name: string; icon: string; count: number; baseId: string }>;
  totalSupply: number;
}

export interface EconomySnapshot {
  time: number;
  playerId: number;
  totalSpent: number;
  militarySpent: number;
  economicSpent: number;
  techSpent: number;
  militaryRatio: number;
}

export interface KeyMoment {
  time: number;
  type: 'age_up' | 'first_military' | 'major_fight' | 'expansion' | 'tech_spike';
  description: string;
  playerId: number;
}

export interface AgePhase {
  ageNumber: number;
  ageName: string;
  playerId: number;
  startTime: number;
  endTime: number;
  landmark: string | null;
  landmarkIcon: string | null;
  villagersProduced: number;
  militaryProduced: number;
  buildingsConstructed: number;
  technologiesResearched: number;
  totalSpent: number;
  militarySpent: number;
  keyUnits: Array<{ name: string; icon: string; count: number }>;
  keyBuildings: Array<{ name: string; icon: string; count: number }>;
  keyTechs: Array<{ name: string; icon: string }>;
}

export interface ScoreDetail {
  score: number;
  reasons: string[];
}

export interface PlayerScores {
  playerId: number;
  macro: ScoreDetail;
  economy: ScoreDetail;
  military: ScoreDetail;
  tech: ScoreDetail;
}

export interface DeepAnalysis {
  productionTimeline: ProductionTimelinePoint[];
  villagerGaps: VillagerGap[];
  combatEngagements: CombatEngagement[];
  armySnapshots: ArmySnapshot[];
  economyTimeline: EconomySnapshot[];
  keyMoments: KeyMoment[];
  agePhases: AgePhase[];
  playerScores: PlayerScores[];
  narrative: string | null;
}
