import cron from "node-cron";
import admin from "firebase-admin";

const db = admin.firestore();

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// ISO week helpers (UTC-based)
function startOfISOWeekUTC(d: Date) {
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const diffToMon = day === 0 ? -6 : 1 - day; // move back to Monday
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMon, 0, 0, 0, 0));
}

function endOfISOWeekUTC(d: Date) {
  const start = startOfISOWeekUTC(d);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6, 23, 59, 59, 999));
}

// Compute ISO week number and ISO week-year (UTC)
// Algorithm: use Thursday of the week to determine the ISO year
function isoWeekYearAndNumberUTC(d: Date): { isoYear: number; isoWeek: number } {
  // Copy and normalize to UTC midnight
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday in current week decides the year
  const day = date.getUTCDay() || 7; // 1..7, Mon..Sun
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const isoYear = date.getUTCFullYear();

  // Week number: count days since Jan 1st of ISO year’s week 1
  const jan1 = new Date(Date.UTC(isoYear, 0, 1));
  const jan1Day = jan1.getUTCDay() || 7;
  const week1Start = new Date(jan1);
  week1Start.setUTCDate(jan1.getUTCDate() + (jan1Day <= 4 ? 1 - jan1Day : 8 - jan1Day)); // Monday of week 1

  const diffMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(
    week1Start.getUTCFullYear(),
    week1Start.getUTCMonth(),
    week1Start.getUTCDate()
  );
  const isoWeek = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

  return { isoYear, isoWeek };
}

function weekIdUTC(d: Date) {
  const { isoYear, isoWeek } = isoWeekYearAndNumberUTC(d);
  return `${isoYear}-W${pad2(isoWeek)}`; // e.g. "2025-W40"
}

export async function computeWeeklyFocusForAllUsers(targetWeekUTC?: Date) {
  // Default: previous ISO week in UTC
  const base = targetWeekUTC ? new Date(Date.UTC(
    targetWeekUTC.getUTCFullYear(),
    targetWeekUTC.getUTCMonth(),
    targetWeekUTC.getUTCDate()
  )) : new Date();

  const thisWeekStart = startOfISOWeekUTC(base);
  const prevWeekStart = new Date(Date.UTC(
    thisWeekStart.getUTCFullYear(),
    thisWeekStart.getUTCMonth(),
    thisWeekStart.getUTCDate() - 7,
    0, 0, 0, 0
  ));
  const prevWeekEnd = new Date(Date.UTC(
    prevWeekStart.getUTCFullYear(),
    prevWeekStart.getUTCMonth(),
    prevWeekStart.getUTCDate() + 6,
    23, 59, 59, 999
  ));

  const weekId = weekIdUTC(prevWeekStart);

  const startTs = admin.firestore.Timestamp.fromDate(prevWeekStart);
  const endTs = admin.firestore.Timestamp.fromDate(prevWeekEnd);

  const usersSnap = await db.collection("users").get();

  const tasks: Promise<any>[] = [];

  usersSnap.forEach((userDoc) => {
    const uid = userDoc.id;
    const focusCol = db.collection("users").doc(uid).collection("focus");

    const p = focusCol
      .where("startTs", ">=", startTs)
      .where("startTs", "<=", endTs)
      .get()
      .then((snap) => {
        let total = 0;
        let sessions = 0;

        snap.forEach((doc) => {
          const d = doc.data() as any;
          if (d.activity === "Study") {
            total += Number(d.durationSec || 0);
            sessions += 1;
          }
        });

        const weeklyRef = db
          .collection("users")
          .doc(uid)
          .collection("weeklyFocus")
          .doc(weekId);

        return weeklyRef.set(
          {
            date: weekId, // e.g. "2025-W40"
            totalDurationSec: total,
            sessionsCount: sessions,
            computedAt: admin.firestore.FieldValue.serverTimestamp(),
            windowStart: startTs,
            windowEnd: endTs,
          },
          { merge: true }
        );
      });

    tasks.push(p);
  });

  await Promise.all(tasks);
  console.log(`[weeklyFocus] Computed ${weekId} for ${usersSnap.size} users`);
}

// Cron: every Monday at 03:00 Europe/London, compute the previous ISO week (Mon–Sun, UTC)
export function startWeeklyFocusCron() {
  cron.schedule(
    "0 3 * * 1",
    async () => {
      try {
        await computeWeeklyFocusForAllUsers();
      } catch (err) {
        console.error("[weeklyFocus] Cron failed:", err);
      }
    },
    { timezone: "Europe/London" }
  );

  console.log("[weeklyFocus] Cron scheduled for 03:00 Europe/London every Monday (processes previous week)");
}