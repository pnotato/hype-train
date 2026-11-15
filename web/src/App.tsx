import { useEffect, useState } from "react";
import { faces } from "./town/faces.ts";
import ShapeSandbox from "./town/shape-sandbox.tsx";
import { archetypeLabel, archetypes, shapeFor } from "./visual/personality.ts";
import TownScene from "./town/town-scene.tsx";

// ?shapes opens the shape sandbox instead of the town.
const sandbox = new URLSearchParams(location.search).has("shapes");

type Health = { status: string; brain: string };

export default function App() {
  const [health, setHealth] = useState<Health | string>("checking…");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? (res.json() as Promise<Health>) : Promise.reject(res.status)))
      .then(setHealth)
      .catch(() => setHealth("server unreachable"));
  }, []);

  return (
    <>
      {sandbox ? <ShapeSandbox /> : <TownScene />}
      <main className="overlay">
        <span className="simulated">SIMULATED</span>
        <p>
          Server:{" "}
          {typeof health === "string" ? health : `${health.status} (brain: ${health.brain})`}
        </p>
        {sandbox && (
          <div className="legend">
            <p>Front row, left to right:</p>
            <ol>
              {archetypes.map((a) => (
                <li key={a}>
                  {archetypeLabel[a]}: {shapeFor[a]}
                </li>
              ))}
            </ol>
            <p>Back row: faces, happiest to least happy:</p>
            <ol>
              {faces.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ol>
          </div>
        )}
      </main>
    </>
  );
}
