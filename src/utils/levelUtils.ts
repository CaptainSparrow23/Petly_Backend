/**
 * Shared level calculation utilities
 * Matches the logic in GlobalProvider.tsx computeLevelMeta
 */

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Calculate user level from total XP
 */
export function calculateLevel(totalXPRaw: unknown): number {
  const totalXP = Math.max(0, toNumber(totalXPRaw, 0));
  const maxLevel = 10;
  const xpNeededForNext = (currentLevel: number) =>
    50 * Math.pow(currentLevel, 1.5); // XP to go from L to L+1

  let level = 1;
  let remainingXP = totalXP;

  while (level < maxLevel) {
    const needed = xpNeededForNext(level);
    if (remainingXP < needed) break;
    remainingXP -= needed;
    level += 1;
  }

  return level;
}

