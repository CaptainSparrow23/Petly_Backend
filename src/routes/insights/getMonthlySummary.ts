import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

router.get('/monthly-summary/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      error: 'Missing required parameter: userId',
    });
  }

  try {
    const now = new Date();
    const months: Array<{
      key: string;
      label: string;
      totalSeconds: number;
    }> = [];

    for (let offset = 5; offset >= 0; offset -= 1) {
      const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
      const key = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`;
      const label = monthDate.toLocaleDateString('en-US', { month: 'short' });
      months.push({ key, label, totalSeconds: 0 });
    }

    const monthLookup = new Map(months.map((entry) => [entry.key, entry]));
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const startKey = startDate.toISOString().split('T')[0];
    const endKey = endDate.toISOString().split('T')[0];

    const focusCollection = db.collection('users').doc(userId).collection('focus');
    const snapshot = await focusCollection.where('date', '>=', startKey).get();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const dateString = typeof data?.date === 'string' ? data.date : doc.id;
      if (!dateString) return;
      if (dateString < startKey || dateString > endKey) return;

      const [yearStr, monthStr] = dateString.split('-');
      if (!yearStr || !monthStr) return;
      const monthKey = `${yearStr}-${monthStr}`;
      const bucket = monthLookup.get(monthKey);
      if (!bucket) return;

      const docSeconds =
        typeof data?.totalSeconds === 'number'
          ? data.totalSeconds
          : typeof data?.totalMinutes === 'number'
          ? data.totalMinutes * 60
          : 0;
      bucket.totalSeconds += docSeconds;
    });

    const result = months.map(({ key, label, totalSeconds }) => ({
      month: key,
      label,
      totalSeconds,
      totalMinutes: Math.floor(totalSeconds / 60),
    }));

    res.status(200).json({
      success: true,
      data: result,
      range: {
        startMonth: months[0]?.key ?? null,
        endMonth: months[months.length - 1]?.key ?? null,
      },
    });
  } catch (error) {
    console.error('Error fetching monthly focus summary:', error);

    if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 5) {
      return res.status(500).json({
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first',
        details: 'Go to https://console.firebase.google.com and enable Firestore Database',
      });
    }

    res.status(500).json({
      error: 'Failed to fetch monthly focus summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
