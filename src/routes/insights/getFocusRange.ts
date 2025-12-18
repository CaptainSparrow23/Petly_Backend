import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { DateTime } from "luxon";
import { ensureDailyRollupsInRange, ensureMonthlyRollupsInRange, normalizeTz, listIsoDates } from "../../utils/rollups";

const router = Router();
const db = admin.firestore();

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// --- Helpers ---

const parseDate = (value: unknown, zone: string) => {
  const dt = typeof value === "string" ? DateTime.fromISO(value, { zone }) : DateTime.invalid("missing");
  return dt.isValid ? dt : null;
};

// --- Mode Handlers ---

async function handleDayMode(userId: string, dateStr: string, tz: string) {
  const dayDt = parseDate(dateStr, tz);
  if (!dayDt) throw new Error("Invalid or missing date");

  const start = dayDt.startOf("day");
  const endExclusive = start.plus({ days: 1 });
  const dayId = start.toISODate()!;

  const docs = await ensureDailyRollupsInRange({ userId, tz, rangeStart: start, rangeEndExclusive: endExclusive });
  const rollup = docs.get(dayId) as any | undefined;
  const byHourSeconds = (rollup?.byHourSeconds ?? {}) as Record<string, unknown>;

  const hours = Array.from({ length: 24 }, (_, hour) => {
    const sec = Number(byHourSeconds[String(hour)] ?? 0) || 0;
    return {
      key: `${hour}`,
      label: `${String(hour).padStart(2, "0")}:00`,
      totalSeconds: sec,
      totalMinutes: Math.round(sec / 60),
    };
  });

  const totalSeconds =
    typeof rollup?.totalSeconds === "number"
      ? rollup.totalSeconds
      : hours.reduce((acc, h) => acc + (h.totalSeconds || 0), 0);

  return {
    mode: "day",
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    points: hours,
  };
}

async function handleMonthMode(userId: string, year: number, month: number, tz: string) {
  if (!year || !month || month < 1 || month > 12) throw new Error("Invalid year or month");

  const start = DateTime.fromObject({ year, month, day: 1 }, { zone: tz }).startOf("day");
  const endExclusive = start.plus({ months: 1 });
  const now = DateTime.now().setZone(tz);
  const startOfTomorrow = now.startOf("day").plus({ days: 1 });
  const effectiveEndExclusive = endExclusive > startOfTomorrow ? startOfTomorrow : endExclusive;

  const rollups = await ensureDailyRollupsInRange({
    userId,
    tz,
    rangeStart: start,
    rangeEndExclusive: effectiveEndExclusive,
  });
  const dayIds = listIsoDates(start, endExclusive);
  const points = dayIds.map((dayId, idx) => {
    const doc = rollups.get(dayId) as any | undefined;
    const totalSeconds = typeof doc?.totalSeconds === "number" ? doc.totalSeconds : 0;
    return {
      key: dayId,
      label: String(idx + 1),
      totalSeconds,
      totalMinutes: Math.round(totalSeconds / 60),
    };
  });

  const totalSeconds = points.reduce((acc, p) => acc + (p.totalSeconds || 0), 0);

  return {
    mode: "month",
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    points,
  };
}

async function handleYearMode(userId: string, year: number, tz: string) {
  if (!year) throw new Error("Invalid year");

  const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: tz }).startOf("day");
  const endExclusive = start.plus({ years: 1 });
  const now = DateTime.now().setZone(tz);
  const nextMonthStart = now.startOf("month").plus({ months: 1 });
  const effectiveEndExclusive = year === now.year && nextMonthStart < endExclusive ? nextMonthStart : endExclusive;

  const rollups = await ensureMonthlyRollupsInRange({
    userId,
    tz,
    rangeStart: start,
    rangeEndExclusive: effectiveEndExclusive,
  });
  const points = Array.from({ length: 12 }, (_, idx) => {
    const monthId = `${year}-${String(idx + 1).padStart(2, "0")}`;
    const doc = rollups.get(monthId) as any | undefined;
    const totalSeconds = typeof doc?.totalSeconds === "number" ? doc.totalSeconds : 0;
    return {
      key: monthId,
      label: MONTH_NAMES[idx],
      totalSeconds,
      totalMinutes: Math.round(totalSeconds / 60),
    };
  });

  const totalSeconds = points.reduce((acc, p) => acc + (p.totalSeconds || 0), 0);

  return {
    mode: "year",
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    points,
  };
}

// --- Main Route ---

router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const mode = (req.query.mode as string) ?? "day";
    const tz = normalizeTz(req.query.tz as string | undefined);

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    let data;
    if (mode === "day") {
      data = await handleDayMode(userId, req.query.date as string, tz);
    } else if (mode === "month") {
      data = await handleMonthMode(userId, Number(req.query.year), Number(req.query.month), tz);
    } else if (mode === "year") {
      data = await handleYearMode(userId, Number(req.query.year), tz);
    } else {
      return res.status(400).json({ success: false, error: "Unsupported mode" });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching focus range:", error);
    const status = error.message.includes("Invalid") ? 400 : 500;
    return res.status(status).json({ success: false, error: error?.message || "Failed to fetch focus range" });
  }
});

export default router;
