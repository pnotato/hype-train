import { useFrame } from "@react-three/fiber";
import { useRef, type ComponentProps } from "react";
import type { Group } from "three";
import type { FaceStyle } from "./faces.ts";
import Resident from "./resident.tsx";

// A resident with a looping idle animation that matches their face. Moves the
// whole body (pivot at the feet) by mutating a ref in useFrame.

type Pose = { y: number; rx: number; ry: number; rz: number; sx: number; sy: number };

const rest: Pose = { y: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1 };

// A short burst every `period` seconds: returns 0..1..0 over `length`, else 0.
function burst(t: number, period: number, length: number) {
  const p = t % period;
  return p < length ? Math.sin((p / length) * Math.PI) : 0;
}

const animate: Record<FaceStyle, (t: number) => Partial<Pose>> = {
  // Happy hop with a squash on landing.
  smile: (t) => {
    const h = Math.abs(Math.sin(t * 3));
    return { y: h * 0.25, sy: 0.92 + 0.08 * h, sx: 1.04 - 0.04 * h };
  },
  // Slow breathing and a sleepy sway.
  sleepy: (t) => ({ sy: 1 + 0.04 * Math.sin(t * 1.2), rz: 0.08 * Math.sin(t * 0.6) }),
  // Idly looking left and right.
  flat: (t) => ({ ry: 0.25 * Math.sin(t * 0.8) }),
  // A startled pop every couple of seconds.
  o: (t) => {
    const b = burst(t, 2, 0.35);
    return { y: b * 0.35, sx: 1 + 0.1 * b, sy: 1 + 0.15 * b };
  },
  // Slumped forward, slowly sighing.
  frown: (t) => ({ rx: 0.15 + 0.05 * Math.sin(t * 0.7), sy: 0.97 + 0.02 * Math.sin(t * 0.7) }),
  // A nervous tremble with quick glances around.
  worried: (t) => ({
    rz: 0.05 * Math.sin(t * 25),
    ry: 0.3 * Math.sin(t * 1.3) * Math.abs(Math.sin(t * 0.5)),
  }),
  // Fuming: puffing up and shaking in bursts.
  angry: (t) => {
    const b = burst(t, 1.6, 0.6);
    return { rz: 0.12 * b * Math.sin(t * 30), sx: 1 + 0.06 * b, sy: 1 + 0.06 * b };
  },
};

const reducedMotion =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

type Props = ComponentProps<typeof Resident> & { face: FaceStyle };

export default function AnimatedResident({ position, ...props }: Props) {
  const body = useRef<Group>(null);

  useFrame(({ clock }) => {
    const g = body.current;
    if (!g || reducedMotion) return;
    const p = { ...rest, ...animate[props.face](clock.elapsedTime) };
    g.position.y = p.y;
    g.rotation.set(p.rx, p.ry, p.rz);
    g.scale.set(p.sx, p.sy, p.sx);
  });

  return (
    <group position={position}>
      <group ref={body}>
        <Resident {...props} />
      </group>
    </group>
  );
}
