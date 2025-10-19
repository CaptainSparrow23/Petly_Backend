import { Router, Request, Response } from 'express';
import admin, { db } from '../../firebase';

const router = Router();

const VALID_FOCUS_MODES = ['Study', 'Work', 'Break', 'Rest'] as const;
type FocusMode = typeof VALID_FOCUS_MODES[number];

const formatDurationLabel = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} min${minutes !== 1 ? 's' : ''} ${seconds} sec${seconds !== 1 ? 's' : ''}`;
};

// Simple route to update daily focus time
router.post('/session', async (req: Request, res: Response) => {
  const { userId, duration, mode, startTime, endTime } = req.body as {
    userId?: string;
    duration?: number;
    mode?: FocusMode | string;
    startTime?: number;
    endTime?: number;
  }; // duration in milliseconds

  const normalizedMode = typeof mode === 'string' ? mode.trim() : undefined;

  if (
    !userId ||
    duration === undefined ||
    !normalizedMode ||
    startTime === undefined ||
    endTime === undefined
  ) {
    return res.status(400).json({ 
      error: 'Missing required fields: userId, duration, mode, startTime, endTime' 
    });
  }

  if (!VALID_FOCUS_MODES.includes(normalizedMode as FocusMode)) {
    return res.status(400).json({
      error: `Invalid focus mode: ${normalizedMode}. Expected one of ${VALID_FOCUS_MODES.join(', ')}`,
    });
  }

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return res.status(400).json({
      error: 'Invalid startTime or endTime value',
    });
  }

  if (endTime < startTime) {
    return res.status(400).json({
      error: 'endTime must be greater than or equal to startTime',
    });
  }

  try {
    // Get today's date in YYYY-MM-DD format
    const sessionEnd = new Date(endTime);
    const today = sessionEnd;
    const dateKey = today.toISOString().split('T')[0]; // 2025-10-15

    // Convert duration from milliseconds to minutes and seconds
    const totalSeconds = Math.floor(duration / 1000);
    const timeString = formatDurationLabel(totalSeconds);

    // Reference to user's focus data
    const userDocRef = db.collection('users').doc(userId).collection('focus').doc(dateKey);
    
    // Get existing time for today (if any)
    const existingDoc = await userDocRef.get();
    let existingSeconds = 0;
    let existingModes: Record<string, { totalSeconds?: number; totalMinutes?: number; timeString?: string }> = {};
    
    if (existingDoc.exists) {
      const data = existingDoc.data();
      if (data && data.totalSeconds) {
        existingSeconds = data.totalSeconds;
      }
      if (data && data.modes && typeof data.modes === 'object') {
        existingModes = data.modes as typeof existingModes;
      }
    }

    // Add new session time to existing time
    const newTotalSeconds = existingSeconds + totalSeconds;
    const newMinutes = Math.floor(newTotalSeconds / 60);
    const newSecondsRemainder = newTotalSeconds % 60;
    const newTimeString = `${newMinutes} min${newMinutes !== 1 ? 's' : ''} ${newSecondsRemainder} sec${newSecondsRemainder !== 1 ? 's' : ''}`;

    const modeKey = normalizedMode as FocusMode;
    const currentModeEntry = existingModes[modeKey] ?? { totalSeconds: 0 };
    const modeTotalSeconds = (currentModeEntry.totalSeconds ?? 0) + totalSeconds;
    const modeTimeString = formatDurationLabel(modeTotalSeconds);
    const modeTotalMinutes = Math.floor(modeTotalSeconds / 60);

    const updatedModes = {
      ...existingModes,
      [modeKey]: {
        totalSeconds: modeTotalSeconds,
        totalMinutes: modeTotalMinutes,
        timeString: modeTimeString,
        lastUpdated: new Date().toISOString(),
      },
    };

    // Save to Firebase
    const sessionEntry = {
      startTime: new Date(startTime).toISOString(),
      endTime: sessionEnd.toISOString(),
      durationSeconds: totalSeconds,
      durationMinutes: Math.floor(totalSeconds / 60),
      mode: normalizedMode,
      recordedAt: new Date().toISOString(),
    };

    await userDocRef.set(
      {
        date: dateKey,
        timeString: newTimeString,
        totalSeconds: newTotalSeconds,
        totalMinutes: newMinutes,
        lastUpdated: new Date().toISOString(),
        modes: updatedModes,
        sessions: admin.firestore.FieldValue.arrayUnion(sessionEntry),
      },
      { merge: true }
    );

    // Update lifetime aggregates on the user document
    const userSummaryRef = db.collection('users').doc(userId);
    const userSummaryDoc = await userSummaryRef.get();
    const lifetimeData = userSummaryDoc.exists ? userSummaryDoc.data()?.focusLifetime : null;

    const lifetimeTotalSeconds = (lifetimeData?.totalSeconds ?? 0) + totalSeconds;
    const lifetimeTotalMinutes = Math.floor(lifetimeTotalSeconds / 60);
    const lifetimeTimeString = formatDurationLabel(lifetimeTotalSeconds);
    const lifetimeModesRaw = (lifetimeData?.modes ?? {}) as Record<string, { totalSeconds?: number; totalMinutes?: number; timeString?: string }>;
    const lifetimeModeEntry = lifetimeModesRaw[modeKey] ?? { totalSeconds: 0 };
    const lifetimeModeSeconds = (lifetimeModeEntry.totalSeconds ?? 0) + totalSeconds;
    const lifetimeModes = {
      ...lifetimeModesRaw,
      [modeKey]: {
        totalSeconds: lifetimeModeSeconds,
        totalMinutes: Math.floor(lifetimeModeSeconds / 60),
        timeString: formatDurationLabel(lifetimeModeSeconds),
        lastUpdated: new Date().toISOString(),
      },
    };

    await userSummaryRef.set({
      focusLifetime: {
        totalSeconds: lifetimeTotalSeconds,
        totalMinutes: lifetimeTotalMinutes,
        timeString: lifetimeTimeString,
        modes: lifetimeModes,
        lastUpdated: new Date().toISOString(),
      },
    }, { merge: true });

    console.log(`💾 Focus time updated for user ${userId}:`);
    console.log(`   Date: ${dateKey}`);
    console.log(`   Session: ${timeString}`);
    console.log(`   Total today: ${newTimeString}`);

    res.status(200).json({
      message: 'Focus time updated successfully',
      date: dateKey,
      sessionTime: timeString,
      totalToday: newTimeString,
      mode,
      modeTotals: updatedModes,
      session: sessionEntry,
    });

  } catch (error) {
    console.error('Error updating focus time:', error);
    
    // Check if it's a Firestore "not found" error
    if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
      return res.status(500).json({
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first',
        details: 'Go to https://console.firebase.google.com and enable Firestore Database'
      });
    }
    
    res.status(500).json({
      error: 'Failed to update focus time',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

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
