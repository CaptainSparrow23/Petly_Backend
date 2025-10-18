import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

/**
 * POST /api/auth/check-user-status
 * Check if user has a username in Firebase
 * Returns needsProfileSetup: true if user does NOT have a username (needs to set it up)
 * Returns needsProfileSetup: false if user has a username (profile complete)
 */
router.post('/check-user-status', async (req: Request, res: Response) => {
  const { userId } = req.body;
  console.log(`🔍 Checking user status for userId: ${userId}`);

  if (!userId) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required parameter: userId' 
    });
  }

  try {
    // Check if user document exists in Firebase
    const userDocRef = db.collection('users').doc(userId);
    const doc = await userDocRef.get();

    if (doc.exists) {
      const userData = doc.data();
      const hasUsername = !!userData?.username;
      
      if (hasUsername) {
        // User has username = profile is complete
        console.log(`✅ User has username: ${userId} (${userData?.username})`);
        
        res.status(200).json({
          success: true,
          data: {
            needsProfileSetup: false,
            hasUsername: true,
            username: userData?.username || null,
            profilePicture: userData?.profilePicture || null
          },
          message: 'User profile is complete'
        });
      } else {
        // User document exists but no username = needs setup
        console.log(`⚠️ User exists but no username: ${userId}`);
        
        res.status(200).json({
          success: true,
          data: {
            needsProfileSetup: true,
            hasUsername: false,
            username: null,
            profilePicture: null
          },
          message: 'User needs to set username'
        });
      }
    } else {
      // User document doesn't exist = new user, needs profile setup
      console.log(`🆕 New user detected (not in Firebase): ${userId}`);
      
      res.status(200).json({
        success: true,
        data: {
          needsProfileSetup: true,
          hasUsername: false,
          username: null,
          profilePicture: null
        },
        message: 'New user - profile setup required'
      });
    }

  } catch (error) {
    console.error('❌ Error checking user status:', error);
    
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
      error: 'Failed to check user status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
