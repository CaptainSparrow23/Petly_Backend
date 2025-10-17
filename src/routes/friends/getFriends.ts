import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

// Get user's friends list
router.get('/list/:userId', async (req: Request, res: Response) => {
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
    
    for (const friendId of friendIds) {
      const friendDoc = await db.collection('users').doc(friendId).get();
      
      if (friendDoc.exists) {
        const friendData = friendDoc.data();
        
        // For now, use placeholder values until Firestore indexes are created
        // TODO: Re-enable complex queries once indexes are ready
        let todayFocus = Math.floor(Math.random() * 120); // Random 0-120 minutes for demo
        let weeklyMinutes = Math.floor(Math.random() * 500); // Random 0-500 minutes for demo  
        let focusStreak = Math.floor(Math.random() * 30); // Random 0-30 days for demo

        friendsData.push({
          id: friendId,
          name: friendData?.name || 'Unknown User',
          email: friendData?.email || '',
          username: friendData?.username || null,
          avatar: friendData?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(friendData?.name || 'User')}&background=6366f1&color=fff`,
          focusStreak,
          weeklyMinutes: Math.round(weeklyMinutes),
          todayFocus: Math.round(todayFocus),
          isOnline: false, // We can implement this later with real-time presence
          petType: friendData?.petType || 'Cat', // Default pet type
        });
      }
    }

    // Sort friends by weekly minutes (descending)
    friendsData.sort((a, b) => b.weeklyMinutes - a.weeklyMinutes);

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