import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { DateTime } from "luxon";

const router = Router();
const db = admin.firestore();

router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const tz = (req.query.tz as string) || "Europe/London";
    const mode = (req.query.mode as string) || "month"; // day, month, year, all
    const dateStr = req.query.date as string;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    let start;
    let end;
    const now = DateTime.now().setZone(tz);

    if (mode === "day" && dateStr) {
      const dayDt = DateTime.fromISO(dateStr, { zone: tz });
      if (!dayDt.isValid) {
        return res.status(400).json({ success: false, error: "Invalid date" });
      }
      start = dayDt.startOf("day");
      end = dayDt.endOf("day");
    } else if (mode === "month" && year && month) {
      start = DateTime.fromObject({ year, month, day: 1 }, { zone: tz }).startOf("day");
      end = start.endOf("month");
    } else if (mode === "year" && year) {
      start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: tz }).startOf("day");
      end = start.endOf("year");
    } else if (mode === "all") {
      // Get all time data
      start = DateTime.fromObject({ year: 2018, month: 1, day: 1 }, { zone: tz }).startOf("day");
      end = now.endOf("day");
    } else {
      // Default to current month
      start = now.startOf("month");
      end = now.endOf("month");
    }

    const focusCol = db.collection("users").doc(userId).collection("focus");
    const snap = await focusCol
      .where("startTs", ">=", admin.firestore.Timestamp.fromDate(start.toJSDate()))
      .where("startTs", "<=", admin.firestore.Timestamp.fromDate(end.toJSDate()))
      .get();

    // Aggregate by activity/tag
    const tagStats: Record<string, { totalMinutes: number; sessionCount: number }> = {};

    snap.forEach((doc) => {
      const data = doc.data();
      const activity = data.activity || "Unknown";

      const rawStart = data.startTs?.toDate?.() ?? new Date(data.startTs ?? 0);
      const rawEnd = data.endTs?.toDate?.() ?? new Date(data.endTs ?? data.startTs ?? 0);

      const sessionStart = DateTime.fromJSDate(rawStart).setZone(tz);
      const sessionEnd = DateTime.fromJSDate(rawEnd).setZone(tz);

      if (!sessionStart.isValid || !sessionEnd.isValid || sessionEnd <= sessionStart) return;

      // Clamp to the requested time range
      let clampedStart = sessionStart < start ? start : sessionStart;
      let clampedEnd = sessionEnd > end ? end : sessionEnd;
      if (clampedEnd <= clampedStart) return;

      const minutes = Math.floor(clampedEnd.diff(clampedStart, "seconds").seconds / 60);

      if (!tagStats[activity]) {
        tagStats[activity] = { totalMinutes: 0, sessionCount: 0 };
      }
      tagStats[activity].totalMinutes += minutes;
      tagStats[activity].sessionCount += 1;
    });

    // Convert to array format
    const distribution = Object.entries(tagStats)
      .map(([tag, stats]) => ({
        tag,
        totalMinutes: stats.totalMinutes,
        sessionCount: stats.sessionCount,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes); // Sort by total minutes descending

    return res.json({
      success: true,
      data: {
        distribution,
        period: {
          start: start.toISO(),
          end: end.toISO(),
          mode,
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching tag distribution:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to fetch tag distribution",
    });
  }
});

export default router;
