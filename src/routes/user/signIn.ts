import { Router, Request, Response } from 'express';
import admin from '../../firebase';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('this is now working')
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({
        success: false,
        message: 'ID token is required',
      });
      return;
    }

    // Check if Firebase is initialized
    if (!admin.apps.length) {
      res.status(500).json({
        success: false,
        message: 'Firebase not configured - please set up Firebase credentials',
      });
      return;
    }

    // Verify the Google ID token with Firebase
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // Here you would typically save/update user in your database
    const userData = {
      uid,
      email,
      name: name || decodedToken.firebase?.identities?.['google.com']?.[0] || email,
      picture,
      provider: 'google',
    };

    res.json({
      success: true,
      message: 'Google sign-in successful',
      user: userData,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid Google token',
    });
  }
});

export default router;