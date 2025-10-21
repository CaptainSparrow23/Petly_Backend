import { Router, Request, Response } from 'express';
import { db } from '../../firebase';

const router = Router();

const formatDurationLabel = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} min${minutes !== 1 ? 's' : ''} ${seconds} sec${seconds !== 1 ? 's' : ''}`;
};

// GET route to fetch weekly focus data for a user
router.get('/weekly-focus/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ 
      error: 'Missing required parameter: userId' 
    });
  }

  try {
    // Get the last 7 days including today
    const getLastSevenDays = () => {
      const days = [];
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue, etc.
        days.push({ date: dateString, dayName });
      }
      
      return days;
    };

    const lastSevenDays = getLastSevenDays();
    type WeeklyFocusSession = {
      startTime: string;
      endTime: string;
      durationSeconds: number;
      durationMinutes: number;
      mode?: string;
    };

    const weeklyData: Array<{
      date: string;
      dayName: string;
      totalMinutes: number;
      timeString: string;
      modes: Record<string, { totalSeconds: number; totalMinutes: number; timeString: string }>;
      sessions: WeeklyFocusSession[];
    }> = [];
    const todayString = new Date().toISOString().split('T')[0];

    // Fetch focus data for each day
    for (const day of lastSevenDays) {
      const userDocRef = db.collection('users').doc(userId).collection('focus').doc(day.date);
      const doc = await userDocRef.get();

      if (doc.exists) {
        const data = doc.data();
        const totalMinutes = Math.floor((data?.totalSeconds || 0) / 60);
        const modesRaw = data?.modes && typeof data.modes === 'object'
          ? (data.modes as Record<string, { totalSeconds?: number; timeString?: string; totalMinutes?: number }>)
          : {};
        const modes = Object.entries(modesRaw).reduce<Record<string, { totalSeconds: number; totalMinutes: number; timeString: string }>>((acc, [modeKey, value]) => {
          const modeSeconds = typeof value?.totalSeconds === 'number' ? value.totalSeconds : 0;
          acc[modeKey] = {
            totalSeconds: modeSeconds,
            totalMinutes: Math.floor(modeSeconds / 60),
            timeString: value?.timeString || formatDurationLabel(modeSeconds),
          };
          return acc;
        }, {});
        const sessionsRaw = Array.isArray(data?.sessions) ? (data.sessions as Array<Record<string, unknown>>) : [];
        const sessions = sessionsRaw.reduce<WeeklyFocusSession[]>((acc, session) => {
          const startTime = typeof session?.startTime === 'string' ? session.startTime : null;
          const endTime = typeof session?.endTime === 'string' ? session.endTime : null;
          if (!startTime || !endTime) {
            return acc;
          }

          const durationSeconds =
            typeof session?.durationSeconds === 'number'
              ? Math.max(0, Math.round(session.durationSeconds))
              : typeof session?.durationMinutes === 'number'
              ? Math.max(0, Math.round(session.durationMinutes * 60))
              : 0;
          const durationMinutes = Math.max(0, Math.round(durationSeconds / 60));
          const modeValue = typeof session?.mode === 'string' ? session.mode : undefined;

          acc.push({
            startTime,
            endTime,
            durationSeconds,
            durationMinutes,
            mode: modeValue,
          });
          return acc;
        }, []);
        
        weeklyData.push({
          date: day.date,
          dayName: day.dayName,
          totalMinutes,
          timeString: data?.timeString || '0 mins',
          modes,
          sessions,
        });
      } else {
        // No data for this day
        weeklyData.push({
          date: day.date,
          dayName: day.dayName,
          totalMinutes: 0,
         timeString: '0 mins',
         modes: {},
         sessions: [],
        });
      }
    }

    // Aggregate totals
    const aggregateModes = (
      items: typeof weeklyData
    ): Record<string, { totalSeconds: number }> => {
      return items.reduce<Record<string, { totalSeconds: number }>>(
        (acc, item) => {
          Object.entries(item.modes).forEach(([modeKey, modeValue]) => {
            const seconds = modeValue.totalSeconds ?? 0;
            acc[modeKey] = {
              totalSeconds: (acc[modeKey]?.totalSeconds ?? 0) + seconds,
            };
          });
          return acc;
        },
        {}
      );
    };

    const summarize = (
      totalSeconds: number,
      modes: Record<string, { totalSeconds: number }>
    ) => {
      const totalMinutes = Math.floor(totalSeconds / 60);
      const summarizedModes = Object.entries(modes).reduce<
        Record<string, { totalSeconds: number; totalMinutes: number; timeString: string }>
      >((acc, [modeKey, value]) => {
        const modeSeconds = value.totalSeconds ?? 0;
        acc[modeKey] = {
          totalSeconds: modeSeconds,
          totalMinutes: Math.floor(modeSeconds / 60),
          timeString: formatDurationLabel(modeSeconds),
        };
        return acc;
      }, {});

      return {
        totalSeconds,
        totalMinutes,
        timeString: formatDurationLabel(totalSeconds),
        modes: summarizedModes,
      };
    };

    const weeklyTotalSeconds = weeklyData.reduce((sum, item) => sum + (item.totalMinutes * 60), 0);
    const weeklyModesAggregate = aggregateModes(weeklyData);
    const weeklySummary = summarize(weeklyTotalSeconds, weeklyModesAggregate);

    const todayEntry = weeklyData.find((item) => item.date === todayString);
    const todaySummary = todayEntry
      ? summarize((todayEntry.totalMinutes ?? 0) * 60, aggregateModes([todayEntry]))
      : summarize(0, {} as Record<string, { totalSeconds: number }>);

    // Lifetime summary from user doc
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    const lifetimeData = userDoc.exists ? userDoc.data()?.focusLifetime : null;
    const lifetimeSummary = (() => {
      if (!lifetimeData) {
        return summarize(0, {} as Record<string, { totalSeconds: number }>);
      }

      const lifetimeModesRaw = (lifetimeData.modes ?? {}) as Record<
        string,
        { totalSeconds?: number; totalMinutes?: number; timeString?: string }
      >;

      const lifetimeModes = Object.entries(lifetimeModesRaw).reduce<
        Record<string, { totalSeconds: number; totalMinutes: number; timeString: string }>
      >((acc, [modeKey, value]) => {
        const modeSeconds = value?.totalSeconds ?? 0;
        acc[modeKey] = {
          totalSeconds: modeSeconds,
          totalMinutes: Math.floor(modeSeconds / 60),
          timeString: value?.timeString ?? formatDurationLabel(modeSeconds),
        };
        return acc;
      }, {});

      const totalSeconds = lifetimeData.totalSeconds ?? 0;
      return {
        totalSeconds,
        totalMinutes: lifetimeData.totalMinutes ?? Math.floor(totalSeconds / 60),
        timeString: lifetimeData.timeString ?? formatDurationLabel(totalSeconds),
        modes: lifetimeModes,
      };
    })();

    console.log(`📊 Weekly focus data fetched for user`);

    res.status(200).json({
      success: true,
      data: weeklyData,
      summary: {
        today: todaySummary,
        week: weeklySummary,
        lifetime: lifetimeSummary,
      },
      message: 'Weekly focus data retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching weekly focus data:', error);
    
    // Check if it's a Firestore "not found" error
    if (error && typeof error === 'object' && 'code' in error && error.code === 5) {
      return res.status(500).json({
        success: false,
        error: 'Firestore database not found',
        message: 'Please create a Firestore database in your Firebase console first'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weekly focus data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
