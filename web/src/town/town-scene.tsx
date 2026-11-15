import { makeRng, type Person } from "../spread/sim.ts";
import { shapeFor } from "../visual/personality.ts";
import House, { type HouseColours } from "./house.tsx";
import SpreadSandbox, { type SpreadLayout, type Vec } from "./spread-sandbox.tsx";
import { floorSize } from "./world.ts";

// The town: everyone's house stands on a horseshoe around a cobbled plaza,
// open towards the camera so nobody is hidden behind a roof. Residents wander
// the plaza and stop to chat; the spread sim (spread-sandbox.tsx) sends angry ones to
// confront whoever they pick.

const houseRadius = 9; // plaza centre to house centre
const doorstep = 2.8; // house centre to where its resident stands
const arc = (250 / 180) * Math.PI; // the horseshoe's spread; the gap faces +z
const plazaColour = "#e6dcc6";

// Angle of person i's house, measured from -z (the back of the plaza). The
// angry spreader (index 0) gets the middle house, the rest fill in around it.
function angle(i: number, n: number) {
  const slot = (i + Math.floor(n / 2)) % n;
  return -arc / 2 + (slot / (n - 1)) * arc;
}

const onCircle = (a: number, r: number): Vec => [r * Math.sin(a), 0, -r * Math.cos(a)];

const palettes: HouseColours[] = [
  { wall: "#f6e7c8", roof: "#d9634c", trim: "#7a5a44" },
  { wall: "#cfe6e8", roof: "#3f7f9a", trim: "#f4f1ea" },
  { wall: "#f3d0d8", roof: "#8e5aa8", trim: "#ffffff" },
  { wall: "#e4efc9", roof: "#5f8f4e", trim: "#6b4a33" },
  { wall: "#fde2b3", roof: "#c4572e", trim: "#5a4636" },
  { wall: "#d8d4f2", roof: "#5b5aa8", trim: "#f4f1ea" },
  { wall: "#f0d6b8", roof: "#2f6f73", trim: "#ffffff" },
  { wall: "#fff2d6", roof: "#b8463a", trim: "#6b4a33" },
];

function Tree({ position, kind, scale }: { position: Vec; kind: number; scale: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position-y={0.4}>
        <cylinderGeometry args={[0.12, 0.16, 0.8, 8]} />
        <meshStandardMaterial color="#7a5a44" />
      </mesh>
      {kind === 0 ? (
        <mesh castShadow position-y={1.35}>
          <sphereGeometry args={[0.75, 16, 12]} />
          <meshStandardMaterial color="#6fa35a" />
        </mesh>
      ) : (
        [0, 1, 2].map((k) => (
          <mesh key={k} castShadow position-y={1 + k * 0.45}>
            <coneGeometry args={[0.75 - k * 0.18, 0.9, 12]} />
            <meshStandardMaterial color="#4f8a5b" />
          </mesh>
        ))
      )}
    </group>
  );
}

function Lamp({ position }: { position: Vec }) {
  return (
    <group position={position}>
      <mesh castShadow position-y={0.8}>
        <cylinderGeometry args={[0.04, 0.06, 1.6, 8]} />
        <meshStandardMaterial color="#3b4750" />
      </mesh>
      <mesh position-y={1.68}>
        <sphereGeometry args={[0.14, 14, 10]} />
        <meshStandardMaterial color="#fff1b8" emissive="#ffd86b" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

// Trees scattered around the outside of the town, never on the plaza or the road.
const trees = (() => {
  const rng = makeRng(7);
  const out: { position: Vec; kind: number; scale: number }[] = [];
  while (out.length < 90) {
    const a = rng() * Math.PI * 2;
    const r = houseRadius + 3.5 + rng() * 35;
    const [x, , z] = onCircle(a, r);
    if (Math.abs(x) < 3 && z > 0) continue; // the road out of town
    out.push({ position: [x, 0, z], kind: rng() < 0.5 ? 0 : 1, scale: 0.8 + rng() * 0.7 });
  }
  return out;
})();

function Scenery({ people }: { people: Person[] }) {
  const n = people.length;
  const lamps = Array.from({ length: n - 1 }, (_, s) => -arc / 2 + ((s + 0.5) / (n - 1)) * arc);
  return (
    <>
      {/* Plaza, a mosaic at its middle, and the road out towards the camera. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} receiveShadow>
        <circleGeometry args={[houseRadius + 1.8, 64]} />
        <meshStandardMaterial color={plazaColour} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <ringGeometry args={[2.2, 2.6, 64]} />
        <meshStandardMaterial color="#cbb994" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
        <circleGeometry args={[1, 32]} />
        <meshStandardMaterial color="#d6c49c" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, floorSize / 4]} receiveShadow>
        <planeGeometry args={[2.8, floorSize / 2]} />
        <meshStandardMaterial color={plazaColour} />
      </mesh>

      {people.map((p, i) => {
        const a = angle(i, n);
        const at = onCircle(a, houseRadius);
        return (
          <House
            key={p.id}
            shape={shapeFor[p.archetype]}
            position={at}
            yaw={Math.atan2(-at[0], -at[2])} // front door faces the plaza
            {...palettes[i % palettes.length]!}
          />
        );
      })}
      {lamps.map((a) => (
        <Lamp key={a} position={onCircle(a, houseRadius - 0.6)} />
      ))}
      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
    </>
  );
}

const town: SpreadLayout = {
  title: "Town",
  cameraStart: [0, 14, 21],
  homes: (n) => Array.from({ length: n }, (_, i) => onCircle(angle(i, n), houseRadius - doorstep)),
  wanderRadius: houseRadius - doorstep - 0.5,
  scenery: (people) => <Scenery people={people} />,
  grid: false,
  shadowExtent: 50,
};

export default function TownScene() {
  return <SpreadSandbox layout={town} />;
}
