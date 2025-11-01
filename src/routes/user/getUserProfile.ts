import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

router.get('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
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

    // Calculate today (UTC)
    const now = new Date();
    const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfTomorrowUTC = new Date(startOfTodayUTC.getTime() + 24 * 60 * 60 * 1000);

    const focusCol = userRef.collection('focus');

    // Query only today's sessions
    const [qStartSnap, qEndSnap] = await Promise.all([
      focusCol.where('startTs', '>=', startOfTodayUTC).where('startTs', '<', startOfTomorrowUTC).get(),
      focusCol.where('endTs', '>=', startOfTodayUTC).where('endTs', '<', startOfTomorrowUTC).get(),
    ]);

    // Merge both result sets
    const docsMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    qStartSnap.forEach((d) => docsMap.set(d.id, d));
    qEndSnap.forEach((d) => docsMap.set(d.id, d));

    let totalStudySecToday = 0;
    const secByHour = Array(24).fill(0) as number[];

    for (const d of docsMap.values()) {
      const data: any = d.data();
      if (data?.activity !== 'Study') continue;

      const start: Date =
        typeof data.startTs?.toDate === 'function' ? data.startTs.toDate() : new Date(data.startTs);
      const end: Date =
        typeof data.endTs?.toDate === 'function' ? data.endTs.toDate() : new Date(data.endTs);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

      // Clamp to today's window
      let s = new Date(Math.max(start.getTime(), startOfTodayUTC.getTime()));
      const e = new Date(Math.min(end.getTime(), startOfTomorrowUTC.getTime()));
      if (e <= s) continue;

      // Calculate total for the session
      const sessionSec = Math.floor((e.getTime() - s.getTime()) / 1000);
      totalStudySecToday += sessionSec;

      // Distribute across hour buckets
      while (s < e) {
        const hourIdx = s.getUTCHours(); // UTC hours
        const nextHour = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), s.getUTCHours() + 1));
        const chunkEnd = e < nextHour ? e : nextHour;
        secByHour[hourIdx] += Math.max(0, Math.floor((chunkEnd.getTime() - s.getTime()) / 1000));
        s = chunkEnd;
      }
    }

    const timeActiveToday = totalStudySecToday; // now in seconds (not minutes)
    const minutesByHour = secByHour.map(sec => Math.floor(sec / 60));

    const profileData = {
      userId,
      username: userData?.username ?? null,
      displayName: userData?.displayName ?? null,
      selectedPet: userData?.selectedPet ?? null,
      email: userData?.email ?? null,
      profileId: userData?.profileId ?? null,
      timeActiveToday, // in seconds
      minutesByHour, // 24-element array for today's 3-hour interval chart
      coins: userData?.coins ?? 0,
      ownedPets: Array.isArray(userData?.ownedPets)
        ? (userData.ownedPets as string[])
        : ['pet_skye'],
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
