/** NHL EDGE tracking figures (mph) from public leaderboards, 2025-26 season. */
export const MPH_TO_KPH = 1.609344;

export type NhlPlayer = {
  name: string;
  team: string;
  position: "C" | "L" | "R" | "D" | "F";
  skateMph: number | null;
  shotMph: number | null;
};

export const NHL_SOURCE = "NHL EDGE player & puck tracking (nhl.com/nhl-edge, hockey.kodoanalytics.com/edge)";

export const nhlPlayers: NhlPlayer[] = [
  { name: "NHL average", team: "League", position: "F", skateMph: 22.1, shotMph: 84.3 },
  { name: "Auston Matthews", team: "TOR", position: "C", skateMph: 21.5, shotMph: 90.5 },
  { name: "Brady Tkachuk", team: "FLA", position: "L", skateMph: 21.6, shotMph: 93.8 },
  { name: "Jack Hughes", team: "NJD", position: "C", skateMph: 22.6, shotMph: 80.2 },
  { name: "Kyle Connor", team: "WPG", position: "L", skateMph: 22.2, shotMph: 83.1 },
  { name: "Timo Meier", team: "NJD", position: "R", skateMph: 22.3, shotMph: 89.6 },
  { name: "Jack Roslovic", team: "TOR", position: "C", skateMph: 23.7, shotMph: 83.6 },
  { name: "Cale Makar (hardest shot)", team: "COL", position: "D", skateMph: null, shotMph: 101.9 },
];

export const toKph = (mph: number) => Math.round(mph * MPH_TO_KPH * 10) / 10;

/** Your value as a percent of the NHL value, or null when either is missing. */
export function percentOf(yours: number | null | undefined, nhl: number | null): number | null {
  if (yours == null || !(yours > 0) || nhl == null || !(nhl > 0)) return null;
  return Math.round((yours / nhl) * 100);
}
