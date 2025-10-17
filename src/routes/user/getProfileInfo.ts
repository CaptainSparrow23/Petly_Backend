import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

// GET route to fetch user account statistics
router.get('/stats/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ 
      error: 'Missing required parameter: userId' 
    });
  }

  try {
    // Get user document
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    // Count focus sessions (posts equivalent)
    const focusCollectionRef = userDocRef.collection('focus');
    const focusSnapshot = await focusCollectionRef.get();
    const postsCount = focusSnapshot.size;

    // Count pets (if pets collection exists)
    const petsCollectionRef = userDocRef.collection('pets');
    const petsSnapshot = await petsCollectionRef.get();
    const petsCount = petsSnapshot.size;

    // Count friends from user document
    const userData = userDoc.exists ? userDoc.data() : {};
    const friends = userData?.friends || [];
    const friendsCount = friends.length;

    res.status(200).json({
      success: true,
      data: {
        postsCount,
        friendsCount,
        petsCount,
        totalFocusSessions: postsCount
      },
      message: 'User statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching user statistics:', error);
    
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
      error: 'Failed to fetch user statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;