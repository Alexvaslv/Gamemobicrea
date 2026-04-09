export type ItemType = "weapon" | "armor" | "elixir" | "book" | "chest";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface GameItem {
  id: string;
  icon: string;
  rarity: Rarity;
  type: ItemType;
}

function getRarity(i: number): Rarity {
  if (i < 60) return "common";
  if (i < 85) return "rare";
  if (i < 97) return "epic";
  return "legendary";
}

function getItemType(i: number): ItemType {
  const types: ItemType[] = ["weapon", "armor", "elixir", "book", "chest"];
  return types[i % types.length];
}

export const ITEMS: GameItem[] = Array.from({ length: 100 }, (_, i) => ({
  id: `item_${String(i + 1).padStart(3, "0")}`,
  icon: `/assets/icons/item_${String(i + 1).padStart(3, "0")}.png`,
  rarity: getRarity(i),
  type: getItemType(i),
}));
