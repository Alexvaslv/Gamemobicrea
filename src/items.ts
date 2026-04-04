export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface GameItem {
  id: string;
  icon: string;
  rarity: Rarity;
}

function getRarity(i: number): Rarity {
  if (i < 60) return "common";
  if (i < 85) return "rare";
  if (i < 97) return "epic";
  return "legendary";
}

export const ITEMS: GameItem[] = Array.from({ length: 100 }, (_, i) => ({
  id: `item_${String(i + 1).padStart(3, "0")}`,
  icon: `/assets/icons/item_${String(i + 1).padStart(3, "0")}.png`,
  rarity: getRarity(i),
}));
