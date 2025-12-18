import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';
import { storeCatalog, StoreCatalogEntry } from '../../data/storeCatalog';
import {
  generateMasterSeed,
  generateCategorySeed,
  seededSelect,
} from '../../utils/seededRandom';
import { getWeekKey, getNextRefreshTimestamp } from '../../utils/weekUtils';

const router = Router();
const db = admin.firestore();

// Number of items to show per category
const ITEMS_PER_CATEGORY = {
  Hat: 3,
  Face: 3,
  Collar: 3,
};

type RotatableCategory = keyof typeof ITEMS_PER_CATEGORY;

// Map category to user's owned field
const categoryToOwnedField: Record<RotatableCategory, string> = {
  Hat: 'ownedHats',
  Face: 'ownedFaces',
  Collar: 'ownedCollars',
};

interface RotatedCatalogResponse {
  success: boolean;
  data?: {
    hats: StoreCatalogEntry[];
    faces: StoreCatalogEntry[];
    collars: StoreCatalogEntry[];
    nextRefreshTimestamp: number;
    weekKey: string;
  };
  message?: string;
  error?: string;
}

/**
 * GET /api/store/rotated-catalog/:userId
 * 
 * Returns a deterministically selected set of store items for the user,
 * based on their userId and the current week. Items the user already owns
 * are excluded from the rotation.
 */
router.get('/rotated-catalog/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: userId',
    } as RotatedCatalogResponse);
  }

  try {
    // Get user's owned items from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // Collect all owned item IDs
    const ownedHats: string[] = Array.isArray(userData?.ownedHats) ? userData.ownedHats : [];
    const ownedFaces: string[] = Array.isArray(userData?.ownedFaces) ? userData.ownedFaces : [];
    const ownedCollars: string[] = Array.isArray(userData?.ownedCollars) ? userData.ownedCollars : [];
    const ownedIds = new Set([...ownedHats, ...ownedFaces, ...ownedCollars]);

    // Get current week key and generate master seed
    const weekKey = getWeekKey();
    const masterSeed = generateMasterSeed(userId, weekKey);

    // Filter catalog by category and exclude owned items
    const availableByCategory: Record<RotatableCategory, StoreCatalogEntry[]> = {
      Hat: storeCatalog.filter(item => item.category === 'Hat' && !ownedIds.has(item.id)),
      Face: storeCatalog.filter(item => item.category === 'Face' && !ownedIds.has(item.id)),
      Collar: storeCatalog.filter(item => item.category === 'Collar' && !ownedIds.has(item.id)),
    };

    // Select items for each category using seeded random
    const selectForCategory = (category: RotatableCategory): StoreCatalogEntry[] => {
      const available = availableByCategory[category];
      const count = ITEMS_PER_CATEGORY[category];
      const categorySeed = generateCategorySeed(masterSeed, category);
      return seededSelect(available, count, categorySeed);
    };

    const hats = selectForCategory('Hat');
    const faces = selectForCategory('Face');
    const collars = selectForCategory('Collar');

    const nextRefreshTimestamp = getNextRefreshTimestamp();

    return res.status(200).json({
      success: true,
      data: {
        hats,
        faces,
        collars,
        nextRefreshTimestamp,
        weekKey,
      },
      message: 'Rotated catalog retrieved successfully',
    } as RotatedCatalogResponse);
  } catch (error) {
    console.error('Error fetching rotated catalog:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch rotated catalog',
      message: error instanceof Error ? error.message : 'Unknown error',
    } as RotatedCatalogResponse);
  }
});

export default router;
