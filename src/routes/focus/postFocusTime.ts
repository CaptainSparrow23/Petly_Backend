import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

// Simple route to update daily focus time
router.post('/session', async (req: Request, res: Response) => {
  const { userId, duration } = req.body; // duration in milliseconds

  if (!userId || duration === undefined) {
    return res.status(400).json({ 
      error: 'Missing required fields: userId, duration' 
    });
  }

  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const dateKey = today.toISOString().split('T')[0]; // 2025-10-15

    // Convert duration from milliseconds to minutes and seconds
    const totalSeconds = Math.floor(duration / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeString = `${minutes} min${minutes !== 1 ? 's' : ''} ${seconds} sec${seconds !== 1 ? 's' : ''}`;

    // Reference to user's focus data
    const userDocRef = db.collection('users').doc(userId).collection('focus').doc(dateKey);
    
    // Get existing time for today (if any)
    const existingDoc = await userDocRef.get();
    let existingSeconds = 0;
    
    if (existingDoc.exists) {
      const data = existingDoc.data();
      if (data && data.totalSeconds) {
        existingSeconds = data.totalSeconds;
      }
    }

    // Add new session time to existing time
    const newTotalSeconds = existingSeconds + totalSeconds;
    const newMinutes = Math.floor(newTotalSeconds / 60);
    const newSecondsRemainder = newTotalSeconds % 60;
    const newTimeString = `${newMinutes} min${newMinutes !== 1 ? 's' : ''} ${newSecondsRemainder} sec${newSecondsRemainder !== 1 ? 's' : ''}`;

    // Save to Firebase
    await userDocRef.set({
      date: dateKey,
      timeString: newTimeString,
      totalSeconds: newTotalSeconds,
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    console.log(`💾 Focus time updated for user ${userId}:`);
    console.log(`   Date: ${dateKey}`);
    console.log(`   Session: ${timeString}`);
    console.log(`   Total today: ${newTimeString}`);

    res.status(200).json({
      message: 'Focus time updated successfully',
      date: dateKey,
      sessionTime: timeString,
      totalToday: newTimeString
    });

  } catch (error) {
    console.error('Error updating focus time:', error);
    
    // Check if it's a Firestore "not found" error
    if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
      return res.status(500).json({
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first',
        details: 'Go to https://console.firebase.google.com and enable Firestore Database'
      });
    }
    
    res.status(500).json({
      error: 'Failed to update focus time',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;