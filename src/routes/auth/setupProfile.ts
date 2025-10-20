import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

router.post('/setup-profile', async (req: Request, res: Response) => {
  const { userId, username, profileId } = req.body;

  if (!userId) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required parameter: userId' 
    });
  }

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ 
      success: false,
      error: 'Username is required and must be a string' 
    });
  }

  if (!profileId || typeof profileId !== 'number') {
    return res.status(400).json({ 
      success: false,
      error: 'Profile picture ID is required and must be a number' 
    });
  }

  // Validate username format
  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 2) {
    return res.status(400).json({ 
      success: false,
      error: 'Username must be at least 2 characters long' 
    });
  }

  if (trimmedUsername.length > 30) {
    return res.status(400).json({ 
      success: false,
      error: 'Username must be less than 30 characters long' 
    });
  }

  // Basic username validation (alphanumeric, underscore, hyphen)
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(trimmedUsername)) {
    return res.status(400).json({ 
      success: false,
      error: 'Username can only contain letters, numbers, underscores, and hyphens' 
    });
  }

  try {
    // Check if username already exists
    const existingUserQuery = await db.collection('users')
      .where('username', '==', trimmedUsername)
      .get();

    // If username exists and it's not the current user, return error
    if (!existingUserQuery.empty) {
      const existingUserId = existingUserQuery.docs[0].id;
      if (existingUserId !== userId) {
        return res.status(409).json({
          success: false,
          error: 'Username already taken',
          message: 'Please choose a different username'
        });
      }
    }

    // Create or update the user's profile in Firestore
    const userDocRef = db.collection('users').doc(userId);
    await userDocRef.set({
      username: trimmedUsername,
      profileId: profileId,
    }, { merge: true });

    console.log(`✅ Profile setup complete for user ${userId}: "${trimmedUsername}"`);

    res.status(200).json({
      success: true,
      data: { 
        username: trimmedUsername,
        profileId: profileId
      },
      message: 'Profile setup successfully'
    });

  } catch (error) {
    console.error('❌ Error setting up profile:', error);
    
    // Check if it's a Firestore "not found" error
    if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
      return res.status(500).json({
        success: false,
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to setup profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
