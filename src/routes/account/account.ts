import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

// GET route to fetch weekly focus data for a user
router.get('/weekly-focus/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ 
      error: 'Missing required parameter: userId' 
    });
  }

  try {
    // Get the last 7 days including today
    const getLastSevenDays = () => {
      const days = [];
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue, etc.
        days.push({ date: dateString, dayName });
      }
      
      return days;
    };

    const lastSevenDays = getLastSevenDays();
    const weeklyData = [];

    // Fetch focus data for each day
    for (const day of lastSevenDays) {
      const userDocRef = db.collection('users').doc(userId).collection('focus').doc(day.date);
      const doc = await userDocRef.get();

      if (doc.exists) {
        const data = doc.data();
        const totalMinutes = Math.floor((data?.totalSeconds || 0) / 60);
        
        weeklyData.push({
          date: day.date,
          dayName: day.dayName,
          totalMinutes,
          timeString: data?.timeString || '0 mins'
        });
      } else {
        // No data for this day
        weeklyData.push({
          date: day.date,
          dayName: day.dayName,
          totalMinutes: 0,
          timeString: '0 mins'
        });
      }
    }

    console.log(`📊 Weekly focus data fetched for user ${userId}:`, weeklyData.map(d => `${d.dayName}: ${d.timeString}`));

    res.status(200).json({
      success: true,
      data: weeklyData,
      message: 'Weekly focus data retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching weekly focus data:', error);
    
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
      error: 'Failed to fetch weekly focus data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;