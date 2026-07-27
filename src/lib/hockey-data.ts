export type Submission = {
  id: string;
  title: string;
  date: string;
  duration: string;
  grade: string;
  status: "Analyzed" | "Processing";
};

export const recentSubmissions: Submission[] = [
  { id: "s1", title: "Bantam AA vs. Northside — 2nd Period", date: "Mar 14", duration: "12:40", grade: "A-", status: "Analyzed" },
  { id: "s2", title: "Power Play Reps — Practice", date: "Mar 11", duration: "06:12", grade: "B+", status: "Analyzed" },
  { id: "s3", title: "Shootout Drills", date: "Mar 08", duration: "04:55", grade: "B", status: "Analyzed" },
  { id: "s4", title: "Scrimmage — Full Shift Tape", date: "Mar 02", duration: "18:21", grade: "A", status: "Analyzed" },
];

export const feedbackCategories = [
  { name: "Skating & Edges", score: 88, note: "Strong crossovers through the neutral zone; keep knees bent on tight turns." },
  { name: "Puck Control", score: 81, note: "Head stays down on entries — lift eyes a half-second earlier." },
  { name: "Shot Quality", score: 92, note: "Quick release off the pass. Weight transfer is consistent." },
  { name: "Positioning", score: 74, note: "Drifting high in the D-zone on cycle plays; collapse toward the slot." },
  { name: "Compete Level", score: 95, note: "Wins 8 of 10 board battles. Excellent second effort." },
];

export const timelineFeedback = [
  { time: "01:12", tag: "Zone Entry", type: "positive" as const, text: "Delayed entry drew the defender wide and opened the middle lane for the trailer." },
  { time: "03:48", tag: "Defensive Zone", type: "warning" as const, text: "Puck-watching below the goal line. Stick should be in the passing lane to the weak side." },
  { time: "07:03", tag: "Shot Selection", type: "positive" as const, text: "One-timer from the off-wing circle — release under 0.4s after reception." },
  { time: "09:36", tag: "Transition", type: "warning" as const, text: "Late backcheck on the odd-man rush; first three strides need more urgency." },
  { time: "11:20", tag: "Forecheck", type: "positive" as const, text: "Angled the D-man to the wall and forced the turnover leading to a scoring chance." },
];

export const keyStats = [
  { label: "Shots on Goal", value: "7", delta: "+2" },
  { label: "Shooting %", value: "28.6%", delta: "+4.1%" },
  { label: "Top Speed", value: "31.4 km/h", delta: "+0.8" },
  { label: "Puck Touches", value: "63", delta: "+9" },
  { label: "Zone Entries", value: "14", delta: "+3" },
  { label: "Takeaways", value: "5", delta: "+1" },
  { label: "Faceoff Win %", value: "54%", delta: "-2%" },
  { label: "Avg Shift", value: "48s", delta: "-3s" },
];

export const shiftTrend = [
  { game: "G1", grade: 74, speed: 28.1 },
  { game: "G2", grade: 79, speed: 29.0 },
  { game: "G3", grade: 77, speed: 28.6 },
  { game: "G4", grade: 84, speed: 30.2 },
  { game: "G5", grade: 88, speed: 30.9 },
  { game: "G6", grade: 91, speed: 31.4 },
];

export type Player = {
  id: string;
  name: string;
  team: string;
  position: string;
  location: string;
  grade: number;
  radar: { metric: string; value: number }[];
  stats: Record<string, string>;
};

