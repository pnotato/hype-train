import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { Vector3, type Group, type Mesh, type Object3D } from "three";
import type { Link } from "../spread/sim.ts";

// The selected resident's cause chain drawn on the floor: a red path with an
// arrow from each parent to the child they made worse. Residents keep moving,
// so every frame each path re-reads both ends from the anchors (empty groups
// that ride along inside each resident).

const colour = "#d9433f";
const clearance = 0.6; // keep the path ends out from under the bodies
const a = new Vector3();
const b = new Vector3();

function Path({ link, anchors }: { link: Link; anchors: RefObject<(Object3D | null)[]> }) {
  const group = useRef<Group>(null);
  const bar = useRef<Mesh>(null);

  useFrame(() => {
    const from = anchors.current[link.parent];
    const to = anchors.current[link.child];
    const g = group.current;
    if (!from || !to || !g || !bar.current) return;
    from.getWorldPosition(a);
    to.getWorldPosition(b);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.max(0.01, Math.hypot(dx, dz) - 2 * clearance);
    g.position.set((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2);
    g.rotation.y = Math.atan2(dx, dz);
    bar.current.scale.z = len;
  });

  return (
    <group ref={group}>
      <mesh ref={bar}>
        <boxGeometry args={[0.07, 0.02, 1]} />
        <meshBasicMaterial color={colour} />
      </mesh>
      {/* Arrowhead at the middle, pointing at the child (+z). */}
      <mesh rotation-x={Math.PI / 2}>
        <coneGeometry args={[0.16, 0.36, 3]} />
        <meshBasicMaterial color={colour} />
      </mesh>
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
  return links.map((l) => <Path key={l.turn} link={l} anchors={anchors} />);
}
