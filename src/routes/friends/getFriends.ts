import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

// Get user's friends list
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }

    // Get user document to access friends array
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    const userData = userDoc.data();
    const friendIds = userData?.friends || [];

    if (friendIds.length === 0) {
      return res.json({ 
        success: true, 
        data: { friends: [] } 
      });
    }

    // Get friend details for each friend ID
    const friendsData = [];

    const today = new Date();
    const todayKey = today.toLocaleDateString('en-CA'); // Format as YYYY-MM-DD in local timezone

    for (const friendId of friendIds) {
      const friendDoc = await db.collection('users').doc(friendId).get();

      if (!friendDoc.exists) {
        continue;
      }

      const friendData = friendDoc.data();

      // Get today's focus time from the focus subcollection
      const todayFocusDoc = await db
        .collection('users')
        .doc(friendId)
        .collection('focus')
        .doc(todayKey)
        .get();

      let timeActiveToday = 0;
      if (todayFocusDoc.exists) {
        const focusData = todayFocusDoc.data();
        timeActiveToday = typeof focusData?.totalMinutes === 'number' 
          ? focusData.totalMinutes 
          : 0;
      }
      console.log(`Friend ${friendId} - Time active today: ${timeActiveToday} minutes`);

      friendsData.push({
        username: friendData?.username || null,
        displayName: friendData?.displayName || friendData?.name || 'Unknown User',
        profileId: typeof friendData?.profileId === 'number' ? friendData.profileId : null,
        userId: friendId,
        timeActiveToday,
      });
    }

    // Sort friends by time active today (descending)
    friendsData.sort((a, b) => b.timeActiveToday - a.timeActiveToday);

    return res.json({ 
      success: true, 
      data: { friends: friendsData } 
    });

  } catch (error) {
    console.error('❌ Error fetching friends list:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch friends list' 
    });
  }
});

export default router;
