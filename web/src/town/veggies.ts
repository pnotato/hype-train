import type { Shape } from "../visual/personality.ts";

// Which vegetable stands in for each shape on the ?veggies page, and where its
// face goes. Bodies are drawn in veggie.tsx.

export type Veggie = "carrot" | "onion" | "broccoli" | "eggplant" | "corn" | "pepper";

export const veggieFor: Record<Shape, Veggie> = {
  capsule: "carrot",
  sphere: "onion",
  star: "broccoli",
  cube: "eggplant",
  cone: "corn",
  teardrop: "pepper",
};

// Face centre height and front surface depth at that height.
export const veggieFace: Record<Veggie, { y: number; z: number }> = {
  carrot: { y: 0.66, z: 0.22 },
  onion: { y: 0.42, z: 0.4 },
  broccoli: { y: 0.33, z: 0.2 },
  eggplant: { y: 0.55, z: 0.36 },
  corn: { y: 0.55, z: 0.27 },
  pepper: { y: 0.42, z: 0.39 },
};
