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
    const friendIds = Array.isArray(userData?.friends) ? userData?.friends : [];
    const requestIds = Array.isArray(userData?.requests) ? userData?.requests : [];

    const friendsData = [] as Array<{
      username: string | null;
      displayName: string;
      profileId: number | null;
      userId: string;
      timeActiveToday: number;
    }>;

    const requestsData = [] as Array<{
      username: string | null;
      displayName: string;
      profileId: number | null;
      userId: string;
      email: string | null;
    }>;

    // Calculate today's time range (UTC)
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const startTs = admin.firestore.Timestamp.fromDate(startOfToday);
    const endTs = admin.firestore.Timestamp.fromDate(now);

    for (const friendId of friendIds) {
      const friendDoc = await db.collection('users').doc(friendId).get();

      if (!friendDoc.exists) {
        continue;
      }

      const friendData = friendDoc.data();

      // Query today's live focus sessions directly
      const focusSnap = await db
        .collection('users')
        .doc(friendId)
        .collection('focus')
        .where('startTs', '>=', startTs)
        .where('startTs', '<=', endTs)
        .get();

      let totalSec = 0;
      focusSnap.forEach((doc) => {
        const data = doc.data();
        if (data.activity === 'Focus' || data.activity === 'Rest') {
          totalSec += Number(data.durationSec || 0);
        }
      });

      const timeActiveToday = Math.floor(totalSec / 60);
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

    if (requestIds.length > 0) {
      for (const requesterId of requestIds) {
        const requesterDoc = await db.collection('users').doc(requesterId).get();
        if (!requesterDoc.exists) {
          continue;
        }

        const requesterData = requesterDoc.data();
        requestsData.push({
          username: requesterData?.username || null,
          displayName: requesterData?.displayName || requesterData?.name || 'Petly Explorer',
          profileId: typeof requesterData?.profileId === 'number' ? requesterData.profileId : null,
          userId: requesterId,
          email: requesterData?.email || null,
        });
      }
    }

    return res.json({ 
      success: true, 
      data: { friends: friendsData, requests: requestsData } 
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
