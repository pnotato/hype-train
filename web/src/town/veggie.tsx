import type { Veggie } from "./veggies.ts";

// Vegetable bodies for the ?veggies page: one original vegetable per archetype
// in place of the plain shapes. Same size and footing as resident.tsx (about
// one unit tall, standing on y = 0, face on +z). Colours are the vegetable's
// own; mood colour goes on a disc at the feet instead (see resident.tsx).

const leaf = "#4f9a3c";

function Leaves({ y, count = 3, spread = 0.35 }: { y: number; count?: number; spread?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        return (
          <mesh
            key={i}
            castShadow
            position={[Math.sin(a) * 0.05, y + 0.12, Math.cos(a) * 0.05]}
            rotation={[spread * Math.cos(a), 0, -spread * Math.sin(a)]}
          >
            <coneGeometry args={[0.06, 0.3, 8]} />
            <meshStandardMaterial color={leaf} />
          </mesh>
        );
      })}
    </>
  );
}

export function VeggieBody({ veggie }: { veggie: Veggie }) {
  switch (veggie) {
    case "carrot":
      return (
        <>
          {/* Point down: a cone flipped over, widest at the top. */}
          <mesh castShadow position-y={0.5} rotation-x={Math.PI}>
            <coneGeometry args={[0.32, 1, 24]} />
            <meshStandardMaterial color="#ee7f2d" />
          </mesh>
          <Leaves y={1} count={4} />
        </>
      );
    case "onion":
      return (
        <>
          <mesh castShadow position-y={0.42} scale={[1, 0.95, 1]}>
            <sphereGeometry args={[0.42, 32, 16]} />
            <meshStandardMaterial color="#b0587f" />
          </mesh>
          <mesh castShadow position-y={0.92}>
            <coneGeometry args={[0.1, 0.22, 12]} />
            <meshStandardMaterial color="#c9a36b" />
          </mesh>
          <Leaves y={0.95} count={2} spread={0.2} />
        </>
      );
    case "broccoli":
      return (
        <>
          <mesh castShadow position-y={0.3}>
            <cylinderGeometry args={[0.17, 0.2, 0.6, 16]} />
            <meshStandardMaterial color="#9ccf6a" />
          </mesh>
          {[
            [0, 0.82, 0, 0.26],
            [-0.22, 0.72, 0.05, 0.2],
            [0.22, 0.72, 0.05, 0.2],
            [0, 0.7, -0.18, 0.2],
            [-0.12, 0.92, -0.08, 0.17],
            [0.13, 0.9, -0.06, 0.17],
          ].map(([x, y, z, r]) => (
            <mesh key={`${x},${y},${z}`} castShadow position={[x!, y!, z!]}>
              <sphereGeometry args={[r!, 16, 10]} />
              <meshStandardMaterial color="#2f7a3a" />
            </mesh>
          ))}
        </>
      );
    case "eggplant":
      return (
        <>
          <mesh castShadow position-y={0.46} scale={[0.38, 0.46, 0.38]}>
            <sphereGeometry args={[1, 32, 16]} />
            <meshStandardMaterial color="#5b2f7a" />
          </mesh>
          <mesh castShadow position-y={0.9}>
            <coneGeometry args={[0.2, 0.12, 6]} />
            <meshStandardMaterial color={leaf} />
          </mesh>
          <mesh castShadow position-y={1}>
            <cylinderGeometry args={[0.03, 0.04, 0.16, 8]} />
            <meshStandardMaterial color="#6f8f3a" />
          </mesh>
        </>
      );
    case "corn":
      return (
        <>
          <mesh castShadow position-y={0.5}>
            <capsuleGeometry args={[0.27, 0.45, 8, 16]} />
            <meshStandardMaterial color="#f2cf45" />
          </mesh>
          {/* Husk leaves peeled down either side. */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              castShadow
              position={[side * 0.24, 0.32, -0.04]}
              rotation-z={side * 0.25}
              scale={[0.12, 0.62, 0.2]}
            >
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color="#7fb24a" />
            </mesh>
          ))}
          <mesh castShadow position-y={1.02}>
            <coneGeometry args={[0.06, 0.16, 8]} />
            <meshStandardMaterial color="#c9a36b" />
          </mesh>
        </>
      );
    case "pepper":
      return (
        <>
          {/* Four lobes around a core make the bell. */}
          <mesh castShadow position-y={0.42}>
            <sphereGeometry args={[0.38, 24, 16]} />
            <meshStandardMaterial color="#d93a2f" />
          </mesh>
          {[0, 1, 2, 3].map((k) => {
            const a = Math.PI / 4 + (k * Math.PI) / 2;
            return (
              <mesh
                key={k}
                castShadow
                position={[Math.sin(a) * 0.12, 0.4, Math.cos(a) * 0.12]}
                scale={[0.26, 0.38, 0.26]}
              >
                <sphereGeometry args={[1, 16, 12]} />
                <meshStandardMaterial color="#d93a2f" />
              </mesh>
            );
          })}
          <mesh castShadow position-y={0.86}>
            <cylinderGeometry args={[0.04, 0.06, 0.18, 8]} />
            <meshStandardMaterial color="#3f7f2e" />
          </mesh>
        </>
      );
  }
}
