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

    const now = new Date();
    const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfYesterdayUTC = new Date(startOfTodayUTC.getTime() - 24 * 60 * 60 * 1000);

    let status: 'ok' | 'reset' = 'ok';

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.exists ? (snap.data() as any) : {};

      const prevStreak = Number.isFinite(data?.dailyStreak) ? Number(data.dailyStreak) : 0;

      const lastUpdRaw = data?.lastUpdatedDailyStreak as
        | FirebaseFirestore.Timestamp
        | Date
        | string
        | undefined;

      let lastUpdDate: Date | null = null;
      if (lastUpdRaw) {
        if (typeof (lastUpdRaw as any)?.toDate === 'function') {
          lastUpdDate = (lastUpdRaw as any).toDate();
        } else if (typeof lastUpdRaw === 'string') {
          const d = new Date(lastUpdRaw);
          if (!isNaN(d.getTime())) lastUpdDate = d;
        } else if (lastUpdRaw instanceof Date) {
          lastUpdDate = lastUpdRaw;
        }
      }

      // If last update is strictly before start of yesterday, streak is broken → reset to 0.
      const broken = !lastUpdDate || lastUpdDate.getTime() < startOfYesterdayUTC.getTime();

      if (broken) {
        status = 'reset';
        tx.set(
          userRef,
          {
            dailyStreak: 0,

          },
          { merge: true }
        );
        return { dailyStreak: 0, lastUpdatedDailyStreak: lastUpdDate?.toISOString() };
      } else {
        return {
          dailyStreak: prevStreak,
          lastUpdatedDailyStreak: lastUpdDate?.toISOString(),
        };
      }
    });

    return res.status(200).json({
      success: true,
      data: { ...result, status },
    });
  } catch (e: any) {
    console.error('Error getting daily streak:', e);
    return res.status(500).json({ success: false, error: 'Failed to get daily streak' });
  }
});

export default router;
