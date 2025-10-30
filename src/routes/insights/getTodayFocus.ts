// src/routes/insights/getTodayFocus.ts
import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();


router.get('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, error: 'Missing userId' });

  try {
    const userRef = db.collection('users').doc(userId);
    const focusCol = userRef.collection('focus');

    const now = new Date();
    const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfTomorrowUTC = new Date(startOfTodayUTC.getTime() + 24 * 60 * 60 * 1000);

    // Only today's sessions (two queries for OR: starts today OR ends today)
    const [qStart, qEnd] = await Promise.all([
      focusCol.where('startTs', '>=', startOfTodayUTC).where('startTs', '<', startOfTomorrowUTC).get(),
      focusCol.where('endTs', '>=', startOfTodayUTC).where('endTs', '<', startOfTomorrowUTC).get(),
    ]);

    const map = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    qStart.forEach(d => map.set(d.id, d));
    qEnd.forEach(d => map.set(d.id, d));

    const secByHour = Array(24).fill(0) as number[];

    for (const snap of map.values()) {
      const data: any = snap.data();
      if (data?.activity !== 'Study') continue;

      const start: Date = typeof data.startTs?.toDate === 'function' ? data.startTs.toDate() : new Date(data.startTs);
      const end: Date   = typeof data.endTs?.toDate   === 'function' ? data.endTs.toDate()   : new Date(data.endTs);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

      // clamp to today's window
      let s = new Date(Math.max(start.getTime(), startOfTodayUTC.getTime()));
      const e = new Date(Math.min(end.getTime(), startOfTomorrowUTC.getTime()));
      if (e <= s) continue;

      // distribute across hour buckets
      while (s < e) {
        const hourIdx = s.getUTCHours(); // UTC hours
        const nextHour = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), s.getUTCHours() + 1));
        const chunkEnd = e < nextHour ? e : nextHour;
        secByHour[hourIdx] += Math.max(0, Math.floor((chunkEnd.getTime() - s.getTime()) / 1000));
        s = chunkEnd;
      }
    }

    const minutesByHour = secByHour.map(sec => Math.floor(sec / 60));
    const totalMinutes = minutesByHour.reduce((a, b) => a + b, 0);

    return res.status(200).json({
      success: true,
      data: { minutesByHour, totalMinutes },
    });
  } catch (e: any) {
    console.error('❌ Error building today insights:', e);
    return res.status(500).json({ success: false, error: 'Failed to build today insights' });
  }
});

export default router;
