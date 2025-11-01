import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { DateTime } from "luxon";

const db = admin.firestore();
export const focusWeekRouter = Router();

function weekDocIdFromLuxon(dt: DateTime) {
  // ISO week id: "YYYY-Www"
  const y = dt.weekYear;
  const w = String(dt.weekNumber).padStart(2, "0");
  return `${y}-W${w}`;
}

// --- Month/label helpers (force 3-letter months; Sep not Sept) ---
function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function firstDayLabel(dt: DateTime) {
  return `${ordinal(dt.day)} ${MONTHS_SHORT[dt.month - 1]}`; // e.g. "6th Jun"
}

focusWeekRouter.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const tz = (req.query.tz as string) || "Europe/London";
    if (!userId) return res.status(400).json({ success: false, error: "Missing userId" });

    const now = DateTime.now().setZone(tz);
    const weekStart = now.startOf("week"); // Monday (ISO)
    const weekDays: DateTime[] = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));

    // ---- Part 1: current week daily bars
    const results: { date: string; label: string; totalMinutes: number }[] = [];

    for (const d of weekDays) {
      const iso = d.toISODate()!;      // YYYY-MM-DD
      const label = d.toFormat("ccc"); // Mon, Tue, ...

      if (d.startOf("day") < now.startOf("day")) {
        // Past days → use dailyFocus rollups
        const doc = await db
          .collection("users")
          .doc(userId)
          .collection("dailyFocus")
          .doc(iso)
          .get();

        const totalSec = doc.exists ? Number(doc.data()?.totalDurationSec || 0) : 0;
        results.push({ date: iso, label, totalMinutes: Math.floor(totalSec / 60) });
      } else if (d.hasSame(now, "day")) {
        // Today → live focus sessions up to now
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
        // Future days
        results.push({ date: iso, label, totalMinutes: 0 });
      }
    }

    // ---- Part 2: six-week summary (5 prior full weeks + current partial week)
    const sixWeekSummary: {
      weekId: string;
      start: string;
      end: string;
      totalMinutes: number;
      sessionsCount: number;
      isCurrentWeek?: boolean;
      label: string; // "6th Jun"
    }[] = [];

    // 5 prior completed weeks
    for (let i = 5; i >= 1; i--) {
      const wStart = weekStart.minus({ weeks: i });
      const wEnd = wStart.endOf("week");
      const weekId = weekDocIdFromLuxon(wStart);

      const weeklyDoc = await db
        .collection("users")
        .doc(userId)
        .collection("weeklyFocus")
        .doc(weekId)
        .get();

      const totalSec = weeklyDoc.exists ? Number(weeklyDoc.data()?.totalDurationSec || 0) : 0;
      const sessionsCount = weeklyDoc.exists ? Number(weeklyDoc.data()?.sessionsCount || 0) : 0;

      sixWeekSummary.push({
        weekId,
        start: wStart.toISODate()!,
        end: wEnd.toISODate()!,
        totalMinutes: Math.floor(totalSec / 60),
        sessionsCount,
        label: firstDayLabel(wStart),
      });
    }

    // Current week (partial) from daily bars
    const currentWeekMinutes = results.reduce((s, d) => s + (d.totalMinutes || 0), 0);
    const currentWeekSessions = 0; // optional: compute by querying "focus" across week window
    const currentWeekId = weekDocIdFromLuxon(weekStart);

    sixWeekSummary.push({
      weekId: currentWeekId,
      start: weekStart.toISODate()!,
      end: weekStart.endOf("week").toISODate()!,
      totalMinutes: currentWeekMinutes,
      sessionsCount: currentWeekSessions,
      isCurrentWeek: true,
      label: firstDayLabel(weekStart),
    });

    return res.json({
      success: true,
      data: {
        tz,
        weekStart: weekStart.toISODate(),
        days: results,
        sixWeekSummary,
      },
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});
