import { Router, Request, Response } from 'express';
import { db } from '../../firebase';
import { DateTime } from 'luxon';

const router = Router();

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

router.get('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const tz = (req.query.tz as string) || 'Europe/London'; // Accept timezone from query, default to London
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'Missing required parameter: userId' });
  }

  try {
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'No profile exists for this user',
      });
    }

    const userData = userSnap.data();

    // Calculate today using the user's timezone (not UTC)
    const now = DateTime.now().setZone(tz);
    const startOfTodayLocal = now.startOf('day').toJSDate();
    const startOfTomorrowLocal = now.plus({ days: 1 }).startOf('day').toJSDate();

    console.log(`📅 User TZ: ${tz}, Today range: ${startOfTodayLocal.toISOString()} to ${startOfTomorrowLocal.toISOString()}`);

    const focusCol = userRef.collection('focus');

    // Query only today's sessions
    const [qStartSnap, qEndSnap] = await Promise.all([
      focusCol.where('startTs', '>=', startOfTodayLocal).where('startTs', '<', startOfTomorrowLocal).get(),
      focusCol.where('endTs', '>=', startOfTodayLocal).where('endTs', '<', startOfTomorrowLocal).get(),
    ]);

    // Merge both result sets
    const docsMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    qStartSnap.forEach((d) => docsMap.set(d.id, d));
    qEndSnap.forEach((d) => docsMap.set(d.id, d));

    let totalFocusSecToday = 0;
    const secByHour = Array(24).fill(0) as number[];

    for (const d of docsMap.values()) {
      const data: any = d.data();
      if (data?.activity !== 'Focus' && data?.activity !== 'Rest') continue;

      const start: Date =
        typeof data.startTs?.toDate === 'function' ? data.startTs.toDate() : new Date(data.startTs);
      const end: Date =
        typeof data.endTs?.toDate === 'function' ? data.endTs.toDate() : new Date(data.endTs);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

      // Clamp to today's window
      let s = new Date(Math.max(start.getTime(), startOfTodayLocal.getTime()));
      const e = new Date(Math.min(end.getTime(), startOfTomorrowLocal.getTime()));
      if (e <= s) continue;

      // Calculate total for the session
      const sessionSec = Math.floor((e.getTime() - s.getTime()) / 1000);
      totalFocusSecToday += sessionSec;

      // Distribute across hour buckets (using the user's timezone for hour extraction)
      while (s < e) {
        const sLuxon = DateTime.fromJSDate(s).setZone(tz);
        const hourIdx = sLuxon.hour;
        const nextHour = sLuxon.plus({ hours: 1 }).startOf('hour').toJSDate();
        const chunkEnd = e < nextHour ? e : nextHour;
        secByHour[hourIdx] += Math.max(0, Math.floor((chunkEnd.getTime() - s.getTime()) / 1000));
        s = chunkEnd;
      }
    }

    const timeActiveToday = totalFocusSecToday; // now in seconds (not minutes)
    const minutesByHour = secByHour.map(sec => Math.floor(sec / 60));

    const profileData = {
      userId,
      username: userData?.username ?? null,
      displayName: userData?.displayName ?? null,
      selectedPet: userData?.selectedPet ?? 'pet_skye',
      email: userData?.email ?? null,
      profileId: typeof userData?.profileId === 'number' ? userData?.profileId : Number(userData?.profileId) || null,
      timeActiveToday, // in seconds
      minutesByHour, // 24-element array for today's hourly breakdown
      coins: toNumber(userData?.coins),
      ownedPets: Array.isArray(userData?.ownedPets)
        ? (userData.ownedPets as string[])
        : ['pet_skye'],
      dailyStreak: toNumber(userData?.dailyStreak),
      highestStreak: toNumber(userData?.highestStreak),
      totalFocusSeconds: toNumber(userData?.totalFocusSeconds),
    };

    return res
      .status(200)
      .json({ success: true, data: profileData, message: 'Profile retrieved successfully' });
  } catch (error: any) {
    console.error('❌ Error fetching user profile:', error);
    if (error?.code === 5) {
      return res.status(500).json({
        success: false,
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
