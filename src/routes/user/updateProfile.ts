import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

/**
 * PUT /api/user/profile/:userId
 * Update user's profile (username and/or profileId)
 */
router.put('/update_profile/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { username, profileId, allowFriendRequests } = req.body;
  
  console.log(`📝 Updating profile for user: ${userId}`);
  console.log(`   Username: ${username || 'no change'}`);
  console.log(`   ProfileId: ${profileId || 'no change'}`);

  if (!userId) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required parameter: userId' 
    });
  }

  // At least one field must be provided
  if (
    username === undefined &&
    profileId === undefined &&
    allowFriendRequests === undefined
  ) {
    return res.status(400).json({ 
      success: false,
      error: 'At least one field (username, profileId, or allowFriendRequests) must be provided' 
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

    // Build update object with only the fields that were provided
    const updateData: any = {};
    
    if (username !== undefined) {
      // Validate username
      if (typeof username !== 'string' || username.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Username must be at least 2 characters long'
        });
      }

      // Check if username is already taken by another user
      const usernameQuery = await db.collection('users')
        .where('username', '==', username.trim())
        .get();
      
      if (!usernameQuery.empty) {
        const existingUser = usernameQuery.docs[0];
        if (existingUser.id !== userId) {
          return res.status(409).json({
            success: false,
            error: 'Username is already taken',
            message: 'Please choose a different username'
          });
        }
      }

      updateData.username = username.trim();
    }

    if (profileId !== undefined) {
      // Validate profileId
      if (typeof profileId !== 'number' || ![1, 2].includes(profileId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid profileId. Must be 1 or 2'
        });
      }

      updateData.profileId = profileId;
    }

    if (allowFriendRequests !== undefined) {
      if (typeof allowFriendRequests !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'allowFriendRequests must be a boolean value',
        });
      }
      updateData.allowFriendRequests = allowFriendRequests;
    }

    // Add updatedAt timestamp
    updateData.updatedAt = new Date().toISOString();

    // Update the document
    await userDocRef.update(updateData);

    // Get the updated document
    const updatedDoc = await userDocRef.get();
    const updatedData = updatedDoc.data();

    console.log(`✅ Profile updated successfully for user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        userId,
        username: updatedData?.username || null,
        displayName: updatedData?.displayName || null,
        email: updatedData?.email || null,
        profileId: updatedData?.profileId || null,
        allowFriendRequests:
          typeof updatedData?.allowFriendRequests === 'boolean'
            ? updatedData.allowFriendRequests
            : true,
      }
    });

  } catch (error) {
    console.error('❌ Error updating profile:', error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
      return res.status(500).json({
        success: false,
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
