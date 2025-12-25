import { Router, Request, Response } from 'express';
import { db } from '../../firebase';
import { storeCatalog } from '../../data/storeCatalog';
import { ensurePetFriendshipDoc } from '../../utils/petFriendships';

const router = Router();

interface PurchasePayload {
  petId?: unknown;
  priceCoins?: unknown;
}

// Maps category to the Firestore field name for owned items
const categoryToField: Record<string, string> = {
  Pet: 'ownedPets',
  Hat: 'ownedHats',
  Collar: 'ownedCollars',
  Gadget: 'ownedGadgets',
};

// Handles purchasing an item, deducting coins, and updating the player's collection.
router.post('/purchase/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { petId, priceCoins }: PurchasePayload = req.body ?? {}; // petId is legacy name, actually itemId

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: userId',
    });
  }

  if (typeof petId !== 'string' || petId.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Invalid petId provided',
    });
  }

  // Look up the item details in the catalog
  const catalogEntry = storeCatalog.find((entry) => entry.id === petId);
  if (!catalogEntry) {
    return res.status(404).json({
      success: false,
      error: 'Item not found in catalog',
    });
  }

  const ownedField = categoryToField[catalogEntry.category];
  if (!ownedField) {
    return res.status(400).json({
      success: false,
      error: 'Unknown item category',
    });
  }

  const isPetPurchase = catalogEntry.category === 'Pet';
  const expectedPriceCoins = catalogEntry.priceCoins;
  const expectedPriceKeys =
    typeof (catalogEntry as any).priceKeys === 'number' && Number.isFinite((catalogEntry as any).priceKeys)
      ? (catalogEntry as any).priceKeys
      : null;

  if (isPetPurchase && (!expectedPriceKeys || expectedPriceKeys <= 0)) {
    return res.status(400).json({
      success: false,
      error: 'Pet cannot be purchased because it has no key price configured.',
    });
  }

  if (!isPetPurchase) {
    // Default the submitted price to the canonical price if the client omits it.
    const submittedPrice =
      typeof priceCoins === 'number' && priceCoins > 0 ? priceCoins : expectedPriceCoins;

    if (submittedPrice !== expectedPriceCoins) {
      return res.status(400).json({
        success: false,
        error: 'Price mismatch for requested item',
      });
    }
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const userData = userDoc.data() ?? {};
    const currentCoins =
      typeof userData.coins === 'number' && Number.isFinite(userData.coins) ? userData.coins : 0;
    const currentKeys =
      typeof userData.petKey === 'number' && Number.isFinite(userData.petKey) ? userData.petKey : 1;
    const ownedItems = Array.isArray(userData[ownedField])
      ? (userData[ownedField] as string[])
      : [];

    if (ownedItems.includes(petId)) {
      return res.status(200).json({
        success: true,
        message: 'Item already owned; no update necessary',
        data: {
          coins: currentCoins,
          petKey: currentKeys,
          [ownedField]: ownedItems,
        },
      });
    }

    if (isPetPurchase) {
      if (currentKeys < expectedPriceKeys) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient keys for this purchase',
        });
      }
    } else {
      if (currentCoins < expectedPriceCoins) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient coins for this purchase',
        });
      }
    }

    const updatedCoins = isPetPurchase ? currentCoins : currentCoins - expectedPriceCoins;
    const updatedKeys = isPetPurchase ? currentKeys - expectedPriceKeys : currentKeys;
    // Use a set to avoid duplicates in case of concurrent purchase attempts.
    const updatedOwnedItems = Array.from(new Set([...ownedItems, petId]));

    await userDocRef.set(
      {
        coins: updatedCoins,
        petKey: updatedKeys,
        [ownedField]: updatedOwnedItems,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    if (isPetPurchase) {
      await ensurePetFriendshipDoc(userDocRef, petId);
    }

    return res.status(200).json({
      success: true,
      message: 'Item purchased successfully',
      data: {
        coins: updatedCoins,
        petKey: updatedKeys,
        [ownedField]: updatedOwnedItems,
      },
    });
  } catch (error) {
    console.error('❌ Error completing pet purchase:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to complete purchase',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
