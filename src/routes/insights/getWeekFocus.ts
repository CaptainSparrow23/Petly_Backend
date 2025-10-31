import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { DateTime } from "luxon";

const db = admin.firestore();
export const focusWeekRouter = Router();


focusWeekRouter.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const tz = (req.query.tz as string) || "Europe/London";
    if (!userId) return res.status(400).json({ success: false, error: "Missing userId" });

    const now = DateTime.now().setZone(tz);
    const weekStart = now.startOf("week"); // Monday
    const weekDays: DateTime[] = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));

    const results: { date: string; label: string; totalMinutes: number }[] = [];

    for (const d of weekDays) {
      const iso = d.toFormat("yyyy-LL-dd");
      const label = d.toFormat("ccc"); // Mon, Tue, etc.

      if (d.startOf("day") < now.startOf("day")) {
        // Past days → use dailyFocus
        const doc = await db
          .collection("users")
          .doc(userId)
          .collection("dailyFocus")
          .doc(iso)
          .get();

        const totalSec = doc.exists ? Number(doc.data()?.totalDurationSec || 0) : 0;
        results.push({ date: iso, label, totalMinutes: Math.floor(totalSec / 60) });
      } else if (d.hasSame(now, "day")) {
        // Today → live focus sessions
        const startTs = admin.firestore.Timestamp.fromDate(d.startOf("day").toJSDate());
        const endTs = admin.firestore.Timestamp.fromDate(now.toJSDate());

        const snap = await db
          .collection("users")
          .doc(userId)
          .collection("focus")
          .where("startTs", ">=", startTs)
          .where("startTs", "<=", endTs)
          .get();

        let totalSec = 0;
        snap.forEach((doc) => (totalSec += Number(doc.data()?.durationSec || 0)));
        results.push({ date: iso, label, totalMinutes: Math.floor(totalSec / 60) });
      } else {
        // Future days (not yet reached)
        results.push({ date: iso, label, totalMinutes: 0 });
      }
    }

    return res.json({ success: true, data: { tz, weekStart: weekStart.toISODate(), days: results } });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});
