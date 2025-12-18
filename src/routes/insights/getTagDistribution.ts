import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { DateTime } from "luxon";
import { ensureDailyRollupsInRange, ensureMonthlyRollupsInRange, normalizeTz } from "../../utils/rollups";

const router = Router();
const db = admin.firestore();

type LuxonDateTime = ReturnType<typeof DateTime.now>;

router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const tz = normalizeTz(req.query.tz as string | undefined);
    const mode = (req.query.mode as string) || "month"; // day, month, year, all
    const dateStr = req.query.date as string;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    let start: LuxonDateTime;
    let endExclusive: LuxonDateTime;
    const now = DateTime.now().setZone(tz);

    if (mode === "day" && dateStr) {
      const dayDt = DateTime.fromISO(dateStr, { zone: tz });
      if (!dayDt.isValid) {
        return res.status(400).json({ success: false, error: "Invalid date" });
      }
      start = dayDt.startOf("day");
      endExclusive = start.plus({ days: 1 });
    } else if (mode === "month" && year && month) {
      start = DateTime.fromObject({ year, month, day: 1 }, { zone: tz }).startOf("day");
      endExclusive = start.plus({ months: 1 });
    } else if (mode === "year" && year) {
      start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: tz }).startOf("day");
      endExclusive = start.plus({ years: 1 });
    } else if (mode === "all") {
      // Get all time data
      start = DateTime.fromObject({ year: 2018, month: 1, day: 1 }, { zone: tz }).startOf("day");
      endExclusive = now.startOf("month").plus({ months: 1 });
    } else {
      // Default to current month
      start = now.startOf("month");
      endExclusive = start.plus({ months: 1 });
    }

    const startOfTomorrow = now.startOf("day").plus({ days: 1 });
    let effectiveEndExclusive = endExclusive;
    if (mode === "month" || mode === "day") {
      effectiveEndExclusive = endExclusive > startOfTomorrow ? startOfTomorrow : endExclusive;
    } else if (mode === "year" && year === now.year) {
      const nextMonthStart = now.startOf("month").plus({ months: 1 });
      effectiveEndExclusive = nextMonthStart < endExclusive ? nextMonthStart : endExclusive;
    }

    const totalsByTagId: Record<string, number> = {};

    if (mode === "day" || mode === "month") {
      const daily = await ensureDailyRollupsInRange({
        userId,
        tz,
        rangeStart: start,
        rangeEndExclusive: effectiveEndExclusive,
      });
      daily.forEach((doc) => {
        const byTag = (doc?.byTagSeconds ?? {}) as Record<string, unknown>;
        Object.entries(byTag).forEach(([tagId, sec]) => {
          const seconds = Number(sec ?? 0) || 0;
          if (!seconds) return;
          totalsByTagId[tagId] = (totalsByTagId[tagId] ?? 0) + seconds;
        });
      });
    } else {
      const monthly = await ensureMonthlyRollupsInRange({
        userId,
        tz,
        rangeStart: start,
        rangeEndExclusive: effectiveEndExclusive,
      });
      monthly.forEach((doc) => {
        const byTag = (doc?.byTagSeconds ?? {}) as Record<string, unknown>;
        Object.entries(byTag).forEach(([tagId, sec]) => {
          const seconds = Number(sec ?? 0) || 0;
          if (!seconds) return;
          totalsByTagId[tagId] = (totalsByTagId[tagId] ?? 0) + seconds;
        });
      });
    }

    const distribution = Object.entries(totalsByTagId)
      .map(([tagId, totalSeconds]) => ({
        tag: tagId,
        tagId,
        totalSeconds,
        totalMinutes: Math.round(totalSeconds / 60),
        sessionCount: 0,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);

    const totalSeconds = distribution.reduce((acc, d) => acc + (d.totalSeconds || 0), 0);

    return res.json({
      success: true,
      data: {
        distribution,
        totalSeconds,
        totalMinutes: Math.round(totalSeconds / 60),
        period: {
          start: start.toISO(),
          end: endExclusive.toISO(),
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
