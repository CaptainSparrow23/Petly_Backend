import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

const getArrayField = (value: unknown): string[] =>
  Array.isArray(value) ? (value as string[]) : [];

router.post('/respond', async (req: Request, res: Response) => {
  try {
    const { userId, requesterId, action } = req.body;

    if (!userId || !requesterId || !action) {
      return res.status(400).json({
        success: false,
        error: 'userId, requesterId, and action are required',
      });
    }

    const normalizedAction = String(action).toLowerCase();
    if (normalizedAction !== 'accept' && normalizedAction !== 'decline') {
      return res.status(400).json({
        success: false,
        error: "Action must be either 'accept' or 'decline'",
      });
    }

    const userRef = db.collection('users').doc(userId);
    const requesterRef = db.collection('users').doc(requesterId);

    const [userDoc, requesterDoc] = await Promise.all([userRef.get(), requesterRef.get()]);

    if (!userDoc.exists || !requesterDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'One or both users not found',
      });
    }

    const userData = userDoc.data();

    const userRequests = getArrayField(userData?.requests);
    if (!userRequests.includes(requesterId)) {
      return res.status(400).json({
        success: false,
        error: 'No pending friend request from this user',
      });
    }

    const userUpdate: Record<string, FirebaseFirestore.FieldValue> = {
      requests: admin.firestore.FieldValue.arrayRemove(requesterId),
      requested: admin.firestore.FieldValue.arrayRemove(requesterId),
    };

    const requesterUpdate: Record<string, FirebaseFirestore.FieldValue> = {
      requested: admin.firestore.FieldValue.arrayRemove(userId),
      requests: admin.firestore.FieldValue.arrayRemove(userId),
    };

    if (normalizedAction === 'accept') {
      userUpdate.friends = admin.firestore.FieldValue.arrayUnion(requesterId);
      requesterUpdate.friends = admin.firestore.FieldValue.arrayUnion(userId);
    }

    await Promise.all([userRef.update(userUpdate), requesterRef.update(requesterUpdate)]);

    return res.json({
      success: true,
      message: normalizedAction === 'accept' ? 'Friend request accepted' : 'Friend request declined',
      data: {
        action: normalizedAction,
        requesterId,
      },
    });
  } catch (error) {
    console.error('❌ Error responding to friend request:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to respond to friend request',
    });
  }
});

export default router;
