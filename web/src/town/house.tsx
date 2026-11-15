import { ExtrudeGeometry, Shape as Path2D } from "three";
import type { Shape } from "../visual/personality.ts";

// A resident's house, styled after their body shape so you can tell at a glance
// who lives where. The front door faces +z and sits at the house's feet;
// footprints stay within about 1.3 units of the centre so neighbours fit.

export type HouseColours = { wall: string; roof: string; trim: string };

const ink = "#4a3527"; // doors
const glass = "#fff1b8"; // lit windows

// Triangular prism for gable roofs: width 1, height 1, depth 1, base on y = 0.
const gable = (() => {
  const p = new Path2D();
  p.moveTo(-0.5, 0);
  p.lineTo(0.5, 0);
  p.lineTo(0, 1);
  p.closePath();
  const g = new ExtrudeGeometry(p, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g;
})();

// Triangle pennant for the tower's flag, pointing +x.
const pennant = (() => {
  const p = new Path2D();
  p.moveTo(0, 0);
  p.lineTo(0.5, -0.15);
  p.lineTo(0, -0.3);
  p.closePath();
  return new ExtrudeGeometry(p, { depth: 0.02, bevelEnabled: false });
})();

function Door({
  z,
  y = 0,
  width = 0.42,
  height = 0.72,
}: {
  z: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  return (
    <group position={[0, y, z]}>
      <mesh position-y={height / 2}>
        <boxGeometry args={[width, height, 0.06]} />
        <meshStandardMaterial color={ink} />
      </mesh>
      <mesh position={[width * 0.3, height * 0.48, 0.04]}>
        <sphereGeometry args={[0.03, 8, 6]} />
        <meshStandardMaterial color="#e8c04a" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function SquareWindow({ position, trim }: { position: [number, number, number]; trim: string }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.38, 0.38, 0.04]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <mesh position-z={0.02}>
        <boxGeometry args={[0.3, 0.3, 0.04]} />
        <meshStandardMaterial color={glass} emissive={glass} emissiveIntensity={0.25} />
      </mesh>
      {/* Cross bars */}
      <mesh position-z={0.045}>
        <boxGeometry args={[0.3, 0.03, 0.01]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <mesh position-z={0.045}>
        <boxGeometry args={[0.03, 0.3, 0.01]} />
        <meshStandardMaterial color={trim} />
      </mesh>
    </group>
  );
}

// A porthole facing +z; `rotation` turns it to sit flat on a curved wall.
function RoundWindow({
  position,
  rotation = [0, 0, 0],
  trim,
  r = 0.17,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  trim: string;
  r?: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[r + 0.05, r + 0.05, 0.04, 24]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-z={0.015}>
        <cylinderGeometry args={[r, r, 0.04, 24]} />
        <meshStandardMaterial color={glass} emissive={glass} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

// Regular: a cottage with a gable roof, chimney and flower box.
function Cottage({ wall, roof, trim }: HouseColours) {
  return (
    <>
      <mesh castShadow receiveShadow position-y={0.6}>
        <boxGeometry args={[1.8, 1.2, 1.5]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh castShadow position-y={1.2} scale={[2.1, 0.95, 1.75]}>
        <primitive object={gable} attach="geometry" />
        <meshStandardMaterial color={roof} />
      </mesh>
      <mesh castShadow position={[0.5, 1.75, -0.2]}>
        <boxGeometry args={[0.25, 0.6, 0.25]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <Door z={0.76} />
      <SquareWindow position={[0.55, 0.72, 0.76]} trim={trim} />
      <SquareWindow position={[-0.55, 0.72, 0.76]} trim={trim} />
      <mesh position={[-0.55, 0.47, 0.84]}>
        <boxGeometry args={[0.42, 0.1, 0.12]} />
        <meshStandardMaterial color={roof} />
      </mesh>
      {[-0.68, -0.55, -0.42].map((x, i) => (
        <mesh key={x} position={[x, 0.56, 0.86]}>
          <sphereGeometry args={[0.055, 8, 6]} />
          <meshStandardMaterial color={["#e8577a", "#f5c842", "#9b6fd1"][i]} />
        </mesh>
      ))}
    </>
  );
}

// Connector: a round bubble house with portholes and a skylight knob.
function Dome({ wall, roof, trim }: HouseColours) {
  const r = 1.15;
  return (
    <>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={0.08}>
        <torusGeometry args={[r, 0.08, 10, 40]} />
        <meshStandardMaterial color={roof} />
      </mesh>
      <mesh castShadow position-y={r - 0.02}>
        <sphereGeometry args={[0.28, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={roof} />
      </mesh>
      <mesh position-y={r + 0.3}>
        <sphereGeometry args={[0.1, 12, 8]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      {/* Arched porch tunnel sticking out the front. */}
      <mesh castShadow position={[0, 0, 1]} rotation-x={-Math.PI / 2}>
        <cylinderGeometry args={[0.45, 0.45, 0.7, 24, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <Door z={1.36} width={0.38} height={0.42} />
      {/* Portholes either side of the porch, tipped up to sit on the dome. */}
      {[-0.75, 0.75].map((a) => (
        <group key={a} rotation-y={a}>
          <group rotation-x={-0.5}>
            <RoundWindow trim={trim} position={[0, 0, r - 0.01]} />
          </group>
        </group>
      ))}
    </>
  );
}

// Worrier: a tall, nervous house that leans one way and then the other.
function Crooked({ wall, roof, trim }: HouseColours) {
  return (
    <group rotation-z={0.06}>
      <mesh castShadow receiveShadow position-y={0.75}>
        <boxGeometry args={[1.3, 1.5, 1.2]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <Door z={0.61} />
      <SquareWindow position={[0, 1.2, 0.61]} trim={trim} />
      <group position-y={1.5} rotation-z={-0.14}>
        <mesh castShadow position-y={0.45}>
          <boxGeometry args={[1.05, 0.9, 1.0]} />
          <meshStandardMaterial color={wall} />
        </mesh>
        <SquareWindow position={[0, 0.45, 0.51]} trim={trim} />
        <group position-y={0.9} rotation-z={0.12}>
          <mesh castShadow scale={[1.35, 1.1, 1.2]}>
            <primitive object={gable} attach="geometry" />
            <meshStandardMaterial color={roof} />
          </mesh>
          <mesh castShadow position={[-0.35, 0.7, 0]} rotation-z={0.2}>
            <boxGeometry args={[0.18, 0.55, 0.18]} />
            <meshStandardMaterial color={trim} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// Skeptic: three blocks stacked a little askew, flat roof with an antenna.
function Stack({ wall, roof, trim }: HouseColours) {
  const blocks: { size: number; yaw: number; colour: string }[] = [
    { size: 1.5, yaw: 0, colour: wall },
    { size: 1.15, yaw: 0.35, colour: roof },
    { size: 0.8, yaw: -0.25, colour: wall },
  ];
  let y = 0;
  return (
    <>
      {blocks.map((b, i) => {
        const at = y;
        y += b.size;
        return (
          <group key={i} position-y={at} rotation-y={b.yaw}>
            <mesh castShadow receiveShadow position-y={b.size / 2}>
              <boxGeometry args={[b.size, b.size, b.size]} />
              <meshStandardMaterial color={b.colour} />
            </mesh>
            {i === 0 ? (
              <Door z={b.size / 2 + 0.01} />
            ) : (
              <SquareWindow position={[0, b.size / 2, b.size / 2 + 0.01]} trim={trim} />
            )}
          </group>
        );
      })}
      <group position-y={y} rotation-y={-0.25}>
        <mesh position={[0.2, 0.3, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
          <meshStandardMaterial color={trim} />
        </mesh>
        <mesh position={[0.2, 0.6, 0]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color="#d9433f" emissive="#d9433f" emissiveIntensity={0.4} />
        </mesh>
      </group>
    </>
  );
}

// Clout-chaser: a tower with a pointy roof and a flag, so everyone sees it.
function Tower({ wall, roof, trim }: HouseColours) {
  const r = 0.75;
  const h = 2.4;
  return (
    <>
      <mesh castShadow receiveShadow position-y={h / 2}>
        <cylinderGeometry args={[r, r * 1.1, h, 28]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh position-y={h - 0.05}>
        <cylinderGeometry args={[r + 0.08, r + 0.08, 0.1, 28]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <mesh castShadow position-y={h + 0.65}>
        <coneGeometry args={[r + 0.2, 1.3, 28]} />
        <meshStandardMaterial color={roof} />
      </mesh>
      <mesh position-y={h + 1.6}>
        <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <mesh position={[0.01, h + 1.93, 0]}>
        <primitive object={pennant} attach="geometry" />
        <meshStandardMaterial color="#e8577a" />
      </mesh>
      <Door z={r * 1.1 + 0.02} />
      <RoundWindow position={[0, 1.2, 0.8]} trim={trim} />
      <RoundWindow position={[0, 1.85, 0.78]} trim={trim} r={0.13} />
    </>
  );
}

// Hermit: a mushroom with a spotted cap and a crooked little chimney pipe.
function Mushroom({ wall, roof, trim }: HouseColours) {
  const spots: [number, number][] = [
    [0.3, 0.2],
    [0.55, 1.9],
    [0.75, 3.4],
    [0.5, 4.6],
    [0.85, 0.9],
    [0.15, 2.8],
  ];
  return (
    <>
      <mesh castShadow receiveShadow position-y={0.65}>
        <cylinderGeometry args={[0.62, 0.8, 1.3, 28]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <group position-y={1.2} scale={[1, 0.7, 1]}>
        <mesh castShadow>
          <sphereGeometry args={[1.3, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={roof} />
        </mesh>
        {/* White spots: small flattened spheres on the cap, at (polar, azimuth). */}
        {spots.map(([polar, az]) => (
          <mesh
            key={az}
            position={[
              1.28 * Math.sin(polar) * Math.sin(az),
              1.28 * Math.cos(polar),
              1.28 * Math.sin(polar) * Math.cos(az),
            ]}
            rotation={[polar * Math.cos(az), 0, -polar * Math.sin(az)]}
            scale={[1, 0.3, 1]}
          >
            <sphereGeometry args={[0.18, 12, 8]} />
            <meshStandardMaterial color="#fffaf0" />
          </mesh>
        ))}
      </group>
      <mesh position={[-0.6, 1.95, -0.3]} rotation-z={0.3}>
        <cylinderGeometry args={[0.08, 0.1, 0.5, 10]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <Door z={0.74} />
      <RoundWindow position={[0.5, 0.85, 0.53]} rotation={[0, 0.7, 0]} trim={trim} r={0.12} />
    </>
  );
}

const styles: Record<Shape, (c: HouseColours) => React.JSX.Element> = {
  capsule: Cottage,
  sphere: Dome,
  star: Crooked,
  cube: Stack,
  cone: Tower,
  teardrop: Mushroom,
};

type Props = HouseColours & {
  shape: Shape;
  position: [number, number, number];
  yaw: number;
};

export default function House({ shape, position, yaw, ...colours }: Props) {
  const Style = styles[shape];
  return (
    <group position={position} rotation-y={yaw}>
      <Style {...colours} />
    </group>
  );
}
