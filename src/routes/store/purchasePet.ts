import { Router, Request, Response } from 'express';
import { db } from '../../firebase';
import { petCatalog } from '../../../data/petCatalog';

const router = Router();

interface PurchasePayload {
  petId?: unknown;
  priceCoins?: unknown;
}

router.post('/purchase/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { petId, priceCoins }: PurchasePayload = req.body ?? {};

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

  const catalogEntry = petCatalog.find((entry) => entry.id === petId);
  if (!catalogEntry) {
    return res.status(404).json({
      success: false,
      error: 'Pet not found in catalog',
    });
  }

  const expectedPrice = catalogEntry.priceCoins;
  const submittedPrice =
    typeof priceCoins === 'number' && priceCoins > 0 ? priceCoins : expectedPrice;

  if (submittedPrice !== expectedPrice) {
    return res.status(400).json({
      success: false,
      error: 'Price mismatch for requested pet',
    });
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
      typeof userData.coins === 'number' && Number.isFinite(userData.coins)
        ? userData.coins
        : 0;
    const ownedPets = Array.isArray(userData.ownedPets)
      ? (userData.ownedPets as string[])
      : [];

    if (ownedPets.includes(petId)) {
      return res.status(200).json({
        success: true,
        message: 'Pet already owned; no update necessary',
        data: {
          coins: currentCoins,
          ownedPets,
        },
      });
    }

    if (currentCoins < expectedPrice) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient coins for this purchase',
      });
    }

    const updatedCoins = currentCoins - expectedPrice;
    const updatedOwnedPets = Array.from(new Set([...ownedPets, petId]));

    await userDocRef.set(
      {
        coins: updatedCoins,
        ownedPets: updatedOwnedPets,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Pet purchased successfully',
      data: {
        coins: updatedCoins,
        ownedPets: updatedOwnedPets,
      },
    });
  } catch (error) {
    console.error('❌ Error completing pet purchase:', error);

    if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
      return res.status(500).json({
        success: false,
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to complete purchase',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
