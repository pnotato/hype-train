import type { Archetype } from "../visual/personality.ts";

// ponytail: copy of the archetype defaults in internal/sim/persona.go, for the
// browser prototypes only. The real UI reads each resident's traits from the
// RunLog. Clout-chasers get their credulity from their variant.

export type Level = "low" | "mid" | "high";
export type Variant = "true-believer" | "cynic";

export type Traits = {
  credulity: Level;
  broadcast: Level;
  reactivity: Level;
  sociability: Level;
  distortion: "level" | "sharpen" | "assimilate";
  motive: "inform" | "warn" | "clout";
};

export const archetypeTraits: Record<Archetype, Traits> = {
  regular: {
    credulity: "mid",
    broadcast: "mid",
    reactivity: "mid",
    sociability: "mid",
    distortion: "level",
    motive: "inform",
  },
  connector: {
    credulity: "mid",
    broadcast: "low",
    reactivity: "mid",
    sociability: "high",
    distortion: "assimilate",
    motive: "inform",
  },
  worrier: {
    credulity: "high",
    broadcast: "low",
    reactivity: "high",
    sociability: "mid",
    distortion: "sharpen",
    motive: "warn",
  },
  skeptic: {
    credulity: "low",
    broadcast: "mid",
    reactivity: "low",
    sociability: "mid",
    distortion: "level",
    motive: "inform",
  },
  "clout-chaser": {
    credulity: "mid", // replaced by the variant
    broadcast: "high",
    reactivity: "mid",
    sociability: "mid",
    distortion: "sharpen",
    motive: "clout",
  },
  hermit: {
    credulity: "mid",
    broadcast: "low",
    reactivity: "low",
    sociability: "low",
    distortion: "level",
    motive: "inform",
  },
};

export const variantCredulity: Record<Variant, Level> = { "true-believer": "high", cynic: "low" };

export const archetypeShare: Record<Archetype, number> = {
  regular: 35,
  connector: 15,
  worrier: 15,
  skeptic: 15,
  "clout-chaser": 10,
  hermit: 10,
};

export function traitsFor(a: Archetype, v?: Variant): Traits {
  const t = { ...archetypeTraits[a] };
  if (v) t.credulity = variantCredulity[v];
  return t;
}
