import cron from "node-cron";
import admin from "firebase-admin";

const db = admin.firestore();

function ymdUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function endOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export async function computeDailyFocusForAllUsers(targetDayUTC?: Date) {
  // Default: previous UTC day
  const day = targetDayUTC
    ? new Date(Date.UTC(targetDayUTC.getUTCFullYear(), targetDayUTC.getUTCMonth(), targetDayUTC.getUTCDate()))
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const start = startOfDayUTC(day);
  const end = endOfDayUTC(day);
  const dayId = ymdUTC(day);

  const usersSnap = await db.collection("users").get();

  const startTs = admin.firestore.Timestamp.fromDate(start);
  const endTs = admin.firestore.Timestamp.fromDate(end);

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
          if (d.activity === "Focus" || d.activity === "Rest") {
            total += Number(d.durationSec || 0);
            sessions += 1;
          }
        });

        const dailyRef = db
          .collection("users")
          .doc(uid)
          .collection("dailyFocus")
          .doc(dayId);

        return dailyRef.set(
          {
            date: dayId,
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
  console.log(`[dailyFocus] Computed ${dayId} for ${usersSnap.size} users`);
}

export function startDailyFocusCron() {
  cron.schedule(
    "0 2 * * *", // every day at 2:00 AM ie we catch started all the way up until midnight 
    async () => {
      try {
        await computeDailyFocusForAllUsers(); 
      } catch (err) {
        console.error("[dailyFocus] Cron failed:", err);
      }
    },
    { timezone: "Europe/London" } 
  );

  console.log("[dailyFocus] Cron scheduled for 02:00 Europe/London daily");
}
