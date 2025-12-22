import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { db } from "../../firebase"; // your initialized admin/db module
import { awardXpAndUpdateLevel } from "../../utils/xpRewards";
import { DateTime } from "luxon";

const router = Router();

const toDateFromIso = (value: unknown) => {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
};

type DayAgg = { totalSeconds: number; byHourSeconds: number[] };

async function incrementRollupsForSession(opts: {
  userId: string;
  tz: string;
  tagId: string | null;
  start: Date;
  end: Date;
}) {
  const { userId, tz, tagId, start, end } = opts;
  const tagKey = tagId && tagId.trim().length > 0 ? tagId.trim() : "_unknown";

  const sessionStart = DateTime.fromJSDate(start).setZone(tz);
  const sessionEnd = DateTime.fromJSDate(end).setZone(tz);
  if (!sessionStart.isValid || !sessionEnd.isValid || sessionEnd <= sessionStart) return;

  const byDay = new Map<string, DayAgg>();
  const byMonthTotalSeconds = new Map<string, number>();

  let cursor = sessionStart;
  while (cursor < sessionEnd) {
    const dayStart = cursor.startOf("day");
    const nextDay = dayStart.plus({ days: 1 });
    const chunkEnd = sessionEnd < nextDay ? sessionEnd : nextDay;
    const dayId = dayStart.toISODate();
    if (!dayId) break;

    const secondsForDay = Math.max(0, Math.floor(chunkEnd.diff(cursor, "seconds").seconds));
    if (secondsForDay === 0) {
      cursor = chunkEnd;
      continue;
    }

    const monthId = dayStart.toFormat("yyyy-MM");
    byMonthTotalSeconds.set(monthId, (byMonthTotalSeconds.get(monthId) ?? 0) + secondsForDay);

    if (!byDay.has(dayId)) {
      byDay.set(dayId, { totalSeconds: 0, byHourSeconds: Array(24).fill(0) });
    }
    const dayAgg = byDay.get(dayId)!;
    dayAgg.totalSeconds += secondsForDay;

    let hourCursor = cursor;
    while (hourCursor < chunkEnd) {
      const hourIdx = hourCursor.hour;
      const nextHour = hourCursor.startOf("hour").plus({ hours: 1 });
      const hourEnd = chunkEnd < nextHour ? chunkEnd : nextHour;
      const secondsForHour = Math.max(0, Math.floor(hourEnd.diff(hourCursor, "seconds").seconds));
      dayAgg.byHourSeconds[hourIdx] += secondsForHour;
      hourCursor = hourEnd;
    }

    cursor = chunkEnd;
  }

  if (byDay.size === 0 && byMonthTotalSeconds.size === 0) return;

  const batch = db.batch();
  const userRef = db.collection("users").doc(userId);

  for (const [dayId, agg] of byDay.entries()) {
    const dailyRef = userRef.collection("dailyRollups").doc(dayId);
    
    // Build byHourSeconds as a proper nested object for correct Firestore merge
    const byHourSecondsUpdate: Record<string, FirebaseFirestore.FieldValue> = {};
    agg.byHourSeconds.forEach((sec, hourIdx) => {
      if (!sec) return;
      byHourSecondsUpdate[String(hourIdx)] = admin.firestore.FieldValue.increment(sec);
    });

    // Build byTagSeconds as a proper nested object
    const byTagSecondsUpdate: Record<string, FirebaseFirestore.FieldValue> = {
      [tagKey]: admin.firestore.FieldValue.increment(agg.totalSeconds),
    };

    const update: Record<string, any> = {
      date: dayId,
      tz,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalSeconds: admin.firestore.FieldValue.increment(agg.totalSeconds),
      byHourSeconds: byHourSecondsUpdate,
      byTagSeconds: byTagSecondsUpdate,
    };

    batch.set(dailyRef, update, { merge: true });
  }

  for (const [monthId, seconds] of byMonthTotalSeconds.entries()) {
    if (!seconds) continue;
    const monthlyRef = userRef.collection("monthlyRollups").doc(monthId);
    
    // Build byTagSeconds as a proper nested object for correct Firestore merge
    const byTagSecondsUpdate: Record<string, FirebaseFirestore.FieldValue> = {
      [tagKey]: admin.firestore.FieldValue.increment(seconds),
    };

    const update: Record<string, any> = {
      month: monthId,
      tz,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      totalSeconds: admin.firestore.FieldValue.increment(seconds),
      byTagSeconds: byTagSecondsUpdate,
    };
    batch.set(monthlyRef, update, { merge: true });
  }

  await batch.commit();
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, activity, durationSec, startTs, endTs, tagId, tz } = req.body || {};

    if (!userId || !activity || durationSec == null) {
      return res.status(400).json({
        success: false,
        error: "userId, activity, durationSec are required",
      });
    }

    const dur = Number(durationSec);
    if (!Number.isFinite(dur) || dur < 0) {
      return res
        .status(400)
        .json({ success: false, error: "durationSec must be a positive number" });
    }

    const tzName = typeof tz === "string" && tz.trim().length > 0 ? tz.trim() : "Europe/London";

    const requestedStart = toDateFromIso(startTs);
    const requestedEnd = toDateFromIso(endTs);

    let start: Date;
    let end: Date;

    if (requestedStart && requestedEnd && requestedEnd.getTime() > requestedStart.getTime()) {
      start = requestedStart;
      end = requestedEnd;
    } else if (requestedStart) {
      start = requestedStart;
      end = new Date(start.getTime() + Math.floor(dur) * 1000);
    } else {
      end = new Date(); // fallback to server time
      start = new Date(end.getTime() - Math.floor(dur) * 1000);
    }

    const computedDurationSec = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));

    // 1) Get user's selected pet before saving session
    const userSnap = await db.collection("users").doc(userId).get();
    const selectedPet = userSnap.exists ? userSnap.data()?.selectedPet : null;

    const resolvedTagId = (() => {
      if (typeof tagId === "string" && tagId.trim().length > 0) return tagId.trim();
      const tagList = userSnap.exists ? (userSnap.data()?.tagList as any[] | undefined) : undefined;
      if (!Array.isArray(tagList)) return null;
      const match = tagList.find((t) => t?.label === activity);
      const id = match?.id;
      return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
    })();

    // 2) Write the focus session with selected pet
    const sessionDoc = {
      activity,
      startTs: admin.firestore.Timestamp.fromDate(start),
      endTs: admin.firestore.Timestamp.fromDate(end),
      durationSec: computedDurationSec,
      tagId: resolvedTagId,
      tz: tzName,
      selectedPet: selectedPet || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const focusRef = await db
      .collection("users")
      .doc(userId)
      .collection("focus")
      .add(sessionDoc);

    try {
      await incrementRollupsForSession({
        userId,
        tz: tzName,
        tagId: resolvedTagId,
        start,
        end,
      });
    } catch (rollupError) {
      console.error("❌ Failed to update rollups:", rollupError);
    }

    // 3) Update daily streak on the user doc (transactional)
    const userRef = db.collection("users").doc(userId);
    const now = new Date();
    const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.exists ? snap.data() : undefined;

      console.log(`[postFocusSession] Transaction read user ${userId}. selectedPet: ${data?.selectedPet}`);

      const prevStreak = Number.isFinite(data?.dailyStreak) ? Number(data!.dailyStreak) : 0;
      const prevHighest = Number.isFinite(data?.highestStreak) ? Number(data!.highestStreak) : 0;

      const lastUpdRaw = data?.lastUpdatedDailyStreak as
        | FirebaseFirestore.Timestamp
        | Date
        | string
        | undefined;

      // Convert lastUpdatedDailyStreak to Date if present
      let lastUpdDate: Date | null = null;
      if (lastUpdRaw) {
        if (typeof (lastUpdRaw as any)?.toDate === "function") {
          lastUpdDate = (lastUpdRaw as any).toDate();
        } else if (typeof lastUpdRaw === "string") {
          const d = new Date(lastUpdRaw);
          if (!isNaN(d.getTime())) lastUpdDate = d;
        } else if (lastUpdRaw instanceof Date) {
          lastUpdDate = lastUpdRaw;
        }
      }

      // Increment if last update is before today (i.e., not today)
      const shouldIncrement =
        !lastUpdDate || lastUpdDate.getTime() < startOfTodayUTC.getTime();

      const newStreak = shouldIncrement ? prevStreak + 1 : prevStreak;

      tx.set(
        userRef,
        {
          dailyStreak: newStreak,
          highestStreak: Math.max(newStreak, prevHighest),
          lastUpdatedDailyStreak: admin.firestore.Timestamp.fromDate(now),
          totalFocusSeconds: admin.firestore.FieldValue.increment(computedDurationSec),
        },
        { merge: true }
      );
    });

    const rewardIntervalSec = 10 * 60;
    const coinsPerInterval = 5;
    const intervalsEarned = Math.floor(computedDurationSec / rewardIntervalSec);
    let coinsAwarded = 0;
    let xpAwarded = Math.max(0, Math.floor(computedDurationSec / 60));

    if (intervalsEarned > 0) {
      const increment = intervalsEarned * coinsPerInterval;
      coinsAwarded = increment;
      await userRef.set(
        {
          coins: admin.firestore.FieldValue.increment(increment),
        },
        { merge: true }
      );
    }

    if (xpAwarded > 0) {
      // Apply XP and compute level change in a shared helper.
      // This updates totalXP but does NOT auto-grant pets or other rewards.
      const { oldLevel, newLevel } = await awardXpAndUpdateLevel(userRef, xpAwarded);
      if (newLevel > oldLevel) {
        console.log(`🎉 User ${userId} leveled up from ${oldLevel} to ${newLevel}`);
      }

      if (selectedPet) {
        await db
          .collection("users")
          .doc(userId)
          .collection("petFriendships")
          .doc(selectedPet)
          .set(
            {
              totalXP: admin.firestore.FieldValue.increment(xpAwarded),
              totalFocusSeconds: admin.firestore.FieldValue.increment(computedDurationSec),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }
    }

    return res.json({
      success: true,
      message: "Focus session saved and daily streak updated",
      data: { id: focusRef.id, coinsAwarded, xpAwarded },
    });
  } catch (error) {
    console.error("❌ Error saving focus session:", error);
    return res.status(500).json({ success: false, error: "Failed to save focus session" });
  }
});

export default router;
