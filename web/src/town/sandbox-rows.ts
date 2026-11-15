import {
  ageGroups,
  ageLabel,
  ageScale,
  archetypeLabel,
  archetypes,
  shapeFor,
  type Archetype,
  type Shape,
} from "../visual/personality.ts";
import { archetypeShare, archetypeTraits, variantCredulity } from "../spread/traits.ts";
import { faceColour, faces, type FaceStyle } from "./faces.ts";
import { scenarios, type Scenario } from "./scenarios.ts";

// What the shape sandbox shows: rows of characters, each with the details the
// dock lists when you click one.

export type SandboxItem = {
  id: string;
  name: string;
  shape: Shape;
  colour: string;
  face: FaceStyle;
  scale: number;
  animated: boolean;
  details: [string, string][];
  talkingTo?: string; // id of the item they're talking to, for scenario actors
};

export type SandboxRow = { id: string; label: string; items: SandboxItem[] };

// Default traits as inspector rows; clout-chaser credulity depends on the variant.
const traits = (a: Archetype): [string, string][] => [
  ["share", `${archetypeShare[a]} / 100`],
  ...Object.entries(archetypeTraits[a]).map(([k, v]): [string, string] =>
    a === "clout-chaser" && k === "credulity"
      ? [
          k,
          `${variantCredulity["true-believer"]} (True Believer) / ${variantCredulity.cynic} (Cynic)`,
        ]
      : [k, v],
  ),
];

const neutral = faceColour.smile;

const faceItem = (f: FaceStyle, rank: number, animated: boolean): SandboxItem => ({
  id: `${animated ? "animated" : "face"}-${f}`,
  name: f,
  shape: "cube",
  colour: faceColour[f],
  face: f,
  scale: 1,
  animated,
  details: [
    ["face", f],
    ["happiness", `${rank + 1} of ${faces.length} (1 = happiest)`],
    ["colour", faceColour[f]],
    ["animated", animated ? "yes" : "no"],
  ],
});

export const rows: SandboxRow[] = [
  {
    id: "shapes",
    label: "Archetype shapes",
    items: archetypes.map((a) => ({
      id: `shape-${a}`,
      name: archetypeLabel[a],
      shape: shapeFor[a],
      colour: neutral,
      face: "smile",
      scale: 1,
      animated: false,
      details: [["archetype", archetypeLabel[a]], ["shape", shapeFor[a]], ...traits(a)],
    })),
  },
  { id: "faces", label: "Faces", items: faces.map((f, i) => faceItem(f, i, false)) },
  { id: "animated", label: "Animated faces", items: faces.map((f, i) => faceItem(f, i, true)) },
  {
    id: "ages",
    label: "Ages (size)",
    items: ageGroups.map((g) => ({
      id: `age-${g}`,
      name: ageLabel[g],
      shape: "cube",
      colour: neutral,
      face: "smile",
      scale: ageScale[g],
      animated: false,
      details: [
        ["age group", ageLabel[g]],
        ["size", `${ageScale[g]}×`],
      ],
    })),
  },
];

// The two actors in each scenario, selectable like any other character. The
// face here is the last beat's; the sandbox swaps in the live face as it plays.
export const actorId = (sc: Scenario, side: "a" | "b") => `${sc.id}-${side}`;

export const actorItems: SandboxItem[] = scenarios.flatMap((sc) =>
  (["a", "b"] as const).map((side): SandboxItem => {
    const other = side === "a" ? "b" : "a";
    const archetype = sc[side];
    const face = sc.beats.at(-1)?.[side].face ?? "flat";
    return {
      id: actorId(sc, side),
      name: side === "a" ? sc.aName : sc.bName,
      shape: shapeFor[archetype],
      colour: faceColour[face],
      face,
      scale: 1,
      animated: false,
      details: [["archetype", archetypeLabel[archetype]], ...traits(archetype)],
      talkingTo: actorId(sc, other),
    };
  }),
);
