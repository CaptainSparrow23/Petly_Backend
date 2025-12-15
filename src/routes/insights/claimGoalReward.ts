import { Router, Request, Response } from 'express';
import { db } from '../../firebase';
import { awardXpAndUpdateLevel } from '../../utils/xpRewards';

const router = Router();

// XP rewards for goals
const REWARDS = {
  daily: { amount: 25, claimField: 'lastDailyGoalClaim' },
  weekly: { amount: 50, claimField: 'lastWeeklyGoalClaim' },
} as const;

type GoalType = keyof typeof REWARDS;

const getWeekString = (date: Date): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
};

const getTodayString = (): string => new Date().toISOString().split('T')[0];

router.post('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { goalType } = req.body ?? {};

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing required parameter: userId' });
  }

  if (goalType !== 'daily' && goalType !== 'weekly') {
    return res.status(400).json({ success: false, error: 'Invalid goalType. Must be "daily" or "weekly".' });
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userData = userDoc.data() ?? {};

    const now = new Date();
    const currentPeriod = goalType === 'daily' ? getTodayString() : getWeekString(now);
    const { amount, claimField } = REWARDS[goalType as GoalType];

    // Check if already claimed for this period
    if (userData[claimField] === currentPeriod) {
      return res.status(400).json({
        success: false,
        error: `${goalType} goal reward already claimed`,
        alreadyClaimed: true,
      });
    }

    // Award XP using shared utility (updates totalXP & returns level info)
    const { oldLevel, newLevel } = await awardXpAndUpdateLevel(userDocRef, amount);

    // Mark this goal as claimed for the current period
    await userDocRef.set(
      {
        [claimField]: currentPeriod,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      message: `${goalType} goal reward claimed!`,
      data: {
        rewardAmount: amount,
        xpAwarded: amount,
        oldLevel,
        newLevel,
        claimedAt: currentPeriod,
      },
    });
  } catch (error) {
    console.error('❌ Error claiming goal reward:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to claim reward',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
