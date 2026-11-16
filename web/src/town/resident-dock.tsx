import { Canvas } from "@react-three/fiber";
import Resident from "./resident.tsx";
import type { SandboxItem } from "./sandbox-rows.ts";

// Bottom-left dock for the selected character: a round portrait with the
// character turned three-quarters towards the panel, then their name and
// details. The portrait is its own small canvas, so it doesn't follow the
// town camera. It's a still pose: no idle animation.

// Turn towards +x (screen right), where the details panel sits.
const portraitTurn = 0.5;
// Tip back so the face looks slightly up.
const portraitTilt = -0.2;

function Portrait({ item }: { item: SandboxItem }) {
  return (
    // A still pose, so draw only when something changes, not every frame.
    <Canvas
      frameloop="demand"
      camera={{ position: [0, 0.3, 2.5], rotation: [-0.1, 0, 0], fov: 32 }}
      aria-hidden
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[-2, 3, 4]} intensity={1.6} />
      {/* Every body is about one unit tall from y = 0; drop it so it sits centred. */}
      <group position-y={-0.4} rotation-y={portraitTurn}>
        <group rotation-x={portraitTilt}>
          <Resident shape={item.shape} colour={item.colour} face={item.face} />
        </group>
      </group>
    </Canvas>
  );
}

type Props = {
  item: SandboxItem | undefined;
  partner: SandboxItem | undefined; // who they're talking to, if anyone
  onSelect: (id: string) => void;
};

export default function ResidentDock({ item, partner, onSelect }: Props) {
  return (
    <section className="resident-dock" aria-live="polite" aria-label="Selected character">
      {item && (
        <>
          <div className="dock-portrait">
            <Portrait item={item} />
          </div>
          <div className="dock-panel">
            <h2>{item.name}</h2>
            {partner && (
              <p className="dock-talking">
                Talking: {item.name} →{" "}
                <button type="button" onClick={() => onSelect(partner.id)}>
                  {partner.name}
                </button>
              </p>
            )}
            <dl>
              {item.details.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </section>
  );
}
