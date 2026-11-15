import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import {
  DoubleSide,
  Shape,
  ShapeGeometry,
  Vector3,
  type Group,
  type Mesh,
  type Object3D,
} from "three";
import type { Link } from "../spread/sim.ts";

// The selected resident's cause chain: a trail of chevrons marching in an arc
// over the heads, from each parent to the child they made worse, so A → B → C
// reads as one chain even when they stand close together. Residents keep
// moving, so every frame each trail re-reads both ends from the anchors
// (empty groups that ride along inside each resident).

const colour = "#d9433f";
const headHeight = 1.25; // arcs start and end just above the tallest body
const spacing = 0.3; // distance between chevrons, along the ground
const maxChevrons = 60; // enough for the longest walk across the plaza
const marchSpeed = 0.6; // units per second

const reducedMotion =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// A flat ">" pointing +z.
const chevron = (() => {
  const s = new Shape();
  s.moveTo(0, 0.12);
  s.lineTo(0.17, -0.05);
  s.lineTo(0.11, -0.11);
  s.lineTo(0, 0);
  s.lineTo(-0.11, -0.11);
  s.lineTo(-0.17, -0.05);
  s.closePath();
  const g = new ShapeGeometry(s);
  g.rotateX(Math.PI / 2); // +y becomes +z
  return g;
})();

const a = new Vector3();
const b = new Vector3();

function Trail({ link, anchors }: { link: Link; anchors: RefObject<(Object3D | null)[]> }) {
  const group = useRef<Group>(null);
  const marks = useRef<(Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const from = anchors.current[link.parent];
    const to = anchors.current[link.child];
    const g = group.current;
    if (!from || !to || !g) return;
    from.getWorldPosition(a);
    to.getWorldPosition(b);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.max(0.01, Math.hypot(dx, dz));
    const rise = 0.3 + 0.12 * dist; // longer links arc higher
    g.position.set(a.x, headHeight, a.z);
    g.rotation.y = Math.atan2(dx, dz);
    const shift = reducedMotion ? 0 : (clock.elapsedTime * marchSpeed) % spacing;
    marks.current.forEach((m, k) => {
      if (!m) return;
      const z = k * spacing + shift;
      const u = z / dist; // 0 at the parent, 1 at the child
      m.visible = u <= 1;
      if (!m.visible) return;
      // A parabola, with each chevron tilted along it.
      m.position.set(0, rise * 4 * u * (1 - u), z);
      m.rotation.x = -Math.atan((rise * 4 * (1 - 2 * u)) / dist);
    });
  });

  return (
    <group ref={group}>
      {Array.from({ length: maxChevrons }, (_, k) => (
        <mesh
          key={k}
          ref={(m) => {
            marks.current[k] = m;
          }}
          geometry={chevron}
          visible={false}
        >
          <meshBasicMaterial color={colour} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export default function CauseLinks({
  links,
  anchors,
}: {
  links: Link[];
  anchors: RefObject<(Object3D | null)[]>;
}) {
  return links.map((l) => <Trail key={l.turn} link={l} anchors={anchors} />);
}
