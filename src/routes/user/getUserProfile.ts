import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

/**
 * GET /api/user/profile/:userId
 * Get user's complete profile information
 * Returns username, displayName, profileId, and email
 */
router.get('/get_profile/:userId', async (req: Request, res: Response) => {
    console.log('Fetching user profile...');
  const { userId } = req.params;
  
  console.log(`📋 Fetching profile for user: ${userId}`);

  if (!userId) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required parameter: userId' 
    });
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    const doc = await userDocRef.get();

    if (!doc.exists) {
      console.log(`⚠️ User not found: ${userId}`);
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'No profile exists for this user'
      });
    }

    const userData = doc.data();
    
    // Get today's focus time
    const today = new Date();
    const todayKey = today.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    
    let timeActiveToday = 0;
    try {
      const todayFocusDoc = await db
        .collection('users')
        .doc(userId)
        .collection('focus')
        .doc(todayKey)
        .get();

      if (todayFocusDoc.exists) {
        const focusData = todayFocusDoc.data();
        timeActiveToday = typeof focusData?.totalMinutes === 'number' 
          ? focusData.totalMinutes 
          : 0;
      }
    } catch (error) {
      console.warn('Failed to fetch today\'s focus time:', error);
    }
    
    const profileData = {
      userId: userId,
      username: userData?.username || null,
      displayName: userData?.displayName || null,
      email: userData?.email || null,
      profileId: userData?.profileId || null,
      timeActiveToday: timeActiveToday,
    };

    console.log(`✅ Profile retrieved for user ${userId}: ${userData?.username || 'no username'}`);

    res.status(200).json({
      success: true,
      data: profileData,
      message: 'Profile retrieved successfully'
    });

    console.log('this is the profile data', profileData);

  } catch (error) {
    console.error('❌ Error fetching user profile:', error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
      return res.status(500).json({
        success: false,
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
