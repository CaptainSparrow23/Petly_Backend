import admin, { db } from "../firebase";
import { DateTime } from "luxon";

type LuxonDateTime = ReturnType<typeof DateTime.now>;

type DailyAgg = {
  totalSeconds: number;
  byHourSeconds: number[];
  byTagSeconds: Record<string, number>;
};

type MonthlyAgg = {
  totalSeconds: number;
  byTagSeconds: Record<string, number>;
};

const DEFAULT_TZ = "Europe/London";

export function normalizeTz(tz?: string) {
  const trimmed = typeof tz === "string" ? tz.trim() : "";
  return trimmed.length > 0 ? trimmed : DEFAULT_TZ;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && Number.isFinite(d.getTime()) ? d : null;
  }
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function getUserTagLabelToIdMap(userId: string) {
  const map = new Map<string, string>([
    ["Focus", "focus"],
    ["Rest", "rest"],
    ["Work", "work"],
    ["Study", "study"],
  ]);

  const userSnap = await db.collection("users").doc(userId).get();
  const tagList = userSnap.exists ? (userSnap.data()?.tagList as any[] | undefined) : undefined;
  if (!Array.isArray(tagList)) return map;

  for (const tag of tagList) {
    const label = typeof tag?.label === "string" ? tag.label.trim() : "";
    const id = typeof tag?.id === "string" ? tag.id.trim() : "";
    if (label && id) map.set(label, id);
  }

  return map;
}

async function queryFocusDocsOverlappingRange(opts: {
  userId: string;
  rangeStart: LuxonDateTime;
  rangeEndExclusive: LuxonDateTime;
}) {
  const { userId, rangeStart, rangeEndExclusive } = opts;
  const focusCol = db.collection("users").doc(userId).collection("focus");

  const startTs = admin.firestore.Timestamp.fromDate(rangeStart.toJSDate());
  const endTs = admin.firestore.Timestamp.fromDate(rangeEndExclusive.toJSDate());

  const [qStartSnap, qEndSnap] = await Promise.all([
    focusCol.where("startTs", ">=", startTs).where("startTs", "<", endTs).get(),
    focusCol.where("endTs", ">=", startTs).where("endTs", "<", endTs).get(),
  ]);

  const docsMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  qStartSnap.forEach((d) => docsMap.set(d.id, d));
  qEndSnap.forEach((d) => docsMap.set(d.id, d));
  return docsMap;
}

export function listIsoDates(rangeStart: LuxonDateTime, rangeEndExclusive: LuxonDateTime) {
  const days: string[] = [];
  let cursor = rangeStart.startOf("day");
  const end = rangeEndExclusive.startOf("day");
  while (cursor < end) {
    const id = cursor.toISODate();
    if (!id) break;
    days.push(id);
    cursor = cursor.plus({ days: 1 });
  }
  return days;
}

function listMonths(rangeStart: LuxonDateTime, rangeEndExclusive: LuxonDateTime) {
  const months: string[] = [];
  let cursor = rangeStart.startOf("month");
  const end = rangeEndExclusive.startOf("month");
  while (cursor < end) {
    months.push(cursor.toFormat("yyyy-MM"));
    cursor = cursor.plus({ months: 1 });
  }
  return months;
}

