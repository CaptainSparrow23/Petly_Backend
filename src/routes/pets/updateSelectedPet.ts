import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

/**
 * PUT /api/pets/update_selected/:userId
 * Persist the user's currently selected pet
 */
router.put('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { petName } = req.body;

  console.log(`🐾 Received request to update selected pet for user ${userId}`);

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: userId',
    });
  }

  if (typeof petName !== 'string' || !petName.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Invalid pet name provided',
    });
  }

  try {
    const normalizedPetName = petName.trim();
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      console.warn(`⚠️ User ${userId} not found while updating selected pet`);
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'Unable to update selected pet for a user that does not exist',
      });
    }

    await userDocRef.set(
      {
        selectedPet: normalizedPetName,
      },
      { merge: true },
    );

    console.log(`✅ Updated selected pet for user ${userId} to ${normalizedPetName}`);

    return res.status(200).json({
      success: true,
      message: 'Selected pet updated successfully',
      data: { userId, selectedPetName: normalizedPetName },
    });
  } catch (error) {
    console.error('❌ Failed to update selected pet:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred while updating selected pet';

    return res.status(500).json({
      success: false,
      error: 'Failed to update selected pet',
      message: errorMessage,
    });
  }
});

export default router;
