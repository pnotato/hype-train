import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Color, MathUtils, type Group, type MeshStandardMaterial } from "three";
import type { Shape } from "../visual/personality.ts";
import { faceColour, type FaceStyle } from "./faces.ts";
import Resident from "./resident.tsx";

// A resident that acts: walks to a spot, turns, takes a pose, talks (mouth
// flap and speech bubble) and fades its colour to match its face. Props are
// targets; useFrame eases toward them on refs. With reduced motion, faces and
// colours still change and moves snap instead of easing.

export type Pose = "idle" | "lean" | "recoil" | "tremble" | "shake" | "bounce" | "slump";

const reducedMotion =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Settled lean (rx, forward is +) and height for each pose; wobble is added on top.
const base: Record<Pose, { rx: number; y: number }> = {
  idle: { rx: 0, y: 0 },
  lean: { rx: 0.1, y: 0 },
  recoil: { rx: -0.14, y: 0.05 },
  tremble: { rx: -0.04, y: 0 },
  shake: { rx: 0.1, y: 0 },
  bounce: { rx: 0.05, y: 0 },
  slump: { rx: 0.14, y: -0.03 },
};

function wobble(pose: Pose, t: number) {
  switch (pose) {
    case "tremble":
      return { rz: 0.05 * Math.sin(t * 28), y: 0 };
    case "shake":
      return { rz: 0.06 * Math.sin(t * 32), y: 0.04 * Math.abs(Math.sin(t * 9)) };
    case "bounce":
      return { rz: 0, y: 0.18 * Math.abs(Math.sin(t * 7)) };
    default:
      return { rz: 0, y: 0 };
  }
}

function SpeechBubble({ angry }: { angry: boolean }) {
  return (
    <Billboard position={[0, 1.5, 0]}>
      <mesh scale={[0.42, 0.28, 0.05]}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshStandardMaterial color={angry ? "#ffd9d6" : "white"} />
      </mesh>
      {[-0.13, 0, 0.13].map((x) => (
        <mesh key={x} position={[x, 0, 0.06]}>
          <sphereGeometry args={[0.04, 12, 6]} />
          <meshStandardMaterial color="#1d2a33" />
        </mesh>
      ))}
    </Billboard>
  );
}

// Shortest signed angle from a to b.
function angleDelta(a: number, b: number) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

type Props = {
  shape: Shape;
  face: FaceStyle;
  position: [number, number, number];
  yaw?: number; // radians; 0 faces +z (the camera)
  pose?: Pose;
  talking?: boolean;
  walkSpeed?: number; // easing rate for moves and turns
  children?: ReactNode; // extras that move with the actor, e.g. a selection ring
};

export default function MoodActor({
  shape,
  face,
  position,
  yaw = 0,
  pose = "idle",
  talking = false,
  walkSpeed = 4,
  children,
}: Props) {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const mouth = useRef<Group>(null);
  const settled = useRef({ rx: 0, y: 0 });
  const target = useMemo(() => new Color(faceColour[face]), [face]);
  // Start where and how we first appear; after that, props are only targets.
  const [start] = useState(() => ({ position, yaw, colour: faceColour[face] }));

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const k = reducedMotion ? 1 : 1 - Math.exp(-delta * walkSpeed);

    const m = material.current;
    if (m) m.color.lerp(target, reducedMotion ? 1 : 1 - Math.exp(-delta * 4));

    const r = root.current;
    if (r) {
      r.position.x += (position[0] - r.position.x) * k;
      r.position.z += (position[2] - r.position.z) * k;
      r.rotation.y += angleDelta(r.rotation.y, yaw) * k;
    }

    const g = body.current;
    if (!g || reducedMotion) return;
    const s = settled.current;
    s.rx = MathUtils.damp(s.rx, base[pose].rx, 8, delta);
    s.y = MathUtils.damp(s.y, base[pose].y, 8, delta);
    const w = wobble(pose, t);
    g.rotation.set(s.rx, 0, w.rz);
    g.position.y = s.y + w.y;
    if (mouth.current) {
      const open = talking ? Math.abs(Math.sin(t * 13)) : 0;
      mouth.current.scale.set(1 - 0.2 * open, 1 + open, 1);
    }
  });

  return (
    <group ref={root} position={start.position} rotation-y={start.yaw}>
      <group ref={body}>
        <Resident
          shape={shape}
          colour={start.colour}
          face={face}
          materialRef={material}
          mouthRef={mouth}
        />
      </group>
      {talking && <SpeechBubble angry={face === "angry"} />}
      {children}
    </group>
  );
}
