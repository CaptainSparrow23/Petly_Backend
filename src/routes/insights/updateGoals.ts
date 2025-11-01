import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

router.put('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { dailyGoalMinutes, weeklyGoalMinutes } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing userId' });
  }

  if (typeof dailyGoalMinutes !== 'number' || typeof weeklyGoalMinutes !== 'number') {
    return res.status(400).json({
      success: false,
      error: 'Invalid goals: dailyGoalMinutes and weeklyGoalMinutes must be numbers',
    });
  }

  if (dailyGoalMinutes < 0 || weeklyGoalMinutes < 0) {
    return res.status(400).json({
      success: false,
      error: 'Goals must be positive numbers',
    });
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

    await userRef.set(
      {
        dailyGoalMinutes,
        weeklyGoalMinutes,
      },
      { merge: true }
    );

    console.log(`✅ Updated goals for user ${userId}: daily=${dailyGoalMinutes}, weekly=${weeklyGoalMinutes}`);

    return res.status(200).json({
      success: true,
      message: 'Goals updated successfully',
      data: {
        dailyGoalMinutes,
        weeklyGoalMinutes,
      },
    });
  } catch (error) {
    console.error('❌ Error updating goals:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update goals',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
