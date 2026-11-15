// ponytail: face styles to compare in the shape sandbox. Real faces will come
// from belief (CLAUDE.md rule 5) in src/visual/belief.ts.
export type FaceStyle = "smile" | "flat" | "o" | "sleepy" | "frown" | "worried" | "angry";

// Happiest first.
export const faces: readonly FaceStyle[] = [
  "smile",
  "sleepy",
  "flat",
  "o",
  "frown",
  "worried",
  "angry",
];

// Body colour per face, one distinct hue each so they read apart:
// happy yellow, content green, neutral grey, surprised orange, sad blue,
// worried purple, angry red.
export const faceColour: Record<FaceStyle, string> = {
  smile: "#f5c842",
  sleepy: "#5fbf7f",
  flat: "#b8b4aa",
  o: "#f28c38",
  frown: "#4a8fd9",
  worried: "#9b6fd1",
  angry: "#d9433f",
};
