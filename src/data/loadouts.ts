export interface LoadoutDefinition {
  id: string;
  name: string;
  description: string;
  detail: string;
  accentColor: string;
  creditsBonus: number;
  /** Upgrade id to apply at run start, or "random_rare" to pick from rare/legendary pool. */
  startUpgradeId: string;
  flavor: string;
}

export const loadoutDefinitions: LoadoutDefinition[] = [
  {
    id: "assault",
    name: "ASSAULT PROTOCOL",
    description: "+100 CR · Precision targeting from wave one",
    detail: "Start with extra credits and a built-in targeting advantage. All towers deal 15% more damage throughout the run.",
    accentColor: "#ff5252",
    creditsBonus: 100,
    startUpgradeId: "precision_targeting",
    flavor: "Overwhelming force. Strike first, strike hard.",
  },
  {
    id: "economic",
    name: "ECONOMIC MANDATE",
    description: "+200 CR · Harvesters generate 25% more income",
    detail: "Begin with a larger credit reserve and an automated income advantage. Invest in infrastructure early.",
    accentColor: "#ffd700",
    creditsBonus: 200,
    startUpgradeId: "crystal_resonance",
    flavor: "Signal flows where resources gather.",
  },
  {
    id: "experimental",
    name: "EXPERIMENTAL RIG",
    description: "+50 CR · Start with a random Rare or Legendary upgrade",
    detail: "A modest credit bonus paired with an unknown advantage pulled from the higher-tier signal catalog. High risk, high variance.",
    accentColor: "#ce93d8",
    creditsBonus: 50,
    startUpgradeId: "random_rare",
    flavor: "Unpredictable. The signal demands adaptation.",
  },
];
