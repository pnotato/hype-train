import type { Vec } from "./life.ts";

// The ground is a grid of pointy-top hexes (axial q, r). Every resident stands
// on the centre of one hex, no two share a hex, and two residents talk only
// from neighbouring hexes. See redblobgames.com/grids/hexagons for the maths.

export type Hex = { q: number; r: number };

export const hexSize = 0.65; // centre to corner; neighbours are √3 × this apart
export const hexStep = Math.sqrt(3) * hexSize;

const dirs: Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const hexKey = (h: Hex) => `${h.q},${h.r}`;

export const hexToWorld = ({ q, r }: Hex): Vec => [hexStep * (q + r / 2), 0, 1.5 * hexSize * r];

export function worldToHex([x, , z]: Vec): Hex {
  const fq = (x * Math.sqrt(3)) / 3 / hexSize - z / 3 / hexSize;
  const fr = ((2 / 3) * z) / hexSize;
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q: q + 0, r: r + 0 }; // + 0 turns -0 into 0 for stable keys
}

export const snap = (v: Vec) => hexToWorld(worldToHex(v));
export const cellOf = (v: Vec) => hexKey(worldToHex(v));

export const neighbours = (h: Hex) => dirs.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));

export const hexDistance = (a: Hex, b: Hex) =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

const dist2 = (a: Vec, b: Vec) => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2;

// The free hex nearest `target` (its own hex if free), searching outward ring
// by ring. `taken` holds hexKeys.
export function nearestFree(target: Vec, taken: ReadonlySet<string>): Vec {
  const start = worldToHex(target);
  const seen = new Set([hexKey(start)]);
  let ring = [start];
  while (ring.length) {
    const free = ring.filter((h) => !taken.has(hexKey(h))).map(hexToWorld);
    if (free.length) return free.sort((a, b) => dist2(a, target) - dist2(b, target))[0]!;
    ring = ring.flatMap(neighbours).filter((h) => !seen.has(hexKey(h)) && seen.add(hexKey(h)));
  }
  return snap(target); // unreachable: the grid is unbounded
}

// A free hex next to `of`, the one closest to `near`; null if all six are taken.
export function freeNeighbour(of: Vec, near: Vec, taken: ReadonlySet<string>): Vec | null {
  const free = neighbours(worldToHex(of))
    .filter((h) => !taken.has(hexKey(h)))
    .map(hexToWorld)
    .sort((a, b) => dist2(a, near) - dist2(b, near));
  return free[0] ?? null;
}
