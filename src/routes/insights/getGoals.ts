import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

router.get('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing userId' });
  }

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const userData = userDoc.data();
    
    // Default goals if not set
    const dailyGoalMinutes = userData?.dailyGoalMinutes ?? 120; // 2 hours default
    const weeklyGoalMinutes = userData?.weeklyGoalMinutes ?? 600; // 10 hours default

    return res.status(200).json({
      success: true,
      data: {
        dailyGoalMinutes,
        weeklyGoalMinutes,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching goals:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch goals',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
