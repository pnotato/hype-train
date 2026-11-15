import { useEffect, useState } from "react";
import { shapeFor } from "../visual/personality.ts";
import MoodActor from "./mood-actor.tsx";
import { actorId } from "./sandbox-rows.ts";
import type { Beat, Scenario } from "./scenarios.ts";
import Selectable from "./selectable.tsx";

// Plays a Scenario on a loop. The beat (face, talking, pose) is React state
// that advances on a timer; MoodActor animates toward it. onBeat reports each
// new beat so the dock's portrait can match.

const gap = 0.75; // each actor's distance from the scenario centre
const turn = 0.35; // how far each actor turns toward the other, radians

export default function ScenarioView({
  scenario,
  position,
  selected,
  onSelect,
  onBeat,
}: {
  scenario: Scenario;
  position: [number, number, number];
  selected: string | null;
  onSelect: (id: string) => void;
  onBeat: (scenario: Scenario, beat: Beat) => void;
}) {
  const [i, setI] = useState(0);
  const beat = scenario.beats[i % scenario.beats.length]!;

  useEffect(() => {
    const id = setTimeout(() => setI((n) => (n + 1) % scenario.beats.length), beat.seconds * 1000);
    return () => clearTimeout(id);
  }, [i, beat.seconds, scenario.beats.length]);

  useEffect(() => onBeat(scenario, beat), [onBeat, scenario, beat]);

  return (
    <group position={position}>
      {([-1, 1] as const).map((side) => {
        const who = side < 0 ? scenario.a : scenario.b;
        const b = side < 0 ? beat.a : beat.b;
        const id = actorId(scenario, side < 0 ? "a" : "b");
        return (
          <Selectable
            key={side}
            position={[side * gap, 0, 0]}
            selected={selected === id}
            onSelect={() => onSelect(id)}
          >
            <MoodActor
              shape={shapeFor[who]}
              face={b.face}
              pose={b.pose}
              talking={b.talking}
              position={[0, 0, 0]}
              yaw={-side * turn}
            />
          </Selectable>
        );
      })}
    </group>
  );
}
