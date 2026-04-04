/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useRef, useMemo } from "react";
import { User, Swords, Users, Trophy, ShoppingBag, Gavel, Shield, ChevronLeft, ChevronRight, CheckCircle2, ScrollText, Backpack, Mail, Settings, ArrowLeft, PawPrint, Wind, Coins, Gem, Hexagon, Circle, Star, Lock, Mountain, TreePine, Heart, Crown, BookOpen, FlaskConical, PlusCircle, Shuffle, Flag, Ban, Snowflake, MicOff, LifeBuoy, Package, Check, ExternalLink, Minus, RotateCcw, MapPin, CalendarDays, Mars, Venus, Pencil, Eye, EyeOff, LogOut, Trash2, Zap, Target, TrendingUp, MessageSquare, Bell, X, Search, Plus, Newspaper, MessageCircle, Send, ShieldCheck, Radio, ShieldAlert } from "lucide-react";
import { db, auth } from "./firebase";
import { doc, getDoc, setDoc, query, collection, where, getDocs, updateDoc, getDocFromServer, onSnapshot, limit, deleteDoc, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { Toaster, toast } from "sonner";
import { io, Socket } from "socket.io-client";

// --- Firestore Data Service ---

const PLAYER_DATA_COLLECTION = "player_data";

export async function savePlayerData(userId: string, data: any) {
  try {
    await setDoc(doc(db, PLAYER_DATA_COLLECTION, userId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PLAYER_DATA_COLLECTION + "/" + userId);
  }
}

/**
 * Standalone function to equip an item and save to Firestore.
 * Adapted from user request to use Firestore instead of Realtime Database.
 */
export async function equipItemToFirestore(playerId: string, item: any, slot: string) {
  try {
    const playerDocRef = doc(db, PLAYER_DATA_COLLECTION, playerId);
    const playerDoc = await getDoc(playerDocRef);
    
    if (playerDoc.exists()) {
      const data = playerDoc.data();
      const equippedItems = data.equippedItems || {};
      const inventory = data.inventory || [];
      
      // Find item in inventory if not provided as full object
      let itemToEquip = item;
      let itemIdx = -1;
      
      if (typeof item === 'string') {
        itemIdx = inventory.findIndex((i: any) => i.id === item);
        if (itemIdx > -1) {
          itemToEquip = inventory[itemIdx];
        } else {
          throw new Error("Item not found in inventory");
        }
      }

      const oldItem = equippedItems[slot];
      const newEquipped = { ...equippedItems, [slot]: itemToEquip };
      const newInventory = [...inventory];
      
      if (itemIdx > -1) {
        newInventory.splice(itemIdx, 1);
      } else {
        // If item was passed as object, we should still try to remove it from inventory by ID
        const idx = newInventory.findIndex((i: any) => i.id === itemToEquip.id);
        if (idx > -1) newInventory.splice(idx, 1);
      }
      
      if (oldItem) {
        newInventory.push(oldItem);
      }

      await setDoc(playerDocRef, {
        equippedItems: newEquipped,
        inventory: newInventory,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log("Вещь сохранена!");
    }
  } catch (error) {
    console.error("Ошибка сохранения вещи:", error);
    throw error;
  }
}

export async function loadPlayerData(userId: string) {
  try {
    const docRef = doc(db, PLAYER_DATA_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, PLAYER_DATA_COLLECTION + "/" + userId);
    return null;
  }
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error("Ошибка базы данных: " + (error instanceof Error ? error.message : String(error)));
  throw new Error(JSON.stringify(errInfo));
}

interface Item {
  id: string;
  name: string;
  level: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  type: string;
  bonusPercent: number;
  iconUrl?: string;
  stats: {
    strength: number;
    agility: number;
    intuition: number;
    endurance: number;
    wisdom: number;
  };
  mana_cost?: number;
  spell_power?: number;
  cooldown_reduction?: number;
  isChest?: boolean;
  chestRewards?: {
    iron?: number;
    silver?: number;
    gold?: number;
    diamonds?: number;
  };
}

const LocationPlayers = ({ location, userLocations, currentUserId }: { location: string, userLocations: Record<string, string>, currentUserId?: string }) => {
  const playersInLocation = Object.entries(userLocations).filter(([uid, loc]) => loc === location && uid !== currentUserId);
  
  if (playersInLocation.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/5 rounded-full backdrop-blur-md">
      <div className="flex -space-x-1.5 overflow-hidden">
        {playersInLocation.slice(0, 3).map(([uid], i) => (
          <div key={uid} className="inline-block h-4 w-4 rounded-full ring-1 ring-black bg-zinc-800 flex items-center justify-center text-[6px] font-bold text-zinc-500">
            {i + 1}
          </div>
        ))}
      </div>
      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
        {playersInLocation.length} {playersInLocation.length === 1 ? 'игрок' : 'игрока'} здесь
      </span>
    </div>
  );
};

const EquipSlot = ({ label, item, onUnequip }: { label: string, item?: Item | null, onUnequip?: () => void }) => (
  <div className="flex flex-col items-center gap-1 group w-full">
    <div 
      onClick={() => item && onUnequip && onUnequip()}
      className={`w-full aspect-square rounded-2xl relative transition-all duration-500 cursor-pointer overflow-hidden group-hover:scale-105 ${
      item ? (
        item.rarity === 'legendary' ? 'bg-gradient-to-br from-orange-900/40 to-orange-950/60 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.2),inset_0_0_10px_rgba(249,115,22,0.2)]' :
        item.rarity === 'epic' ? 'bg-gradient-to-br from-purple-900/40 to-purple-950/60 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2),inset_0_0_10px_rgba(168,85,247,0.2)]' :
        item.rarity === 'rare' ? 'bg-gradient-to-br from-blue-900/40 to-blue-950/60 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2),inset_0_0_10px_rgba(59,130,246,0.2)]' :
        item.rarity === 'uncommon' ? 'bg-gradient-to-br from-green-900/40 to-green-950/60 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.2),inset_0_0_10px_rgba(34,197,94,0.2)]' :
        'bg-gradient-to-br from-zinc-800/40 to-zinc-900/60 border-white/20 shadow-[inset_0_0_10px_rgba(255,255,255,0.05)]'
      ) : 'bg-black/40 border-white/5 hover:border-white/20'
    } border`}>
      {/* Decorative Corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20 rounded-tl-sm" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/20 rounded-tr-sm" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/20 rounded-bl-sm" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20 rounded-br-sm" />
      
      {/* Shine Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

      <div className="flex items-center justify-center w-full h-full relative z-10">
        {item ? (
          <div className="relative">
            {item.iconUrl ? (
              <img src={item.iconUrl} alt={item.name} className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
            ) : (
              <>
                {item.name.toLowerCase().includes("меч") && <Swords className={`w-10 h-10 ${item.rarity === 'legendary' ? 'text-orange-400' : 'text-zinc-200'} filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`} />}
                {item.name.toLowerCase().includes("щит") && <Shield className={`w-10 h-10 ${item.rarity === 'legendary' ? 'text-orange-400' : 'text-zinc-200'} filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`} />}
                {item.name.toLowerCase().includes("лук") && <Wind className={`w-10 h-10 ${item.rarity === 'legendary' ? 'text-orange-400' : 'text-zinc-200'} filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`} />}
                {item.name.toLowerCase().includes("топор") && <Gavel className={`w-10 h-10 ${item.rarity === 'legendary' ? 'text-orange-400' : 'text-zinc-200'} filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`} />}
                {item.name.toLowerCase().includes("посох") && <Star className={`w-10 h-10 ${item.rarity === 'legendary' ? 'text-orange-400' : 'text-zinc-200'} filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`} />}
                {item.name.toLowerCase().includes("рубашка") && <User className={`w-10 h-10 ${item.rarity === 'legendary' ? 'text-orange-400' : 'text-zinc-200'} filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`} />}
                {!item.name.toLowerCase().includes("меч") && !item.name.toLowerCase().includes("щит") && !item.name.toLowerCase().includes("лук") && !item.name.toLowerCase().includes("топор") && !item.name.toLowerCase().includes("посох") && !item.name.toLowerCase().includes("рубашка") && <Package className="w-10 h-10 text-zinc-200" />}
              </>
            )}
          </div>
        ) : (
          <div className="opacity-20 group-hover:opacity-40 transition-opacity">
            {label === "Меч" && <Swords className="w-8 h-8 text-zinc-500" />}
            {label === "Второе оружие" && <Shield className="w-8 h-8 text-zinc-500" />}
            {label === "Рубашка" && <User className="w-8 h-8 text-zinc-500" />}
            {label === "Шлем" && <Hexagon className="w-8 h-8 text-zinc-500" />}
            {label === "Наручи" && <Circle className="w-8 h-8 text-zinc-500" />}
            {label === "Штаны" && <ShoppingBag className="w-8 h-8 text-zinc-500" />}
            {label === "Сапоги" && <PawPrint className="w-8 h-8 text-zinc-500" />}
            {label === "Ожерелье" && <Gem className="w-8 h-8 text-zinc-500" />}
            {label === "Перчатки" && <Users className="w-8 h-8 text-zinc-500" />}
            {label === "Пояс" && <Settings className="w-8 h-8 text-zinc-500" />}
          </div>
        )}
      </div>
    </div>
    <span className="text-[8px] text-zinc-500 uppercase tracking-widest text-center w-16 leading-tight truncate px-1">{item ? item.name.split(' ')[0] : label}</span>
  </div>
);

const FOREST_ENEMIES = [
  { name: "Хромой серый волк", maxHealth: 150, xpMin: 50, xpMax: 80, silver: 10, drops: ["Деревянный меч", "Деревянный щит"], recLevel: 1 },
  { name: "Серый волк", maxHealth: 350, xpMin: 150, xpMax: 250, silver: 25, drops: ["Волчья шкура"], recLevel: 2 },
  { name: "Черный волк", maxHealth: 750, xpMin: 400, xpMax: 600, silver: 50, drops: ["Острый клык"], recLevel: 4 },
  { name: "Вожак волчьей стаи", maxHealth: 1200, xpMin: 0, xpMax: 0, silver: 200, drops: ["Золотая шкура", "Амулет вожака"], recLevel: 5 }
];

const MOUNTAIN_ENEMIES = [
  { name: "Горный козел", maxHealth: 2000, xpMin: 1000, xpMax: 1500, silver: 100, drops: ["Рог козла"], recLevel: 10 },
  { name: "Снежный леопард", maxHealth: 3500, xpMin: 2000, xpMax: 3000, silver: 250, drops: ["Мех леопарда"], recLevel: 12 },
  { name: "Каменный голем", maxHealth: 6000, xpMin: 5000, xpMax: 7000, silver: 500, drops: ["Кусок камня"], recLevel: 15 },
  { name: "Горный дракон", maxHealth: 15000, xpMin: 20000, xpMax: 30000, silver: 2000, drops: ["Чешуя дракона", "Сердце дракона"], recLevel: 20 }
];

const XP_TABLE = [0, 0, 200, 500, 1200, 2500, 5000, 12000];
for (let i = 8; i <= 85; i++) {
  const prevDelta = XP_TABLE[i - 1] - XP_TABLE[i - 2];
  XP_TABLE.push(Math.floor(XP_TABLE[i - 1] + prevDelta * 1.25));
}

const TAKEN_USERNAMES = ["admin", "player", "hero", "test", "root", "system", "moderator", "creator", "Murr"];

const COUNTRIES = [
  "Россия", "Украина", "Беларусь", "Казахстан", "Узбекистан", "Армения", "Грузия", "Азербайджан", 
  "Молдова", "Кыргызстан", "Таджикистан", "Туркменистан", "Эстония", "Латвия", "Литва",
  "США", "Великобритания", "Германия", "Франция", "Италия", "Испания", "Польша", "Чехия",
  "Китай", "Япония", "Корея", "Турция", "Израиль", "Канада", "Австралия", "Бразилия"
].sort();

const getAgeSuffix = (age: number) => {
  const lastDigit = age % 10;
  const lastTwoDigits = age % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return "лет";
  if (lastDigit === 1) return "год";
  if (lastDigit >= 2 && lastDigit <= 4) return "года";
  return "лет";
};

const SHOP_ITEMS: Record<string, any[]> = {
  equipment: [
    { id: 'wpn_1', name: 'Железный меч', level: 1, rarity: 'common', type: 'Меч', cost: 100, currency: 'silver', bonusPercent: 1, stats: { strength: 2, agility: 1, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_2', name: 'Стальной меч', level: 1, rarity: 'common', type: 'Меч', cost: 100, currency: 'silver', bonusPercent: 1, stats: { strength: 2, agility: 1, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_3', name: 'Короткий кинжал', level: 1, rarity: 'common', type: 'Меч', cost: 100, currency: 'silver', bonusPercent: 1, stats: { strength: 1, agility: 2, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_4', name: 'Боевой топор', level: 5, rarity: 'uncommon', type: 'Меч', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 4, agility: 2, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_5', name: 'Копьё', level: 1, rarity: 'common', type: 'Меч', cost: 100, currency: 'silver', bonusPercent: 1, stats: { strength: 2, agility: 1, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_6', name: 'Ледяной меч', level: 10, rarity: 'rare', type: 'Меч', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 8, agility: 4, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_7', name: 'Огненный топор', level: 10, rarity: 'rare', type: 'Меч', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 8, agility: 4, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_8', name: 'Ядовитый кинжал', level: 5, rarity: 'uncommon', type: 'Меч', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 4, agility: 2, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_9', name: 'Молот войны', level: 5, rarity: 'uncommon', type: 'Меч', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 4, agility: 2, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_10', name: 'Катана', level: 10, rarity: 'rare', type: 'Меч', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 8, agility: 4, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_11', name: 'Теневой клинок', level: 20, rarity: 'epic', type: 'Меч', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 16, agility: 8, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_12', name: 'Меч молнии', level: 10, rarity: 'rare', type: 'Меч', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 8, agility: 4, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_13', name: 'Кровавый топор', level: 20, rarity: 'epic', type: 'Меч', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 16, agility: 8, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_14', name: 'Клинок ветра', level: 10, rarity: 'rare', type: 'Меч', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 8, agility: 4, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_15', name: 'Двуручный меч', level: 5, rarity: 'uncommon', type: 'Меч', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 4, agility: 2, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_16', name: 'Посох огня', level: 10, rarity: 'rare', type: 'Меч', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 8, agility: 4, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_17', name: 'Посох льда', level: 10, rarity: 'rare', type: 'Меч', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 8, agility: 4, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_18', name: 'Посох тьмы', level: 20, rarity: 'epic', type: 'Меч', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 16, agility: 8, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_19', name: 'Арбалет', level: 5, rarity: 'uncommon', type: 'Меч', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 4, agility: 2, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_20', name: 'Лук охотника', level: 5, rarity: 'uncommon', type: 'Меч', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 4, agility: 2, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_21', name: 'Лук теней', level: 20, rarity: 'epic', type: 'Меч', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 16, agility: 8, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_22', name: 'Лук света', level: 30, rarity: 'legendary', type: 'Меч', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 30, agility: 15, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_23', name: 'Золотой меч', level: 30, rarity: 'legendary', type: 'Меч', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 30, agility: 15, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_24', name: 'Клинок дракона', level: 30, rarity: 'legendary', type: 'Меч', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 30, agility: 15, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_25', name: 'Демонический меч', level: 20, rarity: 'epic', type: 'Меч', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 16, agility: 8, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_26', name: 'Молот титана', level: 30, rarity: 'legendary', type: 'Меч', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 30, agility: 15, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_27', name: 'Косa смерти', level: 20, rarity: 'epic', type: 'Меч', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 16, agility: 8, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_28', name: 'Кристальный меч', level: 10, rarity: 'rare', type: 'Меч', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 8, agility: 4, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_29', name: 'Обсидиановый клинок', level: 20, rarity: 'epic', type: 'Меч', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 16, agility: 8, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'wpn_30', name: 'Легендарный меч героя', level: 30, rarity: 'legendary', type: 'Меч', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 30, agility: 15, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'arm_31', name: 'Тканевая рубашка', level: 1, rarity: 'common', type: 'Рубашка', cost: 100, currency: 'silver', bonusPercent: 1, stats: { strength: 0, agility: 0, intuition: 0, endurance: 3, wisdom: 0 } },
    { id: 'arm_32', name: 'Кожаная броня', level: 5, rarity: 'uncommon', type: 'Рубашка', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 0, agility: 0, intuition: 0, endurance: 6, wisdom: 0 } },
    { id: 'arm_33', name: 'Кольчужный доспех', level: 5, rarity: 'uncommon', type: 'Рубашка', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 0, agility: 0, intuition: 0, endurance: 6, wisdom: 0 } },
    { id: 'arm_34', name: 'Железная броня', level: 1, rarity: 'common', type: 'Рубашка', cost: 100, currency: 'silver', bonusPercent: 1, stats: { strength: 0, agility: 0, intuition: 0, endurance: 3, wisdom: 0 } },
    { id: 'arm_35', name: 'Стальная броня', level: 5, rarity: 'uncommon', type: 'Рубашка', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 0, agility: 0, intuition: 0, endurance: 6, wisdom: 0 } },
    { id: 'arm_36', name: 'Ледяная броня', level: 10, rarity: 'rare', type: 'Рубашка', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 0, agility: 0, intuition: 0, endurance: 12, wisdom: 0 } },
    { id: 'arm_37', name: 'Огненная броня', level: 10, rarity: 'rare', type: 'Рубашка', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 0, agility: 0, intuition: 0, endurance: 12, wisdom: 0 } },
    { id: 'arm_38', name: 'Теневая броня', level: 20, rarity: 'epic', type: 'Рубашка', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 0, agility: 0, intuition: 0, endurance: 24, wisdom: 0 } },
    { id: 'arm_39', name: 'Святая броня', level: 30, rarity: 'legendary', type: 'Рубашка', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 0, agility: 0, intuition: 0, endurance: 45, wisdom: 0 } },
    { id: 'arm_40', name: 'Доспех дракона', level: 30, rarity: 'legendary', type: 'Рубашка', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 0, agility: 0, intuition: 0, endurance: 45, wisdom: 0 } },
    { id: 'arm_41', name: 'Плащ теней', level: 20, rarity: 'epic', type: 'Рубашка', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 0, agility: 0, intuition: 0, endurance: 24, wisdom: 0 } },
    { id: 'arm_42', name: 'Плащ мага', level: 10, rarity: 'rare', type: 'Рубашка', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 0, agility: 0, intuition: 0, endurance: 12, wisdom: 0 } },
    { id: 'arm_43', name: 'Плащ огня', level: 10, rarity: 'rare', type: 'Рубашка', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 0, agility: 0, intuition: 0, endurance: 12, wisdom: 0 } },
    { id: 'arm_44', name: 'Плащ льда', level: 10, rarity: 'rare', type: 'Рубашка', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 0, agility: 0, intuition: 0, endurance: 12, wisdom: 0 } },
    { id: 'arm_45', name: 'Броня берсерка', level: 20, rarity: 'epic', type: 'Рубашка', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 0, agility: 0, intuition: 0, endurance: 24, wisdom: 0 } },
    { id: 'arm_46', name: 'Броня паладина', level: 30, rarity: 'legendary', type: 'Рубашка', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 0, agility: 0, intuition: 0, endurance: 45, wisdom: 0 } },
    { id: 'arm_47', name: 'Броня ассасина', level: 20, rarity: 'epic', type: 'Рубашка', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 0, agility: 0, intuition: 0, endurance: 24, wisdom: 0 } },
    { id: 'arm_48', name: 'Броня стража', level: 5, rarity: 'uncommon', type: 'Рубашка', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 0, agility: 0, intuition: 0, endurance: 6, wisdom: 0 } },
    { id: 'arm_49', name: 'Броня титана', level: 30, rarity: 'legendary', type: 'Рубашка', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 0, agility: 0, intuition: 0, endurance: 45, wisdom: 0 } },
    { id: 'arm_50', name: 'Демоническая броня', level: 20, rarity: 'epic', type: 'Рубашка', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 0, agility: 0, intuition: 0, endurance: 24, wisdom: 0 } },
    { id: 'arm_51', name: 'Кристальная броня', level: 10, rarity: 'rare', type: 'Рубашка', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 0, agility: 0, intuition: 0, endurance: 12, wisdom: 0 } },
    { id: 'arm_52', name: 'Обсидиановая броня', level: 20, rarity: 'epic', type: 'Рубашка', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 0, agility: 0, intuition: 0, endurance: 24, wisdom: 0 } },
    { id: 'arm_53', name: 'Золотая броня', level: 30, rarity: 'legendary', type: 'Рубашка', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 0, agility: 0, intuition: 0, endurance: 45, wisdom: 0 } },
    { id: 'arm_54', name: 'Броня духа', level: 20, rarity: 'epic', type: 'Рубашка', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 0, agility: 0, intuition: 0, endurance: 24, wisdom: 0 } },
    { id: 'arm_55', name: 'Броня ветра', level: 10, rarity: 'rare', type: 'Рубашка', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 0, agility: 0, intuition: 0, endurance: 12, wisdom: 0 } },
    { id: 'arm_56', name: 'Броня земли', level: 5, rarity: 'uncommon', type: 'Рубашка', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 0, agility: 0, intuition: 0, endurance: 6, wisdom: 0 } },
    { id: 'arm_57', name: 'Броня молнии', level: 10, rarity: 'rare', type: 'Рубашка', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 0, agility: 0, intuition: 0, endurance: 12, wisdom: 0 } },
    { id: 'arm_58', name: 'Броня хаоса', level: 20, rarity: 'epic', type: 'Рубашка', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 0, agility: 0, intuition: 0, endurance: 24, wisdom: 0 } },
    { id: 'arm_59', name: 'Легендарный доспех героя', level: 30, rarity: 'legendary', type: 'Рубашка', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 0, agility: 0, intuition: 0, endurance: 45, wisdom: 0 } },
    { id: 'arm_60', name: 'Броня бессмертия', level: 30, rarity: 'legendary', type: 'Рубашка', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 0, agility: 0, intuition: 0, endurance: 45, wisdom: 0 } },
    { id: 'amu_91', name: 'Амулет силы', level: 5, rarity: 'uncommon', type: 'Ожерелье', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 2, agility: 2, intuition: 2, endurance: 2, wisdom: 2 } },
    { id: 'amu_92', name: 'Кольцо маны', level: 10, rarity: 'rare', type: 'Перчатки', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 4, agility: 4, intuition: 4, endurance: 4, wisdom: 4 } },
    { id: 'amu_93', name: 'Кольцо защиты', level: 5, rarity: 'uncommon', type: 'Перчатки', cost: 300, currency: 'silver', bonusPercent: 5, stats: { strength: 2, agility: 2, intuition: 2, endurance: 2, wisdom: 2 } },
    { id: 'amu_94', name: 'Амулет огня', level: 10, rarity: 'rare', type: 'Ожерелье', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 4, agility: 4, intuition: 4, endurance: 4, wisdom: 4 } },
    { id: 'amu_95', name: 'Амулет льда', level: 10, rarity: 'rare', type: 'Ожерелье', cost: 1000, currency: 'silver', bonusPercent: 10, stats: { strength: 4, agility: 4, intuition: 4, endurance: 4, wisdom: 4 } },
    { id: 'amu_96', name: 'Амулет тьмы', level: 20, rarity: 'epic', type: 'Ожерелье', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 8, agility: 8, intuition: 8, endurance: 8, wisdom: 8 } },
    { id: 'amu_97', name: 'Амулет света', level: 30, rarity: 'legendary', type: 'Ожерелье', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 15, agility: 15, intuition: 15, endurance: 15, wisdom: 15 } },
    { id: 'amu_98', name: 'Реликвия древних', level: 20, rarity: 'epic', type: 'Второе оружие', cost: 5000, currency: 'silver', bonusPercent: 20, stats: { strength: 8, agility: 8, intuition: 8, endurance: 8, wisdom: 8 } },
    { id: 'amu_99', name: 'Сердце дракона', level: 30, rarity: 'legendary', type: 'Ожерелье', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 15, agility: 15, intuition: 15, endurance: 15, wisdom: 15 } },
    { id: 'amu_100', name: 'Легендарный артефакт', level: 30, rarity: 'legendary', type: 'Ожерелье', cost: 20000, currency: 'silver', bonusPercent: 30, stats: { strength: 15, agility: 15, intuition: 15, endurance: 15, wisdom: 15 } },
  ],
  elixirs: [
    { id: 'pot_61', name: 'Малое зелье здоровья', level: 1, rarity: 'common', type: 'Эликсир', cost: 50, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_62', name: 'Среднее зелье здоровья', level: 5, rarity: 'uncommon', type: 'Эликсир', cost: 150, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_63', name: 'Большое зелье здоровья', level: 10, rarity: 'rare', type: 'Эликсир', cost: 500, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_64', name: 'Эликсир жизни', level: 20, rarity: 'epic', type: 'Эликсир', cost: 2500, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_65', name: 'Малое зелье маны', level: 1, rarity: 'common', type: 'Эликсир', cost: 50, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_66', name: 'Среднее зелье маны', level: 5, rarity: 'uncommon', type: 'Эликсир', cost: 150, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_67', name: 'Большое зелье маны', level: 10, rarity: 'rare', type: 'Эликсир', cost: 500, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_68', name: 'Эликсир маны', level: 20, rarity: 'epic', type: 'Эликсир', cost: 2500, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_69', name: 'Зелье силы', level: 5, rarity: 'uncommon', type: 'Эликсир', cost: 300, currency: 'silver', bonusPercent: 0, stats: { strength: 5, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_70', name: 'Зелье ловкости', level: 5, rarity: 'uncommon', type: 'Эликсир', cost: 300, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 5, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_71', name: 'Зелье выносливости', level: 5, rarity: 'uncommon', type: 'Эликсир', cost: 300, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 5, wisdom: 0 } },
    { id: 'pot_72', name: 'Зелье мудрости', level: 5, rarity: 'uncommon', type: 'Эликсир', cost: 300, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 5 } },
    { id: 'pot_73', name: 'Зелье удачи', level: 10, rarity: 'rare', type: 'Эликсир', cost: 1000, currency: 'silver', bonusPercent: 0, stats: { strength: 2, agility: 2, intuition: 2, endurance: 2, wisdom: 2 } },
    { id: 'pot_74', name: 'Зелье невидимости', level: 10, rarity: 'rare', type: 'Эликсир', cost: 1000, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 10, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_75', name: 'Зелье каменной кожи', level: 10, rarity: 'rare', type: 'Эликсир', cost: 1000, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 10, wisdom: 0 } },
    { id: 'pot_76', name: 'Зелье ярости', level: 10, rarity: 'rare', type: 'Эликсир', cost: 1000, currency: 'silver', bonusPercent: 0, stats: { strength: 10, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_77', name: 'Эликсир бессмертия', level: 30, rarity: 'legendary', type: 'Эликсир', cost: 20000, currency: 'silver', bonusPercent: 0, stats: { strength: 5, agility: 5, intuition: 5, endurance: 50, wisdom: 5 } },
    { id: 'pot_78', name: 'Эликсир богов', level: 30, rarity: 'legendary', type: 'Эликсир', cost: 20000, currency: 'silver', bonusPercent: 0, stats: { strength: 15, agility: 15, intuition: 15, endurance: 15, wisdom: 15 } },
    { id: 'pot_79', name: 'Зелье очищения', level: 5, rarity: 'uncommon', type: 'Эликсир', cost: 300, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'pot_80', name: 'Зелье опыта', level: 10, rarity: 'rare', type: 'Эликсир', cost: 1000, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
  ],
  books: [
    { id: 'bok_81', name: 'Книга силы', level: 5, rarity: 'uncommon', type: 'Книга', cost: 500, currency: 'silver', bonusPercent: 0, stats: { strength: 1, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'bok_82', name: 'Книга ловкости', level: 5, rarity: 'uncommon', type: 'Книга', cost: 500, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 1, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'bok_83', name: 'Книга интуиции', level: 5, rarity: 'uncommon', type: 'Книга', cost: 500, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 1, endurance: 0, wisdom: 0 } },
    { id: 'bok_84', name: 'Книга выносливости', level: 5, rarity: 'uncommon', type: 'Книга', cost: 500, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 1, wisdom: 0 } },
    { id: 'bok_85', name: 'Книга мудрости', level: 5, rarity: 'uncommon', type: 'Книга', cost: 500, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 1 } },
    { id: 'bok_86', name: 'Древний свиток', level: 10, rarity: 'rare', type: 'Книга', cost: 2000, currency: 'silver', bonusPercent: 0, stats: { strength: 2, agility: 2, intuition: 2, endurance: 2, wisdom: 2 } },
    { id: 'bok_87', name: 'Свиток знаний', level: 10, rarity: 'rare', type: 'Книга', cost: 2000, currency: 'silver', bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 5 } },
    { id: 'bok_88', name: 'Гримуар теней', level: 20, rarity: 'epic', type: 'Книга', cost: 10000, currency: 'silver', bonusPercent: 0, stats: { strength: 5, agility: 5, intuition: 5, endurance: 5, wisdom: 5 } },
    { id: 'bok_89', name: 'Фолиант света', level: 20, rarity: 'epic', type: 'Книга', cost: 10000, currency: 'silver', bonusPercent: 0, stats: { strength: 5, agility: 5, intuition: 5, endurance: 5, wisdom: 5 } },
    { id: 'bok_90', name: 'Легендарная книга навыков', level: 30, rarity: 'legendary', type: 'Книга', cost: 50000, currency: 'silver', bonusPercent: 0, stats: { strength: 10, agility: 10, intuition: 10, endurance: 10, wisdom: 10 } },
  ],
  chests: [
    { id: 'shop_chest_iron', name: 'Железный Сундук', level: 1, rarity: 'common', type: 'chest', cost: 10, currency: 'diamonds', description: 'Содержит случайные ресурсы и предметы', isChest: true, bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'shop_chest_gold', name: 'Золотой Сундук', level: 1, rarity: 'common', type: 'chest', cost: 50, currency: 'diamonds', description: 'Высокий шанс на редкие предметы', isChest: true, bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
  ],
  diamonds: [
    { id: 'shop_diamonds_10', name: '10 Алмазов', level: 1, rarity: 'common', type: 'diamonds', cost: 1000, currency: 'gold', amount: 10, bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
    { id: 'shop_diamonds_50', name: '50 Алмазов', level: 1, rarity: 'common', type: 'diamonds', cost: 4500, currency: 'gold', amount: 50, bonusPercent: 0, stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 } },
  ]
};

export default function App() {
  const [page, setPage] = useState(() => {
    const savedPage = localStorage.getItem("rpg_current_page");
    const isLoggedIn = localStorage.getItem("rpg_is_logged_in") === "true";
    const defaultPage = isLoggedIn ? 2 : 1;
    if (isLoggedIn && savedPage) return parseInt(savedPage, 10) || defaultPage;
    return defaultPage;
  });

  useEffect(() => {
    localStorage.setItem("rpg_current_page", page.toString());
  }, [page]);

  const dismantleItem = (idx: number) => {
    const item = inventory[idx];
    if (!item) return;

    const ironGained = Math.floor(Math.random() * 11) + 5; // 5-15 iron
    setIron(prev => prev + ironGained);
    
    const newInventory = [...inventory];
    newInventory.splice(idx, 1);
    setInventory(newInventory);
    setSelectedItemIdx(null);
    
    toast.success(`Предмет ${item.name} разобран. Получено ${ironGained} железа.`);
  };

  const viewPlayerProfile = (uid: string) => {
    setTargetUid(uid);
    setPage(16);
  };

  const equipItem = (idx: number) => {
    const item = inventory[idx];
    if (!item) return;

    let slot = "";
    const name = item.name.toLowerCase();
    if (name.includes("шлем")) slot = "Шлем";
    else if (name.includes("наручи")) slot = "Наручи";
    else if (name.includes("меч") || name.includes("топор") || name.includes("посох") || name.includes("лук")) slot = "Меч";
    else if (name.includes("штаны")) slot = "Штаны";
    else if (name.includes("сапоги")) slot = "Сапоги";
    else if (name.includes("ожерелье") || name.includes("амулет")) slot = "Ожерелье";
    else if (name.includes("перчатки")) slot = "Перчатки";
    else if (name.includes("щит")) slot = "Второе оружие";
    else if (name.includes("рубашка") || name.includes("доспех") || name.includes("кольчуга")) slot = "Рубашка";
    else if (name.includes("пояс")) slot = "Пояс";

    if (!slot) {
      toast.error("Не удалось определить слот для этого предмета.");
      return;
    }

    const oldItem = equippedItems[slot];
    const newEquipped = { ...equippedItems, [slot]: item };
    setEquippedItems(newEquipped);

    const newInventory = [...inventory];
    newInventory.splice(idx, 1);
    if (oldItem) {
      newInventory.push(oldItem);
    }
    setInventory(newInventory);
    setSelectedItemIdx(null);

    toast.success(`Вы экипировали ${item.name}.`);
  };

  const unequipItem = (slot: string) => {
    const item = equippedItems[slot];
    if (!item) return;

    const newEquipped = { ...equippedItems, [slot]: null };
    setEquippedItems(newEquipped);

    setInventory(prev => [...prev, item]);
    toast.success(`Вы сняли ${item.name}.`);
  };

  const buyItem = (shopItem: any) => {
    // Check currency
    if (shopItem.currency === 'silver' && silver < shopItem.cost) {
      toast.error("Недостаточно серебра!");
      return;
    }
    if (shopItem.currency === 'gold' && gold < shopItem.cost) {
      toast.error("Недостаточно золота!");
      return;
    }
    if (shopItem.currency === 'diamonds' && diamonds < shopItem.cost) {
      toast.error("Недостаточно алмазов!");
      return;
    }

    // Deduct currency
    if (shopItem.currency === 'silver') setSilver(prev => prev - shopItem.cost);
    if (shopItem.currency === 'gold') setGold(prev => prev - shopItem.cost);
    if (shopItem.currency === 'diamonds') setDiamonds(prev => prev - shopItem.cost);

    // Handle purchase
    if (shopItem.type === 'diamonds') {
      setDiamonds(prev => prev + shopItem.amount);
      toast.success(`Куплено ${shopItem.amount} алмазов!`);
    } else {
      const newItem: Item = {
        ...shopItem,
        id: Math.random().toString(36).substr(2, 9),
      };
      setInventory(prev => [...prev, newItem]);
      toast.success(`Предмет ${shopItem.name} добавлен в инвентарь!`);
    }
  };

  const [inventoryTab, setInventoryTab] = useState<"equipment" | "books" | "elixirs" | "chests">(() => {
    return (localStorage.getItem("rpg_inventory_tab") as any) || "equipment";
  });

  const [shopTab, setShopTab] = useState<"equipment" | "elixirs" | "books" | "chests" | "diamonds">("equipment");

  useEffect(() => {
    localStorage.setItem("rpg_inventory_tab", inventoryTab);
  }, [inventoryTab]);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [wolfHealth, setWolfHealth] = useState(100);
  const [battleStep, setBattleStep] = useState(0);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [silver, setSilver] = useState(() => parseInt(localStorage.getItem("rpg_silver") || "0", 10) || 0);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem("rpg_player_name") || "Герой");
  const [chatMessages, setChatMessages] = useState<{id: string, sender: string, text: string, timestamp: any, avatarUrl?: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [news, setNews] = useState<{id: string, title: string, content: string, date: string}[]>([]);
  const [forumPosts, setForumPosts] = useState<{id: string, title: string, author: string, content: string, timestamp: any, replies: number}[]>([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [isClanSettingsOpen, setIsClanSettingsOpen] = useState(false);
  const [clanMinLevel, setClanMinLevel] = useState(1);
  const [isClanPrivate, setIsClanPrivate] = useState(false);
  const [clanAvatarUrl, setClanAvatarUrl] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem("rpg_is_logged_in") === "true");
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        try {
          const { signInAnonymously } = await import('firebase/auth');
          await signInAnonymously(auth);
          setAuthError(null);
        } catch (error: any) {
          console.error("Anonymous sign-in failed:", error);
          setAuthError(error.code);
          if (error.code === 'auth/admin-restricted-operation') {
            toast.error("Firebase: Анонимная авторизация отключена. Пожалуйста, включите её в консоли Firebase.", {
              duration: 10000,
            });
          }
          setIsAuthReady(true);
        }
      } else {
        setAuthError(null);
        // Load player data from Firestore
        const data = await loadPlayerData(user.uid);
        if (data) {
          // Initialize state with loaded data
          setPlayerName(data.playerName || "Герой");
          setPlayerRace(data.playerRace || "Человек");
          setPlayerEmail(data.playerEmail || "");
          setRealName(data.realName || "");
          setBirthYear(data.birthYear || 2000);
          setCountry(data.country || "Неизвестно");
          setCharacterStatus(data.characterStatus || "Новичок");
          setPlayerGender(data.playerGender || "male");
          setAvatarUrl(data.avatarUrl || "");
          setPlayerAge(data.playerAge || 18);
          setPlayerBirthday(data.playerBirthday || "01.01.2000");
          setHasGiftKey(data.hasGiftKey || false);
          setHasCompletedOnboarding(data.hasCompletedOnboarding || false);
          setIsNameHidden(data.isNameHidden || false);
          setIsAgeHidden(data.isAgeHidden || false);
          setIsBirthdayHidden(data.isBirthdayHidden || false);
          setIsCountryHidden(data.isCountryHidden || false);
          setSilver(data.silver || 0);
          // ... (add other fields as needed)
        }
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);
  const [playerRace, setPlayerRace] = useState(() => localStorage.getItem("rpg_player_race") || "Человек");
  const [playerEmail, setPlayerEmail] = useState(() => localStorage.getItem("rpg_player_email") || "");
  const [realName, setRealName] = useState(() => localStorage.getItem("rpg_real_name") || "");
  const [birthYear, setBirthYear] = useState(() => parseInt(localStorage.getItem("rpg_birth_year") || "2000", 10) || 2000);
  const [country, setCountry] = useState(() => localStorage.getItem("rpg_country") || "Неизвестно");
  const [characterStatus, setCharacterStatus] = useState(() => localStorage.getItem("rpg_character_status") || "Новичок");
  const [playerGender, setPlayerGender] = useState<"male" | "female">(() => {
    const saved = localStorage.getItem("rpg_player_gender") || localStorage.getItem("gender");
    return (saved === "female" ? "female" : "male") as "male" | "female";
  });
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem("rpg_avatar_url") || "");

  const [playerAge, setPlayerAge] = useState(() => parseInt(localStorage.getItem("rpg_player_age") || "18", 10) || 18);
  const [playerBirthday, setPlayerBirthday] = useState(() => localStorage.getItem("rpg_player_birthday") || "01.01.2000");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasGiftKey, setHasGiftKey] = useState(() => localStorage.getItem("rpg_has_gift_key") === "true");
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => localStorage.getItem("rpg_onboarding_complete") === "true");
  const [tempName, setTempName] = useState("");
  const [tempRace, setTempRace] = useState("Человек");
  const [tempRealName, setTempRealName] = useState("");
  const [tempBirthYear, setTempBirthYear] = useState(2000);
  const [tempAge, setTempAge] = useState(18);
  const [tempBirthday, setTempBirthday] = useState("01.01.2000");
  const [tempCountry, setTempCountry] = useState("Россия");
  const [tempStatus, setTempStatus] = useState("В поиске приключений");
  const [tempAvatarUrl, setTempAvatarUrl] = useState("");
  const [tempIsNameHidden, setTempIsNameHidden] = useState(false);
  const [tempIsAgeHidden, setTempIsAgeHidden] = useState(false);
  const [tempIsBirthdayHidden, setTempIsBirthdayHidden] = useState(false);
  const [tempIsCountryHidden, setTempIsCountryHidden] = useState(false);
  const [isNameHidden, setIsNameHidden] = useState(() => localStorage.getItem("rpg_name_hidden") === "true");
  const [isAgeHidden, setIsAgeHidden] = useState(() => localStorage.getItem("rpg_age_hidden") === "true");
  const [isBirthdayHidden, setIsBirthdayHidden] = useState(() => localStorage.getItem("rpg_birthday_hidden") === "true");
  const [isCountryHidden, setIsCountryHidden] = useState(() => localStorage.getItem("rpg_country_hidden") === "true");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [globalEvents, setGlobalEvents] = useState<any[]>([]);
  const [showGlobalFeed, setShowGlobalFeed] = useState(false);
  const [hasNewEvents, setHasNewEvents] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isIndicatorsExpanded, setIsIndicatorsExpanded] = useState(false);
  const [isInventoryExpanded, setIsInventoryExpanded] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [newFriendNickname, setNewFriendNickname] = useState("");
  const [playerClan, setPlayerClan] = useState(() => localStorage.getItem("rpg_player_clan") || "Без клана");
  
  // Ref to prevent sync loops
  const isSyncingFromServer = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [friends, setFriends] = useState<{uid?: string, nickname: string, status?: string}[]>(() => {
    const saved = localStorage.getItem("rpg_player_friends");
    return saved ? JSON.parse(saved) : [];
  });
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [userLocations, setUserLocations] = useState<Record<string, string>>({});
  const [clan, setClan] = useState<any>(null);
  const [clanId, setClanId] = useState<string | null>(() => localStorage.getItem("rpg_clan_id"));
  const [tempUsername, setTempUsername] = useState("");
  const [tempGender, setTempGender] = useState<"male" | "female">("male");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regRace, setRegRace] = useState("Человек");
  const [regGender, setRegGender] = useState<"male" | "female">("male");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  useEffect(() => {
    localStorage.setItem("rpg_is_logged_in", isLoggedIn.toString());
  }, [isLoggedIn]);


  const [xp, setXp] = useState(() => parseInt(localStorage.getItem("rpg_xp") || "100", 10) || 100);
  const currentLevel = useMemo(() => {
    let level = 1;
    for (let i = 1; i <= 85; i++) {
      if (xp >= XP_TABLE[i]) {
        level = i;
      } else {
        break;
      }
    }
    return level;
  }, [xp]);

  const [onlineUserProfiles, setOnlineUserProfiles] = useState<Record<string, any>>({});

  // Real-time Socket.IO connection
  useEffect(() => {
    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    newSocket.on("connect", () => {
      if (auth.currentUser) {
        newSocket.emit("user_login", {
          userId: auth.currentUser.uid,
          playerName: playerName,
          avatarUrl: avatarUrl,
          level: currentLevel
        });
      }
    });

    newSocket.on("user_status", ({ userId, status, profile }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (status === "online") {
          next.add(userId);
          if (profile) {
            setOnlineUserProfiles(prevProfiles => ({ ...prevProfiles, [userId]: profile }));
          }
        } else {
          next.delete(userId);
          setOnlineUserProfiles(prevProfiles => {
            const nextProfiles = { ...prevProfiles };
            delete nextProfiles[userId];
            return nextProfiles;
          });
          setUserLocations(prevLocs => {
            const nextLocs = { ...prevLocs };
            delete nextLocs[userId];
            return nextLocs;
          });
        }
        return next;
      });
    });

    newSocket.on("user_location", ({ userId, location }) => {
      setUserLocations(prev => ({ ...prev, [userId]: location }));
    });

    newSocket.on("all_online_data", ({ locations, profiles }) => {
      setUserLocations(locations);
      setOnlineUserProfiles(profiles);
      setOnlineUsers(new Set(Object.keys(profiles)));
    });

    newSocket.on("global_message", (data) => {
      setGlobalEvents(prev => [data, ...prev].slice(0, 50));
      setHasNewEvents(true);
      if (data.type === 'achievement') {
        toast.success(`Достижение: ${data.message}`, {
          icon: <Trophy className="w-4 h-4 text-lime-300" />
        });
      }
    });

    newSocket.on("player_action", (data) => {
      setGlobalEvents(prev => [data, ...prev].slice(0, 50));
      setHasNewEvents(true);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socket && auth.currentUser) {
      socket.emit("user_login", {
        userId: auth.currentUser.uid,
        playerName: playerName,
        avatarUrl: avatarUrl,
        level: currentLevel
      });
    }
  }, [socket, auth.currentUser, playerName, avatarUrl, currentLevel]);

  // Update location when page changes
  useEffect(() => {
    if (socket && isLoggedIn) {
      let locationName = "Город";
      if (page === 4) locationName = "Лес";
      if (page === 26) locationName = "Горы";
      if (page === 25) locationName = "Арена";
      if (page === 19) locationName = "Чат";
      if (page === 21) locationName = "Форум";
      if (page === 10) locationName = "Магазин";
      
      socket.emit("user_location", locationName);
    }
  }, [page, socket, isLoggedIn]);

  // Real-time Firestore user data
  useEffect(() => {
    if (!isLoggedIn || !isAuthReady || !auth.currentUser) return;
    
    const user = auth.currentUser;
    const docId = user ? user.uid : playerName;
    if (!docId) return;

    const unsubscribe = onSnapshot(doc(db, "users", docId), (doc) => {
      if (doc.exists()) {
        isSyncingFromServer.current = true;
        const data = doc.data();
        if (data.playerName) setPlayerName(data.playerName);
        if (data.username && !data.playerName) setPlayerName(data.username);
        if (data.race) setPlayerRace(data.race);
        if (data.gender) setPlayerGender(data.gender);
        if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
        if (data.silver !== undefined) setSilver(data.silver);
        if (data.iron !== undefined) setIron(data.iron);
        if (data.gold !== undefined) setGold(data.gold);
        if (data.diamonds !== undefined) setDiamonds(data.diamonds);
        if (data.xp !== undefined) setXp(data.xp);
        if (data.inventory) setInventory(data.inventory);
        if (data.equippedItems) setEquippedItems(data.equippedItems);
        if (data.messages) setMessages(data.messages);
        if (data.hasGiftKey !== undefined) setHasGiftKey(data.hasGiftKey);
        if (data.prevLevel !== undefined) setPrevLevel(data.prevLevel);
        if (data.characterStatus) setCharacterStatus(data.characterStatus);
        if (data.realName) setRealName(data.realName);
        if (data.birthYear) setBirthYear(data.birthYear);
        if (data.country) setCountry(data.country);
        if (data.playerAge) setPlayerAge(data.playerAge);
        if (data.playerBirthday) setPlayerBirthday(data.playerBirthday);
        if (data.isNameHidden !== undefined) setIsNameHidden(data.isNameHidden);
        if (data.isAgeHidden !== undefined) setIsAgeHidden(data.isAgeHidden);
        if (data.isBirthdayHidden !== undefined) setIsBirthdayHidden(data.isBirthdayHidden);
        if (data.isCountryHidden !== undefined) setIsCountryHidden(data.isCountryHidden);
        if (data.friends) setFriends(data.friends);
        if (data.clanId) setClanId(data.clanId);
        else setClanId(null);
        if (data.forestProgress !== undefined) setForestProgress(data.forestProgress);
        if (data.mountainProgress !== undefined) setMountainProgress(data.mountainProgress);
        if (data.blackWolfKills !== undefined) setBlackWolfKills(data.blackWolfKills);
        if (data.spentStrength !== undefined) setSpentStrength(data.spentStrength);
        if (data.spentAgility !== undefined) setSpentAgility(data.spentAgility);
        if (data.spentIntuition !== undefined) setSpentIntuition(data.spentIntuition);
        if (data.spentEndurance !== undefined) setSpentEndurance(data.spentEndurance);
        if (data.spentWisdom !== undefined) setSpentWisdom(data.spentWisdom);
        if (data.playerBadges) setPlayerBadges(data.playerBadges);
        if (data.playerStatus) setPlayerStatus(data.playerStatus);
        if (data.roles) setUserRoles(data.roles);
        
        // Reset the flag after a short delay to ensure all state updates are processed
        setTimeout(() => {
          isSyncingFromServer.current = false;
        }, 100);
      } else {
        // Document doesn't exist, but we think we are logged in.
        // This can happen if the document was deleted or Firestore was reset.
        if (isLoggedIn) {
          setIsLoggedIn(false);
          setHasCompletedOnboarding(false);
          localStorage.removeItem("rpg_is_logged_in");
          localStorage.removeItem("rpg_onboarding_complete");
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${docId}`);
    });

    return () => unsubscribe();
  }, [isLoggedIn, playerName]);

  // Real-time Clan data
  useEffect(() => {
    if (!clanId || !isLoggedIn || !isAuthReady || !auth.currentUser) {
      setClan(null);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "clans", clanId), (doc) => {
      if (doc.exists()) {
        setClan(doc.data());
      } else {
        setClan(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `clans/${clanId}`);
    });

    return () => unsubscribe();
  }, [clanId]);

  const getStatusText = (status: string) => {
    if (status === "online") return "онлайн";
    if (status === "recent") return "был недавно";
    return "оффлайн";
  };

  const getStatusDot = (status: string) => {
    if (status === "online") return <span className="text-green-500 mr-1">●</span>;
    return <span className="text-zinc-500 mr-1">○</span>;
  };
  const [iron, setIron] = useState(() => parseInt(localStorage.getItem("rpg_iron") || "0", 10) || 0);
  const [gold, setGold] = useState(() => parseInt(localStorage.getItem("rpg_gold") || "0", 10) || 0);
  const [diamonds, setDiamonds] = useState(() => parseInt(localStorage.getItem("rpg_diamonds") || "0", 10) || 0);
  const [inventory, setInventory] = useState<Item[]>(() => {
    const saved = localStorage.getItem("rpg_inventory");
    return saved ? JSON.parse(saved) : [];
  });
  const [booksInventory, setBooksInventory] = useState<string[]>(() => {
    const saved = localStorage.getItem("rpg_books_inventory");
    return saved ? JSON.parse(saved) : [];
  });
  const [elixirsInventory, setElixirsInventory] = useState<string[]>(() => {
    const saved = localStorage.getItem("rpg_elixirs_inventory");
    return saved ? JSON.parse(saved) : [];
  });
  const [chestsInventory, setChestsInventory] = useState<Item[]>(() => {
    const saved = localStorage.getItem("rpg_chests_inventory");
    return saved ? JSON.parse(saved) : [];
  });
  const [equippedItems, setEquippedItems] = useState<{[key: string]: Item | null}>(() => {
    const saved = localStorage.getItem("rpg_equipped_items");
    return saved ? JSON.parse(saved) : {
      "Шлем": null,
      "Наручи": null,
      "Меч": null,
      "Штаны": null,
      "Сапоги": null,
      "Ожерелье": null,
      "Перчатки": null,
      "Второе оружие": null,
      "Рубашка": null,
      "Пояс": null,
    };
  });
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(null);
  const [lastXpGained, setLastXpGained] = useState(0);
  const [forestProgress, setForestProgress] = useState(() => parseInt(localStorage.getItem("rpg_forest_progress") || "0", 10) || 0);
  const [mountainProgress, setMountainProgress] = useState(() => parseInt(localStorage.getItem("rpg_mountain_progress") || "0", 10) || 0);
  const [matchmakingStatus, setMatchmakingStatus] = useState<'idle' | 'searching' | 'matched'>('idle');
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [currentBattleId, setCurrentBattleId] = useState<string | null>(null);
  const [pvpBattle, setPvpBattle] = useState<any>(null);
  const [title, setTitle] = useState({ name: "Новичок", description: "— ты только начинаешь свой путь." });
  const [ownedTitles, setOwnedTitles] = useState([
    { name: "Новичок", description: "— ты только начинаешь свой путь." }
  ]);
  const [selectedTitle, setSelectedTitle] = useState<{ name: string, description: string } | null>(null);
  const [lastDrops, setLastDrops] = useState<string[]>([]);
  const [lastSilver, setLastSilver] = useState(0);
  const [lastIron, setLastIron] = useState(0);
  const [blackWolfKills, setBlackWolfKills] = useState(() => parseInt(localStorage.getItem("rpg_black_wolf_kills") || "0", 10) || 0);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSeen, setLastSeen] = useState(new Date());
  const [clanName, setClanName] = useState<string | null>(() => {
    const saved = localStorage.getItem("rpg_clan_name");
    const fakeClans = ["Легион Смерти", "Орден Света", "Тени Леса", "Волки Севера", "Золотой Дракон"];
    if (saved && fakeClans.includes(saved)) return null;
    return saved;
  });
  const [clanRole, setClanRole] = useState<string>(() => localStorage.getItem("rpg_clan_role") || "Новобранец");
  const [clanJoinedDate, setClanJoinedDate] = useState<string | null>(() => localStorage.getItem("rpg_clan_joined_date"));
  const [clanMembers, setClanMembers] = useState<{name: string, role: string, level: number}[]>(() => {
    const saved = localStorage.getItem("rpg_clan_members");
    if (saved) {
      const parsed = JSON.parse(saved);
      const fakeMembers = ["СильныйВоин", "ТеневойУбийца", "МудрыйМаг", "ЛеснойДруид", "СтальнойРыцарь", "ГлаваКлана", "ЗамГлавы", "Офицер1", "Почтальон", "Боец", "Гром", "Элирия", "Тень", "Мрак"];
      return parsed.filter((m: any) => !fakeMembers.includes(m.name));
    }
    return [];
  });
  const [showClanLeaveConfirm, setShowClanLeaveConfirm] = useState(false);
  const [isCreatingClan, setIsCreatingClan] = useState(false);
  const [isJoiningClan, setIsJoiningClan] = useState(false);
  const [newClanNameInput, setNewClanNameInput] = useState("");
  const [clanSearchQuery, setClanSearchQuery] = useState("");
  const [clanTab, setClanTab] = useState<"info" | "members" | "manage">(() => {
    return (localStorage.getItem("rpg_clan_tab") as any) || "info";
  });

  useEffect(() => {
    localStorage.setItem("rpg_clan_tab", clanTab);
  }, [clanTab]);
  const [selectedMemberIdx, setSelectedMemberIdx] = useState<number | null>(null);
  const [existingClans, setExistingClans] = useState<{name: string, members: number}[]>([]);

  useEffect(() => {
    if (!isLoggedIn || !isAuthReady || !auth.currentUser) return;
    const q = query(collection(db, "clans"), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clans = snapshot.docs.map(doc => ({
        name: doc.id,
        members: doc.data().members?.length || 0
      }));
      setExistingClans(clans);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "clans");
    });
    return () => unsubscribe();
  }, [isLoggedIn]);

  useEffect(() => {
    if (clanName && clanJoinedDate) {
      const joinedDate = new Date(clanJoinedDate);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - joinedDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 7 && clanRole === "Новобранец") {
        setClanRole("Воины");
      }
    }
  }, [clanName, clanJoinedDate, clanRole]);

  const [spentStrength, setSpentStrength] = useState(() => parseInt(localStorage.getItem("rpg_spent_strength") || "0", 10) || 0);
  const [spentAgility, setSpentAgility] = useState(() => parseInt(localStorage.getItem("rpg_spent_agility") || "0", 10) || 0);
  const [spentIntuition, setSpentIntuition] = useState(() => parseInt(localStorage.getItem("rpg_spent_intuition") || "0", 10) || 0);
  const [spentEndurance, setSpentEndurance] = useState(() => parseInt(localStorage.getItem("rpg_spent_endurance") || "0", 10) || 0);
  const [spentWisdom, setSpentWisdom] = useState(() => parseInt(localStorage.getItem("rpg_spent_wisdom") || "0", 10) || 0);
  const [pendingStats, setPendingStats] = useState({
    strength: 0,
    agility: 0,
    intuition: 0,
    endurance: 0,
    wisdom: 0
  });
  const [adminResourceAmount, setAdminResourceAmount] = useState<number>(100);
  const [messages, setMessages] = useState<{id: number, text: string, read: boolean, date: string, claimable?: {iron?: number, silver?: number, gold?: number, diamonds?: number, givesKey?: boolean}, claimed?: boolean}[]>(() => {
    const saved = localStorage.getItem("rpg_messages");
    return saved ? JSON.parse(saved) : [];
  });
  const [prevLevel, setPrevLevel] = useState(() => parseInt(localStorage.getItem("rpg_prev_level") || "1", 10) || 1);

  // Global announcements for level-ups and items

  const isMaxLevel = currentLevel >= 85;
  const currentLevelBaseXp = XP_TABLE[currentLevel];
  const nextLevelXp = isMaxLevel ? currentLevelBaseXp : XP_TABLE[currentLevel + 1];
  const xpIntoLevel = isMaxLevel ? 0 : xp - currentLevelBaseXp;
  const xpNeededForNext = isMaxLevel ? 1 : nextLevelXp - currentLevelBaseXp;
  const xpPercentage = isMaxLevel ? 100 : Math.max(0, Math.min(100, isNaN(xpIntoLevel / xpNeededForNext) ? 0 : (xpIntoLevel / xpNeededForNext) * 100));

  const [currentEnemy, setCurrentEnemy] = useState<any>(FOREST_ENEMIES[0]);
  
  useEffect(() => {
    if (page !== 4 && forestProgress < 4) {
      setCurrentEnemy(FOREST_ENEMIES[forestProgress]);
    }
  }, [forestProgress, page]);
  
  const totalStatPoints = Math.min(currentLevel - 1, 49) * 5;
  const totalPending = pendingStats.strength + pendingStats.agility + pendingStats.intuition + pendingStats.endurance + pendingStats.wisdom;
  const unspentStatPoints = totalStatPoints - (spentStrength + spentAgility + spentIntuition + spentEndurance + spentWisdom) - totalPending;

  const gearBonuses = useMemo(() => {
    const bonuses = { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 };
    let manaCost = 0;
    let spellPower = 0;
    let cooldownReduction = 0;

    Object.values(equippedItems).forEach(item => {
      if (item) {
        const typedItem = item as Item;
        bonuses.strength += typedItem.stats.strength || 0;
        bonuses.agility += typedItem.stats.agility || 0;
        bonuses.intuition += typedItem.stats.intuition || 0;
        bonuses.endurance += typedItem.stats.endurance || 0;
        bonuses.wisdom += typedItem.stats.wisdom || 0;
        manaCost += typedItem.mana_cost || 0;
        spellPower += typedItem.spell_power || 0;
        cooldownReduction += typedItem.cooldown_reduction || 0;
      }
    });
    return { bonuses, manaCost, spellPower, cooldownReduction };
  }, [equippedItems]);

  const elixirBonuses = { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 };

  const totalStrength = 10 + spentStrength + gearBonuses.bonuses.strength + elixirBonuses.strength;
  const totalAgility = 10 + spentAgility + gearBonuses.bonuses.agility + elixirBonuses.agility;
  const totalIntuition = 10 + spentIntuition + gearBonuses.bonuses.intuition + elixirBonuses.intuition;
  const totalEndurance = 10 + spentEndurance + gearBonuses.bonuses.endurance + elixirBonuses.endurance;
  const totalWisdom = 10 + spentWisdom + gearBonuses.bonuses.wisdom + elixirBonuses.wisdom;

  const totalManaCost = gearBonuses.manaCost;
  const totalSpellPower = gearBonuses.spellPower;
  const totalCooldownReduction = gearBonuses.cooldownReduction;

  const maxPlayerHealth = useMemo(() => {
    const basePlayerHealth = 200 + (currentLevel - 1) * 50;
    return Math.floor(basePlayerHealth * (1 + (totalEndurance - 10) * 0.15));
  }, [currentLevel, totalEndurance]);

  const getHealthColor = (current: number, max: number) => {
    const p = (current / max) * 100;
    if (p >= 70) return "bg-gradient-to-r from-lime-400 to-emerald-500";
    if (p >= 30) return "bg-gradient-to-r from-amber-400 to-orange-500";
    return "bg-gradient-to-r from-rose-500 to-red-600";
  };

  useEffect(() => {
    if (page !== 4) {
      setPlayerHealth(maxPlayerHealth);
    }
  }, [maxPlayerHealth, page]);

  const lastLevelMessageSent = useRef(prevLevel);

  useEffect(() => {
    if (currentLevel > prevLevel && currentLevel > lastLevelMessageSent.current) {
      lastLevelMessageSent.current = currentLevel;
      const newMsg = {
        id: Date.now(),
        text: `Поздравляем! Вы достигли ${currentLevel} уровня. Вам начислено 5 очков характеристик (доступно до 50 уровня).`,
        read: false,
        date: new Date().toLocaleTimeString()
      };
      
      // Level 2 gift: Chest
      if (currentLevel === 2) {
        const giftMsg = {
          id: Date.now() + 1,
          text: "Поздравляем с достижением 2 уровня! Вот ваш приветственный сундук. Чтобы открыть его, вам понадобится специальное кольцо-ключ, которое вы получите на 5 уровне.",
          read: false,
          date: new Date().toLocaleTimeString(),
          claimable: {
            iron: 5000,
            silver: 50000
          },
          claimed: false
        };
        setMessages(prev => [giftMsg, newMsg, ...prev]);
      } else if (currentLevel === 5) {
        const keyMsg = {
          id: Date.now() + 2,
          text: "Поздравляем с достижением 5 уровня! Как и обещали, вот ваше Кольцо-ключ для открытия подарочного сундука.",
          read: false,
          date: new Date().toLocaleTimeString(),
          claimable: {
            givesKey: true
          },
          claimed: false
        };
        setMessages(prev => [keyMsg, newMsg, ...prev]);
      } else {
        setMessages(prev => [newMsg, ...prev]);
      }
      
      setPrevLevel(currentLevel);
    }
  }, [currentLevel, prevLevel]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (page !== 2) {
      setIsStatsExpanded(false);
      setIsIndicatorsExpanded(false);
    }
  }, [page]);

  const [combatCooldown, setCombatCooldown] = useState(0);
  const [playerDamageAnim, setPlayerDamageAnim] = useState<{ value: number | string, type: string, id: number } | null>(null);
  const [enemyDamageAnim, setEnemyDamageAnim] = useState<{ value: number | string, type: string, id: number } | null>(null);
  const [isSurrendering, setIsSurrendering] = useState(false);
  const [playerBadges, setPlayerBadges] = useState<string[]>(() => {
    const saved = localStorage.getItem("rpg_player_badges");
    return saved ? JSON.parse(saved) : [];
  });
  const [playerStatus, setPlayerStatus] = useState<string | null>(() => localStorage.getItem("rpg_player_status"));
  const [targetUid, setTargetUid] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const isAdmin = useMemo(() => {
    return auth.currentUser?.email === 'svksinel@gmail.com' || 
           playerName === 'Murr' || 
           playerName === 'admin' || 
           userRoles.includes('admin');
  }, [auth.currentUser, playerName, userRoles]);

  const isCreator = useMemo(() => {
    return auth.currentUser?.email === 'svksinel@gmail.com' || 
           playerName === 'Murr' || 
           userRoles.includes('creator');
  }, [auth.currentUser, playerName, userRoles]);

  // Global Chat Effect
  useEffect(() => {
    if (!isLoggedIn || !isAuthReady || !auth.currentUser) return;
    const q = query(collection(db, "global_chat"), orderBy("timestamp", "desc"), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
      setChatMessages(msgs as any);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "global_chat");
    });
    return () => unsubscribe();
  }, [isLoggedIn, isAuthReady]);

  const joinMatchmaking = async () => {
    if (!playerName || matchmakingStatus !== 'idle' || !auth.currentUser) return;
    setMatchmakingStatus('searching');
    setPage(27);
    
    try {
      const matchId = Math.random().toString(36).substr(2, 9);
      setCurrentMatchId(matchId);
      const matchRef = doc(db, "matchmaking_1v1", matchId);
      
      // Check for available opponents
      const q = query(
        collection(db, "matchmaking_1v1"), 
        where("status", "==", "waiting"),
        limit(10)
      );
      
      const snapshot = await getDocs(q);
      const availableMatch = snapshot.docs.find(d => d.data().playerId !== auth.currentUser?.uid);
      
      if (availableMatch) {
        // Match found!
        const opponentData = availableMatch.data();
        const battleId = `battle_${Date.now()}`;
        
        // Create battle
        await setDoc(doc(db, "battles_1v1", battleId), {
          player1Id: opponentData.playerId,
          player1Name: opponentData.playerName,
          player1Health: 1000, // Placeholder, should use real health
          player1MaxHealth: 1000,
          player2Id: auth.currentUser?.uid || playerName,
          player2Name: playerName,
          player2Health: maxPlayerHealth,
          player2MaxHealth: maxPlayerHealth,
          turn: opponentData.playerId,
          status: "active",
          logs: ["Бой начался!"],
          lastActionTimestamp: Date.now()
        });
        
        // Update matchmaking status
        await updateDoc(doc(db, "matchmaking_1v1", availableMatch.id), {
          status: "matched",
          opponentId: auth.currentUser?.uid || playerName,
          battleId: battleId
        });
        
        setCurrentBattleId(battleId);
        setMatchmakingStatus('matched');
        setPage(25); // PvP Battle Page
      } else {
        // No match found, wait in queue
        await setDoc(matchRef, {
          playerId: auth.currentUser?.uid || playerName,
          playerName: playerName,
          level: currentLevel,
          timestamp: Date.now(),
          status: "waiting"
        });
        
        // Listen for match
        const unsub = onSnapshot(matchRef, (doc) => {
          if (doc.exists() && doc.data().status === 'matched') {
            setCurrentBattleId(doc.data().battleId);
            setMatchmakingStatus('matched');
            setPage(25);
            unsub();
            // Cleanup matchmaking doc
            deleteDoc(matchRef);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, "matchmaking_1v1");
        });
      }
    } catch (error) {
      console.error("Matchmaking error:", error);
      setMatchmakingStatus('idle');
      setPage(2);
    }
  };
  // Real-time PvP Battle
  useEffect(() => {
    if (!currentBattleId || page !== 25 || !auth.currentUser) {
      setPvpBattle(null);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "battles_1v1", currentBattleId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setPvpBattle(data);
        
        if (data.status === 'finished') {
          const isWinner = data.winnerId === (auth.currentUser?.uid || playerName);
          if (isWinner) {
            toast.success("Вы победили в PvP поединке!");
            setSilver(prev => prev + 500);
            setXp(prev => prev + 200);
          } else {
            toast.error("Вы проиграли в PvP поединке.");
          }
          
          setTimeout(() => {
            setPage(22);
            setCurrentBattleId(null);
            setMatchmakingStatus('idle');
          }, 3000);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `battles_1v1/${currentBattleId}`);
    });

    return () => unsubscribe();
  }, [currentBattleId, page]);

  const joinSquadMatchmaking = async () => {
    if (!playerName || matchmakingStatus !== 'idle' || !auth.currentUser) return;
    setMatchmakingStatus('searching');
    setPage(27);
    
    try {
      const matchId = Math.random().toString(36).substr(2, 9);
      setCurrentMatchId(matchId);
      const matchRef = doc(db, "matchmaking_squad", matchId);
      
      const q = query(
        collection(db, "matchmaking_squad"), 
        where("status", "==", "waiting"),
        limit(10)
      );
      
      const snapshot = await getDocs(q);
      const availableMatch = snapshot.docs.find(d => d.data().playerId !== auth.currentUser?.uid);
      
      if (availableMatch) {
        const battleId = Math.random().toString(36).substr(2, 9);
        await updateDoc(doc(db, "matchmaking_squad", availableMatch.id), {
          status: "matched",
          battleId: battleId,
          opponentId: auth.currentUser.uid,
          opponentName: playerName
        });
        
        await setDoc(doc(db, "battles_squad", battleId), {
          player1Id: availableMatch.data().playerId,
          player1Name: availableMatch.data().playerName,
          player2Id: auth.currentUser.uid,
          player2Name: playerName,
          status: "active",
          turn: availableMatch.data().playerId,
          player1Hp: 1000,
          player2Hp: 1000,
          timestamp: serverTimestamp()
        });
        
        setCurrentBattleId(battleId);
        setMatchmakingStatus('matched');
        setPage(24); // Squad Battle Page
      } else {
        await setDoc(matchRef, {
          playerId: auth.currentUser.uid,
          playerName: playerName,
          level: currentLevel,
          timestamp: Date.now(),
          status: "waiting"
        });
        
        const unsub = onSnapshot(matchRef, (doc) => {
          if (doc.exists() && doc.data().status === 'matched') {
            setCurrentBattleId(doc.data().battleId);
            setMatchmakingStatus('matched');
            setPage(24);
            unsub();
            deleteDoc(matchRef);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, "matchmaking_squad");
        });
      }
    } catch (error) {
      console.error("Matchmaking error:", error);
      setMatchmakingStatus('idle');
      setPage(23);
    }
  };

  const joinBattleRoyaleMatchmaking = async () => {
    if (!playerName || matchmakingStatus !== 'idle' || !auth.currentUser) return;
    setMatchmakingStatus('searching');
    setPage(27);
    
    try {
      const matchId = Math.random().toString(36).substr(2, 9);
      setCurrentMatchId(matchId);
      const matchRef = doc(db, "matchmaking_br", matchId);
      
      const q = query(
        collection(db, "matchmaking_br"), 
        where("status", "==", "waiting"),
        limit(10)
      );
      
      const snapshot = await getDocs(q);
      const availableMatch = snapshot.docs.find(d => d.data().playerId !== auth.currentUser?.uid);
      
      if (availableMatch) {
        const battleId = Math.random().toString(36).substr(2, 9);
        await updateDoc(doc(db, "matchmaking_br", availableMatch.id), {
          status: "matched",
          battleId: battleId,
          opponentId: auth.currentUser.uid,
          opponentName: playerName
        });
        
        await setDoc(doc(db, "battles_br", battleId), {
          player1Id: availableMatch.data().playerId,
          player1Name: availableMatch.data().playerName,
          player2Id: auth.currentUser.uid,
          player2Name: playerName,
          status: "active",
          turn: availableMatch.data().playerId,
          player1Hp: 1000,
          player2Hp: 1000,
          timestamp: serverTimestamp()
        });
        
        setCurrentBattleId(battleId);
        setMatchmakingStatus('matched');
        setPage(25); // Battle Royale Page (using PvP page for now)
      } else {
        await setDoc(matchRef, {
          playerId: auth.currentUser.uid,
          playerName: playerName,
          level: currentLevel,
          timestamp: Date.now(),
          status: "waiting"
        });
        
        const unsub = onSnapshot(matchRef, (doc) => {
          if (doc.exists() && doc.data().status === 'matched') {
            setCurrentBattleId(doc.data().battleId);
            setMatchmakingStatus('matched');
            setPage(25);
            unsub();
            deleteDoc(matchRef);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, "matchmaking_br");
        });
      }
    } catch (error) {
      console.error("Matchmaking error:", error);
      setMatchmakingStatus('idle');
      setPage(24);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !playerName || !auth.currentUser) return;
    const text = chatInput.trim();
    setChatInput("");
    try {
      await addDoc(collection(db, "global_chat"), {
        sender: playerName,
        text: text,
        timestamp: serverTimestamp(),
        avatarUrl: avatarUrl,
        isCreator: isCreator,
        isAdmin: isAdmin
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "global_chat");
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !isAuthReady || !auth.currentUser) return;
    const q = query(collection(db, "news"), orderBy("date", "desc"), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNews(newsData as any);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "news");
    });
    return () => unsubscribe();
  }, [isLoggedIn, isAuthReady]);

  useEffect(() => {
    if (!isLoggedIn || !isAuthReady || !auth.currentUser) return;
    const q = query(collection(db, "forum_posts"), orderBy("timestamp", "desc"), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setForumPosts(posts as any);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "forum_posts");
    });
    return () => unsubscribe();
  }, [isLoggedIn, isAuthReady]);

  useEffect(() => {
    if (isLoggedIn && isAuthReady && auth.currentUser && playerName) {
      const targetId = auth.currentUser?.uid || playerName;
      const unsubscribe = onSnapshot(doc(db, "users", targetId), (doc) => {
        if (doc.exists()) {
          setFriends(doc.data().friends || []);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, "users");
      });
      return () => unsubscribe();
    }
  }, [isLoggedIn, isAuthReady, playerName]);

  // Centralized Debounced Save Effect
  useEffect(() => {
    if (!isLoggedIn || !isAuthReady || !auth.currentUser || isSyncingFromServer.current) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      const user = auth.currentUser;
      const docId = user ? user.uid : playerName;
      if (!docId) return;

      const dataToSave = {
        playerName,
        race: playerRace,
        email: playerEmail,
        realName,
        birthYear,
        country,
        characterStatus,
        gender: playerGender,
        avatarUrl,
        playerAge,
        playerBirthday,
        isNameHidden,
        isAgeHidden,
        isBirthdayHidden,
        isCountryHidden,
        silver,
        iron,
        gold,
        diamonds,
        xp,
        inventory,
        booksInventory,
        elixirsInventory,
        chestsInventory,
        equippedItems,
        messages,
        hasGiftKey,
        prevLevel,
        friends,
        clanId,
        clanName,
        clanRole,
        clanJoinedDate,
        clanMembers,
        forestProgress,
        mountainProgress,
        blackWolfKills,
        spentStrength,
        spentAgility,
        spentIntuition,
        spentEndurance,
        spentWisdom,
        playerBadges,
        playerStatus,
        lastSaved: new Date().toISOString()
      };

      // Save to Firestore
      if (auth.currentUser) {
        await savePlayerData(auth.currentUser.uid, {
          playerName,
          playerRace,
          playerEmail,
          realName,
          birthYear,
          country,
          characterStatus,
          playerGender,
          avatarUrl,
          playerAge,
          playerBirthday,
          isNameHidden,
          isAgeHidden,
          isBirthdayHidden,
          isCountryHidden,
          silver,
          iron,
          gold,
          diamonds,
          xp,
          inventory,
          booksInventory,
          elixirsInventory,
          chestsInventory,
          equippedItems,
          messages,
          hasGiftKey,
          prevLevel,
          friends,
          clanId,
          clanName,
          clanRole,
          clanMembers,
          clanJoinedDate,
          forestProgress,
          mountainProgress,
          blackWolfKills,
          spentStrength,
          spentAgility,
          spentIntuition,
          spentEndurance,
          spentWisdom,
          playerBadges,
          playerStatus
        });
      }

      // Save to Firestore
      try {
        await setDoc(doc(db, "users", docId), dataToSave, { merge: true });
      } catch (error) {
        console.error("Error saving to Firestore:", error);
      }
    }, 2000); // 2 second debounce for Firestore sync

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [
    playerName, playerRace, playerEmail, realName, birthYear, country, characterStatus, 
    playerGender, avatarUrl, playerAge, playerBirthday, isNameHidden, isAgeHidden, 
    isBirthdayHidden, isCountryHidden, silver, iron, gold, diamonds, xp, inventory, 
    booksInventory, elixirsInventory, chestsInventory, equippedItems, messages, 
    hasGiftKey, prevLevel, friends, clanId, clanName, clanRole, clanJoinedDate, 
    clanMembers, forestProgress, mountainProgress, blackWolfKills, spentStrength, spentAgility, 
    spentIntuition, spentEndurance, spentWisdom, playerBadges, playerStatus, 
    isLoggedIn, isAuthReady
  ]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (combatCooldown > 0) {
      timer = setInterval(() => {
        setCombatCooldown(prev => Math.max(0, prev - 1));
      }, 500);
    }
    return () => clearInterval(timer);
  }, [combatCooldown]);

  const processTurn = (pDmg: number, eDmg: number, pLog: string, eLog: string) => {
    setCombatCooldown(1);
    const isBoss = currentEnemy.name === "Вожак волчьей стаи";
    const bossRageMultiplier = (isBoss && wolfHealth < currentEnemy.maxHealth * 0.3) ? 1.25 : 1.0;
    const finalEnemyDmg = Math.floor(eDmg * bossRageMultiplier);

    // Trigger animations
    if (pDmg > 0) {
      setEnemyDamageAnim({ value: pDmg, type: pLog.includes('[КРИТ]') ? 'crit' : 'hit', id: Date.now() });
    } else if (pLog.includes('[УВОРОТ]')) {
      setEnemyDamageAnim({ value: 'УВОРОТ', type: 'dodge', id: Date.now() });
    }

    if (finalEnemyDmg > 0) {
      setPlayerDamageAnim({ value: finalEnemyDmg, type: eLog.includes('[КРИТ]') ? 'crit' : 'hit', id: Date.now() });
    } else if (eLog.includes('[УВОРОТ]')) {
      setPlayerDamageAnim({ value: 'УВОРОТ', type: 'dodge', id: Date.now() });
    } else if (eLog.includes('[БЛОК]')) {
      setPlayerDamageAnim({ value: 'БЛОК', type: 'block', id: Date.now() });
    }

    const newWolfHp = Math.max(0, wolfHealth - pDmg);
    setWolfHealth(newWolfHp);
    
    if (newWolfHp === 0) {
      setBattleLog(prev => [...prev, pLog, "Враг повержен!"].slice(-50));
    } else {
      const newPlayerHp = Math.max(0, playerHealth - finalEnemyDmg);
      setPlayerHealth(newPlayerHp);
      const bossRageLog = (bossRageMultiplier > 1 && !battleLog.some(l => l.includes("ЯРОСТЬ"))) ? "ВОЖАК ВПАДАЕТ В ЯРОСТЬ! Урон увеличен!" : "";
      
      const logsToAdd = [pLog];
      if (bossRageLog) logsToAdd.push(bossRageLog);
      if (finalEnemyDmg > 0 || eLog.includes("промахнулся") || eLog.includes("уклонился") || eLog.includes("Блок")) {
        logsToAdd.push(eLog.replace(`${eDmg}`, `${finalEnemyDmg}`));
      }
      
      setBattleLog(prev => [...prev, ...logsToAdd].slice(-50));
    }
  };

  const getRandomLog = (type: 'hit' | 'crit' | 'dodge' | 'block', attacker: string, defender: string, damage?: number) => {
    const hitPhrases = [
      "{attacker} наносит стремительный удар по {defender}!",
      "{attacker} не обдумывая врезал {defender}!",
      "{attacker} проводит серию ударов, задевая {defender}!",
      "{attacker} делает выпад, и {defender} не успевает среагировать!",
      "{attacker} обрушивает мощный удар на {defender}!",
      "{attacker} делает резкий выпад в сторону {defender}!",
      "{attacker} находит брешь в защите {defender} и атакует!",
      "{attacker} проводит сокрушительную атаку по {defender}!"
    ];

    const critPhrases = [
      "[КРИТ] {attacker} находит слабое место {defender} и наносит сокрушительный урон!",
      "[КРИТ] НЕВЕРОЯТНО! {attacker} проводит идеальный прием против {defender}!",
      "[КРИТ] {attacker} вкладывает всю ярость в этот удар по {defender}!",
      "[КРИТ] Точно в цель! {attacker} пробивает защиту {defender}!",
      "[КРИТ] {attacker} совершает смертоносный выпад, {defender} в шоке!",
      "[КРИТ] {attacker} наносит удар невероятной силы по {defender}!",
      "[КРИТ] {attacker} проводит мастерскую атаку, {defender} едва держится!"
    ];

    const dodgePhrases = [
      "[УВОРОТ] {defender} ловко уходит от атаки {attacker}!",
      "[УВОРОТ] {attacker} промахивается! {defender} слишком быстр!",
      "[УВОРОТ] {defender} предвидит движение {attacker} и уклоняется!",
      "[УВОРОТ] Мимо! {attacker} бьет в пустоту, пока {defender} отскакивает в сторону!",
      "[УВОРОТ] {defender} делает изящный пируэт, избегая удара {attacker}!",
      "[УВОРОТ] {defender} демонстрирует чудеса реакции, уходя от {attacker}!"
    ];

    const blockPhrases = [
      "[БЛОК] {defender} принимает удар {attacker} на щит!",
      "[БЛОК] {attacker} бьет по защите {defender}, урон поглощен!",
      "[БЛОК] {defender} блокирует выпад {attacker}, минимизируя повреждения!",
      "[БЛОК] Удар {attacker} приходится в блок {defender}!",
      "[БЛОК] {defender} стойко выдерживает натиск {attacker}!",
      "[БЛОК] {defender} вовремя выставляет защиту против {attacker}!"
    ];

    let phrase = "";
    if (type === 'hit') phrase = hitPhrases[Math.floor(Math.random() * hitPhrases.length)];
    else if (type === 'crit') phrase = critPhrases[Math.floor(Math.random() * critPhrases.length)];
    else if (type === 'dodge') phrase = dodgePhrases[Math.floor(Math.random() * dodgePhrases.length)];
    else if (type === 'block') phrase = blockPhrases[Math.floor(Math.random() * blockPhrases.length)];

    let result = phrase
      .replace("{attacker}", `[N:${attacker}]`)
      .replace("{defender}", `[N:${defender}]`);

    if (damage !== undefined && damage > 0) {
      result += ` [${damage} урона]`;
    } else if (damage === 0 && type !== 'dodge') {
      result += ` [Урон поглощен]`;
    }
    return result;
  };

  const renderLogText = (text: string) => {
    const parts = text.split(/(\[N:[^\]]+\]|\[КРИТ\]|\[УВОРОТ\]|\[БЛОК\])/);
    return parts.map((part, i) => {
      if (part.startsWith('[N:')) {
        const name = part.slice(3, -1);
        const isPlayer = name === playerName;
        return <span key={i} className={isPlayer ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{name}</span>;
      }
      if (part === '[КРИТ]') return <span key={i} className="text-lime-300 font-black animate-pulse">[КРИТ] </span>;
      if (part === '[УВОРОТ]') return <span key={i} className="text-blue-400 font-bold">[УВОРОТ] </span>;
      if (part === '[БЛОК]') return <span key={i} className="text-zinc-400 font-bold">[БЛОК] </span>;
      return <span key={i}>{part}</span>;
    });
  };

  const handleVictory = () => {
    let gainedXp = 0;
    let isPackLeader = forestProgress === 3;
    
    if (isPackLeader) {
       const targetLevel = Math.floor(Math.random() * 2) + 5; // 5, 6
       const targetXp = XP_TABLE[targetLevel];
       gainedXp = Math.max(0, targetXp - xp);
       
       const newTitle = { 
         name: "🐺 Убийца волчьей стаи", 
         description: "— ты очистил окрестные леса от хищников." 
       };
       
       setTitle(newTitle);
       setOwnedTitles(prev => {
         if (!prev.find(t => t.name === newTitle.name)) {
           setMessages(m => [
             {
               id: Date.now(),
               text: `Вы получили новый титул: ${newTitle.name}! Теперь ваши награды в лесу увеличены.`,
               read: false,
               date: new Date().toLocaleTimeString()
             },
             ...m
           ]);
           return [...prev, newTitle];
         }
         return prev;
       });
    } else {
       const minXp = currentEnemy.xpMin !== undefined ? currentEnemy.xpMin : (currentEnemy.xp || 50);
       const maxXp = currentEnemy.xpMax !== undefined ? currentEnemy.xpMax : (currentEnemy.xp || 100);
       const baseGainedXp = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;
       // Random boost between 150% and 200% (multiplier 2.5x to 3.0x) as requested
       const randomBoost = Math.random() * (3.0 - 2.5) + 2.5;
       gainedXp = Math.floor(baseGainedXp * randomBoost * (1 + (totalWisdom - 10) * 0.05));
    }
    
    const hasSlayerTitle = title.name === "🐺 Убийца волчьей стаи";
    const resourceMultiplier = (isPackLeader || hasSlayerTitle) ? 1.4 : 1.0;
    gainedXp = Math.floor(gainedXp * resourceMultiplier);

    setLastXpGained(gainedXp);
    setXp(prev => prev + gainedXp);
    
    // Increased silver by 30% on top of previous balance
    let gainedSilver = Math.floor(Math.random() * 2601) + 1300;
    gainedSilver = Math.floor(gainedSilver * resourceMultiplier);
    setLastSilver(gainedSilver);
    setSilver(prev => prev + gainedSilver);
    
    let gainedIron = 0;
    // Increased iron drop chance by 30%
    const ironChance = (isPackLeader || hasSlayerTitle ? 0.65 : 0.26);
    if (Math.random() < ironChance) {
      gainedIron = 1;
      setIron(prev => prev + 1);
    }
    setLastIron(gainedIron);
    
    if (forestProgress === 2) {
      setBlackWolfKills(prev => prev + 1);
    }

    const generateItem = (name: string, level: number): Item => {
      const isNovice = level <= 10;
      // Improved stat generation for story balance: min stats are higher
      const minStat = Math.max(1, Math.floor(level * 0.5));
      const hasMagic = Math.random() > 0.5; // 50% chance for magical properties
      return {
        id: Math.random().toString(36).substr(2, 9),
        name,
        level,
        rarity: isNovice ? 'common' : 'uncommon',
        type: name.includes("меч") || name.includes("лук") || name.includes("топор") || name.includes("посох") ? "weapon" : 
              name.includes("щит") ? "offhand" : "armor",
        bonusPercent: Math.floor(Math.random() * 21) + 10, // 10-30% bonus
        stats: {
          strength: Math.floor(Math.random() * (level - minStat + 1)) + minStat,
          agility: Math.floor(Math.random() * (level - minStat + 1)) + minStat,
          intuition: Math.floor(Math.random() * (level - minStat + 1)) + minStat,
          endurance: Math.floor(Math.random() * (level - minStat + 1)) + minStat,
          wisdom: Math.floor(Math.random() * (level - minStat + 1)) + minStat,
        },
        ...(hasMagic ? {
          mana_cost: Math.floor(Math.random() * 20) + 5,
          spell_power: Math.floor(Math.random() * (level * 2)) + 1,
          cooldown_reduction: Math.floor(Math.random() * 10) + 1,
        } : {})
      };
    };

    let finalDrops: Item[] = [];
    // Only novice items drop now, 40% chance
    if (Math.random() < 0.40) {
      const noviceItems = [
        "Деревянный лук новичка",
        "Деревянный меч новичка",
        "Деревянный топор новичка",
        "Деревянный посох новичка",
        "Деревянный щит новичка",
        "Рубашка новичка"
      ];
      const randomName = noviceItems[Math.floor(Math.random() * noviceItems.length)];
      finalDrops.push(generateItem(randomName, Math.floor(Math.random() * 10) + 1));
    }

    // Drop books or elixirs
    if (Math.random() < 0.03) {
      const books = ["Книга силы новичка", "Книга ловкости новичка", "Книга мудрости новичка"];
      const book = books[Math.floor(Math.random() * books.length)];
      setBooksInventory(prev => [...prev].slice(0, 9).concat(book));
    }
    if (Math.random() < 0.08) {
      const elixirs = ["Малое зелье здоровья", "Малое зелье маны", "Эликсир силы"];
      const elixir = elixirs[Math.floor(Math.random() * elixirs.length)];
      setElixirsInventory(prev => [...prev].slice(0, 9).concat(elixir));
    }

    setLastDrops(finalDrops.map(d => d.name));
    setInventory(prev => {
      const newInv = [...prev];
      finalDrops.forEach(d => {
        if (newInv.length < 10) newInv.push(d);
      });
      return newInv;
    });
    
    setPage(5);
  };

  return (
    <div 
      ref={scrollContainerRef}
      className="min-h-[100dvh] overflow-x-hidden relative bg-transparent"
    >
      <Toaster theme="dark" position="top-center" />
      
      {authError === 'auth/admin-restricted-operation' && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white px-4 py-3 text-center text-sm font-medium flex items-center justify-center gap-3 shadow-lg animate-in slide-in-from-top duration-500">
          <Lock className="w-4 h-4" />
          <span>Требуется настройка Firebase: Включите "Anonymous Authentication" в консоли.</span>
          <a 
            href="https://console.firebase.google.com/project/gen-lang-client-0421334866/authentication/providers" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white text-red-600 px-3 py-1 rounded-md hover:bg-zinc-100 transition-colors flex items-center gap-1"
          >
            Настроить <ExternalLink className="w-3 h-3" />
          </a>
          <button onClick={() => setAuthError(null)} className="ml-4 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {page === 1 && (
          <motion.div
            key="page1"
            className="flex flex-col items-center justify-center min-h-[100dvh] gap-2"
            initial={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "-100vh" }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease: "easeOut" }}
              className="mb-[-1rem] opacity-20"
            >
              <Crown className="w-32 h-32 text-zinc-300" fill="currentColor" strokeWidth={1} />
            </motion.div>
            <motion.h1
              className="text-zinc-50 text-5xl md:text-7xl font-serif tracking-widest text-center uppercase"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            >
              Nation of Light and Darkness
            </motion.h1>
            <motion.p
              className="text-zinc-400 text-center max-w-sm text-base mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
            >
              Welcome, traveler. Your journey in the Nation of Light and Darkness begins here.
            </motion.p>
            {!isLoggedIn ? (
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={async () => {
                    try {
                      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
                      const googleProvider = new GoogleAuthProvider();
                      const result = await signInWithPopup(auth, googleProvider);
                      const user = result.user;
                      
                      let userDoc;
                      try {
                        userDoc = await getDoc(doc(db, "users", user.uid));
                      } catch (error: any) {
                        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
                        return;
                      }
                      
                      if (userDoc.exists()) {
                        const data = userDoc.data();
                        setPlayerName(data.username || data.playerName);
                        setPlayerEmail(data.email || data.playerEmail);
                        if (data.race) setPlayerRace(data.race);
                        if (data.gender) setPlayerGender(data.gender);
                        if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
                        setIsLoggedIn(true);
                        setHasCompletedOnboarding(true);
                        setPage(2);
                        toast.success("С возвращением через Google!");
                      } else {
                        // New user
                        setPlayerEmail(user.email || "");
                        setShowOnboarding(true);
                        setPage(14); // Go to character creation
                        toast.success("Добро пожаловать! Завершите создание персонажа.");
                      }
                    } catch (error: any) {
                      toast.error("Ошибка авторизации Google: " + error.message);
                    }
                  }}
                  className="w-full py-4 rounded-2xl bg-white text-zinc-950 font-bold uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  <div className="w-6 h-6 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  Войти через Google
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setPage(2);
                }}
                className="btn-primary"
              >
                В игру
              </button>
            )}
          </motion.div>
        )}

        {page === 4 && (
          <motion.div
            key="page4"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center mb-8 relative mt-4">
              <button 
                onClick={() => setPage(2)} 
                className="absolute left-0 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5 z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-2xl md:text-3xl font-serif tracking-widest w-full text-center text-zinc-50 uppercase">Сражение</h2>
            </div>

            {/* Battle Arena */}
            <div className="flex-1 flex flex-row items-center justify-between gap-2 px-2">
              {/* Player */}
              <div className="flex flex-col items-center gap-2 w-5/12 relative">
                <motion.div 
                  animate={playerDamageAnim ? { x: [-2, 2, -2, 2, 0] } : {}}
                  transition={{ duration: 0.2 }}
                  className={`w-24 h-24 rounded-full bg-zinc-900/80/50 border ${playerGender === 'male' ? 'border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'border-pink-500/30 shadow-[0_0_30px_rgba(236,72,153,0.1)]'} flex items-center justify-center relative overflow-hidden`}
                >
                  {/* Nickname above Avatar */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-full text-center z-20">
                    <span className="text-[8px] uppercase tracking-[0.2em] text-lime-400/60 font-black drop-shadow-sm">
                      {playerName}
                    </span>
                  </div>

                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className={`absolute inset-0 bg-gradient-to-t ${playerGender === 'male' ? 'from-blue-500/20' : 'from-pink-500/20'} to-transparent blur-xl opacity-50`} />
                    <User className={`w-12 h-12 ${playerGender === 'male' ? 'text-blue-400' : 'text-pink-400'} relative z-10 filter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]`} />
                    <div className="absolute inset-0 border-2 border-white/5 rounded-full animate-pulse" />
                  </div>

                  {/* Clan Name below Avatar */}
                  {clanId && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-full text-center z-20">
                      <span className="text-[7px] uppercase tracking-widest text-purple-400 font-bold drop-shadow-sm">
                        &lt;{clanId}&gt;
                      </span>
                    </div>
                  )}
                  
                  <AnimatePresence>
                    {playerDamageAnim && (
                      <motion.div
                        key={playerDamageAnim.id}
                        initial={{ opacity: 0, y: 0, scale: 0.5 }}
                        animate={{ opacity: 1, y: -60, scale: 1.2 }}
                        exit={{ opacity: 0 }}
                        onAnimationComplete={() => setPlayerDamageAnim(null)}
                        className={`absolute font-black text-lg pointer-events-none drop-shadow-md ${
                          playerDamageAnim.type === 'crit' ? 'text-lime-300 text-xl' : 
                          playerDamageAnim.type === 'dodge' ? 'text-blue-400' : 
                          playerDamageAnim.type === 'block' ? 'text-zinc-400' : 'text-red-500'
                        }`}
                      >
                        {playerDamageAnim.value}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Player Health Bar */}
                <div className="w-full max-w-[120px] bg-black/50 rounded-full h-3 border border-white/5 overflow-hidden relative">
                  <div className={`absolute top-0 left-0 h-full ${getHealthColor(playerHealth, maxPlayerHealth)} transition-all duration-500`} style={{ width: `${(playerHealth / maxPlayerHealth) * 100}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">{playerHealth} / {maxPlayerHealth}</div>
                </div>
              </div>

              <div className="text-center text-zinc-500 font-serif italic text-sm shrink-0 w-2/12">
                vs
              </div>

              {/* Enemy (Wolf) */}
              <div className="flex flex-col items-center gap-2 w-5/12 relative">
                <motion.div 
                  animate={enemyDamageAnim ? { x: [-2, 2, -2, 2, 0], scale: enemyDamageAnim.type === 'crit' ? [1, 1.1, 1] : 1 } : {}}
                  transition={{ duration: 0.2 }}
                  className="w-28 h-28 rounded-full bg-red-900/20 border border-red-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.1)] relative"
                >
                  <div className="absolute -bottom-3 bg-red-950 border border-red-800 px-3 py-1 rounded-full text-[10px] text-red-400 font-bold uppercase tracking-widest text-center leading-tight">
                    {currentEnemy.name}
                  </div>
                  <PawPrint className="w-12 h-12 text-red-400" />

                  <AnimatePresence>
                    {enemyDamageAnim && (
                      <motion.div
                        key={enemyDamageAnim.id}
                        initial={{ opacity: 0, y: 0, scale: 0.5 }}
                        animate={{ opacity: 1, y: -70, scale: 1.2 }}
                        exit={{ opacity: 0 }}
                        onAnimationComplete={() => setEnemyDamageAnim(null)}
                        className={`absolute font-black text-lg pointer-events-none drop-shadow-md ${
                          enemyDamageAnim.type === 'crit' ? 'text-lime-300 text-xl' : 
                          enemyDamageAnim.type === 'dodge' ? 'text-blue-400' : 'text-green-400'
                        }`}
                      >
                        {enemyDamageAnim.value}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                
                {/* Enemy Health Bar */}
                <div className="w-full max-w-[120px] bg-black/50 rounded-full h-3 border border-white/5 overflow-hidden relative">
                  <div className={`absolute top-0 left-0 h-full ${getHealthColor(wolfHealth, currentEnemy.maxHealth)} transition-all duration-500`} style={{ width: `${(wolfHealth / currentEnemy.maxHealth) * 100}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">{wolfHealth} / {currentEnemy.maxHealth}</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {wolfHealth > 0 && playerHealth > 0 ? (
              <div className="mt-6 mb-4 flex flex-col gap-3 w-full">
                {wolfHealth <= currentEnemy.maxHealth * 0.2 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="mb-2"
                  >
                    <motion.div
                      animate={{ 
                        scale: [1, 1.05, 1],
                        textShadow: ["0px 0px 0px rgba(251,191,36,0)", "0px 0px 15px rgba(251,191,36,0.8)", "0px 0px 0px rgba(251,191,36,0)"]
                      }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 1.5, 
                        ease: "easeInOut" 
                      }}
                      className="text-center text-lime-300 font-bold text-sm uppercase tracking-widest"
                    >
                      Враг почти повержен! Добейте его!
                    </motion.div>
                  </motion.div>
                )}
                <div className="grid grid-cols-1 gap-3 w-full">
                  <motion.button 
                    onClick={() => {
                      if (combatCooldown > 0) return;
                      // Player Attack
                      const baseDmg = Math.floor(Math.random() * 20) + 20 + currentLevel * 5;
                      const dmgMultiplier = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
                      let pDmg = Math.floor(baseDmg * (1 + (totalStrength - 10) * 0.15) * dmgMultiplier);
                      
                      const critChance = Math.min(0.75, 0.065 * (1 + (totalIntuition - 10) * 0.15));
                      const isCrit = Math.random() < critChance;
                      if (isCrit) pDmg = Math.floor(pDmg * 1.5);
                      
                      const pLog = getRandomLog(isCrit ? 'crit' : 'hit', playerName, currentEnemy.name, pDmg);

                      // Enemy Attack
                      const isBoss = currentEnemy.name === "Вожак волчьей стаи";
                      const eBaseDmg = Math.floor(Math.random() * 15) + 15 + (isBoss ? forestProgress * 15 : forestProgress * 25);
                      const eDmgMultiplier = 0.9 + Math.random() * 0.2;
                      let eDmg = Math.floor(eBaseDmg * eDmgMultiplier);
                      
                      // Enemy can also crit or miss
                      const eCritChance = 0.05 + forestProgress * 0.02;
                      const eIsCrit = Math.random() < eCritChance;
                      if (eIsCrit) eDmg = Math.floor(eDmg * 1.3);

                      const eDodgeChance = Math.min(0.95, 0.65 * (1 + (totalAgility - 10) * 0.15)) * 0.1; // Passive dodge chance
                      const playerDodged = Math.random() < eDodgeChance;
                      
                      let eLog = "";
                      if (playerDodged) {
                        eDmg = 0;
                        eLog = getRandomLog('dodge', currentEnemy.name, playerName);
                      } else {
                        eLog = getRandomLog(eIsCrit ? 'crit' : 'hit', currentEnemy.name, playerName, eDmg);
                      }

                      processTurn(pDmg, eDmg, pLog, eLog);
                    }}
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.95 }} 
                    disabled={(forestProgress === 0 && (battleLog.length === 0 || battleLog.length >= 6)) ? false : combatCooldown > 0}
                    className={`w-full py-2 rounded-2xl  border transition-all duration-300 flex items-center justify-center gap-3 font-bold uppercase tracking-wider ${
                      combatCooldown > 0 
                        ? "bg-zinc-900/80/50 border-white/5 text-zinc-600 cursor-not-allowed"
                        : forestProgress === 0 && (battleLog.length === 0 || battleLog.length >= 6)
                          ? "bg-red-500/30 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] text-white animate-pulse" 
                          : "bg-red-500/10 border-red-500/30 text-red-100 hover:bg-red-500/20"
                    }`}
                  >
                    <Swords className="w-5 h-5" /> {combatCooldown > 0 ? `Перезарядка (${combatCooldown}с)` : "Ударить"}
                  </motion.button>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button 
                      onClick={() => {
                        if (combatCooldown > 0) return;
                        const dodgeChance = Math.min(0.95, 0.65 * (1 + (totalAgility - 10) * 0.15));
                        const success = Math.random() < dodgeChance;
                        
                        if (success) {
                          const baseDmg = Math.floor(Math.random() * 15) + 30 + currentLevel * 5;
                          const dmgMultiplier = 0.8 + Math.random() * 0.4;
                          let pDmg = Math.floor(baseDmg * (1 + (totalAgility - 10) * 0.15) * dmgMultiplier);
                          
                          const critChance = Math.min(0.75, 0.065 * (1 + (totalIntuition - 10) * 0.15));
                          const isCrit = Math.random() < critChance;
                          if (isCrit) pDmg = Math.floor(pDmg * 1.5);
                          
                          const pLog = getRandomLog(isCrit ? 'crit' : 'hit', playerName, currentEnemy.name, pDmg);
                          const eLog = getRandomLog('dodge', currentEnemy.name, playerName);
                          
                          processTurn(pDmg, 0, pLog, eLog);
                        } else {
                          const isBoss = currentEnemy.name === "Вожак волчьей стаи";
                          const eBaseDmg = Math.floor(Math.random() * 15) + 20 + (isBoss ? forestProgress * 15 : forestProgress * 25);
                          const eDmg = Math.floor(eBaseDmg * (0.9 + Math.random() * 0.2));
                          
                          const pLog = `Вы не смогли увернуться!`;
                          const eLog = getRandomLog('hit', currentEnemy.name, playerName, eDmg);
                          
                          processTurn(0, eDmg, pLog, eLog);
                        }
                      }}
                      whileHover={combatCooldown > 0 ? {} : { scale: 1.02 }} 
                      whileTap={combatCooldown > 0 ? {} : { scale: 0.95 }} 
                      disabled={combatCooldown > 0}
                      className={`w-full py-2 rounded-2xl  border transition-all duration-300 flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-sm ${
                        combatCooldown > 0
                          ? "bg-zinc-900/80/50 border-white/5 text-zinc-600 cursor-not-allowed"
                          : forestProgress === 0 && battleLog.length === 2
                            ? "bg-blue-500/30 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)] text-white animate-pulse" 
                            : "bg-blue-500/10 border-blue-500/30 text-blue-100 hover:bg-blue-500/20"
                      }`}
                    >
                      <Wind className="w-4 h-4" /> {combatCooldown > 0 ? `${combatCooldown}с` : "Уворот"}
                    </motion.button>
                    <motion.button 
                      onClick={() => {
                        if (combatCooldown > 0) return;
                        const baseDmg = Math.floor(Math.random() * 10) + 10 + currentLevel * 3;
                        const dmgMultiplier = 0.8 + Math.random() * 0.4;
                        let pDmg = Math.floor(baseDmg * (1 + (totalStrength - 10) * 0.15) * dmgMultiplier);
                        
                        const critChance = Math.min(0.75, 0.065 * (1 + (totalIntuition - 10) * 0.15));
                        const isCrit = Math.random() < critChance;
                        if (isCrit) pDmg = Math.floor(pDmg * 1.5);

                        const blockValue = Math.floor(10 * (1 + (totalEndurance - 10) * 0.15));
                        const isBoss = currentEnemy.name === "Вожак волчьей стаи";
                        const eBaseDmg = Math.floor(Math.random() * 10) + 5 + (isBoss ? forestProgress * 10 : forestProgress * 15);
                        const eDmg = Math.max(0, Math.floor(eBaseDmg * (0.9 + Math.random() * 0.2)) - blockValue);
                        
                        const pLog = getRandomLog(isCrit ? 'crit' : 'hit', playerName, currentEnemy.name, pDmg);
                        const eLog = getRandomLog('block', currentEnemy.name, playerName, eDmg);
                        
                        processTurn(pDmg, eDmg, pLog, eLog);
                      }}
                      whileHover={combatCooldown > 0 ? {} : { scale: 1.02 }} 
                      whileTap={combatCooldown > 0 ? {} : { scale: 0.95 }} 
                      disabled={combatCooldown > 0}
                      className={`w-full py-2 rounded-2xl  border transition-all duration-300 flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-sm ${
                        combatCooldown > 0
                          ? "bg-zinc-900/80/50 border-white/5 text-zinc-600 cursor-not-allowed"
                          : forestProgress === 0 && battleLog.length === 4
                            ? "bg-zinc-400/30 border-zinc-300 shadow-[0_0_20px_rgba(168,162,158,0.5)] text-white animate-pulse" 
                            : "bg-zinc-500/10 border-zinc-500/30 text-zinc-200 hover:bg-zinc-500/20"
                      }`}
                    >
                      <Shield className="w-4 h-4" /> {combatCooldown > 0 ? `${combatCooldown}с` : "Блок"}
                    </motion.button>
                  </div>
                  
                  {/* Surrender Button */}
                  <div className="mt-2">
                    {!isSurrendering ? (
                      <motion.button
                        onClick={() => setIsSurrendering(true)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full py-2 rounded-2xl glass-card border border-zinc-700/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-all text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                      >
                        <Flag className="w-3 h-3" /> Сдаться
                      </motion.button>
                    ) : (
                      <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="text-[9px] text-red-400 text-center font-bold uppercase tracking-tighter">Вы уверены? Награды не будут начислены!</div>
                        <div className="grid grid-cols-2 gap-2">
                          <motion.button
                            onClick={() => {
                              setBattleLog(prev => [...prev, `[N:${playerName}] позорно сдается и бежит с поля боя!`]);
                              setTimeout(() => {
                                setPage(2);
                                setIsSurrendering(false);
                              }, 1500);
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.95 }}
                            className="py-2 rounded-lg bg-red-900/30 border border-red-500/50 text-red-400 text-[10px] font-black uppercase"
                          >
                            Да, сдаться
                          </motion.button>
                          <motion.button
                            onClick={() => setIsSurrendering(false)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.95 }}
                            className="py-2 rounded-lg bg-zinc-900/80 border border-zinc-600 text-zinc-300 text-[10px] font-black uppercase"
                          >
                            Нет
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : wolfHealth <= 0 ? (
              <div className="mt-6 mb-4 flex flex-col items-center gap-2 w-full">
                <h3 className="text-xl font-bold text-yellow-400 uppercase tracking-widest drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">Победа!</h3>
                <motion.button 
                  onClick={handleVictory}
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }} 
                  className="w-full py-2 rounded-2xl  bg-yellow-500/20 border border-yellow-500/50 hover:bg-yellow-500/30 text-yellow-100 transition-colors flex items-center justify-center gap-3 font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(250,204,21,0.2)]"
                >
                  <Trophy className="w-5 h-5" /> Забрать награду
                </motion.button>
              </div>
            ) : (
              <div className="mt-6 mb-4 flex flex-col items-center gap-2 w-full">
                <h3 className="text-xl font-bold text-red-500 uppercase tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">Поражение</h3>
                <motion.button 
                  onClick={() => setPage(2)}
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }} 
                  className="w-full py-2 rounded-2xl  bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 text-red-100 transition-colors flex items-center justify-center gap-3 font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                >
                  <ArrowLeft className="w-5 h-5" /> Отступить
                </motion.button>
              </div>
            )}

            {/* Battle Log */}
            <div className="mt-auto mb-8 w-full h-28 bg-black/40 border border-white/5 rounded-2xl p-3 overflow-y-auto font-mono text-[10px] flex flex-col gap-1.5 shadow-inner">
              {battleLog.length === 0 && <span className="text-zinc-500 italic text-center mt-8">Бой начинается...</span>}
              {battleLog.map((log, i) => (
                <div key={i} className="text-zinc-300 leading-tight">
                  &gt; {renderLogText(log)}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {page === 5 && (
          <motion.div
            key="page5"
            className="min-h-[100dvh] flex flex-col items-center justify-center p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto gap-2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-serif text-lime-300">Победа над врагом!</h2>
              
              <div className="bg-white/5 border border-white/5 rounded-2xl p-5 my-6 flex flex-col gap-3 text-left w-full shadow-inner">
                <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 text-center">Получена награда</h4>
                {lastDrops.map((drop, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-zinc-200 bg-black/20 p-2 rounded-lg border border-white/5">
                    <ShoppingBag className="w-5 h-5 text-zinc-400"/> 
                    <span className="text-sm">{drop}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 text-zinc-200 bg-black/20 p-2 rounded-lg border border-white/5">
                  <div className="w-5 h-5 rounded-full bg-zinc-300 border-2 border-zinc-400 shadow-[0_0_10px_rgba(214,211,209,0.5)] flex items-center justify-center"><Circle className="w-3 h-3 text-zinc-600" /></div> 
                  <span className="text-sm">{lastSilver} Серебра</span>
                </div>
                {lastIron > 0 && (
                  <div className="flex items-center gap-3 text-zinc-200 bg-black/20 p-2 rounded-lg border border-white/5">
                    <Hexagon className="w-5 h-5 text-zinc-400"/> 
                    <span className="text-sm">{lastIron} Железо</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-zinc-200 bg-black/20 p-2 rounded-lg border border-white/5">
                  <Star className="w-5 h-5 text-lime-300"/> 
                  <span className="text-sm">{lastXpGained} Опыта</span>
                </div>
              </div>

              {forestProgress === 3 && (
                <div className="bg-lime-400/10 border border-lime-400/30 rounded-2xl p-4 mb-6 text-lime-200 text-sm text-center animate-pulse">
                  Вы одолели Золотую Вожачку и получили титул <span className="font-bold text-lime-300">«Вожак Стаи»</span>, а также невероятное количество опыта!
                </div>
              )}

              {forestProgress === 2 && blackWolfKills < 3 && (
                <div className="bg-zinc-500/10 border border-zinc-500/30 rounded-2xl p-4 mb-6 text-zinc-300 text-sm text-center">
                  Чтобы выследить Вожака Стаи, вам нужно одолеть еще <span className="font-bold text-white">{3 - blackWolfKills}</span> Черных волков.
                </div>
              )}
            </div>
            
            <motion.button 
              onClick={() => {
                // Handle Forest Progress
                if (FOREST_ENEMIES.some(e => e.name === currentEnemy.name)) {
                  if (forestProgress < 4) {
                    if (forestProgress === 2) {
                      if (blackWolfKills >= 3) {
                        setForestProgress(prev => prev + 1);
                      }
                    } else {
                      setForestProgress(prev => prev + 1);
                    }
                  }
                  setPage(2);
                } 
                // Handle Mountain Progress
                else if (MOUNTAIN_ENEMIES.some(e => e.name === currentEnemy.name)) {
                  const enemyIndex = MOUNTAIN_ENEMIES.findIndex(e => e.name === currentEnemy.name);
                  if (mountainProgress === enemyIndex) {
                    setMountainProgress(prev => prev + 1);
                  }
                  setPage(26);
                }
                else {
                  setPage(2);
                }
              }}
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }} 
              className="w-full py-2 rounded-2xl  transition-colors font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(163,230,53,0.2)] bg-lime-400/20 border border-lime-400/50 hover:bg-lime-400/30 text-lime-100"
            >
              Продолжить путь
            </motion.button>
          </motion.div>
        )}


        {page === 14 && (
          <motion.div
            key="page14"
            className="min-h-[100dvh] flex flex-col items-center justify-center p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto gap-2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="text-center mb-6">
              <Crown className="w-16 h-16 text-lime-400 mx-auto mb-4 opacity-50" />
              <h2 className="text-2xl font-serif tracking-widest uppercase text-white">Создание персонажа</h2>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Выберите свой путь в этом мире</p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-3xl p-6 w-full space-y-6 backdrop-blur-xl">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Имя персонажа (Никнейм)</label>
                <input 
                  type="text" 
                  value={regUsername}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[a-zA-Z]*$/.test(val) && val.length <= 12) {
                      setRegUsername(val);
                    }
                  }}
                  placeholder="Введите ник (4-12 англ. букв)..." 
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-lime-400/50 transition-colors" 
                />
                <p className="text-[9px] text-zinc-500 italic ml-1">Только английские буквы, от 4 до 12 символов</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Выберите Расу</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Человек", "Эльф", "Орк", "Гном", "Нежить"].map((race) => (
                      <button
                        key={race}
                        onClick={() => setRegRace(race)}
                        className={`py-2 px-1 rounded-xl border text-[10px] font-bold uppercase tracking-tighter transition-all ${regRace === race ? 'bg-lime-400/20 border-lime-400 text-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.2)]' : 'bg-black/40 border-white/5 text-zinc-500 hover:border-white/20'}`}
                      >
                        {race}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Выберите Пол</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setRegGender("male")}
                      className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${regGender === 'male' ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-black/40 border-white/5 text-zinc-500 hover:border-white/20'}`}
                    >
                      <User className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">Мужской</span>
                    </button>
                    <button 
                      onClick={() => setRegGender("female")}
                      className={`flex items-center justify-center gap-3 p-4 rounded-2xl border transition-all duration-300 ${regGender === 'female' ? 'bg-pink-500/20 border-pink-500 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.2)]' : 'bg-black/40 border-white/5 text-zinc-500 hover:border-white/20'}`}
                    >
                      <User className="w-5 h-5" />
                      <span className="text-xs font-bold uppercase tracking-widest">Женский</span>
                    </button>
                  </div>
                </div>
              </div>

              <button 
                onClick={async () => {
                  if (regUsername.length < 4 || regUsername.length > 12 || !/^[a-zA-Z]+$/.test(regUsername)) {
                    toast.error("Никнейм должен содержать от 4 до 12 английских букв.");
                    return;
                  }
                  
                  if (TAKEN_USERNAMES.includes(regUsername)) {
                    toast.error("Это имя зарезервировано системой.");
                    return;
                  }

                  try {
                    const usernameDoc = await getDoc(doc(db, "usernames", regUsername));
                    if (usernameDoc.exists()) {
                      toast.error("Этот никнейм уже занят другим игроком.");
                      return;
                    }

                    const user = auth.currentUser;
                    if (!user) {
                      toast.error("Ошибка авторизации. Попробуйте войти снова.");
                      setPage(1);
                      return;
                    }

                    const newAvatarUrl = regGender === 'male' 
                      ? "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f18c-776e-9828-56965684617a" 
                      : "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f1b2-7216-9828-56965684617a";

                    const welcomeMessage = {
                      id: "welcome_" + Date.now(),
                      text: "Добро пожаловать в Nation of Light and Darkness! В качестве приветственного подарка мы дарим вам 10,000 серебра и 500 алмазов. Удачи в приключениях!",
                      date: new Date().toLocaleDateString(),
                      read: false,
                      claimable: {
                        silver: 10000,
                        diamonds: 500
                      },
                      claimed: false
                    };

                    // Save to Firestore
                    const initialData = {
                      uid: user.uid,
                      username: regUsername,
                      playerName: regUsername,
                      race: regRace,
                      gender: regGender,
                      avatarUrl: newAvatarUrl,
                      email: user.email,
                      silver: 1000,
                      iron: 0,
                      gold: 0,
                      diamonds: 0,
                      xp: 100,
                      inventory: [],
                      equippedItems: {
                        "Шлем": null, "Наручи": null, "Меч": null, "Штаны": null, "Сапоги": null,
                        "Ожерелье": null, "Перчатки": null, "Второе оружие": null, "Рубашка": null, "Пояс": null
                      },
                      messages: [welcomeMessage],
                      hasCompletedOnboarding: true,
                      createdAt: serverTimestamp(),
                      roles: [],
                      stats: {
                        strength: 10, agility: 10, intuition: 10, endurance: 10, wisdom: 10
                      },
                      forestProgress: 0,
                      blackWolfKills: 0,
                      spentStrength: 0, spentAgility: 0, spentIntuition: 0, spentEndurance: 0, spentWisdom: 0,
                      playerBadges: [],
                      playerStatus: "Новичок"
                    };

                    await setDoc(doc(db, "users", user.uid), initialData);
                    await setDoc(doc(db, "usernames", regUsername), { uid: user.uid });

                    setPlayerName(regUsername);
                    setPlayerRace(regRace);
                    setPlayerGender(regGender);
                    setPlayerEmail(user.email || "");
                    setAvatarUrl(newAvatarUrl);
                    setMessages([welcomeMessage]);
                    setIsLoggedIn(true);
                    setHasCompletedOnboarding(true);
                    setPage(2);
                    toast.success("Персонаж успешно создан! Добро пожаловать в игру.");
                  } catch (error: any) {
                    toast.error("Ошибка при создании персонажа: " + error.message);
                  }
                }}
                className="w-full py-4 rounded-2xl bg-lime-400 text-zinc-950 font-black uppercase tracking-widest hover:bg-lime-300 transition-all shadow-[0_0_30px_rgba(163,230,53,0.3)]"
              >
                Начать приключение
              </button>
            </div>
          </motion.div>
        )}
        {page === 16 && (
          <motion.div
            key="page16"
            className="min-h-[100dvh] flex flex-col items-center p-3 text-zinc-100 w-full max-w-md mx-auto gap-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="w-full flex items-center justify-between mb-4">
              <button onClick={() => setPage(3)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-serif tracking-widest uppercase">Анкета героя</h2>
              <div className="w-10" />
            </div>

            <div className="bg-white/5  border border-white/5 rounded-2xl p-3 w-full overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-lime-400/5 blur-3xl rounded-full -mr-16 -mt-16" />
              
              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-lime-400/10 border border-lime-400/20 flex items-center justify-center">
                    <ScrollText className="w-5 h-5 text-lime-300" />
                  </div>
                  <div>
                    <h4 className="text-[10px] uppercase tracking-widest text-lime-300 font-black">Моя анкета</h4>
                    <p className="text-[8px] text-zinc-500 uppercase tracking-tighter">Личные данные героя</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setTempUsername(playerName);
                    setTempRealName(realName);
                    setTempRace(playerRace);
                    setTempGender(playerGender);
                    setTempAge(playerAge);
                    setTempBirthday(playerBirthday);
                    setTempCountry(country);
                    setTempStatus(characterStatus);
                    setTempAvatarUrl(avatarUrl);
                    setTempIsNameHidden(isNameHidden);
                    setTempIsAgeHidden(isAgeHidden);
                    setTempIsBirthdayHidden(isBirthdayHidden);
                    setTempIsCountryHidden(isCountryHidden);
                    setIsEditingProfile(true);
                  }}
                  className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-white/5"
                >
                  <Pencil className="w-4 h-4 text-lime-300" />
                </button>
              </div>
              
              <div className="space-y-6 relative z-10">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1.5 p-3 bg-black/20 rounded-2xl border border-white/5 relative">
                    <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-1">
                      <User className="w-2.5 h-2.5" /> {playerGender === 'male' ? 'Имя героя' : 'Имя героини'}
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-200 font-medium truncate">{isNameHidden ? "••••••••" : (realName || "Не указано")}</span>
                      <button onClick={() => setIsNameHidden(!isNameHidden)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                        {isNameHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 p-3 bg-black/20 rounded-2xl border border-white/5">
                    <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-1">
                      <Flag className="w-2.5 h-2.5" /> Страна
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-200 font-medium truncate">{isCountryHidden ? "••••••••" : country}</span>
                      <button onClick={() => setIsCountryHidden(!isCountryHidden)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                        {isCountryHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div className="flex flex-col gap-1.5 p-3 bg-black/20 rounded-2xl border border-white/5">
                    <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-1">
                      <Heart className="w-2.5 h-2.5" /> День рождения {!isAgeHidden && !isBirthdayHidden && playerAge > 0 && <span className="text-zinc-500 ml-1">({playerAge} {getAgeSuffix(playerAge)})</span>}
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-200 font-medium">{isBirthdayHidden ? "••.••.••••" : playerBirthday}</span>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setIsAgeHidden(!isAgeHidden)} 
                          className="text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
                          title={isAgeHidden ? "Показать возраст" : "Скрыть возраст"}
                        >
                          <span className="text-[8px] uppercase">{isAgeHidden ? "Возраст: Скрыт" : "Возраст: Виден"}</span>
                          {isAgeHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button onClick={() => setIsBirthdayHidden(!isBirthdayHidden)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                          {isBirthdayHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-1 ml-1">
                    <BookOpen className="w-2.5 h-2.5" /> Статус персонажа
                  </span>
                  <div className="p-4 bg-gradient-to-br from-black/40 to-black/20 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-lime-400/30" />
                    <p className="text-xs text-zinc-400 italic leading-relaxed">"{characterStatus}"</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {page === 2 && (
          <motion.div
            key="page2"
            className="min-h-[100dvh] flex flex-col items-center p-4 pb-24 text-zinc-100 relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            {/* Character Info Bar */}
            <div className="w-full max-w-md flex items-center justify-between mb-6 px-2 mt-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl glass-card border border-white/10 flex items-center justify-center overflow-hidden">
                    <img 
                      src={avatarUrl || (playerGender === 'male' 
                        ? "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f18c-776e-9828-56965684617a" 
                        : "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f1b2-7216-9828-56965684617a")
                      }
                      alt="Avatar" 
                      className={`w-full h-full object-cover brightness-0 invert ${playerGender === 'male' ? 'sepia-[1] saturate-[5] hue-rotate-[180deg]' : 'sepia-[1] saturate-[5] hue-rotate-[300deg]'}`}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-lime-400">{currentLevel}</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black tracking-tight text-white">{playerName}</span>
                    {isCreator && <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Онлайн</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPage(29)}
                  className="p-2.5 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 hover:text-white transition-colors relative"
                >
                  <Users className="w-5 h-5" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-zinc-950 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-white">{onlineUsers.size}</span>
                  </div>
                </button>
                <LocationPlayers location="Город" userLocations={userLocations} currentUserId={auth.currentUser?.uid} />
                <button onClick={() => setPage(11)} className="p-2.5 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 hover:text-white transition-colors">
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Global News Ticker */}
            {globalEvents.length > 0 && (
              <div className="w-full max-w-md mb-6 bg-lime-400/5 border border-lime-400/10 rounded-2xl py-2 px-4 overflow-hidden relative">
                <div className="flex items-center gap-3 animate-marquee whitespace-nowrap">
                  <span className="text-[10px] font-bold text-lime-400 uppercase tracking-widest flex-shrink-0">События:</span>
                  <p className="text-[10px] text-zinc-300">
                    {globalEvents[0].message}
                  </p>
                </div>
              </div>
            )}

            {/* Main Stats Ring (Sporty Vibe) */}
            <div className="w-full max-w-md flex justify-center mb-8">
              <div className="relative w-48 h-48 flex items-center justify-center">
                {/* Background Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  {/* Progress Ring */}
                  <circle 
                    cx="50" cy="50" r="45" fill="none" 
                    stroke="url(#limeGradient)" 
                    strokeWidth="8" 
                    strokeLinecap="round"
                    strokeDasharray="282.7"
                    strokeDashoffset={282.7 - (282.7 * (xpPercentage / 100))}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="limeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#A3E635" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>
                </svg>
                
                {/* Inner Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full glass-card border border-white/10 flex items-center justify-center mb-2 overflow-hidden">
                    <img 
                      src={avatarUrl || (playerGender === 'male' 
                        ? "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f18c-776e-9828-56965684617a" 
                        : "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f1b2-7216-9828-56965684617a")
                      }
                      alt="Avatar" 
                      className={`w-full h-full object-cover brightness-0 invert ${playerGender === 'male' ? 'sepia-[1] saturate-[5] hue-rotate-[180deg]' : 'sepia-[1] saturate-[5] hue-rotate-[300deg]'}`}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="text-3xl font-black tracking-tighter">{currentLevel}</span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Уровень</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="w-full max-w-md grid grid-cols-3 gap-3 mb-8">
              <div className="glass-card p-4 flex flex-col items-center justify-center text-center">
                <Heart className="w-5 h-5 text-rose-500 mb-2" />
                <span className="text-lg font-bold">{playerHealth}</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Здоровье</span>
              </div>
              <div className="glass-card p-4 flex flex-col items-center justify-center text-center">
                <Coins className="w-5 h-5 text-zinc-400 mb-2" />
                <span className="text-lg font-bold">{silver}</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Серебро</span>
              </div>
              <div className="glass-card p-4 flex flex-col items-center justify-center text-center">
                <Gem className="w-5 h-5 text-cyan-400 mb-2" />
                <span className="text-lg font-bold">{gold}</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Золото</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 w-full max-w-md">
              <div className="grid grid-cols-2 gap-3">
                <motion.button 
                  onClick={() => setPage(18)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} 
                  className="w-full py-3 rounded-2xl glass-card hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-zinc-300 font-bold"
                >
                  <Users className="w-5 h-5 text-blue-400" /> Друзья
                </motion.button>
                <motion.button 
                  onClick={() => setPage(19)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} 
                  className="w-full py-3 rounded-2xl glass-card hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-zinc-300 font-bold"
                >
                  <MessageSquare className="w-5 h-5 text-green-400" /> Чат
                </motion.button>
                <motion.button 
                  onClick={() => setPage(20)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} 
                  className="w-full py-3 rounded-2xl glass-card hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-zinc-300 font-bold"
                >
                  <Newspaper className="w-5 h-5 text-lime-400" /> Новости
                </motion.button>
                <motion.button 
                  onClick={() => setPage(21)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} 
                  className="w-full py-3 rounded-2xl glass-card hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-zinc-300 font-bold"
                >
                  <MessageCircle className="w-5 h-5 text-rose-400" /> Форум
                </motion.button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <motion.button 
                  onClick={() => setPage(10)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} 
                  className="w-full py-3 rounded-2xl glass-card hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-zinc-300 font-bold"
                >
                  <Flag className="w-5 h-5 text-purple-400" /> Клан
                </motion.button>
              </div>
              <div className="mt-4 mb-2">
                <h3 className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3 pl-2">Режимы игры</h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <motion.button 
                    onClick={() => setPage(22)}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} 
                    className="py-4 rounded-2xl glass-card hover:bg-white/10 transition-colors flex flex-col items-center justify-center gap-2 text-zinc-300 font-bold"
                  >
                    <Swords className="w-6 h-6 text-orange-400" />
                    <span className="text-[9px] uppercase tracking-wider">1 на 1</span>
                  </motion.button>
                  <motion.button 
                    onClick={() => setPage(23)}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} 
                    className="py-4 rounded-2xl glass-card hover:bg-white/10 transition-colors flex flex-col items-center justify-center gap-2 text-zinc-300 font-bold"
                  >
                    <Users className="w-6 h-6 text-cyan-400" />
                    <span className="text-[9px] uppercase tracking-wider">Отряды</span>
                  </motion.button>
                  <motion.button 
                    onClick={() => setPage(24)}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} 
                    className="py-4 rounded-2xl glass-card hover:bg-white/10 transition-colors flex flex-col items-center justify-center gap-2 text-zinc-300 font-bold relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent" />
                    <Trophy className="w-6 h-6 text-rose-400 relative z-10" />
                    <span className="text-[9px] uppercase tracking-wider relative z-10 text-center leading-tight">Королевская<br/>битва</span>
                  </motion.button>
                </div>
                <motion.button 
                  onClick={() => setPage(9)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} 
                  className="w-full py-4 rounded-2xl btn-primary flex items-center justify-center gap-3"
                >
                  <ScrollText className="w-6 h-6" /> Сюжетные миссии
                </motion.button>
              </div>
              <div className="mt-2 mb-2">
                <h3 className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3 pl-2">Торговля</h3>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button onClick={() => setPage(12)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} className="w-full py-3 rounded-2xl glass-card hover:bg-white/10 transition-colors flex items-center justify-center gap-2 font-bold text-zinc-300">
                    <ShoppingBag className="w-5 h-5 text-amber-400" /> Магазин
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} className="w-full py-3 rounded-2xl glass-card hover:bg-white/10 transition-colors flex items-center justify-center gap-2 font-bold text-zinc-300">
                    <Gavel className="w-5 h-5 text-amber-400" /> Аукцион
                  </motion.button>
                </div>
              </div>
              <div className="mt-2">
                <motion.button onClick={() => setPage(3)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} className="w-full py-4 rounded-2xl glass-card hover:bg-white/10 transition-colors flex items-center justify-center gap-2 font-bold text-zinc-300">
                  <User className="w-5 h-5 text-lime-400" /> Мой персонаж
                </motion.button>
              </div>

              {isAdmin && (
                <div className="mt-4">
                  <motion.button 
                    onClick={() => setPage(28)} 
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} 
                    className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 font-bold text-red-400"
                  >
                    <ShieldAlert className="w-5 h-5" /> Админ Панель
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {page === 3 && (
          <motion.div
            key="page3"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center mb-8 relative mt-4">
              <button 
                onClick={() => setPage(2)} 
                className="absolute left-0 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-bold uppercase tracking-widest w-full text-center">Экипировка</h2>
            </div>

            {/* Character & Slots */}
            <div className="character mt-4">
              {/* Left Column */}
              <div className="flex flex-col justify-between h-full" style={{ gridColumn: 1, gridRow: '1 / span 3' }}>
                <EquipSlot label="Шлем" item={equippedItems["Шлем"]} onUnequip={() => unequipItem("Шлем")} />
                <EquipSlot label="Наручи" item={equippedItems["Наручи"]} onUnequip={() => unequipItem("Наручи")} />
                <EquipSlot label="Меч" item={equippedItems["Меч"]} onUnequip={() => unequipItem("Меч")} />
                <EquipSlot label="Штаны" item={equippedItems["Штаны"]} onUnequip={() => unequipItem("Штаны")} />
                <EquipSlot label="Сапоги" item={equippedItems["Сапоги"]} onUnequip={() => unequipItem("Сапоги")} />
              </div>

              {/* Center Silhouette */}
              <div className="avatar rounded-3xl border-2 border-white/5 relative shadow-2xl overflow-hidden flex items-center justify-center" style={{ gridRow: '1 / span 3' }}>
                {/* Nickname above Avatar */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-full text-center z-20">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-lime-400/60 font-black drop-shadow-sm">
                    {playerName}
                  </span>
                </div>

                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <img 
                    src={avatarUrl || (playerGender === 'male' 
                      ? "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f18c-776e-9828-56965684617a" 
                      : "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f1b2-7216-9828-56965684617a")
                    }
                    alt=""
                    className={`w-full h-full object-contain brightness-0 invert ${playerGender === 'male' ? 'sepia-[1] saturate-[3] hue-rotate-[180deg] opacity-40' : 'sepia-[1] saturate-[3] hue-rotate-[300deg] opacity-40'} filter blur-[0.5px] transition-all duration-700`}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.parentElement?.querySelector('.fallback-silhouette');
                      if (fallback) fallback.classList.remove('hidden');
                    }}
                  />
                </div>
                <div className="fallback-silhouette hidden absolute inset-0 flex items-center justify-center">
                  {playerGender === 'male' ? <Swords className="w-40 h-40 text-blue-500/40 filter blur-[1px]" /> : <User className="w-40 h-40 text-pink-500/40 filter blur-[1px]" />}
                </div>
                <div className={`absolute inset-0 bg-gradient-to-t ${playerGender === 'male' ? 'from-blue-900/20' : 'from-pink-900/20'} to-transparent pointer-events-none`} />
                
                {/* Energy Particles (CSS simulated) */}
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                  <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full animate-ping" />
                  <div className="absolute top-3/4 right-1/3 w-1 h-1 bg-white rounded-full animate-ping delay-300" />
                  <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-white rounded-full animate-ping delay-700" />
                </div>
                
                {/* Overlay icons for equipped items */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-4 p-4 opacity-30 pointer-events-none">
                  {(Object.values(equippedItems) as (Item | null)[]).map((item, i) => {
                    if (!item) return <div key={i} />;
                    const name = item.name.toLowerCase();
                    return (
                      <div key={i} className="flex items-center justify-center">
                        {name.includes("меч") && <Swords className="w-4 h-4 text-lime-300" />}
                        {name.includes("щит") && <Shield className="w-4 h-4 text-lime-300" />}
                        {name.includes("лук") && <Wind className="w-4 h-4 text-lime-300" />}
                        {name.includes("топор") && <Gavel className="w-4 h-4 text-lime-300" />}
                        {name.includes("посох") && <Star className="w-4 h-4 text-lime-300" />}
                        {name.includes("рубашка") && <User className="w-4 h-4 text-lime-300" />}
                      </div>
                    );
                  })}
                </div>

                {/* Clan Name below Avatar */}
                {clanId && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-full text-center z-20">
                    <span className="text-[9px] uppercase tracking-widest text-purple-400 font-bold drop-shadow-sm">
                      &lt;{clanId}&gt;
                    </span>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="flex flex-col justify-between h-full" style={{ gridColumn: 3, gridRow: '1 / span 3' }}>
                <EquipSlot label="Ожерелье" item={equippedItems["Ожерелье"]} onUnequip={() => unequipItem("Ожерелье")} />
                <EquipSlot label="Перчатки" item={equippedItems["Перчатки"]} onUnequip={() => unequipItem("Перчатки")} />
                <EquipSlot label="Второе оружие" item={equippedItems["Второе оружие"]} onUnequip={() => unequipItem("Второе оружие")} />
                <EquipSlot label="Рубашка" item={equippedItems["Рубашка"]} onUnequip={() => unequipItem("Рубашка")} />
                <EquipSlot label="Пояс" item={equippedItems["Пояс"]} onUnequip={() => unequipItem("Пояс")} />
              </div>
            </div>

            {/* Character Info Block */}
            <div className="mt-6 glass-card/40 backdrop-blur-md border border-white/5 rounded-3xl p-4 flex flex-col gap-4 shadow-xl">
              {/* Header: Name & Role */}
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black tracking-tight text-white drop-shadow-sm">
                    {realName || "Алексей"}
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-lime-400/20 text-lime-300 border border-lime-400/30">
                    {clanRole || "Новичок"}
                  </span>
                </div>

                {/* Online Status Indicator */}
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/5">
                  <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isOnline ? 'text-green-400' : 'text-zinc-500'}`}>
                    {isOnline ? "В сети" : (
                      (() => {
                        const now = new Date();
                        const diff = now.getTime() - lastSeen.getTime();
                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                        if (days >= 10) return "Был давно";
                        if (days >= 1) return "Был недавно";
                        const hours = lastSeen.getHours().toString().padStart(2, '0');
                        const minutes = lastSeen.getMinutes().toString().padStart(2, '0');
                        return `Был в ${hours}:${minutes}`;
                      })()
                    )}
                  </span>
                </div>
              </div>

              {/* Clan & Level Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 rounded-2xl p-3 border border-white/5 flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Клан</span>
                  {clanName ? (
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-lime-300 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> {clanName}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium">5 Уровень</span>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-zinc-400 italic text-[11px]">не состоит в клане</span>
                  )}
                </div>

                <div className="bg-black/40 rounded-2xl p-3 border border-white/5 flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Прогресс</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-white uppercase tracking-tighter">
                      Уровень {currentLevel || 3}
                    </span>
                    <div className="w-full h-1 bg-zinc-900/80 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="h-full bg-lime-400" 
                        style={{ width: `${(xp / XP_TABLE[currentLevel + 1]) * 100}%` }} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Race & Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/5 border border-white/5 text-zinc-200">
                  {playerRace === "Эльф" ? <Wind className="w-4 h-4 text-green-400" /> :
                   playerRace === "Орк" ? <Swords className="w-4 h-4 text-red-400" /> :
                   playerRace === "Гном" ? <Mountain className="w-4 h-4 text-lime-600" /> :
                   playerRace === "Нежить" ? <Snowflake className="w-4 h-4 text-blue-300" /> :
                   <User className="w-4 h-4 text-lime-300" />}
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {playerRace || "Человек"}
                  </span>
                </div>

                {playerBadges.includes('admin') && (
                  <div className="p-1.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400">
                    <Crown className="w-4 h-4" />
                  </div>
                )}
                {isCreator && (
                  <div className="p-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1 px-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Создатель</span>
                  </div>
                )}
                {playerBadges.includes('verified') && (
                  <div className="p-1.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </div>

            </div>

            {/* Identity Grid - Compact & Stylish */}
            <div className="flex justify-between items-center gap-1 mt-4 bg-white/5 border border-white/5 rounded-2xl p-2 w-full">
              <div className="flex-1 flex items-center gap-2 pl-1">
                <div className={`w-7 h-7 rounded-lg ${playerGender === 'male' ? 'bg-blue-500/10' : 'bg-pink-500/10'} flex items-center justify-center shrink-0`}>
                  {playerGender === 'male' ? <Mars className="w-3.5 h-3.5 text-blue-400" /> : <Venus className="w-3.5 h-3.5 text-pink-400" />}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[7px] uppercase tracking-wider text-zinc-500 font-bold leading-none mb-0.5">Пол</span>
                  <span className={`text-[10px] font-bold truncate ${playerGender === 'male' ? 'text-blue-300' : 'text-pink-300'}`}>
                    {playerGender === 'male' ? 'Мужской' : 'Женский'}
                  </span>
                </div>
              </div>
              
              <div className="w-px h-6 bg-white/10 shrink-0" />
              
              <div className="flex-1 flex items-center gap-2 px-1">
                <div className="w-7 h-7 rounded-lg bg-zinc-500/10 flex items-center justify-center shrink-0">
                  <CalendarDays className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[7px] uppercase tracking-wider text-zinc-500 font-bold leading-none mb-0.5">Возраст</span>
                  <span className="text-[10px] font-bold text-zinc-200 truncate">{playerAge} лет</span>
                </div>
              </div>
              
              <div className="w-px h-6 bg-white/10 shrink-0" />
              
              <div className="flex-1 flex items-center gap-2 pr-1">
                <div className="w-7 h-7 rounded-lg bg-zinc-500/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[7px] uppercase tracking-wider text-zinc-500 font-bold leading-none mb-0.5">Страна</span>
                  <span className="text-[10px] font-bold text-zinc-200 truncate">{isCountryHidden ? "••••••••" : country}</span>
                </div>
              </div>
            </div>

            {/* Attributes */}
            <div className={`mt-4 bg-white/5 border ${isStatsExpanded ? 'border-lime-400/20' : 'border-white/5'} rounded-2xl p-3 w-full overflow-hidden transition-all duration-300`}>
              <button 
                onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                className="flex justify-between items-center w-full group"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-4 ${isStatsExpanded ? 'bg-lime-400' : 'bg-zinc-600'} rounded-full transition-colors`} />
                  <h4 className={`text-[10px] uppercase tracking-widest ${isStatsExpanded ? 'text-lime-300' : 'text-zinc-500'} font-bold group-hover:text-lime-300 transition-colors`}>Характеристики</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold group-hover:text-zinc-300 transition-colors">
                    {isStatsExpanded ? "Свернуть" : "Развернуть"}
                  </span>
                  <ChevronRight className={`w-3 h-3 text-zinc-500 transition-transform duration-300 ${isStatsExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>
              
              <AnimatePresence>
                {isStatsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-4">
                      {unspentStatPoints > 0 && (
                        <div className="mb-4 p-2 bg-lime-400/10 border border-lime-400/20 rounded-lg text-center">
                          <span className="text-[10px] uppercase tracking-widest text-lime-300 font-black animate-pulse">
                            Свободных очков: {unspentStatPoints}
                          </span>
                        </div>
                      )}
                      {[
                        { label: "Сила", base: 10 + spentStrength, gear: gearBonuses.strength, elixir: elixirBonuses.strength, setter: setSpentStrength, spent: spentStrength, key: 'strength', color: 'text-red-400' },
                        { label: "Ловкость", base: 10 + spentAgility, gear: gearBonuses.agility, elixir: elixirBonuses.agility, setter: setSpentAgility, spent: spentAgility, key: 'agility', color: 'text-blue-400' },
                        { label: "Интуиция", base: 10 + spentIntuition, gear: gearBonuses.intuition, elixir: elixirBonuses.intuition, setter: setSpentIntuition, spent: spentIntuition, key: 'intuition', color: 'text-purple-400' },
                        { label: "Выносливость", base: 10 + spentEndurance, gear: gearBonuses.endurance, elixir: elixirBonuses.endurance, setter: setSpentEndurance, spent: spentEndurance, key: 'endurance', color: 'text-green-400' },
                        { label: "Мудрость", base: 10 + spentWisdom, gear: gearBonuses.wisdom, elixir: elixirBonuses.wisdom, setter: setSpentWisdom, spent: spentWisdom, key: 'wisdom', color: 'text-cyan-400' },
                      ].map((stat, idx) => {
                        const pending = pendingStats[stat.key as keyof typeof pendingStats];
                        const total = stat.base + pending + stat.gear + stat.elixir;
                        return (
                          <div key={idx} className="flex flex-col gap-1">
                            <div className="flex justify-between items-center text-sm">
                              <span className={`text-[10px] uppercase tracking-widest font-bold ${stat.color}`}>{stat.label}</span>
                              <div className="flex items-center gap-3">
                                <div className="font-mono flex items-center gap-1 text-[10px]">
                                  <span className="text-zinc-400">{stat.base}</span>
                                  {pending !== 0 && (
                                    <span className={`${pending > 0 ? "text-lime-300" : "text-red-400"} font-bold`}>
                                      {pending > 0 ? "+" : ""}{pending}
                                    </span>
                                  )}
                                  <span className="text-zinc-600">+</span>
                                  <span className="text-green-400">({stat.gear})</span>
                                  <span className="text-zinc-600">+</span>
                                  <span className="text-lime-300">({stat.elixir})</span>
                                  <span className="text-zinc-600 mx-0.5">=</span>
                                  <div className={`px-2 py-0.5 rounded bg-white/10 border border-white/5 flex items-center justify-center min-w-[28px]`}>
                                    <span className="text-white font-black text-[12px] drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                                      {total}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {pending > 0 && (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPendingStats(prev => ({ ...prev, [stat.key]: prev[stat.key as keyof typeof pendingStats] - 1 }));
                                      }}
                                      className="w-5 h-5 rounded bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 hover:bg-red-500/40 transition-colors"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                  )}
                                  {unspentStatPoints > 0 && (
                                    <div className="flex items-center gap-1">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPendingStats(prev => ({ ...prev, [stat.key]: prev[stat.key as keyof typeof pendingStats] + 1 }));
                                        }}
                                        className="w-5 h-5 rounded bg-lime-400/20 border border-lime-400/50 flex items-center justify-center text-lime-300 hover:bg-lime-400/40 transition-colors"
                                      >
                                        <PlusCircle className="w-3 h-3" />
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPendingStats(prev => ({ ...prev, [stat.key]: prev[stat.key as keyof typeof pendingStats] + unspentStatPoints }));
                                        }}
                                        className="px-1.5 h-5 rounded bg-lime-400/20 border border-lime-400/50 flex items-center justify-center text-lime-300 hover:bg-lime-400/40 transition-colors text-[8px] font-black"
                                      >
                                        MAX
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${stat.color.replace('text-', 'bg-')} opacity-50 transition-all duration-500`} 
                                style={{ width: `${Math.min(100, (total / 150) * 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Confirm Pending Stats */}
                    {Object.values(pendingStats).some(v => v !== 0) && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSpentStrength(prev => prev + pendingStats.strength);
                            setSpentAgility(prev => prev + pendingStats.agility);
                            setSpentIntuition(prev => prev + pendingStats.intuition);
                            setSpentEndurance(prev => prev + pendingStats.endurance);
                            setSpentWisdom(prev => prev + pendingStats.wisdom);
                            setPendingStats({ strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 });
                          }}
                          className="flex-1 py-2 bg-green-500/20 border border-green-500/50 rounded-2xl text-green-400 text-[10px] font-bold uppercase tracking-widest hover:bg-green-500/30 transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Подтвердить распределение
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingStats({ strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 });
                          }}
                          className="px-3 py-2 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-400 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/30 transition-all"
                        >
                          Отмена
                        </button>
                      </div>
                    )}

                    {/* Magical Properties */}
                    {(totalManaCost > 0 || totalSpellPower > 0 || totalCooldownReduction > 0) && (
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                        <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Магические свойства</h4>
                        {totalManaCost > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-blue-400">Расход маны</span>
                            <span className="text-white font-mono">{totalManaCost}</span>
                          </div>
                        )}
                        {totalSpellPower > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-purple-400">Сила заклинаний</span>
                            <span className="text-white font-mono">+{totalSpellPower}</span>
                          </div>
                        )}
                        {totalCooldownReduction > 0 && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-cyan-400">Перезарядка</span>
                            <span className="text-white font-mono">-{totalCooldownReduction}%</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reset Stats Button */}
                    <div className="mt-6 pt-4 border-t border-white/5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          let costType: 'silver' | 'diamonds' = 'silver';
                          let costAmount = 0;
                          
                          if (currentLevel < 15) {
                            costType = 'silver';
                            costAmount = 90000;
                          } else if (currentLevel <= 40) {
                            costType = 'diamonds';
                            costAmount = 1000;
                          } else {
                            costType = 'diamonds';
                            costAmount = 1000;
                          }

                          const hasEnough = costType === 'silver' ? silver >= costAmount : diamonds >= costAmount;
                          
                          if (hasEnough) {
                            if (costType === 'silver') setSilver(prev => prev - costAmount);
                            else setDiamonds(prev => prev - costAmount);
                            
                            setSpentStrength(0);
                            setSpentAgility(0);
                            setSpentIntuition(0);
                            setSpentEndurance(0);
                            setSpentWisdom(0);
                          } else {
                            console.log("Not enough currency to reset stats");
                          }
                        }}
                        className="w-full py-2 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-2 group"
                      >
                        <RotateCcw className="w-4 h-4 text-zinc-500 group-hover:text-lime-300 transition-colors" />
                        <div className="flex flex-col items-start text-left">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-zinc-200 transition-colors">Сброс характеристик</span>
                          <span className="text-[8px] text-zinc-600">
                            {currentLevel < 15 ? "90,000 серебра" : "1,000 алмазов"}
                          </span>
                        </div>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Indicators */}
            <div className={`mt-4 bg-white/5 border ${isIndicatorsExpanded ? 'border-blue-500/20' : 'border-white/5'} rounded-2xl p-3 w-full overflow-hidden transition-all duration-300`}>
              <button 
                onClick={() => setIsIndicatorsExpanded(!isIndicatorsExpanded)}
                className="flex justify-between items-center w-full group"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-4 ${isIndicatorsExpanded ? 'bg-blue-500' : 'bg-zinc-600'} rounded-full transition-colors`} />
                  <h4 className={`text-[10px] uppercase tracking-widest ${isIndicatorsExpanded ? 'text-blue-400' : 'text-zinc-500'} font-bold group-hover:text-blue-300 transition-colors`}>Показатели</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold group-hover:text-zinc-300 transition-colors">
                    {isIndicatorsExpanded ? "Свернуть" : "Развернуть"}
                  </span>
                  <ChevronRight className={`w-3 h-3 text-zinc-500 transition-transform duration-300 ${isIndicatorsExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>
              
              <AnimatePresence>
                {isIndicatorsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Урон", value: `${Math.floor((20 + currentLevel * 5) * (1 + (totalStrength - 10) * 0.15))} - ${Math.floor((40 + currentLevel * 5) * (1 + (totalStrength - 10) * 0.15))}`, icon: <Swords className="w-3 h-3" />, color: 'text-red-400' },
                          { label: "Здоровье", value: maxPlayerHealth, icon: <Heart className="w-3 h-3" />, color: 'text-green-400' },
                          { label: "Уворот", value: `${Math.min(95, Math.floor(65 * (1 + (totalAgility - 10) * 0.15)))}%`, icon: <Zap className="w-3 h-3" />, color: 'text-blue-400' },
                          { label: "Блок", value: Math.floor(10 * (1 + (totalEndurance - 10) * 0.15)), icon: <Shield className="w-3 h-3" />, color: 'text-zinc-400' },
                          { label: "Крит", value: `${Math.min(75, parseFloat((6.5 * (1 + (totalIntuition - 10) * 0.15)).toFixed(1)))}%`, icon: <Target className="w-3 h-3" />, color: 'text-lime-300' },
                          { label: "Опыт", value: `+${Math.floor(10 * (1 + (totalWisdom - 10) * 0.15))}%`, icon: <TrendingUp className="w-3 h-3" />, color: 'text-cyan-400' },
                        ].map((indicator, idx) => (
                          <div key={idx} className="p-2 bg-black/20 rounded-lg border border-white/5 flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={indicator.color}>{indicator.icon}</span>
                              <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">{indicator.label}</span>
                            </div>
                            <span className="text-xs font-mono text-white font-bold">{indicator.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Full Inventory Integrated */}
            <div className={`mt-4 bg-white/5 border ${isInventoryExpanded ? 'border-lime-400/20' : 'border-white/5'} rounded-2xl p-3 w-full overflow-hidden transition-all duration-300`}>
              <button 
                onClick={() => {
                  setIsInventoryExpanded(!isInventoryExpanded);
                  setInventoryTab("equipment");
                }}
                className="flex justify-between items-center w-full group"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-4 ${isInventoryExpanded ? 'bg-lime-400' : 'bg-zinc-600'} rounded-full transition-colors`} />
                  <h4 className={`text-[10px] uppercase tracking-widest ${isInventoryExpanded ? 'text-lime-300' : 'text-zinc-500'} font-bold group-hover:text-lime-300 transition-colors`}>Инвентарь</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold group-hover:text-zinc-300 transition-colors">
                    {isInventoryExpanded ? "Скрыть" : "Показать"}
                  </span>
                  <ChevronRight className={`w-3 h-3 text-zinc-500 transition-transform duration-300 ${isInventoryExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>
              
              <AnimatePresence>
                {isInventoryExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4">
                      {/* Tabs */}
                      <div className="flex gap-2 mb-4">
                        {[
                          { id: "equipment", label: "Снаряжение", icon: Swords },
                          { id: "books", label: "Книги", icon: BookOpen },
                          { id: "elixirs", label: "Эликсиры", icon: FlaskConical },
                          { id: "chests", label: "Сундуки", icon: Package },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setInventoryTab(tab.id as any);
                              setSelectedItemIdx(null);
                            }}
                            className={`flex-1 py-2 rounded-2xl border flex flex-col items-center gap-1 transition-all duration-300 ${
                              inventoryTab === tab.id 
                                ? "bg-lime-400/20 border-lime-400/50 text-lime-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]" 
                                : "bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10"
                            }`}
                          >
                            <tab.icon className="w-4 h-4" />
                            <span className="text-[8px] uppercase font-bold tracking-tighter">{tab.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Grid */}
                      <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                        {Array.from({ length: 50 }).map((_, idx) => {
                          const isOpen = idx < 10;
                          const currentInv = inventoryTab === "equipment" ? inventory : inventoryTab === "books" ? booksInventory : inventoryTab === "elixirs" ? elixirsInventory : chestsInventory;
                          const item = isOpen ? currentInv[idx] : null;
                          const isSelected = selectedItemIdx === idx;

                          return (
                            <div key={idx} className="relative aspect-square">
                              <motion.div
                                whileHover={isOpen ? { scale: 1.05 } : {}}
                                whileTap={isOpen ? { scale: 0.95 } : {}}
                                onClick={() => {
                                  if (isOpen && item) {
                                    setSelectedItemIdx(isSelected ? null : idx);
                                  }
                                }}
                                className={`w-full h-full rounded-2xl border flex items-center justify-center transition-all duration-300 relative overflow-hidden ${
                                  !isOpen 
                                    ? "bg-black/40 border-white/5 opacity-40 cursor-not-allowed" 
                                    : isSelected
                                      ? "bg-lime-400/20 border-lime-300 shadow-[0_0_15px_rgba(163,230,53,0.2)] z-10"
                                      : item
                                        ? (inventoryTab === "equipment" && (item as Item).rarity === 'common' 
                                            ? "bg-zinc-900/80/80 border-white/40 shadow-[0_0_10px_rgba(255,255,255,0.1)] cursor-pointer" 
                                            : "bg-zinc-900/80/80 border-white/20 hover:border-white/40 cursor-pointer")
                                        : "bg-black/20 border-white/5 cursor-default"
                                }`}
                              >
                                {!isOpen ? (
                                  <Lock className="w-4 h-4 text-zinc-700" />
                                ) : item ? (
                                  <div className={`w-full h-full rounded-2xl border flex items-center justify-center transition-all duration-300 relative overflow-hidden ${
                                    inventoryTab === "equipment" && (item as Item).rarity === 'legendary' ? 'bg-orange-950/40 border-orange-500/50' :
                                    inventoryTab === "equipment" && (item as Item).rarity === 'epic' ? 'bg-purple-950/40 border-purple-500/50' :
                                    inventoryTab === "equipment" && (item as Item).rarity === 'rare' ? 'bg-blue-950/40 border-blue-500/50' :
                                    inventoryTab === "equipment" && (item as Item).rarity === 'uncommon' ? 'bg-green-950/40 border-green-500/50' :
                                    "bg-zinc-900/80/80 border-white/20"
                                  }`}>
                                    <div className="flex flex-col items-center justify-center p-1">
                                      {inventoryTab === "equipment" || inventoryTab === "chests" ? (
                                        <>
                                          {inventoryTab === "equipment" && (
                                            <>
                                              {(item as Item).name.toLowerCase().includes("меч") && <Swords className="w-5 h-5 text-zinc-200" />}
                                              {(item as Item).name.toLowerCase().includes("щит") && <Shield className="w-5 h-5 text-zinc-200" />}
                                              {(item as Item).name.toLowerCase().includes("лук") && <Wind className="w-5 h-5 text-zinc-200" />}
                                              {(item as Item).name.toLowerCase().includes("топор") && <Gavel className="w-5 h-5 text-zinc-200" />}
                                              {(item as Item).name.toLowerCase().includes("посох") && <Star className="w-5 h-5 text-zinc-200" />}
                                              {(item as Item).name.toLowerCase().includes("рубашка") && <User className="w-5 h-5 text-zinc-200" />}
                                              {!(item as Item).name.toLowerCase().includes("меч") && !(item as Item).name.toLowerCase().includes("щит") && !(item as Item).name.toLowerCase().includes("лук") && !(item as Item).name.toLowerCase().includes("топор") && !(item as Item).name.toLowerCase().includes("посох") && !(item as Item).name.toLowerCase().includes("рубашка") && <Package className="w-5 h-5 text-zinc-200" />}
                                            </>
                                          )}
                                          {inventoryTab === "chests" && (
                                            <div className="relative">
                                              <Package className="w-5 h-5 text-lime-300" />
                                              {!hasGiftKey && (
                                                <div className="absolute -top-1 -right-1 bg-red-500/20 rounded-full p-0.5 border border-red-500/50">
                                                  <Lock className="w-2 h-2 text-red-400" />
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          {inventoryTab === "books" && <BookOpen className="w-5 h-5 text-zinc-200" />}
                                          {inventoryTab === "elixirs" && <FlaskConical className="w-5 h-5 text-zinc-200" />}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white/5" />
                                )}
                              </motion.div>
                              
                              {/* Item Details Popup (Overlay) */}
                              <AnimatePresence>
                                {isSelected && item && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                    className="absolute top-full left-0 right-0 mt-2 z-50 glass-card border border-white/20 rounded-2xl p-3 shadow-2xl min-w-[180px]"
                                    style={{ left: idx % 5 > 2 ? 'auto' : 0, right: idx % 5 > 2 ? 0 : 'auto' }}
                                  >
                                    <div className="mb-3">
                                      <div className="text-xs font-bold text-lime-300 mb-0.5 truncate">
                                        {inventoryTab === "equipment" || inventoryTab === "chests" ? (item as Item).name : (item as string)}
                                      </div>
                                      <div className="text-[9px] text-zinc-500 uppercase tracking-widest flex justify-between">
                                        <span>{inventoryTab === "equipment" ? "Снаряжение" : inventoryTab === "books" ? "Книга" : inventoryTab === "elixirs" ? "Эликсир" : "Сундук"}</span>
                                        {inventoryTab === "equipment" && <span>Ур. {(item as Item).level}</span>}
                                      </div>
                                    </div>

                                    {inventoryTab === "chests" && (item as Item).chestRewards && (
                                      <div className="mb-3 space-y-1 bg-black/40 p-2 rounded-lg border border-white/5">
                                        <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Содержимое:</div>
                                        {(item as Item).chestRewards?.iron && <div className="text-[10px] text-zinc-400">Железо: <span className="text-white">{(item as Item).chestRewards?.iron}</span></div>}
                                        {(item as Item).chestRewards?.silver && <div className="text-[10px] text-zinc-400">Серебро: <span className="text-white">{(item as Item).chestRewards?.silver}</span></div>}
                                        {(item as Item).chestRewards?.gold && <div className="text-[10px] text-zinc-400">Золото: <span className="text-white">{(item as Item).chestRewards?.gold}</span></div>}
                                        {(item as Item).chestRewards?.diamonds && <div className="text-[10px] text-zinc-400">Алмазы: <span className="text-white">{(item as Item).chestRewards?.diamonds}</span></div>}
                                      </div>
                                    )}

                                    {inventoryTab === "equipment" && (
                                      <div className="mb-3 space-y-1 bg-black/40 p-2 rounded-lg border border-white/5">
                                        <div className="flex justify-between items-center text-[10px] mb-1 pb-1 border-b border-white/5">
                                          <span className="text-lime-300 font-bold">Бонус:</span>
                                          <span className="text-lime-300 font-bold">+{ (item as Item).bonusPercent }%</span>
                                        </div>
                                        {(() => {
                                          const equipment = item as Item;
                                          let slot = "";
                                          if (equipment.name.toLowerCase().includes("меч") || equipment.name.toLowerCase().includes("лук") || equipment.name.toLowerCase().includes("топор") || equipment.name.toLowerCase().includes("посох")) slot = "Меч";
                                          else if (equipment.name.toLowerCase().includes("щит")) slot = "Второе оружие";
                                          else if (equipment.name.toLowerCase().includes("рубашка")) slot = "Рубашка";
                                          
                                          const equipped = slot ? equippedItems[slot] : null;

                                          return Object.entries(equipment.stats).map(([key, val]) => {
                                            if (val === 0) return null;
                                            const equippedVal = equipped ? (equipped.stats as any)[key] : 0;
                                            const diff = val - equippedVal;
                                            const statLabel = key === "strength" ? "Сил" : key === "agility" ? "Лов" : key === "intuition" ? "Инт" : key === "endurance" ? "Вын" : "Муд";
                                            
                                            return (
                                              <div key={key} className="flex justify-between items-center text-[10px]">
                                                <span className="text-zinc-400">{statLabel}:</span>
                                                <div className="flex items-center gap-1">
                                                  <span className="text-white font-mono">{val}</span>
                                                  {equipped && diff !== 0 && (
                                                    <span className={`text-[8px] font-bold ${diff > 0 ? "text-green-400" : "text-red-400"}`}>
                                                      ({diff > 0 ? "+" : ""}{diff})
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          });
                                        })()}
                                        {(() => {
                                          const equipment = item as Item;
                                          if (equipment.mana_cost === undefined && equipment.spell_power === undefined && equipment.cooldown_reduction === undefined) return null;
                                          return (
                                            <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                                              {equipment.mana_cost !== undefined && (
                                                <div className="flex justify-between items-center text-[10px]">
                                                  <span className="text-blue-400">Расход маны:</span>
                                                  <span className="text-white font-mono">{equipment.mana_cost}</span>
                                                </div>
                                              )}
                                              {equipment.spell_power !== undefined && (
                                                <div className="flex justify-between items-center text-[10px]">
                                                  <span className="text-purple-400">Сила заклинаний:</span>
                                                  <span className="text-white font-mono">+{equipment.spell_power}</span>
                                                </div>
                                              )}
                                              {equipment.cooldown_reduction !== undefined && (
                                                <div className="flex justify-between items-center text-[10px]">
                                                  <span className="text-cyan-400">Перезарядка:</span>
                                                  <span className="text-white font-mono">-{equipment.cooldown_reduction}%</span>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-1.5">
                                      {inventoryTab === "equipment" ? (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            equipItem(idx);
                                          }}
                                          className="w-full py-2 bg-blue-900/30 border border-blue-500/30 rounded-lg text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-2"
                                        >
                                          <CheckCircle2 className="w-4 h-4" /> Экипировать
                                        </button>
                                      ) : inventoryTab === "chests" ? (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!hasGiftKey) {
                                              toast.error("Для открытия этого сундука необходимо Кольцо-ключ, которое присылают на почту при достижении 5 уровня!");
                                              return;
                                            }
                                            const chest = item as Item;
                                            if (chest.chestRewards) {
                                              if (chest.chestRewards.iron) setIron(prev => prev + chest.chestRewards!.iron!);
                                              if (chest.chestRewards.silver) setSilver(prev => prev + chest.chestRewards!.silver!);
                                              if (chest.chestRewards.gold) setGold(prev => prev + chest.chestRewards!.gold!);
                                              if (chest.chestRewards.diamonds) setDiamonds(prev => prev + chest.chestRewards!.diamonds!);
                                              
                                              setChestsInventory(prev => {
                                                const newInv = [...prev];
                                                newInv.splice(idx, 1);
                                                return newInv;
                                              });
                                              setSelectedItemIdx(null);
                                            }
                                          }}
                                          className="w-full py-2 bg-lime-400/20 border border-lime-400/50 rounded-lg text-[10px] font-bold uppercase tracking-widest text-lime-300 hover:bg-lime-400/30 transition-colors"
                                        >
                                          Открыть
                                        </button>
                                      ) : (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Placeholder for use logic
                                            if (inventoryTab === "books") {
                                              setBooksInventory(prev => {
                                                const newInv = [...prev];
                                                newInv.splice(idx, 1);
                                                return newInv;
                                              });
                                            } else {
                                              setElixirsInventory(prev => {
                                                const newInv = [...prev];
                                                newInv.splice(idx, 1);
                                                return newInv;
                                              });
                                            }
                                            setSelectedItemIdx(null);
                                          }}
                                          className="w-full py-2 bg-green-900/30 border border-green-500/30 rounded-lg text-[10px] font-bold uppercase tracking-widest text-green-400 hover:bg-green-900/50 transition-colors"
                                        >
                                          Использовать
                                        </button>
                                      )}
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (inventoryTab === "equipment") {
                                            dismantleItem(idx);
                                          } else {
                                            setIron(prev => prev + 1);
                                            if (inventoryTab === "books") {
                                              setBooksInventory(prev => {
                                                const newInv = [...prev];
                                                newInv.splice(idx, 1);
                                                return newInv;
                                              });
                                            } else if (inventoryTab === "elixirs") {
                                              setElixirsInventory(prev => {
                                                const newInv = [...prev];
                                                newInv.splice(idx, 1);
                                                return newInv;
                                              });
                                            } else if (inventoryTab === "chests") {
                                              setChestsInventory(prev => {
                                                const newInv = [...prev];
                                                newInv.splice(idx, 1);
                                                return newInv;
                                              });
                                            }
                                            setSelectedItemIdx(null);
                                            toast.success("Предмет разобран на 1 ед. железа");
                                          }
                                        }}
                                        className="w-full py-2 bg-blue-900/30 border border-blue-500/30 rounded-lg text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-2"
                                      >
                                        <Gavel className="w-4 h-4" /> Разобрать
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (inventoryTab === "equipment") {
                                            setInventory(prev => {
                                              const newInv = [...prev];
                                              newInv.splice(idx, 1);
                                              return newInv;
                                            });
                                          } else if (inventoryTab === "books") {
                                            setBooksInventory(prev => {
                                              const newInv = [...prev];
                                              newInv.splice(idx, 1);
                                              return newInv;
                                            });
                                          } else {
                                            setElixirsInventory(prev => {
                                              const newInv = [...prev];
                                              newInv.splice(idx, 1);
                                              return newInv;
                                            });
                                          }
                                          setSelectedItemIdx(null);
                                        }}
                                        className="w-full py-2 bg-red-900/30 border border-red-500/30 rounded-lg text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-900/50 transition-colors"
                                      >
                                        Выбросить
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 mb-12 space-y-2 w-full">
              <motion.button 
                onClick={() => setPage(16)}
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.95 }} 
                className="w-full py-2 rounded-full  bg-white/5 border border-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <ScrollText className="w-5 h-5" /> Анкета
              </motion.button>
              <motion.button 
                onClick={() => setPage(7)}
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.95 }} 
                className="w-full py-2 rounded-full  bg-white/5 border border-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-5 h-5" /> Моя почта
              </motion.button>
              <motion.button 
                onClick={() => setPage(11)}
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.95 }} 
                className="w-full py-2 rounded-full  bg-white/5 border border-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-5 h-5" /> Настройки
              </motion.button>
              <motion.button 
                onClick={() => setShowGlobalFeed(true)}
                whileHover={{ scale: 1.02 }} 
                whileTap={{ scale: 0.95 }} 
                className="w-full py-2 rounded-full bg-lime-400/10 border border-lime-400/30 hover:bg-lime-400/20 transition-colors flex items-center justify-center gap-2 relative"
              >
                <Bell className="w-5 h-5 text-lime-400" /> 
                <span className="text-lime-200">Глобальные события</span>
                {hasNewEvents && (
                  <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
        {page === 6 && (
          <motion.div
            key="page6"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center mb-8 relative mt-4">
              <button 
                onClick={() => setPage(9)} 
                className="absolute left-0 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-bold uppercase tracking-widest w-full text-center text-green-400">Темный Лес</h2>
            </div>

            <div className="flex justify-center mb-4">
              <LocationPlayers location="Лес" userLocations={userLocations} currentUserId={auth.currentUser?.uid} />
            </div>

            <div className="flex-1 flex flex-col gap-2">
              <p className="text-zinc-400 text-center mb-4">Выберите противника для охоты:</p>
              
              {FOREST_ENEMIES.map((enemy, idx) => {
                const isUnlocked = forestProgress >= idx;
                const isDefeated = forestProgress > idx;
                
                return (
                  <motion.button
                    key={idx}
                    onClick={() => {
                      if (isUnlocked && !isDefeated) {
                        setPlayerHealth(maxPlayerHealth);
                        setWolfHealth(enemy.maxHealth);
                        setBattleLog([]);
                        setPage(4);
                      }
                    }}
                    whileHover={isUnlocked && !isDefeated ? { scale: 1.02 } : {}}
                    whileTap={isUnlocked && !isDefeated ? { scale: 0.95 } : {}}
                    className={`w-full py-2 px-3 rounded-2xl  border transition-all duration-300 flex items-center justify-between ${
                      isDefeated 
                        ? "glass-card border-white/5 text-zinc-600 opacity-70" 
                        : isUnlocked 
                          ? "bg-green-900/20 border-green-500/30 text-green-100 hover:bg-green-900/40 shadow-[0_0_15px_rgba(34,197,94,0.1)]" 
                          : "bg-black/40 border-white/5 text-zinc-700 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <PawPrint className={`w-6 h-6 ${isDefeated ? 'text-zinc-700' : isUnlocked ? 'text-green-500' : 'text-zinc-800'}`} />
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">
                            {enemy.name}
                            {enemy.name === "Черный волк" && ` (${blackWolfKills}/3)`}
                          </span>
                          {enemy.name === "Вожак волчьей стаи" && <Crown className="w-4 h-4 text-lime-300" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            currentLevel >= (enemy as any).recLevel 
                              ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                              : 'bg-red-500/10 border-red-500/30 text-red-400'
                          }`}>
                            Ур. {(enemy as any).recLevel}
                          </span>
                          {isUnlocked && !isDefeated && <span className="text-[10px] text-green-400/70 uppercase tracking-widest font-medium">Доступно</span>}
                          {isDefeated && <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Побежден</span>}
                          {!isUnlocked && <span className="text-[10px] text-zinc-700 uppercase tracking-widest font-medium">Заблокировано</span>}
                        </div>
                      </div>
                    </div>
                    {isUnlocked && !isDefeated && <Swords className="w-5 h-5 text-green-500/50" />}
                    {isDefeated && <Lock className="w-5 h-5 text-zinc-700" />}
                    {!isUnlocked && <Lock className="w-5 h-5 text-zinc-800" />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
        {page === 7 && (
          <motion.div
            key="page7"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center mb-8 relative mt-4">
              <button 
                onClick={() => setPage(2)} 
                className="absolute left-0 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-bold uppercase tracking-widest w-full text-center">Почта</h2>
            </div>

            <div className="flex-1 flex flex-col gap-2 overflow-y-auto pb-20">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-2">
                  <Mail className="w-12 h-12 opacity-20" />
                  <p>У вас пока нет писем</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    onClick={() => {
                      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
                    }}
                    className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
                      msg.read 
                        ? "bg-white/5 border-white/5 text-zinc-400" 
                        : "bg-lime-400/10 border-lime-400/30 text-zinc-100 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] uppercase tracking-widest font-bold ${msg.read ? "text-zinc-600" : "text-lime-300"}`}>
                        {msg.read ? "Прочитано" : "Новое письмо"}
                      </span>
                      <span className="text-[10px] text-zinc-600">{msg.date}</span>
                    </div>
                    <p className="text-sm leading-relaxed mb-3">{msg.text}</p>
                    
                      {msg.claimable && !msg.claimed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (msg.claimable) {
                              if (msg.claimable.givesKey) {
                                setHasGiftKey(true);
                                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, claimed: true, read: true } : m));
                              } else {
                                const chest: Item = {
                                  id: Math.random().toString(36).substr(2, 9),
                                  name: "Сундук с ресурсами",
                                  level: 1,
                                  rarity: 'rare',
                                  type: 'chest',
                                  bonusPercent: 0,
                                  stats: { strength: 0, agility: 0, intuition: 0, endurance: 0, wisdom: 0 },
                                  isChest: true,
                                  chestRewards: msg.claimable
                                };
                                setChestsInventory(prev => [...prev, chest]);
                                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, claimed: true, read: true } : m));
                              }
                            }
                          }}
                          className="w-full py-2 bg-lime-400/20 border border-lime-400/50 rounded-2xl text-lime-300 text-[10px] font-bold uppercase tracking-widest hover:bg-lime-400/30 transition-all flex items-center justify-center gap-2"
                        >
                          <Package className="w-3 h-3" /> {msg.claimable.givesKey ? "Забрать Кольцо-ключ" : "Забрать в инвентарь"}
                        </button>
                      )}
                      
                      {msg.claimed && (
                        <div className="text-[10px] text-green-500/70 font-bold uppercase tracking-widest flex items-center gap-2">
                          <Check className="w-4 h-4" /> {msg.claimable?.givesKey ? "Кольцо получено" : "Ресурсы получены"}
                        </div>
                      )}
                  </motion.div>
                ))
              )}
            </div>

            <motion.button 
              onClick={() => setPage(2)}
              whileHover={{ scale: 1.02 }} 
              whileTap={{ scale: 0.95 }} 
              className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-md py-2 rounded-2xl  bg-white/10 border border-white/20 hover:bg-white/20 transition-colors flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-sm"
            >
              <ArrowLeft className="w-5 h-5" /> Назад
            </motion.button>
          </motion.div>
        )}

        {page === 9 && (
          <motion.div
            key="page9"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center mb-8 relative mt-4">
              <button 
                onClick={() => setPage(2)} 
                className="absolute left-0 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-bold uppercase tracking-widest w-full text-center text-lime-300">Сюжетные миссии</h2>
            </div>

            <div className="flex-1 flex flex-col gap-2">
              <p className="text-zinc-400 text-center mb-4">Выберите доступную главу сюжета:</p>
              
              <motion.button
                onClick={() => setPage(6)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full py-5 px-3 rounded-2xl  border transition-all duration-300 flex items-center justify-between ${
                  forestProgress < 4
                    ? "bg-green-900/20 border-green-500/30 text-green-100 hover:bg-green-900/40 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                    : "glass-card border-white/5 text-zinc-500 opacity-70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-3 rounded-2xl ${forestProgress < 4 ? 'bg-green-500/20 text-green-400' : 'bg-zinc-900/80 text-zinc-600'}`}>
                    <TreePine className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-base">Темный Лес</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-60">
                      {forestProgress < 4 ? "Глава 1: В процессе" : "Глава 1: Завершено"}
                    </span>
                  </div>
                </div>
                {forestProgress < 4 ? <ChevronRight className="w-5 h-5 text-green-500/50" /> : <CheckCircle2 className="w-5 h-5 text-green-500" />}
              </motion.button>

              <motion.button
                disabled={forestProgress < 4}
                onClick={() => setPage(26)}
                whileHover={forestProgress >= 4 ? { scale: 1.02 } : {}}
                whileTap={forestProgress >= 4 ? { scale: 0.95 } : {}}
                className={`w-full py-5 px-3 rounded-2xl  border transition-all duration-300 flex items-center justify-between ${
                  forestProgress >= 4
                    ? "bg-zinc-900/80/40 border-zinc-400/30 text-zinc-200 hover:bg-zinc-700/40"
                    : "bg-black/40 border-white/5 text-zinc-700 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-3 rounded-2xl ${forestProgress >= 4 ? 'bg-zinc-700/40 text-zinc-300' : 'glass-card text-zinc-800'}`}>
                    <Mountain className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-base">Поход в горы</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-60">
                      {forestProgress >= 4 ? "Глава 2: Доступно" : "Глава 2: Заблокировано"}
                    </span>
                  </div>
                </div>
                {forestProgress >= 4 ? <ChevronRight className="w-5 h-5 text-zinc-500" /> : <Lock className="w-5 h-5 text-zinc-800" />}
              </motion.button>

              <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                <p className="text-xs text-zinc-500 italic">Новые главы будут открываться по мере прохождения сюжета...</p>
              </div>
            </div>
          </motion.div>
        )}


        {page === 10 && (
          <motion.div
            key="page10"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center mb-8 relative mt-4">
              <button 
                onClick={() => setPage(2)} 
                className="absolute left-0 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-bold uppercase tracking-widest w-full text-center text-lime-300">Мой клан</h2>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              {clan ? (
                <div className="flex flex-col h-full">
                  {/* Clan Tabs */}
                  <div className="flex gap-2 mb-6">
                    <button 
                      onClick={() => setClanTab("info")}
                      className={`flex-1 py-2 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                        clanTab === "info" ? "bg-lime-400/20 border-lime-400/50 text-lime-300" : "bg-white/5 border-white/5 text-zinc-500"
                      }`}
                    >
                      Инфо
                    </button>
                    <button 
                      onClick={() => setClanTab("members")}
                      className={`flex-1 py-2 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                        clanTab === "members" ? "bg-lime-400/20 border-lime-400/50 text-lime-300" : "bg-white/5 border-white/5 text-zinc-500"
                      }`}
                    >
                      Участники
                    </button>
                    {(clan.leader === playerName) && (
                      <button 
                        onClick={() => setClanTab("manage")}
                        className={`flex-1 py-2 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                          clanTab === "manage" ? "bg-red-500/20 border-red-500/50 text-red-400" : "bg-white/5 border-white/5 text-zinc-500"
                        }`}
                      >
                        Управление
                      </button>
                    )}
                  </div>

                  {clanTab === "info" && (
                    <div className="bg-white/5  border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="w-20 h-20 rounded-full bg-lime-900/20 border-2 border-lime-400/30 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(245,158,11,0.1)] overflow-hidden">
                        {clan.avatarUrl ? (
                          <img src={clan.avatarUrl} alt="Crest" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Shield className="w-10 h-10 text-lime-300" />
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-white mb-1">{clan.name}</h3>
                      <div className="flex items-center gap-2 mb-6">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${
                          clan.leader === playerName ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-zinc-500/10 border-zinc-500/30 text-zinc-400"
                        }`}>
                          {clan.leader === playerName ? "Лидер" : "Участник"}
                        </span>
                        {clan.settings?.isPrivate && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/30 text-blue-400 uppercase tracking-widest">Закрытый</span>
                        )}
                      </div>
                      
                      <div className="w-full grid grid-cols-2 gap-2 mb-6">
                        <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Участники</div>
                          <div className="text-base font-bold text-white">{clan.members?.length || 0} / 50</div>
                        </div>
                        <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Уровень</div>
                          <div className="text-base font-bold text-white">{clan.level}</div>
                        </div>
                      </div>

                      {!showClanLeaveConfirm ? (
                        <button 
                          onClick={() => setShowClanLeaveConfirm(true)}
                          className="text-red-400 text-xs font-bold uppercase tracking-widest hover:text-red-300 transition-colors flex items-center gap-2"
                        >
                          <LogOut className="w-3 h-3" /> Покинуть клан
                        </button>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-red-400 text-xs font-bold">Вы уверены?</p>
                          <div className="flex gap-2">
                            <button 
                              onClick={async () => {
                                try {
                                  const user = auth.currentUser;
                                  const docId = user ? user.uid : playerName;
                                  
                                  // Update user
                                  await setDoc(doc(db, "users", docId), { clanId: null }, { merge: true });
                                  
                                  // Update clan members
                                  const updatedMembers = clan.members.filter((m: any) => (m.nickname || m) !== playerName);
                                  await updateDoc(doc(db, "clans", clanId!), { members: updatedMembers });
                                  
                                  setClanId(null);
                                  setClan(null);
                                  setShowClanLeaveConfirm(false);
                                  toast.info("Вы покинули клан");
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.UPDATE, `clans/${clanId}`);
                                }
                              }}
                              className="px-3 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/30 transition-all"
                            >
                              Да, покинуть
                            </button>
                            <button 
                              onClick={() => setShowClanLeaveConfirm(false)}
                              className="px-3 py-2 bg-zinc-900/80 border border-white/5 rounded-lg text-zinc-300 text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-700 transition-all"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {clanTab === "members" && (
                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                      {clan.members?.map((member: any, idx: number) => {
                        const mNickname = member.nickname || member;
                        const mRole = member.role || (mNickname === clan.leader ? "leader" : "member");
                        const isMeLeader = clan.leader === playerName;
                        
                        return (
                          <div key={idx} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-900/80 flex items-center justify-center text-zinc-400 font-bold text-xs border border-white/5">
                                {mNickname[0]}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-zinc-200">{mNickname}</span>
                                <span className={`text-[9px] uppercase tracking-widest ${
                                  mRole === 'leader' ? 'text-red-400' : mRole === 'officer' ? 'text-lime-300' : 'text-zinc-500'
                                }`}>
                                  {mRole === 'leader' ? "Лидер" : mRole === 'officer' ? "Офицер" : "Участник"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {mRole === 'leader' && <Crown className="w-4 h-4 text-red-400" />}
                              {isMeLeader && mNickname !== playerName && (
                                <div className="flex gap-1">
                                  {mRole === 'member' && (
                                    <button 
                                      onClick={async () => {
                                        const newMembers = clan.members.map((m: any) => 
                                          (m.nickname || m) === mNickname ? { ...m, role: 'officer' } : m
                                        );
                                        await updateDoc(doc(db, "clans", clanId!), { members: newMembers });
                                        toast.success(`${mNickname} назначен офицером`);
                                      }}
                                      className="p-1.5 bg-lime-400/10 border border-lime-400/20 rounded text-lime-400 hover:bg-lime-400 hover:text-lime-950 transition-all"
                                      title="Повысить до офицера"
                                    >
                                      <TrendingUp className="w-3 h-3" />
                                    </button>
                                  )}
                                  {mRole === 'officer' && (
                                    <button 
                                      onClick={async () => {
                                        const newMembers = clan.members.map((m: any) => 
                                          (m.nickname || m) === mNickname ? { ...m, role: 'member' } : m
                                        );
                                        await updateDoc(doc(db, "clans", clanId!), { members: newMembers });
                                        toast.info(`${mNickname} разжалован до участника`);
                                      }}
                                      className="p-1.5 bg-zinc-900/80 border border-white/5 rounded text-zinc-400 hover:bg-zinc-700 transition-all"
                                      title="Разжаловать"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button 
                                    onClick={async () => {
                                      if (confirm(`Вы уверены, что хотите исключить ${mNickname}?`)) {
                                        const newMembers = clan.members.filter((m: any) => (m.nickname || m) !== mNickname);
                                        await updateDoc(doc(db, "clans", clanId!), { members: newMembers });
                                        // Also need to update the user's clanId in their doc
                                        const targetUid = member.uid;
                                        if (targetUid) {
                                          await updateDoc(doc(db, "users", targetUid), { clanId: null });
                                        }
                                        toast.error(`${mNickname} исключен из клана`);
                                      }
                                    }}
                                    className="p-1.5 bg-red-500/10 border border-red-500/20 rounded text-red-500 hover:bg-red-500 hover:text-red-950 transition-all"
                                    title="Исключить"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {clanTab === "manage" && (
                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
                      <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                        <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-4 flex items-center gap-2">
                          <Shield className="w-3 h-3" /> Герб клана
                        </h4>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-16 h-16 rounded-full bg-zinc-900/80 border border-white/5 flex items-center justify-center overflow-hidden">
                            {clanAvatarUrl || clan.avatarUrl ? (
                              <img src={clanAvatarUrl || clan.avatarUrl} alt="Crest" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Shield className="w-8 h-8 text-zinc-600" />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <input 
                              type="text" 
                              placeholder="URL герба..."
                              value={clanAvatarUrl}
                              onChange={(e) => setClanAvatarUrl(e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-lime-400/50 transition-colors"
                            />
                            <button 
                              onClick={async () => {
                                await updateDoc(doc(db, "clans", clanId!), { avatarUrl: clanAvatarUrl });
                                toast.success("Герб обновлен");
                              }}
                              className="w-full py-1.5 bg-lime-400/20 border border-lime-400/50 rounded-lg text-lime-300 text-[10px] font-bold uppercase tracking-widest hover:bg-lime-400/30 transition-all"
                            >
                              Сохранить герб
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                        <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-4 flex items-center gap-2">
                          <Settings className="w-3 h-3" /> Настройки вступления
                        </h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-zinc-200">Минимальный уровень</p>
                              <p className="text-[10px] text-zinc-500">Порог для вступления</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => setClanMinLevel(Math.max(1, clanMinLevel - 1))} className="p-1 bg-white/5 rounded border border-white/5 text-zinc-400">-</button>
                              <span className="text-sm font-bold text-lime-300 w-6 text-center">{clanMinLevel}</span>
                              <button onClick={() => setClanMinLevel(Math.min(85, clanMinLevel + 1))} className="p-1 bg-white/5 rounded border border-white/5 text-zinc-400">+</button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-zinc-200">Закрытый клан</p>
                              <p className="text-[10px] text-zinc-500">Только по приглашению</p>
                            </div>
                            <button 
                              onClick={() => setIsClanPrivate(!isClanPrivate)}
                              className={`w-10 h-5 rounded-full relative transition-colors ${isClanPrivate ? 'bg-lime-400' : 'bg-zinc-900/80'}`}
                            >
                              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isClanPrivate ? 'left-6' : 'left-1'}`} />
                            </button>
                          </div>
                          <button 
                            onClick={async () => {
                              await updateDoc(doc(db, "clans", clanId!), { 
                                settings: { minLevel: clanMinLevel, isPrivate: isClanPrivate } 
                              });
                              toast.success("Настройки сохранены");
                            }}
                            className="w-full py-2 bg-lime-400 text-lime-950 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-lime-300 transition-all"
                          >
                            Применить настройки
                          </button>
                        </div>
                      </div>

                      <div className="bg-red-900/10 border border-red-500/20 rounded-2xl p-4">
                        <h4 className="text-[10px] uppercase tracking-widest text-red-400 font-bold mb-2 flex items-center gap-2">
                          <Ban className="w-3 h-3" /> Опасная зона
                        </h4>
                        <p className="text-[10px] text-zinc-500 mb-4">Расформирование клана удалит все данные без возможности восстановления.</p>
                        <button 
                          onClick={async () => {
                            if (confirm("ВЫ УВЕРЕНЫ? Клан будет удален навсегда!")) {
                              // 1. Remove clanId from all members
                              for (const member of clan.members) {
                                const mUid = member.uid;
                                if (mUid) {
                                  await updateDoc(doc(db, "users", mUid), { clanId: null });
                                }
                              }
                              // 2. Delete clan doc
                              await deleteDoc(doc(db, "clans", clanId!));
                              setClanId(null);
                              setClan(null);
                              toast.error("Клан расформирован");
                            }
                          }}
                          className="w-full py-2 border border-red-500/50 rounded-2xl text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                        >
                          Расформировать клан
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-zinc-900/80 border border-white/5 flex items-center justify-center mb-4">
                      <Users className="w-8 h-8 text-zinc-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Вы не состоите в клане</h3>
                    <p className="text-zinc-400 text-sm">Вступайте в клан, чтобы участвовать в битвах и получать бонусы!</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {isCreatingClan ? (
                      // ... (existing creation UI)
                      <div className="bg-white/5  border border-white/5 rounded-2xl p-3 flex flex-col gap-2">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Название клана</label>
                          <input 
                            type="text"
                            value={newClanNameInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") {
                                setNewClanNameInput(val);
                                return;
                              }
                              if (val.length > 20) return;
                              if ((val.match(/ /g) || []).length > 5) return;
                              if (!/^[A-Za-zА-Яа-яЁё\s]+$/.test(val)) return;
                              const hasEnglish = /[A-Za-z]/.test(val);
                              const hasRussian = /[А-Яа-яЁё]/.test(val);
                              if (hasEnglish && hasRussian) return;
                              setNewClanNameInput(val);
                            }}
                            placeholder="Введите название..."
                            className="bg-black/40 border border-white/5 rounded-2xl px-3 py-2 text-white focus:outline-none focus:border-lime-400/50 transition-colors"
                          />
                          {newClanNameInput.length > 0 && newClanNameInput.replace(/ /g, '').length < 5 && (
                            <p className="text-red-400 text-[10px]">Минимум 5 букв</p>
                          )}
                          {existingClans.some(c => c.name.toLowerCase() === newClanNameInput.trim().toLowerCase()) && (
                            <p className="text-lime-300 text-[10px]">Клан с таким названием уже существует. Вы можете вступить в него бесплатно через поиск.</p>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={async () => {
                              const name = newClanNameInput.trim();
                              if (name.replace(/ /g, '').length >= 5) {
                                if (existingClans.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                                  setIsCreatingClan(false);
                                  setIsJoiningClan(true);
                                  setClanSearchQuery(name);
                                  return;
                                }
                                if (silver >= 1000) {
                                  try {
                                    const user = auth.currentUser;
                                    const docId = user ? user.uid : playerName;
                                    
                                    // Create clan document
                                    await setDoc(doc(db, "clans", name), {
                                      name,
                                      level: 1,
                                      members: [{ uid: docId, nickname: playerName, role: 'leader' }],
                                      leader: playerName,
                                      description: "Новый клан",
                                      avatarUrl: "",
                                      settings: {
                                        minLevel: 1,
                                        isPrivate: false
                                      }
                                    });
                                    
                                    // Update user
                                    await setDoc(doc(db, "users", docId), { 
                                      clanId: name,
                                      silver: silver - 1000 
                                    }, { merge: true });
                                    
                                    setSilver(prev => prev - 1000);
                                    setClanId(name);
                                    setIsCreatingClan(false);
                                    setNewClanNameInput("");
                                    toast.success(`Клан ${name} создан!`);
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.WRITE, `clans/${name}`);
                                  }
                                }
                              }
                            }}
                            disabled={(silver < 1000 && !existingClans.some(c => c.name.toLowerCase() === newClanNameInput.trim().toLowerCase())) || newClanNameInput.replace(/ /g, '').length < 5}
                            className={`flex-1 py-2 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all ${
                              (silver >= 1000 || existingClans.some(c => c.name.toLowerCase() === newClanNameInput.trim().toLowerCase())) && newClanNameInput.replace(/ /g, '').length >= 5
                                ? "bg-lime-400 text-lime-950 hover:bg-lime-300"
                                : "bg-zinc-900/80 text-zinc-600 cursor-not-allowed"
                            }`}
                          >
                            {existingClans.some(c => c.name.toLowerCase() === newClanNameInput.trim().toLowerCase()) ? "Найти клан" : "Создать (1000 С)"}
                          </button>
                          <button 
                            onClick={() => {
                              setIsCreatingClan(false);
                              setNewClanNameInput("");
                            }}
                            className="px-3 py-2 bg-white/5 border border-white/5 rounded-2xl text-zinc-300 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                          >
                            Отмена
                          </button>
                        </div>
                        {silver < 1000 && (
                          <p className="text-red-400 text-[10px] text-center">Недостаточно серебра</p>
                        )}
                      </div>
                    ) : isJoiningClan ? (
                      <div className="bg-white/5  border border-white/5 rounded-2xl p-3 flex flex-col gap-2">
                        <div className="flex flex-col gap-2">
                          <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Поиск клана</h4>
                          <input 
                            type="text"
                            value={clanSearchQuery}
                            onChange={(e) => setClanSearchQuery(e.target.value)}
                            placeholder="Название клана..."
                            className="bg-black/40 border border-white/5 rounded-2xl px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500/50 transition-colors"
                          />
                        </div>
                        <div className="max-h-60 overflow-y-auto pr-2 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-white/10">
                          {existingClans
                            .filter(c => c.name.toLowerCase().includes(clanSearchQuery.toLowerCase()))
                            .map((clanItem, idx) => (
                            <button
                              key={idx}
                              onClick={async () => {
                                try {
                                  const user = auth.currentUser;
                                  const docId = user ? user.uid : playerName;
                                  
                                  // Update user
                                  await setDoc(doc(db, "users", docId), { clanId: clanItem.name }, { merge: true });
                                  
                                  // Update clan members
                                  const clanDoc = await getDoc(doc(db, "clans", clanItem.name));
                                  if (clanDoc.exists()) {
                                    const currentMembers = clanDoc.data().members || [];
                                    const isAlreadyMember = currentMembers.some((m: any) => m.uid === docId || m.nickname === playerName);
                                    if (!isAlreadyMember) {
                                      await updateDoc(doc(db, "clans", clanItem.name), { 
                                        members: [...currentMembers, { uid: docId, nickname: playerName, role: 'member' }] 
                                      });
                                    }
                                  }

                                  setClanId(clanItem.name);
                                  setIsJoiningClan(false);
                                  setClanSearchQuery("");
                                  toast.success(`Вы вступили в клан ${clanItem.name}`);
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.UPDATE, `clans/${clanItem.name}`);
                                }
                              }}
                              className="w-full p-4 bg-white/5 border border-white/5 rounded-2xl text-left hover:bg-white/10 hover:border-green-500/30 transition-all group flex items-center justify-between"
                            >
                              <div className="flex flex-col">
                                <span className="font-bold text-white group-hover:text-green-400 transition-colors">{clanItem.name}</span>
                                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                  <Users className="w-2 h-2" /> {clanItem.members} участников
                                </span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-green-400 transition-all group-hover:translate-x-1" />
                            </button>
                          ))}
                        </div>
                        <button 
                          onClick={() => {
                            setIsJoiningClan(false);
                            setClanSearchQuery("");
                          }}
                          className="w-full py-2 bg-white/5 border border-white/5 rounded-2xl text-zinc-300 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Ваш клан</h4>
                          <span className="text-[10px] text-zinc-600 font-mono">ID: {Math.floor(1000 + Math.random() * 9000)}</span>
                        </div>
                        
                        <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-zinc-900/80 flex items-center justify-center border border-white/5">
                            <Shield className="w-6 h-6 text-zinc-500" />
                          </div>
                          <div className="text-center">
                            <p className="text-zinc-500 text-xs italic">Вы не состоите в клане</p>
                            <p className="text-[10px] text-zinc-600 mt-1">Вступайте в кланы для совместных рейдов</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => setIsJoiningClan(true)}
                            className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/5 rounded-2xl text-zinc-300 text-xs font-bold uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all"
                          >
                            <Search className="w-3 h-3" /> Найти
                          </button>
                          <button 
                            onClick={() => setIsCreatingClan(true)}
                            className="flex items-center justify-center gap-2 py-3 bg-lime-400/10 border border-lime-400/20 rounded-2xl text-lime-400 text-xs font-bold uppercase tracking-widest hover:bg-lime-400/20 transition-all"
                          >
                            <Plus className="w-3 h-3" /> Создать
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {page === 11 && (
          <motion.div
            key="page11"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">⚙️ Настройки</h2>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Управление аккаунтом</p>
              </div>
              <button 
                onClick={() => setPage(2)}
                className="p-2 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-white/5 border border-white/5 rounded-3xl space-y-4">
                <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Интерфейс</h4>
                
                <button 
                  onClick={toggleFullscreen}
                  className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-900/80 rounded-lg group-hover:bg-zinc-700 transition-colors">
                      {isFullscreen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 group-hover:text-white transition-colors"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 group-hover:text-white transition-colors"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">
                        {isFullscreen ? "Свернуть" : "На весь экран"}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        {isFullscreen ? "Вернуться в оконный режим" : "Развернуть игру на весь экран"}
                      </p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors ${isFullscreen ? 'bg-lime-500' : 'bg-zinc-700'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isFullscreen ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>

              <div className="p-4 bg-white/5 border border-white/5 rounded-3xl space-y-4">
                <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Аккаунт</h4>
                
                <button 
                  onClick={async () => {
                    try {
                      // Clear local storage
                      localStorage.removeItem("rpg_is_logged_in");
                      localStorage.removeItem("rpg_has_completed_onboarding");
                      localStorage.removeItem("rpg_player_name");
                      localStorage.removeItem("rpg_player_gender");
                      localStorage.removeItem("rpg_player_race");
                      localStorage.removeItem("rpg_player_age");
                      localStorage.removeItem("rpg_player_birthday");
                      localStorage.removeItem("rpg_country");
                      localStorage.removeItem("rpg_character_status");
                      localStorage.removeItem("rpg_avatar_url");
                      localStorage.removeItem("rpg_clan_id");
                      
                      // Reset states
                      setIsLoggedIn(false);
                      setHasCompletedOnboarding(false);
                      setPlayerName("");
                      setRealName("");
                      setPlayerGender("male");
                      setPlayerRace("Человек");
                      setPlayerAge(0);
                      setPlayerBirthday("");
                      setCountry("");
                      setCharacterStatus("Новичок в этом мире...");
                      setAvatarUrl("");
                      setClanId(null);
                      setClan(null);
                      
                      // Redirect to login page
                      setPage(1);
                      
                      // Sign out from Firebase
                      await auth.signOut();
                      toast.success("Вы вышли из аккаунта");
                    } catch (error) {
                      console.error("Logout error:", error);
                      toast.error("Ошибка при выходе");
                    }
                  }}
                  className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-900/80 rounded-lg group-hover:bg-zinc-700 transition-colors">
                      <LogOut className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">Выйти с аккаунта</p>
                      <p className="text-[10px] text-zinc-500">Завершить текущую сессию</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </button>

                <button 
                  onClick={async () => {
                    if (window.confirm("Вы уверены, что хотите удалить аккаунт? Это действие необратимо.")) {
                      try {
                        const user = auth.currentUser;
                        if (user) {
                          // Delete user document from Firestore
                          await deleteDoc(doc(db, "users", user.uid));
                          // Delete user from Auth
                          await user.delete();
                          toast.success("Аккаунт успешно удален");
                        }
                      } catch (error) {
                        toast.error("Ошибка при удалении аккаунта. Возможно, требуется повторная авторизация.");
                      }
                    }
                  }}
                  className="w-full flex items-center justify-between p-4 bg-red-500/5 border border-red-500/10 rounded-2xl hover:bg-red-500/10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-950/50 rounded-lg group-hover:bg-red-900/50 transition-colors">
                      <Trash2 className="w-5 h-5 text-red-400 group-hover:text-red-300 transition-colors" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-red-400 group-hover:text-red-300 transition-colors">Удалить аккаунт</p>
                      <p className="text-[10px] text-red-500/70">Безвозвратное удаление данных</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-900 group-hover:text-red-700 transition-colors" />
                </button>
              </div>

              {(playerEmail === "alexeivasilev27081994@gmail.com" || playerEmail === "rdischat@gmail.com") && (
                <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-3xl space-y-4">
                  <h4 className="text-red-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-4 h-4" /> Панель Администратора
                  </h4>
                  
                  <button 
                    onClick={async () => {
                      if (window.confirm("ВНИМАНИЕ! Вы уверены, что хотите удалить ВСЕХ игроков? Это действие необратимо!")) {
                        try {
                          const usersSnapshot = await getDocs(collection(db, "users"));
                          const deletePromises = usersSnapshot.docs.map(d => deleteDoc(d.ref));
                          await Promise.all(deletePromises);
                          toast.success(`Успешно удалено ${usersSnapshot.size} игроков`);
                        } catch (error) {
                          console.error("Error deleting users:", error);
                          toast.error("Ошибка при удалении игроков");
                        }
                      }
                    }}
                    className="w-full flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-2xl hover:bg-red-500/20 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-950/80 rounded-lg group-hover:bg-red-900 transition-colors">
                        <Users className="w-5 h-5 text-red-400 group-hover:text-red-300 transition-colors" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-red-400 group-hover:text-red-300 transition-colors">Удалить всех игроков</p>
                        <p className="text-[10px] text-red-500/70">Очистить базу данных users</p>
                      </div>
                    </div>
                  </button>

                  <button 
                    onClick={async () => {
                      if (window.confirm("ВНИМАНИЕ! Вы уверены, что хотите удалить ВСЕ кланы? Это действие необратимо!")) {
                        try {
                          const clansSnapshot = await getDocs(collection(db, "clans"));
                          const deletePromises = clansSnapshot.docs.map(d => deleteDoc(d.ref));
                          await Promise.all(deletePromises);
                          toast.success(`Успешно удалено ${clansSnapshot.size} кланов`);
                        } catch (error) {
                          console.error("Error deleting clans:", error);
                          toast.error("Ошибка при удалении кланов");
                        }
                      }
                    }}
                    className="w-full flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-2xl hover:bg-red-500/20 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-950/80 rounded-lg group-hover:bg-red-900 transition-colors">
                        <Shield className="w-5 h-5 text-red-400 group-hover:text-red-300 transition-colors" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-red-400 group-hover:text-red-300 transition-colors">Удалить все кланы</p>
                        <p className="text-[10px] text-red-500/70">Очистить базу данных clans</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {page === 12 && (
          <motion.div
            key="page12"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">🛒 Магазин</h2>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Торговая лавка</p>
              </div>
              <div className="flex items-center gap-2">
                <LocationPlayers location="Магазин" userLocations={userLocations} currentUserId={auth.currentUser?.uid} />
                <button 
                  onClick={() => setPage(2)}
                  className="p-2 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
              </div>
            </div>

            {/* Shop Tabs */}
            <div className="flex gap-1 p-1 bg-black/40 rounded-3xl border border-white/5 mb-6 overflow-x-auto custom-scrollbar no-scrollbar">
              {[
                { id: 'equipment', label: 'Снаряжение', icon: Swords },
                { id: 'elixirs', label: 'Эликсиры', icon: FlaskConical },
                { id: 'books', label: 'Книги', icon: BookOpen },
                { id: 'chests', label: 'Сундуки', icon: Package },
                { id: 'diamonds', label: 'Алмазы', icon: Gem },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setShopTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                    shopTab === tab.id 
                      ? 'bg-lime-400 text-lime-950 shadow-lg shadow-lime-400/20' 
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="w-3 h-3" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Shop Content */}
            <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
              {SHOP_ITEMS[shopTab].map((item) => (
                <div 
                  key={item.id}
                  className="p-4 bg-white/5 border border-white/5 rounded-3xl flex items-center justify-between group hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                      item.rarity === 'legendary' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                      item.rarity === 'epic' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                      item.rarity === 'rare' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                      'bg-zinc-900/80 border-white/5 text-zinc-400'
                    }`}>
                      {shopTab === 'equipment' && (
                        item.type === 'Меч' ? <Swords className="w-6 h-6" /> :
                        item.type === 'Рубашка' ? <User className="w-6 h-6" /> :
                        item.type === 'Второе оружие' ? <Shield className="w-6 h-6" /> :
                        <Package className="w-6 h-6" />
                      )}
                      {shopTab === 'elixirs' && <FlaskConical className="w-6 h-6" />}
                      {shopTab === 'books' && <BookOpen className="w-6 h-6" />}
                      {shopTab === 'chests' && <Package className="w-6 h-6" />}
                      {shopTab === 'diamonds' && <Gem className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{item.name}</h4>
                      <p className="text-[10px] text-zinc-500">
                        {item.description || `${item.type} • Ур. ${item.level}`}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => buyItem(item)}
                    className="px-4 py-2 bg-lime-400/10 border border-lime-400/20 rounded-2xl text-lime-400 text-[10px] font-bold uppercase tracking-widest hover:bg-lime-400 hover:text-lime-950 transition-all flex items-center gap-2"
                  >
                    {item.cost} {item.currency === 'silver' ? <Coins className="w-3 h-3" /> : item.currency === 'gold' ? <Trophy className="w-3 h-3" /> : <Gem className="w-3 h-3" />}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {page === 18 && (
          <motion.div
            key="page18"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">👥 Друзья</h2>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Ваши соратники</p>
              </div>
              <button onClick={() => setPage(2)} className="p-2 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 hover:text-white transition-colors">
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            </div>

            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input 
                  type="text" 
                  placeholder="Найти игрока по никнейму..."
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                {friendSearch && (
                  <button 
                    onClick={async () => {
                      const nickname = friendSearch.trim();
                      if (!nickname) return;
                      try {
                        const usernameDoc = await getDoc(doc(db, "usernames", nickname));
                        if (usernameDoc.exists()) {
                          const targetUid = usernameDoc.data().uid;
                          const user = auth.currentUser;
                          if (user) {
                            const myId = user.uid;
                            const myDoc = await getDoc(doc(db, "users", myId));
                            if (myDoc.exists()) {
                              const currentFriends = myDoc.data().friends || [];
                              if (currentFriends.some((f: any) => f.nickname === nickname)) {
                                toast.error("Этот игрок уже в вашем списке друзей");
                                return;
                              }
                              const newFriends = [...currentFriends, { nickname, status: "online" }];
                              await updateDoc(doc(db, "users", myId), { friends: newFriends });
                              toast.success(`Игрок ${nickname} добавлен в друзья!`);
                              setFriendSearch("");
                            }
                          }
                        } else {
                          toast.error("Игрок с таким никнеймом не найден");
                        }
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, "users");
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-500 rounded-lg text-white"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
              {friends.length === 0 ? (
                <div className="text-center py-12 bg-white/5 rounded-3xl border border-dashed border-white/5">
                  <Users className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500 text-sm">У вас пока нет друзей</p>
                </div>
              ) : (
                friends.map((friend, idx) => (
                  <div key={idx} className="p-4 bg-white/5 border border-white/5 rounded-3xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-900/80 flex items-center justify-center border border-white/5">
                        <User className="w-6 h-6 text-zinc-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{friend.nickname}</h4>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${friend.status === 'online' ? 'bg-green-500' : 'bg-zinc-600'}`} />
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{friend.status === 'online' ? 'В сети' : 'Не в сети'}</span>
                        </div>
                      </div>
                    </div>
                    <button className="p-2 bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors">
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {page === 29 && (
          <motion.div
            key="page29"
            className="min-h-[100dvh] flex flex-col p-4 pb-24 text-zinc-100"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-white uppercase">Игроки онлайн</h2>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Всего: {onlineUsers.size}</p>
                </div>
              </div>
              <button 
                onClick={() => setPage(2)}
                className="w-10 h-10 rounded-xl glass-card border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {(Array.from(onlineUsers) as string[]).map(uid => {
                const profile = onlineUserProfiles[uid];
                const location = userLocations[uid] || "Неизвестно";
                if (!profile) return null;
                
                return (
                  <button 
                    key={uid}
                    onClick={() => viewPlayerProfile(uid)}
                    className="w-full glass-card p-3 border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl glass-card border border-white/10 flex items-center justify-center overflow-hidden">
                          <img 
                            src={profile.avatarUrl || "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f18c-776e-9828-56965684617a"}
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-lime-400">{profile.level}</span>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white group-hover:text-green-400 transition-colors">{profile.playerName}</span>
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        </div>
                        <div className="flex items-center gap-1 text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                          <MapPin className="w-2.5 h-2.5" />
                          {location}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
                  </button>
                );
              })}
              
              {onlineUsers.size === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <Users className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">Никого нет онлайн</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {page === 19 && (
          <motion.div
            key="page19"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">💬 Общий чат</h2>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Голос мира</p>
              </div>
              <button onClick={() => setPage(2)} className="p-2 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 hover:text-white transition-colors">
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 bg-black/40 rounded-3xl border border-white/5 mb-4 p-3 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                {chatMessages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
                    Сообщений пока нет...
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="flex gap-3 group cursor-pointer" onClick={() => {
                      // If we have a way to get UID from sender name, we could view profile
                      // For now, just a visual hint
                    }}>
                      <div className="w-8 h-8 rounded-lg bg-zinc-900/80 flex-shrink-0 overflow-hidden border border-white/5">
                        <img src={msg.avatarUrl || "https://via.placeholder.com/32"} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <div className="flex items-center gap-1">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${msg.isCreator ? 'text-amber-400' : msg.isAdmin ? 'text-red-400' : 'text-lime-300'}`}>
                              {msg.sender}
                            </span>
                            {msg.isCreator && <ShieldCheck className="w-2.5 h-2.5 text-amber-400" />}
                            {msg.isAdmin && !msg.isCreator && <Crown className="w-2.5 h-2.5 text-red-400" />}
                          </div>
                          <span className="text-[8px] text-zinc-600">{msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""}</span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Online Users List */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Сейчас в сети ({onlineUsers.size})</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                  {(Array.from(onlineUsers) as string[]).map(uid => {
                    // We don't have a map of UID to names here easily without fetching
                    // But we can show a placeholder or just the count for now
                    // Or better, let's just show the count and maybe a few names if we can
                    return null;
                  })}
                  <div className="flex -space-x-2 overflow-hidden">
                    {(Array.from(onlineUsers) as string[]).slice(0, 5).map((uid, i) => (
                      <div key={uid} className="inline-block h-6 w-6 rounded-full ring-2 ring-black bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-500">
                        {i + 1}
                      </div>
                    ))}
                    {onlineUsers.size > 5 && (
                      <div className="inline-block h-6 w-6 rounded-full ring-2 ring-black bg-zinc-900 flex items-center justify-center text-[8px] font-bold text-zinc-400">
                        +{onlineUsers.size - 5}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Написать сообщение..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                className="flex-1 bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-green-500/50 transition-colors"
              />
              <button 
                onClick={sendChatMessage}
                className="p-3 bg-green-500 rounded-2xl text-green-950 hover:bg-green-400 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {page === 20 && (
          <motion.div
            key="page20"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">📰 Новости</h2>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">События мира</p>
              </div>
              <button onClick={() => setPage(2)} className="p-2 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 hover:text-white transition-colors">
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {news.length === 0 ? (
                <div className="p-8 text-center bg-white/5 rounded-3xl border border-white/5">
                  <Newspaper className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500 text-sm">Новостей пока нет</p>
                </div>
              ) : (
                news.map((item) => (
                  <div key={item.id} className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="text-base font-bold text-lime-300">{item.title}</h3>
                        <span className="text-[10px] text-zinc-600 font-mono">{item.date}</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-zinc-400 leading-relaxed">{item.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {page === 21 && (
          <motion.div
            key="page21"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">🏛️ Форум</h2>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Обсуждения</p>
              </div>
              <button onClick={() => setPage(2)} className="p-2 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 hover:text-white transition-colors">
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1">
              {forumPosts.length === 0 ? (
                <div className="p-8 text-center bg-white/5 rounded-3xl border border-white/5">
                  <MessageCircle className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500 text-sm">На форуме пока пусто</p>
                </div>
              ) : (
                forumPosts.map((post) => (
                  <div key={post.id} className="p-4 bg-white/5 border border-white/5 rounded-3xl hover:bg-white/10 transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-sm font-bold text-white group-hover:text-lime-300 transition-colors">{post.title}</h3>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                        <MessageSquare className="w-3 h-3" /> {post.replies}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-lime-400 font-bold uppercase tracking-widest">{post.author}</span>
                      <span className="text-[10px] text-zinc-600">•</span>
                      <span className="text-[10px] text-zinc-600">{post.timestamp ? new Date(post.timestamp.seconds * 1000).toLocaleDateString() : ""}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button className="mt-4 w-full py-3 bg-lime-400 rounded-2xl text-lime-950 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              <PlusCircle className="w-5 h-5" /> Создать тему
            </button>
          </motion.div>
        )}

        {page === 22 && (
          <motion.div
            key="page22"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-center mb-8 relative mt-4">
              <button onClick={() => setPage(2)} className="absolute left-0 p-2 bg-white/5 rounded-full border border-white/5"><ChevronLeft className="w-6 h-6" /></button>
              <h2 className="text-lg font-bold uppercase tracking-widest w-full text-center text-orange-400">Дуэль 1 на 1</h2>
            </div>

            <div className="flex justify-center mb-4">
              <LocationPlayers location="Арена" userLocations={userLocations} currentUserId={auth.currentUser?.uid} />
            </div>

            <div className="flex-1 flex flex-col gap-4">
              <div className="p-6 bg-orange-900/10 border border-orange-500/20 rounded-3xl text-center">
                <Swords className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Арена Героев</h3>
                <p className="text-xs text-zinc-400">Сразитесь с другим игроком в честном поединке. Победитель забирает славу и награду!</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={joinMatchmaking}
                  className="w-full py-4 btn-primary"
                >
                  Найти противника
                </button>
                <button className="w-full py-4 btn-secondary">
                  Вызвать друга
                </button>
              </div>
              <div className="mt-auto p-4 bg-black/40 border border-white/5 rounded-2xl">
                <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Ваша статистика</h4>
                <div className="flex justify-between text-xs">
                  <span>Побед: 0</span>
                  <span>Поражений: 0</span>
                  <span>Рейтинг: 1000</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {page === 23 && (
          <motion.div
            key="page23"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-center mb-8 relative mt-4">
              <button onClick={() => setPage(2)} className="absolute left-0 p-2 bg-white/5 rounded-full border border-white/5"><ChevronLeft className="w-6 h-6" /></button>
              <h2 className="text-lg font-bold uppercase tracking-widest w-full text-center text-cyan-400">Битва отрядов</h2>
            </div>
            <div className="flex-1 flex flex-col gap-4">
              <div className="p-6 bg-cyan-900/10 border border-cyan-500/20 rounded-3xl text-center">
                <Users className="w-12 h-12 text-cyan-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Командный бой</h3>
                <p className="text-xs text-zinc-400">Соберите отряд из 4 человек и сразитесь против другого отряда. Командная работа - ключ к успеху!</p>
              </div>
              <div className="space-y-3">
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                  <h4 className="text-[10px] uppercase tracking-widest text-cyan-500 font-bold mb-3">Ваш отряд (1/4)</h4>
                  <div className="flex gap-2">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">{playerName[0]}</div>
                    <button className="w-10 h-10 rounded-lg bg-white/5 border border-dashed border-white/20 flex items-center justify-center text-zinc-600 hover:text-zinc-400 hover:border-white/40 transition-all"><Plus className="w-4 h-4" /></button>
                    <button className="w-10 h-10 rounded-lg bg-white/5 border border-dashed border-white/20 flex items-center justify-center text-zinc-600 hover:text-zinc-400 hover:border-white/40 transition-all"><Plus className="w-4 h-4" /></button>
                    <button className="w-10 h-10 rounded-lg bg-white/5 border border-dashed border-white/20 flex items-center justify-center text-zinc-600 hover:text-zinc-400 hover:border-white/40 transition-all"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
                <button 
                  onClick={joinSquadMatchmaking}
                  className="w-full py-4 bg-cyan-600 text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-cyan-500 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                >
                  Начать поиск игры
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {page === 24 && (
          <motion.div
            key="page24"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-center mb-8 relative mt-4">
              <button onClick={() => setPage(2)} className="absolute left-0 p-2 bg-white/5 rounded-full border border-white/5"><ChevronLeft className="w-6 h-6" /></button>
              <h2 className="text-lg font-bold uppercase tracking-widest w-full text-center text-red-500">Королевская битва</h2>
            </div>
            <div className="flex-1 flex flex-col gap-4">
              <div className="relative h-48 rounded-3xl overflow-hidden border border-red-500/30">
                <img src="https://picsum.photos/seed/battle/800/400" className="w-full h-full object-cover opacity-40" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col items-center justify-end pb-6">
                  <Trophy className="w-10 h-10 text-red-500 mb-2" />
                  <h3 className="text-xl font-bold text-white">Выживет только один</h3>
                  <p className="text-[10px] text-red-400 uppercase tracking-[0.2em] font-bold">50 игроков • 1 победитель</p>
                </div>
              </div>
              <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-2xl">
                <p className="text-xs text-zinc-300 leading-relaxed">Высаживайтесь на огромную карту, собирайте снаряжение и сражайтесь до последнего выжившего. Зона постоянно сужается!</p>
              </div>
              <button 
                onClick={joinBattleRoyaleMatchmaking}
                className="w-full py-5 bg-red-600 text-white rounded-2xl font-bold uppercase tracking-[0.3em] hover:bg-red-500 transition-all shadow-[0_0_30px_rgba(220,38,38,0.4)] animate-pulse"
              >
                В БОЙ!
              </button>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-center">
                  <span className="text-[8px] text-zinc-500 uppercase block mb-1">Ваш ранг</span>
                  <span className="text-sm font-bold text-white">Бронза III</span>
                </div>
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-center">
                  <span className="text-[8px] text-zinc-500 uppercase block mb-1">Очки сезона</span>
                  <span className="text-sm font-bold text-white">1250</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass-card border border-white/5 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/5 glass-card backdrop-blur-md sticky top-0 z-10 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Редактировать анкету</h2>
                  <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">Персональные данные героя</p>
                </div>
                <div className="flex items-center gap-1 text-cyan-400 font-bold bg-cyan-950/30 px-3 py-1 rounded-full border border-cyan-500/20">
                  <Gem className="w-4 h-4" /> {diamonds}
                </div>
              </div>

              <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                {/* Avatar Preview Section */}
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full border-2 border-lime-400/50 overflow-hidden bg-black/40 shadow-[0_0_20px_rgba(163,230,53,0.2)]">
                      <img 
                        src={tempAvatarUrl || (tempGender === 'male' 
                          ? "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f18c-776e-9828-56965684617a" 
                          : "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f1b2-7216-9828-56965684617a")} 
                        alt="Preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://via.placeholder.com/150?text=Error";
                        }}
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-lime-400 p-1.5 rounded-full border-2 border-zinc-900 text-lime-950">
                      <Pencil className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="w-full space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Ссылка на аватар</label>
                    <input 
                      type="text"
                      value={tempAvatarUrl}
                      onChange={(e) => setTempAvatarUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full bg-black/40 border border-white/5 rounded-2xl px-3 py-2 text-white text-sm focus:outline-none focus:border-lime-400/50 transition-all"
                    />
                  </div>
                  
                  <div className="w-full space-y-2 pt-2">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Или выберите из галереи</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix&backgroundColor=b6e3f4",
                        "https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka&backgroundColor=c0aede",
                        "https://api.dicebear.com/7.x/adventurer/svg?seed=Milo&backgroundColor=ffdfbf",
                        "https://api.dicebear.com/7.x/adventurer/svg?seed=Jude&backgroundColor=d1d4f9",
                        "https://api.dicebear.com/7.x/adventurer/svg?seed=Avery&backgroundColor=b6e3f4",
                        "https://api.dicebear.com/7.x/adventurer/svg?seed=Eden&backgroundColor=c0aede",
                        "https://api.dicebear.com/7.x/adventurer/svg?seed=Chase&backgroundColor=ffdfbf",
                        "https://api.dicebear.com/7.x/adventurer/svg?seed=Ryder&backgroundColor=d1d4f9",
                        "https://api.dicebear.com/7.x/adventurer/svg?seed=Oliver&backgroundColor=b6e3f4",
                        "https://api.dicebear.com/7.x/adventurer/svg?seed=Mia&backgroundColor=c0aede"
                      ].map((url, idx) => (
                        <button
                          key={idx}
                          onClick={() => setTempAvatarUrl(url)}
                          className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${tempAvatarUrl === url ? 'border-lime-400 scale-105 shadow-[0_0_15px_rgba(163,230,53,0.3)]' : 'border-white/10 hover:border-white/30 opacity-70 hover:opacity-100'}`}
                        >
                          <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Identity Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <div className="h-px flex-1 bg-white/5"></div>
                    <span className="text-[10px] uppercase tracking-widest font-black">Идентификация</span>
                    <div className="h-px flex-1 bg-white/5"></div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex justify-between">
                      <span>Никнейм</span>
                      {tempUsername !== playerName && <span className="text-lime-300">Стоимость: 50 алмазов</span>}
                    </label>
                    <input 
                      type="text"
                      value={tempUsername}
                      onChange={(e) => setTempUsername(e.target.value)}
                      placeholder="Новый никнейм..."
                      className="w-full bg-black/40 border border-white/5 rounded-2xl px-3 py-2 text-white text-sm focus:outline-none focus:border-lime-400/50"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{tempGender === 'male' ? 'Имя героя' : 'Имя героини'}</label>
                    <div className="relative">
                      <input 
                        type="text"
                        value={tempRealName}
                        onChange={(e) => setTempRealName(e.target.value)}
                        placeholder="Ваше имя..."
                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-3 py-2 pr-12 text-white text-sm focus:outline-none focus:border-lime-400/50"
                      />
                      <button 
                        onClick={() => setTempIsNameHidden(!tempIsNameHidden)}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${tempIsNameHidden ? 'text-lime-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title={tempIsNameHidden ? "Имя скрыто" : "Имя видно всем"}
                      >
                        {tempIsNameHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Personal Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <div className="h-px flex-1 bg-white/5"></div>
                    <span className="text-[10px] uppercase tracking-widest font-black">Личные данные</span>
                    <div className="h-px flex-1 bg-white/5"></div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Пол</label>
                      <div className="grid grid-cols-2 gap-1 bg-black/40 p-1 rounded-2xl border border-white/5">
                        <button 
                          onClick={() => setTempGender("male")}
                          className={`py-1.5 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest ${tempGender === 'male' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          М
                        </button>
                        <button 
                          onClick={() => setTempGender("female")}
                          className={`py-1.5 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest ${tempGender === 'female' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          Ж
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Раса</label>
                      <select
                        value={tempRace}
                        onChange={(e) => setTempRace(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-lime-400/50 appearance-none"
                      >
                        <option value="Человек">Человек</option>
                        <option value="Эльф">Эльф</option>
                        <option value="Гном">Гном</option>
                        <option value="Орк">Орк</option>
                        <option value="Нежить">Нежить</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex justify-between">
                      <span>День рождения</span>
                      <span className="text-[8px] text-zinc-600">ДД.ММ.ГГГГ</span>
                    </label>
                    <div className="relative">
                      <input 
                        type="text"
                        value={tempBirthday}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^0-9.]/g, '');
                          if (val.length === 2 && !val.includes('.')) val += '.';
                          if (val.length === 5 && val.split('.').length === 2) val += '.';
                          if (val.length > 10) val = val.substring(0, 10);
                          setTempBirthday(val);
                        }}
                        placeholder="01.01.2000"
                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-3 py-2 pr-12 text-white text-sm focus:outline-none focus:border-lime-400/50"
                      />
                      <button 
                        onClick={() => setTempIsBirthdayHidden(!tempIsBirthdayHidden)}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${tempIsBirthdayHidden ? 'text-lime-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {tempIsBirthdayHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Страна</label>
                    <div className="relative">
                      <select 
                        value={tempCountry}
                        onChange={(e) => setTempCountry(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-3 py-2 text-white text-sm focus:outline-none focus:border-lime-400/50 appearance-none"
                      >
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button 
                        onClick={() => setTempIsCountryHidden(!tempIsCountryHidden)}
                        className={`absolute right-10 top-1/2 -translate-y-1/2 transition-colors ${tempIsCountryHidden ? 'text-lime-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {tempIsCountryHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <div className="h-px flex-1 bg-white/5"></div>
                    <span className="text-[10px] uppercase tracking-widest font-black">О себе</span>
                    <div className="h-px flex-1 bg-white/5"></div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Статус персонажа</label>
                    <textarea 
                      value={tempStatus}
                      onChange={(e) => setTempStatus(e.target.value)}
                      placeholder="Расскажите о своем герое..."
                      className="w-full bg-black/40 border border-white/5 rounded-2xl px-3 py-2 text-white text-sm focus:outline-none focus:border-lime-400/50 h-24 resize-none custom-scrollbar"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/5 glass-card sticky bottom-0 z-10">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    className="w-full py-3 rounded-2xl bg-zinc-900/80 text-zinc-400 font-bold uppercase tracking-widest hover:bg-zinc-700 transition-all border border-white/5"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={async () => {
                      const regex = /^[a-zA-Z\s]+$|^[а-яА-ЯёЁ\s]+$/;
                      if (tempRealName && !regex.test(tempRealName)) {
                        toast.error("Имя должно содержать только буквы (либо русский, либо английский)");
                        return;
                      }

                      // Birthday validation
                      const bdayRegex = /^\d{2}\.\d{2}\.\d{4}$/;
                      if (tempBirthday && !bdayRegex.test(tempBirthday)) {
                        toast.error("Дата рождения должна быть в формате ДД.ММ.ГГГГ");
                        return;
                      }

                      // Calculate age from birthday
                      let newAge = playerAge;
                      if (tempBirthday && bdayRegex.test(tempBirthday)) {
                        const [day, month, year] = tempBirthday.split('.').map(Number);
                        const birthDate = new Date(year, month - 1, day);
                        const today = new Date();
                        newAge = today.getFullYear() - birthDate.getFullYear();
                        const m = today.getMonth() - birthDate.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                          newAge--;
                        }
                      }

                      let finalUsername = playerName;

                      // Username change logic
                      if (tempUsername !== playerName) {
                        if (diamonds < 50) {
                          toast.error("Недостаточно алмазов для смены никнейма (нужно 50)");
                          return;
                        }
                        if (tempUsername.length < 4 || tempUsername.length > 12 || !/^[a-zA-Z]+$/.test(tempUsername)) {
                          toast.error("Никнейм должен содержать от 4 до 12 английских букв");
                          return;
                        }
                        
                        try {
                          const usernameDoc = await getDoc(doc(db, "usernames", tempUsername));
                          if (usernameDoc.exists()) {
                            toast.error("Этот никнейм уже занят");
                            return;
                          }
                        } catch (error: any) {
                          handleFirestoreError(error, OperationType.GET, `usernames/${tempUsername}`);
                        }

                        const user = auth.currentUser;
                        if (user) {
                          try {
                            await setDoc(doc(db, "users", user.uid), {
                              username: tempUsername
                            }, { merge: true });
                            await setDoc(doc(db, "usernames", tempUsername), { uid: user.uid });
                          } catch (error: any) {
                            handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
                          }
                        }
                        
                        setDiamonds(prev => prev - 50);
                        // Update Firestore
                        if (user) {
                          await savePlayerData(user.uid, {
                            playerName: finalUsername,
                            realName: tempRealName,
                            playerRace: tempRace,
                            playerGender: tempGender,
                            playerAge: newAge,
                            playerBirthday: tempBirthday,
                            country: tempCountry,
                            characterStatus: tempStatus,
                            avatarUrl: tempAvatarUrl,
                            isNameHidden: tempIsNameHidden,
                            isAgeHidden: tempIsAgeHidden,
                            isBirthdayHidden: tempIsBirthdayHidden,
                            isCountryHidden: tempIsCountryHidden
                          });
                        }
                        
                        finalUsername = tempUsername;
                      }

                      setRealName(tempRealName);
                      setPlayerRace(tempRace);
                      setPlayerGender(tempGender);
                      setPlayerAge(newAge);
                      setPlayerBirthday(tempBirthday);
                      setCountry(tempCountry);
                      setCharacterStatus(tempStatus);
                      setAvatarUrl(tempAvatarUrl);
                      setIsNameHidden(tempIsNameHidden);
                      setIsAgeHidden(tempIsAgeHidden);
                      setIsBirthdayHidden(tempIsBirthdayHidden);
                      setIsCountryHidden(tempIsCountryHidden);

                      const user = auth.currentUser;
                      const finalAvatarUrl = tempAvatarUrl || (tempGender === 'male' 
                        ? "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f18c-776e-9828-56965684617a" 
                        : "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f1b2-7216-9828-56965684617a");
                      
                      if (user) {
                        try {
                          await setDoc(doc(db, "users", user.uid), {
                            race: tempRace,
                            gender: tempGender,
                            avatarUrl: finalAvatarUrl,
                            realName: tempRealName,
                            country: tempCountry,
                            birthday: tempBirthday,
                            age: newAge,
                            status: tempStatus,
                            isNameHidden: tempIsNameHidden,
                            isAgeHidden: tempIsAgeHidden,
                            isBirthdayHidden: tempIsBirthdayHidden,
                            isCountryHidden: tempIsCountryHidden
                          }, { merge: true });
                          setAvatarUrl(finalAvatarUrl);
                        } catch (error: any) {
                          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
                        }
                      } else if (playerName) {
                        try {
                          await setDoc(doc(db, "users", playerName), {
                            race: tempRace,
                            gender: tempGender,
                            avatarUrl: finalAvatarUrl,
                            realName: tempRealName,
                            country: tempCountry,
                            birthday: tempBirthday,
                            age: newAge,
                            status: tempStatus,
                            isNameHidden: tempIsNameHidden,
                            isAgeHidden: tempIsAgeHidden,
                            isBirthdayHidden: tempIsBirthdayHidden,
                            isCountryHidden: tempIsCountryHidden
                          }, { merge: true });
                          setAvatarUrl(finalAvatarUrl);
                        } catch (error: any) {
                          handleFirestoreError(error, OperationType.UPDATE, `users/${playerName}`);
                        }
                      }

                      setIsEditingProfile(false);
                      toast.success("Анкета успешно обновлена!");
                    }}
                    className="w-full py-3 rounded-2xl bg-lime-400 text-lime-950 font-bold uppercase tracking-widest hover:bg-lime-300 transition-all shadow-[0_0_20px_rgba(163,230,53,0.2)] border border-lime-300/50"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        {showOnboarding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="glass-card border border-white/5 rounded-3xl p-6 w-full max-w-sm space-y-4">
              <h2 className="text-xl font-bold text-white">Добро пожаловать!</h2>
              <p className="text-zinc-400 text-sm">Введите никнейм (англ. буквы, 4-12 симв.) и ваше имя.</p>
              <div className="space-y-2">
                <input 
                  type="text"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl px-3 py-2 text-white"
                  placeholder="Никнейм"
                />
                <input 
                  type="text"
                  value={tempRealName}
                  onChange={(e) => setTempRealName(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl px-3 py-2 text-white"
                  placeholder="Ваше имя"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Раса</label>
                  <select 
                    value={tempRace}
                    onChange={(e) => setTempRace(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-2xl px-3 py-2 text-white text-sm focus:outline-none focus:border-lime-400/50 appearance-none"
                  >
                    <option value="Человек">Человек</option>
                    <option value="Эльф">Эльф</option>
                    <option value="Орк">Орк</option>
                    <option value="Гном">Гном</option>
                    <option value="Нежить">Нежить</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block text-center">Пол</label>
                  <div className="grid grid-cols-2 gap-2 character-select">
                    <button 
                      onClick={() => setTempGender("male")}
                      className={`flex flex-col items-center gap-2 p-2 rounded-2xl border-2 transition-all duration-300 ${tempGender === 'male' ? 'bg-blue-500/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-105' : 'bg-black/40 border-white/5 hover:border-white/20'}`}
                    >
                      <User className={`w-4 h-4 ${tempGender === 'male' ? 'text-blue-400' : 'text-zinc-500'}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${tempGender === 'male' ? 'text-blue-400' : 'text-zinc-500'}`}>М</span>
                    </button>
                    <button 
                      onClick={() => setTempGender("female")}
                      className={`flex flex-col items-center gap-2 p-2 rounded-2xl border-2 transition-all duration-300 ${tempGender === 'female' ? 'bg-pink-500/20 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.3)] scale-105' : 'bg-black/40 border-white/5 hover:border-white/20'}`}
                    >
                      <User className={`w-4 h-4 ${tempGender === 'female' ? 'text-pink-400' : 'text-zinc-500'}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${tempGender === 'female' ? 'text-pink-400' : 'text-zinc-500'}`}>Ж</span>
                    </button>
                  </div>
                </div>
              </div>
              <button 
                onClick={async () => {
                  if (tempUsername.length < 4 || tempUsername.length > 12 || !/^[a-zA-Z]+$/.test(tempUsername)) {
                    toast.error("Никнейм должен содержать от 4 до 12 английских букв");
                    return;
                  }
                  try {
                    const usernameDoc = await getDoc(doc(db, "usernames", tempUsername));
                    if (usernameDoc.exists()) {
                      toast.error("Этот никнейм уже занят");
                      return;
                    }
                  } catch (error: any) {
                    handleFirestoreError(error, OperationType.GET, `usernames/${tempUsername}`);
                  }
                  
                  const uniqueId = Math.floor(1000000 + Math.random() * 9000000).toString();
                  const newAvatarUrl = tempGender === 'male' 
                    ? "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f18c-776e-9828-56965684617a" 
                    : "https://storage.googleapis.com/test-media-genai-studio/antigravity-attachments/0195f001-f1b2-7216-9828-56965684617a";
                  
                  const user = auth.currentUser;
                  if (user) {
                    try {
                      const welcomeMessage = {
                        id: "welcome_" + Date.now(),
                        text: "Добро пожаловать в Nation of Light and Darkness! В качестве приветственного подарка мы дарим вам 10,000 серебра и 500 алмазов. Удачи в приключениях!",
                        date: new Date().toLocaleDateString(),
                        read: false,
                        claimable: {
                          silver: 10000,
                          diamonds: 500
                        },
                        claimed: false
                      };

                      await setDoc(doc(db, "users", user.uid), {
                        uid: user.uid,
                        username: tempUsername,
                        playerName: tempUsername,
                        realName: tempRealName,
                        uniqueId: uniqueId,
                        email: user.email,
                        password: "", // Google users don't have a password
                        createdAt: new Date().toISOString(),
                        race: tempRace,
                        gender: tempGender,
                        avatarUrl: newAvatarUrl,
                        level: 1,
                        stats: {
                          strength: 10,
                          agility: 10,
                          intuition: 10,
                          endurance: 10,
                          wisdom: 10
                        },
                        silver: 1000,
                        iron: 0,
                        gold: 0,
                        diamonds: 0,
                        xp: 0,
                        inventory: [],
                        booksInventory: [],
                        elixirsInventory: [],
                        chestsInventory: [],
                        equippedItems: {},
                        messages: [welcomeMessage],
                        forestProgress: 0,
                        blackWolfKills: 0,
                        spentStrength: 0,
                        spentAgility: 0,
                        spentIntuition: 0,
                        spentEndurance: 0,
                        spentWisdom: 0,
                        playerBadges: [],
                        playerStatus: "Новичок"
                      });
                      await setDoc(doc(db, "usernames", tempUsername), { uid: user.uid });
                      
                      setMessages([welcomeMessage]);
                      
                      // Broadcast new player join
                      socket?.emit("global_message", {
                        type: "achievement",
                        message: `Новый игрок ${tempUsername} присоединился к миру!`,
                        playerName: tempUsername
                      });
                      toast.success("Аккаунт создан! Проверьте почту для получения подарка.");
                    } catch (error: any) {
                      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
                    }
                    setPlayerName(tempUsername);
                    setRealName(tempRealName);
                    setPlayerEmail(user.email || "");
                    setPlayerRace(tempRace);
                    setPlayerGender(tempGender);
                    setAvatarUrl(newAvatarUrl);
                    setIsLoggedIn(true);
                    setHasCompletedOnboarding(true);
                    setShowOnboarding(false);
                    setPage(2);
                  }
                }}
                className="btn-secondary w-full"
              >
                Сохранить
              </button>
            </div>
          </div>
        )}
        {page === 25 && (
          <motion.div
            key="page25"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* PvP Battle Header */}
            <div className="flex items-center mb-8 relative mt-4">
              <button 
                onClick={() => {
                  setPage(22);
                  setCurrentBattleId(null);
                  setPvpBattle(null);
                }} 
                className="absolute left-0 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5 z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-serif tracking-widest w-full text-center text-red-500 uppercase">PvP Поединок</h2>
            </div>

            {/* PvP Battle Arena */}
            {pvpBattle ? (
              <div className="flex-1 flex flex-col gap-8">
                <div className="flex flex-row items-center justify-between gap-2 px-2">
                  {/* Player 1 */}
                  <div className="flex flex-col items-center gap-2 w-5/12">
                    <div className={`w-20 h-20 rounded-full bg-zinc-900/80 border ${pvpBattle.turn === pvpBattle.player1Id ? 'border-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.3)]' : 'border-white/5'} flex items-center justify-center relative`}>
                      <User className="w-10 h-10 text-zinc-400" />
                      <div className="absolute -bottom-2 bg-black/80 px-2 py-0.5 rounded border border-white/5 text-[8px] font-bold uppercase">
                        {pvpBattle.player1Name}
                      </div>
                    </div>
                    <div className="w-full bg-black/50 rounded-full h-2 border border-white/5 overflow-hidden">
                      <div className={`h-full transition-all duration-500 ${getHealthColor(pvpBattle.player1Health, pvpBattle.player1MaxHealth)}`} style={{ width: `${(pvpBattle.player1Health / pvpBattle.player1MaxHealth) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-mono">{pvpBattle.player1Health} / {pvpBattle.player1MaxHealth}</span>
                  </div>

                  <div className="text-zinc-500 font-serif italic">vs</div>

                  {/* Player 2 */}
                  <div className="flex flex-col items-center gap-2 w-5/12">
                    <div className={`w-20 h-20 rounded-full bg-zinc-900/80 border ${pvpBattle.turn === pvpBattle.player2Id ? 'border-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.3)]' : 'border-white/5'} flex items-center justify-center relative`}>
                      <User className="w-10 h-10 text-zinc-400" />
                      <div className="absolute -bottom-2 bg-black/80 px-2 py-0.5 rounded border border-white/5 text-[8px] font-bold uppercase">
                        {pvpBattle.player2Name}
                      </div>
                    </div>
                    <div className="w-full bg-black/50 rounded-full h-2 border border-white/5 overflow-hidden">
                      <div className={`h-full transition-all duration-500 ${getHealthColor(pvpBattle.player2Health, pvpBattle.player2MaxHealth)}`} style={{ width: `${(pvpBattle.player2Health / pvpBattle.player2MaxHealth) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-mono">{pvpBattle.player2Health} / {pvpBattle.player2MaxHealth}</span>
                  </div>
                </div>

                {/* PvP Actions */}
                <div className="flex flex-col gap-3">
                  {pvpBattle.turn === (auth.currentUser?.uid || playerName) ? (
                    <div className="grid grid-cols-1 gap-2">
                      <motion.button
                        onClick={async () => {
                          const isP1 = pvpBattle.player1Id === (auth.currentUser?.uid || playerName);
                          const dmg = Math.floor(Math.random() * 50) + 50 + currentLevel * 5;
                          const newLogs = [...pvpBattle.logs, `${playerName} наносит ${dmg} урона!`];
                          
                          const updateData: any = {
                            logs: newLogs.slice(-10),
                            turn: isP1 ? pvpBattle.player2Id : pvpBattle.player1Id,
                            lastActionTimestamp: Date.now()
                          };
                          
                          if (isP1) {
                            updateData.player2Health = Math.max(0, pvpBattle.player2Health - dmg);
                          } else {
                            updateData.player1Health = Math.max(0, pvpBattle.player1Health - dmg);
                          }
                          
                          if (updateData.player1Health === 0 || updateData.player2Health === 0) {
                            updateData.status = "finished";
                            updateData.winnerId = auth.currentUser?.uid || playerName;
                          }
                          
                          await updateDoc(doc(db, "battles_1v1", currentBattleId!), updateData);
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full py-3 rounded-2xl bg-red-500/20 border border-red-500/50 text-red-100 font-bold uppercase tracking-widest"
                      >
                        Атаковать
                      </motion.button>
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/5 animate-pulse">
                      <p className="text-zinc-400 text-sm">Ожидание хода противника...</p>
                    </div>
                  )}
                </div>

                {/* PvP Logs */}
                <div className="mt-auto h-32 bg-black/40 border border-white/5 rounded-2xl p-3 overflow-y-auto font-mono text-[10px] flex flex-col gap-1">
                  {pvpBattle.logs.map((log: string, i: number) => (
                    <div key={i} className="text-zinc-300">&gt; {log}</div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
              </div>
            )}
          </motion.div>
        )}

        {page === 28 && isAdmin && (
          <motion.div
            key="page28"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-center mb-8 relative mt-4">
              <button 
                onClick={() => setPage(2)} 
                className="absolute left-0 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-bold uppercase tracking-widest w-full text-center text-red-500">Админ Панель</h2>
            </div>

            <div className="flex-1 flex flex-col gap-6">
              {/* Player Management Section */}
              <div className="glass-card p-4 border-red-500/20">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" /> Управление игроками
                </h3>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input 
                      id="admin-player-search"
                      type="text" 
                      placeholder="Имя игрока..."
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={async () => {
                        const name = (document.getElementById('admin-player-search') as HTMLInputElement).value.trim();
                        if (!name) { toast.error("Введите имя"); return; }
                        try {
                          const userDoc = await getDoc(doc(db, "users", name));
                          if (userDoc.exists()) {
                            const data = userDoc.data();
                            const currentRoles = data.roles || [];
                            const isTargetAdmin = currentRoles.includes('admin');
                            const newRoles = isTargetAdmin 
                              ? currentRoles.filter((r: string) => r !== 'admin')
                              : [...currentRoles, 'admin'];
                            await updateDoc(doc(db, "users", name), { roles: newRoles });
                            toast.success(`Админ для ${name}: ${!isTargetAdmin ? 'ВКЛ' : 'ВЫКЛ'}`);
                          } else { toast.error("Игрок не найден"); }
                        } catch (err) { toast.error("Ошибка"); }
                      }}
                      className="py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-colors"
                    >
                      Админ +/-
                    </button>
                    <button 
                      onClick={async () => {
                        const name = (document.getElementById('admin-player-search') as HTMLInputElement).value.trim();
                        if (!name) { toast.error("Введите имя"); return; }
                        try {
                          const userDoc = await getDoc(doc(db, "users", name));
                          if (userDoc.exists()) {
                            const data = userDoc.data();
                            const currentRoles = data.roles || [];
                            const isTargetCreator = currentRoles.includes('creator');
                            const newRoles = isTargetCreator 
                              ? currentRoles.filter((r: string) => r !== 'creator')
                              : [...currentRoles, 'creator'];
                            await updateDoc(doc(db, "users", name), { roles: newRoles });
                            toast.success(`Создатель для ${name}: ${!isTargetCreator ? 'ВКЛ' : 'ВЫКЛ'}`);
                          } else { toast.error("Игрок не найден"); }
                        } catch (err) { toast.error("Ошибка"); }
                      }}
                      className="py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold hover:bg-amber-500/20 transition-colors"
                    >
                      Создатель +/-
                    </button>
                  </div>
                </div>
              </div>

              {/* Item Spawner Section */}
              <div className="glass-card p-4 border-red-500/20">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                  <Backpack className="w-4 h-4 text-purple-400" /> Спавнер предметов
                </h3>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    {['equipment', 'elixirs', 'books', 'chests'].map(cat => (
                      <button 
                        key={cat}
                        onClick={() => {
                          const items = SHOP_ITEMS[cat] || [];
                          if (items.length > 0) {
                            const randomItem = items[Math.floor(Math.random() * items.length)];
                            if (cat === 'equipment') {
                              setInventory(prev => [...prev, { ...randomItem, id: `${randomItem.id}_${Date.now()}` }]);
                            } else if (cat === 'elixirs') {
                              setElixirsInventory(prev => {
                                const existing = prev.find(i => i.id === randomItem.id);
                                if (existing) return prev.map(i => i.id === randomItem.id ? { ...i, count: (i.count || 1) + 1 } : i);
                                return [...prev, { ...randomItem, count: 1 }];
                              });
                            } else if (cat === 'books') {
                              setBooksInventory(prev => {
                                const existing = prev.find(i => i.id === randomItem.id);
                                if (existing) return prev.map(i => i.id === randomItem.id ? { ...i, count: (i.count || 1) + 1 } : i);
                                return [...prev, { ...randomItem, count: 1 }];
                              });
                            } else if (cat === 'chests') {
                              setChestsInventory(prev => {
                                const existing = prev.find(i => i.id === randomItem.id);
                                if (existing) return prev.map(i => i.id === randomItem.id ? { ...i, count: (i.count || 1) + 1 } : i);
                                return [...prev, { ...randomItem, count: 1 }];
                              });
                            }
                            toast.success(`Выдан предмет: ${randomItem.name}`);
                          }
                        }}
                        className="py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold hover:bg-white/10 transition-colors capitalize"
                      >
                        Случ. {cat}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => {
                      const legendary = SHOP_ITEMS.equipment.filter(i => i.rarity === 'legendary');
                      if (legendary.length > 0) {
                        const item = legendary[Math.floor(Math.random() * legendary.length)];
                        setInventory(prev => [...prev, { ...item, id: `${item.id}_${Date.now()}` }]);
                        toast.success(`Выдана легендарка: ${item.name}`);
                      }
                    }}
                    className="w-full py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold hover:bg-orange-500/20 transition-colors"
                  >
                    Выдать случайную легендарку
                  </button>
                </div>
              </div>

              {/* Resources Section */}
              <div className="glass-card p-4 border-red-500/20">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" /> Ресурсы
                </h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button 
                    onClick={() => setSilver(prev => prev + 100000)}
                    className="py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold hover:bg-white/10 transition-colors"
                  >
                    +100k Серебра
                  </button>
                  <button 
                    onClick={() => setGold(prev => prev + 1000)}
                    className="py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold hover:bg-white/10 transition-colors"
                  >
                    +1k Золота
                  </button>
                  <button 
                    onClick={() => setIron(prev => prev + 5000)}
                    className="py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold hover:bg-white/10 transition-colors"
                  >
                    +5k Железа
                  </button>
                  <button 
                    onClick={() => setDiamonds(prev => prev + 100)}
                    className="py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold hover:bg-white/10 transition-colors"
                  >
                    +100 Алмазов
                  </button>
                </div>
              </div>

              {/* Level Section */}
              <div className="glass-card p-4 border-red-500/20">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-lime-400" /> Уровень
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const nextLevelXp = XP_TABLE[currentLevel + 1] || 0;
                      setXp(nextLevelXp);
                    }}
                    className="flex-1 py-3 rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-400 text-xs font-bold hover:bg-lime-500/20 transition-colors"
                  >
                    Следующий уровень
                  </button>
                  <button 
                    onClick={() => setXp(0)}
                    className="flex-1 py-3 rounded-xl bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 text-xs font-bold hover:bg-zinc-500/20 transition-colors"
                  >
                    Сбросить XP
                  </button>
                </div>
              </div>

              {/* Global Message */}
              <div className="glass-card p-4 border-red-500/20">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-blue-400" /> Глобальное сообщение
                </h3>
                <div className="flex flex-col gap-2">
                  <input 
                    type="text" 
                    placeholder="Текст сообщения..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value;
                        if (val.trim() && socket) {
                          socket.emit("global_message", {
                            type: "achievement",
                            message: val,
                            sender: "Администратор"
                          });
                          e.currentTarget.value = "";
                          toast.success("Сообщение отправлено!");
                        }
                      }
                    }}
                  />
                  <p className="text-[9px] text-zinc-500 italic">Нажмите Enter для отправки всем игрокам</p>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="mt-auto glass-card p-4 border-red-500/40 bg-red-500/5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Опасная зона
                </h3>
                <button 
                  onClick={() => {
                    if (confirm("ВНИМАНИЕ! Это действие полностью сбросит ваш прогресс. Вы уверены?")) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors"
                >
                  Сбросить мой прогресс
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {page === 26 && (
          <motion.div
            key="page26"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center mb-8 relative mt-4">
              <button 
                onClick={() => setPage(9)} 
                className="absolute left-0 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-bold uppercase tracking-widest w-full text-center text-zinc-400">Поход в горы</h2>
            </div>

            <div className="flex justify-center mb-4">
              <LocationPlayers location="Горы" userLocations={userLocations} currentUserId={auth.currentUser?.uid} />
            </div>

            <div className="flex-1 flex flex-col gap-2">
              <p className="text-zinc-400 text-center mb-4">Выберите противника в горах:</p>
              
              {MOUNTAIN_ENEMIES.map((enemy, idx) => {
                const isUnlocked = mountainProgress >= idx;
                const isDefeated = mountainProgress > idx;
                
                return (
                  <motion.button
                    key={idx}
                    onClick={() => {
                      if (isUnlocked && !isDefeated) {
                        setPlayerHealth(maxPlayerHealth);
                        setWolfHealth(enemy.maxHealth);
                        setBattleLog([]);
                        setCurrentEnemy(enemy);
                        setPage(4);
                      }
                    }}
                    whileHover={isUnlocked && !isDefeated ? { scale: 1.02 } : {}}
                    whileTap={isUnlocked && !isDefeated ? { scale: 0.95 } : {}}
                    className={`w-full py-2 px-3 rounded-2xl  border transition-all duration-300 flex items-center justify-between ${
                      isDefeated 
                        ? "glass-card border-white/5 text-zinc-600 opacity-70" 
                        : isUnlocked 
                          ? "bg-zinc-900/80/20 border-zinc-400/30 text-zinc-100 hover:bg-zinc-900/80/40 shadow-[0_0_15px_rgba(255,255,255,0.05)]" 
                          : "bg-black/40 border-white/5 text-zinc-700 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Mountain className={`w-6 h-6 ${isDefeated ? 'text-zinc-700' : isUnlocked ? 'text-zinc-400' : 'text-zinc-800'}`} />
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{enemy.name}</span>
                          {enemy.name === "Горный дракон" && <Crown className="w-4 h-4 text-lime-300" />}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            currentLevel >= enemy.recLevel 
                              ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                              : 'bg-red-500/10 border-red-500/30 text-red-400'
                          }`}>
                            Ур. {enemy.recLevel}
                          </span>
                          {isUnlocked && !isDefeated && <span className="text-[10px] text-green-400/70 uppercase tracking-widest font-medium">Доступно</span>}
                          {isDefeated && <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">Побежден</span>}
                          {!isUnlocked && <span className="text-[10px] text-zinc-700 uppercase tracking-widest font-medium">Заблокировано</span>}
                        </div>
                      </div>
                    </div>
                    {isUnlocked && !isDefeated && <Swords className="w-5 h-5 text-zinc-400/50" />}
                    {isDefeated && <Lock className="w-5 h-5 text-zinc-700" />}
                    {!isUnlocked && <Lock className="w-5 h-5 text-zinc-800" />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
        {page === 27 && (
          <motion.div
            key="page27"
            className="min-h-[100dvh] flex flex-col p-3 pb-24 text-zinc-100 w-full max-w-md mx-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center mb-8 relative mt-4">
              <button 
                onClick={async () => {
                  setPage(22);
                  setMatchmakingStatus('idle');
                  if (currentMatchId) {
                    try {
                      await deleteDoc(doc(db, "matchmaking_1v1", currentMatchId));
                    } catch (e) {
                      console.error(e);
                    }
                    try {
                      await deleteDoc(doc(db, "matchmaking_squad", currentMatchId));
                    } catch (e) {
                      console.error(e);
                    }
                    try {
                      await deleteDoc(doc(db, "matchmaking_br", currentMatchId));
                    } catch (e) {
                      console.error(e);
                    }
                    setCurrentMatchId(null);
                  }
                }} 
                className="absolute left-0 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors border border-white/5"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-bold uppercase tracking-widest w-full text-center text-red-400">Поиск противника</h2>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="w-24 h-24 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center animate-pulse">
                <Swords className="w-12 h-12 text-red-500" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">Ищем достойного врага...</h3>
                <p className="text-zinc-400 text-sm">Среднее время ожидания: 10 сек.</p>
              </div>
              <motion.button
                onClick={() => {
                  setPage(22);
                  setMatchmakingStatus('idle');
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors font-bold uppercase tracking-widest text-sm"
              >
                Отмена
              </motion.button>
            </div>
          </motion.div>
        )}
        <AnimatePresence>
          {showGlobalFeed && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col"
            >
              <div className="p-4 border-b border-white/5 flex justify-between items-center glass-card">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-lime-400" /> Глобальные события
                </h2>
                <button 
                  onClick={() => {
                    setShowGlobalFeed(false);
                    setHasNewEvents(false);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {globalEvents.length === 0 ? (
                  <div className="text-center py-20 text-zinc-500 italic">
                    Событий пока нет...
                  </div>
                ) : (
                  globalEvents.map((event, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-2xl border ${
                        event.type === 'achievement' 
                          ? 'bg-lime-400/10 border-lime-400/30' 
                          : 'bg-white/5 border-white/5'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${
                          event.type === 'achievement' ? 'text-lime-300' : 'text-zinc-500'
                        }`}>
                          {event.type === 'achievement' ? 'Достижение' : 'Действие'}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-200">{event.message}</p>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
}