export async function computeDailyAggFromFocusSessions(opts: {
  userId: string;
  tz: string;
  rangeStart: LuxonDateTime;
  rangeEndExclusive: LuxonDateTime;
  labelToId: Map<string, string>;
}) {
  const { userId, tz, rangeStart, rangeEndExclusive, labelToId } = opts;
  const docsMap = await queryFocusDocsOverlappingRange({ userId, rangeStart, rangeEndExclusive });

  const byDate = new Map<string, DailyAgg>();

  docsMap.forEach((doc) => {
    const data = doc.data() as any;

    const startDate = toDate(data.startTs);
    const endDate = toDate(data.endTs) ?? startDate;
    if (!startDate || !endDate) return;

    let sessionStart = DateTime.fromJSDate(startDate).setZone(tz);
    let sessionEnd = DateTime.fromJSDate(endDate).setZone(tz);
    if (!sessionStart.isValid || !sessionEnd.isValid || sessionEnd <= sessionStart) return;

    sessionStart = sessionStart < rangeStart ? rangeStart : sessionStart;
    sessionEnd = sessionEnd > rangeEndExclusive ? rangeEndExclusive : sessionEnd;
    if (sessionEnd <= sessionStart) return;

    const rawTagId = typeof data.tagId === "string" ? data.tagId.trim() : "";
    const tagId = rawTagId || labelToId.get(String(data.activity || "").trim()) || "_unknown";

    let cursor = sessionStart;
    while (cursor < sessionEnd) {
      const dayStart = cursor.startOf("day");
      const nextDay = dayStart.plus({ days: 1 });
      const chunkEnd = sessionEnd < nextDay ? sessionEnd : nextDay;

      const dayId = dayStart.toISODate();
      if (!dayId) break;

      if (!byDate.has(dayId)) {
        byDate.set(dayId, {
          totalSeconds: 0,
          byHourSeconds: Array(24).fill(0),
          byTagSeconds: {},
        });
      }
      const dayAgg = byDate.get(dayId)!;

      const secondsForDay = Math.max(0, Math.floor(chunkEnd.diff(cursor, "seconds").seconds));
      dayAgg.totalSeconds += secondsForDay;
      dayAgg.byTagSeconds[tagId] = (dayAgg.byTagSeconds[tagId] ?? 0) + secondsForDay;

      let hourCursor = cursor;
      while (hourCursor < chunkEnd) {
        const hourIdx = hourCursor.hour;
        const nextHour = hourCursor.startOf("hour").plus({ hours: 1 });
        const hourEnd = chunkEnd < nextHour ? chunkEnd : nextHour;
        const secondsForHour = Math.max(0, Math.floor(hourEnd.diff(hourCursor, "seconds").seconds));
        dayAgg.byHourSeconds[hourIdx] += secondsForHour;
        hourCursor = hourEnd;
      }

      cursor = chunkEnd;
    }
  });

  return byDate;
}

export async function computeMonthlyAggFromFocusSessions(opts: {
  userId: string;
  tz: string;
  rangeStart: LuxonDateTime;
  rangeEndExclusive: LuxonDateTime;
  labelToId: Map<string, string>;
}) {
  const { userId, tz, rangeStart, rangeEndExclusive, labelToId } = opts;
  const docsMap = await queryFocusDocsOverlappingRange({ userId, rangeStart, rangeEndExclusive });

  const byMonth = new Map<string, MonthlyAgg>();

  docsMap.forEach((doc) => {
    const data = doc.data() as any;

    const startDate = toDate(data.startTs);
    const endDate = toDate(data.endTs) ?? startDate;
    if (!startDate || !endDate) return;

    let sessionStart = DateTime.fromJSDate(startDate).setZone(tz);
    let sessionEnd = DateTime.fromJSDate(endDate).setZone(tz);
    if (!sessionStart.isValid || !sessionEnd.isValid || sessionEnd <= sessionStart) return;

    sessionStart = sessionStart < rangeStart ? rangeStart : sessionStart;
    sessionEnd = sessionEnd > rangeEndExclusive ? rangeEndExclusive : sessionEnd;
    if (sessionEnd <= sessionStart) return;

    const rawTagId = typeof data.tagId === "string" ? data.tagId.trim() : "";
    const tagId = rawTagId || labelToId.get(String(data.activity || "").trim()) || "_unknown";

    let cursor = sessionStart;
    while (cursor < sessionEnd) {
      const monthStart = cursor.startOf("month");
      const nextMonth = monthStart.plus({ months: 1 });
      const chunkEnd = sessionEnd < nextMonth ? sessionEnd : nextMonth;

      const monthId = monthStart.toFormat("yyyy-MM");
      if (!byMonth.has(monthId)) {
        byMonth.set(monthId, { totalSeconds: 0, byTagSeconds: {} });
      }
      const monthAgg = byMonth.get(monthId)!;

      const secondsForMonth = Math.max(0, Math.floor(chunkEnd.diff(cursor, "seconds").seconds));
      monthAgg.totalSeconds += secondsForMonth;
      monthAgg.byTagSeconds[tagId] = (monthAgg.byTagSeconds[tagId] ?? 0) + secondsForMonth;

      cursor = chunkEnd;
    }
  });

  return byMonth;
}

