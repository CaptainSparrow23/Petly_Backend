import { Router, Request, Response } from 'express';
import { db } from '../../firebase';
import { PET_UNLOCKS_BY_LEVEL } from '../../utils/petUnlocks';
import { storeCatalog } from '../../data/storeCatalog';
import { calculateLevel } from '../../utils/levelUtils';
import { ensurePetFriendshipDoc } from '../../utils/petFriendships';

const router = Router();

// Map of level → additional non-pet reward ids (e.g. gadgets) that are granted when claiming that level.
const LEVEL_GADGET_REWARDS: Record<number, string[]> = {
  2: ['gadget_laptop'],
  6: ['gadget_pot_and_stove'],
  8: ['gadget_cello_artisan'],
};

// Map item category to the owned* field on the user document.
const CATEGORY_TO_FIELD: Record<string, keyof FirebaseFirestore.DocumentData> = {
  Pet: 'ownedPets',
  Hat: 'ownedHats',
  Collar: 'ownedCollars',
  Gadget: 'ownedGadgets',
};

router.post('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { level } = req.body ?? {};

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing required parameter: userId' });
  }

  const numericLevel = Number(level);
  if (!Number.isInteger(numericLevel) || numericLevel < 1 || numericLevel > 100) {
    return res.status(400).json({
      success: false,
      error: 'Invalid level. Must be an integer between 1 and 100.',
    });
  }

  try {
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userData = userSnap.data() ?? {};

    // Check that user has actually reached this level (based on totalXP)
    const totalXP =
      typeof userData.totalXP === 'number' && Number.isFinite(userData.totalXP)
        ? userData.totalXP
        : 0;
    const currentLevel = calculateLevel(totalXP);
    if (currentLevel < numericLevel) {
      return res.status(400).json({
        success: false,
        error: `Level ${numericLevel} has not been reached yet.`,
        currentLevel,
      });
    }

    // Check if already claimed (simple array of level numbers)
    const claimedLevels: number[] = Array.isArray(userData.claimedLevelRewards)
      ? (userData.claimedLevelRewards as number[])
      : [];
    if (claimedLevels.includes(numericLevel)) {
      return res.status(400).json({
        success: false,
        error: 'Level reward already claimed',
        alreadyClaimed: true,
      });
    }

    // Determine all reward item ids for this level
    const petRewards = PET_UNLOCKS_BY_LEVEL[numericLevel] ?? [];
    const gadgetRewards = LEVEL_GADGET_REWARDS[numericLevel] ?? [];
    const rewardIds = Array.from(new Set([...petRewards, ...gadgetRewards]));

    if (rewardIds.length === 0) {
      // Nothing to claim for this level, but still mark it as claimed
      await userRef.set(
        {
          claimedLevelRewards: Array.from(new Set([...claimedLevels, numericLevel])),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return res.status(200).json({
        success: true,
        message: `No rewards configured for level ${numericLevel}.`,
        data: { claimedLevelRewards: Array.from(new Set([...claimedLevels, numericLevel])) },
      });
    }

    // Group rewards by category so we know which owned* field to update.
    const catalogById = new Map(storeCatalog.map((item) => [item.id, item]));
    const updates: Record<string, string[]> = {};

    for (const rewardId of rewardIds) {
      const entry = catalogById.get(rewardId);
      if (!entry) continue;
      const field = CATEGORY_TO_FIELD[entry.category];
      if (!field) continue;
      if (!updates[field]) updates[field] = [];
      updates[field].push(rewardId);
    }

    const newData: Record<string, any> = {};
    let hasNewItems = false;

    // Only add items that don't already exist in the ownedLists
    for (const [field, ids] of Object.entries(updates)) {
      const existing = Array.isArray(userData[field]) ? (userData[field] as string[]) : [];
      const newItems = ids.filter((id) => !existing.includes(id));
      
      if (newItems.length > 0) {
        hasNewItems = true;
        newData[field] = Array.from(new Set([...existing, ...newItems]));
      }
    }

    // If all items already exist, just mark as claimed without modifying owned lists.
    // This prevents duplicate entries but still tracks that the level was claimed.
    if (!hasNewItems) {
      await userRef.set(
        {
          claimedLevelRewards: Array.from(new Set([...claimedLevels, numericLevel])),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      return res.status(200).json({
        success: true,
        message: `No new rewards to add for level ${numericLevel}; all rewards already owned.`,
        data: { alreadyOwned: true },
      });
    }

    // Mark level as claimed and update owned lists
    newData.claimedLevelRewards = Array.from(new Set([...claimedLevels, numericLevel]));
    newData.updatedAt = new Date().toISOString();

    await userRef.set(newData, { merge: true });

    if (Array.isArray(newData.ownedPets)) {
      const newlyGrantedPets = newData.ownedPets.filter((id: string) => petRewards.includes(id));
      for (const petId of newlyGrantedPets) {
        await ensurePetFriendshipDoc(userRef, petId);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Level ${numericLevel} rewards claimed`,
      data: newData,
    });
  } catch (error) {
    console.error('❌ Error claiming level reward:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to claim level reward',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
