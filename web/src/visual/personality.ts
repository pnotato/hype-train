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
