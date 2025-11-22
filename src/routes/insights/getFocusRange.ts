import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { DateTime } from "luxon";

const router = Router();
const db = admin.firestore();

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const clampDate = (value: unknown, zone: string) => {
  const dt = typeof value === "string" ? DateTime.fromISO(value, { zone }) : DateTime.invalid("missing");
  if (!dt.isValid) {
    return null;
  }
  return dt;
};

router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const mode = (req.query.mode as string) ?? "day";
    const tz = (req.query.tz as string) || "Europe/London";

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    const dailyCol = db.collection("users").doc(userId).collection("dailyFocus");
    const focusCol = db.collection("users").doc(userId).collection("focus");

    if (mode === "day") {
      const dateStr = req.query.date as string;
      const dayDt = clampDate(dateStr, tz);
      if (!dayDt) {
        return res.status(400).json({ success: false, error: "Invalid or missing date" });
      }

      const start = dayDt.startOf("day");
      const end = dayDt.endOf("day");

      const startTs = admin.firestore.Timestamp.fromDate(start.toJSDate());
      const endTs = admin.firestore.Timestamp.fromDate(end.toJSDate());

      const snap = await focusCol.where("startTs", ">=", startTs).where("startTs", "<=", endTs).get();

      const hours = Array.from({ length: 24 }, (_, hour) => ({
        key: `${hour}`,
        label: `${String(hour).padStart(2, "0")}:00`,
        totalMinutes: 0,
      }));

      snap.forEach((doc) => {
        const data = doc.data() as any;
        const rawStart =
          typeof data.startTs?.toDate === "function" ? data.startTs.toDate() : new Date(data.startTs ?? 0);
        const rawEnd =
          typeof data.endTs?.toDate === "function" ? data.endTs.toDate() : new Date(data.endTs ?? data.startTs ?? 0);

        let sessionStart = DateTime.fromJSDate(rawStart).setZone(tz);
        let sessionEnd = DateTime.fromJSDate(rawEnd).setZone(tz);

        if (!sessionStart.isValid || !sessionEnd.isValid) return;
        if (sessionEnd <= sessionStart) return;

        sessionStart = sessionStart < start ? start : sessionStart;
        sessionEnd = sessionEnd > end ? end : sessionEnd;
        if (sessionEnd <= sessionStart) return;

        let cursor = sessionStart;
        while (cursor < sessionEnd) {
          const hourIdx = cursor.hour;
          const nextHour = cursor.startOf("hour").plus({ hours: 1 });
          const chunkEnd = sessionEnd < nextHour ? sessionEnd : nextHour;
          const minutes = chunkEnd.diff(cursor, "seconds").seconds / 60;
          hours[hourIdx].totalMinutes += minutes;
          cursor = chunkEnd;
        }
      });

      return res.json({
        success: true,
        data: {
          mode: "day",
          points: hours.map((h) => ({ ...h, totalMinutes: Math.round(h.totalMinutes) })),
        },
      });
    }

    if (mode === "month") {
      const year = Number(req.query.year);
      const month = Number(req.query.month); // 1-12
      if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({ success: false, error: "Invalid year or month" });
      }

      const start = DateTime.fromObject({ year, month, day: 1 }, { zone: tz }).startOf("day");
      const end = start.endOf("month");

      const docs = await dailyCol
        .where("date", ">=", start.toISODate())
        .where("date", "<=", end.toISODate())
        .orderBy("date")
        .get();

      const byDate = new Map<string, FirebaseFirestore.DocumentData>();
      docs.forEach((doc) => byDate.set(String(doc.get("date") || doc.id), doc.data()));

      const totalDays = end.day;
      const points = Array.from({ length: totalDays }, (_, idx) => {
        const current = start.plus({ days: idx });
        const iso = current.toISODate()!;
        const match = byDate.get(iso);
        const minutes = match ? Math.floor((Number(match.totalDurationSec) || 0) / 60) : 0;
        return {
          key: iso,
          label: String(idx + 1),
          totalMinutes: minutes,
        };
      });

      return res.json({
        success: true,
        data: {
          mode: "month",
          points,
        },
      });
    }

    if (mode === "year") {
      const year = Number(req.query.year);
      if (!year) {
        return res.status(400).json({ success: false, error: "Invalid year" });
      }

      const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: tz }).startOf("day");
      const end = start.endOf("year");

      const docs = await dailyCol
        .where("date", ">=", start.toISODate())
        .where("date", "<=", end.toISODate())
        .orderBy("date")
        .get();

      const monthTotals = Array(12).fill(0);
      docs.forEach((doc) => {
        const dateStr = String(doc.get("date") || doc.id);
        const dt = DateTime.fromISO(dateStr, { zone: tz });
        if (!dt.isValid) return;
        const idx = dt.month - 1;
        const minutes = Math.floor((Number(doc.get("totalDurationSec")) || 0) / 60);
        monthTotals[idx] += minutes;
      });

      const points = monthTotals.map((minutes, idx) => ({
        key: `${year}-${idx + 1}`,
        label: MONTH_NAMES[idx],
        totalMinutes: minutes,
      }));

      return res.json({
        success: true,
        data: {
          mode: "year",
          points,
        },
      });
    }

    return res.status(400).json({ success: false, error: "Unsupported mode" });
  } catch (error: any) {
    console.error("Error fetching focus range:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to fetch focus range" });
  }
});

export default router;
