import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { DateTime } from "luxon";
import { ensureDailyRollupsInRange, normalizeTz } from "../../utils/rollups";

const db = admin.firestore();
export const focusWeekRouter = Router();

focusWeekRouter.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const tz = normalizeTz(req.query.tz as string | undefined);
    const todayMinutes = req.query.todayMinutes ? Number(req.query.todayMinutes) : null;
    
    if (!userId) return res.status(400).json({ success: false, error: "Missing userId" });

    // force ISO Monday week by using .startOf('week') on an ISO calendar
    const now = DateTime.now().setZone(tz);
    const weekStart = now.startOf("week");
    const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));

    const startOfToday = now.startOf("day");
    const startOfTomorrow = startOfToday.plus({ days: 1 });

    // Backfill rollups for this week up through today (no future docs)
    const daily = await ensureDailyRollupsInRange({
      userId,
      tz,
      rangeStart: weekStart,
      rangeEndExclusive: startOfTomorrow,
    });

    const results: { date: string; label: string; totalMinutes: number }[] = [];

    for (const d of weekDays) {
      const iso = d.toISODate()!;
      const label = d.toFormat("ccc");

      if (d.hasSame(now, "day") && todayMinutes !== null && !isNaN(todayMinutes)) {
        results.push({ date: iso, label, totalMinutes: Math.floor(todayMinutes) });
        continue;
      }

      if (d.startOf("day") >= startOfTomorrow) {
        results.push({ date: iso, label, totalMinutes: 0 });
        continue;
      }

      const rollup = daily.get(iso) as any | undefined;
      const totalSeconds = typeof rollup?.totalSeconds === "number" ? rollup.totalSeconds : 0;
      results.push({ date: iso, label, totalMinutes: Math.floor(totalSeconds / 60) });
    }

    // Current week (partial) from daily bars
    const currentWeekMinutes = results.reduce((s, d) => s + (d.totalMinutes || 0), 0);

    return res.json({
      success: true,
      data: {
        tz,
        weekStart: weekStart.toISODate(),
        days: results,
        currentWeekTotal: currentWeekMinutes, // Add this for weekly goal calculation
      },
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});
