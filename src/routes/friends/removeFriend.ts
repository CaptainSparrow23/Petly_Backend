import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

// Remove a friend
router.delete('/remove', async (req: Request, res: Response) => {
  try {
    const { userId, friendId } = req.body;

    if (!userId || !friendId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both userId and friendId are required' 
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

    // Remove each other from friends list
    await db.collection('users').doc(userId).update({
      friends: admin.firestore.FieldValue.arrayRemove(friendId)
    });

    await db.collection('users').doc(friendId).update({
      friends: admin.firestore.FieldValue.arrayRemove(userId)
    });

    return res.json({ 
      success: true, 
      message: 'Friend removed successfully' 
    });

  } catch (error) {
    console.error('❌ Error removing friend:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to remove friend' 
    });
  }
});

export default router;