export const players: Player[] = [
  {
    id: "you",
    name: "You",
    team: "Riverside Rangers",
    position: "Center",
    location: "Minneapolis, MN",
    grade: 91,
    radar: [
      { metric: "Skating", value: 88 },
      { metric: "Shooting", value: 92 },
      { metric: "Passing", value: 84 },
      { metric: "Defense", value: 74 },
      { metric: "Compete", value: 95 },
    ],
    stats: { Goals: "14", Assists: "21", "Shots/Game": "4.2", "Top Speed": "31.4 km/h", "Faceoff %": "54%", "Avg Shift": "48s" },
  },
  {
    id: "m-tremblay",
    name: "M. Tremblay",
    team: "Lakeside Bruins",
    position: "Left Wing",
    location: "Ottawa, ON",
    grade: 94,
    radar: [
      { metric: "Skating", value: 95 },
      { metric: "Shooting", value: 89 },
      { metric: "Passing", value: 90 },
      { metric: "Defense", value: 80 },
      { metric: "Compete", value: 88 },
    ],
    stats: { Goals: "18", Assists: "17", "Shots/Game": "4.9", "Top Speed": "33.0 km/h", "Faceoff %": "41%", "Avg Shift": "44s" },
  },
  {
    id: "j-okafor",
    name: "J. Okafor",
    team: "Northside Wolves",
    position: "Defense",
    location: "Detroit, MI",
    grade: 89,
    radar: [
      { metric: "Skating", value: 84 },
      { metric: "Shooting", value: 71 },
      { metric: "Passing", value: 88 },
      { metric: "Defense", value: 96 },
      { metric: "Compete", value: 90 },
    ],
    stats: { Goals: "5", Assists: "26", "Shots/Game": "2.6", "Top Speed": "30.1 km/h", "Faceoff %": "—", "Avg Shift": "55s" },
  },
  {
    id: "a-lindqvist",
    name: "A. Lindqvist",
    team: "Harbor Kings",
    position: "Right Wing",
    location: "Boston, MA",
    grade: 86,
    radar: [
      { metric: "Skating", value: 82 },
      { metric: "Shooting", value: 93 },
      { metric: "Passing", value: 76 },
      { metric: "Defense", value: 70 },
      { metric: "Compete", value: 91 },
    ],
    stats: { Goals: "20", Assists: "9", "Shots/Game": "5.4", "Top Speed": "29.7 km/h", "Faceoff %": "38%", "Avg Shift": "46s" },
  },
  {
    id: "r-santos",
    name: "R. Santos",
    team: "Summit Chiefs",
    position: "Center",
    location: "Denver, CO",
    grade: 83,
    radar: [
      { metric: "Skating", value: 80 },
      { metric: "Shooting", value: 78 },
      { metric: "Passing", value: 89 },
      { metric: "Defense", value: 79 },
      { metric: "Compete", value: 85 },
    ],
    stats: { Goals: "9", Assists: "24", "Shots/Game": "3.1", "Top Speed": "29.2 km/h", "Faceoff %": "58%", "Avg Shift": "50s" },
  },
  {
    id: "d-park",
    name: "D. Park",
    team: "Ironside Steel",
    position: "Defense",
    location: "Pittsburgh, PA",
    grade: 80,
    radar: [
      { metric: "Skating", value: 76 },
      { metric: "Shooting", value: 68 },
      { metric: "Passing", value: 82 },
      { metric: "Defense", value: 90 },
      { metric: "Compete", value: 84 },
    ],
    stats: { Goals: "3", Assists: "19", "Shots/Game": "2.2", "Top Speed": "28.4 km/h", "Faceoff %": "—", "Avg Shift": "57s" },
  },
];

/** Shot heat map grid: 6 rows x 10 cols of attempt density (0-100). */
export const shotHeatMap: number[][] = [
  [2, 4, 6, 10, 14, 12, 8, 5, 3, 1],
  [5, 9, 18, 32, 44, 40, 26, 14, 7, 3],
  [8, 16, 36, 68, 88, 82, 54, 28, 12, 5],
  [7, 15, 34, 64, 94, 90, 50, 25, 11, 4],
  [4, 8, 17, 30, 42, 38, 24, 13, 6, 2],
  [1, 3, 5, 9, 13, 11, 7, 4, 2, 1],
];