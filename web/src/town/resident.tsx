import type { Ref } from "react";
import {
  ExtrudeGeometry,
  LatheGeometry,
  Shape as Path2D,
  Vector2,
  type Group,
  type MeshStandardMaterial,
} from "three";
import type { Shape } from "../visual/personality.ts";
import type { FaceStyle } from "./faces.ts";
import { VeggieBody } from "./veggie.tsx";
import { veggieFace, veggieFor } from "./veggies.ts";

// ?veggies swaps the plain shapes for vegetables (veggie.tsx).
const veggies = new URLSearchParams(location.search).has("veggies");

// A resident: a body in their archetype's shape with a face on the front (+z).
// Every body is about one world unit tall and stands on y = 0.

const starDepth = 0.3;
const starGeometry = (() => {
  const outer = 0.55;
  const inner = 0.25;
  const path = new Path2D();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) path.moveTo(r * Math.cos(a), r * Math.sin(a));
    else path.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  path.closePath();
  const g = new ExtrudeGeometry(path, {
    depth: starDepth,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.04,
    bevelSegments: 3,
  });
  g.translate(0, 0, -starDepth / 2);
  return g;
})();

// Teardrop: a sphere at the bottom running straight up to a point. The profile
// follows the circle up to where a line from the tip touches it, then the line.
const tearRadius = 0.38;
const tearGeometry = (() => {
  const r = tearRadius;
  const tip = 1.05;
  const theta = Math.acos(r / (tip - r)); // tangent point, from straight up
  const points: Vector2[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const phi = Math.PI - ((Math.PI - theta) * i) / steps;
    points.push(new Vector2(r * Math.sin(phi), r + r * Math.cos(phi)));
  }
  points.push(new Vector2(0, tip));
  return new LatheGeometry(points, 32);
})();

const cubeSize = 0.72;

function Body({ shape }: { shape: Shape }) {
  switch (shape) {
    case "capsule":
      return <capsuleGeometry args={[0.3, 0.4, 8, 16]} />;
    case "sphere":
      return <sphereGeometry args={[0.45, 32, 16]} />;
    case "star":
      return <primitive object={starGeometry} attach="geometry" />;
    case "cube":
      return <boxGeometry args={[cubeSize, cubeSize, cubeSize]} />;
    case "cone":
      return <coneGeometry args={[0.42, 1.1, 32]} />;
    case "teardrop":
      return <primitive object={tearGeometry} attach="geometry" />;
  }
}

type Layout = {
  bodyY: number; // centre height of the body
  faceY: number; // face centre height
  faceZ: number; // front surface depth at the face
};

const layout: Record<Shape, Layout> = {
  capsule: { bodyY: 0.5, faceY: 0.62, faceZ: 0.29 },
  sphere: { bodyY: 0.45, faceY: 0.5, faceZ: 0.44 },
  star: { bodyY: 0.5, faceY: 0.5, faceZ: starDepth / 2 + 0.05 },
  cube: { bodyY: cubeSize / 2, faceY: 0.4, faceZ: cubeSize / 2 },
  cone: { bodyY: 0.55, faceY: 0.45, faceZ: 0.3 },
  teardrop: { bodyY: 0, faceY: 0.42, faceZ: tearRadius },
};

const ink = "#1d2a33";

function Eyes({ style }: { style: FaceStyle }) {
  return (
    <>
      {[-0.09, 0.09].map((x) => (
        <group key={x} position={[x, 0.05, 0]}>
          {style === "sleepy" ? (
            <mesh>
              <boxGeometry args={[0.07, 0.016, 0.02]} />
              <meshStandardMaterial color={ink} />
            </mesh>
          ) : (
            <mesh>
              <sphereGeometry args={[0.045, 16, 8]} />
              <meshStandardMaterial color={ink} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

// Brow tilt: worried raises the inner ends, angry lowers them.
const browTilt: Partial<Record<FaceStyle, number>> = { worried: 0.4, angry: -0.4 };

function Brows({ style }: { style: FaceStyle }) {
  const tilt = browTilt[style];
  if (tilt === undefined) return null;
  return (
    <>
      {[-1, 1].map((side) => (
        // side -1 is the left brow; its inner end is on the right (+x).
        <mesh key={side} position={[side * 0.09, 0.13, 0]} rotation-z={-side * tilt}>
          <boxGeometry args={[0.085, 0.018, 0.02]} />
          <meshStandardMaterial color={ink} />
        </mesh>
      ))}
    </>
  );
}

function Mouth({ style }: { style: FaceStyle }) {
  switch (style) {
    case "flat":
    case "angry":
      return (
        <mesh position-y={-0.05}>
          <boxGeometry args={[0.1, 0.018, 0.02]} />
          <meshStandardMaterial color={ink} />
        </mesh>
      );
    case "o":
      return (
        <mesh position-y={-0.06}>
          <torusGeometry args={[0.035, 0.014, 8, 16]} />
          <meshStandardMaterial color={ink} />
        </mesh>
      );
    case "frown":
    case "worried":
      // Upper half of a torus curves up into a frown.
      return (
        <mesh position-y={-0.08}>
          <torusGeometry args={[0.06, 0.015, 8, 16, Math.PI]} />
          <meshStandardMaterial color={ink} />
        </mesh>
      );
    default:
      // Lower half curves down into a smile.
      return (
        <mesh position-y={-0.03} rotation-z={Math.PI}>
          <torusGeometry args={[0.06, 0.015, 8, 16, Math.PI]} />
          <meshStandardMaterial color={ink} />
        </mesh>
      );
  }
}

type Props = {
  shape: Shape;
  colour: string;
  face?: FaceStyle;
  position?: [number, number, number];
  // For animation: the body material (to fade colour) and the mouth (to flap).
  materialRef?: Ref<MeshStandardMaterial>;
  mouthRef?: Ref<Group>;
};

// Pivot for mouth animation, at the middle of the mouth.
const mouthY = -0.06;

export default function Resident({
  shape,
  colour,
  face = "smile",
  position = [0, 0, 0],
  materialRef,
  mouthRef,
}: Props) {
  const l = layout[shape];
  const veggie = veggies ? veggieFor[shape] : undefined;
  const face_ = veggie ? veggieFace[veggie] : { y: l.faceY, z: l.faceZ };
  return (
    <group position={position}>
      {veggie ? (
        <>
          <VeggieBody veggie={veggie} />
          {/* Vegetables keep their own colours, so mood colour sits underfoot. */}
          <mesh rotation-x={-Math.PI / 2} position-y={0.015}>
            <circleGeometry args={[0.45, 32]} />
            <meshStandardMaterial ref={materialRef} color={colour} />
          </mesh>
        </>
      ) : (
        <mesh castShadow position-y={l.bodyY}>
          <Body shape={shape} />
          <meshStandardMaterial ref={materialRef} color={colour} />
        </mesh>
      )}
      <group position={[0, face_.y, face_.z]}>
        <Brows style={face} />
        <Eyes style={face} />
        <group ref={mouthRef} position-y={mouthY}>
          <group position-y={-mouthY}>
            <Mouth style={face} />
          </group>
        </group>
      </group>
    </group>
  );
}