export async function ensureDailyRollupsInRange(opts: {
  userId: string;
  tz: string;
  rangeStart: LuxonDateTime;
  rangeEndExclusive: LuxonDateTime;
}) {
  const { userId, tz, rangeStart, rangeEndExclusive } = opts;
  const startIso = rangeStart.toISODate();
  const endIso = rangeEndExclusive.toISODate();
  if (!startIso || !endIso) return new Map<string, any>();

  const dailyCol = db.collection("users").doc(userId).collection("dailyRollups");
  const snap = await dailyCol.where("date", ">=", startIso).where("date", "<", endIso).get();

  const existing = new Map<string, any>();
  snap.forEach((d) => existing.set(String(d.get("date") || d.id), d.data()));

  const expected = listIsoDates(rangeStart, rangeEndExclusive);
  const missing = expected.filter((d) => !existing.has(d));
  if (missing.length === 0) return existing;

  const labelToId = await getUserTagLabelToIdMap(userId);
  const computed = await computeDailyAggFromFocusSessions({ userId, tz, rangeStart, rangeEndExclusive, labelToId });

  const batch = db.batch();
  for (const dayId of missing) {
    const agg = computed.get(dayId) ?? { totalSeconds: 0, byHourSeconds: Array(24).fill(0), byTagSeconds: {} };

    const byHourSeconds: Record<string, number> = {};
    agg.byHourSeconds.forEach((sec, idx) => {
      if (!sec) return;
      byHourSeconds[String(idx)] = sec;
    });

    const byTagSeconds: Record<string, number> = {};
    Object.entries(agg.byTagSeconds).forEach(([tagId, sec]) => {
      if (!sec) return;
      byTagSeconds[tagId] = sec;
    });

    batch.set(
      dailyCol.doc(dayId),
      {
        date: dayId,
        tz,
        totalSeconds: agg.totalSeconds,
        byHourSeconds,
        byTagSeconds,
        computedAt: admin.firestore.FieldValue.serverTimestamp(),
        version: 1,
      },
      { merge: false }
    );

    existing.set(dayId, {
      date: dayId,
      tz,
      totalSeconds: agg.totalSeconds,
      byHourSeconds,
      byTagSeconds,
      version: 1,
    });
  }

  await batch.commit();
  return existing;
}

export async function ensureMonthlyRollupsInRange(opts: {
  userId: string;
  tz: string;
  rangeStart: LuxonDateTime;
  rangeEndExclusive: LuxonDateTime;
}) {
  const { userId, tz, rangeStart, rangeEndExclusive } = opts;
  const startId = rangeStart.toFormat("yyyy-MM");
  const endId = rangeEndExclusive.toFormat("yyyy-MM");

  const monthlyCol = db.collection("users").doc(userId).collection("monthlyRollups");
  const snap = await monthlyCol.where("month", ">=", startId).where("month", "<", endId).get();

  const existing = new Map<string, any>();
  snap.forEach((d) => existing.set(String(d.get("month") || d.id), d.data()));

  const expected = listMonths(rangeStart, rangeEndExclusive);
  const missing = expected.filter((m) => !existing.has(m));
  if (missing.length === 0) return existing;

  const labelToId = await getUserTagLabelToIdMap(userId);
  const computed = await computeMonthlyAggFromFocusSessions({ userId, tz, rangeStart, rangeEndExclusive, labelToId });

  const batch = db.batch();
  for (const monthId of missing) {
    const agg = computed.get(monthId) ?? { totalSeconds: 0, byTagSeconds: {} };

    const byTagSeconds: Record<string, number> = {};
    Object.entries(agg.byTagSeconds).forEach(([tagId, sec]) => {
      if (!sec) return;
      byTagSeconds[tagId] = sec;
    });

    batch.set(
      monthlyCol.doc(monthId),
      {
        month: monthId,
        tz,
        totalSeconds: agg.totalSeconds,
        byTagSeconds,
        computedAt: admin.firestore.FieldValue.serverTimestamp(),
        version: 1,
      },
      { merge: false }
    );

    existing.set(monthId, { month: monthId, tz, totalSeconds: agg.totalSeconds, byTagSeconds, version: 1 });
  }

  await batch.commit();
  return existing;
}
