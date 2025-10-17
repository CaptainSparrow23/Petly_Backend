import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

// Add a friend
router.post('/add', async (req: Request, res: Response) => {
  try {
    const { userId, friendId } = req.body;

    if (!userId || !friendId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both userId and friendId are required' 
      });
    }

    if (userId === friendId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot add yourself as a friend' 
      });
    }

    // Check if both users exist
    const userDoc = await db.collection('users').doc(userId).get();
    const friendDoc = await db.collection('users').doc(friendId).get();

    if (!userDoc.exists || !friendDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'One or both users not found' 
      });
    }

    const userData = userDoc.data();
    const friendData = friendDoc.data();

    const userFriends = userData?.friends || [];
    const friendFriends = friendData?.friends || [];

    // Check if they're already friends
    if (userFriends.includes(friendId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Users are already friends' 
      });
    }

    // Add each other to friends list
    await db.collection('users').doc(userId).update({
      friends: admin.firestore.FieldValue.arrayUnion(friendId)
    });

    await db.collection('users').doc(friendId).update({
      friends: admin.firestore.FieldValue.arrayUnion(userId)
    });

    return res.json({ 
      success: true, 
      message: 'Friend added successfully',
      data: {
        friend: {
          id: friendId,
          name: friendData?.name || 'Unknown User',
          username: friendData?.username || null,
          avatar: friendData?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(friendData?.name || 'User')}&background=6366f1&color=fff`,
        }
      }
    });

  } catch (error) {
    console.error('❌ Error adding friend:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to add friend' 
    });
  }
});

export default router;