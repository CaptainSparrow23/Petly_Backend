import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { db } from "../../firebase"; // your initialized admin/db module

const router = Router();


router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, activity, startTs, durationSec } = req.body || {};

    if (!userId || !activity || !startTs || durationSec == null) {
      return res.status(400).json({
        success: false,
        error: "userId, activity, startTs, durationSec are required",
      });
    }

    const start = new Date(startTs);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ success: false, error: "Invalid startTs" });
    }

    const dur = Number(durationSec);
    if (!Number.isFinite(dur) || dur <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "durationSec must be a positive number" });
    }

    const end = new Date(); // end time = now (server)

    // 1) Write the focus session (unchanged: only the 4 fields)
    const sessionDoc = {
      activity,
      startTs: admin.firestore.Timestamp.fromDate(start),
      endTs: admin.firestore.Timestamp.fromDate(end),
      durationSec: Math.floor(dur),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const focusRef = await db
      .collection("users")
      .doc(userId)
      .collection("focus")
      .add(sessionDoc);

    // 2) Update daily streak on the user doc (transactional)
    const userRef = db.collection("users").doc(userId);
    const now = new Date();
    const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.exists ? snap.data() : undefined;

      const prevStreak = Number.isFinite(data?.dailyStreak) ? Number(data!.dailyStreak) : 0;

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
          lastUpdatedDailyStreak: admin.firestore.Timestamp.fromDate(now),
        },
        { merge: true }
      );
    });

    return res.json({
      success: true,
      message: "Focus session saved and daily streak updated",
      data: { id: focusRef.id },
    });
  } catch (error) {
    console.error("❌ Error saving focus session:", error);
    return res.status(500).json({ success: false, error: "Failed to save focus session" });
  }
});

export default router;
