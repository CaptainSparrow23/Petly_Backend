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
        
        // Get friend's focus sessions for today and this week
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        
        // Get today's focus time
        const todaySessionsQuery = await db.collection('focusSessions')
          .where('userId', '==', friendId)
          .where('createdAt', '>=', today)
          .get();
        
        let todayFocus = 0;
        todaySessionsQuery.forEach(doc => {
          const session = doc.data();
          todayFocus += session.duration || 0;
        });

        // Get this week's focus time
        const weekSessionsQuery = await db.collection('focusSessions')
          .where('userId', '==', friendId)
          .where('createdAt', '>=', weekStart)
          .get();
        
        let weeklyMinutes = 0;
        weekSessionsQuery.forEach(doc => {
          const session = doc.data();
          weeklyMinutes += session.duration || 0;
        });

        // Calculate focus streak (simplified - consecutive days with focus sessions)
        let focusStreak = 0;
        const checkDate = new Date(today);
        
        while (focusStreak < 30) { // Check last 30 days max
          const dayStart = new Date(checkDate);
          dayStart.setHours(0, 0, 0, 0);
          
          const dayEnd = new Date(checkDate);
          dayEnd.setHours(23, 59, 59, 999);
          
          const daySessionsQuery = await db.collection('focusSessions')
            .where('userId', '==', friendId)
            .where('createdAt', '>=', dayStart)
            .where('createdAt', '<=', dayEnd)
            .limit(1)
            .get();
          
          if (!daySessionsQuery.empty) {
            focusStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }

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