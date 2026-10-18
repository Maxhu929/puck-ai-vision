import { z } from "zod";

export const identityDetailsSchema = z.object({
  lineMates: z.string().trim().max(160).default(""),
  benchSide: z.string().trim().max(160).default(""),
  attackDirection: z.string().trim().max(160).default(""),
  anchorMoment: z.string().trim().max(400).default(""),
  firstOnIce: z.string().trim().max(80).default(""),
  helmet: z.string().trim().max(160).default(""),
  equipment: z.string().trim().max(240).default(""),
  lookalikes: z.string().trim().max(240).default(""),
});
export type IdentityDetails = z.infer<typeof identityDetailsSchema>;
export const identityFields: Array<{ key: keyof IdentityDetails; label: string; placeholder: string }> = [
  { key: "lineMates", label: "Line mates", placeholder: "#8 and #22, both in red" },
  { key: "firstOnIce", label: "First on-ice time", placeholder: "01:12 in this video" },
  { key: "benchSide", label: "Team bench", placeholder: "Near side, right of center ice" },
  { key: "attackDirection", label: "Attacking direction", placeholder: "Left to right until 12:30" },
  { key: "anchorMoment", label: "Recognizable moment", placeholder: "At 03:20 I take the faceoff near our bench" },
  { key: "helmet", label: "Helmet and face protection", placeholder: "White helmet, full cage" },
  { key: "equipment", label: "Distinctive equipment", placeholder: "White stick tape, red gloves, striped socks" },
  { key: "lookalikes", label: "Similar-looking players", placeholder: "The other team also has a #17, in black" },
];
export const shiftSchema = z.object({ start: z.number().finite().min(0), end: z.number().finite().min(0) }).refine(s => s.end > s.start, "Shift end must be after its start");
export const shiftsSchema = z.array(shiftSchema).max(100).transform(s => [...s].sort((a, b) => a.start - b.start)).refine(s => s.every((v, i) => i === 0 || v.start >= s[i - 1].end), "Shifts cannot overlap");
export const marksSchema = z.array(z.object({
  time: z.number().finite().min(0), x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1),
  w: z.number().finite().positive().max(1), h: z.number().finite().positive().max(1),
}).refine(m => m.x + m.w <= 1.000001 && m.y + m.h <= 1.000001, "Box must fit inside the video frame")).max(100);

export const evidenceSchema = z.object({
  confidence: z.enum(["high", "medium", "low"]),
  observedClues: z.array(z.string().max(400)).max(20),
  uncertainty: z.string().max(1200),
  verifiedIntervals: z.array(shiftSchema).max(100),
});
export type IdentificationEvidence = z.infer<typeof evidenceSchema>;
export function videoSeconds(value: string): number | null {
  if (!/^\d+:\d{2}(?::\d{2})?$/.test(value)) return null;
  const parts = value.split(":").map(Number);
  if (parts.slice(1).some(p => p >= 60)) return null;
  return parts.reduce((a, p) => a * 60 + p, 0);
}
export function isVerifiedTime(time: string, evidence: IdentificationEvidence, shifts?: Array<{ start: number; end: number }>): boolean {
  const seconds = videoSeconds(time);
  return seconds !== null && evidence.verifiedIntervals.some(s => seconds >= s.start && seconds < s.end)
    && (shifts === undefined || shifts.some(s => seconds >= s.start && seconds < s.end));
}
export function hasVerifiedIdentity(identified: unknown, evidence: IdentificationEvidence | null, shifts?: Array<{ start: number; end: number }>) {
  return identified === true && evidence?.confidence === "high" && evidence.observedClues.some(c => c.trim().length > 0)
    && evidence.verifiedIntervals.length > 0 && (shifts === undefined || shifts.length > 0);
}