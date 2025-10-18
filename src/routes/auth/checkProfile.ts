import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();


router.get('/check-profile/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required parameter: userId' 
    });
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    const doc = await userDocRef.get();

    if (doc.exists) {
      const userData = doc.data();
      const hasUsername = !!userData?.username;
      const hasProfilePicture = !!userData?.profilePicture;

      const isProfileComplete = hasUsername;

      console.log(`📋 Profile check for user ${userId}: ${isProfileComplete ? 'Complete' : 'Incomplete'} (username: ${hasUsername}, picture: ${hasProfilePicture})`);

      res.status(200).json({
        success: true,
        data: {
          isProfileComplete,
          hasUsername,
          hasProfilePicture,
          username: userData?.username || null,
          profilePicture: userData?.profilePicture || null
        },
        message: isProfileComplete 
          ? 'Profile is complete' 
          : 'Profile setup required'
      });
    } else {

      console.log(`📋 Profile check for user ${userId}: No profile found`);
      
      res.status(200).json({
        success: true,
        data: {
          isProfileComplete: false,
          hasUsername: false,
          hasProfilePicture: false,
          username: null,
          profilePicture: null
        },
        message: 'Profile setup required'
      });
    }

  } catch (error) {
    console.error('❌ Error checking profile:', error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
      return res.status(500).json({
        success: false,
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to check profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
