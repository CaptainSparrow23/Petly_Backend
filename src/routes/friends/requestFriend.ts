import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

const getArrayField = (value: unknown): string[] =>
  Array.isArray(value) ? (value as string[]) : [];

router.post('/request', async (req: Request, res: Response) => {
  try {
    const { userId, friendId } = req.body;

    if (!userId || !friendId) {
      return res.status(400).json({
        success: false,
        error: 'Both userId and friendId are required',
      });
    }

    if (userId === friendId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot send a friend request to yourself',
      });
    }

    const userRef = db.collection('users').doc(userId);
    const friendRef = db.collection('users').doc(friendId);

    const [userDoc, friendDoc] = await Promise.all([userRef.get(), friendRef.get()]);

    if (!userDoc.exists || !friendDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'One or both users not found',
      });
    }

    const userData = userDoc.data();
    const friendData = friendDoc.data();

    const userFriends = getArrayField(userData?.friends);
    const userRequested = getArrayField(userData?.requested);
    const userRequests = getArrayField(userData?.requests);

    const friendFriends = getArrayField(friendData?.friends);
    const friendRequested = getArrayField(friendData?.requested);
    const friendRequests = getArrayField(friendData?.requests);

    if (userFriends.includes(friendId) || friendFriends.includes(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Users are already friends',
      });
    }

    if (userRequested.includes(friendId)) {
      return res.status(400).json({
        success: false,
        error: 'Friend request already sent',
      });
    }

    if (userRequests.includes(friendId)) {
      return res.status(400).json({
        success: false,
        error: 'This user already requested you. Please respond to their request.',
      });
    }

    if (friendRequests.includes(userId) || friendRequested.includes(userId)) {
      return res.status(400).json({
        success: false,
        error: 'A pending request already exists between these users',
      });
    }

    await Promise.all([
      userRef.update({
        requested: admin.firestore.FieldValue.arrayUnion(friendId),
      }),
      friendRef.update({
        requests: admin.firestore.FieldValue.arrayUnion(userId),
      }),
    ]);

    return res.json({
      success: true,
      message: 'Friend request sent',
      data: {
        requestedId: friendId,
      },
    });
  } catch (error) {
    console.error('❌ Error sending friend request:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send friend request',
    });
  }
});

export default router;
