import type { Archetype } from "../visual/personality.ts";
import type { FaceStyle } from "./faces.ts";
import type { Pose } from "./mood-actor.tsx";

// Looping two-character interactions for the shape sandbox. Each beat sets
// both characters' face (which also sets their mood colour), whether they are
// talking, and a body pose. Shapes never change.

export type ActorBeat = { face: FaceStyle; talking?: boolean; pose?: Pose };

export type Beat = { seconds: number; a: ActorBeat; b: ActorBeat };

export type Scenario = {
  id: string;
  label: string;
  a: Archetype; // left
  b: Archetype; // right
  aName: string; // fictional, shown in the dock
  bName: string;
  beats: Beat[];
};

export const scenarios: Scenario[] = [
  {
    id: "telling",
    label: "Telling: Clout-chaser tells, Worrier reacts",
    a: "clout-chaser",
    b: "worrier",
    aName: "Bob",
    bName: "Jeff",
    beats: [
      { seconds: 1.6, a: { face: "smile", talking: true, pose: "lean" }, b: { face: "flat" } },
      {
        seconds: 1.6,
        a: { face: "o", talking: true, pose: "bounce" },
        b: { face: "o", pose: "recoil" },
      },
      {
        seconds: 1.8,
        a: { face: "smile", talking: true, pose: "lean" },
        b: { face: "worried", pose: "tremble" },
      },
      { seconds: 1.6, a: { face: "smile" }, b: { face: "frown", pose: "slump" } },
      { seconds: 1.2, a: { face: "smile" }, b: { face: "flat" } },
    ],
  },
  {
    id: "arguing",
    label: "Arguing: Skeptic and Connector",
    a: "skeptic",
    b: "connector",
    aName: "Mira",
    bName: "Theo",
    beats: [
      { seconds: 1.4, a: { face: "flat", talking: true, pose: "lean" }, b: { face: "flat" } },
      {
        seconds: 1.4,
        a: { face: "frown" },
        b: { face: "frown", talking: true, pose: "lean" },
      },
      {
        seconds: 1.4,
        a: { face: "angry", talking: true, pose: "shake" },
        b: { face: "frown", pose: "recoil" },
      },
      {
        seconds: 1.4,
        a: { face: "angry", pose: "recoil" },
        b: { face: "angry", talking: true, pose: "shake" },
      },
      {
        seconds: 1.8,
        a: { face: "angry", talking: true, pose: "shake" },
        b: { face: "angry", talking: true, pose: "shake" },
      },
      { seconds: 1.6, a: { face: "frown", pose: "slump" }, b: { face: "frown", pose: "slump" } },
      { seconds: 1.0, a: { face: "flat" }, b: { face: "flat" } },
    ],
  },
];
