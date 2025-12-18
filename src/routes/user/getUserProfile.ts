import { Router, Request, Response } from 'express';
import { db } from '../../firebase';
import { DateTime } from 'luxon';
import { ensureDailyRollupsInRange, normalizeTz } from '../../utils/rollups';

const router = Router();

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

router.get('/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const tz = normalizeTz(req.query.tz as string | undefined); // Accept timezone from query
  
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
    console.log(`[getUserProfile] Read user ${userId}. selectedPet: ${userData?.selectedPet}`);

    // Fetch pet friendship XP (subcollection)
    const petFriendshipsSnap = await userRef.collection('petFriendships').get();
    const petFriendships: Record<string, { totalXP: number; totalFocusSeconds: number }> = {};
    petFriendshipsSnap.forEach((doc) => {
      const d = doc.data() as any;
      petFriendships[doc.id] = { 
        totalXP: toNumber(d?.totalXP),
        totalFocusSeconds: toNumber(d?.totalFocusSeconds, 0)
      };
    });

    // Calculate today using the user's timezone
    const now = DateTime.now().setZone(tz);
    const startOfToday = now.startOf('day');
    const startOfTomorrow = startOfToday.plus({ days: 1 });
    const todayId = startOfToday.toISODate()!;

    const daily = await ensureDailyRollupsInRange({
      userId,
      tz,
      rangeStart: startOfToday,
      rangeEndExclusive: startOfTomorrow,
    });

    const rollup = daily.get(todayId) as any | undefined;
    const timeActiveToday = typeof rollup?.totalSeconds === 'number' ? rollup.totalSeconds : 0;
    const byHourSeconds = (rollup?.byHourSeconds ?? {}) as Record<string, unknown>;
    const minutesByHour = Array.from({ length: 24 }, (_, h) => {
      const sec = Number(byHourSeconds[String(h)] ?? 0) || 0;
      return Math.floor(sec / 60);
    });

    // Friends summary (lightweight) - full details are fetched via /api/get_friends
    const friendsArray = Array.isArray(userData?.friends) ? (userData!.friends as string[]) : [];
    const friendsCount = friendsArray.length;
    
    // Compute hasFriendRequests from requests array (always accurate, can't get out of sync)
    const requestsArray = Array.isArray(userData?.requests) ? (userData!.requests as string[]) : [];
    const hasFriendRequests = requestsArray.length > 0;

    const profileData = {
      userId,
      username: userData?.username ?? null,
      displayName: userData?.displayName ?? null,
      selectedPet: userData?.selectedPet ?? 'pet_smurf',
      email: userData?.email ?? null,
      profileId: typeof userData?.profileId === 'number' ? userData?.profileId : Number(userData?.profileId) || null,
      allowFriendRequests:
        typeof userData?.allowFriendRequests === 'boolean'
          ? userData.allowFriendRequests
          : true,
      timeActiveToday, // in seconds
      minutesByHour, // 24-element array for today's hourly breakdown
      coins: toNumber(userData?.coins),
      ownedPets: Array.isArray(userData?.ownedPets)
        ? (userData.ownedPets as string[])
        : ['pet_smurf'],
      ownedHats: Array.isArray(userData?.ownedHats)
        ? (userData.ownedHats as string[])
        : [],
      ownedFaces: Array.isArray(userData?.ownedFaces)
        ? (userData.ownedFaces as string[])
        : [],
      ownedCollars: Array.isArray(userData?.ownedCollars)
        ? (userData.ownedCollars as string[])
        : [],
      ownedGadgets: Array.isArray(userData?.ownedGadgets)
        ? (userData.ownedGadgets as string[])
        : ['gadget_laptop'],
      selectedHat: userData?.selectedHat ?? null,
      selectedFace: userData?.selectedFace ?? null,
      selectedCollar: userData?.selectedCollar ?? null,
      selectedGadget: userData?.selectedGadget ?? 'gadget_laptop',
      selectedTag: userData?.selectedTag ?? null,
      dailyStreak: toNumber(userData?.dailyStreak),
      highestStreak: toNumber(userData?.highestStreak),
      totalFocusSeconds: toNumber(userData?.totalFocusSeconds),
      lastDailyGoalClaim: userData?.lastDailyGoalClaim ?? null,
      lastWeeklyGoalClaim: userData?.lastWeeklyGoalClaim ?? null,
      claimedLevelRewards: Array.isArray(userData?.claimedLevelRewards)
        ? (userData.claimedLevelRewards as number[])
        : [],
      totalXP: toNumber(userData?.totalXP),
      friendsCount,
      petFriendships,
      hasFriendRequests,
      tagList: Array.isArray(userData?.tagList) ? userData.tagList : [
        { id: 'focus', label: 'Focus', color: '#FE534B', activity: 'Focus' },
        { id: 'rest', label: 'Rest', color: '#9AA587', activity: 'Rest' },
        { id: 'work', label: 'Work', color: '#63C5B8', activity: 'Focus' },
        { id: 'study', label: 'Study', color: '#6EC1E4', activity: 'Focus' },
      ],
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
