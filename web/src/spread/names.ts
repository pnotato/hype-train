import type { Rng } from "./sim.ts";

// Fictional names for prototype residents (CLAUDE.md rule 3). Same lists as
// internal/sim/roster.go; ponytail: hand copy until the RunLog supplies names.

export const firstNames = [
  "Marla",
  "Dex",
  "Juno",
  "Otis",
  "Wren",
  "Ike",
  "Bram",
  "Cleo",
  "Dot",
  "Eli",
  "Fern",
  "Gus",
  "Hattie",
  "Ivo",
  "Jessa",
  "Kit",
  "Lark",
  "Moss",
  "Nell",
  "Odie",
  "Pim",
  "Quill",
  "Rosa",
  "Sully",
  "Tamsin",
  "Ulla",
  "Vern",
  "Willa",
  "Xan",
  "Yara",
  "Zeb",
  "Amos",
  "Bea",
  "Cass",
  "Dell",
  "Effie",
  "Flint",
  "Greta",
  "Hal",
  "Iris",
];

export const lastNames = [
  "Penhallow",
  "Arroway",
  "Vale",
  "Brannock",
  "Halloway",
  "Somersby",
  "Ashgrove",
  "Bellwether",
  "Cobble",
  "Dunmore",
  "Elderby",
  "Fairweather",
  "Gristle",
  "Hobbs",
  "Inkwell",
  "Juniper",
  "Kettering",
  "Larkspur",
  "Merriweather",
  "Nettlefield",
  "Oakes",
  "Pemberton",
  "Quarry",
  "Rookwood",
  "Saltmarsh",
  "Thistle",
  "Underhill",
  "Vantwood",
  "Whitlock",
  "Yarrow",
  "Brightwater",
  "Crumb",
  "Dappleby",
  "Fennick",
  "Gorse",
  "Hearth",
  "Mallow",
  "Pickering",
  "Rumbold",
  "Tolliver",
];

// n random names with distinct first names, so short names never clash.
export function drawNames(rng: Rng, n: number): { first: string; last: string }[] {
  const pool = [...firstNames];
  return Array.from({ length: Math.min(n, pool.length) }, () => {
    const first = pool.splice(Math.floor(rng() * pool.length), 1)[0]!;
    const last = lastNames[Math.floor(rng() * lastNames.length)]!;
    return { first, last };
  });
}
