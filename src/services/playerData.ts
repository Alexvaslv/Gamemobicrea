import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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

export const PLAYER_DATA_COLLECTION = "player_data";

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

export async function equipItemToFirestore(playerId: string, item: any, slot: string) {
  try {
    const playerDocRef = doc(db, PLAYER_DATA_COLLECTION, playerId);
    const playerDoc = await getDoc(playerDocRef);
    
    if (playerDoc.exists()) {
      const data = playerDoc.data();
      const equippedItems = data.equippedItems || {};
      const inventory = data.inventory || [];
      
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
