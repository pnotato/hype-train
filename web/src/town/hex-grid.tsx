import { useMemo } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { hexKey, hexSize, hexToWorld, worldToHex, type Hex } from "../spread/hex.ts";
import type { Vec } from "../spread/life.ts";

// Faint outlines of the hexes residents can stand on: every hex whose centre
// is within `radius` of the origin, plus the hexes at `extra` (their homes).

export default function HexGrid({ radius, extra }: { radius: number; extra: Vec[] }) {
  const geometry = useMemo(() => {
    const cells = new Map<string, Hex>();
    const n = Math.ceil(radius / hexSize);
    for (let q = -n; q <= n; q++)
      for (let r = -n; r <= n; r++) {
        const [x, , z] = hexToWorld({ q, r });
        if (Math.hypot(x, z) <= radius) cells.set(hexKey({ q, r }), { q, r });
      }
    for (const v of extra) cells.set(hexKey(worldToHex(v)), worldToHex(v));

    // Six edges per hex, as line segments (shared edges are drawn twice).
    const corner = (i: number) => {
      const a = (Math.PI / 3) * i + Math.PI / 6; // pointy top: corners at 30°, 90°, ...
      return [hexSize * Math.cos(a), hexSize * Math.sin(a)] as const;
    };
    const points: number[] = [];
    for (const h of cells.values()) {
      const [x, , z] = hexToWorld(h);
      for (let i = 0; i < 6; i++) {
        const [ax, az] = corner(i);
        const [bx, bz] = corner(i + 1);
        points.push(x + ax, 0, z + az, x + bx, 0, z + bz);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(points, 3));
    return g;
  }, [radius, extra]);

  return (
    <lineSegments geometry={geometry} position-y={0.04}>
      <lineBasicMaterial color="#5b5446" transparent opacity={0.3} />
    </lineSegments>
  );
}
