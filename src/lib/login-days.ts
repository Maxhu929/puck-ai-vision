/** Public leaderboard name: first 3 letters of the email name, rest hidden. */
export function maskName(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0] ?? "";
  if (!local) return "Player";
  return local.slice(0, 3) + "•••";
}

export type LoginRow = { user_id: string; display_name: string };

/** Count distinct days per user, highest first. */
export function rankLoginDays(rows: LoginRow[]) {
  const map = new Map<string, { name: string; days: number }>();
  for (const r of rows) {
    const e = map.get(r.user_id) ?? { name: r.display_name || "Player", days: 0 };
    e.days += 1;
    map.set(r.user_id, e);
  }
  return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.days - a.days);
}
