import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

// GET route to fetch user's selected pet preference
router.get('/pet-preference/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      error: 'Missing required parameter: userId'
    });
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    const doc = await userDocRef.get();

    if (doc.exists) {
      const data = doc.data();
      const selectedPet = data?.selectedPet || 'Skye'; // Default to Skye

      res.status(200).json({
        success: true,
        selectedPet,
        message: 'Pet preference retrieved successfully'
      });
    } else {
      // New user, return default
      res.status(200).json({
        success: true,
        selectedPet: 'Skye',
        message: 'New user, using default pet'
      });
    }

  } catch (error) {
    console.error('Error fetching pet preference:', error);

    // Check if it's a Firestore "not found" error
    if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
      return res.status(500).json({
        success: false,
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch pet preference',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST route to update user's selected pet preference
router.post('/pet-preference', async (req: Request, res: Response) => {
  const { userId, selectedPet } = req.body;

  if (!userId || !selectedPet) {
    return res.status(400).json({
      error: 'Missing required fields: userId, selectedPet'
    });
  }

  try {
    const userDocRef = db.collection('users').doc(userId);

    // Update only the selectedPet field, merge with existing data
    await userDocRef.set({
      selectedPet,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    console.log(`🐾 Pet preference updated for user ${userId}: ${selectedPet}`);

    res.status(200).json({
      success: true,
      selectedPet,
      message: 'Pet preference updated successfully'
    });

  } catch (error) {
    console.error('Error updating pet preference:', error);

    // Check if it's a Firestore "not found" error
    if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
      return res.status(500).json({
        success: false,
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update pet preference',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
