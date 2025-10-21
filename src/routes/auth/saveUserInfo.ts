import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

/**
 * POST /api/auth/save-user-info
 * Save user's email and display name from Google account to Firestore
 * This is called after Google login to store basic user info
 */
router.post('/save-user-info', async (req: Request, res: Response) => {
  const { userId, email, displayName } = req.body;
  
  console.log(`💾 Saving user info for userId: ${userId}`);

  if (!userId) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required parameter: userId' 
    });
  }

  if (!email) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required parameter: email' 
    });
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    const doc = await userDocRef.get();

    if (doc.exists) {
      // User document exists, update email and displayName
      await userDocRef.update({
        email: email,
        displayName: displayName || null,
      });

      console.log(`✅ Updated user info for existing user: ${userId} (${email})`);

      res.status(200).json({
        success: true,
        message: 'User info updated successfully',
        data: {
          userId,
          email,
          displayName: displayName || null
        }
      });
    } else {
      // User document doesn't exist, create it with email and displayName
      await userDocRef.set({
        email: email,
        displayName: displayName || null,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        coins: 100
      });

      console.log(`✅ Created new user document: ${userId} (${email})`);

      res.status(201).json({
        success: true,
        message: 'User info saved successfully',
        data: {
          userId,
          email,
          displayName: displayName || null,
          coins: 100
        }
      });
    }

  } catch (error) {
    console.error('❌ Error saving user info:', error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
      return res.status(500).json({
        success: false,
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to save user info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
