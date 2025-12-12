import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { db } from "../../firebase"; // your initialized admin/db module

const router = Router();


router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, activity, durationSec } = req.body || {};

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

    const end = new Date(); // end time = now (server)
    const start = new Date(end.getTime() - Math.floor(dur) * 1000); // derive start from duration

    // 1) Get user's selected pet before saving session
    const userSnap = await db.collection("users").doc(userId).get();
    const selectedPet = userSnap.exists ? userSnap.data()?.selectedPet : null;

    // 2) Write the focus session with selected pet
    const sessionDoc = {
      activity,
      startTs: admin.firestore.Timestamp.fromDate(start),
      endTs: admin.firestore.Timestamp.fromDate(end),
      durationSec: Math.floor(dur),
      selectedPet: selectedPet || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const focusRef = await db
      .collection("users")
      .doc(userId)
      .collection("focus")
      .add(sessionDoc);

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
          totalFocusSeconds: admin.firestore.FieldValue.increment(Math.floor(dur)),
        },
        { merge: true }
      );
    });

    const rewardIntervalSec = 10 * 60;
    const coinsPerInterval = 5;
    const intervalsEarned = Math.floor(dur / rewardIntervalSec);
    let coinsAwarded = 0;
    let xpAwarded = Math.max(0, Math.floor(dur / 60));

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
      await userRef.set(
        {
          totalXP: admin.firestore.FieldValue.increment(xpAwarded),
        },
        { merge: true }
      );

      if (selectedPet) {
        await db
          .collection("users")
          .doc(userId)
          .collection("petFriendships")
          .doc(selectedPet)
          .set(
            {
              totalXP: admin.firestore.FieldValue.increment(xpAwarded),
              totalFocusSeconds: admin.firestore.FieldValue.increment(Math.floor(dur)),
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
