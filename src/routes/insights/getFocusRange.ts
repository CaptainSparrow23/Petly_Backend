import { Router, Request, Response } from "express";
import admin from "firebase-admin";
import { DateTime } from "luxon";

const router = Router();
const db = admin.firestore();

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// --- Helpers ---

const parseDate = (value: unknown, zone: string) => {
  const dt = typeof value === "string" ? DateTime.fromISO(value, { zone }) : DateTime.invalid("missing");
  return dt.isValid ? dt : null;
};

const getFirestoreTimestamp = (date: Date) => admin.firestore.Timestamp.fromDate(date);

// --- Mode Handlers ---

async function handleDayMode(userId: string, dateStr: string, tz: string) {
  const dayDt = parseDate(dateStr, tz);
  if (!dayDt) throw new Error("Invalid or missing date");

  const start = dayDt.startOf("day");
  const end = dayDt.endOf("day");

  const focusCol = db.collection("users").doc(userId).collection("focus");
  
  // Query sessions that START in the range OR END in the range (to catch sessions spanning boundaries)
  const startTimestamp = getFirestoreTimestamp(start.toJSDate());
  const endTimestamp = getFirestoreTimestamp(end.toJSDate());
  
  const [qStartSnap, qEndSnap] = await Promise.all([
    focusCol
      .where("startTs", ">=", startTimestamp)
      .where("startTs", "<=", endTimestamp)
      .get(),
    focusCol
      .where("endTs", ">=", startTimestamp)
      .where("endTs", "<=", endTimestamp)
      .get(),
  ]);

  // Merge both result sets to avoid duplicates
  const docsMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  qStartSnap.forEach((d) => docsMap.set(d.id, d));
  qEndSnap.forEach((d) => docsMap.set(d.id, d));

  // Initialize 24 hours
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    key: `${hour}`,
    label: `${String(hour).padStart(2, "0")}:00`,
    totalMinutes: 0,
  }));

  docsMap.forEach((doc) => {
    const data = doc.data();
    const rawStart = data.startTs?.toDate?.() ?? new Date(data.startTs ?? 0);
    const rawEnd = data.endTs?.toDate?.() ?? new Date(data.endTs ?? data.startTs ?? 0);

    let sessionStart = DateTime.fromJSDate(rawStart).setZone(tz);
    let sessionEnd = DateTime.fromJSDate(rawEnd).setZone(tz);

    if (!sessionStart.isValid || !sessionEnd.isValid || sessionEnd <= sessionStart) return;

    // Clamp session to the requested day
    sessionStart = sessionStart < start ? start : sessionStart;
    sessionEnd = sessionEnd > end ? end : sessionEnd;
    if (sessionEnd <= sessionStart) return;

    // Distribute minutes across hours
    let cursor = sessionStart;
    while (cursor < sessionEnd) {
      const hourIdx = cursor.hour;
      const nextHour = cursor.startOf("hour").plus({ hours: 1 });
      const chunkEnd = sessionEnd < nextHour ? sessionEnd : nextHour;
      
      const minutes = chunkEnd.diff(cursor, "seconds").seconds / 60;
      if (hours[hourIdx]) {
        hours[hourIdx].totalMinutes += minutes;
      }
      
      cursor = chunkEnd;
    }
  });

  return {
    mode: "day",
    points: hours.map((h) => ({ ...h, totalMinutes: Math.round(h.totalMinutes) })),
  };
}

async function handleMonthMode(userId: string, year: number, month: number, tz: string) {
  if (!year || !month || month < 1 || month > 12) throw new Error("Invalid year or month");

  const start = DateTime.fromObject({ year, month, day: 1 }, { zone: tz }).startOf("day");
  const end = start.endOf("month");

  const dailyCol = db.collection("users").doc(userId).collection("dailyFocus");
  const docs = await dailyCol
    .where("date", ">=", start.toISODate())
    .where("date", "<=", end.toISODate())
    .orderBy("date")
    .get();

  const byDate = new Map<string, FirebaseFirestore.DocumentData>();
  docs.forEach((doc) => byDate.set(String(doc.get("date") || doc.id), doc.data()));

  const points = Array.from({ length: end.day }, (_, idx) => {
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

  return { mode: "month", points };
}

async function handleYearMode(userId: string, year: number, tz: string) {
  if (!year) throw new Error("Invalid year");

  const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: tz }).startOf("day");
  const end = start.endOf("year");

  const dailyCol = db.collection("users").doc(userId).collection("dailyFocus");
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
    
    const minutes = Math.floor((Number(doc.get("totalDurationSec")) || 0) / 60);
    monthTotals[dt.month - 1] += minutes;
  });

  const points = monthTotals.map((minutes, idx) => ({
    key: `${year}-${idx + 1}`,
    label: MONTH_NAMES[idx],
    totalMinutes: minutes,
  }));

  return { mode: "year", points };
}

// --- Main Route ---

router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const mode = (req.query.mode as string) ?? "day";
    const tz = (req.query.tz as string) || "Europe/London";

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
