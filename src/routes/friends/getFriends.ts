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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().split('T')[0];

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - 6);
    const weekStartKey = weekStart.toISOString().split('T')[0];
    for (const friendId of friendIds) {
      const friendDoc = await db.collection('users').doc(friendId).get();

      if (!friendDoc.exists) {
        continue;
      }

      const friendData = friendDoc.data();
      const focusCollection = db.collection('users').doc(friendId).collection('focus');

      const focusSnapshot = await focusCollection
        .where('date', '>=', weekStartKey)
        .where('date', '<=', todayKey)
        .get();

      let todayFocus = 0;
      let weeklyMinutes = 0;

      focusSnapshot.forEach((doc) => {
        const data = doc.data();
        const dateKey = typeof data?.date === 'string' ? data.date : doc.id;
        const minutes = typeof data?.totalMinutes === 'number' ? data.totalMinutes : 0;

        if (dateKey === todayKey) {
          todayFocus = minutes;
        }
        weeklyMinutes += minutes;
      });

      let focusStreak = 0;
      const streakCursor = new Date(today);

      while (focusStreak < 30) {
        const streakKey = streakCursor.toISOString().split('T')[0];
        const doc = await focusCollection.doc(streakKey).get();

        if (doc.exists) {
          const data = doc.data();
          const minutes = typeof data?.totalMinutes === 'number' ? data.totalMinutes : 0;
          if (minutes > 0) {
            focusStreak += 1;
            streakCursor.setDate(streakCursor.getDate() - 1);
            continue;
          }
        }
        break;
      }

      friendsData.push({
        id: friendId,
        name: friendData?.name || 'Unknown User',
        email: friendData?.email || '',
        username: friendData?.username || null,
        avatar:
          friendData?.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(
            friendData?.name || 'User'
          )}&background=6366f1&color=fff`,
        focusStreak,
        weeklyMinutes: Math.round(weeklyMinutes),
        todayFocus: Math.round(todayFocus),
        isOnline: false,
        petType: friendData?.petType || 'Cat',
      });
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
