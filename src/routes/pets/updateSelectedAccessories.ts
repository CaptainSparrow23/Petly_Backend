import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

interface UpdateAccessoriesBody {
  selectedHat?: string | null;
  selectedCollar?: string | null;
  selectedGadget?: string | null;
}

router.put('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { selectedHat, selectedCollar, selectedGadget } = req.body as UpdateAccessoriesBody;

  console.log(`🎀 Received request to update accessories for user ${userId}`);

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: userId',
    });
  }

  // At least one accessory should be provided
  if (selectedHat === undefined && selectedCollar === undefined && selectedGadget === undefined) {
    return res.status(400).json({
      success: false,
      error: 'No accessories provided to update',
    });
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      console.warn(`⚠️ User ${userId} not found while updating accessories`);
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'Unable to update accessories for a user that does not exist',
      });
    }

    // Build the update object with only provided fields
    const updateData: Record<string, string | null> = {};
    
    if (selectedHat !== undefined) {
      updateData.selectedHat = selectedHat;
    }
    if (selectedCollar !== undefined) {
      updateData.selectedCollar = selectedCollar;
    }
    if (selectedGadget !== undefined) {
      updateData.selectedGadget = selectedGadget;
    }

    await userDocRef.set(updateData, { merge: true });

    console.log(`✅ Updated accessories for user ${userId}:`, updateData);

    return res.status(200).json({
      success: true,
      message: 'Accessories updated successfully',
      data: { userId, ...updateData },
    });
  } catch (error) {
    console.error('❌ Failed to update accessories:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred while updating accessories';

    return res.status(500).json({
      success: false,
      error: 'Failed to update accessories',
      message: errorMessage,
    });
  }
});

export default router;
