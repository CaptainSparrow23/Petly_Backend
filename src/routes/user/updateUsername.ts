import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

// GET route to fetch user profile
router.get('/profile/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ 
      error: 'Missing required parameter: userId' 
    });
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    const doc = await userDocRef.get();

    if (doc.exists) {
      const userData = doc.data();
      res.status(200).json({
        success: true,
        data: {
          username: userData?.username || null,
          updatedAt: userData?.updatedAt || null
        },
        message: 'User profile retrieved successfully'
      });
    } else {
      // User document doesn't exist yet
      res.status(200).json({
        success: true,
        data: {
          username: null,
          updatedAt: null
        },
        message: 'User profile not found - will be created on first update'
      });
    }

  } catch (error) {
    console.error('Error fetching user profile:', error);
    
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
      error: 'Failed to fetch user profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT route to update user's username
router.put('/username/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { username } = req.body;

  if (!userId) {
    return res.status(400).json({ 
      error: 'Missing required parameter: userId' 
    });
  }

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ 
      error: 'Username is required and must be a string' 
    });
  }

  // Validate username format
  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 2) {
    return res.status(400).json({ 
      error: 'Username must be at least 2 characters long' 
    });
  }

  if (trimmedUsername.length > 30) {
    return res.status(400).json({ 
      error: 'Username must be less than 30 characters long' 
    });
  }

  // Basic username validation (alphanumeric, underscore, hyphen)
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(trimmedUsername)) {
    return res.status(400).json({ 
      error: 'Username can only contain letters, numbers, underscores, and hyphens' 
    });
  }

  try {
    // Check if username already exists (optional - you can skip this if you allow duplicates)
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

    // Create or update the user's username (using set with merge to create if doesn't exist)
    const userDocRef = db.collection('users').doc(userId);
    await userDocRef.set({
      username: trimmedUsername,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`👤 Username updated for user ${userId}: "${trimmedUsername}"`);

    res.status(200).json({
      success: true,
      data: { username: trimmedUsername },
      message: 'Username updated successfully'
    });

  } catch (error) {
    console.error('Error updating username:', error);
    
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
      error: 'Failed to update username',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;