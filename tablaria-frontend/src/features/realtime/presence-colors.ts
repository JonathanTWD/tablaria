/**
 * Colors told apart in both themes, dark enough for white initials (4.5:1).
 * Each person keeps theirs everywhere.
 */
const PRESENCE_COLORS = [
  { avatar: "bg-sky-700", ring: "ring-sky-500", row: "bg-sky-500/10" },
  { avatar: "bg-violet-700", ring: "ring-violet-500", row: "bg-violet-500/10" },
  { avatar: "bg-emerald-700", ring: "ring-emerald-500", row: "bg-emerald-500/10" },
  { avatar: "bg-rose-700", ring: "ring-rose-500", row: "bg-rose-500/10" },
  { avatar: "bg-amber-700", ring: "ring-amber-500", row: "bg-amber-500/10" },
  { avatar: "bg-teal-700", ring: "ring-teal-500", row: "bg-teal-500/10" },
  { avatar: "bg-fuchsia-700", ring: "ring-fuchsia-500", row: "bg-fuchsia-500/10" },
  { avatar: "bg-indigo-600", ring: "ring-indigo-500", row: "bg-indigo-500/10" },
] as const;

export type PresenceColor = (typeof PRESENCE_COLORS)[number];

/** The same user always gets the same color, in every tab and browser. */
export function presenceColor(userId: string): PresenceColor {
  let hash = 0;
  for (const character of userId) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

/** Two letters for the avatar, from the display name. */
export function initials(name: string): string {
  const letters = name.replace(/[^\p{L}\p{N}]/gu, "");
  return (letters.slice(0, 2) || "?").toUpperCase();
}
