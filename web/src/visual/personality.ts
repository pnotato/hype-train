// Archetype → body shape. The one place that decides what a resident looks
// like from their personality (docs/PLAN.md, "Residents").

// ponytail: hand-written until tygo generates Archetype from internal/sim (M1);
// swap for the import from sim-types.ts then.
export type Archetype = "regular" | "connector" | "worrier" | "skeptic" | "clout-chaser" | "hermit";

export type Shape = "capsule" | "sphere" | "star" | "cube" | "cone" | "teardrop";

export const archetypes: readonly Archetype[] = [
  "regular",
  "connector",
  "worrier",
  "skeptic",
  "clout-chaser",
  "hermit",
];

export const shapeFor: Record<Archetype, Shape> = {
  regular: "capsule",
  connector: "sphere",
  worrier: "star",
  skeptic: "cube",
  "clout-chaser": "cone",
  hermit: "teardrop",
};

export const archetypeLabel: Record<Archetype, string> = {
  regular: "Regular",
  connector: "Connector",
  worrier: "Worrier",
  skeptic: "Skeptic",
  "clout-chaser": "Clout-chaser",
  hermit: "Hermit",
};

// Age → body size. Size grows with age; adult and middle share medium.
// ponytail: hand-written until tygo generates AgeGroup (M1).
export type AgeGroup = "young" | "adult" | "middle" | "senior";

export const ageGroups: readonly AgeGroup[] = ["young", "adult", "middle", "senior"];

export const ageScale: Record<AgeGroup, number> = {
  young: 0.75,
  adult: 1,
  middle: 1,
  senior: 1.25,
};

export const ageLabel: Record<AgeGroup, string> = {
  young: "Young (18–29)",
  adult: "Adult (30–49)",
  middle: "Middle (50–64)",
  senior: "Senior (65+)",
};
