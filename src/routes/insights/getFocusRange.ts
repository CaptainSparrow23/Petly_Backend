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

async function fetchOverlappingFocusDocs(
  userId: string,
  start: ReturnType<typeof DateTime.now>,
  end: ReturnType<typeof DateTime.now>
) {
  const focusCol = db.collection("users").doc(userId).collection("focus");

  const startTimestamp = getFirestoreTimestamp(start.toJSDate());
  const endTimestamp = getFirestoreTimestamp(end.toJSDate());

  const [qStartSnap, qEndSnap] = await Promise.all([
    focusCol.where("startTs", ">=", startTimestamp).where("startTs", "<=", endTimestamp).get(),
    focusCol.where("endTs", ">=", startTimestamp).where("endTs", "<=", endTimestamp).get(),
  ]);

  const docsMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  qStartSnap.forEach((d) => docsMap.set(d.id, d));
  qEndSnap.forEach((d) => docsMap.set(d.id, d));

  return docsMap;
}

function getSessionRange(data: FirebaseFirestore.DocumentData, tz: string) {
  const rawStart = data.startTs?.toDate?.() ?? new Date(data.startTs ?? 0);
  const rawEnd = data.endTs?.toDate?.() ?? new Date(data.endTs ?? data.startTs ?? 0);

  const sessionStart = DateTime.fromJSDate(rawStart).setZone(tz);
  const sessionEnd = DateTime.fromJSDate(rawEnd).setZone(tz);
  if (!sessionStart.isValid || !sessionEnd.isValid || sessionEnd <= sessionStart) return null;

  return { sessionStart, sessionEnd };
}

// --- Mode Handlers ---

async function handleDayMode(userId: string, dateStr: string, tz: string) {
  const dayDt = parseDate(dateStr, tz);
  if (!dayDt) throw new Error("Invalid or missing date");

  const start = dayDt.startOf("day");
  const end = dayDt.endOf("day");

  // Initialize 24 hours
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    key: `${hour}`,
    label: `${String(hour).padStart(2, "0")}:00`,
    totalMinutes: 0,
    totalSeconds: 0,
  }));

  const docsMap = await fetchOverlappingFocusDocs(userId, start, end);

  docsMap.forEach((doc) => {
    const data = doc.data();

    const range = getSessionRange(data, tz);
    if (!range) return;
    let { sessionStart, sessionEnd } = range;

    // Clamp session to the requested day
    sessionStart = sessionStart < start ? start : sessionStart;
    sessionEnd = sessionEnd > end ? end : sessionEnd;
    if (sessionEnd <= sessionStart) return;

    // Distribute seconds across hours
    let cursor = sessionStart;
    while (cursor < sessionEnd) {
      const hourIdx = cursor.hour;
      const nextHour = cursor.startOf("hour").plus({ hours: 1 });
      const chunkEnd = sessionEnd < nextHour ? sessionEnd : nextHour;
      
      if (hours[hourIdx]) {
        const seconds = Math.max(0, Math.floor(chunkEnd.diff(cursor, "seconds").seconds));
        hours[hourIdx].totalSeconds += seconds;
      }
      
      cursor = chunkEnd;
    }
  });

  const totalSeconds = hours.reduce((acc, h) => acc + (h.totalSeconds || 0), 0);

  return {
    mode: "day",
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    points: hours.map((h) => ({ ...h, totalMinutes: Math.round((h.totalSeconds || 0) / 60) })),
  };
}

async function handleMonthMode(userId: string, year: number, month: number, tz: string) {
  if (!year || !month || month < 1 || month > 12) throw new Error("Invalid year or month");

  const start = DateTime.fromObject({ year, month, day: 1 }, { zone: tz }).startOf("day");
  const end = start.endOf("month");

  const points = Array.from({ length: end.day }, (_, idx) => {
    const current = start.plus({ days: idx });
    const iso = current.toISODate()!;
    return {
      key: iso,
      label: String(idx + 1),
      totalMinutes: 0,
      totalSeconds: 0,
    };
  });

  const docsMap = await fetchOverlappingFocusDocs(userId, start, end);

  docsMap.forEach((doc) => {
    const data = doc.data();
    const range = getSessionRange(data, tz);
    if (!range) return;
    let { sessionStart, sessionEnd } = range;

    // Clamp to the requested time range
    sessionStart = sessionStart < start ? start : sessionStart;
    sessionEnd = sessionEnd > end ? end : sessionEnd;
    if (sessionEnd <= sessionStart) return;

    let cursor = sessionStart;
    while (cursor < sessionEnd) {
      const dayIdx = cursor.day - 1;
      const nextDay = cursor.startOf("day").plus({ days: 1 });
      const chunkEnd = sessionEnd < nextDay ? sessionEnd : nextDay;

      const seconds = Math.max(0, Math.floor(chunkEnd.diff(cursor, "seconds").seconds));
      if (points[dayIdx]) {
        points[dayIdx].totalSeconds += seconds;
      }
      cursor = chunkEnd;
    }
  });

  const totalSeconds = points.reduce((acc, p) => acc + (p.totalSeconds || 0), 0);

  return {
    mode: "month",
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    points: points.map((p) => ({ ...p, totalMinutes: Math.round((p.totalSeconds || 0) / 60) })),
  };
}

async function handleYearMode(userId: string, year: number, tz: string) {
  if (!year) throw new Error("Invalid year");

  const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: tz }).startOf("day");
  const end = start.endOf("year");

  const points = Array.from({ length: 12 }, (_, idx) => ({
    key: `${year}-${idx + 1}`,
    label: MONTH_NAMES[idx],
    totalMinutes: 0,
    totalSeconds: 0,
  }));

  const docsMap = await fetchOverlappingFocusDocs(userId, start, end);

  docsMap.forEach((doc) => {
    const data = doc.data();
    const range = getSessionRange(data, tz);
    if (!range) return;
    let { sessionStart, sessionEnd } = range;

    // Clamp to the requested time range
    sessionStart = sessionStart < start ? start : sessionStart;
    sessionEnd = sessionEnd > end ? end : sessionEnd;
    if (sessionEnd <= sessionStart) return;

    let cursor = sessionStart;
    while (cursor < sessionEnd) {
      const monthIdx = cursor.month - 1;
      const nextMonth = cursor.startOf("month").plus({ months: 1 });
      const chunkEnd = sessionEnd < nextMonth ? sessionEnd : nextMonth;

      const seconds = Math.max(0, Math.floor(chunkEnd.diff(cursor, "seconds").seconds));
      if (points[monthIdx]) {
        points[monthIdx].totalSeconds += seconds;
      }
      cursor = chunkEnd;
    }
  });

  const totalSeconds = points.reduce((acc, p) => acc + (p.totalSeconds || 0), 0);

  return {
    mode: "year",
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    points: points.map((p) => ({ ...p, totalMinutes: Math.round((p.totalSeconds || 0) / 60) })),
  };
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
